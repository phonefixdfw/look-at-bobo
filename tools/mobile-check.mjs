#!/usr/bin/env node
// tools/mobile-check.mjs — issue #25 automated phone check (headless mobile
// emulation). Nothing here needs a real phone: Playwright drives the installed
// Chrome with phone viewports, touch enabled and CDP-dispatched MULTI-touch,
// so every touch path in src/touch.js and game/engine.js runs through its REAL
// pointer/touch handlers — no synthetic shortcuts.
//
// Issue #29 added the scenarios at the end (8-11), which run the opposite
// situation on purpose: a device whose JavaScript says "no touch" (a plain
// desktop context — that is what a Chrome "Desktop site" tab, a locked-down
// webview or a stale cached module looks like to the page), rescued by a finger.
// Touch is injected into that context with raw CDP `Input.dispatchTouchEvent`:
// Chrome delivers it as a TRUSTED pointerdown with pointerType 'touch' plus a
// touchstart, which is exactly the event a mis-detected phone sends, so the live
// switch is tested through the real pipeline and not a stub.
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
//   8   #29 rescue: a touch-blind device locks the pointer, ONE finger takes the
//       controls over (lock dropped, stick + shout live, no lock asked for
//       again), the mode line changes, and a mouse afterwards changes nothing
//   9   #29 ?touch=off stays the mouse path even under a finger — and says so
//   10  #29 the build stamp: card + gear panel + ?stamp=on corner and title, and
//       nothing at all under ?gate=off
//   11  #29 isTouchDevice() signal matrix, run in the page
//   12  #38 the always-visible stick + first-run hints: the ring rests in view
//       from the first frame and glides back on release, the chips and the
//       swipe cue show once, retire on the first game touch, auto-fade with no
//       touch at all, and never appear on desktop or in a capture frame; the
//       stick, the shout button and the HUD never overlap on a short phone
//
//   npm run check:mobile

import { existsSync, readFileSync } from 'node:fs';
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
/** Counts requestPointerLock() calls for the whole page (issue #29: after a
 *  finger takes over, the number must never move again). Wrapping the prototype
 *  changes nothing about the call — it still runs, still grants. */
