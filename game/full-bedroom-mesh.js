/*!
 * game/full-bedroom-mesh.js — the bedroom, drawn (issue #48, parent #33).
 *
 * game/full-bedroom.js holds the bedroom's numbers; this file puts geometry
 * on them and nothing else — no coordinate is typed here. It is the kitchen's
 * split (game/full-kitchen-mesh.js) copied honestly: data in, meshes out.
 *
 * Same contract as the kitchen, and the checks lean on it:
 *
 *   PIECES   one mesh each, geometry baked into world position so the mesh's
 *            own bounding box IS its footprint — what `furniture-real-scale`
 *            measures back against the ruler. `userData.scale` carries the
 *            ruler rows a box answers to; `userData.scaleGroup` unions the
 *            pieces of one object (a desk is a top and two legs, a monitor is
 *            a foot, a post and a panel, a chair is a frame and a seat) so
 *            the GROUP is what gets measured against its row.
 *   DETAILS  the dressing — drawer fronts, pulls, wardrobe doors, the curtain
 *            rod — merged per material like the shell's plaster. Deliberately
 *            unmeasurable, and ignored by the colliders, so a pull proud of
 *            its piece cannot narrow a walkway.
 *
 * Two non-box shapes: the laundry basket is a `hollow` envelope (four walls
 * and a floor inside the rim-to-rim box, so the measured number is the rim's
 * and the thing you see is an open basket), and the plant is a cylinder and a
 * cone — a pot and a leaf — from the same envelopes their collider rects use.
 *
 * Nothing here casts a shadow, same as the kitchen: the flat's one shadow
 * light is the sun outside the north-west windows, and the bedroom has its
 * own fill (game/full-apartment.js). They all receive.
 */
import * as THREE from 'three';
import { SURFACES, surface, fabric, worldUV } from '../src/polish.js';
import { mergedMesh } from './full-apartment.js';
import { PIECES, DETAILS } from './full-bedroom.js';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

/** The bedroom's material slots. All procedural (src/polish.js), and every
 *  soft surface a cat lies on is deliberately mid-tone — the cats are black
 *  and white, so sage, terracotta and slate read against them, and no bed
 *  dressing is allowed to be the white-of-the-walls nothing that made the
 *  old playset bed disappear. */
function bedroomMaterials() {
  return {
    wood: SURFACES.wood(), // frames, headboard, the dresser and wardrobe bodies
    woodPale: SURFACES.woodPale(), // the desk top and nightstand cases
    woodDark: surface(0x503c28, { uvTile: 0.9, roughness: 0.7 }), // drawer gaps
    woodLight: surface(0xc49a6c, { uvTile: 0.9, roughness: 0.66 }), // wardrobe doors
    mattress: surface(0xd8d2c2, { uvTile: 0.5, roughness: 0.9 }), // under the coverlet
    coverlet: fabric(0x8ba18e, { uvTile: 0.14 }), // sage — the made-bed plane
    pillow: fabric(0xd9a441, { uvTile: 0.18 }), // the flat's own pillow gold
    blanket: fabric(0xb8654a, { uvTile: 0.16 }), // terracotta, folded at the foot
    seatFabric: fabric(0x5f6a75, { uvTile: 0.2 }), // the desk chair, slate
    cushion: fabric(0x707d89, { uvTile: 0.22 }), // its pad, a shade lighter
    applianceDark: surface(0x2f343a, { uvTile: 0.3, roughness: 0.55, metalness: 0.2 }), // keyboard
    screen: surface(0x232a33, { uvTile: 0.4, roughness: 0.18, metalness: 0.35 }), // monitor glass
    metal: SURFACES.metal(), // the chair frame, the curtain rod
    brass: surface(0x9c7f4a, { uvTile: 0.1, roughness: 0.35, metalness: 0.55 }), // pulls
    fabricBasket: fabric(0x9b8f7d, { uvTile: 0.25, sheen: 0.1 }), // the laundry basket
    fabricPile: fabric(0xc08388, { uvTile: 0.18 }), // dusty rose, spilling over
    rug: SURFACES.rug(), // the mid-floor rug
    curtain: fabric(0x8d9aa6, { uvTile: 0.2 }), // the south window's pair
    pot: surface(0xb0714f, { uvTile: 0.3, roughness: 0.8 }), // terracotta pot
    leaf: SURFACES.leaf(), // and its leaves
  };
}

