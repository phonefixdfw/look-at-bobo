// tools/export-logo.mjs — rasterise assets/logo/logo.svg (and the 1200×630
// social card) to the PNGs issue #57 ships beside the SVG.
//
//   node tools/export-logo.mjs          # writes every PNG below
//
// The renderer is the same headless Chrome the capture tool drives, and the
// page is served the same way — no image library, no new dependency. The SVG
// is the source of truth; re-run this whenever it changes.
//
//   favicon sizes: logo-16.png, logo-32.png, logo-48.png
//   home-screen:   logo-180.png (apple-touch-icon)
//   social/share:  logo-512.png
//   social card:   logo-social.png (1200×630, the link-preview image)

import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { startStaticServer } from './serve.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets', 'logo');

const FAVICON_SIZES = [16, 32, 48, 180, 512];

function findChrome() {
  const candidates = [
    process.env.LC_CHROME,
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/usr/bin/microsoft-edge',
    '/usr/bin/microsoft-edge-stable',
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p)) || null;
}

/** The social card: the mark, the wordmark, one line about the game. The page
 *  is a real file (tools/logo-social-page.html) served over http, so its
 *  /assets/logo/logo.svg reference resolves exactly like it does in the game. */

const server = await startStaticServer({ root: ROOT });
const executablePath = findChrome();
const browser = await chromium.launch({
  executablePath: executablePath || undefined,
  channel: executablePath ? undefined : 'chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
});
try {
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await context.newPage();

  // The SVG is exported from a real HTML page rather than as a bare SVG
  // document: loading it as a document lets the browser add its own margins,
  // which is exactly what a favicon must not carry. Both pages are served, so
  // /assets/logo/logo.svg resolves the way it does in the game.
  const markPage = (/** @type {number} */ size) => `${server.url}/tools/logo-export.html?size=${size}`;

  for (const size of FAVICON_SIZES) {
    await page.setViewportSize({ width: size, height: size });
    await page.goto(markPage(size), { waitUntil: 'load' });
    const png = await page.screenshot({ type: 'png' });
    writeFileSync(join(OUT, `logo-${size}.png`), png);
    console.log(`logo-${size}.png`);
  }

  await page.setViewportSize({ width: 1200, height: 630 });
  await page.goto(`${server.url}/tools/logo-social-page.html`, { waitUntil: 'load' });
  // let the <img> decode before the shutter
  await page.evaluate(() => {
    const img = document.querySelector('img');
    return img && img.decode ? img.decode() : Promise.resolve();
  });
  const card = await page.screenshot({ type: 'png' });
  writeFileSync(join(OUT, 'logo-social.png'), card);
  console.log('logo-social.png');
} finally {
  await browser.close();
  server.close();
}
