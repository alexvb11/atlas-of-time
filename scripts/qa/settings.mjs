// Walk-through of the Settings sheet: opens it, checks every section is there, flips settings and
// checks their effect (year labels, the era strip, label size, layers, always-day sun, presets,
// search, reset), and that choices survive a reload. Screenshots: scripts/qa/shots/settings-*.png.
// Usage: node scripts/qa/settings.mjs [url]
import { chromium } from 'playwright'
const base = process.argv.find((a) => a.startsWith('http')) ?? 'http://localhost:5173/?qa'
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()))
const ready = () => page.waitForFunction(() => window.__time?.getState().introDone, null, { timeout: 120000 })
const sheet = () => page.locator('[role=dialog][aria-label="Settings"]')
const out = {}

await page.goto(base)
await page.evaluate(() => localStorage.removeItem('atlas.settings.v1'))
await page.goto(`${base}#t=-43.8`)
await ready()
await page.waitForTimeout(1500)
out.layersButtonGone = (await page.getByRole('button', { name: 'Layers', exact: true }).count()) === 0
await page.getByRole('button', { name: /^Settings/ }).click()
await sheet().getByRole('searchbox').waitFor()
out.sections = await sheet().locator('h3').allInnerTexts()
out.rows = await sheet().locator('[role=switch], [role=radiogroup], input[type=range], select').count()
await page.screenshot({ path: 'scripts/qa/shots/settings-sheet.png' })

// year labels
out.readoutBefore = await page.locator('header').innerText()
await sheet().getByRole('radio', { name: 'BC / AD' }).click()
await page.waitForTimeout(300)
out.readoutAfter = (await page.locator('header').innerText()).match(/\d[\d,]*\s*(BC|BCE|AD|CE)/)?.[0]
// era strip off
out.hudBefore = await page.getByText('World population').count()
await sheet().getByRole('switch', { name: 'Era and population strip' }).click({ force: true })
await page.waitForTimeout(400)
out.hudAfter = await page.getByText('World population').count()
// label size
await sheet().getByRole('radio', { name: 'L', exact: true }).click()
out.labelScale = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--label-scale'))
// search
await sheet().getByRole('searchbox', { name: 'Find a setting' }).fill('cloud')
out.searchCloud = await sheet().locator('.flex-1 > span:first-child').allInnerTexts()
await sheet().getByRole('searchbox', { name: 'Find a setting' }).fill('')
// always-day sun, no clouds, density
await sheet().getByRole('radio', { name: 'Day', exact: true }).click()
await sheet().getByRole('slider', { name: 'Clouds' }).fill('0')
await sheet().getByRole('switch', { name: 'Population density' }).click({ force: true })
await page.waitForTimeout(3000)
out.world = await page.evaluate(() => ({ subsolar: window.__world?.subsolar, view: window.__world?.view }))
await page.screenshot({ path: 'scripts/qa/shots/settings-changed.png' })

// reload: choices are remembered
await page.reload()
await ready()
await page.waitForTimeout(1000)
out.afterReload = await page.evaluate(() => JSON.parse(localStorage.getItem('atlas.settings.v1')))
out.afterReload = { era: out.afterReload.era, hud: out.afterReload.hud, sun: out.afterReload.sun, clouds: out.afterReload.clouds, density: out.afterReload.density, labelSize: out.afterReload.labelSize }
out.hudAfterReload = await page.getByText('World population').count()

// preset, then reset
await page.getByRole('button', { name: /^Settings/ }).click()
await sheet().getByRole('button', { name: /Clean map/ }).click()
await page.waitForTimeout(2500)
await page.screenshot({ path: 'scripts/qa/shots/settings-clean-map.png' })
out.cleanPreset = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('atlas.settings.v1')); return { trade: s.trade, events: s.events, clouds: s.clouds, hud: s.hud } })
await sheet().getByRole('button', { name: 'Reset all settings' }).click()
await page.waitForTimeout(500)
out.afterReset = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('atlas.settings.v1')); return { era: s.era, hud: s.hud, clouds: s.clouds, sun: s.sun } })
console.log(JSON.stringify({ ...out, errors }, null, 1))
await browser.close()
