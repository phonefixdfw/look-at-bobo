/*!
 * game/full-bath.js — the bathroom and the balcony as DATA (issue #49, parent #33).
 *
 * The ruler is docs/ISSUE_33_REBUILD.md §1 rows 52-57 (toilet, vanity + sink,
 * bath mirror, towel bar, tub, bath mat) and row 59 (balcony 1.90 × 1.30
 * decking, railing 1.00 high) plus rows 58 and 61/62, and the bathroom and
 * balcony rows of the room table and the openings table in section 2 (bathroom
 * x [−3.30, −1.02], z [2.22, 5.20] — issue #67 grew it south into the void at
 * the bedroom's north band, from the [2.22, 3.90] the table still prints),
 * door-less on its east side (the cased
 * opening z 2.42 … 3.48) with the frosted window (z 2.60 … 3.30, sill 1.50) on
 * the west — plus the balcony row: x [0.55, 2.45], z [−4.40, −3.10], decking
 * 1.90 × 1.30, railing 1.00, and the 1.30-clear slider off the living room).
 * Like game/full-kitchen.js this file draws nothing and imports no Three.js:
 * it is the one place these two rooms' numbers are typed. game/full-bath-mesh.js
 * draws them, game/full-level.js splices BATH_COLLIDERS and BALCONY_COLLIDERS
 * into its COLLIDERS, and the `furniture-real-scale` check measures the same
 * rows back off the built boxes.
 *
 * The draw-call budget shapes this file. The flat's worst capture frame
 * (main, before these rooms) is 139 draws against the tool's 150, so the two
 * rooms together get ELEVEN meshes, not one per part:
 *   1  vanity        one marble piece — cabinet, slab, bowl rim and the
 *                    bowl's well are one stone vanity, claimed as `vanity`
 *   2  toilet       pedestal+bowl+lid+tank, one porcelain piece claimed as
 *                    `toilet` (the ruler's toilet INCLUDES the tank: 0.78)
 *   3  tub           skirt, rim deck and well floor, claimed as `tub`
 *   4  mirror        frame and glass in one chrome box, `bath-mirror`
 *   5  towel bar     a fabric-wrapped bar with the towel draped over it,
 *                    `towel-bar` (row 55 measures its length and bar top;
 *                    the towel hangs below by design)
 *   6  mat           `bath-mat`
 *   7  curtain       the named `shower-curtain` mesh, folds only
 *   8  fittings      one white (porcelain) mesh: tile band, paper holder,
 *                    taps, spout, shower arm+head, curtain rod, bin, and a
 *                    porcelain sparrow on the balcony's cap rail — white
 *                    enamel fittings were the norm in exactly this bathroom
 *   9  balcony       ONE wood mesh: decking, the solid railing panels, the
 *                    folding chair, the bistro table, the floor pot and the
 *                    railing planter. It carries `railing`
 *                    because the panels ARE its top: the box reads exactly
 *                    1.00 high — if the panels ever go, the row drops with
 *                    them, which is what row 59 is for
 *   10 leaves         the two plant spirals (their own green material)
 *   11 window         the frosted pane — the "soft light" of the brief,
 *                    emissive-only so the light budget stays at six
 *
 * Where everything goes, and why there (the room is 2.28 × 2.98 since issue #67
 * took the service void behind its south wall — every piece is still pinned by
 * plaster, the ruler, or a cat spot):
 *   north  the vanity flush in the west corner — the `vanity` cat spot sits on
 *          its top at (−2.65, 2.46) and SUPPORT_DEFS.vanityTop pins the counter
 *          at 0.86 — with the mirror over it and the towel bar to its east, on
 *          the one clean stretch of north plaster left (x −2.05 … −1.45);
 *   north-east the toilet, back to the north wall facing south, clear of the
 *          vanity (0.38 m between them — a real bathroom leaves 0.20+) and
 *          well west of the doorway; its paper holder on the wall to its east;
 *   south  the tub along the SOUTH wall, drain end west, where the old
 *          partition used to be — issue #67 moved it 1.30 m down into the floor
 *          it gained, so the whole window wall (sill 1.50 over a 0.55 rim) and
 *          the middle of the room are open tile again. It is built 1.60, not
 *          the ruler's 1.68 — row 56 ALLOWS 1.5 … 1.8 — because at 1.68 the
 *          band between the tub face and the east plaster measures exactly
 *          0.60, which a 0.30 m body fits but the 0.10 m standability grid
 *          does not. At 1.60 the band is 0.68 (the ruler's own 0.60, tolerated
 *          only in front of the tub, with 0.08 of grid play) and the cased
 *          opening stays fully clear. The bathroom SPAWN stays east in that
 *          band — the old point sat on the tub's own floor, which no wall-hung
 *          tub layout can free (see the PR); every cat spot stayed exactly
 *          where it was except the mat's, which rode the tub south, and the
 *          hall dash's, which faces the bathroom door (see the PR).
 *   middle the 1.73 m strip of open floor the enlargement bought, with the mat
 *          0.90 × 0.55 (row 57's allowed width, the brief's own number) at the
 *          tub's north face, where feet land coming out. That is where the
 *          `bath-mat` spot lies, so the cat is on the mat, not bare tile;
 *   east   the doorway's field of floor — the cased opening's approach, and the
 *          bin in the corner at the tub's east end.
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
  // Issue #67: z1 was 3.90 (a 2.28 × 1.68 = 3.8 m2 room). The sealed service
  // void behind the old south partition is the room now, to the bedroom's own
  // north band at z 5.20: 2.28 × 2.98 = 6.8 m2.
  x0: -3.30, x1: -1.02, z0: 2.22, z1: 5.20,
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
  // decking: 14 cm boards with a 12 mm drainage gap, running east
  boardW: 0.14, boardGap: 0.012, boardTop: 0.022,
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
  // tub: 1.60 × 0.75, drain end west, along the SOUTH plaster — issue #67
  // moved it off the old partition (z 3.90) down to the room's new south face,
  // which is what frees the 1.73 m strip of open floor in the middle (rim 0.55,
  // row 56; see the header for the 1.60)
  tub: F(-3.30, 4.45, -1.70, 5.20),
  // the mat gets a FOOT for the walkway report but NO collider (2 cm of pile);
  // it lies at the tub's north face, where feet actually land coming out (its
  // old spot, under the cabinet's toe, went with the tub)
  mat: F(-2.65, 3.90, -1.75, 4.45),
  // small bin in the corner at the tub's east end (was the doorway field's
  // south corner, which the old tub occupied)
  bin: F(-1.58, 4.90, -1.34, 5.14),
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
 *  PIECES: the meshes the ruler measures — the six tagged pieces and the
 *  curtain's build stub, in game/full-kitchen.js's shape. parts are world
 *  boxes {x0,y0,z0,x1,y1,z1}, cyls are {x,z,y0,y1,rt,rb} (or a stub with
 *  `at`/`len`/a rot key), `scale` names the row of docs/ISSUE_33_REBUILD.md §1
 *  the built AABB answers to. Everything else in the two rooms is drawn by
 *  game/full-bath-mesh.js in the three big merged chunks the header counts;
 *  those live in FITTINGS and BALCONY_BUILD below, not here.
 * -------------------------------------------------------------------------- */

