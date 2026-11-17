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
//  13  Patriot Bobo (issue #58): the off switch, the forced +3 find, and a
//      live run that matches LC.patriotPlan and replays it after restart
//  14  the run seed (issue #66): live boots play different seeds, ?seed=N
//      reproduces one, a live restart re-seeds, ?gate=off stays on 11, and the
//      seed is readable on the gear panel and the ?stamp=on line
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
// (`--page game/full.html --checks 49`). Every scenario's own scripts use
// ?win=3, so they stay short on either page.
const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : dflt;
};
const PAGE = arg('page', 'game/slice.html');
// issue #27: slice gained cats-face-the-room (45 → 46); full passes --checks 57: 51 + furniture-real-scale (issue #41), + the living room rows (#46, 53), + the bedroom row (issue #48), + the bath-balcony-walkways row (issue #49)
// issue #53: full gained spot-pool-covers-rooms + run-draw-legal (53 → 55); slice stays 46.
// issue #58: full gained the seven Patriot Bobo checks (55 → 62); slice stays 46.
// issue #59: merging the bedroom (#48, +1) and bathroom/balcony (#49, +1) rows onto the spot-pool base: 55 + 2 → 57.
// issue #62: bath/balcony + bedroom rows onto merged main (kitchen #45 + Patriot #58): 65 + 2 → 67.
// issue #65: full gained doors-read-open + wood-texture-clean + doorways-read-open (67 → 70); slice stays 46.
// issue #66: the engine's run-seed checks (seed-matches-url-env, capture-seed-stays-fixed, seed-is-a-plain-integer,
//            restart-reseeds-in-live-play, seed-shown-to-the-player) land on both pages (46 → 51); full adds
//            seed-reproduces-the-run + pool-coverage-over-random-seeds (70 → 77).
// issue #81: full gained hall-width-in-band + dining-walkways + the three dining real-scale rows and a doorway case (+4: 87 → 91).
// issue #82: full gained heat-pad-rests-on-cushion + cat-props-clear-the-plan (91 → 93); slice stays 46.
const CHECKS = Number(arg("checks", 51));

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
// 1. full wins, three seeds, auditing every round. Issue #58 made the win a
//    score event a +3 can reach early, so the scenario plays to the WIN,
//    not to a fixed catch count — on these seeds (plan-quiet 11/23/47) it
//    is still three plain finds; on a Patriot seed it would take fewer.
// ---------------------------------------------------------------------------
try {
  for (const seed of [11, 23, 47]) {
    const page = await newPage(`?gate=off&win=3&seed=${seed}`);
    await page.evaluate(() => window.LC.play());
    await waitPhase(page, 'find');
    await audit(page, `seed ${seed} round 1 (wake)`);
    let won = false;
    for (let round = 1; round <= 6 && !won; round++) {
      await waitPhase(page, 'find');
      const aim = await page.evaluate(() => {
        const a = window.LC.aimAt('bobo');
        return { hits: a.hits, probe: window.LC.aimProbe(), hide: window.LC.spot().hide };
      });
      // Issue #70 changed the rule for the six `hide` spots: the drawn cover
      // is meant to hide the cat from the EYE (a props-visible centre ray can
      // legitimately never reach him — measured: zero vantages within 3.4 m
      // centre-ray the in-tub nap through the curtain's folds), while the
      // SHOUT's find-ray — cat meshes only, props never between — must.
      // Open spots keep the strict visual rule; hidden spots prove the find
      // lands by reading the engine's own crosshair ray where aimAt parked
      // the player, which is exactly how a real find works.
      check(
        `seed ${seed} aim reaches Bobo (round ${round})`,
        aim.hide ? aim.probe === 'cat-bobo' : aim.hits === 'cat-bobo',
        aim.hide ? `${aim.hide}: find-ray through the cover reads ${aim.probe} (visual centre ray: ${aim.hits})` : `centre ray: ${aim.hits}`,
      );
      await page.evaluate(() => window.LC.trigger('catch'));
      const now = await page.evaluate(() => window.LC.state());
      won = now.phase === 'win';
      if (!won) {
        await waitPhase(page, 'catch');
        await waitPhase(page, 'find');
        await audit(page, `seed ${seed} round ${round + 1} (respawn)`);
      }
    }
    await waitPhase(page, 'win');
    const fin = await page.evaluate(() => ({
      s: window.LC.state(),
      ending: document.getElementById('ending').textContent,
    }));
    check(`seed ${seed} wins at ≥ 3`, fin.s.score >= 3 && fin.ending === 'your did it! you wind', `score ${fin.s.score}, ending "${fin.ending}"`);
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
    const aim = await page.evaluate(() => {
      const a = window.LC.aimAt('decoy');
      const hide = window.LC.spot(window.LC.state().decoyId).hide; // #70: decoys may hide too
      const probe = window.LC.aimProbe();
      window.LC.trigger('wrong'); // what aimShout does on a decoy hit
      return { hits: a.hits, probe, hide };
    });
    // Same #70 split as the Bobo rule above: hidden decoys are proven by the
    // find-ray (props never block a shout), open ones by the visual centre ray.
    check(
      `seed 5 aim reaches the decoy (DAG! ${i + 1})`,
      aim.hide ? aim.probe === 'cat-decoy' : aim.hits === 'cat-decoy',
      aim.hide ? `${aim.hide}: find-ray through the cover reads ${aim.probe} (visual centre ray: ${aim.hits})` : `centre ray: ${aim.hits}`,
    );
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
  check('win survives Space-mashing inside the cooldown', held.phase === 'win' && held.score >= 3, `phase ${held.phase}, score ${held.score}`);
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
  // Wait for the pulse to LAND rather than betting a fixed 120 ms: the nudge
  // class rides the render loop, and a swiftshader frame under CPU load can
  // outlast that fixed window — the old wait saw nudge=false with the game
  // itself fine. Poll across frames for up to 1.2 s instead (the pulse is
  // 0.6 s, so any frame that lands inside the window is proof enough).
  const tell = await page.evaluate(() => new Promise((resolve) => {
    const t0 = performance.now();
    const poll = () => {
      const s = window.LC.state();
      if (document.getElementById('reticle').classList.contains('nudge')) resolve({ nudge: true, score: s.score, phase: s.phase });
      else if (performance.now() - t0 > 1200) resolve({ nudge: false, score: s.score, phase: s.phase });
      else requestAnimationFrame(poll);
    };
    poll();
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
// 12. the spot-pool run (issue #53): ten live rounds through the REAL loop
//     must draw ten distinct spots — one per moment type — change rooms with
//     every catch, keep the decoy legal, and make the player walk. Reported
//     as the mean spawn→Bobo distance. Inert on pool-less pages (slice).
// ---------------------------------------------------------------------------
try {
  const page = await newPage('?gate=off&seed=11&win=20');
  const run = await page.evaluate(() => {
    window.LC.pause();
    window.LC.restart(); // round 1 comes off the queue here, unlike boot staging
    const rounds = [];
    for (let k = 0; k < 10; k++) {
      for (let i = 0; i < 400 && window.LC.state().phase !== 'find'; i++) window.LC.loopTick(1 / 60); // burn the 2.2 s catch stage
      const s = window.LC.state();
      const c = window.LC.catsDebug();
      rounds.push({
        spot: s.spotId, room: s.room, type: s.momentId,
        d: Math.hypot(c.px - c.bobo[0], c.pz - c.bobo[2]),
        dd: Math.hypot(c.bobo[0] - c.decoy[0], c.bobo[2] - c.decoy[2]),
      });
      window.LC.trigger('catch');
    }
    return { rounds, pool: window.LC.spots.length };
  });
  if (!run.pool) {
    check('full-run-pool (this page has no spot pool — nothing to draw)', true, 'slice');
  } else {
    const r = run.rounds;
    const distinct = new Set(r.map((x) => x.spot)).size;
    const types = new Set(r.map((x) => x.type)).size;
    const alt = r.every((x, i) => i === 0 || x.room !== r[i - 1].room);
    const decoyOk = r.every((x) => x.dd >= 1.2);
    const mean = r.reduce((a, x) => a + x.d, 0) / r.length;
    check('ten live rounds draw ten distinct spots, one per type', distinct === 10 && types === 10, `${distinct}/10 spots, ${types}/10 types — each find draws a distinct type until the run ends (a +3 win, issue #58, can end it before the cycle is spent)`);
    check('every catch changes room', alt, r.map((x) => x.room).join(' > '));
    check('live decoys stay legal all run', decoyOk, `closest bobo↔decoy ${Math.min(...r.map((x) => x.dd)).toFixed(2)} m`);
    check('spawn→Bobo mean walk is a walk, never a wake-up on the cat', mean >= 1.5 && r.every((x) => x.d >= 1.2), `mean ${mean.toFixed(2)} m, min ${Math.min(...r.map((x) => x.d)).toFixed(2)} m`);
  }
  await page.close();
} catch (err) {
  check('full-run-pool', false, String(err).split('\n')[0]);
}

// ---------------------------------------------------------------------------
// 13. Patriot Bobo (issue #58), driven through the same loopTick pipeline as
//     scenario 12: ?patriot=off never spawns him and refuses the force;
//     LC.patriot(true) dresses exactly the NEXT legal find (score 1 then 4,
//     never first, never back-to-back); and a plain seeded run matches
//     LC.patriotPlan(23) find-for-find and replays the identical plan after
//     LC.restart() — the dice ride the seed, not the clock. Inert on slice.
// ---------------------------------------------------------------------------
try {
  const off = await newPage('?gate=off&seed=11&win=20&patriot=off');
  const has = await off.evaluate(() => !!window.LC.patriot && window.LC.spots.length > 0); // Patriot rides the spot pool (issue #58) — inert on the slice
  if (!has) {
    check('patriot-bobo (this page has no spot pool — nothing to draw)', true, 'slice');
    await off.close();
  } else {
    const DRIVE = () => {
      window.LC.pause();
      window.LC.restart();
      const rounds = [];
      for (let k = 0; k < 8; k++) {
        for (let i = 0; i < 400 && window.LC.state().phase !== 'find'; i++) window.LC.loopTick(1 / 60);
        const s = window.LC.state();
        rounds.push({ p: !!s.patriot, costume: window.LC.patriot().costumeAttached, find: s.findNum });
        window.LC.trigger('catch');
      }
      return { rounds, score: window.LC.state().score };
    }; // zero-arg: this playwright-core returns undefined for evaluate(fn, arg)
    const offState = await off.evaluate(() => ({
      planAll: window.LC.patriotPlan(11, 10).some(Boolean),
      refused: window.LC.patriot(true), // the ask itself must be refused on an off page
    }));
    const offRun = await off.evaluate(DRIVE);
    check(
      '?patriot=off: no Patriot ever, and the force ask is refused',
      !offState.planAll && offState.refused === false && offRun.rounds.every((r) => !r.p && r.costume === false),
      `8 rounds, ${offRun.rounds.filter((r) => r.p).length} patriots, costume always off`,
    );
    await off.close();

    const forced = await newPage('?gate=off&seed=11&win=20');
    const asked = await forced.evaluate(() => {
      window.LC.pause();
      window.LC.restart();
      const toFind = () => { for (let i = 0; i < 400 && window.LC.state().phase !== 'find'; i++) window.LC.loopTick(1 / 60); return window.LC.state(); };
      toFind();
      const f1 = { p: window.LC.state().patriot, costume: window.LC.patriot().costumeAttached };
      window.LC.trigger('catch'); // find 1: plain (+1) — he is never FIRST
      window.LC.patriot(true); // ask for the next legal find
      const f2 = toFind();
      const on = { p: f2.patriot, costume: window.LC.patriot().costumeAttached, find: f2.findNum };
      window.LC.trigger('catch'); // +3: score lands at 4
      const score = window.LC.state().score;
      const f3 = toFind();
      return { f1, on, score, f3p: f3.patriot, count: window.LC.patriot().count };
    });
    check(
      'LC.patriot(true): next legal find only — never first, +3, costume on, never consecutive',
      !asked.f1.p && !asked.f1.costume && asked.on.p && asked.on.costume && asked.on.find === 2 && asked.score === 4 && !asked.f3p && asked.count === 1,
      `find1 plain, find ${asked.on.find} costumed (+3), score ${asked.score}, find 3 plain, count ${asked.count}`,
    );
    await forced.close();

    const det = await newPage('?gate=off&seed=23&win=20');
    const plan = await det.evaluate(() => window.LC.patriotPlan(23, 8));
    const runA = await det.evaluate(DRIVE);
    const runB = await det.evaluate(DRIVE); // same page, same seed: a restart replays the plan
    const bits = (r) => r.rounds.map((x) => (x.p ? 1 : 0)).join('');
    check(
      'the live run matches LC.patriotPlan and restart replays it (seed 23)',
      bits(runA) === plan.map((x) => (x ? 1 : 0)).join('') && bits(runA) === bits(runB),
      `plan ${plan.map((x) => (x ? 1 : 0)).join('')} run A ${bits(runA)} run B ${bits(runB)} (1 = Patriot)`,
    );
    await det.close();
  }
} catch (err) {
  check('patriot-bobo-run', false, String(err).split('\n')[0]);
}

// ---------------------------------------------------------------------------
// 14. Issue #66: live play is RANDOM, the tools are not. Two live boots (the
//     gate up, no ?seed) must play two different runs; ?seed=N must hand back
//     the same run twice; a live restart must re-seed; ?gate=off must stay on
//     the fixed seed 11; and the seed must be readable on the page. The rule
//     itself lives in src/run-seed.js and is checked inside the page by the
//     engine's selfTest — this is the boots-and-restarts half of it.
// ---------------------------------------------------------------------------
try {
  const READ = `(() => {
    const s = window.LC.seed();
    const panel = document.getElementById('settings-build');
    const corner = document.getElementById('build-corner');
    return {
      seed: s, info: window.LC.seedInfo(),
      cycle: window.LC.spotCycle(s).join(','),
      plan: window.LC.patriotPlan(s, 10).map((x) => (x ? 1 : 0)).join(''),
      hasPanel: Boolean(panel), panelText: panel?.textContent ?? '',
      hasCorner: Boolean(corner), cornerText: corner?.textContent ?? '',
    };
  })()`;
  const read = (page) => page.evaluate(READ);
  const wantSeed = (r) => `seed ${r.seed}`;

  const tool = await newPage('?gate=off');
  const t = await read(tool);
  check('#66 ?gate=off boots on the fixed seed 11', t.info.gateOff === true && t.seed === 11 && t.info.live === false, `seed ${t.seed}, live=${t.info.live}`);
  await tool.close();

  const liveA = await newPage('');
  const a = await read(liveA);
  const liveB = await newPage('');
  const b = await read(liveB);
  check(
    '#66 a live boot (gate up, no ?seed) plays a random seed',
    a.info.live === true && a.info.pinned === null && a.seed !== 11 && b.seed !== 11 && Number.isInteger(a.seed),
    `boot A plays ${a.seed}, boot B plays ${b.seed}`,
  );
  check(
    '#66 two live boots play different runs',
    a.seed !== b.seed && (a.cycle === '' || a.cycle !== b.cycle),
    `A ${a.seed} [${a.plan}] vs B ${b.seed} [${b.plan}]`,
  );

  const reseeded = await liveA.evaluate(() => {
    const before = window.LC.seed();
    window.LC.restart(); // play again / the pause card / the win all end here
    return { before, after: window.LC.seed(), cycle: window.LC.spotCycle(window.LC.seed()).join(',') };
  });
  check('#66 play again / restart re-seeds a live run', reseeded.after !== reseeded.before, `seed ${reseeded.before} → ${reseeded.after}`);
  await liveA.close();
  await liveB.close();

  const pinA = await newPage('?seed=4242');
  const r1 = await read(pinA);
  await pinA.close();
  const pinB = await newPage('?seed=4242');
  const r2 = await read(pinB);
  check(
    '#66 ?seed=N hands back the same run on every boot',
    r1.seed === 4242 && r2.seed === 4242 && r1.cycle === r2.cycle && r1.plan === r2.plan && r1.info.live === false,
    `cycle A ${r1.cycle.slice(0, 34) || '(no pool)'}… / plan ${r1.plan} vs ${r2.plan}`,
  );
  await pinB.close();

  const stamped = await newPage('?seed=4242&stamp=on');
  const s = await read(stamped);
  check(
    '#66 the seed is readable on the gear panel and the ?stamp=on line',
    (s.hasPanel || s.hasCorner)
      && (!s.hasPanel || s.panelText.includes(wantSeed(s)))
      && (!s.hasCorner || s.cornerText.includes(wantSeed(s))),
    `panel: ${s.panelText || '(no panel)'} | corner: ${s.cornerText || '(none)'}`,
  );
  await stamped.close();

  const capturePage = await newPage('?gate=off&stamp=on');
  const c = await read(capturePage);
  check('#66 capture mode still keeps every stamp out of the frame', c.hasCorner === false && c.panelText === '', `corner=${c.hasCorner} panel="${c.panelText}"`);
  await capturePage.close();
} catch (err) {
  check('#66 live-seed scenario ran', false, String(err).split('\n')[0]);
}

// ---------------------------------------------------------------------------
const clean = pageErrors.length === 0;
check('no console or page errors across every scenario', clean, pageErrors.slice(0, 4).join(' | '));

console.log(`stress playtest — ${results.filter((r) => r.startsWith('  PASS')).length} PASS / ${failures} FAIL\n${results.join('\n')}`);
await browser.close().catch(() => {});
await server.close().catch(() => {});
process.exit(failures === 0 ? 0 : 1);
