import assert from 'node:assert/strict'
import {createPinia,setActivePinia} from 'pinia'
import {benefitsFixture} from './benefits-fixture'
import {installCatalogTestLocks} from './catalog-storage-test-env'
import {benefitCandidates,applicableBenefitGroups,benefitNodeHosts,benefitGroupCandidates,benefitPreviewDevices,benefitAccessoryReason,benefitRangeAvailability} from '../src/domain/benefits/query'
import {addBenefitLine,benefitClone,benefitDataProblems,parseBenefitPrice,previewBenefitDeviceChange,reviewBenefitSelection,saveBenefitGroup,saveBenefitSelection} from '../src/domain/benefits/selection'
import {deviceHostKey,listDeviceModels,resolveDeviceSku} from '../src/domain/deviceResolution'
import {canPermission,ensureRbac,permissionRegistry} from '../src/domain/rbac'
import {normalizeStored,useCatalogStore} from '../src/stores/catalog'
import {DATA_VERSION,STORAGE_KEY} from '../src/domain/types'
import {benefitGroupProblems,benefitCategoryImpact,benefitSnapshotHosts,resolveBenefitRange,compactBenefitRanges,benefitSourceContext,benefitGroupRelated} from '../src/domain/benefits/scope'
import {createSeed} from '../src/domain/seed'
import type {BenefitHostRange,BenefitGroup,BenefitSelectionInput} from '../src/domain/benefits/types'
const f=benefitsFixture(),{data,modelId,versionId,hosts,now}=f,a={kind:'sku' as const,skuId:'phone-a'},b={kind:'sku' as const,skuId:'phone-b'}
const before=JSON.stringify(data)
assert.deepEqual(benefitCandidates(data,a).candidates.map(c=>c.sku.id).sort(),['case-a-sku','case-sku','charger-sku','film-sku'])
assert.deepEqual(benefitCandidates(data,b).candidates.map(c=>c.sku.id).sort(),['cable-sku','case-sku'])
assert.equal(JSON.stringify(data),before)
assert.equal(addBenefitLine(data,a,[],'mat-only').ok,false)
assert.equal(addBenefitLine(data,a,[],'copy-sku').ok,false)
assert.equal(benefitNodeHosts(data,modelId,'demo-A',versionId)[0]!.key,deviceHostKey(hosts.a))
assert.equal(benefitNodeHosts(data,modelId,'missing',versionId).length,0)
const group={id:'',name:'演示旅行权益包',categoryId:'cat-accessory-test',hostRanges:[{kind:'snapshot',modelId,versionId}] as BenefitHostRange[],productTypeIds:['type-case','type-film'],enabled:true,sort:1}
assert(saveBenefitGroup(data,group,0,()=> 'g-model',now).ok)
assert(saveBenefitGroup(data,{...group,name:'B 专属',productTypeIds:['type-case'],hostRanges:[{kind:'snapshot',modelId,versionId,nodeId:'demo-brand-B'}]},0,()=> 'g-b',now).ok)
assert.equal(applicableBenefitGroups(data,benefitCandidates(data,a)).length,1)
assert.equal(applicableBenefitGroups(data,benefitCandidates(data,b)).length,2)
// A temporarily empty type must not suppress the other types in a saved group.
const saleChange=benefitClone(data),saleGroup=saleChange.benefitGroups!.find(g=>g.id==='g-model')!
const savedGroups=JSON.stringify(saleChange.benefitGroups)
const filmFamilies=new Set(saleChange.families.filter(f=>f.productTypeId==='type-film').map(f=>f.id))
for(const sku of saleChange.skus)if(filmFamilies.has(sku.familyId))sku.status='off_sale'
const remaining=benefitCandidates(saleChange,a)
assert(applicableBenefitGroups(saleChange,remaining).some(g=>g.id===saleGroup.id))
assert.deepEqual(benefitGroupCandidates(saleChange,saleGroup,remaining).map(c=>c.sku.id).sort(),['case-a-sku','case-sku'])
assert.match(benefitRangeAvailability(saleChange,saleGroup.categoryId!,saleGroup.hostRanges!).get('type-film')!.reason,/暂无可售商品/)
assert.equal(saveBenefitGroup(benefitClone(saleChange),{...group},0,()=> 'empty-type-new-group',now).ok,true)
for(const sku of saleChange.skus)if(['case-a-sku','case-sku'].includes(sku.id))sku.status='off_sale'
assert.deepEqual(benefitGroupCandidates(saleChange,saleGroup,benefitCandidates(saleChange,a)),[])
assert(!applicableBenefitGroups(saleChange,benefitCandidates(saleChange,a)).some(g=>g.id===saleGroup.id))
// Candidates for another covered device must not make an empty package appear on A.
saleChange.skus.push({...benefitClone(saleChange.skus.find(s=>s.id==='case-sku')!),id:'b-only-case',status:'on_sale'})
saleChange.compatibilities.push(f.link('b-only-case-link','b-only-case','b'))
assert(applicableBenefitGroups(saleChange,benefitCandidates(saleChange,b)).some(g=>g.id===saleGroup.id))
assert(!applicableBenefitGroups(saleChange,benefitCandidates(saleChange,a)).some(g=>g.id===saleGroup.id))
assert.equal(JSON.stringify(saleChange.benefitGroups),savedGroups)

