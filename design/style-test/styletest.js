// design/style-test/styletest.js — the Step 3 style test scene, "Sunny Room, Soft Fur".
//
// This is the REFERENCE IMPLEMENTATION of docs/ART_STYLE.md: the chosen look,
// built in code (Three.js, no downloads), proven with the Step 2 capture tool.
// Later code ports these functions (fur material, marking paint, lighting rig,
// HUD rules) instead of reinventing them.
//
// In the room:
//   - a slice of a believable, realistically lit modern apartment (floor, plaster
//     walls, a window with real sun through it, couch, rug, lamp, plant, box);
//   - BOBO (~15 lb) and the DECOY CAT (~22 lb) from ONE parametric cat builder:
//     the only difference between them is which marking rules are switched on
//     (forehead dash + chest bib + belly patch vs. a white neck collar);
//   - the HUD vocabulary: score pill, the gentle round X + "DAG!", and the win
//     celebration raining little Bobo heads with the exact ending text.
//
// It implements the window.LC page contract (docs/CAPTURE.md) on top of the
// test scene's patterns: determinism guards, order-independent moments, and a
// selfTest whose numbers are measured back out of the built geometry.

import * as THREE from 'three';

/** Fixed strings. Exact. On purpose. Never "fixed". */
const EXACT_ENDING = 'your did it! you wind';
const EXACT_DAG = 'DAG!';

const params = new URLSearchParams(location.search);
/** Fault injection, so the tell checks can be proven to bite:
 *  ?plant=dash  — Bobo's forehead-dash rule is switched off
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
// 1. Design tokens — the single source for colour (docs/ART_STYLE.md §2).
//    Everything built later imports this object; nothing is hard-coded twice.
// ---------------------------------------------------------------------------
export const TOKENS = {
  // fur
  furBlack: 0x1b1e26, // cool near-black, NOT pure black: keeps readable shading
  furSheen: 0x5a6480, // sunlit coat sheen (used as the material's specular tint)
  furWhite: 0xf1ece1, // warm white markings, never clinical white
  eyes: 0xb7c94b, // yellow-green (from Brandon's photo)
  pupil: 0x0c0e12,
  nose: 0xd18b8b,
  earInner: 0x61494a,
  whisker: 0xf6f2ea,
  // room
  oakFloor: 0xa87c52,
  plaster: 0xd9d3c7,
  rug: 0xa99a83,
  couch: 0x3f4650,
  pillow: 0xd9a441,
  walnut: 0x6b4a30,
  leaf: 0x4f7a4a,
  metal: 0x23262b,
  cardboard: 0xc19a67,
  lampShade: 0xf2e6cf,
  sky: 0xbfd8ea,
  // UI (also in style-test.html CSS custom properties — they must match)
  uiInk: 0x10151c,
  uiPaper: 0xf7f4ee,
  uiMustard: 0xe8b04a,
  uiCoral: 0xff8f7d,
  uiGlow: 0xffd98a,
};

const V = {
  diorama: { pos: [3.0, 2.0, 3.3], look: [-0.4, 0.55, -0.5], fov: 48 },
  'first-person': { pos: [0.75, 1.6, 2.3], look: [-0.15, 0.8, -1.0], fov: 60 },
  'cats-close': { pos: [0.15, 0.42, 1.45], look: [0.05, 0.34, 0.3], fov: 36 },
  'bobo-face': { pos: [-0.3, 0.4, 0.98], look: [-0.3, 0.36, 0.3], fov: 22 },
};
const MOMENTS = ['default', 'loaf-couch', 'lineup', 'hud-score', 'hud-dag', 'win'];

// ---------------------------------------------------------------------------
// 2. Small helpers (all deterministic — no Math.random anywhere).
// ---------------------------------------------------------------------------
const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const easeOutCubic = (u) => 1 - Math.pow(1 - u, 3);
const easeOutBack = (u) => 1 + 2.2 * Math.pow(u - 1, 3) + 1.3 * Math.pow(u - 1, 2);
function fract(x) { return x - Math.floor(x); }
/** 0 outside, 1 inside, smoothed over `eps` at the boundary. */
function sdfInside(d, eps) { return clamp(0.5 - d / eps, 0, 1); }
function hash1(n) { return fract(Math.sin(n * 127.1 + 311.7) * 43758.5453); }
function seededShuffle(arr, seed) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(hash1(seed * 131.1 + i * 7.13) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Determinism guards, same as the Step 2 test scene: a call inside the seek/
// render path that reaches for unseeded randomness or the wall clock is counted
// (selfTest fails on it) and a render-time call throws outright.
const REAL_RANDOM = Math.random;
const REAL_DATE_NOW = Date.now;
const REAL_NOW = performance.now.bind(performance);
let unseededCalls = 0;
let measuring = 0;
let rendering = false;
Math.random = (...args) => {
  if (measuring) unseededCalls++;
  if (rendering) throw new Error('Math.random() called during render: the frame is not deterministic');
  return REAL_RANDOM(...args);
};
Date.now = () => {
  if (measuring) unseededCalls++;
  return REAL_DATE_NOW();
};
performance.now = () => {
  if (rendering) throw new Error('performance.now() called during render: the frame is not deterministic');
  return REAL_NOW();
};
const measured = (fn) => {
  measuring++;
  try {
    return fn();
  } finally {
    measuring--;
  }
};

// ---------------------------------------------------------------------------
// 3. Renderer / scene / camera
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

// -- procedural textures (seeded, built once at boot, never in the render path)
function canvasTexture(size, draw, { srgb = true, repeat = [1, 1] } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  return t;
}
const floorMap = canvasTexture(256, (ctx, s) => {
  const plank = s / 4;
  for (let i = 0; i < 4; i++) {
    const tint = 0.92 + hash1(i * 3 + 1) * 0.14;
    ctx.fillStyle = `rgb(${Math.round(255 * tint)},${Math.round(250 * tint)},${Math.round(244 * tint)})`;
    ctx.fillRect(0, i * plank, s, plank - 1);
    ctx.fillStyle = 'rgba(60,40,25,0.55)';
    ctx.fillRect(0, (i + 1) * plank - 2, s, 2);
    for (let k = 0; k < 5; k++) {
      const gx = hash1(i * 9 + k * 5 + 2) * s;
      const gy = i * plank + hash1(i * 5 + k) * plank;
      ctx.fillStyle = 'rgba(120,90,60,0.12)';
      ctx.fillRect(gx, gy, 26 + hash1(k + i) * 40, 1.5);
    }
  }
}, { repeat: [4, 3.5] });
const floorRough = canvasTexture(256, (ctx, s) => {
  ctx.fillStyle = '#b4b4b4';
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 900; i++) {
    const g = Math.round(150 + hash1(i) * 90);
    ctx.fillStyle = `rgb(${g},${g},${g})`;
    ctx.fillRect(hash1(i + 7) * s, hash1(i + 13) * s, 2, 2);
  }
}, { srgb: false, repeat: [4, 3.5] });
const plasterMap = canvasTexture(256, (ctx, s) => {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 2200; i++) {
    const g = Math.round(235 + hash1(i * 1.7) * 20);
    ctx.fillStyle = `rgb(${g},${g},${g})`;
    ctx.fillRect(hash1(i + 3) * s, hash1(i + 5) * s, 2.5, 2.5);
  }
}, { repeat: [3, 2] });
const rugMap = canvasTexture(256, (ctx, s) => {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = 'rgba(90,70,50,0.16)';
  ctx.lineWidth = 6;
  ctx.strokeRect(s * 0.07, s * 0.07, s * 0.86, s * 0.86);
  ctx.strokeStyle = 'rgba(90,70,50,0.10)';
  ctx.lineWidth = 3;
  ctx.strokeRect(s * 0.13, s * 0.13, s * 0.74, s * 0.74);
  for (let i = 0; i < 2600; i++) {
    const g = Math.round(215 + hash1(i * 2.3) * 40);
    ctx.fillStyle = `rgb(${g},${g},${g})`;
    ctx.fillRect(hash1(i + 11) * s, hash1(i + 17) * s, 1.6, 1.6);
  }
});
const couchMap = canvasTexture(256, (ctx, s) => {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, s, s);
  for (let y = 0; y < s; y += 12) {
    for (let x = 0; x < s; x += 12) {
      const g = Math.round(205 + hash1(x * 0.31 + y * 0.17) * 50);
      ctx.fillStyle = `rgb(${g},${g},${g})`;
      ctx.beginPath();
      ctx.arc(x + 6, y + 6, 5, 0, 7);
      ctx.fill();
    }
  }
}, { repeat: [3, 2] });

