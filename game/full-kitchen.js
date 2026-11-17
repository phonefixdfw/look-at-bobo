/*!
 * game/full-kitchen.js — the kitchen as DATA (issue #41, parent #33).
 *
 * The ruler is docs/ISSUE_33_REBUILD.md §1 rows 11-22 and the room is its §2
 * kitchen row: x [2.52, 5.52], z [−2.90, 0.60], the window over the sink on the
 * north wall (x 3.40–4.90, sill 0.95, head 1.75), the doorway in the west wall
 * (z −0.68…0.38). Like game/full-shell.js this file draws nothing and imports
 * no Three.js: it is the one place the kitchen's numbers are typed. The builder
 * (game/full-kitchen-mesh.js) draws these boxes, game/full-level.js footprints
 * its COLLIDERS from them, and the `furniture-real-scale` check measures the
 * same rows back — a size typed twice is how the playset happened.
 *
 * The run, and why it sits where it does:
 *   north  x 2.52 → 4.92, 0.60 deep — the sink under the window (its bowl is
 *          centred on the glass at x 4.15), the dishwasher at the run's west
 *          end, the worktop stopping short of the fridge so the glass from
 *          x 4.90 to 4.92 stays clear;
 *   east   x 4.92–5.52, z −1.35 → 0.30 — the range with the hood over it, then
 *          cabinets. It starts at z −1.35 rather than turning the corner
 *          because the fridge-floor spot (SPOTS `sink-sit.fridge`, x 5.20
 *          z −1.75 — #88 moved this spot to the fridge roof, but the east run
  *          still stops where it always did) has to stay standable floor: MOVE.playerRadius is 0.30, so
 *          any piece north of z −1.45 would eat that spot, and the brief says
 *          move the piece, never the spot. That leaves 0.85 m of bare wall
 *          between the fridge and the run, which is the walkway in front of the
 *          fridge anyway.
 *   west   x 2.52–3.12, z −2.30 → −1.05 — the return the merged level data
 *          already assumes (SUPPORT_DEFS `counterTopW` and the `counter-return`
 *          spot at x 2.82 z −1.50), and the old placeholder footprint verbatim.
 *   fridge x 4.92–5.52, z −2.90 → −2.20 in the north-east corner: 0.70 wide,
 *          1.80 tall, its west face 0.02 clear of the window jamb.
 *
 * Uppers go on the three walls away from the window (row 15). Nothing here is
 * above 2.15, and no upper needs a collider: every one of them stands over a
 * 0.60 m counter, whose own padded footprint already keeps a 0.30 m body 0.90 m
 * off that wall — 0.55 m clear of the 0.35-deep cabinet above it.
 */

/** --------------------------------------------------------------------------
 *  The ruler, as named constants (docs/ISSUE_33_REBUILD.md §1 rows 11-22).
 *  `build` is what this kitchen is built at; `allows` is what the check accepts
 *  measured back off the built box, i.e. the tolerance column of the same row.
 *  -------------------------------------------------------------------------- */
export const KIT = {
  // room faces (game/full-shell.js ROOMS.kitchen)
  x0: 2.52, x1: 5.52, z0: -2.9, z1: 0.6,
  // rows 11-14: the run itself
  depth: 0.6, //       row 12  counter depth      allows 0.55 … 0.68
  top: 0.9, //         row 11  worktop height     allows 0.85 … 0.95
  worktopT: 0.04, //   row 13  worktop thickness  allows 0.025 … 0.06
  bsTop: 1.35, //      row 14  backsplash         allows 1.20 … 1.50
  // row 15: the uppers
  upD: 0.35, upH: 0.7, upBottom: 1.45,
  // row 16: a base cabinet door
  doorH: 0.629, doorBottom: 0.108, // 8 mm above the kick, 8 mm under the drawer
  // the carcass between the toe kick and the worktop, and the drawer line
  toeH: 0.1, toeIn: 0.06,
  drawerY0: 0.745, drawerY1: 0.855,
  // row 17/18: sink and faucet
  sinkW: 0.5, sinkD: 0.42, sinkDepth: 0.2,
  faucetH: 0.28, faucetReach: 0.22,
  // row 19/20: range and hood (the hood is built 0.52 rather than the row's
  // 0.50 so no measured face sits exactly on the tolerance edge, where a float
  // AABB would decide the check on a rounding)
  rangeW: 0.6, rangeD: 0.6, hoodW: 0.6, hoodD: 0.52, hoodY0: 1.55, hoodY1: 1.85,
  // row 21/22: fridge and dishwasher
  fridgeW: 0.7, fridgeD: 0.6, fridgeH: 1.8, dishW: 0.6,
};

