# Look at Bobo — Handoff (build-a-game)

> **Step 1 only — LOCKED.** Story, characters, and locations are locked with accepted provisional defaults. Real Bobo/apartment details not supplied by Brandon remain TBD and are never invented. No Step 2+ work started (no code scaffold, no capture tool, no art/audio generation, no paid services).

## 0. Quick start
1. Read `VISION.md` (root, approved by Brandon) and this file.
2. Current step: **Step 1 — Story, characters and locations — LOCKED ✅**. Do not start Step 2 until explicitly asked.
3. Questions Q1–Q10 are resolved for Step 1: Q1/Q2 answered directly by Brandon; Q3–Q10 accepted as **provisional defaults**. Real Bobo/apartment details not supplied remain TBD and must never be invented.

## 1. Pipeline

| # | Step | Status | Notes |
|---|---|---|---|
| 1 | Story, characters and locations | ✅ **LOCKED** | `docs/STORY.md`, `docs/CHARACTERS.md`, `docs/LOCATIONS.md` are locked at the approved vision level. Q1/Q2 answered by Brandon; Q3–Q10 accepted as provisional defaults. Unknown real-Bobo/apartment details remain TBD. Step 2 not started. |
| 2 | Visual debugging tool | ⏳ | Not started. |
| 3 | Art style and design system | ⏳ | Not started. |
| 4 | Voices, sound and music | ⏳ | Not started. **Only step that costs money; requires Brandon's explicit approval before any spend.** |
| 5 | Talking-character demo | ⏳ | Not started. |
| 6 | Vertical slice | ⏳ | Not started. |
| 7 | Play the slice | ⏳ | Not started. |
| 8 | The rest of the game | ⏳ | Not started. |
| 9 | Polish | ⏳ | Not started. |
| 10 | Deploy | ⏳ | Not started. Host chosen by Brandon. |

**Current step:** 1 — **Step 1 is LOCKED.** **What's happening right now:** Step 1 docs are final for this step on branch/PR #3; all Q1–Q10 are resolved for Step 1 (Q3–Q10 as provisional defaults). Step 2 is **not started** and must wait for an explicit request.

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
| *(none yet — Step 1 is documentation only)* | — | — |

## 5. Audio and credits
- Credit ceiling: not set. Spent: 0. Real rate measured: n/a.
- **Step 4 (voices, including "LOOK AT BOBO!") is the only step that costs money and will only happen after Brandon explicitly approves the cost/plan.** No paid services used in Step 1.

## 6. PR #2 / vision note
- Root `VISION.md` (merged on main) was read first and treated as the approved source.
- Open PR #2 (`Update the project vision`, branch `codeden/vision`, adds `.codeden/VISION.md`) was checked: its content is substantively the same as root `VISION.md` with minor formatting/wording differences (e.g. moment separators and a parenthetical note on length). **No substantive conflict identified; nothing overridden.** If PR #2 is intended to supersede/relocate the vision, reconcile after merge/review.

## 7. Next steps (Step 2 — not started)
- **Step 1 is LOCKED.** Do not start Step 2 until Brandon explicitly asks.
- **Future Step 2 (when requested):** Visual debugging tool (`tools/capture.mjs` and `window.LC` contract per build-a-game). This requires a minimal test scene/page to capture — which implies starting technical scaffolding/code.
