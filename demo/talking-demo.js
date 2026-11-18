// demo/talking-demo.js — Step 5: the three real game events, with the Step 4
// voice lines, wired to the Step 3 look.
//
// Everything reusable (tokens, materials, cats, room, lighting, celebration,
// measurement) is IMPORTED from src/ — the modules that styletest.js and this
// page share. What lives here is the game moment itself:
//
//   idle   the room breathes; score pill + calm aim dot; cats idle.
//   catch  aim lands on BOBO + press → the pointing hand rises into frame,
//          the player yells "LOOK AT BOBO!" (shipped take 1), fireworks pop,
//          score +1.
//   wrong  aim lands on the DECOY + press → the same yell first (the player
//          thought it was Bobo), then the hand pulls back, the gentle coral X
//          + "DAG!" (shipped take 2) eases in, score −1 — and never below 0.
//   win    10 points → the rain of little Bobo heads, the fireworks, and the
//          exact line `your did it! you wind` with its voice take.
//
// Audio is plain HTMLAudioElement playback of the committed mp3 files, gated
// behind a click like every real page (docs/VOICES.md picks live in
// src/audio.js). Nothing about audio touches the seek/render path: the
// SCHEDULE is pure data the selfTest checks; the play loop is what fires it.
// The window.LC contract (docs/CAPTURE.md) drives all of it for the Step 2
// capture tool, plus this page's trigger()/score()/audioStatus() extensions.

import * as THREE from 'three';

// Importing the guards first installs them before anything is built.
import { measured, setRendering, countUnseededCalls } from '../src/determinism.js';
import { TOKENS } from '../src/tokens.js';
import { clamp, easeOutCubic, easeOutBack, seededShuffle, srgbLuma, contrast, round } from '../src/util.js';
import { buildRoom } from '../src/room.js';
import { buildCat, setCatPose } from '../src/cat.js';
import { createCelebration } from '../src/celebrate.js';
import { scanMarkings, contactGap } from '../src/measure.js';
import { buildHand } from '../src/hand.js';
import { VOICE_LINES, audioPlanFor, createVoiceEngine } from '../src/audio.js';

/** Fixed strings. Exact. On purpose. Never "fixed". */
const EXACT_ENDING = 'your did it! you wind';
const EXACT_DAG = 'DAG!';

const params = new URLSearchParams(location.search);
/** Fault injection, so the event checks can be proven to bite:
 *  ?plant=text   the joke ending gets "fixed" (ending-text-exact must fail)
 *  ?plant=audio  the yell plays the wrong take (the audio-plan checks fail)
 *  ?plant=score  the events stop moving the score (the score rules fail)
 *  The source files stay correct; the fault only exists in the URL. */
const PLANT = params.get('plant');
let ENDING_TEXT = EXACT_ENDING;
/** Data-first fault: only the plan's filename changes, and the checks that
 *  compare against the docs/VOICES.md picks say so. */
const PLAN_OVERRIDES = PLANT === 'audio' ? { yell: 'assets/audio/yell-look-at-bobo.take1.mp3' } : {};

/** ?gate=off skips the click-to-begin gate headlessly (captures); real pages
 *  and the audio check use a real click. ?score=N starts the score pill at N. */
const GATE_OFF = params.get('gate') === 'off';
const INITIAL_SCORE = clamp(Number.parseInt(params.get('score') ?? '0', 10) || 0, 0, 10);

const DURATION = 6; // seconds per moment loop
const MOMENTS = ['idle', 'catch', 'wrong', 'win'];

// ---------------------------------------------------------------------------
// 1. Views. Same room, same numbers as the style test where they match; the
//    `hand` flag says which views are first-person enough to show the player's
//    own pointing hand — only the first-person view; the face close-ups are
//    too tight a FOV for a hand at arm's length, and the diorama is outside
//    the player's body.
// ---------------------------------------------------------------------------
const V = {
  diorama: { pos: [3.0, 2.0, 3.3], look: [-0.4, 0.55, -0.5], fov: 48, hand: false },
  'first-person': { pos: [0.3, 1.5, 2.35], look: [-0.42, 0.5, 0.35], fov: 55, hand: true },
  'bobo-face': { pos: [-0.3, 0.4, 0.98], look: [-0.3, 0.36, 0.3], fov: 22, hand: false },
  'decoy-face': { pos: [0.68, 0.26, 1.12], look: [0.66, 0.2, 0.68], fov: 24, hand: false },
};
/** The aim follows the mistake: in the wrong-cat moment the first-person view
 *  is pointed at the DECOY sprawl, not at Bobo. */
