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
//   13  #57 the title screen: up before the start (inline-SVG logo + START,
//       selfTest green from behind it), lifted by Play, laid out clean at
//       desktop / 3440×1440 / 740×360, and FULLY absent under ?gate=off
//   14  #77 the installable web app: manifest + icons + iOS tags exist and
//       are right; the one-time install hint shows ONLY on an iPhone in the
//       browser (never desktop, Android, standalone or ?gate=off), sits under
//       START, dismisses for good and never blocks it; the start tap stops
//       asking for fullscreen once standalone; with ?safe=notch (a simulated
//       iPhone-landscape inset) the canvas fills the screen edge to edge —
//       no black band on the notch side — and gear, stick, score and shout
//       all stay inside the safe area
//   15  #99 the desktop path to the settings gear: Play captures the pointer
//       (the gear takes no click while locked, by browser rule), Esc/P release
//       to a paused card whose gear is the TOP element, the gear and the card's
//       Settings/Resume buttons work, a changed setting sticks through the URL
//       reload, O opens settings straight from play, Esc-on-card resumes (M is
//       the menu door), a DENIED pointer lock still pauses with a free cursor
//       and a MISSING one resumes without ever a dead state, the touch card is
//       unchanged, and the card fits a 740×360 window clear of the gear
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
async function desktopPage(params, opts = {}) {
  const { viewport = { width: 1280, height: 800 } } = opts;
  const context = await browser.newContext({ viewport });
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

    // The title screen (issue #57) rides the same gate: at rest the card is
    // UP, logo and START visible, on a phone under the body.splash class too.
    const title = await page.evaluate(() => ({
      shown: !document.getElementById('gate').classList.contains('hidden'),
      splash: document.body.classList.contains('splash'),
      logo: (() => {
        const s = document.querySelector('#gate svg.bobo');
        const r = s.getBoundingClientRect();
        return r.width > 24 && r.height > 24 && s.getAttribute('aria-label') === 'Look at Bobo';
      })(),
      word: document.getElementById('title-word').textContent === 'LOOK AT BOBO!',
      wordInView: (() => {
        const r = document.getElementById('title-word').getBoundingClientRect();
        return r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1;
      })(),
    }));
    check('#57 phone: title screen up at rest — logo, wordmark, splash class', title.shown && title.splash && title.logo && title.word && title.wordInView, JSON.stringify(title));

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
      splash: document.body.classList.contains('splash'),
      locked: document.pointerLockElement !== null,
    }));
    const s1 = await st(page);
    check('phone: gate tap starts the game, no pointer lock', after.hidden && !after.splash && after.locked === false && s1.gateOpen === true && s1.paused === false, `phase ${s1.phase}, locked ${after.locked}, splash ${after.splash}`);

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
    check('mobile win run: exact ending text', ending.text === 'your did it! you wind' && ending.again === 'tap the shout button to go back to the menu', `"${ending.text}" / "${ending.again}"`);
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
    await page.tap('#shout-btn'); // a real finger this time: it must hand back to the menu (issue #57)
    await waitPhase(page, 'find');
    const re = await st(page);
    const menu = await page.evaluate(() => ({
      shown: !document.getElementById('gate').classList.contains('hidden'),
      splash: document.body.classList.contains('splash'),
      locked: document.pointerLockElement !== null,
    }));
    check(
      'mobile win run: shout returns to the title screen only after the cooldown',
      re.phase === 'find' && re.score === 0 && menu.shown && menu.splash,
      `then ${re.phase} at ${re.score}, card ${menu.shown ? 'up' : 'down'}`,
    );
    await page.tap('#gate-btn'); // Play from the card: a fresh run, same door as the first time
    await waitPhase(page, 'find');
    const s2 = await st(page);
    const replay = await page.evaluate(() => ({ splash: document.body.classList.contains('splash'), hidden: document.getElementById('gate').classList.contains('hidden') }));
    check('mobile win run: Play from the title screen starts a fresh run', s2.score === 0 && s2.paused === false && !replay.splash && replay.hidden, `score ${s2.score}, splash ${replay.splash}`);
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
  // ===========================================================================
  // 13. Issue #57: the title screen. Up before the start (logo + START),
  //     lifted by Play, and FULLY absent under ?gate=off — and at every
  //     viewport the page is read at (desktop, an ultrawide, a short
  //     landscape phone) the logo, the instructions and START lay out
  //     without touching each other or the frame edges.
  // ===========================================================================
  const TITLE_LAY = () => {
    const boxes = [];
    for (const [name, sel] of [
      ['mark', '#gate svg.bobo'],
      ['word', '#title-word'],
      ['tagline', '.title-tagline'],
      ['hint', '.title-hint'],
      ['start', '#gate-btn'],
      ['row', '.title-row'],
      ['note', '.gate-note'],
      ['stamp', '#build-stamp'],
    ]) {
      const n = document.querySelector(sel);
      if (!n) continue;
      const r = n.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) boxes.push({ name, x0: r.left, y0: r.top, x1: r.right, y1: r.bottom });
    }
    const hit = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
    const bad = [];
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        if ((boxes[i].name === 'mark' && boxes[j].name === 'word') || (boxes[i].name === 'word' && boxes[j].name === 'mark')) continue; // the peek is the logo
        if (hit(boxes[i], boxes[j])) bad.push(`${boxes[i].name}×${boxes[j].name}`);
      }
    const cr = (() => { const e = document.querySelector('#gate .gate-card'); if (!e) return null; const r = e.getBoundingClientRect(); return r.width > 0 ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right } : null; })();
    for (const b of boxes) {
      const spill = cr && (b.y1 > cr.bottom + 1 || b.y0 < cr.top - 1 || b.x1 > cr.right + 1 || b.x0 < cr.left - 1);
      if (spill) bad.push(`${b.name} out of card`);
      else if (b.y0 < -1 || b.y1 > innerHeight + 1 || b.x0 < -1 || b.x1 > innerWidth + 1) bad.push(`${b.name} off-screen`);
    }
    const word = boxes.find((b) => b.name === 'word');
    return { n: boxes.length, bad, wordW: word ? word.x1 - word.x0 : 0, vw: innerWidth, vh: innerHeight };
  };

  // 13a. Desktop, card up: the whole selfTest suite runs from BEHIND the
  // title screen (its restore path must survive a page that never started),
  // and the title checks see the card shown.
  {
    const page = await desktopPage('?seed=11');
    const lay = await page.evaluate(TITLE_LAY);
    const before = await page.evaluate(() => {
      const r = document.getElementById('gate').getBoundingClientRect();
      return {
        covers: r.width >= innerWidth - 1 && r.height >= innerHeight - 1,
        start: document.getElementById('gate-btn').textContent,
        logo: (() => {
          const s = document.querySelector('#gate svg.bobo');
          return { label: s.getAttribute('aria-label'), title: s.querySelector('title')?.textContent, w: s.getBoundingClientRect().width };
        })(),
        st: window.LC.selfTest(),
      };
    });
    before.lay = lay;
    const tc = before.st.checks.filter((c) => c.name.startsWith('title-'));
    check('#57 desktop: title screen up before the start — logo named, START ready', before.lay.n >= 6 && before.lay.bad.length === 0 && before.covers && before.start === 'START' && before.logo.label === 'Look at Bobo' && before.logo.title === 'Look at Bobo' && before.logo.w > 60, JSON.stringify({ bad: before.lay.bad, start: before.start, logo: before.logo }));
    check('#57 desktop: selfTest runs from behind the title card', before.st.pass && tc.length === 3 && tc.every((c) => c.pass && c.value !== 'n/a (card down)'), tc.map((c) => `${c.name}=${c.value}${c.pass ? '' : ' FAIL'}`).join(' | ') || before.st.checks.filter((c) => !c.pass).map((c) => c.name).join(', '));
    await page.click('#gate-btn');
    await waitPhase(page, 'find');
    const gone = await page.evaluate(() => ({
      hidden: document.getElementById('gate').classList.contains('hidden'),
      splash: document.body.classList.contains('splash'),
      locked: document.pointerLockElement !== null,
      playing: window.LC.state().playing,
    }));
    check('#57 desktop: Play lifts the card and starts the live loop', gone.hidden && !gone.splash && gone.playing, JSON.stringify(gone));
    await page.context().close();
  }

  // 13b. The ultrawide: the card centres and nothing touches the edges.
  {
    const page = await desktopPage('?seed=11', { viewport: { width: 3440, height: 1440 } });
    const lay = await page.evaluate(TITLE_LAY);
    check('#57 ultrawide 3440×1440: title layout clean', lay.n >= 6 && lay.bad.length === 0, JSON.stringify(lay));
    await page.context().close();
  }

  // 13c. The short landscape phone (~360px tall): the same promise, thumbs-first size.
  {
    const page = await phonePage('?seed=11', { viewport: { width: 740, height: 360 }, dsf: 2 });
    const lay = await page.evaluate(TITLE_LAY);
    check('#57 short landscape 740×360: title layout clean, wordmark fits', lay.n >= 5 && lay.bad.length === 0 && lay.wordW < lay.vw, JSON.stringify(lay));
    await page.context().close();
  }

  // 13d. ?gate=off: the title screen is fully hidden and empty — no class,
  // no pixels — so capture and determinism see exactly the game.
  {
    const page = await phonePage('?gate=off');
    const off = await page.evaluate(() => ({
      gateHidden: document.getElementById('gate').classList.contains('hidden'),
      gateShown: getComputedStyle(document.getElementById('gate')).display !== 'none',
      splash: document.body.classList.contains('splash'),
      // "nothing painted" = NOT RENDERED: children of a display:none subtree
      // keep their own computed display, so offsetParent is the honest test.
      word: document.getElementById('title-word').offsetParent === null ? 'unpainted' : 'painted',
      st: window.LC.selfTest().checks.filter((c) => c.name.startsWith('title-')).map((c) => ({ n: c.name, v: c.value, p: c.pass })),
    }));
    check('#57 ?gate=off: title screen fully absent — no splash class, nothing painted', off.gateHidden && !off.gateShown && !off.splash && off.word === 'unpainted', JSON.stringify({ gateShown: off.gateShown, splash: off.splash, word: off.word }));
    check('#57 ?gate=off: the title checks say "absent" and pass', off.st.length === 3 && off.st.every((c) => c.p) && off.st[0].v === 'absent', JSON.stringify(off.st));
    check('#57 capture page: console clean', page.__errs.length === 0, page.__errs.join(' | '));
    await page.context().close();
  }

  // ===========================================================================
  // 14. Issue #77: the installable web app — the manifest and icons and iOS
  //     tags (checked from the files themselves), the one-time iPhone install
  //     hint (shown only where page fullscreen is actually impossible), the
  //     standalone path that no longer re-asks for fullscreen, and the
  //     notch-fill layout under ?safe=notch, the test-only simulated
  //     iPhone-landscape inset (players never set it).
  // ===========================================================================

  // 14a. Node side: the manifest file and the page's own tags.
  {
    let mf = null;
    let mfErr = '';
    try {
      mf = JSON.parse(readFileSync(join(REPO, 'manifest.webmanifest'), 'utf8'));
    } catch (e) {
      mfErr = String(e);
    }
    check('#77 manifest.webmanifest parses as JSON', !!mf, mfErr);
    const req = mf && {
      name: mf.name === 'Look at Bobo',
      short: mf.short_name === 'Look at Bobo',
      start: mf.start_url === 'game/full.html',
      scope: mf.scope === '.',
      display: mf.display === 'fullscreen',
      override: Array.isArray(mf.display_override) && mf.display_override[0] === 'fullscreen' && mf.display_override.includes('standalone'),
      orient: mf.orientation === 'landscape',
      colors: mf.theme_color === '#14181f' && mf.background_color === '#14181f',
      icons: Array.isArray(mf.icons) && mf.icons.length >= 3,
    };
    check('#77 manifest: name, short_name, relative start_url to the game entry, scope, fullscreen display + override, landscape, dark theme/background, icons[]',
      !!req && Object.values(req).every(Boolean), req ? Object.entries(req).filter(([, v]) => !v).map(([k]) => k).join(',') : 'unparsed');
    const pngSize = (rel) => {
      const p = join(REPO, rel);
      if (!existsSync(p)) return null;
      const b = readFileSync(p);
      if (b.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
      return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
    };
    check('#77 every manifest icon exists at its stated REAL pixel size',
      !!mf && (mf.icons || []).length >= 3 && mf.icons.every((i) => pngSize(i.src) === i.sizes),
      mf ? (mf.icons || []).map((i) => `${i.src}=${pngSize(i.src) || 'missing'} want ${i.sizes}`).join(' | ') : '');
    check('#77 a maskable icon is declared (purpose:"maskable") and real',
      !!mf && (mf.icons || []).some((i) => i.purpose === 'maskable' && pngSize(i.src) === i.sizes));
    const touchSize = pngSize('assets/icons/apple-touch-icon.png');
    check('#77 apple-touch-icon.png exists at 180x180', touchSize === '180x180', String(touchSize));
    const htmlSrc = readFileSync(join(REPO, 'game/full.html'), 'utf8');
    check('#77 game/full.html carries the manifest link + iOS home-screen tags',
      htmlSrc.includes('rel="manifest"') && htmlSrc.includes('manifest.webmanifest') &&
      htmlSrc.includes('<meta name="mobile-web-app-capable" content="yes"') &&
      htmlSrc.includes('name="apple-mobile-web-app-capable" content="yes"') &&
      htmlSrc.includes('name="apple-mobile-web-app-status-bar-style" content="black-translucent"') &&
      htmlSrc.includes('name="apple-mobile-web-app-title" content="Look at Bobo"') &&
      htmlSrc.includes('rel="apple-touch-icon"') && htmlSrc.includes('assets/icons/apple-touch-icon.png') &&
      htmlSrc.includes('name="theme-color" content="#14181f"'));
    check('#77 viewport meta: viewport-fit=cover present, user-scalable=no kept',
      /viewport" content="[^"]*viewport-fit=cover[^"]*user-scalable=no[^"]*"/.test(htmlSrc));
  }

  // 14b–14d. The install hint, in the browser contexts it cares about.
  const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
  const AS_STANDALONE = () => {
    Object.defineProperty(navigator, 'standalone', { get: () => true });
  };
  const FS_COUNTER = () => {
    window.__fs = 0;
    const orig = Element.prototype.requestFullscreen;
    Element.prototype.requestFullscreen = function (...a) {
      window.__fs++;
      return orig.apply(this, a);
    };
  };
  /** phonePage, but with a chosen UA and extra init scripts. */
  async function mobilePage(params, { ua = IPHONE_UA, viewport = LAND, dsf = 3, inits = [] } = {}) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: dsf, hasTouch: true, isMobile: true, userAgent: ua });
    await context.addInitScript(LOCK_COUNTER);
    for (const init of inits) await context.addInitScript(init);
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
  {

    // iPhone in Safari, not installed: the hint is there, under START, and
    // dismisses for good — and START itself still starts the game.
    const page = await mobilePage('?seed=11', { inits: [FS_COUNTER] });
    const seen = await page.evaluate(() => {
      const h = document.getElementById('gate-install-hint');
      if (!h) return null;
      const r = h.getBoundingClientRect();
      const b = document.getElementById('gate-btn').getBoundingClientRect();
      return {
        text: h.textContent.replace(/\s+/g, ' ').trim(),
        share: !!h.querySelector('svg.hint-share'),
        under: r.top >= b.bottom - 1 && Math.abs((r.left + r.right) / 2 - (b.left + b.right) / 2) < 40,
        shown: getComputedStyle(h).display !== 'none' && r.width > 40 && r.height > 8,
        gateUp: !document.getElementById('gate').classList.contains('hidden'),
      };
    });
    check('#77 iPhone in the browser: install hint under START with a share glyph, game still on the title screen',
      !!seen && seen.shown && seen.share && seen.under && seen.gateUp && /Share/.test(seen.text) && /Add to Home Screen/.test(seen.text), JSON.stringify(seen));
    await page.tap('#gate-install-hint');
    const gone = await page.evaluate(() => ({
      gone: !document.getElementById('gate-install-hint'),
      gateUp: !document.getElementById('gate').classList.contains('hidden'),
      flag: localStorage.getItem('lookatbobo.install-hint') === '1',
    }));
    check('#77 a tap dismisses the hint for good — and does NOT start the game', gone.gone && gone.gateUp && gone.flag, JSON.stringify(gone));
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.LC?.ready === true, null, { timeout: 45000 });
    check('#77 after a reload the hint stays dismissed', await page.evaluate(() => !document.getElementById('gate-install-hint')));
    await page.evaluate(() => localStorage.removeItem('lookatbobo.install-hint'));
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.LC?.ready === true, null, { timeout: 45000 });
    check('#77 with the dismissal cleared the hint is back', await page.evaluate(() => !!document.getElementById('gate-install-hint')));
    await page.tap('#gate-btn');
    await waitPhase(page, 'find');
    check('#77 the hint never blocks START: the live loop runs after the tap', (await st(page)).playing);
    check('#77 in the browser the start tap still asks for fullscreen exactly once (Android path untouched)',
      (await page.evaluate(() => window.__fs)) === 1, `__fs=${await page.evaluate(() => window.__fs)}`);
    check('#77 iPhone hint page: console clean', page.__errs.length === 0, page.__errs.join(' | '));
    await page.context().close();

    const desk = await desktopPage('?seed=11');
    check('#77 desktop: no install hint', await desk.evaluate(() => !document.getElementById('gate-install-hint')));
    await desk.context().close();

    const and = await mobilePage('?seed=11', { ua: ANDROID_UA });
    check('#77 Android phone: no install hint (its browser already goes fullscreen)',
      await and.evaluate(() => !document.getElementById('gate-install-hint')));
    await and.context().close();

    const sa = await mobilePage('?seed=11', { inits: [AS_STANDALONE, FS_COUNTER] });
    const s = await sa.evaluate(() => ({ hint: !!document.getElementById('gate-install-hint'), standalone: navigator.standalone === true }));
    check('#77 standalone (launched from the home-screen icon): no hint', s.standalone && !s.hint, JSON.stringify(s));
    await sa.tap('#gate-btn');
    await waitPhase(sa, 'find');
    const saFs = await sa.evaluate(() => window.__fs);
    check('#77 standalone: the start tap does NOT re-ask for fullscreen (there is nothing to ask for)', saFs === 0, `__fs=${saFs}`);
    await sa.context().close();

    const off = await mobilePage('?gate=off&seed=11');
    const o = await off.evaluate(() => ({ hint: !!document.getElementById('gate-install-hint'), gateHidden: document.getElementById('gate').classList.contains('hidden') }));
    check('#77 ?gate=off on an iPhone UA: the hint never exists, so every capture baseline stays byte-identical',
      !o.hint && o.gateHidden, JSON.stringify(o));
    await off.context().close();
  }

  // 14e. The notch: ?safe=notch at real iPhone landscape sizes. The canvas
  // must fill the whole screen (the Chrome-on-iPhone black band on the notch
  // side is exactly what this kills), the left-edge column must be game
  // pixels not letterbox, and every control stays inside the simulated inset
  // (--safe-l 59, --safe-r 44, --safe-b 21 — see game/full.html).
  {
    for (const vp of [{ width: 844, height: 390 }, { width: 932, height: 430 }, { width: 667, height: 375 }]) {
      const page = await mobilePage('?seed=11&safe=notch', { viewport: vp, dsf: 2 });
      await page.tap('#gate-btn');
      await waitPhase(page, 'find');
      await simSteps(page, 24);
      const geo = await page.evaluate(() => {
        const r = document.querySelector('canvas').getBoundingClientRect();
        return {
          notch: document.documentElement.classList.contains('safe-notch'),
          sl: getComputedStyle(document.documentElement).getPropertyValue('--safe-l').trim(),
          x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
          vw: innerWidth, vh: innerHeight,
        };
      });
      check(`#77 ?safe=notch ${vp.width}×${vp.height}: the canvas fills the viewport edge to edge — notch zone included`,
        geo.notch && geo.sl === '59px' && Math.abs(geo.x) <= 1 && Math.abs(geo.y) <= 1 && geo.w >= geo.vw - 1 && geo.h >= geo.vh - 1,
        JSON.stringify(geo));
      const shot = (await page.screenshot({ clip: { x: 0, y: 0, width: 4, height: vp.height } })).toString('base64');
      const strip = await page.evaluate(async (b64) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const cv = document.createElement('canvas');
        cv.width = img.naturalWidth;
        cv.height = img.naturalHeight;
        const ctx = cv.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
        let pure = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] <= 2 && d[i + 1] <= 2 && d[i + 2] <= 2) pure++;
        return { pure, total: d.length / 4 };
      }, shot);
      check(`#77 ?safe=notch ${vp.width}×${vp.height}: the left-edge column is game picture, not a black letterbox band`,
        strip.pure / strip.total < 0.2, JSON.stringify(strip));
      if (vp.width === 844) {
        const pad = await page.evaluate(() => {
          const r = (id) => {
            const e = document.getElementById(id);
            const b = e.getBoundingClientRect();
            return { x0: Math.round(b.left), x1: Math.round(b.right), y1: Math.round(b.bottom), shown: getComputedStyle(e).display !== 'none' };
          };
          return { gear: r('settings-btn'), stick: r('stick-base'), score: r('hud-score'), shout: r('shout-btn') };
        });
        const L = 59 - 1;
        const R = geo.vw - 44 + 1;
        const B = geo.vh - 21 + 1;
        check('#77 the notch inset holds every control: gear+stick off the notch side, score+shout off the right edge and the home bar',
          pad.gear.shown && pad.gear.x0 >= L && pad.stick.shown && pad.stick.x0 >= L && pad.score.shown && pad.score.x1 <= R && pad.shout.shown && pad.shout.x1 <= R && pad.shout.y1 <= B,
          JSON.stringify(pad));
        check('#77 notch page: console clean', page.__errs.length === 0, page.__errs.join(' | '));
      }
      await page.context().close();
    }

    // The title card under the same simulated notch: padded INSIDE it, and
    // still laid out clean.
    const page = await mobilePage('?seed=11&safe=notch');
    const t = await page.evaluate(() => {
      const cs = getComputedStyle(document.querySelector('#gate .gate-card'));
      return { pl: parseFloat(cs.paddingLeft), pr: parseFloat(cs.paddingRight) };
    });
    const lay = await page.evaluate(TITLE_LAY);
    check('#77 title card with a notch: padded past both insets, layout still clean',
      t.pl >= 59 && t.pr >= 44 && lay.n >= 5 && lay.bad.length === 0, JSON.stringify({ ...t, bad: lay.bad }));
    await page.context().close();
  }

  // ===========================================================================
  // 15. Issue #99: desktop settings reachability. The mouse is captured while
  //     playing, so the gear can only ever be reached from a PAUSED state —
  //     and #hud's fixed-stacking-context used to paint #pause (45) OVER the
  //     gear (55 inside #hud), so paused clicks re-grabbed the pointer. The
  //     card now carries Settings + Resume, Esc/P toggle the pause, O opens
  //     the panel directly, and a denied (or missing) pointer-lock API must
  //     still leave a working, resumable pause. Touch pages change nowhere.
  // ===========================================================================
  {
    const page = await desktopPage('?seed=11');
    const s = () =>
      page.evaluate(() => ({
        paused: window.LC.state().paused,
        locked: document.pointerLockElement !== null,
        card: document.getElementById('pause').classList.contains('show'),
        panel: document.getElementById('settings-panel').classList.contains('show'),
        open: !!window.__lcSettingsOpen,
        menu: !document.getElementById('gate').classList.contains('hidden'),
      }));

    await page.click('#gate-btn');
    await page.waitForTimeout(400);
    const play = await s();
    check('#99 mouse: Play grabs the pointer and plays', play.locked === true && play.paused === false && play.card === false, JSON.stringify(play));

    // While the pointer is CAPTURED no click can reach anything but the view —
    // the browser routes it there. That is the physical half of the bug; the
    // way in is Esc/P, which is what the next checks prove works.
    await page.mouse.click(36, 36);
    await page.waitForTimeout(250);
    const lockedGear = await s();
    check('#99 mouse: while locked the gear takes no click (browser rule — the pause state is the door)', lockedGear.panel === false && lockedGear.locked === true, JSON.stringify(lockedGear));

    // Esc: release + paused card, with the gear CLICKABLE under a normal cursor.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const paused = await s();
    const hit = await page.evaluate(() => {
      const r = document.getElementById('settings-btn').getBoundingClientRect();
      const tops = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { first: tops[0]?.id, hasGear: tops[0]?.id === 'settings-btn' };
    });
    check('#99 mouse: Esc pauses with the card up, pointer free', paused.paused === true && paused.card === true && paused.locked === false, JSON.stringify(paused));
    check('#99 mouse: paused state — the gear is the TOP element (was #pause before #99)', hit.hasGear === true, `elementFromPoint → ${hit.first}`);

    // Click the gear → panel over the card; Esc → back onto the card.
    await page.click('#settings-btn');
    await page.waitForTimeout(250);
    const gearClick = await s();
    check('#99 mouse: paused gear click opens the panel over the pause card', gearClick.panel === true && gearClick.paused === true && gearClick.card === true && gearClick.locked === false && gearClick.open === true, JSON.stringify(gearClick));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    const panelEsc = await s();
    check('#99 mouse: Esc closes the panel back onto the pause card (never a dead state)', panelEsc.panel === false && panelEsc.card === true && panelEsc.paused === true, JSON.stringify(panelEsc));

    // Change a setting from there — settings live in the URL, so this reloads
    // the page with the new param (the step-9 design, unchanged by #99).
    await page.evaluate(() => {
      const q = document.getElementById('set-sens');
      q.value = '1.5';
      q.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForFunction(() => window.LC?.ready === true, null, { timeout: 45000 });
    const changed = await page.evaluate(() => ({ url: location.search, sens: document.getElementById('set-sens').value }));
    check('#99 mouse: a setting changed from the paused panel sticks', changed.url.includes('sens=1.5') && changed.sens === '1.5', changed.url);

    // The card's own buttons: Settings opens the panel, Resume re-grabs.
    await page.click('#gate-btn');
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.click('#pause-settings');
    await page.waitForTimeout(250);
    const cardBtn = await s();
    check('#99 mouse: the pause card has a working Settings button', cardBtn.panel === true && cardBtn.paused === true, JSON.stringify(cardBtn));
    await page.click('#settings-close');
    await page.waitForTimeout(200);
    await page.click('#pause-resume');
    await page.waitForTimeout(400);
    const resumed = await s();
    check('#99 mouse: the pause card has a working Resume button (re-locks, plays)', resumed.paused === false && resumed.locked === true && resumed.card === false, JSON.stringify(resumed));

    // O from play: releases the mouse, pauses, opens the panel directly.
    await page.keyboard.press('KeyO');
    await page.waitForTimeout(400);
    const oKey = await s();
    check('#99 mouse: O releases the pointer and opens settings straight from play', oKey.paused === true && oKey.locked === false && oKey.panel === true && oKey.card === true, JSON.stringify(oKey));
    await page.keyboard.press('KeyO'); // again: close back onto the card
    await page.waitForTimeout(250);
    const oClose = await s();
    check('#99 mouse: O again closes the panel back onto the card', oClose.panel === false && oClose.card === true && oClose.paused === true, JSON.stringify(oClose));

    // P toggles both ways; the card background still clicks back into play.
    await page.click('#pause'); // click anywhere = ask for the pointer back
    await page.waitForTimeout(400);
    const cardClick = await s();
    check('#99 mouse: clicking the card background re-grabs the pointer', cardClick.paused === false && cardClick.locked === true, JSON.stringify(cardClick));
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(300);
    const p1 = await s();
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(400);
    const p2 = await s();
    check('#99 mouse: P pauses and P resumes', p1.paused === true && p1.card === true && p2.paused === false && p2.locked === true, JSON.stringify({ p1, p2 }));

    // Esc on the card RESUMES now (issue #99 took over the #57 "Esc = menu"
    // shortcut); M is the menu door, exactly as the how-to line teaches.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const escTwice = await s();
    check('#99 mouse: Esc again resumes — it no longer leaves the run', escTwice.paused === false && escTwice.menu === false && escTwice.locked === true, JSON.stringify(escTwice));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.keyboard.press('KeyM');
    await page.waitForTimeout(300);
    const mMenu = await s();
    check('#99 mouse: M from the pause card still goes back to the menu', mMenu.menu === true && mMenu.card === false, JSON.stringify(mMenu));

    // The one-line hint: on the pause card and in the how-to copy (desktop).
    const copy = await page.evaluate(() => ({
      card: document.querySelector('.pause-help')?.textContent ?? '',
      howto: document.querySelector('#gate-howto-panel .only-desktop')?.textContent ?? '',
    }));
    check('#99 mouse: "Esc or P: pause and settings" reads on the pause card and the how-to', /Esc or P: pause and settings/.test(copy.card.replace(/\s+/g, ' ')) && /Esc or P: pause and settings/.test(copy.howto.replace(/\s+/g, ' ')), JSON.stringify(copy));
    check('#99 mouse page: console clean', page.__errs.length === 0, page.__errs.join(' | '));
    await page.context().close();
  }

  // 15b. The pointer lock is DENIED (a hardened browser, an iframe, the
  // instant-re-lock Chrome refuses after a quick Esc double-press): the game
  // must still pause with a normal cursor and the overlay must keep working —
  // a refused grab leaves the card up instead of eating the click.
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addInitScript(() => {
      Element.prototype.requestPointerLock = function () {
        setTimeout(() => document.dispatchEvent(new Event('pointerlockerror')), 0);
        return Promise.resolve();
      };
    });
    contexts.push(context);
    const page = await context.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && !IGNORE.test(m.text()) && errs.push(m.text()));
    await page.goto(`${server.url}game/full.html?seed=11`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.LC?.ready === true, null, { timeout: 45000 });
    await page.click('#gate-btn');
    await page.waitForTimeout(500);
    const running = await page.evaluate(() => ({ paused: window.LC.state().paused, locked: document.pointerLockElement !== null }));
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(300);
    const denied = await page.evaluate(() => ({
      paused: window.LC.state().paused,
      card: document.getElementById('pause').classList.contains('show'),
      gear: document.elementsFromPoint(36, 36)[0]?.id,
    }));
    check('#99 denied lock: the game runs with a free cursor and P still pauses with the card up', running.paused === false && running.locked === false && denied.paused === true && denied.card === true, JSON.stringify({ running, denied }));
    await page.click('#pause-resume'); // refused again — the card must stay, not a dead state
    await page.waitForTimeout(300);
    const refused = await page.evaluate(() => ({ paused: window.LC.state().paused, card: document.getElementById('pause').classList.contains('show') }));
    await page.click('#settings-btn');
    await page.waitForTimeout(250);
    const panel = await page.evaluate(() => document.getElementById('settings-panel').classList.contains('show'));
    check('#99 denied lock: a refused Resume keeps the card up and the overlay stays usable (gear opens the panel)', refused.paused === true && refused.card === true && panel === true, JSON.stringify({ refused, panel }));
    check('#99 denied-lock page: console clean', errs.length === 0, errs.join(' | '));
    await context.close();
  }

  // 15c. The pointer lock API is MISSING entirely (some iframes/browsers):
  // Resume must take the game back with a normal cursor — never a dead click.
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addInitScript(() => {
      Element.prototype.requestPointerLock = undefined;
    });
    contexts.push(context);
    const page = await context.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && !IGNORE.test(m.text()) && errs.push(m.text()));
    await page.goto(`${server.url}game/full.html?seed=11`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.LC?.ready === true, null, { timeout: 45000 });
    await page.click('#gate-btn');
    await page.waitForTimeout(500);
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(300);
    const paused = await page.evaluate(() => ({ paused: window.LC.state().paused, card: document.getElementById('pause').classList.contains('show') }));
    await page.click('#pause-resume');
    await page.waitForTimeout(300);
    const resumed = await page.evaluate(() => ({ paused: window.LC.state().paused, card: document.getElementById('pause').classList.contains('show') }));
    check('#99 no lock API at all: P pauses, Resume resumes with a normal cursor (no dead state)', paused.paused === true && paused.card === true && resumed.paused === false && resumed.card === false, JSON.stringify({ paused, resumed }));
    check('#99 no-lock-API page: console clean', errs.length === 0, errs.join(' | '));
    await context.close();
  }

  // 15d. Touch unchanged: the card keeps its tap-anywhere wording, the new
  // desktop doors retire on phones (the gear stays always-visible, and now
  // sits above the title card instead of under it — same pixels, real reach),
  // and on a short landscape window the card fits with nothing overlapping.
  {
    const page = await desktopPage('?touch=on&seed=11');
    const dom = await page.evaluate(() => ({
      resume: getComputedStyle(document.getElementById('pause-resume')).display,
      settings: getComputedStyle(document.getElementById('pause-settings')).display,
      help: getComputedStyle(document.querySelector('.pause-help')).display,
      sub: document.querySelector('#pause .pause-sub')?.textContent,
      gear: getComputedStyle(document.getElementById('settings-btn')).display,
      gearTop: document.elementsFromPoint(23, 23)[0]?.id,
    }));
    check('#99 touch: the card is untouched — no resume/settings/help, tap-anywhere wording', dom.resume === 'none' && dom.settings === 'none' && dom.help === 'none' && dom.sub === 'tap anywhere to keep looking', JSON.stringify(dom));
    check('#99 touch: the gear stays always-visible (and reaches the finger over the title card)', dom.gear === 'flex' && dom.gearTop === 'settings-btn', JSON.stringify({ gear: dom.gear, gearTop: dom.gearTop }));
    await page.context().close();
  }
  {
    const page = await desktopPage('?seed=11', { viewport: { width: 740, height: 360 } });
    await page.click('#gate-btn');
    await page.waitForTimeout(400);
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(300);
    const lay = await page.evaluate(() => {
      const card = document.querySelector('#pause .pause-card').getBoundingClientRect();
      const gear = document.getElementById('settings-btn').getBoundingClientRect();
      const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      return { card, gear, vh: innerHeight, inView: card.top >= -1 && card.bottom <= innerHeight + 1, overlap: hit(card, gear), shown: document.getElementById('pause').classList.contains('show') };
    });
    check('#99 short window 740×360: the pause card fits and clears the gear', lay.shown && lay.inView && lay.overlap === false, JSON.stringify(lay));
    check('#99 short-window page: console clean', page.__errs.length === 0, page.__errs.join(' | '));
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
