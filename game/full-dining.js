/*!
 * game/full-dining.js — the dining room as DATA (issue #81).
 *
 * The room is game/full-shell.js's new L — x [2.60, 5.52], z [0.80, 4.40]
 * minus the entry's east band — reached through two cased openings: 0.90 m
 * from the kitchen (door-kitchen-dining) and 1.22 m from the living room
 * (door-living-dining), with its own window on the south exterior line. The
 * issue asks for one thing in this room: a real dining set — round table,
 * 1.00 … 1.10 m across, 0.75 high, four chairs, seat 0.45, back 0.86 — plus
 * a pendant over the table (emissive only: the rig is at its six lights),
 * a sideboard, and art. Like game/full-living.js this file draws nothing:
 * game/full-dining-mesh.js puts geometry on these numbers, game/full-level.js
 * splices DINING_COLLIDERS, and `furniture-real-scale` measures the ruler
 * rows back off the built boxes.
 *
 * Where everything goes, and why there:
 *   centre the round table at (4.06, 2.28) — on the room's own x centre,
 *          pushed south of the wide arm's middle so all four sides get the
 *          same aisle (to the centimetre west and east, 2.5 cm north and
 *          south) and the body walks the full ring; the kitchen door's lane
 *          runs free down the table's west flank, 0.88 m to the first pad;
 *   cardinals the four chairs, at 0.55 m seat-centre radius — the seat faces
 *          tuck 0.20 m under the rim, the position a chair is left in when
 *          someone stands up, measured as the row this file's report prints.
 *          Tucking is what buys the ring its aisle: at the loose 0.62 m
 *          radius the room's 2.92 m of width leaves 0.24 m of centre
 *          channel, which is not a walkway;
 *   south   the sideboard back to the new south plaster, under the window
 *          (top 0.86, sill 0.90: the kitchen counter's under-window
 *          precedent), centred on the table's axis. Its top is what the
 *          bowl and the book stand on (DECOR_HOSTS), and the art hangs on
 *          the window's pier beside it. The body passes the chair/sideboard
 *          row with 0.33 m of centre width — row 58's honest read of a room
 *          that is 2.92 m across carrying 1.54 m of chair spread;
 *   ceiling the pendant on the table's centre, shade at 1.90: 1.15 m over
 *          the top, the height that lights a table and not the room.
 *
 * Every piece stands 0.02 off the plaster, same policy as the living room
 * (baseboards are what furniture stands in front of).
 */

/** --------------------------------------------------------------------------
 *  The ruler, as named constants (issue #81's own numbers, which the room
 *  ships exactly: table dia 1.05 inside the asked 1.00 … 1.10, top 0.75;
 *  chair 0.44 × 0.45, seat 0.45, back 0.86). A name here is what the room is
 *  BUILT at; docs/ISSUE_33_REBUILD.md rows 36/37 are the nearest §1 siblings
 *  of the table and chair, and `furniture-real-scale` measures the
 *  `dining-table` / `dining-chair` / `sideboard` rows of SCALE_RANGES back
 *  off the built boxes.
 *  -------------------------------------------------------------------------- */
