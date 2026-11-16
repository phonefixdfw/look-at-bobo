# Look at Bobo — logo (issue #57)

The mark is Bobo's sleeping head: cream face, mustard forehead dash (his
in-game name-tag mark), eyes closed — the title-screen Bobo is asleep in the
warm light. Colours are the design system (`docs/ART_STYLE.md` §8):

| token | value     | where                    |
| ----- | --------- | ------------------------ |
| badge | `#1b1e26` | rounded-square background |
| face  | `#f1ece1` | coat / face (TOKENS.cream) |
| dash  | `#e8b04a` | forehead dash, `--ui-mustard` |

## Files

- `logo.svg` — the source of truth. `game/full.html` inlines a copy for the
  title screen and the favicon (inline = no request that a capture could see
  404).
- `logo-16.png`, `logo-32.png`, `logo-48.png` — favicon sizes.
- `logo-180.png` — `apple-touch-icon`.
- `logo-512.png` — the share/store icon.
- `logo-social.png` — 1200×630 link-preview card (mark + wordmark + line).

## Regenerating

The PNGs are exports, never hand-edited:

```
node tools/export-logo.mjs
```

It renders `logo.svg` headless (the same Chrome the capture tool drives) at
every size listed above. Re-run it whenever `logo.svg` changes and commit the
PNGs with it.

## The wordmark

"LOOK AT BOBO" is set in the page's own type (900 weight, the same letter-
spacing as the HUD), not drawn as SVG paths — the type rules live in
`game/full.html` next to the splash card and `issue #10`'s 3D extruded menu
logo is the same component in its 3D state (`docs/SPLASH.md`).
