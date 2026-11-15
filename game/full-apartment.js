// game/full-apartment.js — the FULL one-bedroom flat (Step 8): buildRoom()'s
// living room and lighting rig untouched, the slice's hall + bedroom around
// it, and the rooms the slice never opened: a kitchenette along the living
// room's south wall, the bathroom behind a new doorway in the hall's west
// wall, and the bedroom's desk + laundry basket + foot-of-bed blanket. Same
// technique as game/apartment.js and src/room.js: everything static merges
// into one mesh per material; every surface a cat stands on is MEASURED, not
// assumed. Geometry numbers are documented in docs/LEVEL_LAYOUT.md.
//
// Lighting budget (docs/ART_STYLE.md §4): the sun stays the ONLY shadow
// light; the rooms beyond the style-test rig get no-shadow point fill
// (bed, bathroom, kitchenette) — 5 real lights total, cap is 6.

import * as THREE from 'three';
import { TOKENS } from '../src/tokens.js';
import { std } from '../src/materials.js';
import { buildRoom } from '../src/room.js';
import { floorMap, floorRough, plasterMap, skyMap } from '../src/textures.js';

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

const topY = (mesh) => new THREE.Box3().setFromObject(mesh).max.y;

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

/** Build the full flat: buildRoom + hall + bedroom (as the slice) + the
 *  kitchenette, bathroom and extra bedroom furniture (Step 8).
 *  Returns { living, supports, lights, pen }. */
