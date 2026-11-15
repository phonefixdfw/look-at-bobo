/*!
 * Look at Bobo — Step 6 slice (boot).
 * Step 8 re-homed the whole page into engine.js — the shared game engine,
 * built by copying slice.js through and wiring the level data, the
 * apartment, and the moment animations in as config. This file is now the
 * slice's five lines of difference from that engine: which apartment to
 * build, which five moments to look for, and how each of the five animates.
 *
 * Same behaviour as ever: `npm run capture:slice` still reports 42/42
 * self-tests and the same frame hashes. The full game (step 8, full.js)
 * boots the same engine against full-level.js + full-apartment.js.
 */
import * as LEVEL from './level.js'
import { buildApartment } from './apartment.js'
import { bootGame } from './engine.js'

/* ---- the slice's five moments, pose by pose ----
 * Moved verbatim out of the old applyTime (behaviour frozen): the engine
 * runs the baseline idle right before calling this, only during `find`,
 * and hands over the pivot bundle `bp`, its `base` body scale, the clip
 * time `t`, and the cats. */
function sliceMomentAnim({ bp, base, t, bobo, game, momentById }) {
  const m = game.momentId;
  if (m === 'loaf-couch') {
    const s = Math.sin(t * 0.9); // the loaf breathes
    bp.body.scale.set(base.x * (1 + 0.018 * s), base.y, base.z * (1 + 0.014 * s));
  } else if (m === 'window-bird') {
    bp.head.rotation.y = Math.sin(t * 0.55) * 0.5; // sweeping the glass
    bp.head.rotation.x = bp.baseHeadX + Math.sin(t * 2.6) * 0.04; // chattering
    bp.tailPivot.rotation.y = Math.sin(t * 5.2) * 0.1; // the tip won't stop
  } else if (m === 'cardboard-box') {
    bp.head.rotation.y = Math.sin(t * 0.9) * 0.62; // peeking out of the box
    bp.tailPivot.rotation.y = Math.sin(t * 1.3) * 0.18;
  } else if (m === 'tail-chase') {
    bobo.root.rotation.y = momentById(m).faceYaw + t * Math.PI * 2 * 0.55; // chasing it
    bp.tailPivot.rotation.y = Math.sin(t * 6.0) * 0.24; // the tail fights back
  } else if (m === 'bed-sprawl') {
    const s = Math.sin(t * 0.8);
    bp.body.scale.set(base.x * (1 + 0.022 * s), base.y, base.z * (1 + 0.016 * s));
    bp.head.rotation.y = Math.sin(t * 0.5 + 1.2) * 0.34; // half-asleep watching
  }
}

bootGame({
  bootName: 'slice',
  failPrefix: 'Step 6 slice failed to start',
  level: LEVEL,
  buildApartment,
  momentAnim: sliceMomentAnim,
  winDefault: 5,
})
