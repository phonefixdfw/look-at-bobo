// tools/testscene/testscene.js — the window.LC page contract, on a trivial scene.
//
// What this proves: any moment, time and view can be jumped to in any order, the
// frame is a pure function of (moment, view, t), and the numbers say whether the
// geometry is actually correct. Nothing in here is art direction (that is Step 3):
// a floor, a box, a stick leaning on the box, a capsule standing in for Bobo and a
// "clock hand" so the time of a frame is visible.
//
// Contact math is authored with literal numbers and then *measured back* out of the
// built geometry, so selfTest can catch a mistake instead of restating the intent.

import * as THREE from 'three';

/** The ending text is fixed by the story. Exact. On purpose. Never "fixed". */
const EXACT_ENDING = 'your did it! you wind';

const params = new URLSearchParams(location.search);
/** Fault injection, so the gate can be re-proved at any time.
 *  ?plant=lift | sink | jam | text  — each one breaks exactly one check. */
const PLANT = params.get('plant');

const DURATION = 6; // seconds, the loop length of the placeholder animation
const FLOOR_Y = 0;
const FLOOR_SIZE = 6;
const BOBO_RADIUS = 0.12;

// Authored (not derived) placement of the stick, matching a correctly placed box.
const STICK_FOOT = new THREE.Vector3(0.85, 0.0, 0.0);
const STICK_TIP = new THREE.Vector3(0.3, 0.4, 0.0);

/** The ten placeholder moments from docs/STORY.md, as trivial placements.
 *  Each one is independent: it only sets Bobo's pose, so any moment can be
 *  visited in any order (moments appear in random order in the game). */
const MOMENTS = [
  { id: 'default', area: 'open floor', bobo: [0.95, 0.75], support: 'floor', yaw: 0.6 },
  { id: 'lounging-couch', area: 'living area', bobo: [-1.7, 1.25], support: 'floor', yaw: -0.4 },
  { id: 'stretching-bed', area: 'bedroom', bobo: [1.75, 1.4], support: 'floor', yaw: 2.2 },
  { id: 'window-bird', area: 'window', bobo: [-1.15, -2.25], support: 'floor', yaw: 3.05 },
  { id: 'cardboard-box', area: 'living area', bobo: [0.0, 0.0], support: 'box-top', yaw: 0.9 },
  { id: 'sink', area: 'kitchen/bathroom (TBD)', bobo: [2.25, -1.15], support: 'floor', yaw: 1.1 },
  { id: 'batting-pen', area: 'desk', bobo: [-0.85, 0.9], support: 'floor', yaw: -1.2 },
  { id: 'laundry-basket', area: 'bedroom (TBD)', bobo: [-2.25, -0.45], support: 'floor', yaw: 2.8 },
  { id: 'hallway-roll', area: 'hallway', bobo: [0.2, 2.4], support: 'floor', yaw: 0.2 },
  { id: 'blanket-biscuits', area: 'bed/couch (TBD)', bobo: [1.45, -2.3], support: 'floor', yaw: -2.4 },
  { id: 'keyboard', area: 'desk', bobo: [-0.45, -1.65], support: 'floor', yaw: -0.15 },
  { id: 'win', area: 'ending', bobo: [0.0, 1.15], support: 'floor', yaw: 0.0, ending: true },
];
const MOMENT_BY_ID = new Map(MOMENTS.map((m) => [m.id, m]));

/** Camera views. Placeholder framing only — first-person height (1.6 m) is the
 *  one number here that is a real decision from the vision. */
const VIEWS = {
  overview: { pos: [2.55, 1.75, 2.9], look: [0, 0.3, 0], fov: 50 },
  contact: { pos: [1.02, 0.34, 0.62], look: [0.33, 0.26, 0], fov: 40 },
  top: { pos: [0, 3.2, 0.02], look: [0, 0, 0], fov: 60 },
  'first-person': { pos: [-0.55, 1.6, 2.5], look: [0, 0.35, 0], fov: 60 },
};

// --- determinism guard -------------------------------------------------------
// Scene logic must never reach for unseeded randomness or wall-clock time, or a
// capture at t=2.4 stops being identical every time. Anything that happens inside
// seek()/setMoment() is counted and reported by selfTest. (Three.js itself may use
// Math.random to build UUIDs when objects are *created*; that is outside these
// calls and is not a determinism problem for a frame.)
let unseededCalls = 0;
let measuring = 0;
const nativeRandom = Math.random;
Math.random = (...args) => {
  if (measuring) unseededCalls++;
  return nativeRandom(...args);
};
const nativeDateNow = Date.now;
Date.now = () => {
  if (measuring) unseededCalls++;
  return nativeDateNow();
};
const measured = (fn) => {
  measuring++;
  try {
    return fn();
  } finally {
    measuring--;
  }
};

