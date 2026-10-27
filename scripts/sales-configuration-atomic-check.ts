import assert from 'node:assert/strict'
import {createPinia,setActivePinia} from 'pinia'
import {installCatalogTestLocks} from './catalog-storage-test-env'
import {createSalesConfigurationFixture,salesTestPlan} from './sales-configuration-fixtures'
import {useCatalogStore,normalizeStored} from '../src/stores/catalog'
import {salesConfigurationCommitBasis,type SalesConfigurationCommit} from '../src/domain/salesConfigurationCommands'
import {salesBindingWorkingIdentity} from '../src/domain/salesBindingWorkingCopy'
import {resolveSalesPlan,resolveSalesSource} from '../src/domain/salesConfiguration'
import {createSeed} from '../src/domain/seed'
import {DATA_VERSION,STORAGE_KEY} from '../src/domain/types'
import {RBAC_ENFORCEMENT_ENABLED} from '../src/domain/accessMode'

installCatalogTestLocks()
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value)),disk=new Map<string,string>(),session=new Map<string,string>()
let quota=false,writes=0
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>disk.get(key)??null,setItem:(key:string,value:string)=>{if(key===STORAGE_KEY){if(quota)throw Error('atomic configuration quota');writes++}disk.set(key,value)},removeItem:(key:string)=>disk.delete(key)}})
Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:(key:string)=>session.get(key)??null,setItem:(key:string,value:string)=>session.set(key,value),removeItem:(key:string)=>session.delete(key)}})
const f=createSalesConfigurationFixture(),data=f.data
data.salesOptionBindings!.push({...clone(f.phoneBinding),id:'stay-v1',mode:'replace',scope:{kind:'products',familyIds:[],skuIds:[f.phoneIds[1]!]}})
for(const [id,codes]of [['atomic-read',['product:sales-config:read','product:sales-config:update']],['atomic-create-publish',['product:sales-config:read','product:sales-config:create','product:sales-config:publish']]] as const){data.rbac!.roles.push({id,code:id,name:id,enabled:true,description:'atomic fixture',permissionCodes:[...codes]});data.users.push({id,username:id,displayName:id,enabled:true,role:'operator',roleIds:[id]})}
disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data}));session.set('iyge-rbac-simulated-user','u-admin');setActivePinia(createPinia());const store=useCatalogStore();await store.waitForPersistence()
const raw=()=>disk.get(STORAGE_KEY),formal=()=>JSON.stringify([store.data.salesOptionPlans,store.data.salesOptionBindings]),history=()=>JSON.stringify([store.data.specModelVersions,store.data.families,store.data.skus,store.data.planningRecords,store.data.compatibilities,store.data.benefitPackages,store.data.benefitDeliveries])
const draft=clone(store.data.salesOptionPlans!.find(plan=>plan.id===f.phonePlan.id)!),binding=clone(store.data.salesOptionBindings!.find(item=>item.id===f.phoneBinding.id)!)
draft.name='本次待发布配置';draft.items[0]!.maxQuantity=7
const identity=salesBindingWorkingIdentity(binding),copy=await store.saveSalesBindingWorkingCopy({key:binding.id,draft:binding,baseRevision:binding.revision,expectedRevision:0,identity,planDraft:draft,expectedPlanRevision:draft.revision,ui:{step:4,sourceSkuId:f.phoneIds[0]}})
assert(copy.ok&&copy.copy);assert.equal(copy.copy.planDraft?.name,draft.name);assert.equal(copy.copy.ui?.sourceSkuId,f.phoneIds[0])
const input:SalesConfigurationCommit={planDraft:draft,expectedPlanRevision:draft.revision,bindings:[binding],expectedRevisions:{[binding.id]:binding.revision},expectedBasis:salesConfigurationCommitBasis(store.data),action:'publish-apply',requestId:'atomic-publish-apply',workingCopy:{key:binding.id,expectedRevision:1},workingContext:{key:binding.id,identity,expectedRevision:1}}
const before=raw(),beforeFormal=formal(),beforeHistory=history(),originalV1=JSON.stringify(draft.versions[0]),untouched=JSON.stringify(store.data.salesOptionBindings!.find(item=>item.id==='stay-v1'))
quota=true;assert.equal((await store.commitSalesConfiguration(input)).ok,false);quota=false
assert.equal(raw(),before);assert.equal(formal(),beforeFormal)
const count=writes,result=await store.commitSalesConfiguration(input);assert(result.ok&&result.plan,result.message);assert.equal(writes,count+1);assert.equal(result.version,2);assert.deepEqual(result.appliedBindingIds,[binding.id]);assert.equal(JSON.stringify(result.plan.versions[0]),originalV1)
assert.equal(JSON.stringify(store.data.salesOptionBindings!.find(item=>item.id==='stay-v1')),untouched);assert.equal(history(),beforeHistory);assert.equal(resolveSalesPlan(store.data,f.phoneIds[0]!).plan?.version,2);assert.equal(resolveSalesPlan(store.data,f.phoneIds[1]!).plan?.version,1)
const after=raw(),afterWrites=writes;assert((await store.commitSalesConfiguration(input)).ok);assert.equal(writes,afterWrites);assert.equal(raw(),after)
assert.equal((await store.commitSalesConfiguration({...input,planDraft:{...draft,name:'改变后错误重用同一请求'}})).ok,false);assert.equal(raw(),after)
assert((await store.discardSalesBindingWorkingCopy(binding.id,1)).ok);assert((await store.commitSalesConfiguration(input)).ok);assert.equal(writes,afterWrites)
console.log('PASS atomic publish: one disk write, quota rollback/retry, request replay after cleanup, selected binding only, frozen v1 and business histories exact')

