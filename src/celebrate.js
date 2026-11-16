// src/celebrate.js — the win celebration: it rains little Bobo heads. Flat
// merged geometry, one InstancedMesh per layer (head / muzzle / dash) so the
// whole crowd of 42 is three draw calls, plus two firework bursts as Points.
// Extracted verbatim from design/style-test/styletest.js and wrapped as a
// factory that adds its (initially hidden) meshes to the page's scene.

import * as THREE from 'three';
import { TOKENS } from './tokens.js';
import { fract, hash1, easeOutCubic } from './util.js';

/** Create the rain + fireworks meshes in `scene` (hidden until the page shows
 *  them) and the pure `t`-functions that drive them. */
export function createCelebration(scene) {

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
// `boost` (default 1) brightens and widens the bursts: a Patriot Bobo catch
// (issue #58) pays 1.35 — extra fireworks for the bonus cat, same pure f(t)
// curve, so plain catches and every captured frame are untouched.
function updateFireworks(t, boost = 1) {
  for (const b of bursts) {
    const u = fract((t + b.offset) / b.period);
    const k = easeOutCubic(u);
    b.mesh.scale.setScalar((0.14 + 1.5 * k) * boost);
    b.mesh.material.opacity = Math.min(1, Math.pow(1 - u, 1.6) * 0.95 * boost);
  }
}

  return { RAIN_N, rainHeads, rainMuzzles, rainDashes, bursts, updateRain, updateFireworks };
}
