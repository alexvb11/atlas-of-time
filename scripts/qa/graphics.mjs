// Screenshots of the globe's look from fixed viewpoints: a daylit hemisphere, the limb and
// terminator, the ocean glint, mountains up close, and deep time. scripts/qa/shots/gfx-*.png
// Usage: node scripts/qa/graphics.mjs [url] [only-this-view]
import { chromium } from 'playwright'
const base = process.argv.find((a) => a.startsWith('http')) ?? 'http://localhost:5173/?qa'
const only = process.argv.slice(2).find((a) => !a.startsWith('http'))
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()))
await page.goto(base)
await page.evaluate(() => localStorage.setItem('atlas.settings.v1', JSON.stringify({ autoRotate: false, trade: false, events: false, cities: false, hud: false, sourceNotes: false, borders: false, sun: 'always-day' })))
const VIEWS = {
  day: { t: 2026, lon: 15, lat: 25, dist: 4.3 },
  limb: { t: 2026, lon: 75, lat: 20, dist: 3.2, sun: 'fixed' },
  glint: { t: 2026, lon: -35, lat: 18, dist: 3.4 },
  himalaya: { t: 2026, lon: 86, lat: 29, dist: 1.35 },
  alps: { t: 2026, lon: 9, lat: 46, dist: 1.25 },
  alpsclose: { t: 2026, lon: 8, lat: 46.3, dist: 1.09 },
  everest: { t: 2026, lon: 86.9, lat: 28, dist: 1.08 },
  everestlow: { t: 2026, lon: 86.93, lat: 27.85, dist: 1.0025 },
  alpslow: { t: 2026, lon: 7.66, lat: 45.9, dist: 1.0018 },
  grandcanyon: { t: 2026, lon: -112.1, lat: 36.05, dist: 1.0012 },
  deep: { t: 2026 - 200e6, lon: 10, lat: 10, dist: 4.3 },
  sky: { t: 2026, lon: 160, lat: -10, dist: 6.5, sun: 'fixed' },
  skyold: { t: -9000, lon: 160, lat: -10, dist: 6.5, sun: 'fixed' },
  plague: { t: 1348.6, lon: 15, lat: 45, dist: 2.6, sun: 'always-day', extra: { borders: true, spreads: true } },
  giza: { t: 2026, lon: 31.128, lat: 29.962, dist: 1.00012 },
  parthenon: { t: 200, lon: 23.7262, lat: 37.968, dist: 1.00016 },
  notredame: { t: 1900, lon: 2.3497, lat: 48.8515, dist: 1.00007 },
  political: { t: 1500.5, lon: 20, lat: 40, dist: 2.6, extra: { borders: true, politicalFill: true } },
  oldmap: { t: 1570, lon: 20, lat: 30, dist: 3.4, extra: { borders: true, oldMap: 'mercator-1569' } },
  oldmapeurope: { t: 1570, lon: 30, lat: 45, dist: 1.8, extra: { oldMap: 'mercator-1569' } },
  wallsrome: { t: 1900, lon: 12.495, lat: 41.87, dist: 1.0011 },
  wallsseoul: { t: 1900, lon: 126.99, lat: 37.53, dist: 1.0035 },
  i18n: { t: 1500, lon: 20, lat: 40, dist: 3.2, extra: { hud: true }, lang: 'ja' },
  borders: { t: 1850.5, lon: 10, lat: 48, dist: 1.9, extra: { borders: true } },
}
for (const [name, v] of Object.entries(VIEWS)) {
  if (only && name !== only) continue
  await page.evaluate((l) => localStorage.setItem('atlas.lang', l), v.lang ?? 'en')
  await page.evaluate(([sun, extra]) => { const s = { autoRotate: false, trade: false, events: false, cities: false, hud: false, sourceNotes: false, borders: false, sun, ...extra }; localStorage.setItem('atlas.settings.v1', JSON.stringify(s)) }, [v.sun ?? 'always-day', v.extra ?? {}])
  await page.goto(`${base}&v=${name}#t=${v.t}`)
  await page.waitForFunction(() => window.__time?.getState().introDone && window.__rig, null, { timeout: 120000 })
  await page.evaluate((v) => Object.assign(window.__rig, { lon: v.lon, lat: v.lat, dist: v.dist, lastInput: performance.now() + 1e9 }), v)
  await page.waitForTimeout(/close|low|everest|canyon/.test(name) ? 16000 : 7000)
  await page.screenshot({ path: `scripts/qa/shots/gfx-${name}.png` })
}
console.log('errors', errors)
await browser.close()
