// Tiny collision world for the slice (step 6): an axis-aligned walkable
// union of rects, AABB furniture that pushes you out, and circles (cats)
// that push you out. No physics engine; the player is a point with a
// push radius, moved axis-by-axis so sliding along walls is free.

export function createWorld({ rects, colliders = [], radius = 0.3 }) {
  const inRect = (x, z, r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
  const insideAny = (x, z) => rects.some((r) => inRect(x, z, r));

  // Push a point out of the nearest AABB face (pad = player radius).
  function outOfBox(x, z, box, pad) {
    const x0 = box.x0 - pad;
    const x1 = box.x1 + pad;
    const z0 = box.z0 - pad;
    const z1 = box.z1 + pad;
    if (x <= x0 || x >= x1 || z <= z0 || z >= z1) return null;
    const penL = x - x0;
    const penR = x1 - x;
    const penT = z - z0;
    const penB = z1 - z;
    const m = Math.min(penL, penR, penT, penB);
    if (m === penL) return { x: x0, z };
    if (m === penR) return { x: x1, z };
    if (m === penT) return { x, z: z0 };
    return { x, z: z1 };
  }

  return {
    radius,
    inside: insideAny,

    // Axis-separated move within the walkable union. Returns whether each
    // axis moved so the caller can tell wall contact (head-bob cadence
    // uses ground speed, not intent, so this is informational only).
    move(pos, dx, dz) {
      let movedX = false;
      let movedZ = false;
      if (dx !== 0 && insideAny(pos.x + dx, pos.z)) {
        pos.x += dx;
        movedX = true;
      }
      if (dz !== 0 && insideAny(pos.x, pos.z + dz)) {
        pos.z += dz;
        movedZ = true;
      }
      return { movedX, movedZ };
    },

    // Furniture and cat bodies shove the player out (doors/windows are
    // openings — absent from the collider list, so they never push).
    resolve(pos, circles = []) {
      for (const box of colliders) {
        const fix = outOfBox(pos.x, pos.z, box, radius);
        if (fix) {
          pos.x = fix.x;
          pos.z = fix.z;
        }
      }
      for (const c of circles) {
        const dx = pos.x - c.x;
        const dz = pos.z - c.z;
        const rr = radius + c.r;
        const d2 = dx * dx + dz * dz;
        if (d2 > rr * rr || d2 === 0) continue;
        const d = Math.sqrt(d2);
        pos.x = c.x + (dx / d) * rr;
        pos.z = c.z + (dz / d) * rr;
      }
      if (!insideAny(pos.x, pos.z)) {
        // Safety net: a push-out must never leave the walkable union.
        // Furniture never touches a wall by layout, so this only fires if
        // level data contradicts itself — keep the last good position.
        return false;
      }
      return true;
    },
  };
}
