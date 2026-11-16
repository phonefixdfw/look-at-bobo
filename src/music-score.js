// src/music-score.js — ALL of the splash-screen music as data: the tune, the
// instruments, the tempo, the arrangements (issue #71). This module is pure:
// no Web Audio, no DOM, no timers. It is imported by game/engine.js (through
// src/music.js, the synth/scheduler engine) and unit-tested in Node by
// tools/audio/music-selftest.mjs — so Brandon can edit the tune here, run
// `npm run music:selftest`, and know the music is still well-formed before
// he ever opens a browser.
//
// ORIGINALITY: this is an original composition written for this project, in
// the "happy gothic / bardcore" genre — plucked harpsichord, lute, pipe, a
// little hand drum, mischievous swing. It does not quote, paraphrase, or
// sample any existing melody. See docs/MUSIC.md.
//
// HOW TO EDIT THE TUNE (the short version, more in docs/MUSIC.md):
//   * tempo feel        → meta.bpm (keep 100–120), meta.swing (0.5–0.7)
//   * loudness balance  → instruments[inst].gain  (one number each)
//   * the melody        → the pattern grids below: one char per 16th step.
//       '1'–'8' scale degree ('8' = the tonic an octave up), '-' rest,
//       '.' hold the previous note; 'R' 'T' 'F' 'O' are the current chord's
//       root / third / fifth / octave ('r' 't' 'f' = an octave down),
//       'd' hand drum, 'x' tambourine tick.
//   * which tune plays where → arrangements (patterns + chords per section).

/** Which 12 notes a "degree" means, and how long a step is. Degrees are 1–8
 *  (8 = octave up); semitones are from the tonic, so transposing the whole
 *  tune is just changing `tonicMidi` + `keyName`. */
export const meta = {
  keyName: 'A minor (Aeolian, with major lifts)',
  bpm: 110, // bardcore bounce; keep 100–120 (selftest enforces)
  swing: 0.57, // 0.5 = straight, 0.667 = triplet shuffle; 0.57 = a smirk
  beatsPerBar: 4,
  stepsPerBeat: 4, // sixteenth-note grid
  barsPerPattern: 2, // every pattern grid covers 2 bars
  tonicMidi: 57, // A3: degree 1 of the tune
  // A natural minor. The MAJOR lifts come from chord QUALITIES (F, C, G, E
  // are major triads), not from baking accidentals into the scale.
  scaleSemitones: [0, 2, 3, 5, 7, 8, 10],
};

/** Named triads used by the arrangements. deg = scale degree of the root,
 *  q: 'm' = minor third, 'M' = major third (the "lift"). Am–F–C–G is the
 *  i–VI–III–VII backbone; E('M') borrows G# for the happy-gothic cadence. */
export const chords = {
  Am: { deg: 1, q: 'm' },
  C: { deg: 3, q: 'M' },
  E: { deg: 5, q: 'M' },
  F: { deg: 6, q: 'M' },
  G: { deg: 7, q: 'M' },
};

/** The six synths as DATA — oscillator recipes, envelopes, gains, octave.
 *  gain is the per-instrument loudness knob. No reverb anywhere (CPU). */
