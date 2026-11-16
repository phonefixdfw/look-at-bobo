/**
 * full-bedroom.js — the bedroom furniture, at real scale (issue #48).
 *
 * Plan §2 puts the bed with its headboard against the WEST wall. That is the
 * one anchor this module is not free to move: the headboard sits flush on the
 * west face (x -2.60, gap 0.00, tolerance 0.05 — issue #48), the mattress
 * runs south off it, and both nightstands sit flush on the same wall, one
 * either side of the headboard, their inner faces meeting its edges.
 *
 * Everything else hangs off that:
 *   - the desk keeps the 1.40 x 0.70 m rectangle the north strip already has
 *     (x -2.55..-1.15, z 5.32..6.02), so the existing `deskTop` and `kbTop`
 *     planes (0.75 / 0.79) hold untouched; the keyboard, monitor and chair
 *     sit inside that same strip;
 *   - the dresser and the wardrobe get the east wall, split by the mid-bed
 *     walkway so the 0.90 m door-to-window lane stays clear;
 *   - the laundry basket and its spilling pile go south-east of the bed,
 *     beside the south-window lane, where the old `laundryTop` rect (0.55)
 *     still lands on the pile's top.
 *
 * The cat-moment planes are exactly per plan: bed top 0.50, folded blanket
 * 0.58, keyboard 0.79, desk 0.75, laundry 0.55. Bedding is deliberately
 * mid-tone — the cats are black and white, so sage and terracotta read.
 *
 * Same module rule as full-kitchen.js: no engine or three imports, so the
 * checks can import this directly. The builder is full-bedroom-mesh.js.
 */

// ---------------------------------------------------------------------------
// The room's faces (mirrors full-shell.js's bedroom wall boxes). Exported so
// the mesh builder and the checks agree on what "flush west" means.
// ---------------------------------------------------------------------------
export const BR = {
  x0: -2.60, // west face  (the bed's headboard is flush against this)
  x1: 1.20,  // east face  (dresser and wardrobe are flush against this)
  z0: 5.32,  // north face (the desk's back plane is on this)
  z1: 9.32,  // south face (the window; the curtains hang on this)
  doorX: [-0.53, 0.53], // the bedroom's door, high on the north wall
};

export const FACES = { w: BR.x0, e: BR.x1, n: BR.z0, s: BR.z1 };

/** How flush "flush to a wall" is (issue #48: gap <= 0.05). */
export const FLUSH_TOL = 0.05;

// ---------------------------------------------------------------------------
// Real-world measurements (ISSUE_33_REBUILD.md §1, ruler rows 42-51).
// ---------------------------------------------------------------------------
export const BEDROOM_DIMS = {
  headboard: { w: 1.58, d: 0.10, top: 1.20 },        // rows 43+51
  bed: { w: 1.53, d: 2.03, top: 0.50 },              // row 42 — `bedTop`
  blanket: { w: 1.53, d: 0.30, top: 0.58 },          // row 44 — `blanketTop`
  desk: { w: 1.40, d: 0.70, top: 0.75 },             // row 45 — `deskTop`
  keyboard: { w: 0.44, d: 0.13, top: 0.79 },         // row 46 — `kbTop`
  monitor: { w: 0.54, d: 0.16, h: 0.52, top: 1.27 }, // row 47 (union)
  nightstand: { w: 0.45, d: 0.50, top: 0.55 },       // rows 48+51
  dresser: { w: 1.22, d: 0.78, top: 0.78 },          // east-wall dresser
  wardrobe: { w: 0.60, d: 1.15, h: 2.10 },           // east-wall wardrobe
  basket: { w: 0.40, d: 0.30, rim: 0.37 },           // row 50
  pile: { top: 0.55 },                               // row 51 — `laundryTop`
  plant: { r: 0.16, rim: 0.32, leafTop: 1.00 },
};

/**
 * The five pieces the issue calls flush — the flush-to-wall self-test reads
 * `PIECES` through this list: which face each hugs, and its tag.
 */
export const FLUSH_PIECES = [
  { id: 'bed-headboard', face: 'w', tag: 'headboard', wall: FACES.w },
  { id: 'nightstand-north', face: 'w', tag: 'nightstand', wall: FACES.w },
  { id: 'nightstand-south', face: 'w', tag: 'nightstand', wall: FACES.w },
  { id: 'dresser', face: 'e', tag: 'dresser', wall: FACES.e },
  { id: 'wardrobe', face: 'e', tag: 'wardrobe', wall: FACES.e },
];

/**
 * The support planes bedroom cat moments stand on, as the shell's
 * SUPPORT_DEFS carry them (`game/full-shell.js`), against the layout here.
 * `furniture-real-scale` measures these and only these; `deskTop`, `kbTop`
 * and `laundryTop` stay exactly as the plan drew them and are cross-checked
 * against the keyboard's and the pile's real geometry below.
 */
