// src/cat.js — the cat builder (docs/ART_STYLE.md §6). One parametric builder,
// two cats: the difference is the marking rules that get switched on, and the
// root scale (mass). Extracted verbatim from design/style-test/styletest.js.

import * as THREE from 'three';
import { TOKENS } from './tokens.js';
import { DEG } from './util.js';
import { std, furMaterial, fuzzShell, fuzzMaterial } from './materials.js';
import { rulesBobo, rulesDecoy, paintPose } from './markings.js';

// ---------------------------------------------------------------------------
// 6. The cat builder. One parametric builder, two cats: the difference is the
//    marking rules that get switched on, and the root scale (mass).
//    Bobo is modelled at his CURRENT ~15 lb; Brandon's photo shows him at about
//    10 lb, so the photo gives the MARKINGS and the current spec gives the
//    BODY (docs/ART_STYLE.md §6 — the 15 lb body shape is an assumption).
// ---------------------------------------------------------------------------
function ellGeo(rx, ry, rz, w = 36, h = 24) {
  const g = new THREE.SphereGeometry(1, w, h);
  g.userData = { ell: [rx, ry, rz] };
  return g;
}
function addMesh(parent, geo, mat, pos, tag, { rot = null, cast = true, contact = false } = {}) {
  const m = new THREE.Mesh(geo, mat);
  if (geo.userData?.ell) m.scale.set(geo.userData.ell[0], geo.userData.ell[1], geo.userData.ell[2]);
  m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  m.castShadow = cast;
  m.receiveShadow = false;
  if (tag) m.userData.tag = tag;
  if (contact) m.userData.contact = true;
  parent.add(m);
  return m;
}
function cylinderBetween(a, b, r, mat, tag, segments = 1) {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const dir = new THREE.Vector3().subVectors(vb, va);
  const len = dir.length();
  // more height segments than a cylinder needs, because the markings are vertex
  // colours: a two-row cylinder has nowhere to put Bobo's bib where it rides up
  // onto the chest, and issue #34's proof that the decoy's neck is plain black
  // counts vertices in that zone — they have to exist to be counted.
  const g = new THREE.CylinderGeometry(r, r * 1.06, len, 20, segments, false);
  const m = new THREE.Mesh(g, mat);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  m.castShadow = true;
  if (tag) m.userData.tag = tag;
  return m;
}
function whiskers() {
  const pts = [];
  for (const s of [-1, 1]) {
    const root = [s * 0.028, -0.012, 0.058];
    for (let i = 0; i < 3; i++) {
      pts.push(root[0], root[1], root[2]);
      pts.push(s * (0.085 + i * 0.012), -0.02 - i * 0.009 + 0.012, 0.052 - i * 0.012);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: new THREE.Color(TOKENS.whisker) }));
  m.userData.tag = 'whisker';
  m.userData.noContact = true;
  return m;
}
/** The head, built around its own centre so it can hang off a pivot. */
function buildHead(mats) {
  const g = new THREE.Group();
  addMesh(g, ellGeo(0.09, 0.083, 0.084, 72, 48), mats.fur, [0, 0, 0], 'head');
  g.userData.eyes = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(s * 0.037, 0.012, 0.061);
    const sclera = addMesh(eye, new THREE.SphereGeometry(0.0165, 20, 14), mats.sclera, [0, 0, 0], 'eye', { cast: false });
    sclera.scale.set(1, 1.05, 0.7);
    const n = new THREE.Vector3(s * 0.32, 0.1, 0.94).normalize();
    const iris = new THREE.Mesh(new THREE.CircleGeometry(0.0105, 24), mats.iris);
    iris.position.copy(n).multiplyScalar(0.0148);
    iris.lookAt(new THREE.Vector3().addVectors(iris.position, n));
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.0044, 16), mats.pupil);
    pupil.position.copy(n).multiplyScalar(0.0156);
    pupil.lookAt(new THREE.Vector3().addVectors(pupil.position, n));
    g.add(eye);
    g.userData.eyes.push(eye);

    const ear = addMesh(g, new THREE.ConeGeometry(0.031, 0.054, 18), mats.fur, [s * 0.055, 0.064, -0.004], 'ear', {
      rot: [-18 * DEG, 0, s * 17 * DEG],
    });
    const inner = addMesh(g, new THREE.ConeGeometry(0.018, 0.03, 16), mats.earInner, [s * 0.05, 0.058, 0.013], 'ear-inner', {
      rot: [-18 * DEG, 0, s * 17 * DEG],
      cast: false,
    });
    void inner;
  }
  addMesh(g, ellGeo(0.0125, 0.009, 0.008, 18, 12), mats.nose, [0, -0.018, 0.076], 'nose', { cast: false });
  g.add(whiskers());
  return g;
}