export const instruments = {
  lead: {
    // bright plucked harpsichord: square + a touch of saw, sharp decay
    parts: [
      { type: 'square', gain: 0.5 },
      { type: 'sawtooth', gain: 0.3, detune: 5 },
    ],
    filter: { freq: 2400, q: 1.2, envFall: 1000 }, // pluck: opens then falls
    env: { attack: 0.004, decay: 0.34, hold: 0.9 },
    gate: 0.16, // seconds of "note held" per step, scaled by tie length
    gain: 0.5,
    octave: 1, // the tune sits an octave above the tonic
    charKind: 'degree',
  },
  lute: {
    // lute-like arpeggio: detuned triangles, short and round
    parts: [
      { type: 'triangle', gain: 0.55, detune: -7 },
      { type: 'triangle', gain: 0.55, detune: 7 },
    ],
    filter: { freq: 1500, q: 0.8, envFall: 500 },
    env: { attack: 0.003, decay: 0.22, hold: 0.9 },
    gate: 0.14,
    gain: 0.32,
    octave: 0,
    charKind: 'chord',
  },
  pipe: {
    // recorder/pipe countermelody: sine + vibrato, slow attack, sustained
    parts: [{ type: 'sine', gain: 0.9 }],
    vibrato: { rate: 5.5, cents: 16 },
    filter: { freq: 3200, q: 0.7, envFall: 0 },
    env: { attack: 0.05, decay: 0.1, hold: 0.75, release: 0.09 },
    gate: 0.16,
    sustain: true, // notes hold across '.' steps instead of re-plucking
    gain: 0.26,
    octave: 0,
    charKind: 'degree',
  },
  bass: {
    // pizzicato: sine + a little octave triangle, fast decay, root–fifth
    parts: [
      { type: 'sine', gain: 0.85 },
      { type: 'triangle', gain: 0.3, octaveUp: true },
    ],
    filter: { freq: 420, q: 0.9, envFall: 150 },
    env: { attack: 0.004, decay: 0.26, hold: 0.9 },
    gate: 0.16,
    gain: 0.5,
    octave: -1,
    charKind: 'chord',
  },
  drum: {
    // hand drum: pitch-dropping sine; tambourine: a bright short tick
    membrane: { startFreq: 150, endFreq: 52, decay: 0.16, gain: 0.5 },
    tick: { decay: 0.06, gain: 0.16, highpass: 4200 },
    gain: 0.4,
    charKind: 'drum',
  },
  ornament: {
    // tiny grace/trill flourish at phrase ends — a thinner, quieter lead
    parts: [{ type: 'square', gain: 0.55 }],
    filter: { freq: 3000, q: 1, envFall: 1200 },
    env: { attack: 0.003, decay: 0.12, hold: 0.9 },
    gate: 0.1,
    gain: 0.2,
    octave: 1,
    charKind: 'degree',
  },
};

/** The pattern grids. Each is TWO bars = 32 sixteenth-note steps, written as
 *  two 16-char bar strings so they are easy to count and edit by eye. */
export const patterns = {
  // --- harpsichord lead (scale degrees) ---
  leadIntro: ['1---3---5---6---', '5.6.5.3.1---8---'], // a call across the chord
  leadA: ['5-6-7-8-6.5-3-1-', '2-3-1---5-3-2-1-'], // verse: bouncy, settles home
  leadB: ['8-8-5--8-3-8-6-5', '6-5-3-5-8---5-3-'], // chorus: bigger, lifts
  leadC: ['3---5---6-5-3---', '2---3-5-2---8---'], // bridge: more legato, wistful
  flourA: ['1.1.1-1.5.5.8---', '8-7-8-5-8---8---'], // win fanfare, octaves up
  flourB: ['6.7.8.6.5.3.2.1.', '1-3-5-8---5-3-1-'], // ...resolves home, minor
  // --- pipe countermelody (long notes over the bridge) ---
  pipeAnswer: ['3-------5-------', '6-------5---3---'],
  // --- lute arpeggios (chord tones) ---
  luteArpDown: ['R-F-T-O-T-F-R-F-', 'O-F-T-R-T-F-R-T-'],
  luteArpUp: ['R-T-F-O-F-T-R-F-', 'R-F-T-R-O-T-F-O-'],
  luteCalm: ['R---F---T---R---', 'T---R---F-------'], // calm: slow, thin
  // --- pizzicato bass (chord tones) ---
  bassRootFifth: ['R---.---F---.---', 'R---.---T---F---'],
  bassWalk: ['R---.---F---T---', 'R---.---R---.---'],
  bassCalm: ['R-------R-------', 'R-------F-------'], // calm: heartbeats
  // --- hand drum + tambourine ---
  drumTap: ['d--dd---d--d-x--', 'd--dd-x-d---d---'], // light, mischievous
  drumLight: ['d---x---d---x---', 'd---x---d-x---x-'],
  // --- ornaments (phrase-end trills, second bar of each pair) ---
  ornTrill: ['----------------', '--------8-7-8---'],
};

