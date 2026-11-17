/*!
 * game/full-decor-mesh.js — the issue #69 lookalike decor, drawn (issue #69).
 *
 * game/full-decor.js holds the data; this file paints ONE 256 px canvas
 * atlas and hangs every piece on it. The budget decides the mesh count, as
 * it always does here: one material ⇒ one bucket ⇒ the whole collection is
 * ONE world-baked mesh under the flat's root, and because its box spans
 * five rooms game/full-cull.js files it as shared-never-hidden — the flat's
 * worst frame pays exactly ONE draw call for all of it (147 → 148 against
 * tools/capture.mjs's 150, measured by `npm run capture:full`).
 *
 * The atlas, not extra materials, is what lets the PLAIN faces come along
 * for free: its `swatch` cell carries frame-black / paper-white / page-cream
 * / charcoal quadrants, so frame returns, cloth binding, page edges and pot
 * bottoms never need a second material. Every patterned face is UV-remapped
 * into its cell by hand (the geometry's own face order, in full-decor.js's
 * `faceCells`), with a small inset and a painted cell border on top — that
 * trio is why mipmapping cannot smear the black art into the cream cell
 * next door at grazing angles (no moire, no cross-cell bleed).
 *
 * Determinism, the repo's rule for anything with a canvas: every blob,
 * patch and dash comes from util.js `hash1`, painted once at boot, never in
 * the render path. Same seed, same atlas, byte for byte.
 */
import * as THREE from 'three';
import { canvasTexture } from '../src/textures.js';
import { hash1 } from '../src/util.js';
import { mergedMesh } from './full-apartment.js';
import { DECOR, DECOR_CELLS, faceCells } from './full-decor.js';

/* -------------------------------------------------------------------------- *
 *  The atlas. 4×4 grid of 64 px cells; the cell order is full-decor.js's
 *  DECOR_CELLS, read row-major. Palette: paper and cream are the flat's
 *  warm whites (never clinical), ink is a cool near-black — deliberately
 *  NOT the cat's furBlack token, so even the colour tell stays the cat's.
 * -------------------------------------------------------------------------- */
const S = 256;
const N = 4; // cells per side
const CELL = S / N;
const PAPER = '#f2efe7';
const CREAM = '#e7dfcc';
const INK = '#191b21';
const CHAR = '#45474d';

