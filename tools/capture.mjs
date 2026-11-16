#!/usr/bin/env node
// tools/capture.mjs — the eyes of this project.
//
// It opens any page of this project headless, jumps to an exact moment and time,
// renders one frame, screenshots it, and measures it. Exits non-zero when
// something is wrong, so it works as a gate: "looks fine" is not proof.
//
//   node tools/capture.mjs [page] [options]
//
//   page                 path to a page in this project (default tools/testscene.html),
//                        or pass --url for something already being served
//   --times 0,2.4,5      seconds to seek to (default: 3 samples across LC.duration)
//   --views a,b          camera views (default: every view the page declares)
//   --moments a,b        moments to jump to (default: every moment the page
//                        declares; a page with a spot pool also accepts spot ids)
//   --out captures/name  output folder (default captures/<page-name>)
//   --size 1280x720      viewport
//   --selftest           run LC.selfTest() and gate on it (default: on, if the page has it)
//   --no-selftest        do not gate on selfTest
//   --determinism        re-render every frame and require byte-identical PNGs
//   --gpu swiftshader    CPU rendering: a pessimistic "weak laptop" smoke test
//   --budget k=v,...     override the performance budget (drawCalls, triangles, passes,
//                        shadowLights, realLights)
//   --param k=v          extra query-string param for the page (repeatable).
//                        The test scene supports ?plant=lift|sink|text to inject a fault
//   --url http://...     capture an already-served page instead of serving this folder
//   --timeout 30000      ms to wait for LC.ready
//   --sheet-width 380    tile width in the contact sheet
//   --no-sheet           skip the contact sheet
//   --port 0             serve on a fixed port instead of an ephemeral one
//
// Writes:  NN__moment__view__t-s.png per frame, _contact-sheet.png (all frames,
// labelled, failures outlined in red), _contact-sheet.html (same, clickable) and
// report.json (stats, selfTest, probes, console errors, verdict).
//
// Exit codes: 0 all good · 1 a check failed · 2 the page/tool could not be used.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { startStaticServer } from './serve.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Performance budget, documented in docs/CAPTURE.md ("Budget"). The intent behind
// the numbers is VISION.md: 60 fps at 1080p on a mid-range laptop. Note that the
// build-a-game process also wants these in AGENTS.md, which does not exist yet
// (see docs/HANDOFF.md, open question 1).
const BUDGET = {
  drawCalls: 150,
  triangles: 150_000,
  passes: 3,
  shadowLights: 2,
  realLights: 6,
};

// A frame that averages this dark, or has no variation at all, is a broken capture
// (WebGL fell over / nothing rendered), not an intentional look.
const BLANK = { minMeanLuma: 2, minStdDev: 1, maxMeanLuma: 253 };

// ---------------------------------------------------------------- args

