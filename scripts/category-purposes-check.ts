import assert from 'node:assert/strict'
import {createPinia,setActivePinia} from 'pinia'
import {installCatalogTestLocks} from './catalog-storage-test-env'
import {bundleFixture} from './type-bundle-fixture'
import {useCatalogStore} from '../src/stores/catalog'
import {STORAGE_KEY,DATA_VERSION} from '../src/domain/types'
import {categoryPurposes,categoryPurposeLabel,categoryPurposeId} from '../src/domain/categoryPurposes'
import {roleOfType} from '../src/domain/compatibility'
installCatalogTestLocks()
const {data}=bundleFixture(),disk=new Map<string,string>();let fail=false
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>disk.get(k)??null,setItem:(k:string,v:string)=>{if(fail){fail=false;throw Error('quota')};disk.set(k,v)},removeItem:(k:string)=>disk.delete(k)}})
data.categories.push({id:'legacy-bound',name:'旧用途分类',parentId:null,sort:99,enabled:true,catalogRole:'accessory'})
disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data}));setActivePinia(createPinia());const store=useCatalogStore();await store.waitForPersistence()
const purpose={id:'repair',name:'维修',behavior:'accessory' as const},before=store.exportJson();fail=true
assert(!(await store.saveCategoryPurpose(purpose,null)).ok);assert.equal(store.exportJson(),before)
assert((await store.saveCategoryPurpose(purpose,null)).ok)
assert(!(await store.saveCategoryPurpose({...purpose,id:'duplicate'},null)).ok)
const category={id:'repair-category',name:'手机维修',parentId:null,purposeId:'repair'}
assert((await store.saveBoundCategory(category,null)).ok)
assert(!(await store.removeCategoryPurpose('repair',JSON.stringify(purpose))).ok)
assert(!(await store.saveCategoryPurpose({...purpose,behavior:'host'},JSON.stringify(purpose))).ok)
assert((await store.saveCategoryPurpose({...purpose,name:'维修服务'},JSON.stringify(purpose))).ok)
assert.equal(categoryPurposeLabel(store.data,store.data.categories.find(c=>c.id===category.id)),'维修服务')
assert(!(await store.saveCategoryPurpose({...purpose,name:'过期编辑'},JSON.stringify(purpose))).ok)
const copied=store.copyCategory(category.id);assert.equal(categoryPurposeId(store.data.categories.find(c=>c.id===copied)),'repair');await store.flushPersistence()
const builtIn=categoryPurposes(store.data).find(p=>p.id==='accessory')!
assert(!(await store.removeCategoryPurpose('accessory',JSON.stringify(builtIn))).ok)
for(const id of [category.id,copied]){const row=store.data.categories.find(c=>c.id===id)!;assert((await store.saveBoundCategory({...category,id,purposeId:''},JSON.stringify(row))).ok)}
const renamed=categoryPurposes(store.data).find(p=>p.id==='repair')!
assert((await store.removeCategoryPurpose('repair',JSON.stringify(renamed))).ok)
assert(!(await store.saveBoundCategory({...category,id:'missing-purpose'},null)).ok)
assert.deepEqual(store.data.benefitSalesLists,data.benefitSalesLists)
assert(store.startPermissionPreview('u-op').ok);assert.throws(()=>store.saveCategoryPurpose({id:'forbidden',name:'禁止',behavior:'other'},null),/未授权/);store.stopPermissionPreview()
store.$dispose();console.log('PASS 用途增改删、重名、旧引用删除保护、复制保留绑定、解除后删除、失败原子性、过期编辑、权限与历史保持')