/** The three arrangements. A section = N bars, one chord per bar, and which
 *  pattern each instrument plays ('-' or missing = that instrument is out).
 *  `main` is the 32-bar game loop; `calm` is the thin pause/title version;
 *  `flourish` is the win jingle (plays once, then the engine switches to
 *  calm). Section bars must be EVEN (patterns are 2 bars) — the selftest
 *  enforces every section's bar count, chord count and pattern length. */
export const arrangements = {
  main: {
    loop: true,
    level: 1, // scene loudness (music.js fades to this)
    fadeIn: 2, // seconds: the first notes fade in, never bump
    sections: [
      { id: 'intro', bars: 4, chords: ['Am', 'Am', 'F', 'G'], tracks: { lead: 'leadIntro', lute: 'luteArpDown', bass: 'bassRootFifth' } },
      { id: 'verse', bars: 8, chords: ['Am', 'Am', 'F', 'C', 'Am', 'Am', 'G', 'F'], tracks: { lead: 'leadA', lute: 'luteArpDown', bass: 'bassWalk' } },
      { id: 'chorus', bars: 8, chords: ['F', 'G', 'Am', 'Am', 'F', 'G', 'C', 'G'], tracks: { lead: 'leadB', lute: 'luteArpUp', bass: 'bassWalk', drum: 'drumTap', ornament: 'ornTrill' } },
      { id: 'bridge', bars: 8, chords: ['F', 'C', 'G', 'G', 'F', 'C', 'G', 'Am'], tracks: { lead: 'leadC', lute: 'luteArpDown', bass: 'bassRootFifth', pipe: 'pipeAnswer', drum: 'drumLight' } },
      { id: 'reprise', bars: 4, chords: ['Am', 'F', 'G', 'Am'], tracks: { lead: 'leadA', lute: 'luteArpUp', bass: 'bassWalk', drum: 'drumTap' } },
    ],
  },
  calm: {
    loop: true,
    level: 0.7,
    fadeIn: 0.6,
    sections: [
      { id: 'calmA', bars: 8, chords: ['Am', 'Am', 'F', 'C', 'Am', 'Am', 'G', 'Am'], tracks: { pipe: 'pipeAnswer', lute: 'luteCalm', bass: 'bassCalm' } },
    ],
  },
  flourish: {
    loop: false, // plays once; music.js then switches to `calm`
    level: 1,
    fadeIn: 0.15,
    sections: [
      { id: 'fanfare', bars: 4, chords: ['Am', 'F', 'C', 'G'], tracks: { lead: 'flourA', lute: 'luteArpUp', bass: 'bassRootFifth', drum: 'drumTap' } },
      { id: 'resolve', bars: 4, chords: ['Am', 'F', 'G', 'Am'], tracks: { lead: 'flourB', lute: 'luteArpUp', bass: 'bassRootFifth', drum: 'drumTap', ornament: 'ornTrill' } },
    ],
  },
};

/** The duck under the voice lines: -4 dB, ~12 ms attack, gentle ~400 ms
 *  release (setTargetAtTime time-constants; 3τ ≈ settled). */
export const duck = { level: 0.631, attackTau: 0.004, releaseTau: 0.13 };

// ---------------------------------------------------------------- data → math
// Everything below is pure derivation from the data above: no page code may
// re-implement it, and Node checks call exactly these functions.

/** Steps in one 2-bar pattern grid (32 at 4 steps/beat × 4 beats). */
export function stepsPerPattern(m = meta) {
  return m.barsPerPattern * m.beatsPerBar * m.stepsPerBeat;
}

/** Expand sections into per-bar { chord, tracks } rows. Deterministic. */
export function arrangementBars(arr) {
  const rows = [];
  for (const sec of arr.sections) {
    if (sec.chords.length !== sec.bars) throw new Error(`section ${sec.id}: ${sec.chords.length} chords for ${sec.bars} bars`);
    if (sec.bars % 2 !== 0) throw new Error(`section ${sec.id}: bars must be even (patterns are 2 bars)`);
    for (let b = 0; b < sec.bars; b++) rows.push({ chord: sec.chords[b], tracks: sec.tracks, id: sec.id });
  }
  return rows;
}

