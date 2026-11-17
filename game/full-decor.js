/*!
 * game/full-decor.js — the flat's black-and-white LOOKALIKE DECOR, as DATA
 * (issue #69).
 *
 * What this is: the scenery that makes a visitor blink — framed abstract
 * ink art on five walls, a cow-patch duvet panel, patchwork cushions, a
 * folded check throw, a hand towel and a folded stack, a patchy bath mat,
 * a black pot with white accents, black-and-white books and a storage box.
 * All of it is the flat's OWN black-and-white: none of it has eyes, ears,
 * whiskers, a cat silhouette, a tail-dash or a bib, and none of it stands
 * where a cat can lie (the spot-capsule rule below is enforced by checks,
 * not by hope). It reads "is that Bobo?" for a half-second at a glance and
 * resolves as objects the moment you look — the decoy cat is the game's
 * tell; this is the wallpaper equivalent that decorates without cheating.
 *
 * Why the split is like this: same convention as game/full-entry.js /
 * game/full-entry-mesh.js. This file imports no Three.js and touches no
 * canvas, so game/full.js's checks can import the table directly. The
 * pieces all share ONE canvas atlas (game/full-decor-mesh.js builds it),
 * so the whole collection merges into ONE world-baked mesh — one draw on
 * the flat's worst frame, and the 150-call budget (issue #61) pays it once.
 *
 * Placement is anchored, never eyeballed: every piece declares what it
 * rests ON (a wall plane, a furniture top, the bar, the floor) and the
 * support height is read BACK from the same tables that draw that
 * furniture (full-living.js, full-bath.js, full-bedroom.js, the shell's
 * SUPPORT_DEFS), so a piece cannot float when a future issue moves its
 * host, and `decor-rests-on-surface` fails the build if one ever does.
 */
import { PIECES as LIVING_PIECES, FOOT as LIV_FOOT, LIV } from './full-living.js';
import { PIECES as BATH_PIECES, FOOT as BATH_FOOT, CURTAIN } from './full-bath.js';
import { PIECES as BED_PIECES, SUPPORTS as BED_SUPPORTS, BEDROOM_DIMS, FACES as BR_FACES } from './full-bedroom.js';
import { SUPPORT_DEFS } from './full-shell.js';

/** A box in the flat's own convention (world x/z, y from the floor). */
const bx = (x0, y0, z0, x1, y1, z1) => ({ x0, x1, y0, y1, z0, z1 });

/** --------------------------------------------------------------------------
 *  Support heights, read back from the tables that draw the furniture.
 *  Nothing here is re-typed: a top that moves moves these numbers too.
 *  -------------------------------------------------------------------------- */
const livingTop = (group) => Math.max(...LIVING_PIECES.filter((p) => p.group === group || p.scale === group).flatMap((p) => p.parts.map((b) => b.y1)));
const bathTop = (id) => Math.max(...BATH_PIECES.filter((p) => p.id === id).flatMap((p) => p.parts.map((b) => b.y1)));

/** Named support planes a decor piece may rest on: { y } for a top surface,
 *  { hang } for a bar to drape over, and `restOn` naming the COLLIDERS whose
 *  footprint the host IS — a duvet lies ON the bed, and the bed's collider
 *  is the bed, so the `decor-off-openings` check lets those pieces stand.
 *  The mesh builds to these, the checks measure against these. */
export const DECOR_HOSTS = {
  floor: { y: 0, restOn: [] },
  'coffee-table': { y: livingTop('coffee-table'), restOn: ['coffee-table'] }, // 0.45 — SIGHT_HEIGHTS agrees
  bed: { y: BED_SUPPORTS.bedTop.top, restOn: ['bed'] }, // 0.50 — the coverlet plane itself
  dresser: { y: BEDROOM_DIMS.dresser.top, restOn: ['dresser'] }, // 0.78
  wardrobe: { y: BEDROOM_DIMS.wardrobe.h, restOn: ['wardrobe'] }, // 2.10
  'vanity-rim': { y: bathTop('vanity'), restOn: ['vanity'] }, // 0.87 — the bowl rim's lip, the flat tile the folded stack sits on
  'towel-bar': { hang: bathTop('towel-bar'), restOn: [] }, // 1.165 — the bar's top, where the duck-egg towel drapes too
};

/** The wall planes the pieces hang ON, from the same faces every other
 *  module quotes (full-living's FOOT.art hugs −3.28; the openings' `fixed`
 *  values are the other faces). */
export const DECOR_WALLS = {
  'living.w': -3.28, 'living.e': 2.4, 'living.n': -2.9, 'living.s': 2.1,
  'kitchen.e': 5.52,
  'hall.w': -0.9,
  'entry.e': 2.4,
  'bathroom.e': -1.02,
  'bedroom.w': BR_FACES.w, // −2.60, flush like the headboard
  'bedroom.n': BR_FACES.n, // 5.32, flush like the desk's back
};