/** The three faces the run stands against, as interior-face coordinates. */
export const RUNS = {
  n: { x0: 2.52, x1: 4.92, z0: -2.9, z1: -2.3, wall: 'n' },
  w: { x0: 2.52, x1: 3.12, z0: -2.3, z1: -1.05, wall: 'w' },
  e: { x0: 4.92, x1: 5.52, z0: -1.35, z1: 0.3, wall: 'e' },
  // the range breaks the east run, and the appliance fills that break
  range: { x0: 4.92, x1: 5.52, z0: -1.35, z1: -0.75 },
  fridge: { x0: 4.92, x1: 5.52, z0: -2.9, z1: -2.2 },
};

/* -------------------------------------------------------------------------- *
 *  PIECES: the things the ruler measures. Each is one world-aligned box,
 *  `scale` naming the row(s) of docs/ISSUE_33_REBUILD.md §1 it is checked
 *  against (a piece may answer to more than one row: a worktop is both the
 *  height and the thickness). game/full-kitchen-mesh.js draws each of these as
 *  its own mesh and copies `scale` into `userData.scale`, which is what
 *  `furniture-real-scale` looks for; the detail that dresses them (toe kicks,
 *  drawer fronts, handles, burners) is in DETAILS and is merged, so it is
 *  deliberately not measurable and deliberately not tagged.
 * -------------------------------------------------------------------------- */

/** A box from a run rect, y range, material slot and ruler rows. `group` names
 *  a row measured across more than one box (the faucet is a column and a
 *  spout); the check unions every mesh that carries it. */
const piece = (id, mat, [x0, x1], [y0, y1], [z0, z1], scale = null, note = '', group = null) => ({
  id,
  mat,
  group,
  x0,
  y0,
  z0,
  x1,
  y1,
  z1,
  scale,
  note,
});

const WT_Y = [KIT.top - KIT.worktopT, KIT.top]; // 0.86 … 0.90
const CARCASS_Y = [KIT.toeH, KIT.top - KIT.worktopT]; // 0.10 … 0.86
const SPLASH_Y = [KIT.top, KIT.bsTop]; // 0.90 … 1.35
const UPPER_Y = [KIT.upBottom, KIT.upBottom + KIT.upH]; // 1.45 … 2.15
/** The three ruler rows a full-depth worktop answers to. */
const WT_ROWS = ['counter-height', 'counter-depth', 'worktop-thickness'];

// The bowl's cut-out, and the only two things in the flat that break a run:
// the sink hole in the north worktop, and the sink base's open shelf under it
// (a real sink base has no shelf, which is why the bowl can be 0.20 deep).
const BOWL = {
  x0: 4.15 - KIT.sinkW / 2,
  x1: 4.15 + KIT.sinkW / 2,
  z0: -2.65 - KIT.sinkD / 2,
  z1: -2.65 + KIT.sinkD / 2,
};
/** A run rect minus a rectangular hole, as the four slabs that are left. */
function minusHole(x0, x1, z0, z1, h) {
  return [
    [x0, h.x0, z0, z1], // west of it
    [h.x1, x1, z0, z1], // east of it
    [h.x0, h.x1, z0, h.z0], // behind it
    [h.x0, h.x1, h.z1, z1], // in front of it
  ].filter(([a0, a1, b0, b1]) => a1 - a0 > 0.001 && b1 - b0 > 0.001);
}

