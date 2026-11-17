/*!
 * game/full-living.js — the living room as DATA (issue #46, parent #33).
 *
 * The ruler is docs/ISSUE_33_REBUILD.md §1 rows 34-41, 58 and 60; the room is
 * its §2 living row — x [−3.30, 2.40], z [−2.90, 2.10] — with the north window
 * (x −2.10 … −0.30) and the balcony glass door (x 0.77 … 2.23) on the north
 * wall, the east window (z 1.00 … 1.95), the doorway to the hall in the south
 * wall and the kitchen doorway in the east. Like game/full-kitchen.js this file
 * draws nothing and imports no Three.js: it is the one place the living room's
 * numbers are typed. game/full-living-mesh.js draws them, game/full-level.js
 * splices LIVING_COLLIDERS into its COLLIDERS, and the `furniture-real-scale`
 * check measures the same rows back off the built boxes.
 *
 * Where the room goes, and why there:
 *   west   the sofa back to the plaster, 2.10 along z, centred on the `cushion`
 *          and `sofaBackTop` supports so the two couch spots already in the
 *          game land on furniture at the height those supports name (0.45 and
 *          0.85) rather than on air;
 *   centre the rug, and the coffee table 0.46 m off the seat face — a real
 *          reach from a sofa, with 3.4 m of open floor behind it;
 *   east   the TV on its 1.60 stand, on the one clean stretch of the east wall:
 *          z −2.50 … −0.90, between the balcony walkway and the kitchen
 *          doorway. That stretch is 2.22 m and the piece needs 1.60 + two
 *          0.30 m body pads (row 58), so the stand is cut from the segment it
 *          is centred on: the balcony route keeps its clear width west of
 *          x 1.71 and the kitchen doorway keeps all of z ≥ −0.60;
 *   north-west the bookshelf in the corner (0.90 wide, clear of the window
 *          jamb at x −2.10) and the floor lamp in the gap between it and the
 *          sofa's north arm;
 *   north  the big plant under the east end of the window, on the footprint the
 *          placeholder already had — 0.40 m off the `n-window` cat spot, which
 *          is what keeps that spot standable;
 *   south  the cardboard box on its own spot (x −2.075, z 1.575) and a round
 *          plant table by the sofa's south arm, carrying the small plant.
 *
 * Every piece stands 0.02 off the plaster. Baseboards are 0.018 proud (row 6)
 * and furniture standing in front of a baseboard is what a baseboard is for; a
 * piece pushed flush would have to be drawn two centimetres short of its own
 * number to miss it, and the ruler is what gets measured.
 */

/** --------------------------------------------------------------------------
 *  The ruler, as named constants (docs/ISSUE_33_REBUILD.md §1 rows 34-41, 58,
 *  60). The convention game/full-kitchen.js sets: a name here is what the room
 *  is BUILT at, and the comment says what the row ALLOWS, i.e. what the check
 *  accepts measured back off the box.
 *  -------------------------------------------------------------------------- */