// ---------------------------------------------------------------------------
// 4. The materials library (docs/ART_STYLE.md §3). One place, reused everywhere.
// ---------------------------------------------------------------------------
function std(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.8, metalness: 0, ...opts });
}
/** Fur: a standard PBR material with vertex colours, because the markings are
 *  painted into the mesh (see §5). `sheenTint` is only a specular tint: black
 *  cat fur is a mirror with a mood, not a matte blob. */
function furMaterial({ sheen = false, white = false } = {}) {
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: white ? 0.62 : 0.48, // black fur is glossier than white
    metalness: 0,
    sheen: sheen ? 0.6 : 0.25,
    sheenRoughness: 0.35,
    sheenColor: new THREE.Color(TOKENS.furSheen),
  });
}
/** The soft silhouette: a BackSide shell, slightly inflated, that fakes the
 *  fuzz edge without any fur shader cost. Max 2 per cat (selfTest counts). */
function fuzzShell(source, material) {
  const m = new THREE.Mesh(source.geometry, material);
  m.scale.multiplyScalar(1.045);
  m.userData.fuzz = true;
  m.userData.noContact = true;
  return m;
}
const fuzzMaterial = () =>
  new THREE.MeshBasicMaterial({
    color: new THREE.Color(TOKENS.furBlack).lerp(new THREE.Color(TOKENS.furSheen), 0.35),
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });

// ---------------------------------------------------------------------------
// 5. Markings as SDF rules, painted into vertex colours.
//
//    Both cats come from the same builder; what makes Bobo Bobo is WHICH rules
//    are switched on. That is the whole design system for the characters, and
//    it is why selfTest can measure "does the tell read at distance" instead of
//    trusting that someone drew the right spot.
//
//    Rules are authored in cat-root space (metres, +z forward, feet at y=0)
//    per pose, so they stay put when the cat changes pose or grows.
// ---------------------------------------------------------------------------
const MARK_EPS = 0.008; // 8 mm of soft edge: fur markings are never a hard decal

function ellSDF(p, c, r) {
  const dx = (p.x - c[0]) / r[0];
  const dy = (p.y - c[1]) / r[1];
  const dz = (p.z - c[2]) / r[2];
  const q = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return (q - 1) * Math.min(r[0], r[1], r[2]);
}
function boxSDF(p, c, h) {
  const qx = Math.abs(p.x - c[0]) - h[0];
  const qy = Math.abs(p.y - c[1]) - h[1];
  const qz = Math.abs(p.z - c[2]) - h[2];
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
  return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, qy, qz), 0);
}

/** Shared by both cats: the white muzzle. */
function rulesMuzzle() {
  return [{ sdf: (p) => ellSDF(p, [0, -0.03, 0.052 + 0], [0.048, 0.036, 0.04]), name: 'muzzle', head: true }];
}
/** BOBO ONLY — the tells, in priority order of legibility. */
function rulesBobo(pose) {
  const head = [
    ...rulesMuzzle(),
    // the thin vertical dash between the eyes: THE tell. Exaggerated from the
    // photo's ~4 x 20 mm to a readable blaze so it survives searching distance
    // (docs/ART_STYLE.md §5), still unmistakably the same marking.
    { sdf: (p) => boxSDF(p, [0, 0.036, 0.058], [0.0095, 0.036, 0.032]), name: 'dash', head: true },
  ];
  const body = pose === 'loaf'
    ? [
        { sdf: (p) => ellSDF(p, [0, 0.1, 0.145], [0.075, 0.07, 0.075]), name: 'bib' },
        { sdf: (p) => ellSDF(p, [0.086, 0.06, 0.02], [0.04, 0.03, 0.04]), name: 'belly-patch' },
      ]
    : [
        { sdf: (p) => ellSDF(p, [0, 0.245, 0.122], [0.098, 0.095, 0.105]), name: 'bib' },
        { sdf: (p) => ellSDF(p, [0.086, 0.09, 0.02], [0.04, 0.03, 0.04]), name: 'belly-patch' },
      ];
  return { head, body };
}
/** THE DECOY CAT — white feet (built as parts, not rules) and a white neck
 *  band. Explicitly no dash, no bib, no belly patch (docs/DECOY_CAT.md). */
