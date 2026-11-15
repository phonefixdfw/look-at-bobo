// game/full-shell.js — the flat's SHELL as pure data (issue #33).
//
// The walls, ceiling, floors, windows and doors of the real-size apartment,
// written as numbers instead of Three.js calls on purpose: game/full-apartment.js
// renders these definitions and every geometry check (the engine's
// `wall-camera-clearance`, `openings-passable`, `furniture-real-scale`, plus a
// scratch probe in tools/) measures the same table. One table, two readers, so
// the plaster a check proves and the plaster a player sees cannot drift apart
// — the rule src/reach.js `slabAABB` exists to enforce.
//
// Conventions (docs/ISSUE_33_REBUILD.md §2, records in docs/LEVEL_LAYOUT.md):
//   * metres, right-handed, floor y = 0, forward is −z (north), x east;
//   * every piece is a box in CENTRE form: { x, y, z } is the box's centre and
//     { w, h, d } its size, which is exactly what slabAABB reads;
//   * wall bands: exterior 0.20 m, interior 0.12 m; ceiling underside y = 2.50,
//     walls run 0 → 2.70 so the ceiling slab sits on top of them;
//   * a piece that borders a walkable room is inset nothing — the WALK_RECTS
//     are what keep the camera 0.08 m off the plaster (`wall-camera-clearance`
//     proves it), and every opening's structural gap is its clear width + 0.16
//     because the bridging walk rect eats 0.08 at each jamb;
//   * `scale` names the row in SCALE_RANGES (docs/ISSUE_33_REBUILD.md §1) that
//     the built piece is measured against, so a 0.45 m "sofa" cannot ship.

/** Interior ceiling height, and the wall height the slabs are built to. */
export const CEIL_Y = 2.50;
export const WALL_H = 2.70;
export const T_EXT = 0.20;
export const T_INT = 0.12;

/** Door head (2.05 — inside the ruler's 2.00..2.10) and the two sill heights. */
export const DOOR_HEAD = 2.05;

/** The rooms' interior faces, so a probe can ask "is this point in a room". */
export const ROOMS = {
  living: { x0: -3.30, z0: -2.90, x1: 2.40, z1: 2.10 },
  kitchen: { x0: 2.52, z0: -2.90, x1: 5.52, z1: 0.60 },
  hall: { x0: -0.90, z0: 2.22, x1: 0.90, z1: 5.20 },
  entry: { x0: 1.02, z0: 2.22, x1: 2.40, z1: 3.90 },
  bathroom: { x0: -3.30, z0: 2.22, x1: -1.02, z1: 3.90 },
  bedroom: { x0: -2.60, z0: 5.32, x1: 1.20, z1: 9.32 },
  balcony: { x0: 0.55, z0: -4.40, x1: 2.45, z1: -3.10 }, // outdoor, no ceiling
};

/** helper: box between two plan lines, floor to a given height. */
function wall(id, scale, x0, x1, z0, z1, y0 = 0, y1 = WALL_H) {
  return { id, scale, x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2, w: x1 - x0, h: y1 - y0, d: z1 - z0 };
}

/** Every plaster piece: walls (with the openings cut into them) and ceilings.
 *  All of it lands in `apt.wallBoxes`, which is what the see-through-wall and
 *  sight-line checks measure, and all of it merges into one mesh when drawn.
 *
 *  Openings come from `OPENINGS` below; the pieces here are the wall left over
 *  once each gap is cut, including the sill and head pieces (they ARE plaster,
 *  so they ARE in wallBoxes — relief trim on top of them is not, or a camera
 *  nosed into a doorway would clip it away). */
