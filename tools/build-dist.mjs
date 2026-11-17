#!/usr/bin/env node
// tools/build-dist.mjs — `npm run build`: produce a clean dist/ for the deploy
// (issue #16). xCloud's Node flow runs a build command and publishes the result,
// and it refuses a site whose dist/ has no index.html. This repo is plain static
// files with no build step, so this script IS the build: it copies exactly what
// the game needs at runtime into dist/ and writes a root index.html that opens
// the game. No bundler, no new dependencies, nothing downloaded.
//
// What lands in dist/:
//   - COPY_DIRS below, wholesale, so game files added by later steps are picked
//     up automatically without touching this script;
//   - assets/ — ONLY the files the copied code actually references (scanned for
//     "assets/..." paths), so dev-only or secret files in assets/ never ship;
//   - index.html — a real page (title "Look at Bobo", a start link) that
//     immediately redirects to ENTRY;
//   - manifest.webmanifest + the icons it names (assets/icons/) — the
//     installable-web-app files (issue #77);
//   - build.json — this build's stamp, for a deploy log or a curl to read.
//
// Every URL inside dist/ is stamped (issue #29): each relative module, asset and
// script URL gains `?v=<build stamp>`, so a browser that kept an old copy of one
// file cannot possibly be handed it for the new build — see "version every URL"
// below. Only dist/ is rewritten; the source tree keeps plain paths, so dev and
// the capture tools work exactly as they always did.
//
// It never copies: tools/, docs/, captures/, demo/, design/, node_modules/, .git,
// .env* or anything else not listed. Then it VERIFIES the result: every module
// the entry imports (transitively, importmap included) and every referenced
// asset must exist inside dist/, and no shipped URL may be left un-versioned — a
// missing or un-stamped one fails the build loudly instead of shipping a runtime
// 404 or a page that mixes two builds.

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// ------------------------------------------------------------------ config

/** The current game entry page, relative to the repo root. Step 8 may rename
 *  or replace it — this is the ONLY constant to change; the build fails loudly
 *  if the file is missing. Step 8 shipped the full game, so the site root
 *  opens game/full.html; the slice still ships (game/ is copied wholesale) and
 *  stays reachable at its own path /game/slice.html. */
const ENTRY = 'game/full.html';

/** Directories the game loads from at runtime. Copied wholesale (never
 *  filtered per-file) so new files in them ship automatically. */
const COPY_DIRS = ['game', 'src', 'vendor/three'];

/** The PWA manifest (issue #77), at the site root so its relative start_url,
 *  scope and icon paths work at any deploy path. */
const MANIFEST = 'manifest.webmanifest';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(REPO, 'dist');

// ------------------------------------------------------------------ helpers

/** Fail loudly, one clear line, non-zero exit — CI shows exactly this. */
function fail(msg) {
  console.error(`\nBUILD FAILED: ${msg}\n`);
  process.exit(1);
}

/** Never let a scratch or secret file ride along inside a copied directory. */
function keepFile(p) {
  const b = basename(p);
  return (
    b !== 'node_modules' && b !== '.git' && b !== '.DS_Store' &&
    !b.startsWith('.env') && !b.endsWith('.log')
  );
}

function copyTree(relDir) {
  const src = join(REPO, relDir);
  if (!statSync(src, { throwIfNoEntry: false })?.isDirectory()) {
    fail(`COPY_DIRS entry "${relDir}" is not a directory in the repo.`);
  }
  cpSync(src, join(DIST, relDir), { recursive: true, filter: keepFile });
}

/** Every dist/ file the module/asset scan must read: html + js only. */
function listCodeFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...listCodeFiles(p));
    else if (/\.(?:[cm]?js|html?)$/.test(e.name)) out.push(p);
  }
  return out;
}

const posixRel = (p) => relative(DIST, p).split(sep).join('/');

// ------------------------------------------------------------- the build stamp

/** `<short-commit>-<YYYYMMDD>-<HHMM>` in UTC: URL-safe, and readable straight
 *  out of a phone screenshot — "the deploy has not landed" and "the browser is
 *  holding an old file" look different. A build from an export with no .git (a
 *  CI tarball) still gets a stamp: the time is the part that matters. */
function thisBuild() {
  let commit = '';
  try {
    commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: REPO,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    /* no git here: the timestamp carries the stamp on its own */
  }
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const day = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}`;
  const clock = `${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;
  const safe = (commit || 'nogit').replace(/[^A-Za-z0-9._-]/g, '');
  return { stamp: `${safe}-${day}-${clock}`, commit: commit || null, built: d.toISOString() };
}

