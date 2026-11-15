#!/usr/bin/env node
// tools/stress-playtest.mjs — Step 7 automated stress + bot playtest (issue #13).
//
// The Step 6 bot proves the happy path (walk, aim, shout, win). This tool
// tries to BREAK the slice the way real players and real machines do, and
// asserts what the game must never do. Scenarios:
//
//   1  full wins on three seeds, with a legality audit after EVERY round
//      (wake clear of both cats, on walkable floor, decoy legal, aim reachable)
//   2  the gentle-penalty run: DAG! on DAG! at 0 points, floors at 0, never a loss
//   3  Space-mashing: 30 keydowns in one burst (exactly one shout fires),
//      and the win screen cannot be skipped before the win line has landed
//   4  pause -> resume through the pause card (pointer-lock-change semantics)
//   5  window blur mid-walk: keys are never left stuck, the game pauses
//   6  reload mid-run: a clean fresh run, selfTest still passes
//   7  a 500 ms main-thread block: the clamped loop loses time, never teleports
//   8  rate independence: 1 s of wall time = +1.000 s of game time at
//      30/60/120/240 Hz (and a 5 s frame-time spike earns at most 0.25 s)
//   9  the camera really follows the player while W is held (the step 7
//      camera-follow regression: state said one thing, the camera sat still)
//  10  the whole selfTest suite run LIVE, from the player-camera view, after
//      a real trusted click on the gate (the view restore used to throw)
//  11  the live tells: label chip hidden for players, reticle softens on the
//      decoy, and a shout at nothing nudges instead of saying nothing at all
//
// Free and local: starts its own static server, uses the installed Chrome.
//
//   npm run playtest:stress

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStaticServer } from './serve.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(REPO, 'package.json'));
const { chromium } = require('playwright-core');
const exe = ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(existsSync);

// Which page to stress: the Step 6 slice by default, or the full game
// (`--page game/full.html --checks 47`). Every scenario's own scripts use
// ?win=3, so they stay short on either page.
const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : dflt;
};
const PAGE = arg('page', 'game/slice.html');
const CHECKS = Number(arg('checks', 43));

