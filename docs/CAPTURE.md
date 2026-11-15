# Look at Bobo — the visual debugging tool (Step 2)

> **Why this exists:** "it looks fine" is not proof. This project never ships a visual
> it has not looked at and measured. The tool opens any page of this project headless,
> jumps to an exact moment and time, renders one frame, screenshots it and reports
> numbers. It exits non-zero when something is wrong, so it can gate work instead of
> advising about it.
>
> Built in Step 2. Everything later (art mockups, the slice, the full game) exposes the
> same `window.LC` contract, so the same tool drives all of it.

## Files

| File | What it is |
|---|---|
| `tools/capture.mjs` | the capture + measure tool |
| `tools/gate.mjs` | proves the tool catches real faults (`npm run gate`) |
| `tools/serve.mjs` | tiny static server (also used by the tool) |
| `tools/sync-vendor.mjs` | copies the pinned Three.js build into `vendor/` |
| `tools/testscene.html` + `tools/testscene/testscene.js` | the trivial scene that proves the tool works |
| `vendor/three/` | Three.js r187, plain files, no build step |

## Run it

```bash
npm install            # playwright-core + three (dev only, nothing at runtime)
npm run vendor         # copy the pinned three build into vendor/ (already committed)
npm run serve          # http://127.0.0.1:8123/tools/testscene.html  (see it in your own browser)

npm run capture        # 36 frames -> captures/testscene/ + _contact-sheet.png + report.json
npm run gate           # the tool's own self-check: clean scene passes, 5 planted faults are caught
npm run capture:all    # every moment × every view × every default time, with byte-for-byte determinism check
npm run capture:weak   # one frame on the CPU (--gpu swiftshader): a weak-laptop smoke test
npm run capture:planted# the tool MUST fail: a 5 cm floating box, caught by selfTest (exit code 1)
```

Full usage: `node tools/capture.mjs --help`.

```bash
node tools/capture.mjs tools/testscene.html \
  --times 0,2.4,5 --views overview,contact --moments default,win \
  --out captures/name --selftest [--determinism] [--gpu swiftshader] \
  [--size 1280x720] [--budget drawCalls=150,triangles=150000] [--param k=v] [--url http://…]
```

It prints one line per frame plus a summary and writes:

- `NN__moment__view__t2.40s.png` — one frame per (moment, time, view);
- `_contact-sheet.png` — every frame in one labelled image, failures outlined in red;
- `_contact-sheet.html` — the same sheet as a clickable page (`npm run serve` to browse it);
- `report.json` — per frame: the tool's own counts from the WebGL context (`gpu`), the page's
  `getStats()`, the frame's pixels (mean luma, spread, colour count), `selfTest` results, and
  the PNG hash; plus render probes, console/page/network errors, the budget verdict, and an
  overall `verdict`.

**Exit codes:** `0` all good · `1` a check failed · `2` the page or the tool could not be used.
A run fails when `selfTest` fails, a budget number is over, a frame is black/blown out,
`--determinism` shows a frame that changes on re-render, the console has errors
(including 404s), or the page reports a cheaper frame than the GPU was given.
Typos in `--views` / `--moments` are an error, not a silent skip.

## The page contract: `window.LC`

Every page that wants to be capturable exposes this. `tools/testscene/testscene.js` is
the reference implementation.

```js
window.LC = {
  ready: false,          // true once the scene is built AND nothing is painted over
                         // the canvas — the tool waits for it, then screenshots the
                         // whole page, so an overlay still mid-fade would be in frame
  duration: 6,           // loop length in seconds (0 if the page does not animate)
  views: ['overview', 'contact', 'top', 'first-person'],
  setView(name) {},      // switch camera; unknown name => throw
  seek(t) {},            // jump to t seconds; the frame is a pure function of (moment, view, t)
  play() {}, pause() {},
  renderNow() {},        // render exactly one frame, synchronously
  getStats() {},         // { drawCalls, triangles, geometries, textures, programs,
                         //   passes, realLights, shadowLights }
                         // passes = render passes per frame including the plain scene
                         // pass (1 today; a composer adds one per pass)
  selfTest() {},         // { pass, checks: [{ name, pass, value, limit, note }] }
};
window.LCError = '…';    // set instead of ready:true if the page cannot start
```

The tool wraps `renderNow()` (and the WebGL context) to time a frame and count what it draws,
so `renderNow` must draw synchronously before returning and must not rely on `requestAnimationFrame`
— that is what makes "jump to t and look" mean the same thing twice.

