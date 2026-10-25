import { installCatalogTestLocks } from './catalog-storage-test-env'
const restoreLocks = installCatalogTestLocks()
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { createTemplateCompatibilityFixture, TEMPLATE_COMPATIBILITY_TIME as fixed } from './template-compatibility-fixtures'
import { createTemplateCompatibilityContext, freezeTemplateCompatibility, previewLegacyTemplateCompatibilityConversion } from '../src/domain/templateCompatibility'
import { materializeTemplateCompatibility, previewTemplateForManualAttributes, previewTemplateForSkuDrafts, templateCompatibilityOriginProblems } from '../src/domain/templateCompatibilitySync'
import { queryAccessoryDevices, queryDeviceAccessories } from '../src/domain/accessoryCompatibilityQuery'
import { cloneCompatibility, declarationDraft, compatibilityImportProblems } from '../src/domain/accessoryCompatibilityCommands'
import { previewSkuAppend } from '../src/domain/spuSku'
import { reconcilePlanningRecords } from '../src/domain/planning'
import { createV3Material } from '../src/domain/material'
import { DATA_VERSION, STORAGE_KEY, type AppData, type ProductFamily } from '../src/domain/types'
import { normalizeStored, useCatalogStore } from '../src/stores/catalog'
import { RBAC_ENFORCEMENT_ENABLED } from '../src/domain/accessMode'

