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
//   * the flat is a real one-bedroom (65.7 m² net + a 2.5 m² balcony) with a
//     ceiling, so the room rectangles moved and the kitchen became a room;
//   * the ten moment *types* each own several *spots* (`SPOTS` below). A run
//     draws ten spots, never two in the same room twice in a row. The type
//     list itself is still exactly ten, so the capture matrix is unchanged.

import { MOVE } from './level.js';

/** Angle convention shared by camera and cats: a yaw a faces (−sin a, −cos a). */

/** The flat's rooms at real dimensions (interior faces, issue #33):
 *
 *    living  x∈[−3.30, 2.40]  z∈[−2.90, 2.10]   28.5 m²  (+ glass door N)
 *    kitchen x∈[ 2.52, 5.52]  z∈[−2.90, 0.60]   10.5 m²
 *    hall    x∈[−0.90, 0.90]  z∈[ 2.22, 5.20]    5.4 m²
 *    entry   x∈[ 1.02, 2.40]  z∈[ 2.22, 3.90]    2.3 m²   (front door, closed)
 *    bath    x∈[−3.30,−1.02]  z∈[ 2.22, 3.90]    3.8 m²   (door-less, open)
 *    bedroom x∈[−2.60, 1.20]  z∈[ 5.32, 9.32]   15.2 m²
 *    balcony x∈[ 0.55, 2.45]  z∈[−4.40,−3.10]    2.5 m²   (outdoor)
 *
 * Each walk rect is inset 0.08 m off the plaster's inner face, not 0.02 m
 * (issue #27, bug 3): the camera's near plane is 0.05 m and walls are NOT
 * colliders, so the rect edge is the only thing keeping a body out of the
 * float texture. That 0.08 is also why every doorway's structural gap is the
 * player's clear width + 0.16 and the casing fills the difference — the
 * bridging rect below each opening is inset 0.08 from the jambs too, and
 * `wall-camera-clearance` re-proves all of it off the slabs as built.
 *
 * Index 0 has to be the living room: `walk-rects-connected` floods from it,
 * and every other room reaches it through one of the six opening rects below.
 * The two door-less openings (bathroom, entry) are cased gaps with no leaf:
 * a room the player can walk into and never leave is the bug from issue #31,
 * so nothing in this flat can ever be closed. */
