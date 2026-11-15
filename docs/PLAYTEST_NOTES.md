# Look at Bobo — Step 6 playtest notes

Written + machine playtest record for the playable slice (`game/slice.html`,
issue #11). Everything below was **run and measured on this machine**
(Node 24.22.3, Google Chrome 157 headless via `playwright-core`, vendored
three r187, Linux). Every command is free and local — starts its own static
server, no autoplay flags, no key, no network, **$0.000 spent**.

Where a number appears here it was copied from a real run's output, not
rounded from memory. Scratch output lands in `captures/…` (gitignored).

---

## 1. Playing it by hand (still outstanding — what human hands will add; Step 7 was machines only)

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
| `npm run capture:slice` | 144-frame matrix: 8 stages (5 find moments + catch + wrong + win) × 6 views × 3 times, `?gate=off&score=2`; **42 selfTest checks run on every frame** | `selfTest PASS (42/42)`, `budget PASS (drawCalls 97<=150 · triangles 94640<=150000 · passes 1<=3 · shadowLights 1<=2 · realLights 4<=6)`, pixels luma 49.6..96.4 · colours 81..195, **console clean**, `VERDICT: PASS` |
| `npm run capture:slice:determinism` | same page re-rendered twice, PNG-vs-PNG | `determinism 8/8 frames byte-identical on re-render`, PASS |
| `npm run capture:slice:weak` | same capture on software GL (SwiftShader) — the numbers don't lean on the GPU | PASS (42/42) |
| `npm run audio:slicecheck` | real audio in real Chrome, §4 below | **23/23**, exit 0 |
| `npm run playtest:bot` | scripted full playthrough through public APIs, §3 below | exit 0, log below |
| `npm run playtest:stress` | 11 hostile-condition scenarios on the real page, §10 below | **11/11 PASS**, exit 0 |
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

- **The one-verb loop holds:** find → recognise (Bobo's dash + bib against a cat with
  no white above his feet at all, plus the size tell — all measurable and enforced per frame) → point → hear yourself shout.
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

---

## 10. Step 7 — automated playtest + fixes (this branch, PR open — closes #13)

No human hands yet (§1 stands — that's Brandon's ask, HANDOFF item 15). Instead: a bot stress suite that
attacks the slice the way a hostile player and a hostile browser would, plus written critic / genre-director /
narrative-director re-passes over what it found. `npm run playtest:stress` — 11 scenarios, **11/11 PASS**, ~50 s,
headless Chrome, every scenario starts from a fresh page.

### The scenarios and what each proves (measured at HEAD of this PR)
1. **Full win, 3 seeds, per-round audit** — every round: score ticks exactly +1, Bobo's moment rotates with no
   repeats, decoy always lands in a legal room, ≥0.3 m clear of geometry, ≥1.2 m from Bobo, and reachable (the
   bot shouts it from ≤8 m). 3/3 seeds win at 5.
2. **Decoy floor** — decoy shouts through *real* keyboard+mouse input (no API score edits): score walks 3 → 0
   and never goes negative.
3. **Space-mash through the win** — hammering Space at 20 Hz across the win wrap: the win voice fires **once**
   (0 → 1 across the 6 s wrap, never 2), the exact `your did it! you wind` holds, and the win screen can't be
   restarted until the 0.6 s cooldown passes.
4. **Pause → resume** — real `pointerlockchange` semantics: lock loss pauses the sim, clicking the card
   resumes it, no dt jump after the resume (1 s pause → one 0.0167 s step).
5. **Blur mid-run** — window blur while W is held: the key is released internally, the sim pauses, nothing
   drifts, and the resume keeps going clean.
6. **Mid-run reload** — reload at score 4, replay to the win: no stale state, hash-shaped sim behaves.
7. **The 500 ms block** — a synchronous 0.5 s jam of the main thread: the loop clamps (dt capped 0.25 s, 16
   catch-up steps max) and the block’s catch-up frame advanced game time by at most a clamped frame — measured
   +0.033 s on the first frame after the block — no spiral, no teleport, no explosion.
8. **Rate-independence** — driving the sim loop at 10/30/60/120/240 Hz cadences: all reach the identical
   5-point win; a 10 ms cadence tracks wall time exactly to four decimals (+1.0000 s per 1 s); a simulated 0.8 s
   spike clamps to the cap (+0.250 s, clamped=1).
9. **Camera follows the player** — after a *trusted* gate click, WASD turns and mouse-look turns: the camera
   stays within 0.05 m of the player at eye height 1.62. (This is the scenario that caught the critical bug below.)
10. **Live selfTest from first person** — after a trusted gate click, `LC.selfTest()` runs from the real
    live view: **42/42**, and the view it ran from is `player-camera`.
11. **Live tells** — the moment chip is absent live (`getClientRects().length === 0`), `?label=on` restores it,
    the reticle carries the coral decoy-soften class while aimed at the decoy, and the mustard `nudge` pulse
    appears on a shout at nothing and clears after 0.6 s.

### Bugs it found (all fixed, each regression-tested by the scenario above)
1. **CRITICAL — the camera never followed the player in live play.** `startGame()` set `game.view`
   (the `LC.view` contract value) but never `viewName` (what the render loop actually reads), so a human who clicked
   start and walked saw a frozen lobby camera. Bots cannot see this class of bug: `LC.aimAt` teleports the camera
   and applies it directly, which is what every existing proof used. Fixed by routing view changes through
   `applyView` and making it accept the live `player-camera` view; scenario 9 now proves follow, and scenario 10
   runs the whole 42-check selfTest *from* the live view so a future break fails everywhere at once.
2. **Frame-time fragility.** The loop asked for a fixed 1/60 step and (by design, for capture) never read real
   clock deltas — so under a real browser it stepped a constant number of times per frame regardless of how long
   frames took: background-tab throttling silently slowed game time and any frame spike was unclamped. Fixed: the
   loop now consumes rAF timestamps as dt, clamps dt to 0.25 s and catch-up to 16 steps, and `LC.play()` resets
   the clock. Capture is untouched (it never enters live view; the sim is still pure). Proven by 7 + 8.
3. **Spawns could sit inside furniture — and did.** The cycle-4 lamp spawn (−2.0, −1.8) was inside the sofa
   footprint (caught while writing the suite, before a human ever would); respawn could also drop Bobo or the
   decoy on top of the other cat's spot. Fixed: the offending spawn moved to (−1.5, −1.8), `pickSpawn` grew an
   avoid list (≥1.2 m from the other cat / previous spot; room rules still outrank distance, and the fallbacks
   relax distance *before* room rules), and every spawn gets a `standClearOfCats` push-out backstop through the
   real collision resolver. Two new selfTest checks (`respawn-clear-of-cats` — all moment × decoy × prev-room
   × cycle combinations through the real picker; `spawn-clearance` — every spawn ≥0.3 m from every collider)
   take selfTest to **42**; 42/42 on every frame of the 144-frame capture, live *and* headless.
4. **The win line replayed and Space-mashing skipped the win screen.** The wrap-to-win frame reset the cue book,
   so the win voice retriggered; and each mash step advanced the win clock, so mashing could dismiss
   `your did it! you wind` in well under its read time. Fixed: cue reset only at run start; win timing is its own
   monotonic clock (`LC.state.winElapsed`); 0.6 s restart cooldown. (Spellings untouched: `your did it! you wind`,
   `DAG!`.)
5. **Blur / pointer-lock left ghosts.** Held keys survived blur (bobo walked into a wall forever), losing the
   lock pushed one giant look-delta pop, and a *failed* re-lock left the game paused behind a card that no longer
   responded to clicks. Fixed in `src/input.js` (blur on window+document, `pointerlockerror` -> `onLockError`,
   deltas zeroed on lock loss) and in the pause card (click resumes; re-grabs the lock when the browser demands
   a gesture; on failure the card stays up honestly).

### UI tells Step 7 added (critic-driven, see passes below)
- The moment-name chip spoils the find, so it's hidden live; capture and `?gate=off` keep it (every existing
  frame-level proof still sees it). `?label=on` restores it live.
