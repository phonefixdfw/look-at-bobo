# Look at Bobo — Handoff (build-a-game)

> **Step 1 only.** Story, characters, and locations documented from the approved vision. No Step 2+ work started (no code scaffold, no capture tool, no art/audio generation, no paid services).

## 0. Quick start
1. Read `VISION.md` (root, approved by Brandon) and this file.
2. Current step: **Step 1 — Story, characters and locations** (docs prepared in this PR; awaiting Brandon confirmation of real-Bobo facts/open questions).
3. Open questions for Brandon are in **§3** below (with suggested defaults so he can answer "yes" to accept defaults).

## 1. Pipeline

| # | Step | Status | Notes |
|---|---|---|---|
| 1 | Story, characters and locations | 🔨 | Draft docs created: `docs/STORY.md`, `docs/CHARACTERS.md`, `docs/LOCATIONS.md`. Locked to vision; real-Bobo facts/layout/habits need Brandon confirmation. |
| 2 | Visual debugging tool | ⏳ | Not started. |
| 3 | Art style and design system | ⏳ | Not started. |
| 4 | Voices, sound and music | ⏳ | Not started. **Only step that costs money; requires Brandon's explicit approval before any spend.** |
| 5 | Talking-character demo | ⏳ | Not started. |
| 6 | Vertical slice | ⏳ | Not started. |
| 7 | Play the slice | ⏳ | Not started. |
| 8 | The rest of the game | ⏳ | Not started. |
| 9 | Polish | ⏳ | Not started. |
| 10 | Deploy | ⏳ | Not started. Host chosen by Brandon. |

**Current step:** 1. **What's happening right now:** Step 1 docs drafted on branch for PR; collecting Brandon's answers on real Bobo habits, apartment layout, and references.

## 2. Decisions log

| Date | Decision | Who | Why |
|---|---|---|---|
| 2026-11-14 | Vision approved; proceed with build-a-game Step 1 only for "Look at Bobo" | Brandon (via request) | User direction for this session |
| 2026-11-14 | Camera: first-person; Length: ~10–15 min (guess); Controls: keyboard+mouse; Tone: joyful/silly, no timers/failure; Platform: desktop browser; 10 catches/end text fixed as `your did it! you wind` | Vision / Brandon-approved | Recorded in `VISION.md` |
| 2026-11-14 | No real-Bobo facts invented; unknowns recorded as questions with suggested defaults | Agent (Step 1 rule) | Vision principle: "Nothing is invented about the real Bobo. His looks and habits come from his owner." |
| 2026-11-14 | Did not modify/override `VISION.md` or merge PR #2; noted PR #2 content in report | Agent | User instruction: mention any conflict rather than overriding it |

## 3. Open questions for Brandon (with suggested defaults)

**A. Bobo's real habits / the 10 moments (most important)**
1. What are Bobo's **real 10 cutest habits/moments** we should capture (replacing or confirming the draft list)?
   - *Draft list from vision:* loafing on the couch; stretching on the bed; staring at a bird from the balcony window; head in a cardboard box; sitting in the sink; batting a pen off the desk; sleeping in a laundry basket; chasing his tail in the hallway; making biscuits on a blanket; sitting on the keyboard.
   - **Suggested default:** Use this draft list as-is for planning/placeholders until you provide the real list; swap in real habits 1:1 when confirmed.
2. Any preferred **order** for the 10 moments, or should they appear in a set/randomized playful sequence (while still totaling 10 points)?
   - **Suggested default:** A fixed, curated order that flows naturally through the apartment (easy to tune later).

**B. Apartment layout and key furniture/props**
3. What is the **real apartment layout** (rooms and how they connect)? A rough sketch/photo/description is enough for Step 1.
   - **Suggested default:** Simple modern one-bedroom: living area + kitchenette, bedroom, bathroom, short hallway, and one large window (balcony optional).
4. Where are the key pieces for the moments: **couch, bed, desk+keyboard, pen, window/balcony, sink (kitchen or bathroom?), cardboard box, laundry basket, blanket**?
   - **Suggested default:** Place each prop in the room implied by the draft moment (couch in living area, bed/blanket/basket options in bedroom, desk in living/bedroom, sink in kitchen *or* bathroom — TBD), treated as provisional.
5. Is there a **balcony** Bobo looks out from, or a **window** only? Which direction/view context matters (bird outside)?
   - **Suggested default:** A window with a view outside (balcony access optional) sufficient for "staring at a bird".

**C. Bobo's movement, sounds, and references**
6. How does Bobo **move and behave** in these moments (posture, tail/ears, speed, transitions)? Any signature mannerisms?
   - **Suggested default:** Generic cute cat motion as placeholders, refined once you describe or show references.
7. What **sounds** does Bobo make (meow/chirp/purr/silent) that we should plan for? (No audio will be made now; Step 4 needs approval.)
   - **Suggested default:** Assume minimal/optional cute vocalizations TBD; keep "LOOK AT BOBO!" as the only required voiced line per vision.
8. Can you share **reference photos/videos** of Bobo (markings, face/eyes, body, typical poses) for later art steps?
   - **Suggested default:** Proceed with the written description from vision (15 lb, mostly black, white feet/bib/muzzle/forehead dash, yellow-green eyes) until references are provided.

**D. Scope confirmations**
9. Confirm **length feel** (~10–15 minutes) and that the draft moment count (10) is right?
   - **Suggested default:** Yes, 10 moments / ~10–15 minutes as in vision.
10. Any other must-have details about the real Bobo or apartment that should never be guessed?
   - **Suggested default:** None beyond the above; all unknown specifics remain TBD until you confirm.

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
- **Step 2: Visual debugging tool** (`tools/capture.mjs` and `window.LC` contract per build-a-game). This requires a minimal test scene/page to capture — which implies starting technical scaffolding/code. **Do not begin until Step 1 is confirmed and you ask to proceed.**
- Before Step 2: Brandon answers/confirms §3 questions (or accepts suggested defaults), and we mark Step 1 as locked/✅ with those decisions recorded.