export const DIN = {
  // room faces (game/full-shell.js ROOMS.dining — the bounding box; the
  // west edge of the south half is the entry band at x 2.84)
  cx: 4.06, // table centre — the room's x centre, south of the arm's middle
  cz: 2.28,
  offPlaster: 0.02,

  // issue #81: round table, diameter 1.00 … 1.10, top 0.75. Built at 1.05
  // and top exactly 0.75 — the issue's own numbers, mid-range, dead on.
  tableDia: 1.05,
  tableTopY: 0.75,
  tableTopT: 0.04, // the slab, row 13's worktop thickness by habit
  pedestalD: 0.5, // turned column on a base plate, the round table's usual foot
  baseD: 0.62,
  baseH: 0.05,

  // issue #81: four chairs — 0.44 × 0.45 footprint, seat 0.45, back to 0.86.
  // Seat 0.45 is the ruler's own seat row (`seat-height`, 0.38 … 0.50);
  // the back at 0.86 sits inside `dining-chair`'s 0.85 … 1.00 height band.
  chairW: 0.44,
  chairD: 0.45,
  chairSeatY: 0.45,
  chairSeatT: 0.045,
  chairBackY: 0.86,
  chairBackT: 0.04,
  chairLegT: 0.04,
  chairRingR: 0.55, // seat-centre radius: the face tucks 0.20 m under the rim

  // sideboard: 1.28 × 0.40 × 0.86 (SCALE_RANGES row; a real sideboard is
  // ~0.45 deep and its top is chair height so the dishes stack clear) —
  // against the NEW south plaster, under the window's sill at 0.90
  sideX0: 3.6,
  sideX1: 4.88,
  sideZ0: 3.98,
  sideZ1: 4.38,
  sideTopY: 0.86,
  sideTopT: 0.04,

  // pendant over the table — emissive shade only, the kitchen pendants'
  // convention: the rig is at its six lights and a pendant is a glow.
  pendY: 1.9, // shade top; 1.15 m over the table top
  pendShadeR: 0.17,
  pendShadeH: 0.2,
};

/** A footprint rect, the COLLIDERS convention: x0 z0 → x1 z1. */
const F = (x0, z0, x1, z1) => ({ x0, z0, x1, z1 });

/** The chair centres, the four cardinals of the ring (the diagonals are
 *  where chairs fight the door lines; the cardinals keep both openings'
 *  through-routes clear of every push pad). */
export const CHAIRS = [
  { id: 'dining-chair-n', x: DIN.cx, z: DIN.cz - DIN.chairRingR },
  { id: 'dining-chair-e', x: DIN.cx + DIN.chairRingR, z: DIN.cz },
  { id: 'dining-chair-s', x: DIN.cx, z: DIN.cz + DIN.chairRingR },
  { id: 'dining-chair-w', x: DIN.cx - DIN.chairRingR, z: DIN.cz },
];

/** --------------------------------------------------------------------------
 *  FOOT: the drawn footprints, one copy of each number for the colliders,
 *  the mesh and the walkway report (the convention game/full-bath.js and
 *  game/full-living.js keep). The chairs are 0.44 × 0.45; the table's rect
 *  is the disc's AABB, which is exactly what `furniture-real-scale` measures.
 *  -------------------------------------------------------------------------- */
export const FOOT = {
  table: F(DIN.cx - DIN.tableDia / 2, DIN.cz - DIN.tableDia / 2, DIN.cx + DIN.tableDia / 2, DIN.cz + DIN.tableDia / 2),
  sideboard: F(DIN.sideX0, DIN.sideZ0, DIN.sideX1, DIN.sideZ1),
  ...Object.fromEntries(CHAIRS.map((c) => [
    c.id,
    F(c.x - DIN.chairW / 2, c.z - DIN.chairD / 2, c.x + DIN.chairW / 2, c.z + DIN.chairD / 2),
  ])),
};

/** Colliders: spliced into game/full-level.js's COLLIDERS. The table and the
 *  sideboard take a pad (they are 0.75 and 0.86 of body-blocking furniture);
 *  the chairs take one too — 0.45 of chair is not walk-over. */
export const DINING_COLLIDERS = [
  { id: 'dining-table', ...FOOT.table },
  { id: 'sideboard', ...FOOT.sideboard },
  { id: 'dining-chair-n', ...FOOT['dining-chair-n'] },
  { id: 'dining-chair-e', ...FOOT['dining-chair-e'] },
  { id: 'dining-chair-s', ...FOOT['dining-chair-s'] },
  { id: 'dining-chair-w', ...FOOT['dining-chair-w'] },
];

