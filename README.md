# look-at-bobo
a game where you find a cat named bobo doing cute things and say "look at bobo"

## running things

**Step 2 is in.** There is a tool that jumps to any moment of the game, screenshots it, and
measures it, so "it looks fine" can be checked instead of guessed. Right now it drives a
deliberately trivial test scene; the real game arrives in later steps.

```bash
npm install
npm run serve      # see the scene yourself: http://127.0.0.1:8123/tools/testscene.html
npm run capture    # 36 frames -> captures/testscene/_contact-sheet.png
npm run gate       # prove the tool catches mistakes: 1 clean run + 5 planted faults
```

**Step 6 is in.** The game is playable — first-person, find bobo, point, shout:

```bash
npm run serve      # then open http://127.0.0.1:8123/game/slice.html and click "start"
```

- `docs/CAPTURE.md` — how the tool works and the `window.LC` page contract
- `docs/HANDOFF.md` — where the project is and what happens next
