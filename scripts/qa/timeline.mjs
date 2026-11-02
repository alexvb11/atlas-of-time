// Precise time control: typing years, the ‹ › steppers, arrow keys, the wheel, and that a drag
// stops on a whole year. Usage: node scripts/qa/timeline.mjs [url]
import { chromium } from 'playwright'
const base = process.argv.find((a) => a.startsWith('http')) ?? 'http://localhost:5173/?qa'
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(base)
await page.waitForFunction(() => window.__time?.getState().introDone, null, { timeout: 120000 })
const t = () => page.evaluate(() => window.__time.getState().time)
const readout = () => page.locator('header button[aria-label*="Click to type"]').innerText()
const out = {}
const typeYear = async (y) => {
  await page.locator('header button[aria-label*="Click to type"]').click()
  await page.getByRole('textbox', { name: 'Go to a year' }).fill(y)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1300)
  return { t: await t(), shown: (await readout()).replace(/\s+/g, ' ') }
}
out.y1066 = await typeYear('1066')
out.y44bc = await typeYear('44 BC')
out.y1347 = await typeYear('1347')
await page.getByRole('button', { name: /One year later/ }).click()
out.stepUp = (await readout()).replace(/\s+/g, ' ')
await page.getByRole('button', { name: /One year earlier/ }).click({ modifiers: ['Shift'] })
out.shiftDown = (await readout()).replace(/\s+/g, ' ')
await page.locator('body').click({ position: { x: 1300, y: 600 } })
await page.keyboard.press('ArrowRight')
await page.keyboard.press('ArrowRight')
out.arrows = (await readout()).replace(/\s+/g, ' ')
const track = page.getByRole('slider', { name: 'Time' })
await track.hover()
await page.mouse.wheel(0, -100)
await page.waitForTimeout(200)
out.wheel = (await readout()).replace(/\s+/g, ' ')
out.ka = await typeYear('20 ka')
out.ma = await typeYear('65 Ma')
// drag: release anywhere and the time is the middle of a whole year
const box = await track.boundingBox()
await page.mouse.move(box.x + box.width * 0.83, box.y + box.height / 2)
await page.mouse.down()
await page.mouse.move(box.x + box.width * 0.8317, box.y + box.height / 2, { steps: 5 })
await page.mouse.up()
await page.waitForTimeout(300)
const dragT = await t()
out.drag = { t: dragT, wholeYear: Math.abs((dragT % 1) - 0.5) < 1e-9 || dragT === 2026 }
console.log(JSON.stringify({ ...out, errors }, null, 1))
await browser.close()
