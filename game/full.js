/*!
 * Look at Bobo — Step 8: the FULL game.
 * The whole loop (ten generic moments in docs/STORY.md's list, random order,
 * respawn across the flat, DAG! for the wrong cat, win at 10) on the engine
 * that Step 6 proved — engine.js — booted against the full apartment
 * (game/full-apartment.js: living room + kitchenette, hall, bathroom,
 * bedroom) and the full data table (game/full-level.js). Brandon swaps the
 * moment list there; nothing about the real Bobo lives in here.
 *
 *   Play it:     npm run serve  ->  http://127.0.0.1:8123/game/full.html
 *   Capture it:  npm run capture:full
 */
import * as LEVEL from './full-level.js';
import { buildGrid, nearestStandable, bestApproach } from '../src/reach.js';
import { buildFullApartment } from './full-apartment.js';
import { bootGame, catRootYaw } from './engine.js';

/* ---- the ten moments, pose by pose ----
 * The engine runs the baseline idle right before this, only during `find`,
 * and hands over the pivot bundle `bp` (head / tailPivot / body / baseHeadX),
 * the body's base scale, the clip time `t`, the cats, the apartment and the
 * supports. Everything here is a pure function of t — seekable, capture-safe.
 * Poses are the cat's existing ones (sit / loaf); what makes each moment its
 * own is where it lives and what it does with its head, breath and tail. */
