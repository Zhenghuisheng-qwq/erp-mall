import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import { createTestRuntime, removeTestRuntime } from './test-runtime.mjs'
const runtime = createTestRuntime('free-combination-return'), servers = [], contexts = [], errors = []
let browser, groups = 0
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  for (const strict of [false, true]) {
    const server = await createServer({ cacheDir: `${runtime}/${strict}`, logLevel: 'silent', define: { 'import.meta.env.VITE_RBAC_ENFORCEMENT': JSON.stringify(String(strict)) }, server: { host: '127.0.0.1', port: 0, hmr: false, watch: null, ws: false } }); servers.push(server)
    const { createFreeCombinationFixture } = await server.ssrLoadModule('/scripts/free-combination-fixture.ts')
    const { ensureProductListPages } = await server.ssrLoadModule('/src/domain/productListPages.ts')
    const { defaultSkuConfig, SYSTEM_SKU_VIEW_ID } = await server.ssrLoadModule('/src/domain/skuWorkbenchState.ts')
    const { normalizeStored } = await server.ssrLoadModule('/src/stores/catalog.ts')
    const { DATA_VERSION } = await server.ssrLoadModule('/src/domain/types.ts')
    const f = createFreeCombinationFixture(); ensureProductListPages(f.data)
    const config = defaultSkuConfig(); config.sortMode = 'manual'; config.categoryLayout = 'sidebar'; config.columns = [{ key: 'code', visible: true }, { key: 'name', visible: true }]
    f.data.productListPages.sku.skuWorkbench.working[`${SYSTEM_SKU_VIEW_ID}@spu:${f.ids.familyDevice}`] = config
    f.data.productListPages.sku.query.pageSize = 50
    const data = normalizeStored({ version: DATA_VERSION, data: f.data })
    await server.listen(); const base = `http://127.0.0.1:${server.httpServer.address().port}`
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, locale: 'zh-CN', reducedMotion: 'reduce' }); contexts.push(context)
    await context.addInitScript(({ data, version }) => { if (location.protocol === 'http:' && !localStorage.getItem('iyge-v2-mock-db')) localStorage.setItem('iyge-v2-mock-db', JSON.stringify({ version, data })) }, { data, version: DATA_VERSION })
    const page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', error => errors.push(String(error)))
    const path = `/skus?spu=${f.ids.familyDevice}`
    await page.goto(base + path, { waitUntil: 'networkidle' })
    await page.locator(`[data-pick-id="${f.ids.phoneB}"]`).waitFor()
    await page.evaluate(async () => { window.__returnStore = (await import('/src/stores/catalog.ts')).useCatalogStore(); await window.__returnStore.waitForPersistence() })
    const before = await page.evaluate(() => localStorage.getItem('iyge-v2-mock-db'))
    await page.locator(`[data-pick-id="${f.ids.phoneB}"]`).click()
    await page.getByRole('button', { name: '加入排序暂存区', exact: true }).click()
    await page.locator('[aria-label="选择 SKU PHONE-B"]').click()
    await page.locator(`[data-row-more="${f.ids.phoneA}"]`).click()
    await page.locator(`[data-compose-benefit="${f.ids.phoneA}"]`).click()
    await page.waitForURL(url => url.pathname === '/benefit-packages/new')
    assert.equal(new URL(page.url()).searchParams.get('device'), f.ids.phoneA)
    assert.equal(new URL(page.url()).searchParams.get('returnTo'), path)
    assert.equal(await page.getByRole('dialog', { name: '清空暂存', exact: true }).count(), 0)
    assert.equal(await page.evaluate(() => localStorage.getItem('iyge-v2-mock-db')), before); groups++
    await page.getByRole('button', { name: '返回原页面', exact: true }).click()
    await page.waitForURL(base + path)
    await page.getByRole('button', { name: '展开暂存 1', exact: true }).waitFor()
    assert(await page.locator('[aria-label="选择 SKU PHONE-B"] input').isChecked())
    assert.equal(await page.locator('[data-category-side]').count(), 1)
    await page.getByRole('button', { name: '展开暂存 1', exact: true }).click()
    const staged = page.getByRole('dialog', { name: '排序暂存区', exact: true }); await staged.waitFor()
    assert.match(await staged.textContent(), /phone-b|PHONE-B/)
    assert.equal(await staged.locator('.el-alert').count(), 0, 'restored staging must retain its valid scope context')
    await staged.locator('.el-drawer__close-btn').click(); await staged.waitFor({ state: 'hidden' })
    await page.evaluate(async () => window.__returnStore.waitForPersistence())
    assert.equal(await page.evaluate(() => localStorage.getItem('iyge-v2-mock-db')), before); groups++
    await context.close(); contexts.splice(contexts.indexOf(context), 1)
  }
  assert.deepEqual(errors, [])
  console.log(`PASS free combination SKU return Chrome: ${groups} default/strict groups, scope/selection/staging/preferences unchanged`)
} finally { for (const context of contexts) await context.close(); await browser?.close(); for (const server of servers) await server.close(); removeTestRuntime(runtime) }
