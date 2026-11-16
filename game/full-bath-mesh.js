/*!
 * game/full-bath-mesh.js — the bathroom and the balcony, drawn (issue #49, parent #33).
 *
 * game/full-bath.js holds the two rooms' numbers; this file puts geometry on
 * them and nothing else — the same split game/full-kitchen.js /
 * game/full-kitchen-mesh.js and game/full-living.js / game/full-living-mesh.js
 * set up. The difference is the budget: the flat's worst capture frame on main
 * is 139 draws against tools/capture.mjs's 150, so the two rooms ship as
 * ELEVEN meshes, grouped in game/full-bath.js's header. PIECES are the six
 * meshes the ruler measures (one draw each, `userData.scale` carrying their
 * row); the curtain is the one named object; everything else — bathroom
 * hardware, the balcony's joinery, the two plant spirals, the frosted pane —
 * rides three merged chunks plus the emissive sheet. `mergedMesh` bakes by
 * material, so a chunk whose entries all share a material is a single draw.
 *
 * The curtain keeps its own mesh even though it shares nothing: a mesh called
 * `shower-curtain`, no scale row, no pad, so a later chunk can wire a `hide:`
 * beat to it without hunting for it. It is cloth gathered on a rod — fifteen
 * alternating folds between the rod's ends, bottoms 7 cm over the tub's rim
 * because real curtains hang above the rim, not inside the well. The rod
 * itself is enamel and rides the fittings chunk.
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
  BATH, BALCONY, PIECES, FITTINGS, BALCONY_BUILD, CURTAIN, BALCONY_PLANT,
} from './full-bath.js';
import { plantLeaves } from './full-living.js';

/** Nine materials for eleven meshes — marble, porcelain, chrome, two fabrics,
 *  curtain cloth, weathered wood, frost, leaf. Every one procedural
 *  (src/polish.js), nothing custom-drawn. Marble and porcelain are the same
 *  trick the kitchen counter uses: a pale `surface()` with a tight uvTile so
 *  the graining reads at arm's length. */
