// game/full-level.js — the FULL apartment as pure data (Step 8). Same shape
// as game/level.js, and every number here is documented in
// docs/LEVEL_LAYOUT.md. The slice's five moments become the ten moments of
// docs/STORY.md's generic list — placeholders only, nothing about the real
// Bobo is written into this game (docs/STORY.md "Generic moments"). Brandon
// swaps the ids/labels later without touching the engine: the whole list
// lives in this one file. No Three.js: a table the game, the selfTest and
// the capture tools all read.

import { MOVE } from './level.js';

/** Angle convention shared by camera and cats: a yaw a faces (−sin a, −cos a). */

/** The bathroom is the pocket that was sealed behind the hall's west wall
 *  in the slice (x∈[−3.14,−1.46], z∈[2.66,4.14]). Step 8 cuts a doorway
 *  (z∈[3.36,3.94]) into that wall, so the door3 rect bridges it. */
// Each rect is inset 0.08 m off the plaster's inner face, not 0.02 m (issue
// #27, bug 3). The camera's near plane is 0.05 m and walls are NOT colliders —
// the rect edge is the only thing keeping a body out of the plaster — so at
// 0.02 m the near plane cut 3 cm of every wall face away and you could see the
// next room through the hole. Furniture never did this because its COLLIDER
// push pad keeps the body 0.30 m out. Doorway rects deliberately still cross
// their own wall band: that is the opening. `wall-camera-clearance` in the
// engine's selfTest measures these gaps off the slabs that were actually built.
export const WALK_RECTS = [
  { id: 'living', x0: -3.04, z0: -2.44, x1: 3.04, z1: 2.44, room: 'living' },
  { id: 'door1', x0: -1.05, z0: 2.36, x1: -0.15, z1: 2.86, room: 'door' },
  { id: 'hall', x0: -1.24, z0: 2.76, x1: 0.24, z1: 4.04, room: 'hall' },
  { id: 'door2', x0: -1.05, z0: 3.96, x1: -0.15, z1: 4.46, room: 'door' },
  { id: 'door3', x0: -1.66, z0: 3.46, x1: -1.14, z1: 3.84, room: 'door' },
  { id: 'bathroom', x0: -3.04, z0: 2.76, x1: -1.56, z1: 4.04, room: 'bathroom' },
  { id: 'bedroom', x0: -3.04, z0: 4.36, x1: 1.9, z1: 6.84, room: 'bedroom' },
];

/** Walk-blocking furniture AABBs (walls are handled by the walk rects). */
export const COLLIDERS = [
  { id: 'couch', x0: -3.16, z0: -1.2, x1: -2.15, z1: 1.2 },
  { id: 'side-table', x0: -2.76, z0: -1.81, x1: -2.24, z1: -1.29 },
  { id: 'floor-lamp', x0: -2.13, z0: -2.18, x1: -1.87, z1: -1.92 },
  { id: 'plant-pot', x0: 2.45, z0: -2.22, x1: 2.79, z1: -1.88 },
  { id: 'box', x0: 1.44, z0: 0.53, x1: 2.06, z1: 0.97 },
  { id: 'counter', x0: 0.6, z0: 1.94, x1: 2.4, z1: 2.54 }, // kitchenette (Step 8)
  { id: 'bed', x0: 0.45, z0: 4.26, x1: 1.95, z1: 5.96 }, // headboard flush to the wall (issue #27)
  { id: 'nightstand', x0: 0.03, z0: 4.26, x1: 0.47, z1: 4.7 },
  { id: 'basket', x0: -0.76, z0: 5.97, x1: -0.14, z1: 6.43 }, // laundry basket (Step 8)
  { id: 'desk', x0: -3.14, z0: 5.2, x1: -2.54, z1: 6.2 }, // bedroom desk (Step 8)
  { id: 'vanity', x0: -3.09, z0: 2.66, x1: -2.36, z1: 2.98 }, // bathroom (Step 8)
  // The toilet used to sit in the corner BESIDE the bathroom door. Push pads
  // are radius-expanded on every side, so its pad covered the whole width of
  // door3 and the room a player could walk into was one they could not walk
  // out of (issue #27, bug 2). Same wall, same look — moved to the far end so
  // the door side stays a 0.9 m clear strip.
  { id: 'toilet', x0: -3.14, z0: 3.61, x1: -2.77, z1: 4.12 },
  // Step 8 furniture round 2 (Brandon's list) — footprints as built in
  // game/full-apartment.js, chosen clear of every spawn, view camera, moment
  // spot and decoy pot (see the clearance probe in docs/LEVEL_LAYOUT.md).
  { id: 'tv-stand', x0: 1.19, z0: -2.55, x1: 2.43, z1: -2.09 },
  { id: 'bookshelf', x0: -3.14, z0: -2.55, x1: -2.84, z1: -1.85 },
  { id: 'coffee-table', x0: -1.6, z0: 0.27, x1: -0.7, z1: 0.83 },
  { id: 'kitchen-table', x0: 2.1, z0: 1.25, x1: 3.15, z1: 2.0 },
  { id: 'hall-console', x0: 0.06, z0: 3.14, x1: 0.34, z1: 3.86 },
  { id: 'big-plant', x0: -1.87, z0: -2.53, x1: -1.44, z1: -2.11 },
  { id: 'bedroom-plant', x0: 1.55, z0: 6.5, x1: 1.91, z1: 6.86 }, // moved to the SE corner when the bed went flush (issue #27)
];