export const PIECES = [
  // ── the north run: sink under the window, dishwasher at the west end ─────
  // The carcass stops short of the bowl (see BOWL) and the worktop is cut
  // around it, so both are four boxes rather than one. The full-depth boxes
  // carry row 12; the slabs beside the cut-out are still the same height and
  // thickness and carry those two rows.
  piece('carcass-n-w', 'carcass', [2.52, BOWL.x0], CARCASS_Y, [-2.9, -2.34], ['counter-depth'], 'base cabinets, 0.56 under a 0.60 worktop'),
  piece('carcass-n-e', 'carcass', [BOWL.x1, 4.92], CARCASS_Y, [-2.9, -2.34], null, 'the end filler: 0.52 wide, so it is not a depth sample'),
  piece('carcass-n-base', 'carcass', [BOWL.x0, BOWL.x1], [KIT.toeH, 0.64], [-2.9, -2.34], null, 'the sink base, open-shelved'),
  ...minusHole(2.52, 4.92, -2.9, -2.3, BOWL).map(([x0, x1, z0, z1], i) =>
    piece(`worktop-n${i}`, 'worktop', [x0, x1], WT_Y, [z0, z1], ['counter-height', 'worktop-thickness']),
  ),
  // The north wall is plaster only west of the window (x 3.40) and east of it
  // the counter stops at the jamb, so the tile runs 2.52 → 3.40.
  piece('splash-n', 'tile', [2.52, 3.4], SPLASH_Y, [-2.9, -2.88], ['backsplash'], 'tile up to 1.35'),
  // ── the west return (the pass-through wall: SUPPORT_DEFS counterTopW) ────
  // butts into the north run's front plane at z −2.34: 3 cm short of it left a
  // pocket that read as a bright wedge of wall at the kitchen camera's angle.
  piece('carcass-w', 'carcass', [2.52, 3.08], CARCASS_Y, [-2.34, -1.05], ['counter-depth']),
  piece('worktop-w', 'worktop', [2.52, 3.12], WT_Y, [-2.3, -1.05], WT_ROWS),
  piece('splash-w', 'tile', [2.52, 2.54], SPLASH_Y, [-2.3, -1.05], ['backsplash']),
  // ── the east run: the range in the break, then cabinets ──────────────────
  piece('carcass-e', 'carcass', [4.96, 5.52], CARCASS_Y, [-0.75, 0.3], ['counter-depth']),
  piece('worktop-e', 'worktop', [4.92, 5.52], WT_Y, [-0.75, 0.3], WT_ROWS),
  piece('splash-e', 'tile', [5.5, 5.52], SPLASH_Y, [-1.35, 0.3], ['backsplash']),
  // ── the uppers, on the three walls away from the window (row 15) ────────
  piece('upper-n', 'carcass', [2.52, 3.36], UPPER_Y, [-2.9, -2.9 + KIT.upD], ['upper-cabinet', 'upper-mounted']),
  piece('upper-w', 'carcass', [2.52, 2.52 + KIT.upD], UPPER_Y, [-2.3, -1.05], ['upper-cabinet', 'upper-mounted']),
  piece('upper-e', 'carcass', [5.52 - KIT.upD, 5.52], UPPER_Y, [-0.75, 0.3], ['upper-cabinet', 'upper-mounted']),

  // ── the appliances (rows 19 to 22) ──────────────────────────────────────
  // The range fills the break in the east run, its own top flush with the
  // worktop at 0.90, so the run reads as one line with a cooktop in it.
  piece('range', 'steel', [4.92, 5.52], [0, KIT.top], [-1.35, -0.75], ['range'], '0.60 × 0.60, 4 burners, knobs'),
  piece('hood', 'steel', [5.52 - KIT.hoodD, 5.52], [KIT.hoodY0, KIT.hoodY1], [-1.35, -0.75], ['hood'], 'over the range'),
  piece('fridge', 'enamel', [4.92, 5.52], [0, KIT.fridgeH], [-2.9, -2.2], ['fridge'], 'door seam + handle'),
  piece('dishwasher', 'steel', [3.12, 3.72], [0, KIT.top - KIT.worktopT], [-2.9, -2.32], ['dishwasher'], 'its face in the door line'),
  // ── the sink and the faucet (rows 17, 18) ───────────────────────────────
  // The bowl is an inset box the mesh builder hollows (4 walls + a floor); the
  // measured piece is its outer rim-to-rim envelope, which is the row's number.
  // `hollow` tells the builder to draw the envelope as an open-topped bowl.
  {
    ...piece(
      'sink',
      'steel',
      [4.15 - KIT.sinkW / 2, 4.15 + KIT.sinkW / 2],
      [KIT.top - KIT.sinkDepth - 0.02, KIT.top],
      [-2.65 - KIT.sinkD / 2, -2.65 + KIT.sinkD / 2],
      ['sink'],
      'centred on the glass, 0.06 off the wall',
    ),
    hollow: 0.02,
  },
  // The faucet is one measured thing drawn as two boxes: a column standing on
  // the deck east of the bowl and a spout that reaches 0.22 west over it
  // (row 18's numbers, one object, not two). East of the bowl rather than
  // behind it on purpose: the window's sill board projects 12 cm into the room
  // (game/full-apartment.js), so nothing can rise off the worktop within 12 cm
  // of that wall.
  piece('faucet-column', 'steel', [4.56 - 0.022, 4.56 + 0.022], [KIT.top, KIT.top + KIT.faucetH], [-2.65 - 0.022, -2.65 + 0.022], null, '0.28 over the worktop', 'faucet'),
  piece('faucet-spout', 'steel', [4.56 + 0.022 - KIT.faucetReach, 4.56 + 0.022], [KIT.top + KIT.faucetH - 0.032, KIT.top + KIT.faucetH], [-2.65 - 0.017, -2.65 + 0.017], null, '0.22 reach over the bowl', 'faucet'),
];

