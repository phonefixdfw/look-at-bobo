# Look at Bobo — Music (issue #71)

> The game's soundtrack: one **original composition**, synthesized live in the
> browser with the Web Audio API — a small MIDI-style sequencer, no samples,
> no downloads, no new asset files. Brandon's brief (2026-11-15): "something
> bardcore style, like happy Gothic you'd hear in the Addams Family."
>
| | |
|---|---|
| The tune | `src/music-score.js` — 100 % data: notes, instruments, arrangements, tempo |
| The engine | `src/music.js` — synth + lookahead scheduler + ducking + `LC.musicRender()` |
| Wiring | `game/engine.js` (creates the module only on `cfg.music` pages, starts it in the START gesture) |
| Checks | `npm run music:selftest` (pure Node, 29 checks) · `npm run music:check` (real Chrome, 28 checks) |
| Status (2026-11-16) | shipped on `game/full.html` only; **nobody on the team has heard it** — all evidence is measured, not listened (see "What to listen for") |

## Originality statement

This is an **original composition written for this project**. It evokes the
happy-gothic / bardcore genre (plucked harpsichord, lute arpeggios, a drone
of a pipe, a little hand drum, mischievous swing) and **does not quote,
paraphrase, or sample any existing melody** — the Addams Family theme in
particular was never used as reference material, typed, hummed, or analyzed.
Nothing here came from a MIDI file, a sample pack, or the network: every
sample the browser plays is an oscillator waveform or one locally generated
noise buffer. `music:selftest` statically refuses `fetch`/`XMLHttpRequest`/
`.mp3`/`.wav`/`.ogg`/`decodeAudio` in the music modules, and the browser
check counts AudioContexts to prove the pages that must stay silent never
touch Web Audio.

## The tune (what is in `src/music-score.js`)

| Parameter | Value | Knob |
|---|---|---|
| Key | **A minor** (Aeolian) with major lifts — the lift is the chord qualities F, C, G (and a borrowed **E major** cadence color), not accidentals in the scale | `meta.tonicMidi` + `meta.keyName` transpose everything |
| Tempo | **110 BPM**, 4/4, 16th-note grid (4 steps/beat) | `meta.bpm` (selftest enforces 100–120) |
| Swing | **0.57** — off 0.5 (straight) toward 0.667 (triplet shuffle); just enough to smirk | `meta.swing` (selftest enforces (0.5, 0.7)) |
| Loop | **32 bars** = 512 steps = **69.8 s per pass**: intro 4 → verse 8 → chorus 8 → bridge 8 → reprise 4 | sections live in `arrangements.main` |
| Backbone | **Am – F – C – G** (i – VI – III – VII) through the loop; chorus adds the ornament trills, bridge brings in the pipe | `arrangements.*.sections[].chords` |
| Arrangements | `main` (the game loop) · `calm` (pause menu + title: pipe + slow lute + heartbeat bass, level 0.7) · `flourish` (win fanfare, plays once then hands over to calm, resolves to **Am**) | `arrangements` |

### The instruments (all synth, all data)

| Instrument | Recipe (`instruments`) | Gain knob | Role |
|---|---|---|---|
| `lead` | square + detuned saw, fast lowpass pluck | `0.29` | the harpsichord tune, one octave up |
| `lute` | detuned triangle pairs, short round decay | `0.21` | chord-tone arpeggios |
| `pipe` | sine + shared vibrato LFO, slow attack, sustains across ties | `0.21` | countermelody (chorus/bridge/calm) |
| `bass` | sine + octave triangle, 420 Hz lowpass, root–fifth | `0.34` | pizzicato heartbeat |
| `drum` | pitch-dropping sine membrane + highpassed noise tick | `0.27` | hand drum + tambourine |
| `ornament` | thin square, fast decay | `0.16` | phrase-end trills |

Gains were tuned against the **offline render**: at master = 1 the 20 s mix
measures rms 0.164 / peak 0.82 (calm 0.117/0.75, flourish 0.170/0.91) —
audible, and no arrangement clips. The mix sums before one master, so these
numbers are the real ceiling players hear before `?volume`.

### Editing the tune by hand

Every pattern grid is **two 16-char bar strings = two bars of 16th steps**;
`arrangements` says which pattern each instrument plays per section. Chars:

```
'1'–'8'  scale degree ('8' = tonic octave up)     — lead, pipe, ornament
'R' 'T' 'F' 'O'   current chord root/third/fifth/octave ('r t f' = down an octave) — lute, bass
'd' hand drum · 'x' tambourine tick               — drum
'-' rest · '.' hold the previous note (ties extend the note; only the pipe ties)
```

