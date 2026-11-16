/*!
 * game/full-bath-mesh.js — the bathroom and the balcony, drawn (issue #49, parent #33).
 *
 * game/full-bath.js holds the two rooms' numbers; this file puts geometry on
 * them and nothing else — the same split game/full-kitchen.js /
 * game/full-kitchen-mesh.js and game/full-living.js / game/full-living-mesh.js
 * set up. PIECES become one world-baked mesh each with its ruler row copied
 * into `userData.scale` (or its measured group into `userData.scaleGroup`),
 * DETAILS become merged draws per material, and the walk-over dressing — tile
 * bands, decking, the frosted window — is built from the rooms' own constants.
 *
 * The curtain is the one named object: a mesh called `shower-curtain`, no
 * scale row, no pad, so a later chunk can wire a `hide:` beat to it without
 * hunting for it. It is cloth gathered on a rod — fifteen alternating folds
 * between the rod's ends, bottoms 7 cm over the tub's rim because real
 * curtains hang above the rim, not inside the well.
 *
 * Nothing casts a shadow (the flat's shadow pass is spent on the sun; see
 * game/full-living-mesh.js) and everything receives. No light either: the rig
 * plus the living lamp is engine's six punctual lights, so the frosted window
 * is emissive, the same honesty the TV glow keeps — a glowing pane that lights
 * nothing reads as a light, which is exactly what it is pretending to be.
 */
import * as THREE from 'three';
import { SURFACES, surface, fabric, broadLeafGeo } from '../src/polish.js';
import { mergedMesh } from './full-apartment.js';
import {
  BATH, BALCONY, PIECES, DETAILS, CURTAIN, BALCONY_PLANT, BIRD,
} from './full-bath.js';
import { plantLeaves } from './full-living.js';

/** The two rooms' material slots — every one procedural (src/polish.js),
 *  nothing custom-drawn. Marble and porcelain are the same trick the kitchen
 *  counter uses: a pale `surface()` with a tight uvTile so the graining
 *  reads at arm's length. */
function bathMaterials() {
  return {
    porcelain: surface(0xf1efe9, { uvTile: 0.45, roughness: 0.16, metalness: 0.04 }), // tub, toilet, sink
    porcelainPale: surface(0xe3e0d7, { uvTile: 0.4, roughness: 0.3 }), // the well's inner wall, a tone down
    dark: surface(0x2a2d31, { uvTile: 0.3, roughness: 0.6 }), // the bowl's water, shadows under things
    marble: surface(0xe9e6de, { uvTile: 0.35, roughness: 0.22, metalness: 0.05 }), // the vanity's slab
    tile: surface(0xdce3e2, { uvTile: 0.28, roughness: 0.3, metalness: 0.06 }), // the 1.2 m wall band
    woodPale: SURFACES.woodPale(), // the vanity's cabinet
    chrome: surface(0xcbd1d6, { uvTile: 0.2, roughness: 0.2, metalness: 0.85 }), // taps, bar, shower, rod
    mirrorFrame: surface(0xa9b0b6, { uvTile: 0.25, roughness: 0.4, metalness: 0.5 }), // the mirror's frame
    mat: fabric(0x7fa09d), // the bath mat: seafoam loop pile
    towel: fabric(0xbcd6d9), // duck-egg blue, the flat's calm accent
    paper: surface(0xf6f4ee, { uvTile: 0.6, roughness: 0.95 }), // kitchen roll, the bin's bag
    bin: surface(0x8f969c, { uvTile: 0.3, roughness: 0.55, metalness: 0.35 }), // open tin
    curtain: fabric(0xece9e0), // off-white cloth, DoubleSide below
    deckWood: surface(0x93836f, { uvTile: 0.3, roughness: 0.88 }), // weathered decking and bistro wood
    railPanel: surface(0x5f6a74, { uvTile: 0.35, roughness: 0.55, metalness: 0.4 }), // the railing's solid infill
    frost: surface(0xdbe7ec, {
      uvTile: 0.3,
      roughness: 0.7,
      side: THREE.DoubleSide,
      emissive: new THREE.Color(0xbfd8e0), // morning through frosted glass
      emissiveIntensity: 0.55,
    }),
    pot: SURFACES.pot(), // the balcony's floor pot and railing planter
    leaf: SURFACES.leaf(), // the pots' spiral, DoubleSide
  };
}

