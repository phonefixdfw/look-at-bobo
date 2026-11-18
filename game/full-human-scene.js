/*!
 * Look at Bobo — issue #86: the owner sits on the couch with Bobo on his lap.
 * This file is the SCENE DATA: where the man sits, what his lap is as a
 * support, and the seeded rule that decides whether a run shows him. No THREE,
 * no DOM — the same numbers read in the page, in a node check and in the
 * capture tools, exactly like game/full-roomba-route.js does for #85.
 *
 *   * The man is the OWNER, drawn at his own request and to his own
 *     description (docs/CHARACTERS.md, issue #86): 6'3" / ~200 lb, backwards
 *     cap, stubble and a subtle mustache, plain tee and shorts, controller in
 *     both hands, eyes on the TV. Warm and respectful by brief; no logos, no
 *     text anywhere on him.
 *   * He sits the NORTH cushion of the sofa; the SOUTH cushion is the heat
 *     pad's (issue #82) and this seat choice may not overlap it.
 *   * `lap` is a named support like `couch` and `heatPad`: a patch of lap
 *     surface at 0.615 m over the floor, real for the thigh stack it is
 *     built from (pelvis 0.61, thigh tops 0.618).
 *   * The run rule: ONE dice per run off its own stream (mirrors
 *     ROOMBA/PATRIOT) — about 1 run in 5 plans the scene, it NEVER takes the
 *     first find, and seed 11 (every baseline) plans NO scene:
 *     `mulberry32(hash('lap-scene 11'))() = 0.821` — far over the 1/5.
 */

/** The seat: centre of the sofa's north cushion. The cushion patch is
 *  x [-3.02, -2.38] × z [-0.93, -0.10] (game/full-living.js CUSHION_Z and the
 *  back cushion's face); the seat centre sits back against the cushion at x
 *  -2.60 so his back leans 4 cm into the soft back cushion, the way a person
 *  actually sits watching a race. */
export const SEAT = { x: -2.6, z: -0.515 };

/** Which way he faces: the TV. The panel's centre is (2.19, -1.70) —
 *  FOOT.stand's z midpoint at LIV.tvCentreY — read from the seat. The cat
 *  couch spot's measured faceYaw (-0.73) is the SAME "eyes toward the
 *  telly-and-the-room" line, kept for Bobo so `cats-face-the-room` measures
 *  the facing it already signed off for this seat. */
export const SEAT_YAW = -1.34;

/** Bobo's own facing on the lap: toward the TV, swung a little into the
 *  room so his face reads from the approaches (the couch spot's number, and
 *  `cats-face-the-room` re-measures it for the lap spot exactly as for every
 *  other — this yaw is what passed it). */
export const LAP_FACE_YAW = -0.73;

/** Rotate a seat-local (x, z) offset into world x/z at the seat yaw. The
 *  man is BUILT facing local -z (same convention as the cats: forward at
 *  yaw 0 is -z), local +x is his left… right — the player's view from the
 *  room side — and the root carries SEAT_YAW. */
export function seatToWorld(x, z) {
  const c = Math.cos(SEAT_YAW);
  const s = Math.sin(SEAT_YAW);
  return { x: SEAT.x + x * c + z * s, z: SEAT.z + -x * s + z * c };
}

/** The lap: Bobo's spot record lives in game/full-level.js so the pool owns
 *  every spot; the numbers live HERE, derived from the build, so the spot
 *  cannot drift off the mesh. Bobo's centre sits mid-thigh, shy of the
 *  controller so his paws, bib and dash read clear of it. */
const lapCentre = seatToWorld(0, -0.13);
export const LAP = {
  spotId: 'couch-loaf.lap', // a couch-loaf spot: the scene REPLACES the couch
  momentType: 'couch-loaf',
  replaceRooms: ['living'], // the balcony's chair keeps its own loaf
  x: Number(lapCentre.x.toFixed(3)),
  z: Number(lapCentre.z.toFixed(3)),
  top: 0.615, // pelvis 0.61 / thigh-cylinder tops 0.618 — the padded surface
  faceYaw: LAP_FACE_YAW,
};

/** The run rule (data side; engine.js rolls it, full.js re-derives it):
 *  one dice per run, ~1 run in 5, and never the first find. */
export const LAP_RULE = {
  chance: 1 / 5, // planned share of runs ≈ 20 %
  seedTag: 'lap-scene', // stream tag, mirrors PATRIOT.seedTag / ROOMBA.seedTag
  firstFind: 2, // the scene never takes the first find of a run
  seed11roll: 0.8210, // measured — seed 11 plans NO scene, baselines stand
};

/** `?lap=N` — the scene runs from find N; N below firstFind is the URL
 *  deliberately overriding the rule (same contract as `?patriot=N`). */
export function lapParamFind(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const s = String(raw);
  if (!/^\d+$/.test(s)) return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) && n >= 1 && n <= 99 ? n : null;
}

/** The real-world bands for the seated pose (issue #86: "seated pose
 *  proportions in a real-world band"). Standing 1.91 m; a seated 1.91 m man
 *  tops out at 0.68…0.73 × his standing height with hair and a cap. */
export const HUMAN_BANDS = {
  seatedTop: [1.27, 1.43], // measured: 1.35 with the cap
  seatedVsStanding: [0.665, 0.735], // seatedTop / 1.91
  shoulders: [0.42, 0.58], // deltoids + relaxed elbows at the controller
  kneeTop: [0.5, 0.64], // the issue's "knees about 0.55"
  reachDepth: [0.55, 0.78], // seat point → toe, horizontal
  standingHeight: 1.91, // declared — the build's ratios answer to this
};

/** The furniture the mesh may not stand inside (FOOT rects,
 *  game/full-living.js). `sofa` carries a lean allowance — his back presses
 *  4 cm into the back cushion and his seat sinks cushion-soft; everything
 *  else must measure a clean zero overlap, and the heat pad gets its own row
 *  because the whole point is that he shares the couch WITHOUT crowding it. */
export const HUMAN_CLEAR = {
  sofa: 0.08, // lean/sink into the soft cushions, measured part-by-part
  'coffee-table': 0,
  'heat-pad': 0,
  'side-table': 0,
  'floor-lamp': 0,
};
