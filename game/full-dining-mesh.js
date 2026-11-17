/*!
 * game/full-dining-mesh.js — the dining room, drawn (issue #81).
 *
 * game/full-dining.js holds the numbers; this file puts geometry on them and
 * nothing else — the split game/full-living.js / game/full-living-mesh.js
 * set up. PIECES become one draw each with the geometry baked into world
 * position (so the built bounding box IS the footprint `furniture-real-scale`
 * measures) and the ruler row copied into `userData.scale`; DETAILS merge
 * untagged; the pendant is emissive meshes only, no light — the flat is at
 * tools/capture.mjs's `realLights ≤ 6` cap, and the kitchen pendants set the
 * convention a glow without a bulb-behind-it light is allowed to keep.
 *
 * The draw budget, as always, decides the mesh count: every PIECE is one
 * world-baked draw carrying its ruler tag, so all four chairs are measured
 * (the check measures each tagged MESH, and four folded chairs would measure
 * one big union — folding happens later, in full-merge.js, which refuses to
 * fold meshes that carry different tags; same-material folds of identical
 * tags are fine and would still leave one chair measured, but the four are
 * apart in the room and cull apart, so the honest count stands). This room
 * costs five measured draws, one details draw and one pendant draw, and
 * frustum culling keeps all of them out of every other room's frame.
 *
 * Nothing casts a shadow, same policy as the living room: the shadow pass is
 * spent on the sun, and these pieces all receive it.
 */
import * as THREE from 'three';
import { TOKENS } from '../src/tokens.js';
import { SURFACES, surface } from '../src/polish.js';
import { mergedMesh } from './full-apartment.js';
import { PIECES, DETAILS, PENDANT } from './full-dining.js';

const size = (p) => [p.x1 - p.x0, p.y1 - p.y0, p.z1 - p.z0];
const centre = (p) => [(p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2, (p.z0 + p.z1) / 2];

/** A box part, baked into world position. */
const boxGeo = (p) => {
  const g = new THREE.BoxGeometry(...size(p));
  g.translate(...centre(p));
  return g;
};

/** A turned part (`cyl`): the lathe a table column or pendant shade is. */
const cylGeo = (c) => {
  const g = new THREE.CylinderGeometry(c.rt, c.rb, c.y1 - c.y0, c.open ? 24 : 18, 1, !!c.open);
  g.translate(c.x, (c.y0 + c.y1) / 2, c.z);
  return g;
};

function diningMaterials() {
  return {
    wood: SURFACES.wood(), // the table and the sideboard: the flat's walnut
    woodPale: SURFACES.woodPale(), // the four chairs
    // issue #88: the parcel box's kraft, the living room hero box's own
    // surface recipe — same token, same roughness, second instance.
    cardboard: surface(TOKENS.cardboard, { uvTile: 0.5, roughness: 0.94 }),
    handle: surface(0x3b4046, { uvTile: 0.12, roughness: 0.35, metalness: 0.45 }), // pulls, apron boss
    // the pendant: the kitchen pendants' exact shade/bulb pair (same emissive
    // intensities — one lamp language in the flat)
    shade: surface(0xf2e6cf, { uvTile: 0.5, roughness: 0.7, emissive: 0xf2e6cf, emissiveIntensity: 0.55 }),
    bulb: surface(0xffe6c4, { uvTile: 0.5, roughness: 0.4, emissive: 0xffe6c4, emissiveIntensity: 1.5 }),
  };
}

/** Everything the data describes, hung under one group. */
export function buildFullDining(parent) {
  const mats = diningMaterials();
  const dining = new THREE.Group();
  dining.name = 'dining-room';
  parent.add(dining);

  // one draw per piece, world-baked, tagged with its ruler row
  for (const p of PIECES) {
    const mat = mats[p.mat];
    const entries = [
      ...p.parts.map((b) => ({ geo: boxGeo(b), mat })),
      ...(p.cyls ?? []).map((c) => ({ geo: cylGeo(c), mat })),
    ];
    const meshes = mergedMesh(dining, entries, { cast: false, receive: true });
    for (const m of meshes) {
      m.name = p.id;
      if (p.scale) m.userData.scale = p.scale;
    }
  }

  // details: pulls and the apron boss, merged untagged
  mergedMesh(
    dining,
    DETAILS.map((e) => ({
      geo: boxGeo(e.box),
      mat: mats[e.mat] ?? mats.handle,
    })),
    { cast: false, receive: true },
  );

  // the pendant: rod to the plaster, shade, bulb — emissive meshes, no light
  const shadeBottom = PENDANT.shadeTopY - PENDANT.shadeH;
  mergedMesh(
    dining,
    [
      { geo: new THREE.CylinderGeometry(0.012, 0.012, 2.5 - PENDANT.shadeTopY, 10), mat: mats.handle, at: [PENDANT.x, (2.5 + PENDANT.shadeTopY) / 2, PENDANT.z] },
      { geo: new THREE.CylinderGeometry(0.05, PENDANT.shadeR, PENDANT.shadeH, 20), mat: mats.shade, at: [PENDANT.x, PENDANT.shadeTopY - PENDANT.shadeH / 2, PENDANT.z] },
      { geo: new THREE.SphereGeometry(0.035, 12, 8), mat: mats.bulb, at: [PENDANT.x, shadeBottom - 0.02, PENDANT.z] },
    ],
    { cast: false, receive: false },
  );

  // the room's standing policy, applied in one sweep
  dining.traverse((o) => {
    if (o.isMesh && !o.material.transparent) o.receiveShadow = true;
    if (o.isMesh) o.castShadow = false;
  });
  return dining;
}
