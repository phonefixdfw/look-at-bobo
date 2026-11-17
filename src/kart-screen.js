/** --------------------------------------------------------------------------
 *  Issue #84 — the living-room TV plays a kart-racing game.
 *
 *  Brandon asked for Mario Kart on the TV. The real game's characters, logos,
 *  tracks and name are Nintendo's, and we ship none of them (and download
 *  nothing). So the TV plays an ORIGINAL look-alike of the genre: a cartoon
 *  pseudo-3D kart racer ("KART DASH", a made-up title) painted here in code —
 *  a curving rainbow-edged road with rumble strips under a sunny sky, a
 *  distant mountain, three tiny round-headed drivers with invented helmets,
 *  one floating "?" item box, a lap counter, a position number and a mini-map.
 *  No plumber, no turtle, no mushroom, no red-white cap.
 *
 *  Cost discipline is the whole trick. The TV's screen mesh, material and
 *  halo already exist (issue #46); this module only changes what pixels the
 *  emissiveMap shows, so the flat's draw calls do not move. The canvas is
 *  320×180 (256×144 on ?quality=low), redrawn at 12 fps — 6 fps on low
 *  quality, a slow 4 fps with calm mode — ONE texture upload per redraw, and
 *  only while the screen is actually on camera (the per-room cull's visible
 *  flags plus a frustum sphere test) and the tab is visible. Nothing else
 *  ticks when the player is out of the living room.
 *
 *  Determinism: under `?gate=off` — every capture, every determinism run —
 *  the screen is a FIXED frame painted once at construction; tick() refuses
 *  to repaint it, so captures stay byte-identical run to run. The checks in
 *  game/full.js drive the mechanism through tick(…, force) and probe(), and
 *  probe() restores the exact static pixels afterwards, so no check can leak
 *  an animated frame into a capture that runs after it.
 *
 *  Photosensitivity: every frame keeps roughly the same average brightness
 *  (alternating stripes trade one tone for a near-equal one), and there is no
 *  strobing: speed lines are steady streaks, absent in calm mode, and nothing
 *  flashes. The brightness probe lives with the checks.
 * ------------------------------------------------------------------------- */

import * as THREE from 'three';

/** Strings a kart racer might get sued for; the checks assert the screen
 *  draws none of them (drawnTexts records every fillText that ever ran). */
export const TRADEMARK_WORDS = ['mario', 'nintendo', 'donkey', 'zelda', 'bowser', 'peach', 'toad', 'gamecube', 'wii'];

/** The frame the gate-off (capture) page paints once and never changes. */
const STATIC_T = 0.75;

/** Small deterministic wobble, no Math.random anywhere. */
const wob = (t, f, p = 0) => Math.sin(t * f + p);