Rules `validateScore()` enforces (so `npm run music:selftest` catches a
typo before a browser ever opens): bars exactly 16 chars, 2 bars per pattern,
even bar counts per section, one chord per bar, chars legal for the
instrument, section chords known, main loop 16–32 bars, the piece stays a
minor key **with** a major-lift chord, and the flourish still resolves to Am.

## Playback rules (what `src/music.js` guarantees)

- **Silent until you touch it.** No AudioContext exists until the START tap;
  `unlockGate()` calls `music.start(true)` inside that same gesture. Under
  `?gate=off` (capture/tests) and `?music=off` the module is never even
  created — the browser check counts **0 live AudioContexts** on those pages,
  so the capture baselines are byte-identical.
- **Lookahead scheduler, not per-note timers.** A 25 ms interval schedules
  ≤120 ms ahead. Loop position is an absolute integer step against one
  re-anchored clock: mathematically drift-free (the selftest proves step-time
  periodicity across passes). After a stall (throttled tab, iOS suspend) it
  **skips** missed steps instead of burst-scheduling them, and caps live
  voices at 24 — a dropped note, never a pile-up. `music:check` blocks the
  main thread for a second and measures the catch-up is bounded.
- **Ducks under the voice lines.** `src/audio.js` announces every fire/ended
  as a `lc-voice` document event; the music dips a dedicated gain stage
  **0.631 (≈ −4 dB), ~12 ms in, ~400 ms out**. Measured in Chrome during a
  real "LOOK AT BOBO!": duckLevel 0.631, back above 0.96 after the line.
- **Scenes.** play → `main` · pause menu → `calm`, quieter, still playing ·
  title/menu → `calm` at the lowest level · win → `flourish` once, then calm.
  Tab hidden → the step clock FREEZES and the mix fades to nothing; showing
  the tab re-anchors and resumes mid-pattern. Swaps dip ~120 ms before the
  new arrangement fades in, so nothing ever overlaps or stacks.
- **Volumes compose.** `master = ?volume × ?musicvol`, mute is
  `?mute || ?musicmute` — a plain product, so voice volume and music volume
  stay independent. The gear panel has **Music volume** and **Mute music**
  beside the existing Volume/Mute pair (they live in the URL like every
  other setting, so a choice survives refresh and shares as a link).
- **Phones.** `?quality=low` (auto on touch/small screens) mutes
  drum/ornament/pipe and thins the set; no reverb anywhere at any quality.

### URL params

| Param | Effect |
|---|---|
| `?music=off` | the soundtrack module is never created (0 AudioContexts) |
| `?musicvol=0..1` | music level, multiplied into the master |
| `?musicmute=1` | silences music only (voices keep playing) |
| `?volume` / `?mute` | pre-existing master pair — both apply to music too |

### Debug surface (for tools and for Brandon's console)

- `LC.music()` → live state: `ctxCreated/ctxState, scene, arrangement, step,
  duckLevel, sceneLevel, master, liveVoices, lowQuality, frozen…`
- `LC.setPaused(true|false)` → the game's real pause (music swaps to calm).
- `LC.musicRender(20, 'main'|'calm'|'flourish')` → renders through the **real
  synth paths** in an OfflineAudioContext and returns `{rms, peak, bass,
  lead}` band stats. Works even under `?gate=off` (offline is inaudible;
  the tool path is the one way to "hear" the mix headlessly).

## What to listen for (nobody on the team can hear it — Brandon is the ears)

Everything above is *measured*; none of it is *listened*. First run, press
START and check:

1. **Tempo/feel** — does 110 BPM with 0.57 swing bounce rather than drag?
   Too clip-clop → lower `meta.swing` toward 0.5; too lazy → raise `meta.bpm`
   (stay 100–120).
2. **Loudness against the voice lines** — the "LOOK AT BOBO!" yell should
   sit clearly ON TOP with the music just stepping aside (−4 dB). Voices
   still fighting the tune → drop instrument gains (start with `lead`
   0.29 / `bass` 0.34); music too timid → `?musicvol` up, or raise gains
   together (keep the offline peak under 1.0: `LC.musicRender()` says so).
3. **A clean loop** — sit past the 70 s seam (intro reprise → intro): no
   hiccup, no tempo shift at the wrap.
4. **The mood** — mischievous-tippy-toe, not sad, not spooky. Dull → the
   `lead` gain or the swing; too circus-y → drop `drum` 0.27; not enough
   gothic → the bass is carrying too little (0.34).
5. **Pause → calm, win → fanfare** — Esc should thin the music, not stop it;
   the win jingle should land once and settle into the calm loop.

The knobs: `meta.bpm`, `meta.swing`, `instruments.*.gain`, `meta.tonicMidi`
(transpose), and the pattern grids. Edit `src/music-score.js`, run
`npm run music:selftest`, refresh, listen.
