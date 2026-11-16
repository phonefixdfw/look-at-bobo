import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { inflateSync } from 'node:zlib'
import { startStaticServer } from './serve.mjs'
import { chromium } from 'playwright-core'

/**
 * Builds the PNG exports of assets/logo/logo.svg.
 *
 * The mark is laid out in a served page (a data: URL of the same SVG), each
 * export an <img> at exactly its pixel size at deviceScaleFactor 1, then
 * screenshotted element-by-element: Chromium rasterises the vector at that
 * size, which is what a 16px favicon actually needs to stay legible.
 * `omitBackground` gives the clear variants real alpha; the badge variants sit
 * on the badge colour. The social card is the mark centred on a 1200x630
 * badge-colour field for link previews.
 *
 * The exports are checked in (the page is the source of truth); re-run this
 * after any edit to logo.svg and commit the new PNGs with it.
 */

const SIZES = [16, 32, 48, 180, 512]
const SOCIAL = { w: 1200, h: 630, mark: 440 }
const BADGE = '#1b1e26' // must match the badge circle in logo.svg

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

const cells = SIZES.flatMap((size) => [
  { id: `clear-${size}`, size, badge: false, file: `logo-${size}.png` },
  { id: `badge-${size}`, size, badge: true, file: `badge/logo-${size}.png` },
])

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body { margin:0; padding:0; background:#fff; }
  img { display:block; }
  .badge { background:${BADGE}; }
  .card { position:relative; background:${BADGE}; }
  .card img { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); }
</style></head><body>
  ${cells.map((c) => `<img id="${c.id}" width="${c.size}" height="${c.size}" class="${c.badge ? 'badge' : ''}" src="${dataUrl}">`).join('\n')}
  <div id="social" class="card" style="width:${SOCIAL.w}px;height:${SOCIAL.h}px">
    <img id="social-mark" width="${SOCIAL.mark}" height="${SOCIAL.mark}" src="${dataUrl}">
  </div>
</body></html>`
// Written next to the script so the served page can reach it; the data URL
// carries the mark, so nothing else is fetched.
await writeFile(new URL('./logo-export.html', import.meta.url).pathname, html)
const server = await startStaticServer({ root: process.cwd() })
const browser = await chromium.launch({ executablePath: findChrome() || undefined, headless: true })
try {
  const page = await browser.newPage({ viewport: { width: SOCIAL.w, height: SOCIAL.h }, deviceScaleFactor: 1 })
  await page.goto(server.urlFor('/tools/logo-export.html'), { waitUntil: 'load' })
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0))

  const targets = [...cells, { id: 'social', file: 'logo-social.png' }]
  await mkdir('assets/logo/badge', { recursive: true })
  for (const c of targets) {
    const path = `assets/logo/${c.file}`
    const buf = await page.locator(`#${c.id}`).screenshot({
      omitBackground: !String(c.file).startsWith('badge/') && c.id !== 'social',
    })
    await writeFile(path, buf)
    console.log(`wrote ${path} (${buf.length} bytes)`)
  }
} finally {
  await browser.close()
  await server.close()
}

