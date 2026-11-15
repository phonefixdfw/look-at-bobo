// game/level.js — the slice apartment as pure data. Every number here is
// documented (and derived from the built geometry of src/room.js) in
// docs/LEVEL_LAYOUT.md. No Three.js: this file is a table the game, the
// selfTest, and any future step-7 tool can all read.

/** Angle convention shared by camera and cats: a yaw a faces (−sin a, −cos a). */

export const WALK_RECTS = [
  { id: 'living', x0: -3.12, z0: -2.52, x1: 3.12, z1: 2.52, room: 'living' },
  { id: 'door1', x0: -1.11, z0: 2.5, x1: -0.09, z1: 2.72, room: 'door' },
  { id: 'hall', x0: -1.32, z0: 2.66, x1: 0.32, z1: 4.14, room: 'hall' },
  { id: 'door2', x0: -1.11, z0: 4.08, x1: -0.09, z1: 4.3, room: 'door' },
  { id: 'bedroom', x0: -3.12, z0: 4.28, x1: 1.98, z1: 6.92, room: 'bedroom' },
];

/** Walk-blocking furniture AABBs (walls are handled by the walk rects). */
export const COLLIDERS = [
  { id: 'couch', x0: -3.16, z0: -1.2, x1: -2.15, z1: 1.2 },
  { id: 'side-table', x0: -2.76, z0: -1.81, x1: -2.24, z1: -1.29 },
  { id: 'floor-lamp', x0: -2.13, z0: -2.18, x1: -1.87, z1: -1.92 },
  { id: 'plant-pot', x0: 2.45, z0: -2.22, x1: 2.79, z1: -1.88 },
  { id: 'box', x0: 1.44, z0: 0.53, x1: 2.06, z1: 0.97 },
  { id: 'bed', x0: 0.45, z0: 4.95, x1: 1.95, z1: 6.65 },
  { id: 'nightstand', x0: 0.03, z0: 4.93, x1: 0.47, z1: 5.37 },
  { id: 'laundry', x0: -0.2, z0: 5.95, x1: 0.4, z1: 6.55 },
];

/** Surface y the cats are placed on. `cushion`/`rug`/`floor` come from
 *  buildRoom's measured SUPPORTS; boxFloor/bedTop are the apartment
 *  extension's surfaces (docs/LEVEL_LAYOUT.md). */
export const EXTRA_SUPPORTS = { boxFloor: 0.02, bedTop: 0.5 };

/** The slice's five moments. Poses are all existing cat.js poses; the
 *  animation is procedural and keyed by id in slice.js. `canonicalDecoy`
 *  is the decoy spot the staged (capturable) version of this moment uses. */
export const MOMENTS = [
  { id: 'loaf-couch', room: 'living', pose: 'loaf', spot: [-2.55, 'cushion', 0.46], faceYaw: -Math.PI / 2, canonicalDecoy: 'd-plant' },
  { id: 'window-bird', room: 'living', pose: 'sit', spot: [-0.6, 'floor', -2.2], faceYaw: -0.98, canonicalDecoy: 'd-rug' },
  { id: 'cardboard-box', room: 'living', pose: 'sit', spot: [1.75, 'boxFloor', 0.75], faceYaw: Math.PI / 2, canonicalDecoy: 'd-rug' },
  { id: 'tail-chase', room: 'hall', pose: 'loaf', spot: [-0.5, 'floor', 3.42], faceYaw: 0.6, canonicalDecoy: 'd-rug' },
  { id: 'bed-sprawl', room: 'bedroom', pose: 'sprawl', spot: [1.2, 'bedTop', 5.9], faceYaw: Math.PI / 2, canonicalDecoy: 'd-hall' },
];

export const MOMENT_IDS = MOMENTS.map((m) => m.id);

/** The event phases that also stage a capturable frame. The canonical
 *  tableau for catch/wrong/win is the cardboard-box spot + d-rug. */
export const EVENT_PHASES = ['catch', 'wrong', 'win'];
export const ALL_STAGE_IDS = [...MOMENT_IDS, ...EVENT_PHASES];
export const CANONICAL_EVENT_MOMENT = 'cardboard-box';