function paint(ctx, w, h, t, { simple, calm }) {
  const horizon = Math.round(h * 0.4);
  const rowBands = 7; // grass/road stripe depth, in world units

  // ── sky: sun near the horizon, a couple of slow clouds on full quality ───
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#2f9df0');
  sky.addColorStop(1, '#bfe9ff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon);
  ctx.fillStyle = 'rgba(255,242,176,0.9)';
  ctx.beginPath();
  ctx.arc(w * 0.6, horizon * 0.42, h * 0.055, 0, Math.PI * 2); // clear of the mini-map pill
  ctx.fill();
  if (!simple) {
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    for (const [bx, by, s] of [[0.16, 0.30, 1], [0.52, 0.18, 0.8], [0.88, 0.55, 0.7]]) {
      const cx = ((bx * w + t * w * 0.012) % (w + 60)) - 30;
      ctx.beginPath();
      ctx.ellipse(cx, horizon * by, w * 0.055 * s, h * 0.028 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + w * 0.03 * s, horizon * by + h * 0.006, w * 0.04 * s, h * 0.02 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── the distant mountain and a green hill band under the sky ─────────────
  ctx.fillStyle = '#5983cf';
  ctx.beginPath();
  ctx.moveTo(w * 0.30, horizon);
  ctx.lineTo(w * 0.46, horizon * 0.28);
  ctx.lineTo(w * 0.62, horizon);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; // a snowcap, three notches
  ctx.beginPath();
  ctx.moveTo(w * 0.418, horizon * 0.45);
  ctx.lineTo(w * 0.46, horizon * 0.28);
  ctx.lineTo(w * 0.503, horizon * 0.45);
  ctx.lineTo(w * 0.478, horizon * 0.40);
  ctx.lineTo(w * 0.46, horizon * 0.47);
  ctx.lineTo(w * 0.44, horizon * 0.39);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2f9e46';
  ctx.fillRect(0, horizon * 0.86, w, horizon * 0.14 + 1);

  // ── the road: one row per scanline, classic Mode-7 perspective stripes ───
  const scroll = t * 46; // world units per second, steady — no flashes
  // The bend is (1-p)²-shaped like every pseudo-3D racer: the section near
  // the camera stays put under the player's kart, the far sections swing.
  const cxAt = (z, p) => w / 2 + Math.sin(z * 0.035 + t * 0.6) * w * 0.18 * (1 - p) * (1 - p);
  for (let y = horizon; y < h; y++) {
    const p = (y - horizon) / (h - horizon); // 0 at the horizon, 1 at the foot
    const z = scroll + 2.6 / (p + 0.035);
    const band = Math.floor(z / rowBands);
    const alt = band % 2 === 0;
    ctx.fillStyle = alt ? '#48b95a' : '#3ba54c'; // grass
    ctx.fillRect(0, y, w, 1);
    const cx = cxAt(z, p);
    const hw = 2 + p * p * w * 0.4;
    const rum = Math.max(2, hw * 0.16);
    ctx.fillStyle = alt ? '#ff5a52' : '#ffffff'; // rumble strips
    ctx.fillRect(cx - hw - rum, y, rum, 1);
    ctx.fillRect(cx + hw, y, rum, 1);
    ctx.fillStyle = alt ? '#7e828c' : '#767a84'; // road
    ctx.fillRect(cx - hw, y, hw * 2, 1);
    if (!simple) {
      ctx.fillStyle = ['#ff4d4d', '#ff9f2e', '#ffe14d', '#4dd06b', '#3fa9ff', '#9b5de5'][band % 6];
      const rw = Math.max(1, hw * 0.05); // rainbow edging, just inside the rumble
      ctx.fillRect(cx - hw, y, rw, 1);
      ctx.fillRect(cx + hw - rw, y, rw, 1);
    }
    if (alt) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      const dw = Math.max(1, hw * 0.04); // dashed centre line
      ctx.fillRect(cx - dw / 2, y, dw, 1);
    }
  }

  // ── karts: seen from behind, so the drivers are helmets and noggins ──────
  const kart = (sx, sy, s, body, helm, phase) => {
    const bob = wob(t, 7.3, phase) * s * 0.07; // the bob the issue asked for
    sy += bob;
    ctx.fillStyle = '#23262b';
    ctx.fillRect(sx - s * 0.58, sy - s * 0.16, s * 0.22, s * 0.3); // wheels
    ctx.fillRect(sx + s * 0.36, sy - s * 0.16, s * 0.22, s * 0.3);
    ctx.fillStyle = body;
    ctx.fillRect(sx - s * 0.46, sy - s * 0.4, s * 0.92, s * 0.38); // body
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(sx - s * 0.46, sy - s * 0.12, s * 0.92, s * 0.1); // shade line
    ctx.fillStyle = '#ffd9b0';
    ctx.beginPath();
    ctx.arc(sx, sy - s * 0.5, s * 0.2, 0, Math.PI * 2); // round head
    ctx.fill();
    ctx.fillStyle = helm;
    ctx.beginPath();
    ctx.arc(sx, sy - s * 0.5, s * 0.2, Math.PI, 0); // helmet, top half
    ctx.fill();
  };
  // A kart at world depth `d` (units ahead of the camera) projects to the
  // same p the road rows use, so karts ride their own stripe band.
  const kartP = (d) => Math.min(0.96, Math.max(0.14, 2.6 / d - 0.035));
  const aiKarts = simple
    ? [{ d: 5.4, body: '#19c3c8', helm: '#2f6fd0', ph: 2.1 }]
    : [
        { d: 5.4, body: '#19c3c8', helm: '#2f6fd0', ph: 2.1 },
        { d: 8.2, body: '#9b5de5', helm: '#ffd23f', ph: 4.4 },
      ];
  for (const a of [...aiKarts].sort((m, n) => n.d - m.d)) {
    const p = kartP(a.d);
    const y = horizon + p * (h - horizon);
    kart(cxAt(scroll + a.d, p) + wob(t, 1.4, a.ph) * 3, y - 1, 3 + p * p * 26, a.body, a.helm, a.ph);
  }

  // the "?" item box: a plain yellow crate, spinning and bobbing gently
  const ip = kartP(6.6);
  const iy = horizon + ip * (h - horizon);
  const is = 5 + ip * ip * 30;
  const spin = simple ? 1 : Math.abs(Math.cos(t * 2.4)) * 0.6 + 0.4;
  ctx.save();
  ctx.translate(cxAt(scroll + 6.6, ip), iy - is * 0.9 + wob(t, 3.1) * is * 0.12);
  ctx.scale(spin, 1);
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(-is / 2, -is / 2, is, is);
  ctx.strokeStyle = '#c99a12';
  ctx.lineWidth = Math.max(1, is * 0.12);
  ctx.strokeRect(-is / 2, -is / 2, is, is);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(is * 0.72)}px 'Trebuchet MS', 'Verdana', 'DejaVu Sans', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', 0, is * 0.02);
  ctx.restore();

  // the player's own kart, big across the bottom of the screen
  kart(w / 2 + wob(t, 0.9) * w * 0.04, h - h * 0.02, w * 0.17, '#e63946', '#ffd23f', 0);

  // speed lines: steady streaks, never a flicker — and never in calm mode
  if (!calm && !simple) {
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      const y = horizon + ((i + 1) / 7) * (h - horizon);
      const len = h * 0.06 + ((scroll * (2 + i)) % (w * 0.2));
      const x0 = ((scroll * 2 + i * 137) % (w + len)) - len;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + len * 0.5, y);
      ctx.stroke();
      const x1 = w - (((scroll * 2 + i * 89) % (w + len)) - len);
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x1 - len * 0.5, y);
      ctx.stroke();
    }
  }

  // ── HUD: chunky rounded pills in a bold system font, invented words only ─
  const hud = (text, x, y, size) => {
    ctx.font = `bold ${size}px 'Trebuchet MS', 'Verdana', 'DejaVu Sans', sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const tw = ctx.measureText(text).width;
    const px = size * 0.42;
    ctx.fillStyle = 'rgba(10,12,18,0.55)';
    ctx.beginPath();
    ctx.roundRect(x - px, y - size * 0.82, tw + px * 2, size * 1.64, size * 0.55);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, x, y + size * 0.04);
  };
  hud('LAP 2/3', w * 0.03, h * 0.085, Math.max(9, h * 0.085));
  if (!simple) hud('KART DASH', w * 0.36, h * 0.085, Math.max(8, h * 0.07));
  ctx.textAlign = 'right';
  ctx.font = `bold ${Math.round(h * 0.16)}px 'Trebuchet MS', 'Verdana', 'DejaVu Sans', sans-serif`;
  ctx.lineWidth = Math.max(2, h * 0.014);
  ctx.strokeStyle = 'rgba(10,12,18,0.75)';
  ctx.strokeText('1st', w * 0.97, h * 0.9); // position, bottom-right like the classics
  ctx.fillStyle = '#ffe14d';
  ctx.fillText('1st', w * 0.97, h * 0.9);

  // mini-map: a rounded-corner circuit with three dots on it, top-right
  const mx = w * 0.72;
  const my = h * 0.06;
  const mw = w * 0.17;
  const mh = h * 0.19;
  ctx.fillStyle = 'rgba(10,12,18,0.6)';
  ctx.beginPath();
  ctx.roundRect(mx - w * 0.02, my - h * 0.02, mw + w * 0.04, mh + h * 0.04, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(1.5, w * 0.008);
  ctx.beginPath();
  ctx.roundRect(mx + mw * 0.18, my + mh * 0.2, mw * 0.64, mh * 0.6, Math.min(mw, mh) * 0.35);
  ctx.stroke();
  const dots = [['#e63946', 0.0], ['#19c3c8', 2.1], ['#9b5de5', 4.4]];
  for (const [col, ph] of dots) {
    const a = t * 0.6 + ph;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(mx + mw / 2 + Math.cos(a) * mw * 0.36, my + mh / 2 + Math.sin(a) * mh * 0.34, Math.max(1.5, w * 0.008), 0, Math.PI * 2);
    ctx.fill();
  }

  // ── the CRT pass the old screen had: the same gentle scanlines, so the TV
  // reads as a TV and the average brightness stays steady ──────────────────
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
}

/**
 * Build the TV's animated screen. `quality` is the engine's resolved setting
 * ('full'|'low'), `calm` is reduced-motion, `gateOff` freezes the frame.
 */
export function createKartScreen({ quality = 'full', calm = false, gateOff = false } = {}) {
  const simple = quality === 'low';
  const w = simple ? 256 : 320;
  const h = simple ? 144 : 180;
  const fps = calm ? 4 : simple ? 6 : 12;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  // Record every string the painter ever draws, so a check can swear on it:
  // no trademarked word is ever put on this screen.
  const texts = new Set();
  const realFill = ctx.fillText.bind(ctx);
  const realStroke = ctx.strokeText.bind(ctx);
  ctx.fillText = (s, ...rest) => {
    texts.add(String(s));
    return realFill(s, ...rest);
  };
  ctx.strokeText = (s, ...rest) => {
    texts.add(String(s));
    return realStroke(s, ...rest);
  };

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8; // same treatment polish.js give every colour map

  const tv = {
    canvas,
    texture,
    w,
    h,
    fps,
    quality: simple ? 'low' : 'full',
    calm,
    gateOff,
    updates: 0, // redraw+upload count, the counter the checks read
    totalMs: 0,
    lastMs: 0,
    mesh: null,
    texts: () => [...texts],
    attach(mesh) {
      tv.mesh = mesh;
    },
    avgMs() {
      return tv.updates ? tv.totalMs / tv.updates : 0;
    },

    /** Paint a specific animation moment (test hook: no throttle). Probes
     *  paint without counting, so the update counter stays honest. */
    paint(tSec, count = true) {
      const t0 = performance.now();
      ctx.save();
      ctx.clearRect(0, 0, w, h);
      paint(ctx, w, h, tSec, { simple, calm });
      ctx.restore();
      texture.needsUpdate = true;
      tv.lastMs = performance.now() - t0;
      if (count) {
        tv.totalMs += tv.lastMs;
        tv.updates += 1;
      }
    },

    /** The live loop's call, once per rendered frame. Repaints at `fps` only
     *  while the screen passes the visibility test; never under gate-off.
     *  `force` (the checks only) bypasses the gate-off freeze and the
     *  tab-hidden guard — never the visibility test, which is the point. */
    tick(nowMs, camera = null, force = false) {
      if (!force && tv.gateOff) return false; // captures see one fixed frame
      if (!force && typeof document !== 'undefined' && document.hidden) return false;
      tv.tAnim += Math.min(Math.max(nowMs - (tv.lastSeen ?? nowMs), 0), 250) / 1000;
      tv.lastSeen = nowMs;
      if (!force && nowMs - (tv.lastPaint ?? -1e9) < 1000 / fps - 1) return false; // the live pacing
      if (!tv.onScreen(camera)) return false;
      tv.lastPaint = nowMs;
      tv.paint(tv.tAnim);
      return true;
    },

    /** Is the screen mesh worth repainting this frame? The per-room cull
     *  leaves the whole living group (and so the screen) invisible when the
     *  camera is far off; the frustum test is the one-hop further: the player
     *  standing in the living room, looking away from the TV. */
    onScreen(camera) {
      for (let o = tv.mesh; o; o = o.parent) if (!o.visible) return false;
      if (!tv.mesh) return true; // before attach: keep the frame warm
      if (!camera) return true;
      const geo = tv.mesh.geometry;
      if (!geo.boundingBox) geo.computeBoundingBox();
      const box = geo.boundingBox.clone().applyMatrix4(tv.mesh.matrixWorld);
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      camera.updateMatrixWorld();
      tv._pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      tv._frustum.setFromProjectionMatrix(tv._pm);
      return tv._frustum.intersectsSphere(sphere);
    },

    /** Run a probe against the painted canvas WITHOUT leaking pixels: the
     *  exact static frame goes back afterwards, byte for byte, so captures
     *  that run after the checks are unaffected. */
    probe(fn) {
      const before = ctx.getImageData(0, 0, w, h);
      try {
        return fn();
      } finally {
        ctx.putImageData(before, 0, 0);
        texture.needsUpdate = true;
      }
    },

    /** Mean brightness of the current canvas (0..255), for the probe. */
    meanLuma() {
      const d = ctx.getImageData(0, 0, w, h).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 16) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      return sum / (d.length / 16);
    },

    tAnim: STATIC_T,
    lastSeen: null,
    lastPaint: null,
    _frustum: new THREE.Frustum(),
    _pm: new THREE.Matrix4(),
  };

  // The frame everyone starts on (and every gate-off page stays on). Painted
  // outside the counter: this is construction, not an update.
  paint(ctx, w, h, STATIC_T, { simple, calm });
  texture.needsUpdate = true;
  return tv;
}
