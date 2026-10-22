import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createPinia, setActivePinia } from 'pinia'
import { effectScope, nextTick, ref } from 'vue'
import { useSkuWorkbench } from '../src/components/product-list/useSkuWorkbench'
import { createSeed } from '../src/domain/seed'
import { ensureProductListPages } from '../src/domain/productListPages'
import { cloneSku, createSkuSavedView, defaultSkuConfig, ensureSkuWorkbench, SYSTEM_SKU_VIEW_ID } from '../src/domain/skuWorkbenchState'
import type { AppData, ProductListPageState } from '../src/domain/types'
import { DATA_VERSION, STORAGE_KEY } from '../src/domain/types'
import { useCatalogStore } from '../src/stores/catalog'

// Only the storage boundary is injected. Pinia, the composable, store commit,
// serializer and refresh normalization are the real production implementations.
const output = resolve(process.env.SKU_RESTORE_FIX_OUTPUT_DIR || 'work/sku-workbench-fixes')
const phase = process.env.SKU_RESTORE_FIX_PHASE || 'after'
mkdirSync(output, { recursive: true })
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
const disk = new Map<string, string>()
let failNext = false, attempts = 0, writes = 0
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => disk.get(key) ?? null,
  setItem: (key: string, text: string) => {
    attempts++
    if (failNext) { failNext = false; throw new DOMException('Restore quota failure injected at localStorage.setItem', 'QuotaExceededError') }
    writes++
    disk.set(key, String(text))
  },
  removeItem: (key: string) => disk.delete(key),
  clear: () => disk.clear(),
} })
const hash = (text: string) => createHash('sha256').update(text).digest('hex')
const serializedDisk = () => {
  const value = disk.get(STORAGE_KEY)
  assert.ok(value)
  return value
}
const diskPage = (): ProductListPageState => JSON.parse(serializedDisk()).data.productListPages.sku
const business = (data: AppData) => {
  const { productListPages: _page, ...rest } = data
  return JSON.stringify(rest)
}
const cases = [
  { name: 'ordinary-saved-view', view: 'restore-saved', scoped: false },
  { name: 'system-view', view: SYSTEM_SKU_VIEW_ID, scoped: false },
  { name: 'spu-scoped-system-view', view: SYSTEM_SKU_VIEW_ID, scoped: true },
  { name: 'spu-scoped-saved-view', view: 'restore-saved', scoped: true },
]
const records: unknown[] = []
function report(result: 'RUNNING' | 'PASS' | 'FAIL') {
  writeFileSync(resolve(output, `restore-${phase}.json`), JSON.stringify({ result, phase, boundary: 'isolated storage; actual Pinia/store/composable/serializer', records }, null, 2))
}

