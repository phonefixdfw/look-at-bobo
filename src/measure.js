// src/measure.js — numbers measured back OUT of the built geometry, so a
// selfTest check can actually fail instead of trusting the art. Extracted
// from design/style-test/styletest.js; contactGap takes its support from the
// page instead of reading a page-local LAYOUT.

import * as THREE from 'three';
import { TOKENS } from './tokens.js';
import { isHeadPart, ellSDF, boxSDF } from './markings.js';

const DASH_EXPECT = { c: [0, 0.036, 0.058], h: [0.0095, 0.036, 0.032] }; // where the art says the dash is
const BIB_EXPECT = {
  sit: { c: [0, 0.245, 0.122], h: [0.098, 0.095, 0.105] },
  loaf: { c: [0, 0.1, 0.145], h: [0.075, 0.07, 0.075] },
  side: { c: [0.062, 0.095, 0.135], h: [0.05, 0.075, 0.085] },
  back: { c: [0, 0.21, 0.115], h: [0.085, 0.055, 0.09] },
};
const COLLAR_EXPECT = {
  sit: { c: [0, 0.386, 0.045], h: [0.125, 0.034, 0.105] },
  sprawl: { c: [0, 0.185, 0.165], h: [0.155, 0.115, 0.04] },
  side: { c: [0.02, 0.2, 0.165], h: [0.105, 0.015, 0.05] },
};
const LIN_WHITE = new THREE.Color(TOKENS.furWhite).r;
const LIN_BLACK = new THREE.Color(TOKENS.furBlack).r;

/** How much of each marking actually landed where the art says it should.
 *  Head rules are measured in head space, body rules in cat-root space. */
function scanMarkings(cat, pose) {
  cat.root.updateWorldMatrix(true, true);
  const group = cat.poses[pose];
  const headGroup = cat.pivots[pose].head;
  const invRoot = new THREE.Matrix4().copy(cat.root.matrixWorld).invert();
  const invHead = new THREE.Matrix4().copy(headGroup.matrixWorld).invert();
  const out = { dash: 0, bib: 0, collar: 0, shells: 0, whiskers: 0, dashExtent: 0 };
  const dashPts = [];
  const v = new THREE.Vector3();
  const m = new THREE.Matrix4();
  group.traverse((obj) => {
    if (obj.userData.fuzz) {
      out.shells++;
      return;
    }
    if (obj.userData.tag === 'whisker') {
      out.whiskers += obj.geometry.attributes.position.count / 2;
      return;
    }
    if (!obj.isMesh) return;
    const col = obj.geometry?.attributes?.color;
    if (!col) return;
    const toHead = isHeadPart(obj);
    m.multiplyMatrices(toHead ? invHead : invRoot, obj.matrixWorld);
    const pos = obj.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(m);
      const w = (col.getX(i) - LIN_BLACK) / Math.max(1e-6, LIN_WHITE - LIN_BLACK);
      if (toHead) {
        const d = boxSDF(v, DASH_EXPECT.c, DASH_EXPECT.h);
        if (d < -0.002 && w >= 0.75) out.dash++;
        if (d < 0.006 && w >= 0.4) dashPts.push(v.x, v.y, v.z);
      } else {
        if (w < 0.75) continue;
        const bib = BIB_EXPECT[pose];
        const collar = COLLAR_EXPECT[pose];
        if (bib && ellSDF(v, bib.c, bib.h) < -0.002) out.bib++;
        if (collar && ellSDF(v, collar.c, collar.h) < -0.002) out.collar++;
      }
    }
  });
  if (dashPts.length >= 3) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(dashPts, 3));
    const box3 = new THREE.Box3().setFromBufferAttribute(g.attributes.position);
    const size = box3.getSize(new THREE.Vector3());
    out.dashExtent = Math.max(size.x, size.y, size.z) * cat.root.scale.y;
  }
  return out;
}

/** Lowest point of a cat's feet/body minus the support surface it stands on.
 *  `support` is the support NAME and `SUPPORTS` the measured map (from
 *  buildRoom), so the page keeps its own layout decisions. */
function contactGap(cat, support, SUPPORTS) {
  const y0 = SUPPORTS[support] ?? 0;
  cat.root.updateWorldMatrix(true, true);
  let lowest = Infinity;
  let who = '';
  for (const mesh of cat.contacts[cat.current]) {
    const min = new THREE.Box3().setFromObject(mesh).min.y;
    if (min < lowest) {
      lowest = min;
      who = mesh.userData.tag ?? 'part';
    }
  }
  return { gap: lowest - y0, support, who };
}

export { DASH_EXPECT, BIB_EXPECT, COLLAR_EXPECT, scanMarkings, contactGap };