/** --------------------------------------------------------------------------
 *  The atlas cells (the mesh module paints them; the checks only count and
 *  size them). 4×4 grid of 64 px in one 256×256 canvas.
 *
 *  `art-*` are the gallery patterns: abstract ink blots, rings, a horizon,
 *  two white-on-black. None is figurative — see the header for why.
 *  -------------------------------------------------------------------------- */
export const DECOR_CELLS = [
  'art-a1', 'art-a2', 'art-a3', 'art-a4',
  'art-a5', 'art-a6', 'art-a7', 'art-a8',
  'duvet', 'cushion', 'check', 'towel',
  'pot', 'book', 'box', 'swatch',
];

/** The budget the checks enforce: new canvas textures and their sizes.
 *  The whole collection is ONE texture; `swatch` carries the plain faces
 *  (black frame returns, cream page edges, charcoal pot bottoms) so not a
 *  single extra material is needed to draw the back of anything. */
export const DECOR_TEXTURES = [{ id: 'decor-atlas', size: 256 }];

/** How far decor keeps from a cat spot: a 0.16 m capsule (the cat's own
 *  half-width at the widest pose) plus 5 cm of respect, from the support
 *  up to 42 cm (a seated Bobo's eye line). Horizontal overlap below the
 *  capsule floor or above its roof is fine — a 12 mm duvet panel does not
 *  reach a sitting cat — but nothing pokes INTO the band a lie-down can. */
export const SPOT_CLEAR = { radius: 0.16, gap: 0.05, roof: 0.42 };

/** A piece: what it is, which cell it wears, the box it draws as, and what
 *  holds it up. `face` names the wall plane key for hung pieces; `host`
 *  names a DECOR_HOSTS row for standing ones; `bar` drapes over a bar. */
const P = (id, room, kind, cell, box, mount, extra = {}) => ({
  id, room, kind, cell, box, ...mount, ...extra,
});

/** --------------------------------------------------------------------------
 *  THE LIST. One place, every piece, in room order. docs/LEVEL_LAYOUT.md
 *  carries the same list in prose for the humans.
 *
 *  Sizes stay in the issue's 0.4 … 1.0 m band for art and hang at eye
 *  level (centres ~1.5 m); none sits over a door or window (each pier,
 *  flank and gap-between was measured against OPENINGS); the bathroom
 *  pieces clear the tile band (top y 1.2 + proud) and the curtain rod's
 *  findable gap east of CURTAIN.clothX1 stays exactly that.
 *  -------------------------------------------------------------------------- */