const BUILD = thisBuild();
const VPARAM = `v=${BUILD.stamp}`;

// ------------------------------------------------------- stamping the URLs

/** Does this URL have to carry the stamp? Relative or site-root paths that name
 *  a file: modules, importmap targets, script srcs, asset literals. Bare
 *  specifiers ("three"), data: URIs and http(s) links are not ours to stamp.
 *  Asset literals in this repo are written bare ("assets/audio/x.mp3") and get
 *  their "../" at runtime, so that shape counts as relative here. */
function needsStamp(u) {
  if (!u) return false;
  if (!/^(?:\.\.?\/|\/|assets\/)/.test(u)) return false;
  return /\.[A-Za-z0-9]+$/.test(u.split(/[?#]/)[0]);
}
const re = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const HAS_OUR_STAMP = new RegExp(`[?&]${re(VPARAM)}(?:&|$)`);

/** The same URL with this build's stamp on it (idempotent). */
function stamped(u) {
  if (!needsStamp(u) || HAS_OUR_STAMP.test(u)) return u;
  const hash = u.indexOf('#');
  const frag = hash > -1 ? u.slice(hash) : '';
  const base = hash > -1 ? u.slice(0, hash) : u;
  return `${base}${base.includes('?') ? '&' : '?'}${VPARAM}${frag}`;
}

/** The path a URL points at inside dist/, query and fragment aside. */
function resolveUrl(file, spec) {
  const clean = spec.split(/[?#]/)[0];
  if (clean.startsWith('/')) return join(DIST, clean);
  if (clean.startsWith('.')) return resolve(dirname(file), clean);
  return null;
}

// The URL shapes this repo actually ships, plus the obvious ones a later step
// will reach for. Quoted strings only, so prose is safe: a sentence about
// "three" or "assets" has no `./` in front of it and stays as it was.
const RE_FROM = /(\b(?:from|import)\s*)(['"])([^'"\n]+)\2/g; // import x from './a.js' / import './a.js'
const RE_DYNAMIC = /(\bimport\(\s*)(['"])([^'"\n]+)\2(\s*\))/g; // await import('./a.js')
const RE_ASSET = /(['"])([^'"\n]*\bassets\/[^'"\n]+\.[A-Za-z0-9]+)\1/g; // 'assets/audio/x.mp3'
const RE_SRC = /(<script[^>]*\bsrc\s*=\s*)(['"])([^'"]+)\2/gi;
const RE_HREF = /(<link[^>]*\bhref\s*=\s*)(['"])([^'"]+)\2/gi;
const RE_MAP_VALUE = /("(?:[^"\\]|\\.)*"\s*:\s*")([^"]+)(")/g;
const RE_STAMP_LITERAL = /window\.LC_BUILD_HTML\s*=\s*('[^']*')/;

/** Every URL a file names, for the audit — the same shapes the rewriter knows. */
function urlsIn(file, text) {
  const out = [];
  if (/\.html?$/.test(file)) {
    for (const m of text.matchAll(RE_SRC)) out.push(m[3]);
    for (const m of text.matchAll(RE_HREF)) out.push(m[3]);
    for (const m of text.matchAll(RE_MAP_VALUE)) out.push(m[2]);
  } else {
    for (const m of text.matchAll(RE_FROM)) out.push(m[3]);
    for (const m of text.matchAll(RE_DYNAMIC)) out.push(m[3]);
    for (const m of text.matchAll(RE_ASSET)) out.push(m[2]);
  }
  return out;
}

// ------------------------------------------------- 1. clean dist/, check entry

if (!statSync(join(REPO, ENTRY), { throwIfNoEntry: false })?.isFile()) {
  fail(
    `game entry "${ENTRY}" (the ENTRY constant at the top of tools/build-dist.mjs) ` +
      `does not exist. If the entry page was renamed, update that one constant.`
  );
}
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// ------------------------------------------------------- 2. copy runtime code

for (const d of COPY_DIRS) copyTree(d);
// The entry may sit outside COPY_DIRS in the future; guarantee it ships.
if (!existsSync(join(DIST, ENTRY))) {
  mkdirSync(dirname(join(DIST, ENTRY)), { recursive: true });
  cpSync(join(REPO, ENTRY), join(DIST, ENTRY));
}

// ------------------------------------------- 3. assets: only what code uses

// Scan the copied code for "assets/..." paths and ship exactly those files.
// The game builds its audio paths as plain string literals (src/audio.js
// VOICE_LINES and the one plant override in game/slice.js), which makes a
// literal scan reliable, Step-8-proof (a new take is just another literal) and
// safe by default: assets/audit…ons, lock.json, ledgers and anything added
// later stay out unless the runtime code actually names them.
const assetRefs = new Map(); // "assets/..." -> first file that referenced it
for (const file of listCodeFiles(DIST)) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/\bassets\/[A-Za-z0-9._/-]*[A-Za-z0-9]\/[A-Za-z0-9._-]+/g)) {
    const ref = m[0];
    if (ref.includes('..') || !/\.[A-Za-z0-9]+$/.test(ref)) continue; // not a real file path
    if (!assetRefs.has(ref)) assetRefs.set(ref, posixRel(file));
  }
}
for (const [ref, by] of assetRefs) {
  const src = join(REPO, ref);
  if (!statSync(src, { throwIfNoEntry: false })?.isFile()) {
    fail(`"${by}" references runtime asset "${ref}", which does not exist in the repo.`);
  }
  const dst = join(DIST, ref);
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(src, dst);
}

// --------------------------- 3b. PWA manifest + the icons it names (issue #77)

// The manifest is the only fullscreen path on iPhone (Add to Home Screen), so
// it sits at the site root in dist/, exactly as in the repo. Its own URLs —
// start_url, scope, icons — are relative to itself and stay PLAIN (no stamp):
// start_url is a navigation, not a cached fetch, and a stamped one would
// break the "works at any path" contract the file is written for. But a
// manifest is not html/js, so the scan above never sees its icon paths — the
// icons are followed and verified here instead, same rule: a missing one
// fails the build loudly, never as a 404 on a phone's home screen.
if (!statSync(join(REPO, MANIFEST), { throwIfNoEntry: false })?.isFile()) {
  fail(`site-root manifest "${MANIFEST}" is missing.`);
}
cpSync(join(REPO, MANIFEST), join(DIST, MANIFEST));
let manifestJson;
try {
  manifestJson = JSON.parse(readFileSync(join(REPO, MANIFEST), 'utf8'));
} catch (e) {
  fail(`${MANIFEST} is not valid JSON: ${e.message}`);
}
for (const icon of manifestJson.icons || []) {
  const src = join(REPO, icon.src);
  if (!statSync(src, { throwIfNoEntry: false })?.isFile()) {
    fail(`${MANIFEST} names icon "${icon.src}", which does not exist in the repo.`);
  }
  const dst = join(DIST, icon.src);
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(src, dst);
}

// ------------------------------ 3c. stamp every URL inside dist/ (issue #29)

// The bug this exists for: Brandon's phone kept the NEW HTML and the OLD
// JavaScript. A `?v=2` he typed on the page address says nothing about the ~30
// files that page imports — full.js, engine.js, every src/*.js, vendor/three and
// the audio files are each cached under THEIR OWN url, and those URLs never
// change, so the browser is entitled to hand back last week's bytes. Versioning
// every one of them at build time makes a stale module un-cacheable-by-mistake:
// the new page asks for `engine.js?v=<new build>`, which its cache has never
// seen. The stamp also travels into the page (see LC_BUILD_HTML in
// game/full.html and LC.buildStamp() in game/engine.js), so the start card shows
// which build the HTML and the JS each came from.
let urlCount = 0;
for (const file of listCodeFiles(DIST)) {
  const before = readFileSync(file, 'utf8');
  let after = before;
  if (/\.html?$/.test(file)) {
    after = after
      .replace(RE_SRC, (m, head, q, u) => ((u = stamped(u)), head + q + u + q))
      .replace(RE_HREF, (m, head, q, u) => ((u = stamped(u)), head + q + u + q));
    // The importmap is the one place a bare "three" becomes a path; its TARGET
    // has to be versioned or the whole vendor bundle stays cache-sticky.
    after = after.replace(
      /(<script[^>]*\btype\s*=\s*["']importmap["'][^>]*>)([\s\S]*?)(<\/script>)/gi,
      (m, open, body, close) => open + body.replace(RE_MAP_VALUE, (mm, k, v, e) => k + stamped(v) + e) + close
    );
    // The page's own inline stamp, so a stale module cannot hide it. The entry
    // page MUST carry the hook: without it the visible stamp would be silently
    // missing from the deploy, which is the thing we are trying to be able to see.
    if (RE_STAMP_LITERAL.test(after)) {
      after = after.replace(RE_STAMP_LITERAL, () => `window.LC_BUILD_HTML = ${JSON.stringify(BUILD.stamp)}`);
    } else if (join(DIST, ENTRY) === file) {
      fail(
        `${ENTRY} has no \`window.LC_BUILD_HTML = '...'\` literal for the build to stamp. ` +
          `The page's visible build stamp depends on it (issue #29) — put the inline script back.`
      );
    }
  } else {
    after = after
      .replace(RE_FROM, (m, head, q, u) => ((u = stamped(u)), head + q + u + q))
      .replace(RE_DYNAMIC, (m, head, q, u, tail) => ((u = stamped(u)), head + q + u + q + tail))
      .replace(RE_ASSET, (m, q, u) => q + stamped(u) + q);
  }
  const urls = urlsIn(file, after);
  urlCount += urls.filter((u) => HAS_OUR_STAMP.test(u)).length;
  if (after !== before) writeFileSync(file, after);
}

// ------------------------------------- 4. verify the copied graph is complete

// Walk the module graph from ENTRY inside dist/ and check every import target
// is present. Catches the one way wholesale copying can miss something: Step 8
// importing from a NEW directory that is not in COPY_DIRS — that fails here,
// loudly, instead of as a 404 on Brandon's server.
// Static `import ... from "x"` / `export ... from "x"` (the between-clause may
// span lines but never a quote or semicolon, so it cannot pair an unrelated
// "from" with an earlier statement), dynamic `import("x")`, and bare `import "x"`.
const SPEC_RE =
  /(?:\bimport|\bexport)\b[^'";]*?\bfrom\s*['"]([^'"\n]+)['"]|\bimport\(\s*['"]([^'"\n]+)['"]\s*\)|\bimport\s+['"]([^'"\n]+)['"]/g;
const SRC_RE = /<script[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;
const IMPORTMAP_RE = /<script[^>]*\btype\s*=\s*["']importmap["'][^>]*>([\s\S]*?)<\/script>/i;

function specifiersIn(file, text) {
  const specs = [];
  if (file.endsWith('.html') || file.endsWith('.htm')) {
    for (const m of text.matchAll(SRC_RE)) specs.push(m[1]);
    const map = text.match(IMPORTMAP_RE);
    if (map) {
      try {
        for (const target of Object.values(JSON.parse(map[1]).imports || {})) specs.push(target);
      } catch {
        fail(`${posixRel(file)}: importmap is not valid JSON.`);
      }
    }
  } else {
    for (const m of text.matchAll(SPEC_RE)) specs.push(m[1] ?? m[2] ?? m[3]);
  }
  return specs;
}

// Collect every importmap "three" -> "/vendor/three/..." mapping in the whole
// dist, so a bare specifier used by any file resolves the way the browser's
// map would resolve it on the page that loads it.
const importMap = {};
for (const file of listCodeFiles(DIST)) {
  if (!/\.html?$/.test(file)) continue;
  const map = readFileSync(file, 'utf8').match(IMPORTMAP_RE);
  if (map) Object.assign(importMap, JSON.parse(map[1]).imports || {});
}

const seen = new Set();
const queue = [join(DIST, ENTRY)];
while (queue.length) {
  const file = queue.shift();
  if (seen.has(file)) continue;
  seen.add(file);
  const text = readFileSync(file, 'utf8');
  for (const spec of specifiersIn(file, text)) {
    if (/^(?:data:|https?:|#)/.test(spec)) continue;
    // resolveUrl ignores the ?v= the previous section added: the file on disk is
    // still plain game/engine.js, only the URL carries the build.
    let target = resolveUrl(file, spec);
    if (!target && importMap[spec]) target = resolveUrl(file, importMap[spec]);
    if (!target) continue; // bare specifier with no map entry: the page would fail, but that is the page's own importmap to get right
    if (target.startsWith(DIST) && !existsSync(target)) {
      fail(
        `${posixRel(file)} loads "${spec}", which is missing from dist/. ` +
          `If it lives in a new directory, add that directory to COPY_DIRS in tools/build-dist.mjs.`
      );
    }
    if (target.startsWith(DIST) && statSync(target).isFile() && /\.[cm]?js$/.test(target) && !seen.has(target)) {
      queue.push(target);
    }
  }
}

// ------------------------------------------------------- 5. root index.html

// A real page that opens the game: immediate redirect (script + meta refresh,
// either alone is enough) with a visible start link as the no-JS/no-refresh
// fallback. Paths are relative to the site root, so this works whenever dist/
// is published as the root (xCloud) and under a subpath. The target carries this
// build's stamp like every other URL here (issue #29).
const href = `${ENTRY.split('/').map(encodeURIComponent).join('/')}?${VPARAM}`;
// The links below the redirect are written with this script's own stamped()
// helper — index.html is generated after the stamping pass, like the href.
const manifestHref = stamped('./manifest.webmanifest');
const touchIconHref = stamped('./assets/icons/apple-touch-icon.png');
writeFileSync(
  join(DIST, 'index.html'),
  `<!doctype html>
<!-- dist/index.html — generated by tools/build-dist.mjs (npm run build). Do not edit; edit the build script. -->
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Look at Bobo</title>
    <!-- Issue #77: the same installable-web-app tags as the game page, so an
         "Add to Home Screen" made from THIS url behaves the same way. -->
    <link rel="manifest" href="${manifestHref}" />
    <meta name="theme-color" content="#14181f" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Look at Bobo" />
    <link rel="apple-touch-icon" href="${touchIconHref}" />
    <meta http-equiv="refresh" content="0;url=${href}" />
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%231b1e26'/%3E%3Crect x='14' y='7' width='4' height='9' rx='2' fill='%23f1ece1'/%3E%3Ccircle cx='16' cy='21' r='6' fill='%23f1ece1'/%3E%3C/svg%3E" />
    <style>
      html, body { margin: 0; height: 100%; background: #14181f; color: #f7f4ee; font: 15px/1.5 ui-sans-serif, system-ui, "Segoe UI", sans-serif; }
      main { min-height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
      h1 { font-size: 44px; margin: 0 0 6px; letter-spacing: 0.02em; }
      a { color: #e8b04a; font-weight: 800; font-size: 20px; }
    </style>
    <script>location.replace(${JSON.stringify(href)});</script>
  </head>
  <body>
    <main>
      <h1>Look at Bobo</h1>
      <p>find him, point, and shout &ldquo;LOOK AT BOBO!&rdquo;</p>
      <p><a href="${href}">start the game</a></p>
    </main>
  </body>
</html>
`
);

// --------------------------------------------- 6. audit: no un-stamped URL left

// The versioning pass above is a regex sweep over files this script did not
// write, so it is worth proving it caught everything: crawl dist/ again and fail
// if any shipped module or asset URL is still missing THIS build's stamp. A file
// added next week that reaches for a path in a shape this script does not know
// fails the build here, in the open, instead of quietly staying cache-sticky on
// a phone.
const untracked = [];
for (const file of listCodeFiles(DIST)) {
  const text = readFileSync(file, 'utf8');
  for (const url of urlsIn(file, text)) {
    if (needsStamp(url) && !HAS_OUR_STAMP.test(url)) untracked.push(`${posixRel(file)}: ${url}`);
  }
}
if (untracked.length) {
  fail(
    `${untracked.length} URL(s) in dist/ carry no build stamp, so a browser could answer them from a ` +
      `previous build (issue #29):\n  ${untracked.join('\n  ')}\n` +
      `If this is a URL shape tools/build-dist.mjs does not know how to stamp, add it there — do not skip the check.`
  );
}

// --------------------------------------------------------------- 7. build.json

// So a deploy log, a curl, or the next debug session can ask "what is live?"
// without a browser: dist/build.json names this build and its commit.
writeFileSync(
  join(DIST, 'build.json'),
  `${JSON.stringify({ build: BUILD.stamp, commit: BUILD.commit, built: BUILD.built, entry: ENTRY }, null, 2)}\n`
);

// ------------------------------------------------------------ 8. manifest

let files = 0;
let bytes = 0;
(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else {
      const s = statSync(p).size;
      files++;
      bytes += s;
      console.log(`  ${(s / 1024).toFixed(1).padStart(9)} KB  ${relative(DIST, p).split(sep).join('/')}`);
    }
  }
})(DIST);
console.log(
  `\nnpm run build: dist/ ready — build ${BUILD.stamp}${BUILD.commit ? '' : ' (no git: time-only stamp)'}, ` +
    `${files} files, ${(bytes / 1024 / 1024).toFixed(2)} MB, entry ${ENTRY}. ` +
    `${urlCount} URLs stamped ?${VPARAM}, graph + assets + stamps verified.`
);
