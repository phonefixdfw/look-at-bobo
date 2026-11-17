#!/usr/bin/env node
// tools/audio/slice-check.mjs — proves the Step 6 slice's audio is REAL audio
// in a plain browser: real Chrome, NO autoplay flags, a real trusted click on
// the click-to-begin gate, then the game's own events fired through its own
// paths (LC.trigger — the exact call aimShout() makes after its raycast)
// while the LIVE loop runs, because cues only fire from the live loop.
//
// It also proves the aim path headlessly: LC.aimAt() walks the player onto
// walkable floor with a clear line to a cat and reports which cat the CENTRE
// RAY hits — 'cat-bobo' before a catch, 'cat-decoy' before a DAG! — so the
// sound the check listens for is the sound the shout would really play.
//
// Evidence per line: requested → started → ended, plus Chrome's decoder
// duration against docs/VOICES.md. Before the click nothing may play.
// Quick win via ?win=3 so the win line is reachable in one catch.
//
// Free and local: starts its own static server, uses the installed Chrome.
// No API key, no network, no spend.
//
//   npm run audio:slicecheck

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startStaticServer } from '../serve.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(join(REPO, 'package.json'));
const { chromium } = require('playwright-core');

const CHROME = ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
const executablePath = CHROME.find(existsSync);

// Which page to check: the slice by default; `--page game/full.html` runs the
// identical audio contract against the full game (its own boot, same cues).
const argv = process.argv.slice(2);
const PAGE = argv.includes('--page') ? argv[argv.indexOf('--page') + 1] : 'game/slice.html';

