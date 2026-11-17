/*!
 * game/full-kitchen-details.js — the kitchen's small pieces (issue #44, parent #33).
 *
 * Continues the pattern game/full-kitchen.js set: this file draws nothing and
 * imports no Three.js — it is where the kitchen's small numbers are typed once.
 * The ruler is docs/ISSUE_33_REBUILD.md §1 rows 23 to 33 (small appliances,
 * dish rack, bin, breakfast bar, stools, runner); game/full-kitchen-details-mesh.js
 * draws these boxes, game/full-level.js splices the COLLIDERS below, and the
 * `furniture-real-scale` check measures the built AABBs back against the same
 * rows. Rows already in SCALE_RANGES — `bar-height` (row 31) and `bar-stool`
 * (row 32) — are reused rather than re-typed.
 *
 * What the plan says goes here (docs/ISSUE_33_REBUILD.md §2 and §4 chunk 2):
 * the KITCHEN gets the breakfast bar and two stools; the dining table and its
 * four chairs are the LIVING ROOM's ("table SE" on the plan's map, chunk 3),
 * so they are deliberately absent — this is the bar, not the table. The bar
 * stands exactly where the merged level data says it does: support
 * `barTop` (game/full-shell.js — since issue #81 patch x 3.76–5.12,
 * z 0.22–0.58, top 1.05) and the placeholder footprints in COLLIDERS, which
 * KITCHEN_DETAILS_COLLIDERS below replaces value for value. Issue #81 rode
 * the whole run 0.44 m east and shortened it 0.20: the kitchen→dining
 * doorway's structural gap (x 2.60–3.66) took the old west end out from
 * under it, and the bar now stands 8 cm clear of the new casing, with the
 * stools, pendants and the `sink-sit.bar` spot riding along.
 *
 * The worktop props (rows 23 to 28) all stand on the 0.90 worktop INSIDE the
 * counters' existing padded footprints: a pad on top of a pad carves nothing
 * new, so they travel with no colliders of their own — same reasoning as the
 * upper cabinets in game/full-kitchen.js. The runner has none either: a 2-D
 * pad would wall off the galley aisle around a 1 cm of weave, which is worse
 * than the playset tell this whole issue is about.
 */

/** --------------------------------------------------------------------------
 *  The ruler, as named constants (docs/ISSUE_33_REBUILD.md §1 rows 23-33).
 *  `build` is what these pieces are built at; the mesh tags each with its row
 *  and game/full.js measures the built box against SCALE_RANGES in
 *  game/full-level.js (the row's tolerance column). Where the build column and
 *  the tolerance column of the same ruler row disagree — the kettle, whose
 *  0.24 build would overshoot the row's own 0.22 ceiling — the tolerance wins,
 *  the same call issue #41 made for the hood; the deviation is noted per piece.
 *  -------------------------------------------------------------------------- */
