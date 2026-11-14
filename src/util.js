// src/util.js — small deterministic helpers and pixel math, shared by every
// page. Extracted verbatim from design/style-test/styletest.js.

// ---------------------------------------------------------------------------
// 2. Small helpers (all deterministic — no Math.random anywhere).
// ---------------------------------------------------------------------------
const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const easeOutCubic = (u) => 1 - Math.pow(1 - u, 3);
const easeOutBack = (u) => 1 + 2.2 * Math.pow(u - 1, 3) + 1.3 * Math.pow(u - 1, 2);
function fract(x) { return x - Math.floor(x); }
/** 0 outside, 1 inside, smoothed over `eps` at the boundary. */
function sdfInside(d, eps) { return clamp(0.5 - d / eps, 0, 1); }
function hash1(n) { return fract(Math.sin(n * 127.1 + 311.7) * 43758.5453); }
function seededShuffle(arr, seed) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(hash1(seed * 131.1 + i * 7.13) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
/** How tall a `extent`-metre mark looks at `dist` metres, in 1080p pixels. */
function projectedPx(extent, dist, fovDeg, heightPx = 1080) {
  return (extent * heightPx) / (2 * dist * Math.tan((fovDeg / 2) * DEG));
}
const srgbLuma = (hex) => {
  const ch = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
};
const contrast = (a, b) => {
  const la = srgbLuma(a);
  const lb = srgbLuma(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

const round = (v) => (typeof v === 'number' ? Number(v.toPrecision(6)) : v);

export { DEG, clamp, lerp, easeOutCubic, easeOutBack, fract, sdfInside, hash1, seededShuffle, projectedPx, srgbLuma, contrast, round };
