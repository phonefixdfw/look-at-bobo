// src/markings.js — markings as SDF rules, painted into vertex colours
// (docs/ART_STYLE.md §5). Both cats come from the same builder; what makes
// Bobo Bobo is WHICH rules are switched on. Extracted verbatim from
// design/style-test/styletest.js.

import * as THREE from 'three';
import { TOKENS } from './tokens.js';
import { lerp, sdfInside } from './util.js';

// ---------------------------------------------------------------------------
// 5. Markings as SDF rules, painted into vertex colours.
//
//    Both cats come from the same builder; what makes Bobo Bobo is WHICH rules
//    are switched on. That is the whole design system for the characters, and
//    it is why selfTest can measure "does the tell read at distance" instead of
//    trusting that someone drew the right spot.
//
//    Rules are authored in cat-root space (metres, +z forward, feet at y=0)
//    per pose, so they stay put when the cat changes pose or grows.
// ---------------------------------------------------------------------------
const MARK_EPS = 0.008; // 8 mm of soft edge: fur markings are never a hard decal

function ellSDF(p, c, r) {
  const dx = (p.x - c[0]) / r[0];
  const dy = (p.y - c[1]) / r[1];
  const dz = (p.z - c[2]) / r[2];
  const q = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return (q - 1) * Math.min(r[0], r[1], r[2]);
}
function boxSDF(p, c, h) {
  const qx = Math.abs(p.x - c[0]) - h[0];
  const qy = Math.abs(p.y - c[1]) - h[1];
  const qz = Math.abs(p.z - c[2]) - h[2];
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
  return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, qy, qz), 0);
}

/** Shared by both cats: the white muzzle. */
function rulesMuzzle() {
  return [{ sdf: (p) => ellSDF(p, [0, -0.03, 0.052 + 0], [0.048, 0.036, 0.04]), name: 'muzzle', head: true }];
}
/** BOBO ONLY — the tells, in priority order of legibility. */
function rulesBobo(pose) {
  const head = [
    ...rulesMuzzle(),
    // the thin vertical dash between the eyes: THE tell. Exaggerated from the
    // photo's ~4 x 20 mm to a readable blaze so it survives searching distance
    // (docs/ART_STYLE.md §5), still unmistakably the same marking.
    { sdf: (p) => boxSDF(p, [0, 0.036, 0.058], [0.0095, 0.036, 0.032]), name: 'dash', head: true },
  ];
  const body = pose === 'loaf'
    ? [
        { sdf: (p) => ellSDF(p, [0, 0.1, 0.145], [0.075, 0.07, 0.075]), name: 'bib' },
        { sdf: (p) => ellSDF(p, [0.086, 0.06, 0.02], [0.04, 0.03, 0.04]), name: 'belly-patch' },
      ]
    : [
        { sdf: (p) => ellSDF(p, [0, 0.245, 0.122], [0.098, 0.095, 0.105]), name: 'bib' },
        { sdf: (p) => ellSDF(p, [0.086, 0.09, 0.02], [0.04, 0.03, 0.04]), name: 'belly-patch' },
      ];
  return { head, body };
}
/** THE DECOY CAT — white feet (built as parts, not rules) and a white neck
 *  band. Explicitly no dash, no bib, no belly patch (docs/DECOY_CAT.md). */
function rulesDecoy(pose) {
  const head = rulesMuzzle();
  const body = pose === 'sprawl'
    ? [{ sdf: (p) => ellSDF(p, [0, 0.185, 0.165], [0.155, 0.115, 0.04]), name: 'collar' }]
    : [{ sdf: (p) => ellSDF(p, [0, 0.386, 0.045], [0.125, 0.034, 0.105]), name: 'collar' }];
  return { head, body };
}

const _vRoot = new THREE.Vector3();
const _mPartToRoot = new THREE.Matrix4();
const _mRootInv = new THREE.Matrix4();
const _mHeadInv = new THREE.Matrix4();
const isHeadPart = (mesh) => mesh.userData.tag === 'head' || mesh.userData.tag === 'ear';

/** Paint one pose's marking rules into the meshes' vertex colours.
 *
 *  Head rules are evaluated in HEAD space and body rules in cat-root space, so
 *  the dash stays put when the head turns and the bib stays put when the cat
 *  changes pose. Both are authored in metres against the same template. */
function paintPose(cat, poseName, rules, headGroup) {
  const group = cat.poses[poseName];
  if (!group) return;
  cat.root.updateWorldMatrix(true, true);
  _mRootInv.copy(cat.root.matrixWorld).invert();
  if (headGroup) _mHeadInv.copy(headGroup.matrixWorld).invert();
  const black = new THREE.Color(TOKENS.furBlack);
  const white = new THREE.Color(TOKENS.furWhite);
  group.traverse((mesh) => {
    if (!mesh.isMesh || mesh.userData.fuzz || !mesh.geometry?.attributes?.position) return;
    if (mesh.material?.vertexColors !== true) return; // only fur takes markings
    const toHead = headGroup && isHeadPart(mesh);
    const active = toHead ? rules.head : rules.body;
    const geo = mesh.geometry;
    const pos = geo.attributes.position;
    if (!geo.attributes.color) {
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
    }
    const col = geo.attributes.color;
    _mPartToRoot.multiplyMatrices(toHead ? _mHeadInv : _mRootInv, mesh.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      _vRoot.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(_mPartToRoot);
      let w = 0;
      for (const r of active) w = Math.max(w, sdfInside(r.sdf(_vRoot), MARK_EPS));
      col.setXYZ(i, lerp(black.r, white.r, w), lerp(black.g, white.g, w), lerp(black.b, white.b, w));
    }
    col.needsUpdate = true;
  });
}

export { MARK_EPS, ellSDF, boxSDF, rulesMuzzle, rulesBobo, rulesDecoy, isHeadPart, paintPose };
