// game/slice.js — Step 6: the playable vertical slice. Find Bobo in the
// apartment, put the dot on him, point, and shout "LOOK AT BOBO!" Five
// catches win the slice (?win=N for a different number; the full game will
// ship 10). The wrong cat costs a DAG! and one point — never below zero,
// never game over (docs/DECOY_CAT.md, docs/STORY.md).
//
// Same architecture as demo/talking-demo.js, which it reuses rule-for-rule:
//   * every look is imported from src/ (cats, celebration, hand, audio,
//     determinism guards); the apartment composes src/room.js untouched and
//     extends it (game/apartment.js); the level is data (game/level.js)
//   * the rendered frame is a pure function of (phase, moment, view, t,
//     score, player); only the play loop advances time and fires audio
//   * window.LC (docs/CAPTURE.md) drives captures; selfTest() gates them;
//     ?plant= faults prove the checks bite
//
//     Play it:      npm run serve  ->  http://127.0.0.1:8123/game/slice.html
//     Capture it:   npm run capture:slice
//     Audio check:  npm run audio:slicecheck
//
//     Faults (selfTest / budget must FAIL): ?plant=text · audio · score ·
//     repeats · decoy-share · over-budget · no-collision

import * as THREE from 'three';

// The guards install before anything is built — same as every page here.
import { measured, setRendering, countUnseededCalls } from '../src/determinism.js';
import { TOKENS } from '../src/tokens.js';
import { clamp, easeOutCubic, easeOutBack, seededShuffle, srgbLuma, contrast, round } from '../src/util.js';
import { buildCat, setCatPose } from '../src/cat.js';
import { createCelebration } from '../src/celebrate.js';
import { scanMarkings, contactGap } from '../src/measure.js';
import { buildHand } from '../src/hand.js';
import { VOICE_LINES, audioPlanFor, createVoiceEngine } from '../src/audio.js';
import { createInput } from '../src/input.js';
import { createWorld } from '../src/collision.js';
import { buildApartment } from './apartment.js';
import {
  WALK_RECTS, COLLIDERS, MOMENTS, MOMENT_IDS, EVENT_PHASES, ALL_STAGE_IDS,
  CANONICAL_EVENT_MOMENT, DECOY_SPOTS, DECOY_MIN_DIST, SPAWNS, VIEWS, MOVE,
  pickDecoySpot, pickSpawn,
} from './level.js';

/** Fixed strings. Exact. On purpose. Never "fixed". */
const EXACT_ENDING = 'your did it! you wind';
const EXACT_DAG = 'DAG!';
const DURATION = 6; // seconds per phase loop (the demo's clock contract)

const params = new URLSearchParams(location.search);
/** Fault injection (docs/TECH_PLAN.md "Capture contract"): the fault only
 *  exists in the URL; the source files stay correct. */
const PLANT = params.get('plant');
let ENDING_TEXT = EXACT_ENDING;
const PLAN_OVERRIDES = PLANT === 'audio' ? { yell: 'assets/audio/yell-look-at-bobo.take2.mp3' } : {};

const GATE_OFF = params.get('gate') === 'off';
const TARGET = clamp(Number.parseInt(params.get('win') ?? '5', 10) || 5, 1, 20);
const SEED = Number.parseInt(params.get('seed') ?? '11', 10) || 11;
const INITIAL_SCORE = clamp(Number.parseInt(params.get('score') ?? '0', 10) || 0, 0, TARGET);

/** Small, seeded, reproducible — the run's only randomness (docs/DECOY_CAT.md). */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const momentById = (id) => MOMENTS.find((m) => m.id === id);
const decoyById = (id) => DECOY_SPOTS.find((s) => s.id === id);

// ---------------------------------------------------------------------------
// 1. Renderer / scene / camera (same rig as the demo)
// ---------------------------------------------------------------------------
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(1); // pixel-exact captures on any display (docs/CAPTURE.md)
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x14181f);

const camera = new THREE.PerspectiveCamera(VIEWS['first-person'].fov, window.innerWidth / Math.max(1, window.innerHeight), 0.05, 40);
camera.rotation.order = 'YXZ';
scene.add(camera); // camera-parented hand needs its world matrix

// ---------------------------------------------------------------------------
// 2. The apartment, the cast, the celebration, the hand, the world
// ---------------------------------------------------------------------------
const { living, supports } = buildApartment(scene);
const { sun, WALL_Z } = living;

const bobo = buildCat('bobo');
const decoy = buildCat('decoy');
// 22 lb vs 15 lb: the shared decoy spec lands at 1.246x Bobo's width; the
// size-tell rule says a DAG! must read 1.25x wider AS BUILT, so the slice
// lifts its own decoy's width a hair (src/cat.js stays zero-diff).
const DECOY_LIFT = 1.32 / 1.3;
decoy.root.scale.x *= DECOY_LIFT;
scene.add(bobo.root, decoy.root);

const { rainHeads, rainMuzzles, rainDashes, bursts, updateRain, updateFireworks } = createCelebration(scene);

const hand = buildHand();
const handRig = new THREE.Group();
handRig.add(hand.root);
camera.add(handRig);

const world = createWorld({ rects: WALK_RECTS, colliders: COLLIDERS, radius: MOVE.playerRadius });
const input = createInput({ canvas });

// ---------------------------------------------------------------------------
// 3. The voice engine — the ONLY place audio fires is the play loop below.
// ---------------------------------------------------------------------------
const voices = createVoiceEngine({ resolve: (f) => `../${f}` });
const planFor = (phase) => audioPlanFor(phase === 'find' ? 'idle' : phase, PLAN_OVERRIDES);
let firedCues = new Set();

function markCuesUpTo(t) {
  // epsilon: cue times like 0.25 must not slip through a float gap between
  // an accumulated clock value (0.24999999999999997) and its re-derived
  // neighbour (0.25); firedCues already prevents double-firing, so an
  // inclusive `<=` with tolerance is all the boundary needs.
  planFor(game.phase).forEach((c, i) => {
    if (c.at <= t + 1e-9) firedCues.add(i);
  });
}
function advanceCues(from, to) {
  planFor(game.phase).forEach((c, i) => {
    if (!firedCues.has(i) && c.at <= to + 1e-9 && c.at > from - 1e-9) {
      firedCues.add(i);
      voices.fire(c.line, c.file);
    }
  });
}

// ---------------------------------------------------------------------------
// 4. HUD (design system §8 — the demo's exact vocabulary, same CSS)
// ---------------------------------------------------------------------------
const el = {
  score: document.getElementById('hud-score'),
  scoreNum: document.querySelector('#hud-score .num'),
  scoreMax: document.querySelector('#hud-score .max'),
  reticle: document.getElementById('reticle'),
  dag: document.getElementById('dag-burst'),
  dagLabel: document.getElementById('dag-label'),
  ending: document.getElementById('ending'),
  veil: document.getElementById('ending-veil'),
  prompt: document.getElementById('prompt'),
  label: document.getElementById('moment-label'),
  boot: document.getElementById('boot-error'),
  gate: document.getElementById('gate'),
  gateBtn: document.getElementById('gate-btn'),
  pause: document.getElementById('pause'),
};

/** What is on screen in each phase. The score pill is live state — except
 *  at the win, where it shows the target it earned. */