- Reticle: coral soften while aimed at the decoy during find (the "is that…?" beat, no text needed), and a
  0.6 s mustard pulse when a shout hits nothing — the game now always answers a shout, even a wasted one.

### Critic pass — do the fixes look right? (re-run over the changed surfaces)
Budget is untouched (97 draws / 94,640 tris worst frame — the new checks are sim-side, nothing renders per
frame that didn't before). The reticle tells reuse the two ART_STYLE signal colours exactly as specced (coral =
wrong/danger, mustard = signal), at dot size they read as feel, not UI panels; no new type, no new chrome. The
hidden chip keeps the only text in live play to score + shouts, which matches the Step 6 look verdict. Palette
lint stays deferred (item: Step 8+) — the changes stay inside tokens already in it.

### Genre-director pass — does the loop hold up under abuse?
The core 20-second loop survives everything the suite can throw, and the two tells close the two dead-air states
this genre actually punishes: the hesitation before shouting at a cat that might be the decoy (now has a soft
answer) and the shout into nothing (now acknowledged). The 0.6 s restart cooldown is inside the "read the win,
then go" window — a genre-native beat — without feeling like input lag. Rate-independence matters for the
real market: laptop tab-switching can no longer desync game time from wall time.

### Narrative-director pass — does it still say the thing?
The win moment is the whole point ("your did it! you wind" is the joke and the payoff), and Step 7 protected it
twice: it now plays once, and it can't be mashed past. Hiding the moment chip puts the *finding* back in a find
game — the story beat is you noticing bobo, not reading a nameplate. The decoy keeps his role clean: the coral
tell softens confusion without ever telling you the answer — you can still shout at him and learn, which is the
story the score already tells. No invented lore was added or removed.

### First-time-player pass (headless dry-run — what hands will still need to confirm)
Walking the onboarding as a machine: title says start → one click → locked camera, bobo's call answers every
5.5 s, the hand points, and (now) the camera follows — the whole find loop is navigable without ever reading a
label. Riskiest remaining confusion points, for real hands: (a) learning click *and* Space both shout (learned in
~1 shout), (b) knowing the other cat is *not* bobo (the coral soften + −1 sound teaches it; the write-up in §6
still recommends not resolving it with text), (c) Esc-to-pause then click-to-resume (now robust to the browser's
lock dance). None of these can be settled honestly by a bot — they need item 15.

### Known gaps Step 7 left open (deliberate)
- Human hands (§1 / item 15) — the suite proves mechanics, not feel.
- Frozen snapshot `snapshots/m1-slice` — waiting on sign-off (item 18).
- Palette-lint / colour-blind / photosensitivity probes; audio ducking while paused; a wider weak-GL matrix.

## 11. Step 8 — the rest of the game (branch `codeden/build-a-game-step-8-the-rest-78bb`, PR closes #15)

**What shipped.** The slice's engine was extracted into `game/engine.js` as
`bootGame(cfg)` (zero-diff `src/` kept); `game/slice.html` became a thin boot
on top of it, byte-identical in behaviour. The full game is `game/full.html`
+ `game/full-level.js` + `game/full-apartment.js`: the whole flat (living
room, hall, kitchenette, bathroom, bedroom with desk), **all ten moments**
(generic list — Brandon swaps the real ones in the data files), win at 10
with the head-rain and the exact `your did it! you wind`, title →
3-second tip → hunt → pause → win → play-again flow, hint fade after
3 points, decoy relocating ≥1.2 m per catch, wrong cat = DAG! and −1
floor-0'd. Brandon's step-8 feedback round is in the same PR: a TV +
stand on the living-room north wall, a bookshelf, a coffee table, a
finished kitchenette (fridge, kettle, table for two + chair, fruit bowl,
mug), a hall console with hooks, a bedside lamp, bedroom curtains, a bath
shelf with a succulent, the big plant rebuilt as a real plant (pot/rim/
soil, 9 sword leaves + 6 broad DoubleSide blades, seeded), and five
procedural canvas textures (walnut, marble, bath tile, fabric weave, TV
glass) — all built in code, **$0.000, zero new paid calls, no downloads**.

**Machine playtests (headless Chrome, all exit 0):**
- `npm run playtest:bot:full` — **wins at 10/10**: 11 bobo shouts (one
  per queued moment + one answering the opening call), exactly one DAG!
  (deliberate wrong-cat mid-run), score never below 0, final phase `win`
  with the exact ending string, zero console errors. Queue proof: the
  10-moment round came out **10/10 distinct** (seeded cycle, no repeats,
  re-shuffled against the previous order).
- `npm run playtest:stress:full` — **63 PASS / 0 FAIL** across the same
  eleven scenario families as the slice (dt spikes/clamps, blur &
  pointer-lock loss, mash-spam, pause races, reticle rules), run against
  the full page with `?win=10?`, plus no-console-errors across every
  scenario.
- Slice side re-run unchanged as a regression: `playtest:bot` wins at 5,
  `playtest:stress` 63/0.

**Capture proof:**
- `capture:full` — 351 frames (10 moments × 3 t × 9 views + 27 event
  frames), **selfTest 46/46 every frame**, budget **PASS at 126 draws /
  98,576 triangles / 5 lights / 1 shadow light / 1 pass**, pixels in the
  luma 53.6–155.3 / 71–218-colour envelope, GPU-counted draw calls match
  the page's claim, console clean. (The furniture round first landed at
  exactly 150 draws — at the cap — so every prop was merged into two
  shared-material meshes; the block now costs 13 draws.)