export const LIV = {
  // room faces (game/full-shell.js ROOMS.living)
  x0: -3.3,
  x1: 2.4,
  z0: -2.9,
  z1: 2.1,
  offPlaster: 0.02, // clear of the baseboard's proud face (row 6)

  // rows 34-35: the sofa — 2.10 × 0.92 × 0.85, seat 0.44 (allows L 1.8…2.4,
  // D 0.82…1.05, H 0.75…0.95; seat 0.38…0.50). The seat is built at 0.45 and
  // the back at 0.85 because those are the numbers SUPPORT_DEFS `cushion` and
  // `sofaBackTop` already carry, so a cat loafing on the couch is standing on
  // the cushion he is measured against, not a centimetre above it.
  sofaLen: 2.1,
  sofaD: 0.92,
  sofaH: 0.85,
  seatH: 0.45,
  backT: 0.26, // the back panel's own thickness
  armW: 0.22,
  armH: 0.62,
  plinthH: 0.24,
  deckH: 0.3, // the seat deck the cushions sit on

  // row 34's cat upgrade (issue #82): a 40 × 55 cm yellow heat pad, 3 cm
  // thick, on the SOUTH cushion — top 0.48, three centimetres of warming
  // over the 0.45 seat. Not a collider: a pad you walk on, like the rug.
  padX: [-2.93, -2.53],
  padZ: [0.08, 0.63],
  padTop: 0.48,

  // row 36: coffee table 1.10 × 0.60 × 0.45 high (allows 0.38…0.52); the top
  // slab is row 13's 4 cm by the same logic as the kitchen worktop.
  coffeeLen: 1.1,
  coffeeD: 0.6,
  coffeeH: 0.45,
  coffeeTopT: 0.04,
  legT: 0.05,

  // row 37: side table 0.45 dia × 0.55 high (allows 0.48…0.62 high)
  sideDia: 0.45,
  sideH: 0.55,
  sideTopT: 0.035,

  // row 38: floor lamp 1.55 tall, shade 0.34 dia (allows 1.35…1.75)
  lampH: 1.55,
  lampShadeD: 0.34,
  lampShadeH: 0.27,
  lampBaseD: 0.32,

  // row 39: TV panel (55") 1.22 × 0.71 with its centre at y 1.20 (allows W
  // 1.0…1.35). Centre 1.20 − half of 0.71 = a bottom edge at 0.845, which is
  // 0.40 above the stand — the gap a pedestal base occupies.
  tvW: 1.22,
  tvH: 0.71,
  tvCentreY: 1.2,
  tvT: 0.06,

  // row 40: TV stand 1.60 × 0.40 × 0.45 high (allows 0.38…0.55)
  standLen: 1.6,
  standD: 0.4,
  standH: 0.45,
  standLegH: 0.08,

  // row 41: bookshelf 0.90 × 0.32 × 1.90 high (allows 1.7…2.1)
  shelfLen: 0.9,
  shelfD: 0.32,
  shelfH: 1.9,
  shelfT: 0.022, // the case's own boards

  // row 60: the cardboard box 0.60 × 0.44 × 0.42, floor y 0.02 (allows 0.4…0.7)
  boxLen: 0.6,
  boxD: 0.44,
  boxH: 0.42,
  boxY0: 0.02,
  boxT: 0.018,

  // row 58: the clear walkway every piece below is checked against by hand.
  walkway: 0.9,
};

/** --------------------------------------------------------------------------
 *  Footprints: where each piece stands, as a rect on the floor. Everything in
 *  PIECES and LIVING_COLLIDERS is derived from these, so a piece's drawn box
 *  and its push box can never be two different numbers (the way the playset
 *  happened the first time).
 * -------------------------------------------------------------------------- */
const F = (x0, z0, x1, z1) => ({ x0, z0, x1, z1 });

export const FOOT = {
  // sofa: the placeholder's footprint, 2.10 along z against the west wall
  sofa: F(-3.28, -1.15, -2.36, 0.95),
  // coffee table: centred on the sofa's z, 0.46 m off its front face
  coffee: F(-1.9, -0.65, -1.3, 0.45),
  // round plant table by the sofa's south arm (its drawn top is a 0.45 disc
  // inscribed in this square, so the square is the push box, not the top)
  side: F(-3.0 - LIV.sideDia / 2, 1.45 - LIV.sideDia / 2, -3.0 + LIV.sideDia / 2, 1.45 + LIV.sideDia / 2),
  // floor lamp in the gap between the bookshelf and the sofa's north arm
  lamp: F(-2.72 - LIV.lampBaseD / 2, -1.55 - LIV.lampBaseD / 2, -2.72 + LIV.lampBaseD / 2, -1.55 + LIV.lampBaseD / 2),
  // TV wall: the clean stretch of the east plaster between the balcony
  // walkway (z ≤ −2.80 clear) and the kitchen doorway (z ≥ −0.60 clear)
  stand: F(2.0, -2.5, 2.38, -0.9),
  // bookshelf: the north-west corner, flush with the north wall's inset line
  bookshelf: F(-3.28, -2.88, -3.28 + LIV.shelfD, -2.88 + LIV.shelfLen),
  // big plant: the footprint the placeholder had, kept verbatim
  bigPlant: F(-0.95, -2.82, -0.35, -2.22),
  // the box, dead on SUPPORT_DEFS.boxFloor / the `box-sit` spot at (−2.075, 1.575)
  box: centredX(-2.075, LIV.boxLen, 1.575 - LIV.boxD / 2, 1.575 + LIV.boxD / 2),
  // the rug: under the seat group, clear of every floor spot's feet
  rug: F(-3.1, -1.55, 0.2, 0.75),
  // wall art above the sofa, on the west plaster
  art: F(-3.29, -0.55, -3.27, 0.35),
};

