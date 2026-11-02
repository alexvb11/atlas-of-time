// "The basics" card for a spread of places and dates: prints the overview sentence, the wider-world
// line and the Wikipedia period section chosen, and screenshots a few. Needs network (Wikipedia).
// Usage: node scripts/qa/basics.mjs [url]
import { chromium } from 'playwright'
const base = process.argv.find((a) => a.startsWith('http')) ?? 'http://localhost:5173/?qa'
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const CASES = [
  ['paris-1500', 1500.5, 2.35, 48.85],
  ['rome-100', 100.5, 12.5, 41.9],
  ['beijing-1700', 1700.5, 116.4, 39.9],
  ['cusco-1500', 1500.5, -71.97, -13.53],
  ['berlin-1950', 1950.5, 13.4, 52.52],
  ['delhi-1650', 1650.5, 77.2, 28.6],
  ['timbuktu-1350', 1350.5, -3.0, 16.77],
  ['kyiv-2026', 2026, 30.52, 50.45],
  ['egypt-1300bce', -1299, 31.2, 29.9],
]
const out = {}
for (const [id, t, lon, lat] of CASES) {
  await page.goto(`${base}#t=${t}&at=${lon},${lat}`)
  await page.waitForFunction(() => window.__time?.getState().introDone, null, { timeout: 120000 })
  const card = page.locator('[aria-label="The basics"]')
  await card.waitFor({ timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(7000)
  out[id] = (await card.count()) ? await card.innerText() : '(no basics card)'
  if (['paris-1500', 'cusco-1500', 'egypt-1300bce'].includes(id)) await page.screenshot({ path: `scripts/qa/shots/basics-${id}.png` })
}
console.log(Object.entries(out).map(([k, v]) => `=== ${k}\n${v}`).join('\n\n'))
console.log('errors', errors)
await browser.close()