This project also uses these extensions (the test scene implements them, later pages should too):

| Extension | Purpose |
|---|---|
| `moments` (array of ids) | every moment the page can jump to |
| `setMoment(id)` / `goto(id, t)` | jump anywhere; **must work in any order** |
| `moment()`, `time()`, `view()`, `playing()`, `state()` | what a frame was taken at |
| `camera(name)` | `{ position, look, fov }` of a named view |
| `endingText` | the exact ending string, so checks compare against one source |

### Determinism is the point

- No unseeded `Math.random()`, no `Date.now()`/wall-clock animation. The test scene counts
  any call inside `seek`/`setMoment` and fails `seek-no-unseeded-random`.
- `seek(t)` fully rebuilds the pose from `t`; `play()` steps a fixed 1/60 s per frame.
- `renderer.setPixelRatio(1)`, so a capture is pixel-exact on any display.
- Proof: `--determinism` re-renders every frame and compares PNG hashes. `npm run capture:all`
  is 144/144 frames byte-identical (12 moments × 4 views × 3 times).

Because a moment must be reachable in any order (moments appear in random order in the
game), `selfTest` visits all of them twice — once in declared order, once in a seeded
shuffle — and compares poses (`moment-order-independent`). Order-dependence would be a
real bug in the finished game, and it is caught here, on a placeholder scene, already.

## Budget

Checked on every frame, overridable with `--budget`:

`drawCalls ≤ 150` · `triangles ≤ 150 000` · `passes ≤ 3` · `shadowLights ≤ 2` · `realLights ≤ 6`

(The intent is VISION.md: 60 fps at 1080p on a mid-range laptop. The build-a-game process
also wants these numbers in `AGENTS.md`, which does not exist in this repo yet — see
`docs/HANDOFF.md`, open question 1.)

**What the tool trusts and what it measures.** The tool hooks the WebGL context itself
(`drawArrays`, `drawElements`, the instanced variants, `bindFramebuffer`) and counts, per
`renderNow()`, how many draw calls the GPU was really given, how many triangles that is, and
how many render targets got bound. `drawCalls` and `triangles` are budget-checked against
those counts, so a page cannot budget its way past the limit by reporting flattering numbers —
and a page that reports fewer than the GPU saw fails outright (`stats-understated`;
`?plant=stats` proves it). `passes`, `shadowLights` and `realLights` stay page-reported,
because they describe intent rather than GPU work; the measured target count is printed and
stored in `report.json` next to them, so an off declaration is visible rather than invisible.
When post-processing arrives, that pair is the tripwire.

The `rAF` fps probe is only a smoke test: headless Chrome caps it near 60 no matter how
slow the machine is, so the honest numbers are **ms per frame** (`renderProbe` in
`report.json`) and the budget counts above. A fast dev machine proves nothing.

## selfTest on the test scene (15 checks)

Numbers are measured back out of the built geometry, not restated from the code that
placed it, which is what makes them able to fail.

`box-bottom-to-floor` (±1 mm) · `stick-foot-to-floor` (±1 mm) · `stick-tip-touches-box`
(≤1 mm) · `stick-no-box-clipping` (no axis sample inside the box) · `stick-tip-height`
(≥0.30 m) · `stick-length-matches-markers` (±1 mm) · `bobo-support-gap` (−1..+2 mm from
the floor or the box top, per moment) · `ending-text-exact` (`your did it! you wind`) ·
`ending-visibility` · `views-distinct` (cameras ≥5 cm apart) · `seek-repeatable` (≤1e-9) ·
`moment-order-independent` (≤1e-9) · `seek-no-unseeded-random` (0 calls) ·
`duration-positive` · `stats-available`.

## Planting a fault (proving the gate works)

The scene files stay correct; the fault only exists in the URL, so this can be re-proved
anytime:

```bash
node tools/capture.mjs tools/testscene.html --param plant=lift --selftest   # exit 1
```

| `?plant=` | The fault | Caught by |
|---|---|---|
| `lift` | box floats 5 cm above the floor | `box-bottom-to-floor` |
| `sink` | box sinks 2 cm into the floor | `box-bottom-to-floor` |
| `jam` | stick slides 10 cm into the box | `stick-no-box-clipping` |
| `text` | the ending text gets "fixed" to `you did it! you win` | `ending-text-exact` |
| `stats` | the page claims 1 draw call for a 10-draw frame | the tool's own WebGL count (`stats-understated`) |

