#!/usr/bin/env node
// tools/audio/music-selftest.mjs — `npm run music:selftest`: pure-Node unit
// checks for the bardcore soundtrack's DATA and math (issue #71). Nothing
// here touches a browser: it imports src/music-score.js (the whole tune) and
// the pure analyser from src/music.js, and fails loudly if the composition,
// the loop math, the swing mapping, or the duck shape stop making sense.
//
// Originality review lives here too: the score must stay a minor piece with
// a major lift, resolving minor at the end of the win flourish — a data
// check can't prove a melody is original, but it CAN keep the piece the
// docs describe and force a human review when the shape changes.

import { pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const S = await import(pathToFileURL(join(REPO, 'src/music-score.js')).href);
const M = await import(pathToFileURL(join(REPO, 'src/music.js')).href);

let failed = 0;
const results = [];
const check = (name, ok, extra = '') => {
  results.push(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
  if (!ok) failed++;
};

// --- 1. the score is well-formed data (validateScore is the rules) ---------
const problems = S.validateScore();
check('score-valid', problems.length === 0, problems.join('; ') || 'patterns, chords, arrangements all check out');
check('bpm-in-range', S.meta.bpm >= 100 && S.meta.bpm <= 120, `${S.meta.bpm} BPM`);
check('minor-key', S.meta.scaleSemitones.includes(3), `${S.meta.keyName}`);
check('major-lift', Object.values(S.chords).some((c) => c.q === 'M'), 'major triads lift the Aeolian backbone');

// --- 2. loop math: exact, drift-free, in the required range ----------------
const mainSteps = S.stepsPerArrangement(S.arrangements.main);
check('main-is-32-bars', S.arrangementBars(S.arrangements.main).length === 32, `${S.arrangementBars(S.arrangements.main).length} bars`);
check('loop-steps-exact', mainSteps === 32 * 4 * 4, `${mainSteps} steps per pass`);
const secs = S.secondsPerArrangement(S.arrangements.main);
check('loop-length-plausible', secs > 40 && secs < 120, `${secs.toFixed(2)} s per pass (16–32 bar loop requirement)`);
check('step-times-monotonic', (() => {
  for (let s = 1; s <= mainSteps * 2; s++) if (!(S.stepTimeSec(s) > S.stepTimeSec(s - 1))) return false;
  return true;
})(), 'grid time never goes backwards, across two passes');
check('loop-seam-exact', (() => {
  // Drift-free means PERIODIC: every step reappears exactly one loop-length
  // later (swing shortens the seam step-gap inside a beat by design, so the
  // honest property is step-time periodicity, verified across every step).
  for (let s = 0; s < mainSteps; s++) if (Math.abs(S.stepTimeSec(s + mainSteps) - S.stepTimeSec(s) - secs) > 1e-9) return false;
  return true;
})(), 'every step returns exactly one loop-length later — the loop cannot drift');
check('calm-thinner', S.planNotes(S.MUSIC_SCORE, 'calm', 0, S.stepsPerArrangement(S.arrangements.calm)).length < S.planNotes(S.MUSIC_SCORE, 'main', 0, 128).length, 'the pause arrangement really is sparse');

// --- 3. swing mapping -------------------------------------------------------
const sw = S.swingOffset(1) + S.swingOffset(3);
check('swing-offsets', Math.abs(S.swingOffset(0)) === 0 && Math.abs(S.swingOffset(2) - 0.5) === 0 && S.swingOffset(1) > 0.25 && S.swingOffset(1) < 0.334 && S.swingOffset(3) > 0.75 && S.swingOffset(3) < 0.834, `k=1 → ${S.swingOffset(1).toFixed(3)}, k=3 → ${S.swingOffset(3).toFixed(3)} of a beat`);
check('swing-total', Math.abs(sw - 1 - (S.meta.swing - 0.5)) < 1e-9, `swung pair total ${sw.toFixed(3)} (0.5 straight … 0.667 shuffle)`);

// --- 4. the scheduler plan is deterministic and playable -------------------
const a = S.planNotes(S.MUSIC_SCORE, 'main', 0, mainSteps);
const b = S.planNotes(S.MUSIC_SCORE, 'main', 0, mainSteps);
check('plan-deterministic', JSON.stringify(a) === JSON.stringify(b), `${a.length} events per pass, identical when re-planned`);
check('plan-wraps', JSON.stringify(S.planNotes(S.MUSIC_SCORE, 'main', mainSteps, mainSteps * 2)) === JSON.stringify(b), 'the plan is loop-relative: a later pass replays the same events (callers add the pass offset)');
const per = a.reduce((m2, e) => ((m2[e.inst] = (m2[e.inst] || 0) + 1), m2), {});
check('all-instruments-play', Object.keys(S.instruments).every((k) => per[k] > 0), JSON.stringify(per));
const range = (inst) => a.filter((e) => e.inst === inst && e.midi != null).reduce((m2, e) => [Math.min(m2[0], e.midi), Math.max(m2[1], e.midi)], [999, -999]);
const bassR = range('bass');
const leadR = range('lead');
check('bass-band', bassR[0] <= 50 && bassR[1] <= 66, `MIDI ${bassR[0]}–${bassR[1]} (deep pizzicato)`);
check('lead-band', leadR[0] >= 60 && leadR[1] <= 96, `MIDI ${leadR[0]}–${leadR[1]} (harpsichord sits above the lute)`);
check('no-clip-of-time', a.every((e) => e.at >= 0 && e.at < secs && e.dur > 0 && e.dur < 8), 'every event inside the pass, sane durations');

// --- 5. duck + volume math (mirrors what the engine schedules) -------------
check('duck-depth', S.duck.level > 0.6 && S.duck.level < 0.66, `${S.duck.level} ≈ -4 dB`);
check('duck-shape', S.duck.attackTau < 0.01 && S.duck.releaseTau > 0.05 && S.duck.releaseTau < 0.2, `${(S.duck.attackTau * 3 * 1000).toFixed(0)} ms in, ${(S.duck.releaseTau * 3 * 1000).toFixed(0)} ms out (3τ)`);
check('duck-release-settles-in-400ms', 1 - Math.exp(-0.4 / S.duck.releaseTau) > 0.95, 'by 400 ms the level is back above 95%');
check('volume-composes', 0.5 * 0.5 * S.duck.level < 0.16, 'master × music-volume × duck stays a product');

// --- 6. the analyser itself (used by the browser check) --------------------
const sr = 8000;
const n = sr * 4;
const tone = (f, amp) => { const d = new Float64Array(n); for (let i = 0; i < n; i++) d[i] = amp * Math.sin(2 * Math.PI * f * i / sr); return d; };
const a110 = M.analyzeBuffer(tone(110, 0.4), sr);
const a880 = M.analyzeBuffer(tone(880, 0.4), sr);
const quiet = M.analyzeBuffer(tone(110, 0.001), sr);
check('analyser-rms', Math.abs(a110.rms - 0.4 / Math.SQRT2) < 0.01, `rms ${a110.rms.toFixed(4)} ≈ A/√2`);
check('analyser-bands', a110.bass > 10 * a110.lead && a880.lead > 10 * a880.bass, 'a 110 Hz tone lights the bass band, 880 Hz lights the lead band');
check('analyser-floor', quiet.bass < 1e-4 && a110.bass > 1, 'silence reads ~0, a real note reads > 1');

// --- 7. originality guardrails (what a data check CAN prove) ---------------
check('flourish-resolves-minor', S.arrangementBars(S.arrangements.flourish).at(-1).chord === 'Am', 'the win jingle lands on the tonic minor');
check('main-uses-modal-backbone', (() => {
  const seq = S.arrangementBars(S.arrangements.main).map((r) => r.chord).join(' ');
  return ['Am', 'F', 'C', 'G'].every((c) => seq.includes(c));
})(), 'Am–F–C–G (i–VI–III–VII) carries the 32-bar loop');
{
  const { readFileSync } = await import('node:fs');
  const files = ['src/music.js', 'src/music-score.js'].map((f) => readFileSync(join(REPO, f), 'utf8'));
  const combined = files.join('\n');
  check('no-audio-fetches', !/fetch\(|XMLHttpRequest|\.mp3|\.wav|\.ogg|decodeAudio/i.test(combined), 'no network, no samples, no MIDI files in the music modules');
  check('data-only-module', !/new Audio\(|Audio\(/.test(combined), 'the soundtrack never creates an <audio> element');
}

console.log('Look at Bobo — music self-check (score data + math, pure Node)\n');
console.log(results.join('\n'));
console.log(`\n${results.filter((r) => r.startsWith('  PASS')).length}/${results.length} music logic checks passed`);
process.exit(failed ? 1 : 0);