/** One organic ink blob: an irregular closed blob, deterministic on k. */
function blob(ctx, x, y, r, k) {
  const n = 7;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2 + hash1(k * 13 + i) * 0.5;
    const rr = r * (0.68 + hash1(k * 31 + i * 7) * 0.55);
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr * 0.92;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

const PAINT = {
  'art-a1': (ctx, g, k) => { // paper, two ink blots and a charcoal splinter
    ctx.fillStyle = PAPER; ctx.fillRect(g.x, g.y, g.s, g.s);
    ctx.fillStyle = INK;
    blob(ctx, g.x + g.s * 0.36, g.y + g.s * 0.44, g.s * 0.24, k);
    blob(ctx, g.x + g.s * 0.64, g.y + g.s * 0.6, g.s * 0.17, k + 5);
    ctx.fillStyle = CHAR;
    blob(ctx, g.x + g.s * 0.58, g.y + g.s * 0.3, g.s * 0.09, k + 11);
  },
  'art-a2': (ctx, g, k) => { // paper, loose ink patches
    ctx.fillStyle = PAPER; ctx.fillRect(g.x, g.y, g.s, g.s);
    ctx.fillStyle = INK;
    const q = g.s / 4;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        if (hash1(k * 17 + i * 4 + j) < 0.52) continue;
        const jx = (hash1(k * 23 + i * 4 + j) - 0.5) * q * 0.18;
        const jy = (hash1(k * 29 + i * 4 + j) - 0.5) * q * 0.18;
        ctx.fillRect(g.x + i * q + jx, g.y + j * q + jy, q, q);
      }
    }
  },
  'art-a3': (ctx, g, k) => { // paper, two offset ink rings
    ctx.fillStyle = PAPER; ctx.fillRect(g.x, g.y, g.s, g.s);
    ctx.strokeStyle = INK;
    for (const [cx, cy, r, w] of [[0.4, 0.5, 0.26, 0.06], [0.66, 0.42, 0.15, 0.05]]) {
      ctx.lineWidth = g.s * w;
      ctx.beginPath();
      ctx.arc(g.x + g.s * cx, g.y + g.s * cy, g.s * r * (0.94 + hash1(k) * 0.1), 0, Math.PI * 2);
      ctx.stroke();
    }
  },
  'art-a4': (ctx, g, k) => { // paper, ink rules of uneven weight
    ctx.fillStyle = PAPER; ctx.fillRect(g.x, g.y, g.s, g.s);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i === 2 ? CHAR : INK;
      const w = g.s * (0.05 + hash1(k * 3 + i) * 0.05);
      ctx.fillRect(g.x + g.s * (0.14 + i * 0.2), g.y + g.s * 0.12, w, g.s * 0.76);
    }
  },
  'art-a5': (ctx, g, k) => { // ink, paper blots — white-on-black
    ctx.fillStyle = INK; ctx.fillRect(g.x, g.y, g.s, g.s);
    ctx.fillStyle = PAPER;
    blob(ctx, g.x + g.s * 0.3, g.y + g.s * 0.62, g.s * 0.2, k);
    blob(ctx, g.x + g.s * 0.72, g.y + g.s * 0.36, g.s * 0.16, k + 6);
    ctx.fillStyle = CREAM;
    blob(ctx, g.x + g.s * 0.52, g.y + g.s * 0.5, g.s * 0.1, k + 12);
  },
  'art-a6': (ctx, g, k) => { // paper, a low horizon and a pale sun
    ctx.fillStyle = PAPER; ctx.fillRect(g.x, g.y, g.s, g.s);
    ctx.fillStyle = INK;
    ctx.fillRect(g.x, g.y + g.s * (0.68 + hash1(k) * 0.04), g.s, g.s * 0.32);
    ctx.fillStyle = CHAR;
    ctx.beginPath();
    ctx.arc(g.x + g.s * 0.68, g.y + g.s * 0.3, g.s * 0.11, 0, Math.PI * 2);
    ctx.fill();
  },
  'art-a7': (ctx, g, k) => { // paper, one large blot bottom-heavy
    ctx.fillStyle = PAPER; ctx.fillRect(g.x, g.y, g.s, g.s);
    ctx.fillStyle = INK;
    blob(ctx, g.x + g.s * 0.48, g.y + g.s * 0.58, g.s * 0.3, k + 2);
    ctx.fillStyle = CHAR;
    blob(ctx, g.x + g.s * 0.72, g.y + g.s * 0.28, g.s * 0.09, k + 9);
  },
  'art-a8': (ctx, g, k) => { // ink, paper patches — white-on-black
    ctx.fillStyle = INK; ctx.fillRect(g.x, g.y, g.s, g.s);
    ctx.fillStyle = PAPER;
    const q = g.s / 4;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        if (hash1(k * 19 + i * 4 + j) < 0.5) continue;
        const jx = (hash1(k * 37 + i * 4 + j) - 0.5) * q * 0.16;
        const jy = (hash1(k * 41 + i * 4 + j) - 0.5) * q * 0.16;
        ctx.fillRect(g.x + i * q + jx, g.y + j * q + jy, q, q);
      }
    }
  },
  duvet: (ctx, g, k) => {
    ctx.fillStyle = PAPER; ctx.fillRect(g.x, g.y, g.s, g.s);
    ctx.fillStyle = INK;
    blob(ctx, g.x + g.s * 0.28, g.y + g.s * 0.3, g.s * 0.16, k);
    blob(ctx, g.x + g.s * 0.78, g.y + g.s * 0.62, g.s * 0.14, k + 4);
    ctx.fillStyle = CHAR;
    blob(ctx, g.x + g.s * 0.62, g.y + g.s * 0.2, g.s * 0.1, k + 8);
    blob(ctx, g.x + g.s * 0.16, g.y + g.s * 0.76, g.s * 0.11, k + 12);
  },
  cushion(ctx, g, k) {
    ctx.fillStyle = CREAM; ctx.fillRect(g.x, g.y, g.s, g.s);
    ctx.fillStyle = INK;
    blob(ctx, g.x + g.s * 0.34, g.y + g.s * 0.4, g.s * 0.2, k + 16);
    blob(ctx, g.x + g.s * 0.72, g.y + g.s * 0.72, g.s * 0.16, k + 20);
  },
  check(ctx, g, k) {
    ctx.fillStyle = PAPER; ctx.fillRect(g.x, g.y, g.s, g.s);
    ctx.fillStyle = INK;
    const q = g.s / 4;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        if ((i + j) % 2 === 0) continue;
        const jx = (hash1(k + i * 4 + j) - 0.5) * q * 0.14;
        const jy = (hash1(k + 40 + i * 4 + j) - 0.5) * q * 0.14;
        ctx.fillRect(g.x + i * q + jx, g.y + j * q + jy, q, q);
      }
    }
  },
  towel(ctx, g, k) {
    ctx.fillStyle = PAPER; ctx.fillRect(g.x, g.y, g.s, g.s);
    ctx.fillStyle = INK;
    ctx.fillRect(g.x, g.y + g.s * 0.12, g.s, g.s * 0.1);
    ctx.fillRect(g.x, g.y + g.s * 0.28, g.s, g.s * 0.04);
    ctx.fillRect(g.x, g.y + g.s * 0.82, g.s, g.s * 0.1);
    ctx.fillStyle = CHAR;
    blob(ctx, g.x + g.s * 0.3, g.y + g.s * 0.56, g.s * 0.09, k + 2);
  },
  pot(ctx, g, k) {
    ctx.fillStyle = INK; ctx.fillRect(g.x, g.y, g.s, g.s);
    ctx.fillStyle = PAPER;
    ctx.fillRect(g.x + g.s * 0.08, g.y + g.s * 0.1, g.s * 0.84, g.s * 0.06);
    ctx.fillRect(g.x + g.s * 0.1, g.y + g.s * 0.74, g.s * 0.8, g.s * 0.04);
    blob(ctx, g.x + g.s * 0.52, g.y + g.s * 0.46, g.s * 0.11, k + 3);
  },
  book(ctx, g, k) {
    ctx.fillStyle = PAPER; ctx.fillRect(g.x, g.y, g.s, g.s);
    ctx.fillStyle = INK;
    for (let i = 0; i < 3; i++) {
      const h = g.s * (0.2 + hash1(k * 7 + i) * 0.05);
      ctx.fillRect(g.x + g.s * 0.06, g.y + g.s * (0.72 - i * 0.22), g.s * 0.88, h);
    }
    ctx.fillStyle = CHAR;
    ctx.fillRect(g.x + g.s * 0.06, g.y + g.s * 0.28, g.s * 0.88, g.s * 0.03);
  },
  box(ctx, g, k) {
    ctx.fillStyle = CREAM; ctx.fillRect(g.x, g.y, g.s, g.s);
    ctx.fillStyle = INK;
    blob(ctx, g.x + g.s * 0.3, g.y + g.s * 0.5, g.s * 0.22, k + 7);
    blob(ctx, g.x + g.s * 0.82, g.y + g.s * 0.24, g.s * 0.13, k + 9);
    ctx.fillStyle = CHAR;
    blob(ctx, g.x + g.s * 0.66, g.y + g.s * 0.8, g.s * 0.1, k + 13);
  },
  /** Plain colours, four quadrants: frame black ↖, paper ↗, cream ↙, charcoal ↘. */
  swatch(ctx, g) {
    const h = g.s / 2;
    ctx.fillStyle = INK; ctx.fillRect(g.x, g.y, h, h);
    ctx.fillStyle = PAPER; ctx.fillRect(g.x + h, g.y, h, h);
    ctx.fillStyle = CREAM; ctx.fillRect(g.x, g.y + h, h, h);
    ctx.fillStyle = CHAR; ctx.fillRect(g.x + h, g.y + h, h, h);
  }
};

