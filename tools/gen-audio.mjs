#!/usr/bin/env node
// tools/gen-audio.mjs — the ONE cost-guarded ElevenLabs tool for Look at Bobo.
//
// Build-a-game rule 5: audio is static files made ahead of time, the game never
// calls the API, and every paid generation goes through this single tool
// ("never pay twice"). The rulebook is docs/VOICES.md; the pre-approved spend
// is exactly the three lines in tools/audio/manifest/step4.json, max 2 takes
// each (issue #7, Brandon 2026-11-14).
//
// Safety model, in order of how much it matters:
//   1. NOTHING SPENDS unless you pass `--buy` AND `--max-credits N`.
//      Default (no flags) = dry run: prints exactly what would be bought and
//      the estimated cost, then stops. Works offline without a key.
//   2. Hard caps, checked before any request goes out: takes per asset
//      (manifest limits.maxTakesPerAsset), paid requests per run
//      (limits.maxPaidRequestsPerRun), and a project credit ceiling
//      (limits.projectCreditsCeiling, cumulative across runs, from the lock).
//   3. Never pay twice: the content hash of each request is recorded in
//      assets/audio/lock.json next to its file; a ready take is never re-bought.
//      Editing the text of an already-recorded line is REFUSED unless you pass
//      `--allow-rebuy <assetId>` — recorded lines are frozen on purpose.
//   4. Byte-exact strings: the three game lines must equal the exact strings
//      below ("DAG!", "your did it! you wind" are spelled on purpose); the
//      tool refuses anything else, like `ending-text-exact` does for the HUD.
//   5. The API key comes from ELEVENLABS_API_KEY, else a gitignored
//      .env/.env.local in this checkout's root, else the main repo root
//      (located via git --git-common-dir — never by scanning $HOME).
//      It is never printed, never logged, never committed; all output redacts it.
//   6. Every paid run writes a ledger file (tools/audio/ledger/) with the
//      subscription balance before/after, so the REAL rate is measured on the
//      first call and compared to the published estimate (docs/VOICES.md).
//
// Usage:
//   npm run audio:dry              print the buy list + cost estimate (no key needed)
//   npm run audio:status           what exists on disk, what's missing
//   npm run audio:list             list this account's voices (free call, key only)
//   npm run audio:buy              = --buy --max-credits 200  (SPENDS — read docs/VOICES.md first)
//
//   node tools/gen-audio.mjs --buy --max-credits N [--manifest p] [--out dir]
//                            [--allow-rebuy <assetId>] [--override-limits "<reason>"]
//
// Dev/test only: ELEVENLABS_API_BASE overrides the API host and ELEVENLABS_ENV_DIR
// the directory searched for .env/.env.local (used by tools/audio/tool-selftest.mjs
// against a local stub; leave both unset for real use).

import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// The three game lines, byte-exact. Any manifest text that differs is a bug or
// a "helpful fix" — both get refused. (Spelling is Brandon's decision.)
const EXACT_STRINGS = {
  'yell-look-at-bobo': 'LOOK AT BOBO!',
  'dag-wrong-cat': 'DAG!',
  'win-line': 'your did it! you wind',
};

// Published API prices, USD per 1,000 characters — verified 2026-11-14 from
// https://elevenlabs.io/pricing/api ("$0.08 per 1,000 characters (multilingual
// models) or $0.04 (Flash/Turbo)"). On subscription plans the app converts
// ~1 credit/character on the top models; the estimate below uses 1 credit per
// billed character as the worst case. The first authenticated run REPLACES
// these numbers with measured facts (ledger balance delta) — trust the ledger.
const USD_PER_1K = {
  eleven_multilingual_v2: 0.08,
  eleven_flash_v2_5: 0.04,
  eleven_turbo_v2_5: 0.04,
  eleven_v4: 0.08,
  eleven_v4_turbo: 0.04,
  eleven_v3: 0.08,
  eleven_v3_conversational: 0.04,
};
const CREDITS_PER_CHAR = 1; // worst-case conversion for the estimate

// ---------------------------------------------------------------- utilities

/** Never let the key escape through any log line. */
let SECRET = '';
function redact(s) {
  return SECRET ? String(s).split(SECRET).join('«redacted-key»') : String(s);
}