const strict = RBAC_ENFORCEMENT_ENABLED
const out = resolve(process.env.TEMPLATE_COMPATIBILITY_OUTPUT_DIR || `work/compact-menu-template/regression/template-compatibility-state/${strict ? 'strict' : 'default'}`)
mkdirSync(out, { recursive: true })
const NativeDate = Date, epoch = Date.parse(fixed), originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage'), originalSession = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
globalThis.Date = class extends NativeDate { constructor(value?: string | number) { super(value === undefined ? epoch : value) } static now() { return epoch } } as DateConstructor
const disk = new Map<string, string>(), session = new Map<string, string>(), evidence: { name: string; passed: boolean; detail: string }[] = []
let failNext = false, writes = 0, attempts = 0, current: ReturnType<typeof useCatalogStore> | undefined
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => disk.get(key) ?? null,
  setItem: (key: string, value: string) => { attempts++; if (failNext) { failNext = false; throw new DOMException('Template compatibility quota fixture', 'QuotaExceededError') }; writes++; disk.set(key, value) },
  removeItem: (key: string) => disk.delete(key), clear: () => disk.clear(),
} })
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: (key: string) => session.get(key) ?? null, setItem: (key: string, value: string) => session.set(key, value), removeItem: (key: string) => session.delete(key) } })
const mark = (name: string, detail: string) => { evidence.push({ name, passed: true, detail }); console.log(`PASS template state ${name}: ${detail}`) }
function fixture() {
  const result = createTemplateCompatibilityFixture(), { data, modelId, versionId } = result
  data.activeRole = 'admin'
  data.templates.push({ id: modelId, name: '【隔离测试】模板兼容模型', enabled: true, parentId: null, structureOrder: [] })
  const type = data.productTypes.find(item => item.id === 'type-case')!
  const family: ProductFamily = { id: 'template-test-spu', name: '【隔离测试】兼容销售商品', templateId: modelId, productModelId: modelId, modelVersionId: versionId, categoryId: type.categoryId, productTypeId: type.id, oaProductId: '', commonAttrs: { 包装: '包装 1' }, productGroupIds: [], line: 'v2', lifecycle: 'ready', shelfStatus: 'online', createdAt: fixed, updatedAt: fixed }
  data.families.push(family)
  data.planningRecords = reconcilePlanningRecords({ data, records: data.planningRecords, productModelId: modelId, modelVersionId: versionId, nodes: result.version.nodesSnapshot, now: fixed }).records
  return { ...result, family }
}
function mount(data?: AppData) {
  current?.$dispose()
  if (data) { disk.set(STORAGE_KEY, JSON.stringify({ version: DATA_VERSION, data })); session.set('iyge-rbac-simulated-user', 'u-admin') }
  setActivePinia(createPinia()); current = useCatalogStore(); return current
}
function firstKey(store: ReturnType<typeof useCatalogStore>, familyId = 'template-test-spu') {
  const preview = previewSkuAppend(store.data, familyId, { kind: 'model' })
  assert.equal(preview.problem, '')
  const row = preview.rows.find(item => item.state === 'new')
  assert.ok(row); return row.key
}
async function appendFrozenVersion(store: ReturnType<typeof useCatalogStore>, version: AppData['specModelVersions'][number]) {
  const original = JSON.stringify(store.data.specModelVersions), count = store.data.specModelVersions.length
  const backup = JSON.parse(store.exportJson()) as { version: number; data: AppData }
  backup.data.specModelVersions.push(cloneCompatibility(version))
  await store.importJson(JSON.stringify(backup)); await nextTick(); await store.waitForPersistence()
  assert.equal(JSON.stringify(store.data.specModelVersions.slice(0, count)), original, 'restoring a prepared new-version fixture must not rewrite prior frozen versions')
}
async function permissionRejects(store: ReturnType<typeof useCatalogStore>, operation: () => unknown) {
  const memory = JSON.stringify(store.data), raw = disk.get(STORAGE_KEY), count = writes
  let message = ''
  try { const result = await operation() as {ok?: boolean; message?: string}; if (result?.ok === false) message = result.message || '' }
  catch (cause) { message = cause instanceof Error ? cause.message : String(cause) }
  assert.match(message, /未授权|权限|当前角色|仅可查看/, 'the rejection must come from actual authorization, not an unrelated invalid fixture')
  await nextTick(); await store.waitForPersistence(); assert.equal(JSON.stringify(store.data), memory); assert.equal(disk.get(STORAGE_KEY), raw); assert.equal(writes, count)
}
try {
  const f = fixture()
  let store = mount(f.data); await nextTick(); await store.waitForPersistence()
  const baseline = JSON.stringify(store.data), stored = disk.get(STORAGE_KEY), before = writes
  const key = firstKey(store), candidates = previewSkuAppend(store.data, f.family.id, { kind: 'model' })
  assert(previewTemplateForSkuDrafts(store.data, f.family.id, candidates.rows.map(row => row.draft)).every(row => row.state === 'configured'))
  assert.equal(JSON.stringify(store.data), baseline); assert.equal(disk.get(STORAGE_KEY), stored); assert.equal(writes, before)
  failNext = true
  const failed = (await store.appendSkus(f.family.id, { kind: 'model' }, [key])); await nextTick(); await store.waitForPersistence()
  assert.equal(failed.ok, false); assert.equal(JSON.stringify(store.data), baseline); assert.equal(disk.get(STORAGE_KEY), stored); assert.equal(writes, before)
  const appended = (await store.appendSkus(f.family.id, { kind: 'model' }, [key])); await nextTick(); await store.waitForPersistence()
  assert.ok(appended.ok); if (!appended.ok) throw new Error(appended.message)
  const salesId = appended.ids[0]!, sales = store.data.skus.find(item => item.id === salesId)!
  const salesLink = store.data.compatibilities.find(item => item.targetId === salesId)!
  assert.ok(salesLink); assert.equal(salesLink.targetKind, 'sku'); assert.equal(salesLink.provenance?.kind, 'template'); assert.equal(writes - before, 1)
  const unrelated = JSON.stringify([store.data.benefitPackages, store.data.benefitDeliveries, store.data.productListPages, store.data.deviceBindings])
  const duplicateWrites = writes
  const repeated = (await store.appendSkus(f.family.id, { kind: 'model' }, [key])); await nextTick(); await store.waitForPersistence()
  assert.ok(repeated.ok); assert.equal(repeated.ids.length, 0); assert.equal(writes, duplicateWrites)
  mark('sales-create-actual-quota-and-retry', 'real Pinia append fails at setItem without SKU/link/origin; retry writes once; repeated existing candidate writes zero times')

  const plan = store.data.planningRecords.find(item => item.productModelId === f.modelId && item.steps.some(step => step.valueNodeId === sales.sourceNodeIds?.[0]))!
  assert.ok(plan)
  const materialInput = { productModelId: f.modelId, modelVersionId: f.versionId, planningId: plan.planningId, requestId: 'template-state-material', categoryId: f.family.categoryId, productTypeId: f.family.productTypeId!, skuName: '【隔离测试】正式 MAT' }
  const matBefore = JSON.stringify(store.data), matDisk = disk.get(STORAGE_KEY), matWrites = writes
  failNext = true; const matFail = (await store.createMaterial(materialInput)); await nextTick(); await store.waitForPersistence()
  assert.equal(matFail.ok, false); assert.equal(JSON.stringify(store.data), matBefore); assert.equal(disk.get(STORAGE_KEY), matDisk)
  const material = (await store.createMaterial(materialInput)); await nextTick(); await store.waitForPersistence(); assert.ok(material.ok)
  const matId = material.skuId, matLink = store.data.compatibilities.find(item => item.targetId === matId)!
  assert.ok(matLink); assert.equal(matLink.targetKind, 'material'); assert.notEqual(matLink.id, salesLink.id); assert.equal(writes - matWrites, 1)
  const sameMatWrites = writes
  assert.equal((await store.createMaterial(materialInput)).ok, true); await nextTick(); await store.waitForPersistence(); assert.equal(writes, sameMatWrites)
  assert.equal(JSON.stringify([store.data.benefitPackages, store.data.benefitDeliveries, store.data.productListPages, store.data.deviceBindings]), unrelated)
  mark('material-receipt-atomicity-independent-targets', 'MAT creation/link/receipt commit together; retry returns original material; sales declaration remains a separate identity; unrelated collections remain byte equal')

  const origin = store.data.templateCompatibilityOrigins!.find(item => item.target.id === salesId)!
  const config = cloneCompatibility(store.data.templateCompatibilityConfigs!.find(item => item.modelId === f.modelId)!)
  config.defaultRule.claims[0]!.note = '第二版模板说明'
  const saveBefore = JSON.stringify(store.data), saveDisk = disk.get(STORAGE_KEY), saveWrites = writes
  failNext = true; assert.equal((await store.saveTemplateCompatibility(config, config.revision)).ok, false); await nextTick(); await store.waitForPersistence()
  assert.equal(JSON.stringify(store.data), saveBefore); assert.equal(disk.get(STORAGE_KEY), saveDisk)
  assert.equal((await store.saveTemplateCompatibility(config, config.revision)).ok, true); await nextTick(); await store.waitForPersistence(); assert.equal(writes - saveWrites, 1)
  assert.equal((await store.saveTemplateCompatibility(config, config.revision)).ok, false, 'stale revision must be rejected')
  const pubBefore = JSON.stringify(store.data), pubDisk = disk.get(STORAGE_KEY), pubWrites = writes
  failNext = true; assert.equal((await store.publishSpecModel(f.modelId)).ok, false); await nextTick(); await store.waitForPersistence()
  assert.equal(JSON.stringify(store.data), pubBefore); assert.equal(disk.get(STORAGE_KEY), pubDisk)
  assert.equal((await store.publishSpecModel(f.modelId)).ok, true); await nextTick(); await store.waitForPersistence(); assert.equal(writes - pubWrites, 1)
  const targetVersion = store.data.specModelVersions.filter(item => item.templateId === f.modelId).at(-1)!
  assert.notEqual(targetVersion.id, f.versionId)
  assert.equal(store.data.specModelVersions.find(item => item.id === f.versionId)?.templateCompatibilitySnapshot?.config.defaultRule.claims[0]?.note, '默认配置')
  assert.equal(store.data.planningRecords.filter(item => item.productModelId === f.modelId).length, f.data.planningRecords.filter(item => item.productModelId === f.modelId).length)
  const versionCount = store.data.specModelVersions.length
  assert.match((await store.publishSpecModel(f.modelId)).message, /没有生成新版本/); await nextTick(); await store.waitForPersistence(); assert.equal(store.data.specModelVersions.length, versionCount)
  const v2Material = (await store.createMaterial({ ...materialInput, familyId: material.familyId, modelVersionId: targetVersion.id, requestId: 'template-new-mat-old-family' })); assert.ok(v2Material.ok); await nextTick(); await store.waitForPersistence()
  assert.equal(v2Material.familyId, material.familyId)
  assert.equal(store.data.families.find(item => item.id === material.familyId)?.modelVersionId, f.versionId)
  assert.equal(store.data.templateCompatibilityOrigins!.find(item => item.target.id === v2Material.skuId)?.sourceVersionId, targetVersion.id)
  assert.equal(store.data.templateCompatibilityOrigins!.find(item => item.target.id === matId)?.sourceVersionId, f.versionId)
  assert.equal(store.data.skus.find(item => item.id === v2Material.skuId)?.planningId, store.data.skus.find(item => item.id === matId)?.planningId)
  mark('config-save-and-publish-atomic-version-freeze', 'quota preserves drafts and version/PLN arrays; compatibility-only edit publishes a new independent snapshot; unchanged content creates no version and all PLN identities are reused')

  let preview = store.previewTemplateCompatibilitySync({ modelId: f.modelId, targetVersionId: targetVersion.id, targetIds: [salesId] })
  assert.equal(preview.counts.update, 1); assert.equal(store.data.templateCompatibilityOrigins!.find(item => item.target.id === salesId)?.sourceVersionId, f.versionId)
  const syncBefore = JSON.stringify(store.data), syncDisk = disk.get(STORAGE_KEY), syncWrites = writes
  const syncBusiness = JSON.stringify([store.data.families, store.data.skus, store.data.productPlans, store.data.planningRecords, store.data.materialReceipts, store.data.specModelVersions])
  failNext = true; assert.equal((await store.applyTemplateCompatibilitySync(preview, {})).ok, false); await nextTick(); await store.waitForPersistence()
  assert.equal(JSON.stringify(store.data), syncBefore); assert.equal(disk.get(STORAGE_KEY), syncDisk)
  assert.equal((await store.applyTemplateCompatibilitySync(preview, {})).ok, true); await nextTick(); await store.waitForPersistence(); assert.equal(writes - syncWrites, 1)
  assert.equal(store.data.compatibilities.find(item => item.id === salesLink.id)?.note, '第二版模板说明')
  assert.equal(store.data.templateCompatibilityOrigins!.find(item => item.target.id === salesId)?.sourceVersionId, targetVersion.id)
  assert.equal(JSON.stringify([store.data.families, store.data.skus, store.data.productPlans, store.data.planningRecords, store.data.materialReceipts, store.data.specModelVersions]), syncBusiness)
  assert.equal((await store.applyTemplateCompatibilitySync(preview, {})).ok, false, 'stale preview cannot repeat a write')
  preview = store.previewTemplateCompatibilitySync({ modelId: f.modelId, targetVersionId: targetVersion.id, targetIds: [salesId] })
  const unchangedWrites = writes; assert.equal((await store.applyTemplateCompatibilitySync(preview, {})).ok, true); await nextTick(); await store.waitForPersistence(); assert.equal(writes, unchangedWrites)
  mark('three-way-safe-sync-and-stale-preview', 'safe template baseline updates once without changing SKU binding/source/spec or MAT/PLN identities; failure atomic; stale replay rejected; refreshed no-op writes zero times')

  const live = store.data.compatibilities.find(item => item.id === salesLink.id)!
  assert.equal((await store.commitCompatibilityChanges([{ kind: 'edit', id: live.id, draft: { ...declarationDraft(live), note: '人工补充说明，必须保留' } }])).ok, true); await nextTick(); await store.waitForPersistence()
  preview = store.previewTemplateCompatibilitySync({ modelId: f.modelId, targetVersionId: targetVersion.id, targetIds: [salesId] })
  assert.equal(preview.counts.protected, 1); assert.equal(preview.items[0]?.defaultSelected, false)
  assert.equal((await store.applyTemplateCompatibilitySync(preview, {})).ok, true); await nextTick(); await store.waitForPersistence()
  assert.equal(store.data.compatibilities.find(item => item.id === live.id)?.note, '人工补充说明，必须保留')
  preview = store.previewTemplateCompatibilitySync({ modelId: f.modelId, targetVersionId: targetVersion.id, targetIds: [salesId] })
  const keepWrites = writes; assert.equal((await store.applyTemplateCompatibilitySync(preview, {})).ok, true); await nextTick(); await store.waitForPersistence(); assert.equal(writes, keepWrites)
  assert.equal((await store.applyTemplateCompatibilitySync(preview, { [preview.items[0]!.id]: 'take-template' })).ok, true); await nextTick(); await store.waitForPersistence()
  assert.equal(store.data.compatibilities.find(item => item.id === live.id)?.note, '第二版模板说明')
  assert.equal((await store.commitCompatibilityChanges([{ kind: 'remove', id: live.id }])).ok, true); await nextTick(); await store.waitForPersistence()
  store = mount(); await nextTick(); await store.waitForPersistence()
  preview = store.previewTemplateCompatibilitySync({ modelId: f.modelId, targetVersionId: targetVersion.id, targetIds: [salesId] })
  assert.equal(preview.counts.protected, 1); assert.equal(store.data.compatibilities.some(item => item.id === live.id), false)
  assert.equal((await store.applyTemplateCompatibilitySync(preview, {})).ok, true); await nextTick(); await store.waitForPersistence()
  assert.equal(store.data.compatibilities.some(item => item.targetId === salesId), false)
  mark('manual-edit-delete-and-durable-keep-protection', 'manual note edits are protected; explicit adopt restores; hand deletion remains suppressed after reload; repeated keep is idempotent')

  store.data.nodeCompatibilityRules.push({ id: 'template-copy-legacy', templateId: f.modelId, nodeId: 'compat-style-1', modelVersionId: '', hosts: [cloneCompatibility(f.hosts.b)], updatedAt: fixed })
  store.data.templateCompatibilityConfigs!.find(item => item.modelId === f.modelId)!.conversions.push({ legacyRuleId: 'template-copy-legacy', nodeId: 'compat-style-1', exceptionId: 'compat-rule-pro', convertedAt: fixed }); await nextTick(); await store.waitForPersistence()
  const copiedBefore = writes, copied = (await store.copyProductModel(f.modelId)); await nextTick(); await store.waitForPersistence(); assert.ok(copied.ok); assert.equal(writes - copiedBefore, 1)
  assert.equal(store.data.specModelVersions.some(item => item.templateId === copied.templateId), false)
  const copiedConfig = store.data.templateCompatibilityConfigs!.find(item => item.modelId === copied.templateId)!
  assert.ok(copiedConfig); assert.notEqual(copiedConfig.defaultRule.id, config.defaultRule.id)
  assert(copiedConfig.exceptions.flatMap(rule => rule.selector.anyOf.flat()).every(term => store.data.productSpecNodes.some(node => node.templateId === copied.templateId && node.id === term.valueNodeId)))
  assert.equal(previewLegacyTemplateCompatibilityConversion(store.data, copied.templateId!).items[0]?.state, 'converted')
  assert.equal(store.data.specCanvases.find(canvas => canvas.templateId === copied.templateId)?.direction, 'ltr')
  const designerCopy = (await store.copyProductModel(f.modelId, { name: '【隔离测试】逻辑副本', direction: 'logic' })); assert.ok(designerCopy.ok); await nextTick(); await store.waitForPersistence()
  assert.equal(store.data.specCanvases.find(canvas => canvas.templateId === designerCopy.templateId)?.direction, 'logic')
  assert.deepEqual(compatibilityImportProblems(store.data), []); assert.deepEqual(templateCompatibilityOriginProblems(store.data), [])
  const backup = store.exportJson(), backupText = JSON.stringify(store.data)
  assert.ok(normalizeStored(JSON.parse(backup), { persist: false }))
  ;(await store.importJson(backup)); await nextTick(); await store.waitForPersistence(); assert.equal(JSON.stringify(store.data), backupText)
  const corrupt = JSON.parse(backup); corrupt.data.templateCompatibilityOrigins[0].baseline.host = {}; await assert.rejects(async () => (await store.importJson(JSON.stringify(corrupt))), /模板兼容/)
  assert.equal(store.startPermissionPreview('u-op').ok, true)
  if (strict) {
    for (const code of ['product:model:update', 'product:model:publish', 'product:compatibility:update', 'product:model:create', 'product:import:execute']) assert.equal(store.can(code), false)
    await permissionRejects(store, () => store.saveTemplateCompatibility(config)); await permissionRejects(store, () => store.publishSpecModel(f.modelId)); await permissionRejects(store, () => store.applyTemplateCompatibilitySync(preview, {})); await permissionRejects(store, () => store.copyProductModel(f.modelId))
    const protectedBackup = JSON.parse(backup); protectedBackup.data.templateCompatibilityOrigins = []; await permissionRejects(store, () => store.importJson(JSON.stringify(protectedBackup)))
  } else {
    for (const code of ['product:model:update', 'product:model:publish', 'product:compatibility:update', 'product:model:create', 'product:import:execute']) assert.equal(store.can(code), true)
    assert.equal((await store.copyProductModel(f.modelId)).ok, true, 'default mock operator remains an unrestricted administrator')
    await store.importJson(backup); await nextTick(); await store.waitForPersistence()
  }
  store.stopPermissionPreview()
  mark('copy-backup-import-and-command-permissions', strict ? 'copy remaps stable identities without products/published versions; backup preserves suppression; malformed origin rejected; real operator preview refuses save/publish/sync/copy/import atomically' : 'copy remaps stable identities without products/published versions; backup preserves suppression; malformed origin rejected; default operator preview retains administrator access')

  // A manual SKU with a provable original snapshot can edit specs under existing rules.
  const ordinary = fixture(), ctx = createTemplateCompatibilityContext(ordinary.data, { modelId: ordinary.modelId, versionId: ordinary.versionId })
  const combos = ctx.combinations.filter(item => item.steps.some(step => step.attributeId === 'attr-pack' && step.valueId === '包装 1'))
  const drafts = combos.map(combo => ({ code: '', oaSkuId: '', status: 'draft' as const, skuName: '【隔离测试】普通手工 SKU', variantAttrs: Object.fromEntries(combo.steps.filter(step => step.role === 'variant').map(step => [step.attributeName, step.valueId])) }))
  store = mount(ordinary.data); await nextTick(); await store.waitForPersistence()
  const manualPreview = previewSkuAppend(store.data, ordinary.family.id, { kind: 'manual', rows: drafts.slice(0, 1) })
  const manual = (await store.appendSkus(ordinary.family.id, { kind: 'manual', rows: drafts.slice(0, 1) }, [manualPreview.rows[0]!.key])); assert.ok(manual.ok); await nextTick(); await store.waitForPersistence()
  const manualId = manual.ids[0]!, manualSku = store.data.skus.find(item => item.id === manualId)!
  const change = { ...drafts[1]!, code: manualSku.code, oaSkuId: manualSku.oaSkuId }
  assert.equal((await store.editSku(manualId, change)).ok, true); await nextTick(); await store.waitForPersistence()
  assert.equal(store.data.compatibilities.find(item => item.targetId === manualId)?.provenance?.template?.state, 'stale')
  const reverseStale = queryAccessoryDevices(store.data, { kind: 'sku', id: manualId }), forwardStale = queryDeviceAccessories(store.data, 'phone-a')
  assert.equal(reverseStale.hosts.length, 0); assert(reverseStale.issues.some(issue => /规格.*改变/.test(issue.message)))
  assert(!forwardStale.sales.some(item => item.target.id === manualId)); assert(forwardStale.issues.some(issue => /规格.*改变/.test(issue.message)))
  let editSync = store.previewTemplateCompatibilitySync({ modelId: ordinary.modelId, targetVersionId: ordinary.versionId, targetIds: [manualId] })
  assert.equal(editSync.counts.protected, 1); assert.equal(editSync.counts.invalid, 0)
  assert.equal((await store.applyTemplateCompatibilitySync(editSync, { [editSync.items[0]!.id]: 'take-template' })).ok, true); await nextTick(); await store.waitForPersistence()
  assert.equal(store.data.compatibilities.find(item => item.targetId === manualId)?.provenance?.template?.state, 'managed')
  assert(queryAccessoryDevices(store.data, { kind: 'sku', id: manualId }).hosts.length > 0)
  const sourceBefore = JSON.stringify(store.data.templateCompatibilityOrigins)
  assert.equal((await store.editSku(manualId, { ...change, skuName: '仅维护名称' })).ok, true); await nextTick(); await store.waitForPersistence(); assert.equal(JSON.stringify(store.data.templateCompatibilityOrigins), sourceBefore)
  mark('ordinary-spec-edit-stale-and-explicit-repair', 'existing editable spec remains editable; old template statement is stale; precise valid new combo permits explicit adopt; name-only maintenance does not recalculate compatibility')

  const importedCandidate = cloneCompatibility(store.data), basis = store.materialImportBasis(), existingIds = new Set(store.data.skus.map(item => item.id)), importPlan = importedCandidate.planningRecords.find(item => item.productModelId === ordinary.modelId)!
  const imported = createV3Material(importedCandidate, { ...materialInput, productModelId: ordinary.modelId, modelVersionId: ordinary.versionId, planningId: importPlan.planningId, requestId: 'template-excel-independent', now: fixed, nextId: prefix => `${prefix}-excel-fixture` }); assert.ok(imported.ok)
  const importBefore = JSON.stringify(store.data), importDisk = disk.get(STORAGE_KEY)
  failNext = true; assert.equal((await store.commitMaterialImport(importedCandidate, basis)).ok, false); await nextTick(); await store.waitForPersistence(); assert.equal(JSON.stringify(store.data), importBefore); assert.equal(disk.get(STORAGE_KEY), importDisk)
  assert.equal((await store.commitMaterialImport(importedCandidate, basis)).ok, true); await nextTick(); await store.waitForPersistence()
  const importedId = store.data.skus.find(item => !existingIds.has(item.id))!.id
  assert(store.data.compatibilities.some(item => item.targetId === importedId)); assert.equal((await store.commitMaterialImport(importedCandidate, basis)).ok, false)
  const noBackfill = cloneCompatibility(store.data), newIds: string[] = []
  assert.equal(materializeTemplateCompatibility(noBackfill, newIds, () => { throw new Error('must not allocate') }, fixed).ok, true)
  assert.equal(JSON.stringify(noBackfill), JSON.stringify(store.data))
  mark('material-import-transaction-and-only-new', 'actual import candidate fails without half receipt/link; retry persists one complete transaction; stale candidate refused; empty new-ID set never backfills historical records')

  const temporary = fixture(); store = mount(temporary.data); await nextTick(); await store.waitForPersistence()
  const temporaryContext = createTemplateCompatibilityContext(store.data, { modelId: temporary.modelId, versionId: temporary.versionId }), combo = temporaryContext.combinations[0]!
  const manualAttributes = combo.steps.map(step => ({ attributeId: step.attributeId, value: step.valueId, source: 'dictionary' as const }))
  const tempPreview = previewTemplateForManualAttributes(store.data, { modelId: temporary.modelId, versionId: temporary.versionId, attrs: manualAttributes })
  assert.equal(tempPreview.state, 'configured')
  const temp = (await store.createTemporary({ requestId: 'template-temporary-exact', categoryId: temporary.family.categoryId, productTypeId: temporary.family.productTypeId!, productModelId: temporary.modelId, modelVersionId: temporary.versionId, attrs: manualAttributes, materialCode: 'MAT-TEMPLATE-TEMP', skuName: '【隔离测试】临时精确规格' })); assert.ok(temp.ok); await nextTick(); await store.waitForPersistence()
  const tempLink = store.data.compatibilities.find(item => item.targetId === temp.skuId)
  assert.ok(tempLink); assert.equal(tempLink.note, tempPreview.claims[0]?.claim.note)
  const renamed = fixture(); renamed.data.params.find(param => param.id === 'attr-color')!.name = '更名颜色'
  renamed.family.commonAttrs.额外说明 = '不是模型身份字段'
  store = mount(renamed.data); await nextTick(); await store.waitForPersistence()
  const renamedCandidates = previewSkuAppend(store.data, renamed.family.id, { kind: 'model' })
  const renamedSummary = previewTemplateForSkuDrafts(store.data, renamed.family.id, [renamedCandidates.rows[0]!.draft])
  assert.equal(renamedSummary[0]?.state, 'configured')
  const renamedSku = (await store.appendSkus(renamed.family.id, { kind: 'model' }, [renamedCandidates.rows[0]!.key])); assert.ok(renamedSku.ok); await nextTick(); await store.waitForPersistence()
  assert(store.data.compatibilities.some(link => link.targetId === renamedSku.ids[0]))
  const ordinaryPlanning = reconcilePlanningRecords({ data: renamed.data, records: [], productModelId: renamed.modelId, modelVersionId: renamed.versionId, nodes: renamed.version.nodesSnapshot, now: fixed })
  const precomputed = reconcilePlanningRecords({ data: renamed.data, records: [], productModelId: renamed.modelId, modelVersionId: renamed.versionId, nodes: renamed.version.nodesSnapshot, now: fixed, combinations: createTemplateCompatibilityContext(renamed.data, { modelId: renamed.modelId }).combinations })
  assert.deepEqual(precomputed, ordinaryPlanning)
  mark('temporary-actual-attributes-and-display-rename', 'COMMON and VARIANT manual attributes map uniquely without node-name guessing; preview matches actual creation; dictionary display rename and extra non-model common attributes preserve inheritance; precomputed planning deeply equals original entry')

  const lineage = fixture(); store = mount(lineage.data); await nextTick(); await store.waitForPersistence()
  const lineageRows = previewSkuAppend(store.data, lineage.family.id, { kind: 'model' }).rows
  const lineageCreated = (await store.appendSkus(lineage.family.id, { kind: 'model' }, [lineageRows.find(row => row.draft.variantAttrs.款式 === '款式 2')!.key])); assert.ok(lineageCreated.ok); await nextTick(); await store.waitForPersistence()
  const lineageId = lineageCreated.ids[0]!, beforeKey = store.data.templateCompatibilityOrigins!.find(item => item.target.id === lineageId)!.key
  const sourceVersion = cloneCompatibility(store.data.specModelVersions.find(item => item.id === lineage.versionId)!), sameRule = cloneCompatibility(sourceVersion.templateCompatibilitySnapshot!.config.exceptions[0]!)
  sameRule.id = 'additional-identical-source'; sameRule.claims[0]!.id = 'additional-identical-claim'
  sourceVersion.id = 'template-lineage-v2'; sourceVersion.version = 2; sourceVersion.templateCompatibilitySnapshot!.config.exceptions.push(sameRule)
  await appendFrozenVersion(store, sourceVersion)
  let lineagePreview = store.previewTemplateCompatibilitySync({ modelId: lineage.modelId, targetVersionId: sourceVersion.id, targetIds: [lineageId] })
  assert.equal(lineagePreview.counts.update, 1); assert.equal(lineagePreview.counts.remove, 0); assert.equal(lineagePreview.counts.add, 0)
  assert.equal((await store.applyTemplateCompatibilitySync(lineagePreview, {})).ok, true); await nextTick(); await store.waitForPersistence()
  assert.equal(store.data.templateCompatibilityOrigins!.find(item => item.target.id === lineageId)?.key, beforeKey)
  assert.equal(store.data.compatibilities.filter(item => item.targetId === lineageId).length, 1)
  const emptyVersion = cloneCompatibility(sourceVersion); emptyVersion.id = 'template-lineage-empty'; emptyVersion.version = 3; emptyVersion.templateCompatibilitySnapshot!.config.exceptions.forEach(rule => { rule.claims = [] })
  await appendFrozenVersion(store, emptyVersion)
  lineagePreview = store.previewTemplateCompatibilitySync({ modelId: lineage.modelId, targetVersionId: emptyVersion.id, targetIds: [lineageId] })
  assert.equal(lineagePreview.counts.remove, 1); assert.equal((await store.applyTemplateCompatibilitySync(lineagePreview, {})).ok, true); await nextTick(); await store.waitForPersistence()
  assert.equal(store.data.compatibilities.some(item => item.targetId === lineageId), false)
  const broken = cloneCompatibility(sourceVersion); broken.id = 'template-lineage-broken'; broken.version = 4; broken.nodesSnapshot = broken.nodesSnapshot.filter(node => node.id !== 'compat-style-1')
  await appendFrozenVersion(store, broken)
  lineagePreview = store.previewTemplateCompatibilitySync({ modelId: lineage.modelId, targetVersionId: broken.id, targetIds: [lineageId] })
  assert(lineagePreview.counts.invalid > 0); assert.equal(lineagePreview.counts.remove, 0)
  assert.equal(store.startPermissionPreview('u-op').ok, true)
  if (strict) { assert.equal(store.can('product:sku:create'), false); await permissionRejects(store, () => store.appendSkus(lineage.family.id, { kind: 'model' }, [firstKey(store)])) }
  else { assert.equal(store.can('product:sku:create'), true); assert.equal((await store.appendSkus(lineage.family.id, { kind: 'model' }, [firstKey(store)])).ok, true) }
  store.stopPermissionPreview()
  mark('stable-merged-lineage-empty-and-invalid-mapping', strict ? 'adding identical exception origins updates one declaration/key; explicit empty removes managed claim; deleted structure stays invalid; real read-only user creation refused' : 'adding identical exception origins updates one declaration/key; explicit empty removes managed claim; deleted structure stays invalid; default administrator creation remains available')

  const independent = fixture(), secondClaim = independent.claim('independent-template-claim')
  secondClaim.source += '；另一独立核验资料'; secondClaim.note = '第二条独立声明'
  independent.config.defaultRule.claims.push(secondClaim)
  independent.version.templateCompatibilitySnapshot = freezeTemplateCompatibility(independent.data, independent.modelId)
  store = mount(independent.data); await nextTick(); await store.waitForPersistence()
  const independentCreated = (await store.appendSkus(independent.family.id, { kind: 'model' }, [firstKey(store)])); assert.ok(independentCreated.ok); await nextTick(); await store.waitForPersistence()
  const independentId = independentCreated.ids[0]!, independentLinks = store.data.compatibilities.filter(link => link.targetId === independentId)
  assert.equal(independentLinks.length, 2)
  const firstIndependent = independentLinks[0]!
  const editedIndependent = (await store.commitCompatibilityChanges([{ kind: 'edit', id: firstIndependent.id, draft: { ...declarationDraft(firstIndependent), note: '人工只修改第一条' } }])); assert.ok(editedIndependent.ok)
  assert.equal(editedIndependent.preview?.edited, 1); await nextTick(); await store.waitForPersistence()
  const nextIndependent = cloneCompatibility(independent.version); nextIndependent.id = 'independent-v2'; nextIndependent.version = 2; nextIndependent.templateCompatibilitySnapshot!.config.defaultRule.claims.forEach(claim => { claim.note += '新版' })
  await appendFrozenVersion(store, nextIndependent)
  const independentPreview = store.previewTemplateCompatibilitySync({ modelId: independent.modelId, targetVersionId: nextIndependent.id, targetIds: [independentId] })
  assert.equal(independentPreview.counts.protected, 1); assert.equal(independentPreview.counts.update, 1)
  assert.equal((await store.applyTemplateCompatibilitySync(independentPreview, {})).ok, true); await nextTick(); await store.waitForPersistence()
  assert.equal(store.data.compatibilities.find(link => link.id === firstIndependent.id)?.note, '人工只修改第一条')
  assert.equal(store.data.compatibilities.find(link => link.id === independentLinks[1]?.id)?.note, '第二条独立声明新版')
  mark('per-claim-manual-protection', 'same-host/basic claims retain separate full source/note identities; editing one is accepted and protects only its lineage; the other untouched template claim still updates safely')

  for (const variant of ['same', 'deny', 'different-capability'] as const) {
    const manualFixture = fixture(), initialRows = previewSkuAppend(manualFixture.data, manualFixture.family.id, { kind: 'model' }).rows, draft = initialRows[0]!.draft, manualId = `manual-${variant}-sku`
    manualFixture.data.skus.push({ ...draft, id: manualId, familyId: manualFixture.family.id, recordKind: 'sku', projectedAttrs: {}, modelVersionId: manualFixture.versionId, createdAt: fixed, updatedAt: fixed })
    const claim = manualFixture.claim()
    manualFixture.data.compatibilities.push({ ...claim, id: `manual-${variant}-link`, accessorySkuId: manualId, targetId: manualId, targetKind: 'sku', conclusion: variant === 'same' ? 'compatible' : 'incompatible', capability: variant === 'different-capability' ? 'fast-charge' : 'basic', provenance: { kind: 'manual', detail: '独立手工资料' }, createdAt: fixed, updatedAt: fixed })
    store = mount(manualFixture.data); await nextTick(); await store.waitForPersistence()
    const manualSync = store.previewTemplateCompatibilitySync({ modelId: manualFixture.modelId, targetVersionId: manualFixture.versionId, targetIds: [manualId] })
    if (variant === 'different-capability') assert.equal(manualSync.counts.add, 1)
    else { assert.equal(manualSync.counts.protected, 1); assert.equal(manualSync.items[0]?.defaultSelected, false) }
    assert.equal((await store.applyTemplateCompatibilitySync(manualSync, {})).ok, true); await nextTick(); await store.waitForPersistence()
    const originalManual = store.data.compatibilities.find(link => link.id === `manual-${variant}-link`)!
    assert.equal(originalManual.provenance?.kind, 'manual')
    if (variant === 'same') assert.equal(store.data.templateCompatibilityOrigins?.some(origin => origin.target.id === manualId), false)
    if (variant === 'deny') { assert.equal(originalManual.conclusion, 'incompatible'); assert.equal(store.data.compatibilities.filter(link => link.targetId === manualId).length, 1) }
    if (variant === 'different-capability') assert.equal(store.data.compatibilities.filter(link => link.targetId === manualId).length, 2)
  }
  mark('manual-identical-not-adopted-and-deny-capability-scope', 'identical manual claim is skipped without origin adoption; same-capability explicit exclusion remains intact by default; independent fast-charge exclusion does not suppress basic claim')

  const oldEditor = fixture(); store = mount(oldEditor.data); await nextTick(); await store.waitForPersistence()
  const bundleDraft = previewSkuAppend(store.data, oldEditor.family.id, { kind: 'model' }).rows[0]!.draft
  const bundleRow = { ...bundleDraft, id: 'template-old-editor-new', familyId: oldEditor.family.id, projectedAttrs: {} }
  const oldBefore = JSON.stringify(store.data), oldDisk = disk.get(STORAGE_KEY), oldWrites = writes
  failNext = true; assert.equal((await store.saveBundle(cloneCompatibility(oldEditor.family), [bundleRow])).ok, false); await nextTick(); await store.waitForPersistence()
  assert.equal(JSON.stringify(store.data), oldBefore); assert.equal(disk.get(STORAGE_KEY), oldDisk)
  assert.equal((await store.saveBundle(cloneCompatibility(oldEditor.family), [bundleRow])).ok, true); await nextTick(); await store.waitForPersistence(); assert.equal(writes - oldWrites, 1)
  const bundleLink = store.data.compatibilities.find(link => link.targetId === bundleRow.id)!
  assert.ok(bundleLink)
  assert.equal((await store.commitCompatibilityChanges([{ kind: 'remove', id: bundleLink.id }])).ok, true); await nextTick(); await store.waitForPersistence()
  assert.equal((await store.saveBundle(cloneCompatibility(oldEditor.family), [bundleRow])).ok, true); await nextTick(); await store.waitForPersistence()
  assert.equal(store.data.compatibilities.some(link => link.targetId === bundleRow.id), false, 'existing old-editor SKU is not a new creation and must not refill deletion')
  mark('old-editor-save-bundle-atomic-only-new', 'legacy editor uses one candidate for SKU and compatibility; quota leaves no half object; retry commits once; later existing-SKU saves never backfill hand-deleted compatibility')

  const deletedModel = fixture(); store = mount(deletedModel.data); await nextTick(); await store.waitForPersistence()
  const orphanDraft = cloneCompatibility(deletedModel.config)
  orphanDraft.exceptions = []; orphanDraft.defaultRule.claims[0].note = '模型删除后仍留在弹窗里的有效草稿'
  store.data.templates = store.data.templates.filter(item => item.id !== deletedModel.modelId)
  store.data.specCanvases = store.data.specCanvases.filter(item => item.templateId !== deletedModel.modelId)
  await nextTick(); await store.waitForPersistence()
  const deletedBefore = JSON.stringify(store.data), deletedDisk = disk.get(STORAGE_KEY), deletedWrites = writes
  const orphanResult = (await store.saveTemplateCompatibility(orphanDraft, orphanDraft.revision))
  assert.equal(orphanResult.ok, false, 'A valid leftover draft cannot recreate compatibility configuration after its model and canvas have been removed')
  await nextTick(); await store.waitForPersistence(); assert.equal(JSON.stringify(store.data), deletedBefore); assert.equal(disk.get(STORAGE_KEY), deletedDisk); assert.equal(writes, deletedWrites)
  mark('deleted-model-draft-save-is-rejected', 'concurrent model/canvas removal invalidates an open compatibility draft; valid claim content does not recreate an orphan configuration and performs zero writes')

  assert.ok(origin.key)
  writeFileSync(resolve(out, 'evidence.json'), JSON.stringify({ time: fixed, rbacEnforced: strict, checks: evidence, attempts, writes }, null, 2))
  console.log(`PASS ${evidence.length} template compatibility state scenarios`)
} finally {
  current?.$dispose(); globalThis.Date = NativeDate; restoreLocks()
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
  else Reflect.deleteProperty(globalThis, 'localStorage')
  if (originalSession) Object.defineProperty(globalThis, 'sessionStorage', originalSession)
  else Reflect.deleteProperty(globalThis, 'sessionStorage')
}