/** --------------------------------------------------------------------------
 *  PIECES: the data game/full-dining-mesh.js builds. Same `piece()` shape as
 *  game/full-living.js: boxes plus optional turned parts, one ruler row (or
 *  shared scale) claimed per built envelope. The four chairs all carry the
 *  SCALAR tag `dining-chair` — `furniture-real-scale` measures each mesh
 *  against its row separately, so all four chairs are measured, not a union.
 *  -------------------------------------------------------------------------- */
const bx = (x0, y0, z0, x1, y1, z1) => ({ x0, y0, z0, x1, y1, z1 });
const piece = (id, mat, parts, scale = null, note = '', cyls = []) => ({
  id, mat, parts, scale, note,
});

const TB = FOOT.table;

/** Because a turned chair would measure a rotated AABB, every chair is built
 *  axis-aligned (the issue's 0.44 × 0.45 footprint is what the box measures
 *  back); only the BACK panel moves to the side away from the table. */
function chairPiece (c) {
  const hw = DIN.chairW / 2;
  const hd = DIN.chairD / 2;
  const leg = DIN.chairLegT;
  const seatY0 = DIN.chairSeatY - DIN.chairSeatT;
  const backFace = [c.x - DIN.cx, c.z - DIN.cz]; // from table: the back's side
  const ax = Math.abs(backFace[0]) > Math.abs(backFace[1]) ? 'x' : 'z';
  const sgn = ax === 'x' ? Math.sign(backFace[0]) : Math.sign(backFace[1]);
  const parts = [
    bx(c.x - hw, seatY0, c.z - hd, c.x + hw, DIN.chairSeatY, c.z + hd), // seat slab, 0.44 × 0.45 × top 0.45
  ];
  // four legs inset 2 cm
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x0 = c.x + (sx < 0 ? -hw + 0.02 : hw - 0.02 - leg);
    const z0 = c.z + (sz < 0 ? -hd + 0.02 : hd - 0.02 - leg);
    parts.push(bx(x0, 0, z0, x0 + leg, seatY0, z0 + leg));
  }
  // back panel on the side away from the table: 0.44 wide, 0.04 thick, top 0.86
  if (ax === 'x') {
    const x1 = c.x + sgn * hw;
    parts.push(bx(x1 - (sgn > 0 ? DIN.chairBackT : 0), DIN.chairSeatY, c.z - hd, x1 + (sgn > 0 ? 0 : -DIN.chairBackT), DIN.chairBackY, c.z + hd));
    // two back posts
    parts.push(bx(x1 - (sgn > 0 ? DIN.chairBackT : 0), seatY0, c.z - hd, x1 + (sgn > 0 ? 0 : -DIN.chairBackT), DIN.chairSeatY, c.z - hd + leg));
    parts.push(bx(x1 - (sgn > 0 ? DIN.chairBackT : 0), seatY0, c.z + hd - leg, x1 + (sgn > 0 ? 0 : -DIN.chairBackT), DIN.chairSeatY, c.z + hd));
  } else {
    const z1 = c.z + sgn * hd;
    parts.push(bx(c.x - hw, DIN.chairSeatY, z1 - (sgn > 0 ? DIN.chairBackT : 0), c.x + hw, DIN.chairBackY, z1 + (sgn > 0 ? 0 : -DIN.chairBackT)));
    parts.push(bx(c.x - hw, seatY0, z1 - (sgn > 0 ? DIN.chairBackT : 0), c.x - hw + leg, DIN.chairSeatY, z1 + (sgn > 0 ? 0 : -DIN.chairBackT)));
    parts.push(bx(c.x + hw - leg, seatY0, z1 - (sgn > 0 ? DIN.chairBackT : 0), c.x + hw, DIN.chairSeatY, z1 + (sgn > 0 ? 0 : -DIN.chairBackT)));
  }
  return parts;
}

