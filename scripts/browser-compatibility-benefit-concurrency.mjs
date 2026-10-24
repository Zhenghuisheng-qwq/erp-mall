import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'

const output = resolve(process.env.REFINEMENT_CONCURRENCY_OUTPUT || 'work/compatibility-benefit-refinement/concurrency')
mkdirSync(output, { recursive: true })
const server = await createServer({ cacheDir: resolve(output, 'vite-cache'), server: { host: '0.0.0.0', port: 0, open: false, hmr: false, watch: null, allowedHosts: ['catalog-test.invalid'] } })
const checks = [], diagnostics = [], environment = {}
let browser, tlsServer
const copy = value => JSON.parse(JSON.stringify(value))
try {
  const { createTemplateCompatibilityFixture } = await server.ssrLoadModule('/scripts/template-compatibility-fixtures.ts')
  const fixture = createTemplateCompatibilityFixture(), { data, modelId, versionId } = fixture
  data.activeRole = 'admin'; data.benefitPackages = []; data.benefitDeliveries = []
  if (!data.templates.some(item => item.id === modelId)) data.templates.push({ id: modelId, name: '独立双页模板', enabled: true, parentId: null, structureOrder: [] })
  await server.listen()
  const port = server.httpServer.address().port, base = `http://127.0.0.1:${port}`
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true, args: ['--host-resolver-rules=MAP catalog-test.invalid 127.0.0.1', '--no-proxy-server'] })
  environment.browser = browser.version(); environment.node = process.version; environment.origin = base
  const read = page => page.evaluate(() => JSON.parse(localStorage.getItem('iyge-v2-mock-db')))
  const live = page => page.evaluate(async () => JSON.parse(JSON.stringify((await import('/src/stores/catalog.ts')).useCatalogStore().data)))
  const settle = page => page.evaluate(async () => { await (await import('/node_modules/.vite/deps/vue.js')).nextTick(); await (await import('/src/stores/catalog.ts')).useCatalogStore().waitForPersistence() })
  async function pair(name, initial = data, route = '/benefit-packages', options = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: 'zh-CN', timezoneId: 'Asia/Singapore' })
    await ctx.addInitScript(({ data, disableLocks }) => {
      if (!localStorage.getItem('iyge-v2-mock-db')) localStorage.setItem('iyge-v2-mock-db', JSON.stringify({ version: 15, data }))
      if (disableLocks) Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined })
      const RealDate = Date, epoch = RealDate.parse('2026-10-23T12:00:00.000Z')
      window.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [epoch])) } static now() { return epoch } }
      window.__writes = []; window.__failNext = false
      const set = Storage.prototype.setItem
      Storage.prototype.setItem = function(key, value) { if (key === 'iyge-v2-mock-db') { if (window.__failNext) { window.__failNext = false; throw new DOMException('双页真实存储失败注入', 'QuotaExceededError') }; window.__writes.push(value) }; return set.call(this, key, value) }
    }, { data: copy(initial), disableLocks: options.disableLocks })
    const a = await ctx.newPage(), b = await ctx.newPage()
    for (const page of [a, b]) {
      page.on('pageerror', error => diagnostics.push({ name, type: 'pageerror', message: String(error) }))
      page.on('console', event => { if (event.type() === 'error' || event.type() === 'warning') diagnostics.push({ name, type: event.type(), message: event.text() }) })
      await page.goto((options.base || base) + route, { waitUntil: 'networkidle' }); await settle(page)
    }
    // Loading B can persist a necessary one-time migration; align both pages once
    // before freezing their common base. Every tested conflict starts after here.
    await a.reload({ waitUntil: 'networkidle' }); await settle(a)
    assert.deepEqual(await live(a), await live(b), `${name}: both pages begin from one exact source`)
    return { ctx, a, b }
  }
  async function save(page, requestId, name = requestId, status = 'draft') {
    return page.evaluate(async ({ requestId, name, status }) => {
      const store = (await import('/src/stores/catalog.ts')).useCatalogStore(), { newBenefitPackageDraft } = await import('/src/domain/benefitPackages.ts')
      const draft = newBenefitPackageDraft(); draft.name = name
      draft.services = [{ id: 'service-one', name: '独立测试服务', quantity: 1, unit: '次', measurement: 'per-package', validity: '30日', description: '仅测试约定' }]
      return await store.saveBenefitPackage({ draft, status, requestId })
    }, { requestId, name, status })
  }
  async function draftSave(page) { return page.evaluate(async id => await (await import('/src/stores/catalog.ts')).useCatalogStore().saveModelDraft(id), modelId) }
  const mark = (name, detail) => { checks.push({ name, result: 'PASS', detail }); console.log(`PASS concurrency ${name}`) }

  {
    const { ctx, a, b } = await pair('package-vs-template')
    const saved = await save(a, 'a-package'); assert(saved.ok)
    const before = await read(a), stale = await draftSave(b)
    assert.equal(stale.ok, false); assert.match(stale.message, /其他页面已更新数据/); assert.deepEqual(await read(a), before)
    await b.locator('[data-catalog-storage-notice]').waitFor(); assert.match(await b.locator('[data-catalog-storage-notice]').innerText(), /其他页面已更新数据/)
    mark('A-package-B-stale-template-rejected', { packageId: saved.id, retained: before.data.benefitPackages.length, stale })
    await ctx.close()
  }
  let withPackage
  {
    const { ctx, a, b } = await pair('delivery-vs-name')
    const saved = await save(a, 'delivery-source', '交付来源包', 'available'); assert(saved.ok)
    await b.reload({ waitUntil: 'networkidle' }); await settle(b)
    const delivered = await a.evaluate(async packageId => { const s = (await import('/src/stores/catalog.ts')).useCatalogStore(), p = s.data.benefitPackages.find(item => item.id === packageId), preview = (await import('/src/domain/benefitPackages.ts')).previewBenefitDelivery(s.data, p, 2); return await s.generateBenefitDelivery({ packageId, expectedRevision: p.revision, requestId: 'delivery-once', packageCount: 2, expectedBasis: preview.basis }) }, saved.id)
    assert(delivered.ok)
    const stale = await b.evaluate(async id => { const s = (await import('/src/stores/catalog.ts')).useCatalogStore(), draft = JSON.parse(JSON.stringify(s.data.benefitPackages.find(p => p.id === id))); draft.name = '旧页改名不得丢历史'; return await s.saveBenefitPackage({ draft, status: 'available', expectedRevision: draft.revision, requestId: 'rename-old' }) }, saved.id)
    assert.equal(stale.ok, false); const persisted = await read(a); assert.equal(persisted.data.benefitDeliveries.length, 1); assert.equal(persisted.data.benefitPackages[0].name, '交付来源包')
    const repeat = await a.evaluate(async packageId => (await import('/src/stores/catalog.ts')).useCatalogStore().generateBenefitDelivery({ packageId, expectedRevision: 1, requestId: 'delivery-once', packageCount: 2, expectedBasis: 'receipt-is-first' }), saved.id)
    assert(repeat.ok); assert.equal(repeat.id, delivered.id); assert.deepEqual(await read(a), persisted)
    withPackage = persisted.data; mark('A-delivery-B-name-rejected-history-and-receipt-preserved', { deliveryId: delivered.id, count: persisted.data.benefitDeliveries.length }); await ctx.close()
  }
  {
    const { ctx, a, b } = await pair('template-vs-sync')
    await b.evaluate(async ({ modelId, versionId }) => { window.__syncPreview = (await import('/src/stores/catalog.ts')).useCatalogStore().previewTemplateCompatibilitySync({ modelId, targetVersionId: versionId }) }, { modelId, versionId })
    const changed = await a.evaluate(async modelId => { const s = (await import('/src/stores/catalog.ts')).useCatalogStore(), draft = JSON.parse(JSON.stringify(s.data.templateCompatibilityConfigs.find(item => item.modelId === modelId))); draft.defaultRule.claims[0].note = 'A已更新模板'; return await s.saveTemplateCompatibility(draft, draft.revision) }, modelId); assert(changed.ok)
    const before = await read(a), stale = await b.evaluate(async () => (await import('/src/stores/catalog.ts')).useCatalogStore().applyTemplateCompatibilitySync(window.__syncPreview, {})); assert.equal(stale.ok, false); assert.deepEqual(await read(a), before)
    mark('A-template-B-stale-sync-rejected', { stale }); await ctx.close()
  }
  {
    const { ctx, a, b } = await pair('controlled-race')
    // Hold the actual origin lock as a deterministic barrier. Both requests must
    // queue before release; Promise.all alone would only be scheduling luck.
    await a.evaluate(async () => { const { CATALOG_LOCK } = await import('/src/stores/catalogPersistence.ts'); window.__held = false; window.__barrier = navigator.locks.request(CATALOG_LOCK, () => new Promise(resolve => { window.__held = true; window.__release = resolve })); })
    await a.waitForFunction(() => window.__held)
    const first = save(a, 'race-a'), second = save(b, 'race-b')
    await a.waitForFunction(async () => (await navigator.locks.query()).pending.length >= 2)
    await a.evaluate(() => window.__release())
    const results = await Promise.all([first, second]); assert.equal(results.filter(result => result.ok).length, 1); assert.equal(results.filter(result => !result.ok).length, 1)
    const stored = await read(a); assert.equal(stored.data.benefitPackages.length, 1); assert.equal(stored.data.benefitPackages[0].code, 'BPK-000001')
    const rejectedPage = results[0].ok ? b : a; await rejectedPage.reload({ waitUntil: 'networkidle' }); await settle(rejectedPage)
    const retried = await save(rejectedPage, results[0].ok ? 'race-b' : 'race-a'); assert(retried.ok); assert.equal(retried.package.code, 'BPK-000002')
    const twice = await save(rejectedPage, results[0].ok ? 'race-b' : 'race-a'); assert.equal(twice.id, retried.id); assert.equal((await read(a)).data.benefitPackages.length, 2)
    mark('real-WebLock-barrier-parallel-numbering-receipt', { results, retry: retried.package.code }); await ctx.close()
  }
  {
    const { ctx, a, b } = await pair('same-record', withPackage)
    const id = withPackage.benefitPackages[0].id
    const change = (page, favorite) => page.evaluate(async ({ id, favorite }) => { const s = (await import('/src/stores/catalog.ts')).useCatalogStore(), p = s.data.benefitPackages.find(item => item.id === id); return await s.setBenefitPackageFavorite(id, favorite, p.revision) }, { id, favorite })
    assert((await change(a, true)).ok); const before = await read(a); assert.equal((await change(b, false)).ok, false); assert.deepEqual(await read(a), before)
    mark('same-record-stale-noop-also-rejected', { favorite: before.data.benefitPackages[0].favorite }); await ctx.close()
  }
  {
    const { ctx, a, b } = await pair('watcher-and-draft', withPackage, '/benefit-packages/new')
    await b.getByRole('textbox', { name: '权益包名称', exact: true }).fill('旧页未保存输入仍需保留')
    const packageResult = await save(a, 'external-while-editing'); assert(packageResult.ok); const before = await read(a)
    await b.evaluate(async () => { const s = (await import('/src/stores/catalog.ts')).useCatalogStore(); s.data.profile.name = '旧内存触发深watch'; await (await import('/node_modules/.vite/deps/vue.js')).nextTick(); await s.waitForPersistence() })
    assert.deepEqual(await read(a), before); assert.equal(await b.getByRole('textbox', { name: '权益包名称', exact: true }).inputValue(), '旧页未保存输入仍需保留')
    await b.locator('[data-catalog-storage-notice]').getByRole('button', { name: '读取最新' }).click()
    await b.getByRole('button', { name: '继续编辑', exact: true }).click(); await b.getByRole('dialog', { name: '读取最新数据', exact: true }).waitFor({ state: 'hidden' }); assert.equal(await b.getByRole('textbox', { name: '权益包名称', exact: true }).inputValue(), '旧页未保存输入仍需保留')
    await b.screenshot({ path: resolve(output, 'conflict-preserves-draft.png') })
    await b.locator('[data-catalog-storage-notice]').getByRole('button', { name: '读取最新' }).click(); await b.getByRole('button', { name: '放弃本页输入并读取', exact: true }).click(); await b.waitForLoadState('networkidle'); await settle(b)
    assert.equal((await live(b)).benefitPackages.length, before.data.benefitPackages.length); assert((await save(b, 'continue-after-latest')).ok)
    mark('stale-deep-watcher-blocked-input-cancel-read-latest-continue', { unrelatedDeliveriesRetained: before.data.benefitDeliveries.length }); await ctx.close()
  }
  {
    const { ctx, a } = await pair('quota-retry')
    const before = await read(a), memory = await live(a); await a.evaluate(() => { window.__failNext = true })
    const failed = await save(a, 'quota-request'); assert.equal(failed.ok, false); assert.deepEqual(await read(a), before); assert.deepEqual(await live(a), memory)
    const retry = await save(a, 'quota-request'); assert(retry.ok); const after = await read(a), repeat = await save(a, 'quota-request'); assert.equal(repeat.id, retry.id); assert.deepEqual(await read(a), after)
    mark('quota-no-half-state-retry-repeat-once', { failed, id: retry.id }); await ctx.close()
  }
  {
    const { ctx, a, b } = await pair('dataset-replacement', withPackage)
    const before = await read(a)
    await a.evaluate(async () => { const s = (await import('/src/stores/catalog.ts')).useCatalogStore(); await s.importJson(s.exportJson()) })
    const imported = await read(a); assert.notEqual(imported.commit.datasetId, before.commit?.datasetId); assert.equal((await draftSave(b)).ok, false); assert.deepEqual(await read(a), imported)
    await b.reload({ waitUntil: 'networkidle' }); await settle(b)
    const restored = await a.evaluate(async () => { const raw = localStorage.getItem('iyge-v2-mock-db'); return await (await import('/src/stores/catalogPersistence.ts')).restoreCatalogData(raw, JSON.parse(raw).data) })
    assert(restored.ok); const recovered = await read(a); assert.notEqual(recovered.commit.datasetId, imported.commit.datasetId)
    assert.equal((await draftSave(b)).ok, false); assert.deepEqual(await read(a), recovered)
    // The restoring page would reload in production, so align both live sessions
    // with that explicitly replaced dataset before exercising the next reset.
    await a.reload({ waitUntil: 'networkidle' }); await settle(a)
    await b.reload({ waitUntil: 'networkidle' }); await settle(b)
    assert((await a.evaluate(async () => (await import('/src/stores/catalog.ts')).useCatalogStore().resetAll())).ok)
    const reset = await read(a); assert.notEqual(reset.commit.datasetId, imported.commit.datasetId); assert.equal(reset.commit.revision, 1); assert.equal((await draftSave(b)).ok, false); assert.deepEqual(await read(a), reset)
    mark('import-restore-reset-new-dataset-even-revision-reused', { imported: imported.commit, restored: recovered.commit, reset: reset.commit }); await ctx.close()
  }
  {
    const { ctx, a, b } = await pair('legacy-brand-feedback', withPackage, '/brands')
    await b.getByRole('button', { name: '新增品牌', exact: true }).click()
    const dialog = b.getByRole('dialog', { name: '新增品牌', exact: true })
    await dialog.locator('input').first().fill('旧页品牌草稿需要保留')
    assert((await save(a, 'external-before-brand')).ok); const before = await read(a)
    await dialog.getByRole('button', { name: '保存', exact: true }).click()
    await b.locator('.el-message--error').waitFor(); assert.equal(await b.locator('.el-message--success').count(), 0)
    assert.equal(await b.getByRole('dialog').locator('input').first().inputValue(), '旧页品牌草稿需要保留')
    assert(await b.getByRole('dialog').isVisible()); assert.deepEqual(await read(a), before)
    mark('legacy-brand-conflict-keeps-dialog-no-false-success', { retainedPackages: before.data.benefitPackages.length }); await ctx.close()
  }
  {
    const { ctx, a, b } = await pair('legacy-account-feedback', withPackage, '/account')
    assert((await save(a, 'external-before-profile')).ok); const before = await read(a)
    await b.locator('.panel input').first().fill('旧页账号输入需要保留')
    await b.getByRole('button', { name: '保存资料', exact: true }).click()
    await b.locator('.el-message--error').waitFor(); assert.equal(await b.locator('.el-message--success').count(), 0)
    assert.equal(await b.locator('.panel input').first().inputValue(), '旧页账号输入需要保留'); assert.deepEqual(await read(a), before)
    mark('legacy-account-conflict-keeps-input-no-false-success', {}); await ctx.close()
  }
  {
    const { ctx, a } = await pair('missing-locks', data, '/benefit-packages', { disableLocks: true })
    const result = await save(a, 'local-without-locks'); assert.equal(result.ok, true)
    const saved = await read(a); assert.equal(saved.data.benefitPackages.length, 1)
    await a.reload({ waitUntil: 'networkidle' }); await settle(a)
    assert.deepEqual((await read(a)).data.benefitPackages, saved.data.benefitPackages)
    assert.equal(await a.locator('[data-catalog-storage-notice]').count(), 0)
    mark('missing-WebLocks-local-save-and-reload', { result }); await ctx.close()
  }
  {
    const { ctx, a } = await pair('untrusted-http', data, '/benefit-packages', { base: `http://catalog-test.invalid:${port}` })
    const capabilities = await a.evaluate(() => ({ secure: isSecureContext, locks: Boolean(navigator.locks) })); assert.equal(capabilities.secure, false)
    const result = await save(a, 'http-local-save'); assert.equal(result.ok, true)
    const saved = await read(a); assert.equal(saved.data.benefitPackages.length, 1)
    await a.reload({ waitUntil: 'networkidle' }); await settle(a)
    assert.deepEqual((await read(a)).data.benefitPackages, saved.data.benefitPackages)
    await a.goto(`http://catalog-test.invalid:${port}/skus`, { waitUntil: 'networkidle' }); await settle(a)
    assert.equal(await a.locator('[data-catalog-storage-notice]').count(), 0)
    assert.equal(await a.getByText(/当前环境无法安全保存共享数据/).count(), 0)
    environment.http = capabilities; mark('ordinary-http-local-save-reload-and-SKU-no-environment-warning', { capabilities, result }); await ctx.close()
  }
  environment.localhost = await (async () => { const ctx = await browser.newContext(), page = await ctx.newPage(); await page.goto(`http://localhost:${port}/benefit-packages`, { waitUntil: 'networkidle' }); const capabilities = await page.evaluate(() => ({ secure: isSecureContext, locks: Boolean(navigator.locks) })); assert(capabilities.secure && capabilities.locks); assert((await save(page, 'localhost-write')).ok); await ctx.close(); return capabilities })()
  if (process.env.REFINEMENT_TLS_PFX) {
    tlsServer = await createServer({ cacheDir: resolve(output, 'tls-vite-cache'), server: { host: '127.0.0.1', port: 0, hmr: false, watch: null, https: { pfx: readFileSync(resolve(process.env.REFINEMENT_TLS_PFX)), passphrase: process.env.REFINEMENT_TLS_PASSPHRASE } } })
    await tlsServer.listen()
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true }), page = await ctx.newPage()
    await page.goto(`https://localhost:${tlsServer.httpServer.address().port}/benefit-packages`, { waitUntil: 'networkidle' })
    const capabilities = await page.evaluate(() => ({ protocol: location.protocol, secure: isSecureContext, locks: Boolean(navigator.locks) }))
    assert.equal(capabilities.protocol, 'https:'); assert(capabilities.secure && capabilities.locks); assert((await save(page, 'real-https-write')).ok)
    environment.https = { ...capabilities, certificate: 'local temporary self-signed PFX; isolated browser context explicitly ignores trust error; real TLS, no browser capability override' }
    mark('real-TLS-https-WebLocks-success', environment.https); await ctx.close()
  } else environment.https = { verified: false, reason: 'Set REFINEMENT_TLS_PFX and optional REFINEMENT_TLS_PASSPHRASE for a real local TLS check.' }
  assert.equal(diagnostics.filter(item => item.type === 'pageerror' || item.message.includes('[Vue warn]')).length, 0, JSON.stringify(diagnostics))
  writeFileSync(resolve(output, 'evidence.json'), JSON.stringify({ result: 'PASS', environment, isolation: 'every case has one new BrowserContext and two real Pages sharing same origin', synchronization: 'real Web Locks with held-lock barrier; no timing-based race assumption', checks, diagnostics }, null, 2))
  console.log(`PASS ${checks.length} real same-context dual-page concurrency cases`)
} catch (error) { writeFileSync(resolve(output, 'evidence.json'), JSON.stringify({ result: 'FAIL', error: String(error), environment, checks, diagnostics }, null, 2)); throw error }
finally { await browser?.close(); await tlsServer?.close(); await server.close() }
