// game/engine.js — the shared game engine (Step 8). This is the Step 6 slice
// (game/slice.js) lifted into a factory: `bootGame(cfg)` runs the whole page
// with a level and an apartment injected. Every rule is unchanged:
//   * every look is imported from src/ (cats, celebration, hand, audio,
//     determinism guards); the apartment composes src/room.js untouched
//   * the rendered frame is a pure function of (phase, moment, view, t,
//     score, player); only the play loop advances time and fires audio
//   * window.LC (docs/CAPTURE.md) drives captures; selfTest() gates them;
//     ?plant= faults prove the checks bite
//
// cfg carries what differs between the slice and the full game:
//   cfg.level          — the level.js-shaped data module (rects, moments,
//                        decoys, spawns, views, MOVE, pickDecoySpot, pickSpawn)
//   cfg.buildApartment — (scene) => { living, supports, … }
//   cfg.momentAnim     — per-moment find-phase animation, called in applyTime
//                        where the slice's if-chain stood; pure in t
//   cfg.winDefault     — points to win when ?win= is absent (slice 5, full 10)
//   cfg.bootName / cfg.failPrefix — the console/boot-message wording
//   cfg.extraChecks    — extra selfTest checks the full game adds
//   cfg.hintFade       — { fadeStart, fadeEnd } seconds of find-phase time
//                        over which #hint fades out once (live loop only —
//                        captured frames never see it, staging never ticks)
//   optional DOM: #pause-restart (restart button in the pause card) and
//                 #ending-again (play-again line under the win text) — wired
//                 when present, absent on the slice page = zero behaviour diff.

import * as THREE from 'three';

// The guards install before anything is built — same as every page here.
import { measured, setRendering, countUnseededCalls } from '../src/determinism.js';
import { TOKENS } from '../src/tokens.js';
import { clamp, easeOutCubic, easeOutBack, seededShuffle, srgbLuma, contrast, round } from '../src/util.js';
import { buildCat, setCatPose } from '../src/cat.js';
import { createCelebration } from '../src/celebrate.js';
import { createConfetti, juiceFrame } from '../src/juice.js';
import { scanMarkings, contactGap } from '../src/measure.js';
import { buildHand } from '../src/hand.js';
import { VOICE_LINES, audioPlanFor, createVoiceEngine } from '../src/audio.js';
import { createInput } from '../src/input.js';
import { createWorld } from '../src/collision.js';
import { buildGrid, nearestStandable, bestApproach, wallFaceFailures } from '../src/reach.js';
import { touchOverride, isTouchDevice, autoLowQuality, createTouchControls } from '../src/touch.js';

/**
 * Turn a level's `faceYaw` into the rotation that actually points Bobo's face
 * that way (issue #27, bug 4 — he was rendering backwards).
 *
 * The angle convention, shared by cameras and cats and documented in
 * docs/LEVEL_LAYOUT.md: a yaw a faces (−sin a, −cos a). That is what the
 * camera does with its yaw, because a Three.js camera looks down its own −z.
 * The cat rig faces the other way: its head, nose and whiskers are at local
 * +z (docs/CHARACTERS.md), so a bare `rotation.y = a` aims a cat at
 * (sin a, cos a) — 180° from the number the level declared, which is why
 * spots authored against the doc appeared to stare at walls.
 *
 * One function, one conversion: every place a cat's root gets turned goes
 * through here, so the rig and the convention can never drift apart again.
 */
export function catRootYaw(faceYaw) {
  return faceYaw + Math.PI;
}