function parseArgs(argv) {
  const opts = {
    page: 'tools/testscene.html',
    times: null,
    views: null,
    moments: null,
    out: null,
    size: { width: 1280, height: 720 },
    selftest: true,
    determinism: false,
    gpu: 'default',
    budget: { ...BUDGET },
    params: [],
    url: null,
    timeout: 30_000,
    sheetWidth: 380,
    sheet: true,
    port: 0,
  };
  const rest = [];
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    i += 1; // consume this token; take() reads the value that follows it
    const take = () => {
      if (i >= argv.length) fail(2, `Missing value for ${a}`);
      return argv[i++];
    };
    switch (a) {
      case '--times': opts.times = take().split(',').map((s) => num(a, s)); break;
      case '--views': opts.views = list(take()); break;
      case '--moments': opts.moments = list(take()); break;
      case '--out': opts.out = take(); break;
      case '--size': {
        const m = /^(\d+)x(\d+)$/.exec(take());
        if (!m) fail(2, '--size wants WxH, e.g. 1280x720');
        opts.size = { width: +m[1], height: +m[2] };
        break;
      }
      case '--selftest': opts.selftest = true; break;
      case '--no-selftest': opts.selftest = false; break;
      case '--determinism': opts.determinism = true; break;
      case '--gpu': opts.gpu = take(); break;
      case '--budget':
        for (const pair of list(take())) {
          const [k, v] = pair.split('=');
          if (!(k in BUDGET)) fail(2, `Unknown budget key "${k}". Known: ${Object.keys(BUDGET).join(', ')}`);
          opts.budget[k] = num('--budget', v);
        }
        break;
      case '--param': opts.params.push(take()); break;
      case '--url': opts.url = take(); break;
      case '--timeout': opts.timeout = num(a, take()); break;
      case '--sheet-width': opts.sheetWidth = num(a, take()); break;
      case '--no-sheet': opts.sheet = false; break;
      case '--port': opts.port = num(a, take()); break;
      case '-h':
      case '--help':
        console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 37).join('\n').replace(/^\/\/ ?/gm, ''));
        process.exit(0);
        break;
      default:
        if (a.startsWith('--')) fail(2, `Unknown option ${a} (see --help)`);
        else rest.push(a);
    }
  }
  if (rest.length > 1) fail(2, 'One page at a time, please.');
  if (rest.length === 1) opts.page = rest[0];
  if (!['default', 'swiftshader'].includes(opts.gpu)) fail(2, "--gpu takes 'swiftshader' or 'default'");
  return opts;
}

const list = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);
function num(flag, s) {
  const n = Number(s);
  if (!Number.isFinite(n)) fail(2, `${flag} wants numbers, got "${s}"`);
  return n;
}
function fail(code, message) {
  console.error(`capture: ${message}`);
  process.exit(code);
}

// ---------------------------------------------------------------- browser

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
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p)) || null;
}

function launchArgs(gpu) {
  const args = ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'];
  // A pessimistic "weak laptop": render on the CPU.
  if (gpu === 'swiftshader') args.push('--use-angle=swiftshader', '--enable-unsafe-swiftshader');
  return args;
}

// ---------------------------------------------------------------- page probes

/** Read a frame's pixels back out of its PNG: catches black/blank captures. */
async function probeFrame(page, png) {
  return page.evaluate(async (b64) => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const w = 160;
    const h = Math.max(1, Math.round((bmp.height / bmp.width) * w));
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    let sum = 0;
    let sumSq = 0;
    let min = 255;
    let max = 0;
    const colours = new Set();
    const n = w * h;
    for (let i = 0; i < n; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      sum += luma;
      sumSq += luma * luma;
      if (luma < min) min = luma;
      if (luma > max) max = luma;
      colours.add(((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4));
    }
    const mean = sum / n;
    return {
      meanLuma: +mean.toFixed(1),
      stdDev: +Math.sqrt(Math.max(0, sumSq / n - mean * mean)).toFixed(1),
      minLuma: +min.toFixed(0),
      maxLuma: +max.toFixed(0),
      colours: colours.size,
    };
  }, png.toString('base64'));
}

/** How fast the page renders: rAF frame rate (capped ~60 by headless Chrome, so a
 *  smoke test only) and the honest number, milliseconds per synchronous render. */
async function probeRenderer(page, ms = 700) {
  await page.evaluate(() => window.LC.play?.());
  const fps = await page.evaluate(
    (dur) =>
      new Promise((done) => {
        let frames = 0;
        const t0 = performance.now();
        const tick = () => {
          frames++;
          const elapsed = performance.now() - t0;
          if (elapsed < dur) requestAnimationFrame(tick);
          else done(+((frames / elapsed) * 1000).toFixed(1));
        };
        requestAnimationFrame(tick);
      }),
    ms,
  );
  await page.evaluate(() => window.LC.pause?.());
  const renderMs = await page.evaluate(() => {
    const samples = 20;
    const t0 = performance.now();
    for (let i = 0; i < samples; i++) window.LC.renderNow();
    return +((performance.now() - t0) / samples).toFixed(2);
  });
  return { fps, renderMs };
}

// ---------------------------------------------------------------- contact sheet

