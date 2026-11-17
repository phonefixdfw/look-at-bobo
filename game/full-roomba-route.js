// game/full-roomba-route.js — the robot vacuum's loop, as pure data (issue #85).
//
// The vacuum trundles a closed circuit through the open half of the flat —
// living, hall, kitchen, dining — and Bobo sometimes rides it. Everything the
// engine, the mesh and the checks need is a PURE function of the run seed:
// build the route once at boot with the seed, and `roombaAt(route, s)` answers
// position/heading for any distance travelled, forward or back, forever. No
// Math.random, no Date.now, no accumulated state — a seek to the same metre
// lands the same robot twice, which is what the determinism rows demand.
//
// The route is planned on a coarse walk grid derived from the SAME data the
// player's grid uses (WALK_RECTS, COLLIDERS in game/full-level.js), with two
// differences: the vacuum is smaller than a person, so it clips corners a
// body cannot (ROOMBA.wallClr off plaster, ROOMBA.collMargin off furniture),
// and it only ever serves the open rooms — the bedroom, bathroom, entry and
// balcony doorways are not just off-limits as targets, their rects are not
// walkable for it at all, so a planned route cannot graze a bathroom jamb.
//
// Waypoints (stations) live in room interiors, never inside a doorway rect —
// the route may CROSS a doorway to change rooms but never dwells or turns in
// one. Between stations a plain BFS shortest path threads the furniture; a
// seeded shuffle of the station order picks a different circuit per run.

import { WALK_RECTS, COLLIDERS } from './full-level.js';

/** The one spec sheet. speed is the aimable-cat tempo (docs: 0.18 m/s is the
 *  speed a moving Bobo stays catchable at); radius/wallClr/collMargin are the
 *  vacuum's clearance contract; chance is the ride roll (~1 run in 6, and
 *  engine.js derives it from this module so play and checks cannot drift). */
export const ROOMBA = {
  speed: 0.18, // m/s along the route
  radius: 0.15, // the disc it drives (mesh matches: body r 0.14 + bumper r 0.15)
  wallClr: 0.16, // centre-line clearance off a walk-rect edge (plaster)
  collMargin: 0.25, // centre-line clearance off a furniture footprint
  cell: 0.25, // planning grid, metres
  chance: 1 / 6, // per-run ride roll
  seedTag: 'roomba-ride', // stream tag, mirrors PATRIOT.seedTag
  spotId: 'roomba-ride', // the synthetic spot id while Bobo rides
};

/** The rooms the circuit serves. Doorway rects tagged with one of these are
 *  legal passages; every other rect (bedroom, bathroom, entry, balcony and
 *  the doorways into them) is not walkable for the vacuum at all. */
const ROUTE_ROOMS = new Set(['living', 'hall', 'kitchen', 'dining']);
const PASSAGE_IDS = new Set([
  'door-living-hall', 'door-living-kitchen', 'door-kitchen-dining', 'door-living-dining',
]);

// ---------------------------------------------------------------------------
// The little deterministic helpers (same algorithms as engine.js, kept local
// like full-street-mesh keeps its helpers — this module must import nothing
// but the level data).
// ---------------------------------------------------------------------------
function hashId(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// The grid.
// ---------------------------------------------------------------------------
/** Cell centres inside the union of the walk rects the vacuum may use, with
 *  ROOMBA.wallClr of walkable floor all around (checked as a box of sample
 *  points, not a per-rect shrink — the rects OVERLAP at the doorways, and a
 *  per-rect shrink would cut the route off at every seam), and
 *  ROOMBA.collMargin clear of every furniture footprint. */
function isFree(x, z) {
  if (!walkUnion(x, z)) return false;
  const d = ROOMBA.wallClr * 0.7; // diagonal sample offset (~radius on the diagonal)
  for (const [ox, oz] of [[ROOMBA.wallClr, 0], [-ROOMBA.wallClr, 0], [0, ROOMBA.wallClr], [0, -ROOMBA.wallClr], [d, d], [d, -d], [-d, d], [-d, -d]]) {
    if (!walkUnion(x + ox, z + oz)) return false;
  }
  for (const c of COLLIDERS) {
    if (x > c.x0 - ROOMBA.collMargin && x < c.x1 + ROOMBA.collMargin
      && z > c.z0 - ROOMBA.collMargin && z < c.z1 + ROOMBA.collMargin) return false;
  }
  return true;
}
function walkUnion(x, z) {
  for (const r of WALK_RECTS) {
    if (!isWalkRect(r)) continue;
    if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return true;
  }
  return false;
}
function isWalkRect(r) {
  if (ROUTE_ROOMS.has(r.room) && !r.id.startsWith('door')) return true; // room floor / hall strip
  return PASSAGE_IDS.has(r.id); // and only the passages between served rooms
}

const X0 = -3.22; // living's west inset — the grid frame's origin
const Z0 = -2.82;
const CELL = ROOMBA.cell;

function colOf(x) { return Math.round((x - X0) / CELL); }
function rowOf(z) { return Math.round((z - Z0) / CELL); }
function xOf(col) { return X0 + col * CELL; }
function zOf(row) { return Z0 + row * CELL; }

/** Grid bounds: every walk rect, covered generously (the flat is ~9×13 m). */
const COLS = Math.ceil((5.52 - X0) / CELL) + 1;
const ROWS = Math.ceil((9.32 - Z0) / CELL) + 1;

/** The nearest free cell to a point, spiral-searched. Stations use it to
 *  settle onto the robot's grid; returns null only if nothing free is near. */
function nearestFree(x, z, maxRings = 8) {
  const c0 = colOf(x);
  const r0 = rowOf(z);
  for (let ring = 0; ring <= maxRings; ring++) {
    for (let dc = -ring; dc <= ring; dc++) {
      for (let dr = -ring; dr <= ring; dr++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== ring) continue; // ring edge only
        const c = c0 + dc;
        const r = r0 + dr;
        if (c < 0 || r < 0 || c >= COLS || r >= ROWS) continue;
        if (isFree(xOf(c), zOf(r))) return [c, r];
      }
    }
  }
  return null;
}

