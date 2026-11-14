#!/usr/bin/env node
// tools/gate.mjs — proves the debugging tool itself works, in one command.
//
//   npm run gate
//
// It runs the test scene capture and expects it to PASS, then injects each known
// fault and expects the tool to FAIL, naming the check that caught it. A tool that
// only ever says "pass" proves nothing, so both directions are tested.
// Also checks that vendor/ still matches the pinned Three.js.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** [label, extra args, expected exit, what must fail (a selfTest check or a tool failure)] */
const CASES = [
  ['clean scene', [], 0, null],
  ['box floated 5 cm', ['--param', 'plant=lift'], 1, 'box-bottom-to-floor'],
  ['box sunk into floor', ['--param', 'plant=sink'], 1, 'box-bottom-to-floor'],
  ['stick clipped into box', ['--param', 'plant=jam'], 1, 'stick-no-box-clipping'],
  ['ending text "fixed"', ['--param', 'plant=text'], 1, 'ending-text-exact'],
  ['scene lies about its cost', ['--param', 'plant=stats'], 1, 'stats-understated'],
];

const BASE = ['tools/capture.mjs', 'tools/testscene.html', '--times', '2.4', '--views', 'overview', '--moments', 'default,win'];

let ok = true;

console.log('Look at Bobo — tool self-check\n');

// 1. Vendored library still matches the pinned dependency.
const vendor = spawnSync(process.execPath, ['tools/sync-vendor.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' });
const vendorOk = vendor.status === 0;
ok &&= vendorOk;
console.log(`${vendorOk ? 'PASS' : 'FAIL'}  vendor/ matches the pinned three`);

// 2. The captures: one clean run that must pass, each planted fault that must be caught.
for (const [label, extra, expectedExit, expectedCheck] of CASES) {
  const out = `captures/gate/${expectedCheck ? 'planted' : 'clean'}`;
  const run = spawnSync(process.execPath, [...BASE, ...extra, '--out', out, '--no-sheet'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  const exitOk = run.status === expectedExit;

  let detail = '';
  let checkOk = true;
  try {
    const report = JSON.parse(readFileSync(join(ROOT, out, 'report.json'), 'utf8'));
    const failed = report.selfTest.checks.filter((c) => !c.pass);
    if (expectedCheck) {
      const hit = failed.find((c) => c.name === expectedCheck);
      // Some faults are caught by the scene's own checks, some by the tool's own
      // measurements (a budget number, or stats that under-report what the GPU saw).
      const toolHit = (report.failures || []).find((f) => f.includes(expectedCheck));
      checkOk = Boolean(hit || toolHit);
      detail = hit
        ? `caught by ${hit.name} = ${hit.value} (limit ${hit.limit})`
        : toolHit
          ? `caught by the tool: ${toolHit.replace(/^frame #\d+ \([^)]*\): /, '')}`
          : `nothing named "${expectedCheck}" failed; verdict ${report.verdict}`;
    } else {
      checkOk = report.verdict === 'PASS' && failed.length === 0;
      detail = `verdict ${report.verdict}, ${report.selfTest.checks.length} checks, ${report.frames.length} frames`;
    }
  } catch (err) {
    checkOk = false;
    detail = `no report.json (${err.message})`;
  }

  const pass = exitOk && checkOk;
  ok &&= pass;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label.padEnd(22)} exit ${run.status} (wanted ${expectedExit}) · ${detail}`);
  if (!pass && run.stdout) console.log(run.stdout.trimEnd().replace(/^/gm, '      '));
}

console.log(`\n${ok ? 'GATE: PASS — the tool catches what it claims to catch.' : 'GATE: FAIL — see above.'}`);
process.exit(ok ? 0 : 1);