const bx = (x0, y0, z0, x1, y1, z1) => ({ x0, y0, z0, x1, y1, z1 });
const cy = (x, z, y0, y1, rt, rb = null, opts = {}) => ({ x, z, y0, y1, rt, rb: rb ?? rt, ...opts });

const piece = (id, mat, parts, scale = null, note = '', cyls = []) => ({
  id, mat, parts, cyls, scale, note,
});

const V = FOOT.vanity; // 0.86 = SUPPORT_DEFS.vanityTop: the counter's top IS the support
const T = FOOT.toilet;
const U = FOOT.tub;
const WC = (V.x0 + V.x1) / 2; // −2.85: the basin's centre line
const TX = (T.x0 + T.x1) / 2; // −1.835: the toilet's centre line

export const PIECES = [
  /* ── vanity + sink (row 53): one stone piece, 0.90 × 0.48, counter top
   * 0.86 — the support says 0.86, so 0.86 it is: a cat whose spot says
   * `vanityTop` stands on the marble, not 1 cm above it. Wall-hung: the
   * cabinet floats 6 cm off the tile and the mat slides under its toe.
   * The undermount bowl is the slab's own rim around a recessed well, so
   * the WHOLE vanity — cabinet, slab, rim, well — is one marble AABB:
   * 0.90 × 0.48, top 0.87 (the rim lip's 87th cm inside row 53's 0.90). */
  piece(
    'vanity',
    'marble',
    [
      bx(V.x0 + 0.02, 0.06, V.z0, V.x1 - 0.02, 0.82, 2.66), // cabinet body
      bx(V.x0 + 0.02, 0, V.z0, V.x1 - 0.02, 0.06, 2.64), // recessed toe
      bx(V.x0, 0.82, V.z0, V.x1, 0.86, V.z0 + 0.10), // slab, north band
      bx(V.x0, 0.82, 2.59, V.x1, 0.86, V.z1), // slab, south band
      bx(V.x0, 0.82, V.z0 + 0.10, V.x0 + 0.10, 0.86, 2.59), // slab, west band
      bx(V.x1 - 0.10, 0.82, V.z0 + 0.10, V.x1, 0.86, 2.59), // slab, east band
      bx(V.x0 + 0.10, 0.82, V.z0 + 0.10, V.x0 + 0.15, 0.87, V.z1 - 0.06), // bowl rim west
      bx(V.x1 - 0.15, 0.82, V.z0 + 0.10, V.x1 - 0.10, 0.87, V.z1 - 0.06), // bowl rim east
      bx(V.x0 + 0.10, 0.82, V.z0 + 0.10, V.x1 - 0.10, 0.87, V.z0 + 0.15), // bowl rim north
      bx(V.x0 + 0.10, 0.82, V.z1 - 0.11, V.x1 - 0.10, 0.87, V.z1 - 0.06), // bowl rim south
      bx(-3.15, 0.70, 2.37, -2.55, 0.83, 2.59), // the bowl's well, sunk in the slab
    ],
    'vanity',
    'row 53: 0.90 × 0.48, counter top 0.86, rim lip 0.87 (inside the 0.80…0.92 allowed); the bowl reads through the rim around its well',
  ),

  /* ── toilet (row 52): 0.37 × 0.68 with a 0.425 closed lid and a 0.78
   * tank — one piece, one box: the ruler's toilet includes its tank, so
   * the measured height is the tank top (0.72…0.85 allowed). The pedestal
   * stops at z 2.68 and the bowl overhangs to 2.90, so the mat touches the
   * pedestal face instead of being sliced by the base. */
  piece(
    'toilet',
    'porcelain',
    [
      bx(T.x0 + 0.035, 0, T.z0, T.x1 - 0.035, 0.36, 2.68), // pedestal
      bx(T.x0, 0.30, 2.52, T.x1, 0.40, T.z1), // bowl, overhanging the mat
      bx(T.x0 + 0.02, 0.40, 2.54, T.x1 - 0.02, 0.425, T.z1 - 0.03), // closed lid
      bx(TX - 0.165, 0.40, T.z0, TX + 0.165, 0.76, 2.44), // tank
      bx(TX - 0.185, 0.76, T.z0, TX + 0.185, 0.78, 2.455), // tank lid
    ],
    'toilet',
    'row 52: 0.37 × 0.68, seat 0.425, tank top 0.78 — one box, the ruler number and the real thing',
  ),

  /* ── tub (row 56): 1.60 × 0.75, rim 0.55 — see the header for the 1.60.
   * Skirt, rim deck and well floor are the measured piece (all inside the
   * 0.55 envelope); the fittings are white enamel and live in FITTINGS. */
  piece(
    'tub',
    'porcelain',
    [
      bx(U.x0, 0, U.z0, U.x1, 0.52, U.z1), // outer shell (skirt)
      bx(U.x0, 0.52, U.z0, U.x1, 0.55, U.z0 + 0.06), // rim, north
      bx(U.x0, 0.52, U.z1 - 0.06, U.x1, 0.55, U.z1), // rim, south
      bx(U.x0, 0.52, U.z0, U.x0 + 0.06, 0.55, U.z1), // rim, west
      bx(U.x1 - 0.06, 0.52, U.z0, U.x1, 0.55, U.z1), // rim, east
      bx(U.x0 + 0.06, 0.50, U.z0 + 0.06, U.x1 - 0.06, 0.52, U.z1 - 0.06), // well floor
    ],
    'tub',
    'row 56: 1.60 × 0.75, rim 0.55 inside 0.5…0.62 — the well floor sits inside the measured box',
  ),

  /* ── bath mirror (row 54): 0.70 × 0.90, bottom y 1.10, over the vanity,
   * centred on it (x −2.85 ± 0.35). Frame + glass are one chrome box: the
   * glass sits 3 mm proud of the frame front, where a looking surface
   * actually lives, and both read as the mirror, so both are the row. */
  piece(
    'bath-mirror',
    'chrome',
    [
      bx(-3.20, 1.10, V.z0, -2.50, 2.00, V.z0 + 0.045), // frame, 0.70 × 0.90 × 4.5 cm
      bx(-3.15, 1.15, 2.266, -2.55, 1.95, 2.27), // glass, proud of the frame
    ],
    'bath-mirror',
    'row 54: 0.70 × 0.90 bottom 1.10, centred on the basin',
  ),

  /* ── towel bar (row 55): 0.60 long at y 1.15 on the north plaster east of
   * the mirror. The bar is wrapped and the towel is doubled over it — one
   * fabric piece, and row 55 measures what it always measured: the bar's
   * length and its top. The towel hangs below the measured top by design. */
  piece(
    'towel-bar',
    'towel',
    [
      bx(-2.05, 1.14, 2.24, -1.45, 1.165, 2.27), // the bar (its fabric sleeve)
      bx(-2.05, 1.115, 2.225, -2.02, 1.165, 2.27), // wrap, west end
      bx(-1.48, 1.115, 2.225, -1.45, 1.165, 2.27), // wrap, east end
      bx(-2.02, 0.86, 2.245, -1.74, 1.145, 2.275), // the towel, front fall
      bx(-2.02, 0.96, 2.215, -1.74, 1.145, 2.245), // the towel, back fall
    ],
    'towel-bar',
    'row 55: 0.60 long, bar top 1.165 — the towel drapes from it',
  ),

  /* ── bath mat (row 57): 0.90 × 0.55 (the brief's own mat, inside row 57's
   * 0.45…0.70) in the band the vanity and the tub leave: its north 10 cm
   * under the wall-hung toe, its south edge at the tub's face. */
  piece(
    'bath-mat',
    'mat',
    [bx(FOOT.mat.x0, 0, FOOT.mat.z0, FOOT.mat.x1, 0.022, FOOT.mat.z1)],
    'bath-mat',
    'row 57: 0.90 long × 0.55 wide, the middle of the allowed 0.45…0.70',
  ),

  /* ── shower curtain: the hide-behind piece. Its own named mesh, no scale
   * row, no pad — gathered folds on the rod (the rod itself is enamel, in
   * FITTINGS). Bottoms 7 cm over the rim: cloth, not a fence. */
  piece(
    'shower-curtain',
    'curtain',
    [],
    null,
    'gathered panels — built by the mesh module from CURTAIN below',
  ),
];