`npm run gate` runs all five plus the clean scene, and checks both the exit code and the
name of what caught it. A tool that only ever says PASS proves nothing.

## Notes for the next steps

- **Step 3 (art style) — done.** This tool now drives a second page: the style
  test scene `design/style-test.html` (`npm run capture:style`, 72 frames:
  6 moments × 4 views × 3 times), the reference implementation of
  `docs/ART_STYLE.md` ("Sunny Room, Soft Fur"). It implements this contract
  unchanged and adds selfTest checks that measure the art system back out of
  the geometry (marking vertex counts, dash legibility in pixels, size ratio,
  feet-on-support gaps, contrast, exact HUD strings) plus its own fault plants
  (`?plant=dash|size|text|stats`). Palette lint, a colour-blind simulation and a
  photosensitivity probe (≤3 full-frame brightness swings over 20 % in any
  second) were **deferred to Step 6** with the rest of the tooling pass.
- **Step 6 (slice)** adds `--url` / `--build` capture of the built game, `--scenario <beat>`,
  and `LC.goto(beat)` / `LC.camera()` on the game itself.
- The test scene is **not** art direction: a floor, a box, a leaning stick, a capsule
  standing in for Bobo and a clock hand. Its colours and shapes say nothing about how the
  game will look. Keep it that way, and keep it working — demos never get deleted.
- `captures/` is scratch and gitignored. Anything worth keeping gets copied somewhere
  permanent (or attached to a PR).
- The tool needs Chrome or Edge already installed; `playwright-core` drives it, and no
  browser is downloaded. Override the path with `LC_CHROME=/path/to/chrome` if needed.
- **Step 7 (stress suite)** added loop-inspection hooks to the slice (all additive, contract unchanged): `LC.loopTick(dt)` steps the sim by hand, `LC.loopDebug()` reports the measured frame deltas (dtIn/dtClamped/steps/simDt/camPos), `LC.loopDebugReset()` clears them, and `LC.catsDebug()` / `LC.aimProbe()` expose cat transforms and a strict aim hit for spawn and aim audits. The live loop now consumes rAF frame deltas (clamped 0.25 s / 16 steps) — capture is unaffected because it never enters the live view. Scenarios: `npm run playtest:stress`, `docs/PLAYTEST_NOTES.md` §10.
- **Step 9 part 3 lesson (fixed in #23): a DOM overlay is part of a capture.** A capture is
  a screenshot of the whole page, not of the canvas, so anything painted above the canvas at
  `ready` time is in the frame — and a fading one changes pixels between the two screenshots
  `--determinism` takes. `game/full.html`'s loading screen did exactly that: `LC.ready` was set
  before the 0.35 s fade began, and `capture:full:determinism` failed on the first full-page
  frame of every boot. The rule now: **retire an overlay (removed from the DOM, not just
  transparent) before setting `ready`**; take the cue from `transitionend` with a timer as the
  backstop, so a hidden tab can never hang the contract. The player keeps the fade.
  Record: `docs/PLAYTEST_NOTES.md` §13.
- **Issue #25 (phone support) added two read-only LC debug hooks on `game/full.html`**
  (additive, contract unchanged, never affect a normal game): `LC.touchDebug()` reports
  `{active, autoLow, controls:{stick,lookPointers,fwd,strafe,run}, virtual:{…held stick
  keys}}` and `LC.gpuDebug()` reports `{quality, pixelRatio, devicePixelRatio, shadows,
  confetti, canvasW, canvasH, touch}` — the phone posture actually in force. Captures never
  run as a touch device, so pixel ratio stays 1 on every captured frame; `npm run
  check:mobile` is the consumer of both hooks (`docs/PLAYTEST_NOTES.md` §14).
- **Issue #29 (stale cache / mis-detected phone) added two more, same shape:**
  `LC.buildStamp()` returns the build id this JS was served as (`npm run build` puts
  `?v=<id>` on every shipped URL; `dev` in the source tree), and `LC.buildInfo()`
  returns `{js, html, match, touch, touchOverride, autoLow, quality, stampDebug, text}`
  — what the visible stamp line is made of, including `window.LC_BUILD_HTML`, the
  page's own inline stamp, so a headless check can prove HTML and JS came from the same
  build. Both are pure reads; the stamp DOM itself is hidden and empty under
  `?gate=off`, so no captured frame contains it (`docs/PLAYTEST_NOTES.md` §15).