function fail(msg) {
  console.error(`\naudio: ${redact(msg)}`);
  process.exit(1);
}

/**
 * Read the key from the environment, then a gitignored .env / .env.local in:
 *   1. this checkout's root (a worktree — where `npm run audio:*` runs), then
 *   2. the main repo root (where Brandon was told to put it) — located
 *      precisely via `git --git-common-dir`, never by scanning.
 * ELEVENLABS_ENV_DIR overrides the search entirely (selftest isolation).
 */
function loadKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim();
  const dirs = [];
  if (process.env.ELEVENLABS_ENV_DIR) {
    dirs.push(process.env.ELEVENLABS_ENV_DIR);
  } else {
    dirs.push(REPO);
    try {
      const common = execSync('git rev-parse --path-format=absolute --git-common-dir', { cwd: REPO, encoding: 'utf8', timeout: 5000 }).trim();
      const mainRoot = resolve(common).replace(/[\\/]\.git$/, '');
      if (mainRoot && mainRoot !== REPO) dirs.push(mainRoot);
    } catch { /* not a git checkout — worktree root alone */ }
  }
  for (const d of dirs) {
    for (const f of ['.env.local', '.env']) {
      const p = join(d, f);
      if (!existsSync(p)) continue;
      for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*ELEVENLABS_API_KEY\s*=\s*(.+?)\s*$/);
        if (m) return m[1].replace(/^["']|["']$/g, '').trim();
      }
    }
  }
  return null;
}

/** fnv-1a → a stable seed in 0..2^32-1 (ElevenLabs accepts best-effort determinism). */
function seedFor(id, take, seedBase) {
  let h = (seedBase >>> 0) ^ 0x811c9dc5;
  for (const ch of `${id}#${take}`) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function sha256(o) {
  return createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 16);
}

function fmtUsd(n) {
  return `$${n.toFixed(n < 1 ? 4 : 2)}`;
}

// ---------------------------------------------------------------- manifest

function loadManifest(path) {
  let m;
  try {
    m = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    fail(`cannot read manifest ${path}: ${e.message}`);
  }
  const ids = new Set();
  for (const a of m.assets) {
    if (ids.has(a.id)) fail(`duplicate asset id "${a.id}" in manifest`);
    ids.add(a.id);
    if (a.id in EXACT_STRINGS && a.text !== EXACT_STRINGS[a.id]) {
      fail(
        `asset "${a.id}" text is ${JSON.stringify(a.text)} but the game string is ` +
          `${JSON.stringify(EXACT_STRINGS[a.id])} (byte-exact, on purpose — see docs/VOICES.md).`,
      );
    }
    if (!a.text?.trim()) fail(`asset "${a.id}" has no text`);
    if (!a.voice?.name && !a.voice?.id) fail(`asset "${a.id}" needs voice.name or voice.id`);
    if (!a.model) fail(`asset "${a.id}" needs a model`);
  }
  return m;
}

/** Every request the manifest asks for: one per asset × take. */
function requestsFor(manifest) {
  const reqs = [];
  for (const a of manifest.assets) {
    for (let take = 1; take <= a.takes; take++) {
      const text = a.text;
      const prev = a.context?.previous_text ?? null;
      const next = a.context?.next_text ?? null;
      const seed = seedFor(a.id, take, a.seedBase ?? 0);
      const billable = text.length + (prev?.length ?? 0) + (next?.length ?? 0); // worst case
      const hash = sha256({
        v: 1,
        text,
        prev,
        next,
        model: a.model,
        format: a.outputFormat,
        seed,
        settings: a.voiceSettings ?? null,
        voice: a.voice.name ?? a.voice.id,
      });
      reqs.push({
        key: `${a.id}#take${take}`,
        assetId: a.id,
        take,
        text,
        prev,
        next,
        model: a.model,
        outputFormat: a.outputFormat ?? 'mp3_44100_128',
        seed,
        settings: a.voiceSettings ?? null,
        voice: a.voice,
        billableChars: billable,
        hash,
        file: `${a.id}.take${take}.mp3`,
      });
    }
  }
  return reqs;
}

// ---------------------------------------------------------------- lock

