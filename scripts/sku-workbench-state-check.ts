import { installCatalogTestLocks } from './catalog-storage-test-env'
installCatalogTestLocks()
import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { effectScope, nextTick, ref } from 'vue'
import { createSeed } from '../src/domain/seed'
import { ensureProductListPages, productListPageData } from '../src/domain/productListPages'
import { copyProductListView } from '../src/domain/productListViews'
import { addScopeCondition, cloneSku, defaultSkuConfig, ensureSkuWorkbench, persistSkuPage, repairSkuConfig, skuConfigStamp, SYSTEM_SKU_VIEW_ID } from '../src/domain/skuWorkbenchState'
import { querySkuWorkbench, validateSkuConfig } from '../src/domain/skuWorkbenchQuery'
import { DATA_VERSION, STORAGE_KEY } from '../src/domain/types'
import { catalogMigrationError, normalizeStored, useCatalogStore } from '../src/stores/catalog'
import { useSkuWorkbench } from '../src/components/product-list/useSkuWorkbench'

const disk = new Map<string, string>()
let failStorage = false, writes = 0
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => disk.get(key) ?? null,
  setItem: (key: string, value: string) => { if (failStorage) throw new Error('QuotaExceededError'); writes++; disk.set(key, String(value)) },
  removeItem: (key: string) => disk.delete(key), clear: () => disk.clear(),
} })
const data = createSeed()
ensureProductListPages(data)
const page = data.productListPages?.sku
assert.ok(page)
page.views = page.views.filter(view => view.id !== SYSTEM_SKU_VIEW_ID)
delete page.skuWorkbench
page.views.forEach(view => delete view.skuWorkbench)
const original = page.views.find(view => view.id === 'view-default')
assert.ok(original?.skuQuery)
original.name = '保留的用户默认'
original.skuQuery.keyword = 'Apple'
original.skuQuery.filters = [{ id: 'old-empty', field: 'created', operator: 'between', value: { from: '2026-01-01' } }]
original.skuColumns[0] = { key: 'code', visible: true, order: 0, width: 188, frozen: 'left' }
original.manualOrder = { spuIds: ['spu-order'], skuIds: ['sku-order'] }
const oldView = cloneSku(original), oldSpu = cloneSku(data.productListPages?.spu)
assert.ok(oldView.skuQuery)
const business = () => JSON.stringify([data.families, data.skus, data.planningRecords, data.specModelVersions, data.materialReceipts, data.compatibilities])
const originalBusiness = business()
assert.equal(ensureSkuWorkbench(data), true)
assert.equal(ensureProductListPages(data), false, 'Repeated repair must not report or manufacture changes')
assert.deepEqual(data.productListPages?.spu, oldSpu)
assert.equal(original.name, oldView.name)
assert.deepEqual(original.skuQuery, oldView.skuQuery)
assert.deepEqual(original.skuColumns, oldView.skuColumns)
assert.deepEqual(original.manualOrder, oldView.manualOrder)
assert.deepEqual(original.skuWorkbench?.legacy?.filters, oldView.skuQuery.filters)
assert.equal(original.skuWorkbench?.legacy?.keyword, 'Apple')
assert.equal(page.views.filter(view => view.id === SYSTEM_SKU_VIEW_ID).length, 1)
assert.equal(business(), originalBusiness)
console.log('PASS migration preserves legacy default/keyword/one-sided dates/columns/manual order/SPU and business data; idempotent')

const custom = cloneSku(original.skuWorkbench || defaultSkuConfig())
custom.conditions.children = [{ kind: 'group', id: 'g', logic: 'any', children: [{ kind: 'rule', id: 'r', field: 'status', operator: 'eq', value: 'on_sale' }] }]
custom.sorts = [{ field: 'name', direction: 'asc' }, { field: 'code', direction: 'desc' }]
custom.groups = [{ field: 'category', direction: 'asc' }]
custom.columns = [{ key: 'code', visible: true, width: 180, frozen: 'left' }, { key: 'name', visible: true, width: 245, frozen: false }]
custom.density = 'compact'
original.skuWorkbench = cloneSku(custom)
const copied = copyProductListView(productListPageData(data, 'sku'), original.id, () => 'copy-id', '2026-10-22T04:00:00Z')
assert.ok(copied.ok)
const loaded = normalizeStored({ version: DATA_VERSION, data: cloneSku(data) })
assert.ok(loaded)
const loadedPage = loaded.productListPages?.sku
assert.deepEqual(loadedPage?.views.find(view => view.id === 'copy-id')?.skuWorkbench, original.skuWorkbench)
const again = normalizeStored({ version: DATA_VERSION, data: cloneSku(loaded) })
assert.deepEqual(again, loaded)
assert.deepEqual(loaded.productListPages?.spu, oldSpu)
assert.equal(loadedPage?.views.find(view => view.id === original.id)?.skuColumns[0]?.width, 188)
assert.equal(loadedPage?.views.find(view => view.id === original.id)?.skuColumns[0]?.frozen, 'left')
console.log('PASS save/copy/import/reload round trips retain tree, sorts, grouping, width, freeze, density and aliases')

