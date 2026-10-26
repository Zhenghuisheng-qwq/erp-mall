import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { effectScope } from 'vue'
import { installCatalogTestLocks } from './catalog-storage-test-env'
import { createSalesConfigurationFixture, salesTestItem } from './sales-configuration-fixtures'
import { useSalesShoppingDraft } from '../src/components/sales-shopping/useSalesShoppingDraft'
import { useCatalogStore } from '../src/stores/catalog'
import { addSalesCandidate, attachSalesSource, querySalesCandidates, removeSalesPosition, salesDirectCompatibility } from '../src/domain/salesSelection'
import { addBenefitSku, benefitSkuSummary, cloneBenefit, confirmBenefitCondition, newBenefitPackageDraft, previewBenefitDelivery, reviewBenefitQuote, validateBenefitPackage } from '../src/domain/benefitPackages'
import { DATA_VERSION, STORAGE_KEY, type AppData } from '../src/domain/types'
import type { BenefitPackageDraft } from '../src/domain/benefitPackageTypes'
import { RBAC_ENFORCEMENT_ENABLED } from '../src/domain/accessMode'

installCatalogTestLocks()
const disk=new Map<string,string>(),session=new Map<string,string>()
let fail=false,writes=0,groups=0,sequence=0
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>disk.get(key)??null,setItem:(key:string,value:string)=>{if(key===STORAGE_KEY){if(fail)throw Error('sales repair quota');writes++}disk.set(key,value)},removeItem:(key:string)=>disk.delete(key)}})
Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:(key:string)=>session.get(key)??null,setItem:(key:string,value:string)=>session.set(key,value),removeItem:(key:string)=>session.delete(key)}})
const key=()=>`sales-repair-${++sequence}`
const mark=(name:string)=>{groups++;console.log(`PASS sales repair Store: ${name}`)}
async function mount(data?:AppData){if(data){disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data}));session.clear();session.set('iyge-rbac-simulated-user','u-admin')}setActivePinia(createPinia());const store=useCatalogStore();await store.waitForPersistence();return store}
function base(data:AppData){let draft=newBenefitPackageDraft({kind:'sku',skuId:'phone-a'});draft.name='完整销售修复测试';draft=addBenefitSku(data,draft,'phone-a',1,{role:'host',groupId:null});return attachSalesSource(data,draft,'phone-a',draft.goods[0]!.id)}
function add(data:AppData,draft:BenefitPackageDraft,source:string,sku:string,sourcePositionId:string,itemId?:string){return addSalesCandidate(data,draft,querySalesCandidates(data,draft,source,undefined,sourcePositionId).rows.find(row=>row.skuId===sku&&(!itemId||row.item.id===itemId))!,{sourcePositionId})}

