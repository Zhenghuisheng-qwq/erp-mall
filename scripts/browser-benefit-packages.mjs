import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import * as XLSX from 'xlsx'

const output = resolve(process.env.BENEFIT_BROWSER_OUTPUT || 'work/benefit-package/browser')
mkdirSync(output, { recursive: true })
const server = await createServer({ cacheDir: resolve(output, 'vite-cache'), server: { host: '127.0.0.1', port: 0, open: false, hmr: false, watch: null } })
const checkpoints = [], diagnostics = [], screenshots = []
let browser, page
const copy = value => JSON.parse(JSON.stringify(value))
const frozen = data => ({ families: data.families, skus: data.skus, planning: data.planningRecords, receipts: data.materialReceipts, versions: data.specModelVersions, nodes: data.productSpecNodes, nodeRules: data.nodeCompatibilityRules, declarations: data.compatibilities, bindings: data.deviceBindings })
try {
  const { createBenefitPackageFixture } = await server.ssrLoadModule('/scripts/benefit-package-fixtures.ts')
  const { ensureProductListPages } = await server.ssrLoadModule('/src/domain/productListPages.ts')
  const { data: fixture } = createBenefitPackageFixture()
  ensureProductListPages(fixture)
  fixture.productListPages.sku.activeId = 'sku-system-all'; fixture.productListPages.sku.skuWorkbench.activeId = 'sku-system-all'; fixture.productListPages.sku.skuWorkbench.defaultId = 'sku-system-all'
  fixture.productListPages.sku.query.pageSize = 50
  await server.listen()
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true }).catch(error => { throw new Error('Benefit browser checks need an installed Chrome or BROWSER_CHANNEL. No check was skipped.', { cause: error }) })
  async function context(name, path = '/skus', data = fixture, options = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: 'zh-CN', timezoneId: 'Asia/Singapore', reducedMotion: 'reduce', acceptDownloads: true, ...options })
    await ctx.addInitScript(data => {
      const RealDate = Date, epoch = RealDate.parse('2026-10-23T09:00:00.000Z'), start = RealDate.now()
      window.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [epoch])) } static now() { return epoch + RealDate.now() - start } }
      if (!localStorage.getItem('iyge-v2-mock-db')) localStorage.setItem('iyge-v2-mock-db', JSON.stringify({ version: 15, data }))
      if (!localStorage.getItem('iyge-v2-theme')) localStorage.setItem('iyge-v2-theme', 'light')
      const set = Storage.prototype.setItem
      window.__benefitFailNext = false; window.__benefitWrites = []; window.__benefitPrints = 0; window.__benefitFailExport = false
      Storage.prototype.setItem = function(key, value) {
        if (key === 'iyge-v2-mock-db') {
          if (window.__benefitFailNext) { window.__benefitFailNext = false; throw new DOMException('独立权益包存储失败注入', 'QuotaExceededError') }
          window.__benefitWrites.push(value)
        }
        return set.call(this, key, value)
      }
      window.print = () => { window.__benefitPrints++ }
      const create = URL.createObjectURL.bind(URL)
      URL.createObjectURL = function(blob) { if (window.__benefitFailExport) { window.__benefitFailExport = false; throw new Error('独立 Excel 导出失败注入') }; return create(blob) }
    }, copy(data))
    const current = await ctx.newPage(); current.setDefaultTimeout(15000)
    current.on('pageerror', error => diagnostics.push({ context: name, type: 'pageerror', message: String(error) }))
    current.on('console', message => { if (['error', 'warning'].includes(message.type())) diagnostics.push({ context: name, type: message.type(), message: message.text() }) })
    await current.goto(base + path, { waitUntil: 'networkidle' })
    return { ctx, page: current }
  }
  const read = () => page.evaluate(async () => JSON.parse(JSON.stringify((await import('/src/stores/catalog.ts')).useCatalogStore().data)))
  const disk = () => page.evaluate(() => localStorage.getItem('iyge-v2-mock-db'))
  const flush = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const editor = () => page.locator('[data-benefit-editor]')
  const goods = id => page.locator(`[data-benefit-goods="${id}"]`)
  const check = async name => { checkpoints.push({ name }); console.log(`PASS benefit browser ${name}`) }
  const capture = async name => { await flush(); await page.screenshot({ path: resolve(output, `${name}.png`), animations: 'disabled' }); screenshots.push(`${name}.png`) }
  async function navigate(path) { await page.evaluate(async path => (await import('/src/router/index.ts')).default.push(path), path); await page.waitForURL(base + path); await flush() }
  async function option(field, text, multiple = false) {
    await field.click(); await page.locator('.el-select-dropdown:visible [role="option"]').filter({ hasText: text }).first().click()
    // Only a multiple select needs an explicit close. An Escape during a single
    // select's closing transition could close the newly opened device dialog.
    if (multiple) await field.locator('input').first().press('Escape')
    await page.locator('.el-select-dropdown:visible').waitFor({ state: 'hidden' }); await flush()
  }
  async function checkbox(locator, value) { if (await locator.isChecked() !== value) await locator.locator('..').click(); assert.equal(await locator.isChecked(), value) }
  async function add(id) { await page.locator(`[data-benefit-add-sku="${id}"]`).click(); await goods(id).waitFor() }
  async function service(name, measurement) {
    await editor().getByRole('button', { name: '添加服务权益', exact: true }).first().click()
    const dialog = page.getByRole('dialog', { name: '添加服务权益', exact: true }); await dialog.waitFor()
    await dialog.getByRole('textbox', { name: '服务名称', exact: true }).fill(name)
    await dialog.getByRole('textbox', { name: '服务有效期说明', exact: true }).fill('每份 3 个月，不按包数延长')
    await dialog.getByRole('textbox', { name: '服务说明', exact: true }).fill('=1+1（独立测试，作为纯文本保存）')
    await dialog.getByRole('radio', { name: measurement === 'per-delivery' ? '本次交付计量' : '每包计量', exact: true }).locator('..').click()
    await dialog.locator('[data-benefit-save-service]').click(); await dialog.waitFor({ state: 'hidden' })
  }
  async function save(status = 'available') {
    await page.locator(status === 'draft' ? '[data-benefit-save-draft]' : '[data-benefit-save]').click()
    await page.waitForURL(/\/benefit-packages\/(?!new|deliveries)[^/?]+(?:\?|$)/); await flush()
    const data = await read(); return data.benefitPackages.find(item => locationId(page.url()) === item.id)
  }
  function locationId(url) { return decodeURIComponent(new URL(url).pathname.split('/').pop()) }
  async function preview(count) {
    await page.getByRole('textbox', { name: '本次包数', exact: true }).fill(String(count))
    await page.locator('[data-benefit-preview-delivery]').click(); await page.locator('[data-benefit-delivery-preview]').waitFor()
  }
  async function confirmDelivery() { await checkbox(page.getByRole('checkbox', { name: /已核对.*组成.*报价/ }), true); await page.locator('[data-benefit-confirm-delivery]').click() }

  const main = await context('main'); page = main.page
  await page.locator('[data-sku-workbench]').waitFor()
  await page.getByRole('textbox', { name: '在当前视图中搜索' }).fill('phone')
  await checkbox(page.getByRole('checkbox', { name: '选择 SKU PHONE-A', exact: true }), true)
  await checkbox(page.getByRole('checkbox', { name: '选择 SKU PHONE-B', exact: true }), true)
  const original = await read()
  await page.locator('[data-benefit-more="phone-a"]').click(); await page.locator('[data-compose-benefit="phone-a"]').click(); await editor().waitFor()
  assert.equal(await page.locator('[data-benefit-goods]').count(), 0)
  assert.match(await editor().innerText(), /PHONE-A|phone-a/)
  await page.locator('[data-benefit-cancel]').click(); await page.locator('[data-sku-workbench]').waitFor(); await flush()
  assert.equal(await page.getByRole('checkbox', { name: '选择 SKU PHONE-A', exact: true }).isChecked(), true)
  assert.equal(await page.getByRole('checkbox', { name: '选择 SKU PHONE-B', exact: true }).isChecked(), true)
  assert.equal(await page.getByRole('textbox', { name: '在当前视图中搜索' }).inputValue(), 'phone')
  assert.equal(await page.evaluate(() => document.activeElement?.closest('[data-benefit-more]')?.getAttribute('data-benefit-more')), 'phone-a')
  assert.deepEqual(await read(), original)
  await check('sku-entry-context-only-cancel-preserves-view-search-selection')
  await page.locator('[data-open-compatibility="phone-a"]').click(); await page.locator('[data-accessory-drawer]:visible').waitFor()
  await page.locator('[data-compose-from-compatibility]').click(); await editor().waitFor()
  assert.equal(await page.locator('[data-benefit-goods]').count(), 0)
  await page.getByRole('textbox', { name: '权益包名称', exact: true }).fill('【独立测试】零元设备配套包')
  await add('case-sku'); await add('case-sku'); await add('film-sku')
  assert.equal(await goods('case-sku').getByRole('textbox', { name: /每包数量/ }).inputValue(), '2')
  assert.equal(await page.locator('[data-benefit-goods]').count(), 2)
  await goods('case-sku').getByRole('textbox', { name: /每包数量/ }).fill('1.5')
  await page.locator('[data-benefit-save-draft]').click(); assert.match(await editor().innerText(), /正整数/)
  assert.equal(await goods('case-sku').getByRole('textbox', { name: /每包数量/ }).inputValue(), '1.5')
  await goods('case-sku').getByRole('textbox', { name: /每包数量/ }).fill('2')
  await page.locator('[data-benefit-replace="film-sku"]').click()
  const replaceDialog = page.getByRole('dialog', { name: '替换具体 SKU', exact: true }); await replaceDialog.waitFor()
  await option(replaceDialog.locator('[data-benefit-replacement]'), 'CHARGER-SKU')
  await replaceDialog.getByRole('button', { name: '确认替换', exact: true }).click(); await replaceDialog.waitFor({ state: 'hidden' })
  assert.equal(await goods('film-sku').count(), 0); assert.equal(await goods('charger-sku').getByRole('textbox', { name: /每包数量/ }).inputValue(), '1')
  await page.locator('[data-benefit-replace="charger-sku"]').click(); await replaceDialog.waitFor()
  await option(replaceDialog.locator('[data-benefit-replacement]'), 'FILM-SKU')
  await replaceDialog.getByRole('button', { name: '确认替换', exact: true }).click(); await replaceDialog.waitFor({ state: 'hidden' })
  assert.equal(await goods('charger-sku').count(), 0)
  await service('【独立测试】每包贴膜服务', 'per-package'); await service('【独立测试】本次上门服务', 'per-delivery')
  await page.getByRole('textbox', { name: '每包报价（元）', exact: true }).fill('0')
  await capture('editor-light')
  const beforeSave = await read(), beforeDisk = await disk()
  await page.evaluate(() => { window.__benefitFailNext = true }); await page.locator('[data-benefit-save]').click(); await flush()
  assert.match(await page.locator('[data-benefit-error]').innerText(), /保存|本机/)
  assert.deepEqual(await read(), beforeSave); assert.equal(await disk(), beforeDisk)
  assert.equal(await page.getByRole('textbox', { name: '权益包名称', exact: true }).inputValue(), '【独立测试】零元设备配套包')
  await capture('save-failure-keeps-draft')
  const saved = await save(); assert.ok(saved); assert.equal(saved.goods.length, 2); assert.equal(saved.includedPhoneSkuId, ''); assert.equal(saved.quote.amountCents, 0)
  assert.deepEqual(frozen(await read()), frozen(beforeSave)); await page.reload({ waitUntil: 'networkidle' }); await editor().waitFor()
  await check('accessory-entry-add-merge-replace-invalid-quantity-services-zero-quote-save-quota-retry-refresh')
  await preview(3)
  const previewData = await read(); assert.equal(previewData.benefitDeliveries.length, 0)
  assert.match(await page.locator('[data-benefit-delivery-preview]').innerText(), /3 包/)
  const generationDisk = await disk()
  await page.evaluate(() => { window.__benefitFailNext = true }); await confirmDelivery(); await flush()
  assert.equal((await read()).benefitDeliveries.length, 0); assert.equal(await disk(), generationDisk)
  assert.equal(await page.locator('[data-benefit-confirm-delivery]').isEnabled(), true)
  await capture('delivery-failure-keeps-preview')
  await page.locator('[data-benefit-confirm-delivery]').click(); await page.locator('[data-benefit-delivery-detail]').waitFor()
  let data = await read(); const firstDelivery = copy(data.benefitDeliveries[0])
  assert.equal(data.benefitDeliveries.length, 1); assert.equal(firstDelivery.packageCount, 3)
  assert.deepEqual(firstDelivery.goods.map(row => [row.skuId, row.perPackageQuantity, row.totalQuantity]), [['case-sku', 2, 6], ['film-sku', 1, 3]])
  assert.deepEqual(firstDelivery.services.map(row => [row.measurement, row.totalQuantity]), [['per-package', 3], ['per-delivery', 1]])
  assert.equal(firstDelivery.quote.totalCents, 0)
  await page.reload({ waitUntil: 'networkidle' }); await page.locator('[data-benefit-delivery-detail]').waitFor()
  assert.deepEqual((await read()).benefitDeliveries[0], firstDelivery)
  await capture('delivery-light')
  await check('three-pack-preview-pure-generation-quota-retry-frozen-totals-refresh')
  const printBefore = await read(), printDisk = await disk()
  await page.locator('[data-benefit-print]').click(); assert.equal(await page.evaluate(() => window.__benefitPrints), 1)
  await page.emulateMedia({ media: 'print' })
  assert.equal(await page.locator('.rail-wrap').isVisible(), false); assert.equal(await page.locator('.topbar').isVisible(), false)
  assert.equal(await page.locator('[data-benefit-delivery-sheet]').isVisible(), true)
  await capture('delivery-print-style'); await page.emulateMedia({ media: 'screen' })
  await page.evaluate(() => { window.__benefitFailExport = true }); await page.locator('[data-benefit-export]').click()
  assert.match(await page.locator('[data-benefit-export-error]').innerText(), /导出失败/)
  for (let index = 0; index < 2; index++) {
    const promise = page.waitForEvent('download'); await page.locator('[data-benefit-export]').click(); const download = await promise
    assert.match(download.suggestedFilename(), /BPK.*BDL.*\.xlsx$/)
    const path = resolve(output, `delivery-export-${index}.xlsx`); await download.saveAs(path)
    const book = XLSX.read(readFileSync(path), { type: 'buffer', cellFormula: true })
    const goodsRows = XLSX.utils.sheet_to_json(book.Sheets['商品明细'], { header: 1 })
    assert.equal(goodsRows[1][7], 6); assert.equal(goodsRows[2][7], 3)
    const serviceRows = XLSX.utils.sheet_to_json(book.Sheets['服务权益'], { header: 1 })
    assert.equal(serviceRows[1][4], 3); assert.equal(serviceRows[2][4], 1)
    for (const sheet of Object.values(book.Sheets)) for (const [address, cell] of Object.entries(sheet)) if (!address.startsWith('!')) assert.equal(cell.f, undefined)
  }
  assert.deepEqual(await read(), printBefore); assert.equal(await disk(), printDisk)
  await check('snapshot-print-style-export-real-xlsx-failure-retry-repeat-no-business-writes')

  await navigate(`/benefit-packages/${saved.id}`); await editor().waitFor()
  await checkbox(page.getByRole('checkbox', { name: '包含这台手机', exact: true }), true); await goods('phone-a').waitFor()
  await checkbox(page.getByRole('checkbox', { name: '包含这台手机', exact: true }), true)
  assert.equal(await goods('phone-a').count(), 1)
  await page.getByRole('checkbox', { name: '包含这台手机', exact: true }).locator('..').click()
  await page.getByRole('button', { name: '确认移除这条手机', exact: true }).click(); await goods('phone-a').waitFor({ state: 'hidden' })
  await checkbox(page.getByRole('checkbox', { name: '包含这台手机', exact: true }), true)
  await option(page.locator('[data-benefit-device]'), 'PHONE-B')
  const switchDialog = page.getByRole('dialog', { name: /更换适配/ }); await switchDialog.waitFor()
  await switchDialog.getByRole('button', { name: /仅更换适配/ }).click(); assert.equal(await goods('phone-a').count(), 1); assert.equal(await goods('phone-b').count(), 0)
  assert.equal(await goods('film-sku').count(), 1); assert.match(await editor().innerText(), /待确认|尚未确认/)
  await option(page.locator('[data-benefit-device]'), 'PHONE-A'); await switchDialog.getByRole('button', { name: /仅更换适配/ }).click()
  const afterPhone = await save(); assert.equal(afterPhone.includedPhoneSkuId, 'phone-a')
  assert.deepEqual((await read()).benefitDeliveries[0], firstDelivery)
  await preview(2); await confirmDelivery(); await page.locator('[data-benefit-delivery-detail]').waitFor()
  data = await read(); assert.equal(data.benefitDeliveries.length, 2); assert.equal(data.benefitDeliveries[1].goods.find(row => row.skuId === 'phone-a').totalQuantity, 2)
  assert.deepEqual(data.benefitDeliveries[0], firstDelivery)
  await check('explicit-phone-add-remove-switch-preserves-goods-and-new-request-second-delivery')

  await navigate('/benefit-packages'); await page.locator('[data-benefit-packages]').waitFor()
  await page.locator(`[data-benefit-package="${saved.id}"]`).getByRole('button', { name: '设为常用', exact: true }).click()
  const source = copy((await read()).benefitPackages.find(item => item.id === saved.id))
  await page.locator(`[data-copy-benefit-package="${saved.id}"]`).click(); await editor().waitFor()
  assert.match(await editor().innerText(), /待生成/)
  await page.getByRole('textbox', { name: '权益包名称', exact: true }).fill('【独立测试】常用副本')
  await goods('case-sku').getByRole('textbox', { name: /每包数量/ }).fill('3')
  const copied = await save(); assert.notEqual(copied.id, saved.id); assert.notEqual(copied.code, saved.code)
  assert.deepEqual((await read()).benefitPackages.find(item => item.id === saved.id), source)
  assert.equal((await read()).benefitDeliveries.length, 2)
  await check('favorite-copy-new-identity-deep-independent-source-history-and-quote-review')

  await editor().getByRole('button', { name: '高级设置 · 选配规则与快充要求', exact: true }).click()
  await page.getByRole('switch', { name: '启用选配规则', exact: true }).locator('..').click()
  const beforeRules = await page.locator('[data-benefit-goods]').count()
  await page.locator('[data-add-benefit-rule]').click()
  const group = page.locator('[data-benefit-rule]').first()
  await group.getByRole('textbox', { name: '选配组名称', exact: true }).fill('【独立测试】配件选配组')
  await option(group.locator('[data-rule-candidates]'), 'CASE-SKU', true); await option(group.locator('[data-rule-candidates]'), 'FILM-SKU', true)
  assert.equal(await page.locator('[data-benefit-goods]').count(), beforeRules, 'Saving candidates must not add goods')
  await checkbox(group.getByRole('checkbox', { name: '必选组', exact: true }), true)
  await group.getByRole('textbox', { name: '最少选择种数', exact: true }).fill('1')
  await group.getByRole('textbox', { name: '最多选择种数', exact: true }).fill('2')
  await checkbox(group.getByRole('checkbox', { name: '允许调整件数', exact: true }), true)
  await group.getByRole('textbox', { name: '每种最多件数', exact: true }).fill('5')
  await page.locator('[data-add-benefit-rule]').click()
  const duplicateGroup = page.locator('[data-benefit-rule]').last()
  await duplicateGroup.getByRole('textbox', { name: '选配组名称', exact: true }).fill('【独立测试】冲突组')
  await option(duplicateGroup.locator('[data-rule-candidates]'), 'CASE-SKU', true)
  const beforeRuleFailure = await read()
  await page.locator('[data-benefit-save]').click()
  assert.match(await page.locator('[data-benefit-error]').innerText(), /不能重复归属/)
  assert.deepEqual(await read(), beforeRuleFailure)
  await duplicateGroup.getByRole('button', { name: '移除规则组', exact: true }).click()
  const configured = await save(); assert.equal(configured.rulesEnabled, true); assert.equal(configured.groups.length, 1)
  assert.equal(configured.goods.length, beforeRules); assert.equal(configured.groups[0].candidateSkuIds.length, 2)
  await capture('selection-rules')
  await page.reload({ waitUntil: 'networkidle' }); await editor().waitFor()
  assert.equal((await read()).benefitPackages.find(item => item.id === copied.id).groups[0].maxKinds, 2)
  await check('optional-rule-kinds-versus-quantity-candidates-not-selection-cross-group-conflict-refresh')
  await navigate('/skus/case-sku')
  await page.locator('input[data-sku-name], [data-sku-name] input').fill('【独立测试】后来改名的保护壳')
  await page.getByRole('button', { name: '保存 SKU', exact: true }).click(); await page.locator('[data-sku-workbench]').waitFor()
  await navigate(`/benefit-packages/deliveries/${firstDelivery.id}`)
  assert.deepEqual((await read()).benefitDeliveries[0], firstDelivery)
  assert.match(await page.locator('[data-delivery-sku="case-sku"]').innerText(), /【独立测试】case-sku/)
  assert.equal((await page.locator('[data-delivery-sku="case-sku"]').innerText()).includes('后来改名'), false)
  await check('actual-sku-editor-and-package-edits-do-not-rewrite-historical-snapshot')

  const stableData = await read()
  const conditional = await context('conditions-lifecycle', '/benefit-packages/new?device=phone-a', fixture); page = conditional.page
  await editor().waitFor(); await page.getByRole('textbox', { name: '权益包名称', exact: true }).fill('【独立测试】有前提设备包')
  await add('cable-sku'); await add('charger-sku')
  const globalBefore = frozen(await read())
  await editor().getByRole('button', { name: '高级设置 · 选配规则与快充要求', exact: true }).click()
  await checkbox(page.getByRole('checkbox', { name: '本包明确要求快充能力', exact: true }), true)
  for (const id of ['cable-sku', 'charger-sku']) await goods(id).locator('summary').click()
  const confirmCondition = async (id, capability) => {
    const section = page.locator(`[data-benefit-condition="${id}:${capability}"]`)
    await section.locator('textarea').fill('【独立测试】按已列设备和配套条件交付，仍为有条件适用')
    await section.getByRole('button', { name: '确认按此前提交付', exact: true }).click()
    assert.match(await section.innerText(), /已记录当前配置/)
  }
  await confirmCondition('cable-sku', 'basic'); await confirmCondition('charger-sku', 'fast-charge')
  await goods('cable-sku').getByRole('textbox', { name: /每包数量/ }).fill('2')
  assert.equal(await page.locator('[data-benefit-condition="cable-sku:basic"] textarea').count(), 1)
  await confirmCondition('cable-sku', 'basic'); await confirmCondition('charger-sku', 'fast-charge')
  const conditionalSaved = await save(); assert.equal(conditionalSaved.confirmations.length, 2)
  assert.deepEqual(frozen(await read()), globalBefore)
  await preview(1); await confirmDelivery(); await page.locator('[data-benefit-delivery-detail]').waitFor()
  const conditionalSnapshot = (await read()).benefitDeliveries[0]
  assert.equal(conditionalSnapshot.confirmations.length, 2)
  assert.equal(conditionalSnapshot.goods.find(row => row.skuId === 'charger-sku').compatibility.fastChargeStatus, 'conditional')
  await check('basic-fast-charge-separate-local-condition-confirmation-invalidation-and-snapshot')
  await navigate(`/benefit-packages/${conditionalSaved.id}`); await editor().waitFor()
  await page.locator('[data-benefit-add-service]').click()
  const serviceDialog = page.getByRole('dialog', { name: '添加服务权益', exact: true }); await serviceDialog.waitFor()
  await page.keyboard.press('Escape'); await serviceDialog.waitFor({ state: 'hidden' })
  assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute('data-benefit-add-service')), true)
  await page.getByRole('textbox', { name: '权益包名称', exact: true }).fill('【独立测试】未保存离开输入')
  await page.locator('[data-benefit-cancel]').click()
  const leave = page.getByRole('dialog', { name: '保存这次组包编辑？', exact: true }); await leave.waitFor()
  await leave.getByRole('button', { name: '继续编辑', exact: true }).click(); await leave.waitFor({ state: 'hidden' })
  assert.equal(await page.getByRole('textbox', { name: '权益包名称', exact: true }).inputValue(), '【独立测试】未保存离开输入')
  await page.locator('[data-benefit-cancel]').click(); await leave.waitFor()
  await leave.getByRole('button', { name: '保存草稿并离开', exact: true }).click(); await page.locator('[data-benefit-packages]').waitFor()
  assert.equal((await read()).benefitPackages[0].name, '【独立测试】未保存离开输入')
  const beforeDiscard = copy((await read()).benefitPackages)
  await page.getByRole('button',{name:'常用组合更多操作',exact:true}).click(); await page.locator('[data-new-benefit-package]').click(); await editor().waitFor()
  await page.getByRole('textbox', { name: '权益包名称', exact: true }).fill('【独立测试】明确放弃的草稿')
  await page.locator('[data-benefit-cancel]').click(); await leave.waitFor()
  await leave.getByRole('button', { name: '放弃并离开', exact: true }).click(); await page.locator('[data-benefit-packages]').waitFor()
  assert.deepEqual((await read()).benefitPackages, beforeDiscard)
  await check('dialog-escape-focus-and-unsaved-keep-edit-save-draft-leave'); await conditional.ctx.close()

  const free = await context('free-composition', '/benefit-packages', fixture); page = free.page
  await page.getByRole('button', { name: '演示数据', exact: true }).click()
  const demoMenu = page.getByRole('menu').filter({ has: page.getByRole('menuitem', { name: '重置全部演示数据', exact: true }) })
  assert.equal(await demoMenu.getByRole('menuitem', { name: '重置当前模块', exact: true }).count(), 0)
  await page.keyboard.press('Escape')
  await check('new-package-route-does-not-map-current-module-reset-to-system-data')
  await page.getByRole('button',{name:'常用组合更多操作',exact:true}).click(); await page.locator('[data-new-benefit-package]').click(); await editor().waitFor()
  await page.getByRole('textbox', { name: '权益包名称', exact: true }).fill('【独立测试】未报价自由包')
  await add('case-sku'); await add('phone-a'); await service('【独立测试】自由服务', 'per-delivery')
  assert.match(await editor().innerText(), /未做设备适配校验/)
  const freeSaved = await save(); assert.equal(freeSaved.device, null); assert.equal(freeSaved.quote.amountCents, null)
  assert.equal(freeSaved.includedPhoneSkuId, '')
  await preview(2); await confirmDelivery(); await page.locator('[data-benefit-delivery-detail]').waitFor()
  assert.match(await page.locator('[data-delivery-total-quote]').innerText(), /未报价/)
  assert.deepEqual((await read()).benefitDeliveries[0].hostSkuIds, ['phone-a'])
  assert.match(await page.locator('.sheet-facts').innerText(), /PHONE-A/)
  await check('management-entry-free-goods-services-no-device-no-quote-delivery'); await free.ctx.close()

  const readonlyData = copy(stableData); readonlyData.activeRole = 'operator'
  const readonly = await context('readonly', '/benefit-packages', readonlyData); page = readonly.page
  assert.equal(await page.locator('[data-new-benefit-package]').count(), 0); assert.equal(await page.locator('[data-copy-benefit-package]').count(), 0)
  await page.locator(`[data-benefit-package="${saved.id}"]`).getByRole('button', { name: '查看权益包', exact: true }).click(); await editor().waitFor()
  assert.equal(await page.getByRole('textbox', { name: '权益包名称', exact: true }).isDisabled(), true)
  assert.equal(await page.locator('[data-benefit-save]').count(), 0)
  await navigate(`/benefit-packages/deliveries/${firstDelivery.id}`); assert.equal(await page.locator('[data-benefit-export]').isEnabled(), true)
  await check('readonly-can-view-print-export-without-edit-actions'); await readonly.ctx.close()

  const pagedData = copy(fixture)
  pagedData.productListPages.sku.query.pageSize = 1; pagedData.productListPages.sku.query.page = 2; pagedData.productListPages.sku.query.keyword = 'phone'
  const paged = await context('paged-sku-return', '/skus', pagedData); page = paged.page
  await page.locator('[data-sku-id="phone-b"]').waitFor()
  await checkbox(page.getByRole('checkbox', { name: '选择 SKU PHONE-B', exact: true }), true)
  await page.locator('[data-benefit-more="phone-b"]').click()
  const scrollBefore = await page.locator('.sku-table .el-scrollbar__wrap').first().evaluate(element => ({ top: element.scrollTop, left: element.scrollLeft }))
  const pageBefore = await read()
  await page.locator('[data-compose-benefit="phone-b"]').click(); await editor().waitFor()
  await page.locator('[data-benefit-cancel]').click(); await page.locator('[data-sku-id="phone-b"]').waitFor(); await flush()
  assert.equal(await page.locator('.el-pagination .is-active').innerText(), '2')
  assert.equal(await page.getByRole('checkbox', { name: '选择 SKU PHONE-B', exact: true }).isChecked(), true)
  assert.deepEqual(await page.locator('.sku-table .el-scrollbar__wrap').first().evaluate(element => ({ top: element.scrollTop, left: element.scrollLeft })), scrollBefore)
  assert.deepEqual(await read(), pageBefore)
  await check('cancel-restores-second-page-selection-horizontal-scroll-without-persistence'); await paged.ctx.close()

  for (const scenario of [{ name: 'wide', viewport: { width: 1600, height: 1000 } }, { name: 'dark', viewport: { width: 1366, height: 768 }, dark: true }, { name: 'narrow', viewport: { width: 780, height: 900 } }, { name: 'equivalent-125-percent', viewport: { width: 1093, height: 614 }, deviceScaleFactor: 1.25 }]) {
    const visual = await context(scenario.name, `/benefit-packages/${saved.id}`, stableData, { viewport: scenario.viewport, deviceScaleFactor: scenario.deviceScaleFactor || 1 }); page = visual.page
    if (scenario.dark) { await page.evaluate(() => localStorage.setItem('iyge-v2-theme', 'dark')); await page.reload({ waitUntil: 'networkidle' }) }
    await editor().waitFor(); await capture(`editor-${scenario.name}`)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true)
    await page.locator('[data-benefit-save]').scrollIntoViewIfNeeded(); assert.equal(await page.locator('[data-benefit-save]').isVisible(), true)
    await page.locator('[data-benefit-cancel]').click(); await page.locator('[data-benefit-packages]').waitFor()
    await capture(`list-${scenario.name}`); await check(`visual-${scenario.name}`); await visual.ctx.close()
  }
  await main.ctx.close()
  assert.deepEqual(diagnostics, [], 'No browser errors or Vue warnings')
  writeFileSync(resolve(output, 'result.json'), JSON.stringify({ result: 'PASS', browser: browser.version(), checkpoints, diagnostics, screenshots, printVerification: 'window.print invocation recorded as return/cancel; actual print CSS emulated and inspected; native OS dialog not automated' }, null, 2) + '\n')
  console.log(`PASS ${checkpoints.length} benefit browser checkpoints`)
} catch (error) {
  if (page && !page.isClosed()) { await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {}); writeFileSync(resolve(output, 'failure.html'), await page.content()) }
  writeFileSync(resolve(output, 'failure.json'), JSON.stringify({ result: 'FAIL', error: String(error), checkpoints, diagnostics, screenshots }, null, 2) + '\n')
  throw error
} finally { await browser?.close(); await server.close() }