// Self-test: PNG magic + dimensions from the header, and the IHDR-declared
// size re-checked by decoding the image data. Playwright may emit indexed
// PNGs for flat artwork, so this reads the IHDR colour type and walks the
// raster generically (unfilter per row, then expand palettes/gray to RGBA).
const readPng = (buf, file) => {
  if (buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`${file}: not a PNG`)
  const width = buf.readUInt32BE(16)
  const height = buf.readUInt32BE(20)
  const bitDepth = buf.readUInt8(24)
  const colorType = buf.readUInt8(25)
  if (bitDepth !== 8) throw new Error(`${file}: expected 8-bit depth, got ${bitDepth}`)
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType]
  if (!channels) throw new Error(`${file}: unsupported colour type ${colorType}`)
    let palette = null
    let transPalette = null
    const idat = []
    for (let off = 8; off < buf.length;) {
      const len = buf.readUInt32BE(off)
      const type = buf.subarray(off + 4, off + 8).toString('ascii')
      const data = buf.subarray(off + 8, off + 8 + len)
      if (type === 'IDAT') idat.push(data)
      else if (type === 'PLTE') palette = data
      else if (type === 'tRNS' && colorType === 3) transPalette = data
      else if (type === 'IEND') break
      off += 12 + len
    }
  const raw = inflateSync(Buffer.concat(idat))
  const bpp = channels // 8-bit
  const stride = width * bpp
  const out = Buffer.alloc(width * height * 4)
  const prev = Buffer.alloc(stride)
  let cur = Buffer.alloc(stride)
  let pos = 0
  const paeth = (a, b, c) => {
    const p = a + b - c
    const pa = Math.abs(p - a)
    const pb = Math.abs(p - b)
    const pc = Math.abs(p - c)
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
  }
  for (let y = 0; y < height; y += 1) {
    const filter = raw[pos]
    pos += 1
    raw.copy(cur, 0, pos, pos + stride)
    pos += stride
    for (let x = 0; x < stride; x += 1) {
      const a = x >= bpp ? cur[x - bpp] : 0
      const b = prev[x]
      const c = x >= bpp ? prev[x - bpp] : 0
      if (filter === 1) cur[x] = (cur[x] + a) & 0xff
      else if (filter === 2) cur[x] = (cur[x] + b) & 0xff
      else if (filter === 3) cur[x] = (cur[x] + ((a + b) >> 1)) & 0xff
      else if (filter === 4) cur[x] = (cur[x] + paeth(a, b, c)) & 0xff
      else if (filter !== 0) throw new Error(`${file}: bad PNG filter byte ${filter} at row ${y}`)
    }
    for (let x = 0; x < width; x += 1) {
      let r
      let g
      let b
      let al = 255
      if (colorType === 6) {
        r = cur[x * 4]
        g = cur[x * 4 + 1]
        b = cur[x * 4 + 2]
        al = cur[x * 4 + 3]
      } else if (colorType === 2) {
        r = cur[x * 3]
        g = cur[x * 3 + 1]
        b = cur[x * 3 + 2]
      } else if (colorType === 0) {
        r = g = b = cur[x]
      } else if (colorType === 3) {
        const idx = cur[x]
        r = palette[idx * 3]
        g = palette[idx * 3 + 1]
        b = palette[idx * 3 + 2]
        if (transPalette && idx < transPalette.length) al = transPalette[idx]
      } else {
        r = g = b = cur[x * 2]
        al = cur[x * 2 + 1]
      }
      const o = (y * width + x) * 4
      out[o] = r
      out[o + 1] = g
      out[o + 2] = b
      out[o + 3] = al
    }
    cur.copy(prev)
  }
  let dark = 0
  let light = 0
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] < 40) continue
    const luma = out[i + 1]
    if (luma > 170) light += 1
    else if (luma < 90) dark += 1
  }
  return { width, height, dark, light }
}

for (const size of [16, 32, 48, 180, 512]) {
  for (const file of [`logo-${size}.png`, `badge/logo-${size}.png`]) {
    const { width, height, dark, light } = readPng(await readFile(`assets/logo/${file}`), file)
    if (width !== size || height !== size) throw new Error(`${file}: ${width}x${height}, expected ${size}x${size}`)
    const min = Math.max(4, Math.round(size * size * 0.005))
    if (!light || !dark || light < min || dark < min) {
      throw new Error(`${file}: looks empty or unreadable at this size (light=${light} dark=${dark}, min=${min})`)
    }
    console.log(`ok: ${file} ${width}x${height} light=${light} dark=${dark}`)
  }
}
const social = readPng(await readFile('assets/logo/logo-social.png'), 'logo-social.png')
if (social.width !== SOCIAL.w || social.height !== SOCIAL.h) throw new Error(`logo-social.png: ${social.width}x${social.height}, expected ${SOCIAL.w}x${SOCIAL.h}`)
console.log(`ok: logo-social.png ${social.width}x${social.height}`)
