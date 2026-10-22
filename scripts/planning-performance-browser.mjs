import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import { BASELINE, NOW, outputDir, baselineSources } from './planning-performance-fixtures.mjs'

const sources = baselineSources()
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true })
const results = {}
mkdirSync(outputDir, { recursive: true })

try {
  for (const side of ['before', 'after']) {
    const server = await createServer({
      server: { host: '127.0.0.1', port: 0, open: false, watch: null },
      plugins: side === 'before' ? [{
        name: 'pinned-planning-baseline', enforce: 'pre',
        transform(code, id) {
          const match = /\/src\/domain\/(planning|draftComboPreview|logic)\.ts$/.exec(id)
          if (match) return sources[match[1]]
        },
      }] : [],
    })
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await context.addInitScript(({ now }) => {
      const OriginalDate = Date
      globalThis.Date = class extends OriginalDate {
        constructor(...args) { super(...(args.length ? args : [now])) }
        static now() { return OriginalDate.parse(now) }
      }
    }, { now: NOW })
    const page = await context.newPage()
    page.setDefaultTimeout(15000)
    const errors = []
    page.on('pageerror', (error) => errors.push(String(error)))
    try {
      await server.listen()
      const base = `http://127.0.0.1:${server.httpServer.address().port}`
      await page.goto(`${base}/specs?template=t-phone`, { waitUntil: 'networkidle' })
      const read = () => page.evaluate(async () => {
        const { useCatalogStore } = await import('/src/stores/catalog.ts')
        const { DATA_VERSION } = await import('/src/domain/types.ts')
        const data = useCatalogStore().data
        return JSON.parse(JSON.stringify({ version: DATA_VERSION, plans: data.planningRecords,
          versions: data.specModelVersions, families: data.families, skus: data.skus }))
      })
      const open = async () => {
        await page.getByRole('button', { name: '管理合法组合', exact: true }).click()
        const dialog = page.getByRole('dialog', { name: '合法组合管理' })
        await dialog.waitFor()
        return dialog
      }
      const close = async (dialog) => {
        await dialog.locator('.el-dialog__headerbtn').click()
        await dialog.waitFor({ state: 'hidden' })
      }
      const publish = async (count) => {
        await page.getByRole('button', { name: '发布模型', exact: true }).click()
        await page.waitForFunction((count) => document.querySelector('.summary-stats')?.textContent?.includes(`${count} 条已有规划编号`), count)
      }
      const initial = await read()
      const initialDialog = await open()
      const initialTable = await initialDialog.locator('.combo-table .el-table__row').allInnerTexts()
      assert.equal(initialTable.length, 4)
      assert.ok(initialTable.every((text) => text.includes('发布后自动编号')))
      await close(initialDialog)
      assert.deepStrictEqual(await read(), initial, `${side}: preview must not write business records`)
      await publish(4)
      const published = await read()
      const oldPlans = published.plans.filter((record) => record.productModelId === 't-phone')
      assert.deepStrictEqual(oldPlans.map((record) => record.planningId), ['PLN-000001', 'PLN-000002', 'PLN-000003', 'PLN-000004'])
      assert.deepStrictEqual(published.versions, initial.versions, 'initial alignment does not rewrite the seeded published snapshot')

      // Isolated browser data: add a dictionary value and a conditional leaf, then exercise the real page and publish button.
      await page.evaluate(async () => {
        const { useCatalogStore } = await import('/src/stores/catalog.ts')
        const data = useCatalogStore().data
        const black = data.productSpecNodes.find((node) => node.id === 'sn-apple-128-black')
        const dictionary = data.params.find((param) => param.id === black.attributeId)
        if (!dictionary.values.includes('性能测试色')) dictionary.values.push('性能测试色')
        data.productSpecNodes.push({ ...black, id: 'performance-added-color', valueId: '性能测试色', sort: 3 })
        data.specCanvases.find((canvas) => canvas.templateId === 't-phone').status = 'draft'
      })
      await page.getByText(/预计新增 1 条，沿用 4 条/).waitFor()
      const edited = await read()
      const draftDialog = await open()
      const draftRows = await draftDialog.locator('.draft-preview li').allInnerTexts()
      assert.equal(draftRows.length, 5)
      assert.equal(draftRows.filter((text) => text.includes('待发布')).length, 1)
      assert.ok(draftRows.find((text) => text.includes('性能测试色'))?.includes('待发布'))
      const impact = await page.locator('.studio-copy').innerText()
      await close(draftDialog)
      assert.deepStrictEqual(await read(), edited, `${side}: draft preview does not allocate numbers`)
      await publish(5)
      const next = await read()
      const newPlans = next.plans.filter((record) => record.productModelId === 't-phone')
      assert.equal(newPlans.length, 5)
      const added = newPlans.find((record) => record.planningId === 'PLN-000005')
      assert.ok(added.steps.some((step) => step.valueId === '性能测试色'))
      oldPlans.forEach((old) => {
        const kept = newPlans.find((record) => record.planningId === old.planningId)
        assert.equal(kept.identityKey, old.identityKey)
        assert.equal(kept.originModelVersionId, old.originModelVersionId)
        assert.equal(kept.modelVersionIds.length, old.modelVersionIds.length + 1)
      })
      initial.versions.forEach((old) => assert.deepStrictEqual(next.versions.find((version) => version.id === old.id), old))
      assert.deepStrictEqual(next.families, initial.families)
      assert.deepStrictEqual(next.skus, initial.skus)
      const finalDialog = await open()
      const finalTable = await finalDialog.locator('.combo-table .el-table__row').allInnerTexts()
      assert.equal(finalTable.length, 5)
      assert.ok(finalTable.every((text) => text.includes('PLN-')))
      await page.screenshot({ path: resolve(outputDir, `${side}-published.png`), fullPage: true })
      await close(finalDialog)
      await publish(5)
      assert.deepStrictEqual(await read(), next, `${side}: republish is idempotent`)
      await page.reload({ waitUntil: 'networkidle' })
      assert.deepStrictEqual(await read(), next, `${side}: reload preserves snapshot / PLN associations`)
      const persistedVersion = await page.evaluate(() => JSON.parse(localStorage.getItem('iyge-v2-mock-db')).version)
      assert.equal(persistedVersion, initial.version)
      const refreshed = await open()
      assert.deepStrictEqual(await refreshed.locator('.combo-table .el-table__row').allInnerTexts(), finalTable)
      await close(refreshed)
      await page.goto(`${base}/products/new`, { waitUntil: 'networkidle' })
      await page.getByRole('heading', { name: '新增商品', exact: true }).waitFor()
      assert.deepStrictEqual(errors, [])
      results[side] = { initialTable, draftRows, impact, finalTable, initial, next, persistedVersion }
      console.log(`PASS ${side}: preview 4 -> 5; publish/reuse/history/republish/reload; V2 page; no page errors`)
    } finally {
      await context.close()
      await server.close()
    }
  }
  assert.deepStrictEqual(results.after, results.before, 'baseline and optimized UI text / complete business state must be identical')
  writeFileSync(resolve(outputDir, 'browser.json'), JSON.stringify({
    baseline: BASELINE, browser: browser.version(), viewport: '1440x900', fixedTime: NOW,
    cases: ['initial preview', 'publish alignment', 'conditional draft edit', 'preview counts', 'publish new version',
      'PLN reuse and history', 'republish', 'reload', 'V2 new product page', 'before/after UI and full business-state equality'],
    passed: true, results,
  }, null, 2))
  console.log('PASS identical baseline / optimized browser results')
} finally {
  await browser.close()
}
