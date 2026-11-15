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
import { floorMap, floorRough, plasterMap, skyMap, canvasTexture } from '../src/textures.js';
import { hash1 } from '../src/util.js';

// -- Step 8 furniture textures: procedural canvases like src/textures.js's,
// built once at import (never in the render path), seeded via hash1 so every
// boot draws the identical pixels (the determinism suites stay byte-exact).
const woodGrain = canvasTexture(256, (ctx, s) => { // plank walnut: grain lines follow the plank
  ctx.fillStyle = 'rgb(104,72,50)'; ctx.fillRect(0, 0, s, s);
  const plank = s / 4;
  for (let i = 0; i < 4; i++) {
    const tint = 0.92 + hash1(i * 7 + 3) * 0.16;
    ctx.fillStyle = `rgb(${Math.round(104 * tint)},${Math.round(72 * tint)},${Math.round(50 * tint)})`;
    ctx.fillRect(0, i * plank, s, plank - 1.5);
    for (let k = 0; k < 22; k++) { // long wavy grain
      const gy = i * plank + (0.08 + hash1(i * 17 + k) * 0.84) * plank;
      ctx.strokeStyle = `rgba(46,28,16,${0.1 + hash1(k * 3 + i) * 0.13})`;
      ctx.lineWidth = 1 + hash1(k + i * 5);
      ctx.beginPath(); ctx.moveTo(0, gy);
      ctx.bezierCurveTo(s * 0.3, gy + hash1(k * 7) * 6 - 3, s * 0.6, gy + hash1(k * 11) * 8 - 4, s, gy + hash1(k * 13) * 4 - 2);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(38,22,12,0.8)'; ctx.fillRect(0, (i + 1) * plank - 2, s, 2);
  }
}, { repeat: [2, 2] });
const marbleTop = canvasTexture(256, (ctx, s) => // laminate worktop + porcelain: warm white, grey veins
  {
    ctx.fillStyle = 'rgb(236,235,230)'; ctx.fillRect(0, 0, s, s);
    for (let v = 0; v < 7; v++) {
      let x = hash1(v * 3 + 1) * s;
      let y = hash1(v * 5 + 2) * s;
      ctx.strokeStyle = `rgba(140,148,155,${0.16 + hash1(v) * 0.14})`;
      ctx.lineWidth = 0.8 + hash1(v * 9) * 1.6;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let st = 0; st < 9; st++) {
        x += (hash1(v * 17 + st) - 0.35) * 34;
        y += (hash1(v * 23 + st * 3) - 0.5) * 26;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = `rgba(212,214,210,${hash1(i * 1.3) * 0.5})`;
      ctx.fillRect(hash1(i) * s, hash1(i * 2) * s, 2, 2);
    }
  }, { repeat: [2, 1] });
const tileGrid = canvasTexture(256, (ctx, s) => // bathroom tiles with grout and a soft sheen
  {
    ctx.fillStyle = 'rgb(196,201,196)'; ctx.fillRect(0, 0, s, s);
    const n = 4;
    const t = s / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const g = 0.97 + hash1(i * 11 + j * 7) * 0.05;
      ctx.fillStyle = `rgb(${Math.round(214 * g)},${Math.round(224 * g)},${Math.round(218 * g)})`;
      ctx.fillRect(i * t + 2, j * t + 2, t - 4, t - 4);
      ctx.fillStyle = `rgba(255,255,255,${0.05 + hash1(i * 5 + j) * 0.07})`;
      ctx.fillRect(i * t + 4, j * t + 4, t - 8, (t - 8) * 0.35);
    }
  }, { repeat: [5, 5] });
const fabricWeave = canvasTexture(128, (ctx, s) => // bedding/towels: over-under weave + fibre noise
  {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 4) { ctx.fillStyle = 'rgba(60,60,70,0.05)'; ctx.fillRect(x, 0, 2, s); }
    for (let y = 0; y < s; y += 4) {
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect((Math.floor(y / 4) % 2) * 2, y, s, 2);
      ctx.fillStyle = 'rgba(60,60,70,0.035)'; ctx.fillRect(0, y + 2, s, 1);
    }
    for (let i = 0; i < 700; i++) {
      const g = Math.round(235 + hash1(i * 2.7) * 18);
      ctx.fillStyle = `rgb(${g},${g},${g})`;
      ctx.fillRect(hash1(i + 40) * s, hash1(i + 77) * s, 2, 2);
    }
  }, { repeat: [2, 2] });
