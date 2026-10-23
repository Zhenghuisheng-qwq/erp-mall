import { installCatalogTestLocks } from './catalog-storage-test-env'
installCatalogTestLocks()
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createPinia, setActivePinia } from 'pinia'
import { effectScope, nextTick, ref } from 'vue'
import { createSeed, emptyQuery } from '../src/domain/seed'
import { ensureProductListPages } from '../src/domain/productListPages'
import { cloneSku, ensureSkuWorkbench, SYSTEM_SKU_VIEW_ID } from '../src/domain/skuWorkbenchState'
import { useSkuWorkbench } from '../src/components/product-list/useSkuWorkbench'
import { normalizeStored, useCatalogStore } from '../src/stores/catalog'
import { DATA_VERSION, STORAGE_KEY } from '../src/domain/types'
import type { AppData, ProductListPageState } from '../src/domain/types'

const phase = process.argv.includes('--before') ? 'before' : 'after'
const output = resolve(process.env.SKU_MIGRATION_FIX_OUTPUT || 'work/sku-workbench-fixes/migration')
mkdirSync(output, { recursive: true })
const disk = new Map<string, string>(), writes: string[] = []
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => disk.get(key) ?? null,
  setItem: (key: string, value: string) => { disk.set(key, value); if (key === STORAGE_KEY) writes.push(value) },
  removeItem: (key: string) => disk.delete(key), clear: () => disk.clear(),
} })
const fixture = createSeed()
ensureProductListPages(fixture)
const fixturePage = fixture.productListPages?.sku
assert.ok(fixturePage)
fixturePage.presets = [
  { id: 'legacy-delete', name: '删除后应保留删除', query: { ...emptyQuery(), keyword: 'Apple' }, columns: [] },
  { id: 'legacy-edited', name: '用户将修改的迁移视图', query: emptyQuery(), columns: [] },
]
fixturePage.views = fixturePage.views.filter(view => !view.id.startsWith('sku-preset:'))
delete fixturePage.skuWorkbench
const originalPresets = cloneSku(fixturePage.presets), originalSpu = cloneSku(fixture.productListPages?.spu)
const business = (data: AppData) => cloneSku({ families: data.families, skus: data.skus, planningRecords: data.planningRecords, specModelVersions: data.specModelVersions, materialReceipts: data.materialReceipts, compatibilities: data.compatibilities })
const originalBusiness = business(fixture)
const deletedId = 'sku-preset:legacy-delete', editedId = 'sku-preset:legacy-edited'
const observations: { name: string; page: ProductListPageState; persisted: string | null }[] = []
function mount() {
  setActivePinia(createPinia())
  const scope = effectScope()
  const view = scope.run(() => useSkuWorkbench(ref('')))
  assert.ok(view)
  const store = useCatalogStore()
  const page = () => { const value = store.data.productListPages?.sku; assert.ok(value); return value }
  const capture = (name: string) => observations.push({ name, page: cloneSku(page()), persisted: localStorage.getItem(STORAGE_KEY) })
  const dispose = async () => { await nextTick(); await store.waitForPersistence(); scope.stop(); store.$dispose() }
  return { view, store, page, capture, dispose }
}
function validReferences(page: ProductListPageState) {
  const state = page.skuWorkbench
  assert.ok(state)
  const ids = new Set(page.views.map(view => view.id))
  assert.ok(ids.has(page.activeId))
  assert.ok(ids.has(state.activeId))
  assert.ok(ids.has(state.defaultId))
  for (const id of [...state.favorites, ...state.order, ...Object.keys(state.working)]) assert.ok(ids.has(id) || id.startsWith(`${SYSTEM_SKU_VIEW_ID}@spu:`), `Invalid view preference ${id}`)
}
disk.set(STORAGE_KEY, JSON.stringify({ version: DATA_VERSION, data: fixture }))
async function ready() { await running.store.waitForPersistence(); await nextTick(); assert.equal(running.view.pending.value, false) }
let running = mount(); await ready()
try {
  assert.equal(running.page().views.filter(view => view.id === deletedId).length, 1)
  assert.equal(running.page().views.filter(view => view.id === editedId).length, 1)
  assert.deepEqual(running.page().presets, originalPresets)
  assert.equal(ensureSkuWorkbench(running.store.data), false)
  running.capture('first-and-repeat-migration')
  assert.ok((await running.view.rename(editedId, '用户改名 · 不可重置')).ok)
  assert.ok((await running.view.select(editedId)).ok)
  assert.ok((await running.view.apply({ ...cloneSku(running.view.config.value), density: 'compact' })).ok)
  assert.ok((await running.view.save()).ok)
  const editedView = cloneSku(running.page().views.find(view => view.id === editedId))
  assert.ok(editedView)
  assert.ok((await running.view.select(deletedId)).ok)
  assert.ok((await running.view.favorite(deletedId)).ok)
  assert.ok((await running.view.setDefault(deletedId)).ok)
  assert.ok((await running.view.apply({ ...cloneSku(running.view.config.value), density: 'compact' })).ok)
  assert.ok(running.page().skuWorkbench?.working[deletedId])
  assert.ok((await running.view.remove(deletedId)).ok)
  assert.equal(running.page().views.some(view => view.id === deletedId), false)
  assert.equal(running.view.activeId.value, SYSTEM_SKU_VIEW_ID)
  assert.equal(running.page().skuWorkbench?.working[deletedId], undefined)
  assert.equal(running.page().skuWorkbench?.favorites.includes(deletedId), false)
  validReferences(running.page())
  await nextTick()
  running.capture('deleted-through-composable-and-store')
  ensureSkuWorkbench(running.store.data)
  await nextTick()
  running.capture('reinitialized-after-deletion')
  assert.equal(running.page().views.some(view => view.id === deletedId), false, 'Deleted migrated preset must stay deleted after initialization')
  assert.ok(running.page().skuWorkbench?.migratedPresetIds?.includes('legacy-delete'))
  assert.deepEqual(running.page().views.find(view => view.id === editedId), editedView)
  assert.equal(ensureSkuWorkbench(running.store.data), false)
  await running.dispose()
  running = mount(); await ready()
  assert.equal(running.view.views.value.some(view => view.id === deletedId), false, 'Deleted migrated preset must stay deleted on page re-entry')
  await nextTick()
  running.capture('page-reentry')
  const exported = running.store.exportJson()
  await running.dispose()
  disk.set(STORAGE_KEY, exported)
  running = mount(); await ready()
  assert.equal(running.page().views.some(view => view.id === deletedId), false, 'Disk reload must retain migration history after deletion')
  assert.ok(running.page().skuWorkbench?.migratedPresetIds?.includes('legacy-delete'))
  assert.deepEqual(running.page().views.find(view => view.id === editedId), editedView)
  running.capture('disk-reload')
  running.page().presets.push({ id: 'legacy-new', name: '尚未迁移预设', query: emptyQuery(), columns: [] })
  assert.equal(ensureSkuWorkbench(running.store.data), true)
  assert.equal(running.page().views.filter(view => view.id === 'sku-preset:legacy-new').length, 1)
  assert.equal(running.page().views.some(view => view.id === deletedId), false)
  assert.equal(ensureSkuWorkbench(running.store.data), false)
  const recordedMigrations = cloneSku(running.page().skuWorkbench?.migratedPresetIds)
  const copied = (await running.view.copy(editedId))
  assert.ok(copied.ok && copied.id)
  assert.deepEqual(running.page().skuWorkbench?.migratedPresetIds, recordedMigrations, 'View-copy page cloning retains completed migration events')
  assert.ok((await running.view.remove(copied.id)).ok)
  validReferences(running.page())
  running.capture('new-preset-still-migrates')
  const imported = running.store.exportJson()
  await running.store.importJson(imported)
  assert.equal(running.page().views.some(view => view.id === deletedId), false)
  assert.deepEqual(running.page().views.find(view => view.id === editedId), editedView)
  assert.deepEqual(running.store.data.productListPages?.spu, originalSpu)
  assert.deepEqual(business(running.store.data), originalBusiness)
  validReferences(running.page())
  running.capture('export-import-retains-deletion-and-user-edits')
  const oldImport = cloneSku(fixture)
  const oldPage = oldImport.productListPages?.sku
  assert.ok(oldPage)
  oldPage.views.push(cloneSku(editedView))
  oldPage.presets.push({ id: 'legacy-old-import', name: '旧文件尚未迁移', query: emptyQuery(), columns: [] })
  const oldLoaded = normalizeStored({ version: DATA_VERSION, data: oldImport })
  assert.ok(oldLoaded)
  assert.equal(oldLoaded.productListPages?.sku.views.filter(view => view.id === 'sku-preset:legacy-old-import').length, 1)
  assert.deepEqual(oldLoaded.productListPages?.sku.views.find(view => view.id === editedId), editedView)
  const oldAgain = normalizeStored({ version: DATA_VERSION, data: cloneSku(oldLoaded) })
  assert.deepEqual(oldAgain, oldLoaded)
  const repairedEvents = oldLoaded.productListPages?.sku.skuWorkbench?.migratedPresetIds
  assert.ok(repairedEvents)
  assert.ok(repairedEvents.includes('legacy-edited'))
  assert.ok(repairedEvents.includes('legacy-old-import'))
  assert.equal(new Set(repairedEvents).size, repairedEvents.length)
  assert.deepEqual(oldLoaded.productListPages?.spu, originalSpu)
  assert.deepEqual(business(oldLoaded), originalBusiness)
  writeFileSync(resolve(output, `${phase}-result.json`), JSON.stringify({ result: 'PASS', phase, observations, writes: writes.length, oldImport: oldLoaded.productListPages?.sku }, null, 2))
  console.log('PASS first/repeat migration, real delete/re-entry/reload/export/import, new/old presets, user edits, valid preferences and unchanged business/SPU data')
} catch (error) {
  writeFileSync(resolve(output, `${phase}-result.json`), JSON.stringify({ result: 'FAIL', phase, error: String(error), observations, writes: writes.length }, null, 2))
  throw error
} finally { await running.dispose() }