export const WALL_DEFS = [
  // ── living room: north wall (exterior, z −3.10..−2.90) ──
  // the N window x∈[−2.10,−0.30] sill 0.90 head 2.10, the balcony glass door
  // x∈[0.77,2.23] head 2.05 (a 1.46 m sliding door, parked open at the west jamb)
  wall('N-liv-1', 'wall-ext', -3.50, -2.10, -3.10, -2.90),
  wall('N-liv-sill', 'wall-ext', -2.10, -0.30, -3.10, -2.90, 0, 0.90),
  wall('N-liv-head', 'wall-ext', -2.10, -0.30, -3.10, -2.90, 2.10, WALL_H),
  wall('N-liv-2', 'wall-ext', -0.30, 0.77, -3.10, -2.90),
  wall('N-liv-dhead', 'wall-ext', 0.77, 2.23, -3.10, -2.90, DOOR_HEAD, WALL_H),
  wall('N-liv-3', 'wall-ext', 2.23, 2.40, -3.10, -2.90),
  // ── living room: west wall (exterior, x −3.50..−3.30), no openings ──
  wall('W-liv', 'wall-ext', -3.50, -3.30, -3.10, 2.22),
  // ── living room: east wall (exterior, x 2.40..2.60) south of the kitchen,
  //    with the E window z∈[1.00,1.95] sill 0.90 head 2.10 ──
  wall('E-liv-1', 'wall-ext', 2.40, 2.60, 0.60, 1.00),
  wall('E-liv-sill', 'wall-ext', 2.40, 2.60, 1.00, 1.95, 0, 0.90),
  wall('E-liv-head', 'wall-ext', 2.40, 2.60, 1.00, 1.95, 2.10, WALL_H),
  wall('E-liv-2', 'wall-ext', 2.40, 2.60, 1.95, 2.22),
  // ── living/bathroom + living/hall: the south band z 2.10..2.22 ──
  wall('S-liv-bath', 'wall-int', -3.50, -1.02, 2.10, 2.22),
  wall('S-liv-1', 'wall-int', -1.02, -0.53, 2.10, 2.22),
  wall('S-liv-2', 'wall-int', 0.53, 1.02, 2.10, 2.22),
  wall('S-liv-dhead', 'wall-int', -0.53, 0.53, 2.10, 2.22, DOOR_HEAD, WALL_H),
  // ── kitchen: north wall continues the living room's line ──
  // the kitchen N window x∈[3.40,4.90] sill 0.95 head 1.75 (over the sink)
  wall('N-kit-1', 'wall-ext', 2.40, 3.40, -3.10, -2.90),
  wall('N-kit-sill', 'wall-ext', 3.40, 4.90, -3.10, -2.90, 0, 0.95),
  wall('N-kit-head', 'wall-ext', 3.40, 4.90, -3.10, -2.90, 1.75, WALL_H),
  wall('N-kit-2', 'wall-ext', 4.90, 5.72, -3.10, -2.90),
  // ── kitchen: east + south ──
  wall('E-kit', 'wall-ext', 5.52, 5.72, -3.10, 0.72),
  wall('S-kit', 'wall-int', 2.52, 5.52, 0.60, 0.72),
  // ── kitchen west wall (x 2.40..2.52): the doorway z∈[−0.68,0.38] and the
  //    pass-through z∈[−1.90,−1.00] y 0.95..1.55 over the counter ──
  wall('W-kit-1', 'wall-int', 2.40, 2.52, -2.90, -1.90),
  wall('W-kit-pass-sill', 'wall-int', 2.40, 2.52, -1.90, -1.00, 0, 0.95),
  wall('W-kit-pass-head', 'wall-int', 2.40, 2.52, -1.90, -1.00, 1.55, WALL_H),
  wall('W-kit-2', 'wall-int', 2.40, 2.52, -1.00, -0.68),
  wall('W-kit-3', 'wall-int', 2.40, 2.52, 0.38, 0.60),
  // ── bathroom: west wall (exterior) with the frosted window z∈[2.60,3.30]
  //    sill 1.50 head 2.05, plus its south wall ──
  wall('W-bath-1', 'wall-ext', -3.50, -3.30, 2.10, 2.60),
  wall('W-bath-sill', 'wall-ext', -3.50, -3.30, 2.60, 3.30, 0, 1.50),
  wall('W-bath-head', 'wall-ext', -3.50, -3.30, 2.60, 3.30, 2.05, WALL_H),
  wall('W-bath-2', 'wall-ext', -3.50, -3.30, 3.30, 4.02),
  wall('S-bath', 'wall-int', -3.50, -1.02, 3.90, 4.02),
  // ── the hall's spine walls: west (with the door-less bathroom opening
  //    z∈[2.42,3.48]) and east (with the entry opening z∈[2.52,3.58]) ──
  wall('W-hall-1', 'wall-int', -1.02, -0.90, 2.22, 2.42),
  wall('W-hall-2', 'wall-int', -1.02, -0.90, 3.48, 5.20),
  wall('W-hall-head', 'wall-int', -1.02, -0.90, 2.42, 3.48, DOOR_HEAD, WALL_H),
  wall('E-hall-1', 'wall-int', 0.90, 1.02, 2.22, 2.52),
  wall('E-hall-2', 'wall-int', 0.90, 1.02, 3.58, 5.20),
  wall('E-hall-head', 'wall-int', 0.90, 1.02, 2.52, 3.58, DOOR_HEAD, WALL_H),
  // ── entry vestibule: east wall with the flat's front door z∈[2.72,3.80]
  //    (a closed leaf — the world outside is not a place the game goes) ──
  wall('E-entry-1', 'wall-ext', 2.40, 2.60, 2.10, 2.72),
  wall('E-entry-2', 'wall-ext', 2.40, 2.60, 3.80, 4.02),
  wall('E-entry-head', 'wall-ext', 2.40, 2.60, 2.72, 3.80, DOOR_HEAD, WALL_H),
  wall('S-entry', 'wall-int', 1.02, 2.60, 3.90, 4.02),
  // ── bedroom: north wall (z 5.20..5.32) with the doorway x∈[−0.53,0.53] ──
  wall('N-bed-1', 'wall-int', -2.80, -0.53, 5.20, 5.32),
  wall('N-bed-2', 'wall-int', 0.53, 1.40, 5.20, 5.32),
  wall('N-bed-dhead', 'wall-int', -0.53, 0.53, 5.20, 5.32, DOOR_HEAD, WALL_H),
  // ── bedroom: west + east (exterior), south with the window x∈[−1.90,−0.20] ──
  wall('W-bed', 'wall-ext', -2.80, -2.60, 5.20, 9.52),
  wall('E-bed', 'wall-ext', 1.20, 1.40, 5.20, 9.52),
  wall('S-bed-1', 'wall-ext', -2.80, -1.90, 9.32, 9.52),
  wall('S-bed-sill', 'wall-ext', -1.90, -0.20, 9.32, 9.52, 0, 0.90),
  wall('S-bed-head', 'wall-ext', -1.90, -0.20, 9.32, 9.52, 2.10, WALL_H),
  wall('S-bed-2', 'wall-ext', -0.20, 1.40, 9.32, 9.52),
  // ── the balcony's west party wall and its two parapets (the railing sits on
  //    the parapets; there is no way off the flat and no fall to fall off) ──
  wall('W-balc', 'wall-ext', 0.35, 0.55, -4.40, -3.10),
  wall('N-balc-parapet', 'wall-ext', 0.55, 2.45, -4.40, -4.30, 0, 1.10),
  wall('E-balc-parapet', 'wall-ext', 2.40, 2.50, -4.40, -3.10, 0, 1.10),
  // ── ceilings: one slab per room (the balcony stays open to the sky, which is
  //    why the sun can only light the flat through the glass) ──
  { id: 'C-living', scale: 'ceiling', x: -0.55, y: 2.60, z: -0.44, w: 5.90, h: 0.20, d: 5.32 },
  { id: 'C-kitchen', scale: 'ceiling', x: 4.06, y: 2.60, z: -1.19, w: 3.32, h: 0.20, d: 3.82 },
  { id: 'C-hall', scale: 'ceiling', x: 0.00, y: 2.60, z: 3.71, w: 2.04, h: 0.20, d: 3.22 },
  { id: 'C-entry', scale: 'ceiling', x: 1.81, y: 2.60, z: 3.06, w: 1.58, h: 0.20, d: 1.92 },
  { id: 'C-bath', scale: 'ceiling', x: -2.26, y: 2.60, z: 3.06, w: 2.48, h: 0.20, d: 1.92 },
  { id: 'C-bedroom', scale: 'ceiling', x: -0.70, y: 2.60, z: 7.36, w: 4.20, h: 0.20, d: 4.32 },
];

