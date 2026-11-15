// src/reach.js — can the PLAYER BODY actually get where it needs to go?
//
// Why this file exists (issue #27): the old reachability proof walked the
// walk-rect union from a POINT and never subtracted the furniture push boxes,
// so a room could be "connected" on paper while a 0.30 m body could not leave
// it — which is exactly how the bathroom became a trap (the toilet's push pad
// sat on top of the flat's only bathroom doorway). Same class of miss for
// walls: rects inset 2 cm from a wall face, while the camera's near plane is
// 5 cm, so hugging a wall clipped the wall away and you saw through it.
//
// Everything here is plain arithmetic on level data (rects + AABBs) so it runs
// in the page's selfTest, in the harnesses, and in a scratch node script.
// No THREE, no DOM. See docs/LEVEL_LAYOUT.md for the conventions.

const CELL = 0.1; // metres per grid cell — fine enough for a 0.30 m radius

/** A grid cell is standable when its centre is inside the walk-rect union and
 *  outside every collider's push pad (radius) and every wall pad. Walls are
 *  pushed in as boxes so a body never stands inside a wall slab either. */
function buildGrid({ rects, colliders = [], walls = [], radius = 0.3, wallPad = 0 }) {
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (const r of rects) {
    x0 = Math.min(x0, r.x0);
    z0 = Math.min(z0, r.z0);
    x1 = Math.max(x1, r.x1);
    z1 = Math.max(z1, r.z1);
  }
  const cols = Math.ceil((x1 - x0) / CELL);
  const rows = Math.ceil((z1 - z0) / CELL);
  const boxes = [
    ...colliders.map((c) => ({ c: c, pad: radius })),
    ...walls.map((w) => ({ c: w, pad: wallPad })), // walls: flush, no body pad
  ];
  const inBox = (x, z, b, pad) => x > b.c.x0 - pad && x < b.c.x1 + pad && z > b.c.z0 - pad && z < b.c.z1 + pad;

  const free = new Uint8Array(cols * rows); // 1 = a body can stand on this cell
  const owner = new Int16Array(cols * rows).fill(-1); // which walk rect owns the cell
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = x0 + (i + 0.5) * CELL;
      const z = z0 + (j + 0.5) * CELL;
      const r = rects.findIndex((r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1);
      if (r < 0) continue;
      let blocked = false;
      for (const b of boxes) {
        if (inBox(x, z, b, b.pad)) {
          blocked = true;
          break;
        }
      }
      const idx = j * cols + i;
      owner[idx] = r;
      free[idx] = blocked ? 0 : 1;
    }
  }

  const cellAt = (x, z) => {
    const i = Math.floor((x - x0) / CELL);
    const j = Math.floor((z - z0) / CELL);
    if (i < 0 || j < 0 || i >= cols || j >= rows) return -1;
    return j * cols + i;
  };

  return {
    cell: CELL,
    x0,
    z0,
    cols,
    rows,
    free,
    owner,
    cellAt,
    /** Centre of a cell index. */
    centre(idx) {
      const i = idx % cols;
      const j = Math.floor(idx / cols);
      return { x: x0 + (i + 0.5) * CELL, z: z0 + (j + 0.5) * CELL };
    },
    /** A standable cell at or nearest to (x, z) — index, or -1. */
    nearCell(x, z, maxCells = 60) {
      const seed = cellAt(x, z);
      if (seed >= 0 && free[seed]) return seed;
      // spiral outwards by Chebyshev rings until a standable cell shows up
      const si = seed >= 0 ? seed % cols : Math.floor(((x - x0) / CELL) | 0);
      const sj = seed >= 0 ? Math.floor(seed / cols) : Math.floor(((z - z0) / CELL) | 0);
      for (let r = 1; r <= maxCells; r++) {
        for (let dj = -r; dj <= r; dj++) {
          for (let di = -r; di <= r; di++) {
            if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
            const i = si + di;
            const j = sj + dj;
            if (i < 0 || j < 0 || i >= cols || j >= rows) continue;
            if (free[j * cols + i]) return j * cols + i;
          }
        }
      }
      return -1;
    },
    /** 4-connected flood from one cell: who can I get to? */
    flood(from) {
      const seen = new Uint8Array(cols * rows);
      if (from < 0 || !free[from]) return seen;
      const stack = [from];
      seen[from] = 1;
      while (stack.length) {
        const idx = stack.pop();
        const i = idx % cols;
        const j = (idx - i) / cols;
        const push = (n) => {
          if (n >= 0 && n < seen.length && free[n] && !seen[n]) {
            seen[n] = 1;
            stack.push(n);
          }
        };
        if (i > 0) push(idx - 1);
        if (i < cols - 1) push(idx + 1);
        if (j > 0) push(idx - cols);
        if (j < rows - 1) push(idx + cols);
      }
      return seen;
    },
  };
}

