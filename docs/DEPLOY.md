# Deploy — xCloud (lookatbobo.getluckysocial.com)

How this site is deployed and exactly what to set. Written for issue #16 after the
first git deploy failed with *"'dist' contains no index.html after the build. …
set build_command (for example: npm run build) and retry"*: xCloud's Node flow
expects a build command that fills `dist/`, and this repo is plain static files
with no build step. `npm run build` (→ `tools/build-dist.mjs`, plain Node, zero
dependencies) is now that build: it copies what the game needs at runtime
(`game/`, `src/`, `vendor/three/`, only the `assets/` files the code references)
into a clean `dist/` and writes a root `index.html` that opens the game.

`dist/` is gitignored and built on the server. Nothing is uploaded, bundled or
downloaded by the build.

## xCloud settings (copy these)

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Publish / output directory | `dist` |
| Node.js version | **22 or newer** (this repo's checks run on Node 24; the build script needs ≥ 20.11) |
| Install command | default `npm install` is fine — the build itself uses **no** packages, so skipping the install step also works |
| Environment variables / secrets | **none.** The site needs nothing to build or run |
| HTTPS | **on** |
| Domain | `lookatbobo.getluckysocial.com` |

**Do not set `ELEVENLABS_API_KEY` (or any key) on the server.** Voice generation
is a local dev tool (`npm run audio:buy`, cost-guarded); the deployed game only
plays the three committed `.mp3` takes. `.env*` files are gitignored, are never
copied into `dist/`, and the key must never exist on xCloud.

After setting the build command, redeploy from git. The first "Building
Application" step should now succeed and produce `dist/index.html`.

## Verify after deploy (copy-paste)

```bash
curl -s -o /dev/null -w 'root      %{http_code} %{content_type}\n' https://lookatbobo.getluckysocial.com/
curl -s -o /dev/null -w 'game      %{http_code} %{content_type}\n' https://lookatbobo.getluckysocial.com/game/full.html
curl -s -o /dev/null -w 'slice     %{http_code} %{content_type}\n' https://lookatbobo.getluckysocial.com/game/slice.html
curl -s -o /dev/null -w 'module    %{http_code} %{content_type}\n' https://lookatbobo.getluckysocial.com/src/cat.js
curl -s -o /dev/null -w 'three     %{http_code} %{content_type}\n' https://lookatbobo.getluckysocial.com/vendor/three/three.module.js
curl -s -o /dev/null -w 'audio     %{http_code} %{content_type}\n' https://lookatbobo.getluckysocial.com/assets/audio/yell-look-at-bobo.take1.mp3
```

Expect — every line **200**, and the types exactly:

- `root` → `text/html` (the page; it redirects to the game immediately)
- `game`/`slice` → `text/html`, `module`/`three` → **`text/javascript`**, `audio` → **`audio/mpeg`**

Then open `https://lookatbobo.getluckysocial.com/` — it should land on the
**full game** instantly (Step 8: `ENTRY` in the build script is now
`game/full.html`; the slice still ships and stays reachable at
`/game/slice.html`); click start and the real voice takes play. **If any `.js`
answers with a `content-type` other than `text/javascript`, the game will not
boot** (browsers refuse ES modules with the wrong MIME and the console says so)
— fix the server's MIME config for `.js`/`.mjs` first; that is the usual
suspect when a static-deploy game is a black screen. Any `404` on these six
lines means the build didn't ship that file — run `npm run build` locally and
compare against the printed manifest.

## Testing on a phone (issue #25)

Point a phone at `https://lookatbobo.getluckysocial.com/game/full.html` — the
game detects the phone by itself: a virtual stick under the left thumb, drag
the right side of the screen to look, the big yellow button shouts (it also
restarts after a win). The tap that starts the game also asks for fullscreen
and landscape lock: **Android Chrome grants both; iOS Safari has neither API
for a page** and just plays inside the browser chrome — that is expected, not
a bug. Upright, the game waits behind a "turn your phone sideways" card.

Useful parameters while phone-testing (append to the URL with `?`/`&`):

| Parameter | What it does |
|---|---|
| `?quality=high` | the full look back on a phone (auto-low is the default there) |
| `?quality=low` | force the weak-GPU look on a desktop |
| `?touch=on` | force the touch controls on a desktop (test the layout with a mouse attached) |
| `?touch=off` | force keyboard/mouse on a phone (QA) |
| `?label=on` | the tool's moment chip, if you want it while testing |

If a phone run feels wrong, note the URL params — `npm run check:mobile`
replays the whole phone path headlessly (touch events, rotate, auto-low, win
at ten) and `?touch=on` at a desk reproduces most layouts.

## Checking the build locally before pushing

```bash
npm run build                                  # prints every file it ships + total size
node tools/serve.mjs --root dist               # http://127.0.0.1:8123/  (root page -> game)
```

## If a later step changes the game

- **Entry renamed/replaced** — already happened once: Step 8 switched the
  entry from `game/slice.html` to `game/full.html`, which was just the one
  `ENTRY` constant at the top of `tools/build-dist.mjs`. A missing entry fails
  the build loudly rather than deploying an empty site; the slice keeps
  shipping at its own path because `game/` is copied wholesale.
- **New files inside `game/`, `src/`, `vendor/three/`**: shipped automatically —
  those directories are copied wholesale.
- **A new import from a new top-level directory**: the build fails, naming the
  importer and telling you to add that directory to `COPY_DIRS`. Same for a
  referenced `assets/…` file that doesn't exist. Loud at build time is the deal;
  nothing silently 404s in Brandon's browser.
