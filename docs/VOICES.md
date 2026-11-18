# Look at Bobo — Voices (Step 4)

> The cast sheet, cost plan and rulebook for the game's three voice lines.
> The one paid audio tool is `tools/gen-audio.mjs` (rule: the game plays static
> files and **never** calls the API; every paid generation goes through this one
> cost-guarded tool). Test page: `tools/audio/voice-test.html` (`npm run serve`).
>
> **Status (2026-11-17): ✅ REGENERATED — issue #96: all 6 takes re-bought
> with a FEMALE voice (Jessica) and the win line respelled in the generation
> input so the spoken "wind" is the breeze, not "wind it up" (display text
> unchanged, byte-exact). Second paid run
> `tools/audio/ledger/2026-11-18T00-21-05-610Z.json`: 6/6 ok, zero retries,
> account counter 310 → 372 = **62 credits ≈ $0.005** (estimate 154).
> Shipped picks re-measured from the new takes: yell t2 · DAG t2 · win t1.**
>
> **Status (2026-11-14): ✅ GENERATED — all 6 takes bought in ONE run**
> (3 lines × 2 takes, zero failures, zero retries; ledger
> `tools/audio/ledger/2026-11-14T22-17-51-472Z.json`). Files are on disk in
> `assets/audio/` (committed, 131 KB total) and play on the audition page
> (`npm run serve` → voice-test page). Real cost: **60 credits posted ≈ $0.005**
> (measured, was 250 of 10,000 before → 310 after) against a 150-credit /
> $0.012 worst-case estimate — see "What it actually cost".
> **V5 resolved by delegation (Brandon: "You can pick which takes to use"):
> picks below, swap is free** — both takes of every line are already paid for.
> (The 2026-11-14 Liam cast and take table below are kept as the historical
> record of that run; the live cast + tables are the #96 sections.)

## The three lines (byte-exact — never "fix" the spellings)

| # | Line (exact string) | When it plays | Notes |
|---|---|---|---|
| 1 | `LOOK AT BOBO!` | every correct catch, with the fireworks | the game's signature yell — joyful and silly, **never scary** |
| 2 | `DAG!` | with the gentle coral X when the player shouts at the decoy cat | Brandon's exact wording (`docs/DECOY_CAT.md`); playful, never a harsh buzzer |
| 3 | `your did it! you wind` | the win screen at 10 points | spelled exactly this way **on purpose** (`VISION.md`); proposed voiced, not text-only (a silent ending next to two voiced lines would feel cheap — build-a-game lesson) |

`gen-audio.mjs` refuses to generate anything whose manifest text drifts from
those three strings (same spirit as the `ending-text-exact` capture check).
The voice-test page flags drift visually.

## Casting

All three lines are the **same speaker: the player** (first-person, unseen), so
one voice covers the game — cheaper and more coherent.

| Role | Recommended (default) | Alternatives | Why |
|---|---|---|---|
| The player (all 3 lines) | **Jessica** — "Playful, Bright, Warm" (`cgSgspJ2msm6clMCkdW9`) — **since issue #96 (2026-11-17): Brandon wants a female voice** | **Liam** — "Energetic, Social Media Creator" (`TX3LPaxmHKxFdv7VOQHJ`, the 2026-11-14 original cast); **Charlie** — "Deep, Confident, Energetic" (`IKne3meq5aSn9XLyUdCD`) | Jessica is the warm, bright, playful adult-female voice of the account's default premade set — the same "watch my cat do a thing!" energy, one voice for all three lines. Voice ids were read live from the account's own `GET /v1/voices` (2026-11-14 and re-confirmed 2026-11-17). |

The voice **was resolved by name at buy time both times**: the account's own
`GET /v1/voices` returned `Liam - Energetic, Social Media Creator`
(`TX3LPaxmHKxFdv7VOQHJ`) for the 2026-11-14 run and
`Jessica - Playful, Bright, Warm` (`cgSgspJ2msm6clMCkdW9`) for the #96 run
(both verified in `assets/audio/lock.json`). The idHint path was never needed.

The tool resolves the voice **by name against whatever account the key belongs
to** at buy time (falls back to the id hint), so casting survives a different
ElevenLabs account. To swap after hearing the takes: edit `voice.name` in the
manifest; if takes are already recorded, the swap needs `--allow-rebuy` (an
explicit, visible re-spend).

## Model + delivery settings (per line)

Model: **`eleven_multilingual_v2`** for all three — the lifelike model with the
richest emotional range, which is the whole job here (a joyful yell and a comic
"DAG!"). Flash/Turbo is half the price but tuned for latency, not express — the
savings would be fractions of a cent. Verified from `GET /v1/models` + the
docs (2026-11-14). Settings (from the manifest):

| Line | stability | style | similarity_boost | why |
|---|---|---|---|---|
| yell | 0.30 | 0.65 | 0.8 | low stability = wider emotional range; high style pushes the excitement |
| DAG! | 0.35 | 0.50 | 0.8 | one word; delivery context `previous_text: "You found a cat!"` / `next_text: "But that is not Bobo."` keeps it from coming out flat (build-a-game one-word-line rule) |
| win line | 0.35 | 0.55 | 0.8 | giddy, a bit breathless; since #96 the API receives `speakText` "your did it! you winned" so "wind" is spoken like the breeze (see "Pronunciation" below) |

Seeds are deterministic (`gen-audio.mjs` fnv-hash of line+take) so a take is
reproducible in principle; take 1 and take 2 use different seeds so the two
takes are genuinely different performances, not copies.

## Pronunciation — the "wind" is the breeze (issue #96, 2026-11-17)

The on-screen win text stays `your did it! you wind` byte-exact (VISION.md),
but the OLD takes spoke "wynd" (like winding a clock); Brandon wants "wihnd"
like the weather. ElevenLabs' docs (checked 2026-11-17) are explicit that
`eleven_multilingual_v2` **does not support phoneme tags** — the supported
lever is a **respelling in the text the API receives**. So `gen-audio.mjs`
learned one new manifest field, `speakText`: when present it is what gets
**sent** to the API, while `text` stays the byte-exact game string the
exact-string guard enforces and the lock keeps. The win line's speakText is
`your did it! you winned` — "winned" rhymes with "pinned/sinned", an
unambiguous token, and the respelling lives in exactly one place
(`tools/audio/manifest/step4.json`), nowhere else.

Verification, plainly: nobody on the team can listen. A free local
re-transcribe (faster-whisper `base.en`, /tmp only) heard the OLD takes as
"you wind" and the NEW takes as "you win" — the two are audibly different and
the new read matches the short-vowel target, but transcripts normalize
spelling, so this is supportive, not proof; a crude F2-trajectory probe was
inconclusive and is not cited. The guarantee is the mechanism: the model
received only the unambiguous respelling. Both new takes are on the audition
page for Brandon's ears — flipping takes or overruling costs $0.

## Cost — the estimate before anything is bought

Published API rates, verified 2026-11-14 from elevenlabs.io/pricing/api:
**$0.08 per 1,000 characters** on multilingual models (Flash/Turbo $0.04).
On subscription plans ElevenLabs converts ~**1 credit per character** on the
top models. TTS is billed per **input** character (every letter, space and
punctuation mark), so the delivery context on DAG! counts in the worst case.

| Line | chars per request | × 2 takes |
|---|---|---|
| `LOOK AT BOBO!` | 13 | 26 |
| `DAG!` (incl. context, worst case) | 41 | 82 |
| `your did it! you wind` | 21 (23 from #96: billed on `speakText`) | 42 (46 from #96) |
| **Total, all 6 requests** | | **150 chars ≈ 150 credits ≈ $0.012** (154 ≈ $0.0123 from #96) |

Call it **pennies: about 1.2 cents, or ~150 of 100,000 credits** — even a
Free plan (10k credits/month) absorbs it ~10× over. This is what
`npm run audio:dry` prints; the first authenticated dry-run also reads the
account's own `/v1/models` prices and subscription balance.

**Ground-truth rule:** the published rate is the estimate; the **ledger** is the
truth. `--buy` records the subscription balance before/after each run and
reports the actually-billed credits; if that number disagrees with the table
above, this doc gets corrected (build-a-game lesson: real rates have come out
different from published estimates).

### What it actually cost (measured 2026-11-14, run `2026-11-14T22-17-51-472Z`)

The one and only buy run bought all 6 requests; every request returned audio on
the first try — **no failures, no retries, no `--allow-rebuy`**.

| Measurement | Value |
|---|---|
| In-run balance delta (ledger, ground truth) | **0 credits** (250 → 250) — ElevenLabs' counter lags the API by minutes, so the in-run delta could not measure it |
| Account counter ~4 min after the run | **310 used** (was 250 before) → **≈60 credits actually billed** for all 6 takes |
| Cost at the published $0.08/1k | **≈ $0.005** (worst case per the table above was $0.012) |
| Plan | Free tier, 10,000 credits/period — ~0.6 % of one period used by the whole cast |

Why 60 and not 150: the estimate charges the worst case (every character of the
`DAG!` delivery context billed at 1 credit/char). Actual billing was cheaper —
the context lines and/or punctuation clearly don't bill at the worst-case rate.
The estimate stays as written above: it is the **cap**, not the expectation.
`GET /v1/models` on this account returns a bare array whose
`eleven_multilingual_v2` entry carries no `prices` field, so the per-run live
price printout can only confirm model availability — the balance delta remains
the only real-rate instrument, and its reading must be taken minutes after the
run, not inside it.

### The #96 re-cast run (measured 2026-11-17, run `2026-11-18T00-21-05-610Z`)

The second and only other paid run: 6 requests (Jessica × 3 lines × 2 takes,
the win line carrying `speakText`), `--allow-rebuy all`, zero failures, zero
retries. Dry-run estimate first, as always: **154 chars ≈ 154 credits ≈
$0.0123 worst case**. In-run ledger delta again read 0 (same counter lag);
minutes later the account counter showed **310 → 372 = 62 credits ≈ $0.005**,
40 % of the worst case — the same measured rate as the first run. Cumulative
for the whole project: **≈ 122 credits ≈ $0.010** of the 2,000-credit
ceiling, 372/10,000 of the free-plan period.

### Spend guardrails (all enforced in code, all proven by `npm run audio:selftest`)

- Default command is a **dry run**; buying needs `--buy` **and** `--max-credits N`.
- Manifest limits: **≤2 takes per line** (Brandon's approval cap), **≤6 paid
  requests per run**, **2,000-credit project ceiling** counted cumulatively
  across all runs — ~13× the whole honest spend, so re-takes stay possible but
  a runaway loop cannot happen.
- **Never pay twice:** every recorded take is content-hashed into
  `assets/audio/lock.json`; ready takes are skipped, and editing an already
  recorded line's text or settings is **refused** unless `--allow-rebuy <line>`
  is passed deliberately.
- Fail-fast: the first API error stops the run before any further request.
- Exact-string guard on the three lines (see above). `speakText` (#96) is the
  only allowed divergence between game string and sent text, is recorded in
  every lock entry (`spoken`), is billed and hashed as part of the take, and
  can never be used to change what is DISPLAYED — the guard keeps biting on
  `text` (selftest `exact-string-guard`).
- The API key never enters the browser, the repo, the chat, the tool's output,
  or the ledger (output is redacted even if a server echoed the key back).

## Files produced (bought 2026-11-14 — all present, committed)

```
assets/audio/
  yell-look-at-bobo.take1.mp3   take2.mp3
  dag-wrong-cat.take1.mp3       take2.mp3
  win-line.take1.mp3            take2.mp3
  lock.json                     # hash, voice, seed, bytes, date per take (committed)
tools/audio/ledger/2026-11-14T22-17-51-472Z.json  # the one paid run (committed)
```

Actual takes (regenerated 2026-11-17 with Jessica; durations measured by
ffprobe and re-measured by Chrome's decoder in the audition page — identical;
seeds unchanged from the 2026-11-14 plan, so a take stays reproducible):

| File | Text (spoken) | Duration | Size | Seed |
|---|---|---|---|---|
| `yell-look-at-bobo.take1.mp3` | `LOOK AT BOBO!` | 1.11 s | 18.4 KB | 1876062199 |
| `yell-look-at-bobo.take2.mp3` | `LOOK AT BOBO!` | 1.07 s | 17.6 KB | 1892839818 |
| `dag-wrong-cat.take1.mp3` | `DAG!` | 1.07 s | 17.6 KB | 633787340 |
| `dag-wrong-cat.take2.mp3` | `DAG!` | 0.74 s | 12.7 KB | 684120197 |
| `win-line.take1.mp3` | `your did it! you winned` (says "you wihnd") | 1.58 s | 25.8 KB | 2452163117 |
| `win-line.take2.mp3` | `your did it! you winned` (says "you wihnd") | 1.44 s | 23.7 KB | 2401830260 |

**116 KB total for the whole cast** — plain static files, small enough for the
web with no build step. Same filenames/formats as the 2026-11-14 Liam cast they
replace (nothing stale on disk or in the build); lengths within ~0.3 s of the
old ones; levels in the same neighborhood (mean ≈ −21…−23 dBFS).

## Commands

| Command | What it does |
|---|---|
| `npm run audio:dry` | the buy list + cost estimate; safe, no key needed; **run first, always** |
| `npm run audio:status` | which takes exist on disk; exit 1 if any missing |
| `npm run audio:list` | the account's voices (free call, needs key) |
| `npm run audio:buy` | **SPENDS**: buys exactly what's missing, capped (`--max-credits 200`) |
| `npm run audio:selftest` | 25 checks against a local stub server — proves every guard, the "never pay twice" cache and the #96 `speakText` path (what is SENT vs what the game DISPLAYS) **without any spend** |
| `npm run audio:pagecheck` | (`npm run serve` must be up) 24 headless-Chrome checks that the audition page really plays all six takes: 6/6 ready, every mp3 decodes, byte-exact strings, clean console — free, local, no key |
| `npm run serve` → `tools/audio/voice-test.html` | play page for every take (pending/ready states; add `?dir=../../captures/voice-selftest/` to see a demo with placeholder tones) |

## Where the key lives (unblocked 2026-11-14)

Brandon put the key in a gitignored **`.env.local` at the project repo root**
(`/home/brandon/codeden-projects/look-at-bobo/.env.local`, line
`ELEVENLABS_API_KEY=…`) and approved the paid generation. The tool finds it
from any worktree via `git --git-common-dir` (presence checked only — the key
was never printed, logged, or committed; `.env*` are in `.gitignore`).

The buy has since been made (one run, 6/6 takes, see "What it actually
cost"). The lock in `assets/audio/lock.json` means a re-run of
`npm run audio:buy` finds nothing to buy and spends $0 — safe to run by
accident. Any future generation needs an explicit `--allow-rebuy <line>`,
which is a deliberate, visible re-spend.

## Questions for Brandon (what's decided, what's still yours)

**Decided by the takes now on disk** (changing any of them after the buy is a
deliberate `--allow-rebuy` re-spend, i.e. real money again):

1. **Voice:** since #96 (2026-11-17) bought with **Jessica for all three lines** (Brandon: female voice). Liam/Charlie remain priced-equal alternatives — a one-field manifest edit + rebuy.
2. **Win line voiced vs text-only:** bought **voiced** (the exact text shows on screen either way).
3. **"wind" pronunciation:** since #96 the API receives the respell `winned`, so the spoken word is the breeze ("wihnd"); the on-screen string is untouched. Audition both win takes and confirm — nothing left to rebuy if you hear it right.
4. **"DAG!" flavour:** generated mock-stern and comic with delivery context. Audition both takes.

**V5 — take picks: RESOLVED by delegation (2026-11-14), re-made on the #96
takes (2026-11-17).** Brandon answered the open question with *"You can pick
which takes to use"*, so the picks below were made from measured properties of
the files (loudness, dynamic swing, spectral brightness via band split,
speech/dead-air split via ffmpeg — **not** from hearing them; they're cheap to
overrule: both takes are already paid for, the game just points at one
filename per line, and trimming the small silences is Step 9's job). If a real
listen says otherwise, say the word and the default flips — zero extra credits.

| Line | **Shipped take** | Why (measured) | Fallback on disk |
|---|---|---|---|
| `LOOK AT BOBO!` | **take 2** (1.07 s) | The delighted "look look LOOK" brief: longest speech (0.78 s vs 0.69 — the more drawn-out "looook") and the brighter delivery of the pair (>2.5 kHz band −9.9 vs −12.3 dB under the lows) | take 1 — softer peak (−5.1 vs −3.9 dB) and shorter if the game ever wants speed over glee |
| `DAG!` | **take 2** (0.74 s) | The pettier, punchier dag again: tightest package (0.47 s speech) with far less tail dead air (0.27 vs 0.53 s) — a quick comic correction under the gentle X | take 1 — bigger theatrical swing (crest 21.3 vs 20.8 dB, 0.54 s speech) if you want a deflating "Daaag…" |
| `your did it! you wind` | **take 1** (1.58 s) | The giddier read on every metric: brightest (−6.3 vs −8.9 dB high-band), most dynamic movement (crest 17.7 vs 17.3 dB), longest room for the mangled-grin joke (1.08 s speech) | take 2 — calmer/cooler read, snappier tail, if take 1 comes off too peaked |

Mechanical audition numbers (ffmpeg, 2026-11-17, the Jessica cast; brightness =
mean level above 2.5 kHz minus mean level below it — this run has no centroid
readout, the band split replaces it; the 2026-11-14 Liam numbers left with the
old files, recoverable from git history):

| Take | dur | speech | mean dBFS | peak dBFS | crest | brightness (hi−lo dB) | tail silence |
|---|---|---|---|---|---|---|---|
| yell take1 | 1.11 s | 0.69 s | −21.1 | −5.1 | 16.0 dB | −12.3 | 0.31 s |
| yell take2 ✅ | 1.07 s | 0.78 s | −20.6 | −3.9 | 16.7 dB | −9.9 | 0.29 s |
| dag take1 | 1.07 s | 0.54 s | −22.5 | −1.2 | 21.3 dB | −7.1 | 0.53 s |
| dag take2 ✅ | 0.74 s | 0.47 s | −22.6 | −1.8 | 20.8 dB | −7.6 | 0.27 s |
| win take1 ✅ | 1.58 s | 1.08 s | −21.5 | −3.8 | 17.7 dB | −6.3 | 0.29 s |
| win take2 | 1.44 s | 1.05 s | −22.1 | −4.8 | 17.3 dB | −8.9 | 0.26 s |