export const KIT_D = {
  WT: 0.9, //            the worktop everything in rows 23-27 stands on
  // row 23: microwave 0.52 × 0.38 × 0.30 (allows long 0.45…0.60, high 0.24…0.36)
  mwcW: 0.52, mwcD: 0.38, mwcH: 0.3,
  // row 24: kettle 0.17 dia × 0.24 (ALLOWS high 0.14…0.22 — the body is built
  // 0.20 and the lid knob on top of it, as dressing, carries the silhouette
  // to the ruler's 0.24; the measured box is the body)
  kettleDia: 0.17, kettleH: 0.2,
  // row 25: toaster 0.26 × 0.18 × 0.19 (allows high 0.15…0.24)
  tstW: 0.26, tstD: 0.18, tstH: 0.19,
  // row 26: coffee maker 0.20 × 0.26 × 0.36 (allows high 0.28…0.45)
  cofW: 0.2, cofD: 0.26, cofH: 0.36,
  // row 27: dish rack 0.40 × 0.30 × 0.15 (allows high 0.10…0.22)
  rackW: 0.3, rackD: 0.4, rackH: 0.15,
  // row 28: trash bin — issue #82 grew it to the kitchen's proper food-waste
  // bin, 0.35 dia × 0.62 (the ruler row moved with it: 0.33…0.37 across,
  // 0.58…0.66 high). A 0.30 tin beside the sink could not hold a day of
  // kitchen scraps, and the owner asked for the bigger one.
  binDia: 0.35, binH: 0.62,
  // issue #82: the feeding corner — a 12 mm silicone mat under 7 cm bowls
  matT: 0.012, bowlH: 0.07,
  // row 31: breakfast bar top 1.05 with a 0.30 overhang (allows 0.98…1.15).
  // The carcass is 0.40 deep against the south wall; the top is 0.70 deep, so
  // the overhang the row names is the 0.30 the stools tuck under.
  barTopY: 1.05, barTopT: 0.04, barOverhang: 0.3,
  // row 32: bar stool seat 0.68 (allows 0.60…0.75) — backless, so the stool's
  // overall height IS the seat height the row measures, and it lands inside
  // the existing `bar-stool` range's 0.6…0.7 on all three keys.
  stoolW: 0.36, stoolSeat: 0.68,
  // row 33: runner 0.70 × 2.00 (allows wide 0.60…0.85 — the check's `d`, the
  // short horizontal extent, since `w` is the long one)
  rugW: 0.7, rugL: 2.0, rugT: 0.01,
};

/* -------------------------------------------------------------------------- *
 *  PIECES — one measurable box each, in the same shape game/full-kitchen.js
 *  uses so the mesh builder and the ruler check treat them identically.
 *  `shape: 'cyl'` draws the envelope's inscribed cylinder; `parts` replaces
 *  the solid box with those boxes merged into ONE mesh (so the mesh's world
 *  AABB is still the envelope the ruler measures — the dish rack is a base,
 *  four posts and a rim, the stool a seat, four legs and a footrest, and both
 *  still measure the row's full number).
 * -------------------------------------------------------------------------- */

const piece = (id, mat, [x0, x1], [y0, y1], [z0, z1], scale = null, note = '', extra = {}) => ({
  id,
  mat,
  x0,
  y0,
  z0,
  x1,
  y1,
  z1,
  scale,
  note,
  ...extra,
});

const on = (h) => [KIT_D.WT, KIT_D.WT + h]; // a height above the worktop