export const WALK_RECTS = [
  // ── the living room, split around the sofa/coffee-table/box footprint ──
  { id: 'liv-w', room: 'living', x0: -3.22, z0: -2.82, x1: -2.02, z1: 2.02 },
  { id: 'liv-c', room: 'living', x0: -2.02, z0: -2.82, x1: 0.05, z1: -0.40 },
  { id: 'liv-e', room: 'living', x0: -1.30, z0: -0.40, x1: 2.32, z1: 2.02 },
  { id: 'liv-ne', room: 'living', x0: 0.05, z0: -2.82, x1: 2.32, z1: -0.40 },
  // ── the openings (each bridges a wall band, inset 0.08 off jambs + faces) ──
  { id: 'door-living-hall', room: 'living', x0: -0.45, z0: 2.00, x1: 0.45, z1: 2.32 },
  { id: 'door-living-kitchen', room: 'kitchen', x0: 2.30, z0: -0.60, x1: 2.62, z1: 0.30 },
  { id: 'open-hall-bath', room: 'bathroom', x0: -1.12, z0: 2.50, x1: -0.80, z1: 3.40 },
  { id: 'open-hall-entry', room: 'entry', x0: 0.80, z0: 2.60, x1: 1.12, z1: 3.50 },
  { id: 'door-hall-bedroom', room: 'bedroom', x0: -0.45, z0: 5.10, x1: 0.45, z1: 5.42 },
  { id: 'door-balcony', room: 'balcony', x0: 0.85, z0: -3.04, x1: 2.15, z1: -2.80 },
  // ── the rooms off the hall ──
  { id: 'hall-s', room: 'hall', x0: -0.82, z0: 2.30, x1: 0.82, z1: 3.90 },
  { id: 'hall-n', room: 'hall', x0: -0.82, z0: 3.90, x1: 0.82, z1: 5.12 },
  { id: 'entry', room: 'entry', x0: 1.10, z0: 2.30, x1: 2.32, z1: 3.22 },
  { id: 'bath', room: 'bathroom', x0: -3.22, z0: 2.30, x1: -1.10, z1: 3.22 },
  { id: 'bath-s', room: 'bathroom', x0: -2.42, z0: 3.22, x1: -1.10, z1: 3.82 },
  // ── the kitchen: the walkway is ~1.0 m between the counter run and the
  //    fridge/dishwasher run, which is a real kitchen's number ──
  { id: 'kit-s', room: 'kitchen', x0: 2.70, z0: 0.68, x1: 5.44, z1: 2.02 },
  { id: 'kit-w', room: 'kitchen', x0: 2.60, z0: -0.68, x1: 3.40, z1: 0.68 },
  { id: 'kit-core', room: 'kitchen', x0: 3.50, z0: -0.68, x1: 4.34, z1: 0.68 },
  { id: 'kit-nw', room: 'kitchen', x0: 2.60, z0: -2.82, x1: 3.40, z1: -0.68 },
  { id: 'kit-ne', room: 'kitchen', x0: 3.50, z0: -2.82, x1: 4.34, z1: -0.68 },
  // ── the bedroom: bed against the east wall, wardrobe west, desk north ──
  { id: 'bed-c', room: 'bedroom', x0: -2.52, z0: 5.40, x1: -0.83, z1: 6.60 },
  { id: 'bed-s', room: 'bedroom', x0: -2.52, z0: 6.60, x1: -0.45, z1: 7.70 },
  { id: 'bed-sw', room: 'bedroom', x0: -2.52, z0: 7.70, x1: -1.90, z1: 9.24 },
  { id: 'bed-n', room: 'bedroom', x0: -1.90, z0: 6.60, x1: -0.45, z1: 9.24 },
  // ── the balcony: the walk rect stops 0.35 m short of the railing, so the
  //    body can never press the camera against the rail or the glass ──
  { id: 'balc', room: 'balcony', x0: 0.63, z0: -4.32, x1: 2.37, z1: -3.02 },
];

/** Static push boxes (footprint only — the engine's grid pads each by
 *  COLLIDER_PAD). Issue #33 rule of thumb: every footprint below is placed so
 *  its pad leaves a real door's worth of route on the room side of it. The
 *  counter that used to sit across the kitchen doorway is the reason this
 *  sentence is in the file.
 *
 *  `tall: true` means the box is full height (0.55..2.50 m). Nothing declared
 *  tall right now — the uppers and the hood are COLLIDERS but they are over
 *  the counter, whose 0.30 m pad already covers their footprint, and a tall
 *  box in front of the sink would have failed the spot's `findable` proof. */
