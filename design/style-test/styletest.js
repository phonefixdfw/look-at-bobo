// design/style-test/styletest.js — the Step 3 style test scene, "Sunny Room, Soft Fur".
//
// This is the REFERENCE IMPLEMENTATION of docs/ART_STYLE.md: the chosen look,
// built in code (Three.js, no downloads), proven with the Step 2 capture tool.
//
// The reusable half of it — tokens, materials, marking rules, the cat
// builder, the room + lighting rig, the celebration, and the measuring
// helpers — now lives in src/ (extracted verbatim; the captures below prove
// the refactor is pixel-identical to the original) and is imported here.
// What is left in this file is the STYLE TEST ITSELF: the views, the moments,
// the HUD spec, the selfTest, and the page contract.
//
// In the room:
//   - a slice of a believable, realistically lit modern apartment (floor, plaster
//     walls, a window with real sun through it, couch, rug, lamp, plant, box);
//   - BOBO (~15 lb) and the DECOY CAT (~22 lb) from ONE parametric cat builder:
//     the only difference between them is which marking rules are switched on
//     (Bobo: forehead dash + chest bib + belly patch + muzzle; the decoy: none at
//     all — since issue #34 his only white is the literal white foot parts);
//   - the HUD vocabulary: score pill, the gentle round X + "DAG!", and the win
//     celebration raining little Bobo heads with the exact ending text.
//
// It implements the window.LC page contract (docs/CAPTURE.md) on top of the
// test scene's patterns: determinism guards, order-independent moments, and a
// selfTest whose numbers are measured back out of the built geometry.

import * as THREE from 'three';

// Importing the guards first installs them before anything is built.
import { measured, setRendering, countUnseededCalls } from '../../src/determinism.js';
import { TOKENS } from '../../src/tokens.js';
import { clamp, easeOutBack, seededShuffle, projectedPx, srgbLuma, contrast, round } from '../../src/util.js';
import { buildRoom } from '../../src/room.js';
import { buildCat, CAT_SPECS, setCatPose } from '../../src/cat.js';
import { rulesBobo, paintPose, ellSDF } from '../../src/markings.js';
import { createCelebration } from '../../src/celebrate.js';
import { scanMarkings, contactGap, NECK_ZONE_EXPECT } from '../../src/measure.js';

/** Fixed strings. Exact. On purpose. Never "fixed". */
const EXACT_ENDING = 'your did it! you wind';
const EXACT_DAG = 'DAG!';

const params = new URLSearchParams(location.search);
/** Fault injection, so the tell checks can be proven to bite:
 *  ?plant=dash  — Bobo's forehead-dash rule is switched off
 *  ?plant=neck  — the decoy's OLD white neck band is painted back on (issue #34)
 *  ?plant=size  — the decoy cat is built at Bobo's size
 *  ?plant=text  — the joke ending gets "fixed"
 *  ?plant=stats — the page lies about how cheap its frames are
 *  The source files stay correct; the fault only exists in the URL. */
const PLANT = params.get('plant');
/** The ending line. A variable only so ?plant=text can corrupt it data-first,
 *  the way ?plant=dash corrupts the marking rules. The check compares against
 *  EXACT_ENDING, which never changes. */
let ENDING_TEXT = EXACT_ENDING;

const DURATION = 6; // seconds, the loop
const FLOOR_Y = 0;

// ---------------------------------------------------------------------------
// 1. Views and moments. (The design tokens are in src/tokens.js — this page
//    exports them onward through window.LC.tokens, one source, no copying.)
// ---------------------------------------------------------------------------
const V = {
  diorama: { pos: [3.0, 2.0, 3.3], look: [-0.4, 0.55, -0.5], fov: 48 },
  'first-person': { pos: [0.75, 1.6, 2.3], look: [-0.15, 0.8, -1.0], fov: 60 },
  'cats-close': { pos: [0.15, 0.42, 1.45], look: [0.05, 0.34, 0.3], fov: 36 },
  'bobo-face': { pos: [-0.3, 0.4, 0.98], look: [-0.3, 0.36, 0.3], fov: 22 },
};
const MOMENTS = ['default', 'loaf-couch', 'lineup', 'hud-score', 'hud-dag', 'win'];

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

