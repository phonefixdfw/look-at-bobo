# Look at Bobo — Handoff (build-a-game)

> **Step 4 prepared, spend blocked on the API key.** Step 1 (story/characters/locations) stays **LOCKED**. Step 3 is built on its own branch (PR #6, **open, unmerged as of this step**); this Step 4 branch therefore **starts from `origin/codeden/build-a-game-step-3-art-style-59a1`, not `main`** — see §6. Step 4 delivered everything that can exist without a key: the cost-guarded ElevenLabs tool (`tools/gen-audio.mjs` + `tools/audio/tool-selftest.mjs`, 23/23 checks against a local stub), the casting + cost plan (`docs/VOICES.md`), the manifest of exactly the three approved lines, and the voice-test page (`tools/audio/voice-test.html`). **No audio has been generated and no money spent** — `ELEVENLABS_API_KEY` is not visible in the environment or a gitignored `.env` (verified presence-only 2026-11-14); see `docs/VOICES.md` "Getting unblocked". Real Bobo/apartment details not supplied by Brandon remain TBD and are never invented.

## 0. Quick start
1. Read `VISION.md` (root, approved by Brandon), this file, `docs/CAPTURE.md` (the Step 2 tool + `window.LC` page contract), `docs/ART_STYLE.md` (the Step 3 design system — every later scene copies from it) and `docs/VOICES.md` (the Step 4 casting, cost plan and spend guardrails).
2. Current step: **Step 4 — Voices: prepared, 0 taken, $0 spent; blocked on the API key** (branch based on the open Step 3 branch `codeden/build-a-game-step-3-art-style-59a1`, PR #6, per the brief — do not rebase onto `main` until PR #6 merges). Steps 1–2 and the decoy-cat docs are merged to `main` (PRs #3, #4, #5). To finish Step 4 when the key is available: `npm run audio:dry` (estimate), `npm run audio:buy`, play all takes on the voice-test page, update `docs/VOICES.md` + §5 here.
3. Questions Q1–Q10 are resolved for Step 1: Q1/Q2 answered directly by Brandon; Q3–Q10 accepted as **provisional defaults**. Real Bobo/apartment details not supplied remain TBD and must never be invented. Step 4 added questions V1–V4 (casting, win-line voicing/pronunciation, DAG flavour) in `docs/VOICES.md`, all with suggested defaults.
4. To use the tool: `npm install && npm run capture` (frames + contact sheet in `captures/`) and `npm run gate` (proves the tool catches planted mistakes). Needs Chrome or Edge already installed. Audio tooling: `npm run audio:dry` / `audio:status` / `audio:selftest` (all free, no key needed).

## 1. Pipeline

| # | Step | Status | Notes |
|---|---|---|---|
| 1 | Story, characters and locations | ✅ **LOCKED** | `docs/STORY.md`, `docs/CHARACTERS.md`, `docs/LOCATIONS.md` are locked at the approved vision level. Q1/Q2 answered by Brandon; Q3–Q10 accepted as provisional defaults. Unknown real-Bobo/apartment details remain TBD. Step 2 not started. |
| 2 | Visual debugging tool | ✅ **merged (PR #4)** | Done per build-a-game step 2: `tools/capture.mjs` + the `window.LC` page contract + `tools/gate.mjs`. See `docs/CAPTURE.md`. Merged into `main` and used by every step since. |
| 3 | Art style and design system | ✅ **built (PR #6 open, unmerged)** | **One style built deeply instead of three mockups** (the brief pre-pinned the look from `VISION.md`; deviation recorded in `docs/ART_STYLE.md` §1). "Sunny Room, Soft Fur": `docs/ART_STYLE.md` + working reference scene `design/style-test.html` (`npm run capture:style`: 72 frames, 36/36 checks each, budget 89 draws / 101,636 tris). Includes Bobo + decoy from one parametric builder with measurable tells, and the exact-string HUD. Palette-lint / colour-blind / photosensitivity probes deferred to Step 6. The Step 4 branch is based on this branch (not `main`) so nothing conflicts when #6 merges. |
| 4 | Voices, sound and music | 🟡 **prepared — spend blocked on the API key** | Everything that exists without a key: `tools/gen-audio.mjs` (the one cost-guarded ElevenLabs client — dry-run by default, `--max-credits` + per-run/per-take caps + 2,000-credit project ceiling, content-hash "never pay twice" lock, ledger measuring the **real** rate per run, exact-string guard, key redaction — all proven by `npm run audio:selftest`, **23/23**, against a local stub server, zero spend). Manifest = exactly the 3 approved lines × 2 takes (`tools/audio/manifest/step4.json`). Casting + cost plan in `docs/VOICES.md` (150 chars ≈ ~150 credits ≈ ~$0.012 at published rates). Audition/voice-test page `tools/audio/voice-test.html`. **Spend so far: $0.00 — `ELEVENLABS_API_KEY` is not present in the environment nor in a gitignored `.env` anywhere the tool reads (checked presence-only 2026-11-14); per the issue, work stopped before any paid call.** |
| 5 | Talking-character demo | ⏳ | Not started. |
| 6 | Vertical slice | ⏳ | Not started. |
| 7 | Play the slice | ⏳ | Not started. |
| 8 | The rest of the game | ⏳ | Not started. |
| 9 | Polish | ⏳ | Not started. |
| 10 | Deploy | ⏳ | Not started. Host chosen by Brandon. |

**Current step:** 3 — **built, awaiting review; Step 1 remains LOCKED.** **What's happening right now:** the Step 3 style test scene, `docs/ART_STYLE.md` and the doc housekeeping are complete on branch `codeden/build-a-game-step-3-art-style-59a1` with a PR open to `main` (not merged, evidence attached: the 72-frame contact sheet and caught planted faults). Step 4 (voices/sound/music — the only money step) is **not started** and waits for Brandon's explicit go-ahead **with a cost shown first**.

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
| 2026-11-14 | Step 3 branch started from main **and merged the then-open decoy-cat docs branch (PR #5)** so the decoy design was available; PR #5 then merged to main during Step 3 and main was merged back in — content identical either way | Agent | Brief said don't assume decoy docs are on main; they became on main mid-work. Recorded so the history reads honestly |
| 2026-11-14 | Step 3 built **one** style deeply ("Sunny Room, Soft Fur") instead of the skill's three-mockup comparison | Agent (autonomous, flagged) | The brief pre-pinned the look from `VISION.md` (realistically-lit apartment + softly stylized fur-shaded cats, in code); three shallow variants would have re-litigated a decided question. Deviation recorded in `docs/ART_STYLE.md` §1; veto is cheap (one `TOKENS` object + one lighting rig) |
| 2026-11-14 | Markings are SDF **rules painted into vertex colours** (head rules in head space, body rules in cat-root space); both cats come from **one parametric builder** — the difference is which rules switch on and root scale | Agent (autonomous) | Lets selfTest *measure* the tells ("is the dash white and ≥20 px at 2.5 m?", "decoy dash = 0") instead of trusting painted geometry; a shared builder is how "reads similarly at a glance — tells on second look" stays true as both cats change |
| 2026-11-14 | Bobo's forehead dash is **deliberately exaggerated** vs the photo (measured 71.9 mm; 26.9 px at 2.5 m, 11.2 px at 6 m at 1080p/fov-60) | Agent (autonomous) | The real thin dash disappears at search distance; the game's whole loop depends on the tell surviving across the room. Photo stays the record of the real marking (`docs/ART_STYLE.md` §5) |
| 2026-11-14 | Brandon's photo shows Bobo at ~10 lb → **markings modelled from the photo, body scaled to the current ~15 lb; the 15 lb shape is an assumption**, flagged in `docs/ART_STYLE.md` §6 + `docs/CHARACTERS.md`; more angles + a recent photo + a decoy photo requested | Agent | Never-invent rule: the only photo and the only weight spec disagree; both kept, disagreement surfaced instead of averaged away |
| 2026-11-14 | Decoy cat renders with Bobo's yellow-green eye token **as a flagged placeholder only** (his eye color was never supplied) | Agent (autonomous, flagged) | Scene can't run without an eye color; choice recorded as non-canonical in `docs/CHARACTERS.md` + `docs/ART_STYLE.md` §11 |
| 2026-11-14 | `.codeden/VISION.md` re-synced **byte-identical to root `VISION.md`** (it was the stale pre-decoy copy PR #2 left on main) | Agent | Housekeeping task from the brief: two divergent vision files is a trap for the next session; redundancy noted here rather than deleting a file Brandon's PR created |
| 2026-11-14 | The decoy's idle "breath" scales x/z only, never y | Agent | A belly that grew in y sank into the rug and the feet-on-surface checks (rightly) failed the frame — animation must not lie about contact |
| 2026-11-14 | **Voices:** one voice (the player) speaks all three lines; default **Liam**, alternatives Charlie + Jessica (audition on the voice-test page); model `eleven_multilingual_v2`; `mp3_44100_128` | Agent (suggested default, V1) | "player talks to themselves" — cheapest coherent set; premade voices, no cloning, no account work; full table in `docs/VOICES.md` |
| 2026-11-14 | **Voices:** the win line is **voiced** (placeholder; text-only or `eleven_flash_v2_5` are one-variable changes); "wind" is read as written ("wihnd"); DAG! generated with dialogue context (`previous_text`/`next_text`) | Agent (suggested defaults, V2/V4) | Issue #7 leaves it open; voicing shows the page can handle audio and the win is the moment a cheer belongs; context costs only ~9 extra chars, counted in the estimate |
| 2026-11-14 | **Voices:** money guards hard-coded — 2 takes/asset, 6 paid requests/run, 2,000-credit project ceiling (≈$0.16 at published rates; the issue's ceiling was $0.24), per-request content-hash lock so a paid generation is never bought twice, stale frozen generations cannot be charged, exact-string check of manifest texts against the issue, API key from env or a gitignored `.env` only, key never printed/logged (redacted), ledger measures the **real** credit rate per run | Agent + issue #7 rules | The spend rule is "never surprise Brandon"; every guard is proven by `npm run audio:selftest` (23/23) against a local stub, never against the paid API |
| 2026-11-14 | **Voices:** no post-processing (no EQ/compression/noise gate) on the raw takes | Agent | Step 4's job is casting; the mix is Step 9's |
| 2026-11-14 | **Voices:** `ELEVENLABS_API_KEY` was **not visible** in the environment nor in a gitignored `.env` in the worktree or main repo root (checked presence-only 2026-11-14) → **zero audio generated, $0.00 spent**; everything else in Step 4 was built | Agent (per brief) | The brief: if no key is visible there, stop paid work and report exactly that |

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
   - **Partially answered in Step 3:** one photo supplied, on file at `docs/reference/bobo-01.png` (shows ~10 lb). **Still wanted:** a recent ~15 lb photo, more angles (side/back/tail/belly), and a decoy-cat photo if one exists. Everything else still proceeds from the written description; nothing invented.

**D. Scope confirmations (accepted provisional defaults)**
9. Confirm **length feel** (~10–15 minutes) and that the placeholder moment count (10) is right?
   - **Accepted provisional default:** Yes, 10 moments / ~10–15 minutes as in vision.
10. Any other must-have details about the real Bobo or apartment that should never be guessed?
   - **Accepted provisional default:** None beyond the standing never-guess rule: real Bobo/apartment specifics are never invented; if not supplied, they remain TBD.

## 4. Demos (never delete; how to open each)
| Demo | How to open | Files |
|---|---|---|
| **Style test scene (Step 3)** — the look, Bobo + the decoy, HUD, celebration | `npm install` then `npm run serve` → **http://127.0.0.1:8123/design/style-test.html**. Add `?plant=dash`, `?plant=size`, `?plant=text` or `?plant=stats` to see a deliberately planted mistake the checks must catch. `npm run capture:style` renders all 72 frames. | `design/style-test.html`, `design/style-test/styletest.js`, `vendor/three/` |
| **Style contact sheet** | `npm run capture:style`, then open `captures/style-test/_contact-sheet.png` or serve it: **http://127.0.0.1:8123/captures/style-test/_contact-sheet.html** (72 frames labelled, failures in red). | `captures/style-test/` (scratch, gitignored) |
| Capture test scene (Step 2) | `npm install` then `npm run serve` → **http://127.0.0.1:8123/tools/testscene.html**. Add `?plant=lift`, `?plant=sink`, `?plant=jam`, `?plant=text` or `?plant=stats` to see a deliberately planted mistake (the on-screen label shows which). | `tools/testscene.html`, `tools/testscene/testscene.js`, `vendor/three/` |
| Contact sheet from a capture | `npm run capture`, then open `captures/testscene/_contact-sheet.png`, or serve it: **http://127.0.0.1:8123/captures/testscene/_contact-sheet.html** (36 frames, labelled, failures in red). | `captures/testscene/` (scratch, gitignored) |
| Tool self-check | `npm run gate` — clean scene must PASS, five planted faults must FAIL with whatever caught them named. | `tools/gate.mjs`, `captures/gate/` |
| **Voice test (Step 4)** — audition every take, compare casting | `npm install` (nothing more; no key needed to open it) then `npm run serve` → **http://127.0.0.1:8123/tools/audio/voice-test.html**. Before any generation it says so and shows what to run; after `npm run audio:buy` it plays every take (auto-demos casting A/B). `npm run audio:status` shows takes bought, spend, measured rate. | `tools/audio/voice-test.html`, `tools/gen-audio.mjs`, `tools/audio/manifest/step4.json`, `tools/audio/tool-selftest.mjs`, `audio/voices/` (generated) |
| *(Step 1 was documentation only — no demo)* | — | `docs/STORY.md`, `docs/CHARACTERS.md`, `docs/LOCATIONS.md` |

## 5. Audio and credits
- Credit ceiling: **2,000 credits for the project** (≈ $0.16 at ElevenLabs' published Starter rate; the issue's stated ceiling was $0.24 — deliberately lower). Spent: **$0.00 — zero takes bought**. Real rate measured: n/a until the first buy (the ledger measures it per run from balance deltas and flags deviation >20% from the published 1,000 chars ≈ $0.08).
- **Step 4 is prepared but nothing has been generated.** The full plan (casting, exact texts, per-line settings, cost ≈ 150 credits ≈ ~$0.012 for all 3 lines × 2 takes) is in [`docs/VOICES.md`](VOICES.md); the hard-capped tool is `tools/gen-audio.mjs` (`npm run audio:dry` to see the estimate, `audio:status` for spend, `audio:buy` — dry-run by default, caps enforced in code). `ELEVENLABS_API_KEY` was **not present** in the environment nor in a gitignored `.env` in the worktree or main repo root (checked presence-only 2026-11-14), so no paid call was made. No other paid services used in Steps 1–4. Dev-only npm packages: `playwright-core` (drives the already-installed Chrome) and `three` (copied into `vendor/`). Nothing at runtime is fetched from a CDN; no image generation was used for any asset — everything visual is built in code, including the procedural textures.

## 6. Vision files and the decoy-cat docs — reconciliation note
- Root `VISION.md` (on `main`) is the approved source and is decoy-aware (updated by PR #5, merged). `.codeden/VISION.md` (left by merged PR #2) was the stale **pre-decoy** copy; it is now re-synced **byte-identical to root `VISION.md`** so the next session can't read the wrong one. If the duplication ever bothers Brandon, deleting `.codeden/VISION.md` is safe — root is the source either way.
- **Decoy-cat decisions and open questions live in [`docs/DECOY_CAT.md`](DECOY_CAT.md)** (Brandon's 2026-11-14 design change: the 22 lb mostly-black decoy with white feet + white neck and **no forehead dash**; wrong-cat = gentle X + **"DAG!"** + −1 point, score floors at 0). It arrived via PR #5, which merged mid-Step-3. This is the HANDOFF link that file asked for.
- Step 2's tool work is merged as PR #4; Step 3's own work is this branch's PR (open, unmerged, evidence attached: the clean 72-frame contact sheet and caught planted faults).

## 7. Step results (measured) and next steps

### What Step 3 built (measured on this machine — Node 24.22, Chrome 157 headless, three r187)
| File | Role |
|---|---|
| `docs/ART_STYLE.md` | **the design system**: the chosen look ("Sunny Room, Soft Fur"), tokens, materials, lighting rules, the marking-rule system, cat proportions, HUD rules, do/don't, and the measured acceptance checklist |
| `design/style-test.html`, `design/style-test/styletest.js` | the reference implementation of the look — apartment slice + Bobo + decoy (one parametric builder) + HUD + win celebration; implements the `window.LC` contract; 36 selfTest checks measured back out of the geometry |
| `docs/reference/bobo-01.png` | Brandon's Bobo photo, now on file (shows ~10 lb; markings are canonical, body shape assumption flagged) |
| `package.json` `capture:style` script | `npm run capture:style` — the 72-frame style capture |

- **Full run:** 6 moments × 4 views × 3 times = **72/72 frames PASS**, 36/36 selfTest checks on every frame, console clean, ~1 min.
- **Budget:** worst frame **89 draw calls / 101,636 triangles** vs limits 150 / 150,000; 1 shadow light of 2 real lights; 1 pass (no post); 0.06–0.13 ms/frame.
- **The tells, measured:** Bobo dash 37 white verts / bib 484; decoy collar 241 with dash 0 and bib 0; dash 71.9 mm → **26.9 px @2.5 m, 11.2 px @6 m**; decoy **1.32× wide, 1.68× bulk** in the same pose; feet-on-support within −1e-9..0 m in every moment.
- **Contrast:** markings 14.1:1; worst HUD pair (coral/ink) 8.3:1 (AA 4.5:1).
- **Planted faults caught** (each exits 1, check named): `?plant=dash` → `bobo-dash-white` +3 more; `?plant=size` → `size-tell-width/volume`; `?plant=text` → `ending-text-exact`; `?plant=stats` → tool's own `stats-understated`.
- **Two design-system lessons the checks forced** (both now rules in `docs/ART_STYLE.md`): head-space vs root-space marking rules (the dash drifted with the head until the rules were evaluated per-space); the decoy's breath may only scale sideways (y-scaling sank the belly through the rug and the contact check correctly refused it).

### What Step 2 built (history — all merged as PR #4)
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

### What Step 4 built (prepared, **$0.00 spent — blocked on the API key not being visible**; Node 24.22)
| File | Role |
|---|---|
| `tools/gen-audio.mjs` | the one cost-guarded ElevenLabs client: `audio:dry` (default — estimates, zero spend), `audio:buy` (requires `--max-credits N`; enforces 2 takes/asset, 6 paid requests/run, 2,000-credit ceiling; content-hash lock = never pays twice; refuses frozen/stale generations; verifies every text byte-for-byte against the issue's strings; fetches live prices when a key is present; ledger with redacted key + measured real rate) |
| `tools/audio/manifest/step4.json` | exactly the three approved lines — `LOOK AT BOBO!`, `DAG!`, `your did it! you wind` — 2 takes each, per-line voice settings + DAG!'s dialogue context, machine-enforced caps |
| `tools/audio/tool-selftest.mjs` | `npm run audio:selftest` — **23/23 PASS** against a local stub API (no network, $0): buy path, cache never re-buys, caps refuse, stale frozen never charged, exact-string guard, key handling + redaction |
| `tools/audio/voice-test.html` | the audition/voice-test page — plays every take, casting A/B compare, ready/pending state; verified in a real browser both pre-generation ("0/6 takes ready") and against demo clips |
| `docs/VOICES.md` | the cast sheet: who says what and why, exact texts + pronunciation ("wihnd"), full cost table, guardrails, how to finish Step 4 when the key is available, open questions V1–V4 |

- **Spend: $0.00, 0 of 6 takes.** `ELEVENLABS_API_KEY` was not visible in the process environment nor in a gitignored `.env` in the worktree or the main repo root (presence-only check, 2026-11-14). Per the brief, paid work stopped before any API call; only the unauthenticated public voice/model catalogues were fetched (free) to verify the voice IDs.
- **Measured estimate for the whole purchase:** 6 requests, 150 billed chars ≈ **150 credits ≈ $0.012** at the published Starter rate (`eleven_multilingual_v2`, $0.08/1k chars, checked 2026-11-14) — the tool recomputes with live prices before any spend.
- To finish: put `ELEVENLABS_API_KEY` in the **main repo root `.env`** (gitignored; the tool finds it from worktrees), `npm run audio:dry` (estimate, no spend), then `npm run audio:buy -- --max-credits 2000`, then `npm run audio:status` and play everything on the voice-test page; update this §5 + `docs/VOICES.md` with the real numbers.

### Next step — Step 5: talking-character demo (**not started**)
The pipeline's next step: make Bobo a convincing talking/shelf companion for the ~2 min bonding scene — expressions, head/body idles, mouth-flap (and audio-timing data for dialogue scenes) on top of the Step 3 cat builder, captured through the Step 2 tool and matching `docs/ART_STYLE.md`. Step 5 needs no key or money. Step 4's leftovers ride along: the takes (once generated) get auditioned, and word-level timestamps can be produced from the bought audio at that point (deferred deliberately — the issue allows deferring).

### Still standing from Step 1
- **Step 1 is LOCKED.** Story, characters and locations stay as approved; real Bobo/apartment specifics are never invented and stay TBD until Brandon supplies them.
- Step 4 (voices) is the only money step and needs an explicit yes with a cost shown first. Nothing is ever deployed without Brandon (Step 10).

### Open items / questions for Brandon (Step 3 list — still open; Step 4's key question and casting questions V1–V4 live in `docs/VOICES.md`)
1. **Style verdict:** happy with "Sunny Room, Soft Fur" as the game's look (`docs/ART_STYLE.md`, screenshots on the Step 3 PR)? A veto is cheap — the scene reads one token object and one lighting rig.
2. **Photos** (replaces assumptions, never adds inventions): a recent ~15 lb Bobo photo, more angles (side/back/tail/belly), and a decoy photo if he has one.
3. **Decoy cat name** — still "the decoy cat" everywhere until you name him; and his **eye color** is currently Bobo's yellow-green as a flagged placeholder (`docs/DECOY_CAT.md` Q1).
4. `AGENTS.md` was never created (Step 1 shipped `VISION.md` + the docs only). It is the rulebook/index the build-a-game process loads every session — want a short one, drafted from `VISION.md` principles + this file, before Step 4?
5. Does `lookatbobo.getluckysocial.com` serve plain static files (ES modules + import maps, `.wasm`/`.png` mime types)? The tool assumes yes, which is how everything here is built.
6. The moment ids in the test scenes are kebab-case placeholders (`lounging-couch`, `cardboard-box`, …). Fine as internal ids, or do you want different names?
7. Anything you want the tool to check numerically that is not on the list in `docs/CAPTURE.md` yet — palette lint / colour-blind / photosensitivity probes are already slotted for Step 6.
