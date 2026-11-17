# Look at Bobo — Characters (Step 1)

> Step 1 output only — **LOCKED with accepted provisional defaults**. **Nothing about the real Bobo may be invented**; facts below come from `VISION.md` or Brandon-provided answers. Where real details are not supplied, they remain TBD/provisional placeholders only. Updated 2026-11-14 with Brandon's decoy-cat design change (his decisions log and open questions: [`docs/DECOY_CAT.md`](DECOY_CAT.md)); Bobo's description is unchanged.

## Bobo (the star)
- **Identity:** A real cat. The star of the game — never a villain, never a prop, never in danger.
- **Size/build:** About 15 lb. **First reference photo is on file:** [`docs/reference/bobo-01.png`](reference/bobo-01.png) (supplied during Step 3). It shows Bobo at roughly **10 lb**, so it is authoritative for his **markings**, while the current **15 lb body shape is an assumption** (see `docs/ART_STYLE.md` §6). A recent ~15 lb photo and more angles (side/back/tail/belly) are still wanted; nothing beyond photo + Brandon's words is invented.
- **Color/markings (from vision, confirmed):**
  - Mostly black coat.
  - White feet.
  - White bib.
  - White muzzle.
  - White vertical dash on his forehead.
- **Eyes:** Yellow-green.
- **In-game look (vision direction):** A softly stylized, fur-shaded cat built from reference photos so he reads clearly as Bobo without trying to be a photograph. **Step 3 delivered the look and his first code-built model** — markings painted as measured rules from the photo, the forehead dash exaggerated so it reads at search distance (`docs/ART_STYLE.md` §5–§6).
- **Personality/feel in-game:** Joyful, adorable, the center of every moment. Always cute.
- **Movement, poses, sounds (UNKNOWN — must come from Brandon or photos/videos; provisional defaults accepted for Step 1 only):**
  - How Bobo moves (walk/trot/pounce/loaf transitions, tail behavior, ear posture, typical idle animations).
  - How he sounds (meows, chirps, purrs, silence?) — no audio invented.
  - **Accepted provisional default:** Generic "normal cat stuff" motion and minimal/optional cute vocalizations as placeholders only; **not claims about real Bobo**.