const camera = new THREE.PerspectiveCamera(V.diorama.fov, window.innerWidth / window.innerHeight, 0.05, 40);
const baseFov = V.diorama.fov;

let momentName = 'default';
let score = 0;
let seekTime = 0;

// ---------------------------------------------------------------------------
// 3. The apartment slice + the lighting rig (src/room.js). The support heights
//    the cats stand on come back MEASURED from the builder.
// ---------------------------------------------------------------------------
const { SUPPORTS, sun, WALL_Z } = buildRoom(scene);

// ---------------------------------------------------------------------------
// 4. The two cats (src/cat.js). One builder; the difference is the rules.
// ---------------------------------------------------------------------------
const bobo = buildCat('bobo');
const decoy = buildCat('decoy');
if (PLANT === 'size') decoy.root.scale.set(1, 1, 1); // planted fault: the size tell must be caught
scene.add(bobo.root, decoy.root);

/** Where each cat stands in each moment, and what support it stands on. */
const LAYOUT = {
  default: { bobo: { pos: [-0.3, 'rug', 0.35], pose: 'sit' }, decoy: { pos: [0.62, 'rug', 0.42], pose: 'sprawl' } },
  'loaf-couch': { bobo: { pos: [-2.5, 'cushion', -0.46], pose: 'loaf' }, decoy: { pos: [0.9, 'floor', -0.9], pose: 'sprawl' } },
  lineup: { bobo: { pos: [-0.3, 'rug', 0.35], pose: 'sit' }, decoy: { pos: [0.52, 'rug', 0.35], pose: 'sit' } },
  'hud-score': { bobo: { pos: [-0.3, 'rug', 0.35], pose: 'sit' }, decoy: { pos: [0.62, 'rug', 0.42], pose: 'sprawl' } },
  'hud-dag': { bobo: { pos: [-0.3, 'rug', 0.35], pose: 'sit' }, decoy: { pos: [0.62, 'rug', 0.42], pose: 'sprawl' } },
  win: { bobo: { pos: [0, 'rug', 0.55], pose: 'sit' }, decoy: { pos: [1.9, 'floor', -1.4], pose: 'sprawl' } },
};
function placeCats(moment) {
  const l = LAYOUT[moment] ?? LAYOUT.default;
  for (const [cat, spec] of [[bobo, l.bobo], [decoy, l.decoy]]) {
    const [x, support, z] = spec.pos;
    cat.root.position.set(x, SUPPORTS[support] ?? 0, z);
    cat.root.rotation.y = 0; // facing +z: toward the searching player
    setCatPose(cat, spec.pose);
  }
}

// ---------------------------------------------------------------------------
// 5. Celebration (src/celebrate.js): it rains little Bobo heads, plus two
//    firework bursts. Created now, hidden until a moment shows them.
// ---------------------------------------------------------------------------
const { rainHeads, rainMuzzles, rainDashes, bursts, updateRain, updateFireworks } = createCelebration(scene);

// ---------------------------------------------------------------------------
// 6. The HUD (design system §8). DOM, not geometry: crisp at every size and
//     free for the render budget. The strings are exact and selfTest checks them.
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
};
/** Which HUD parts are on screen in each moment, and the score it shows. */
const HUD_SPEC = {
  default: { score: false, scoreValue: 0, reticle: false, soft: false, dag: false, ending: false },
  'loaf-couch': { score: false, scoreValue: 0, reticle: false, soft: false, dag: false, ending: false },
  lineup: { score: false, scoreValue: 0, reticle: false, soft: false, dag: false, ending: false },
  'hud-score': { score: true, scoreValue: 3, reticle: true, soft: false, dag: false, ending: false },
  'hud-dag': { score: true, scoreValue: 3, reticle: true, soft: true, dag: true, ending: false },
  win: { score: true, scoreValue: 10, reticle: false, soft: false, dag: false, ending: true },
};

