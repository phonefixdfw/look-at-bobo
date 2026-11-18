/*!
 * Look at Bobo — issue #86: the owner's self-portrait, built in code.
 * ONE merged mesh in ONE draw call (the game/full-roomba-mesh.js trick): the
 * whole man — body, clothes, backwards cap, and the plain controller folded
 * in — shares a single MeshLambertMaterial with vertex colours, plus the
 * flat's face atlas: one 256 px canvas, painted at boot, that carries the
 * soft stubble and subtle mustache, the simple friendly eyes and brow, and
 * the blink. Non-face parts sample a white cell of the same atlas, so the
 * whole character still costs a single draw and a single texture.
 *
 *   * Style: the cats' soft stylized register (docs/ART_STYLE.md), not
 *     photoreal, not caricature. He sits the north cushion of the sofa (the
 *     heat pad keeps the south one), 1.91 m standing built at 1.91 m
 *     proportions — seated top ≈ 1.35 m with the cap, knees ≈ 0.55, solid
 *     athletic-heavy frame — eyes toward the TV, thumbs on the sticks.
 *   * The idle is transform-only: a slow breath (sub-1 % mesh scale), a
 *     micro sway and micro pitch (the head tilt reads at 1.35 m out; hands
 *     and thumbs ride it by a millimetre or two), and a blink drawn by
 *     re-painting the atlas when the blink state flips — no bones, no
 *     vertex writes, pure function of game time, so every capture seek byte
 *     reproduces. `calm` (reduced motion) holds him still, eyes open.
 *   * No shadow: the sun pass would draw him a SECOND time and the scene's
 *     promise is +1 draw call — the lesson game/full-roomba-mesh.js learned
 *     in #85. He is nobody's brand: plain dark cap, plain tee and shorts,
 *     zero text, zero logos — the atlas ledger (ATLAS_OPS) proves the painter
 *     never issued a text or image op, and clothes are vertex colour only.
 */

import { SEAT, SEAT_YAW, HUMAN_BANDS } from './full-human-scene.js';

/** The palette — skin, clothes, cap, in the flat's restrained register.
 *  Vertex colours (linear, as game/full-roomba-mesh.js does): the atlas
 *  multiplies on top, so only the FACE gets atlas features and everything
 *  else stays a plain flat colour. */
const PAINT = {
  skin: [0.905, 0.725, 0.585], // light skin tone
  shirt: [0.298, 0.439, 0.545], // plain slate-blue tee, solid colour
  shirtDeep: [0.26, 0.39, 0.49], // sleeve hems
  shorts: [0.416, 0.388, 0.345], // plain grey-khaki shorts
  sock: [0.847, 0.851, 0.882],
  hair: [0.263, 0.2, 0.157], // short brown hair, visible only at the nape
  cap: [0.157, 0.18, 0.22], // plain dark cap, no logo
  capDeep: [0.125, 0.145, 0.184], // the brim, a shade darker
  pad: [0.196, 0.208, 0.235], // plain controller, no brand marks
  padLight: [0.58, 0.59, 0.62], // the two sticks
};

/** --------------------------------------------------------------------------
 *  The face atlas — one 256 px canvas, two cells: a 64 px white cell every
 *  non-face part samples (the map multiplies as 1 there), and a 128 px face
 *  cell the head sphere projects its front band onto. Stubble is painted as
 *  soft semi-transparent shading (multiply over the skin vertex colour — a
 *  darker-skin-tone wash, not a drawn-on cartoon handlebar), the mustache a
 *  subtle denser strip over the lip. Eyes and brow simple and friendly.
 *  Every op is LEDGERED in ATLAS_OPS: the checks prove no text, no image,
 *  one 256 px texture. */
export const ATLAS_SIZE = 256;
export const ATLAS_OPS = [];
const CELL_WHITE = { x: 0, y: 0, s: 64 };
const CELL_FACE = { x: 96, y: 64, s: 128 };

/** Face-cell coordinates: (du, dv) with (0.5, 0.5) the cell centre, dv
 *  downward (matches the head projection: d.y up → dv up). */
function facePt(du, dv) {
  return [CELL_FACE.x + du * CELL_FACE.s, CELL_FACE.y + dv * CELL_FACE.s];
}