/** Shortest standable-cell distance from (x, z) — 999 when nothing is found. */
function nearestStandable(grid, x, z) {
  const idx = grid.nearCell(x, z, Math.max(grid.cols, grid.rows));
  if (idx < 0) return { idx: -1, dist: Infinity, x: 0, z: 0 };
  const c = grid.centre(idx);
  return { idx, dist: Math.hypot(c.x - x, c.z - z), x: c.x, z: c.z };
}

/** Does the straight line from an eye at (ax, ay, az) to (bx, by, bz) miss every
 *  box? Marched in CELL steps, so a wall slab (0.12 m) can never be stepped
 *  over. Used to prove a cat can be SEEN from a cell a body can stand on. */
function lineClear(boxes, ax, ay, az, bx, by, bz, pad = 0.02) {
  const len = Math.hypot(bx - ax, by - ay, bz - az);
  const steps = Math.max(2, Math.ceil(len / (CELL * 0.6)));
  for (const b of boxes) {
    const x0 = b.x0 - pad;
    const x1 = b.x1 + pad;
    const z0 = b.z0 - pad;
    const z1 = b.z1 + pad;
    for (let s = 1; s < steps; s++) {
      const k = s / steps;
      const x = ax + (bx - ax) * k;
      const y = ay + (by - ay) * k;
      const z = az + (bz - az) * k;
      if (x > x0 && x < x1 && z > z0 && z < z1 && y > (b.y0 ?? -Infinity) && y < (b.y1 ?? Infinity)) return false;
    }
  }
  return true;
}

/** Cell offsets within `maxD`, ordered by distance from the centre: the scan
 *  below takes the FIRST legal vantage it can see the cat from, so the order
 *  has to be outward. Built once (≈3.6k entries for a 3.4 m radius) and shared.
 *  Deterministic, like everything else in this file. */
function approachOffsets(maxD) {
  const n = Math.ceil(maxD / CELL);
  const out = [];
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      const d = Math.hypot(i, j) * CELL;
      if (d > maxD + 1e-9) continue;
      out.push({ dx: i * CELL, dz: j * CELL, d });
    }
  }
  out.sort((a, b) => a.d - b.d || a.dx - b.dx || a.dz - b.dz);
  return out;
}

/** Where a player can STAND and still SEE a cat: the nearest reachable cell
 *  whose eye-to-cat line misses every sight-blocking box.
 *  `seen` is the flood result from the player's spawn area. Returns
 *  `{ x, z, dist, dx, dz }` (dx/dz point from the cat to that spot, for the
 *  facing check) or null when no legal standing place has a line on it.
 *
 *  `los` is the full set of wall and furniture boxes; only the ones near this
 *  cat are tested. `aimY` is how high above the cat's own surface the line is
 *  drawn — the top of Bobo's body, so a pose never hides him from it. */
function bestApproach(grid, seen, { x, z, y = 0, aimY = 0.3, eye = 1.62, los = [], minD = 0.9, maxD = 3.4 }) {
  const ty = y + aimY;
  // Only the boxes that could possibly cross a line to this cat, and not the
  // furniture the cat is ON: a cat in a bed, a basket or a box is seen from
  // above its own support, and its own bed would otherwise hide it everywhere.
  const near = los.filter(
    (b) =>
      b.x1 > x - maxD - 0.6 &&
      b.x0 < x + maxD + 0.6 &&
      b.z1 > z - maxD - 0.6 &&
      b.z0 < z + maxD + 0.6 &&
      b.y0 < eye + 0.2 &&
      b.y1 > y &&
      !(x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && ty > b.y0 && ty < b.y1),
  );
  const offsets = approachOffsets(maxD);
  const tx = x;
  const tz = z;
  for (const o of offsets) {
    if (o.d < minD) continue;
    const cx = x + o.dx;
    const cz = z + o.dz;
    const hit = grid.cellAt(cx, cz);
    if (hit < 0 || !grid.free[hit] || !seen[hit]) continue;
    if (!lineClear(near, cx, eye, cz, tx, ty, tz)) continue;
    return { x: cx, z: cz, dist: o.d, dx: o.dx, dz: o.dz, idx: hit };
  }
  return null;
}

/** A plaster slab as built by the apartment builders —
 *  `{ geo: BoxGeometry, at: [x, y, z] }`, or plain `{ w, h, d, x, y, z }` —
 *  turned into the same AABB shape this module uses everywhere. The walls the
 *  reachability checks measure are the walls that get RENDERED: this reads the
 *  builder's own definitions, so the two can never drift apart.
 */
