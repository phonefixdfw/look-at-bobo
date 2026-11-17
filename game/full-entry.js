/*!
 * game/full-entry.js — the front door's room, and the hall behind it, as DATA
 * (issue #67).
 *
 * Why this file exists at all: issue #67's second complaint was that the hall
 * "ends in a dark nothing". Half of that was a missing band of plaster (fixed
 * in game/full-shell.js as `E-hall-3`); the other half was that the two rooms
 * a visitor actually stands in were the only rooms in the flat with nothing in
 * them. The shell had drawn a door; nothing else had ever been put here.
 *
 * Two colliders prove the room was always meant to have this furniture —
 * `coat-bench` (entry east wall) and `hall-console` (hall east wall) have been
 * in game/full-level.js's COLLIDERS since issue #33's first walk grid, with
 * push pads, and were never drawn. They are the footprints this file builds
 * to, so the body that already stopped there still stops there and no collider
 * or route number moves. The bench carries the ruler's `coat-bench` row
 * (docs/ISSUE_33_REBUILD.md §1: 0.75 … 0.85 long × 0.40 … 0.50 deep × 0.40 …
 * 0.50 high) and `furniture-real-scale` measures it back off the built boxes.
 *
 * Ruler rows used, in order:
 *   31  coat bench         — the bench, tagged 'coat-bench'
 *   22  rug / runner       — the entry mat and the hall runner, at row 22's
 *                           footprint but 15 mm of painted board rather than
 *                           pile, and with no collider: exactly like the bath
 *                           mat, a mat is not a wall and `colliders-padded`
 *                           already passes without them. Nothing is tagged for
 *                           `furniture-real-scale` here but the bench, for the
 *                           reason in game/full-entry-mesh.js: a tagged mesh is
 *                           a mesh the flat's folder may not fold, and folded
 *                           geometry is what keeps the budget.
 *   —   the console has no row it matches: at 0.56 long it is neither the
 *       ruler's 'table' (0.75 … 1.10) nor its 'side-table' (0.85 … 1.00), so
 *       it is drawn at its size and claims nothing.
 *
 * The wall faces these are pinned to (interior faces, from the bands in
 * game/full-shell.js), as of issue #81: entry x 1.32 / 2.72, z 2.22 / 3.90;
 * hall x −1.20 / 1.20, z 2.22 / 5.20. The sealed front door stands in the
 * entry's south band, the case 1.32 … 2.34, the flat's 0.86 m leaf centred in
 * it at x 1.40 … 2.26, so the mat lies dead in front of it.
 *
 * Like game/full-bath.js this file draws nothing and imports no Three.js.
 * game/full-entry-mesh.js puts it on screen: the bench on its own (the ruler
 * measures it), everything that shades like the flat's trim paint in one buffer
 * the flat's folder then folds into a bucket that already exists, and the lit
 * shades in one emissive buffer. Two new draws on the flat's worst capture
 * frame, which is how this stays inside tools/capture.mjs's 150-call budget.
 */

/** The two rooms, restated here the way game/full-bath.js restates its own:
 *  a builder should not have to reach into the shell to know where its walls
 *  are. Values are the ROOMS rows for 'entry' and 'hall'. */
export const ENTRY = { x0: 1.32, x1: 2.72, z0: 2.22, z1: 3.90 }; // issue #81: the 2.40 m hall took the old west band, the sealed entry east wall gave back the void
export const HALL = { x0: -1.20, x1: 1.20, z0: 2.22, z1: 5.20 }; // issue #81: 2.40 m wide, per the issue's own ruler

/** The sealed front door's leaf, from the shell's `door-front` opening: the
 *  case is x 1.32 … 2.34 (issue #81 slid it 0.07 east so its west jamb sits
 *  flush on the widened hall's east band) and the leaf is the flat's own
 *  `LEAF_W` (0.86) centred in it, standing in the entry's south band. The
 *  entry mat is laid to this, not to the room. `front-door-shut-and-found` in
 *  game/full.js re-measures the built leaf against the same constant. */
export const FRONT_DOOR = { x0: 1.40, x1: 2.26, z: 3.9, head: 2.04 };

