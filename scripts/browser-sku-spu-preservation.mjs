import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import { PNG } from 'pngjs'

const baseline = resolve(process.env.SKU_SPU_BASELINE || 'work/sku-workbench/baseline')
const output = resolve(process.env.SKU_SPU_OUTPUT_DIR || 'work/sku-workbench/spu-visual')
for (const file of ['package.json', 'src/domain/seed.ts', 'src/domain/types.ts', 'src/views/ProductListView.vue', 'src/router/index.ts']) {
  if (!existsSync(resolve(baseline, file))) throw new Error(`Missing original SPU baseline file: ${resolve(baseline, file)}. Set SKU_SPU_BASELINE to the complete, unmodified source snapshot of commit 215e3edfb51d72a7660eae8b83c78d4dd640b191; do not use the final source as its own baseline.`)
}
assert.notEqual(baseline, resolve('.'), 'The original baseline must be a separate source snapshot')
mkdirSync(output, { recursive: true })
const servers = [], screenshots = [], diagnostics = {}, states = {}, comparisons = []
let browser
async function serve(root, phase) {
  const server = await createServer({ root, cacheDir: resolve(output, `${phase}-vite-cache`), server: { host: '127.0.0.1', port: 0, open: false, watch: null, hmr: false } })
  servers.push(server)
  await server.listen()
  return { server, base: `http://127.0.0.1:${server.httpServer.address().port}` }
}
async function settle(page) {
  await page.locator('.spu-table button[data-family-id]').first().waitFor()
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {})))
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
  await page.locator('.el-message').waitFor({ state: 'hidden' })
}
function compare(name) {
  const before = PNG.sync.read(readFileSync(resolve(output, `before-${name}.png`)))
  const after = PNG.sync.read(readFileSync(resolve(output, `after-${name}.png`)))
  assert.equal(before.width, after.width)
  assert.equal(before.height, after.height)
  let changed = 0
  for (let index = 0; index < before.data.length; index += 4) if (!before.data.subarray(index, index + 4).equals(after.data.subarray(index, index + 4))) changed++
  comparisons.push({ name, width: before.width, height: before.height, pixels: before.width * before.height, changed })
  assert.equal(changed, 0, `SPU ${name} has an unexpected visual difference`)
}
try {
  const original = await serve(baseline, 'before')
  const { createSeed } = await original.server.ssrLoadModule('/src/domain/seed.ts')
  const fixture = createSeed()
  const fixtureText = JSON.stringify({ version: 14, data: fixture })
  writeFileSync(resolve(output, 'fixture.json'), fixtureText)
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true }).catch(error => {
    throw new Error('Chrome unavailable. Install Chrome or set BROWSER_CHANNEL to another installed Chromium channel, such as msedge.', { cause: error })
  })
  for (const phase of ['before', 'after']) {
    const { base } = phase === 'before' ? original : await serve(resolve('.'), 'after')
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1, locale: 'zh-CN', timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' })
    diagnostics[phase] = []
    await context.addInitScript(fixtureText => {
      const RealDate = Date, started = RealDate.now(), epoch = RealDate.parse('2026-10-22T04:00:00Z')
      window.Date = class extends RealDate {
        constructor(...args) { super(...(args.length ? args : [epoch])) }
        static now() { return epoch + RealDate.now() - started }
      }
      localStorage.setItem('iyge-v2-mock-db', fixtureText)
      localStorage.setItem('iyge-v2-theme', 'light')
    }, fixtureText)
    const page = await context.newPage()
    page.on('pageerror', error => diagnostics[phase].push({ type: 'pageerror', message: String(error) }))
    page.on('console', message => { if (['error', 'warning'].includes(message.type())) diagnostics[phase].push({ type: message.type(), message: message.text() }) })
    await page.goto(`${base}/spus`, { waitUntil: 'networkidle' })
    await settle(page)
    states[phase] = await page.evaluate(() => ({
      rows: [...document.querySelectorAll('.spu-table button[data-family-id]')].map(node => ({ id: node.getAttribute('data-family-id'), name: node.textContent })),
      count: document.querySelector('[data-result-count]')?.textContent,
      spuSettings: JSON.parse(localStorage.getItem('iyge-v2-mock-db')).data.productListPages.spu,
    }))
    for (const theme of ['light', 'dark']) {
      if (theme === 'dark') await page.getByRole('button', { name: '当前明亮模式，切换为暗黑模式', exact: true }).click()
      await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme)
      await settle(page)
      const name = `${phase}-${theme}.png`
      await page.screenshot({ path: resolve(output, name), animations: 'disabled' })
      screenshots.push(name)
    }
    await context.close()
  }
  assert.deepEqual(states.after, states.before, 'SPU rows, counts or page preferences changed')
  assert.deepEqual(diagnostics.after, diagnostics.before, 'SPU acquired new browser diagnostics')
  compare('light'); compare('dark')
  const result = {
    result: 'PASS', baseline, finalRoot: resolve('.'), browser: browser.version(), fixtureVersion: 14,
    fixtureSource: 'Original baseline createSeed()', fixtureSha256: createHash('sha256').update(fixtureText).digest('hex'),
    businessTime: '2026-10-22T04:00:00Z', viewport: { width: 1440, height: 960 }, locale: 'zh-CN', timeZone: 'Asia/Shanghai',
    comparisons, screenshots, diagnostics, states,
  }
  writeFileSync(resolve(output, 'result.json'), JSON.stringify(result, null, 2))
  console.log(JSON.stringify({ result: result.result, browser: result.browser, comparisons, diagnostics }, null, 2))
} catch (error) {
  writeFileSync(resolve(output, 'failure.json'), JSON.stringify({ result: 'FAIL', error: String(error), screenshots, diagnostics, states, comparisons }, null, 2))
  throw error
} finally {
  await browser?.close()
  for (const server of servers.reverse()) await server.close()
}
