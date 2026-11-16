/** --------------------------------------------------------------------------
 *  Issue #61 — draw the flat a camera could actually be looking at.
 *
 *  Why: three frustum-culls one object at a time, and the flat's objects are
 *  small. A camera in the bedroom with a 45° lens still submits every cabinet
 *  in the kitchen, because the kitchen's bounding boxes reach into the
 *  frustum even though the wall between them never opens that way. The worst
 *  frame of the capture matrix was spending 35 of its draws on rooms three
 *  doorways away.
 *
 *  What it does: work out which room the camera is standing in, keep that
 *  room and anything within `hops` openings of it, and set `visible = false`
 *  on the groups of the rooms further off. Three then prunes them from the
 *  camera pass AND the shadow pass without walking them, and each group's own
 *  children keep the `visible` flags they had — which matters, because the
 *  checks in game/full.js read `object.visible` (their ruler rays skip
 *  invisible meshes) and a room-level switch never touches one.
 *
 *  Two rules keep it honest:
 *
 *   - A group is only ever hidden if its own world box lies inside ONE room.
 *     Anything that straddles a doorway, or sits outside every room rect (the
 *     plaster shell, the sky sheet, the structure), is never hidden: no room
 *     owns it, so no room may take it away.
 *   - A camera outside every room rect sees EVERYTHING. The diorama and the
 *     balcony shots sit beyond the walls, where "the room you are in" says
 *     nothing about what is in frame, so the cull fails open rather than
 *     guess.
 *
 *  `hops` is 2, and 2 is not a rounded-up number: from the living room the
 *  whole flat is within two openings, so the overview camera loses nothing
 *  (which is why this file is half the fix and game/full-merge.js the other
 *  half). One hop would hide the living room from the hall, and the desk view
 *  looks straight down that line — through two doorways, at a room you can
 *  genuinely see. Anything further than two openings away is behind two
 *  frames of wall that do not line up.
 *
 *  What it refuses to touch: everything that was not a child of the apartment
 *  root when it was built. That is how the cast stays drawn — the cats are
 *  added after the flat is, and a cat filed under the room it happened to
 *  spawn in would vanish the moment it walked somewhere its owner was not.
 *
 *  `?cull=off` switches the whole thing off; game/full.js runs its checks
 *  with the cull off, because a ruler ray and the doorway `readPixels` both
 *  want the flat entire. tools/draw-report.mjs --pixels A/B the two, byte for
 *  byte, and a frame where hiding a room moved a pixel is a room that should
 *  not have been hidden.
 * ------------------------------------------------------------------------- */

import * as THREE from 'three';
import { ROOMS, OPENINGS } from './full-shell.js';

/** The rooms each opening connects, as an undirected adjacency table. Only
 *  openings with a room on both ends count: a window looks at the sky, and the
 *  sealed front door looks at a corridor that is not in this flat. */
export function roomAdjacency(openings = OPENINGS) {
  const ids = new Set(ROOMS.map((r) => r.id));
  const next = new Map(ROOMS.map((r) => [r.id, new Set()]));
  for (const o of openings) {
    if (!o.toRoom || !ids.has(o.room) || !ids.has(o.toRoom)) continue;
    next.get(o.room).add(o.toRoom);
    next.get(o.toRoom).add(o.room);
  }
  return next;
}

/** How many openings away every room is from `from` (0 = itself). */
export function hopsFrom(from, adjacency = roomAdjacency()) {
  const dist = new Map([[from, 0]]);
  const queue = [from];
  while (queue.length) {
    const here = queue.shift();
    for (const there of adjacency.get(here) ?? []) {
      if (dist.has(there)) continue;
      dist.set(there, dist.get(here) + 1);
      queue.push(there);
    }
  }
  return dist;
}

/** Precomputed, because there are seven rooms and every camera wants the row. */
const HOP_TABLE = new Map(ROOMS.map((r) => [r.id, hopsFrom(r.id)]));

/** Which room's rect a world point falls in, or null when it falls in none. */
export function roomAt(p, rooms = ROOMS) {
  for (const r of rooms) {
    if (p.x >= r.x0 && p.x <= r.x1 && p.z >= r.z0 && p.z <= r.z1) return r;
  }
  return null;
}

/** Which rooms a world box touches. Several is the interesting answer: it says
 *  no single room owns this object. */
function roomsTouched(box, rooms = ROOMS) {
  const hit = [];
  for (const r of rooms) {
    if (box.max.x >= r.x0 && box.min.x <= r.x1 && box.max.z >= r.z0 && box.min.z <= r.z1) hit.push(r.id);
  }
  return hit;
}

/**
 * File the apartment root's own children by the room they stand in, and hand
 * back the per-frame switch.
 *
 * @param {THREE.Object3D} root the apartment group, fully built
 * @param {{ hops?: number, enabled?: boolean }} opts
 */
export function createRoomCull(root, { hops = 2, enabled = true } = {}) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  /** room id -> the groups that belong to it alone */
  const byRoom = new Map(ROOMS.map((r) => [r.id, []]));
  /** groups no single room owns: never hidden */
  const shared = [];
  for (const child of root.children) {
    box.setFromObject(child);
    if (!Number.isFinite(box.min.x)) { shared.push(child); continue; } // an empty group lights nothing
    const touched = roomsTouched(box);
    if (touched.length === 1) {
      byRoom.get(touched[0]).push(child);
      child.userData.cullRoom = touched[0];
    } else {
      shared.push(child);
      child.userData.cullRoom = touched.length ? `spans:${touched.join(',')}` : 'outside';
    }
  }

  const state = { room: null, hidden: [], shown: 0, groups: byRoom.size, shared: shared.length };
  let on = enabled;

  /** Hand every group back, and remember that the cull is standing down. */
  function showAll() {
    state.room = null;
    state.hidden = [];
    state.shown = 0;
    for (const list of byRoom.values()) for (const g of list) g.visible = true;
    for (const g of shared) g.visible = true;
  }

  return {
    /** Which group stands where, for the boot log and the tools. */
    map: () => Object.fromEntries([...byRoom].map(([id, list]) => [id, list.length])),
    get enabled() { return on; },
    setEnabled(next) {
      on = Boolean(next);
      if (!on) showAll();
      return on;
    },
    /** Last decision, for getStats and the draw report. */
    get state() { return state; },
    /** How many groups no single room owns, so no room can hide them. */
    shared: shared.length,
    showAll,

    /** Call once per frame, before the render. Cheap by construction: a room
     *  lookup, a table row, and a write to the groups whose answer changed. */
    update(camera) {
      if (!on || !camera) { if (!on && state.room !== null) showAll(); return state; }
      const room = roomAt(camera.position);
      if (!room) { if (state.room !== null) showAll(); return state; } // outside the flat: fail open
      const dist = HOP_TABLE.get(room.id);
      state.room = room.id;
      state.hidden = [];
      state.shown = 1;
      for (const [id, list] of byRoom) {
        const near = (dist.get(id) ?? Infinity) <= hops;
        if (!near) state.hidden.push(id);
        for (const g of list) {
          if (g.visible !== near) g.visible = near;
        }
      }
      state.shown = ROOMS.length - state.hidden.length;
      return state;
    },
  };
}