function contactSheetHtml(meta, frames, failures) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const tiles = frames
    .map((f) => {
      const bad = f.failures.length > 0;
      const st = f.selfTest
        ? `${f.selfTest.pass ? 'selfTest PASS' : 'selfTest FAIL'} ${f.selfTest.checks.filter((c) => c.pass).length}/${f.selfTest.checks.length}`
        : 'selfTest n/a';
      const detail = bad
        ? f.failures.map((x) => `<span class="bad">${esc(x)}</span>`).join('<br>')
        : esc(
            `${f.stats?.drawCalls ?? '?'} draws · ${((f.stats?.triangles ?? 0) / 1000).toFixed(1)}k tris · luma ${f.probe?.meanLuma ?? '?'} · ${f.probe?.colours ?? '?'} colours`,
          );
      return `<figure class="${bad ? 'fail' : ''}">
      <img src="./${esc(f.file)}" alt="${esc(f.moment)} ${esc(f.view)}">
      <figcaption><b>#${String(f.index).padStart(2, '0')} ${esc(f.view)}</b> · ${esc(f.moment)} · t=${f.time.toFixed(2)}s<br>
      ${detail}<br><span class="dim">${esc(st)}${f.determinism ? ` · re-render ${f.determinism.identical ? 'identical' : 'DIFFERENT'}` : ''}</span></figcaption>
    </figure>`;
    })
    .join('\n');

  const verdictClass = failures.length ? 'fail' : 'ok';
  return `<!doctype html><meta charset="utf-8">
<title>${esc(meta.title)}</title>
<style>
  body{margin:0;padding:18px 20px;background:#15181d;color:#e8ebef;font:13px/1.45 ui-sans-serif,system-ui,sans-serif}
  h1{font-size:17px;margin:0 0 6px}
  .verdict{display:inline-block;padding:3px 10px;border-radius:5px;font-weight:700;margin:0 0 8px}
  .verdict.ok{background:#1d7a3f}.verdict.fail{background:#b3261e}
  .meta{color:#a6aeb8;margin:0 0 4px}
  .fails{background:#3a1512;border:1px solid #b3261e;border-radius:6px;padding:8px 12px;margin:10px 0}
  .fails li{margin:2px 0}
  .grid{display:grid;grid-template-columns:repeat(${meta.cols}, ${meta.sheetWidth}px);gap:14px;margin-top:14px}
  figure{margin:0;padding:6px;background:#20242b;border:2px solid #2f353d;border-radius:6px}
  figure.fail{border-color:#e0524a;background:#2a1a19}
  img{display:block;width:${meta.sheetWidth}px;height:auto;border-radius:3px}
  figcaption{margin-top:6px;color:#c8cfd6}
  .bad{color:#ff9c94}
  .dim{color:#8d959f}
</style>
<h1>${esc(meta.title)}</h1>
<p class="verdict ${verdictClass}">${failures.length ? `FAIL — ${failures.length} problem(s)` : 'PASS'}</p>
<p class="meta">${esc(meta.page)} · ${frames.length} frames · ${esc(meta.viewport)} · ${esc(meta.gpu)} · ${esc(meta.browser)}</p>
<p class="meta">budget: ${esc(meta.budget)} · selfTest: ${esc(meta.selfTestSummary)}</p>
${failures.length ? `<div class="fails"><ul>${failures.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></div>` : ''}
<div class="grid">${tiles}</div>
`;
}

// ---------------------------------------------------------------- main

const opts = parseArgs(process.argv.slice(2));
const pagePath = resolve(ROOT, opts.page);
if (!opts.url && !existsSync(pagePath)) fail(2, `No such page: ${opts.page}`);

const outDir = resolve(ROOT, opts.out || join('captures', basenamePage(opts.url || opts.page)));
mkdirSync(outDir, { recursive: true });

function basenamePage(p) {
  try {
    return new URL(p).pathname.split('/').pop().replace(/\.html?$/, '') || 'page';
  } catch {
    return p.split(/[\\/]/).pop().replace(/\.html?$/, '');
  }
}

