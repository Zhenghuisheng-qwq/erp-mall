import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium, webkit } from 'playwright-core'
import { clickOption } from './browser-ui.mjs'

const output = resolve(process.env.SKU_WORKBENCH_OUTPUT_DIR || 'work/sku-workbench/browser')
mkdirSync(output, { recursive: true })
const server = await createServer({ cacheDir: resolve(output, 'vite-cache'), server: { host: '127.0.0.1', port: 0, open: false, watch: null, hmr: false } })
const diagnostics = [], checkpoints = [], screenshots = []
const engine = process.env.BROWSER_ENGINE || 'chromium'
let browser, page
const excluded = new Set(['productListPages', 'productListViews', 'activeProductListViewId', 'listQuery', 'listViews', 'activeViewId', 'productListMode'])
const business = data => Object.fromEntries(Object.entries(data).filter(([key]) => !excluded.has(key)))
try {
  const { createSeed } = await server.ssrLoadModule('/src/domain/seed.ts')
  const fixture = createSeed()
  const parent = fixture.families.find(item => item.templateId === 't-phone')
  assert.ok(parent, 'Fixture needs the existing phone template')
  fixture.families = [
    { ...parent, id: 'wb-spu-a', name: '工作台手机 A', categoryId: 'c-phone', commonAttrs: { 品牌: 'Apple' }, line: 'v2' },
    { ...parent, id: 'wb-spu-b', name: '工作台手机 B', categoryId: 'c-phone', commonAttrs: { 品牌: 'Apple' }, line: 'v2' },
  ]
  const row = (id, familyId, color, capacity, status) => ({ id, familyId, recordKind: 'sku', code: id.toUpperCase(), skuName: `${color || '未填颜色'} ${capacity}`, oaSkuId: '', status, variantAttrs: { 颜色: color, 容量: capacity }, projectedAttrs: {}, createdAt: '2026-10-22T02:00:00.000Z', updatedAt: '2026-10-22T03:00:00.000Z' })
  fixture.skus = [
    row('wb-a', 'wb-spu-a', '白色', '256G', 'on_sale'),
    row('wb-b', 'wb-spu-a', '黑色', '512G', 'on_sale'),
    row('wb-c', 'wb-spu-a', '白色', '512G', 'off_sale'),
    row('wb-d', 'wb-spu-b', '黑色', '512G', 'on_sale'),
    row('wb-e', 'wb-spu-b', '', '256G', 'draft'),
    { ...row('wb-material', 'wb-spu-a', '白色', '256G', 'on_sale'), recordKind: 'material', materialCode: 'MAT-WB-KEEP' },
  ]
  await server.listen()
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  try {
    browser = engine === 'webkit' ? await webkit.launch({ headless: true }) : await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true })
  } catch (error) {
    throw new Error(`Cannot run ${engine}. Install its browser runtime or set BROWSER_CHANNEL to an installed Chromium channel. This check was not skipped.`, { cause: error })
  }
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, locale: 'zh-CN', timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' })
  await context.addInitScript(({ fixture }) => {
    const RealDate = Date, epoch = RealDate.parse('2026-10-22T04:00:00.000Z'), started = RealDate.now()
    window.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [epoch])) } static now() { return epoch + RealDate.now() - started } }
    if (!localStorage.getItem('iyge-v2-mock-db')) localStorage.setItem('iyge-v2-mock-db', JSON.stringify({ version: 14, data: fixture }))
    if (!localStorage.getItem('iyge-v2-theme')) localStorage.setItem('iyge-v2-theme', 'light')
    const setItem = Storage.prototype.setItem
    window.__storageFailure = false
    window.__writes = []
    Storage.prototype.setItem = function(key, value) {
      if (key === 'iyge-v2-mock-db') {
        if (window.__storageFailure) throw new DOMException('独立验收模拟存储额度不足', 'QuotaExceededError')
        window.__writes.push(value)
      }
      return setItem.call(this, key, value)
    }
  }, { fixture })
  page = await context.newPage()
  page.setDefaultTimeout(15000)
  page.on('pageerror', error => diagnostics.push({ type: 'pageerror', message: String(error) }))
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) diagnostics.push({ type: message.type(), message: message.text() }) })
  await page.goto(base + '/skus', { waitUntil: 'networkidle' })
  const read = () => page.evaluate(async () => JSON.parse(JSON.stringify((await import('/src/stores/catalog.ts')).useCatalogStore().data)))
  const ids = async () => page.locator('.sku-table [data-sku-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-sku-id')).sort())
  const checkIds = async expected => { await page.waitForFunction(expected => { const actual = [...document.querySelectorAll('.sku-table [data-sku-id]')].map(node => node.getAttribute('data-sku-id')).sort(); return JSON.stringify(actual) === JSON.stringify([...expected].sort()) }, expected); assert.deepEqual(await ids(), [...expected].sort()) }
  const filter = () => page.getByRole('dialog', { name: '筛选 SKU', exact: true })
  const display = () => page.getByRole('dialog', { name: 'SKU 展示配置', exact: true })
  async function capture(name) { await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))) }); await page.screenshot({ path: resolve(output, `${name}.png`), animations: 'disabled' }); screenshots.push(`${name}.png`) }
  async function record(name, expected) { if (expected) await checkIds(expected); checkpoints.push({ name, ids: await ids(), data: await read() }); console.log(`PASS SKU workbench ${name}`) }
  async function selectView(id) {
    const tab = page.locator(`[data-view-tab="${id}"]`)
    if (await tab.count()) await tab.click()
    else { await page.locator('[data-more-views]').click(); await page.locator(`[data-saved-view="${id}"]`).click() }
    await page.waitForFunction(id => document.querySelector('.list-switch')?.getAttribute('data-view-id') === id, id)
  }
  async function choose(select, label) { await select.click(); await clickOption(page, label) }
  async function checkBox(name) { const input = page.getByRole('checkbox', { name, exact: true }); if (!await input.isChecked()) await page.locator('.sku-table .el-checkbox').filter({ has: input }).click() }
  async function moreAction(name) { await page.getByRole('button', { name: '更多', exact: true }).click(); await page.locator('.more-menu:visible').getByRole('button', { name, exact: true }).click(); if (name !== '删除视图') await page.getByRole('heading', { name: 'SKU 管理', exact: true }).click() }
  async function editRule(rule, field, operator, value) {
    await choose(rule.locator('[data-rule-field]'), field)
    await choose(rule.locator('[data-rule-operator]'), operator)
    const editor = rule.locator('[data-rule-value]')
    if (await editor.evaluate(node => node.matches('.el-select') || !!node.closest('.el-select'))) await choose(editor, value)
    else await rule.locator('input[data-rule-value], [data-rule-value] input').fill(value)
  }
  async function setStatusFilter(statusLabel) {
    await page.locator('[data-filter-count]').click()
    await filter().getByRole('button', { name: '重置条件', exact: true }).click()
    await filter().locator('[data-add-rule]').click()
    await editRule(filter().locator('[data-rule-id]').last(), 'SKU 状态 · SKU', '等于', statusLabel)
    await filter().getByRole('button', { name: '应用筛选', exact: true }).click()
    await filter().waitFor({ state: 'hidden' })
  }
  await selectView('sku-system-all')
  const originalBusiness = business(await read())
  const spuSettings = (await read()).productListPages.spu
  await record('system-excludes-material', ['wb-a', 'wb-b', 'wb-c', 'wb-d', 'wb-e'])
  await capture('desktop')

  // Editing and Esc cancel must neither apply predicates nor touch official views.
  const initialSettings = (await read()).productListPages.sku
  // WebKit follows Safari's pointer-focus rules for buttons; exercise the keyboard path.
  await page.locator('[data-filter-count]').focus()
  await page.keyboard.press('Enter')
  await filter().locator('[data-add-rule]').click()
  await editRule(filter().locator('[data-rule-id]').last(), 'SKU 名称 · SKU', '包含', '不存在')
  await checkIds(['wb-a', 'wb-b', 'wb-c', 'wb-d', 'wb-e'])
  await page.keyboard.press('Escape')
  await filter().waitFor({ state: 'hidden' })
  assert.deepEqual((await read()).productListPages.sku, initialSettings)
  await page.locator('[data-filter-count]').waitFor({ state: 'visible' })
  assert.equal(await page.locator('[data-filter-count]').evaluate(node => node === document.activeElement || node.contains(document.activeElement)), true, 'Esc returns focus to filter trigger')
  await record('draft-cancel-no-apply')

  await page.locator('[data-filter-count]').click()
  await filter().getByText('任一条件', { exact: true }).click()
  for (const [color, capacity] of [['白色', '256G'], ['黑色', '512G']]) {
    await filter().locator('[data-add-group]').click()
    const group = filter().locator('[data-condition-group]').last()
    await editRule(group.locator('[data-rule-id]').nth(0), 'SKU 状态 · SKU', '等于', '在售')
    await group.getByRole('button', { name: '组内添加条件' }).click()
    await editRule(group.locator('[data-rule-id]').nth(1), '颜色 · 动态属性 · p-color', '等于', color)
    await group.getByRole('button', { name: '组内添加条件' }).click()
    await editRule(group.locator('[data-rule-id]').nth(2), '容量 · 动态属性 · p-cap', '等于', capacity)
  }
  await capture('filter-groups')
  await filter().getByRole('button', { name: '应用筛选', exact: true }).click()
  await record('or-groups-applied', ['wb-a', 'wb-b', 'wb-d'])
  await checkBox('选择 SKU WB-A')
  assert.equal(await page.getByRole('checkbox', { name: '选择 SKU WB-A', exact: true }).isChecked(), true)
  await page.locator('[data-unsaved]').waitFor()
  assert.deepEqual((await read()).productListPages.sku.views, initialSettings.views, 'Applying changes no official rule')

  await page.locator('[data-fields-button]').click()
  await display().locator('[data-add-column="attr:p-color"]').click()
  const colorColumn = display().locator('[data-sku-column="attr:p-color"]')
  await colorColumn.getByRole('spinbutton').fill('180')
  await colorColumn.getByRole('spinbutton').press('Tab')
  await choose(colorColumn.locator('.el-select'), '左侧')
  await capture('fields')
  await display().getByRole('button', { name: '应用配置', exact: true }).click()
  assert.equal(await page.getByRole('checkbox', { name: '选择 SKU WB-A', exact: true }).isChecked(), true, 'Field/width changes retain selection')
  await page.getByRole('button', { name: '另存为', exact: true }).click()
  const nameDialog = page.getByRole('dialog', { name: '另存为', exact: true })
  await nameDialog.getByPlaceholder('视图名称').fill('在售颜色组合')
  await nameDialog.getByRole('button', { name: '创建', exact: true }).click()
  await nameDialog.waitFor({ state: 'hidden' })
  const savedId = await page.locator('.list-switch').getAttribute('data-view-id')
  assert.notEqual(savedId, 'sku-system-all')
  await page.getByRole('button', { name: '更多', exact: true }).click()
  await page.getByRole('button', { name: '收藏视图', exact: true }).click()
  await page.getByRole('heading', { name: 'SKU 管理', exact: true }).click()
  const saved = (await read()).productListPages.sku.views.find(view => view.id === savedId)
  assert.deepEqual(saved.skuWorkbench.columns.find(column => column.key === 'attr:p-color'), { key: 'attr:p-color', visible: true, width: 180, frozen: 'left' })
  await page.reload({ waitUntil: 'networkidle' })
  await record('save-favorite-refresh', ['wb-a', 'wb-b', 'wb-d'])
  assert.ok((await read()).productListPages.sku.skuWorkbench.favorites.includes(savedId))
  assert.equal(await page.locator('[data-unsaved]').count(), 0)
  assert.deepEqual(business(await read()), originalBusiness)
  assert.deepEqual((await read()).productListPages.spu, spuSettings)

  // Current searches are not saved, while applied work survives switching and refresh.
  const search = page.getByPlaceholder('名称、分类、属性、SKU、OA 编号')
  await search.fill('白色')
  await record('temporary-search-intersection', ['wb-a'])
  await setStatusFilter('停售')
  await record('work-filter-plus-temporary-search', ['wb-c'])
  assert.deepEqual((await read()).productListPages.sku.views.find(view => view.id === savedId), saved)
  await selectView('sku-system-all')
  await selectView(savedId)
  await record('return-keeps-applied-work', ['wb-c'])
  await page.locator('[data-unsaved]').waitFor()
  await page.reload({ waitUntil: 'networkidle' })
  await record('refresh-keeps-dirty-work', ['wb-c'])
  await page.getByRole('button', { name: '恢复已保存配置', exact: true }).first().click()
  await record('restore-official-keeps-temporary-search', ['wb-a'])
  await search.fill('')
  await record('search-clear-restores-rule', ['wb-a', 'wb-b', 'wb-d'])
  assert.deepEqual(business(await read()), originalBusiness)

  // A named view intersects the temporary parent scope; neither saves scope implicitly.
  await page.goto(base + '/skus?spu=wb-spu-a', { waitUntil: 'networkidle' })
  await selectView('sku-system-all')
  if (await page.locator('[data-unsaved]').count()) await page.getByRole('button', { name: '恢复已保存配置', exact: true }).first().click()
  await record('scope-opens-all-without-erasing-view', ['wb-a', 'wb-b', 'wb-c'])
  await selectView(savedId)
  await record('named-view-intersects-spu', ['wb-a', 'wb-b'])
  const mutation = await page.evaluate(async () => (await import('/src/stores/catalog.ts')).useCatalogStore().patchSku('wb-b', { status: 'off_sale' }))
  assert.ok(mutation?.ok, 'Actual existing SKU edit command succeeds')
  await record('matching-data-edit-updates-rule', ['wb-a'])
  const editedBusiness = business(await read())
  await page.getByRole('button', { name: '清空筛选', exact: true }).first().click()
  await record('clear-filters-keeps-spu-scope', ['wb-a', 'wb-b', 'wb-c'])
  assert.equal(await page.locator('[data-spu-scope]').isVisible(), true)
  assert.deepEqual((await read()).productListPages.sku.views.find(view => view.id === savedId), saved)
  await page.getByRole('button', { name: '查看全部 SKU', exact: true }).click()
  await selectView('sku-system-all')
  if (await page.locator('[data-unsaved]').count()) await page.getByRole('button', { name: '恢复已保存配置', exact: true }).first().click()
  await record('leave-scope-restores-all', ['wb-a', 'wb-b', 'wb-c', 'wb-d', 'wb-e'])

  await selectView(savedId)
  await page.getByRole('button', { name: '恢复已保存配置', exact: true }).first().click()
  await setStatusFilter('草稿')
  await record('prepare-save-failure', ['wb-e'])
  await page.evaluate(() => { window.__storageFailure = true })
  await page.getByRole('button', { name: '保存视图', exact: true }).click()
  await page.locator('[data-save-error]').waitFor()
  await page.locator('[data-unsaved]').waitFor()
  assert.deepEqual((await read()).productListPages.sku.views.find(view => view.id === savedId), saved)
  await record('failed-save-keeps-official-and-dirty-work', ['wb-e'])
  await page.evaluate(() => { window.__storageFailure = false })
  await page.getByRole('button', { name: '保存视图', exact: true }).click()
  await page.locator('[data-unsaved]').waitFor({ state: 'hidden' })
  await page.reload({ waitUntil: 'networkidle' })
  await record('retry-save-refresh', ['wb-e'])

  const sourceConfig = (await read()).productListPages.sku.views.find(view => view.id === savedId).skuWorkbench
  await moreAction('复制视图')
  const copyId = await page.locator('.list-switch').getAttribute('data-view-id')
  assert.notEqual(copyId, savedId)
  assert.deepEqual((await read()).productListPages.sku.views.find(view => view.id === copyId).skuWorkbench, sourceConfig)
  await page.reload({ waitUntil: 'networkidle' })
  await record('copy-refresh-preserves-full-config', ['wb-e'])
  await moreAction('设为默认视图')
  assert.equal((await read()).productListPages.sku.skuWorkbench.defaultId, copyId)
  const defaultContext = await browser.newContext({ viewport: { width: 1600, height: 1000 }, locale: 'zh-CN', timezoneId: 'Asia/Shanghai' })
  const payload = await page.evaluate(() => localStorage.getItem('iyge-v2-mock-db'))
  await defaultContext.addInitScript(value => localStorage.setItem('iyge-v2-mock-db', value), payload)
  const defaultPage = await defaultContext.newPage()
  defaultPage.on('pageerror', error => diagnostics.push({ type: 'pageerror-default-entry', message: String(error) }))
  await defaultPage.goto(base + '/skus', { waitUntil: 'networkidle' })
  assert.equal(await defaultPage.locator('.list-switch').getAttribute('data-view-id'), copyId)
  await defaultContext.close()
  await moreAction('删除视图')
  await page.getByRole('dialog', { name: '删除视图', exact: true }).getByRole('button', { name: '确定', exact: true }).click()
  await page.waitForFunction(id => document.querySelector('.list-switch')?.getAttribute('data-view-id') !== id, copyId)
  assert.equal((await read()).productListPages.sku.skuWorkbench.defaultId, 'sku-system-all')
  assert.equal((await read()).productListPages.sku.views.some(view => view.id === copyId), false)
  await selectView(savedId)
  await record('delete-default-falls-back-without-deleting-data', ['wb-e'])
  assert.deepEqual(business(await read()), editedBusiness)

  // Invalid fields fail closed and clear old selections, not expand to all results.
  await checkBox('全选本页')
  await page.evaluate(async id => {
    const store = (await import('/src/stores/catalog.ts')).useCatalogStore()
    const page = store.data.productListPages.sku
    const config = JSON.parse(JSON.stringify(page.views.find(view => view.id === id).skuWorkbench))
    config.conditions.children.push({ kind: 'rule', id: 'invalid-fixture', field: 'attr:deleted-field', operator: 'eq', value: 'x' })
    page.skuWorkbench.working[id] = config
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  }, savedId)
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('[data-invalid-config]').waitFor()
  assert.deepEqual(await ids(), [])
  assert.equal(await page.getByRole('button', { name: '批量停售', exact: true }).count(), 0)
  await record('invalid-condition-fails-closed')
  await capture('invalid-config')
  await page.getByRole('button', { name: '恢复已保存配置', exact: true }).first().click()
  await checkIds(['wb-e'])
  // A saved view may lose both a filter field and a displayed dynamic field.
  // Rebuilding is explicit and changes work only; it does not overwrite that view.
  const validSaved = (await read()).productListPages.sku.views.find(view => view.id === savedId).skuWorkbench
  await page.evaluate(async ({ id }) => {
    const store = (await import('/src/stores/catalog.ts')).useCatalogStore()
    const view = store.data.productListPages.sku.views.find(view => view.id === id)
    view.skuWorkbench.conditions.children.push({ kind: 'rule', id: 'lost-rule', field: 'attr:lost', operator: 'eq', value: 'x' })
    view.skuWorkbench.columns.push({ key: 'attr:lost', visible: true })
  }, { id: savedId })
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('[data-invalid-config]').waitFor()
  await page.getByRole('button', { name: '重建工作配置', exact: true }).click()
  await page.getByRole('dialog', { name: '重建工作配置', exact: true }).getByRole('button', { name: '确定', exact: true }).click()
  await record('rebuild-invalid-work-preserves-formal-and-business', ['wb-a', 'wb-b', 'wb-c', 'wb-d', 'wb-e'])
  assert.ok((await read()).productListPages.sku.views.find(view => view.id === savedId).skuWorkbench.columns.some(column => column.key === 'attr:lost'))
  assert.ok(await page.locator('[data-unsaved]').isVisible())
  assert.deepEqual(business(await read()), editedBusiness)
  await page.evaluate(async ({ id, valid }) => {
    const store = (await import('/src/stores/catalog.ts')).useCatalogStore()
    store.data.productListPages.sku.views.find(view => view.id === id).skuWorkbench = valid
  }, { id: savedId, valid: validSaved })
  await page.getByRole('button', { name: '恢复已保存配置', exact: true }).first().click()
  await checkIds(['wb-e'])
  await search.fill('确定不存在的 SKU')
  await page.locator('[data-empty="sku"]').waitFor()
  await record('no-match-empty-state', [])
  await search.fill('')
  await checkIds(['wb-e'])
  assert.deepEqual(business(await read()), editedBusiness)
  assert.deepEqual((await read()).productListPages.spu, spuSettings)

  await page.getByRole('button', { name: '当前明亮模式，切换为暗黑模式' }).click()
  await capture('dark')
  await page.setViewportSize({ width: 780, height: 900 })
  await capture('narrow')
  const scroll = page.locator('.sku-table .el-scrollbar__wrap').first()
  const rect = await scroll.boundingBox()
  assert.ok(rect)
  await page.mouse.move(rect.x + Math.min(rect.width - 10, 120), rect.y + Math.min(rect.height - 5, 35))
  await page.mouse.wheel(400, 0)
  await page.waitForFunction(() => document.querySelector('.sku-table .el-scrollbar__wrap')?.scrollLeft > 0)
  await record('horizontal-wheel-scroll')
  assert.deepEqual(diagnostics, [], 'No new browser errors or warnings')
  const result = { result: 'PASS', browserEngine: engine, browser: browser.version(), viewports: ['1600x1000', '780x900'], checkpoints: checkpoints.map(({ name, ids }) => ({ name, ids })), screenshots, diagnostics }
  writeFileSync(resolve(output, 'result.json'), JSON.stringify(result, null, 2))
  writeFileSync(resolve(output, 'states.json'), JSON.stringify(checkpoints, null, 2))
  console.log(JSON.stringify(result, null, 2))
} catch (error) {
  if (page) await page.screenshot({ path: resolve(output, 'failure.png'), animations: 'disabled' }).catch(() => {})
  writeFileSync(resolve(output, 'failure.json'), JSON.stringify({ error: String(error), checkpoints, diagnostics }, null, 2))
  throw error
} finally {
  await browser?.close()
  await server.close()
}