/** Surfaces the cats stand on that buildRoom does not measure itself. All of
 *  these are MEASURED from the built geometry in game/full-apartment.js; the
 *  values here are the documented expectation (docs/LEVEL_LAYOUT.md). */
export const EXTRA_SUPPORTS = {
  boxFloor: 0.02, bedTop: 0.5, counterTop: 0.9, deskTop: 0.76, kbTop: 0.79,
  laundryTop: 0.18, blanketTop: 0.58,
};

/** The ten moments — docs/STORY.md's generic list, invented-generic only:
 *  every one is Bobo doing a thing cats do, with a place in the apartment
 *  and a prop that belongs there. Poses are all existing src/cat.js poses
 *  (sit/loaf — nothing new is animated in src/); what makes each moment its
 *  own is the procedural rig write keyed by id in game/full.js.
 *  `canonicalDecoy` is the decoy spot the staged (capturable) tableau uses —
 *  always ≥ DECOY_MIN_DIST from Bobo (selfTest proves it for every seed). */
export const MOMENTS = [
  { id: 'couch-loaf', room: 'living', pose: 'loaf', spot: [-2.55, 'cushion', 0.46], faceYaw: -Math.PI / 2, canonicalDecoy: 'd-plant' },
  { id: 'window-bird', room: 'living', pose: 'sit', spot: [-0.6, 'floor', -2.2], faceYaw: -0.98, canonicalDecoy: 'd-rug' },
  { id: 'box-sit', room: 'living', pose: 'sit', spot: [1.75, 'boxFloor', 0.75], faceYaw: Math.PI / 2, canonicalDecoy: 'd-rug' },
  { id: 'sink-sit', room: 'living', pose: 'sit', spot: [2.05, 'counterTop', 2.2], faceYaw: Math.PI / 2, canonicalDecoy: 'd-rug' },
  { id: 'desk-pen', room: 'bedroom', pose: 'sit', spot: [-2.84, 'deskTop', 5.55], faceYaw: -Math.PI / 2, canonicalDecoy: 'd-bed' },
  { id: 'keyboard-sit', room: 'bedroom', pose: 'sit', spot: [-2.84, 'kbTop', 5.87], faceYaw: -Math.PI / 2, canonicalDecoy: 'd-bed' },
  { id: 'laundry-nap', room: 'bedroom', pose: 'loaf', spot: [-0.45, 'laundryTop', 6.2], faceYaw: 2.6, canonicalDecoy: 'd-hall' },
  { id: 'bed-stretch', room: 'bedroom', pose: 'sit', spot: [1.2, 'bedTop', 5.21], faceYaw: Math.PI / 2, canonicalDecoy: 'd-bed' }, // follows the flush bed (issue #27): was 5.9, off the moved mattress
  { id: 'blanket-biscuits', room: 'bedroom', pose: 'sit', spot: [1.2, 'blanketTop', 5.61], faceYaw: Math.PI / 2, canonicalDecoy: 'd-bed' }, // on the moved blanket (issue #27)
  { id: 'hall-chase', room: 'hall', pose: 'loaf', spot: [-0.5, 'floor', 3.42], faceYaw: 0.6, canonicalDecoy: 'd-rug' },
];

export const MOMENT_IDS = MOMENTS.map((m) => m.id);

/** The event phases that also stage a capturable frame. The canonical event
 *  tableau for catch/wrong/win is the cardboard box + d-rug (as in the
 *  slice) so the step-7 money frames still mean the same thing. */
export const EVENT_PHASES = ['catch', 'wrong', 'win'];
export const ALL_STAGE_IDS = [...MOMENT_IDS, ...EVENT_PHASES];
export const CANONICAL_EVENT_MOMENT = 'box-sit';

/** The decoy: 22 lb scenery with a collar and no dash (docs/DECOY_CAT.md).
 *  Five spots now — one per room, so "is that…?" can happen anywhere. The
 *  bathroom spot leans on the bath mat; d-bed moved out of the desk area so
 *  the two desk moments keep their distance (≥1.2 m, selfTest enforces). */
