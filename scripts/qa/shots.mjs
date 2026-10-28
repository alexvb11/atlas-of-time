// Screenshot tour of the major states for design review. Usage: node scripts/qa/shots.mjs [outDir]
import { chromium } from 'playwright'
import fs from 'node:fs'
const out = process.argv[2] ?? 'scripts/qa/shots'
fs.mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const errors = []
async function session(viewport, scale, fn) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: scale })
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.addInitScript(() => localStorage.setItem('atlas.introSeen.v1', '1'))
  await page.goto('http://localhost:5173/')
  await page.waitForFunction(() => window.__time?.getState().introDone, null, { timeout: 60000 })
  await page.waitForTimeout(2000)
  await fn(page)
  await page.close()
}
const at = async (page, name, setup, wait = 2600) => {
  await page.evaluate(setup)
  await page.waitForTimeout(wait)
  await page.screenshot({ path: `${out}/${name}.png` })
}
await session({ width: 1440, height: 900 }, 1, async (page) => {
  await at(page, '01-today', () => {})
  await at(page, '02-armenia-70bce', () => { const T = window.__time.getState(); T.setTime(-69); T.select([44.5, 40.18]) }, 3500)
  for (const [i, tab] of ['Languages', 'History', 'Geography'].entries()) {
    await page.getByRole('tab', { name: tab }).click()
    await page.waitForTimeout(900)
    await page.screenshot({ path: `${out}/0${3 + i}-armenia-${tab.toLowerCase()}.png` })
  }
  await page.getByRole('tab', { name: 'Overview' }).click()
  await at(page, '06-armenia-1300', () => window.__time.getState().setTime(1300))
  await at(page, '07-armenia-1919', () => window.__time.getState().setTime(1919))
  await at(page, '08-deep-250ma', () => window.__time.getState().setTime(2026 - 250e6), 4000)
  await at(page, '09-deep-600ma', () => window.__time.getState().setTime(2026 - 600e6), 4000)
  await at(page, '10-ice-age-20ka', () => { const T = window.__time.getState(); T.select(null, false); T.setTime(2026 - 20000) }, 3500)
  await at(page, '11-rome-44bce', () => { const T = window.__time.getState(); T.setTime(-43); T.select([12.5, 41.9]) }, 3500)
  await at(page, '12-china-750', () => { const T = window.__time.getState(); T.setTime(750); T.select([108.9, 34.3]) }, 3500)
  await at(page, '13-mexico-1500', () => { const T = window.__time.getState(); T.setTime(1500); T.select([-99.1, 19.4]) }, 3500)
  await at(page, '14-london-1100', () => { const T = window.__time.getState(); T.setTime(1100); T.select([-0.1, 51.5]) }, 3500)
  await at(page, '15-1500-routes', () => { const T = window.__time.getState(); T.select(null, false); T.setTime(1500) }, 3000)
  await page.keyboard.press('Meta+k')
  await page.keyboard.type('tang')
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${out}/16-palette.png` })
})
await session({ width: 390, height: 844 }, 2, async (page) => {
  await at(page, '20-mobile-today', () => {})
  await at(page, '21-mobile-panel', () => { const T = window.__time.getState(); T.setTime(-69); T.select([44.5, 40.18]) }, 3500)
})
await browser.close()
console.log(errors.length ? `errors:\n${[...new Set(errors)].join('\n')}` : 'no console errors')
