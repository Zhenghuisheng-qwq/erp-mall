import assert from 'node:assert/strict'
import {generalFixture} from './type-bundle-fixture'
import {applyGeneralChanges,generalStorageProblems,type GeneralDraft} from '../src/domain/generalCompatibility'
import {queryDeviceAccessories,queryModelAccessories,queryAccessoryDevices,accessoryUseEvaluation} from '../src/domain/accessoryCompatibilityQuery'
import {saleQuery} from '../src/domain/benefitSales/query'
import {copy,writeSale} from '../src/domain/benefitSales/commands'
import {createPinia,setActivePinia} from 'pinia'
import {installCatalogTestLocks} from './catalog-storage-test-env'
import {useCatalogStore} from '../src/stores/catalog'
import {DATA_VERSION,STORAGE_KEY} from '../src/domain/types'
const {data,hosts}=generalFixture(),now='2026-10-29T09:00:00Z'
const claim:GeneralDraft={skuId:'charger-sku',deviceTypeIds:['type-device','type-tablet','type-computer'],capability:'basic',conditions:[{kind:'attribute',attributeId:'attr-port',operator:'eq',value:'USB-C'}],conclusion:'compatible',verification:'confirmed',source:'隔离供应商测试：明确确认此条件下基本使用，不代表真实资料',note:''}
assert(!applyGeneralChanges(data,[{kind:'add',draft:{...claim,conditions:[]}}],()=> 'bare',now).ok)
assert(applyGeneralChanges(data,[{kind:'add',draft:claim}],()=> 'same-id',now).ok)
const scope=(device:string)=>({mode:'free' as const,categoryId:'cat-accessory-test',productTypeIds:['type-charger'],device:{kind:'sku' as const,skuId:device}})
const candidate=(device:string)=>saleQuery(data,scope(device)).candidates.find(c=>c.id==='charger-sku')
for(const device of ['phone-a','tablet','computer','phone-new'])assert(candidate(device),device)
for(const device of ['phone-wrong','phone-b'])assert(!candidate(device),device)
const wrong=queryDeviceAccessories(data,'phone-wrong');assert(!wrong.excluded.some(c=>c.sku.id==='charger-sku'));assert(wrong.pending.some(c=>c.sku.id==='charger-sku'))
assert(candidate('phone-a')!.match!.evidence!.some(e=>e.key==='general:same-id'&&e.effective))
assert.equal(queryModelAccessories(data,hosts.a).sales.some(c=>c.sku.id==='charger-sku'),false)
const specific={...copy(data.compatibilities.find(c=>c.id==='decl-film-a')!),id:'same-id',targetId:'charger-sku',accessorySkuId:'charger-sku'};data.compatibilities.push(specific)
const mixed=candidate('phone-a')!.match!;assert.equal(queryDeviceAccessories(data,'phone-a').sales.filter(c=>c.sku.id==='charger-sku').length,1);assert(mixed.evidence!.some(e=>e.key==='model:same-id'));assert(mixed.evidence!.some(e=>e.key==='general:same-id'))
data.params.push({id:'attr-protocol-unrecorded',name:'未登记的协议事实',values:['supplier-confirmed'],valueGroups:[]})
const unknown={...claim,conditions:[{kind:'attribute' as const,attributeId:'attr-protocol-unrecorded',operator:'eq' as const,value:'supplier-confirmed'}]};assert(applyGeneralChanges(data,[{kind:'add',draft:unknown}],()=> 'unknown',now).ok);assert(candidate('phone-a'));assert(candidate('phone-a')!.match!.evidence!.some(e=>e.key==='general:unknown'&&e.conditions.some(c=>c.state==='unknown')))
data.compatibilities.push({...copy(specific),id:'deny',conclusion:'incompatible'});assert(!candidate('phone-a'));assert(queryDeviceAccessories(data,'phone-a').excluded.find(c=>c.sku.id==='charger-sku')!.basic.conflict)
data.compatibilities=data.compatibilities.filter(c=>c.id!=='deny')
const saved=writeSale(data,{id:'',scope:scope('tablet'),lines:[{skuId:'charger-sku',quantity:1,unitPriceCents:5500}],status:'confirmed'},0,()=> 'confirmed',now);assert(saved.ok);assert(saved.record.snapshot!.lines[0]!.evidence!.some(e=>e.kind==='general'));assert(saved.record.snapshot!.lines[0]!.capabilities!.length)
const frozen=JSON.stringify(saved.record.snapshot);assert(applyGeneralChanges(data,[{kind:'edit',id:'same-id',revision:1,draft:{...claim,conclusion:'incompatible'}}],()=>'',now).ok);assert.equal(JSON.stringify(saved.record.snapshot),frozen);assert(!candidate('tablet'))
const reverse=queryAccessoryDevices(data,{kind:'sku',id:'charger-sku'});assert.equal(reverse.generalDeclarations!.length,2);assert(reverse.generalDevices!.some(d=>d.skuId==='tablet'&&accessoryUseEvaluation(d).status==='incompatible'))
assert.deepEqual(generalStorageProblems(data),[])
const noSource=copy(data);noSource.generalCompatibilityClaims=noSource.generalCompatibilityClaims!.map(c=>({...c,source:''}));assert(!saleQuery(noSource,scope('tablet')).candidates.length)
const invalid=copy(data);invalid.params=invalid.params.filter(p=>p.id!=='attr-port');assert(saleQuery(invalid,scope('tablet')).groups[0]!.diagnostics.some(d=>d.reason.includes('失效')))
console.log('PASS one SKU across phone/tablet/computer, unmet is not denial, unknown/model-only conservative, typed evidence collision, positive alternatives, effective deny conflict, fast-charge independence, immutable evidence and reverse actual-device previews')
const undo=installCatalogTestLocks(),disk=new Map<string,string>(),session=new Map<string,string>();let fail=false
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>disk.get(k)??null,setItem:(k:string,v:string)=>{if(fail&&k===STORAGE_KEY){fail=false;throw Error('quota test')}disk.set(k,String(v))},removeItem:(k:string)=>disk.delete(k)}})
Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:(k:string)=>session.get(k)??null,setItem:(k:string,v:string)=>session.set(k,String(v)),removeItem:(k:string)=>session.delete(k)}})
let store:ReturnType<typeof useCatalogStore>|undefined
try{disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data:generalFixture().data}));session.set('iyge-rbac-simulated-user','u-admin');setActivePinia(createPinia());store=useCatalogStore();await store.waitForPersistence();const before=disk.get(STORAGE_KEY),changes=[{kind:'add' as const,draft:claim},{kind:'add' as const,draft:{...claim,skuId:'charger-white'}}];fail=true;assert(!(await store.commitGeneralCompatibility(changes,'[]')).ok);assert.equal(disk.get(STORAGE_KEY),before);assert.equal(store.data.generalCompatibilityClaims,undefined);assert((await store.commitGeneralCompatibility(changes,'[]')).ok);assert.equal(store.data.generalCompatibilityClaims!.length,2);assert((await store.commitGeneralCompatibility(changes,JSON.stringify(store.data.generalCompatibilityClaims))).ok);assert.equal(store.data.generalCompatibilityClaims!.length,2);assert(!(await store.commitGeneralCompatibility(changes,'[]')).ok)
 store.$dispose();session.set('iyge-rbac-simulated-user','test-sales');setActivePinia(createPinia());store=useCatalogStore();await store.waitForPersistence();assert.throws(()=>store!.commitGeneralCompatibility(changes,JSON.stringify(store!.data.generalCompatibilityClaims)),/未授权/);assert(saleQuery(store.data,scope('tablet')).candidates.some(c=>c.id==='charger-sku'))
 console.log('PASS batch is atomic on quota failure, selected targets only, repeat skips duplicates, stale basis rejected, sales may use but not modify')
}finally{store?.$dispose();undo()}
