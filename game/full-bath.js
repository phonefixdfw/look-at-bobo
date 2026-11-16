/*!
 * game/full-bath.js — the bathroom and the balcony as DATA (issue #49, parent #33).
 *
 * The ruler is docs/ISSUE_33_REBUILD.md §1 rows 52-59 (toilet, vanity + sink,
 * bath mirror, towel bar, tub, mat, walkway, balcony) and the §2 bathroom row
 * — x [−3.30, −1.02], z [2.22, 3.90], door-less on its east side (the cased
 * opening z 2.42 … 3.48) with the frosted window (z 2.60 … 3.30, sill 1.50) on
 * the west — plus the balcony row: x [0.55, 2.45], z [−4.40, −3.10], decking
 * 1.90 × 1.30, railing 1.00, and the 1.30-clear slider off the living room.
 * Like game/full-kitchen.js this file draws nothing and imports no Three.js:
 * it is the one place these two rooms' numbers are typed. game/full-bath-mesh.js
 * draws them, game/full-level.js splices BATH_COLLIDERS and BALCONY_COLLIDERS
 * into its COLLIDERS, and the `furniture-real-scale` check measures the same
 * rows back off the built boxes.
 *
 * Where everything goes, and why there (the room is 2.28 × 1.68 — every piece
 * is pinned by plaster, the ruler, or a cat spot):
 *   north  the vanity flush in the west corner — the `vanity` cat spot sits on
 *          its top at (−2.65, 2.46) and SUPPORT_DEFS.vanityTop pins the counter
 *          at 0.86 — with the mirror over it and the towel bar to its east, on
 *          the one clean stretch of north plaster left (x −2.05 … −1.45);
 *   north-east the toilet, back to the north wall facing south, clear of the
 *          vanity (0.38 m between them — a real bathroom leaves 0.20+) and
 *          well west of the doorway; its paper holder on the wall to its east;
 *   south  the tub along the south wall, drain end west, under the window
 *          (the sill is 1.50, the rim 0.55: the window stays above the tub and
 *          the tub still gets its light). It is built 1.60, not the ruler's
 *          1.68 — row 56 ALLOWS 1.5 … 1.8 — because at 1.68 the band between
 *          the tub face and the east plaster measures exactly 0.60, which a
 *          0.30 m body fits but the 0.10 m standability grid does not. At 1.60
 *          the band is 0.68 (the ruler's own 0.60, tolerated only in front of
 *          the tub, with 0.08 of grid play) and the cased opening stays fully
 *          clear. The bathroom SPAWN moved east into that band — the old
 *          point sat on the tub's own floor, which no wall-hung tub layout
 *          can free (see the PR); every cat spot stayed exactly where it was.
 *   middle the mat, 0.90 long in the one band the three pieces leave: vanity
 *          face (2.70, the mat's north edge tucks under the wall-hung cabinet)
 *          to tub face (3.15). That is 0.45 wide — the narrow end of row 57,
 *          which allows 0.45 … 0.70; it is also exactly where the `bath-mat`
 *          spot lies, so the cat is on the mat, not on bare tile;
 *   east   the doorway's field of floor — the room's only walkable band (see
 *          the walkway report below) — and the bin in its south corner.
 *
 * The balcony keeps everything the shell made (concrete, parapets, the metal
 * railing at 1.13) and adds the furniture the placeholder footprints promised:
 * the chair the `balcony-chair` spot loaf-sits on (its footprint unchanged, so
 * the `chairSeat` support still lands on it), a small round table, decking
 * boards over the slab, solid railing panels to 1.00 so there is no bar to
 * duck under and no ladder for a cat, a railing planter, a floor pot, and a
 * small bird on the cap rail.
 */

/** A footprint rect, the COLLIDERS convention: x0 z0 → x1 z1. */
const F = (x0, z0, x1, z1) => ({ x0, z0, x1, z1 });