## Patriot Bobo (the joke costume, issue #55)
- **What it is:** A bonus gag — Bobo in a full patriotic costume, authored by Brandon ("Patriot Bobo!"). It is an **optional costume layer** on the existing model (`src/patriot.js`), never a second cat and never a change to Bobo's body, markings or tells. Normal Bobo is byte-identical with the costume available: the costume attaches only when the game dresses him (the style test's `patriot-bobo` moment, and the rare bonus find in the full game — see "In the game" below), every costume mesh is tagged so the marking scans (dash, bib, neck, feet) keep counting fur only, and the costume never enters the contact sets.
- **The pieces:** a brown fur hat with cream horns (covers the ears; the forehead dash and the eyes stay clear of the brim), blue face-paint crescents under the eyes, a tattered stars-and-stripes cape on a crossed webbing harness (the white bib stays visible around the `SAVE THE CAPITOL` button, which sits on the bib itself), and a little flag on a ~0.30 m stick propped against his right side.
- **Motion:** a short idle — the flag waves, the head tilts a little, Bobo blinks every ~3.2 s. It is a pure function of the loop time and fully rests under `?motion=off` / prefers-reduced-motion; `?quality=low` halves the costume's mesh density.
- **Budget:** at most 12 extra draw calls (measured at 10 merged meshes) and ~4.5k triangles — see `docs/ART_STYLE.md` §12.
- **In the game (issue #58):** the costume is the rare **bonus find** in the full game. About one legal find in six, he sits on his drawn spot in full regalia; pointing at him pays **+3** (the win can come early), fires the "+3!" pop with the usual fireworks boosted. The roll rides the run's seed — same seed, same Patriot story — and `?patriot=off` turns him off entirely (`?patriot=on` dresses the staged capture finds; `?patriot=N` forces live find N). He is still one cat: the costume is part of Bobo's subtree, so aim, marking scans and the decoy distance rule all treat him exactly as plain Bobo.
- **Not canon:** nothing here describes the real Bobo. It is a costume the game can put on the existing model, in the spirit of the joke ending.

## The decoy cat (name TBD)
- **Identity:** A second cat — the decoy. He is scenery: he just lies around the apartment, like Bobo does. **Nothing else about his habits is known; do not invent any.**
- **Name:** **TBD.** Do not invent one — call him "the decoy cat" everywhere until Brandon names him.
- **Size/build:** Very fat — **22 lb** (vs Bobo's about 15 lb). (Brandon-supplied.)
- **Color/markings (from Brandon):**
  - Mostly black coat.
  - White feet.
  - White **feet only** — no white neck, no bib, no white muzzle. (Bobo's white **bib** is Bobo-only; issue #34 took the decoy's neck white away.)
  - **No white spot on his forehead.** Bobo's white vertical forehead dash is the **key tell** distinguishing the two cats.
- **Eyes:** TBD (not supplied — do not invent). *Art placeholder only:* the Step 3 style test renders him with Bobo's yellow-green token so the scene can run; it is explicitly flagged in `docs/ART_STYLE.md` §11 and is not a claim about his real eyes.
- **Role in gameplay:** If the player aims at him and shouts "LOOK AT BOBO!", they get a gentle, silly X, a voice says **"DAG!"** (spelled exactly that way, on purpose), and they lose 1 of their 10 points. The score floors at 0; there is no game over.
- **Treatment rules:** He is never harmed, scared or mocked. He stays cute and oblivious, exactly like the scenery he is.
- **In-game look:** Same build approach as Bobo (softly stylized, fur-shaded, built in code). He should read similarly to Bobo at a glance — that's the joke — while the forehead dash, Bobo's bib (the decoy has no white above his feet at all) and the size difference keep him clearly distinguishable on a second look.
- **Placement/movement:** TBD — open questions with suggested defaults live in [`docs/DECOY_CAT.md`](DECOY_CAT.md) (e.g. he lounges in 3–5 fixed spots, relocates between rounds, and must never be in the same spot as Bobo).

## The Player
- **Role:** First-person unseen player in the apartment (hands/arm may be shown when pointing — implementation detail for later steps).
- **Goal:** Find Bobo — and only Bobo — aim, and press the button to point and shout "LOOK AT BOBO!" Shouting at the decoy cat instead costs 1 point.
- **Voicing:** Step 4 voice lines are: the yell **"LOOK AT BOBO!"**, the wrong-cat line **"DAG!"** (spelled exactly that way, on purpose), and the ending text `your did it! you wind` (voice/casting/cost is Step 4 and requires Brandon's approval). Player character otherwise silent unless Brandon requests otherwise.
- **Abilities/limits:** Walk, look, aim/interact. No combat, no inventory. No timers and no game over; the only setback is the gentle one-point wrong-cat penalty (score floors at 0).

## Other characters
- **The decoy cat (above)**, added by Brandon's design change, is the only other character in scope. No other humans or animals (aligns with "not goals": no multiplayer; vision describes a solo apartment search). If Brandon later wants another presence (e.g. offscreen owner voice), that remains an optional future change.

## Lookalike decor — scenery that borrows the joke, never steals it (issue #69)
The flat now wears black-and-white dressing (docs/LEVEL_LAYOUT.md, "Lookalike
decor"): framed abstract ink art, a cow-patch duvet, patchwork cushions, a
check throw, striped towels, a black pot with white rings. From the corner of
the eye some of it reads "is that Bobo?" for a beat — that is the decoy's joke
echoed in the walls, not a second fake cat. The line stays where the decoy's
line is:

- **A lookalike is DECOR.** It never stands, never poses, has no eyes, ears,
  whiskers, forehead dash, bib or blaze — the markings the cat builder draws
  and nothing else may. Its patterns are blobs, rings, rules, checks and
  patches; its darkest black is a cool near-black that deliberately is *not*
  Bobo's `furBlack` token, so even the colour tell stays the cat's. It is one
  untagged, unnamed mesh: nothing in the game can aim at it, and pointing at
  it can never spend a point or shout "DAG!" at a pillow.
- **A lookalike is scenery for the FIND too.** Every piece keeps a 0.21 m
  capsule around every cat spot clear up to a seated eye line, and the whole
  collection is added to the `findable` sight model — a black canvas may add
  shadow, it may not take a findable spot away (`decor-findable-clear`).
- **The decoy cat remains the ONLY false target.** He is the one moving,
  breathing, three-times-Bobo's-fur cat that costs a point. The decor's job
  is the half-second of doubt that makes the apartment feel like Bobo's, not
  a hunting minigame.

`decor-not-a-cat-tell` pins the mechanical half of that list; the patterns
themselves are reviewed against this page.

## Casting / reference needs (provisional defaults accepted; real references still TBD if not supplied)
- **Partially supplied:** one Bobo photo is on file ([`docs/reference/bobo-01.png`](reference/bobo-01.png), shows him at ~10 lb). **Still wanted:** a recent ~15 lb photo, more angles (side/back/tail/belly), a pose video if you have one, and a photo of the decoy cat if he has one — each would replace an assumption, none is invented in the meantime. Without them, art proceeds from the written description + this photo only.
- **Accepted provisional default / Step 1 direction:** Use **generic "normal cat stuff"** (lounging, rolling over, stretching, napping, curling up, etc.) as placeholders. **No claims are made about Bobo's specific real habits**; Bobo-specific habits remain not specified until references or descriptions are provided.