/** BFS shortest path (4-connected) between two cells, as cell list. */
function bfsPath(from, to) {
  if (from[0] === to[0] && from[1] === to[1]) return [from];
  const idx = (c, r) => r * COLS + c;
  const prev = new Int32Array(COLS * ROWS).fill(-2); // -2 unvisited, -1 = start
  const q = [idx(from[0], from[1])];
  prev[q[0]] = -1;
  const goal = idx(to[0], to[1]);
  let head = 0;
  let found = false;
  while (head < q.length) {
    const cur = q[head++];
    if (cur === goal) { found = true; break; }
    const c = cur % COLS;
    const r = (cur - c) / COLS;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
      const ni = idx(nc, nr);
      if (prev[ni] !== -2) continue;
      if (!isFree(xOf(nc), zOf(nr))) continue;
      prev[ni] = cur;
      q.push(ni);
    }
  }
  if (!found) return null;
  const cells = [];
  for (let cur = goal; cur !== -1; ) {
    const c = cur % COLS;
    cells.push([c, (cur - c) / COLS]);
    cur = prev[cur];
  }
  cells.push(from);
  return cells.reverse();
}

// ---------------------------------------------------------------------------
// Stations: named places the circuit likes to visit, each inside one served
// room's floor (never a doorway, never the void). The jitter picks one of a
// station's a few standable spots per run, so different runs trundle a
// different loop without ever inventing an illegal waypoint.
// ---------------------------------------------------------------------------
const STATIONS = [
  { id: 'living-sofa', x: -2.2, z: 0.6, room: 'living' },
  { id: 'living-slider', x: 1.4, z: -1.6, room: 'living' },
  { id: 'living-tv', x: -2.6, z: -1.9, room: 'living' },
  { id: 'living-hearth', x: 1.6, z: 1.2, room: 'living' },
  { id: 'hall-north', x: 0.0, z: 3.1, room: 'hall' },
  { id: 'hall-south', x: -0.5, z: 4.7, room: 'hall' },
  { id: 'kitchen-run', x: 4.4, z: -0.6, room: 'kitchen' },
  { id: 'kitchen-bar', x: 3.4, z: -2.2, room: 'kitchen' },
  { id: 'dining-wide', x: 4.6, z: 1.5, room: 'dining' },
  { id: 'dining-south', x: 4.2, z: 3.4, room: 'dining' },
];

/** Which WALK_RECT a station point should settle into first — keeps the
 *  nearest-free spiral from dragging a living-room station through a wall. */
function stationCell(st, rand) {
  const jx = (Math.floor(rand() * 3) - 1) * CELL;
  const jz = (Math.floor(rand() * 3) - 1) * CELL;
  return nearestFree(st.x + jx, st.z + jz) ?? nearestFree(st.x, st.z);
}

// ---------------------------------------------------------------------------
// Route building.
// ---------------------------------------------------------------------------
/**
 * Plan this run's closed circuit.
 * @param {number|string} seed the run seed (engine's SEED)
 * @returns {{seedTag:string, points:{x:number,z:number,station:string|null}[],
 *            segs:{x0:number,z0:number,x1:number,z1:number,d:number,hdg:number,ux:number,uz:number}[],
 *            length:number, stationsVisited:string[]}}
 */