/** Total steps in one pass of an arrangement. `main` = 32 bars × 16 = 512. */
export function stepsPerArrangement(arr) {
  return arrangementBars(arr).length * meta.beatsPerBar * meta.stepsPerBeat;
}

/** Seconds for one pass (loop length). */
export function secondsPerArrangement(arr) {
  return (stepsPerArrangement(arr) / meta.stepsPerBeat) * (60 / meta.bpm);
}

/** Swing inside one beat: step k (0–3) sits at this FRACTION of a beat.
 *  k=1 and k=3 slide late with `swing` (0.5 = straight, 0.667 = shuffle). */
export function swingOffset(k, m = meta) {
  return [0, m.swing / 2, 0.5, 0.5 + m.swing / 2][k];
}

/** Absolute seconds of grid step `s` from the start of a pass. Bar count is
 *  untouched by swing (it only moves notes INSIDE each beat), so the loop
 *  length stays exact — there is no room for drift. */
export function stepTimeSec(s, m = meta) {
  return (Math.floor(s / m.stepsPerBeat) + swingOffset(s % m.stepsPerBeat, m)) * (60 / m.bpm);
}

/** MIDI note of scale degree `deg` (1–8+, wraps octaves), offset by `oct`. */
export function degreeMidi(deg, oct = 0, m = meta) {
  const i = deg - 1;
  const octs = Math.floor(i / m.scaleSemitones.length);
  return m.tonicMidi + oct * 12 + octs * 12 + m.scaleSemitones[i % m.scaleSemitones.length];
}

/** MIDI notes of a named chord's triad at its octave home. */
export function chordMidis(name, oct = 0, m = meta) {
  const c = chords[name];
  if (!c) throw new Error(`unknown chord "${name}"`);
  const root = degreeMidi(c.deg, oct, m);
  return [root, root + (c.q === 'M' ? 4 : 3), root + 7];
}

/** Resolve one pattern character for an instrument at step s, against the
 *  chord of the bar. Returns null (rest/tie), { midi, tie } or { drum }. */
export function resolveChar(ch, instName, chordName, m = meta) {
  const inst = instruments[instName];
  if (!inst) throw new Error(`unknown instrument "${instName}"`);
  if (ch === '-' || ch === '.') return null;
  if (inst.charKind === 'drum') {
    if (ch === 'd') return { drum: 'membrane' };
    if (ch === 'x') return { drum: 'tick' };
    throw new Error(`drum pattern char "${ch}" (use d or x)`);
  }
  if (inst.charKind === 'chord') {
    const [r, t, f] = chordMidis(chordName, 0, m);
    const map = { R: r, T: t, F: f, O: r + 12, r: r - 12, t: t - 12, f: f - 12 };
    if (!(ch in map)) throw new Error(`chord pattern char "${ch}" (use R T F O r t f)`);
    return { midi: map[ch] + inst.octave * 12 };
  }
  if (ch < '1' || ch > '9') throw new Error(`melody pattern char "${ch}" (use 1-8)`);
  return { midi: degreeMidi(Number(ch), inst.octave, m) };
}

/** How many steps a note at step s lasts: 1, plus each following '.' step. */
export function tieSpan(grid, s) {
  let n = 1;
  while (grid[s + n] === '.') n++;
  return n;
}

/** THE scheduler core, as pure math: note events for grid steps
 *  [fromStep, toStep) of arrangement `name`, absolute to the start of a pass.
 *  Both the live scheduler and the offline render call this — one code path,
 *  one chance to be wrong. Events: { inst, at (sec), dur (sec), midi?, drum? }. */
