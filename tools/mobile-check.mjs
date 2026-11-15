#!/usr/bin/env node
// tools/mobile-check.mjs — issue #25 automated phone check (headless mobile
// emulation). Nothing here needs a real phone: Playwright drives the installed
// Chrome with phone viewports, touch enabled and CDP-dispatched MULTI-touch,
// so every touch path in src/touch.js and game/engine.js runs through its REAL
// pointer/touch handlers — no synthetic shortcuts.
//
// Scenarios:
//   1   desktop control page: touch mode OFF, pixel ratio 1, quality full,
//       touch DOM hidden — the capture contract is untouched
//   2   phone landscape (844×390 @3x, iPhone UA): .touch classes, auto
//       ?quality=low + ratio cap 1.5, safe-area/thumb layout, touch-action
//       rules, gate note rewritten for thumbs, gate tap starts (no lock),
//       virtual stick walks the player, drag looks the camera, multi-touch
//       walks AND looks at once, the shout button scores a real find,
//       hidden-tab pauses and tapping the card resumes, no page scroll
//   3   ?quality=high overrides auto-low (ratio 2, shadows back)
//   4   ?touch=off on a phone: controls off, ratio 1 (quality still low)
//   5   ?touch=on on a desktop: controls forced on for QA
//   6   portrait: rotate hint up, the sim waits; rotate to landscape and it
//       resumes by itself
//   7   a full run to the win AT TEN driven only by real shout-button taps
//       (plus one deliberate DAG!), exact ending text, and the shout button
//       restarting the game after the 0.6 s cooldown — at @2x
//
//   npm run check:mobile

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStaticServer } from './serve.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(REPO, 'package.json'));
const { chromium } = require('playwright-core');
const exe = ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(existsSync);

const PAGE = 'game/full.html';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const LAND = { width: 844, height: 390 };
const PORTRAIT = { width: 390, height: 844 };

const server = await startStaticServer({ root: REPO, port: 0 });
const browser = await chromium.launch({
  executablePath: exe || undefined,
  channel: exe ? undefined : 'chrome',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

const results = [];
let failures = 0;
function check(name, pass, detail = '') {
  results.push(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!pass) failures++;
  return pass;
}

// Console noise that is environmental, not the game: fullscreen/orientation
// permission denials (headless grants neither), favicon, autoplay policy.
const IGNORE = /fullscreen|orientation|favicon|autoplay|AudioContext/i;

const contexts = [];
async function phonePage(params, opts = {}) {
  const { viewport = LAND, dsf = 3 } = opts;
  const context = await browser.newContext({ viewport, deviceScaleFactor: dsf, hasTouch: true, isMobile: true, userAgent: IPHONE_UA });
  contexts.push(context);
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !IGNORE.test(m.text()) && errs.push(m.text()));
  await page.goto(`${server.url}${PAGE}${params}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.LC?.ready === true, null, { timeout: 45000 });
  page.__errs = errs;
  return page;
}
async function desktopPage(params) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  contexts.push(context);
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !IGNORE.test(m.text()) && errs.push(m.text()));
  await page.goto(`${server.url}${PAGE}${params}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.LC?.ready === true, null, { timeout: 45000 });
  page.__errs = errs;
  return page;
}

const st = (page) => page.evaluate(() => window.LC.state());
const touchDbg = (page) => page.evaluate(() => window.LC.touchDebug());
const gpuDbg = (page) => page.evaluate(() => window.LC.gpuDebug());
const waitPhase = (page, p, ms = 20000) =>
  page.waitForFunction((ph) => window.LC.state().phase === ph, p, { timeout: ms });
const waitCatchOrWin = (page, ms = 20000) =>
  page.waitForFunction(() => ['catch', 'win'].includes(window.LC.state().phase), null, { timeout: ms });

// Trusted multi-touch straight through Chrome's input pipeline: real touch
// events, so the page generates real Pointer Events for src/touch.js.
async function touchDriver(page) {
  const cdp = await (await page.context()).newCDPSession(page);
  const live = new Map(); // id -> {x, y}
  const send = (type) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: [...live.entries()].map(([id, p]) => ({ x: p.x, y: p.y, id })),
    });
  return {
    async down(id, x, y) {
      live.set(id, { x, y });
      await send('touchStart');
    },
    async moveTo(id, x, y) {
      live.set(id, { x, y });
      await send('touchMove');
    },
    async up(id) {
      live.delete(id);
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [{ x: 0, y: 0, id }],
      });
    },
  };
}

