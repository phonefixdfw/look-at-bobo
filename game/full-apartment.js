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
import { buildFullKitchen } from './full-kitchen-mesh.js';
import { buildFullKitchenDetails } from './full-kitchen-details-mesh.js';
import { buildFullLiving } from './full-living-mesh.js';
import { buildFullBath } from './full-bath-mesh.js';
import { buildFullBedroom } from './full-bedroom-mesh.js';
import { buildFullEntry } from './full-entry-mesh.js';
import { buildFullDining } from './full-dining-mesh.js';
import { buildFullDecor } from './full-decor-mesh.js';
import { mergeStaticMeshes } from './full-merge.js';
import { buildFullStreet } from './full-street-mesh.js';
import { buildFullRoomba } from './full-roomba-mesh.js';
import { buildRoombaRoute, roombaAt, roombaRoomAt, ROOMBA } from './full-roomba-route.js';
import { autoLowQuality } from '../src/touch.js';
import { createRoomCull } from './full-cull.js';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, seg = 18) => new THREE.CylinderGeometry(rt, rb, h, seg);

/** Same trick as src/room.js: bake transforms into merged, per-material
 *  buffers, so the whole flat's plaster costs one draw per material. (Its
 *  helper is module-private; this is the compact copy the old builder used.)
 *  UVs are RE-BAKED from world position at the density each material asks for
 *  (src/polish.js `worldUV`) — that is what lets a merged wall show plaster
 *  grain at a constant scale instead of one stretched texel. */
