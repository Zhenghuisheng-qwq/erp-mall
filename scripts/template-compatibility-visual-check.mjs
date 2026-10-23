import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import { PNG } from 'pngjs'

const baseline = resolve(process.env.TEMPLATE_COMPATIBILITY_BASELINE || 'work/template-compatibility/baseline/source')
if (!existsSync(resolve(baseline, 'src/domain/accessoryCompatibilityQuery.ts'))) throw new Error(`Missing complete start-of-task source: ${baseline}. Extract the recorded source-start.zip, or set TEMPLATE_COMPATIBILITY_BASELINE to that exact source. Current source is not a substitute.`)
const output = resolve(process.env.TEMPLATE_COMPATIBILITY_VISUAL_OUTPUT || 'work/template-compatibility/visual')
mkdirSync(output, { recursive: true })
const servers = [], diagnostics = [], captures = []
let browser
try {
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true })
  for (const [phase, root] of [['before', baseline], ['after', resolve('.')]]) {
    const server = await createServer({ root, cacheDir: resolve(output, `${phase}-vite-cache`), server: { host: '127.0.0.1', port: 0, watch: null, hmr: false } })
    servers.push(server)
    const { createAccessoryCompatibilityFixture } = await server.ssrLoadModule('/scripts/accessory-compatibility-fixtures.ts')
    const { ensureProductListPages } = await server.ssrLoadModule('/src/domain/productListPages.ts')
    const { createSeed } = await server.ssrLoadModule('/src/domain/seed.ts')
    const fixture = createAccessoryCompatibilityFixture().data
    ensureProductListPages(fixture)
    fixture.productListPages.sku.activeId = fixture.productListPages.sku.skuWorkbench.activeId = fixture.productListPages.sku.skuWorkbench.defaultId = 'sku-system-all'
    fixture.productListPages.sku.query.pageSize = 50
    await server.listen()
    const base = `http://127.0.0.1:${server.httpServer.address().port}`
    async function context(data, theme = 'light') {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 }, locale: 'zh-CN', timezoneId: 'Asia/Singapore', reducedMotion: 'reduce' })
      await ctx.addInitScript(({ data, theme }) => {
        localStorage.setItem('iyge-v2-mock-db', JSON.stringify({ version: 15, data }))
        localStorage.setItem('iyge-v2-theme', theme)
        localStorage.setItem('iyge-spec-cat-fold', '0'); localStorage.setItem('iyge-spec-rail-fold', '0')
      }, { data, theme })
      const page = await ctx.newPage()
      page.on('pageerror', error => diagnostics.push({ phase, type: 'error', message: String(error) }))
      page.on('console', message => { if (['error', 'warning'].includes(message.type())) diagnostics.push({ phase, type: message.type(), message: message.text() }) })
      return { ctx, page }
    }
    async function capture(page, name, locator) {
      await page.evaluate(() => document.fonts.ready)
      await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))))
      const path = resolve(output, `${phase}-${name}.png`)
      if (locator) await locator.screenshot({ path, animations: 'disabled' })
      else await page.screenshot({ path, animations: 'disabled' })
      captures.push({ phase, name, path })
    }
    for (const theme of ['light', 'dark']) {
      const { ctx, page } = await context(fixture, theme)
      await page.goto(`${base}/spus`, { waitUntil: 'networkidle' }); await page.locator('.spu-table').waitFor()
      await capture(page, `${theme}-spu-list`)
      await page.evaluate(async () => (await import('/src/router/index.ts')).default.push('/skus'))
      await page.locator('[data-sku-workbench]').waitFor(); await capture(page, `${theme}-sku-list`)
      await page.locator('[data-open-compatibility="phone-a"]').click()
      const drawer = page.locator('[data-accessory-drawer]:visible'); await drawer.waitFor()
      await capture(page, `${theme}-drawer-device`, drawer.locator('.device-summary'))
      await capture(page, `${theme}-drawer-resolution`, drawer.locator('.device-state'))
      await ctx.close()
    }
    const { ctx, page } = await context(createSeed())
    await page.goto(`${base}/specs?template=t-phone`, { waitUntil: 'networkidle' })
    await page.locator('.vue-flow__node[data-id="sn-brand"]').waitFor()
    await capture(page, 'designer')
    await ctx.close()
  }
  const comparisons = []
  for (const name of captures.filter(item => item.phase === 'before').map(item => item.name)) {
    const before = PNG.sync.read(readFileSync(resolve(output, `before-${name}.png`))), after = PNG.sync.read(readFileSync(resolve(output, `after-${name}.png`)))
    let changedPixels = 0
    if (before.width === after.width && before.height === after.height) {
      for (let offset = 0; offset < before.data.length; offset += 4) {
        if (before.data.subarray(offset, offset + 4).compare(after.data.subarray(offset, offset + 4))) changedPixels++
      }
    } else changedPixels = null
    const intentionallyChanged = name === 'designer'
    comparisons.push({ name, before: [before.width, before.height], after: [after.width, after.height], changedPixels, intentionallyChanged, note: intentionallyChanged ? 'Added model compatibility summary; full images retained for review. No pixel-equality claim for this changed region.' : 'Unchanged list / existing device summary and resolution.' })
    if (!intentionallyChanged) { assert.equal(before.width, after.width, name); assert.equal(before.height, after.height, name); assert.equal(changedPixels, 0, `${name}: unexpected visual regression`) }
  }
  const allowed = '[Vue Flow]: The options parameter is deprecated and will be removed in the next major version. Please use the id parameter instead'
  assert.ok(diagnostics.every(item => item.type === 'warning' && item.message === allowed), JSON.stringify(diagnostics))
  writeFileSync(resolve(output, 'result.json'), JSON.stringify({ result: 'PASS', baseline, browser: browser.version(), comparisons, diagnostics, captures }, null, 2))
  console.log(`PASS visual: ${comparisons.length - 1} unchanged regions exactly equal; designer addition separately captured`)
} catch (error) {
  writeFileSync(resolve(output, 'failure.json'), JSON.stringify({ result: 'FAIL', error: String(error), captures, diagnostics }, null, 2)); throw error
} finally { await browser?.close(); for (const server of servers) await server.close() }