/** A footprint given a centre in x and a raw z span (the box's x is the one
 *  coordinate a spot pins exactly). */
function centredX(cx, w, z0, z1) {
  return F(cx - w / 2, z0, cx + w / 2, z1);
}

/* -------------------------------------------------------------------------- *
 *  PIECES: the things the ruler measures. One mesh each (a piece may be built
 *  from several boxes/cylinders — its measured box is the union of its parts,
 *  which is what `furniture-real-scale` reads back off the world AABB), and
 *  `scale` names the row of docs/ISSUE_33_REBUILD.md §1 it answers to.
 *  `group` is the kitchen's convention: several meshes whose UNION is one row
 *  (a table is a top and four legs; a lamp is a stem and a shade). The dressing
 *  that only has to look right — drawer fronts, shelf boards, books, flaps,
 *  the rug — is in DETAILS: merged, and deliberately unmeasurable.
 * -------------------------------------------------------------------------- */

/** A part, in world coordinates: `{x0,y0,z0,x1,y1,z1}` (a box) or, for `cyls`,
 *  `{x,z,y0,y1,rt,rb}` (a cone frustum, `rt`/`rb` are radii; omit `rb` for a
 *  straight cylinder and `open` to leave the caps off a lampshade). */
const bx = (x0, y0, z0, x1, y1, z1) => ({ x0, y0, z0, x1, y1, z1 });
const cy = (x, z, y0, y1, rt, rb = null, opts = {}) => ({ x, z, y0, y1, rt, rb: rb ?? rt, ...opts });

/** A piece: id, material slot, its parts, the ruler row(s) it answers to. */
const piece = (id, mat, parts, scale = null, note = '', group = null, cyls = []) => ({
  id,
  mat,
  parts,
  cyls,
  scale,
  note,
  group,
});

const S = FOOT.sofa; // the sofa's footprint, used a dozen times below
const SEAT_Y = [LIV.deckH, LIV.seatH]; // 0.30 … 0.45 — the cushion's own slab
const CUSHION_Z = [
  [S.z0 + LIV.armW, -0.115], // the two seat cushions, 3 cm apart
  [-0.085, S.z1 - LIV.armW],
];

