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
import { livingGapReport } from './full-living.js';
import { buildGrid, nearestStandable, bestApproach } from '../src/reach.js';
import { buildFullApartment } from './full-apartment.js';
import { bootGame, catRootYaw } from './engine.js';
import { FLUSH_PIECES, FLUSH_TOL, FACES } from './full-bedroom.js';
import { SPLASH } from './splash.js';

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
    // cushion contact. The pool (issue #53) also loaf this type on the sofa
    // back and the balcony chair, where local y IS up — so pick the pair of
    // axes that are horizontal for the pose actually on (rule: breath never
    // moves the contact, demo rule "never sinks").
    const s = Math.sin(t * 0.9);
    if (bobo.current === 'side' || bobo.current === 'back') {
      bp.body.scale.set(base.x, base.y * (1 + 0.02 * s), base.z * (1 + 0.014 * s));
    } else {
      bp.body.scale.set(base.x * (1 + 0.02 * s), base.y, base.z * (1 + 0.014 * s));
    }
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
    // (sideways scale only — a Y-scale would lift his paws off the contact;
    // on the issue #53 pool spots that lie this type down, the vertical axis
    // is local x, so the scuttle scales y there instead)
    bobo.root.rotation.y = catRootYaw(momentById(m).faceYaw) + Math.sin(t * 2.2) * 0.7;
    bp.tailPivot.rotation.y = Math.sin(t * 6.4) * 0.3;
    const scuttle = 1 + Math.abs(Math.sin(t * 6)) * 0.02;
    if (bobo.current === 'side' || bobo.current === 'back') bp.body.scale.set(base.x, base.y * scuttle, base.z);
    else bp.body.scale.set(base.x * scuttle, base.y, base.z);
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
 * Appended after the engine's own 48 (46 + the two spot-pool checks issue
 * #53 added) and the rest of the full page's stack (furniture scale, title
 * screen #57 → 58), then the seven Patriot Bobo checks issue #58 added, so
 * the full page reports 65. */