function softBlob(ctx, cx, cy, rx, ry, alpha, op) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, `rgba(35,28,24,${alpha})`);
  g.addColorStop(0.72, `rgba(35,28,24,${alpha * 0.72})`);
  g.addColorStop(1, 'rgba(35,28,24,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
  ATLAS_OPS.push({ op, du: cx, dv: cy, rx, ry, alpha });
}

/** Paint (or re-paint for the blink) the whole atlas from scratch — cheap,
 *  deterministic, idempotent. */
export function paintHumanAtlas(ctx, closed) {
  ATLAS_OPS.length = 0;
  // 1. the whole atlas starts neutral white (the multiply identity)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
  ATLAS_OPS.push({ op: 'fill', du: 0, dv: 0, rx: 1, ry: 1, alpha: 1 });
  ATLAS_OPS.push({ op: closed ? 'blink' : 'open', du: 0.5, dv: 0.32, rx: 0.3, ry: 0.12, alpha: 1 });
  // 2. stubble: a soft wash over the jaw, chin and cheeks' lower third
  const [sx, sy] = facePt(0.5, 0.74);
  softBlob(ctx, sx, sy, 0.365 * CELL_FACE.s, 0.22 * CELL_FACE.s, 0.3, 'stubble');
  softBlob(ctx, ...facePt(0.335, 0.66), 0.085 * CELL_FACE.s, 0.075 * CELL_FACE.s, 0.26, 'stubble-cheek');
  softBlob(ctx, ...facePt(0.665, 0.66), 0.085 * CELL_FACE.s, 0.075 * CELL_FACE.s, 0.26, 'stubble-cheek');
  // 3. the mustache: the same wash a shade denser, straight over the lip —
  //    subtle, the issue's word, never a handlebar
  const [mx, my] = facePt(0.5, 0.585);
  softBlob(ctx, mx, my, 0.115 * CELL_FACE.s, 0.034 * CELL_FACE.s, 0.42, 'mustache');
  // 4. mouth: one soft relaxed line, a hint of a smile at the corners
  ctx.strokeStyle = 'rgba(92,58,48,0.55)';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const [ax, ay] = facePt(0.41, 0.652);
  const [bx, by] = facePt(0.59, 0.652);
  const [cx, cy] = facePt(0.5, 0.672);
  ctx.moveTo(ax, ay);
  ctx.quadraticCurveTo(cx, cy, bx, by);
  ctx.stroke();
  ATLAS_OPS.push({ op: 'mouth', du: 0.5, dv: 0.66, rx: 0.09, ry: 0.02, alpha: 0.55 });
  // 5. nose: a whisper of a shadow under the bridge
  ctx.strokeStyle = 'rgba(60,42,34,0.20)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  const [nx, ny] = facePt(0.455, 0.47);
  ctx.moveTo(nx, ny);
  ctx.quadraticCurveTo(...facePt(0.5, 0.505), ...facePt(0.545, 0.47));
  ctx.stroke();
  ATLAS_OPS.push({ op: 'nose', du: 0.5, dv: 0.49, rx: 0.05, ry: 0.03, alpha: 0.2 });
  // 6. eyes / lids + brows: simple, friendly; the blink redraws these
  for (const side of [0.365, 0.635]) {
    if (closed) {
      ctx.strokeStyle = 'rgba(52,38,30,0.6)';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      const [ex, ey] = facePt(side, 0.335);
      ctx.moveTo(ex - 9, ey);
      ctx.quadraticCurveTo(ex, ey + 4, ex + 9, ey);
      ctx.stroke();
    } else {
      softBlob(ctx, ...facePt(side, 0.32), 0.026 * CELL_FACE.s, 0.034 * CELL_FACE.s, 0.85, 'eye');
      softBlob(ctx, ...facePt(side, 0.308), 0.012 * CELL_FACE.s, 0.014 * CELL_FACE.s, 0.28, 'eye');
    }
    // brow: relaxed, slightly raised toward the TV — always open
    ctx.strokeStyle = 'rgba(66,48,36,0.68)';
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const [lx, ly] = facePt(side - 0.055, 0.242);
    ctx.moveTo(lx, ly + 1.5);
    ctx.quadraticCurveTo(...facePt(side, 0.222), ...facePt(side + 0.055, 0.238));
    ctx.stroke();
    ATLAS_OPS.push({ op: closed ? 'lid' : 'eye-band', du: side, dv: 0.3, rx: 0.03, ry: 0.02, alpha: 0.8 });
    ATLAS_OPS.push({ op: 'brow', du: side, dv: 0.23, rx: 0.06, ry: 0.015, alpha: 0.68 });
  }
}