export const COLLIDERS = [
  // living room
  { id: 'sofa', x0: -3.30, z0: -1.15, x1: -2.38, z1: 0.95 },
  { id: 'coffee-table', x0: -1.85, z0: -0.55, x1: -1.25, z1: 0.55 },
  { id: 'rug', x0: -3.00, z0: -1.60, x1: 0.10, z1: 1.60 },
  { id: 'tv-stand', x0: 1.90, z0: -2.40, x1: 2.40, z1: -0.80 },
  { id: 'bookshelf', x0: -3.30, z0: -2.90, x1: -2.98, z1: -2.00 },
  { id: 'big-plant', x0: -1.05, z0: -2.80, x1: -0.45, z1: -2.20 },
  { id: 'box', x0: -0.75, z0: 0.70, x1: -0.15, z1: 1.14 },
  { id: 'dining-table', x0: 1.20, z0: 0.75, x1: 2.00, z1: 1.55 },
  // kitchen — the L run: south counter under the bar, west run under the
  // pass-through, then the appliance wall east (fridge + dishwasher)
  { id: 'counter', x0: 2.70, z0: 0.00, x1: 5.10, z1: 0.60 },
  { id: 'counter-w', x0: 2.52, z0: -2.00, x1: 3.12, z1: -1.00 },
  { id: 'kitchen-bar', x0: 3.60, z0: 0.90, x1: 4.80, z1: 1.50 },
  { id: 'fridge', x0: 4.95, z0: -2.90, x1: 5.52, z1: -2.10 },
  { id: 'dishwasher', x0: 4.95, z0: -0.50, x1: 5.52, z1: 0.10 },
  // hall + entry
  { id: 'hall-console', x0: 0.55, z0: 3.90, x1: 0.90, z1: 4.70 },
  { id: 'coat-closet', x0: 1.02, z0: 3.30, x1: 2.17, z1: 3.90 },
  // bathroom (door-less: the vanity and the toilet are placed so neither pad
  // crosses the cased opening, which is exactly the issue #27 trap)
  { id: 'vanity', x0: -3.10, z0: 2.22, x1: -2.20, z1: 2.70 },
  { id: 'toilet', x0: -3.30, z0: 3.40, x1: -2.62, z1: 3.77 },
  // bedroom — the bed's headboard is flush with the east wall (the 0.60 m gap
  // behind a floating headboard is another playset tell)
  { id: 'bed', x0: -0.83, z0: 6.60, x1: 1.20, z1: 8.13 },
  { id: 'nightstand', x0: 0.70, z0: 6.05, x1: 1.20, z1: 6.55 },
  { id: 'desk', x0: -2.55, z0: 5.32, x1: -1.15, z1: 6.02 },
  { id: 'wardrobe', x0: -2.60, z0: 7.70, x1: -2.00, z1: 8.85 },
  { id: 'laundry-basket', x0: 0.62, z0: 8.80, x1: 1.02, z1: 9.20 },
  { id: 'bedroom-plant', x0: -2.60, z0: 9.10, x1: -2.10, z1: 9.32 },
  // balcony: the railing is solid geometry on the north edge and the glass
  // door is closed-leaf-flat, so the two bands below are what keeps a body
  // off the rail and out of the party wall. No fall, no way out (issue #33).
  { id: 'balcony-railing', x0: 0.55, z0: -4.40, x1: 2.45, z1: -4.00 },
  { id: 'balcony-party', x0: 0.43, z0: -4.40, x1: 0.55, z1: -3.10 },
];

/** Surfaces the cats stand on that the shell builder does not measure itself.
 *  All of these are MEASURED from the built geometry in game/full-apartment.js
 *  (docs/LEVEL_LAYOUT.md records the measured numbers); the values here are
 *  the documented expectation, and `surface-heights` compares the two. */
export const EXTRA_SUPPORTS = {
  boxFloor: 0.02, bedTop: 0.50, counterTop: 0.90, counterTopW: 0.90,
  deskTop: 0.75, kbTop: 0.78, laundryTop: 0.42, blanketTop: 0.57,
};

/** The ten moment TYPES — docs/STORY.md's generic list, invented-generic only:
 *  every one is Bobo doing a thing cats do. What makes each moment its own is
 *  the procedural rig write keyed by id in game/full.js, so a type can be
 *  staged on any of its spots. `label` is the human name the capture report
 *  and the story docs use; it is not in the engine's contract, and it lives
 *  here (not in STORY.md) so the data file stays the one place to edit.
 *  `canonical` is the spot the staged (capturable) tableau uses: it exists so
 *  ALL_STAGE_IDS keeps the exact 13 stages × 9 views × 3 times matrix the
 *  capture baselines were taken with. */
export const MOMENTS = [
  { id: 'couch-loaf', label: 'loafing on the couch', room: 'living', canonical: 'couch-loaf.couch', canonicalDecoy: 'd-rug' },
  { id: 'window-bird', label: 'watching the window', room: 'living', canonical: 'window-bird.n-window', canonicalDecoy: 'd-rug' },
  { id: 'box-sit', label: 'sitting in the box', room: 'living', canonical: 'box-sit.box', canonicalDecoy: 'd-rug' },
  { id: 'sink-sit', label: 'sitting in the sink', room: 'kitchen', canonical: 'sink-sit.sink', canonicalDecoy: 'd-bar' },
  { id: 'desk-pen', label: 'on the desk by the pens', room: 'bedroom', canonical: 'desk-pen.desk', canonicalDecoy: 'd-bedroom' },
  { id: 'keyboard-sit', label: 'on the keyboard', room: 'bedroom', canonical: 'keyboard-sit.keyboard', canonicalDecoy: 'd-bedroom' },
  { id: 'laundry-nap', label: 'asleep in the laundry basket', room: 'bedroom', canonical: 'laundry-nap.basket', canonicalDecoy: 'd-bedroom' },
  { id: 'bed-stretch', label: 'stretching on the bed', room: 'bedroom', canonical: 'bed-stretch.bed', canonicalDecoy: 'd-bedroom' },
  { id: 'blanket-biscuits', label: 'making biscuits on the blanket', room: 'bedroom', canonical: 'blanket-biscuits.blanket', canonicalDecoy: 'd-bedroom' },
  { id: 'hall-chase', label: 'the hall dash', room: 'hall', canonical: 'hall-chase.hall', canonicalDecoy: 'd-living' },
];

