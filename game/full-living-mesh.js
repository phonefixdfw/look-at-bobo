/*!
 * game/full-living-mesh.js — the living room, drawn (issue #46, parent #33).
 *
 * game/full-living.js holds the living room's numbers; this file puts geometry
 * on them and nothing else — no coordinate is typed here, exactly the split
 * game/full-kitchen.js / game/full-kitchen-mesh.js set up. PIECES become one
 * mesh each with its geometry baked into world position (so the built bounding
 * box IS the footprint the `furniture-real-scale` check measures) and the
 * ruler row copied into `userData.scale`; DETAILS become one merged draw per
 * material; the plants are `broadLeafGeo` cards on deterministic spirals.
 *
 * The measured pieces and the check agree through the two conventions
 * game/full-level.js documents above SCALE_RANGES: `userData.scale` for a
 * piece that measures as itself, `userData.scaleGroup` for the pieces that are
 * one ruler line drawn in two materials (the side table's top and pedestal,
 * the lamp's metal and shade, the stand's case and legs).
 *
 * Nothing here casts a shadow, same as the kitchen: the flat's one shadow
 * light is the sun outside the north-west windows, the shadow pass is at its
 * budget, and tangent-to-sun geometry acne'd before (docs/POLISH_NOTES.md).
 * They all receive, so the sun that does come through the north window lands
 * on the rug and the box correctly.
 *
 * The lamp is the room's one lamp: emissive shade, plus a point light the
 * shade would be a lie without — a glowing paper cylinder that lights nothing
 * is the playset tell the issue exists to kill. That light is the sixth of
 * engine's six punctual lights (game/full-apartment.js's rig runs five), and
 * the TV's glow stays a decal (`glowMaterial`, no light) exactly as the
 * placeholder demo did.
 */
import * as THREE from 'three';
import {
  SURFACES, surface, fabric, tvScreenMaterial, glowMaterial, broadLeafGeo,
} from '../src/polish.js';
import { createKartScreen } from '../src/kart-screen.js';
import { TOKENS } from '../src/tokens.js';
import { mergedMesh } from './full-apartment.js';
import { PIECES, DETAILS, PLANTS, plantLeaves } from './full-living.js';

/** The living room's material slots (src/polish.js names — nothing custom-drawn
 *  except the two lit surfaces, which are `surface()` with emissive keys).
 *  `tvScreen` (issue #84) is the animated kart-screen texture; without it the
 *  material keeps the old still standby frame. */
function livingMaterials(tvScreen) {
  return {
    cloth: fabric(TOKENS.couch), // the sofa's frame: the flat's couch blue-grey
    clothSeat: fabric(0x464e58), // cushions a tone lighter than the frame, as fabric ages
    woodTop: SURFACES.wood(), // walnut tops: the coffee table's slab
    wood: SURFACES.wood(), // legs and frames
    woodPale: SURFACES.woodPale(), // the bookshelf case, the stand's twin
    metal: SURFACES.metal(), // the lamp's stem and base
    shade: surface(TOKENS.lampShade, {
      uvTile: 0.25,
      roughness: 0.88,
      side: THREE.DoubleSide,
      emissive: new THREE.Color(TOKENS.lampShade),
      emissiveIntensity: 0.6, // paper with a bulb behind it
    }),
    tvBody: surface(0x14171a, { uvTile: 0.3, roughness: 0.45, metalness: 0.3 }),
    dark: surface(0x25282d, { uvTile: 0.25, roughness: 0.55, metalness: 0.25 }), // kicks, pegs, the pedestal
    cardboard: surface(TOKENS.cardboard, { uvTile: 0.5, roughness: 0.94 }), // the hero prop
    heatpad: fabric(0xf2b63f), // issue #82: the yellow heat pad — the flat's second warm accent
    rug: SURFACES.rug(), // the 3.3 × 2.3 pile under the seat group
    pillow: fabric(TOKENS.pillow), // the two cushions, the flat's one gold accent
    throw: fabric(0x8a5c46), // over the arm: terracotta, folded
    spines: SURFACES.spines(), // books: an actual shelf of them, not a brown block
    pot: SURFACES.pot(), // both plant pots and the vase on the shelf
    leaf: SURFACES.leaf(), // DoubleSide: leaves you can walk behind
    sky: surface(0x7e8a92, { uvTile: 0.4, roughness: 0.92 }), // the print, upper band
    sand: surface(TOKENS.pillow, { uvTile: 0.4, roughness: 0.92 }), // the print, lower band
    screen: tvScreenMaterial(tvScreen?.texture), // the TV's glow: the kart game's canvas, once per upload
  };
}

