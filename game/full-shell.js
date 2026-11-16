// game/full-shell.js — the real-size apartment as DATA (issue #33).
//
// The ruler this shell is built to is docs/ISSUE_33_REBUILD.md §1 and the plan
// is its §2. It is deliberately a data module with no Three.js in it: the
// apartment builder (game/full-apartment.js) draws these slabs, and the
// selfTest (game/full.js) measures the same numbers back off the meshes. A
// room size typed twice is how "the kitchen counter floated half a metre off
// the floor" happened, so nothing below is repeated anywhere else in the build.
//
// Conventions the rest of the flat relies on:
//   * y = 0 is the finish floor of a room, and every floor slab has its TOP at
//     y 0, so a walkable rectangle at y 0 is floor and never air.
//   * Walls are boxes from y 0 to WALL_H (2.70), which is 0.20 ABOVE the
//     ceiling underside CEIL_Y (2.50): the slabs overlap the ceiling slabs in
//     y, which is what makes the interior a closed volume the camera cannot
//     press a hole into (`wall-camera-clearance`).
//   * Exterior walls are 0.20 m thick, interior partitions 0.12 m. Rooms are
//     described by their INTERIOR faces, so the thickness is always outside.
//   * A band with a doorway in it is cut into pieces around the structural
//     gap, and that gap is always the clear width + 0.16: the walk rectangle
//     that bridges the door is the clear width, and `wall-camera-clearance`
//     fails a rectangle that merely TOUCHES a plaster face (it needs the 0.05 m
//     near plane + 2 cm). The 0.08 m on each side is filled by the door casing,
//     which is relief modelling and deliberately NOT plaster.
//   * Windows need no such allowance (no walk rectangle bridges a window), so
//     their jambs are flush with the glass opening.

/** Underside of the ceiling (m), and the height wall slabs are built to. */
export const CEIL_Y = 2.5;
export const WALL_H = 2.7;

/** Wall thicknesses (m). */
export const T_EXT = 0.2;
export const T_INT = 0.12;

/** Door leaves, heads, and the extra half-width every doorway's structural gap
 *  gets over its clear width (see the header). */
export const LEAF_W = 0.86;
export const LEAF_H = 2.04;
export const DOOR_HEAD = 2.05;
export const JAMB_INSET = 0.08;
/** The balcony slider's clear height: taller than a door, and the whole point
 *  of the room (issue #33; docs/CHARACTERS.md says the balcony is real). */
export const SLIDER_HEAD = 2.1;

/** --------------------------------------------------------------------------
 *  The rooms, as interior faces (docs/ISSUE_33_REBUILD.md §2). `area` is
 *  derived, never typed, so the doc's m² figure cannot quietly drift: the net
 *  interior area is the sum of these (65.7 m² as built, before the balcony).
 *  ------------------------------------------------------------------------- */
export const ROOMS = [
  { id: 'living', x0: -3.3, z0: -2.9, x1: 2.4, z1: 2.1, label: 'living room' },
  { id: 'kitchen', x0: 2.52, z0: -2.9, x1: 5.52, z1: 0.6, label: 'kitchen' },
  { id: 'hall', x0: -0.9, z0: 2.22, x1: 0.9, z1: 5.2, label: 'hallway' },
  { id: 'entry', x0: 1.02, z0: 2.22, x1: 2.4, z1: 3.9, label: 'entry' },
  { id: 'bathroom', x0: -3.3, z0: 2.22, x1: -1.02, z1: 3.9, label: 'bathroom' },
  { id: 'bedroom', x0: -2.6, z0: 5.32, x1: 1.2, z1: 9.32, label: 'bedroom' },
  // Outdoor, reached only through the living room's slider. Bounded by 1.10 m
  // parapets and a railing on top of the far one: no fall, and the camera can
  // never leave the flat (issue #33, docs/CHARACTERS.md).
  { id: 'balcony', x0: 0.55, z0: -4.4, x1: 2.45, z1: -3.1, label: 'balcony', outdoor: true },
];

