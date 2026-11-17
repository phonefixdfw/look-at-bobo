# Look at Bobo — Art style and design system (Step 3)

> **The chosen look: "Sunny Room, Soft Fur".** This document is the design system:
> every later scene, material, light and HUD element copies from it instead of
> inventing its own. The reference implementation is
> [`design/style-test.html`](../design/style-test.html) +
> [`design/style-test/styletest.js`](../design/style-test/styletest.js), captured
> and measured with the Step 2 tool (`npm run capture:style` →
> `captures/style-test/`, **72/72 frames PASS, 36/36 selfTest checks per frame**).
> Everything numeric below was measured off that build, not authored here first.
>
> Built strictly in code — no downloads, no scans, no image generation, no paid
> services, plain static files (no bundler), per `VISION.md` and the Step 3 brief.

## 1. The look, in one breath

A **believably lit modern apartment** (real sun through a real window, filmic
rolloff, one warm lamp) that you can read at a glance, populated by
**softly stylized, fur-shaded cats** whose markings are rules, not decals. The
room stays realistic so the cats are allowed to be soft.

Four pillars, in priority order:

1. **Sun-anchored realism** — one shadow-casting sun through the window decides
   every shadow in the room; everything else is fill. The window stays bright
   without blowing the room out (filmic tone mapping + a tone-mapping-exempt sky
   plane behind it).
2. **Bobo-first legibility** — the tells (dash / bib / size) must
   survive searching distance. If a marking can't be proven to read in pixels,
   it doesn't ship. The selfTest measures exactly that.
3. **Warm paper-and-mustard playfulness** — UI is warm paper on deep ink with
   mustard and coral accents; the wrong-cat penalty is a soft coral "DAG!", never
   red, never punishing.
4. **Cheap and honest** — merged geometry, one shadow map, no post-processing.
   Measured budget: worst frame **89 draw calls / 101,636 triangles** against the
   tool's 150 / 150,000 limits, ~0.06–0.13 ms/frame rendered.

**Deviation from the build-a-game script, on purpose:** Step 3 normally means
"three code-built mockups in three different looks, Brandon picks one." This
brief pre-pinned the look from `VISION.md` (realistically-lit apartment +
softly stylized fur-shaded cats, both built in code), so one style was built
deeply instead of three shallowly. Brandon can still veto; §11 lists what a
second look would cost (almost nothing — the whole scene reads one `TOKENS`
object and one lighting rig).

## 2. Design tokens

Single source of truth: `TOKENS` in `design/style-test/styletest.js` (also
exported at `window.LC.tokens`). UI tokens are mirrored as CSS custom properties
in `design/style-test.html` — the two lists must stay identical. Later code
imports the tokens; nothing hard-codes a hex twice.