const HUD_SPEC = {
  find: { reticle: true, soft: false, dag: false, ending: false, prompt: true },
  catch: { reticle: true, soft: false, dag: false, ending: false, prompt: false },
  wrong: { reticle: true, soft: true, dag: true, ending: false, prompt: false },
  win: { reticle: false, soft: false, dag: false, ending: true, prompt: false },
};

function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
}
function setStyle(node, prop, value) {
  const seen = node.__styleWrites ?? (node.__styleWrites = {});
  if (seen[prop] === value) return; // quiet DOM = stable composite (demo lesson)
  seen[prop] = value;
  node.style[prop] = value;
}
const pad2 = (n) => String(Math.max(0, n)).padStart(2, '0');

function updateHud() {
  const spec = HUD_SPEC[game.phase];
  const shown = game.phase === 'win' ? TARGET : game.score;
  el.score.classList.add('show');
  setText(el.scoreNum, pad2(shown));
  setText(el.scoreMax, `/ ${pad2(TARGET)}`);
  el.reticle.classList.toggle('show', spec.reticle);
  el.reticle.classList.toggle('soft', spec.soft);
  if (el.dag.style.display !== (spec.dag ? 'block' : 'none')) el.dag.style.display = spec.dag ? 'block' : 'none';
  el.ending.classList.toggle('show', spec.ending);
  el.veil.classList.toggle('show', spec.ending);
  setText(el.ending, ENDING_TEXT);
  setText(el.dagLabel, EXACT_DAG);
  el.prompt.classList.toggle('show', spec.prompt && game.phase === 'find');
  const celebrate = game.phase === 'win' || game.phase === 'catch';
  for (const b of bursts) b.mesh.visible = celebrate;
  for (const m of [rainHeads, rainMuzzles, rainDashes]) m.visible = game.phase === 'win';
}

function updateHandVisibility() {
  // 'player-camera' is the live first-person view (not a declared capture
  // view): a body is always there. Declared views say whether they have one.
  const hasHand = viewName === 'player-camera' || Boolean(VIEWS[viewName]?.hand);
  handRig.visible = hasHand && game.phase !== 'win';
}

// ---------------------------------------------------------------------------
// 5. Game state + the run (queue, rounds, respawns — docs/TECH_PLAN.md)
// ---------------------------------------------------------------------------
const game = {
  phase: 'find', // find | catch | wrong | win
  momentId: MOMENTS[0].id,
  time: 0, // phase-local clock
  score: INITIAL_SCORE,
  view: 'first-person',
  playing: false,
  paused: false,
  decoyId: MOMENTS[0].canonicalDecoy,
  boboSupport: MOMENTS[0].spot[1],
  decoySupport: 'rug',
  spawnIdx: 0,
  prevSpawnRoom: SPAWNS[0].room,
};
let started = GATE_OFF;
let gateOpen = GATE_OFF;
let viewName = 'first-person';
let rng = mulberry32(SEED);
let queue = [];
let refills = 0;

const player = { x: SPAWNS[0].pos[0], z: SPAWNS[0].pos[1], yaw: SPAWNS[0].yaw, pitch: 0, bob: 0 };

/** The decoy pick, plant-aware so ?plant=decoy-share can make the
 *  "never shares Bobo's spot" rule fail for the capture checks to catch. */
function chooseDecoySpot(moment, rand) {
  if (PLANT === 'decoy-share') {
    return { id: `on-top-of-${moment.id}`, room: moment.room, pos: moment.spot.slice(), faceYaw: moment.faceYaw + 0.7 };
  }
  return pickDecoySpot(moment.spot, rand);
}

/** The queue iterator: a seeded shuffle per cycle, never repeats inside a
 *  cycle (?plant=repeats makes it cycle the declared order with repeats). */
function refillQueue() {
  queue = PLANT === 'repeats' ? MOMENT_IDS.slice(0, 2) : seededShuffle(MOMENT_IDS, SEED + refills++ * 101);
}
function nextMomentId() {
  if (!queue.length) refillQueue();
  if (PLANT === 'repeats') return queue[0]; // never pops: repeats forever
  return queue.shift();
}

function placeBoboAt(moment) {
  const [x, support, z] = moment.spot;
  bobo.root.position.set(x, supports[support] ?? 0, z);
  bobo.root.rotation.y = moment.faceYaw;
  setCatPose(bobo, moment.pose);
  game.boboSupport = support;
}
function placeDecoyAt(spot) {
  const [x, support, z] = spot.pos;
  decoy.root.position.set(x, supports[support] ?? 0, z);
  decoy.root.rotation.y = spot.faceYaw;
  setCatPose(decoy, 'sprawl');
  game.decoyId = spot.id;
  game.decoySupport = support;
}

/** Begin (or re-begin) the round: Bobo to his moment, decoy to a legal
 *  spot. Staging for the capture contract is canonical (no RNG, no queue);
 *  live rounds draw from the run. */
function stageFindMoment(id) {
  const m = momentById(id);
  game.momentId = id;
  placeBoboAt(m);
  placeDecoyAt(decoyById(m.canonicalDecoy));
}
function startLiveRound() {
  const m = momentById(nextMomentId());
  game.momentId = m.id;
  placeBoboAt(m);
  placeDecoyAt(chooseDecoySpot(m, rng));
}
function spawnPlayerAt(spawn) {
  player.x = spawn.pos[0];
  player.z = spawn.pos[1];
  player.yaw = spawn.yaw;
  player.pitch = 0;
  player.bob = 0;
}

function applyStage() {
  updateHud();
  updateHandVisibility();
  updateLabel();
}

// ---------------------------------------------------------------------------
// 6. The event rules — the demo's rules, exercised the same way:
//    catch +1 (reaching TARGET IS the win), wrong −1 floored at 0,
//    and after the win nothing moves the number any more.
// ---------------------------------------------------------------------------
const CATCH_END = 2.2; // seconds of catch staging before play resumes
const WRONG_END = 2.6;

function triggerEvent(event) {
  if (event !== 'catch' && event !== 'wrong') throw new Error(`Unknown event "${event}". Use catch or wrong.`);
  measured(() => {
    if (game.phase === 'win') return; // the game is over: a DAG! cannot follow the win
    if (event === 'catch') {
      game.score += 1;
      game.phase = game.score >= TARGET ? 'win' : 'catch';
    } else {
      // ?plant=score lets the penalty run below zero (score-floors-at-zero fails)
      game.score = PLANT === 'score' ? game.score - 1 : Math.max(0, game.score - 1);
      game.phase = 'wrong';
    }
    game.time = 0;
    firedCues = new Set();
    applyStage();
  });
}

/** After a catch: next moment, new decoy spot, respawn in a different room
 *  from Bobo's new spot AND from where we just were (issue #11). */
function afterCatch() {
  startLiveRound();
  const boboRoom = momentById(game.momentId).room;
  const { spawn, idx } = pickSpawn(boboRoom, game.prevSpawnRoom, game.spawnIdx);
  game.spawnIdx = idx;
  game.prevSpawnRoom = spawn.room;
  spawnPlayerAt(spawn);
  game.phase = 'find';
  game.time = 0;
  firedCues = new Set();
  applyStage();
}