/** Ceiling underside, the ruler's first row: a flush fixture hangs on it. */
export const CEIL_Y = 2.5;

/** A box in the flat's own convention (world x/z, y from the floor). */
const bx = (x0, y0, z0, x1, y1, z1) => ({ x0, x1, y0, y1, z0, z1 });

/** --------------------------------------------------------------------------
 *  The pieces, as one list of boxes with a material each.
 *
 *  `scale` tags a mesh for `furniture-real-scale`; a tagged piece must be the
 *  only thing in its mesh, so the measured world AABB is that piece alone.
 *  Everything else merges by material in game/full-entry-mesh.js.
 *  -------------------------------------------------------------------------- */

export const ENTRY_PIECES = [
  // ── the bench: the `coat-bench` collider (x 2.27 … 2.72, z 2.60 … 3.40)
  //    drawn at last. Back on the entry's east plaster, seat 0.45 (row 31),
  //    0.78 long so a coat and a bag both fit, 0.42 deep so the walk rect's
  //    east edge (x 2.64) still has the pad of the collider covering what
  //    crosses it. Its own mesh, because the ruler measures it. Issue #81
  //    walked the whole bench 0.32 east with the room's new east face. ──
  {
    id: 'coat-bench',
    mat: 'wood',
    scale: 'coat-bench',
    parts: [
      bx(2.28, 0.4, 2.56, 2.70, 0.45, 3.34), // seat, top 0.45
      bx(2.32, 0.0, 2.56, 2.68, 0.4, 2.62), // end panel, door end
      bx(2.32, 0.0, 3.28, 2.68, 0.4, 3.34), // end panel, room end
      bx(2.32, 0.12, 2.62, 2.68, 0.15, 3.28), // shoe shelf, 0.12 up
    ],
  },

  // ── the hooks: a strip and four pegs on the entry's north plaster at 1.65,
  //    with a hat shelf over them at 1.83. Nothing hangs here yet, so nothing
  //    claims a hanging-surface row — it is the place a coat HAS to go, which
  //    is what makes the room read as an entry rather than a corridor. Issue
  //    #81 slid them 0.30 east, staying centred on the room. ──
  {
    id: 'coat-hooks',
    mat: 'wood',
    parts: [
      bx(1.6, 1.6, 2.22, 2.5, 1.7, 2.26), // back strip, 10 cm off the floor…
      bx(1.64, 1.62, 2.26, 1.7, 1.68, 2.36), // peg 1
      bx(1.88, 1.62, 2.26, 1.94, 1.68, 2.36), // peg 2
      bx(2.12, 1.62, 2.26, 2.18, 1.68, 2.36), // peg 3
      bx(2.36, 1.62, 2.26, 2.42, 1.68, 2.36), // peg 4
      bx(1.6, 1.82, 2.22, 2.5, 1.85, 2.32), // hat shelf
    ],
  },

  // ── the console: the `hall-console` collider (x 0.88 … 1.20, z 4.00 … 4.60),
  //    on the band `E-hall-3` just sealed. It is the thing the corridor used to
  //    be missing: a surface at the end of the view, with a picture over it and
  //    a light on it. 0.26 deep, so the plaster keeps its 4 cm and the runner
  //    keeps its 5 cm of clearance in front of it. Issue #81 stepped it 0.30
  //    east onto the widened hall's new east face. ──
  {
    id: 'hall-console',
    mat: 'wood',
    parts: [
      bx(0.92, 0.75, 4.02, 1.18, 0.78, 4.58), // top, 0.78 off the floor
      bx(0.94, 0.0, 4.02, 1.16, 0.75, 4.08), // end support
      bx(0.94, 0.0, 4.52, 1.16, 0.75, 4.58), // end support
      bx(0.94, 0.2, 4.1, 1.16, 0.23, 4.5), // lower shelf for shoes
    ],
  },
];

/** The floor goods: 15 … 20 mm proud of the boards, no colliders, no ruler
 *  claims (a mat is not a wall, and `colliders-padded` already passes without
 *  them). Painted board paths, cream like the casings — see the material note
 *  in game/full-entry-mesh.js for why that is also the cheapest thing they can
 *  be. */