function rulesDecoy(pose) {
  const head = rulesMuzzle();
  const body = pose === 'sprawl'
    ? [{ sdf: (p) => ellSDF(p, [0, 0.185, 0.165], [0.155, 0.115, 0.04]), name: 'collar' }]
    : [{ sdf: (p) => ellSDF(p, [0, 0.386, 0.045], [0.125, 0.034, 0.105]), name: 'collar' }];
  return { head, body };
}

const _vRoot = new THREE.Vector3();
const _mPartToRoot = new THREE.Matrix4();
const _mRootInv = new THREE.Matrix4();
const _mHeadInv = new THREE.Matrix4();
const isHeadPart = (mesh) => mesh.userData.tag === 'head' || mesh.userData.tag === 'ear';

/** Paint one pose's marking rules into the meshes' vertex colours.
 *
 *  Head rules are evaluated in HEAD space and body rules in cat-root space, so
 *  the dash stays put when the head turns and the bib stays put when the cat
 *  changes pose. Both are authored in metres against the same template. */
function paintPose(cat, poseName, rules, headGroup) {
  const group = cat.poses[poseName];
  if (!group) return;
  cat.root.updateWorldMatrix(true, true);
  _mRootInv.copy(cat.root.matrixWorld).invert();
  if (headGroup) _mHeadInv.copy(headGroup.matrixWorld).invert();
  const black = new THREE.Color(TOKENS.furBlack);
  const white = new THREE.Color(TOKENS.furWhite);
  group.traverse((mesh) => {
    if (!mesh.isMesh || mesh.userData.fuzz || !mesh.geometry?.attributes?.position) return;
    if (mesh.material?.vertexColors !== true) return; // only fur takes markings
    const toHead = headGroup && isHeadPart(mesh);
    const active = toHead ? rules.head : rules.body;
    const geo = mesh.geometry;
    const pos = geo.attributes.position;
    if (!geo.attributes.color) {
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
    }
    const col = geo.attributes.color;
    _mPartToRoot.multiplyMatrices(toHead ? _mHeadInv : _mRootInv, mesh.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      _vRoot.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(_mPartToRoot);
      let w = 0;
      for (const r of active) w = Math.max(w, sdfInside(r.sdf(_vRoot), MARK_EPS));
      col.setXYZ(i, lerp(black.r, white.r, w), lerp(black.g, white.g, w), lerp(black.b, white.b, w));
    }
    col.needsUpdate = true;
  });
}

// ---------------------------------------------------------------------------
// 6. The cat builder. One parametric builder, two cats: the difference is the
//    marking rules that get switched on, and the root scale (mass).
//    Bobo is modelled at his CURRENT ~15 lb; Brandon's photo shows him at about
//    10 lb, so the photo gives the MARKINGS and the current spec gives the
//    BODY (docs/ART_STYLE.md §6 — the 15 lb body shape is an assumption).
// ---------------------------------------------------------------------------
function ellGeo(rx, ry, rz, w = 36, h = 24) {
  const g = new THREE.SphereGeometry(1, w, h);
  g.userData = { ell: [rx, ry, rz] };
  return g;
}
function addMesh(parent, geo, mat, pos, tag, { rot = null, cast = true, contact = false } = {}) {
  const m = new THREE.Mesh(geo, mat);
  if (geo.userData?.ell) m.scale.set(geo.userData.ell[0], geo.userData.ell[1], geo.userData.ell[2]);
  m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  m.castShadow = cast;
  m.receiveShadow = false;
  if (tag) m.userData.tag = tag;
  if (contact) m.userData.contact = true;
  parent.add(m);
  return m;
}
function cylinderBetween(a, b, r, mat, tag, segments = 1) {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const dir = new THREE.Vector3().subVectors(vb, va);
  const len = dir.length();
  // more height segments than a cylinder needs, because the markings are vertex
  // colours: a two-row cylinder has nowhere to put a white neck band.
  const g = new THREE.CylinderGeometry(r, r * 1.06, len, 20, segments, false);
  const m = new THREE.Mesh(g, mat);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  m.castShadow = true;
  if (tag) m.userData.tag = tag;
  return m;
}
function whiskers() {
  const pts = [];
  for (const s of [-1, 1]) {
    const root = [s * 0.028, -0.012, 0.058];
    for (let i = 0; i < 3; i++) {
      pts.push(root[0], root[1], root[2]);
      pts.push(s * (0.085 + i * 0.012), -0.02 - i * 0.009 + 0.012, 0.052 - i * 0.012);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: new THREE.Color(TOKENS.whisker) }));
  m.userData.tag = 'whisker';
  m.userData.noContact = true;
  return m;
}
/** The head, built around its own centre so it can hang off a pivot. */
function buildHead(mats) {
  const g = new THREE.Group();
  addMesh(g, ellGeo(0.09, 0.083, 0.084, 72, 48), mats.fur, [0, 0, 0], 'head');
  g.userData.eyes = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(s * 0.037, 0.012, 0.061);
    const sclera = addMesh(eye, new THREE.SphereGeometry(0.0165, 20, 14), mats.sclera, [0, 0, 0], 'eye', { cast: false });
    sclera.scale.set(1, 1.05, 0.7);
    const n = new THREE.Vector3(s * 0.32, 0.1, 0.94).normalize();
    const iris = new THREE.Mesh(new THREE.CircleGeometry(0.0105, 24), mats.iris);
    iris.position.copy(n).multiplyScalar(0.0148);
    iris.lookAt(new THREE.Vector3().addVectors(iris.position, n));
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.0044, 16), mats.pupil);
    pupil.position.copy(n).multiplyScalar(0.0156);
    pupil.lookAt(new THREE.Vector3().addVectors(pupil.position, n));
    g.add(eye);
    g.userData.eyes.push(eye);

    const ear = addMesh(g, new THREE.ConeGeometry(0.031, 0.054, 18), mats.fur, [s * 0.055, 0.064, -0.004], 'ear', {
      rot: [-18 * DEG, 0, s * 17 * DEG],
    });
    const inner = addMesh(g, new THREE.ConeGeometry(0.018, 0.03, 16), mats.earInner, [s * 0.05, 0.058, 0.013], 'ear-inner', {
      rot: [-18 * DEG, 0, s * 17 * DEG],
      cast: false,
    });
    void inner;
  }
  addMesh(g, ellGeo(0.0125, 0.009, 0.008, 18, 12), mats.nose, [0, -0.018, 0.076], 'nose', { cast: false });
  g.add(whiskers());
  return g;
}