// --- state -------------------------------------------------------------------
const state = {
  moment: MOMENT_BY_ID.get('default'),
  time: 0,
  view: 'overview',
  playing: false,
};

const labelEl = document.getElementById('moment-label');
const endingEl = document.getElementById('ending');
const bootEl = document.getElementById('boot-error');
const canvas = document.getElementById('view');

let renderer;
let scene;
let camera;
let floor;
let box;
let stick;
let stickFootMarker;
let stickTipMarker;
let bobo;
let clockHand;

try {
  build();
  installContract();
  window.LC.ready = true;
  updateLabel();
} catch (err) {
  window.LCError = `${err && err.message ? err.message : err}\n${err && err.stack ? err.stack : ''}`;
  bootEl.style.display = 'block';
  bootEl.textContent = `Test scene failed to start:\n${window.LCError}`;
}

// --- build -------------------------------------------------------------------

function build() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(1); // fixed, so captures are pixel-exact on any display
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9aa3ad);

  camera = new THREE.PerspectiveCamera(50, 1, 0.05, 100);

  // One directional light with shadows + one hemisphere fill: 1 shadow-casting
  // light and 1 "real" light, well inside the budget.
  const hemi = new THREE.HemisphereLight(0xdfe7f0, 0x555a60, 0.55);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(2.5, 4, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -4;
  sun.shadow.camera.right = 4;
  sun.shadow.camera.top = 4;
  sun.shadow.camera.bottom = -4;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 12;
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  // Floor, at exactly y = 0.
  floor = new THREE.Mesh(
    new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE),
    new THREE.MeshStandardMaterial({ color: 0x8d8f94, roughness: 0.95, metalness: 0 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Metre grid: a debugging aid, so placements and clipping are visible in a frame.
  const grid = new THREE.GridHelper(FLOOR_SIZE, FLOOR_SIZE, 0x5f656c, 0x767c83);
  grid.position.y = FLOOR_Y + 0.001;
  scene.add(grid);

  // The box: 0.6 x 0.4 x 0.4, bottom sitting on the floor (centre at half height).
  box = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.4, 0.4),
    new THREE.MeshStandardMaterial({ color: 0xb9a37c, roughness: 0.85, metalness: 0 }),
  );
  box.position.set(0, 0.2, 0);
  box.castShadow = true;
  box.receiveShadow = true;
  scene.add(box);

  // The stick: built from the two authored endpoints, so its own length is derived
  // from them but its placement is not. The stick never follows the box, so if the
  // box is ever moved, the numbers show it instead of the eye forgiving it.
  const dir = new THREE.Vector3().subVectors(STICK_TIP, STICK_FOOT);
  const length = dir.length();
  stick = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, length, 0.03),
    new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.6, metalness: 0.1 }),
  );
  stick.position.copy(STICK_FOOT).addScaledVector(dir, 0.5);
  stick.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  stick.castShadow = true;
  stick.receiveShadow = true;
  stickFootMarker = new THREE.Object3D();
  stickFootMarker.position.set(0, -length / 2, 0);
  stickTipMarker = new THREE.Object3D();
  stickTipMarker.position.set(0, length / 2, 0);
  stick.add(stickFootMarker, stickTipMarker);
  scene.add(stick);

  // Bobo placeholder: a capsule lying on its side in a yaw group. Deliberately not
  // a cat — Step 3+ builds Bobo in code from Brandon's description.
  bobo = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(BOBO_RADIUS, 0.28, 8, 20),
    new THREE.MeshStandardMaterial({ color: 0x2f3238, roughness: 0.9, metalness: 0 }),
  );
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  bobo.add(body);
  scene.add(bobo);

  // Clock hand: sweeps once per loop so the moment in time is visible in a frame
  // (and so a bad seek() shows up as a wrong-looking capture, not a silent one).
  const clockPivot = new THREE.Group();
  clockPivot.position.set(1.55, 0.02, -0.6);
  clockHand = new THREE.Group();
  const hand = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.02, 0.035),
    new THREE.MeshStandardMaterial({ color: 0xd9552f, roughness: 0.7 }),
  );
  hand.position.set(0.25, 0, 0);
  hand.castShadow = true;
  clockHand.add(hand);
  clockPivot.add(clockHand);
  scene.add(clockPivot);

  applyMoment(state.moment);
  applyTime(0);
  applyView('overview');

  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    window.LCError = 'WebGL context lost';
  });

  addEventListener('resize', resize);
  resize();
}

