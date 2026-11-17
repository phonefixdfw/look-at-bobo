// game/full-level.js — the FULL apartment as pure data (Step 8, rebuilt at
// real size for issue #33). Same shape as game/level.js plus the spot pool,
// and every number here is documented in docs/LEVEL_LAYOUT.md (the ruler is
// docs/ISSUE_33_REBUILD.md). The slice's five moments become the ten moments
// of docs/STORY.md's generic list — placeholders only, nothing about the real
// Bobo is written into this game (docs/STORY.md "Generic moments"). Brandon
// swaps the ids/labels/spots without touching the engine: the whole list
// lives in this one file. No Three.js: a table the game, the selfTest and the
// capture tools all read.
//
// Issue #33 changed two things about this file beyond the coordinates:
//   * the flat is a real one-bedroom (68.68 m² net since issue #67 grew the
//     bathroom, plus a 2.5 m² balcony) with a ceiling, so the room rectangles
//     moved and the kitchen became a room;
//   * the ten moment *types* each own several *spots* (`SPOTS` below). A run
//     draws ten of them, and never two in the same room twice in a row. The
//     type list itself is still exactly ten, so the capture matrix, the stage
//     count and every baseline are unchanged.
//
// The plaster itself is game/full-shell.js; this file is the space inside it:
// where a body may stand, what it cannot walk through, and where the cats are.

import { MOVE } from './level.js';
import { KITCHEN_COLLIDERS } from './full-kitchen.js';
import { KITCHEN_DETAILS_COLLIDERS } from './full-kitchen-details.js';
import { LIVING_COLLIDERS } from './full-living.js';
import { BATH_COLLIDERS, BALCONY_COLLIDERS, CURTAIN } from './full-bath.js';
import { BEDROOM_COLLIDERS } from './full-bedroom.js';

/** Angle convention shared by camera and cats: a yaw a faces (−sin a, −cos a),
 *  so yaw = atan2(−dx, −dz) means "look towards (dx, dz)", and 0 looks north
 *  (−z). Every yaw below is derived with that formula, never eyeballed. */

/** Where a camera may be, as rectangles 0.08 m off the plaster.
 *
 *  One rectangle per room, plus one bridging each opening. Furniture is NOT
 *  cut into these rectangles: the engine's body grid subtracts every COLLIDERS
 *  push pad from them, which is how a 0.30 m body is kept out of the sofa.
 *  These rectangles only ever have to keep the CAMERA off the plaster — the
 *  near plane is 0.05 m and walls are not colliders, so the 0.08 inset is the
 *  entire defence, and `wall-camera-clearance` re-proves it off the slabs as
 *  built and needs ≥ 0.07.
 *
 *  Each bridging rectangle is the CLEAR width of its opening (from
 *  game/full-shell.js OPENINGS) and spans the wall band plus the 0.08 of the
 *  two room rectangles, so a body walks through the middle of a real doorway.
 *  Index 0 has to be the living room: `walk-rects-connected` floods from it.
 *  The two door-less openings (bathroom, entry) are cased gaps with no leaf:
 *  a room a player can walk into and never leave is issue #31's bug, so
 *  nothing in this flat can ever be shut. The front door is the one gap that
 *  leads nowhere and it is built shut, not a hole. */
export const WALK_RECTS = [
  // ── index 0: the living room, the root everything else floods back to ──
  { id: 'living', room: 'living', x0: -3.22, z0: -2.82, x1: 2.32, z1: 2.02 },
  { id: 'kitchen', room: 'kitchen', x0: 2.6, z0: -2.82, x1: 5.44, z1: 0.52 },
  { id: 'hall', room: 'hall', x0: -0.82, z0: 2.3, x1: 0.82, z1: 5.12 },
  { id: 'entry', room: 'entry', x0: 1.1, z0: 2.3, x1: 2.32, z1: 3.82 },
  { id: 'bathroom', room: 'bathroom', x0: -3.22, z0: 2.3, x1: -1.1, z1: 5.12 }, // issue #67: 3.82 → 5.12, the same 8 cm inset off the bedroom's north band
  { id: 'bedroom', room: 'bedroom', x0: -2.52, z0: 5.4, x1: 1.12, z1: 9.24 },
  // The balcony's walkable strip stops short of the railing by the railing's
  // own push pad: no fall, no pressing the camera against the parapet, and the
  // camera can never leave the flat (issue #33, docs/CHARACTERS.md).
  { id: 'balcony', room: 'balcony', x0: 0.63, z0: -4.32, x1: 2.37, z1: -3.18 },
  // ── the openings: each bridges one wall band ─────────────────────────────
  { id: 'door-living-hall', room: 'living', x0: -0.45, z0: 1.92, x1: 0.45, z1: 2.4 },
  { id: 'door-living-kitchen', room: 'kitchen', x0: 2.22, z0: -0.6, x1: 2.7, z1: 0.3 },
  { id: 'door-hall-bedroom', room: 'hall', x0: -0.45, z0: 5.02, x1: 0.45, z1: 5.5 },
  { id: 'open-hall-bath', room: 'hall', x0: -1.2, z0: 2.6, x1: -0.72, z1: 3.45 },
  { id: 'open-hall-entry', room: 'hall', x0: 0.72, z0: 2.6, x1: 1.2, z1: 3.45 },
  { id: 'slider-balcony', room: 'living', x0: 0.85, z0: -3.28, x1: 2.15, z1: -2.72 },
];

/** Static push boxes: footprints only. The grid pads each by
 *  MOVE.playerRadius (so a body never stands inside a sofa), and the cats'
 *  sight lines use the same boxes clipped to waist height — which is why
 *  "that counter used to sit across the kitchen doorway" is the reason this
 *  comment exists. Every footprint is the number game/full-apartment.js draws
 *  and the ruler check measures; a cat's own support is exempt from its sight
 *  line, so a cat on the counter is not hidden by the counter. */
