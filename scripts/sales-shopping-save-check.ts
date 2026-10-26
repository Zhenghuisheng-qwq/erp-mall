import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { effectScope } from 'vue'
import { installCatalogTestLocks } from './catalog-storage-test-env'
import { createSalesConfigurationFixture } from './sales-configuration-fixtures'
import { useCatalogStore } from '../src/stores/catalog'
import {salesShoppingEntryQuery} from '../src/components/sales-shopping/salesShoppingNavigation'
import { useSalesShoppingDraft } from '../src/components/sales-shopping/useSalesShoppingDraft'
import { addBenefitSku, cloneBenefit, reviewBenefitQuote, setBenefitDevice } from '../src/domain/benefitPackages'
import { addSalesCandidate, attachSalesSource, querySalesCandidates, removeSalesPosition } from '../src/domain/salesSelection'
import { RBAC_ENFORCEMENT_ENABLED } from '../src/domain/accessMode'
import { DATA_VERSION, STORAGE_KEY } from '../src/domain/types'

installCatalogTestLocks()
const request=navigator.locks.request.bind(navigator.locks)
let hold=false,release:()=>void=()=>{},entered:()=>void=()=>{},fail=false,writes=0,groups=0
Object.defineProperty(navigator.locks,'request',{value:(name:string,options:LockOptions,callback:LockGrantedCallback)=>request(name,options,async lock=>{if(hold){hold=false;entered();await new Promise<void>(resolve=>release=resolve)}return callback(lock)})})
const disk=new Map<string,string>(),sessionStorageData=new Map<string,string>()
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>disk.get(key)??null,setItem:(key:string,value:string)=>{if(fail&&key===STORAGE_KEY)throw Error('sales save quota');disk.set(key,value);if(key===STORAGE_KEY)writes++},removeItem:(key:string)=>disk.delete(key)}})
Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:(key:string)=>sessionStorageData.get(key)??null,setItem:(key:string,value:string)=>sessionStorageData.set(key,value),removeItem:(key:string)=>sessionStorageData.delete(key)}})
const fixture=createSalesConfigurationFixture(),{data}=fixture
data.rbac!.roles.push({id:'sales-local-role',code:'sales-local-role',name:'仅本地选购',enabled:true,description:'isolated test',permissionCodes:['product:sales:read']})
data.users.push({id:'sales-local-user',username:'sales-local-user',displayName:'sales-local-user',enabled:true,role:'operator',roleIds:['sales-local-role']})
sessionStorageData.set('iyge-rbac-simulated-user','u-admin');disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data}));setActivePinia(createPinia())
const store=useCatalogStore();await store.waitForPersistence()
const scope=effectScope(),sale=scope.run(()=>useSalesShoppingDraft())!
const business=JSON.stringify([store.data.families,store.data.skus,store.data.specModelVersions,store.data.planningRecords,store.data.materialReceipts,store.data.compatibilities])
function gate(){hold=true;return new Promise<void>(resolve=>entered=resolve)}
function mark(name:string){groups++;console.log(`PASS sales draft: ${name}`)}
const stored=()=>JSON.parse(disk.get(STORAGE_KEY)!).data.benefitPackages.find((record:{id:string})=>record.id===sale.draft.value.id)
const caseCandidate=()=>querySalesCandidates(store.data,sale.draft.value,'phone-a').rows.find(row=>row.skuId==='case-sku')!
let ready=gate()
assert(sale.change(current=>{let next=setBenefitDevice(store.data,current,{kind:'sku',skuId:'phone-a'});next=addBenefitSku(store.data,next,'phone-a',1,{role:'host',groupId:null});return attachSalesSource(store.data,next,'phone-a',next.goods[0]!.id)}))
const initial=sale.flush();await ready
const initialWrites=writes,hostPosition=sale.draft.value.goods[0]!.id
assert(sale.change(current=>addSalesCandidate(store.data,current,caseCandidate(),{sourcePositionId:hostPosition})))
const casePosition=sale.draft.value.goods.find(line=>line.skuId==='case-sku')!.id
assert(sale.change(current=>removeSalesPosition(current,casePosition)))
assert(sale.change(current=>addSalesCandidate(store.data,current,caseCandidate(),{sourcePositionId:hostPosition})))
assert.equal(sale.draft.value.goods.length,2);assert.equal(writes,initialWrites)
release();assert(await initial);assert(await sale.flush())
assert.equal(stored().goods.length,2);assert.equal(store.data.benefitPackages?.length,1)
assert.equal(stored().revision,2);assert.deepEqual(salesShoppingEntryQuery(store,'phone-b'),{scheme:sale.draft.value.id,sku:'phone-b'});mark('first create waiting: add → remove → add stays immediate and one ledger receives latest revision')