function lockPath(outDir) {
  return join(outDir, 'lock.json');
}
function loadLock(outDir) {
  if (!existsSync(lockPath(outDir))) return { version: 1, entries: {} };
  return JSON.parse(readFileSync(lockPath(outDir), 'utf8'));
}
function saveLock(outDir, lock) {
  writeFileSync(lockPath(outDir), JSON.stringify(lock, null, 2) + '\n');
}

function estimateOf(reqs) {
  let chars = 0;
  let usd = 0;
  for (const r of reqs) {
    chars += r.billableChars;
    usd += (r.billableChars * (USD_PER_1K[r.model] ?? 0.08)) / 1000;
  }
  return { chars, usd, credits: chars * CREDITS_PER_CHAR };
}

// ---------------------------------------------------------------- API client

function makeApi(key) {
  const base = process.env.ELEVENLABS_API_BASE || 'https://api.elevenlabs.io';
  return async function call(method, path, { body, raw } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: {
        'xi-api-key': key,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(120_000),
    }).catch((e) => {
      throw new Error(`${method} ${path} failed: ${e.message}`);
    });
    if (!res.ok) {
      const t = redact((await res.text().catch(() => '')) || res.statusText).slice(0, 400);
      throw new Error(`${method} ${path} → HTTP ${res.status}: ${t}`);
    }
    if (raw) return res;
    return res.json();
  };
}

async function livePricesNote(api, models) {
  // Free call. Prints the account's own price payload for each model used, so
  // the published table above can be checked (and the ledger then settles it).
  try {
    const { models: list } = await api('GET', '/v1/models');
    for (const id of models) {
      const m = list.find((x) => x.model_id === id);
      console.log(`  model ${id}: ${m ? JSON.stringify(m.prices ?? m.price ?? '(no prices field)') : 'NOT AVAILABLE on this account'}`);
    }
  } catch (e) {
    console.log(`  (couldn't read /v1/models: ${redact(e.message)})`);
  }
}

async function balance(api) {
  // Free call. character_count is credits used this period; the delta across a
  // run is the REAL billed amount — that is how the true rate gets verified.
  try {
    const s = await api('GET', '/v1/user/subscription');
    const sub = s.subscription ?? s;
    return typeof sub.character_count === 'number' ? sub.character_count : null;
  } catch {
    return null;
  }
}

async function resolveVoice(api, voice) {
  if (!voice.name) return { id: voice.id, name: voice.id };
  let list = [];
  try {
    ({ voices: list } = await api('GET', '/v1/voices'));
  } catch (e) {
    console.log(`  (couldn't list voices: ${redact(e.message)} — falling back to idHint)`);
  }
  const want = voice.name.toLowerCase();
  let hit = list.find((v) => (v.name || '').toLowerCase() === want);
  if (!hit) hit = list.find((v) => (v.name || '').split(' - ')[0].toLowerCase() === want);
  if (hit) return { id: hit.voice_id, name: hit.name };
  if (voice.idHint) {
    console.log(
      `  ! voice "${voice.name}" not in this account's list — using idHint ${voice.idHint} ` +
        `(verified against ElevenLabs' public default list on 2026-11-14)`,
    );
    return { id: voice.idHint, name: `${voice.name} (via idHint)` };
  }
  throw new Error(
    `voice "${voice.name}" not found on this account and no idHint given. ` +
      `Run \`npm run audio:list\` to see the voices you have.`,
  );
}

// ---------------------------------------------------------------- commands

function printBuyList(reqs, lock, { buy, key }) {
  const todo = reqs.filter((r) => ready(lock, r) !== 'ready');
  const done = reqs.length - todo.length;
  const est = estimateOf(todo);
  console.log(`\nrequests: ${reqs.length} total, ${done} already paid for (lock), ${todo.length} to buy`);
  for (const r of reqs) {
    const have = ready(lock, r);
    console.log(
      `  ${have === 'ready' ? '[have]' : have === 'stale' ? '[STALE — text changed since it was recorded]' : '[buy ]'} ` +
        `${r.key.padEnd(24)} ${String(r.billableChars).padStart(3)} chars  ${r.model}  seed ${r.seed}`,
    );
  }
  console.log(`\nestimate for the ${todo.length} to buy (published rates, 2026-11-14):`);
  console.log(`  ${est.chars} characters billed (worst case, incl. delivery context)`);
  console.log(`  ≈ ${fmtUsd(est.usd)} at $0.08/1k chars  ·  ≈ ${est.credits} credits (≤1/char worst case)`);
  if (!key) {
    console.log('  (offline estimate — the first run with a key shows the account prices and measures the real rate)');
  }
  if (buy) console.log(`\nthis run is capped at --max-credits and the manifest project ceiling; the ledger records what actually got billed.`);
  else console.log(`\nDRY RUN — nothing was bought. Buy with: node tools/gen-audio.mjs --buy --max-credits 200`);
  return { todo, est };
}