export const PIECES = [
  // ── the north run's worktop, west end to bowl (wall backsplash z −2.88) ──
  // The microwave takes the corner: 0.52 across it, 2 cm off the tile, and its
  // 1.20 top still clears the upper cabinets' 1.45 bottoms.
  piece('microwave', 'steel', [2.54, 3.06], on(KIT_D.mwcH), [-2.86, -2.48], ['microwave'], 'row 23: in the corner, door facing the aisle'),
  // The toaster keeps the backsplash (its x stops where the window glass's
  // 12 cm sill-board zone starts at 3.40); the kettle, which must live in that
  // zone, keeps its full 13 cm off the wall instead.
  piece('toaster', 'steel', [3.1, 3.36], on(KIT_D.tstH), [-2.86, -2.68], ['toaster'], 'row 25: slots up, lever east'),
  piece('kettle', 'steel', [3.4, 3.57], on(KIT_D.kettleH), [-2.77, -2.6], ['kettle'], 'row 24: body 0.20 (the row ALLOWS ≤ 0.22), knob as dressing tops it out near the ruler’s 0.24', { shape: 'cyl' }),
  // The rack sits on the sink's drainer (its 0.904 top), 2 cm clear of the
  // bowl's cut-out at x 3.90 — water goes where it already went.
  piece('dish-rack', 'steel', [3.58, 3.88], [KIT_D.WT + 0.004, KIT_D.WT + 0.004 + KIT_D.rackH], [-2.75, -2.35], ['dish-rack'], 'row 27: over the drainer', { parts: 'rack' }),
  // ── the east run's worktop (tile x 5.50-5.52, uppers from y 1.45) ───────
  piece('coffee-maker', 'dark', [5.24, 5.44], on(KIT_D.cofH), [-0.62, -0.36], ['coffee-maker'], 'row 26: under the uppers, clear of the hood lip'),
  // ── the bin: the east run's south end corner (moved there in issue #59 —
  //    at the old return-adjacent footprint its body-pad rotated the costumed
  //    bobo's measured approach at the return loaf past the cats-face-the-room
  //    limit once #56's rig landed on main; here it is clear of the doorway
  //    walk rect, both kitchen spawns, and every cat approach). Issue #82
  //    grew it in place to the 0.35 × 0.62 food-waste bin the owner asked
  //    for: it shares the old corner, its pad still stops short of the
  //    kitchen→dining doorway lane and of the bar stool's. ──────────────────
  piece('trash-bin', 'dark', [5.17, 5.52], [0, KIT_D.binH], [0.26, 0.61], ['trash-bin'], 'row 28: 0.35 dia × 0.62 (issue #82), in the bar\'s east corner', { shape: 'cyl' }),
  // ── the cat's dinner corner (issue #82): two steel bowls on a dark silicone
  //    mat, on the open floor east of the west counter's return — where a
  //    feeding station actually lives, out of the aisle (the mat's pad keeps
  //    x ≥ 3.78 of the galley aisle) and 2 cm under the sight clip. One tagged
  //    mesh, two bowls: the pair is row 'food-bowl' together. ────────────────
  piece('food-bowl', 'steel', [3.1, 3.44], [KIT_D.matT, KIT_D.matT + KIT_D.bowlH], [-1.6, -1.05], ['food-bowl'], 'issue #82: two 0.16 dia × 0.07 bowls on the mat, pair measured as one row', { parts: 'bowls' }),
  // ── the breakfast bar (row 31), where game/full-shell.js `barTop` says ──
  // Carcass 0.40 deep on the south wall; top 0.70 deep — the 0.30 overhang
  // runs north over the stools. Measured: the top's 1.05.
  piece('bar-carcass', 'front', [3.74, 5.14], [0, KIT_D.barTopY - KIT_D.barTopT], [0.2, 0.6], null, 'the bar base; its collider is exactly this box (issue #81: rode 0.44 east of the kitchen→dining doorway)'),
  piece('bar-top', 'worktop', [3.74, 5.14], [KIT_D.barTopY - KIT_D.barTopT, KIT_D.barTopY], [-0.1, 0.6], ['bar-height'], 'row 31: 1.05 with the 0.30 overhang north'),
  // Two stools under the overhang, one on each pendant (issue #81 moved them
  // with the bar; the footprints kept their 0.36 × 0.36 size),
  // each side of the `sink-sit.bar` spot at x 4.1.
  piece('bar-stool-a', 'wood', [3.99, 4.35], [0, KIT_D.stoolSeat], [-0.15, 0.21], ['bar-stool'], 'row 32: backless, seat top 0.68', { parts: 'stool' }),
  piece('bar-stool-b', 'wood', [4.73, 5.09], [0, KIT_D.stoolSeat], [-0.15, 0.21], ['bar-stool'], 'row 32: the second stool', { parts: 'stool' }),
  // ── the runner, in the galley aisle in front of the sink run ────────────
  // No collider, on purpose (see the header): this is floor dressing you walk
  // ON, not furniture that keeps a body out.
  piece('kitchen-rug', 'rug', [2.85, 4.85], [0, KIT_D.rugT], [-2.06, -1.36], ['rug-runner'], 'row 33: 0.70 × 2.00 runner'),
];

/* -------------------------------------------------------------------------- *
 *  DETAILS — the hardware and the handful of live props that make the counters
 *  read as used (the mesh builder merges them per material; like all dressing
 *  they are deliberately not measurable). The pendant lamps have no ruler row,
 *  so they are drawn from PENDANTS below by the mesh builder as emissive
 *  meshes: no new light (the rig is at its four fills and the flat's real-
 *  light count must stay ≤ 6, docs/ART_STYLE.md §4).
 * -------------------------------------------------------------------------- */

