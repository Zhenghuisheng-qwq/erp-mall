import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import { createTestRuntime, removeTestRuntime } from './test-runtime.mjs'

const runtime = createTestRuntime('list-layout'), contexts = [], errors = []
let browser, server, checks = 0
try {
  server = await createServer({ cacheDir: `${runtime}/cache`, logLevel: 'silent', server: { host: '127.0.0.1', port: 0, watch: null, hmr: false, ws: false } })
  const { listInteractionFixture } = await server.ssrLoadModule('/scripts/list-interaction-fixture.ts')
  const { ensureProductListPages } = await server.ssrLoadModule('/src/domain/productListPages.ts')
  const { columnFields } = await server.ssrLoadModule('/src/domain/productListViews.ts')
  const { defaultSkuConfig, createSkuSavedView } = await server.ssrLoadModule('/src/domain/skuWorkbenchState.ts')
  const { normalizeStored } = await server.ssrLoadModule('/src/stores/catalog.ts')
  const { DATA_VERSION } = await server.ssrLoadModule('/src/domain/types.ts')
  const data = listInteractionFixture()
  let parent = 'list-grandchild'
  for (let i = 0; i < 8; i++) { const id = `layout-depth-${i}`; data.categories.push({ id, name: `深层分类${i} 这个名称用于实际横向滚动查看完整内容而不挤宽分类树面板`, parentId: parent, sort: 1, enabled: true }); parent = id }
  ensureProductListPages(data)
  const spu = data.productListPages.spu, sku = data.productListPages.sku
  const currentSpu = spu.views.find(view => view.id === spu.activeId)
  currentSpu.name = '当前较长名称的SPU保存视图用于检查溢出'
  currentSpu.categoryFilterLayout = 'popover'
  currentSpu.spuColumns = columnFields('spu').map(({ key }, order) => ({ key, order, visible: true, width: key === 'name' ? 260 : 160, frozen: key === 'name' ? 'left' : false }))
  for (let i = 0; i < 22; i++) spu.views.push({ ...structuredClone(currentSpu), id: `layout-spu-${i}`, name: `保存视图${i} 用于检查更多视图与长名称` })
  const config = defaultSkuConfig()
  config.columns = ['code', 'name', 'spec', 'familyId', 'category', 'status', 'updatedAt'].map((key, i) => ({ key, visible: true, width: [187, 260, 400, 260, 200, 100, 150][i], frozen: i === 0 ? 'left' : false }))
  const currentSku = createSkuSavedView('layout-sku-current', '当前未收藏的较长SKU视图名称', config, sku.views[0])
  sku.views.push(currentSku)
  for (let i = 0; i < 22; i++) sku.views.push(createSkuSavedView(`layout-sku-${i}`, `收藏视图${i} 用于检查更多视图`, config, currentSku))
  sku.skuWorkbench.defaultId = currentSku.id; sku.skuWorkbench.activeId = currentSku.id; sku.activeId = currentSku.id
  sku.skuWorkbench.favorites = sku.views.filter(view => /^layout-sku-\d/.test(view.id)).map(view => view.id)
  sku.skuWorkbench.order = sku.views.map(view => view.id)
  const payload = normalizeStored({ version: DATA_VERSION, data })
  await server.listen()
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  for (const mode of ['spu', 'sku']) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 1000 }, locale: 'zh-CN', reducedMotion: 'reduce' }); contexts.push(context)
    await context.addInitScript(({ payload, version }) => { if (location.protocol === 'http:' && !localStorage.getItem('iyge-v2-mock-db')) { localStorage.setItem('iyge-v2-mock-db', JSON.stringify({ version, data: payload })); localStorage.setItem('iyge-v2-theme', 'light') } }, { payload, version: DATA_VERSION })
    const page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', error => errors.push(String(error)))
    await page.goto(`${base}/${mode === 'spu' ? 'spus' : 'skus'}`, { waitUntil: 'networkidle' })
    await page.evaluate(async () => { window.__layoutStore = (await import('/src/stores/catalog.ts')).useCatalogStore(); await window.__layoutStore.waitForPersistence() })
    const business = await page.evaluate(() => JSON.stringify([window.__layoutStore.data.families, window.__layoutStore.data.skus, window.__layoutStore.data.specModelVersions, window.__layoutStore.data.benefitDeliveries]))
    const active = mode === 'spu' ? currentSpu.id : currentSku.id
    assert.equal(await page.locator(`[data-view-tab="${active}"]`).count(), 1)
    assert(await page.locator('[data-view-tab]').count() < 24)
    await page.locator('[data-more-views]').click(); await page.getByPlaceholder('搜索视图', { exact: true }).fill('21')
    assert.equal(await page.locator(`[data-saved-view="layout-${mode}-21"]`).count(), 1)
    await page.locator('[data-more-views]').click()
    const category = page.locator('[data-category-trigger]')
    await category.click(); await page.locator('[data-category-side]').waitFor({ state: 'visible' }); assert.equal(await category.count(), 0)
    const side = page.locator('[data-category-side]'), tree = side.locator('[data-category-scroll]')
    assert(Math.abs((await side.boundingBox()).width - 240) <= 2)
    await side.locator('[data-expand-id="list-parent"]').click(); await side.locator('[data-expand-id="list-child"]').click(); await side.locator('[data-expand-id="list-grandchild"]').click()
    for (let i = 0; i < 7; i++) await side.locator(`[data-expand-id="layout-depth-${i}"]`).click()
    assert(await tree.evaluate(el => el.scrollWidth > el.clientWidth + 200))
    const head = side.locator('strong').first(), headBefore = await head.boundingBox(), sideBefore = await side.boundingBox()
    const table = page.locator(mode === 'spu' ? '.spu-table' : '.sku-table').first(), wrap = table.locator('.el-table__body-wrapper .el-scrollbar__wrap')
    await page.waitForFunction(selector => { const el = document.querySelector(selector); return !!el && el.scrollWidth > el.clientWidth + 100 }, mode === 'spu' ? '.spu-table .el-table__body-wrapper .el-scrollbar__wrap' : '.sku-table .el-table__body-wrapper .el-scrollbar__wrap')
    const tableBefore = await table.boundingBox()
    await tree.evaluate(el => { el.scrollLeft = el.scrollWidth })
    assert(await tree.evaluate(el => el.scrollLeft > 100)); assert.equal(await wrap.evaluate(el => el.scrollLeft), 0)
    assert.equal((await head.boundingBox()).x, headBefore.x); assert.equal((await table.boundingBox()).x, tableBefore.x)
    const treeLeft = await tree.evaluate(el => el.scrollLeft)
    await wrap.evaluate(el => { el.scrollLeft = el.scrollWidth })
    assert(await wrap.evaluate(el => el.scrollLeft > 100)); assert.equal(await tree.evaluate(el => el.scrollLeft), treeLeft)
    assert.equal((await side.boundingBox()).x, sideBefore.x); checks++
    const queryBefore = await page.evaluate(mode => { const p = window.__layoutStore.data.productListPages[mode]; return JSON.stringify(mode === 'spu' ? p.views.find(v => v.id === p.activeId).spuQuery : (p.skuWorkbench.working[p.skuWorkbench.activeId] || p.views.find(v => v.id === p.skuWorkbench.activeId).skuWorkbench).conditions) }, mode)
    await side.getByRole('button', { name: '收起分类栏', exact: true }).click(); await side.waitFor({ state: 'detached' }); await category.waitFor({ state: 'visible' })
    await category.click(); await side.waitFor({ state: 'visible' })
    const queryAfter = await page.evaluate(mode => { const p = window.__layoutStore.data.productListPages[mode]; return JSON.stringify(mode === 'spu' ? p.views.find(v => v.id === p.activeId).spuQuery : (p.skuWorkbench.working[p.skuWorkbench.activeId] || p.views.find(v => v.id === p.skuWorkbench.activeId).skuWorkbench).conditions) }, mode)
    assert.equal(queryAfter, queryBefore); checks++
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => { document.documentElement.classList.toggle('dark', theme === 'dark'); document.documentElement.dataset.theme = theme }, theme)
      for (const width of [1920, 1366, 900, 375]) {
        await page.setViewportSize({ width, height: 1000 })
        await page.waitForFunction(expected => (document.querySelector('[data-category-side]') !== null) === expected, width >= 960)
        assert.equal(await page.locator(`[data-view-tab="${active}"]`).count(), 1)
        await page.waitForFunction(() => document.documentElement.scrollWidth <= window.innerWidth + 2)
        const visibleTable = await table.boundingBox(); assert(visibleTable.width > (width < 600 ? 220 : 300))
        if (width < 960) {
          await category.click(); const drawer = page.getByRole('dialog', { name: '商品分类', exact: true }); await drawer.waitFor({ state: 'visible' })
          assert((await drawer.boundingBox()).width <= width)
          await drawer.locator('.el-drawer__close-btn').click(); await drawer.waitFor({ state: 'hidden' })
        } else assert(Math.abs((await side.boundingBox()).width - 240) <= 2)
        checks++
      }
    }
    await page.setViewportSize({ width: 1366, height: 1000 }); await side.waitFor({ state: 'visible' })
    await page.waitForFunction(mode => { const p = window.__layoutStore.data.productListPages[mode]; return mode === 'spu' ? p.views.find(v => v.id === p.activeId).categoryFilterLayout === 'sidebar' : (p.skuWorkbench.working[p.skuWorkbench.activeId] || p.views.find(v => v.id === p.skuWorkbench.activeId).skuWorkbench).categoryLayout === 'sidebar' }, mode)
    const url = page.url(), beforeHelp = await page.evaluate(() => ({ raw: localStorage.getItem('iyge-v2-mock-db'), guides: Object.fromEntries(Object.keys(localStorage).filter(key => /guide/i.test(key)).map(key => [key, localStorage.getItem(key)])) }))
    await page.getByRole('button', { name: '页面功能', exact: true }).click()
    const help = page.getByRole('dialog', { name: '页面功能', exact: true }); await help.waitFor({ state: 'visible' })
    await help.getByRole('button', { name: '关闭说明', exact: true }).click(); await help.waitFor({ state: 'hidden' })
    assert.equal(page.url(), url)
    assert.deepEqual(await page.evaluate(() => ({ raw: localStorage.getItem('iyge-v2-mock-db'), guides: Object.fromEntries(Object.keys(localStorage).filter(key => /guide/i.test(key)).map(key => [key, localStorage.getItem(key)])) })), beforeHelp); checks++
    assert.equal(await page.evaluate(() => JSON.stringify([window.__layoutStore.data.families, window.__layoutStore.data.skus, window.__layoutStore.data.specModelVersions, window.__layoutStore.data.benefitDeliveries])), business)
    if (mode === 'sku') {
      const saved = await page.evaluate(() => window.__layoutStore.data.productListPages.sku.views.find(v => v.id === 'layout-sku-current').skuWorkbench)
      assert.equal(saved.categoryLayout, 'popover'); assert.equal(saved.columns[0].width, 187); assert.equal(saved.columns[0].frozen, 'left')
      assert.equal(await page.locator('[data-unsaved]').count(), 1)
    }
    checks++; await context.close(); contexts.splice(contexts.indexOf(context), 1)
  }
  assert.deepEqual(errors, [])
  console.log(`PASS list layouts Chrome: ${checks} groups, both pages, light/dark 1920/1366/900/375, independent native scrolling, no page errors`)
} finally { for (const context of contexts) await context.close(); await browser?.close(); await server?.close(); removeTestRuntime(runtime) }