function slabAABB(def, id) {
  const p = def.geo && def.geo.parameters ? def.geo.parameters : def;
  const w = p.width ?? p.w;
  const h = p.height ?? p.h;
  const d = p.depth ?? p.d;
  const at = def.at || [def.x ?? 0, def.y ?? 0, def.z ?? 0];
  return {
    id: id ?? def.id ?? 'wall',
    x0: at[0] - w / 2,
    x1: at[0] + w / 2,
    y0: at[1] - h / 2,
    y1: at[1] + h / 2,
    z0: at[2] - d / 2,
    z1: at[2] + d / 2,
  };
}

const AXES = ['x', 'y', 'z'];
const OTHER = { x: ['y', 'z'], y: ['z', 'x'], z: ['x', 'y'] };

/**
 * The faces of `slab` a camera anywhere in `box` stands in front of, and the
 * gap to each. A camera exactly on a slab's plane extent counts (the walk
 * rect's y extent is a single height: the eye), so the test is conservative.
 * `{ inside: true }` means the box reaches into the slab on all three axes —
 * the camera would be INSIDE the plaster, where every face is behind it.
 */
function faceGaps(box, slab) {
  let banded = 0;
  for (const a of AXES) {
    if (!(box[`${a}1`] <= slab[`${a}0`] + 1e-9) && !(box[`${a}0`] >= slab[`${a}1`] - 1e-9)) banded++;
  }
  if (banded === 3) return { inside: true, gaps: [] };
  const gaps = [];
  for (const a of AXES) {
    for (const side of ['+', '-']) {
      const gap = side === '+' ? box[`${a}0`] - slab[`${a}1`] : slab[`${a}0`] - box[`${a}1`];
      if (gap < -1e-9) continue; // the box is not on this side of this face
      const [b, c] = OTHER[a];
      const overlapB = Math.min(box[`${b}1`], slab[`${b}1`]) - Math.max(box[`${b}0`], slab[`${b}0`]);
      const overlapC = Math.min(box[`${c}1`], slab[`${c}1`]) - Math.max(box[`${c}0`], slab[`${c}0`]);
      if (overlapB < -1e-9 || overlapC < -1e-9) continue; // no wall in front: past the end cap
      gaps.push({ axis: a, side, gap: Math.max(0, gap) });
    }
  }
  return { inside: false, gaps };
}

/**
 * The see-through-wall check, geometrically (issue #27, bug 3).
 *
 * A plaster slab is opaque, single-sided and depth-tested like everything
 * else. The only way to see through it from inside the flat is to get the
 * camera so close to a face that the near plane cuts the face away: through
 * that hole you then see the other side of the flat, because the slab is only
 * 0.12 m thick and both faces go inside the same near plane. Furniture cannot
 * do this — every piece of it is a COLLIDER, and `src/collision.js` keeps the
 * player's centre a full radius (0.3 m) out. Walls are not colliders: the
 * WALK_RECTS are the walls, so the gap they leave is the whole defence.
 *
 * So: sweep every camera position each walk rect allows (at eye height) past
 * every wall face. Anywhere the gap is less than the near plane plus a margin
 * is a hole; anywhere a rect reaches into a slab is a worse one.
 *
 * Doorway rects cross a wall band on purpose — that is the doorway. They are
 * exempt from the axis they cross (their gap on it is negative, so no face is
 * in front of them) and checked against the jamb end caps either side.
 *
 * @returns {{ fails: string[], worst: number, worstCase: string }}
 */
function wallFaceFailures(rects, slabs, { near = 0.05, eye = 1.62, min = near + 0.02 } = {}) {
  const fails = [];
  let worst = Infinity;
  let worstCase = 'no wall within reach';
  for (const r of rects) {
    const box = { x0: r.x0, x1: r.x1, y0: eye, y1: eye, z0: r.z0, z1: r.z1 };
    for (const s of slabs) {
      const { inside, gaps } = faceGaps(box, s);
      if (inside) {
        fails.push(`${r.id} ↔ ${s.id}: the walkable area reaches INTO the plaster`);
        continue;
      }
      for (const g of gaps) {
        const label = `${r.id} ↔ ${s.id} ${g.axis}${g.side}`;
        if (g.gap < worst) {
          worst = g.gap;
          worstCase = label;
        }
        if (g.gap < min - 1e-9) {
          fails.push(`${label}: camera ${g.gap.toFixed(3)} m from the face (near plane ${near}, needs ${min.toFixed(2)})`);
        }
      }
    }
  }
  return { fails, worst, worstCase };
}

/** The tightest gap of all, for a check's value string. */
function worstWallClearance(rects, slabs, { near = 0.05, eye = 1.62 } = {}) {
  return wallFaceFailures(rects, slabs, { near, eye }).worst;
}

export { CELL, buildGrid, nearestStandable, lineClear, bestApproach, slabAABB, faceGaps, wallFaceFailures, worstWallClearance };
