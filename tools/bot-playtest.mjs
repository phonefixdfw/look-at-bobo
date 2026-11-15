#!/usr/bin/env node
// tools/bot-playtest.mjs — a scripted playthrough of the Step 6 slice using
// only the public game APIs (no internal shortcuts): play, aim with the
// centre ray (LC.aimAt reports what the ray really hits), shout, take a
// wrong cat, win at the default target of 5. It records the moment order,
// the score after every event, the move-hash replay, the exact ending text
// and any console errors, and exits non-zero if the run is not a clean win.
//
// Free and local: starts its own static server, uses the installed Chrome.
// The full log lives in docs/PLAYTEST_NOTES.md.
//
//   npm run playtest:bot

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStaticServer } from './serve.mjs';

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
  await page.goto(`${server.url}game/slice.html?gate=off&seed=11`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.LC?.ready === true);
  await page.evaluate(() => window.LC.play());
  const log = [];
  const st = () => page.evaluate(() => window.LC.state());
  const moveHash = await page.evaluate(() => window.LC.simulate(600));
  log.push(`move-hash(600 steps): ${moveHash}`);
  log.push(`replay-hash:          ${await page.evaluate(() => window.LC.simulate(600))}`);

  const seen = [];
  const scores = [];
  const events = [];
  const waitPhase = (p, ms = 8000) => page.waitForFunction((ph) => window.LC.state().phase === ph, p, { timeout: ms });
  const shout = (which) =>
    page.evaluate((w) => {
      const a = window.LC.aimAt(w);
      window.LC.trigger(w === 'bobo' ? 'catch' : 'wrong'); // what aimShout() does after its raycast
      return a.hits;
    }, which);

  for (let i = 0; i < 3; i++) {
    await waitPhase('find');
    const s = await st();
    seen.push(s.momentId);
    events.push(`shout#${i + 1} at "${s.momentId}" (ray ${await shout('bobo')})`);
    await waitPhase('catch');
    scores.push((await st()).score);
  }
  await waitPhase('find');
  const mid = await st();
  seen.push(mid.momentId);
  events.push(`DAG! at "${mid.momentId}" (ray ${await shout('decoy')})`);
  await waitPhase('wrong');
  scores.push((await st()).score);
  for (let i = 0; i < 3; i++) {
    await waitPhase('find');
    const s = await st();
    seen.push(s.momentId);
    events.push(`shout#${i + 4} at "${s.momentId}" (ray ${await shout('bobo')})`);
    await waitPhase(i === 2 ? 'win' : 'catch');
    scores.push((await st()).score);
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
  log.push(`queue rounds:    ${q.join(' → ')} — ${queueDistinct}/5 distinct (queue cycle; first round is boot-staged, DAG! re-sees its round)`);
  log.push(`final:           score ${fin.score}/${fin.target}, phase ${fin.phase}, ending "${ending}"`);
  log.push(`min score:       ${Math.min(...scores)} (never below 0)`);
  log.push(`console errors:  ${errs.length ? errs.join(' | ') : 'none'}`);
  console.log(log.join('\n'));

  const ok =
    fin.score === 5 && fin.phase === 'win' && ending === 'your did it! you wind' &&
    queueDistinct === 5 && q.length === 5 &&
    events.every((e) => e.includes('ray cat-')) &&
    Math.min(...scores) >= 0 && errs.length === 0;
  process.exit(ok ? 0 : 1);
} finally {
  await browser.close().catch(() => {});
  await server.close().catch(() => {});
}
