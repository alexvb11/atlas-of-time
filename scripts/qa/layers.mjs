// Walk-through of the living-world layers and the stories tools on a real GPU: Cliopatria borders
// (solid) with approximate ones dashed, trade routes, population density, the seasonal sun, the
// Green Sahara, the "Held by" timeline, comparing two years and the Marco Polo journey.
// Screenshots go to scripts/qa/shots/layers-*.png.
// Usage: node scripts/qa/layers.mjs [url]
import { chromium } from 'playwright'
const base = process.argv.find((a) => a.startsWith('http')) ?? 'http://localhost:5173/?qa'
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()))
const layers = ({ sun, ...l }) => page.evaluate((l) => localStorage.setItem('atlas.settings.v1', JSON.stringify(l)), { ...l, sun: sun ? 'seasons' : 'fixed' })
const out = {}

/** open at a year and place, then close the panel so nothing is dimmed */
async function view(t, lon, lat, wait = 5000) {
  await page.goto(`${base}#t=${t}&at=${lon},${lat}`)
  await page.waitForFunction(() => window.__time?.getState().introDone, null, { timeout: 120000 })
  await page.waitForTimeout(3500)
  await page.evaluate(() => window.__time.getState().select(null, false))
  await page.waitForTimeout(wait)
}

await page.goto(base)
await layers({ sun: false, trade: true, density: false, cities: true })

// 1. borders in 1500: Cliopatria states solid, peoples dashed, the Holy Roman Empire as a grouping
await view(1500.5, 12, 48)
out.labels1500 = await page.evaluate(() => [...document.querySelectorAll('.globe-label')].filter((e) => Number(e.style.opacity) > 0.3).map((e) => e.textContent).slice(0, 30))
out.groupLabels = await page.evaluate(() => [...document.querySelectorAll('.globe-label-group')].map((e) => e.textContent))
await page.screenshot({ path: 'scripts/qa/shots/layers-1500-europe.png' })

// 2. trade routes in 1350 over Eurasia
await view(1350.5, 60, 30)
out.routes1350 = await page.evaluate(() => [...document.querySelectorAll('.route-label')].filter((e) => Number(e.style.opacity) > 0.2).map((e) => e.textContent))
await page.screenshot({ path: 'scripts/qa/shots/layers-trade-1350.png' })
await view(1700.5, -150, 20)
out.routes1700pacific = await page.evaluate(() => [...document.querySelectorAll('.route-label')].filter((e) => Number(e.style.opacity) > 0.2).map((e) => e.textContent))
await page.screenshot({ path: 'scripts/qa/shots/layers-trade-1700-pacific.png' })

// 3. population density in 1800 and 2020
await layers({ sun: false, trade: false, density: true, cities: false })
await view(1800.5, 60, 25, 6000)
out.densityLegend = await page.evaluate(() => [...document.querySelectorAll('.glass')].map((e) => e.textContent).find((t) => t.includes('People per km²')) ?? null)
await page.screenshot({ path: 'scripts/qa/shots/layers-density-1800.png' })
await view(2020.5, 60, 25, 6000)
await page.screenshot({ path: 'scripts/qa/shots/layers-density-2020.png' })

// 4. seasons: January and July 1500 over Europe
await layers({ sun: true, trade: false, density: false, cities: false })
await view(1500.02, 10, 50, 5000)
out.sunJan = await page.evaluate(() => [...document.querySelectorAll('.glass')].map((e) => e.textContent).find((t) => t.startsWith('Sun overhead')) ?? null)
await page.screenshot({ path: 'scripts/qa/shots/layers-sun-january.png' })
await page.evaluate(() => window.__time.getState().setTime(1500.53))
await page.waitForTimeout(4000)
out.sunJul = await page.evaluate(() => [...document.querySelectorAll('.glass')].map((e) => e.textContent).find((t) => t.startsWith('Sun overhead')) ?? null)
await page.screenshot({ path: 'scripts/qa/shots/layers-sun-july.png' })

// 5. Green Sahara, 8,000 years ago
await layers({ sun: false, trade: false, density: false, cities: false })
await view(2026 - 8000, 10, 20, 5000)
out.greenNote = await page.evaluate(() => [...document.querySelectorAll('.glass')].map((e) => e.textContent).find((t) => t.includes('Green Sahara')) ?? null)
await page.screenshot({ path: 'scripts/qa/shots/layers-green-sahara.png' })

// 6. "Held by" for Paris
await page.goto(`${base}#t=1500.5&at=2.35,48.85`)
await page.waitForFunction(() => window.__time?.getState().introDone, null, { timeout: 120000 })
await page.waitForTimeout(4000)
await page.getByRole('tab', { name: 'Held by' }).click()
await page.waitForTimeout(6000)
out.heldBy = (await page.locator('[role=tabpanel]').innerText()).slice(0, 1400)
await page.screenshot({ path: 'scripts/qa/shots/layers-held-by-paris.png' })
await page.keyboard.press('Escape')

// 7. compare 1914 with 1920
await page.waitForTimeout(500)
await page.screenshot({ path: 'scripts/qa/shots/layers-before-compare.png' })
out.cornerButtons = await page.evaluate(() => [...document.querySelectorAll('button')].map((b) => b.getAttribute('aria-label') || b.textContent).filter(Boolean).slice(0, 40))
await page.getByRole('button', { name: 'Explore' }).click()
await page.getByRole('menuitem', { name: /Compare two years/ }).click()
await page.getByRole('button', { name: /First World War/ }).click()
await page.waitForTimeout(6000)
out.compare = (await page.locator('[role=dialog][aria-label="Compare two years"]').innerText()).slice(0, 900)
await page.screenshot({ path: 'scripts/qa/shots/layers-compare-1914-1920.png' })
await page.keyboard.press('Escape')

// 8. Marco Polo on the road, 1274
await layers({ sun: false, trade: false, density: false, cities: false })
await view(1274.2, 80, 38, 3000)
out.journeys1274 = await page.evaluate(() => [...document.querySelectorAll('.journey-head')].filter((e) => Number(e.style.opacity) > 0.05).map((e) => e.textContent))
await page.screenshot({ path: 'scripts/qa/shots/layers-marco-polo.png' })

console.log(JSON.stringify({ ...out, errors }, null, 1))
await browser.close()