export function mergedMesh(parent, entries, { cast = true, receive = true } = {}) {
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
export function buildFullApartment(scene, boot = {}) {
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
    ['dining', kitchenTile], // issue #81: the same porcelain, three rooms deep
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
  const leafAabbs = []; // the same leaves as AABBs, for game/full.js's door checks
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

  /** The same box as a plain {x0,x1,y0,y1,z0,z1} AABB, for the door checks. */
  const bbBox = (axis, r0, r1, b0, b1, y0, y1) =>
    axis === 'z'
      ? { x0: r0, x1: r1, z0: b0, z1: b1, y0, y1 }
      : { x0: b0, x1: b1, z0: r0, z1: r1, y0, y1 };

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
      // Issue #83: the living room's street-facing window no longer gets a
      // flat blue sheet — the painted Uptown street (built below) covers the
      // exact rectangle this plane used to paint, from the same z -3.24.
      if (o.id !== 'win-living-n') {
        skyPlanes.push({
          pos:
            o.axis === 'z'
              ? [(o.lo + o.hi) / 2, (o.sill + o.head) / 2, faceOut + b.sign * 0.14]
              : [faceOut + b.sign * 0.14, (o.sill + o.head) / 2, (o.lo + o.hi) / 2],
          rotY: o.axis === 'z' ? (b.sign < 0 ? 0 : Math.PI) : b.sign < 0 ? Math.PI / 2 : -Math.PI / 2,
          w: o.hi - o.lo + 1.4,
          h: Math.max(2, o.head - o.sill + 0.9),
        });
      }
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
      // the leaf stands OPEN at 90 degrees: a thin slab hinged at one jamb and
      // parked flat ALONG the room-side plaster BESIDE the opening, a small gap
      // off the trim, knob on the free edge (issue #31's lesson, game/full-
      // shell.js). Before #65 the run started at the opening's own lo edge, so
      // a 0.86 m leaf stood in front of the 0.90 m hole, 5 cm off the plaster,
      // and photographed as a shut door from the usual approach. Which jamb and
      // which room the leaf lies against is `swingHi`/`swingOut` on the opening
      // (game/full-shell.js); `doors-read-open` proves no leaf touches a walk
      // rectangle and `doorways-read-open` proves the hole shows the room
      // beyond — docs/LEVEL_LAYOUT.md owns the door states.
      const face = o.swingOut ? faceOut : faceIn; // the plaster it lies against
      const inward = o.swingOut ? b.sign : -b.sign; // towards that room
      const c = face + inward * 0.05; // leaf centre 5 cm off the plaster
      const PARK_GAP = 0.02; // small gap off the trim's outer edge
      const r0 = o.swingHi ? a1 + 0.06 + PARK_GAP : a0 - 0.06 - PARK_GAP - LEAF_W;
      const leaf = bb(o.axis, r0, r0 + LEAF_W, c - 0.02, c + 0.02, 0.005, LEAF_H);
      leafBoards.push(leaf);
      leafAabbs.push({ id: o.id, open: true, box: bbBox(o.axis, r0, r0 + LEAF_W, c - 0.02, c + 0.02, 0.005, LEAF_H) });
      hardware.push({
        geo: cyl(0.02, 0.02, 0.03, 10),
        rot: o.axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2],
        mat: metal,
        at:
          o.axis === 'z'
            ? [(o.swingHi ? r0 + LEAF_W - 0.08 : r0 + 0.08), 1.0, c + inward * 0.035]
            : [c + inward * 0.035, 1.0, o.swingHi ? r0 + LEAF_W - 0.08 : r0 + 0.08],
      });
    } else if (o.kind === 'sealed') {
      leafBoards.push(bb(o.axis, leafLo, leafHi, mid - 0.025, mid + 0.025, 0.005, LEAF_H));
      leafAabbs.push({ id: o.id, open: false, box: bbBox(o.axis, leafLo, leafHi, mid - 0.025, mid + 0.025, 0.005, LEAF_H) });
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
  // wall. Issue #83 removed the three big sheets that used to stand beyond
  // the balcony's parapets and the sky plane behind win-living-n — the
  // painted Uptown street (built below) covers all of those sightlines now.
  // The kitchen, bath, bedroom and dining windows keep their plain sky: the
  // street is only visible from the living room and the balcony, by design.
  const skySheets = skyPlanes.map((s) => ({
    geo: new THREE.PlaneGeometry(s.w, s.h),
    mat: sky,
    at: s.pos,
    rot: [0, s.rotY, 0],
    // The one exception to mergedMesh's worldUV re-bake: for the sky the texel
    // IS the sheet, so each plane keeps its own 0..1 mapping.
    keepUV: true,
  }));
  // Every sheet here shares one unlit, shadow-free material, so they fold into
  // a single draw for the whole horizon: the desk view sees all of them at once
  // and was spending seven draws on the same seven quads of sky.
  mergedMesh(flat, skySheets, { cast: false, receive: false })
    .forEach((m) => { m.userData.tag = 'sky'; });

  mergedMesh(flat, casings.map((e) => ({ ...e, mat: trim })));
  mergedMesh(flat, trimBoards.map((e) => ({ ...e, mat: trim })), { cast: false });
  mergedMesh(flat, frameBoards.map((e) => ({ ...e, mat: trim })), { cast: false });
  mergedMesh(flat, sillBoards, { cast: false });
  const leafMeshes = mergedMesh(flat, leafBoards.map((e) => ({ ...e, mat: walnut })));
  // tagged so `doorways-read-open` can raycast them out of the opening (game/full.js)
  leafMeshes.forEach((m) => { m.userData.tag = 'door-leaf'; });
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
  penRoot.userData.noMerge = true; // issue #61: game/full.js moves this every find frame
  flat.add(penRoot);

  // ── the kitchen (issue #41) ───────────────────────────────────────────────
  // Every number in it lives in game/full-kitchen.js; this is the one call that
  // puts it on screen, so the flat still draws its shell from full-shell.js and
  // its kitchen from one data module and nowhere else.
  buildFullKitchen(flat);
  // ...and the small pieces on it (issue #44): appliances, rack, bin, the
  // breakfast bar and its stools, the runner, the pendants — same split, one
  // call, data in game/full-kitchen-details.js.
  buildFullKitchenDetails(flat);

  // ── the living room (issue #46) ───────────────────────────────────────────
  // Same shape as the kitchen above: every number lives in
  // game/full-living.js, this is the one call that puts it on screen. The
  // living room is the last big block of the shell left at placeholder size,
  // and its pieces share their footprints with the COLLIDERS splice in
  // game/full-level.js, so what Bobo's body stops against is what gets drawn.
  const livingGroup = buildFullLiving(flat, boot);
  const tv = livingGroup.userData.tv; // issue #84: the kart screen the TV plays

  // ── the bathroom and the balcony (issue #49) ──────────────────────────────
  // Same shape again: every number lives in game/full-bath.js, this is the one
  // call that puts it on screen. Their footprints share the COLLIDERS splice
  // in game/full-level.js, so the tub Bobo's body stops against is the tub
  // that gets drawn, and the railing pad the shell made stays the one pad.
  buildFullBath(flat);

  // ── the bedroom (issue #48) ───────────────────────────────────────────────
  // Same split as the kitchen: every number lives in game/full-bedroom.js and
  // this is the one call that puts it on screen. The bed's headboard is flush
  // on the west wall and the rest of the room hangs off that anchor.
  buildFullBedroom(flat);

  // ── the entry and the hall's end (issue #67) ──────────────────────────────
  // The last two rooms with a floor and no furniture: the shell had drawn the
  // front door and nothing else, which is half of why the arrival read as a
  // dead end. The two colliders this realises (`coat-bench`, `hall-console`)
  // have been in game/full-level.js since the first walk grid, undrawn.
  buildFullEntry(flat);

  // ── the dining room (issue #81) ───────────────────────────────────────────
  // The round table, the four chairs, the sideboard and the pendant, every
  // number from game/full-dining.js. It lands before the decor pass because
  // DECOR_HOSTS files the bowl and the book onto the sideboard's top.
  buildFullDining(flat);

  // ── the lookalike decor (issue #69) ───────────────────────────────────────
  // B/W art, bedding, towels, pot, books: every piece shares one canvas
  // atlas (game/full-decor-mesh.js), so the whole collection lands as ONE
  // merged mesh. Its box spans five rooms, so the culler below files it as
  // shared — one always-drawn call, paid once, not once per room.
  buildFullDecor(flat);

  // ── issue #61: fold the static geometry the five builders just emitted ────
  // Every room is a data table that drew one mesh per box, so a run of cabinet
  // doors cost twelve draw calls to submit twelve boxes that share a material
  // and never move. game/full-merge.js folds siblings that shade identically
  // into one buffer each — same vertices, same material, fewer calls. It skips
  // anything a check measures on its own (ruler rows, named pieces, the parked
  // leaves), anything transparent, and anything with a script on it.
  // ?merge=off hands every mesh back to its own draw, which is how
  // tools/draw-report.mjs and docs/ART_STYLE.md A/B the two numbers.
  const merge = new URLSearchParams(location.search).get('merge') === 'off' ? null : mergeStaticMeshes(flat);
  if (merge) {
    const kept = Object.entries(merge.kept).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' ');
    const big = merge.groups.sort((a, b) => b.from - a.from).slice(0, 6).map((g) => `${g.parent}${g.mat}x${g.from}`).join(' ');
    console.info(`[look-at-bobo] issue #61 fold: ${merge.folded} of ${merge.visited} static meshes into ${merge.into} buffers (−${merge.draws} draws) across ${merge.parents} groups · kept ${kept}`);
    console.info(`[look-at-bobo] issue #61 biggest folds: ${big}`);
  }

  // ── issue #83: Uptown outside the living room ─────────────────────────────
  // The street the balcony and the living-room windows look onto, replacing
  // the three balcony sky sheets and the win-living-n sheet: one painted
  // atlas, one merged mesh, one unlit draw. Filed on the flat BEFORE the
  // cull is built, so createRoomCull picks up its userData.cullRooms invite
  // list and shows it from the living room and the balcony only. ?quality=low
  // (or a phone default) gets the two-row version — same skyline silhouette.
  const qualityParam = new URLSearchParams(location.search).get('quality');
  const street = buildFullStreet({
    THREE,
    quality: qualityParam === 'low' || (qualityParam !== 'high' && autoLowQuality()) ? 'low' : 'full',
  });
  flat.add(street.group);
  console.info(`[look-at-bobo] issue #83 street: ${street.tier} tier · ${street.stats.triangles} tris in ${street.stats.drawCalls} draw · atlas ${street.stats.atlasWidth}px`);

  // ── issue #85: the robot vacuum and its loop ──────────────────────────────
  // The vacuum trundles a seeded circuit through the open rooms. Its route is
  // pure data (game/full-roomba-route.js) rebuilt at every run start from
  // that run's seed; its body is ONE merged mesh (+1 draw, ~330 tris, the
  // same trick as the street above), filed on the flat BEFORE the cull so
  // the cull's `cullRooms` invite list shows it from the four rooms the
  // route serves and hides it (costing nothing) from the other four. The
  // engine owns the odometer: it calls place(metres) once per render and
  // reroute(seed) at each run start. `?roomba=off` deletes the appliance
  // AND Bobo's ride with it — the route, the mesh and the moving find.
  const roombaParam = new URLSearchParams(location.search).get('roomba');
  let roomba = null;
  if (roombaParam !== 'off') {
    let route = buildRoombaRoute(boot.seed ?? 11); // the engine hands its run seed through boot
    const art = buildFullRoomba({ THREE, quality: street.tier });
    flat.add(art.group);
    roomba = {
      spotId: ROOMBA.spotId,
      chance: ROOMBA.chance,
      speed: ROOMBA.speed,
      seedTag: ROOMBA.seedTag,
      stats: art.stats,
      group: art.group,
      get route() {
        return route;
      },
      /** Re-plan the circuit for a new run; the vacuum starts at metre 0. */
      reroute(seed) {
        route = buildRoombaRoute(seed);
        roomba.place(0);
      },
      poseAt(s) {
        const p = roombaAt(route, s);
        return { ...p, room: roombaRoomAt(route, s) };
      },
      /** Put the appliance at metre s of its loop; leans into the corner it
       *  has just turned, the way a feeler bar sweeps. */
      place(s) {
        const p = roomba.poseAt(s);
        art.group.position.set(p.x, 0, p.z);
        art.group.rotation.y = p.heading;
        art.mesh.rotation.z = -p.turn * 0.22 * Math.max(0, 1 - p.along / 0.5);
        return p;
      },
    };
    roomba.place(0);
    console.info(`[look-at-bobo] issue #85 vacuum: loop ${route.length.toFixed(1)} m · ${roomba.stats.triangles} tris in ${roomba.stats.drawCalls} draw · seed ${boot.seed ?? 11}`);
  }

  // ── issue #61: stop submitting rooms the camera cannot see ────────────────
  // Filed now, before game/full.js adds the cast: everything in this list is
  // flat, and anything added afterwards is nobody's room to hide.
  // ?cull=off keeps every room drawn, which is how the checks run and how
  // tools/draw-report.mjs proves hiding a room moves no pixel.
  const cull = createRoomCull(flat, {
    enabled: new URLSearchParams(location.search).get('cull') !== 'off',
  });
  console.info(`[look-at-bobo] issue #61 cull: rooms -> groups ${JSON.stringify(cull.map())} · ${cull.shared} shared groups never hidden`);

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
    // issue #67 moved the two circulation fills. The hall+entry one stepped
    // east and south, to the middle of the zone the visitor is actually in —
    // the old point on the hall's centre line at z 3.6 lit the corridor's
    // north end and left the front door, a metre and a half further south
    // behind a corner, the dimmest interior wall in the flat. Issue #81 slid
    // it the rest of the way: the widened hall put the whole point west of
    // the front door's new centre, and at that distance the leaf face — flat
    // into the room, 5 cm of daylight off its plaster — sat in the fill's
    // grazing band. It now hangs under the entry pendant (the flat's fill
    // convention), one metre north of the door it exists to light, and the
    // hall still reads lit through the opening and the bleed. The bathroom's
    // moved to the centre of the room it grew (its old point at z 3.0 was the
    // middle of the OLD 1.68 m room, so it lit the doorway and left the whole
    // new south half of the floor in shade) and got brighter: the room is
    // 1.30 m longer, so the old 3.2 at the old centre no longer reached it.
    // Still four fills: the flat is at the `realLights ≤ 6` cap, so the new
    // ceiling bodies in game/full-entry-mesh.js are emissive and these are the
    // lights, hung one under each.
    { at: [1.85, 2.34, 3.5], color: 0xffe6c4, i: 5.6, d: 7.0 }, // the front door's room, under its pendant; the hall through the opening
    { at: [-0.7, 2.34, 7.3], color: 0xffdcc0, i: 5.0, d: 7.5 }, // bedroom
    { at: [-2.31, 2.34, 3.71], color: 0xf0e8f0, i: 3.9, d: 5.8 }, // bathroom (cooler: a different fixture; issue #81: the hall's 0.30 m widened the room east, so the fill rides the new centre)
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
    // issue #61: the per-room draw cull, driven by the camera each frame
    cull,
    // issue #83: the street backdrop — { group, stats, tier } — so the
    // checks can count it, measure the atlas and park the camera per room
    street: { group: street.group, stats: street.stats, tier: street.tier, mesh: street.mesh },
    // issue #85: the robot vacuum — route data, the one-draw mesh, and the
    // place/reroute/poseAt interface the engine's odometer drives (null
    // under `?roomba=off`, which is also the engine's cue to never ride).
    roomba,
    // issue #84: the TV's kart screen and the engine's once-a-frame nudge.
    // tick() repaints and re-uploads the one texture only while the screen
    // is on camera (per-room cull's visible flags + a frustum test) and the
    // tab is visible; frozen entirely under `?gate=off`.
    tv,
    onRender(camera) {
      tv.tick(performance.now(), camera);
    },
    // every plaster slab (walls, parapets, ceilings) as an AABB, from the
    // definitions that were actually built (src/reach.js measures the walls
    // you can actually see — floors are not walls and are deliberately out)
    wallBoxes: [...WALL_DEFS, ...CEILINGS].map((d) => slabAABB(d, d.id)),
    // every door leaf as an AABB with whether it stands open, for the
    // `doors-read-open` / `doorways-read-open` checks (issue #65)
    doorLeaves: leafAabbs,
  };
}
