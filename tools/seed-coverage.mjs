#!/usr/bin/env node
// tools/seed-coverage.mjs — what a RANDOM live run actually looks like (issue #66).
//
// Before #66 every live game played seed 11, so the interesting question was
// "what does seed 11 draw". It is not any more: a live page draws a fresh
// random seed at boot and again for every new run. This tool answers the
// question that replaced it — is the spot pool really being used? — by pushing
// a few hundred random seeds through the SAME two pure functions the engine
// plays with (LC.spotCycle → pickSpotCycle, LC.patriotPlan → runPatriotPlan)
// and reporting:
//
//   * the share of runs each of the 30 spots appears in, by room and by type
//   * the share of runs with at least one Patriot Bobo, and the average number
//     of Patriot finds per run
//   * the run seed 11 gave everybody, for contrast
//
// The seed list comes from a fixed base, so the table is reproducible; the
// seeds are 31-bit random-shaped integers, the kind a live page draws.
//
//   npm run seed:coverage
//   node tools/seed-coverage.mjs --seeds 2000 --page game/full.html --base 7

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStaticServer } from './serve.mjs';
import { SPOTS, MOMENT_IDS, spotRoom, ROOM_LABELS } from '../game/full-level.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(REPO, 'package.json'));
const { chromium } = require('playwright-core');
const exe = ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(existsSync);

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : dflt;
};
const PAGE = arg('page', 'game/full.html');
const RUNS = Number(arg('seeds', 500));
const BASE = Number(arg('base', 0x6c6b6f62)) >>> 0;

