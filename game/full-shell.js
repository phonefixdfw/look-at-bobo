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
 *  interior area is the sum of these (68.68 m² since issue #67 grew the
 *  bathroom, before the balcony).
 *  ------------------------------------------------------------------------- */
export const ROOMS = [
  { id: 'living', x0: -3.3, z0: -2.9, x1: 2.4, z1: 2.1, label: 'living room' },
  { id: 'kitchen', x0: 2.52, z0: -2.9, x1: 5.52, z1: 0.6, label: 'kitchen' },
  // Issue #81: the hallway widened to a real 2.40 m (it was 1.80), taking
  // 0.30 m off the bathroom's east band and 0.32 m off the entry's west side.
  // Every hall opening kept its z position; the bands moved with it.
  { id: 'hall', x0: -1.2, z0: 2.22, x1: 1.2, z1: 5.2, label: 'hallway' },
  // Issue #81: the entry grew east into the old east void to keep its 1.40 m
  // width after the hall took 0.30 m off its west side — 1.40 × 1.68 m, the
  // front door (kept sealed, kept its 1.02 m case) now centred at x 1.83.
  { id: 'entry', x0: 1.32, z0: 2.22, x1: 2.72, z1: 3.9, label: 'entry' },
  // Issue #67: the bathroom took the service void behind its old south wall.
  // Issue #81 gave 0.30 m of its east band back to the hall: 1.98 × 2.98 =
  // 5.9 m², still above the issue's 5 m² minimum. The toilet stepped 0.30 m
  // west with the plaster so the doorway field keeps its width (game/full-bath.js).
  { id: 'bathroom', x0: -3.3, z0: 2.22, x1: -1.32, z1: 5.2, label: 'bathroom' },
  // Issue #81: the dining room, built in the sealed void east of the entry
  // and south of it — L-shaped, and the rect below is its bounding box. The
  // entry's new east band pokes into the rect's west edge south of the wide
  // arm (x [2.6, 2.84], z [2.22, 4.4]); `subtract` takes that protrusion back
  // out of every area number, so the real floor is 2.92 × 1.42 + 2.68 × 2.18
  // = 9.99 m², above the issue's 7 m². (The south face first went up at the
  // entry door line, z 3.90, for an 8.65 m² room; the issue's own numbers —
  // a 1.05 m table, four chairs and a sideboard — want the extra half metre,
  // so the face rides south into the void to 4.40.) It touches the kitchen
  // and the living room, and only them, through two cased openings; the
  // south exterior band carries its window (the living room's east window,
  // `win-living-e`, was on the plaster the kitchen/dining door cuts through
  // and came down with it).
  { id: 'dining', x0: 2.6, z0: 0.8, x1: 5.52, z1: 4.4, label: 'dining room', subtract: 0.24 * 2.18 },
  { id: 'bedroom', x0: -2.6, z0: 5.32, x1: 1.2, z1: 9.32, label: 'bedroom' },
  // Outdoor, reached only through the living room's slider. Bounded by 1.10 m
  // parapets and a railing on top of the far one: no fall, and the camera can
  // never leave the flat (issue #33, docs/CHARACTERS.md).
  { id: 'balcony', x0: 0.55, z0: -4.4, x1: 2.45, z1: -3.1, label: 'balcony', outdoor: true },
];

