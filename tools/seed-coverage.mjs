#!/usr/bin/env node
// tools/seed-coverage.mjs — what a live run actually contains (issue #66).
//
//   npm run seed:coverage            500 run seeds, one report
//   npm run seed:coverage -- --runs 2000 --master 5
//
// Live play draws a random run seed (src/run-seed.js), so "does the balcony ever
// come up? do I ever see Patriot Bobo?" is a question about a DISTRIBUTION, not
// about seed 11. This tool answers it by asking the game itself: it calls
// `LC.spotCycle(seed)` and `LC.patriotPlan(seed)`, which are the engine's own
// pure `pickSpotCycle` and `runPatriotPlan` — the real rules, not a copy — for
// N seeds drawn in the same shape the live picker draws them, then prints:
//
//   * every spot's share of runs, against the uniform share its moment TYPE
//     allows (one spot per type per run, so a 7-spot type can only give each
//     spot ~14% of runs — the type-per-run rule is the limit, not the seed);
//   * how often a run visits each room at all;
//   * the share of runs with at least one Patriot find, and the mean finds.
//
// A fixed master seed generates the draws, so two runs print the same numbers.
// Free and local: starts its own static server, uses the installed Chrome.

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStaticServer } from './serve.mjs';

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
const RUNS = clampInt(arg('runs', 500), 10, 20000);
const MASTER = clampInt(arg('master', 20261116), 1, 2 ** 31 - 1);

function clampInt(v, lo, hi) {
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
}

const server = await startStaticServer({ root: REPO, port: 0 });
const browser = await chromium.launch({
  executablePath: exe || undefined,
  channel: exe ? undefined : 'chrome',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

try {
  const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
  page.on('pageerror', (e) => console.error(`  page error: ${e}`));
  await page.goto(`${server.url}${PAGE}?gate=off`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.LC?.ready === true, null, { timeout: 30000 });

  const report = await page.evaluate(
    ({ runs, master }) => {
      const LC = window.LC;
      if (!LC.spotCycle || !LC.spots.length) return { error: 'this page has no spot pool — nothing to measure' };
      const SEED_MAX = 2 ** 31 - 1;
      // The live picker's shape (a plain 1…2^31-1 integer) off one fixed
      // stream, so the report repeats. mulberry32 as the engine uses it.
      let a = master >>> 0;
      const rand = () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      const spots = {};
      const rooms = {};
      const types = {};
      const order = [];
      for (const id of LC.spots) {
        const s = LC.spot(id);
        spots[id] = { n: 0, room: s.room, type: s.type };
        types[s.type] = (types[s.type] ?? 0) + 1;
        order.push(id);
      }
      const findsPerRun = LC.state().target; // a run is over at the win: ten finds
      let patriotRuns = 0;
      let patriotFinds = 0;
      let firstSpotChanges = 0;
      let prevFirst = null;
      for (let i = 0; i < runs; i++) {
        const seed = Math.floor(rand() * SEED_MAX) + 1;
        const cycle = LC.spotCycle(seed);
        const seenRooms = new Set();
        for (const id of cycle) {
          spots[id].n++;
          seenRooms.add(spots[id].room);
        }
        for (const room of seenRooms) rooms[room] = (rooms[room] ?? 0) + 1;
        const first = cycle[0] ?? null;
        if (prevFirst !== null && first !== prevFirst) firstSpotChanges++;
        prevFirst = first;
        const plan = LC.patriotPlan(seed, findsPerRun);
        const hits = plan.filter(Boolean).length;
        if (hits) patriotRuns++;
        patriotFinds += hits;
      }
      return {
        runs,
        findsPerRun,
        spots: order.map((id) => ({ id, ...spots[id], share: spots[id].n / runs, expected: 1 / types[spots[id].type] })),
        rooms: Object.entries(rooms).map(([room, n]) => ({ room, share: n / runs })).sort((x, y) => y.share - x.share),
        patriot: { runsWithFind: patriotRuns / runs, findsPerRun: patriotFinds / runs },
        firstSpotChanges: firstSpotChanges / (runs - 1 || 1),
        liveSeed: LC.runSeed(),
      };
    },
    { runs: RUNS, master: MASTER },
  );

  if (report.error) {
    console.log(`seed coverage — ${report.error}`);
    process.exitCode = 1;
  } else {
    const pct = (x) => `${(x * 100).toFixed(1)}%`;
    console.log(`seed coverage — ${report.runs} live-shaped run seeds (master ${MASTER}) on ${PAGE}, ${report.findsPerRun} finds per run`);
    console.log(`seed source on this page: ${report.liveSeed.source} — a new run ${report.liveSeed.live ? 'draws a fresh seed' : 'keeps the fixed one'} (measured over ?gate=off, so the draws are the tool's; the seeds below are drawn in the same shape a live page draws them)`);
    console.log(`\nspots — share of runs that play each one (expected = the uniform share inside its moment type, one spot per type per run)`);
    for (const s of [...report.spots].sort((x, y) => x.share - y.share))
      console.log(`  ${pct(s.share).padStart(6)}  exp ${pct(s.expected).padStart(6)}  ${s.id.padEnd(28)} ${s.room}`);
    console.log(`\nrooms — share of runs that visit the room at least once`);
    for (const r of report.rooms) console.log(`  ${pct(r.share).padStart(6)}  ${r.room}`);
    console.log(`\npatriot bobo — ${pct(report.patriot.runsWithFind)} of runs get at least one +3 find, ${(report.patriot.findsPerRun).toFixed(2)} finds per run (max 2, never first, never back to back)`);
    console.log(`the run does not start in the same place every time either: the first spot changes in ${pct(report.firstSpotChanges)} of consecutive runs`);
  }
} finally {
  await browser.close().catch(() => {});
  await server.close().catch(() => {});
}
