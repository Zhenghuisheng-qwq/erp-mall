import assert from 'node:assert/strict'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'

const before = process.argv.includes('--before')
const source = resolve(before ? process.env.SKU_FIX_BASELINE || 'work/sku-workbench-fixes/baseline' : '.')
if (!existsSync(resolve(source, 'src/domain/skuWorkbenchQuery.ts'))) throw new Error(`Missing complete SKU fix source baseline: ${source}. Restore commit 2a0b1cc771c23620dab3f117f22fbfc98458f525 or set SKU_FIX_BASELINE.`)
const output = resolve(process.env.SKU_FIX_OUTPUT_DIR || `work/sku-workbench-fixes/browser-${before ? 'before' : 'after'}`)
mkdirSync(output, { recursive: true })
const server = await createServer({ root: source, cacheDir: resolve(output, 'vite-cache'), server: { host: '127.0.0.1', port: 0, open: false, hmr: false, watch: null } })
const checks = [], diagnostics = [], screenshots = []
let browser
const copy = value => JSON.parse(JSON.stringify(value))
const business = data => Object.fromEntries(Object.entries(data).filter(([key]) => !['productListPages', 'productListViews', 'activeProductListViewId', 'listQuery', 'listViews', 'activeViewId', 'productListMode'].includes(key)))
try {
  const { createSeed, emptyQuery, defaultColumns } = await server.ssrLoadModule('/src/domain/seed.ts')
  const { ensureProductListPages } = await server.ssrLoadModule('/src/domain/productListPages.ts')
  const { defaultSkuConfig, createSkuSavedView } = await server.ssrLoadModule('/src/domain/skuWorkbenchState.ts')
  const fixture = createSeed()
  const template = fixture.templates[0], family = fixture.families[0]
  assert.ok(template && family && fixture.params.some(param => param.id === 'p-color'))
  fixture.templates.push({ ...copy(template), id: 'fix-bound', name: '颜色适用方案' }, { ...copy(template), id: 'fix-unbound', name: '颜色不适用方案' })
  fixture.templateParams.push({ templateId: 'fix-bound', paramId: 'p-color', role: 'variant', required: false })
  fixture.families = [
    { ...copy(family), id: 'fix-family-bound', name: '收尾适用 SPU', line: 'v2', templateId: 'fix-bound', commonAttrs: {}, updatedAt: '2026-10-23T04:00:00.000Z' },
    { ...copy(family), id: 'fix-family-unbound', name: '收尾不适用 SPU', line: 'v2', templateId: 'fix-unbound', commonAttrs: {}, updatedAt: '2026-10-23T04:00:00.000Z' },
  ]
  fixture.skus = ['s1', 's2', 's3'].map(id => ({ id, code: id, familyId: id === 's2' ? 'fix-family-unbound' : 'fix-family-bound', skuName: `收尾 ${id}`, recordKind: 'sku', oaSkuId: '', status: 'on_sale', variantAttrs: {}, projectedAttrs: {}, createdAt: '2026-10-23T04:00:00Z', updatedAt: '2026-10-23T04:00:00Z' }))
  ensureProductListPages(fixture)
  const skuPage = fixture.productListPages.sku
  const config = defaultSkuConfig()
  config.groups = [{ field: 'attr:p-color', direction: 'asc' }]
  const savedId = 'fix-saved-view'
  skuPage.views.push(createSkuSavedView(savedId, '收尾验收视图', config))
  skuPage.activeId = savedId
  skuPage.skuWorkbench.activeId = savedId
  skuPage.skuWorkbench.defaultId = savedId
  skuPage.presets.push({ id: 'fix-legacy-preset', name: '收尾历史筛选', query: emptyQuery(), columns: defaultColumns() })
  await server.listen()
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true })
  async function context(name, path = '/skus', adjust) {
    const data = copy(fixture)
    adjust?.(data)
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, locale: 'zh-CN', timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' })
    await ctx.addInitScript(data => {
      const RealDate = Date, epoch = RealDate.parse('2026-10-23T04:00:00Z'), started = RealDate.now()
      window.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [epoch])) } static now() { return epoch + RealDate.now() - started } }
      if (!localStorage.getItem('iyge-v2-mock-db')) localStorage.setItem('iyge-v2-mock-db', JSON.stringify({ version: 15, data }))
      localStorage.setItem('iyge-v2-theme', 'light')
      const original = Storage.prototype.setItem
      window.__failNextDbWrite = false
      Storage.prototype.setItem = function(key, value) {
        if (key === 'iyge-v2-mock-db' && window.__failNextDbWrite) { window.__failNextDbWrite = false; throw new DOMException('收尾验收：下一次实际写入失败', 'QuotaExceededError') }
        return original.call(this, key, value)
      }
    }, data)
    const page = await ctx.newPage()
    page.setDefaultTimeout(15000)
    page.on('pageerror', error => diagnostics.push({ name, type: 'pageerror', message: String(error) }))
    page.on('console', message => { if (['error', 'warning'].includes(message.type())) diagnostics.push({ name, type: message.type(), message: message.text() }) })
    await page.goto(base + path, { waitUntil: 'networkidle' })
    await page.locator('[data-sku-workbench]').waitFor()
    return { ctx, page }
  }
  const read = page => page.evaluate(async () => JSON.parse(JSON.stringify((await import('/src/stores/catalog.ts')).useCatalogStore().data)))
  const flush = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  async function capture(page, name) { await flush(page); const path = `${name}.png`; await page.screenshot({ path: resolve(output, path), animations: 'disabled' }); screenshots.push(path) }
  function checked(name, state, verify) {
    try { verify(); checks.push({ name, result: 'PASS', state }) }
    catch (error) { checks.push({ name, result: 'FAIL', message: String(error), state }); if (!before) throw error }
  }
  async function navigate(page, path) { await page.evaluate(async path => (await import('/src/router/index.ts')).default.push(path), path); await page.waitForURL(base + path) }
  async function select(page, id) {
    const tab = page.locator(`[data-view-tab="${id}"]`)
    if (await tab.count()) await tab.click()
    else { await page.locator('[data-more-views]').click(); await page.locator(`[data-saved-view="${id}"]`).click() }
    await page.waitForFunction(id => document.querySelector('.list-switch')?.getAttribute('data-view-id') === id, id)
  }
  async function more(page, name) { await page.getByRole('button', { name: '更多', exact: true }).click(); await page.locator('.more-menu:visible').getByRole('button', { name, exact: true }).click() }

  const grouping = await context('grouping')
  const groupingBusiness = business(await read(grouping.page))
  const shown = await grouping.page.locator('.sku-table [data-sku-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-sku-id')))
  const labels = await grouping.page.locator('.group-heading:visible').allInnerTexts()
  await capture(grouping.page, 'dynamic-empty-not-applicable')
  checked('grouped-matches-displayed-once', { shown, labels }, () => {
    assert.equal(shown.length, 3)
    assert.equal(new Set(shown).size, 3)
    assert.deepEqual([...shown].sort(), ['s1', 's2', 's3'])
    assert.equal(labels.filter(label => label.includes('未记录')).length, 1)
    assert.equal(labels.filter(label => label.includes('不适用')).length, 1)
  })
  assert.deepEqual(business(await read(grouping.page)), groupingBusiness)
  await grouping.ctx.close()

  const migration = await context('migration'), migratedId = 'sku-preset:fix-legacy-preset'
  const migrationBusiness = business(await read(migration.page))
  assert.ok((await read(migration.page)).productListPages.sku.views.some(view => view.id === migratedId))
  await select(migration.page, migratedId)
  await more(migration.page, '收藏视图'); await migration.page.getByRole('heading', { name: 'SKU 管理', exact: true }).click()
  await more(migration.page, '设为默认视图'); await migration.page.getByRole('heading', { name: 'SKU 管理', exact: true }).click()
  await more(migration.page, '删除视图')
  const deletion = migration.page.getByRole('dialog', { name: '删除视图', exact: true })
  assert.match(await deletion.innerText(), /不删除任何商品/)
  await deletion.getByRole('button', { name: '确定', exact: true }).click()
  await deletion.waitFor({ state: 'hidden' }); await flush(migration.page)
  assert.equal((await read(migration.page)).productListPages.sku.views.some(view => view.id === migratedId), false)
  await navigate(migration.page, '/spus'); await migration.page.locator('.spu-table').waitFor()
  await navigate(migration.page, '/skus'); await migration.page.locator('[data-sku-workbench]').waitFor()
  const reentered = (await read(migration.page)).productListPages.sku
  await migration.page.reload({ waitUntil: 'networkidle' })
  const reloaded = (await read(migration.page)).productListPages.sku
  await capture(migration.page, 'deleted-preset-after-refresh')
  checked('deleted-preset-stays-deleted-reentry-refresh', { reentered, reloaded }, () => {
    for (const page of [reentered, reloaded]) {
      assert.equal(page.views.some(view => view.id === migratedId), false)
      assert.ok(page.presets.some(preset => preset.id === 'fix-legacy-preset'))
      assert.ok(page.views.some(view => view.id === page.skuWorkbench.defaultId))
      assert.ok(page.views.some(view => view.id === page.skuWorkbench.activeId))
      assert.equal(page.skuWorkbench.favorites.includes(migratedId), false)
      assert.equal(page.skuWorkbench.order.includes(migratedId), false)
      assert.equal(Object.hasOwn(page.skuWorkbench.working, migratedId), false)
    }
  })
  assert.deepEqual(business(await read(migration.page)), migrationBusiness)
  await migration.ctx.close()

  for (const scoped of [false, true]) {
    const name = scoped ? 'scoped-restore' : 'saved-restore'
    const entry = await context(name, scoped ? '/skus?spu=fix-family-bound' : '/skus', data => {
      data.productListPages.sku.views.find(view => view.id === savedId).skuWorkbench.groups = []
      if (!scoped) data.productListPages.sku.query.pageSize = 1
    })
    const { page } = entry, originalBusiness = business(await read(page))
    await more(page, '分组与显示')
    const display = page.getByRole('dialog', { name: 'SKU 展示配置', exact: true })
    await display.getByText('紧凑', { exact: true }).click()
    await display.getByRole('button', { name: '应用配置', exact: true }).click()
    await display.waitFor({ state: 'hidden' }); await flush(page)
    assert.ok(await page.locator('[data-unsaved]').isVisible())
    assert.ok(await page.locator('.sku-table.compact').isVisible())
    if (!scoped) {
      await page.locator('.el-pagination .btn-next').click()
      await page.waitForFunction(() => document.querySelector('.el-pager .is-active')?.textContent?.trim() === '2')
      await flush(page)
    }
    const pageBefore = await page.locator('.el-pager .is-active').innerText()
    const diskBefore = await page.evaluate(() => localStorage.getItem('iyge-v2-mock-db'))
    await page.evaluate(() => { window.__failNextDbWrite = true })
    const restore = page.getByRole('button', { name: '恢复已保存配置', exact: true }).first()
    await restore.click(); await flush(page)
    const failed = { compact: await page.locator('.sku-table.compact').isVisible(), dirty: await page.locator('[data-unsaved]').isVisible(), retryEnabled: await restore.isEnabled(), page: await page.locator('.el-pager .is-active').innerText(), disk: await page.evaluate(() => localStorage.getItem('iyge-v2-mock-db')), error: await page.locator('[data-save-error]').innerText() }
    await capture(page, `${name}-failure-keeps-work`)
    checked(`${name}-failure-keeps-work-and-retry`, failed, () => { assert.ok(failed.compact); assert.ok(failed.dirty); assert.ok(failed.retryEnabled); assert.equal(failed.page, pageBefore); assert.equal(failed.disk, diskBefore); assert.match(failed.error, /无法保存到本机/) })
    if (failed.retryEnabled) {
      await restore.click(); await flush(page)
      assert.ok(await page.locator('.sku-table.comfortable').isVisible())
      assert.equal(await page.locator('[data-unsaved]').count(), 0)
      const working = (await read(page)).productListPages.sku.skuWorkbench.working
      const key = scoped ? 'sku-system-all@spu:fix-family-bound' : savedId
      assert.equal(Object.hasOwn(working, key), false)
      await page.reload({ waitUntil: 'networkidle' })
      assert.ok(await page.locator('.sku-table.comfortable').isVisible())
      assert.equal(await page.locator('[data-unsaved]').count(), 0)
      const actual = await page.locator('[data-sku-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-sku-id')).sort())
      assert.deepEqual(actual, scoped ? ['s1', 's3'] : ['s1'])
      assert.equal((await page.locator('.el-pager .is-active').innerText()).trim(), '1')
      checks.push({ name: `${name}-retry-refresh`, result: 'PASS', working, actual })
      await capture(page, `${name}-retry-success`)
    }
    assert.deepEqual(business(await read(page)), originalBusiness)
    if (scoped) {
      await page.getByRole('button', { name: '新增 SKU', exact: true }).first().click()
      await page.waitForURL('**/skus/new?spu=fix-family-bound')
      await page.getByRole('heading', { name: '新增 SKU', exact: true }).waitFor()
      checks.push({ name: 'scoped-create-entry', result: 'PASS' })
    }
    await entry.ctx.close()
  }
  const failed = checks.filter(check => check.result !== 'PASS')
  const result = { result: failed.length ? 'FAIL' : 'PASS', phase: before ? 'before' : 'after', source, browser: browser.version(), checks, screenshots, diagnostics }
  writeFileSync(resolve(output, 'result.json'), JSON.stringify(result, null, 2))
  console.log(JSON.stringify({ result: result.result, checks: checks.map(({ name, result }) => ({ name, result })), diagnostics }, null, 2))
  assert.deepEqual(diagnostics, [], 'No new browser errors or Vue warnings')
  assert.equal(failed.length, 0, 'SKU fixes browser expectations failed')
} catch (error) {
  writeFileSync(resolve(output, 'failure.json'), JSON.stringify({ error: String(error), checks, screenshots, diagnostics }, null, 2))
  throw error
} finally { await browser?.close(); await server.close() }