const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];
const warnings = [];
const frames = [];
const renderProbe = [];
const failures = [];
let contract = null;
let browserInfo = 'unknown';

let server = null;
let browser = null;
let verdict = 'PASS';

try {
  // 1. Serve the project (plain static files) unless told to use an existing URL.
  const pairs = opts.params.map((p) => {
    const eq = p.indexOf('=');
    return eq === -1 ? [p, ''] : [p.slice(0, eq), p.slice(eq + 1)];
  });
  const query = pairs.length ? `?${new URLSearchParams(pairs).toString()}` : '';
  let pageUrl;
  if (opts.url) {
    pageUrl = opts.url + (opts.url.includes('?') ? '&' : '?') + query.slice(1);
  } else {
    server = await startStaticServer({ root: ROOT, port: opts.port });
    pageUrl = server.url + pagePath.slice(ROOT.length + 1).split(/[\\/]+/).join('/') + query;
  }

  // 2. Launch the installed Chrome/Edge (playwright-core, no browser download).
  const executablePath = findChrome();
  browser = await chromium.launch({
    executablePath: executablePath || undefined,
    channel: executablePath ? undefined : 'chrome',
    headless: true,
    args: launchArgs(opts.gpu),
  });
  browserInfo = `${browser.browserType().name()} ${browser.version()}`;
  const context = await browser.newContext({ viewport: opts.size, deviceScaleFactor: 1 });
  const page = await context.newPage();

  page.on('console', (msg) => {
    const entry = `${msg.text()}${msg.location()?.url ? ` (${basenameOnly(msg.location().url)}:${msg.location().lineNumber})` : ''}`;
    if (msg.type() === 'error') consoleErrors.push(entry);
    else if (msg.type() === 'warning') warnings.push(entry);
  });
  page.on('pageerror', (err) => pageErrors.push(String(err && err.stack ? err.stack.split('\n')[0] : err)));
  page.on('requestfailed', (req) => failedRequests.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText}`));
  page.on('response', (res) => {
    if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.url()}`);
  });

  await page.goto(pageUrl, { waitUntil: 'load', timeout: opts.timeout });

  // 3. Wait for the page contract.
  await page
    .waitForFunction(() => window.LCError || (window.LC && window.LC.ready === true), null, { timeout: opts.timeout })
    .catch(() => fail(2, `window.LC.ready never became true within ${opts.timeout}ms at ${pageUrl}`));
  const bootError = await page.evaluate(() => window.LCError || null);
  if (bootError) fail(2, `The page reported LCError: ${bootError}`);

  contract = await page.evaluate(() => ({
    views: window.LC.views || [],
    moments: window.LC.moments || [],
    // Spot pool (issue #53): setMoment accepts spot ids too, so --moments can
    // name any place in the pool. Pages without a pool declare [].
    spots: window.LC.spots || [],
    duration: typeof window.LC.duration === 'number' ? window.LC.duration : 0,
    hasSeek: typeof window.LC.seek === 'function',
    hasSelfTest: typeof window.LC.selfTest === 'function',
    hasMoments: typeof window.LC.setMoment === 'function' && (window.LC.moments || []).length > 0,
  }));
  if (!contract.views.length) fail(2, 'The page declares no views (window.LC.views).');
  await page.evaluate(() => window.LC.pause?.());

  // Count what the GPU is actually told to do, from the WebGL context itself.
  // Three.js assigns `render` per renderer instance, so there is no prototype to
  // wrap, and a page that reports its own stats could always report fewer. The
  // context's draw calls are the number nobody can argue with.
  const gpuStats = await page.evaluate(() => {
    if (window.__lcGlu) return 'hooked';
    const protos = [window.WebGL2RenderingContext?.prototype, window.WebGLRenderingContext?.prototype].filter(Boolean);
    if (!protos.length) return 'no-webgl';
    const counters = { drawCalls: 0, triangles: 0, targets: new Set() };
    const TRIANGLES = 4; // gl.TRIANGLES
    const FRAMEBUFFER = 36160; // gl.FRAMEBUFFER
    const DRAW_FRAMEBUFFER = 36603; // gl.DRAW_FRAMEBUFFER
    const c = counters;
    const draw = (count, mode, instances = 1) => {
      c.drawCalls += 1;
      if (mode === TRIANGLES && count >= 3) c.triangles += Math.floor(count / 3) * instances;
    };
    const bind = (target, fbo, ctx) => {
      if (target !== FRAMEBUFFER && target !== DRAW_FRAMEBUFFER) return;
      c.targets.add(fbo ? fbo : `${ctx.canvas?.width}x${ctx.canvas?.height}:canvas`);
    };
    const hooks = {
      drawArrays: (a) => draw(a[2], a[0]), // (mode, first, count)
      drawElements: (a) => draw(a[1], a[0]), // (mode, count, type, offset)
      drawArraysInstanced: (a) => draw(a[2], a[0], a[3]), // (mode, first, count, instanceCount)
      drawElementsInstanced: (a) => draw(a[1], a[0], a[4]), // (mode, count, type, offset, instanceCount)
      bindFramebuffer: (a, ctx) => bind(a[0], a[1], ctx), // (target, framebuffer)
    };
    for (const proto of protos) {
      for (const [name, onCall] of Object.entries(hooks)) {
        const orig = proto[name];
        if (typeof orig !== 'function' || orig.__lcGlHooked) continue;
        const wrapped = function (...args) {
          onCall(args, this);
          return orig.apply(this, args);
        };
        wrapped.__lcGlHooked = true;
        proto[name] = wrapped;
      }
    }
    window.__lcGlu = {
      reset() {
        counters.drawCalls = 0;
        counters.triangles = 0;
        counters.targets = new Set();
      },
      read() {
        return { drawCalls: counters.drawCalls, triangles: counters.triangles, renderTargets: counters.targets.size };
      },
    };
    return 'hooked';
  });
  // Snapshot those counters per frame by taking ownership of LC.renderNow, which
  // the contract already says is the only way the tool draws a frame.
  if (gpuStats === 'hooked') {
    await page.evaluate(() => {
      const LC = window.LC;
      const orig = LC.renderNow.bind(LC);
      LC.renderNow = () => {
        window.__lcGlu.reset();
        orig();
        window.__lcGlFrame = window.__lcGlu.read();
      };
    });
  }
  const readGpuStats = () => (gpuStats === 'hooked' ? page.evaluate(() => window.__lcGlFrame ?? null) : Promise.resolve(null));

  const times = opts.times ?? defaultTimes(contract.duration);
  const views = pick('views', opts.views, contract.views);
  // --moments accepts moment ids AND (issue #53) spot ids — LC.setMoment
  // stages either; the default matrix stays the declared moments.
  const storable = [...contract.moments, ...(contract.spots || [])];
  const moments = contract.hasMoments ? pick('moments', opts.moments, storable) : [null];

  // 4. Jump, render, capture, measure. Always re-assert moment+time+view so every
  //    frame is reachable in any order (random-order-compatible by construction).
  let index = 0;
  for (const moment of moments) {
    for (const time of times) {
      for (const view of views) {
        index++;
        const file = `${String(index).padStart(2, '0')}__${safe(moment ?? 'none')}__${safe(view)}__t${time.toFixed(2)}s.png`;
        await page.evaluate(
          ([m, t, v]) => {
            if (m !== null) window.LC.setMoment(m);
            window.LC.seek?.(t);
            window.LC.setView(v);
            window.LC.renderNow();
          },
          [moment, time, view],
        );
        const png = await page.screenshot({ type: 'png' });
        writeFileSync(join(outDir, file), png);
        const sha256 = createHash('sha256').update(png).digest('hex');

        const stats = await page.evaluate(() => window.LC.getStats?.() ?? null);
        const gpu = await readGpuStats();
        const probe = await probeFrame(page, png);
        const selfTest = await page.evaluate(() => window.LC.selfTest?.() ?? null);

        const frame = {
          index,
          file,
          moment,
          view,
          time,
          bytes: png.length,
          sha256,
          stats,
          gpu,
          probe,
          selfTest,
          failures: [],
        };

        // Gate on this frame.
        if (selfTest && opts.selftest && !selfTest.pass) {
          for (const c of selfTest.checks.filter((x) => !x.pass)) {
            const msg = `frame #${index} (${moment}/${view} t=${time}): ${c.name} = ${fmt(c.value)} (limit ${fmt(c.limit)})`;
            frame.failures.push(msg);
            failures.push(msg);
          }
        }
        // A scene may describe its cost however it likes; it may not describe it as
        // cheaper than the GPU says it was. Anything it does not report is measured
        // here instead, so hiding a number does not remove it from the budget.
        if (gpu) {
          for (const key of ['drawCalls', 'triangles']) {
            const reported = stats?.[key];
            if (typeof reported === 'number' && gpu[key] > reported) {
              const msg = `frame #${index} (${moment}/${view} t=${time}): stats-understated: page reports ${reported} ${key}, the GPU saw ${gpu[key]}`;
              frame.failures.push(msg);
              failures.push(msg);
            }
          }
        }
        for (const [key, limit] of Object.entries(opts.budget)) {
          const value = gpu && typeof gpu[key] === 'number' ? gpu[key] : stats?.[key];
          if (typeof value === 'number' && value > limit) {
            const msg = `frame #${index} (${moment}/${view} t=${time}): budget ${key} ${value} > ${limit}`;
            frame.failures.push(msg);
            failures.push(msg);
          }
        }
        if (probe.meanLuma < BLANK.minMeanLuma || probe.stdDev < BLANK.minStdDev) {
          const msg = `frame #${index} (${moment}/${view} t=${time}): frame looks blank (mean luma ${probe.meanLuma}, stddev ${probe.stdDev})`;
          frame.failures.push(msg);
          failures.push(msg);
        } else if (probe.meanLuma > BLANK.maxMeanLuma) {
          const msg = `frame #${index} (${moment}/${view} t=${time}): frame is blown out (mean luma ${probe.meanLuma})`;
          frame.failures.push(msg);
          failures.push(msg);
        }

        if (opts.determinism) {
          await page.evaluate(
            ([m, t, v]) => {
              if (m !== null) window.LC.setMoment(m);
              window.LC.seek?.(t);
              window.LC.setView(v);
              window.LC.renderNow();
            },
            [moment, time, view],
          );
          const again = await page.screenshot({ type: 'png' });
          const identical = createHash('sha256').update(again).digest('hex') === sha256;
          frame.determinism = { identical, sha256b: createHash('sha256').update(again).digest('hex') };
          if (!identical) {
            const msg = `frame #${index} (${moment}/${view} t=${time}): not deterministic — re-rendering the same moment+view+time gave different pixels`;
            frame.failures.push(msg);
            failures.push(msg);
          }
        }

        frames.push(frame);
        process.stdout.write(`  #${String(index).padStart(2, '0')} ${moment ?? '-'}/${view} t=${time.toFixed(2)} ${frame.failures.length ? 'FAIL' : 'ok'}\n`);
      }
    }

    // One render probe per moment is enough: it measures the renderer, not the frame.
    renderProbe.push({ moment, view: views[0], ...(await probeRenderer(page)) });
    await page.evaluate(() => window.LC.pause?.());
  }

  // 5. Global failures.
  for (const e of consoleErrors) failures.push(`console error: ${e}`);
  for (const e of pageErrors) failures.push(`page error: ${e}`);
  for (const e of failedRequests) failures.push(`request failed: ${e}`);

  verdict = failures.length ? 'FAIL' : 'PASS';

  // 6. Contact sheet + report.
  const allChecks = aggregateChecks(frames);
  const report = {
    tool: 'tools/capture.mjs',
    generatedAt: new Date().toISOString(),
    page: opts.url ? null : opts.page,
    url: pageUrl,
    browser: browserInfo,
    gpu: opts.gpu,
    viewport: opts.size,
    budget: opts.budget,
    contract,
    gpuStatsSource: gpuStats, // 'hooked' = counted at the WebGL context, not taken from the page
    params: Object.fromEntries(pairs),
    frames,
    renderProbe,
    selfTest: {
      pass: allChecks.every((c) => c.pass),
      checks: allChecks,
    },
    consoleErrors,
    pageErrors,
    failedRequests,
    warnings,
    failures,
    verdict,
  };

  if (opts.sheet) {
    const html = contactSheetHtml(
      {
        title: `Look at Bobo — ${basenamePage(opts.page)}`,
        page: opts.url ?? opts.page,
        viewport: `${opts.size.width}x${opts.size.height}`,
        gpu: opts.gpu === 'swiftshader' ? 'CPU (swiftshader)' : 'browser default GPU',
        browser: browserInfo,
        budget: Object.entries(opts.budget).map(([k, v]) => `${k}<=${v}`).join(' · '),
        selfTestSummary: report.selfTest.pass
          ? `${allChecks.length} checks, 0 failed`
          : `${allChecks.filter((c) => !c.pass).length} of ${allChecks.length} failed`,
        cols: Math.min(4, Math.max(1, Math.ceil(Math.sqrt(frames.length)))),
        sheetWidth: opts.sheetWidth,
      },
      frames,
      failures,
    );
    const sheetHtmlPath = join(outDir, '_contact-sheet.html');
    writeFileSync(sheetHtmlPath, html);
    const sheetPage = await context.newPage();
    const sheetUrl = server ? `${server.url}${outDir.slice(ROOT.length + 1).split(/[\\/]+/).join('/')}/_contact-sheet.html` : `file://${sheetHtmlPath}`;
    await sheetPage.goto(sheetUrl, { waitUntil: 'load' });
    await sheetPage.waitForFunction(() => Array.from(document.images).every((i) => i.complete));
    await sheetPage.screenshot({ path: join(outDir, '_contact-sheet.png'), fullPage: true });
    await sheetPage.close();
  }
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');

  // 7. Human summary.
  const worst = worstStats(frames);
  const checksPass = allChecks.filter((c) => c.pass).length;
  console.log('');
  console.log(`capture: ${opts.url ?? opts.page}`);
  console.log(`  frames     ${frames.length} -> ${relToRoot(outDir)}/ (_contact-sheet.png, report.json)`);
  console.log(`  selfTest   ${report.selfTest.pass ? 'PASS' : 'FAIL'} (${checksPass}/${allChecks.length} checks passed)`);
  console.log(`  budget     ${budgetLine(frames, opts.budget)}`);
  console.log(`  pixels     luma ${range(frames.map((f) => f.probe.meanLuma))} · colours ${range(frames.map((f) => f.probe.colours))}`);
  const claimed = frames.map((f) => f.stats?.passes).filter((v) => typeof v === 'number');
  const targets = frames.map((f) => f.gpu?.renderTargets).filter((v) => typeof v === 'number');
  console.log(
    `  gpu        ${gpuStats === 'hooked' ? `counted at the WebGL context: ${worst.drawCalls ?? 0} draws, ${worst.triangles ?? 0} triangles` : 'not instrumented (the page exposed no WebGL context), using the page stats'}` +
      (targets.length ? ` · ${Math.max(...targets)} render target(s) bound` : '') +
      (claimed.length ? ` · page claims ${Math.max(...claimed)} pass(es)` : ''),
  );
  console.log(`  render     ${range(renderProbe.map((p) => p.renderMs))} ms per frame · rAF ${range(renderProbe.map((p) => p.fps))} fps (headless caps rAF at ~60, so ms/frame is the honest number)`);
  if (opts.determinism) {
    const ok = frames.filter((f) => f.determinism?.identical).length;
    console.log(`  determinism ${ok}/${frames.length} frames byte-identical on re-render`);
  }
  console.log(`  console    ${consoleErrors.length + pageErrors.length + failedRequests.length === 0 ? 'clean' : `${consoleErrors.length} errors, ${pageErrors.length} page errors, ${failedRequests.length} bad requests`}`);
  if (failures.length) {
    console.log(`  problems`);
    for (const f of failures.slice(0, 25)) console.log(`    - ${f}`);
    if (failures.length > 25) console.log(`    - …and ${failures.length - 25} more`);
  }
  console.log(`\nVERDICT: ${verdict}`);
  if (opts.sheet) console.log(`look at: ${relToRoot(join(outDir, '_contact-sheet.png'))}`);
} catch (err) {
  if (err && err.name === 'ExitPromptError') throw err;
  console.error(`capture: could not run — ${err && err.stack ? err.stack.split('\n').slice(0, 4).join('\n  ') : err}`);
  for (const e of pageErrors) console.error(`  page error: ${e}`);
  for (const e of consoleErrors) console.error(`  console error: ${e}`);
  verdict = 'ERROR';
  process.exitCode = 2;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) await server.close().catch(() => {});
}

