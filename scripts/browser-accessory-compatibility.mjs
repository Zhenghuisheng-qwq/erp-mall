import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'

const output = resolve(process.env.ACCESSORY_BROWSER_OUTPUT || 'work/accessory-compatibility/browser')
mkdirSync(output, { recursive: true })
const server = await createServer({ cacheDir: resolve(output, 'vite-cache'), server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } })
const checkpoints = [], diagnostics = [], screenshots = []
let browser, page
const copy = value => JSON.parse(JSON.stringify(value))
const domainRecords = data => ({ skus: data.skus, families: data.families, plans: data.planningRecords, versions: data.specModelVersions, receipts: data.materialReceipts, nodeRules: data.nodeCompatibilityRules })
try {
  const { createAccessoryCompatibilityFixture } = await server.ssrLoadModule('/scripts/accessory-compatibility-fixtures.ts')
  const { ensureProductListPages } = await server.ssrLoadModule('/src/domain/productListPages.ts')
  const { data: fixture } = createAccessoryCompatibilityFixture()
  ensureProductListPages(fixture)
  fixture.productListPages.sku.activeId = 'sku-system-all'
  fixture.productListPages.sku.skuWorkbench.activeId = 'sku-system-all'
  fixture.productListPages.sku.skuWorkbench.defaultId = 'sku-system-all'
  fixture.productListPages.sku.query.pageSize = 50
  await server.listen()
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true })
  async function context(name, options = {}, adjust, recovery = false) {
    const data = copy(fixture); adjust?.(data)
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: 'zh-CN', timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce', ...options })
    await ctx.addInitScript(data => {
      const RealDate = Date, epoch = RealDate.parse('2026-10-23T08:00:00.000Z'), start = RealDate.now()
      window.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [epoch])) } static now() { return epoch + RealDate.now() - start } }
      if (!localStorage.getItem('iyge-v2-mock-db')) localStorage.setItem('iyge-v2-mock-db', JSON.stringify({ version: 15, data }))
      if (!localStorage.getItem('iyge-v2-theme')) localStorage.setItem('iyge-v2-theme', 'light')
      const original = Storage.prototype.setItem
      window.__accessoryFailNext = false; window.__accessoryWrites = []
      Storage.prototype.setItem = function(key, value) {
        if (key === 'iyge-v2-mock-db') {
          if (window.__accessoryFailNext) { window.__accessoryFailNext = false; throw new DOMException('独立兼容验收存储配额失败', 'QuotaExceededError') }
          window.__accessoryWrites.push(value)
        }
        return original.call(this, key, value)
      }
    }, data)
    const current = await ctx.newPage(); current.setDefaultTimeout(15000)
    current.on('pageerror', error => diagnostics.push({ context: name, type: 'pageerror', message: String(error) }))
    current.on('console', message => { if (['error', 'warning'].includes(message.type())) diagnostics.push({ context: name, type: message.type(), message: message.text() }) })
    await current.goto(base + '/skus', { waitUntil: 'networkidle' })
    await current.locator(recovery ? '[data-storage-recovery]' : '[data-sku-workbench]').waitFor()
    return { ctx, page: current }
  }
  const read = () => page.evaluate(async () => JSON.parse(JSON.stringify((await import('/src/stores/catalog.ts')).useCatalogStore().data)))
  const disk = () => page.evaluate(() => localStorage.getItem('iyge-v2-mock-db'))
  const flush = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const drawer = () => page.locator('[data-accessory-drawer]:visible')
  const matches = () => drawer().locator('[data-accessory-match]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-accessory-match')).sort())
  const check = async (name, extra = {}) => { checkpoints.push({ name, ...extra }); console.log(`PASS accessory browser ${name}`) }
  const capture = async name => { await flush(); await page.screenshot({ path: resolve(output, `${name}.png`), animations: 'disabled' }); screenshots.push(`${name}.png`) }
  async function open(id) { await page.locator(`[data-open-compatibility="${id}"]`).click(); await drawer().waitFor(); await flush() }
  async function closeDrawer(keyboard = false) {
    if (keyboard) await page.keyboard.press('Escape')
    else await page.locator('.el-drawer:visible .el-drawer__close-btn').click()
    await drawer().waitFor({ state: 'hidden' }); await flush()
  }
  async function option(field, text) {
    await field.click()
    await page.locator('.el-select-dropdown:visible [role="option"]').filter({ hasText: text }).click()
    if (await page.locator('.el-select-dropdown:visible').count()) await page.keyboard.press('Escape')
  }
  async function choose(id) { await option(drawer().locator('[data-device-choice]'), id.toUpperCase()); await flush() }
  async function manage() { await drawer().getByRole('button', { name: '管理适用关系', exact: true }).click(); await page.getByRole('dialog', { name: '管理适用关系', exact: true }).waitFor() }
  async function closeManager() {
    const dialog = page.getByRole('dialog', { name: '管理适用关系', exact: true })
    await dialog.locator('.el-dialog__headerbtn:visible').first().click()
    await dialog.waitFor({ state: 'hidden' })
  }
  async function navigate(path) { await page.evaluate(async path => (await import('/src/router/index.ts')).default.push(path), path); await page.waitForURL(base + path); await flush() }

  const main = await context('main'); page = main.page
  await page.getByRole('textbox', { name: '在当前视图中搜索' }).fill('phone')
  await page.getByRole('checkbox', { name: '选择 SKU PHONE-A', exact: true }).locator('..').click()
  await page.getByRole('checkbox', { name: '选择 SKU PHONE-B', exact: true }).locator('..').click()
  await page.locator('[data-open-compatibility="phone-a"]').scrollIntoViewIfNeeded(); await flush()
  const viewedBefore = await read(), viewedDisk = await disk()
  await open('phone-a')
  assert.equal(await drawer().locator('[data-device-status]').getAttribute('data-device-status'), 'resolved')
  assert.match(await drawer().locator('.device-summary').innerText(), /品牌 DeviceLab.*测试设备型号 Orion A.*容量 128G/)
  assert.deepEqual(await matches(), ['cable-sku', 'case-sku', 'charger-sku', 'film-sku'])
  assert.match(await drawer().locator('[data-accessory-match="charger-sku"]').innerText(), /基本使用[\s\S]*快充能力[\s\S]*需确认/)
  assert.match(await drawer().locator('[data-accessory-match="cable-sku"]').innerText(), /有条件适用[\s\S]*指定测试转换器/)
  await capture('device-sales-light')
  await drawer().getByRole('tab', { name: /适用物料 2/ }).click()
  assert.deepEqual(await matches(), ['mat-copy', 'mat-only'])
  assert.equal(await drawer().locator('[data-target-kind="sku"]').count(), 0)
  await drawer().getByRole('tab', { name: /待处理 1/ }).click(); assert.deepEqual(await matches(), ['pending-sku'])
  await drawer().getByRole('tab', { name: /不兼容 1/ }).click(); assert.deepEqual(await matches(), ['blocked-sku'])
  assert.match(await drawer().innerText(), /存在相反声明/)
  await drawer().getByRole('tab', { name: /非在售 1/ }).click(); assert.deepEqual(await matches(), ['off-sale-sku'])
  await drawer().getByRole('tab', { name: /销售配件 4/ }).click()
  await option(drawer().locator('[data-accessory-type-filter]'), '测试充电器'); assert.deepEqual(await matches(), ['charger-sku'])
  await drawer().getByRole('textbox', { name: '搜索适用配件' }).fill('不存在的独立测试编号')
  assert.equal((await matches()).length, 0); assert.match(await drawer().innerText(), /搜索/)
  await drawer().getByRole('textbox', { name: '搜索适用配件' }).fill('')
  await choose('phone-b'); assert.deepEqual(await matches(), ['case-sku'])
  await choose('phone-a'); assert.deepEqual(await matches(), ['cable-sku', 'case-sku', 'charger-sku', 'film-sku'])
  await drawer().locator('[data-accessory-match="case-sku"]').getByRole('button', { name: '查看详情', exact: true }).click()
  const detail = page.getByRole('dialog', { name: '配件详情', exact: true }); await detail.waitFor(); assert.match(await detail.innerText(), /CASE-SKU/)
  assert.match(await detail.innerText(), /品牌 CaseWorks · 颜色 白色/)
  await detail.getByRole('button', { name: '查看适用主机', exact: true }).click(); await flush()
  assert.match(await drawer().locator('[data-reverse-count]').innerText(), /2 个型号.*2 条设备 SKU.*2 条声明/)
  await capture('accessory-reverse')
  await closeDrawer(true)
  assert.deepEqual(await read(), viewedBefore, 'Pure view/detail/reverse/filter/close must not change any data or saved view')
  assert.equal(await disk(), viewedDisk)
  assert.equal(await page.getByRole('checkbox', { name: '选择 SKU PHONE-A', exact: true }).isChecked(), true)
  assert.equal(await page.getByRole('checkbox', { name: '选择 SKU PHONE-B', exact: true }).isChecked(), true)
  assert.equal(await page.getByRole('textbox', { name: '在当前视图中搜索' }).inputValue(), 'phone')
  assert.equal(await page.evaluate(() => document.activeElement?.closest('[data-open-compatibility]')?.getAttribute('data-open-compatibility')), 'phone-a')
  await check('view-detail-reverse-scope-conditions-pure-selection-and-focus')

  await open('phone-b'); await manage()
  let manager = page.getByRole('dialog', { name: '管理适用关系', exact: true })
  await manager.getByRole('button', { name: '新增声明', exact: true }).click()
  let editor = page.getByRole('dialog', { name: '新增兼容声明', exact: true })
  await option(editor.locator('[data-declaration-targets]'), 'CHARGER-SKU')
  await editor.locator('textarea[data-declaration-source], [data-declaration-source] textarea').fill('独立浏览器验收：管理员明确维护的测试声明')
  await editor.getByRole('button', { name: '预览变更', exact: true }).click()
  assert.match(await editor.locator('[data-compatibility-preview]').innerText(), /新增 1 条/)
  const failureBefore = await read(), failureDisk = await disk()
  await page.evaluate(() => { window.__accessoryFailNext = true })
  await editor.getByRole('button', { name: '确认保存', exact: true }).click(); await flush()
  assert.match(await editor.locator('[data-declaration-error]').innerText(), /无法保存到本机.*草稿已保留/)
  assert.match(await editor.locator('textarea[data-declaration-source], [data-declaration-source] textarea').inputValue(), /独立浏览器验收/)
  assert.equal(await editor.getByRole('button', { name: '确认保存', exact: true }).isEnabled(), true)
  assert.deepEqual(await read(), failureBefore); assert.equal(await disk(), failureDisk)
  await capture('declaration-storage-failure')
  await editor.getByRole('button', { name: '确认保存', exact: true }).click(); await editor.waitFor({ state: 'hidden' }); await flush()
  await closeManager(); assert.deepEqual(await matches(), ['case-sku', 'charger-sku'])
  const saved = await read(); assert.equal(saved.compatibilities.length, failureBefore.compatibilities.length + 1)
  assert.deepEqual(domainRecords(saved), domainRecords(failureBefore))
  await closeDrawer(); await page.reload({ waitUntil: 'networkidle' }); await open('phone-b')
  assert.deepEqual(await matches(), ['case-sku', 'charger-sku'])
  await check('new-declaration-preview-quota-draft-retry-refresh-immediate-results')

  await choose('phone-a'); await manage()
  manager = page.getByRole('dialog', { name: '管理适用关系', exact: true })
  async function prepareCopy() {
    await manager.getByRole('button', { name: '从物料适用关系复制', exact: true }).click()
    const copyEditor = page.getByRole('dialog', { name: '从物料适用关系复制', exact: true })
    await option(copyEditor.locator('[data-copy-source]'), 'MAT-COPY')
    await option(copyEditor.locator('[data-copy-target]'), 'COPY-SKU')
    await copyEditor.getByRole('button', { name: '预览变更', exact: true }).click()
    assert.match(await copyEditor.locator('[data-compatibility-preview]').innerText(), /新增 2 条.*重复跳过 0 条/)
    return copyEditor
  }
  const copyBefore = await read(), copyDisk = await disk()
  editor = await prepareCopy(); await capture('material-copy-preview')
  await editor.getByRole('button', { name: '取消', exact: true }).click(); await editor.waitFor({ state: 'hidden' }); await flush()
  assert.deepEqual(await read(), copyBefore); assert.equal(await disk(), copyDisk)
  editor = await prepareCopy(); await editor.getByRole('button', { name: '确认保存', exact: true }).click(); await editor.waitFor({ state: 'hidden' }); await flush()
  const afterCopy = await read(), copies = afterCopy.compatibilities.filter(link => link.targetKind === 'sku' && link.targetId === 'copy-sku')
  assert.equal(copies.length, 2); assert.ok(copies.every(link => link.provenance.kind === 'material-copy' && link.provenance.materialId === 'mat-copy' && link.provenance.declarationSnapshot))
  assert.deepEqual(domainRecords(afterCopy), domainRecords(copyBefore))
  await manager.locator('[data-declaration-id="decl-mat-copy-a"]').getByRole('button', { name: '编辑声明', exact: true }).click()
  editor = page.getByRole('dialog', { name: '编辑兼容声明', exact: true })
  await option(editor.locator('[data-declaration-conclusion]'), '明确不兼容')
  await editor.getByRole('button', { name: '预览变更', exact: true }).click(); await editor.getByRole('button', { name: '确认保存', exact: true }).click(); await editor.waitFor({ state: 'hidden' }); await flush()
  assert.deepEqual((await read()).compatibilities.filter(link => link.targetKind === 'sku' && link.targetId === 'copy-sku'), copies)
  await closeManager(); assert.ok((await matches()).includes('copy-sku'))
  await closeDrawer(); await page.reload({ waitUntil: 'networkidle' }); await open('phone-a')
  assert.ok((await matches()).includes('copy-sku')); await check('explicit-material-copy-cancel-confirm-source-snapshot-independent-refresh')

  await choose('phone-unbound')
  assert.equal(await drawer().locator('[data-device-status]').getAttribute('data-device-status'), 'unconfigured')
  assert.equal(await drawer().locator('[data-accessory-match]').count(), 0)
  await drawer().getByRole('button', { name: '配置设备型号', exact: true }).click()
  const binding = page.getByRole('dialog', { name: '配置设备型号', exact: true })
  await option(binding.locator('[data-binding-host]'), '【独立测试】Orion A')
  await binding.getByRole('button', { name: '确认绑定型号', exact: true }).click(); await binding.waitFor({ state: 'hidden' }); await flush()
  assert.equal(await drawer().locator('[data-device-status]').getAttribute('data-device-status'), 'resolved')
  assert.ok((await matches()).includes('case-sku'))
  await closeDrawer(); await page.reload({ waitUntil: 'networkidle' }); await open('phone-unbound')
  assert.equal(await drawer().locator('[data-device-status]').getAttribute('data-device-status'), 'resolved')
  await check('unconfigured-device-explicit-binding-refresh')

  const declarationsBeforeUnbind = (await read()).compatibilities, bindingDisk = await disk()
  await drawer().getByRole('button', { name: '查看或重新绑定型号', exact: true }).click()
  let bindingEditor = page.getByRole('dialog', { name: '配置设备型号', exact: true })
  await bindingEditor.getByRole('button', { name: '解除显式绑定', exact: true }).click()
  await page.evaluate(() => { window.__accessoryFailNext = true })
  await page.getByRole('dialog', { name: '解除显式绑定', exact: true }).getByRole('button', { name: '确认解除绑定', exact: true }).click()
  await bindingEditor.locator('[data-binding-error]').waitFor()
  assert.equal(await disk(), bindingDisk); assert.ok((await read()).deviceBindings.some(item => item.skuId === 'phone-unbound'))
  await bindingEditor.getByRole('button', { name: '解除显式绑定', exact: true }).click()
  await page.getByRole('dialog', { name: '解除显式绑定', exact: true }).getByRole('button', { name: '确认解除绑定', exact: true }).click()
  await bindingEditor.waitFor({ state: 'hidden' }); await flush()
  assert.equal(await drawer().locator('[data-device-status]').getAttribute('data-device-status'), 'unconfigured')
  assert.deepEqual((await read()).compatibilities, declarationsBeforeUnbind)
  await check('explicit-binding-removal-quota-retry-keeps-declarations')

  await closeDrawer(); await navigate('/spus/family-device')
  await page.locator('[data-spu-compatibility]').click(); await drawer().waitFor()
  assert.equal(await drawer().locator('[data-accessory-match]').count(), 0, 'Multi-model SPU cannot display a union of accessories')
  await option(drawer().locator('[data-device-choice]'), 'PHONE-B'); assert.deepEqual(await matches(), ['case-sku', 'charger-sku', 'copy-sku'])
  await closeDrawer(); await check('multi-model-spu-explicit-choice')
  await navigate('/compatibility'); await page.locator('[data-compatibility-manager]').waitFor()
  assert.ok(await page.getByRole('heading', { name: '适用关系', exact: true }).isVisible())
  await check('unified-maintenance-entry')
  await main.ctx.close()

  const readonly = await context('readonly', {}, data => { data.activeRole = 'operator' }); page = readonly.page
  await open('phone-a'); assert.deepEqual(await matches(), ['cable-sku', 'case-sku', 'charger-sku', 'film-sku'])
  assert.equal(await drawer().getByRole('button', { name: '管理适用关系', exact: true }).count(), 0)
  assert.match(await drawer().innerText(), /只读/)
  await closeDrawer(); await navigate('/compatibility'); await page.locator('[data-compatibility-manager]').waitFor()
  assert.equal(await page.getByRole('button', { name: '新增声明', exact: true }).count(), 0)
  await check('readonly-role-view-without-maintenance'); await readonly.ctx.close()

  const paged = await context('paged-view', {}, data => { data.productListPages.sku.query.pageSize = 1; data.productListPages.sku.query.keyword = 'phone'; data.productListPages.sku.query.page = 2 }); page = paged.page
  const pageBefore = await read(), pageDisk = await disk()
  await page.getByRole('checkbox', { name: '选择 SKU PHONE-B', exact: true }).locator('..').click()
  await page.locator('[data-open-compatibility="phone-b"]').scrollIntoViewIfNeeded(); await flush()
  const scrollBefore = await page.evaluate(() => ({ top: scrollY, tables: [...document.querySelectorAll('.sku-table .el-scrollbar__wrap')].map(node => node.scrollLeft) }))
  await open('phone-b'); assert.deepEqual(await matches(), ['case-sku']); await closeDrawer()
  assert.equal((await page.locator('.el-pager .is-active').innerText()).trim(), '2')
  assert.equal(await page.getByRole('checkbox', { name: '选择 SKU PHONE-B', exact: true }).isChecked(), true)
  assert.deepEqual(await read(), pageBefore); assert.equal(await disk(), pageDisk)
  assert.deepEqual(await page.evaluate(() => ({ top: scrollY, tables: [...document.querySelectorAll('.sku-table .el-scrollbar__wrap')].map(node => node.scrollLeft) })), scrollBefore)
  await check('drawer-close-preserves-saved-view-search-page-selection-and-scroll'); await paged.ctx.close()

  const onlyMaterial = await context('material-only', {}, data => { data.compatibilities = data.compatibilities.filter(link => (link.targetKind || 'material') === 'material') }); page = onlyMaterial.page
  await open('phone-a'); await drawer().locator('[data-material-only]').waitFor()
  assert.equal((await matches()).length, 0)
  assert.match(await drawer().locator('[data-material-only]').innerText(), /尚无.*销售.*声明/)
  await drawer().getByRole('tab', { name: /适用物料 2/ }).click(); assert.deepEqual(await matches(), ['mat-copy', 'mat-only'])
  await capture('material-only-guidance'); await closeDrawer(); await check('material-only-no-inferred-sale-sku-and-maintenance-guidance'); await onlyMaterial.ctx.close()

  const bulk = await context('bulk'); page = bulk.page
  await navigate('/compatibility')
  const globalManager = page.locator('[data-compatibility-manager]')
  await globalManager.getByRole('button', { name: '新增声明', exact: true }).click()
  editor = page.getByRole('dialog', { name: '新增兼容声明', exact: true })
  await option(editor.locator('[data-declaration-targets]'), 'CASE-SKU')
  await option(editor.locator('[data-declaration-targets]'), 'CHARGER-SKU')
  await option(editor.locator('[data-declaration-hosts]'), '【独立测试】Orion B')
  await editor.locator('textarea[data-declaration-source], [data-declaration-source] textarea').fill('独立浏览器批量维护依据')
  await editor.getByRole('button', { name: '预览变更', exact: true }).click()
  assert.match(await editor.locator('[data-compatibility-preview]').innerText(), /新增 1 条.*重复跳过 1 条/)
  const bulkBefore = await read()
  await editor.getByRole('button', { name: '确认保存', exact: true }).click(); await editor.waitFor({ state: 'hidden' }); await flush()
  const created = (await read()).compatibilities.find(link => link.targetId === 'charger-sku' && link.host.productModelId === 'device:model-b')
  assert.ok(created); assert.equal((await read()).compatibilities.length, bulkBefore.compatibilities.length + 1)
  async function bulkCommand(name) {
    await globalManager.getByRole('checkbox', { name: `选择声明 ${created.id}`, exact: true }).locator('..').click()
    await globalManager.locator('.batch-tools').getByRole('button', { name, exact: true }).click()
    const batchEditor = page.getByRole('dialog', { name: '确认批量变更', exact: true })
    await batchEditor.locator('[data-compatibility-preview]').waitFor()
    await batchEditor.getByRole('button', { name: '确认保存', exact: true }).click(); await batchEditor.waitFor({ state: 'hidden' }); await flush()
  }
  await bulkCommand('标记待确认')
  assert.equal((await read()).compatibilities.find(link => link.id === created.id).verification, 'pending')
  await navigate('/skus'); await open('phone-b'); assert.deepEqual(await matches(), ['case-sku'])
  await drawer().getByRole('tab', { name: /待处理 1/ }).click(); assert.deepEqual(await matches(), ['charger-sku']); await closeDrawer()
  await navigate('/compatibility'); await bulkCommand('声明不兼容')
  assert.equal((await read()).compatibilities.find(link => link.id === created.id).conclusion, 'incompatible')
  await navigate('/skus'); await open('phone-b'); await drawer().getByRole('tab', { name: /不兼容 1/ }).click(); assert.deepEqual(await matches(), ['charger-sku']); await closeDrawer()
  await navigate('/compatibility'); await bulkCommand('取消声明')
  assert.equal((await read()).compatibilities.some(link => link.id === created.id), false)
  assert.deepEqual(domainRecords(await read()), domainRecords(bulkBefore))
  await check('bulk-add-duplicate-preview-pending-exclusion-cancellation'); await bulk.ctx.close()

  const legacy = await context('legacy-material'); page = legacy.page
  await navigate('/compatibility?sku=mat-copy')
  const oldNote = page.getByPlaceholder('补充说明，可留空').first()
  await oldNote.fill('独立验收：物料说明失败后原值重试')
  const legacyBefore = await read(), legacyDisk = await disk()
  await page.evaluate(() => { window.__accessoryFailNext = true })
  await page.getByRole('button', { name: '保存说明', exact: true }).first().click(); await flush()
  assert.equal(await oldNote.inputValue(), '独立验收：物料说明失败后原值重试')
  assert.match(await page.getByText(/无法保存到本机/).first().innerText(), /无法保存到本机/)
  assert.deepEqual(await read(), legacyBefore); assert.equal(await disk(), legacyDisk)
  await page.getByRole('button', { name: '保存说明', exact: true }).first().click(); await flush()
  assert.equal((await read()).compatibilities.find(link => link.id === 'decl-mat-copy-a').note, '独立验收：物料说明失败后原值重试')
  await page.reload({ waitUntil: 'networkidle' }); assert.equal(await page.getByPlaceholder('补充说明，可留空').first().inputValue(), '独立验收：物料说明失败后原值重试')
  await check('legacy-mat-entry-note-quota-retained-retry-refresh'); await legacy.ctx.close()

  const broken = await context('incomplete-storage', {}, data => { delete data.families }, true); page = broken.page
  const original = await disk()
  assert.match(await page.locator('[data-storage-recovery]').innerText(), /原存储.*未.*清空|原存储没有被清空/)
  assert.equal(await page.locator('[data-sku-workbench]').count(), 0)
  assert.equal(await page.evaluate(() => window.__accessoryWrites.length), 0)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '下载原始数据备份', exact: true }).click()
  const download = await downloadPromise
  assert.equal(readFileSync(await download.path(), 'utf8'), original)
  await page.locator('[data-recovery-file]').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{') })
  await page.locator('[data-recovery-error]').waitFor(); assert.equal(await disk(), original)
  await page.locator('[data-recovery-file]').setInputFiles({ name: 'valid-independent-fixture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 15, data: fixture })) })
  const restoreData = page.getByRole('button', { name: '确认导入并重新打开', exact: true })
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent.includes('确认导入并重新打开') && !button.disabled))
  assert.equal(await disk(), original)
  await page.evaluate(() => { window.__accessoryFailNext = true }); await restoreData.click()
  assert.match(await page.locator('[data-recovery-error]').innerText(), /无法保存到本机/); assert.equal(await disk(), original); assert.equal(await restoreData.isEnabled(), true)
  await capture('incomplete-storage-safe-recovery')
  await restoreData.click(); await page.locator('[data-sku-workbench]').waitFor()
  assert.deepEqual(domainRecords(await read()), domainRecords(copy(fixture)), 'Recovered records must equal the complete JSON file, including identities and array order')
  await check('incomplete-storage-no-seed-download-validate-quota-retry-recovery'); await broken.ctx.close()

  for (const scenario of [{ name: 'dark-desktop', viewport: { width: 1366, height: 768 }, dark: true }, { name: 'narrow', viewport: { width: 780, height: 900 } }, { name: 'equivalent-125-percent', viewport: { width: 1093, height: 614 }, deviceScaleFactor: 1.25 }]) {
    const visual = await context(scenario.name, { viewport: scenario.viewport, deviceScaleFactor: scenario.deviceScaleFactor || 1 }); page = visual.page
    if (scenario.dark) { await page.evaluate(() => { localStorage.setItem('iyge-v2-theme', 'dark') }); await page.reload({ waitUntil: 'networkidle' }) }
    await open('phone-a'); assert.deepEqual(await matches(), ['cable-sku', 'case-sku', 'charger-sku', 'film-sku'])
    assert.equal(await page.evaluate(() => document.querySelector('.el-drawer')?.getBoundingClientRect().right <= innerWidth + 1), true)
    await capture(scenario.name); await manage(); await page.getByRole('dialog', { name: '管理适用关系', exact: true }).getByRole('button', { name: '新增声明', exact: true }).click()
    editor = page.getByRole('dialog', { name: '新增兼容声明', exact: true }); await editor.waitFor(); await capture(`${scenario.name}-editor`)
    const bounds = await editor.boundingBox(); assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= scenario.viewport.width + 1)
    await editor.getByRole('button', { name: '取消', exact: true }).click(); await editor.waitFor({ state: 'hidden' }); await closeManager(); await closeDrawer()
    await check(scenario.name, { viewport: scenario.viewport, deviceScaleFactor: scenario.deviceScaleFactor || 1 }); await visual.ctx.close()
  }
  assert.deepEqual(diagnostics, [], 'No browser errors or Vue warnings')
  writeFileSync(resolve(output, 'result.json'), JSON.stringify({ result: 'PASS', browser: browser.version(), checkpoints, screenshots, diagnostics }, null, 2))
  console.log(`PASS ${checkpoints.length} accessory browser checkpoints`)
} catch (error) {
  if (page && !page.isClosed()) { await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {}) }
  if (page && !page.isClosed()) writeFileSync(resolve(output, 'failure.html'), await page.content())
  writeFileSync(resolve(output, 'failure.json'), JSON.stringify({ error: String(error), checkpoints, screenshots, diagnostics }, null, 2))
  throw error
} finally { await browser?.close(); await server.close() }