function paintAtlas(ctx) {
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, S, S);
  DECOR_CELLS.forEach((name, i) => {
    const x = (i % N) * CELL;
    const y = Math.floor(i / N) * CELL;
    const g = { x, y, s: CELL };
    PAINT[name](ctx, g, 69 + i * 13);
    // Bleed guard #2: a 2 px border in each cell's edge colour, painted over
    // the pattern's clipped margins, so a clamped tap never sees a neighbour.
    const edge = { 'art-a5': INK, 'art-a8': INK, pot: INK, cushion: CREAM, box: CREAM, swatch: CREAM }[name] || PAPER;
    ctx.fillStyle = edge;
    ctx.fillRect(x, y, CELL, 2);
    ctx.fillRect(x, y + CELL - 2, CELL, 2);
    ctx.fillRect(x, y, 2, CELL);
    ctx.fillRect(x + CELL - 2, y, 2, CELL);
  });
}

/* -------------------------------------------------------------------------- *
 *  One material for the whole collection — the draw-call decision.
 * -------------------------------------------------------------------------- */
let mat = null;
export function decorMaterial() {
  if (!mat) {
    const tex = canvasTexture(S, paintAtlas);
    // Bleed guard #1: no wrap — UVs leave a cell only through the
    // generator's clamp, which clamps to the ATLAS, never to a neighbour.
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.name = 'decor-atlas';
    mat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex, roughness: 0.82 });
    mat.name = 'decor';
  }
  return mat;
}