const size = (p) => [p.x1 - p.x0, p.y1 - p.y0, p.z1 - p.z0];
const centre = (p) => [(p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2, (p.z0 + p.z1) / 2];

/** A box part, baked into world position. */
const boxGeo = (p) => {
  const g = new THREE.BoxGeometry(...size(p));
  g.translate(...centre(p));
  return g;
};

/** A turned part (`cyl`): the column the lathe of a table leg or lamp stem is. */
const cylGeo = (c) => {
  const g = new THREE.CylinderGeometry(c.rt, c.rb, c.y1 - c.y0, c.open ? 24 : 16, 1, !!c.open);
  g.translate(c.x, (c.y0 + c.y1) / 2, c.z);
  return g;
};

/** The PIECES pass: one mesh per piece, world-baked, tagged with its ruler row
 *  or its measured group. */
function buildPieces(living, mats) {
  for (const p of PIECES) {
    const mat = mats[p.mat];
    const entries = [
      ...p.parts.map((b) => ({ geo: boxGeo(b), mat })),
      ...(p.cyls ?? []).map((c) => ({ geo: cylGeo(c), mat })),
    ];
    const meshes = mergedMesh(living, entries, { cast: false, receive: true });
    for (const m of meshes) {
      m.name = p.id;
      if (p.scale) m.userData.scale = p.scale;
      if (p.group) m.userData.scaleGroup = p.group;
    }
  }
}

/** The DETAILS pass: dressing, merged per material, deliberately untagged. */
function buildDetails(living, mats) {
  const D = DETAILS;
  mergedMesh(living, [{ geo: boxGeo(D.rug), mat: mats.rug }], { cast: false });
  mergedMesh(
    living,
    D.pillows.map((q) => ({
      geo: new THREE.BoxGeometry(...q.size),
      mat: mats.pillow,
      at: q.at,
      rot: q.rot,
    })),
    { cast: false },
  );
  mergedMesh(living, D.throwBoxes.map((b) => ({ geo: boxGeo(b), mat: mats.throw })), { cast: false });
  mergedMesh(
    living,
    [...D.shelfBoards, ...D.trinkets, D.art.frame].map((b) => ({ geo: boxGeo(b), mat: b === D.art.frame ? mats.wood : mats.woodPale })),
    { cast: false },
  );
  mergedMesh(living, D.bookSpines.map((b) => ({ geo: boxGeo(b), mat: mats.spines })), { cast: false });
  mergedMesh(living, [...D.tvBase, ...D.padCord].map((b) => ({ geo: boxGeo(b), mat: mats.dark })), { cast: false });

  // pots and the vase: turned, one draw for all three
  const potParts = [
    { x: -3.11, z: -2.62, y0: D.vase.y0, y1: D.vase.y0 + D.vase.h, rt: D.vase.r1, rb: D.vase.r0 },
    ...PLANTS.map((pl) => ({ x: pl.x, z: pl.z, y0: pl.y0, y1: pl.y0 + pl.pot.h, rt: pl.pot.r1, rb: pl.pot.r0 })),
  ];
  mergedMesh(living, potParts.map((c) => ({ geo: cylGeo(c), mat: mats.pot })), { cast: false });

  // every leaf of both plants: cloned cards on the data's spiral, merged once
  const leaves = [];
  const soilTop = [];
  for (const pl of PLANTS) {
    const base = broadLeafGeo({ len: pl.leaf.len, wid: pl.leaf.wid, bend: pl.leaf.bend });
    for (const lf of plantLeaves(pl)) {
      const g = base.clone();
      g.scale(lf.scale, lf.scale, lf.scale);
      g.rotateY(lf.yaw);
      g.rotateX(-lf.tilt); // tips up; the blade's own bend droops them
      g.translate(pl.x + lf.at[0], pl.y0 + lf.at[1], pl.z + lf.at[2]);
      leaves.push(g);
    }
    soilTop.push({ x: pl.x, z: pl.z, y0: pl.y0 + pl.pot.h - 0.012, y1: pl.y0 + pl.pot.h, rt: pl.pot.r1 - 0.012, rb: pl.pot.r1 - 0.012 });
  }
  mergedMesh(living, leaves.map((geo) => ({ geo, mat: mats.leaf, keepUV: true })), { cast: false });
  mergedMesh(living, soilTop.map((c) => ({ geo: cylGeo(c), mat: mats.dark })), { cast: false });

  // the print's two colour bands (the frame merged with the shelf boards)
  for (const band of D.art.bands) {
    mergedMesh(living, [{ geo: boxGeo(band.box), mat: mats[band.mat] }], { cast: false });
  }

  // the TV's face: the panel is a body with a screen glued to it, like every
  // real set. Issue #84 swapped the standby glow for the KART DASH canvas
  // (mats.screen carries it); keepUV keeps the texture mapped exactly once
  // across the panel — a game screen is not a wallpaper tile. Same soft halo
  // decal — a light on the telly was never in the rig, and row 39's glow is
  // emissive anyway.
  const [tvScreen] = mergedMesh(
    living,
    [{ geo: new THREE.PlaneGeometry(LIV_TV_FACE[0], LIV_TV_FACE[1]).rotateY(-Math.PI / 2), at: [2.208, 1.2, -1.7], mat: mats.screen, keepUV: true }],
    { cast: false },
  );
  tvScreen.name = 'living-tv-screen'; // the checks of issue #84 find it by name
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(LIV_TV_FACE[0] + 0.5, LIV_TV_FACE[1] + 0.5).rotateY(-Math.PI / 2),
    glowMaterial(0x9ecbe8, 0.22),
  );
  halo.position.set(2.205, 1.2, -1.7);
  halo.name = 'living-tv-halo';
  living.add(halo);
}