const size = (p) => [p.x1 - p.x0, p.y1 - p.y0, p.z1 - p.z0];
const centre = (p) => [(p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2, (p.z0 + p.z1) / 2];

/** A piece's geometry, already in world position (so its bounding box is its
 *  footprint and `worldUV` sees the real coordinates). */
function pieceGeometry(p) {
  const [w, h, d] = size(p);
  const [cx, cy, cz] = centre(p);
  if (p.shape === 'cyl' || p.shape === 'cone') {
    const r = w / 2; // the envelope is a square in plan; the pot and leaf both are
    const g = p.shape === 'cyl'
      ? new THREE.CylinderGeometry(r, r * 0.92, h, 20)
      : new THREE.ConeGeometry(r, h, 12);
    g.translate(cx, cy, cz);
    return g;
  }
  if (!p.hollow) {
    const g = box(w, h, d);
    g.translate(cx, cy, cz);
    return g;
  }
  // An open-topped shell: a floor plus four walls, all inside p's envelope —
  // the basket measures rim-to-rim and reads as a basket.
  const t = p.hollow;
  const parts = [
    [p.x0, p.y0, p.z0, p.x1, p.y0 + t, p.z1], // floor
    [p.x0, p.y0 + t, p.z0, p.x0 + t, p.y1, p.z1], // west wall
    [p.x1 - t, p.y0 + t, p.z0, p.x1, p.y1, p.z1], // east wall
    [p.x0 + t, p.y0 + t, p.z0, p.x1 - t, p.y1, p.z0 + t],
    [p.x0 + t, p.y0 + t, p.z1 - t, p.x1 - t, p.y1, p.z1],
  ];
  const g = new THREE.BufferGeometry();
  const geos = parts.map(([a0, b0, c0, a1, b1, c1]) => {
    const one = box(a1 - a0, b1 - b0, c1 - c0);
    one.translate((a0 + a1) / 2, (b0 + b1) / 2, (c0 + c1) / 2);
    return one.toNonIndexed();
  });
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

/**
 * Draw the bedroom into `parent` (the flat's group). Returns the group.
 * @param {THREE.Object3D} parent
 */
export function buildFullBedroom(parent) {
  const mats = bedroomMaterials();
  const bedroom = new THREE.Group();
  bedroom.name = 'bedroom';
  parent.add(bedroom);

  const measured = [];
  for (const p of PIECES) {
    const mat = mats[p.mat];
    const geo = pieceGeometry(p);
    worldUV(geo, mat.userData?.uvTile ?? 0.6);
    const m = new THREE.Mesh(geo, mat);
    m.name = p.id;
    m.castShadow = false;
    m.receiveShadow = true;
    // The ruler's handle: rows this box answers to (an array of names), and
    // the group whose union is what a shared row measures — straight from the
    // data file, never retyped here.
    if (p.tags?.length) m.userData.scale = p.tags;
    if (p.group) m.userData.scaleGroup = p.group;
    bedroom.add(m);
    measured.push(m);
  }

  // Dressing merges the way the kitchen's does (mergedMesh groups by
  // material itself); `parent` in the data is only a name for humans — every
  // entry already carries its own world rectangle.
  mergedMesh(
    bedroom,
    DETAILS.map((e) => ({
      geo: box(e.x[1] - e.x[0], e.y[1] - e.y[0], e.z[1] - e.z[0]),
      mat: mats[e.mat] ?? mats.woodDark,
      at: [(e.x[0] + e.x[1]) / 2, (e.y[0] + e.y[1]) / 2, (e.z[0] + e.z[1]) / 2],
    })),
    { cast: false, receive: true },
  );

  return { group: bedroom, pieces: measured };
}
