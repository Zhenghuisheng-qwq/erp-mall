import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { installCatalogTestLocks } from './catalog-storage-test-env'
import { createSalesConfigurationFixture, salesTestPlan } from './sales-configuration-fixtures'
import { useCatalogStore, normalizeStored } from '../src/stores/catalog'
import { previewSalesBinding, resolveSalesPlan } from '../src/domain/salesConfiguration'
import { DATA_VERSION, STORAGE_KEY } from '../src/domain/types'
import type { SalesOptionBinding, SalesOptionPlan } from '../src/domain/salesConfigurationTypes'
import { RBAC_ENFORCEMENT_ENABLED } from '../src/domain/accessMode'
import { permissionRegistry, ensureRbac, routePermissions, canPermission } from '../src/domain/rbac'
import { defaultMenuNodes, sanitizeMenu } from '../src/domain/menuConfig'

installCatalogTestLocks()
const copy=<T>(value:T):T=>JSON.parse(JSON.stringify(value)),disk=new Map<string,string>(),session=new Map<string,string>()
let quota=false,writes=0,groups=0
const storage=(map:Map<string,string>)=>({getItem:(key:string)=>map.get(key)??null,removeItem:(key:string)=>map.delete(key),setItem:(key:string,value:string)=>{if(key===STORAGE_KEY){if(quota)throw Error('sales atomic quota');writes++}map.set(key,value)}})
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage(disk)});Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:storage(session)})
const fixture=createSalesConfigurationFixture(),data=fixture.data
data.rbac!.roles.push({id:'sales-reader-role',code:'sales-reader',name:'仅本地选购',description:'isolated fixture',enabled:true,permissionCodes:['product:sales:read']})
data.users.push({id:'sales-reader',username:'sales-reader',displayName:'仅本地选购',role:'operator',roleIds:['sales-reader-role'],enabled:true})
disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data}));setActivePinia(createPinia());const store=useCatalogStore();await store.waitForPersistence()
const business=()=>JSON.stringify([store.data.families,store.data.skus,store.data.specModelVersions,store.data.productSpecNodes,store.data.planningRecords,store.data.materialReceipts,store.data.compatibilities])
const beforeBusiness=business(),raw=()=>disk.get(STORAGE_KEY),mark=(name:string)=>{groups++;console.log(`PASS sales Store: ${name}`)}
let plan:SalesOptionPlan={...salesTestPlan(''),name:'Store测试方案',revision:0,status:'draft',publishedVersion:null,versions:[],createdAt:'',updatedAt:''}
const create={draft:copy(plan),expectedRevision:0,requestId:'sales-store-create'}
quota=true;let before=raw();let result=await store.saveSalesOptionPlan(create);assert.equal(result.ok,false);assert.equal(raw(),before);assert(!store.data.salesOptionPlans!.some(item=>item.name===plan.name))
quota=false;result=await store.saveSalesOptionPlan(create);assert(result.ok&&result.plan);plan=copy(result.plan)
const afterCreate=writes;assert((await store.saveSalesOptionPlan(create)).ok);assert.equal(writes,afterCreate);assert.equal(store.data.salesOptionPlans!.filter(item=>item.id===plan.id).length,1)
mark('save quota failure zero writes, identical request retry allocates only one stable plan')
let published=await store.publishSalesOptionPlan({id:plan.id,expectedRevision:plan.revision,requestId:'sales-store-publish1'});assert(published.ok&&published.plan);plan=copy(published.plan)
const v1=JSON.stringify(plan.versions[0]);const changed=copy(plan);changed.name='新草稿名称';changed.items[0]!.maxQuantity=3
result=await store.saveSalesOptionPlan({draft:changed,expectedRevision:plan.revision,requestId:'sales-store-edit'});assert(result.ok&&result.plan);plan=copy(result.plan);assert.equal(JSON.stringify(plan.versions[0]),v1)
published=await store.publishSalesOptionPlan({id:plan.id,expectedRevision:plan.revision,requestId:'sales-store-publish2'});assert(published.ok&&published.plan);plan=copy(published.plan)
assert.equal(plan.versions.length,2);assert.equal(JSON.stringify(plan.versions[0]),v1)
assert.equal(business(),beforeBusiness);mark('draft edit and publish v2 freeze v1 without changing any model/SKU/PLN/MAT/declaration')

const makeBinding=(name:string,version=1):SalesOptionBinding=>({schemaVersion:1,id:'',revision:0,name,enabled:true,scope:{kind:'products',familyIds:[],skuIds:[fixture.phoneIds[0]!]},mode:'replace',planId:plan.id,planVersion:version,source:'真实范围隔离测试',updatedAt:''})
let binding=makeBinding('旧商品明确绑定'),preview=previewSalesBinding(store.data,binding);assert(preview.canApply,preview.issues.join('；'))
const input={draft:copy(binding),expectedRevision:0,expectedBasis:preview.stamp,requestId:'sales-store-binding'}
quota=true;before=raw();result=await store.saveSalesOptionBinding(input);assert.equal(result.ok,false);assert.equal(raw(),before)
quota=false;result=await store.saveSalesOptionBinding(input);assert(result.ok&&result.binding);binding=copy(result.binding)
assert.equal(resolveSalesPlan(store.data,fixture.phoneIds[0]!).plan!.version,1);assert.equal(store.data.salesOptionPlans!.find(item=>item.id===plan.id)!.publishedVersion,2)
mark('explicit published binding applies atomically and remains on selected v1 after v2 publication')

