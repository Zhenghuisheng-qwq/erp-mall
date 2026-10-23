import assert from 'node:assert/strict'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'

const baseline = process.argv.includes('--visual-baseline')
const root = baseline ? resolve(process.env.REFINEMENT_BASELINE_ROOT || 'work/compatibility-benefit-refinement/baseline/source') : process.cwd()
if (!existsSync(resolve(root, 'src/domain/benefitPackages.ts'))) throw new Error(`Required source root is missing: ${root}`)
const output = resolve(process.env.BENEFIT_REFINEMENT_BROWSER_OUTPUT || `work/compatibility-benefit-refinement/benefit-browser-${baseline ? 'before' : 'final'}`)
mkdirSync(output, { recursive: true })
const server = await createServer({ root, cacheDir: resolve(output, 'vite-cache'), server: { host: '127.0.0.1', port: 0, open: false, hmr: false, watch: null } })
const checks = [], diagnostics = [], screenshots = [], copy = value => JSON.parse(JSON.stringify(value))
let browser, page
try {
  const { createBenefitPackageFixture, BENEFIT_TEST_TIME } = await server.ssrLoadModule('/scripts/benefit-package-fixtures.ts')
  const { ensureProductListPages } = await server.ssrLoadModule('/src/domain/productListPages.ts')
  const { data: fixture, draft } = createBenefitPackageFixture()
  ensureProductListPages(fixture)
  fixture.productListPages.sku.activeId = 'sku-system-all'; fixture.productListPages.sku.skuWorkbench.activeId = 'sku-system-all'; fixture.productListPages.sku.skuWorkbench.defaultId = 'sku-system-all'
  fixture.productListPages.sku.query.pageSize = 50
  const visualData = copy(fixture)
  const visualPackage = { ...copy(draft), id: 'refinement-visual-package', code: 'BPK-000001', revision: 1, name: '设备安心配套包', status: 'available', createdAt: BENEFIT_TEST_TIME, updatedAt: BENEFIT_TEST_TIME }
  visualPackage.services = [{ id: 'visual-service', name: '门店贴膜服务', quantity: 1, unit: '次', measurement: 'per-package', validity: '购买后 30 天预约', description: '服务按每包计量，未激活' }, { id: 'visual-delivery-service', name: '本次上门指导', quantity: 1, unit: '次', measurement: 'per-delivery', validity: '', description: '本次交付只安排一次' }]
  visualPackage.quote.amountCents = 12800; visualData.benefitPackages = [visualPackage]
  await server.listen(); const base = `http://127.0.0.1:${server.httpServer.address().port}`
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true }).catch(error => { throw new Error('Installed Chrome or BROWSER_CHANNEL is required; browser checks were not skipped.', { cause: error }) })
  async function context(name, path, data = fixture, options = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: 'zh-CN', timezoneId: 'Asia/Singapore', reducedMotion: 'reduce', ...options })
    await ctx.addInitScript(data => {
      const NativeDate = Date, epoch = NativeDate.parse('2026-10-23T12:00:00.000Z')
      window.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : [epoch])) } static now() { return epoch } }
      if (!localStorage.getItem('iyge-v2-mock-db')) localStorage.setItem('iyge-v2-mock-db', JSON.stringify({ version: 15, data }))
      if (!localStorage.getItem('iyge-v2-theme')) localStorage.setItem('iyge-v2-theme', 'light')
      const setItem = Storage.prototype.setItem; window.__refinementWrites = 0; window.__refinementFailSave = false
      Storage.prototype.setItem = function(key, value) { if (key === 'iyge-v2-mock-db') { if (window.__refinementFailSave) { window.__refinementFailSave = false; throw new DOMException('Isolated failure', 'QuotaExceededError') }; window.__refinementWrites++ }; return setItem.call(this, key, value) }
    }, copy(data))
    page = await ctx.newPage(); page.setDefaultTimeout(15000)
    page.on('pageerror', error => diagnostics.push({ name, type: 'pageerror', message: String(error) }))
    page.on('console', message => { if (['error', 'warning'].includes(message.type())) diagnostics.push({ name, type: message.type(), message: message.text() }) })
    await page.goto(base + path, { waitUntil: 'networkidle' }); return ctx
  }
  const flush = () => page.evaluate(async () => { await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); await (await import('/src/stores/catalog.ts')).useCatalogStore().waitForPersistence?.() })
  const read = () => page.evaluate(async () => JSON.parse(JSON.stringify((await import('/src/stores/catalog.ts')).useCatalogStore().data)))
  const disk = () => page.evaluate(() => localStorage.getItem('iyge-v2-mock-db'))
  const editor = () => page.locator('[data-benefit-editor]')
  const goods = id => page.locator(`[data-benefit-goods="${id}"]`)
  const mark = name => { checks.push({ name, result: 'PASS' }); console.log(`PASS ${name}`) }
  const capture = async name => { await flush(); await page.screenshot({ path: resolve(output, `${name}.png`), animations: 'disabled' }); screenshots.push(`${name}.png`) }
  const navigate = path => page.evaluate(async path => (await import('/src/router/index.ts')).default.push(path), path)
  async function add(id) { await page.locator(`[data-benefit-add-sku="${id}"]`).click(); await goods(id).waitFor() }
  async function checkbox(locator) { await locator.locator('..').click(); assert.equal(await locator.isChecked(), true) }
  async function openService(name) { await editor().getByRole('button', { name: '添加服务权益', exact: true }).first().click(); const dialog = page.getByRole('dialog', { name: '添加服务权益', exact: true }); await dialog.waitFor(); if (name) await dialog.getByRole('textbox', { name: '服务名称', exact: true }).fill(name); return dialog }

  if (!baseline) {
    const chain = await context('full-spu-return-chain', '/skus?spu=family-device')
    await page.locator('[data-sku-workbench]').waitFor()
    await page.getByRole('textbox', { name: '在当前视图中搜索' }).fill('phone')
    await checkbox(page.getByRole('checkbox', { name: '选择 SKU PHONE-A', exact: true }))
    const skuBefore = await read()
    await page.locator('[data-benefit-more="phone-a"]').click(); await page.locator('[data-compose-benefit="phone-a"]').click(); await editor().waitFor()
    assert.equal(new URL(page.url()).searchParams.get('returnTo'), '/skus?spu=family-device')
    assert.equal(await page.locator('[data-benefit-goods]').count(), 0, 'device context does not include a phone')
    await page.getByRole('textbox', { name: '权益包名称', exact: true }).fill('【隔离验证】完整返回链权益包')
    await add('case-sku'); await add('case-sku')
    assert.match(await page.locator('[data-benefit-summary]').innerText(), /1 种商品 · 2 件 \/ 包/)
    assert.match(await page.locator('[data-benefit-add-sku="case-sku"]').innerText(), /已加入/)
    const service = await openService('【隔离验证】每包贴膜'); await service.locator('[data-benefit-save-service]').click(); await service.waitFor({ state: 'hidden' })
    await page.getByRole('textbox', { name: '每包报价（元）', exact: true }).fill('0')
    const beforeFailure = await disk(); await page.evaluate(() => { window.__refinementFailSave = true })
    await page.locator('[data-benefit-save-preview]').click(); await page.locator('[data-benefit-error]').waitFor()
    assert.equal(await disk(), beforeFailure); assert.equal(await page.locator('[data-benefit-delivery-preview]').count(), 0)
    assert.equal(await page.getByRole('textbox', { name: '权益包名称', exact: true }).inputValue(), '【隔离验证】完整返回链权益包')
    await page.locator('[data-benefit-save-preview]').click(); await page.locator('[data-benefit-delivery-preview]').waitFor()
    const savedData = await read(), saved = savedData.benefitPackages[0]
    assert.equal(savedData.benefitDeliveries.length, 0); assert.equal(saved.goods[0].quantity, 2); assert.equal(saved.services.length, 1); assert.equal(saved.quote.amountCents, 0)
    assert.equal(await page.locator('[data-benefit-confirm-delivery]').isDisabled(), true, 'fresh independent final confirmation required')
    assert.equal(saved.goods.some(line => line.skuId === 'phone-a'), false)
    await page.getByRole('textbox', { name: '本次包数', exact: true }).fill('3'); assert.equal(await page.locator('[data-benefit-delivery-preview]').count(), 0)
    await page.locator('[data-benefit-preview-delivery]').click(); await page.locator('[data-benefit-delivery-preview]').waitFor()
    await checkbox(page.getByRole('checkbox', { name: /我已核对本次完整组成/ })); await page.locator('[data-benefit-confirm-delivery]').click(); await page.locator('[data-benefit-delivery-detail]').waitFor()
    const delivery = (await read()).benefitDeliveries[0]
    assert.equal(delivery.goods[0].totalQuantity, 6); assert.equal(delivery.services[0].totalQuantity, 3); assert.equal(delivery.quote.totalCents, 0)
    await page.getByRole('button', { name: '查看当前包配置', exact: true }).click(); await editor().waitFor()
    assert.equal(new URL(page.url()).searchParams.get('returnTo'), '/skus?spu=family-device')
    await page.getByRole('button', { name: '返回原页面', exact: true }).click(); await page.locator('[data-sku-workbench]').waitFor()
    assert.equal(new URL(page.url()).pathname + new URL(page.url()).search, '/skus?spu=family-device')
    assert.equal(await page.getByRole('textbox', { name: '在当前视图中搜索' }).inputValue(), 'phone')
    assert.equal(await page.getByRole('checkbox', { name: '选择 SKU PHONE-A', exact: true }).isChecked(), true)
    assert.equal(await page.evaluate(() => document.activeElement?.closest('[data-benefit-more]')?.getAttribute('data-benefit-more')), 'phone-a')
    assert.deepEqual((await read()).productListPages, skuBefore.productListPages)
    assert.deepEqual((await read()).benefitDeliveries[0], delivery)
    mark('spu-scoped-sku-save-preview-retry-explicit-generation-delivery-package-source-selection-focus-roundtrip'); await chain.close()

    const serviceContext = await context('uncommitted-service-draft', '/benefit-packages/new')
    await page.getByRole('textbox', { name: '权益包名称', exact: true }).fill('【隔离验证】服务防丢')
    await add('case-sku'); await page.locator('[data-benefit-save-draft]').click(); await page.waitForURL(/\/benefit-packages\/(?!new)[^/?]+$/)
    const originalPackage = copy((await read()).benefitPackages[0])
    let dialog = await openService('【隔离验证】未提交服务')
    assert.equal(await page.evaluate(() => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented }), true)
    await page.keyboard.press('Escape'); const leave = page.locator('[data-benefit-leave]'); await leave.waitFor()
    assert.equal(await page.locator('[data-benefit-leave]:visible').count(), 1)
    await leave.getByRole('button', { name: '继续编辑', exact: true }).click(); await leave.waitFor({ state: 'hidden' })
    assert.equal(await dialog.getByRole('textbox', { name: '服务名称', exact: true }).inputValue(), '【隔离验证】未提交服务')
    await page.evaluate(() => { import('/src/router/index.ts').then(({ default: router }) => { window.__refinementNav = router.push('/benefit-packages') }) }); await leave.waitFor()
    await leave.getByRole('button', { name: '保存草稿并离开', exact: true }).click(); await page.locator('[data-benefit-packages]').waitFor()
    let packageNow = (await read()).benefitPackages[0]; assert.equal(packageNow.services.length, 1); assert.equal(packageNow.services[0].name, '【隔离验证】未提交服务'); assert.equal(packageNow.revision, originalPackage.revision + 1)
    await navigate(`/benefit-packages/${packageNow.id}`); await editor().waitFor()
    dialog = await openService('【隔离验证】不完整服务'); await dialog.getByRole('textbox', { name: '服务数量', exact: true }).fill('')
    await page.evaluate(() => { import('/src/router/index.ts').then(({ default: router }) => { window.__refinementNav = router.push('/benefit-packages') }) }); await leave.waitFor()
    await leave.getByRole('button', { name: '保存草稿并离开', exact: true }).click(); await leave.waitFor({ state: 'hidden' })
    assert.equal(await dialog.isVisible(), true); assert.equal(await dialog.getByRole('textbox', { name: '服务数量', exact: true }).inputValue(), '')
    assert.deepEqual((await read()).benefitPackages[0], packageNow)
    await dialog.getByRole('button', { name: '取消', exact: true }).click(); await leave.waitFor(); await leave.getByRole('button', { name: '放弃服务输入', exact: true }).click(); await dialog.waitFor({ state: 'hidden' })
    await page.getByRole('textbox', { name: '权益包名称', exact: true }).fill('【隔离验证】快速导航保留')
    await page.evaluate(() => { import('/src/router/index.ts').then(({ default: router }) => { window.__refinementNav1 = router.push('/benefit-packages') }) }); await leave.waitFor()
    await page.evaluate(() => { import('/src/router/index.ts').then(({ default: router }) => { window.__refinementNav2 = router.push('/skus') }) }); await flush()
    await leave.getByRole('button', { name: '继续编辑', exact: true }).click()
    assert.equal(await page.evaluate(async () => Promise.race([Promise.all([window.__refinementNav1, window.__refinementNav2]).then(() => true), new Promise(resolve => setTimeout(() => resolve(false), 1500))])), true)
    assert.match(await page.getByRole('textbox', { name: '权益包名称', exact: true }).inputValue(), /快速导航保留/)
    mark('service-local-draft-escape-beforeunload-route-save-includes-service-invalid-remains-and-fast-navigation-resolves'); await serviceContext.close()

    const ruleContext = await context('disabled-rule-structure', '/benefit-packages/new?device=phone-a')
    await page.getByRole('textbox', { name: '权益包名称', exact: true }).fill('【隔离验证】停用规则')
    await add('case-sku'); await page.getByText('高级设置 · 选配规则与快充要求', { exact: true }).click()
    await page.getByRole('switch', { name: '启用选配规则', exact: true }).locator('..').click(); await page.locator('[data-add-benefit-rule]').click()
    await page.getByRole('textbox', { name: '最多选择种数', exact: true }).fill('0'); await page.getByRole('switch', { name: '启用选配规则', exact: true }).locator('..').click()
    await page.getByText('高级设置 · 选配规则与快充要求', { exact: true }).click()
    const ruleDisk = await disk(); await page.locator('[data-benefit-save-draft]').click(); await page.locator('[data-benefit-error]').waitFor()
    assert.equal(await disk(), ruleDisk); const invalidInput = page.getByRole('textbox', { name: '最多选择种数', exact: true }); assert.equal(await invalidInput.isVisible(), true); assert.equal(await invalidInput.inputValue(), '0')
    assert.equal(await invalidInput.evaluate(element => document.activeElement === element), true)
    for (const value of ['', 'abc', 'NaN', 'Infinity', '1.5', '-1', '9007199254740992', '0x10']) {
      await invalidInput.fill(value); await page.locator('[data-benefit-save-draft]').click()
      assert.equal(await invalidInput.inputValue(), value, `invalid raw input is retained: ${value}`); assert.equal(await disk(), ruleDisk)
    }
    await invalidInput.fill('1'); await page.locator('[data-benefit-save-draft]').click(); await page.waitForURL(/\/benefit-packages\/(?!new)[^/?]+/)
    const ruleSaved = copy((await read()).benefitPackages[0]); assert.equal(ruleSaved.rulesEnabled, false); assert.equal(ruleSaved.groups[0].maxKinds, 1)
    await page.reload({ waitUntil: 'networkidle' }); await editor().waitFor(); assert.deepEqual((await read()).benefitPackages[0], ruleSaved)
    mark('disabled-invalid-rule-save-rejected-reveals-exact-field-with-input-retained-fix-save-refresh-safe'); await ruleContext.close()

    const conditionContext = await context('condition-and-maintenance-return', '/benefit-packages/new?device=phone-a')
    await page.getByRole('textbox', { name: '权益包名称', exact: true }).fill('【隔离验证】条件维护返回')
    await add('cable-sku'); const section = page.locator('[data-benefit-condition="cable-sku:basic"]')
    assert.equal(await section.locator('textarea').isVisible(), true)
    assert.equal(await goods('cable-sku').locator('details').getAttribute('open'), null)
    const declarations = copy((await read()).compatibilities)
    await section.locator('textarea').fill('【隔离验证】按已列设备及线缆条件交付'); await section.locator('[data-benefit-confirm-condition]').click()
    assert.match(await section.innerText(), /已记录/); await goods('cable-sku').getByRole('textbox', { name: /每包数量/ }).fill('2'); assert.equal(await section.locator('textarea').isVisible(), true)
    await page.getByRole('textbox', { name: '搜索组包商品', exact: true }).fill('case')
    const draftDisk = await disk(); await page.getByRole('button', { name: '管理适用关系', exact: true }).click(); await page.waitForURL(/\/compatibility\?/)
    assert.equal(await disk(), draftDisk)
    await page.locator('[data-compatibility-return]').click(); await editor().waitFor()
    assert.equal(await page.getByRole('textbox', { name: '权益包名称', exact: true }).inputValue(), '【隔离验证】条件维护返回')
    assert.equal(await page.getByRole('textbox', { name: '搜索组包商品', exact: true }).inputValue(), 'case'); assert.equal(await goods('cable-sku').getByRole('textbox', { name: /每包数量/ }).inputValue(), '2')
    assert.deepEqual((await read()).compatibilities, declarations); assert.equal(await disk(), draftDisk)
    mark('conditional-input-visible-confirmation-is-local-invalidates-and-maintenance-return-restores-unsaved-draft-search'); await conditionContext.close()

    const busyContext = await context('held-lock-editor-protection', '/benefit-packages/new')
    await page.getByRole('textbox', { name: '权益包名称', exact: true }).fill('【隔离验证】等锁输入保护'); await add('case-sku')
    let heldDialog = await openService('【隔离验证】保留服务'); await heldDialog.locator('[data-benefit-save-service]').click(); await heldDialog.waitFor({ state: 'hidden' })
    await page.evaluate(() => { window.__heldLock = navigator.locks.request('iyge-v2-mock-db:commit', () => new Promise(resolve => { window.__releaseHeldLock = resolve; window.__heldLockReady = true })) })
    await page.waitForFunction(() => window.__heldLockReady)
    const heldDisk = await disk(); await page.locator('[data-benefit-save-draft]').click()
    await page.waitForFunction(async () => (await import('/src/stores/catalog.ts')).useCatalogStore().persistenceState.pending > 0)
    assert.equal(await page.getByRole('textbox', { name: '权益包名称', exact: true }).isDisabled(), true)
    assert.equal(await goods('case-sku').getByRole('button', { name: /移除 CASE-SKU/ }).isDisabled(), true)
    assert.equal(await editor().getByRole('button', { name: '添加服务权益', exact: true }).first().isDisabled(), true)
    assert.equal(await editor().getByRole('button', { name: '编辑服务', exact: true }).isDisabled(), true)
    assert.equal(await editor().getByRole('button', { name: '移除服务', exact: true }).isDisabled(), true)
    assert.equal(await page.getByRole('textbox', { name: /每包数量 CASE-SKU/ }).isDisabled(), true)
    await navigate('/skus'); assert.equal(new URL(page.url()).pathname, '/benefit-packages/new'); assert.equal(await disk(), heldDisk)
    await page.evaluate(() => window.__releaseHeldLock()); await page.waitForURL(/\/benefit-packages\/(?!new)[^/?]+$/)
    const heldSaved = (await read()).benefitPackages[0]; assert.equal(heldSaved.goods[0].skuId, 'case-sku'); assert.equal(heldSaved.services[0].name, '【隔离验证】保留服务'); assert.equal(heldSaved.revision, 1)
    assert.equal(await page.evaluate(() => window.__refinementWrites), 1)
    mark('held-real-web-lock-prevents-edits-service-removal-and-navigation-until-one-complete-save'); await busyContext.close()

    const modelContext = await context('model-context-is-not-sku', '/benefit-packages/new')
    await page.locator('[data-benefit-device]').click()
    await page.locator('.el-select-dropdown:visible [role=option]').filter({ hasText: 'Orion A' }).filter({ hasText: '独立型号' }).first().click()
    assert.equal(await page.locator('[data-benefit-include-phone]').count(), 0)
    assert.match(await editor().innerText(), /仅选型号，不加入手机商品/)
    await page.getByRole('textbox', { name: '权益包名称', exact: true }).fill('【隔离验证】仅型号上下文'); await add('case-sku'); await add('cable-sku')
    const modelDisk = await disk(); await page.getByRole('button', { name: '管理适用关系', exact: true }).click(); await page.waitForURL(/\/compatibility\?/)
    const modelQuery = new URL(page.url()).searchParams
    assert.ok(modelQuery.get('deviceModel')); assert.equal(modelQuery.has('device'), false)
    assert.equal(JSON.parse(modelQuery.get('deviceModel'))[1].startsWith('device:'), true)
    assert.equal(await page.getByRole('dialog', { name: '配置设备型号', exact: true }).count(), 0)
    await page.locator('[data-compatibility-return]').click(); await editor().waitFor()
    assert.match(await editor().innerText(), /仅选型号，不加入手机商品/); assert.equal(await page.locator('[data-benefit-goods]').count(), 2); assert.equal(await disk(), modelDisk)
    mark('model-only-maintenance-carries-explicit-host-key-without-inventing-device-sku-or-including-phone'); await modelContext.close()

    const safeReturnContext = await context('safe-return-fallback', '/benefit-packages/new?returnTo=%2F%2Fevil.example')
    await page.getByRole('button', { name: '返回原页面', exact: true }).click(); await page.locator('[data-benefit-packages]').waitFor(); assert.equal(new URL(page.url()).pathname, '/benefit-packages')
    await navigate('/benefit-packages/new?returnTo=%2Fnot-a-known-route'); await editor().waitFor()
    await page.getByRole('button', { name: '返回原页面', exact: true }).click(); await page.locator('[data-benefit-packages]').waitFor(); assert.equal(new URL(page.url()).pathname, '/benefit-packages')
    mark('external-and-unrecognized-return-addresses-have-explicit-local-fallback'); await safeReturnContext.close()


  }

  for (const scenario of [
    { name: '1366-light', width: 1366, height: 768 }, { name: '1366-dark', width: 1366, height: 768, dark: true },
    { name: '1920-light', width: 1920, height: 1080 }, { name: '1920-dark', width: 1920, height: 1080, dark: true },
    { name: 'narrow-desktop', width: 980, height: 820 }, { name: '375-light', width: 375, height: 812 }, { name: '375-dark', width: 375, height: 812, dark: true },
    { name: '125-percent', width: 1093, height: 614, scale: 1.25 },
  ]) {
    const visual = await context(scenario.name, `/benefit-packages/${visualPackage.id}`, visualData, { viewport: { width: scenario.width, height: scenario.height }, deviceScaleFactor: scenario.scale || 1 })
    if (scenario.dark) { await page.evaluate(() => localStorage.setItem('iyge-v2-theme', 'dark')); await page.reload({ waitUntil: 'networkidle' }) }
    await editor().waitFor()
    if (!baseline && scenario.width <= 700) {
      assert.equal(await page.locator('.rail-wrap').getAttribute('data-mode'), 'icons')
      assert.ok(await editor().evaluate(element => element.getBoundingClientRect().width >= 260), 'narrow editor retains usable width')
      const navPreference = await page.evaluate(() => JSON.parse(localStorage.getItem('iyge-nav-layout')))
      assert.equal(navPreference.collapsed, false, 'temporary compact does not overwrite user preference')
      await page.locator('[data-nav-fold]').click(); await page.locator('#nav-flyout').waitFor(); await page.keyboard.press('Escape'); await page.locator('#nav-flyout').waitFor({ state: 'hidden' })
      await page.setViewportSize({ width: 1366, height: 768 }); await page.locator('.rail-wrap[data-mode=single]').waitFor(); assert.equal(await page.locator('.rail-wrap').getAttribute('data-mode'), 'single')
      await page.setViewportSize({ width: scenario.width, height: scenario.height }); await page.locator('.rail-wrap[data-mode=icons]').waitFor(); await flush()
      assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('iyge-nav-layout')))).collapsed, false)
    }
    await capture(`editor-${scenario.name}`)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `page fits ${scenario.name}`)
    if (!baseline && scenario.width < 951) { await page.getByRole('radio', { name: /包内清单/ }).locator('..').click(); await goods('case-sku').waitFor(); await capture(`contents-${scenario.name}`) }
    if (!baseline) { const primary = page.locator('[data-benefit-save-preview]'); await primary.scrollIntoViewIfNeeded(); assert.equal(await primary.isVisible(), true); assert.equal(await primary.evaluate(element => { const rect = element.getBoundingClientRect(); return rect.bottom <= innerHeight && rect.top >= 0 }), true) }
    await openService('服务输入示例'); await capture(`service-${scenario.name}`)
    const footer = page.getByRole('dialog', { name: '添加服务权益', exact: true }).locator('[data-benefit-save-service]')
    assert.equal(await footer.evaluate(element => { const rect = element.getBoundingClientRect(); return rect.bottom <= innerHeight && rect.top >= 0 }), true, `service action is accessible ${scenario.name}`)
    mark(`visual-${scenario.name}`); await visual.close()
  }
  assert.deepEqual(diagnostics, [], 'No new browser errors or Vue warnings')
  writeFileSync(resolve(output, 'result.json'), JSON.stringify({ result: 'PASS', scope: baseline ? 'original source visual baseline only' : 'new functional and visual checks', sourceRoot: root, browser: browser.version(), checks, diagnostics, screenshots }, null, 2) + '\n')
} catch (error) {
  if (page && !page.isClosed()) { await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {}); writeFileSync(resolve(output, 'failure.html'), await page.content()) }
  writeFileSync(resolve(output, 'failure.json'), JSON.stringify({ result: 'FAIL', error: String(error), checks, diagnostics, screenshots }, null, 2) + '\n'); throw error
} finally { await browser?.close(); await server.close() }