/** 'ready' | 'stale' | 'missing' for a request against the lock + disk. */
function ready(lock, req) {
  const e = lock.entries[req.key];
  if (!e) return 'missing';
  if (e.hash !== req.hash) return 'stale';
  return existsSync(join(lock.__outDir, req.file)) ? 'ready' : 'missing';
}

async function cmdStatus(manifest, outDir) {
  const reqs = requestsFor(manifest);
  const lock = loadLock(outDir);
  lock.__outDir = outDir;
  console.log(`\nout dir: ${outDir}`);
  let readyN = 0;
  for (const r of reqs) {
    const st = ready(lock, r);
    if (st === 'ready') readyN++;
    const e = lock.entries[r.key];
    const size = st === 'ready' ? ` ${(statSync(join(outDir, r.file)).size / 1024).toFixed(1)} KB` : '';
    console.log(`  ${st === 'ready' ? 'OK    ' : st === 'stale' ? 'STALE ' : 'MISSING'} ${r.key.padEnd(24)}${size}${e && st === 'ready' ? `  voice: ${e.voiceName}` : ''}`);
  }
  console.log(`\n${readyN}/${reqs.length} takes on disk. Ledger runs: ${listLedgers()}`);
  process.exit(readyN === reqs.length ? 0 : 1);
}

function listLedgers() {
  const dirs = [LedgerDirOverride ?? join(REPO, 'tools', 'audio', 'ledger')];
  const files = dirs.filter(existsSync).flatMap((d) => readdirSync(d).filter((f) => f.endsWith('.json')));
  return files.length ? `${files.length} file(s) in ${dirs[0]}` : 'none';
}

// ---------------------------------------------------------------- buy

