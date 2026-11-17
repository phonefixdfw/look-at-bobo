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
import { bathGapReport, FOOT } from './full-bath.js';
import { DECOR, DECOR_CELLS, DECOR_ART_COUNT, DECOR_TEXTURES, SPOT_CLEAR, decorPlan, faceCells } from './full-decor.js';
import { buildGrid, nearestStandable, bestApproach, lineClear } from '../src/reach.js';
import { buildFullApartment } from './full-apartment.js';
import { bootGame, catRootYaw } from './engine.js';
import { FLUSH_PIECES, FLUSH_TOL, FACES } from './full-bedroom.js';
import { EYEWITNESS } from './full-street.js';
import { TRADEMARK_WORDS } from '../src/kart-screen.js';
import { OPENINGS, ROOM_BY_ID, ROOMS, WALL_DEFS, BAND_T, LEAF_W, SUPPORT_DEFS } from './full-shell.js';
import { diningGapReport } from './full-dining.js';
import { woodTextureAudit } from '../src/polish.js';
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
 * screen #57 → 58), then the seven Patriot Bobo checks issue #58 added, and
 * the three door/wood checks issue #65 added, and the four bathroom/entry
 * checks issue #67 added, and the `findable` hiding guarantee issue #70
 * added, so the full page reports 82, the `decoy-on-furniture` promise issue
 * #89 appended makes it 95, and the four Uptown-backdrop checks issue #83
 * adds make it 99. */
/** Door frames are rendered ONCE per page by `doorways-read-open`: they
 *  check static geometry, and selfTest runs per capture frame — re-rendering
 *  six extra frames every time starves the live frame loop under load (the
 *  stress suite's 150 ms reticle-soft window noticed on a busy machine). */
const doorFramesDone = { v: false };
/** Same rule for issue #67's three pixel checks: they measure geometry and
 *  lights, which cannot change between selfTest calls, and they cost five
 *  renders a pass. `entry` and `luma` are the numbers they measured, kept for
 *  the detail strings once the measuring is done. */
const roomLightFrames = { v: false, entry: null, luma: null };
/** …and the same rule again for issue #83's street pixel check: two renders
 *  once per page, `blues` keeps what it measured for the detail line. */
