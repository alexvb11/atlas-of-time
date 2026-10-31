// Walk-through of the Explore features on a real GPU: a share link that opens a place, year and
// article; a guided journey; a quiz round of each kind; "on this day"; the journal; a voyage in
// motion. Screenshots go to scripts/qa/shots/explore-*.png. Needs network (Wikipedia).
// Usage: node scripts/qa/explore.mjs [url]
import { chromium } from 'playwright'
const base = process.argv.find((a) => a.startsWith('http')) ?? 'http://localhost:5173/?qa'
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()))
await page.addInitScript(() => localStorage.setItem('atlas.introSeen.v1', '1'))
const ready = () => page.waitForFunction(() => window.__time?.getState().introDone, null, { timeout: 120000 })
const out = {}

// 1. share link
await page.goto(`${base}#t=1789.54&at=2.369,48.853&read=Storming_of_the_Bastille`)
await ready()
await page.waitForTimeout(5000)
out.shareLink = await page.evaluate(() => ({
  year: Math.floor(window.__time.getState().time),
  place: document.querySelector('[aria-label="Place details"] h2')?.textContent,
  reading: document.querySelector('[aria-label^="Reading"]')?.getAttribute('aria-label'),
  hash: location.hash,
}))
await page.keyboard.press('Escape')
await page.waitForTimeout(400)

// 2. guided journey
const explore = page.getByRole('button', { name: 'Explore' })
await explore.click()
await page.getByRole('menuitem', { name: /Guided journeys/ }).click()
await page.getByRole('button', { name: /Magellan/ }).click()
await page.waitForTimeout(5000)
out.tour = await page.evaluate(() => ({ year: Math.floor(window.__time.getState().time), caption: document.querySelector('[role=status] h3')?.textContent }))
await page.getByRole('button', { name: 'Next stop' }).click()
await page.getByRole('button', { name: 'Next stop' }).click()
await page.waitForTimeout(4500)
out.tourStep3 = await page.evaluate(() => document.querySelector('[role=status] h3')?.textContent)
await page.screenshot({ path: 'scripts/qa/shots/explore-tour.png' })
await page.locator('[role=status]').getByRole('button', { name: 'End' }).click()

// 3. a voyage in motion without a tour: mid-Pacific crossing
await page.evaluate(() => window.__time.getState().setTime(1520.98))
await page.waitForTimeout(1500)
out.voyageMarker = await page.evaluate(() => [...document.querySelectorAll('.journey-head')].filter((e) => Number(e.style.opacity) > 0.05).map((e) => e.textContent))

// 4. quiz: a "where" round by clicking the globe, then a "ruler" round
await explore.click()
await page.getByRole('menuitem', { name: /History quiz/ }).click()
await page.getByText('Find the place').waitFor({ timeout: 20000 })
await page.waitForTimeout(2500)
await page.mouse.click(900, 480)
await page.getByText(/km away/).waitFor({ timeout: 10000 })
out.quizWhere = await page.locator('[role=dialog][aria-label="History quiz"]').innerText()
await page.getByRole('button', { name: /Next →/ }).click()
await page.getByText('Name the ruler').waitFor({ timeout: 30000 })
const opts = page.locator('[role=dialog][aria-label="History quiz"] .grid button')
out.rulerOptions = await opts.count()
await opts.first().click()
out.quizRuler = (await page.locator('[role=dialog][aria-label="History quiz"]').innerText()).slice(0, 400)
await page.screenshot({ path: 'scripts/qa/shots/explore-quiz.png' })

// 5. on this day, and the journal
await explore.click()
await page.getByRole('menuitem', { name: /On this day/ }).click()
await page.waitForTimeout(6000)
out.today = (await page.locator('[role=dialog][aria-label="On this day"]').innerText()).slice(0, 500)
await page.screenshot({ path: 'scripts/qa/shots/explore-today.png' })
await explore.click()
await page.getByRole('menuitem', { name: /Your journal/ }).click()
await page.waitForTimeout(800)
out.journal = (await page.locator('[role=dialog][aria-label="Your journal"]').innerText()).slice(0, 300)

console.log(JSON.stringify({ ...out, errors }, null, 1))
await browser.close()