/** The curtain's build numbers (the mesh module gathers them deterministically). */
export const CURTAIN = {
  rodY: 1.98,
  rodZ: 4.43, // hung just inside the tub's north face
  x0: -3.28, // tucked behind the west plaster
  x1: -1.72, // bracket post at the tub's east end
  clothX1: -2.15, // where the gathered cloth ends (issue #70): the ROD spans
  // x0..x1 like always, but the 15 folds are bunched into x0..clothX1, leaving
  // an open 0.43 m of doorway at the east end — behind that cloth is the tub,
  // and behind that gap is how the cat stays findable. The fold boxes live in
  // one merged mesh, so gathering changes numbers, not draw calls.
  yBottom: 0.62, // 7 cm over the rim — cloth, not a fence
  yTop: 1.94,
  folds: 15, // panels across the run
  depth: 0.035, // how deep each fold bellows
};

/* -------------------------------------------------------------------------- *
 *  FITTINGS: the one white-enamel mesh the bathroom's hardware shares —
 *  enamel (porcelain) taps, spout, shower arm and head, the curtain's rod
 *  in its brackets, the paper holder and roll, and the bin. White fittings
 *  are what a bathroom of this shape actually had. Unmeasured, uncollided;
 *  the tile band is built from BATH by the mesh module and joins it.
 * -------------------------------------------------------------------------- */
