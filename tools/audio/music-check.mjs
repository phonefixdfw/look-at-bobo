#!/usr/bin/env node
// tools/audio/music-check.mjs — `npm run check:music`: proves the issue #71
// soundtrack in a plain browser: real Chrome, NO autoplay flags, a real
// trusted click on the gate, the game's own events fired through the game's
// own paths (LC.trigger — the exact call aimShout makes). Every AudioContext
// the page builds is COUNTED (wrapped before any script runs), so "silent
// until the gesture" and "?gate=off / ?music=off never touch Web Audio" are
// measured, not assumed.
//
// What it proves, one PASS line each:
//   * ?gate=off — zero AudioContexts ever constructed, LC.music() reports
//     present:false, and LC.musicRender() still renders (offline only): the
//     capture/determinism suites stay byte-identical.
//   * the offline render of the REAL synth graph is audible, in mix range
//     (RMS/peak) and has energy where the tune lives (bass + lead bands).
//   * before the click: no context. after the trusted click: one context,
//     running, the loop stepping.
//   * ?music=off — a click starts the game but never a context.
//   * a REAL yell (LC.trigger catch → voice engine → 'lc-voice') ducks the
//     music ~4 dB fast and brings it back up; a pause swaps to the calm
//     arrangement and back; a win plays the flourish; a hidden tab FREEZES
//     the loop and showing resumes it; a 1 s main-thread stall neither
//     bursts notes nor errors; volume/mute/quality params compose.
//
// Free and local: starts its own static server, uses the installed Chrome.
// No API key, no network, no spend.

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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

// Count EVERY AudioContext the page constructs (live) vs Offline (the tool
// render path) — the wrap lands before any page script runs, on every nav.
await page.addInitScript(() => {
  window.__acCount = 0;
  window.__ocCount = 0;
  const AC = window.AudioContext;
  window.AudioContext = class extends AC {
    constructor(...a) {
      super(...a);
      window.__acCount++;
    }
  };
  const OC = window.OfflineAudioContext;
  window.OfflineAudioContext = class extends OC {
    constructor(...a) {
      super(...a);
      window.__ocCount++;
    }
  };
});

const waitFor = (fn, label, ms = 8000) =>
  page
    .waitForFunction(fn, null, { timeout: ms })
    .then(() => true)
    .catch(() => {
      results.push(`  FAIL  ${label} — timed out after ${ms / 1000}s`);
      failed++;
      return false;
    });

/** Boot game/full.html with a query; headless boot is occasionally slow,
 *  so the goto+ready wait retries up to 3 times before failing the suite. */
async function boot(query) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = await page.goto(`${server.url}game/full.html?${query}`, { waitUntil: 'load', timeout: 30000 });
      await page.waitForFunction(() => window.LCError || (window.LC && window.LC.ready === true), null, { timeout: 40000 });
      const err = await page.evaluate(() => window.LCError);
      if (err) throw new Error(`LCError: ${err}`);
      if (resp?.status() !== 200) throw new Error(`HTTP ${resp?.status()}`);
      return;
    } catch (e) {
      if (attempt === 3) throw e;
    }
  }
}
const music = () => page.evaluate(() => window.LC.music());
const counters = () => page.evaluate(() => ({ ac: window.__acCount, oc: window.__ocCount }));