export const MOMENT_IDS = MOMENTS.map((m) => m.id);

/** The event phases that also stage a capturable frame. The canonical event
 *  tableau for catch/wrong/win is the cardboard box + d-rug (as in the slice)
 *  so the step-7 money frames still mean the same thing. */
export const EVENT_PHASES = ['catch', 'wrong', 'win'];
export const CANONICAL_EVENT_MOMENT = 'box-sit';

/** The room each moment type belongs to, for `respawn-different-room` (a
 *  respawn right where the last catch happened is a fairness bug). Types can
 *  span rooms now — `sink-sit` is the kitchen in this flat and was the living
 *  room counter in the slice — so a type gets the list of rooms its spots
 *  live in and the rule fires when the next spawn is in ANY of them. The
 *  slice's level.js carries its own single-room version of the same table. */
export const MOMENT_ROOMS = {
  'couch-loaf': ['living'],
  'window-bird': ['living'],
  'box-sit': ['living'],
  'sink-sit': ['kitchen'],
  'desk-pen': ['bedroom'],
  'keyboard-sit': ['bedroom'],
  'laundry-nap': ['bedroom'],
  'bed-stretch': ['bedroom'],
  'blanket-biscuits': ['bedroom'],
  'hall-chase': ['hall'],
};

/** ---------------------------------------------------------------------------
 *  The spot pool (issue #33: "a couple of times I didn't see him, or the
 *  places he was hiding wasn't enough").
 *
 *  Twenty-eight places across all seven rooms. A run draws ten: random order,
 *  no repeats inside a cycle, and never two in the same room twice in a row
 *  (both proved by `queue-no-repeats`). Every record:
 *    id        '<type>.<place>' — the prefix IS the moment type, so the rig
 *              write, the voice line and the capture stage still key off it;
 *    type      the moment type (derived);
 *    room      which room the spot is in (also which room gets culled);
 *    pose      an existing src/cat.js pose for the cat kind;
 *    spot      [x, supportName, z] — the surface he stands on;
 *    faceYaw   which way he looks (must be within CAT_FACE_MAX of the best
 *              place the player can stand and see him from — `cats-face-the-
 *              room` re-derives every one of these angles per spot);
 *    hide      (chunk 3) a prop that partly covers him; never enough to hide
 *              him, proved by the `findable` check.
 *
 *  `walk-reachable` proves from every spawn there is a place to stand and see
 *  each one; `findable` proves the body reads from there. A support name that
 *  is not built is a hard selfTest failure, so a spot cannot rot into a spot
 *  in mid-air when a piece of furniture moves.
 *  -------------------------------------------------------------------------- */
function spot(type, place, room, pose, pos, faceYaw, extra) {
  return Object.assign({ id: `${type}.${place}`, type, room, pose, spot: pos, faceYaw }, extra || {});
}

