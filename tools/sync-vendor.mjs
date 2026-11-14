#!/usr/bin/env node
// tools/sync-vendor.mjs — copies the pinned library builds into vendor/ so the
// project can be served and deployed as plain static files with no build step.
//
//   node tools/sync-vendor.mjs          // copy node_modules -> vendor/ (+ manifest)
//   node tools/sync-vendor.mjs --check  // exit non-zero if vendor/ is out of sync
//
// Everything in the game is written in code. The only vendored thing is the
// Three.js library itself; see vendor/README.md for provenance.

import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const THREE_VERSION = (pkg.devDependencies?.three || '').replace(/^[\^~]/, '');

// What gets vendored: [source relative to node_modules, destination relative to vendor/]
const FILES = [
  ['three/build/three.module.js', 'three/three.module.js'],
  ['three/build/three.core.js', 'three/three.core.js'],
  ['three/LICENSE', 'three/LICENSE'],
];

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

const manifestPath = join(ROOT, 'vendor', 'manifest.json');
const wanted = {
  generatedBy: 'tools/sync-vendor.mjs',
  three: { version: THREE_VERSION, files: {} },
};

let dirty = false;
const rows = [];

for (const [srcRel, dstRel] of FILES) {
  const src = join(ROOT, 'node_modules', srcRel);
  const dst = join(ROOT, 'vendor', dstRel);
  if (!existsSync(src)) {
    console.error(`Missing ${srcRel} in node_modules. Run \`npm install\` first.`);
    process.exit(2);
  }
  const buf = readFileSync(src);
  const hash = sha256(buf);
  wanted.three.files[dstRel] = { sha256: hash, bytes: buf.length };

  const current = existsSync(dst) ? readFileSync(dst) : null;
  const inSync = current !== null && sha256(current) === hash;
  if (!inSync) {
    dirty = true;
    if (!CHECK) {
      mkdirSync(dirname(dst), { recursive: true });
      copyFileSync(src, dst);
    }
  }
  rows.push(`${inSync ? 'in sync  ' : 'OUT SYNC '} vendor/${dstRel}  ${hash.slice(0, 12)}  ${(buf.length / 1024).toFixed(0)} KB`);
}

const manifestCurrent = existsSync(manifestPath) ? readFileSync(manifestPath, 'utf8') : '';
const manifestNext = JSON.stringify({ ...wanted, manifest: 'vendor/manifest.json' }, null, 2) + '\n';
if (manifestCurrent !== manifestNext) {
  dirty = true;
  if (!CHECK) writeFileSync(manifestPath, manifestNext);
}

for (const row of rows) console.log(row);

if (CHECK) {
  if (dirty) {
    console.error('\nvendor/ does not match the pinned dependency. Run `npm install && npm run vendor`.');
    process.exit(1);
  }
  console.log(`\nvendor/ matches three@${THREE_VERSION}.`);
} else {
  console.log(`\n${dirty ? 'Updated' : 'Already up to date'} vendor/ from three@${THREE_VERSION}.`);
}