export const COLLIDERS = [
  // ── living room: the real-dimension furniture game/full-living.js draws
  //    (issue #46). LIVING_COLLIDERS is spliced in, so the push boxes ARE the
  //    drawn footprints — one copy of each number, from the ruler. The
  //    breakfast nook under the east window stays the placeholder it always
  //    was: the dining set is a later row of #33, not this one. ──
  ...LIVING_COLLIDERS,
  { id: 'dining-table', x0: 0.75, z0: 1.1, x1: 2.35, z1: 1.9 }, // the long bench side towards the east wall
  { id: 'chair-a', x0: 0.22, z0: 1.42, x1: 0.69, z1: 1.89 },
  { id: 'chair-b', x0: 1.35, z0: 0.62, x1: 1.82, z1: 1.09 },
  // ── kitchen: the run game/full-kitchen.js draws, footprints and all. The
  //    four boxes below ARE the drawn pieces (KITCHEN_COLLIDERS is spliced in,
  //    so there is no second copy of these numbers to drift): 0.60 m counters
  //    along the north wall and back down the west, the range in the break of
  //    the east run, the fridge in the north-east corner. The aisle in front of
  //    the run is 1.80 m (issue #33 asks for ~1 m); in front of the fridge it is
  //    the 0.85 m pocket between its door and the range, which the fridge-floor
  //    spot needs and a 0.30 m body fits. The bar, its stools and the bin are
  //    the pieces game/full-kitchen-details.js draws — the bar's footprint is
  //    the placeholder this list carried, value for value (issue #44), so no
  //    walk rect, spot or spawn moved when the bar became real. ──
  ...KITCHEN_COLLIDERS,
  ...KITCHEN_DETAILS_COLLIDERS,
  // ── hall + entry: a console table in the hall and a shallow coat bench in
  //    the vestible, so the space in front of the front door stays real ──
  { id: 'hall-console', x0: 0.58, z0: 4.0, x1: 0.9, z1: 4.6 },
  { id: 'coat-bench', x0: 1.95, z0: 2.6, x1: 2.4, z1: 3.4 },
  // ── bathroom (door-less, so neither pad may cross the cased opening — that
  //    is issue #27's trap wearing a new costume). Issue #49: the vanity, the
  //    toilet, the tub and the bin are drawn pieces now — BATH_COLLIDERS is
  //    spliced in, so the push boxes ARE the footprints in
  //    game/full-bath.js, and none of them touches the opening's jambs. ──
  ...BATH_COLLIDERS,
  // ── bedroom (issue #48): the queen's headboard is flush on the WEST wall,
  //    both nightstands flush either side of it, the desk keeps its north
  //    strip, dresser and wardrobe sit flush east either side of the 1.07 m
  //    door-to-window lane, the basket spills south-east of the bed. The
  //    rects are BEDROOM_COLLIDERS in game/full-bedroom.js, beside the
  //    furniture they belong to. ──
  ...BEDROOM_COLLIDERS,
  // ── balcony: the railing (its pad keeps a body a whole radius off the rail)
  //    and the chair and plant that make it a place instead of a ledge.
  //    Issue #49: the railing pad stays exactly as it was — the shell's, the
  //    safe one; the chair and plant are drawn pieces now and a bistro table
  //    joins them, all three spliced from game/full-bath.js. ──
  { id: 'balcony-railing', x0: 0.55, z0: -4.4, x1: 2.45, z1: -4.28 },
  ...BALCONY_COLLIDERS,
];

/** The height each collider's DRAWN piece actually reaches (y, from the
 *  finish floor), keyed by the same id as COLLIDERS. The engine's sight model
 *  clips every push box at y 1.05 so a person sees over a chair but not a
 *  fridge (LOS_TOP in game/engine.js) — right for walking AI, wrong for
 *  proving a cat is visible, where a 0.86 m vanity must hide what it really
 *  hides and a grown plant must hide what it NOW hides. The `findable` check
 *  in game/full.js re-runs the sight maths at these heights and fails by name
 *  if a collider has no row here, so this table cannot drift silently.
 *  Every number is the tallest drawn box of that piece (builders' `piece()`
 *  calls / the ruler); the big-plant row is the issue #70 grown fronds. */
export const SIGHT_HEIGHTS = {
  'sofa': 0.85, 'coffee-table': 0.45, 'side-table': 0.55, 'floor-lamp': 1.55,
  'tv-stand': 0.45, 'bookshelf': 1.9, 'big-plant': 1.15, 'cardboard-box': 0.45,
  'dining-table': 0.75, 'chair-a': 0.9, 'chair-b': 0.9,
  'counter-n': 0.9, 'counter-w': 0.9, 'counter-e': 0.9, 'fridge': 1.8,
  'kitchen-bar': 1.05, 'bar-stool-a': 0.62, 'bar-stool-b': 0.62, 'kitchen-bin': 0.5,
  'hall-console': 0.78, 'coat-bench': 0.62,
  'vanity': 0.86, 'toilet': 0.8, 'tub': 0.55, 'bath-bin': 0.45,
  'bed': 0.58, 'nightstand': 0.55, 'nightstand-south': 0.55, 'dresser': 0.78,
  'wardrobe': 2.1, 'desk': 0.75, 'desk-chair': 0.41, 'laundry-basket': 0.37,
  'bedroom-plant': 0.9,
  'balcony-railing': 1.05, 'balcony-chair': 0.8, 'balcony-table': 0.72, 'balcony-plant': 0.95,
};

/** --------------------------------------------------------------------------
 *  The props that partly cover a hiding cat — issue #70. A spot names its
 *  cover in `hide` (see the SPOTS note above); this table says what that
 *  cover is made of, as sight boxes in world space, derived from the SAME
 *  builder numbers that draw the prop. Two of these are not colliders at all:
 *  the shower curtain is cloth you can walk through, and the plant's canopy
 *  spreads past its push box. The `findable` check in game/full.js adds these
 *  boxes (at TRUE height, per SIGHT_HEIGHTS) to the sight model and demands a
 *  vantage that still sees the cat — so "partly hidden" can never rot into
 *  "unfindable". `hide` that names a prop missing here is a hard failure.
 *  -------------------------------------------------------------------------- */
const colliderById = Object.fromEntries(COLLIDERS.map((c) => [c.id, c]));

/** Sight box for a drawn prop: its collider footprint, optionally widened
 *  (leaf canopies spill), from y0 up to the piece's true drawn height. */
function sightBox(id, { pad = 0, y0 = 0, y1 = SIGHT_HEIGHTS[id] } = {}) {
  const c = colliderById[id];
  return { x0: c.x0 - pad, x1: c.x1 + pad, z0: c.z0 - pad, z1: c.z1 + pad, y0, y1 };
}

export const HIDE_PROPS = {
  // the gathered cloth (issue #70): folds are bunched into CURTAIN.x0..clothX1
  // by game/full-bath-mesh.js, and the sight test must respect exactly that —
  // the open rod gap east of clothX1 is what keeps the tub cat findable.
  'shower-curtain': {
    boxes: [{
      x0: CURTAIN.x0, x1: CURTAIN.clothX1,
      z0: CURTAIN.rodZ - CURTAIN.depth, z1: CURTAIN.rodZ + CURTAIN.depth,
      y0: CURTAIN.yBottom, y1: CURTAIN.yTop,
    }],
  },
  // the grown fronds spread about 0.10 m past the plant's push box in every
  // direction and stand 1.15 over the floor — the box the leaves actually fill
  'big-plant': { boxes: [sightBox('big-plant', { pad: 0.1 })] },
  // plain furniture covers: the pieces' own footprints at their true heights.
  'dresser': { boxes: [sightBox('dresser')] },
  'counter-w': { boxes: [sightBox('counter-w')] },
  'tub': { boxes: [sightBox('tub')] },
};