// A VARIANT ancestor can still identify an exact host, just as in deviceResolution.
const variantData=benefitClone(data)
variantData.specModelVersions.find(v=>v.id===versionId)!.nodesSnapshot.find(n=>n.id==='demo-brand')!.role='VARIANT'
const variantHosts=benefitSnapshotHosts(variantData,modelId,versionId)
assert.equal(variantHosts.issue,'')
assert.deepEqual(variantHosts.entries.map(e=>e.key).sort(),listDeviceModels(variantData).filter(o=>o.versionIds.includes(versionId)).map(o=>o.key).sort())
const variantDevice=resolveDeviceSku(variantData,a.skuId)
assert.equal(variantDevice.status,'resolved')
assert(variantHosts.entries.some(e=>e.key===deviceHostKey(variantDevice.host!)))
assert(applicableBenefitGroups(variantData,benefitCandidates(variantData,a)).some(g=>g.id==='g-model'))
const ambiguousSku=variantData.skus.find(s=>s.id===a.skuId)!
ambiguousSku.sourceNodeIds=[]
delete ambiguousSku.variantAttrs['品牌']
delete ambiguousSku.variantAttrs['测试设备型号']
assert.equal(resolveDeviceSku(variantData,a.skuId).status,'ambiguous')
assert.deepEqual(applicableBenefitGroups(variantData,benefitCandidates(variantData,a)),[])
// Category ownership is independent from host category. Snapshot branches do not expand with a new release.
assert.equal(saveBenefitGroup(data,{...group,productTypeIds:['type-charger']},0,()=> 'bad',now).ok,false)
assert.deepEqual(benefitCategoryImpact(data,'cat-charge',group.productTypeIds),{keep:[],remove:group.productTypeIds})
const bGroup=data.benefitGroups!.find(g=>g.id==='g-b')!
assert.deepEqual(benefitPreviewDevices(data,bGroup).devices.map(d=>d.id),['phone-b'])
assert.deepEqual(benefitGroupCandidates(data,bGroup,benefitCandidates(data,a)),[])
assert.deepEqual(benefitGroupCandidates(data,bGroup,benefitCandidates(data,b)).map(m=>m.sku.id),['case-sku'])
assert.equal(compactBenefitRanges(data,[{kind:'type',productTypeId:'type-device'},...group.hostRanges]).length,1)
assert(resolveBenefitRange(data,{kind:'snapshot',modelId,versionId,nodeId:'demo-brand'}).issue)
assert(resolveBenefitRange(data,{kind:'snapshot',modelId,versionId:'missing'}).issue)
const nextVersion=benefitClone(data.specModelVersions[0]!);nextVersion.id='demo-v2';nextVersion.version=2
nextVersion.nodesSnapshot.push({id:'demo-C',templateId:modelId,parentId:'demo-model-A',nodeType:'VALUE',attributeId:'attr-device-model',valueId:'Orion C',sort:2})
data.specModelVersions.push(nextVersion)
assert.equal(resolveBenefitRange(data,group.hostRanges[0]!).keys.length,2)
assert.equal(resolveBenefitRange(data,{kind:'type',productTypeId:'type-device'}).keys.length,3)
assert(applicableBenefitGroups(data,benefitCandidates(data,{kind:'model',hostKey:deviceHostKey(hosts.a)})).some(g=>g.id==='g-model'))
const legacy:BenefitGroup={id:'legacy',name:'原轻量包',scope:{modelId,hostKey:deviceHostKey(hosts.a)},productTypeIds:['type-case'],enabled:true,sort:0,revision:1,createdAt:now,updatedAt:now}
data.benefitGroups!.push(legacy)
assert.deepEqual(benefitDataProblems(data),[])
assert(benefitGroupProblems(data,legacy).some(m=>m.includes('待补充')))
assert(!applicableBenefitGroups(data,benefitCandidates(data,a)).some(g=>g.id==='legacy'))
assert(saveBenefitGroup(data,{...legacy,enabled:false},1,()=>'',now).ok)
assert(saveBenefitGroup(data,{...legacy,categoryId:'cat-accessory-test',hostRanges:[{kind:'host',hostKey:deviceHostKey(hosts.a)}]},2,()=>'',now).ok)
const stale=benefitClone(data);stale.productTypes.find(t=>t.id==='type-case')!.categoryId='cat-charge'
assert(benefitGroupProblems(stale,stale.benefitGroups![0]!).some(m=>m.includes('超出')))
assert(!applicableBenefitGroups(stale,benefitCandidates(stale,a)).length)
assert.match(benefitAccessoryReason(data,benefitCandidates(data,a),'pending-sku'),/待确认/)
assert.match(benefitAccessoryReason(data,benefitCandidates(data,a),'off-sale-sku'),/不在售/)
assert.match(benefitAccessoryReason(data,benefitCandidates(data,a),'copy-sku'),/条件待核验/)
const seed=createSeed(),seedContext=benefitCandidates(seed,{kind:'sku',skuId:'s-iphone-blue'})
assert(seedContext.candidates.some(c=>c.sku.id==='s-case-clear'))
assert.equal(applicableBenefitGroups(seed,seedContext).length,1)
const seedBefore=JSON.stringify(seed);benefitPreviewDevices(seed,seed.benefitGroups![0]!);assert.equal(JSON.stringify(seed),seedBefore)
const availabilityB=benefitRangeAvailability(data,'cat-accessory-test',[{kind:'snapshot',modelId,versionId,nodeId:'demo-brand-B'}])
assert.equal(availabilityB.get('type-film')!.candidates.length,0)
assert(availabilityB.get('type-film')!.reason)
assert.deepEqual(availabilityB.get('type-case')!.candidates.map(s=>s.id),['case-sku'])
assert.deepEqual(benefitCategoryImpact(data,'cat-accessory-test',['type-case','type-film']).remove,[])
assert.equal(saveBenefitGroup(benefitClone(data),{...group,hostRanges:[{kind:'snapshot',modelId,versionId,nodeId:'demo-brand-B'}]},0,()=> 'no-candidates',now).ok,true)
assert(benefitRangeAvailability(data,'cat-accessory-test',[]).get('type-case')!.reason.includes('请选择适用主机范围'))

