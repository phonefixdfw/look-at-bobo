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
//   * the flat is a real one-bedroom (65.7 m² net, plus a 2.5 m² balcony) with
//     a ceiling, so the room rectangles moved and the kitchen became a room;
//   * the ten moment *types* each own several *spots* (`SPOTS` below). A run
//     draws ten of them, and never two in the same room twice in a row. The
//     type list itself is still exactly ten, so the capture matrix, the stage
//     count and every baseline are unchanged.
//
// The plaster itself is game/full-shell.js; this file is the space inside it:
// where a body may stand, what it cannot walk through, and where the cats are.

import { MOVE } from './level.js';

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
  { id: 'bathroom', room: 'bathroom', x0: -3.22, z0: 2.3, x1: -1.1, z1: 3.82 },
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
  // ── living room: a sofa on the west wall facing the telly on the north-east,
  //    a breakfast nook under the east window, and a box in the middle (box) ──
  { id: 'sofa', x0: -3.3, z0: -1.15, x1: -2.38, z1: 0.95 }, // 2.10 long × 0.92 deep, back to the wall
  { id: 'coffee-table', x0: -1.9, z0: -1.0, x1: -1.3, z1: 0.2 },
  { id: 'tv-stand', x0: 1.98, z0: -2.4, x1: 2.4, z1: -0.85 },
  { id: 'bookshelf', x0: -3.3, z0: -2.9, x1: -2.95, z1: -2.0 },
  { id: 'big-plant', x0: -0.95, z0: -2.82, x1: -0.35, z1: -2.22 }, // clear of the WALK_BLOCK lane (x 0.4)
  { id: 'box', x0: -2.35, z0: 1.35, x1: -1.8, z1: 1.8 },
  { id: 'dining-table', x0: 0.75, z0: 1.1, x1: 2.35, z1: 1.9 }, // the long bench side towards the east wall
  { id: 'chair-a', x0: 0.22, z0: 1.42, x1: 0.69, z1: 1.89 },
  { id: 'chair-b', x0: 1.35, z0: 0.62, x1: 1.82, z1: 1.09 },
  // ── kitchen: an L of 0.60 m counters in the north-west corner (sink under
  //    the window, range beside it, dishwasher at the run's west end), the
  //    fridge in the north-east corner, and a breakfast bar on the south wall.
  //    The aisle in front of the run is 1.7 m — issue #33 asks for ~1 m — and
  //    nothing crosses the doorway's own route. ──
  { id: 'counter-n', x0: 2.52, z0: -2.9, x1: 4.95, z1: -2.3 },
  { id: 'counter-w', x0: 2.52, z0: -2.3, x1: 3.12, z1: -1.05 },
  { id: 'fridge', x0: 4.95, z0: -2.9, x1: 5.52, z1: -2.2 },
  { id: 'kitchen-bar', x0: 3.3, z0: 0.2, x1: 4.9, z1: 0.6 },
  { id: 'bar-stool-a', x0: 3.55, z0: -0.15, x1: 3.91, z1: 0.21 },
  { id: 'bar-stool-b', x0: 4.29, z0: -0.15, x1: 4.65, z1: 0.21 },
  // ── hall + entry: a console table in the hall and a shallow coat bench in
  //    the vestible, so the space in front of the front door stays real ──
  { id: 'hall-console', x0: 0.58, z0: 4.0, x1: 0.9, z1: 4.6 },
  { id: 'coat-bench', x0: 1.95, z0: 2.6, x1: 2.4, z1: 3.4 },
  // ── bathroom (door-less, so neither pad may cross the cased opening — that
  //    is issue #27's trap wearing a new costume) ──
  { id: 'vanity', x0: -3.1, z0: 2.22, x1: -2.2, z1: 2.7 },
  { id: 'toilet', x0: -1.7, z0: 3.45, x1: -1.02, z1: 3.83 },
  // ── bedroom: a queen with the headboard flush to the east wall (a floating
  //    headboard with a 0.60 m gap behind it is a playset tell), a desk on the
  //    north wall, a wardrobe on the west, the basket in the south-east corner.
  //    The bed starts at z 6.90, which leaves a 1.17 m aisle down the middle of
  //    the room from the door to the foot of the bed. ──
  { id: 'bed', x0: -0.83, z0: 6.9, x1: 1.2, z1: 8.43 }, // 2.03 long × 1.53 wide
  { id: 'nightstand', x0: 0.7, z0: 6.35, x1: 1.2, z1: 6.85 },
  { id: 'desk', x0: -2.55, z0: 5.32, x1: -1.15, z1: 6.02 },
  { id: 'wardrobe', x0: -2.6, z0: 7.4, x1: -2.0, z1: 8.6 },
  { id: 'laundry-basket', x0: 0.62, z0: 8.8, x1: 1.02, z1: 9.2 },
  { id: 'bedroom-plant', x0: -2.6, z0: 8.85, x1: -2.1, z1: 9.32 },
  // ── balcony: the railing (its pad keeps a body a whole radius off the rail)
  //    and the chair and plant that make it a place instead of a ledge ──
  { id: 'balcony-railing', x0: 0.55, z0: -4.4, x1: 2.45, z1: -4.28 },
  { id: 'balcony-chair', x0: 1.9, z0: -3.9, x1: 2.45, z1: -3.3 },
  { id: 'balcony-plant', x0: 0.63, z0: -4.28, x1: 0.9, z1: -4.0 },
];

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
 *  Twenty-eight places across all seven rooms. A run draws ten of them: random
 *  order, no repeats inside a cycle, never two in the same room twice in a row.
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
 *  `hide` — a prop that partly covers him (plants, the shower curtain, a table
 *  leg) — arrives with chunk 3, together with the `findable` check that proves
 *  "partly" never means "hidden".
 *  -------------------------------------------------------------------------- */
