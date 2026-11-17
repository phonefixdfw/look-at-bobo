/*!
 * game/full-kitchen-mesh.js — the kitchen, drawn (issue #41, parent #33).
 *
 * game/full-kitchen.js holds the kitchen's numbers; this file puts geometry on
 * them and nothing else — no coordinate is typed here. It mirrors the split
 * game/full-shell.js / game/full-apartment.js already use: data in, meshes out.
 *
 * Two kinds of output, and the difference matters to the checks:
 *
 *   PIECES   one mesh each, geometry baked into world position (so the mesh's
 *            own bounding box IS its footprint — that is what the
 *            `furniture-real-scale` check measures back against the ruler) and
 *            `userData.scale` carrying the row(s) it answers to.
 *   DETAILS  the dressing — toe kicks, drawer fronts, handles, burners, seams,
 *            the hood's duct — merged per material the way the shell merges its
 *            plaster, so the kitchen costs a handful of draws rather than a
 *            hundred. It is deliberately unmeasurable: dressing has no business
 *            passing for furniture.
 *
 * `hollow` on a piece (the sink) turns its box into an open-topped shell: four
 * walls and a floor inside the same envelope, so the measured box stays the
 * rim-to-rim number the ruler asks for while the thing you see is a bowl.
 *
 * Nothing here casts a shadow. The flat's one shadow light is the sun outside
 * the north-west windows, aimed into the living room (game/full-apartment.js);
 * the kitchen is lit by its own non-shadowing fill, and the draw-call budget is
 * spent better on the flat than on a fridge shadow nobody sees. They all
 * receive, so the light that does come through the glass over the sink lands
 * correctly on the worktop.
 */
import * as THREE from 'three';
import { SURFACES, surface, worldUV } from '../src/polish.js';
import { mergedMesh } from './full-apartment.js';
import { PIECES, DETAILS } from './full-kitchen.js';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

/** The kitchen's material slots (src/polish.js names — nothing custom-drawn). */
function kitchenMaterials() {
  return {
    carcass: SURFACES.woodPale(), // the boxes behind the fronts
    front: SURFACES.wood(), // doors and drawer fronts: the walnut of the flat
    worktop: SURFACES.marble(), // row 13's 4 cm slab
    tile: SURFACES.kitchenTile(), // row 14's backsplash
    steel: SURFACES.metal(), // appliances, bowl, hood
    enamel: surface(0xe8e6e0, { uvTile: 1.2, roughness: 0.42 }), // the fridge
    handle: surface(0x3b4046, { uvTile: 0.12, roughness: 0.35, metalness: 0.45 }),
    dark: surface(0x25282d, { uvTile: 0.25, roughness: 0.55, metalness: 0.25 }), // kicks, burners, knobs
    seam: surface(0x8f959c, { uvTile: 0.3, roughness: 0.5, metalness: 0.3 }), // door seams
    glass: surface(0x1c2025, { uvTile: 0.4, roughness: 0.12 }), // the oven window
  };
}

const size = (p) => [p.x1 - p.x0, p.y1 - p.y0, p.z1 - p.z0];
const centre = (p) => [(p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2, (p.z0 + p.z1) / 2];

/** A piece's geometry, already in world position (so its bounding box is its
 *  footprint and `worldUV` sees the real coordinates). */
function pieceGeometry(p) {
  if (!p.hollow) {
    const g = box(...size(p));
    g.translate(...centre(p));
    return g;
  }
  // An open-topped shell: a floor plus four walls, all inside p's envelope.
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
 * Draw the kitchen into `parent` (the flat's group). Returns the group.
 * @param {THREE.Object3D} parent
 */
export function buildFullKitchen(parent) {
  const mats = kitchenMaterials();
  const kitchen = new THREE.Group();
  kitchen.name = 'kitchen';
  parent.add(kitchen);

  const measured = [];
  for (const p of PIECES) {
    const mat = mats[p.mat];
    const geo = pieceGeometry(p);
    worldUV(geo, mat.userData?.uvTile ?? 0.6);
    const m = new THREE.Mesh(geo, mat);
    // Issue #82: only the MEASURED pieces keep a name. `name` is a merge lock
    // (game/full-merge.js), and every ruler handle here is userData, never
    // the name — so the untagged fillers (the sink-base panel, the end
    // filler) can now fold into their same-material siblings and the frame
    // that gained the cat's bowls and the bigger bin gives a draw back.
    if (p.scale?.length || p.group) m.name = p.id;
    m.castShadow = false;
    m.receiveShadow = true;
    // The ruler's handle: rows this box is measured against, verbatim from the
    // data file (a string, or {key, along} for a run that runs along z).
    if (p.scale?.length) m.userData.scale = p.scale;
    if (p.group) m.userData.scaleGroup = p.group;
    kitchen.add(m);
    measured.push(m);
  }

  mergedMesh(
    kitchen,
    DETAILS.map((e) => ({
      geo: box(e.x1 - e.x0, e.y1 - e.y0, e.z1 - e.z0),
      mat: mats[e.mat] ?? mats.dark,
      at: [(e.x0 + e.x1) / 2, (e.y0 + e.y1) / 2, (e.z0 + e.z1) / 2],
    })),
    { cast: false, receive: true },
  );

  return { group: kitchen, pieces: measured };
}