async function cmdBuy(manifest, { maxCredits, outDir, allowRebuy, overrideLimits, dry }) {
  const reqs = requestsFor(manifest);
  const lock = loadLock(outDir);
  lock.__outDir = outDir;
  const limits = manifest.limits ?? {};

  // --- cap checks BEFORE anything can spend ---
  const problems = [];
  if (dry) problems.push('--dry-run cannot be combined with --buy (that is the point of --dry-run)');
  if (typeof maxCredits !== 'number' || !(maxCredits > 0))
    problems.push('--buy requires --max-credits N (a real number). Nothing was and will be bought.');
  const stale = reqs.filter((r) => ready(lock, r) === 'stale');
  if (stale.length) {
    const ids = [...new Set(stale.map((r) => r.assetId))];
    if (!allowRebuy) {
      problems.push(
        `recorded lines changed: ${ids.join(', ')}. Recorded takes are frozen so a typo edit can never ` +
          `silently re-bill. If the change is intentional, re-run with --allow-rebuy ${ids[0]}.`,
      );
    }
  }
  let todo = reqs.filter((r) => {
    const st = ready(lock, r);
    if (st === 'ready') return false;
    if (st === 'stale' && !(allowRebuy && allowRebuyMatch(allowRebuy, r.assetId))) return false;
    return true;
  });
  const tooManyTakes = manifest.assets.filter((a) => a.takes > (limits.maxTakesPerAsset ?? Infinity));
  if (tooManyTakes.length && !overrideLimits)
    problems.push(`assets over the max of ${limits.maxTakesPerAsset} takes: ${tooManyTakes.map((a) => a.id).join(', ')} (needs --override-limits "<reason>")`);
  if (todo.length > (limits.maxPaidRequestsPerRun ?? Infinity) && !overrideLimits)
    problems.push(`${todo.length} requests to buy exceeds maxPaidRequestsPerRun=${limits.maxPaidRequestsPerRun} (needs --override-limits "<reason>")`);
  const est = estimateOf(todo);
  if (typeof maxCredits === 'number' && est.credits > maxCredits)
    problems.push(`estimated ${est.credits} credits exceeds --max-credits ${maxCredits}`);
  const spentSoFar = Object.values(lock.entries).reduce((n, e) => n + (e.billableChars ?? 0), 0) * CREDITS_PER_CHAR;
  const ceiling = limits.projectCreditsCeiling ?? Infinity;
  if (spentSoFar + est.credits > ceiling)
    problems.push(`this run would push cumulative spend ${spentSoFar + est.credits} credits past the project ceiling of ${ceiling} (docs/HANDOFF.md §5)`);
  if (problems.length) {
    console.error('\nREFUSING TO SPEND:');
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exit(1);
  }
  if (!todo.length) {
    console.log('\nnothing to buy — every recorded take is paid for and on disk (never pay twice).');
    return;
  }

  const key = loadKey();
  if (!key) {
    fail(
      'no ELEVENLABS_API_KEY in the environment or in .env/.env.local (worktree root or main repo root).\n' +
        '        Nothing was bought. See docs/VOICES.md ("Getting unblocked").',
    );
  }
  SECRET = key;
  const api = makeApi(key);

  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const ledgerDir = LedgerDirOverride ?? join(REPO, 'tools', 'audio', 'ledger');
  mkdirSync(ledgerDir, { recursive: true });
  const ledgerFile = join(ledgerDir, `${runId}.json`);
  const ledger = {
    runId,
    command: process.argv.slice(2).map(redact),
    maxCredits,
    ceiling,
    estimate: { ...est, requests: todo.length },
    balanceCharsBefore: null,
    balanceCharsAfter: null,
    creditsBilledActual: null,
    requests: [],
    finishedAt: null,
  };
  writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2) + '\n');
  const bump = () => writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2) + '\n');

  console.log(`\nbuying ${todo.length} request(s) · est ${est.credits} credits / ${fmtUsd(est.usd)} · ceiling ${ceiling} · ledger ${ledgerFile}`);
  const balBefore = await balance(api);
  ledger.balanceCharsBefore = balBefore;
  bump();

  mkdirSync(outDir, { recursive: true });
  const models = [...new Set(todo.map((r) => r.model))];
  await livePricesNote(api, models);
  bump();

  const voiceCache = {};
  for (const r of todo) {
    const t0 = Date.now();
    let voice;
    try {
      voice = voiceCache[r.voice.name ?? r.voice.id] ?? (voiceCache[r.voice.name ?? r.voice.id] = await resolveVoice(api, r.voice));
    } catch (e) {
      ledger.requests.push({ key: r.key, status: 'voice-resolution-failed', error: redact(e.message) });
      bump();
      fail(`${r.key}: ${e.message} — stopping before any further spend.`);
    }
    const body = {
      text: r.text,
      model_id: r.model,
      seed: r.seed,
      ...(r.prev ? { previous_text: r.prev } : {}),
      ...(r.next ? { next_text: r.next } : {}),
      ...(r.settings ? { voice_settings: r.settings } : {}),
    };
    console.log(`  → ${r.key}  voice "${voice.name}"  ${r.billableChars} chars …`);
    let res;
    try {
      res = await api('POST', `/v1/text-to-speech/${voice.id}?output_format=${r.outputFormat}`, { body, raw: true });
    } catch (e) {
      ledger.requests.push({ key: r.key, voiceId: voice.id, status: 'http-error', error: redact(e.message), ms: Date.now() - t0 });
      bump();
      fail(`${r.key}: ${redact(e.message)}\n        Stopped immediately — nothing else was and will be bought in this run. Check the ledger.`);
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.startsWith('audio/')) {
      ledger.requests.push({ key: r.key, voiceId: voice.id, status: 'not-audio', contentType: ct, body: redact(bytes.toString('utf8').slice(0, 300)) });
      bump();
      fail(`${r.key}: expected audio, got "${ct}". Nothing written. Stopped before further spend.`);
    }
    const file = join(outDir, r.file);
    writeFileSync(file, bytes);
    lock.entries[r.key] = {
      hash: r.hash,
      file: r.file,
      text: r.text,
      model: r.model,
      seed: r.seed,
      settings: r.settings,
      voiceId: voice.id,
      voiceName: voice.name,
      billableChars: r.billableChars,
      bytes: bytes.length,
      requestId: res.headers.get('request-id') ?? res.headers.get('x-request-id') ?? null,
      generatedAt: new Date().toISOString(),
    };
    saveLock(outDir, (() => { const l = { ...lock }; delete l.__outDir; return l; })());
    ledger.requests.push({ key: r.key, voiceId: voice.id, status: 'ok', chars: r.billableChars, bytes: bytes.length, ms: Date.now() - t0, requestId: lock.entries[r.key].requestId });
    bump();
    console.log(`     ✓ ${(bytes.length / 1024).toFixed(1)} KB → ${r.file}`);
  }

  const balAfter = await balance(api);
  ledger.balanceCharsAfter = balAfter;
  ledger.creditsBilledActual =
    balBefore != null && balAfter != null ? balAfter - balBefore : 'balance endpoint unavailable — check the ElevenLabs usage page once';
  ledger.finishedAt = new Date().toISOString();
  bump();
  console.log(`\ndone. est ${est.credits} credits · actually billed ${ledger.creditsBilledActual} credits (${balBefore} → ${balAfter}).`);
  console.log(`If the actual number disagrees with docs/VOICES.md's published-rate estimate, fix the doc — the ledger is ground truth.`);
  console.log(`Ledger: ${ledgerFile}`);
}

