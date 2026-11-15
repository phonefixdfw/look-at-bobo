# Look at Bobo — Step 6 playtest notes

Written + machine playtest record for the playable slice (`game/slice.html`,
issue #11). Everything below was **run and measured on this machine**
(Node 24.22.3, Google Chrome 157 headless via `playwright-core`, vendored
three r187, Linux). Every command is free and local — starts its own static
server, no autoplay flags, no key, no network, **$0.000 spent**.

Where a number appears here it was copied from a real run's output, not
rounded from memory. Scratch output lands in `captures/…` (gitignored).

---

## 1. Playing it by hand (what Step 7 will do with real hands)

```bash
npm install
npm run serve      # http://127.0.0.1:8123/game/slice.html
```

Click **start** (unlocks audio + pointer lock) → **WASD** walk, **Shift** run,
**mouse** look, aim at a cat and **click/Space** to shout
**"LOOK AT BOBO!"**. Bobo = catch **+1**; the chunkier decoy = **DAG!** and
**−1** (floors at 0). **Esc** pauses, click resumes. Five moments in three
rooms (living + hall + bedroom), random order with no repeats, new room every
catch, win at 5 (default; `?win=N`) = rain of Bobo heads + the exact line
`your did it! you wind`. Full HUD/pause/hint behaviour and every URL
parameter are in `docs/HANDOFF.md` §5.

## 2. Machine evidence (all green at HEAD of this PR)

| Command | What it proves | Verdict (measured) |
|---|---|---|
| `npm run capture:slice` | 144-frame matrix: 8 stages (5 find moments + catch + wrong + win) × 6 views × 3 times, `?gate=off&score=2`; **40 selfTest checks run on every frame** | `selfTest PASS (40/40)`, `budget PASS (drawCalls 97<=150 · triangles 94640<=150000 · passes 1<=3 · shadowLights 1<=2 · realLights 4<=6)`, pixels luma 49.6..96.4 · colours 81..195, **console clean**, `VERDICT: PASS` |
| `npm run capture:slice:determinism` | same page re-rendered twice, PNG-vs-PNG | `determinism 8/8 frames byte-identical on re-render`, PASS |
| `npm run capture:slice:weak` | same capture on software GL (SwiftShader) — the numbers don't lean on the GPU | PASS (40/40) |
| `npm run audio:slicecheck` | real audio in real Chrome, §4 below | **23/23**, exit 0 |
| `npm run playtest:bot` | scripted full playthrough through public APIs, §3 below | exit 0, log below |
| `npm run gate` | the Step 2 tool itself still catches planted faults | PASS |

The look is protected structurally rather than by a re-render hash:
`git diff origin/main...HEAD -- src/ design/ vendor/` shows **only two new
files** (`src/input.js`, `src/collision.js`) — every existing shared file is
zero-diff, so Steps 2–4 render identically by construction. The earlier proofs
were re-run anyway and are green: `capture:style` 72 frames 36/36 PASS
(budget 89 draws / 101,636 tris), `capture:demo` 48 frames 37/37 PASS console
clean, `capture:demo:determinism` 8/8, `capture:demo:planted` still bites,
`audio:democheck` 17/17. (There is deliberately no `style:gate` script — byte
identity is the zero-diff argument above, plus the full style capture still
passing.)

### Plants: all seven bite (each exits 1 on exactly its named check)

The faults are injected by URL only (`?plant=…`) — the source files stay
correct, so a passing suite proves the checks work, not that they were skipped.

| `?plant=` | injected fault | caught by | result |
|---|---|---|---|
| `text` | ending "fixed" to `you did it! you win` | `ending-text-exact` | exit 1 |
| `audio` | catch plan switched to yell take 2 | `audio-plan-catch` | exit 1 |
| `score` | wrong-cat penalty not floored at 0 | `score-floors-at-zero` | exit 1 |
| `repeats` | queue never advances | `queue-no-repeats` | exit 1 |
| `decoy-share` | decoy placed on Bobo's spot | `decoy-never-shares-spot` | exit 1 |
| `over-budget` | 170 extra draws pinned to the camera | tool's budget check (`drawCalls 245 > 150`) | exit 1 |
| `no-collision` | player walks through furniture | `walk-blocked` | exit 1 |

(`npm run capture:slice:planted` runs the `text` plant; the other six were run
the same way, one command each, and the whole loop is scripted in the PR log.)

## 3. Bot playtest (`npm run playtest:bot`)

A scripted run of the **real game through public APIs only** — `LC.play`,
`LC.aimAt` (which reports what the centre ray actually hits, exactly what
`aimShout()` raycasts), `LC.trigger`, `LC.state`, `LC.simulate`. Seven catches
+ one wrong cat, default win at 5, seed 11:

```text
move-hash(600 steps): -3.07486|-1.5|0.4394|0.0572|860.167
replay-hash:          -3.07486|-1.5|0.4394|0.0572|860.167
1. shout#1 at "loaf-couch" (ray cat-bobo)
2. shout#2 at "cardboard-box" (ray cat-bobo)
3. shout#3 at "bed-sprawl" (ray cat-bobo)
4. DAG! at "loaf-couch" (ray cat-decoy)
5. shout#4 at "loaf-couch" (ray cat-bobo)
6. shout#5 at "tail-chase" (ray cat-bobo)
7. shout#6 at "window-bird" (ray cat-bobo)
moment order:    loaf-couch → cardboard-box → bed-sprawl → loaf-couch → loaf-couch → tail-chase → window-bird
scores:          1, 2, 3, 2, 3, 4, 5
queue rounds:    cardboard-box → bed-sprawl → loaf-couch → tail-chase → window-bird — 5/5 distinct
final:           score 5/5, phase win, ending "your did it! you wind"
min score:       1 (never below 0)
console errors:  none
```

What the log pins down:

- **Every shout's centre ray really hit the intended cat** (`ray cat-bobo` ×6,
  `ray cat-decoy` ×1) — the bot proves the aim path, not just the rules.