/* ------------------------------- UV remap -------------------------------- *
 * Canvas rects are top-left; THREE wants bottom-left v, so every rect goes
 * through `cellUV` (texels.js does the same flip for its atlas). `inset` is
 * bleed guard #3: patterns stop 1.5 px short of the painted cell border.   */
const cellColRow = (name) => {
  const i = DECOR_CELLS.indexOf(name);
  return [i % N, Math.floor(i / N)];
};
const cellUV = (col, row, inset) => [
  (col * CELL + inset) / S,
  1 - ((row + 1) * CELL - inset) / S,
  ((col + 1) * CELL - inset) / S,
  1 - (row * CELL + inset) / S,
];
/** Full-cell rect for a named pattern. */
const cellRect = (name) => {
  const [c, r] = cellColRow(name);
  return cellUV(c, r, 1.5);
};
/** A half-cell quadrant of the plain-colour `swatch`, by quadrant name. */
const QUAD = { blk: [0, 0], wht: [1, 0], cru: [0, 1], chg: [1, 1] };
const quadRect = (q) => {
  const [qc, qr] = QUAD[q];
  const [c, r] = cellColRow('swatch');
  const half = CELL / 2;
  const x = c * CELL + qc * half;
  const y = r * CELL + qr * half;
  return [(x + 1.5) / S, 1 - (y + half - 1.5) / S, (x + half - 1.5) / S, 1 - (y + 1.5) / S];
};
/** Face rect for a data-file cell token: a pattern, a swatch quadrant, or plain paper. */
const faceRect = (cell) => (cell === 'plain' ? quadRect('wht') : (QUAD[cell] ? quadRect(cell) : cellRect(cell)));

/** THREE's BoxGeometry vertex order is px nx py ny pz nz, 4 verts per face. */
const BOX_FACES = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
function remapBox(uv, cells) {
  for (let f = 0; f < 6; f++) {
    const r = faceRect(cells[f]);
    for (let k = 0; k < 4; k++) {
      const vi = f * 4 + k;
      uv.setXY(vi, vi % 2 === 0 ? r[0] : r[2], k < 2 ? r[3] : r[1]);
    }
  }
}
/** CylinderGeometry order: ring 0, ring 1 (28 verts), then the two caps. */
function remapCyl(uv, sideCell, capCell) {
  const r = faceRect(sideCell);
  for (let v = 0; v < 28; v++) uv.setXY(v, v % 2 === 0 ? r[0] : r[2], v < 14 ? r[3] : r[1]);
  const cr = faceRect(capCell);
  for (let v = 28; v < uv.count; v++) uv.setXY(v, v % 2 === 0 ? cr[0] : cr[2], (v - 28) % 4 < 2 ? cr[3] : cr[1]);
}

/** Geometry for one piece, centred on the origin; `mergedMesh` moves it to
 *  the middle of its DECOR box with the entry's `at`. Every box is axis-
 *  aligned — hung work sits flat on its plaster — so no rotations exist. */
function pieceEntry(p, mat) {
  const { x0, y0, z0, x1, y1, z1 } = p.box;
  const at = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
  const F = faceCells(p);
  if (p.shape === 'cyl') {
    const h = y1 - y0;
    const g = new THREE.CylinderGeometry(p.r * 0.88, p.r, h, 14, 1);
    remapCyl(g.attributes.uv, F.sides, F.py);
    return { geo: g, mat, at, keepUV: true };
  }
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  remapBox(g.attributes.uv, BOX_FACES.map((k) => F[k]));
  return { geo: g, mat, at, keepUV: true };
}

/**
 * Build the whole lookalike collection into the flat's root (issue #69).
 * full-apartment.js calls this right after `buildFullEntry`, BEFORE
 * `mergeStaticMeshes` (which would never rewrite these hand-placed UVs —
 * `keepUV` — and finds a lone shading signature to fold) and before
 * `createRoomCull`, whose spans-the-rooms box then keeps the finished mesh
 * permanently visible. One material means one bucket: the whole collection
 * bakes into a SINGLE mesh, one draw call in every frame. Every piece is
 * scenery: no hit target, no collider, never re-animated.
 */
export function buildFullDecor(flat) {
  const mat = decorMaterial();
  const [baked] = mergedMesh(flat, DECOR.map((p) => pieceEntry(p, mat)), {
    cast: false, // wall art and cloth keep the flat's soft read; see the data file
    receive: true,
  });
  return baked;
}