export const PIECES = [
  /* ── the sofa (rows 34, 35) ───────────────────────────────────────────────
   * Back to the west plaster, 2.10 along z. Its measured box is the frame's:
   * back panel, both arms, the plinth they stand on and the seat deck between
   * them — 2.10 × 0.92 × 0.85, which is row 34 typed in three boxes' shapes.
   * The cushions are their own meshes because rows 35 and the `sofa-back` row
   * measure a height, not an envelope. */
  piece(
    'sofa-frame',
    'cloth',
    [
      bx(S.x0, 0, S.z0, S.x0 + LIV.backT, LIV.sofaH, S.z1), // back panel, plaster to 0.85
      bx(S.x0, 0.08, S.z0, S.x1, LIV.armH, S.z0 + LIV.armW), // arm, north
      bx(S.x0, 0.08, S.z1 - LIV.armW, S.x1, LIV.armH, S.z1), // arm, south
      bx(S.x0 + 0.04, 0, S.z0 + 0.04, S.x1 - 0.04, LIV.plinthH, S.z1 - 0.04), // plinth, tucked in
      bx(S.x0 + LIV.backT, LIV.plinthH, S.z0 + LIV.armW, S.x1 - 0.02, LIV.deckH, S.z1 - LIV.armW), // seat deck
    ],
    'sofa',
    'row 34: 2.10 L × 0.92 D × 0.85 H, back to the west wall',
  ),
  piece(
    'sofa-seats',
    'clothSeat',
    CUSHION_Z.map(([z0, z1]) => bx(S.x0 + LIV.backT, SEAT_Y[0], z0, S.x1 - 0.02, SEAT_Y[1], z1)),
    'seat-height',
    'row 35: the seat the `cushion` support names (0.45, inside 0.38…0.50)',
  ),
  piece(
    'sofa-backs',
    'clothSeat',
    CUSHION_Z.map(([z0, z1]) => bx(S.x0 + LIV.backT, 0.42, z0, S.x0 + LIV.backT + 0.22, LIV.sofaH, z1)),
    'sofa-back',
    'the back cushions, top at the `sofaBackTop` support (0.85)',
  ),
  /* ── the heat pad (issue #82) ──────────────────────────────────────────────
   * The one yellow thing in the flat's warmest spot: a 40 × 55 cm corded
   * heat pad on the south cushion, top 0.48 — the `heatPad` support's own
   * number. Its own mesh and its own row: a cat loafing on it is measured
   * standing on the pad, not sinking into the cushion under it. */
  piece(
    'heat-pad',
    'heatpad',
    [bx(LIV.padX[0], LIV.seatH, LIV.padZ[0], LIV.padX[1], LIV.padTop, LIV.padZ[1])],
    'heat-pad',
    'issue #82: 40 × 55 × 3 cm, top 0.48 on the south cushion',
  ),

  /* ── coffee table (row 36): 1.10 × 0.60 × 0.45, 0.46 m off the seat face ──
   * The top and the leg-and-shelf frame are one measured group: the row wants
   * the table's height off the floor, not the slab's thickness. */
  piece(
    'coffee-top',
    'woodTop',
    [
      bx(
        FOOT.coffee.x0,
        LIV.coffeeH - LIV.coffeeTopT,
        FOOT.coffee.z0,
        FOOT.coffee.x1,
        LIV.coffeeH,
        FOOT.coffee.z1,
      ),
    ],
    null,
    'row 36 (group)',
    'coffee-table',
  ),
  piece(
    'coffee-frame',
    'wood',
    [
      // four legs, 5 cm square, 5 cm in from each corner
      ...[
        [FOOT.coffee.x0 + 0.05, FOOT.coffee.z0 + 0.05],
        [FOOT.coffee.x1 - 0.1, FOOT.coffee.z0 + 0.05],
        [FOOT.coffee.x0 + 0.05, FOOT.coffee.z1 - 0.1],
        [FOOT.coffee.x1 - 0.1, FOOT.coffee.z1 - 0.1],
      ].map(([x, z]) => bx(x, 0, z, x + LIV.legT, LIV.coffeeH - LIV.coffeeTopT, z + LIV.legT)),
      // and a lower shelf to put a magazine on
      bx(FOOT.coffee.x0 + 0.09, 0.12, FOOT.coffee.z0 + 0.09, FOOT.coffee.x1 - 0.09, 0.145, FOOT.coffee.z1 - 0.09),
    ],
    null,
    'row 36 (group)',
    'coffee-table',
  ),

  /* ── side table (row 37): 0.45 dia × 0.55, a round plant table ───────────
   * Turned pedestal and three splayed feet would be a hundred triangles of
   * lathe; a column on a disc reads the same from a metre away. */
  piece(
    'side-top',
    'woodTop',
    [],
    null,
    'row 37 (group)',
    'side-table',
    [cy(-3.0, 1.45, LIV.sideH - LIV.sideTopT, LIV.sideH, LIV.sideDia / 2, LIV.sideDia / 2 - 0.008)],
  ),
  piece(
    'side-base',
    'wood',
    [],
    null,
    'row 37 (group)',
    'side-table',
    [
      cy(-3.0, 1.45, 0, 0.05, 0.16),
      cy(-3.0, 1.45, 0.05, LIV.sideH - LIV.sideTopT, 0.035, 0.045),
    ],
  ),

  /* ── floor lamp (row 38): 1.55 tall, shade 0.34 across ───────────────────
   * The shade is its own mesh because it is the only lit thing in the room
   * that is not the telly: emissive from the inside, no lamp light. The flat
   * runs five punctual lights already and the rig's note in
   * game/full-apartment.js is the reason this one stays a material. */
  piece(
    'lamp-metal',
    'metal',
    [],
    null,
    'row 38 (group)',
    'floor-lamp',
    [cy(-2.72, -1.55, 0, 0.03, 0.16, 0.17), cy(-2.72, -1.55, 0.03, LIV.lampH - LIV.lampShadeH, 0.017)],
  ),
  piece(
    'lamp-shade',
    'shade',
    [],
    null,
    'row 38 (group)',
    'floor-lamp',
    [
      cy(
        -2.72,
        -1.55,
        LIV.lampH - LIV.lampShadeH,
        LIV.lampH,
        LIV.lampShadeD / 2 - 0.04,
        LIV.lampShadeD / 2,
        { open: true },
      ),
    ],
  ),

  /* ── the TV wall (rows 39, 40) ────────────────────────────────────────────
   * The panel is 1.22 × 0.71 with its centre at y 1.20, so its bottom edge is
   * 0.845 — 0.40 above the stand, which is what a pedestal base is for
   * (DETAILS `tv-base`). The stand is a case on four pegs, and the row
   * measures the pair. */
  piece(
    'tv-panel',
    'tvBody',
    [
      bx(
        2.21,
        LIV.tvCentreY - LIV.tvH / 2,
        -1.7 - LIV.tvW / 2,
        2.21 + LIV.tvT,
        LIV.tvCentreY + LIV.tvH / 2,
        -1.7 + LIV.tvW / 2,
      ),
    ],
    'tv-screen',
    'row 39: 1.22 × 0.71, centre y 1.20 (bottom 0.845)',
  ),
  piece(
    'tv-stand-case',
    'wood',
    [
      bx(FOOT.stand.x0, LIV.standLegH, FOOT.stand.z0, FOOT.stand.x1, LIV.standH, FOOT.stand.z1),
    ],
    null,
    'row 40 (group)',
    'tv-stand',
  ),
  piece(
    'tv-stand-legs',
    'dark',
    [
      ...[
        [FOOT.stand.x0 + 0.02, FOOT.stand.z0 + 0.04],
        [FOOT.stand.x0 + 0.02, FOOT.stand.z1 - 0.09],
        [FOOT.stand.x1 - 0.07, FOOT.stand.z0 + 0.04],
        [FOOT.stand.x1 - 0.07, FOOT.stand.z1 - 0.09],
      ].map(([x, z]) => bx(x, 0, z, x + 0.05, LIV.standLegH, z + 0.05)),
    ],
    null,
    'row 40 (group)',
    'tv-stand',
  ),

  /* ── bookshelf (row 41): 0.90 × 0.32 × 1.90 in the north-west corner ─────
   * Built as a case — two ends, a top, a bottom and a back — so the measured
   * box is the ruler's while the thing you see has five centimetres of shadow
   * behind every shelf. The boards and the books are details. */
  piece(
    'bookshelf-case',
    'woodPale',
    (() => {
      const b = FOOT.bookshelf;
      const t = LIV.shelfT;
      return [
        bx(b.x0, 0, b.z0, b.x1, LIV.shelfH, b.z0 + t), // end, north
        bx(b.x0, 0, b.z1 - t, b.x1, LIV.shelfH, b.z1), // end, south
        bx(b.x0, 0, b.z0 + t, b.x1, 0.03, b.z1 - t), // bottom
        bx(b.x0, LIV.shelfH - t, b.z0 + t, b.x1, LIV.shelfH, b.z1 - t), // top
        bx(b.x1 - 0.014, 0.03, b.z0 + t, b.x1, LIV.shelfH - t, b.z1 - t), // back, against the plaster
      ];
    })(),
    'bookshelf',
    'row 41: 0.90 × 0.32 × 1.90 high',
  ),

  /* ── the cardboard box (row 60): 0.60 × 0.44 × 0.42, floor y 0.02 ────────
   * The hero prop, on the spot the moments stage it at. Four walls and no
   * bottom on purpose: SUPPORT_DEFS.boxFloor is y 0.001, so Bobo sits on the
   * flat's own oak inside the box, and a 2 cm floor panel would put his paws
   * under it. The flaps are folded down over the rim, as a delivered box is. */
  piece(
    'box-walls',
    'cardboard',
    (() => {
      const b = FOOT.box;
      const t = LIV.boxT;
      const y = [LIV.boxY0, LIV.boxY0 + LIV.boxH];
      return [
        bx(b.x0, y[0], b.z0, b.x1, y[1], b.z0 + t),
        bx(b.x0, y[0], b.z1 - t, b.x1, y[1], b.z1),
        bx(b.x0, y[0], b.z0 + t, b.x0 + t, y[1], b.z1 - t),
        bx(b.x1 - t, y[0], b.z0 + t, b.x1, y[1], b.z1 - t),
      ];
    })(),
    'cardboard-box',
    'row 60: 0.60 × 0.44 × 0.42, floor y 0.02',
  ),
];