export function roomArea(room) {
  return (room.x1 - room.x0) * (room.z1 - room.z0);
}
/** Net interior floor area (m²): 65.67 as built, inside issue #33's 65–80 band. */
export function netInteriorArea() {
  return ROOMS.filter((r) => !r.outdoor).reduce((sum, r) => sum + roomArea(r), 0);
}
export const ROOM_BY_ID = Object.fromEntries(ROOMS.map((r) => [r.id, r]));

/** --------------------------------------------------------------------------
 *  Plaster: every opaque slab, as a footprint plus a y range. `kind` is what
 *  the ruler check (`furniture-real-scale`) looks up, so an exterior wall that
 *  measured 0.09 m thick would fail the run.
 *
 *  Naming: `N/W/E/S` is the side of the flat, `-p` a pier (full height), `-s`
 *  a sill piece, `-h` a head piece. Sill and head pieces are outside the
 *  camera's eye height, so their y ranges are exact; piers are the pieces a
 *  walk rectangle has to respect.
 *  ------------------------------------------------------------------------- */
const E = T_EXT;
const I = T_INT;

/** How thick a band of a given kind is, and so where its far face is. This is
 *  the only place a wall's thickness is decided, so a `kind` names a rule and
 *  not just a look. */
export const BAND_T = { 'wall-ext': E, 'wall-int': I, parapet: I, ceiling: I };

/** A piece of one band: `axis` is the axis the band's THICKNESS lies along
 *  (so an east-west wall is axis 'z'), `band0` is the face it starts at, and
 *  the kind decides the thickness.
 *
 *  The `w/h/d/x/y/z` fields are the form `slabAABB` (src/reach.js) and the box
 *  builder both read — the plaster the checks measure IS the plaster that gets
 *  rendered, in the literal sense that it is the same seven numbers. The
 *  `x0..z1` footprint is the same box for the docs and for anything that asks
 *  "which room is this in". */
function pier(id, axis, a0, a1, band0, kind, side, y0 = 0, y1 = WALL_H) {
  const band1 = band0 + BAND_T[kind];
  // axis 'z' means the thickness runs along z, so the run is along x.
  const [r0, r1] = axis === 'z' ? [a0, a1] : [band0, band1];
  const [s0, s1] = axis === 'z' ? [band0, band1] : [a0, a1];
  return {
    id, axis, kind, side,
    x0: r0, x1: r1, z0: s0, z1: s1, y0, y1,
    w: r1 - r0, h: y1 - y0, d: s1 - s0,
    x: (r0 + r1) / 2, y: (y0 + y1) / 2, z: (s0 + s1) / 2,
  };
}