export const DECOY_SPOTS = [
  { id: 'd-rug', room: 'living', pos: [0.15, 'rug', 0.55], faceYaw: 0.9 },
  { id: 'd-plant', room: 'living', pos: [2.55, 'floor', -1.6], faceYaw: 2.4 },
  { id: 'd-hall', room: 'hall', pos: [-0.5, 'floor', 3.45], faceYaw: 0 },
  { id: 'd-bath', room: 'bathroom', pos: [-2.4, 'floor', 3.4], faceYaw: 1.6 },
  { id: 'd-bed', room: 'bedroom', pos: [-1.7, 'floor', 6.8], faceYaw: -1.2 },
];
/** Q2/Q6: never the same spot, never closer than this (selfTest enforces). */
export const DECOY_MIN_DIST = 1.2;

/** Eight respawns across four rooms. ≥0.30 m clear of every collider
 *  (spawn-clearance proves it) and picked room-different after each catch. */
export const SPAWNS = [
  { room: 'living', pos: [0.98, -1.5], yaw: 0.6 }, // run start: facing into the living room
  { room: 'living', pos: [-1.5, -1.8], yaw: 2.6 },
  { room: 'living', pos: [-2.2, 1.7], yaw: -2.2 },
  { room: 'hall', pos: [-0.55, 3.5], yaw: 0 },
  { room: 'bathroom', pos: [-2.3, 3.3], yaw: 1.9 },
  { room: 'bedroom', pos: [-2.6, 6.55], yaw: -0.79 },
  { room: 'bedroom', pos: [-1.2, 4.7], yaw: -1.4 },
  { room: 'bedroom', pos: [-1.35, 6.6], yaw: 0.85 }, // was [-0.2,6.75]: on the laundry basket's push pad (issue #27)
];

/** Capture views (docs/LEVEL_LAYOUT.md). pos + yaw/pitch + fov; `hand` says
 *  the view is first-person enough to show the player's own hand. The three
 *  slice tableau views still frame the canonical event tableau (box-sit +
 *  d-rug) with the slice's exact aim math; the three new ones (kitchen,
 *  bathroom, desk) are computed the same way — yaw = atan2(−dx, −dz),
 *  pitch = atan2(Δy, horiz) to the subject's middle — so the new rooms are
 *  captured from an aimed frame too. */
export const VIEWS = {
  diorama: { pos: [2.85, 1.95, 2.3], yaw: 0.62, pitch: -0.69, fov: 55, hand: false },
  'first-person': { pos: [0.4, 1.62, 1.2], yaw: -1.25, pitch: -0.71, fov: 55, hand: true },
  bobo: { pos: [2.95, 0.95, 1.05], yaw: 1.33, pitch: -0.44, fov: 30, hand: false },
  'bobo-face': { pos: [2.45, 0.62, 0.75], yaw: Math.PI / 2, pitch: -0.35, fov: 22, hand: false },
  'decoy-face': { pos: [-0.45, 0.6, -0.35], yaw: -2.56, pitch: -0.23, fov: 24, hand: false },
  bedroom: { pos: [-0.6, 1.62, 4.35], yaw: -2.28, pitch: -0.35, fov: 55, hand: true },
  kitchen: { pos: [0.9, 1.5, 0.9], yaw: -2.417, pitch: -0.137, fov: 50, hand: false }, // aimed at the sink
  bathroom: { pos: [-1.25, 1.62, 3.65], yaw: 1.357, pitch: -0.872, fov: 55, hand: true }, // from the doorway at the mat
  desk: { pos: [-1.35, 1.2, 5.55], yaw: Math.PI / 2, pitch: -0.266, fov: 40, hand: false }, // pen + Bobo on the desk, aimed like the slice's tableau views
};

/** Feel numbers — identical to the slice (game/level.js MOVE). */
export { MOVE };

/** The full game ships the real target (docs/STORY.md): ten finds. */
export const TARGET_DEFAULT = 10;

/** The rooms, in the order the checks iterate them. */
export const MOMENT_ROOMS = ['living', 'hall', 'bedroom']; // Bobo never sits in the bath

/** The decoy pick for one round's decoy spot (same rule, this file's spots). */
export function pickDecoySpot(boboSpot, rng) {
  const valid = DECOY_SPOTS.filter((s) => {
    const dx = s.pos[0] - boboSpot[0];
    const dz = s.pos[2] - boboSpot[2];
    return Math.hypot(dx, dz) >= DECOY_MIN_DIST;
  });
  if (!valid.length) return null;
  return valid[Math.min(valid.length - 1, Math.floor(rng() * valid.length))];
}

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
