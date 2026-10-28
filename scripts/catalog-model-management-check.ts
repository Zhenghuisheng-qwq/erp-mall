import assert from 'node:assert/strict'
import {createPinia,setActivePinia} from 'pinia'
import {installCatalogTestLocks} from './catalog-storage-test-env'
import {createHostModelFixture} from './compatibility-ability-fixtures'
import {useCatalogStore} from '../src/stores/catalog'
import {DATA_VERSION,STORAGE_KEY} from '../src/domain/types'
import {RBAC_ENFORCEMENT_ENABLED} from '../src/domain/accessMode'

installCatalogTestLocks()
const request=navigator.locks.request.bind(navigator.locks)
let hold=false,release=()=>{},entered=()=>{},quota=false,groups=0
Object.defineProperty(navigator.locks,'request',{value:(name:string,options:LockOptions,callback:LockGrantedCallback)=>request(name,options,async lock=>{if(hold){hold=false;entered();await new Promise<void>(resolve=>release=resolve)}return callback(lock)})})
const disk=new Map<string,string>(),session=new Map<string,string>()
const storage=(map:Map<string,string>)=>({getItem:(key:string)=>map.get(key)??null,removeItem:(key:string)=>map.delete(key),setItem:(key:string,value:string)=>{if(quota&&key===STORAGE_KEY)throw Error('isolated model quota');map.set(key,value)}})
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage(disk)})
Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:storage(session)})
const {data,modelId}=createHostModelFixture()
data.rbac!.roles.push({id:'model-reader',code:'model-reader',name:'模型只读',enabled:true,description:'isolated',permissionCodes:['product:model:read']})
data.users.push({id:'model-reader',username:'model-reader',displayName:'模型只读',enabled:true,role:'operator',roleIds:['model-reader']})
data.rbac!.roles.push({id:'type-creator',code:'type-creator',name:'类型新建',enabled:true,description:'isolated',permissionCodes:['product:type:read','product:type:create','product:category:read']})
data.users.push({id:'type-creator',username:'type-creator',displayName:'类型新建',enabled:true,role:'operator',roleIds:['type-creator']})
data.categories.push({id:'management-leaf',name:'管理测试末级',parentId:null,sort:999,enabled:true})
disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data}));session.set('iyge-rbac-simulated-user','u-admin')
const mount=async()=>{setActivePinia(createPinia());const value=useCatalogStore();await value.waitForPersistence();return value}
const store=await mount(),other=await mount(),raw=()=>disk.get(STORAGE_KEY),canvas=()=>store.data.specCanvases.find(row=>row.templateId===modelId)!,mark=(name:string)=>{groups++;console.log(`PASS catalog model management: ${name}`)}
const before=raw(),unchanged=JSON.stringify([store.data.specModelVersions,store.data.families,store.data.skus,store.data.planningRecords,store.data.templateCompatibilityConfigs])
assert.equal((await store.setProductModelStatus('missing-model','offline','')).ok,false)
assert.equal(raw(),before);assert.equal(store.data.specCanvases.some(row=>row.templateId==='missing-model'),false)
assert.equal((await store.setProductModelStatus(modelId,'offline','wrong-revision')).ok,false);assert.equal(raw(),before)
mark('missing canvas never creates ownership; stale model maintenance revision refuses zero-write')

quota=true;const failed=await store.setProductModelStatus(modelId,'offline',canvas().updatedAt||'');assert.equal(failed.ok,false);assert.equal(raw(),before);assert.notEqual(canvas().status,'offline');quota=false
const saved=await store.setProductModelStatus(modelId,'offline',canvas().updatedAt||'');assert(saved.ok,saved.message);assert.equal(canvas().status,'offline')
assert.equal(JSON.stringify([store.data.specModelVersions,store.data.families,store.data.skus,store.data.planningRecords,store.data.templateCompatibilityConfigs]),unchanged)
const persisted=JSON.parse(raw()!).data;assert.equal(persisted.specCanvases.find((row:{templateId:string})=>row.templateId===modelId).status,'offline')
mark('disk failure is atomic and retry offlines only the actual canvas; snapshots, sources and bindings stay exact')

const noChange=raw();assert((await store.setProductModelStatus(modelId,'offline',canvas().updatedAt||'')).ok);assert.equal(raw(),noChange)
mark('unchanged status performs no redundant business write')

