# Look at Bobo — Voices (Step 4)

> The cast sheet, cost plan and rulebook for the game's three voice lines.
> The one paid audio tool is `tools/gen-audio.mjs` (rule: the game plays static
> files and **never** calls the API; every paid generation goes through this one
> cost-guarded tool). Test page: `tools/audio/voice-test.html` (`npm run serve`).
>
> **Status (2026-11-14): ✅ GENERATED — all 6 takes bought in ONE run**
> (3 lines × 2 takes, zero failures, zero retries; ledger
> `tools/audio/ledger/2026-11-14T22-17-51-472Z.json`). Files are on disk in
> `assets/audio/` (committed, 131 KB total) and play on the audition page
> (`npm run serve` → voice-test page). Real cost: **60 credits posted ≈ $0.005**
> (measured, was 250 of 10,000 before → 310 after) against a 150-credit /
> $0.012 worst-case estimate — see "What it actually cost".
> **V5 take picks recorded (PROVISIONAL, on Brandon's delegation): take 1 for
> all three lines** — no human has listened yet; the picks live in
> `assets/audio/lock.json` → `chosen` and flipping one costs $0 (both takes of
> every line are already paid for). Details + how to change: V5 below.

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
| The player (all 3 lines) | **Liam** — "Energetic, Social Media Creator" (`TX3LPaxmHKxFdv7VOQHJ`) | **Charlie** — "Deep, Confident, Energetic" (`IKne3meq5aSn9XLyUdCD`); **Jessica** — "Playful, Bright, Warm" (`cgSgspJ2msm6clMCkdW9`) | Liam is exactly the "watch my cat do a thing!" energy the game is built on. Charlie = deeper, more theatrical; Jessica = the player as a different person. Voice ids were read live from ElevenLabs' public default list (`GET /v1/voices`, 2026-11-14). |

The voice **was resolved by name at buy time and it worked**: the account's own
`GET /v1/voices` returned `Liam - Energetic, Social Media Creator`
(`TX3LPaxmHKxFdv7VOQHJ`) and all 6 takes were bought with it (verified in
`assets/audio/lock.json`). The idHint path was never needed.

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
| win line | 0.35 | 0.55 | 0.8 | giddy, a bit breathless; reads the mangled spelling as written ("wind" rhymes with "win") |

Seeds are deterministic (`gen-audio.mjs` fnv-hash of line+take) so a take is
reproducible in principle; take 1 and take 2 use different seeds so the two
takes are genuinely different performances, not copies.

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
| `your did it! you wind` | 21 | 42 |
| **Total, all 6 requests** | | **150 chars ≈ 150 credits ≈ $0.012** |

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
- Exact-string guard on the three lines (see above).
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

Actual takes (durations measured by ffprobe and re-measured by Chrome's decoder
in the audition page — identical):

| File | Text | Duration | Size | Seed |
|---|---|---|---|---|
| `yell-look-at-bobo.take1.mp3` | `LOOK AT BOBO!` | 1.44 s | 23.7 KB | 1876062199 |
| `yell-look-at-bobo.take2.mp3` | `LOOK AT BOBO!` | 1.25 s | 20.5 KB | 1892839818 |
| `dag-wrong-cat.take1.mp3` | `DAG!` | 0.98 s | 16.4 KB | 633787340 |
| `dag-wrong-cat.take2.mp3` | `DAG!` | 0.84 s | 13.9 KB | 684120197 |
| `win-line.take1.mp3` | `your did it! you wind` | 1.67 s | 27.0 KB | 2452163117 |
| `win-line.take2.mp3` | `your did it! you wind` | 1.86 s | 30.2 KB | 2401830260 |

**131 KB total for the whole cast** — plain static files, small enough for the
web with no build step. **No post-processing in step 4** (loudness and
mix are step 9's job). Step 5 will add character-level timestamps for lip-sync
(a different endpoint) — deliberately not paid for now.

## Commands

| Command | What it does |
|---|---|
| `npm run audio:dry` | the buy list + cost estimate; safe, no key needed; **run first, always** |
| `npm run audio:status` | which takes exist on disk; exit 1 if any missing |
| `npm run audio:list` | the account's voices (free call, needs key) |
| `npm run audio:buy` | **SPENDS**: buys exactly what's missing, capped (`--max-credits 200`) |
| `npm run audio:selftest` | 23 checks against a local stub server — proves every guard and the "never pay twice" cache **without any spend** |
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

1. **Voice:** bought with **Liam for all three lines** (the suggested default; alternatives Charlie / Jessica were priced the same and remain a one-field manifest edit + rebuy).
2. **Win line voiced vs text-only:** bought **voiced** (the exact text shows on screen either way).
3. **"wind" pronunciation:** generated as written ("wihnd", rhymes with "win" — the joke). Audition both win takes and confirm you hear the joke; a "wynd" respell would be a rebuy.
4. **"DAG!" flavour:** generated mock-stern and comic with delivery context. Audition both takes.

**V5 — take picks: recorded, PROVISIONAL — take 1 for all three lines.**
On Brandon's delegation the project manager recorded **take 1 of every line**
(2026-11-14): `LOOK AT BOBO!` t1 · `DAG!` t1 · `your did it! you wind` t1.
**Provisional means no human has listened yet** — and note the mechanical
audition below actually favored *take 2* for `DAG!` and the win line, so give
take 2 a listen before the picks harden. The picks live in
**`assets/audio/lock.json` → `chosen`**; both take files stay in the repo, so
**flipping a pick costs $0 and needs no API call** — say e.g.
**"yell 2, dag 1, win 2"** or edit that field. (An earlier agent made
measured-mechanical picks of yell t1 / DAG t2 / win t2; the PM's take-1 set
supersedes it as the shipped default.)

Mechanical audition numbers (ffmpeg, 2026-11-14 — reference for the human
listen; `speech` excludes head/tail silence, `crest` = dynamic swing,
`centroid` = brightness):

| Take | dur | speech | mean dBFS | peak dBFS | crest | centroid | tail silence |
|---|---|---|---|---|---|---|---|
| yell t1 ✅ chosen | 1.44 s | 1.14 s | −21.3 | −6.8 | 14.5 dB | 2,991 Hz | 0.30 s |
| yell t2 | 1.25 s | 1.00 s | −20.6 | −6.2 | 14.4 dB | 2,563 Hz | 0.25 s |
| dag t1 ✅ chosen | 0.98 s | 0.40 s | −25.1 | −6.5 | **18.6 dB** | 5,456 Hz | 0.51 s |
| dag t2 | 0.84 s | 0.38 s | −21.6 | −4.7 | 16.9 dB | 5,026 Hz | 0.38 s |
| win t1 ✅ chosen | 1.67 s | 1.34 s | −23.2 | −8.4 | 14.8 dB | 2,804 Hz | 0.28 s |
| win t2 | 1.86 s | 1.51 s | −23.0 | −6.8 | 16.2 dB | 4,018 Hz | 0.31 s |

What the numbers suggest while you listen: chosen **yell t1** is the brighter,
more drawn-out delighted read; **dag t1** has the biggest theatrical swing
(crest 18.6 dB — a "DAG…!" that deflates; t2 is the punchier pettier one);
**win t1** is the cooler read (t2 is brighter and more dynamic if the win needs
more giddy). Trimming the small silences is Step 9's job whatever gets chosen.
