// Mobile and keyboard checks the automated audits do not cover: touch-target sizes on a phone,
// a visible focus indicator on every control reached by Tab, and Escape closing the panel.
// Usage: node scripts/qa/a11y.mjs [url] [-v]
import { chromium } from 'playwright'
const url = process.argv.find((a) => a.startsWith('http')) ?? 'http://localhost:5173/'
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const problems = []

const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
await phone.addInitScript(() => localStorage.setItem('atlas.introSeen.v1', '1'))
await phone.goto(url)
await phone.waitForFunction(() => window.__time?.getState().introDone, null, { timeout: 60000 })
await phone.evaluate(() => { const T = window.__time.getState(); T.setTime(-69); T.select([44.5, 40.18]) })
await phone.waitForTimeout(2500)
// WCAG 2.2 target size (minimum) is 24x24 CSS px
const small = await phone.evaluate(() =>
  [...document.querySelectorAll('button, [role="slider"], [role="tab"], a[href]')]
    .filter((el) => el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden')
    // inline links in a sentence are exempt from the target-size rule
    .filter((el) => !(el.tagName === 'A' && el.closest('p')))
    .map((el) => {
      // count an invisible ::before hit area
      const r = el.getBoundingClientRect()
      const b = getComputedStyle(el, '::before')
      if (b.content === 'none' || b.position !== 'absolute') return { el, r }
      const n = (v) => Math.min(0, parseFloat(v) || 0)
      return { el, r: { width: r.width - n(b.left) - n(b.right), height: r.height - n(b.top) - n(b.bottom) } }
    })
    .filter(({ r }) => r.width > 0 && (r.width < 24 || r.height < 24))
    .map(({ el, r }) => `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}" ${r.width.toFixed(0)}x${r.height.toFixed(0)}`),
)
small.forEach((s) => problems.push(`phone: target under 24px: ${s}`))
console.log(`phone: ${small.length} controls under 24x24 px`)

const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await desk.addInitScript(() => localStorage.setItem('atlas.introSeen.v1', '1'))
await desk.goto(url)
await desk.waitForFunction(() => window.__time?.getState().introDone, null, { timeout: 60000 })
await desk.evaluate(() => { const T = window.__time.getState(); T.setTime(-69); T.select([44.5, 40.18]) })
await desk.waitForTimeout(2500)
const seen = new Set()
for (let i = 0; i < 40; i++) {
  await desk.keyboard.press('Tab')
  const f = await desk.evaluate(() => {
    const el = document.activeElement
    if (!el || el === document.body) return null
    const s = getComputedStyle(el)
    const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none'
    return { name: `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}"`, ring }
  })
  if (!f || seen.has(f.name)) continue
  seen.add(f.name)
  if (!f.ring) problems.push(`keyboard: no visible focus indicator on ${f.name}`)
}
console.log(`keyboard: ${seen.size} distinct controls reached by Tab${process.argv.includes('-v') ? ': ' + [...seen].join(', ') : ''}`)
await desk.keyboard.press('Escape')
await desk.waitForTimeout(800)
if (await desk.evaluate(() => window.__time.getState().selection !== null)) problems.push('keyboard: Escape did not close the panel')

await browser.close()
console.log(problems.length ? problems.join('\n') : 'no problems found')
