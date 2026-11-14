#!/usr/bin/env node
// tools/audio/tool-selftest.mjs — proves tools/gen-audio.mjs keeps its promises
// WITHOUT spending a cent: every call hits a local stub server that returns a
// tiny generated MP3 instead of ElevenLabs. Same spirit as tools/gate.mjs:
// named checks, exit 1 on any failure.
//
//   npm run audio:selftest
//
// It proves: the buy path writes files+lock+ledger and measures a real rate
// (stub balance delta); cache never re-buys; dry-run spends nothing;
// --max-credits, the per-asset take cap and the per-run request cap refuse;
// recorded lines are frozen (stale text/settings refused, --allow-rebuy re-buys
// only that asset); the exact-string guard bites; and a server that echoes the
// API key back in an error can never leak it into the tool's output.

import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const TOOL = join(REPO, 'tools', 'gen-audio.mjs');
const MANIFEST = join(HERE, 'manifest', 'step4.json');

// --- a real (tiny) mp3 for the stub to hand back ---------------------------
function tinyMp3() {
  const p = mkdtempSync(join(tmpdir(), 'lc-mp3-'));
  const f = join(p, 't.mp3');
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i',
    'sine=frequency=440:duration=0.3', '-b:a', '128k', '-y', f], { timeout: 30_000 });
  if (r.status !== 0 || !existsSync(f)) {
    return Buffer.from('ID3\x03\x00\x00\x00\x00\x00\x00stub-audio-not-real-mp3'); // content-type is what the tool checks
  }
  const b = readFileSync(f);
  rmSync(p, { recursive: true, force: true });
  return b;
}

// --- the stub ---------------------------------------------------------------
const state = { posts: 0, charsUsed: 5000, mp3: tinyMp3(), voices: [{ voice_id: 'VOICE-STUB-LIAM', name: 'Liam - Stub Voice', category: 'premade' }] };

const stub = createServer((req, res) => {
  const url = new URL(req.url, 'http://stub');
  const key = req.headers['xi-api-key'] ?? '';
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    if (url.pathname === '/v1/voices') return json({ voices: state.voices });
    if (url.pathname === '/v1/models')
      return json({ models: [{ model_id: 'eleven_multilingual_v2', name: 'stub', can_do_text_to_speech: true, prices: [{ price_currency: 'USD', prices: { character: 0.00008 } }] }] });
    if (url.pathname === '/v1/user/subscription') return json({ subscription: { tier: 'stub', character_count: state.charsUsed } });
    if (req.method === 'POST' && url.pathname.startsWith('/v1/text-to-speech/')) {
      state.posts++;
      if (key === 'TRIGGER-REDACT-TEST') {
        // a badly-behaved server echoes the key back in the error — the tool must redact it
        return res.writeHead(500, { 'content-type': 'application/json' }).end(JSON.stringify({ detail: `invalid key: ${key}` }));
      }
      try {
        const b = JSON.parse(body);
        state.charsUsed += (b.text?.length ?? 0) + (b.previous_text?.length ?? 0) + (b.next_text?.length ?? 0);
      } catch { /* ignore */ }
      res.writeHead(200, { 'content-type': 'audio/mpeg', 'request-id': `stub-${state.posts}` });
      return res.end(state.mp3);
    }
    res.writeHead(404).end('stub: no route ' + url.pathname);
  });
  function json(o) { res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(o)); }
});
await new Promise((r) => stub.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${stub.address().port}`;

// --- run helpers ------------------------------------------------------------
const tmp = mkdtempSync(join(tmpdir(), 'lc-audio-selftest-'));
const ENV_DIR = join(tmp, 'empty-repo'); // keeps the run blind to any real .env
mkdirSync(ENV_DIR);

// async on purpose: the stub server answers the tool's requests on THIS event
// loop — spawnSync would block it and the child would hang forever.
function runTool({ args, out, key = 'stub-key-not-secret', env = {} }) {
  const child = spawn(process.execPath, [TOOL, '--manifest', args.manifest ?? MANIFEST, '--out', out, '--ledger-dir', join(out, '..', 'ledger'), ...args.extra ?? []], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ELEVENLABS_API_KEY: key,
      ELEVENLABS_API_BASE: BASE,
      ELEVENLABS_ENV_DIR: ENV_DIR,
      ...env,
    },
  });
  let out$ = '';
  child.stdout.on('data', (c) => (out$ += c));
  child.stderr.on('data', (c) => (out$ += c));
  const kill = setTimeout(() => child.kill('SIGKILL'), 60_000);
  return new Promise((res) => child.once('close', (code) => { clearTimeout(kill); res({ code, out: out$ }); }));
}

const checks = [];
function check(name, ok, note = '') {
  checks.push({ name, ok, note });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${note ? ` — ${note}` : ''}`);
}

