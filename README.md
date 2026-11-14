# look-at-bobo
a game where you find a cat named bobo doing cute things and say "look at bobo"

## running things

step 2 is in: a tool that jumps to any moment, screenshots it, and measures it, so
"it looks fine" can be checked instead of guessed.

```bash
npm install
npm run serve      # see the scene yourself: http://127.0.0.1:8123/tools/testscene.html
npm run capture    # 36 frames -> captures/testscene/_contact-sheet.png
npm run gate       # prove the tool catches mistakes: 1 clean run + 4 planted faults
```

- `docs/CAPTURE.md` — how the tool works and the `window.LC` page contract
- `docs/HANDOFF.md` — where the project is and what happens next