/** The ten moment TYPES — docs/STORY.md's generic list, invented-generic only:
 *  every one is Bobo doing a thing cats do. What makes a moment its own is the
 *  procedural rig write keyed by id in game/full.js, so a type can be staged on
 *  any of its spots. `label` is the human name the capture report and the story
 *  docs use; the engine never reads it. `canonical` is the spot the staged
 *  (capturable) tableau uses and `canonicalDecoy` the decoy that stands in for
 *  it: those two exist so ALL_STAGE_IDS keeps exactly the 13 stages × 9 views ×
 *  3 times matrix the baselines were taken with, and so every staged frame has
 *  both cats in it.
 *
 *  Each record is then HYDRATED from its canonical `SPOTS` entry at the bottom
 *  of this file (`spot` / `pose` / `faceYaw` / `room`), so the engine's view of
 *  a moment is always exactly what its canonical spot says — one number, two
 *  readers, no drift. */
export const MOMENTS = [
  { id: 'couch-loaf', label: 'loafing on the couch', canonical: 'couch-loaf.couch', canonicalDecoy: 'd-living' },
  { id: 'window-bird', label: 'watching the window', canonical: 'window-bird.n-window', canonicalDecoy: 'd-tv' },
  { id: 'box-sit', label: 'sitting in the box', canonical: 'box-sit.box', canonicalDecoy: 'd-dining' }, // d-living sat 0.66 m off the box — illegal pair
  { id: 'sink-sit', label: 'sitting in the sink', canonical: 'sink-sit.sink', canonicalDecoy: 'd-kitchen' },
  { id: 'desk-pen', label: 'on the desk by the pens', canonical: 'desk-pen.desk', canonicalDecoy: 'd-bedroom' },
  { id: 'keyboard-sit', label: 'on the keyboard', canonical: 'keyboard-sit.keyboard', canonicalDecoy: 'd-bedroom' },
  { id: 'laundry-nap', label: 'asleep in the laundry basket', canonical: 'laundry-nap.basket', canonicalDecoy: 'd-bedroom' },
  { id: 'bed-stretch', label: 'stretching on the bed', canonical: 'bed-stretch.bed', canonicalDecoy: 'd-bedroom' },
  { id: 'blanket-biscuits', label: 'making biscuits on the blanket', canonical: 'blanket-biscuits.blanket', canonicalDecoy: 'd-bedroom' },
  { id: 'hall-chase', label: 'the hall dash', canonical: 'hall-chase.hall', canonicalDecoy: 'd-living' },
];

/** The event phases that also stage a capturable frame. The cardboard box is
 *  the canonical event tableau (as in the slice) so the step-7 money frames
 *  still mean the same thing. */
export const EVENT_PHASES = ['catch', 'wrong', 'win'];
export const CANONICAL_EVENT_MOMENT = 'box-sit';

/** --------------------------------------------------------------------------
 *  The spot pool (issue #33: "a couple of times I didn't see him, or the places
 *  he was hiding wasn't enough").
 *
 *  Twenty-eight places across all seven rooms. A run draws ten of them — ONE
 *  spot per moment type (all ten types, exactly once), random order, no spot
 *  twice, never two in the same room twice in a row (`pickSpotCycle` below).
 *  Every record:
 *    id        '<type>.<place>' — the prefix IS the moment type, so the rig
 *              write, the voice line and the capture stage still key off it;
 *    type      the moment type (derived from the id);
 *    room      which room it is in (also which room gets culled in chunk 4);
 *    pose      an existing src/cat.js pose for the cat kind;
 *    spot      [x, supportName, z] — the surface he stands on, named not typed:
 *              a support the builder does not make is a hard selfTest failure,
 *              so a spot can never rot into a spot in mid-air;
 *    faceYaw   which way he looks, within 90° of the nearest place a player can
 *              stand and see him (`cats-face-the-room` re-derives every one);
 *    open      the spot is measured over or through its own support (in a box,
 *              on a counter), so the sight checks treat that support the way
 *              they already do: a cat on the counter is not hidden by it.
 *  `hide` — the prop that partly covers him (issue #70): named here, built in
 *  HIDE_PROPS above, and proven by the `findable` check in game/full.js — the
 *  sight maths re-run at the props' TRUE heights (SIGHT_HEIGHTS) with the
 *  hide box added must still find a place a player can stand and see him, so
 *  "partly" can never rot into "unfindable". Six spots hide today: the tub
 *  behind the gathered shower curtain, the north window behind the grown
 *  houseplant, the nook south of the dresser, the counter return, the bath
 *  mat behind the tub's flank, and the d-kitchen decoy behind the counter.
 *  None of them blocks the aim ray: `catUnderCrosshair` raycasts against the
 *  two cats only, so a shout lands through any of these props.
 *  -------------------------------------------------------------------------- */
function spot(type, place, room, pose, pos, faceYaw, extra) {
  return Object.assign({ id: `${type}.${place}`, type, room, pose, spot: pos, faceYaw }, extra || {});
}

