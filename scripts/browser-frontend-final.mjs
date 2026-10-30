import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import { clickOption, waitUiSettled } from './browser-ui.mjs'

// Fresh contexts only. No historical snapshot is required for this current-code gate.
const output = resolve(process.env.FINAL_OUTPUT_DIR || 'work/refactor-final/integration')
mkdirSync(output, { recursive: true })
const root = resolve(process.env.FINAL_SOURCE_ROOT || '.')
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0, open: false, watch: null } })
let browser
const diagnostics = [], states = [], listChecks = []
try {
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true }).catch(error => {
    throw new Error('Browser unavailable. Install Chrome or set BROWSER_CHANNEL to an installed Playwright channel (for example msedge). playwright-core comes from npm ci; no personal package path is used.', { cause: error })
  })
  await server.listen()
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  if (!process.argv.includes('--business-only')) {
    for (const name of ['4a', '4b', '4c', '4d', '4e']) {
      const entry = `scripts/browser-${name}.mjs`
      let log = ''
      const exit = await new Promise((accept, reject) => {
        const child = spawn(process.execPath, [entry], { env: { ...process.env, SMOKE_URL: base }, stdio: ['ignore', 'pipe', 'pipe'] })
        child.stdout.on('data', chunk => { log += chunk })
        child.stderr.on('data', chunk => { log += chunk })
        child.on('error', reject)
        child.on('close', accept)
      })
      writeFileSync(resolve(output, `${name}.log`), log)
      assert.equal(exit, 0, `${entry} failed; see ${resolve(output, `${name}.log`)}`)
      listChecks.push({ entry, exit })
      console.log(`PASS ${entry}`)
    }
  }
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: 'zh-CN', timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' })
  await context.addInitScript(() => {
    const RealDate = Date
    window.__testTime = Number(sessionStorage.getItem('final-check-time')) || RealDate.parse('2026-10-22T04:00:00Z')
    window.Date = class extends RealDate {
      constructor(...args) { super(...(args.length ? args : [window.__testTime])) }
      static now() { return window.__testTime }
    }
    window.__writes = []
    const setItem = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'iyge-v2-mock-db') window.__writes.push(value)
      return setItem.call(this, key, value)
    }
    if (!localStorage.getItem('iyge-spec-cat-fold')) localStorage.setItem('iyge-spec-cat-fold', '0')
    if (!localStorage.getItem('iyge-spec-rail-fold')) localStorage.setItem('iyge-spec-rail-fold', '0')
  })
  const page = await context.newPage()
  page.setDefaultTimeout(15000)
  page.on('pageerror', error => diagnostics.push({ type: 'pageerror', message: String(error) }))
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) diagnostics.push({ type: message.type(), message: message.text() }) })
  const dialog = name => page.getByRole('dialog', { name, exact: true })
  const combo = () => dialog('合法组合管理')
  const node = id => page.locator(`.vue-flow__node[data-id="${id}"]`)
  const read = () => page.evaluate(async () => JSON.parse(JSON.stringify((await import('/src/stores/catalog.ts')).useCatalogStore().data)))
  // Let Vue's microtasks and the following render complete without assuming that
  // node_modules is physically inside the selected source snapshot.
  async function flush() { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))) }
  async function clearWrites() { await flush(); await page.evaluate(() => { window.__writes = [] }) }
  async function record(name, expectedWrites) {
    await flush()
    const data = await read()
    const writes = await page.evaluate(() => window.__writes)
    if (expectedWrites !== undefined) assert.equal(writes.length, expectedWrites, `${name}: business persistence count`)
    states.push({ name, data, writes })
    await page.evaluate(() => { window.__writes = []; window.__testTime += 1000; sessionStorage.setItem('final-check-time', String(window.__testTime)) })
    console.log(`PASS integration ${name}`)
  }
  async function close(box) {
    await box.locator('.el-dialog__headerbtn').click()
    await box.waitFor({ state: 'hidden' })
    await waitUiSettled(page)
  }
  async function openCombos() {
    await page.getByRole('button', { name: '管理合法组合', exact: true }).click()
    await combo().waitFor()
  }
  async function navigate(path) {
    // Use the real router so leaving the designer exercises unmount/cleanup.
    await page.evaluate(async path => (await import('/src/router/index.ts')).default.push(path), path)
    await page.waitForURL(`${base}${path}`)
  }
  async function createMaterial(supplier) {
    const before = await read()
    await combo().getByRole('button', { name: '单条创建', exact: true }).first().click()
    const box = dialog('创建物料')
    await box.locator('label').filter({ hasText: '供应商编码' }).locator('input').fill(supplier)
    await clearWrites()
    await box.getByRole('button', { name: '确认创建', exact: true }).click()
    await box.waitFor({ state: 'hidden' })
    await record(`create-${supplier}`, 1)
    const after = await read()
    assert.equal(after.skus.length, before.skus.length + 1)
    assert.equal(after.materialReceipts.length, before.materialReceipts.length + 1)
    assert.deepEqual(after.skus.filter(item => before.skus.some(old => old.id === item.id)), before.skus, 'Existing materials and order stay intact')
    return after.skus.find(item => item.supplierCode === supplier)
  }

  await page.goto(`${base}/specs?template=t-phone`, { waitUntil: 'networkidle' })
  await node('sn-brand').waitFor()
  await clearWrites()
  const initial = await read()
  for (let i = 0; i < 3; i++) {
    await openCombos()
    await combo().getByRole('button', { name: '全选', exact: true }).click()
    await close(combo())
  }
  assert.deepEqual(await read(), initial, 'Repeated preview must not change data or allocate PLN')
  await record('preview-repeat-no-write', 0)
  await page.getByRole('button', { name: '发布模型', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.summary-stats')?.textContent.includes('4 条已有规划编号'))
  await record('publish-initial', 1)
  const published = await read()
  assert.deepEqual(published.specModelVersions, initial.specModelVersions)
  const plans = published.planningRecords.filter(item => item.productModelId === 't-phone')
  assert.deepEqual(plans.map(item => item.planningId), ['PLN-000001', 'PLN-000002', 'PLN-000003', 'PLN-000004'])
  await openCombos()
  const materialA = await createMaterial('FINAL-A')
  const materialB = await createMaterial('FINAL-B')
  assert.equal(materialA.planningId, materialB.planningId)
  assert.notEqual(materialA.materialCode, materialB.materialCode)
  await close(combo())
  const beforeChange = await read()
  // Independent fixture setup only: one extra conditional leaf. Publish is the real UI command.
  await page.evaluate(async () => {
    const data = (await import('/src/stores/catalog.ts')).useCatalogStore().data
    const source = data.productSpecNodes.find(item => item.id === 'sn-apple-128-black')
    data.params.find(item => item.id === source.attributeId).values.push('收口测试色')
    data.productSpecNodes.push({ ...source, id: 'final-new-color', valueId: '收口测试色', sort: 9 })
  })
  await page.getByText(/预计新增 1 条，沿用 4 条/).waitFor()
  await clearWrites()
  const draft = await read()
  await openCombos()
  await close(combo())
  assert.deepEqual(await read(), draft)
  await record('mixed-draft-preview-no-write', 0)
  await page.getByRole('button', { name: '发布模型', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.summary-stats')?.textContent.includes('5 条已有规划编号'))
  await record('publish-reuse-and-new', 1)
  const next = await read()
  const versions = next.specModelVersions.filter(item => item.templateId === 't-phone')
  assert.equal(next.specModelVersions.length, beforeChange.specModelVersions.length + 1)
  assert.deepEqual(next.specModelVersions.filter(item => beforeChange.specModelVersions.some(old => old.id === item.id)), beforeChange.specModelVersions)
  assert.deepEqual(next.skus, beforeChange.skus)
  const newPlans = next.planningRecords.filter(item => item.productModelId === 't-phone')
  assert.equal(newPlans.length, 5)
  for (const old of plans) {
    const current = newPlans.find(item => item.planningId === old.planningId)
    assert.equal(current.identityKey, old.identityKey)
    assert.deepEqual(current.modelVersionIds, [...old.modelVersionIds, versions.at(-1).id])
  }
  assert.equal(newPlans.at(-1).planningId, 'PLN-000005')
  await openCombos()
  const materialC = await createMaterial('FINAL-C')
  assert.equal(materialC.modelVersionId, versions.at(-1).id)
  assert.equal(materialC.planningId, materialA.planningId)
  await close(combo())

  await openCombos()
  await combo().getByRole('button', { name: '全选', exact: true }).click()
  await combo().getByPlaceholder('搜索规格路径、规划编号、物料名称或编号').fill('128G')
  await close(combo())
  await page.locator('.cat [data-category-id="c-case"]').click()
  await page.locator('.rail .model-line').first().click()
  await page.waitForURL('**/specs?template=t-case-model')
  await openCombos()
  assert.equal(await combo().getByPlaceholder('搜索规格路径、规划编号、物料名称或编号').inputValue(), '')
  assert.equal(await combo().getByRole('button', { name: '标为核心商品', exact: true }).isDisabled(), true)
  await close(combo())
  await record('model-switch-clears-combo-state')

  await navigate('/spus')
  await page.locator('.list-switch').waitFor()
  const search = page.getByPlaceholder('名称、分类、属性、SKU、OA 编号')
  // V3 material archives belong to an SPU; isRealSku deliberately excludes them.
  await search.fill(materialA.skuName)
  async function expectMaterialsInList() {
    const row = page.locator('.spu-table .el-table__row').filter({ has: page.locator(`button[data-family-id="${materialA.familyId}"]`) })
    await row.waitFor()
    assert.match(await row.innerText(), /已建物料 3 条 · 已关联规划 1 条/)
    assert.equal(await row.locator('[data-sku-count]').getAttribute('data-sku-count'), '0')
    return row
  }
  await expectMaterialsInList()
  await page.getByRole('button', { name: 'SKU 管理', exact: true }).click()
  await page.waitForURL(`${base}/skus`)
  await page.locator('[data-sku-workbench]').waitFor()
  await search.fill(materialA.skuName)
  await page.locator('[data-empty="sku"]').waitFor()
  for (const item of [materialA, materialB, materialC]) assert.equal(await page.locator(`[data-sku-id="${item.id}"]`).count(), 0)
  await page.getByRole('button', { name: 'SPU 管理', exact: true }).click()
  await expectMaterialsInList()
  await record('created-materials-visible-in-list')
  const beforeReload = await read()
  await page.reload({ waitUntil: 'networkidle' })
  await expectMaterialsInList()
  assert.deepEqual(await read(), beforeReload, 'Refresh restores full ordered data and list query')
  await record('list-refresh-restores-data')
  const familyRow = await expectMaterialsInList()
  await familyRow.getByRole('button', { name: '管理物料', exact: true }).click()
  await page.waitForURL(`${base}/materials/${materialA.familyId}`)
  for (const item of [materialA, materialB, materialC]) {
    const card = page.locator('.materials li').filter({ hasText: item.materialCode })
    await card.waitFor()
    assert.ok((await card.innerText()).includes(item.skuName))
  }
  await record('list-entry-shows-three-materials', 0)
  await navigate('/specs?template=t-phone')
  await node('sn-brand').waitFor()
  assert.equal(await page.locator('.vue-flow').count(), 1)
  await node('sn-brand').click()
  await page.keyboard.press('Enter')
  assert.equal(await page.getByRole('dialog', { name: '选择属性', exact: true }).count(), 1)
  await dialog('选择属性').getByRole('button', { name: '取消', exact: true }).click()
  await dialog('选择属性').waitFor({ state: 'hidden' })
  await waitUiSettled(page)
  await openCombos()
  await combo().locator('.combo-version').click()
  await clickOption(page, versions.at(-2).versionName)
  const historicalRow = combo().locator('.el-table__row').filter({ hasText: materialA.planningId })
  assert.match(await historicalRow.innerText(), new RegExp(materialA.materialCode))
  assert.match(await historicalRow.innerText(), new RegExp(materialB.materialCode))
  // Existing comboMaterialStatusCheck F: "historical" means another linked version,
  // including V2 when viewing V1. Keep its source label and the per-version counts.
  assert.match(await historicalRow.innerText(), /本版本已建 2 条 · 历史已建 1 条/)
  await historicalRow.locator('.el-table__expand-icon').click()
  const expanded = combo().locator('.combo-expand')
  assert.equal(await expanded.locator('ul').first().locator('li').count(), 2)
  assert.equal(await expanded.locator('ul').last().locator('li').count(), 1)
  assert.match(await expanded.locator('ul').last().innerText(), new RegExp(materialC.materialCode))
  assert.ok((await expanded.locator('ul').last().innerText()).includes(`来源 ${versions.at(-1).versionName}`))
  await close(combo())
  await record('remount-shortcut-and-history')
  const final = await read()
  assert.deepEqual(final.specModelVersions, next.specModelVersions)
  assert.deepEqual(final.skus, beforeReload.skus)
  assert.deepEqual(final.planningRecords, beforeReload.planningRecords)
  const knownWarning = '[Vue Flow]: The options parameter is deprecated and will be removed in the next major version. Please use the id parameter instead'
  assert.ok(diagnostics.every(item => item.type === 'warning' && item.message === knownWarning), `Unexpected browser diagnostics: ${JSON.stringify(diagnostics)}`)
  writeFileSync(resolve(output, 'result.json'), JSON.stringify({ result: 'PASS', root, browser: browser.version(), listChecks, checkpoints: states.map(({ name, writes }) => ({ name, writes: writes.length })), diagnostics, materials: [materialA, materialB, materialC].map(({ id, materialCode, planningId, modelVersionId }) => ({ id, materialCode, planningId, modelVersionId })) }, null, 2))
  console.log('PASS final business integration')
} finally {
  writeFileSync(resolve(output, 'states.json'), JSON.stringify(states, null, 2))
  writeFileSync(resolve(output, 'diagnostics.json'), JSON.stringify(diagnostics, null, 2))
  await browser?.close()
  await server.close()
}
