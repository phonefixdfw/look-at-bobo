#!/usr/bin/env node
// tools/audio/demo-check.mjs — proves the Step 5 demo's voice lines REALLY
// play in a plain browser: real Google Chrome, NO autoplay flags, a real
// trusted click on the click-to-begin gate (the same user gesture a player
// gives), then each game event fired through the scripted path (LC.trigger /
// LC.setScore) while the play loop runs. The evidence is the voice engine's
// own per-file status: playback started, reached `ended`, and Chrome's
// decoder reports the docs/VOICES.md duration. Before the click, nothing
// plays — that is checked too, because "audio waits for a gesture" is part
// of the spec.
//
// Free and local: starts its own static server, uses the installed Chrome.
// No API key, no network, no spend.
//
//   npm run audio:democheck

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
  const resp = await page.goto(`${server.url}demo/talking-demo.html`, { waitUntil: 'load', timeout: 30000 });
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
  const after = await page.evaluate(() => ({ ...window.LC.audioStatus(), gateOpen: window.LC.gateUnlocked() }));
  check('click-opens-gate', after.unlocked === true && after.gateOpen === true, 'gate hidden, engine unlocked by the click');

  // --- the catch event: yell take 1 plays to the end -----------------------
  await page.evaluate(() => {
    window.LC.setScore(0);
    window.LC.seek(0);
    window.LC.setMoment('idle');
    window.LC.trigger('catch');
  });
  await waitFor(
    () => window.LC.audioStatus().lines.some((l) => l.file.includes('take1') && l.started > 0),
    'catch-yell-starts',
  );
  await waitFor(
    () => window.LC.audioStatus().lines.some((l) => l.file.includes('take1') && l.ended > 0),
    'catch-yell-ends',
  );
  const catchState = await page.evaluate(() => ({ status: window.LC.audioStatus(), score: window.LC.scoreValue(), moment: window.LC.moment().id }));
  const yell = lineNamed(catchState.status, 'yell');
  check('catch-yell-played-through', yell.started >= 1 && yell.ended >= 1 && !yell.error, `started=${yell?.started} ended=${yell?.ended} err=${yell?.error ?? 'none'}`);
  check('catch-yell-duration', Math.abs((yell?.duration ?? 0) - VOICE_LINES.yell.dur) <= 0.25, `${yell?.duration?.toFixed(2)}s vs docs ${VOICE_LINES.yell.dur}s`);
  check('catch-score-rules', catchState.score === 1 && catchState.moment === 'catch', `score ${catchState.score}, moment ${catchState.moment}`);

  // --- the wrong event: yell again, then the DAG! --------------------------
  await page.evaluate(() => {
    window.LC.seek(0);
    window.LC.setMoment('idle');
    window.LC.trigger('wrong');
  });
  await waitFor(
    () => window.LC.audioStatus().lines.some((l) => l.file.includes('dag') && l.ended > 0),
    'wrong-dag-ends',
  );
  const wrongState = await page.evaluate(() => ({ status: window.LC.audioStatus(), score: window.LC.scoreValue(), moment: window.LC.moment().id }));
  const yell2 = lineNamed(wrongState.status, 'yell');
  const dag = lineNamed(wrongState.status, 'dag');
  check('wrong-yell-again', yell2.started >= 2, `yell started=${yell2.started} (shout first, it thought it was Bobo)`);
  check('wrong-dag-played-through', dag.started >= 1 && dag.ended >= 1 && !dag.error, `started=${dag?.started} ended=${dag?.ended} err=${dag?.error ?? 'none'}`);
  check('wrong-dag-duration', Math.abs((dag?.duration ?? 0) - VOICE_LINES.dag.dur) <= 0.25, `${dag?.duration?.toFixed(2)}s vs docs ${VOICE_LINES.dag.dur}s`);
  check('wrong-score-rules', wrongState.score === 0 && wrongState.moment === 'wrong', `score floored at ${wrongState.score} (was 1), moment ${wrongState.moment}`);

  // --- the win: 10 points, the exact line plays ----------------------------
  await page.evaluate(() => {
    window.LC.seek(0);
    window.LC.setScore(9);
    window.LC.trigger('catch');
  });
  await waitFor(
    () => window.LC.audioStatus().lines.some((l) => l.file.includes('win-line') && l.ended > 0),
    'win-line-ends',
  );
  const winState = await page.evaluate(() => ({ status: window.LC.audioStatus(), score: window.LC.scoreValue(), moment: window.LC.moment().id, ending: document.getElementById('ending').textContent }));
  const win = lineNamed(winState.status, 'win');
  check('win-line-played-through', win.started >= 1 && win.ended >= 1 && !win.error, `started=${win?.started} ended=${win?.ended} err=${win?.error ?? 'none'}`);
  check('win-line-duration', Math.abs((win?.duration ?? 0) - VOICE_LINES.win.dur) <= 0.25, `${win?.duration?.toFixed(2)}s vs docs ${VOICE_LINES.win.dur}s`);
  check('win-score-and-text', winState.score === 10 && winState.moment === 'win' && winState.ending === 'your did it! you wind', `score ${winState.score}, ending "${winState.ending}"`);

  check('no-engine-errors', [yell, dag, win].every((l) => !l.error), [yell, dag, win].map((l) => `${shortName(l.file)}:${l.error ?? 'ok'}`).join(', '));
  check('console-clean', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
} finally {
  await browser.close().catch(() => {});
  await server.close().catch(() => {});
}

console.log(results.join('\n'));
console.log(`\n${results.filter((r) => r.startsWith('  PASS')).length}/${results.length} demo audio checks passed`);
process.exit(failed ? 1 : 0);