export const WALL_DEFS = [
  // ── the north exterior line, z −3.10 … −2.90 ────────────────────────────
  // Carries the living room's window, the balcony slider (a floor-to-head
  // opening) and the kitchen window over the sink.
  pier('N-p1', 'z', -3.5, -2.1, -3.1, 'wall-ext', 'living'),
  pier('N-p2', 'z', -0.3, 0.77, -3.1, 'wall-ext', 'living'),
  pier('N-p3', 'z', 2.23, 3.4, -3.1, 'wall-ext', 'living'),
  pier('N-p4', 'z', 4.9, 5.72, -3.1, 'wall-ext', 'kitchen'),
  pier('N-liv-win-s', 'z', -2.1, -0.3, -3.1, 'wall-ext', 'living', 0, 0.9),
  pier('N-liv-win-h', 'z', -2.1, -0.3, -3.1, 'wall-ext', 'living', 2.1, WALL_H),
  pier('N-slider-h', 'z', 0.77, 2.23, -3.1, 'wall-ext', 'living', SLIDER_HEAD, WALL_H),
  pier('N-kit-win-s', 'z', 3.4, 4.9, -3.1, 'wall-ext', 'kitchen', 0, 0.95),
  pier('N-kit-win-h', 'z', 3.4, 4.9, -3.1, 'wall-ext', 'kitchen', 1.75, WALL_H),

  // ── the kitchen's south and east exterior lines ─────────────────────────
  pier('S-kit-1', 'z', 2.4, 5.72, 0.6, 'wall-ext', 'kitchen'),
  pier('E-kit-1', 'x', -3.1, 0.8, 5.52, 'wall-ext', 'kitchen'),

  // ── the living room's east line, x 2.40 … 2.60 ──────────────────────────
  // The kitchen half is the interior party wall (with the doorway into it),
  // and north of the kitchen the same line turns exterior and carries the
  // window over the breakfast table.
  pier('E-liv-1', 'x', -2.9, -0.68, 2.4, 'wall-int', 'living'),
  pier('E-liv-2', 'x', 0.38, 0.6, 2.4, 'wall-int', 'living'),
  pier('E-liv-3', 'x', -2.9, 0.6, 2.4, 'wall-int', 'living', DOOR_HEAD, WALL_H),
  pier('E-liv-4', 'x', 0.6, 1.0, 2.4, 'wall-ext', 'living'),
  pier('E-liv-5', 'x', 1.95, 3.9, 2.4, 'wall-ext', 'living'),
  pier('E-liv-win-s', 'x', 1.0, 1.95, 2.4, 'wall-ext', 'living', 0, 0.9),
  pier('E-liv-win-h', 'x', 1.0, 1.95, 2.4, 'wall-ext', 'living', 2.1, WALL_H),

  // ── the flat's west exterior line, x −3.50 … −3.30 ──────────────────────
  // Living room and bathroom, then the piece that seals the unlit service
  // void behind the bathroom (nothing is ever seen in there; it is what stops
  // the party walls opening onto a gap the camera could somehow fall into).
  pier('W-1', 'x', -3.1, 2.6, -3.5, 'wall-ext', 'living'),
  pier('W-2', 'x', 3.3, 5.52, -3.5, 'wall-ext', 'bathroom'),
  pier('W-bath-win-s', 'x', 2.6, 3.3, -3.5, 'wall-ext', 'bathroom', 0, 1.5),
  pier('W-bath-win-h', 'x', 2.6, 3.3, -3.5, 'wall-ext', 'bathroom', 2.05, WALL_H),

  // ── the wall between the living room and the hall/entry, z 2.10 … 2.22 ──
  pier('M-liv-s1', 'z', -3.3, -0.53, 2.1, 'wall-int', 'living'),
  pier('M-liv-s2', 'z', 0.53, 2.4, 2.1, 'wall-int', 'living'),
  pier('M-liv-s-h', 'z', -0.53, 0.53, 2.1, 'wall-int', 'living', DOOR_HEAD, WALL_H),

  // ── the entry: south exterior wall with the (shut) front door ───────────
  pier('S-ent-1', 'z', 1.02, 1.25, 3.9, 'wall-ext', 'entry'),
  pier('S-ent-2', 'z', 2.27, 2.6, 3.9, 'wall-ext', 'entry'),
  pier('S-ent-h', 'z', 1.25, 2.27, 3.9, 'wall-ext', 'entry', DOOR_HEAD, WALL_H),

  // ── the bathroom: south partition, and the east wall to the hall with a
  //    door-less cased opening (a room you can walk into and never leave is
  //    issue #31's bug, so nothing in this flat can ever be shut) ──
  pier('S-bath-1', 'z', -3.3, -0.9, 3.9, 'wall-int', 'bathroom'),
  pier('E-bath-1', 'x', 2.22, 2.52, -1.02, 'wall-int', 'bathroom'),
  pier('E-bath-2', 'x', 3.53, 5.2, -1.02, 'wall-int', 'bathroom'),
  pier('E-bath-h', 'x', 2.52, 3.53, -1.02, 'wall-int', 'bathroom', DOOR_HEAD, WALL_H),

  // ── the hall: west wall to the bathroom (the opening above is E-bath),
  //    east wall to the entry (its own cased opening), south wall to the
  //    bedroom (its door is the gap in M-bed) ──
  pier('E-hall-1', 'x', 2.22, 2.52, 0.9, 'wall-int', 'hall'),
  pier('E-hall-2', 'x', 3.53, 3.9, 0.9, 'wall-int', 'hall'),
  pier('E-hall-h', 'x', 2.52, 3.53, 0.9, 'wall-int', 'hall', DOOR_HEAD, WALL_H),

  // ── the bedroom: 3.80 × 4.00 with a window on the south exterior wall ──
  pier('M-bed-1', 'z', -3.3, -0.53, 5.2, 'wall-int', 'bedroom'),
  pier('M-bed-2', 'z', 0.53, 1.4, 5.2, 'wall-int', 'bedroom'),
  pier('M-bed-h', 'z', -0.53, 0.53, 5.2, 'wall-int', 'bedroom', DOOR_HEAD, WALL_H),
  pier('E-bed-1', 'x', 5.2, 9.6, 1.2, 'wall-ext', 'bedroom'),
  pier('W-bed-1', 'x', 5.2, 9.6, -2.8, 'wall-ext', 'bedroom'),
  pier('S-bed-1', 'z', -2.8, -1.9, 9.32, 'wall-ext', 'bedroom'),
  pier('S-bed-2', 'z', -0.2, 1.4, 9.32, 'wall-ext', 'bedroom'),
  pier('S-bed-win-s', 'z', -1.9, -0.2, 9.32, 'wall-ext', 'bedroom', 0, 0.9),
  pier('S-bed-win-h', 'z', -1.9, -0.2, 9.32, 'wall-ext', 'bedroom', 2.1, WALL_H),

  // ── the balcony (issue #33): 1.90 × 1.30 off the living room's north wall.
  //    Three parapets (the fourth side is the flat's own north wall); 0.12
  //    thick, 1.10 high, and ARE plaster for the camera-gap check. The railing
  //    on the far parapet is a COLLIDER instead, because you see straight
  //    through a railing and the gap test must not be told it is a wall. ──
  pier('BAL-N', 'z', 0.43, 2.57, -4.52, 'parapet', 'balcony', 0, 1.1),
  pier('BAL-W', 'x', -4.52, -3.1, 0.43, 'parapet', 'balcony', 0, 1.1),
  pier('BAL-E', 'x', -4.52, -3.1, 2.45, 'parapet', 'balcony', 0, 1.1),
];

