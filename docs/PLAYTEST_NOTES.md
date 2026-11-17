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

## 19. Issue #53 — the spot pool wakes up (every run draws its own hiding places)

**Asked for (issue #53, part of #33):** the full game must draw each run's ten finds from the whole `SPOTS` pool — one spot per moment type, random order, never two catches in the same room back to back — while the slice/demo keep their old behavior, seeded determinism holds, and `LC` can jump to *any* spot id.

**Delivered.** `pickSpotCycle` (`game/full-level.js`) draws one spot per type (uniform within the type) and orders the ten with a weighted-random greedy over an orderability-guarded frontier — provably no dead-ends, rooms never repeat back to back. The engine's queue carries spot ids on pooled levels only (`cfg.level.SPOTS`); `game.spotId` names the live spot, `game.momentId` stays the moment type so labels/voice/rigs/hint-fade never notice. `pickDecoySpot` prefers a different room than Bobo's new spot (same iron legality: never Bobo's spot, ≥ 1.2 m, facing). LC gained `spots()/spot()/setSpot(id)/gotoSpot(id,t)`; canonical ids still stage the canonical tableau + `canonicalDecoy`, so capture staging is untouched. Data moves (listed on the PR): `hall-chase.living` → `hall-chase.entry-door` (living 7→6, entry 1→2 for `spot-pool-covers-rooms`), and `window-bird.balcony-door` faceYaw −0.1 → 3.04 (pool facing sweep caught it 96° off its approach).

### Bugs this found (both fixed, both proven)
1. **A quiet matrix leak.** Accepting spot ids in `--moments` also widened `all`: the first full-page capture shot 38 stages instead of 13. Fixed in `tools/capture.mjs` — default/`all` resolve against `contract.moments` again; spot ids stay capturable by name. Proof of the fix and of "no baseline moved": re-ran `capture:full` at this HEAD **and at base 5470c54** in a scratch worktree — all **390 frame SHA-256s byte-identical**, 390 = 13 stages × 10 views × 3 times.
2. **Breathing that sinks Bobo.** The new 18-frame spot capture failed `bobo-contact` at three spots (−1.7/−2.0 mm, limit −1.0): couch-loaf's flank breath scales body local y/z (horizontal only in `side`) and hall-chase's scuttle scales local x (vertical when that type is drawn lying down) — canonical poses never hit the mismatch, pool poses do. Both writers now pick the horizontal axis pair from the live pose (demo rule: a breath never moves the contact). Canonical stagings take the same branch with bit-identical writes; the base-vs-HEAD frame comparison above proves no frame changed.

### What the numbers are now
- selfTest: **full 55/55** (was 53; + `spot-pool-covers-rooms` — 28 spots, ≥ 2 in each of 7 rooms — and `run-draw-legal` — 200 seeded draws, ten distinct, one per type, rooms alternate, decoys legal), **slice 46/46**, demo 37, style 36; green in-browser at every staging (canonical + all 18 non-canonical ids). Node probe: 2000 seeded draws, 0 illegal, byte-identical replays, all 28 spots and 7 rooms used.
- `capture:full` 390 frames 55/55 every frame, budget 139 draws / 96,676 tris, console clean, pixels luma 42..129 · colours 62..232 (same ranges as base); **`capture:full:spots`** (new) 18 frames, all seats 0…−0.67 mm, 55/55; determinism (8/8 byte-identical), weak, planted (fails naming `ending-text-exact`), slice/demo/style captures + determinism + planted, `gate` (all seven plants bite), `check:mobile`, `build`, audio ×2 — **all green at this HEAD**.
- `playtest:bot:full` (seed 11): wins at 10/10 with a **10/10-distinct spot cycle, rooms alternate**, decoys ≥ 1.2 m — **mean spawn→Bobo 4.85 m (min 2.40, max 10.49)**, i.e. the run is a tour, not a camp. `playtest:stress:full` (--checks 55): **67 PASS / 0 FAIL**, incl. the new live-pool scenario (ten rounds through `LC.restart()` + `loopTick`: bedroom > kitchen > bedroom > living > … mean walk 6.07 m, closest bobo↔decoy 3.31 m, win line exact). Slice bot 5/5 and `playtest:stress` 64/0 — the new scenario is inert without a pool.
- Capture-matrix choice, stated: `capture:full` stays exactly the canonical 13-stage matrix (all baselines safe, byte-proven) and the pool's extra coverage lives in the separate 18-frame `capture:full:spots` run.

## 20. Issue #57 — the game gets a front door (modern title screen with a LOOK AT BOBO! logo)

**Asked for (2026-11-16, issue #57):** splash screen 1/2 — *"a modern title screen with a 'LOOK AT BOBO!' logo above the instructions."* The old gate was a bare "click to start" card: no identity, no instructions to read, and nothing to come back to — win and pause both restarted the run in place.
**Delivered:** `#gate` is now a modern title card. The **logo is drawn in code**: Bobo's black head peeking OVER the gold "LOOK AT BOBO!" lettering — inline SVG with his yellow-green eyes, white forehead dash, muzzle and bib (the §5 tells, promoted to identity), the wordmark set in the bold system stack with layered outlines (no downloaded fonts), a −1.5° tilt and a soft drop. Below it the instructions, a **START** pill, a "how to play" fold with the full controls, and a comfort note; the backdrop is CSS-only (dim veil, vignette, a slow lamp-dust drift — never a second WebGL scene). The logo has idle life (blink, ear flick, gentle bob) that calm mode and the OS reduce-motion preference switch off. The **pause menu and the ending were re-dressed with the same card vocabulary** (warm-dark panel, mustard border, one pill-button language) so the UI reads as one game, and **pause and win now lead back to the title screen** — "back to menu" on the pause card (plus M, or Esc while paused), and the win's click/Space/tap lands on the menu too; Play from the card starts a fresh run through the exact same gate door as the first time. Pages without a title screen (the slice, every `?gate=off` page) keep the old in-place restart, byte for byte.

### What changed
- `game/full.html` — the card markup: inline-SVG logo (`role="img"`, `<title>` and aria-label **"Look at Bobo"**), wordmark, tagline, hint, `START`, how-to fold, comfort note; `body class="splash"` at boot; params docs updated.
- `game/title.css` (new) — the title look + the shared card vocabulary for pause and win, a `body.splash` rule that keeps HUD chrome quiet under the card, the keyframe idle life (off under calm/reduce-motion), and a **short-landscape layout** (≤420 px tall) where the copy reads as one wide line so logo/instructions/START/row/stamp all FIT inside the card — measured at 740×360, 667×375 and 844×390, not just arithmetic.
- `game/title.js` (new) — animation class hooks after first paint, calm-mode mirror, the how-to toggle (aria-expanded kept honest).
- `game/splash.js` (new) + `game/full.js` — the title copy as data; `cfg.splash` is what turns the whole title flow on in the engine.
- `game/engine.js` — section 6b: `backToMenu()` restores the exact pre-start shape (restart, unlock, `started=false`, `gateOpen=false`, resume, gate up) so the ONE `unlockGate` door answers Play again; `winExit()` hands pages with a card to the menu and pages without one (slice, `?gate=off`) the old in-place restart; `stepGame` sleeps while the card is up; the **tap-tail guard** — a finger tap is pointerdown→up→click as one sequence, so the click that ENDS the gesture that raised the card is swallowed by a pointerdown-sequence counter (measured: without it, shout-on-win raised the menu and the same tap answered Play before the player saw anything; LC.unlock() stays unguarded — it is not a tap); boot removes `body.splash` under `?gate=off` so the title screen is fully hidden AND empty; pause card gains `#pause-menu`; three new selfTest checks — `title-screen-state` (shown-with-class / hidden-without / absent under `?gate=off`), `title-logo-name`, `title-layout-clean` (no overlaps, nothing off-screen or spilling the clipped card; the logo-over-wordmark peek is the logo, not a collision) — full page **55 → 58** checks.
- `tools/export-logo.mjs` + `logo:export` — re-cuts favicon/social PNGs from the live page (element screenshots at exact pixel sizes, clear + badge variants, a self-written PNG decoder as its selftest). The page itself still ships zero raster logos.
- `tools/mobile-check.mjs` — scenario 2 grows the phone title check; the win run now expects the shout to land on the title screen and a Play-from-card fresh run; new **scenario 13**: title up before the start with the whole 58-check selfTest green from BEHIND the card, Play lifts it, clean layout at 1280×800 / 3440×1440 / 740×360, and full absence under `?gate=off` (gate `display:none`, no splash class, wordmark not even *rendered* — `offsetParent` null, since children of a `display:none` subtree keep their own computed `display`).
- `package.json` — `playtest:stress:full --checks 58`; slice stays 46.

### Measured (this HEAD, Node 24.22, Chrome 157 headless)
Measured on the MERGED tree (`6e5de40`, with #53's spot pool and #55's patriot costume folded in), Node 24.22, Chrome 157 headless: `npm run gate` PASS · `capture:full` PASS + determinism PASS (**8/8 frames byte-identical**) + `:weak` PASS + planted exits 1 as required · `capture:full:spots` PASS · `capture:slice` (+det, weak) and `capture:demo` (+det) and `capture:style` + `capture:patriot` PASS, planted slices/demos exit 1 · `audio:full/slice/demo` PASS · `playtest:bot:full` PASS (10/10, ending "your did it! you wind") · `playtest:stress:full` **67/0** with **58/58** selfTest both live and after reload · `playtest:stress` (slice) **64/0** · `npm run build` PASS (46 files, stamped graph) · `check:mobile` **PASS — 97/97, zero skips** (the dist/ stamp checks now run too), including #57 at all three viewports and the shout→menu→Play round trip on a CDP-emulated phone. Layout numbers that mattered: at 740×360 the first CSS pass pushed the build stamp past the card's bottom edge — and because the card clips with `overflow:hidden`, the plain viewport test nearly let it pass half-painted; the new containment predicate (box inside the CARD, not just the viewport) caught every variant before commit.

### Notes
- Why CSS instead of a live 3D splash: an earlier cut put a slow camera orbit behind a transparent card, but it meant the render loop ran before Play (breaking "no loop until the gate") and cost a second camera + per-frame splash branches in the deterministic step. The CSS veil + lamp-dust gives the same warmth for free, and the captured pages never load a byte of it.
- `?gate=off` promise, restated: the title screen is fully hidden and empty there — element hidden, class removed at boot — so every capture/determinism baseline is byte-identical and the three title checks report `"absent"` instead of vanishing (a check that silently disappears is a check that fails open).
- Settings deliberately has NO second door on the card: the comfort gear already floats above it (z-55); the card carries a one-line comfort *note* + the how-to fold instead. Recorded as a conscious deviation from a literal "settings button on the menu".
- Exact-text law untouched: `your did it! you wind` and `DAG!` are byte-identical; only the *invitation line under the win* changed wording (to "go back to the menu", touch wording matched) — no test asserted the old invitation text on the full page.
- Splash screen **2/2** (issue #57 is 1/2): whatever Brandon wants next on the menu (art pass, sound sting, a play/continue split) builds on this card without touching the engine's door.

## 21. Issue #58 — Patriot Bobo walks into the game (the rare +3 costume find)

**Asked for (issue #58, second half of #35):** the costume from #55 becomes the full game's **rare bonus cat**. One 1-in-6 roll per find after the first, never consecutive, never more than two per run, seeded so the same seed tells the same story; his catch pays **+3** and the win (score ≥ 10) can therefore come early; a "+3!" pop and extra confetti/fireworks that calm mode still hides; `?patriot=off|on|N` plus `LC` hooks; the default capture seed must NOT draw him, so every pre-#58 capture frame and bot number keeps its pixels.

**Delivered.** `PATRIOT` (game/engine.js) carries the rule as data (`chance 1/6`, `maxPerRun 2`, `firstFind 2`, `reward 3`, `pose 'sit'`, `seedTag 'patriot 16'`). The dice is one `mulberry32(hashId('patriot 16 ' + SEED))` stream, one roll per LEGAL find — `runPatriotPlan(seed, finds)` computes a whole run up front and is exposed as `LC.patriotPlan()`; live rounds consume the same stream, so the plan and the run can never disagree. A dressed Patriot sits on his drawn spot with his drawn faceYaw (nearest allowed pose — the costume is authored seated), so decoy-distance legality covers his rounds untouched. `triggerEvent` pays `PATRIOT.reward` on a patriot catch; the win is still `score >= TARGET`.

### The knobs
- `?patriot=off` — absolute kill switch: no rolls, and `LC.patriot(true)` itself returns false.
- `?patriot=on` — live rolls AND dresses the staged (capture) finds; this is how his capture frames work.
- `?patriot=N` — force live find N only (staging stays undressed: the boot-staged find is number zero and he is never first). Forces still obey never-first / never-consecutive / the cap — a refused ask waits for the next legal find.
- Default — live rolls on, staging undressed.
- `LC.patriot()` reports `{ reward, count, costumeAttached, force }`; `LC.state()` carries `patriot`, `patriotCount`, `findNum`.

### Calibration (empirical, probe over 500 seeds × 10 finds)
The `seedTag` was picked, not trusted: roll rate **17.7 %** (advertised 1-in-6), **81.4 %** of seeds see him at least once, 43.6 % hit the 2-per-run cap — and the three baseline seeds stay quiet: seed 11 (capture + bots) draws **zero** Patriots in ten finds, stress seeds 23/47/9 none inside their scored finds. `patriot-default-seed-quiet` fails the moment a future pool or chance change breaks that; the fix is re-picking `PATRIOT.seedTag`, not loosening the check.

### What the numbers are now (recorded at pre-merge HEAD 12bde41; the §20 title checks ride along after the merge — 58 → 65)
- selfTest: full **62/62 at that HEAD** (55 → 62; the seven new `patriot-*` checks: 500-seed spawn-rule invariants + odds bands, default-seed quietness, +3/early-win event math (8→11 wins), aim-through-costume raycast — 8/8 compass angles resolve cat-bobo, a ray aimed at the hat hits the costume itself and still resolves Bobo, detaches clean — spot-legal dressing, celebration-for-him-only, off-switch + plan determinism), slice **46/46** (engine selfTest pins `game.patriot=false` for the base +1 checks).
- `capture:full` **390 frames, 62/62 selfTest every frame, budget 139 draws / 96,676 tris — matching the #53 record to the draw**; determinism **8/8 byte-identical**; `audio:fullcheck` **23/23**. New `capture:full:patriot`: 6 frames, a costumed Bobo in six findable rooms, **113 draws / 99,140 tris** — the costume's 10 meshes ride well inside the budget.
- `playtest:stress:full` (--checks 62 at that HEAD): **70 PASS / 0 FAIL**, incl. the new scenario 13 — off page never spawns and refuses the force; `LC.patriot(true)` dresses exactly the NEXT legal find (find 2, +3, score lands 4, find 3 plain); a live run on seed 23 matches `LC.patriotPlan(23)` find-for-find (`00000101`) and replays identical after `LC.restart()`. Scenarios 1/3 now play to the WIN (score ≥ 3) instead of a fixed catch count. Slice **65 PASS / 0 FAIL** — scenario 13 is inert without a spot pool.
- Bots: `playtest:bot:full` on seed 11 unchanged — wins at 10/10, every delta +1, exactly one DAG!. New `playtest:bot:patriot:full` (`--patriot 3`, win at 5): scores 1, 2, 1, 2, **5** — costume true on find 3 only, `patriotCount` 1, ending `your did it! you wind`. Slice bot 5/5.
- Juice: a patriot catch boosts the firework bursts ×1.35 and spills confetti early (plain catches pass boost 1 — every earlier frame unchanged); "+3!" is a single DAG-style ease-out-back pulse, full page only. Calm mode hides pop, confetti and bursts wholesale — `patriot-celebration-only-for-him` asserts both the leak and the rest.

## 22. Issue #65 — doors that read open, and walnut without black dots

**Asked for (issue #65):** every doorway photographs as a shut door, and the
wood has black dots on it. Doors are **permanently open** in this flat — no
open/close interactivity was added and none will be; the leaf was simply
DRAWN across its own opening.

**Fix:** `swingHi`/`swingOut` on each door opening parks the leaf flat along
the plaster BESIDE the hole (2 cm off the trim, 5 cm off the wall, knob on
the free edge; geometry owned by `docs/ISSUE_33_REBUILD.md`). The dots came
from 220 near-black 1–3 px "open pores" in the walnut HEIGHT field, which
`normalMapFrom`'s Sobel pass baked into pin-dots; `WOOD_H` is plank seams
only now, with one soft radial knot per plank in the colour map (alpha ≤
0.16, token colour untouched).

**Checks (full 67 → 70; slice stays 46):** `doors-read-open` (one thin leaf
per door, zero WALK_RECTS overlap), `wood-texture-clean` (`woodTextureAudit`
near-black fraction < 0.001 in both the colour canvas and a re-paint of the
height drawing — the old pore field measured 0.0022), `doorways-read-open`
(per door: the hole pixel from its new standing-height `door-*` VIEWS camera
is not leaf-coloured and is brighter than the leaf, and a ray down the hole
pixel crosses the wall band without touching a `door-leaf` mesh — the exact
render the old leaf failed). Regression proof: re-planting the old leaf run
and the pore loop drops the page to 67/70 with all three failing by name
(`door-living-hall stands in walk rect door-living-hall`, `height 0.0022`,
`ray through the hole hits a leaf at 1.61 m`); restored, 70/70.

### What the numbers are now (recorded at HEAD 2e1959d; base = origin/main feb2291 measured in the same session)
- `capture:full` **507 frames** (13 stages × 13 views × 3 times — the three
  new `door-*` views join `--views all`; base matrix: 390 frames, 67/67),
  selfTest **70/70 every frame**, budget **PASS at 169 draws / 99,288 tris
  — byte-for-byte the same worst frame as the base run**, pixels luma
  41.8..137.1 · colours 74..230, console clean. Determinism **8/8
  byte-identical**; `:weak` PASS; `:spots` PASS 70/70; `audio:fullcheck`
  **23/23**.
- `capture:slice` 144 frames **46/46** (98 draws ≤150), `capture:slice:determinism`
  **8/8**, `capture:demo` 48 frames **37/37** (91 draws), `capture:demo:determinism`
  **8/8**, `gate` **PASS**, `check:mobile` **PASS**, `build` dist/ stamped
  `2e1959d-…` 52 files.
- `playtest:stress:full` (--checks 70) **70 PASS / 0 FAIL**; `playtest:stress`
  **65 PASS / 0 FAIL**; bots full **10/10**, patriot **5/5** (1+1+3), slice **5/5**.
- Planted-fault suites still exit 1 naming `ending-text-exact` — `capture:planted`,
  `capture:slice:planted`, `capture:full:planted`, `capture:demo:planted`.
- **Flake fixed on the way in:** `doorways-read-open` rendered six frames per
  selfTest call; selfTest runs per capture frame, and under the stress
  suite's three-page load that starved the 150 ms window the `#reticleAim`
  probe counts. Door frames now render **once per page** (static geometry;
  a failing first pass keeps re-testing). stress:full green standalone after.

## 23. Issue #66 — every live game was playing the same run

**Asked for (Brandon, 2026-11-16):** "I never saw MAGA Bobo. He was never on
the balcony. It seemed like he was in the same spots over and over" — over
about twenty rounds on the deployed game.

**What was actually happening:** one line in `game/engine.js`
(`const SEED = Number.parseInt(params.get('seed') ?? '11', 10) || 11`) gave
EVERY page the same seed, so every player on earth drew the identical ten
hiding places out of the 28-spot pool — `desk-pen.desk-end, sink-sit.fridge,
keyboard-sit.keyboard, couch-loaf.sofa-back, laundry-nap.basket,
window-bird.balcony-door, bed-stretch.bed-foot, box-sit.box,
blanket-biscuits.wardrobe, hall-chase.entry` — and, because the Patriot dice
tag was deliberately calibrated so seed 11 draws nobody in ten finds (§21),
not one of those runs ever contained Patriot Bobo. The pool, the balcony and
the bonus cat were all fine; the die was bolted to one number.

**Fix:** `src/run-seed.js`, one rule in one place. `?seed=N` pins the run
(reproduce-a-run and the bug-report knob); `?gate=off` — capture mode, every
tool page, every determinism pair — keeps the fixed **11**, byte-identical to
what it drew before this file existed; live play draws a fresh 31-bit integer
from `crypto.getRandomValues` **at boot and again for every new run**
(`play again`, the pause card's restart and the win all route through
`restartRun`, which re-rolls and re-derives `rng`, `patriotRng` and the queue
refills exactly the way boot seeds them). The seed now reads on the gear panel
and the `?stamp=on` line (`… · seed 123456789`), so a player can send the run
they saw back, and `LC.seed() / LC.seedInfo() / LC.spotCycle(seed)` hand it to
the tools. `src/determinism.js` counts `crypto.getRandomValues` as an unseeded
call too, so `seek-no-unseeded-random` still proves gameplay is seeded-only
now that a crypto roll exists in the page at all — the seed is taken at boot
and at a run boundary, never inside a measured region.

### The pool under random seeds (`npm run seed:coverage`, 500 random seeds)
Every spot gets played. The rarest of the 28 lands in **12.0%** of runs
(`hall-chase.hall-door`), and the three balcony places in 33.8%
(`couch-loaf.balcony-chair`), 24.6% (`window-bird.balcony-door`) and 20.2%
(`window-bird.balcony-rail`) — the balcony itself is reached by **48.6% of
runs**. Two spots are 100% because they are the only place of their moment
type (`box-sit.box`, `keyboard-sit.keyboard`). **83.4% of runs (417/500)**
now contain at least one Patriot find, **1.24 finds per run** on average.
That is higher than the 40…55% the issue guessed: a ten-find run gets NINE
legal rolls at a 1-in-6 dice (never the first find, never back-to-back, max
two), which is what `pool-coverage-over-random-seeds` now asserts (70…95%).

**The one-spot-per-moment-type rule is what limits a room** (issue #53's
draw, unchanged here): `hall-chase` owns 7 spots spread over the hall, the
entry, the kitchen and the bathroom, but exactly ONE of them is played per
run, so each of those places lands in 12…16% of runs and the bathroom in
about 28% of runs. Loosening that rule (say, two spots of the same type when
they are in different rooms) is a story-design call for Brandon, not
something to slip into a seed fix — it is raised in the PR, not done.

### What the numbers are now (recorded at HEAD a0b9cae)
- `capture:full` **507 frames**, selfTest **70 → 77 every frame** (the five
  engine `seed-*` checks, plus full-only `seed-reproduces-the-run` and
  `pool-coverage-over-random-seeds`), budget **PASS at 169 draws / 99,288
  tris — the same worst frame as before the change**, pixels luma 41.8..137.1
  · colours 74..230, console clean. Determinism **8/8 byte-identical**;
  `:weak` PASS; both planted-fault captures still **FAIL** naming
  `ending-text-exact`.
- `capture:slice` **51/51** (46 + the same five shared checks),
  `capture:slice:determinism` **8/8**, `capture:demo` **37/37** untouched,
  `capture:demo:determinism` **8/8**, `gate` **PASS** (all five planted faults
  still caught), `check:mobile` **PASS** (92 green without `dist/`, 96 with),
  `build` dist/ stamped `a0b9cae-20261116-1723`, 53 files.
- `playtest:stress:full` (--checks 77) **77 PASS / 0 FAIL** and
  `playtest:stress` **72 PASS / 0 FAIL**, both carrying the new scenario 14:
  two live boots play two different seeds and two different spot cycles,
  `?seed=4242` hands the same run back on both boots, a live restart re-seeds
  (40108844 → 974821936 in the log), `?gate=off` still boots on 11, and the
  seed reads on the gear panel and the `?stamp=on` corner while capture mode
  still keeps every stamp out of the frame.
- Bots unchanged at their seed: full **10/10**, Patriot **5/5** (1+1+3),
  slice **5/5** — they pass `?gate=off&seed=11`, so they replay exactly what
  they replayed before. Audio: `audio:selftest` 23/23, `audio:pagecheck`
  24/24, `audio:slicecheck` + `audio:fullcheck` **23/23**, `audio:democheck`
  17/17.

---

## 24. Issue #71 — the game gets a soundtrack (original bardcore, synthesized in code)

**Asked for (Brandon, 2026-11-15):** "Let's also add some MIDI music,
something bardcore style, like happy Gothic you'd hear in the Addams
Family." Original composition only — evoke the genre, quote nothing.

**What shipped:** `src/music-score.js` (the whole 32-bar A-minor tune as
data — Am–F–C–G with major lifts, 110 BPM, swing 0.57, six synth recipes,
the thin `calm` pause arrangement and the once-only win `flourish`) and
`src/music.js` (a lookahead scheduler + tiny synth: plucked harpsichord
lead, lute arpeggios, vibrato pipe, pizzicato bass, hand drum + tambourine,
ornament trills). It starts only inside the START-gesture that already
unlocks the voices, ducks **0.631 (≈ −4 dB, 12 ms in / 400 ms out)** under
the voice lines via `lc-voice` events `src/audio.js` now announces, plays
`calm` under the pause menu, freezes mid-loop when the tab hides, hands the
win a fanfare, and composes `master = ?volume × ?musicvol` with `?mute` /
`?musicmute` / `?music=off`. `?quality=low` mutes drum/ornament/pipe; no
reverb anywhere. Full contract + edit knobs + listening checklist:
**[`docs/MUSIC.md`](MUSIC.md)**.

**The honest limit:** nobody on the team can hear anything here — every
claim below is *measured*, none is *listened*. The PR lists exactly what
Brandon should check with real ears (tempo feel, loudness vs the yell, the
loop seam at ~70 s, the mood) and which knobs answer what.

**How it is proved without ears:** two new suites, in the existing audio
check style (real Chrome, NO autoplay flags, a trusted click on the gate):

- `npm run music:selftest` — **29/29** in pure Node: score validation,
  32 bars / 512 steps / 69.82 s, step-time periodicity (the loop CANNOT
  drift — every step recurs exactly one loop-length later), swing mapping
  (k=1→0.285, k=3→0.785 of a beat), plan determinism, duck shape (0.631,
  12 ms / 390 ms, ≥95 % recovered by 400 ms), analyser sanity, and the
  originality guardrails (minor piece + major lift, flourish resolves to
  Am, no fetch/mp3/wav/ogg/decodeAudio anywhere in the music modules).
- `npm run music:check` — **28/28** in Chrome with the AudioContext
  constructor wrapped and COUNTED: `?gate=off` boots with **0 live
  AudioContexts** and `present:false`, yet `LC.musicRender()` still renders
  (3 OfflineAudioContexts, 0 live); `?music=off` clicks play with 0
  contexts; before the gate click 0 contexts, after exactly **1**, running,
  stepping; a REAL yell measured **duckLevel 0.631** mid-line and 0.96+
  after; pause → `calm` at level < 0.75 still running, resume → `main`; a
  1 s main-thread stall advanced the step a bounded 11 with 8 live voices
  and no errors; win → `flourish`; hidden tab froze the step for 700 ms and
  showing resumed it; `?volume=0.5&musicvol=0.5` → master **0.25**, `?mute=1`
  → 0, `?musicmute=1` → 0 with `?quality=low` → lighter set. Offline render
  of the REAL synth paths: main **rms 0.1637 / peak 0.8192** (calm
  0.1167/0.7546, flourish 0.1695/0.9126 — no arrangement clips), band
  energy bass **4.14** / lead **0.029** (a 110 Hz reference tone reads
  2.7e-5 lead / strong bass, so the bands really separate).

**Everything earlier stayed green** (this HEAD, same machine): `gate` PASS
(all five planted faults still caught, tool selftest 23/23),
`capture:full` **507 frames / 77 checks every frame / PASS**,
`capture:full:determinism` + `capture:slice:determinism` +
`capture:demo:determinism` all **8/8 byte-identical** (music is silent and
context-free under `?gate=off`, and the determinism suites did not move),
`capture:slice` **51/51**, `capture:demo` **37/37**, `check:mobile` **92
green / 0 FAIL**, `audio:slicecheck` + `audio:fullcheck` **23/23**,
`audio:democheck` **17/17**, `audio:pagecheck` **24/24**, bots slice
**5/5** + full **10/10** (replay-hashes stable),
`playtest:stress:full` **77 PASS / 0 FAIL**, `capture:full:weak` PASS,
`build` dist/ stamped **55 files** (+2: `src/music.js`,
`src/music-score.js` ship with the `?v=` stamps; the build copies `src/`
wholesale, so `docs/DEPLOY.md` needed no file-list change).

## 25. Issue #61 — back under 150 draws on the full game (per-room culling + merged statics)

**Asked for (issue #61):** the full game's worst frame sits over the 150-draw
budget in `docs/ART_STYLE.md` — 159 in the desk view when the kitchen and
bedroom merged, 169 worst across the capture matrix — and issue #59 had raised
the tool's `FULL_GAME_DRAW_CALLS` to 180 purely to unblock that merge. Bring
the real number back under 150 with per-room
culling and/or merged geometry, restore the constant to 150, keep every other
suite green, and change no look and no collider.

**Where the draws actually go.** `tools/draw-report.mjs` is new and read-only:
it boots any page, renders one frame with `renderer.info.autoReset = false`,
and dumps every object the renderer submitted with its world AABB, material
and signature (`--inventory`), or the same per-frame draw counts for every
view/moment (`--views all --moments all --json`). At the worst frame the
living room — the room the camera is standing in for the wide views — is 68
draws on its own, the shell + sky that straddle every room is ~12, the shadow
pass adds ~20, and the rest is rooms the camera cannot see. That is the real
shape of the problem: culling can only remove what is not the camera's own
room, and it can never remove geometry that spans rooms.

**Merged statics (`game/full-merge.js`).** Siblings sharing a *shading
signature* (program + every material field + uniforms + texture identity) are
folded into one `BufferGeometry` with transforms baked in and `matrixWorld`
identity, so the frustum test sees exactly the union AABB it saw before and
the GPU gets one draw of the same triangles. A mesh is left alone when it is
animated (`onTick`, the leash line), transparent, multi-material, named, or
**locked** — locked meaning it carries any `userData` the checks read:
`tag` (#41/#44/#62 probe lookups), `scale`/`scaleGroup` (#30 size checks),
`fuzz` (#28), `eyes` (#31), `ell`/`baseScale`/`baseRotX`/`baseRotZ`/`noContact`
/`contact` (#46 ruler), or `noMerge`. The ruler measures per-mesh AABBs, so
anything it measures stays unmerged rather than loosening the check. Result:
**18 meshes fold into 8 buffers** (base cabinets, wall cabinets, doors,
drawers, shelves, books, pens, boxes), and the sky's seven
`MeshBasicMaterial` sheets —
one shared unlit material, so folding cannot reorder any shading — → 1.
`?merge=off` rebuilds the split flat.

**Per-room culling (`game/full-cull.js`).** Hiding is done by setting
`Object3D.visible` on the **room group**, which three.js honours in both the
main and the shadow pass, and which leaves every child's own `visible` flag
intact — the 77 selfTest checks and the bot probes filter on `o.visible` and
still see the whole world. Chosen over `camera.layers` for exactly that
reason: a layer-masked raycast silently changes what the checks see. Three
conservative rules: a group is only ever hidden when its world AABB sits
inside **exactly one** room rect (the shell, the sky and anything straddling a
doorway are never touched); only the children `buildFullApartment` returned
are fileable, so every actor, prop and confetti piece the engine adds later
stays visible from wherever it is; and the visible set is the 2-hop
neighbourhood of the camera's room in `OPENINGS`, **failing open** — a camera
outside every rect (the win orbit, the diorama, a knockback) draws everything.
`?cull=off` disables it, and `LC.selfTest()` runs with the cull disabled for
its whole duration so no check can gain or lose coverage from a camera
position.

**Nothing changed in the picture — proof, not opinion.**
`tools/draw-report.mjs --pixels` renders the *same* frame twice with two param
sets and byte-compares the PNGs, with an A-vs-A control first to prove the
harness itself is deterministic. Run over the full 13 views × 13 moments at
t = 0, 1.2 and 2.4: **169/169 frames identical at each time, 507/507 overall**
(control 169/169 each), merge+cull on vs both off. If a single pixel of the
art had moved, this would have caught it.

### Draws per view (`win` moment, default quality; "before" is the same build
### with `?merge=off&cull=off`, i.e. the flat as it was on `main`)
| view | before | after | saved |
|---|---:|---:|---:|
| diorama | 108 | 104 | 4 |
| first-person | 98 | 93 | 5 |
| bobo | 66 | 62 | 4 |
| **overview** | **155** | **147** | 8 |
| over-shoulder | 64 | 60 | 4 |
| low-angle | 77 | 71 | 6 |
| kitchen | 103 | 95 | 8 |
| bathroom | 92 | 88 | 4 |
| **desk** | **163** | **123** | 40 |
| balcony | 99 | 92 | 7 |
| door-living-hall | 97 | 90 | 7 |
| door-living-kitchen | 80 | 77 | 3 |
| door-hall-bedroom | 70 | 62 | 8 |

### Draws by room, same moment (main pass; the shadow pass adds 20 → 19)
| room | desk before | desk after | overview before | overview after |
|---|---:|---:|---:|---:|
| living | 69 | 68 | 68 | 68 |
| kitchen | 35 | hidden | 10 | 10 |
| bedroom | 10 | 12 | 31 | 27 |
| bathroom | 8 | 8 | 9 | 9 |
| balcony | 4 | 2 | — (out of frame) | — |
| shell / straddling / outside | 17 | 14 | 17 | 14 |
| **main pass** | **143** | **104** | **135** | **128** |

The overview is the binding frame: the camera sits in the living room, and
every room is within 2 hops of the living room, so nothing may be hidden there
— 147 is what merging leaves. A room's count can go *up* one or two draws
after merging (bedroom from the desk, 10 → 12): one fat buffer's AABB clips a
frustum edge that several thin meshes each sat clear of, so one draw replaces
zero. The totals are what the budget measures, and every total went down.

### Both quality modes (`--views all --moments win`; `?quality=low` on the right)
| view (camera room) | high draws | high tris | low draws | low tris | rooms the cull hides |
|---|---:|---:|---:|---:|---|
| diorama (living) | 104 | 96,296 | 79 | 44,188 | — |
| first-person (living) | 93 | 95,590 | 68 | 43,482 | — |
| bobo (living) | 62 | 60,534 | 39 | 19,562 | — |
| **overview (living)** | **147** | 97,856 | **122** | 45,748 | — |
| over-shoulder (living) | 60 | 37,698 | 39 | 7,862 | — |
| low-angle (living) | 71 | 57,550 | 49 | 20,946 | — |
| kitchen (kitchen) | 95 | 37,728 | 76 | 7,952 | entry, bathroom, bedroom |
| bathroom (bathroom) | 88 | 70,428 | 65 | 29,456 | kitchen, balcony |
| desk (bedroom) | 123 | 97,446 | 98 | 45,338 | kitchen, balcony |
| balcony (balcony) | 92 | 37,230 | 73 | 7,454 | entry, bathroom, bedroom |
| door-living-hall (living) | 90 | 62,730 | 67 | 21,758 | — |
| door-living-kitchen (living) | 77 | 36,528 | 56 | 6,692 | — |
| door-hall-bedroom (hall) | 62 | 35,684 | 41 | 5,848 | — |

The weak-GPU path stays **25 draws and more than half the triangles** lighter
at the same frame (122 / 45,748 vs 147 / 97,856): the shadow pass, the fuzz
shells and the confetti all stay off there, and the cull works identically
because hiding a room removes its shadow draws too. Summed over the 13 views,
the main pass contributes (high, tris): living 472 / 84,845 · straddling groups
152 / 44,888 · kitchen 149 / 5,015 · bedroom 90 / 2,230 · bathroom 46 / 2,955 ·
balcony 7 / 2,464 · shell 5 / 91.

### What the numbers are now
- `capture:full` **507 frames** (13 stages × 13 views × 3 times), selfTest
  **77/77 every frame**, budget **PASS at 147 draws / 98,656 tris**, pixels
  luma 42.6..135.7 · colours 72..237, console clean.
- **Measured on this HEAD with the cap at 150 on both sides**, same tool, same
  507 frames: with `?merge=off&cull=off` the run is **163 draws / 99,290 tris**
  worst (`win/desk`) with **36 frames over 150** and `VERDICT: FAIL`; with the
  merge and the cull on it is **147 / 98,656**, **0 frames over 150**,
  `VERDICT: PASS`. Issue #61 and §22 record **169 / 99,288** at HEAD `2e1959d`,
  before the seed (#66) and music (#71) work moved the same matrix a few draws
  — the direction and the size of the cut are the same either way, and every
  frame is now under the cap that was 150 all along in `docs/ART_STYLE.md`.
  `FULL_GAME_DRAW_CALLS` is back to **150** in `tools/capture.mjs`, so the
  budget check enforces the issue's requirement instead of excusing 180.
- Determinism unchanged: `capture:full:determinism` **8/8 byte-identical**,
  `capture:full:weak` **77/77**, `capture:full:patriot` PASS, `capture:style`
  PASS.
- Slice and demo untouched — they never include the flat, and the cull hooks
  are inert when there is no `apt.cull`: `capture:slice` **51/51 at 98 draws**,
  `capture:slice:determinism` **8/8**, `capture:slice:weak` PASS,
  `capture:demo` **37/37 at 91 draws**, `capture:demo:determinism` **8/8**.
- Everything else green on this HEAD: `gate` **PASS** (planted-fault suites
  still exit 1 naming `ending-text-exact` — that is their PASS condition),
  `capture:all` (the tool's own testscene) **144/144 byte-identical**,
  `capture:patriot` 6 frames **95 draws**, `check:mobile` **92 PASS / 0
  FAIL**, `playtest:stress:full` **77 PASS / 0 FAIL**, `playtest:stress` **72
  PASS / 0 FAIL**, bots full **10/10** and patriot **5/5** with unchanged
  replay hashes, `seed:coverage` unchanged (83.4% of runs reach a find),
  `music:selftest` **29/29**, `music:check` **28/28**, `audio:fullcheck`
  **23/23**, `build` dist/ stamped 57 files (+2: `game/full-merge.js`,
  `game/full-cull.js`).
- **Headroom left:** 147 of the 150, and the ceiling is 3 draws of it. The
  binding frame is the camera standing *inside* the densest room, so the next
  real cut is merging inside the living room's own clutter, which means
  teaching the ruler (#46) to measure merged buffers — its own issue, not this
  one.

---

## 26. Issue #67 — the bathroom gets bigger, and the hall stops ending in nothing

**Asked for (Brandon, 2026-11-16):** the bathroom is too cramped to play in,
and the hall across from it "ends in a dark nothing". Brighten it, re-lay the
furniture, find the void.

**The bathroom was 2.28 × 1.68 m and its own tub made it unusable.** Issue #61
brought the tub to the ruler's real 1.68 m and it ended up standing across the
room's short axis, leaving 0.24 m² of floor a body could actually occupy —
`hall-chase.bath-mat` still had a standable cell, so every check stayed green
while the room was a corridor past a bathtub. `bathGapReport` said the mat's
width "blocked" behind the tub.

**The void was a hole in the plaster.** `WALL_DEFS` built the hall's east band
(x 0.90 … 1.02) in three pieces that stop at z 3.90 — the entry's south face —
and nothing continued it to the band's end at z 5.20. From standing in the
corridor you looked through the wall line into the sky outside the flat, and
with no plaster there to catch the fill, the last third of the hall was the
darkest interior in the game. `E-hall-3` (axis `x`, z 3.90 → 5.20, `wall-int`,
`hall`) closes it. It folds into the plaster mesh the shell already draws, so
the fix that answers the issue's headline costs **zero draw calls**.

**What changed**

1. **The room grew into the void behind it.** `ROOMS.bathroom.z1` 3.90 →
   **5.20**: 2.28 × 2.98 = **6.8 m²** (was 3.8), net interior **65.67 → 68.68
   m²**, still inside issue #33's 65–80 m² band. No new exterior plaster
   existed to buy: `W-2` already ran to z 5.52 and `E-bath-2` to 5.20, and the
   bedroom's north band (`M-bed-1`) is the bathroom's south wall now, so
   `S-bath-1` is simply deleted. Interior wall count unchanged.
2. **Re-layout** (`game/full-bath.js`): the tub runs east–west along the new
   south wall (x [−3.30, −1.70] · z [4.45, 5.20]) flush with it, curtain/taps/
   head/spout/towel bar/mirror/bin move +1.30 m in z with it, and the mat lands
   in the doorway strip. **The vanity and toilet footprints did not move**, so
   `hall-chase.vanity` and `hall-chase.bath-mat` land where they always landed.
   The bathroom walk rect's z1 moved to 5.12 — the only collider-domain change
   in this issue, and forced by the enlargement. Door-less on purpose, still.
3. **The hall and the entry got the rooms they always claimed.**
   `coat-bench` and `hall-console` have been colliders since issue #33 with
   nothing drawn on them: `game/full-entry.js` (data) and
   `game/full-entry-mesh.js` (geometry) build the bench with three hooks, the
   console, a framed print, a bowl, the doormat, a runner down the corridor
   and four ceiling bodies. No collider added, none moved.
4. **Light without breaking the cap.** Still four point fills, still
   `realLights 6`: the hall's moved to `[0.72, 2.34, 3.4]` at 5.4 so it serves
   the corridor *and* the front door's room, and the bathroom's sits in the
   middle of the room it grew (`[−2.16, 2.34, 3.71]`, 3.9 @ 5.8 m). The
   ceiling bodies are emissive shades, not lights — the convention the living
   room's lamp keeps.

**The budget, because it is always the budget.** `game/full-merge.js` refuses
to fold a mesh that carries a `name` or a measured `userData` tag, and buckets
the rest by shading signature + geometry signature + shadow flags. So the new
meshes are left **unnamed** (nothing looks them up — only the bench, locked by
its own `scale` tag regardless), and everything that is pale wood, mat or
frame uses `game/full-apartment.js`'s exact trim recipe with `cast: false`,
which drops them into the casing/skirting bucket the flat already pays for.
They are cream painted board paths, which is also simply what a hall like this
has. Net cost of the whole dressing: **+2 draws** — the measured bench, and
one emissive fixture mesh.

### Measured (this HEAD, Node 24.22, Chrome 157 headless)

- `capture:full` **546 frames** (14 views × 13 moments × 3 times — `entry` is
  the new view), selfTest **81/81 in every frame**, budget **PASS: 149 of 150
  draw calls**, 99,420 triangles, 1 pass, 2 shadow-casting lights,
  **realLights 6 / 6**, pixels luma 42..149.8, console clean, **VERDICT PASS**.
  The 149 is `win/overview`; the same frame without the entry dressing
  measures 147, so the two draws above are the real invoice.
- **Standable floor in the bathroom, same 0.60 m body, same grid** (the
  probe `/tmp/opencode/bath-path-probe.mjs` runs the real `WALK_RECTS` +
  `COLLIDERS`): **2.58 m² as built vs 0.24 m² before #67**, and the three
  fixture fronts (a point 0.40 m off each usable face) go from *all blocked*
  to *free and flooded from the flat's root*. `bathGapReport`'s mat-in-front-
  of-tub row: `blocked` → **standable 1.73 m** against the ruler's ≥ 0.55.
- **Bathroom brightness**, the four played-room views at `desk-pen` t = 1.2:
  **bathroom 149, entry 128, kitchen 83, desk 88** — median 108. The room is
  now 1.38× the flat's median instead of the flat's dark corner, and the
  `bath-luma-in-band` band is set around that: a white tiled room with porcelain
  in it reads bright at a sane exposure, so the band is 0.7…1.5 × median with a
  90…200 absolute floor and ceiling. Turning the fill from 4.6 to 3.9 moved the
  room 158 → 152, i.e. the tile does most of the work; the fill only has to
  stop it being a cave.
- **Entry**: mean luma **128**, **4%** of the frame near-black (limits ≥ 70
  and ≤ 25%).
- New checks in `game/full.js`, **77 → 81**: `bath-clear-path` (route + floor,
  above), `entry-reads-lit`, `front-door-shut-and-found` (the leaf is
  `LEAF_W` in the cased 1.02 m opening, walnut and lit on the entry camera,
  no walk rect past it — the front door stays sealed and unreachable),
  `bath-luma-in-band`. The three pixel checks render **once per page** and
  cache their numbers, the way `doorways-read-open` does: they measure static
  geometry and lights, and five renders per `selfTest` call starves the live
  loop under the stress suite. `npm run playtest:stress:full` now passes
  `--checks 81`.

**Everything else on this HEAD** (same machine, same run; `/tmp/opencode/suites.sh`
ran the whole matrix, logs kept per suite):

- `gate` **PASS** — and the four `*:planted` suites **FAIL on purpose, which is
  their PASS condition**: each injects a known fault and must exit 1 naming it.
  Their only reported problem is the planted one: `capture:planted` →
  `box-bottom-to-floor = 0.05`, `capture:full:planted` / `capture:slice:planted`
  / `capture:demo:planted` → `ending-text-exact = you did it! you win`. `gate`
  asserts exactly those five verdicts and passes them.
- `capture:full:determinism` **8/8 byte-identical**, `capture:full:weak`
  **81/81**, `capture:full:spots` 18 frames **84 draws**, `capture:full:patriot`
  6 frames **115 draws**, console clean on all.
- `playtest:bot:full` **10/10 distinct spots, score 10/10, phase win**, spawn→Bobo
  mean 5.00 m, console clean; `playtest:bot:patriot:full` **5/5** with the costumed
  find on find 3; `playtest:bot` (slice) **5/5**.
- `playtest:stress:full` **77 PASS / 0 FAIL**, and its live selfTest line reads
  "(81 checks) — all 81 green", so the new `--checks 81` is what ran;
  `playtest:stress` **72 PASS / 0 FAIL**.
- `check:mobile` **92 PASS / 0 FAIL**; `seed:coverage` unchanged in shape (every
  spot drawn, rarest `hall-chase.hall-door` 12.0% — the new entry furniture drew
  no new spot and removed none).
- Audio and music untouched and green: `audio:fullcheck` **23/23** (win line
  still 1.86 s, ending still "your did it! you wind"), `audio:democheck`,
  `audio:slicecheck`, `audio:selftest`, `audio:pagecheck`, `music:selftest`
  **29/29**, `music:check` **28/28**.
- The look baselines the slice and demo own are unbroken: `capture:style` **PASS
  (72 frames)**, `capture:slice` **51/51 checks at 98 draws**,
  `capture:slice:determinism` **8/8**, `capture:slice:weak` PASS, `capture:demo`
  **48 frames at 91 draws**, `capture:demo:determinism` **8/8** — none of those
  pages includes the flat. The capture tool's own scene is byte-identical too:
  `capture` / `capture:all` **144/144**, `capture:weak` PASS.
- `build`: dist/ stamped **59 files, 2.88 MB** (+2 over issue #61's 57:
  `game/full-entry.js`, `game/full-entry-mesh.js`), graph + assets + stamps
  verified.

**Not done / left on purpose.** The entry's console is a solid-top table with a
bowl on it — the flat has no keys, wallet or post to hang there, and inventing
props means inventing moments; the four ceiling bodies are emissive shapes
rather than light sources, because the flat is at the `realLights <= 6` cap and
the honest way to light five rooms with four fills is to place them where two
rooms share one. The bathroom keeps no door: the player who cannot be trapped
also cannot be locked in a bright one.

## 27. Issue #70 — partial hiding: Bobo behind the curtain (findable, always)

**Asked for (Brandon, 2026-11-16):** the finds are all "out in the open".
Give the flat hiding spots — Bobo (and the decoy) partly behind shower
curtains, plants, furniture — with one hard rule: a hidden cat must stay
*findable*, and the draw-call budget is what it is.

**The budget said zero, so it got zero.** The worst full-flat frame sits at
**149 of 150** draw calls, so a "hiding" feature that added even one curtain
panel or one leaf would blow the cap. The whole thing shipped as **data plus
two prop edits**: no new mesh is drawn for hiding anywhere. The edits are
re-cuts of geometry that already draws — the shower curtain's 15 folds now
bunch within `CURTAIN.clothX1` (−2.15) instead of spreading the rod's full
0.94 m (denser bellows = gathered, the rod still spans the whole rim), and
`big-plant`'s fronds grew 0.36 → 0.50 m with the same 26 leaves.

**What hides what** — measured in-page, on the shipped build, by the
`findable` check itself (`id / visible-ring / nearest vantage`):

| spot | behind | visible ring | vantage | before / note |
|---|---|---|---|---|
| `laundry-nap.bath-tub` (new) | `shower-curtain` | **5 %** | 1.14 m | unhidden tub cat: 38 % |
| `window-bird.n-window` | `big-plant` | 42 % | 0.90 m | unhidden: 59 % |
| `hall-chase.bath-mat` | `tub` | 29 % | 0.90 m | 0.55 m rim is the cover |
| `blanket-biscuits.dresser-gap` (new) | `dresser` | 28 % | 0.90 m | floor nook south of the dresser |
| `sink-sit.counter-return` | `counter-w` | 26 % | 0.90 m | loaf behind the run's west flank |
| `d-kitchen` (decoy) | `counter-w` | 24 % | 0.90 m | decoys may hide too — never Bobo's spot |

The centrepiece: the laundry nap moved **into the tub** for once — a `side`
nap on the well floor (new `tubWell` support, the `vanityTop` precedent in
`full-shell.js`), back to the gathered cloth. Five percent of everything a
player could stand and still be inside the flat can see that cat at all;
the find is the gap at the cloth's east end.

**"Hide" is data the build measures.** A spot gains `hide: '<prop>'`;
`HIDE_PROPS` gives each prop an axis-aligned box at its **true drawn
height** — `SIGHT_HEIGHTS` carries a row for all 38 `COLLIDERS` (a missing
row fails the check by name), the curtain box comes from the `CURTAIN`
constants and is not a collider (cloth is walk-through; the walking model
did not change anywhere). The engine's own LOS clips colliders at eye
height (1.05 m) for the AI; the new `findable` check raycasts the cat's aim
point over **true** tops plus the hide box, around a 24-point ring 2.2 m
out clipped to the flat's walkable rects. Fails-the-build, in order: a
hiding spot with no vantage at all ("partly hidden, never unfindable"); a
`hide` that hides nothing (≥ 50 % of the ring still sees the cat); more
than 25 % of the pool hiding (5/30 = 17 % today); fewer than 6 hiding spots
(existing). The shout itself needed no exemption code — `catUnderCrosshair`
only raycasts the two cat roots, so no prop can ever block a find.

**Rejected by measurement, on the record.** A coat-bench hide for
`d-entry`: the bench's true-height box changes no ring percentage — it is
simply too low to cover a sitting cat, so no `hide` was claimed. A hall-door
nook behind the console: that corner's blindness is walls, not furniture —
its unfindability predates the console and a hide there would have had to
be exempted rather than fixed. A bath-mat hide "behind the vanity": the
vanity is on the far wall — geometrically nonsense; the mat's honest cover
is the tub's flank. Growing the dresser and bench boxes to make better
numbers: rejected — boxes must equal what is drawn, which is why
`SIGHT_HEIGHTS` exists.

**The pool stayed legal.** `SPOTS` 28 → 30. `blanket-biscuits.dresser-gap`
is deliberately a `blanket-biscuits` spot, not `couch-loaf`: every spot of
that type is already a bedroom one, so the alternation `run-draw-legal`
polices (never six same-room catches in the ten) can never be forced. 2 000
seeded draws verified legal; both new spots land in ≈ 34 % of runs, far over
the `pool-coverage-over-random-seeds` floor. `capture:full:spots` and
`capture:full:patriot` stage named ids — every one still exists.

## 28. Issue #77 — the iPhone gets the whole screen, and a way to install it

**Asked for (Brandon, 2026-11-16):** play it on the iPhone with the game
filling the screen — no black band beside the notch, no Safari bar eating the
bottom — and a way to install it from the home screen so it opens like a
native game.

**iPhone Safari cannot be forced fullscreen; only the home screen can.**
`requestFullscreen()` on iOS Safari has no API — the honest fix is an
installable web app, so the issue became four pieces.

**Installable.** `manifest.webmanifest` at the site root: `start_url` the game
entry, `scope "."`, `display:fullscreen` plus `display_override` (Safari reads
one, Chrome the other), `orientation:landscape`, the existing dark
`#14181f` for theme and background, and `icons[]` covering 192, 512 and a
maskable 512. `game/full.html` carries the iOS half the manifest still needs
(`apple-touch-icon`, `apple-mobile-web-app-capable`, status-bar style). The
viewport meta already carried `viewport-fit=cover` (issue #25) — without it
`env(safe-area-inset-*)` reports zeros and the notch problem could not be
solved at all, so this issue leans on it. `tools/make-icons.mjs` (`npm run icons:make`) renders
`assets/logo/logo.svg` through headless Chrome exactly the way
`export-logo.mjs` does, then fails the build unless every PNG really measures
what the manifest claims, has opaque corners (a transparent icon turns black
on the home screen) and is not a flat fill; `maskable-512.png` carries the
mark at 60 % so no launcher circle clips the ears.

**Fullscreen.** The canvas was `100vh`, which on iOS is the *large* viewport —
Safari's bar sits on top of the bottom of it. Now it takes `100svh` after the
existing `100vh` (progressive: browsers that don't know `svh` keep the old
line) and `100dvh` stays for touch. All nineteen `env(safe-area-inset-*)`
uses — 15 in `game/full.html`, 4 in `game/title.css` — read through
`--safe-t/-r/-b/-l` custom properties declared once as
`env(safe-area-inset-*, 0px)` inside the existing `@supports` guard, so real
insets flow through unchanged and the values are also overridable, which is
what makes the third piece possible.

**Testable without a phone.** `?safe=notch` (test-only, read by one inline
head script) puts `html.safe-notch` on the document and the four properties
become 0 / 44 / 21 / 59 px — the real iPhone 15 landscape numbers. Headless
Chrome then gets a notch on demand and `check:mobile` scenario 14 measures
it: the canvas rect equals the viewport at 844×390, 932×430 and 667×375; the
left-edge pixel column is game picture rather than letterbox (screenshot strip
sampled in-page, pure-black count 0 of ~6 000); gear, stick, score and shout
stay clear of the inset and the home bar; the title card is padded past both
sides. `?safe=notch` is never in a capture URL, so no baseline can see it.

**The hint, and where it must not appear.** iPhone users get one line under
START — "For full screen: tap Share, then Add to Home Screen" — once, ever.
`game/title.js` shows it only on iOS touch that is not standalone and not
`?gate=off`; the tap dismisses without starting the game (the click stops
propagation before the card's handler) and writes a localStorage flag, with
an in-memory fallback where storage is blocked. The whole gate is
`display:none` under `?gate=off`, so nothing lands in a captured pixel; on
desktop, Android and a standalone install the element is never created at
all, which scenario 14 proves four ways round plus a counter wrapping
`requestFullscreen`: a browser tap asks exactly once (Android's behaviour,
unchanged), a standalone tap asks zero.

**Short pockets keep their promise.** The hint is a row inside a card that
`@media (max-height: 420px)` had already sized to fit a 360 px pocket exactly,
so it pushed `#build-stamp` out of the card — the same check #57 polices,
caught by scenario 13c. `body.install-hint` (set only when the hint exists)
trades the comfort note, the flavour line and 30 % of the logo/START size for
it. A non-iPhone pocket is untouched, byte for byte, and the card fits again
at 740×360 and at 844×390 with a notch.

**Numbers at this HEAD.** `check:mobile` **125 PASS / 0 FAIL**, every earlier
scenario still green. `capture:full` 546 frames, selfTest **82/82** every
frame, worst frame **149 of 150 draws** / 99 420 tris — unchanged — plus
`capture:full:determinism` **8/8 byte-identical** and weak-GPU PASS; slice
51/51 and demo 37/37, both with determinism 8/8; bots 10/10 to the exact
`your did it! you wind`; stress **77 PASS / 0 FAIL** at `--checks 82`; music
28/28; build 64 files / 2.94 MB with 116 stamped URLs and every
manifest icon present in `dist/`.

**One check fails, and it failed before this issue.** `audio:fullcheck` is
**22/23**: `aim-ray-hits-bobo` says the centre ray from `LC.aimAt('bobo')`
hits a wall/prop. Run the identical command on clean `origin/main`
(`0d83074`) it is **21/23** — both aim-ray rows fail there. Issue #70's
shower curtain legitimately blocks that *test helper's* ray; the player's
shout uses `catUnderCrosshair()`, which raycasts only the cat roots and is
provably unaffected. Left as #70's checker debt rather than quietly
loosened.

**What is emulation, not proof.** Headless Chrome cannot install anything.
The Add-to-Home-Screen sheet, `apple-mobile-web-app-*` chrome, a real
manifest install and a physical notch are unverified by every check here.
`docs/DEPLOY.md` carries the eight-point real-iPhone checklist (install,
chrome-free launch, edge-to-edge at both orientations' safe areas, the
hint's one-time behaviour, offline icon, no fullscreen ask, Android
regression, return visit) for the pass Brandon does on hardware.

## 29. Issue #69 — lookalike decor: a flat full of black-and-white almost-cats

**What the pass added.** Twenty-three pieces of black-and-white dressing —
ten framed abstracts, the cow-patch duvet, two patchwork cushions, a check
throw, a patchy bath mat, two striped towels, the black pot with white
accents, four B/W books and a storage box (the one list: docs/LEVEL_LAYOUT.md,
data: `game/full-decor.js`, drawn: `game/full-decor-mesh.js`).

**How it plays.** The first-glance double-take is real where the pieces are
big and low: the duvet panel from the bedroom diorama, the cushion pair from
the bed-foot approach, the folded throw from the pillow line — each holds
"is that Bobo?" for about a frame before the pattern resolves as cloth. The
wall art never reads as a cat from the room's standing distances (blots and
rings stay blots at 3 m), which is the right balance: the doubt belongs to
floor level where the find happens, and the second frame always resolves it.
Pointing at any of it does nothing — no hover, no reticle softening, no
"DAG!" — because the whole collection is one untagged mesh the aim code never
sees. No piece blocks or crowds a cat spot: the 0.21 m capsule rule and the
re-run of the findable sight maths (`decor-findable-clear`) cover every spot,
every hiding prop, with all 23 boxes added as blockers.

**What it cost.** One draw call, in every frame — measured per-frame across
all 546 capture frames, each came out at exactly the no-decor number +1; the
worst frame (win/overview) is 149 → **150 of 150**, +320 triangles, one 64 Ki
canvas atlas. The cap is not exceeded, but the margin is now zero: **any
future full-flat geometry must come with a draw it removes.** Textures: one
new 256 px canvas (budget check `decor-budget`); the slice and the talking
demo came back byte-identical (`capture:slice`, `capture:demo` re-run against
a pre-change build and diffed by sha256).

**Bugs the checks caught before any pixels did.** The fifth living artwork
wanted the east pier; the kitchen door's PARKED LEAF lies along that same
plaster (z 0.38 … 1.24) — `decor-off-openings` found it against the leaf
boxes and the piece moved to the south wall (`art-living-dine`). Same check's
collider clause needed one honest exemption (`DECOR_HOSTS.restOn`): a duvet
lies ON the bed, and the bed's own collider is the bed.

**Suites.** `capture:full` 87/87 PASS (five new `decor-*` checks); worst
frame 150 ≤ 150; `capture:full:determinism` 8/8 byte-identical (the atlas is
seeded `hash1`-painted once at boot, never in the render path); `gate` PASS;
slice + demo byte-identical; `check:mobile` PASS; bots 10/10 with the ending
text exact; `playtest:stress:full` at `--checks 87`; audio 23/23;
`capture:full:weak` clean under swiftshader; `build` stamps 124 URLs.

## 30. Issue #81 — a wider hall and the flat's first real dining room

**What the pass changed.** The hallway is the issue's own 2.40 m
(x −1.20 … 1.20 — `hall-width-in-band` reads it off the shell's ROOMS rect),
paid for 0.30 m at a time by the bathroom (now 1.98 × 2.98 = 5.90 m²) and the
entry's old west band. And the flat has a **dining room** where the void east
of the entry used to be: x 2.60 … 5.52, z 0.80 … 4.40, **9.99 m² usable**,
with the issue's furniture at the issue's sizes — round table Ø 1.05 with
its top at 0.75, four chairs (seat 0.45, back 0.86) on a 0.55 m ring with
their seats tucked 0.20 under the rim, an emissive-only pendant on the
table's centre, a 1.28 × 0.40 sideboard back to the new south wall under a
new south window (sill 0.90 — the kitchen's under-window precedent), and
framed art on the window's east pier. Two cased doors: 0.90 into the
kitchen's south wall, 1.22 into the living room's south-east corner. Net
interior is now **79.59 m²**.

**How it plays.** The corridor stops reading like one: two bodies pass
without either turning sideways, the console-and-print end view survives the
wider room, and the runner no longer walls the skirting in. The dining room
is reachable from all eleven spawns (`dining-reachable-from-every-spawn`)
through the wide arm off the kitchen or the corner door by the living-room
rug, and Bobo lives there now: `sink-sit.table` sits the near card of the
ring and `hall-chase.dining` loafs in the wide arm's north-east corner —
both yaws measured off `bestApproach`, the `cats-face-the-room` vantage,
not eyeballed. Walking the kitchen door's lane and looking west you see the
table lamp lit against the afternoon and the four chair backs in a ring:
the shot the issue was written for.

**The honest trade-offs.** (1) The entry ships **1.40 × 1.68** against the
issue's "≥ 1.4 × 1.7" ask: its south face is the exterior band's inner face
at z 3.90 and its north line is the hallway doorway's jamb — the extra 2 cm
of depth would have been plaster, and the 0.86 leaf's room (case 1.32 … 2.34,
leaf 1.40 … 2.26) still takes the coat bench AND the 1.20 m turning circle.
(2) The bathroom's toilet slid 0.30 m west to hold the #67 clear-path rows
in the narrowed room; the only plaster left on that north wall then made
the towel bar run over the tank — 36 cm above the lid, which is exactly
where a small bathroom puts a second bar. (3) The kitchen bar + stools
rode 0.44 m east (and the bar shortened 0.20) because the kitchen→dining
doorway stood on its old west end. (4) The hall+entry fill light moved to
hang under the entry pendant: at the widened hall the old point grazed the
door leaf's face and the `front-door-shut-and-found` pixel probe read it as
a black hole; one metre north of the door it exists to light, it reads.

**What it cost.** Two new merged statics (the dining room's plaster and its
furniture bucket) plus the room's details — and the flat came out **under**
its old worst frame: capture:full's worst frame is **149 of 150 draws** —
the heaviest frame in the flat is the new dining view itself (sink-sit,
t=0, 98,948 tris) — with the win/overview next at 148 / 100,204 tris;
#69's was 150 with zero margin, so the cap has a draw of room again. The
pendant is emissive, so `realLights` stays at 6. Zero new lights, zero new
textures; slice, talking demo and every earlier suite stay byte-identical.

**Bugs the checks caught before any pixels did.** The dining chair ring at
the loose 0.62 m radius the first cut used left a 0.24 m centre channel —
`dining-walkways` (row 58's own maths) failed it by name, and the tuck
under the rim is what bought the aisle back. And the `decor-off-openings`
collider clause talked the table vase off the `sink-sit.table` capsule
before it was ever placed.

**One bug the stress harness caught in the checker itself.** The full stress
suite boots at 800×500 — a smaller canvas than the capture's 1280×720 — and on
the first full chain it failed `doorways-read-open` on `door-living-hall`
("hole pixel is leaf-coloured, distance 36") while every capture run passed
91/91 on the same build. The flat was fine; the probe was not. `readPatch`
mapped NDC to pixels with `(1 - ndc.y) / 2` — top-left canvas arithmetic —
while `gl.readPixels` counts rows from the **bottom** of the framebuffer:
every pixel `doorways-read-open` and the `front-door-shut-and-found` probe
measured was the vertically mirrored one. Latent since issue #65 wrote the
helper, because on the old geometry the mirrored row happened to be a
plausible surface for all three doors and the leaf; #81's widened hall and
moved fill shifted what the mirror saw, and at the stress resolution the
mirrored hall floor landed within 36 RGB units of the walnut leaf's face —
a false positive. Corrected to `(ndc.y + 1) / 2` at both sites, 91/91 passes
at 800×500 *and* 1280×720. The fix is read-only — it changes no render, and
`capture:full:determinism` is re-proved on the fixed HEAD. Honest footnote:
with the true mapping the probe **fails origin/main's `door-living-kitchen`
hole** — the ray clause passes, but the kitchen floor beyond that opening
shares the walnut leaf's palette and lands distance 7 off the parked leaf's
face colour; the mirror had been hiding the collision all along. #81 cases
that opening, so this branch's three live doorways all read open for real.
If a future leaf ever stands in front of same-palette oak again, the honest
lever is the leaf's face colour or a per-door threshold with a written
reason — not the mapping.

**Where the harnesses learned #70's rule.** With the pool at 31, the stress
run's seed-11 round 3 now draws `laundry-nap.bath-tub` — and the stress aim
rule, written before #70, demands a props-visible centre ray the drawn curtain
legitimately never grants from any vantage within 3.4 m (dense sweep: zero).
#70's own contract is that cover hides the EYE, never the SHOUT: the
crosshair find-ray (cat meshes only) must land, and `findable` polices it at
selfTest. Both harnesses now apply each rule to its kind of spot — hidden
ones proven through `aimProbe()` where `aimAt` parks the player, exactly how a
real find works — including the hidden DECOY spot (`d-kitchen`) and the audio
tool's aim lines, which have been a 22/23-or-23/23 coin flip on live random
seeds since #66 (a hidden draw trips the visual rule on `main` too).
`LC.spot` grew a `hide` field and decoy-id resolution so the tools read the
level's row instead of re-typing it. And the shout-at-nothing check waits for
the pulse to paint (it rides the render loop) instead of betting a fixed
120 ms, which a loaded swiftshader frame can outlast.

**Suites.** `capture:full` 546 frames **91/91 PASS** (four new issue-#81
checks, three new `furniture-real-scale` rows, 87 → 91); worst frame 149 ≤
150; `capture:full:determinism` 8/8 byte-identical; planted-fault runs
still fail by name; `gate` PASS; slice + demo byte-identical;
`check:mobile` PASS; bots 10/10 with the ending text exact;
`playtest:stress:full` at `--checks 91`; audio/music PASS;
`capture:full:weak` clean under swiftshader; `build` stamps every URL.