const size = (p) => [p.x1 - p.x0, p.y1 - p.y0, p.z1 - p.z0];
const centre = (p) => [(p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2, (p.z0 + p.z1) / 2];

/** A box part, baked into world position. */
const boxGeo = (p) => {
  const g = new THREE.BoxGeometry(...size(p));
  g.translate(...centre(p));
  return g;
};

/** A turned part: upright unless the data says `at` + `len` + a rot key, in
 *  which case it is a stub on that axle (the spout, the arm, the paper roll). */
function cylGeo(c) {
  if (c.at && c.len) {
    const g = new THREE.CylinderGeometry(c.rt, c.rb, c.len, 16);
    if (c.rotX) g.rotateX(c.rotX);
    if (c.rotZ) g.rotateZ(c.rotZ);
    g.translate(...c.at);
    return g;
  }
  const g = new THREE.CylinderGeometry(c.rt, c.rb, c.y1 - c.y0, 16);
  g.translate(c.x, (c.y0 + c.y1) / 2, c.z);
  return g;
}

/** The PIECES pass: one mesh per piece, world-baked, tagged with its ruler
 *  row or its measured group — exactly game/full-living-mesh.js's rule. */
function buildPieces(bath, mats) {
  for (const p of PIECES) {
    const mat = mats[p.mat];
    if (p.mat === 'curtain') mat.side = THREE.DoubleSide; // you see both faces of cloth
    const entries = [
      ...p.parts.map((b) => ({ geo: boxGeo(b), mat })),
      ...(p.cyls ?? []).map((c) => ({ geo: cylGeo(c), mat })),
    ];
    if (!entries.length) continue; // the curtain is built by name below
    const meshes = mergedMesh(bath, entries, { cast: false, receive: true });
    for (const m of meshes) {
      m.name = p.id;
      if (p.scale) m.userData.scale = p.scale;
      if (p.group) m.userData.scaleGroup = p.group;
    }
  }
}

/** The shower curtain: fifteen alternating folds on the rod, gathered. The
 *  boxes lean into each other's edges by a millimetre so the zigzag reads as
 *  one cloth from any angle, not as a picket fence. */
function buildCurtain(bath, mats) {
  const C = CURTAIN;
  const step = (C.x1 - C.x0) / C.folds;
  const folds = [];
  for (let i = 0; i < C.folds; i++) {
    const back = i % 2 === 0;
    folds.push({
      x0: C.x0 + i * step - 0.001,
      x1: C.x0 + (i + 1) * step + 0.001,
      y0: C.yBottom,
      y1: C.yTop,
      z0: back ? C.rodZ - C.depth : C.rodZ - 0.006,
      z1: back ? C.rodZ + 0.006 : C.rodZ + C.depth,
    });
  }
  const meshes = mergedMesh(bath, folds.map((b) => ({ geo: boxGeo(b), mat: mats.curtain })), { cast: false });
  for (const m of meshes) m.name = 'shower-curtain';
}

/** The wall-tile band: 1.2 m of tile on every bathroom wall, 1.2 cm proud —
 *  inside the walk rects' 8 cm inset, so a body never touches it and the
 *  furniture (built at its FOOT rects, flush to plaster) simply stands in
 *  front of it. It breaks where the plaster has a job: out of the cased
 *  doorway, and 2 cm under the mirror's sill for the mirror's width. */
function buildTileBand(bath, mats) {
  const T = BATH.tileTop;
  const P = BATH.tileProud;
  const band = (x0, z0, x1, z1, y1 = T) => ({ x0, y0: 0, z0, x1, y1, z1 });
  const mirror = { x0: -3.20, x1: -2.50 }; // PIECES 'bath-mirror', to its frame's edge
  return mergedMesh(
    bath,
    [
      // north wall: full height, except under the mirror's span
      band(BATH.x0, BATH.z0, mirror.x0, BATH.z0 + P),
      band(mirror.x0, BATH.z0, mirror.x1, BATH.z0 + P, 1.08),
      band(mirror.x1, BATH.z0, BATH.x1, BATH.z0 + P),
      // west wall: unbroken — the window's sill is 1.50, above the band
      band(BATH.x0, BATH.z0, BATH.x0 + P, BATH.z1),
      // south wall: the tub stands in front of most of it, drawn anyway
      band(BATH.x0, BATH.z1 - P, BATH.x1, BATH.z1),
      // east wall: broken around the cased opening
      band(BATH.x1 - P, BATH.z0, BATH.x1, BATH.doorLo),
      band(BATH.x1 - P, BATH.doorHi, BATH.x1, BATH.z1),
    ].map((b) => ({ geo: boxGeo(b), mat: mats.tile })),
    { cast: false },
  ).forEach((m) => { m.name = 'bath-tile-band'; });
}

/** The frosted window: a sheet in the shell's own opening, emissive only. */
function buildWindow(bath, mats) {
  const w = BATH.winHi - BATH.winLo;
  const h = BATH.winHead - BATH.winSill;
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(w, h).rotateY(Math.PI / 2), mats.frost);
  sheet.position.set(BATH.x0 + 0.015, (BATH.winSill + BATH.winHead) / 2, (BATH.winLo + BATH.winHi) / 2);
  sheet.name = 'bath-window-glow';
  bath.add(sheet);
}