function fullMomentAnim({ bp, base, t, bobo, game, momentById, apt, supports }) {
  const m = game.momentId;

  // the pen is the one prop with a script of its own: it stands on the desk
  // until Bobo's moment bats it off, and it must be at rest for every other
  // moment's frames (and every staging) — so it is written every find frame.
  const pen = apt.pen;
  if (pen) resetPen(pen, supports); // at rest for every moment that isn't desk-pen

  if (m === 'couch-loaf') {
    // side-sleeping on the couch (pose 'side', issue #27): flank breathing in
    // the world-horizontal plane — the body egg is rolled, so local y/z are
    // horizontal here; scaling local x (idle's choice) would rock him off the
    // cushion contact.
    const s = Math.sin(t * 0.9);
    bp.body.scale.set(base.x, base.y * (1 + 0.02 * s), base.z * (1 + 0.014 * s));
    bp.tailPivot.rotation.y = Math.sin(t * 0.55) * 0.08; // a dreaming flick
  } else if (m === 'window-bird') {
    bp.head.rotation.y = Math.sin(t * 0.55) * 0.5; // sweeping the glass
    bp.head.rotation.x = bp.baseHeadX + Math.sin(t * 2.6) * 0.04; // chattering
    bp.tailPivot.rotation.y = Math.sin(t * 5.2) * 0.1; // the tip won't stop
  } else if (m === 'box-sit') {
    bp.head.rotation.y = Math.sin(t * 0.9) * 0.62; // peeking out of the box
    bp.tailPivot.rotation.y = Math.sin(t * 1.3) * 0.18;
  } else if (m === 'sink-sit') {
    // on the counter by the sink: a slow survey of the kitchen, head dipping
    // toward the drain between looks like something dripped
    bp.head.rotation.y = Math.sin(t * 0.42) * 0.55;
    bp.head.rotation.x = bp.baseHeadX + 0.05 + Math.max(0, Math.sin(t * 1.5)) * 0.06;
    bp.tailPivot.rotation.y = Math.sin(t * 0.8) * 0.12;
  } else if (m === 'desk-pen') {
    // the trickster: head locked on the pen, the haunches coiling a breath
    bp.head.rotation.x = bp.baseHeadX + 0.12 + Math.sin(t * 1.1) * 0.03; // locked on it
    bp.head.rotation.y = 0.18; // tilted over it, not at the room
    bp.body.scale.set(base.x * (1 + 0.012 * Math.sin(t * 2.2)), base.y, base.z);
    bp.tailPivot.rotation.y = Math.sin(t * 3.1) * 0.12; // the tell
    if (pen) batThePen(pen, supports, t);
  } else if (m === 'keyboard-sit') {
    // mid-groom on the warm keyboard: head tucked, licking arc, one ear
    // rotating at nothing in particular
    bp.head.rotation.x = bp.baseHeadX + 0.2 + Math.sin(t * 1.25) * 0.08;
    bp.head.rotation.y = Math.sin(t * 0.3) * 0.15;
    bp.tailPivot.rotation.y = Math.sin(t * 1.05) * 0.14;
  } else if (m === 'laundry-nap') {
    // deep sleep curled on its side in the laundry basket (pose 'side',
    // issue #27): slow whole-body breathing in the world-horizontal plane,
    // cheek settled into the laundry (baseHeadX is the lying tilt already)
    const s = Math.sin(t * 0.62);
    bp.body.scale.set(base.x, base.y * (1 + 0.024 * s), base.z * (1 + 0.018 * s));
    bp.head.rotation.x = bp.baseHeadX + Math.sin(t * 0.62) * 0.02;
    bp.tailPivot.rotation.y = Math.sin(t * 0.31) * 0.05; // one slow ear-flick worth of tail
  } else if (m === 'bed-stretch') {
    // belly-up roll-stretch on the bed (pose 'back', issue #27): the spine
    // extends along the bed and the belly flattens into the mattress; the
    // chin reaches further to the ceiling. Local x is world-up on this pose,
    // so the stretch rides y/z only — the contact never leaves the bed.
    const s = Math.sin(t * 0.55);
    bp.body.scale.set(base.x, base.y * (1 - 0.02 * s), base.z * (1 + 0.06 * s));
    bp.head.rotation.x = bp.baseHeadX - s * 0.08;
    bp.tailPivot.rotation.y = Math.sin(t * 2.4) * 0.06;
  } else if (m === 'blanket-biscuits') {
    // biscuits at ~2.2 Hz: the head nods with each press, the body rocks
    const s = Math.sin(t * 13.8);
    bp.head.rotation.x = bp.baseHeadX + 0.12 + s * 0.05;
    bp.body.scale.set(base.x * (1 + s * 0.012), base.y, base.z * (1 - s * 0.008));
    bp.tailPivot.rotation.y = Math.sin(t * 2.2) * 0.16; // the metronome
  } else if (m === 'hall-chase') {
    // the hallway zoomies: quick side-to-side scuttle, tail at full thrash
    // (sideways scale only — a Y-scale would lift his paws off the contact)
    bobo.root.rotation.y = catRootYaw(momentById(m).faceYaw) + Math.sin(t * 2.2) * 0.7;
    bp.tailPivot.rotation.y = Math.sin(t * 6.4) * 0.3;
    bp.body.scale.set(base.x * (1 + Math.abs(Math.sin(t * 6)) * 0.02), base.y, base.z);
  }
}

/* ---- the pen's two poses, both pure in t ----
 * Rest: standing on the desk beside Bobo's spot. The script (desk-pen only):
 * it trembles from t≈2.2, topples at 2.7, rolls toward the room-side edge
 * (x −2.54), drops off it mid-roll and settles rolling on the floor by 4.1.
 * A plain cylinder's own-axis spin is invisible, so the roll reads as a
 * drift and a tumble (root.rotation.z) — pure functions of t, no state:
 * any seek lands on the same frame. */