// A pier's far face comes from BAND_T above, so `kind` is the only thing that
// decides a wall's thickness anywhere in the flat.

/** --------------------------------------------------------------------------
 *  The openings: where the flat is not solid.
 *  `fixed` is the wall coordinate the gap sits in (the plaster face of the
 *  room side, so a probe can be fired straight through the wall), `lo`/`hi` is
 *  the CLEAR width a body gets, and `head` the top of the hole. Every doorway
 *  is `door` (a leaf that stays open), `cased` (no leaf at all) or `slider`
 *  (parked open); `sealed` is the front door, which is built shut, leads to no
 *  walkable room, and is therefore excluded from the passability rule that
 *  says "no room you can enter and never leave".
 *  ------------------------------------------------------------------------- */
export const OPENINGS = [
  { id: 'door-living-hall', kind: 'door', room: 'living', toRoom: 'hall', axis: 'z', fixed: 2.1, lo: -0.45, hi: 0.45, sill: 0, head: DOOR_HEAD },
  { id: 'door-living-kitchen', kind: 'door', room: 'living', toRoom: 'kitchen', axis: 'x', fixed: 2.4, lo: -0.6, hi: 0.3, sill: 0, head: DOOR_HEAD },
  { id: 'door-hall-bedroom', kind: 'door', room: 'hall', toRoom: 'bedroom', axis: 'z', fixed: 5.2, lo: -0.45, hi: 0.45, sill: 0, head: DOOR_HEAD },
  { id: 'open-hall-bath', kind: 'cased', room: 'hall', toRoom: 'bathroom', axis: 'x', fixed: -0.9, lo: 2.6, hi: 3.45, sill: 0, head: DOOR_HEAD },
  { id: 'open-hall-entry', kind: 'cased', room: 'hall', toRoom: 'entry', axis: 'x', fixed: 0.9, lo: 2.6, hi: 3.45, sill: 0, head: DOOR_HEAD },
  { id: 'slider-balcony', kind: 'slider', room: 'living', toRoom: 'balcony', axis: 'z', fixed: -2.9, lo: 0.85, hi: 2.15, sill: 0, head: SLIDER_HEAD },
  { id: 'door-front', kind: 'sealed', room: 'entry', toRoom: 'outside', axis: 'z', fixed: 3.9, lo: 1.25, hi: 2.27, sill: 0, head: DOOR_HEAD },

  { id: 'win-living-n', kind: 'window', room: 'living', axis: 'z', fixed: -2.9, lo: -2.1, hi: -0.3, sill: 0.9, head: 2.1 },
  { id: 'win-living-e', kind: 'window', room: 'living', axis: 'x', fixed: 2.4, lo: 1.0, hi: 1.95, sill: 0.9, head: 2.1 },
  { id: 'win-kitchen-n', kind: 'window', room: 'kitchen', axis: 'z', fixed: -2.9, lo: 3.4, hi: 4.9, sill: 0.95, head: 1.75 },
  { id: 'win-bedroom-s', kind: 'window', room: 'bedroom', axis: 'z', fixed: 9.32, lo: -1.9, hi: -0.2, sill: 0.9, head: 2.1 },
  { id: 'win-bath-w', kind: 'window', room: 'bathroom', axis: 'x', fixed: -3.3, lo: 2.6, hi: 3.3, sill: 1.5, head: 2.05 },
];