export const DETAILS = [
  // microwave: window, control panel and a bar handle on the door
  { id: 'mwc-window', mat: 'glass', x0: 2.58, y0: KIT_D.WT + 0.05, z0: -2.5, x1: 2.86, y1: KIT_D.WT + 0.25, z1: -2.475 },
  { id: 'mwc-panel', mat: 'dark', x0: 2.9, y0: KIT_D.WT + 0.05, z0: -2.5, x1: 3.03, y1: KIT_D.WT + 0.25, z1: -2.475 },
  { id: 'mwc-pull', mat: 'handle', x0: 2.58, y0: KIT_D.WT + 0.13, z0: -2.515, x1: 2.86, y1: KIT_D.WT + 0.155, z1: -2.5 },
  // toaster: two slots and a lever
  { id: 'tst-slot-a', mat: 'dark', x0: 3.13, y0: KIT_D.WT + KIT_D.tstH - 0.004, z0: -2.81, x1: 3.21, y1: KIT_D.WT + KIT_D.tstH + 0.004, z1: -2.73 },
  { id: 'tst-slot-b', mat: 'dark', x0: 3.25, y0: KIT_D.WT + KIT_D.tstH - 0.004, z0: -2.81, x1: 3.33, y1: KIT_D.WT + KIT_D.tstH + 0.004, z1: -2.73 },
  { id: 'tst-lever', mat: 'dark', x0: 3.36, y0: KIT_D.WT + 0.05, z0: -2.8, x1: 3.375, y1: KIT_D.WT + 0.085, z1: -2.74 },
  // kettle: lid, knob (the dressing that carries the 0.20 body up to the
  // ruler's 0.24 silhouette), spout and the side handle
  { id: 'kettle-lid', mat: 'steel', x0: 3.425, y0: KIT_D.WT + KIT_D.kettleH, z0: -2.71, x1: 3.545, y1: KIT_D.WT + KIT_D.kettleH + 0.014, z1: -2.66 },
  { id: 'kettle-knob', mat: 'dark', x0: 3.472, y0: KIT_D.WT + KIT_D.kettleH + 0.014, z0: -2.695, x1: 3.498, y1: KIT_D.WT + KIT_D.kettleH + 0.036, z1: -2.675 },
  { id: 'kettle-spout', mat: 'steel', x0: 3.335, y0: KIT_D.WT + 0.07, z0: -2.705, x1: 3.405, y1: KIT_D.WT + 0.17, z1: -2.665 },
  { id: 'kettle-handle', mat: 'dark', x0: 3.565, y0: KIT_D.WT + 0.04, z0: -2.735, x1: 3.595, y1: KIT_D.WT + 0.16, z1: -2.695 },
  // coffee maker: the lid, and the glass carafe facing the aisle
  { id: 'cof-lid', mat: 'steel', x0: 5.25, y0: KIT_D.WT + KIT_D.cofH, z0: -0.6, x1: 5.43, y1: KIT_D.WT + KIT_D.cofH + 0.012, z1: -0.38 },
  { id: 'cof-carafe', mat: 'glass', x0: 5.205, y0: KIT_D.WT + 0.02, z0: -0.58, x1: 5.245, y1: KIT_D.WT + 0.24, z1: -0.4 },
  // the rack's three plates standing in it
  { id: 'rack-plate-a', mat: 'steel', x0: 3.64, y0: KIT_D.WT + 0.024, z0: -2.66, x1: 3.665, y1: KIT_D.WT + 0.17, z1: -2.44 },
  { id: 'rack-plate-b', mat: 'steel', x0: 3.71, y0: KIT_D.WT + 0.024, z0: -2.66, x1: 3.735, y1: KIT_D.WT + 0.17, z1: -2.44 },
  { id: 'rack-plate-c', mat: 'steel', x0: 3.78, y0: KIT_D.WT + 0.024, z0: -2.66, x1: 3.805, y1: KIT_D.WT + 0.17, z1: -2.44 },
  // bin: the lid and a pedal — a lid you step on is another playset tell gone
  // (issue #82 moved them onto the bigger bin's mouth and south face)
  { id: 'bin-rim', mat: 'steel', x0: 5.18, y0: KIT_D.binH, z0: 0.27, x1: 5.51, y1: KIT_D.binH + 0.025, z1: 0.6 },
  { id: 'bin-pedal', mat: 'steel', x0: 5.275, y0: 0.012, z0: 0.61, x1: 5.415, y1: 0.04, z1: 0.637 },
  // issue #82: the silicone mat under the cat's two bowls — dressing, no
  // ruler row of its own (the bowls carry it) and no collider (the pair does)
  { id: 'pet-mat', mat: 'dark', x0: 3.1, y0: 0, z0: -1.6, x1: 3.44, y1: KIT_D.matT, z1: -1.05 },
  // the bar: recessed toe and a drawer line across the carcass front (z 0.2)
  { id: 'bar-toe', mat: 'dark', x0: 3.78, y0: 0, z0: 0.2, x1: 5.10, y1: 0.1, z1: 0.26 },
  { id: 'bar-drawer', mat: 'handle', x0: 3.82, y0: 0.86, z0: 0.185, x1: 5.06, y1: 0.875, z1: 0.2 },
  // a few things that make the counters look used: a cutlery jar with three
  // bars of steel in it, a jar beside it, and two mugs by the coffee maker
  { id: 'cutlery-jar', mat: 'steel', x0: 3.16, y0: KIT_D.WT, z0: -2.62, x1: 3.28, y1: KIT_D.WT + 0.14, z1: -2.5 },
  ...[3.19, 3.22, 3.25].map((x, i) => ({ id: `cutlery-${i}`, mat: 'handle', x0: x, y0: KIT_D.WT + 0.1, z0: -2.585, x1: x + 0.012, y1: KIT_D.WT + 0.26, z1: -2.573 })),
  { id: 'counter-jar', mat: 'enamel', x0: 4.6, y0: KIT_D.WT, z0: -2.55, x1: 4.72, y1: KIT_D.WT + 0.12, z1: -2.43 },
  { id: 'mug-a', mat: 'enamel', x0: 5.14, y0: KIT_D.WT, z0: -0.28, x1: 5.22, y1: KIT_D.WT + 0.095, z1: -0.2 },
  { id: 'mug-b', mat: 'enamel', x0: 5.14, y0: KIT_D.WT, z0: -0.17, x1: 5.22, y1: KIT_D.WT + 0.095, z1: -0.09 },
];

