import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'

const output = resolve(process.env.REFINEMENT_CONCURRENCY_OUTPUT || 'work/compatibility-refinement/concurrency')
mkdirSync(output, { recursive: true })
const server = await createServer({ cacheDir: resolve(output, 'vite-cache'), server: { host: '0.0.0.0', port: 0, open: false, hmr: false, watch: null, allowedHosts: ['catalog-test.invalid'] } })
const checks = [], diagnostics = [], environment = {}
let browser
const copy = value => JSON.parse(JSON.stringify(value))
try {
  const { createTemplateCompatibilityFixture } = await server.ssrLoadModule('/scripts/template-compatibility-fixtures.ts')
  const fixture = createTemplateCompatibilityFixture(), { data, modelId, versionId } = fixture
  data.activeRole = 'admin'
  if (!data.templates.some(item => item.id === modelId)) data.templates.push({ id: modelId, name: '独立双页模板', enabled: true, parentId: null, structureOrder: [] })
  await server.listen()
  const port = server.httpServer.address().port, base = `http://127.0.0.1:${port}`
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true, args: ['--host-resolver-rules=MAP catalog-test.invalid 127.0.0.1', '--no-proxy-server'] })
  environment.browser = browser.version(); environment.node = process.version; environment.origin = base
  const read = page => page.evaluate(() => JSON.parse(localStorage.getItem('iyge-v2-mock-db')))
  const live = page => page.evaluate(async () => JSON.parse(JSON.stringify((await import('/src/stores/catalog.ts')).useCatalogStore().data)))
  const settle = page => page.evaluate(async () => { await (await import('/node_modules/.vite/deps/vue.js')).nextTick(); await (await import('/src/stores/catalog.ts')).useCatalogStore().waitForPersistence() })
  async function pair(name, initial = data, route = '/compatibility', options = {}) {
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
  async function draftSave(page) { return page.evaluate(async id => await (await import('/src/stores/catalog.ts')).useCatalogStore().saveModelDraft(id), modelId) }
  const mark = (name, detail) => { checks.push({ name, result: 'PASS', detail }); console.log(`PASS concurrency ${name}`) }

  {
    const { ctx, a, b } = await pair('template-vs-sync')
    await b.evaluate(async ({ modelId, versionId }) => { window.__syncPreview = (await import('/src/stores/catalog.ts')).useCatalogStore().previewTemplateCompatibilitySync({ modelId, targetVersionId: versionId }) }, { modelId, versionId })
    const changed = await a.evaluate(async modelId => { const s = (await import('/src/stores/catalog.ts')).useCatalogStore(), draft = JSON.parse(JSON.stringify(s.data.templateCompatibilityConfigs.find(item => item.modelId === modelId))); draft.defaultRule.claims[0].note = 'A已更新模板'; return await s.saveTemplateCompatibility(draft, draft.revision) }, modelId); assert(changed.ok)
    const before = await read(a), stale = await b.evaluate(async () => (await import('/src/stores/catalog.ts')).useCatalogStore().applyTemplateCompatibilitySync(window.__syncPreview, {})); assert.equal(stale.ok, false); assert.deepEqual(await read(a), before)
    mark('A-template-B-stale-sync-rejected', { stale }); await ctx.close()
  }
  {
    const { ctx, a, b } = await pair('dataset-replacement')
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
  assert.equal(diagnostics.filter(item => item.type === 'pageerror' || item.message.includes('[Vue warn]')).length, 0, JSON.stringify(diagnostics))
  writeFileSync(resolve(output, 'evidence.json'), JSON.stringify({ result: 'PASS', environment, isolation: 'every case has one new BrowserContext and two real Pages sharing same origin', synchronization: 'ordered commits and captured bases in two pages sharing one origin', checks, diagnostics }, null, 2))
  console.log(`PASS ${checks.length} real same-context dual-page concurrency cases`)
} catch (error) { writeFileSync(resolve(output, 'evidence.json'), JSON.stringify({ result: 'FAIL', error: String(error), environment, checks, diagnostics }, null, 2)); throw error }
finally { await browser?.close(); await server.close() }