export const FITTINGS = {
  paperArm: bx(T.x1 + 0.12, 0.63, 2.225, T.x1 + 0.15, 0.66, 2.32),
  paperRoll: cy(0, 0, 0, 0, 0.055, null, { rotX: Math.PI / 2, len: 0.09, at: [T.x1 + 0.135, 0.645, 2.275] }),
  tubSpout: cy(0, 0, 0, 0, 0.022, null, { rotZ: Math.PI / 2, len: 0.09, at: [-3.24, 0.62, 4.83] }),
  tapW: cy(0, 0, 0, 0, 0.019, null, { rotZ: Math.PI / 2, len: 0.06, at: [-3.255, 0.6, 4.70] }),
  tapE: cy(0, 0, 0, 0, 0.019, null, { rotZ: Math.PI / 2, len: 0.06, at: [-3.255, 0.6, 4.96] }),
  showerArm: cy(0, 0, 0, 0, 0.016, null, { rotZ: Math.PI / 2, len: 0.5, at: [-3.03, 1.98, 4.70] }),
  showerHead: cy(-2.79, 4.70, 1.94, 1.98, 0.075, 0.03),
  // the bin: an open enamel tin, 0.20 × 0.20 × 0.28 (its FOOT has slack)
  bin: bx(-1.56, 0, 4.92, -1.36, 0.28, 5.12),
  // the sparrow: a small porcelain bird on the balcony's cap rail (1.13),
  // facing the glass door — a ceramic prop, so it rides the enamel mesh and
  // the wood mesh's railing row stays the honest 1.00 it measures
  bird: [
    bx(1.62 - 0.035, 1.145, -4.365 - 0.03, 1.62 + 0.035, 1.185, -4.365 + 0.03), // body
    bx(1.62 - 0.02, 1.185, -4.365, 1.62 + 0.015, 1.215, -4.365 + 0.035), // head, toward the door
    bx(1.62 + 0.03, 1.15, -4.365 - 0.055, 1.62 + 0.045, 1.165, -4.365 - 0.03), // tail
  ],
};