- **Queue semantics, as designed:** the first round is boot-staged before any
  queue draw, and a **DAG! does not consume its round** (Q6: a shout-at-the-
  wrong-cat is not a guess), so `loaf-couch` legitimately appears twice in a
  row. The five rounds actually drawn from the queue are all distinct — the
  no-repeats rule holds per cycle.
- Score went `1, 2, 3, 2, 3, 4, 5`: +1 per catch, −1 for the DAG!, never
  below 0; win fired at the default target 5 with the **exact** ending text.
- `LC.simulate(600)` produced the same movement hash on both passes — the
  walk/collision sim is deterministic.

## 4. Audio proof (`npm run audio:slicecheck` — 23/23)

Real Chrome, **no autoplay flags**, a real trusted click on the gate. The
game's own events fired through the live loop (cues only fire there).
Summary of the 23 checks, full run log in the PR evidence:

- **Before the click** nothing may play: gate + engine locked, every line
  `req=0` — and the live loop running with a locked engine stays a no-op.
- **The click opens both**: audio unlocked + game started; the loop advances
  unpaused even when pointer lock is unavailable (headless never freezes).
- **`?win=3` honoured**: HUD reads `00 / 03`.
- **Aim**: `LC.aimAt('bobo')` / `LC.aimAt('decoy')` walk onto walkable floor
  and the centre ray reports `cat-bobo` / `cat-decoy`.
- **Catch**: yell take 1 started *and ended*, decoder duration 1.44 s =
  `docs/VOICES.md`; score 1, phase catch.
- **Wrong**: yell plays **again** (started=2 — you shout first, you thought it
  was Bobo), then DAG take 2 ended, 0.84 s = docs; score floored at 0; the
  moment survives (`cardboard-box → DAG! → cardboard-box`).
- **Win** (one more catch at win=3): win take 2 ended, 1.86 s = docs; score 3,
  phase win, ending exactly `your did it! you wind`; a wrong cat after the win
  cannot move the number.
- No engine errors on any line; console clean.

## 5. Bugs the playtesting actually found (both fixed, both proven)

1. **The yell could never play.** `yell@0.25` was lost in a float gap: the
   accumulated clock reached `0.24999999999999997`, and the next step derived
   `from = time − dt` as exactly `0.25`, so the boundary cue fell through both
   halves of the exclusive range test — every game event was silent *forever*.
   Found by the first `audio:slicecheck` run (catch cues `req=0` while DAG and
   win fired). Fix: inclusive bounds with a 1e-9 epsilon in
   `advanceCues`/`markCuesUpTo` (`firedCues` already prevents double-firing).
   Repro evidence: the 23/23 run above; a decisive probe shows the cue now
   fires at `time=0.25` on the first boundary step.
2. **Aiming "through" props.** The first bot run aimed at distances measured
   from the player's old position: a box flap at 3.4 m occluded the cat and a
   cross-room respawn line crossed a wall — "aimed" shouts landed on
   `wall/prop`. Fix: `LC.aimAt` now walks nearest-first along the line to the
   cat, then a 3×8 ring around it, accepting a vantage only when the
   **full-scene centre ray** hits the intended cat. Bot re-run: 7/7 rays hit
   `cat-*` (log above). This also makes the bot a trustworthy step-7 harness.

## 6. Written pass — critic (does it look right?)

Ground rules: verdicts from measured numbers and the selfTest, not vibes;
contact sheets archived as PR evidence (`captures/slice/_contact-sheet.png`,
144 labelled frames, failures would print in red).

- **Budget has real headroom:** worst slice frame 97 draws / 94,640 tris
  against the 150 / 150k budget (style test 89/101,636, demo 91/95,748) — the
  apartment's merged plaster/floor draws and 1-of-4 shadow-light rig are
  doing their job. 144/144 frames inside budget on software GL too.