const CAT_SPECS = {
  // issue #27: lying variety — Bobo sleeps on his side and rolls belly-up;
  // the decoy gets the side lie (the one lying pose that reads on a 22 lb
  // cat sprawled anywhere). Order matters: poses[0] is the built default.
  bobo: { scale: [1, 1, 1], poses: ['sit', 'loaf', 'side', 'back'], rules: rulesBobo },
  decoy: { scale: [1.3, 1.13, 1.12], poses: ['sit', 'sprawl', 'side'], rules: rulesDecoy },
};

function buildCat(kind) {
  const spec = CAT_SPECS[kind];
  const root = new THREE.Group();
  root.name = `cat-${kind}`;
  root.scale.set(spec.scale[0], spec.scale[1], spec.scale[2]);
  const mats = {
    fur: furMaterial({ sheen: true }),
    white: std(TOKENS.furWhite, { roughness: 0.62 }),
    nose: std(TOKENS.nose, { roughness: 0.45 }),
    earInner: std(TOKENS.earInner, { roughness: 0.75 }),
    sclera: std(0xf3efe6, { roughness: 0.25 }),
    iris: new THREE.MeshStandardMaterial({ color: new THREE.Color(TOKENS.eyes), roughness: 0.2, side: THREE.DoubleSide }),
    pupil: std(TOKENS.pupil, { roughness: 0.15 }),
    fuzz: fuzzMaterial(),
  };
  const cat = { kind, root, mats, poses: {}, contacts: {}, pivots: {}, current: spec.poses[0], fuzzCount: 0 };
  for (const pose of spec.poses) {
    const grp = new THREE.Group();
    grp.visible = pose === cat.current;
    const contacts = [];
    cat.pivots[pose] = buildPose(kind, pose, grp, mats, contacts);
    root.add(grp);
    cat.poses[pose] = grp;
    cat.contacts[pose] = contacts;
    paintPose(cat, pose, spec.rules(pose), cat.pivots[pose].head);
  }
  root.traverse((o) => {
    if (o.userData?.fuzz) cat.fuzzCount++;
  });
  return cat;
}

function setCatPose(cat, pose) {
  if (!cat.poses[pose] || cat.current === pose) return;
  cat.current = pose;
  for (const [name, grp] of Object.entries(cat.poses)) grp.visible = name === pose;
}

