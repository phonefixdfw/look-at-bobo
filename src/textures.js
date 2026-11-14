// src/textures.js — the procedural textures (seeded, built once at boot, never
// in the render path). Extracted verbatim from design/style-test/styletest.js.
// Importing this file builds the canvases; the GPU only sees them at first render.

import * as THREE from 'three';
import { hash1 } from './util.js';

// -- procedural textures (seeded, built once at boot, never in the render path)
function canvasTexture(size, draw, { srgb = true, repeat = [1, 1] } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  return t;
}
const floorMap = canvasTexture(256, (ctx, s) => {
  const plank = s / 4;
  for (let i = 0; i < 4; i++) {
    const tint = 0.92 + hash1(i * 3 + 1) * 0.14;
    ctx.fillStyle = `rgb(${Math.round(255 * tint)},${Math.round(250 * tint)},${Math.round(244 * tint)})`;
    ctx.fillRect(0, i * plank, s, plank - 1);
    ctx.fillStyle = 'rgba(60,40,25,0.55)';
    ctx.fillRect(0, (i + 1) * plank - 2, s, 2);
    for (let k = 0; k < 5; k++) {
      const gx = hash1(i * 9 + k * 5 + 2) * s;
      const gy = i * plank + hash1(i * 5 + k) * plank;
      ctx.fillStyle = 'rgba(120,90,60,0.12)';
      ctx.fillRect(gx, gy, 26 + hash1(k + i) * 40, 1.5);
    }
  }
}, { repeat: [4, 3.5] });
const floorRough = canvasTexture(256, (ctx, s) => {
  ctx.fillStyle = '#b4b4b4';
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 900; i++) {
    const g = Math.round(150 + hash1(i) * 90);
    ctx.fillStyle = `rgb(${g},${g},${g})`;
    ctx.fillRect(hash1(i + 7) * s, hash1(i + 13) * s, 2, 2);
  }
}, { srgb: false, repeat: [4, 3.5] });
const plasterMap = canvasTexture(256, (ctx, s) => {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 2200; i++) {
    const g = Math.round(235 + hash1(i * 1.7) * 20);
    ctx.fillStyle = `rgb(${g},${g},${g})`;
    ctx.fillRect(hash1(i + 3) * s, hash1(i + 5) * s, 2.5, 2.5);
  }
}, { repeat: [3, 2] });
const rugMap = canvasTexture(256, (ctx, s) => {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = 'rgba(90,70,50,0.16)';
  ctx.lineWidth = 6;
  ctx.strokeRect(s * 0.07, s * 0.07, s * 0.86, s * 0.86);
  ctx.strokeStyle = 'rgba(90,70,50,0.10)';
  ctx.lineWidth = 3;
  ctx.strokeRect(s * 0.13, s * 0.13, s * 0.74, s * 0.74);
  for (let i = 0; i < 2600; i++) {
    const g = Math.round(215 + hash1(i * 2.3) * 40);
    ctx.fillStyle = `rgb(${g},${g},${g})`;
    ctx.fillRect(hash1(i + 11) * s, hash1(i + 17) * s, 1.6, 1.6);
  }
});
const couchMap = canvasTexture(256, (ctx, s) => {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, s, s);
  for (let y = 0; y < s; y += 12) {
    for (let x = 0; x < s; x += 12) {
      const g = Math.round(205 + hash1(x * 0.31 + y * 0.17) * 50);
      ctx.fillStyle = `rgb(${g},${g},${g})`;
      ctx.beginPath();
      ctx.arc(x + 6, y + 6, 5, 0, 7);
      ctx.fill();
    }
  }
}, { repeat: [3, 2] });

// what the window looks out on: a flat, tone-mapping-exempt sky, so the sunlit
// opening stays bright without turning the room into a blown-out white box
const skyMap = canvasTexture(128, (ctx, s) => {
  const g = ctx.createLinearGradient(0, 0, 0, s);
  g.addColorStop(0, '#8ec4ea');
  g.addColorStop(0.62, '#cfe6f4');
  g.addColorStop(1, '#f3ead9');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = 'rgba(120,150,110,0.5)';
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.arc(hash1(i * 3.3) * s, s * (0.8 + hash1(i) * 0.12), s * (0.1 + hash1(i + 5) * 0.08), 0, 7);
    ctx.fill();
  }
});

export { canvasTexture, floorMap, floorRough, plasterMap, rugMap, couchMap, skyMap };