const WRONG_LOOK = [0.62, 0.26, 0.5];

// ---------------------------------------------------------------------------
// 2. Renderer / scene / camera
// ---------------------------------------------------------------------------
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(1); // pixel-exact captures on any display (docs/CAPTURE.md)
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; // the filmic curve of the look
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x14181f);

const camera = new THREE.PerspectiveCamera(V['first-person'].fov, window.innerWidth / window.innerHeight, 0.05, 40);
scene.add(camera); // so the camera-parented hand gets its world matrix updated

let momentName = 'idle';
let viewName = 'first-person';
let seekTime = 0;
let score = INITIAL_SCORE;
let gateOpen = GATE_OFF;

// ---------------------------------------------------------------------------
// 3. The room + lighting, the two cats, the celebration — all imported look.
// ---------------------------------------------------------------------------
const { SUPPORTS, sun, WALL_Z } = buildRoom(scene);

const bobo = buildCat('bobo');
const decoy = buildCat('decoy');
scene.add(bobo.root, decoy.root);

/** One layout for the whole demo: the two cats, on their rug, facing the
 *  player — exactly the default searching tableau from the style test. */
const LAYOUT = {
  bobo: { pos: [-0.3, 'rug', 0.35], pose: 'sit' },
  decoy: { pos: [0.62, 'rug', 0.42], pose: 'sprawl' },
};
function placeCats() {
  for (const [cat, spec] of [[bobo, LAYOUT.bobo], [decoy, LAYOUT.decoy]]) {
    const [x, support, z] = spec.pos;
    cat.root.position.set(x, SUPPORTS[support] ?? 0, z);
    cat.root.rotation.y = 0; // facing +z: toward the searching player
    setCatPose(cat, spec.pose);
  }
}

const { rainHeads, rainMuzzles, rainDashes, bursts, updateRain, updateFireworks } = createCelebration(scene);

// The player's hand, living on the camera like a first-person body.
const hand = buildHand();
const handRig = new THREE.Group();
handRig.add(hand.root);
camera.add(handRig); // applyTime owns the rig's pose every frame

// ---------------------------------------------------------------------------
// 4. The voice engine. The plan is pure data (src/audio.js); the play loop is
//    the only thing that fires it, so seeks/renders stay silent and pure.
// ---------------------------------------------------------------------------
const voices = createVoiceEngine({ resolve: (f) => `../${f}` });
const planFor = (moment) => audioPlanFor(moment, PLAN_OVERRIDES);
let firedCues = new Set();

function markCuesUpTo(t) {
  planFor(momentName).forEach((c, i) => {
    if (c.at <= t) firedCues.add(i);
  });
}
function advanceCues(from, to) {
  planFor(momentName).forEach((c, i) => {
    if (!firedCues.has(i) && c.at > from && c.at <= to) {
      firedCues.add(i);
      voices.fire(c.line, c.file);
    }
  });
}

// ---------------------------------------------------------------------------
// 5. The HUD (design system §8 — same vocabulary as the style test).
// ---------------------------------------------------------------------------
const el = {
  score: document.getElementById('hud-score'),
  scoreNum: document.querySelector('#hud-score .num'),
  reticle: document.getElementById('reticle'),
  dag: document.getElementById('dag-burst'),
  dagLabel: document.getElementById('dag-label'),
  ending: document.getElementById('ending'),
  veil: document.getElementById('ending-veil'),
  label: document.getElementById('moment-label'),
  boot: document.getElementById('boot-error'),
  gate: document.getElementById('gate'),
  gateBtn: document.getElementById('gate-btn'),
};
/** What is on screen in each moment. The score is live state, not a moment
 *  constant — except at the win, where the pill shows the ten it earned. */
const HUD_SPEC = {
  idle: { reticle: true, soft: false, dag: false, ending: false },
  catch: { reticle: true, soft: false, dag: false, ending: false },
  wrong: { reticle: true, soft: true, dag: true, ending: false },
  win: { reticle: false, soft: false, dag: false, ending: true },
};

