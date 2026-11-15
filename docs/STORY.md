# Look at Bobo — Story (Step 1)

> **Step 1 only — LOCKED.** Story, characters, and locations are locked at the level the approved vision allows, with accepted provisional defaults. Real Bobo/apartment details not supplied by Brandon remain TBD and are never invented. No Step 2+ work started (no code scaffold, no capture tool, no art/audio generation, no paid services).
>
> **Update (2026-11-14):** Brandon added a second cat — **the decoy cat** (name TBD) — per `VISION.md`. His decisions log and open questions live in [`docs/DECOY_CAT.md`](DECOY_CAT.md).

## Premise
A first-person, joyful, silly game where you walk through a modern one-bedroom apartment, find Bobo the cat doing something adorable, and shout "LOOK AT BOBO!" Every catch is a celebration. There is no game over and no timers; the only setback is a gentle one-point penalty for pointing at the wrong cat — a second, very fat decoy cat who just lies around the apartment as scenery. Bobo is never in danger, and the decoy cat is never harmed.

## Core loop
1. The player spawns in the apartment in first person (mouse and keyboard).
2. Bobo is somewhere in the apartment doing one cute moment. The decoy cat (name TBD) lies somewhere else, as scenery, doing nothing.
3. The player finds Bobo, aims at him, and presses the interact/shout button.
4. The player's hand points and a voice yells **"LOOK AT BOBO!"**
5. Fireworks and a celebration play, and the player earns **+1 point**.
6. If the player instead aims at the decoy cat and shouts: a gentle, silly **X** appears, a voice says **"DAG!"** (spelled exactly that way, on purpose), and the player loses **1 point**. The score floors at 0 — there is no game over, the round simply continues, and the decoy is unbothered.
7. The player respawns elsewhere in the apartment while Bobo moves to a different cute moment, and the search begins again.
8. At **10 points**, Bobos rain all over the screen and the game displays the ending text exactly as: `your did it! you wind`

## Structure and pacing
- **Length target (accepted provisional default):** ~10–15 minutes total from start to finish, for 10 moments.
- **Progression:** 10 catches = 10 moments = 10 points. Each catch advances to the next moment/point. A shout at the decoy cat costs 1 point (score floors at 0); it never ends the run. How the −1 interacts with moment consumption is an open question — see [`docs/DECOY_CAT.md`](DECOY_CAT.md). Moment order is **random** (no repeats within a run).
- **Difficulty:** None by design. The challenge is playful searching — including telling Bobo apart from the decoy (the white forehead dash is Bobo's key tell) — not pressure. The player always knows what to do: find Bobo, point, and shout.
- **Tone:** Joyful and silly. No game over and no timers; the only setback is a gentle one-point penalty for pointing at the wrong cat. Finding Bobo is the reward.

## The ten moments (placeholder — "normal cat stuff", random order)
Brandon answered: use **"normal cat stuff"** — everyday cat behaviour such as lying on things, rolling over, lounging on furniture, stretching, napping, curling up, etc. **No claims about Bobo's specific real habits are made; Bobo-specific habits remain not specified.** The list below stays as broad generic placeholders rather than real-Bobo claims:

| # | Moment (generic placeholder) | Likely area (accepted provisional layout; real locations TBD) |
|---|---|---|
| 1 | Lounging on the couch | Living area |
| 2 | Stretching on the bed | Bedroom |
| 3 | Looking out the window/balcony (bird optional) | Window/balcony area |
| 4 | Resting near a cardboard box | Living/bedroom/hall (TBD) |
| 5 | Sitting near/in a sink | Bathroom/kitchen sink (TBD) |
| 6 | Batting a pen near the desk | Desk/work area |
| 7 | Napping in/near a laundry basket | Bedroom/closet/laundry spot (TBD) |
| 8 | Rolling over / playful tail chase in the hallway | Hallway |
| 9 | Curling up / making biscuits on a blanket | Bed/couch (TBD) |
| 10 | Resting near/on the keyboard | Desk/work area |

**Moment order:** **RANDOM** each playthrough, with **no repeats within a run** and still **exactly 10 points** (10 moments). Layout/respawn logic must therefore support any moment appearing from any valid location under the accepted provisional layout (real apartment layout remains TBD if not supplied).

## Story rules / truths (constraints for later steps)
- Bobo is the star and is always cute, never a villain or a prop.
- Bobo is never in danger. There is no game over and no timers; the only setback is the gentle one-point wrong-cat penalty, and the score floors at 0.
- The decoy cat (name TBD — do not invent one) is scenery: he just lies around the apartment, like Bobo does. Nothing else about his habits is known and nothing is invented about him. He is never harmed, scared or mocked; he stays cute and oblivious. The wrong-cat penalty is a silly, gentle X plus "DAG!" (spelled exactly that way), never a harsh buzzer.
- The decoy cat is clearly distinguishable from Bobo: **no white spot on his forehead** (the white forehead dash is Bobo's key tell), **white on his feet only** — no neck band, no bib, no white muzzle, while Bobo has the white bib and muzzle — and he is very fat: 22 lb vs Bobo's ~15 lb. Both have mostly black coats and white feet.
- The apartment is a believable, realistic modern space (art direction in later steps). The **real layout and furniture** are TBD and must come from Brandon if supplied; for Step 1 we use an accepted provisional placeholder layout. Bobo-specific habits are **not specified**; use generic everyday cat behaviour placeholders.
- Moments appear in **random order** with no repeats in a run; the layout/respawn logic must support any moment from any valid location. Decoy placement rules are TBD — see [`docs/DECOY_CAT.md`](DECOY_CAT.md) (suggested default: he lounges in 3–5 fixed spots, relocates between rounds, and must never be in the same spot as Bobo).
- Step 4 voice lines are now: the yell **"LOOK AT BOBO!"** on each catch, **"DAG!"** (spelled exactly that way, on purpose) on a wrong-cat shout, and the ending text (voice production is Step 4, only after Brandon approves cost).
- Ending text is fixed: `your did it! you wind` (spelled exactly that way, on purpose).

## Step 1 status / remaining unknowns (accepted provisional defaults)
Step 1 is **LOCKED** with accepted provisional defaults: generic "normal cat stuff" moments in random order; simple one-bedroom placeholder layout; generic cute-cat motion/sound placeholders; reference photos deferred; ~10–15 minutes / 10 moments; and no extra never-guess items beyond the standing rule below.

**Never-invented rule remains active:** Bobo-specific habits, exact movement/sounds, reference details, real apartment layout/furniture placement, real sink choice, exact prop locations, and other real-Bobo/apartment specifics are **not invented**. They remain TBD/provisional until Brandon provides real details. The same rule now applies to the decoy cat: beyond Brandon's description (a second cat; mostly black, white on his feet only after issue #34, no white forehead spot, very fat at 22 lb; lies around the apartment as scenery; triggers the X + "DAG!" penalty), nothing about him is invented — decisions and open questions are tracked in [`docs/DECOY_CAT.md`](DECOY_CAT.md).