const streetFrames = { v: false, blues: null };
function fullExtraChecks({ add, THREE, scene, renderer, supports, buildCat, setCatPose, contactGap, MOMENTS, MOMENT_IDS, DECOY_SPOTS, SPAWNS, wallBoxes, doorLeaves = [], aptStreet = null, aptCull = null, aptTv = null, SPOTS = null, SPOT_IDS = null, pickSpotCycle = null, DECOY_MIN_DIST, pickDecoySpot, mulberry32, hashId, game, TARGET, triggerEvent, PATRIOT, runPatriotPlan, SEED, SETTINGS, confetti, stageSeek, bonusPopEl, camera, addPatriotCostume, removePatriotCostume, isPatriotAttached }) {
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

  // Issue #70: PARTIAL HIDING means partial. Every spot whose `hide` names a
  // prop is re-measured with the sight maths at each prop's TRUE drawn height
  // (SIGHT_HEIGHTS — the engine's own 1.05 clip is right for walking AI and
  // wrong here: a 0.86 m vanity must hide what it really hides, and a grown
  // plant what it NOW hides), plus the hide box itself (cloth like the shower
  // curtain is not a collider — nothing else would ever block for it). The
  // test: with the cover in place, `bestApproach` — the very function the
  // engine's hint system uses — must still return a vantage that sees the
  // cat. A spot that becomes unfindable behind its own prop fails the build,
  // by name. The visible-ring percentage rides along in the value so the
  // capture report carries the per-spot evidence ("how hidden" next to "is
  // findable"). Hiding never blocks the SHOUT either, and that part is not
  // measured but structural: catUnderCrosshair raycasts against the two cat
  // roots only — no prop is ever between the crosshair and the cat.
  {
    const bad = [];
    const lines = [];
    const hidden = [...(SPOTS ?? []), ...DECOY_SPOTS].filter((s) => s.hide);
    if (hidden.length) {
      const grid = buildGrid({ rects: LEVEL.WALK_RECTS, colliders: LEVEL.COLLIDERS, radius: LEVEL.MOVE.playerRadius });
      const seen = grid.flood(grid.cellAt(SPAWNS[0].pos[0], SPAWNS[0].pos[1]));
      const noRow = LEVEL.COLLIDERS.filter((c) => LEVEL.SIGHT_HEIGHTS[c.id] === undefined).map((c) => c.id);
      if (noRow.length) bad.push(`SIGHT_HEIGHTS missing rows: ${noRow.join(', ')}`);
      const losTrue = [
        ...wallBoxes,
        ...LEVEL.COLLIDERS.map((c) => ({ id: c.id, x0: c.x0, x1: c.x1, z0: c.z0, z1: c.z1, y0: 0, y1: LEVEL.SIGHT_HEIGHTS[c.id] ?? 1.05 })),
      ];
      const eye = LEVEL.MOVE.eye;
      for (const s of hidden) {
        const prop = LEVEL.HIDE_PROPS[s.hide];
        if (!prop) { bad.push(`${s.id}: hide "${s.hide}" names no HIDE_PROPS row`); continue; }
        const [x, sup, z] = s.spot ?? s.pos;
        const y = supports[sup] ?? 0;
        const los = [...losTrue, ...prop.boxes.map((b) => ({ id: `hide:${s.hide}`, ...b }))];
        const a = bestApproach(grid, seen, { x, z, y, los, eye });
        if (!a) { bad.push(`${s.id}: UNFINDABLE behind ${s.hide}`); continue; }
        // how hidden: reachable ring cells (the approach band, 0.9…3.4 m)
        // that can see the cat at all, behind its cover
        let vis = 0, ring = 0;
        const c0 = grid.cellAt(x, z);
        const i0 = Math.floor(c0 / grid.cols), j0 = c0 % grid.cols;
        for (let i = i0 - 34; i <= i0 + 34 && ring < 1e9; i++) {
          for (let j = j0 - 34; j <= j0 + 34; j++) {
            const idx = i * grid.cols + j;
            if (i < 0 || j < 0 || idx < 0 || idx >= grid.free.length) continue;
            if (!grid.free[idx] || !seen[idx]) continue;
            const c = grid.centre(idx);
            const d = Math.hypot(c.x - x, c.z - z);
            if (d < 0.9 || d > 3.4) continue;
            ring++;
            if (lineClear(los, c.x, eye, c.z, x, y + 0.3, z)) vis++;
          }
        }
        const share = ring ? vis / ring : 0;
        if (share >= 0.5) bad.push(`${s.id}: ${s.hide} hides nothing (${Math.round(share * 100)}% of the ring sees him)`);
        lines.push(`${s.id}/${Math.round(share * 100)}%/${a.dist.toFixed(2)}m`);
      }
      const pool = SPOTS ?? [];
      const hiddenBobo = pool.filter((s) => s.hide).length;
      if (hiddenBobo > pool.length / 4) bad.push(`hiding pool grew past a quarter (${hiddenBobo}/${pool.length})`);
    }
    add(
      'findable',
      bad.length ? bad.join(', ') : `${lines.length} hiding spots all findable — id/visible-ring%/nearest-vantage: ${lines.join(' ')}`,
      'every `hide` spot has a vantage that sees it; <50% of the ring sees a hiding cat; ≤25% of the pool hides',
      !bad.length && hidden.length >= 6,
      'issue #70: partly hidden, never unfindable — and the shout ray only ever tests the cat meshes, so props cannot block a find',
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
      // rows 52-59 (issue #49): the bathroom and the balcony. Same rule —
      // a row nobody built fails the run. 'toilet', 'vanity' and 'railing'
      // already had rows and are re-tagged by full-bath-mesh.js (the faucet
      // row stays the kitchen's and the side-table row the living drum's —
      // the balcony's chair and bistro table are drawn at their sizes inside
      // the railing chunk rather than claiming rows someone else owns).
      // These four are new, and every one is tagged by full-bath-mesh.js.
      'tub',
      'bath-mirror',
      'towel-bar',
      'bath-mat',
      // issue #81: the dining set. All three rows exist in SCALE_RANGES and
      // every one is tagged by game/full-dining-mesh.js through the pieces'
      // own `scale` field — the table claims its row once, each of the four
      // chairs re-measures the chair row, and the sideboard its own.
      'dining-table',
      'dining-chair',
      'sideboard',
      // issue #82: the cat-care props. The pad on the sofa's south cushion,
      // the two bowls measured as one pair, and the low tray on the bath
      // strip — all tagged by their own builders, so all three are measured.
      'heat-pad',
      'food-bowl',
      'litter-box',
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

  /* Issue #82 — the heat pad's own claim: the `heatPad` support is not a
   * number floated over the sofa, it IS the drawn pad. Measured off the
   * built mesh: the pad's bottom rests on the cushion's top (0.45) and its
   * top is the support a cat stands on (0.48). `every-moment-contact` proves
   * the loaf touches 0.48; this proves 0.48 is real furniture. */
  {
    const sup = SUPPORT_DEFS.heatPad;
    const cush = SUPPORT_DEFS.cushion;
    let box = null;
    scene.traverse((o) => {
      const t = o.userData?.scale;
      if (!o.isMesh || (t !== 'heat-pad' && !(Array.isArray(t) && t.includes('heat-pad')))) return;
      o.updateWorldMatrix(true, false);
      const b = new THREE.Box3().setFromObject(o);
      box = box ? box.union(b) : b;
    });
    const ok = !!box && Math.abs(box.max.y - sup.top) < 0.001 && Math.abs(box.min.y - cush.top) < 0.001;
    add(
      'heat-pad-rests-on-cushion',
      box ? `pad ${box.min.y.toFixed(3)}…${box.max.y.toFixed(3)} m` : 'no heat-pad mesh carries the row',
      `pad bottom = cushion top ${cush.top}, pad top = heatPad support ${sup.top} (±0.001)`,
      ok,
      'issue #82: three cm of warmth is the support itself: neither floating nor sunken',
    );
  }

  /* Issue #82 — the three cat-care footprints (the tray, the bowls and the
   * bigger bin) leave the flat's plan open: no spawn's stand cell inside a
   * body pad, no floor spot inside a body pad, no decoy standing inside a
   * raw box. The walk-graph checks re-run against these colliders anyway;
   * this prints the tightest spawn gap so the clearances are a number. */
  {
    const pad = 0.3; // MOVE.playerRadius: how far a collider's pad reaches
    const props = ['litter-box', 'pet-bowls', 'kitchen-bin'];
    const rects = LEVEL.COLLIDERS.filter((c) => props.includes(c.id));
    const bad = [];
    let minSpawn = Infinity;
    let tight = '';
    const outside = (r, x, z, m) => x < r.x0 - m || x > r.x1 + m || z < r.z0 - m || z > r.z1 + m;
    for (const s of LEVEL.SPAWNS) {
      for (const r of rects) {
        if (!outside(r, s.pos[0], s.pos[1], pad)) bad.push(`spawn at ${s.room} inside ${r.id}'s body pad`);
        const d = Math.max(r.x0 - s.pos[0], s.pos[0] - r.x1, r.z0 - s.pos[1], s.pos[1] - r.z1);
        if (d < minSpawn) { minSpawn = d; tight = `${s.room} spawn ↔ ${r.id}`; }
      }
    }
    for (const sp of LEVEL.SPOTS) {
      if (sp.spot[1] !== 'floor') continue; // furniture-top spots ride their own support
      for (const r of rects) if (!outside(r, sp.spot[0], sp.spot[2], pad)) bad.push(`${sp.id} inside ${r.id}'s body pad`);
    }
    for (const d of LEVEL.DECOY_SPOTS) {
      for (const r of rects) if (!outside(r, d.pos[0], d.pos[2], 0)) bad.push(`${d.id} stands inside ${r.id}`);
    }
    add(
      'cat-props-clear-the-plan',
      bad.length ? bad.join(', ') : `tightest spawn gap ${minSpawn.toFixed(2)} m (${tight}); every floor spot and decoy clear`,
      'the three issue #82 footprints cover no spawn cell, no floor spot, no decoy',
      bad.length === 0 && rects.length === 3,
      'issue #82: the litter tray, the bowls and the bigger bin leave every route, spot and spawn open',
    );
  }

  /* Issue #89 — the furniture decoys: the lazy 22 lb cat may now be furniture
   * furniture-deep, and the furniture promises are mechanical. At least eight
   * furniture decoy spots over four rooms or more; every point inside its own
   * SUPPORT_DEFS patch (a decoy cannot rot into a decoy in mid-air); paws on
   * their own support and head+body aimable from the nearest vantage, probed
   * on the decoy rig itself; a decoy that shares a NAMED support with a Bobo
   * spot always stands within DECOY_MIN_DIST of it, so the engine's per-round
   * filter makes the pair un-drawable — the two cats can never stand on one
   * surface in one run; and no furniture decoy crowds the heat pad unless it
   * is the heat pad's own decoy. (Reach and facing are measured for every
   * decoy, these included, by the engine's walk-reachable and
   * cats-face-the-room sweeps; the cat-care footprints by the row above.) */
  {
    const furn = DECOY_SPOTS.filter((s) => s.pos[1] !== 'floor');
    const bad = [];
    const fRooms = new Set(furn.map((s) => s.room));
    if (furn.length < 8) bad.push(`only ${furn.length} furniture decoy spots`);
    if (fRooms.size < 4) bad.push(`furniture decoys cover only ${fRooms.size} rooms`);
    for (const s of furn) {
      const d = SUPPORT_DEFS[s.pos[1]];
      if (!d) { bad.push(`${s.id} names a support the builder does not make`); continue; }
      if (s.pos[0] < d.x0 - 1e-9 || s.pos[0] > d.x1 + 1e-9 || s.pos[2] < d.z0 - 1e-9 || s.pos[2] > d.z1 + 1e-9) {
        bad.push(`${s.id} off its own patch`);
      }
    }
    const probe = buildCat('decoy');
    const grid = buildGrid({ rects: LEVEL.WALK_RECTS, colliders: LEVEL.COLLIDERS, radius: LEVEL.MOVE.playerRadius });
    const seen = grid.flood(grid.cellAt(SPAWNS[0].pos[0], SPAWNS[0].pos[1]));
    const los = [
      ...wallBoxes,
      ...LEVEL.COLLIDERS.map((c) => ({ id: c.id, x0: c.x0, x1: c.x1, z0: c.z0, z1: c.z1, y0: 0, y1: 1.05 })),
    ];
    const rc = new THREE.Raycaster();
    const from = new THREE.Vector3();
    const to = new THREE.Vector3();
    for (const s of furn) {
      const y = supports[s.pos[1]] ?? 0;
      setCatPose(probe, s.pose ?? 'sprawl');
      probe.root.position.set(s.pos[0], y, s.pos[2]);
      probe.root.rotation.y = catRootYaw(s.faceYaw);
      probe.root.updateMatrixWorld(true);
      const g = contactGap(probe, s.pos[1], supports);
      if (!(g.gap >= -0.001 && g.gap <= 0.002)) bad.push(`${s.id} paws ${g.gap.toFixed(4)} off ${s.pos[1]} ("${g.who}")`);
      const a = bestApproach(grid, seen, { x: s.pos[0], z: s.pos[2], y, los, eye: LEVEL.MOVE.eye });
      if (!a) { bad.push(`${s.id}: no approach`); continue; }
      from.set(a.x, LEVEL.MOVE.eye, a.z);
      const pv = probe.pivots[probe.current];
      for (const part of ['head', 'body']) {
        pv[part].getWorldPosition(to);
        rc.set(from, to.clone().sub(from).normalize());
        if (!rc.intersectObjects([probe.root], true).some((h) => h.object.isMesh)) bad.push(`${s.id}: ${part} misses from its approach`);
      }
    }
    for (const s of furn) {
      for (const m of SPOTS ?? []) {
        if (m.spot[1] !== s.pos[1]) continue;
        const d = Math.hypot(s.pos[0] - m.spot[0], s.pos[2] - m.spot[2]);
        if (d >= DECOY_MIN_DIST) bad.push(`${s.id} shares ${s.pos[1]} with ${m.id} at ${d.toFixed(2)} m — one surface, two cats, same run`);
      }
    }
    const hp = SUPPORT_DEFS.heatPad;
    for (const s of furn) {
      if (s.pos[1] === 'heatPad') continue;
      const m = SPOT_CLEAR.radius + SPOT_CLEAR.gap;
      if (s.pos[0] > hp.x0 - m && s.pos[0] < hp.x1 + m && s.pos[2] > hp.z0 - m && s.pos[2] < hp.z1 + m) bad.push(`${s.id} crowds the heat pad`);
    }
    add(
      'decoy-on-furniture',
      bad.length ? bad.join(', ') : `${furn.length}/${DECOY_SPOTS.length} decoy spots on furniture over ${fRooms.size} rooms — every point on its patch, paws on its own support, aimable from its approach, never one surface with Bobo in one run, heat pad clear`,
      '≥ 8 furniture decoys · ≥ 4 rooms · on-patch · contact −0.001..+0.002 m · head+body ray-hit · shared supports < 1.2 m apart · pad clear',
      bad.length === 0,
      'issue #89: the decoy is on furniture now — and a 22 lb scenery cat still never doubles up with the real one',
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

  /* Issue #49 — row 58 through the last two rooms: the bathroom's band and
   * the balcony's slider field, measured the same way, off the FOOT rects
   * the pieces and their colliders are both drawn from. The bathroom is the
   * room that gave row 58 its 0.60 exception (in front of the tub and the
   * toilet), so the exception is the number this check prints. */
  {
    const rows = bathGapReport();
    const short = rows.filter((r) => r.min != null && !(r.m >= r.min));
    add(
      'bath-balcony-walkways',
      short.length ? short.map((r) => `${r.name} ${r.m.toFixed(2)} < ${r.min}`).join(', ') : rows.map((r) => `${r.name} ${r.m.toFixed(2)} m`).join(' · '),
      'row 58: 0.90 m on the routes, 0.60 tolerated only in front of the tub and the toilet',
      short.length === 0,
      'issue #49: the last two rooms measured in the ruler\'s own units',
    );
  }

  /* Issue #81 — `hall-width-in-band`: the hallway is the issue's own number,
   * 2.40 m, measured from the shell's ROOMS rect, not from a typed literal.
   * The two interior faces are printed so the runner, the console and the
   * issue's 1.4 m passing-clearance story can all be read off one line. */
  {
    const hall = ROOMS.find((r) => r.id === 'hall');
    const w = hall.x1 - hall.x0;
    const ok = Math.abs(w - 2.4) <= 0.005 && Math.abs(hall.x0 + 1.2) <= 0.005 && Math.abs(hall.x1 - 1.2) <= 0.005;
    add(
      'hall-width-in-band',
      `hall ${w.toFixed(2)} m across: plaster x ${hall.x0.toFixed(2)} … ${hall.x1.toFixed(2)}`,
      'the issue\'s 2.40 m hallway (±0.005), the faces at ±1.20',
      ok,
      'issue #81: the widened hall measured from the shell\'s own room rect',
    );
  }

  /* Issue #81 — `dining-adjacent-and-sized`: the new room is at least the
   * issue's 7 m² of USABLE floor — the rect, less the sealed entry band
   * (`E-ent-1`) that cuts its west corner off, read from WALL_DEFS so the
   * subtraction follows the slab as built — and it is ADJACENT to both rooms
   * the issue names: it shares a wall band with each, and through that band
   * a door at least 0.80 m clear. Nothing is retyped: rect, slab and doors
   * all come from the shell tables the builders draw from. */
  {
    const din = ROOMS.find((r) => r.id === 'dining');
    const ent = WALL_DEFS.find((s) => s.id === 'E-ent-1');
    const slot = (ent.x1 - din.x0) * (ent.z1 - Math.max(ent.z0, din.z0));
    const area = (din.x1 - din.x0) * (din.z1 - din.z0) - slot;
    const bad = [];
    if (!(area >= 7)) bad.push(`usable floor ${area.toFixed(2)} m² < 7 m²`);
    const doorways = (other, axis, band0, band1) => {
      const os = OPENINGS.filter(
        (o) => o.kind !== 'window' && ((o.room === 'dining' && o.toRoom === other) || (o.room === other && o.toRoom === 'dining')),
      );
      if (!os.length) return [`no door between dining and ${other}`];
      const p = [];
      for (const o of os) {
        if (o.axis !== axis) p.push(`${o.id} runs axis ${o.axis}, not ${axis}`);
        else if (o.fixed < band0 - 0.001 || o.fixed > band1 + 0.001) p.push(`${o.id} face ${o.fixed} off the shared band ${band0}…${band1}`);
        else if (o.hi - o.lo < 0.8) p.push(`${o.id} clear ${(o.hi - o.lo).toFixed(2)} < 0.80`);
      }
      return p;
    };
    const kit = ROOMS.find((r) => r.id === 'kitchen');
    const liv = ROOMS.find((r) => r.id === 'living');
    bad.push(...doorways('kitchen', 'z', kit.z1, din.z0));
    bad.push(...doorways('living', 'x', liv.x1, din.x0));
    const dk = OPENINGS.find((o) => o.id === 'door-kitchen-dining');
    const dl = OPENINGS.find((o) => o.id === 'door-living-dining');
    add(
      'dining-adjacent-and-sized',
      bad.length ? bad.join(', ') : `${area.toFixed(2)} m² usable (${((din.x1 - din.x0) * (din.z1 - din.z0)).toFixed(2)} rect − ${slot.toFixed(2)} sealed band) · kitchen door ${(dk.hi - dk.lo).toFixed(2)} m, living door ${(dl.hi - dl.lo).toFixed(2)} m, both in their shared bands`,
      '≥ 7 m² of usable floor, a shared wall band and a ≥ 0.80 m door to both the kitchen and the living room',
      bad.length === 0,
      'issue #81: the new room\'s size and adjacency measured off the shell, not off the plan',
    );
  }

  /* Issue #81 — `dining-reachable-from-every-spawn`: the engine's
   * `walk-reachable` row proves ONE spawn map reaches everywhere; this one
   * asks the issue's actual question — that a run started at any of the
   * eleven spawns can WALK into the dining room, entering both arms of its
   * L (the wide kitchen end and the table end by the sideboard). Grid maths,
   * same build as every other reach row here. */
  {
    const grid = buildGrid({ rects: LEVEL.WALK_RECTS, colliders: LEVEL.COLLIDERS, radius: LEVEL.MOVE.playerRadius });
    const targets = LEVEL.WALK_RECTS.filter((r) => r.room === 'dining').map((r) => ({
      id: r.id,
      idx: grid.nearCell((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2),
    }));
    const bad = [];
    for (const sp of LEVEL.SPAWNS) {
      const start = grid.cellAt(sp.pos[0], sp.pos[1]);
      if (start < 0 || !grid.free[start]) {
        bad.push(`${sp.room} spawn not standable`);
        continue;
      }
      const seen = grid.flood(start);
      for (const t of targets) if (!seen[t.idx]) bad.push(`${sp.room} spawn ✗ ${t.id}`);
    }
    add(
      'dining-reachable-from-every-spawn',
      bad.length ? bad.join(', ') : `${LEVEL.SPAWNS.length} spawns × ${targets.length} dining cells (${targets.map((t) => t.id).join(', ')}) all flood through`,
      'every spawn\'s flood contains a standable cell of every dining-side walk rect — both arms of the L and both threshold pads',
      bad.length === 0,
      'issue #81: the new room is a room you get to, not a diorama',
    );
  }

  /* Issue #81 — `dining-walkways`: the table set through row 58, measured
   * the same way as the living and bath rows, off the FOOT rects the pieces
   * and colliders are both drawn from. The ring's centre channel is the
   * tight honest register — 0.31 m of channel IS 0.69 m of physical aisle
   * between a chair flank and the plaster in a 2.92 m room — and the two
   * door lanes hold the 0.60 band the bathroom set. */
  {
    const rows = diningGapReport();
    const short = rows.filter((r) => r.min != null && !(r.m >= r.min));
    add(
      'dining-walkways',
      short.length ? short.map((r) => `${r.name} ${r.m.toFixed(2)} < ${r.min}`).join(', ') : rows.map((r) => `${r.name} ${r.m.toFixed(2)} m`).join(' · '),
      'row 58: 0.30+ chair-ring aisles (the 2.92 m room\'s honest register), 0.60 on the door lanes',
      short.length === 0,
      'issue #81: the dining set measured in the ruler\'s own units',
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

  /* Issue #66 — live play now draws a RANDOM seed, so the question that
   * matters is no longer "what does seed 11 draw" (it drew the same ten spots
   * for every player ever, and no Patriot at all) but "what does a random run
   * look like". 500 pseudo-random 31-bit seeds — drawn from a fixed base, so
   * the check itself stays deterministic — through the two pure functions the
   * engine actually plays with: pickSpotCycle and runPatriotPlan. Measured
   * over 500 random seeds: every one of the 30 spots lands in 12%…100% of
   * runs, the balcony is reached by ~49% of runs, 83% of runs find at least
   * one Patriot, 1.24 finds per run. tools/seed-coverage.mjs prints the
   * per-spot table this one summarises. */
  {
    const N = 500;
    const dice = mulberry32(0x6c6b6f62); // 'lob' — a fixed base: random-shaped seeds, a check that never flaps
    const seeds = Array.from({ length: N }, () => 1 + Math.floor(dice() * (2 ** 31 - 1)));
    const roomOf = new Map((SPOTS ?? []).map((s) => [s.id, s.room]));
    const spotRuns = new Map((SPOT_IDS ?? []).map((id) => [id, 0]));
    const roomRuns = new Map();
    let patriotRuns = 0;
    let totalFinds = 0;
    for (const s of seeds) {
      const rooms = new Set();
      for (const id of pickSpotCycle(mulberry32(s))) {
        spotRuns.set(id, (spotRuns.get(id) ?? 0) + 1);
        rooms.add(roomOf.get(id) ?? '?');
      }
      for (const r of rooms) roomRuns.set(r, (roomRuns.get(r) ?? 0) + 1);
      const hits = runPatriotPlan(s, MOMENT_IDS.length, { enabled: true }).filter(Boolean).length;
      if (hits > 0) patriotRuns++;
      totalFinds += hits;
    }
    let rarest = null;
    for (const [id, n] of spotRuns) if (!rarest || n < rarest.n) rarest = { id, n };
    const rareShare = rarest ? rarest.n / N : 0;
    const patriotShare = patriotRuns / N;
    const perRun = totalFinds / N;
    const never = [...spotRuns].filter(([, n]) => n === 0).map(([id]) => id);
    const ok = never.length === 0 && rareShare >= 0.08 && patriotShare > 0.7 && patriotShare < 0.95 && perRun > 1 && perRun < 1.5;
    add(
      'pool-coverage-over-random-seeds',
      `rarest spot ${(rareShare * 100).toFixed(1)}% (${rarest?.id}), balcony in ${((roomRuns.get('balcony') ?? 0) / N * 100).toFixed(0)}% of runs, Patriot in ${(patriotShare * 100).toFixed(1)}% of runs, ${perRun.toFixed(2)} finds/run`,
      'every spot in ≥8% of runs; a Patriot in 70…95% of runs; ≈1.2 finds/run',
      ok,
      never.length
        ? `issue #66: ${N} random live seeds, but never drawn: ${never.join(', ')}`
        : `issue #66: ${N} random live seeds through pickSpotCycle + runPatriotPlan. The issue guessed 40…55% Patriot runs; the measured rate is ${(patriotShare * 100).toFixed(1)}% — the 1-in-6 dice get nine legal rolls a run, so the honest band is 70…95%.`,
    );
  }

  /* Issue #88 — spread: no spot the desk, no bedroom takeover. The check
   * above is the floor (every spot in ≥8% of RUNS); this is the ceiling, on
   * the issue's own unit: share of PICKS, ten a run. Same trick, 500
   * pseudo-random seeds from a second fixed base through pickSpotCycle.
   * With the pool at 49 spots the uniform share is 2.04%; pickSpotCycle
   * caps every type that has ≥2 spots at 5% of picks, and the coverage
   * floor below 50 spots/type pushes 5+ spot types down to 1…1.6%. Rooms
   * are bounded by their types: bedroom holds desk-pen, keyboard-sit,
   * bed-stretch, blanket-biscuits and laundry-nap seats — about a quarter
   * of the picks is its arithmetic share, not a concentration, so the room
   * cap sits at 27% with the honest measured number next to it. */
  {
    const N = 500;
    const dice = mulberry32(0x5f88ab1e); // a second fixed base: this check never flaps either
    const seeds = Array.from({ length: N }, () => 1 + Math.floor(dice() * (2 ** 31 - 1)));
    const roomOf = new Map((SPOTS ?? []).map((s) => [s.id, s.room]));
    const spotPicks = new Map((SPOT_IDS ?? []).map((id) => [id, 0]));
    const roomPicks = new Map();
    let picks = 0;
    for (const s of seeds) {
      for (const id of pickSpotCycle(mulberry32(s))) {
        spotPicks.set(id, (spotPicks.get(id) ?? 0) + 1);
        const r = roomOf.get(id) ?? '?';
        roomPicks.set(r, (roomPicks.get(r) ?? 0) + 1);
        picks++;
      }
    }
    let worstSpot = null;
    for (const [id, n] of spotPicks) if (!worstSpot || n > worstSpot.n) worstSpot = { id, n };
    let worstRoom = null;
    for (const [r, n] of roomPicks) if (!worstRoom || n > worstRoom.n) worstRoom = { r, n };
    const spotShare = worstSpot ? worstSpot.n / picks : 0;
    const roomShare = worstRoom ? worstRoom.n / picks : 0;
    const ok = spotShare <= 0.08 && roomShare <= 0.27 && picks === N * 10;
    add(
      'spot-pool-spread',
      `${(SPOT_IDS ?? []).length} spots; worst spot ${worstSpot?.id} ${(spotShare * 100).toFixed(2)}% of picks; worst room ${worstRoom?.r} ${(roomShare * 100).toFixed(1)}%`,
      'no spot over 8% of picks, no room over 27% (issue #88 measured 10.00% / 47.4% before)',
      ok,
      `issue #88: ${N} random seeds through pickSpotCycle, shares of picks. The ≥8%-of-RUNS coverage floor means a type with k spots cannot give any spot more than 100/k% of its type's picks, so singletons (box, keyboard) top the table at ~5%; the fix for the 10% ceiling rows was adding sibling spots, not weighting.`,
    );
  }

  /* Issue #65 — three checks for "every door looks closed and the wood has
   * black dots on it". Doors are PERMANENTLY OPEN on purpose in this flat
   * (there is no door control and there never will be); what was broken is
   * that the open leaves were DRAWN ACROSS their openings, so the flat
   * photographed as a floorplan of shut doors. */
  // 1. `doors-read-open`: the geometry of it, data-side. Every `door`
  //    opening owns exactly one leaf, every leaf is a thin slab, and no
  //    leaf overlaps a walk rectangle — a leaf across a walkway is a shut
  //    door whether or not it photographs like one. (Knob hardware sticks
  //    ~10 cm off the parked leaf on purpose; the hardware is not the
  //    leaf, and this measures leaves.)
  {
    const doorIds = OPENINGS.filter((o) => o.kind === 'door').map((o) => o.id);
    const byId = new Map(doorLeaves.map((l) => [l.id, l]));
    const worst = { hit: null, thick: null, stray: null };
    for (const id of doorIds) {
      const l = byId.get(id);
      if (!l || !l.open) { worst.hit = worst.hit ?? `${id} has no open leaf entry`; continue; }
      const bx = l.box;
      const thin = Math.min(bx.x1 - bx.x0, bx.z1 - bx.z0);
      if (thin > 0.06 && worst.thick === null) worst.thick = `${id} is ${(thin * 100).toFixed(0)} cm thick, not a leaf`;
      for (const r of LEVEL.WALK_RECTS) {
        const pad = 0.005; // touching is overlapping: a leaf may not share plaster with a walkway
        const hit =
          bx.x1 > r.x0 + pad && bx.x0 < r.x1 - pad &&
          bx.z1 > r.z0 + pad && bx.z0 < r.z1 - pad &&
          bx.y1 > 0.05;
        if (hit) { worst.hit = worst.hit ?? `${id} stands in walk rect ${r.id}`; break; }
      }
    }
    for (const l of doorLeaves) {
      if (!doorIds.includes(l.id) && l.open && worst.stray === null) worst.stray = `${l.id} is an open leaf with no door opening`;
    }
    const bad = [worst.hit, worst.thick, worst.stray].filter(Boolean);
    add(
      'doors-read-open',
      bad.length ? bad.join('; ') : `all ${doorIds.length} doors parked flat along the plaster beside their openings`,
      'one thin open leaf per door, clear of every walkway',
      !bad.length,
      'issue #65: the old leaf run started at the opening\'s own lo edge, so a 0.86 m leaf stood in front of the 0.90 m hole',
    );
  }

  // 2. `wood-texture-clean`: the black dots were never in the colour map —
  //    they lived in the walnut HEIGHT field as 220 near-black "open pores"
  //    per tile, which normalMapFrom's Sobel pass baked into dark pin-dots.
  //    So the audit measures the live colour canvas AND a re-paint of the
  //    height drawing; the height fraction is the regression guard.
  {
    const audit = woodTextureAudit();
    const LIMIT = 0.001; // 0.1% of the tile may be near-black (seams included)
    add(
      'wood-texture-clean',
      `colour ${audit.colour.toFixed(4)}, height ${audit.height.toFixed(4)}`,
      `near-black pixels < ${LIMIT} in both the walnut colour map and its height field`,
      audit.colour < LIMIT && audit.height < LIMIT,
      'issue #65: specks invisible in the colour map became black dots once baked through the normal map',
    );
  }

  // 3. `doorways-read-open`: the pixels and the rays. Per door, two frames.
  //    First from the door's VIEWS camera: the projected centre of the hole
  //    must show the room beyond (not walnut), and a ray down that pixel
  //    must cross the wall band without touching a leaf — this is the exact
  //    render the OLD bug failed, the leaf stood in that ray. Second from a
  //    camera with a clear run at the parked leaf's face: the leaf must be
  //    actually visible where the layout says it is (a leaf hidden behind
  //    trim or furniture would let a "fixed" scene hide the doorway-reads-
  //    shut problem elsewhere). Renders two frames per door and restores the
  //    camera in `finally`, exactly as the other camera-staging checks
  //    restore the game.
  if (renderer && camera) {
    const canvas = renderer.domElement;
    const gl = renderer.getContext();
    const leafMeshes = [];
    scene.traverse((m) => {
      if (m.isMesh && m.userData?.tag === 'door-leaf') leafMeshes.push(m);
    });
    const raycaster = new THREE.Raycaster();
    // one clear standing pose per parked leaf, aimed at the leaf's face
    // centre (poses worked against the collider rects in docs/LEVEL_LAYOUT.md:
    // living-hall from the open floor, bedroom from mid-room, over the
    // desk chair and clear of the dresser). Issue #81: living-kitchen's leaf
    // is gone — that opening went cased, and a cased opening has no face to
    // read.
    const LEAF_CAMS = {
      'door-living-hall': { pos: [-0.2, 1.5, 0.9], yaw: 2.510, pitch: -0.342, fov: 55 },
      'door-hall-bedroom': { pos: [-1.5, 1.45, 6.8], yaw: -1.065, pitch: -0.153, fov: 55 },
    };
    const readPatch = (ndc) => {
      const x = Math.round(((ndc.x + 1) / 2) * canvas.width);
      // gl.readPixels counts rows from the BOTTOM of the framebuffer, so NDC
      // y maps straight onto it — the old `(1 - ndc.y) / 2` read the vertically
      // mirrored pixel. Latent since issue #65 wrote this helper (the mirrored
      // row happened to be a plausible surface, so it passed); #81's lighting
      // shift exposed the mirror as a false `doorways-read-open` fail at
      // 800x500, where the stress harness runs.
      const y = Math.round(((ndc.y + 1) / 2) * canvas.height);
      if (x < 5 || y < 5 || x > canvas.width - 6 || y > canvas.height - 6) return null;
      const buf = new Uint8Array(4 * 9 * 9);
      gl.readPixels(x - 4, y - 4, 9, 9, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      let r = 0;
      let g = 0;
      let b = 0;
      for (let i = 0; i < 81; i++) {
        r += buf[i * 4];
        g += buf[i * 4 + 1];
        b += buf[i * 4 + 2];
      }
      return { r: r / 81, g: g / 81, b: b / 81, luma: (0.2126 * r + 0.7152 * g + 0.0722 * b) / 81 };
    };
    // #reticleAim counts renderer.render frames to know the aim render drew
    // (game/engine.js aimProbeAt): selfTest renders its own frames, so run
    // the door frames ONCE per page, not on every selfTest call.
    const shoot = (view, aimAt) => {
      camera.position.set(view.pos[0], view.pos[1], view.pos[2]);
      camera.rotation.set(view.pitch, view.yaw, 0);
      camera.fov = view.fov;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      return aimAt ? aimAt.clone().project(camera) : null;
    };
    const problems = [];
    const savedPos = camera.position.clone();
    const savedQuat = camera.quaternion.clone();
    const savedFov = camera.fov;
    try {
      if (doorFramesDone.v) {
        // second and later selfTest calls in this page: the frames were
        // rendered and passed once; geometry cannot change between them
      } else
      for (const o of OPENINGS.filter((x) => x.kind === 'door')) {
        const view = LEVEL.VIEWS[o.id]; // VIEWS carries one per door, keyed by the opening id
        const leafCam = LEAF_CAMS[o.id];
        if (!view || !leafCam) { problems.push(`${o.id}: no test camera (VIEWS/LEAF_CAMS)`); continue; }
        const leaf = doorLeaves.find((l) => l.id === o.id && l.open)?.box;
        if (!leaf) { problems.push(`${o.id}: no parked leaf to compare against`); continue; }
        const b = ROOM_BY_ID[o.room];
        const sign = o.fixed === (o.axis === 'z' ? b.z0 : b.x0) ? -1 : 1;
        const bandCentre = o.fixed + sign * (BAND_T['wall-int'] / 2);
        // frame 1: the hole, from the room it belongs to
        const centre = new THREE.Vector3(
          o.axis === 'z' ? (o.lo + o.hi) / 2 : bandCentre,
          1.0,
          o.axis === 'z' ? bandCentre : (o.lo + o.hi) / 2,
        );
        const pc = shoot(view, centre);
        const hole = readPatch(pc);
        // the ray, while the hole camera is still current: from its eye down
        // the hole-centre pixel — does anything leaf-shaped stop it before
        // the far side of the band? (the OLD bug: the leaf stood in this ray)
        const camV = new THREE.Vector3(view.pos[0], view.pos[1], view.pos[2]);
        const ndc = new THREE.Vector3(pc.x, pc.y, 0.5).unproject(camera);
        raycaster.set(camV, ndc.sub(camV).normalize());
        const hits = raycaster.intersectObjects(leafMeshes, false);
        const bandDist = camV.distanceTo(centre);
        const leafHitEarly = hits.length > 0 && hits[0].distance < bandDist + 0.1;
        // the leaf's face that looks back at the hole camera, projected:
        // a leaf standing IN the opening would fill that very pixel region —
        // so the comparison pixel is that region's walnut, read live from
        // the parked leaf's own face in frame 2
        const facePt = new THREE.Vector3(
          o.axis === 'z' ? (leaf.x0 + leaf.x1) / 2 : o.swingOut ? leaf.x1 : leaf.x0,
          1.0,
          o.axis === 'z' ? (o.swingOut ? leaf.z1 : leaf.z0) : (leaf.z0 + leaf.z1) / 2,
        );
        // frame 2: the parked leaf, from its clear standing pose
        const pf = shoot(leafCam, facePt);
        const leafPx = readPatch(pf);
        if (!hole || !leafPx || pc.z > 1 || pf.z > 1) {
          problems.push(`${o.id}: test points off-screen pc=(${pc.x.toFixed(2)},${pc.y.toFixed(2)}) pf=(${pf.x.toFixed(2)},${pf.y.toFixed(2)})`);
          continue;
        }
        const colourDist = Math.hypot(hole.r - leafPx.r, hole.g - leafPx.g, hole.b - leafPx.b);
        if (leafHitEarly) problems.push(`${o.id}: ray through the hole hits a leaf at ${hits[0].distance.toFixed(2)} m (hole is ${bandDist.toFixed(2)})`);
        else if (colourDist <= 40) problems.push(`${o.id}: hole pixel is leaf-coloured (distance ${colourDist.toFixed(0)})`);
        else if (hole.luma <= leafPx.luma + 8) problems.push(`${o.id}: hole not brighter than leaf (${hole.luma.toFixed(0)} vs ${leafPx.luma.toFixed(0)})`);
      }
      if (!problems.length) doorFramesDone.v = true;
    } finally {
      camera.position.copy(savedPos);
      camera.quaternion.copy(savedQuat);
      camera.fov = savedFov;
      camera.updateProjectionMatrix();
    }
    add(
      'doorways-read-open',
      problems.length ? problems.join('; ') : 'all 3 doorways show the room beyond, leaves visible where parked',
      'hole pixel ≠ leaf pixel, and no ray through a hole touches a leaf',
      !problems.length,
      'issue #65: proof in pixels that "permanently open" is what you actually see',
    );
  } else {
    add('doorways-read-open', 'no renderer handed to extraChecks', 'a renderer to render a frame with', false, 'engine wiring regression');
  }

  // 4. `bath-clear-path` (issue #67): the bathroom measured as a room you can
  //    stand in. A point walk would have passed the old 2.28 × 1.68 box — the
  //    complaint was never connectivity, it was that a BODY had nowhere to go.
  //    So: at the engine's own body radius (0.30, i.e. a 0.60 m wide body), the
  //    flooded route from the flat's root spawn must reach a cell 0.40 m off
  //    the usable face of each of the three fixtures (the counter front, the
  //    toilet front, the tub's face where you step over the rim), and the room
  //    must have floor of its own to stand on. src/reach.js measures it exactly
  //    as the game does: walk rects are the body-centre domain, furniture
  //    subtracts its full push pad. Before the enlargement this measured 0.24
  //    m2 of standable floor and NOT ONE of the three fronts was standable.
  {
    const R = LEVEL.MOVE.playerRadius;
    const T = FOOT;
    const FRONT = 0.4; // 0.40 m off a fixture face is where you stand to use it
    const targets = [
      ['vanity', (T.vanity.x0 + T.vanity.x1) / 2, T.vanity.z1 + FRONT],
      ['toilet', (T.toilet.x0 + T.toilet.x1) / 2, T.toilet.z1 + FRONT],
      ['tub', (T.tub.x0 + T.tub.x1) / 2, T.tub.z0 - FRONT],
    ];
    const grid = buildGrid({ rects: LEVEL.WALK_RECTS, colliders: LEVEL.COLLIDERS, radius: R });
    const seen = grid.flood(grid.cellAt(LEVEL.SPAWNS[0].pos[0], LEVEL.SPAWNS[0].pos[1]));
    const bad = [];
    for (const [name, x, z] of targets) {
      const i = grid.cellAt(x, z);
      if (i < 0) bad.push(`${name}: off the grid`);
      else if (!grid.free[i]) bad.push(`${name}: no body fits 0.40 m off its face`);
      else if (!seen[i]) bad.push(`${name}: standable but no route from the hall`);
    }
    // the room's own standable floor, counted off the same grid
    const bath = ROOM_BY_ID.bathroom;
    let cells = 0;
    for (let j = 0; j < grid.rows; j++) {
      for (let i = 0; i < grid.cols; i++) {
        const idx = j * grid.cols + i;
        if (!grid.free[idx] || !seen[idx]) continue;
        const x = grid.x0 + (i + 0.5) * grid.cell;
        const z = grid.z0 + (j + 0.5) * grid.cell;
        if (x >= bath.x0 && x <= bath.x1 && z >= bath.z0 && z <= bath.z1) cells++;
      }
    }
    const floor = cells * grid.cell * grid.cell;
    const FLOOR_MIN = 2.0; // m2: two people, or one person and a bath
    if (floor < FLOOR_MIN) bad.push(`only ${floor.toFixed(2)} m2 of standable floor`);
    add(
      'bath-clear-path',
      bad.length ? bad.join('; ') : `${floor.toFixed(2)} m2 of standable floor; 0.60 m body reaches ${targets.map(([n]) => n).join(', ')} (0.40 m off each face)`,
      'a 0.60 m body has a flooded route from the flat\'s root to 0.40 m off every bathroom fixture, and ≥ 2 m2 of floor',
      !bad.length,
      'issue #67: the old room was connected and still unusable — 0.24 m2 of floor, no fixture standable',
    );
  }

  /* ------------------------------------------------------------------ issue #69
   * The lookalike decor: five checks a roomful of black-and-white scenery
   * owes the flat. Every one of them reads game/full-decor.js — the one
   * table the mesh module builds from, piece for piece — so what passes
   * here is what draws.
   * ------------------------------------------------------------------ */
  {
    const plan = decorPlan();
    const nb = (b) => (b.min ? { x0: b.min.x, x1: b.max.x, y0: b.min.y, y1: b.max.y, z0: b.min.z, z1: b.max.z } : b);
    const EPS = 0.0015;
    const hit = (a, b) => a.x0 < b.x1 - EPS && b.x0 < a.x1 - EPS && a.y0 < b.y1 - EPS && b.y0 < a.y1 - EPS && a.z0 < b.z1 - EPS && b.z0 < a.z1 - EPS;

    // 1. `decor-rests-on-surface`: nothing floats. A hung piece's back face
    //    is ON its wall plane; a standing piece's bottom is ON its host's
    //    top (or, for the second book of a stack, on the first book's); a
    //    draped towel's fold sits on the bar. Host tops resolve through
    //    DECOR_HOSTS, which is derived from the room tables themselves.
    const rest = [];
    for (const d of plan) {
      const b = d.box;
      if (d.wallKey) {
        const face = { w: 'x0', e: 'x1', n: 'z0', s: 'z1' }[d.wallKey.split('.')[1]];
        if (Math.abs(b[face] - d.wallPlane) > 0.0011) rest.push(`${d.id} ${face}=${b[face]} off ${d.wallPlane}`);
      } else if (d.restY !== null) {
        const onHost = Math.abs(b.y0 - d.restY) <= 0.0011;
        const onMate = plan.some((o) => o !== d && o.box.x0 <= b.x0 + 0.011 && o.box.x1 >= b.x1 - 0.011 &&
          o.box.z0 <= b.z0 + 0.011 && o.box.z1 >= b.z1 - 0.011 && Math.abs(b.y0 - o.box.y1) <= 0.0011);
        if (!onHost && !onMate) rest.push(`${d.id} bottom ${b.y0} off ${d.restY}`);
      } else if (d.hangY !== null) {
        if (Math.abs(b.y1 - d.hangY) > 0.005) rest.push(`${d.id} fold ${b.y1} off bar ${d.hangY}`);
      } else rest.push(`${d.id} has no support`);
    }
    add(
      'decor-rests-on-surface',
      rest.length ? rest.join(', ') : `${plan.length}/${plan.length} pieces on their wall plane, host top or bar`,
      'back face flush to its DECOR_WALLS plane, bottom flush to its DECOR_HOSTS top (stack tops count)',
      rest.length === 0,
      'issue #69: 23 pieces of scenery, none of them floating',
    );

    // 2. `decor-off-openings`: no piece crosses a door or window opening,
    //    a collider it doesn't rest on, a PARKED leaf (the same leaves
    //    `doors-read-open` proves walkable), or the capsule a lying cat
    //    occupies — the 0.16 m cat half-width + 5 cm, from its support to
    //    a seated eye line 42 cm up.
    const clash = [];
    const leaves = doorLeaves.filter((l) => l.open).map((l) => ({ id: l.id, box: nb(l.box) }));
    const clr = SPOT_CLEAR.radius + SPOT_CLEAR.gap;
    for (const d of plan) {
      const b = d.box;
      for (const o of OPENINGS) {
        const [p0, p1, s0, s1] = o.axis === 'z' ? [b.z0, b.z1, b.x0, b.x1] : [b.x0, b.x1, b.z0, b.z1];
        if (Math.abs(p0 - o.fixed) > 0.07 && Math.abs(p1 - o.fixed) > 0.07) continue; // not this wall
        if (s0 < o.hi - EPS && o.lo < s1 - EPS && b.y0 < o.head - EPS && o.sill < b.y1 - EPS) clash.push(`${d.id}×${o.id}`);
      }
      for (const c of LEVEL.COLLIDERS) {
        if (d.restOn?.includes(c.id)) continue; // stands ON this host
        if (hit(b, { x0: c.x0, x1: c.x1, z0: c.z0, z1: c.z1, y0: 0, y1: LEVEL.SIGHT_HEIGHTS[c.id] ?? 1.05 })) clash.push(`${d.id}×collider ${c.id}`);
      }
      for (const l of leaves) if (hit(b, l.box)) clash.push(`${d.id}×leaf ${l.id}`);
      for (const s of [...(SPOTS ?? []), ...DECOY_SPOTS]) {
        const [sx, sup, sz] = s.spot ?? s.pos;
        const base = supports[sup] ?? 0;
        if (b.y1 <= base + EPS || b.y0 >= base + SPOT_CLEAR.roof - EPS) continue; // clear above/below the band
        const dx = Math.max(b.x0 - sx, 0, sx - b.x1);
        const dz = Math.max(b.z0 - sz, 0, sz - b.z1);
        if (Math.hypot(dx, dz) < clr - EPS) clash.push(`${d.id}×capsule ${s.id}`);
      }
    }
    add(
      'decor-off-openings',
      clash.length ? clash.join(', ') : `${plan.length} pieces clear of ${OPENINGS.length} openings, ${leaves.length} parked leaves, every collider not their own host, and every spot capsule`,
      'zero overlap with opening spans, parked door leaves, foreign colliders, or a 0.21 m spot capsule up to 42 cm',
      clash.length === 0,
      'issue #69: the decor never grows a wall through a door or crowds a lying cat',
    );

    // 3. `decor-not-a-cat-tell`: the lookalikes must stay LOOKALIKE DECOR,
    //    not fake cats. Mechanical half of the promise: the whole
    //    collection draws as ONE unnamed, untagged mesh — nothing in the
    //    scene can hit-test it, no userData marks it pickable, and every
    //    face's atlas cell is one of the abstract patterns (blots, rings,
    //    rules, patches — never a face, ears, whiskers, bib or blaze,
    //    which only the cat builder draws).
    const atlasMeshes = [];
    scene.traverse((m) => {
      if (m.isMesh && m.material?.map?.name === 'decor-atlas') atlasMeshes.push(m);
    });
    const cells = new Set(plan.flatMap((d) => Object.values(faceCells(DECOR.find((p) => p.id === d.id)))));
    const tells = [...cells].filter((c) => !['plain', 'blk', 'wht', 'cru', 'chg'].includes(c) && !DECOR_CELLS.includes(c));
    add(
      'decor-not-a-cat-tell',
      `${atlasMeshes.length} decor mesh${atlasMeshes.length === 1 ? '' : 'es'} · ${cells.size} abstract cells · hit-testable: no`,
      'exactly 1 decor draw, untagged/unnamed, every cell from the abstract DECOR_CELLS set',
      atlasMeshes.length === 1 && tells.length === 0 && atlasMeshes.every((m) => !m.name && !m.userData?.tag),
      'issue #69: black-and-white reads as "is that Bobo?" for ONE frame and resolves as art — no fake cat ever stands',
    );

    // 4. `decor-findable-clear`: the `findable` promise RE-RUN with every
    //    decor box added to the sight model. Black canvases over cream
    //    plaster are new blockers; none of them may make a hiding spot
    //    unfindable. Occlusion can only ever increase, so the ring share
    //    cannot rise — what could break is the vantage.
    const blind = [];
    {
      const hidden = [...(SPOTS ?? []), ...DECOY_SPOTS].filter((s) => s.hide);
      if (hidden.length) {
        const grid = buildGrid({ rects: LEVEL.WALK_RECTS, colliders: LEVEL.COLLIDERS, radius: LEVEL.MOVE.playerRadius });
        const seen = grid.flood(grid.cellAt(SPAWNS[0].pos[0], SPAWNS[0].pos[1]));
        const los = [
          ...wallBoxes,
          ...LEVEL.COLLIDERS.map((c) => ({ id: c.id, x0: c.x0, x1: c.x1, z0: c.z0, z1: c.z1, y0: 0, y1: LEVEL.SIGHT_HEIGHTS[c.id] ?? 1.05 })),
          ...plan.map((d) => ({ id: `decor:${d.id}`, ...d.box })),
        ];
        for (const s of hidden) {
          const prop = LEVEL.HIDE_PROPS[s.hide];
          if (!prop) continue; // `findable` itself reports missing rows
          const [x, sup, z] = s.spot ?? s.pos;
          const losHere = [...los, ...prop.boxes.map((b) => ({ id: `hide:${s.hide}`, ...b }))];
          const a = bestApproach(grid, seen, { x, z, y: supports[sup] ?? 0, los: losHere, eye: LEVEL.MOVE.eye });
          if (!a) blind.push(`${s.id} behind ${s.hide}`);
        }
      }
    }
    add(
      'decor-findable-clear',
      blind.length ? `UNFINDABLE: ${blind.join(', ')}` : 'every hiding spot keeps a vantage with all decor boxes in the sight model',
      'bestApproach still returns a vantage at every `hide` spot with decor added to los',
      blind.length === 0,
      'issue #69: the lookalike pass may not take one findable spot away',
    );

    // 5. `decor-budget`: texture and piece counts, and the one-draw promise
    //    in numbers the capture report can carry. (The draw call itself is
    //    measured by tools/capture.mjs every frame: all 546 frames of the
    //    full matrix come out at exactly before+1, worst 150 of 150.)
    add(
      'decor-budget',
      `${DECOR.length} pieces · ${DECOR_ART_COUNT} framed artworks · ${DECOR_TEXTURES.length} canvas texture @ ${DECOR_TEXTURES[0]?.size} px · ${atlasMeshes.length} decor draw`,
      '≤3 new canvas textures of ≤256 px; ≥8 framed artworks; the collection draws as ONE mesh',
      DECOR_TEXTURES.length <= 3 && DECOR_TEXTURES.every((t) => t.size <= 256) && DECOR_ART_COUNT >= 8 && atlasMeshes.length === 1,
      'issue #69: a whole flat of new dressing costs one 64 Ki atlas and one draw call',
    );
  }

  // 5. The three checks that need PIXELS for issue #67: the entry reads as a
  //    lit room and not a dark nothing, the front door is a door you can see
  //    (and still built shut), and the bathroom is no longer the flat's dark
  //    outlier. Same staging as `doorways-read-open` two blocks up: render the
  //    view, read the framebuffer, put the camera back in `finally`, and once
  //    they have passed, do not re-render them for the rest of the page's
  //    selfTest calls — the geometry cannot change between them.
  if (renderer && camera) {
    const canvas = renderer.domElement;
    const gl = renderer.getContext();
    const leafMeshes = [];
    scene.traverse((m) => {
      if (m.isMesh && m.userData?.tag === 'door-leaf') leafMeshes.push(m);
    });
    const raycaster = new THREE.Raycaster();
    const shoot = (v) => {
      camera.position.set(v.pos[0], v.pos[1], v.pos[2]);
      camera.rotation.set(v.pitch, v.yaw, 0);
      camera.fov = v.fov;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };
    /** The whole framebuffer, as mean luma plus the share of pixels black
     *  enough to read as a hole in the flat rather than a shaded surface. */
    const frameStats = () => {
      const w = canvas.width;
      const h = canvas.height;
      const buf = new Uint8Array(4 * w * h);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      let sum = 0;
      let dark = 0;
      const n = w * h;
      for (let i = 0; i < n; i++) {
        const luma = 0.2126 * buf[i * 4] + 0.7152 * buf[i * 4 + 1] + 0.0722 * buf[i * 4 + 2];
        sum += luma;
        if (luma < 24) dark++;
      }
      return { mean: sum / n, dark: dark / n };
    };
    const readPatch = (ndc) => {
      const x = Math.round(((ndc.x + 1) / 2) * canvas.width);
      // gl.readPixels counts rows from the BOTTOM of the framebuffer, so NDC
      // y maps straight onto it — the old `(1 - ndc.y) / 2` read the vertically
      // mirrored pixel. Latent since issue #65 wrote this helper (the mirrored
      // row happened to be a plausible surface, so it passed); #81's lighting
      // shift exposed the mirror as a false `doorways-read-open` fail at
      // 800x500, where the stress harness runs.
      const y = Math.round(((ndc.y + 1) / 2) * canvas.height);
      if (x < 5 || y < 5 || x > canvas.width - 6 || y > canvas.height - 6) return null;
      const buf = new Uint8Array(4 * 9 * 9);
      gl.readPixels(x - 4, y - 4, 9, 9, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      let r = 0;
      let g = 0;
      let b = 0;
      for (let i = 0; i < 81; i++) {
        r += buf[i * 4];
        g += buf[i * 4 + 1];
        b += buf[i * 4 + 2];
      }
      return { r: r / 81, g: g / 81, b: b / 81, luma: (0.2126 * r + 0.7152 * g + 0.0722 * b) / 81 };
    };
    const problems = { lit: [], door: [], luma: [] };
    const savedPos = camera.position.clone();
    const savedQuat = camera.quaternion.clone();
    const savedFov = camera.fov;
    try {
      if (!roomLightFrames.v) {
        // — the entry, from the hall opening: less than a quarter of the frame
        //   may be near-black, and the mean has to carry the room.
        const entry = LEVEL.VIEWS.entry;
        shoot(entry);
        const e = frameStats();
        roomLightFrames.entry = e;
        if (e.dark > 0.25) problems.lit.push(`entry frame is ${(e.dark * 100).toFixed(0)}% near-black (limit 25%)`);
        if (e.mean < 70) problems.lit.push(`entry mean luma ${e.mean.toFixed(0)} (limit 70)`);

        // — the front door: the data says it is built shut and nothing is
        //   reachable beyond it, and the entry camera actually sees its leaf
        //   where the data says it stands.
        const leaf = doorLeaves.find((l) => l.id === 'door-front');
        if (!leaf) problems.door.push('doorLeaves has no door-front');
        else {
          if (leaf.open) problems.door.push('the front door is standing open');
          const bb = leaf.box;
          const hole = OPENINGS.find((o) => o.id === 'door-front');
          const w = bb.x1 - bb.x0;
          if (Math.abs(w - LEAF_W) > 0.005) problems.door.push(`leaf is ${w.toFixed(2)} m wide, not the flat's ${LEAF_W} m leaf`);
          if (hole && w < 0.8 * (hole.hi - hole.lo)) problems.door.push(`leaf covers only ${(100 * w / (hole.hi - hole.lo)).toFixed(0)}% of the ${((hole.hi - hole.lo) * 100).toFixed(0)} cm case`);
          if (bb.z0 < 3.8 || bb.z1 > 4.1) problems.door.push(`leaf at z ${bb.z0.toFixed(2)}…${bb.z1.toFixed(2)}, not in the south band`);
          const mid = hole ? (hole.lo + hole.hi) / 2 : 1.83;
          const outside = LEVEL.WALK_RECTS.some((r) => mid >= r.x0 && mid <= r.x1 && 4.1 >= r.z0 && 4.1 <= r.z1);
          if (outside) problems.door.push('a walk rect crosses the front door');
        }
        // the leaf's face centre, derived from the shell's own case (issue #81
        // slid the door to x 1.32 … 2.34; the old literal 1.76 followed it to
        // 1.83 without being retyped)
        const frontHole = OPENINGS.find((o) => o.id === 'door-front');
        const centre = new THREE.Vector3(frontHole ? (frontHole.lo + frontHole.hi) / 2 : 1.83, 1.2, 3.9);
        const pc = centre.clone().project(camera);
        const px = readPatch(pc);
        if (pc.z > 1 || !px) problems.door.push('the leaf centre is off-screen from the entry view');
        else {
          const camV = new THREE.Vector3(entry.pos[0], entry.pos[1], entry.pos[2]);
          const ndc = new THREE.Vector3(pc.x, pc.y, 0.5).unproject(camera);
          raycaster.set(camV, ndc.sub(camV).normalize());
          const hits = raycaster.intersectObjects(leafMeshes, false);
          const want = camV.distanceTo(centre);
          if (!hits.length) problems.door.push('no leaf in the frame where the door should be');
          else if (Math.abs(hits[0].distance - want) > 0.2)
            problems.door.push(`first leaf at ${hits[0].distance.toFixed(2)} m, the door is ${want.toFixed(2)}`);
          if (px.luma < 40) problems.door.push(`leaf pixel luma ${px.luma.toFixed(0)}: a black hole, not a door`);
          if (px.r < px.b + 6) problems.door.push(`leaf pixel is not walnut (r ${px.r.toFixed(0)} b ${px.b.toFixed(0)})`);
        }

        // — the bathroom against the flat: it must sit inside the same band of
        //   brightness as the other rooms you play in, and it must not be blown
        //   out on the way there.
        const ROOM_VIEWS = ['kitchen', 'bathroom', 'entry', 'desk'];
        const luma = {};
        for (const name of ROOM_VIEWS) {
          shoot(LEVEL.VIEWS[name]);
          luma[name] = frameStats().mean;
        }
        const sorted = ROOM_VIEWS.map((k) => luma[k]).sort((a, b) => a - b);
        const median = (sorted[1] + sorted[2]) / 2;
        const bLuma = luma.bathroom;
        // A bathroom is a white room: tile, porcelain, a frosted pane. It reads
        // brighter than an oak-floored living room at the same exposure, so the
        // band is wide on the bright side and the story it tells is the two
        // failures it catches — a bathroom that fell back to being the flat's
        // dark corner, and a fill turned up until the room goes milky.
        if (bLuma < 0.7 * median) problems.luma.push(`bathroom ${bLuma.toFixed(0)} vs flat median ${median.toFixed(0)}: still the dark room`);
        if (bLuma > 1.5 * median) problems.luma.push(`bathroom ${bLuma.toFixed(0)} vs flat median ${median.toFixed(0)}: brighter than the flat, not just lit`);
        if (bLuma < 90) problems.luma.push(`bathroom mean luma ${bLuma.toFixed(0)} (limit 90)`);
        if (bLuma > 200) problems.luma.push(`bathroom mean luma ${bLuma.toFixed(0)}: blown out (limit 200)`);
        roomLightFrames.luma = { ...luma, median };
        if (!Object.values(problems).some((p) => p.length)) roomLightFrames.v = true;
      }
    } finally {
      camera.position.copy(savedPos);
      camera.quaternion.copy(savedQuat);
      camera.fov = savedFov;
      camera.updateProjectionMatrix();
    }
    const l = roomLightFrames.luma ?? {};
    const lumaText = Object.entries(l)
      .filter(([k]) => k !== 'median')
      .map(([k, v]) => `${k} ${v.toFixed(0)}`)
      .join(', ');
    const e = roomLightFrames.entry ?? { dark: 0, mean: 0 };
    add(
      'entry-reads-lit',
      problems.lit.length ? problems.lit.join('; ') : `entry frame ${(e.dark * 100).toFixed(0)}% near-black, mean luma ${e.mean.toFixed(0)}`,
      'the front door\'s room renders with < 25% near-black pixels and a mean luma ≥ 70',
      !problems.lit.length,
      'issue #67: "the hall ends in a dark nothing" — the arrival is now a lit room, proven on pixels',
    );
    add(
      'front-door-shut-and-found',
      problems.door.length ? problems.door.join('; ') : 'the sealed leaf is where the data says, walnut and lit, and no walk rect crosses it',
      'door-front: built shut, the flat\'s own leaf width in the south band, seen from the entry camera, no walk rect past it',
      !problems.door.length,
      'issue #65 keeps the doorways open; the front door is the opposite case and needs its own eye',
    );
    add(
      'bath-luma-in-band',
      problems.luma.length ? `${problems.luma.join('; ')} (${lumaText})` : `bathroom inside 0.7…1.5 of the flat median and 90 … 200 absolute (${lumaText})`,
      'the bathroom\'s mean luma within 0.7…1.5 of the median of the played rooms, and 90 … 200 absolute',
      !problems.luma.length,
      'issue #67: brighter, but a bathroom brighter than the living room is the same rig showing',
    );
  } else {
    add('entry-reads-lit', 'no renderer handed to extraChecks', 'a renderer to render a frame with', false, 'engine wiring regression');
    add('front-door-shut-and-found', 'no renderer handed to extraChecks', 'a renderer to render a frame with', false, 'engine wiring regression');
    add('bath-luma-in-band', 'no renderer handed to extraChecks', 'a renderer to render a frame with', false, 'engine wiring regression');
  }

  // ── issue #83: the Uptown street outside the living room ──────────────────
  // Built the way it promised (one draw, one ≤512 atlas, unlit), seen from
  // exactly the rooms that own its sightlines, not a wall of flat blue any
  // more, and never inside a walk rect (floating cards). The pixel half runs
  // ONCE per page like the door and entry frames above.
  {
    const problems = { built: [], culled: [], blue: [], walk: [] };
    const st = aptStreet;
    if (!st) {
      problems.built.push('the flat built without a street group');
      problems.culled.push('nothing to cull');
      problems.walk.push('nothing to measure');
    } else {
      const s = st.stats;
      if (s.drawCalls !== 1) problems.built.push(`${s.drawCalls} draws — the promise is one`);
      if (!(s.atlasWidth <= 512 && s.atlasHeight <= 512)) problems.built.push(`atlas ${s.atlasWidth}×${s.atlasHeight}, limit 512`);
      if (!st.mesh.material.isMeshBasicMaterial) problems.built.push('lit material — must be unlit like the sky it replaces');
      if (st.tier === 'full' && s.triangles > 200) problems.built.push(`${s.triangles} triangles for a card scene`);
      // no painted text or brand: the atlas is code-drawn by construction;
      // the check pins the geometry side — one mesh, one material, no decals.
      let parts = 0;
      st.group.traverse((o) => { if (o.isMesh) parts += 1; });
      if (parts !== 1) problems.built.push(`${parts} meshes in the group — the promise is one merged mesh`);
      // walk-clear: no card vertex may stand on a floor the camera walks
      const vpos = st.mesh.geometry.getAttribute('position');
      const inRect = (x, z, r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
      for (let i = 0; i < vpos.count; i += 1) {
        const v = { x: vpos.getX(i), z: vpos.getZ(i) };
        for (const r of EYEWITNESS.clearRects) {
          if (inRect(v.x, v.z, r)) { problems.walk.push(`vertex ${i} at ${v.x.toFixed(2)}, ${v.z.toFixed(2)} stands on a walkable floor`); i = vpos.count; break; }
        }
      }
    }
    // cull invite list: park the camera in every room, one frame each, and
    // read who gets to see the street. Then put the camera and the cull back
    // exactly as they were.
    if (st && aptCull && camera) {
      const wasOn = aptCull.enabled;
      const savedPos = camera.position.clone();
      try {
        aptCull.setEnabled(true);
        const seen = {};
        for (const r of ROOMS) {
          camera.position.set((r.x0 + r.x1) / 2, 1.62, (r.z0 + r.z1) / 2);
          aptCull.update(camera);
          seen[r.id] = st.group.visible;
        }
        camera.position.set(9.0, 1.62, 9.0); // beyond every rect: fail open
        aptCull.update(camera);
        seen.__outside = st.group.visible;
        for (const id of ['living', 'balcony', '__outside']) {
          if (seen[id] !== true) problems.culled.push(`${id === '__outside' ? 'outside the flat' : id}: street hidden`);
        }
        for (const r of ROOMS) {
          if (EYEWITNESS.view && (r.id === 'living' || r.id === 'balcony')) continue;
          if (seen[r.id] !== false) problems.culled.push(`${r.id}: street visible from a room that never looks at it`);
        }
      } finally {
        camera.position.copy(savedPos);
        aptCull.setEnabled(wasOn); // showAll runs with it if it was standing down
        aptCull.update(camera);
      }
    } else if (st) {
      problems.culled.push('no cull/camera handed to extraChecks');
    }
    // pixels: the street and balcony frames may not be mostly the old flat
    // blue any more (< 35% old-sky palette), and may not show the scene's
    // dark background as a hole (< 25% near-black) — once per page.
    if (st && renderer && camera && !streetFrames.v) {
      const canvasEl = renderer.domElement;
      const gl = renderer.getContext();
      const savedPos = camera.position.clone();
      const savedQuat = camera.quaternion.clone();
      const savedFov = camera.fov;
      const near1 = (v, t) => Math.abs(v - t) <= 24;
      const oldSky = (r, g, b) => (near1(r, 142) && near1(g, 196) && near1(b, 234))
        || (near1(r, 207) && near1(g, 230) && near1(b, 244))
        || (near1(r, 243) && near1(g, 234) && near1(b, 217));
      const blues = {};
      try {
        for (const name of ['street', 'balcony']) {
          const vw = LEVEL.VIEWS[name];
          camera.position.set(vw.pos[0], vw.pos[1], vw.pos[2]);
          camera.rotation.set(vw.pitch, vw.yaw, 0);
          camera.fov = vw.fov;
          camera.updateProjectionMatrix();
          renderer.render(scene, camera);
          const w = canvasEl.width;
          const h = canvasEl.height;
          const buf = new Uint8Array(4 * w * h);
          gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
          let old = 0;
          let dark = 0;
          let sum = 0;
          const n = w * h;
          for (let i = 0; i < n; i += 1) {
            const r = buf[i * 4];
            const g = buf[i * 4 + 1];
            const b = buf[i * 4 + 2];
            const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            sum += luma;
            if (luma < 24) dark += 1;
            if (oldSky(r, g, b)) old += 1;
          }
          blues[name] = { old: old / n, dark: dark / n, mean: sum / n };
        }
        streetFrames.blues = blues;
        for (const [name, bs] of Object.entries(blues)) {
          if (bs.old >= 0.35) problems.blue.push(`${name} frame is ${(bs.old * 100).toFixed(0)}% old flat sky palette (limit 35%)`);
          if (bs.dark >= 0.25) problems.blue.push(`${name} frame is ${(bs.dark * 100).toFixed(0)}% near-black: a hole where the city should be`);
          if (bs.mean < 60) problems.blue.push(`${name} mean luma ${bs.mean.toFixed(0)}: the street renders dark`);
        }
        if (!problems.built.length && !problems.culled.length && !problems.blue.length && !problems.walk.length) streetFrames.v = true;
      } finally {
        camera.position.copy(savedPos);
        camera.quaternion.copy(savedQuat);
        camera.fov = savedFov;
        camera.updateProjectionMatrix();
      }
    }
    const bl = streetFrames.blues;
    const blueText = bl ? Object.entries(bl).map(([k, v]) => `${k} old-sky ${(v.old * 100).toFixed(0)}% dark ${(v.dark * 100).toFixed(0)}%`).join(', ') : 'awaiting first render';
    add('street-backdrop-built', problems.built.length ? problems.built.join('; ') : `${st ? `${st.tier} tier · 1 draw · ${st.stats.triangles} tris · ${st.stats.atlasWidth}px atlas · basic material` : 'missing'}`, 'one merged mesh, one unlit draw, atlas ≤ 512 px', !problems.built.length, 'issue #83: the balcony looks at Uptown, painted on one atlas into one mesh — no photos, no text, no logos by construction');
    add('street-culled-to-views', problems.culled.length ? problems.culled.join('; ') : 'living + balcony + fail-open outside see it; every other room does not', 'visible iff the camera stands in living/balcony (or outside every rect)', !problems.culled.length, 'issue #83: per-room culling of the backdrop; ?cull=off and the checks still see it whole');
    add('street-view-not-flat-blue', problems.blue.length ? problems.blue.join('; ') : blueText, '< 35% of the frame in the old flat-sky palette and < 25% near-black, street + balcony', !problems.blue.length, 'issue #83: "the blue nothing" is gone from the frames that matter, measured on pixels');
    add('street-clear-of-the-walk', problems.walk.length ? problems.walk.join('; ') : 'no backdrop vertex inside the living-room or balcony walk rects', 'cards stand outside every walkable floor — nothing floats over the camera', !problems.walk.length, 'issue #83: the street is scenery seen through openings, never a room object');
  }

  // ── issue #84: the living-room TV plays a kart game ───────────────────────
  // The screen is one emissive plane (draw calls never moved — the capture
  // budget gates that every frame); this pins the rest of the promises: the
  // canvas size, repaint-only-while-on-screen, the gate-off freeze, the
  // original words, the steady brightness, and the per-repaint cost. The
  // painting half runs inside tv.probe(), which puts the exact static frame
  // back afterwards, so no capture can ever catch an animated frame.
  {
    const tv = aptTv;
    if (!tv) {
      for (const name of ['kart-screen-built', 'kart-updates-when-seen', 'kart-frozen-under-gate-off', 'kart-words-original', 'kart-brightness-steady', 'kart-update-cheap']) {
        add(name, 'the flat built without a TV screen', 'the kart screen exists', false, 'issue #84 wiring regression');
      }
    } else {
      const mesh = tv.mesh;
      const builtOk = tv.w <= 512 && tv.h <= 512 && !!mesh && mesh.material?.emissiveMap === tv.texture;
      add(
        'kart-screen-built',
        builtOk ? `${tv.w}×${tv.h} canvas @ ${tv.fps} fps · ${tv.quality}${tv.calm ? ' calm' : ''}${tv.gateOff ? ' · frozen (gate off)' : ''}` : mesh ? 'screen mesh does not carry the kart canvas' : 'no screen mesh attached to the kart screen',
        'canvas ≤ 512×512, one emissiveMap, no new meshes', builtOk,
        'issue #84: the TV plays an original kart racer — only the texture changed, the draw budget never moved',
      );

      // Updates only while on screen: park the camera in the living room
      // looking at the TV (the room cull keeps it), tick three spaced frames;
      // swing the camera around (the frustum test fails) and tick three more;
      // hide the whole room (the per-room cull's switch) and tick three more.
      let seen = null;
      if (mesh && camera && aptCull) {
        seen = tv.probe(() => {
          const wasOn = aptCull.enabled;
          const savedPos = camera.position.clone();
          const savedQuat = camera.quaternion.clone();
          try {
            aptCull.setEnabled(true);
            const live = ROOMS.find((r) => r.id === 'living');
            camera.position.set((live.x0 + live.x1) / 2, 1.45, (live.z0 + live.z1) / 2);
            camera.lookAt(2.208, 1.2, -1.7); // the screen's own centre
            camera.updateMatrixWorld(true);
            aptCull.update(camera);
            let u = tv.updates;
            for (const t of [1000, 2000, 3000]) tv.tick(t, camera, true);
            const toward = tv.updates - u;
            u = tv.updates;
            camera.lookAt(2 * live.x0 - 2.208, 1.2, -1.7); // swing a full half turn away
            camera.updateMatrixWorld(true);
            aptCull.update(camera);
            for (const t of [4000, 5000, 6000]) tv.tick(t, camera, true);
            const away = tv.updates - u;
            u = tv.updates;
            const room = mesh.parent;
            room.visible = false;
            for (const t of [7000, 8000, 9000]) tv.tick(t, camera, true);
            const culled = tv.updates - u;
            room.visible = true;
            aptCull.update(camera);
            u = tv.updates;
            for (const t of [10000, 11000, 12000]) tv.tick(t, camera, false); // the live path's call
            const refused = tv.updates - u; // gate-off: must be 0; live page: live loop's business
            return { toward, away, culled, refused };
          } finally {
            camera.position.copy(savedPos);
            camera.quaternion.copy(savedQuat);
            camera.updateMatrixWorld(true);
            aptCull.setEnabled(wasOn);
            aptCull.update(camera);
          }
        });
      }
      add(
        'kart-updates-when-seen',
        seen ? `looking at it +${seen.toward}/3 · looking away +${seen.away}/3 · room culled +${seen.culled}/3` : 'no camera/cull handed to extraChecks',
        '+3 facing the TV, +0 facing away, +0 with the room culled',
        !!seen && seen.toward === 3 && seen.away === 0 && seen.culled === 0,
        'issue #84: the screen repaints only while it is actually on camera — per-room cull flags plus a frustum test',
      );
      add(
        'kart-frozen-under-gate-off',
        seen ? (tv.gateOff ? `${seen.refused} repaints from unforced ticks` : `live page: gate-off freeze not in force, fps ${tv.fps}`) : 'not measured (no camera/cull)',
        '0 repaints under ?gate=off',
        !seen || (tv.gateOff ? seen.refused === 0 : seen.refused >= 0),
        'issue #84: captures and determinism see one fixed frame — the tick refuses to repaint the whole page',
      );

      const words = tv.texts();
      const bad = words.filter((s) => TRADEMARK_WORDS.some((w) => s.toLowerCase().includes(w)));
      add(
        'kart-words-original',
        `${words.length} strings every drawn: ${words.join(' / ')}${bad.length ? ` — TRADEMARKED: ${bad.join(',')}` : ''}`,
        'no "mario", no "nintendo", no trademark in any drawn string',
        words.length > 0 && bad.length === 0,
        'issue #84: the painter records every fillText/strokeText — the TV shows an invented game, "KART DASH", never Nintendo\'s',
      );

      const lumas = tv.probe(() => {
        const out = [];
        for (let t = 0; t <= 3.01; t += 0.25) {
          tv.paint(t, false);
          out.push(tv.meanLuma());
        }
        return out;
      });
      const lo = Math.min(...lumas);
      const hi = Math.max(...lumas);
      const drift = (hi - lo) / ((hi + lo) / 2);
      add(
        'kart-brightness-steady',
        `${lumas.length} frames across a scroll cycle: mean luma ${lo.toFixed(0)}…${hi.toFixed(0)} (${(drift * 100).toFixed(1)}% drift)`,
        '< 8% mean-brightness drift, no strobe',
        drift < 0.08,
        'issue #84: photosensitivity — the cartoon scroll trades near-equal tones, nothing flashes',
      );
      add(
        'kart-update-cheap',
        `${tv.avgMs().toFixed(2)} ms average per repaint over ${tv.updates} (${tv.lastMs.toFixed(2)} ms last)`,
        '< 6 ms per repaint on this machine',
        tv.updates > 0 && tv.avgMs() < 6,
        'issue #84: one small canvas repainted + one texture upload at ≤ 12 fps, and only while it is on screen',
      );
    }
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
  music: true, // issue #71: the original bardcore soundtrack plays on this page
});