- `capture:full:determinism` — **PASS** (identical frames across boots;
  the new textures are hash1-seeded canvas draws, so they're deterministic
  like the rest).
- `capture:full:planted` — **FAIL as required** (the exact-text plant is
  still caught; the gate works on the full page too).
- Slice capture re-run: 42/42, 97 draws, PASS; slice determinism PASS;
  `audio:fullcheck` and `audio:slicecheck` **23/23** each (three real
  voice lines fire from the live loop on both pages).

**Furniture clearance pass (new, in docs/LEVEL_LAYOUT.md).** Six new
colliders were placed by a probe asserting every spawn, capture camera,
moment spot and decoy pot stays ≥0.30 m clear of them; three kitchen-table
pairs are hand-ray exemptions (0.20–0.30 m) whose frames were inspected
frame-by-frame in the capture. Contact sheet reviewed panel-by-panel for
occlusions (TV reads beside the window, fridge/kettle/table for two
beside the sink run, plant clear of the curtain seam, pen on the desk).

**Honest caveats.** The ten moment ids/props are invented-generic per the
brief — real Bobo details stay TBD and live in the data files, never in
`src/`. Machine playtests still aren't hands (item 15 stands). Bot runs
seeded (`?seed=`); a human's order will differ and that's the point.

## 12. Step 9 — polish (branch `codeden/build-a-game-step-9-polish-ee41`, issue #19, PRs #20 + #21)

Step 9 lands as small fully-green chunks on `main`. Nothing was bought
(`audio:dry` still 0 credits, no new voice generation); no downloads, no
bundler — every texture, material and animation stays code. Plain static
files throughout. `your did it! you wind` and `DAG!` remain byte-exact and
are still asserted by `ending-text-exact` + the planted-fault run.

