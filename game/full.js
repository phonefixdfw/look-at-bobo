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
import { buildFullApartment } from './full-apartment.js';
import { bootGame } from './engine.js';

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
    const s = Math.sin(t * 0.9); // the loaf breathes
    bp.body.scale.set(base.x * (1 + 0.018 * s), base.y, base.z * (1 + 0.014 * s));
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
    // deep sleep in the laundry basket: slow whole-body breathing
    const s = Math.sin(t * 0.62);
    bp.body.scale.set(base.x * (1 + 0.024 * s), base.y, base.z * (1 + 0.018 * s));
    bp.head.rotation.x = bp.baseHeadX + 0.1 + Math.sin(t * 0.62) * 0.02; // head down, asleep
  } else if (m === 'bed-stretch') {
    // the long stretch along the bed: spine extends, head leads, tail straight
    const s = Math.sin(t * 0.55);
    bp.body.scale.set(base.x * (1 - 0.02 * s), base.y, base.z * (1 + 0.06 * s));
    bp.head.rotation.x = bp.baseHeadX + 0.16 - s * 0.1; // reaching forward
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
    bobo.root.rotation.y = momentById(m).faceYaw + Math.sin(t * 2.2) * 0.7;
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
function fullExtraChecks({ add, supports, buildCat, setCatPose, contactGap, MOMENTS, DECOY_SPOTS, SPAWNS }) {
  add('moments-count', MOMENTS.length, '10', MOMENTS.length === 10, "docs/STORY.md's generic ten");

  // Every moment must be findable AND shoutable: measured paw contact on its
  // own support, probed the same way the live bobo-contact check works.
  const probe = buildCat('bobo');
  const bad = [];
  for (const m of MOMENTS) {
    setCatPose(probe, m.pose);
    probe.root.position.set(m.spot[0], supports[m.spot[1]] ?? 0, m.spot[2]);
    probe.root.rotation.y = m.faceYaw;
    const g = contactGap(probe, m.spot[1], supports);
    if (!(g.gap >= -0.001 && g.gap <= 0.002)) bad.push(`${m.id} ${g.gap.toFixed(4)}`);
  }
  add('every-moment-contact', bad.length ? bad.join(', ') : '10/10 seated', 'gap -0.001..+0.002 m', bad.length === 0, 'paws touch their own support at every spot');

  // the whole flat is in play: every room is visitable as a moment, a decoy
  // spot, or a spawn — and any room Bobo can be found in can hold a decoy
  const need = ['living', 'hall', 'bedroom', 'bathroom'];
  const have = new Set([...MOMENTS.map((m) => m.room), ...DECOY_SPOTS.map((d) => d.room), ...SPAWNS.map((s) => s.room)]);
  const missing = need.filter((r) => !have.has(r));
  add('rooms-covered', missing.length ? missing.join(', ') : 'all 4 rooms', 'living+hall+bedroom+bathroom', !missing.length, 'nothing in the flat is dead scenery');
  const momentRooms = [...new Set(MOMENTS.map((m) => m.room))];
  const bare = momentRooms.filter((r) => !DECOY_SPOTS.some((d) => d.room === r));
  add('decoy-in-searchable-rooms', bare.length ? bare.join(', ') : 'all', 'a decoy spot per findable room', !bare.length, '"is that…?" is possible everywhere Bobo can be');
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