/** --------------------------------------------------------------------------
 *  DETAILS: the dressing, in the same split the kitchen uses — nothing here
 *  carries a ruler row (dressing has no business passing for furniture, and
 *  `furniture-real-scale` only measures what is tagged), but everything shares
 *  the pieces' materials so each kind costs one merged draw.
 *  -------------------------------------------------------------------------- */

/** A tiny deterministic generator: books must land in the same places in the
 *  determinism capture, so no Math.random anywhere in this file. */
function livRng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
}

const B = FOOT.bookshelf;
const SHELF_LEVELS = [0.46, 0.92, 1.38]; // the three boards inside the case

/** Book spines, standing along each shelf from the north end. Depths run back
 *  from the case's back board, so the spines face the room 10 cm proud of the
 *  shelf front — the way a pushed-back shelf of paperbacks actually reads. */
const bookSpines = (() => {
  const rnd = livRng(46);
  const books = [];
  const x0 = B.x0 + 0.014 + 0.004; // off the back board
  const depth = 0.2;
  for (const level of [0.03, ...SHELF_LEVELS.map((y) => y + LIV.shelfT)]) {
    let z = B.z0 + LIV.shelfT + 0.012;
    const zEnd = B.z1 - LIV.shelfT - 0.012;
    const next = SHELF_LEVELS.find((y) => y >= level + 0.1);
    const cap = (next ? next : LIV.shelfH - LIV.shelfT) - 0.03;
    while (z < zEnd - 0.03) {
      const w = 0.022 + rnd() * 0.02;
      if (rnd() < 0.08) { z += 0.02 + rnd() * 0.03; continue; } // a gap where a shelf's been rifled
      const h = 0.17 + rnd() * 0.14;
      if (level + h > cap) {
        z += w;
        continue; // too tall for the compartment
      }
      books.push(bx(x0, level, z, x0 + depth, level + h, z + w));
      z += w + (rnd() < 0.15 ? 0.008 : 0);
    }
  }
  return books;
})();

