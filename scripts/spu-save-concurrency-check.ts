import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { effectScope, ref } from 'vue'
import { installCatalogTestLocks } from './catalog-storage-test-env'
import { createCatalogProductFixture } from './catalog-product-fixture'
import { useCatalogStore } from '../src/stores/catalog'
import { useProductListPageDraft } from '../src/components/product-list/useProductListPageDraft'
import { productListPageData } from '../src/domain/productListPages'
import { activeProductListView, currentModeQuery, createProductListView, selectProductListView } from '../src/domain/productListViews'
import { clearProductListFilterValue, emptyModeQuery, updateProductCategorySelection } from '../src/domain/productListQuery'
import { DATA_VERSION, STORAGE_KEY, type ProductListPageState } from '../src/domain/types'

installCatalogTestLocks()
const request = navigator.locks.request.bind(navigator.locks)
let gate: { entered: () => void; wait: Promise<void> } | undefined
navigator.locks.request = ((name: string, options: LockOptions, callback: LockGrantedCallback) => {
  const held = gate; gate = undefined
  return request(name, options, async lock => { if (held) { held.entered(); await held.wait }; return callback(lock) })
}) as typeof navigator.locks.request
function delay() {
  let entered!: () => void, release!: () => void
  const ready = new Promise<void>(resolve => { entered = resolve })
  const wait = new Promise<void>(resolve => { release = resolve })
  gate = { entered, wait }; return { ready, release }
}
const disk = new Map<string, string>()
let fail = false, writes = 0
const storage = { getItem: (key: string) => disk.get(key) ?? null, removeItem: (key: string) => disk.delete(key), setItem: (key: string, value: string) => {
  if (key === STORAGE_KEY) { if (fail) throw new DOMException('test quota', 'QuotaExceededError'); writes++ }
  disk.set(key, value)
} }
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage })
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value))
async function fixture() {
  disk.clear(); fail = false
  const { data } = createCatalogProductFixture()
  disk.set(STORAGE_KEY, JSON.stringify({ version: DATA_VERSION, data }))
  setActivePinia(createPinia()); const store = useCatalogStore(); await store.waitForPersistence()
  const scope = effectScope(), temporary = ref<ProductListPageState>()
  const page = scope.run(() => useProductListPageDraft('spu', temporary))!
  const dataForDraft = () => productListPageData(store.data, 'spu', page.pageDraft.value)
  const view = () => activeProductListView(dataForDraft())
  view().spuQuery = emptyModeQuery('spu')
  assert(await page.persistPage())
  const query = () => currentModeQuery(view())
  const category = (id: string) => Object.assign(query(), updateProductCategorySelection(store.data, query(), [id])!)
  const keyword = (text: string) => { query().keyword = text }
  const persisted = () => store.data.productListPages!.spu
  const diskPage = () => JSON.parse(disk.get(STORAGE_KEY)!).data.productListPages.spu
  const cleanup = () => { scope.stop(); store.$dispose() }
  return { store, scope, temporary, page, dataForDraft, view, query, category, keyword, persisted, diskPage, cleanup }
}
let groups = 0
function mark(name: string) { groups++; console.log(`PASS SPU save: ${name}`) }