export const DECOR = [
  // ── living room ──────────────────────────────────────────────────────────
  // above the sofa's north end — the existing colour-block piece owns the
  // sofa's middle (z −0.55 … 0.35); this one hangs clear of it, portrait.
  P('art-living-sofa-n', 'living', 'art', 'art-a1', bx(-3.28, 1.28, -1.05, -3.245, 1.84, -0.63), { wall: 'living.w' }),
  // the north pier between the window (x ≤ −0.3) and the slider (x ≥ 0.85)
  P('art-living-npier', 'living', 'art', 'art-a2', bx(0.10, 1.25, -2.90, 0.60, 1.85, -2.867), { wall: 'living.n' }),
  // the pier between the kitchen doorway (z ≤ 0.3) and the window (z ≥ 1.0)
  // turned out to be the parked kitchen leaf's run (it lies along the same
  // plaster, z 0.38 … 1.24 — measured off the door geometry) — so this piece
  // hangs on the SOUTH plaster instead: east of the hall door (x ≥ 0.45) and
  // its parked leaf (which runs west), above the dining set's reach.
  P('art-living-dine', 'living', 'art', 'art-a3', bx(0.75, 1.28, 2.067, 1.25, 1.84, 2.10), { wall: 'living.s' }),
  // the south wall west of the hall opening (x ≥ 0.45), clear of the
  // living-hall leaf parked along the same plaster (x −1.31 … −0.45)
  P('art-living-south', 'living', 'art', 'art-a4', bx(-2.62, 1.28, 2.067, -2.14, 1.84, 2.10), { wall: 'living.s' }),
  // the black pot with its white ring-and-dot band, on the coffee table's
  // clear north half (the drawn table is x −1.9 … −1.3, z −0.65 … 0.45);
  // it is a pot, empty, and deliberately NOT under the window's light patch
  P('pot-coffee', 'living', 'object', 'pot', bx(-1.70, 0.45, -0.25, -1.50, 0.61, -0.05), { host: 'coffee-table' }, { shape: 'cyl', r: 0.10 }),
  // two black-and-white books flat under the pot's elbow, page edges up
  P('books-coffee-1', 'living', 'object', 'book', bx(-1.55, 0.45, 0.12, -1.36, 0.472, 0.38), { host: 'coffee-table' }),
  P('books-coffee-2', 'living', 'object', 'book', bx(-1.52, 0.472, 0.15, -1.38, 0.492, 0.36), { host: 'coffee-table' }),

  // ── kitchen ──────────────────────────────────────────────────────────────
  // the one bare stretch of the east wall: between the fridge (z ≤ −2.2)
  // and the range/hood (z ≥ −1.35), under no upper (upper-e starts at z −0.75)
  P('art-kitchen-e', 'kitchen', 'art', 'art-a5', bx(5.487, 1.24, -2.12, 5.52, 1.88, -1.48), { wall: 'kitchen.e' }),

  // ── hall ─────────────────────────────────────────────────────────────────
  // the west plaster between the bathroom opening (z ≤ 3.45) and the
  // console end of the room — the runner's wall, opposite the console print
  P('art-hall-w', 'hall', 'art', 'art-a6', bx(-0.90, 1.26, 3.72, -0.867, 1.82, 4.28), { wall: 'hall.w' }),

  // ── entry ────────────────────────────────────────────────────────────────
  // over the coat bench (seat 0.45, back 2.38), below the hat shelf's sight
  // line and clear of the pendant at (1.78, 3.5)
  P('art-entry-e', 'entry', 'art', 'art-a7', bx(2.367, 1.32, 2.68, 2.40, 1.92, 3.22), { wall: 'entry.e' }),

  // ── bathroom ─────────────────────────────────────────────────────────────
  // the east plaster south of the doorway, hung ABOVE the tile band
  // (tileTop 1.2): bottom edge 1.36, clear of the rod bracket at x −1.72
  P('art-bath-e', 'bathroom', 'art', 'art-a8', bx(-1.053, 1.36, 4.22, -1.02, 1.92, 4.62), { wall: 'bathroom.e' }),
  // a striped hand towel on the SAME bar as the duck-egg one, east of it —
  // the bar runs to x −1.45 and the toilet's footprint ends at −1.65
  P('towel-bath-hang', 'bathroom', 'towel', 'towel', bx(-1.640, 0.905, 2.218, -1.465, 1.168, 2.272), { bar: 'towel-bar' }),
  // a folded stack on the vanity's south band: rim top 0.87, west of the
  // bowl's rim, clear of the `vanity` spot's capsule at (−2.65, 2.46)
  P('towel-bath-stack', 'bathroom', 'towel', 'towel', bx(-3.275, 0.87, 2.595, -2.990, 0.945, 2.695), { host: 'vanity-rim' }),
  // the patchy mat the enlargement left room for: east of the seafoam one
  // (x −2.65 … −1.75) and west of the east plaster, clear of the bin (z ≥ 4.9)
  P('mat-bath', 'bathroom', 'rug', 'duvet', bx(-1.60, 0.0, 3.92, -1.12, 0.022, 4.48), { host: 'floor' }),

  // ── bedroom ──────────────────────────────────────────────────────────────
  // over the headboard (top 1.20): bottom edge 1.40, centred z
  P('art-bed-head', 'bedroom', 'art', 'art-a2', bx(-2.60, 1.40, 7.42, -2.567, 2.02, 8.30), { wall: 'bedroom.w' }),
  // the north plaster between the desk's west end and the monitor's crown
  // (panel top 1.27): hung 15 cm over it, west of the door leaf parked at
  // x 0.53 … 1.39 on the same wall (the leaf took the east pier — measured)
  P('art-bed-desk', 'bedroom', 'art', 'art-a4', bx(-2.52, 1.42, 5.32, -2.22, 1.98, 5.353), { wall: 'bedroom.n' }),
  // the cow-patch duvet panel across the bed's middle — between the
  // `bed-stretch` spot (−1.6, 7.55) and the folded blanket (x ≥ −0.91),
  // 12 mm proud of the coverlet: it is bedding, not a lying place of its own
  P('duvet-bw', 'bedroom', 'bedding', 'duvet', bx(-1.30, 0.50, 7.25, -0.95, 0.512, 7.85), { host: 'bed' }),
  // two patchwork cushions standing off the pillow ends, and the check
  // throw folded into the gap between the pillows (7.72 … 7.99)
  P('cushion-bed-n', 'bedroom', 'bedding', 'cushion', bx(-2.04, 0.50, 7.28, -1.88, 0.72, 7.54), { host: 'bed' }),
  P('cushion-bed-s', 'bedroom', 'bedding', 'cushion', bx(-2.04, 0.50, 8.15, -1.88, 0.72, 8.41), { host: 'bed' }),
  P('throw-bed', 'bedroom', 'bedding', 'check', bx(-2.44, 0.50, 7.73, -2.14, 0.55, 7.97), { host: 'bed' }),
  // a low stack of black-and-white books on the dresser top, and the one
  // storage box the wardrobe's 2.10 m lid has always been waiting for
  P('books-dresser-1', 'bedroom', 'object', 'book', bx(0.80, 0.78, 5.55, 1.12, 0.805, 5.85), { host: 'dresser' }),
  P('books-dresser-2', 'bedroom', 'object', 'book', bx(0.83, 0.805, 5.58, 1.09, 0.828, 5.83), { host: 'dresser' }),
  P('box-wardrobe', 'bedroom', 'object', 'box', bx(0.72, 2.10, 7.35, 1.10, 2.32, 7.95), { host: 'wardrobe' }),
];