export const SPOTS = [
  // ── living room (6) ──────────────────────────────────────────────────────
  spot('couch-loaf', 'couch', 'living', 'side', [-2.75, 'cushion', -0.1], -0.73, { open: true }),
  spot('couch-loaf', 'sofa-back', 'living', 'loaf', [-3.16, 'sofaBackTop', 0.35], -1.6, { open: true }),
  spot('window-bird', 'n-window', 'living', 'sit', [-1.35, 'floor', -2.5], 1.71, { hide: 'big-plant' }), // issue #70: bedded at the foot of its grown houseplant — 42% of the ring around him can see him at all, and `findable` proves he is never invisible
  spot('window-bird', 'e-window', 'living', 'sit', [1.72, 'floor', 0.55], 1.51),
  spot('window-bird', 'balcony-door', 'living', 'sit', [1.5, 'floor', -2.45], 3.04), // #53: was yaw −0.1 — the pool facing sweep caught him staring at the balcony (96° off the only approach); a cat sitting in the doorway looking back into the room is the same moment, readable
  spot('box-sit', 'box', 'living', 'sit', [-2.075, 'boxFloor', 1.575], -1.57, { open: true }),
  // ── balcony (2) — the owner's feature, and Bobo uses it (docs/CHARACTERS.md) ──
  spot('window-bird', 'balcony-rail', 'balcony', 'sit', [1.35, 'floor', -3.85], -2.9),
  spot('couch-loaf', 'balcony-chair', 'balcony', 'loaf', [2.15, 'chairSeat', -3.6], 1.77, { open: true }),
  // ── kitchen (5) — the room that read like a playset ──────────────────────
  spot('sink-sit', 'sink', 'kitchen', 'sit', [4.15, 'counterTop', -2.6], -2.92, { open: true }),
  spot('sink-sit', 'counter-return', 'kitchen', 'loaf', [2.82, 'counterTopW', -1.5], 3.02, { open: true, hide: 'counter-w' }), // issue #70: loafed on the return's own counter, body half behind the run's west flank — 26% of the ring sees him, `findable` holds the guarantee
  spot('sink-sit', 'fridge', 'kitchen', 'sit', [5.2, 'floor', -1.75], 1.4),
  spot('sink-sit', 'bar', 'kitchen', 'side', [4.1, 'barTop', 0.4], -0.14, { open: true }),
  spot('hall-chase', 'kitchen', 'kitchen', 'loaf', [4.3, 'floor', -1.3], 1.58),
  // ── hall + entry + bathroom (7) — the entry gained the dash spot that used
  //    to sit in the living room (issue #53: `spot-pool-covers-rooms` needs ≥ 2
  //    per room and the entry had one; the living room, with the most, gave it
  //    up. A zoomie at the front door is the same moment in a better place.) ──
  // issue #49: turns to the bathroom door as well as the dash north — the
  // bathroom's east band is a nearer vantage than the hall's middle now.
  spot('hall-chase', 'hall', 'hall', 'loaf', [-0.35, 'floor', 3.3], 0.585),
  spot('hall-chase', 'hall-door', 'hall', 'sit', [0.3, 'floor', 4.85], 1.55),
  spot('hall-chase', 'entry', 'entry', 'loaf', [1.45, 'floor', 3.4], 1.81),
  spot('hall-chase', 'entry-door', 'entry', 'loaf', [1.5, 'floor', 3.0], 1.57),
  spot('hall-chase', 'bath-mat', 'bathroom', 'side', [-2.2, 'floor', 4.12], 1.22, { hide: 'tub' }), // issue #67: rode the tub south onto the mat's new place at its face. It turned west-north-west, along the tub's face: with the room opened up, the nearest place a player can stand and see him is now the tile west of him, not the doorway band the old cramped room left (issue #59's -1.67). Issue #70: he lies with his back to the tub's flank — the 0.55 rim is his cover from half the room (29% of the ring sees him)
  spot('hall-chase', 'vanity', 'bathroom', 'sit', [-2.65, 'vanityTop', 2.46], 3.1416, { open: true }), // issue #67: the room opened up south of him, so his nearest vantage is now the open tile due south (issue #59 had him facing the old east band)
  // issue #70's centrepiece: the laundry basket's nap moved into the TUB for
  // once — on the well floor (support tubWell), behind the shower curtain
  // gathered across the north half of the rim. 5% of the reachable ring
  // around him can see him at all; the gap at the curtain's east end is where
  // he's found, and `findable` fails the build if that gap ever closes up.
  spot('laundry-nap', 'bath-tub', 'bathroom', 'side', [-2.55, 'tubWell', 4.85], -0.44, { hide: 'shower-curtain' }),
  // ── bedroom (10) — issue #48 turned the bed head-west. The five spots on
  //    the moved pieces came with it (mirrored across the room's middle and
  //    nudged 0.20 m south for the longer head clearance); the desk, desk-end,
  //    keyboard and laundry ones are where they were — those pieces stayed.
  //    The blanket spot is not a pure mirror: the folded blanket now runs
  //    across the foot, so it sits mid-blanket on the new foot-of-bed fold. ──
  spot('desk-pen', 'desk', 'bedroom', 'sit', [-1.85, 'deskTop', 5.7], 2.89, { open: true }),
  spot('desk-pen', 'desk-end', 'bedroom', 'loaf', [-2.3, 'deskTop', 5.85], 3.01, { open: true }),
  spot('keyboard-sit', 'keyboard', 'bedroom', 'sit', [-1.85, 'kbTop', 5.82], 3.13, { open: true }),
  spot('laundry-nap', 'basket', 'bedroom', 'side', [0.82, 'laundryTop', 9.0], 1.46, { open: true }),
  spot('bed-stretch', 'bed', 'bedroom', 'back', [-1.6, 'bedTop', 7.55], -0.08, { open: true }),
  spot('bed-stretch', 'bed-foot', 'bedroom', 'side', [-1.0, 'bedTop', 8.45], -1.43, { open: true }),
  spot('blanket-biscuits', 'blanket', 'bedroom', 'sit', [-0.755, 'blanketTop', 7.855], 0, { open: true }),
  spot('blanket-biscuits', 'wardrobe', 'bedroom', 'loaf', [0.15, 'floor', 8.2], -0.03),
  // issue #70: a corner nook south of the dresser, on the floor east of the
  // door-to-window lane — the dresser's flank and the plaster leave a shallow
  // shadow: 28% of the ring sees this loaf, the lane is his findable front
  // (0.9 m). Deliberately a blanket-biscuits spot: every spot of this type is
  // already a bedroom one, so a run can still never draw six bedroom rooms
  // (the `run-draw-legal` alternation — see the pickSpotCycle note).
  spot('blanket-biscuits', 'dresser-gap', 'bedroom', 'loaf', [0.95, 'floor', 6.85], 2.62, { hide: 'dresser' }),
  spot('laundry-nap', 'nightstand', 'bedroom', 'side', [-2.35, 'nightstandTop', 6.8], -0.28, { open: true }),
];

export const SPOT_IDS = SPOTS.map((s) => s.id);
export const MOMENT_IDS = MOMENTS.map((m) => m.id);
export const ALL_STAGE_IDS = [...MOMENT_IDS, ...EVENT_PHASES];
const SPOT_BY_ID = new Map(SPOTS.map((s) => [s.id, s]));

// Hydrate every moment type from its canonical spot (see the note on MOMENTS).
for (const m of MOMENTS) {
  const s = SPOT_BY_ID.get(m.canonical);
  if (!s) throw new Error(`full-level: moment "${m.id}" names canonical spot "${m.canonical}", which SPOTS does not have`);
  m.spot = s.spot;
  m.pose = s.pose;
  m.faceYaw = s.faceYaw;
  m.room = s.room;
}

/** The rooms each moment type can be staged in, derived from the pool. The
 *  engine does not read this (it uses the hydrated `m.room` of the spot it
 *  actually drew); docs/LEVEL_LAYOUT.md and `spot-pool-covers-rooms` do, and it
 *  is the table Brandon reads when he adds a spot. */
export const MOMENT_ROOMS = Object.fromEntries(
  MOMENT_IDS.map((id) => [id, [...new Set(SPOTS.filter((s) => s.type === id).map((s) => s.room))]]),
);