const CAT_SPECS = {
  bobo: { scale: [1, 1, 1], poses: ['sit', 'loaf'], rules: rulesBobo },
  decoy: { scale: [1.3, 1.13, 1.12], poses: ['sit', 'sprawl'], rules: rulesDecoy },
};

function buildCat(kind) {
  const spec = CAT_SPECS[kind];
  const root = new THREE.Group();
  root.name = `cat-${kind}`;
  root.scale.set(spec.scale[0], spec.scale[1], spec.scale[2]);
  const mats = {
    fur: furMaterial({ sheen: true }),
    white: std(TOKENS.furWhite, { roughness: 0.62 }),
    nose: std(TOKENS.nose, { roughness: 0.45 }),
    earInner: std(TOKENS.earInner, { roughness: 0.75 }),
    sclera: std(0xf3efe6, { roughness: 0.25 }),
    iris: new THREE.MeshStandardMaterial({ color: new THREE.Color(TOKENS.eyes), roughness: 0.2, side: THREE.DoubleSide }),
    pupil: std(TOKENS.pupil, { roughness: 0.15 }),
    fuzz: fuzzMaterial(),
  };
  const cat = { kind, root, mats, poses: {}, contacts: {}, pivots: {}, current: spec.poses[0], fuzzCount: 0 };
  for (const pose of spec.poses) {
    const grp = new THREE.Group();
    grp.visible = pose === cat.current;
    const contacts = [];
    cat.pivots[pose] = buildPose(kind, pose, grp, mats, contacts);
    root.add(grp);
    cat.poses[pose] = grp;
    cat.contacts[pose] = contacts;
    paintPose(cat, pose, spec.rules(pose), cat.pivots[pose].head);
  }
  root.traverse((o) => {
    if (o.userData?.fuzz) cat.fuzzCount++;
  });
  return cat;
}

function setCatPose(cat, pose) {
  if (!cat.poses[pose] || cat.current === pose) return;
  cat.current = pose;
  for (const [name, grp] of Object.entries(cat.poses)) grp.visible = name === pose;
}

/** One pose of one cat, authored in cat-root space (metres, feet at y = 0). */
function buildPose(kind, pose, grp, mats, contacts) {
  const fur = mats.fur;
  const white = mats.white;
  const isDecoy = kind === 'decoy';

  if (pose === 'sit') {
    const haunch = addMesh(grp, ellGeo(0.135, 0.14, 0.13, 56, 40), fur, [0, 0.14, -0.05], 'torso', { contact: true });
    contacts.push(haunch);
    addMesh(grp, ellGeo(0.105, 0.16, 0.125, 56, 40), fur, [0, 0.215, 0.075], 'chest');
    grp.add(cylinderBetween([0, 0.3, 0.05], [0, 0.4, 0.038], isDecoy ? 0.062 : 0.055, fur, 'neck', 12));
    for (const s of [-1, 1]) {
      grp.add(cylinderBetween([s * 0.058, 0.25, 0.116], [s * 0.058, 0.065, 0.12], 0.028, fur, 'foreleg'));
      const paw = addMesh(grp, ellGeo(0.034, 0.023, 0.054, 24, 16), white, [s * 0.058, 0.023, 0.142], 'fore-paw', { contact: true, cast: false });
      contacts.push(paw);
      const hind = addMesh(grp, ellGeo(0.036, 0.024, isDecoy ? 0.06 : 0.054, 24, 16), white, [s * (isDecoy ? 0.105 : 0.1), 0.024, -0.135], 'hind-foot', { contact: true, cast: false });
      contacts.push(hind);
    }
  } else if (pose === 'loaf') {
    const body = addMesh(grp, ellGeo(0.125, 0.098, 0.2, 56, 40), fur, [0, 0.098, 0.01], 'torso', { contact: true });
    contacts.push(body);
    for (const s of [-1, 1]) {
      const paw = addMesh(grp, ellGeo(0.032, 0.021, 0.05, 24, 16), white, [s * 0.052, 0.021, 0.19], 'fore-paw', { contact: true, cast: false });
      contacts.push(paw);
    }
  } else {
    // sprawl: the 22 lb cat belly-down with the hips out — reads as heavy and wide
    const body = addMesh(grp, ellGeo(0.175, 0.135, 0.25, 56, 40), fur, [0, 0.135, -0.05], 'torso', { contact: true });
    contacts.push(body);
    grp.add(cylinderBetween([0, 0.16, 0.18], [0, 0.17, 0.235], 0.075, fur, 'neck', 12));
    for (const s of [-1, 1]) {
      const paw = addMesh(grp, ellGeo(0.038, 0.022, 0.085, 24, 16), white, [s * 0.085, 0.022, 0.245], 'fore-paw', { contact: true, cast: false });
      contacts.push(paw);
      const hind = addMesh(grp, ellGeo(0.05, 0.026, 0.09, 24, 16), white, [s * 0.155, 0.026, -0.215], 'hind-foot', { contact: true, cast: false });
      hind.rotation.y = s * 0.5;
      contacts.push(hind);
    }
  }

  const headAt = pose === 'sit' ? [0, 0.445, 0.04] : pose === 'loaf' ? [0, 0.165, 0.155] : [0, 0.17, 0.245];
  const head = buildHead(mats);
  head.position.set(headAt[0], headAt[1], headAt[2]);
  if (pose !== 'sit') head.rotation.x = 0.12;
  grp.add(head);

  const tailAt = pose === 'sit' ? [0, 0.135, -0.175] : pose === 'loaf' ? [0.09, 0.02, -0.12] : [0, 0.03, -0.285];
  const pivot = new THREE.Group();
  pivot.position.set(tailAt[0], tailAt[1], tailAt[2]);
  const pts =
    pose === 'sit'
      ? [[0, 0, 0], [0.02, -0.05, -0.07], [0.09, -0.02, -0.13], [0.14, 0.05, -0.1]]
      : pose === 'loaf'
        ? [[0, 0, 0], [0.07, 0.005, -0.04], [0.14, 0.01, 0.02], [0.13, 0.02, 0.09]]
        : [[0, 0, 0], [0.02, 0, -0.09], [0.05, 0.005, -0.17], [0.02, 0.01, -0.23]];
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const tail = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, isDecoy ? 0.021 : 0.016, 10, false), fur);
  tail.castShadow = true;
  tail.userData.tag = 'tail';
  pivot.add(tail);
  grp.add(pivot);

  // the fuzz silhouette: max 2 shells per cat (body + head)
  const bodyMesh = grp.children.find((c) => c.isMesh && c.userData.tag === 'torso');
  const shellBody = fuzzShell(bodyMesh, mats.fuzz);
  shellBody.position.copy(bodyMesh.position);
  shellBody.scale.copy(bodyMesh.scale).multiplyScalar(1.045);
  shellBody.castShadow = false;
  grp.add(shellBody);
  const shellHead = fuzzShell(head.children[0], mats.fuzz);
  shellHead.scale.copy(head.children[0].scale).multiplyScalar(1.05);
  shellHead.castShadow = false;
  head.add(shellHead);
  return { head, tailPivot: pivot, body: bodyMesh, shells: [shellBody, shellHead], baseHeadX: head.rotation.x };
}

