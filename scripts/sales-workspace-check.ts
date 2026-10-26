import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { installCatalogTestLocks } from './catalog-storage-test-env'
import { createSalesConfigurationFixture } from './sales-configuration-fixtures'
import { useCatalogStore } from '../src/stores/catalog'
import { DATA_VERSION, STORAGE_KEY } from '../src/domain/types'
import { RBAC_ENFORCEMENT_ENABLED } from '../src/domain/accessMode'
import { addBenefitSku, newBenefitPackageDraft, cloneBenefit, validateBenefitPackage } from '../src/domain/benefitPackages'
import { addSalesCandidate, attachSalesSource, createSalesCommonCombinationDraft, querySalesCandidates, replaceSalesPosition, reselectSalesSource, removeSalesPosition, setSalesDevice } from '../src/domain/salesSelection'
import { previewSalesBinding, resolveSalesPlanForCombination } from '../src/domain/salesConfiguration'

installCatalogTestLocks()
const original=navigator.locks.request.bind(navigator.locks)
let hold=false,release=()=>{},entered=()=>{},quota=false,groups=0
Object.defineProperty(navigator.locks,'request',{value:(name:string,options:LockOptions,callback:LockGrantedCallback)=>original(name,options,async lock=>{if(hold){hold=false;entered();await new Promise<void>(r=>release=r)}return callback(lock)})})
const disk=new Map<string,string>(),session=new Map<string,string>()
const storage=(map:Map<string,string>)=>({getItem:(key:string)=>map.get(key)??null,removeItem:(key:string)=>map.delete(key),setItem:(key:string,value:string)=>{if(quota)throw Error('test quota');map.set(key,value)}})
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage(disk)});Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:storage(session)})
const fixture=createSalesConfigurationFixture(),data=fixture.data
const secondService={...cloneBenefit(fixture.phonePlan.items.find(item=>item.scope.kind==='service')!),id:'service-care',name:'保养服务',maxQuantity:1}
fixture.phonePlan.items.push(secondService);fixture.phonePlan.versions[0]!.items.push(cloneBenefit(secondService))
data.rbac!.roles.push({id:'workspace-editor-role',code:'workspace-editor',name:'工作编辑',enabled:true,description:'test',permissionCodes:['product:sales-config:read','product:sales-config:update']})
data.users.push({id:'workspace-editor',username:'workspace-editor',displayName:'工作编辑',enabled:true,role:'operator',roleIds:['workspace-editor-role']})
disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data}));session.set('iyge-rbac-simulated-user','u-admin')
setActivePinia(createPinia());const store=useCatalogStore();await store.waitForPersistence()
const mark=(label:string)=>{groups++;console.log(`PASS sales workspace: ${label}`)}
const binding=cloneBenefit(fixture.phoneBinding),key=binding.id,work={...binding,name:'仅工作草稿',mode:'none' as const,planId:null,planVersion:null}
const before=disk.get(STORAGE_KEY)
let saved=await store.saveSalesBindingWorkingCopy({key,draft:work,baseRevision:binding.revision,expectedRevision:0});assert(saved.ok&&'copy'in saved&&saved.copy)
assert.equal(disk.get(STORAGE_KEY),before);assert.equal(store.data.salesOptionBindings!.find(row=>row.id===key)!.enabled,true)
assert.equal(store.getSalesBindingWorkingCopy(key).copy!.draft.name,'仅工作草稿')
assert.equal((await store.saveSalesBindingWorkingCopy({key,draft:work,baseRevision:binding.revision,expectedRevision:0})).ok,false)
mark('working draft survives reopen, never disables formal binding, CAS refuses second tab overwrite')
quota=true;const beforeWork=JSON.stringify([...disk]);saved=await store.saveSalesBindingWorkingCopy({key,draft:{...work,name:'保留最新输入'},baseRevision:binding.revision,expectedRevision:1});assert.equal(saved.ok,false);assert.equal(JSON.stringify([...disk]),beforeWork)
quota=false;assert((await store.saveSalesBindingWorkingCopy({key,draft:{...work,name:'重试最新'},baseRevision:binding.revision,expectedRevision:1})).ok)
mark('work draft quota failure leaves both stores unchanged; retry saves latest input')
store.simulateUser('workspace-editor');assert.equal(store.getSalesBindingWorkingCopy(key).copy,undefined)
assert((await store.saveSalesBindingWorkingCopy({key,draft:work,baseRevision:binding.revision,expectedRevision:0})).ok)
if(RBAC_ENFORCEMENT_ENABLED)assert.throws(()=>store.saveSalesOptionBinding({draft:{...binding,enabled:false},expectedRevision:binding.revision,expectedBasis:previewSalesBinding(store.data,{...binding,enabled:false}).stamp,requestId:'no-publish'}),/未授权/)
assert.equal(store.data.salesOptionBindings!.find(row=>row.id===key)!.enabled,true)
store.stopPermissionPreview();assert.equal(store.getSalesBindingWorkingCopy(key).copy!.draft.name,'重试最新')
mark('actor drafts isolated; update-only may save private work but cannot disable formal binding')
hold=true;let ready=new Promise<void>(r=>entered=r)
const delayed=store.saveSalesBindingWorkingCopy({key,draft:work,baseRevision:binding.revision,expectedRevision:2});await ready
store.simulateUser('workspace-editor');release();assert.equal((await delayed).ok,false);store.stopPermissionPreview()
assert.equal(store.getSalesBindingWorkingCopy(key).copy!.revision,2)
mark('identity change inside delayed Web Lock cancels private save')
const changed={...binding,name:'外部修订'}
assert((await store.saveSalesOptionBinding({draft:changed,expectedRevision:binding.revision,expectedBasis:previewSalesBinding(store.data,changed).stamp,requestId:'formal-change'})).ok)
assert.equal(store.getSalesBindingWorkingCopy(key).conflict,true)
assert.equal((await store.saveSalesBindingWorkingCopy({key,draft:work,baseRevision:binding.revision,expectedRevision:2})).ok,false)
assert.equal(store.getSalesBindingWorkingCopy(key).copy!.draft.name,'重试最新')
mark('formal revision change flags conflict without deleting or applying private work')
assert.equal(resolveSalesPlanForCombination(store.data,{modelId:fixture.modelId,versionId:fixture.versionId,identityKey:fixture.context.combinations[0]!.identityKey}).state,'matched')
assert.equal(resolveSalesPlanForCombination(store.data,{modelId:fixture.modelId,versionId:null,identityKey:fixture.context.combinations[0]!.identityKey}).state,'unconfigured')
mark('model result reads exact viewed published version; draft does not borrow published default')

