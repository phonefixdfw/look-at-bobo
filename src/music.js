// src/music.js — the splash-screen music ENGINE (issue #71): a tiny MIDI-style
// sequencer that synthesizes the tune in src/music-score.js live with the Web
// Audio API. No samples, no downloads, no new assets: just oscillators.
//
// Design rules (why it's shaped like this):
//   * NOTHING is created until start() runs inside a user gesture. No
//     AudioContext, no nodes. A suspended/never-created context can't glitch.
//   * Lookahead scheduler: a 25 ms timer schedules at most ~120 ms ahead and
//     CLAMPS — after a stall (throttled tab, iOS suspend) it skips missed
//     steps instead of burst-scheduling them, so notes never pile up.
//   * Loop position is an absolute integer step, wrapped at the loop length:
//     mathematically drift-free, and pause simply freezes that counter.
//   * Ducking: the voice engine (src/audio.js) dispatches 'lc-voice'
//     document events when a line starts/ends; we dip a dedicated duck gain
//     -4 dB fast (~12 ms) and release gently (~400 ms). Separate stage, so
//     it composes with volume/mute by multiplication.
//   * No reverb at any quality (CPU). ?quality=low drops drum/ornament/pipe.
//   * renderOffline() runs the SAME planNotes + synth code through an
//     OfflineAudioContext, so the headless check hears what players hear.
//
// createMusicEngine({ score }) returns a plain object — this module has zero
// side effects at import time, so pages that never call it stay silent.

import { planNotes, stepsPerArrangement, secondsPerArrangement, stepTimeSec } from './music-score.js';

/** Live oscillator cap: a handful of voices, phones stay cool. */
const MAX_VOICES = 24; // oscillators + buffer sources currently alive
const LOOKAHEAD = 0.12; // seconds of music scheduled ahead of the clock
const TICK_MS = 25; // scheduler timer period
const MAX_STEPS_PER_TICK = 16; // never catch-up-burst more than one bar

/** A tiny dry band analyser for the render check: Goertzel power summed over
 *  a log-spaced comb of frequencies in [loHz, hiHz]. Pure, Node-safe. */
export function bandEnergy(samples, sampleRate, loHz, hiHz, bins = 24) {
  let sum = 0;
  const total = samples.length;
  for (let b = 0; b < bins; b++) {
    const f = loHz * Math.pow(hiHz / loHz, b / Math.max(1, bins - 1));
    const w = (2 * Math.PI * f) / sampleRate;
    const coeff = 2 * Math.cos(w);
    let s0 = 0;
    let s1 = 0;
    let s2 = 0;
    for (let i = 0; i < total; i++) {
      s0 = samples[i] + coeff * s1 - s2;
      s2 = s1;
      s1 = s0;
    }
    sum += (s1 * s1 + s2 * s2 - coeff * s1 * s2) / (total * total);
  }
  return sum / bins;
}

/** RMS + peak + the two bands the score must show up in, for one channel. */
export function analyzeBuffer(samples, sampleRate) {
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i];
    sum += v * v;
    const a = Math.abs(v);
    if (a > peak) peak = a;
  }
  return {
    rms: Math.sqrt(sum / samples.length),
    peak,
    bass: bandEnergy(samples, sampleRate, 70, 220),
    lead: bandEnergy(samples, sampleRate, 500, 2000),
  };
}