function updateHandVisibility() {
  handRig.visible = Boolean(V[viewName]?.hand) && (momentName === 'catch' || momentName === 'wrong');
}

/** Write DOM text only when it actually changes. Rewriting identical text
 *  invalidates the composited text layer every frame; headless Chrome then
 *  re-rasterises it over the freshly-swapped canvas tile, and the 35 pixels
 *  of antialiasing that come back are NOT the page being nondeterministic —
 *  the canvas (toDataURL) is byte-stable. Quiet DOM = stable composite. */
function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
}
function setStyle(node, prop, value) {
  const seen = node.__styleWrites ?? (node.__styleWrites = {});
  if (seen[prop] === value) return; // reading style back returns a normalised
  seen[prop] = value; // form, so compare against what we wrote, not what CSS says
  node.style[prop] = value;
}

function applyHud() {
  const spec = HUD_SPEC[momentName];
  const shown = momentName === 'win' ? 10 : score;
  el.score.classList.add('show'); // in-game HUD: the count-up is always on
  setText(el.scoreNum, String(shown).padStart(2, '0'));
  el.reticle.classList.toggle('show', spec.reticle);
  el.reticle.classList.toggle('soft', spec.soft);
  if (el.dag.style.display !== (spec.dag ? 'block' : 'none')) el.dag.style.display = spec.dag ? 'block' : 'none';
  el.ending.classList.toggle('show', spec.ending);
  el.veil.classList.toggle('show', spec.ending);
  setText(el.ending, ENDING_TEXT);
  setText(el.dagLabel, EXACT_DAG);
  const celebrate = momentName === 'win' || momentName === 'catch';
  for (const b of bursts) b.mesh.visible = celebrate; // a catch earns a pop too
  for (const m of [rainHeads, rainMuzzles, rainDashes]) m.visible = momentName === 'win';
  updateHandVisibility();
}

/** The frame is a pure function of (moment, view, t, score): nothing here
 *  reads the wall clock. */
function applyTime(t) {
  seekTime = t;
  // Bobo: a tail that flicks and a head that looks around (style test rules)
  const bp = bobo.pivots[bobo.current];
  if (bp) {
    bp.tailPivot.rotation.y = Math.sin(t * 1.7) * 0.14;
    bp.head.rotation.y = Math.sin(t * 0.85 + 0.4) * 0.09;
    bp.head.rotation.x = bp.baseHeadX + Math.sin(t * 0.6) * 0.025;
  }
  // The decoy: a slow, heavy breath, sideways only (never sinks into the rug).
  const dp = decoy.pivots[decoy.current];
  if (dp) {
    const base = dp.body.userData.baseScale ?? (dp.body.userData.baseScale = dp.body.scale.clone());
    const s = Math.sin(t * 1.1);
    dp.body.scale.set(base.x * (1 + 0.03 * s), base.y, base.z * (1 + 0.022 * s));
    dp.shells[0].scale.copy(dp.body.scale).multiplyScalar(1.045);
  }
  // "DAG!" eases in and stays: the penalty is a joke, not a punishment
  if (HUD_SPEC[momentName].dag) {
    const k = clamp((t - 0.7) / 0.5, 0, 1);
    const s = k <= 0 ? 0.001 : easeOutBack(k);
    setStyle(el.dag, 'transform', `translate(-50%, -50%) scale(${s.toFixed(4)})`);
    setStyle(el.dag, 'opacity', k.toFixed(4));
  }
  // Celebration: fireworks for a catch AND the win; the head-rain is only the win.
  if (momentName === 'win') updateRain(t);
  if (momentName === 'win' || momentName === 'catch') updateFireworks(t);
  // The pointing hand: rises into frame on the shout; on the wrong cat it
  // pulls back when the DAG! lands. Pure function of (moment, t). Angled
  // down-and-forward so the knuckles and extended index read from behind —
  // end-on, the sleeve is just a mustard disc.
  if (momentName === 'catch' || momentName === 'wrong') {
    const wrongness = momentName === 'wrong';
    const k = easeOutCubic(clamp((t - 0.15) / 0.4, 0, 1)); // rises with the shout
    const w = wrongness ? easeOutCubic(clamp((t - 0.95) / 0.45, 0, 1)) : 0; // pulls back at the DAG!
    handRig.position.set(
      0.17 - 0.03 * k + 0.12 * w + (1 - k) * 0.05,
      -0.4 + 0.16 * k - 0.34 * w + Math.sin(t * 1.15) * 0.004 * k, // held by a living arm, not a tripod
      -0.72 + 0.05 * k + 0.06 * w,
    );
    handRig.rotation.set(-0.05 - 0.05 * k - 0.55 * w, (wrongness ? 0 : 0.42 - 0.06 * k) - 0.45 * w, -0.08);
  } else {
    handRig.position.set(0.17, -0.43, -0.72); // at rest, out of frame's way
    handRig.rotation.set(-0.05, 0.42, -0.08);
  }
}