- **The size tell needed a nudge:** the shared decoy spec measured **1.246×**
  Bobo's width — under the ≥1.25× rule (`size-tell-width` failed honestly on
  the first full run). Rather than edit shared `src/cat.js` (zero-diff rule),
  the slice lifts *its* decoy's root width by `1.32/1.3` and the check now
  measures fresh neutral builds (a mid-moment live pose contaminates the box —
  caught the same run). **Flag:** the slice decoy is ~1.5 % wider than the
  style-test decoy; if Brandon wants one canonical number, it's a one-line
  change in `src/cat.js` for Step 7.
- **Frame health:** luma 49.6..96.4 across all frames (no crushed blacks, no
  blowouts), 81–195 distinct colours (nothing degenerate), console clean on
  every run, deterministic pixels on re-render.
- Critic's remaining gripes (none block Step 7): first-person reads on reticle
  + hand, and the hand's win-phase park position is only reachable via staged
  order-independence, never seen in play; the bedroom is dimmer than the
  living room by design but sits at the low end of the luma range.

## 7. Written pass — genre director (does it *play* right?)

The genre is "cozy hide-and-seek with one verb". What matters: the loop is
legible in under a minute, and nothing punishes exploring.

- **The one-verb loop holds:** find → recognise (dash vs collar + size tell,
  all three measurable and enforced per frame) → point → hear yourself shout.
  The audio check proves the reward sound is a real *LOOK AT BOBO!* at the
  exact moment of the catch (0.25 s into the catch phase), not a beep.
- **Failure is gentle and correct:** the DAG! costs a point but **not the
  round** (Q6) — bot log shows the moment replayed after the wrong shout;
  score floors at 0; there is no timer anywhere; the loop never freezes
  (pointer lock is an enhancement, its absence never pauses the game —
  proven headlessly where lock is unavailable).
- **Movement feels like walking:** 60 Hz fixed-step sim, eye height 1.5,
  collision push-out proven by the `no-collision` plant (`walk-blocked`
  bites), movement deterministic (`LC.simulate` hash identical across runs).
- **Pacing knobs are data:** moment stage length 6 s, catch beat 2.2 s, wrong
  beat 2.6 s (long enough for yell→DAG in order), spawn cycle guarantees a
  room change every catch.
- Genre director's honest criticism for Step 7: with 5 moments / 3 rooms a
  skilled player clears the slice in ~2 minutes — right for a *slice*, but
  the 10-moment full game will need the larger loop to keep search costs
  nonzero (more rooms, more decoy spots). Also: **click-to-shout inside pointer
  lock and Space-to-shout were only exercised through the queued-action path
  headlessly; real-hands feel (Step 7) is still open**, and mic-based actual
  shouting remains out of scope (placeholder yell, per VISION).

## 8. Written pass — narrative director (does it mean what it says?)

- **The two sacred strings ship exact and are attacked by name:**
  `your did it! you wind` and `DAG!` — `ending-text-exact` /
  `dag-text-exact` on every frame, the `text` plant proves the check bites,
  and the win-phase audio + rain + frozen score all fire on the real line
  (slicecheck). Spellings are the joke; they are never "fixed" — the plant
  that "fixes" them is the canary.
- **The story beat order is honoured in sound:** you shout *first* (yell at
  0.25 s), and only then eat the DAG! (1.8 s) — the audio plan encodes the
  narrative ("you thought it was Bobo"), and the check asserts the yell plays
  twice as many times as there were attempts.
- **Five placeholder moments, zero inventions:** loaf-couch, window-bird,
  cardboard-box, tail-chase, bed-sprawl are generic cat behaviour (Q1 answer:
  "normal cat stuff"); no claims about real Bobo's habits anywhere in game,
  level data or docs. The decoy stays nameless (open item #3).
- **The celebration matches the promise:** win = rain of Bobo heads +
  fireworks + the line + the win take, and the score visibly freezes — the
  game ends *kindly*, per the no-failure tone.
- Narrative notes for Step 7: the moment label chip is a dev aid (keep it
  behind the capture gate or restyle); when real Bobo details arrive, the
  moments table in `game/level.js` is the single place they land.

## 9. Known gaps (deliberate, none block Step 7)

- 5 moments / 3 rooms / win at 5 — slice defaults (issue #11); full game
  (10 / 10) is Step 7 and the queue/respawn logic already handles any count.
- Palette-lint / colour-blind / photosensitivity probes still deferred (now to
  Step 7's polish pass, `docs/CAPTURE.md`); `?plant=stats`-style stats check
  exists via the budget column instead.
- The live loop steps at a fixed 1/60 (headless rAF caps ~30–60 fps); on real
  hardware a 144 Hz display will advance the sim faster than wall time — the
  sim is still deterministic, but Step 7 should clamp `dt` when wiring real
  frame deltas.
- Headless runs use `?gate=off` only because pointer lock needs a real
  desktop; the live gate path itself is proven by `audio:slicecheck` (trusted
  click) and is what a human uses.