let draft={...copy(binding),planVersion:2};preview=previewSalesBinding(store.data,draft)
store.data.categories[0]!.name+='修订';await store.waitForPersistence();before=raw()
assert.equal((await store.saveSalesOptionBinding({draft,expectedRevision:binding.revision,expectedBasis:preview.stamp,requestId:'stale-preview'})).ok,false);assert.equal(raw(),before)
preview=previewSalesBinding(store.data,draft);result=await store.saveSalesOptionBinding({draft,expectedRevision:binding.revision,expectedBasis:preview.stamp,requestId:'current-preview'});assert(result.ok&&result.binding);binding=copy(result.binding)
mark('changed preview basis rejects entire application; current repreview succeeds')

const a={...copy(binding),planVersion:1},b=makeBinding('冲突替换',2)
const candidate={...store.data,salesOptionBindings:[...store.data.salesOptionBindings!.filter(item=>item.id!==a.id),a]}
before=raw();result=await store.saveSalesOptionBindings({drafts:[a,b],expectedRevisions:{[a.id]:a.revision,'1':0},expectedBasis:{[a.id]:previewSalesBinding(store.data,a).stamp,'1':previewSalesBinding(store.data,b).stamp},requestId:'atomic-conflict'})
assert.equal(result.ok,false);assert.equal(raw(),before);assert.equal(resolveSalesPlan(store.data,fixture.phoneIds[0]!).plan!.version,2)
assert(candidate);mark('conflicting batch replacements reject without partial write or arbitrary winner')

const same=makeBinding('同方案同版本去重',2)
result=await store.saveSalesOptionBinding({draft:same,expectedRevision:0,expectedBasis:previewSalesBinding(store.data,same).stamp,requestId:'same-binding'});assert(result.ok)
assert.equal(resolveSalesPlan(store.data,fixture.phoneIds[0]!).state,'matched')
const draftOnly:SalesOptionBinding={...makeBinding('草稿仅预览'),scope:{kind:'model',modelId:fixture.modelId,versionId:null},mode:'default'}
before=raw();assert.equal((await store.saveSalesOptionBinding({draft:draftOnly,expectedRevision:0,expectedBasis:previewSalesBinding(store.data,draftOnly).stamp,requestId:'draft-formal'})).ok,false);assert.equal(raw(),before)
draftOnly.enabled=false;assert((await store.saveSalesOptionBinding({draft:draftOnly,expectedRevision:0,expectedBasis:previewSalesBinding(store.data,draftOnly).stamp,requestId:'draft-only'})).ok)
mark('identical replacement deduplicates; model draft stays preview-only and may save disabled configuration')

const unknown={schemaVersion:99,id:'future-sales-plan',versions:{futureRepresentation:true},opaque:{items:'do not reinterpret',nested:[1,2]}}
const imported=copy(store.data) as any;imported.salesOptionPlans.push(unknown)
const normalized=normalizeStored({version:DATA_VERSION,data:imported})!
assert.deepEqual((normalized.salesOptionPlans as any[]).find(item=>item.id===unknown.id),unknown)
await store.importJson(JSON.stringify({version:DATA_VERSION,data:imported}));assert.deepEqual(JSON.parse(store.exportJson()).data.salesOptionPlans.find((item:{id:string})=>item.id===unknown.id),unknown)
before=raw();assert.equal((await store.setSalesOptionPlanStatus({id:unknown.id,expectedRevision:1,status:'disabled',requestId:'future-edit'})).ok,false);assert.equal(raw(),before)
assert.throws(()=>store.data.salesOptionPlans!.push(salesTestPlan('public-bypass')),/受控命令/)
const frozenImport=copy(store.data);frozenImport.salesOptionPlans!.find(item=>item.id===plan.id)!.versions[0]!.name='改写历史'
before=raw();await assert.rejects(async()=>store.importJson(JSON.stringify({version:DATA_VERSION,data:frozenImport})),/冻结发布版本/);assert.equal(raw(),before)
const removedVersion=copy(store.data);removedVersion.salesOptionPlans!.find(item=>item.id===plan.id)!.versions.shift()
await assert.rejects(async()=>store.importJson(JSON.stringify({version:DATA_VERSION,data:removedVersion})),/冻结发布版本/);assert.equal(raw(),before)
await store.importJson(store.exportJson());assert.deepEqual(JSON.parse(raw()!).data,JSON.parse(before!).data);before=raw()
const editedFuture=copy(store.data) as any;editedFuture.salesOptionPlans.find((item:{id:string})=>item.id===unknown.id).opaque.nested.push(3)
await assert.rejects(async()=>store.importJson(JSON.stringify({version:DATA_VERSION,data:editedFuture})),/未知版本销售记录只读/);assert.equal(raw(),before)
const downgradedFuture=copy(store.data);downgradedFuture.salesOptionPlans=downgradedFuture.salesOptionPlans!.map(item=>item.id===unknown.id?salesTestPlan(unknown.id):item)
await assert.rejects(async()=>store.importJson(JSON.stringify({version:DATA_VERSION,data:downgradedFuture})),/未知版本销售记录只读/);assert.equal(raw(),before)
assert.equal((await store.saveSalesOptionPlan({draft:{...copy(plan),name:null} as any,expectedRevision:plan.revision,requestId:'invalid-plan-name'})).ok,false);assert.equal(raw(),before)
mark('unknown schemas round-trip opaquely; known commands and direct writes cannot reinterpret them')