function restartRun() {
  rng = mulberry32(SEED + 991); // replays are still seeded runs, never Math.random
  refills = 0;
  queue = [];
  game.score = 0;
  game.phase = 'find';
  game.time = 0;
  game.spawnIdx = 0;
  game.prevSpawnRoom = SPAWNS[0].room;
  firedCues = new Set();
  startLiveRound();
  spawnPlayerAt(SPAWNS[0]);
  applyStage();
}

// ---------------------------------------------------------------------------
// 7. The frame: everything below is a pure function of the state above.
// ---------------------------------------------------------------------------
let seekTime = 0;

function applyTime(t) {
  seekTime = t;
  // Bobo: the moment's own life — all procedural, all pure in t.
  const bp = bobo.pivots[bobo.current];
  if (bp) {
    const base = bp.body.userData.baseScale ?? (bp.body.userData.baseScale = bp.body.scale.clone());
    bp.tailPivot.rotation.y = Math.sin(t * 1.7) * 0.14;
    bp.head.rotation.y = Math.sin(t * 0.85 + 0.4) * 0.09;
    bp.head.rotation.x = bp.baseHeadX + Math.sin(t * 0.6) * 0.025;
    bp.body.scale.copy(base);
    const m = game.momentId;
    if (game.phase === 'find' && m === 'loaf-couch') {
      const s = Math.sin(t * 0.9); // the loaf breathes
      bp.body.scale.set(base.x * (1 + 0.018 * s), base.y, base.z * (1 + 0.014 * s));
    } else if (game.phase === 'find' && m === 'window-bird') {
      bp.head.rotation.y = Math.sin(t * 0.55) * 0.5; // sweeping the glass
      bp.head.rotation.x = bp.baseHeadX + Math.sin(t * 2.6) * 0.04; // chattering
      bp.tailPivot.rotation.y = Math.sin(t * 5.2) * 0.1; // the tip won't stop
    } else if (game.phase === 'find' && m === 'cardboard-box') {
      bp.head.rotation.y = Math.sin(t * 0.9) * 0.62; // peeking out of the box
      bp.tailPivot.rotation.y = Math.sin(t * 1.3) * 0.18;
    } else if (game.phase === 'find' && m === 'tail-chase') {
      bobo.root.rotation.y = momentById(m).faceYaw + t * Math.PI * 2 * 0.55; // chasing it
      bp.tailPivot.rotation.y = Math.sin(t * 6.0) * 0.24; // the tail fights back
    } else if (game.phase === 'find' && m === 'bed-sprawl') {
      const s = Math.sin(t * 0.8);
      bp.body.scale.set(base.x * (1 + 0.022 * s), base.y, base.z * (1 + 0.016 * s));
      bp.head.rotation.y = Math.sin(t * 0.5 + 1.2) * 0.34; // half-asleep watching
    }
  }
  // The decoy: a slow, heavy breath, sideways only (demo rule: never sinks).
  const dp = decoy.pivots[decoy.current];
  if (dp) {
    const base = dp.body.userData.baseScale ?? (dp.body.userData.baseScale = dp.body.scale.clone());
    const s = Math.sin(t * 1.1);
    dp.body.scale.set(base.x * (1 + 0.03 * s), base.y, base.z * (1 + 0.022 * s));
    dp.shells[0].scale.copy(dp.body.scale).multiplyScalar(1.045);
  }
  // "DAG!" eases in and stays: the penalty is a joke, not a punishment
  if (HUD_SPEC[game.phase].dag) {
    const k = clamp((t - 0.7) / 0.5, 0, 1);
    const s = k <= 0 ? 0.001 : easeOutBack(k);
    setStyle(el.dag, 'transform', `translate(-50%, -50%) scale(${s.toFixed(4)})`);
    setStyle(el.dag, 'opacity', k.toFixed(4));
  }
  if (game.phase === 'win') updateRain(t);
  if (game.phase === 'win' || game.phase === 'catch') updateFireworks(t);
  // The pointing hand (the demo's choreography, tuned copy): rises with the
  // shout, points, pulls back when the DAG! lands. In `find` it rests in the
  // lower frame — this is a body, not a prop.
  if (game.phase !== 'win') {
    if (game.phase === 'catch' || game.phase === 'wrong') {
      const wrongness = game.phase === 'wrong';
      const k = easeOutCubic(clamp((t - 0.15) / 0.4, 0, 1));
      const w = wrongness ? easeOutCubic(clamp((t - 0.95) / 0.45, 0, 1)) : 0;
      handRig.position.set(
        0.17 - 0.03 * k + 0.12 * w + (1 - k) * 0.05,
        -0.4 + 0.16 * k - 0.34 * w + Math.sin(t * 1.15) * 0.004 * k,
        -0.72 + 0.05 * k + 0.06 * w,
      );
      handRig.rotation.set(-0.05 - 0.05 * k - 0.55 * w, (wrongness ? 0 : 0.42 - 0.06 * k) - 0.45 * w, -0.08);
    } else {
      // find: lowered, alive
      handRig.position.set(0.18, -0.52 + Math.sin(t * 1.3) * 0.006, -0.66);
      handRig.rotation.set(-0.05, 0.42, -0.08);
    }
  } else {
    // win: the hand is hidden, but park it at fixed values anyway — a staged
    // pose must be a pure function of (moment, t), never of what was staged
    // at the page just before (selfTest's order-independence check enforces).
    handRig.position.set(0.18, -0.52, -0.66);
    handRig.rotation.set(-0.05, 0.42, -0.08);
  }
}

function applyView(name) {
  viewName = name;
  const v = VIEWS[name];
  camera.position.set(v.pos[0], v.pos[1], v.pos[2]);
  camera.rotation.set(v.pitch, v.yaw, 0);
  camera.fov = v.fov;
  camera.updateProjectionMatrix();
  updateHandVisibility();
}

function applyCameraFromPlayer() {
  camera.position.set(player.x, MOVE.eye + Math.sin(player.bob) * MOVE.bob * playerBobK(), player.z);
  camera.rotation.set(player.pitch, player.yaw, 0);
  camera.fov = VIEWS['first-person'].fov;
  camera.updateProjectionMatrix();
}
function playerBobK() {
  const moving = input.isDown('forward') || input.isDown('back') || input.isDown('left') || input.isDown('right');
  return moving ? 1 : 0;
}

function updateLabel() {
  setText(el.label, `${game.phase}${game.phase === 'find' ? ` · ${game.momentId}` : ''}  ·  ${viewName}  ·  t=${seekTime.toFixed(2)}s  ·  ${pad2(game.phase === 'win' ? TARGET : game.score)}/${pad2(TARGET)}`);
}

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
  camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------------------
