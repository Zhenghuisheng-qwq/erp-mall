import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import { PNG } from 'pngjs'
import { clickOption, closeTools, openTools, setCategorySidebar, waitUiSettled } from './browser-ui.mjs'

const output = resolve(process.env.NAV_FILTER_OUTPUT_DIR || 'work/navigation-filter/browser')
const baselineRoot = resolve(process.env.NAV_FILTER_BASELINE || 'work/navigation-filter/baseline')
if (!existsSync(resolve(baselineRoot, 'src/layouts/RailNav.vue'))) throw new Error(`Missing pre-change source snapshot: ${baselineRoot}. Set NAV_FILTER_BASELINE to the complete source of commit 5e6e74e2c1997b2ffe58f3473bd5be2f660bc64c (including uncommitted source if used).`)
mkdirSync(output, { recursive: true })
const servers = [], checkpoints = [], diagnostics = []
let browser, page
const business = data => Object.fromEntries(Object.entries(data).filter(([key]) => !['productListPages', 'productListViews', 'activeProductListViewId', 'listQuery', 'listViews', 'activeViewId', 'activeRole'].includes(key)))
try {
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true })
  async function serverAt(root) {
    const server = await createServer({ root, server: { host: '127.0.0.1', port: 0, open: false, watch: null } }); servers.push(server); await server.listen()
    return `http://127.0.0.1:${server.httpServer.address().port}`
  }
  async function context() {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, locale: 'zh-CN', timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' })
    await ctx.addInitScript(() => {
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
  async function layout(value) { await button('导航设置').click(); await page.getByRole('menuitemradio', { name: value === 'dual' ? '双栏导航' : '单栏导航' }).click(); await flush() }
  async function activeQuery() { return page.evaluate(async () => {
    const data = (await import('/src/stores/catalog.ts')).useCatalogStore().data
    const mode = location.pathname === '/skus' ? 'sku' : 'spu', p = data.productListPages[mode]
    return JSON.parse(JSON.stringify(p.views.find(view => view.id === p.activeId)[mode + 'Query']))
  }) }
  await go('/spus'); await flush()
  const initial = await read()
  assert.equal(await mode(), 'single'); assert.equal((await prefs()).collapsed, false)
  await page.evaluate(() => window.__dbWrites = [])
  await shot('navigation-single')
  await layout('dual'); assert.equal(await mode(), 'dual')
  await mainClick(); assert.equal(await mode(), 'dual'); assert.ok(await page.locator('#nav-flyout').isVisible())
  await page.locator('[data-group="system"]').hover(); assert.equal(await page.locator('#nav-flyout').getAttribute('aria-label'), '商品中心')
  await shot('navigation-dual')
  await fold(); assert.equal(await mode(), 'icons'); const mainBefore = await page.locator('.main').boundingBox()
  await layout('single'); assert.equal(await mode(), 'icons'); assert.equal((await prefs()).layout, 'single')
  await page.locator('[data-group="product"]').click(); await shot('navigation-collapsed-flyout')
  assert.deepEqual(await page.locator('.main').boundingBox(), mainBefore, 'temporary flyout does not move content')
  await page.locator('[data-group="system"]').click(); assert.equal(await page.locator('#nav-flyout').getAttribute('aria-label'), '系统管理')
  await page.locator('[data-group="system"]').click(); assert.equal(await page.locator('#nav-flyout').count(), 0)
  await page.locator('[data-group="product"]').focus(); await page.keyboard.press('Enter'); await page.keyboard.press('ArrowRight')
  assert.equal(await page.locator('#nav-flyout a').first().evaluate(node => document.activeElement === node), true)
  await page.keyboard.press('Escape'); assert.equal(await page.locator('#nav-flyout').count(), 0)
  assert.equal(await page.locator('[data-group="product"]').evaluate(node => document.activeElement === node), true)
  await page.keyboard.press('ArrowDown'); assert.equal(await page.locator('[data-group="tools"]').evaluate(node => document.activeElement === node), true)
  await page.keyboard.press('Enter'); await mainClick(); assert.equal(await page.locator('#nav-flyout').count(), 0)
  assert.equal((await page.evaluate(() => window.__dbWrites)).length, 0, 'layout/collapse/flyout must not persist catalog')
  assert.deepEqual(business(await read()), business(initial))
  check('single-dual-collapse-click-keyboard-focus-hover-no-data-write')
  await page.locator('[data-group="product"]').click()
  const newTabPromise = ctx.waitForEvent('page'); await page.locator('#nav-flyout a[href="/skus"]').click({ modifiers: ['Control'] }); const newTab = await newTabPromise; await newTab.waitForLoadState('networkidle'); assert.match(newTab.url(), /\/skus$/); await newTab.close()
  assert.match(page.url(), /\/spus$/)
  await page.locator('#nav-flyout a[href="/skus"]').click(); await page.waitForURL('**/skus'); assert.equal(await mode(), 'icons'); assert.equal(await page.locator('#nav-flyout').count(), 0)
  await page.goBack({ waitUntil: 'networkidle' }); assert.match(page.url(), /\/spus$/)
  await page.goForward({ waitUntil: 'networkidle' }); assert.match(page.url(), /\/skus$/)
  await page.locator('[data-group="product"]').click(); await page.reload({ waitUntil: 'networkidle' }); assert.equal(await page.locator('#nav-flyout').count(), 0)
  await fold(); assert.equal(await mode(), 'single'); assert.ok(await page.locator('.sider .is-active a[href="/skus"]').isVisible())
  await page.locator('.sider a[href="/spus"]').click(); await page.waitForURL('**/spus')
  check('route-history-refresh-highlight-native-new-tab')

  for (const old of [{ mode: 'single' }, { mode: 'dual' }, { mode: 'icons', expandedMode: 'single', pinned: true }, { mode: 'icons', expandedMode: 'dual' }, { mode: 'dual', menuOpen: false, pinned: true }, 'broken']) {
    await page.evaluate(value => localStorage.setItem('iyge-nav-layout', typeof value === 'string' ? value : JSON.stringify({ ...value, openeds: ['product', 'manage', 'removed'] })), old)
    await page.reload({ waitUntil: 'networkidle' })
    const saved = await prefs(); assert.ok(!saved.openeds.includes('removed')); assert.equal('pinned' in saved, false)
    assert.equal(saved.layout, old === 'broken' || old.mode === 'single' || old.expandedMode === 'single' ? 'single' : 'dual')
    assert.equal(saved.collapsed, old.mode === 'icons' || old.menuOpen === false)
    if (saved.collapsed) assert.equal(await page.locator('#nav-flyout').count(), 0)
  }
  // Enumerate actual links from all visible role groups in both layouts.
  for (const role of ['admin', 'operator']) {
    await page.locator('.topbar .el-select').click(); await clickOption(page, role === 'admin' ? '身份：管理员' : '身份：运营'); await page.keyboard.press('Escape')
    const groups = await page.evaluate(async role => (await import('/src/domain/menuConfig.ts')).railModel(role), role)
    await layout('dual')
    for (const group of groups) {
      await page.locator(`[data-group="${group.key}"]`).click()
      const expected = [...group.items, ...group.sections.flatMap(item => item.items)].map(item => item.index).sort()
      assert.deepEqual((await page.locator('#nav-flyout a').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')))).sort(), expected)
    }
    await layout('single')
    for (const group of groups) {
      const center = page.locator('.sider .el-sub-menu').filter({ has: page.locator(':scope > .el-sub-menu__title', { hasText: group.title }) }).first()
      if (!(await center.getAttribute('class')).includes('is-opened')) await center.locator(':scope > .el-sub-menu__title').click()
      for (const section of group.sections) {
        const node = center.locator('.el-sub-menu').filter({ has: page.locator(':scope > .el-sub-menu__title', { hasText: section.title }) }).first()
        if (!(await node.getAttribute('class')).includes('is-opened')) await node.locator(':scope > .el-sub-menu__title').click()
      }
    }
    const expected = groups.flatMap(group => [...group.items, ...group.sections.flatMap(item => item.items)]).map(item => item.index).sort()
    assert.deepEqual((await page.locator('.sider a:visible').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')))).sort(), expected)
    if (role === 'operator') { await go('/menus'); await page.waitForURL(base + '/'); assert.equal(await page.locator('.sider a[href="/menus"]').count(), 0) }
  }
  await page.locator('.topbar .el-select').click(); await clickOption(page, '身份：管理员'); await page.keyboard.press('Escape'); await go('/spus')
  check('legacy-migration-corrupt-fallback-all-role-links-and-route-guard')

  await fold(); await page.locator('[data-group="product"]').click()
  // Programmatically trigger the existing filter button without moving focus out of
  // navigation, so both layers are open when Escape is sent to the dialog.
  await page.locator('[data-filter-count]').evaluate(node => node.click())
  const dialog = page.getByRole('dialog', { name: '更多筛选', exact: true })
  await dialog.waitFor(); await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' })
  assert.equal(await page.locator('#nav-flyout').count(), 1, 'dialog owns the first Escape')
  await waitUiSettled(page); await page.locator('[data-group="product"]').focus(); await page.keyboard.press('Escape'); assert.equal(await page.locator('#nav-flyout').count(), 0)
  check('escape-layer-priority')

  const names = () => page.locator('.spu-table button[data-family-id]').allInnerTexts()
  async function openCategory() { if (await page.locator('[data-category-side]').isVisible()) return; await page.locator('[data-category-trigger]').click(); await page.locator('[data-category-tree]:visible').waitFor() }
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
  await page.locator('[data-filter="keyword"] input').fill('查无此商品'); await page.locator('[data-empty="spu"]').waitFor(); assert.match(await page.locator('[data-active-filters]').innerText(), /查无此商品/)
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
  await page.locator('.theme-switch').click(); await shot('filters-dark'); await page.locator('.theme-switch').click()
  check('1100-900-780-responsive-panels-preference-refresh-dark')
  await go('/skus?spu=f-iphone'); await page.locator('[data-filter="keyword"] input').fill('查无此SKU'); await page.locator('[data-empty="sku"]').waitFor(); await button('清空筛选').click()
  assert.match(page.url(), /spu=f-iphone/); assert.ok(await page.locator('[data-spu-scope]').isVisible()); assert.ok((await page.locator('.sku-table .linkish').allInnerTexts()).every(name => name.includes('iPhone')))
  await button('查看全部 SKU').click(); assert.match(page.url(), /\/skus$/)
  assert.deepEqual(business(await read()), business(initial))
  check('spu-sku-isolation-scope-clear-no-business-mutation')

  // Compare the original and final query results using the same complete objects.
  const beforeBase = await serverAt(baselineRoot), beforeCtx = await context(), beforePage = await beforeCtx.newPage()
  await beforePage.goto(beforeBase + '/spus', { waitUntil: 'networkidle' })
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
  const original = await compare(beforePage), final = await compare(page); assert.deepEqual(final, original)
  writeFileSync(resolve(output, 'query-comparison.json'), JSON.stringify({ original, final }, null, 2))
  // Same legacy dual preference: unrelated account content must remain pixel-identical.
  for (const target of [beforePage, page]) {
    await target.evaluate(data => { localStorage.setItem('iyge-nav-layout', JSON.stringify({ mode: 'dual', menuOpen: true, pinned: false })); localStorage.setItem('iyge-v2-mock-db', JSON.stringify({ version: 14, data })) }, initial)
    const url = target === page ? base : beforeBase
    await target.goto(url + '/account', { waitUntil: 'networkidle' })
    await target.locator('.content').screenshot({ path: resolve(output, target === page ? 'account-final.png' : 'account-before.png'), animations: 'disabled' })
  }
  const a = PNG.sync.read(readFileSync(resolve(output, 'account-before.png'))), b = PNG.sync.read(readFileSync(resolve(output, 'account-final.png')))
  assert.equal(a.width, b.width); assert.equal(a.height, b.height)
  let changedPixels = 0
  for (let i = 0; i < a.data.length; i += 4) if (!a.data.subarray(i, i + 4).equals(b.data.subarray(i, i + 4))) changedPixels++
  assert.equal(changedPixels, 0, 'unrelated account page content')
  writeFileSync(resolve(output, 'visual-comparison.json'), JSON.stringify({ source: baselineRoot, width: a.width, height: a.height, changedPixels }, null, 2))
  check('10-original-final-query-cases-and-unrelated-page-pixel-comparison')
  assert.deepEqual(diagnostics, [], 'no new browser/Vue errors or warnings')
  writeFileSync(resolve(output, 'result.json'), JSON.stringify({ status: 'PASS', browser: browser.version(), baselineRoot, checkpoints, diagnostics }, null, 2))
  console.log(`PASS ${checkpoints.length} navigation/filter browser checkpoints`)
} catch (error) {
  writeFileSync(resolve(output, 'result.json'), JSON.stringify({ status: 'FAIL', checkpoints, diagnostics, error: String(error) }, null, 2))
  if (page) await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {})
  throw error
} finally { await browser?.close(); for (const server of servers) await server.close() }