export const SPOTS = [
  // ── living room (7) ──────────────────────────────────────────────────────
  spot('couch-loaf', 'couch', 'living', 'side', [-2.80, 'cushion', -0.10], -Math.PI / 2),
  spot('couch-loaf', 'couch-arm', 'living', 'loaf', [-2.78, 'cushion', -1.32], -2.75),
  spot('window-bird', 'n-window', 'living', 'sit', [-1.20, 'floor', -2.42], 2.36),
  spot('window-bird', 'e-window', 'living', 'sit', [2.02, 'floor', 1.48], Math.PI / 2),
  spot('window-bird', 'balcony-door', 'living', 'sit', [1.50, 'floor', -2.45], 0.42),
  spot('box-sit', 'box', 'living', 'sit', [-0.45, 'boxFloor', 0.92], Math.PI / 2),
  spot('hall-chase', 'living', 'living', 'loaf', [-1.55, 'floor', 1.85], 0.6),
  // ── balcony (2) — the owner's feature, and Bobo uses it ──────────────────
  spot('window-bird', 'balcony-rail', 'balcony', 'sit', [1.12, 'floor', -3.72], 2.5),
  spot('couch-loaf', 'balcony-chair', 'balcony', 'loaf', [1.94, 'chairSeat', -3.55], -1.35),
  // ── kitchen (5) — the room that read like a playset ──────────────────────
  spot('sink-sit', 'sink', 'kitchen', 'sit', [4.32, 'counterTop', 0.30], Math.PI / 2),
  spot('sink-sit', 'pass-through', 'kitchen', 'loaf', [2.82, 'counterTopW', -1.50], 0.2),
  spot('sink-sit', 'fridge', 'kitchen', 'sit', [4.75, 'floor', -2.50], 2.3),
  spot('sink-sit', 'bar', 'kitchen', 'side', [3.90, 'barTop', 1.20], -1.2),
  spot('hall-chase', 'kitchen', 'kitchen', 'loaf', [3.92, 'floor', -0.20], 0.9),
  // ── hall + entry + bathroom (5) ─────────────────────────────────────────
  spot('hall-chase', 'hall', 'hall', 'loaf', [-0.35, 'floor', 3.30], 0.6),
  spot('hall-chase', 'hall-door', 'hall', 'sit', [0.35, 'floor', 4.90], 3.0),
  spot('hall-chase', 'entry', 'entry', 'loaf', [1.68, 'floor', 2.62], 1.4),
  spot('hall-chase', 'bath-mat', 'bathroom', 'side', [-1.95, 'floor', 3.55], -1.68),
  spot('hall-chase', 'vanity', 'bathroom', 'sit', [-2.65, 'vanityTop', 2.46], -1.4),
  // ── bedroom (9) ─────────────────────────────────────────────────────────
  spot('desk-pen', 'desk', 'bedroom', 'sit', [-1.85, 'deskTop', 5.66], -0.7),
  spot('desk-pen', 'desk-end', 'bedroom', 'loaf', [-2.30, 'deskTop', 5.90], -2.2),
  spot('keyboard-sit', 'keyboard', 'bedroom', 'sit', [-1.85, 'kbTop', 5.82], -2.36),
  spot('laundry-nap', 'basket', 'bedroom', 'side', [0.82, 'laundryTop', 9.00], 2.6),
  spot('bed-stretch', 'bed', 'bedroom', 'back', [0.19, 'bedTop', 7.10], Math.PI / 2),
  spot('bed-stretch', 'bed-foot', 'bedroom', 'side', [-0.40, 'bedTop', 7.95], Math.PI / 2),
  spot('blanket-biscuits', 'blanket', 'bedroom', 'sit', [0.19, 'blanketTop', 6.80], 2.64),
  spot('blanket-biscuits', 'wardrobe', 'bedroom', 'loaf', [-1.65, 'floor', 8.20], -1.2),
  spot('laundry-nap', 'nightstand', 'bedroom', 'side', [0.95, 'nightstandTop', 6.30], 2.0),
];

export const SPOT_IDS = SPOTS.map((s) => s.id);
const SPOT_BY_ID = new Map(SPOTS.map((s) => [s.id, s]));

/** Bobo's ten spots for one run: a shuffled cycle of the pool, re-rolled until
 *  no two neighbours share a room (issue #33: every catch should feel like
 *  going somewhere else). Deterministic for a given rng — the same seed must
 *  give the same run (`capture --determinism` re-plays it) — and it always
 *  contains the type's canonical spot for the stage capture can ask for, which
 *  is why the draw is over spots and the stage still resolves by type.
 *
 *  Re-rolls are capped, and if the cap is hit the run falls back to the plain
 *  shuffle: the queue then behaves exactly as it did before the pool existed,
 *  and `queue-no-repeats` still passes (that check is about repeats). The
 *  room rule is a soft contract on the experience, not a safety one. */
