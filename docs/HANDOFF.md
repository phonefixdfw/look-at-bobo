# Look at Bobo — Handoff (build-a-game)

> **Step 2 built — awaiting Brandon's review.** Step 1 (story/characters/locations) stays **LOCKED**; its docs still carry a "Step 1 only … no Step 2 work started" header, which now reads as history: Step 2 (the visual debugging tool) was built on its own branch and PR as requested, and nothing later was started. No art style work, no apartment modelling beyond a trivial placeholder scene, no audio, no image generation, no paid services, nothing deployed. Real Bobo/apartment details not supplied by Brandon remain TBD and are never invented.

## 0. Quick start
1. Read `VISION.md` (root, approved by Brandon), this file, and `docs/CAPTURE.md` (the Step 2 tool + `window.LC` page contract).
2. Current step: **Step 2 — Visual debugging tool — ✅ built, awaiting review** (branch `codeden/build-a-game-step-2-visual-debugging-4cab`, **PR #4** open to `main`, **not merged**: https://github.com/phonefixdfw/look-at-bobo/pull/4). Do not start Step 3 until explicitly asked.
3. Questions Q1–Q10 are resolved for Step 1: Q1/Q2 answered directly by Brandon; Q3–Q10 accepted as **provisional defaults**. Real Bobo/apartment details not supplied remain TBD and must never be invented.
4. To use the tool: `npm install && npm run capture` (frames + contact sheet in `captures/`) and `npm run gate` (proves the tool catches planted mistakes). Needs Chrome or Edge already installed.

## 1. Pipeline

| # | Step | Status | Notes |
|---|---|---|---|
| 1 | Story, characters and locations | ✅ **LOCKED** | `docs/STORY.md`, `docs/CHARACTERS.md`, `docs/LOCATIONS.md` are locked at the approved vision level. Q1/Q2 answered by Brandon; Q3–Q10 accepted as provisional defaults. Unknown real-Bobo/apartment details remain TBD. Step 2 not started. |
| 2 | Visual debugging tool | ✅ **built — awaiting review** | Done per build-a-game step 2: `tools/capture.mjs` + the `window.LC` page contract + `tools/gate.mjs`. See `docs/CAPTURE.md`. Test scene captures cleanly (36-frame default run: PASS, console clean, budget PASS) and planted faults are caught (5 faults, each named by the check that caught it, exit code 1). No art-style work, trivial placeholder scene only. Not merged. |
| 3 | Art style and design system | ⏳ | Not started. Next step when Brandon asks: three code-built mockups of the same trivial test arrangement in three different looks, captured with the Step 2 tool into one comparison sheet, then `docs/DESIGN_SYSTEM.md` after Brandon picks a style. Palette lint / contrast / colour-blind / photosensitivity checks get added to the tool there. |
| 4 | Voices, sound and music | ⏳ | Not started. **Only step that costs money; requires Brandon's explicit approval before any spend.** |
| 5 | Talking-character demo | ⏳ | Not started. |
| 6 | Vertical slice | ⏳ | Not started. |
| 7 | Play the slice | ⏳ | Not started. |
| 8 | The rest of the game | ⏳ | Not started. |
| 9 | Polish | ⏳ | Not started. |
| 10 | Deploy | ⏳ | Not started. Host chosen by Brandon. |

**Current step:** 2 — **built, awaiting review; Step 1 remains LOCKED.** **What's happening right now:** the Step 2 tool, its test scene and its own self-check (`npm run gate`) are complete on branch `codeden/build-a-game-step-2-visual-debugging-4cab` with **PR #4** open to `main` (not merged, evidence attached: a clean 36-frame contact sheet and a caught planted fault). Step 3 (art style and design system) is **not started** and waits for an explicit request.

## 2. Decisions log

| Date | Decision | Who | Why |
|---|---|---|---|
| 2026-11-14 | Vision approved; proceed with build-a-game Step 1 only for "Look at Bobo" | Brandon (via request) | User direction for this session |
| 2026-11-14 | Camera: first-person; Length: ~10–15 min (guess); Controls: keyboard+mouse; Tone: joyful/silly, no timers/failure; Platform: desktop browser; 10 catches/end text fixed as `your did it! you wind` | Vision / Brandon-approved | Recorded in `VISION.md` |
| 2026-11-14 | No real-Bobo facts invented; unknowns recorded as questions with provisional defaults | Agent (Step 1 rule) | Vision principle: "Nothing is invented about the real Bobo. His looks and habits come from his owner." |
| 2026-11-14 | Did not modify/override `VISION.md` or merge PR #2; noted PR #2 content in report | Agent | User instruction: mention any conflict rather than overriding it |
| 2026-11-14 | Q1 moments: use "normal cat stuff" (lounging on furniture, rolling over, stretching, napping, curling up, etc.) as generic placeholders; no claims about Bobo's specific real habits; Bobo-specific habits remain not specified | Brandon (via project manager) | Answer to Step 1 question Q1 |
| 2026-11-14 | Q2 order: RANDOM moments each playthrough, no repeats within a run, still exactly 10 points; layout/respawn logic must support any moment from any valid location | Brandon (via project manager) | Answer to Step 1 question Q2 |
| 2026-11-14 | Q3–Q5 apartment defaults accepted: simple modern one-bedroom placeholder loop; props placed in rooms implied by generic placeholder moments; window with view outside and optional balcony access sufficient for bird-looking | Brandon (via project manager) | Accepted provisional defaults; real apartment layout/furniture/prop locations remain TBD and are never invented |
| 2026-11-14 | Q6–Q8 Bobo references/movement/sounds defaults accepted: generic cute-cat motion placeholders; minimal/optional cute vocalizations only where needed, "LOOK AT BOBO!" remains required voiced line; proceed from written vision description if no photos/videos are supplied | Brandon (via project manager) | Accepted provisional defaults; real Bobo movement/sounds/references remain TBD and are never invented |
| 2026-11-14 | Q9–Q10 scope/never-guess defaults accepted: 10 moments / ~10–15 minutes; no extra never-guess list beyond standing rule that real Bobo/apartment specifics are not invented and remain TBD until supplied | Brandon (via project manager) | Accepted provisional defaults for Step 1 lock |
| 2026-11-14 | Built Step 2 only (capture tool + `window.LC` contract + trivial placeholder test scene); Step 3 not started | Brandon (via request) | Explicit brief for this session |
| 2026-11-14 | Vendored Three.js r187 as plain files in `vendor/` (committed, sha256 manifest, refreshed by `npm run vendor`) instead of a build step or CDN | Agent (autonomous) | Game must deploy to Brandon's own server as plain static files; no bundler, no CDN, readable provenance. MIT licence kept |
| 2026-11-14 | Fault injection lives in the URL (`?plant=lift\|sink\|jam\|text\|stats`), never in the scene files | Agent (autonomous) | The committed scene stays correct, and "the gate actually fails loudly" can be re-proved on demand (`npm run gate`) |
| 2026-11-14 | Budget counts are measured by hooking the WebGL context (`drawArrays`/`drawElements`/instanced variants/`bindFramebuffer`) per frame, not read from the page's `renderer.info` | Agent | Numbers the page reports about itself can only ever be as honest as the page. Three.js also assigns `renderer.render` per instance, so there is no prototype to wrap — the context is the only place below the page that can be counted |
| 2026-11-14 | `selfTest` measures numbers back out of the built geometry (Box3 + marker world positions) rather than restating the placement code; "tip touches box" was split into a touching check **and** a clipping check | Agent | A distance-only check cannot tell "touching" from "buried" — it reported PASS on a stick jammed into the box until the clipping check was added |
| 2026-11-14 | Every captured frame is pixel-probed (mean luma, spread, colour count) and a black/blown-out frame fails the run | Agent | A headless WebGL failure otherwise produces a plausible-looking report and a black PNG nobody notices |
| 2026-11-14 | `captures/` gitignored as scratch; keepable images get attached to a PR or copied somewhere permanent | Agent (build-a-game rule) | Captures are reproducible output, not source |
| 2026-11-14 | Moment ids in the test scene are kebab-case placeholders named after the ten generic moments in `docs/STORY.md` plus a `win` moment that carries the exact ending text `your did it! you wind` | Agent | Placeholders only — no claims about real Bobo habits; random-order compatibility is enforced by a `selfTest` check (shuffled visits vs declared order) |
| 2026-11-14 | `playwright-core` drives the already-installed Chrome/Edge (no browser download); `LC_CHROME` overrides the path | Agent (autonomous) | Step 2 rule: no downloads, and it keeps installs small |

## 3. Questions log (Q1–Q2 answered; Q3–Q10 accepted as provisional defaults)

**A. Bobo's habits / the 10 moments (answered)**
1. **Answered — moments:** Use **"normal cat stuff"**: lying on things, rolling over, lounging on furniture, stretching, napping, curling up, etc. Keep list generic; **no claims about Bobo's specific real habits**; Bobo-specific habits remain **not specified**.
2. **Answered — order:** **RANDOM** order each playthrough, **no repeats within a run**, still exactly **10 points**. Layout/respawn logic must support any moment from any valid location.

**B. Apartment layout and key furniture/props (accepted provisional defaults; real details remain TBD if not supplied)**
3. What is the **real apartment layout** (rooms and how they connect)? A rough sketch/photo/description is enough for Step 1.
   - **Accepted provisional default:** Simple modern one-bedroom: living area + kitchenette, bedroom, bathroom, short hallway, and one large window (balcony optional).
4. Where are the key pieces for the moments: **couch, bed, desk+keyboard, pen, window/balcony, sink (kitchen or bathroom?), cardboard box, laundry basket, blanket**?
   - **Accepted provisional default:** Place each prop in the room implied by the generic placeholder moments (couch in living area, bed/blanket/basket options in bedroom, desk in living/bedroom, sink in kitchen *or* bathroom — TBD), treated as provisional.
5. Is there a **balcony** Bobo looks out from, or a **window** only? Which direction/view context matters (bird outside)?
   - **Accepted provisional default:** A window with a view outside (balcony access optional) sufficient for "staring at a bird".

**C. Bobo's movement, sounds, and references (accepted provisional defaults; real details remain TBD if not supplied)**
6. How does Bobo **move and behave** in these moments (posture, tail/ears, speed, transitions)? Any signature mannerisms?
   - **Accepted provisional default:** Generic cute cat motion as placeholders, refined once you describe or show references.
7. What **sounds** does Bobo make (meow/chirp/purr/silent) that we should plan for? (No audio will be made now; Step 4 needs approval.)
   - **Accepted provisional default:** Assume minimal/optional cute vocalizations TBD; keep "LOOK AT BOBO!" as the only required voiced line per vision.
8. Can you share **reference photos/videos** of Bobo (markings, face/eyes, body, typical poses) for later art steps?
   - **Accepted provisional default:** Proceed with the written description from vision (15 lb, mostly black, white feet/bib/muzzle/forehead dash, yellow-green eyes) until references are provided.

**D. Scope confirmations (accepted provisional defaults)**
9. Confirm **length feel** (~10–15 minutes) and that the placeholder moment count (10) is right?
   - **Accepted provisional default:** Yes, 10 moments / ~10–15 minutes as in vision.
10. Any other must-have details about the real Bobo or apartment that should never be guessed?
   - **Accepted provisional default:** None beyond the standing never-guess rule: real Bobo/apartment specifics are never invented; if not supplied, they remain TBD.

## 4. Demos (never delete; how to open each)
| Demo | How to open | Files |
|---|---|---|
| Capture test scene (Step 2) | `npm install` then `npm run serve` → **http://127.0.0.1:8123/tools/testscene.html**. Add `?plant=lift`, `?plant=sink`, `?plant=jam`, `?plant=text` or `?plant=stats` to see a deliberately planted mistake (the on-screen label shows which). | `tools/testscene.html`, `tools/testscene/testscene.js`, `vendor/three/` |
| Contact sheet from a capture | `npm run capture`, then open `captures/testscene/_contact-sheet.png`, or serve it: **http://127.0.0.1:8123/captures/testscene/_contact-sheet.html** (36 frames, labelled, failures in red). | `captures/testscene/` (scratch, gitignored) |
| Tool self-check | `npm run gate` — clean scene must PASS, five planted faults must FAIL with whatever caught them named. | `tools/gate.mjs`, `captures/gate/` |
| *(Step 1 was documentation only — no demo)* | — | `docs/STORY.md`, `docs/CHARACTERS.md`, `docs/LOCATIONS.md` |

## 5. Audio and credits
- Credit ceiling: not set. Spent: 0. Real rate measured: n/a.
- **Step 4 (voices, including "LOOK AT BOBO!") is the only step that costs money and will only happen after Brandon explicitly approves the cost/plan.** No paid services used in Step 1.
- No paid services used in Step 2 either. Dev-only npm packages: `playwright-core` (drives the already-installed Chrome) and `three` (copied into `vendor/`). Nothing at runtime is fetched from a CDN.

## 6. PR #2 / vision note
- Root `VISION.md` (merged on main) was read first and treated as the approved source.
- Open PR #2 (`Update the project vision`, branch `codeden/vision`, adds `.codeden/VISION.md`) was checked: its content is substantively the same as root `VISION.md` with minor formatting/wording differences (e.g. moment separators and a parenthetical note on length). **No substantive conflict identified; nothing overridden.** If PR #2 is intended to supersede/relocate the vision, reconcile after merge/review.
- Step 2's own work is **PR #4** (this branch → `main`), open and unmerged, with the clean and planted contact sheets attached as evidence.

## 7. Step 2 result (measured) and next steps

### What Step 2 built
| File | Role |
|---|---|
| `tools/capture.mjs` | jump to any moment/time/view, render one frame, screenshot it, measure it; writes PNGs + `_contact-sheet.png` + `_contact-sheet.html` + `report.json`; exits non-zero on any failure |
| `tools/testscene.html`, `tools/testscene/testscene.js` | the reference implementation of the `window.LC` page contract on a trivial placeholder scene (floor, box, leaning stick, a capsule standing in for Bobo, a clock hand) — 12 placeholder moments, 4 views, a 6 s loop |
| `tools/gate.mjs` | the tool's own self-check: 1 clean run must PASS, 5 planted faults must FAIL with whatever caught them named (`npm run gate`) |
| `tools/serve.mjs`, `tools/sync-vendor.mjs`, `vendor/three/` | plain static server; pinned-Three.js sync + sha256 manifest; vendored Three.js r187 (MIT) |
| `docs/CAPTURE.md` | the contract, usage, budget, checks, fault plants, and what later steps add here |

### Measured on this machine (Node 24.22, Google Chrome 157 headless, three r187)
- **Default run** (`npm run capture`: 4 moments × 3 times × 3 views = 36 frames): **PASS** in ~6 s; console clean; **15/15** `selfTest` checks; budget PASS (worst frame: `drawCalls 10`, `triangles 1434`, `passes 1`, `shadowLights 1`, `realLights 1`, all counted at the WebGL context, not taken from the page); mean luma 111–131 across frames.
- **Full sweep** (`npm run capture:all`: all 12 moments × 4 views × 3 times = 144 frames) with `--determinism`: **144/144 frames byte-identical on re-render**, PASS in ~23 s. A capture at t = 2.4 s is the same picture every time.
- **Weak-laptop smoke test** (`npm run capture:weak`, `--gpu swiftshader`, CPU): PASS; the CPU cost per frame came out consistently higher than the default path (~0.09–0.11 ms vs ~0.03–0.07 ms over repeat runs). Headless rAF caps near 60 fps whatever the machine, so ms/frame plus the budget counts are the numbers that mean something.
- **Planted faults, each caught** (exit code 1, the catcher named): box floated 5 cm → `box-bottom-to-floor = 0.05 (limit ±0.001 m)`; box sunk 2 cm → `-0.02`; stick jammed into the box → `stick-no-box-clipping = 0.0398 (limit 0 m)`; ending text "fixed" to `you did it! you win` → `ending-text-exact`; a scene claiming 1 draw call for a 10-draw frame → `stats-understated`, caught by the tool's own WebGL count rather than by anything the page said.
- **Two real gaps this exercise found, in the tool rather than in the scene:**
  1. a distance-only "tip touches box" check reported PASS on a stick buried 10 cm inside the box (inside a box, distance to its surface is 0). A separate clipping check now covers it, and `?plant=jam` proves that check bites;
  2. the first version read the budget numbers out of `renderer.info` on the page's say-so, and reported `passes: 0` forever — a number that could never fail. The counts now come from hooked WebGL calls (`drawArrays`/`drawElements`/instanced/`bindFramebuffer`) measured per frame, so the page can be checked against them and understating is a failure. `passes`, `shadowLights` and `realLights` stay declarations (they describe intent, not GPU work), but the measured render-target count now sits beside them in `report.json` so a wrong declaration is visible; it becomes a hard check when post-processing arrives in Step 3+.
- Random-order compatibility is enforced, not assumed: `moment-order-independent` visits all 12 moments twice (declared order vs a seeded shuffle) and compares poses to ≤1e-9, and `seek-no-unseeded-random` counts any `Math.random`/`Date.now` inside the seek path.

### Next step — Step 3: art style and design system (**not started, waits for Brandon**)
Three code-built mockups of the same simple arrangement in three different looks, each exposing `window.LC`, captured with this tool into one comparison sheet; Brandon picks a style; then `docs/DESIGN_SYSTEM.md`, plus palette-lint / text-contrast / colour-blind / photosensitivity checks added to the tool. Bobo himself and the real apartment stay TBD until Brandon supplies references — Step 3 works from the written description in `VISION.md`/`docs/CHARACTERS.md` unless photos arrive.

### Still standing from Step 1
- **Step 1 is LOCKED.** Story, characters and locations stay as approved; real Bobo/apartment specifics are never invented and stay TBD until Brandon supplies them.
- Step 4 (voices) is the only money step and needs an explicit yes with a cost shown first. Nothing is ever deployed without Brandon (Step 10).

### Open items / questions for Brandon (nothing blocks Step 3)
1. `AGENTS.md` was never created (Step 1 shipped `VISION.md` + the three docs only). It is the rulebook/index the build-a-game process loads every session — want a short one, drafted from `VISION.md` principles + this file, before Step 3?
2. Does `lookatbobo.getluckysocial.com` serve plain static files (ES modules + import maps, `.wasm`/`.png` mime types)? The tool assumes yes, which is how everything here is built.
3. The moment ids in the test scene are kebab-case placeholders (`lounging-couch`, `cardboard-box`, …). Fine as internal ids, or do you want different names?
4. Anything you want the tool to check numerically that is not on the list in `docs/CAPTURE.md` yet — it is cheap to add now and useful in every later step.