ready=gate();assert(sale.change(current=>({...current,name:'A'})));const old=sale.flush();await ready
assert(sale.change(current=>({...current,name:'B'})))
const nextCase=sale.draft.value.goods.find(line=>line.skuId==='case-sku')!.id
assert(sale.change(current=>removeSalesPosition(current,nextCase)))
release();assert(await old);assert.equal(sale.draft.value.name,'B');assert.equal(stored().name,'B');assert.equal(stored().goods.length,1)
mark('old success only advances revision; new name and removal are never restored')

fail=true;const beforeFailure=disk.get(STORAGE_KEY)
assert(sale.change(current=>addSalesCandidate(store.data,current,caseCandidate(),{sourcePositionId:hostPosition})))
assert.equal(await sale.flush(),false);assert.equal(disk.get(STORAGE_KEY),beforeFailure);assert.equal(sale.saveState.value,'failed')
const failedPosition=sale.draft.value.goods.find(line=>line.skuId==='case-sku')!.id
assert(sale.change(current=>removeSalesPosition(current,failedPosition)))
assert(sale.change(current=>({...current,name:'失败后最新选择'})));fail=false
assert(await sale.retry());assert.equal(stored().name,'失败后最新选择');assert.equal(stored().goods.length,1)
mark('quota failure writes zero; later removal is retained and retry persists latest only')

const priorCount=store.data.benefitPackages!.length
assert(await sale.replaceSession(undefined,false,true));assert.deepEqual(salesShoppingEntryQuery(store,'phone-a'),{sku:'phone-a'})
assert(sale.change(current=>addBenefitSku(store.data,current,'phone-b',1,{role:'host',groupId:null})))
assert(await sale.flush());assert.equal(store.data.benefitPackages!.length,priorCount+1)
const secondId=sale.draft.value.id
assert.notEqual(stored().id,store.data.benefitPackages![0]!.id)
mark('explicit new session creates separate identity and retains the previous saved scheme')

ready=gate();assert(sale.change(current=>({...current,name:'旧身份待保存'})));const identitySave=sale.flush();await ready
const beforeIdentity=disk.get(STORAGE_KEY)
assert(store.startPermissionPreview('sales-local-user').ok)
release();assert.equal(await identitySave,false);await store.waitForPersistence();assert.equal(disk.get(STORAGE_KEY),beforeIdentity)
if(RBAC_ENFORCEMENT_ENABLED){
  assert(sale.canEdit.value);assert.equal(sale.canPersist.value,false);assert.deepEqual(salesShoppingEntryQuery(store,'phone-a'),{sku:'phone-a'})
  assert(sale.change(current=>addBenefitSku(store.data,current,'phone-a',1,{role:'host',groupId:null})))
  assert.equal(await sale.flush(),false);await store.waitForPersistence();assert.equal(disk.get(STORAGE_KEY),beforeIdentity)
  assert.match(sale.saveLabel.value,/临时选购/)
  const local=JSON.stringify(sale.draft.value)
  assert.equal(await sale.replaceSession(store.data.benefitPackages![0]!,true,true),false)
  assert.equal(JSON.stringify(sale.draft.value),local)
  const directScope=effectScope(),direct=directScope.run(()=>useSalesShoppingDraft())!
  direct.loadInitial(secondId!)
  assert(direct.missing.value);assert.equal(direct.draft.value.id,'');assert.equal(direct.draft.value.goods.length,0)
  assert.notEqual(direct.draft.value.name,'旧身份待保存');directScope.stop()
}
assert(store.stopPermissionPreview().ok);assert.equal(sale.draft.value.id,secondId);assert.equal(sale.draft.value.name,'旧身份待保存')
assert(await sale.retry());assert.equal(stored().name,'旧身份待保存');assert.equal(salesShoppingEntryQuery(store).scheme,secondId)
mark('identity change cancels locked write; read-only role can choose locally with zero persistence; owner retry recovers draft')

