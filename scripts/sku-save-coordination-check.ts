import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { effectScope, nextTick, ref } from 'vue'
import { installCatalogTestLocks } from './catalog-storage-test-env'
import { createSeed } from '../src/domain/seed'
import { ensureRbac } from '../src/domain/rbac'
import { DATA_VERSION, STORAGE_KEY } from '../src/domain/types'
import { RBAC_ENFORCEMENT_ENABLED } from '../src/domain/accessMode'
import { cloneSku, SYSTEM_SKU_VIEW_ID } from '../src/domain/skuWorkbenchState'
import { skuCategorySelection, updateSkuCategorySelection } from '../src/domain/skuCategoryFilter'
import { clearSkuFilterValues } from '../src/domain/skuQuickFilters'
import { skuFields } from '../src/domain/skuWorkbenchFields'
import { useCatalogStore } from '../src/stores/catalog'
import { useSkuWorkbench } from '../src/components/product-list/useSkuWorkbench'

installCatalogTestLocks()
const request=navigator.locks.request.bind(navigator.locks)
let hold=false,release:()=>void=()=>{},entered:()=>void=()=>{},fail=false,writes=0,groups=0
Object.defineProperty(navigator.locks,'request',{value:(name:string,options:LockOptions,callback:LockGrantedCallback)=>request(name,options,async lock=>{if(hold){hold=false;entered();await new Promise<void>(resolve=>release=resolve)}return callback(lock)})})
const disk=new Map<string,string>(),session=new Map<string,string>()
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>disk.get(key)??null,setItem:(key:string,value:string)=>{if(fail&&key===STORAGE_KEY)throw Error('delayed-save quota');disk.set(key,value);if(key===STORAGE_KEY)writes++},removeItem:(key:string)=>disk.delete(key)}})
Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:(key:string)=>session.get(key)??null,setItem:(key:string,value:string)=>session.set(key,value),removeItem:(key:string)=>session.delete(key)}})
const data=createSeed();ensureRbac(data)
data.users.push({id:'queue-reader',username:'queue-reader',displayName:'queue-reader',enabled:true,role:'operator',roleIds:[]})
session.set('iyge-rbac-simulated-user','u-admin');disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data}));setActivePinia(createPinia())
const store=useCatalogStore();await store.waitForPersistence()
const scope=effectScope(),spu=ref(''),wb=scope.run(()=>useSkuWorkbench(spu))!
await wb.flush();await store.waitForPersistence()
const business=JSON.stringify([store.data.families,store.data.skus,store.data.categories,store.data.paramValues])
const cats=store.data.categories.slice(0,3).map(c=>c.id);assert.equal(cats.length,3)
const diskPage=()=>JSON.parse(disk.get(STORAGE_KEY)!).data.productListPages.sku
const work=()=>diskPage().skuWorkbench.working[wb.activeId.value]
const category=(id:string)=>updateSkuCategorySelection(wb.config.value,[id])!
function gate(){hold=true;return new Promise<void>(resolve=>entered=resolve)}
function mark(name:string){groups++;console.log(`PASS SKU coordinated save: ${name}`)}
let ready=gate();const first=wb.apply(category(cats[0]!));await ready
const count=writes;assert(wb.update(category(cats[1]!)).ok);assert(wb.update(category(cats[2]!)).ok)
assert.deepEqual(skuCategorySelection(wb.config.value).ids,[cats[2]]);assert.equal(writes,count)
release();assert((await first).ok);assert((await wb.flush()).ok);assert.deepEqual(skuCategorySelection(work()).ids,[cats[2]])
mark('A → B → C before first lock completes: immediate C, serial/coalesced persistence')
ready=gate();wb.update(category(cats[0]!));await ready
const brand=skuFields(store.data).find(f=>f.id==='brand')!;assert(brand)
const combined=cloneSku(wb.config.value);combined.conditions.children.push({kind:'rule',id:'brand-queue',field:'brand',operator:'eq',value:brand.options[0]?.value||'Apple'});wb.update(combined)
assert.equal(wb.config.value.conditions.children.length,2);release();assert((await wb.flush()).ok)
assert.equal(work().conditions.children.length,2);mark('category + brand merge retains both independent edits')
ready=gate();wb.update(category(cats[1]!));await ready;wb.update(clearSkuFilterValues(wb.config.value));wb.updateQuery({keyword:'',page:1})
assert.equal(wb.config.value.conditions.children.every(r=>r.kind==='rule'&&r.active===false),true)
release();assert((await wb.flush()).ok);assert.equal(work().conditions.children.every((r:any)=>r.active===false),true)
mark('clear supersedes in-flight filters and late response cannot revive old values')
const one=await wb.create('queue view one');assert(one.ok&&one.id);const two=await wb.create('queue view two');assert(two.ok&&two.id)
await wb.select(one.id!);await wb.flush();ready=gate();wb.update(category(cats[0]!));await ready
await wb.select(two.id!);assert.equal(wb.activeId.value,two.id);wb.update(category(cats[2]!));release();assert((await wb.flush()).ok)
assert.deepEqual(skuCategorySelection(diskPage().skuWorkbench.working[one.id!]).ids,[cats[0]])
assert.deepEqual(skuCategorySelection(diskPage().skuWorkbench.working[two.id!]).ids,[cats[2]])
mark('view switch while saving preserves both view-owned drafts and active selection')
const before=disk.get(STORAGE_KEY);fail=true;assert.equal((await wb.apply(category(cats[1]!))).ok,false);assert.equal(disk.get(STORAGE_KEY),before)
assert.equal(wb.saveState.value,'failed');wb.update(clearSkuFilterValues(wb.config.value));assert.equal(wb.saveState.value,'failed');fail=false
assert((await wb.retry()).ok);assert(work().conditions.children.every((r:any)=>r.active===false));mark('atomic failure then edit/clear and retry persists latest intent only')
await wb.select(SYSTEM_SKU_VIEW_ID);await wb.flush();spu.value=store.data.families[0]!.id;await nextTick()
const scopedKey=`${SYSTEM_SKU_VIEW_ID}@spu:${spu.value}`;ready=gate();wb.update(category(cats[1]!));await ready
spu.value='';await nextTick();wb.update(category(cats[2]!));release();assert((await wb.flush()).ok)
assert.deepEqual(skuCategorySelection(diskPage().skuWorkbench.working[scopedKey]).ids,[cats[1]])
assert.deepEqual(skuCategorySelection(diskPage().skuWorkbench.working[SYSTEM_SKU_VIEW_ID]).ids,[cats[2]])
mark('temporary SPU workingKey remains isolated when scope changes during save')
await wb.select(one.id!);await wb.flush();ready=gate();wb.update(category(cats[2]!));await ready
const savingView=wb.save();release();assert((await savingView).ok)
assert.deepEqual(skuCategorySelection(diskPage().views.find((v:any)=>v.id===one.id).skuWorkbench).ids,[cats[2]])
const writesBefore=writes;wb.update(cloneSku(wb.config.value));await wb.flush();assert.equal(writes,writesBefore)
mark('explicit named-view save flushes click-time work; identical config does not write')
wb.update(category(cats[0]!));assert((await wb.flush()).ok)
ready=gate();const namedSave=wb.save();await ready;wb.update(category(cats[2]!));release();assert((await namedSave).ok);assert((await wb.flush()).ok)
assert.deepEqual(skuCategorySelection(wb.config.value).ids,[cats[2]])
assert.deepEqual(skuCategorySelection(diskPage().views.find((v:any)=>v.id===one.id).skuWorkbench).ids,[cats[0]])
assert.deepEqual(skuCategorySelection(work()).ids,[cats[2]])
mark('late named-save response preserves edits accepted after its click and advances only its own baseline')
ready=gate();wb.update(category(cats[1]!));await ready;const beforePreview=disk.get(STORAGE_KEY)
assert(store.startPermissionPreview('queue-reader').ok);if(RBAC_ENFORCEMENT_ENABLED)assert.equal(wb.update(category(cats[0]!)).ok,false)
release();await store.waitForPersistence();assert.equal(disk.get(STORAGE_KEY),beforePreview)
assert(store.stopPermissionPreview().ok);assert.deepEqual(skuCategorySelection(wb.config.value).ids,[cats[1]])
assert.equal(wb.saveState.value,'failed');assert((await wb.retry()).ok)
mark('preview identity invalidates old lock task and restores owner draft for explicit retry')
ready=gate();wb.update(category(cats[0]!));await ready;const beforeActor=disk.get(STORAGE_KEY)
assert(store.simulateUser('queue-reader').ok);release();await store.waitForPersistence();assert.equal(disk.get(STORAGE_KEY),beforeActor)
assert(store.stopPermissionPreview().ok);assert.deepEqual(skuCategorySelection(wb.config.value).ids,[cats[0]]);assert((await wb.retry()).ok)
mark('actor switch isolates pending work and never commits under the next identity')
ready=gate();wb.update(category(cats[2]!));await ready
store.data.productListPages!.sku.query.pageSize=73
release();assert.equal((await wb.flush()).ok,false);await store.waitForPersistence()
assert.deepEqual(skuCategorySelection(wb.config.value).ids,[cats[2]])
assert((await wb.retry()).ok);assert.equal(diskPage().query.pageSize,73)
mark('Store page conflict rejects stale snapshot; retry builds from current page and keeps latest work')
const beforeSearchWrites=writes;wb.updateQuery({keyword:'手'});wb.updateQuery({keyword:'手机'});wb.updateQuery({keyword:'手机查询'})
assert.equal(wb.query.value.keyword,'手机查询');assert.equal(writes,beforeSearchWrites);await wb.flush();assert.equal(writes,beforeSearchWrites+1)
mark('search input immediately updates and coalesces repeated persistence')
ready=gate();wb.update(category(cats[1]!));await ready;const beforeDispose=disk.get(STORAGE_KEY);scope.stop();release();await store.waitForPersistence();assert.equal(disk.get(STORAGE_KEY),beforeDispose)
mark('dispose invalidates queued persistence before lock callback; business data unchanged')
const conflictScope=effectScope(),conflict=conflictScope.run(()=>useSkuWorkbench(ref('')))!;await conflict.flush()
const conflictKey=conflict.activeId.value
const cleanUpdate=cloneSku(conflict.config.value);cleanUpdate.density=cleanUpdate.density==='compact'?'comfortable':'compact'
store.data.productListPages!.sku.skuWorkbench!.working[conflictKey]=cleanUpdate
assert.equal(conflict.config.value.density,cleanUpdate.density,'Clean configuration follows current persisted work before the next intent')
await store.waitForPersistence()
assert((await conflict.apply(updateSkuCategorySelection(conflict.config.value,[cats[1]!])!)).ok)
assert.equal(diskPage().skuWorkbench.working[conflictKey].density,cleanUpdate.density)
mark('clean work reads current Store configuration before accepting the next local edit')
ready=gate();conflict.update(updateSkuCategorySelection(conflict.config.value,[cats[0]!])!);await ready
const external=cloneSku(store.data.productListPages!.sku.skuWorkbench!.working[conflictKey]||conflict.config.value)
external.density=external.density==='compact'?'comfortable':'compact'
store.data.productListPages!.sku.skuWorkbench!.working[conflictKey]=external
release();assert.equal((await conflict.flush()).ok,false);await store.waitForPersistence()
const beforeConflictRetry=disk.get(STORAGE_KEY)
assert.equal((await conflict.retry()).ok,false,'Same workingKey changed externally must not be overwritten by a fresh retry snapshot')
assert.equal(disk.get(STORAGE_KEY),beforeConflictRetry)
assert.deepEqual(skuCategorySelection(conflict.config.value).ids,[cats[0]])
assert.equal(diskPage().skuWorkbench.working[conflictKey].density,external.density)
conflictScope.stop();mark('same workingKey external revision remains protected on retry; retained local intent is not lost')
assert.equal(JSON.stringify([store.data.families,store.data.skus,store.data.categories,store.data.paramValues]),business)
store.$dispose()
console.log(`PASS SKU save coordination ${RBAC_ENFORCEMENT_ENABLED?'strict':'default'} ${groups} groups`)
