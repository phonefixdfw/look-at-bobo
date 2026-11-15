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
curl -s https://lookatbobo.getluckysocial.com/build.json          # which build is live
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

`build.json` answers "what is live right now?" without a browser:

```json
{ "build": "f16d768-20261115-1613", "commit": "f16d768", "built": "2026-11-15T16:13:04.512Z", "entry": "game/full.html" }
```

The build id is `<short-commit>-<YYYYMMDD>-<HHMM>` in **UTC**. A deploy that did
not run and a deploy that ran but whose files the browser refuses to re-download
look different from this one line, which is the whole point.

## Which build am I looking at? (issue #29)

Every URL inside `dist/` gets `?v=<build id>` written into it by the build — the
entry's `<script src>`, the `three` importmap target, every `import`/`export … from`
in every shipped file, the vendor bundle's own internal import, the three audio
file paths and the `index.html` redirect. After writing them it crawls `dist/`
again and **fails the build** if any shipped URL was left un-stamped, so the
invariant is enforced rather than hoped for.

Why every one of them: a browser caches each file under **its own URL**. Typing
`?v=2` on the page address changes one entry out of ~30 — `game/engine.js`,
`src/touch.js`, `vendor/three/three.module.js` and the `.mp3`s each keep their
old cache entry, so a "hard refresh" can hand the new HTML last week's engine.
Versioning the URLs makes that impossible by construction: the new page asks for
`engine.js?v=<new build>`, which no cache has ever seen. Deep modules are
versioned for the same reason the page is — one stale one is enough to change
behaviour, and it is the one nobody can see.

The game then shows what it loaded. One line, in the **start card** and in the
**gear → settings panel**:

```
build f16d768-20261115-1613 · mode touch · quality low
```

- `build …` — the id. If the page's HTML and its JavaScript came from different
  builds, it says so in words instead of quietly mixing them:
  `html <a> / js <b> · MISMATCH: html and js are different builds`.
- `mode touch` / `mode mouse` — which controls it picked and is using now; if the
  URL forced the choice it names the parameter (`mode mouse (?touch=off)`).
- `quality low|full` — the look actually in force.

It is written twice on purpose: a 6-line **inline** script in `game/full.html`
paints it before any module is fetched (so a stale module cannot hide it, and a
page that never boots still reports its build), then the engine rewrites it with
the stamp on **its own** module URL plus the mode and quality. `?stamp=on` puts
the same fact in the tab title and at the top of the screen, where it survives a
boot error; `LC.buildStamp()` / `LC.buildInfo()` return it to a script. Under
`?gate=off` (capture mode) the stamp is hidden and empty — it is not part of the
game's pixels, and no captured frame contains it.

### Make the server revalidate the HTML

Versioned URLs fix modules; the entry HTML still needs to be re-checked, or a
phone can keep an old page that asks for old everything. One response header is
enough — `no-cache` means "always ask", and the stamped files still resolve from
cache without a round trip:

```nginx
# nginx
location = /game/full.html { add_header Cache-Control "no-cache"; }
location = /index.html     { add_header Cache-Control "no-cache"; }
```

```
# xCloud / any host with a headers setting
/game/full.html   Cache-Control: no-cache
/index.html       Cache-Control: no-cache
```

`no-store` also works and is heavier (the page re-downloads every time). This is
optional belt-and-braces: with the URLs versioned, a stale HTML page still asks
for a consistent set of files, so it plays the previous build rather than mixing
two.

### One thing that does not expire

`?touch=off` in a URL is forever: the settings panel and anything else that
rewrites `location.search` keeps the parameters it was given, so a QA parameter
typed once at some point in the afternoon rides along on every link shared
afterwards, and the phone it lands on is pinned to the mouse path. **If a phone
reports `mode mouse (?touch=off)`, delete the parameter** — copy the plain
address, or open a new tab and type the URL without it. `?touch=on` is the
escape hatch in the other direction: it forces the touch controls whatever the
device claims to be.

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
| `?touch=on` | force the touch controls on any device (also the rescue if a phone mis-detected itself) |
| `?touch=off` | force keyboard/mouse on a phone (QA) — **sticky: it survives every link shared from that page** |
| `?stamp=on` | the build stamp in the tab title and at the top of the screen, where a boot error cannot hide it |
| `?label=on` | the tool's moment chip, if you want it while testing |

**Read the stamp line first.** The start card says `build … · mode … · quality …`
(above); it answers which build, which controls and which look in one glance,
which is most of what a phone report needs. `mode touch` with a low-detail look
is auto-low doing its job, not a detection failure; `mode mouse` on a phone is
the bug, and the same line says whether the URL forced it. Low detail alone is
not evidence either way — `?quality=low` and `?touch=off` both make the desktop
look cheap too.

**Before blaming the game, rule out the cache:** reload with the app's "Desktop
site" toggle off, and if anything looks mixed, open a fresh tab and type the
address bare (no parameters). Since #29 every file URL carries the build, so a
clean load of the new page cannot reuse an old module — a stale page can only
reproduce the *previous* build.

If it still misbehaves, two screenshots settle it: the **start card with
`?stamp=on` on the address** (build + mode + quality), and the **gear → settings
panel** open in game. `npm run check:mobile` replays the whole phone path
headlessly — touch events, rotate, auto-low, win at ten, the mis-detected-phone
rescue and the stamp — and `?touch=on` at a desk reproduces most layouts.

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