/** --------------------------------------------------------------------------
 *  Floors: the finish surface of each room, top at y 0. Each gets its own
 *  material in the builder: oak in the living room, hall and bedroom; tile in
 *  the kitchen, bathroom and entry; weathered concrete on the balcony (whose
 *  slab runs out under the parapets, the way a real balcony cantilevers).
 *  ------------------------------------------------------------------------- */
export const FLOORS = [
  { id: 'living', room: 'living', x0: -3.3, z0: -2.9, x1: 2.4, z1: 2.1, finish: 'oak' },
  { id: 'kitchen', room: 'kitchen', x0: 2.52, z0: -2.9, x1: 5.52, z1: 0.6, finish: 'tile' },
  { id: 'hall', room: 'hall', x0: -0.9, z0: 2.22, x1: 0.9, z1: 5.2, finish: 'oak' },
  { id: 'entry', room: 'entry', x0: 1.02, z0: 2.22, x1: 2.4, z1: 3.9, finish: 'tile' },
  { id: 'bathroom', room: 'bathroom', x0: -3.3, z0: 2.22, x1: -1.02, z1: 3.9, finish: 'tile' },
  { id: 'bedroom', room: 'bedroom', x0: -2.6, z0: 5.32, x1: 1.2, z1: 9.32, finish: 'oak' },
  { id: 'balcony', room: 'balcony', x0: 0.43, z0: -4.52, x1: 2.57, z1: -3.1, finish: 'concrete' },
];

/** The building's structural slab, under everything (the wall bands and the
 *  service void sit on it, so there is never a hairline slot from one room to
 *  the next at a party wall). */
export const STRUCTURE = { id: 'slab', x0: -3.6, z0: -4.6, x1: 5.8, z1: 9.6, y0: -0.2, y1: 0 };

/** Ceilings, one slab per interior room, underside exactly CEIL_Y (2.50 m, the
 *  ruler's first row). They are in `wallBoxes`: the camera looks UP at them
 *  too. The balcony has no ceiling — that is the sky. */
export const CEILINGS = FLOORS.filter((f) => f.room !== 'balcony').map((f) => ({
  id: `ceil-${f.id}`,
  room: f.room,
  axis: 'ceil',
  x0: f.x0, x1: f.x1, z0: f.z0, z1: f.z1,
  y0: CEIL_Y, y1: CEIL_Y + 0.2,
  side: f.room, kind: 'ceiling',
  w: f.x1 - f.x0, h: 0.2, d: f.z1 - f.z0,
  x: (f.x0 + f.x1) / 2, y: CEIL_Y + 0.1, z: (f.z0 + f.z1) / 2,
}));