/** --------------------------------------------------------------------------
 *  THE PARTS — one list, read by the builder and by the checks (same source,
 *  no drift). Local space: the man is BUILT facing -z (the cats' convention:
 *  forward at yaw 0 is -z), y=0 the floor, origin the seat point. `box` is
 *  {cx,cy,cz,w,h,d}; `cyl` runs p0→p1 with radii r0/r1; `sph` sits at p with
 *  r and an optional per-axis scale; `rx` leans the part about the pivot. */
export const HUMAN_PARTS = [
  // torso: a solid athletic-heavy frame, eased a hair toward the telly
  // (#86 fix: a 0.16 rad backward lean slid the chest's top edge away from
  // the head's column and the head read as a blob floating off-body)
  { id: 'chest', mat: 'shirt', kind: 'box', box: { cx: 0, cy: 0.8, cz: -0.04, w: 0.44, h: 0.3, d: 0.26 }, rx: -0.06, rxAt: [0, 0.65, 0.02] },
  { id: 'belly', mat: 'shirt', kind: 'box', box: { cx: 0, cy: 0.565, cz: -0.05, w: 0.36, h: 0.27, d: 0.27 } },
  // neck + head (the head's face band gets the atlas; see remapFaceUVs).
  // #86 fix: the neck used to START 9 cm above the chest's top edge and the
  // head bottom sat 15 cm clear of it — a thin column over open air, which
  // reads as a detached floating head. The neck now sinks deep into the
  // chest and a trapezius slab ties neck, shoulders and chest into ONE
  // continuous torso-to-chin column.
  { id: 'neck', mat: 'skin', kind: 'cyl', p0: [0, 0.86, 0.025], p1: [0, 1.165, 0.025], r0: 0.066, r1: 0.05 },
  { id: 'traps', mat: 'shirt', kind: 'box', box: { cx: 0, cy: 0.955, cz: -0.03, w: 0.5, h: 0.12, d: 0.24 } },
  { id: 'head', mat: 'skin', kind: 'sph', p: [0, 1.215, 0.015], r: 0.112, scale: [0.92, 1, 0.96] },
  { id: 'hair-nape', mat: 'hair', kind: 'sph', p: [0, 1.17, 0.1], r: 0.095, scale: [0.72, 0.52, 0.5] },
  // the backwards cap: dome + button up top, brim facing the +z BACK.
  // #86 fix: the brim used to be a 20 cm-wide plate reaching 8 cm past the
  // dome into open air — a second dark shard beside the head. It now hugs
  // the dome: half buried, ~4 cm of edge showing, the way a flipped brim sits.
  { id: 'cap-dome', mat: 'cap', kind: 'sph', p: [0, 1.235, 0.015], r: 0.122, scale: [0.93, 0.78, 0.95], dome: true },
  { id: 'cap-brim', mat: 'capDeep', kind: 'disc', p: [0, 1.238, 0.092], r: 0.078, t: 0.014 },
  { id: 'cap-button', mat: 'capDeep', kind: 'disc', p: [0, 1.332, 0.015], r: 0.014, t: 0.012 },
  // shoulders + arms, elbows relaxed in, hands closed on the controller
  { id: 'shoulderL', mat: 'shirt', kind: 'sph', p: [-0.185, 0.9, -0.005], r: 0.075 },
  { id: 'shoulderR', mat: 'shirt', kind: 'sph', p: [0.185, 0.9, -0.005], r: 0.075 },
  { id: 'sleeveL', mat: 'shirt', kind: 'cyl', p0: [-0.185, 0.9, -0.005], p1: [-0.208, 0.79, -0.068], r0: 0.078, r1: 0.072 },
  { id: 'sleeveR', mat: 'shirt', kind: 'cyl', p0: [0.185, 0.9, -0.005], p1: [0.208, 0.79, -0.068], r0: 0.078, r1: 0.072 },
  { id: 'upperarmL', mat: 'skin', kind: 'cyl', p0: [-0.208, 0.79, -0.068], p1: [-0.225, 0.645, -0.135], r0: 0.056, r1: 0.05 },
  { id: 'upperarmR', mat: 'skin', kind: 'cyl', p0: [0.208, 0.79, -0.068], p1: [0.225, 0.645, -0.135], r0: 0.056, r1: 0.05 },
  { id: 'forearmL', mat: 'skin', kind: 'cyl', p0: [-0.225, 0.645, -0.135], p1: [-0.103, 0.668, -0.382], r0: 0.055, r1: 0.048 },
  { id: 'forearmR', mat: 'skin', kind: 'cyl', p0: [0.225, 0.645, -0.135], p1: [0.103, 0.668, -0.382], r0: 0.055, r1: 0.048 },
  { id: 'handL', mat: 'skin', kind: 'box', box: { cx: -0.105, cy: 0.68, cz: -0.41, w: 0.075, h: 0.065, d: 0.1 } },
  { id: 'handR', mat: 'skin', kind: 'box', box: { cx: 0.105, cy: 0.68, cz: -0.41, w: 0.075, h: 0.065, d: 0.1 } },
  // the controller, folded in: a plain slab, two grips, two sticks, thumbs
  { id: 'pad-body', mat: 'pad', kind: 'box', box: { cx: 0, cy: 0.6725, cz: -0.405, w: 0.16, h: 0.065, d: 0.1 } },
  { id: 'pad-gripL', mat: 'pad', kind: 'box', box: { cx: -0.065, cy: 0.638, cz: -0.378, w: 0.045, h: 0.062, d: 0.072 } },
  { id: 'pad-gripR', mat: 'pad', kind: 'box', box: { cx: 0.065, cy: 0.638, cz: -0.378, w: 0.045, h: 0.062, d: 0.072 } },
  { id: 'pad-stickL', mat: 'padLight', kind: 'disc', p: [-0.045, 0.712, -0.425], r: 0.017, t: 0.018 },
  { id: 'pad-stickR', mat: 'padLight', kind: 'disc', p: [0.045, 0.712, -0.425], r: 0.017, t: 0.018 },
  { id: 'pad-thumbL', mat: 'skin', kind: 'box', box: { cx: -0.078, cy: 0.706, cz: -0.437, w: 0.03, h: 0.022, d: 0.045 } },
  { id: 'pad-thumbR', mat: 'skin', kind: 'box', box: { cx: 0.078, cy: 0.706, cz: -0.437, w: 0.03, h: 0.022, d: 0.045 } },
  // pelvis and the legs: thighs out over the coffee-table reach, knees ~0.55,
  // feet flat on the floor short of the coffee table (issue's walkway math)
  { id: 'pelvis', mat: 'shorts', kind: 'box', box: { cx: 0, cy: 0.5125, cz: -0.02, w: 0.35, h: 0.195, d: 0.24 } },
  { id: 'shortsL', mat: 'shorts', kind: 'cyl', p0: [-0.11, 0.515, -0.03], p1: [-0.115, 0.515, -0.2], r0: 0.105, r1: 0.102 },
  { id: 'shortsR', mat: 'shorts', kind: 'cyl', p0: [0.11, 0.515, -0.03], p1: [0.115, 0.515, -0.2], r0: 0.105, r1: 0.102 },
  { id: 'thighL', mat: 'skin', kind: 'cyl', p0: [-0.11, 0.515, -0.02], p1: [-0.12, 0.515, -0.4], r0: 0.098, r1: 0.094 },
  { id: 'thighR', mat: 'skin', kind: 'cyl', p0: [0.11, 0.515, -0.02], p1: [0.12, 0.515, -0.4], r0: 0.098, r1: 0.094 },
  { id: 'kneeL', mat: 'skin', kind: 'sph', p: [-0.12, 0.53, -0.42], r: 0.085 },
  { id: 'kneeR', mat: 'skin', kind: 'sph', p: [0.12, 0.53, -0.42], r: 0.085 },
  { id: 'shinL', mat: 'skin', kind: 'cyl', p0: [-0.12, 0.53, -0.42], p1: [-0.125, 0.09, -0.405], r0: 0.068, r1: 0.056 },
  { id: 'shinR', mat: 'skin', kind: 'cyl', p0: [0.12, 0.53, -0.42], p1: [0.125, 0.09, -0.405], r0: 0.068, r1: 0.056 },
  { id: 'footL', mat: 'sock', kind: 'box', box: { cx: -0.125, cy: 0.036, cz: -0.51, w: 0.095, h: 0.072, d: 0.23 } },
  { id: 'footR', mat: 'sock', kind: 'box', box: { cx: 0.125, cy: 0.036, cz: -0.51, w: 0.095, h: 0.072, d: 0.23 } },
];

