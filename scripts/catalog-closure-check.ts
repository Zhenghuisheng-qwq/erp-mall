import assert from 'node:assert/strict'
import {createPinia,setActivePinia} from 'pinia'
import {catalogClosureFixture} from './catalog-closure-fixture'
import {installCatalogTestLocks} from './catalog-storage-test-env'
import {useCatalogStore} from '../src/stores/catalog'
import {DATA_VERSION,STORAGE_KEY,type ProductType} from '../src/domain/types'
import {RBAC_ENFORCEMENT_ENABLED} from '../src/domain/accessMode'
import {catalogSearchKeyword,withCatalogSearch} from '../src/domain/catalogWorkspaceNavigation'
import {legalComboMaterialStatus,resolveComboVersion} from '../src/domain/comboMaterialStatus'

installCatalogTestLocks()
const request=navigator.locks.request.bind(navigator.locks)
let hold=false,release=()=>{},entered=()=>{},quota=false,groups=0
Object.defineProperty(navigator.locks,'request',{value:(name:string,options:LockOptions,callback:LockGrantedCallback)=>request(name,options,async lock=>{if(hold){hold=false;entered();await new Promise<void>(resolve=>release=resolve)}return callback(lock)})})
const disk=new Map<string,string>(),session=new Map<string,string>()
const storage=(map:Map<string,string>)=>({getItem:(key:string)=>map.get(key)??null,removeItem:(key:string)=>map.delete(key),setItem:(key:string,value:string)=>{if(quota&&key===STORAGE_KEY)throw Error('closure quota');map.set(key,value)}})
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage(disk)})
Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:storage(session)})
const fixture=catalogClosureFixture(),{data,a,b,c,v1,v2,bv}=fixture,mark=(name:string)=>{groups++;console.log(`PASS closure: ${name}`)}
assert.equal(resolveComboVersion(data,b,'','',v1.id),bv.id)
assert.equal(resolveComboVersion(data,c,'','',v1.id),'')
assert.equal(resolveComboVersion(data,a,'','',v1.id),v1.id)
assert.equal(resolveComboVersion(data,a,v2.id,'',v1.id),v2.id)
assert.equal(resolveComboVersion(data,a,'missing',''), 'missing')
assert.equal(legalComboMaterialStatus(data,b,v1.id).rows.length,0)
const status=legalComboMaterialStatus(data,b,resolveComboVersion(data,b,'','',v1.id))
assert(status.rows.length>0);assert(status.rows.every(row=>row.modelVersionId===bv.id));assert(status.rows.some(row=>row.materials.some(item=>item.skuId==='closure-material'&&item.modelVersionId===bv.id)))
mark('cross-model selection resolves owned combinations and actual MAT; unpublished remains empty; explicit invalid stays invalid')
for(const alias of ['q','keyword','search']){
  const query={view:'models',categoryId:'c-phone',scope:'current',modelId:b,version:bv.id,sort:'name-desc',[alias]:'foo'}
  assert.equal(catalogSearchKeyword(query),'foo')
  const empty=withCatalogSearch(query,'');assert.equal(catalogSearchKeyword(empty),'');assert.equal(Object.hasOwn(empty,'keyword'),false);assert.equal(Object.hasOwn(empty,'search'),false);assert.equal(empty.modelId,b);assert.equal(empty.version,bv.id);assert.equal(empty.sort,'name-desc');assert.equal(empty.scope,'current')
}
assert.equal(catalogSearchKeyword({keyword:'foo',q:'bar'}),'bar');assert.equal(catalogSearchKeyword({keyword:'foo',q:''}),'');assert.equal(catalogSearchKeyword({}),undefined)
mark('search presence distinguishes clear from absent and removes both aliases while preserving valid detail/scope')

disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data}));session.set('iyge-rbac-simulated-user','u-admin')
setActivePinia(createPinia());const store=useCatalogStore();await store.waitForPersistence()
const raw=()=>disk.get(STORAGE_KEY),row=(id:string)=>store.data.productTypes.find(type=>type.id===id)!
const frozen=()=>JSON.stringify([store.data.specModelVersions,store.data.skus,store.data.families,store.data.planningRecords,store.data.compatibilities])
const protectedBefore=frozen()
const create=async(name:string,catalogRole:ProductType['catalogRole'],categoryId='c-phone')=>{const result=await store.commitProductType({id:'',name,categoryId,description:'purpose regression',sort:99,status:'enabled',catalogRole});assert(result.ok,result.message);assert('id' in result);return result.id as string}
const host=await create('同名用途验证','host'),accessory=await create('同名用途验证','accessory','c-watch'),unknown=await create('用途待定',undefined),other=await create('其他用途','other')
assert.equal(row(host).catalogRole,'host');assert.equal(row(accessory).catalogRole,'accessory');assert.equal(row(unknown).catalogRole,undefined);assert.equal(row(other).catalogRole,'other')
assert.equal(JSON.parse(raw()!).data.productTypes.find((type:ProductType)=>type.id===host).catalogRole,'host')
const model=await store.createProductModel({productTypeId:host,name:'新主机最小结构'});assert(model.ok&&'templateId' in model)
const id=(model as {templateId:string}).templateId
const omitted={...row(host)};delete omitted.catalogRole
assert((await store.commitProductType({...omitted,name:'普通编辑保留用途'},JSON.stringify(row(host)))).ok);assert.equal(row(host).catalogRole,'host')
assert((await store.commitProductType({...row(other),catalogRole:undefined},JSON.stringify(row(other)))).ok);assert.equal(row(other).catalogRole,undefined)
assert.equal((await store.commitProductType({...row(host),catalogRole:'invalid' as 'host'},JSON.stringify(row(host)))).ok,false)
assert.equal(frozen(),protectedBefore)
mark('new host/accessory/other/unspecified persist by ID; omitted ordinary edits preserve role; explicit clear and invalid-field validation')

const before=raw(),types=JSON.stringify(store.data.productTypes)
quota=true;assert.equal((await store.commitProductType({...row(unknown),catalogRole:'accessory'},JSON.stringify(row(unknown)))).ok,false);quota=false
assert.equal(raw(),before);assert.equal(JSON.stringify(store.data.productTypes),types)
assert((await store.commitProductType({...row(unknown),catalogRole:'accessory'},JSON.stringify(row(unknown)))).ok);assert.equal(row(unknown).catalogRole,'accessory')
assert.equal((await store.commitProductType({...row(host),catalogRole:'accessory'},'stale')).ok,false)
mark('quota failure is atomic, latest retained input retries successfully, stale record rejects')

hold=true;let ready=new Promise<void>(resolve=>entered=resolve)
const pending=store.commitProductType({...row(host),catalogRole:'accessory'},JSON.stringify(row(host)));await ready
assert(store.startPermissionPreview('closure-read').ok);release();assert.equal((await pending).ok,false);assert.equal(row(host).catalogRole,'host')
if(RBAC_ENFORCEMENT_ENABLED)assert.throws(()=>store.commitProductType({...row(host),catalogRole:'other'},JSON.stringify(row(host))),/未授权/)
assert(store.stopPermissionPreview().ok)
assert(store.startPermissionPreview('closure-create').ok)
const created=await create('仅新增权限用途','host');assert.equal(row(created).catalogRole,'host')
if(RBAC_ENFORCEMENT_ENABLED)assert.throws(()=>store.commitProductType({...row(created),catalogRole:'other'},JSON.stringify(row(created))),/未授权/)
assert(store.stopPermissionPreview().ok)
hold=true;ready=new Promise<void>(resolve=>entered=resolve);let current=true
const cancelled=store.commitProductType({...row(host),catalogRole:'accessory'},JSON.stringify(row(host)),()=>current);await ready;current=false;release();assert.equal((await cancelled).ok,false)
assert.equal(row(host).catalogRole,'host')
hold=true;ready=new Promise<void>(resolve=>entered=resolve)
const recordChanged=store.commitProductType({...row(host),catalogRole:'accessory'},JSON.stringify(row(host)));await ready
row(host).description='排队期间已由另一处维护'
release();assert.equal((await recordChanged).ok,false);await store.waitForPersistence()
assert.equal(row(host).catalogRole,'host');assert.equal(row(host).description,'排队期间已由另一处维护')
assert.equal(JSON.parse(raw()!).data.productTypes.find((type:ProductType)=>type.id===host).catalogRole,'host')
mark('queued actor/context and create/update permission checks remain authoritative in real Store')
console.log(`Catalog closure: ${groups} groups (${RBAC_ENFORCEMENT_ENABLED?'strict':'default'})`)
