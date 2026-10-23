import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
const output = resolve('work/compatibility-benefit-refinement/async-save/browser'); mkdirSync(output, { recursive: true })
const server = await createServer({ cacheDir: resolve(output, 'vite-cache'), server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } })
const checks = [], diagnostics = []
let browser
try {
  const { createTemplateCompatibilityFixture } = await server.ssrLoadModule('/scripts/template-compatibility-fixtures.ts')
  const { ensureProductListPages } = await server.ssrLoadModule('/src/domain/productListPages.ts')
  const fixture = createTemplateCompatibilityFixture(), { data, modelId } = fixture
  data.activeRole = 'admin'; ensureProductListPages(data)
  data.productListPages.sku.skuWorkbench.activeId = 'sku-system-all'; data.productListPages.sku.skuWorkbench.defaultId = 'sku-system-all'
  if (!data.templates.some(item => item.id === modelId)) data.templates.push({ id: modelId, name: '独立异步保存模型', enabled: true, parentId: null, structureOrder: [] })
  await server.listen(); const base = `http://127.0.0.1:${server.httpServer.address().port}`
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true })
  async function context(path) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: 'zh-CN', timezoneId: 'Asia/Singapore', reducedMotion: 'reduce' })
    await ctx.addInitScript(data => { if (!localStorage.getItem('iyge-v2-mock-db')) localStorage.setItem('iyge-v2-mock-db', JSON.stringify({ version: 15, data })); localStorage.setItem('iyge-spec-cat-fold', '0'); localStorage.setItem('iyge-spec-rail-fold', '0'); const set = Storage.prototype.setItem; window.__writes = []; Storage.prototype.setItem = function(key, value) { if (key === 'iyge-v2-mock-db') window.__writes.push(value); return set.call(this, key, value) } }, data)
    const page = await ctx.newPage(); page.setDefaultTimeout(15000)
    page.on('pageerror', error => diagnostics.push(String(error))); page.on('console', event => { if (event.type() === 'error' || event.text().includes('[Vue warn]')) diagnostics.push(event.text()) })
    await page.goto(base + path, { waitUntil: 'networkidle' }); await settle(page)
    await page.evaluate(async () => { window.__actions = []; (await import('/src/stores/catalog.ts')).useCatalogStore().$onAction(({ name }) => window.__actions.push(name)) })
    return { ctx, page }
  }
  const live = page => page.evaluate(async () => JSON.parse(JSON.stringify((await import('/src/stores/catalog.ts')).useCatalogStore().data)))
  const disk = page => page.evaluate(() => localStorage.getItem('iyge-v2-mock-db'))
  const settle = page => page.evaluate(async () => { await (await import('/node_modules/.vite/deps/vue.js')).nextTick(); await (await import('/src/stores/catalog.ts')).useCatalogStore().waitForPersistence() })
  const mark = (name, detail = {}) => { checks.push({ name, result: 'PASS', ...detail }); console.log(`PASS async browser ${name}`) }
  async function hold(page) {
    await page.evaluate(async () => { const { CATALOG_LOCK } = await import('/src/stores/catalogPersistence.ts'); window.__held = false; window.__holding = navigator.locks.request(CATALOG_LOCK, () => new Promise(resolve => { window.__held = true; window.__release = resolve })) })
    await page.waitForFunction(() => window.__held)
  }
  const waiting = page => page.waitForFunction(async () => (await navigator.locks.query()).pending.length > 0)
  const release = page => page.evaluate(() => window.__release())
  async function option(page, select, text) { await select.locator('.el-select__suffix').click(); await page.locator('.el-select-dropdown:visible [role=option]').filter({ hasText: text }).first().click(); await page.locator('.el-select-dropdown:visible').waitFor({ state: 'hidden' }) }

  {
    const { ctx, page } = await context('/models'), type = data.productTypes.find(item => item.id === 'type-case'), category = data.categories.find(item => item.id === type.categoryId)
    await page.getByRole('button', { name: '新建模型', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '新建模型', exact: true })
    await dialog.locator('[data-category-tree-select] .trigger').click(); await page.getByPlaceholder('搜索分类').fill(category.name)
    await page.locator(`[data-category-id="${category.id}"] .node`).click()
    await option(page, dialog.locator('.el-select'), type.name)
    const input = dialog.getByPlaceholder('例如：手机标准模型'); await input.fill('持锁创建只产生一个模型')
    const before = await live(page), stored = await disk(page)
    await hold(page); const create = dialog.getByRole('button', { name: '创建', exact: true }); await create.click(); await waiting(page)
    assert(await input.isDisabled()); assert(await dialog.getByRole('button', { name: '取消', exact: true }).isDisabled()); assert.equal(await disk(page), stored)
    await create.evaluate(button => { button.click(); button.click() }); await page.keyboard.press('Escape'); assert(await dialog.isVisible())
    await page.screenshot({ path: resolve(output, 'model-create-held.png') }); await release(page)
    await page.waitForURL(/\/specs\?/); await settle(page)
    const after = await live(page); assert.equal(after.templates.length, before.templates.length + 1); assert.equal(after.specCanvases.filter(item => item.name === '持锁创建只产生一个模型').length, 1)
    assert.equal(await page.evaluate(() => window.__actions.filter(name => name === 'createProductModel').length), 1)
    mark('model-create-held-lock-input-close-and-double-submit-guard')
    await page.goto(base + '/models', { waitUntil: 'networkidle' }); await settle(page)
    const row = page.locator('.el-table__row').filter({ hasText: '持锁创建只产生一个模型' }), copy = row.getByRole('button', { name: '复制模型', exact: true }), beforeCopy = await live(page)
    await hold(page); await copy.click(); await waiting(page); assert(await copy.isDisabled()); await copy.evaluate(button => { button.click(); button.click() }); await release(page)
    await page.waitForFunction(async count => (await import('/src/stores/catalog.ts')).useCatalogStore().data.templates.length === count + 1, beforeCopy.templates.length); await settle(page)
    assert.equal((await live(page)).templates.length, beforeCopy.templates.length + 1); mark('model-list-copy-held-lock-double-submit-one-copy'); await ctx.close()
  }
  {
    const { ctx, page } = await context(`/specs?template=${modelId}`)
    await page.evaluate(async modelId => { const s = (await import('/src/stores/catalog.ts')).useCatalogStore(); s.data.productSpecNodes.find(node => node.templateId === modelId && node.nodeType === 'VALUE').sort += 100; await s.flushPersistence() }, modelId)
    await hold(page); const save = page.getByRole('button', { name: '保存模型', exact: true }); await save.click(); await waiting(page)
    assert(await save.isDisabled()); await save.evaluate(button => { button.click(); button.click() }); await page.keyboard.press('Control+s'); assert.equal(await page.evaluate(() => window.__actions.filter(name => name === 'saveModelDraft').length), 1)
    await release(page); await page.waitForFunction(async () => (await import('/src/stores/catalog.ts')).useCatalogStore().persistenceState.pending === 0); await settle(page)
    assert.equal(await page.evaluate(() => window.__actions.filter(name => name === 'saveModelDraft').length), 1); mark('designer-save-held-lock-duplicate-click-shortcut-one-command')
    const copyTrigger = page.locator('.rail-actions').getByRole('button', { name: '复制模型', exact: true })
    await copyTrigger.click()
    const dialog = page.getByRole('dialog', { name: '复制模型', exact: true }), input = dialog.getByPlaceholder('例如：二手机模型')
    await input.fill('持锁设计器复制一次'); const before = await live(page), confirm = dialog.getByRole('button', { name: '确认复制', exact: true })
    await hold(page); await confirm.click(); await waiting(page); assert(await input.isDisabled()); assert(await dialog.getByRole('button', { name: '取消', exact: true }).isDisabled()); await confirm.evaluate(button => { button.click(); button.click() }); await page.keyboard.press('Escape'); assert(await dialog.isVisible()); await release(page)
    await dialog.waitFor({ state: 'hidden' }); await settle(page); assert.equal((await live(page)).templates.length, before.templates.length + 1); mark('designer-copy-held-lock-name-close-and-double-submit-guard'); await ctx.close()
  }
  {
    const { ctx, page } = await context('/skus')
    await page.getByRole('button', { name: '另存为', exact: true }).click(); const dialog = page.getByRole('dialog', { name: '另存为', exact: true }), input = dialog.getByPlaceholder('视图名称')
    await input.fill('持锁SKU视图只保存一次'); const before = await live(page), stored = await disk(page)
    await hold(page); const create = dialog.getByRole('button', { name: '创建', exact: true }); await create.click(); await waiting(page)
    assert(await input.isDisabled()); assert(await dialog.getByRole('button', { name: '取消', exact: true }).isDisabled()); assert.equal(await disk(page), stored)
    await create.evaluate(button => { button.click(); button.click() }); await page.keyboard.press('Escape'); assert(await dialog.isVisible()); await release(page)
    await dialog.waitFor({ state: 'hidden' }); await settle(page); const after = await live(page)
    assert.equal(after.productListPages.sku.views.length, before.productListPages.sku.views.length + 1); assert.deepEqual(after.productListPages.spu, before.productListPages.spu)
    assert.equal(after.productListPages.sku.views.filter(view => view.name === '持锁SKU视图只保存一次').length, 1)
    mark('SKU-name-held-lock-one-view-and-SPU-isolation'); await ctx.close()
  }
  {
    const { ctx, page } = await context('/skus/phone-unbound')
    await page.locator('[data-detail-compatibility]').click()
    const drawer = page.locator('[data-accessory-drawer]:visible'); await drawer.waitFor(); await drawer.getByRole('button', { name: '配置设备型号', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '配置设备型号', exact: true }); await option(page, dialog.locator('[data-binding-host]'), 'Orion A')
    const before = await live(page), stored = await disk(page), bind = dialog.getByRole('button', { name: '确认绑定型号', exact: true })
    await hold(page); await bind.click(); await waiting(page)
    assert(await dialog.locator('[data-binding-host] input').isDisabled()); assert(await dialog.getByRole('button', { name: '关闭', exact: true }).isDisabled()); assert.equal(await disk(page), stored)
    await bind.evaluate(button => { button.click(); button.click() }); await page.keyboard.press('Escape'); assert(await dialog.isVisible()); await release(page)
    await dialog.waitFor({ state: 'hidden' }); await settle(page); const after = await live(page)
    assert.equal(after.deviceBindings.filter(item => item.skuId === 'phone-unbound').length, 1); assert.deepEqual(after.compatibilities, before.compatibilities)
    assert.equal(await page.evaluate(() => window.__actions.filter(name => name === 'commitDeviceBinding').length), 1)
    mark('device-binding-held-lock-fields-close-escape-one-command'); await ctx.close()
  }
  assert.deepEqual(diagnostics, [])
  writeFileSync(resolve(output, 'result.json'), JSON.stringify({ result: 'PASS', browser: browser.version(), barrier: 'actual navigator.locks held until UI disabled/duplicate checks finish', checks, diagnostics }, null, 2))
} catch (error) { writeFileSync(resolve(output, 'result.json'), JSON.stringify({ result: 'FAIL', error: String(error), checks, diagnostics }, null, 2)); throw error }
finally { await browser?.close(); await server.close() }