const tvGlass = canvasTexture(128, (ctx, s) => // the TV is OFF: near-black with one diagonal sheen
  {
    const g = ctx.createLinearGradient(0, 0, s, s);
    g.addColorStop(0, '#0d1116'); g.addColorStop(0.55, '#070a0e'); g.addColorStop(1, '#0c1017');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(-10, s * 0.75); ctx.lineTo(s * 0.7, -10); ctx.stroke();
  });

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, seg = 18) => new THREE.CylinderGeometry(rt, rb, h, seg);
const cone = (r, h, seg = 6) => new THREE.ConeGeometry(r, h, seg);

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
  const walnut = std(TOKENS.walnut, { roughness: 0.6, map: woodGrain }); // every wooden prop carries the grain
  const ceramic = std(TOKENS.uiPaper, { roughness: 0.3, map: marbleTop }); // worktop laminate + porcelain
  const mirror = new THREE.MeshBasicMaterial({ color: 0x9db3bd }); // a flat readable slate (no envmap here)
  const tile = std(0xcfd6d2, { roughness: 0.25, map: tileGrid }); // bathroom floor
  const weaved = (color, r) => std(color, { roughness: r, map: fabricWeave }); // fabric family

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
  const bedding = weaved(TOKENS.uiPaper, 0.92);
  mergedMesh(flat, [{ geo: box(1.4, 0.18, 1.6), mat: bedding, at: [1.2, 0.35, 5.8] }]);
  const duvetMat = weaved(TOKENS.couch, 0.92);
  mergedMesh(flat, [{ geo: box(1.44, 0.1, 1.12), mat: duvetMat, at: [1.2, 0.45, 6.06] }]);
  const pillowMat = weaved(TOKENS.pillow, 0.9);
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
  const laundryMat = weaved(TOKENS.uiMustard, 0.95);
  // the pile a cat naps on — laundryTop (0.18) is MEASURED from this mesh
  const [laundryMesh] = mergedMesh(flat, [{ geo: cyl(0.27, 0.24, 0.1, 14), mat: laundryMat, at: [-0.45, 0.13, 6.2] }], { cast: true });
  const laundry2 = weaved(TOKENS.uiCoral, 0.95);
  mergedMesh(flat, [{ geo: cyl(0.16, 0.14, 0.04, 12), mat: laundry2, at: [-0.4, 0.16, 6.18], rot: [0, 0.6, 0] }], { cast: true });

  // ---- bathroom furniture: ceramics + a towel + a mat ----
  mergedMesh(flat, [
    { geo: box(0.35, 0.42, 0.5), mat: ceramic, at: [-1.675, 0.21, 3.87] }, // toilet bowl
    { geo: box(0.36, 0.04, 0.5), mat: ceramic, at: [-1.675, 0.44, 3.85] }, // seat
    { geo: box(0.35, 0.4, 0.16), mat: ceramic, at: [-1.675, 0.62, 4.04] }, // cistern
  ]);
  mergedMesh(flat, [{ geo: box(0.03, 0.5, 0.3), mat: weaved(TOKENS.uiCoral, 0.95), at: [-3.125, 1.25, 3.7] }], { cast: true });
  mergedMesh(flat, [{ geo: box(0.62, 0.012, 0.42), mat: weaved(TOKENS.rug, 0.98), at: [-2.55, 0.006, 3.58] }], { cast: false });

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
  const booksA = weaved(TOKENS.uiCoral, 0.85); // book spines, a magazine, an apple
  const booksB = weaved(TOKENS.uiMustard, 0.85);
  const terracotta = std(0xb0694c, { roughness: 0.85 }); // flower pots
  const soil = std(0x4a3628, { roughness: 0.95 });
  const shade = std(TOKENS.lampShade, { roughness: 0.85 }); // bedside lamp
  const foliage = std(TOKENS.leaf, { roughness: 0.65, map: fabricWeave });
  foliage.side = THREE.DoubleSide; // broad blades read from both sides
  const curtainBedroom = std(0xe9e2d4, { roughness: 0.98, map: fabricWeave });
  const bedRug = weaved(TOKENS.rug, 0.98);
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
    new THREE.MeshBasicMaterial({ map: tvGlass }), // off: near-black, one sheen
  );
  tvScreen.position.set(1.81, 0.75, -2.432);
  tvScreen.userData.tag = 'tv';
  flat.add(tvScreen);

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
    { geo: cyl(0.05, 0.07, 0.02, 12), mat: metal, at: [0.25, 0.45, 5.15] }, // bedside lamp
    { geo: cyl(0.012, 0.012, 0.2, 8), mat: metal, at: [0.25, 0.55, 5.15] },
    { geo: cyl(0.1, 0.13, 0.15, 12, true), mat: shade, at: [0.25, 0.68, 5.15] },
  );
  furSoft.push(
    { geo: box(1.3, 0.012, 0.5), mat: bedRug, at: [1.2, 0.006, 4.72] },
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
  for (let i = 0; i < 9; i++) { // upright sword cluster
    const a = (i / 9) * Math.PI * 2 + hash1(i) * 0.4;
    const h = 0.42 + hash1(i * 7) * 0.26;
    const tilt = 0.16 + hash1(i * 13) * 0.2;
    furSoft.push({ geo: cone(0.021, h, 5), mat: foliage, at: [-1.655 + Math.cos(a) * 0.06, 0.37 + h / 2 - 0.02, -2.32 + Math.sin(a) * 0.06], rot: [Math.sin(a) * tilt, 0, -Math.cos(a) * tilt] });
  }
  for (let i = 0; i < 6; i++) { // broad leaves on drooping stems
    const a = (i / 6) * Math.PI * 2 + 0.5;
    const L = 0.3 + hash1(i * 3 + 40) * 0.1;
    const leaf = new THREE.PlaneGeometry(0.085, L, 1, 3);
    leaf.translate(0, L / 2, 0);
    furSoft.push({ geo: leaf, mat: foliage, at: [-1.655 + Math.cos(a) * 0.11, 0.5, -2.32 + Math.sin(a) * 0.11], rot: [Math.sin(a) * 0.95, -a, -Math.cos(a) * 0.95] });
  }
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
  };
}