/** Bobo's ten spots for ONE run (issue #53): every moment type plays exactly
 *  once, at a spot drawn uniformly from that type's spots, in an order with no
 *  two neighbours in the same room (issue #33: every catch should feel like
 *  going somewhere else). Deterministic for a given rand — the same seed
 *  replays the same run, which is what `capture --determinism` proves; the
 *  engine seeds it exactly like the old moment shuffle (`SEED + cycle × 101`).
 *
 *  Two draws off one rand stream. First the spot per type: uniform within the
 *  type, so a type with four spots plays at each of them about a quarter of
 *  runs. Then the order: the classic "reorganise the string" greedy — at each
 *  step take the room with the most spots left that is not the room just
 *  played, ties broken by rand — but a pick is only legal if the rest is
 *  still orderable afterwards (the safety filter below), which keeps the
 *  greedy provably deadlock-free while leaving plenty of freedom: since no
 *  room can hold more than half the ten (the bedroom locks exactly five of
 *  the ten TYPES, and one spot each), almost every pick is safe and the runs
 *  do not all start in the same room. A pool data change that breaks that
 *  bound degrades (appends the rest) instead of hanging, and the
 *  `run-draw-legal` check fails loudly on 200 seeded runs. */
function orderable(counts, prev) {
  // Can the remaining spots be laid out with no two neighbours sharing a
  // room, starting somewhere other than `prev`? Let M be the biggest pile:
  // if its room may be played next it needs M ≤ others + 1; if it is the
  // forbidden room it needs M ≤ others. That condition is also sufficient.
  let total = 0;
  let max = 0;
  let maxRoom = null;
  let tie = false;
  for (const [room, n] of counts) {
    if (!n) continue;
    total += n;
    if (n > max) { max = n; maxRoom = room; tie = false; }
    else if (n === max) tie = true;
  }
  if (total <= 1) return true;
  const others = total - max;
  return maxRoom === prev && !tie ? max <= others : max <= others + 1;
}

export function pickSpotCycle(rand) {
  const chosen = MOMENT_IDS.map((t) => {
    const list = SPOTS.filter((s) => s.type === t);
    return list[Math.min(list.length - 1, Math.floor(rand() * list.length))];
  });
  const groups = new Map();
  for (const s of chosen) {
    if (!groups.has(s.room)) groups.set(s.room, []);
    groups.get(s.room).push(s.id);
  }
  const order = [];
  let prev = null;
  while (order.length < chosen.length) {
    const counts = new Map([...groups].map(([room, list]) => [room, list.length]).filter(([, n]) => n));
    // Candidates: a room not just played whose spots, if one is played NEXT,
    // leave the rest orderable. Weight the safe picks by how much of the room
    // is left (1.5 powers) so the spread still leans towards big rooms.
    const cands = [];
    for (const room of counts.keys()) {
      if (room === prev) continue;
      const after = new Map(counts);
      after.set(room, after.get(room) - 1);
      if (orderable(after, room)) cands.push([room, groups.get(room)]);
    }
    const pool = cands.length
      ? cands
      : [...counts.keys()].filter((room) => room !== prev).map((room) => [room, groups.get(room)]); // degraded pool: no safe pick exists
    if (!pool.length) {
      // Only the room the last spot was in is left — the pool cannot keep the
      // promise. Append the rest rather than hang (run-draw-legal reports it).
      for (const [, list] of groups) order.push(...list.splice(0));
      break;
    }
    let total = 0;
    for (const [, list] of pool) total += Math.pow(list.length, 1.5);
    let pick = rand() * total;
    let chosen2 = pool[pool.length - 1];
    for (const cand of pool) {
      pick -= Math.pow(cand[1].length, 1.5);
      if (pick <= 0) { chosen2 = cand; break; }
    }
    const [room, list] = chosen2;
    order.push(list.shift());
    prev = room;
  }
  return order;
}

/** The room a spot is in (the engine's respawn rule asks by room). */
export function spotRoom(id) {
  return SPOT_BY_ID.get(id)?.room ?? 'living';
}

/** The decoy: 22 lb of scenery, mostly black, white on his feet only, no dash
 *  (docs/DECOY_CAT.md). Issue #33 grew the lazy-spot pool to ten — one or two
 *  per room, so "is that…?" can happen anywhere, balcony included. Still never
 *  Bobo's spot and never closer than DECOY_MIN_DIST, which the engine enforces
 *  per round by filtering this list, not by hoping. */
export const DECOY_SPOTS = [
  { id: 'd-living', room: 'living', pos: [-1.45, 'floor', 1.8], faceYaw: 0.06 },
  { id: 'd-tv', room: 'living', pos: [0.9, 'floor', -2.0], faceYaw: 0.21 },
  { id: 'd-dining', room: 'living', pos: [0.0, 'floor', 1.6], faceYaw: 1.67, pose: 'side' },
  { id: 'd-kitchen', room: 'kitchen', pos: [3.5, 'floor', -1.5], faceYaw: -3.14, hide: 'counter-w' }, // 1.28 m off the sink spot (was 1.185 — illegal pair). Issue #70: dozed on the floor east of the west counter's flank — 24% of the ring sees him; `findable` holds the promise for decoys too
  { id: 'd-bar', room: 'kitchen', pos: [4.05, 'floor', -0.62], faceYaw: 1.36, pose: 'side' },
  { id: 'd-hall', room: 'hall', pos: [0.35, 'floor', 3.0], faceYaw: 1.23 },
  { id: 'd-entry', room: 'entry', pos: [2.0, 'floor', 2.5], faceYaw: 1.9 },
  { id: 'd-bath', room: 'bathroom', pos: [-1.35, 'floor', 3.2], faceYaw: 1.57, pose: 'side' }, // issue #67: moved into the new open floor (the old point came within 1.2 m of the moved mat spot) and turned to the room
  { id: 'd-bedroom', room: 'bedroom', pos: [-0.55, 'floor', 6.45], faceYaw: 0.0 }, // on the rug mid-floor, facing north down the room to the door walk — the nearest stand-and-watch cell; measured: the mirrored yaw was 95° off, this faces the approach head-on
  { id: 'd-balcony', room: 'balcony', pos: [1.4, 'floor', -3.35], faceYaw: 2.82, pose: 'side' },
];
/** Q2/Q6: never the same spot, never closer than this (selfTest enforces). */
export const DECOY_MIN_DIST = 1.2;

/** The decoy pick for one round (the slice's rule, this file's spots). Issue
 *  #53 adds the soft preference the pool makes possible: when legal spots
 *  exist in a room OTHER than Bobo's, the decoy draws from those — "is
 *  that…?" should happen in a different room than the real find, so a wrong
 *  shout is a mistake about distance, not about which chair you just left.
 *  `boboRoom` is optional (the slice calls this with two arguments). */
export function pickDecoySpot(boboSpot, rng, boboRoom = null) {
  const valid = DECOY_SPOTS.filter((s) => Math.hypot(s.pos[0] - boboSpot[0], s.pos[2] - boboSpot[2]) >= DECOY_MIN_DIST);
  if (!valid.length) return null;
  const away = boboRoom ? valid.filter((s) => s.room !== boboRoom) : valid;
  const pool = away.length ? away : valid;
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}

