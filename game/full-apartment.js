/*!
 * game/full-apartment.js — the real-size flat, rendered (issue #39).
 *
 * This builder draws game/full-shell.js and nothing else: every plaster slab,
 * floor and ceiling comes from that file's numbers, so the shell the checks
 * measure and the shell you see are literally the same data (that is the whole
 * point of the split — see the header of game/full-shell.js). Furniture is
 * NOT here yet: COLLIDERS footprints in game/full-level.js are placeholders
 * until the furniture chunk lands. What this file adds on top of the raw shell
 * is the things a shell still needs to read as a room: floor finishes, door
 * leaves and casings, glass, sills, baseboards, the balcony railing, sky
 * outside the windows, and the light rig.
 *
 * Layout conventions live in game/full-shell.js (y 0 = finish floor, wall
 * tops 0.20 m above the ceiling, band thicknesses from BAND_T). The rig:
 *   sun  — one shadow-casting light, positioned outside the flat's north
 *          window line so the living room's light patch arrives THROUGH the
 *          glass (docs/ISSUE_33_REBUILD.md §5; the engine's sun-through-window
 *          check re-proves z < WALL_Z and y > 2);
 *   hemi — the free sky/ground wash (the budget only counts punctual lights);
 *   4 point fills, one per dark zone (kitchen, hall+entry, bedroom, bathroom)
 *          — 5 punctual lights total, inside the `realLights <= 6` budget.
 */
import * as THREE from 'three';
import { TOKENS } from '../src/tokens.js';
import { floorMap, floorRough, skyMap } from '../src/textures.js';
import { slabAABB } from '../src/reach.js';
import { SURFACES, surface, worldUV } from '../src/polish.js';
import {
  WALL_H,
  CEIL_Y,
  LEAF_W,
  LEAF_H,
  DOOR_HEAD,
  JAMB_INSET,
  SLIDER_HEAD,
  BAND_T,
  ROOMS,
  ROOM_BY_ID,
  WALL_DEFS,
  OPENINGS,
  FLOORS,
  STRUCTURE,
  CEILINGS,
  SUPPORT_DEFS,
} from './full-shell.js';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, seg = 18) => new THREE.CylinderGeometry(rt, rb, h, seg);

/** Same trick as src/room.js: bake transforms into merged, per-material
 *  buffers, so the whole flat's plaster costs one draw per material. (Its
 *  helper is module-private; this is the compact copy the old builder used.)
 *  UVs are RE-BAKED from world position at the density each material asks for
 *  (src/polish.js `worldUV`) — that is what lets a merged wall show plaster
 *  grain at a constant scale instead of one stretched texel. */
function mergedMesh(parent, entries, { cast = true, receive = true } = {}) {
  const _x = new THREE.Object3D();
  const byMat = new Map();
  for (const e of entries) {
    const g = e.geo.index ? e.geo.toNonIndexed() : e.geo.clone();
    _x.position.set(...(e.at ?? [0, 0, 0]));
    _x.rotation.set(...(e.rot ?? [0, 0, 0]));
    _x.scale.set(...(e.scale ?? [1, 1, 1]));
    _x.updateMatrix();
    g.applyMatrix4(_x.matrix);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!e.keepUV) worldUV(g, e.mat.userData?.uvTile ?? 0.6);
    if (!byMat.has(e.mat)) byMat.set(e.mat, []);
    byMat.get(e.mat).push(g);
  }
  const out = [];
  for (const [mat, geos] of byMat) {
    let count = 0;
    for (const g of geos) count += g.attributes.position.count;
    const pos = new Float32Array(count * 3);
    const nor = new Float32Array(count * 3);
    const uvs = new Float32Array(count * 2);
    let o = 0;
    for (const g of geos) {
      const n = g.attributes.position.count;
      pos.set(g.attributes.position.array.subarray(0, n * 3), o * 3);
      if (g.attributes.normal) nor.set(g.attributes.normal.array.subarray(0, n * 3), o * 3);
      if (g.attributes.uv) uvs.set(g.attributes.uv.array.subarray(0, n * 2), o * 2);
      o += n;
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    bg.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    bg.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    const m = new THREE.Mesh(bg, mat);
    m.castShadow = cast;
    m.receiveShadow = receive;
    parent.add(m);
    out.push(m);
  }
  return out;
}