const unchangedWrites=writes;assert(sale.change(current=>cloneBenefit(current)));assert(await sale.flush());assert.equal(writes,unchangedWrites)
assert(sale.change(current=>{current.quote.amountCents=129900;return reviewBenefitQuote(current,store.data)}));assert(await sale.flush())
assert(await sale.prepareDelivery());assert(sale.preview.value?.canConfirm,sale.preview.value?.issues.map(issue=>issue.message).join('；'))
sale.confirmed.value=true;ready=gate();const generating=sale.generate();await ready
assert.equal((await sale.generate()).ok,false)
release();const delivered=await generating;assert(delivered.ok&&delivered.delivery)
assert.equal(store.data.benefitDeliveries?.length,1);assert.equal(delivered.delivery.goods[0]!.skuId,'phone-b')
mark('unchanged draft does not write; quotation and formal delivery use existing protected Store with duplicate prevention')

const known=cloneBenefit(sale.draft.value),unknown=cloneBenefit(known)
Object.assign(unknown,{compositionVersion:99})
const beforeUnknown=disk.get(STORAGE_KEY)
assert(await sale.replaceSession(unknown,false,true));assert.equal(sale.canEdit.value,false);assert.equal(sale.canPersist.value,false)
assert.equal(sale.change(current=>({...current,name:'不允许改写'})),false);assert.equal(sale.draft.value.name,unknown.name)
assert.equal(await sale.replaceSession(unknown,true,true),false);assert.equal(disk.get(STORAGE_KEY),beforeUnknown)
Object.assign(unknown,{compositionVersion:2,sales:{schemaVersion:99,origins:[],contexts:[]}})
assert(await sale.replaceSession(unknown,false,true));assert.equal(sale.canEdit.value,false);assert.equal(await sale.replaceSession(unknown,true,true),false)
const unknownFramework=cloneBenefit(known);Object.assign(unknownFramework,{framework:{kind:'future-framework',frameworkId:'future',revision:1,name:'未来框架',groups:[]}})
assert(await sale.replaceSession(unknownFramework,false,true));assert.equal(sale.canEdit.value,false);assert.equal(sale.canPersist.value,false);assert.equal(await sale.replaceSession(unknownFramework,true,true),false);assert.equal(disk.get(STORAGE_KEY),beforeUnknown)
assert(await sale.replaceSession({...known,favorite:true},true,true));assert.equal(sale.draft.value.favorite,false)
assert(await sale.flush());assert.notEqual(sale.draft.value.id,known.id);assert.equal(store.data.benefitPackages!.find(row=>row.id===known.id)!.name,known.name)
mark('unknown composition and sales versions stay read-only with zero writes; using a favorite creates an independent non-favorite sales draft')

ready=gate();assert(sale.change(current=>({...current,name:'页面销毁后不可写'})));const disposal=sale.flush();await ready
const beforeDispose=disk.get(STORAGE_KEY);scope.stop();release();assert.equal(await disposal,false);await store.waitForPersistence();assert.equal(disk.get(STORAGE_KEY),beforeDispose)
assert.equal(JSON.stringify([store.data.families,store.data.skus,store.data.specModelVersions,store.data.planningRecords,store.data.materialReceipts,store.data.compatibilities]),business)
store.$dispose();mark('page disposal cancels old save; SKU/model/PLN/MAT and compatibility business data unchanged')
console.log(`PASS sales shopping delayed save ${groups} groups (${RBAC_ENFORCEMENT_ENABLED?'strict':'default'})`)

await import('./sales-selection-store-repair-check')