/* -------------------------------------------------------------------------- *
 *  BALCONY_BUILD: everything the one wood mesh draws. The chair's footprint
 *  is the placeholder's, unchanged, so the `chairSeat` support still lands
 *  on it; the table is the drum's row (Ø0.40 × 0.50); the panels are row 59
 *  and the mesh's top; the pot, planter and bird are furniture-sized props.
 *  The decking boards are generated from BALCONY by the mesh module.
 * -------------------------------------------------------------------------- */
export const BALCONY_BUILD = {
  // railing panels (row 59): solid 0.02 … 1.00, hung on the shell's posts,
  // a control joint at the middle. No cap, no shelf: nothing to sit on, no
  // step for a cat, and the walk rect + its 0.30 pad hold a body off the line.
  panels: [
    bx(0.56, 0.02, BALCONY.railZ - 0.013, 1.49, BALCONY.panelTop, BALCONY.railZ + 0.013),
    bx(1.51, 0.02, BALCONY.railZ - 0.013, 2.44, BALCONY.panelTop, BALCONY.railZ + 0.013),
  ],
  // 0.55 × 0.60 × 0.85 slatted folding chair, seat top 0.42 = chairSeat
  chair: [
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
  // Ø0.40 × 0.50 slatted bistro table, west of the chair (row 37's sizes —
  // the living drum already claims that row, this is its twin outside)
  table: [
    cy(1.62, -3.6, 0.475, 0.5, 0.2), // top disc
    cy(1.62, -3.6, 0.02, 0.475, 0.03), // column
    cy(1.62, -3.6, 0, 0.02, 0.15), // foot plate
  ],
  // the floor pot (cylinder) and its soil lid
  pot: { x: 0.765, z: -4.14, y0: BALCONY.boardTop, h: 0.24, r0: 0.10, r1: 0.125 },
  // the railing planter: a trough hung on the panel's room face (its top
  // stays under the panels' 1.00, so the wood mesh's measured top IS the
  // railing, and there is still nothing on the rail to sit on or climb)
  planter: bx(1.86, 0.72, -4.352, 2.18, 0.865, -4.242),
};

/** The floor pot's leaf rig: the living room's spiral, smaller, seeded by
 *  name so it is deterministic (the trough's blades ride it too, in the mesh). */
export const BALCONY_PLANT = {
  x: BALCONY_BUILD.pot.x,
  z: BALCONY_BUILD.pot.z,
  y0: BALCONY_BUILD.pot.y0,
  pot: { h: BALCONY_BUILD.pot.h },
  leaf: { len: 0.2, wid: 0.15, bend: 0.07 },
  count: 11,
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
      note: "row 58's tolerated 0.60, in front of the toilet — the room's tightest stretch",
    },
    {
      name: 'bath: tub face → east band (body centre)',
      m: T.x1 + 0.35 - U.x1 - BODY, // the centre-line play past the tub's east end
      min: 0,
      note: "the standable band north of the bin; the tub end and the east plaster are 0.68 apart",
    },
    {
      name: 'bath: open floor (vanity face → tub face)',
      m: U.z0 - (V.z1 + 0.02), // 1.73 of clear floor: issue #67's whole point
      min: BATH.walkway,
      note: "the strip the enlargement bought — 1.73 m of tile to walk on between the fixtures and the tub's face, and the mat lies in it",
    },
    {
      name: 'balcony: slider clear past the chair',
      m: FOOT.chair.x0 - BODY - BALCONY.doorLo, // the glass the chair pad does not cover
      min: BATH.walkwayTight,
      note: "of the 1.30 clear door, 0.75 m the chair's pad leaves — the body enters there",
    },
    {
      name: 'balcony: body standoff from the rail line',
      m: 0.35 + 0.3, // the walk rect's 0.35 short stop plus the body's own radius
      min: null, // a clearance, not a route
      note: "the rect stops 0.35 m short of the rail's inner face; a body is a whole radius further off still",
    },
  ];
}