export const SUPPORTS = {
  bedTop: { x0: -2.48, z0: 7.09, x1: -0.49, z1: 8.64, top: 0.50 },
  blanketTop: { x0: -0.89, z0: 7.16, x1: -0.63, z1: 8.57, top: 0.58 },
  nightstandTop: { x0: -2.58, z0: 6.57, x1: -2.17, z1: 7.03, top: 0.55 },
  kbTop: { x0: -2.13, z0: 5.74, x1: -1.57, z1: 5.90, top: 0.79 },
  deskTop: { x0: -2.60, z0: 5.32, x1: -1.10, z1: 6.04, top: 0.75 },
  laundryTop: { x0: 0.57, z0: 8.80, x1: 1.07, z1: 9.20, top: 0.55 },
};

// ---------------------------------------------------------------------------
// Placement. One band at a time, walking the room from the headboard.
// ---------------------------------------------------------------------------
const bedZ0 = 7.075;                      // head end, flush off the headboard
const bed = { x0: -2.60, x1: -0.47, z0: bedZ0, z1: bedZ0 + 1.58 };  // 1.53 x 2.03
const headboard = { x0: FACES.w, x1: FACES.w + 0.10, z0: bedZ0, z1: bedZ0 + 1.58 };
const nightstand = (z0) => ({ x0: FACES.w, x1: FACES.w + 0.45, z0, z1: z0 + 0.50 });
const nbNorth = nightstand(6.55);         // headboard's north edge - 0.02
const nbSouth = nightstand(bed.z1 + 0.025);

/** A cuboid piece, flat in x0/z0 form like full-kitchen's entries. */
function piece(id, mat, x, y, z, tags, note, group) {
  return {
    id,
    mat,
    x0: Math.min(x[0], x[1]), x1: Math.max(x[0], x[1]),
    y0: Math.min(y[0], y[1]), y1: Math.max(y[0], y[1]),
    z0: Math.min(z[0], z[1]), z1: Math.max(z[0], z[1]),
    tags: tags || null,
    note: note || null,
    group: group || null,
  };
}