const results = [];
let failed = 0;
const check = (name, ok, extra = '') => {
  results.push(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
  if (!ok) failed++;
};

// The shipped picks, read from src/audio.js so this check can never drift
// from the page's data (it compares behaviour, not filenames it typed itself).
const { VOICE_LINES } = await import(pathToFileURL(join(REPO, 'src/audio.js')).href);
const shortName = (f) => f.split('/').pop();

const server = await startStaticServer({ root: REPO, port: 0 });
// NO --autoplay-policy flag on purpose: a real browser's rules apply.
const browser = await chromium.launch({
  executablePath: executablePath || undefined,
  channel: executablePath ? undefined : 'chrome',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
const consoleErrors = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push(String(e)));

const lineNamed = (status, key) => status.lines.find((l) => l.file === VOICE_LINES[key].file);
const waitFor = (fn, label, ms = 60000) =>
  page
    .waitForFunction(fn, null, { timeout: ms })
    .then(() => true)
    .catch(() => {
      results.push(`  FAIL  ${label} — timed out after ${ms / 1000}s`);
      failed++;
      return false;
    });

try {
  const resp = await page.goto(`${server.url}${PAGE}?win=3`, { waitUntil: 'load', timeout: 30000 });
  check('page-served', resp?.status() === 200, `HTTP ${resp?.status()}`);
  await page.waitForFunction(() => window.LCError || (window.LC && window.LC.ready === true), null, { timeout: 40000 });
  check('page-boots', !(await page.evaluate(() => window.LCError)), await page.evaluate(() => window.LCError ?? 'LC.ready'));

  // --- before the click: nothing may play, and nothing may error ----------
  const before = await page.evaluate(() => {
    window.LC.play(); // running the loop with a locked engine must be a no-op
    window.LC.trigger('catch');
    const s = window.LC.audioStatus();
    return { unlocked: s.unlocked, gateOpen: window.LC.gateUnlocked(), gateHidden: document.getElementById('gate').classList.contains('hidden'), lines: s.lines };
  });
  check('gate-locks-audio', before.unlocked === false && before.gateOpen === false && before.gateHidden === false, 'audio + gate closed before any click');
  check('no-playback-before-click', before.lines.every((l) => l.requested === 0 && l.started === 0), before.lines.map((l) => `${shortName(l.file)} req=${l.requested}`).join(', '));

  // --- the real gesture: a trusted click on the gate ----------------------
  await page.click('#gate-btn');
  const after = await page.evaluate(() => ({ ...window.LC.audioStatus(), gateOpen: window.LC.gateUnlocked(), state: window.LC.state() }));
  check('click-opens-gate', after.unlocked === true && after.gateOpen === true, 'gate hidden, engine unlocked by the click');

  // the click also STARTS the game; LC.restart() runs the game's own reset so
  // the pre-click test trigger leaves nothing behind. The live loop — and
  // only the live loop — is what fires voice cues.
  await page.evaluate(() => window.LC.restart());
  const advanced = await waitFor(() => window.LC.state().time > 0.3 && !window.LC.state().paused, 'live-loop-advances', 8000);
  if (advanced) check('live-loop-advances', true, 'the started game runs unpaused (pointer lock optional, never a freeze)');
  const hud = await page.evaluate(() => ({
    max: document.getElementById('hud-score').querySelector('.max').textContent,
    num: document.getElementById('hud-score').querySelector('.num').textContent,
  }));
  check('hud-target-from-param', hud.max.replace(/\s/g, '') === '/03' && hud.num === '00', `HUD reads ${hud.num} ${hud.max} (win at 3 via ?win=3)`);

  // --- the aim path, headlessly: where does the CENTRE RAY land? ----------
  // Issue #70's split applies here too: this boots LIVE (?win=3, no gate=off),
  // so the seed — and the drawn spots — roll every run, and a `hide` spot
  // (six now, incl. the in-tub nap no visual ray reaches from anywhere)
  // legitimately reads wall/prop on the props-visible centre ray. Open spots
  // keep the visual rule; hidden ones are proven through the engine's own
  // crosshair find-ray (cat meshes only — exactly what a shout uses).
  const aimRule = (which) =>
    page.evaluate((w) => {
      const a = window.LC.aimAt(w);
      const st = window.LC.state();
      const rec = window.LC.spot(w === 'decoy' ? st.decoyId : st.spotId); // null on the slice (no pool)
      return { x: a.x, z: a.z, hits: a.hits, probe: window.LC.aimProbe(), hide: rec && rec.hide ? String(rec.hide) : null };
    }, which);
  const aimBobo = await aimRule('bobo');
  check(
    'aim-ray-hits-bobo',
    (aimBobo.hide ? aimBobo.probe : aimBobo.hits) === 'cat-bobo',
    `stood at (${aimBobo.x}, ${aimBobo.z}) → ${aimBobo.hide ? `${aimBobo.hide}: find-ray ${aimBobo.probe} (visual ${aimBobo.hits})` : `ray hits ${aimBobo.hits}`}`,
  );
  const aimDecoy = await aimRule('decoy');
  check(
    'aim-ray-hits-decoy',
    (aimDecoy.hide ? aimDecoy.probe : aimDecoy.hits) === 'cat-decoy',
    `stood at (${aimDecoy.x}, ${aimDecoy.z}) → ${aimDecoy.hide ? `${aimDecoy.hide}: find-ray ${aimDecoy.probe} (visual ${aimDecoy.hits})` : `ray hits ${aimDecoy.hits}`}`,
  );

  // --- the catch: yell take 1 plays to the end -----------------------------
  await page.evaluate(() => window.LC.aimAt('bobo'));
  await page.evaluate(() => window.LC.trigger('catch')); // the exact call aimShout makes on a bobo hit
  await waitFor(() => window.LC.audioStatus().lines.some((l) => l.file.includes('yell') && l.started > 0), 'catch-yell-starts');
  await waitFor(() => window.LC.audioStatus().lines.some((l) => l.file.includes('yell') && l.ended > 0), 'catch-yell-ends');
  const catchState = await page.evaluate(() => ({ status: window.LC.audioStatus(), state: window.LC.state() }));
  const yell = lineNamed(catchState.status, 'yell');
  check('catch-yell-played-through', yell.started >= 1 && yell.ended >= 1 && !yell.error, `started=${yell?.started} ended=${yell?.ended} err=${yell?.error ?? 'none'}`);
  check('catch-yell-duration', Math.abs((yell?.duration ?? 0) - VOICE_LINES.yell.dur) <= 0.25, `${yell?.duration?.toFixed(2)}s vs docs ${VOICE_LINES.yell.dur}s`);
  check('catch-score-rules', catchState.state.score === 1 && catchState.state.phase === 'catch', `score ${catchState.state.score}, phase ${catchState.state.phase}`);

  // --- the wrong cat: yell again, then the DAG!, and the moment survives ---
  const momentBefore = (await page.evaluate(() => window.LC.state())).momentId;
  await page.evaluate(() => window.LC.aimAt('decoy'));
  await page.evaluate(() => window.LC.trigger('wrong'));
  await waitFor(() => window.LC.audioStatus().lines.some((l) => l.file.includes('dag') && l.ended > 0), 'wrong-dag-ends');
  const wrongState = await page.evaluate(() => ({ status: window.LC.audioStatus(), state: window.LC.state() }));
  const yell2 = lineNamed(wrongState.status, 'yell');
  const dag = lineNamed(wrongState.status, 'dag');
  check('wrong-yell-again', yell2.started >= 2, `yell started=${yell2.started} (you shout first — you thought it was Bobo)`);
  check('wrong-dag-played-through', dag.started >= 1 && dag.ended >= 1 && !dag.error, `started=${dag?.started} ended=${dag?.ended} err=${dag?.error ?? 'none'}`);
  check('wrong-dag-duration', Math.abs((dag?.duration ?? 0) - VOICE_LINES.dag.dur) <= 0.25, `${dag?.duration?.toFixed(2)}s vs docs ${VOICE_LINES.dag.dur}s`);
  check('wrong-score-rules', wrongState.state.score === 0, `score floored at ${wrongState.state.score} (was 1)`);
  await waitFor(() => window.LC.state().phase === 'find', 'wrong-ends-back-to-find', 10000);
  const momentAfter = (await page.evaluate(() => window.LC.state())).momentId;
  check('wrong-does-not-consume-moment', momentAfter === momentBefore, `"${momentBefore}" → after the DAG! → "${momentAfter}" (a DAG! is not a guess)`);

  // --- the win: the configured target, the exact line, the rain ------------
  await page.evaluate(() => {
    window.LC.setScore(2); // win=3: one more catch ends the game
    window.LC.trigger('catch');
  });
  await waitFor(() => window.LC.audioStatus().lines.some((l) => l.file.includes('win-line') && l.ended > 0), 'win-line-ends');
  const winState = await page.evaluate(() => ({
    status: window.LC.audioStatus(),
    state: window.LC.state(),
    ending: document.getElementById('ending').textContent,
    endingShown: getComputedStyle(document.getElementById('ending')).display !== 'none',
  }));
  const win = lineNamed(winState.status, 'win');
  check('win-line-played-through', win.started >= 1 && win.ended >= 1 && !win.error, `started=${win?.started} ended=${win?.ended} err=${win?.error ?? 'none'}`);
  check('win-line-duration', Math.abs((win?.duration ?? 0) - VOICE_LINES.win.dur) <= 0.25, `${win?.duration?.toFixed(2)}s vs docs ${VOICE_LINES.win.dur}s`);
  check('win-score-and-text', winState.state.score === 3 && winState.state.phase === 'win' && winState.ending === 'your did it! you wind' && winState.endingShown, `score ${winState.state.score}, ending "${winState.ending}"`);
  const frozen = await page.evaluate(() => {
    window.LC.trigger('wrong'); // after the win, nothing moves the number
    return window.LC.state();
  });
  check('score-frozen-after-win', frozen.score === 3 && frozen.phase === 'win', `wrong after win: score ${frozen.score}, phase ${frozen.phase}`);

  check('no-engine-errors', [yell, dag, win].every((l) => !l.error), [yell, dag, win].map((l) => `${shortName(l.file)}:${l.error ?? 'ok'}`).join(', '));
  check('console-clean', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
} finally {
  await browser.close().catch(() => {});
  await server.close().catch(() => {});
}

console.log(results.join('\n'));
console.log(`\n${results.filter((r) => r.startsWith('  PASS')).length}/${results.length} slice audio checks passed`);
process.exit(failed ? 1 : 0);