/** Ten respawns across six rooms — every room but the balcony, because a run
 *  start has to be inside the flat and the balcony is a destination, not a
 *  doorway. Each is ≥ MOVE.playerRadius clear of every collider and
 *  ≥ SPAWN_AVOID_DIST from its neighbours, which the engine re-checks after
 *  every catch. SPAWNS[0] is where a run starts: in the living room, looking
 *  north towards the window and the balcony door. */
export const SPAWNS = [
  { room: 'living', pos: [1.53, -1.47], yaw: 0.3 },
  { room: 'living', pos: [-0.6, 1.3], yaw: 2.6 },
  { room: 'kitchen', pos: [4.23, -1.57], yaw: 0.2 },
  { room: 'kitchen', pos: [2.93, -0.27], yaw: 1.2 },
  { room: 'hall', pos: [-0.37, 4.43], yaw: 0.1 },
  { room: 'hall', pos: [0.33, 3.03], yaw: 3.0 },
  { room: 'entry', pos: [1.53, 3.73], yaw: 1.5 },
  { room: 'bathroom', pos: [-1.27, 2.83], yaw: -2.2 }, // the east band (issue #49: the tub took the old corner)
  { room: 'bedroom', pos: [-1.37, 6.63], yaw: 1.6 },
  { room: 'bedroom', pos: [-1.5, 9.1], yaw: -1.2 }, // issue #48: the bed's head is west now and reaches z 8.66 here; the south band is the walk to it (z 9.1 keeps the body clear of the bed pad at 8.96)
];

export const SPAWN_AVOID_DIST = 1.2;

/** The next spawn after a catch — the slice's rule, this file's SPAWNS. */
export function pickSpawn(boboRoom, prevRoom, fromIdx, avoid = [], minDist = SPAWN_AVOID_DIST) {
  const clear = (s) => avoid.every((a) => Math.hypot(s.pos[0] - a.x, s.pos[1] - a.z) >= minDist);
  const n = SPAWNS.length;
  for (let k = 1; k <= n; k++) {
    const idx = (fromIdx + k) % n;
    const s = SPAWNS[idx];
    if (s.room !== boboRoom && s.room !== prevRoom && clear(s)) return { spawn: s, idx };
  }
  for (let k = 1; k <= n; k++) {
    const idx = (fromIdx + k) % n;
    const s = SPAWNS[idx];
    if (s.room !== boboRoom && s.room !== prevRoom) return { spawn: s, idx };
  }
  for (let k = 1; k <= n; k++) {
    const idx = (fromIdx + k) % n;
    if (SPAWNS[idx].room !== boboRoom) return { spawn: SPAWNS[idx], idx };
  }
  return { spawn: SPAWNS[0], idx: 0 };
}

/** --------------------------------------------------------------------------
 *  The one route the point walk (`walk-rects-connected`, rect corner to rect
 *  corner) claims and the body grid refuses, and the room it guards: the
 *  balcony's only way in is a slider with a chair and a plant inside the
 *  opening, so a 0.30 m body threads a narrower way than a point would.
 *  `walk-reachable` still has to find the balcony reachable, because two cats
 *  live there, so this is an exception table and not a permission slip: the
 *  chair and the plant are placed so the strip west of the chair is a body's
 *  width and a half wide.
 *  ------------------------------------------------------------------------- */
export const WALK_BLOCK_ROOM = 'balcony';

/** The one route the point walk is allowed to claim and the scripted dash
 *  proves it must not: walking north from the middle of the living room has to
 *  stop AT the north wall, not sail through it (?plant=no-collision). `pos` +
 *  `yaw` is where the dash starts and which way it points; `lo`/`hi` is the
 *  band the body has to end up inside, which is the living room rectangle's
 *  north edge (z −2.82) with the step overshoot either side. The slice's engine
 *  defaults are its own [−2.53, −2.40] literals; this flat's north wall is a
 *  different number, so the level states it. */
export const WALK_BLOCK = { pos: [0.4, 0], yaw: 0, lo: -2.95, hi: -2.8 };

/** A few capture views (docs/LEVEL_LAYOUT.md): pos + yaw/pitch + fov, `hand`
 *  says the view is first-person enough to show the player's own hand. Three
 *  frame the canonical tableau (Bobo in the box at [−0.45, 0.92], d-living
 *  behind him) from a high 3/4, a standing eye-line and a low close look; the
 *  rest give one frame per room, so the new rooms get captured too (issue #33).
 *  Every yaw is atan2(−dx, −dz) and every pitch atan2(Δy, horiz) to the middle
 *  of its subject, and `views-distinct` proves no two sit within 0.5 m apart. */
export const VIEWS = {
  diorama: { pos: [1.95, 2.15, 1.75], yaw: 1.238, pitch: -0.629, fov: 55, hand: false }, // the tableau, from the south-east
  'first-person': { pos: [0.55, 1.62, 1.95], yaw: 0.767, pitch: -0.741, fov: 55, hand: true }, // standing over the box
  bobo: { pos: [0.45, 0.55, 1.95], yaw: 0.717, pitch: -0.217, fov: 30, hand: false }, // cat's-eye at the box
  overview: { pos: [2.1, 2.35, -2.55], yaw: 2.461, pitch: -0.477, fov: 55, hand: false }, // the room from the north-east
  'over-shoulder': { pos: [-1.05, 1.95, 1.55], yaw: 0.709, pitch: -0.519, fov: 55, hand: false }, // over the coffee table
  'low-angle': { pos: [-1.95, 0.42, 1.75], yaw: 0.381, pitch: 0.055, fov: 55, hand: false }, // floor level, in the window light
  kitchen: { pos: [3.95, 1.55, 0.25], yaw: 0.0, pitch: -0.377, fov: 55, hand: false }, // the sink run and the window over it
  bathroom: { pos: [-1.22, 1.62, 3.02], yaw: 2.2, pitch: -0.3, fov: 68, hand: false }, // issue #67: from the doorway field, looking south-west over the new open tile at the mat, the tub's face and the curtain above it (was the vanity from the cased opening)
  // issue #67: the vestibule, from the hall — the frame Brandon's playtest
  // caught as "a weird hall to nowhere", so it is the frame that proves it is
  // now a lit ENTRY with a front door at the end of it.
  // issue #67: the front door, from the hall opening — leaf, mat, the console
  // beside it and the wall it sits in, all in one frame (yaw 3.379 faces
  // south-south-east down the vestibule; pitch -0.17 drops the floor in).
  entry: { pos: [1.45, 1.62, 2.6], yaw: 3.379, pitch: -0.17, fov: 76, hand: false },
  desk: { pos: [-1.85, 1.45, 7.05], yaw: 0.0, pitch: -0.437, fov: 45, hand: false }, // the desk on the north wall
  balcony: { pos: [0.95, 1.42, -3.75], yaw: -1.5, pitch: -0.35, fov: 55, hand: false }, // outside, looking at the chair
  // The three doorways, from standing height, aimed through the hole at a
  // point in the room beyond (issue #65). `doorways-read-open` in game/full.js
  // keys off these ids — one per `kind:'door'` opening — and reads the pixel
  // at the hole's centre from each. The pitch lands the sightline through the
  // opening at y ~1.0 and on floor just past the wall, clear of trim, jambs
  // and furniture (the geometry is worked in the comments of the check).
  'door-living-hall': { pos: [-0.3, 1.62, 0.55], yaw: -3.0061, pitch: -0.6303, fov: 55, hand: false }, // standing in the living room, at the hall doorway
  'door-living-kitchen': { pos: [1.5, 1.62, -0.6], yaw: -1.8717, pitch: -0.8178, fov: 55, hand: false }, // standing by the TV stand, at the kitchen doorway
  'door-hall-bedroom': { pos: [0.28, 1.62, 3.8], yaw: -3.1416, pitch: -0.624, fov: 55, hand: false }, // standing in the hall, at the bedroom doorway
};

