import assert from 'node:assert/strict'
import {resolve} from 'node:path'
import {createServer} from 'vite'
import {chromium} from 'playwright-core'
import {createTestRuntime,removeTestRuntime} from './test-runtime.mjs'

const runtime = createTestRuntime('catalog-category-tree')
const errors = []
let server, browser, page, groups = 0
const mark = message => { groups += 1; console.log(`PASS ${message}`) }
try {
  browser = await chromium.launch({channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true})
  server = await createServer({cacheDir: resolve(runtime, 'tree'), logLevel: 'error', define: {'import.meta.env.VITE_RBAC_ENFORCEMENT': JSON.stringify('true')}, server: {host: '127.0.0.1', port: 0, watch: null, hmr: false, ws: false}})
  const {createCatalogWorkspaceFixture} = await server.ssrLoadModule('/scripts/catalog-workspace-fixtures.ts')
  const {DATA_VERSION} = await server.ssrLoadModule('/src/domain/types.ts')
  const {normalizeStored} = await server.ssrLoadModule('/src/stores/catalog.ts')
  const data = normalizeStored({version: DATA_VERSION, data: createCatalogWorkspaceFixture()})
  data.categories.push({id: 'retired', parentId: 'phone', name: '停用样机', enabled: false, sort: 9})
  data.rbac.roles.push({id: 'catalog-category-reader', code: 'catalog-category-reader', name: 'catalog-category-reader', enabled: true, description: 'tree check', permissionCodes: ['product:category:read']})
  data.users.push({id: 'catalog-category-reader', username: 'catalog-category-reader', displayName: 'catalog-category-reader', enabled: true, role: 'operator', roleIds: ['catalog-category-reader']})
  await server.listen()
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  async function open(path = '/catalog?view=categories', actor = 'u-admin', options = {}) {
    const context = await browser.newContext({viewport: {width: 1440, height: 1000}, locale: 'zh-CN', reducedMotion: 'reduce', ...options})
    await context.addInitScript(({data, version, actor}) => {
      if (location.protocol !== 'http:') return
      if (!localStorage.getItem('iyge-v2-mock-db')) localStorage.setItem('iyge-v2-mock-db', JSON.stringify({version, data}))
      sessionStorage.setItem('iyge-rbac-simulated-user', actor)
      const original = Storage.prototype.setItem
      window.__businessWrites = []
      Storage.prototype.setItem = function (key, value) {
        if (key === 'iyge-v2-mock-db') window.__businessWrites.push(value)
        return original.call(this, key, value)
      }
    }, {data, version: DATA_VERSION, actor})
    page = await context.newPage()
    page.setDefaultTimeout(16000)
    page.on('pageerror', error => errors.push(String(error)))
    await page.goto(base + path, {waitUntil: 'networkidle'})
    await page.evaluate(async () => { window.__store = (await import('/src/stores/catalog.ts')).useCatalogStore(); await window.__store.waitForPersistence() })
    return context
  }
  const settled = async () => { await page.waitForTimeout(160); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))) }
  const category = id => page.locator(`[data-catalog-category="${id}"]`)
  const snapshot = () => page.evaluate(() => JSON.stringify({
    categories: window.__store.data.categories.map(row => [row.id, row.parentId, row.name, row.sort, row.enabled]),
    productTypes: window.__store.data.productTypes.map(row => [row.id, row.categoryId, row.name]),
    specCanvases: window.__store.data.specCanvases.map(row => [row.templateId, row.productTypeId, row.status]),
    specModelVersions: window.__store.data.specModelVersions.map(row => [row.id, row.templateId, row.version, row.status]),
    families: window.__store.data.families.map(row => [row.id, row.categoryId, row.productModelId]),
    skus: window.__store.data.skus.map(row => [row.id, row.familyId, row.recordKind]),
    planningRecords: window.__store.data.planningRecords.map(row => row.planningId),
    materialReceipts: window.__store.data.materialReceipts,
    compatibilities: window.__store.data.compatibilities,
  }))
  async function chooseLayout(label) {
    await page.locator('.el-segmented').getByText(label, {exact: true}).click()
    await settled()
  }

  let context = await open()
  await settled()
  const writesAtStart = await page.evaluate(() => window.__businessWrites.length)
  const before = await snapshot()
  assert.equal(await page.locator('[data-catalog-category-summary]').getAttribute('data-catalog-layout'), 'tree')
  assert.equal(await category('root').count(), 1)
  assert.equal(await category('phone').count(), 1)
  assert.equal(await category('leaf').count(), 1)
  await page.locator('[data-catalog-collapse-all]').click(); await settled()
  assert.equal(await category('phone').count(), 0)
  assert.equal(await category('leaf').count(), 0)
  await page.locator('[data-catalog-expand="root"]').click(); await settled()
  assert.equal(await category('phone').count(), 1)
  assert.equal(await category('leaf').count(), 0)
  await page.locator('[data-catalog-expand="phone"]').click(); await settled()
  assert.equal(await category('leaf').count(), 1)
  await page.locator('[data-catalog-expand="phone"]').click(); await settled()
  assert.equal(await category('leaf').count(), 0)
  await page.locator('[data-catalog-expand-all]').click(); await settled()
  assert.equal(await category('leaf').count(), 1)
  await page.locator('[data-catalog-collapse-all]').click(); await settled()
  assert.equal(await category('phone').count(), 0)
  await chooseLayout('列表表格')
  assert.equal(await page.locator('[data-catalog-category-summary]').getAttribute('data-catalog-layout'), 'list')
  assert.equal(await page.locator('[data-catalog-expand-all]').count(), 0)
  assert.equal(await category('phone').count(), 1)
  assert.match(await page.locator('[data-catalog-path="phone"]').innerText(), /手机目录/)
  assert.match(await page.locator('[data-catalog-path="leaf"]').innerText(), /手机目录\s*\/\s*手机/)
  await chooseLayout('树形结构')
  assert.equal(await category('phone').count(), 0, 'list switch must restore the collapsed tree')
  await page.getByRole('textbox', {name: '搜索分类名称或编号', exact: true}).fill('leaf'); await settled()
  assert.equal(await category('leaf').count(), 1)
  assert.equal(await category('root').getAttribute('data-catalog-relation'), 'path')
  assert.equal(await category('phone').getAttribute('data-catalog-relation'), 'path')
  assert.equal(await category('leaf').getAttribute('data-catalog-relation'), 'hit')
  await page.getByRole('textbox', {name: '搜索分类名称或编号', exact: true}).fill(''); await settled()
  assert.equal(await category('phone').count(), 0)
  await page.locator('[data-catalog-expand-all]').click(); await settled()
  const rootWithChildren = (await page.locator('[data-catalog-metric="root:spus"]').innerText()).trim()
  await page.locator('label.el-radio-button').filter({hasText: /^仅本级$/}).click(); await settled()
  const rootCurrent = (await page.locator('[data-catalog-metric="root:spus"]').innerText()).trim()
  assert.notEqual(rootWithChildren, rootCurrent)
  assert.match(rootCurrent, /^1/)
  await page.locator('label.el-radio-button').filter({hasText: /^包含下级$/}).click(); await settled()
  assert.match((await page.locator('[data-catalog-metric="root:spus"]').innerText()).trim(), /^6/)
  await page.locator('tr', {has: category('phone')}).getByRole('button', {name: '查看此范围', exact: true}).click(); await settled()
  assert.equal(new URL(page.url()).searchParams.get('categoryId'), 'phone')
  await chooseLayout('列表表格')
  await page.locator('tr', {has: category('leaf')}).getByRole('button', {name: '查看此范围', exact: true}).click(); await settled()
  assert.equal(new URL(page.url()).searchParams.get('categoryId'), 'leaf')
  await chooseLayout('树形结构')
  await page.getByRole('button', {name: '全部分类', exact: true}).click(); await settled()
  await page.locator('[data-catalog-collapse-all]').click(); await settled()
  await page.locator('.query-toolbar .el-select').first().click()
  await page.getByRole('option', {name: '停用', exact: true}).click(); await settled()
  assert.equal(await category('retired').count(), 1)
  assert.equal(await category('phone').getAttribute('data-catalog-relation'), 'path')
  assert.equal(await category('case').count(), 0)
  await page.locator('.query-toolbar .el-select').first().hover()
  await page.locator('.query-toolbar .el-select').first().locator('.el-select__clear').click(); await settled()
  assert.equal(await category('retired').count(), 0)
  assert.equal(await category('phone').count(), 0)
  await page.getByRole('button', {name: '列表设置', exact: true}).click()
  await page.locator('.column-options').getByText('模型数', {exact: true}).click(); await settled()
  assert.equal(await page.getByRole('columnheader', {name: '模型数', exact: true}).count(), 0)
  await chooseLayout('树形结构')
  assert.equal(await page.getByRole('columnheader', {name: '模型数', exact: true}).count(), 0)
  assert.equal(await page.getByRole('columnheader', {name: '分类名称', exact: true}).count(), 1)
  await page.locator('[data-catalog-view="types"]').click(); await settled()
  assert.equal(await page.locator('[data-catalog-type-table], [data-catalog-type]').count() > 0, true)
  await page.locator('[data-catalog-view="models"]').click(); await settled()
  assert.equal(await page.locator('[data-catalog-model]').count() > 0, true)
  await page.locator('[data-catalog-view="categories"]').click(); await settled()
  assert.equal(await page.getByRole('columnheader', {name: '模型数', exact: true}).count(), 0)
  await page.locator('.theme-switch').click(); await settled()
  assert.equal(await page.locator('html').evaluate(element => element.classList.contains('dark')), false)
  assert.equal(await category('root').count(), 1)
  await page.locator('.theme-switch').click(); await settled()
  assert.equal(await page.locator('html').evaluate(element => element.classList.contains('dark')), true)
  await page.locator('[data-catalog-repair="bad-parent"]').click()
  await page.getByRole('heading', {name: '整理分类', exact: true}).waitFor()
  assert.equal(new URL(page.url()).searchParams.get('categoryId'), 'bad-parent')
  await page.locator('[data-category-back-catalog]').click()
  await page.getByRole('heading', {name: '商品资料管理', exact: true}).waitFor()
  assert.equal(await snapshot(), before)
  assert.equal(await page.evaluate(() => window.__businessWrites.length), writesAtStart)
  await page.reload({waitUntil: 'networkidle'})
  await page.evaluate(async () => { window.__store = (await import('/src/stores/catalog.ts')).useCatalogStore(); await window.__store.waitForPersistence() })
  assert.equal(await snapshot(), before)
  assert.equal(await page.locator('[data-catalog-category-summary]').getAttribute('data-catalog-layout'), 'tree')
  await context.close()
  mark('browser tree: expand, list switch, search path, scope, columns, tabs, theme, repair and refresh keep business data')

  context = await open('/catalog?view=categories', 'u-admin', {viewport: {width: 1152, height: 720}, deviceScaleFactor: 1.25})
  await page.locator('[data-catalog-category-summary]').waitFor()
  const zoom = await page.evaluate(() => {
    const summary = document.querySelector('[data-catalog-category-summary]')
    const tabs = document.querySelector('.view-tabs')
    return {summary: !!summary && summary.getBoundingClientRect().width > 240, tabs: !!tabs && tabs.getBoundingClientRect().top >= 0 && tabs.getBoundingClientRect().height > 20}
  })
  assert.equal(zoom.summary, true)
  assert.equal(zoom.tabs, true)
  await page.locator('[data-catalog-expand-all]').scrollIntoViewIfNeeded()
  assert.equal(await page.locator('[data-catalog-expand-all]').isVisible(), true)
  await context.close()
  mark('browser tree: 125% zoom keeps the summary and view tabs usable')

  context = await open('/catalog?view=categories', 'catalog-category-reader')
  const readerBefore = await snapshot()
  assert.equal(await page.locator('[data-catalog-category-summary] input, [data-catalog-category-summary] textarea').count(), 0)
  assert.equal(await page.getByRole('button', {name: '新增分类', exact: true}).count(), 0)
  await page.locator('[data-catalog-repair="bad-parent"]').click()
  await page.getByRole('heading', {name: '整理分类', exact: true}).waitFor()
  assert.equal(await page.locator('[data-category-panel]').first().getByRole('button', {name: '加入待移动', exact: true}).count(), 0)
  await page.locator('[data-category-back-catalog]').click()
  await page.getByRole('heading', {name: '商品资料管理', exact: true}).waitFor()
  assert.equal(await snapshot(), readerBefore)
  await context.close()
  mark('browser tree: category reader keeps the existing organize entry and gains no edit control')

  assert.deepEqual(errors, [])
  console.log(`PASS catalog category tree browser ${groups} groups`)
} catch (error) {
  console.error(error)
  if (page) console.error((await page.locator('body').innerText()).slice(0, 8000))
  process.exitCode = 1
} finally {
  if (browser) await browser.close()
  if (server) await server.close()
  removeTestRuntime(runtime)
}