/** The flat's openings, as declared intent. `openings-passable` turns each one
 *  into ray probes through the built wallBoxes: a body-height line straight
 *  through the gap must be clear, and a line 10 cm outside its declared sill /
 *  head must NOT be — which is how "2.05 tall" becomes a measured fact instead
 *  of a comment. `from`/`to` are the two rooms it joins, `axis` is the wall's
 *  normal, `span` the gap along the wall, `lo`/`hi` the vertical opening. */
export const OPENINGS = [
  { id: 'door-living-hall', kind: 'door', axis: 'z', span: [-0.45, 0.45], band: [-3.50, 1.02], wall: [2.10, 2.22], from: [0, 1.9], to: [0, 2.4], lo: 0, hi: DOOR_HEAD, fromRoom: 'living', toRoom: 'hall' },
  { id: 'door-living-kitchen', kind: 'door', axis: 'x', span: [-0.60, 0.30], band: [-2.90, 0.60], wall: [2.40, 2.52], from: [2.2, -0.15], to: [2.7, -0.15], lo: 0, hi: DOOR_HEAD, fromRoom: 'living', toRoom: 'kitchen' },
  { id: 'door-hall-bedroom', kind: 'door', axis: 'z', span: [-0.45, 0.45], band: [-2.80, 1.40], wall: [5.20, 5.32], from: [0, 5.0], to: [0, 5.5], lo: 0, hi: DOOR_HEAD, fromRoom: 'hall', toRoom: 'bedroom' },
  { id: 'open-hall-bath', kind: 'door', axis: 'x', span: [2.95, 2.95], band: [2.22, 5.20], wall: [-1.02, -0.90], from: [-0.6, 2.95], to: [-1.3, 2.95], lo: 0, hi: DOOR_HEAD, fromRoom: 'hall', toRoom: 'bathroom' },
  { id: 'open-hall-entry', kind: 'door', axis: 'x', span: [3.05, 3.05], band: [2.22, 5.20], wall: [0.90, 1.02], from: [0.6, 3.05], to: [1.3, 3.05], lo: 0, hi: DOOR_HEAD, fromRoom: 'hall', toRoom: 'entry' },
  { id: 'door-balcony', kind: 'door', axis: 'z', span: [1.50, 1.50], band: [-3.50, 2.40], wall: [-3.10, -2.90], from: [1.50, -2.6], to: [1.50, -3.4], lo: 0, hi: DOOR_HEAD, fromRoom: 'living', toRoom: 'balcony' },
  { id: 'pass-kitchen', kind: 'pass', axis: 'x', span: [-1.45, -1.45], band: [-2.90, 0.60], wall: [2.40, 2.52], from: [2.2, -1.45], to: [2.7, -1.45], lo: 0.95, hi: 1.55, fromRoom: 'living', toRoom: 'kitchen' },
  { id: 'win-living-north', kind: 'window', axis: 'z', span: [-1.20, -1.20], band: [-3.50, 2.40], wall: [-3.10, -2.90], from: [-1.20, -2.6], to: [-1.20, -3.3], lo: 0.90, hi: 2.10, fromRoom: 'living', toRoom: 'outside' },
  { id: 'win-living-east', kind: 'window', axis: 'x', span: [1.47, 1.47], band: [0.60, 2.22], wall: [2.40, 2.60], from: [2.1, 1.47], to: [2.8, 1.47], lo: 0.90, hi: 2.10, fromRoom: 'living', toRoom: 'outside' },
  { id: 'win-kitchen-north', kind: 'window', axis: 'z', span: [4.15, 4.15], band: [2.40, 5.72], wall: [-3.10, -2.90], from: [4.15, -2.6], to: [4.15, -3.3], lo: 0.95, hi: 1.75, fromRoom: 'kitchen', toRoom: 'outside' },
  { id: 'win-bedroom-south', kind: 'window', axis: 'z', span: [-1.05, -1.05], band: [-2.80, 1.40], wall: [9.32, 9.52], from: [-1.05, 9.0], to: [-1.05, 9.7], lo: 0.90, hi: 2.10, fromRoom: 'bedroom', toRoom: 'outside' },
  { id: 'win-bath-west', kind: 'window', axis: 'x', span: [2.95, 2.95], band: [2.10, 4.02], wall: [-3.50, -3.30], from: [-3.0, 2.95], to: [-3.7, 2.95], lo: 1.50, hi: 2.05, fromRoom: 'bathroom', toRoom: 'outside' },
];