const request=navigator.locks.request.bind(navigator.locks);let release!:()=>void,entered!:()=>void
const ready=new Promise<void>(resolve=>entered=resolve),held=new Promise<void>(resolve=>release=resolve);let pause=true
navigator.locks.request=((name:string,options:LockOptions,callback:LockGrantedCallback)=>request(name,options,async lock=>{if(pause){pause=false;entered();await held}return callback(lock)})) as typeof navigator.locks.request
const saving=store.setSalesOptionPlanStatus({id:plan.id,expectedRevision:plan.revision,status:'disabled',requestId:'actor-change'})
await ready;before=raw();assert(store.startPermissionPreview('sales-reader').ok);release();assert.equal((await saving).ok,false);assert.equal(raw(),before)
if(RBAC_ENFORCEMENT_ENABLED){assert(store.can('product:sales:read'));assert(!store.can('product:sales-config:update'));await assert.rejects(async()=>store.saveSalesOptionPlan(create),/未授权/);assert.equal(raw(),before)}
assert(store.stopPermissionPreview().ok);mark('lock-delayed operator/preview changes cancel old commands; strict reader cannot persist configuration')

const oldAuth=copy(store.data);oldAuth.rbac!.permissions=oldAuth.rbac!.permissions.filter(item=>!['sales','sales-config'].includes(item.resource));delete oldAuth.rbac!.salesAccessVersion
for(const role of oldAuth.rbac!.roles)role.permissionCodes=role.permissionCodes.filter(code=>!code.startsWith('product:sales'))
const oldCustom=JSON.stringify(oldAuth.rbac!.roles.find(role=>role.id==='sales-reader-role'))
ensureRbac(oldAuth);assert.equal(oldAuth.rbac!.permissions.length,permissionRegistry().length);assert.equal(JSON.stringify(oldAuth.rbac!.roles.find(role=>role.id==='sales-reader-role')),oldCustom)
if(RBAC_ENFORCEMENT_ENABLED)assert(!canPermission(oldAuth,'sales-reader','product:sales:read'))
const menus=defaultMenuNodes(),custom=menus.find(item=>item.route==='/compatibility')!;custom.parentId='manage';custom.title='我的适用入口'
const sanitized=sanitizeMenu(menus);assert.equal(sanitized.find(item=>item.id===custom.id)!.parentId,'manage');assert.equal(sanitized.find(item=>item.id===custom.id)!.title,custom.title)
assert.deepEqual(routePermissions('/sales-shopping'),['product:sales:read']);assert.deepEqual(routePermissions('/sales-configurations'),['product:sales-config:read'])
assert.equal(business(),beforeBusiness);mark('additive permissions preserve custom grants and menu placement; registered routes retain separate actions')
await store.waitForPersistence();store.$dispose()
const legacy=copy(oldAuth);delete legacy.rbac!.salesAccessVersion
legacy.rbac!.permissions=legacy.rbac!.permissions.filter(item=>!['sales','sales-config'].includes(item.resource))
for(const role of legacy.rbac!.roles)role.permissionCodes=role.permissionCodes.filter(code=>!code.startsWith('product:sales'))
const legacyRaw=JSON.stringify({version:DATA_VERSION,data:legacy});disk.set(STORAGE_KEY,legacyRaw);session.clear();quota=true
setActivePinia(createPinia());const migrating=useCatalogStore();await migrating.waitForPersistence()
assert.equal(migrating.authorizationReady,false);assert.deepEqual(copy(migrating.data.rbac),legacy.rbac);assert.equal(raw(),legacyRaw);migrating.$dispose()
quota=false;setActivePinia(createPinia());const recovered=useCatalogStore();await recovered.waitForPersistence()
assert(recovered.authorizationReady);assert.equal(recovered.data.rbac!.salesAccessVersion,1)
assert.deepEqual(copy(recovered.data.rbac!.roles.find(role=>role.id==='sales-reader-role')),legacy.rbac!.roles.find(role=>role.id==='sales-reader-role'));recovered.$dispose()
mark('additive authorization migration write failure preserves old grants and disk; reload retries protected migration')
console.log(`PASS sales configuration Store ${groups} groups (${RBAC_ENFORCEMENT_ENABLED?'strict':'default'})`)
await import('./sales-permission-repair-check')