export function pickSpotCycle(rand) {
  for (let attempt = 0; attempt < 24; attempt++) {
    const shuffled = seededShuffle(SPOT_IDS.slice(), rand);
    let clash = false;
    for (let i = 1; i < shuffled.length; i++) {
      if (SPOT_BY_ID.get(shuffled[i]).room === SPOT_BY_ID.get(shuffled[i - 1]).room) { clash = true; break; }
    }
    if (!clash) return shuffled;
  }
  return seededShuffle(SPOT_IDS.slice(), rand);
}

/** The decoy: 22 lb scenery, white on his feet only, no dash (docs/DECOY_CAT.md).
 *  Issue #33 grew the lazy-spot pool to ten, one or two per room, so "is
 *  that…?" can happen anywhere. Still never Bobo's spot and never closer than
 *  DECOY_MIN_DIST (selfTest enforces over every seed × every Bobo spot). */
export const DECOY_SPOTS = [
  { id: 'd-living', room: 'living', pos: [-0.85, 'rug', 1.30], faceYaw: 0.9 },
  { id: 'd-tv', room: 'living', pos: [1.55, 'floor', -1.60], faceYaw: 2.4 },
  { id: 'd-dining', room: 'living', pos: [1.60, 'floor', 1.85], faceYaw: -0.8 },
  { id: 'd-kitchen', room: 'kitchen', pos: [3.05, 'floor', -0.35], faceYaw: 0.5 },
  { id: 'd-bar', room: 'kitchen', pos: [4.20, 'floor', 1.20], faceYaw: -1.2, pose: 'side' },
  { id: 'd-hall', room: 'hall', pos: [0.45, 'floor', 3.00], faceYaw: 0 },
  { id: 'd-entry', room: 'entry', pos: [2.05, 'floor', 2.55], faceYaw: 2.2 },
  { id: 'd-bath', room: 'bathroom', pos: [-2.85, 'floor', 3.55], faceYaw: -1.68, pose: 'side' },
  { id: 'd-bedroom', room: 'bedroom', pos: [-1.30, 'floor', 8.85], faceYaw: Math.PI / 2 },
  { id: 'd-balcony', room: 'balcony', pos: [1.60, 'floor', -3.45], faceYaw: -0.5 },
];
/** Q2/Q6: never the same spot, never closer than this (selfTest enforces). */
export const DECOY_MIN_DIST = 1.2;

/** Ten respawns across six rooms (every room but the bathroom pocket's far
 *  corner and the balcony: a run start has to be inside the flat, and the
 *  balcony is a destination, not a doorway). ≥ COLLIDER_PAD clear of every
 *  collider, ≥ RESPAWN_MIN_DIST from the previous room's respawn, and the
 *  engine re-checks all of it at runtime after every catch. */
export const SPAWNS = [
  { room: 'living', pos: [1.55, -1.45], yaw: 0.5 }, // run start: facing the sofa + the box
  { room: 'living', pos: [-2.70, 1.60], yaw: -2.0 },
  { room: 'living', pos: [-1.25, -1.35], yaw: 2.6 },
  { room: 'kitchen', pos: [3.05, 1.35], yaw: -0.6 },
  { room: 'kitchen', pos: [3.92, -1.85], yaw: 0.4 },
  { room: 'hall', pos: [-0.45, 3.30], yaw: 0 },
  { room: 'entry', pos: [1.70, 2.70], yaw: 1.5 },
  { room: 'bathroom', pos: [-1.95, 2.62], yaw: -1.9 },
  { room: 'bedroom', pos: [-1.55, 6.20], yaw: -0.7 },
  { room: 'bedroom', pos: [-1.15, 8.60], yaw: 0.9 },
];

/** The one route the point-walk (walk-rects-connected, rect corner to rect
 *  corner) is allowed to claim and the body grid proves it must not: the
 *  balcony's only way in is a 1.30 m glass door with a chair right inside it,
 *  so a 0.30 m body cannot get there even though a point can. That is on
 * *purpose* — the balcony is a destination Bobo can be found at, and the
 *  `walk-reachable` check treats it as a blocked route rather than a trap
 *  (there is nothing in there the player needs to reach, and the flat's own
 *  door is the only way out of it). */
