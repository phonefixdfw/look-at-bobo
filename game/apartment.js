// game/apartment.js — the slice apartment: buildRoom()'s living room and
// lighting rig, untouched, plus the rooms `buildRoom` never needed (east +
// south walls with one doorway, hall, bedroom). Everything added here is
// merged into one mesh per material, same technique and materials as
// src/room.js, so the whole extension costs ~10 draws. Geometry numbers are
// documented in docs/LEVEL_LAYOUT.md.

import * as THREE from 'three';
import { TOKENS } from '../src/tokens.js';
import { std } from '../src/materials.js';
import { buildRoom } from '../src/room.js';
import { floorMap, floorRough, plasterMap, skyMap } from '../src/textures.js';
import { slabAABB } from '../src/reach.js';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, seg = 18) => new THREE.CylinderGeometry(rt, rb, h, seg);

/** Same trick as src/room.js: bake transforms into merged, per-material
 *  buffers. (Its helper is module-private; this is the compact copy.) */
function mergedMesh(parent, entries, { cast = true, receive = true } = {}) {
  const _x = new THREE.Object3D();
  const byMat = new Map();
  for (const e of entries) {
    const g = e.geo.index ? e.geo.toNonIndexed() : e.geo.clone();
    _x.position.set(...(e.at ?? [0, 0, 0]));
    _x.rotation.set(...(e.rot ?? [0, 0, 0]));
    _x.scale.set(...(e.scale ?? [1, 1, 1]));
    _x.updateMatrix();
    g.applyMatrix4(_x.matrix);
    if (!byMat.has(e.mat)) byMat.set(e.mat, []);
    byMat.get(e.mat).push(g);
  }
  const out = [];
  for (const [mat, geos] of byMat) {
    let count = 0;
    for (const g of geos) count += g.attributes.position.count;
    const pos = new Float32Array(count * 3);
    const nor = new Float32Array(count * 3);
    let o = 0;
    for (const g of geos) {
      const n = g.attributes.position.count;
      pos.set(g.attributes.position.array.subarray(0, n * 3), o * 3);
      if (g.attributes.normal) nor.set(g.attributes.normal.array.subarray(0, n * 3), o * 3);
      o += n;
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    bg.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    const m = new THREE.Mesh(bg, mat);
    m.castShadow = cast;
    m.receiveShadow = receive;
    parent.add(m);
    out.push(m);
  }
  return out;
}

/** Repeat the oak grain at the living room's density on a new plane. */
function oakAt(w, d) {
  const map = floorMap.clone();
  map.needsUpdate = true;
  map.repeat.set((w / 6.4) * 4, (d / 5.2) * 3.5);
  const roughnessMap = floorRough.clone();
  roughnessMap.needsUpdate = true;
  roughnessMap.repeat.copy(map.repeat);
  return std(TOKENS.oakFloor, { roughness: 0.55, map, roughnessMap });
}

/** Build the living room + lights (buildRoom) and the rest of the flat
 *  around it. Returns { living, supports, lights }. */
export function buildApartment(scene) {
  const living = buildRoom(scene); // the untouched style-test look + rig
  const flat = new THREE.Group();
  scene.add(flat);

  const plaster = std(TOKENS.plaster, { roughness: 0.95, map: plasterMap });
  const metal = std(TOKENS.metal, { roughness: 0.45, metalness: 0.5 });
  const walnut = std(TOKENS.walnut, { roughness: 0.6 });

  // ---- walls (0.12 slabs flush with buildRoom's), docs/LEVEL_LAYOUT.md ----
  const H = 2.6;
  const cy = H / 2;
  const walls = [
    // living: east wall, south wall with the doorway at x∈[−1.13,−0.07]
    { geo: box(0.12, H, 5.32), mat: plaster, at: [3.2, cy, 0] },
    { geo: box(2.13, H, 0.12), mat: plaster, at: [-2.195, cy, 2.6] },
    { geo: box(3.27, H, 0.12), mat: plaster, at: [1.565, cy, 2.6] },
    // hall
    { geo: box(0.12, H, 1.6), mat: plaster, at: [-1.4, cy, 3.46] },
    { geo: box(0.12, H, 1.6), mat: plaster, at: [0.4, cy, 3.46] },
    // hall south / bedroom north wall, doorway at x∈[−1.13,−0.07]
    { geo: box(2.13, H, 0.12), mat: plaster, at: [-2.195, cy, 4.2] },
    { geo: box(2.19, H, 0.12), mat: plaster, at: [1.025, cy, 4.2] },
    // bedroom: west continues the living west wall, east, south with window
    { geo: box(0.12, H, 4.4), mat: plaster, at: [-3.2, cy, 4.86] },
    { geo: box(0.12, H, 2.92), mat: plaster, at: [2.06, cy, 5.6] },
    { geo: box(2.11, H, 0.12), mat: plaster, at: [-2.205, cy, 7.0] },
    { geo: box(0.97, H, 0.12), mat: plaster, at: [1.635, cy, 7.0] },
    { geo: box(2.3, 0.5, 0.12), mat: plaster, at: [0, 0.25, 7.0] },
    { geo: box(2.3, 0.6, 0.12), mat: plaster, at: [0, 2.3, 7.0] },
  ];
  mergedMesh(flat, walls, { receive: true });

  // ---- bedroom window: the same flat sky + the same frame bars ----
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 2.4),
    new THREE.MeshBasicMaterial({ map: skyMap, toneMapped: false }),
  );
  sky.position.set(0, 1.28, 7.2);
  sky.userData.tag = 'sky';
  flat.add(sky);
  mergedMesh(flat, [
    { geo: box(0.06, 1.5, 0.06), mat: metal, at: [0, 1.25, 6.98] },
    { geo: box(2.3, 0.06, 0.06), mat: metal, at: [0, 1.25, 6.98] },
  ]);

  // ---- floors (same oak, own tiling) ----
  for (const [w, d, cx, cz] of [
    [1.92, 1.72, -0.5, 3.4],
    [5.38, 2.92, -0.57, 5.6],
  ]) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(w, d), oakAt(w, d));
    f.rotation.x = -Math.PI / 2;
    f.position.set(cx, 0, cz);
    f.receiveShadow = true;
    flat.add(f);
  }

  // ---- the bedroom: bed, nightstand, laundry (docs/LEVEL_LAYOUT.md) ----
  mergedMesh(flat, [
    // bed frame + headboard + nightstand share walnut
    { geo: box(1.5, 0.26, 1.7), mat: walnut, at: [1.2, 0.13, 5.8] },
    { geo: box(1.5, 0.7, 0.1), mat: walnut, at: [1.2, 0.35, 5.0] },
    { geo: box(0.44, 0.42, 0.44), mat: walnut, at: [0.25, 0.23, 5.15] },
  ]);
  const bedding = std(TOKENS.uiPaper, { roughness: 0.92 });
  mergedMesh(flat, [
    { geo: box(1.4, 0.18, 1.6), mat: bedding, at: [1.2, 0.35, 5.8] },
  ]);
  const duvetMat = std(TOKENS.couch, { roughness: 0.92 });
  mergedMesh(flat, [{ geo: box(1.44, 0.1, 1.12), mat: duvetMat, at: [1.2, 0.45, 6.06] }]);
  mergedMesh(flat, [{ geo: box(0.6, 0.1, 0.4), mat: std(TOKENS.pillow, { roughness: 0.9 }), at: [1.2, 0.51, 5.28] }]);
  const laundryMat = std(TOKENS.uiPaper, { roughness: 0.95 });
  const laundry2 = std(TOKENS.uiMustard, { roughness: 0.95 });
  const laundry3 = std(TOKENS.uiCoral, { roughness: 0.95 });
  mergedMesh(flat, [
    { geo: box(0.44, 0.12, 0.4), mat: laundryMat, at: [0.1, 0.06, 6.25], rot: [0, 0.4, 0] },
    { geo: box(0.4, 0.12, 0.36), mat: laundry2, at: [0.12, 0.17, 6.22], rot: [0, -0.5, 0.12] },
    { geo: box(0.3, 0.1, 0.3), mat: laundry3, at: [0.09, 0.26, 6.27], rot: [0, 0.9, 0] },
  ], { cast: true });

  // ---- fill light for the rooms the style-test rig never lit ----
  // Budget: sun stays the only shadow light; 2 more real lights, 4 total.
  const bedLight = new THREE.PointLight(0xffd9b0, 3.2, 6, 2);
  bedLight.position.set(0.9, 2.35, 5.7);
  bedLight.castShadow = false;
  const hallLight = new THREE.PointLight(0xffd9b0, 1.8, 4, 2);
  hallLight.position.set(-0.5, 2.3, 3.4);
  hallLight.castShadow = false;
  scene.add(bedLight, hallLight);

  return {
    living,
    supports: { ...living.SUPPORTS, boxFloor: 0.02, bedTop: 0.5 },
    lights: { bedLight, hallLight },
    // the plaster the player must never be able to press a camera against
    wallBoxes: [...living.wallBoxes, ...walls.map((d, i) => slabAABB(d, `slice#${i}`))],
  };
}