try {
  // =========================================================== 1. ?gate=off
  // The capture/determinism contract: no live AudioContext, ever, and the
  // debug surface says there is no soundtrack here. Rendering is allowed —
  // it is an OfflineAudioContext, inaudible, and the only way tools hear.
  await boot('gate=off&quality=high');
  check('gate-off-silent', (await music()).present === false && (await music()).gateOff === true, JSON.stringify(await music()));
  check('gate-off-zero-contexts', (await counters()).ac === 0, `AudioContexts built: ${(await counters()).ac}`);

  // offline render of the REAL synth paths — mix must be audible, clean,
  // and concentrated where a bardcore tune lives (bass pizz + lead pluck).
  const main = await page.evaluate(() => window.LC.musicRender(20, 'main'));
  check('render-main-rms', main.rms > 0.02 && main.rms < 0.35, `main rms ${main.rms} (0.02–0.35)`);
  check('render-main-peak', main.peak < 1.0, `main peak ${main.peak} (no clipping)`);
  check('render-main-bass', main.bass > 0.5, `main bass band ${main.bass.toExponential(2)}`);
  check('render-main-lead', main.lead > 0.01, `main lead band ${main.lead.toExponential(2)}`);
  const calm = await page.evaluate(() => window.LC.musicRender(12, 'calm'));
  check('render-calm-quiet-clean', calm.rms > 0.01 && calm.rms < main.rms && calm.peak < 1.0, `calm rms ${calm.rms} < main ${main.rms}, peak ${calm.peak}`);
  const flour = await page.evaluate(() => window.LC.musicRender(18, 'flourish'));
  check('render-flourish-clean', flour.rms > 0.02 && flour.peak < 1.0, `flourish rms ${flour.rms}, peak ${flour.peak}`);
  const offCounters = await counters();
  check('render-is-offline-only', offCounters.ac === 0 && offCounters.oc >= 3, `${offCounters.oc} offline contexts, ${offCounters.ac} live`);

  // ==================================================== 2. ?music=off page
  await boot('music=off&quality=high');
  check('music-off-reports-off', (await music()).present === false && (await music()).off === true, JSON.stringify(await music()));
  await page.click('#gate-btn'); // a real gesture — the game starts
  await waitFor(() => window.LC.state().time > 0.2, 'music-off-game-starts', 10000);
  check('music-off-no-context', (await counters()).ac === 0, `AudioContexts after clicking play with ?music=off: ${(await counters()).ac}`);

  // ===================================================== 3. the live game
  // quality=high: headless viewport is "small" (AUTO_LOW), force the FULL arrangement.
  await boot('win=3&quality=high');
  const preClick = await music();
  check('full-quality-mode', preClick.lowQuality === false, 'quality=high gives the full instrument set');
  check('no-context-before-click', preClick.ctxCreated === false && (await counters()).ac === 0, `ctx=${(await counters()).ac} before the gate click`);

  await page.click('#gate-btn'); // the trusted user gesture
  const started = await waitFor(() => window.LC.music().ctxCreated && window.LC.music().ctxState === 'running', 'music-starts-in-gesture', 8000);
  if (started) check('music-starts-in-gesture', true, JSON.stringify(await music()));
  check('exactly-one-context', (await counters()).ac === 1, `AudioContexts after the click: ${(await counters()).ac}`);
  const stepping = await waitFor(() => window.LC.music().step > 12, 'loop-is-stepping', 8000);
  if (stepping) check('loop-is-stepping', true, `step ${(await music()).step} of ${(await music()).loopSteps}, ${JSON.stringify({ bpm: (await music()).bpm })}`);

  // --- duck under a REAL voice line: yell via the game's own catch path ---
  await page.evaluate(() => window.LC.aimAt('bobo'));
  await page.evaluate(() => window.LC.trigger('catch')); // fires the yell through src/audio.js
  const ducked = await waitFor(() => window.LC.music().duckLevel < 0.7, 'duck-under-yell', 8000);
  if (ducked) {
    const d = (await music()).duckLevel;
    check('duck-under-yell', d > 0.55 && d < 0.7, `duckLevel ${d} during the yell (≈ -4 dB)`);
  }
  const back = await waitFor(() => window.LC.music().duckLevel > 0.95, 'duck-releases', 6000);
  if (back) check('duck-releases', true, `duckLevel ${(await music()).duckLevel} after the line ends`);

  // --- pause: the calm arrangement takes over, then hands back -----------
  await page.evaluate(() => window.LC.setPaused(true));
  const paused = await waitFor(() => window.LC.music().arrangement === 'calm', 'pause-swaps-to-calm', 6000);
  if (paused) {
    // the swap dips first and fades the calm loop IN to the pause level, so
    // give the automation a moment to settle before reading the level
    const settled = await waitFor(() => window.LC.music().sceneLevel < 0.75 && window.LC.music().sceneLevel > 0, 'pause-level-settles', 4000);
    const p = await music();
    if (settled) check('pause-swaps-to-calm', p.arrangement === 'calm' && p.sceneLevel < 0.75 && p.running === true, `arrangement ${p.arrangement} at level ${p.sceneLevel} (still playing, quieter than play's 1)`);
  }
  await page.evaluate(() => window.LC.setPaused(false));
  const resumed = await waitFor(() => window.LC.music().arrangement === 'main', 'resume-swaps-back', 6000);
  if (resumed) check('resume-swaps-back', true, `arrangement ${(await music()).arrangement} after un-pausing`);

  // --- a 1 s main-thread stall must not burst-schedule stale notes -------
  const stepBefore = (await music()).step;
  const voicesBefore = consoleErrors.length;
  await page.evaluate(() => {
    const t0 = Date.now();
    while (Date.now() - t0 < 1000) { /* block the main thread like a hitch */ }
  });
  await page.waitForTimeout(400);
  const stalled = await music();
  const jump = stalled.step - stepBefore;
  // 1.4 s of clock ≈ 10 steps at 110 BPM/16ths; a burst would be many more.
  check('stall-no-burst', jump >= 0 && jump < 24 && stalled.liveVoices <= 40 && consoleErrors.length === voicesBefore, `step advanced ${jump} (bounded), liveVoices ${stalled.liveVoices}, no new errors`);

  // --- the win earns the flourish -----------------------------------------
  await page.evaluate(() => {
    window.LC.setScore(2);
    window.LC.trigger('catch'); // win=3 → this catch wins → music.setScene('win')
  });
  const flourish = await waitFor(() => window.LC.music().arrangement === 'flourish', 'win-plays-flourish', 6000);
  if (flourish) check('win-plays-flourish', (await music()).scene === 'win', JSON.stringify(await music()));

  // --- hidden tab FREEZES the loop; showing resumes mid-pattern -----------
  // (the game's own visibility pause does not fire while phase === 'win',
  // so this isolates the music module's freeze.)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const froze = await waitFor(() => window.LC.music().frozen === true, 'hidden-freezes-music', 6000);
  if (froze) {
    const s0 = (await music()).step;
    await page.waitForTimeout(700);
    const s1 = (await music()).step;
    check('hidden-freezes-music', s1 === s0, `step held at ${s0} for 700 ms while hidden`);
  }
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const thawed = await waitFor(() => window.LC.music().frozen === false, 'show-resumes-music', 6000);
  const s2 = thawed ? (await music()).step : 0;
  if (thawed) {
    await page.waitForTimeout(500);
    check('show-resumes-music', (await music()).step > s2, `loop stepped on again (${s2} → ${(await music()).step})`);
  }

  // =========================================== 4. volume / mute / quality
  await boot('volume=0.5&musicvol=0.5&quality=high');
  await page.click('#gate-btn');
  await waitFor(() => window.LC.music().ctxCreated, 'vol-page-music-starts', 8000);
  let m = await music();
  check('volume-composes', Math.abs(m.master - 0.25) < 0.01, `master ${m.master} = ?volume 0.5 × ?musicvol 0.5`);

  await boot('mute=1&quality=high');
  await page.click('#gate-btn');
  await waitFor(() => window.LC.music().ctxCreated, 'mute-page-music-starts', 8000);
  m = await music();
  check('global-mute-silences-music', m.master === 0, `master ${m.master} with ?mute=1`);

  await boot('musicmute=1&volume=0.8&quality=low');
  await page.click('#gate-btn');
  await waitFor(() => window.LC.music().ctxCreated, 'musicmute-page-music-starts', 8000);
  m = await music();
  check('music-mute-only-its-own', m.master === 0 && m.lowQuality === true, `?musicmute=1 → master ${m.master}; ?quality=low → lighter set (${m.lowQuality})`);

  check('console-clean', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
} finally {
  await browser.close().catch(() => {});
  await server.close().catch(() => {});
}

console.log('Look at Bobo — music browser check (issue #71)\n');
console.log(results.join('\n'));
console.log(`\n${results.filter((r) => r.startsWith('  PASS')).length}/${results.length} music checks passed`);
process.exit(failed ? 1 : 0);
