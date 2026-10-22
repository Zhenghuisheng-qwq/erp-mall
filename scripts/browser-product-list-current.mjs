import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import { PNG } from 'pngjs'
import { clickOption, openTools, closeTools, waitUiSettled, setCategorySidebar, createView, chooseView } from './browser-ui.mjs'

// Same checked-in baseline, fixture, clock, browser and actions for both runs.
// Only the original page is substituted; its domain/store dependencies stay untouched.
const baseline = process.env.ROUND2_CURRENT_BASELINE || 'cff2fecd9200c929cb1da5299e9dd0893908cb21'
const phase = process.argv.includes('--before') ? 'before' : 'after'
const output = resolve(process.env.ROUND2_CURRENT_OUTPUT_DIR || 'work/refactor-round2-current/comparison')
const reference = resolve(process.env.ROUND2_CURRENT_EVIDENCE_DIR || output)
try {
  execFileSync('git', ['cat-file', '-e', `${baseline}:src/views/ProductListView.vue`], { stdio: 'pipe' })
} catch (error) {
  throw new Error(`Missing round-two baseline ${baseline}:src/views/ProductListView.vue. Restore its Git history or set ROUND2_CURRENT_BASELINE to the intended original commit.`, { cause: error })
}
if (phase === 'after') {
  const required = ['states.json', 'diagnostics.json', ...['light-list', 'expanded', 'filter-dialog', 'view-tools', 'sku-list', 'dark-list', 'narrow-list', 'category-sidebar', 'category-narrow'].map(name => `${name}.png`)]
  for (const name of required) {
    const path = resolve(reference, `before-${name}`)
    if (!existsSync(path)) throw new Error(`Missing round-two evidence ${path}. Run this script with --before using the same fixture/browser, or set ROUND2_CURRENT_EVIDENCE_DIR to the existing evidence directory.`)
  }
}
mkdirSync(output, { recursive: true })
const refactored = new Set(['src/views/ProductListView.vue', 'src/components/product-list/tablePresentation.ts', 'src/components/product-list/useProductListCategoryLayout.ts'])
const sharedChanges = execFileSync('git', ['diff', '--name-only', baseline, '--', 'src'], { encoding: 'utf8' }).trim().split(/\r?\n/).filter(path => path && !refactored.has(path))
assert.deepEqual(sharedChanges, [], 'Baseline substitution requires unchanged shared dependencies')
const original = phase === 'before' ? execFileSync('git', ['show', `${baseline}:src/views/ProductListView.vue`], { encoding: 'utf8' }) : ''
// Keep this comparison independent from other Vite checks' dependency caches.
const server = await createServer({ cacheDir: resolve(output, 'vite-cache'), server: { host: '127.0.0.1', port: 0, open: false, watch: null }, plugins: [{
  name: 'round2-original-page', enforce: 'pre',
  transform(source, id) {
    if (original && id.replaceAll('\\', '/').endsWith('/src/views/ProductListView.vue')) return original
    return source
  },
}] })
await server.listen()
const base = `http://127.0.0.1:${server.httpServer.address().port}`
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true }).catch(async error => { await server.close(); throw error })
const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, locale: 'zh-CN', timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' })
const page = await context.newPage()
const diagnostics = []
page.on('pageerror', error => diagnostics.push(String(error)))
page.on('console', message => { if (['error', 'warning'].includes(message.type())) diagnostics.push(message.text()) })
await context.addInitScript(() => {
  const RealDate = Date
  window.__testTime = RealDate.parse('2026-10-22T04:00:00.000Z')
  window.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [window.__testTime])) }
    static now() { return window.__testTime }
  }
  window.__writes = []
  window.__resizeListeners = new Set()
  const addListener = window.addEventListener, removeListener = window.removeEventListener
  window.addEventListener = function(type, listener, options) { if (type === 'resize') window.__resizeListeners.add(listener); return addListener.call(this, type, listener, options) }
  window.removeEventListener = function(type, listener, options) { if (type === 'resize') window.__resizeListeners.delete(listener); return removeListener.call(this, type, listener, options) }

  const setItem = Storage.prototype.setItem
  Storage.prototype.setItem = function (key, value) {
    if (key === 'iyge-v2-mock-db') window.__writes.push(JSON.parse(value))
    return setItem.call(this, key, value)
  }
  localStorage.setItem('iyge-v2-theme', 'light')
})
const states = []
const visuals = []
async function settled() {
  await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))) })
  await page.locator('.el-message').waitFor({ state: 'hidden' })
  await page.waitForFunction(() => [...document.querySelectorAll('.el-dialog, .el-overlay, .el-popper')].every(node => !node.getClientRects().length || getComputedStyle(node).opacity === '1'))
}
async function record(name) {
  await settled()
  states.push(await page.evaluate(name => ({ name, writes: window.__writes, stored: JSON.parse(localStorage.getItem('iyge-v2-mock-db')), rows: [...document.querySelectorAll('.spu-table .linkish, .sku-table [data-sku-id]')].map(node => node.textContent), count: document.querySelector('[data-result-count]')?.textContent ?? null, resizeListeners: window.__resizeListeners.size }), name))
  await page.evaluate(() => { window.__writes = []; window.__testTime += 1000 })
}
async function expectFilterValue(value) {
  const actual = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('iyge-v2-mock-db')).data
    const scope = data.productListPages.spu
    const view = scope.views.find(item => item.id === scope.activeId)
    return view.spuQuery.filters.at(-1).value
  })
  assert.deepEqual(actual, value)
}
async function capture(name) {
  await settled()
  const path = resolve(output, `${phase}-${name}.png`)
  await page.screenshot({ path, animations: 'disabled' })
  if (phase === 'after') {
    const before = PNG.sync.read(readFileSync(resolve(reference, `before-${name}.png`)))
    const after = PNG.sync.read(readFileSync(path))
    assert.equal(after.width, before.width)
    assert.equal(after.height, before.height)
    let changed = 0
    for (let i = 0; i < after.data.length; i += 4) if (!after.data.subarray(i, i + 4).equals(before.data.subarray(i, i + 4))) changed++
    visuals.push({ name, pixels: before.width * before.height, changed })
    assert.equal(changed, 0, `${name}: unexpected visual difference`)
  }
}
const search = page.getByPlaceholder('名称、分类、属性、SKU、OA 编号')
try {
  await page.goto(base + '/spus', { waitUntil: 'networkidle' })
  await capture('light-list')
  await search.fill('round2-no-result')
  await page.locator('[data-empty="spu"]').waitFor()
  await record('no-result')
  await search.fill('')
  await record('search-clear')
  // A deterministic fixture extends the seed with a removable empty family.
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('iyge-v2-mock-db'))
    const source = raw.data.families[0]
    raw.data.families.unshift({ ...source, id: 'round2-empty', name: '二轮空商品', lifecycle: 'draft', shelfStatus: 'draft', origin: 'created' })
    localStorage.setItem('iyge-v2-mock-db', JSON.stringify(raw))
  })
  await page.reload({ waitUntil: 'networkidle' })
  await record('fixture')
  await page.locator('.spu-table .el-table__expand-icon').nth(1).click()
  await page.locator('.sku-expand .el-table').waitFor()
  await capture('expanded')
  const expanded = page.locator('.sku-expand')
  await expanded.locator('.el-table__body .el-checkbox').first().click()
  // Baseline defect: the recreated nested row array clears selection on render.
  assert.equal(await expanded.getByRole('button', { name: '所选改停售' }).isDisabled(), true)
  await record('sku-selection-baseline-reset')
  await expanded.locator('.el-select').first().click()
  await clickOption(page, '停售')
  await record('sku-status')
  await page.locator('.spu-table .el-table__expand-icon').nth(1).click()
  const emptyRow = page.locator('.spu-table .el-table__row').filter({ has: page.locator('button[data-family-id="round2-empty"]') })
  await emptyRow.locator('.el-checkbox').first().click()
  await page.getByRole('button', { name: '批量发布', exact: true }).click()
  await record('publish-selection')
  if (!(await page.getByRole('button', { name: '批量下架', exact: true }).count())) await emptyRow.locator('.el-checkbox').first().click()
  await page.getByRole('button', { name: '批量下架', exact: true }).click()
  await record('offline-selection')
  if (!(await page.getByRole('button', { name: '批量删除', exact: true }).count())) await emptyRow.locator('.el-checkbox').first().click()
  await page.getByRole('button', { name: '批量删除', exact: true }).click()
  await page.getByRole('dialog', { name: '批量删除' }).getByRole('button', { name: '确定', exact: true }).click()
  await record('delete-selection')
  await page.locator('[data-filter-count]').click()
  await page.getByRole('button', { name: '添加条件', exact: true }).click()
  await page.locator('.filter-row input').last().fill('Apple')
  await record('text-filter-immediate')
  await page.getByRole('button', { name: '添加条件', exact: true }).click()
  await page.locator('.filter-row').last().locator('.el-select').first().click()
  await clickOption(page, '创建日期')
  await capture('filter-dialog')
  const edited = page.locator('.filter-row').last()
  await edited.locator('.el-date-editor input').fill('2026-10-01')
  await edited.locator('.el-date-editor input').press('Enter')
  await page.getByRole('dialog', { name: '更多筛选', exact: true }).locator('.el-dialog__title').click()
  await record('single-date-filter')
  await expectFilterValue('2026-10-01')
  await edited.locator('.el-select').nth(1).click()
  await clickOption(page, '日期范围')
  await edited.locator('.el-range-input').nth(0).fill('2026-10-01')
  await edited.locator('.el-range-input').nth(1).fill('2026-10-31')
  await edited.locator('.el-range-input').nth(1).press('Enter')
  await page.getByRole('dialog', { name: '更多筛选', exact: true }).locator('.el-dialog__title').click()
  await record('date-range-filter')
  await expectFilterValue({ from: '2026-10-01', to: '2026-10-31' })
  await edited.locator('.el-select').first().click()
  await clickOption(page, '商品分类')
  await edited.locator('[data-category-tree-select] .trigger').click()
  const tree = page.locator('[data-category-tree-select-panel]')
  await tree.locator('[data-expand-id="c-host"]').click()
  await tree.locator('[data-category-id="c-phone"] .node').click()
  await record('single-category-filter')
  await expectFilterValue('c-phone')
  await edited.locator('.el-select').nth(1).click()
  await clickOption(page, '属于任一')
  await edited.locator('[data-category-tree-select] .trigger').click()
  await tree.locator('[data-expand-id="c-host"]').click()
  await tree.locator('[data-category-id="c-phone"] .node').click()
  await tree.locator('[data-category-id="c-watch"] .node').click()
  await page.keyboard.press('Escape')
  await record('multiple-category-filter')
  await expectFilterValue(['c-phone', 'c-watch'])
  await edited.locator('.el-select').first().click()
  await clickOption(page, '品牌')
  await edited.locator('.el-select').nth(1).click()
  await clickOption(page, '属于任一')
  await edited.locator('.el-select').nth(2).click()
  await clickOption(page, 'Apple')
  await page.keyboard.press('Escape')
  await record('multiple-value-filter')
  await expectFilterValue(['Apple'])
  await page.getByRole('dialog', { name: '更多筛选', exact: true }).locator('.el-dialog__headerbtn').click()
  await waitUiSettled(page)
  await record('filter-close')
  await page.locator('[data-filter-count]').click()
  while (await page.locator('.filter-row').count()) await page.locator('.filter-row').first().getByRole('button', { name: '删除', exact: true }).click()
  await page.getByRole('dialog', { name: '更多筛选', exact: true }).locator('.el-dialog__headerbtn').click()
  await waitUiSettled(page)
  // Classifying panel state must never change predicates or cause catalog writes.
  const mainBusiness = async () => page.evaluate(() => { const d = JSON.parse(localStorage.getItem('iyge-v2-mock-db')).data; return { families: d.families, skus: d.skus, plans: d.planningRecords, receipts: d.materialReceipts, versions: d.specModelVersions } })
  const beforeLayout = await mainBusiness()
  await page.locator('[data-category-trigger]').click()
  await page.locator('[data-category-tree]:visible').getByPlaceholder('搜索分类').fill('手机')
  await page.locator('[data-category-tree]:visible [data-category-id="c-phone"]').click()
  await page.locator('[data-category-tree]:visible').getByRole('button', { name: '收起分类面板' }).click()
  await setCategorySidebar(page, true)
  await record('category-sidebar')
  await capture('category-sidebar')
  await page.getByRole('button', { name: '收起分类栏', exact: true }).click()
  await record('category-close-display-only'); assert.equal(states.at(-1).writes.length, 0)
  await page.getByRole('button', { name: '展开分类栏', exact: true }).click()
  await page.setViewportSize({ width: 900, height: 960 })
  await page.locator('[data-category-trigger]').click()
  await page.locator('[data-category-tree]:visible').waitFor()
  await capture('category-narrow')
  await record('category-narrow-no-write'); assert.equal(states.at(-1).writes.length, 0)
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.locator('[data-category-side]').waitFor()
  assert.equal(await page.locator('.product-category-pop:visible').count(), 0)
  await record('category-wide-no-write'); assert.equal(states.at(-1).writes.length, 0)
  await createView(page, '分类独立视图')
  await setCategorySidebar(page, false)
  await page.locator('[data-category-trigger]').click()
  await chooseView(page, '默认视图')
  await page.locator('[data-category-side]').waitFor()
  assert.equal(await page.locator('.product-category-pop:visible').count(), 0)
  await record('category-switch-view-closes-popover')
  await page.getByRole('button', { name: '清空筛选', exact: true }).click()
  await setCategorySidebar(page, false)
  assert.deepEqual(await mainBusiness(), beforeLayout)
  const listenerCount = await page.evaluate(() => window.__resizeListeners.size)
  for (let i = 0; i < 3; i++) {
    await page.evaluate(async () => (await import('/src/router/index.ts')).default.push('/account'))
    await page.evaluate(async () => (await import('/src/router/index.ts')).default.push('/spus'))
    await page.locator('[data-category-trigger]').waitFor()
    assert.equal(await page.evaluate(() => window.__resizeListeners.size), listenerCount, 'remount must not add resize listeners')
  }
  await record('repeated-remount-listener-count')
  await openTools(page)
  await capture('view-tools')
  await page.getByPlaceholder('搜索字段').fill('名称')
  await record('column-search')
  await page.getByPlaceholder('搜索字段').fill('')
  await closeTools(page)
  await page.getByRole('button', { name: 'SKU 管理', exact: true }).click()
  await page.locator('.sku-table').waitFor()
  await record('sku-mode')
  await capture('sku-list')
  await page.getByRole('button', { name: 'SPU 管理', exact: true }).click()
  await page.getByRole('button', { name: '当前明亮模式，切换为暗黑模式' }).click()
  await capture('dark-list')
  await page.locator('.topbar .el-select').click()
  await clickOption(page, '身份：运营')
  await record('operator-role')
  await page.setViewportSize({ width: 900, height: 960 })
  await capture('narrow-list')
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.getByRole('button', { name: '新建 SPU', exact: true }).click()
  await page.waitForURL('**/spus/new')
  await page.locator('[data-spu-name] input, input[data-spu-name]').fill('尚未保存的草稿')
  await page.goBack({ waitUntil: 'networkidle' })
  await page.getByRole('dialog', { name: '离开编辑', exact: true }).getByRole('button', { name: '离开', exact: true }).click()
  await page.locator('.list-switch').waitFor()
  await record('remount')
  await openTools(page)
  await page.locator('.view-tools .el-radio-button', { hasText: '手工排序' }).click()
  await closeTools(page)
  await record('manual-mode')
  await page.locator('[data-pick-id]').nth(0).click()
  await page.locator('[data-pick-id]').nth(1).click()
  await page.getByRole('button', { name: '加入排序暂存区', exact: true }).click()
  await page.getByRole('button', { name: '展开暂存', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: '排序暂存区', exact: true })
  assert.equal(await drawer.locator('li').count(), 2)
  await drawer.getByRole('button', { name: '移除', exact: true }).first().click()
  assert.equal(await drawer.locator('li').count(), 1)
  await record('remove-staged')
  assert.equal(states.at(-1).writes.length, 0, 'Staging must not persist')
  await drawer.getByRole('button', { name: '清空暂存', exact: true }).click()
  assert.equal(await drawer.locator('li').count(), 0)
  await drawer.locator('.el-drawer__close-btn').click()
  await record('clear-staged')
  assert.equal(states.at(-1).writes.length, 0, 'Clearing staging must not persist')
  // There is no page-size control in this page. Exercise the persisted setting.
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('iyge-v2-mock-db'))
    raw.data.productListPages.spu.query.pageSize = 2
    raw.data.productListPages.spu.query.page = 2
    localStorage.setItem('iyge-v2-mock-db', JSON.stringify(raw))
  })
  await page.reload({ waitUntil: 'networkidle' })
  assert.equal(await page.locator('.spu-table button[data-family-id]').count(), 2)
  assert.equal(await page.locator('.el-pager .is-active').innerText(), '2')
  await record('persisted-page-size')
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('iyge-v2-mock-db'))
    raw.data.families = []; raw.data.skus = []
    localStorage.setItem('iyge-v2-mock-db', JSON.stringify(raw))
  })
  await page.reload({ waitUntil: 'networkidle' })
  assert.equal(await page.locator('[data-empty="spu"]').innerText(), '当前没有商品。')
  await record('empty-database')
  await page.goto(base + '/spus?panel=columns', { waitUntil: 'networkidle' })
  await page.waitForURL(base + '/')
  assert.equal(await page.locator('.list-switch').count(), 0, 'Operator cannot enter the admin columns route')
  await record('operator-tools-route-blocked')
  await page.locator('.topbar .el-select').click()
  await clickOption(page, '身份：管理员')
  await page.goto(base + '/spus?panel=columns', { waitUntil: 'networkidle' })
  await page.locator('.view-tools').waitFor()
  await record('route-opens-tools')
  await page.locator('.view-tools').getByRole('button', { name: '导入导出', exact: true }).click()
  await page.waitForURL('**/import')
  await page.goBack({ waitUntil: 'networkidle' })
  await page.locator('.view-tools').waitFor()
  await record('import-entry-return')
  writeFileSync(resolve(output, `${phase}-states.json`), JSON.stringify(states, null, 2))
  writeFileSync(resolve(output, `${phase}-diagnostics.json`), JSON.stringify(diagnostics, null, 2))
  if (phase === 'after') {
    assert.deepEqual(states, JSON.parse(readFileSync(resolve(reference, 'before-states.json'), 'utf8')), 'behavior / persistence writes changed')
    assert.deepEqual(diagnostics, JSON.parse(readFileSync(resolve(reference, 'before-diagnostics.json'), 'utf8')), 'new browser diagnostics')
  }
  const result = { result: 'PASS', phase, baseline, browser: browser.version(), states: states.length, diagnostics, visuals }
  writeFileSync(resolve(output, `${phase}-comparison.json`), JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result, null, 2))
} catch (error) {
  await page.screenshot({ path: resolve(output, `${phase}-failure.png`), animations: 'disabled' }).catch(() => {})
  writeFileSync(resolve(output, `${phase}-failure.json`), JSON.stringify({ error: String(error), states, diagnostics }, null, 2))
  throw error
} finally {
  await browser.close()
  await server.close()
}