function applyHud() {
  const spec = HUD_SPEC[momentName] ?? HUD_SPEC.default;
  score = spec.scoreValue;
  el.score.classList.toggle('show', spec.score);
  el.scoreNum.textContent = String(score).padStart(2, '0');
  el.reticle.classList.toggle('show', spec.reticle);
  el.reticle.classList.toggle('soft', spec.soft);
  el.dag.style.display = spec.dag ? 'block' : 'none';
  el.ending.classList.toggle('show', spec.ending);
  el.veil.classList.toggle('show', spec.ending);
  el.ending.textContent = ENDING_TEXT;
  el.dagLabel.textContent = EXACT_DAG;
  const win = momentName === 'win';
  for (const m of [rainHeads, rainMuzzles, rainDashes]) m.visible = win;
  for (const b of bursts) b.mesh.visible = win;
}

/** The frame is a pure function of t: nothing here reads the wall clock. */
function applyTime(t) {
  seekTime = t;
  // Bobo: a tail that flicks and a head that looks around, out of the same sine
  const bp = bobo.pivots[bobo.current];
  if (bp) {
    bp.tailPivot.rotation.y = Math.sin(t * 1.7) * 0.14;
    bp.head.rotation.y = Math.sin(t * 0.85 + 0.4) * 0.09;
    bp.head.rotation.x = bp.baseHeadX + Math.sin(t * 0.6) * 0.025;
  }
  // The decoy: a slow, heavy breath. Sideways, never vertical: a belly that
  // scaled in y would sink into the rug and the contact checks would (rightly)
  // call that a float/sink bug.
  const dp = decoy.pivots[decoy.current];
  if (dp) {
    const base = dp.body.userData.baseScale ?? (dp.body.userData.baseScale = dp.body.scale.clone());
    const s = Math.sin(t * 1.1);
    dp.body.scale.set(base.x * (1 + 0.03 * s), base.y, base.z * (1 + 0.022 * s));
    dp.shells[0].scale.copy(dp.body.scale).multiplyScalar(1.045);
  }
  // "DAG!" eases in and stays: the penalty is a joke, not a punishment
  if ((HUD_SPEC[momentName] ?? HUD_SPEC.default).dag) {
    const k = clamp((t - 0.7) / 0.5, 0, 1);
    const s = k <= 0 ? 0.001 : easeOutBack(k);
    el.dag.style.transform = `translate(-50%, -50%) scale(${s.toFixed(4)})`;
    el.dag.style.opacity = k.toFixed(4);
  }
  if (momentName === 'win') {
    updateRain(t);
    updateFireworks(t);
  }
}

function applyView(name) {
  const v = V[name];
  camera.position.set(v.pos[0], v.pos[1], v.pos[2]);
  camera.fov = v.fov;
  camera.updateProjectionMatrix();
  camera.lookAt(v.look[0], v.look[1], v.look[2]);
}
function updateLabel() {
  el.label.textContent = `${momentName}  ·  ${viewName}  ·  t=${seekTime.toFixed(2)}s`;
}
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
  camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------------------
// 7. selfTest. Every number is measured back out of the built geometry (and
//    the built DOM), so a check can actually fail — including the checks that
//    say "Bobo and the decoy are instantly distinguishable", which is the
//    whole art-direction problem of this game. The measuring itself lives in
//    src/measure.js; the expectations it measures against are art data.
// ---------------------------------------------------------------------------
/** Everything a frame's state must be reproducible from: moments and seeks are
 *  only order-independent if this string comes back identical. */