const beforePage = cloneSku(page), trial = cloneSku(page)
trial.activeId = SYSTEM_SKU_VIEW_ID
failStorage = true
const failed = persistSkuPage(data, trial, text => localStorage.setItem(STORAGE_KEY, text), DATA_VERSION)
assert.equal(failed.ok, false)
assert.deepEqual(page, beforePage)
const previousDisk = disk.get(STORAGE_KEY)
const migrationFailure = normalizeStored({ version: DATA_VERSION - 1, data: cloneSku(data) })
assert.ok(migrationFailure)
assert.deepEqual(migrationFailure.families, data.families)
assert.equal(disk.get(STORAGE_KEY), previousDisk)
assert.equal(catalogMigrationError(), '', 'Pure normalization does not attempt persistence; protected startup failures are covered by storage/accessory state checks')
failStorage = false
assert.ok(persistSkuPage(data, trial, text => localStorage.setItem(STORAGE_KEY, text), DATA_VERSION).ok)
console.log('PASS failed persistence leaves formal settings/disk intact, migration never replaces data with seed, retry succeeds')

for (const bad of [null, 42, 'wrong', { ...defaultSkuConfig(), columns: [null], sorts: [null] }, { ...defaultSkuConfig(), conditions: { kind: 'group', children: null } }, { ...defaultSkuConfig(), legacy: { keyword: '', filters: [null] } }]) {
  const repaired = repairSkuConfig(bad, data)
  assert.ok(validateSkuConfig(data, repaired).length)
  assert.equal(querySkuWorkbench(data, repaired, {}).total, 0)
}
console.log('PASS malformed new configurations become explicit invalid queries, not crashes or widened results')

const metadataOnly = cloneSku(custom)
metadataOnly.conditions.id = 'new-root-id'
metadataOnly.conditions.children.forEach(node => { node.id += '-new'; if (node.kind === 'group') node.children.forEach(rule => { rule.id += '-new' }) })
metadataOnly.legacy?.filters.forEach(filter => { filter.id += '-new' })
assert.equal(skuConfigStamp(metadataOnly), skuConfigStamp(custom), 'Internal condition identities do not mark equal rules as unsaved')
const scopeSample = defaultSkuConfig()
scopeSample.conditions.logic = 'any'
scopeSample.conditions.children = [{ kind: 'group', id: 'saved-spu-group-0', logic: 'any', children: [
  { kind: 'rule', id: 'saved-spu-scope-0', field: 'status', operator: 'eq', value: 'on_sale' },
  { kind: 'rule', id: 'saved-spu-scope-1', field: 'status', operator: 'eq', value: 'off_sale' },
] }]
const scopeFamily = data.families[0]
assert.ok(scopeFamily)
const withScope = addScopeCondition(scopeSample, scopeFamily.id)
assert.deepEqual(validateSkuConfig(data, withScope), [])
assert.deepEqual(addScopeCondition(withScope, scopeFamily.id), withScope, 'Repeated explicit scope saving is idempotent and allocates no duplicate conditions')
console.log('PASS effective dirty comparison ignores internal IDs; repeated explicit scope saves retain unique identities and one-level groups')

