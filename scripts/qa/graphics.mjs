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
  deep: { t: 2026 - 200e6, lon: 10, lat: 10, dist: 4.3 },
  sky: { t: 2026, lon: 160, lat: -10, dist: 6.5, sun: 'fixed' },
  skyold: { t: -9000, lon: 160, lat: -10, dist: 6.5, sun: 'fixed' },
  political: { t: 1500.5, lon: 20, lat: 40, dist: 2.6, extra: { borders: true, politicalFill: true } },
  borders: { t: 1850.5, lon: 10, lat: 48, dist: 1.9, extra: { borders: true } },
}
for (const [name, v] of Object.entries(VIEWS)) {
  if (only && name !== only) continue
  await page.evaluate(([sun, extra]) => { const s = { autoRotate: false, trade: false, events: false, cities: false, hud: false, sourceNotes: false, borders: false, sun, ...extra }; localStorage.setItem('atlas.settings.v1', JSON.stringify(s)) }, [v.sun ?? 'always-day', v.extra ?? {}])
  await page.goto(`${base}&v=${name}#t=${v.t}`)
  await page.waitForFunction(() => window.__time?.getState().introDone && window.__rig, null, { timeout: 120000 })
  await page.evaluate((v) => Object.assign(window.__rig, { lon: v.lon, lat: v.lat, dist: v.dist, lastInput: performance.now() + 1e9 }), v)
  await page.waitForTimeout(name.endsWith('close') || name === 'everest' ? 12000 : 7000)
  await page.screenshot({ path: `scripts/qa/shots/gfx-${name}.png` })
}
console.log('errors', errors)
await browser.close()
