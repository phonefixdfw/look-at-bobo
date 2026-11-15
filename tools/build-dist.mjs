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
//     immediately redirects to ENTRY.
//
// It never copies: tools/, docs/, captures/, demo/, design/, node_modules/, .git,
// .env* or anything else not listed. Then it VERIFIES the result: every module
// the entry imports (transitively, importmap included) and every referenced
// asset must exist inside dist/ — a missing one fails the build loudly instead
// of shipping a runtime 404.

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// ------------------------------------------------------------------ config

/** The current game entry page, relative to the repo root. Step 8 may rename
 *  or replace it — this is the ONLY constant to change; the build fails loudly
 *  if the file is missing. */
const ENTRY = 'game/slice.html';

/** Directories the game loads from at runtime. Copied wholesale (never
 *  filtered per-file) so new files in them ship automatically. */
const COPY_DIRS = ['game', 'src', 'vendor/three'];

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
    let target;
    if (spec.startsWith('/')) target = join(DIST, spec);
    else if (spec.startsWith('.')) target = resolve(dirname(file), spec);
    else if (importMap[spec]) target = join(DIST, importMap[spec]);
    else continue; // bare specifier with no map entry: the page would fail, but that is the page's own importmap to get right
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
// is published as the root (xCloud) and under a subpath.
const href = ENTRY.split('/').map(encodeURIComponent).join('/');
writeFileSync(
  join(DIST, 'index.html'),
  `<!doctype html>
<!-- dist/index.html — generated by tools/build-dist.mjs (npm run build). Do not edit; edit the build script. -->
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Look at Bobo</title>
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

// ------------------------------------------------------------ 6. manifest

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
console.log(`\nnpm run build: dist/ ready — ${files} files, ${(bytes / 1024 / 1024).toFixed(2)} MB, entry ${ENTRY} (graph + assets verified).`);