let draft={...newBenefitPackageDraft(),name:'工作区测试',sales:{schemaVersion:1 as const,origins:[],contexts:[]}}
draft=setSalesDevice(store.data,draft,{kind:'sku',skuId:'phone-a'}) as typeof draft
draft=addBenefitSku(store.data,draft,'phone-a',1,{role:'host',groupId:null}) as typeof draft
let host=draft.goods[0]!
draft=attachSalesSource(store.data,draft,'phone-a',host.id) as typeof draft
const candidate=querySalesCandidates(store.data,draft,'phone-a',undefined,host.id).rows.find(row=>row.skuId==='case-sku')!
assert.throws(()=>addSalesCandidate(store.data,{...cloneBenefit(draft),framework:{kind:'type-v2',frameworkId:'old-framework',revision:1,name:'旧框架',groups:[]}},candidate,{sourcePositionId:host.id}),/不能自动叠加/)
draft=addSalesCandidate(store.data,draft,candidate,{sourcePositionId:host.id}) as typeof draft
const caseLine=draft.goods.find(line=>line.skuId==='case-sku')!,caseOldId=caseLine.id
const film=querySalesCandidates(store.data,draft,'case-sku',undefined,caseLine.id).rows.find(row=>row.skuId==='film-sku')!
draft=addSalesCandidate(store.data,draft,film,{sourcePositionId:caseLine.id}) as typeof draft
const filmId=draft.goods.find(line=>line.skuId==='film-sku')!.id
const originalDraft=JSON.stringify(draft)
assert.throws(()=>replaceSalesPosition(store.data,draft,caseOldId,'film-sku'),/用途/);assert.equal(JSON.stringify(draft),originalDraft)
draft=replaceSalesPosition(store.data,draft,caseOldId,candidate,{sourcePositionId:host.id}) as typeof draft
const newCase=draft.goods[1]!;assert.notEqual(newCase.id,caseOldId);assert.equal(newCase.skuId,'case-sku');assert.equal(draft.goods[2]!.id,filmId)
assert(validateBenefitPackage(store.data,draft).canSaveDraft)
assert(!validateBenefitPackage(store.data,draft).canSaveAvailable)
let result=await store.saveBenefitPackage({draft,status:'draft',expectedRevision:0,requestId:'replace-save'});assert(result.ok&&result.package,result.message)
draft=cloneBenefit(result.package) as typeof draft
mark('atomic replacement fresh identity + same visual slot; orphaned child remains saveable pending draft')
draft=reselectSalesSource(store.data,draft,filmId,newCase.id) as typeof draft
const newFilm=draft.goods[2]!;assert.notEqual(newFilm.id,filmId);assert.equal(draft.sales.origins.find((row:any)=>row.positionId===newFilm.id)?.sourcePositionId,newCase.id)
result=await store.saveBenefitPackage({draft,status:'draft',expectedRevision:draft.revision,requestId:'reselect-save'});assert(result.ok&&result.package,result.message);draft=cloneBenefit(result.package) as typeof draft
assert.throws(()=>reselectSalesSource(store.data,draft,newCase.id,newFilm.id),/循环/)
mark('explicit source reassignment validates current purpose and saves new identity; cycles rejected')
const serviceCandidates=querySalesCandidates(store.data,draft,host.skuId,undefined,host.id).rows.filter(row=>row.item.scope.kind==='service')
draft=addSalesCandidate(store.data,draft,serviceCandidates.find(row=>row.item.id==='service-choice')!,{sourcePositionId:host.id}) as typeof draft
const serviceBefore=draft.services[0]!.id
draft.services[0]!.quantity=3
const serviceTarget=cloneBenefit(serviceCandidates.find(row=>row.item.id==='service-care')!)
serviceTarget.item.maxQuantity=999
draft=replaceSalesPosition(store.data,draft,serviceBefore,serviceTarget,{sourcePositionId:host.id}) as typeof draft
assert.equal(draft.services[0]!.quantity,1,'new real limit overrides caller quantity claims and resets to legal default')
assert.equal(draft.services.length,1);assert.notEqual(draft.services[0]!.id,serviceBefore);assert.equal(draft.services[0]!.name,'保养服务')
result=await store.saveBenefitPackage({draft,status:'draft',expectedRevision:draft.revision,requestId:'service-replace'});assert(result.ok&&result.package,result.message);draft=cloneBenefit(result.package) as typeof draft
mark('service replacement selects real published service under same frozen source, fresh identity saves atomically')
draft=replaceSalesPosition(store.data,draft,host.id,'phone-b') as typeof draft
assert.equal(draft.goods[0]!.skuId,'phone-b');assert.notEqual(draft.goods[0]!.id,host.id);assert.equal(draft.device?.kind==='sku'&&draft.device.skuId,'phone-b');assert.equal(draft.goods.length,3)
result=await store.saveBenefitPackage({draft,status:'draft',expectedRevision:draft.revision,requestId:'phone-replace'});assert(result.ok&&result.package,result.message);draft=cloneBenefit(result.package) as typeof draft
const serviceOldSource=draft.services[0]!.id
draft=reselectSalesSource(store.data,draft,serviceOldSource,draft.goods[0]!.id) as typeof draft
assert.notEqual(draft.services[0]!.id,serviceOldSource)
result=await store.saveBenefitPackage({draft,status:'draft',expectedRevision:draft.revision,requestId:'service-source'});assert(result.ok&&result.package,result.message);draft=cloneBenefit(result.package) as typeof draft
mark('phone replacement preserves accessories for recheck, updates usage device and saves through real Store')
const sourceSnapshot=JSON.stringify(store.data.benefitPackages),copy=createSalesCommonCombinationDraft(draft,'每日组合'),input={draft:copy,status:'draft' as const,expectedRevision:0,requestId:'favorite-copy'}
quota=true;assert.equal((await store.saveBenefitPackage(input)).ok,false);assert.equal(JSON.stringify(store.data.benefitPackages),sourceSnapshot);quota=false
result=await store.saveBenefitPackage(input);assert(result.ok&&result.package,result.message);const copyId=result.package.id
assert.notEqual(copyId,draft.id);assert.equal(result.package.favorite,true)
assert((await store.saveBenefitPackage(input)).ok);assert.equal(store.data.benefitPackages!.filter(row=>row.id===copyId).length,1)
assert.equal(JSON.stringify(store.data.benefitPackages!.find(row=>row.id===draft.id)),JSON.stringify(draft))
mark('common combination is independent favorite copy, quota retry is idempotent, original unchanged')