export function buildFullApartment(scene) {
  const living = buildRoom(scene); // the untouched style-test look + rig
  const flat = new THREE.Group();
  scene.add(flat);

  const plaster = std(TOKENS.plaster, { roughness: 0.95, map: plasterMap });
  const metal = std(TOKENS.metal, { roughness: 0.45, metalness: 0.5 });
  const walnut = std(TOKENS.walnut, { roughness: 0.6 });
  const ceramic = std(TOKENS.uiPaper, { roughness: 0.3 }); // bathroom ceramics
  const mirror = new THREE.MeshBasicMaterial({ color: 0x9db3bd }); // a flat readable slate (no envmap here)
  const tile = std(0xcfd6d2, { roughness: 0.25 }); // bathroom floor

  // ---- walls (0.12 slabs flush with buildRoom's), docs/LEVEL_LAYOUT.md ----
  // vs the slice: the hall's west wall is TWO slabs with a doorway at
  // z∈[3.36,3.94] — the bathroom's door (door3 walk rect).
  const H = 2.6;
  const cy = H / 2;
  mergedMesh(flat, [
    // living: east wall, south wall with the doorway at x∈[−1.13,−0.07]
    { geo: box(0.12, H, 5.32), mat: plaster, at: [3.2, cy, 0] },
    { geo: box(2.13, H, 0.12), mat: plaster, at: [-2.195, cy, 2.6] },
    { geo: box(3.27, H, 0.12), mat: plaster, at: [1.565, cy, 2.6] },
    // hall: east wall, west wall with the bathroom doorway
    { geo: box(0.12, H, 1.6), mat: plaster, at: [0.4, cy, 3.46] },
    { geo: box(0.12, H, 0.7), mat: plaster, at: [-1.4, cy, 3.01] },
    { geo: box(0.12, H, 0.2), mat: plaster, at: [-1.4, cy, 4.04] },
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
    // kitchenette carcass + bathroom vanity body share the plaster walls
    { geo: box(1.8, 0.9, 0.6), mat: plaster, at: [1.5, 0.45, 2.24] },
    { geo: box(0.73, 0.8, 0.32), mat: plaster, at: [-2.725, 0.4, 2.82] },
  ], { receive: true });

  // ---- bedroom window: the same flat sky + the same frame bars ----
  // (the plane's default face is +z, i.e. away from the room — turned to face in)
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 2.4),
    new THREE.MeshBasicMaterial({ map: skyMap, toneMapped: false }),
  );
  sky.position.set(0, 1.28, 7.2);
  sky.rotation.y = Math.PI;
  sky.userData.tag = 'sky';
  flat.add(sky);
  mergedMesh(flat, [
    { geo: box(0.06, 1.5, 0.06), mat: metal, at: [0, 1.25, 6.98] },
    { geo: box(2.3, 0.06, 0.06), mat: metal, at: [0, 1.25, 6.98] },
    // bathroom: vanity basin + faucet, mirror (basin is porcelain-ceramic and
    // the mirror a flat readable slate — bare metal renders black without an envmap)
    { geo: cyl(0.15, 0.12, 0.1, 14), mat: ceramic, at: [-2.725, 0.85, 2.82] },
    { geo: cyl(0.015, 0.015, 0.16, 8), mat: metal, at: [-2.725, 0.96, 2.7] },
    { geo: box(0.5, 0.6, 0.03), mat: mirror, at: [-2.725, 1.5, 2.675] },
  ]);
  // kitchenette worktop and desk keyboard: their own meshes so counterTop and
  // kbTop are MEASURED, not asserted (the whole apartment's rule). The top is
  // laminate, not steel — metal without an envmap renders as a black slab.
  const [counterMesh] = mergedMesh(flat, [{ geo: box(1.84, 0.04, 0.64), mat: ceramic, at: [1.5, 0.88, 2.24] }]);
  const [kbMesh] = mergedMesh(flat, [{ geo: box(0.14, 0.03, 0.44), mat: metal, at: [-2.84, 0.775, 5.87] }]);
  mergedMesh(flat, [
    // kitchenette: recessed sink basin + faucet against the backsplash
    { geo: box(0.5, 0.02, 0.36), mat: metal, at: [2.05, 0.861, 2.2] },
    { geo: cyl(0.018, 0.018, 0.3, 10), mat: metal, at: [2.05, 1.05, 2.42] },
    { geo: box(0.035, 0.035, 0.14), mat: metal, at: [2.05, 1.18, 2.36] },
  ]);

  // ---- floors (same oak; the bathroom gets wipeable tile) ----
  for (const [w, d, cx, cz] of [
    [1.92, 1.72, -0.5, 3.4], // hall
    [5.38, 2.92, -0.57, 5.6], // bedroom
  ]) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(w, d), oakAt(w, d));
    f.rotation.x = -Math.PI / 2;
    f.position.set(cx, 0, cz);
    f.receiveShadow = true;
    flat.add(f);
  }
  const bathFloor = new THREE.Mesh(new THREE.PlaneGeometry(1.68, 1.48), tile);
  bathFloor.rotation.x = -Math.PI / 2;
  bathFloor.position.set(-2.3, 0, 3.4);
  bathFloor.receiveShadow = true;
  bathFloor.userData.tag = 'bath-floor';
  flat.add(bathFloor);

  // ---- the bedroom: bed, nightstand, desk (docs/LEVEL_LAYOUT.md) ----
  mergedMesh(flat, [
    // bed frame + headboard + nightstand + desk legs share walnut
    { geo: box(1.5, 0.26, 1.7), mat: walnut, at: [1.2, 0.13, 5.8] },
    { geo: box(1.5, 0.7, 0.1), mat: walnut, at: [1.2, 0.35, 5.0] },
    { geo: box(0.44, 0.42, 0.44), mat: walnut, at: [0.25, 0.23, 5.15] },
    { geo: cyl(0.02, 0.02, 0.72, 10), mat: walnut, at: [-3.08, 0.36, 5.26] },
    { geo: cyl(0.02, 0.02, 0.72, 10), mat: walnut, at: [-3.08, 0.36, 6.14] },
    { geo: cyl(0.02, 0.02, 0.72, 10), mat: walnut, at: [-2.6, 0.36, 5.26] },
    { geo: cyl(0.02, 0.02, 0.72, 10), mat: walnut, at: [-2.6, 0.36, 6.14] },
  ]);
  // desk top — its own mesh so deskTop is MEASURED (0.76)
  const [deskTopMesh] = mergedMesh(flat, [{ geo: box(0.6, 0.04, 1.0), mat: walnut, at: [-2.84, 0.74, 5.7] }]);
  const bedding = std(TOKENS.uiPaper, { roughness: 0.92 });
  mergedMesh(flat, [{ geo: box(1.4, 0.18, 1.6), mat: bedding, at: [1.2, 0.35, 5.8] }]);
  const duvetMat = std(TOKENS.couch, { roughness: 0.92 });
  mergedMesh(flat, [{ geo: box(1.44, 0.1, 1.12), mat: duvetMat, at: [1.2, 0.45, 6.06] }]);
  const pillowMat = std(TOKENS.pillow, { roughness: 0.9 });
  // blanket over the foot of the bed — its own mesh, blanketTop measured (0.58)
  const [blanketMesh] = mergedMesh(flat, [{ geo: box(1.4, 0.06, 0.56), mat: pillowMat, at: [1.2, 0.55, 6.32] }]);
  mergedMesh(flat, [{ geo: box(0.6, 0.1, 0.4), mat: pillowMat, at: [1.2, 0.51, 5.28] }]);

  // ---- the laundry basket (replaces the slice's floor pile) ----
  const basketMat = std(TOKENS.lampShade, { roughness: 0.8 });
  mergedMesh(flat, [
    { geo: box(0.62, 0.22, 0.03), mat: basketMat, at: [-0.45, 0.11, 5.995] },
    { geo: box(0.62, 0.22, 0.03), mat: basketMat, at: [-0.45, 0.11, 6.405] },
    { geo: box(0.03, 0.22, 0.41), mat: basketMat, at: [-0.745, 0.11, 6.2] },
    { geo: box(0.03, 0.22, 0.41), mat: basketMat, at: [-0.155, 0.11, 6.2] },
  ], { cast: true });
  const laundryMat = std(TOKENS.uiMustard, { roughness: 0.95 });
  // the pile a cat naps on — laundryTop (0.18) is MEASURED from this mesh
  const [laundryMesh] = mergedMesh(flat, [{ geo: cyl(0.27, 0.24, 0.1, 14), mat: laundryMat, at: [-0.45, 0.13, 6.2] }], { cast: true });
  const laundry2 = std(TOKENS.uiCoral, { roughness: 0.95 });
  mergedMesh(flat, [{ geo: cyl(0.16, 0.14, 0.04, 12), mat: laundry2, at: [-0.4, 0.16, 6.18], rot: [0, 0.6, 0] }], { cast: true });

  // ---- bathroom furniture: ceramics + a towel + a mat ----
  mergedMesh(flat, [
    { geo: box(0.35, 0.42, 0.5), mat: ceramic, at: [-1.675, 0.21, 3.87] }, // toilet bowl
    { geo: box(0.36, 0.04, 0.5), mat: ceramic, at: [-1.675, 0.44, 3.85] }, // seat
    { geo: box(0.35, 0.4, 0.16), mat: ceramic, at: [-1.675, 0.62, 4.04] }, // cistern
  ]);
  mergedMesh(flat, [{ geo: box(0.03, 0.5, 0.3), mat: std(TOKENS.uiCoral, { roughness: 0.95 }), at: [-3.125, 1.25, 3.7] }], { cast: true });
  mergedMesh(flat, [{ geo: box(0.62, 0.012, 0.42), mat: std(TOKENS.rug, { roughness: 0.98 }), at: [-2.55, 0.006, 3.58] }], { cast: false });

  // ---- the pen: Bobo's target on the desk, and the game's little trickster.
  // Its own tiny mesh (one draw) because its pose is WRITTEN EVERY FRAME by
  // game/full.js (rest vs knock-off) — order-independence, like the cats.
  const pen = new THREE.Group();
  const penMesh = new THREE.Mesh(cyl(0.012, 0.012, 0.16, 8), std(TOKENS.uiMustard, { roughness: 0.4 }));
  penMesh.rotation.x = Math.PI / 2; // lie the barrel along Z, then yaw the group
  penMesh.castShadow = true;
  pen.add(penMesh);
  pen.name = 'pen';
  flat.add(pen);

  // ---- fill light for the rooms the style-test rig never lit ----
  // Budget: sun stays the only shadow light; 3 more real lights, 5 total.
  const bedLight = new THREE.PointLight(0xffd9b0, 3.2, 6, 2);
  bedLight.position.set(0.9, 2.35, 5.7);
  bedLight.castShadow = false;
  const bathLight = new THREE.PointLight(0xdfeaf2, 2.2, 4.5, 2);
  bathLight.position.set(-2.3, 2.3, 3.4);
  bathLight.castShadow = false;
  const kitchenLight = new THREE.PointLight(0xffe6c4, 2.6, 5.5, 2);
  kitchenLight.position.set(1.5, 2.3, 2.0);
  kitchenLight.castShadow = false;
  scene.add(bedLight, bathLight, kitchenLight);

  return {
    living,
    supports: {
      ...living.SUPPORTS,
      boxFloor: 0.02, // the box's own measured floor (as in the slice)
      bedTop: 0.5, // duvet top — by construction, like the slice's
      counterTop: topY(counterMesh), // kitchenette worktop (measured 0.90)
      deskTop: topY(deskTopMesh), // 0.76
      kbTop: topY(kbMesh), // keyboard on the desk (measured 0.79)
      laundryTop: topY(laundryMesh), // the pile in the basket (0.18)
      blanketTop: topY(blanketMesh), // foot-of-bed blanket (0.58)
    },
    lights: { bedLight, bathLight, kitchenLight },
    pen: { root: pen, barrel: penMesh },
  };
}