function applyView(name) {
  viewName = name; // the hand's visibility reads this; never leave it stale
  const v = V[name];
  const look = name === 'first-person' && momentName === 'wrong' ? WRONG_LOOK : v.look;
  camera.position.set(v.pos[0], v.pos[1], v.pos[2]);
  camera.fov = v.fov;
  camera.updateProjectionMatrix();
  camera.lookAt(look[0], look[1], look[2]);
  updateHandVisibility();
}
function updateLabel() {
  setText(el.label, `${momentName}  ·  ${viewName}  ·  t=${seekTime.toFixed(2)}s  ·  ${String(score).padStart(2, '0')}/10`);
}
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
  camera.updateProjectionMatrix();
}

/** The one path that changes the moment: pure stage updates, no score. */
function applyMoment(id) {
  if (!MOMENTS.includes(id)) throw new Error(`Unknown moment "${id}". Declared: ${MOMENTS.join(', ')}`);
  momentName = id;
  firedCues = new Set();
  placeCats();
  applyHud();
  applyView(viewName); // the first-person look can follow the moment's aim
}

/** The one path that changes the SCORE: the game's event rules, exactly:
 *  catch +1 (capped at 10 — reaching 10 IS the win), wrong −1 floored at 0,
 *  and after the win nothing moves the number any more. */
function triggerEvent(event) {
  if (event !== 'catch' && event !== 'wrong') throw new Error(`Unknown event "${event}". Use catch or wrong.`);
  measured(() => {
    let next;
    if (event === 'catch') {
      if (score < 10 && PLANT !== 'score') score += 1;
      next = score >= 10 ? 'win' : 'catch';
    } else {
      if (score >= 10) return; // the game is over: a DAG! cannot follow the win
      if (PLANT !== 'score') score = Math.max(0, score - 1);
      next = 'wrong';
    }
    state.time = 0;
    applyMoment(next);
    state.moment = next;
    applyTime(0);
    updateLabel();
  });
}

// ---------------------------------------------------------------------------
// 6. selfTest. Every number is measured back out of the built state — the
//    event RULES are checked by exercising the events, the audio is checked
//    against the docs/VOICES.md picks, and the stage is checked per moment.
// ---------------------------------------------------------------------------
function poseSignature() {
  const bp = bobo.pivots[bobo.current];
  const dp = decoy.pivots[decoy.current];
  const spec = HUD_SPEC[momentName];
  const dir = camera.getWorldDirection(new THREE.Vector3());
  return [
    momentName, viewName, score,
    bobo.current, decoy.current,
    bobo.root.position.toArray(), decoy.root.position.toArray(),
    bp ? [bp.tailPivot.rotation.y, bp.head.rotation.y] : [],
    dp ? [dp.body.scale.x, dp.body.scale.z] : [],
    camera.position.toArray(), dir.toArray(),
    handRig.visible, handRig.position.toArray(), handRig.rotation.y,
    spec.reticle, spec.soft, spec.dag, spec.ending,
    el.scoreNum.textContent,
    rainHeads.visible, bursts[0].mesh.visible,
  ].flat().map((x) => round(x)).join('|');
}

function momentOrderIndependence() {
  const canonical = new Map();
  for (const id of MOMENTS) {
    applyMoment(id);
    applyTime(1.25);
    canonical.set(id, poseSignature());
  }
  let worst = 0;
  let worstName = null;
  for (const id of seededShuffle(MOMENTS, 7)) {
    const want = canonical.get(id);
    applyMoment(id);
    applyTime(1.25);
    if (poseSignature() !== want) {
      worst = 1;
      worstName = id;
    }
  }
  return { worstDiff: worst, worst: worstName, visits: MOMENTS.length * 2 };
}

