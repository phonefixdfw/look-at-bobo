import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { startStaticServer } from './serve.mjs'
import { chromium } from 'playwright-core'

/**
 * Builds the web-app icons (issue #77): assets/icons/*.png, rendered from the
 * SAME inline logo mark as assets/logo/logo.svg with the headless Chrome the
 * capture tools already use — nothing downloaded.
 *
 *   icon-192.png / icon-512.png    the badge mark, full-bleed on the badge
 *                                  colour (the manifest's "any" icons);
 *   maskable-512.png               same field with the mark shrunk to 60% —
 *                                  it sits inside a maskable icon's 80%-diameter
 *                                  safe circle however the launcher crops it;
 *   apple-touch-icon.png           180x180, OPAQUE (iOS composites a
 *                                  transparency onto black, never checker).
 *
 * The PNGs are checked in (code output, small); re-run after any edit to
 * logo.svg and commit the new PNGs with it. Then `npm run build` copies them
 * into dist/ (the page names them, the build's asset scan ships what is named).
 *
 *   npm run icons:make
 */

const BADGE = '#1b1e26' // the badge colour in assets/logo/logo.svg
const OUT = 'assets/icons'
// mark = how big the logo is drawn inside the square (1.0 = edge to edge).
const CELLS = [
  { id: 'icon-192', size: 192, mark: 1, file: 'icon-192.png' },
  { id: 'icon-512', size: 512, mark: 1, file: 'icon-512.png' },
  { id: 'maskable-512', size: 512, mark: 0.6, file: 'maskable-512.png' },
  { id: 'apple-touch-icon', size: 180, mark: 1, file: 'apple-touch-icon.png' },
]

function findChrome() {
  const candidates = [
    process.env.LC_CHROME,
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ].filter(Boolean)
  return candidates.find((p) => existsSync(p)) || null
}

const SVG = (await readFile('assets/logo/logo.svg', 'utf8')).trim()
if (!/^<svg/.test(SVG)) throw new Error('assets/logo/logo.svg does not look like an SVG')
const dataUrl = `data:image/svg+xml;base64,${Buffer.from(SVG, 'utf8').toString('base64')}`

// One cell per icon: a square div on the badge colour with the mark <img>
// centred in it. Chrome rasterises the vector at exactly the cell size at
// deviceScaleFactor 1, and the element screenshot is the PNG (same mechanism
// as tools/export-logo.mjs). No omitBackground anywhere: every icon is opaque.
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  html, body { margin: 0; padding: 0; background: #fff; }
  div { position: relative; background: ${BADGE}; }
  img { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: block; }
</style></head><body>
${CELLS.map((c) => {
  const px = Math.round(c.size * c.mark)
  return `  <div id="${c.id}" style="width:${c.size}px;height:${c.size}px"><img width="${px}" height="${px}" src="${dataUrl}"></div>`
}).join('\n')}
</body></html>`
await writeFile(new URL('./make-icons.html', import.meta.url).pathname, html)

const server = await startStaticServer({ root: process.cwd() })
const browser = await chromium.launch({ executablePath: findChrome() || undefined, headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 })
  await page.goto(server.urlFor('/tools/make-icons.html'), { waitUntil: 'load' })
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0))

  await mkdir(OUT, { recursive: true })
  for (const c of CELLS) {
    const buf = await page.locator(`#${c.id}`).screenshot()
    await writeFile(`${OUT}/${c.file}`, buf)
    console.log(`wrote ${OUT}/${c.file} (${buf.length} bytes)`)
  }

  // Proof against the real pixels, in the same browser that just drew them:
  // each written PNG reloaded at natural size, corners sampled on a canvas.
  for (const c of CELLS) {
    const url = `${server.urlFor(`/${OUT}/${c.file}`)}?r=${Date.now()}`
    const report = await page.evaluate(async (spec) => {
      const img = new Image()
      img.src = spec.url
      await img.decode()
      const cv = document.createElement('canvas')
      cv.width = img.naturalWidth
      cv.height = img.naturalHeight
      const ctx = cv.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(img, 0, 0)
      const pt = (x, y) => {
        const d = ctx.getImageData(x, y, 1, 1).data
        return [d[0], d[1], d[2], d[3]]
      }
      const w = img.naturalWidth
      const h = img.naturalHeight
      const corners = [pt(0, 0), pt(w - 1, 0), pt(0, h - 1), pt(w - 1, h - 1)]
      // the mark's cream, and the field's dark: prove it is not a flat square
      const all = ctx.getImageData(0, 0, w, h).data
      let cream = 0
      let dark = 0
      for (let i = 0; i < all.length; i += 4) {
        const luma = all[i + 1]
        if (all[i + 3] < 40) continue
        if (luma > 170) cream += 1
        else if (luma < 90) dark += 1
      }
      return { w, h, corners, cream, dark, total: w * h }
    }, { url })
    if (report.w !== c.size || report.h !== c.size) {
      throw new Error(`${c.file}: real pixels ${report.w}x${report.h}, expected ${c.size}x${c.size}`)
    }
    if (report.corners.some((p) => p[3] !== 255)) {
      throw new Error(`${c.file}: a corner pixel is not opaque (${JSON.stringify(report.corners)})`)
    }
    const min = Math.max(4, Math.round(report.total * 0.005))
    if (report.cream < min || report.dark < min) {
      throw new Error(`${c.file}: looks empty (cream=${report.cream} dark=${report.dark}, min=${min})`)
    }
    console.log(`ok: ${c.file} ${report.w}x${report.h} opaque corners, cream=${report.cream} dark=${report.dark}`)
  }
} finally {
  await browser.close()
  await server.close()
}
console.log(`\nmake-icons: ${CELLS.length} icons ready in ${OUT}/`)
