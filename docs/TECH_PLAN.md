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
| Living room + lighting rig | `src/room.js` `buildRoom()` **unchanged** — it builds the whole style-test living room (floor, window wall, west wall, couch + measured cushions, rug, box, lamp, plant, lights); the slice composes it as-is and `game/apartment.js` only **adds** the apartment around it: east + south walls with the doorway, hall, bedroom (merged plaster + floor + bed + nightstand + laundry + south window), two extra non-shadow fill points (budget: sun stays the only shadow light) |
| First-person arm/hand | `src/hand.js` (the demo's hand choreography is a pure function of (phase, t); the slice keeps its own tuned copy — see "No shared-module edits" below) |
| Yell envelope, fireworks, rain-of-Bobos, DAG burst | `src/celebrate.js` |
| Voice takes + mixer + unlock contract | `src/audio.js` `createVoiceEngine` + `VOICE_LINES` + `audioPlanFor` (yell=t1 · DAG=t2 · win=t2) — no new paid calls |
| Determinism guards | `src/determinism.js` — same guards as the demo |
| Measurement | `src/measure.js` — `scanMarkings`, `contactGap` |
| Capture | `tools/capture.mjs` + the `window.LC` contract in docs/CAPTURE.md |

**No shared-module edits.** The demo's hand choreography is a pure function of
(phase, t) in ~10 lines of `applyTime`; the slice keeps its own tuned copy
(the find phase adds a lowered rest pose) rather than refactoring the demo —
zero byte-identical risk to the demo's captures, at the cost of one small
copy. Nothing in `src/` changes except (possibly) additive `tokens.js` keys,
and the style-test byte gate stays green by construction.

New files: `src/input.js` (keyboard + pointer lock), `src/collision.js`
(AABB world, walk-rect containment, push-out), `game/level.js` (the
apartment as data), `game/apartment.js` (buildRoom + extension → meshes +
supports + lights), `game/slice.html` / `game/slice.js` (the game),
`tools/audio/slice-check.mjs`. `package.json` gains scripts only.

## Frame loop

Fixed step, exactly like the demo: the loop advances `state.time += 1/60`
per animation frame and the rendered frame is a pure function of
`(phase, moment, view, t, score, player)`. Nothing in the render path
touches `performance.now()` or `Date.now()` (the guards would throw). Input
lives in `src/input.js`: WASD state + accumulated mouse deltas, consumed
ONCE per simulation step, so a capture run with no real mouse input is
bit-identical to a re-render.

```
simulate(dt = 1/60):
  1. read input (WASD state + accumulated mouse deltas; deltas consumed once)
  2. yaw/pitch from mouse * sensitivity; pitch clamped ±1.2
  3. wish vector from WASD in yaw space; speed = walk 2.6 m/s, run 4.3 m/s (Shift)
  4. move with src/collision.js: axis-separated walk-rect containment, then
     push-out from furniture AABBs and from the cats' bodies (push radii
     0.30 + 0.16 bobo / 0.30 + 0.20 decoy), so you can crowd close but not
     stand inside a cat or a wall
  5. head-bob while moving (±0.02 m at step cadence)
  6. update the moment animation (pure fn of (momentId, t)), the hand, the
     celebration clock; the play loop advances phase time and fires audio
     cues whose `at` the step crossed (the ONLY place audio fires)
```

Phases: `find` (search; reticle + full control) → click/Space raycasts the
screen centre: hits Bobo → `catch`, hits the decoy → `wrong`, hits nothing →
nothing. `catch`/`wrong` lock control for their timeline (the demo's exact
timings: hand rise 0.15–0.55, yell @0.25, DAG DOM ease 0.7–1.2 + DAG audio
@1.8, pull-back), then return to `find`; `win` is forever (until restart).

## Moments and spots

`game/level.js` is pure data: moment definitions (spot + pose + faceYaw +
canonical decoy + room), decoy spots, spawn points, walk rects, collider
AABBs, capture views — every number mirrored from docs/LEVEL_LAYOUT.md.
All poses are existing `sit`/`loaf`/`sprawl`; the animation is procedural on
root/head/tail/body only, so `cat.js` is untouched:

| id | room | pose | procedural animation |
|---|---|---|---|
| `loaf-couch` | living | loaf (on the couch cushion) | slow breathing + tail flick |
| `window-bird` | living | sit (by the window corner) | head sweeps the glass, tail tip fast twitch |
| `cardboard-box` | living | sit, inside the style-test box prop | head peeks side to side |
| `tail-chase` | hall | loaf | spins chasing its tail, endless loop |
| `bed-sprawl` | bedroom | sprawl on the duvet | slow head turn + heavy breath |

Full-game-only moments (fridge, sink, toilet, high shelves) stay in
docs/STORY.md for step 7; the slice queue draws from the five above.

## Moment queue (fairness rules, checked by selfTest)

- A seeded PRNG (`mulberry32` on a run seed) shuffles the 5 moment ids; the
  queue pops **without repeats within a cycle**, reshuffles when exhausted
  (needed only for `?win=N>5`).
- After each catch: Bobo moves to the next queued spot, the decoy relocates
  to a decoy spot **never Bobo's and ≥ 1.2 m from it** (seeded pick over the
  valid set — docs/DECOY_CAT.md), and the player respawns at the next spawn
  whose room ≠ Bobo's new room and ≠ the previous spawn room ("respawn
  elsewhere").