/** Room faces, straight off §2 (interior faces, plaster not centreline). */
export const BATH = {
  x0: -3.30, x1: -1.02, z0: 2.22, z1: 3.90,
  // the cased doorway on the east wall (§2 openings table)
  doorLo: 2.42, doorHi: 3.48,
  // the west window (§2 windows: sill 1.50, head 2.05)
  winLo: 2.60, winHi: 3.30, winSill: 1.50, winHead: 2.05,
  // wall-tile band: 1.2 m up every wall, 1.2 cm proud (inside the walk
  // rects' 8 cm inset, so it reads as tile, never as a wall)
  tileTop: 1.2, tileProud: 0.012,
  // the row 58 numbers this room lives by: 0.90 anywhere, 0.60 tolerated in
  // front of the tub and toilet only (docs/ISSUE_33_REBUILD.md row 58)
  walkway: 0.90, walkwayTight: 0.60,
};

export const BALCONY = {
  x0: 0.55, x1: 2.45, z0: -4.40, z1: -3.10,
  // the slider (§2): clear x 0.85 … 2.15, 1.30 m
  doorLo: 0.85, doorHi: 2.15,
  // the metal railing the shell already built (kept): post line and top
  railZ: -4.365, railTop: 1.13,
  // ruler row 59: railing 1.00 high. The solid panels run 0.02 … 1.00; the
  // shell's rail above them is over-height, which row 59's 0.9 … 1.1 allows.
  panelTop: 1.00,
};

/** --------------------------------------------------------------------------
 *  FOOT: the push boxes, in the same `F` shape game/full-level.js splices.
 *  Every drawn piece is built at its FOOT rect, so the pad Bobo's body meets
 *  IS the drawn footprint — one copy of each number. The mat, the decking,
 *  the tiles, the curtain, the mirror, the bars and the rail panels are flat,
 *  walk-over or above-waist and get no pad, same policy as the living rug.
 *  -------------------------------------------------------------------------- */
export const FOOT = {
  // vanity: flush west, 0.90 along the north wall, 0.48 deep (row 53)
  vanity: F(-3.30, 2.22, -2.40, 2.70),
  // toilet: 0.37 × 0.68, back to the north wall (row 52)
  toilet: F(-2.02, 2.22, -1.65, 2.90),
  // tub: 1.60 × 0.75 along the south wall, rim 0.55 (row 56, see the header)
  tub: F(-3.30, 3.15, -1.70, 3.90),
  // the mat gets a FOOT for the walkway report but NO collider (2 cm of pile)
  mat: F(-2.65, 2.67, -1.75, 3.13),
  // small bin in the doorway field's south corner
  bin: F(-1.52, 3.66, -1.28, 3.90),
  // balcony chair: the placeholder's footprint, kept verbatim so the
  // `chairSeat` support (1.93 … 2.42, −3.87 … −3.33) still lands on it
  chair: F(1.90, -3.90, 2.45, -3.30),
  // small round table west of the chair (0.40 disc in this square pad)
  table: F(1.42, -3.80, 1.82, -3.40),
  // floor pot: the placeholder's footprint, kept verbatim, tucked in the
  // railing corner where the body can't reach anyway
  pot: F(0.63, -4.28, 0.90, -4.00),
};

/** The push boxes for the two rooms, spliced into game/full-level.js's
 *  COLLIDERS. The balcony railing pad is NOT here — it is the shell's, and
 *  it stays in full-level.js untouched ("keep the existing safe railing"). */
export const BATH_COLLIDERS = [
  { id: 'vanity', ...FOOT.vanity },
  { id: 'toilet', ...FOOT.toilet },
  { id: 'tub', ...FOOT.tub },
  { id: 'bath-bin', ...FOOT.bin },
];

export const BALCONY_COLLIDERS = [
  { id: 'balcony-chair', ...FOOT.chair },
  { id: 'balcony-table', ...FOOT.table },
  { id: 'balcony-plant', ...FOOT.pot },
];

