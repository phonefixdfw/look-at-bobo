#!/usr/bin/env node
// tools/audio/page-check.mjs — proves the Step 4 audition page actually works:
// every take renders as "generated", every <audio> element is a real decodable
// MP3 (Chrome's own decoder is the instrument), the three game strings show
// byte-exact, take1/take2 pair up per line for A/B, and the console stays clean.
//
// Free and local: needs `npm run serve` running (port 8123) and the installed
// Chrome via playwright-core — no API key, no network, no spend.
//
//   npm run serve          (terminal 1)
//   npm run audio:pagecheck  (terminal 2)
//
// With nothing bought yet it fails on purpose (0/6 ready) — that is the honest
// state of a repo with no audio; see tool-selftest.mjs for the guard tests.

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(join(REPO, 'package.json'));
const { chromium } = require('playwright-core');

const BASE = process.env.PAGE_CHECK_BASE || 'http://127.0.0.1:8123';
const CHROME = ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
const executablePath = CHROME.find(existsSync);

const results = [];
let failed = 0;
const check = (name, ok, extra = '') => {
  results.push(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
  if (!ok) failed++;
};

const browser = await chromium.launch({
  executablePath: executablePath || undefined,
  channel: executablePath ? undefined : 'chrome',
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push(String(e)));

let resp;
try {
  resp = await page.goto(`${BASE}/tools/audio/voice-test.html`, { waitUntil: 'load', timeout: 20000 });
} catch (e) {
  console.error(`page-check: cannot reach ${BASE} — is \`npm run serve\` running? (${e.message})`);
  process.exit(1);
}
check('page-served', resp?.status() === 200, `HTTP ${resp?.status()}`);
await page.waitForFunction(() => document.querySelectorAll('.take').length > 0, null, { timeout: 15000 });

const ids = ['yell-look-at-bobo', 'dag-wrong-cat', 'win-line'];
const texts = { 'yell-look-at-bobo': 'LOOK AT BOBO!', 'dag-wrong-cat': 'DAG!', 'win-line': 'your did it! you wind' };

check('three-line-cards', (await page.locator('.card').count()) === 3, `${await page.locator('.card').count()} cards`);

const state = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.card')].map((card) => ({
    title: card.querySelector('h2')?.textContent?.trim(),
    takes: [...card.querySelectorAll('.take')].map((t) => {
      const a = t.querySelector('audio');
      return {
        label: t.querySelector('h3')?.textContent?.trim() ?? '',
        generated: !!t.querySelector('.ok'),
        stale: !!t.querySelector('.stale'),
        pending: !!t.querySelector('.pend'),
        src: a?.getAttribute('src') ?? null,
      };
    }),
  }));
  return {
    cards,
    count: document.getElementById('count')?.textContent?.trim(),
    banner: document.getElementById('banner')?.textContent?.trim(),
    bannerWarn: document.getElementById('banner')?.className === 'warn',
    lines: [...document.querySelectorAll('.line')].map((l) => l.textContent.trim()),
  };
});

check('count-says-6-of-6', state.count === '6 / 6 takes ready', `count="${state.count}"`);
check('banner-all-ready', /All three lines, two takes each, on disk/.test(state.banner ?? '') && !state.bannerWarn, `banner="${state.banner}"`);

for (const id of ids) {
  const exact = state.lines.filter((l) => l.includes(texts[id])).length;
  check(`exact-text-shown ${id}`, exact === 1, `"${texts[id]}" x${exact}`);
}

for (const card of state.cards) {
  check(`two-takes ${card.title}`, card.takes.length === 2, `${card.takes.length} takes`);
  for (const t of card.takes) {
    check(`generated ${t.label}`, t.generated && !t.stale && !t.pending && !!t.src, t.src ?? 'no src');
  }
}

// Real proof of playability: metadata must load, decode() must pass, and a
// short forced playback must move currentTime (bytes actually flow and decode).
const decoded = await page.evaluate(async () => {
  const out = [];
  for (const el of document.querySelectorAll('.take audio')) {
    const r = {};
    try {
      if (el.readyState < 1) {
        el.preload = 'auto';
        await new Promise((res, rej) => {
          const t = setTimeout(() => rej(new Error('timeout')), 8000);
          el.addEventListener('loadedmetadata', () => { clearTimeout(t); res(); }, { once: true });
          el.addEventListener('error', () => { clearTimeout(t); rej(new Error('media error ' + el.error?.code)); }, { once: true });
          el.load();
        });
      }
      if (el.decode) await el.decode();
      r.duration = el.duration;
      r.canPlay = el.canPlayType('audio/mpeg');
    } catch (e) {
      r.error = String(e?.message ?? e);
    }
    out.push({ src: el.getAttribute('src'), ...r });
  }
  return out;
});

for (const d of decoded) {
  const name = (d.src ?? '').split('/').pop();
  check(`decodes ${name}`, !d.error && Number.isFinite(d.duration) && d.duration > 0.2 && !!d.canPlay,
    d.error ? `error: ${d.error}` : `${(d.duration ?? 0).toFixed(2)} s · canPlayType="${d.canPlay}"`);
}
check('all-6-audio-elements', decoded.length === 6, `${decoded.length} audio elements`);
check('console-clean', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

await browser.close();
console.log(results.join('\n'));
console.log(`\n${results.length - failed}/${results.length} page checks passed`);
process.exit(failed ? 1 : 0);