export function bootGame(cfg) {
  const {
    WALK_RECTS, COLLIDERS, MOMENTS, MOMENT_IDS, EVENT_PHASES, ALL_STAGE_IDS,
    CANONICAL_EVENT_MOMENT, DECOY_SPOTS, DECOY_MIN_DIST, SPAWNS, VIEWS, MOVE,
    pickDecoySpot, pickSpawn,
  } = cfg.level;

  /** Fixed strings. Exact. On purpose. Never "fixed". */
  const EXACT_ENDING = 'your did it! you wind';
  const EXACT_DAG = 'DAG!';
  const DURATION = 6; // seconds per phase loop (the demo's clock contract)
  /** The live play view (not in VIEWS: it has no fixed pose — it follows the
   *  player). Fixed in step 7: boot used to set game.view to this without
   *  ever setting viewName, so only captures ever saw the player's own eyes. */
  const LIVE_VIEW = 'player-camera';

  const WIN_DEFAULT = cfg.winDefault ?? 5;

  const params = new URLSearchParams(location.search);
  /** Fault injection (docs/TECH_PLAN.md "Capture contract"): the fault only
   *  exists in the URL; the source files stay correct. */
  const PLANT = params.get('plant');
  let ENDING_TEXT = EXACT_ENDING;
  const PLAN_OVERRIDES = PLANT === 'audio' ? { yell: 'assets/audio/yell-look-at-bobo.take2.mp3' } : {};

  const GATE_OFF = params.get('gate') === 'off';
  const TARGET = clamp(Number.parseInt(params.get('win') ?? String(WIN_DEFAULT), 10) || WIN_DEFAULT, 1, 20);
  const SEED = Number.parseInt(params.get('seed') ?? '11', 10) || 11;
  const INITIAL_SCORE = clamp(Number.parseInt(params.get('score') ?? '0', 10) || 0, 0, TARGET);

  // Step 9 comfort/accessibility (issue #19). Every default keeps the game
  // exactly as the suites captured it. The settings panel writes these same
  // params into the URL, so a choice survives refresh and shares as a link:
  // ?sens=0.5..3  ?invertY=1  ?motion=off  ?volume=0..1  ?mute=1  ?contrast=high
  const sensRaw = Number.parseFloat(params.get('sens') ?? '');
  const volRaw = Number.parseFloat(params.get('volume') ?? '');
  // OS-level "reduce motion" is the default for calm mode; the url overrides
  // both ways (?motion=off forces calm, ?motion=full forces the juice back).
  const OS_REDUCE = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motionParam = params.get('motion');
  // Issue #25 (phones): TOUCH decides the CONTROL mode (?touch=on|off wins);
  // AUTO_LOW is a device fact (touch or tiny screen) that only picks the
  // quality DEFAULT — ?quality=low/high always beat it, both ways.
  //
  // Issue #29: TOUCH is a LET, because detection is a guess and the phone that
  // guesses wrong is the bug being fixed. `?touch=off` still wins at boot (QA on
  // a real phone), and a mouse never changes the mode, but the first real finger
  // flips it over — see `enableTouchMode` / `watchForTouch` in section 13.
  const TOUCH_OVERRIDE = touchOverride(location.search);
  let TOUCH = TOUCH_OVERRIDE ?? isTouchDevice();
  const AUTO_LOW = autoLowQuality();
  const qualityParam = params.get('quality');
  const SETTINGS = {
    sens: Number.isFinite(sensRaw) ? clamp(sensRaw, 0.2, 3) : 1,
    invertY: params.get('invertY') === '1',
    reducedMotion: motionParam === 'off' || (motionParam !== 'full' && OS_REDUCE),
    highContrast: params.get('contrast') === 'high',
    volume: Number.isFinite(volRaw) ? clamp(volRaw, 0, 1) : 1,
    muted: params.get('mute') === '1',
    // Weak-GPU path: ?quality=low|high, else auto-low on phones (?quality=low).
    quality: qualityParam === 'low' || (qualityParam !== 'high' && AUTO_LOW) ? 'low' : 'full',
  };

  // ---------------------------------------------------------------------------
  // 0b. The build stamp (issue #29) — "which build am I actually looking at?"
  // ---------------------------------------------------------------------------
  // Two independent sources, on purpose:
  //   * game/full.html carries its own stamp in a 6-line INLINE script, so it
  //     renders even when the JavaScript on this phone is a stale cached module
  //     (the failure that cost Brandon a phone test);
  //   * this file reads the `?v=<stamp>` that `npm run build` put on its OWN
  //     module URL, so it reports the build the JS really came from.
  // Same build → one stamp. A stale cache → "build <js> · html <other> …", a
  // mismatch anyone can read. In the source tree neither exists: both say dev.
  const JS_BUILD = (() => {
    try {
      return new URL(import.meta.url).searchParams.get('v') || 'dev';
    } catch {
      return 'dev';
    }
  })();
  const HTML_BUILD = typeof window.LC_BUILD_HTML === 'string' ? window.LC_BUILD_HTML : '';
  const STAMP_DEBUG = params.get('stamp') === 'on';
  const DOC_TITLE = document.title;

  /** One line, plain words: build, control mode (and why), quality. */
  function stampText() {
    const mode = TOUCH ? 'touch' : TOUCH_OVERRIDE === false ? 'mouse (?touch=off)' : 'mouse';
    const parts = [stampBit()];
    if (HTML_BUILD && HTML_BUILD !== JS_BUILD) parts.push('MISMATCH: html and js are different builds');
    parts.push(`mode ${mode}`, `quality ${SETTINGS.quality}`);
    return parts.join(' · ');
  }

  /** One stamp when the page and its JS agree, both when they do not — the
   *  stale-cache signature, spelled out. A page with no inline stamp (the slice,
   *  the tool pages) has nothing to compare against and reports its JS only. */
  function stampBit() {
    if (!HTML_BUILD || HTML_BUILD === JS_BUILD) return `build ${JS_BUILD}`;
    return `html ${HTML_BUILD} / js ${JS_BUILD}`;
  }

  /** Fills the start card, the gear panel, and (with ?stamp=on) the corner text
   *  the inline script already put up. Skipped under ?gate=off: that mode is for
   *  capturing frames, and a stamp is not part of the game's pixels. */
  function renderStamp() {
    if (GATE_OFF) return;
    const text = stampText();
    for (const id of ['build-stamp', 'settings-build']) {
      const node = document.getElementById(id);
      if (node) node.textContent = text;
    }
    let corner = document.getElementById('build-corner');
    if (!corner && STAMP_DEBUG) {
      corner = document.createElement('div');
      corner.id = 'build-corner';
      document.body.appendChild(corner);
    }
    if (!corner) return;
    corner.textContent = `${stampBit()} · ${TOUCH ? 'touch' : 'mouse'} · ${SETTINGS.quality}`;
    if (STAMP_DEBUG) document.title = `${DOC_TITLE} [js ${JS_BUILD}]`;
  }

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
  if (TOUCH) {
    // Phones keep a crisp-but-honest backing store: device pixels, capped hard
    // (SwiftShader-less phones are the market here). Desktop stays ratio 1 —
    // the capture contract's guarantee is untouched because captures never run
    // as a touch device.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, SETTINGS.quality === 'low' ? 1.5 : 2));
  }
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const BASE_EXPOSURE = 1.05; // the look's reference exposure; juice blinks ride it
  renderer.toneMappingExposure = BASE_EXPOSURE;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if (SETTINGS.quality === 'low') renderer.shadowMap.enabled = false; // weak-GPU path: no shadow pass

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14181f);

  const camera = new THREE.PerspectiveCamera(VIEWS['first-person'].fov, window.innerWidth / Math.max(1, window.innerHeight), 0.05, 40);
  camera.rotation.order = 'YXZ';
  scene.add(camera); // camera-parented hand needs its world matrix

  // ---------------------------------------------------------------------------
  // 2. The apartment, the cast, the celebration, the hand, the world
  // ---------------------------------------------------------------------------
  const apt = cfg.buildApartment(scene);
  const { living, supports } = apt;
  const { sun, WALL_Z } = living;

  const bobo = buildCat('bobo');
  const decoy = buildCat('decoy');
  // 22 lb vs 15 lb: the shared decoy spec lands at 1.246x Bobo's width; the
  // size-tell rule says a DAG! must read 1.25x wider AS BUILT, so the slice
  // lifts its own decoy's width a hair (src/cat.js stays zero-diff).
  const DECOY_LIFT = 1.32 / 1.3;
  decoy.root.scale.x *= DECOY_LIFT;
  scene.add(bobo.root, decoy.root);
  if (SETTINGS.quality === 'low') {
    // Weak-GPU path (?quality=low): the fuzz shells roughly double the cats'
    // triangles, the shadow map is a whole extra pass, confetti is decoration.
    // Materials, light and layout stay identical — the look never changes.
    for (const cat of [bobo, decoy])
      for (const pose of Object.values(cat.pivots)) for (const s of pose.shells ?? []) s.visible = false;
  }

  const { rainHeads, rainMuzzles, rainDashes, bursts, updateRain, updateFireworks } = createCelebration(scene);
  const confetti = createConfetti(scene); // Step 9 juice, win-only (src/juice.js)
  if (SETTINGS.quality === 'low') confetti.enabled = false; // weak GPU: skip the paper bits

  const hand = buildHand();
  const handRig = new THREE.Group();
  handRig.add(hand.root);
  camera.add(handRig);

  const world = createWorld({ rects: WALK_RECTS, colliders: COLLIDERS, radius: MOVE.playerRadius });
  const input = createInput({ canvas });
  // Issue #25 touch state (all inert on desktop: TOUCH is false there, so
  // touchCtl stays null and the listeners below are never installed).
  let touchCtl = null;
  let portraitMQ = null;
  let rotatePaused = false; // paused BY the portrait rotation (landscape resumes it)

  // ---------------------------------------------------------------------------
  // 3. The voice engine — the ONLY place audio fires is the play loop below.
  // ---------------------------------------------------------------------------
  const voices = createVoiceEngine({ resolve: (f) => `../${f}` });
  const planFor = (phase) => audioPlanFor(phase === 'find' ? 'idle' : phase, PLAN_OVERRIDES);
  let firedCues = new Set();
  /** Live aim-tell bookkeeping (step 7, ART_STYLE §8): a shout at nothing
   *  pulses the reticle (mustard) until this find-phase time. */
  const RETICLE_NUDGE = 0.6; // seconds
  let nudgeUntil = 0;

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
    wrongFlash: document.getElementById('wrong-flash'),
    ending: document.getElementById('ending'),
    veil: document.getElementById('ending-veil'),
    prompt: document.getElementById('prompt'),
    label: document.getElementById('moment-label'),
    boot: document.getElementById('boot-error'),
    loading: document.getElementById('loading'),
    gate: document.getElementById('gate'),
    gateBtn: document.getElementById('gate-btn'),
    pause: document.getElementById('pause'),
    hint: document.getElementById('hint'),
    // Optional Step 8 extras — present only on the full-game page:
    pauseRestart: document.getElementById('pause-restart'),
    endingAgain: document.getElementById('ending-again'),
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
    el.reticle.classList.remove('nudge'); // live aim-tells are per-phase; never bleed across
    if (el.dag.style.display !== (spec.dag ? 'block' : 'none')) el.dag.style.display = spec.dag ? 'block' : 'none';
    el.ending.classList.toggle('show', spec.ending);
    el.veil.classList.toggle('show', spec.ending);
    setText(el.ending, ENDING_TEXT);
    setText(el.dagLabel, EXACT_DAG);
    el.prompt.classList.toggle('show', spec.prompt && game.phase === 'find');
    if (el.endingAgain) el.endingAgain.classList.toggle('show', spec.ending); // full game: play-again line
    // Comfort (Step 9): calm mode hides the weather-layer celebration — rain,
    // fireworks, confetti — and the wrong-cat flash; the page keeps everything
    // gentle (the cats still breathe, the veil still fades in).
    const celebrate = !SETTINGS.reducedMotion && (game.phase === 'win' || game.phase === 'catch');
    for (const b of bursts) b.mesh.visible = celebrate;
    for (const m of [rainHeads, rainMuzzles, rainDashes]) m.visible = !SETTINGS.reducedMotion && game.phase === 'win';
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
    winElapsed: 0, // seconds since the win landed (survives the celebration loop)
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
    bobo.root.rotation.y = catRootYaw(moment.faceYaw); // see catRootYaw
    setCatPose(bobo, moment.pose);
    game.boboSupport = support;
  }
  function placeDecoyAt(spot) {
    const [x, support, z] = spot.pos;
    decoy.root.position.set(x, supports[support] ?? 0, z);
    decoy.root.rotation.y = catRootYaw(spot.faceYaw);
    setCatPose(decoy, spot.pose ?? 'sprawl'); // spots may ask for a lying pose (issue #27)
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
      if (game.phase === 'win') game.winElapsed = 0; // the restart cooldown starts here
      game.time = 0;
      firedCues = new Set();
      nudgeUntil = 0;
      applyStage();
    });
  }

  /** Circles for the player's push-out resolve, in the shape
   *  `world.resolve` wants (absolute clearance = MOVE.boboPush / decoyPush). */
  function catPushes() {
    return [
      { x: bobo.root.position.x, z: bobo.root.position.z, r: MOVE.boboPush - MOVE.playerRadius },
      { x: decoy.root.position.x, z: decoy.root.position.z, r: MOVE.decoyPush - MOVE.playerRadius },
    ];
  }

  /** The last line of defence at a respawn: never stand inside a cat. */
  function standClearOfCats() {
    const pos = { x: player.x, z: player.z };
    world.resolve(pos, catPushes());
    player.x = pos.x;
    player.z = pos.z;
  }

  /** After a catch: next moment, new decoy spot, respawn in a different room
   *  from Bobo's new spot AND from where we just were (issue #11). Step 7
   *  (issue #13): the spawn pick also avoids the living cats — pickSpawn
   *  won't choose a spawn standing in the 22 lb decoy (the hall spawn sat
   *  0.07 m from d-hall), and standClearOfCats is the backstop either way. */
  function afterCatch() {
    startLiveRound();
    const boboRoom = momentById(game.momentId).room;
    const avoid = [
      { x: bobo.root.position.x, z: bobo.root.position.z },
      { x: decoy.root.position.x, z: decoy.root.position.z },
    ];
    const { spawn, idx } = pickSpawn(boboRoom, game.prevSpawnRoom, game.spawnIdx, avoid);
    game.spawnIdx = idx;
    game.prevSpawnRoom = spawn.room;
    spawnPlayerAt(spawn);
    standClearOfCats();
    game.phase = 'find';
    game.time = 0;
    firedCues = new Set();
    nudgeUntil = 0;
    applyStage();
  }

  function restartRun() {
    rng = mulberry32(SEED + 991); // replays are still seeded runs, never Math.random
    refills = 0;
    queue = [];
    game.score = 0;
    game.phase = 'find';
    game.time = 0;
    game.winElapsed = 0;
    game.spawnIdx = 0;
    game.prevSpawnRoom = SPAWNS[0].room;
    firedCues = new Set();
    nudgeUntil = 0;
    startLiveRound();
    spawnPlayerAt(SPAWNS[0]);
    standClearOfCats();
    input.reset(); // no key or queued shout crosses a restart (Space-mashing included)
    applyStage();
  }

  // ---------------------------------------------------------------------------
  // 7. The frame: everything below is a pure function of the state above.
  // ---------------------------------------------------------------------------
  let seekTime = 0;

  /** Step 9 idle life: blink and an ear flick, both a pure function of the
   *  phase-relative t (never wall clock, never random), written EVERY frame
   *  so a seeked or staged pose depends only on (moment, t). The eye "groups"
   *  squash in Y — the flattened iris reads as a closed lid at this scale. */
  function faceLife(bp, t, off) {
    const eyes = bp.head.userData.eyes;
    if (eyes && eyes.length) {
      const P = 4.6;
      const p = (t + off) % P;
      const cyc = Math.floor((t + off) / P);
      const lid = (u) => (u >= 0 && u < 0.13 ? Math.sin((u / 0.13) * Math.PI) : 0);
      let b = lid(p);
      if (cyc % 3 === 2) b = Math.max(b, lid(p - 0.46)); // occasional double-blink
      const k = 1 - 0.88 * b;
      for (const e of eyes) e.scale.y = k;
    }
    const P2 = 5.7;
    const q = (t + off * 1.6) % P2;
    const u = q < 0.2 ? Math.sin((q / 0.2) * Math.PI) : 0;
    const side = Math.floor((t + off * 1.6) / P2) % 2 === 0 ? 1 : -1; // alternates ears
    for (const c of bp.head.children) {
      if (!c.userData || c.userData.tag !== 'ear') continue;
      const bx = c.userData.baseRotX ?? (c.userData.baseRotX = c.rotation.x);
      const bz = c.userData.baseRotZ ?? (c.userData.baseRotZ = c.rotation.z);
      const s = Math.sign(c.position.x) || 1;
      const on = s === side ? u : 0;
      c.rotation.z = bz + s * on * 0.2;
      c.rotation.x = bx - on * 0.12;
    }
  }

  function applyTime(t) {
    seekTime = t;
    // Bobo: the moment's own life — all procedural, all pure in t.
    const bp = bobo.pivots[bobo.current];
    if (bp) {
      const base = bp.body.userData.baseScale ?? (bp.body.userData.baseScale = bp.body.scale.clone());
      bp.tailPivot.rotation.y = Math.sin(t * 1.7) * 0.14;
      bp.tailPivot.rotation.x = Math.sin(t * 0.71 + 1.2) * 0.045; // slow secondary drift
      bp.head.rotation.y = Math.sin(t * 0.85 + 0.4) * 0.09;
      bp.head.rotation.x = bp.baseHeadX + Math.sin(t * 0.6) * 0.025;
      bp.head.rotation.z = bp.baseHeadZ + Math.sin(t * 0.47 + 2.1) * 0.02; // a cat never holds still
      const breathe = Math.sin(t * 1.9); // Step 9: the whole cat breathes
      // A rolled lying pose (side/back, issue #27) has its local x pointing
      // world-up — breathe the horizontal pair there so the contact never
      // rocks. Upright poses take the original path, byte for byte.
      const rolled = Math.abs(bp.body.rotation.z) > 0.5;
      bp.body.scale.set(
        rolled ? base.x : base.x * (1 + 0.016 * breathe),
        rolled ? base.y * (1 + 0.016 * breathe) : base.y * (1 + 0.009 * breathe),
        base.z * (1 + 0.012 * breathe),
      );
      bp.shells[0].scale.copy(bp.body.scale).multiplyScalar(1.045); // the fuzz rides along
      faceLife(bp, t, 0);
      // The moment's own set piece (the slice's if-chain lives in the boot
      // file now; the full game's ten + the pen ride the same slot).
      if (game.phase === 'find') {
        cfg.momentAnim({ bp, base, t, bobo, decoy, game, momentById, apt, supports, THREE, clamp, easeOutBack, easeOutCubic });
      }
    }
    // The decoy: a slow, heavy breath, sideways only (demo rule: never sinks).
    const dp = decoy.pivots[decoy.current];
    if (dp) {
      const base = dp.body.userData.baseScale ?? (dp.body.userData.baseScale = dp.body.scale.clone());
      const s = Math.sin(t * 1.1);
      // same rolled rule as Bobo's idle (issue #27): a lying side-pose decoy
      // must not sink 4 mm per breath
      const rolledD = Math.abs(dp.body.rotation.z) > 0.5;
      dp.body.scale.set(
        rolledD ? base.x : base.x * (1 + 0.03 * s),
        rolledD ? base.y * (1 + 0.03 * s) : base.y,
        base.z * (1 + 0.022 * s),
      );
      dp.shells[0].scale.copy(dp.body.scale).multiplyScalar(1.045);
      dp.tailPivot.rotation.y = Math.sin(t * 0.9 + 2) * 0.07; // a lazy heavy sway
      dp.tailPivot.rotation.x = Math.sin(t * 0.41) * 0.03;
      faceLife(dp, t, 1.7); // out of sync with Bobo — two animals, one clock
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
    juiceFrame({ phase: game.phase, t, renderer, els: { score: el.score, wrongFlash: el.wrongFlash }, confetti, baseExposure: BASE_EXPOSURE, calm: SETTINGS.reducedMotion });
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
    if (name === LIVE_VIEW) {
      // The live view has no fixed pose — it IS the player (step 7). Capture
      // views never take this branch, so captured frames stay pose-pure.
      applyCameraFromPlayer();
      updateHandVisibility();
      return;
    }
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
    player.yaw -= look.dx * MOVE.sensitivity * SETTINGS.sens;
    // Comfort: ?invertY=1 flips pitch only (yaw stays natural); ?sens scales both.
    player.pitch = clamp(
      player.pitch + (SETTINGS.invertY ? 1 : -1) * look.dy * MOVE.sensitivity * SETTINGS.sens,
      -MOVE.pitchLimit,
      MOVE.pitchLimit,
    );

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
        world.resolve(pos, catPushes());
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

  /** What the centre ray is really on: 'cat-bobo' | 'cat-decoy' | null.
   *  One helper for the shout AND the live aim-tell, so what the reticle
   *  promises is exactly what the shout does. */
  function catUnderCrosshair() {
    camera.updateMatrixWorld();
    raycaster.setFromCamera(CENTER, camera);
    for (const hit of raycaster.intersectObjects([bobo.root, decoy.root], true)) {
      if (!hit.object.isMesh) continue;
      let o = hit.object;
      while (o && !(o.name ?? '').startsWith('cat-')) o = o.parent;
      if (o) return o.name;
    }
    return null;
  }

  function aimShout() {
    if (!started || game.paused || game.phase !== 'find') return;
    const cat = catUnderCrosshair();
    if (cat) {
      triggerEvent(cat === 'cat-bobo' ? 'catch' : 'wrong');
      return;
    }
    // Input is never silent (issue #13): a shout at nothing shrugs back with a
    // mustard nudge on the reticle instead of doing nothing at all.
    nudgeUntil = game.time + RETICLE_NUDGE;
  }

  /** ART_STYLE §8 live: the calm dot softens to coral while aimed at the
   *  decoy — "is that…?" — and carries the nudge pulse after a shout at
   *  nothing. Live view only: captured frames stage the HUD from HUD_SPEC,
   *  untouched (the wrong-phase soft stay the spec's own). */
  function updateAimTell() {
    el.reticle.classList.toggle('soft', catUnderCrosshair() === 'cat-decoy');
    el.reticle.classList.toggle('nudge', game.time < nudgeUntil);
  }

  // ---------------------------------------------------------------------------
  // 10. The live loop — the only place time advances and audio fires
  // ---------------------------------------------------------------------------
  /** Step 8: the first-time hint fades out once, on the LIVE find-phase
   *  clock. Staged/captured frames never tick it (staging doesn't run this
   *  loop), so captures stay byte-identical; the fade uses quiet setStyle
   *  writes only, no CSS animation (the demo's composite-stability lesson). */
  let hintT = 0;
  let hintDone = !cfg.hintFade;

  function stepGame(dt) {
    for (const action of input.consumeActions()) {
      // A "pause" out of src/input.js always means the same thing: the pointer
      // went away (Esc, a window blur, or the issue #29 switch that hands the
      // page to a finger). A page steered by thumbs has no pointer to lose, so
      // there it is a stale request, not the player asking for a break — the
      // phone keeps its own real pauses (portrait rotate, hidden tab).
      if (action === 'pause' && !TOUCH && started && game.phase !== 'win') game.paused = true;
      if (action === 'point') aimShout();
    }
    el.pause.classList.toggle('show', game.paused);
    if (game.paused) return;

    if (game.phase === 'find') stepPlayer(dt);
    if (game.phase === 'win') game.winElapsed += dt;
    game.time += dt;

    if (!hintDone && cfg.hintFade && started && game.phase === 'find') {
      hintT = Math.min(60, hintT + dt);
      const { fadeStart, fadeEnd } = cfg.hintFade;
      const op = hintT <= fadeStart ? 1 : hintT >= fadeEnd ? 0 : 1 - (hintT - fadeStart) / (fadeEnd - fadeStart);
      setStyle(el.hint, 'opacity', op.toFixed(3));
      if (op === 0) {
        hintDone = true;
        setStyle(el.hint, 'display', 'none');
      }
    }

    if (game.phase === 'catch' && game.time >= CATCH_END) afterCatch();
    else if (game.phase === 'wrong' && game.time >= WRONG_END) {
      game.phase = 'find'; // the moment is NOT consumed by a DAG! (Q6)
      game.time = 0;
      firedCues = new Set();
      nudgeUntil = 0;
      applyStage();
    } else if (game.phase === 'win' && game.time >= DURATION) {
      game.time -= DURATION; // the celebration loops; the score stays frozen
      // The win LINE does not loop with it (issue #13): firedCues used to
      // reset here, so the voice line replayed every 6 s. Once per win.
    }

    const prev = game.time - dt;
    advanceCues(prev, game.time);
  }

  /** Fixed-step simulation from real frame deltas (issue #13 — the loop must
   *  survive frame-time spikes and background-tab throttling). Each rendered
   *  frame drains as many 1/60 steps as the elapsed wall time earned, capped
   *  so a tab returning after 30 s cannot fast-forward through events: the
   *  clamped step keeps physics sane and simply drops lost time, the way the
   *  render path drops frames. */
  const FIXED_DT = 1 / 60; // the simulation step — every rule above is written in it
  const MAX_FRAME_DT = 0.25; // seconds of catch-up per frame (15 sim steps)
  const MAX_STEPS = 16; // hard cap on sim steps per rendered frame
  let accumulator = 0;
  let lastStamp = null;
  const loopStats = { frames: 0, clamped: 0, maxSteps: 0, lastSteps: 0, maxDelta: 0, simSteps: 0 };

  /** Run one frame's worth of simulation for a delta (seconds). Exported
   *  through LC.loopTick so a headless test can drive the loop at any
   *  simulated frame rate without a real rAF clock. */
  function tickLoop(deltaSeconds) {
    let delta = Number(deltaSeconds);
    if (!Number.isFinite(delta) || delta < 0) delta = 0;
    if (delta > loopStats.maxDelta) loopStats.maxDelta = delta;
    if (delta > MAX_FRAME_DT) {
      delta = MAX_FRAME_DT;
      loopStats.clamped++;
    }
    accumulator += delta;
    let steps = 0;
    while (accumulator >= FIXED_DT && steps < MAX_STEPS) {
      stepGame(FIXED_DT);
      accumulator -= FIXED_DT;
      steps++;
    }
    if (steps === MAX_STEPS) accumulator = Math.min(accumulator, FIXED_DT); // drop the rest, never spiral
    loopStats.frames++;
    loopStats.lastSteps = steps;
    loopStats.simSteps += steps;
    if (steps > loopStats.maxSteps) loopStats.maxSteps = steps;
    return steps;
  }

  function frame(stampMs) {
    const dt = lastStamp === null ? FIXED_DT : (stampMs - lastStamp) / 1000;
    lastStamp = stampMs;
    tickLoop(dt);
    applyTime(game.time);
    if (started && !game.paused && viewName === 'player-camera') {
      applyCameraFromPlayer();
      if (game.phase === 'find') updateAimTell();
    }
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
        `${rainHeads.visible ? 'rain' : SETTINGS.reducedMotion ? 'calm' : 'no-rain'}/${getComputedStyle(el.ending).display !== 'none' ? 'text' : 'no-text'}`,
        'rain/text',
        (rainHeads.visible || SETTINGS.reducedMotion) && getComputedStyle(el.ending).display !== 'none',
        SETTINGS.reducedMotion ? 'calm mode: rain hidden on purpose, the exact line still shows' : 'the win shows the rain of Bobos AND the exact line, live',
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
      const L = MOMENT_IDS.length;
      for (let i = 0; i < L * 3; i++) seen.push(nextMomentId());
      for (let c = 0; c < 3; c++) {
        const cycle = new Set(seen.slice(c * L, c * L + L));
        if (cycle.size !== L) repeatsOk = false;
      }
      queue = savedQ;
      refills = savedR;
    }
    add('queue-no-repeats', repeatsOk ? `${MOMENT_IDS.length} distinct per cycle` : 'repeat inside a cycle', 'no repeats within a cycle', repeatsOk, 'shuffled cycle, reshuffle when exhausted');

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

    // --- measurement kit for the three issue #27 checks (bugs 2, 3, 4) ------
    // Everything below measures the level as BUILT: the plaster slabs come
    // from the apartment builders (apt.wallBoxes), the cats' own furniture is
    // excluded from their sight lines, and the grid is made of cells a 0.30 m
    // body fits in. Nothing here re-types a coordinate.
    const wallBoxes = apt.wallBoxes || [];
    const LOS_TOP = 1.05; // furniture hides a cat up to about waist height
    const losBoxes = [
      ...wallBoxes,
      ...COLLIDERS.map((c) => ({ id: c.id, x0: c.x0, x1: c.x1, z0: c.z0, z1: c.z1, y0: 0, y1: LOS_TOP })),
    ];
    // One shared vantage map for the sight-line and face checks: the cells a run
    // can actually stand on. Deriving it per cat (nearest-standable + a flood) is
    // both 38 floods a frame and wrong for a cat tucked into an alcove, because
    // the nearest-standable spiral grows on Chebyshev rings and can cross a wall
    // into another room — a bathroom cat got the living room's approach cells.
    const reachShared = bodyGrid.flood(bodyGrid.cellAt(SPAWNS[0].pos[0], SPAWNS[0].pos[1]));
    const catSpots = [
      ...MOMENTS.map((m) => ({
        id: m.id,
        kind: 'Bobo',
        x: m.spot[0],
        z: m.spot[2],
        y: supports[m.spot[1]] ?? 0,
        yaw: m.faceYaw,
        pose: m.pose,
      })),
      ...DECOY_SPOTS.map((d) => ({
        id: d.id,
        kind: 'decoy',
        x: d.pos[0],
        z: d.pos[2],
        y: supports[d.pos[1]] ?? 0,
        yaw: d.faceYaw,
        pose: d.pose ?? 'sprawl', // a decoy spot may lie down too (issue #27)
      })),
    ];
    const bodyGrid = buildGrid({ rects: WALK_RECTS, colliders: COLLIDERS, radius: MOVE.playerRadius });
    // NB a spawn's pos is [x, z] (two numbers); a moment spot is [x, support, z].

    // --- issue #27 (bug 3): seeing through walls.
    // Plaster is opaque and single-sided; the only way to look through it from
    // inside the flat is to get the camera within `camera.near` of a face, so
    // the near plane cuts the face away and you see the next room through the
    // hole. Furniture cannot do that — it is all COLLIDERS, and the push-out
    // keeps a body a whole radius out. Walls are not colliders: the walk rects
    // ARE the walls, so the gap they leave is the entire defence, and until
    // now they sat 0.02 m off a wall face with a 0.05 m near plane.
    {
      const { fails, worst, worstCase } = wallFaceFailures(WALK_RECTS, wallBoxes, { near: camera.near, eye: MOVE.eye });
      add(
        'wall-camera-clearance',
        fails.length ? `${fails.length} hole(s): ${fails.slice(0, 2).join('; ')}` : `${worst.toFixed(2)} m at ${worstCase}`,
        `closest camera to plaster > near (${camera.near}) + 2 cm`,
        wallBoxes.length > 0 && fails.length === 0,
        'measured off the slabs that were actually built; a doorway rect crosses its own wall band on purpose',
      );
    }

    // --- issue #27 (bug 2): the bathroom you could walk into and never leave.
    // `walk-rects-connected` above walks a POINT from rect corner to rect
    // corner, so it never noticed that a 0.30 m BODY cannot go where a point
    // can: the toilet's push pad lay across the bathroom's only doorway, and
    // the vanity's pad cut the room in half. This floods a grid of body-sized
    // cells — every cell a player can actually stand in — from each spawn, and
    // asks what the game depends on: can a player who woke up ANYWHERE get to
    // every room, every other spawn, and a place to STAND AND SEE every cat?
    {
      const rooms = [...new Set(WALK_RECTS.map((r) => r.room))];
      const bad = [];
      for (const s of SPAWNS) {
        const start = bodyGrid.cellAt(s.pos[0], s.pos[1]);
        if (start < 0 || !bodyGrid.free[start]) {
          bad.push(`spawn ${s.room}@${s.pos} is not standable`);
          continue;
        }
        const seen = bodyGrid.flood(start);
        const here = new Set();
        for (let i = 0; i < seen.length; i++) if (seen[i] && bodyGrid.owner[i] >= 0) here.add(WALK_RECTS[bodyGrid.owner[i]].room);
        for (const r of rooms) if (!here.has(r)) bad.push(`${s.room} cannot reach ${r}`);
        for (const o of SPAWNS) {
          const c = nearestStandable(bodyGrid, o.pos[0], o.pos[1]);
          if (!seen[c.idx]) bad.push(`${s.room} cannot reach the ${o.room} spawn`);
        }
        // Every cat must be findable from here: a standable cell 0.9–3.4 m
        // away (aimAt's own range) with an eye-high line to the cat's body.
        for (const sp of catSpots) {
          if (!bestApproach(bodyGrid, seen, { x: sp.x, z: sp.z, y: sp.y, los: losBoxes, eye: MOVE.eye })) {
            bad.push(`${s.room} cannot see ${sp.id}`);
          }
        }
      }
      add(
        'walk-reachable',
        bad.length ? bad.slice(0, 3).join(', ') : `${SPAWNS.length} spawns → ${rooms.length} rooms, ${catSpots.length} cats in sight`,
        'a body (r 0.30), not a point: every spawn reaches every room, spawn and cat',
        bad.length === 0,
        'furniture push pads subtracted — the trap in issue #27 was invisible to a point walk',
      );
    }

    // --- issue #27 (bug 4): a cat facing a wall reads as a prop, not a pet.
    // The front of the rig is measured, not assumed: head minus tail pivot,
    // in world space, on a real cat turned to the declared faceYaw. It must be
    // within 90° of the direction of the nearest place a player can stand and
    // see it — Bobo looks out at the room, never at plaster.
    {
      const probes = { Bobo: buildCat('bobo'), decoy: buildCat('decoy') };
      const bad = [];
      const rendered = [];
      const vTmp = new THREE.Vector3();
      const tTmp = new THREE.Vector3();
      for (const sp of catSpots) {
        // Approach area = the body-sized cells a run can stand on, from the
        // shared map above. `walk-reachable` is the check that says a player can
        // GET there; here the question is only which way the cat is pointing
        // relative to the players it can plausibly have.
        const a = bestApproach(bodyGrid, reachShared, { x: sp.x, z: sp.z, y: sp.y, los: losBoxes, eye: MOVE.eye });
        if (!a) {
          bad.push(`${sp.id}: no standable sight line`);
          continue;
        }
        const probe = probes[sp.kind];
        // Reset to a pose both rigs have, so a spot asking for a pose its cat
        // does not build (a lying spot on a cat without that pose) measures
        // the same way in any iteration order — as what it renders.
        setCatPose(probe, 'sit');
        setCatPose(probe, sp.pose);
        if (probe.current !== sp.pose) rendered.push(`${sp.id}→${probe.current}`);
        probe.root.position.set(sp.x, sp.y, sp.z);
        probe.root.rotation.y = catRootYaw(sp.yaw);
        probe.root.updateMatrixWorld(true);
        const pv = probe.pivots[probe.current];
        pv.head.getWorldPosition(vTmp);
        pv.tailPivot.getWorldPosition(tTmp);
        const fx = vTmp.x - tTmp.x;
        const fz = vTmp.z - tTmp.z;
        const fl = Math.hypot(fx, fz) || 1;
        // (a.dx, a.dz) points from the cat to its vantage; the face must be
        // turned toward it, so the front·cat→vantage dot is the test.
        const dot = (fx * a.dx + fz * a.dz) / (fl * a.dist);
        const deg = (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;
        if (deg > 90) bad.push(`${sp.id} ${deg.toFixed(0)}° off its approach`);
      }
      add(
        'cats-face-the-room',
        bad.length
          ? bad.slice(0, 3).join(', ')
          : `${catSpots.length}/${catSpots.length} face an approach${rendered.length ? ` (${rendered.join(', ')} render as built)` : ''}`,
        'front within 90° of the nearest place a player can stand and see them',
        bad.length === 0,
        'head−tail of the rendered rig, measured, not the yaw number',
      );
    }

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

    // --- step 7 (issue #13): never wake up inside a cat, never inside furniture.
    // Every legal (moment × decoy × prev-room × cycle) respawn combination,
    // through the REAL pickSpawn (cat-avoiding) and the REAL world.resolve the
    // game runs at spawn — measuring where the player ACTUALLY ends up standing.
    let wakeOk = true;
    let wakeWorst = Infinity;
    let wakeCase = null;
    for (const m of MOMENTS) {
      for (const d of DECOY_SPOTS) {
        if (Math.hypot(d.pos[0] - m.spot[0], d.pos[2] - m.spot[2]) < DECOY_MIN_DIST) continue; // that pair never coexists
        for (const prev of ['living', 'hall', 'bedroom']) {
          for (let fromIdx = 0; fromIdx < SPAWNS.length; fromIdx++) {
            const { spawn } = pickSpawn(m.room, prev, fromIdx, [
              { x: m.spot[0], z: m.spot[2] },
              { x: d.pos[0], z: d.pos[2] },
            ]);
            const pos = { x: spawn.pos[0], z: spawn.pos[1] };
            world.resolve(pos, [
              { x: m.spot[0], z: m.spot[2], r: MOVE.boboPush - MOVE.playerRadius },
              { x: d.pos[0], z: d.pos[2], r: MOVE.decoyPush - MOVE.playerRadius },
            ]);
            const margin = Math.min(
              Math.hypot(pos.x - m.spot[0], pos.z - m.spot[2]) - MOVE.boboPush,
              Math.hypot(pos.x - d.pos[0], pos.z - d.pos[2]) - MOVE.decoyPush,
            );
            if (margin < wakeWorst) {
              wakeWorst = margin;
              wakeCase = `${m.id}+${d.id} from ${prev}, cycle ${fromIdx} → ${spawn.room}`;
            }
            if (margin < -1e-9 || !world.inside(pos.x, pos.z)) wakeOk = false;
          }
        }
      }
    }
    add(
      'respawn-clear-of-cats',
      wakeOk ? `every respawn lands outside both cats (tightest ${wakeWorst.toFixed(2)} m past the push edge: ${wakeCase})` : `lands inside a cat: ${wakeCase}`,
      '≥ push radius (0.46/0.50 m) and on the floor after resolve',
      wakeOk,
      'pickSpawn avoids cat-side spawns, world.resolve is the backstop (issue #13: the hall spawn sat 0.07 m from d-hall)',
    );

    let padOk = true;
    let padWorst = Infinity;
    let padCase = null;
    for (const s of SPAWNS) {
      for (const box of COLLIDERS) {
        const dx = Math.max(box.x0 - s.pos[0], 0, s.pos[0] - box.x1);
        const dz = Math.max(box.z0 - s.pos[1], 0, s.pos[1] - box.z1);
        const dist = Math.hypot(dx, dz);
        if (dist < padWorst) {
          padWorst = dist;
          padCase = `${s.room}@(${s.pos[0]},${s.pos[1]}) ↔ ${box.id}`;
        }
        if (dist < MOVE.playerRadius) padOk = false;
      }
    }
    add(
      'spawn-clearance',
      padOk ? `every spawn ≥ player radius clear of furniture (tightest ${padWorst.toFixed(2)} m: ${padCase})` : `overlaps furniture: ${padCase}`,
      `≥ ${MOVE.playerRadius} m from every collider`,
      padOk,
      'you never materialise standing in the lamp (issue #13: the living spawn moved off floor-lamp)',
    );

    // --- the cast reads right (Step 3 tells hold here) ------------------------
    const bb = scanMarkings(bobo, bobo.current);
    const dd = scanMarkings(decoy, decoy.current);
    add(
      'cats-distinguishable',
      `Bobo dash ${bb.dash} + bib ${bb.bib} + head white ${bb.headWhite} · decoy dash ${dd.dash}, bib ${dd.bib}, neck ${dd.neckWhite}, head ${dd.headWhite} · white feet ${bb.feet}/${dd.feet}`,
      'dash + bib + white head markings on Bobo only; decoy black except his feet',
      bb.dash > 0 &&
        bb.bib > 0 &&
        bb.headWhite > 0 &&
        bb.neckWhite === 0 &&
        dd.dash === 0 &&
        dd.bib === 0 &&
        dd.neckWhite === 0 &&
        dd.headWhite === 0 &&
        bb.feet > 0 &&
        dd.feet > 0,
      'the whole game is "is it Bobo?" at a glance (issue #34: the decoy keeps white on his feet only)',
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
      GATE_OFF || gateOpen ? 'hidden/open' : 'shown/locked',
      gateOpen ? gateHidden : !gateHidden,
      // (hidden,open) once unlocked — by ?gate=off OR by a real click; shown/locked before
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
    const fwWant = SETTINGS.reducedMotion ? 'false/false/false/false' : 'false/true/false/true';
    add('fireworks-on-catch-and-win', fireworks.join('/'), fwWant, fireworks.join('/') === fwWant, SETTINGS.reducedMotion ? 'calm mode: fireworks hidden on purpose, all phases' : 'a catch earns a pop; the rain is only the win');

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

    // Step 9 comfort: the URL is the source of truth, so the check that
    // generalises is the wiring — parsed state must agree with the URL params
    // and the body class on ANY url (defaults included).
    {
      const p = new URLSearchParams(location.search);
      const wantHc = p.get('contrast') === 'high';
      const sensParam = Number.parseFloat(p.get('sens') ?? '');
      const sensOk = Number.isFinite(sensParam) ? SETTINGS.sens === clamp(sensParam, 0.2, 3) : SETTINGS.sens === 1;
      const wantCalm = p.get('motion') === 'off' || (p.get('motion') !== 'full' && OS_REDUCE);
      add(
        'comfort-settings-wired',
        `sens ${SETTINGS.sens} · invertY ${SETTINGS.invertY ? 'on' : 'off'} · motion ${SETTINGS.reducedMotion ? 'calm' : 'full'} · contrast ${SETTINGS.highContrast ? 'high' : 'std'} · vol ${SETTINGS.volume}${SETTINGS.muted ? ' muted' : ''} · q ${SETTINGS.quality}`,
        'url params honoured, body class agrees',
        sensOk &&
          SETTINGS.invertY === (p.get('invertY') === '1') &&
          SETTINGS.reducedMotion === wantCalm &&
          SETTINGS.highContrast === wantHc &&
          document.body.classList.contains('hc') === wantHc &&
          SETTINGS.muted === (p.get('mute') === '1') &&
          // Issue #25: quality resolves low|high over the phone default — the
          // check re-derives the same rule, so it holds on ANY device.
          SETTINGS.quality === (p.get('quality') === 'low' ? 'low' : p.get('quality') === 'high' ? 'full' : AUTO_LOW ? 'low' : 'full') &&
          document.documentElement.classList.contains('touch') === TOUCH,
        'comfort settings parse from the url (calm follows prefers-reduced-motion unless overridden) and drive the page',
      );
    }

    // Step 8: the full game appends its own checks (moment count, every
    // moment's contact band, room coverage). The slice adds none.
    if (cfg.extraChecks) {
      cfg.extraChecks({ add, THREE, scene, supports, buildCat, setCatPose, contactGap, MOMENTS, MOMENT_IDS, DECOY_SPOTS, SPAWNS, wallBoxes: apt.wallBoxes ?? [] });
    }

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
        if (name !== LIVE_VIEW && !VIEWS[name]) throw new Error(`Unknown view "${name}". Declared: ${Object.keys(VIEWS).join(', ')}`);
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
        lastStamp = null; // time spent paused is never game time
        accumulator = 0;
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
      /** Comfort settings in force (Step 9): the parsed url params, for tools. */
      comfort: () => ({ ...SETTINGS }),

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
      /** Test helper (audio slice-check, step 7 bot): stand the player on
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
      /** Step 7 stress hooks: where the cast and the player actually stand
       *  (legality proofs run against the live scene, not a re-derivation),
       *  and what the centre ray is currently on. */
      catsDebug() {
        return {
          bobo: bobo.root.position.toArray().map(round),
          decoy: decoy.root.position.toArray().map(round),
          boboPush: MOVE.boboPush,
          decoyPush: MOVE.decoyPush,
          px: round(player.x),
          pz: round(player.z),
        };
      },
      aimProbe() {
        return catUnderCrosshair() ?? 'nothing';
      },
      /** Issue #27: the geometry as BUILT — the plaster slabs the apartment
       *  builders made, the walk rects, the furniture push boxes, and the
       *  camera numbers that decide what a player can see through. Harnesses
       *  and the node probes measure these instead of re-typing coordinates
       *  (the mistake that let the bathroom trap and the wall holes ship). */
      geometryDebug() {
        return {
          walls: (apt.wallBoxes ?? []).map((w) => ({ ...w })),
          rects: WALK_RECTS.map((r) => ({ ...r })),
          colliders: COLLIDERS.map((c) => ({ ...c })),
          near: camera.near,
          eye: MOVE.eye,
          radius: MOVE.playerRadius,
          supports: { ...supports },
        };
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
      /** Step 7 stress hooks (issue #13; docs/CAPTURE.md extensions). One
       *  loopTick(dt) = one rendered frame that took `dt` seconds: the same
       *  clamped, fixed-step pipeline the rAF clock drives, minus the draw.
       *  Rate-independence proof: 1 s of wall time at any frame rate earns
       *  +1.000 s of game time; a spike earns at most MAX_FRAME_DT. */
      loopTick(dt = FIXED_DT) {
        return tickLoop(dt);
      },
      /** The loop's own telemetry, including where the REAL camera sits —
       *  `camera('player-camera')` reports the player's state; this reports
       *  the object the frame actually rendered from (camera-follow proof). */
      loopDebug() {
        return {
          ...loopStats,
          fixedDt: FIXED_DT,
          maxFrameDt: MAX_FRAME_DT,
          stepCap: MAX_STEPS,
          accumulator: round(accumulator),
          playing: game.playing,
          paused: game.paused,
          phase: game.phase,
          time: round(game.time),
          winElapsed: round(game.winElapsed),
          camPos: camera.position.toArray().map(round),
          camYaw: round(camera.rotation.y),
          camPitch: round(camera.rotation.x),
        };
      },
      loopDebugReset() {
        for (const k of Object.keys(loopStats)) loopStats[k] = 0;
        accumulator = 0;
      },
      /** Issue #25 (docs/CAPTURE.md extensions): what touch mode the page
       *  booted in and what the controller is doing right now. Pure reads —
       *  never affects a normal game. */
      touchDebug() {
        return {
          active: TOUCH,
          autoLow: AUTO_LOW,
          controls: touchCtl ? touchCtl.debug() : null,
          virtual: input.virtualState(),
        };
      },
      /** The GPU posture actually in force: quality + the real backing store. */
      gpuDebug() {
        return {
          quality: SETTINGS.quality,
          pixelRatio: renderer.getPixelRatio(),
          devicePixelRatio: window.devicePixelRatio || 1,
          shadows: renderer.shadowMap.enabled,
          confetti: confetti.enabled,
          canvasW: renderer.domElement.width,
          canvasH: renderer.domElement.height,
          touch: TOUCH,
        };
      },
      /** Issue #29 (docs/CAPTURE.md extensions): the build this JS came from —
       *  the `?v=` the build put on this module's own URL, 'dev' in the source
       *  tree. Compare with window.LC_BUILD_HTML (the page's inline stamp): a
       *  mismatch means the browser mixed two builds. Pure read. */
      buildStamp() {
        return JS_BUILD;
      },
      /** Everything the stamp line is made of, for a headless check to assert. */
      buildInfo() {
        return {
          js: JS_BUILD,
          html: HTML_BUILD,
          match: HTML_BUILD === JS_BUILD,
          touch: TOUCH,
          touchOverride: TOUCH_OVERRIDE,
          autoLow: AUTO_LOW,
          quality: SETTINGS.quality,
          stampDebug: STAMP_DEBUG,
          text: stampText(),
        };
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
  /** Issue #25: on a phone, the same tap that unlocks audio also asks for
   *  fullscreen and landscape — both best-effort: Android Chrome grants
   *  them, iOS Safari has no Fullscreen API for pages (its element call is
   *  video-only), so there the game plays perfectly well inside the browser
   *  chrome (docs/DEPLOY.md "Testing on a phone"). */
  function requestTouchFullscreen() {
    try {
      const root = document.documentElement;
      if (typeof root.requestFullscreen === 'function') {
        const p = root.requestFullscreen({ navigationUI: 'hide' });
        p?.catch?.(() => {});
      }
    } catch {
      /* denied / no gesture / iOS: play windowed */
    }
    try {
      screen.orientation?.lock?.('landscape')?.catch?.(() => {});
    } catch {
      /* iOS again: no orientation lock — the rotate hint carries the message */
    }
  }

  function unlockGate() {
    if (gateOpen) return;
    gateOpen = true;
    voices.unlock(); // inside the user gesture (autoplay rules)
    if (TOUCH) requestTouchFullscreen(); // also inside the gesture (issue #25)
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
    standClearOfCats();
    applyStage();
    game.view = LIVE_VIEW; // the live camera follows the player now —
    applyView(LIVE_VIEW); // step 7: this used to skip viewName, so the camera never actually moved
    input.reset(); // nothing held (or queued before the start) steers the new run
    if (TOUCH) {
      // No pointer lock on touch (issue #25): the drag zones ARE the pointer.
      // A phone that started upright waits behind the rotate hint instead.
      if (portraitMQ?.matches) {
        game.paused = true;
        rotatePaused = true;
      }
    } else input.lock();
    window.LC?.play();
  }

  /** Seconds of celebration that must be seen before Space/click may skip
   *  the win (issue #13: a Space-mashing player used to clear the whole
   *  screen mid-keydown before the win line ever landed). */
  const WIN_RESTART_AFTER = 0.6;

  function tryRestartFromWin() {
    if (game.winElapsed >= WIN_RESTART_AFTER) restartRun();
  }

  function resumePlay() {
    game.paused = false;
    rotatePaused = false; // a deliberate resume outranks the rotate-pause too
    el.pause.classList.remove('show');
  }

  function wireInput() {
    el.gate.addEventListener('click', unlockGate);
    el.pause.addEventListener('click', () => {
      if (game.phase === 'win') return;
      // Resume paths by situation: still holding the pointer (a blur paused
      // us — Alt-Tab keeps the lock) or no lock semantics at all (headless
      // ?gate=off, or touch — issue #25: nothing to grab, tapping IS asking)
      // → resume directly; otherwise resuming IS re-grabbing the pointer,
      // and the lock-change event clears the pause.
      if (GATE_OFF || input.isLocked() || TOUCH) resumePlay();
      else input.lock();
    });
    // Step 8 (full game): the pause card also carries a restart button.
    if (el.pauseRestart) {
      el.pauseRestart.addEventListener('click', (ev) => {
        ev.stopPropagation();
        restartRun();
        if (GATE_OFF || input.isLocked() || TOUCH) resumePlay();
        else input.lock(); // the lock-change event clears the pause
      });
    }
    input.onLockChange((locked) => {
      if (locked) resumePlay();
      // Losing the pointer pauses — unless the page has switched to touch
      // (issue #29): the pointer we just dropped was the mistake, not the game.
      // `enableTouchMode` unlocks in exactly that case.
      else if (started && game.phase !== 'win' && !GATE_OFF && !TOUCH) game.paused = true;
      el.pause.classList.toggle('show', game.paused);
    });
    input.onLockError(() => {
      // Chrome refuses an instant re-lock after Esc (and headless never
      // grants one): never silently eat the click, keep the card up.
      el.pause.classList.toggle('show', game.paused && started && game.phase !== 'win');
    });
    canvas.addEventListener('click', () => {
      if (!gateOpen) return;
      if (TOUCH) return; // issue #25: no pointer lock to grab — the drag zones
      // and the shout button own the screen on touch devices
      if (game.phase === 'win') {
        tryRestartFromWin();
        return;
      }
      if (input.isLocked()) input.queueAction('point');
      else input.lock();
    });
    window.addEventListener('keydown', (ev) => {
      // Comfort panel is open: keys belong to the panel, never to the game.
      if (window.__lcSettingsOpen) return;
      if (ev.code === 'Space' && gateOpen && !ev.repeat) {
        ev.preventDefault();
        if (game.phase === 'win') tryRestartFromWin();
        else input.queueAction('point');
      }
    });
    // Step 9 comfort panel: the settings live in the URL, so a choice persists
    // across refresh, shares as a link, and re-applies in one obvious way.
    // Guarded: only pages that ship the panel (game/full.html) get wired.
    const sBtn = document.getElementById('settings-btn');
    const sPanel = document.getElementById('settings-panel');
    if (sBtn && sPanel) {
      sBtn.classList.add('show');
      const syncOpen = () => {
        window.__lcSettingsOpen = sPanel.classList.contains('show');
      };
      sBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        sPanel.classList.toggle('show');
        syncOpen();
      });
      sPanel.addEventListener('click', (ev) => ev.stopPropagation());
      const q = (id) => sPanel.querySelector(id);
      q('#set-sens').value = String(SETTINGS.sens);
      q('#set-volume').value = String(SETTINGS.volume);
      q('#set-invertY').checked = SETTINGS.invertY;
      q('#set-motion').checked = SETTINGS.reducedMotion;
      q('#set-mute').checked = SETTINGS.muted;
      q('#set-contrast').checked = SETTINGS.highContrast;
      const apply = () => {
        const p = new URLSearchParams(location.search);
        const setOr = (k, v, on) => (on ? p.set(k, v) : p.delete(k));
        const sens = Number(q('#set-sens').value);
        const vol = Number(q('#set-volume').value);
        setOr('sens', String(sens), sens !== 1);
        setOr('invertY', '1', q('#set-invertY').checked);
        if (q('#set-motion').checked) p.set('motion', 'off');
        else if (OS_REDUCE) p.set('motion', 'full'); // explicit override of the OS preference
        else p.delete('motion');
        setOr('mute', '1', q('#set-mute').checked);
        setOr('volume', String(vol), vol !== 1);
        setOr('contrast', 'high', q('#set-contrast').checked);
        location.search = p.toString(); // reload: every setting is a URL param
      };
      for (const c of sPanel.querySelectorAll('input')) c.addEventListener('change', apply);
      const sClose = q('#settings-close');
      if (sClose)
        sClose.addEventListener('click', () => {
          sPanel.classList.remove('show');
          syncOpen();
        });
    }
  }

  // ---------------------------------------------------------------------------
  // 13b. Touch mode (issue #25) — installed ONLY on a touch device (or
  // ?touch=on). On every desktop and every capture run this function returns
  // at once and the page is behaviourally byte-identical to before.
  // ---------------------------------------------------------------------------
  function initTouchUI() {
    if (!TOUCH) return;
    document.documentElement.classList.add('touch');
    document.body.classList.add('touch');
    touchCtl = createTouchControls({
      baseEl: document.getElementById('stick-base'),
      knobEl: document.getElementById('stick-knob'),
      shoutEl: document.getElementById('shout-btn'),
      onStick: (a) => {
        input.setVirtual('forward', a.fwd > 0);
        input.setVirtual('back', a.fwd < 0);
        input.setVirtual('left', a.strafe < 0);
        input.setVirtual('right', a.strafe > 0);
        input.setVirtual('run', a.run);
      },
      // Drag deltas land in the same accumulator mouse moves use, so
      // ?sens and ?invertY steer the finger exactly like the mouse.
      onLook: (dx, dy) => input.look(dx, dy),
      onShout: () => {
        if (!gateOpen) voices.unlock(); // ?gate=off phone page: a tap is a gesture too
        if (!started) return;
        if (game.phase === 'win') {
          tryRestartFromWin(); // the shout button doubles as "play again"
          return;
        }
        if (!game.paused) input.queueAction('point');
      },
    });
    // Touch wording, JS-swapped so the captured desktop DOM never sees it
    // (#hint, #ending-again and the pause card live inside captured frames).
    if (el.gateBtn) el.gateBtn.textContent = 'tap to start';
    if (el.hint) el.hint.textContent = 'left thumb: stick · right side: drag to look · big button: shout at the dot';
    const psub = el.pause?.querySelector?.('.pause-sub');
    if (psub) psub.textContent = 'tap anywhere to keep looking';
    if (el.endingAgain) {
      el.endingAgain.textContent = 'tap the shout button to look at them again';
      el.endingAgain.style.pointerEvents = 'auto'; // a tap target, not a caption
      el.endingAgain.addEventListener('click', tryRestartFromWin);
    }
    // Portrait: the game waits behind the rotate hint (its .show is pure CSS,
    // see full.html) — pausing here keeps the sim honest while upright.
    portraitMQ = typeof matchMedia === 'function' ? matchMedia('(orientation: portrait)') : null;
    const applyOrientation = () => {
      touchCtl?.releaseAll(); // a finger mid-drag must not bank across the turn
      if (portraitMQ?.matches) {
        if (started && !game.paused && game.phase !== 'win') {
          game.paused = true;
          rotatePaused = true;
        }
      } else if (rotatePaused) resumePlay(); // back landscape: straight back in
      el.pause.classList.toggle('show', game.paused && started && game.phase !== 'win');
    };
    portraitMQ?.addEventListener?.('change', applyOrientation);
    // Called late as well as at boot (issue #29 live switch): one shared rule for
    // "upright means wait" whoever just turned the page into touch mode.
    applyOrientation();
    // Tab hidden: pause (the phone user returns to a waiting card, not a
    // run that walked off while the screen was off).
    document.addEventListener('visibilitychange', () => {
      touchCtl?.releaseAll();
      if (document.hidden && started && !game.paused && game.phase !== 'win') game.paused = true;
      el.pause.classList.toggle('show', game.paused && started && game.phase !== 'win');
    });
  }

  // ---------------------------------------------------------------------------
  // 13c. The live switch (issue #29) — a finger outranks any detection.
  // ---------------------------------------------------------------------------
  // Every JS signal for "this device has no touch" can be wrong (Chrome's
  // "Desktop site" toggle, a locked-down webview, a stale cached module), but a
  // POINTER EVENT whose pointerType is "touch" is not a guess: it is a finger
  // that arrived. So the mouse path watches for one, and hands the controls to
  // touch the moment it lands — BEFORE the gate's own click handler runs, which
  // is why a phone never gets as far as requesting pointer lock.
  //
  // One-way on purpose: a mouse appearing on a hybrid machine must not steal the
  // controls from someone using their hands. `?touch=off` is still the last word
  // at boot (QA on a real phone), and then nothing watches at all.
  const touchWatch = []; // [type, handler, options] — removed on the switch
  function enableTouchMode(reason) {
    if (TOUCH) return false;
    TOUCH = true;
    for (const [type, fn, opts] of touchWatch) window.removeEventListener(type, fn, opts);
    touchWatch.length = 0;
    input.unlock(); // a cursor we grabbed is not wanted any more
    initTouchUI(); // build the stick, the shout button, the touch wording
    renderStamp(); // the start card / gear panel now say "mode touch"
    console.info(`[look-at-bobo] touch controls on (${reason}) — the page had started in the mouse path.`);
    return true;
  }

  function watchForTouch() {
    if (TOUCH || TOUCH_OVERRIDE !== null) return; // already touch, or the URL decided
    const onFinger = (ev) => {
      if (ev.type === 'pointerdown' ? ev.pointerType !== 'touch' : !ev.touches?.length) return;
      enableTouchMode(ev.type);
    };
    const opts = { capture: true, passive: true };
    // Pointer Events first; `touchstart` for any engine that lacks them.
    touchWatch.push(['pointerdown', onFinger, opts], ['touchstart', onFinger, opts]);
    for (const [type, fn, o] of touchWatch) window.addEventListener(type, fn, o);
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
    if (GATE_OFF) {
      el.gate.classList.add('hidden');
      // Capture mode (?gate=off): the stamp chrome must never reach a frame, so
      // it is hidden by CSS as well as skipped by renderStamp().
      document.body.classList.add('capture');
    }
    // Comfort: high-contrast mode is one body class (CSS in the page).
    document.body.classList.toggle('hc', SETTINGS.highContrast);
    // The moment-label chip is tooling (capture frames, phase/moment/view/t/score
    // readout). Step 7: hidden for a real player — it was spoilers-on-screen —
    // but keepable with ?label=on; tool pages (?gate=off) always show it.
    if (!GATE_OFF && params.get('label') !== 'on') el.label.classList.add('off');
    stageFindMoment(MOMENTS[0].id);
    applyStage();
    applyView('first-person');
    applyTime(0);
    resize();
    renderer.render(scene, camera);
    installContract();
    initTouchUI(); // issue #25: no-op on desktop
    wireInput();
    watchForTouch(); // issue #29: a finger still switches a mis-detected phone over
    renderStamp(); // issue #29: which build, which control mode, which quality
    // `LC.ready` is the tool's one signal that the page may be captured, and a
    // capture is a screenshot of the WHOLE page — so ready means "the game is
    // what is on screen", not "the scene is built". The loading overlay fades
    // for 0.35 s before it leaves, and a frame taken during that fade is a
    // crossfade of the loading card and the flat: different pixels on every
    // boot, which is exactly what `--determinism` exists to catch. So ready is
    // announced when the overlay is genuinely gone; the player keeps the fade.
    const announceReady = () => {
      window.LC.ready = true;
      window.addEventListener('resize', () => {
        lastWidth = 0;
        resizeIfNeeded();
      });
      console.info(
        `[look-at-bobo] ${cfg.bootName ?? 'game'} ready — ${window.LC.moments.length} stages, ${window.LC.views.length} views, win at ${TARGET}, voice engine ${voices.audioUnlocked() ? 'unlocked' : 'gated'} · ${stampText()}.`,
      );
    };
    // Loading screen off — the flat is genuinely ready (this is the real
    // signal, not a timer). Pages without the overlay (demo/slice) skip it.
    if (el.loading) {
      const node = el.loading;
      node.classList.add('gone');
      let retired = false;
      const retire = () => {
        if (retired) return;
        retired = true;
        node.remove();
        announceReady();
      };
      // The fade ends on `transitionend`; the old 450 ms timer stays as the
      // backstop, because transitions never run in a hidden tab and `ready`
      // must never hang on a paint that will not come.
      node.addEventListener('transitionend', (ev) => {
        if (ev.target === node && ev.propertyName === 'opacity') retire();
      });
      setTimeout(retire, 450);
    } else {
      announceReady();
    }
  }

  try {
    boot();
  } catch (err) {
    window.LCError = `${err && err.message ? err.message : err}\n${err && err.stack ? err.stack : ''}`;
    el.boot.style.display = 'block';
    el.boot.textContent = `${cfg.failPrefix ?? 'Game failed to start'}:\n${window.LCError}`;
    if (el.loading) el.loading.classList.add('gone'); // the error card is the message now
    console.error(err);
  }
}