/** A part's local AABB (a conservative box for every kind — this is what the
 *  real-world bands and the furniture-clearance rows measure). */
export function partLocalBox(part) {
  if (part.kind === 'box') {
    const b = part.box;
    return { x0: b.cx - b.w / 2, y0: b.cy - b.h / 2, z0: b.cz - b.d / 2, x1: b.cx + b.w / 2, y1: b.cy + b.h / 2, z1: b.cz + b.d / 2 };
  }
  if (part.kind === 'sph') {
    const [x, y, z] = part.p;
    const s = part.scale || [1, 1, 1];
    return { x0: x - part.r * s[0], y0: y - part.r * s[1], z0: z - part.r * s[2], x1: x + part.r * s[0], y1: y + part.r * s[1], z1: z + part.r * s[2] };
  }
  if (part.kind === 'disc') {
    const [x, y, z] = part.p;
    return { x0: x - part.r, y0: y - part.t / 2, z0: z - part.r, x1: x + part.r, y1: y + part.t / 2, z1: z + part.r };
  }
  const [x0, y0, z0] = part.p0;
  const [x1, y1, z1] = part.p1;
  const r = Math.max(part.r0, part.r1);
  return { x0: Math.min(x0, x1) - r, y0: Math.min(y0, y1) - (part.kind === 'cyl' ? 0 : r), z0: Math.min(z0, z1) - r, x1: Math.max(x0, x1) + r, y1: Math.max(y0, y1) + (part.kind === 'cyl' ? 0 : r), z1: Math.max(z0, z1) + r };
}