function spot(type, place, room, pose, pos, faceYaw, extra) {
  return Object.assign({ id: `${type}.${place}`, type, room, pose, spot: pos, faceYaw }, extra || {});
}

export const SPOTS = [
  // ── living room (7) ──────────────────────────────────────────────────────
  spot('couch-loaf', 'couch', 'living', 'side', [-2.75, 'cushion', -0.1], -2.58, { open: true }),
  spot('couch-loaf', 'sofa-back', 'living', 'loaf', [-3.16, 'sofaBackTop', 0.35], -1.6, { open: true }),
  spot('window-bird', 'n-window', 'living', 'sit', [-1.35, 'floor', -2.5], 1.71),
  spot('window-bird', 'e-window', 'living', 'sit', [1.72, 'floor', 0.55], 1.51),
  spot('window-bird', 'balcony-door', 'living', 'sit', [1.5, 'floor', -2.45], -0.1),
  spot('box-sit', 'box', 'living', 'sit', [-2.075, 'boxFloor', 1.575], 0.32, { open: true }),
  spot('hall-chase', 'living', 'living', 'loaf', [-0.6, 'floor', 0.9], 1.41),
  // ── balcony (2) — the owner's feature, and Bobo uses it (docs/CHARACTERS.md) ──
  spot('window-bird', 'balcony-rail', 'balcony', 'sit', [1.35, 'floor', -3.85], -2.9),
  spot('couch-loaf', 'balcony-chair', 'balcony', 'loaf', [2.15, 'chairSeat', -3.6], 1.77, { open: true }),
  // ── kitchen (5) — the room that read like a playset ──────────────────────
  spot('sink-sit', 'sink', 'kitchen', 'sit', [4.15, 'counterTop', -2.6], -2.92, { open: true }),
  spot('sink-sit', 'counter-return', 'kitchen', 'loaf', [2.82, 'counterTopW', -1.5], 3.02, { open: true }),
  spot('sink-sit', 'fridge', 'kitchen', 'sit', [5.2, 'floor', -1.75], 1.4),
  spot('sink-sit', 'bar', 'kitchen', 'side', [4.1, 'barTop', 0.4], -0.14, { open: true }),
  spot('hall-chase', 'kitchen', 'kitchen', 'loaf', [4.3, 'floor', -1.3], 1.58),
  // ── hall + entry + bathroom (5) ─────────────────────────────────────────
  spot('hall-chase', 'hall', 'hall', 'loaf', [-0.35, 'floor', 3.3], -0.19),
  spot('hall-chase', 'hall-door', 'hall', 'sit', [0.3, 'floor', 4.85], 1.55),
  spot('hall-chase', 'entry', 'entry', 'loaf', [1.45, 'floor', 3.4], 1.81),
  spot('hall-chase', 'bath-mat', 'bathroom', 'side', [-2.2, 'floor', 3.1], 1.9),
  spot('hall-chase', 'vanity', 'bathroom', 'sit', [-2.65, 'vanityTop', 2.46], 3.06, { open: true }),
  // ── bedroom (9) ─────────────────────────────────────────────────────────
  spot('desk-pen', 'desk', 'bedroom', 'sit', [-1.85, 'deskTop', 5.7], 2.89, { open: true }),
  spot('desk-pen', 'desk-end', 'bedroom', 'loaf', [-2.3, 'deskTop', 5.85], 3.01, { open: true }),
  spot('keyboard-sit', 'keyboard', 'bedroom', 'sit', [-1.85, 'kbTop', 5.82], 3.13, { open: true }),
  spot('laundry-nap', 'basket', 'bedroom', 'side', [0.82, 'laundryTop', 9.0], 1.46, { open: true }),
  spot('bed-stretch', 'bed', 'bedroom', 'back', [0.2, 'bedTop', 7.35], 0.08, { open: true }),
  spot('bed-stretch', 'bed-foot', 'bedroom', 'side', [-0.4, 'bedTop', 8.25], 1.43, { open: true }),
  spot('blanket-biscuits', 'blanket', 'bedroom', 'sit', [0.2, 'blanketTop', 7.15], 0, { open: true }),
  spot('blanket-biscuits', 'wardrobe', 'bedroom', 'loaf', [-1.55, 'floor', 8.0], 0.03),
  spot('laundry-nap', 'nightstand', 'bedroom', 'side', [0.95, 'nightstandTop', 6.6], 0.28, { open: true }),
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

/** Bobo's spots for one run: a shuffled cycle of the pool, re-rolled until no
 *  two neighbours share a room (issue #33: every catch should feel like going
 *  somewhere else). Deterministic for a given rng — the same seed replays the
 *  same run, which is what `capture --determinism` proves. The re-roll is
 *  capped, and on the cap the run falls back to the plain shuffle: the queue
 *  then behaves exactly as it did before the pool existed, and
 *  `queue-no-repeats` (which is about repeats, not rooms) still passes. The
 *  room rule is a promise about the experience, not about safety, so it
 *  degrades rather than hanging on an unlucky stream. */
export function pickSpotCycle(rand) {
  // Group the pool by room, in shuffled order inside each group, then take one
  // spot at a time from the room with the most left (weighted-random, so a run
  // does not always start in the biggest room). Never take the room the last
  // spot came from. This is the standard "reorganise the string" construction:
  // it succeeds whenever an order exists, which rejection sampling (24 shuffles)
  // did not — a 28-card deck with nine bedroom cards almost never shuffles into
  // a legal order by luck.
  const groups = new Map();
  for (const id of seededShuffle(SPOT_IDS.slice(), rand)) {
    const room = spotRoom(id);
    if (!groups.has(room)) groups.set(room, []);
    groups.get(room).push(id);
  }
  const order = [];
  let prev = null;
  while (order.length < SPOT_IDS.length) {
    const cands = [...groups.entries()].filter(([room]) => room !== prev);
    if (!cands.length) {
      // Only the room the last spot was in is left, so no order can keep the
      // promise. Append the rest: the run degrades to a plain queue rather than
      // hanging, and `queue-no-repeats` (about repeats) still holds.
      for (const [, list] of groups) order.push(...list.splice(0));
      break;
    }
    // Weight by how much of the room is left (1.5 powers: enough pull to keep
    // the big rooms spreading out, weak enough that the hall or the entry still
    // comes up early. The first ten cards — one run — can always be kept
    // alternating, because no room holds more than a third of the pool.
    let total = 0;
    for (const [, list] of cands) total += Math.pow(list.length, 1.5);
    let pick = rand() * total;
    let chosen = cands[cands.length - 1];
    for (const cand of cands) {
      pick -= Math.pow(cand[1].length, 1.5);
      if (pick <= 0) { chosen = cand; break; }
    }
    const [room, list] = chosen;
    order.push(list.pop());
    if (!list.length) groups.delete(room);
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
  { id: 'd-kitchen', room: 'kitchen', pos: [3.5, 'floor', -1.5], faceYaw: -3.14 }, // 1.28 m off the sink spot (was 1.185 — illegal pair)
  { id: 'd-bar', room: 'kitchen', pos: [4.05, 'floor', -0.62], faceYaw: 1.36, pose: 'side' },
  { id: 'd-hall', room: 'hall', pos: [0.35, 'floor', 3.0], faceYaw: 1.23 },
  { id: 'd-entry', room: 'entry', pos: [2.0, 'floor', 2.5], faceYaw: 1.9 },
  { id: 'd-bath', room: 'bathroom', pos: [-2.75, 'floor', 3.55], faceYaw: -0.81, pose: 'side' },
  { id: 'd-bedroom', room: 'bedroom', pos: [-1.35, 'floor', 6.95], faceYaw: 1.65 }, // 20 cm south: the desk/keyboard pair sat under DECOY_MIN_DIST
  { id: 'd-balcony', room: 'balcony', pos: [1.4, 'floor', -3.35], faceYaw: 2.82, pose: 'side' },
];
/** Q2/Q6: never the same spot, never closer than this (selfTest enforces). */
export const DECOY_MIN_DIST = 1.2;

/** The decoy pick for one round (the slice's rule, this file's spots). */
export function pickDecoySpot(boboSpot, rng) {
  const valid = DECOY_SPOTS.filter((s) => Math.hypot(s.pos[0] - boboSpot[0], s.pos[2] - boboSpot[2]) >= DECOY_MIN_DIST);
  if (!valid.length) return null;
  return valid[Math.min(valid.length - 1, Math.floor(rng() * valid.length))];
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
  { room: 'bathroom', pos: [-2.37, 3.33], yaw: -2.2 },
  { room: 'bedroom', pos: [-1.37, 6.63], yaw: 1.6 },
  { room: 'bedroom', pos: [-1.17, 8.73], yaw: -1.2 },
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
  bathroom: { pos: [-1.3, 1.5, 3.55], yaw: 0.872, pitch: -0.376, fov: 55, hand: false }, // the vanity, from the cased opening
  desk: { pos: [-1.85, 1.45, 7.05], yaw: 0.0, pitch: -0.437, fov: 45, hand: false }, // the desk on the north wall
  balcony: { pos: [0.95, 1.42, -3.75], yaw: -1.5, pitch: -0.35, fov: 55, hand: false }, // outside, looking at the chair
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
  // furniture (issue #33's "real furniture, not a playset" list)
  sofa: { w: [1.8, 2.4], d: [0.8, 1.0], h: [0.75, 0.95], note: 'sofa 2.10 × 0.92 × 0.85' },
  'seat-height': { top: [0.4, 0.5], note: 'seat height 0.45' },
  'sofa-back': { top: [0.8, 0.9], note: 'sofa backrest top 0.85' },
  'coffee-table': { w: [1.1, 1.4], d: [0.5, 0.7], h: [0.4, 0.5], note: 'coffee table 1.30 × 0.60 × 0.45' },
  'dining-table': { w: [1.5, 1.7], d: [0.8, 0.9], h: [0.72, 0.78], note: 'breakfast table 1.60 × 0.80 × 0.75' },
  'dining-chair': { w: [0.4, 0.5], d: [0.4, 0.55], h: [0.85, 1.0], note: 'chair 0.48 × 0.47 × 0.90' },
  'tv-stand': { w: [1.4, 1.65], d: [0.38, 0.46], h: [0.4, 0.5], note: 'TV stand 1.55 × 0.42 × 0.45' },
  'tv-screen': { w: [1.0, 1.3], h: [0.55, 0.75], bottom: [0.5, 0.7], note: '55" TV on the stand' },
  bookshelf: { w: [0.8, 1.0], d: [0.28, 0.4], h: [1.7, 2.1], note: 'bookcase 0.90 × 0.35 × 1.90' },
  'floor-lamp': { h: [1.4, 1.7], note: 'floor lamp 1.5–1.6 m' },
  'counter-height': { top: [0.85, 0.95], note: 'counter top 0.90' },
  'counter-depth': { d: [0.58, 0.66], note: 'counter depth 0.60' },
  'upper-cabinet': { t: [0.3, 0.38], h: [0.65, 0.8], note: 'uppers 0.35 deep, 0.7 tall' },
  'upper-mounted': { bottom: [1.42, 1.48], note: 'uppers start 1.45 off the floor' },
  hood: { w: [0.55, 0.7], d: [0.45, 0.55], bottom: [1.55, 1.7], note: 'hood over the range' },
  sink: { w: [0.5, 0.62], note: 'sink 0.55 wide' },
  range: { w: [0.55, 0.65], d: [0.58, 0.66], top: [0.85, 0.95], note: 'range 0.60 × 0.62' },
  fridge: { w: [0.55, 0.62], d: [0.65, 0.75], h: [1.7, 1.9], note: 'fridge 0.57 × 0.70 × 1.80' },
  dishwasher: { w: [0.55, 0.65], d: [0.58, 0.66], top: [0.85, 0.92], note: 'dishwasher 0.60 × 0.60 × 0.89' },
  'bar-height': { top: [1.0, 1.1], note: 'breakfast bar top 1.05' },
  'bar-stool': { w: [0.3, 0.4], d: [0.3, 0.4], h: [0.6, 0.7], note: 'stool 0.36 × 0.36 × 0.65' },
  'bed-queen': { w: [1.95, 2.1], d: [1.45, 1.65], note: 'queen 2.03 long × 1.53 wide' },
  'mattress-height': { top: [0.45, 0.55], note: 'mattress top 0.50' },
  headboard: { top: [1.0, 1.15], note: 'headboard top ~1.08' },
  nightstand: { w: [0.45, 0.55], d: [0.45, 0.55], h: [0.5, 0.6], note: 'nightstand 0.50 × 0.50 × 0.55' },
  dresser: { w: [1.2, 1.4], d: [0.45, 0.55], h: [0.75, 0.85], note: 'dresser 1.30 × 0.50 × 0.80' },
  desk: { w: [1.3, 1.5], d: [0.65, 0.75], h: [0.72, 0.78], note: 'desk 1.40 × 0.70 × 0.75' },
  wardrobe: { w: [1.1, 1.3], d: [0.55, 0.65], h: [1.95, 2.15], note: 'wardrobe 1.20 × 0.60 × 2.05' },
  'laundry-basket': { w: [0.36, 0.46], d: [0.36, 0.46], h: [0.5, 0.62], note: 'basket 0.40 × 0.40 × 0.55' },
  vanity: { w: [0.85, 0.95], d: [0.45, 0.55], h: [0.8, 0.9], note: 'vanity 0.90 × 0.50 × 0.85' },
  toilet: { w: [0.35, 0.42], d: [0.62, 0.72], h: [0.36, 0.45], note: 'toilet 0.38 × 0.68 × 0.40' },
  'balcony-chair': { w: [0.5, 0.62], d: [0.55, 0.65], h: [0.75, 0.95], note: 'balcony chair 0.57 × 0.60 × 0.85' },
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

/** The same seeded shuffle the slice uses (exported from game/level.js). */
function seededShuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Feel numbers — identical to the slice (game/level.js MOVE). */
export { MOVE };

/** The full game ships the real target (docs/STORY.md): ten finds. */
export const TARGET_DEFAULT = 10;