/** Issue #33's ruler as data (the table is docs/ISSUE_33_REBUILD.md §1). Every
 *  piece the shell and the furniture builders make may carry a ruler row name
 *  in `userData.scale`, and `furniture-real-scale` measures the built AABB
 *  against that row. The five keys are what the checker measures off the built
 *  box, always:
 *    w      the long horizontal extent; d the short one; h the vertical extent
 *    top    the highest y it reaches; bottom the lowest
 *    t      min(w, d): a slab's thickness, whichever way it faces
 *  A piece with no row is not a failure (the game may build what it likes); a
 *  piece with a row that it misses IS, which is what stops a 0.45 m "sofa" or a
 *  3 m ceiling shipping again. */
export const SCALE_RANGES = {
  // the shell
  ceiling: { bottom: [2.45, 2.55], note: 'ceiling height 2.5 m' },
  'wall-ext': { t: [0.18, 0.22], note: 'exterior wall 0.20 m' },
  'wall-int': { t: [0.1, 0.14], note: 'interior wall 0.12 m' },
  parapet: { t: [0.1, 0.14], h: [1.0, 1.2], note: 'balcony parapet 0.12 × 1.10' },
  'door-leaf': { w: [0.8, 0.92], h: [1.98, 2.1], note: 'door leaf 0.86 × 2.04' },
  'door-head': { bottom: [2.0, 2.1], note: 'head height 2.05 m' },
  'door-casing': { w: [0.05, 0.09], note: 'door frame/trim 6–8 cm' },
  'window-frame': { w: [0.6, 1.9], h: [0.5, 1.3], bottom: [0.85, 1.55], note: 'window: sill ~0.9 (bath 1.5)' },
  'window-sill': { top: [0.85, 1.55], note: 'the board under a window' },
  baseboard: { w: [0.015, 0.03], h: [0.09, 0.15], note: 'baseboard 2 × 12 cm' },
  railing: { h: [0.9, 1.15], note: 'balcony railing ~1.0 above the parapet? 1.10 total' },
  // furniture (issue #33's "real furniture, not a playset" list). The living
  // rows were retuned in issue #46 to what each ruler row ALLOWS — the same
  // move #41 made for the kitchen — and are now actually measured: the
  // furniture has been drawn since then (game/full-living.js).
  sofa: { w: [1.8, 2.4], d: [0.82, 1.05], h: [0.75, 0.95], note: 'row 34: 2.10 × 0.92 × 0.85' },
  'seat-height': { top: [0.38, 0.5], note: 'row 35: seat 0.45, the `cushion` support' },
  'sofa-back': { top: [0.8, 0.9], note: 'row 34 again: backrest top 0.85, the `sofaBackTop` support' },
  'coffee-table': { w: [1.0, 1.3], d: [0.5, 0.7], h: [0.38, 0.52], note: 'row 36: 1.10 × 0.60 × 0.45' },
  'side-table': { w: [0.38, 0.52], h: [0.48, 0.62], note: 'row 37: 0.45 dia × 0.55 high' },
  'dining-table': { w: [1.5, 1.7], d: [0.8, 0.9], h: [0.72, 0.78], note: 'breakfast table 1.60 × 0.80 × 0.75' },
  'dining-chair': { w: [0.4, 0.5], d: [0.4, 0.55], h: [0.85, 1.0], note: 'chair 0.48 × 0.47 × 0.90' },
  'tv-stand': { w: [1.45, 1.72], d: [0.32, 0.46], h: [0.38, 0.55], note: 'row 40: 1.60 × 0.40 × 0.45' },
  'tv-screen': { w: [1.0, 1.35], h: [0.62, 0.8], bottom: [0.79, 0.9], note: 'row 39: 1.22 × 0.71, centre y 1.20' },
  bookshelf: { w: [0.8, 1.0], d: [0.28, 0.4], h: [1.7, 2.1], note: 'row 41: 0.90 × 0.32 × 1.90 high' },
  'floor-lamp': { h: [1.35, 1.75], note: 'row 38: 1.55 tall, shade 0.34 dia' },
  'cardboard-box': { w: [0.4, 0.7], h: [0.3, 0.55], bottom: [0, 0.06], note: 'row 60: 0.60 × 0.44 × 0.42, floor y 0.02' },
  // the kitchen (ruler rows 11-22), retuned in issue #41 to what each row
  // ALLOWS rather than what one placeholder box happened to be. `w` is the long
  // horizontal extent and `d` the short one (see the note above), so a run reads
  // the same whichever way its wall runs: the fridge's 0.70 is its front, the
  // counters' 0.58-0.60 is their depth, and the north-east corner's window
  // jamb, not the ruler, is what keeps that front at 0.60 wide.
  'counter-height': { top: [0.85, 0.95], note: 'row 11: worktop at 0.90' },
  'counter-depth': { d: [0.55, 0.68], note: 'row 12: counters 0.60 deep' },
  'worktop-thickness': { h: [0.025, 0.06], note: 'row 13: the slab is 0.04' },
  backsplash: { top: [1.2, 1.5], note: 'row 14: tile stops at 1.35, 0.45 above the worktop' },
  'upper-cabinet': { t: [0.28, 0.4], h: [0.55, 0.85], note: 'row 15: uppers 0.35 deep × 0.70 tall' },
  'upper-mounted': { bottom: [1.35, 1.55], note: 'row 15: upper bottoms 1.45 off the floor' },
  'cab-door': { h: [0.5, 0.7], note: 'row 16: a hinged front, 0.58 tall' },
  sink: { w: [0.4, 0.62], d: [0.32, 0.5], top: [0.85, 0.95], note: 'row 17: bowl 0.50 × 0.42, rim at the worktop' },
  faucet: { h: [0.2, 0.4], note: 'row 18: 0.28 over the worktop, 0.22 reach' },
  range: { w: [0.55, 0.68], d: [0.55, 0.68], top: [0.85, 0.95], note: 'row 19: 0.60 × 0.60, top flush with the worktop' },
  hood: { w: [0.5, 0.75], d: [0.5, 0.75], note: 'row 20: 0.60 wide × 0.50 deep over the range' },
  fridge: { w: [0.6, 0.85], h: [1.65, 1.95], note: 'row 21: 1.80 tall, 0.70 across' },
  dishwasher: { w: [0.55, 0.65], d: [0.55, 0.66], top: [0.85, 0.92], note: 'row 22: 0.60 front under the counter' },
  // the small pieces on and beside it (ruler rows 23-28 and 33, issue #44);
  // rows 31-32 keep the `bar-height` / `bar-stool` rows already in this table
  'microwave': { w: [0.45, 0.6], h: [0.24, 0.36], note: 'row 23: 0.52 × 0.38 × 0.30 on the worktop' },
  kettle: { h: [0.14, 0.22], note: 'row 24: body 0.20 high (the knob is dressing); 0.17 across' },
  toaster: { h: [0.15, 0.24], note: 'row 25: 0.26 × 0.18 × 0.19' },
  'coffee-maker': { h: [0.28, 0.45], note: 'row 26: 0.36 tall against the east tile' },
  'dish-rack': { h: [0.1, 0.22], note: 'row 27: 0.40 × 0.30 × 0.15 over the drainer' },
  'trash-bin': { h: [0.28, 0.5], note: 'row 28: 0.30 dia × 0.42 beside the counter' },
  'rug-runner': { d: [0.6, 0.85], note: 'row 33: the runner is 0.70 wide (w is its 2.00 length)' },
  'bar-height': { top: [1.0, 1.1], note: 'breakfast bar top 1.05' },
  'bar-stool': { w: [0.3, 0.4], d: [0.3, 0.4], h: [0.6, 0.7], note: 'stool 0.36 × 0.36 × 0.65' },
  'bed-queen': { w: [1.95, 2.1], d: [1.45, 1.65], note: 'queen 2.03 long × 1.53 wide' },
  'mattress-height': { top: [0.45, 0.55], note: 'mattress top 0.50' },
  headboard: { w: [1.5, 1.65], top: [1.0, 1.25], note: 'rows 43+51: 1.58 wide, top 1.20' },
  nightstand: { w: [0.45, 0.55], d: [0.42, 0.55], h: [0.5, 0.6], note: 'rows 48+51: 0.50 × 0.45 × 0.55' },
  dresser: { w: [1.2, 1.4], d: [0.45, 0.55], h: [0.75, 0.85], note: 'dresser 1.30 × 0.50 × 0.80' },
  desk: { w: [1.3, 1.5], d: [0.65, 0.75], h: [0.72, 0.78], note: 'desk 1.40 × 0.70 × 0.75' },
  wardrobe: { w: [1.1, 1.3], d: [0.55, 0.65], h: [1.95, 2.15], note: 'wardrobe 1.20 × 0.60 × 2.05' },
    'laundry-basket': { w: [0.36, 0.46], d: [0.26, 0.46], h: [0.32, 0.42], note: 'row 50: 0.40 × 0.30, rim ~0.37 — the pile row carries the 0.55 assembly top' },
  'bed-frame': { top: [0.25, 0.35], note: 'row 42: the frame under the mattress, 0.30' },
  'folded-blanket': { w: [1.3, 1.6], d: [0.24, 0.4], h: [0.03, 0.15], top: [0.52, 0.68], note: 'row 44: folded across the foot, top 0.58' },
  keyboard: { w: [0.4, 0.48], d: [0.1, 0.18], h: [0.02, 0.05], top: [0.76, 0.82], note: 'row 46: 0.44 × 0.13 × 0.03 on the desk, top 0.79' },
  monitor: { w: [0.45, 0.62], d: [0.1, 0.28], h: [0.4, 0.62], top: [1.1, 1.4], note: 'row 47: foot+post+panel union, screen to 1.27' },
  'desk-chair': { w: [0.4, 0.55], d: [0.38, 0.6], note: 'the desk chair: frame and seat together' },
  'desk-chair-back': { top: [0.85, 0.95], note: 'back of the desk chair, 0.90' },
  'laundry-pile': { w: [0.22, 0.5], d: [0.18, 0.45], top: [0.5, 0.6], note: 'row 51: heaped ~0.18 over the rim, top 0.55' },
  'plant-pot': { w: [0.28, 0.42], h: [0.2, 0.4], note: 'the bedroom pot: 0.32 across, 0.32 tall' },
  'plant-leaf': { h: [0.55, 1.0], top: [0.95, 1.25], note: 'leaves of the bedroom plant, to 1.00' },
  vanity: { w: [0.85, 0.95], d: [0.45, 0.55], h: [0.8, 0.9], note: 'vanity 0.90 × 0.50 × 0.85' },
  toilet: { w: [0.62, 0.72], d: [0.35, 0.42], top: [0.72, 0.85], note: 'row 52: 0.68 deep × 0.37 across, tank top 0.78 — the ruler\'s toilet includes its tank, so the row measures its top, not h' },
  // rows 54-57 (issue #49): the tub, the mirror, the bar and the mat, drawn
  // by game/full-bath-mesh.js and measured back off the built boxes
  tub: { w: [1.5, 1.8], d: [0.7, 0.8], h: [0.5, 0.62], note: 'row 56: 1.60 × 0.75, rim 0.55' },
  'bath-mirror': { w: [0.6, 0.8], h: [0.8, 1.0], note: 'row 54: 0.70 × 0.90, bottom 1.10' },
  'towel-bar': { w: [0.5, 0.7], top: [1.12, 1.2], note: 'row 55: 0.60 long, bar top 1.165 — the draped towel hangs below the measured top by design' },
  'bath-mat': { w: [0.8, 1.0], d: [0.45, 0.7], h: [0.005, 0.05], note: 'row 57: 0.90 × 0.55 pile (the brief\'s own mat, mid-range)' },
  'coat-bench': { w: [0.75, 0.85], d: [0.4, 0.5], h: [0.4, 0.5], note: 'hall bench 0.80 × 0.45 × 0.45' },
  'console-table': { w: [0.55, 0.65], d: [0.3, 0.36], h: [0.72, 0.8], note: 'hall console 0.60 × 0.32 × 0.76' },
};

/** Where a "you are here" overlay would put its labels if the game ever grows
 *  one; unused by the engine, kept because docs/LOCATIONS.md references it. */
export const ROOM_LABELS = {
  living: 'living room',
  kitchen: 'kitchen',
  hall: 'hallway',
  entry: 'entry',
  bathroom: 'bathroom',
  bedroom: 'bedroom',
  balcony: 'balcony',
};

/** Feel numbers — identical to the slice (game/level.js MOVE). */
export { MOVE };

/** The full game ships the real target (docs/STORY.md): ten finds. */
export const TARGET_DEFAULT = 10;