export const SOFT_GOODS = [
  // dead in front of the front door, centred on its leaf (issue #81 re-centred
  // it on the slid door, x 1.43 … 2.23 against the case's centre 1.83) — there
  // is no `entry-mat` collider and never was: a 2 cm pile is not a wall, and
  // the drawn mat crosses no pad
  { id: 'entry-mat', mat: 'rug', part: bx(1.43, 0.0, 3.36, 2.23, 0.02, 3.8) },
  // the hall runner, from the entry opening to the bedroom door's threshold
  // pad: 0.68 wide down the middle of a 2.40 corridor, so the oak boards still
  // read generously either side of it (wall-to-wall anything in a hallway is
  // the thing this is not). It crosses no pad: the two threshold pads are in
  // the wall bands, and the console starts at x 0.88.
  { id: 'hall-runner', mat: 'rug', part: bx(-0.34, 0.0, 2.36, 0.34, 0.015, 5.06) },
];

/** Flat pale things: the framed print over the console, the bowl and the post
 *  on it. Painted trim too, so they fold with the joinery for free. */
export const DECOR = [
  // the print, on the plaster `E-hall-3` just built: 0.48 × 0.56 at eye level,
  // centred on the console. This is what the corridor's end view is now.
  // Issue #81 slid it 0.30 east with the console.
  { id: 'hall-print-frame', mat: 'decor', part: bx(1.165, 1.28, 4.06, 1.2, 1.84, 4.54) },
  { id: 'hall-print', mat: 'decor', part: bx(1.155, 1.33, 4.11, 1.165, 1.79, 4.49) },
  // a bowl and a folded stack of post on the console top (0.78)
  { id: 'console-bowl', mat: 'decor', part: bx(0.98, 0.78, 4.24, 1.14, 0.83, 4.38) },
  { id: 'console-post', mat: 'decor', part: bx(0.98, 0.78, 4.08, 1.14, 0.805, 4.18) },
];

/** --------------------------------------------------------------------------
 *  The ceiling fixtures.
 *
 *  Each is emissive only: it lights nothing. That is the flat's existing
 *  convention — the porch lamp and the bathroom's frosted pane are both lit
 *  without being lights, because with a four-fill punctual budget a glowing
 *  body is what reads as a light, and a fifth real light would break
 *  tools/capture.mjs's `realLights ≤ 6`. The fills in game/full-apartment.js
 *  sit just below these, so the glow and the light come from the same place.
 *
 *  All four bodies are one merged emissive mesh. Its world box straddles three
 *  rooms, so game/full-cull.js refuses to hide it (no room owns it) — that
 *  costs one draw on every frame and buys a fixture in every room that has one.
 *  -------------------------------------------------------------------------- */
export const FIXTURES = [
  // entry: a PENDANT over the mat, hung low enough to be part of the frame
  // from the hall opening — the room is 1.4 m wide, a flush puck on a 2.5 m
  // ceiling is invisible from the door, and the thing that makes an entry read
  // as an entry is a lamp you meet eye-level. Bottom at 1.96, clear of every
  // head (the door's own head is 2.04, and this hangs a metre inside the room).
  { id: 'entry-ceiling', mat: 'glow', room: 'entry', at: [1.85, 3.5], radius: 0.14, drop: 0.44 },
  // hall: mid-corridor, between the bathroom opening and the bedroom door
  { id: 'hall-ceiling', mat: 'glow', room: 'hall', at: [0.0, 3.62], radius: 0.15 },
  // bathroom: dead centre of the room issue #81 narrowed (x −3.30 … −1.32,
  // z 2.22 … 5.20). The room had no fixture of its own at all.
  { id: 'bath-ceiling', mat: 'glow', room: 'bathroom', at: [-2.31, 3.71], radius: 0.17 },
  // the picture light over the hall print, 11 cm above its frame
  { id: 'hall-print-light', mat: 'glow', room: 'hall', bar: bx(1.14, 1.95, 4.14, 1.18, 1.99, 4.46) },
];