export const WALK_BLOCK = { pos: [0.4, 0], yaw: 0 };
/** …and the room it guards, so the check knows which end to exempt. */
export const WALK_BLOCK_ROOM = 'balcony';

/** A few capture views (docs/LEVEL_LAYOUT.md). pos + yaw/pitch + fov; `hand`
 *  says the view is first-person enough to show the player's own hand. The
 *  slice's three tableau views are kept verbatim (same pos/yaw/pitch/fov)
 *  because the Step 6 baselines are them; the rest re-aim at this flat's
 *  canonical box-sit tableau with the same math (yaw = atan2(−dx, −dz),
 *  pitch = atan2(Δy, horiz) to the subject's middle), and the new kitchen /
 *  bathroom / desk / balcony views aim at the rooms they name so every room
 *  gets a frame. They must also stay ≥ MIN_VIEW_DIST apart — an off-the-map
 *  camera used to be invisible to the checks. */
export const VIEWS = {
  // ── the Step 6 slice tableau trio, unchanged (docs/CAPTURE.md) ──
  diorama: { pos: [2.85, 1.95, 2.3], yaw: 0.62, pitch: -0.69, fov: 55, hand: false },
  'first-person': { pos: [0.4, 1.62, 1.2], yaw: -1.25, pitch: -0.71, fov: 55, hand: true },
  bobo: { pos: [2.95, 0.95, 1.05], yaw: 1.33, pitch: -0.44, fov: 30, hand: false },
  // ── the flat's own frames, aimed at the canonical box ──
  overview: { pos: [1.6, 2.28, 4.9], yaw: 3.575, pitch: -0.32, fov: 55, hand: false },
  'over-shoulder': { pos: [-1.15, 2.35, 1.55], yaw: 2.45, pitch: -0.527, fov: 55, hand: false },
  'low-angle': { pos: [0.32, 0.62, 1.95], yaw: 2.838, pitch: 0.279, fov: 55, hand: false },
  // ── one frame per room (issue #33: the new rooms get captured too) ──
  kitchen: { pos: [3.92, 1.45, 1.72], yaw: 1.571, pitch: -0.196, fov: 55, hand: false },
  bathroom: { pos: [-1.35, 1.45, 2.71], yaw: -1.571, pitch: -0.098, fov: 55, hand: false },
  desk: { pos: [-1.85, 1.55, 6.87], yaw: 3.142, pitch: -0.235, fov: 55, hand: false },
  balcony: { pos: [1.50, 1.55, -3.25], yaw: 3.142, pitch: -0.031, fov: 55, hand: false },
};

/** The same seeded shuffle the slice uses (exported from game/level.js). */
function seededShuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Issue #33's ruler as data (the table is docs/ISSUE_33_REBUILD.md §1). The
 *  shell builder tags each piece it builds with a ruler row name, and the
 *  `furniture-real-scale` check measures the built AABB against the row. A
 *  piece with no row is not a failure (the game can build whatever it likes);
 *  a piece with a row that it misses IS, which is what stops a 0.45 m "sofa"
 *  from shipping again. */
