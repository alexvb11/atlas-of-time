// Headless performance probe: real GPU (ANGLE/Metal), 1440x900 @2x, measures fps idle and while scrubbing.
import { chromium } from 'playwright'
const url = process.argv[2] ?? 'http://localhost:5173/'
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('pageerror', e.message))
await page.goto(url)
await page.waitForFunction(() => window.__time?.getState().introDone, null, { timeout: 60000 })
await page.waitForTimeout(2500)
const measure = (label, during) =>
  page.evaluate(async ([label, during]) => {
    const frames = []
    let last = performance.now()
    const t0 = last
    const T = window.__time.getState()
    await new Promise((r) => {
      const f = () => {
        const now = performance.now()
        frames.push(now - last)
        last = now
        if (during === 'scrub') T.setU(0.95 - ((now - t0) / 3000) * 0.9)
        if (now - t0 < 3000) requestAnimationFrame(f)
        else r()
      }
      requestAnimationFrame(f)
    })
    frames.sort((a, b) => a - b)
    return `${label}: ${(frames.length / 3).toFixed(1)} fps, p95 ${frames[Math.floor(frames.length * 0.95)].toFixed(1)} ms`
  }, [label, during])
console.log(await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const d = g.getExtension('WEBGL_debug_renderer_info'); return g.getParameter(d.UNMASKED_RENDERER_WEBGL) }))
console.log(await measure('idle', 'idle'))
console.log(await measure('scrub across all time', 'scrub'))
await page.evaluate(() => { const T = window.__time.getState(); T.setTime(-69); T.select([44.5, 40.18]) })
await page.waitForTimeout(2500)
console.log(await measure('panel open, idle', 'idle'))
console.log(await measure('panel open, scrubbing', 'scrub'))
await browser.close()
