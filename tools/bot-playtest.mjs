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
//   npm run playtest:bot:patriot:full       # full game with Patriot Bobo
//                                         # forced on find 3 (?patriot=3&win=5,
//                                         # issue #58: his +3 wins at 5 early)

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
// Issue #58: --patriot N plays a page that FORCES Patriot Bobo on live find
// N (?patriot=N) with win=5, so his +3 ends the run early: 1 + 1 + 3 = 5.
// Without the flag the page is whatever --page says, played normally.
const PATRIOT_MODE = arg('patriot', null);

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
  const url = `${server.url}${PAGE}?gate=off&seed=11${PATRIOT_MODE ? `&win=5&patriot=${PATRIOT_MODE}` : ''}`;
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.LC?.ready === true);
  await page.evaluate(() => window.LC.play());
  const log = [`page: ${PAGE}${PATRIOT_MODE ? ` — Patriot Bobo forced on find ${PATRIOT_MODE}, win at 5 (issue #58)` : ''}`];
  const st = () => page.evaluate(() => window.LC.state());
  const target = (await st()).target;
  const reward = await page.evaluate(() => (window.LC.patriot ? window.LC.patriot().reward : 1));
  const moveHash = await page.evaluate(() => window.LC.simulate(600));
  log.push(`move-hash(600 steps): ${moveHash}`);
  log.push(`replay-hash:          ${await page.evaluate(() => window.LC.simulate(600))}`);

  const seen = [];
  const spotSeen = []; // parallel to seen on pool pages only ({spot, room, d})
  const scores = [];
  const events = [];
  const flags = []; // parallel to scores: {patriot, find, costume} per catch, null at the DAG! (issue #58)
  const waitPhase = (p, ms = 8000) => page.waitForFunction((ph) => window.LC.state().phase === ph, p, { timeout: ms });
  // the catch that reaches the target goes straight find -> win (no catch
  // phase to pause on), so a shout must wait for either arrival
  const waitCatchOrWin = (ms = 8000) =>
    page.waitForFunction(() => ['catch', 'win'].includes(window.LC.state().phase), null, { timeout: ms });
  const shout = (which) =>
    page.evaluate((w) => {
      const a = window.LC.aimAt(w);
      // Issue #70's rule, carried from the stress harness (#81): at a `hide`
      // spot the drawn cover can legitimately eat the props-visible centre
      // ray forever — the shout's find-ray (cat meshes only, cover never
      // between) is the contract, read where aimAt just parked the player.
      const probe = window.LC.aimProbe();
      const hide = w === 'bobo' && window.LC.spot ? (window.LC.spot() || {}).hide : null;
      window.LC.trigger(w === 'bobo' ? 'catch' : 'wrong'); // what aimShout() does after its raycast
      return { hits: a.hits, probe, hide };
    }, which);
  const rayTag = (r) => (r.hide ? `${r.probe} through ${r.hide}` : r.hits);
  // Where the round stands BEFORE the bot moves: the real spawn→Bobo walk,
  // not aimAt's teleport next to the cat (issue #53's "does a run tour the
  // flat" measure).
  const spawnToBobo = () =>
    page.evaluate(() => {
      const c = window.LC.catsDebug();
      return Math.hypot(c.px - c.bobo[0], c.pz - c.bobo[2]);
    });

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
    if (s.spotId) spotSeen.push({ spot: s.spotId, room: s.room, d: await spawnToBobo() }); // pool pages only (issue #53)
    if (!dagged && scores.length === 2) {
      dagged = true;
      const rD = await shout('decoy');
      events.push(`DAG! at "${s.momentId}" (ray ${rayTag(rD)})`);
      await waitPhase('wrong');
      flags.push(null);
      scores.push((await st()).score);
      continue;
    }
    const pf = {
      p: !!s.patriot,
      find: s.findNum,
      costume: await page.evaluate(() => (window.LC.patriot ? window.LC.patriot().costumeAttached : false)),
    };
    const rB = await shout('bobo');
    events.push(`shout#${catchN + 1} at "${s.momentId}" (ray ${rayTag(rB)})${pf.p ? ' [+3 PATRIOT!]' : ''}`);
    await waitCatchOrWin();
    flags.push(pf);
    scores.push((await st()).score);
    catchN++;
  }

  const fin = await st();
  const ending = await page.evaluate(() => document.getElementById('ending').textContent);
  // Rounds actually drawn from the queue: drop the boot-staged moment (it is
  // placed before the first queue draw) and the round re-seen immediately
  // after the DAG! (a DAG! does not consume — the same id appears twice in a
  // row, so dedupe consecutive repeats).
  const qi = [];
  for (let i = 1; i < seen.length; i++) if (seen[i] !== seen[i - 1]) qi.push(i);
  const q = qi.map((i) => seen[i]);
  const queueDistinct = new Set(q).size;
  // Pool pages (issue #53): the same rounds seen as SPOTS. A run's cycle must
  // draw each spot once and change rooms with every catch.
  const qs = qi.filter((i) => spotSeen[i]).map((i) => spotSeen[i]);
  const roomsAlternating = qs.every((r, i) => i === 0 || r.room !== qs[i - 1].room);
  const meanWalk = qs.length ? qs.reduce((a, r) => a + r.d, 0) / qs.length : 0;

  log.push(...events.map((e, i) => `${i + 1}. ${e}`));
  log.push(`moment order:    ${seen.join(' → ')}`);
  if (qs.length) {
    log.push(`spot order:      ${qs.map((r) => `${r.spot}[${r.room}]`).join(' → ')}`);
    log.push(`spot cycle:     ${new Set(qs.map((r) => r.spot)).size}/${qs.length} distinct, rooms ${roomsAlternating ? 'alternate' : 'STAYED put somewhere'}, spawn→Bobo mean ${meanWalk.toFixed(2)} m (min ${Math.min(...qs.map((r) => r.d)).toFixed(2)}, max ${Math.max(...qs.map((r) => r.d)).toFixed(2)})`);
  }
  log.push(`scores:          ${scores.join(', ')}`);
  if (reward > 1) log.push(`bonus reward:    +${reward} (Patriot Bobo — issue #58)`);
  const patriotFinds = flags.filter((f) => f?.p);
  if (patriotFinds.length) log.push(`patriot finds:   ${patriotFinds.map((f) => `find ${f.find} (costume ${f.costume})`).join(', ')}`);
  log.push(`queue rounds:    ${q.join(' → ')} — ${queueDistinct}/${q.length} distinct (queue cycle; first round is boot-staged, DAG! re-sees its round)`);
  log.push(`final:           score ${fin.score}/${fin.target}, phase ${fin.phase}, ending "${ending}"`);
  log.push(`min score:       ${Math.min(...scores)} (never below 0)`);
  log.push(`console errors:  ${errs.length ? errs.join(' | ') : 'none'}`);
  console.log(log.join('\n'));

  // Issue #58 made the scoreboard a little richer: a catch pays +1, or +
  // `reward` when that find is Patriot Bobo, and the win fires on score ≥
  // target — so a bonus can end the run early with fewer queue rounds. The
  // invariants below hold for every page, slice (reward 1) included: each
  // find draws a distinct type until the run ends, exactly one −1 rides the
  // DAG!, and a +reward delta appears exactly on a patriot find.
  const deltas = scores.map((v, i) => v - (i ? scores[i - 1] : 0));
  const dagAt = events.findIndex((e) => e.startsWith('DAG!'));
  const posSum = deltas.reduce((a, d, i) => a + (i === dagAt ? 0 : d), 0);
  const ruleOk =
    dagAt >= 0 &&
    deltas.reduce((a, b) => a + b, 0) === fin.score &&
    posSum - 1 === fin.score && // the one DAG! is the run's only subtraction
    deltas.every((d, i) => (i === dagAt ? d === -1 : d === 1 || d === reward)) &&
    deltas.every((d, i) => i === dagAt || d === (flags[i]?.p ? reward : 1));
  // The default run never met Patriot on seed 11 — the plan says so, and
  // --patriot mode proves the forced one behaves: once only, on find N,
  // costume on exactly then, and his +3 closes the run (5 = 1+1+3).
  const planQuiet = await page.evaluate(() => (window.LC.patriotPlan ? window.LC.patriotPlan(11, 10).every((x) => !x) : true));
  const patriotOk =
    !PATRIOT_MODE ||
    (planQuiet &&
      patriotFinds.length === 1 &&
      patriotFinds[0].find === +PATRIOT_MODE &&
      flags.every((f) => !f || f.p === f.costume) &&
      fin.patriotCount === 1 &&
      fin.score === target &&
      fin.score === 2 + reward); // +1, the DAG! refund, and the +3: 1+1+3 = 5
  const ok =
    fin.score >= target && fin.phase === 'win' && ending === 'your did it! you wind' &&
    queueDistinct === q.length && q.length >= 1 && q.length <= target &&
    (qs.length === 0 || (new Set(qs.map((r) => r.spot)).size === qs.length && roomsAlternating && qs.every((r) => r.d >= 1.2))) && // issue #53: distinct spots, rooms change, never wake on top of Bobo
    ruleOk && patriotOk &&
    events.every((e) => e.includes('ray cat-')) &&
    Math.min(...scores) >= 0 && errs.length === 0;
  process.exit(ok ? 0 : 1);
} finally {
  await browser.close().catch(() => {});
  await server.close().catch(() => {});
}
