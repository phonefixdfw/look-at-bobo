// src/juice.js — Step 9 juice: the small physical feedback that makes hits
// feel like hits. Every piece here is a PURE function of the phase-relative
// t (never wall clock, never random) and writes the DOM/CSS through guarded
// helpers only, so seeked captures and selfTest's order-independence check
// keep passing. Nothing here strobes: every curve is a single soft pulse.

import * as THREE from 'three';
import { TOKENS } from './tokens.js';
import { fract, hash1, clamp } from './util.js';

/** Confetti for the win set piece: 140 paper bits as ONE Points draw call,
 *  falling with a lazy sway over the living room (same footprint as the
 *  raining Bobo heads, so the two layers read as one celebration). */
function createConfetti(scene) {
  const N = 140;
  const seeds = [];
  for (let i = 0; i < N; i++) {
    seeds.push({
      x: -2.4 + hash1(i * 2.3 + 0.7) * 4.6,
      z: -1.8 + hash1(i * 3.1 + 2.9) * 3.6,
      phase: hash1(i * 4.7 + 1.1),
      speed: 0.38 + hash1(i * 5.9 + 3.3) * 0.42,
      spin: hash1(i * 7.1 + 4.9) * Math.PI * 2,
      sway: 0.06 + hash1(i * 9.7 + 6.1) * 0.1,
    });
  }
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const palette = [TOKENS.uiMustard, TOKENS.uiCoral, TOKENS.uiPaper, TOKENS.uiGlow].map((h) => new THREE.Color(h));
  for (let i = 0; i < N; i++) {
    const c = palette[i % palette.length];
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  const g = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(pos, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', posAttr);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({
    size: 0.055,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    toneMapped: true, // paper, not light: it must not bloom
  });
  const points = new THREE.Points(g, m);
  points.frustumCulled = false;
  points.visible = false;
  points.userData.tag = 'confetti';
  scene.add(points);
  /** Pure in t: each bit falls on its own seeded loop with a sine sway. */
  function update(t) {
    for (let i = 0; i < N; i++) {
      const s = seeds[i];
      const fall = fract(s.phase + (t * s.speed) / 3.6);
      pos[i * 3] = s.x + Math.sin(t * 1.7 + s.spin) * s.sway;
      pos[i * 3 + 1] = 3.2 - fall * 3.5;
      pos[i * 3 + 2] = s.z + Math.cos(t * 1.3 + s.spin) * s.sway;
    }
    posAttr.needsUpdate = true;
  }
  return { points, update };
}

/** One call per frame from applyTime. Writes ONLY pure f(phase, t) values —
 *  each branch has a defined resting value every other frame. */
function juiceFrame({ phase, t, renderer, els, confetti, baseExposure }) {
  // 1. Respawn smoothing: a 0.26 s blink when a new round begins. dip(0) = 0,
  //    so captured t=0 frames sit at the base exposure; the sink is at 0.13 s.
  const blink = phase === 'find' && t < 0.26 ? 0.4 * Math.sin((t / 0.26) * Math.PI) : 0;
  renderer.toneMappingExposure = baseExposure * (1 - blink);
  // 2. Score pop: the pill punches once at the catch, settles by t=0.5 (all
  //    captured catch frames at t>=1.2 are at rest).
  if (els.score) {
    let s = 1;
    if (phase === 'catch') {
      const u = clamp(t / 0.5, 0, 1);
      if (u < 1) s = 1 + 0.22 * Math.sin(u * Math.PI) * (1 - u * 0.4);
    }
    els.score.style.transform = `scale(${s.toFixed(4)})`;
  }
  // 3. Wrong-cat warmth: one soft coral pulse as DAG! lands (0.8–1.35 s), max
  //    16% — a wink, not a flash. Photosensitivity-safe: one slow breath.
  if (els.wrongFlash) {
    let o = 0;
    if (phase === 'wrong') {
      const u = clamp((t - 0.8) / 0.55, 0, 1);
      if (u > 0 && u < 1) o = 0.16 * Math.sin(u * Math.PI);
    }
    els.wrongFlash.style.opacity = o.toFixed(4);
  }
  // 4. Confetti rides the win only; win's own t drives the fall.
  if (confetti) {
    confetti.points.visible = phase === 'win';
    if (phase === 'win') confetti.update(t);
  }
}

export { createConfetti, juiceFrame };