/** --------------------------------------------------------------------------
 *  The surfaces a cat can be placed on, by name. game/full-level.js names one
 *  in every spot (`[x, 'counterTop', z]`) and game/full.js proves the name
 *  exists, so a spot can never rot into a spot in mid-air. The heights are the
 *  ruler's: 0.45 seat, 0.90 counter, 1.05 bar, 0.50 mattress, 0.75 desk.
 *  `x0..z1` is the patch he may stand on, which is what `spots-on-supports`
 *  measures a spot against.
 *  ------------------------------------------------------------------------- */
export const SUPPORT_DEFS = {
  // living room
  cushion: { x0: -3.0, z0: -0.93, x1: -2.46, z1: 0.73, top: 0.45 },
  sofaBackTop: { x0: -3.28, z0: -1.1, x1: -3.04, z1: 0.9, top: 0.85 },
  coffeeTop: { x0: -1.87, z0: -0.97, x1: -1.33, z1: 0.17, top: 0.45 },
  boxFloor: { x0: -2.3, z0: 1.4, x1: -1.85, z1: 1.75, top: 0.001 },
  tvTop: { x0: 2.0, z0: -2.38, x1: 2.38, z1: -0.87, top: 0.45 },
  diningTop: { x0: 0.77, z0: 1.12, x1: 2.33, z1: 1.88, top: 0.75 },
  // kitchen
  counterTop: { x0: 2.52, z0: -2.88, x1: 4.93, z1: -2.32, top: 0.9 },
  counterTopW: { x0: 2.54, z0: -2.28, x1: 3.1, z1: -1.07, top: 0.9 },
  barTop: { x0: 3.32, z0: 0.22, x1: 4.88, z1: 0.58, top: 1.05 },
  // balcony (docs/CHARACTERS.md: Bobo does go outside)
  chairSeat: { x0: 1.93, z0: -3.87, x1: 2.42, z1: -3.33, top: 0.42 },
  // bathroom — issue #49: the counter grew to its ruler footprint (0.90 ×
  // 0.48), the support is the marble's top face inside that footprint
  vanityTop: { x0: -3.28, z0: 2.24, x1: -2.42, z1: 2.68, top: 0.86 },
  // issue #49: the lid moved with the toilet to the north wall — the closed
  // lid of the real piece, top 0.425 (no spot uses it yet; it stays honest)
  toiletLid: { x0: -2.0, z0: 2.54, x1: -1.65, z1: 2.87, top: 0.425 },
  // bedroom
  bedTop: { x0: -0.81, z0: 6.92, x1: 1.18, z1: 8.41, top: 0.5 },
  blanketTop: { x0: -0.79, z0: 6.95, x1: 1.16, z1: 7.88, top: 0.545 },
  nightstandTop: { x0: 0.72, z0: 6.37, x1: 1.18, z1: 6.83, top: 0.55 },
  deskTop: { x0: -2.53, z0: 5.34, x1: -1.17, z1: 6.0, top: 0.75 },
  kbTop: { x0: -2.13, z0: 5.74, x1: -1.57, z1: 5.9, top: 0.79 },
  laundryTop: { x0: 0.64, z0: 8.82, x1: 1.0, z1: 9.18, top: 0.55 },
};

/** Which room a support sits in — derived, for the room culling in chunk 4 and
 *  for docs. A support that fell between rooms would return null, which the
 *  selfTest treats as an error rather than a shrug. */
export function supportRoom(name) {
  const s = SUPPORT_DEFS[name];
  if (!s) return null;
  const cx = (s.x0 + s.x1) / 2;
  const cz = (s.z0 + s.z1) / 2;
  const hit = ROOMS.find((r) => cx > r.x0 && cx < r.x1 && cz > r.z0 && cz < r.z1);
  return hit ? hit.id : null;
}