- A catch consumes a moment; a wrong-cat penalty never consumes one and
  never ends the run — score floors at 0 (Q6 + issue #11).
- `?win=N` overrides the target (default 5 = slice; the full game will ship
  10); HUD shows `NN / 05` in that target.

## Capture contract (`window.LC`, docs/CAPTURE.md)

Same contract as the demo — `ready/duration/views/moments/setView/seek/play/
pause/renderNow/getStats/selfTest` plus `trigger/scoreValue/setScore/
audioPlan/audioStatus/gateUnlocked/unlock/goto` — and:
- `moments` = the 5 find moments + `catch`/`wrong`/`win`. `setMoment(id)`
  stages each id **canonically** (find moment → Bobo at his spot, decoy at
  the moment's canonical decoy spot; `catch`/`wrong`/`win` → the canonical
  `cardboard-box` tableau + the demo's exact event stage), so any view ×
  moment × time triple captures deterministically and call order cannot
  change the frame (checked by `moment-order-independent` +
  `seek-repeatable`, as in the demo);
- `state()` adds `{ phase, momentId, score, target, px, pz, yaw, pitch,
  decoyId, seed, paused, plant }`;
- `simulate(steps, script)` runs N fixed steps with scripted input (used by
  the `sim-deterministic` selfTest: same script twice → identical state
  hash) without rendering;
- `selfTest()` runs the demo's checks (exact strings, HUD states, event
  rules exercised for real, audio plans + picks, gate, budget + light
  budget, determinism guards, `scanMarkings` tells for both cats) plus
  slice checks: `queue-no-repeats`, `decoy-never-shares-spot` (≥ 1.2 m,
  every moment × several seeds), `spots-walkable`, `walk-rects-connected`
  (every moment reachable from every spawn), `walk-blocked` (scripted dash
  into walls/colliders never leaves the walkable union),
  `respawn-changes-room`, `score-floors-at-zero`, `win-fires-at-target`.
- `?plant=` faults (proof the checks bite): `text` (the joke ending gets
  "fixed"), `audio` (wrong take), `score` (score can go negative),
  `repeats` (the queue repeats within a cycle), `decoy-share` (decoy sits on
  Bobo's spot), `over-budget` (+170 meshes blows the draw budget),
  `no-collision` (you walk through walls).
- `?gate=off` skips the click-to-begin gate headlessly; `?seed=N` fixes the
  run seed.

## Audio

Only the shipped takes, only through `src/audio.js`: `yell` at +0.25 s,
`dag` at +1.8 s on WRONG, `win` at +0.35 s (docs/VOICES.md schedule,
`audioPlanFor(phase)` with `find ≡ idle/silence`). New check
`audio:slicecheck` drives real Chrome and proves all three lines actually
play through the slice's click-unlock path.

## Gates

- `npm run capture:slice` — 6 views × 8 moments, selfTest gate, clean
  console, budget ≤ 150 draws / ≤ 150k tris, ≤ 1 shadow light, ≤ 6 real
  lights, marking tells measurable.
- `npm run capture:slice:determinism` — re-render byte-identical.
- `npm run capture:slice:planted` — each planted fault makes the capture
  FAIL with the right check named.
- `npm run capture:slice:weak` — swiftshader laptop floor.
- `npm run audio:slicecheck`, `npm run playtest:bot`.
- Regressions that must stay green: `gate`, `capture:style`,
  `capture:demo`, `capture:demo:determinism`, `audio:democheck`.
  (The look itself is protected structurally: no existing file in `src/`,
  `design/` or `vendor/` changes, so earlier captures are identical by
  construction — there is no `style:gate` script.)
