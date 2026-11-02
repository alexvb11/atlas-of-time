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
  deep: { t: 2026 - 200e6, lon: 10, lat: 10, dist: 4.3 },
}
for (const [name, v] of Object.entries(VIEWS)) {
  if (only && name !== only) continue
  await page.evaluate((sun) => { const s = JSON.parse(localStorage.getItem('atlas.settings.v1')); s.sun = sun; localStorage.setItem('atlas.settings.v1', JSON.stringify(s)) }, v.sun ?? 'always-day')
  await page.goto(`${base}&v=${name}#t=${v.t}`)
  await page.waitForFunction(() => window.__time?.getState().introDone && window.__rig, null, { timeout: 120000 })
  await page.evaluate((v) => Object.assign(window.__rig, { lon: v.lon, lat: v.lat, dist: v.dist, lastInput: performance.now() + 1e9 }), v)
  await page.waitForTimeout(7000)
  await page.screenshot({ path: `scripts/qa/shots/gfx-${name}.png` })
}
console.log('errors', errors)
await browser.close()