/** One pose of one cat, authored in cat-root space (metres, feet at y = 0). */
function buildPose(kind, pose, grp, mats, contacts) {
  const fur = mats.fur;
  const white = mats.white;
  const isDecoy = kind === 'decoy';

  if (pose === 'sit') {
    const haunch = addMesh(grp, ellGeo(0.135, 0.14, 0.13, 56, 40), fur, [0, 0.14, -0.05], 'torso', { contact: true });
    contacts.push(haunch);
    addMesh(grp, ellGeo(0.105, 0.16, 0.125, 56, 40), fur, [0, 0.215, 0.075], 'chest');
    grp.add(cylinderBetween([0, 0.3, 0.05], [0, 0.4, 0.038], isDecoy ? 0.062 : 0.055, fur, 'neck', 12));
    for (const s of [-1, 1]) {
      grp.add(cylinderBetween([s * 0.058, 0.25, 0.116], [s * 0.058, 0.065, 0.12], 0.028, fur, 'foreleg'));
      const paw = addMesh(grp, ellGeo(0.034, 0.023, 0.054, 24, 16), white, [s * 0.058, 0.023, 0.142], 'fore-paw', { contact: true, cast: false });
      contacts.push(paw);
      const hind = addMesh(grp, ellGeo(0.036, 0.024, isDecoy ? 0.06 : 0.054, 24, 16), white, [s * (isDecoy ? 0.105 : 0.1), 0.024, -0.135], 'hind-foot', { contact: true, cast: false });
      contacts.push(hind);
    }
  } else if (pose === 'loaf') {
    const body = addMesh(grp, ellGeo(0.125, 0.098, 0.2, 56, 40), fur, [0, 0.098, 0.01], 'torso', { contact: true });
    contacts.push(body);
    for (const s of [-1, 1]) {
      const paw = addMesh(grp, ellGeo(0.032, 0.021, 0.05, 24, 16), white, [s * 0.052, 0.021, 0.19], 'fore-paw', { contact: true, cast: false });
      contacts.push(paw);
    }
  } else if (pose === 'side') {
    // asleep on the side, belly to +x, head end at +z (issue #27 — "Bobo is
    // never lying on his side"). The loaf loafed over: the same egg rolled
    // 90° about z rests on its flank, so the contact box bottoms out at y 0
    // exactly like every other pose. The near-side legs are hidden under the
    // body (as in the loaf); the far-side paw and hindfoot poke out along the
    // floor so the silhouette reads "lying", not "fallen loaf".
    const w = isDecoy ? 1.16 : 1; // the decoy egg is a little bigger, as elsewhere
    const body = addMesh(grp, ellGeo(0.125 * w, 0.098 * w, 0.2 * w, 56, 40), fur, [0, 0.125 * w, 0], 'torso', {
      contact: true,
      rot: [0, 0, Math.PI / 2],
    });
    contacts.push(body);
    const paw = addMesh(grp, ellGeo(0.032, 0.022, 0.062 * w, 24, 16), white, [0.015, 0.022, 0.21 * w], 'fore-paw', { contact: true, cast: false });
    contacts.push(paw);
    const hind = addMesh(grp, ellGeo(0.036, 0.023, 0.058 * w, 24, 16), white, [0.02, 0.023, -0.16 * w], 'hind-foot', { contact: true, cast: false });
    hind.rotation.y = 0.45; // kicked-out hind leg
    contacts.push(hind);
  } else if (pose === 'back') {
    // belly-up, mid-roll (issue #27). Same egg rolled the other way so the
    // chest side faces +y; paws fly up and only the torso touches the bed.
    // A back lie is deliberately lighter on geometry than the side lie: it
    // is only ever staged on the big soft bed, seen from the doorway.
    const body = addMesh(grp, ellGeo(0.13, 0.105, 0.21, 56, 40), fur, [0, 0.13, 0], 'torso', { contact: true });
    body.rotation.z = -Math.PI / 2;
    contacts.push(body);
    for (const s of [-1, 1]) {
      addMesh(grp, ellGeo(0.03, 0.022, 0.048, 24, 16), white, [s * 0.052, 0.245, 0.1], 'fore-paw', { cast: false, rot: [0, 0, s * 0.35] });
      addMesh(grp, ellGeo(0.034, 0.024, 0.058, 24, 16), white, [s * 0.062, 0.22, -0.115], 'hind-foot', { cast: false, rot: [0, 0, s * 0.5] });
    }
  } else {
    // sprawl: the 22 lb cat belly-down with the hips out — reads as heavy and wide
    const body = addMesh(grp, ellGeo(0.175, 0.135, 0.25, 56, 40), fur, [0, 0.135, -0.05], 'torso', { contact: true });
    contacts.push(body);
    grp.add(cylinderBetween([0, 0.16, 0.18], [0, 0.17, 0.235], 0.075, fur, 'neck', 12));
    for (const s of [-1, 1]) {
      const paw = addMesh(grp, ellGeo(0.038, 0.022, 0.085, 24, 16), white, [s * 0.085, 0.022, 0.245], 'fore-paw', { contact: true, cast: false });
      contacts.push(paw);
      const hind = addMesh(grp, ellGeo(0.05, 0.026, 0.09, 24, 16), white, [s * 0.155, 0.026, -0.215], 'hind-foot', { contact: true, cast: false });
      hind.rotation.y = s * 0.5;
      contacts.push(hind);
    }
  }

  const headAt =
    pose === 'sit' ? [0, 0.445, 0.04]
    : pose === 'loaf' ? [0, 0.165, 0.155]
    : pose === 'side' ? [0.02, isDecoy ? 0.148 : 0.128, isDecoy ? 0.195 : 0.172]
    : pose === 'back' ? [0, 0.15, 0.185]
    : [0, 0.17, 0.245];
  const head = buildHead(mats);
  head.position.set(headAt[0], headAt[1], headAt[2]);
  // Head tilt per pose. These become the animation base (engine idle and the
  // moment anims add their drifts onto baseHeadX/baseHeadZ, never replacing).
  if (pose === 'side') head.rotation.set(-0.5, 0, -0.5); // cheek on the floor, face tipped up toward the viewer
  else if (pose === 'back') head.rotation.x = -0.7; // chin to the ceiling, belly-up
  else if (pose !== 'sit') head.rotation.x = 0.12;
  grp.add(head);

  const tailAt =
    pose === 'sit' ? [0, 0.135, -0.175]
    : pose === 'loaf' ? [0.09, 0.02, -0.12]
    : pose === 'side' ? [-0.01, 0.02, isDecoy ? -0.19 : -0.16]
    : pose === 'back' ? [0.05, 0.02, -0.185]
    : [0, 0.03, -0.285];
  const pivot = new THREE.Group();
  pivot.position.set(tailAt[0], tailAt[1], tailAt[2]);
  const pts =
    pose === 'sit'
      ? [[0, 0, 0], [0.02, -0.05, -0.07], [0.09, -0.02, -0.13], [0.14, 0.05, -0.1]]
      : pose === 'loaf'
        ? [[0, 0, 0], [0.07, 0.005, -0.04], [0.14, 0.01, 0.02], [0.13, 0.02, 0.09]]
        : pose === 'side' || pose === 'back'
          ? [[0, 0, 0], [0.06, 0.004, -0.05], [0.125, 0.008, 0.01], [0.145, 0.014, 0.08]] // trailing along the floor/sheet
          : [[0, 0, 0], [0.02, 0, -0.09], [0.05, 0.005, -0.17], [0.02, 0.01, -0.23]];
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const tail = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, isDecoy ? 0.021 : 0.016, 10, false), fur);
  tail.castShadow = true;
  tail.userData.tag = 'tail';
  pivot.add(tail);
  grp.add(pivot);

  // the fuzz silhouette: max 2 shells per cat (body + head)
  const bodyMesh = grp.children.find((c) => c.isMesh && c.userData.tag === 'torso');
  const shellBody = fuzzShell(bodyMesh, mats.fuzz);
  shellBody.position.copy(bodyMesh.position);
  shellBody.rotation.copy(bodyMesh.rotation); // lying poses roll the body; the fuzz rolls with it
  shellBody.scale.copy(bodyMesh.scale).multiplyScalar(1.045);
  shellBody.castShadow = false;
  grp.add(shellBody);
  const shellHead = fuzzShell(head.children[0], mats.fuzz);
  shellHead.scale.copy(head.children[0].scale).multiplyScalar(1.05);
  shellHead.castShadow = false;
  head.add(shellHead);
  return { head, tailPivot: pivot, body: bodyMesh, shells: [shellBody, shellHead], baseHeadX: head.rotation.x, baseHeadZ: head.rotation.z };
}

export { ellGeo, addMesh, cylinderBetween, whiskers, buildHead, CAT_SPECS, buildCat, setCatPose, buildPose };