function resize() {
  const w = Math.max(1, canvas.clientWidth || window.innerWidth);
  const h = Math.max(1, canvas.clientHeight || window.innerHeight);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

// --- pure state setters (moment, time, view) ---------------------------------

function clampTime(t) {
  const n = Number(t);
  if (!Number.isFinite(n)) return state.time;
  return ((n % DURATION) + DURATION) % DURATION;
}

function applyMoment(moment) {
  const supportY = moment.support === 'box-top' ? boxTopY() : FLOOR_Y;
  bobo.position.set(moment.bobo[0], supportY + BOBO_RADIUS, moment.bobo[1]);
  bobo.rotation.y = moment.yaw;
  endingEl.classList.toggle('show', Boolean(moment.ending));
}

function applyTime(t) {
  const phase = (t / DURATION) * Math.PI * 2;
  bobo.rotation.y = state.moment.yaw + 0.22 * Math.sin(phase);
  clockHand.rotation.y = phase;
}

function applyView(name) {
  const view = VIEWS[name];
  camera.position.set(...view.pos);
  camera.lookAt(new THREE.Vector3(...view.look));
  camera.fov = view.fov;
  camera.updateProjectionMatrix();
}

function updateLabel() {
  const plant = PLANT ? ` · plant=${PLANT}` : '';
  labelEl.textContent = `${state.moment.id} · ${state.moment.area} · t=${state.time.toFixed(2)}s · ${state.view}${plant}`;
}

// --- measurement helpers -----------------------------------------------------

function worldOf(object) {
  return object.getWorldPosition(new THREE.Vector3());
}

function boxWorld() {
  return new THREE.Box3().setFromObject(box);
}

function boboWorld() {
  return new THREE.Box3().setFromObject(bobo);
}

function boxTopY() {
  return boxWorld().max.y;
}

/** How deep a point sits inside a box (> 0 = inside, < 0 = outside, by the nearest face). */
function depthInsideBox(box3, point) {
  const dx = Math.min(point.x - box3.min.x, box3.max.x - point.x);
  const dy = Math.min(point.y - box3.min.y, box3.max.y - point.y);
  const dz = Math.min(point.z - box3.min.z, box3.max.z - point.z);
  return Math.min(dx, dy, dz);
}

/** Clipping check: the stick's axis may *touch* the box, it must not run into it.
 *  A distance-only check cannot tell touching from buried, so this walks the axis. */
function stickAxisPenetration() {
  const a = worldOf(stickFootMarker);
  const b = worldOf(stickTipMarker);
  const box3 = boxWorld();
  const length = a.distanceTo(b);
  const steps = 64;
  const eps = 0.001; // 1 mm of tolerance on the touch itself
  let count = 0;
  let deepest = 0;
  const point = new THREE.Vector3();
  for (let i = 0; i <= steps; i++) {
    const s = i / steps;
    if (length * (1 - s) <= 2 * eps) break; // stop at the contact point
    point.lerpVectors(a, b, s);
    const depth = depthInsideBox(box3, point);
    if (depth > eps) {
      count++;
      deepest = Math.max(deepest, depth);
    }
  }
  return { count, deepest };
}

/** A number-only fingerprint of where things are, for order/independence checks. */
function poseSignature() {
  const parts = [];
  for (const [name, object] of [
    ['box', box],
    ['foot', stickFootMarker],
    ['tip', stickTipMarker],
    ['bobo', bobo],
  ]) {
    const p = worldOf(object);
    parts.push(p.x, p.y, p.z, name === 'bobo' ? bobo.rotation.y : 0);
  }
  const bb = boboWorld();
  parts.push(bb.min.y, bb.max.y);
  return parts;
}

function maxSignatureDiff(a, b) {
  let worst = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    worst = Math.max(worst, Math.abs((a[i] ?? 0) - (b[i] ?? 0)));
  }
  return worst;
}