export const DETAILS = {
  // row 33's cousin: a real 3.3 × 2.3 rug under the seating group. 2 cm of
  // pile — a rug is not a collider and must never block a walk cell.
  rug: bx(FOOT.rug.x0, 0, FOOT.rug.z0, FOOT.rug.x1, 0.02, FOOT.rug.z1),

  // two cushions propped in the sofa corners, and a folded throw over the
  // south arm — the difference between a sofa and a couch.
  pillows: [
    { at: [S.x0 + LIV.backT + 0.1, 0.66, S.z0 + 0.42], size: [0.14, 0.44, 0.44], rot: [0, 0, 0.16] },
    { at: [S.x0 + LIV.backT + 0.1, 0.66, S.z1 - 0.42], size: [0.14, 0.44, 0.44], rot: [0, 0.14, 0.12] },
  ],
  throwBoxes: [
    bx(S.x0 + LIV.backT + 0.02, 0.62, S.z1 - LIV.armW - 0.16, S.x1 - 0.06, 0.645, S.z1 - 0.02), // over the seat
    bx(S.x1 - 0.024, 0.34, S.z1 - LIV.armW - 0.16, S.x1 + 0.002, 0.63, S.z1 - 0.02), // hanging off the arm
  ],

  // the bookshelf's boards (the case's ends carry them), a vase, a frame.
  shelfBoards: SHELF_LEVELS.map((y) => bx(B.x0 + LIV.shelfT, y, B.z0 + LIV.shelfT, B.x1 - 0.014, y + LIV.shelfT, B.z1 - LIV.shelfT)),
  trinkets: [
    bx(B.x0 + LIV.shelfT + 0.01, 0.942, -2.42, B.x1 - 0.014 - 0.16, 0.942 + 0.024, -2.18), // a photo frame lying flat on the shelf
  ],
  vase: { x: -3.11, z: -2.62, y0: 0.942, r0: 0.05, r1: 0.075, h: 0.16 },
  bookSpines,

  // the TV's pedestal: the panel's bottom edge is 0.40 over the stand (its
  // centre is row 39's y 1.20), and a 55" floating on air is the playset look.
  tvBase: [
    bx(2.13, LIV.standH, -1.9, 2.21, LIV.standH + 0.018, -1.5), // plate on the stand
    bx(2.155, LIV.standH + 0.018, -1.78, 2.195, LIV.tvCentreY - LIV.tvH / 2, -1.62), // stem to the panel
  ],

  // the heat pad's cord (issue #82): out the pad's east face, across the
  // cushion, down the sofa's front and into a small adapter behind it — dark
  // dressing merged with the TV's base, a pad with no cord is a cushion.
  padCord: [
    bx(-2.53, 0.455, 0.34, -2.38, 0.468, 0.362), // across the cushion to the seat's edge
    bx(-2.402, 0.02, 0.34, -2.378, 0.46, 0.362), // down the sofa's front face
    bx(-2.402, 0.02, 0.30, -2.35, 0.058, 0.366), // the adapter, at the sofa's foot on the rug
  ],

  // one framed print, colour-blocked (the brief: not another black-and-white
  // wall). The bands stand proud of each other rather than coplanar, so there
  // is no z-fighting to lose at grazing angles.
  art: {
    frame: bx(-3.29, 1.15, -0.55, -3.268, 1.77, 0.35),
    bands: [
      { box: bx(-3.268, 1.19, -0.51, -3.264, 1.73, 0.31), mat: 'sky' },
      { box: bx(-3.264, 1.19, -0.51, -3.260, 1.38, 0.31), mat: 'sand' },
    ],
  },
};