/** The decoy: 22 lb scenery with a collar and no dash (docs/DECOY_CAT.md). */
export const DECOY_SPOTS = [
  { id: 'd-rug', room: 'living', pos: [0.15, 'rug', 0.55], faceYaw: 0.9 },
  { id: 'd-plant', room: 'living', pos: [2.55, 'floor', -1.6], faceYaw: 2.4 },
  { id: 'd-hall', room: 'hall', pos: [-0.5, 'floor', 3.45], faceYaw: 0 },
  { id: 'd-bed', room: 'bedroom', pos: [-1.8, 'floor', 5.7], faceYaw: -1.2 },
];
/** Q2/Q6: never the same spot, never closer than this (selfTest enforces). */
export const DECOY_MIN_DIST = 1.2;

export const SPAWNS = [
  { room: 'living', pos: [1.6, 2.0], yaw: 0.6 }, // run start, and cycle 5-ish
  { room: 'bedroom', pos: [-2.6, 6.4], yaw: -0.79 },
  { room: 'hall', pos: [-0.55, 3.5], yaw: 0 },
  { room: 'bedroom', pos: [-2.2, 4.8], yaw: -1.2 },
  { room: 'living', pos: [-2.0, -1.8], yaw: 2.6 },
  { room: 'living', pos: [2.6, 1.8], yaw: 0.85 },
];

/** Capture views (docs/LEVEL_LAYOUT.md). pos + yaw/pitch + fov; `hand` says
 *  the view is first-person enough to show the player's own hand. The
 *  three tableau views (diorama/first-person/bobo/bobo-face/decoy-face)
 *  frame the canonical event tableau (cardboard-box + d-rug) from real
 *  aim math: yaw = atan2(−dx, −dz), pitch = atan2(Δy, horiz) to the target's
 *  middle, so the money frames (catch/wrong/win) are aimed at their subject. */
export const VIEWS = {
  diorama: { pos: [2.85, 1.95, 2.3], yaw: 0.62, pitch: -0.69, fov: 55, hand: false },
  'first-person': { pos: [0.4, 1.62, 1.2], yaw: -1.25, pitch: -0.71, fov: 55, hand: true },
  bobo: { pos: [2.95, 0.95, 1.05], yaw: 1.33, pitch: -0.44, fov: 30, hand: false },
  'bobo-face': { pos: [2.45, 0.62, 0.75], yaw: Math.PI / 2, pitch: -0.35, fov: 22, hand: false },
  'decoy-face': { pos: [-0.45, 0.6, -0.35], yaw: -2.56, pitch: -0.23, fov: 24, hand: false },
  bedroom: { pos: [-0.6, 1.62, 4.35], yaw: -2.28, pitch: -0.35, fov: 55, hand: true },
};

/** Feel numbers. */
export const MOVE = {
  eye: 1.62, // docs/CHARACTERS.md: the human's eye height
  walk: 2.6,
  run: 4.3,
  sensitivity: 0.0022, // radians per mouse pixel
  pitchLimit: 1.2,
  playerRadius: 0.3,
  boboPush: 0.46,
  decoyPush: 0.5,
  bob: 0.02,
};

/** The seeded pick for one round's decoy spot: all spots that are not
 *  Bobo's and ≥ DECOY_MIN_DIST away, drawn with the run PRNG. Returns null
 *  only if the level data contradicts itself (selfTest proves it never
 *  does for a real moment). */
export function pickDecoySpot(boboSpot, rng) {
  const valid = DECOY_SPOTS.filter((s) => {
    const dx = s.pos[0] - boboSpot[0];
    const dz = s.pos[2] - boboSpot[2];
    return Math.hypot(dx, dz) >= DECOY_MIN_DIST;
  });
  if (!valid.length) return null;
  return valid[Math.min(valid.length - 1, Math.floor(rng() * valid.length))];
}

/** The next spawn after a catch: first cycle entry whose room differs from
 *  Bobo's new room and from the previous spawn room. `fromIdx` advances the
 *  cycle; `prevRoom` is the room of the spawn the player used last. */
export function pickSpawn(boboRoom, prevRoom, fromIdx) {
  const n = SPAWNS.length;
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