export const PIECES = [
  /* ── table (issue #81): Ø 1.05, top 0.75 — a turned piece: base plate,
   *  column, slab. One mesh, tagged `dining-table`; the disc's AABB is the
   *  diameter, which is how the check sees both the size and the roundness
   *  (w = d = 1.05). ── */
  piece(
    'dining-table',
    'wood',
    [
      bx(DIN.cx - DIN.baseD / 2, 0, DIN.cz - DIN.baseD / 2, DIN.cx + DIN.baseD / 2, DIN.baseH, DIN.cz + DIN.baseD / 2),
      bx(DIN.cx - 0.06, DIN.baseH, DIN.cz - 0.06, DIN.cx + 0.06, DIN.tableTopY - DIN.tableTopT, DIN.cz + 0.06),
      bx(TB.x0, DIN.tableTopY - DIN.tableTopT, TB.z0, TB.x1, DIN.tableTopY, TB.z1), // slab envelope (the disc turns it)
    ],
    'dining-table',
    'issue #81: round table dia 1.05, top exactly 0.75',
    [
      { x: DIN.cx, z: DIN.cz, y0: 0.012, y1: DIN.baseH, rt: DIN.baseD / 2, rb: DIN.baseD / 2 }, // plate
      { x: DIN.cx, z: DIN.cz, y0: DIN.baseH, y1: DIN.tableTopY - DIN.tableTopT, rt: 0.055, rb: DIN.pedestalD / 2 }, // turned column
      { x: DIN.cx, z: DIN.cz, y0: DIN.tableTopY - DIN.tableTopT, y1: DIN.tableTopY, rt: DIN.tableDia / 2, rb: DIN.tableDia / 2 }, // the top disc
    ],
  ),

  /* ── the four chairs (issue #81): seat top 0.45, back top 0.86, each one
   *  mesh tagged `dining-chair` — the check measures all four. ── */
  ...CHAIRS.map((c) => piece(
    c.id,
    'woodPale',
    chairPiece(c),
    'dining-chair',
    'issue #81: seat 0.45, back 0.86',
  )),

  /* ── sideboard: carcass, top slab, two drawer fronts. Tagged `sideboard`;
   *  its top is the DECOR_HOSTS plane the bowl and the book stand on. ── */
  piece(
    'sideboard',
    'wood',
    [
      bx(DIN.sideX0, 0.09, DIN.sideZ0 + 0.02, DIN.sideX1, DIN.sideTopY - DIN.sideTopT, DIN.sideZ1 - 0.02), // carcass
      bx(DIN.sideX0, DIN.sideTopY - DIN.sideTopT, DIN.sideZ0, DIN.sideX1, DIN.sideTopY, DIN.sideZ1), // top slab, 0.86
      bx(DIN.sideX0 + 0.01, 0, DIN.sideZ0 + 0.06, DIN.sideX0 + 0.05, 0.09, DIN.sideZ1 - 0.06), // leg pair
      bx(DIN.sideX1 - 0.05, 0, DIN.sideZ0 + 0.06, DIN.sideX1 - 0.01, 0.09, DIN.sideZ1 - 0.06),
    ],
    'sideboard',
    'issue #81: 1.28 × 0.40 × 0.86 against the south plaster, under the window',
  ),
];

/** DETAILS: the dressing that claims no ruler row — drawer pulls and the
 *  table's apron ticks, merged untagged like every other room's details. */
export const DETAILS = [
  { mat: 'handle', box: bx(DIN.cx - 0.1, DIN.tableTopY - DIN.tableTopT - 0.06, DIN.cz - 0.1, DIN.cx + 0.1, DIN.tableTopY - DIN.tableTopT, DIN.cz + 0.1) }, // apron boss under the top
  // pulls on the NORTH face of the sideboard — the face the room sees
  { mat: 'handle', box: bx(DIN.sideX0 + 0.14, 0.62, DIN.sideZ0, DIN.sideX0 + 0.5, 0.65, DIN.sideZ0 + 0.008) },
  { mat: 'handle', box: bx(DIN.sideX1 - 0.5, 0.62, DIN.sideZ0, DIN.sideX1 - 0.14, 0.65, DIN.sideZ0 + 0.008) },
];