disk.set(STORAGE_KEY, JSON.stringify({ version: DATA_VERSION, data: loaded }))
setActivePinia(createPinia())
const scope = effectScope()
const spu = ref('')
const workbench = scope.run(() => useSkuWorkbench(spu))
assert.ok(workbench)
const store = useCatalogStore()
await store.waitForPersistence(); await nextTick()
assert.equal(workbench.pending.value, false, 'Initial active-view persistence must finish before user actions')
const storeBusiness = JSON.stringify([store.data.families, store.data.skus, store.data.planningRecords, store.data.specModelVersions, store.data.materialReceipts])
assert.equal(workbench.activeId.value, SYSTEM_SKU_VIEW_ID, 'First ordinary entry uses configured default')
const config = cloneSku(workbench.config.value)
config.conditions.children = [{ kind: 'rule', id: 'status', field: 'status', operator: 'eq', value: 'on_sale' }]
assert.ok((await workbench.apply(config)).ok)
assert.equal(workbench.dirty.value, true)
assert.equal(store.data.productListPages?.sku.views.find(view => view.id === SYSTEM_SKU_VIEW_ID)?.skuWorkbench?.conditions.children.length, 0)
const created = (await workbench.create('  我的视图  '))
assert.ok(created.ok && created.id)
assert.equal(workbench.currentView.value.name, '我的视图')
assert.equal(workbench.dirty.value, false)
assert.equal((await workbench.create('我的视图')).ok, false)
assert.ok((await workbench.favorite(created.id)).ok)
const unstarred = (await workbench.create('顺序中间未收藏'))
const starred = (await workbench.create('顺序第二个收藏'))
assert.ok(unstarred.ok && unstarred.id && starred.ok && starred.id)
assert.ok((await workbench.favorite(starred.id)).ok)
assert.ok((await workbench.moveFavorite(starred.id, -1)).ok)
assert.deepEqual(workbench.state.value.order.filter(id => workbench.state.value.favorites.includes(id)), [starred.id, created.id], 'Favorite movement skips intervening non-favorite views')
assert.ok((await workbench.remove(starred.id)).ok)
assert.ok((await workbench.remove(unstarred.id)).ok)
assert.ok((await workbench.select(created.id)).ok)
assert.ok((await workbench.setDefault(created.id)).ok)
const changed = cloneSku(workbench.config.value)
changed.density = 'compact'
const beforeWrites = writes
failStorage = true
assert.equal((await workbench.apply(changed)).ok, false)
assert.equal(workbench.config.value.density, 'compact')
assert.equal(workbench.dirty.value, true)
assert.equal((await workbench.save()).ok, false)
const beforeImport = cloneSku(store.data)
const incoming = cloneSku(store.data)
const incomingFamily = incoming.families[0]
assert.ok(incomingFamily)
incomingFamily.name = '失败导入不得覆盖当前主体'
await assert.rejects(async () => (await store.importJson(JSON.stringify({ version: DATA_VERSION - 1, data: incoming }))), /无法写入本机/)
assert.deepEqual(store.data, beforeImport, 'Failed migration during import must not replace live data or settings')
assert.equal(writes, beforeWrites)
failStorage = false
assert.ok((await workbench.save()).ok)
assert.equal(catalogMigrationError(), '')
assert.equal(workbench.dirty.value, false)
await nextTick()
assert.equal(writes, beforeWrites + 1, 'Explicit save must not duplicate deep-watch persistence')
assert.ok((await workbench.apply({ ...cloneSku(workbench.config.value), density: 'comfortable' })).ok)
assert.ok((await workbench.select(SYSTEM_SKU_VIEW_ID)).ok)
assert.ok((await workbench.select(created.id)).ok)
assert.equal(workbench.config.value.density, 'comfortable')
assert.equal(workbench.dirty.value, true)
assert.ok((await workbench.restore()).ok)
assert.equal(workbench.config.value.density, 'compact')
const activeBeforeScope = store.data.productListPages?.sku.activeId
assert.ok((await workbench.select(SYSTEM_SKU_VIEW_ID)).ok)
const globalSystem = cloneSku(workbench.config.value)
globalSystem.conditions.children = [{ kind: 'rule', id: 'global-status', field: 'status', operator: 'eq', value: 'off_sale' }]
assert.ok((await workbench.apply(globalSystem)).ok)
assert.ok((await workbench.select(created.id)).ok)
spu.value = store.data.families[0]?.id || 'missing'
await nextTick()
assert.equal(workbench.activeId.value, SYSTEM_SKU_VIEW_ID)
assert.equal(workbench.config.value.conditions.children.length, 0, 'First scoped system view must not inherit global working filters')
const scopedSystem = cloneSku(workbench.config.value)
scopedSystem.density = 'compact'
assert.ok((await workbench.apply(scopedSystem)).ok)
assert.ok(store.data.productListPages?.sku.skuWorkbench?.working[`${SYSTEM_SKU_VIEW_ID}@spu:${spu.value}`])
assert.equal(store.data.productListPages?.sku.activeId, activeBeforeScope)
assert.ok((await workbench.select(created.id)).ok)
assert.equal(store.data.productListPages?.sku.activeId, activeBeforeScope)
assert.ok((await workbench.create('范围另存', false)).ok)
assert.equal(workbench.config.value.conditions.children.some(item => item.kind === 'rule' && item.field === 'familyId'), false)
assert.ok((await workbench.create('明确保存范围', true)).ok)
assert.equal(workbench.config.value.conditions.children.some(item => item.kind === 'rule' && item.field === 'familyId'), true)
spu.value = ''
await nextTick()
assert.equal(workbench.activeId.value, activeBeforeScope)
assert.ok((await workbench.select(SYSTEM_SKU_VIEW_ID)).ok)
assert.equal(workbench.config.value.conditions.children[0]?.id, 'global-status', 'Leaving scope preserves global system work')
assert.ok((await workbench.select(created.id)).ok)
assert.ok((await workbench.remove(created.id)).ok)
assert.equal(workbench.state.value.defaultId, SYSTEM_SKU_VIEW_ID)
assert.equal(workbench.activeId.value, SYSTEM_SKU_VIEW_ID)
assert.equal(workbench.state.value.favorites.includes(created.id), false)
assert.equal(JSON.stringify([store.data.families, store.data.skus, store.data.planningRecords, store.data.specModelVersions, store.data.materialReceipts]), storeBusiness)
assert.ok(skuConfigStamp(config))
scope.stop()
console.log('PASS work/apply/save/restore/name validation/favorites/default/delete/scoped saves, failure retry and business immutability')