/** The same dice the engine uses, here only to make a REPRODUCIBLE list of
 *  random-shaped seeds. The runs themselves are drawn in the page. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SEED_MAX = 2 ** 31 - 1;
const dice = mulberry32(BASE);
const seeds = Array.from({ length: RUNS }, () => 1 + Math.floor(dice() * SEED_MAX));

const server = await startStaticServer({ root: REPO, port: 0 });
const browser = await chromium.launch({
  executablePath: exe || undefined,
  channel: exe ? undefined : 'chrome',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const errors = [];
let exitCode = 0;
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${server.url}${PAGE}?gate=off&seed=11`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.LC?.ready === true, null, { timeout: 30000 });

  // Counting happens in the page, against the engine's own draws: nothing here
  // reimplements a rule, so nothing here can drift from one. The room table is
  // handed in as data (game/full-level.js is a table, not logic).
  // #86: `sceneOnly` spots (the owner's lap) are never drawn by the cycle —
  // the engine swaps into them when the lap scene plans — so they are not
  // part of what this tool measures ("what a seeded cycle draws").
  const drawn = SPOTS.filter((s) => !s.sceneOnly);
  const sceneOnlyIds = SPOTS.filter((s) => s.sceneOnly).map((s) => s.id);
  const roomOf = new Map(SPOTS.map((s) => [s.id, s.room]));
  const agg = await page.evaluate(([seedList, finds, roomEntries]) => {
    const roomOf = new Map(roomEntries);
    const spotRuns = {};
    const typeRuns = {};
    const roomRuns = {};
    let patriotRuns = 0;
    let totalFinds = 0;
    for (const s of seedList) {
      const cycle = window.LC.spotCycle(s);
      const rooms = new Set();
      for (const id of cycle) {
        spotRuns[id] = (spotRuns[id] ?? 0) + 1;
        typeRuns[id.split('.')[0]] = (typeRuns[id.split('.')[0]] ?? 0) + 1;
        rooms.add(roomOf.get(id) ?? '?');
      }
      for (const r of rooms) roomRuns[r] = (roomRuns[r] ?? 0) + 1;
      const plan = window.LC.patriotPlan(s, finds);
      const hits = plan.filter(Boolean).length;
      if (hits > 0) patriotRuns++;
      totalFinds += hits;
    }
    return {
      spotRuns, typeRuns, roomRuns, patriotRuns, totalFinds, n: seedList.length,
      spotCycleOfEleven: window.LC.spotCycle(11),
      planOfEleven: window.LC.patriotPlan(11, finds),
    };
  }, [seeds, MOMENT_IDS.length, [...roomOf]]);

  const n = agg.n;
  const pct = (x) => `${((x / n) * 100).toFixed(1)}%`;
  const roomTotals = new Map();
  for (const [id, count] of Object.entries(agg.spotRuns)) {
    const r = roomOf.get(id) ?? '?';
    roomTotals.set(r, (roomTotals.get(r) ?? 0) + count);
  }

  console.log(`Look at Bobo — random-seed coverage (issue #66)`);
  console.log(`page ${PAGE} · ${n} random seeds (base 0x${BASE.toString(16)}) · 10 finds per run\n`);
  console.log('SHARE OF RUNS EACH SPOT APPEARS IN');
  const rows = drawn.map((s) => [s.id, agg.spotRuns[s.id] ?? 0]).sort((a, b) => b[1] - a[1]);
  for (const [id, count] of rows) {
    const room = roomOf.get(id) ?? '?';
    const label = ROOM_LABELS?.[room] ?? room;
    console.log(`  ${pct(count).padStart(6)}  ${label.padEnd(12)} ${id}`);
  }
  const never = rows.filter(([, c]) => c === 0).map(([id]) => id);
  const rarest = rows[rows.length - 1];

  console.log('\nROOMS  (picks per run out of 10, and the share of runs that set foot in the room at all)');
  for (const [room, count] of [...roomTotals].sort((a, b) => b[1] - a[1])) {
    const label = ROOM_LABELS?.[room] ?? room;
    const touch = agg.roomRuns[room] ?? 0;
    console.log(`  ${(count / n).toFixed(2)} picks/run · ${pct(touch).padStart(6)} of runs  ${label}`);
  }
  console.log('\nONE SPOT PER MOMENT TYPE PER RUN (so every type plays in 100% of runs)');
  const perType = MOMENT_IDS.map((t) => {
    const own = drawn.filter((s) => s.type === t).map((s) => s.id);
    const shares = own.map((id) => (agg.spotRuns[id] ?? 0) / n);
    return { t, own: own.length, min: Math.min(...shares), max: Math.max(...shares) };
  });
  for (const { t, own, min, max } of perType.sort((a, b) => b.own - a.own)) {
    const spread = own > 1 ? ` → ${(min * 100).toFixed(0)}…${(max * 100).toFixed(0)}% per spot` : ' → the only spot of its type';
    console.log(`  100.0%  ${t.padEnd(18)} ${own} spot${own > 1 ? 's' : ''} to choose between${spread}`);
  }
  const patriotShare = agg.patriotRuns / n;
  const perRun = agg.totalFinds / n;
  console.log('\nPATRIOT BOBO');
  console.log(`  runs with at least one find : ${pct(agg.patriotRuns)} (${agg.patriotRuns}/${n})`);
  console.log(`  average finds per run       : ${perRun.toFixed(2)}`);
  console.log(`  rule                        : 1 in 6 after the first find, never back-to-back, max two per run`);
  console.log('\nTHE RUN EVERYBODY USED TO GET (seed 11, the old default)');
  console.log(`  spots : ${agg.spotCycleOfEleven.join(', ')}`);
  console.log(`  patriot finds: ${agg.planOfEleven.filter(Boolean).length}`);

  console.log('\nREAD IT LIKE THIS');
  if (sceneOnlyIds.length) {
    console.log(`  * excluded (sceneOnly — the cycle can never draw them, the engine`);
    console.log(`    swaps in): ${sceneOnlyIds.join(', ')} · the lap scene plans ~1 run in 5`);
  }
  console.log(`  * every spot is drawn: ${never.length === 0 ? 'yes' : `NO — never drawn: ${never.join(', ')}`}`);
  console.log(`  * rarest spot: ${rarest[0]} at ${pct(rarest[1])} of runs`);
  console.log('  * the one-spot-per-moment-type rule is what caps a room: hall-chase owns');
  console.log(`    ${SPOTS.filter((s) => s.type === 'hall-chase').length} spots across ${new Set(SPOTS.filter((s) => s.type === 'hall-chase').map((s) => s.room)).size} rooms but only ONE of them is played per run, so each of its`);
  console.log('    places lands in ~15% of runs, and the bathroom in about that many.');
  if (never.length) exitCode = 1;
  if (errors.length) {
    exitCode = 1;
    console.log(`\nCONSOLE ERRORS: ${errors.slice(0, 4).join(' | ')}`);
  }
} finally {
  await browser.close().catch(() => {});
  await server.close().catch(() => {});
}
process.exit(exitCode);