/** Fixed-seed shuffle: deterministic, so this check itself cannot flicker. */
function seededShuffle(items, seed = 0x5eed) {
  let s = seed >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// --- the checks --------------------------------------------------------------

function selfTest() {
  const checks = [];
  // Render once first: getStats() is only meaningful after a frame has been drawn.
  renderer.render(scene, camera);
  const add = (name, value, limit, pass, note) =>
    checks.push({ name, value: round(value), limit, pass: Boolean(pass), note: note ?? null });

  const gapEps = 0.001; // 1 mm
  const box3 = boxWorld();
  const bobo3 = boboWorld();

  // 1. The box must rest on the floor, not float and not sink.
  const boxGap = box3.min.y - FLOOR_Y;
  add('box-bottom-to-floor', boxGap, '±0.001 m', Math.abs(boxGap) <= gapEps, 'signed gap box -> floor');

  // 2. The stick's foot must touch the floor.
  const foot = worldOf(stickFootMarker);
  const footGap = foot.y - FLOOR_Y;
  add('stick-foot-to-floor', footGap, '±0.001 m', Math.abs(footGap) <= gapEps, 'signed gap stick foot -> floor');

  // 3. The stick's tip must touch the box. (Distance alone cannot tell "touching"
  //    from "buried", which is what check 4 is for.)
  const tip = worldOf(stickTipMarker);
  const tipGap = box3.distanceToPoint(tip);
  add('stick-tip-touches-box', tipGap, '≤0.001 m', tipGap <= gapEps, 'distance stick tip -> box surface');

  // 4. ...and nothing may clip into the box.
  const penetration = stickAxisPenetration();
  add(
    'stick-no-box-clipping',
    penetration.deepest,
    '0 m (no clipping)',
    penetration.count === 0,
    penetration.count ? `${penetration.count} sample points of the stick axis are inside the box` : 'stick axis stays out of the box',
  );

  // 5. It should be leaning, not lying flat or standing on air.
  add('stick-tip-height', tip.y, '≥0.30 m', tip.y >= 0.3, 'the stick leans on the box');

  // 6. The built stick still matches its endpoints (no drift after transforms).
  const markerLen = tip.distanceTo(foot);
  const stickLen = stick.geometry.parameters.height ?? 0;
  add('stick-length-matches-markers', stickLen - markerLen, '±0.001 m', Math.abs(stickLen - markerLen) <= gapEps, 'geometry length vs measured');

  // 7. Bobo must be resting on his support for the current moment.
  const supportY = state.moment.support === 'box-top' ? box3.max.y : FLOOR_Y;
  const boboGap = bobo3.min.y - supportY;
  add(
    'bobo-support-gap',
    boboGap,
    '-0.001..+0.002 m',
    boboGap >= -gapEps && boboGap <= 0.002,
    `moment ${state.moment.id} on ${state.moment.support}`,
  );

  // 8. The ending text is exact, spelled "your did it! you wind".
  const text = endingEl.textContent;
  add('ending-text-exact', text, `exactly "${EXACT_ENDING}"`, text === EXACT_ENDING, 'story-fixed string, never corrected');

  // 9. ...and it is only on screen during the ending moment.
  const shown = getComputedStyle(endingEl).display !== 'none';
  add('ending-visibility', shown ? 'shown' : 'hidden', state.moment.ending ? 'shown' : 'hidden', shown === Boolean(state.moment.ending), null);

  // 10. Every declared view must be a genuinely different camera.
  const viewDists = viewSeparation();
  add('views-distinct', viewDists.minDistance, '≥0.05 m apart', viewDists.minDistance >= 0.05, `closest pair: ${viewDists.closestPair}`);

  // 11. seek() is repeatable: leaving and coming back gives the same pose.
  const repeatDiff = repeatability();
  add('seek-repeatable', repeatDiff, '≤1e-9', repeatDiff <= 1e-9, 'pose at t=1.25 before vs after seeking elsewhere');

  // 12. Moments are random-order-compatible: shuffled visits match canonical ones.
  const order = momentOrderIndependence();
  add(
    'moment-order-independent',
    order.worstDiff,
    '≤1e-9',
    order.worstDiff <= 1e-9,
    `${order.visits} visits in declared order vs a seeded shuffle${order.worst ? ` (worst: ${order.worst})` : ''}`,
  );

  // 13. Nothing in the seek path reached for randomness or wall-clock time.
  add('seek-no-unseeded-random', unseededCalls, '0 calls', unseededCalls === 0, 'Math.random / Date.now inside seek/setMoment');

  // 14. The loop is a real loop and the contract is complete.
  add('duration-positive', DURATION, '>0 s', DURATION > 0, null);
  add('stats-available', renderer.info.render.calls, '>0 draw calls', renderer.info.render.calls > 0, 'render at least once before getStats is meaningful');

  restoreAfterSelfTest();
  return { pass: checks.every((c) => c.pass), checks };
}

function viewSeparation() {
  const saved = camera.position.clone();
  const names = Object.keys(VIEWS);
  const positions = new Map();
  for (const name of names) {
    camera.position.set(...VIEWS[name].pos);
    positions.set(name, camera.position.clone());
  }
  let minDistance = Infinity;
  let closestPair = '-';
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const d = positions.get(names[i]).distanceTo(positions.get(names[j]));
      if (d < minDistance) {
        minDistance = d;
        closestPair = `${names[i]} / ${names[j]}`;
      }
    }
  }
  camera.position.copy(saved);
  return { minDistance, closestPair };
}

