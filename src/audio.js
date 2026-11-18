// src/audio.js — the voice lines: which take ships, when it plays, and a
// plain-browser playback engine (HTMLAudioElement; no bundler, no WebAudio,
// no network beyond the static mp3 files).
//
// The picks below are the "Shipped take" table in docs/VOICES.md (V5, resolved
// by delegation on 2026-11-14 — Brandon: "You can pick which takes to use";
// re-picked on 2026-11-17 from the regenerated female (Jessica) takes, issue
// #96, same measured-property rule): yell take 2 · DAG take 2 · win take 1.
// Swapping is free: both takes of every line are already paid for, so a page
// just points at one filename per line.
// The durations are the measured numbers from docs/VOICES.md; the page's
// selfTest compares them against what the browser decoder reports, so a wrong
// or missing file shows up as a number, not a shrug.

/** The three lines, byte-exact. Never "fix" the spellings (VISION.md). */
export const VOICE_LINES = {
  yell: { text: 'LOOK AT BOBO!', take: 2, file: 'assets/audio/yell-look-at-bobo.take2.mp3', dur: 1.07 },
  dag: { text: 'DAG!', take: 2, file: 'assets/audio/dag-wrong-cat.take2.mp3', dur: 0.74 },
  win: { text: 'your did it! you wind', take: 1, file: 'assets/audio/win-line.take1.mp3', dur: 1.58 },
};

/** When each line plays, per moment, in seconds from the start of the moment.
 *  This table is the plan the selfTest checks and the play loop fires; it is
 *  pure data so a fault can be planted in it (audio-plan checks must be able
 *  to fail). The wrong-cat moment yells FIRST (the player thought it was
 *  Bobo) and eats the DAG! after — same as the game's feel. */
export const AUDIO_PLAN = {
  idle: [],
  catch: [{ line: 'yell', at: 0.25 }],
  wrong: [
    { line: 'yell', at: 0.25 },
    { line: 'dag', at: 1.8 },
  ],
  win: [{ line: 'win', at: 0.35 }],
};

/** The plan for one moment as concrete { line, at, file } cues. `overrides`
 *  ({ line: file }) is how a planted fault replaces a take data-first. */
export function audioPlanFor(moment, overrides = {}) {
  return (AUDIO_PLAN[moment] ?? []).map((c) => ({
    line: c.line,
    at: c.at,
    file: overrides[c.line] ?? VOICE_LINES[c.line].file,
  }));
}

/** The playback engine. Audio must work in a plain browser, so playback is
 *  gated behind a user gesture like every real page: call unlock() from the
 *  click handler, and every fire() before that is a counted skip, never a
 *  console error. Each element records what happened to it (played, ended,
 *  refused, what the decoder says its duration is) so a headless check can
 *  prove the sound REALLY played instead of trusting the plan. */
export function createVoiceEngine({ resolve = (f) => f, volume, muted } = {}) {
  const els = new Map();
  const status = new Map();
  // Step 9 comfort: volume/mute, defaulting from the URL so every boot of the
  // game (and every suite run, which passes neither) keeps today's behaviour.
  const usp = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  const vRaw = volume ?? Number.parseFloat(usp?.get('volume') ?? '');
  let vol = Number.isFinite(vRaw) ? Math.min(1, Math.max(0, vRaw)) : 1;
  let mute = muted ?? usp?.get('mute') === '1';

  function elFor(file) {
    if (!els.has(file)) {
      const a = new Audio(resolve(file));
      a.preload = 'auto';
      a.volume = vol;
      a.muted = mute;
      const st = { file, loaded: false, duration: 0, requested: 0, started: 0, ended: 0, error: null };
      a.addEventListener('loadedmetadata', () => {
        st.loaded = true;
        st.duration = Number.isFinite(a.duration) ? a.duration : 0;
      });
      a.addEventListener('playing', () => {
        if (!a.muted) st.started++;
      });
      a.addEventListener('ended', () => {
        st.ended++;
        announceVoice(lineKeyFor(file), 'end');
      });
      a.addEventListener('error', () => {
        st.error = 'decode-or-load-error';
      });
      els.set(file, a);
      status.set(file, st);
    }
    return els.get(file);
  }

  let unlocked = false;

  /** Issue #71: tell the page a voice line started/ended, so the music can
   *  duck under it (a CustomEvent on document — no coupling, no import).
   *  Pure announcement: pages that don't listen behave exactly as before. */
  function announceVoice(lineKey, ev) {
    try {
      if (typeof document !== 'undefined' && typeof CustomEvent === 'function')
        document.dispatchEvent(new CustomEvent('lc-voice', { detail: { line: lineKey, event: ev } }));
    } catch {
      /* a page without CustomEvent simply never ducks */
    }
  }
  const lineKeyFor = (file) => Object.keys(VOICE_LINES).find((k) => VOICE_LINES[k].file === file) ?? null;

  return {
    /** Call from a real user gesture: primes every element so later fire()s
     *  are allowed, exactly like a click-to-begin gate. */
    unlock() {
      if (unlocked) return;
      unlocked = true;
      for (const line of Object.values(VOICE_LINES)) {
        const a = elFor(line.file);
        const st = status.get(line.file);
        a.muted = true;
        const p = a.play();
        if (p && p.then) {
          p.then(() => {
            a.pause();
            a.currentTime = 0;
            a.muted = mute;
          }).catch((err) => {
            a.muted = mute;
            st.error = `unlock-refused:${err && err.name ? err.name : err}`;
          });
        }
      }
    },
    audioUnlocked: () => unlocked,
    /** Fire one planned cue now. Returns true when playback was requested. */
    fire(line, file) {
      const v = VOICE_LINES[line];
      if (!v) throw new Error(`Unknown voice line "${line}"`);
      const use = file ?? v.file;
      if (!unlocked) return false;
      elFor(use);
      const st = status.get(use);
      st.requested++;
      const a = els.get(use);
      a.currentTime = 0;
      announceVoice(lineKeyFor(use), 'start');
      const p = a.play();
      if (p && p.catch) {
        p.catch((err) => {
          st.error = `play-refused:${err && err.name ? err.name : err}`;
        });
      }
      return true;
    },
    /** What actually happened to the audio files — the evidence a check reads. */
    audioStatus(files) {
      const list = files ?? Object.values(VOICE_LINES).map((v) => v.file);
      for (const f of list) elFor(f); // touch them so the decoder starts
      return list.map((f) => ({ ...status.get(f) }));
    },
    /** Comfort settings (Step 9): live-adjustable, and readable for checks. */
    setVolume(v) {
      vol = Math.min(1, Math.max(0, Number(v)));
      for (const a of els.values()) a.volume = vol;
    },
    setMuted(m) {
      mute = !!m;
      for (const a of els.values()) a.muted = mute;
    },
    volumeLevel: () => vol,
    isMuted: () => mute,
  };
}