/* -------------------------------------------------------------------------- *
 *  PIECES: the things the ruler measures, in game/full-kitchen.js's shape —
 *  parts are world boxes {x0,y0,z0,x1,y1,z1}, cyls are {x,z,y0,y1,rt,rb},
 *  `scale` names the row of docs/ISSUE_33_REBUILD.md §1 the built AABB answers
 *  to, `group` unions several meshes into one row. The shower curtain is the
 *  one PIECE with no `scale` and no pad: it is its own named object so a
 *  later chunk can wire `hide:` to it, and the tub's pad is the only body
 *  there is (the curtain must never block the player).
 * -------------------------------------------------------------------------- */

const bx = (x0, y0, z0, x1, y1, z1) => ({ x0, y0, z0, x1, y1, z1 });
const cy = (x, z, y0, y1, rt, rb = null, opts = {}) => ({ x, z, y0, y1, rt, rb: rb ?? rt, ...opts });

const piece = (id, mat, parts, scale = null, note = '', group = null, cyls = []) => ({
  id,
  mat,
  parts,
  cyls,
  scale,
  note,
  group,
});

const V = FOOT.vanity; // 0.86 = SUPPORT_DEFS.vanityTop: the counter's top IS the support
const T = FOOT.toilet;
const U = FOOT.tub;