/* -------------------------------------------------------------------------- *
 *  DOORS (row 16: 0.58 tall × 0.45 wide, the check allows h 0.50 … 0.70).
 *  Each is its own mesh and carries the row, because a playset front and a
 *  cabinet front are the same box at a different scale and the difference is
 *  the whole point of the issue. A drawer front and a handle bar go with every
 *  door; those two are dressing and are merged.
 * -------------------------------------------------------------------------- */

/** One hinged front. `axis` is the direction the run runs along, `lo`/`hi` the
 *  door's width along it, `face` the plane the carcass front sits in and
 *  `dir` which way the room is from there (+1 means the front faces +axis).
 *  `edge` picks the handle side (−1 / +1 along the run). */
function door(id, axis, lo, hi, face, dir, edge = -1, up = false) {
  const t = 0.02; // the front is 2 cm proud of the carcass
  const y0 = up ? KIT.upBottom + 0.06 : KIT.doorBottom;
  const y1 = up ? KIT.upBottom + KIT.upH - 0.06 : KIT.doorBottom + KIT.doorH;
  const box =
    axis === 'x'
      ? { x0: lo, y0, z0: dir > 0 ? face : face - t, x1: hi, y1, z1: dir > 0 ? face + t : face }
      : { x0: dir > 0 ? face : face - t, y0, z0: lo, x1: dir > 0 ? face + t : face, y1, z1: hi };
  PIECES.push({ ...piece(id, 'front', [box.x0, box.x1], [box.y0, box.y1], [box.z0, box.z1], ['cab-door']), axis });
  // handle: an 11 cm bar, 3.5 cm off the chosen edge, standing 3.5 cm proud of
  // the front near its top (base doors) or its bottom (uppers, so you can get
  // a hand under it from where you stand).
  const hy0 = up ? y0 + 0.03 : y1 - 0.14;
  const hx = axis === 'x' ? (edge < 0 ? lo + 0.05 : hi - 0.05) : (dir > 0 ? face + 0.035 : face - 0.035);
  const hz = axis === 'z' ? (edge < 0 ? lo + 0.05 : hi - 0.05) : (dir > 0 ? face + 0.035 : face - 0.035);
  DETAILS.push(
    axis === 'x'
      ? { id: `${id}-pull`, mat: 'handle', x0: hx - 0.012, y0: hy0, z0: dir > 0 ? face + t : face - t - 0.035, x1: hx + 0.012, y1: hy0 + 0.11, z1: dir > 0 ? face + t + 0.035 : face - t }
      : { id: `${id}-pull`, mat: 'handle', x0: dir > 0 ? face + t : face - t - 0.035, y0: hy0, z0: hz - 0.012, x1: dir > 0 ? face + t + 0.035 : face - t, y1: hy0 + 0.11, z1: hz + 0.012 },
  );
  // the drawer over every door: 11 cm of the same front under the worktop
  if (!up) {
    DETAILS.push({
      id: `${id}-drawer`,
      mat: 'front',
      x0: box.x0,
      y0: KIT.drawerY0,
      z0: box.z0,
      x1: box.x1,
      y1: KIT.drawerY1,
      z1: box.z1,
    });
  }
  return box;
}