{
  const f = await fixture(), held = delay(), count = writes
  f.category('cat-device-test'); const saving = f.page.persistPage(); await held.ready
  f.category('cat-accessory-test'); f.category('cat-device-test')
  f.query().filters.push({ id:'brand-intent', field:'brand', operator:'in', value:['DeviceLab'], active:true })
  assert.equal(f.page.saveStatus.value, '保存中')
  assert.deepEqual(f.query().filters.find(x=>x.field==='category')!.value,['cat-device-test'])
  assert(!f.persisted().views.find(x=>x.id===f.view().id)!.spuQuery!.filters.some(x=>x.id==='brand-intent'))
  held.release(); assert(await saving)
  assert.deepEqual(f.diskPage(),copy(f.page.pageDraft.value)); assert.equal(writes-count,2)
  assert.equal(f.page.saveStatus.value,'已保存')
  assert(await f.page.persistPage()); assert.equal(writes-count,2)
  f.cleanup(); mark('A → B → C plus brand is immediate; two serial writes, no unchanged write')
}
{
  const f=await fixture(),held=delay()
  f.query().exposed=['name','brand']; f.query().filters.push({id:'name-intent',field:'name',operator:'contains',value:'旧输入',active:true})
  f.keyword('关键词');const saving=f.page.persistPage();await held.ready
  const before=copy(f.view())
  Object.assign(f.query(),clearProductListFilterValue(f.query(),'name-intent'));f.keyword('')
  assert.equal(f.query().filters[0]!.active,false)
  held.release();assert(await saving)
  assert.equal(f.query().keyword,'');assert.equal(f.query().filters[0]!.active,false)
  assert.deepEqual(f.query().exposed,['name','brand']);assert.deepEqual(f.view().columns,before.columns)
  assert.deepEqual(f.diskPage(),copy(f.page.pageDraft.value))
  f.cleanup();mark('clear while first save waits stays cleared; identity/operator/display and columns retained')
}
{
  const f=await fixture(), first=f.view().id
  const created=createProductListView(f.dataForDraft(),'第二视图',first,()=> 'second-intent');assert(created.ok)
  selectProductListView(f.dataForDraft(),first);assert(await f.page.persistPage())
  const held=delay();f.keyword('视图一');const saving=f.page.persistPage();await held.ready
  assert(selectProductListView(f.dataForDraft(),'second-intent').ok);f.keyword('视图二')
  assert.equal(f.view().id,'second-intent');held.release();assert(await saving)
  assert.equal(f.diskPage().views.find((x:{id:string})=>x.id===first).spuQuery.keyword,'视图一')
  assert.equal(f.diskPage().views.find((x:{id:string})=>x.id==='second-intent').spuQuery.keyword,'视图二')
  f.cleanup();mark('view switch during saving preserves both views without old-response navigation')
}
{
  const f=await fixture(),raw=disk.get(STORAGE_KEY)
  fail=true;f.keyword('A');assert.equal(await f.page.persistPage(),false)
  assert.equal(disk.get(STORAGE_KEY),raw);assert.match(f.page.saveStatus.value,/保存失败/)
  f.keyword('B');f.keyword('');f.category('cat-device-test')
  fail=false;assert(await f.page.retryPageSave())
  assert.equal(f.query().keyword,'');assert.deepEqual(f.diskPage(),copy(f.page.pageDraft.value))
  f.cleanup();mark('quota failure writes nothing; edits and clear survive; retry saves latest, never A')
}
{
  const f=await fixture(),held=delay(),before=copy(f.persisted())
  f.keyword('old actor');const saving=f.page.persistPage();await held.ready
  const other=f.store.data.users.find(user=>user.id!==f.store.activeUserId&&user.enabled)!
  assert(f.store.startPermissionPreview(other.id).ok)
  held.release();assert.equal(await saving,false)
  assert.deepEqual(copy(f.persisted()),before)
  assert.notEqual(f.query().keyword,'old actor')
  f.cleanup();mark('preview identity change invalidates old queued write and isolates local draft')
}
{
  const f=await fixture(),held=delay(),before=copy(f.persisted())
  f.keyword('disposed');const saving=f.page.persistPage();await held.ready
  f.scope.stop();held.release();assert.equal(await saving,false)
  assert.deepEqual(copy(f.persisted()),before);f.store.$dispose()
  mark('scope disposal invalidates a waiting Store write')
}
{
  const f=await fixture(),held=delay(),before=copy(f.persisted())
  f.keyword('temporary');const saving=f.page.persistPage();await held.ready
  f.temporary.value=copy(before);held.release();assert.equal(await saving,false)
  assert.deepEqual(copy(f.persisted()),before);f.cleanup()
  mark('temporary scope transition cannot persist the earlier context')
}
{
  const f=await fixture(),external=copy(f.persisted())
  f.keyword('local');external.query.pageSize=37
  assert((await f.store.commitSpuPage(external)).ok)
  assert.equal(await f.page.retryPageSave(),false)
  assert.equal(f.persisted().query.pageSize,37);assert.equal(f.query().keyword,'local')
  f.cleanup();mark('external page conflict remains protected and local draft is retained')
}
console.log(`PASS SPU save concurrency ${groups} groups (${import.meta.env.VITE_RBAC_ENFORCEMENT==='true'?'strict':'default'})`)
