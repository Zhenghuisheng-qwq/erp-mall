import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { installCatalogTestLocks } from './catalog-storage-test-env'
import { listInteractionFixture, listRelationshipIdentityFixture } from './list-interaction-fixture'
import { emptyModeQuery, presentProductList, unfilteredIds } from '../src/domain/productListQuery'
import { planScopedManualOrder, resolveManualOrder } from '../src/domain/productListManual'
import { querySkuWorkbench } from '../src/domain/skuWorkbenchQuery'
import { clearSkuQuickFilterValue } from '../src/domain/skuQuickFilters'
import { defaultSkuConfig, SYSTEM_SKU_VIEW_ID } from '../src/domain/skuWorkbenchState'
import { RBAC_ENFORCEMENT_ENABLED } from '../src/domain/accessMode'
import { ensureProductListPages } from '../src/domain/productListPages'
import { ensureRbac } from '../src/domain/rbac'
import { isRealSku } from '../src/domain/catalogIdentity'
import { DATA_VERSION, STORAGE_KEY, type AppData, type ProductListPageState } from '../src/domain/types'
import { normalizeStored, useCatalogStore } from '../src/stores/catalog'
import type { ListManualGuard } from '../src/domain/listManualCommit'

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const restoreLocks = installCatalogTestLocks(), disk = new Map<string, string>(), session = new Map<string, string>()
let failWrite = false, writes = 0, groups = 0, store: ReturnType<typeof useCatalogStore> | undefined
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => disk.get(key) ?? null, setItem: (key: string, value: string) => { if (key === STORAGE_KEY && failWrite) throw Error('list save quota fixture'); disk.set(key, value); if (key === STORAGE_KEY) writes++ }, removeItem: (key: string) => disk.delete(key) } })
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: (key: string) => session.get(key) ?? null, setItem: (key: string, value: string) => session.set(key, value), removeItem: (key: string) => session.delete(key) } })
function fixture() {
  const data = listInteractionFixture(); ensureProductListPages(data); ensureRbac(data)
  for (const [id, permissionCodes] of [['list-only-spu', ['product:spu:read']], ['list-only-sku', ['product:sku:read']]] as const) {
    data.rbac!.roles.push({ id, code: id, name: id, description: 'isolated list role', enabled: true, permissionCodes: [...permissionCodes] })
    data.users.push({ id, username: id, displayName: id, role: 'operator', roleIds: [id], enabled: true })
  }
  const page = data.productListPages!.spu, view = page.views.find(item => item.id === page.activeId)!
  view.mode = 'spu'; view.spuQuery = { ...emptyModeQuery('spu'), grouping: { field: 'category', direction: 'asc' }, sortMode: 'manual' }
  view.manualOrder = { spuIds: data.families.map(item => item.id), skuIds: [] }
  const config = defaultSkuConfig(); config.sortMode = 'manual'; config.groups = [{ field: 'category', direction: 'asc' }]
  data.productListPages!.sku.skuWorkbench!.working[SYSTEM_SKU_VIEW_ID] = config
  return data
}
async function mount(actor = 'u-admin', input = fixture()) {
  if (store) { await store.waitForPersistence(); store.$dispose() }
  failWrite = false; disk.clear(); session.clear(); session.set('iyge-rbac-simulated-user', actor)
  disk.set(STORAGE_KEY, JSON.stringify({ version: DATA_VERSION, data: input })); setActivePinia(createPinia()); store = useCatalogStore(); await store.waitForPersistence(); writes = 0
  return store
}
const snapshot = () => ({ memory: JSON.stringify(store!.data), raw: disk.get(STORAGE_KEY), writes })
const unchanged = (before: ReturnType<typeof snapshot>) => assert.deepEqual(snapshot(), before)
const spuPage = () => clone(store!.data.productListPages!.spu)
const skuPage = () => clone(store!.data.productListPages!.sku)
function prepareSpu(place: 'top' | 'bottom' | 'before' | 'after' = 'top') {
  const data = store!.data, next = spuPage(), old = data.productListPages!.spu.views.find(item => item.id === next.activeId)!
  const view = next.views.find(item => item.id === next.activeId)!, result = presentProductList(data, old, 1, 2)
  assert.deepEqual(result.errors, [])
  const buckets = Object.groupBy(result.allIds, id => result.groupKeys[id])
  const same = Object.values(buckets).find(ids => ids && ids.length >= 3)!
  assert(same?.length >= 3, 'fixture needs a full group spanning pages')
  const source = same.at(-1)!, target = same[0]!, order = resolveManualOrder(old.manualOrder?.spuIds, unfilteredIds(data, old))
  const plan = planScopedManualOrder({ order, matchedIds: result.allIds, groupKeys: result.groupKeys, movingIds: [source], targetId: target, place })
  assert(plan.ok)
  view.manualOrder!.spuIds = plan.order
  const guard: ListManualGuard = { viewId: view.id, configStamp: JSON.stringify(old), search: '', scopeId: '', sourceIds: [source], targetId: target, ...(place === 'top' || place === 'bottom' ? { edge: place } : { place }), matchedIds: result.allIds, groupKeys: result.groupKeys }
  return { next, guard, source, target, same, order, plan, result }
}
try {
  await mount()
  const business = JSON.stringify([store!.data.families, store!.data.skus, store!.data.specModelVersions])
  let next = spuPage(); next.views[0]!.categoryFilterLayout = 'sidebar'
  const original = snapshot(); failWrite = true
  assert.equal((await store!.commitSpuPage(next)).ok, false); unchanged(original); assert.equal(next.views[0]!.categoryFilterLayout, 'sidebar')
  failWrite = false; assert.equal((await store!.commitSpuPage(next)).ok, true); assert.equal(writes, 1)
  assert.equal(JSON.stringify([store!.data.families, store!.data.skus, store!.data.specModelVersions]), business); groups++

  let before = snapshot(); assert.equal((await store!.commitSpuPage(spuPage())).ok, true); unchanged(before)
  next = spuPage(); next.views[0]!.categoryFilterLayout = 'popover'; assert.equal((await store!.commitSpuPage(next, undefined, () => false)).ok, false); unchanged(before)
  assert.equal((await store!.commitSpuPage(null as unknown as ProductListPageState)).ok, false); unchanged(before); groups++

  next = spuPage(); next.views[0]!.categoryFilterLayout = 'popover'
  const accepted = store!.commitSpuPage(next); next.views[0]!.name = 'mutation after invocation must not persist'
  assert.equal((await accepted).ok, true); assert.notEqual(store!.data.productListPages!.spu.views[0]!.name, next.views[0]!.name); groups++

  const stamp = JSON.stringify(store!.data.productListPages!.spu), a = spuPage(), b = spuPage()
  a.views[0]!.name += ' A'; b.views[0]!.name += ' B'
  const first = store!.commitSpuPage(a, stamp), second = store!.commitSpuPage(b, stamp)
  assert.equal((await first).ok, true); assert.equal((await second).ok, false); assert.equal(store!.data.productListPages!.spu.views[0]!.name, a.views[0]!.name); groups++

  await mount(); let prepared = prepareSpu(); const old = snapshot()
  failWrite = true; assert.equal((await store!.commitSpuPage(prepared.next, undefined, () => true, prepared.guard)).ok, false); unchanged(old)
  failWrite = false; assert.equal((await store!.commitSpuPage(prepared.next, undefined, () => true, prepared.guard)).ok, true)
  assert.equal(writes, 1); assert.deepEqual(presentProductList(store!.data, store!.data.productListPages!.spu.views.find(item => item.id === prepared.guard.viewId)!, 1, 100).allIds.filter(id => prepared.same.includes(id)), [prepared.source, ...prepared.same.filter(id => id !== prepared.source)]); groups++

  await mount(); prepared = prepareSpu(); before = snapshot(); const forged = clone(prepared.next); forged.views.find(item => item.id === prepared.guard.viewId)!.manualOrder!.spuIds.reverse()
  assert.equal((await store!.commitSpuPage(forged, undefined, () => true, prepared.guard)).ok, false); unchanged(before)
  const other = prepared.result.allIds.find(id => prepared.result.groupKeys[id] !== prepared.guard.groupKeys[prepared.source])!
  assert(other); const cross = { ...prepared.guard, sourceIds: [prepared.source, other] }
  assert.equal((await store!.commitSpuPage(prepared.next, undefined, () => true, cross)).ok, false); unchanged(before); groups++

  await mount(); prepared = prepareSpu(); store!.data.families.find(item => item.id === prepared.source)!.categoryId = store!.data.families.find(item => item.id === other)!.categoryId
  await store!.waitForPersistence(); before = snapshot()
  assert.equal((await store!.commitSpuPage(prepared.next, undefined, () => true, prepared.guard)).ok, false); unchanged(before); groups++

  await mount(); const skBefore = skuPage(), config = skBefore.skuWorkbench!.working[SYSTEM_SKU_VIEW_ID]!, skQuery = querySkuWorkbench(store!.data, config)
  assert.deepEqual(skQuery.errors, [])
  const skSame = Object.values(Object.groupBy(skQuery.allIds, id => skQuery.groupKeys[id])).find(ids => ids && ids.length >= 3)!
  assert(skSame?.length >= 3)
  const moving = skSame.at(-1)!, target = skSame[0]!, skOrder = resolveManualOrder(config.manualOrder, store!.data.skus.filter(item => isRealSku(store!.data, item)).map(item => item.id))
  const skPlan = planScopedManualOrder({ order: skOrder, matchedIds: skQuery.allIds, groupKeys: skQuery.groupKeys, movingIds: [moving], targetId: target, place: 'top' }); assert(skPlan.ok)
  const skNext = clone(skBefore); skNext.skuWorkbench!.working[SYSTEM_SKU_VIEW_ID]!.manualOrder = skPlan.order
  const skGuard: ListManualGuard = { viewId: SYSTEM_SKU_VIEW_ID, configStamp: JSON.stringify(config), search: '', scopeId: '', sourceIds: [moving], targetId: target, edge: 'top', matchedIds: skQuery.allIds, groupKeys: skQuery.groupKeys }
  assert.equal((await store!.commitSkuPage(skNext, () => true, skGuard)).ok, true)
  assert.deepEqual(store!.data.productListPages!.sku.views, skBefore.views); assert.deepEqual(store!.data.productListPages!.sku.skuWorkbench!.working[SYSTEM_SKU_VIEW_ID]!.manualOrder, skPlan.order); groups++

  before = snapshot(); const brokenSystem = skuPage(); brokenSystem.views.find(item => item.id === SYSTEM_SKU_VIEW_ID)!.skuWorkbench!.density = 'compact'
  assert.equal((await store!.commitSkuPage(brokenSystem)).ok, false); unchanged(before)
  const malformed = skuPage(); (malformed.skuWorkbench!.working[SYSTEM_SKU_VIEW_ID]!.conditions.children as unknown[]) = [null]
  assert.equal((await store!.commitSkuPage(malformed)).ok, false); unchanged(before); groups++

  const inactive = skuPage(), inactiveCfg = inactive.skuWorkbench!.working[SYSTEM_SKU_VIEW_ID]!
  inactiveCfg.conditions = { kind: 'group', id: 'root', logic: 'any', children: [{ kind: 'rule', id: 'inactive-example', field: 'name', operator: 'contains', value: 'no such record' }, { kind: 'rule', id: 'active-example', field: 'status', operator: 'eq', value: 'on_sale' }] }
  inactiveCfg.quickFilters = [{ source: 'condition', ruleId: 'inactive-example' }]
  inactive.skuWorkbench!.working[SYSTEM_SKU_VIEW_ID] = clearSkuQuickFilterValue(inactiveCfg, inactiveCfg.quickFilters[0]!)
  assert.equal((await store!.commitSkuPage(inactive)).ok, true)
  const savedRaw = disk.get(STORAGE_KEY)!, reopened = normalizeStored(JSON.parse(savedRaw))!
  assert.deepEqual(reopened.productListPages!.sku.skuWorkbench!.working[SYSTEM_SKU_VIEW_ID]!.quickFilters, inactiveCfg.quickFilters)
  assert.equal(querySkuWorkbench(reopened, reopened.productListPages!.sku.skuWorkbench!.working[SYSTEM_SKU_VIEW_ID]!).total, store!.data.skus.filter(item => item.status === 'on_sale' && isRealSku(store!.data, item)).length); groups++

  await mount(); before = snapshot(); next = spuPage(); next.views[0]!.categoryFilterLayout = 'sidebar'
  const delayed = store!.commitSpuPage(next)
  assert.equal(store!.simulateUser('list-only-sku').ok, true)
  assert.equal((await delayed).ok, false); unchanged(before); groups++

  await mount('list-only-spu'); before = snapshot(); next = spuPage(); next.views[0]!.categoryFilterLayout = 'sidebar'
  if (RBAC_ENFORCEMENT_ENABLED) { await assert.rejects(async () => store!.commitSpuPage(next), /未授权/); unchanged(before); await assert.rejects(async () => store!.commitSkuPage(skuPage()), /未授权/); unchanged(before) } else assert.equal((await store!.commitSpuPage(next)).ok, true)
  groups++
  await mount('list-only-sku'); const personal = skuPage(); personal.skuWorkbench!.working[SYSTEM_SKU_VIEW_ID]!.density = 'compact'
  assert.equal((await store!.commitSkuPage(personal)).ok, true)
  if (RBAC_ENFORCEMENT_ENABLED) { before = snapshot(); await assert.rejects(async () => store!.commitSpuPage(spuPage()), /未授权/); unchanged(before) }
  groups++
  await mount(); for (const kind of ['missing-state', 'array-state', 'array-working', 'orphan-working', 'missing-scope', 'invalid-active', 'duplicate-order', 'invalid-favorite'] as const) {
    const candidate = skuPage(); before = snapshot()
    if (kind === 'missing-state') delete candidate.skuWorkbench
    if (kind === 'array-state') (candidate as any).skuWorkbench = []
    if (kind === 'array-working') (candidate.skuWorkbench as any).working = []
    if (kind === 'orphan-working') candidate.skuWorkbench!.working['not-a-registered-view'] = defaultSkuConfig()
    if (kind === 'missing-scope') candidate.skuWorkbench!.working[`${SYSTEM_SKU_VIEW_ID}@spu:missing-family`] = defaultSkuConfig()
    if (kind === 'invalid-active') candidate.skuWorkbench!.activeId = 'missing-view'
    if (kind === 'duplicate-order') candidate.skuWorkbench!.order.push(candidate.skuWorkbench!.order[0])
    if (kind === 'invalid-favorite') candidate.skuWorkbench!.favorites.push('missing-view')
    assert.equal((await store!.commitSkuPage(candidate)).ok, false, `${kind} must be refused before persistence`); unchanged(before)
  }; groups++
  await mount(); const actualScope = skuPage(), scopedKey = `${SYSTEM_SKU_VIEW_ID}@spu:${store!.data.families[0].id}`; actualScope.skuWorkbench!.working[scopedKey] = defaultSkuConfig(); assert.equal((await store!.commitSkuPage(actualScope)).ok, true); assert.deepEqual(store!.data.productListPages!.sku.skuWorkbench!.working[scopedKey], defaultSkuConfig()); assert.equal(writes, 1); groups++
  const preexistingInvalid = fixture(), retainedView = preexistingInvalid.productListPages!.sku.views.find(view => view.id !== SYSTEM_SKU_VIEW_ID)!, invalidConfig = defaultSkuConfig()
  invalidConfig.conditions.children = [{ kind: 'rule', id: 'old-unknown-field', field: 'no-longer-registered', operator: 'eq', value: 'retained old input' }]
  retainedView.skuWorkbench = clone(invalidConfig); preexistingInvalid.productListPages!.sku.skuWorkbench!.working[retainedView.id] = clone(invalidConfig)
  await mount('u-admin', preexistingInvalid); const preserveOld = skuPage(); preserveOld.skuWorkbench!.working[SYSTEM_SKU_VIEW_ID]!.density = 'compact'; const oldInvalidSnapshot = clone(preserveOld.views.find(view => view.id === retainedView.id)!.skuWorkbench)
  assert.equal((await store!.commitSkuPage(preserveOld)).ok, true); assert.deepEqual(store!.data.productListPages!.sku.views.find(view => view.id === retainedView.id)!.skuWorkbench, oldInvalidSnapshot); assert.deepEqual(store!.data.productListPages!.sku.skuWorkbench!.working[retainedView.id].conditions, invalidConfig.conditions); assert.equal(writes, 1); groups++
  for (const field of ['productType', 'typeName', 'template', 'modelName']) {
    const identities = listRelationshipIdentityFixture(); ensureProductListPages(identities); const grouped = defaultSkuConfig(); grouped.sortMode = 'manual'; grouped.groups = [{ field, direction: 'asc' }]; grouped.conditions.children = [{ kind: 'rule', id: 'relation-scope', field: 'familyId', operator: 'in', value: ['list-f-a1', 'list-f-a2'] }]; identities.productListPages!.sku.skuWorkbench!.working[SYSTEM_SKU_VIEW_ID] = grouped
    await mount('u-admin', identities); const currentPage = skuPage(), currentConfig = currentPage.skuWorkbench!.working[SYSTEM_SKU_VIEW_ID], result = querySkuWorkbench(store!.data, currentConfig)
    assert.deepEqual(result.errors, []); assert.equal(result.groups.length, 2); assert.equal(result.groups[0].labels[0], result.groups[1].labels[0]); const source = result.allIds[1], target = result.allIds[0], fullOrder = resolveManualOrder(currentConfig.manualOrder, store!.data.skus.filter(item => isRealSku(store!.data, item)).map(item => item.id)); const proposedOrder = fullOrder.filter(id => id !== source); proposedOrder.splice(proposedOrder.indexOf(target), 0, source)
    currentPage.skuWorkbench!.working[SYSTEM_SKU_VIEW_ID].manualOrder = proposedOrder; const guard: ListManualGuard = { viewId: SYSTEM_SKU_VIEW_ID, configStamp: JSON.stringify(currentConfig), search: '', scopeId: '', sourceIds: [source], targetId: target, place: 'before', matchedIds: result.allIds, groupKeys: result.groupKeys }
    // The stamp identifies the accepted configuration before this proposed order.
    guard.configStamp = JSON.stringify(store!.data.productListPages!.sku.skuWorkbench!.working[SYSTEM_SKU_VIEW_ID]); before = snapshot(); const refused = await store!.commitSkuPage(currentPage, () => true, guard); assert.equal(refused.ok, false, `${field}: same display name must not permit cross-identity sorting`); assert.equal(refused.message, '目标记录已不在当前完整筛选结果的同一分组内。'); unchanged(before); groups++
  }
  console.log(`PASS list view Store (${RBAC_ENFORCEMENT_ENABLED ? 'strict' : 'default'}): ${groups} groups`)
} finally { if (store) { await store.waitForPersistence(); store.$dispose() }; restoreLocks() }
