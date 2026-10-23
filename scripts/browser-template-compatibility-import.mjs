import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import * as XLSX from 'xlsx'

// A fixed synthetic workbook exercises the actual upload/preview/confirm wiring.
// It is intentionally separate from the real Apple workbook acceptance check.
const output = resolve(process.env.TEMPLATE_IMPORT_BROWSER_OUTPUT || 'work/template-compatibility/import-browser')
mkdirSync(output, { recursive: true })
const server = await createServer({ cacheDir: resolve(output, 'vite-cache'), server: { host: '127.0.0.1', port: 0, open: false, hmr: false, watch: null } })
const checkpoints = [], diagnostics = []
const copy = value => JSON.parse(JSON.stringify(value))
let browser, context, page
try {
  const { createTemplateCompatibilityFixture } = await server.ssrLoadModule('/scripts/template-compatibility-fixtures.ts')
  const { reconcilePlanningRecords } = await server.ssrLoadModule('/src/domain/planning.ts')
  const { readSheet, suggestMapping, previewSheet } = await server.ssrLoadModule('/src/domain/excelImport.ts')
  const { ensureProductListPages } = await server.ssrLoadModule('/src/domain/productListPages.ts')
  const fixture = createTemplateCompatibilityFixture({ styles: 2, colors: 1, packs: 1 })
  const { data, modelId, versionId, version } = fixture
  data.activeRole = 'admin'
  if (!data.templates.some(item => item.id === modelId)) data.templates.push({ id: modelId, name: '【合成导入测试】配件模型', enabled: true, parentId: null, structureOrder: [] })
  data.planningRecords = reconcilePlanningRecords({ data, records: data.planningRecords, productModelId: modelId, modelVersionId: versionId, nodes: version.nodesSnapshot, now: '2026-10-23T04:00:00.000Z' }).records
  const plans = data.planningRecords.filter(item => item.productModelId === modelId)
  assert.equal(plans.length, 2)
  const productType = data.productTypes.find(item => item.id === 'type-case')
  assert.ok(productType)
  const path = []
  let category = data.categories.find(item => item.id === productType.categoryId)
  while (category) { path.unshift(category.name); category = data.categories.find(item => item.id === category.parentId) }
  assert.ok(path.length > 0 && path.length <= 3)
  const categoryHeaders = ['一级分类', '二级分类', '三级分类'].slice(0, path.length)
  const headers = ['9.0管家婆', '9.0物料描述', '供应商编码', '物料描述', ...categoryHeaders, '产品类型', ...plans[0].steps.flatMap((_, index) => [`属性${index + 1}`, `属${index + 1}值`])]
  const rows = plans.map((plan, index) => [`TC-IMPORT-${index + 1}`, '合成工作簿用于隔离自动化回归，不代表真实设备结论', `TC-SUPPLIER-${index + 1}`, `【合成导入测试】独立配件 ${index + 1}`, ...path, productType.name, ...plan.steps.flatMap(step => [step.attributeName, step.valueId])])
  const matrix = [headers, ...rows], sheetName = '独立配件物料', fileName = 'synthetic-template-compatibility-two-rows.xlsx'
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(matrix), sheetName)
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  writeFileSync(resolve(output, fileName), buffer)
  const profile = readSheet(sheetName, matrix), mapping = suggestMapping(profile.headers, profile.sample)
  const expectedPreview = previewSheet(data, profile, mapping, `${fileName}:${buffer.length}`)
  assert.equal(expectedPreview.length, 2)
  assert(expectedPreview.every(row => row.status === 'ready' && row.action === 'formal' && row.modelVersionId === versionId))
  ensureProductListPages(data)
  await server.listen()
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true }).catch(cause => { throw new Error('Template import browser check requires installed Chrome or BROWSER_CHANNEL; missing browser is not a pass.', { cause }) })
  context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN', timezoneId: 'Asia/Singapore', reducedMotion: 'reduce' })
  await context.addInitScript(initial => {
    const NativeDate = Date, epoch = NativeDate.parse('2026-10-23T09:00:00.000Z')
    window.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : [epoch])) } static now() { return epoch } }
    if (!localStorage.getItem('iyge-v2-mock-db')) localStorage.setItem('iyge-v2-mock-db', JSON.stringify({ version: 15, data: initial }))
    if (!localStorage.getItem('iyge-v2-theme')) localStorage.setItem('iyge-v2-theme', 'light')
    const nativeSet = Storage.prototype.setItem
    window.__templateImportWrites = []; window.__templateImportAttempts = 0; window.__templateImportFailNext = false
    Storage.prototype.setItem = function(key, value) {
      if (key === 'iyge-v2-mock-db') {
        window.__templateImportAttempts++
        if (window.__templateImportFailNext) { window.__templateImportFailNext = false; throw new DOMException('合成 Excel 导入真实 setItem 失败注入', 'QuotaExceededError') }
        window.__templateImportWrites.push(String(value))
      }
      return nativeSet.call(this, key, value)
    }
  }, copy(data))
  page = await context.newPage(); page.setDefaultTimeout(20000)
  page.on('pageerror', error => diagnostics.push({ type: 'pageerror', message: String(error) }))
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) diagnostics.push({ type: message.type(), message: message.text() }) })
  const read = () => page.evaluate(async () => JSON.parse(JSON.stringify((await import('/src/stores/catalog.ts')).useCatalogStore().data)))
  const disk = () => page.evaluate(() => localStorage.getItem('iyge-v2-mock-db'))
  const writes = () => page.evaluate(() => window.__templateImportWrites.length)
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const check = (name, detail = {}) => { checkpoints.push({ name, ...detail }); console.log(`PASS template import browser ${name}`) }
  const fileInput = () => page.locator('input[type="file"][accept=".xlsx,.xls"]')
  const upload = name => fileInput().setInputFiles({ name, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer })
  await page.goto(`${base}/import`, { waitUntil: 'networkidle' }); await settle()
  await page.getByRole('heading', { name: '导入导出', exact: true }).waitFor()
  const initial = await read(), initialDisk = await disk(), initialWrites = await writes()
  await upload(fileName)
  await page.getByRole('button', { name: '预览导入', exact: true }).waitFor()
  await page.getByRole('button', { name: '预览导入', exact: true }).click()
  const confirm = page.getByRole('button', { name: '确认导入 2 行', exact: true })
  await confirm.waitFor(); await settle()
  assert.match(await page.locator('.panel').last().innerText(), /正式可导入 2 行，临时物料 0 行/)
  const previewRows = await page.locator('.panel').last().locator('.el-table__row').allTextContents()
  assert.equal(previewRows.length, 2, JSON.stringify(previewRows))
  assert(previewRows.every(text => /正式物料/.test(text)))
  assert.deepEqual(await read(), initial); assert.equal(await disk(), initialDisk); assert.equal(await writes(), initialWrites)
  await confirm.scrollIntoViewIfNeeded()
  await page.screenshot({ path: resolve(output, '01-upload-preview.png'), fullPage: true, animations: 'disabled' })
  check('real-upload-and-formal-preview-are-readonly', { workbook: 'fixed synthetic .xlsx, two separate suppliers and different legal specifications', previewCount: 2, formalCount: 2 })

  await page.evaluate(() => { window.__templateImportFailNext = true })
  await confirm.click(); await settle()
  await page.locator('.panel').last().getByText(/无法保存到本机/).waitFor()
  assert.deepEqual(await read(), initial); assert.equal(await disk(), initialDisk); assert.equal(await writes(), initialWrites)
  assert.deepEqual(await page.locator('.panel').last().locator('.el-table__row').allTextContents(), previewRows)
  assert.equal(await confirm.isEnabled(), true)
  assert.equal(await fileInput().evaluate(input => input.files?.[0]?.name), fileName)
  await page.screenshot({ path: resolve(output, '02-quota-keeps-preview.png'), fullPage: true, animations: 'disabled' })
  check('actual-setItem-failure-keeps-preview-and-no-half-business-state', { unchanged: ['families', 'SKU/MAT', 'PLN', 'receipts', 'formal declarations', 'per-claim origins', 'disk'], successfulWrites: 0 })

  const retryWrites = await writes()
  await confirm.click(); await settle()
  await page.locator('.panel').last().getByText(/新写入 2 条，已导入过的 0 条没有重复创建，失败 0 条/).waitFor()
  const created = await read(), previousIds = new Set(initial.skus.map(item => item.id)), materials = created.skus.filter(item => !previousIds.has(item.id))
  assert.equal(materials.length, 2)
  assert.equal(await writes(), retryWrites + 1, 'Retry commits SKU/MAT, receipt and compatibility in one actual write without a watcher echo')
  const declarations = created.compatibilities.filter(link => materials.some(item => item.id === link.targetId))
  const origins = created.templateCompatibilityOrigins.filter(origin => materials.some(item => item.id === origin.target.id))
  assert.equal(declarations.length, 2); assert.equal(origins.length, 2)
  for (const material of materials) {
    assert.equal(material.recordKind, 'material'); assert.ok(['TC-SUPPLIER-1', 'TC-SUPPLIER-2'].includes(material.supplierCode)); assert.equal(material.modelVersionId, versionId)
    const plan = plans.find(item => item.planningId === material.planningId), declaration = declarations.find(item => item.targetId === material.id), origin = origins.find(item => item.target.id === material.id)
    assert.ok(plan && declaration && origin)
    assert.equal(declaration.targetKind, 'material'); assert.equal(declaration.provenance.kind, 'template'); assert.equal(declaration.provenance.template.sourceVersionId, versionId)
    const expectedHost = plan.steps.find(step => step.attributeId === 'attr-style').valueId === '款式 1' ? 'device:model-a' : 'device:model-b'
    assert.equal(declaration.host.productModelId, expectedHost)
    assert.equal(origin.sourceVersionId, versionId); assert.equal(origin.declarationId, declaration.id); assert.equal(origin.identityKey, plan.identityKey)
    assert.equal(created.materialReceipts.filter(receipt => receipt.skuId === material.id).length, 1)
  }
  assert.deepEqual(created.specModelVersions, initial.specModelVersions); assert.deepEqual(created.planningRecords, initial.planningRecords)
  const creationFields = new Set(['families', 'skus', 'planningRecords', 'materialReceipts', 'compatibilities', 'templateCompatibilityOrigins'])
  assert.deepEqual(Object.fromEntries(Object.entries(created).filter(([key]) => !creationFields.has(key))), Object.fromEntries(Object.entries(initial).filter(([key]) => !creationFields.has(key))))
  assert.deepEqual(JSON.parse(await disk()).data, created)
  const committedDisk = await disk()
  writeFileSync(resolve(output, '03-committed-business.json'), JSON.stringify({ materials, declarations, origins, receipts: created.materialReceipts.filter(receipt => materials.some(item => item.id === receipt.skuId)) }, null, 2))
  check('retry-one-write-creates-each-MAT-with-own-frozen-template-declaration', { materials: 2, declarations: 2, origins: 2, receipts: 2, successfulWrites: 1, hosts: declarations.map(link => link.host.productModelId) })

  const beforeRepeat = await writes()
  await confirm.click(); await settle()
  await page.locator('.panel').last().getByText(/新写入 0 条，已导入过的 2 条没有重复创建，失败 0 条/).waitFor()
  assert.deepEqual(await read(), created); assert.equal(await disk(), committedDisk); assert.equal(await writes(), beforeRepeat)
  await page.getByRole('button', { name: '重新匹配', exact: true }).click(); await settle()
  assert.match(await page.locator('.panel').last().innerText(), /已导入 2 行/)
  assert.equal(await page.getByRole('button', { name: '确认导入 0 行', exact: true }).isDisabled(), true)
  assert.deepEqual(await read(), created); assert.equal(await writes(), beforeRepeat)
  check('same-preview-repeat-and-rematch-never-duplicate-or-backfill', { repeatedCreates: 0, repeatedWrites: 0, rematchAlreadyImported: 2 })

  await page.reload({ waitUntil: 'networkidle' }); await settle()
  assert.deepEqual(await read(), created); assert.equal(await disk(), committedDisk)
  const renameWrites = await writes()
  await upload('renamed-same-synthetic-content.xlsx')
  await page.getByRole('button', { name: '预览导入', exact: true }).waitFor(); await page.getByRole('button', { name: '预览导入', exact: true }).click(); await settle()
  assert.match(await page.locator('.panel').last().innerText(), /已导入 2 行/)
  assert.equal(await page.getByRole('button', { name: '确认导入 0 行', exact: true }).isDisabled(), true)
  assert.deepEqual(await read(), created); assert.equal(await disk(), committedDisk); assert.equal(await writes(), renameWrites)
  await page.screenshot({ path: resolve(output, '04-refresh-renamed-content-dedup.png'), fullPage: true, animations: 'disabled' })
  check('refresh-restores-data-and-renamed-file-content-remains-idempotent', { restoredMaterials: 2, renamedAlreadyImported: 2, additionalWrites: 0 })
  assert.equal(diagnostics.length, 0, JSON.stringify(diagnostics))
  writeFileSync(resolve(output, 'evidence.json'), JSON.stringify({ result: 'PASS', syntheticWorkbook: { fileName, sheetName, rows: rows.length, bytes: buffer.length, source: 'generated fixed fixture, not the real Apple acceptance workbook' }, baseline: { modelId, versionId, planningIds: plans.map(plan => plan.planningId) }, checkpoints, diagnostics, knownExistingIssue: { file: 'src/views/ProductIoView.vue', location: 'previewView computed', baselineHead: 'fd5f6c8d1d899f1709a5ee58c775f8ad89a99c86', baselineSourceBlob: 'ee898817f775c9137d2d9e6c541165a306072ae6', initialObservedSourceRows: 2, initialObservedRenderedRows: 3, initialEvidence: ['existing-supplier-preview-before.png', 'existing-supplier-preview-before.json'], baselineSource: "const dups = preview.value.filter((item) => item.message.includes('分成两条')); const ready = preview.value.filter((item) => item.status === 'ready'); return [...dups, ...blocked, ...ready].slice(0, 80)", evidence: 'Verified identical in the baseline HEAD: duplicate supplier rows are collected into dups and are also included in ready, rendering the row twice. Production code was not changed. The final focused synthetic fixture uses distinct supplier codes; it makes no claim that duplicate-supplier preview UI is fixed.' } }, null, 2))
  console.log(`PASS ${checkpoints.length} template import browser checkpoints`)
} catch (error) {
  if (page) await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true, animations: 'disabled' }).catch(() => {})
  writeFileSync(resolve(output, 'failure.json'), JSON.stringify({ message: String(error), stack: error?.stack, checkpoints, diagnostics }, null, 2))
  throw error
} finally {
  await context?.close(); await browser?.close(); await server.close()
}