function repeatability() {
  applyMoment(state.moment);
  applyTime(1.25);
  const before = poseSignature();
  applyTime(4.1);
  applyMoment(MOMENTS[(MOMENTS.indexOf(state.moment) + 1) % MOMENTS.length]);
  applyTime(2.9);
  applyMoment(state.moment);
  applyTime(1.25);
  const after = poseSignature();
  return maxSignatureDiff(before, after);
}

function momentOrderIndependence() {
  const probeTime = 2.4;
  const canonical = new Map();
  for (const moment of MOMENTS) {
    applyMoment(moment);
    applyTime(probeTime);
    canonical.set(moment.id, poseSignature());
  }
  let worstDiff = 0;
  let worst = '';
  const shuffled = seededShuffle(MOMENTS);
  for (const moment of shuffled) {
    applyMoment(moment);
    applyTime(probeTime);
    const diff = maxSignatureDiff(canonical.get(moment.id), poseSignature());
    if (diff > worstDiff) {
      worstDiff = diff;
      worst = moment.id;
    }
  }
  return { worstDiff, worst, visits: MOMENTS.length * 2 };
}

function restoreAfterSelfTest() {
  applyMoment(state.moment);
  applyTime(state.time);
  applyView(state.view);
  updateLabel();
}

const round = (v) => (typeof v === 'number' ? Number(v.toPrecision(6)) : v);

// --- the contract ------------------------------------------------------------

function installContract() {
  window.LC = {
    // --- required by the page contract (docs/CAPTURE.md)
    ready: false,
    duration: DURATION,
    views: Object.keys(VIEWS),
    setView(name) {
      if (!VIEWS[name]) throw new Error(`Unknown view "${name}". Declared: ${Object.keys(VIEWS).join(', ')}`);
      state.view = name;
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
      // A fixed 1/60 s step per frame: playing never reads the wall clock.
      renderer.setAnimationLoop(() => {
        state.time = clampTime(state.time + 1 / 60);
        applyTime(state.time);
        updateLabel();
        renderer.render(scene, camera);
      });
    },
    pause() {
      state.playing = false;
      renderer.setAnimationLoop(null);
    },
    renderNow() {
      resizeIfNeeded();
      renderer.render(scene, camera);
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
        passes: 1, // one pass: the scene itself. Each post-processing pass must be added here.
        realLights,
        shadowLights,
      };
    },
    selfTest,

    // --- extensions this project uses (see docs/CAPTURE.md)
    /** Every moment the page can jump to, in the order declared above. */
    moments: MOMENTS.map((m) => m.id),
    moment() {
      return { id: state.moment.id, area: state.moment.area, support: state.moment.support, ending: Boolean(state.moment.ending) };
    },
    setMoment(id) {
      const moment = MOMENT_BY_ID.get(id);
      if (!moment) throw new Error(`Unknown moment "${id}". Declared: ${MOMENTS.map((m) => m.id).join(', ')}`);
      measured(() => {
        state.moment = moment;
        applyMoment(moment);
        applyTime(state.time);
        updateLabel();
      });
    },
    /** Jump anywhere in one call, then render: LC.goto('keyboard', 2.4). */
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
      return { moment: state.moment.id, time: state.time, view: state.view, playing: state.playing, duration: DURATION, plant: PLANT };
    },
    camera(name = state.view) {
      const v = VIEWS[name];
      return { name, position: v.pos.slice(), look: v.look.slice(), fov: v.fov };
    },
    /** The exact ending string, exported so other checks can compare against it. */
    endingText: EXACT_ENDING,
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
// catch. The scene files stay correct; the fault only exists in the URL.
if (PLANT === 'lift') box.position.y += 0.05; // 5 cm float -> box-bottom-to-floor
else if (PLANT === 'sink') box.position.y -= 0.02; // 2 cm sunk into the floor -> box-bottom-to-floor
else if (PLANT === 'jam') stick.position.x -= 0.1; // slide the stick into the box -> stick-no-box-clipping
else if (PLANT === 'text') endingEl.textContent = 'you did it! you win'; // the joke "fixed" -> ending-text-exact
else if (PLANT === 'stats') {
  // Advertise a frame cheaper than it is -> stats-understated
  const honest = window.LC.getStats;
  window.LC.getStats = () => ({ ...honest(), drawCalls: 1, triangles: 1 });
}
else if (PLANT && PLANT !== 'none') console.warn(`Unknown plant "${PLANT}". Use lift, sink, jam, text or stats.`);
