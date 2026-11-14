# TECH_PLAN — Step 6 playable vertical slice

The plan for `game/slice.html` + `game/slice.js`. Written before the code, per
build-a-game step 6. The slice is **plain static files** like everything else
(no bundler, no downloads): the Three.js scene is built in code from the art
system in `src/`, and the page is served by `tools/serve.mjs`.

## Reuse (do not reinvent)

| Need | Reuse |
|---|---|
| Cat rig / poses / markings | `src/cat.js` **unchanged** — the style-test byte gate protects it |
| Art system tokens / materials / textures | `src/tokens.js` (additive keys only), `src/materials.js`, `src/textures.js` |
| Room kit (wall/window/door/counter/rug + props) | `src/room.js` kit functions — the slice apartment **composes** them; the style-test `buildRoom()` is left alone |
| First-person cat arm/hand + point/release | `src/hand.js` (the demo driver's swing choreography moves into `src/` so the slice and demo share it — see below) |
| Yell envelope, fireworks, rain-of-Bobos, DAG burst | `src/celebrate.js` |
| Voice takes + mixer + unlock contract | `src/audio.js` `createVoiceEngine` + `VOICE_LINES` (yell=t1, DAG=t2, win=t2) — no new paid calls |
| Determinism guards | `src/determinism.js` — the slice runs the same guards as the demo |
| Measurement | `src/measure.js` — `scanMarkings`, `scanLights`, `scanMaterials` |
| Capture | `tools/capture.mjs` + the `window.LC` contract in docs/CAPTURE.md |

**One shared-module change:** the hand-swing + yell choreography lives in
`demo/talking-demo.js` today and the slice needs it verbatim. Rather than
fork it (two copies drifting), move it down into `src/point.js` (a pure
`createPointDriver()` — no globals beyond the injected `audio`). The demo and
the slice both use it. `src/hand.js` itself stays untouched (same exports,
same file), so the style test is unaffected (it never imports `hand.js`), and
the demo's visuals are byte-identical because the code is the same code.

New files: `src/input.js` (keyboard + pointer lock), `src/collision.js`
(AABB world, walk-rect containment, push-out), `src/point.js` (shared
point/yell choreography), `game/level.js` (the apartment as data),
`game/apartment.js` (kit → meshes + colliders + light registry),
`game/slice.html` / `game/slice.js` (the game), `tools/audio/slice-check.mjs`.
`package.json` gains scripts only.

## Frame loop

Fixed step like the demo, but input-aware:

```
simulate(dt = 1/60):
  1. read input (WASD state + accumulated mouse deltas; deltas are consumed
     once per step so captures never see input drift)
  2. yaw/pitch from mouse * sensitivity, pitch clamped ±0.92
  3. wish vector from WASD in yaw space; speed = walk 2.6 m/s, run 4.3 m/s
     (Shift)
  4. move with collision: axis-separated test against AABB colliders, then
     clamp inside the walk-rect list, then cat-vs-cat push-out (radius
     sum ~0.42 m) against Bobo and the decoy
  5. head-bob: view bob while moving (±0.02 m at step cadence) + idle sway
  6. update cat animations (Bobo moment clip w/ loop phase, decoy idle),
     the hand driver (swing/check/hold phases — from src/point.js), the
     celebrate clock, and the audio-clock-driven audio slots
```

**Time source:** `performance.now()` as the demo does, wrapped so the render
path never calls it while guards are armed (same pattern as the demo's
`demoFrame()`). Mouse deltas accumulate in the input layer, never inside
render.

## Moments and spots

`game/level.js` is pure data: named anchor points (`living.couch`,
`living.window`, `living.box`, `hall.spot`, `bed.bed` …) with position + yaw,
moment definitions, and the collider/walk-rect tables. Bobo's spot is an
anchor; the moment plays at the anchor with the cat posed facing a `faceYaw`.

Slice moments (all use existing poses + procedural root/head/tail animation;
no new poses, so `cat.js` is untouched):

| id | room | pose | procedural animation |
|---|---|---|---|
| `loaf-couch` | living | loaf | slow breathing + tail flick |
| `window-bird` | living | sit | head tracking an弧线 arc, tail tip twitch |
| `cardboard-box` | living | sit (in box prop) | box lid sway, head pokes side to side |
| `tail-chase` | hall | loaf body + fast root spin | spins chasing tail, stops dizzy |
| `bed-stretch` | bed | stretch (`stretchPhase` ramp) | stretches, paw-bats the laundry pile |

Full-game-only moments (fridge, sink, toilet, bathroom windowsill, knocking
things off shelves) stay in docs/STORY.md for step 7; the data table marks
them `slice: false` so the slice queue filters them — the table is already
the full-game shape.

## Moment queue (fairness)

- Seeded `mulberry32(0xB0B0 + runSeed)` shuffles the 5 moment ids at run
  start; queue pops without repeats; reshuffles when exhausted.
- After each catch, Bobo walks-fades to a spot in a **different room** than
  the current one (deterministic: next room from a seeded room cycle
  living → hall/bed → …), decoy relocates to a decoy spot ≥ 1.2 m from
  Bobo's new spot and in a different room from him when possible (Q6/Q2 of
  docs/DECOY_CAT.md).
- A catch consumes a moment; the penalty never consumes one (Q6).
- `?win=N` overrides the target (default 5 = slice; 10 = full-game number).

## Capture contract (`window.LC`)

Same contract as the demo (docs/CAPTURE.md) plus `start()`, and with the
player position/yaw/pitch added to `state()`:
- `setMoment(id)` parks the scene at `moment.checkFrame` (swing at
  `swingFrame`, catch/wrong resolved) so any view is capturable — the frame
  pairing is deterministic regardless of call order;
- `setState()` restores `{t, moment, score, target, yaw, px, pz, caught}`;
- `selfTest()` runs everything the demo's does (budget, materials, determinism
  under forced renders, `scanMarkings` on Bobo AND the decoy — decoy must
  have no dash/bib and a collar, lights ≤ 6 with ≤ 1 shadow) plus slice
  checks: each moment anchor inside the walk area, colliders non-empty,
  decoy-never-shares-spot, queue has no repeats within a run, penalty floors
  at 0, win fires exactly at target.
- `?plant=` faults (for capture-tool teeth): `no-collision` (walk through
  walls), `repeats` (queue can repeat), `score-goes-negative`,
  `markings-swap` (strip Bobo's bib, give the decoy one), `over-budget`.
- `?determinism=` drives a fixed 1000-frame scripted-input run (a walk-and-
  look pattern) and reports the final state hash; the capture tool compares
  two processes — same script, same seed → identical.

## Audio

Only shipped takes: `yell` at swing+0.25 s, `dag` at checkFrame+1.8 s on
WRONG, `win` at win-frame (docs/VOICES.md schedule). New check
`audio:slicecheck` drives real Chrome and proves all three lines play
through the slice's unlock path.

## Gates

- `npm run capture:slice` — views + all selfTests pass, clean console,
  budget ≤ 150 draws / ≤ 150k tris, ≤ 1 shadow light, ≤ 6 real lights,
  marking tells measurable.
- `npm run capture:slice:determinism` — two processes, identical hash.
- `npm run capture:slice:planted` — each planted fault FAILS with the right
  check named.
- `npm run audio:slicecheck`.
- Regressions that must stay green: `npm run style:gate`, `npm run gate`,
  `npm run capture:style`, `npm run capture:demo`, `npm run capture:demo:determinism`,
  `npm run audio:democheck`.