const nextDraft=clone(result.plan),currentBinding=clone(store.data.salesOptionBindings!.find(item=>item.id===binding.id)!)
const failed:SalesConfigurationCommit={planDraft:nextDraft,expectedPlanRevision:nextDraft.revision,bindings:[{...currentBinding,scope:{kind:'model',modelId:f.modelId,versionId:null}}],expectedRevisions:{[currentBinding.id]:currentBinding.revision},expectedBasis:salesConfigurationCommitBasis(store.data),action:'publish-apply',requestId:'reject-draft-model'}
const failureRaw=raw();assert.equal((await store.commitSalesConfiguration(failed)).ok,false);assert.equal(raw(),failureRaw)
const newPlan={...salesTestPlan(''),name:'仅发布的独立配置',revision:0,status:'draft' as const,versions:[],publishedVersion:null,createdAt:'',updatedAt:''}
assert(store.startPermissionPreview('atomic-create-publish').ok)
const published=await store.commitSalesConfiguration({planDraft:newPlan,expectedPlanRevision:0,bindings:[],expectedRevisions:{},expectedBasis:salesConfigurationCommitBasis(store.data),action:'publish-only',requestId:'publish-without-binding-update'})
assert(published.ok,published.message);assert.equal(published.version,1);assert.deepEqual(published.appliedBindingIds,[])
assert(store.stopPermissionPreview().ok);assert(store.startPermissionPreview('atomic-read').ok)
if(RBAC_ENFORCEMENT_ENABLED)assert.throws(()=>store.commitSalesConfiguration(failed),/未授权/)
assert(store.stopPermissionPreview().ok)
console.log('PASS atomic permissions: new/publish-only needs no binding-update; no publish permission cannot submit; draft model application rolls back plan and bindings')

const priorRequest=navigator.locks.request.bind(navigator.locks);let hold=true,release=()=>{},entered=()=>{}
Object.defineProperty(navigator.locks,'request',{value:(name:string,options:LockOptions,callback:LockGrantedCallback)=>priorRequest(name,options,async lock=>{if(hold){hold=false;entered();await new Promise<void>(resolve=>release=resolve)}return callback(lock)})})
let ready=new Promise<void>(resolve=>entered=resolve)
const revisionDraft=clone(store.data.salesOptionPlans!.find(plan=>plan.id===f.phonePlan.id)!),pendingInput:SalesConfigurationCommit={planDraft:revisionDraft,expectedPlanRevision:revisionDraft.revision,bindings:[],expectedRevisions:{},expectedBasis:salesConfigurationCommitBasis(store.data),action:'publish-only',requestId:'stale-while-queued'}
const stableFormal=formal(),queued=store.commitSalesConfiguration(pendingInput);await ready;store.data.skus[0]!.skuName+=' 别处更新';release();assert.equal((await queued).ok,false);assert.equal(formal(),stableFormal);await store.waitForPersistence()
hold=true;ready=new Promise<void>(resolve=>entered=resolve);const actorQueued=store.commitSalesConfiguration({...pendingInput,expectedBasis:salesConfigurationCommitBasis(store.data),requestId:'actor-changed'});await ready;assert(store.startPermissionPreview('atomic-read').ok);release();assert.equal((await actorQueued).ok,false);assert(store.stopPermissionPreview().ok)
console.log('PASS atomic queue: changed candidate basis and actor after enqueue are rejected without publishing')