export const PIECES = [
  /* ── vanity + sink (row 53): 0.90 × 0.48, counter top 0.85 … the support
   * says 0.86, so 0.86 it is — a cat whose spot says `vanityTop` stands on
   * the marble, not 1 cm above it. Wall-hung: the cabinet floats 8 cm off
   * the tile (the mat's north edge slides under it, like real life). */
  piece(
    'vanity',
    'woodPale',
    [
      // body + recessed toe: the body's front stops 4 cm inside the counter
      // overhang, and its toe 6 cm inside that, so the mat's tucked edge
      // never touches the cabinet — the union still reads 0.90 × 0.48 × 0.87.
      bx(V.x0 + 0.02, 0.06, V.z0, V.x1 - 0.02, 0.82, 2.66), // cabinet body
      bx(V.x0 + 0.02, 0, V.z0, V.x1 - 0.02, 0.06, 2.64), // toe, darker below
    ],
    null,
    'row 53: 0.90 × 0.48, counter top 0.86 (inside the 0.80…0.92 allowed)',
    'vanity',
  ),
  piece(
    'vanity-counter',
    'marble',
    [
      bx(V.x0, 0.82, V.z0, V.x1, 0.86, V.z0 + 0.10), // slab, north band
      bx(V.x0, 0.82, 2.59, V.x1, 0.86, V.z1), // slab, south band
      bx(V.x0, 0.82, V.z0 + 0.10, V.x0 + 0.10, 0.86, 2.59), // slab, west band
      bx(V.x1 - 0.10, 0.82, V.z0 + 0.10, V.x1, 0.86, 2.59), // slab, east band
      // the undermount bowl's rim, drawn as the counter's frame around a
      // recess: four lips of marble around a 0.60 × 0.27 well
      bx(V.x0 + 0.10, 0.82, V.z0 + 0.10, V.x0 + 0.15, 0.87, V.z1 - 0.06),
      bx(V.x1 - 0.15, 0.82, V.z0 + 0.10, V.x1 - 0.10, 0.87, V.z1 - 0.06),
      bx(V.x0 + 0.10, 0.82, V.z0 + 0.10, V.x1 - 0.10, 0.87, V.z0 + 0.15),
      bx(V.x0 + 0.10, 0.82, V.z1 - 0.11, V.x1 - 0.10, 0.87, V.z1 - 0.06),
    ],
    null,
    'the slab shares the vanity row through the group',
    'vanity',
  ),
  piece(
    'vanity-faucet',
    'chrome',
    [
      bx((V.x0 + V.x1) / 2 - 0.016, 0.86, V.z0 + 0.05, (V.x0 + V.x1) / 2 + 0.016, 1.06, V.z0 + 0.082), // column
      bx((V.x0 + V.x1) / 2 - 0.012, 1.06, V.z0 + 0.05, (V.x0 + V.x1) / 2 + 0.012, 1.085, 2.50), // gooseneck over the well
      bx((V.x0 + V.x1) / 2 + 0.016, 1.0, V.z0 + 0.055, (V.x0 + V.x1) / 2 + 0.062, 1.025, V.z0 + 0.078), // lever
    ],
    'faucet',
    'row 18 reused: 0.225 tall over the counter, inside 0.2 … 0.4; its neck stops 1.5 cm under the mirror’s sill',
  ),

  /* ── toilet (row 52): 0.37 × 0.68, seat 0.40, tank top 0.78. The measured
   * piece is pedestal + bowl + seat + closed lid (union: 0.37 × 0.68 × 0.425);
   * the tank sits on the pedestal's back and lives in DETAILS — row 52's
   * measured number is the SEAT, the tank top is dressing at 0.78. The
   * pedestal stops at z 2.68 and the bowl overhangs to 2.90, so the mat
   * touches the pedestal face instead of being sliced by the base. */
  piece(
    'toilet',
    'porcelain',
    [
      bx(T.x0 + 0.035, 0, T.z0, T.x1 - 0.035, 0.36, 2.68), // pedestal, floor to bowl
      bx(T.x0, 0.30, 2.52, T.x1, 0.40, T.z1), // bowl, full width, overhanging the mat
      bx(T.x0 + 0.02, 0.40, 2.54, T.x1 - 0.02, 0.425, T.z1 - 0.03), // closed lid
    ],
    'toilet',
    'row 52: 0.37 × 0.68, seat (lid) top 0.425 inside 0.36…0.45 — the lid is the seat face when shut',
  ),

  /* ── tub (row 56): 1.60 × 0.75, rim 0.55 — see the header for the 1.60.
   * Skirt + rim deck is the measured piece; the well is drawn as four rim
   * walls over a 0.50 floor. Taps, shower arm and head are chrome DETAILS,
   * the curtain its own untagged PIECE. */
  piece(
    'tub',
    'porcelain',
    [
      bx(U.x0, 0, U.z0, U.x1, 0.52, U.z1), // outer shell (skirt)
    ],
    null,
    'the deck shares the tub row through the group',
    'tub',
  ),
  piece(
    'tub-deck',
    'porcelain',
    [
      // rim deck, 0.55 at the outer edge, 6 cm all round over the well
      bx(U.x0, 0.52, U.z0, U.x1, 0.55, U.z0 + 0.06), // north rim
      bx(U.x0, 0.52, U.z1 - 0.06, U.x1, 0.55, U.z1), // south rim
      bx(U.x0, 0.52, U.z0, U.x0 + 0.06, 0.55, U.z1), // west rim
      bx(U.x1 - 0.06, 0.52, U.z0, U.x1, 0.55, U.z1), // east rim
    ],
    null,
    'also the tub group: rim 0.55 inside 0.5…0.62',
    'tub',
  ),
  piece(
    'tub-well',
    'porcelainPale',
    [
      bx(U.x0 + 0.06, 0.50, U.z0 + 0.06, U.x1 - 0.06, 0.52, U.z1 - 0.06), // the well floor you see from above
    ],
    null,
    'inside the measured envelope, deliberately untagged',
  ),

  /* ── bath mirror (row 54): 0.70 × 0.90, bottom y 1.10, over the vanity,
   * centred on it (x −2.85 ± 0.35). Frame + glass measure as one 0.70 × 0.90. */
  piece(
    'bath-mirror',
    'mirrorFrame',
    [
      bx(-3.20, 1.10, V.z0, -2.50, 2.00, V.z0 + 0.045), // frame, 0.70 × 0.90 × 4.5 cm
    ],
    'bath-mirror',
    'row 54: 0.70 × 0.90 bottom 1.10, centred on the basin',
  ),

  /* ── towel bar (row 55): 0.60 long at y 1.15 on the north plaster east of
   * the mirror; the towel is plain colour (the lookalike black-and-white set
   * is a later chunk). */
  piece(
    'towel-bar',
    'chrome',
    [
      bx(-2.05, 1.14, 2.24, -1.45, 1.165, 2.27), // the bar
      bx(-2.05, 1.115, 2.225, -2.02, 1.165, 2.27), // bracket west
      bx(-1.48, 1.115, 2.225, -1.45, 1.165, 2.27), // bracket east
    ],
    'towel-bar',
    'row 55: 0.60 long, axis y 1.15',
  ),

  /* ── bath mat (row 57): 0.90 × 0.45 in the band the vanity and the tub
   * leave (see FOOT.mat). Row 57 checks the WIDTH and allows 0.45 … 0.70;
   * this is 0.45 — the narrowest honest number the room has. Under the
   * wall-hung cabinet's toe and 2 cm shy of the tub face. */
  piece(
    'bath-mat',
    'mat',
    [bx(FOOT.mat.x0, 0, FOOT.mat.z0, FOOT.mat.x1, 0.022, FOOT.mat.z1)],
    'bath-mat',
    'row 57: 0.90 long × 0.46 wide (a centimetre inside the allowed 0.45 at the pinched end of its range)',
  ),

  /* ── shower curtain: the hide-behind piece. Its own named mesh, no scale
   * row, no pad — gathered folds on the rod, bottoms 40 cm above the rim. */
  piece(
    'shower-curtain',
    'curtain',
    [],
    null,
    'gathered panels — built by the mesh module from CURTAIN below',
  ),

  /* ── balcony chair: 0.55 × 0.60 × 0.85 slatted folding chair, seat top 0.42
   * = SUPPORT_DEFS.chairSeat. Footprint is the placeholder's, unchanged. */
  piece(
    'balcony-chair',
    'deckWood',
    [
      bx(1.94, 0, -3.86, 1.99, 0.42, -3.34), // frame rail west
      bx(2.36, 0, -3.86, 2.41, 0.42, -3.34), // frame rail east
      bx(1.94, 0.40, -3.86, 2.41, 0.42, -3.34), // seat bearer
      bx(1.90, 0.42, -3.36, 2.45, 0.445, -3.30), // seat slabs, back edge
      bx(1.90, 0.42, -3.42, 2.45, 0.445, -3.38),
      bx(1.90, 0.42, -3.48, 2.45, 0.445, -3.44),
      bx(1.90, 0.42, -3.54, 2.45, 0.445, -3.50),
      bx(1.90, 0.42, -3.60, 2.45, 0.445, -3.56),
      bx(1.90, 0.445, -3.90, 2.45, 0.85, -3.84), // back panel against the rail side
    ],
    'balcony-chair',
    '0.55 × 0.60 × 0.85, seat top 0.42 — the `chairSeat` support lands on it',
  ),

  /* ── balcony table (row 37 reused): Ø0.40 × 0.50 slatted bistro table, in
   * the FOOT.table pad west of the chair — the same row the living room's
   * drum answers to. w and d both read 0.40 off the disc. */
  piece(
    'balcony-table',
    'deckWood',
    [],
    'side-table',
    'row 37 reused: 0.40 dia × 0.50 high, inside 0.38 … 0.52 and 0.48 … 0.62',
    null,
    [
      cy(1.62, -3.6, 0.475, 0.5, 0.2), // top disc
      cy(1.62, -3.6, 0.02, 0.475, 0.03), // column
      cy(1.62, -3.6, 0, 0.02, 0.15), // foot plate
    ],
  ),

  /* ── railing panels (row 59): solid to 1.00, hung on the shell's posts.
   * Two panels with a control joint at the middle; the measured row is the
   * PANEL height (0.98), and the 0.02 base gap keeps the decking's drainage
   * running under them. No cap, no shelf: nothing to sit on, no step for a
   * cat, and the walk rect + its 0.30 pad already hold a body off the line. */
  piece(
    'railing-panel-w',
    'railPanel',
    [bx(0.56, 0.02, BALCONY.railZ - 0.013, 1.49, BALCONY.panelTop, BALCONY.railZ + 0.013)],
    'railing',
    'row 59: solid railing to 1.00 — 0.98 measured, inside 0.9…1.1',
    'railing',
  ),
  piece(
    'railing-panel-e',
    'railPanel',
    [bx(1.51, 0.02, BALCONY.railZ - 0.013, 2.44, BALCONY.panelTop, BALCONY.railZ + 0.013)],
    'railing',
    'row 59, east panel — same measured group',
    'railing',
  ),
];