export function createMusicEngine({ score, lowQuality = false, volume = 1, muted = false, isPaused = () => false } = {}) {
  let ctx = null; // created ONLY in start(), inside a user gesture
  let master = null; // volume × mute (set at start, live-updatable)
  let duckGain = null; // the -4 dB dip under voice lines
  let sceneGain = null; // scene fades: fade-in, pause dip, scene levels
  let instBus = {}; // per-instrument gain nodes (score gains)
  let timer = null;
  let noiseBuf = null; // one shared noise buffer for tambourine ticks
  let liveVoices = 0;
  let vibrato = null; // one shared pipe vibrato LFO
  const liveNodes = new Set(); // every started source, for a clean stop()
  let rendering = false; // true while renderOffline owns the graph
  let lastLevel = 0; // last scene level we aimed sceneGain at

  let scene = 'none';
  let arrangement = 'main'; // what the scheduler is playing RIGHT NOW
  let baseArrangement = 'main'; // what the scene asks for (pause overrides it)
  let step = 0; // absolute grid step since this arrangement started
  let frozen = false; // tab hidden: clock frozen, output faded
  let running = false;
  let finishedOnce = false; // non-looping arrangements (flourish) hand over once
  let ducked = false;
  const sceneLevels = { play: 1, calm: 0.7, pause: 0.62, title: 0.5, win: 1, none: 0 };
  const SCENE_ARR = { play: 'main', calm: 'calm', pause: 'calm', title: 'calm', win: 'flourish' };

  const masterTarget = () => (muted || volume <= 0 ? 0 : volume);
  const sceneLevel = () => sceneLevels[isPaused() && scene !== 'title' && scene !== 'none' ? 'pause' : scene] ?? 1;

  // ---------------------------------------------------------------- lifecycle
  function buildGraph() {
    master = ctx.createGain();
    master.gain.value = masterTarget();
    master.connect(ctx.destination);
    duckGain = ctx.createGain();
    duckGain.gain.value = 1;
    duckGain.connect(master);
    sceneGain = ctx.createGain();
    sceneGain.gain.value = 0; // the fade-in starts from silence
    sceneGain.connect(duckGain);
    instBus = {};
    for (const [name, inst] of Object.entries(score.instruments)) {
      const g = ctx.createGain();
      g.gain.value = lowQuality && ['drum', 'ornament', 'pipe'].includes(name) ? 0 : inst.gain;
      g.connect(sceneGain);
      instBus[name] = g;
    }
    // one shared noise buffer + vibrato LFO: created once, never per note
    noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.25), ctx.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    vibrato = ctx.createOscillator();
    vibrato.frequency.value = score.instruments.pipe.vibrato.rate;
    const vg = ctx.createGain();
    vg.gain.value = score.instruments.pipe.vibrato.cents;
    vibrato.connect(vg);
    vibrato._depth = vg;
    vibrato.start();
  }

  /** Start inside a user gesture. Idempotent: repeat START taps never stack
   *  a second scheduler or a second context. `gesture` must be true only
   *  from a real user gesture path (the engine calls it from unlockGate). */
  function start(gesture = true) {
    if (running) return;
    if (!gesture) return; // never build a context without a gesture
    running = true;
    if (!ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      ctx = new Ctor();
      buildGraph();
    }
    ctx.resume?.()?.catch?.(() => {});
    setScene(scene === 'none' ? 'play' : scene, { force: true });
    timer = setInterval(tick, TICK_MS);
    tick();
  }

  /** Full teardown (solo-safe tests): timers gone, oscillators stopped,
   *  context closed. A later start() builds a fresh, clean graph. */
  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    running = false;
    for (const n of liveNodes) {
      try { n.stop(); } catch { /* already finished */ }
    }
    liveNodes.clear();
    if (ctx) {
      try { vibrato?.stop?.(); } catch { /* already stopped */ }
      ctx.close?.()?.catch?.(() => {});
    }
    ctx = null;
    master = duckGain = sceneGain = vibrato = null;
    instBus = {};
    liveVoices = 0;
    scene = 'none';
    finishedOnce = false;
    ducked = false;
  }

  // ---------------------------------------------------------------- scenes
  /** play → the 32-bar loop; pause → the thin calm arrangement (still playing,
   *  quieter — the pause menu deserves company); title → calm, lowest; win →
   *  the once-only flourish (the scheduler hands over to calm at its end).
   *  A swap dips ~120 ms then fades in from silence: arrangements can never
   *  overlap or stack. */
  function swapArrangement(target) {
    if (!ctx || !running) return;
    const now = ctx.currentTime;
    sceneGain.gain.cancelScheduledValues(now);
    sceneGain.gain.setTargetAtTime(0, now, 0.04); // dip out any residual notes
    arrangement = target;
    step = 0;
    finishedOnce = false;
    clockAnchor = now + 0.12; // fresh, exact origin for the new arrangement
    anchorStep = 0;
    const fadeIn = score.arrangements[target].fadeIn ?? 0.5;
    sceneGain.gain.setTargetAtTime(sceneLevel(), now + 0.16, Math.max(0.05, fadeIn / 3));
  }

  function setScene(name, opts = {}) {
    scene = name;
    baseArrangement = SCENE_ARR[name] ?? 'main';
    if (!ctx || !running) return;
    const target = isPaused() && baseArrangement === 'main' ? 'calm' : baseArrangement;
    if (target === arrangement && !opts.force) {
      const now = ctx.currentTime;
      sceneGain.gain.cancelScheduledValues(now);
      sceneGain.gain.setTargetAtTime(sceneLevel(), now, 0.05); // just re-level
      return;
    }
    swapArrangement(target);
  }

  // ---------------------------------------------------------------- ducking
  function duck(on) {
    if (!ctx || !duckGain || ducked === on) return;
    ducked = on;
    const now = ctx.currentTime;
    const d = score.duck;
    duckGain.gain.cancelScheduledValues(now);
    duckGain.gain.setTargetAtTime(on ? d.level : 1, now, on ? d.attackTau : d.releaseTau);
  }
  const onVoice = (ev) => duck(ev.detail?.event === 'start');
  if (typeof document !== 'undefined') {
    document.addEventListener('lc-voice', onVoice);
    // Fade/pause immediately when the tab hides (timers get throttled there,
    // so this event, not the tick, is what freezes the clock on time).
    document.addEventListener('visibilitychange', () => setFrozen(document.hidden));
  }

  // ---------------------------------------------------------------- synth
  function voiceGuard(node) {
    liveVoices++;
    liveNodes.add(node);
    node.onended = () => {
      liveVoices--;
      liveNodes.delete(node);
    };
  }

  function synthNote(instName, ev, when) {
    const inst = score.instruments[instName];
    if (ev.drum) {
      if (ev.drum === 'membrane') {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(inst.membrane.startFreq, when);
        o.frequency.exponentialRampToValueAtTime(inst.membrane.endFreq, when + inst.membrane.decay);
        g.gain.setValueAtTime(inst.membrane.gain, when);
        g.gain.exponentialRampToValueAtTime(0.0001, when + inst.membrane.decay + 0.05);
        o.connect(g).connect(instBus[instName]);
        o.start(when);
        o.stop(when + inst.membrane.decay + 0.06);
        voiceGuard(o);
      } else {
        const s = ctx.createBufferSource();
        const hp = ctx.createBiquadFilter();
        const g = ctx.createGain();
        s.buffer = noiseBuf;
        hp.type = 'highpass';
        hp.frequency.value = inst.tick.highpass;
        g.gain.setValueAtTime(inst.tick.gain, when);
        g.gain.exponentialRampToValueAtTime(0.0001, when + inst.tick.decay + 0.02);
        s.connect(hp).connect(g).connect(instBus[instName]);
        s.start(when);
        s.stop(when + inst.tick.decay + 0.03);
        voiceGuard(s);
      }
      return;
    }
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = inst.filter.q ?? 0.8;
    lp.frequency.setValueAtTime(inst.filter.freq, when);
    if (inst.filter.envFall) lp.frequency.exponentialRampToValueAtTime(Math.max(120, inst.filter.freq - inst.filter.envFall), when + inst.env.decay);
    lp.connect(g).connect(instBus[instName]);
    // ONE envelope per note (scheduled before the parts, never per part):
    // a fast attack, a short hold, an exponential tail. Works the same for
    // plucks (short gate) and the pipe's long tied notes.
    const env = inst.env;
    const noteDur = Math.max(0.04, ev.dur);
    const holdEnd = when + env.attack + noteDur * 0.7;
    const end = holdEnd + env.decay + (env.release ?? 0) + 0.08;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(1, when + Math.max(0.001, env.attack));
    g.gain.setValueAtTime(1, holdEnd);
    g.gain.setTargetAtTime(0.0001, holdEnd, Math.max(0.01, env.decay / 3));
    for (const part of inst.parts) {
      const o = ctx.createOscillator();
      o.type = part.type;
      o.frequency.setValueAtTime(midiHz(ev.midi + (part.octaveUp ? 12 : 0)), when);
      if (part.detune) o.detune.setValueAtTime(part.detune, when);
      const pg = ctx.createGain();
      pg.gain.value = part.gain;
      o.connect(pg).connect(lp);
      if (inst.vibrato && vibrato) vibrato._depth.connect(o.detune);
      o.start(when);
      o.stop(end);
      voiceGuard(o);
    }
  }

  function midiHz(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  // ---------------------------------------------------------------- scheduler
  function loopSteps() {
    return stepsPerArrangement(score.arrangements[arrangement]);
  }

  /** The loop origin in ctx time: an absolute anchor set at start / resume /
   *  scene swap. Step → time is pure math against one real clock, so the
   *  loop CANNOT drift and a swap can never double-schedule a step. */
  let clockAnchor = 0;
  let anchorStep = 0;
  function stepTimeAbs(s) {
    return clockAnchor + stepTimeSec(s - anchorStep, score.meta);
  }
  function reAnchor() {
    clockAnchor = ctx.currentTime + 0.1;
    anchorStep = step;
  }

  /** Freeze on hide / resume on show. Driven by the visibilitychange event
   *  (fires even when timers are throttled), and mirrored by tick. Hiding
   *  fades out and HOLDS the step counter; showing re-anchors against the
   *  clock so the loop resumes exactly where it left off — mid-pattern. */
  function setFrozen(hidden) {
    if (!ctx || !running || rendering) return;
    if (hidden === frozen) return;
    frozen = hidden;
    const now = ctx.currentTime;
    sceneGain.gain.cancelScheduledValues(now);
    if (frozen) {
      sceneGain.gain.setTargetAtTime(0, now, 0.04); // 120 ms dip to silence
    } else {
      reAnchor(); // continue mid-loop from a fresh, real clock
      lastLevel = sceneLevel();
      sceneGain.gain.setTargetAtTime(lastLevel, now, 0.06);
    }
  }

  function tick() {
    if (!ctx || !running) return;
    if (rendering) return; // an offline render owns the graph right now
    if (ctx.state === 'suspended') return; // iOS: wait, never burst-schedule
    const now = ctx.currentTime;
    // Tab hidden (rAF-free background): freeze the clock. setFrozen is also
    // wired to visibilitychange so it happens even under timer throttling.
    setFrozen(typeof document !== 'undefined' && document.hidden);
    if (frozen) return; // step counter frozen: resume continues mid-pattern
    // Pause menu: play the calm arrangement instead of the full one, at the
    // quieter pause level. Un-pausing swaps back the same clean way.
    const eff = isPaused() && baseArrangement !== 'calm' ? 'calm' : baseArrangement;
    if (eff !== arrangement) {
      swapArrangement(eff);
      return;
    }
    const wantLevel = sceneLevel();
    if (Math.abs(wantLevel - lastLevel) > 0.001) {
      lastLevel = wantLevel;
      sceneGain.gain.cancelScheduledValues(now);
      sceneGain.gain.setTargetAtTime(wantLevel, now, 0.06);
    }
    // Stall clamp: after a throttled tab or a suspended context, SKIP the
    // missed steps (pure int math) instead of scheduling a burst of stale
    // notes — this is the pause/iOS overlap bug, fixed at the design level.
    while (stepTimeAbs(step) < now - 0.05) step++;
    let budget = MAX_STEPS_PER_TICK;
    while (budget-- > 0 && stepTimeAbs(step) < now + LOOKAHEAD) {
      scheduleStep(step, now);
      step++;
      if (!score.arrangements[arrangement].loop && step >= loopSteps()) {
        // flourish finished: hand over to the calm loop, exactly once
        if (!finishedOnce) {
          finishedOnce = true;
          arrangement = 'calm';
          step = 0;
          reAnchor();
        }
        break;
      }
    }
  }

  function scheduleStep(s, now) {
    const loop = loopSteps();
    const inLoop = ((s % loop) + loop) % loop;
    if (liveVoices >= MAX_VOICES) return; // phone CPU: a dropped note, never a pile-up
    const events = planNotes(score, arrangement, inLoop, inLoop + 1);
    const when = Math.max(stepTimeAbs(s), now + 0.0001);
    for (const ev of events) synthNote(ev.inst, ev, when);
  }

  // ---------------------------------------------------------------- offline
  /** Render `seconds` of an arrangement through the REAL synth code with an
   *  OfflineAudioContext. The check calls this, so it tests the shipped
   *  synth paths, not a copy. Returns { stats } for channel 0. */
  async function renderOffline(seconds = 20, name = 'main', sampleRate = 44100) {
    const OCtor = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const octx = new OCtor(1, Math.floor(seconds * sampleRate), sampleRate);
    const savedCtx = ctx;
    const savedBus = instBus;
    const savedNoise = noiseBuf;
    const savedVib = vibrato;
    const savedVoices = liveVoices;
    rendering = true; // the live scheduler stands down while we swap the graph
    try {
      ctx = octx;
      liveVoices = 0;
      instBus = {};
      for (const [name2, inst] of Object.entries(score.instruments)) {
        const g = octx.createGain();
        g.gain.value = inst.gain; // full mix for analysis (master = 1)
        g.connect(octx.destination);
        instBus[name2] = g;
      }
      noiseBuf = octx.createBuffer(1, Math.floor(sampleRate * 0.25), sampleRate);
      const ch = noiseBuf.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
      vibrato = octx.createOscillator();
      vibrato.frequency.value = score.instruments.pipe.vibrato.rate;
      const vg = octx.createGain();
      vg.gain.value = score.instruments.pipe.vibrato.cents;
      vibrato.connect(vg);
      vibrato._depth = vg;
      vibrato.start();
      const loop = stepsPerArrangement(score.arrangements[name]);
      const totalSecs = secondsPerArrangement(score.arrangements[name]);
      const passes = Math.ceil(seconds / totalSecs);
      const allEvents = [];
      for (let p = 0; p < passes; p++) {
        const evs = planNotes(score, name, 0, loop);
        for (const e of evs) allEvents.push({ ...e, at: e.at + p * totalSecs });
      }
      const events = allEvents.filter((e) => e.at < seconds - 0.6);
      for (const ev of events) synthNote(ev.inst, ev, ev.at + 0.02);
      const rendered = await octx.startRendering();
      return analyzeBuffer(rendered.getChannelData(0), sampleRate);
    } finally {
      ctx = savedCtx;
      instBus = savedBus;
      noiseBuf = savedNoise;
      vibrato = savedVib;
      liveVoices = savedVoices;
      rendering = false;
    }
  }

  // ---------------------------------------------------------------- debug
  function debug() {
    return {
      present: true,
      ctxCreated: !!ctx,
      ctxState: ctx ? ctx.state : 'none',
      running,
      scene,
      arrangement,
      step,
      loopSteps: loopSteps(),
      frozen,
      duckLevel: duckGain ? Number(duckGain.gain.value.toFixed(4)) : 1,
      sceneLevel: sceneGain ? Number(sceneGain.gain.value.toFixed(3)) : 0,
      master: master ? Number(master.gain.value.toFixed(3)) : 0,
      liveVoices,
      lowQuality,
      bpm: score.meta.bpm,
      pausedSeen: !!isPaused(),
    };
  }

  return { start, stop, setScene, duck, renderOffline, debug, isRunning: () => running, hasContext: () => !!ctx };
}