/** --------------------------------------------------------------------------
 *  The plants. No downloads: the pot is a lathe-turned cylinder and every
 *  leaf is a `broadLeafGeo` card hung from a deterministic golden-angle spiral
 *  — same plant, frame after frame, which is what the determinism capture
 *  grades. Positions are leaf-base local coordinates; the mesh builder places
 *  each plant's group at its pot centre.
 *  -------------------------------------------------------------------------- */
export const PLANTS = [
  {
    name: 'big-plant',
    x: -0.65, z: -2.52, y0: 0, // under the east end of the north window
    pot: { r0: 0.12, r1: 0.17, h: 0.3 },
    // issue #70: the fronds grew (0.36 → 0.50 blades, same 26 leaves on the
    // same spiral, same merged mesh) until the plant stands taller than the
    // waist-high sight line — a cat bedded down at its window-side foot now
    // shows through the leaves only from about two vantages in five, and the
    // `findable` check carries the exact box this draws (HIDE_PROPS).
    leaf: { n: 26, len: 0.5, wid: 0.15, bend: 0.14 },
  },
  {
    name: 'small-plant',
    x: -3.0, z: 1.45, y0: LIV.sideH, // on the side table, by the sofa's south arm
    pot: { r0: 0.045, r1: 0.07, h: 0.1 },
    leaf: { n: 9, len: 0.13, wid: 0.062, bend: 0.05 },
  },
];