// The screen's face, inset 3 cm inside the panel on every side; the panel's
// own numbers are the ruler's (row 39), this is bezel arithmetic.
const LIV_TV_FACE = [1.22 - 0.06, 0.71 - 0.06];

/** Everything the data describes, hung under one group.
 *  `boot` (issue #84) carries the engine's resolved SETTINGS and gateOff so
 *  the TV screen can pick its quality/calm/frozen modes; the built screen
 *  rides back out on `living.userData.tv` for the apartment and the checks. */
export function buildFullLiving(parent, boot = {}) {
  const tv = createKartScreen({
    quality: boot.SETTINGS?.quality ?? 'full',
    calm: !!boot.SETTINGS?.reducedMotion,
    gateOff: !!boot.gateOff,
  });
  const mats = livingMaterials(tv);
  const living = new THREE.Group();
  living.name = 'living-room';
  parent.add(living);

  buildPieces(living, mats);
  buildDetails(living, mats);
  tv.attach(living.getObjectByName('living-tv-screen'));
  living.userData.tv = tv;

  // the lamp: the shade is emissive, and the bulb behind it is real — the
  // sixth punctual light of the rig's six, warm, decay 2, a reach no wider
  // than the seating group.
  const bulb = new THREE.PointLight(0xffd9a0, 4.0, 4.0, 2);
  bulb.position.set(-2.72, 1.44, -1.55);
  bulb.castShadow = false;
  bulb.name = 'living-lamp-bulb';
  living.add(bulb);

  // The room's standing policy, applied in one sweep: nothing casts (the
  // shadow pass is spent), everything receives (the window sun lands).
  living.traverse((o) => {
    if (o.isMesh && !o.material.transparent) o.receiveShadow = true;
    if (o.isMesh) o.castShadow = false;
  });
  return living;
}