/** The whole man's local AABB, t=0 neutral pose. */
export function humanLocalBox() {
  const out = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
  for (const p of HUMAN_PARTS) {
    const b = partLocalBox(p);
    out.x0 = Math.min(out.x0, b.x0); out.x1 = Math.max(out.x1, b.x1);
    out.y0 = Math.min(out.y0, b.y0); out.y1 = Math.max(out.y1, b.y1);
    out.z0 = Math.min(out.z0, b.z0); out.z1 = Math.max(out.z1, b.z1);
  }
  return out;
}

/** A part's world AABB: its local box, leaned by rx (8 corners), turned to
 *  the seat yaw and put on the seat. Conservative (AABB of a leaned box),
 *  which is the right direction for a clearance check. */
export function partWorldBox(part) {
  const lb = partLocalBox(part);
  const c = Math.cos(SEAT_YAW);
  const s = Math.sin(SEAT_YAW);
  const lean = part.rx || 0;
  const [px, , pz] = part.rxAt || [0, 0, 0];
  const cos = Math.cos(lean);
  const sin = Math.sin(lean);
  const out = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
  for (const x of [lb.x0, lb.x1]) for (const y of [lb.y0, lb.y1]) for (const z of [lb.z0, lb.z1]) {
    let X = x;
    let Y = y;
    let Z = z;
    if (lean) {
      const dy = Y - part.rxAt[1];
      const dz = Z - pz;
      Y = part.rxAt[1] + dy * cos - dz * sin;
      Z = pz + dy * sin + dz * cos;
    }
    const wx = SEAT.x + X * c + Z * s;
    const wz = SEAT.z + -X * s + Z * c;
    out.x0 = Math.min(out.x0, wx); out.x1 = Math.max(out.x1, wx);
    out.y0 = Math.min(out.y0, Y); out.y1 = Math.max(out.y1, Y);
    out.z0 = Math.min(out.z0, wz); out.z1 = Math.max(out.z1, wz);
  }
  return out;
}

/** The man's whole world AABB (union of the parts) — the sight box the lap
 *  `findable` re-run stands him in, and the walkway rect. */
export function humanWorldBox() {
  const out = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
  for (const p of HUMAN_PARTS) {
    const b = partWorldBox(p);
    out.x0 = Math.min(out.x0, b.x0); out.x1 = Math.max(out.x1, b.x1);
    out.y0 = Math.min(out.y0, b.y0); out.y1 = Math.max(out.y1, b.y1);
    out.z0 = Math.min(out.z0, b.z0); out.z1 = Math.max(out.z1, b.z1);
  }
  return out;
}

/** --------------------------------------------------------------------------
 *  The builder. `THREE` in, one {group, mesh} out, exactly the #85 shape. */