function bathMaterials() {
  return {
    porcelain: surface(0xf1efe9, { uvTile: 0.45, roughness: 0.16, metalness: 0.04 }), // toilet, tub, and every white-enamel fitting
    marble: surface(0xe9e6de, { uvTile: 0.35, roughness: 0.22, metalness: 0.05 }), // the one stone vanity
    chrome: surface(0xb9c6cd, {
      uvTile: 0.2,
      roughness: 0.12,
      metalness: 0.0,
      emissive: new THREE.Color(0x6f8792), // a looking-glass sheen: with no env map to reflect, a real metal renders black (the red-debug pass proved it) — this reads as silvered glass from any angle, the same honesty the frost pane and TV glow keep
      emissiveIntensity: 0.35,
    }), // the mirror: frame and glass
    mat: fabric(0x7fa09d), // the bath mat: seafoam loop pile
    towel: fabric(0xbcd6d9), // duck-egg blue, the flat's calm accent — wrapped bar and draped towel
    curtain: fabric(0xece9e0), // off-white cloth, DoubleSide below
    deckWood: surface(0x93836f, { uvTile: 0.3, roughness: 0.88 }), // decking, rail panels, chair, table, pots: the whole balcony chunk
    frost: surface(0xdbe7ec, {
      uvTile: 0.3,
      roughness: 0.7,
      side: THREE.DoubleSide,
      emissive: new THREE.Color(0xbfd8e0), // morning through frosted glass
      emissiveIntensity: 0.55,
    }),
    leaf: SURFACES.leaf(), // the two plant spirals, DoubleSide
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

/** The PIECES pass: the six meshes the ruler measures — vanity, toilet, tub,
 *  mirror, towel bar, mat — one world-baked draw each, tagged with its row.
 *  Exactly game/full-living-mesh.js's rule; the curtain stub draws nothing
 *  here and is built by name below. */
function buildPieces(bath, mats) {
  for (const p of PIECES) {
    const mat = mats[p.mat];
    if (p.mat === 'curtain') mat.side = THREE.DoubleSide; // you see both faces of cloth
    const entries = [
      ...p.parts.map((b) => ({ geo: boxGeo(b), mat })),
      ...p.cyls.map((c) => ({ geo: cylGeo(c), mat })),
    ];
    if (!entries.length) continue;
    const meshes = mergedMesh(bath, entries, { cast: false, receive: true });
    for (const m of meshes) {
      m.name = p.id;
      if (p.scale) m.userData.scale = p.scale;
    }
  }
}

/** The shower curtain: fifteen alternating folds on the rod, gathered. The
 *  boxes lean into each other's edges by a millimetre so the zigzag reads as
 *  one cloth from any angle, not as a picket fence. Folds only — the rod,
 *  being enamel, hangs in the fittings chunk. */
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

/** The fittings chunk: ONE porcelain (white enamel) draw carrying all of it —
 *  the 1.2 m wall-tile band, the paper holder and roll, taps, spout, shower
 *  arm and head, the curtain's rod in its brackets, the bin, the soil discs,
 *  and the porcelain sparrow on the balcony's cap rail. White enamel fittings
 *  were the norm in exactly this bathroom, and one material here is one draw
 *  the budget keeps. The tile band breaks where the plaster has a job: out of
 *  the cased doorway, and 2 cm under the mirror for the mirror's width; it
 *  stands 1.2 cm proud, inside the walk rects' 8 cm inset, so furniture built
 *  flush to plaster simply stands in front of it. */
function buildFittings(bath, mats) {
  const F = FITTINGS;
  const C = CURTAIN;
  const T = BATH.tileTop;
  const P_ = BATH.tileProud;
  const band = (x0, z0, x1, z1, y1 = T) => ({ x0, y0: 0, z0, x1, y1, z1 });
  const mirror = { x0: -3.20, x1: -2.50 }; // PIECES 'bath-mirror', to its frame's edge
  const entries = [];
  // the wall band (tile reads as enamel against enamel)
  entries.push(
    { geo: boxGeo(band(BATH.x0, BATH.z0, mirror.x0, BATH.z0 + P_)), mat: mats.porcelain },
    { geo: boxGeo(band(mirror.x0, BATH.z0, mirror.x1, BATH.z0 + P_, 1.08)), mat: mats.porcelain },
    { geo: boxGeo(band(mirror.x1, BATH.z0, BATH.x1, BATH.z0 + P_)), mat: mats.porcelain },
    { geo: boxGeo(band(BATH.x0, BATH.z0, BATH.x0 + P_, BATH.z1)), mat: mats.porcelain },
    { geo: boxGeo(band(BATH.x0, BATH.z1 - P_, BATH.x1, BATH.z1)), mat: mats.porcelain },
    { geo: boxGeo(band(BATH.x1 - P_, BATH.z0, BATH.x1, BATH.doorLo)), mat: mats.porcelain },
    { geo: boxGeo(band(BATH.x1 - P_, BATH.doorHi, BATH.x1, BATH.z1)), mat: mats.porcelain },
  );
  // the hardware
  entries.push({ geo: boxGeo(F.paperArm), mat: mats.porcelain });
  entries.push({ geo: cylGeo(F.paperRoll), mat: mats.porcelain });
  for (const c of [F.tubSpout, F.tapW, F.tapE, F.showerArm, F.showerHead]) entries.push({ geo: cylGeo(c), mat: mats.porcelain });
  entries.push({ geo: cylGeo({ rt: 0.011, rb: 0.011, len: C.x1 - C.x0 + 0.06, rotZ: Math.PI / 2, at: [(C.x0 + C.x1) / 2, C.rodY, C.rodZ] }), mat: mats.porcelain });
  for (const bx_ of [C.x0 - 0.02, C.x1 + 0.02]) {
    entries.push({ geo: cylGeo({ rt: 0.016, rb: 0.016, len: 0.03, rotZ: Math.PI / 2, at: [bx_, C.rodY, C.rodZ] }), mat: mats.porcelain });
  }
  entries.push({ geo: boxGeo(F.bin), mat: mats.porcelain });
  for (const b of F.bird) entries.push({ geo: boxGeo(b), mat: mats.porcelain });
  const meshes = mergedMesh(bath, entries, { cast: false });
  for (const m of meshes) m.name = 'bath-fittings';
}

/** The frosted window: a sheet in the shell's own opening, emissive only —
 *  the brief's "soft light", and a draw the light budget never pays for. */
function buildWindow(bath, mats) {
  const w = BATH.winHi - BATH.winLo;
  const h = BATH.winHead - BATH.winSill;
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(w, h).rotateY(Math.PI / 2), mats.frost);
  sheet.position.set(BATH.x0 + 0.015, (BATH.winSill + BATH.winHead) / 2, (BATH.winLo + BATH.winHi) / 2);
  sheet.name = 'bath-window-glow';
  bath.add(sheet);
}

/** The balcony chunk: ONE weathered-wood draw — decking boards over the
 *  shell's slab (14 cm boards, a 12 mm drainage gap, running east), the solid
 *  railing panels to 1.00 (row 59, and the chunk's measured top: if the
 *  panels ever go, the `railing` row drops with them, which is what the row
 *  is for), the folding chair on the placeholder's exact footprint (so the
 *  `chairSeat` support still lands on it), the bistro table, and both pots.
 *  Panels 0.02 … 1.00 with no cap and no shelf: nothing to sit on, no step
 *  for a cat, and the walk rect plus its 0.30 pad hold a body off the line. */
function buildBalcony(bath, mats) {
  const B = BALCONY;
  const BB = BALCONY_BUILD;
  const entries = [];
  for (let z = B.z0 + 0.02; z + B.boardW <= B.z1 - 0.06; z += B.boardW + B.boardGap) {
    entries.push({ geo: boxGeo({ x0: B.x0 + 0.02, y0: 0, z0: z, x1: B.x1 - 0.02, y1: B.boardTop, z1: z + B.boardW }), mat: mats.deckWood });
  }
  for (const b of [...BB.panels, ...BB.chair, BB.planter]) entries.push({ geo: boxGeo(b), mat: mats.deckWood });
  for (const c of BB.table) entries.push({ geo: cylGeo(c), mat: mats.deckWood });
  const pot = BB.pot;
  entries.push({ geo: cylGeo({ x: pot.x, z: pot.z, y0: pot.y0, y1: pot.y0 + pot.h, rt: pot.r1, rb: pot.r0 }), mat: mats.deckWood });
  const meshes = mergedMesh(bath, entries, { cast: false });
  for (const m of meshes) {
    m.name = 'balcony';
    m.userData.scale = 'railing'; // the panels ARE this mesh's top
  }
}

/** The leaves chunk: the floor pot's spiral and the planter trough's blades,
 *  the living room's `plantLeaves` rig seeded by name so both are exactly
 *  reproducible. Their own green material, so their own single draw. */
function buildLeaves(bath, mats) {
  const P = BALCONY_PLANT;
  const tr = BALCONY_BUILD.planter;
  const entries = [];
  const base = broadLeafGeo(P.leaf);
  for (const lf of plantLeaves({ name: 'balcony-floor-pot', pot: P.pot, leaf: { n: P.count } })) {
    const g = base.clone();
    g.scale(lf.scale, lf.scale, lf.scale);
    g.rotateY(lf.yaw);
    g.rotateX(-lf.tilt);
    g.translate(P.x + lf.at[0], P.y0 + lf.at[1], P.z + lf.at[2]);
    entries.push({ geo: g, mat: mats.leaf, keepUV: true });
  }
  const trTop = tr.y1;
  const trCx = (tr.x0 + tr.x1) / 2;
  const trCz = (tr.z0 + tr.z1) / 2;
  const tbase = broadLeafGeo({ len: 0.16, wid: 0.11, bend: 0.05 });
  const tspec = { name: 'railing-planter', pot: { h: 0.145 }, leaf: { n: 5 } };
  for (const [i, lf] of [...plantLeaves(tspec)].entries()) {
    const g = tbase.clone();
    g.scale(0.85, 0.85, 0.85);
    g.rotateY(lf.yaw);
    g.rotateX(-lf.tilt);
    g.translate(trCx - 0.10 + i * 0.05, trTop - 0.02 + lf.at[1] * 0.7, trCz + lf.at[2] * 0.3);
    entries.push({ geo: g, mat: mats.leaf, keepUV: true });
  }
  const meshes = mergedMesh(bath, entries, { cast: false });
  for (const m of meshes) m.name = 'balcony-plants';
}

/** Everything the data describes, hung under one group. Eleven meshes:
 *  6 pieces + curtain + fittings + window + balcony + leaves. */
export function buildFullBath(parent) {
  const mats = bathMaterials();
  const bath = new THREE.Group();
  bath.name = 'bath-balcony';
  parent.add(bath);

  buildPieces(bath, mats);
  buildCurtain(bath, mats);
  buildFittings(bath, mats);
  buildWindow(bath, mats);
  buildBalcony(bath, mats);
  buildLeaves(bath, mats);

  // standing policy of both built rooms: nothing casts, everything receives.
  bath.traverse((o) => {
    if (o.isMesh && !o.material.transparent) o.receiveShadow = true;
    if (o.isMesh) o.castShadow = false;
  });
  return bath;
}