const PEN = {
  x: -2.66, z: 5.78, // standing spot (desk spans x −3.14..−2.54, z 5.2..6.2)
  len: 0.16, rad: 0.012,
  edge: -2.54, // the room-side edge it rolls off
  endX: -2.05, // where the roll finishes (on the floor)
  tTopple: 2.7, tRoll: 3.0, tRollEnd: 4.1,
};
function resetPen(pen, supports) {
  const dtop = supports.deskTop ?? 0.76;
  pen.root.position.set(PEN.x, dtop + PEN.len / 2, PEN.z);
  pen.root.rotation.set(0, 0, 0);
  pen.barrel.rotation.x = 0; // barrel upright at rest (its build pose is lying)
}
function batThePen(pen, supports, t) {
  const dtop = supports.deskTop ?? 0.76;
  if (t < 2.2) return; // quiet at first — Bobo is just looking
  if (t < PEN.tTopple) {
    // the bat: a paw-swipe tremble growing to a nudge
    const k = (t - 2.2) / (PEN.tTopple - 2.2);
    pen.root.rotation.z = Math.sin((t - 2.2) * 15) * 0.09 * k;
    return;
  }
  // topple about the barrel's x axis (standing → lying along z), 2.7→3.0
  const topple = Math.min(1, (t - PEN.tTopple) / (PEN.tRoll - PEN.tTopple));
  const e = 1 - (1 - topple) * (1 - topple); // ease-out-quad
  pen.barrel.rotation.x = (Math.PI / 2) * e;
  pen.root.rotation.z = 0;
  if (t < PEN.tRoll) {
    pen.root.position.set(PEN.x, dtop + PEN.len / 2 - e * (PEN.len / 2 - PEN.rad), PEN.z);
    return;
  }
  // roll along +x toward the room-side edge (barrel along z ⇒ rolling is a
  // rotation about z), then a free fall once past the edge, then the floor
  const r = Math.min(1, (t - PEN.tRoll) / (PEN.tRollEnd - PEN.tRoll));
  const x = PEN.x + r * (PEN.endX - PEN.x);
  pen.root.rotation.z = (t - PEN.tRoll) * 7; // tumbling drift
  const tEdge = PEN.tRoll + (PEN.edge - PEN.x) / (PEN.endX - PEN.x) * (PEN.tRollEnd - PEN.tRoll);
  const y = x <= PEN.edge
    ? dtop + PEN.rad // flat on the desktop, rolling
    : Math.max(PEN.rad, dtop + PEN.rad - 4.9 * (t - tEdge) * (t - tEdge)); // off the edge (g≈9.8)
  pen.root.position.set(x, y, PEN.z);
}

/* ---- full-game checks the engine can't know on its own ----
 * Appended after the engine's own 42, so the full page reports 46. */