**Part 1 (PR #20, merged `9a67648`): realism + living cats.** The
`src/polish.js` look kit — procedural canvas materials, all white-based
colour maps because the material `color` multiplies `map`, with the
hard-won rule recorded inline: under this rig (soft fills + one raking sun,
no envmap) strong tangent relief boils or eats 60–90% of the diffuse, so
plaster/fabric/rug carry detail in colour only, wood keeps just plank
seams, tiles keep a ~0.2 normal. Plus `worldUV()` triplanar bake, a glowing
TV (emissive + halo + spill, no flicker, still 5 lights / 1 shadow),
lived-in clutter, big leafy plants, 20 contact-shadow pools. Cats:
`faceLife()` idle life (whole-body breathing with fuzz shells riding it,
tail drift, head roll, out-of-sync blinks + double-blinks, alternating ear
flicks, lazy decoy tail sway) and the `furMap` coat multiplied over the
vertex-colour markings, so what identifies Bobo vs the decoy is untouched.

**Part 2 (PR #21): juice + comfort settings.**

- Juice (`src/juice.js`): win confetti (140 seeded bits, ONE `Points`
  draw), a score-pill punch on each catch (at rest by t=0.5 s), one soft
  coral screen-breath as `DAG!` lands (`#wrong-flash`, max 16%), and a
  0.26 s `toneMappingExposure` blink between rounds (`dip(0)=0`). Every
  piece is a pure function of phase-relative `t` — seekable, capture-safe,
  order-independent, no wall clock, no unseeded random; nothing strobes
  (each curve is a single soft pulse).
- Comfort: `?sens` / `?invertY=1` live look controls; `?motion=off` calm
  mode; `?contrast=high` (one `body.hc` class — solid panels, white text,
  heavier edges; colour is never the only signal); `?volume` / `?mute=1`
  on the voice engine. All URL-param backed, so a choice persists and
  shares; the gear panel in `game/full.html` writes those params and
  swallows game keys while open. `LC.comfort()` exposes state. selfTest
  gained `comfort-settings-wired` (full **47**, slice **43**, demo **38**);
  stress expectations bumped to match.

**Part 3 (this branch): loading + performance + OS reduce-motion.**

- Loading screen from the first byte, retired the moment `LC.ready` is
  genuinely set (no fake progress bars); it also clears itself on a boot
  failure so the error card is what you see. Full-page only — the demo and
  slice stay pixel-identical.
- `prefers-reduced-motion` (OS level) is now the **default** for calm mode;
  `?motion=full` overrides it back, `?motion=off` forces calm, and the panel
  writes `motion=full` explicitly when a player un-checks calm against an OS
  preference.
- `?quality=low` weak-GPU path: no shadow pass, no fuzz shells (they roughly
  double the cats' triangles), no confetti. Materials, lights-as-intent and
  layout are untouched, so the look never changes — only the cost.
- Verified the voice files are **already lazy**: `createVoiceEngine` builds
  each `<audio>` only on unlock/fire, so nothing downloads before the gate
  click. Documented rather than changed.

**Written pass — critic.** What the probes found and did: the normal-map
experiments (plaster, fabric, rug, strong wood) all failed the pixel probe
— diffuse eaten or boiling — and were rolled back to colour-only; the
surviving arcs/tiles normal is barely there on purpose. The empty-box
`bobo`/`bobo-face` frames during `couch-loaf` are Step 8 baseline behaviour
(the fixed views frame the box; the cat reads in the other views), verified
against the #18 captures, not a Step 9 regression. Comfort defaults are
byte-identical to the captured game (no suite URL carries a comfort param),
so every pre-existing proof still means what it meant. High contrast styles
HUD surfaces only; the scene's own luma envelope is untouched.

**Written pass — genre director.** Juice is punctuation, not noise: the pop
only on hits, the coral breath only on mistakes, confetti only at the win;
the `DAG!` beat gained weight without turning scary. Calm mode is additive
— the game never removes the joy, only the weather (confetti/rain/
fireworks/flash/blink rest; the cats keep breathing, because that is the
"alive", not the "jarring").

**Written pass — narrative director.** No string moved. No real Bobo or
apartment facts were invented — moments/spots/props stay generic and
data-driven (`game/full-level.js`, `game/full-apartment.js`, `game/full.js`
rig writes keyed by id), which remains the swap surface for Brandon's real
details. Calm mode adds no copy, so it cannot spoil; the hint/prompt text is
unchanged.

**Capture + suite proof (PR #21's chain, `c655222`, all green).**
`capture:full` 351 frames, selfTest **47/47**, budget **145 draws ≤150 ·
100,670 tris ≤150k · 5 lights ≤6 · 1 shadow · 1 pass**, console clean;
`capture:full:determinism` PASS, `capture:full:weak` PASS; the three
`*:planted` runs FAIL as required; slice 43/43 (+det, +weak), demo 37/37
(+det), style 36/36; `gate` PASS; audio page/demo/slice/full **24/17/23/23**;
bots 5/5 and 10/10 (win string exact, one DAG, console clean); stress
**63/0** on both slice and full; `npm run build` → **dist/ 33 files, 2.39
MB**. Comfort/quality browser probes: **47/47** on defaults, on OS
`prefers-reduced-motion` (calm honoured), on the `motion=full` override, on
`motion=off`, on `quality=low`, and on all settings at once; the panel
opens, reflects state and reloads on change; the loading overlay is visible
pre-boot and gone at `ready`.

**Honest caveats.** Nobody has hand-played the game yet (item 15 stands) —
the comfort panel and calm mode are wired and machine-probed but untested by
human hands. Machine ears and pixels only, as ever.

## 13. Step 9 follow-up — the loading screen broke capture determinism (issue #23)

Step 9 part 3 (PR #22) put a loading screen on `game/full.html`: static from
the first byte, `opacity` fading out over 0.35 s once the flat was built, and
removed from the DOM 450 ms later. On that commit `capture:full:determinism`
began failing on `main`: **frame #01 (`box-sit` / `first-person` / `t=1.20`)
"not deterministic", 7/8 frames byte-identical, selfTest 47/47, console clean,
reproduced 3/3 runs** — every other full-page suite still green, and the slice
and demo (which have no overlay) never moved.

**Root cause, measured.** A capture is a screenshot of the *whole page*, not of
the canvas, and the tool starts capturing the moment `LC.ready` is true. The
overlay is `position: fixed; inset: 0; z-index: 70` on an opaque background, so
it was still painted over the flat when frame #01 was taken, and the fade kept
advancing between the two screenshots the determinism check takes. Probed on
`e965bb1` doing exactly what the tool does (goto → wait `ready` → `pause()` →
`setMoment`+`seek`+`setView`+`renderNow` → screenshot, twice):

| | overlay at `ready` | frame #01, first shot | frame #01, second shot | identical |
|---|---|---|---|---|
| `e965bb1` (before) | **present**, mid-fade (sampled 0.969 / 1.0 on two runs) | `f4490a4f94cf` 337,865 B | `75bd1e1ff099` 494,598 B | **no** |
| this branch (after) | **gone from the DOM** | `75bd1e1ff099` 494,598 B | `75bd1e1ff099` 494,598 B | **yes** |

Same moment, same view, same time, two different pictures — the first is a
crossfade of "Getting your flat ready…" and the flat, so it is never the same
twice. The byte sizes tell the same story (338 KB of dark card vs 495 KB of
game; a second probe run caught the overlay at opacity 1.0 and the first shot
at 287 KB, `e81a2f8f784e` — same verdict). Only frame #01 could ever fail,
because the fade finishes inside the first round trip. Note the clean-frame
hash is **the same on both trees**: `75bd1e1ff099` — the game's own pixels never
changed, so the fix cannot have moved the look.

**What a player could see (checked, nothing to fix).** No flash and no visual
glitch: with no URL params (the title gate up), sampled through the fade before
and after the fix, page mean luma runs 24.0 → 27.3 → 35.4 — the same 0.35 s
crossfade from the loading card to the title card, sampled at a slightly
different point of it. `.gone` sets `pointer-events: none`, so "click to start"
already took clicks through the fading card. The defect was the **contract**:
`LC.ready` said "capture me" while a loading card was still on the screen the
tool was photographing.

**The fix (`d8c3511`) — one mechanism, no new checks, no tool change.** In
`game/engine.js` the overlay is retired on its own `transitionend` (`opacity`,
`target === node`), the existing 450 ms timer stays as the backstop (a hidden
tab runs no transitions and `ready` must never hang on a paint that will not
come), and `window.LC.ready` is announced in the same task the node is removed.
Nothing is left in the DOM to paint, so the capture/LC contract no longer
depends on loading-screen timing. Chosen over a capture-mode special case
(`?gate=off` never shows the overlay) because the contract would still have lied
for the next tool that screenshots before it clicks — and over removing the fade,
which would change what a player sees. `game/full.html` keeps its CSS and copy
(the comment that claimed the overlay "never appears in a captured frame" now
states how that is actually guaranteed), and `docs/CAPTURE.md` documents `ready`
as "the scene is built AND nothing is painted over the canvas", with the lesson
in its notes.

**Proof (this tree, Node 24.22, headless Chrome, `$0.000`, nothing deployed).**
- `capture:full:determinism` **three consecutive runs: 3/3 PASS, 8/8 frames
  byte-identical each time**, 47/47 selfTest, budget 145 draws / 100,670 tris.
- The **22-suite chain, all as expected (unexpected = 0)**, the three planted
  runs failing by design:
  `capture:full` 351 frames 47/47 · `gate` PASS · `build` dist/ 33 files 2.40 MB
  · `capture:style` 72 frames 36/36 · `capture:demo` 48 frames 37/37 ·
  `capture:demo:determinism` 8/8 · `capture:demo:planted` **FAIL as required**
  (36/37) · `audio:pagecheck` 24/24 · `audio:democheck` 17/17 ·
  `capture:slice` 144 frames 43/43 · `capture:slice:determinism` 8/8 ·
  `capture:slice:planted` **FAIL** (42/43) · `capture:slice:weak` 43/43 ·
  `audio:slicecheck` 23/23 · `playtest:bot` win at 5/5, replay-hash unchanged
  `-3.07486|-1.5|0.4394|0.0572|860.167` · `capture:full:determinism` 8/8 ·
  `capture:full:planted` **FAIL** (46/47, `ending-text-exact`) ·
  `capture:full:weak` 47/47 · `audio:fullcheck` 23/23 · `playtest:bot:full` win
  at 10/10, queue 10/10 distinct, one DAG, exact `your did it! you wind` ·
  `playtest:stress` **63 PASS / 0 FAIL** · `playtest:stress:full`
  **63 PASS / 0 FAIL**. Consoles clean; selfTest counts unchanged (47/43/37/36).
- Player-path probe (params-free boot, sampled through the fade): loading card
  opaque pre-`ready`, mid-fade at 0.73, gone at `ready`; luma 24.0 → 27.3 → 35.4.

**Caveats.** Nobody has hand-played the game yet (item 15 stands); the fade
still hands over to an already-interactive title card, which is 0.35 s of
crossfade, not a bug. Machine ears and pixels only, as ever.

## 14. Issue #25 — phone support (headless mobile emulation, `npm run check:mobile`)

The VISION's "Phones, touch controls" not-goal retired: `game/full.html` now plays on a
phone. Nobody held a phone for this — `tools/mobile-check.mjs` drives real Chrome at phone
viewports (844×390 @3x and @2x, 390×844, iPhone UA, `hasTouch`), and every touch lands as a
**CDP-dispatched trusted touch event** so the page's own pointer/touch handlers run — the
game cannot tell this from a phone, and neither can the checks. **36/36 PASS.**

- **Desktop stays desktop (the capture contract):** control page boots with touch off,
  ratio 1, quality full, all touch DOM `display:none`; `capture:full:determinism` re-run at
  this HEAD is 8/8 byte-identical. `?touch=on` reproduces the phone layout at a desk.
- **Detection and posture:** phone page has `.touch` classes, `touchDebug().autoLow`,
  quality `low` + ratio cap 1.5 (backing store measured 1266×585 at @3x), shadows off;
  `?quality=high` flips to full + ratio 2 + shadows; `?touch=off` on the phone gives
  keyboard controls at ratio 1 while keeping the phone quality default.
- **The controls themselves (all through real handlers):** the gate tap starts the game with
  **no pointer lock** (`pointerLockElement === null`); the stick holds forward+run and walks
  the player 2.04 m in 0.7 s, releasing clears every virtual key; a right-side drag turns
  yaw then pitch (Δyaw 0.436 — sensitivity honoured through `?sens`); a stick finger and a
  look finger are live **at the same time** (walk + turn measured together); a tap of the
  shout button scores a real centre-ray find; the page never scrolls or zooms
  (`touch-action: none`, `overscroll-behavior: none`, viewport meta with
  `maximum-scale=1, user-scalable=no, viewport-fit=cover`).
- **Life on a phone:** starting upright waits behind the rotate hint and turns landscape →
  resumes by itself; hiding the tab pauses behind the card and a tap resumes without any
  lock; the shout button is ≥100 px and fully inside the safe-area-inset landscape layout.
- **The full run, mobile path only:** seed 11 at @2x, gate tapped, **won at 10/10** driven
  solely by shout-button taps (plus one deliberate DAG! at 2 points — score dipped 2→1),
  exact `your did it! you wind`, the play-again line reads for thumbs, and the restart tap
  respects the 0.6 s cooldown (tap early → still win; tap after → find at 0). Console clean
  on every phone page.

**Machine-only caveats (a phone pass with Brandon's hands is the real sign-off):** iOS
Safari's missing Fullscreen/orientation-lock APIs, real thumb feel, and SwiftShader-vs-real-GPU
framerate are not verifiable headlessly; see `docs/DEPLOY.md` "Testing on a phone". Mic
shouting stays out of scope.

## 15. Issue #29 — the phone that stayed on the desktop path (headless forensics, `npm run check:mobile` scenarios 8–11)

Brandon opened the deployed game on an Android Chrome phone in landscape and got
the **desktop** game: the room rendered, the score read 00/10, there was no stick
and no shout button, and Chrome showed its pointer-lock notice. #26 was live on
the server (its `/src/touch.js` returns 200 and the served `engine.js` calls
`isTouchDevice()`), so the detection itself had to be reading false — and once the
page has grabbed the pointer, **nothing in the UI lets a finger take it back**.

### Cause found (three, and the measurements that separate them)

Headless Chrome with a signal probe (`requestPointerLock` wrapped and counted, one
row per device shape) — every realistic phone answers "touch" and never asks for
the pointer:

| Emulated device | mtp / ontouchstart / `(pointer:coarse)` / `(hover:none)` / UA-CH mobile | boot | after the gate tap |
|---|---|---|---|
| Android phone, normal UA | 1 / true / true / true / true | touch | **0 lock calls**, shout button shown |
| Android "Desktop site" (desktop UA, touch hardware) | 1 / true / true / true / false | touch | **0 lock calls** |
| iPad-style UA | 1 / true / true / true / true | touch | **0 lock calls** |
| Phone with **every JS signal blind** (0 / false / false / false) | all false | **mouse** | **1 lock call, pointer locked, no button** |
| Phone with `?touch=off` in the URL | all true | **mouse** | **1 lock call, pointer locked, no button** |

1. **`?touch=off` was sticky.** On a phone it grants pointer lock and the touch UI
   never appears — and there is no control to undo it, only the address bar. It is
   also self-perpetuating: the comfort panel saves settings by rewriting
   `location.search` from the parameters it was handed (`engine.js`'s `apply()`), so
   once the parameter is in the URL it survives every tap and every link shared
   from that page.
2. **A device can be blind in JavaScript and still have fingers.** In a
   `hasTouch: false` browser context — what a "Desktop site" tab, a locked-down
   webview or a stale cached module looks like to the page — every signal reads
   false (`maxTouchPoints 0`, no `ontouchstart`, neither media query matches), yet
   `Input.dispatchTouchEvent` still delivers a **trusted** `pointerdown` with
   `pointerType: 'touch'` plus a `touchstart`. Detection is a guess; an arriving
   finger is a fact. #26 had no path from the second back to the first.
   (Rejected: `(any-pointer: coarse)`, which would flip a non-touch kiosk with a
   touchscreen attached into touch. A touchscreen laptop already reports touch via
   `maxTouchPoints`, which #26 shipped and this keeps.)
3. **A stale per-module cache explains the report even when detection is right.**
   A browser caches each file under **its own URL**: `?touch=on&v=2` on the page
   address changes one entry out of ~30, so `game/engine.js` can still be last
   week's. Low detail is no evidence either way — `?quality=low` in a URL and
   #26's auto-low both make the desktop look cheap too.

### The fix

- **A finger outranks detection (live switch).** `TOUCH` is a `let`, and unless the
   URL chose the mode, a capture-phase `pointerdown`/`touchstart` watcher on the
   window hands the controls to touch the moment a real finger lands — *before* the
   gate's own click handler, so a mis-detected phone never gets as far as requesting
   pointer lock. One-way: a mouse appearing on a hybrid machine must not take the
   controls off someone's hands. `?touch=off` still wins at boot (QA on a real
   phone), and then nothing watches at all. `initTouchUI()` now ends with
   `applyOrientation()` so it is safe to call late.
- **Two hidden pause paths had to learn about it.** Dropping the pointer after the
   switch paused the game from *two* directions: the engine's `onLockChange`, and
   `src/input.js` pushing a `'pause'` action into its queue on unlock/blur, which
   `stepGame` consumes. Both guards now carry `&& !TOUCH`; a phone keeps its real
   pauses (portrait rotate, hidden tab). Found by wrapping `addEventListener` on
   every target and printing which listeners ran: only `pointerlockchange` showed
   up, so the pause came from the action queue.
- **Detection hardened, positive-only.** `isTouchDevice()` gains `(hover: none)` and
   `navigator.userAgentData.mobile` beside `maxTouchPoints` / `ontouchstart` /
   `(pointer: coarse)`. Every signal can only switch touch **on**, so a plain
   desktop — and every captured frame — is untouched.
- **Every URL versioned, and a visible stamp.** `npm run build` stamps every
   relative URL in `dist/` with `?v=<commit>-<UTC time>` (imports, the entry script
   tag, the `three` importmap target, the vendor bundle's own import, the audio
   literals, the root redirect), then re-crawls `dist/` and **fails** if any shipped
   URL is left un-stamped. The start card and the gear panel show
   `build … · mode touch|mouse · quality …`, written first by a 6-line **inline**
   script (so a stale module cannot hide it) and then by the engine with the stamp
   on its *own* module URL — a half-updated page reads
   `html X / js Y · MISMATCH: html and js are different builds`. `?stamp=on` puts it
   in the tab title and the top of the screen; `LC.buildStamp()` / `LC.buildInfo()`
   expose it; `docs/DEPLOY.md` has the `Cache-Control: no-cache` snippet. Under
   `?gate=off` the stamp is hidden **and** empty, so no capture baseline moved.

### What #29 added to the checks (scenarios 8–11, all through real handlers)

- **8 the rescue:** a touch-blind desktop context boots the mouse path, the gate
  click grabs the pointer (`locked: true`), **one** CDP finger switches the page to
  touch — stick built, shout button shown, pointer dropped, **no pause**, the lock
  count never moves again, the mode line flips to `mode touch` — the stick then walks
  and the shout button scores a real find. Mouse moves and a click afterwards change
  nothing (`touch` stays true, 0 further lock requests).
- **9** `?touch=off` on a phone: a finger on the gate and a finger on the screen keep
  the mouse path, and the card says `mode mouse (?touch=off)`.
- **10 the stamp:** card + gear panel agree with `LC.buildInfo()`; no debug chrome
  without `?stamp=on`; with it, the corner text and the `[html dev] [js dev]` title;
  `?gate=off&stamp=on` leaves both divs empty, no corner, no title change,
  `body.capture` set. When a `dist/` exists it is served too: the stamp must equal
  `dist/build.json`, the card must show a real id, and **every fetched module URL
  must carry that `?v=`** (24 modules, 0 un-versioned).
- **11 the detector,** in-page against `src/touch.js` with fake windows: phone →
  touch; `(hover:none)` alone → touch; UA-CH mobile alone → touch; touchscreen laptop
  → touch; desktop → mouse; a phone blind in every signal → mouse, *and scenario 8 is
  what saves that one*.

**Also fixed here (harness, not game): three of #26's checks were timing traps.**
`stick + look simultaneously`, `look: drag turns the camera` and `shout restarts only
after the cooldown` measured motion or a rule over fixed **wall-clock** windows, and a
phone page under SwiftShader renders at single-digit frame rates — so the window can
contain one or two sim steps, which turns a camera (one step applies the whole
accumulated drag) but walks 0.02–0.18 m instead of ~2 m. **All three fail identically
at `e952358`, before any #29 code** (`/tmp/opencode/base-mobile.log`: 2 failed, 34
passed, on the same machine), so they were failing for the machine, not the game. They
now wait on the simulation — `simSteps(page, n)` waits for n `stepGame` calls — and the
early play-again tap is fired by an in-page watcher (`shoutAtWin`) on the frame the win
lands, reporting `winElapsed` at that instant: from the harness a win is only observable
a poll late, so no harness-side tap can be *provably* inside a 0.6 s cooldown.
Thresholds unchanged; the multi-touch walk also respawns to the spot the single-finger
walk proved clear, so it measures two live fingers rather than which way the previous
test happened to face.

## 16. Issue #27 — playtest round 1 (Brandon's hands on the deployed game)

Brandon hand-playtested `main` on desktop and found three classes of bug: the
bedroom headboard floating 0.69 m off the wall, a bathroom you could walk into
and never walk out of — while being able to see through walls "some" — and
cats facing away from him (plus no lying-on-side/back poses). Part 1 of the fix
(this section) covers the layout/walls; the cats part ships in the follow-up PR
that closes the issue — both parts are recorded here.

### Bug 1 — the floating headboard (cause + fix)
The full flat's bed, headboard, nightstand and lamp were authored at z≈5.0–5.15
while the bedroom's hall-side wall inner face is z=4.26: a 0.69 m gap you could
walk behind, which read as furniture floating. All of it moved flush (small
realism gap only): bed frame/bedding/duvet/pillow to z centres 5.11/5.11/5.37/
4.59, headboard to 4.31, nightstand+lamp to 4.48; the bed rug moved from the
dead gap behind the headboard to the side you step out onto (0.19, 5.4); the
bedroom plant moved to the SE corner (it used to stand in the headboard's new
footprint); `bedLight` now sits over the bed's centre; colliders followed
(`bed` z∈[4.26,5.96], `nightstand` z∈[4.26,4.7]); and the two bed-top moments
followed the mattress (`bed-stretch` 5.9→5.21, `blanket-biscuits` 6.3→5.61) so
Bobo never sits on the floor behind a moved bed.

### Bug 2 — the bathroom trap (cause + fix)
The bathroom door was never closed — the toilet was the locked door. Step 8
placed the toilet beside the bathroom's only doorway (`toilet` x∈[−1.86,−1.49],
door3 x∈[−1.48,−1.30]), and collision pushes every collider out by the player
radius (0.30 m) *on all sides*, so the toilet's push pad covered door3's whole
width: a 0.30 m body could enter the bathroom (its centre could pass — barely,
through the vanity gap) but no cell in the room connected back out. The old
connectivity proof (`walk-rects-connected`) walks rect-corner-to-rect-corner as
a *point* and subtracts nothing, so it said PASS while the room was a trap —
that is the root cause, not the geometry alone: the check could not represent
the bug.
- **Fix:** toilet moved to the far (west) end of the same wall (x∈[−3.14,−2.77]
  in collider terms), leaving a ~0.9 m clear strip door→bowl. Vanity untouched.
- **Root-cause fix:** new `src/reach.js` builds a 0.10 m grid of *body-sized*
  standable cells (walk-rect union minus every collider's push pad) and floods
  it. The new selfTest check `walk-reachable` runs the flood from every spawn
  and demands: every room, every other spawn, and a cell 0.9–3.4 m away with a
  clear eye-high line to **every cat spot** (`bestApproach`, used again by the
  cats PR). Point walks can no longer prove reachability anywhere in this repo.
- The same check then caught a *second* trap of the same class: the bedroom
  respawn (−0.2,6.75) had no standable cell centre (laundry basket pad); moved
  to (−1.35,6.6).

### Bug 3 — seeing through walls (cause + fix)
Plaster is opaque and single-sided; the only way to look through it from inside
is to get the camera within `camera.near` (0.05 m) of a face: the near plane
cuts that face away and, because slabs are 0.12 m thick, both faces fall inside
the near plane — a hole straight into the next room. Furniture can't do that
(every piece is a collider, kept 0.30 m out by the push pad). Walls are NOT
colliders — the walk rects ARE the wall limits — and they sat **0.02 m** off
the plaster faces. Every wall you could hug was a peep-hole. (Brandon saw the
bathroom variant: hugging the hall-side wall, the bathroom/bedroom beyond was
visible.)
- **Fix:** every walk rect edge (slice + full, doorway rects only off their
  jambs) now sits ≥0.08 m off the plaster: 0.05 near + 0.02 margin + 0.01
  grid. Normal-looking views are unchanged (the player simply stops 6 cm
  earlier); the look-from-normal-positions requirement is unchanged.
- **Check:** `wall-camera-clearance` sweeps every rect box against every slab
  face using `wallFaceFailures` (src/reach.js) and fails on any gap < near+2 cm
  or any rect that reaches INTO plaster. The slabs come from the builders
  themselves (`wallBoxes` is now returned by `buildRoom`/`buildApartment`/
  `buildFullApartment`, derived from the very defs that got merged), so the
  check measures the walls you can actually see — a wall can't be "fixed" in
  one place only. A geometric check (radius/pad vs near plane) was chosen over
  per-frame pixel sampling because it covers every allowed camera position, not
  three of them.

### Bug 4 (part 2) — cats facing away (cause + fix)
The angle convention above is *correct* and shared with cameras, but a cat rig
faces local **+z**, and the engine wrote `rotation.y = faceYaw` raw — a bare 180°
conversion error, so every spot authored against this doc rendered backwards:
"every cat seems to be facing away from me". One conversion, `catRootYaw(a) =
a + π`, is now used by every cat-root writer (Bobo, decoy, respawn cats, probes).
Then the new selfTest check `cats-face-the-room` *measures*: it turns a real
probe rig to each declared yaw, reads head−tail in world space, and demands the
face sit within 90° of `bestApproach`'s nearest standable cell (the reachability
grid from part 1) with a clear eye-high sight line. Measurement, not opinion,
picked the new numbers: three spots genuinely failed (window-bird 124°, d-bath
172° — it stared at the tub wall, d-bed 159° — into the corner) and three sat
exactly on the 90° knife-edge (desk-pen, keyboard-sit, blanket-biscuits, slice
bed-sprawl), so they were re-authored to 29–45° off their approach — too straight
to read as away, too turned to drift through the limit on the next geometry edit.

### Bug 5 (part 2) — no lying poses
Bobo had sit/loaf, the decoy sit/sprawl — nothing horizontal. New poses in
`src/cat.js`: `side` (the loaf egg rolled 90° onto its flank — contact box
bottom still exactly y 0, far forepaw and a kicked-out hindfoot poke along the
floor so the silhouette reads "lying", not "fallen loaf", cheek down with the
face tipped up) and `back` (belly-up mid-roll: paws fly up, torso-only contact,
chin to the ceiling). The decoy gets `side`. The issue's own examples are now
the game: couch-loaf loaf→side, laundry-nap loaf→side, bed-stretch sit→back,
and the bathroom decoy lies on its side by the mat (decoy spots take an
optional `pose`). Marking rules exist per pose; the decoy's side collar is a
band across the TOP of the neck — vertex-counted (0 vs 13 whites in the same
ellipsoid) to be disjoint from Bobo's side bib, so `cats-distinguishable`
cannot trade tells between the animals. **(Issue #34 later deleted the decoy's
band entirely — the zones in `src/measure.js` stayed behind as the tripwire that
proves his neck is black. See §17.)** A rolled pose's local x is world-up, so
both idles and the three rewritten moment anims breathe in the world-horizontal
plane only on rolled poses — contacts never rock or sink; upright poses run the
exact original code path. New selfTest check `lying-poses`: ≥3 lying moments
plus ≥1 lying decoy, and an eye-high ray from each lying cat's nearest clear
approach must hit BOTH head and body of the staged rig — a sleeping Bobo is
still pointable, which is the whole game.

### What changed in the counts
Part 1: selfTest **49/49** full, **45/45** slice (+2 checks). Part 2 adds
`cats-face-the-room` (both pages) and `lying-poses` (full): **51/51** full,
**46/46** slice, stress `--checks` bumped to match (51 full / 46 slice).
Expected pixel changes: bedroom scenes (flush furniture, moved rug/plant/lamp,
moments), bathroom (toilet relocation, lying decoy), first-person frames
hugging walls (6 cm clamp), and every cat in frame — the facing fixes turn
most cats around, and three moments plus one decoy spot change pose.

## 17. Issue #34 — the decoy's neck is black now (Brandon: white on his feet only)

**Asked for (2026-11-15, issue #34):** *"On the fat cat, let's remove the white on his neck. Just leave white on his feet."*
**Delivered:** the decoy has **no marking rules at all** — his only white is the four literal white foot parts that were always there. No neck band/collar, no bib, no forehead dash, and no white muzzle (his muzzle was sharing Bobo's rule, so it went with the neck; the record of what he looks like is now one line in `docs/DECOY_CAT.md`). Bobo is untouched.

### What changed in the art
- `src/markings.js` — `rulesDecoy()` returns `{head: [], body: []}`. The white **muzzle** rule moved into `rulesBobo()` (it was shared before). The empty rule-set is kept rather than deleted so the builder still has one shape for "which rules are switched on".
- `src/cat.js` — no code change; a comment updated. The neck cylinder keeps its extra height segments on purpose: the neck-black check below counts vertices in that zone, and they have to exist to be counted.

### What changed in the checks
- `src/measure.js` — `COLLAR_EXPECT` becomes **`NECK_ZONE_EXPECT`**: the *exact* zones the band used to occupy, kept as the tripwire that proves his neck is black (issue #27 chose them disjoint from Bobo's bib, so a count of 0 means 0 for both cats; Bobo-only `back`/`loaf` throat zones added for him). `scanMarkings` now reports `{dash, bib, neckWhite, headWhite, feet, …}` instead of `collar`; `feet` counts the literal white foot parts (they were never vertex colours).
- `design/style-test/styletest.js` — `decoy-collar-white` and `bobo-no-collar` deleted; five added: `bobo-head-white` (150 ≥25), `decoy-head-black` (0), `decoy-neck-black` (0), `bobo-neck-black` (0), `white-feet-both` (4/4). **36 → 39 checks.**
- `game/engine.js` + `demo/talking-demo.js` — `cats-distinguishable` now proves the whole new contract in one place: `dash>0, bib>0, headWhite>0, neckWhite=0` on Bobo; `dash=0, bib=0, neckWhite=0, headWhite=0` on the decoy; white feet on both. The size tell is unchanged (`size-tell-width` ≥1.25×).
- **New fault injection `?plant=neck`** (style page) — an absence check needs a planted absence-breaker, so this paints the deleted band back onto the decoy's neck zones. It bites: 37/39, failing `decoy-neck-black = 241` (the old band's exact vertex count) and `cats-distinguishable`, exit 1. `?plant=dash` still bites as before (35/39: `bobo-dash-white`, both legibility checks, `cats-distinguishable`).
- `docs/`: `VISION.md` (and `.codeden/VISION.md`, byte-identical, sha1 `28cfbdd1…`), `STORY.md`, `CHARACTERS.md`, `DECOY_CAT.md` (a dated row in Brandon's own words), `ART_STYLE.md` (the rules table + the measured-tells table), `LEVEL_LAYOUT.md`, `LOCATIONS.md`, `HANDOFF.md`.

### The tells, re-measured
| | Bobo | decoy |
|---|---|---|
| forehead dash | 37 white verts | **0** |
| chest bib | 484 | **0** |
| white on the head (muzzle + dash) | 150 | **0** |
| white in the old neck band's zone | 0 | **0** |
| white foot parts | 4 | 4 |
| size | — | **1.32× wide, 1.68× bulk** (limits ≥1.25 / ≥1.35) |
| dash legibility | 71.9 mm → **26.9 px @ 2.5 m, 11.2 px @ 6 m** | n/a |

Bobo's white-on-black marking contrast stays 14.1:1. The tell set is now *absence-based* on the decoy and *presence-based* on Bobo, and both halves are measured every frame.

### Expected pixel changes (measured, same capture commands, before → after)
Removing white from a cat changes pixels where his head and neck were visible; nothing else moved.
| capture | before | after | why |
|---|---|---|---|
| `capture:style` | luma 62.5..118.1 · colours 123..222 | **62.5..117.8 · 123..221** | the style page stages both cats in close-up, so the band and the decoy's muzzle were real light |
| `capture:demo` | luma 25.8..82.2 · colours 83..228 | **21.4..82.0 · 79..228** | the demo frames its cat closest — biggest (still small) drop |
| `capture:slice` | luma 40.9..96.4 · colours 81..190 | **40.9..96.4 · 81..189** | one fewer colour: the band, at 2–4 m |
| `capture:full` | luma 45.6..163.5 · colours 84..286 | **unchanged** | the full flat's decoy sits far from every camera view; the probe never saw enough of him |

Geometry is untouched: draws/triangles are identical before and after on all four captures (style 89/101,636 · demo 91/95,748 · slice 98/94,640 · full 146/100,682).

### What the counts are now
`capture:style` **39/39**, `capture:demo` **37/37**, `capture:slice` **46/46**, `capture:full` **51/51** — every stage green, console clean, plus determinism, weak-GPU, `check:mobile`, bots, stress (`--checks` unchanged: the check *count* only moved on the style page), audio checks and `build` all pass. The planted-fault suites still exit 1 naming their check (`ending-text-exact` at 50/51 full, 45/46 slice), which proves the rewritten `cats-distinguishable` did not blunt the fault-injection path.

## 18. Issue #38 — the stick you cannot see is the stick you never press (Brandon on his phone)

**Asked for (2026-11-15, issue #38):** *"On mobile, the controller in bottom left doesn't show at all until you press in that area. But if you don't know it's there, why would you press?"* His first frame showed only the big yellow button, the score and the gear; the move stick materialised only after a lucky thumb, and the one faint text line at the bottom of the screen was unreadable over the scene.
**Delivered:** the ring now **rests in view at its lower-left spot from the first frame of play** (safe-area aware, light ring + dark outline so it survives a bright wall and a dark corner alike, four chevrons showing which ways it goes, and a few slow first-run breathes that calm mode / OS reduce-motion skip). The #26 dynamic origin is kept: press anywhere in the pad zone and the ring recentres under the thumb; release and it **glides home and stays visible** instead of vanishing. The faint line of text is retired on phones — three high-contrast chips (**move / look / shout**) rise when the gate lifts, a dashed ring on the right shows the **drag-to-look** swipe with a small travelling arrow, and the whole teaching layer fades after ~6 s or on the first game touch, whichever comes first. The "find Bobo, point, and shout!" pill stays. Desktop pixels and capture frames are unchanged: every new element is `.touch`-only and hidden under `?gate=off`.

### What changed
- `src/touch.js` — the stick's inline position is now a *press-only* style: idle, the CSS rest position shows through; `pressBase`/`restBase` swap the `.active` class and clear the inline `left/top` so the CSS transition glides the ring home. A tiny first-run flow watches `#gate` for `.hidden` (the first frame of play), adds `.show` to the chips + cue and `.pulse` to the ring (skipped under capture mode or when the calm checkbox is on), and retires on the first non-interactive pointerdown — the gate, the gear and the shout button's own tap included — or after 6.5 s. `debug()` now reports `intro: idle|show|gone`.
- `game/full.html` — the ring CSS (rest position, contrast edges, chevrons, breathe keyframes), the three chips, the swipe cue, `body.touch #hint { display: none }`, all inert without `.touch` and hidden under `body.capture`.
- `tools/mobile-check.mjs` — scenarios 12–12e: ring at rest behind the gate (visible, in view, both contrast layers, 4 chevrons), chips + cue asleep until the gate lifts and awake the first second of play, `#hint` retired, ring under the thumb at full brightness with the knob tracking (clamped to the 52 px rim), first touch retires chips + cue + pulse, release glides home *and stays visible*, short landscape (740×360) thumb targets never overlap and the chips auto-fade untouched, and none of it renders on desktop or under `?gate=off`.

### Notes
- "First run" is per page load (no storage): a returning phone sees the same gentle teaching for a few seconds, which costs nothing and keeps the no-backend promise. Everything is class-flipping over CSS — a PM can retune timings in `INTRO_SHOW_MS` or the fades, and the ring's rest spot is two `calc()`s.
- The shout button, its position, the pad zones, the rotate hint and the capture contract are untouched; `check:mobile` covers #25/#29/#38 together (all green), and the full-game captures + determinism re-ran unchanged at this HEAD.
