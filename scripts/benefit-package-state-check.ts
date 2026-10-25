import {RBAC_ENFORCEMENT_ENABLED} from '../src/domain/accessMode'
import assert from 'node:assert/strict'
import { installCatalogTestLocks } from './catalog-storage-test-env'
const restoreTestLocks = installCatalogTestLocks()
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { createAccessoryCompatibilityFixture } from './accessory-compatibility-fixtures'
import { addBenefitSku, benefitPackageImportProblems, cloneBenefit, copyBenefitPackageDraft, newBenefitPackageDraft, previewBenefitDelivery, reviewBenefitQuote, validateBenefitPackage } from '../src/domain/benefitPackages'
import type { BenefitPackageDraft } from '../src/domain/benefitPackageTypes'
import { ensureProductListPages } from '../src/domain/productListPages'
import { DATA_VERSION, STORAGE_KEY, type AppData } from '../src/domain/types'
import { normalizeStored, useCatalogStore } from '../src/stores/catalog'

const output = resolve(process.env.BENEFIT_STATE_OUTPUT_DIR || 'work/benefit-package/state')
mkdirSync(output, { recursive: true })
const fixed = '2026-10-23T04:00:00.000Z', epoch = Date.parse(fixed), NativeDate = Date
const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
globalThis.Date = class extends NativeDate { constructor(value?: string | number) { super(value === undefined ? epoch : value) } static now() { return epoch } } as DateConstructor
const disk = new Map<string, string>(), checks: { name: string; result: 'PASS'; detail: string }[] = []
let failNext = false, writes = 0, attempts = 0, active: ReturnType<typeof useCatalogStore> | undefined
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => disk.get(key) ?? null,
  setItem: (key: string, value: string) => { attempts++; if (failNext) { failNext = false; throw new DOMException('Independent benefit check quota failure', 'QuotaExceededError') } writes++; disk.set(key, String(value)) },
  removeItem: (key: string) => disk.delete(key), clear: () => disk.clear(),
} })
const stored = () => disk.get(STORAGE_KEY)
const mark = (name: string, detail: string) => { checks.push({ name, result: 'PASS', detail }); console.log(`PASS benefit state ${name}: ${detail}`) }
function fixture() { const { data } = createAccessoryCompatibilityFixture(); ensureProductListPages(data); return data }
function mount(data?: AppData) {
  active?.$dispose()
  if (data) disk.set(STORAGE_KEY, JSON.stringify({ version: DATA_VERSION, data }))
  setActivePinia(createPinia()); active = useCatalogStore(); return active
}
function business(data: AppData) { return JSON.stringify([data.families, data.skus, data.productSpecNodes, data.specModelVersions, data.planningRecords, data.materialReceipts, data.nodeCompatibilityRules, data.compatibilities, data.deviceBindings, data.deviceModels, data.productListPages]) }
function draft(data: AppData): BenefitPackageDraft {
  let result = newBenefitPackageDraft({ kind: 'sku', skuId: 'phone-a' })
  result.name = '【隔离测试】权益包存储校验'
  result = addBenefitSku(data, result, 'case-sku', 2)
  result.services = [{ id: 'service-per-package', name: '【隔离测试】贴膜约定', quantity: 1, unit: '次', measurement: 'per-package', validity: '3 个月内预约，不代表已激活', description: '独立测试服务' }, { id: 'service-per-delivery', name: '【隔离测试】本次上门', quantity: 1, unit: '次', measurement: 'per-delivery', validity: '', description: '整次交付一次' }]
  result.rulesEnabled = true
  result.groups = [{ id: 'group-case', name: '【隔离测试】保护壳选配', enabled: true, candidateSkuIds: ['case-sku'], required: true, minKinds: 1, maxKinds: 1, defaultQuantity: 2, adjustable: true, minQuantity: 1, maxQuantity: 10 }]
  result.quote.amountCents = 0
  return reviewBenefitQuote(result)
}
try {
  let store = mount(fixture()); await nextTick(); await active?.waitForPersistence()
  const input = draft(store.data), frozenInput = cloneBenefit(input), frozenBusiness = business(store.data), initial = JSON.stringify(store.data), initialDisk = stored(), initialWrites = writes
  assert.equal(validateBenefitPackage(store.data, input).canSaveAvailable, true)
  assert.equal(previewBenefitDelivery(store.data, input, 3).canConfirm, false)
  assert.deepEqual(input, frozenInput); assert.equal(JSON.stringify(store.data), initial); assert.equal(stored(), initialDisk); assert.equal(writes, initialWrites)
  mark('preview-and-validation-are-readonly', 'unsaved preview has no formal identity, configuration or storage writes')

  failNext = true
  const failed = (await store.saveBenefitPackage({ draft: input, status: 'available', requestId: 'save-request-first' }))
  await nextTick(); await active?.waitForPersistence()
  assert.equal(failed.ok, false); assert.match(failed.message || '', /草稿.*请求保留.*重试/)
  assert.equal(JSON.stringify(store.data), initial); assert.equal(stored(), initialDisk); assert.deepEqual(input, frozenInput); assert.equal(writes, initialWrites)
  const saved = (await store.saveBenefitPackage({ draft: input, status: 'available', requestId: 'save-request-first' }))
  await nextTick(); await active?.waitForPersistence(); assert.equal(saved.ok, true); assert.ok(saved.package)
  assert.equal(saved.package.code, 'BPK-000001'); assert.equal(saved.package.revision, 1); assert.equal(writes - initialWrites, 1)
  assert.equal(saved.package.includedPhoneSkuId, ''); assert.equal(saved.package.goods.some(line => line.skuId === 'phone-a'), false)
  const originalSaved = cloneBenefit(saved.package), duplicateWrites = writes
  const duplicate = (await store.saveBenefitPackage({ draft: input, status: 'available', requestId: 'save-request-first' }))
  await nextTick(); await active?.waitForPersistence(); assert.equal(duplicate.id, saved.id); assert.equal(store.data.benefitPackages?.length, 1); assert.equal(writes, duplicateWrites)
  assert.equal(business(store.data), frozenBusiness)
  mark('save-quota-retry-once-and-new-request-idempotency', 'failure retains exact memory/disk/draft; retry gets BPK-000001 and one write; duplicate returns original without second write')

  const invalid = cloneBenefit(input); invalid.goods[0]!.quantity = Number.NaN
  const beforeInvalid = stored()
  assert.equal((await store.saveBenefitPackage({ draft: invalid, status: 'draft', requestId: 'invalid-number' })).ok, false)
  assert.equal(Number.isNaN(invalid.goods[0]!.quantity), true); assert.equal(stored(), beforeInvalid)
  const incomplete = newBenefitPackageDraft(), draftSave = (await store.saveBenefitPackage({ draft: incomplete, status: 'draft', requestId: 'save-incomplete' }))
  await nextTick(); await active?.waitForPersistence(); assert.equal(draftSave.ok, true); assert.ok(draftSave.package?.issues.length)
  const blockedAvailable = (await store.saveBenefitPackage({ draft: incomplete, status: 'available', requestId: 'cannot-use-incomplete' }))
  assert.equal(blockedAvailable.ok, false)
  mark('draft-allows-incomplete-but-not-invalid-numbers', 'missing name/content persists as explicit draft issues; invalid numeric input is rejected without coercion')

  const stale = cloneBenefit(originalSaved), beforeFavorite = JSON.stringify(store.data), favoriteDisk = stored()
  failNext = true
  assert.equal((await store.setBenefitPackageFavorite(originalSaved.id, true, originalSaved.revision)).ok, false)
  await nextTick(); await active?.waitForPersistence(); assert.equal(JSON.stringify(store.data), beforeFavorite); assert.equal(stored(), favoriteDisk)
  const favorite = (await store.setBenefitPackageFavorite(originalSaved.id, true, originalSaved.revision))
  await nextTick(); await active?.waitForPersistence(); assert.ok(favorite.package); assert.equal(favorite.package.revision, 2)
  const latest = cloneBenefit(favorite.package), staleDisk = stored()
  stale.name = '过期编辑不能覆盖'
  assert.equal((await store.saveBenefitPackage({ draft: stale, status: 'available', expectedRevision: 1, requestId: 'save-stale' })).ok, false)
  assert.equal((await store.setBenefitPackageStatus(stale.id, 'disabled', 1)).ok, false); assert.equal(stored(), staleDisk)
  mark('favorite-failure-and-optimistic-revision', 'favorite transaction retries; outdated page save/status cannot overwrite newer package')

  const preview = previewBenefitDelivery(store.data, latest, 3)
  assert.equal(preview.canConfirm, true); assert.equal(preview.goods[0]?.perPackageQuantity, 2); assert.equal(preview.goods[0]?.totalQuantity, 6)
  assert.deepEqual(preview.services.map(service => [service.totalQuantity, service.validity]), [[3, '3 个月内预约，不代表已激活'], [1, '']])
  assert.equal(preview.quote.amountCents, 0); assert.equal(preview.quote.totalCents, 0)
  const generate = { packageId: latest.id, expectedRevision: latest.revision, packageCount: 3, expectedBasis: preview.basis, requestId: 'delivery-request-first' }
  const beforeGenerate = JSON.stringify(store.data), beforeGenerateDisk = stored(), beforeGenerateWrites = writes
  failNext = true
  assert.equal((await store.generateBenefitDelivery(generate)).ok, false)
  await nextTick(); await active?.waitForPersistence(); assert.equal(JSON.stringify(store.data), beforeGenerate); assert.equal(stored(), beforeGenerateDisk)
  const confirmed = (await store.generateBenefitDelivery(generate))
  await nextTick(); await active?.waitForPersistence(); assert.equal(confirmed.ok, true); assert.ok(confirmed.delivery)
  assert.equal(confirmed.delivery.code, 'BDL-000001'); assert.equal(writes - beforeGenerateWrites, 1)
  const snapshot = cloneBenefit(confirmed.delivery), duplicateDeliveryWrites = writes
  const repeated = (await store.generateBenefitDelivery({ ...generate, packageCount: 99 }))
  await nextTick(); await active?.waitForPersistence(); assert.deepEqual(repeated.delivery, snapshot); assert.equal(writes, duplicateDeliveryWrites); assert.equal(store.data.benefitDeliveries?.length, 1)
  confirmed.delivery.goods[0]!.name = '返回值修改不得改存储'
  assert.deepEqual(store.data.benefitDeliveries?.[0], snapshot)
  assert.equal(business(store.data), frozenBusiness)
  mark('delivery-counts-quota-retry-and-request-idempotency', 'per-package goods/service multiply, per-delivery service stays once, 0 quote remains 0; failure consumes no BDL number; repeat request returns exact independent snapshot')

  const stalePreview = previewBenefitDelivery(store.data, latest, 2)
  const caseSku = store.data.skus.find(sku => sku.id === 'case-sku'); assert.ok(caseSku)
  caseSku.skuName = '【隔离测试】稍后改名'
  await nextTick(); await active?.waitForPersistence()
  const beforeStaleGenerate = stored()
  assert.equal((await store.generateBenefitDelivery({ ...generate, packageCount: 2, expectedBasis: stalePreview.basis, requestId: 'stale-live-facts' })).ok, false)
  await nextTick(); await active?.waitForPersistence(); assert.equal(stored(), beforeStaleGenerate); assert.deepEqual(store.data.benefitDeliveries?.[0], snapshot)
  const edited = cloneBenefit(latest); edited.goods[0]!.quantity = 4; edited.services[0]!.description = '后来修改服务约定'; edited.quote.amountCents = 12345
  const editSave = (await store.saveBenefitPackage({ draft: edited, status: 'available', expectedRevision: latest.revision, requestId: 'edit-after-delivery' }))
  await nextTick(); await active?.waitForPersistence(); assert.ok(editSave.package); assert.equal(editSave.package.goods[0]?.snapshot.name, caseSku.skuName)
  assert.equal(validateBenefitPackage(store.data, editSave.package).quoteNeedsReview, true)
  assert.deepEqual(store.data.benefitDeliveries?.[0], snapshot)
  const disabled = (await store.setBenefitPackageStatus(editSave.package.id, 'disabled', editSave.package.revision))
  await nextTick(); await active?.waitForPersistence(); assert.equal(disabled.ok, true)
  assert.equal((await store.generateBenefitDelivery({ ...generate, expectedRevision: disabled.package?.revision || 0, requestId: 'new-disabled' })).ok, false)
  assert.deepEqual((await store.generateBenefitDelivery(generate)).delivery, snapshot)
  mark('stale-live-preview-and-history-independence', 'source rename invalidates preview; saved SKU/service/quote and package disable do not rewrite old snapshot; disabled blocks new delivery')

  const copy = copyBenefitPackageDraft(editSave.package)
  assert.equal(copy.id, ''); assert.equal(copy.code, ''); assert.equal(copy.creationRequestId, undefined); assert.deepEqual(copy.confirmations, [])
  copy.goods[0]!.quantity = 7; copy.services[0]!.name = '【隔离测试】副本服务'
  const copied = (await store.saveBenefitPackage({ draft: copy, status: 'draft', requestId: 'save-copy' }))
  await nextTick(); await active?.waitForPersistence(); assert.ok(copied.package); assert.notEqual(copied.package.id, editSave.package.id)
  assert.equal(store.data.benefitPackages?.find(item => item.id === editSave.package?.id)?.goods[0]?.quantity, 4)
  assert.equal(store.data.benefitDeliveries?.length, 1)
  assert.match(store.removeSku('case-sku'), /权益包.*权益包管理/)
  assert.match(store.removeSku('phone-a'), /权益包/)
  const modelDraft = newBenefitPackageDraft({ kind: 'model', host: cloneBenefit(snapshot.device?.kind === 'model' ? snapshot.device.host : createAccessoryCompatibilityFixture().hosts.a) })
  modelDraft.name = '【隔离测试】仅型号上下文'; modelDraft.services = [{ id: 'service-model-only', name: '【隔离测试】服务', quantity: 1, unit: '项', measurement: 'per-package', validity: '', description: '' }]
  assert.equal((await store.saveBenefitPackage({ draft: modelDraft, status: 'available', requestId: 'save-model-context' })).ok, true)
  await nextTick(); await active?.waitForPersistence()
  assert.match((await store.removeDeviceModel('model-a')).message || '', /权益包/)
  mark('copy-deep-independence-and-current-reference-protection', 'new package identity/no inherited request/history/confirmation; configurations protect goods, device and standalone model with management guidance')

  const beforeImportPackages = cloneBenefit(store.data.benefitPackages), beforeImportDeliveries = cloneBenefit(store.data.benefitDeliveries)
  const exported = JSON.parse(store.exportJson()) as { version: number; data: AppData }
  exported.data = Object.fromEntries(Object.entries(exported.data).reverse()) as unknown as AppData
  const importWrites = writes
  ;(await store.importJson(JSON.stringify(exported))); await nextTick(); await active?.waitForPersistence()
  assert.equal(writes - importWrites, 1, 'Successful import with different root key order has one actual storage write')
  ;(await store.importJson(JSON.stringify(exported))); await nextTick(); await active?.waitForPersistence()
  assert.deepEqual(store.data.benefitPackages, beforeImportPackages); assert.deepEqual(store.data.benefitDeliveries, beforeImportDeliveries)
  store = mount(); await nextTick(); await active?.waitForPersistence()
  assert.deepEqual(store.data.benefitPackages, beforeImportPackages); assert.deepEqual(store.data.benefitDeliveries, beforeImportDeliveries)
  const beforeImportFailure = JSON.stringify(store.data), beforeImportFailureDisk = stored()
  failNext = true; await assert.rejects(async () => (await store.importJson(JSON.stringify(exported))), /无法写入本机/)
  await nextTick(); await active?.waitForPersistence(); assert.equal(JSON.stringify(store.data), beforeImportFailure); assert.equal(stored(), beforeImportFailureDisk)
  const malformed = cloneBenefit(exported); malformed.data.benefitDeliveries![0]!.goods[0]!.totalQuantity = 999
  await assert.rejects(async () => (await store.importJson(JSON.stringify(malformed))), /权益包导入校验失败/)
  assert.equal(stored(), beforeImportFailureDisk)
  mark('real-json-roundtrip-refresh-and-import-failure', 'all config/services/rules/quote/receipts/snapshots survive export/import/reload; key-order import commits once; invalid totals and quota keep originals')

  const historicalOnly = cloneBenefit(exported.data)
  historicalOnly.benefitPackages = []
  historicalOnly.compatibilities = historicalOnly.compatibilities.filter(link => (link.targetId || link.accessorySkuId) !== 'case-sku')
  store = mount(historicalOnly); await nextTick(); await active?.waitForPersistence()
  const historyBeforeRemoval = cloneBenefit(store.data.benefitDeliveries)
  assert.equal(store.removeSku('case-sku'), '')
  await nextTick(); await active?.waitForPersistence(); assert.equal(store.data.skus.some(sku => sku.id === 'case-sku'), false)
  assert.deepEqual(store.data.benefitDeliveries, historyBeforeRemoval)
  assert.equal(store.data.benefitDeliveries?.[0]?.goods[0]?.name, snapshot.goods[0]?.name)
  mark('history-only-references-are-independent', 'historical snapshots remain readable after source deletion; only current configuration references block deletion')

  const dangling = cloneBenefit(exported), danglingPackage = dangling.data.benefitPackages?.[0]; assert.ok(danglingPackage)
  danglingPackage.goods[0]!.skuId = 'lost-sale-record'
  danglingPackage.goods[0]!.snapshot.skuId = 'lost-sale-record'
  ;(await store.importJson(JSON.stringify(dangling))); await nextTick(); await active?.waitForPersistence()
  const loadedDangling = store.data.benefitPackages?.[0]; assert.ok(loadedDangling)
  assert.equal(loadedDangling.goods[0]?.snapshot.name, beforeImportPackages?.[0]?.goods[0]?.snapshot.name)
  assert.equal(validateBenefitPackage(store.data, loadedDangling).canDeliver, false)
  assert.deepEqual(store.data.benefitDeliveries, beforeImportDeliveries)
  const old = fixture(), oldBusiness = (value:AppData) => ({...value,rbac:undefined,users:value.users.map(({roleIds:_,...user})=>user)}),oldBytes=JSON.stringify(oldBusiness(old))
  const normalized = normalizeStored({ version: DATA_VERSION, data: cloneBenefit(old) }, { persist: false })
  assert.ok(normalized); assert.equal(JSON.stringify(oldBusiness(normalized)), oldBytes);assert.equal(normalized.benefitPackages,undefined);assert.equal(normalized.benefitDeliveries,undefined);assert(normalized.rbac&&normalized.users.every(user=>Array.isArray(user.roleIds)))
  const normalizedAgain = normalizeStored({ version: DATA_VERSION, data: cloneBenefit(normalized) }, { persist: false })
  assert.deepEqual(normalizedAgain, normalized)
  const broken = fixture(); Object.assign(broken, { benefitPackages: {} })
  disk.set(STORAGE_KEY, JSON.stringify({ version: DATA_VERSION, data: broken })); const brokenBytes = stored(), brokenWrites = writes
  assert.throws(() => mount(), /原始存储已保留/); assert.equal(stored(), brokenBytes); assert.equal(writes, brokenWrites)
  mark('old-data-idempotence-dangling-config-and-no-seed-recovery', 'missing optional collections require no migration/write; dangling configs retain summaries; malformed existing new fields retain bytes without seed')

  store = mount(cloneBenefit(exported.data)); await nextTick(); await active?.waitForPersistence()
  assert(store.startPermissionPreview('u-op').ok); await nextTick(); await active?.waitForPersistence()
  const readonlyMemory = JSON.stringify(store.data), readonlyDisk = stored(), readonlyWrites = writes
  const rejectCommand=async(operation:()=>unknown)=>{let denied=false;try{const result=await operation();denied=(result as {ok?:boolean})?.ok===false}catch(error){denied=error instanceof Error};assert(denied)}
  if(RBAC_ENFORCEMENT_ENABLED){
    await rejectCommand(()=>store.saveBenefitPackage({draft:input,status:'draft',requestId:'readonly-save'}))
    await rejectCommand(()=>store.setBenefitPackageFavorite(originalSaved.id,false,1))
    await rejectCommand(()=>store.setBenefitPackageStatus(originalSaved.id,'disabled',1))
    await rejectCommand(()=>store.generateBenefitDelivery(generate))
    const forbiddenImport={version:DATA_VERSION,data:cloneBenefit(store.data)};forbiddenImport.data.benefitPackages![0]!.name='越权更名'
    await assert.rejects(async()=>store.importJson(JSON.stringify(forbiddenImport)),/未授权|导入.*拒绝|无权/)
    await nextTick();await active?.waitForPersistence();assert.equal(JSON.stringify(store.data),readonlyMemory);assert.equal(stored(),readonlyDisk);assert.equal(writes,readonlyWrites)
    mark('permission-at-write-and-import-boundary','strict readonly caller cannot save/status/favorite/generate/import; exact memory and disk retained with zero writes')
  }else{
    assert.equal(store.can('product:benefit:create'),true)
    assert((await store.saveBenefitPackage({draft:input,status:'draft',requestId:'unrestricted-save'})).ok)
    let current=store.data.benefitPackages!.find(p=>p.id===originalSaved.id)!;assert((await store.setBenefitPackageFavorite(current.id,!current.favorite,current.revision)).ok)
    current=store.data.benefitPackages!.find(p=>p.id===originalSaved.id)!;assert((await store.setBenefitPackageStatus(current.id,'disabled',current.revision)).ok)
    assert((await store.generateBenefitDelivery(generate)).ok)
    const permittedImport=JSON.parse(store.exportJson()) as {version:number;data:AppData};permittedImport.data.benefitPackages![0]!.name='统一管理模式导入名称';await store.importJson(JSON.stringify(permittedImport));assert.equal(store.data.benefitPackages![0]!.name,'统一管理模式导入名称')
    assert.deepEqual(store.data.benefitDeliveries,JSON.parse(readonlyMemory).benefitDeliveries)
    mark('permission-at-write-and-import-boundary','default unified mode permits actual save/favorite/status/import and receipt retry; historical deliveries remain unchanged')
  }

  const collisionData = fixture(), p1 = cloneBenefit(originalSaved), p2 = cloneBenefit(originalSaved), d1 = cloneBenefit(snapshot), d2 = cloneBenefit(snapshot)
  Object.assign(p1, { id: 'imported-package-100', code: 'BPK-000100', creationRequestId: 'import-package-100', revision: Number.MAX_SAFE_INTEGER })
  Object.assign(p2, { id: 'benefit-package-000101', code: 'BPK-000090', creationRequestId: 'import-package-101' })
  Object.assign(d1, { id: 'imported-delivery-100', code: 'BDL-000100', requestId: 'import-delivery-100' })
  Object.assign(d2, { id: 'benefit-delivery-000101', code: 'BDL-000090', requestId: 'import-delivery-101' })
  collisionData.benefitPackages = [p1, p2]; collisionData.benefitDeliveries = [d1, d2]
  assert.deepEqual(benefitPackageImportProblems(collisionData), [])
  store = mount(collisionData); await nextTick(); await active?.waitForPersistence()
  const overflowMemory = JSON.stringify(store.data), overflowDisk = stored(), overflowWrites = writes
  assert.equal((await store.saveBenefitPackage({ draft: p1, status: 'available', expectedRevision: p1.revision, requestId: 'overflow-save' })).ok, false)
  assert.equal((await store.setBenefitPackageFavorite(p1.id, true, p1.revision)).ok, false)
  assert.equal((await store.setBenefitPackageStatus(p1.id, 'disabled', p1.revision)).ok, false)
  await nextTick(); await active?.waitForPersistence(); assert.equal(JSON.stringify(store.data), overflowMemory); assert.equal(stored(), overflowDisk); assert.equal(writes, overflowWrites)
  const collisionSaved = (await store.saveBenefitPackage({ draft: draft(store.data), status: 'available', requestId: 'after-import-identity' })); await nextTick(); await active?.waitForPersistence(); assert.ok(collisionSaved.package)
  assert.equal(collisionSaved.package.code, 'BPK-000102'); assert.equal(collisionSaved.package.id, 'benefit-package-000102')
  const collisionPreview = previewBenefitDelivery(store.data, collisionSaved.package, 1)
  const collisionDelivery = (await store.generateBenefitDelivery({ packageId: collisionSaved.package.id, expectedRevision: collisionSaved.package.revision, expectedBasis: collisionPreview.basis, packageCount: 1, requestId: 'after-import-delivery-identity' }))
  await nextTick(); await active?.waitForPersistence(); assert.ok(collisionDelivery.delivery); assert.equal(collisionDelivery.delivery.code, 'BDL-000102'); assert.equal(collisionDelivery.delivery.id, 'benefit-delivery-000102')
  mark('separate-number-spaces-import-collision-avoidance', 'BPK/BDL allocate above imported maxima and skip used IDs even under fixed time; no PLN/MAT numbers allocated')

  writeFileSync(resolve(output, 'result.json'), JSON.stringify({ result: 'PASS', environment: { fixedTime: fixed, node: process.version, dataVersion: DATA_VERSION }, checks, attempts, writes }, null, 2) + '\n')
  console.log(`PASS ${checks.length} benefit package state groups`)
} catch (error) {
  writeFileSync(resolve(output, 'failure.json'), JSON.stringify({ result: 'FAIL', error: String(error), checks, attempts, writes }, null, 2) + '\n')
  throw error
} finally {
  active?.$dispose(); restoreTestLocks(); globalThis.Date = NativeDate
  if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage)
  else Reflect.deleteProperty(globalThis, 'localStorage')
}