try {
  // ===========================================================================
  // 1. Desktop control page — issue #25 must be invisible here
  // ===========================================================================
  {
    const page = await desktopPage('?gate=off&win=3');
    const t = await touchDbg(page);
    const g = await gpuDbg(page);
    const dom = await page.evaluate(() => ({
      touchClass: document.documentElement.classList.contains('touch'),
      shout: getComputedStyle(document.getElementById('shout-btn')).display,
      stick: getComputedStyle(document.getElementById('stick-base')).display,
      rotate: getComputedStyle(document.getElementById('rotate-hint')).display,
    }));
    check('desktop: touch mode off', t.active === false && t.autoLow === false && !t.touchClass);
    check('desktop: pixel ratio 1, quality full', g.pixelRatio === 1 && g.quality === 'full' && g.touch === false, `ratio ${g.pixelRatio}, ${g.quality}`);
    check('desktop: touch DOM hidden', dom.touchClass === false && dom.shout === 'none' && dom.stick === 'none' && dom.rotate === 'none');
    check('desktop: console clean', page.__errs.length === 0, page.__errs.join(' | '));
    await page.context().close();
  }

  // ===========================================================================
  // 2. Phone landscape — the whole touch surface
  // ===========================================================================
  {
    const page = await phonePage('?seed=11'); // gate ON: the real mobile path
    const t0 = await touchDbg(page);
    const g0 = await gpuDbg(page);
    check('phone: touch mode on, auto-low on', t0.active === true && t0.autoLow === true);
    check('phone: quality auto-low, ratio capped 1.5', g0.quality === 'low' && g0.pixelRatio === 1.5 && g0.shadows === false, `quality ${g0.quality}, ratio ${g0.pixelRatio}`);
    check('phone: backing store 844*1.5 wide', g0.canvasW === 1266 && g0.canvasH === 585, `${g0.canvasW}×${g0.canvasH}`);

    const css = await page.evaluate(() => ({
      touchAction: getComputedStyle(document.querySelector('canvas')).touchAction,
      overscroll: getComputedStyle(document.documentElement).overscrollBehavior,
      userSelect: getComputedStyle(document.body).userSelect,
      shoutShown: getComputedStyle(document.getElementById('shout-btn')).display,
      rotate: getComputedStyle(document.getElementById('rotate-hint')).display,
      meta: document.querySelector('meta[name="viewport"]').content,
      gateBtn: document.getElementById('gate-btn').textContent,
      hint: document.getElementById('hint').textContent,
      noteTouch: getComputedStyle(document.querySelector('#gate .only-touch')).display,
      noteDesktop: getComputedStyle(document.querySelector('#gate .only-desktop')).display,
    }));
    check('phone: page cannot scroll or zoom', css.touchAction === 'none' && css.overscroll === 'none' && css.userSelect === 'none' && /maximum-scale=1/.test(css.meta) && /user-scalable=no/.test(css.meta) && /viewport-fit=cover/.test(css.meta));
    check('phone: thumb UI shown, rotate hint not (landscape)', css.shoutShown === 'flex' && css.rotate === 'none');
    check('phone: gate and hint reworded for thumbs', css.gateBtn === 'tap to start' && css.hint.includes('left thumb') && css.noteTouch === 'inline' && css.noteDesktop === 'none');

    // The shout button is thumb-sized and inside the (landscape) viewport.
    const layout = await page.evaluate(() => {
      const r = document.getElementById('shout-btn').getBoundingClientRect();
      const s = document.getElementById('hud-score').getBoundingClientRect();
      return { w: r.width, right: r.right, bottom: r.bottom, vw: innerWidth, vh: innerHeight, sRight: s.right, sTop: s.top };
    });
    check('phone: shout button thumb-sized, in view', layout.w >= 100 && layout.right <= layout.vw && layout.bottom <= layout.vh, `${Math.round(layout.w)}px button`);
    check('phone: safe-area HUD in view', layout.sRight <= layout.vw + 1 && layout.sTop >= 0);

    // Gate tap: unlocks, starts, NO pointer lock, and starts playing.
    await page.tap('#gate-btn');
    await waitPhase(page, 'find');
    const after = await page.evaluate(() => ({
      hidden: document.getElementById('gate').classList.contains('hidden'),
      locked: document.pointerLockElement !== null,
    }));
    const s1 = await st(page);
    check('phone: gate tap starts the game, no pointer lock', after.hidden && after.locked === false && s1.gateOpen === true && s1.paused === false, `phase ${s1.phase}, locked ${after.locked}`);

    const touch = await touchDriver(page);

    // --- virtual stick walks the player -------------------------------------
    const p0 = await st(page);
    await touch.down(1, 140, 330); // lower-left pad → stick
    await touch.moveTo(1, 140, 250); // 80 px up: past the run band
    await page.waitForTimeout(700);
    const mid = await touchDbg(page);
    check('stick: forward + run held', mid.controls.stick === true && mid.controls.fwd === 1 && mid.controls.run === true && mid.virtual.forward === true && mid.virtual.run === true, JSON.stringify(mid.controls));
    const p1 = await st(page);
    const moved = Math.hypot(p1.px - p0.px, p1.pz - p0.pz);
    check('stick: the player really walks', moved > 0.4, `${moved.toFixed(2)} m in 0.7 s`);
    await touch.up(1);
    await page.waitForTimeout(100);
    const rel = await touchDbg(page);
    check('stick: releasing clears every key', rel.controls.stick === false && Object.keys(rel.virtual).length === 0, JSON.stringify(rel.virtual));

    // --- drag-to-look ---------------------------------------------------------
    await touch.down(2, 650, 180);
    await touch.moveTo(2, 560, 180); // horizontal: yaw
    await page.waitForTimeout(80);
    const lookH = await st(page);
    await touch.moveTo(2, 560, 260); // vertical: pitch
    await page.waitForTimeout(80);
    const lookV = await st(page);
    const dbgL = await touchDbg(page);
    await touch.up(2);
    check('look: drag turns the camera (yaw then pitch)', Math.abs(lookH.yaw - s1.yaw) > 0.05 && Math.abs(lookV.pitch - lookH.pitch) > 0.02, `Δyaw ${(lookH.yaw - s1.yaw).toFixed(3)}, Δpitch ${(lookV.pitch - lookH.pitch).toFixed(3)}`);
    check('look: the finger counts as a look pointer', dbgL.controls.lookPointers === 1);

    // --- multi-touch: walk AND look at once ----------------------------------
    const m0 = await st(page);
    await touch.down(3, 140, 330); // stick finger
    await touch.down(4, 650, 200); // look finger joins
    await touch.moveTo(3, 140, 260);
    await touch.moveTo(4, 580, 200);
    await page.waitForTimeout(500);
    const both = await touchDbg(page);
    const m1 = await st(page);
    await touch.up(3);
    await touch.up(4);
    const walk = Math.hypot(m1.px - m0.px, m1.pz - m0.pz);
    check('multi-touch: stick + look simultaneously', both.controls.stick === true && both.controls.lookPointers === 1 && both.virtual.forward === true && Math.abs(m1.yaw - m0.yaw) > 0.05 && walk > 0.2, `walk ${walk.toFixed(2)} m, Δyaw ${(m1.yaw - m0.yaw).toFixed(3)}`);
    const scroll = await page.evaluate(() => [scrollX, scrollY]);
    check('phone: page never scrolled under the fingers', scroll[0] === 0 && scroll[1] === 0);

    // --- shout button scores a real find -------------------------------------
    const before = (await st(page)).score;
    const hit = await page.evaluate(() => window.LC.aimAt('bobo').hits);
    await page.tap('#shout-btn');
    await waitCatchOrWin(page);
    const afterShout = await st(page);
    check('shout button: a tap scores a find', hit === 'cat-bobo' && afterShout.score === before + 1, `ray ${hit}, score ${before} → ${afterShout.score}`);

    // --- hidden tab pauses, tapping the card resumes --------------------------
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { get: () => true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(150);
    const hid = await st(page);
    const cardShown = await page.evaluate(() => document.getElementById('pause').classList.contains('show'));
    check('hidden tab: the run waits behind the pause card', hid.paused === true && cardShown);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
    });
    await page.tap('#pause');
    await page.waitForTimeout(150);
    const back = await st(page);
    check('pause card tap: resumes without any pointer lock', back.paused === false);

    check('phone landscape: console clean', page.__errs.length === 0, page.__errs.join(' | '));
    await page.context().close();
  }

  // ===========================================================================
  // 3+4+5. Quality override, touch=off on a phone, touch=on on a desktop
  // ===========================================================================
  {
    const page = await phonePage('?gate=off&quality=high');
    const g = await gpuDbg(page);
    check('?quality=high beats auto-low on a phone', g.quality === 'full' && g.pixelRatio === 2 && g.shadows === true, `ratio ${g.pixelRatio}, shadows ${g.shadows}`);
    await page.context().close();
  }
  {
    const page = await phonePage('?gate=off&touch=off');
    const t = await touchDbg(page);
    const g = await gpuDbg(page);
    const dom = await page.evaluate(() => document.documentElement.classList.contains('touch'));
    check('?touch=off on a phone: desktop controls, ratio 1', t.active === false && g.pixelRatio === 1 && dom === false, `ratio ${g.pixelRatio}`);
    check('?touch=off keeps the phone quality default', g.quality === 'low');
    await page.context().close();
  }
  {
    const page = await desktopPage('?gate=off&touch=on');
    const t = await touchDbg(page);
    const dom = await page.evaluate(() => ({
      cls: document.documentElement.classList.contains('touch'),
      shout: getComputedStyle(document.getElementById('shout-btn')).display,
    }));
    check('?touch=on forces the controls on a desktop', t.active === true && dom.cls === true && dom.shout === 'flex');
    await page.context().close();
  }

  // ===========================================================================
  // 6. Portrait: wait behind the rotate hint, resume when turned sideways
  // ===========================================================================
  {
    const page = await phonePage('?seed=11', { viewport: PORTRAIT });
    const hintCss = await page.evaluate(() => getComputedStyle(document.getElementById('rotate-hint')).display);
    check('portrait: the rotate hint covers the game', hintCss === 'flex');
    await page.tap('#gate-btn'); // hint is pointer-events:none — the tap lands on the gate
    await page.waitForTimeout(400);
    const s = await st(page);
    check('portrait: starting upright waits (paused), gate open', s.gateOpen === true && s.paused === true, `paused ${s.paused}`);
    await page.setViewportSize(LAND);
    await page.waitForTimeout(400);
    const r = await st(page);
    const hintNow = await page.evaluate(() => getComputedStyle(document.getElementById('rotate-hint')).display);
    check('portrait → landscape: resumes by itself', r.paused === false && hintNow === 'none', `paused ${r.paused}, hint ${hintNow}`);
    check('portrait page: console clean', page.__errs.length === 0, page.__errs.join(' | '));
    await page.context().close();
  }

  // ===========================================================================
  // 7. Win at TEN over the shout button only, at @2x — the full mobile run
  // ===========================================================================
  {
    const page = await phonePage('?seed=11', { dsf: 2 });
    await page.tap('#gate-btn');
    await waitPhase(page, 'find');
    const scores = [];
    let dagged = false;
    let n = 0;
    while (n++ < 40) {
      const now = await st(page);
      if (now.phase === 'win') break;
      await waitPhase(page, 'find');
      if (!dagged && scores.length === 2) {
        dagged = true;
        await page.evaluate(() => window.LC.aimAt('decoy'));
        await page.tap('#shout-btn');
        await waitPhase(page, 'wrong');
        scores.push((await st(page)).score); // the DAG! costs one point
        continue;
      }
      await page.evaluate(() => window.LC.aimAt('bobo'));
      await page.tap('#shout-btn');
      await waitCatchOrWin(page);
      scores.push((await st(page)).score);
    }
    const fin = await st(page);
    const ending = await page.evaluate(() => ({
      text: document.getElementById('ending').textContent,
      again: document.getElementById('ending-again').textContent,
    }));
    check('mobile win run: ten finds over the shout button', fin.phase === 'win' && fin.score === 10 && fin.target === 10, `score ${fin.score}/${fin.target}, ${scores.join(', ')}`);
    check('mobile win run: exact ending text', ending.text === 'your did it! you wind' && ending.again === 'tap the shout button to look at them again', `"${ending.text}" / "${ending.again}"`);
    // The shout button doubles as play-again — but only after the cooldown.
    await page.tap('#shout-btn'); // inside the 0.6 s cooldown: must NOT restart
    await page.waitForTimeout(200);
    const early = await st(page);
    await page.waitForTimeout(700);
    await page.tap('#shout-btn');
    await waitPhase(page, 'find');
    const re = await st(page);
    check('mobile win run: shout restarts only after the cooldown', early.phase === 'win' && re.phase === 'find' && re.score === 0, `early ${early.phase}, then ${re.phase} at ${re.score}`);
    check('mobile win run: console clean', page.__errs.length === 0, page.__errs.join(' | '));
    await page.context().close();
  }
} finally {
  for (const c of contexts) await c.close().catch(() => {});
  await browser.close().catch(() => {});
  await server.close().catch(() => {});
}

console.log('MOBILE CHECK — issue #25 (headless phone emulation)\n' + results.join('\n'));
console.log(failures ? `\nMOBILE CHECK: FAIL — ${failures} failed` : '\nMOBILE CHECK: PASS — the phone path works end to end');
process.exit(failures ? 1 : 0);