export const PIECES = [
  // ---- the bed, head WEST (issue #48: headboard flush against the west wall)
  piece('bed-headboard', 'wood', [headboard.x0, headboard.x1], [0, 1.20],
    [headboard.z0, headboard.z1], ['headboard'],
    'row 43: 1.58 m wide, to 1.20 tall, flush on the west wall (gap 0.00)'),
  piece('bed-frame', 'wood', [bed.x0, bed.x1], [0, 0.30], [7.07, 8.66], ['bed-frame'],
    'row 42: the queen frame — 1.53 x 2.03 m, its head flush off the headboard'),
  piece('bed-mattress', 'mattress', [FACES.w + 0.10, bed.x1], [0.30, 0.48], [7.10, 8.63],
    ['bed-queen'], 'row 42: the mattress on it, 6 cm under the 0.50 coverlet plane'),
  piece('bed-coverlet', 'coverlet', [FACES.w + 0.10, bed.x1 + 0.01], [0.48, 0.50],
    [7.085, 8.645], ['mattress-height'],
    'the coverlet over it — its top is the plan\'s `bedTop` plane at 0.50'),
  piece('bed-pillow-n', 'pillow', [FACES.w + 0.16, FACES.w + 0.54], [0.50, 0.60], [7.18, 7.72],
    null, 'a pillow at the head of the bed, north half', 'bed-pillows'),
  piece('bed-pillow-s', 'pillow', [FACES.w + 0.16, FACES.w + 0.54], [0.50, 0.60], [7.99, 8.53],
    null, 'and its twin, south half', 'bed-pillows'),
  piece('blanket-folded', 'blanket', [-0.91, -0.61], [0.50, 0.58], [7.14, 8.59],
    ['folded-blanket'],
    'row 44: folded across the foot of the bed — its top is `blanketTop` at 0.58'),

  // ---- nightstands flush west, one either side of the headboard ----------
  piece('nightstand-north', 'woodPale', [nbNorth.x0, nbNorth.x1], [0, 0.55],
    [nbNorth.z0, nbNorth.z1], ['nightstand'],
    'rows 48+51: 0.50 x 0.45 m, top 0.55, flush west north of the headboard',
    'nightstand-north'),
  piece('nightstand-south', 'woodPale', [nbSouth.x0, nbSouth.x1], [0, 0.55],
    [nbSouth.z0, nbSouth.z1], ['nightstand'],
    'rows 48+51: the matching one south of the headboard, flush west',
    'nightstand-south'),

  // ---- the desk on the north wall: existing footprint, kept verbatim -----
  piece('desk-top', 'woodPale', [-2.55, -1.15], [0.71, 0.75], [5.32, 6.02], ['desk'],
    'row 45: 1.40 x 0.70 m, top y 0.75 — the `deskTop` rect unchanged', 'desk'),
  piece('desk-legs', 'wood', [-2.51, -1.19], [0, 0.71], [5.36, 5.98], null,
    'the panel legs under the top', 'desk'),
  piece('keyboard', 'applianceDark', [-2.07, -1.63], [0.76, 0.79], [5.755, 5.885], ['keyboard'],
    'row 46: 0.44 x 0.13 x 0.03 m, top y 0.79 — the `kbTop` height unchanged', 'keyboard'),
  piece('monitor-foot', 'applianceDark', [-2.02, -1.68], [0.75, 0.77], [5.36, 5.52], null,
    'row 47: the monitor foot on the desk', 'monitor'),
  piece('monitor-post', 'applianceDark', [-1.89, -1.81], [0.77, 1.03], [5.41, 5.47], null,
    'its post', 'monitor'),
  piece('monitor-panel', 'screen', [-2.12, -1.58], [1.03, 1.27], [5.42, 5.46], ['monitor'],
    'row 47: the screen to y 1.27; 0.54 x 0.16 x 0.52 counting foot and post',
    'monitor'),

  // ---- the chair rolled up to the desk -----------------------------------
  piece('chair-frame', 'metal', [-2.14, -1.82], [0, 0.41], [6.12, 6.46], null,
    'the chair frame under the seat', 'desk-chair'),
  piece('chair-seat', 'seatFabric', [-2.20, -1.76], [0.41, 0.45], [6.08, 6.50], ['desk-chair'],
    'the seat, top y 0.45', 'desk-chair'),
  piece('chair-cushion', 'cushion', [-2.18, -1.78], [0.45, 0.47], [6.10, 6.48], ['seat-height'],
    'a fabric cushion on the seat', 'desk-chair'),
  piece('chair-back', 'seatFabric', [-2.20, -1.76], [0.45, 0.90], [6.45, 6.50], ['desk-chair-back'],
    'its back to y 0.90', 'desk-chair'),

  // ---- the east wall: dresser north of the walkway, wardrobe south -------
  piece('dresser', 'wood', [FACES.e - 0.46, FACES.e], [0, 0.78], [5.40, 6.62], ['dresser'],
    'the dresser: 1.22 m tall x 0.46 deep, flush east north of the walkway',
    'dresser'),
  piece('wardrobe', 'wood', [FACES.e - 0.60, FACES.e], [0, 2.10], [7.05, 8.20], ['wardrobe'],
    'the wardrobe: 1.15 m along the wall, 2.10 tall, flush east', 'wardrobe'),

  // ---- laundry: the basket spilling over, south-east of the bed ----------
  piece('laundry-basket', 'fabricBasket', [0.62, 1.02], [0, 0.37], [8.85, 9.15],
    ['laundry-basket'], 'row 50: 0.40 x 0.30 m, rim at 0.37', 'laundry-basket'),
  piece('laundry-pile', 'fabricPile', [0.69, 0.95], [0.40, 0.55], [8.895, 9.105],
    ['laundry-pile'], 'row 51: the pile, ~0.18 above the rim — its top is `laundryTop`',
    'laundry-pile'),

  // ---- soft goods: rug and curtains ---------------------------------------
  piece('bedroom-rug', 'rug', [-0.40, 0.56], [0, 0.012], [6.20, 8.45], null,
    'the rug on the mid-floor walkway', 'rug'),
  piece('curtain-west', 'curtain', [-1.95, -1.67], [0.85, 2.15], [9.18, 9.24], null,
    'the south window\'s west curtain', 'curtains'),
  piece('curtain-east', 'curtain', [-0.48, -0.20], [0.85, 2.15], [9.18, 9.24], null,
    'and its east curtain', 'curtains'),
];

/**
 * Small parts, drawn with the same material as their piece: the nightstand
 * drawers and pulls, the dresser's drawer gaps and pulls, the wardrobe
 * doors, and the curtain rod. Colliders ignore them, so a pull sticking a
 * centimetre proud of its piece cannot narrow a walkway.
 */