function fullExtraChecks({ add, THREE, scene, supports, buildCat, setCatPose, contactGap, MOMENTS, DECOY_SPOTS, SPAWNS, wallBoxes }) {
  add('moments-count', MOMENTS.length, '10', MOMENTS.length === 10, "docs/STORY.md's generic ten");

  // Every moment must be findable AND shoutable: measured paw contact on its
  // own support, probed the same way the live bobo-contact check works.
  const probe = buildCat('bobo');
  const bad = [];
  for (const m of MOMENTS) {
    setCatPose(probe, m.pose);
    probe.root.position.set(m.spot[0], supports[m.spot[1]] ?? 0, m.spot[2]);
    probe.root.rotation.y = catRootYaw(m.faceYaw);
    const g = contactGap(probe, m.spot[1], supports);
    if (!(g.gap >= -0.001 && g.gap <= 0.002)) bad.push(`${m.id} ${g.gap.toFixed(4)}`);
  }
  add('every-moment-contact', bad.length ? bad.join(', ') : '10/10 seated', 'gap -0.001..+0.002 m', bad.length === 0, 'paws touch their own support at every spot');

  // Issue #27: lying variety must be real AND remain a game. At least three
  // moments lie (side/back) and at least one decoy spot does; and from the
  // nearest place a player can stand and see each lying cat, an eye-high ray
  // to BOTH head and body lands on the cat — the pointing hit-test walks the
  // whole root (catUnderCrosshair), so this pins that a sleeping-on-his-side
  // Bobo is still a hittable animal, not a bug-wide silhouette.
  {
    const lying = MOMENTS.filter((m) => m.pose === 'side' || m.pose === 'back');
    const lyingDecoy = DECOY_SPOTS.filter((s) => s.pose === 'side' || s.pose === 'back');
    const lbad = [];
    const grid = buildGrid({ rects: LEVEL.WALK_RECTS, colliders: LEVEL.COLLIDERS, radius: LEVEL.MOVE.playerRadius });
    const los = [
      ...wallBoxes,
      ...LEVEL.COLLIDERS.map((c) => ({ id: c.id, x0: c.x0, x1: c.x1, z0: c.z0, z1: c.z1, y0: 0, y1: 1.05 })),
    ];
    const rc = new THREE.Raycaster();
    const from = new THREE.Vector3();
    const to = new THREE.Vector3();
    for (const m of lying) {
      const y = supports[m.spot[1]] ?? 0;
      const probe = buildCat('bobo');
      setCatPose(probe, m.pose);
      probe.root.position.set(m.spot[0], y, m.spot[2]);
      probe.root.rotation.y = catRootYaw(m.faceYaw);
      probe.root.updateMatrixWorld(true);
      const near = nearestStandable(grid, m.spot[0], m.spot[2]);
      const a = bestApproach(grid, grid.flood(near.idx), { x: m.spot[0], z: m.spot[2], y, los, eye: LEVEL.MOVE.eye });
      if (!a) {
        lbad.push(`${m.id}: no approach`);
        continue;
      }
      from.set(a.x, LEVEL.MOVE.eye, a.z);
      for (const [part, node] of [
        ['head', probe.pivots[m.pose].head],
        ['body', probe.pivots[m.pose].body],
      ]) {
        node.getWorldPosition(to);
        rc.set(from, to.clone().sub(from).normalize());
        if (!rc.intersectObjects([probe.root], true).some((h) => h.object.isMesh)) {
          lbad.push(`${m.id}: ${part} misses from its approach`);
        }
      }
    }
    add(
      'lying-poses',
      lying.length >= 3 && lyingDecoy.length >= 1 && lbad.length === 0
        ? `${lying.map((m) => `${m.id}(${m.pose})`).join(' ')} + ${lyingDecoy.map((d) => d.id).join(' ')} aimable`
        : lbad.length ? lbad.join(', ') : `${lying.length} lying moments, ${lyingDecoy.length} lying decoys`,
      '≥3 side/back moments + ≥1 lying decoy, head+body ray-hit from an approach',
      lying.length >= 3 && lyingDecoy.length >= 1 && lbad.length === 0,
      'pointing still works on a lying cat (issue #27)',
    );
  }

  // the whole flat is in play: every room is visitable as a moment, a decoy
  // spot, or a spawn — and any room Bobo can be found in can hold a decoy
  const need = ['living', 'hall', 'bedroom', 'bathroom'];
  const have = new Set([...MOMENTS.map((m) => m.room), ...DECOY_SPOTS.map((d) => d.room), ...SPAWNS.map((s) => s.room)]);
  const missing = need.filter((r) => !have.has(r));
  add('rooms-covered', missing.length ? missing.join(', ') : 'all 4 rooms', 'living+hall+bedroom+bathroom', !missing.length, 'nothing in the flat is dead scenery');
  const momentRooms = [...new Set(MOMENTS.map((m) => m.room))];
  const bare = momentRooms.filter((r) => !DECOY_SPOTS.some((d) => d.room === r));
  add('decoy-in-searchable-rooms', bare.length ? bare.join(', ') : 'all', 'a decoy spot per findable room', !bare.length, '"is that…?" is possible everywhere Bobo can be');

  /* Issue #41 — `furniture-real-scale`: the ruler, measured back off the scene.
   *
   * Any mesh may carry a row of docs/ISSUE_33_REBUILD.md §1 in `userData.scale`
   * (game/full-kitchen.js is the first thing that tags anything); a row nobody
   * built is a failure too, which is what stops a 0.45 m sofa or a 3 m ceiling
   * shipping again. Measurements come off the built world AABB, never off the
   * numbers a builder was handed, in the convention game/full-level.js documents
   * above SCALE_RANGES: w = the long horizontal extent, d the short one, t the
   * thinner of the two, h the vertical extent, top/bottom the y it reaches. So a
   * cabinet reads the same whichever way its wall runs, and a run of counters
   * facing north measures its 0.60 depth as `d` without the checker knowing
   * which axis is which.
   *
   * `userData.scaleGroup` is the one extra concession to how things are drawn:
   * the faucet is a column and a spout, and row 18 is one object, so every mesh
   * sharing a group is unioned and the GROUP is measured. */
  {
    const rows = LEVEL.SCALE_RANGES;
    const REQUIRED = [
      'counter-height',
      'counter-depth',
      'worktop-thickness',
      'backsplash',
      'upper-cabinet',
      'upper-mounted',
      'cab-door',
      'sink',
      'faucet',
      'range',
      'hood',
      'fridge',
      'dishwasher',
    ];
    const boxes = new Map(); // row -> [[label, Box3]]
    const groups = new Map(); // group -> [label, Box3] to union
    const claim = (row, label, b) => {
      if (!boxes.has(row)) boxes.set(row, []);
      boxes.get(row).push([label, b]);
    };
    const seen = new Set();
    scene.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      const g = o.userData?.scaleGroup;
      const tag = o.userData?.scale;
      if (!g && !tag) return;
      o.updateWorldMatrix(true, false);
      const b = new THREE.Box3().setFromObject(o);
      if (b.isEmpty()) return;
      if (g) {
        seen.add(g);
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push([o.name || g, b]);
        return;
      }
      for (const t of Array.isArray(tag) ? tag : [tag]) claim(typeof t === 'string' ? t : t.key, o.name || 'untitled', b);
    });
    for (const [g, parts] of groups) {
      const u = parts.reduce((acc, [, b]) => acc.union(b), parts[0][1].clone());
      claim(g, parts.map(([n]) => n).join('+'), u);
    }
    const bad = [];
    let n = 0;
    for (const [row, hits] of boxes) {
      const spec = rows[row];
      if (!spec) {
        bad.push(`${row}: tagged by ${hits.length} mesh(es) but not in SCALE_RANGES`);
        continue;
      }
      for (const [label, b] of hits) {
        const dx = b.max.x - b.min.x;
        const dz = b.max.z - b.min.z;
        const got = {
          w: Math.max(dx, dz),
          d: Math.min(dx, dz),
          t: Math.min(dx, dz),
          h: b.max.y - b.min.y,
          top: b.max.y,
          bottom: b.min.y,
        };
        for (const key of Object.keys(spec)) {
          if (key === 'note') continue;
          const [lo, hi] = spec[key];
          const v = got[key];
          if (!(v >= lo && v <= hi)) bad.push(`${label} ${row}.${key} ${v.toFixed(3)} outside ${lo}…${hi}`);
        }
        n++;
      }
    }
    for (const row of REQUIRED) if (!boxes.has(row)) bad.push(`${row}: nothing in the scene carries it`);
    add(
      'furniture-real-scale',
      bad.length ? bad.join(', ') : `${n} boxes across ${boxes.size} ruler rows`,
      `every tagged box inside docs/ISSUE_33_REBUILD.md §1 (+${REQUIRED.length} rows required)`,
      bad.length === 0,
      'issue #41: the kitchen measures what the ruler says, not what it was handed',
    );
  }
}

bootGame({
  bootName: 'step 8 full game',
  failPrefix: 'Look at Bobo failed to start',
  level: LEVEL,
  buildApartment: buildFullApartment,
  momentAnim: fullMomentAnim,
  winDefault: LEVEL.TARGET_DEFAULT, // 10 — the real target
  extraChecks: fullExtraChecks,
  hintFade: { fadeStart: 12, fadeEnd: 18 }, // the hint teaches, then gets out of the way
});