// Configure a legitimate type before its products exist; later goods appear without editing the group.
const future=benefitClone(data)
future.productTypes.push({...benefitClone(future.productTypes.find(t=>t.id==='type-film')!),id:'type-future',name:'稍后建档钢化膜'})
assert(saveBenefitGroup(future,{...group,productTypeIds:['type-case','type-future']},0,()=> 'future',now).ok)
const futureGroup=future.benefitGroups!.find(g=>g.id==='future')!,futureBefore=JSON.stringify(futureGroup)
assert.match(benefitRangeAvailability(future,group.categoryId,group.hostRanges).get('type-future')!.reason,/暂无商品建档/)
const film=benefitClone(future.skus.find(s=>s.id==='film-sku')!)
future.families.push({...benefitClone(future.families.find(f=>f.id===film.familyId)!),id:'future-family',productTypeId:'type-future'})
future.skus.push({...film,id:'future-sku',familyId:'future-family'})
future.compatibilities.push(f.link('future-link','future-sku','a'))
assert(benefitGroupCandidates(future,futureGroup,benefitCandidates(future,a)).some(c=>c.sku.id==='future-sku'))
assert(!benefitGroupCandidates(future,futureGroup,benefitCandidates(future,b)).some(c=>c.sku.id==='future-sku'))
assert.equal(JSON.stringify(futureGroup),futureBefore)
future.productTypes.find(t=>t.id==='type-future')!.status='disabled'
assert(!saveBenefitGroup(future,{...group,productTypeIds:['type-future']},0,()=> 'disabled',now).ok)
assert(!saveBenefitGroup(future,{...group,productTypeIds:['missing']},0,()=> 'missing',now).ok)
assert(!saveBenefitGroup(future,{...group,productTypeIds:['type-device']},0,()=> 'wrong-role',now).ok)
// Source relevance uses range intersection, independently of candidate counts and enabled state.
const source=benefitSourceContext(data,{modelId,versionId,nodeId:'demo-A'})
assert.equal(source.issue,'')
for(const range of [{kind:'type',productTypeId:'type-device'},{kind:'snapshot',modelId,versionId},{kind:'snapshot',modelId,versionId,nodeId:'demo-brand-A'},{kind:'host',hostKey:deviceHostKey(hosts.a)}] as BenefitHostRange[]){
 assert(benefitGroupRelated(data,{...data.benefitGroups![0]!,enabled:false,productTypeIds:['type-future'],hostRanges:[range]},source))
}
assert(!benefitGroupRelated(data,bGroup,source))
assert(benefitSourceContext(data,{modelId,nodeId:'demo-A'}).issue)
assert(benefitSourceContext(data,{modelId,versionId,nodeId:'missing'}).issue)
assert(benefitSourceContext(data,{modelId,versionId,nodeId:'demo-A',nodePending:true}).issue)

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
console.log('PASS focused benefits domain: category limits, pinned branch/type union, legacy completion, default demo, scoped preview; A/B identity, conservative admission, independent dynamic groups, prices/change preview/frozen history, strict permissions, atomic failure/retry; no ordinary-load records')