{
  const fixture=createSalesConfigurationFixture();let store=await mount(fixture.data)
  let scope=effectScope(),sale=scope.run(()=>useSalesShoppingDraft())!
  assert(sale.change(()=>{let draft=base(store.data);draft=add(store.data,draft,'phone-a','case-sku',draft.goods[0]!.id);return add(store.data,draft,'case-sku','film-sku',draft.goods.find(line=>line.skuId==='case-sku')!.id)}))
  assert(await sale.flush());const id=sale.draft.value.id,source=sale.draft.value.goods.find(line=>line.skuId==='case-sku')!.id,film=sale.draft.value.goods.find(line=>line.skuId==='film-sku')!.id
  assert(sale.change(current=>removeSalesPosition(current,source)));assert(await sale.flush(),sale.error.value)
  assert(sale.validation.value.canSaveDraft);assert(!sale.validation.value.canSaveAvailable);assert(!sale.validation.value.canDeliver)
  assert.equal(await sale.prepareDelivery(),false);assert.equal(store.data.benefitDeliveries?.length,0)
  assert(sale.draft.value.sales!.contexts.some(context=>context.sourcePositionId===source));assert(!sale.draft.value.goods.some(line=>line.id===source))
  const pendingImport=cloneBenefit(store.data);pendingImport.benefitPackages!.find(record=>record.id===id)!.name+='导入核对';await store.importJson(JSON.stringify({version:DATA_VERSION,data:pendingImport}));assert(store.data.benefitPackages!.find(record=>record.id===id)!.sales!.contexts.some(context=>context.sourcePositionId===source))
  scope.stop();store.$dispose();store=await mount();scope=effectScope();sale=scope.run(()=>useSalesShoppingDraft())!;sale.loadInitial(id!)
  assert.equal(sale.draft.value.goods.find(line=>line.id===film)?.skuId,'film-sku');assert(sale.draft.value.sales!.contexts.some(context=>context.sourcePositionId===source))
  assert(sale.validation.value.issues.some(issue=>issue.positionId===film&&/来源商品已移除/.test(issue.message)))
  assert(sale.change(current=>removeSalesPosition(current,film)));sale.clearInputError();assert(await sale.flush())
  assert(!sale.draft.value.sales!.contexts.some(context=>context.sourcePositionId===source));assert(sale.validation.value.canDeliver)
  scope.stop();store.$dispose();mark('saved phone → case → film removal auto-saves pending draft, reload retains source, delivery blocks, downstream removal recovers')
}
{
  const fixture=createSalesConfigurationFixture(),second=salesTestItem('second-case');fixture.phonePlan.items.push(second);fixture.phonePlan.versions[0]!.items.push(cloneBenefit(second))
  const store=await mount(fixture.data),scope=effectScope(),sale=scope.run(()=>useSalesShoppingDraft())!
  assert(sale.change(()=>{let draft=base(store.data);for(const item of ['case-choice','second-case'])draft=add(store.data,draft,'phone-a','case-sku',draft.goods[0]!.id,item);for(const source of draft.goods.filter(line=>line.skuId==='case-sku'))draft=add(store.data,draft,'case-sku','film-sku',source.id);return draft}))
  assert(await sale.flush());const sources=sale.draft.value.goods.filter(line=>line.skuId==='case-sku'),a=sources[0]!.id,b=sources[1]!.id
  const affected=sale.draft.value.sales!.origins.find(origin=>origin.sourcePositionId===a)!.positionId,untouched=sale.draft.value.sales!.origins.find(origin=>origin.sourcePositionId===b)!.positionId
  const raw=disk.get(STORAGE_KEY);fail=true;assert(sale.change(current=>removeSalesPosition(current,a)));assert.equal(await sale.flush(),false);assert.equal(disk.get(STORAGE_KEY),raw)
  assert(sale.change(current=>{current.goods.find(line=>line.id===affected)!.quantity=2;return current}));fail=false;assert(await sale.retry())
  assert(!sale.draft.value.goods.some(line=>line.id===a));assert(sale.draft.value.goods.some(line=>line.id===b));assert.equal(sale.draft.value.goods.find(line=>line.id===affected)!.quantity,2)
  const pending=sale.validation.value.issues.filter(issue=>/来源商品已移除/.test(issue.message));assert.deepEqual(pending.map(issue=>issue.positionId),[affected]);assert(!pending.some(issue=>issue.positionId===untouched))
  const tampered=cloneBenefit(sale.draft.value);tampered.sales!.contexts=tampered.sales!.contexts.filter(context=>context.sourcePositionId!==a)
  const before=disk.get(STORAGE_KEY);assert.equal((await store.saveBenefitPackage({draft:tampered,status:'draft',expectedRevision:tampered.revision,requestId:key()})).ok,false);assert.equal(disk.get(STORAGE_KEY),before)
  assert(sale.change(current=>removeSalesPosition(current,affected)));assert(await sale.flush());assert(sale.validation.value.canDeliver)
  scope.stop();store.$dispose();mark('same SKU source positions stay isolated; quota retry keeps latest pending composition without resurrecting removed source; context tampering remains rejected')
}
{
  const fixture=createSalesConfigurationFixture();fixture.data.salesOptionBindings=fixture.data.salesOptionBindings!.filter(binding=>binding.id!==fixture.caseBinding.id)
  fixture.data.params.push({id:'probe-fit',name:'贴合条件',values:['yes','no'],valueGroups:[],participateInStructure:false})
  fixture.data.salesProductRelations=[{schemaVersion:1,id:'direct-fit',revision:1,enabled:true,sourceSkuId:'case-sku',targetSkuId:'film-sku',kind:'applicability',conclusion:'conditional',verification:'confirmed',conditions:[{kind:'attribute',attributeId:'probe-fit',operator:'eq',value:'yes'}],source:'独立测试直接适用',note:'',updatedAt:fixture.now}]
  const store=await mount(fixture.data),dictionary=JSON.stringify(store.data.params)
  let draft=base(store.data);draft=add(store.data,draft,'phone-a','case-sku',draft.goods[0]!.id);draft=add(store.data,draft,'case-sku','film-sku',draft.goods.find(line=>line.skuId==='case-sku')!.id)
  const film=draft.goods.find(line=>line.skuId==='film-sku')!.id
  draft=confirmBenefitCondition(store.data,draft,film,'真实缺失信息人工核实',fixture.now);draft.quote.amountCents=129900;draft=reviewBenefitQuote(draft,store.data)
  const saved=await store.saveBenefitPackage({draft,status:'available',requestId:key()});assert(saved.ok&&saved.package,saved.message);draft=cloneBenefit(saved.package)
  const previousPreview=previewBenefitDelivery(store.data,saved.package,1);assert(previousPreview.canConfirm)
  store.data.skus.find(sku=>sku.id==='case-sku')!.manualAttrs=[{attributeId:'probe-fit',attributeName:'贴合条件',value:'no',source:'manual'}];await store.waitForPersistence()
  assert.equal(salesDirectCompatibility(store.data,'case-sku','film-sku').basicStatus,'incompatible');assert.throws(()=>confirmBenefitCondition(store.data,draft,film,'不能覆盖已知不满足',fixture.now),/不适用不能人工升级/)
  const raw=disk.get(STORAGE_KEY),receipts=JSON.stringify(store.data.benefitPackages)
  assert.equal((await store.saveBenefitPackage({draft,status:'available',expectedRevision:draft.revision,requestId:key()})).ok,false)
  assert.equal((await store.generateBenefitDelivery({packageId:draft.id!,expectedRevision:draft.revision,requestId:key(),packageCount:1,expectedBasis:previousPreview.basis})).ok,false)
  assert.equal(disk.get(STORAGE_KEY),raw);assert.equal(JSON.stringify(store.data.benefitPackages),receipts);assert.equal(store.data.benefitDeliveries?.length,0)
  assert.equal(previewBenefitDelivery(store.data,saved.package,1).canConfirm,false)
  store.data.skus.find(sku=>sku.id==='case-sku')!.manualAttrs![0]!.value='yes';await store.waitForPersistence()
  assert(validateBenefitPackage(store.data,draft).issues.some(issue=>issue.code==='condition-confirmation'&&issue.positionId===film),'attribute changes invalidate old confirmation')
  draft=confirmBenefitCondition(store.data,draft,film,'实际手工值已满足，重新核对',fixture.now);draft=reviewBenefitQuote(draft,store.data)
  const resaved=await store.saveBenefitPackage({draft,status:'available',expectedRevision:draft.revision,requestId:key()});assert(resaved.ok&&resaved.package,resaved.message)
  const preview=previewBenefitDelivery(store.data,resaved.package,1);assert(preview.canConfirm)
  const delivery=await store.generateBenefitDelivery({packageId:resaved.package.id,expectedRevision:resaved.package.revision,requestId:key(),packageCount:1,expectedBasis:preview.basis});assert(delivery.ok&&delivery.delivery,delivery.message)
  assert.equal(JSON.stringify(store.data.params),dictionary);store.$dispose();mark('manual known unmet blocks confirmation, current preview, Store availability and delivery atomically; changed source invalidates old confirmation; actual met can re-confirm')
}
{
  const fixture=createSalesConfigurationFixture();fixture.phonePlan.items[0]!.required=true;fixture.phonePlan.items[0]!.minKinds=1;fixture.phonePlan.versions[0]!.items=cloneBenefit(fixture.phonePlan.items)
  const store=await mount(fixture.data);let draft=base(store.data),host=draft.goods[0]!.id
  for(const candidate of querySalesCandidates(store.data,draft,'phone-a',undefined,host).rows.filter(row=>row.skuId==='case-sku'||row.item.scope.kind==='service'))draft=addSalesCandidate(store.data,draft,candidate,{sourcePositionId:host})
  draft.quote.amountCents=89000;draft=reviewBenefitQuote(draft,store.data);const saved=await store.saveBenefitPackage({draft,status:'available',requestId:key()});assert(saved.ok&&saved.package,saved.message);draft=cloneBenefit(saved.package)
  const good=draft.goods.find(line=>line.skuId==='case-sku')!,service=draft.services[0]!,raw=disk.get(STORAGE_KEY),beforeWrites=writes
  const changes:((value:BenefitPackageDraft)=>void)[]=[
    value=>{value.goods=value.goods.filter(line=>line.id!==good.id);value.services.push({...cloneBenefit(service),id:good.id})},
    value=>{value.services=[];value.goods.push({...cloneBenefit(good),id:service.id,groupId:null})},
    value=>{value.services[0]!.id=good.id},
    value=>{const line=value.goods.find(line=>line.id===good.id)!;line.skuId='film-sku';line.snapshot=benefitSkuSummary(store.data,'film-sku')!},
    value=>{const line=value.goods.find(line=>line.id===good.id)!;line.skuId='film-sku';line.snapshot.skuId='film-sku'},
    value=>{value.sales!.origins.push(cloneBenefit(value.sales!.origins[0]!))},
    value=>{value.goods=value.goods.filter(line=>line.id!==good.id);value.services.push({...cloneBenefit(service),id:good.id});const lawful=value.sales!.origins.find(origin=>origin.positionId===service.id)!;value.sales!.origins=value.sales!.origins.map(origin=>origin.positionId===good.id?{...cloneBenefit(lawful),positionId:good.id}:origin)},
  ]
  for(const change of changes){
    const forged=cloneBenefit(draft);change(forged);const validation=validateBenefitPackage(store.data,forged)
    assert(!validation.canSaveDraft);assert(!validation.canSaveAvailable);assert(!validation.canDeliver);assert(!previewBenefitDelivery(store.data,{...forged,status:'available'} as typeof saved.package,1).canConfirm)
    for(const status of ['draft','available'] as const)assert.equal((await store.saveBenefitPackage({draft:forged,status,expectedRevision:forged.revision,requestId:key()})).ok,false)
    const incoming=cloneBenefit(store.data);incoming.benefitPackages=incoming.benefitPackages!.map(record=>record.id===forged.id?forged as typeof record:record)
    await assert.rejects(async()=>store.importJson(JSON.stringify({version:DATA_VERSION,data:incoming})),/身份|位置|服务|候选范围/)
    assert.equal(disk.get(STORAGE_KEY),raw);assert.equal(writes,beforeWrites);assert.equal(store.data.benefitDeliveries?.length,0)
  }
  const preview=previewBenefitDelivery(store.data,saved.package,1);assert(preview.canConfirm)
  assert((await store.generateBenefitDelivery({packageId:saved.package.id,expectedRevision:saved.package.revision,requestId:key(),packageCount:1,expectedBasis:preview.basis})).ok)
  store.$dispose();mark('goods↔service forgery, cross-container ID, out-of-range snapshot and duplicate origin all reject direct Store and import with zero writes; lawful goods plus service deliver')
}
{
  const fixture=createSalesConfigurationFixture();let store=await mount(fixture.data),draft=base(store.data)
  draft=add(store.data,draft,'phone-a','case-sku',draft.goods[0]!.id)
  const saved=await store.saveBenefitPackage({draft,status:'draft',requestId:key()});assert(saved.ok&&saved.package,saved.message);draft=cloneBenefit(saved.package)
  const familyId=store.data.skus.find(sku=>sku.id==='case-sku')!.familyId
  store.data.families.find(family=>family.id===familyId)!.productTypeId='type-film';await store.waitForPersistence()
  const validation=validateBenefitPackage(store.data,draft);assert(validation.canSaveDraft);assert(!validation.canSaveAvailable)
  const retained=await store.saveBenefitPackage({draft,status:'draft',expectedRevision:draft.revision,requestId:key()});assert(retained.ok&&retained.package,retained.message)
  const id=retained.package.id;assert.equal(retained.package.goods.find(line=>line.skuId==='case-sku')!.snapshot.productTypeId,'type-film')
  store.$dispose();store=await mount();draft=cloneBenefit(store.data.benefitPackages!.find(record=>record.id===id)!)
  assert(validateBenefitPackage(store.data,draft).canSaveDraft);assert(!validateBenefitPackage(store.data,draft).canDeliver)
  const secondSave=await store.saveBenefitPackage({draft,status:'draft',expectedRevision:draft.revision,requestId:key()});assert(secondSave.ok,secondSave.message)
  const restore=cloneBenefit(store.data);restore.benefitPackages!.find(record=>record.id===id)!.name+='待处理目录变化';await store.importJson(JSON.stringify({version:DATA_VERSION,data:restore}))
  const outsider=cloneBenefit(store.data.benefitPackages!.find(record=>record.id===id)!);outsider.id='new-outside-import';outsider.code='NEW-OUTSIDE';outsider.revision=1
  delete outsider.creationIntent;delete outsider.creationRequestId;delete outsider.saveReceipt;delete outsider.saveReceipts
  const incoming=cloneBenefit(store.data);incoming.benefitPackages!.push(outsider)
  const raw=disk.get(STORAGE_KEY);await assert.rejects(async()=>store.importJson(JSON.stringify({version:DATA_VERSION,data:incoming})),/候选范围/);assert.equal(disk.get(STORAGE_KEY),raw)
  store.$dispose();mark('catalog drift preserves unchanged saved positions as reloadable pending drafts; new imported outside-range positions remain rejected')
}
console.log(`PASS sales selection repair Store ${groups} groups (${RBAC_ENFORCEMENT_ENABLED?'strict':'default'})`)