// ---------------------------------------------------------------------------
// 7. The room: a slice of a believable modern apartment. Realistic lighting and
//    materials are the art goal (VISION.md); the layout itself is a PROVISIONAL
//    placeholder until Brandon supplies the real apartment (docs/LOCATIONS.md).
//    No ceiling, on purpose: the diorama view reads the whole room at once.
//
//    Every static prop is merged into one mesh per material. That is where the
//    render budget comes from: the whole apartment is ~18 draws instead of ~50,
//    so the two cats (and the celebration) get the rest of the frame.
// ---------------------------------------------------------------------------
const room = new THREE.Group();
scene.add(room);
const SUPPORTS = {}; // name -> world y of the surface things stand on (measured, see below)

const _xform = new THREE.Object3D();
function partMatrix(at = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  _xform.position.set(at[0], at[1], at[2]);
  _xform.rotation.set(rot[0], rot[1], rot[2]);
  _xform.scale.set(scale[0], scale[1], scale[2]);
  _xform.updateMatrix();
  return _xform.matrix.clone();
}
/** Merge prop geometry into one mesh per material: fewer draws, same look. */
function mergedMesh(entries, { tag = '', cast = true, receive = true } = {}) {
  const byMat = new Map();
  for (const e of entries) {
    const g = e.geo.index ? e.geo.toNonIndexed() : e.geo.clone();
    g.applyMatrix4(partMatrix(e.at, e.rot, e.scale));
    if (!byMat.has(e.mat)) byMat.set(e.mat, []);
    byMat.get(e.mat).push(g);
  }
  const meshes = [];
  for (const [mat, geos] of byMat) {
    let count = 0;
    for (const g of geos) count += g.attributes.position.count;
    const pos = new Float32Array(count * 3);
    const nor = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2);
    let o = 0;
    for (const g of geos) {
      const n = g.attributes.position.count;
      pos.set(g.attributes.position.array.subarray(0, n * 3), o * 3);
      if (g.attributes.normal) nor.set(g.attributes.normal.array.subarray(0, n * 3), o * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array.subarray(0, n * 2), o * 2);
      o += n;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const m = new THREE.Mesh(out, mat);
    m.castShadow = cast;
    m.receiveShadow = receive;
    if (tag) m.userData.tag = tag;
    room.add(m);
    meshes.push(m);
  }
  return meshes;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, seg = 18, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);

// floor: the one surface that keeps its own mesh, because the oak grain must
// tile across it as a single plane
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(6.4, 5.2),
  std(TOKENS.oakFloor, { roughness: 0.55, map: floorMap, roughnessMap: floorRough }),
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
floor.userData.tag = 'floor';
room.add(floor);
SUPPORTS.floor = 0;

const plasterMat = std(TOKENS.plaster, { roughness: 0.95, map: plasterMap });
const WALL_Z = -2.6;
// the far wall is four slabs around a window opening (x ±1.15, y 0.5..2.0):
// it has to cast its own shadow, or the sunlight on the floor is a lie
mergedMesh(
  [
    { geo: box(2.05, 2.6, 0.12), mat: plasterMat, at: [-2.175, 1.3, WALL_Z] },
    { geo: box(2.05, 2.6, 0.12), mat: plasterMat, at: [2.175, 1.3, WALL_Z] },
    { geo: box(2.3, 0.5, 0.12), mat: plasterMat, at: [0, 0.25, WALL_Z] },
    { geo: box(2.3, 0.6, 0.12), mat: plasterMat, at: [0, 2.3, WALL_Z] },
    { geo: box(0.12, 2.6, 5.2), mat: plasterMat, at: [-3.2, 1.3, 0] },
  ],
  { tag: 'wall' },
);

// what the window looks out on: a flat, tone-mapping-exempt sky, so the sunlit
// opening stays bright without turning the room into a blown-out white box
const skyMap = canvasTexture(128, (ctx, s) => {
  const g = ctx.createLinearGradient(0, 0, 0, s);
  g.addColorStop(0, '#8ec4ea');
  g.addColorStop(0.62, '#cfe6f4');
  g.addColorStop(1, '#f3ead9');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = 'rgba(120,150,110,0.5)';
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.arc(hash1(i * 3.3) * s, s * (0.8 + hash1(i) * 0.12), s * (0.1 + hash1(i + 5) * 0.08), 0, 7);
    ctx.fill();
  }
});
const sky = new THREE.Mesh(
  new THREE.PlaneGeometry(3.6, 2.4),
  new THREE.MeshBasicMaterial({ map: skyMap, toneMapped: false }),
);
sky.position.set(0, 1.28, WALL_Z - 0.18);
sky.userData.tag = 'sky';
room.add(sky);

