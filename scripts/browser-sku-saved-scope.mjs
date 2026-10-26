import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import { createTestRuntime, removeTestRuntime } from './test-runtime.mjs'

const runtime = createTestRuntime('sku-saved-scope'), errors = []
let browser, server, groups = 0
const mark = name => { groups++; console.log(`PASS ${name}`) }
const business = data => JSON.stringify([data.families, data.skus, data.specModelVersions, data.planningRecords, data.compatibilities, data.materialRelations, data.benefitPackages, data.benefitDeliveries])
try {
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true })
  for (const strict of [false, true]) {
    server = await createServer({ cacheDir: resolve(runtime, strict ? 'vite-strict' : 'vite-default'), logLevel: 'error', define: { 'import.meta.env.VITE_RBAC_ENFORCEMENT': JSON.stringify(String(strict)) }, server: { host: '127.0.0.1', port: 0, hmr: false, watch: null, ws: false } })
    const { createAccessoryCompatibilityFixture } = await server.ssrLoadModule('/scripts/accessory-compatibility-fixtures.ts')
    const { ensureProductListPages } = await server.ssrLoadModule('/src/domain/productListPages.ts')
    const { ensureSkuWorkbench, defaultSkuConfig, SYSTEM_SKU_VIEW_ID } = await server.ssrLoadModule('/src/domain/skuWorkbenchState.ts')
    const { ensureRbac } = await server.ssrLoadModule('/src/domain/rbac.ts')
    const { DATA_VERSION } = await server.ssrLoadModule('/src/domain/types.ts')
    const { isRealSku } = await server.ssrLoadModule('/src/domain/catalogIdentity.ts')
    await server.listen()
    const base = `http://127.0.0.1:${server.httpServer.address().port}`
    for (const shape of ['OR', 'nested OR', 'AND']) {
      const { data } = createAccessoryCompatibilityFixture(); ensureRbac(data); ensureProductListPages(data); ensureSkuWorkbench(data)
      const config = defaultSkuConfig()
      const rules = [{ kind: 'rule', id: 'original-status', field: 'status', operator: 'eq', value: 'on_sale' }, { kind: 'rule', id: 'original-name', field: 'name', operator: 'contains', value: 'phone-a' }]
      config.conditions = { kind: 'group', id: 'root', logic: shape === 'AND' ? 'all' : 'any', children: shape === 'nested OR' ? [{ kind: 'group', id: 'original-group', logic: 'any', children: rules }] : rules }
      config.quickFilters = rules.map(rule => ({ source: 'condition', ruleId: rule.id }))
      data.productListPages.sku.skuWorkbench.working[`${SYSTEM_SKU_VIEW_ID}@spu:family-device`] = config
      const context = await browser.newContext({ viewport: { width: 1366, height: 1000 }, locale: 'zh-CN', reducedMotion: 'reduce' })
      await context.addInitScript(({ data, version }) => {
        if (location.protocol !== 'http:') return
        if (!localStorage.getItem('iyge-v2-mock-db')) localStorage.setItem('iyge-v2-mock-db', JSON.stringify({ version, data }))
        const original = Storage.prototype.setItem
        Storage.prototype.setItem = function(key, value) { if (key === 'iyge-v2-mock-db' && window.__quota) throw new DOMException('saved-scope fixture quota', 'QuotaExceededError'); return original.call(this, key, value) }
      }, { data, version: DATA_VERSION })
      const page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', error => errors.push(String(error)))
      const mountStore = async () => { try { await page.locator('[data-sku-workbench]').waitFor() } catch (error) { console.error('FAIL SKU page mount', page.url(), (await page.locator('body').innerText()).slice(0, 1500), errors); throw error }; await page.evaluate(async () => { window.__store = (await import('/src/stores/catalog.ts')).useCatalogStore(); await window.__store.waitForPersistence() }) }
      const settle = async () => { await page.waitForFunction(() => document.querySelector('[data-sku-workbench]')?.getAttribute('aria-busy') === 'false'); await page.evaluate(async () => { await window.__store.waitForPersistence(); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))) }) }
      const read = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__store.data)))
      const raw = () => page.evaluate(() => localStorage.getItem('iyge-v2-mock-db'))
      const visibleIds = () => page.locator('[data-order-row]').evaluateAll(items => items.map(item => item.getAttribute('data-order-row')).sort())
      const allRuleEntries = root => root.children.flatMap(node => node.kind === 'rule' ? [node] : allRuleEntries(node))
      const selectSaved = async id => { await page.locator('[data-more-views]').click(); await page.getByRole('textbox', { name: '搜索视图', exact: true }).fill('明确保存范围'); await page.locator(`[data-saved-view="${id}"]`).click(); await settle() }
      await page.goto(base + '/skus?spu=family-device', { waitUntil: 'networkidle' }); await mountStore()
      assert.equal(await page.evaluate(() => window.__store.rbacEnforced), strict)
      const originalBusiness = business(await read())
      await page.getByRole('button',{name:'常用筛选管理',exact:true}).click(); await page.locator('[data-clear-exposed-values]:visible').click(); await settle()
      const cleared = (await read()).productListPages.sku.skuWorkbench.working[`${SYSTEM_SKU_VIEW_ID}@spu:family-device`]
      assert.deepEqual(allRuleEntries(cleared.conditions).map(rule => ({ id: rule.id, operator: rule.operator, active: rule.active, value: rule.value })), rules.map(rule => ({ id: rule.id, operator: rule.operator, active: false, value: null })))
      assert.deepEqual(cleared.quickFilters, config.quickFilters); assert.deepEqual(await visibleIds(), ['phone-a', 'phone-b'])
      mark(`${strict ? 'strict' : 'default'} ${shape}: actual exposed clear keeps rule IDs/operators/exposure and temporary SPU result`)
      await page.locator('[data-manage-current-view]').click(); await page.getByRole('button', { name: '另存为', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: '另存为', exact: true })
      await dialog.getByPlaceholder('视图名称').fill('明确保存范围')
      await dialog.getByRole('checkbox', { name: '将当前 SPU 范围保存为条件', exact: true }).locator('xpath=ancestor::label').click()
      if (shape === 'OR') {
        const before = JSON.stringify(await read()), beforeRaw = await raw()
        await page.evaluate(() => window.__quota = true); await dialog.getByRole('button', { name: '创建', exact: true }).click()
        await dialog.getByRole('alert').waitFor(); await settle()
        assert.equal(JSON.stringify(await read()), before); assert.equal(await raw(), beforeRaw)
        assert.equal(await dialog.getByPlaceholder('视图名称').inputValue(), '明确保存范围')
        assert.equal(await dialog.getByRole('checkbox').isChecked(), true)
        await page.evaluate(() => window.__quota = false)
        mark(`${strict ? 'strict' : 'default'} scope save quota refusal preserves Store/raw and complete dialog input for retry`)
      }
      await dialog.getByRole('button', { name: '创建', exact: true }).click(); await dialog.waitFor({ state: 'hidden' }); await settle()
      const saved = (await read()).productListPages.sku.views.filter(view => view.name === '明确保存范围'); assert.equal(saved.length, 1)
      const savedView = saved[0], savedConfig = savedView.skuWorkbench
      assert(allRuleEntries(savedConfig.conditions).some(rule => rule.field === 'familyId' && rule.value === 'family-device' && rule.active !== false))
      assert.deepEqual(allRuleEntries(savedConfig.conditions).filter(rule => rule.id.startsWith('original-')), allRuleEntries(cleared.conditions)); assert.deepEqual(savedConfig.quickFilters, config.quickFilters)
      await page.getByRole('button', { name: '查看全部 SKU', exact: true }).click(); await settle(); assert.equal(new URL(page.url()).search, '')
      await selectSaved(savedView.id); assert.deepEqual(await visibleIds(), ['phone-a', 'phone-b'])
      assert.match(await page.locator('[data-result-count]').innerText(), /SKU 2 条/)
      await page.reload({ waitUntil: 'networkidle' }); await mountStore(); await settle()
      assert.equal(await page.locator('.view-bar').getAttribute('data-view-id'), savedView.id); assert.deepEqual(await visibleIds(), ['phone-a', 'phone-b'])
      const persisted = JSON.parse(await raw()).data.productListPages.sku.views.find(view => view.id === savedView.id)
      assert.deepEqual(persisted.skuWorkbench.conditions, savedConfig.conditions); assert.equal(business(await read()), originalBusiness)
      mark(`${strict ? 'strict' : 'default'} ${shape}: actual checkbox save, leave scope, reopen named view and browser refresh retain exact SPU result/history`)
      if (shape === 'OR') {
        // Omitting the checkbox deliberately keeps this a temporary range.
        await page.goto(base + '/skus?spu=family-device', { waitUntil: 'networkidle' }); await mountStore(); await settle()
        await page.locator('[data-manage-current-view]').click(); await page.getByRole('button', { name: '另存为', exact: true }).click(); const unscopedDialog = page.getByRole('dialog', { name: '另存为', exact: true })
        await unscopedDialog.getByPlaceholder('视图名称').fill('不保存临时范围'); assert.equal(await unscopedDialog.getByRole('checkbox').isChecked(), false)
        await unscopedDialog.getByRole('button', { name: '创建', exact: true }).click(); await unscopedDialog.waitFor({ state: 'hidden' }); await settle()
        const loose = (await read()).productListPages.sku.views.find(view => view.name === '不保存临时范围'); assert(loose)
        assert.equal(allRuleEntries(loose.skuWorkbench.conditions).some(rule => rule.field === 'familyId'), false)
        await page.getByRole('button', { name: '查看全部 SKU', exact: true }).click(); await settle()
        await page.locator('[data-more-views]').click(); await page.getByRole('textbox', { name: '搜索视图', exact: true }).fill('不保存临时范围'); await page.locator(`[data-saved-view="${loose.id}"]`).click(); await settle()
        const expectedIds = data.skus.filter(sku => isRealSku(data, sku)).map(sku => sku.id).sort(), actualIds = await visibleIds()
        assert.match(await page.locator('[data-result-count]').innerText(), new RegExp(`SKU ${expectedIds.length} 条`))
        while (actualIds.length < expectedIds.length) { await page.locator('.el-pagination').getByLabel('下一页').click(); await settle(); actualIds.push(...await visibleIds()) }
        assert.deepEqual(actualIds.sort(), expectedIds)
        assert.equal(business(await read()), originalBusiness)
        mark(`${strict ? 'strict' : 'default'} actual unchecked save keeps no permanent scope after leaving temporary SPU`)
      }
      await context.close()
    }
    {
      const { data } = createAccessoryCompatibilityFixture(); ensureRbac(data); ensureProductListPages(data); ensureSkuWorkbench(data)
      data.compatibilities = data.compatibilities.filter(link => link.id !== 'decl-charger-basic')
      const onlyFast = data.compatibilities.find(link => link.id === 'decl-charger-fast'); assert(onlyFast)
      onlyFast.conclusion = 'compatible'; onlyFast.conditions = []
      const context = await browser.newContext({ viewport: { width: 1366, height: 1000 }, locale: 'zh-CN', reducedMotion: 'reduce' })
      await context.addInitScript(({ data, version }) => { if (location.protocol === 'http:' && !localStorage.getItem('iyge-v2-mock-db')) localStorage.setItem('iyge-v2-mock-db', JSON.stringify({ version, data })) }, { data, version: DATA_VERSION })
      const page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', error => errors.push(String(error)))
      await page.goto(base + '/skus', { waitUntil: 'networkidle' }); await page.locator('[data-sku-workbench]').waitFor()
      await page.evaluate(async () => { window.__store = (await import('/src/stores/catalog.ts')).useCatalogStore(); await window.__store.waitForPersistence() })
      const before = await page.evaluate(() => localStorage.getItem('iyge-v2-mock-db'))
      const phoneRow = page.locator('.el-table__row').filter({ has: page.locator('[data-order-row="phone-a"]') })
      await phoneRow.getByRole('button', { name: '更多 SKU 操作 PHONE-A', exact: true }).click()
      await page.getByRole('menuitem', { name: '适用配件', exact: true }).click()
      const drawer = page.locator('[data-accessory-drawer]'); await drawer.waitFor()
      await drawer.locator('[data-accessory-match="case-sku"]').waitFor()
      assert.equal(await drawer.locator('[data-accessory-match="charger-sku"]').count(), 0)
      assert.match(await drawer.locator('[data-accessory-match="case-sku"] .match-status').innerText(), /基本使用：适用/)
      mark(`${strict ? 'strict' : 'default'} real device drawer recommends ordinary basic-only accessory and excludes fast-only from sales`)
      await drawer.getByRole('tab', { name: /待处理/ }).click()
      const ability = drawer.locator('[data-accessory-match="charger-sku"]'); await ability.waitFor()
      assert.match(await ability.locator('.match-status').innerText(), /基本使用：待确认/)
      assert.match(await ability.locator('.match-status').innerText(), /能力资料汇总：有条件适用/)
      assert.match(await ability.locator('.capability-line').innerText(), /快充[\s\S]*适用/)
      await ability.locator('summary').click(); assert.match(await ability.locator('.evidence-row').innerText(), /销售 SKU|快充/)
      assert.equal(await page.evaluate(() => localStorage.getItem('iyge-v2-mock-db')), before)
      mark(`${strict ? 'strict' : 'default'} fast-only remains inspectable in management pending, with basic pending and separate capability evidence; reading writes nothing`)
      await context.close()
    }
    await server.close(); server = undefined
  }
  assert.deepEqual(errors, [], 'No rendering/Store exceptions')
  console.log(`PASS browser SKU saved scope ${groups} default/strict groups`)
} finally { if (browser) await browser.close(); if (server) await server.close(); removeTestRuntime(runtime) }