export function roomArea(room) {
  return (room.x1 - room.x0) * (room.z1 - room.z0) - (room.subtract ?? 0);
}
/** Net interior floor area (m²): 78.25 as built since issue #81 (it was 68.68
 *  while the hall was 1.80 m wide and the east void was sealed plaster), inside
 *  issue #33's 65–80 band. */
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
  // Issue #81: the kitchen half of the old south band stops at x 3.66 — its
  // west end, x [2.60, 3.66], is now the cased kitchen→dining doorway (clear
  // 0.90 m at x [2.68, 3.58]); the corner post at x [2.40, 2.60] stays with
  // the living room's east line below, and the casing jambs fill the rest.
  pier('S-kit-1', 'z', 3.66, 5.72, 0.6, 'wall-ext', 'kitchen'),
  pier('S-kit-h', 'z', 2.6, 3.66, 0.6, 'wall-ext', 'kitchen', DOOR_HEAD, WALL_H),
  pier('E-kit-1', 'x', -3.1, 0.8, 5.52, 'wall-ext', 'kitchen'),

  // ── the dining room's south and east exterior lines (issue #81) ─────────
  // The old sealed east void becomes a room. Its south face started as the
  // entry's door line carried east (z 3.90), but that made an 8.6 m² room —
  // under the issue's 7 m² only after the notch, and too tight to walk four
  // sides of a table — so the face rides south into the void to z 4.40:
  // the room gains 0.50 m, the sideboard gets its wall under the window,
  // and the old line's stubs behind the wall never see a camera. The face
  // carries the dining window where the living room's removed east window
  // used to look into nothing; the east face is the kitchen's line carried
  // south (x 5.52 … 5.72).
  pier('S-din-1', 'z', 2.34, 3.4, 4.4, 'wall-ext', 'entry'),
  pier('D-win-s', 'z', 3.4, 4.35, 4.4, 'wall-ext', 'dining', 0, 0.9),
  pier('D-win-h', 'z', 3.4, 4.35, 4.4, 'wall-ext', 'dining', 2.1, WALL_H),
  pier('S-din-2', 'z', 4.35, 5.72, 4.4, 'wall-ext', 'dining'),
  pier('E-din-1', 'x', 0.8, 4.6, 5.52, 'wall-ext', 'dining'),

  // ── the living room's east line, x 2.40 … 2.60 ──────────────────────────
  // The kitchen half is the interior party wall (with the doorway into it).
  // Issue #81: north of the kitchen this line is the dining room's west wall
  // and carries the cased living→dining door (structural gap z [0.72, 2.10],
  // clear 1.22 m at z [0.80, 2.02] — twice the old window's width and the
  // wide opening the issue asks for between the two rooms). The window over
  // the old breakfast table, `win-living-e`, stood on exactly this plaster and
  // came down with it; the dining room's new south window took its place.
  // The opening's south jamb is `M-liv-s3`'s west end, not a pier of this
  // line: the M-liv band at z [2.10, 2.22] already covers x [0.53, 2.84],
  // so plaster here would grow INTO the cased door's clear (its leaf-free
  // case runs to z 2.02 and the casing to 2.10).
  pier('E-liv-1', 'x', -2.9, -0.68, 2.4, 'wall-int', 'living'),
  pier('E-liv-2', 'x', 0.38, 0.6, 2.4, 'wall-int', 'living'),
  pier('E-liv-3', 'x', -2.9, 0.6, 2.4, 'wall-int', 'living', DOOR_HEAD, WALL_H),
  pier('E-liv-4', 'x', 0.6, 0.72, 2.4, 'wall-ext', 'living'),
  pier('E-din-h', 'x', 0.72, 2.1, 2.4, 'wall-ext', 'dining', DOOR_HEAD, WALL_H),

  // ── the flat's west exterior line, x −3.50 … −3.30 ──────────────────────
  // Living room and bathroom, then the piece that seals the unlit service
  // void behind the bathroom (nothing is ever seen in there; it is what stops
  // the party walls opening onto a gap the camera could somehow fall into).
  pier('W-1', 'x', -3.1, 2.6, -3.5, 'wall-ext', 'living'),
  pier('W-2', 'x', 3.3, 5.52, -3.5, 'wall-ext', 'bathroom'),
  pier('W-bath-win-s', 'x', 2.6, 3.3, -3.5, 'wall-ext', 'bathroom', 0, 1.5),
  pier('W-bath-win-h', 'x', 2.6, 3.3, -3.5, 'wall-ext', 'bathroom', 2.05, WALL_H),

  // ── the living room / hall party wall, z 2.10 … 2.22 ────────────────────
  // Issue #81: the east pier now meets the dining room's west band at x 2.60,
  // and `M-liv-s3` fills the small corner from there to the entry's new east
  // band at x 2.84 — it is the north jamb of the living→dining doorway.
  pier('M-liv-s1', 'z', -3.3, -0.53, 2.1, 'wall-int', 'living'),
  pier('M-liv-s2', 'z', 0.53, 2.6, 2.1, 'wall-int', 'living'),
  pier('M-liv-s-h', 'z', -0.53, 0.53, 2.1, 'wall-int', 'living', DOOR_HEAD, WALL_H),
  pier('M-liv-s3', 'z', 2.6, 2.84, 2.1, 'wall-int', 'dining'),

  // ── the entry: south exterior wall with the (shut) front door ───────────
  // Issue #81 carried this line east across the old east void (S-din-1 above
  // continues it to the dining window). The door keeps its 1.02 m case and
  // its leaf — only the case slid 0.07 m east, to x [1.32, 2.34], so its west
  // jamb sits flush on the widened hall's east band instead of buried in it.
  // `S-ent-1` is now the 12 cm corner post between that band and the case.
  pier('S-ent-1', 'z', 1.2, 1.32, 3.9, 'wall-ext', 'entry'),
  pier('S-ent-h', 'z', 1.32, 2.34, 3.9, 'wall-ext', 'entry', DOOR_HEAD, WALL_H),

  // ── the entry's east wall (issue #81) ────────────────────────────────────
  // The wall the dining room hangs on: it seals the entry's east side, gives
  // the dining room's south arm its west face (x 2.84), and closes the slot
  // between the two rooms. It runs the whole depth, living-wall band to
  // dining south band, with no opening — the entry is reached from the hall
  // alone, and an opening here would give the dining room a third neighbour.
  pier('E-ent-1', 'x', 2.22, 4.4, 2.72, 'wall-int', 'entry'),

  // ── the bathroom: the east wall to the hall with a door-less cased opening
  //    (a room you can walk into and never leave is issue #31's bug, so nothing
  //    in this flat can ever be shut). Issue #67 deleted the old `S-bath-1`
  //    partition at z 3.90: the room now runs south to the bedroom's own north
  //    band (M-bed, z 5.20), so the sealed service void behind it became floor.
  //    Nothing else had to be built — W-2 already ran to z 5.52 and E-bath-2 to
  //    5.20, which is how the void was sealed in the first place. ──
  // Issue #81: the plaster face moved west to x −1.32 with the hall's
  // widening; the opening kept its z span (2.42 … 3.48 structural).
  pier('E-bath-1', 'x', 2.22, 2.52, -1.32, 'wall-int', 'bathroom'),
  pier('E-bath-2', 'x', 3.53, 5.2, -1.32, 'wall-int', 'bathroom'),
  pier('E-bath-h', 'x', 2.52, 3.53, -1.32, 'wall-int', 'bathroom', DOOR_HEAD, WALL_H),

  // ── the hall: west wall to the bathroom (the opening above is E-bath),
  //    east wall to the entry (its own cased opening), south wall to the
  //    bedroom (its door is the gap in M-bed) ──
  pier('E-hall-1', 'x', 2.22, 2.52, 1.2, 'wall-int', 'hall'),
  pier('E-hall-2', 'x', 3.53, 3.9, 1.2, 'wall-int', 'hall'),
  // Issue #67: the east band stops at z 3.90, the entry's south face. Past
  // that the corridor is closed on the console table and the bedroom door by
  // the band x [1.20, 1.32], z [3.90, 5.20] — service space on the far side,
  // never seen from any room. Issue #81: both faces moved 0.30 m east with
  // the widening (the entry moved 0.32 east, leaving the 12 cm S-ent-1 post);
  // the opening kept its z span (2.42 … 3.48 structural).
  pier('E-hall-3', 'x', 3.9, 5.2, 1.2, 'wall-int', 'hall'),
  pier('E-hall-h', 'x', 2.52, 3.53, 1.2, 'wall-int', 'hall', DOOR_HEAD, WALL_H),

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
  // For the `door` kind, `swingHi` names the hinge jamb (true: the leaf lies
  // along the plaster beyond `hi`, false: beyond `lo`) and `swingOut` lies the
  // leaf against toRoom's plaster instead of o.room's. They are chosen so the
  // leaf has a clear run of wall: living-hall west (open floor), hall-bedroom
  // east AND bedroom-side — the hall has only 37 cm of plaster either side of
  // that opening, and the bedroom's north face is clear east to the corner
  // (issue #65, docs/LEVEL_LAYOUT.md).
  { id: 'door-living-hall', kind: 'door', room: 'living', toRoom: 'hall', axis: 'z', fixed: 2.1, lo: -0.45, hi: 0.45, sill: 0, head: DOOR_HEAD, swingHi: false },
  // Issue #81: living-kitchen went `cased` with the dining room. Its only
  // remaining leaf-park run — north of the opening, z [0.38, 1.24] — is now
  // the living→dining doorway's own bridge rect, so a leaf there would stand
  // in a walkable opening (`doors-read-open` rightly fails it), and the flat's
  // rule is that nothing may ever be shut or stand in a way. A cased opening
  // keeps the trim and loses the leaf, same as the bathroom's and the dining
  // room's.
  { id: 'door-living-kitchen', kind: 'cased', room: 'living', toRoom: 'kitchen', axis: 'x', fixed: 2.4, lo: -0.6, hi: 0.3, sill: 0, head: DOOR_HEAD },
  { id: 'door-hall-bedroom', kind: 'door', room: 'hall', toRoom: 'bedroom', axis: 'z', fixed: 5.2, lo: -0.45, hi: 0.45, sill: 0, head: DOOR_HEAD, swingHi: true, swingOut: true },
  { id: 'open-hall-bath', kind: 'cased', room: 'hall', toRoom: 'bathroom', axis: 'x', fixed: -1.2, lo: 2.6, hi: 3.45, sill: 0, head: DOOR_HEAD },
  { id: 'open-hall-entry', kind: 'cased', room: 'hall', toRoom: 'entry', axis: 'x', fixed: 1.2, lo: 2.6, hi: 3.45, sill: 0, head: DOOR_HEAD },
  // Issue #81: the dining room's two wide cased openings (issue: "an opening
  // wide enough to walk through into the dining room" — both get more than a
  // metre of clear width) and its south window. Neither has a leaf, so
  // neither can be shut and neither parks one (the cased convention the
  // bathroom and entry openings already keep).
  { id: 'door-kitchen-dining', kind: 'cased', room: 'kitchen', toRoom: 'dining', axis: 'z', fixed: 0.6, lo: 2.68, hi: 3.58, sill: 0, head: DOOR_HEAD },
  { id: 'door-living-dining', kind: 'cased', room: 'living', toRoom: 'dining', axis: 'x', fixed: 2.4, lo: 0.8, hi: 2.02, sill: 0, head: DOOR_HEAD },
  { id: 'slider-balcony', kind: 'slider', room: 'living', toRoom: 'balcony', axis: 'z', fixed: -2.9, lo: 0.85, hi: 2.15, sill: 0, head: SLIDER_HEAD },
  { id: 'door-front', kind: 'sealed', room: 'entry', toRoom: 'outside', axis: 'z', fixed: 3.9, lo: 1.32, hi: 2.34, sill: 0, head: DOOR_HEAD },

  { id: 'win-living-n', kind: 'window', room: 'living', axis: 'z', fixed: -2.9, lo: -2.1, hi: -0.3, sill: 0.9, head: 2.1 },
  // Issue #81: `win-living-e` came down — its plaster is the living→dining
  // doorway now, and the dining room's south window below faces the same way.
  { id: 'win-kitchen-n', kind: 'window', room: 'kitchen', axis: 'z', fixed: -2.9, lo: 3.4, hi: 4.9, sill: 0.95, head: 1.75 },
  { id: 'win-bedroom-s', kind: 'window', room: 'bedroom', axis: 'z', fixed: 9.32, lo: -1.9, hi: -0.2, sill: 0.9, head: 2.1 },
  { id: 'win-bath-w', kind: 'window', room: 'bathroom', axis: 'x', fixed: -3.3, lo: 2.6, hi: 3.3, sill: 1.5, head: 2.05 },
  { id: 'win-dining-s', kind: 'window', room: 'dining', axis: 'z', fixed: 4.4, lo: 3.4, hi: 4.35, sill: 0.9, head: 2.1 },
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
  { id: 'hall', room: 'hall', x0: -1.2, z0: 2.22, x1: 1.2, z1: 5.2, finish: 'oak' },
  { id: 'entry', room: 'entry', x0: 1.32, z0: 2.22, x1: 2.72, z1: 3.9, finish: 'tile' },
  { id: 'bathroom', room: 'bathroom', x0: -3.3, z0: 2.22, x1: -1.32, z1: 5.2, finish: 'tile' },
  // Issue #81: the dining floor is the room's L — its NORTH half (the kitchen
  // end, z 0.80 … 2.22) runs the full 2.92 m width and carries the living
  // door's floor; its south half starts at the entry's east band (x 2.84),
  // which cuts the L's notch out of the bounding box. Two rects, one finish,
  // so the tile reads continuous across the step like the room is. (The
  // entry's own floor gained the same 0.32 m.)
  { id: 'dining-n', room: 'dining', x0: 2.6, z0: 0.8, x1: 5.52, z1: 2.22, finish: 'tile' },
  { id: 'dining-s', room: 'dining', x0: 2.84, z0: 2.22, x1: 5.52, z1: 4.4, finish: 'tile' },
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
  // issue #86: the owner's lap while the lap scene runs — the padded band of
  // his thighs (game/full-human-scene.js derives it from the seated build),
  // 16.5 cm of thigh above the cushion top. Pure data like every other
  // support, so `spots-on-supports` holds with the man hidden, too.
  lap: { x0: -2.66, z0: -0.75, x1: -2.3, z1: -0.33, top: 0.615 },
  // issue #82: the yellow heat pad on the south cushion — its own patch at the
  // pad's own top (0.48, the pad is 3 cm of warming), fully inside `cushion`,
  // so the pad cat stands on furniture twice over and the pad never floats.
  heatPad: { x0: -2.93, z0: 0.08, x1: -2.53, z1: 0.63, top: 0.48 },
  sofaBackTop: { x0: -3.28, z0: -1.1, x1: -3.04, z1: 0.9, top: 0.85 },
  // issue #88: the couch's south arm — the arm slab as game/full-living.js
  // draws it (bx(S.x0, 0.08, S.z1 − armW, S.x1, armH, S.z1)), inset a step so
  // the 0.21 m spot capsule lands on the 0.22 m of upholstery, top 0.62.
  couchArmS: { x0: -3.24, z0: 0.75, x1: -2.4, z1: 0.93, top: 0.62 },
  // issue #88: the living bookshelf's own top board (row 41: 0.90 × 0.32 ×
  // 1.90, FOOT.bookshelf) — a cat loafing here leaves his whole back under
  // the 2.5 m ceiling. (The wardrobe top at 2.10 was the other candidate and
  // never got a patch: a sitting cat under the ceiling reads as a squeeze.)
  shelfTop: { x0: -3.24, z0: -2.84, x1: -3.0, z1: -2.02, top: 1.9 },
  coffeeTop: { x0: -1.87, z0: -0.97, x1: -1.33, z1: 0.17, top: 0.45 },
  boxFloor: { x0: -2.3, z0: 1.4, x1: -1.85, z1: 1.75, top: 0.001 },
  tvTop: { x0: 2.0, z0: -2.38, x1: 2.38, z1: -0.87, top: 0.45 },
  // dining room (issue #81) — the round table's top patch, inset a step from
  // the table's edge (the cat's 0.21 m spot capsule has to land ON the wood),
  // centre (4.06, 2.28), diameter 1.05, top 0.75. The old `diningTop` named a
  // breakfast-table support in the living room that no spot ever used; the
  // name moved with the room.
  diningTop: { x0: 3.56, z0: 1.78, x1: 4.56, z1: 2.78, top: 0.75 },
  // issue #82: the four dining chairs' own seats — game/full-dining.js's
  // CHAIRS cardinals (centres 0.55 m off the table, 0.44 × 0.45 footprint),
  // seat top 0.45. Each patch is exactly one drawn chair's seat slab, so a
  // cat drawn to a chair stands on that chair.
  diningSeatN: { x0: 3.84, z0: 1.505, x1: 4.28, z1: 1.955, top: 0.45 },
  diningSeatE: { x0: 4.39, z0: 2.055, x1: 4.83, z1: 2.505, top: 0.45 },
  diningSeatS: { x0: 3.84, z0: 2.605, x1: 4.28, z1: 3.055, top: 0.45 },
  diningSeatW: { x0: 3.29, z0: 2.055, x1: 3.73, z1: 2.505, top: 0.45 },
  // issue #88: the sideboard's own top (game/full-dining.js: sideX 3.6…4.88,
  // sideZ 3.98…4.38, top 0.86) inset a step — the dishes' shelf becomes the
  // cat's shelf, and `every-moment-contact` proves the paws land on the wood.
  sideboardTop: { x0: 3.66, z0: 4.02, x1: 4.82, z1: 4.34, top: 0.86 },
  // issue #88: the delivered parcel box game/full-dining.js draws by the
  // sideboard's east end — four walls, no bottom, the living room box's own
  // trick: Bobo sits on the flat's oak (top 0.001) inside walls that start at
  // 0.02, exactly like SUPPORT_DEFS.boxFloor does for row 60's hero box.
  parcelBoxFloor: { x0: 5.05, z0: 3.93, x1: 5.45, z1: 4.33, top: 0.001 },
  // kitchen
  counterTop: { x0: 2.52, z0: -2.88, x1: 4.93, z1: -2.32, top: 0.9 },
  counterTopW: { x0: 2.54, z0: -2.28, x1: 3.1, z1: -1.07, top: 0.9 },
  // issue #81: the bar stepped 0.44 m east (its old west end stood where the
  // kitchen→dining doorway's jamb now is) and gave up 0.20 m of length
  barTop: { x0: 3.92, z0: 0.22, x1: 5.12, z1: 0.58, top: 1.05 }, // #100: west edge followed the shortened bar (was 3.76 — 0.14 m of it would have floated west of the new top)
  // issue #88: the fridge's own top face (KITCHEN_FRIDGE x 4.92…5.52,
  // z −2.90…−2.20, fridgeH 1.8) inset a step — the warm box's roof, the one
  // place in the kitchen a cat claims for the view over the counter run.
  fridgeTop: { x0: 4.96, z0: -2.86, x1: 5.48, z1: -2.24, top: 1.8 },
  // balcony (docs/CHARACTERS.md: Bobo does go outside)
  chairSeat: { x0: 1.93, z0: -3.87, x1: 2.42, z1: -3.33, top: 0.42 },
  // bathroom — issue #49: the counter grew to its ruler footprint (0.90 ×
  // 0.48), the support is the marble's top face inside that footprint
  vanityTop: { x0: -3.28, z0: 2.24, x1: -2.42, z1: 2.68, top: 0.86 },
  // issue #70: the tub's well floor — FOOT.tub (game/full-bath.js row 56)
  // inset 6 cm past the rim rails, top 0.52 under the 0.55 rim. The laundry-
  // nap cat naps here, behind the gathered shower curtain.
  tubWell: { x0: -3.24, z0: 4.51, x1: -1.76, z1: 5.14, top: 0.52 },
  // issue #49: the lid moved with the toilet to the north wall — the closed
  // lid of the real piece, top 0.425 (no spot uses it yet; it stays honest)
  toiletLid: { x0: -2.0, z0: 2.54, x1: -1.65, z1: 2.87, top: 0.425 },
  // bedroom — the planes issue #48's furniture actually has: coverlet top
  // 0.50 (bedTop), the foot-of-bed fold at 0.58 (blanketTop), the west-
  // flush nightstand at 0.55. deskTop/kbTop/laundryTop are the plan's own
  // rects and are unchanged — the desk strip and the basket did not move.
  bedTop: { x0: -2.48, z0: 7.09, x1: -0.49, z1: 8.64, top: 0.5 },
  blanketTop: { x0: -0.89, z0: 7.16, x1: -0.63, z1: 8.57, top: 0.58 },
  nightstandTop: { x0: -2.58, z0: 6.57, x1: -2.17, z1: 7.03, top: 0.55 },
  deskTop: { x0: -2.53, z0: 5.34, x1: -1.17, z1: 6.0, top: 0.75 },
  // issue #82: the desk chair's own cushion (game/full-bedroom.js's
  // chair-seat + chair-cushion, 0.40 × 0.38 at top 0.47) — the rolled-up
  // chair by the desk is where a cat naps in a human's seat.
  deskChair: { x0: -2.18, z0: 6.1, x1: -1.78, z1: 6.48, top: 0.47 },
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