/** Every piece that counts as one of the issue's "≥ 8 framed art pieces". */
export const DECOR_ART_COUNT = DECOR.filter((p) => p.kind === 'art').length;

/** --------------------------------------------------------------------------
 *  Face plan: which cell each box face wears, in the geometry's own face
 *  order (px nx py ny pz nz — the order three.js lays a BoxGeometry out, and
 *  the order game/full-decor-mesh.js remaps UVs in). Exported so a check can
 *  prove the atlas never puts a pattern where a cat's body would be seen:
 *  hung pieces show their pattern to the ROOM, and the faces buried in a
 *  wall or a host stay plain swatch.
 *  -------------------------------------------------------------------------- */
export function faceCells(p) {
  const solid = p.kind === 'art' ? 'blk' : 'wht'; // frame backs black, cloth edges warm white
  const F = { px: solid, nx: solid, py: solid, ny: solid, pz: solid, nz: solid };
  if (p.wall) {
    const front = { w: 'px', e: 'nx', n: 'pz', s: 'nz' }[p.wall.split('.')[1]];
    F[front] = p.cell;
    if (p.kind === 'towel') F[front === 'px' ? 'nx' : front === 'nx' ? 'px' : front === 'pz' ? 'nz' : 'pz'] = p.cell; // cloth reads from both sides
  } else if (p.bar) {
    F.pz = p.cell; // the north-plaster bar's towel shows south into the room
    F.nz = p.cell;
  } else if (p.shape === 'cyl') {
    F.sides = p.cell;
    F.py = 'blk';
    F.ny = 'blk';
  } else if (p.kind === 'book') {
    F.px = F.nx = F.pz = F.nz = p.cell; // covers on all four sides
    F.py = 'cru'; // page edges up
    F.ny = solid;
  } else if (p.kind === 'rug' || p.kind === 'bedding') {
    F.py = p.cell; // flat goods read from above; the sides are their binding
    if (p.kind === 'bedding' && p.id.startsWith('cushion')) F.px = F.nx = F.pz = F.nz = p.cell;
    if (p.kind === 'bedding' && p.id === 'throw-bed') F.pz = F.nz = p.cell;
  } else if (p.kind === 'towel' && p.host) {
    F.px = F.nx = F.pz = F.nz = p.cell;
    F.py = p.cell; // a folded stack reads as cloth from above too
  } else {
    F.px = F.nx = F.pz = F.nz = p.cell; // objects: all four faces, plain lid
    F.py = p.kind === 'object' ? 'cru' : p.cell;
  }
  return F;
}

/** The swatch cell's quadrants, in the order faceCells names them:
 *  blk = frame black, wht = paper white, cru = page cream, chg = charcoal. */
export const SWATCH = ['blk', 'wht', 'cru', 'chg'];

/** Everything the checks need about every piece, flattened: the box, the
 *  host it claims, and the support height that claim implies — resolved
 *  against DECOR_HOSTS / DECOR_WALLS so a stale literal in the table above
 *  cannot pass by agreeing with itself. */
export function decorPlan() {
  return DECOR.map((p) => {
    const host = p.host ? DECOR_HOSTS[p.host] : null;
    return {
      id: p.id,
      room: p.room,
      kind: p.kind,
      box: p.box,
      host: p.host ?? null,
      restY: host ? host.y ?? null : null,
      restOn: host ? host.restOn : p.wall ? [] : p.bar ? [] : null,
      hangY: p.bar ? DECOR_HOSTS[p.bar].hang : null,
      wallPlane: p.wall ? DECOR_WALLS[p.wall] : null,
      wallKey: p.wall ?? null,
    };
  });
}

/** The two bathroom fixtures the mat and the folded stack keep out of the
 *  way of, re-exported so the docs/LEVEL_LAYOUT prose and the checks read
 *  the same numbers (they are already in DECOR_HOSTS-derived placements). */
export const DECOR_NEAR = {
  seafoamMat: BATH_FOOT.mat,
  curtainClothEnd: CURTAIN.clothX1,
  sofa: LIV_FOOT.sofa,
};
