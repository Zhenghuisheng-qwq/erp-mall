import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createPinia, setActivePinia } from 'pinia'
import { effectScope, ref } from 'vue'
import { installCatalogTestLocks } from './catalog-storage-test-env'
import { createTemplateCompatibilityFixture } from './template-compatibility-fixtures'
import { useCatalogStore } from '../src/stores/catalog'
import { useSkuWorkbench } from '../src/components/product-list/useSkuWorkbench'
import { DATA_VERSION, STORAGE_KEY, type ProductListPageState } from '../src/domain/types'

installCatalogTestLocks()
const disk = new Map<string, string>(), data = createTemplateCompatibilityFixture().data
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => disk.get(key) ?? null, setItem: (key: string, value: string) => disk.set(key, value) } })
disk.set(STORAGE_KEY, JSON.stringify({ version: DATA_VERSION, data }))
setActivePinia(createPinia())
const store = useCatalogStore(); await store.waitForPersistence()
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const page = () => copy(store.data.productListPages!.sku)
const business = JSON.stringify([store.data.families, store.data.skus, store.data.benefitPackages, store.data.benefitDeliveries, store.data.specModelVersions, store.data.planningRecords])
const checks: { name: string; result: string }[] = []
function mark(name: string) { checks.push({ name, result: 'PASS' }); console.log(`PASS async save ${name}`) }
const first = page(), second = page()
first.query.pageSize = 41; second.query.pageSize = 43
const outcomes = await Promise.all([store.commitSkuPage(first), store.commitSkuPage(second)])
assert.equal(outcomes[0]!.ok, true); assert.equal(outcomes[1]!.ok, false)
assert.equal(store.data.productListPages!.sku.query.pageSize, 41)
assert.equal(JSON.parse(disk.get(STORAGE_KEY)!).data.productListPages.sku.query.pageSize, 41)
mark('same-page-stale-SKU-candidate-rejected-in-lock')

const third = page(); third.query.pageSize = 30
const pending = store.commitSkuPage(third)
store.data.productListPages!.spu.query.pageSize = 17
assert((await pending).ok)
assert.equal(store.data.productListPages!.spu.query.pageSize, 17)
assert.equal(JSON.parse(disk.get(STORAGE_KEY)!).data.productListPages.spu.query.pageSize, 17)
mark('unrelated-SPU-preference-preserved-without-rejecting-SKU')

const scope = effectScope(), workbench = scope.run(() => useSkuWorkbench(ref('')))
assert(workbench)
await store.waitForPersistence()
const before = store.data.productListPages!.sku.views.length
const creating = workbench.create('同页第一条保存视图')
assert.equal(workbench.pending.value, true)
const duplicate = await workbench.create('等待期间第二条不应覆盖第一条')
assert.equal(duplicate.ok, false)
assert((await creating).ok); assert.equal(workbench.pending.value, false)
assert.equal(store.data.productListPages!.sku.views.length, before + 1)
assert(store.data.productListPages!.sku.views.some(view => view.name === '同页第一条保存视图'))
assert(!store.data.productListPages!.sku.views.some(view => view.name === '等待期间第二条不应覆盖第一条'))
mark('composable-pending-rejects-second-name-save-no-duplicate')

assert.equal(JSON.stringify([store.data.families, store.data.skus, store.data.benefitPackages, store.data.benefitDeliveries, store.data.specModelVersions, store.data.planningRecords]), business)
const loaded = JSON.parse(disk.get(STORAGE_KEY)!).data.productListPages.sku as ProductListPageState
assert.deepEqual(loaded, copy(store.data.productListPages!.sku))
mark('view-settings-only-and-disk-live-equality')
const output = resolve(process.env.CATALOG_ASYNC_OUTPUT || 'work/compatibility-benefit-refinement/async-save')
mkdirSync(output, { recursive: true }); writeFileSync(resolve(output, 'state.json'), JSON.stringify({ result: 'PASS', checks }, null, 2))
scope.stop(); store.$dispose()
