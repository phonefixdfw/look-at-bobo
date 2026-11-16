// src/patriot.js — Patriot Bobo (issue #55, part of #35): the joke costume as
// an OPTIONAL layer on the buildCat rig. Nothing here runs for normal Bobo:
// the page adds the layer for one moment and removes it after, and every mesh
// carries userData.patriot so src/measure.js skips it and the marking scans
// (dash, bib, neck) keep counting only fur. All geometry is procedural, all
// textures are canvas — nothing downloaded, nothing random (hash1 only), so
// the costume can be built inside measured() without touching the budget of
// the two cats themselves. Budget: 10 draw calls when he is the active cat.

import * as THREE from 'three';
import { std } from './materials.js';
import { canvasTexture } from './textures.js';
import { TOKENS } from './tokens.js';
import { DEG, clamp, lerp, hash1 } from './util.js';
import { boxSDF, ellSDF } from './markings.js';
import { DASH_EXPECT, BIB_EXPECT } from './measure.js';

// ---------------------------------------------------------------------------
// Palette (docs/ART_STYLE.md §2 extension for the costume, issue #55).
// Flag red/blue are the cloth, not UI tokens; browns are the fur hat.
// ---------------------------------------------------------------------------
const PAT = {
  flagRed: '#b22234',
  flagBlue: '#3c3b6e',
  flagWhite: '#f4f0e6',
  furBrown: 0x5c4630, // hat base
  furLight: 0x8a6a45, // hat highlights (vertex colours)
  furDark: 0x382a1c, // hat shade + fuzz
  hornCream: 0xead9b8,
  hornTip: 0x3a3228,
  strap: 0x4a4a3a, // webbing harness
  wood: 0x8a6a44, // little flag pole
  buttonBlue: '#2b3a67',
};

// Head ellipsoid of buildHead (src/cat.js), needed to hug the hat to the head
const HEAD_R = [0.09, 0.083, 0.084];
// Where the hat brim ends: high over the dash (kept readable), low at the
// sides and back (covers the ears). Head-local metres.
const BRIM_FRONT_Y = 0.082; // above the dash top (DASH_EXPECT y 0.072)
const BRIM_SIDE_Y = 0.014; // below the ear bottoms
const HAT_CLEAR = 0.009; // hat shell stands this far off the fur
// Chest ellipsoid of the sit pose (src/cat.js buildPose 'sit')
const CHEST = { c: [0, 0.215, 0.075], r: [0.105, 0.16, 0.125] };
const BUTTON_AT = [0, 0.252, 0.2002]; // on the chest, inside the bib (BIB_EXPECT.sit)
const BUTTON_R = 0.028;
const POLE_LEN = 0.3; // "a stick about 0.30 m" (issue #55)

// ---------------------------------------------------------------------------
// Canvas textures (issue #55: the flag stripes/stars and the button text are
// canvas, built once, lazily, on the first costume build — never at import).
// ---------------------------------------------------------------------------
let _tex = null;
function starGlyph(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}
/** Stars-and-stripes onto ctx of a size square; `tatter` chews the fly edge. */
function drawFlag(ctx, s, tatter) {
  const w = s;
  const h = s;
  const rows = 13;
  for (let i = 0; i < rows; i++) {
    ctx.fillStyle = i % 2 ? PAT.flagWhite : PAT.flagRed;
    ctx.fillRect(0, (i * h) / rows, w, h / rows + 1);
  }
  ctx.fillStyle = PAT.flagBlue;
  ctx.fillRect(0, 0, w * 0.42, (h * 7) / rows);
  ctx.fillStyle = PAT.flagWhite;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 5; c++) {
      starGlyph(ctx, w * (0.045 + c * 0.082), h * (0.052 + r * 0.083), s * 0.024);
    }
  }
  if (tatter > 0) {
    // torn bites out of the fly edge and the hem: deterministic wedges
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 7; i++) {
      const hx = hash1(i * 17.3 + tatter * 3.1);
      const hy = hash1(i * 29.7 + tatter * 7.7);
      const bx = w * (0.72 + hx * 0.28);
      const by = hy < 0.5 ? hy * h : h * (0.7 + (hy - 0.5) * 0.5);
      const r0 = s * (0.035 + hash1(i * 5.3) * 0.05) * tatter;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + r0 * 2, by - r0);
      ctx.lineTo(bx + r0, by + r0 * 1.4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}