function poseSignature() {
  const bp = bobo.pivots[bobo.current];
  const dp = decoy.pivots[decoy.current];
  const spec = HUD_SPEC[momentName];
  return [
    momentName, bobo.current, decoy.current,
    bobo.root.position.toArray(), decoy.root.position.toArray(),
    bp ? [bp.tailPivot.rotation.y, bp.head.rotation.y] : [],
    dp ? [dp.body.scale.x, dp.body.scale.z] : [],
    spec.score, spec.reticle, spec.soft, spec.dag, spec.ending,
    rainHeads.visible, bursts[0].mesh.visible,
  ].flat().map((x) => round(x)).join('|');
}
function applyMoment(id) {
  if (!LAYOUT[id]) throw new Error(`Unknown moment "${id}". Declared: ${MOMENTS.join(', ')}`);
  momentName = id;
  placeCats(id);
  applyHud();
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

  // --- the tells: is it Bobo? (docs/ART_STYLE.md §5, docs/DECOY_CAT.md) -----
  const bb = scanMarkings(bobo, bobo.current);
  const dd = scanMarkings(decoy, decoy.current);
  add('bobo-dash-white', bb.dash, '≥6 white vertices', bb.dash >= 6, `forehead dash on ${bobo.current}, moment ${momentName}`);
  add('decoy-no-dash', dd.dash, 'exactly 0', dd.dash === 0, 'the decoy must NOT have the dash');
  add('bobo-bib-white', bb.bib, '≥40 white vertices', bb.bib >= 40, 'the chest bib is Bobo-only');
  add('decoy-no-bib', dd.bib, 'exactly 0', dd.bib === 0, 'the decoy has no bib (issue #34)');
  add('bobo-head-white', bb.headWhite, '≥25 white vertices', bb.headWhite >= 25, 'muzzle + dash paint on Bobo’s head');
  add('decoy-head-black', dd.headWhite, 'exactly 0', dd.headWhite === 0, 'no white muzzle on the decoy (issue #34)');
  add('decoy-neck-black', dd.neckWhite, 'exactly 0', dd.neckWhite === 0, 'the neck band is gone — white on his feet only');
  add('bobo-neck-black', bb.neckWhite, 'exactly 0', bb.neckWhite === 0, 'Bobo never had neck white');
  add('white-feet-both', `${bb.feet}/${dd.feet}`, '≥2 white foot parts on each cat', bb.feet >= 2 && dd.feet >= 2, 'the one marking both cats keep');

  // the dash is the tell that matters: it must read at searching distance
  const nearPx = projectedPx(bb.dashExtent, 2.5, 60);
  const farPx = projectedPx(bb.dashExtent, 6, 60);
  add(
    'dash-legibility-near',
    nearPx,
    '≥20 px at 2.5 m (1080p, fov 60)',
    nearPx >= 20,
    `dash is ${round(bb.dashExtent * 1000)} mm across`,
  );
  add('dash-legibility-far', farPx, '≥8 px at 6 m (1080p, fov 60)', farPx >= 8, 'the tell survives across the room');
  add(
    'cats-distinguishable',
    `dash ${bb.dash}>0 bib ${bb.bib}>0 · decoy dash ${dd.dash}, bib ${dd.bib}, neck ${dd.neckWhite}, head white ${dd.headWhite} · feet ${bb.feet}/${dd.feet}`,
    'dash + bib on Bobo only; decoy black except his feet',
    bb.dash > 0 &&
      dd.dash === 0 &&
      bb.bib > 0 &&
      dd.bib === 0 &&
      bb.headWhite > 0 &&
      dd.headWhite === 0 &&
      bb.neckWhite === 0 &&
      dd.neckWhite === 0 &&
      bb.feet > 0 &&
      dd.feet > 0,
    'one builder, different marking rules (issue #34: the decoy keeps white on his feet only)',
  );

  // --- the size tell: 22 lb vs 15 lb, measured as built --------------------
  const bbBox = new THREE.Box3().setFromObject(bobo.poses.sit).getSize(new THREE.Vector3());
  const ddBox = new THREE.Box3().setFromObject(decoy.poses.sit).getSize(new THREE.Vector3());
  const widthRatio = ddBox.x / bbBox.x;
  const volumeRatio = (ddBox.x * ddBox.y * ddBox.z) / (bbBox.x * bbBox.y * bbBox.z);
  add('size-tell-width', widthRatio, '≥1.25× as wide', widthRatio >= 1.25, 'both cats measured in the same pose');
  add('size-tell-volume', volumeRatio, '≥1.35× the bulk', volumeRatio >= 1.35, 'the decoy reads as heavy, not tall');

  // --- the rest of the cats' faces ---------------------------------------
  const irisOk = new THREE.Color(TOKENS.eyes);
  const irisMat = bobo.mats.iris;
  add(
    'eye-colour-token',
    `${irisMat.color.r.toFixed(3)},${irisMat.color.g.toFixed(3)},${irisMat.color.b.toFixed(3)}`,
    `the ${TOKENS.eyes.toString(16)} token`,
    Math.abs(irisMat.color.r - irisOk.r) < 1e-6 && Math.abs(irisMat.color.b - irisOk.b) < 1e-6,
    'yellow-green, from Brandon’s photo',
  );
  add('whiskers-present', bb.whiskers, '6 segments', bb.whiskers === 6, 'white whiskers, from the photo');
  add('fuzz-shell-budget', bb.shells, '≤2 silhouette shells per cat', bb.shells <= 2 && dd.shells <= 2, 'the soft look costs two draws');

  // --- feet on surfaces ---------------------------------------------------
  for (const cat of [bobo, decoy]) {
    const { gap, support, who } = contactGap(cat, (LAYOUT[momentName] ?? LAYOUT.default)[cat.kind].pos[1], SUPPORTS);
    add(
    `${cat.kind}-contact`,
    gap,
    '-0.001..+0.002 m',
    gap >= -0.001 && gap <= 0.002,
    `${cat.current}: lowest part "${who}" on ${support}, moment ${momentName}`,
  );
  }
  const inRoom = [bobo, decoy].every((c) => Math.abs(c.root.position.x) < 3.1 && Math.abs(c.root.position.z) < 2.5);
  add('cats-in-room', inRoom ? 'inside' : 'outside', 'inside the walls', inRoom, null);

  // --- the look: values, not vibes ---------------------------------------
  const furLuma = srgbLuma(TOKENS.furBlack);
  add('fur-not-pure-black', furLuma, '≥0.004 luma', furLuma >= 0.004, 'a black coat must still hold a highlight');
  const whiteOnBlack = contrast(TOKENS.furWhite, TOKENS.furBlack);
  add('marking-contrast', whiteOnBlack, '≥10:1 white on black', whiteOnBlack >= 10, 'the tells read as values');
  const uiPairs = [
    ['paper/ink', contrast(TOKENS.uiPaper, TOKENS.uiInk)],
    ['mustard/ink', contrast(TOKENS.uiMustard, TOKENS.uiInk)],
    ['coral/ink', contrast(TOKENS.uiCoral, TOKENS.uiInk)],
  ].map(([n, c]) => [n, c]);
  const worstUi = uiPairs.reduce((a, b) => (b[1] < a[1] ? b : a));
  add('ui-contrast', worstUi[1], '≥4.5:1 (WCAG AA)', worstUi[1] >= 4.5, `worst pair ${worstUi[0]} of ${uiPairs.map((p) => `${p[0]} ${p[1].toFixed(1)}`).join(', ')}`);
  add(
    'filmic-tonemap',
    renderer.toneMapping === THREE.ACESFilmicToneMapping ? 'ACES' : String(renderer.toneMapping),
    'ACESFilmic',
    renderer.toneMapping === THREE.ACESFilmicToneMapping,
    'the sunlit window must roll off, not clip',
  );
  add(
    'sun-through-window',
    `z=${sun.position.z.toFixed(1)}, y=${sun.position.y.toFixed(1)}`,
    'outside the far wall and above it',
    sun.position.z < WALL_Z && sun.position.y > 2,
    'one shadow-casting light: the window sun',
  );

  // --- the HUD, exact strings --------------------------------------------
  add('ending-text-exact', el.ending.textContent, `exactly "${EXACT_ENDING}"`, el.ending.textContent === EXACT_ENDING, 'story-fixed, never corrected');
  add('dag-text-exact', el.dagLabel.textContent, `exactly "${EXACT_DAG}"`, el.dagLabel.textContent === EXACT_DAG, 'wrong-cat line, never corrected');
  const endingShown = getComputedStyle(el.ending).display !== 'none';
  add('ending-visibility', endingShown ? 'shown' : 'hidden', spec.ending ? 'shown' : 'hidden', endingShown === spec.ending, null);
  const dagShown = el.dag.style.display !== 'none';
  add('dag-visibility', dagShown ? 'shown' : 'hidden', spec.dag ? 'shown' : 'hidden', dagShown === spec.dag, null);
  const scoreShown = el.score.classList.contains('show');
  add('hud-score-visibility', scoreShown ? 'shown' : 'hidden', spec.score ? 'shown' : 'hidden', scoreShown === spec.score, `value ${score}/10`);
  const scoreText = el.score.textContent;
  add(
    'hud-score-format',
    scoreText,
    scoreShown ? /^\d{2} \/ 10$/ : 'hidden',
    !scoreShown || /^\d{2} \/ 10$/.test(scoreText),
    'zero-padded count-up out of 10',
  );
  const softOk = el.reticle.classList.contains('soft') === spec.soft;
  add('reticle-state', el.reticle.classList.contains('soft') ? 'coral' : 'calm', spec.soft ? 'coral' : 'calm', softOk, 'gentle coral for the wrong cat, never red');

  // --- the contract -------------------------------------------------------
  const positions = Object.values(V).map((v) => new THREE.Vector3(...v.pos));
  let minDist = Infinity;
  let closestPair = '';
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const d = positions[i].distanceTo(positions[j]);
      if (d < minDist) {
        minDist = d;
        closestPair = `${Object.keys(V)[i]}/${Object.keys(V)[j]}`;
      }
    }
  }
  add('views-distinct', minDist, '≥0.5 m apart', minDist >= 0.5 && Object.keys(V).length >= 4, `closest pair: ${closestPair}`);

  // seek() is repeatable: go away and come back, the pose must be identical
  const t0 = seekTime;
  const m0 = momentName;
  const sigBefore = poseSignature();
  const other = MOMENTS.find((m) => m !== m0) ?? m0;
  applyMoment(other);
  applyTime(clamp(t0 + 1.31, 0, DURATION));
  applyMoment(m0);
  applyTime(t0);
  add('seek-repeatable', sigBefore === poseSignature() ? 0 : 1, '≤1e-9', sigBefore === poseSignature(), `pose at t=${round(t0)} before vs after visiting "${other}"`);

  // moments are random-order-compatible (they are drawn in random order in play)
  const order = momentOrderIndependence();
  add(
    'moment-order-independent',
    order.worstDiff,
    '≤1e-9',
    order.worstDiff <= 1e-9,
    `${order.visits} visits, declared order vs a seeded shuffle${order.worst ? ` (worst: ${order.worst})` : ''}`,
  );
  add('seek-no-unseeded-random', countUnseededCalls(), '0 calls', countUnseededCalls() === 0, 'Math.random / Date.now inside seek / setMoment');
  add('duration-positive', DURATION, '>0 s', DURATION > 0, null);

  const stats = window.LC?.getStats ? window.LC.getStats() : { drawCalls: 0 };
  add('stats-available', stats.drawCalls, '>0 draw calls', stats.drawCalls > 0, 'render once before getStats means anything');
  add(
    'lighting-budget-intent',
    `${stats.realLights} lights / ${stats.shadowLights} shadow`,
    '≤6 lights, ≤1 shadow light by design',
    stats.realLights <= 6 && stats.shadowLights <= 1,
    'window sun + sky fill + one warm lamp',
  );

  restoreAfterSelfTest();
  return { pass: checks.every((c) => c.pass), checks };
}
function restoreAfterSelfTest() {
  applyMoment(state.moment);
  applyTime(state.time);
  applyView(state.view);
  updateLabel();
}