/** The balcony decking: 14 cm boards with a 12 mm drainage gap, running east,
 *  over the shell's slab — walk-over dressing, no collider, no row. */
function buildDecking(bath, mats) {
  const B = BALCONY;
  const boards = [];
  const gap = 0.012;
  const bw = 0.14;
  for (let z = B.z0 + 0.02; z + bw <= B.z1 - 0.06; z += bw + gap) {
    boards.push({ x0: B.x0 + 0.02, y0: 0, z0: z, x1: B.x1 - 0.02, y1: 0.022, z1: z + bw });
  }
  mergedMesh(bath, boards.map((b) => ({ geo: boxGeo(b), mat: mats.deckWood })), { cast: false })
    .forEach((m) => { m.name = 'balcony-decking'; });
}

/** The dressing pass: every plant and detail in ONE merged call, because
 *  `mergedMesh` groups by material — one draw per material across the whole
 *  bath-balcony group, and the draw-call budget is the flat's scarcest room.
 *  Nothing here is measured, tagged or a collider: the same policy as the
 *  living room's DETAILS. The plants ride the living room's `plantLeaves`
 *  spiral, seeded by name, so both pots are deterministic. */
function buildDressing(bath, mats) {
  const D = DETAILS;
  const P = BALCONY_PLANT;
  const C = CURTAIN;
  const entries = [];

  // porcelain: the tank and its lid stand behind the tagged bowl
  for (const b of [D.tank, D.tankLid]) entries.push({ geo: boxGeo(b), mat: mats.porcelain });
  // dark: the bowl's water shadow, the pot's soil, the sparrow on the rail
  entries.push({ geo: boxGeo(D.bowlWell), mat: mats.dark });
  entries.push({ geo: cylGeo({ x: P.x, z: P.z, y0: P.y0 + P.pot.h - 0.012, y1: P.y0 + P.pot.h, rt: P.pot.r1 - 0.012, rb: P.pot.r1 - 0.012 }), mat: mats.dark });
  const B = BIRD; // facing the glass door, body / head / tail
  entries.push({ geo: boxGeo({ x0: B.x - 0.035, y0: 1.145, z0: B.z - 0.03, x1: B.x + 0.035, y1: 1.185, z1: B.z + 0.03 }), mat: mats.dark });
  entries.push({ geo: boxGeo({ x0: B.x - 0.02, y0: 1.185, z0: B.z + 0.0, x1: B.x + 0.015, y1: 1.215, z1: B.z + 0.035 }), mat: mats.dark });
  entries.push({ geo: boxGeo({ x0: B.x + 0.03, y0: 1.15, z0: B.z - 0.055, x1: B.x + 0.045, y1: 1.165, z1: B.z - 0.03 }), mat: mats.dark });
  // chrome: mirror glass, paper arm, every fitting — and the curtain's rod,
  // which hangs here rather than with the cloth so the rod is not a draw
  entries.push({ geo: boxGeo(D.mirrorGlass), mat: mats.chrome });
  entries.push({ geo: boxGeo(D.paperArm), mat: mats.chrome });
  for (const c of [D.tubSpout, D.tapW, D.tapE, D.showerArm, D.showerHead]) entries.push({ geo: cylGeo(c), mat: mats.chrome });
  entries.push({ geo: cylGeo({ rt: 0.011, rb: 0.011, len: C.x1 - C.x0 + 0.06, rotZ: Math.PI / 2, at: [(C.x0 + C.x1) / 2, C.rodY, C.rodZ] }), mat: mats.chrome });
  for (const bx_ of [C.x0 - 0.02, C.x1 + 0.02]) {
    entries.push({ geo: cylGeo({ rt: 0.016, rb: 0.016, len: 0.03, rotZ: Math.PI / 2, at: [bx_, C.rodY, C.rodZ] }), mat: mats.chrome });
  }
  // towel, paper, bin: one material each
  for (const b of [D.towel, D.towelBack]) entries.push({ geo: boxGeo(b), mat: mats.towel });
  entries.push({ geo: cylGeo(D.paperRoll), mat: mats.paper });
  entries.push({ geo: boxGeo(D.bin), mat: mats.bin });
  // pots: the floor pot and the railing's trough planter
  entries.push({ geo: cylGeo({ x: P.x, z: P.z, y0: P.y0, y1: P.y0 + P.pot.h, rt: P.pot.r1, rb: P.pot.r0 }), mat: mats.pot });
  const tr = BIRD.pot;
  entries.push({ geo: boxGeo({ x0: tr.x - 0.16, y0: tr.y, z0: tr.z - 0.055, x1: tr.x + 0.16, y1: tr.y + 0.145, z1: tr.z + 0.055 }), mat: mats.pot });
  // leaves: the floor pot's spiral and the trough's blades, UVs kept as drawn
  const base = broadLeafGeo(P.leaf);
  for (const lf of plantLeaves({ name: 'balcony-floor-pot', pot: P.pot, leaf: { n: P.count } })) {
    const g = base.clone();
    g.scale(lf.scale, lf.scale, lf.scale);
    g.rotateY(lf.yaw);
    g.rotateX(-lf.tilt);
    g.translate(P.x + lf.at[0], P.y0 + lf.at[1], P.z + lf.at[2]);
    entries.push({ geo: g, mat: mats.leaf, keepUV: true });
  }
  const tbase = broadLeafGeo({ len: 0.16, wid: 0.11, bend: 0.05 });
  const tspec = { name: 'railing-planter', pot: { h: 0.145 }, leaf: { n: 5 } };
  for (const [i, lf] of [...plantLeaves(tspec)].entries()) {
    const g = tbase.clone();
    g.scale(0.85, 0.85, 0.85);
    g.rotateY(lf.yaw);
    g.rotateX(-lf.tilt);
    g.translate(tr.x - 0.10 + i * 0.05, tr.y + lf.at[1], tr.z + lf.at[2] * 0.4);
    entries.push({ geo: g, mat: mats.leaf, keepUV: true });
  }

  mergedMesh(bath, entries, { cast: false });
}

/** Everything the data describes, hung under one group. */
export function buildFullBath(parent) {
  const mats = bathMaterials();
  const bath = new THREE.Group();
  bath.name = 'bath-balcony';
  parent.add(bath);

  buildPieces(bath, mats);
  buildCurtain(bath, mats);
  buildTileBand(bath, mats);
  buildWindow(bath, mats);
  buildDecking(bath, mats);
  buildDressing(bath, mats);

  // standing policy of both built rooms: nothing casts, everything receives.
  bath.traverse((o) => {
    if (o.isMesh && !o.material.transparent) o.receiveShadow = true;
    if (o.isMesh) o.castShadow = false;
  });
  return bath;
}