export function buildRoombaRoute(seed) {
  const rand = mulberry32(hashId(`${ROOMBA.seedTag} ${seed}`));
  // A per-run shuffle of the station table; six stops keeps one loop close
  // enough that "the route finishes a whole loop before Bobo rides" is a
  // wait with a shape, not an era. At least one living-room stop is always
  // in the six, and the tour rotates to start there, so a fresh run always
  // opens with the vacuum in the room the player starts in.
  const shuffled = STATIONS.map((s, i) => [s, i, rand()])
    .sort((a, b) => a[2] - b[2] || a[1] - b[1])
    .map(([s]) => s);
  const six = shuffled.slice(0, 6);
  if (!six.some((s) => s.room === 'living')) six[5] = shuffled.find((s) => s.room === 'living');
  const firstLiving = six.findIndex((s) => s.room === 'living');
  const tour = firstLiving > 0
    ? [six[firstLiving], ...six.slice(0, firstLiving), ...six.slice(firstLiving + 1)]
    : six;

  const cells = [];
  const visited = [];
  let prev = null;
  for (const st of tour) {
    const cell = stationCell(st, rand);
    if (!cell) continue; // a station the robot's grid cannot host this run
    if (!prev) { cells.push(cell); visited.push(st.id); prev = cell; continue; }
    const path = bfsPath(prev, cell);
    if (!path) continue; // unreachable this rotation — skip the station
    cells.push(...path.slice(1));
    visited.push(st.id);
    prev = cell;
  }
  // Close the loop back to the first station.
  const home = cells[0];
  const back = bfsPath(prev, home);
  if (back) cells.push(...back.slice(1, -1));

  return sealRoute(cells, visited);
}

/** Turn the cell list into the arc-length polyline: drop run interiors, keep
 *  the corners, then measure. Pure geometry, so the checks can re-run it. */
function sealRoute(cells, stationsVisited) {
  const corners = simplifyCells(cells);
  const points = corners.map(([c, r]) => {
    const x = round3(xOf(c));
    const z = round3(zOf(r));
    return { x, z, station: stationNear(x, z) };
  });
  const segs = [];
  let length = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-6) continue;
    segs.push({
      x0: a.x, z0: a.z, x1: b.x, z1: b.z,
      d, ux: dx / d, uz: dz / d, hdg: Math.atan2(dx, dz),
      d0: length,
    });
    length += d;
  }
  return {
    seedTag: ROOMBA.seedTag,
    points,
    segs,
    length: round3(length),
    stationsVisited: [...new Set(stationsVisited)],
  };
}

/** Maximal straight runs collapse to their endpoints; the loop's shared seam
 *  (last→first) only stays straight when it truly is one line. The first
 *  cell is ALWAYS kept, so metre 0 of every route is this run's living-room
 *  station corner — a vacuum that starts each run in a knowable place. */
function simplifyCells(cells) {
  const n = cells.length;
  if (n < 3) return cells.slice();
  const out = [cells[0]];
  for (let i = 1; i < n; i++) {
    const a = cells[(i - 1 + n) % n];
    const b = cells[i];
    const c = cells[(i + 1) % n];
    const d1x = b[0] - a[0]; const d1z = b[1] - a[1];
    const d2x = c[0] - b[0]; const d2z = c[1] - b[1];
    if (d1x !== d2x || d1z !== d2z) out.push(b); // direction changed → corner
  }
  return out;
}

function stationNear(x, z) {
  for (const st of STATIONS) {
    if (Math.abs(st.x - x) <= CELL && Math.abs(st.z - z) <= CELL) return st.id;
  }
  return null;
}

const round3 = (v) => Math.round(v * 1000) / 1000;

/**
 * Where the vacuum is after travelling `s` metres along its loop. `s` may be
 * any real number: it wraps, forwards and backwards.
 * @returns {{x:number,z:number,heading:number,seg:number,turn:number}}
 *   heading is the mesh yaw convention (atan2(dx, dz), matching catRootYaw's
 *   math); turn is the signed corner angle just passed (for the bumper tilt).
 */
export function roombaAt(route, s) {
  const L = route.length;
  let d = s % L;
  if (d < 0) d += L;
  const segs = route.segs;
  let k = 0;
  while (k + 1 < segs.length && d >= segs[k].d0 + segs[k].d) k++;
  const seg = segs[k];
  const along = d - seg.d0;
  const x = round3(seg.x0 + seg.ux * along);
  const z = round3(seg.z0 + seg.uz * along);
  const prevSeg = segs[(k - 1 + segs.length) % segs.length];
  const cross = prevSeg.ux * seg.uz - prevSeg.uz * seg.ux;
  const dot = prevSeg.ux * seg.ux + prevSeg.uz * seg.uz;
  return { x, z, heading: seg.hdg, seg: k, along: round3(along), turn: round3(Math.atan2(cross, dot)), L };
}

/** The room id the vacuum occupies at metre `s` (its doorway-crossings are
 *  brief by construction — see the doorway-dwell check in game/full.js). */
export function roombaRoomAt(route, s) {
  const { x, z } = roombaAt(route, s);
  for (const r of WALK_RECTS) {
    if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r.room;
  }
  return null;
}