/** The two pendants, centred over the stools on the bar (x is the stool
 *  centres; z 0.25 is the bar top's front half). The mesh builder hangs a rod
 *  from the ceiling, an emissive shade and an emissive bulb on each; they are
 *  meshes only — no light is added, and they need no collider because the
 *  bar's own pad already keeps every body 0.30 m clear of them, the same
 *  argument the upper cabinets in game/full-kitchen.js make. */
export const PENDANTS = [{ x: 4.17, z: 0.25 }, { x: 4.91, z: 0.25 }];

/* -------------------------------------------------------------------------- *
 *  COLLIDERS: spliced into game/full-level.js. The bar, its two stools and
 *  their footprints are value-for-value the placeholders that list carried —
 *  nothing a player, cat or spawn depended on moves — plus the bin's 0.30.
 *  Worktop props carry none (their footprints are inside the counters'
 *  existing pads); neither does the runner or the pendants (see above).
 * -------------------------------------------------------------------------- */
export const KITCHEN_DETAILS_COLLIDERS = [
  { id: 'kitchen-bar', x0: 3.74, z0: 0.2, x1: 5.14, z1: 0.6 },
  { id: 'bar-stool-a', x0: 3.99, z0: -0.15, x1: 4.35, z1: 0.21 },
  { id: 'bar-stool-b', x0: 4.73, z0: -0.15, x1: 5.09, z1: 0.21 },
  { id: 'kitchen-bin', x0: 5.17, z0: 0.26, x1: 5.52, z1: 0.61 }, // issue #59: east run's south end corner (was x 2.7-3.0, z -1.1--0.8); issue #82: the wider body grew 2 cm each way in place
  { id: 'pet-bowls', x0: 3.1, z0: -1.6, x1: 3.44, z1: -1.05 }, // issue #82: the bowls AND their mat, one push box (the mat itself never collides); the east face leaves the d-kitchen decoy's shoulder room
];
