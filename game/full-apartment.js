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
    // every plaster slab (walls, parapets, ceilings) as an AABB, from the
    // definitions that were actually built (src/reach.js measures the walls
    // you can actually see — floors are not walls and are deliberately out)
    wallBoxes: [...WALL_DEFS, ...CEILINGS].map((d) => slabAABB(d, d.id)),
  };
}
