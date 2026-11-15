// src/room.js — the room: a slice of a believable modern apartment, plus the
// lighting rig (docs/ART_STYLE.md §4). Extracted verbatim from
// design/style-test/styletest.js and wrapped as a factory: every static prop
// is merged into one mesh per material (~18 draws for the whole apartment),
// and the supports the cats stand on are MEASURED, not assumed.

import * as THREE from 'three';
import { TOKENS } from './tokens.js';
import { std } from './materials.js';
import { floorMap, floorRough, plasterMap, rugMap, couchMap, skyMap } from './textures.js';
import { slabAABB } from './reach.js';

/** Build the apartment slice and its lights into `scene`.
 *  Returns { room, SUPPORTS, hemi, sun, lampLight, WALL_Z, wallBoxes }. */
export function buildRoom(scene) {

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
const shellWalls = [
  { geo: box(2.05, 2.6, 0.12), mat: plasterMat, at: [-2.175, 1.3, WALL_Z] },
  { geo: box(2.05, 2.6, 0.12), mat: plasterMat, at: [2.175, 1.3, WALL_Z] },
  { geo: box(2.3, 0.5, 0.12), mat: plasterMat, at: [0, 0.25, WALL_Z] },
  { geo: box(2.3, 0.6, 0.12), mat: plasterMat, at: [0, 2.3, WALL_Z] },
  { geo: box(0.12, 2.6, 5.2), mat: plasterMat, at: [-3.2, 1.3, 0] },
];
mergedMesh(shellWalls, { tag: 'wall' });

// what the window looks out on: the flat, tone-mapping-exempt sky (its texture
// is built once in src/textures.js), so the sunlit opening stays bright without
// turning the room into a blown-out white box
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

  return {
    room,
    SUPPORTS,
    hemi,
    sun,
    lampLight,
    WALL_Z,
    /** Every plaster slab as an AABB, for the reachability/wall checks in
     *  src/reach.js (issue #27). Derived from the same definitions that got
     *  built, so a wall can never be "fixed" in one place only. */
    wallBoxes: shellWalls.map((d, i) => slabAABB(d, `living#${i}`)),
  };
}