function freshManifest(mutate) {
  const m = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  mutate(m);
  const p = join(tmp, `m-${checks.length}-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(p, JSON.stringify(m, null, 2));
  return p;
}

// 1. dry run spends nothing
{
  const out = join(tmp, 'r1');
  const r = await runTool({ args: { extra: [] }, out, key: 'stub-key-not-secret' });
  check('dry-run-exits-0', r.code === 0, `exit ${r.code}`);
  check('dry-run-zero-spend', state.posts === 0 && !existsSync(join(out, 'lock.json')), `stub POSTs=${state.posts}`);
  check('dry-run-shows-estimate', /estimate for the 6 to buy/i.test(r.out) && /characters billed/i.test(r.out));
}

// 2. full buy
{
  const out = join(tmp, 'r2', 'audio');
  const before = state.posts;
  const r = await runTool({ args: { extra: ['--buy', '--max-credits', '200'] }, out });
  check('buy-exits-0', r.code === 0, `exit ${r.code}\n${r.out.slice(-500)}`);
  check('buy-posted-exactly-6', state.posts - before === 6, `stub POSTs=${state.posts - before} (expected 6: 3 lines × 2 takes)`);
  const files = existsSync(out) ? readdirSync(out).filter((f) => f.endsWith('.mp3')) : [];
  check('buy-wrote-6-mp3s', files.length === 6, files.join(', '));
  const lock = JSON.parse(readFileSync(join(out, 'lock.json'), 'utf8'));
  const entries = Object.values(lock.entries);
  check('lock-has-6-entries', entries.length === 6);
  check('lock-resolved-voice-name', entries.every((e) => e.voiceId === 'VOICE-STUB-LIAM' && e.voiceName.includes('Liam')));
  check('lock-kept-exact-text', lock.entries['dag-wrong-cat#take1'].text === 'DAG!' && lock.entries['win-line#take1'].text === 'your did it! you wind');
  const ledgers = readdirSync(join(tmp, 'r2', 'ledger'));
  const led = JSON.parse(readFileSync(join(tmp, 'r2', 'ledger', ledgers.find((f) => f.endsWith('.json'))), 'utf8'));
  check('ledger-six-ok', led.requests.filter((q) => q.status === 'ok').length === 6);
  check('ledger-measured-real-rate', typeof led.creditsBilledActual === 'number' && led.creditsBilledActual > 0, `actual=${led.creditsBilledActual} credits vs estimate ${led.estimate.credits}`);
  check('no-key-never-reached-disk', !JSON.stringify(led).includes('stub-key-not-secret'), 'ledger is key-free');

  // 3. cache: the same run re-buys nothing
  const p2 = state.posts;
  const r2 = await runTool({ args: { extra: ['--buy', '--max-credits', '200'] }, out });
  check('cache-never-rebuys', state.posts === p2 && /nothing to buy/i.test(r2.out), `stub POSTs=${state.posts - p2}`);

  // 4. settings drift marks takes stale and is refused without --allow-rebuy
  const staleManifest = freshManifest((m) => { m.assets[1].voiceSettings.style = 0.7; });
  const r3 = await runTool({ args: { manifest: staleManifest, extra: ['--buy', '--max-credits', '200'] }, out });
  check('stale-entry-refused', r3.code === 1 && /frozen/i.test(r3.out) && state.posts === p2, `stub POSTs=${state.posts - p2}`);
  const r4 = await runTool({ args: { manifest: staleManifest, extra: ['--buy', '--max-credits', '200', '--allow-rebuy', 'dag-wrong-cat'] }, out });
  check('allow-rebuy-rebuys-only-that', r4.code === 0 && state.posts - p2 === 2, `stub POSTs=${state.posts - p2} (expected 2 takes of dag only)`);
}

// 5. caps refuse before any spend
{
  const before = state.posts;
  const r5 = await runTool({ args: { extra: ['--buy', '--max-credits', '10'] }, out: join(tmp, 'r5') });
  check('max-credits-refused', r5.code === 1 && /REFUSING TO SPEND/.test(r5.out) && state.posts === before);
  const r6 = await runTool({ args: { extra: ['--buy'] }, out: join(tmp, 'r6') });
  check('buy-needs-max-credits', r6.code === 1 && /requires --max-credits/.test(r6.out) && state.posts === before);
  const moreTakes = freshManifest((m) => { m.assets[0].takes = 3; });
  const r7 = await runTool({ args: { manifest: moreTakes, extra: ['--buy', '--max-credits', '200'] }, out: join(tmp, 'r7') });
  check('takes-cap-refused', r7.code === 1 && /over the max of 2 takes/.test(r7.out) && state.posts === before);
  const r8 = await runTool({ args: { manifest: moreTakes, extra: ['--buy', '--max-credits', '200'] }, out: join(tmp, 'r8'), key: 'stub' });
  check('request-cap-refused-too', /maxPaidRequestsPerRun/.test(r8.out), '7 requests > per-run cap of 6, both guards fire');
}

// 6. exact-string guard
{
  const bad = freshManifest((m) => { m.assets.find((a) => a.id === 'win-line').text = 'you did it! you win'; });
  const before = state.posts;
  const r9 = await runTool({ args: { manifest: bad, extra: [] }, out: join(tmp, 'r9') });
  check('exact-string-guard', r9.code === 1 && /byte-exact/.test(r9.out) && state.posts === before);
}

// 7. buy refuses politely when there is no key anywhere
{
  const before = state.posts;
  const r10 = await runTool({ args: { extra: ['--buy', '--max-credits', '200'] }, out: join(tmp, 'r10'), key: '' });
  check('no-key-refuses-buy', r10.code === 1 && /no ELEVENLABS_API_KEY/.test(r10.out) && state.posts === before);
}

// 8. a leaky server can't make the tool print the key
{
  const before = state.posts;
  const r11 = await runTool({ args: { extra: ['--buy', '--max-credits', '200'] }, out: join(tmp, 'r11'), key: 'TRIGGER-REDACT-TEST' });
  check('key-redacted-in-output', r11.code === 1 && !r11.out.includes('TRIGGER-REDACT-TEST') && r11.out.includes('«redacted-key»'), `stub POSTs=${state.posts - before}`);
  const ledDir = join(tmp, 'r11', 'ledger');
  const leak = existsSync(ledDir) && readdirSync(ledDir).some((f) => readFileSync(join(ledDir, f), 'utf8').includes('TRIGGER-REDACT-TEST'));
  check('key-redacted-in-ledger', !leak);
}

// --- verdict ----------------------------------------------------------------
const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
for (const f of failed) console.log(`  FAILED: ${f.name} ${f.note}`);
stub.close();
rmSync(tmp, { recursive: true, force: true });
process.exit(failed.length ? 1 : 0);
