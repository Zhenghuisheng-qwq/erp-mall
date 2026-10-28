import assert from 'node:assert/strict'
import {createPinia,setActivePinia} from 'pinia'
import {benefitsFixture} from './benefits-fixture'
import {installCatalogTestLocks} from './catalog-storage-test-env'
import {benefitCandidates,applicableBenefitGroups,benefitNodeHosts} from '../src/domain/benefits/query'
import {addBenefitLine,benefitClone,benefitDataProblems,parseBenefitPrice,previewBenefitDeviceChange,reviewBenefitSelection,saveBenefitGroup,saveBenefitSelection} from '../src/domain/benefits/selection'
import {deviceHostKey} from '../src/domain/deviceResolution'
import {canPermission,ensureRbac,permissionRegistry} from '../src/domain/rbac'
import {normalizeStored,useCatalogStore} from '../src/stores/catalog'
import {DATA_VERSION,STORAGE_KEY} from '../src/domain/types'
import type {BenefitSelectionInput} from '../src/domain/benefits/types'
const f=benefitsFixture(),{data,modelId,versionId,hosts,now}=f,a={kind:'sku' as const,skuId:'phone-a'},b={kind:'sku' as const,skuId:'phone-b'}
const before=JSON.stringify(data)
assert.deepEqual(benefitCandidates(data,a).candidates.map(c=>c.sku.id).sort(),['case-sku','charger-sku','film-sku'])
assert.deepEqual(benefitCandidates(data,b).candidates.map(c=>c.sku.id).sort(),['cable-sku','case-sku'])
assert.equal(JSON.stringify(data),before)
assert.equal(addBenefitLine(data,a,[],'mat-only').ok,false)
assert.equal(addBenefitLine(data,a,[],'copy-sku').ok,false)
assert.equal(benefitNodeHosts(data,modelId,'demo-A',versionId)[0]!.key,deviceHostKey(hosts.a))
assert.equal(benefitNodeHosts(data,modelId,'missing',versionId).length,0)
const group={id:'',name:'演示旅行权益包',scope:{modelId},productTypeIds:['type-case','type-charger'],enabled:true,sort:1}
assert(saveBenefitGroup(data,group,0,()=> 'g-model',now).ok)
assert(saveBenefitGroup(data,{...group,name:'B 专属',scope:{modelId,hostKey:deviceHostKey(hosts.b)}},0,()=> 'g-b',now).ok)
assert.equal(applicableBenefitGroups(data.benefitGroups!,benefitCandidates(data,a)).length,1)
assert.equal(applicableBenefitGroups(data.benefitGroups!,benefitCandidates(data,b)).length,2)
const extra=benefitClone(data.skus.find(s=>s.id==='case-sku')!);extra.id='dynamic';data.skus.push(extra);data.compatibilities.push(f.link('dynamic-link',extra.id,'a'))
assert(benefitCandidates(data,a).candidates.some(c=>c.sku.id==='dynamic'))
const draft:BenefitSelectionInput={id:'',device:a,status:'draft',lines:[{skuId:'film-sku',quantity:2,unitPriceCents:1234},{skuId:'case-sku',quantity:1,unitPriceCents:0},{skuId:'phone-a',quantity:1,unitPriceCents:null}]}
assert.equal(parseBenefitPrice('0'),0);assert.equal(parseBenefitPrice('12.34'),1234);assert.equal(parseBenefitPrice(''),null);assert.equal(parseBenefitPrice('0.001'),undefined)
assert.equal(addBenefitLine(data,a,draft.lines,'case-sku').lines.find(l=>l.skuId==='case-sku')!.quantity,2)
const unchanged=JSON.stringify(draft),impact=previewBenefitDeviceChange(data,a,b,draft.lines)
assert.deepEqual(impact.keep.map(l=>l.skuId),['case-sku']);assert.equal(impact.remove.length,2);assert.equal(JSON.stringify(draft),unchanged)
assert.equal(saveBenefitSelection(data,{...draft,status:'confirmed'},0,()=> 'sel',now).ok,false)
draft.lines[2]!.unitPriceCents=100
const saved=saveBenefitSelection(data,{...draft,status:'confirmed'},0,()=> 'sel',now);assert(saved.ok);const frozen=JSON.stringify(saved.record!.snapshot)
data.skus.find(s=>s.id==='film-sku')!.status='off_sale';data.compatibilities=data.compatibilities.filter(l=>l.id!=='demo-a')
assert.equal(JSON.stringify(saved.record!.snapshot),frozen);assert.equal(saveBenefitSelection(data,{...draft,id:'sel',status:'draft'},1,()=>'',now).ok,false)
assert(reviewBenefitSelection(data,draft).issues.some(i=>i.skuId==='film-sku'));assert.equal(addBenefitLine(data,a,draft.lines,'film-sku').ok,false)
assert.deepEqual(benefitDataProblems(data),[])
assert(!canPermission(data,'demo-sales-user','product:benefit-group:create'));assert(canPermission(data,'demo-sales-user','product:benefit-selection:create'));assert(!canPermission(data,'demo-sales-user','product:compatibility:update'));assert(!canPermission(data,'demo-sales-user','product:benefit:update'))
const old=benefitClone(data);old.rbac!.permissions=old.rbac!.permissions.filter(p=>!p.resource.startsWith('benefit-'));const custom=benefitClone(old.rbac!.roles.find(r=>r.id==='demo-sales')!);ensureRbac(old);assert.deepEqual(old.rbac!.roles.find(r=>r.id==='demo-sales'),custom);assert.equal(old.rbac!.permissions.length,permissionRegistry().length)
const fresh=benefitsFixture().data;delete fresh.benefitGroups;delete fresh.benefitSelections;normalizeStored({version:DATA_VERSION,data:fresh});assert.equal(fresh.benefitGroups,undefined)
const disk=new Map([[STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data:fresh})]]),restore=installCatalogTestLocks();let fail=false
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>disk.get(k)||null,setItem:(k:string,v:string)=>{if(fail)throw new Error('isolated quota');disk.set(k,v)}}})
setActivePinia(createPinia());const store=useCatalogStore();await store.waitForPersistence();const raw=disk.get(STORAGE_KEY);fail=true
const result=await store.saveBenefitSelection({id:'',device:a,lines:[{skuId:'case-sku',quantity:1,unitPriceCents:0}],status:'draft'},0);assert.equal(result.ok,false);assert.equal(disk.get(STORAGE_KEY),raw);assert.equal(store.data.benefitSelections,undefined)
fail=false;assert((await store.saveBenefitSelection({id:'',device:a,lines:[{skuId:'case-sku',quantity:1,unitPriceCents:0}],status:'draft'},0)).ok)
store.$dispose();restore();Reflect.deleteProperty(globalThis,'localStorage')
console.log('PASS focused benefits domain: A/B identity, conservative admission, independent dynamic groups, prices/change preview/frozen history, strict permissions, atomic failure/retry; no ordinary-load records')
