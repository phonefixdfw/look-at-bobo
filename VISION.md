# Look at Bobo: Vision

## The game in one line
A first-person game where you walk through a modern apartment, catch Bobo the cat doing something adorable, and shout "LOOK AT BOBO!" — just make sure it's Bobo you're pointing at: a second, very fat decoy cat lounges around the apartment, and shouting at the wrong cat costs a point.

## Who Bobo is
Bobo is a real cat, about 15 lb, and mostly black. He has white feet, a white bib, a white muzzle and a white vertical dash on his forehead. His eyes are yellow-green. In the game he is the star and never a villain or a prop.

## Who the decoy cat is
A second cat — the decoy (his name is TBD; call him "the decoy cat" until Brandon names him). He is mostly black with **white on his feet only** — no white neck band, no bib, no white muzzle, and **no white spot on his forehead** (Brandon's update, issue #34: "let's remove the white on his neck. Just leave white on his feet"). Bobo's white forehead dash is the tell that tells the two cats apart. He is very fat: 22 lb, against Bobo's about 15 lb. He just lies around the apartment as scenery, like Bobo does. Nothing else about his habits is known, and nothing is invented about him; his name and placement are TBD.

## How it plays
1. You walk through a modern one-bedroom apartment in first person (mouse and keyboard, or a virtual thumb stick on a phone).
2. Bobo is somewhere in the apartment doing something cute. The decoy cat lies somewhere else, doing absolutely nothing.
3. You find him, aim at him and press a button. Your hand points and a voice yells "LOOK AT BOBO!"
4. Fireworks and a celebration go off, and you get one point.
5. Every now and then — about one find in six, never the first find of a run, never two in a row, and never more than two per run — Bobo turns up in his full Patriot regalia (the joke costume, issues #55/#58). Point at that Bobo and the party is bigger: **+3 points** and a "+3!" on screen. Which runs get a Patriot is rolled from the game's own seed, so the same seed always tells the same story.
6. If you point at the decoy cat instead, you get a gentle, silly X, a voice says "DAG!" (spelled exactly that way), and you lose one point. The score never drops below 0, there is no game over, and the decoy is completely unbothered.
7. You respawn somewhere else in the apartment while Bobo moves on to another cute thing, and you search again.
8. At 10 points it rains Bobos all over the screen and the game says "your did it! you wind" (spelled exactly that way, on purpose). A Patriot find can carry you past 10 and end the run early — the win reads the score, not a counter.

## The ten moments (draft, to confirm)
Loafing on the couch; stretching on the bed; staring at a bird from the balcony window; head in a cardboard box; sitting in the sink; batting a pen off the desk; sleeping in a laundry basket; chasing his tail in the hallway; making biscuits on a blanket; sitting on the keyboard. (These are first ideas. Real Bobo habits will replace some of them.)

## The look
A realistic modern apartment, with believable lighting, materials and furniture. Bobo is a softly stylized, fur-shaded cat built from reference photos, so he reads clearly as Bobo without trying to be a photograph. The decoy cat is built the same way and reads similarly at a glance — mostly black with white feet — so the tells matter: no forehead dash (Bobo's key tell), Bobo's white bib with no neck band on the decoy, and a much bigger, very fat 22 lb body against Bobo's ~15 lb. The whole game is built in code, with no downloaded models or scans.

## The title screen
The game opens on a modern title screen (issue #57): a "LOOK AT BOBO!" logo — Bobo's black head peeking over gold lettering, his yellow-green eyes and white dash in the mark — above plain instructions and a START button. It's drawn in code (inline SVG and CSS, no downloaded fonts or images in the page), it shares its card style with the pause menu and the ending, and it names itself "Look at Bobo" to a screen reader. Pause and win both lead back to it, so the menu is the front door of the game.

## The feel
Joyful and silly. No game over and no timers; the only setback is a gentle one-point penalty for pointing at the wrong cat. Finding Bobo is the reward, and the fireworks make every catch feel like a win. An original happy-gothic "bardcore" soundtrack, composed for this game and synthesized live in the browser, swings quietly under it all (`docs/MUSIC.md`).

## Platform
A desktop web browser, playable from one shareable link. Keyboard and mouse. Phones are not a goal.

## Success looks like
Someone plays through all 10 points, laughs at the ending, and wants to show a friend.

## Principles
- Bobo is always cute and never in danger.
- The decoy cat is never harmed, scared or mocked; he stays cute and oblivious.
- No game over and no timers; the only setback is a gentle one-point penalty for pointing at the wrong cat.
- The player always knows what to do: find Bobo (check for the white forehead dash), point, and shout.
- Always celebrated: every catch is a party.
- Nothing is invented about the real Bobo. His looks and habits come from his owner. Nothing beyond Brandon's description is invented about the decoy cat either.
- Keep it short, about 10 to 15 minutes from start to finish. (Length is a guess, to confirm.)

## Not goals (for now)
- Microphone shouting (the shout stays a press: click/Space, or the big button on a phone). Phones and touch controls left this list with issue #25 — `game/full.html` plays on a phone (virtual stick, drag-to-look, shout button, landscape-first, auto low-quality).
- Enemies, health, timers or failure states. (The wrong-cat penalty is a gentle one-point setback, not a failure state: no harsh buzzer, no game over.)
- Harming, scaring or mocking the decoy cat in any way.
- Multiplayer.

## How we'll build it
The build-a-game skill's ten steps, with a check-in after each: 1 story, characters and locations; 2 visual debugging tool; 3 art style; 4 voices — the voice lines are now "LOOK AT BOBO!", "DAG!" and the ending text (the only step that costs money, and only after Brandon approves it); 5 talking-character demo; 6 playable slice of about five minutes; 7 playtest; 8 the rest of the game; 9 polish; 10 deploy, on the host Brandon chooses.
