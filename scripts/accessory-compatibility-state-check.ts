import { installCatalogTestLocks } from './catalog-storage-test-env'
installCatalogTestLocks()
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { createSeed } from '../src/domain/seed'
import { ensureProductListPages } from '../src/domain/productListPages'
import { cloneCompatibility, compatibilityImportProblems, declarationDraft, previewCompatibilityChanges, previewMaterialCopy, type CompatibilityChange, type DeclarationDraft } from '../src/domain/accessoryCompatibilityCommands'
import { compatibilitySkuBlock, compatibilityModelBlock, linksOfHost } from '../src/domain/compatibility'
import { deviceSourceStamp, listDeviceModels, resolveDeviceSku } from '../src/domain/deviceResolution'
import { queryDeviceAccessories } from '../src/domain/accessoryCompatibilityQuery'
import { DATA_VERSION, STORAGE_KEY, type AppData, type ProductFamily } from '../src/domain/types'
import { catalogMigrationError, normalizeStored, useCatalogStore } from '../src/stores/catalog'

const output = resolve(process.env.ACCESSORY_STATE_OUTPUT_DIR || 'work/accessory-compatibility/state')
mkdirSync(output, { recursive: true })
const fixed = '2026-10-23T04:00:00.000Z', epoch = Date.parse(fixed), NativeDate = Date
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
globalThis.Date = class extends NativeDate { constructor(value?: string | number) { super(value === undefined ? epoch : value) } static now() { return epoch } } as DateConstructor
const disk = new Map<string, string>(), records: { name: string; result: 'PASS'; detail: string }[] = []
let failNext = false, attempts = 0, writes = 0
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => disk.get(key) ?? null,
  setItem: (key: string, value: string) => { attempts++; if (failNext) { failNext = false; throw new DOMException('Accessory check actual storage quota', 'QuotaExceededError') }; writes++; disk.set(key, String(value)) },
  removeItem: (key: string) => disk.delete(key), clear: () => disk.clear(),
} })
let active: ReturnType<typeof useCatalogStore> | undefined
const mark = (name: string, detail: string) => { records.push({ name, result: 'PASS', detail }); console.log(`PASS accessory state ${name}: ${detail}`) }
const stored = () => disk.get(STORAGE_KEY)
function mount(data?: AppData) {
  active?.$dispose()
  if (data) disk.set(STORAGE_KEY, JSON.stringify({ version: DATA_VERSION, data }))
  setActivePinia(createPinia())
  active = useCatalogStore()
  return active
}
function fixture(): AppData {
  const data = createSeed(), categoryId = data.categories[0]?.id || '', templateId = data.templates[0]?.id || ''
  data.activeRole = 'admin'
  data.productTypes.push(
    { id: 'state-host-type', name: '独立测试设备类型', catalogRole: 'host', categoryId, status: 'enabled', sort: 900, description: '隔离测试，不是真实商品' },
    { id: 'state-independent-type', name: '独立测试无商品类型', catalogRole: 'host', categoryId, status: 'enabled', sort: 902, description: '只有独立型号的删除保护夹具' },
    { id: 'state-accessory-type', name: '独立测试配件类型', catalogRole: 'accessory', categoryId, status: 'enabled', sort: 901, description: '隔离测试' },
  )
  const family = (id: string, productTypeId: string): ProductFamily => ({ id, name: `【隔离测试】${id}`, templateId, productTypeId, categoryId, oaProductId: '', commonAttrs: {}, productGroupIds: [], lifecycle: 'ready', shelfStatus: 'online', line: 'v2', origin: 'created', createdAt: fixed, updatedAt: fixed })
  data.families.push(family('state-device-spu', 'state-host-type'), family('state-accessory-spu', 'state-accessory-type'))
  for (const id of ['state-phone', 'state-sales-a', 'state-sales-b', 'state-sales-copy', 'state-material']) data.skus.push({ id, code: id, familyId: id === 'state-phone' ? 'state-device-spu' : 'state-accessory-spu', recordKind: id === 'state-material' ? 'material' : 'sku', ...(id === 'state-material' ? { materialCode: 'MAT-STATE-TEST' } : {}), skuName: `【隔离测试】${id}`, status: 'on_sale', oaSkuId: '', variantAttrs: {}, projectedAttrs: {}, createdAt: fixed, updatedAt: fixed })
  data.deviceModels = [{ id: 'state-model-a', name: '独立测试手机 A', productTypeId: 'state-host-type', attributes: {}, createdAt: fixed, updatedAt: fixed }, { id: 'state-model-b', name: '独立测试手机 B', productTypeId: 'state-host-type', attributes: {}, createdAt: fixed, updatedAt: fixed }, { id: 'state-foreign-model', name: '另一主机类型的独立测试型号', productTypeId: 'state-independent-type', attributes: {}, createdAt: fixed, updatedAt: fixed }]
  ensureProductListPages(data)
  const host = listDeviceModels(data).find(model => model.host.productModelId === 'device:state-model-a')?.host
  assert.ok(host)
  data.compatibilities.push({ id: 'state-legacy-material', accessorySkuId: 'state-material', host: cloneCompatibility(host), note: '原始物料备注', createdAt: fixed, updatedAt: fixed })
  return data
}
try {
  let store = mount(fixture())
  await nextTick(); await store.waitForPersistence()
  const host = listDeviceModels(store.data).find(model => model.host.productModelId === 'device:state-model-a')?.host
  const otherHost = listDeviceModels(store.data).find(model => model.host.productModelId === 'device:state-model-b')?.host
  assert.ok(host && otherHost)
  const legacy = cloneCompatibility(store.data.compatibilities.find(link => link.id === 'state-legacy-material'))
  assert.ok(legacy)
  const frozenBusiness = JSON.stringify([store.data.families, store.data.skus, store.data.planningRecords, store.data.specModelVersions, store.data.nodeCompatibilityRules, store.data.productListPages])
  const draft = (id: string): DeclarationDraft => ({ target: { kind: 'sku', id }, host: cloneCompatibility(host), conclusion: 'compatible', verification: 'confirmed', capability: 'basic', conditions: [], source: '独立夹具人工确认，不是真实商品测试', note: '' })
  const add: CompatibilityChange[] = [{ kind: 'add', draft: draft('state-sales-a') }]
  const initial = JSON.stringify(store.data), initialDisk = stored(), initialWrites = writes
  const preview = previewCompatibilityChanges(store.data, [add[0]!, add[0]!])
  assert.equal(preview.added, 1); assert.equal(preview.skipped, 1); assert.equal(preview.canCommit, true)
  const cancelledCopy = previewMaterialCopy(store.data, 'state-material', 'state-sales-copy')
  assert.equal(cancelledCopy.added, 1); assert.equal(cancelledCopy.canCommit, true)
  assert.equal(JSON.stringify(store.data), initial); assert.equal(stored(), initialDisk); assert.equal(writes, initialWrites)
  mark('preview-cancel-purity', 'real batch/copy previews allocate no identity and write no data')

  failNext = true
  const failed = (await store.commitCompatibilityChanges(add))
  await nextTick(); await store.waitForPersistence()
  assert.equal(failed.ok, false); assert.match(failed.message || '', /当前数据未改变.*草稿已保留/)
  assert.equal(JSON.stringify(store.data), initial); assert.equal(stored(), initialDisk); assert.equal(writes, initialWrites)
  const retry = (await store.commitCompatibilityChanges(add))
  await nextTick(); await store.waitForPersistence()
  assert.equal(retry.ok, true); assert.equal(writes - initialWrites, 1, 'One successful transaction must not trigger a second deep-watch write')
  const createdId = retry.createdIds?.[0]
  assert.ok(createdId)
  assert.equal(store.data.compatibilities.filter(link => link.targetId === 'state-sales-a').length, 1)
  const beforeDuplicate = writes
  assert.equal((await store.commitCompatibilityChanges(add)).preview?.skipped, 1)
  await nextTick(); await store.waitForPersistence(); assert.equal(writes, beforeDuplicate)
  mark('actual-storage-failure-retry-idempotency', 'next real setItem fails; memory/disk stay identical; retry commits once; duplicate commits zero times')

  const conflict: CompatibilityChange[] = [{ kind: 'add', draft: { ...draft('state-sales-a'), conclusion: 'incompatible' } }]
  const conflictPreview = previewCompatibilityChanges(store.data, conflict)
  assert.equal(conflictPreview.conflicts, 1); assert.equal(conflictPreview.canCommit, false)
  const beforeConflict = JSON.stringify(store.data), beforeConflictDisk = stored()
  assert.equal((await store.commitCompatibilityChanges([...add, ...conflict])).ok, false)
  assert.equal(JSON.stringify(store.data), beforeConflict); assert.equal(stored(), beforeConflictDisk)
  const edited = store.data.compatibilities.find(link => link.id === createdId)
  assert.ok(edited)
  assert.equal((await store.commitCompatibilityChanges([{ kind: 'edit', id: createdId, draft: { ...declarationDraft(edited), conclusion: 'incompatible', verification: 'pending', note: '明确编辑当前声明' } }])).ok, true)
  assert.equal(store.data.compatibilities.find(link => link.id === createdId)?.verification, 'pending')
  assert.equal(store.data.compatibilities.find(link => link.id === createdId)?.createdAt, fixed)
  assert.equal((await store.commitCompatibilityChanges([{ kind: 'add', draft: { ...draft('state-sales-b'), conclusion: 'conditional', conditions: [] } }])).ok, false)
  assert.equal((await store.commitCompatibilityChanges([{ kind: 'add', draft: { ...draft('state-sales-b'), target: { kind: 'material', id: 'state-sales-b' } } }])).ok, false)
  mark('conflict-edit-and-target-validation', 'opposite same-range claims do not overwrite; explicit edit preserves id/time; conditional-without-prerequisite and wrong SKU/MAT rejected')

  const copyPreview = previewMaterialCopy(store.data, 'state-material', 'state-sales-copy')
  const sourceBefore = cloneCompatibility(store.data.compatibilities.find(link => link.id === 'state-legacy-material'))
  assert.equal((await store.commitCompatibilityChanges(copyPreview.changes)).ok, true)
  const copied = store.data.compatibilities.find(link => link.targetId === 'state-sales-copy')
  assert.ok(copied?.provenance?.declarationSnapshot)
  assert.equal(copied.provenance.materialSnapshot?.code, 'MAT-STATE-TEST')
  assert.equal(copied.provenance.declarationId, 'state-legacy-material')
  const copiedSnapshot = cloneCompatibility(copied)
  assert.equal((await store.commitCompatibilityChanges([{ kind: 'edit', id: 'state-legacy-material', draft: { ...declarationDraft(legacy), note: '源物料后来明确编辑', conclusion: 'incompatible' } }])).ok, true)
  assert.deepEqual(store.data.compatibilities.find(link => link.id === copied.id), copiedSnapshot)
  assert.equal(copied.provenance.declarationSnapshot.note, sourceBefore?.note)
  assert.equal(previewMaterialCopy(store.data, 'state-material', 'state-sales-copy').conflicts, 1)
  assert.ok(compatibilitySkuBlock(store.data, 'state-sales-copy'))
  assert.ok(compatibilitySkuBlock(store.data, 'state-material'))
  assert.equal(linksOfHost(store.data, host).some(link => link.targetKind === 'sku'), false)
  mark('explicit-mat-copy-independent-history', 'copy preview selected MAT only, keeps source snapshot, later MAT changes do not alter sales declarations; deletion protection retains both identities')

  const beforeBinding = JSON.stringify(store.data), diskBeforeBinding = stored()
  const sourceStamp = deviceSourceStamp(store.data, 'state-phone')
  const foreignHost = listDeviceModels(store.data).find(model => model.host.productModelId === 'device:state-foreign-model')?.host
  assert.ok(foreignHost)
  assert.equal((await store.commitDeviceBinding({ skuId: 'state-phone', host: foreignHost, expectedSourceStamp: sourceStamp })).ok, false, 'Phone cannot be bound to a model of another host product type')
  assert.equal(JSON.stringify(store.data), beforeBinding); assert.equal(stored(), diskBeforeBinding)
  failNext = true
  assert.equal((await store.commitDeviceBinding({ skuId: 'state-phone', host, expectedSourceStamp: sourceStamp })).ok, false)
  assert.equal(JSON.stringify(store.data), beforeBinding); assert.equal(stored(), diskBeforeBinding)
  assert.equal((await store.commitDeviceBinding({ skuId: 'state-phone', host, expectedSourceStamp: sourceStamp })).ok, true)
  await nextTick(); await store.waitForPersistence()
  assert.equal(resolveDeviceSku(store.data, 'state-phone').status, 'resolved')
  assert.equal((await store.commitDeviceBinding({ skuId: 'state-phone', host: otherHost })).ok, false)
  assert.equal((await store.commitDeviceBinding({ skuId: 'state-phone', host: otherHost, replaceExisting: true, expectedSourceStamp: 'stale-source' })).ok, false)
  assert.equal((await store.commitDeviceBinding({ skuId: 'state-phone', host: otherHost, replaceExisting: true, expectedSourceStamp: sourceStamp })).ok, true)
  assert.equal(resolveDeviceSku(store.data, 'state-phone').host?.productModelId, otherHost.productModelId)
  assert.ok(compatibilitySkuBlock(store.data, 'state-phone'))
  assert.ok(compatibilityModelBlock(store.data, [otherHost.productModelId]))
  assert.equal((await store.removeDeviceModel('state-model-b')).ok, false)
  assert.equal((await store.clearDeviceBinding('state-phone')).ok, true)
  assert.equal((await store.commitDeviceBinding({ skuId: 'state-phone', host })).ok, true)
  mark('binding-confirm-source-and-protection', 'binding failure retains memory/disk; rebind requires acknowledgement/current source; model and SKU references protected')

  const noModel = JSON.stringify(store.data), noModelDisk = stored()
  failNext = true
  const input = { name: '【隔离测试】无 SKU 型号', productTypeId: 'state-independent-type', attributes: {} }
  assert.equal((await store.saveDeviceModel(input)).ok, false)
  assert.equal(JSON.stringify(store.data), noModel); assert.equal(stored(), noModelDisk)
  const modelSaved = (await store.saveDeviceModel(input))
  assert.equal(modelSaved.ok, true); assert.ok(modelSaved.id)
  assert.match(store.removeProductType('state-independent-type'), /不能删除/)
  const emptyHost = listDeviceModels(store.data).find(model => model.host.productModelId === `device:${modelSaved.id}`)?.host
  assert.ok(emptyHost)
  assert.equal((await store.commitCompatibilityChanges([{ kind: 'add', draft: { ...draft('state-sales-b'), host: emptyHost } }])).ok, true)
  assert.equal((await store.removeDeviceModel(modelSaved.id)).ok, false)
  mark('independent-device-no-material-required', 'can explicitly maintain a model and declaration without device MAT/SKU/planning; quota failure does not create model')

  await nextTick(); await store.waitForPersistence()
  const exported = store.exportJson(), businessBeforeImport = JSON.stringify([store.data.families, store.data.skus, store.data.planningRecords, store.data.specModelVersions, store.data.nodeCompatibilityRules, store.data.productListPages])
  assert.equal(businessBeforeImport, frozenBusiness)
  const beforeImport = JSON.stringify(store.data), beforeImportDisk = stored()
  const imported = JSON.parse(exported) as { version: number; data: AppData }
  imported.data.compatibilities.find(link => link.id === createdId)!.note = '导入明确变更'
  failNext = true
  await assert.rejects(async () => (await store.importJson(JSON.stringify(imported))), /当前数据和原存储未改变/)
  assert.equal(JSON.stringify(store.data), beforeImport); assert.equal(stored(), beforeImportDisk)
  ;(await store.importJson(JSON.stringify(imported))); await nextTick(); await store.waitForPersistence()
  const importedAfter = JSON.stringify(store.data)
  ;(await store.importJson(JSON.stringify(imported))); await nextTick(); await store.waitForPersistence()
  assert.equal(JSON.stringify(store.data), importedAfter)
  assert.equal(store.data.compatibilities.filter(link => link.id === createdId).length, 1)
  const reordered = JSON.parse(store.exportJson()) as { version: number; data: AppData }
  reordered.data = Object.fromEntries(Object.entries(reordered.data).reverse()) as unknown as AppData
  const writesBeforeReorderedImport = writes
  ;(await store.importJson(JSON.stringify(reordered))); await nextTick(); await store.waitForPersistence()
  assert.equal(writes - writesBeforeReorderedImport, 1, 'Import with a different property order must not write twice through the deep watcher')
  assert.deepEqual(JSON.parse(stored() || '{}').data, cloneCompatibility(store.data), 'Successful import keeps every persisted field equal to live data independent of object-key order')
  store = mount(); await nextTick(); await store.waitForPersistence()
  assert.equal(resolveDeviceSku(store.data, 'state-phone').status, 'resolved')
  assert.equal(store.data.compatibilities.find(link => link.targetId === 'state-sales-copy')?.provenance?.declarationSnapshot?.note, '原始物料备注')
  assert.equal(store.data.compatibilities.find(link => link.id === createdId)?.note, '导入明确变更')
  assert.equal(compatibilityImportProblems(store.data).length, 0)
  mark('export-import-refresh-atomic', 'new bindings/statements/source snapshots survive real serialization and reload; failed import preserves original bytes; repeat import does not add relations')

  const invalidImport = JSON.parse(store.exportJson()) as { version: number; data: AppData }
  invalidImport.data.compatibilities.find(link => link.targetId === 'state-sales-copy')!.targetKind = 'material'
  const validDisk = stored(), validMemory = JSON.stringify(store.data)
  await assert.rejects(async () => (await store.importJson(JSON.stringify(invalidImport))), /类型不符/)
  assert.equal(stored(), validDisk); assert.equal(JSON.stringify(store.data), validMemory)
  const dangling = JSON.parse(store.exportJson()) as { version: number; data: AppData }
  dangling.data.skus = dangling.data.skus.filter(sku => sku.id !== 'state-sales-copy')
  ;(await store.importJson(JSON.stringify(dangling))); await nextTick(); await store.waitForPersistence()
  assert.ok(store.data.compatibilities.some(link => link.id === copied.id))
  assert.ok(queryDeviceAccessories(store.data, 'state-phone').issues.some(issue => issue.declarationId === copied.id))
  const old = fixture(), originalLegacy = cloneCompatibility(old.compatibilities)
  delete old.deviceBindings
  const normalized = normalizeStored({ version: DATA_VERSION, data: old })
  assert.ok(normalized)
  assert.deepEqual(normalized.compatibilities, originalLegacy)
  assert.deepEqual(normalizeStored({ version: DATA_VERSION, data: cloneCompatibility(normalized) }), normalized)
  mark('legacy-import-and-dangling-reference', 'old MAT records retain exact id/range/note/time; repeated normalization stable; dangling declaration retained as issue; wrong object kind rejected before write')

  store = mount(fixture()); await nextTick(); await store.waitForPersistence()
  store.data.activeRole = 'operator'; await nextTick(); await store.waitForPersistence()
  const readOnlyBefore = JSON.stringify(store.data), readOnlyDisk = stored(), readOnlyWrites = writes
  assert.equal((await store.commitCompatibilityChanges(add)).ok, false)
  assert.equal((await store.commitDeviceBinding({ skuId: 'state-phone', host })).ok, false)
  assert.equal((await store.clearDeviceBinding('state-phone')).ok, false)
  assert.equal((await store.saveDeviceModel(input)).ok, false)
  assert.equal((await store.removeDeviceModel('state-model-a')).ok, false)
  const readOnlyImport = JSON.parse(store.exportJson()) as { version: number; data: AppData }
  readOnlyImport.data.compatibilities[0]!.note = '运营角色不应通过导入维护关系'
  await assert.rejects(async () => (await store.importJson(JSON.stringify(readOnlyImport))), /不能通过导入修改/)
  assert.equal(JSON.stringify(store.data), readOnlyBefore); assert.equal(stored(), readOnlyDisk); assert.equal(writes, readOnlyWrites)
  mark('maintenance-permission-at-store-boundary', 'operator may query but all five maintenance commands reject without writes')

  // Loading readable historical data must not replace it with seed if a later
  // compatibility/category migration persistence step hits storage quota.
  const historical = fixture()
  disk.set(STORAGE_KEY, JSON.stringify({ version: 14, data: historical }))
  failNext = true
  store = mount(); await nextTick(); await store.waitForPersistence()
  assert.ok(store.data.skus.some(sku => sku.id === 'state-material'))
  assert.ok(store.data.compatibilities.some(link => link.id === 'state-legacy-material'))
  assert.match(catalogMigrationError(), /无法写入本机/)
  mark('migration-storage-failure-retains-history', 'readable V14 history remains in memory with explicit failure message; original disk is not cleared or seeded')

  for (const damaged of [
    { name: 'invalid-json', raw: '{this is not valid JSON' },
    { name: 'empty-existing-payload', raw: '' },
    { name: 'missing-base-array', raw: JSON.stringify({ version: DATA_VERSION, data: { ...fixture(), families: undefined } }) },
    { name: 'unsupported-version', raw: JSON.stringify({ version: DATA_VERSION + 1, data: fixture() }) },
  ]) {
    disk.set(STORAGE_KEY, damaged.raw)
    const beforeAttempts = attempts, beforeWrites = writes
    assert.throws(() => mount(), /原始存储已保留，未使用演示数据替换/, `${damaged.name} must stop loading rather than return seed data`)
    assert.equal(stored(), damaged.raw, `${damaged.name} must preserve exact original bytes`)
    assert.equal(attempts, beforeAttempts, `${damaged.name} must make no storage attempt`)
    assert.equal(writes, beforeWrites)
  }
  mark('unreadable-existing-storage-never-seeds', 'bad JSON, existing empty payload, missing base array and unsupported version throw a recoverable error; original disk bytes remain, zero writes')

  writeFileSync(resolve(output, 'result.json'), JSON.stringify({ result: 'PASS', environment: { node: process.version, fixedTime: fixed, dataVersion: DATA_VERSION }, checks: records, attempts, writes }, null, 2))
} catch (error) {
  writeFileSync(resolve(output, 'failure.json'), JSON.stringify({ result: 'FAIL', error: String(error), checks: records, attempts, writes }, null, 2))
  throw error
} finally {
  active?.$dispose()
  globalThis.Date = NativeDate
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
  else Reflect.deleteProperty(globalThis, 'localStorage')
}
