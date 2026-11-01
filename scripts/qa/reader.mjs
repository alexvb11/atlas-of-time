// Reader walk-through on a real GPU: select the United States, open "Declaration of Independence"
// in the History tab, hover "Thomas Jefferson", click through to the reader, and play a film to its
// closing signature. Screenshots go to scripts/qa/shots/reader-*.png. Needs network (Wikipedia).
// Usage: node scripts/qa/reader.mjs [url] [--mobile]
import { chromium } from 'playwright'
import fs from 'node:fs'
const url = process.argv.find((a) => a.startsWith('http')) ?? 'http://localhost:5173/?qa'
const mobile = process.argv.includes('--mobile')
const tag = mobile ? 'mobile' : 'desktop'
fs.mkdirSync('scripts/qa/shots', { recursive: true })
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await browser.newContext(
  mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
)
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await page.goto(url)
await page.waitForFunction(() => window.__time?.getState().introDone, null, { timeout: 120000 })
await page.evaluate(() => {
  const T = window.__time.getState()
  T.setTime(2000)
  T.select([-98, 39])
})
await page.waitForTimeout(2500)
await page.getByRole('tab', { name: 'History' }).click()
await page.waitForTimeout(600)
const t0 = Date.now()
await page.getByRole('button', { name: /Declaration of Independence/ }).click()
await page.locator('a.term', { hasText: 'Thomas Jefferson' }).first().waitFor({ timeout: 20000 })
const articleMs = Date.now() - t0
await page.waitForTimeout(3500)
await page.screenshot({ path: `scripts/qa/shots/reader-${tag}-1-dropdown.png` })

const link = page.locator('a.term', { hasText: 'Thomas Jefferson' }).first()
await link.scrollIntoViewIfNeeded()
const t1 = Date.now()
if (mobile) await link.tap()
else await link.hover()
const card = page.getByRole('dialog', { name: 'Thomas Jefferson' })
await card.waitFor({ timeout: 15000 })
await card.getByText(/third president/).waitFor({ timeout: 15000 })
const cardMs = Date.now() - t1
await page.waitForTimeout(6500)
await page.screenshot({ path: `scripts/qa/shots/reader-${tag}-2-card.png` })
// keyboard: Escape closes the card but leaves the panel open
await page.keyboard.press('Escape')
await page.waitForTimeout(400)
const cardClosed = (await card.count()) === 0
const panelOpen = (await page.getByRole('dialog', { name: 'Place details' }).count()) === 1

// read on: click (mouse) or second tap (touch) opens the reader
if (mobile) {
  await link.tap()
  await page.waitForTimeout(500)
  await link.tap()
} else await link.click()
const reader = page.getByRole('dialog', { name: 'Reading: Thomas Jefferson' })
await reader.waitFor({ timeout: 15000 })
await reader.locator('a.term').first().waitFor({ timeout: 20000 })
await page.waitForTimeout(2500)
await page.screenshot({ path: `scripts/qa/shots/reader-${tag}-3-reader.png` })
const segs = reader.getByRole('button', { name: /^Picture \d+ of/ })
const n = await segs.count()
if (n) {
  await segs.nth(n - 1).click()
  await page.waitForTimeout(3000)
}
const signature = await reader.locator('.film-sign').count()
await page.screenshot({ path: `scripts/qa/shots/reader-${tag}-4-signature.png` })

console.log(JSON.stringify({ tag, articleMs, cardMs, cardClosed, panelOpen, shots: n, signature: signature > 0, errors }, null, 1))
await browser.close()
