// src/materials.js — the materials library (docs/ART_STYLE.md §3). One place,
// reused everywhere. Extracted verbatim from design/style-test/styletest.js.

import * as THREE from 'three';
import { TOKENS } from './tokens.js';

// ---------------------------------------------------------------------------
// 4. The materials library (docs/ART_STYLE.md §3). One place, reused everywhere.
// ---------------------------------------------------------------------------
function std(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.8, metalness: 0, ...opts });
}
/** Fur: a standard PBR material with vertex colours, because the markings are
 *  painted into the mesh (see §5). `sheenTint` is only a specular tint: black
 *  cat fur is a mirror with a mood, not a matte blob. */
function furMaterial({ sheen = false, white = false } = {}) {
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: white ? 0.62 : 0.48, // black fur is glossier than white
    metalness: 0,
    sheen: sheen ? 0.6 : 0.25,
    sheenRoughness: 0.35,
    sheenColor: new THREE.Color(TOKENS.furSheen),
  });
}
/** The soft silhouette: a BackSide shell, slightly inflated, that fakes the
 *  fuzz edge without any fur shader cost. Max 2 per cat (selfTest counts). */
function fuzzShell(source, material) {
  const m = new THREE.Mesh(source.geometry, material);
  m.scale.multiplyScalar(1.045);
  m.userData.fuzz = true;
  m.userData.noContact = true;
  return m;
}
const fuzzMaterial = () =>
  new THREE.MeshBasicMaterial({
    color: new THREE.Color(TOKENS.furBlack).lerp(new THREE.Color(TOKENS.furSheen), 0.35),
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });

export { std, furMaterial, fuzzShell, fuzzMaterial };