function allowRebuyMatch(spec, assetId) {
  return spec === 'all' || spec === assetId;
}

let LedgerDirOverride = null;

// ---------------------------------------------------------------- main

async function main() {
  const argv = process.argv.slice(2);
  const flag = (n) => argv.indexOf(n);
  const arg = (n) => (flag(n) > -1 ? argv[flag(n) + 1] : undefined);

  const manifestPath = resolve(arg('--manifest') ?? join(REPO, 'tools', 'audio', 'manifest', 'step4.json'));
  const outDir = resolve(arg('--out') ?? join(REPO, 'assets', 'audio'));
  LedgerDirOverride = arg('--ledger-dir') ? resolve(arg('--ledger-dir')) : null;
  const manifest = loadManifest(manifestPath);
  const key = loadKey();
  if (key) SECRET = key;
  const api = key ? makeApi(key) : null;

  if (flag('--list-voices') > -1) {
    if (!api) fail('--list-voices needs the API key (environment or .env).');
    const { voices } = await api('GET', '/v1/voices');
    console.log(`${voices.length} voices on this account (free call):\n`);
    for (const v of voices) console.log(`  ${v.name.padEnd(55)} ${v.voice_id.padEnd(24)} ${v.category ?? ''}`);
    return;
  }

  if (flag('--status') > -1) return cmdStatus(manifest, outDir);

  const buy = flag('--buy') > -1;
  const reqs = requestsFor(manifest);
  const lock = loadLock(outDir);
  lock.__outDir = outDir;

  if (buy) {
    return cmdBuy(manifest, {
      maxCredits: Number(arg('--max-credits')),
      outDir,
      allowRebuy: arg('--allow-rebuy'),
      overrideLimits: arg('--override-limits'),
      dry: flag('--dry-run') > -1,
    });
  }

  // default: dry run
  console.log(`\nLook at Bobo — step 4 voice manifest: ${manifestPath}`);
  const { todo, est } = printBuyList(reqs, lock, { buy: false, key });
  if (api) {
    console.log('\nlive check (free calls, no spend):');
    await livePricesNote(api, [...new Set(todo.map((r) => r.model))]);
    const b = await balance(api);
    console.log(`  subscription credits used so far: ${b ?? 'unreadable'}`);
  }
  console.log(`\ntotal if all ${todo.length} were bought: ${est.credits} credits ≈ ${fmtUsd(est.usd)} — within the ${manifest.limits?.projectCreditsCeiling} credit ceiling and Brandon's "2 takes per line" approval.`);
}

main().catch((e) => fail(e.stack ?? e.message));