function patriotTextures() {
  if (_tex) return _tex;
  // the little flag: a small tatter so the hem reads cloth, not a sticker
  const flag = canvasTexture(192, (ctx, s) => drawFlag(ctx, s, 0.7));
  flag.wrapS = flag.wrapT = THREE.ClampToEdgeWrapping;
  // the cape: the same flag, chewed harder (it has been a cape for years)
  const cape = canvasTexture(256, (ctx, s) => drawFlag(ctx, s, 1.6));
  cape.wrapS = cape.wrapT = THREE.ClampToEdgeWrapping;
  // the button: white disc, blue letters, red stars above and below.
  // Exact spelling from the issue: SAVE THE CAPITOL.
  const button = canvasTexture(256, (ctx, s) => {
    const g = ctx.createRadialGradient(s * 0.42, s * 0.4, s * 0.1, s * 0.5, s * 0.5, s * 0.5);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.82, '#f4f1ea');
    g.addColorStop(1, '#cfc8ba');
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.47, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.fillStyle = '#b22234';
    for (let i = 0; i < 3; i++) starGlyph(ctx, s * (0.34 + i * 0.16), s * 0.215, s * 0.05);
    for (let i = 0; i < 3; i++) starGlyph(ctx, s * (0.34 + i * 0.16), s * 0.79, s * 0.05);
    ctx.fillStyle = PAT.buttonBlue;
    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.round(s * 0.115)}px system-ui, sans-serif`;
    ctx.fillText('SAVE THE', s / 2, s * 0.46);
    ctx.font = `bold ${Math.round(s * 0.155)}px system-ui, sans-serif`;
    ctx.fillText('CAPITOL', s / 2, s * 0.63);
  });
  button.wrapS = button.wrapT = THREE.ClampToEdgeWrapping;
  // face paint: red/white/blue stripes in a soft round blot (both cheeks)
  const cheek = canvasTexture(128, (ctx, s) => {
    const sw = s / 3;
    ctx.fillStyle = PAT.flagRed;
    ctx.fillRect(0, 0, sw, s);
    ctx.fillStyle = PAT.flagWhite;
    ctx.fillRect(sw, 0, sw, s);
    ctx.fillStyle = PAT.flagBlue;
    ctx.fillRect(sw * 2, 0, sw, s);
    // ragged bottom: paint drips, faded blot edges
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 6; i++) {
      const hx = hash1(i * 11.7 + 2.3) * s;
      ctx.beginPath();
      ctx.moveTo(hx, s);
      ctx.lineTo(hx + s * 0.05, s - s * (0.1 + hash1(i * 4.1) * 0.22));
      ctx.lineTo(hx + s * 0.1, s);
      ctx.closePath();
      ctx.fill();
    }
    const rg = ctx.createRadialGradient(s / 2, s / 2, s * 0.32, s / 2, s / 2, s * 0.52);
    rg.addColorStop(0, 'rgba(0,0,0,1)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, s, s);
    ctx.globalCompositeOperation = 'source-over';
  });
  cheek.wrapS = cheek.wrapT = THREE.ClampToEdgeWrapping;
  _tex = { flag, cape, button, cheek };
  return _tex;
}

// ---------------------------------------------------------------------------
// Small helpers. Everything merges into as few geometries as it can: the
// whole costume must stay inside the +12 draw budget (issue #55).
// ---------------------------------------------------------------------------
/** Concatenate transformed geometries into one (positions/normals/uvs, plus
 *  vertex colours when every part has them). No BufferGeometryUtils needed. */
function mergeGeos(geos) {
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0;
  for (const p of parts) n += p.attributes.position.count;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  const hasCol = parts.every((p) => p.attributes.color);
  const col = hasCol ? new Float32Array(n * 3) : null;
  let o = 0;
  for (const p of parts) {
    const c = p.attributes.position.count;
    pos.set(p.attributes.position.array.subarray(0, c * 3), o * 3);
    if (p.attributes.normal) nor.set(p.attributes.normal.array.subarray(0, c * 3), o * 3);
    if (p.attributes.uv) uv.set(p.attributes.uv.array.subarray(0, c * 2), o * 2);
    if (hasCol) col.set(p.attributes.color.array.subarray(0, c * 3), o * 3);
    o += c;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (hasCol) g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
/** A costume mesh: tagged patriot + noContact, so contacts, hit tests and the
 *  marking scans never see it (normal Bobo must be unchanged, issue #55). */
function pMesh(geo, mat, tag, parent, { cast = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.userData.patriot = tag;
  m.userData.noContact = true;
  m.castShadow = cast;
  m.receiveShadow = false;
  if (parent) parent.add(m);
  return m;
}
/** Horizontal radius of the head ellipsoid cross-section at height y, in the
 *  direction (sin phi, cos phi) — the hug target for the fur hat. */
function headHoriz(phi, y, pad = 0) {
  const e = Math.max(1 - (y / HEAD_R[1]) ** 2, 0.045);
  const A = HEAD_R[0] * Math.sqrt(e);
  const B = HEAD_R[2] * Math.sqrt(e);
  const sx = Math.sin(phi);
  const cz = Math.cos(phi);
  return 1 / Math.sqrt((sx / A) ** 2 + (cz / B) ** 2) + pad;
}
/** Where the hat brim sits at azimuth phi (0 = front): a lifted brow over the
 *  dash, dropped low over the ears. Frontness fades with cos phi. */
function brimY(phi) {
  const t = Math.pow(Math.max(Math.cos(phi), 0), 1.4);
  return lerp(BRIM_SIDE_Y, BRIM_FRONT_Y, t);
}
/** Point on the chest ellipsoid surface (plus a pad along the normal). */
function onChest(p, pad = 0) {
  const d = new THREE.Vector3(p[0] - CHEST.c[0], p[1] - CHEST.c[1], p[2] - CHEST.c[2]);
  const u = d.clone().normalize();
  const k = 1 / Math.sqrt((u.x / CHEST.r[0]) ** 2 + (u.y / CHEST.r[1]) ** 2 + (u.z / CHEST.r[2]) ** 2);
  const q = u.multiplyScalar(k);
  const n = new THREE.Vector3(
    q.x / CHEST.r[0] ** 2,
    q.y / CHEST.r[1] ** 2,
    q.z / CHEST.r[2] ** 2,
  ).normalize();
  return new THREE.Vector3(
    CHEST.c[0] + q.x + n.x * pad,
    CHEST.c[1] + q.y + n.y * pad,
    CHEST.c[2] + q.z + n.z * pad,
  );
}

// ---------------------------------------------------------------------------
// The fur hat: one deformed shell (a sphere cap hugged to the head, brim
// lifted over the dash and dropped over the ears), one fuzzy silhouette shell
// (the cat fuzz-shell trick, brown), a ring of short fur cards, and the two
// curved horns. 4 draw calls total; both horns share one geometry.
// ---------------------------------------------------------------------------
const HAT_Y0 = 0.045; // dome centre, head-local
const HAT_Z0 = -0.012;

/** Ear-flap window: the hat must bell out over the ears (their rims sit
 *  ~29 mm past the head surface, so a plain hug would punch through them).
 *  1 between 45 and 125 degrees of azimuth, feathered at both ends. */
function earWindow(phi) {
  const d = Math.abs(phi) / DEG;
  const up = clamp((d - 35) / 12, 0, 1);
  const down = clamp((140 - d) / 15, 0, 1);
  return up * down;
}

/** Build the hat dome geometry (head-local vertex space is the mesh's own
 *  space; the mesh hangs off the head group at (0, HAT_Y0, HAT_Z0)). */
function hatDomeGeo(lowQ) {
  const r = 0.098;
  const g = new THREE.SphereGeometry(r, lowQ ? 16 : 24, lowQ ? 10 : 14, 0, Math.PI * 2, 0, 1.82);
  const pos = g.attributes.position;
  const n = pos.count;
  const col = new Float32Array(n * 3);
  const base = new THREE.Color(PAT.furBrown);
  const light = new THREE.Color(PAT.furLight);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const absY = vy + HAT_Y0; // head-local height
    const phi = Math.atan2(vx, vz + HAT_Z0); // azimuth about the head centre
    const yFloor = brimY(phi);
    const y = Math.max(absY, yFloor); // below the brim line: ride the brim
    const lumpy = 1 + (hash1(i * 7.13 + 0.9) - 0.5) * 0.06; // hand-knit lumps
    const pad = HAT_CLEAR + (absY < 0.078 && Math.cos(phi) > 0.4 ? 0.004 : 0);
    // the ear flaps keep a near-vertical wall; elsewhere the shell hugs
    const hug = headHoriz(phi, y, pad);
    const flap = earWindow(phi) * clamp((0.112 - y) / 0.015, 0, 1);
    const R = lerp(hug, Math.max(hug, 0.0905), flap) * lumpy;
    pos.setXYZ(i, Math.sin(phi) * R, y - HAT_Y0, Math.cos(phi) * R - HAT_Z0);
    // shaggy brown: lighter toward the crown and the lit front
    const k = clamp((y - 0.03) / 0.11, 0, 1) * 0.55 + clamp(Math.cos(phi), 0, 1) * 0.25 + hash1(i * 3.7) * 0.2;
    c.copy(base).lerp(light, clamp(k, 0, 1));
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
/** The brim trim: short fuzzy cards around the brim line, merged into one
 *  geometry. Lighter at the tips (vertex colours), ?quality=low halves them. */
function hatCardsGeo(lowQ) {
  const N = lowQ ? 20 : 40;
  const geos = [];
  const base = new THREE.Color(PAT.furDark);
  const tip = new THREE.Color(PAT.furLight);
  for (let row = 0; row < (lowQ ? 1 : 2); row++) {
    for (let k = 0; k < N; k++) {
      const phi = ((k + row * 0.5) / N) * Math.PI * 2 + (hash1(k * 2.3) - 0.5) * 0.05;
      const y0 = brimY(phi) + 0.002 + row * 0.012; // bases buried in the shell, above the dash line
      const R0 = headHoriz(phi, y0, HAT_CLEAR * 0.4);
      const h = 0.013 + hash1(k * 5.7 + row) * 0.011 - row * 0.004;
      const lean = 0.5 + hash1(k * 9.1) * 0.4; // splay outward past the shell
      const w = 0.011;
      const gx = new THREE.PlaneGeometry(w, h, 1, 1);
      const p = gx.attributes.position;
      const tc = new Float32Array(p.count * 3);
      // quad: bottom edge on the brim (buried 3 mm in the shell), tip out+up
      for (let i = 0; i < p.count; i++) {
        const lx = p.getX(i); // -w/2..w/2 along the tangent
        const ly = p.getY(i); // -h/2..h/2
        const up = ly + h / 2; // 0..h
        const R = R0 + up * lean;
        const y = y0 + up * (1 - lean * 0.4);
        const tx = Math.cos(phi); // tangent (perpendicular to the radial dir)
        const tz = -Math.sin(phi);
        p.setXYZ(i, Math.sin(phi) * R + lx * tx, y, Math.cos(phi) * R + lx * tz); // head-local: no mesh offset
        const t = clamp(ly / h + 0.5, 0, 1);
        const cc = base.clone().lerp(tip, t * 0.85 + hash1(k * 3.3 + i) * 0.15);
        tc[i * 3] = cc.r;
        tc[i * 3 + 1] = cc.g;
        tc[i * 3 + 2] = cc.b;
      }
      gx.setAttribute('color', new THREE.BufferAttribute(tc, 3));
      gx.computeVertexNormals();
      geos.push(gx);
    }
  }
  return mergeGeos(geos);
}
/** One curved horn: a tapered, ridged tube from the hat side up and back,
 *  cream at the base shading to a dark tip (vertex colours). */
function hornGeo(s, lowQ) {
  const pts = [
    new THREE.Vector3(s * 0.08, 0.058, -0.018),
    new THREE.Vector3(s * 0.118, 0.106, -0.046),
    new THREE.Vector3(s * 0.134, 0.172, -0.024),
    new THREE.Vector3(s * 0.114, 0.208, 0.026),
  ];
  const curve = new THREE.CatmullRomCurve3(pts);
  const seg = lowQ ? 10 : 14;
  const rad = lowQ ? 6 : 7;
  const g = new THREE.TubeGeometry(curve, seg, 0.0205, rad, false);
  const pos = g.attributes.position;
  const n = pos.count;
  const col = new Float32Array(n * 3);
  const cream = new THREE.Color(PAT.hornCream);
  const dark = new THREE.Color(PAT.hornTip);
  const c = new THREE.Color();
  const centres = [];
  for (let r = 0; r <= seg; r++) centres.push(curve.getPoint(r / seg));
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / (rad + 1));
    const u = clamp(row / seg, 0, 1);
    const centre = centres[Math.min(row, seg)];
    const taper = lerp(1.12, 0.14, Math.pow(u, 0.85)) * (1 + 0.09 * (hash1(row * 31.7 + (i % (rad + 1))) - 0.5));
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    pos.setXYZ(i, centre.x + (vx - centre.x) * taper, centre.y + (vy - centre.y) * taper, centre.z + (vz - centre.z) * taper);
    c.copy(cream).lerp(dark, clamp(u * 1.15 - 0.1 + (hash1(row * 3.1) - 0.5) * 0.08, 0, 1));
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
/** Both horns as one geometry (mirror in x): one draw call. */
function hornsGeo(lowQ) {
  return mergeGeos([hornGeo(1, lowQ), hornGeo(-1, lowQ)]);
}
/** Face paint: a small striped blot on each cheek, merged into one geometry,
 *  hugged to the head ellipsoid and floated 2.5 mm off the fur. */
function cheeksGeo() {
  const geos = [];
  for (const s of [-1, 1]) {
    const u = new THREE.Vector3(s * 0.75, 0.1, 0.65).normalize();
    const t = 1 / Math.sqrt((u.x / HEAD_R[0]) ** 2 + (u.y / HEAD_R[1]) ** 2 + (u.z / HEAD_R[2]) ** 2);
    const p = u.clone().multiplyScalar(t);
    const nrm = new THREE.Vector3(p.x / HEAD_R[0] ** 2, p.y / HEAD_R[1] ** 2, p.z / HEAD_R[2] ** 2).normalize();
    const g = new THREE.CircleGeometry(0.021, 18); // faces +z; lookAt turns it out
    const centre = p.clone().add(nrm.clone().multiplyScalar(0.0025));
    const m = new THREE.Matrix4();
    m.lookAt(new THREE.Vector3(), new THREE.Vector3().subVectors(new THREE.Vector3(), nrm), new THREE.Vector3(0, 1, 0)); // +z -> nrm
    g.applyMatrix4(m);
    g.translate(centre.x, centre.y, centre.z);
    geos.push(g);
  }
  return mergeGeos(geos);
}

// ---------------------------------------------------------------------------
// The cape: a tattered flag poncho. One swept grid from shoulder to shoulder,
// around the back, leaving the chest front open for the bib and the button;
// the hem alternates long and torn (columns of different length, no extra
// geometry). One draw call. The harness is two crossed webbing straps merged
// into a second draw call; the button is a third.
// ---------------------------------------------------------------------------
const CAPE_A = 0.15; // half-width of the body ellipse the cloth hangs on
const CAPE_B = 0.155;
const CAPE_Z0 = 0.01;
const CAPE_THETA = 150 * DEG; // wraps to the chest sides, chest stays open

/** Cloth height at column angle th: shoulders, dipping over the back. */
function capeTopY(th) {
  return 0.35 - 0.05 * Math.abs(Math.sin(th));
}
/** Torn hem height per column (deterministic tears, issue #55). */
function capeHemY(col, cols) {
  const h = hash1(col * 7.31 + 2.2);
  const tear = hash1(col * 3.7 + 9.1) > 0.6 ? 0.04 + hash1(col * 5.1 + 1.7) * 0.05 : 0;
  const flap = Math.abs(col / (cols - 1) - 0.5) * 2 > 0.86 ? 0.03 : 0; // front tips hang shorter
  return 0.104 + h * 0.03 - tear - flap;
}
function capeGeo(lowQ) {
  const cols = lowQ ? 13 : 19;
  const rows = 6;
  const pos = [];
  const uv = [];
  const idx = [];
  for (let i = 0; i < cols; i++) {
    const u = i / (cols - 1);
    const th = (u * 2 - 1) * CAPE_THETA;
    const sx = Math.sin(th);
    const cz = Math.cos(th);
    const ripple = 1 + 0.014 * Math.sin(i * 2.7);
    const topY = capeTopY(th);
    const hemY = capeHemY(i, cols);
    for (let r = 0; r <= rows; r++) {
      const v = r / rows;
      const bulge = 1 + 0.045 * Math.sin(v * Math.PI) + (v > 0.5 ? 0.02 : 0);
      const R = 1 + (bulge - 1) * ripple;
      pos.push(sx * CAPE_A * R, lerp(topY, hemY, v), CAPE_Z0 - cz * CAPE_B * R);
      uv.push(u * 0.92 + 0.04, v);
    }
  }
  for (let i = 0; i < cols - 1; i++) {
    for (let r = 0; r < rows; r++) {
      const a = i * (rows + 1) + r;
      const b = a + rows + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/** A webbing strap: a ribbon following a CatmullRom path, projected onto the
 *  chest ellipsoid (plus pad), `width` wide along the surface normal. */
function strapGeo(controlPts, width, pad) {
  const curve = new THREE.CatmullRomCurve3(controlPts.map((p) => onChest(p, pad)));
  const N = 14;
  const pos = [];
  const uv = [];
  const idx = [];
  for (let i = 0; i <= N; i++) {
    const p = curve.getPoint(i / N);
    const tan = curve.getTangent(i / N).normalize();
    const out = p.clone().sub(new THREE.Vector3(...CHEST.c)).normalize();
    const side = new THREE.Vector3().crossVectors(tan, out).normalize();
    pos.push(p.x - side.x * width * 0.5, p.y - side.y * width * 0.5, p.z - side.z * width * 0.5);
    pos.push(p.x + side.x * width * 0.5, p.y + side.y * width * 0.5, p.z + side.z * width * 0.5);
    uv.push(0, i / N, 1, i / N);
  }
  for (let i = 0; i < N; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/** Both straps, crossed high on the chest (clear of the button), one geometry. */
function harnessGeo(lowQ) {
  const w = 0.015;
  const pad = 0.004;
  const right = [[0.048, 0.205, -0.06], [0.108, 0.295, -0.02], [0.06, 0.36, 0.04], [-0.01, 0.322, 0.128], [-0.085, 0.245, 0.085], [-0.088, 0.19, -0.03]];
  const left = right.map((p) => [-p[0], p[1], p[2]]);
  const g = lowQ ? 14 : 18;
  void g; // strap segment count stays put even on low quality: it is already tiny
  return mergeGeos([strapGeo(right, w, pad), strapGeo(left, w, pad)]);
}

// ---------------------------------------------------------------------------
// The little flag: a 0.30 m stick propped against the right side, held by the
// webbing, with a waving cloth. The wave is a pure function of t (vertex
// animation on the plane, hoist edge pinned) and rests flat in calm mode.
// ---------------------------------------------------------------------------
const FLAG_POLE_BASE = [0.115, 0.005, 0.1];
const FLAG_DIR = new THREE.Vector3(0.24, 0.96, 0.16).normalize();
const FLAG_W = 0.15;
const FLAG_H = 0.095;
function flagClothGeo(lowQ) {
  const g = new THREE.PlaneGeometry(FLAG_W, FLAG_H, lowQ ? 8 : 14, lowQ ? 5 : 7);
  g.translate(FLAG_W / 2, -FLAG_H / 2, 0); // hoist edge hangs down the pole
  return g;
}
/** Wave: z displacement growing toward the fly edge, gentle, pure in t.
 *  `amp` is 0 in calm mode, and the flat frame is always a written value. */
function waveFlag(geo, basePos, t, amp) {
  const pos = geo.attributes.position;
  const k = (Math.PI * 2 * 1.5) / FLAG_W;
  for (let i = 0; i < pos.count; i++) {
    const x = basePos.getX(i);
    const y = basePos.getY(i);
    const u = clamp(x / FLAG_W, 0, 1);
    pos.setXYZ(
      i,
      x,
      y + Math.sin(k * x - t * 3.0) * 0.004 * u * amp,
      basePos.getZ(i) + Math.sin(k * x - t * 3.4) * 0.011 * Math.pow(u, 1.25) * amp + Math.sin(y * 9 + t * 2.2) * 0.0025 * u * amp,
    );
  }
  pos.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// The public layer: add / remove / idle, plus the measurements the selfTest
// wants (dash unmasked, ears covered, button clear, horn clearance, budget).
// The rig is built once per cat per page and cached; add after remove reuses
// it, so a moment can switch back and forth with zero allocation.
// ---------------------------------------------------------------------------
const RIGS = new Map();

/** Attach (or fetch) the Patriot costume on a buildCat rig. Sits pose only —
 *  this costume is authored for Bobo upright, front paws down (issue #55).
 *  opts: { quality: 'full'|'low', calm: boolean } */
function addPatriotCostume(cat, opts = {}) {
  const lowQ = opts.quality === 'low';
  const key = cat.root.uuid;
  let rig = RIGS.get(key);
  if (!rig) {
    const tex = patriotTextures();
    const sit = cat.poses.sit;
    const head = cat.pivots.sit.head;
    const group = new THREE.Group();
    group.name = 'patriot-costume';
    group.userData.patriot = 'root';
    const headGroup = new THREE.Group();
    headGroup.userData.patriot = 'head-root';

    const matHat = std(0xffffff, { vertexColors: true, roughness: 0.92 });
    const matFur = std(0xffffff, { vertexColors: true, roughness: 0.95, side: THREE.DoubleSide });
    const matHorn = std(0xffffff, { vertexColors: true, roughness: 0.55 });
    const matCape = std(0xffffff, { map: tex.cape, side: THREE.DoubleSide, roughness: 0.86 });
    const matStrap = std(PAT.strap, { side: THREE.DoubleSide, roughness: 0.72 });
    const matButton = std(TOKENS.furWhite, { map: tex.button, transparent: true, roughness: 0.35, polygonOffset: true, polygonOffsetFactor: -2 });
    const matCheek = std(0xffffff, { map: tex.cheek, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -3 });
    const matFlag = std(0xffffff, { map: tex.flag, side: THREE.DoubleSide, alphaTest: 0.5, roughness: 0.86 });
    const matPole = std(PAT.wood, { roughness: 0.8 });
    const matHatFuzz = new THREE.MeshBasicMaterial({
      color: new THREE.Color(PAT.furDark).lerp(new THREE.Color(PAT.furLight), 0.3),
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });

    // --- head: fur hat, fuzz silhouette, fur cards, horns, face paint
    const dome = pMesh(hatDomeGeo(lowQ), matHat, 'patriot-hat', headGroup);
    dome.position.set(0, HAT_Y0, HAT_Z0);
    const hatFuzz = pMesh(dome.geometry, matHatFuzz, 'patriot-hat-fuzz', headGroup, { cast: false });
    hatFuzz.position.copy(dome.position);
    hatFuzz.scale.setScalar(1.05);
    hatFuzz.userData.fuzz = true; // the same soft-silhouette trick as the cats
    pMesh(hatCardsGeo(lowQ), matFur, 'patriot-hat-fur', headGroup, { cast: false });
    pMesh(hornsGeo(lowQ), matHorn, 'patriot-horns', headGroup);
    pMesh(cheeksGeo(), matCheek, 'patriot-facepaint', headGroup, { cast: false });

    // --- body: tattered flag cape, crossed harness, the button
    pMesh(capeGeo(lowQ), matCape, 'patriot-cape', group);
    pMesh(harnessGeo(lowQ), matStrap, 'patriot-harness', group);
    const button = pMesh(new THREE.CircleGeometry(BUTTON_R, 24), matButton, 'patriot-button', group, { cast: false });
    button.position.set(BUTTON_AT[0], BUTTON_AT[1], BUTTON_AT[2]);
    button.rotation.x = -0.188; // the chest leans back; the button faces the viewer

    // --- the little flag on a 0.30 m stick, against his right side
    const base = new THREE.Vector3(...FLAG_POLE_BASE);
    const tip = base.clone().add(FLAG_DIR.clone().multiplyScalar(POLE_LEN));
    const pole = pMesh(
      new THREE.CylinderGeometry(0.0042, 0.005, POLE_LEN, 10),
      matPole,
      'patriot-pole',
      group,
    );
    pole.position.copy(base).add(tip).multiplyScalar(0.5);
    pole.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), FLAG_DIR);
    const flagPivot = new THREE.Group();
    flagPivot.userData.patriot = 'flag-pivot';
    flagPivot.position.copy(base).add(FLAG_DIR.clone().multiplyScalar(POLE_LEN - 0.048));
    group.add(flagPivot);
    const flagGeo = flagClothGeo(lowQ);
    const flagBase = flagGeo.attributes.position.clone();
    const flag = pMesh(flagGeo, matFlag, 'patriot-flag', flagPivot, { cast: false });
    void flag;
    void pole;

    rig = {
      group,
      headGroup,
      dome,
      hatFuzz,
      flagPivot,
      flagGeo,
      flagBase,
      parts: {},
      eyes: head.userData.eyes || [],
      head,
      sit,
      attached: false,
      meshCount: 0,
    };
    const collect = (parentObj) =>
      parentObj.traverse((o) => {
        if (o.isMesh && o.userData.patriot) {
          rig.parts[o.userData.patriot] = o;
          rig.meshCount++;
        }
      });
    collect(group);
    collect(headGroup);
    RIGS.set(key, rig);
  }
  if (!rig.attached) {
    rig.sit.add(rig.group);
    rig.head.add(rig.headGroup);
    rig.attached = true;
  }
  restPatriot(cat);
  return rig;
}

/** Detach every costume mesh from the cat (the rig stays cached). */
function removePatriotCostume(cat) {
  const rig = RIGS.get(cat.root.uuid);
  if (!rig || !rig.attached) return false;
  restPatriot(cat);
  rig.group.parent?.remove(rig.group);
  rig.headGroup.parent?.remove(rig.headGroup);
  rig.attached = false;
  return true;
}

const isPatriotAttached = (cat) => RIGS.get(cat.root.uuid)?.attached === true;

/** The cached rig (selfTest reads rig.group/headGroup to toggle draw budgets). */
const getPatriotRig = (cat) => RIGS.get(cat.root.uuid) || null;

/** Everything the idle writes back to rest (issue #55: the idle is a pure
 *  function of t, so leaving a moment must not strand a mid-wave frame). */
function restPatriot(cat) {
  const rig = RIGS.get(cat.root.uuid);
  if (!rig) return;
  rig.flagPivot.rotation.set(0, 0, 0);
  waveFlag(rig.flagGeo, rig.flagBase, 0, 0);
  for (const eye of rig.eyes) eye.scale.y = 1;
  rig.head.rotation.z = 0;
}

/** The short idle: flag wave, small head tilt, one blink every 3.2 s.
 *  Pure in t; `calm` (reduced motion) rests every branch but still writes it. */
function patriotIdle(cat, t, opts = {}) {
  const rig = RIGS.get(cat.root.uuid);
  if (!rig || !rig.attached) return;
  const amp = opts.calm ? 0 : 1;
  rig.flagPivot.rotation.z = -0.05 * Math.sin(t * 1.5 + 0.8) * amp;
  rig.flagPivot.rotation.x = 0.04 * Math.sin(t * 1.1) * amp;
  waveFlag(rig.flagGeo, rig.flagBase, t, amp);
  const cyc = t % 3.2;
  const blink = amp > 0 && cyc < 0.13 ? Math.sin((Math.PI * cyc) / 0.13) : 0;
  for (const eye of rig.eyes) eye.scale.y = 1 - 0.9 * blink;
  rig.head.rotation.z = 0.055 * Math.sin(t * 0.7 + 1.9) * amp;
}

// ---------------------------------------------------------------------------
// selfTest measurements (issue #55). Every number is measured back out of the
// BUILT costume geometry — head-local for hat parts (they ride the head),
// cat-root space for the chest pieces — so a check can actually fail.
// ---------------------------------------------------------------------------
function vertsIn(mesh, matrix, fn) {
  const pos = mesh.geometry.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(matrix);
    fn(v);
  }
}
/** env: { ceilingY, wallMinX, wallMinZ, stagings: [{name, pos:[x,y,z]}] } */
function measurePatriot(cat, env = {}) {
  const rig = RIGS.get(cat.root.uuid);
  if (!rig || !rig.attached) return null;
  cat.root.updateWorldMatrix(true, true);
  const P = rig.parts;
  const invHead = new THREE.Matrix4().copy(rig.head.matrixWorld).invert();
  const invRoot = new THREE.Matrix4().copy(cat.root.matrixWorld).invert();
  const headSpace = (mesh) => new THREE.Matrix4().multiplyMatrices(invHead, mesh.matrixWorld);
  const rootSpace = (mesh) => new THREE.Matrix4().multiplyMatrices(invRoot, mesh.matrixWorld);

  // 1. Dash unmasked: the hat shell, fur cards and horns vs the dash box
  let dashIntrusions = 0;
  let dashMin = Infinity;
  for (const key of ['patriot-hat', 'patriot-hat-fur', 'patriot-horns']) {
    vertsIn(P[key], headSpace(P[key]), (v) => {
      const d = boxSDF(v, DASH_EXPECT.c, DASH_EXPECT.h);
      if (d < 0.002) dashIntrusions++;
      if (d < dashMin) dashMin = d;
    });
  }

  // 2. Ears covered: every ear vertex must sit inside the hat wall at its height
  const wall = [];
  vertsIn(P['patriot-hat'], headSpace(P['patriot-hat']), (v) => wall.push([v.y, Math.hypot(v.x, v.z)]));
  const hatRAt = (y) => {
    let r = 0;
    for (const [ry, R] of wall) if (Math.abs(ry - y) <= 0.013 && R > r) r = R;
    return r;
  };
  let earShortfall = -Infinity;
  rig.head.traverse((o) => {
    if (o.isMesh && o.userData.tag === 'ear') {
      vertsIn(o, headSpace(o), (v) => {
        if (v.y < -0.01) return;
        const short = Math.hypot(v.x, v.z) - hatRAt(v.y);
        if (short > earShortfall) earShortfall = short;
      });
    }
  });

  // 3. The button: on the bib, and nothing covers its reading disc
  const bib = BIB_EXPECT.sit;
  const bc = new THREE.Vector3(BUTTON_AT[0], BUTTON_AT[1], BUTTON_AT[2]);
  let nearestStrap = Infinity;
  for (const key of ['patriot-cape', 'patriot-harness']) {
    vertsIn(P[key], rootSpace(P[key]), (v) => {
      const d = v.distanceTo(bc);
      if (d < nearestStrap) nearestStrap = d;
    });
  }
  const buttonInBib = ellSDF(bc, bib.c, bib.h) < 0;

  // 4. Horn/hat clearance per staging (sofa and floor), world space
  const clearances = [];
  const stash = cat.root.position.clone();
  for (const st of env.stagings || []) {
    cat.root.position.set(st.pos[0], st.pos[1], st.pos[2]);
    cat.root.updateWorldMatrix(true, true);
    const box = new THREE.Box3();
    for (const key of ['patriot-hat', 'patriot-hat-fuzz', 'patriot-horns']) {
      box.union(new THREE.Box3().setFromObject(P[key]));
    }
    clearances.push({
      name: st.name,
      ceiling: (env.ceilingY ?? 2.6) - box.max.y,
      sideWall: box.min.x - (env.wallMinX ?? -3.14),
      backWall: box.min.z - (env.wallMinZ ?? -2.54),
    });
  }
  cat.root.position.copy(stash);
  cat.root.updateWorldMatrix(true, true);

  const worst = clearances.length
    ? Math.min(...clearances.flatMap((c) => [c.ceiling, c.sideWall, c.backWall]))
    : Infinity;
  return {
    meshes: rig.meshCount,
    dashIntrusions,
    dashMin,
    earCoverMargin: -earShortfall,
    nearestStrap,
    buttonInBib,
    clearances,
    worstClearance: worst,
  };
}

/** Count costume meshes currently under a cat's root (0 for normal Bobo). */
function countPatriotMeshes(cat) {
  let n = 0;
  cat.root.traverse((o) => {
    if (o.userData?.patriot && o.isMesh) n++;
  });
  return n;
}

export {
  PAT,
  BUTTON_AT,
  BUTTON_R,
  POLE_LEN,
  patriotTextures,
  addPatriotCostume,
  removePatriotCostume,
  isPatriotAttached,
  getPatriotRig,
  restPatriot,
  patriotIdle,
  measurePatriot,
  countPatriotMeshes,
};