try {
  for (const test of cases) {
    disk.clear()
    const data = createSeed()
    ensureProductListPages(data)
    ensureSkuWorkbench(data)
    const initialPage = data.productListPages?.sku
    const parent = data.families[0], otherParent = data.families.find(item => item.id !== parent?.id)
    assert.ok(initialPage?.skuWorkbench && parent && otherParent)
    initialPage.views.push(createSkuSavedView('restore-saved', '恢复检查视图', defaultSkuConfig()))
    initialPage.views.push(createSkuSavedView('restore-other', '其他工作视图', defaultSkuConfig()))
    const otherScopedKey = `${SYSTEM_SKU_VIEW_ID}@spu:${otherParent.id}`
    initialPage.skuWorkbench.working['restore-other'] = { ...defaultSkuConfig(), density: 'compact', columns: [{ key: 'code', visible: true, width: 217 }] }
    initialPage.skuWorkbench.working[otherScopedKey] = { ...defaultSkuConfig(), categoryLayout: 'sidebar' }
    initialPage.skuWorkbench.activeId = SYSTEM_SKU_VIEW_ID
    initialPage.skuWorkbench.defaultId = SYSTEM_SKU_VIEW_ID
    initialPage.activeId = SYSTEM_SKU_VIEW_ID
    initialPage.views.forEach(view => { view.createdAt = '2026-10-22T04:00:00.000Z'; view.updatedAt = view.createdAt })
    disk.set(STORAGE_KEY, JSON.stringify({ version: DATA_VERSION, data }))

    setActivePinia(createPinia())
    const scope = effectScope()
    const scopeId = ref(test.scoped ? parent.id : '')
    const workbench = scope.run(() => useSkuWorkbench(scopeId))
    assert.ok(workbench)
    const store = useCatalogStore()
    assert.ok(workbench.select(test.view).ok)
    await nextTick()
    const key = test.scoped && test.view === SYSTEM_SKU_VIEW_ID ? `${SYSTEM_SKU_VIEW_ID}@spu:${parent.id}` : test.view
    assert.equal(workbench.config.value.density, 'comfortable')
    assert.equal(workbench.dirty.value, false)
    const saved = cloneSku(workbench.currentView.value)
    const beforeBusiness = business(store.data)
    const compact = cloneSku(workbench.config.value)
    compact.density = 'compact'
    compact.conditions.children = [{ kind: 'rule', id: 'restore-status', field: 'status', operator: 'eq', value: 'on_sale' }]
    compact.columns[0] = { key: 'code', visible: true, width: 183, frozen: 'left' }
    assert.ok(workbench.apply(compact).ok)
    await nextTick()
    assert.equal(workbench.dirty.value, true)
    assert.deepEqual(workbench.config.value, compact)
    assert.deepEqual(diskPage().skuWorkbench?.working[key], compact)

    const otherWorking = () => Object.fromEntries(Object.entries(store.data.productListPages?.sku.skuWorkbench?.working || {}).filter(([id]) => id !== key))
    const unrelatedBefore = cloneSku(otherWorking())
    const beforeDisk = serializedDisk()
    const beforePage = cloneSku(store.data.productListPages?.sku)
    const beforeAttempts = attempts, beforeWrites = writes
    failNext = true
    const failed = workbench.restore()
    await nextTick()
    const record = {
      name: test.name, workingKey: key, savedDensity: saved.skuWorkbench?.density,
      before: { config: compact, dirty: true, diskHash: hash(beforeDisk) },
      failed: { result: failed, config: cloneSku(workbench.config.value), dirty: workbench.dirty.value, error: workbench.error.value, diskWorking: diskPage().skuWorkbench?.working[key], diskHash: hash(serializedDisk()), actualSetItemAttempts: attempts - beforeAttempts, successfulWrites: writes - beforeWrites },
    }
    records.push(record)
    report('RUNNING')
    assert.equal(failed.ok, false, 'The actual localStorage write must fail')
    assert.equal(attempts - beforeAttempts, 1, 'Failure injection reaches the real persistence boundary once')
    assert.equal(writes - beforeWrites, 0)
    assert.equal(workbench.config.value.density, 'compact', 'Failed restore must keep the currently applied density')
    assert.deepEqual(workbench.config.value, compact, 'Failed restore keeps the entire working configuration')
    assert.equal(workbench.dirty.value, true, 'The existing !dirty restore-button condition must remain retryable')
    assert.match(workbench.error.value, /无法保存到本机.*Restore quota failure injected/)
    assert.equal(serializedDisk(), beforeDisk, 'Failed restore must not change persisted bytes')
    assert.deepEqual(store.data.productListPages?.sku, beforePage)
    assert.deepEqual(otherWorking(), unrelatedBefore)
    assert.deepEqual(workbench.currentView.value, saved)
    console.log(`PASS restore ${test.name}: storage failure retains compact/full work/dirty/retry and unrelated keys`)

    // The first failure is one-shot; retry goes through the same production command.
    const retry = workbench.restore()
    await nextTick()
    assert.equal(retry.ok, true)
    assert.equal(workbench.config.value.density, 'comfortable')
    assert.equal(workbench.dirty.value, false)
    assert.equal(workbench.error.value, '')
    assert.equal(store.data.productListPages?.sku.skuWorkbench?.working[key], undefined)
    assert.equal(diskPage().skuWorkbench?.working[key], undefined)
    assert.deepEqual(otherWorking(), unrelatedBefore)
    assert.equal(business(store.data), beforeBusiness)
    const restored = cloneSku(workbench.config.value)
    const afterDisk = serializedDisk()
    assert.equal(writes - beforeWrites, 1, 'Successful retry must not duplicate the deep-watch write')
    Object.assign(record, { retry: { result: retry, config: restored, dirty: false, diskHash: hash(afterDisk), successfulWrites: writes - beforeWrites } })
    scope.stop()
    store.$dispose()

    // A new Pinia instance reads only serialized storage, as a refreshed page does.
    setActivePinia(createPinia())
    const refreshedScope = effectScope()
    const refreshed = refreshedScope.run(() => useSkuWorkbench(ref(test.scoped ? parent.id : '')))
    assert.ok(refreshed)
    assert.ok(refreshed.select(test.view).ok)
    await nextTick()
    const refreshedStore = useCatalogStore()
    assert.deepEqual(refreshed.config.value, restored)
    assert.equal(refreshed.dirty.value, false)
    assert.equal(refreshedStore.data.productListPages?.sku.skuWorkbench?.working[key], undefined)
    const unrelatedLoaded = Object.fromEntries(Object.entries(refreshedStore.data.productListPages?.sku.skuWorkbench?.working || {}).filter(([id]) => id !== key))
    assert.deepEqual(unrelatedLoaded, unrelatedBefore)
    assert.equal(business(refreshedStore.data), beforeBusiness)
    Object.assign(record, { refresh: { density: refreshed.config.value.density, dirty: refreshed.dirty.value, unrelatedWorkingKeys: Object.keys(unrelatedLoaded) } })
    refreshedScope.stop()
    refreshedStore.$dispose()
    console.log(`PASS restore ${test.name}: retry commits once, clears only target work, and survives serialized reload`)
  }
  report('PASS')
  console.log(`PASS ${cases.length} restore transaction cases with real Pinia/store/storage serialization`)
} catch (error) {
  report('FAIL')
  throw error
} finally {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
  else Reflect.deleteProperty(globalThis, 'localStorage')
}