// 8. Player physics (find phase only): src/input.js + src/collision.js
// ---------------------------------------------------------------------------
function stepPlayer(dt, scripted = null) {
  const look = scripted ? { dx: scripted.dyaw ?? 0, dy: scripted.dpitch ?? 0 } : input.takeLook();
  player.yaw -= look.dx * MOVE.sensitivity;
  player.pitch = clamp(player.pitch - look.dy * MOVE.sensitivity, -MOVE.pitchLimit, MOVE.pitchLimit);

  const fwd = scripted ? (scripted.fwd ?? 0) : (input.isDown('forward') ? 1 : 0) - (input.isDown('back') ? 1 : 0);
  const strafe = scripted ? (scripted.strafe ?? 0) : (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
  const run = scripted ? Boolean(scripted.run) : input.isDown('run');
  const speed = run ? MOVE.run : MOVE.walk;
  if (fwd || strafe) {
    // forward is -z in yaw space: (−sin yaw, −cos yaw); right is +x: (cos yaw, −sin yaw)
    const vx = (-Math.sin(player.yaw) * fwd + Math.cos(player.yaw) * strafe);
    const vz = (-Math.cos(player.yaw) * fwd - Math.sin(player.yaw) * strafe);
    const len = Math.hypot(vx, vz) || 1;
    const step = (speed * dt) / len;
    if (PLANT === 'no-collision') {
      // the planted fault: walk wherever you want, walls are a rumour
      player.x += vx * step;
      player.z += vz * step;
    } else {
      const pos = { x: player.x, z: player.z };
      world.move(pos, vx * step, vz * step);
      world.resolve(pos, [
        { x: bobo.root.position.x, z: bobo.root.position.z, r: MOVE.boboPush - MOVE.playerRadius },
        { x: decoy.root.position.x, z: decoy.root.position.z, r: MOVE.decoyPush - MOVE.playerRadius },
      ]);
      player.x = pos.x;
      player.z = pos.z;
      player.bob += step * 26; // footfall cadence rides the actual ground speed
    }
  }
}

// ---------------------------------------------------------------------------
// 9. Aim: the pointer IS the shout (click / Space while playing)
// ---------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const CENTER = new THREE.Vector2(0, 0);
function aimShout() {
  if (!started || game.paused || game.phase !== 'find') return;
  raycaster.setFromCamera(CENTER, camera);
  for (const hit of raycaster.intersectObjects([bobo.root, decoy.root], true)) {
    if (!hit.object.isMesh) continue;
    let o = hit.object;
    while (o && !(o.name ?? '').startsWith('cat-')) o = o.parent;
    if (o) {
      triggerEvent(o.name === 'cat-bobo' ? 'catch' : 'wrong');
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// 10. The live loop — the only place time advances and audio fires
// ---------------------------------------------------------------------------
function stepGame(dt) {
  for (const action of input.consumeActions()) {
    if (action === 'pause' && started && game.phase !== 'win') game.paused = true;
    if (action === 'point') aimShout();
  }
  el.pause.classList.toggle('show', game.paused);
  if (game.paused) return;

  if (game.phase === 'find') stepPlayer(dt);
  game.time += dt;

  if (game.phase === 'catch' && game.time >= CATCH_END) afterCatch();
  else if (game.phase === 'wrong' && game.time >= WRONG_END) {
    game.phase = 'find'; // the moment is NOT consumed by a DAG! (Q6)
    game.time = 0;
    firedCues = new Set();
    applyStage();
  } else if (game.phase === 'win' && game.time >= DURATION) {
    game.time -= DURATION; // the celebration loops; the score stays frozen
    firedCues = new Set();
  }

  const prev = game.time - dt;
  advanceCues(prev, game.time);
}

function frame() {
  stepGame(1 / 60);
  applyTime(game.time);
  if (started && !game.paused && viewName === 'player-camera') applyCameraFromPlayer();
  updateLabel();
  window.LC.renderNow();
}

// ---------------------------------------------------------------------------
// 11. selfTest — every rule measured back out of the built state
// ---------------------------------------------------------------------------
function poseSignature() {
  const bp = bobo.pivots[bobo.current];
  const dp = decoy.pivots[decoy.current];
  const spec = HUD_SPEC[game.phase];
  const dir = camera.getWorldDirection(new THREE.Vector3());
  return [
    game.phase, game.momentId, viewName, game.score,
    bobo.current, decoy.current, game.decoyId,
    bobo.root.position.toArray(), decoy.root.position.toArray(),
    bobo.root.rotation.y,
    bp ? [bp.tailPivot.rotation.y, bp.head.rotation.y, bp.body.scale.x] : [],
    dp ? [dp.body.scale.x, dp.body.scale.z] : [],
    camera.position.toArray(), dir.toArray(),
    handRig.visible, handRig.position.toArray(), handRig.rotation.y,
    spec.reticle, spec.soft, spec.dag, spec.ending,
    el.scoreNum.textContent, el.scoreMax.textContent,
    rainHeads.visible, bursts[0].mesh.visible,
  ].flat().map((x) => round(x)).join('|');
}

function stageOrderIndependence() {
  const canonical = new Map();
  for (const id of ALL_STAGE_IDS) {
    stageSet(id);
    stageSeek(1.25);
    canonical.set(id, poseSignature());
  }
  let worst = 0;
  let worstName = null;
  for (const id of seededShuffle(ALL_STAGE_IDS, 7)) {
    stageSet(id);
    stageSeek(1.25);
    if (poseSignature() !== canonical.get(id)) {
      worst = 1;
      worstName = id;
    }
  }
  return { worstDiff: worst, worst: worstName, visits: ALL_STAGE_IDS.length * 2 };
}

/** The scripted walk for sim-deterministic: fixed keys + fixed look deltas,
 *  no real input, run twice — the hash must match. */
function simScript(i) {
  if (i < 150) return { fwd: 1 };
  if (i < 260) return { strafe: 1, run: true };
  if (i < 330) return { fwd: -1 };
  if (i < 460) return { fwd: 1, dyaw: 2.5, dpitch: -0.2 };
  return { strafe: -1, dyaw: -1.8, run: true };
}

function simulateHash(steps, scriptFn) {
  const saved = { ...player };
  const savedView = viewName;
  spawnPlayerAt(SPAWNS[0]);
  for (let i = 0; i < steps; i++) stepPlayer(1 / 60, scriptFn(i));
  const hash = [player.x, player.z, player.yaw, player.pitch, player.bob].map((x) => round(x)).join('|');
  Object.assign(player, saved);
  viewName = savedView;
  return hash;
}

function selfTest() {
  const checks = [];
  const add = (name, value, limit, pass, note = null) =>
    checks.push({ name, value: round(value), limit, pass: Boolean(pass), note });

  scene.updateMatrixWorld(true);
  const spec = HUD_SPEC[game.phase];
  // The checks FIRE the events, so they change score/phase/moment by design.
  // Snapshot what the caller had staged and restore exactly that afterwards —
  // reading the state back after mutating it would "restore" a test artefact.
  const entry = { phase: game.phase, momentId: game.momentId, time: game.time, view: game.view };
  const savedScore = game.score;

  // --- the exact strings ----------------------------------------------------
  add('ending-text-exact', el.ending.textContent, `exactly "${EXACT_ENDING}"`, el.ending.textContent === EXACT_ENDING, 'story-fixed, never corrected');
  add('dag-text-exact', el.dagLabel.textContent, `exactly "${EXACT_DAG}"`, el.dagLabel.textContent === EXACT_DAG, 'wrong-cat line, never corrected');

  // --- HUD follows the phase ------------------------------------------------
  const endingShown = getComputedStyle(el.ending).display !== 'none';
  add('ending-visibility', endingShown ? 'shown' : 'hidden', spec.ending ? 'shown' : 'hidden', endingShown === spec.ending, `phase ${game.phase}`);
  const dagShown = el.dag.style.display !== 'none';
  add('dag-visibility', dagShown ? 'shown' : 'hidden', spec.dag ? 'shown' : 'hidden', dagShown === spec.dag, null);
  const scoreText = `${el.scoreNum.textContent} ${el.scoreMax.textContent}`;
  add('hud-score-format', scoreText, /^\d{2} \/ \d{2}$/, /^\d{2} \/ \d{2}$/.test(scoreText), `zero-padded count-up out of ${TARGET}`);

  // --- the event rules: exercised for real, numbers out ---------------------
  // TARGET is configurable (issue #11; capture runs with ?score=2), so every
  // case is written relative to it. withScore also resets the phase: the win
  // freezes all scoring by design, and the checks below must not inherit a
  // win from the previous case.
  const withScore = (n, fn) => {
    game.score = n;
    game.phase = 'find';
    return fn();
  };
  const nUp = Math.min(3, Math.max(0, TARGET - 1));
  withScore(nUp, () => {
    triggerEvent('catch');
    add('score-catch-increments', game.score, `${nUp + 1} (${nUp}+1)`, game.score === nUp + 1 || PLANT === 'score', 'a correct catch counts up once');
  });
  withScore(Math.max(4, TARGET + 1), () => {
    triggerEvent('wrong');
    add('score-wrong-decrements', game.score, `${Math.max(4, TARGET + 1) - 1}`, game.score === Math.max(4, TARGET + 1) - 1, 'the wrong cat costs a point');
  });
  withScore(0, () => {
    triggerEvent('wrong');
    add('score-floors-at-zero', game.score, 'stays 0', game.score === 0, 'gentle penalty: never negative, no game over');
  });
  withScore(TARGET - 1, () => {
    triggerEvent('catch');
    add('win-fires-at-target', `${game.score}/${game.phase}`, `${TARGET}/win`, game.score === TARGET && game.phase === 'win', `reaching ${TARGET} IS the ending`);
    add(
      'win-stage-live',
      `${rainHeads.visible ? 'rain' : 'no-rain'}/${getComputedStyle(el.ending).display !== 'none' ? 'text' : 'no-text'}`,
      'rain/text',
      rainHeads.visible && getComputedStyle(el.ending).display !== 'none',
      'the win shows the rain of Bobos AND the exact line, live',
    );
    triggerEvent('wrong');
    add('score-frozen-after-win', `${game.score}/${game.phase}`, `${TARGET}/win`, game.score === TARGET && game.phase === 'win', 'after the win, nothing moves the score');
  });

  // --- the fairness rules from docs/DECOY_CAT.md + issue #11 -----------------
  let repeatsOk = true;
  {
    const savedQ = queue.slice();
    const savedR = refills;
    queue = [];
    refills = 7;
    const seen = [];
    for (let i = 0; i < 15; i++) seen.push(nextMomentId());
    for (let c = 0; c < 3; c++) {
      const cycle = new Set(seen.slice(c * 5, c * 5 + 5));
      if (cycle.size !== MOMENT_IDS.length) repeatsOk = false;
    }
    queue = savedQ;
    refills = savedR;
  }
  add('queue-no-repeats', repeatsOk ? '5 distinct per cycle' : 'repeat inside a cycle', 'no repeats within a cycle', repeatsOk, 'shuffled cycle, reshuffle when exhausted');

  let decoyOk = true;
  let decoyWorst = null;
  for (const m of MOMENTS) {
    for (let seed = 1; seed <= 12; seed++) {
      const spot = chooseDecoySpot(m, mulberry32(seed * 7 + 1));
      const d = spot ? Math.hypot(spot.pos[0] - m.spot[0], spot.pos[2] - m.spot[2]) : -1;
      if (!spot || d < DECOY_MIN_DIST) {
        decoyOk = false;
        decoyWorst = `${m.id}/${spot?.id ?? 'none'}@${d.toFixed(2)}m`;
      }
    }
  }
  add('decoy-never-shares-spot', decoyOk ? `≥${DECOY_MIN_DIST} m, all moments × 12 seeds` : decoyWorst, `≥${DECOY_MIN_DIST} m, never Bobo's spot`, decoyOk, 'the whole game is "is it Bobo?" — so a DAG! must always be findable-and-wrong');
  // and the live round right now:
  const liveD = Math.hypot(decoy.root.position.x - bobo.root.position.x, decoy.root.position.z - bobo.root.position.z);
  add('live-round-decoy-legal', liveD, `≥${DECOY_MIN_DIST} m`, liveD >= DECOY_MIN_DIST, `decoy ${game.decoyId} vs ${game.momentId}`);

  const inUnion = (x, z) => WALK_RECTS.some((r) => x >= r.x0 - 0.01 && x <= r.x1 + 0.01 && z >= r.z0 - 0.01 && z <= r.z1 + 0.01);
  let spotsOk = true;
  for (const m of MOMENTS) if (!inUnion(m.spot[0], m.spot[2])) spotsOk = false;
  for (const s of DECOY_SPOTS) if (!inUnion(s.pos[0], s.pos[2])) spotsOk = false;
  for (const s of SPAWNS) if (!inUnion(s.pos[0], s.pos[1])) spotsOk = false;
  add('spots-walkable', spotsOk ? 'all inside' : 'outside walk area', 'every spot/spawn inside the walk rects', spotsOk, null);

  // walk rects connect: every rect reachable from 'living' through overlaps
  let connected = true;
  {
    const seen = new Set([0]);
    const stack = [0];
    const touch = (a, b) => a.x0 <= b.x1 + 0.03 && b.x0 <= a.x1 + 0.03 && a.z0 <= b.z1 + 0.03 && b.z0 <= a.z1 + 0.03;
    while (stack.length) {
      const i = stack.pop();
      WALK_RECTS.forEach((r, j) => {
        if (!seen.has(j) && touch(WALK_RECTS[i], r)) {
          seen.add(j);
          stack.push(j);
        }
      });
    }
    connected = seen.size === WALK_RECTS.length;
  }
  add('walk-rects-connected', connected ? `${WALK_RECTS.length} rects, one union` : 'union is broken', 'every moment reachable from every spawn', connected, 'one open doorway chain — no locked doors, no jumps');

  // scripted dash north: 400 walking steps must stop AT the north wall,
  // inside the walk union (?plant=no-collision sails through it)
  {
    const saved = { ...player };
    spawnPlayerAt({ pos: [0.4, 0], yaw: 0 });
    for (let i = 0; i < 400; i++) stepPlayer(1 / 60, { fwd: 1 });
    const z = player.z;
    Object.assign(player, saved);
    add('walk-blocked', `z=${z.toFixed(2)}`, 'stops at the north wall (−2.52), never through it', z >= -2.53 && z <= -2.4 && inUnion(player.x, z), 'walls are not a rumour (the walk rect is the wall, inset)');
  }

  let respawnOk = true;
  for (const boboRoom of ['living', 'hall', 'bedroom']) {
    const { spawn } = pickSpawn(boboRoom, 'living', 0);
    if (spawn.room === boboRoom) respawnOk = false;
  }
  add('respawn-changes-room', respawnOk ? 'different room, every case' : 'same room as Bobo', 'spawn room ≠ Bobo\'s new room', respawnOk, '"respawn elsewhere" after each catch (issue #11)');

  // --- the cast reads right (Step 3 tells hold here) ------------------------
  const bb = scanMarkings(bobo, bobo.current);
  const dd = scanMarkings(decoy, decoy.current);
  add(
    'cats-distinguishable',
    `dash ${bb.dash}/collar ${dd.collar}`,
    'dash on Bobo only, collar on the decoy',
    bb.dash > 0 && dd.dash === 0 && dd.collar > 0 && bb.collar === 0,
    'the whole game is "is it Bobo?" at a glance',
  );
  // "as built" means NEUTRAL: a fresh sit-pose box on freshly built cats.
  // The live cats' pose groups are mid-moment here (breath scale, re-parented
  // meshes), so measuring them would compare whoever happens to be staged.
  const bbBox = new THREE.Box3();
  const ddBox = new THREE.Box3();
  {
    const b2 = buildCat('bobo');
    const d2 = buildCat('decoy');
    d2.root.scale.x *= DECOY_LIFT; // the same lift this slice gives its decoy
    b2.root.updateMatrixWorld(true);
    d2.root.updateMatrixWorld(true);
    bbBox.setFromObject(b2.poses.sit);
    ddBox.setFromObject(d2.poses.sit);
  }
  add('size-tell-width', ddBox.getSize(new THREE.Vector3()).x / bbBox.getSize(new THREE.Vector3()).x, '≥1.25× as wide', ddBox.getSize(new THREE.Vector3()).x / bbBox.getSize(new THREE.Vector3()).x >= 1.25, '22 lb vs 15 lb, measured as built');
  {
    const g1 = contactGap(bobo, game.boboSupport, supports);
    add('bobo-contact', g1.gap, '-0.001..+0.002 m', g1.gap >= -0.001 && g1.gap <= 0.002, `${bobo.current} on ${game.boboSupport}: "${g1.who}"`);
    const g2 = contactGap(decoy, game.decoySupport, supports);
    add('decoy-contact', g2.gap, '-0.001..+0.002 m', g2.gap >= -0.001 && g2.gap <= 0.002, `sprawl on ${game.decoySupport}: "${g2.who}"`);
  }

  // --- audio: the shipped picks, scheduled per the feel ----------------------
  const fmt = (plan) => plan.map((c) => `${c.line}@${c.at}=${c.file.split('/').pop()}`).join(', ') || 'silence';
  add('audio-plan-catch', fmt(planFor('catch')), 'yell@0.25=yell-look-at-bobo.take1.mp3', fmt(planFor('catch')) === 'yell@0.25=yell-look-at-bobo.take1.mp3', 'docs/VOICES.md: yell take 1');
  add(
    'audio-plan-wrong',
    fmt(planFor('wrong')),
    'yell@0.25=yell-look-at-bobo.take1.mp3, dag@1.8=dag-wrong-cat.take2.mp3',
    fmt(planFor('wrong')) === 'yell@0.25=yell-look-at-bobo.take1.mp3, dag@1.8=dag-wrong-cat.take2.mp3',
    'the shout first (it thought it was Bobo), then the DAG! take 2',
  );
  add('audio-plan-win', fmt(planFor('win')), 'win@0.35=win-line.take2.mp3', fmt(planFor('win')) === 'win@0.35=win-line.take2.mp3', 'docs/VOICES.md: win take 2');
  add('audio-plan-find', fmt(planFor('find')), 'silence', fmt(planFor('find')) === 'silence', 'searching says nothing');
  const pickFiles = Object.values(VOICE_LINES).map((v) => v.file.split('/').pop()).join(', ');
  add(
    'audio-picks-match-docs',
    pickFiles,
    'yell t1, dag t2, win t2',
    pickFiles === 'yell-look-at-bobo.take1.mp3, dag-wrong-cat.take2.mp3, win-line.take2.mp3' && Object.values(VOICE_LINES).every((v) => v.dur > 0),
    'the docs/VOICES.md shipped takes, referenced not copied',
  );

  // --- the gate --------------------------------------------------------------
  const gateHidden = el.gate.classList.contains('hidden');
  add(
    'gate-state',
    `${gateHidden ? 'hidden' : 'shown'}/${gateOpen ? 'open' : 'locked'}`,
    GATE_OFF ? 'hidden/open' : 'shown/locked',
    gateHidden === GATE_OFF && gateOpen === GATE_OFF,
    'click-to-begin before any sound; ?gate=off only for headless capture',
  );

  // --- celebration staging ---------------------------------------------------
  const fireworks = ['find', 'catch', 'wrong', 'win'].map((p) => {
    const saved = game.phase;
    game.phase = p;
    updateHud();
    const v = bursts.every((b) => b.mesh.visible);
    game.phase = saved;
    updateHud();
    return v;
  });
  add('fireworks-on-catch-and-win', fireworks.join('/'), 'false/true/false/true', fireworks.join('/') === 'false/true/false/true', 'a catch earns a pop; the rain is only the win');

  // --- the look is the chosen look -------------------------------------------
  add('fur-not-pure-black', srgbLuma(TOKENS.furBlack), '≥0.004 luma', srgbLuma(TOKENS.furBlack) >= 0.004, 'imported from src/tokens.js');
  const worstUi = [['paper/ink', contrast(TOKENS.uiPaper, TOKENS.uiInk)], ['mustard/ink', contrast(TOKENS.uiMustard, TOKENS.uiInk)], ['coral/ink', contrast(TOKENS.uiCoral, TOKENS.uiInk)]].reduce((a, b) => (b[1] < a[1] ? b : a));
  add('ui-contrast', worstUi[1], '≥4.5:1 (WCAG AA)', worstUi[1] >= 4.5, `worst pair ${worstUi[0]}`);
  add(
    'filmic-tonemap',
    renderer.toneMapping === THREE.ACESFilmicToneMapping ? 'ACES' : String(renderer.toneMapping),
    'ACESFilmic',
    renderer.toneMapping === THREE.ACESFilmicToneMapping,
    null,
  );
  add('sun-through-window', `z=${sun.position.z.toFixed(1)}, y=${sun.position.y.toFixed(1)}`, 'outside the far wall and above it', sun.position.z < WALL_Z && sun.position.y > 2, null);

  // --- the contract -----------------------------------------------------------
  // 'player-camera' is the live view, not a capture view: exclude it from the
  // distinctness union (it follows the player, so its VIEWS slot is nominal).
  const positions = Object.values(VIEWS)
    .filter((v) => !v.live)
    .map((v) => new THREE.Vector3(...v.pos));
  let minDist = Infinity;
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) minDist = Math.min(minDist, positions[i].distanceTo(positions[j]));
  }
  add('views-distinct', minDist, '≥0.5 m apart', minDist >= 0.5 && Object.keys(VIEWS).length >= 4, `${Object.keys(VIEWS).length} declared views`);

  // --- determinism -------------------------------------------------------------
  // Stage the entry state FIRST: the event checks above fired catch/wrong/win,
  // so "however we arrived" is no longer a pure function of (moment, t).
  const t0 = entry.time;
  const m0 = entry.phase === 'find' ? entry.momentId : entry.phase;
  const other = ALL_STAGE_IDS.find((m) => m !== m0) ?? m0;
  stageSet(m0);
  stageSeek(t0);
  const sigBefore = poseSignature();
  stageSet(other);
  stageSeek(clamp(t0 + 1.31, 0, DURATION));
  stageSet(m0);
  stageSeek(t0);
  add('seek-repeatable', sigBefore === poseSignature() ? 0 : 1, '≤1e-9', sigBefore === poseSignature(), `pose at t=${round(t0)} before vs after visiting "${other}"`);

  const order = stageOrderIndependence();
  add(
    'stage-order-independent',
    order.worstDiff,
    '≤1e-9',
    order.worstDiff <= 1e-9,
    `${order.visits} visits, declared order vs a seeded shuffle${order.worst ? ` (worst: ${order.worst})` : ''}`,
  );
  const h1 = simulateHash(600, simScript);
  const h2 = simulateHash(600, simScript);
  add('sim-deterministic', h1 === h2 ? '600 steps, same hash' : `${h1} vs ${h2}`, 'two identical scripted runs hash equal', h1 === h2, 'movement + look are pure functions of the script');
  add('seek-no-unseeded-random', countUnseededCalls(), '0 calls', countUnseededCalls() === 0, 'Math.random / Date.now inside seek / setMoment / trigger');

  const stats = window.LC?.getStats ? window.LC.getStats() : { drawCalls: 0 };
  add('stats-available', stats.drawCalls, '>0 draw calls', stats.drawCalls > 0, 'render once before getStats means anything');
  add(
    'lighting-budget-intent',
    `${stats.realLights} lights / ${stats.shadowLights} shadow`,
    '≤6 lights, ≤1 shadow light by design',
    stats.realLights <= 6 && stats.shadowLights <= 1,
    'sun stays the only shadow light; hall + bedroom get no-shadow fill',
  );

  game.score = savedScore;
  restoreAfterSelfTest(entry);
  return { pass: checks.every((c) => c.pass), checks };
}

// Staging helpers shared by LC.setMoment/seek and selfTest, so the capture
// path and the test path exercise THE SAME code.
function stageSet(id) {
  if (EVENT_PHASES.includes(id)) {
    stageFindMoment(CANONICAL_EVENT_MOMENT); // the canonical event tableau
    game.phase = id;
  } else if (momentById(id)) {
    stageFindMoment(id);
    game.phase = 'find';
  } else {
    throw new Error(`Unknown moment "${id}". Declared: ${ALL_STAGE_IDS.join(', ')}`);
  }
  firedCues = new Set();
  markCuesUpTo(game.time);
  updateHud();
  updateHandVisibility();
}
function stageSeek(t) {
  game.time = clamp(t, 0, DURATION);
  markCuesUpTo(game.time);
  applyTime(game.time);
  updateLabel();
}

function restoreAfterSelfTest(entry) {
  // Restore EXACTLY what selfTest() snapshotted before it fired any events.
  stageSet(entry.phase === 'find' ? entry.momentId : entry.phase);
  stageSeek(entry.time);
  applyView(entry.view);
  updateLabel();
}

// ---------------------------------------------------------------------------
// 12. window.LC — the capture contract (docs/CAPTURE.md) + extensions
// ---------------------------------------------------------------------------
function installContract() {
  window.LC = {
    ready: false,
    duration: DURATION,
    views: Object.keys(VIEWS),
    setView(name) {
      if (!VIEWS[name]) throw new Error(`Unknown view "${name}". Declared: ${Object.keys(VIEWS).join(', ')}`);
      game.view = name;
      applyView(name);
      updateLabel();
    },
    seek(t) {
      measured(() => stageSeek(Number(t) || 0));
    },
    play() {
      if (game.playing) return;
      game.playing = true;
      renderer.setAnimationLoop(frame);
    },
    pause() {
      game.playing = false;
      renderer.setAnimationLoop(null);
    },
    renderNow() {
      resizeIfNeeded();
      setRendering(true);
      try {
        renderer.render(scene, camera);
      } finally {
        setRendering(false);
      }
    },
    getStats() {
      let realLights = 0;
      let shadowLights = 0;
      scene.traverse((object) => {
        if (object.isLight) {
          if (object.isDirectionalLight || object.isPointLight || object.isSpotLight || object.isRectAreaLight) realLights++;
          if (object.castShadow) shadowLights++;
        }
      });
      return {
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        programs: renderer.info.programs ? renderer.info.programs.length : 0,
        passes: 1,
        realLights,
        shadowLights,
      };
    },
    selfTest,

    // --- moment layer
    moments: ALL_STAGE_IDS.slice(),
    moment() {
      return { id: game.phase === 'find' ? game.momentId : game.phase, phase: game.phase, score: game.score, plan: planFor(game.phase) };
    },
    setMoment(id) {
      measured(() => {
        stageSet(id);
        stageSeek(game.time);
      });
    },
    goto(momentId, t) {
      if (momentId != null) this.setMoment(momentId);
      if (t != null) this.seek(t);
      this.renderNow();
    },
    time() {
      return game.time;
    },
    view() {
      return game.view;
    },
    playing() {
      return game.playing;
    },
    state() {
      return {
        phase: game.phase, momentId: game.momentId, time: game.time, view: game.view, playing: game.playing,
        paused: game.paused, score: game.score, target: TARGET, duration: DURATION,
        px: round(player.x), pz: round(player.z), yaw: round(player.yaw), pitch: round(player.pitch),
        decoyId: game.decoyId, seed: SEED, gateOpen, plant: PLANT,
      };
    },
    camera(name = game.view) {
      if (name === 'player-camera') {
        return {
          name,
          position: [round(player.x), round(MOVE.eye), round(player.z)],
          yaw: round(player.yaw), pitch: round(player.pitch), fov: VIEWS['first-person'].fov,
        };
      }
      const v = VIEWS[name];
      if (!v) throw new Error(`Unknown view "${name}".`);
      return { name, position: v.pos.slice(), yaw: v.yaw, pitch: v.pitch, fov: v.fov };
    },
    endingText: EXACT_ENDING,
    dagText: EXACT_DAG,
    tokens: TOKENS,
    styleName: 'Sunny Room, Soft Fur',
    plant: PLANT,

    // --- the game layer (same extensions the demo established)
    trigger(event) {
      triggerEvent(event);
    },
    scoreValue() {
      return game.score;
    },
    setScore(n) {
      game.score = clamp(Number(n) || 0, 0, TARGET);
      updateHud();
      updateLabel();
    },
    simulate(steps, scriptFn) {
      return simulateHash(Number(steps) || 0, typeof scriptFn === 'function' ? scriptFn : simScript);
    },
    respawnHere(x, z, yaw = 0) {
      player.x = x;
      player.z = z;
      player.yaw = yaw;
      player.pitch = 0;
    },
    /** Test helper (audio slice-check, Step 7 bot): stand the player on
     *  walkable floor with a clear line to a cat and point the camera at its
     *  head — the exact state a player who walked over and aimed would be in.
     *  Returns where it ended up and which cat the centre ray now hits. */
    aimAt(which = 'bobo') {
      const root = which === 'decoy' ? decoy.root : bobo.root;
      const want = root.name; // 'cat-bobo' | 'cat-decoy'
      const cx = root.position.x;
      const cz = root.position.z;
      const headY = root.position.y + (which === 'decoy' ? 0.36 : 0.34);
      const px0 = player.x;
      const pz0 = player.z;
      const dx0 = px0 - cx;
      const dz0 = pz0 - cz;
      const len0 = Math.hypot(dx0, dz0) || 1;
      const centreHit = () => {
        raycaster.setFromCamera(CENTER, camera);
        for (const hit of raycaster.intersectObjects(scene.children, true)) {
          if (!hit.object.isMesh || !hit.object.visible) continue;
          let o = hit.object;
          while (o && !(o.name ?? '').startsWith('cat-')) o = o.parent;
          return o ? o.name : 'wall/prop';
        }
        return null;
      };
      // Nearest vantage whose CENTRE RAY actually reaches the cat wins (a
      // box flap or chair back at 3.4 m would otherwise "aim" through it).
      const aimFrom = (probe) => {
        player.x = probe.x;
        player.z = probe.z;
        const dx = cx - player.x;
        const dz = cz - player.z;
        player.yaw = Math.atan2(-dx, -dz);
        player.pitch = clamp(Math.atan2(headY - MOVE.eye, Math.hypot(dx, dz)), -MOVE.pitchLimit, MOVE.pitchLimit);
        applyCameraFromPlayer();
        camera.updateMatrixWorld();
        return centreHit();
      };
      const walkable = (p) => {
        if (!world.inside(p.x, p.z)) return false;
        world.resolve(p, []);
        return world.inside(p.x, p.z);
      };
      let last = null;
      for (let dist = 1.3; dist <= 3.4; dist += 0.25) {
        const probe = { x: cx + (dx0 / len0) * dist, z: cz + (dz0 / len0) * dist };
        if (!walkable(probe)) continue;
        last = last ?? aimFrom(probe);
        if (last === want) break;
      }
      // The line back to where the player was may cross a wall (cross-room
      // respawn): walk a ring around the cat and take the first angle from
      // which the ray reaches it — every spot in this game is open floor.
      if (last !== want) {
        for (const dist of [1.6, 2.2, 2.8]) {
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2 + 0.3;
            const probe = { x: cx + Math.sin(a) * dist, z: cz + Math.cos(a) * dist };
            if (!walkable(probe)) continue;
            last = aimFrom(probe);
            if (last === want) break;
          }
          if (last === want) break;
        }
      }
      const hits = centreHit();
      return { x: round(player.x), z: round(player.z), yaw: round(player.yaw), pitch: round(player.pitch), hits: hits ?? last };
    },
    audioPlan(phase = game.phase) {
      return planFor(phase);
    },
    /** Cue bookkeeping for the audio check / step 7 bot: which planned cues
     *  are already consumed for the current phase, and the phase clock. */
    cuesDebug() {
      return { fired: [...firedCues], phase: game.phase, time: round(game.time), plan: planFor(game.phase).map((c) => `${c.line}@${c.at}`) };
    },
    audioStatus() {
      return { unlocked: gateOpen, engineUnlocked: voices.audioUnlocked(), lines: voices.audioStatus() };
    },
    gateUnlocked() {
      return gateOpen;
    },
    unlock() {
      unlockGate();
    },
    restart() {
      restartRun();
    },
  };
}

let lastWidth = 0;
let lastHeight = 0;
function resizeIfNeeded() {
  const w = Math.max(1, canvas.clientWidth || window.innerWidth);
  const h = Math.max(1, canvas.clientHeight || window.innerHeight);
  if (w !== lastWidth || h !== lastHeight) {
    lastWidth = w;
    lastHeight = h;
    resize();
  }
}

// ---------------------------------------------------------------------------
// 13. The gate (click unlocks audio + pointer lock), pause, restart
// ---------------------------------------------------------------------------
function unlockGate() {
  if (gateOpen) return;
  gateOpen = true;
  voices.unlock();
  el.gate.classList.add('hidden');
  if (!started) startGame();
}

function startGame() {
  started = true;
  rng = mulberry32(SEED);
  refills = 0;
  queue = [];
  startLiveRound();
  spawnPlayerAt(SPAWNS[0]);
  game.view = 'player-camera'; // the live camera follows the player now
  applyStage();
  input.lock();
  window.LC?.play();
}

function wireInput() {
  el.gate.addEventListener('click', unlockGate);
  el.pause.addEventListener('click', () => {
    if (game.phase === 'win') return;
    input.lock(); // resuming IS the click-to-resume
  });
  input.onLockChange((locked) => {
    if (locked) game.paused = false;
    else if (started && game.phase !== 'win' && !GATE_OFF) game.paused = true;
    el.pause.classList.toggle('show', game.paused);
  });
  canvas.addEventListener('click', () => {
    if (!gateOpen) return;
    if (game.phase === 'win') {
      restartRun();
      return;
    }
    if (input.isLocked()) input.queueAction('point');
    else input.lock();
  });
  window.addEventListener('keydown', (ev) => {
    if (ev.code === 'Space' && gateOpen && !ev.repeat) {
      ev.preventDefault();
      if (game.phase === 'win') restartRun();
      else input.queueAction('point');
    }
  });
}

// Fault injection, applied after everything is built so selfTest can catch it.
if (PLANT === 'text') {
  ENDING_TEXT = 'you did it! you win'; // the joke "fixed": ending-text-exact must fail
} else if (PLANT === 'over-budget') {
  const g = new THREE.BoxGeometry(0.02, 0.02, 0.02);
  const m = new THREE.MeshStandardMaterial({ color: 0x223344 });
  for (let i = 0; i < 170; i++) {
    const mesh = new THREE.Mesh(g, m); // 170 separate draws: the budget must notice
    // children of the camera: in frustum for EVERY view, so no view escapes
    mesh.position.set((i % 13) * 0.01 - 0.06, (Math.floor(i / 13) * 0.01 - 0.06), -1);
    camera.add(mesh);
  }
} else if (PLANT && !['text', 'audio', 'score', 'repeats', 'decoy-share', 'over-budget', 'no-collision'].includes(PLANT)) {
  console.warn(`Unknown plant "${PLANT}".`);
}

function boot() {
  if (GATE_OFF) el.gate.classList.add('hidden');
  stageFindMoment(MOMENTS[0].id);
  applyStage();
  applyView('first-person');
  applyTime(0);
  resize();
  renderer.render(scene, camera);
  installContract();
  wireInput();
  window.LC.ready = true;
  window.addEventListener('resize', () => {
    lastWidth = 0;
    resizeIfNeeded();
  });
  console.info(
    `[look-at-bobo] step 6 slice ready — ${window.LC.moments.length} stages, ${window.LC.views.length} views, win at ${TARGET}, voice engine ${voices.audioUnlocked() ? 'unlocked' : 'gated'}.`,
  );
}

try {
  boot();
} catch (err) {
  window.LCError = `${err && err.message ? err.message : err}\n${err && err.stack ? err.stack : ''}`;
  el.boot.style.display = 'block';
  el.boot.textContent = `Step 6 slice failed to start:\n${window.LCError}`;
  console.error(err);
}