hold=true;let ready=new Promise<void>(resolve=>entered=resolve),current=true
const pending=store.setProductModelStatus(modelId,'offline',canvas().updatedAt||'',()=>current);await ready;current=false;release();assert.equal((await pending).ok,false);assert.equal(raw(),noChange)
mark('delayed command rechecks editing context under Web Lock')

hold=true;ready=new Promise<void>(resolve=>entered=resolve)
const identityChange=store.setProductModelStatus(modelId,'offline',canvas().updatedAt||'');await ready;assert(store.startPermissionPreview('model-reader').ok);release();assert.equal((await identityChange).ok,false);assert.equal(raw(),noChange)
if(RBAC_ENFORCEMENT_ENABLED)assert.throws(()=>store.setProductModelStatus(modelId,'offline',''),/未授权/)
assert(store.stopPermissionPreview().ok)
mark('queued identity changes cannot submit; model-only read cannot change status in strict mode')

// The second real Store queues a change first; the first Store must never overwrite it.
const otherCanvas=other.data.specCanvases.find(row=>row.templateId===modelId)!
hold=true;ready=new Promise<void>(resolve=>entered=resolve)
const external=other.saveModelDraft(modelId);await ready
const stale=store.setProductModelStatus(modelId,'offline',canvas().updatedAt||'');release();const externalResult=await external
assert.equal(externalResult.ok,false,'a stale external Store must also retain the existing cross-page conflict protection')
assert((await stale).ok);assert.equal(raw(),noChange);assert(otherCanvas)
mark('two real Stores retain catalog conflict protection without changing publication snapshots')

assert(store.startPermissionPreview('type-creator').ok)
const typeBefore=raw(),typesBefore=JSON.stringify(store.data.productTypes),typeInput={id:'',categoryId:'management-leaf',name:'仅创建权限的新类型',description:'原子失败重试',sort:1,status:'enabled' as const}
quota=true;assert.equal((await store.commitProductType(typeInput)).ok,false);quota=false
assert.equal(raw(),typeBefore);assert.equal(JSON.stringify(store.data.productTypes),typesBefore)
const created=await store.commitProductType({...typeInput,name:'重试采用最新类型名称'});assert(created.ok,created.message)
const savedType=store.data.productTypes.find(item=>item.name==='重试采用最新类型名称')!;assert(savedType)
if(RBAC_ENFORCEMENT_ENABLED){assert.equal(store.can('product:type:update'),false);assert.throws(()=>store.commitProductType({...typeInput,id:savedType.id},JSON.stringify(savedType)),/未授权/)}
assert(store.stopPermissionPreview().ok)
mark('create-only role retries latest retained type input after quota failure without requiring update or leaving a provisional record')

const actionBefore=raw(),record=JSON.stringify(store.data.productTypes.find(item=>item.id===savedType.id))
quota=true;assert.equal((await store.commitProductTypeAction(savedType.id,'disabled',record)).ok,false);quota=false
assert.equal(raw(),actionBefore);assert.equal(store.data.productTypes.find(item=>item.id===savedType.id)!.status,'enabled')
assert((await store.commitProductTypeAction(savedType.id,'disabled',record)).ok)
assert.equal(store.data.productTypes.find(item=>item.id===savedType.id)!.status,'disabled')
assert.equal((await store.commitProductTypeAction(savedType.id,'delete',record)).ok,false)
const disabledRecord=JSON.stringify(store.data.productTypes.find(item=>item.id===savedType.id)),disabledRaw=raw()
quota=true;assert.equal((await store.commitProductTypeAction(savedType.id,'delete',disabledRecord)).ok,false);quota=false
assert.equal(raw(),disabledRaw);assert(store.data.productTypes.some(item=>item.id===savedType.id))
assert((await store.commitProductTypeAction(savedType.id,'delete',disabledRecord)).ok);assert.equal(store.data.productTypes.some(item=>item.id===savedType.id),false)
const used=store.data.productTypes.find(item=>store.data.specCanvases.some(canvas=>canvas.productTypeId===item.id))!,protectedBefore=raw()
assert.equal((await store.commitProductTypeAction(used.id,'delete',JSON.stringify(used))).ok,false);assert.equal(raw(),protectedBefore)
mark('type status and delete are atomic and revision checked; existing reference deletion protection remains authoritative')
console.log(`Catalog model management checks: ${groups} groups passed (${RBAC_ENFORCEMENT_ENABLED?'strict':'default'})`)