const LOCK_COUNTER = () => {
  window.__locks = 0;
  const orig = Element.prototype.requestPointerLock;
  Element.prototype.requestPointerLock = function (...a) {
    window.__locks++;
    return orig.apply(this, a);
  };
};
async function phonePage(params, opts = {}) {
  const { viewport = LAND, dsf = 3 } = opts;
  const context = await browser.newContext({ viewport, deviceScaleFactor: dsf, hasTouch: true, isMobile: true, userAgent: IPHONE_UA });
  await context.addInitScript(LOCK_COUNTER);
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
  await context.addInitScript(LOCK_COUNTER);
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

/** Wait until the game has run `n` FIXED simulation steps (n/60 s of game time),
 *  and return how long that took. Anything that measures movement or a camera
 *  turn has to be timed this way rather than with `waitForTimeout`: a phone page
 *  under SwiftShader renders at single-digit frame rates, so a 500 ms wall-clock
 *  window can hold one or two steps — enough to turn the camera (one step applies
 *  the whole accumulated drag) and nowhere near enough to walk anywhere. That is
 *  how the walk/look checks came to fail at HEAD on a slow GPU with the game
 *  itself intact. N steps is N `stepGame` calls on any machine, so the same
 *  numbers mean the same thing here and on Brandon's hardware. */
async function simSteps(page, n) {
  const t0 = await page.evaluate(() => ({ steps: window.LC.loopDebug().simSteps, ms: performance.now() }));
  await page.waitForFunction(
    ([from, want]) => window.LC.loopDebug().simSteps - from >= want,
    [t0.steps, n],
    { timeout: 90000 },
  );
  return Math.round((await page.evaluate(() => performance.now())) - t0.ms);
}

/** Watch for the win from INSIDE the page and shout on the very frame it lands,
 *  returning `{we, phase, score}` — `we` being `winElapsed` at the instant of the
 *  tap, which is the whole point: measured from the harness a win is only visible
 *  a poll or two late, so a harness-side tap can no longer be *provably* inside the
 *  0.6 s win cooldown. The event is untrusted by necessity (a page cannot mint a
 *  trusted touch) but it runs the product's real handlers: `#shout-btn`'s own
 *  `pointerdown` → touch.js' `press` → the engine's `onShout`. */
function shoutAtWin(page) {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const btn = document.getElementById('shout-btn');
        const t0 = performance.now();
        const tick = () => {
          const s = window.LC.state();
          if (s.phase === 'win') {
            const we = window.LC.loopDebug().winElapsed;
            const fire = (type) =>
              btn.dispatchEvent(new PointerEvent(type, { pointerId: 991, pointerType: 'touch', bubbles: true, cancelable: true }));
            fire('pointerdown');
            fire('pointerup');
            const after = window.LC.state();
            resolve({ we, phase: after.phase, score: after.score });
          } else if (performance.now() - t0 > 60000) {
            resolve({ error: 'no win within 60 s', phase: s.phase, we: NaN, score: s.score });
          } else {
            requestAnimationFrame(tick);
          }
        };
        requestAnimationFrame(tick);
      }),
  );
}

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
    const walkMs = await simSteps(page, 42); // 0.7 s of game time, whatever the frame rate
    const mid = await touchDbg(page);
    check('stick: forward + run held', mid.controls.stick === true && mid.controls.fwd === 1 && mid.controls.run === true && mid.virtual.forward === true && mid.virtual.run === true, JSON.stringify(mid.controls));
    const p1 = await st(page);
    const moved = Math.hypot(p1.px - p0.px, p1.pz - p0.pz);
    check('stick: the player really walks', moved > 0.4, `${moved.toFixed(2)} m in 42 steps (${walkMs} ms)`);
    await touch.up(1);
    await page.waitForTimeout(100);
    const rel = await touchDbg(page);
    check('stick: releasing clears every key', rel.controls.stick === false && Object.keys(rel.virtual).length === 0, JSON.stringify(rel.virtual));

    // --- drag-to-look ---------------------------------------------------------
    await touch.down(2, 650, 180);
    await touch.moveTo(2, 560, 180); // horizontal: yaw
    await simSteps(page, 12); // 0.2 s of game time
    const lookH = await st(page);
    await touch.moveTo(2, 560, 260); // vertical: pitch
    await simSteps(page, 12);
    const lookV = await st(page);
    const dbgL = await touchDbg(page);
    await touch.up(2);
    check('look: drag turns the camera (yaw then pitch)', Math.abs(lookH.yaw - s1.yaw) > 0.05 && Math.abs(lookV.pitch - lookH.pitch) > 0.02, `Δyaw ${(lookH.yaw - s1.yaw).toFixed(3)}, Δpitch ${(lookV.pitch - lookH.pitch).toFixed(3)}`);
    check('look: the finger counts as a look pointer', dbgL.controls.lookPointers === 1);

    // --- multi-touch: walk AND look at once ----------------------------------
    // Back to the spawn the single-finger walk above proved is clear: the look
    // test left the camera turned, and a heading that runs into a wall walks
    // nowhere however well both fingers work. `respawnHere` is the same test hook
    // the audio and bot checks use, so this measures two live fingers, not which
    // way the previous test happened to end up facing.
    await page.evaluate((p) => window.LC.respawnHere(p.px, p.pz, p.yaw), p0);
    await simSteps(page, 3); // let it land in a rendered frame
    const m0 = await st(page);
    await touch.down(3, 140, 330); // stick finger
    await touch.down(4, 650, 200); // look finger joins
    await touch.moveTo(3, 140, 260);
    await touch.moveTo(4, 580, 200);
    await simSteps(page, 42); // 0.7 s of game time
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
    const earlyTap = shoutAtWin(page).catch((e) => ({ error: String(e), we: -1, phase: '-', score: -1 }));
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
    // The shout button doubles as play-again — but only after the 0.6 s win
    // cooldown (`WIN_RESTART_AFTER`), and the tap that proves it has to be fired
    // from INSIDE the page on the frame the win lands. Measured from the harness,
    // a win is only observable a poll or two after it happens, and on a software
    // renderer those round trips can outlast the cooldown: this check failed that
    // way at HEAD with the rule itself intact. The cooldown is what is under test
    // here, so the event is synthetic-but-real-handler (touch.js' own `press` →
    // `onShout`); every find above and the restart below are genuine taps.
    const early = await earlyTap;
    check(
      'mobile win run: shout inside the cooldown does not restart',
      !early.error && early.we < 0.6 && early.phase === 'win' && early.score === 10,
      early.error || `winElapsed ${early.we.toFixed(3)} at the tap → ${early.phase} at ${early.score}`,
    );
    await page.waitForTimeout(700); // past WIN_RESTART_AFTER
    await page.tap('#shout-btn'); // a real finger this time: it must restart
    await waitPhase(page, 'find');
    const re = await st(page);
    check('mobile win run: shout restarts only after the cooldown', re.phase === 'find' && re.score === 0, `then ${re.phase} at ${re.score}`);
    check('mobile win run: console clean', page.__errs.length === 0, page.__errs.join(' | '));
    await page.context().close();
  }
  // ===========================================================================
  // 8. Issue #29: the rescue. A device whose every JS signal says "no touch"
  //    (a Chrome "Desktop site" tab, a locked-down webview, a stale cached
  //    module — a plain desktop context IS that device to the page) starts in
  //    the pointer-lock path, and one finger takes the controls back.
  // ===========================================================================
  {
    const page = await desktopPage('?seed=11');
    const boot = await page.evaluate(() => ({ touch: window.LC.touchDebug().active, locks: window.__locks }));
    check('#29 a blind device boots in the mouse path', boot.touch === false && boot.locks === 0, JSON.stringify(boot));

    await page.click('#gate-btn'); // a mouse click, like the phone that got here
    await page.waitForTimeout(600);
    const grabbed = await page.evaluate(() => ({
      locks: window.__locks,
      locked: document.pointerLockElement !== null,
      paused: window.LC.state().paused,
    }));
    check('#29 the mouse path really grabbed the pointer', grabbed.locks === 1 && grabbed.locked === true && grabbed.paused === false, JSON.stringify(grabbed));

    const touch = await touchDriver(page);
    await touch.down(11, 700, 400); // ONE finger, anywhere on the screen
    await page.waitForTimeout(250);
    const sw = await page.evaluate(() => ({
      dbg: window.LC.touchDebug(),
      locked: document.pointerLockElement !== null,
      locks: window.__locks,
      paused: window.LC.state().paused,
      cls: document.documentElement.classList.contains('touch'),
      shout: getComputedStyle(document.getElementById('shout-btn')).display,
      card: document.getElementById('build-stamp').textContent,
      panel: document.getElementById('settings-build').textContent,
      notice: document.getElementById('pause').classList.contains('show'),
    }));
    check('#29 one finger switches the controls to touch', sw.dbg.active === true && sw.cls === true && sw.shout === 'flex', `touch ${sw.dbg.active}, shout ${sw.shout}`);
    check('#29 the switch dropped the pointer without pausing', sw.locked === false && sw.paused === false && sw.notice === false, `locked ${sw.locked}, paused ${sw.paused}`);
    check('#29 no pointer lock is asked for after the switch', sw.locks === 1, `lock requests ${sw.locks}`);
    check('#29 the mode line follows the switch', sw.card.includes('mode touch') && sw.panel.includes('mode touch'), sw.card);

    // …and the touch UI is live, not just painted: the stick walks.
    const w0 = await st(page);
    await touch.down(12, 140, 700);
    await touch.moveTo(12, 140, 620);
    await simSteps(page, 42); // 0.7 s of game time
    const w1 = await st(page);
    const wdbg = await touchDbg(page);
    await touch.up(12);
    const walked = Math.hypot(w1.px - w0.px, w1.pz - w0.pz);
    check('#29 the stick walks after the switch', wdbg.controls?.stick === true && walked > 0.2, `walk ${walked.toFixed(2)} m`);

    // The shout button works too, so the switched page is playable to the end.
    const s0 = (await st(page)).score;
    await page.evaluate(() => window.LC.aimAt('bobo'));
    await page.click('#shout-btn');
    await waitCatchOrWin(page);
    const s1 = await st(page);
    check('#29 the shout button scores after the switch', s1.score === s0 + 1, `score ${s0} → ${s1.score}`);

    // A mouse must never take the controls back from a hand.
    await page.mouse.move(600, 400);
    await page.mouse.down();
    await page.mouse.up();
    await page.mouse.move(760, 430);
    const back = await page.evaluate(() => ({ touch: window.LC.touchDebug().active, locks: window.__locks, locked: document.pointerLockElement !== null }));
    check('#29 a mouse does not steal the controls back', back.touch === true && back.locks === 1 && back.locked === false, JSON.stringify(back));
    check('#29 rescued page: console clean', page.__errs.length === 0, page.__errs.join(' | '));
    await page.context().close();
  }

  // ===========================================================================
  // 9. Issue #29: ?touch=off stays the mouse path — a finger included — and
  //    says out loud on the card why it is holding that choice.
  // ===========================================================================
  {
    const page = await phonePage('?touch=off&seed=11');
    const card = await page.evaluate(() => document.getElementById('build-stamp').textContent);
    check('#29 ?touch=off names itself on the start card', card.includes('mode mouse (?touch=off)'), card);
    await page.tap('#gate-btn'); // a FINGER on the gate, the QA-phone case
    await page.waitForTimeout(600);
    const t = await touchDriver(page);
    await t.down(21, 500, 200);
    await page.waitForTimeout(200);
    await t.up(21);
    const after = await page.evaluate(() => ({ touch: window.LC.touchDebug().active, locks: window.__locks, cls: document.documentElement.classList.contains('touch') }));
    check('#29 ?touch=off keeps a finger out of touch mode', after.touch === false && after.cls === false && after.locks === 1, JSON.stringify(after));
    check('#29 ?touch=off page: console clean', page.__errs.length === 0, page.__errs.join(' | '));
    await page.context().close();
  }

  // ===========================================================================
  // 10. Issue #29: the build stamp — visible, on both surfaces, readable when
  //     nothing else is, and nowhere near a captured frame.
  // ===========================================================================
  {
    const page = await phonePage('?seed=11');
    const info = await page.evaluate(() => window.LC.buildInfo());
    const dom = await page.evaluate(() => ({
      card: document.getElementById('build-stamp').textContent,
      panel: document.getElementById('settings-build').textContent,
      corner: document.getElementById('build-corner'),
      title: document.title,
    }));
    check('#29 LC.buildStamp works and agrees with the page', info.js === 'dev' && info.html === 'dev' && info.match === true, JSON.stringify({ js: info.js, html: info.html }));
    check('#29 the start card shows build + mode + quality', dom.card === info.text && dom.card.includes('build ') && dom.card.includes('mode touch') && dom.card.includes('quality low'), dom.card);
    check('#29 the gear panel shows the same line', dom.panel === info.text);
    check('#29 no debug chrome unless ?stamp=on', dom.corner === null && !/\[(html|js) /.test(dom.title), dom.title);
    await page.context().close();
  }
  {
    const page = await desktopPage('?seed=11&stamp=on');
    const dom = await page.evaluate(() => ({
      corner: document.getElementById('build-corner')?.textContent ?? null,
      title: document.title,
      info: window.LC.buildInfo(),
    }));
    check('#29 ?stamp=on puts the stamp on the screen', typeof dom.corner === 'string' && dom.corner.includes('dev') && dom.corner.includes('mouse'), dom.corner);
    check('#29 ?stamp=on puts it in the tab title too', /\[html dev\]/.test(dom.title) && /\[js dev\]/.test(dom.title), dom.title);
    await page.context().close();
  }
  {
    // Capture mode: the stamp chrome must be invisible AND empty, in a phone
    // context, with ?stamp=on trying its hardest to make it appear.
    const page = await phonePage('?gate=off&stamp=on');
    const dom = await page.evaluate(() => ({
      capture: document.body.classList.contains('capture'),
      card: document.getElementById('build-stamp').textContent,
      panel: document.getElementById('settings-build').textContent,
      corner: document.getElementById('build-corner'),
      title: document.title,
    }));
    check('#29 ?gate=off keeps every stamp out of the frame', dom.capture === true && dom.card === '' && dom.panel === '' && dom.corner === null && !/\[/.test(dom.title), JSON.stringify({ capture: dom.capture, card: dom.card }));
    check('#29 capture page: console clean', page.__errs.length === 0, page.__errs.join(' | '));
    await page.context().close();
  }
  {
    // The stamped build itself, when one has been made (npm run build).
    const distEntry = join(REPO, 'dist', 'game', 'full.html');
    if (!existsSync(distEntry)) {
      results.push('  SKIP  #29 dist/ stamp checks — run `npm run build` to include them');
    } else {
      const build = JSON.parse(readFileSync(join(REPO, 'dist', 'build.json'), 'utf8'));
      const distServer = await startStaticServer({ root: join(REPO, 'dist'), port: 0 });
      const context = await browser.newContext({ viewport: LAND, deviceScaleFactor: 3, hasTouch: true, isMobile: true, userAgent: IPHONE_UA });
      contexts.push(context);
      const page = await context.newPage();
      const errs = [];
      const fetched = []; // every script/asset the shipped page actually asked for
      page.on('request', (req) => {
        if (/\.(?:js|mp3)(?:\?|$)/.test(req.url())) fetched.push(req.url());
      });
      page.on('pageerror', (e) => errs.push(String(e)));
      page.on('console', (m) => m.type() === 'error' && !IGNORE.test(m.text()) && errs.push(m.text()));
      await page.goto(`${distServer.url}game/full.html`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.LC?.ready === true, null, { timeout: 45000 });
      const info = await page.evaluate(() => window.LC.buildInfo());
      // Every module URL in the shipped page has to carry the same stamp, or a
      // phone can still be handed last build's engine.js.
      const modules = fetched.filter((u) => u.endsWith('.js') || /\.js\?/.test(u));
      const unversioned = fetched.filter((u) => !u.includes(`v=${build.build}`));
      check('#29 dist/: the stamp is this build', info.js === build.build && info.html === build.build && info.match === true, `${info.js} vs build.json ${build.build}`);
      check('#29 dist/: the card shows a real stamp', info.text.startsWith(`build ${build.build} ·`), info.text);
      // The count is the guard on the assertion that matters: if the page fetched
      // hardly any modules, "0 un-versioned" would be vacuous. The full game's
      // graph is 24 modules (game/ + src/ + the vendor bundle) — 20 leaves room
      // for a level to be folded into another file, not for a page that loaded
      // one script.
      check('#29 dist/: every module URL is versioned', modules.length >= 20 && unversioned.length === 0, `${modules.length} modules fetched, ${unversioned.length} un-versioned`);
      check('#29 dist/ page: console clean', errs.length === 0, errs.join(' | '));
      await context.close();
      await distServer.close();
    }
  }

  // ===========================================================================
  // 11. Issue #29: the detector itself, one row per device shape. Run in the
  //     page against src/touch.js with fake windows, so a signal set that only
  //     exists on hardware (a phone in "Desktop site" mode) is still covered.
  // ===========================================================================
  {
    const page = await desktopPage('?gate=off');
    const m = await page.evaluate(async () => {
      const { isTouchDevice } = await import('/src/touch.js');
      const fake = ({ mtp = 0, ots = false, coarse = false, hoverNone = false, uaMobile } = {}) => ({
        navigator: { maxTouchPoints: mtp, userAgentData: uaMobile === undefined ? undefined : { mobile: uaMobile } },
        matchMedia: (q) => ({ matches: (q === '(pointer: coarse)' && coarse) || (q === '(hover: none)' && hoverNone) }),
        ...(ots ? { ontouchstart: null } : {}),
      });
      return {
        phone: isTouchDevice(fake({ mtp: 1, ots: true, coarse: true, hoverNone: true, uaMobile: true })),
        hoverlessTablet: isTouchDevice(fake({ hoverNone: true })),
        uaOnlyMobile: isTouchDevice(fake({ uaMobile: true })),
        touchscreenLaptop: isTouchDevice(fake({ mtp: 10, ots: true })),
        blindPhone: isTouchDevice(fake({})),
        desktop: isTouchDevice(fake({ coarse: false, hoverNone: false })),
      };
    });
    check('#29 detector: a phone says touch', m.phone === true);
    check('#29 detector: hoverless or UA-mobile alone is enough', m.hoverlessTablet === true && m.uaOnlyMobile === true, JSON.stringify(m));
    check('#29 detector: a touchscreen laptop says touch (as of #26)', m.touchscreenLaptop === true);
    check('#29 detector: a desktop says mouse', m.desktop === false);
    check('#29 detector: a phone lying about itself says mouse — and the live switch (8) is what saves it', m.blindPhone === false);
    await page.context().close();
  }

  // ===========================================================================
  // 12. Issue #38: the always-visible stick and the first-run hints. Brandon's
  //     phone feedback: a control you cannot see is a control you never find.
  //     The ring has to rest in view from the first frame, brighten under the
  //     thumb, and GLIDE HOME on release — never vanish. The chips and the
  //     swipe cue appear once when play starts and retire on the first touch
  //     (or by themselves after a few seconds). Desktop and capture (?gate=off)
  //     must show none of it, so every baseline pixel stays put.
  // ===========================================================================
  {
    const page = await phonePage('?seed=11');
    const rest = await page.evaluate(() => {
      const b = document.getElementById('stick-base');
      const cs = getComputedStyle(b);
      const r = b.getBoundingClientRect();
      return {
        display: cs.display,
        opacity: parseFloat(cs.opacity),
        border: cs.borderTopColor,
        shadow: cs.boxShadow,
        chev: document.querySelectorAll('#stick-base .sb-chev').length,
        cx: (r.left + r.right) / 2,
        cy: (r.top + r.bottom) / 2,
        inView: r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1,
        intro: parseFloat(getComputedStyle(document.getElementById('touch-intro')).opacity),
        cue: parseFloat(getComputedStyle(document.getElementById('look-hint')).opacity),
      };
    });
    check('#38 the ring rests in view while the gate is up', rest.display === 'block' && rest.opacity > 0.5 && rest.inView && rest.chev === 4, `${rest.display} @ ${rest.opacity.toFixed(2)}`);
    check('#38 ring contrast: light ring AND dark outline (bright and dark scenes)', /rgba?\(247, 244, 238/.test(rest.border) && /rgba?\(10, 13, 18/.test(rest.shadow), `${rest.border} / ${rest.shadow.slice(0, 42)}…`);
    check('#38 hints stay asleep until the gate lifts', rest.intro < 0.1 && rest.cue < 0.1);

    await page.tap('#gate-btn');
    await waitPhase(page, 'find');
    const shown = await page
      .waitForFunction(
        () => {
          const i = parseFloat(getComputedStyle(document.getElementById('touch-intro')).opacity);
          return i > 0.9 && window.LC.touchDebug().controls?.intro === 'show';
        },
        null,
        { timeout: 6000 },
      )
      .then(() =>
        page.evaluate(() => ({
          intro: parseFloat(getComputedStyle(document.getElementById('touch-intro')).opacity),
          cue: parseFloat(getComputedStyle(document.getElementById('look-hint')).opacity),
          pulse: document.getElementById('stick-base').classList.contains('pulse'),
          oldHint: getComputedStyle(document.getElementById('hint')).display,
        })),
      )
      .catch(() => null);
    check('#38 first-run chips + swipe cue rise with the first frame of play', shown !== null && shown.intro > 0.9 && shown.cue > 0.4, JSON.stringify(shown));
    check('#38 the stick breathes gently once (first run)', shown?.pulse === true);
    check('#38 the old faint hint line is retired on phones', shown?.oldHint === 'none');

    const touch = await touchDriver(page);
    await touch.down(31, 140, 330); // the visible ring is where the thumb lands
    await touch.moveTo(31, 140, 258); // 72 px up → clamped to the 52 px rim
    await simSteps(page, 6);
    const pressed = await page.evaluate(() => {
      const b = document.getElementById('stick-base');
      const r = b.getBoundingClientRect();
      return {
        active: b.classList.contains('active'),
        opacity: parseFloat(getComputedStyle(b).opacity),
        cx: (r.left + r.right) / 2,
        cy: (r.top + r.bottom) / 2,
        knob: getComputedStyle(document.getElementById('stick-knob')).transform,
      };
    });
    check('#38 under the thumb: instant recentre at the press point, full brightness', pressed.active === true && pressed.opacity > 0.95 && Math.abs(pressed.cx - 140) < 6 && Math.abs(pressed.cy - 330) < 6, JSON.stringify(pressed));
    check('#38 the knob tracks the finger', /matrix\(1, 0, 0, 1, 0, -5[12]/.test(pressed.knob), pressed.knob);
    const retired = await page
      .waitForFunction(() => document.getElementById('touch-intro').classList.contains('gone'), null, { timeout: 3000 })
      .then(() =>
        page.evaluate(() => ({
          intro: parseFloat(getComputedStyle(document.getElementById('touch-intro')).opacity),
          cue: parseFloat(getComputedStyle(document.getElementById('look-hint')).opacity),
          pulse: document.getElementById('stick-base').classList.contains('pulse'),
        })),
      )
      .catch(() => null);
    await page.waitForTimeout(700); // the 0.6 s fade lands
    const faded = await page.evaluate(() => ({
      intro: parseFloat(getComputedStyle(document.getElementById('touch-intro')).opacity),
      cue: parseFloat(getComputedStyle(document.getElementById('look-hint')).opacity),
    }));
    check('#38 the first game touch retires chips + cue + pulse', retired !== null && retired.pulse === false && faded.intro < 0.1 && faded.cue < 0.1, JSON.stringify({ retired, faded }));

    await touch.up(31);
    await page.waitForTimeout(500); // the 0.25 s glide home
    const home = await page.evaluate(() => {
      const b = document.getElementById('stick-base');
      const r = b.getBoundingClientRect();
      return {
        display: getComputedStyle(b).display,
        opacity: parseFloat(getComputedStyle(b).opacity),
        active: b.classList.contains('active'),
        cx: (r.left + r.right) / 2,
        cy: (r.top + r.bottom) / 2,
        knob: getComputedStyle(document.getElementById('stick-knob')).transform,
      };
    });
    check('#38 releasing glides the ring home — it stays visible', home.display === 'block' && home.active === false && home.opacity > 0.5 && Math.abs(home.cx - rest.cx) < 2 && Math.abs(home.cy - rest.cy) < 2, `${home.display} @ ${home.opacity.toFixed(2)} (${home.cx.toFixed(0)}, ${home.cy.toFixed(0)})`);
    check('#38 the knob returns to centre', home.knob === 'none' || /matrix\(1, 0, 0, 1, 0, 0\)/.test(home.knob), home.knob);
    check('#38 page: console clean', page.__errs.length === 0, page.__errs.join(' | '));
    await page.context().close();
  }

  // ---------------------------------------------------------------------------
  // 12b/12c. #38 on a short landscape phone: nobody's thumb targets overlap,
  // and the chips auto-fade with no touch at all.
  // ---------------------------------------------------------------------------
  {
    const page = await phonePage('?seed=11', { viewport: { width: 740, height: 360 }, dsf: 2 });
    const lay = await page.evaluate(() => {
      const r = (id) => {
        const q = document.getElementById(id).getBoundingClientRect();
        return { x0: q.left, y0: q.top, x1: q.right, y1: q.bottom };
      };
      const hit = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
      const stick = r('stick-base');
      const shout = r('shout-btn');
      const score = r('hud-score');
      const gear = r('settings-btn');
      return {
        stickInView: stick.y1 <= innerHeight + 1 && stick.y0 >= -1 && stick.x0 >= -1,
        so: hit(stick, shout),
        sc: hit(stick, score),
        sg: hit(stick, gear),
        ho: hit(shout, score),
        hgd: hit(shout, gear),
      };
    });
    check('#38 short landscape: stick, shout, score, gear never overlap', !lay.so && !lay.sc && !lay.sg && !lay.ho && !lay.hgd, JSON.stringify(lay));
    check('#38 short landscape: the resting ring is fully on screen', lay.stickInView);
    await page.tap('#gate-btn');
    await waitPhase(page, 'find');
    const autoFade = await page
      .waitForFunction(() => document.getElementById('touch-intro').classList.contains('gone') && window.LC.touchDebug().controls?.intro === 'gone', null, { timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    check('#38 chips retire on their own with no touch at all', autoFade);
    check('#38 short landscape page: console clean', page.__errs.length === 0, page.__errs.join(' | '));
    await page.context().close();
  }

  // ---------------------------------------------------------------------------
  // 12d/12e. #38 none of it leaks to desktop or into a capture frame.
  // ---------------------------------------------------------------------------
  {
    const page = await desktopPage('?seed=11');
    const dom = await page.evaluate(() => ({
      stick: getComputedStyle(document.getElementById('stick-base')).display,
      intro: getComputedStyle(document.getElementById('touch-intro')).display,
      look: getComputedStyle(document.getElementById('look-hint')).display,
      hint: getComputedStyle(document.getElementById('hint')).display,
    }));
    check('#38 desktop: no resting ring, no chips, no cue, hint line unchanged', dom.stick === 'none' && dom.intro === 'none' && dom.look === 'none' && dom.hint !== 'none', JSON.stringify(dom));
    await page.context().close();
  }
  {
    const page = await phonePage('?gate=off');
    const dom = await page.evaluate(() => ({
      capture: document.body.classList.contains('capture'),
      stick: getComputedStyle(document.getElementById('stick-base')).display,
      intro: getComputedStyle(document.getElementById('touch-intro')).display,
      look: getComputedStyle(document.getElementById('look-hint')).display,
      touch: window.LC.touchDebug().controls?.intro ?? null,
    }));
    check('#38 capture mode (?gate=off) carries none of the teaching chrome', dom.capture === true && dom.stick === 'none' && dom.intro === 'none' && dom.look === 'none', JSON.stringify(dom));
    check('#38 capture page: console clean', page.__errs.length === 0, page.__errs.join(' | '));
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
