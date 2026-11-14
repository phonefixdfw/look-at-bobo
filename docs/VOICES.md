# Look at Bobo — Voices (Step 4)

> The cast sheet, cost plan and rulebook for the game's three voice lines.
> The one paid audio tool is `tools/gen-audio.mjs` (rule: the game plays static
> files and **never** calls the API; every paid generation goes through this one
> cost-guarded tool). Test page: `tools/audio/voice-test.html` (`npm run serve`).
>
> **Status (2026-11-14): prepared, nothing bought — blocked on a missing
> `ELEVENLABS_API_KEY`.** Everything that can be built without the key is built
> and self-tested (`npm run audio:selftest`, 23/23). Spend so far: **$0**.
> See "Getting unblocked" at the bottom.

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

## Files produced (on a successful buy)

```
assets/audio/
  yell-look-at-bobo.take1.mp3   take2.mp3
  dag-wrong-cat.take1.mp3       take2.mp3
  win-line.take1.mp3            take2.mp3
  lock.json                     # hash, voice, seed, bytes, date per take (committed)
tools/audio/ledger/<run>.json   # one file per paid run: estimate, per-request
                                # results, balance before/after (committed)
```

Format is `mp3_44100_128` — small enough for the web (each take is a short one
or two second clip, a few tens of KB) and the standard default; no 192k/44.1
formats that need higher tiers. **No post-processing in step 4** (loudness and
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
| `npm run serve` → `tools/audio/voice-test.html` | play page for every take (pending/ready states; add `?dir=../../captures/voice-selftest/` to see a demo with placeholder tones) |

## Getting unblocked (blocked on: the API key is not visible where Brandon put it)

Checked 2026-11-14, presence only, never printed:

1. Process environment of this session and its parents (`ELEVENLABS_API_KEY`) — **not set**.
2. Gitignored `.env` / `.env.local` at the worktree root and at the project repo root (`~/codeden-projects/look-at-bobo`) — **neither file exists**.

To unblock, either put the key where the previous Step-4 attempt was also told
to look — **`.env` in the project repo root** (already gitignored, and the tool
finds it from any worktree via `git --git-common-dir`):

```
# /home/brandon/codeden-projects/look-at-bobo/.env
ELEVENLABS_API_KEY=...
```

— or export `ELEVENLABS_API_KEY` in the environment the agent runs in (a `.env`
in a worktree root also works, but worktrees are ephemeral — the repo root is
the durable spot).

Then: `npm run audio:dry` (read the estimate + live account prices),
`npm run audio:buy`, `npm run audio:status`, and play all six takes on the
voice-test page. Nothing here needs Brandon's further approval — the spend was
pre-approved for exactly these lines — but the dry-run estimate stays above the
buy command in the transcript on purpose.

## Questions for Brandon (suggested defaults in bold)

1. **Voice:** happy with **Liam for all three lines**, or prefer Charlie / Jessica (or a voice from your own ElevenLabs account — `npm run audio:list` shows them)?
2. **Win line voiced vs text-only:** default **voiced** (plus the exact text on screen either way).
3. **"wind" pronunciation:** default lets the model read it as written ("wihnd", rhymes with "win" — the joke). Want "wynd" (like the wind) instead? That needs a respell-for-audio variant, tell me before the buy.
4. **"DAG!" flavour:** default is mock-stern and comic with delivery context. Too soft / too mean? Cheapest to fix before the buy (the first two takes are the approval).
