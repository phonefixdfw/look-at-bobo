/*!
 * game/full-kitchen-details-mesh.js — the kitchen's small pieces, drawn
 * (issue #44, parent #33).
 *
 * game/full-kitchen-details.js holds the numbers; this file puts geometry on
 * them and nothing else — no coordinate is typed here, mirroring the split
 * game/full-kitchen.js / game/full-kitchen-mesh.js use. PIECES get one mesh
 * each with the geometry baked into world position (so the mesh's own AABB IS
 * the footprint the ruler check measures) and `userData.scale` carried over;
 * DETAILS merge per material, and the pendants — emissive meshes only, the
 * rig is at its four fills (docs/ART_STYLE.md §4) — merge per part.
 *
 * `parts` builds a piece as its boxes merged into one mesh (a rack is a base,
 * four posts, a rim; a stool a seat, four legs, a footrest) inside the same
 * envelope the ruler measures. `shape: 'cyl'` inscribes a cylinder. Like the
 * fixed kitchen these all receive the kitchen's light but cast no shadow.
 */
import * as THREE from 'three';
import { SURFACES, surface, worldUV } from '../src/polish.js';
import { mergedMesh } from './full-apartment.js';
import { PIECES, DETAILS, PENDANTS } from './full-kitchen-details.js';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const size = (p) => [p.x1 - p.x0, p.y1 - p.y0, p.z1 - p.z0];
const centre = (p) => [(p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2, (p.z0 + p.z1) / 2];
const b6 = (b) => box(b[3] - b[0], b[4] - b[1], b[5] - b[2]).translate((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2);

/** The materials, from the same src/polish.js slots the fixed kitchen uses. */
function detailsMaterials() {
  return {
    steel: SURFACES.metal(),
    front: SURFACES.wood(), // the bar carcass, in the flat's walnut
    worktop: SURFACES.marble(), // the bar top: the same slab as the counters
    wood: SURFACES.woodPale(), // the stools
    rug: SURFACES.rug(), // row 33's runner
    enamel: surface(0xe8e6e0, { uvTile: 1.2, roughness: 0.42 }),
    handle: surface(0x3b4046, { uvTile: 0.12, roughness: 0.35, metalness: 0.45 }),
    dark: surface(0x25282d, { uvTile: 0.25, roughness: 0.55, metalness: 0.25 }),
    glass: surface(0x1c2025, { uvTile: 0.4, roughness: 0.12 }),
    // the pendants: the shade glows from inside (ART_STYLE's lampShade rule,
    // emissive 0.55) and the bulb is the small bright disc under it
    shade: surface(0xf2e6cf, { uvTile: 0.5, roughness: 0.7, emissive: 0xf2e6cf, emissiveIntensity: 0.55 }),
    bulb: surface(0xffe6c4, { uvTile: 0.5, roughness: 0.4, emissive: 0xffe6c4, emissiveIntensity: 1.5 }),
  };
}

/** The dish rack as its boxes: a base tray, four corner posts, a top rim.
 *  Same envelope as the piece, so the measured box is still row 27's. */
function rackParts(p) {
  const post = 0.016;
  const rail = 0.012;
  const y1 = p.y1;
  return [
    [p.x0, p.y0, p.z0, p.x1, p.y0 + 0.008, p.z1], // base tray
    [p.x0, p.y0, p.z0, p.x0 + post, y1, p.z0 + post], // four posts
    [p.x1 - post, p.y0, p.z0, p.x1, y1, p.z0 + post],
    [p.x0, p.y0, p.z1 - post, p.x0 + post, y1, p.z1],
    [p.x1 - post, p.y0, p.z1 - post, p.x1, y1, p.z1],
    [p.x0, y1 - rail, p.z0, p.x1, y1, p.z0 + rail], // rim: four rails
    [p.x0, y1 - rail, p.z1 - rail, p.x1, y1, p.z1],
    [p.x0, y1 - rail, p.z0 + rail, p.x0 + rail, y1, p.z1 - rail],
    [p.x1 - rail, y1 - rail, p.z0 + rail, p.x1, y1, p.z1 - rail],
  ];
}

/** A bar stool as its boxes: seat slab, four legs, a footrest frame. Its seat
 *  top is the piece's y1 — row 32's number, on a backless stool. */
function stoolParts(p) {
  const leg = 0.035;
  const seatY = p.y1 - 0.03;
  const inset = 0.02;
  const legs = [];
  const fy = [0.18, 0.202];
  const lx0 = p.x0 + inset;
  const lx1 = p.x1 - inset - leg;
  const lz0 = p.z0 + inset;
  const lz1 = p.z1 - inset - leg;
  for (const x of [lx0, lx1]) for (const z of [lz0, lz1]) legs.push([x, 0, z, x + leg, seatY, z + leg]);
  const frame = [
    [p.x0 + inset, fy[0], p.z0 + inset, p.x1 - inset, fy[1], p.z0 + inset + leg], // footrest frame
    [p.x0 + inset, fy[0], p.z1 - inset - leg, p.x1 - inset, fy[1], p.z1 - inset],
    [p.x0 + inset, fy[0], p.z0 + inset, p.x0 + inset + leg, fy[1], p.z1 - inset],
    [p.x1 - inset - leg, fy[0], p.z0 + inset, p.x1 - inset, fy[1], p.z1 - inset],
  ];
  return [[p.x0, seatY, p.z0, p.x1, p.y1, p.z1], ...legs, ...frame]; // seat slab + legs + footrest
}

function pieceGeometry(p) {
  if (p.shape === 'cyl') {
    const r = (p.x1 - p.x0) / 2;
    const g = new THREE.CylinderGeometry(r, r, p.y1 - p.y0, 18);
    g.translate(...centre(p));
    return g;
  }
  if (p.parts) {
    const parts = p.parts === 'rack' ? rackParts(p) : stoolParts(p);
    const geos = parts.map((b) => b6(b).toNonIndexed());
    const g = new THREE.BufferGeometry();
    const pos = [];
    const nor = [];
    for (const one of geos) {
      pos.push(...one.attributes.position.array);
      nor.push(...one.attributes.normal.array);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    return g;
  }
  const g = box(...size(p));
  g.translate(...centre(p));
  return g;
}

/**
 * Draw the small kitchen pieces into `parent` (the flat's group).
 * @param {THREE.Object3D} parent
 */
export function buildFullKitchenDetails(parent) {
  const mats = detailsMaterials();
  const details = new THREE.Group();
  details.name = 'kitchen-details';
  parent.add(details);

  const measured = [];
  for (const p of PIECES) {
    const mat = mats[p.mat];
    const geo = pieceGeometry(p);
    worldUV(geo, mat.userData?.uvTile ?? 0.6);
    const m = new THREE.Mesh(geo, mat);
    m.name = p.id;
    m.castShadow = false;
    m.receiveShadow = true;
    if (p.scale?.length) m.userData.scale = p.scale;
    details.add(m);
    measured.push(m);
  }

  mergedMesh(
    details,
    DETAILS.map((e) => ({
      geo: box(e.x1 - e.x0, e.y1 - e.y0, e.z1 - e.z0),
      mat: mats[e.mat] ?? mats.dark,
      at: [(e.x0 + e.x1) / 2, (e.y0 + e.y1) / 2, (e.z0 + e.z1) / 2],
    })),
    { cast: false, receive: true },
  );

  // the pendants: rod to the ceiling, shade, bulb — emissive meshes, no light
  mergedMesh(
    details,
    PENDANTS.flatMap((d) => [
      { geo: new THREE.CylinderGeometry(0.012, 0.012, 0.52, 10), mat: mats.handle, at: [d.x, 2.24, d.z] }, // rod 2.50 → 1.98
      { geo: new THREE.CylinderGeometry(0.05, 0.16, 0.22, 20), mat: mats.shade, at: [d.x, 1.87, d.z] }, // shade 1.76 … 1.98
      { geo: new THREE.SphereGeometry(0.035, 12, 8), mat: mats.bulb, at: [d.x, 1.81, d.z] },
    ]),
    { cast: false, receive: false },
  );

  return { group: details, pieces: measured };
}