/** The curtain's build numbers (the mesh module gathers them deterministically). */
export const CURTAIN = {
  rodY: 1.98,
  rodZ: 3.13, // hung just inside the tub's north face
  x0: -3.28, // tucked behind the west plaster
  x1: -1.72, // bracket post at the tub's east end
  yBottom: 0.62, // 7 cm over the rim — cloth, not a fence
  yTop: 1.94,
  folds: 15, // panels across the run
  depth: 0.035, // how deep each fold bellows
};

/* -------------------------------------------------------------------------- *
 *  DETAILS: the dressing that only has to look right — merged per material,
 *  deliberately unmeasured, colliders never derive from these.
 * -------------------------------------------------------------------------- */

const WC = (V.x0 + V.x1) / 2; // −2.85: the basin's centre line, used below
const TX = (T.x0 + T.x1) / 2; // −1.835: the toilet's centre line

export const DETAILS = {
  // the tank row 52 names (top 0.78), sitting on the pedestal's back
  tank: bx(TX - 0.165, 0.40, T.z0, TX + 0.165, 0.76, 2.44),
  tankLid: bx(TX - 0.185, 0.76, T.z0 - 0.005, TX + 0.185, 0.78, 2.455),
  // the bowl's well, dark porcelain, seen through the counter's rim
  bowlWell: bx(-3.15, 0.70, 2.37, -2.55, 0.83, 2.59),
  // the mirror's glass, on the frame's face — 3 mm proud of the frame front,
  // where a looking surface actually lives
  mirrorGlass: bx(-3.15, 1.15, 2.266, -2.55, 1.95, 2.27),
  // the towel on the bar: plain duck-egg blue, no pattern yet (chunk 3d's
  // lookalike set owns black-and-white), doubled over the bar like a hung towel
  towel: bx(-2.02, 0.86, 2.245, -1.74, 1.145, 2.275),
  towelBack: bx(-2.02, 0.96, 2.215, -1.74, 1.145, 2.245),
  // paper holder on the west… no — north plaster, east of the tank, y 0.65
  paperArm: bx(T.x1 + 0.12, 0.63, 2.225, T.x1 + 0.15, 0.66, 2.32),
  paperRoll: cy(T.x1 + 0.135, 2.275, 0.59, 0.7, 0.055, null, { rotX: Math.PI / 2, len: 0.09, at: [T.x1 + 0.135, 0.645, 2.275] }), // on its side, by its axle
  // tub fittings: spout and two taps on the west wall (below the window line),
  // the shower arm out of the same wall, head over the well's west end
  tubSpout: cy(-3.24, 3.55, 0.62, 0.62, 0.022, null, { rotZ: Math.PI / 2, len: 0.09, at: [-3.24, 0.62, 3.55] }),
  tapW: cy(-3.255, 3.42, 0.6, 0.6, 0.019, null, { rotZ: Math.PI / 2, len: 0.06, at: [-3.255, 0.6, 3.42] }),
  tapE: cy(-3.255, 3.68, 0.6, 0.6, 0.019, null, { rotZ: Math.PI / 2, len: 0.06, at: [-3.255, 0.6, 3.68] }),
  showerArm: cy(-3.28, 3.42, 1.98, 1.98, 0.016, null, { rotZ: Math.PI / 2, len: 0.5, at: [-3.03, 1.98, 3.42] }),
  showerHead: cy(-2.79, 3.42, 1.94, 1.98, 0.075, 0.03),
  // the bin: open tin, 0.24 × 0.24 × 0.28 (its FOOT is 0.24 × 0.24 + slack)
  bin: bx(-1.50, 0, 3.68, -1.30, 0.28, 3.88),
  // the mat's two tone bands are one colour family (plain, row 57 again)
  // — the mat itself is a PIECE; these are its woven border stripes
  // (none: one plain slab is the honest read at this size)
};