export const DETAILS = [
  // nightstands: a drawer face, a drawer, a pull — on the east face
  ...['nightstand-north', 'nightstand-south'].flatMap((id) => {
    const p = PIECES.find((q) => q.id === id);
    return [
      { id: `${id}-drawer`, mat: 'woodPale', parent: id,
        x: [p.x1 - 0.03, p.x1], y: [0.10, 0.50], z: [p.z0 + 0.05, p.z1 - 0.05] },
      { id: `${id}-drawer-face`, mat: 'wood', parent: id,
        x: [p.x1 - 0.01, p.x1 + 0.01], y: [0.13, 0.47], z: [p.z0 + 0.08, p.z1 - 0.08] },
      { id: `${id}-pull`, mat: 'brass', parent: id,
        x: [p.x1 + 0.01, p.x1 + 0.03], y: [0.30, 0.33], z: [p.z0 + 0.19, p.z1 - 0.19] },
    ];
  }),
  // dresser: four drawer gaps, four faces, four pulls — on the west face
  ...[0, 1, 2, 3].flatMap((i) => {
    const p = PIECES.find((q) => q.id === 'dresser');
    const gap = 0.014;
    const h = (p.y1 - 0.06) / 4;
    const y0 = 0.04 + i * h;
    return [
      { id: `dresser-gap-${i + 1}`, mat: 'woodDark', parent: 'dresser',
        x: [p.x0 - gap, p.x0 + 0.02], y: [y0, y0 + h - 0.035], z: [p.z0 + 0.04, p.z1 - 0.04] },
      { id: `dresser-face-${i + 1}`, mat: 'wood', parent: 'dresser',
        x: [p.x0 - 0.025, p.x0], y: [y0 + 0.006, y0 + h - 0.041], z: [p.z0 + 0.045, p.z1 - 0.045] },
      { id: `dresser-pull-${i + 1}`, mat: 'brass', parent: 'dresser',
        x: [p.x0 - 0.04, p.x0 - 0.02], y: [y0 + (h - 0.07) / 2, y0 + (h - 0.07) / 2 + 0.028],
        z: [p.z0 + 0.16, p.z1 - 0.16] },
    ];
  }),
  // wardrobe: two doors and their pulls — on the west face
  ...['n', 's'].map((side) => {
    const p = PIECES.find((q) => q.id === 'wardrobe');
    const zMid = (p.z0 + p.z1) / 2;
    const z0 = side === 'n' ? p.z0 + 0.02 : zMid + 0.015;
    const z1 = side === 'n' ? zMid - 0.015 : p.z1 - 0.02;
    return {
      id: `wardrobe-door-${side}`, mat: 'woodLight', parent: 'wardrobe',
      x: [p.x0 - 0.018, p.x0], y: [0.08, p.y1 - 0.08], z: [z0, z1],
    };
  }),
  ...['n', 's'].map((side) => {
    const p = PIECES.find((q) => q.id === 'wardrobe');
    const zMid = (p.z0 + p.z1) / 2;
    return {
      id: `wardrobe-pull-${side}`, mat: 'brass', parent: 'wardrobe',
      x: [p.x0 - 0.038, p.x0 - 0.018],
      y: [1.12, 1.24],
      z: side === 'n' ? [zMid - 0.10, zMid - 0.07] : [zMid + 0.07, zMid + 0.10],
    };
  }),
  // the curtain rod across the south window
  {
    id: 'curtain-rod', mat: 'metal', parent: 'curtain-west',
    x: [-1.98, -0.17], y: [2.17, 2.20], z: [9.20, 9.23],
  },
];

/**
 * The solid rectangles the bedroom adds to the apartment's collider list, in
 * the flat `{ id, x0, z0, x1, z1 }` shape `full-level.js` carries. The cat
 * pathing treats these as blocking at cat height; the walk-reachability pass
 * must still find a 0.90 m lane from the door to the window between the bed
 * and the wardrobe (x -0.47..0.60 there is 1.07 m of clear floor).
 *
 *  - bed: base + headboard as one footprint (the mattress hangs inside it)
 *  - desk: the desk footprint; the keyboard and monitor sit inside it and
 *    need no rects of their own
 *  - desk-chair: its own rect — it can roll out into the walkway
 *  - the soft pieces (rug, curtains, pillows, blanket, pile) get none
 *  - the plant's rect covers the widest of pot and leaves
 */
export const BEDROOM_COLLIDERS = [
  { id: 'bed', x0: -2.60, z0: 7.07, x1: -0.47, z1: 8.66 },
  { id: 'nightstand', x0: -2.60, z0: 6.55, x1: -2.15, z1: 7.05 },
  { id: 'nightstand-south', x0: -2.60, z0: 8.68, x1: -2.15, z1: 9.18 },
  { id: 'desk', x0: -2.55, z0: 5.32, x1: -1.15, z1: 6.02 },
  { id: 'desk-chair', x0: -2.20, z0: 6.08, x1: -1.76, z1: 6.50 },
  { id: 'dresser', x0: 0.74, z0: 5.40, x1: 1.20, z1: 6.62 },
  { id: 'wardrobe', x0: 0.60, z0: 7.05, x1: 1.20, z1: 8.20 },
  { id: 'laundry-basket', x0: 0.62, z0: 8.85, x1: 1.02, z1: 9.15 },
  { id: 'bedroom-plant', x0: 0.03, z0: 8.81, x1: 0.45, z1: 9.23 },
];