if (!process.exitCode) process.exit(verdict === 'PASS' ? 0 : 1);

// ---------------------------------------------------------------- helpers

function defaultTimes(duration) {
  if (!duration || duration <= 0) return [0];
  return [0, +(duration / 3).toFixed(3), +((duration * 2) / 3).toFixed(3)];
}

function pick(what, wanted, available) {
  if (!wanted || wanted.includes('all')) return available;
  const unknown = wanted.filter((w) => !available.includes(w));
  if (unknown.length) {
    fail(2, `Unknown ${what}: ${unknown.join(', ')}. The page declares: ${available.join(', ')}`);
  }
  return wanted;
}

function aggregateChecks(frames) {
  const byName = new Map();
  for (const f of frames) {
    for (const c of f.selfTest?.checks ?? []) {
      const key = `${c.name}`;
      const prev = byName.get(key);
      const entry = { name: c.name, pass: c.pass, value: c.value, limit: c.limit, note: c.note ?? null };
      // Keep the worst observation of each named check, and where it was seen.
      if (!prev || (!entry.pass && prev.pass)) byName.set(key, { ...entry, seenAt: `${f.moment}/${f.view}@${f.time}` });
    }
  }
  return [...byName.values()];
}

function worstStats(frames) {
  const keys = ['drawCalls', 'triangles', 'geometries', 'textures', 'programs', 'passes', 'shadowLights', 'realLights', 'renderTargets'];
  const out = {};
  for (const k of keys) {
    // Prefer what the tool measured at the WebGL context over what the page claims
    // about the same number.
    const vals = frames.map((f) => f.gpu?.[k] ?? f.stats?.[k]).filter((v) => typeof v === 'number');
    if (vals.length) out[k] = Math.max(...vals);
  }
  return out;
}

function budgetLine(frames, budget) {
  const worst = worstStats(frames);
  const parts = Object.keys(budget)
    .filter((k) => typeof worst[k] === 'number')
    .map((k) => `${k} ${worst[k]}<=${budget[k]}`);
  const ok = Object.entries(budget).every(([k, limit]) => !(typeof worst[k] === 'number' && worst[k] > limit));
  return `${ok ? 'PASS' : 'FAIL'} (${parts.join(' · ') || 'page reports no stats'})`;
}

function fmt(value) {
  return typeof value === 'number' ? (Number.isInteger(value) ? String(value) : value.toPrecision(4)) : String(value);
}
function range(vals) {
  const nums = vals.filter((v) => typeof v === 'number');
  if (!nums.length) return 'n/a';
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  return lo === hi ? `${lo}` : `${lo}..${hi}`;
}
function safe(s) {
  return String(s).replace(/[^a-z0-9._-]/gi, '_');
}
function relToRoot(p) {
  return p.slice(ROOT.length + 1).split(/[\\/]+/).join('/');
}
function basenameOnly(url) {
  try {
    return new URL(url).pathname.split('/').pop();
  } catch {
    return url.split('/').pop();
  }
}