export function buildFullHuman({ THREE, quality = 'full' }) {
  const low = quality === 'low';
  const seg = low ? 8 : 16;
  const cseg = low ? 6 : 10;

  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d');
  paintHumanAtlas(ctx, false);
  const atlas = new THREE.CanvasTexture(canvas);
  atlas.name = 'human-face-atlas'; // the ONE texture this character brings
  atlas.colorSpace = THREE.SRGBColorSpace;

  // the head's face projection, precomputed for the head sphere
  const head = HUMAN_PARTS.find((p) => p.id === 'head');
  const WHITE = [
    (CELL_WHITE.x + CELL_WHITE.s / 2) / ATLAS_SIZE,
    1 - (CELL_WHITE.y + CELL_WHITE.s / 2) / ATLAS_SIZE,
  ];
  const u0 = CELL_FACE.x / ATLAS_SIZE;
  const uSpan = CELL_FACE.s / ATLAS_SIZE;
  const v0 = 1 - (CELL_FACE.y + CELL_FACE.s) / ATLAS_SIZE;
  const vSpan = CELL_FACE.s / ATLAS_SIZE;

  const parts = [];
  const add = (geo, matrix, color, uvFix = null) => {
    if (uvFix) uvFix(geo);
    if (!uvFix) {
      const n = geo.attributes.position.count;
      const uv = geo.attributes.uv ? geo.attributes.uv.array : new Float32Array(n * 2);
      for (let i = 0; i < n; i++) { uv[i * 2] = WHITE[0]; uv[i * 2 + 1] = WHITE[1]; }
      if (geo.attributes.uv) geo.attributes.uv.needsUpdate = true;
      else geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    }
    const g = geo.clone().applyMatrix4(matrix);
    geo.dispose();
    g.userData.color = color;
    parts.push(g);
  };
  const at = (x, y, z, ry = 0) => new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)),
    new THREE.Vector3(1, 1, 1),
  );
  /** A limb p0→p1: a Y-cylinder rotated onto the segment. */
  const limb = (p0, p1, r0, r1) => {
    const a = new THREE.Vector3(...p0);
    const b = new THREE.Vector3(...p1);
    const dir = b.clone().sub(a);
    const len = dir.length();
    const geo = new THREE.CylinderGeometry(r1, r0, len, cseg);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return { geo, matrix: new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)) };
  };

  /** Head: project the front band (-z) onto the face cell, white elsewhere. */
  const remapFaceUVs = (geo) => {
    const pos = geo.attributes.position;
    const n = pos.count;
    const uv = new Float32Array(n * 2);
    const [hx, hy, hz] = head.p;
    const s = head.scale;
    for (let i = 0; i < n; i++) {
      const dx = (pos.getX(i) - hx) / s[0];
      const dy = (pos.getY(i) - hy) / s[1];
      const dz = (pos.getZ(i) - hz) / s[2];
      const dl = Math.hypot(dx, dy, dz) || 1;
      const ux = dx / dl;
      const uy = dy / dl;
      const uz = dz / dl;
      if (uz < -0.62 && Math.abs(ux) < 0.62 && Math.abs(uy) < 0.66) {
        // a gentle cylindrical projection — face-forward maps into the cell
        const du = 0.5 + (ux / 0.78) * 0.5;
        const dv = 0.5 - (uy / 1.04) * 0.5; // up on the head = up on the cell
        uv[i * 2] = u0 + Math.min(0.995, Math.max(0.005, du)) * uSpan;
        uv[i * 2 + 1] = v0 + (1 - Math.min(0.995, Math.max(0.005, dv))) * vSpan;
      } else {
        uv[i * 2] = WHITE[0];
        uv[i * 2 + 1] = WHITE[1];
      }
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  };

  for (const p of HUMAN_PARTS) {
    const color = PAINT[p.mat];
    if (p.kind === 'box') {
      const b = p.box;
      const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
      const m = at(b.cx, b.cy, b.cz);
      if (p.rx) m.premultiply(new THREE.Matrix4().makeRotationX(p.rx)).premultiply(new THREE.Matrix4().makeTranslation(0, -p.rxAt[1], -p.rxAt[2])).premultiply(new THREE.Matrix4().makeTranslation(0, p.rxAt[1], p.rxAt[2]));
      add(geo, m, color);
    } else if (p.kind === 'sph') {
      const s = p.scale || [1, 1, 1];
      const geo = p.dome
        ? new THREE.SphereGeometry(p.r, Math.max(8, seg), Math.max(4, seg / 2), 0, Math.PI * 2, 0, Math.PI / 2)
        : new THREE.SphereGeometry(p.r, seg, Math.max(6, Math.round(seg * 0.75)));
      geo.scale(s[0], s[1], s[2]);
      const m = at(p.p[0], p.p[1], p.p[2]);
      add(geo, m, color, p.id === 'head' ? remapFaceUVs : null);
    } else if (p.kind === 'disc') {
      const geo = new THREE.CylinderGeometry(p.r, p.r, p.t, low ? 6 : 12);
      add(geo, at(p.p[0], p.p[1], p.p[2]), color);
    } else {
      const { geo, matrix } = limb(p.p0, p.p1, p.r0, p.r1);
      add(geo, matrix, color);
    }
  }

  // ── merge (same hand-rolled merge as the vacuum, with UVs along) ──
  let vTotal = 0;
  let iTotal = 0;
  for (const g of parts) { vTotal += g.attributes.position.count; iTotal += g.index ? g.index.count : 0; }
  const pos = new Float32Array(vTotal * 3);
  const nrm = new Float32Array(vTotal * 3);
  const col = new Float32Array(vTotal * 3);
  const uvs = new Float32Array(vTotal * 2);
  const idx = vTotal > 65535 ? new Uint32Array(iTotal) : new Uint16Array(iTotal);
  let vOff = 0; let iOff = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, vOff * 3);
    nrm.set(g.attributes.normal.array, vOff * 3);
    uvs.set(g.attributes.uv.array, vOff * 2);
    const c = g.userData.color;
    for (let i = 0; i < g.attributes.position.count; i++) { col[(vOff + i) * 3] = c[0]; col[(vOff + i) * 3 + 1] = c[1]; col[(vOff + i) * 3 + 2] = c[2]; }
    const gi = g.index.array;
    for (let i = 0; i < gi.length; i++) idx[iOff + i] = gi[i] + vOff;
    vOff += g.attributes.position.count;
    iOff += gi.length;
    g.dispose();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geometry.setIndex(new THREE.BufferAttribute(idx, 1));
  geometry.computeBoundingSphere();

  const material = new THREE.MeshLambertMaterial({ vertexColors: true, map: atlas });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'owner-human';
  // No shadow — the #85 lesson: the sun pass would draw him a SECOND time,
  // and the scene's whole budget is +1 draw. The seated man sits IN the
  // living room's existing shading; nothing misses a sun shadow here.
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const group = new THREE.Group();
  group.name = 'owner-man';
  group.position.set(SEAT.x, 0, SEAT.z);
  group.rotation.y = SEAT_YAW;
  group.add(mesh);
  // culled with the living room, and only ever shown while the scene is on
  // (the engine hangs a gate on this — see full-cull.js / apt.lap).
  group.userData.cullRooms = ['living'];
  group.visible = false; // exists only while the scene is active

  /** The slow idle — transforms and an atlas re-paint on the blink flip,
   *  nothing else; a pure function of `t`, and STILL at t=0 and on calm. */
  let blinkClosed = false;
  function idle(t, { calm = false } = {}) {
    const s = calm ? 0 : Math.max(0, Number(t) || 0);
    const br = Math.sin(s * 1.05); // the breath: ~1 Hz of a man at rest
    mesh.scale.set(1 + 0.0022 * br, 1 + 0.0055 * br, 1 + 0.003 * br);
    mesh.rotation.z = 0.0022 * Math.sin(s * 0.33 + 0.6); // settles, settles
    mesh.rotation.x = 0.0035 * Math.sin(s * 0.27 + 0.4); // the tiny head tilt, and the thumbs ride it
    const closed = !calm && s > 0.25 && s % 4.37 > 4.27; // one blink every ~4.4 s
    if (closed !== blinkClosed) {
      blinkClosed = closed;
      paintHumanAtlas(ctx, closed);
      atlas.needsUpdate = true;
    }
  }

  return {
    group,
    mesh,
    material,
    atlas,
    idle,
    stats: { drawCalls: 1, triangles: iTotal / 3, tier: low ? 'low' : 'full', texture: 'one 256 px atlas' },
  };
}

/** The bands this build answers to — re-exported so checks import from the
 *  data file OR here, whichever reads closer. */
export { HUMAN_BANDS };