// ---------------------------------------------------------------------------
// 8. The window.LC contract (docs/CAPTURE.md), so the Step 2 tool can drive
//    this page exactly like the test scene.
// ---------------------------------------------------------------------------
const state = { moment: 'default', time: 0, view: 'diorama', playing: false };
let viewName = 'diorama';

function clampTime(t) {
  const n = Number(t);
  return Number.isFinite(n) ? clamp(n, 0, DURATION) : 0;
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
        applyTime(state.time);
        updateLabel();
      });
    },
    play() {
      if (state.playing) return;
      state.playing = true;
      renderer.setAnimationLoop(() => {
        state.time = clampTime(state.time + 1 / 60);
        applyTime(state.time);
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
        passes: 1, // the scene only: no post-processing in the chosen look (ART_STYLE.md §7)
        realLights,
        shadowLights,
      };
    },
    selfTest,

    // --- extensions this project uses
    moments: MOMENTS.slice(),
    moment() {
      return { id: state.moment, support: LAYOUT[state.moment].bobo.pos[1], hud: HUD_SPEC[state.moment] };
    },
    setMoment(id) {
      measured(() => {
        applyMoment(id);
        state.moment = id;
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
      return { moment: state.moment, time: state.time, view: state.view, playing: state.playing, duration: DURATION, plant: PLANT };
    },
    camera(name = state.view) {
      const v = V[name];
      return { name, position: v.pos.slice(), look: v.look.slice(), fov: v.fov };
    },
    endingText: EXACT_ENDING,
    dagText: EXACT_DAG,
    /** The style tokens, exported so the finished game and the docs import one
     *  source instead of copying hexes around. */
    tokens: TOKENS,
    styleName: 'Sunny Room, Soft Fur',
    plant: PLANT,
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

// Fault injection, applied after the scene is built so selfTest has something to
// catch. The source stays correct; the fault only exists in the URL.
if (PLANT === 'dash') {
  // Bobo's dash rule is switched off: the tell disappears and the checks must say so.
  for (const pose of CAT_SPECS.bobo.poses) {
    const rules = rulesBobo(pose);
    paintPose(bobo, pose, { head: rules.head.filter((r) => r.name !== 'dash'), body: rules.body }, bobo.pivots[pose].head);
  }
} else if (PLANT === 'neck') {
  // Issue #34's absence proof has to bite too: paint the OLD white neck band
  // back onto the decoy, over the exact zones src/measure.js counts as his
  // neck, and `decoy-neck-black` + `cats-distinguishable` must fail.
  for (const pose of CAT_SPECS.decoy.poses) {
    const zone = NECK_ZONE_EXPECT[pose] ?? NECK_ZONE_EXPECT.sit;
    paintPose(
      decoy,
      pose,
      { head: [], body: [{ sdf: (p) => ellSDF(p, zone.c, zone.h), name: 'neck-fault' }] },
      decoy.pivots[pose].head,
    );
  }
} else if (PLANT === 'size') {
  // applied where the decoy is built: the 22 lb cat shrinks to Bobo's size
} else if (PLANT === 'text') {
  // the joke "fixed": ending-text-exact must fail on every frame
  ENDING_TEXT = 'you did it! you win';
} else if (PLANT && PLANT !== 'none' && PLANT !== 'stats') {
  console.warn(`Unknown plant "${PLANT}". Use dash, neck, size, text or stats.`);
}

function boot() {
  applyMoment(state.moment);
  applyTime(0);
  applyView(state.view);
  updateLabel();
  resize();
  renderer.render(scene, camera);
  installContract();
  if (PLANT === 'stats') {
    const honest = window.LC.getStats;
    window.LC.getStats = () => ({ ...honest(), drawCalls: 1, triangles: 1, realLights: 0, shadowLights: 0, passes: 0 });
  }
  window.LC.ready = true;
  window.addEventListener('resize', () => {
    lastWidth = 0;
    resizeIfNeeded();
  });
  console.info(
    `[look-at-bobo] style test "${window.LC.styleName}" ready — ${window.LC.moments.length} moments, ${window.LC.views.length} views, ${DURATION}s loop.`,
  );
}

try {
  boot();
} catch (err) {
  window.LCError = `${err && err.message ? err.message : err}\n${err && err.stack ? err.stack : ''}`;
  el.boot.style.display = 'block';
  el.boot.textContent = `Style test scene failed to start:\n${window.LCError}`;
  console.error(err);
}