/** Floors: one plane per room (oak through the living rooms, wipeable tile in
 *  the wet rooms, decking outside). `mat` picks the material in the builder. */
export const FLOORS = [
  { id: 'floor-living', room: 'living', mat: 'oak', ...ROOMS.living },
  { id: 'floor-hall', room: 'hall', mat: 'oak', ...ROOMS.hall },
  { id: 'floor-entry', room: 'entry', mat: 'oak', ...ROOMS.entry },
  { id: 'floor-bedroom', room: 'bedroom', mat: 'oak', ...ROOMS.bedroom },
  { id: 'floor-kitchen', room: 'kitchen', mat: 'tile', ...ROOMS.kitchen },
  { id: 'floor-bath', room: 'bathroom', mat: 'tile', ...ROOMS.bathroom },
  { id: 'floor-balcony', room: 'balcony', mat: 'deck', ...ROOMS.balcony },
];

/** The surfaces a cat can be placed on, as the builder declares them: the
 *  footprint here is what `spots-on-supports` proves every spot sits inside,
 *  and the builder MEASURES each one's top (`supports[name] = topY(mesh)`) so
 *  the y a cat is placed at is the surface that is really there. A spot that
 *  names a support the builder does not make is a hard selfTest failure. */
export const SUPPORT_DEFS = {
  rug: { x0: -3.00, z0: -1.60, x1: 0.10, z1: 1.60, top: 0.006, note: 'the living room rug (walkable: not a collider)' },
  cushion: { x0: -3.22, z0: -1.05, x1: -2.52, z1: 0.85, top: 0.45, note: 'sofa seat cushions' },
  sofaArm: { x0: -3.22, z0: 0.72, x1: -2.52, z1: 0.95, top: 0.60, note: 'the sofa arm a cat perches on' },
  boxFloor: { x0: -0.75, z0: 0.70, x1: -0.15, z1: 1.14, top: 0.02, note: 'inside the cardboard box' },
  coffeeTop: { x0: -1.85, z0: -0.55, x1: -1.25, z1: 0.55, top: 0.45, scale: 'coffee-table' },
  tvTop: { x0: 1.90, z0: -2.40, x1: 2.40, z1: -0.80, top: 0.45, scale: 'tv-stand' },
  sillTop: { x0: -3.30, z0: -3.02, x1: -2.90, z1: -2.90, top: 0.90, scale: 'window-sill', note: 'the living room N window board' },
  counterTop: { x0: 2.70, z0: 0.00, x1: 5.10, z1: 0.60, top: 0.90, scale: 'counter-height', note: 'the kitchen south run' },
  counterTopW: { x0: 2.52, z0: -2.00, x1: 3.12, z1: -1.00, top: 0.90, scale: 'counter-height', note: 'the west run, under the pass-through' },
  barTop: { x0: 3.60, z0: 0.90, x1: 4.80, z1: 1.50, top: 1.05, scale: 'bar-height', note: 'the breakfast bar' },
  vanityTop: { x0: -3.10, z0: 2.22, x1: -2.20, z1: 2.70, top: 0.85, scale: 'vanity' },
  toiletLid: { x0: -3.30, z0: 3.44, x1: -2.66, z1: 3.74, top: 0.42, scale: 'toilet' },
  bedTop: { x0: -0.83, z0: 6.60, x1: 1.20, z1: 8.13, top: 0.50, scale: 'mattress-height' },
  blanketTop: { x0: -0.60, z0: 6.55, x1: 0.98, z1: 7.05, top: 0.57, note: 'the folded blanket at the head of the bed' },
  nightstandTop: { x0: 0.70, z0: 6.05, x1: 1.20, z1: 6.55, top: 0.55, scale: 'nightstand' },
  deskTop: { x0: -2.55, z0: 5.32, x1: -1.15, z1: 6.02, top: 0.75, scale: 'desk' },
  kbTop: { x0: -2.05, z0: 5.70, x1: -1.65, z1: 5.94, top: 0.78, note: 'the keyboard on the desk' },
  laundryTop: { x0: 0.62, z0: 8.80, x1: 1.02, z1: 9.20, top: 0.42, scale: 'laundry-basket', note: 'the laundry pile inside the basket' },
  chairSeat: { x0: 1.85, z0: -3.95, x1: 2.42, z1: -3.35, top: 0.45, note: 'the balcony chair (a cat loafed on it is a long way from anywhere)' },
};