/** A shell slab definition (w/h/d/x/y/z, straight from full-shell.js) as a
 *  merged box entry. The boxes the checks measure are the boxes drawn. */
const slabEntry = (def, mat) => ({ geo: box(def.w, def.h, def.d), mat, at: [def.x, def.y, def.z] });

/** An opening's wall band: which side of its `fixed` face the plaster sits on,
 *  and the band's outer face. The side is whichever room face the opening sits
 *  in (bands are always OUTSIDE the room's interior face); the thickness is
 *  whatever the piers framing THIS opening are — the living room's east line
 *  is 0.12 in front of the kitchen doorway and 0.20 where the window is, so
 *  matching a pier has to overlap the opening's own span, not just its band. */
function openingBand(o) {
  const room = ROOM_BY_ID[o.room];
  const [bandLoKey, bandHiKey] = o.axis === 'z' ? ['z0', 'z1'] : ['x0', 'x1'];
  const [runLoKey, runHiKey] = o.axis === 'z' ? ['x0', 'x1'] : ['z0', 'z1'];
  const sign = o.fixed === room[bandLoKey] ? -1 : 1;
  const frame = WALL_DEFS.find(
    (d) =>
      d.axis === o.axis &&
      (d[bandLoKey] === o.fixed || d[bandHiKey] === o.fixed) &&
      d[runLoKey] < o.hi - 0.01 &&
      d[runHiKey] > o.lo + 0.01,
  );
  const t = BAND_T[frame ? frame.kind : 'wall-ext'];
  const b0 = sign < 0 ? o.fixed - t : o.fixed;
  const b1 = sign < 0 ? o.fixed : o.fixed + t;
  return { sign, t, b0, b1 };
}

/** The structural gap an opening punches through its band: the clear width
 *  plus the casing inset each side for the door-like kinds (the casing is
 *  what fills it visually — game/full-shell.js header), and the clear width
 *  itself for windows (jambs flush) and the shut front door. */
function gapSpan(o) {
  const inset = o.kind === 'window' || o.kind === 'sealed' ? 0 : JAMB_INSET;
  return [o.lo - inset, o.hi + inset];
}

/* -------------------------------------------------------------------------- *
 *  Materials. Floors and plaster carry a `uvTile` (metres per texture tile)
 *  so merged geometry gets world-scaled UVs; the baked `repeat` on the shared
 *  canvases would multiply on top of that, so every map that goes onto merged
 *  geometry is cloned to repeat [1,1] first.
 * -------------------------------------------------------------------------- */

/** Clone a shared canvas texture for one merged material, reset to 1:1 so
 *  only `uvTile` decides the world density. */
function tile1(t) {
  const c = t.clone();
  c.needsUpdate = true;
  c.repeat.set(1, 1);
  return c;
}

/** Oak floorboards: one texture tile (four planks) per 1.6 m, the density the
 *  old builder got from `oakAt()`'s hand-set repeats. */
function oakFloor() {
  return surface(TOKENS.oakFloor, {
    uvTile: 1.6,
    roughness: 0.55,
    map: tile1(floorMap),
    roughnessMap: tile1(floorRough),
  });
}

/** Balcony slab: bare weathered concrete, no map — the polish grain is enough
 *  at the scale you actually see it (a metre of ledge under a chair). */
function concreteFloor() {
  return surface(0x9a948a, { uvTile: 2.4, roughness: 0.94 });
}

/** Painted trim: baseboards, door casings, sills. Slightly warmer than the
 *  plaster so relief reads against the wall, glossier so it catches light. */
function trimPaint() {
  return surface(0xf2eee5, { uvTile: 0.8, roughness: 0.6 });
}

/** Window glass: cheap transparent standard material, `depthWrite: false` so
 *  the sky and the room never fight through the same pane. */
function glassMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xdfeaf2,
    transparent: true,
    opacity: 0.22,
    roughness: 0.08,
    metalness: 0.1,
    depthWrite: false,
  });
}

/** What every window looks out on: the flat, tone-mapping-exempt sky, so the
 *  sunlit opening stays bright without turning the room into a white box
 *  (same material src/room.js proved the look with). */
function skyMaterial() {
  return new THREE.MeshBasicMaterial({ map: skyMap, toneMapped: false, side: THREE.DoubleSide });
}

