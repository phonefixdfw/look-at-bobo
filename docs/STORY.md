# Look at Bobo — Story (Step 1)

> **Step 1 only — LOCKED.** Story, characters, and locations are locked at the level the approved vision allows, with accepted provisional defaults. Real Bobo/apartment details not supplied by Brandon remain TBD and are never invented. No Step 2+ work started (no code scaffold, no capture tool, no art/audio generation, no paid services).
>
> **Update (2026-11-14):** Brandon added a second cat — **the decoy cat** (name TBD) — per `VISION.md`. His decisions log and open questions live in [`docs/DECOY_CAT.md`](DECOY_CAT.md).
>
> **Update (2026-11-16):** **Patriot Bobo** (issues #55/#58) joined the loop as the rare bonus find — see step 6 below and [`docs/CHARACTERS.md`](CHARACTERS.md) §"Patriot Bobo".

## Premise
A first-person, joyful, silly game where you walk through a modern one-bedroom apartment, find Bobo the cat doing something adorable, and shout "LOOK AT BOBO!" Every catch is a celebration. There is no game over and no timers; the only setback is a gentle one-point penalty for pointing at the wrong cat — a second, very fat decoy cat who just lies around the apartment as scenery. Bobo is never in danger, and the decoy cat is never harmed.

## Core loop
1. The player spawns in the apartment in first person (mouse and keyboard).
2. Bobo is somewhere in the apartment doing one cute moment. The decoy cat (name TBD) lies somewhere else, as scenery, doing nothing.
3. The player finds Bobo, aims at him, and presses the interact/shout button.
4. The player's hand points and a voice yells **"LOOK AT BOBO!"**
5. Fireworks and a celebration play, and the player earns **+1 point**.
6. Occasionally (about one find in six — never the first find of a run, never two finds in a row, never more than two per run) Bobo turns up in his **Patriot costume**, and the celebration is bigger: the player earns **+3 points** with a "+3!" on screen. Which finds roll a Patriot is drawn from the game's own seed, so the same seed always tells the same story — and a live game draws a **new random seed for every run** (issue #66), which is what makes him turn up in about five runs in six instead of never.
7. If the player instead aims at the decoy cat and shouts: a gentle, silly **X** appears, a voice says **"DAG!"** (spelled exactly that way, on purpose), and the player loses **1 point**. The score floors at 0 — there is no game over, the round simply continues, and the decoy is unbothered.
8. The player respawns elsewhere in the apartment while Bobo moves to a different cute moment, and the search begins again.
9. At **10 points**, Bobos rain all over the screen and the game displays the ending text exactly as: `your did it! you wind`. A Patriot find can carry the score past 10 and end the run early — the win reads the score, not a catch counter.

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

**Which run you get (issue #66):** the seed is the run. A **live** game (the real page, title screen and all) draws a fresh random 31-bit seed when the page loads and a **new one for every run** — play again, the pause card's restart, the win — so consecutive games tour different parts of the flat and the Patriot find really does turn up. The number is shown on the gear panel and on the `?stamp=on` debug line (`… · seed 123456789`): read it off, send it in, and `?seed=<that number>` replays exactly that run. `?gate=off` (capture mode, every tool page, the bots, the stress suite, `LC` simulations) ignores the randomness and stays on the **fixed seed 11**, so every baseline and every determinism pair keeps its pixels. One rule, one file: `src/run-seed.js`.

**Where Bobo hides (issues #53, #70):** in the full flat, each run also draws *where* every moment happens. The level ships a pool of 30 authored spots (`SPOTS` in `game/full-level.js`); a run takes one spot per moment type — all ten types, exactly once — in an order with **never two catches in the same room back to back**, so ten points means touring the whole flat instead of camping one sofa. The draw is seeded: the same seed replays the same hiding places in the same order (`capture --determinism` proves it). Some of those places now *hide* him: behind the gathered shower curtain in the tub (the game's best-kept secret — five percent of the ring around him can see him at all), at the foot of the grown living-room houseplant, against the tub's flank, in the dresser's shadow, half behind the kitchen counter's return. Partial hiding means partial: every hiding spot is measured to have a place you can stand and spot him, and a build check fails if that guarantee ever dies — he can be sneaky, never impossible. The shout ray only ever tests the cats themselves, so no prop ever blocks a find, and no hiding spot adds a wall you can bump into. The decoy cat likewise prefers a room other than Bobo's new spot, while keeping its iron rule: never Bobo's spot, always ≥ 1.2 m away, always findable. See `docs/LEVEL_LAYOUT.md` ("The spot pool", "Partial hiding") for the table and the draw's mechanics.

## Story rules / truths (constraints for later steps)
- Bobo is the star and is always cute, never a villain or a prop.
- Bobo is never in danger. There is no game over and no timers; the only setback is the gentle one-point wrong-cat penalty, and the score floors at 0.
- The decoy cat (name TBD — do not invent one) is scenery: he just lies around the apartment, like Bobo does. Nothing else about his habits is known and nothing is invented about him. He is never harmed, scared or mocked; he stays cute and oblivious. The wrong-cat penalty is a silly, gentle X plus "DAG!" (spelled exactly that way), never a harsh buzzer.
- The decoy cat is clearly distinguishable from Bobo: **no white spot on his forehead** (the white forehead dash is Bobo's key tell), **white on his feet only** — no neck band, no bib, no white muzzle, while Bobo has the white bib and muzzle — and he is very fat: 22 lb vs Bobo's ~15 lb. Both have mostly black coats and white feet.
- The apartment is a believable, realistic modern space (art direction in later steps). The **real layout and furniture** are TBD and must come from Brandon if supplied; for Step 1 we use an accepted provisional placeholder layout. Bobo-specific habits are **not specified**; use generic everyday cat behaviour placeholders.
- Moments appear in **random order** with no repeats in a run; the layout/respawn logic must support any moment from any valid location. Decoy placement rules are TBD — see [`docs/DECOY_CAT.md`](DECOY_CAT.md) (suggested default: he lounges in 3–5 fixed spots, relocates between rounds, and must never be in the same spot as Bobo).
- The flat has a plain robot vacuum (issue #85 — nobody's brand: generic round appliance, no name, no logo, no sound) that trundles a seeded loop through the open rooms while you play. In about **one run in six**, one find of the run is Bobo **riding** it — never the first find, never before the vacuum has completed one whole loop, and at most once per run. It is a find, not a new mechanic: same shout, same +1, same catch. Bobo on the move is still exactly as catchable as a walking Bobo (the vacuum travels at the aimable 0.18 m/s cat-tempo), and riding is a cute perk, never a hazard — the vacuum never bumps, chases or startles him.
- In about **one run in five** (issue #86), when a find lands on the couch, **Brandon himself is sitting on the living-room sofa and Bobo is loafing on his lap** — the flat's only human, added by the owner to depict himself (his cap, his sofa, his cat; nothing else about him is invented, `docs/CHARACTERS.md`). He is calm scenery watching his kart game; the find is a normal one: same shout, same +1, same DAG! rules — a lap is just where the cat is. He can never block a find (the aim ray only tests the two cats), and on the baseline seed the dice plans no lap scene, so the man is simply not in the flat.
- Step 4 voice lines are now: the yell **"LOOK AT BOBO!"** on each catch, **"DAG!"** (spelled exactly that way, on purpose) on a wrong-cat shout, and the ending text (voice production is Step 4, only after Brandon approves cost).
- Ending text is fixed: `your did it! you wind` (spelled exactly that way, on purpose).

## Step 1 status / remaining unknowns (accepted provisional defaults)
Step 1 is **LOCKED** with accepted provisional defaults: generic "normal cat stuff" moments in random order; simple one-bedroom placeholder layout; generic cute-cat motion/sound placeholders; reference photos deferred; ~10–15 minutes / 10 moments; and no extra never-guess items beyond the standing rule below.

**Never-invented rule remains active:** Bobo-specific habits, exact movement/sounds, reference details, real apartment layout/furniture placement, real sink choice, exact prop locations, and other real-Bobo/apartment specifics are **not invented**. They remain TBD/provisional until Brandon provides real details. The same rule now applies to the decoy cat: beyond Brandon's description (a second cat; mostly black, white on his feet only after issue #34, no white forehead spot, very fat at 22 lb; lies around the apartment as scenery; triggers the X + "DAG!" penalty), nothing about him is invented — decisions and open questions are tracked in [`docs/DECOY_CAT.md`](DECOY_CAT.md).