/** Leaf placements for a plant, in the plant's local frame. */
export function plantLeaves(spec) {
  const rnd = livRng(spec.name.length * 7919 + spec.leaf.n);
  const out = [];
  for (let i = 0; i < spec.leaf.n; i++) {
    const f = i / (spec.leaf.n - 1);
    out.push({
      at: [0.05 * Math.cos(i * 2.399963), spec.pot.h * (0.55 + 0.52 * f), 0.05 * Math.sin(i * 2.399963)],
      yaw: i * 2.399963,
      tilt: 0.95 - 0.78 * f - 0.1 * rnd(), // inner blades stand, outer blades splay
      scale: 0.72 + 0.5 * f + 0.12 * rnd(),
    });
  }
  return out;
}

/** --------------------------------------------------------------------------
 *  Push boxes. game/full-level.js splices these over its placeholders; every
 *  one is the FOOT rect its piece is drawn at, so the thing Bobo's body stops
 *  against and the thing the camera photographs are the same number. The rug
 *  deliberately has none (2 cm of pile is walked over, not around), and
 *  neither does the small plant — it is on the table.
 *  -------------------------------------------------------------------------- */
export const LIVING_COLLIDERS = [
  { id: 'sofa', ...FOOT.sofa },
  { id: 'coffee-table', ...FOOT.coffee },
  { id: 'side-table', x0: -3.0 - LIV.sideDia / 2, z0: 1.45 - LIV.sideDia / 2, x1: -3.0 + LIV.sideDia / 2, z1: 1.45 + LIV.sideDia / 2 },
  { id: 'floor-lamp', x0: -2.72 - LIV.lampBaseD / 2, z0: -1.55 - LIV.lampBaseD / 2, x1: -2.72 + LIV.lampBaseD / 2, z1: -1.55 + LIV.lampBaseD / 2 },
  { id: 'tv-stand', ...FOOT.stand },
  { id: 'bookshelf', ...FOOT.bookshelf },
  { id: 'big-plant', ...FOOT.bigPlant },
  { id: 'cardboard-box', ...FOOT.box },
];

/** Row 58: the routes through the room, measured between the footprints. A
 *  number here is what the ROUTE is, not what was assumed — the body radius
 *  is already subtracted where a piece borders the route. */
export function livingGapReport() {
  // axis gap between two rects (0 where they overlap on that axis)
  const gap = (a, b) => {
    const dx = Math.max(b.x0 - a.x1, a.x0 - b.x1);
    const dz = Math.max(b.z0 - a.z1, a.z0 - b.z1);
    return Math.max(dx, dz);
  };
  const BODY = 0.3; // MOVE.playerRadius
  return [
    {
      name: 'coffee → box',
      m: gap(FOOT.coffee, FOOT.box),
      min: LIV.walkway,
      note: 'the walk across the room’s south side, past the rug',
    },
    {
      name: 'balcony slider, clear of the stand',
      m: FOOT.stand.x0 - BODY - 0.77, // 0.77: the slider's west jamb (§2)
      min: LIV.walkway,
      note: 'the part of the 1.46 m glass the TV stand’s pad does not cover',
    },
    {
      name: 'bookshelf/plant → coffee (to the window)',
      m: gap(FOOT.bigPlant, FOOT.coffee),
      min: LIV.walkway,
      note: 'the band north of the coffee that the `n-window` spot is reached by',
    },
    {
      name: 'living → hall doorway',
      m: 2.32 - FOOT.coffee.x1, // east of the coffee to the walk edge, x
      min: LIV.walkway,
      note: 'the open field south of the coffee table, all the way to the doorway',
    },
    {
      name: 'sofa seat → coffee top',
      m: gap(S, FOOT.coffee),
      min: null, // a reach, not a walkway
      note: '0.46 m: a mug lands, a body does not',
    },
  ];
}
