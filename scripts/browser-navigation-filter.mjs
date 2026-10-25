import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import { PNG } from 'pngjs'
import { clickOption, closeTools, openTools, setCategorySidebar, waitUiSettled } from './browser-ui.mjs'

const output = resolve(process.env.NAV_FILTER_OUTPUT_DIR || 'work/navigation-filter/browser')
// Navigation behavior is exercised by the replacement hover/pin suite.
await import('./browser-navigation-special.mjs')
mkdirSync(output, { recursive: true })
const servers = [], checkpoints = [], diagnostics = [], windowDiagnostics = []
let browser, page
const business = data => Object.fromEntries(Object.entries(data).filter(([key]) => !['productListPages', 'productListViews', 'activeProductListViewId', 'listQuery', 'listViews', 'activeViewId', 'activeRole'].includes(key)))
try {
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true })
  async function serverAt(root) {
    const server = await createServer({ root, server: { host: '127.0.0.1', port: 0, open: false, watch: null } }); servers.push(server); await server.listen()
    return `http://127.0.0.1:${server.httpServer.address().port}`
  }
  async function context(source = 'final') {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, locale: 'zh-CN', timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' })
    await ctx.exposeBinding('__recordWindowError', ({ page }, message) => windowDiagnostics.push({ source, url: page.url(), message }))
    await ctx.addInitScript(() => {
      if (location.protocol !== 'http:') return // A newly opened tab starts on opaque about:blank.
      window.addEventListener('error', event => window.__recordWindowError(event.message))
      if (!localStorage.getItem('iyge-v2-theme')) localStorage.setItem('iyge-v2-theme', 'light')
      const RealDate = Date, epoch = RealDate.parse('2026-10-22T04:00:00.000Z'), started = RealDate.now()
      window.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [epoch])) } static now() { return epoch + RealDate.now() - started } }
      window.__dbWrites = []
      const set = Storage.prototype.setItem
      Storage.prototype.setItem = function(key, value) { if (key === 'iyge-v2-mock-db') window.__dbWrites.push(value); return set.call(this, key, value) }
    }); return ctx
  }
  const base = await serverAt(resolve('.'))
  const ctx = await context(); page = await ctx.newPage(); page.setDefaultTimeout(12000)
  page.on('pageerror', error => diagnostics.push({ type: 'pageerror', message: String(error) }))
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) diagnostics.push({ type: message.type(), message: message.text() }) })
  const go = async path => { await page.goto(base + path, { waitUntil: 'networkidle' }) }
  const flush = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const read = () => page.evaluate(async () => JSON.parse(JSON.stringify((await import('/src/stores/catalog.ts')).useCatalogStore().data)))
  const prefs = () => page.evaluate(() => JSON.parse(localStorage.getItem('iyge-nav-layout')))
  const shot = name => page.screenshot({ path: resolve(output, name + '.png'), fullPage: true, animations: 'disabled' })
  const check = name => { checkpoints.push(name); console.log('PASS navigation-filter ' + name) }
  const button = name => page.getByRole('button', { name, exact: true })
  const mainClick = () => page.locator('.demo-strip').click()
  const mode = () => page.locator('.rail-wrap').getAttribute('data-mode')
  const fold = () => page.locator('[data-nav-fold]').click()
  async function layout(value) { await button('切换导航布局').click(); await page.getByRole('menuitemradio', { name: value === 'dual' ? '双栏' : '单栏', exact: true }).click(); await flush() }
  async function activeQuery() { return page.evaluate(async () => {
    const data = (await import('/src/stores/catalog.ts')).useCatalogStore().data
    const mode = location.pathname === '/skus' ? 'sku' : 'spu', p = data.productListPages[mode]
    return JSON.parse(JSON.stringify(p.views.find(view => view.id === p.activeId)[mode + 'Query']))
  }) }
  await go('/spus'); await flush()
  const initial = await read()
  await page.locator('[data-group="product"]').focus()
  // Programmatically trigger the existing filter button without moving focus out of
  // navigation, so both layers are open when Escape is sent to the dialog.
  await page.locator('[data-filter-count]').evaluate(node => node.click())
  const dialog = page.getByRole('dialog', { name: '更多筛选', exact: true })
  await dialog.waitFor(); await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' })
  assert.equal(await page.locator('#nav-flyout').count(), 1, 'dialog owns the first Escape')
  await waitUiSettled(page); await page.locator('[data-group="product"]').focus(); await page.keyboard.press('Escape'); assert.equal(await page.locator('#nav-flyout').count(), 0)
  check('escape-layer-priority')

  const names = () => page.locator('.spu-table button[data-family-id]').allInnerTexts()
  async function openCategory() { if (await page.locator('[data-category-side]').isVisible()) return; await page.locator('[data-category-trigger]').click(); await page.locator('.product-category-pop:visible').waitFor() }
  const tree = () => page.locator('[data-category-tree]:visible')
  async function category(id, search) { await tree().getByPlaceholder('搜索分类').fill(search); await tree().locator(`[data-category-id="${id}"]`).click() }
  await openCategory(); await category('c-phone', '手机'); const phone = await names(); assert.ok(phone.some(name => name.includes('iPhone'))); assert.ok(!phone.some(name => name.includes('Watch')))
  await category('c-watch', '手表'); assert.ok((await names()).some(name => name.includes('Watch')))
  await category('c-watch', '手表'); assert.deepEqual(await names(), phone)
  await tree().getByRole('button', { name: '收起分类面板' }).click(); assert.match(await page.locator('[data-active-filters]').innerText(), /手机/)
  await setCategorySidebar(page, true); assert.deepEqual(await names(), phone); assert.equal(await page.locator('[data-category-trigger]').count(), 0)
  await shot('category-sidebar')
  await button('收起分类栏').click(); assert.deepEqual(await names(), phone); assert.equal((await read()).productListPages.spu.views[0].categoryFilterLayout, 'sidebar')
  await button('展开分类栏').click(); await tree().getByRole('button', { name: '清除分类' }).click(); assert.equal(await page.locator('[data-active-filters]').count(), 0)
  await setCategorySidebar(page, false)
  await page.locator('[data-exposed="brand"]').click(); await clickOption(page, 'Apple'); await page.keyboard.press('Escape')
  await page.locator('[data-filter-count]').click(); assert.match(await dialog.locator('[data-condition="brand"]').innerText(), /Apple/)
  await dialog.locator('[data-expose-field="brand"]').click(); await dialog.locator('.el-dialog__headerbtn').click(); await waitUiSettled(page)
  assert.equal(await page.locator('[data-exposed="brand"]').count(), 0); assert.match(await page.locator('[data-active-filters]').innerText(), /Apple/)
  await page.locator('[data-filter-count]').click(); await dialog.locator('[data-expose-field="brand"]').click(); await dialog.locator('[data-condition="brand"]').getByRole('button', { name: '删除' }).click(); await dialog.locator('.el-dialog__headerbtn').click(); await waitUiSettled(page)
  assert.equal((await activeQuery()).filters.length, 0)
  check('category-search-multiselect-clear-sidebar-live-advanced-shared-state')

  // Independent fixed fixture for complex predicates, preserving IDs and AND order.
  const complex = [
    { id: 'cat-in', field: 'category', operator: 'in', value: ['c-phone', 'c-watch'] },
    { id: 'cat-not', field: 'category', operator: 'neq', value: 'c-watch' },
    { id: 'brand-a', field: 'brand', operator: 'eq', value: 'Apple' },
    { id: 'brand-b', field: 'brand', operator: 'eq', value: 'Apple' },
    { id: 'name-not', field: 'name', operator: 'notContains', value: '未知型号' },
    { id: 'date-from', field: 'created', operator: 'after', value: '2000-01-01' },
    { id: 'date-range', field: 'created', operator: 'between', value: { from: '2000-01-01', to: '2100-01-01' } },
  ]
  await page.evaluate(async filters => {
    const data = (await import('/src/stores/catalog.ts')).useCatalogStore().data, p = data.productListPages.spu, view = p.views.find(item => item.id === p.activeId)
    view.spuQuery.filters = filters; view.spuQuery.keyword = 'iPhone'; view.spuQuery.exposed = ['category', 'brand', 'created', 'name']; view.spuQuery.sorting = { field: 'name', direction: 'desc' }; view.spuQuery.sortMode = 'field'; view.spuQuery.grouping = { field: 'category', direction: 'asc' }
  }, complex); await flush()
  assert.equal(await page.locator('[data-filter-summary]').count(), 8)
  assert.equal(await page.locator('[data-advanced-field]').count(), 3)
  await openCategory(); await button('管理分类条件').click(); await dialog.waitFor(); await dialog.locator('.el-dialog__headerbtn').click(); await waitUiSettled(page)
  assert.deepEqual((await activeQuery()).filters, complex)
  await shot('filters-summary-advanced')
  await page.locator('[data-filter-summary="brand-b"] .el-tag__close').click(); assert.deepEqual((await activeQuery()).filters, complex.filter(item => item.id !== 'brand-b'))
  assert.ok(await page.locator('[data-exposed="brand"]').isVisible())
  await page.locator('input[data-filter="keyword"], [data-filter="keyword"] input').fill('查无此商品'); await page.locator('[data-empty="spu"]').waitFor(); assert.match(await page.locator('[data-active-filters]').innerText(), /查无此商品/)
  const beforeClear = await activeQuery(); const colsBefore = (await read()).productListPages.spu.views[0].spuColumns
  await button('清空筛选').click(); const afterClear = await activeQuery()
  assert.equal(afterClear.keyword, ''); assert.deepEqual(afterClear.filters, []); assert.deepEqual(afterClear.sorting, beforeClear.sorting); assert.deepEqual(afterClear.grouping, beforeClear.grouping); assert.deepEqual((await read()).productListPages.spu.views[0].spuColumns, colsBefore)
  check('complex-and-exclusions-date-ranges-tags-empty-clear-boundaries')

  await setCategorySidebar(page, true); await category('c-phone', '手机'); const widthNames = await names()
  for (const width of [1100, 900, 780]) {
    await page.setViewportSize({ width, height: 900 }); await flush()
    if (width < 960) {
      assert.equal(await page.locator('[data-category-side]').count(), 0); await openCategory()
      const box = await page.locator('.product-category-pop:visible').boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= width + 1 && box.y >= 0 && box.y + box.height <= 901)
      await category('c-watch', '手表'); assert.ok((await names()).some(name => name.includes('Watch')))
      await category('c-watch', '手表'); assert.deepEqual(await names(), widthNames)
      await shot('category-popover-' + width)
      await tree().getByRole('button', { name: '清除分类' }).click(); assert.ok((await names()).length > widthNames.length)
      await category('c-phone', '手机'); await tree().getByRole('button', { name: '收起分类面板' }).click()
    } else { assert.ok(await page.locator('[data-category-side]').isVisible()); await shot('list-narrow-desktop') }
    assert.equal((await read()).productListPages.spu.views[0].categoryFilterLayout, 'sidebar')
    assert.deepEqual(await names(), widthNames)
  }
  await page.setViewportSize({ width: 1600, height: 1000 }); await flush(); assert.ok(await page.locator('[data-category-side]').isVisible())
  await page.reload({ waitUntil: 'networkidle' }); assert.deepEqual(await names(), widthNames); assert.ok(await page.locator('[data-category-side]').isVisible())
  await page.locator('.theme-switch').click(); await shot('filters-dark');
  const groupContrast = await page.locator('.group-head').first().evaluate(node => {
    const style = getComputedStyle(node)
    const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => { const channel = value / 255; return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4 }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
    const values = [luminance(style.color), luminance(style.backgroundColor)].sort((a, b) => b - a)
    return (values[0] + 0.05) / (values[1] + 0.05)
  })
  assert.ok(groupContrast >= 4.5, 'dark group title must remain readable'); await page.locator('.theme-switch').click()
  check('1100-900-780-responsive-panels-preference-refresh-dark')
  await go('/skus?spu=f-iphone'); await page.locator('input[data-filter="keyword"], [data-filter="keyword"] input').fill('查无此SKU'); await page.locator('[data-empty="sku"]').waitFor(); await button('清空筛选').click()
  assert.match(page.url(), /spu=f-iphone/); assert.ok(await page.locator('[data-spu-scope]').isVisible()); assert.ok((await page.locator('.sku-table .linkish').allInnerTexts()).every(name => name.includes('iPhone')))
  await button('查看全部 SKU').click(); assert.match(page.url(), /\/skus$/)
  assert.deepEqual(business(await read()), business(initial))
  check('spu-sku-isolation-scope-clear-no-business-mutation')

  // Compare query results and content across navigation-only state changes.
  const dataForCompare = initial
  const compare = async target => target.evaluate(async ({ data, complex }) => {
    const { presentProductList, emptyModeQuery } = await import('/src/domain/productListQuery.ts')
    const answers = []
    for (const mode of ['spu', 'sku']) for (const filters of [[], complex, [{ id: 'p', field: 'category', operator: 'eq', value: 'c-host' }], [{ id: 'n', field: 'brand', operator: 'neq', value: 'Apple' }], [{ id: 'r', field: 'created', operator: 'between', value: { from: '', to: '2100-01-01' } }]]) {
      const view = structuredClone(data.productListPages[mode].views[0]); view.mode = mode; view[mode + 'Query'] = { ...emptyModeQuery(mode), filters, grouping: { field: 'category', direction: 'desc' }, sorting: { field: 'name', direction: 'asc' }, sortMode: 'field' }
      answers.push(presentProductList(data, view, 1, 1000))
    }
    return answers
  }, { data: dataForCompare, complex })
  const original = await compare(page)
  await go('/account'); await layout('single'); await page.mouse.move(1000,300); await page.waitForTimeout(300)
  await page.locator('.content').screenshot({ path: resolve(output,'account-before.png'), animations:'disabled' })
  await layout('dual'); await fold(); await fold(); await layout('single'); await page.mouse.move(1000,300); await page.waitForTimeout(300)
  const final = await compare(page); assert.deepEqual(final, original)
  writeFileSync(resolve(output,'query-comparison.json'),JSON.stringify({original,final},null,2))
  await page.locator('.content').screenshot({ path: resolve(output,'account-final.png'), animations:'disabled' })
  const a = PNG.sync.read(readFileSync(resolve(output, 'account-before.png'))), b = PNG.sync.read(readFileSync(resolve(output, 'account-final.png')))
  assert.equal(a.width, b.width); assert.equal(a.height, b.height)
  let changedPixels = 0
  for (let i = 0; i < a.data.length; i += 4) if (!a.data.subarray(i, i + 4).equals(b.data.subarray(i, i + 4))) changedPixels++
  assert.equal(changedPixels, 0, 'unrelated account page content')
  writeFileSync(resolve(output, 'visual-comparison.json'), JSON.stringify({ source: 'same page before/after navigation-only toggles', width: a.width, height: a.height, changedPixels }, null, 2))
  check('10-original-final-query-cases-and-unrelated-page-pixel-comparison')
  assert.deepEqual(diagnostics, [], 'no new browser/Vue errors or warnings')
  assert.deepEqual(windowDiagnostics.filter(item => item.message !== 'ResizeObserver loop completed with undelivered notifications.'), [], 'unexpected window errors')
  assert.deepEqual(windowDiagnostics, [], 'no window errors')
  writeFileSync(resolve(output, 'result.json'), JSON.stringify({ status: 'PASS', browser: browser.version(), checkpoints, diagnostics, windowDiagnostics }, null, 2))
  console.log(`PASS ${checkpoints.length} navigation/filter browser checkpoints`)
} catch (error) {
  writeFileSync(resolve(output, 'result.json'), JSON.stringify({ status: 'FAIL', checkpoints, diagnostics, windowDiagnostics, error: String(error) }, null, 2))
  if (page) await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {})
  throw error
} finally { await browser?.close(); for (const server of servers) await server.close() }
