import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { createPinia, setActivePinia } from 'pinia'
import { installCatalogTestLocks } from './catalog-storage-test-env'
import { createFreeCombinationFixture } from './free-combination-fixture'
import { addBenefitSku, cloneBenefit, copyBenefitPackageDraft, previewBenefitDelivery, reviewBenefitQuote, setBenefitPositionPrice, validateBenefitPackage } from '../src/domain/benefitPackages'
import { buildBenefitDeliveryWorkbook } from '../src/domain/benefitPackageExport'
import { RBAC_ENFORCEMENT_ENABLED } from '../src/domain/accessMode'
import { ensureRbac } from '../src/domain/rbac'
import { DATA_VERSION, STORAGE_KEY } from '../src/domain/types'
import type { BenefitPackageDraft, BenefitDeliverySnapshot } from '../src/domain/benefitPackageTypes'
import { normalizeStored, useCatalogStore } from '../src/stores/catalog'

const restoreLocks = installCatalogTestLocks(), disk = new Map<string, string>(), session = new Map<string, string>()
let store: ReturnType<typeof useCatalogStore> | undefined, writes = 0, failWrite = false, groups = 0
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => disk.get(key) ?? null, setItem: (key: string, value: string) => { if (key === STORAGE_KEY && failWrite) throw Error('free combination quota fixture'); disk.set(key, value); if (key === STORAGE_KEY) writes++ }, removeItem: (key: string) => disk.delete(key) } })
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: (key: string) => session.get(key) ?? null, setItem: (key: string, value: string) => session.set(key, value), removeItem: (key: string) => session.delete(key) } })
const fixture = () => {
  const f = createFreeCombinationFixture(); ensureRbac(f.data)
  for (const [id, permissionCodes] of [['free-read', ['product:benefit:read']], ['free-edit', ['product:benefit:read', 'product:benefit:create', 'product:benefit:update']]] as const) {
    f.data.rbac!.roles.push({ id, code: id, name: id, enabled: true, description: 'isolated composition test', permissionCodes: [...permissionCodes] })
    f.data.users.push({ id, username: id, displayName: id, enabled: true, role: 'operator', roleIds: [id] })
  }
  return f
}
async function mount(actor = 'u-admin', input = fixture().data) {
  if (store) { await store.waitForPersistence(); store.$dispose() }
  disk.clear(); session.clear(); failWrite = false; session.set('iyge-rbac-simulated-user', actor)
  disk.set(STORAGE_KEY, JSON.stringify({ version: DATA_VERSION, data: input })); setActivePinia(createPinia()); store = useCatalogStore(); await store.waitForPersistence(); writes = 0
  return store
}
const snapshot = () => ({ memory: JSON.stringify(store!.data), raw: disk.get(STORAGE_KEY), writes })
const unchanged = (before: ReturnType<typeof snapshot>) => assert.deepEqual(snapshot(), before)
function draft() {
  const f = fixture(); let d = f.createDraft()
  d = addBenefitSku(store!.data, d, f.ids.caseSku, 1, { groupId: 'buy' })
  d = addBenefitSku(store!.data, d, f.ids.caseSku, 2, { groupId: 'gift' })
  d = setBenefitPositionPrice(d, d.goods[0].id, { amountCents: 199, source: 'manual', enteredAt: '2026-10-26T03:00:00Z' })
  d = setBenefitPositionPrice(d, d.goods[1].id, { amountCents: 0, source: 'manual', enteredAt: '2026-10-26T03:00:00Z' })
  d.services = [{ id: 'service-package', name: '【隔离】每包服务', quantity: 2, unit: '次', measurement: 'per-package', validity: '3个月', description: '人工约定', referencePrice: { amountCents: 50, source: 'manual', enteredAt: '2026-10-26T03:00:00Z' } }, { id: 'service-once', name: '【隔离】本次服务', quantity: 1, unit: '次', measurement: 'per-delivery', validity: '本次', description: '未激活', referencePrice: { amountCents: 10, source: 'manual', enteredAt: '2026-10-26T03:00:00Z' } }]
  d.quote.amountCents = 500
  return reviewBenefitQuote(d, store!.data)
}
const save = (d: BenefitPackageDraft, requestId: string, status: 'draft' | 'available' = 'available', isCurrent = () => true) => store!.saveBenefitPackage({ draft: d, status, requestId, expectedRevision: d.revision }, isCurrent)
function rows(book: XLSX.WorkBook, sheet: string) { return XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[sheet], { header: 1, defval: '' }) }
try {
  await mount(); const d = draft(), initial = snapshot(), validation = validateBenefitPackage(store!.data, d)
  assert.equal(validation.canSaveAvailable, true, validation.issues.map(i => i.message).join('；'))
  failWrite = true; assert.equal((await save(d, 'create-retry')).ok, false); unchanged(initial)
  failWrite = false; const created = await save(d, 'create-retry'); assert(created.ok && created.package)
  assert.equal(writes, 1); assert.equal(created.package.goods.length, 2); assert.equal(new Set(created.package.goods.map(line => line.id)).size, 2)
  assert.deepEqual(created.package.goods.map(line => [line.groupId, line.quantity, line.referencePrice?.amountCents]), [['buy', 1, 199], ['gift', 2, 0]])
  groups++
  let before = snapshot(); const retry = await save(d, 'create-retry'); assert.equal(retry.id, created.id); unchanged(before)
  const changed = cloneBenefit(d); changed.name += ' changed'; assert.equal((await save(changed, 'create-retry')).ok, false); unchanged(before); groups++

  const updated = cloneBenefit(created.package); updated.name += ' 修订'
  const update = await save(updated, 'update-retry'); assert(update.ok && update.package); assert.equal(update.package.revision, 2)
  before = snapshot(); assert.equal((await save(updated, 'update-retry')).ok, true); unchanged(before)
  const alteredUpdate = cloneBenefit(updated); alteredUpdate.goods[0].quantity = 2
  assert.equal((await save(alteredUpdate, 'update-retry')).ok, false); unchanged(before); groups++
  assert.equal((await save(draft(), 'update-retry')).ok, false); unchanged(before)
  const later = cloneBenefit(update.package); later.name += ' 再次修订'
  const savedLater = await save(later, 'later-update'); assert(savedLater.ok && savedLater.package)
  before = snapshot(); assert.equal((await save(draft(), 'update-retry')).ok, false); unchanged(before)
  assert.equal((await save(savedLater.package, 'create-retry')).ok, false); unchanged(before); groups++

  const mutable = copyBenefitPackageDraft(update.package), acceptedName = mutable.name
  const pending = save(mutable, 'captured-input'); mutable.name = 'mutated after queue'; mutable.goods[0].quantity = 5
  const captured = await pending; assert(captured.ok && captured.package); assert.equal(captured.package.name, acceptedName); assert.equal(captured.package.goods[0].quantity, 1); groups++
  before = snapshot(); assert.equal((await save(draft(), 'context-refused', 'draft', () => false)).ok, false); unchanged(before)
  const queued = save(draft(), 'actor-refused', 'draft'); assert(store!.simulateUser('free-read').ok); assert.equal((await queued).ok, false); unchanged(before); groups++

  await mount(); const forgedHost = draft(); forgedHost.goods[0].role = 'host'; forgedHost.goods[0].groupId = null
  for (const bad of [null, { ...draft(), goods: {} }, { ...draft(), goods: [null] }, { ...draft(), quote: null }, { ...draft(), name: 7 }, forgedHost]) {
    before = snapshot(); assert.equal((await store!.saveBenefitPackage({ draft: bad as BenefitPackageDraft, status: 'draft', requestId: 'malformed' })).ok, false); unchanged(before)
  }; groups++
  const valid = await save(draft(), 'deliver-package'); assert(valid.ok && valid.package)
  const preview = previewBenefitDelivery(store!.data, valid.package, 3); assert(preview.canConfirm, preview.issues.map(i => i.message).join('；'))
  assert.deepEqual(preview.goods.map(line => [line.perPackageQuantity, line.totalQuantity, line.referenceLineCents]), [[1, 3, 199], [2, 6, 0]])
  assert.equal(preview.goodsSummary?.length, 1); assert.equal(preview.goodsSummary[0].perPackageQuantity, 3); assert.equal(preview.goodsSummary[0].totalQuantity, 9)
  assert.equal(preview.services.find(line => line.id === 'service-package')!.totalQuantity, 6); assert.equal(preview.services.find(line => line.id === 'service-once')!.totalQuantity, 1)
  assert.equal(preview.referenceTotals?.totalKnownCents, 907); assert.equal(preview.referenceTotals?.differenceCents, -593); groups++

  const generation = { packageId: preview.packageId, expectedRevision: preview.sourceRevision, requestId: 'delivery-retry', packageCount: 3, expectedBasis: preview.basis }
  before = snapshot(); failWrite = true; assert.equal((await store!.generateBenefitDelivery(generation)).ok, false); unchanged(before)
  failWrite = false; const generated = await store!.generateBenefitDelivery(generation); assert(generated.ok && generated.delivery)
  assert.equal(generated.delivery.snapshotVersion, 2)
  before = snapshot(); const repeated = await store!.generateBenefitDelivery(generation); assert.equal(repeated.id, generated.id); unchanged(before)
  assert.equal((await store!.generateBenefitDelivery({ ...generation, packageCount: 2 })).ok, false); unchanged(before); groups++

  const book = buildBenefitDeliveryWorkbook(generated.delivery), literal = cloneBenefit(generated.delivery), oldExportRows = book.SheetNames.map(name => [name, rows(book, name)])
  const goodsRows = rows(book, '商品明细'); assert.equal(goodsRows.length, 3); assert.notEqual(goodsRows[1][16], goodsRows[2][16]); assert.deepEqual([goodsRows[1][17], goodsRows[2][17]], ['buy', 'gift'])
  assert.equal(rows(book, 'SKU 数量汇总')[1][3], 3); assert.equal(rows(book, 'SKU 数量汇总')[1][4], 9)
  const exported = store!.exportJson(); await assert.doesNotReject(async () => store!.importJson(exported)); await store!.waitForPersistence()
  assert.deepEqual(store!.data.benefitDeliveries?.find(item => item.id === literal.id), literal)
  const normalized = normalizeStored(JSON.parse(disk.get(STORAGE_KEY)!))!; assert.deepEqual(normalized.benefitPackages?.[0].goods, valid.package.goods); groups++

  // Live changes do not participate in export of the saved delivery.
  store!.data.skus.find(item => item.id === 'case-sku')!.skuName = 'later catalogue rename'
  store!.data.compatibilities.find(item => item.targetId === 'case-sku')!.note = 'later evidence note'
  const f = store!.data.benefitFrameworks![0], newFrame = cloneBenefit(f); newFrame.name += ' 新修订'
  assert((await store!.saveBenefitFramework({ draft: newFrame, expectedRevision: f.revision, requestId: 'framework-next' })).ok)
  await store!.waitForPersistence()
  assert.deepEqual(buildBenefitDeliveryWorkbook(literal).SheetNames.map(name => [name, rows(buildBenefitDeliveryWorkbook(literal), name)]), oldExportRows)
  assert.deepEqual(literal, generated.delivery); groups++

  const retained = cloneBenefit(store!.data.benefitPackages!.find(item => item.id === valid.id)!)
  assert.equal(validateBenefitPackage(store!.data, retained).quoteNeedsReview, true)
  const rechecked = await save(reviewBenefitQuote(retained, store!.data), 'review-new-evidence'); assert(rechecked.ok && rechecked.package)
  const freshPackage = rechecked.package, newPreview = previewBenefitDelivery(store!.data, freshPackage, 1)
  assert(newPreview.canConfirm)
  store!.data.compatibilities.find(item => item.targetId === 'case-sku')!.source = 'modified after preview'; await store!.waitForPersistence(); before = snapshot()
  assert.equal((await store!.generateBenefitDelivery({ packageId: freshPackage.id, expectedRevision: freshPackage.revision, requestId: 'stale-evidence', packageCount: 1, expectedBasis: newPreview.basis })).ok, false); unchanged(before); groups++

  store!.data.compatibilities = []; await store!.waitForPersistence()
  before = snapshot(); assert.match(store!.removeSku('case-sku') ?? '', /权益包|组合/); unchanged(before)
  const outside = JSON.parse(store!.exportJson()); outside.data.benefitPackages[0].goods[0].groupId = 'not-a-real-group'
  await assert.rejects(async () => store!.importJson(JSON.stringify(outside)), /组|框架|位置/); unchanged(before); groups++
  const receiptCollision = JSON.parse(store!.exportJson()), originalPackage = receiptCollision.data.benefitPackages[0]
  const duplicate = cloneBenefit(originalPackage); duplicate.id = 'duplicate-receipt-owner'; duplicate.code = 'BPK-999999'; duplicate.name = '隔离回执冲突'
  delete duplicate.creationRequestId; delete duplicate.creationIntent
  duplicate.saveReceipts = [cloneBenefit(originalPackage.saveReceipts.at(-1))]
  receiptCollision.data.benefitPackages.push(duplicate)
  await assert.rejects(async () => store!.importJson(JSON.stringify(receiptCollision)), /请求|回执/); unchanged(before); groups++
  const corruptSummary = JSON.parse(store!.exportJson()), frozenCopy = cloneBenefit(corruptSummary.data.benefitDeliveries[0])
  frozenCopy.id = 'invalid-aggregate-delivery'; frozenCopy.code = 'BDL-999999'; frozenCopy.requestId = 'invalid-aggregate-request'; frozenCopy.goodsSummary[0].totalQuantity++
  corruptSummary.data.benefitDeliveries.push(frozenCopy)
  await assert.rejects(async () => store!.importJson(JSON.stringify(corruptSummary)), /汇总|数量|冻结/); unchanged(before); groups++
  const fakeHost = JSON.parse(store!.exportJson()); fakeHost.data.benefitPackages[0].goods[0].role = 'host'; fakeHost.data.benefitPackages[0].goods[0].groupId = null; fakeHost.data.benefitPackages[0].includedPhoneSkuId = 'case-sku'
  await assert.rejects(async () => store!.importJson(JSON.stringify(fakeHost)), /主机|身份|位置/); unchanged(before); groups++

  // Unknown composition is retained as non-executable data, never downgraded to free selection.
  const future = JSON.parse(store!.exportJson()); future.data.benefitPackages[0].compositionVersion = 99; future.data.benefitPackages[0].status = 'draft'
  await assert.doesNotReject(async () => store!.importJson(JSON.stringify(future))); await store!.waitForPersistence()
  const unsupported = store!.data.benefitPackages![0]; assert.equal(unsupported.compositionVersion, 99); assert.equal(validateBenefitPackage(store!.data, unsupported).canSaveAvailable, false)
  assert.throws(() => buildBenefitDeliveryWorkbook({ ...literal, snapshotVersion: 99 } as BenefitDeliverySnapshot), /版本/); groups++
  await mount(); const noQuote = draft(); noQuote.quote.amountCents = null
  assert((await save(noQuote, 'finite-number-receipt')).ok)
  before = snapshot()
  for (const amount of [NaN, Infinity, -Infinity]) {
    const invalid = cloneBenefit(noQuote); invalid.quote.amountCents = amount
    assert.equal((await save(invalid, 'finite-number-receipt')).ok, false, 'nonfinite numbers must not collide with a successful null-quote receipt'); unchanged(before)
  }; groups++

  await mount('free-read'); before = snapshot()
  if (RBAC_ENFORCEMENT_ENABLED) {
    await assert.rejects(async () => save(draft(), 'readonly-direct'), /未授权/)
    await assert.rejects(async () => store!.saveBenefitFramework({ draft: fixture().framework, expectedRevision: 1, requestId: 'readonly-frame' }), /未授权/)
    await assert.rejects(async () => store!.generateBenefitDelivery(generation), /未授权/); unchanged(before)
  } else assert.equal((await save(draft(), 'default-unrestricted')).ok, true)
  groups++
  await mount('free-edit'); const editable = await save(draft(), 'package-rights-only'); assert(editable.ok)
  if (RBAC_ENFORCEMENT_ENABLED) { before = snapshot(); await assert.rejects(async () => store!.generateBenefitDelivery({ ...generation, packageId: editable.id! }), /未授权/); await assert.rejects(async () => store!.saveBenefitFramework({ draft: fixture().framework, expectedRevision: 1, requestId: 'cannot-edit-frame' }), /未授权/); unchanged(before) }; groups++
  console.log(`PASS free combination Store/export (${RBAC_ENFORCEMENT_ENABLED ? 'strict' : 'default'}): ${groups} groups`)
} finally { if (store) { await store.waitForPersistence(); store.$dispose() }; restoreLocks() }
