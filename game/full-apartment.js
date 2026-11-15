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
import { floorMap, floorRough, skyMap } from '../src/textures.js';
import { hash1 } from '../src/util.js';
import { slabAABB } from '../src/reach.js';
import { SURFACES, fabric, worldUV, tvScreenMaterial, glowMaterial, contactShadows, leafGeo, broadLeafGeo } from '../src/polish.js';

// -- Step 9 (issue #19): the flat's surfaces come from src/polish.js — wood
// grain with a normal map and a wear map, marble, tiled grout, plaster with
// float texture, brushed metal, a woven rug, book spines, wall art, terracotta
// and leaves. All procedural canvases, drawn once at import, seeded through
// hash1 exactly like src/textures.js (which stays byte-stable for the Step 3
// baselines). mergedMesh below now bakes world-projected UVs, which is what
// lets a MERGED prop carry a texture at all: Step 8's grain only reached the
// handful of unmerged meshes.

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, seg = 18) => new THREE.CylinderGeometry(rt, rb, h, seg);
const cone = (r, h, seg = 6) => new THREE.ConeGeometry(r, h, seg);

/** Same trick as src/room.js: bake transforms into merged, per-material
 *  buffers. (Its helper is module-private; this is the compact copy.)
 *  Step 9 adds two things: the UV channel survives the merge, and by default
 *  the UVs are RE-BAKED from world position at the density the material asks
 *  for (src/polish.js `worldUV`) — that is what finally lets a merged prop
 *  show its wood grain instead of one sampled texel. A part that brought its
 *  own meaningful UVs (a leaf card) opts out with `keepUV: true`. */
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
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!e.keepUV) worldUV(g, e.mat.userData?.uvTile ?? 0.6);
    if (!byMat.has(e.mat)) byMat.set(e.mat, []);
    byMat.get(e.mat).push(g);
  }
  const out = [];
  for (const [mat, geos] of byMat) {
    let count = 0;
    for (const g of geos) count += g.attributes.position.count;
    const pos = new Float32Array(count * 3);
    const nor = new Float32Array(count * 3);
    const uvs = new Float32Array(count * 2);
    let o = 0;
    for (const g of geos) {
      const n = g.attributes.position.count;
      pos.set(g.attributes.position.array.subarray(0, n * 3), o * 3);
      if (g.attributes.normal) nor.set(g.attributes.normal.array.subarray(0, n * 3), o * 3);
      if (g.attributes.uv) uvs.set(g.attributes.uv.array.subarray(0, n * 2), o * 2);
      o += n;
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    bg.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    bg.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
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

  const plaster = SURFACES.plaster(); // float texture + a normal map: big lit walls stop being one flat value
  const metal = SURFACES.metal(); // brushed streaks in colour AND roughness
  const walnut = SURFACES.wood(); // cathedral figure + pores + a wear map
  const paleWood = SURFACES.woodPale();
  const ceramic = SURFACES.marble(); // worktop laminate + porcelain: veins and sparkle
  const mirror = new THREE.MeshBasicMaterial({ color: 0x9db3bd }); // a flat readable slate (no envmap here)
  const tile = SURFACES.bathTile(); // bathroom floor: bevelled tiles, matte grout
  const backsplash = SURFACES.kitchenTile(); // small-format splashback behind the sink
  // The counter's base carcass. Step 8 gave it the WALL material; once walls
  // grew a normal map, that small box started shadow-acne speckling (a
  // normal-perturbed surface inside the shadow map's bias range reads as
  // black-and-white noise). It is really painted MDF: flat, smooth, satin.
  const paintedBoard = std(TOKENS.plaster, { roughness: 0.55 });
  const weaved = (color, r) => fabric(color, { roughness: r }); // the fabric family, now with relief

  // ---- walls (0.12 slabs flush with buildRoom's), docs/LEVEL_LAYOUT.md ----
  // vs the slice: the hall's west wall is TWO slabs with a doorway at
  // z∈[3.36,3.94] — the bathroom's door (door3 walk rect).
  const H = 2.6;
  const cy = H / 2;
  const walls = [
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
    { geo: box(1.8, 0.9, 0.6), mat: paintedBoard, at: [1.5, 0.45, 2.24] },
    { geo: box(0.73, 0.8, 0.32), mat: paintedBoard, at: [-2.725, 0.4, 2.82] },
  ];
  mergedMesh(flat, walls, { receive: true });

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
  // The headboard and the nightstand are FLUSH to the north wall's inner face
  // (z = 4.26): they used to sit 0.69 m off it, so you could walk behind them
  // and the room read as furniture floating in a gap (issue #27, bug 1).
  mergedMesh(flat, [
    // bed frame + headboard + nightstand + desk legs share walnut
    { geo: box(1.5, 0.26, 1.7), mat: walnut, at: [1.2, 0.13, 5.11] },
    { geo: box(1.5, 0.7, 0.1), mat: walnut, at: [1.2, 0.35, 4.31] },
    { geo: box(0.44, 0.42, 0.44), mat: walnut, at: [0.25, 0.23, 4.48] },
    { geo: cyl(0.02, 0.02, 0.72, 10), mat: walnut, at: [-3.08, 0.36, 5.26] },
    { geo: cyl(0.02, 0.02, 0.72, 10), mat: walnut, at: [-3.08, 0.36, 6.14] },
    { geo: cyl(0.02, 0.02, 0.72, 10), mat: walnut, at: [-2.6, 0.36, 5.26] },
    { geo: cyl(0.02, 0.02, 0.72, 10), mat: walnut, at: [-2.6, 0.36, 6.14] },
  ]);
  // desk top — its own mesh so deskTop is MEASURED (0.76)
  const [deskTopMesh] = mergedMesh(flat, [{ geo: box(0.6, 0.04, 1.0), mat: walnut, at: [-2.84, 0.74, 5.7] }]);
  const bedding = weaved(TOKENS.uiPaper, 0.92);
  mergedMesh(flat, [{ geo: box(1.4, 0.18, 1.6), mat: bedding, at: [1.2, 0.35, 5.11] }]);
  const duvetMat = weaved(TOKENS.couch, 0.92);
  mergedMesh(flat, [{ geo: box(1.44, 0.1, 1.12), mat: duvetMat, at: [1.2, 0.45, 5.37] }]);
  const pillowMat = weaved(TOKENS.pillow, 0.9);
  // blanket over the foot of the bed — its own mesh, blanketTop measured (0.58)
  const [blanketMesh] = mergedMesh(flat, [{ geo: box(1.4, 0.06, 0.56), mat: pillowMat, at: [1.2, 0.55, 5.63] }]);
  mergedMesh(flat, [{ geo: box(0.6, 0.1, 0.4), mat: pillowMat, at: [1.2, 0.51, 4.59] }]);

  // ---- the laundry basket (replaces the slice's floor pile) ----
  const basketMat = std(TOKENS.lampShade, { roughness: 0.8 });
  mergedMesh(flat, [
    { geo: box(0.62, 0.22, 0.03), mat: basketMat, at: [-0.45, 0.11, 5.995] },
    { geo: box(0.62, 0.22, 0.03), mat: basketMat, at: [-0.45, 0.11, 6.405] },
    { geo: box(0.03, 0.22, 0.41), mat: basketMat, at: [-0.745, 0.11, 6.2] },
    { geo: box(0.03, 0.22, 0.41), mat: basketMat, at: [-0.155, 0.11, 6.2] },
  ], { cast: true });
  const laundryMat = weaved(TOKENS.uiMustard, 0.95);
  // the pile a cat naps on — laundryTop (0.18) is MEASURED from this mesh
  const [laundryMesh] = mergedMesh(flat, [{ geo: cyl(0.27, 0.24, 0.1, 14), mat: laundryMat, at: [-0.45, 0.13, 6.2] }], { cast: true });
  const laundry2 = weaved(TOKENS.uiCoral, 0.95);
  mergedMesh(flat, [{ geo: cyl(0.16, 0.14, 0.04, 12), mat: laundry2, at: [-0.4, 0.16, 6.18], rot: [0, 0.6, 0] }], { cast: true });

  // ---- bathroom furniture: ceramics + a towel + a mat ----
  // The toilet moved from the doorway corner to the far (west) end of the same
  // wall: its push pad used to lie across the bathroom's ONLY door and cut the
  // room off from the flat (issue #27, bug 2). A 0.30 m body now has a 0.9 m
  // clear strip from the door to the bowl.
  mergedMesh(flat, [
    { geo: box(0.35, 0.42, 0.5), mat: ceramic, at: [-2.955, 0.21, 3.87] }, // toilet bowl
    { geo: box(0.36, 0.04, 0.5), mat: ceramic, at: [-2.955, 0.44, 3.85] }, // seat
    { geo: box(0.35, 0.4, 0.16), mat: ceramic, at: [-2.955, 0.62, 4.04] }, // cistern
  ]);
  mergedMesh(flat, [{ geo: box(0.03, 0.5, 0.3), mat: weaved(TOKENS.uiCoral, 0.95), at: [-3.125, 1.25, 3.7] }], { cast: true });
  mergedMesh(flat, [{ geo: box(0.62, 0.012, 0.42), mat: fabric(TOKENS.rug, { roughness: 0.98, uvTile: 0.4 }), at: [-2.42, 0.006, 3.52] }], { cast: false });

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

  // ---- Step 8 furniture (Brandon's list): a TV + stand, a bookshelf, a
  // coffee table, a kitchen table with chairs + fridge, a hall console, a
  // bedside lamp, bedroom curtains, a bathroom shelf — and proper plants.
  // Draw budget: every prop below merges into ONE of two meshes (the soft
  // items that must not cast shadows form the other), so the whole block
  // costs 13 draws, not one per prop: mergedMesh batches by material, and
  // these material consts are what make props share a batch.
  const black = std(0x14161a, { roughness: 0.5 }); // TV bezel, fridge seam
  const booksA = weaved(TOKENS.uiCoral, 0.85); // an apple, a magazine, a cushion
  const booksB = weaved(TOKENS.uiMustard, 0.85);
  const spines = SURFACES.spines(); // a shelf of books reads as BOOKS at 2 m
  const art = SURFACES.poster(); // framed prints: the room has someone living in it
  const terracotta = SURFACES.pot(); // flower pots: throwing rings + mineral bloom
  const soil = std(0x4a3628, { roughness: 0.98 });
  const shade = fabric(TOKENS.lampShade, { roughness: 0.86, uvTile: 0.07, sheen: 0.45 }); // bedside lamp
  const foliage = SURFACES.leaf(); // leaf cards carry their own midrib UVs (keepUV)
  const curtainBedroom = fabric(0xe9e2d4, { roughness: 0.98, uvTile: 0.16 });
  const bedRug = SURFACES.rug(); // woven pile with bands, not a flat slab
  const glaze = std(0xf3ede2, { roughness: 0.2 }); // mugs, a glass, a soap dish
  const rubber = std(0x191c22, { roughness: 0.72 }); // cables, a shoe sole
  const leather = std(0x4a3a30, { roughness: 0.62 }); // shoes by the door
  const paper = std(0xf4f1e8, { roughness: 0.92 }); // a note, a book's pages
  const fur = []; // every shadow-casting furniture piece
  const furSoft = []; // thin/flat things: no cast shadow, no collider needed

  // living room: the media wall on the north wall (the east wall belongs to
  // the capture cameras), the bookshelf in the west corner, a low table on
  // the rug's west end. The sofa already faces this way.
  fur.push(
    { geo: box(1.2, 0.3, 0.4), mat: walnut, at: [1.81, 0.24, -2.32] }, // TV stand body
    { geo: box(1.24, 0.04, 0.46), mat: walnut, at: [1.81, 0.41, -2.32] }, // top
    { geo: box(0.05, 0.09, 0.05), mat: walnut, at: [1.31, 0.045, -2.16] }, // 4 legs
    { geo: box(0.05, 0.09, 0.05), mat: walnut, at: [2.31, 0.045, -2.16] },
    { geo: box(0.05, 0.09, 0.05), mat: walnut, at: [1.31, 0.045, -2.48] },
    { geo: box(0.05, 0.09, 0.05), mat: walnut, at: [2.31, 0.045, -2.48] },
    { geo: box(0.96, 0.6, 0.05), mat: black, at: [1.81, 0.75, -2.46] }, // bezel
  );
  const tvScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.88, 0.52),
    tvScreenMaterial(), // Step 9: the TV is ON — an emissive still frame that
  ); // throws real light-looking glow without being a real light (cap is 6)
  tvScreen.position.set(1.81, 0.75, -2.432);
  tvScreen.userData.tag = 'tv';
  flat.add(tvScreen);
  {
    // Two additive decals sell it: a halo just off the panel, and the pool of
    // spill the screen paints on the wall around the bezel. Both are pure
    // geometry — no flicker, so nothing here can strobe (issue #19, #5).
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.26, 0.88), glowMaterial(0x9ecbe8, 0.28));
    halo.position.set(1.81, 0.75, -2.425);
    halo.userData.tag = 'tv-glow';
    halo.renderOrder = 3;
    flat.add(halo);
    const spill = new THREE.Mesh(new THREE.PlaneGeometry(1.78, 1.3), glowMaterial(0x86b6d8, 0.13));
    spill.position.set(1.81, 0.78, -2.47);
    spill.userData.tag = 'tv-spill';
    spill.renderOrder = 1;
    flat.add(spill);
  }

  // bookshelf, west corner: carcass + shelves, then books in two colours
  const shelfX = -2.99;
  fur.push(
    { geo: box(0.3, 1.8, 0.04), mat: walnut, at: [shelfX, 0.9, -2.52] },
    { geo: box(0.3, 1.8, 0.04), mat: walnut, at: [shelfX, 0.9, -1.9] },
    { geo: box(0.03, 1.8, 0.66), mat: walnut, at: [-3.13, 0.9, -2.21] }, // back on the wall
    { geo: box(0.28, 0.03, 0.62), mat: walnut, at: [shelfX, 0.45, -2.21] },
    { geo: box(0.28, 0.03, 0.62), mat: walnut, at: [shelfX, 0.9, -2.21] },
    { geo: box(0.28, 0.03, 0.62), mat: walnut, at: [shelfX, 1.35, -2.21] },
    { geo: box(0.28, 0.03, 0.62), mat: walnut, at: [shelfX, 1.79, -2.21] },
  );
  {
    let z = -2.44;
    for (const [shelfY, n] of [[0.47, 5], [0.92, 4], [1.37, 5]]) {
      for (let i = 0; i < n; i++) {
        const h = 0.2 + hash1(shelfY * 100 + i) * 0.12;
        const t = 0.03 + hash1(shelfY * 31 + i * 7) * 0.03;
        fur.push({ geo: box(0.16, h, t), mat: (i + (shelfY > 1 ? 1 : 0)) % 2 ? booksA : booksB, at: [shelfX + 0.02, shelfY + h / 2 + 0.015, z], rot: [0, 0, hash1(i * 3 + shelfY) > 0.75 ? 0.06 : 0] });
        z += t + 0.022;
        if (z > -1.98) z = -2.44;
      }
    }
  }

  // low table on the rug + a magazine on it
  fur.push(
    { geo: box(0.9, 0.035, 0.55), mat: walnut, at: [-1.15, 0.36, 0.55] },
    { geo: box(0.05, 0.35, 0.05), mat: walnut, at: [-1.53, 0.18, 0.34] },
    { geo: box(0.05, 0.35, 0.05), mat: walnut, at: [-0.77, 0.18, 0.34] },
    { geo: box(0.05, 0.35, 0.05), mat: walnut, at: [-1.53, 0.18, 0.76] },
    { geo: box(0.05, 0.35, 0.05), mat: walnut, at: [-0.77, 0.18, 0.76] },
    { geo: box(0.22, 0.008, 0.3), mat: booksA, at: [-1.24, 0.383, 0.55], rot: [0, -0.35, 0] },
  );

  // kitchenette, finished: fridge at the counter's west end (inside the
  // counter collider), a kettle, and a table for two snug to the east wall
  // (clear of every capture ray — see the clearance note in the COLLIDERS).
  fur.push(
    { geo: box(0.46, 1.58, 0.52), mat: metal, at: [0.85, 0.79, 2.26] }, // fridge body
    { geo: cyl(0.013, 0.013, 0.5, 8), mat: walnut, at: [0.64, 1.02, 1.975] }, // handle (dark so it reads)
    { geo: box(0.42, 0.014, 0.012), mat: black, at: [0.85, 0.86, 1.994] }, // freezer seam on the face
    { geo: cyl(0.085, 0.095, 0.17, 12), mat: metal, at: [1.35, 0.985, 2.2] }, // kettle
    { geo: box(0.02, 0.02, 0.09), mat: metal, at: [1.27, 1.02, 2.2], rot: [0, 0, -0.6] }, // spout
    { geo: cyl(0.012, 0.012, 0.07, 8), mat: metal, at: [1.42, 1.11, 2.2] }, // lid knob
    { geo: box(0.6, 0.035, 0.65), mat: walnut, at: [2.85, 0.72, 1.62] }, // table for two
    { geo: box(0.05, 0.72, 0.05), mat: walnut, at: [2.63, 0.36, 1.38] },
    { geo: box(0.05, 0.72, 0.05), mat: walnut, at: [3.07, 0.36, 1.38] },
    { geo: box(0.05, 0.72, 0.05), mat: walnut, at: [2.63, 0.36, 1.86] },
    { geo: box(0.05, 0.72, 0.05), mat: walnut, at: [3.07, 0.36, 1.86] },
    { geo: box(0.4, 0.035, 0.42), mat: walnut, at: [2.35, 0.45, 1.62] }, // one chair, tucked west
    { geo: box(0.4, 0.45, 0.035), mat: walnut, at: [2.35, 0.68, 1.83] },
    { geo: box(0.04, 0.42, 0.04), mat: walnut, at: [2.21, 0.21, 1.47] },
    { geo: box(0.04, 0.42, 0.04), mat: walnut, at: [2.49, 0.21, 1.47] },
    { geo: box(0.04, 0.42, 0.04), mat: walnut, at: [2.21, 0.21, 1.77] },
    { geo: box(0.04, 0.42, 0.04), mat: walnut, at: [2.49, 0.21, 1.77] },
    { geo: cyl(0.12, 0.075, 0.05, 14), mat: ceramic, at: [2.85, 0.765, 1.62] }, // fruit bowl…
    { geo: new THREE.SphereGeometry(0.035, 10, 8), mat: booksA, at: [2.89, 0.8, 1.65] }, // …a coral apple…
    { geo: cyl(0.035, 0.03, 0.07, 10), mat: ceramic, at: [3.0, 0.772, 1.45] }, // a mug, still warm
  );
  furSoft.push({ geo: new THREE.SphereGeometry(0.035, 10, 8), mat: foliage, at: [2.82, 0.8, 1.59] }); // …a green one

  // hall: a console under the hooks, keys in a dish
  fur.push(
    { geo: box(0.24, 0.035, 0.7), mat: walnut, at: [0.2, 0.82, 3.5] },
    { geo: box(0.22, 0.8, 0.035), mat: walnut, at: [0.2, 0.4, 3.17] },
    { geo: box(0.22, 0.8, 0.035), mat: walnut, at: [0.2, 0.4, 3.83] },
    { geo: cyl(0.01, 0.01, 0.07, 6), mat: metal, at: [0.33, 1.62, 3.22], rot: [0, 0, 1.2] }, // coat hooks
    { geo: cyl(0.01, 0.01, 0.07, 6), mat: metal, at: [0.33, 1.62, 3.5], rot: [0, 0, 1.2] },
    { geo: cyl(0.01, 0.01, 0.07, 6), mat: metal, at: [0.33, 1.62, 3.78], rot: [0, 0, 1.2] },
    { geo: cyl(0.07, 0.055, 0.025, 12), mat: metal, at: [0.2, 0.85, 3.5] }, // keys dish
  );

  // bedroom: a lamp on the nightstand, a rug along the bed, curtains at the window
  fur.push(
    { geo: cyl(0.05, 0.07, 0.02, 12), mat: metal, at: [0.25, 0.45, 4.48] }, // bedside lamp
    { geo: cyl(0.012, 0.012, 0.2, 8), mat: metal, at: [0.25, 0.55, 4.48] },
    { geo: cyl(0.1, 0.13, 0.15, 12, true), mat: shade, at: [0.25, 0.68, 4.48] },
    // the bed is flush to the wall now, so its runner moved to the side you
    // actually step out onto (it used to lie in the gap behind the headboard)
    { geo: box(0.5, 0.012, 1.3), mat: bedRug, at: [0.19, 0.006, 5.4] },
  );
  furSoft.push(
    { geo: box(0.24, 2.0, 0.05), mat: curtainBedroom, at: [-1.32, 1.25, 6.94] },
    { geo: box(0.24, 2.0, 0.05), mat: curtainBedroom, at: [1.32, 1.25, 6.94] },
  );

  // bathroom: a shelf over the cistern with a small succulent on it
  fur.push(
    { geo: box(0.5, 0.03, 0.2), mat: walnut, at: [-2.1, 1.15, 2.66] },
    { geo: box(0.03, 0.12, 0.18), mat: walnut, at: [-2.32, 1.08, 2.66] },
    { geo: box(0.03, 0.12, 0.18), mat: walnut, at: [-1.88, 1.08, 2.66] },
    { geo: cyl(0.05, 0.04, 0.06, 10), mat: terracotta, at: [-2.1, 1.195, 2.63] },
  );
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    furSoft.push({ geo: cone(0.016, 0.09, 5), mat: foliage, at: [-2.1 + Math.cos(a) * 0.022, 1.26, 2.63 + Math.sin(a) * 0.022], rot: [Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55] });
  }

  // the big plant by the window (in the lamp/curtain corner, clear of the
  // respawn and the bird-watching spot), detailed like Brandon asked: a pot
  // with rim + soil, two leaf clusters — upright sword leaves and broad
  // blades — each leaf its own shape, all in the two merged furniture draws
  fur.push(
    { geo: cyl(0.185, 0.145, 0.32, 18), mat: terracotta, at: [-1.655, 0.16, -2.32] }, // pot
    { geo: cyl(0.205, 0.19, 0.05, 18), mat: terracotta, at: [-1.655, 0.345, -2.32] }, // rim
    { geo: cyl(0.175, 0.175, 0.02, 16), mat: soil, at: [-1.655, 0.36, -2.32] }, // soil
  );
  // ===========================================================================
  // Step 9 (issue #19) — the lived-in pass.
  // Everything below joins the SAME two merged draws as the furniture above (a
  // new material costs at most one more draw), so a flat that looks twice as
  // full still costs the same handful of draw calls. The rules that kept it
  // honest: nothing here moves a measured surface, nothing stands in a cat
  // spot, a spawn or a capture view, and every floor prop is either flat enough
  // to walk over or sits inside a footprint the walk rects already exclude.
  // Nothing about the real apartment is invented: this is generic clutter that
  // belongs in a one-bedroom flat.
  // ===========================================================================

  /** Leaf cards are built along +z and droop toward -y; this stands one up at
   *  an angle so a cluster reads as a plant rather than a fan of green. */
  const sprout = (geo, { x, y, z, a = 0, tilt = -0.6, roll = 0 }) => {
    geo.rotateZ(roll).rotateX(tilt).rotateY(a).translate(x, y, z);
    return geo;
  };
  const range = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));
  const sword = (place, h) => ({ geo: sprout(leafGeo({ len: h, wid: 0.055, bend: 0.06, twist: 0.22, segs: 5, cup: 0.55 }), place), mat: foliage, keepUV: true });
  const paddle = (place, opts = {}) => ({ geo: sprout(broadLeafGeo({ len: 0.2, wid: 0.15, bend: 0.09, ...opts }), place), mat: foliage, keepUV: true });
  const stem = (place, len) => {
    const g = cyl(0.005, 0.007, len, 6);
    g.rotateX(Math.PI / 2);
    g.translate(0, 0, len / 2);
    return { geo: sprout(g, place), mat: foliage, keepUV: false };
  };

  // the big plant by the window, rebuilt like Brandon asked: real leaf cards
  // with a midrib and a tip, two clusters, stems under the broad paddles
  furSoft.push(
    ...range(12, (i) => {
      const a = (i / 12) * Math.PI * 2 + hash1(i * 5) * 0.5;
      return sword(
        { x: -1.655 + Math.cos(a) * 0.05, y: 0.372, z: -2.32 + Math.sin(a) * 0.05, a, tilt: -1.38 + hash1(i * 11) * 0.24, roll: hash1(i * 13) * 0.5 - 0.25 },
        0.4 + hash1(i * 7) * 0.3,
      );
    }),
    ...range(8, (i) => {
      const a = (i / 8) * Math.PI * 2 + 0.35;
      const tilt = -0.5 - hash1(i * 17) * 0.35;
      const place = { x: -1.655 + Math.cos(a) * 0.07, y: 0.372, z: -2.32 + Math.sin(a) * 0.07, a, tilt, roll: hash1(i) * 0.6 - 0.3 };
      return paddle(
        { ...place, y: 0.372 + 0.17 },
        { len: 0.2 + hash1(i * 3 + 40) * 0.09, wid: 0.15 + hash1(i * 9) * 0.05, bend: 0.1 + hash1(i * 5) * 0.06 },
      );
    }),
    ...range(8, (i) => {
      const a = (i / 8) * Math.PI * 2 + 0.35;
      return stem({ x: -1.655 + Math.cos(a) * 0.07, y: 0.372, z: -2.32 + Math.sin(a) * 0.07, a, tilt: -1.15 - hash1(i * 17) * 0.2 }, 0.19);
    }),
  );

  // --- living room: a table someone was just sitting at ---------------------
  const coffeeTop = 0.378;
  const standTop = 0.43;
  furSoft.push(
    // coffee table: a stack of books, a mug on a coaster, two remotes
    { geo: box(0.2, 0.028, 0.26), mat: spines, at: [-0.98, coffeeTop + 0.014, 0.4], rot: [0, 0.2, 0] },
    { geo: box(0.19, 0.024, 0.24), mat: spines, at: [-0.98, coffeeTop + 0.04, 0.42], rot: [0, 0.44, 0] },
    { geo: cyl(0.05, 0.05, 0.005, 12), mat: walnut, at: [-1.28, coffeeTop + 0.003, 0.68] },
    { geo: cyl(0.033, 0.03, 0.075, 12), mat: glaze, at: [-1.28, coffeeTop + 0.043, 0.68] },
    { geo: box(0.045, 0.018, 0.13), mat: black, at: [-1.34, coffeeTop + 0.009, 0.44], rot: [0, -0.32, 0] },
    { geo: box(0.045, 0.016, 0.12), mat: black, at: [-1.27, coffeeTop + 0.008, 0.5], rot: [0, 0.18, 0] },
    // media wall: books, a speaker, a remote, and a small pot that likes the TV's warmth
    { geo: box(0.24, 0.03, 0.19), mat: spines, at: [1.35, standTop + 0.015, -2.29], rot: [0, 0.12, 0] },
    { geo: box(0.22, 0.026, 0.17), mat: spines, at: [1.35, standTop + 0.043, -2.3], rot: [0, -0.1, 0] },
    { geo: box(0.1, 0.24, 0.1), mat: black, at: [2.24, standTop + 0.12, -2.31] },
    { geo: box(0.05, 0.018, 0.13), mat: black, at: [1.66, standTop + 0.009, -2.24], rot: [0, 0.5, 0] },
    { geo: cyl(0.055, 0.045, 0.07, 12), mat: terracotta, at: [2.0, standTop + 0.035, -2.29] },
    { geo: cyl(0.048, 0.048, 0.008, 12), mat: soil, at: [2.0, standTop + 0.072, -2.29] },
    ...range(7, (i) => {
      const a = (i / 7) * Math.PI * 2 + 0.4;
      return paddle({ x: 2.0 + Math.cos(a) * 0.018, y: standTop + 0.076, z: -2.29 + Math.sin(a) * 0.018, a, tilt: -0.62 - hash1(i * 5) * 0.5 }, { len: 0.1 + hash1(i * 3) * 0.05, wid: 0.075, bend: 0.05 });
    }),
    // the cables every media wall has, running down to a power strip
    { geo: box(0.02, 0.4, 0.02), mat: rubber, at: [1.2, 0.2, -2.5] },
    { geo: box(0.016, 0.32, 0.016), mat: rubber, at: [1.26, 0.16, -2.51] },
    { geo: box(0.44, 0.016, 0.016), mat: rubber, at: [1.0, 0.012, -2.5] },
    { geo: box(0.17, 0.035, 0.055), mat: rubber, at: [0.8, 0.018, -2.5] },
    // the couch: one accent cushion at the far end and a throw over the arm
    // (clear of Bobo's couch spot at [-2.55, cushion, 0.46] by 0.3 m)
    { geo: box(0.34, 0.34, 0.12), mat: booksB, at: [-2.63, 0.62, -0.8], rot: [0.24, 0.16, 0.2] },
    { geo: box(0.78, 0.05, 0.3), mat: booksA, at: [-2.6, 0.745, 1.1] },
    { geo: box(0.7, 0.42, 0.04), mat: booksA, at: [-2.56, 0.55, 1.24] },
    // wall art: a print over the kitchenette, one in the hall, one over the desk
    { geo: box(0.42, 0.52, 0.02), mat: walnut, at: [1.05, 1.62, 2.528] },
    { geo: box(0.36, 0.46, 0.02), mat: art, at: [1.05, 1.62, 2.516] },
    { geo: box(0.02, 0.48, 0.4), mat: walnut, at: [-1.332, 1.46, 3.1] },
    { geo: box(0.02, 0.42, 0.34), mat: art, at: [-1.32, 1.46, 3.1] },
    { geo: box(0.02, 0.5, 0.58), mat: walnut, at: [-3.132, 1.52, 5.7] },
    { geo: box(0.02, 0.44, 0.5), mat: art, at: [-3.12, 1.52, 5.7] },
  );

  // --- kitchenette: a room that was used this morning -----------------------
  furSoft.push(
    // a tea towel over the counter's room-facing edge
    { geo: box(0.24, 0.02, 0.1), mat: laundry2, at: [1.1, 0.902, 1.99] },
    { geo: box(0.24, 0.3, 0.02), mat: laundry2, at: [1.1, 0.75, 1.942] },
    // two bowls by the sink, a soap bottle, a jar, and herbs in a pot
    { geo: cyl(0.075, 0.06, 0.035, 12), mat: glaze, at: [1.22, 0.918, 2.44] },
    { geo: cyl(0.07, 0.056, 0.032, 12), mat: glaze, at: [1.22, 0.952, 2.44], rot: [0, 0.4, 0.04] },
    { geo: cyl(0.028, 0.03, 0.11, 10), mat: glaze, at: [2.3, 0.955, 2.45] },
    { geo: cyl(0.04, 0.04, 0.13, 10), mat: glaze, at: [1.86, 0.965, 2.46] },
    { geo: cyl(0.05, 0.042, 0.065, 12), mat: terracotta, at: [1.62, 0.932, 2.45] },
    { geo: cyl(0.044, 0.044, 0.008, 12), mat: soil, at: [1.62, 0.966, 2.45] },
    ...range(8, (i) => {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      return paddle({ x: 1.62 + Math.cos(a) * 0.016, y: 0.97, z: 2.45 + Math.sin(a) * 0.016, a, tilt: -0.9 - hash1(i * 7) * 0.7 }, { len: 0.07 + hash1(i * 3) * 0.04, wid: 0.05, bend: 0.03 });
    }),
    // the kitchen table: two places, one still used
    { geo: cyl(0.036, 0.032, 0.075, 12), mat: glaze, at: [2.72, 0.775, 1.5] },
    { geo: cyl(0.09, 0.085, 0.012, 14), mat: glaze, at: [2.96, 0.744, 1.74] },
    { geo: box(0.16, 0.006, 0.22), mat: paper, at: [2.62, 0.741, 1.72], rot: [0, 0.3, 0] },
  );

  // --- bathroom: someone lives here ----------------------------------------
  furSoft.push(
    { geo: cyl(0.032, 0.03, 0.075, 10), mat: glaze, at: [-2.45, 0.838, 2.9] }, // brushes in a mug
    { geo: cyl(0.005, 0.005, 0.16, 6), mat: black, at: [-2.45, 0.9, 2.9], rot: [0.12, 0, 0.16] },
    { geo: cyl(0.005, 0.005, 0.16, 6), mat: booksA, at: [-2.462, 0.895, 2.888], rot: [0.1, 0, -0.14] },
    { geo: cyl(0.028, 0.03, 0.1, 10), mat: glaze, at: [-2.95, 0.85, 2.88] }, // soap
    { geo: box(0.3, 0.05, 0.16), mat: laundry2, at: [-2.1, 1.19, 2.66] }, // folded towels on the shelf
    { geo: box(0.28, 0.045, 0.15), mat: laundryMat, at: [-2.1, 1.238, 2.66], rot: [0, 0.12, 0] },
    { geo: cyl(0.05, 0.05, 0.28, 10), mat: laundryMat, at: [-2.9, 0.062, 3.98], rot: [0, 0, Math.PI / 2] }, // a rolled towel, on its side
  );

  // --- hall: shoes, a coat, a bag, a mat -----------------------------------
  furSoft.push(
    { geo: box(0.24, 0.055, 0.1), mat: leather, at: [0.12, 0.028, 2.98], rot: [0, 0.4, 0] },
    { geo: box(0.24, 0.055, 0.1), mat: leather, at: [0.22, 0.028, 2.9], rot: [0, -0.2, 0] },
    { geo: box(0.25, 0.014, 0.11), mat: rubber, at: [0.12, 0.007, 2.98], rot: [0, 0.4, 0] },
    { geo: box(0.02, 0.5, 0.28), mat: duvetMat, at: [0.31, 1.34, 3.22] }, // a coat on the hooks
    { geo: box(0.16, 0.22, 0.1), mat: laundryMat, at: [0.2, 0.948, 3.62] }, // a tote on the console
    { geo: box(0.62, 0.012, 0.42), mat: bedRug, at: [-0.5, 0.006, 3.92] }, // the door mat
  );

  // --- bedroom: the side of the bed that gets used -------------------------
  furSoft.push(
    { geo: box(0.56, 0.1, 0.38), mat: pillowMat, at: [0.88, 0.5, 5.32], rot: [0, 0.12, 0.03] }, // a second pillow
    { geo: box(1.36, 0.07, 0.24), mat: laundry2, at: [1.2, 0.535, 5.55] }, // a folded throw at the head
    { geo: cyl(0.035, 0.032, 0.08, 12), mat: glaze, at: [-2.6, 0.8, 6.1] }, // a mug on the desk
    { geo: box(0.21, 0.006, 0.29), mat: paper, at: [-2.98, 0.764, 6.05], rot: [0, -0.2, 0] }, // a page
    // a floor plant in the bedroom's north-east corner, beside the head of
    // the bed (collider in full-level.js; clear of both bedroom spawns, the
    // door route and every capture camera)
    { geo: cyl(0.14, 0.11, 0.24, 16), mat: terracotta, at: [1.7, 0.12, 4.5] },
    { geo: cyl(0.155, 0.145, 0.04, 16), mat: terracotta, at: [1.7, 0.255, 4.5] },
    { geo: cyl(0.132, 0.132, 0.02, 14), mat: soil, at: [1.7, 0.27, 4.5] },
    ...range(9, (i) => {
      const a = (i / 9) * Math.PI * 2 + hash1(i * 3 + 20) * 0.4;
      return paddle(
        { x: 1.7 + Math.cos(a) * 0.045, y: 0.3 + 0.14, z: 4.5 + Math.sin(a) * 0.045, a, tilt: -0.5 - hash1(i * 9) * 0.5 },
        { len: 0.22 + hash1(i * 5) * 0.1, wid: 0.17 + hash1(i * 11) * 0.05, bend: 0.12 },
      );
    }),
    ...range(9, (i) => {
      const a = (i / 9) * Math.PI * 2 + hash1(i * 3 + 20) * 0.4;
      return stem({ x: 1.7 + Math.cos(a) * 0.045, y: 0.3, z: 4.5 + Math.sin(a) * 0.045, a, tilt: -1.1 - hash1(i * 9) * 0.25 }, 0.16);
    }),
  );

  // --- contact shadows: one InstancedMesh, one draw call, every prop --------
  // This is what makes furniture look like it weighs something. The sun already
  // casts the real shadows; these are the ambient-occlusion-ish pools the
  // shadow map never resolves under a leg or a pot.
  contactShadows(flat, [
    { x: -2.6, z: 0, w: 1.25, d: 2.75, k: 1 }, // couch
    { x: -1.15, z: 0.55, w: 1.15, d: 0.8, k: 0.8 }, // coffee table
    { x: 1.81, z: -2.32, w: 1.5, d: 0.72, k: 0.9 }, // TV stand
    { x: -2.99, z: -2.21, w: 0.6, d: 0.98, k: 1 }, // bookshelf
    { x: -1.655, z: -2.32, w: 0.62, d: 0.62, k: 1 }, // big plant
    { x: 2.62, z: -1.55, w: 0.7, d: 0.7, k: 1 }, // the room.js pot
    { x: 1.75, z: 0.75, w: 0.78, d: 0.62, k: 0.8 }, // cardboard box
    { x: 1.5, z: 2.24, w: 2.05, d: 0.86, k: 1.1 }, // kitchenette
    { x: 2.85, z: 1.62, w: 0.86, d: 0.9, k: 0.9 }, // kitchen table
    { x: 2.35, z: 1.62, w: 0.66, d: 0.66, k: 0.8 }, // its chair
    { x: 0.2, z: 3.5, w: 0.44, d: 0.94, k: 0.8 }, // hall console
    { x: -0.5, z: 3.92, w: 0.86, d: 0.62, k: 0.5 }, // door mat
    { x: -2.72, z: 2.82, w: 0.98, d: 0.56, k: 0.9 }, // vanity
    { x: -1.68, z: 3.86, w: 0.6, d: 0.78, k: 0.9 }, // toilet
    { x: 1.2, z: 5.8, w: 1.9, d: 2.05, k: 1.15 }, // bed
    { x: 0.25, z: 5.15, w: 0.66, d: 0.66, k: 0.85 }, // nightstand
    { x: -0.45, z: 6.2, w: 0.86, d: 0.66, k: 0.75 }, // laundry basket
    { x: -2.84, z: 5.7, w: 0.86, d: 1.26, k: 0.95 }, // desk
    { x: 1.7, z: 4.5, w: 0.5, d: 0.5, k: 1 }, // the new plant
    { x: 0.16, z: 2.94, w: 0.6, d: 0.34, k: 0.5 }, // shoes
  ]);

  mergedMesh(flat, fur);
  mergedMesh(flat, furSoft, { cast: false });

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
    // every plaster slab as an AABB, from the definitions that got built
    // (src/reach.js measures the walls you can actually see)
    wallBoxes: [...living.wallBoxes, ...walls.map((d, i) => slabAABB(d, `full#${i}`))],
  };
}