const metalMat = std(TOKENS.metal, { roughness: 0.45, metalness: 0.5 });
const walnutMat = std(TOKENS.walnut, { roughness: 0.6 });
mergedMesh([
  // window frame
  { geo: box(0.06, 1.5, 0.06), mat: metalMat, at: [0, 1.25, WALL_Z + 0.02] },
  { geo: box(2.3, 0.06, 0.06), mat: metalMat, at: [0, 1.25, WALL_Z + 0.02] },
  // floor lamp: base + stem
  { geo: cyl(0.11, 0.13, 0.03), mat: metalMat, at: [-2.0, 0.015, -2.05] },
  { geo: cyl(0.018, 0.018, 1.42), mat: metalMat, at: [-2.0, 0.72, -2.05] },
  // side table
  { geo: box(0.52, 0.04, 0.52), mat: walnutMat, at: [-2.5, 0.5, -1.55] },
  { geo: cyl(0.016, 0.016, 0.5, 10), mat: walnutMat, at: [-2.72, 0.25, -1.77] },
  { geo: cyl(0.016, 0.016, 0.5, 10), mat: walnutMat, at: [-2.72, 0.25, -1.33] },
  { geo: cyl(0.016, 0.016, 0.5, 10), mat: walnutMat, at: [-2.28, 0.25, -1.77] },
  { geo: cyl(0.016, 0.016, 0.5, 10), mat: walnutMat, at: [-2.28, 0.25, -1.33] },
  // picture frames on the far wall
  { geo: box(0.34, 0.44, 0.03), mat: walnutMat, at: [1.7, 1.5, WALL_Z + 0.075] },
  { geo: box(0.28, 0.36, 0.03), mat: walnutMat, at: [2.35, 1.32, WALL_Z + 0.075] },
]);

const curtainMat = std(0xe9e2d4, { roughness: 0.98 });
mergedMesh(
  [
    { geo: box(0.24, 2.0, 0.05), mat: curtainMat, at: [-1.32, 1.25, WALL_Z + 0.09] },
    { geo: box(0.24, 2.0, 0.05), mat: curtainMat, at: [1.32, 1.25, WALL_Z + 0.09] },
  ],
  { tag: 'curtain' },
);

// rug: the searching stage. Its top surface is measured, not assumed, because
// the cats stand on it.
const [rugMesh] = mergedMesh(
  [{ geo: box(2.7, 0.012, 1.9), mat: std(TOKENS.rug, { roughness: 0.98, map: rugMap }), at: [0.1, 0.006, 0.55] }],
  { tag: 'rug', cast: false },
);
SUPPORTS.rug = new THREE.Box3().setFromObject(rugMesh).max.y;

// couch against the -x wall. The seat cushions are a separate mesh (identical
// fabric) so selfTest can measure the height Bobo is actually loafing on.
const couchMat = std(TOKENS.couch, { roughness: 0.92, map: couchMap });
mergedMesh(
  [
    { geo: box(0.9, 0.32, 2.4), mat: couchMat, at: [-2.6, 0.16, 0] },
    { geo: box(0.22, 0.78, 2.4), mat: couchMat, at: [-3.05, 0.52, 0] },
    { geo: box(0.9, 0.56, 0.22), mat: couchMat, at: [-2.6, 0.44, 1.1] },
    { geo: box(0.9, 0.56, 0.22), mat: couchMat, at: [-2.6, 0.44, -1.1] },
  ],
  { tag: 'couch' },
);
const [cushionMesh] = mergedMesh(
  (() => {
    const cushionMat = couchMat.clone();
    return [
      { geo: box(0.78, 0.22, 1.0), mat: cushionMat, at: [-2.5, 0.33, 0.46] },
      { geo: box(0.78, 0.22, 1.0), mat: cushionMat, at: [-2.5, 0.33, -0.46] },
    ];
  })(),
  { tag: 'cushion' },
);
SUPPORTS.cushion = new THREE.Box3().setFromObject(cushionMesh).max.y;
mergedMesh(
  [{ geo: box(0.26, 0.26, 0.26), mat: std(TOKENS.pillow, { roughness: 0.9 }), at: [-2.72, 0.57, 0.86], rot: [0, 0.5, 0.2] }],
  { tag: 'pillow' },
);

// the small things a cat ignores, then knocks off the table
mergedMesh([
  { geo: cyl(0.042, 0.038, 0.09, 16), mat: std(TOKENS.uiPaper, { roughness: 0.35 }), at: [-2.42, 0.565, -1.5] },
  { geo: cyl(0.17, 0.13, 0.3, 20), mat: std(0xb0694c, { roughness: 0.85 }), at: [2.62, 0.15, -2.05] },
]);
mergedMesh(
  [{ geo: box(0.2, 0.035, 0.15), mat: std(TOKENS.uiCoral, { roughness: 0.8 }), at: [-2.6, 0.537, -1.62], rot: [0, -0.3, 0] }],
  { tag: 'book', cast: false },
);
const leafMat = std(TOKENS.leaf, { roughness: 0.7 });
const leaves = [];
for (let i = 0; i < 6; i++) {
  const a = (i / 6) * Math.PI * 2;
  leaves.push({
    geo: new THREE.SphereGeometry(1, 16, 10),
    mat: leafMat,
    at: [2.62 + Math.cos(a) * 0.09, 0.46 + (i % 3) * 0.06, -2.05 + Math.sin(a) * 0.09],
    rot: [0.4 * Math.cos(a + 1), -a, 0.5 * Math.sin(a)],
    scale: [0.05, 0.2, 0.02],
  });
}
mergedMesh(leaves, { tag: 'plant', cast: false });

// the cardboard box: the game's most important prop, in three of the ten moments
const boxMat = std(TOKENS.cardboard, { roughness: 0.95 });
boxMat.side = THREE.DoubleSide;
mergedMesh(
  [
    { geo: box(0.62, 0.02, 0.44), mat: boxMat, at: [1.75, 0.01, 0.75] },
    { geo: box(0.62, 0.32, 0.02), mat: boxMat, at: [1.75, 0.17, 0.53] },
    { geo: box(0.62, 0.32, 0.02), mat: boxMat, at: [1.75, 0.17, 0.97] },
    { geo: box(0.02, 0.32, 0.44), mat: boxMat, at: [1.44, 0.17, 0.75] },
    { geo: box(0.02, 0.32, 0.44), mat: boxMat, at: [2.06, 0.17, 0.75] },
  ],
  { tag: 'box' },
);
mergedMesh(
  [
    { geo: box(0.28, 0.38, 0.01), mat: std(TOKENS.uiPaper, { roughness: 0.9 }), at: [1.7, 1.5, WALL_Z + 0.095] },
    { geo: box(0.22, 0.3, 0.01), mat: std(TOKENS.uiPaper, { roughness: 0.9 }), at: [2.35, 1.32, WALL_Z + 0.095] },
  ],
  { tag: 'frame-print', cast: false },
);