const link=cloneBenefit(store.data.compatibilities[0]!)
hold=true;ready=new Promise<void>(r=>entered=r);let current=true
const command=store.commitCompatibilityChanges([],{expectedLinks:[{id:link.id,stamp:JSON.stringify(link)}],isCurrent:()=>current});await ready;current=false;release();assert.equal((await command).ok,false)
assert.equal((await store.commitCompatibilityChanges([],{expectedLinks:[{id:link.id,stamp:'stale'}]})).ok,false)
mark('declaration delayed-context and stale-record guards refuse complete batch without writes')
if(RBAC_ENFORCEMENT_ENABLED){
  assert(store.startPermissionPreview('workspace-editor').ok)
  const privateBefore=JSON.stringify([...disk].filter(([name])=>name.startsWith('iyge-sales-binding-work:'))),catalogBefore=disk.get(STORAGE_KEY)!
  const current=store.data.salesOptionBindings!.find(row=>row.id===key)!
  hold=true;ready=new Promise<void>(r=>entered=r)
  const queued=store.saveSalesBindingWorkingCopy({key:'permission-revoked',draft:cloneBenefit(current),baseRevision:current.revision,expectedRevision:0});await ready
  const external=JSON.parse(catalogBefore);external.data.rbac.roles.find((role:{id:string})=>role.id==='workspace-editor-role').permissionCodes=['product:sales-config:read'];disk.set(STORAGE_KEY,JSON.stringify(external))
  release();assert.equal((await queued).ok,false)
  assert.equal(JSON.stringify([...disk].filter(([name])=>name.startsWith('iyge-sales-binding-work:'))),privateBefore)
  disk.set(STORAGE_KEY,catalogBefore);store.stopPermissionPreview()
  mark('same identity with externally revoked permission cancels delayed private write under catalog conflict guard')
}
console.log(`sales workspace ${RBAC_ENFORCEMENT_ENABLED?'strict':'default'}: ${groups} groups passed`)