/** The floor pot on the balcony: same spiral-leaf rig as the living plants,
 *  smaller. Its FOOT.pot is the placeholder's, kept verbatim. */
export const BALCONY_PLANT = {
  x: 0.765,
  z: -4.14,
  y0: 0.022, // on top of the decking
  pot: { h: 0.24, r0: 0.10, r1: 0.125 },
  leaf: { len: 0.2, wid: 0.15, bend: 0.07 },
  count: 11,
};

/** The railing planter and the bird: two boxes and a card each. */
export const BIRD = {
  pot: { x: 2.02, z: BALCONY.railZ, y: BALCONY.railTop + 0.005 }, // sits ON the cap rail
  x: 1.62, z: -4.365, y: 1.185, // on the rail, west of the planter, facing the glass door
};

/** Row 58 for these two rooms, measured between the FOOT rects (same style as
 *  game/full-living.js's report: a number that IS the route, not an
 *  assumption). The bathroom's only walkway is the band the tub, toilet and
 *  doorway make; the ruler allows 0.60 in front of the toilet and the tub and
 *  nothing else gets less than 0.90 — this room is the reason row 58 has the
 *  exception, so the exception is what gets measured and printed. */
export function bathGapReport() {
  const BODY = 0.3; // MOVE.playerRadius
  return [
    {
      name: 'bath: doorway field (toilet flank → east plaster)',
      m: BATH.x1 - T.x1, // 0.63: the open floor the body actually crosses
      min: BATH.walkwayTight,
      note: 'row 58’s tolerated 0.60, in front of the toilet — the room’s whole walkable field',
    },
    {
      name: 'bath: tub face → east band (body centre)',
      m: T.x1 + 0.35 - U.x1 - BODY, // the centre-line play past the tub’s east end
      min: 0,
      note: 'the standable band north of the bin; the tub end and the east plaster are 0.68 apart',
    },
    {
      name: 'bath: mat strip (vanity face → tub face)',
      m: U.z0 - (V.z1 + 0.02), // 0.43 of clear floor plus what the mat tucks
      min: null, // a place to stand and dry feet, not a route
      note: '0.45 m: the mat’s whole room — the cat’s crossing, wider than the body’s radius',
    },
    {
      name: 'balcony: slider clear past the chair',
      m: FOOT.chair.x0 - BODY - BALCONY.doorLo, // the glass the chair pad does not cover
      min: BATH.walkwayTight,
      note: 'of the 1.30 clear door, 0.75 m the chair’s pad leaves — the body enters there',
    },
    {
      name: 'balcony: body standoff from the rail line',
      m: 0.35 + 0.3, // the walk rect's 0.35 short stop plus the body's own radius
      min: null, // a clearance, not a route
      note: 'the rect stops 0.35 m short of the rail’s inner face; a body is a whole radius further off still',
    },
  ];
}