const removed=createSeed();removed.families=removed.families.filter(item=>item.id!=='f-case');removed.skus=removed.skus.filter(item=>!['s-case-orange','s-case-clear'].includes(item.id))
const demoVersion=removed.specModelVersions.find(item=>item.id==='phone-demo-v2')!,customVersion={...clone(demoVersion),id:'customer-phone-v9',version:9,versionName:'管理员自有 V9',nodesSnapshot:demoVersion.nodesSnapshot.map(node=>({...clone(node),id:`customer-${node.id}`,parentId:node.parentId?`customer-${node.parentId}`:null}))}
removed.specModelVersions=removed.specModelVersions.filter(item=>item.id!=='phone-demo-v2');removed.specModelVersions.push(customVersion)
removed.families.find(item=>item.id==='f-iphone')!.modelVersionId=customVersion.id
for(const sku of removed.skus.filter(item=>item.familyId==='f-iphone')){sku.modelVersionId=customVersion.id;sku.sourceNodeIds=sku.sourceNodeIds?.map(id=>`customer-${id}`);if(sku.creationSource)sku.creationSource={...sku.creationSource,modelVersionId:customVersion.id,createdAt:'2026-10-30T02:00:00.000Z'}}
const provenance=(value:typeof removed)=>JSON.stringify([value.families.map(item=>[item.id,item.productModelId,item.modelVersionId]),value.skus.map(item=>[item.id,item.modelVersionId,item.creationSource,item.sourceNodeIds]),value.specModelVersions])
const sourceBefore=provenance(removed),normalizationWrites=writes,normalized=normalizeStored({version:DATA_VERSION,data:removed})!
assert.equal(normalized.families.some(item=>item.id==='f-case'),false);assert.equal(normalized.skus.some(item=>item.id==='s-case-orange'||item.id==='s-case-clear'),false)
assert.equal(provenance(normalized),sourceBefore);assert.equal(writes,normalizationWrites);assert.equal(normalized.specModelVersions.some(item=>item.id==='phone-demo-v2'),false)
const legacy=clone(normalized);legacy.specModelVersions=[];delete legacy.families.find(item=>item.id==='f-iphone')!.modelVersionId
normalizeStored({version:13,data:legacy});assert.equal(legacy.specModelVersions.length,0);assert.equal(legacy.families.find(item=>item.id==='f-iphone')!.modelVersionId,undefined);assert.equal(resolveSalesSource(legacy,'s-iphone-blue').state,'invalid')
const absentCollections=clone(normalized);delete (absentCollections as Partial<typeof absentCollections>).productSpecNodes;delete (absentCollections as Partial<typeof absentCollections>).specCanvases
normalizeStored({version:DATA_VERSION,data:absentCollections});assert.deepEqual(absentCollections.productSpecNodes,[]);assert.deepEqual(absentCollections.specCanvases,[])
const absentCanvas=clone(normalized);delete (absentCanvas as Partial<typeof absentCanvas>).specCanvases
normalizeStored({version:DATA_VERSION,data:absentCanvas});assert(absentCanvas.specCanvases.every(item=>item.status==='draft'&&!item.productTypeId));assert.equal(JSON.stringify(absentCanvas.specModelVersions),JSON.stringify(normalized.specModelVersions))
store.$dispose();disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data:normalized}));setActivePinia(createPinia());const reloaded=useCatalogStore();await reloaded.waitForPersistence();assert.equal(provenance(reloaded.data),sourceBefore);assert.equal(reloaded.data.families.some(item=>item.id==='f-case'),false)
await reloaded.importJson(JSON.stringify({version:DATA_VERSION,data:normalized}));await reloaded.waitForPersistence();assert.equal(provenance(reloaded.data),sourceBefore)
const beforeUnrelatedReset=provenance(reloaded.data);assert((await reloaded.resetModule('rules')).ok);assert.equal(provenance(reloaded.data),beforeUnrelatedReset);assert.equal(reloaded.data.families.some(item=>item.id==='f-case'),false)
console.log('PASS read-only normalization: deleted examples stay deleted; custom phone version/source/nodes remain exact on normalize, import, Store reload and unrelated module reset; missing versions remain diagnostic failures')
