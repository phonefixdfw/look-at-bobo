#!/usr/bin/env node
// tools/bot-playtest.mjs — a scripted playthrough using only the public game
// APIs (no internal shortcuts): play, aim with the centre ray (LC.aimAt
// reports what the ray really hits), shout, take a wrong cat, and win at the
// page's own target. It records the moment order, the score after every
// event, the move-hash replay, the exact ending text and any console errors,
// and exits non-zero if the run is not a clean win.
//
// The script is target-agnostic: it plays to LC.state().target, so it drives
// both the Step 6 slice (win at 5) and the full game (win at 10).
//
// Free and local: starts its own static server, uses the installed Chrome.
// The full log lives in docs/PLAYTEST_NOTES.md.
//
//   npm run playtest:bot                    # slice
//   npm run playtest:bot:full               # full game (win at 10)

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStaticServer } from './serve.mjs';

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : dflt;
};
const PAGE = arg('page', 'game/slice.html');

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(REPO, 'package.json'));
const { chromium } = require('playwright-core');
const exe = ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(existsSync);

const server = await startStaticServer({ root: REPO, port: 0 });
const browser = await chromium.launch({
  executablePath: exe || undefined,
  channel: exe ? undefined : 'chrome',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
const errs = [];
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
page.on('pageerror', (e) => errs.push(String(e)));

try {
  await page.goto(`${server.url}${PAGE}?gate=off&seed=11`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.LC?.ready === true);
  await page.evaluate(() => window.LC.play());
  const log = [`page: ${PAGE}`];
  const st = () => page.evaluate(() => window.LC.state());
  const target = (await st()).target;
  const moveHash = await page.evaluate(() => window.LC.simulate(600));
  log.push(`move-hash(600 steps): ${moveHash}`);
  log.push(`replay-hash:          ${await page.evaluate(() => window.LC.simulate(600))}`);

  const seen = [];
  const scores = [];
  const events = [];
  const waitPhase = (p, ms = 8000) => page.waitForFunction((ph) => window.LC.state().phase === ph, p, { timeout: ms });
  // the catch that reaches the target goes straight find -> win (no catch
  // phase to pause on), so a shout must wait for either arrival
  const waitCatchOrWin = (ms = 8000) =>
    page.waitForFunction(() => ['catch', 'win'].includes(window.LC.state().phase), null, { timeout: ms });
  const shout = (which) =>
    page.evaluate((w) => {
      const a = window.LC.aimAt(w);
      window.LC.trigger(w === 'bobo' ? 'catch' : 'wrong'); // what aimShout() does after its raycast
      return a.hits;
    }, which);

  // Play to the target, with exactly one deliberate DAG! after the second
  // point: the wrong cat must cost one point, not the run.
  let dagged = false;
  let catchN = 0;
  let n = 0;
  while (n++ < 60) {
    const now = await st();
    if (now.phase === 'win') break;
    await waitPhase('find');
    const s = await st();
    seen.push(s.momentId);
    if (!dagged && scores.length === 2) {
      dagged = true;
      events.push(`DAG! at "${s.momentId}" (ray ${await shout('decoy')})`);
      await waitPhase('wrong');
      scores.push((await st()).score);
      continue;
    }
    events.push(`shout#${catchN + 1} at "${s.momentId}" (ray ${await shout('bobo')})`);
    await waitCatchOrWin();
    scores.push((await st()).score);
    catchN++;
  }

  const fin = await st();
  const ending = await page.evaluate(() => document.getElementById('ending').textContent);
  // Rounds actually drawn from the queue: drop the boot-staged moment (it is
  // placed before the first queue draw) and the round re-seen immediately
  // after the DAG! (a DAG! does not consume — the same id appears twice in a
  // row, so dedupe consecutive repeats).
  const q = [];
  for (let i = 1; i < seen.length; i++) if (seen[i] !== seen[i - 1]) q.push(seen[i]);
  const queueDistinct = new Set(q).size;

  log.push(...events.map((e, i) => `${i + 1}. ${e}`));
  log.push(`moment order:    ${seen.join(' → ')}`);
  log.push(`scores:          ${scores.join(', ')}`);
  log.push(`queue rounds:    ${q.join(' → ')} — ${queueDistinct}/${target} distinct (queue cycle; first round is boot-staged, DAG! re-sees its round)`);
  log.push(`final:           score ${fin.score}/${fin.target}, phase ${fin.phase}, ending "${ending}"`);
  log.push(`min score:       ${Math.min(...scores)} (never below 0)`);
  log.push(`console errors:  ${errs.length ? errs.join(' | ') : 'none'}`);
  console.log(log.join('\n'));

  const ok =
    fin.score === target && fin.phase === 'win' && ending === 'your did it! you wind' &&
    queueDistinct === target && q.length === target &&
    events.filter((e) => !e.startsWith('DAG!')).length === target + 1 && // target points, one shout refunded by the DAG!
    events.every((e) => e.includes('ray cat-')) &&
    Math.min(...scores) >= 0 && errs.length === 0;
  process.exit(ok ? 0 : 1);
} finally {
  await browser.close().catch(() => {});
  await server.close().catch(() => {});
}