const server = await startStaticServer({ root: REPO, port: 0 });
const browser = await chromium.launch({
  executablePath: exe || undefined,
  channel: exe ? undefined : 'chrome',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

const results = [];
let failures = 0;
const pageErrors = [];

function check(name, pass, detail = '') {
  results.push(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!pass) failures++;
  return pass;
}

async function newPage(params = '') {
  const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
  page.on('console', (m) => m.type() === 'error' && pageErrors.push(m.text()));
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  await page.goto(`${server.url}${PAGE}${params}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.LC?.ready === true, null, { timeout: 30000 });
  return page;
}

const waitPhase = (page, p, ms = 15000) =>
  page.waitForFunction((ph) => window.LC.state().phase === ph, p, { timeout: ms });

// The rules that must hold in EVERY find phase, measured from the live scene
// (LC.catsDebug), not re-derived from the level table.
const AUDIT = `(() => {
  const c = window.LC.catsDebug();
  const dPlayer = (x, z) => Math.hypot(c.px - x, c.pz - z);
  const dBobo = dPlayer(c.bobo[0], c.bobo[2]);
  const dDecoy = dPlayer(c.decoy[0], c.decoy[2]);
  const dCats = Math.hypot(c.bobo[0] - c.decoy[0], c.bobo[2] - c.decoy[2]);
  const s = window.LC.state();
  return { dBobo, dDecoy, dCats, phase: s.phase, score: s.score,
    okPlayer: dBobo >= c.boboPush - 0.01 && dDecoy >= c.decoyPush - 0.01,
    okCats: dCats >= 1.2 - 0.01 };
})()`;

async function audit(page, where) {
  const a = await page.evaluate(AUDIT);
  return check(`audit ${where}`, a.okPlayer && a.okCats, `player ${a.dBobo.toFixed(2)}/${a.dDecoy.toFixed(2)} m from cats, cats ${a.dCats.toFixed(2)} m apart`);
}

// ---------------------------------------------------------------------------
// 1. full wins, three seeds, auditing every round
// ---------------------------------------------------------------------------
try {
  for (const seed of [11, 23, 47]) {
    const page = await newPage(`?gate=off&win=3&seed=${seed}`);
    await page.evaluate(() => window.LC.play());
    await waitPhase(page, 'find');
    await audit(page, `seed ${seed} round 1 (wake)`);
    for (let i = 0; i < 3; i++) {
      await waitPhase(page, 'find');
      const hits = await page.evaluate(() => window.LC.aimAt('bobo').hits);
      check(`seed ${seed} aim reaches Bobo (round ${i + 1})`, hits === 'cat-bobo', `centre ray: ${hits}`);
      await page.evaluate(() => window.LC.trigger('catch'));
      if (i < 2) {
        await waitPhase(page, 'catch');
        await waitPhase(page, 'find');
        await audit(page, `seed ${seed} round ${i + 2} (respawn)`);
      }
    }
    await waitPhase(page, 'win');
    const fin = await page.evaluate(() => ({
      s: window.LC.state(),
      ending: document.getElementById('ending').textContent,
    }));
    check(`seed ${seed} wins at 3`, fin.s.score === 3 && fin.ending === 'your did it! you wind', `score ${fin.s.score}, ending "${fin.ending}"`);
    await page.close();
  }
} catch (err) {
  check('wins-on-three-seeds', false, String(err).split('\n')[0]);
}

// ---------------------------------------------------------------------------
// 2. the gentle penalty: floor at 0, no game over, ever
// ---------------------------------------------------------------------------
try {
  const page = await newPage('?gate=off&seed=5');
  await page.evaluate(() => window.LC.play());
  await waitPhase(page, 'find');
  const scores = [];
  for (let i = 0; i < 4; i++) {
    await waitPhase(page, 'find');
    const hits = await page.evaluate(() => {
      const h = window.LC.aimAt('decoy').hits;
      window.LC.trigger('wrong'); // what aimShout does on a decoy hit
      return h;
    });
    check(`seed 5 aim reaches the decoy (DAG! ${i + 1})`, hits === 'cat-decoy', `centre ray: ${hits}`);
    await waitPhase(page, 'wrong');
    scores.push((await page.evaluate(() => window.LC.state())).score);
    await waitPhase(page, 'find');
  }
  check('score floors at 0 across four DAG!', scores.every((s) => s === 0), `scores: ${scores.join(', ')}`);
  const still = await page.evaluate(() => window.LC.state());
  check('still playing after four DAG! at 0', still.phase === 'find' && still.score === 0, `phase ${still.phase}`);
  await page.close();
} catch (err) {
  check('floor-at-zero-run', false, String(err).split('\n')[0]);
}

// ---------------------------------------------------------------------------
// 3. Space-mashing: one shout per real key, and the win cannot be skipped
// ---------------------------------------------------------------------------
try {
  const page = await newPage('?gate=off&win=3&seed=9');
  await page.evaluate(() => window.LC.play());
  await waitPhase(page, 'find');
  await page.evaluate(() => window.LC.aimAt('bobo'));
  // one burst of 30 keydowns (no repeats): the shout loop must consume them
  // while the phase is 'catch', so exactly ONE catch lands.
  await page.evaluate(() => {
    for (let i = 0; i < 30; i++) window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
  });
  await waitPhase(page, 'catch');
  const burst = await page.evaluate(() => window.LC.state());
  check('30 Space keydowns = exactly one shout', burst.score === 1, `score ${burst.score} after the burst`);

  await page.evaluate(() => {
    window.LC.setScore(2);
    window.LC.aimAt('bobo');
    window.LC.trigger('catch'); // win at 3
  });
  await waitPhase(page, 'win');
  await page.evaluate(() => {
    for (let i = 0; i < 20; i++) window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
  });
  await page.waitForTimeout(150); // well inside the 0.6 s cooldown
  const held = await page.evaluate(() => window.LC.state());
  check('win survives Space-mashing inside the cooldown', held.phase === 'win' && held.score === 3, `phase ${held.phase}, score ${held.score}`);
  await page.waitForTimeout(600); // cooldown over: the SAME key may skip
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })));
  const skipped = await page.evaluate(() => window.LC.state());
  check('after the cooldown Space skips the win', skipped.phase === 'find' && skipped.score === 0, `phase ${skipped.phase}, score ${skipped.score}`);

  // the win LINE plays once: a full 6 s celebration loop must not re-arm it
  await page.evaluate(() => {
    window.LC.setScore(2);
    window.LC.aimAt('bobo');
    window.LC.trigger('catch');
  });
  await waitPhase(page, 'win');
  await page.waitForFunction(() => window.LC.cuesDebug().fired.length >= 1, null, { timeout: 5000 });
  await page.waitForFunction(() => window.LC.loopDebug().time > 5.5, null, { timeout: 12000 }); // a wrap is next
  await page.waitForFunction(() => window.LC.loopDebug().time < 1.0, null, { timeout: 12000 }); // wrapped
  const winCues = await page.evaluate(() => window.LC.cuesDebug());
  check('win voice line does not replay on the celebration wrap', winCues.fired.length === 1, `fired cues after wrap: ${JSON.stringify(winCues.fired)} at t=${winCues.time}`);
  await page.close();
} catch (err) {
  check('space-mash-and-win-cooldown', false, String(err).split('\n')[0]);
}

// ---------------------------------------------------------------------------
// 4. pause -> resume through the pause card
// ---------------------------------------------------------------------------
try {
  const page = await newPage('?gate=off&seed=3');
  await page.evaluate(() => window.LC.play());
  await waitPhase(page, 'find');
  // the same event path a real pointer-lock loss delivers: pointerlockchange
  // with nothing locked -> the input layer queues 'pause'
  await page.evaluate(() => document.dispatchEvent(new Event('pointerlockchange')));
  await page.waitForFunction(() => window.LC.state().paused === true, null, { timeout: 3000 });
  const shown = await page.evaluate(() => ({
    paused: window.LC.state().paused,
    card: document.getElementById('pause').classList.contains('show'),
  }));
  check('pointer-lock loss pauses and shows the card', shown.paused && shown.card);
  const before = await page.evaluate(() => window.LC.state().time);
  await page.waitForTimeout(400);
  const heldTime = await page.evaluate(() => window.LC.state().time);
  check('time is frozen while paused', Math.abs(heldTime - before) < 1e-9, `t=${before} -> ${heldTime}`);
  await page.locator('#pause').click(); // the real click-to-resume path
  await page.waitForFunction(() => window.LC.state().paused === false, null, { timeout: 3000 });
  await page.waitForFunction((t0) => window.LC.state().time > t0 + 0.05, before, { timeout: 3000 });
  check('clicking the card resumes the clock', true, 'time advanced again');
  await page.close();
} catch (err) {
  check('pause-resume-via-card', false, String(err).split('\n')[0]);
}

// ---------------------------------------------------------------------------
// 5. window blur mid-walk: no stuck keys
// ---------------------------------------------------------------------------
try {
  const page = await newPage('?gate=off&seed=4');
  await page.evaluate(() => window.LC.play());
  await waitPhase(page, 'find');
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' })));
  await page.waitForTimeout(350);
  const walking = await page.evaluate(() => window.LC.state());
  const moved = await page.evaluate((p) => {
    const s = window.LC.state();
    return Math.hypot(s.px - p.px, s.pz - p.pz);
  }, walking);
  // the W press just started; sample movement across a second interval
  const p0 = await page.evaluate(() => window.LC.state());
  await page.waitForTimeout(300);
  const p1 = await page.evaluate(() => window.LC.state());
  const walking2 = Math.hypot(p1.px - p0.px, p1.pz - p0.pz);
  check('W walks the player', walking2 > 0.2 || moved > 0.2, `moved ${walking2.toFixed(2)} m`);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForFunction(() => window.LC.state().paused === true, null, { timeout: 3000 });
  const q0 = await page.evaluate(() => window.LC.state());
  await page.waitForTimeout(500); // NO keyup was ever sent — this is the stuck-key trap
  const q1 = await page.evaluate(() => window.LC.state());
  const drifted = Math.hypot(q1.px - q0.px, q1.pz - q0.pz);
  check('blur pauses and stops the walk (no stuck key)', drifted < 0.02, `drift ${drifted.toFixed(3)} m after blur`);
  await page.locator('#pause').click(); // gate=off resumes directly
  await page.waitForFunction(() => window.LC.state().paused === false, null, { timeout: 3000 });
  const r0 = await page.evaluate(() => window.LC.state());
  await page.waitForTimeout(250);
  const r1 = await page.evaluate(() => window.LC.state());
  const restarted = Math.hypot(r1.px - r0.px, r1.pz - r0.pz);
  check('after blur the keys are genuinely released', restarted < 0.02, `player moved ${restarted.toFixed(3)} m while unpaused with no key held`);
  await page.close();
} catch (err) {
  check('blur-stuck-keys', false, String(err).split('\n')[0]);
}

// ---------------------------------------------------------------------------
// 6. reload mid-run
// ---------------------------------------------------------------------------
try {
  const page = await newPage('?gate=off&seed=6');
  await page.evaluate(() => {
    window.LC.play();
    window.LC.aimAt('bobo');
    window.LC.trigger('catch');
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.LC?.ready === true, null, { timeout: 30000 });
  const fresh = await page.evaluate(() => ({ s: window.LC.state(), st: window.LC.selfTest() }));
  check('reload mid-run lands on a clean fresh run', fresh.s.score === 0 && fresh.s.phase === 'find', `score ${fresh.s.score}, phase ${fresh.s.phase}`);
  check('selfTest still passes after reload', fresh.st.pass, fresh.st.checks.filter((c) => !c.pass).map((c) => c.name).join(', ') || `${CHECKS}/${CHECKS}`);
  await page.close();
} catch (err) {
  check('reload-mid-run', false, String(err).split('\n')[0]);
}

// ---------------------------------------------------------------------------
// 7. a 500 ms main-thread block must not teleport the game
// ---------------------------------------------------------------------------
try {
  const page = await newPage('?gate=off&seed=7');
  await page.evaluate(() => window.LC.play());
  await waitPhase(page, 'find');
  await page.waitForTimeout(400);
  await page.evaluate(() => window.LC.loopDebugReset());
  // Block the main thread, then resolve on the very next rAF callback — the
  // game loop's callback for that frame is already registered, so LC.state is
  // post-catch-up here: this measures ONE frame's worth of game time, not a
  // whole measurement window of normal frames (that would be a vacuous pass).
  const spike = await page.evaluate(() => new Promise((resolve) => {
    const stop = Date.now() + 500; // block the main thread like a GC storm
    while (Date.now() < stop) { /* spin */ }
    const tDuringBlock = window.LC.state().time;
    requestAnimationFrame(() => resolve({ tDuringBlock, tNextFrame: window.LC.state().time }));
  }));
  const jumped = spike.tNextFrame - spike.tDuringBlock;
  check(
    'the 500 ms block earns at most 0.25 s on its catch-up frame (clamped)',
    jumped >= 0 && jumped <= 0.25 + 1e-6,
    `+${jumped.toFixed(3)} s on the first frame after the block`,
  );
  await page.waitForTimeout(300); // let the loop run clean frames again
  const after = await page.evaluate(() => ({ s: window.LC.state(), d: window.LC.loopDebug() }));
  check('the clamp fired and the step cap held', after.d.clamped >= 1 && after.d.maxSteps <= after.d.stepCap, `clamped ${after.d.clamped}, max steps ${after.d.maxSteps}/${after.d.stepCap}`);
  check('the loop keeps running after the spike', after.d.frames > 5 && after.s.phase === 'find', `${after.d.frames} frames since reset`);
  await page.close();
} catch (err) {
  check('frame-time-spike', false, String(err).split('\n')[0]);
}

// ---------------------------------------------------------------------------
// 8. rate independence through the same pipeline (LC.loopTick)
// ---------------------------------------------------------------------------
try {
  const page = await newPage('?gate=off&seed=8');
  const rates = await page.evaluate(() => {
    window.LC.pause(); // the rAF loop off; loopTick is the whole story now
    const out = [];
    for (const hz of [30, 60, 120, 240]) {
      window.LC.restart();
      window.LC.loopDebugReset();
      const t0 = window.LC.state().time;
      for (let i = 0; i < hz; i++) window.LC.loopTick(1 / hz); // exactly 1 s of wall time
      const s = window.LC.state();
      const d = window.LC.loopDebug();
      out.push({ hz, dt: round(s.time - t0), steps: d.simSteps, clamped: d.clamped, maxSteps: d.maxSteps });
    }
    // an irregular 10 ms cadence: still one second of game time, ± one step
    window.LC.restart();
    window.LC.loopDebugReset();
    const t0 = window.LC.state().time;
    for (let i = 0; i < 100; i++) window.LC.loopTick(0.01);
    out.push({ hz: 100, dt: round(window.LC.state().time - t0), steps: window.LC.loopDebug().simSteps, clamped: 0, maxSteps: window.LC.loopDebug().maxSteps });
    // the spike frame: one 5 s "frame" earns at most the clamp
    window.LC.restart();
    window.LC.loopDebugReset();
    const t1 = window.LC.state().time;
    window.LC.loopTick(5);
    const d = window.LC.loopDebug();
    out.push({ hz: 0.2, dt: round(window.LC.state().time - t1), steps: d.simSteps, clamped: d.clamped, maxSteps: d.maxSteps });
    function round(x) { return Math.round(x * 1e6) / 1e6; }
    return out;
  });
  for (const r of rates.filter((x) => [30, 60, 120, 240].includes(x.hz))) {
    check(`1 s at ${r.hz} Hz = +1.000 s game time`, Math.abs(r.dt - 1) < 1e-5 && r.steps === 60, `+${r.dt.toFixed(4)} s, ${r.steps} sim steps, max ${r.maxSteps}/frame`);
  }
  const odd = rates.find((x) => x.hz === 100);
  check('1 s at an irregular 10 ms cadence = +1.000 s (±1 step)', Math.abs(odd.dt - 1) <= 1 / 60, `+${odd.dt.toFixed(4)} s`);
  const spike = rates.find((x) => x.hz === 0.2);
  check('a 5 s frame-time spike earns at most 0.25 s of game time', spike.clamped === 1 && spike.dt <= 0.25 + 1e-9, `+${spike.dt.toFixed(3)} s, clamped=${spike.clamped}`);
  await page.close();
} catch (err) {
  check('rate-independence', false, String(err).split('\n')[0]);
}

// ---------------------------------------------------------------------------
// 9. the camera follows the player (the step 7 follow regression)
// ---------------------------------------------------------------------------
try {
  const page = await newPage('?gate=off&seed=1');
  await page.evaluate(() => {
    window.LC.play();
    window.LC.setView('player-camera'); // legal: the live view is a view too now
  });
  await waitPhase(page, 'find');
  const before = await page.evaluate(() => ({ s: window.LC.state(), d: window.LC.loopDebug() }));
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' })));
  await page.waitForTimeout(450);
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' })));
  const after = await page.evaluate(() => ({ s: window.LC.state(), d: window.LC.loopDebug() }));
  const walked = Math.hypot(after.s.px - before.s.px, after.s.pz - before.s.pz);
  const camFollow = Math.hypot(after.d.camPos[0] - after.s.px, after.d.camPos[2] - after.s.pz);
  check('W moves the player', walked > 0.3, `walked ${walked.toFixed(2)} m`);
  check('the REAL camera rides with the player (follow regression)', camFollow < 0.05, `camera ${camFollow.toFixed(3)} m from the player`);
  check('the camera sits at eye height', Math.abs(after.d.camPos[1] - 1.62) < 0.05, `camera y=${after.d.camPos[1]}`);
  check('camera yaw follows the look state', Math.abs(((after.d.camYaw - after.s.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.02, `cam ${after.d.camYaw} vs player ${after.s.yaw}`);
  await page.close();
} catch (err) {
  check('camera-follow', false, String(err).split('\n')[0]);
}

// ---------------------------------------------------------------------------
// 10. the whole selfTest suite, live, from behind the gate and in the
//     player-camera view (restore used to throw on this view)
// ---------------------------------------------------------------------------
try {
  const page = await newPage('?seed=12');
  await page.locator('#gate-btn').click(); // a real trusted gesture
  await page.waitForFunction(() => window.LC.gateUnlocked() && window.LC.state().playing, null, { timeout: 5000 });
  const live = await page.evaluate(() => ({ s: window.LC.state(), pointerLocked: document.pointerLockElement !== null }));
  check('the gate click starts the real game', live.s.phase === 'find' && live.s.score === 0, `phase ${live.s.phase}${live.pointerLocked ? ', pointer locked' : ', (headless: no pointer lock)'}`);
  const st = await page.evaluate(() => {
    const r = window.LC.selfTest();
    return { pass: r.pass, n: r.checks.length, failed: r.checks.filter((c) => !c.pass).map((c) => `${c.name}=${c.value}`), view: window.LC.state().view };
  });
  check(`selfTest passes LIVE from the player-camera view (${st.n} checks)`, st.pass && st.n === CHECKS && st.view === 'player-camera', st.failed.join(', ') || `all ${st.n} green, view ${st.view}`);
  const afterTest = await page.evaluate(() => window.LC.state());
  check('the live game keeps playing after the self-test', afterTest.phase === 'find' && afterTest.score === 0, `phase ${afterTest.phase}, score ${afterTest.score}`);
  await page.close();
} catch (err) {
  check('live-selfTest', false, String(err).split('\n')[0]);
}

// ---------------------------------------------------------------------------
// 11. live tells: label hidden for players, reticle soft on the decoy,
//     a shout at nothing nudges
// ---------------------------------------------------------------------------
try {
  const p1 = await newPage('');
  const hidden = await p1.evaluate(() => getComputedStyle(document.getElementById('moment-label')).display);
  check('the moment-label chip is hidden for players', hidden === 'none', `display: ${hidden}`);
  await p1.close();
  const p2 = await newPage('?label=on');
  const shown = await p2.evaluate(() => getComputedStyle(document.getElementById('moment-label')).display);
  check('?label=on brings the chip back', shown !== 'none', `display: ${shown}`);
  await p2.close();

  const page = await newPage('?seed=2&win=5');
  await page.locator('#gate-btn').click();
  await page.waitForFunction(() => window.LC.gateUnlocked(), null, { timeout: 5000 });
  await page.evaluate(() => window.LC.aimAt('decoy'));
  await page.waitForTimeout(150);
  const softOnDecoy = await page.evaluate(() => ({
    soft: document.getElementById('reticle').classList.contains('soft'),
    probe: window.LC.aimProbe(),
  }));
  check('the reticle softens to coral while aimed at the decoy', softOnDecoy.soft && softOnDecoy.probe === 'cat-decoy', `probe ${softOnDecoy.probe}`);
  await page.evaluate(() => window.LC.aimAt('bobo'));
  await page.waitForTimeout(150);
  const onBobo = await page.evaluate(() => ({
    soft: document.getElementById('reticle').classList.contains('soft'),
    probe: window.LC.aimProbe(),
  }));
  check('the reticle is calm again on Bobo', !onBobo.soft && onBobo.probe === 'cat-bobo', `probe ${onBobo.probe}`);
  // turn to a patch of nothing, shout, and demand a reaction (never-silent input)
  const pose = await page.evaluate(async () => {
    const s = window.LC.state();
    for (let k = 0; k < 8; k++) {
      const yaw = s.yaw + (k / 8) * Math.PI * 2 + 0.1;
      window.LC.respawnHere(s.px, s.pz, yaw);
      // the camera rides the render loop's rAF frame, not the sim step — wait
      // for one real frame, else the probe reads the stale previous aim
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
      if (window.LC.aimProbe() === 'nothing') return { x: s.px, z: s.pz, yaw };
    }
    return null;
  });
  check('a clear line to nothing exists to test', pose !== null, JSON.stringify(pose));
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })));
  await page.waitForTimeout(120);
  const tell = await page.evaluate(() => ({
    nudge: document.getElementById('reticle').classList.contains('nudge'),
    score: window.LC.state().score,
    phase: window.LC.state().phase,
  }));
  check('a shout at nothing nudges the reticle (and scores nothing)', tell.nudge && tell.score === 0 && tell.phase === 'find', `nudge=${tell.nudge}, score ${tell.score}`);
  await page.waitForTimeout(700);
  const gone = await page.evaluate(() => document.getElementById('reticle').classList.contains('nudge'));
  check('the nudge is a pulse, not a mode', !gone === true && gone === false, 'class cleared');
  await page.close();
} catch (err) {
  check('live-tells', false, String(err).split('\n')[0]);
}

// ---------------------------------------------------------------------------
const clean = pageErrors.length === 0;
check('no console or page errors across every scenario', clean, pageErrors.slice(0, 4).join(' | '));

console.log(`stress playtest — ${results.filter((r) => r.startsWith('  PASS')).length} PASS / ${failures} FAIL\n${results.join('\n')}`);
await browser.close().catch(() => {});
await server.close().catch(() => {});
process.exit(failures === 0 ? 0 : 1);