function selfTest() {
  const checks = [];
  const add = (name, value, limit, pass, note = null) =>
    checks.push({ name, value: round(value), limit, pass: Boolean(pass), note });

  scene.updateMatrixWorld(true);
  const spec = HUD_SPEC[momentName];
  const savedScore = score;

  // --- the exact strings, again: this page shows them too ------------------
  add('ending-text-exact', el.ending.textContent, `exactly "${EXACT_ENDING}"`, el.ending.textContent === EXACT_ENDING, 'story-fixed, never corrected');
  add('dag-text-exact', el.dagLabel.textContent, `exactly "${EXACT_DAG}"`, el.dagLabel.textContent === EXACT_DAG, 'wrong-cat line, never corrected');

  // --- HUD states follow the moment ---------------------------------------
  const endingShown = getComputedStyle(el.ending).display !== 'none';
  add('ending-visibility', endingShown ? 'shown' : 'hidden', spec.ending ? 'shown' : 'hidden', endingShown === spec.ending, `moment ${momentName}`);
  const dagShown = el.dag.style.display !== 'none';
  add('dag-visibility', dagShown ? 'shown' : 'hidden', spec.dag ? 'shown' : 'hidden', dagShown === spec.dag, null);
  const scoreText = el.score.textContent;
  add('hud-score-format', scoreText, /^\d{2} \/ 10$/, /^\d{2} \/ 10$/.test(scoreText), 'zero-padded count-up out of 10, always on');
  add('reticle-state', el.reticle.classList.contains('soft') ? 'coral' : 'calm', spec.soft ? 'coral' : 'calm', el.reticle.classList.contains('soft') === spec.soft, 'gentle coral for the wrong cat, never red');

  // --- the event rules: exercised for real, numbers out -------------------
  const withScore = (n, fn) => {
    score = n;
    const out = fn();
    return out;
  };
  withScore(3, () => {
    triggerEvent('catch');
    add('score-catch-increments', score, '4 (3+1)', score === 4, 'a correct catch counts up once');
  });
  withScore(4, () => {
    triggerEvent('wrong');
    add('score-wrong-decrements', score, '3 (4-1)', score === 3, 'the wrong cat costs a point');
  });
  withScore(0, () => {
    triggerEvent('wrong');
    add('score-floors-at-zero', score, 'stays 0', score === 0, 'gentle penalty: never negative, no game over');
  });
  withScore(9, () => {
    triggerEvent('catch');
    const won = `${score}/${state.moment}`;
    add('score-wins-at-ten', won, '10/win', score === 10 && state.moment === 'win', '10 points IS the ending');
    add(
      'win-stage-live',
      `${rainHeads.visible ? 'rain' : 'no-rain'}/${getComputedStyle(el.ending).display !== 'none' ? 'text' : 'no-text'}`,
      'rain/text',
      rainHeads.visible && getComputedStyle(el.ending).display !== 'none',
      'the win shows the rain of Bobos AND the exact line, live',
    );
    triggerEvent('wrong');
    add('score-frozen-after-win', `${score}/${state.moment}`, '10/win', score === 10 && state.moment === 'win', 'after the win, nothing moves the score');
  });

  // --- audio: the shipped picks, scheduled per the feel --------------------
  const fmt = (plan) => plan.map((c) => `${c.line}@${c.at}=${c.file.split('/').pop()}`).join(', ') || 'silence';
  add('audio-plan-catch', fmt(planFor('catch')), 'yell@0.25=yell-look-at-bobo.take2.mp3', fmt(planFor('catch')) === 'yell@0.25=yell-look-at-bobo.take2.mp3', 'docs/VOICES.md: yell take 2 (issue #96 picks)');
  add(
    'audio-plan-wrong',
    fmt(planFor('wrong')),
    'yell@0.25=yell-look-at-bobo.take2.mp3, dag@1.8=dag-wrong-cat.take2.mp3',
    fmt(planFor('wrong')) === 'yell@0.25=yell-look-at-bobo.take2.mp3, dag@1.8=dag-wrong-cat.take2.mp3',
    'the shout first (it thought it was Bobo), then the DAG! take 2',
  );
  add('audio-plan-win', fmt(planFor('win')), 'win@0.35=win-line.take1.mp3', fmt(planFor('win')) === 'win@0.35=win-line.take1.mp3', 'docs/VOICES.md: win take 1 (issue #96 picks)');
  add('audio-plan-idle', fmt(planFor('idle')), 'silence', fmt(planFor('idle')) === 'silence', 'idle says nothing');
  const pickFiles = Object.values(VOICE_LINES).map((v) => v.file.split('/').pop()).join(', ');
  add(
    'audio-picks-match-docs',
    pickFiles,
    'yell t2, dag t2, win t1',
    pickFiles === 'yell-look-at-bobo.take2.mp3, dag-wrong-cat.take2.mp3, win-line.take1.mp3' && Object.values(VOICE_LINES).every((v) => v.dur > 0),
    'the docs/VOICES.md shipped takes, referenced not copied',
  );

  // --- the gate: audio waits for a real click like every real page ---------
  const gateHidden = el.gate.classList.contains('hidden');
  add(
    'gate-state',
    `${gateHidden ? 'hidden' : 'shown'}/${gateOpen ? 'open' : 'locked'}`,
    GATE_OFF ? 'hidden/open' : 'shown/locked',
    gateHidden === GATE_OFF && gateOpen === GATE_OFF,
    'click-to-begin before any sound; ?gate=off only for headless capture',
  );

  // --- the stage per moment: hand, fireworks, rain ------------------------
  const withMoment = (id, fn) => {
    applyMoment(id);
    applyTime(1.2);
    const out = fn();
    return out;
  };
  const fireworks = ['idle', 'catch', 'wrong', 'win'].map((m) => withMoment(m, () => bursts.every((b) => b.mesh.visible)));
  add('fireworks-on-catch-and-win', fireworks.join('/'), 'false/true/false/true', fireworks.join('/') === 'false/true/false/true', 'a catch earns a pop; the rain is only the win');
  const rain = ['idle', 'catch', 'wrong', 'win'].map((m) => withMoment(m, () => rainHeads.visible));
  add('rain-only-on-win', rain.join('/'), 'false/false/false/true', rain.join('/') === 'false/false/false/true', null);

  const savedView = viewName;
  applyView('first-person');
  const handCatch = withMoment('catch', () => handRig.visible && handRig.position.z < -0.3 && handRig.position.y > -0.4);
  const handWrong = withMoment('wrong', () => handRig.visible && handRig.position.x > 0.2 && handRig.position.y < -0.45); // pulled back at the DAG!
  const handIdle = withMoment('idle', () => !handRig.visible);
  add('hand-in-points-at-catch', `${handCatch ? 'catch-ok' : 'catch-bad'}/${handWrong ? 'wrong-ok' : 'wrong-bad'}/${handIdle ? 'idle-hidden' : 'idle-shown'}`, 'catch-ok/wrong-ok/idle-hidden', handCatch && handWrong && handIdle, 'the hand points on the shout and pulls back on the DAG!');
  applyView('diorama');
  const dioramaHand = withMoment('catch', () => !handRig.visible);
  add('no-hand-in-diorama', dioramaHand ? 'hidden' : 'shown', 'hidden', dioramaHand, 'the hand is a first-person body, not a prop');
  applyView(savedView);

  // --- the cast reads right on this page too (Step 3 tells hold) ----------
  const bb = scanMarkings(bobo, 'sit');
  const dd = scanMarkings(decoy, 'sprawl');
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
  const bbBox = new THREE.Box3().setFromObject(bobo.poses.sit).getSize(new THREE.Vector3());
  const ddBox = new THREE.Box3().setFromObject(decoy.poses.sit).getSize(new THREE.Vector3());
  add('size-tell-width', ddBox.x / bbBox.x, '≥1.25× as wide', ddBox.x / bbBox.x >= 1.25, '22 lb vs 15 lb, measured as built');
  for (const cat of [bobo, decoy]) {
    const { gap, support, who } = contactGap(cat, LAYOUT[cat.kind].pos[1], SUPPORTS);
    add(`${cat.kind}-contact`, gap, '-0.001..+0.002 m', gap >= -0.001 && gap <= 0.002, `${cat.current}: lowest part "${who}" on ${support}`);
  }

  // --- the look is the chosen look ----------------------------------------
  add('fur-not-pure-black', srgbLuma(TOKENS.furBlack), '≥0.004 luma', srgbLuma(TOKENS.furBlack) >= 0.004, 'imported from src/tokens.js, not re-themed here');
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

  // --- the contract -------------------------------------------------------
  const positions = Object.values(V).map((v) => new THREE.Vector3(...v.pos));
  let minDist = Infinity;
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      minDist = Math.min(minDist, positions[i].distanceTo(positions[j]));
    }
  }
  add('views-distinct', minDist, '≥0.5 m apart', minDist >= 0.5 && Object.keys(V).length >= 4, 'four declared views');

  const t0 = seekTime;
  const m0 = momentName;
  const sigBefore = poseSignature();
  const other = MOMENTS.find((m) => m !== m0) ?? m0;
  applyMoment(other);
  applyTime(clamp(t0 + 1.31, 0, DURATION));
  applyMoment(m0);
  applyTime(t0);
  add('seek-repeatable', sigBefore === poseSignature() ? 0 : 1, '≤1e-9', sigBefore === poseSignature(), `pose at t=${round(t0)} before vs after visiting "${other}"`);

  const order = momentOrderIndependence();
  add(
    'moment-order-independent',
    order.worstDiff,
    '≤1e-9',
    order.worstDiff <= 1e-9,
    `${order.visits} visits, declared order vs a seeded shuffle${order.worst ? ` (worst: ${order.worst})` : ''}`,
  );
  add('seek-no-unseeded-random', countUnseededCalls(), '0 calls', countUnseededCalls() === 0, 'Math.random / Date.now inside seek / setMoment / trigger');
  add('duration-positive', DURATION, '>0 s', DURATION > 0, null);

  const stats = window.LC?.getStats ? window.LC.getStats() : { drawCalls: 0 };
  add('stats-available', stats.drawCalls, '>0 draw calls', stats.drawCalls > 0, 'render once before getStats means anything');
  add(
    'lighting-budget-intent',
    `${stats.realLights} lights / ${stats.shadowLights} shadow`,
    '≤6 lights, ≤1 shadow light by design',
    stats.realLights <= 6 && stats.shadowLights <= 1,
    null,
  );

  score = savedScore;
  restoreAfterSelfTest();
  return { pass: checks.every((c) => c.pass), checks };
}
function restoreAfterSelfTest() {
  applyMoment(state.moment);
  applyView(state.view);
  applyTime(state.time);
  updateLabel();
}

