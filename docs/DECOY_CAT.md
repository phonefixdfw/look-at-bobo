# Look at Bobo — The decoy cat (name TBD)

> Decisions log and open questions for Brandon's 2026-11-14 design change: a second cat, a decoy. This file lives on its own (rather than in `docs/HANDOFF.md`) because PR #4 was editing HANDOFF.md when it arrived. **Done:** PR #4 merged, and `docs/HANDOFF.md` §6 now links here (Step 3 housekeeping, 2026-11-14).

## What Brandon decided (2026-11-14 design change)
| Date | Decision | Source |
|---|---|---|
| 2026-11-14 | Add a second cat to the apartment: **a decoy** | Brandon (design change) |
| 2026-11-14 | Looks: mostly black, white feet, a white **neck**, **no white spot on his forehead**; very fat — **22 lb** | Brandon (design change) |
| 2026-11-14 | Behavior: he just lies around the apartment as scenery, like Bobo does. Nothing else about his habits is known | Brandon (design change) |
| 2026-11-14 | Wrong-cat rule: if the player points at him and shouts "LOOK AT BOBO!", they get an **X**, a voice says **"DAG!"** (spelled exactly that way), and they **lose one of their 10 points** | Brandon (design change) |
| 2026-11-14 | Step 4 voice lines are now: **"LOOK AT BOBO!"**, **"DAG!"**, and the ending text (`your did it! you wind`, spelled exactly that way) | Consequence of the above |

**Tells that distinguish the decoy from Bobo:** no white forehead spot (Bobo's white vertical forehead dash is the key tell), white **neck** vs Bobo's white **bib**, 22 lb vs Bobo's ~15 lb. Both are mostly black with white feet. Bobo's description is unchanged.

## Accepted defaults (Brandon can override any of these)
| # | Default | Notes |
|---|---|---|
| D1 | The penalty is a **silly, gentle X plus "DAG!"** — never a harsh buzzer. **No game over.** The score **floors at 0** | Keeps the feel "no game over and no timers; the only setback is a gentle one-point penalty for pointing at the wrong cat" |
| D2 | The decoy is **never harmed, scared or mocked**; he stays cute and oblivious | Aligns with the game's never-scary principles |
| D3 | The decoy's **name is TBD** — call him "the decoy cat" everywhere; do not invent a name | Pending Brandon |
| D4 | **No habits invented** beyond "lies around the apartment" | Never-invented rule extended to the decoy |

## Open questions for Brandon (with suggested defaults)
1. **What is the decoy cat's name?** — *Suggested default:* none until Brandon names him; keep calling him "the decoy cat".
2. **How many lounge spots does he have, and where?** — *Suggested default:* 3–5 fixed spots spread across the searchable areas of the accepted provisional layout.
3. **How/when does he move around?** — *Suggested default:* he relocates between rounds (after each catch/respawn); no wandering animation needed.
4. **May he ever share Bobo's spot?** — *Suggested default:* **never** — decoy placement must exclude Bobo's current moment spot.
5. **Is he always visible, or can he be partly hidden?** — *Suggested default:* always visible as scenery; the challenge is not shouting at him, not finding him.
6. **How does the −1 point interact with the 10 random moments?** If every catch consumes a moment but penalties only lower the score, a penalized run could run out of moments before reaching 10 points. — *Suggested default:* the penalty affects only the score; when all 10 moments have played, the list reshuffles and continues (still no repeats within a cycle) until the score reaches 10, so a win always comes.
7. **What exactly triggers "DAG!"?** — *Suggested default:* only when the aim/interact target is the decoy cat; pointing near-but-not-at him is safe.
8. **Is the decoy a real cat with reference photos like Bobo, or a fully fictional cat?** — *Suggested default:* build from Brandon's written description only; no references assumed, nothing invented (eyes, pose preferences etc. remain TBD).

## Non-goals for the decoy
- No health, punishment, scare or chase mechanics around him.
- No invented backstory, habits, sounds or name.
- No change to Bobo's description, moments, or the celebration on a correct catch.