/** The pendant (ceiling → shade over the table). Emissive only — the rig is
 *  at its six lights, so this glow joins the kitchen pendants' convention
 *  (game/full-kitchen-details-mesh.js): rod, shade, bulb, no light. */
export const PENDANT = {
  x: DIN.cx,
  z: DIN.cz,
  shadeTopY: DIN.pendY,
  shadeR: DIN.pendShadeR,
  shadeH: DIN.pendShadeH,
};

/** --------------------------------------------------------------------------
 *  Row 58 through the dining room, measured between the FOOT rects (same
 *  style as livingGapReport / bathGapReport: a number that IS the route, not
 *  an assumption; `m` is the free channel on the body CENTRE — the grid
 *  `walk-reachable` actually floods: each furniture pad takes its 0.30 m,
 *  the walk rects take their 0.08 m off the plaster, and what is left
 *  between the pads is what a body's centre line gets to travel). The room
 *  is 2.92 m across and carries a 1.05 m table with 1.54 m of chair spread
 *  and a 0.40 m sideboard, so its ring aisles are the tight honest register:
 *  0.31 m of centre channel is 0.69 m of physical aisle between a chair
 *  flank and the plaster — what a 2.92 m dining room really leaves at its
 *  sides — and the check asserts that band, not the living room's 0.90.
 *  The two door lanes hold the 0.60 band the bathroom set. The room's south
 *  face grew to z 4.40 precisely so the chair→sideboard row and the serving
 *  lip come out walkable at all.
 *  -------------------------------------------------------------------------- */
export function diningGapReport() {
  const BODY = 0.3; // MOVE.playerRadius
  const inset = 0.08; // the walk rects' inset off the plaster (game/full-level.js)
  const W = 2.6 + inset; // north arm's west walk edge (the door's own jamb)
  const E = 5.52 - inset;
  const N = 0.8 + inset;
  const T = FOOT.table;
  const S = FOOT.sideboard;
  const cw = FOOT['dining-chair-w'];
  const ce = FOOT['dining-chair-e'];
  const cn = FOOT['dining-chair-n'];
  const cs = FOOT['dining-chair-s'];
  return [
    {
      name: 'dining: west aisle (chair flank → west inset)',
      m: (cw.x0 - BODY) - W,
      min: 0.3,
      note: 'the ring route and the kitchen lane\u2019s west run — 0.69 m chair-to-plaster',
    },
    {
      name: 'dining: east aisle (chair flank → east inset)',
      m: E - (ce.x1 + BODY),
      min: 0.3,
      note: 'the ring route past the table',
    },
    {
      name: 'dining: north aisle (chair back → north inset)',
      m: (cn.z0 - BODY) - N,
      min: 0.3,
      note: 'the kitchen door\u2019s approach, between the north chair and the wide arm\u2019s face',
    },
    {
      name: 'dining: south aisle (chair back → sideboard front)',
      m: (S.z0 - BODY) - (cs.z1 + BODY),
      min: 0.3,
      note: 'the body passes between the south chair and the sideboard here',
    },
    {
      name: 'dining: kitchen door lane (north inset → west chair pad)',
      m: (cw.z0 - BODY) - N,
      min: 0.6,
      note: 'straight in from the kitchen runs free down the table\u2019s west flank',
    },
    {
      name: 'dining: living door lane (west inset → north chair pad)',
      m: (cn.x0 - BODY) - W,
      min: 0.6,
      note: 'the body never passes nearer than this down the living door',
    },
    {
      name: 'dining: seat face → table rim (all four chairs)',
      m: (DIN.chairRingR - DIN.chairD / 2) - DIN.tableDia / 2,
      min: null,
      note: '−0.20 m: the chairs tuck UNDER the rim — a seated reach, not a walkway, the sofa→coffee convention; row 58 does not police it',
    },
    {
      name: 'dining: sideboard front → table edge',
      m: S.z0 - T.z1,
      min: null,
      note: '1.18 m of serving lip between the sideboard and the table, with the south chair living inside it',
    },
  ];
}