/* -------------------------------------------------------------------------- *
 *  The builder.
 * -------------------------------------------------------------------------- */

/** The flat's north wall line, interior face: the living room's z0. The rig
 *  hangs off it, and the engine reads it as `living.WALL_Z` (the
 *  sun-through-window check asks the sun sits north of THIS number). */
const LIVING = ROOM_BY_ID.living;
const WALL_Z = LIVING.z0; // -2.9

/** Build the real-size shell into `scene`.
 *  Returns { living, supports, wallBoxes, pen } in the shape bootGame reads:
 *  `living.sun`, `living.WALL_Z`, `supports` as name -> surface y, and every
 *  plaster/ceiling slab as an AABB for the camera-gap and sight-line checks. */
export function buildFullApartment(scene) {
  const flat = new THREE.Group();
  scene.add(flat);

  const plaster = SURFACES.plaster(); // float texture + grain: lit walls stop being one flat value
  const metal = SURFACES.metal(); // brushed streaks in colour AND roughness
  const walnut = SURFACES.wood(); // door leaves read as wood at arm's length
  const trim = trimPaint();
  const oak = oakFloor();
  const kitchenTile = SURFACES.kitchenTile();
  const bathTile = SURFACES.bathTile();
  const concrete = concreteFloor();
  const glass = glassMaterial();
  const sky = skyMaterial();

  // ── plaster: every opaque slab in the flat, walls and ceilings together ──
  // Piers come from WALL_DEFS (including the balcony parapets, which ARE
  // plaster for the camera-gap check), ceilings from CEILINGS. One merged
  // mesh, one draw call; `wallBoxes` below is the same data as AABBs.
  mergedMesh(flat, [...WALL_DEFS, ...CEILINGS].map((d) => slabEntry(d, plaster)), {
    cast: true,
    receive: true,
  });

  // ── floors: one merged mesh per finish, top face exactly y 0 ─────────────
  // full-shell.js says a room's floor is its walkable plane; a floor slab
  // that poked above 0 would put every cat's contact probe under the boards.
  // Kitchen tile and entry tile share one material — the two rooms are the
  // same large-format porcelain — while the bathroom gets its small tile.
  const floorFinish = new Map([
    ['living', oak],
    ['hall', oak],
    ['bedroom', oak],
    ['kitchen', kitchenTile],
    ['entry', kitchenTile],
    ['bathroom', bathTile],
    ['balcony', concrete],
  ]);
  const byFinish = new Map();
  for (const f of FLOORS) {
    const mat = floorFinish.get(f.room);
    if (!byFinish.has(mat)) byFinish.set(mat, []);
    byFinish.get(mat).push({
      geo: box(f.x1 - f.x0, 0.05, f.z1 - f.z0),
      mat,
      at: [(f.x0 + f.x1) / 2, -0.025, (f.z0 + f.z1) / 2],
    });
  }
  for (const entries of byFinish.values()) mergedMesh(flat, entries, { cast: false, receive: true });

  // ── the structural slab, and a stone saddle in every doorway band ────────
  // The slab (STRUCTURE) closes the floor under the wall bands and the
  // service void. Its drawn top sits 2 cm below the finish floor: exactly
  // coplanar tops would z-fight along every room edge, and a hair of shade in
  // a band you only ever see through a doorway is the honest fix. The saddles
  // bring the walkable y 0 across each band (that is what the bridging walk
  // rectangles stand on), so only the saddles reach y 0 over band footprints.
  mergedMesh(
    flat,
    [
      {
        geo: box(STRUCTURE.x1 - STRUCTURE.x0, 0.18, STRUCTURE.z1 - STRUCTURE.z0),
        mat: concrete,
        at: [(STRUCTURE.x0 + STRUCTURE.x1) / 2, -0.11, (STRUCTURE.z0 + STRUCTURE.z1) / 2],
      },
      ...OPENINGS.filter((o) => o.kind !== 'window').map((o) => {
        const b = openingBand(o);
        const [a0, a1] = gapSpan(o);
        return o.axis === 'z'
          ? { geo: box(a1 - a0, 0.05, b.b1 - b.b0), mat: concrete, at: [(a0 + a1) / 2, -0.025, (b.b0 + b.b1) / 2] }
          : { geo: box(b.b1 - b.b0, 0.05, a1 - a0), mat: concrete, at: [(b.b0 + b.b1) / 2, -0.025, (a0 + a1) / 2] };
      }),
    ],
    { cast: false, receive: true },
  );

  // ── the openings: casings, leaves, glass, sills, and the sky beyond ──────
  // Every piece here is relief modelling derived from OPENINGS — the plaster
  // gap is already exactly right, so casings merely fill the 0.08 m casing
  // inset (2 cm shy of the walk rectangle's edge: trim the camera could
  // graze is trim the camera-gap check can't see) and frame the hole.
  const casings = [];
  const trimBoards = [];
  const leafBoards = []; // walnut: door leaves
  const hardware = []; // metal: knobs, slider frames
  const frameBoards = []; // trim-painted: window frames
  const sillBoards = [];
  const panes = [];
  const skyPlanes = [];

  /** A world-aligned box from a run interval, a band interval and a y span,
   *  laid out for which axis the band's thickness runs along. */
  const bb = (axis, r0, r1, b0, b1, y0, y1) =>
    axis === 'z'
      ? { geo: box(r1 - r0, y1 - y0, b1 - b0), at: [(r0 + r1) / 2, (y0 + y1) / 2, (b0 + b1) / 2] }
      : { geo: box(b1 - b0, y1 - y0, r1 - r0), at: [(b0 + b1) / 2, (y0 + y1) / 2, (r0 + r1) / 2] };

  for (const o of OPENINGS) {
    const b = openingBand(o);
    const [a0, a1] = gapSpan(o);
    const mid = (b.b0 + b.b1) / 2;
    const faceIn = o.fixed; // the room's plaster face at this band
    const faceOut = b.sign < 0 ? b.b0 : b.b1;

    if (o.kind === 'window') {
      // glass mid-band, a plain ring + one mullion, and a sill board whose
      // top lands exactly on the sill height the ruler's row measures.
      panes.push(bb(o.axis, o.lo, o.hi, mid - 0.006, mid + 0.006, o.sill, o.head));
      const F = 0.05;
      frameBoards.push(
        bb(o.axis, o.lo, o.lo + F, mid - 0.025, mid + 0.025, o.sill, o.head),
        bb(o.axis, o.hi - F, o.hi, mid - 0.025, mid + 0.025, o.sill, o.head),
        bb(o.axis, o.lo, o.hi, mid - 0.025, mid + 0.025, o.sill, o.sill + F),
        bb(o.axis, o.lo, o.hi, mid - 0.025, mid + 0.025, o.head - F, o.head),
        bb(o.axis, (o.lo + o.hi) / 2 - 0.02, (o.lo + o.hi) / 2 + 0.02, mid - 0.02, mid + 0.02, o.sill, o.head),
      );
      const sA = faceIn - b.sign * 0.12; // 12 cm into the room, 1 cm into the band
      const sB = faceIn + b.sign * 0.01;
      const [z0, z1] = [Math.min(sA, sB), Math.max(sA, sB)];
      sillBoards.push(
        o.axis === 'z'
          ? { geo: box(o.hi - o.lo + 0.1, 0.04, z1 - z0), mat: trim, at: [(o.lo + o.hi) / 2, o.sill - 0.02, (z0 + z1) / 2] }
          : { geo: box(z1 - z0, 0.04, o.hi - o.lo + 0.1), mat: trim, at: [(z0 + z1) / 2, o.sill - 0.02, (o.lo + o.hi) / 2] },
      );
      skyPlanes.push({
        pos:
          o.axis === 'z'
            ? [(o.lo + o.hi) / 2, (o.sill + o.head) / 2, faceOut + b.sign * 0.14]
            : [faceOut + b.sign * 0.14, (o.sill + o.head) / 2, (o.lo + o.hi) / 2],
        rotY: o.axis === 'z' ? (b.sign < 0 ? 0 : Math.PI) : b.sign < 0 ? Math.PI / 2 : -Math.PI / 2,
        w: o.hi - o.lo + 1.4,
        h: Math.max(2, o.head - o.sill + 0.9),
      });
      continue;
    }

    // door-like: fill the casing inset (for the sealed front door, up to the
    // leaf's own edge), then a 6 x 2 cm trim frame on both faces.
    const leafLo = o.kind === 'sealed' ? (a0 + a1) / 2 - LEAF_W / 2 : o.lo - 0.02;
    const leafHi = o.kind === 'sealed' ? (a0 + a1) / 2 + LEAF_W / 2 : o.hi + 0.02;
    casings.push(
      bb(o.axis, a0, leafLo, b.b0, b.b1, o.sill, o.head),
      bb(o.axis, leafHi, a1, b.b0, b.b1, o.sill, o.head),
    );
    for (const [f, dir] of [
      [faceIn, -b.sign],
      [faceOut, b.sign],
    ]) {
      const p0 = Math.min(f, f + dir * 0.02);
      const p1 = Math.max(f, f + dir * 0.02);
      trimBoards.push(
        bb(o.axis, a0 - 0.06, a0, p0, p1, o.sill, o.head + 0.06),
        bb(o.axis, a1, a1 + 0.06, p0, p1, o.sill, o.head + 0.06),
        bb(o.axis, a0 - 0.06, a1 + 0.06, p0, p1, o.head, o.head + 0.06),
      );
    }

    if (o.kind === 'door') {
      // the leaf stays OPEN, swung flat against the room-side plaster — this
      // flat has no door you can shut (issue #31's lesson, game/full-shell.js)
      const c = faceIn - b.sign * 0.05;
      leafBoards.push(bb(o.axis, o.lo + 0.02, o.lo + 0.02 + LEAF_W, c - 0.02, c + 0.02, 0.005, LEAF_H));
      hardware.push({
        geo: cyl(0.02, 0.02, 0.03, 10),
        rot: [Math.PI / 2, 0, 0],
        mat: metal,
        at:
          o.axis === 'z'
            ? [o.hi - 0.06, 1.0, faceIn - b.sign * 0.08]
            : [faceIn - b.sign * 0.08, 1.0, o.hi - 0.06],
      });
    } else if (o.kind === 'sealed') {
      leafBoards.push(bb(o.axis, leafLo, leafHi, mid - 0.025, mid + 0.025, 0.005, LEAF_H));
      hardware.push({
        geo: cyl(0.02, 0.02, 0.03, 10),
        rot: [Math.PI / 2, 0, 0],
        mat: metal,
        at: [leafHi - 0.08, 1.05, faceIn + 0.07],
      });
    } else if (o.kind === 'slider') {
      // one fixed pane across the clear width (the sun and the sky come
      // through it) and the real leaf parked OPEN against the plaster west
      // of the opening — the balcony is entered through a hole that is a
      // leaf-width clear, which is what a stopped slider looks like.
      panes.push(bb(o.axis, o.lo, o.hi, mid - 0.006, mid + 0.006, 0.002, SLIDER_HEAD));
      const c = faceIn - b.sign * 0.06;
      const pr0 = o.lo - 1.13;
      const pr1 = pr0 + 1.3;
      panes.push(bb(o.axis, pr0 + 0.04, pr1 - 0.04, c - 0.008, c + 0.008, 0.03, SLIDER_HEAD - 0.03));
      hardware.push(
        bb(o.axis, pr0, pr0 + 0.04, c - 0.016, c + 0.016, 0.01, SLIDER_HEAD - 0.01),
        bb(o.axis, pr1 - 0.04, pr1, c - 0.016, c + 0.016, 0.01, SLIDER_HEAD - 0.01),
        bb(o.axis, pr0, pr1, c - 0.016, c + 0.016, SLIDER_HEAD - 0.05, SLIDER_HEAD - 0.01),
        bb(o.axis, o.lo, o.lo + 0.04, mid - 0.02, mid + 0.02, 0, SLIDER_HEAD),
        bb(o.axis, o.hi - 0.04, o.hi, mid - 0.02, mid + 0.02, 0, SLIDER_HEAD),
        bb(o.axis, o.lo, o.hi, mid - 0.02, mid + 0.02, SLIDER_HEAD - 0.04, SLIDER_HEAD),
      );
    }
  }

  // the sky the flat has windows for: one plane per window outside its own
  // wall, and three big ones beyond the balcony's parapets (the VIEWS.balcony
  // camera looks east at the chair, so the "city" has to exist that way too).
  for (const s of [
    ...skyPlanes,
    { pos: [1.5, 2.2, -5.02], rotY: 0, w: 9, h: 6 }, // beyond the far parapet
    { pos: [3.1, 2.2, -3.8], rotY: -Math.PI / 2, w: 7, h: 6 }, // east
    { pos: [-0.2, 2.2, -3.8], rotY: Math.PI / 2, w: 6, h: 6 }, // west
  ]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), sky);
    m.position.set(...s.pos);
    m.rotation.y = s.rotY;
    m.castShadow = false;
    m.receiveShadow = false;
    m.userData.tag = 'sky';
    flat.add(m);
  }

  mergedMesh(flat, casings.map((e) => ({ ...e, mat: trim })));
  mergedMesh(flat, trimBoards.map((e) => ({ ...e, mat: trim })), { cast: false });
  mergedMesh(flat, frameBoards.map((e) => ({ ...e, mat: trim })), { cast: false });
  mergedMesh(flat, sillBoards, { cast: false });
  mergedMesh(flat, leafBoards.map((e) => ({ ...e, mat: walnut })));
  mergedMesh(flat, hardware.map((e) => ({ ...e, mat: e.mat ?? metal })));
  mergedMesh(flat, panes.map((e) => ({ ...e, mat: glass })), { cast: false, receive: false });

  // ── baseboards: 10 cm tall, 1.8 cm off the plaster, every interior room ──
  // Generated from the same data instead of typed: a face gets a board when
  // some pier's face lies on it; door-like openings (including the sealed
  // front door and the slider) break the run where the door TRIM ends, since
  // the trim frame is the trim there; windows do not break it — in every real
  // flat the baseboard runs on under the window. Outdoor rooms get none.
  // The 1.8 cm proud is comfortably inside the walk rectangles' 8 cm inset,
  // so no board is ever a corner the camera-gap check can graze.
  const boards = [];
  for (const room of ROOMS) {
    if (room.outdoor) continue;
    for (const [axis, faceKey] of [
      ['z', 'z0'],
      ['z', 'z1'],
      ['x', 'x0'],
      ['x', 'x1'],
    ]) {
      const face = room[faceKey];
      const [bandKeyLo, bandKeyHi] = axis === 'z' ? ['z0', 'z1'] : ['x0', 'x1'];
      if (!WALL_DEFS.some((d) => d.axis === axis && (d[bandKeyLo] === face || d[bandKeyHi] === face))) continue;
      const [rKey0, rKey1] = axis === 'z' ? ['x0', 'x1'] : ['z0', 'z1'];
      const breaks = OPENINGS.filter((o) => {
        if (o.kind === 'window') return false;
        const b = openingBand(o);
        return o.axis === axis && (b.b0 === face || b.b1 === face);
      }).map((o) => {
        const [a0, a1] = gapSpan(o);
        return [a0 - 0.06, a1 + 0.06];
      });
      const inward = faceKey.endsWith('0') ? 1 : -1;
      let cursor = room[rKey0];
      const pieces = [];
      for (const [g0, g1] of breaks.sort((p, q) => p[0] - q[0])) {
        if (g0 > cursor + 0.02) pieces.push([cursor, Math.min(g0, room[rKey1])]);
        cursor = Math.max(cursor, g1);
      }
      if (cursor < room[rKey1] - 0.02) pieces.push([cursor, room[rKey1]]);
      for (const [p0, p1] of pieces) {
        if (p1 - p0 < 0.05) continue;
        boards.push(
          axis === 'z'
            ? { geo: box(p1 - p0, 0.1, 0.018), at: [(p0 + p1) / 2, 0.05, face + inward * 0.009] }
            : { geo: box(0.018, 0.1, p1 - p0), at: [face + inward * 0.009, 0.05, (p0 + p1) / 2] },
        );
      }
    }
  }
  mergedMesh(flat, boards.map((e) => ({ ...e, mat: trim })), { cast: false });

  // ── the balcony railing: a collider-mesh, deliberately not plaster ───────
  // full-shell.js explains why the railing lives outside wallBoxes (you see
  // THROUGH a railing; the gap test must not be told it is a wall). Posts
  // stand on the slab against the far parapet's inner face, inside the
  // balcony-railing footprint in game/full-level.js, top at 1.13 m: a
  // parapet-and-rail barrier you cannot step, and the VIEWS.balcony camera
  // sees it from the chair end.
  const rail = [];
  const RZ = -4.365; // mid-plane of the posts, off the parapet's inner face
  for (let x = 0.565; x <= 2.44; x += 0.374) {
    rail.push({ geo: box(0.03, 1.08, 0.03), mat: metal, at: [x, 0.54, RZ] });
  }
  rail.push(
    { geo: box(1.92, 0.05, 0.05), mat: metal, at: [1.5, 1.105, RZ] },
    { geo: box(1.9, 0.03, 0.03), mat: metal, at: [1.5, 0.78, RZ] },
    { geo: box(1.9, 0.03, 0.03), mat: metal, at: [1.5, 0.36, RZ] },
  );
  mergedMesh(flat, rail);

  // ── the pen: the one prop with a script (game/full.js moves it) ──────────
  // Built standing at the bedroom desk; the desk-pen moment re-places it
  // every find frame, so where it rests is exactly where resetPen puts it.
  const penRoot = new THREE.Group();
  const penBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.16, 10),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(TOKENS.uiCoral), roughness: 0.45 }),
  );
  const penTip = new THREE.Mesh(
    new THREE.ConeGeometry(0.011, 0.03, 10),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(TOKENS.uiInk), roughness: 0.5 }),
  );
  penTip.position.y = 0.095;
  penBody.castShadow = true;
  penTip.castShadow = true;
  penBody.add(penTip);
  penRoot.add(penBody);
  penRoot.position.set(-1.85, 0.83, 5.67);
  penRoot.rotation.x = Math.PI / 2; // build pose: lying down (resetPen rights it)
  flat.add(penRoot);


  // ── the rig: sun outside the north windows, sky wash, four fills ─────────
  const hemi = new THREE.HemisphereLight(0xcfe4f5, 0x6b5a48, 0.55);
  hemi.position.set(0, CEIL_Y, 0);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff2df, 2.8);
  sun.position.set(-4.0, 8.6, -15.0); // high, west, NORTH of the window wall
  sun.target.position.set(1.2, 0.3, 3.0); // raking south into the living room
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -9;
  sun.shadow.camera.right = 9;
  sun.shadow.camera.top = 9;
  sun.shadow.camera.bottom = -9;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 40;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  // One warm fill per dark zone. The living room and the balcony get daylight
  // through real openings, so they get none — a room that is bright in an
  // empty corner is the tell this rig exists to avoid. decay 2 + a distance
  // roughly the room's diagonal: light that stops at its own room.
  const fills = [
    { at: [4.0, 2.34, -1.1], color: 0xffe6c4, i: 5.0, d: 7.0 }, // kitchen run + aisle
    { at: [0.0, 2.34, 3.6], color: 0xffe6c4, i: 4.0, d: 6.0 }, // hall, spilling into the entry
    { at: [-0.7, 2.34, 7.3], color: 0xffdcc0, i: 5.0, d: 7.5 }, // bedroom
    { at: [-2.1, 2.34, 3.0], color: 0xf0e8f0, i: 3.2, d: 5.0 }, // bathroom (cooler: a different fixture)
  ].map((f) => {
    const p = new THREE.PointLight(f.color, f.i, f.d, 2);
    p.position.set(...f.at);
    p.castShadow = false;
    scene.add(p);
    return p;
  });

  // ── what the engine and the checks get back ──────────────────────────────
  // supports: name -> world y, straight off the ruler table. No furniture is
  // drawn for them yet (that is the next chunk), but the tops are the data's,
  // so a cat staged on 'counterTop' already sits at the measured 0.90.
  const supports = Object.fromEntries(Object.entries(SUPPORT_DEFS).map(([name, s]) => [name, s.top]));

  return {
    living: { sun, WALL_Z, SUPPORTS: supports },
    supports,
    lights: { hemi, sun, fills },
    pen: { root: penRoot, barrel: penBody },
    // every plaster slab (walls, parapets, ceilings) as an AABB, from the
    // definitions that were actually built (src/reach.js measures the walls
    // you can actually see — floors are not walls and are deliberately out)
    wallBoxes: [...WALL_DEFS, ...CEILINGS].map((d) => slabAABB(d, d.id)),
  };
}
