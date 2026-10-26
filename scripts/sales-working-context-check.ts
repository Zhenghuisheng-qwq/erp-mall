import assert from 'node:assert/strict'
import {createPinia,setActivePinia} from 'pinia'
import {installCatalogTestLocks} from './catalog-storage-test-env'
import {createSalesConfigurationFixture} from './sales-configuration-fixtures'
import {useCatalogStore} from '../src/stores/catalog'
import {DATA_VERSION,STORAGE_KEY} from '../src/domain/types'
import {RBAC_ENFORCEMENT_ENABLED} from '../src/domain/accessMode'
import {selectorForCombination,templateSelectorCoverage} from '../src/domain/templateCompatibility'
import {previewSalesBinding,salesSignature} from '../src/domain/salesConfiguration'
import {salesBindingWorkingIdentity,salesBindingWorkingTaskKey,salesBindingWorkingCopyKey} from '../src/domain/salesBindingWorkingCopy'
import type {SalesOptionBinding} from '../src/domain/salesConfigurationTypes'

installCatalogTestLocks()
const locks=navigator.locks.request.bind(navigator.locks)
let hold=false,release=()=>{},entered=()=>{},quota=false,groups=0
Object.defineProperty(navigator.locks,'request',{value:(name:string,options:LockOptions,callback:LockGrantedCallback)=>locks(name,options,async lock=>{if(hold){hold=false;entered();await new Promise<void>(resolve=>release=resolve)}return callback(lock)})})
const disk=new Map<string,string>(),session=new Map<string,string>(),clone=<T,>(x:T):T=>JSON.parse(JSON.stringify(x))
const storage=(map:Map<string,string>)=>({get length(){return map.size},key:(n:number)=>[...map.keys()][n]??null,getItem:(k:string)=>map.get(k)??null,removeItem:(k:string)=>map.delete(k),setItem:(k:string,v:string)=>{if(quota)throw Error('isolated scope quota');map.set(k,v)}})
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage(disk)});Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:storage(session)})
const fixture=createSalesConfigurationFixture(),{data,context,modelId,versionId}=fixture
data.rbac!.roles.push({id:'scope-editor',code:'scope-editor',name:'范围编辑',enabled:true,description:'test',permissionCodes:['product:sales-config:read','product:sales-config:update']})
data.users.push({id:'scope-editor',username:'scope-editor',displayName:'范围编辑',enabled:true,role:'operator',roleIds:['scope-editor']})
disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data}));session.set('iyge-rbac-simulated-user','u-admin')
const mount=async()=>{setActivePinia(createPinia());const value=useCatalogStore();await value.waitForPersistence();return value}
const store=await mount(),other=await mount(),entry=[...context.byNode.values()].find(node=>node.nodeType==='ATTRIBUTE')!.id
const selector=(indexes:number[])=>({anyOf:indexes.flatMap(index=>selectorForCombination(context.combinations[index]!).anyOf)})
const make=(indexes:number[]):SalesOptionBinding=>({...clone(fixture.phoneBinding),id:'',revision:0,name:'同名范围',enabled:false,mode:'replace',scope:{kind:'model',modelId,versionId,nodeId:entry,selector:selector(indexes)}})
const a=make([0,3]),b=make([1,2]),ia=salesBindingWorkingIdentity(a,entry),ib=salesBindingWorkingIdentity(b,entry),ka=salesBindingWorkingTaskKey(a,entry),kb=salesBindingWorkingTaskKey(b,entry)
const mark=(name:string)=>{groups++;console.log(`PASS working context: ${name}`)},raw=()=>disk.get(STORAGE_KEY),save=(draft:SalesOptionBinding,revision=0)=>store.saveSalesBindingWorkingCopy({key:salesBindingWorkingTaskKey(draft,entry),draft,identity:salesBindingWorkingIdentity(draft,entry),baseRevision:draft.revision,expectedRevision:revision})
assert.equal(templateSelectorCoverage(context,selector([0,3])).identities.size,2);assert.equal(templateSelectorCoverage(context,selector([1,2])).identities.size,2);assert.notEqual(ka,kb)
const reordered=clone(a);if(reordered.scope.kind==='model')reordered.scope.selector!.anyOf.reverse().forEach(terms=>terms.reverse())
assert.equal(salesBindingWorkingTaskKey(reordered,entry),ka)
assert.notEqual(salesBindingWorkingTaskKey(make([0,1,2,3]),entry),ka)
assert.notEqual(salesBindingWorkingTaskKey({...a,mode:'none'},entry),ka)
assert.notEqual(salesBindingWorkingTaskKey(a,'another-entry'),ka)
mark('equal-count/name disjoint scopes differ; reordered DNF is stable without cross-product expansion')
const before=raw();assert((await save(a)).ok);assert.equal(raw(),before)
assert.equal(store.getSalesBindingWorkingCopy(kb,ib).copy,undefined)
assert.equal(store.getSalesBindingWorkingCopy(ka,ib).copy,undefined)
assert.equal(store.getSalesBindingWorkingCopy(ka,ia).copy!.draft.scope.kind,'model')
assert.equal((await store.saveSalesBindingWorkingCopy({key:kb,draft:a,identity:ib,baseRevision:0,expectedRevision:0})).ok,false)
assert.equal((await store.saveSalesBindingWorkingCopy({key:kb,draft:b,baseRevision:0,expectedRevision:0})).ok,false)
assert.equal(raw(),before)
mark('save A then open B never restores A; Store refuses key/task/draft mismatch with zero catalog writes')
const invalidApply=await store.saveSalesOptionBinding({draft:{...a,enabled:true},expectedRevision:0,expectedBasis:previewSalesBinding(store.data,{...a,enabled:true}).stamp,requestId:'wrong-task',workingContext:{key:kb,identity:ib,expectedRevision:0}})
assert.equal(invalidApply.ok,false);assert.equal(raw(),before)
mark('formal apply rejects A masquerading as B even though both previews cover two combinations')
const legacy=`new:${modelId}:${versionId}:${entry}`
assert((await store.saveSalesBindingWorkingCopy({key:legacy,draft:a,baseRevision:0,expectedRevision:0})).ok)
const legacyRaw=disk.get(salesBindingWorkingCopyKey(store.activeUserId,store.previewUserId,legacy))
assert.equal(store.getSalesBindingWorkingCopy(legacy,ia).copy,undefined)
assert(store.listSalesBindingWorkingCopies().copies.some(item=>item.copy.key===legacy&&item.legacy))
const restored=store.getSalesBindingWorkingCopy(legacy).copy!
assert.equal(salesSignature(restored.draft.scope),salesSignature(a.scope))
assert.equal(disk.get(salesBindingWorkingCopyKey(store.activeUserId,store.previewUserId,legacy)),legacyRaw)
mark('legacy key stays intact and requires explicit lookup; actual OR scope is recoverable separately')
quota=true;assert.equal((await save(b)).ok,false);assert.equal(store.getSalesBindingWorkingCopy(kb).copy,undefined);quota=false
assert((await save(b)).ok);assert.equal(store.listSalesBindingWorkingCopies().copies.length,3)
mark('private quota failure is atomic; retry preserves independent A and B copies')
hold=true;let ready=new Promise<void>(resolve=>entered=resolve)
const copyUpdate=other.saveSalesBindingWorkingCopy({key:ka,draft:{...a,name:'另页更新'},identity:ia,baseRevision:0,expectedRevision:1});await ready
const queuedApply=store.saveSalesOptionBinding({draft:{...a,enabled:true},expectedRevision:0,expectedBasis:previewSalesBinding(store.data,{...a,enabled:true}).stamp,requestId:'old-copy',workingContext:{key:ka,identity:ia,expectedRevision:1}})
release();assert((await copyUpdate).ok);assert.equal((await queuedApply).ok,false);assert.equal(raw(),before)
mark('two real Stores under delayed shared lock reject stale private-copy revision before formal application')
hold=true;ready=new Promise<void>(resolve=>entered=resolve);let contextCurrent=true
const delayed=store.saveSalesBindingWorkingCopy({key:kb,draft:b,identity:ib,baseRevision:0,expectedRevision:1},()=>contextCurrent);await ready;contextCurrent=false;release();assert.equal((await delayed).ok,false);assert.equal(store.getSalesBindingWorkingCopy(kb).copy!.revision,1)
mark('switching editing task during delayed save cancels the previous task without touching either range')
assert(store.startPermissionPreview('scope-editor').ok)
assert.equal(store.listSalesBindingWorkingCopies().copies.length,0)
assert((await save(b)).ok);assert.equal(store.listSalesBindingWorkingCopies().copies.length,1)
if(RBAC_ENFORCEMENT_ENABLED)assert.throws(()=>store.saveSalesOptionBinding({draft:{...b,enabled:true},expectedRevision:0,expectedBasis:previewSalesBinding(store.data,{...b,enabled:true}).stamp,requestId:'preview-no-publish',workingContext:{key:kb,identity:ib,expectedRevision:1}}),/未授权/)
assert(store.stopPermissionPreview().ok);assert.equal(store.listSalesBindingWorkingCopies().copies.length,3)
hold=true;ready=new Promise<void>(resolve=>entered=resolve)
const identitySave=save(b,1);await ready;assert(store.startPermissionPreview('scope-editor').ok);release();assert.equal((await identitySave).ok,false);store.stopPermissionPreview()
mark('operator/preview identities isolate listings and drafts; queued identity changes cannot write or publish')
const appliedB={...clone(b),enabled:true}
let result=await store.saveSalesOptionBinding({draft:appliedB,expectedRevision:0,expectedBasis:previewSalesBinding(store.data,appliedB).stamp,requestId:'apply-b',workingContext:{key:kb,identity:ib,expectedRevision:1}})
assert(result.ok&&result.binding,result.message);const formalB=result.binding!
assert.equal(salesSignature(formalB.scope),salesSignature(b.scope));assert.notEqual(salesSignature(formalB.scope),salesSignature(a.scope))
const persisted=JSON.parse(raw()!).data.salesOptionBindings.find((row:{id:string})=>row.id===formalB.id)
assert.deepEqual(persisted.scope,b.scope)
mark('formal persisted selector is exactly B, not the equally sized saved A or a flattened rectangle')
const restoredA=store.getSalesBindingWorkingCopy(ka).copy!,applyA={...clone(restoredA.draft),enabled:true}
result=await store.saveSalesOptionBinding({draft:applyA,expectedRevision:0,expectedBasis:previewSalesBinding(store.data,applyA).stamp,requestId:'explicit-a',workingContext:{key:ka,identity:salesBindingWorkingIdentity(applyA,entry),expectedRevision:2}})
assert(result.ok&&result.binding,result.message);assert.deepEqual(result.binding!.scope,a.scope)
assert.equal(disk.get(salesBindingWorkingCopyKey(store.activeUserId,store.previewUserId,legacy)),legacyRaw)
mark('explicit A recovery applies exact original OR scope; B and legacy contents remain unchanged')
const edit={...clone(formalB),name:'已有绑定草稿'},editIdentity=salesBindingWorkingIdentity(edit,entry)
assert((await store.saveSalesBindingWorkingCopy({key:edit.id,draft:edit,identity:editIdentity,baseRevision:edit.revision,expectedRevision:0})).ok)
const changed={...clone(formalB),name:'正式外部更新'}
assert((await store.saveSalesOptionBinding({draft:changed,expectedRevision:formalB.revision,expectedBasis:previewSalesBinding(store.data,changed).stamp,requestId:'external-formal'})).ok)
const beforeConflict=raw()
result=await store.saveSalesOptionBinding({draft:edit,expectedRevision:edit.revision,expectedBasis:previewSalesBinding(store.data,edit).stamp,requestId:'stale-formal',workingContext:{key:edit.id,identity:editIdentity,expectedRevision:1}})
assert.equal(result.ok,false);assert.equal(raw(),beforeConflict);assert.equal(store.getSalesBindingWorkingCopy(edit.id).conflict,true)
mark('formal revision drift keeps private input and refuses stale application atomically')
const bad=clone(b);if(bad.scope.kind==='model')bad.scope.versionId='missing-version'
assert.equal((await save(bad)).ok,false)
const staleEntry=salesBindingWorkingIdentity(b,'missing-node')
assert.equal((await store.saveSalesBindingWorkingCopy({key:salesBindingWorkingTaskKey(b,'missing-node'),draft:b,identity:staleEntry,baseRevision:0,expectedRevision:0})).ok,false)
mark('removed version or entry node cannot be saved as a current editing context')
store.$dispose();other.$dispose()
console.log(`sales working context ${RBAC_ENFORCEMENT_ENABLED?'strict':'default'}: ${groups} groups passed`)