export const DETAILS = [
  // toe kicks: 10 cm high, 6 cm behind the front line, in shadow so dark
  ...[
    { id: 'toe-n', axis: 'x', x0: 2.52, x1: 4.92, z0: -2.9, z1: -2.9 + KIT.toeIn },
    { id: 'toe-w', axis: 'z', x0: 2.52, x1: 2.52 + KIT.toeIn, z0: -2.3, z1: -1.05 },
    { id: 'toe-e', axis: 'z', x0: 5.52 - KIT.toeIn, x1: 5.52, z0: -1.35, z1: 0.3 },
  ].map((t) => ({ id: t.id, mat: 'dark', x0: t.x0, y0: 0, z0: t.z0, x1: t.x1, y1: KIT.toeH, z1: t.z1 })),
  // the hood's duct up to the ceiling and the lip under its rim (dressing, not
  // the measured row 20 box, which is `hood` above)
  { id: 'duct', mat: 'steel', x0: 5.3, y0: KIT.hoodY1, z0: -1.15, x1: 5.52, y1: 2.5, z1: -0.95 },
  { id: 'hood-lip', mat: 'dark', x0: 5.0, y0: KIT.hoodY0, z0: -1.37, x1: 5.52, y1: KIT.hoodY0 + 0.03, z1: -0.73 },
  // the range: 4 burners on the top plate, 4 knobs on the front, an oven door
  { id: 'burner-a', mat: 'dark', x0: 5.02, y0: KIT.top, z0: -1.27, x1: 5.2, y1: KIT.top + 0.014, z1: -1.09 },
  { id: 'burner-b', mat: 'dark', x0: 5.24, y0: KIT.top, z0: -1.27, x1: 5.42, y1: KIT.top + 0.014, z1: -1.09 },
  { id: 'burner-c', mat: 'dark', x0: 5.02, y0: KIT.top, z0: -1.01, x1: 5.2, y1: KIT.top + 0.014, z1: -0.83 },
  { id: 'burner-d', mat: 'dark', x0: 5.24, y0: KIT.top, z0: -1.01, x1: 5.42, y1: KIT.top + 0.014, z1: -0.83 },
  ...[-1.27, -1.13, -0.97, -0.83].map((z, i) => ({ id: `knob-${i}`, mat: 'dark', x0: 4.9, y0: 0.62, z0: z - 0.018, x1: 4.94, y1: 0.656, z1: z + 0.018 })),  // the range's 4 knobs, on its front  { id: 'oven-door', mat: 'dark', x0: 4.91, y0: 0.16, z0: -1.31, x1: 4.94, y1: 0.6, z1: -0.79 },
  { id: 'oven-window', mat: 'glass', x0: 4.9, y0: 0.34, z0: -1.24, x1: 4.915, y1: 0.5, z1: -0.86 },
  // the fridge: a freezer drawer seam across the door and two bar handles
  // (its front faces +z, into the kitchen, so its hardware sits proud at z > −2.20)
  { id: 'fridge-seam', mat: 'seam', x0: 4.94, y0: 0.62, z0: -2.205, x1: 5.5, y1: 0.635, z1: -2.19 },
  { id: 'fridge-pull', mat: 'handle', x0: 5.0, y0: 1.02, z0: -2.2, x1: 5.03, y1: 1.36, z1: -2.16 },
  { id: 'fridge-pull-2', mat: 'handle', x0: 5.0, y0: 0.24, z0: -2.2, x1: 5.03, y1: 0.5, z1: -2.16 },
  // the dishwasher's pull across the top of its front
  { id: 'dish-pull', mat: 'handle', x0: 3.17, y0: 0.74, z0: -2.3, x1: 3.67, y1: 0.755, z1: -2.265 },
  // the sink's drainer, so the run is not one bowl in a slab, and the tip the
  // spout delivers water from
  { id: 'drainer', mat: 'steel', x0: 3.58, y0: KIT.top - 0.006, z0: -2.75, x1: 3.78, y1: KIT.top + 0.004, z1: -2.4 },
  { id: 'faucet-tip', mat: 'steel', x0: 4.362, y0: KIT.top + KIT.faucetH - 0.12, z0: -2.66, x1: 4.396, y1: KIT.top + KIT.faucetH - 0.03, z1: -2.64 },
];