| Token | Hex | Used for |
|---|---|---|
| `furBlack` | `#1b1e26` | black coat — cool near-black, **never pure black** (a highlight must survive) |
| `furSheen` | `#5a6480` | sunlit-coat sheen tint on fur + fuzz silhouette |
| `furWhite` | `#f1ece1` | all white markings — warm, never clinical white |
| `eyes` | `#b7c94b` | yellow-green irises (from Brandon's photo) |
| `pupil` | `#0c0e12` | pupils |
| `nose` | `#d18b8b` | nose leather |
| `earInner` | `#61494a` | inner-ear warmth |
| `whisker` | `#f6f2ea` | whisker lines |
| `oakFloor` | `#a87c52` | floor (procedural plank map over it) |
| `plaster` | `#d9d3c7` | walls |
| `rug` | `#a99a83` | rug — the searching stage |
| `couch` | `#3f4650` | couch fabric |
| `pillow` | `#d9a441` | throw pillow |
| `walnut` | `#6b4a30` | table, frames |
| `leaf` | `#4f7a4a` | plant |
| `metal` | `#23262b` | lamp, window frame |
| `cardboard` | `#c19a67` | the box (the game's most important prop) |
| `lampShade` | `#f2e6cf` | lamp shade (glows from inside: emissive 0.55) |
| `sky` | `#bfd8ea` | window sky base (gradient texture) |
| `uiInk` | `#10151c` | HUD text / score pill ground |
| `uiPaper` | `#f7f4ee` | HUD paper |
| `uiMustard` | `#e8b04a` | score pill accent, fireworks |
| `uiCoral` | `#ff8f7d` | "DAG!" burst, soft reticle — the *gentle* alarm color |
| `uiGlow` | `#ffd98a` | celebration glow |

## 3. Materials library (`styletest.js` §4 of the file)

- **Fur** — `MeshStandardMaterial` with `vertexColors: true` (the markings are
  painted per-vertex, §5), black fur `roughness 0.48` (glossier), white fur
  `roughness 0.62`, `sheen 0.6` with `sheenColor furSheen`. Black cat fur is a
  mirror with a mood, not a matte blob.
- **Fuzz silhouette** — one `BackSide` shell per body + head (max 2 per cat,
  selfTest-enforced), inflated ×1.045, translucent. This is the whole "soft"
  trick; it costs 2 draws, no shader.
- **Room PBR** — `MeshStandardMaterial` only; every surface gets a seeded
  procedural canvas texture (planks, plaster grain, rug weave, couch weave)
  built once at boot. No texture is generated inside the render path.
- **Wood (issue #65)** — walnut's height field carries ONLY the plank seam.
  Detail drawn smaller than a texel is a lie the Sobel normal pass amplifies:
  the old 220 near-black "open pores" per 256 px tile became scattered
  black pin-dots on every walnut surface. Pore/knot character belongs in
  the colour map as soft low-alpha radial knots (alpha ≤ 0.16), and
  `wood-texture-clean` counts near-black pixels in both canvases to keep
  it that way.
- **Sky / celebration** — `MeshBasicMaterial` with `toneMapped: false` so the
  window stays bright while the room stays filmic.
- Rules: one material instance per visual kind, from the library; new material
  kinds get added to the library, not inline.

## 4. Lighting rules

- **Exactly one shadow-casting light**: the sun (`DirectionalLight`,
  `#fff2df`, intensity 2.8, outside and above the far wall so it shines *through
  the window opening*; 1024² shadow map, `bias -0.0006`, `normalBias 0.02`).
  selfTest checks its position and `shadowLights ≤ 1`.
- `HemisphereLight` sky-fill (cool sky / warm floor bounce, 0.55) + **one**
  warm `PointLight` in the lamp (`#ffc98a`, no shadow). Total: 2 real lights
  (selfTest: `≤6 lights, ≤1 shadow by design`).
- `ACESFilmicToneMapping`, exposure 1.05, sRGB output. The sunlit window must
  roll off, not clip.
- No ceiling (diorama framing); the far wall casts its own shadow, or the
  sunlight on the floor is a lie.

## 5. Markings are rules, not decals (the character design system)

Both cats come from **one parametric builder**; the only difference is which
marking rules are switched on and the root scale. Rules are signed-distance
fields evaluated at build time and painted into vertex colours (8 mm soft
edges — fur markings are never a hard decal). **Head rules are evaluated in
HEAD space, body rules in cat-root space**, so the dash stays put when the head
turns and the bib stays put across poses.

| Rule | Bobo | Decoy cat |
|---|---|---|
| forehead dash (box, head space, centre `[0, 0.036, 0.058]`, half-size `[0.0095, 0.036, 0.032]` m) | ✅ **THE tell** | ❌ must be absent |
| chest bib (ellipsoid, front of chest) | ✅ | ❌ |
| belly patch | ✅ | ❌ |
| white neck band/collar (ring around the neck) | ❌ | ❌ — **removed, issue #34** |
| white muzzle | ✅ | ❌ — **removed, issue #34** |
| white paws (literal white parts) | ✅ | ✅ |

The dash is **deliberately exaggerated** versus the photo's thin ~4 × 20 mm
dash: a readable blaze, measured **71.9 mm** across in the model, so it holds
**26.9 px at 2.5 m** and **11.2 px at 6 m** at 1080p/fov-60 (limits: ≥20 px /
≥8 px). It is still unmistakably the same marking; the photo stays the record
of the real one.

Because both cats share the builder, selfTest can *measure* the tells instead
of trusting someone painted the right spot: `bobo-dash-white` (37 white verts),
`decoy-no-dash` (exactly 0), `bobo-bib-white` (484), `decoy-no-bib` (0),
`bobo-head-white` (150: muzzle + dash), `decoy-head-black` (exactly 0 — issue
#34 took his white muzzle too), `decoy-neck-black` (exactly 0, measured in the
exact zone the old neck band occupied), `bobo-neck-black` (0),
`white-feet-both` (4/4 literal white foot parts — the one marking they share),
`cats-distinguishable`, plus the two legibility checks above. Fault injection
(`?plant=dash`, `?plant=neck`, `?plant=size`,
`?plant=text`, `?plant=stats`) proves each of those checks bites — each exits 1
naming its check. `?plant=neck` is issue #34's proof: it paints the deleted
neck band back onto the decoy (241 white verts, the old count) and
`decoy-neck-black` + `cats-distinguishable` fail on it.

## 6. The cats' proportions (and the photo caveat)

- **Photo, on file:** [`docs/reference/bobo-01.png`](reference/bobo-01.png) —
  Brandon's photo of Bobo, supplied during Step 3.
- **The photo shows Bobo at roughly 10 lb; the spec says he is ~15 lb now.**
  So the photo is authoritative for **markings** (dash, bib, muzzle, white
  feet, yellow-green eyes, pink nose, white whiskers) and the **current ~15 lb
  body shape is an assumption** — markings modelled from the photo, body scaled
  up. A recent ~15 lb photo (plus side/back/tail-belly angles) would replace
  the assumption; asked for in §11.
- **Bobo** (root scale 1.0): sit, loaf, `side` and `back` poses (`side`/`back`
  added for issue #27 — the loaf egg rolled onto a flank, resp. belly-up; every
  lying pose's lowest contact still lands on the support, and the bib/belly
  zones exist per pose); sits ~0.45 m to head top at root scale. Marking rules
  per §5.
- **Decoy cat** (root scale `(1.30, 1.13, 1.12)` — wide and heavy, not tall):
  sit, sprawl and `side` poses (sprawl is belly-down, hips out, the 22 lb
  signature; `side` added by issue #27 so the scenery cat can lie down too).
  He carries no marking rules at all since issue #34 — his only white is the
  literal white foot parts — so what keeps him distinguishable is the absence of
  Bobo's dash and bib (measured in the zones those markings occupy) plus size.
  Measured in
  the same sit pose: **1.32× Bobo's width, 1.68× his bulk** (limits ≥1.25 /
  ≥1.35). Slow "breath" animation is sideways-only — scaling the belly in y
  would sink it into the rug and (rightly) fail the contact checks.
- Feet-on-surface rule: every pose's lowest contact part lands within
  **−0.001..+0.002 m** of the support surface, measured per moment
  (`bobo-contact`, `decoy-contact`).
- Eyes: Bobo's yellow-green `#b7c94b` token; **the decoy's eye color is
  unrecorded — currently defaults to Bobo's** (§11).

## 7. Renderer, performance, structure

- Plain static ES modules against the vendored Three.js r187 (`vendor/`);
  import map in the HTML; no bundler; `renderer.setPixelRatio(1)` for
  pixel-exact captures.
- **One draw call per merged material for static props** (`mergedMesh`): the
  whole apartment is ~20 draws; the cats are parts (so they can move); the win
  celebration is 3 `InstancedMesh` layers + 2 `Points` bursts. Worst measured
  frame: **89 draws / 101,636 tris** (win moment) — inside the tool's 150 /
  150k budget with room for more room content.
- **The full flat's draw budget is the one shared cap — 250 draws** (`DRAW_CALL_CAP`
  in `tools/capture.mjs`, raised from 150 by issue #87; a ceiling, not a target —
  merging and culling below are still how geometry gets paid for). Back at 150
  (issue #61) it had been given 180 while the room furniture landed (#59); two
  files earned the 150
  back. `game/full-merge.js` folds static siblings that shade identically into
  one buffer each — a run of twelve cabinet doors is one draw, not twelve —
  and refuses anything a check measures by mesh (the ruler rows, the named
  pieces, the parked leaves), anything transparent and anything with a script
  on it; `?merge=off` hands every mesh back to its own draw.
  `game/full-cull.js` hides the room groups a camera cannot reach, counted in
  openings, and fails open for a camera standing outside every room rect;
  `?cull=off` keeps all seven rooms drawn. The sky folded too: seven planes
  that already shared one unlit material are now one sheet.
  Measured, the worst frame of the 507-frame matrix is **147 draws / 98,656
  tris** — the overview, which sees the whole flat, and the reason the cull
  alone was not enough; the desk view went 163 → 123, and the count of frames
  over 150 in the matrix went 36 → 0. The budget was paid for
  honestly: `tools/draw-report.mjs --pixels` renders every frame of that
  matrix with the fold and the cull on and off, and all 507 came back
  byte-identical, so nothing here bought a draw call with a look.
- **The lookalike decor spends exactly one of those draws (issue #69).**
  Twenty-three pieces of black-and-white dressing — ten framed abstract
  artworks, the cow-patch bedding, cushions, throw, bath mat, towels, the
  black pot, B/W books and a storage box — share ONE 256 px canvas atlas
  (game/full-decor-mesh.js) and therefore one material, one merge bucket,
  one world-baked mesh. Its box spans five rooms, so `game/full-cull.js`
  files it shared-never-hidden: it is drawn in every frame, exactly once.
  Measured on the current 546-frame matrix: every single frame lands at
  the no-decor number **+1** (worst frame 149 → **150 / 150**, the win
  overview; the no-decor 149 reflects the furniture that landed after
  #61's 147), +320 triangles worst-case, and `capture:full:weak` renders
  the atlas under swiftshader with a clean console. Mipmapping is guarded
  by ClampToEdge + a 1.5 px UV inset + a 2 px painted cell border, so no
  black art smears into the cream cell next door at grazing angles (no
  moire anywhere in the matrix).
- **The street outside is one mesh and one atlas (issue #83).** The flat blue
  sky sheets behind the living-room window are gone; what the window and the
  balcony look at now is a stylized Uptown street — one merged card mesh on
  ONE 512 px canvas atlas (game/full-street.js + game/full-street-mesh.js),
  one unlit `MeshBasicMaterial` draw with vertex-colour tints, tone-mapping
  exempt exactly like the sheets it replaces, painted deterministically at
  boot (seed 20261117 — capture-grade deterministic, same rule as the decor
  atlas). The atlas rows are depth bands of a single street (sky, skyline,
  midrise, storefronts, roadway, near rooftops, side block), so a card's
  base roots where its sightline crosses it and band seams read as
  occlusion. The palette keeps the old sky colours (#8ec4ea → #cfe6f4 →
  #f3ead9) at the top and works warm-grey brick + glass beneath it; parked
  cars are painted, not animated (static per the card's own cost rule, and
  zero draw calls). `?quality=low` is the same skyline silhouette in two
  rows. Cells keep a 1 px UV inset and the painter clips per cell, so
  nothing bleeds at grazing angles (same guard as the decor atlas).
- No post-processing (`passes: 1`). Small cat parts and small props have
  `castShadow = false` — only big silhouettes need to shadow.
- The page implements the `window.LC` contract (`docs/CAPTURE.md`) with the
  Step 2 determinism guards: `Math.random`/`performance.now` throw during
  render, `seek`/`setMoment` are wrapped in `measured()`, moments are
  random-order compatible (`moment-order-independent` visits 12× and compares
  pose signatures to ≤1e-9). `?plant=stats` proves the tool catches a page that
  lies about its cost.

## 8. HUD rules

DOM, not geometry (crisp at any size, free for the render budget). Colors are
§2's `ui*` tokens, mirrored as CSS custom properties.

- **Score pill** (top center): paper ground, ink text, mustard number, format
  exactly `NN / 10` (zero-padded, e.g. `03 / 10`) — checked by
  `hud-score-format`.
- **Reticle**: calm paper ring; softens to `uiCoral` while aimed at the decoy.
  Never red (§1 principle 3, and `docs/DECOY_CAT.md` D1/D2).
- **Wrong-cat burst**: a gentle round X in `uiCoral` with the line
  **"DAG!"** — spelled exactly that way, on purpose, never "fixed" — easing in
  with `easeOutBack` from t=0.7 s and staying. `dag-text-exact` +
  `dag-visibility` enforce it.
- **Win**: it rains little flat Bobo heads (head + muzzle + dash, 3 instanced
  layers) + two firework bursts, and the ending line is exactly
  **"your did it! you wind"** — spelled exactly that way, on purpose;
  `ending-text-exact` fails the build if anyone "corrects" it.
- **Title screen** (issue #57): a modern title card in §2's voice — the
  **"LOOK AT BOBO!"** wordmark in warm gold `#f0c25c` with an ink outline and
  a soft drop (bold system type stack + layered outlines; no downloaded
  fonts), and Bobo's black head peeking OVER the lettering as inline SVG:
  yellow-green eyes `#b8e04f`, the white forehead dash and the white bib —
  the §5 tells, promoted to the logo. One card vocabulary for the whole
  game: the title card, the pause menu and the ending share the warm-dark
  panel with a mustard border, and one pill-button language (mustard = go,
  paper outline = secondary). Backdrop is CSS-only (dim veil, vignette,
  slow lamp-dust drift) — never a second WebGL scene. The logo's idle life
  (blink, ear flick, gentle bob) is for players only: calm mode and the OS
  reduce-motion preference switch it off. `title-logo-name` enforces the
  accessible name **"Look at Bobo"**; `title-layout-clean` enforces a clean
  logo/instructions/START layout at any viewport; `title-screen-state`
  enforces the lifecycle: shown before the start, hidden after Play, and
  FULLY absent (no class, no pixels) under `?gate=off`, so capture
  baselines never see any of it.
- HUD is only visible when the moment says it should be
  (`hud-score-visibility`, `ending-visibility`, `dag-visibility` all enforce
  per-moment state).

## 9. Do / Don't quick list

- ✅ Room = realistic materials + one believable sun. Cats = soft shells + rule-
  painted markings. The contrast between the two *is* the style.
- ✅ Near-black `#1b1e26` fur with visible sheen; warm-white markings; measured
  marking contrast **14.1:1**, worst HUD contrast **8.3:1** (AA is 4.5:1).
- ✅ New colors → `TOKENS` first. New props → merge per material.
- ❌ No downloaded/scanned models, textures or image-generated assets.
- ❌ No pure black, no clinical white, no post-processing passes, no second
  shadow-casting light, no red penalty UI, no hard-edged marking decals.
- ❌ No invented Bobo/decoy facts — markings beyond the photo/Brandon's
  description stay out (see `docs/CHARACTERS.md`, `docs/DECOY_CAT.md`).

## 10. Acceptance checklist (measured, re-runnable)

`npm run capture:style` reproduces all of it; exit code is the verdict.

| Check | Measured | Limit |
|---|---|---|
| Frames captured | 72/72 PASS (6 moments × 4 views × 3 times) | all pass |
| selfTest | 39/39 on every frame | 39/39 |
| drawCalls / triangles (worst) | 89 / 101,636 | ≤150 / ≤150k |
| shadow lights / real lights | 1 / 2 | ≤1 by design / ≤6 |
| Render time | 0.06–0.13 ms/frame | — |
| dash legibility | 26.9 px @2.5 m · 11.2 px @6 m | ≥20 px · ≥8 px |
| size tell (same pose) | 1.32× wide · 1.68× bulk | ≥1.25× · ≥1.35× |
| tells (vertex counts) | Bobo dash 37 / bib 484 / head white 150, neck 0 · decoy dash 0, bib 0, neck 0, head 0 · white foot parts 4/4 both | ≥6 / ≥40 / ≥25 · exactly 0 · ≥2 each |
| contacts (both cats, every moment) | within −1e-9..0 m | −0.001..+0.002 m |
| marking / UI contrast | 14.1:1 / 8.3:1 | ≥10:1 / ≥4.5:1 |
| exact strings | `your did it! you wind`, `DAG!` | byte-exact |
| determinism | seek-repeatable, order-independent, 0 unseeded calls | ≤1e-9 / 0 |
| planted faults caught | `dash`, `size`, `text` → exit 1 naming checks; `stats` → tool's own `stats-understated` | all caught |

## 11. Open items (none block Step 4)

1. **Photos that would sharpen this**: a recent (~15 lb) Bobo photo and more
   angles (side / back / tail / belly); **a photo of the decoy cat** if one
   exists. Until then §6's body-shape note stands.
2. **Decoy cat name** — still TBD; everything says "the decoy cat"
   (`docs/DECOY_CAT.md` D3).
3. **Decoy eye color** — not supplied; currently defaults to Bobo's
   yellow-green. One token change if Brandon says otherwise.
4. **Real apartment layout/photos** — the room here is the accepted provisional
   placeholder (`docs/LOCATIONS.md`); swapping real dimensions is prop-move
   work, not a style change.
5. **Colour-blind and photosensitivity probes** are deliberately deferred to
   the Step 6 tooling pass (with palette lint), per the Step 3 brief. The
   coral/ink worst-case 8.3:1 and dash-shape (not just color) tells are already
   de-facto safe.

## 12. Patriot Bobo — the costume layer (issue #55)

A joke costume, not a second cat: `src/patriot.js` adds meshes to the existing
`buildCat` rig and removes them again. Everything the style rules care about
stays fur-only — costume meshes carry `userData.patriot`, `src/measure.js`
skips them in every scan, and they never join `cat.contacts`. The style test's
`patriot-bobo` moment is the only thing that puts it on (`capture:patriot`);
every other frame is the untouched cat, proven by `patriot-only-in-its-moment`.

- **Pieces:** fur hat (deformed shell hugging the head ellipsoid, fuzz
  silhouette + fur cards like the cats', cream horns merged one mesh) kept
  clear of the dash and the eyes (`patriot-dash-unmasked`,
  `patriot-hat-covers-ears`); merged face-paint decals — the §5 "rules, not
  decals" law is about the *fur's* vertex-colour markings; paint sitting on
  top of the head as geometry is the costume's own skin; tattered flag cape +
  crossed webbing harness, with the bib and the `SAVE THE CAPITOL` button
  unobstructed (`patriot-button-on-bib`); a little flag on a 0.30 m stick with
  a vertex wave that is a pure function of `t` (rests flat in calm mode).
- **Colours:** cloth flag red `#b22234` / blue `#3c3b6e` / off-white `#f4f0e6`,
  fur hat browns `#5c4630 / #8a6a45 / #382a1c`, cream horns `#ead9b8`, webbing
  `#4a4a3a`. These live in `PAT` inside `src/patriot.js`, **not** in
  `src/tokens.js` — they are one gag's cloth colours, not the design system.
- **Cost:** ≤12 extra draw calls (10 merged meshes in practice) and ≤4.5k
  extra triangles, measured live by re-rendering with the rig hidden
  (`patriot-draw-budget`, `patriot-triangle-budget`); `?quality=low` halves
  every grid. Textures are canvas-made (flag, cape, button, cheeks), nothing
  is downloaded, and the build is hash1-only, so the costume is determinism-
  clean inside `measured()`.

## 13. The living-room TV plays a kart game (issue #84)

Brandon asked for Mario Kart on the living-room TV. Nintendo's characters,
logos, tracks and name are theirs, and we ship none of them — so the TV plays
**"KART DASH", an original look-alike of the genre** painted in code on a
small canvas (`src/kart-screen.js`): a Mode-7 pseudo-3D road (perspective
stripes, alternating rumble strips, a rainbow edging, a dashed centre line)
winding under a sunny sky with one snowcapped mountain, three tiny karts seen
from behind with round-headed, invented drivers (a red kart for the player —
plain round noggins and one-colour helmets; no plumber, no turtle, no
mushroom, no red-white cap), a floating plain yellow "?" item box, and a
chunky HUD in a bold system font: `LAP 2/3`, `1st`, a rounded mini-map with
three dots, and the made-up title `KART DASH`. The painter records every
string it ever draws and `kart-words-original` scans the list — "mario" and
"nintendo" can no more reach the screen than reach the repo.

- **Cost is the whole trick: zero draw calls.** The screen mesh, material and
  halo already exist (row 39, issue #46); this changed only the emissiveMap's
  pixels. The canvas is 320×180 (256×144 on `?quality=low`, where the scene
  also drops clouds, speed lines and one kart), redrawn at 12 fps — 6 fps on
  low, a slow 4 fps in calm mode — ONE texture upload per repaint, and ONLY
  while the screen passes the visibility test: the per-room cull's visible
  flags (§7) plus a frustum sphere test, so a player standing in the living
  room looking at the bookshop costs nothing, and `document.hidden` closes
  the tap when the tab goes away. Measured repaint cost on the capture
  machine: ~0.1 ms (`kart-update-cheap`).
- **Determinism and captures:** under `?gate=off` the screen is one FIXED
  frame painted at construction — `tick()` refuses to repaint the page at
  all (`kart-frozen-under-gate-off`), so captures and the determinism suites
  stay byte-identical apart from the living-room frames, whose screen pixels
  deliberately re-baseline (the standby glow they matched is the thing the
  issue replaced). The selfTest half that does paint runs inside `probe()`,
  which puts the exact static pixels back afterwards, so no check can leak
  an animated frame into a capture frame that renders after it.
- **Photosensitivity:** every frame keeps its average brightness — the
  scrolling trades one green for a near-equal green, one grey for a near-
  equal grey — and nothing flashes; speed lines are steady streaks and never
  appear in calm mode. `kart-brightness-steady` holds a whole scroll cycle
  to ~2% mean-luma drift (limit 8%).
- **Originality is a style rule, not a disclaimer:** the invented drivers,
  the invented title, the invented course are what make the genre joke
  land; nothing on the screen depicts, copies or names a Nintendo asset.
  See `docs/CHARACTERS.md` for who is actually holding the controller.

## 14. Brandon on the sofa — one human, one draw (issue #86)

The flat has exactly one human: Brandon, seated on the living-room sofa with
Bobo loafing on his lap (about one seed in five; see `docs/CHARACTERS.md`
"Issue #86"). He is built to this document's rules, and to the project's
draw budget:

- **Softly stylized, never a photograph.** Round volumes over a simple
  skeleton — barrel chest, sphere shoulders, capsule forearms, a ball-head
  under a backwards cap — the same construction language as the cats. No
  fingers, no facial features beyond painted hints: at 4–6 m of search
  distance a face is noise, and inventing one is not this character's job.
- **One merged mesh, one material, one 256 px painted atlas** (`ATLAS_OPS`:
  cloth blocks, hair strokes, a soft shading wash — **no text, no images**),
  merged with vertex colours like Bobo's fur. The scene's whole cost is
  **1 draw call**, `castShadow=false` (a 1.3 m shadow caster under the lamp
  would eat the room's light budget for nothing).
- **Anatomy is a style rule here.** The earlier build floated the head off
  the trunk — a dark blob above the shoulders — so `lap-head-column` and
  `lap-neck-solid` now pin the column: neck overlaps chest top, head
  overlaps neck top, trapezius spans the shoulders and overlaps both neck
  and chest. If a future edit moves a part, those checks fail with the
  measured gap in the note.
- **Palette:** his clothes reuse room tokens (denim `#3f5d82`-family, tee
  grey, cap mustard) picked to sit next to the sofa's greens without
  competing; skin/hair are flat provisional tokens, deliberately featureless
  (see `docs/CHARACTERS.md`: granted by the owner, nothing invented).
- **Seated by construction:** his pelvis sits *in* the cushion (sink
  ≈ 0.035 m), feet on the floor inside the sofa's footprint, knees under the
  coffee-table's underside line. He never blocks a find (`lap-clearance`,
  `lap-walkway`, `lap-no-aim-block`).