// the lampshade is its own mesh because it glows from the inside
const [shadeMesh] = mergedMesh(
  [{ geo: cyl(0.13, 0.19, 0.26, 22, true), mat: std(TOKENS.lampShade, { roughness: 0.9 }), at: [-2.0, 1.5, -2.05] }],
  { tag: 'lamp' },
);
shadeMesh.material.side = THREE.DoubleSide;
shadeMesh.material.emissive = new THREE.Color(TOKENS.lampShade);
shadeMesh.material.emissiveIntensity = 0.55;

// ---------------------------------------------------------------------------
// 8. The lighting rig (docs/ART_STYLE.md §4). One shadow-casting light — the
//    sun through the window — plus a soft sky fill and one warm lamp.
// ---------------------------------------------------------------------------
const hemi = new THREE.HemisphereLight(0xcfe4f5, 0x6b5a48, 0.55);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff2df, 2.8);
sun.position.set(-1.5, 3.1, -5.4);
sun.target.position.set(0.3, 0.25, 0.8);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -4;
sun.shadow.camera.right = 4;
sun.shadow.camera.top = 4;
sun.shadow.camera.bottom = -4;
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 14;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

const lampLight = new THREE.PointLight(0xffc98a, 6, 4.6, 2);
lampLight.position.set(-2.0, 1.45, -2.05);
lampLight.castShadow = false;
scene.add(lampLight);

// ---------------------------------------------------------------------------
// 9. The two cats.
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
// 10. Celebration: it rains little Bobo heads. Flat merged geometry, one
//     InstancedMesh per layer (head / muzzle / dash) so the whole crowd of 42
//     is three draw calls, plus two firework bursts as Points.
// ---------------------------------------------------------------------------
function triGeo(a, b, c) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
  g.computeVertexNormals();
  return g;
}
function mergeFlat(parts) {
  let count = 0;
  const geos = parts.map(({ geo, at }) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (at) g.applyMatrix4(new THREE.Matrix4().makeTranslation(at[0], at[1], at[2]));
    count += g.attributes.position.count;
    return g;
  });
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  let o = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, o * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}
const RAIN_N = 42;
const headGeo = mergeFlat([
  { geo: new THREE.CircleGeometry(0.5, 20) },
  { geo: triGeo([-0.5, 0.12, 0], [-0.16, 0.34, 0], [-0.42, 0.62, 0]) },
  { geo: triGeo([0.5, 0.12, 0], [0.42, 0.62, 0], [0.16, 0.34, 0]) },
]);
const muzzleGeo = mergeFlat([{ geo: new THREE.CircleGeometry(0.2, 16), at: [0, -0.16, 0.004] }]);
const dashGeo = mergeFlat([{ geo: new THREE.PlaneGeometry(0.1, 0.3), at: [0, 0.16, 0.004] }]);

function rainLayer(geo, color) {
  const m = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color), side: THREE.DoubleSide }), RAIN_N);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.frustumCulled = false;
  m.visible = false;
  m.userData.tag = 'rain';
  scene.add(m);
  return m;
}
const rainHeads = rainLayer(headGeo, TOKENS.furBlack);
const rainMuzzles = rainLayer(muzzleGeo, TOKENS.furWhite);
const rainDashes = rainLayer(dashGeo, TOKENS.furWhite);

const rainSeeds = [];
for (let i = 0; i < RAIN_N; i++) {
  rainSeeds.push({
    x: -2.4 + hash1(i * 1.7 + 0.3) * 4.6,
    z: -1.8 + hash1(i * 2.9 + 1.7) * 3.6,
    phase: hash1(i * 3.7 + 2.3),
    speed: 0.55 + hash1(i * 5.1 + 4.1) * 0.5,
    spin: hash1(i * 7.3 + 5.9) * Math.PI * 2,
    size: 0.05 + hash1(i * 11.1 + 7.7) * 0.055,
  });
}
const _rainObj = new THREE.Object3D();
function updateRain(t) {
  for (let i = 0; i < RAIN_N; i++) {
    const s = rainSeeds[i];
    const fall = fract(s.phase + (t * s.speed) / 3.3);
    _rainObj.position.set(s.x, 3.15 - fall * 3.5, s.z);
    _rainObj.rotation.set(0, 0, s.spin + t * s.speed * 0.9);
    _rainObj.scale.setScalar(s.size);
    _rainObj.updateMatrix();
    rainHeads.setMatrixAt(i, _rainObj.matrix);
  }
  for (const m of [rainHeads, rainMuzzles, rainDashes]) {
    m.instanceMatrix.needsUpdate = true;
  }
}

