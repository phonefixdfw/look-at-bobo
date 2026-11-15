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
2. **Bobo-first legibility** — the tells (dash / bib-vs-neck band / size) must
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
| white neck band/collar (ring around the neck) | ❌ | ✅ |
| white muzzle | ✅ | ✅ |
| white paws (literal white parts) | ✅ | ✅ |

The dash is **deliberately exaggerated** versus the photo's thin ~4 × 20 mm
dash: a readable blaze, measured **71.9 mm** across in the model, so it holds
**26.9 px at 2.5 m** and **11.2 px at 6 m** at 1080p/fov-60 (limits: ≥20 px /
≥8 px). It is still unmistakably the same marking; the photo stays the record
of the real one.

Because both cats share the builder, selfTest can *measure* the tells instead
of trusting someone painted the right spot: `bobo-dash-white` (37 white verts),
`decoy-no-dash` (exactly 0), `bobo-bib-white` (484), `decoy-no-bib` (0),
`decoy-collar-white` (241), `bobo-no-collar` (0), `cats-distinguishable`, plus
the two legibility checks above. Fault injection (`?plant=dash`, `?plant=size`,
`?plant=text`, `?plant=stats`) proves each of those checks bites — each exits 1
naming its check.

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
  signature; `side` from issue #27, with the collar band across the TOP of the
  neck — the one neck region Bobo's lying bib never reaches, so the scan can't
  trade tells). Measured in
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
| selfTest | 36/36 on every frame | 36/36 |
| drawCalls / triangles (worst) | 89 / 101,636 | ≤150 / ≤150k |
| shadow lights / real lights | 1 / 2 | ≤1 by design / ≤6 |
| Render time | 0.06–0.13 ms/frame | — |
| dash legibility | 26.9 px @2.5 m · 11.2 px @6 m | ≥20 px · ≥8 px |
| size tell (same pose) | 1.32× wide · 1.68× bulk | ≥1.25× · ≥1.35× |
| tells (vertex counts) | dash 37 / bib 484 · decoy collar 241, dash 0, bib 0 | ≥6 / ≥40 · exactly 0 |
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