/* -------------------------------------------------------------------------- *
 *  The doors, module by module. North run: a 0.60 corner unit, the dishwasher,
 *  a 0.70 sink base under the glass, a 0.50 end unit. West return: two 0.60s.
 *  East run: 1.05 of cabinets south of the range, two doors.
 *
 *  The fronts are 8 mm apart and 8 mm from the carcass ends — a real slab-door
 *  reveal. Wider than that and the pale carcass behind them reads as a light
 *  gap, which at the kitchen camera's grazing angle looked like missing doors.
 * -------------------------------------------------------------------------- */
// north run (the room is +z from its front line at z −2.34)
door('door-n-corner', 'x', 2.528, 3.112, -2.34, 1, 1);
door('door-n-sink', 'x', 3.728, 4.436, -2.34, 1, 1);
door('door-n-end', 'x', 4.444, 4.912, -2.34, 1, 1);
// west return (the room is +x from its front line at x 3.08: the front's face
// lands 2 cm behind the worktop's edge at 3.12 and 2 cm proud of the carcass)
door('door-w-a', 'z', -2.312, -1.719, 3.08, 1, 1);
door('door-w-b', 'z', -1.711, -1.058, 3.08, 1, -1);
// east run (the room is −x from its front line at x 4.96)
door('door-e-a', 'z', -0.742, -0.243, 4.96, -1, 1);
door('door-e-b', 'z', -0.235, 0.292, 4.96, -1, -1);
// the uppers, same rhythm 1.51 to 2.09 (row 15's bottom + 0.06)
door('door-up-n-a', 'x', 2.528, 2.94, -2.55, 1, -1, true);
door('door-up-n-b', 'x', 2.948, 3.352, -2.55, 1, 1, true);
door('door-up-w-a', 'z', -2.292, -1.719, 2.87, 1, 1, true);
door('door-up-w-b', 'z', -1.711, -1.058, 2.87, 1, -1, true);
door('door-up-e-a', 'z', -0.742, -0.243, 5.17, -1, 1, true);
door('door-up-e-b', 'z', -0.235, 0.292, 5.17, -1, -1, true);

/* -------------------------------------------------------------------------- *
 *  COLLIDERS: the footprints game/full-level.js splices into its own list, so
 *  the box that keeps a body out of the kitchen is the box that was drawn —
 *  there is no second copy of these numbers to drift. Upper cabinets and the
 *  hood are not here on purpose: they stand over a counter whose padded
 *  footprint already keeps a body 0.90 m off that wall, and a 2D pad for
 *  something 1.45 m up would carve walkway out of thin air.
 * -------------------------------------------------------------------------- */
export const KITCHEN_COLLIDERS = [
  { id: 'counter-n', x0: 2.52, z0: -2.9, x1: 4.92, z1: -2.3 },
  { id: 'counter-w', x0: 2.52, z0: -2.3, x1: 3.12, z1: -1.05 },
  { id: 'counter-e', x0: 4.92, z0: -1.35, x1: 5.52, z1: 0.3 },
  { id: 'fridge', x0: 4.92, z0: -2.9, x1: 5.52, z1: -2.2 },
];

/** Every footprint the kitchen draws, for the docs table and the scale check. */
export function kitchenColliderRects() {
  return KITCHEN_COLLIDERS.map((c) => ({ ...c }));
}