export const SCALE_RANGES = {
  ceiling: { h: [2.40, 2.60], note: 'ceiling height 2.5 m' },
  'door-clear': { w: [0.80, 0.90], h: [2.00, 2.10], note: 'doorway 0.8-0.9 x 2.0-2.1' },
  'window-clear': { w: [0.70, 1.55], h: [0.55, 1.25], note: 'window opening' },
  'window-sill': { h: [0.85, 1.55], note: 'sill height ~0.9 m (bath 1.5)' },
  baseboard: { w: [0.015, 0.025], h: [0.09, 0.15], note: 'baseboard 2 x 12 cm' },
  'door-casing': { w: [0.05, 0.09], note: 'door frame/trim 6-8 cm' },
  'wall-ext': { t: [0.18, 0.22], note: 'exterior wall 0.20 m' },
  'wall-int': { t: [0.10, 0.14], note: 'interior wall 0.12 m' },
  sofa: { w: [1.80, 2.40], d: [0.80, 1.00], h: [0.75, 0.95], note: 'sofa 2.0-2.3 x 0.9 x 0.85' },
  'seat-height': { h: [0.40, 0.50], note: 'seat height 0.45' },
  'coffee-table': { w: [0.90, 1.30], d: [0.50, 0.70], h: [0.40, 0.50], note: 'coffee table 1.1 x 0.6 x 0.45' },
  'dining-table': { w: [1.50, 1.90], d: [0.80, 1.00], h: [0.72, 0.78], note: 'dining table 1.7 x 0.9 x 0.75' },
  'dining-chair': { w: [0.40, 0.50], d: [0.40, 0.55], h: [0.85, 1.00], note: 'dining chair 0.45 x 0.5 x 0.9' },
  'tv-stand': { w: [1.40, 1.80], d: [0.35, 0.45], h: [0.40, 0.50], note: 'TV stand 1.6 x 0.4 x 0.45' },
  bookshelf: { w: [0.70, 2.00], d: [0.28, 0.40], h: [1.70, 2.10], note: 'bookshelf 0.8 x 0.35 x 1.9' },
  'floor-lamp': { h: [1.40, 1.70], note: 'floor lamp 1.5-1.6 m' },
  'counter-height': { h: [0.85, 0.95], note: 'counter height 0.90' },
  'counter-depth': { d: [0.58, 0.66], note: 'counter depth 0.60' },
  'upper-cabinet': { d: [0.30, 0.38], h: [0.65, 0.80], note: 'uppers 0.35 deep, 0.7 tall' },
  'upper-mounted': { y: [1.45, 1.55], note: 'uppers start 1.45 off the floor' },
  sink: { w: [0.45, 0.65], note: 'sink ~0.55 wide' },
  range: { w: [0.55, 0.76], d: [0.58, 0.68], h: [0.85, 0.95], note: 'range 0.6-0.76 m' },
  fridge: { w: [0.55, 0.95], d: [0.60, 0.75], h: [1.65, 1.95], note: 'fridge 0.7 x 0.7 x 1.8' },
  dishwasher: { w: [0.55, 0.65], d: [0.58, 0.66], h: [0.82, 0.92], note: 'dishwasher 0.6 x 0.6 x 0.87' },
  'bar-height': { h: [1.00, 1.10], note: 'breakfast bar 1.05' },
  'bar-stool': { h: [0.60, 0.70], note: 'bar stool 0.65' },
  'bed-queen': { w: [1.90, 2.10], d: [1.95, 2.10], note: 'queen 2.0 x 2.0' },
  'mattress-height': { h: [0.45, 0.55], note: 'mattress top 0.5' },
  'nightstand': { w: [0.45, 0.55], d: [0.40, 0.50], h: [0.50, 0.60], note: 'nightstand 0.5 x 0.45 x 0.55' },
  dresser: { w: [1.20, 1.40], d: [0.45, 0.55], h: [0.75, 0.85], note: 'dresser 1.3 x 0.5 x 0.8' },
  desk: { w: [1.20, 1.60], d: [0.55, 0.70], h: [0.72, 0.78], note: 'desk 1.4 x 0.6 x 0.75' },
  wardrobe: { w: [0.90, 1.30], d: [0.55, 0.68], h: [1.95, 2.20], note: 'closet 1.2 x 0.6 x 2.1' },
  'laundry-basket': { w: [0.36, 0.46], d: [0.36, 0.46], h: [0.50, 0.60], note: 'basket 0.42 x 0.55' },
  vanity: { w: [0.80, 1.00], d: [0.45, 0.55], h: [0.80, 0.90], note: 'vanity 0.9 x 0.5 x 0.85' },
  toilet: { w: [0.35, 0.42], d: [0.62, 0.72], h: [0.36, 0.45], note: 'toilet 0.38 x 0.68 x 0.4' },
  railing: { h: [0.90, 1.10], note: 'balcony railing 1.00 high' },
};

/** Where the "you are here" map-ish overlays would go if the game ever grows
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

export { MOVE };
