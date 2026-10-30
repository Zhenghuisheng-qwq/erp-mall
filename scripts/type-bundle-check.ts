import assert from 'node:assert/strict'
import {createPinia,setActivePinia} from 'pinia'
import {nextTick} from 'vue'
import {installCatalogTestLocks} from './catalog-storage-test-env'
import {createSeed} from '../src/domain/seed'
import {phoneDemoTypes,supplementPhoneDemo} from '../src/domain/benefitSales/demo'
import {bundleFixture} from './type-bundle-fixture'
import {copy,writeGroup,writeSale,priceCents,total,benefitStorageProblems} from '../src/domain/benefitSales/commands'
import {saleQuery} from '../src/domain/benefitSales/query'
import {deviceHostKey} from '../src/domain/deviceResolution'
import {useCatalogStore,normalizeStored} from '../src/stores/catalog'
import {DATA_VERSION,STORAGE_KEY} from '../src/domain/types'
import type {SaleScope,SaleInput,GroupInput} from '../src/domain/benefitSales/types'
const {data,hosts}=bundleFixture(),now='2026-10-29T08:00:00.000Z'
const group:GroupInput={id:'',name:'跨分类综合组合',categoryId:'cat-device-test',productTypeIds:['type-device','type-film','type-charger','type-empty','type-cable','type-case'],enabled:true,sort:0}
assert(writeGroup(data,group,0,()=> 'bundle-one',now).ok)
const scope:SaleScope={mode:'group',groupId:'bundle-one',categoryId:group.categoryId,productTypeIds:[...group.productTypeIds],device:{kind:'sku',skuId:'phone-a'}}
const ids=(s:SaleScope)=>saleQuery(data,s).candidates.map(c=>c.id).sort()
assert.deepEqual(ids(scope),['case-sku','charger-sku','film-sku','phone-a'])
assert.deepEqual(ids({...scope,device:{kind:'sku',skuId:'phone-b'}}),['case-sku','charger-sku','film-b','phone-b'])
assert(!ids({...scope,device:{kind:'model',key:deviceHostKey(hosts.a)}}).includes('phone-a'))
assert(!ids({...scope,device:null}).length)
const draft:SaleInput={id:'',scope,lines:[{skuId:'film-sku',quantity:2,unitPriceCents:null},{skuId:'charger-sku',quantity:1,unitPriceCents:0}],status:'draft'}
assert(writeSale(data,draft,0,()=> 'sale-one',now).ok)
for(const bad of ['film-b','pending-sku','blocked-sku','cable-sku','off-sale-sku','mat-copy'])assert(!writeSale(data,{...draft,lines:[{skuId:bad,quantity:1,unitPriceCents:0}]},0,()=> 'invalid',now).ok)
assert(!writeSale(data,{...draft,status:'confirmed'},0,()=> 'invalid',now).ok)
assert.equal(priceCents(''),null);assert.equal(priceCents('0'),0);assert.equal(priceCents('12.34'),1234);assert.equal(priceCents('1.001'),undefined);assert(total([{skuId:'x',quantity:0,unitPriceCents:0}]).error)
const confirmation=writeSale(data,{...draft,id:'sale-one',lines:draft.lines.map(l=>({...l,unitPriceCents:1234})),status:'confirmed'},1,()=> 'unused',now);assert(confirmation.ok)
const frozen=JSON.stringify(data.benefitSalesLists![0]);data.skus.find(s=>s.id==='film-sku')!.skuName='后来的名称';data.compatibilities.find(d=>d.id==='decl-film-a')!.source='后来的依据';data.benefitTypeGroups![0]!.enabled=false
assert.equal(JSON.stringify(data.benefitSalesLists![0]),frozen);assert(!writeSale(data,{...draft,id:'sale-one'},2,()=>'',now).ok)
const free={...scope,mode:'free' as const,groupId:undefined};assert(writeSale(data,{...draft,scope:free},0,()=> 'free',now).ok)
assert(!writeSale(data,draft,0,()=> 'disabled',now).ok)
const newSku={...copy(data.skus.find(s=>s.id==='film-sku')!),id:'new-film'};data.skus.push(newSku);data.compatibilities.push({...copy(data.compatibilities.find(d=>d.id==='decl-film-a')!),id:'new-proof',accessorySkuId:'new-film',targetId:'new-film'});assert(ids(free).includes('new-film'));assert(!data.benefitTypeGroups![0]!.productTypeIds.includes('future-type'))
assert.deepEqual(benefitStorageProblems(data),[])
console.log('PASS cross-category/zero-SKU groups, A/B exclusive/shared candidates, pending/conflict/unknown/off-sale/MAT exclusions, ordinary phone admission, free mode, integer prices and immutable snapshots')
const undo=installCatalogTestLocks(),disk=new Map<string,string>(),session=new Map<string,string>();let fail=false
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>disk.get(k)??null,setItem:(k:string,v:string)=>{if(fail&&k===STORAGE_KEY){fail=false;throw Error('quota test')}disk.set(k,String(v))},removeItem:(k:string)=>disk.delete(k)}})
Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:(k:string)=>session.get(k)??null,setItem:(k:string,v:string)=>session.set(k,String(v)),removeItem:(k:string)=>session.delete(k)}})
let store:ReturnType<typeof useCatalogStore>|undefined
try{
 const seed=bundleFixture().data,rawOld=JSON.stringify([(seed as any).benefitGroups,(seed as any).benefitSelections]);disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data:seed}));session.set('iyge-rbac-simulated-user','u-admin');setActivePinia(createPinia());store=useCatalogStore();await nextTick();await store.waitForPersistence();assert.equal(store.data.benefitTypeGroups,undefined)
 const before=disk.get(STORAGE_KEY);fail=true;assert.equal((await store.saveTypeBundle(group,0)).ok,false);assert.equal(disk.get(STORAGE_KEY),before);assert.equal(store.data.benefitTypeGroups,undefined)
 const saved=await store.saveTypeBundle(group,0);assert(saved.ok&&'record' in saved);assert.equal((await store.saveTypeBundle({...group,id:saved.record.id},0)).ok,false)
 const freeDraft={...draft,scope:free};assert.equal((await store.saveBundleSale(freeDraft,0)).ok,true)
 assert.equal(JSON.stringify([(JSON.parse(disk.get(STORAGE_KEY)!).data).benefitGroups,(JSON.parse(disk.get(STORAGE_KEY)!).data).benefitSelections]),rawOld)
 const exported=JSON.parse(store.exportJson());assert(normalizeStored(exported)?.benefitSalesLists?.length)
 store.$dispose();session.set('iyge-rbac-simulated-user','test-sales');setActivePinia(createPinia());store=useCatalogStore();await nextTick();await store.waitForPersistence()
 if(store.rbacEnforced){assert.throws(()=>store!.saveTypeBundle(group,0),/未授权/);assert(store.can('product:bundle-sale:create'));assert(!store.can('product:compatibility:update'))}
 assert.equal((await store.saveBundleSale(freeDraft,0)).ok,true)
 console.log('PASS real Store queue: failed write atomic, revision conflict, old namespaces preserved, refresh/import normalization, sales-only permissions and free sale')
 store.$dispose();session.set('iyge-rbac-simulated-user','u-admin');disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data:createSeed(false)}));setActivePinia(createPinia());store=useCatalogStore();await nextTick();await store.waitForPersistence()
 const beforeDemo=disk.get(STORAGE_KEY);fail=true;assert.equal((await store.supplementPhoneDemo()).ok,false);assert.equal(disk.get(STORAGE_KEY),beforeDemo);assert.equal(store.data.benefitTypeGroups,undefined)
 const supplement=await store.supplementPhoneDemo();assert.equal(supplement.ok,true,supplement.message)
 const demoSaved=disk.get(STORAGE_KEY);const repeatDemo=await store.supplementPhoneDemo();assert.equal(repeatDemo.ok,true,repeatDemo.message);assert.equal(disk.get(STORAGE_KEY),demoSaved)
 const fresh=createSeed(),demoScope:SaleScope={mode:'group',groupId:'demo-phone-basic',categoryId:'c-phone',productTypeIds:phoneDemoTypes,device:{kind:'sku',skuId:'s-iphone-blue'}}
 assert(phoneDemoTypes.every(id=>fresh.productTypes.find(t=>t.id===id)?.categoryId==='c-phone'));assert(!fresh.categories.some(c=>c.parentId==='c-phone'))
 for(const source of [fresh,store.data]){const a=saleQuery(source,demoScope).candidates.map(c=>c.id),b=saleQuery(source,{...demoScope,device:{kind:'sku',skuId:'s-demo-iphone16'}}).candidates.map(c=>c.id);for(const id of ['s-case-clear','s-film-1','s-demo-charger','s-demo-earphones'])assert(a.includes(id),`A missing ${id}`);for(const id of ['s-demo-case16','s-demo-film16','s-demo-charger','s-demo-earphones'])assert(b.includes(id),`B missing ${id}`);assert(!a.includes('s-demo-case16'));assert(!b.includes('s-case-clear'))}
 const demoBefore=normalizeStored({version:DATA_VERSION,data:createSeed(false)},{persist:false})!,after=normalizeStored({version:DATA_VERSION,data:fresh},{persist:false})!,modified=copy(demoBefore);modified.families.find(f=>f.id==='f-iphone')!.name='用户自行维护的手机';const modifiedStamp=JSON.stringify(modified);assert(!supplementPhoneDemo(modified,demoBefore,after).ok);assert.equal(JSON.stringify(modified),modifiedStamp)
 const adopted=copy(demoBefore);adopted.families.push({...copy(adopted.families.find(f=>f.id==='f-case')!),id:'user-real-case',origin:'created'});assert(!supplementPhoneDemo(adopted,demoBefore,after).ok);const referenced=copy(demoBefore);referenced.benefitTypeGroups=[{id:'user-types',name:'用户组合',categoryId:'c-film',productTypeIds:['pt-leaf-c-film'],enabled:true,sort:0,revision:1,createdAt:now,updatedAt:now}];assert(!supplementPhoneDemo(referenced,demoBefore,after).ok)
 console.log('PASS full demo A/B phone, four accessory groups, one shared charger, exact-ID supplement idempotency, modified records protected and quota failure atomic')

}finally{store?.$dispose();undo()}
