/*!
 * game/full-entry-mesh.js — the front door's room, and the hall behind it,
 * drawn (issue #67).
 *
 * game/full-entry.js holds the numbers; this file puts geometry on them and
 * nothing else, the same split game/full-bath.js / game/full-bath-mesh.js set
 * up. The budget decides the mesh count, as it always does here, and the
 * budget is why these two rooms are painted cream: see `entryMaterials`. The
 * bench is its own world-baked draw because `furniture-real-scale` measures its
 * world AABB and a mesh that also held the coat hooks would measure the hooks;
 * the lit shades are their own because nothing else at this level in the flat
 * glows; everything else is meant to disappear into a bucket the flat already
 * pays for.
 *
 * Nothing here is a light. The flat is at tools/capture.mjs's `realLights ≤ 6`
 * cap — sun, four fills, the living lamp's bulb — so the fixtures are emissive
 * bodies and the fills under them are the light, the convention the bathroom's
 * frosted pane and the living room's lamp shade already keep.
 */
import * as THREE from 'three';
import { surface } from '../src/polish.js';
import { mergedMesh } from './full-apartment.js';
import { ENTRY, ENTRY_PIECES, SOFT_GOODS, DECOR, FIXTURES, CEIL_Y } from './full-entry.js';

/** Two materials, and one of them is on purpose not new.
 *
 *  `trim` is game/full-apartment.js's trim recipe, called the same way: the
 *  flat already has a merge-eligible bucket of meshes that shade exactly like
 *  it — the door casings, skirting, window boards and sills — and
 *  game/full-merge.js folds siblings by shading signature (colour, maps, shadow
 *  flags), not by what a thing is called. So the hooks, the console, the mat,
 *  the runner and the print land in that bucket and cost the flat NO draw.
 *  What is left is the bench (its own, because the ruler measures it) and the
 *  lit shades (their own, because nothing else here glows): two draws for
 *  issue #67's entire entry dressing, which is what kept the flat's worst
 *  frame inside tools/capture.mjs's 150-call budget.
 *
 *  A painted board path down a hall is also simply what a hall like this has:
 *  oak boards underfoot, cream paint over the walk line, the same cream as the
 *  casings it runs between. */
function entryMaterials() {
  return {
    trim: surface(0xf2eee5, { uvTile: 0.8, roughness: 0.6 }),
    glow: surface(0xfff6e6, {
      uvTile: 0.5,
      roughness: 0.9,
      emissive: new THREE.Color(0xfff0d8), // a lit shade, seen from below
      emissiveIntensity: 1.15,
    }),
  };
}

/** The data names what a thing IS; the mesh module decides what it is MADE of.
 *  Only the fixtures shade differently from the trim, and that is the whole
 *  material list. */
const MADE_OF = { wood: 'trim', rug: 'trim', decor: 'trim', glow: 'glow' };

const size = (p) => [p.x1 - p.x0, p.y1 - p.y0, p.z1 - p.z0];
const centre = (p) => [(p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2, (p.z0 + p.z1) / 2];

/** A box part, baked into world position. */
const boxGeo = (p) => {
  const g = new THREE.BoxGeometry(...size(p));
  g.translate(...centre(p));
  return g;
};

/** A ceiling body: a truncated shade with a diffuser face hung just below it,
 *  so the glow reads as a shallow dish and not a decal. With `drop` it is a
 *  pendant instead: a cord off the plaster and the same dish at its end. */
function puckGeo({ at: [x, z], radius, drop = 0 }) {
  const out = [];
  if (drop) {
    const cord = new THREE.CylinderGeometry(0.009, 0.009, drop, 8);
    cord.translate(x, CEIL_Y - drop / 2, z);
    out.push(cord);
  }
  const yShade = CEIL_Y - drop;
  const shade = new THREE.CylinderGeometry(radius * 0.5, radius, 0.1, 20);
  shade.translate(x, yShade - 0.05, z);
  const face = new THREE.CylinderGeometry(radius * 0.94, radius * 0.94, 0.014, 20);
  face.translate(x, yShade - 0.107, z);
  out.push(shade, face);
  return out;
}

/** The whole entry and hall dressing: three meshes on the flat's root, of
 *  which the flat pays for two.
 *
 *  Deliberately UNNAMED. game/full-merge.js will not fold a mesh that carries a
 *  `name` (issue #61: a name means a check looks that mesh up on its own), and
 *  nothing here is looked up — the bench excepted, and that one is locked by its
 *  `scale` tag anyway. The shadow flags match the shell's trim boards and sills
 *  (cast off, receive on), which is the other half of folding into their bucket.
 *  The 15 mm of pile and the 4 cm of picture frame have no business throwing
 *  shadows in a room lit from a fill at 2.34 m. */
export function buildFullEntry(flat) {
  const mats = entryMaterials();
  const matOf = (item) => mats[MADE_OF[item.mat] ?? item.mat];

  // ── the bench: its own draw, because `furniture-real-scale` measures its
  //    world AABB and a mesh that also held the coat hooks would measure those
  const bench = ENTRY_PIECES.find((p) => p.scale);
  for (const m of mergedMesh(flat, bench.parts.map((b) => ({ geo: boxGeo(b), mat: matOf(bench) })), { cast: false })) {
    m.userData.scale = bench.scale;
  }

  // ── everything that shades like trim, in one buffer ───────────────────────
  const painted = [];
  for (const p of ENTRY_PIECES.filter((q) => !q.scale)) painted.push(...p.parts.map((b) => ({ geo: boxGeo(b), mat: matOf(p) })));
  for (const s of SOFT_GOODS) painted.push({ geo: boxGeo(s.part), mat: matOf(s) });
  for (const d of DECOR) painted.push({ geo: boxGeo(d.part), mat: matOf(d) });
  mergedMesh(flat, painted, { cast: false });

  // ── and the lit shades ────────────────────────────────────────────────────
  const lit = [];
  for (const f of FIXTURES) {
    const mat = matOf(f);
    if (f.bar) lit.push({ geo: boxGeo(f.bar), mat });
    if (f.at) for (const g of puckGeo(f)) lit.push({ geo: g, mat });
  }
  mergedMesh(flat, lit, { cast: false, receive: false });

  return { ENTRY };
}
