// Screenshot specific place/time pairs: node scripts/qa/places.mjs "name:lon,lat@year" ...
import { chromium } from 'playwright'
import fs from 'node:fs'
const out = 'scripts/qa/places'
fs.mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.addInitScript(() => localStorage.setItem('atlas.introSeen.v1', '1'))
await page.goto('http://localhost:5173/')
await page.waitForFunction(() => window.__time?.getState().introDone, null, { timeout: 60000 })
await page.waitForTimeout(1500)
for (const arg of process.argv.slice(2)) {
  const [, name, lon, lat, year, tab] = arg.match(/^(.+?):(-?[\d.]+),(-?[\d.]+)@(-?[\d.]+)(?:#(\w+))?$/)
  await page.evaluate(([lon, lat, year]) => { const T = window.__time.getState(); T.setTime(year); T.select([lon, lat]) }, [+lon, +lat, +year])
  await page.waitForTimeout(3200)
  if (tab) { await page.getByRole('tab', { name: tab }).click(); await page.waitForTimeout(900) }
  const title = await page.evaluate(() => [document.querySelector('[role="dialog"] .uppercase')?.textContent, document.querySelector('[role="dialog"] h2')?.textContent].join(' · '))
  console.log(`${name} @ ${year}: ${title}`)
  await page.screenshot({ path: `${out}/${name}-${year}${tab ? '-' + tab : ''}.png` })
}
await browser.close()
console.log(errors.length ? `errors: ${errors.join('; ')}` : 'no page errors')