export function planNotes(score, name, fromStep, toStep) {
  const arr = score.arrangements[name];
  if (!arr) throw new Error(`unknown arrangement "${name}"`);
  const bars = arrangementBars(arr);
  const loop = bars.length * meta.beatsPerBar * meta.stepsPerBeat;
  const spb = meta.stepsPerBeat;
  const events = [];
  for (let s = fromStep; s < toStep; s++) {
    const inLoop = ((s % loop) + loop) % loop;
    const bar = bars[Math.floor(inLoop / (meta.beatsPerBar * spb))];
    for (const instName of Object.keys(score.instruments)) {
      const pname = bar.tracks[instName];
      if (!pname || pname === '-') continue;
      const p = score.patterns[pname];
      if (!p) throw new Error(`unknown pattern "${pname}"`);
      const flat = p[0] + p[1]; // 32-step 2-bar grid
      const ch = flat[inLoop % stepsPerPattern()];
      if (ch === '-' || ch === '.') continue;
      const r = resolveChar(ch, instName, bar.chord);
      if (!r) continue;
      const span = instruments[instName].sustain ? tieSpan(flat, inLoop % stepsPerPattern()) : 1;
      const inst = instruments[instName];
      const at = stepTimeSec(inLoop);
      const beat = 60 / meta.bpm;
      const dur = r.drum
        ? 0.2
        : inst.sustain
          ? span * (beat / spb) * 0.95
          : inst.gate * Math.max(1, span);
      events.push({ inst: instName, at, dur, ...r });
    }
  }
  return events;
}

/** Structural self-review of the score (used by the Node selftest): returns
 *  a list of problems; [] means the tune is well-formed. */
export function validateScore(score = { meta, chords, instruments, patterns, arrangements }) {
  const bad = [];
  const m = score.meta;
  if (!(m.bpm >= 100 && m.bpm <= 120)) bad.push(`bpm ${m.bpm} outside 100–120`);
  if (!(m.swing > 0.5 && m.swing < 0.7)) bad.push(`swing ${m.swing} outside (0.5, 0.7)`);
  const minor = m.scaleSemitones.includes(3);
  if (!minor) bad.push('scale is not minor (no minor third)');
  for (const [name, p] of Object.entries(score.patterns)) {
    if (p.length !== m.barsPerPattern) bad.push(`pattern ${name}: ${p.length} bars, expected ${m.barsPerPattern}`);
    for (const bar of p) if (bar.length !== m.beatsPerBar * m.stepsPerBeat) bad.push(`pattern ${name}: bar "${bar}" is not ${m.beatsPerBar * m.stepsPerBeat} steps`);
    for (const bar of p) for (const ch of bar) if (ch !== '-' && ch !== '.') {
      const kinds = Object.values(score.instruments).map((i) => i.charKind);
      const okDeg = kinds.includes('degree') && ch >= '1' && ch <= '8';
      const okChord = kinds.includes('chord') && 'RTFOrtf'.includes(ch);
      const okDrum = kinds.includes('drum') && 'dx'.includes(ch);
      if (!okDeg && !okChord && !okDrum) bad.push(`pattern ${name}: bad char "${ch}"`);
    }
  }
  for (const [name, arr] of Object.entries(score.arrangements)) {
    let bars;
    try { bars = arrangementBars(arr); } catch (e) { bad.push(`${name}: ${e.message}`); continue; }
    if (name === 'main' && bars.length < 16) bad.push(`main loop is ${bars.length} bars, needs 16–32`);
    for (const row of bars) {
      if (!(row.chord in score.chords)) bad.push(`${name}: unknown chord "${row.chord}"`);
      for (const [inst, pname] of Object.entries(row.tracks)) {
        if (pname === '-') continue;
        if (!score.patterns[pname]) bad.push(`${name}: ${inst} references unknown pattern "${pname}"`);
        else if (!(score.instruments[inst] ?? {}).charKind) bad.push(`${name}: unknown instrument "${inst}"`);
      }
    }
  }
  // Originality/feel guards (acceptance criterion 9): the piece is a minor
  // piece with a major lift, and the win resolves back to the minor tonic.
  const majorLift = Object.values(score.chords).some((c) => c.q === 'M');
  if (!majorLift) bad.push('no major-lift chord — the happy in happy-gothic is missing');
  const win = score.arrangements.flourish;
  const winBars = win ? arrangementBars(win) : [];
  if (!winBars.length || winBars[winBars.length - 1].chord !== 'Am') bad.push('flourish must resolve to the minor tonic');
  return bad;
}

/** The whole score as one object — what music.js takes, what the selftest
 *  validates, what a future randomizer could mutate. */
export const MUSIC_SCORE = { meta, chords, instruments, patterns, arrangements, duck };