function burst(at, colors, seed) {
  const N = 90;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const c = colors.map((h) => new THREE.Color(h));
  for (let i = 0; i < N; i++) {
    const a = hash1(i * 1.3 + seed) * Math.PI * 2;
    const z = hash1(i * 2.7 + seed * 3) * 2 - 1;
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = z;
    pos[i * 3 + 2] = Math.sin(a) * r;
    const cc = c[i % c.length];
    col[i * 3] = cc.r;
    col[i * 3 + 1] = cc.g;
    col[i * 3 + 2] = cc.b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({
    size: 0.06,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const p = new THREE.Points(g, m);
  p.position.set(at[0], at[1], at[2]);
  p.frustumCulled = false;
  p.visible = false;
  p.userData.tag = 'firework';
  scene.add(p);
  return p;
}
const bursts = [
  { mesh: burst([-0.5, 1.55, 0.5], [TOKENS.uiMustard, TOKENS.uiCoral, TOKENS.uiPaper], 1.1), period: 2.4, offset: 0 },
  { mesh: burst([0.75, 1.75, 0.15], [TOKENS.uiGlow, TOKENS.uiMustard, TOKENS.uiCoral], 5.7), period: 2.4, offset: 1.2 },
];
function updateFireworks(t) {
  for (const b of bursts) {
    const u = fract((t + b.offset) / b.period);
    const k = easeOutCubic(u);
    b.mesh.scale.setScalar(0.14 + 1.5 * k);
    b.mesh.material.opacity = Math.pow(1 - u, 1.6) * 0.95;
  }
}

// ---------------------------------------------------------------------------
// 11. The HUD (design system §8). DOM, not geometry: crisp at every size and
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
// 12. selfTest. Every number is measured back out of the built geometry (and
//     the built DOM), so a check can actually fail — including the checks that
//     say "Bobo and the decoy are instantly distinguishable", which is the
//     whole art-direction problem of this game.
// ---------------------------------------------------------------------------
const DASH_EXPECT = { c: [0, 0.036, 0.058], h: [0.0095, 0.036, 0.032] }; // where the art says the dash is
const BIB_EXPECT = {
  sit: { c: [0, 0.245, 0.122], h: [0.098, 0.095, 0.105] },
  loaf: { c: [0, 0.1, 0.145], h: [0.075, 0.07, 0.075] },
};
const COLLAR_EXPECT = {
  sit: { c: [0, 0.386, 0.045], h: [0.125, 0.034, 0.105] },
  sprawl: { c: [0, 0.185, 0.165], h: [0.155, 0.115, 0.04] },
};
const LIN_WHITE = new THREE.Color(TOKENS.furWhite).r;
const LIN_BLACK = new THREE.Color(TOKENS.furBlack).r;

/** How much of each marking actually landed where the art says it should.
 *  Head rules are measured in head space, body rules in cat-root space. */
function scanMarkings(cat, pose) {
  cat.root.updateWorldMatrix(true, true);
  const group = cat.poses[pose];
  const headGroup = cat.pivots[pose].head;
  const invRoot = new THREE.Matrix4().copy(cat.root.matrixWorld).invert();
  const invHead = new THREE.Matrix4().copy(headGroup.matrixWorld).invert();
  const out = { dash: 0, bib: 0, collar: 0, shells: 0, whiskers: 0, dashExtent: 0 };
  const dashPts = [];
  const v = new THREE.Vector3();
  const m = new THREE.Matrix4();
  group.traverse((obj) => {
    if (obj.userData.fuzz) {
      out.shells++;
      return;
    }
    if (obj.userData.tag === 'whisker') {
      out.whiskers += obj.geometry.attributes.position.count / 2;
      return;
    }
    if (!obj.isMesh) return;
    const col = obj.geometry?.attributes?.color;
    if (!col) return;
    const toHead = isHeadPart(obj);
    m.multiplyMatrices(toHead ? invHead : invRoot, obj.matrixWorld);
    const pos = obj.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(m);
      const w = (col.getX(i) - LIN_BLACK) / Math.max(1e-6, LIN_WHITE - LIN_BLACK);
      if (toHead) {
        const d = boxSDF(v, DASH_EXPECT.c, DASH_EXPECT.h);
        if (d < -0.002 && w >= 0.75) out.dash++;
        if (d < 0.006 && w >= 0.4) dashPts.push(v.x, v.y, v.z);
      } else {
        if (w < 0.75) continue;
        const bib = BIB_EXPECT[pose];
        const collar = COLLAR_EXPECT[pose];
        if (bib && ellSDF(v, bib.c, bib.h) < -0.002) out.bib++;
        if (collar && ellSDF(v, collar.c, collar.h) < -0.002) out.collar++;
      }
    }
  });
  if (dashPts.length >= 3) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(dashPts, 3));
    const box3 = new THREE.Box3().setFromBufferAttribute(g.attributes.position);
    const size = box3.getSize(new THREE.Vector3());
    out.dashExtent = Math.max(size.x, size.y, size.z) * cat.root.scale.y;
  }
  return out;
}
/** Lowest point of a cat's feet/body minus the surface it is standing on. */
function contactGap(cat) {
  const support = (LAYOUT[momentName] ?? LAYOUT.default)[cat.kind].pos[1];
  const y0 = SUPPORTS[support] ?? 0;
  cat.root.updateWorldMatrix(true, true);
  let lowest = Infinity;
  let who = '';
  for (const mesh of cat.contacts[cat.current]) {
    const min = new THREE.Box3().setFromObject(mesh).min.y;
    if (min < lowest) {
      lowest = min;
      who = mesh.userData.tag ?? 'part';
    }
  }
  return { gap: lowest - y0, support, who };
}
/** How tall a `extent`-metre mark looks at `dist` metres, in 1080p pixels. */
function projectedPx(extent, dist, fovDeg, heightPx = 1080) {
  return (extent * heightPx) / (2 * dist * Math.tan((fovDeg / 2) * DEG));
}
const srgbLuma = (hex) => {
  const ch = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
};
const contrast = (a, b) => {
  const la = srgbLuma(a);
  const lb = srgbLuma(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

const round = (v) => (typeof v === 'number' ? Number(v.toPrecision(6)) : v);

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
  add('decoy-no-bib', dd.bib, 'exactly 0', dd.bib === 0, 'the decoy has a neck band, not a bib');
  add('decoy-collar-white', dd.collar, '≥25 white vertices', dd.collar >= 25, `neck band on ${decoy.current}`);
  add('bobo-no-collar', bb.collar, 'exactly 0', bb.collar === 0, 'Bobo has no neck band');

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
    `${bb.dash}>0=${bb.dash > 0 && dd.dash === 0}, bib ${bb.bib}/collar ${dd.collar}`,
    'dash + bib on Bobo, collar on the decoy, never both',
    bb.dash > 0 && dd.dash === 0 && bb.bib > 0 && dd.bib === 0 && dd.collar > 0 && bb.collar === 0,
    'one builder, different marking rules',
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
    const { gap, support, who } = contactGap(cat);
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
  add('seek-no-unseeded-random', unseededCalls, '0 calls', unseededCalls === 0, 'Math.random / Date.now inside seek / setMoment');
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
// 13. The window.LC contract (docs/CAPTURE.md), so the Step 2 tool can drive
//     this page exactly like the test scene.
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
      rendering = true;
      try {
        renderer.render(scene, camera);
      } finally {
        rendering = false;
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
} else if (PLANT === 'size') {
  // applied where the decoy is built: the 22 lb cat shrinks to Bobo's size
} else if (PLANT === 'text') {
  // the joke "fixed": ending-text-exact must fail on every frame
  ENDING_TEXT = 'you did it! you win';
} else if (PLANT && PLANT !== 'none' && PLANT !== 'stats') {
  console.warn(`Unknown plant "${PLANT}". Use dash, size, text or stats.`);
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