function fullExtraChecks({ add, THREE, scene, supports, buildCat, setCatPose, contactGap, MOMENTS, DECOY_SPOTS, SPAWNS, wallBoxes, SPOTS = null, DECOY_MIN_DIST, pickDecoySpot, mulberry32, hashId, game, TARGET, triggerEvent, PATRIOT, runPatriotPlan, SEED, SETTINGS, confetti, stageSeek, bonusPopEl, addPatriotCostume, removePatriotCostume, isPatriotAttached }) {
  add('moments-count', MOMENTS.length, '10', MOMENTS.length === 10, "docs/STORY.md's generic ten");

  // Every place Bobo can stand must be findable AND shoutable: measured paw
  // contact on its own support, probed the same way the live bobo-contact
  // check works. Issue #53: any spot the pool can draw must hold this, not
  // just the ten canonical tableau spots.
  const probe = buildCat('bobo');
  const bad = [];
  const catRecords = SPOTS ?? MOMENTS;
  for (const m of catRecords) {
    setCatPose(probe, m.pose);
    probe.root.position.set(m.spot[0], supports[m.spot[1]] ?? 0, m.spot[2]);
    probe.root.rotation.y = catRootYaw(m.faceYaw);
    const g = contactGap(probe, m.spot[1], supports);
    if (!(g.gap >= -0.001 && g.gap <= 0.002)) bad.push(`${m.id} ${g.gap.toFixed(4)}`);
  }
  add('every-moment-contact', bad.length ? bad.join(', ') : `${catRecords.length}/${catRecords.length} seated`, 'gap -0.001..+0.002 m', bad.length === 0, 'paws touch their own support at every spot');

  // Issue #27: lying variety must be real AND remain a game. At least three
  // moments lie (side/back) and at least one decoy spot does; and from the
  // nearest place a player can stand and see each lying cat, an eye-high ray
  // to BOTH head and body lands on the cat — the pointing hit-test walks the
  // whole root (catUnderCrosshair), so this pins that a sleeping-on-his-side
  // Bobo is still a hittable animal, not a bug-wide silhouette.
  {
    const lying = catRecords.filter((m) => m.pose === 'side' || m.pose === 'back');
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
      setCatPose(probe, m.pose); // one probe cat, re-posed per spot (#53 widened this list; building one per cat cost a second of build time for nothing)
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
      // ...and the small pieces of issue #44 (ruler rows 23-33): every one of
      // them must be present and measured, bar and stools included.
      'microwave',
      'kettle',
      'toaster',
      'coffee-maker',
      'dish-rack',
      'trash-bin',
      'bar-height',
      'bar-stool',
      'rug-runner',
      // rows 34-41 and 60: the living room (issue #46). Every one of these is
      // tagged by a mesh game/full-living-mesh.js builds — a row nobody built
      // fails the run, which is the whole point.
      'sofa',
      'seat-height',
      'sofa-back',
      'coffee-table',
      'side-table',
      'tv-screen',
      'tv-stand',
      'bookshelf',
      'floor-lamp',
      'cardboard-box',
      // the bedroom (issue #48)
      'headboard',
      'bed-frame',
      'bed-queen',
      'mattress-height',
      'folded-blanket',
      'nightstand',
      'desk',
      'keyboard',
      'monitor',
      'desk-chair',
      'desk-chair-back',
      'dresser',
      'wardrobe',
      'laundry-basket',
      'laundry-pile',
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
      'issues #41/#46: kitchen and living room measure what the ruler says, not what they were handed',
    );
  }

  /* Issue #46 — row 58 through the living room: the routes between the real
   * furniture, measured off the footprints the pieces were drawn from. The
   * walk graph (walk-reachable, above) already drags a 0.30 m body through
   * them on a grid; this is the same claim stated in the ruler's own units,
   * so "≥ 0.90 m anywhere" is a printed number and not a vibe. */
  {
    const rows = livingGapReport();
    const short = rows.filter((r) => r.min != null && !(r.m >= r.min));
    add(
      'living-walkways',
      short.length ? short.map((r) => `${r.name} ${r.m.toFixed(2)} < ${r.min}`).join(', ') : rows.map((r) => `${r.name} ${r.m.toFixed(2)} m`).join(' · '),
      'row 58: ≥ 0.90 m on every route; the sofa→coffee gap is a reach, not a walkway',
      short.length === 0,
      'issue #46: the gaps between real furniture, measured between the footprints',
    );
  }

  /* Issue #48 — `bedroom-flush-to-wall`: the pieces issue #48 calls flush
   * hug their wall within FLUSH_TOL (0.05 m), measured off the same built
   * world AABBs `furniture-real-scale` uses — and the two nightstands flank
   * the headboard's z edges on the same face, so the west run is one line
   * of furniture meeting the plaster, not three pieces placed near it. */
  {
    const byName = new Map();
    scene.traverse((o) => {
      if (o.isMesh && o.name) byName.set(o.name, o);
    });
    const boxOf = (id) => {
      const m = byName.get(id);
      if (!m) return null;
      m.updateWorldMatrix(true, false);
      return new THREE.Box3().setFromObject(m);
    };
    const bad = [];
    let worst = 0;
    for (const f of FLUSH_PIECES) {
      const b = boxOf(f.id);
      if (!b) {
        bad.push(`${f.id}: not in the scene`);
        continue;
      }
      const gap = f.face === 'w' ? b.min.x - FACES.w : FACES.e - b.max.x;
      if (!(gap >= -0.005 && gap <= FLUSH_TOL)) {
        bad.push(`${f.id} ${f.face}-face gap ${gap.toFixed(3)} outside -0.005…${FLUSH_TOL}`);
      }
      if (gap > worst) worst = gap;
    }
    const hb = boxOf('bed-headboard');
    const nw = boxOf('nightstand-north');
    const ns = boxOf('nightstand-south');
    if (hb && nw && nw.max.z > hb.min.z + 0.005) bad.push('nightstand-north overlaps the headboard');
    if (hb && ns && ns.min.z < hb.max.z - 0.005) bad.push('nightstand-south overlaps the headboard');
    add(
      'bedroom-flush-to-wall',
      bad.length ? bad.join(', ') : `5 pieces flush, worst gap ${worst.toFixed(3)} m`,
      `gap <= ${FLUSH_TOL} m and the nightstands flank the headboard`,
      bad.length === 0,
      'issue #48: the headboard is flat on the west wall, not near it',
    );
  }

  /* ---- Patriot Bobo (issue #58) — the rare +3 costume cat ---- */

  // 1. THE SPAWN RULE, proven as data: the pure planner over 500 seeds ×
  //    10 finds obeys every invariant exactly — never the first find, never
  //    back-to-back, never more than the cap — and lands near its advertised
  //    odds. The live roll in the engine is the same function on one seed.
  {
    const invBad = [];
    let hit = 0, legalRolls = 0, seedsAny = 0;
    for (let s = 1; s <= 500; s++) {
      const p = runPatriotPlan(s, 10, { enabled: true });
      if (p[0]) invBad.push(`seed ${s}: first find`);
      let count = 0, prev = false;
      for (let f = 1; f <= 10; f++) {
        const legal = f >= PATRIOT.firstFind && count < PATRIOT.maxPerRun && !prev;
        if (legal) legalRolls++;
        if (p[f - 1]) {
          count++;
          if (prev) invBad.push(`seed ${s}: consecutive at ${f}`);
        }
        hit += p[f - 1] ? 1 : 0;
        prev = p[f - 1];
      }
      if (count > PATRIOT.maxPerRun) invBad.push(`seed ${s}: ${count} per run`);
      if (count > 0) seedsAny++;
    }
    const rollRate = hit / legalRolls; // the dice themselves: ≈ 1 in 6
    const seedRate = seedsAny / 500; // how many runs get a Patriot at all
    const rules = PATRIOT.chance === 1 / 6 && PATRIOT.maxPerRun === 2 && PATRIOT.firstFind === 2 && PATRIOT.reward === 3;
    const ok = invBad.length === 0 && rules && rollRate > 0.13 && rollRate < 0.22 && seedRate > 0.55 && seedRate < 0.95;
    add(
      'patriot-spawn-rule',
      invBad.length ? invBad.slice(0, 3).join(', ') : `roll ${(rollRate * 100).toFixed(1)}%, ${(seedRate * 100).toFixed(0)}% of seeds`,
      'never 1st, never back-to-back, ≤2/run; roll ≈1 in 6',
      ok,
      'issue #58: one seeded dice per legal find — 500 seeds, 10 finds each',
    );
  }

  // 2. The DEFAULTS stay quiet: the capture/bot seed (11) draws no Patriot
  //    in ten finds and the stress seeds none in their short win=3 runs, so
  //    every baseline frame and bot number predating #58 keeps its pixels.
  //    If a future spot pool or chance change breaks this, re-pick the dice
  //    tag (PATRIOT.seedTag) — do NOT "fix" this check by loosening it.
  {
    const p = (s) => runPatriotPlan(s, 10, { enabled: true });
    const elevenQuiet = p(11).every((x) => !x);
    const stressQuiet = [23, 47, 9].every((s) => p(s).slice(0, 3).every((x) => !x));
    add(
      'patriot-default-seed-quiet',
      elevenQuiet && stressQuiet ? 'seed 11: 0 in 10; seeds 23/47/9: 0 in 3' : 'a baseline seed draws Patriot — re-pick PATRIOT.seedTag',
      'seed 11 never; stress seeds not in their scored finds',
      elevenQuiet && stressQuiet,
      'capture:full and the stress suites run Patriot-free on their default seeds',
    );
  }

  // 3. THE +3 AND THE EARLY WIN: a Patriot catch pays PATRIOT.reward, the
  //    win fires at score ≥ TARGET (8 + 3 wins at 11), and the wrong-cat
  //    −1 is untouched whether or not he was the one you pointed at.
  {
    const fire = (score, event, patriot) => {
      game.phase = 'find';
      game.score = score;
      game.patriot = patriot;
      triggerEvent(event);
      return `${game.score}/${game.phase}`;
    };
    const nearWin = fire(TARGET - 2, 'catch', true); // 8 -> 11: WIN, not catch
    const exact = fire(TARGET - 3, 'catch', true); // 7 -> 10: the exact-line win
    const mid = fire(TARGET - 5, 'catch', true); // 5 -> 8: still playing
    const plain = fire(TARGET - 5, 'catch', false); // plain Bobo still +1
    const dag = fire(5, 'wrong', true); // the penalty never rides the bonus
    game.patriot = false;
    const ok = nearWin === `${TARGET + 1}/win` && exact === `${TARGET}/win` && mid === `${TARGET - 2}/catch` && plain === `${TARGET - 4}/catch` && dag === '4/wrong';
    add(
      'patriot-reward-early-win',
      `${nearWin} ${exact} ${mid} ${plain} ${dag}`,
      `+3, win at ≥${TARGET} (8→11 wins); wrong still −1 floored`,
      ok,
      'issue #58: the bonus can end a run early — the win reads the score, not the count',
    );
  }

  // 4. Aim still lands on BOBO through the costume: from every compass
  //    angle a ray at his seated body resolves to cat-bobo (the costume is
  //    his subtree, never orphaned scenery), a ray aimed straight at the
  //    hat hits the costume and still resolves to Bobo, and it detaches
  //    cleanly.
  {
    const pc = buildCat('bobo'); // fresh probe; root.name is 'cat-bobo'
    const m = catRecords[0];
    setCatPose(pc, PATRIOT.pose); // the costume's pose, seated on the spot
    pc.root.position.set(m.spot[0], supports[m.spot[1]] ?? 0, m.spot[2]);
    pc.root.rotation.y = catRootYaw(m.faceYaw);
    pc.root.updateMatrixWorld(true);
    addPatriotCostume(pc, { quality: SETTINGS.quality, calm: SETTINGS.reducedMotion });
    const rc = new THREE.Raycaster();
    const target = new THREE.Vector3();
    pc.pivots[PATRIOT.pose].body.getWorldPosition(target);
    const origin = new THREE.Vector3();
    const catOf = (o) => {
      while (o && !(o.name ?? '').startsWith('cat-')) o = o.parent;
      return o ? o.name : null;
    };
    let stray = 0, rayHits = 0;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      origin.set(target.x + Math.sin(a) * 1.4, target.y + 0.25, target.z + Math.cos(a) * 1.4);
      rc.set(origin, target.clone().sub(origin).normalize());
      const first = rc.intersectObjects([pc.root], true).find((h) => h.object.isMesh && h.object.visible);
      if (!first) continue;
      rayHits++;
      if (catOf(first.object) !== 'cat-bobo') stray++;
    }
    // The compass rays skim the BODY centre, where fur wins the near-side
    // race; to prove the costume is aim-live (in the subtree, not invisible
    // scenery) aim straight at the topmost costume piece — the fur hat —
    // from above. Its first hit must be a costume mesh and must resolve to
    // cat-bobo exactly like the body does.
    pc.root.updateMatrixWorld(true);
    const cm = [];
    pc.root.traverse((o) => { if (o.isMesh && o.userData?.patriot) cm.push(o); });
    let top = null;
    for (const o of cm) {
      const b = new THREE.Box3().setFromObject(o);
      if (!top || b.max.y > top.max.y) top = b;
    }
    let hatResolves = false, hatOnCostume = false;
    if (top) {
      const c = top.getCenter(new THREE.Vector3());
      const from = c.clone().add(new THREE.Vector3(0.35, 0.55, 0.35));
      rc.set(from, c.clone().sub(from).normalize());
      const hit = rc.intersectObjects([pc.root], true).find((h) => h.object.isMesh && h.object.visible);
      hatResolves = !!hit && catOf(hit.object) === 'cat-bobo';
      hatOnCostume = !!hit && !!hit.object.userData?.patriot;
    }
    removePatriotCostume(pc);
    const clean = !isPatriotAttached(pc);
    const ok = rayHits >= 6 && stray === 0 && cm.length >= 5 && hatResolves && hatOnCostume && clean;
    add(
      'patriot-aim-hit',
      ok ? `${rayHits}/8 angles on cat-bobo; hat aim lands on the costume, resolves Bobo` : `${rayHits}/8 ray hits, ${stray} stray, ${cm.length} costume meshes, hat: resolves=${hatResolves} costume=${hatOnCostume}, detached=${clean}`,
      'every angle resolves cat-bobo; hat aim hits the costume; detaches clean',
      ok,
      'issue #58: the hat is part of Bobo — pointing never hits loose scenery',
    );
  }

  // 5. Dressing him never MOVES him: the costume swaps the pose only — same
  //    spot, same faceYaw — so the decoy distance rule (engine, above)
  //    covers Patriot rounds exactly as it covers plain ones. Re-verified
  //    here through the dressed record on every spot.
  {
    const moved = [];
    const decoyBad = [];
    for (const s of catRecords) {
      const dressed = { ...s, pose: PATRIOT.pose };
      if (dressed.spot !== s.spot || dressed.faceYaw !== s.faceYaw) moved.push(s.id);
      const d = pickDecoySpot(dressed.spot, mulberry32(hashId(`patriot-decoy ${s.id}`)), dressed.room);
      if (!d || Math.hypot(d.pos[0] - dressed.spot[0], d.pos[2] - dressed.spot[2]) < DECOY_MIN_DIST) decoyBad.push(s.id);
    }
    add(
      'patriot-spot-legal',
      moved.length || decoyBad.length ? `moved: ${moved.join(',')} decoy: ${decoyBad.join(',')}` : `${catRecords.length} spots hold him in place`,
      'costume never shifts the spot; decoy stays ≥ min distance',
      !moved.length && !decoyBad.length,
      'issue #58: he sits ON his drawn spot — nearest allowed pose, same place, same face',
    );
  }

  // 6. The bonus celebration is HIS ONLY: at the same seeked time in the
  //    same phase, a Patriot catch lights the "+3!" pop and the confetti
  //    and a plain catch leaves both at rest. Calm mode: both stay hidden
  //    either way (same rule as every other juice).
  {
    const savedPhase = game.phase;
    const calm = SETTINGS.reducedMotion;
    game.phase = 'catch';
    game.patriot = true;
    stageSeek(0.3);
    const popOn = !!bonusPopEl && bonusPopEl.style.display === 'block' && Number(bonusPopEl.style.opacity) > 0.05;
    const confOn = confetti ? confetti.points.visible : false;
    game.patriot = false;
    stageSeek(0.3);
    const popOff = !bonusPopEl || (bonusPopEl.style.display !== 'block' || Number(bonusPopEl.style.opacity) <= 0.05);
    const confOff = confetti ? !confetti.points.visible : true;
    game.phase = savedPhase;
    const wantPop = !calm;
    const wantConf = !calm && (!confetti || confetti.enabled !== false);
    const ok = popOn === wantPop && popOff && confOn === wantConf && confOff;
    add(
      'patriot-celebration-only-for-him',
      calm ? `calm: pop+confetti stay off for him too (rest=${popOff && confOff})` : `patriot: pop=${popOn} confetti=${confOn}; plain: ${popOff && confOff ? 'both at rest' : 'LEAKED'}`,
      calm ? 'hidden in calm mode, at rest for plain catches' : 'pop + confetti on a Patriot catch only',
      ok,
      'issue #58: extra fireworks belong to the bonus cat alone',
    );
  }

  // 7. Determinism and the OFF switch: the same seed yields the same plan
  //    across calls (the dice ride the seed, not the clock), and every seed
  //    under ?patriot=off draws nothing — the URL knob is absolute.
  {
    const twice = JSON.stringify(runPatriotPlan(SEED, 10, { enabled: true })) === JSON.stringify(runPatriotPlan(SEED, 10, { enabled: true }));
    let offAny = false;
    for (let s = 1; s <= 40; s++) if (runPatriotPlan(s, 10, { enabled: false }).some(Boolean)) offAny = true;
    add(
      'patriot-off-and-determinism',
      `${twice ? 'plan stable' : 'plan DRIFTED'}, ${offAny ? 'off leaks' : 'off: 0 in 400 finds'}`,
      'same seed = same plan; ?patriot=off draws none, ever',
      twice && !offAny,
      'issue #58: the roll is a pure function of the seed; the kill switch is real',
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
  splash: SPLASH, // issue #57: the title screen; pause/win hand back to it
});