// ---------------------------------------------------------------------------
// 7. The window.LC contract (docs/CAPTURE.md) + the event-layer extensions.
// ---------------------------------------------------------------------------
const state = { moment: 'idle', time: 0, view: 'first-person', playing: false };

function clampTime(t) {
  const n = Number(t);
  return Number.isFinite(n) ? clamp(n, 0, DURATION) : 0;
}

function unlockGate() {
  if (gateOpen) return;
  gateOpen = true;
  voices.unlock();
  el.gate.classList.add('hidden');
  window.LC?.play();
}

function installContract() {
  window.LC = {
    // --- required by the page contract
    ready: false,
    duration: DURATION,
    views: Object.keys(V),
    setView(name) {
      if (!V[name]) throw new Error(`Unknown view "${name}". Declared: ${Object.keys(V).join(', ')}`);
      state.view = name;
      viewName = name;
      applyView(name);
      updateLabel();
    },
    seek(t) {
      measured(() => {
        state.time = clampTime(t);
        applyMoment(state.moment);
        markCuesUpTo(state.time);
        applyTime(state.time);
        updateLabel();
      });
    },
    play() {
      if (state.playing) return;
      state.playing = true;
      renderer.setAnimationLoop(() => {
        const prev = state.time; // read fresh every frame: trigger()/seek() can
        const next = clampTime(prev + 1 / 60); // reset the clock mid-play
        advanceCues(prev, next); // the ONLY place audio fires
        state.time = next;
        applyTime(next);
        updateLabel();
        window.LC.renderNow();
      });
    },
    pause() {
      state.playing = false;
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
        passes: 1, // no post-processing in the chosen look (ART_STYLE.md §7)
        realLights,
        shadowLights,
      };
    },
    selfTest,

    // --- extensions this project uses
    moments: MOMENTS.slice(),
    moment() {
      return { id: state.moment, score, plan: planFor(state.moment) };
    },
    setMoment(id) {
      measured(() => {
        applyMoment(id);
        state.moment = id;
        markCuesUpTo(state.time);
        applyTime(state.time);
        updateLabel();
      });
    },
    goto(momentId, t) {
      if (momentId != null) this.setMoment(momentId);
      if (t != null) this.seek(t);
      this.renderNow();
    },
    time() {
      return state.time;
    },
    view() {
      return state.view;
    },
    playing() {
      return state.playing;
    },
    state() {
      return { moment: state.moment, time: state.time, view: state.view, playing: state.playing, duration: DURATION, score, gateOpen, plant: PLANT };
    },
    camera(name = state.view) {
      const v = V[name];
      return { name, position: v.pos.slice(), look: name === 'first-person' && state.moment === 'wrong' ? WRONG_LOOK.slice() : v.look.slice(), fov: v.fov };
    },
    endingText: EXACT_ENDING,
    dagText: EXACT_DAG,
    tokens: TOKENS,
    styleName: 'Sunny Room, Soft Fur',
    plant: PLANT,

    // --- the Step 5 event layer: the scripted/automatable path
    trigger(event) {
      triggerEvent(event);
    },
    scoreValue() {
      return score;
    },
    setScore(n) {
      score = clamp(Number(n) || 0, 0, 10);
      applyHud();
      updateLabel();
    },
    audioPlan(id = state.moment) {
      return planFor(id);
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
// 8. Real input: the pointer IS the aim (click a cat to shout at it) and the
//    keyboard runs the events. Event-driven only — the render path never
//    sees any of this.
// ---------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
function pickCat(ev) {
  const ndc = new THREE.Vector2((ev.clientX / window.innerWidth) * 2 - 1, -(ev.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  for (const hit of raycaster.intersectObjects([bobo.root, decoy.root], true)) {
    if (!hit.object.isMesh) continue;
    let o = hit.object;
    while (o && !(o.name ?? '').startsWith('cat-')) o = o.parent;
    if (o) return o.name === 'cat-bobo' ? 'bobo' : 'decoy';
  }
  return null;
}

function wireInput() {
  el.gate.addEventListener('click', unlockGate);
  canvas.addEventListener('pointerdown', (ev) => {
    if (!gateOpen) return;
    const target = pickCat(ev);
    if (target === 'bobo') triggerEvent('catch');
    else if (target === 'decoy') triggerEvent('wrong');
  });
  window.addEventListener('keydown', (ev) => {
    if (!gateOpen || ev.repeat) return;
    if (ev.code === 'Space') {
      ev.preventDefault();
      window.LC?.play();
      triggerEvent('catch');
    } else if (ev.key === '1') triggerEvent('catch');
    else if (ev.key === '2') triggerEvent('wrong');
    else if (ev.key === '3') {
      window.LC?.setScore(9);
      triggerEvent('catch');
    } else if (ev.key === '0') {
      window.LC?.setScore(0);
      window.LC?.setMoment('idle');
    }
  });
}

// Fault injection, applied after everything is built so selfTest can catch it.
if (PLANT === 'text') {
  ENDING_TEXT = 'you did it! you win'; // the joke "fixed": ending-text-exact must fail
} else if (PLANT === 'audio') {
  // the yell's take swap lives in PLAN_OVERRIDES; the audio-plan checks fail
} else if (PLANT === 'score') {
  // triggerEvent stops moving the score; the score-rule checks fail
} else if (PLANT && PLANT !== 'none') {
  console.warn(`Unknown plant "${PLANT}". Use text, audio or score.`);
}

function boot() {
  if (GATE_OFF) el.gate.classList.add('hidden'); // headless capture: no click to wait for
  placeCats();
  applyMoment(state.moment);
  applyView(state.view);
  applyTime(0);
  updateLabel();
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
    `[look-at-bobo] step 5 demo ready — ${window.LC.moments.length} moments, ${window.LC.views.length} views, voice engine ${voices.audioUnlocked() ? 'unlocked' : 'gated'}.`,
  );
}

try {
  boot();
} catch (err) {
  window.LCError = `${err && err.message ? err.message : err}\n${err && err.stack ? err.stack : ''}`;
  el.boot.style.display = 'block';
  el.boot.textContent = `Step 5 demo failed to start:\n${window.LCError}`;
  console.error(err);
}
