import assert from 'node:assert/strict'
import { createSalesConfigurationFixture, salesTestItem, salesTestPlan } from './sales-configuration-fixtures'
import { bindingProblems, cloneSales, planProblems, previewSalesBinding, resolveSalesPlan, resolveSalesSource, salesBindingContext, salesConfigurationImportProblems } from '../src/domain/salesConfiguration'
import { addSalesCandidate, attachSalesSource, createSalesCandidateIndex, querySalesCandidates, removeSalesPosition, salesDirectCompatibility, setSalesDevice } from '../src/domain/salesSelection'
import { selectorForNode } from '../src/domain/templateCompatibility'
import { addBenefitSku, benefitPackageImportProblems, confirmBenefitCondition, copyBenefitPackageDraft, createBenefitDeliverySnapshot, newBenefitPackageDraft, previewBenefitDelivery, reviewBenefitQuote, validateBenefitPackage } from '../src/domain/benefitPackages'
import { supportedBenefitDelivery } from '../src/domain/benefitDeliveryPresentation'
import type { SalesOptionBinding, SalesProductRelation } from '../src/domain/salesConfigurationTypes'

let groups=0
function check(name:string,run:()=>void){run();groups++;console.log(`PASS sales domain: ${name}`)}
const business=(data:ReturnType<typeof createSalesConfigurationFixture>['data'])=>JSON.stringify([data.skus,data.families,data.specModelVersions,data.productSpecNodes,data.planningRecords,data.materialReceipts,data.compatibilities])
function draftFor(data:ReturnType<typeof createSalesConfigurationFixture>['data'],phone='phone-a'){
  let draft=newBenefitPackageDraft({kind:'sku',skuId:phone});draft.name='隔离测试销售方案'
  draft=addBenefitSku(data,draft,phone,1,{role:'host'});return attachSalesSource(data,draft,phone,draft.goods[0]!.id)
}
check('one published range covers sibling-product combinations, not the visible subtree',()=>{
  const f=createSalesConfigurationFixture(),before=business(f.data),preview=previewSalesBinding(f.data,f.phoneBinding)
  assert.equal(preview.legalCount,8);assert.equal(preview.skuCount,8);assert.equal(preview.canApply,true,preview.issues.join(';'))
  for(const id of f.phoneIds)assert.equal(resolveSalesPlan(f.data,id).plan?.planId,f.phonePlan.id)
  const selector=selectorForNode(salesBindingContext(f.data,f.modelId,f.versionId),'compat-style-0').selector!
  const binding:SalesOptionBinding={...f.phoneBinding,id:'range',mode:'replace',scope:{...f.phoneBinding.scope,kind:'model',modelId:f.modelId,versionId:f.versionId,selector,nodeId:'compat-style-0'},planId:f.casePlan.id}
  const selected=previewSalesBinding(f.data,binding);assert.equal(selected.legalCount,4);assert.equal(selected.skuCount,4);assert.equal(selected.canApply,true)
  assert.equal(business(f.data),before)
})
check('replacement is complete; identical versions dedupe, divergent versions conflict',()=>{
  const f=createSalesConfigurationFixture(),selector=selectorForNode(salesBindingContext(f.data,f.modelId,f.versionId),'compat-style-0').selector!
  const replacement:SalesOptionBinding={...f.phoneBinding,id:'replace',mode:'replace',scope:{kind:'model',modelId:f.modelId,versionId:f.versionId,selector},planId:f.casePlan.id}
  f.data.salesOptionBindings!.push(replacement,{...cloneSales(replacement),id:'duplicate'})
  let resolved=resolveSalesPlan(f.data,'phone-a');assert.equal(resolved.state,'matched');assert.deepEqual(resolved.plan!.items.map(item=>item.id),['film-choice'])
  f.data.salesOptionBindings!.push({...cloneSales(replacement),id:'conflict',planId:f.phonePlan.id})
  resolved=resolveSalesPlan(f.data,'phone-a');assert.equal(resolved.state,'conflict');assert.equal(previewSalesBinding(f.data,replacement).canApply,false)
})
check('none is an explicit display result and never clears compatibility restrictions',()=>{
  const f=createSalesConfigurationFixture();f.data.salesOptionBindings!.push({...f.caseBinding,id:'none',scope:{kind:'products',familyIds:[],skuIds:['phone-a']},mode:'none',planId:null,planVersion:null})
  assert.equal(resolveSalesPlan(f.data,'phone-a').state,'none');assert.equal(querySalesCandidates(f.data,draftFor(f.data),'phone-a').rows.length,0)
  assert.throws(()=>addBenefitSku(f.data,draftFor(f.data),'blocked-sku'),/不适用/)
})
check('draft ranges preview only; attribute scopes require explicit selectors; frozen node IDs matter',()=>{
  const f=createSalesConfigurationFixture(),draft={...f.phoneBinding,scope:{kind:'model' as const,modelId:f.modelId,versionId:null}}
  assert.equal(previewSalesBinding(f.data,draft).draftOnly,true);assert.equal(previewSalesBinding(f.data,draft).canApply,false)
  assert(bindingProblems(f.data,{...f.phoneBinding,mode:'replace',scope:{kind:'model',modelId:f.modelId,versionId:f.versionId,nodeId:'compat-style'}}).length)
  const selector=selectorForNode(salesBindingContext(f.data,f.modelId,f.versionId),'compat-style-0').selector!
  selector.anyOf[0]![0]!.valueNodeId='same-name-different-id'
  assert(bindingProblems(f.data,{...f.phoneBinding,mode:'replace',scope:{kind:'model',modelId:f.modelId,versionId:f.versionId,selector}}).length)
  f.data.productSpecNodes=[];assert.equal(resolveSalesSource(f.data,'phone-a').state,'resolved','published SKU never uses current draft tree')
  f.version.status='offline';assert.equal(resolveSalesPlan(f.data,'phone-a').state,'invalid')
})
check('explicit manual SKU does not inherit SPU model version; legacy exact-product bindings are explicit',()=>{
  const f=createSalesConfigurationFixture(),sku=f.data.skus.find(item=>item.id==='phone-a')!
  sku.creationSource={...sku.creationSource!,kind:'manual',modelVersionId:''};delete sku.modelVersionId;delete sku.sourceNodeIds
  assert.equal(resolveSalesSource(f.data,sku.id).state,'legacy');assert.equal(resolveSalesPlan(f.data,sku.id).state,'unconfigured')
  f.data.salesOptionBindings!.push({...f.caseBinding,id:'legacy-explicit',planId:f.phonePlan.id,scope:{kind:'products',familyIds:[],skuIds:[sku.id]}})
  assert.equal(resolveSalesPlan(f.data,sku.id).state,'matched')
})
check('phone → case → film preserves phone context and viewing never adds',()=>{
  const f=createSalesConfigurationFixture(),before=business(f.data);let draft=draftFor(f.data)
  const beforeView=cloneSales(draft),first=querySalesCandidates(f.data,draft,'phone-a');assert.deepEqual(draft,beforeView)
  const candidate=first.rows.find(row=>row.skuId==='case-sku')!;assert(candidate?.canAdd,candidate?.reason)
  draft=addSalesCandidate(f.data,draft,candidate,{sourcePositionId:draft.goods[0]!.id})
  const caseLine=draft.goods.find(line=>line.skuId==='case-sku')!,next=querySalesCandidates(f.data,draft,'case-sku')
  assert.equal(next.resolution.plan?.planId,f.casePlan.id);const film=next.rows.find(row=>row.skuId==='film-sku')!;assert(film.canAdd,film.reason)
  draft=addSalesCandidate(f.data,draft,film,{sourcePositionId:caseLine.id})
  assert.deepEqual(draft.device,{kind:'sku',skuId:'phone-a'});assert.equal(draft.goods.length,3);assert.equal(business(f.data),before)
  const removed=removeSalesPosition(draft,caseLine.id);assert(removed.goods.some(line=>line.skuId==='film-sku'));assert(validateBenefitPackage(f.data,removed).issues.some(issue=>/来源商品已移除/.test(issue.message)))
})
check('recommendation uses declared target; direct source checks require their own evidence and handle cycles',()=>{
  const f=createSalesConfigurationFixture();f.data.salesOptionBindings=f.data.salesOptionBindings!.filter(binding=>binding.id!==f.caseBinding.id)
  const relation:SalesProductRelation={schemaVersion:1,id:'recommend',revision:1,enabled:true,sourceSkuId:'case-sku',targetSkuId:'film-sku',kind:'recommendation',conclusion:'compatible',verification:'confirmed',conditions:[],source:'测试推荐',note:'',updatedAt:f.now}
  f.data.salesProductRelations=[relation,{...relation,id:'cycle',sourceSkuId:'film-sku',targetSkuId:'case-sku'}]
  const draft=draftFor(f.data),rows=querySalesCandidates(f.data,draft,'case-sku').rows
  assert.equal(rows.length,1);assert.equal(rows[0]!.item.checkTarget,'device');assert.notEqual(rows[0]!.status,'pending')
  assert.equal(salesDirectCompatibility(f.data,'case-sku','film-sku').basicStatus,'pending','recommendation cannot establish source applicability')
  relation.checkTarget='source';assert.equal(querySalesCandidates(f.data,draft,'case-sku').rows[0]!.status,'pending')
  relation.kind='applicability';relation.conditions=[{kind:'manual',text:'检查贴合方式'}];relation.conclusion='conditional'
  assert.equal(salesDirectCompatibility(f.data,'case-sku','film-sku').basicStatus,'conditional')
  relation.conclusion='incompatible';relation.conditions=[];assert.equal(querySalesCandidates(f.data,draft,'case-sku').rows[0]!.canAdd,false)
})
check('source conditional confirmations retain exact positions and invalidate when direct evidence changes',()=>{
  const f=createSalesConfigurationFixture();f.data.salesOptionBindings=f.data.salesOptionBindings!.filter(binding=>binding.id!==f.caseBinding.id)
  f.data.salesProductRelations=[{schemaVersion:1,id:'direct',revision:1,enabled:true,sourceSkuId:'case-sku',targetSkuId:'film-sku',kind:'applicability',conclusion:'conditional',verification:'confirmed',conditions:[{kind:'manual',text:'检查边缘贴合'}],source:'实际核验记录',note:'',updatedAt:f.now}]
  let draft=draftFor(f.data);const first=querySalesCandidates(f.data,draft,'phone-a').rows.find(row=>row.skuId==='case-sku')!
  draft=addSalesCandidate(f.data,draft,first,{sourcePositionId:draft.goods[0]!.id});const source=draft.goods.find(line=>line.skuId==='case-sku')!
  draft=addSalesCandidate(f.data,draft,querySalesCandidates(f.data,draft,'case-sku').rows[0]!,{sourcePositionId:source.id})
  const line=draft.goods.find(line=>line.skuId==='film-sku')!,validation=validateBenefitPackage(f.data,draft)
  assert(validation.issues.some(issue=>issue.code==='condition-confirmation'&&issue.positionId===line.id))
  draft=confirmBenefitCondition(f.data,draft,line.id,'已逐项核对',f.now);assert(!validateBenefitPackage(f.data,draft).issues.some(issue=>issue.code==='condition-confirmation'&&issue.positionId===line.id))
  const tampered=cloneSales(draft),origin=tampered.sales!.origins.find(origin=>origin.positionId===line.id)!;origin.checkTarget='none';origin.itemId='relation:none:film-sku'
  assert.equal(validateBenefitPackage(f.data,tampered).canDeliver,false,'direct-source evidence cannot be bypassed by rewriting the check target')
  f.data.salesProductRelations[0]!.note='依据变更';assert(validateBenefitPackage(f.data,draft).issues.some(issue=>issue.code==='condition-confirmation'&&issue.positionId===line.id))
})
check('same SKU in separate purpose positions, service and frozen sales delivery share the existing ledger',()=>{
  const f=createSalesConfigurationFixture();const duplicate=salesTestItem('second-case');f.phonePlan.items.push(duplicate);f.phonePlan.versions[0]!.items.push(cloneSales(duplicate))
  let draft=draftFor(f.data);const source=draft.goods[0]!.id,rows=querySalesCandidates(f.data,draft,'phone-a').rows
  for(const row of rows.filter(row=>row.skuId==='case-sku'||row.item.scope.kind==='service'))draft=addSalesCandidate(f.data,draft,row,{sourcePositionId:source})
  assert.equal(draft.goods.filter(line=>line.skuId==='case-sku').length,2);assert.equal(draft.services.length,1)
  assert.equal(validateBenefitPackage(f.data,draft).canDeliver,true,validateBenefitPackage(f.data,draft).issues.map(issue=>issue.message).join(';'))
  draft.id='sale';draft.code='SALE-1';draft.revision=1;draft.status='available';draft.createdAt=f.now;draft.updatedAt=f.now;draft.quote.amountCents=1200;draft=reviewBenefitQuote(draft,f.data)
  const preview=previewBenefitDelivery(f.data,draft,2);assert(preview.canConfirm,preview.issues.map(issue=>issue.message).join(';'))
  const delivery=createBenefitDeliverySnapshot(preview,{id:'delivery',code:'D-1',requestId:'r-1',generatedAt:f.now}),snapshot=JSON.stringify(delivery)
  const copy=copyBenefitPackageDraft(draft);assert(copy.sales!.origins.every(origin=>copy.goods.some(line=>line.id===origin.positionId)||copy.services.some(line=>line.id===origin.positionId)))
  assert(copy.sales!.origins.every(origin=>!origin.sourcePositionId||copy.goods.some(line=>line.id===origin.sourcePositionId)))
  f.phonePlan.versions.push({...cloneSales(f.phonePlan.versions[0]!),version:2,name:'新版'});f.phonePlan.publishedVersion=2
  assert.equal(JSON.stringify(delivery),snapshot);assert.equal(validateBenefitPackage(f.data,draft).quoteNeedsReview,false,'unused new plan versions never rewrite old selections')
  assert.deepEqual(benefitPackageImportProblems({...f.data,benefitPackages:[draft],benefitDeliveries:[delivery]}),[])
  const unknown={...cloneSales(delivery),sales:{schemaVersion:9,opaque:{future:true}}} as unknown as typeof delivery
  assert.equal(supportedBenefitDelivery(unknown),false);assert.deepEqual(benefitPackageImportProblems({...f.data,benefitDeliveries:[unknown]}),[])
})
check('required and mutually exclusive items apply to actual selections without auto-adding',()=>{
  const f=createSalesConfigurationFixture();f.phonePlan.items[0]!.required=true;f.phonePlan.items[0]!.minKinds=1;f.phonePlan.versions[0]!.items=cloneSales(f.phonePlan.items)
  const draft=draftFor(f.data);assert(validateBenefitPackage(f.data,draft).issues.some(issue=>/须选 1/.test(issue.message)));assert.equal(draft.goods.length,1)
  const impossible=salesTestPlan('impossible',[salesTestItem('a'),salesTestItem('b')]);impossible.rules=[{id:'self',kind:'requires',sourceGroupId:'a',targetGroupId:'a',enabled:true,note:''}]
  assert(planProblems(f.data,impossible).some(issue=>/自身/.test(issue)))
})
check('device context changes discard only orphan display contexts, preserving selected purposes',()=>{
  const f=createSalesConfigurationFixture();let draft=setSalesDevice(f.data,newBenefitPackageDraft(),{kind:'sku',skuId:'phone-a'})
  assert.equal(draft.sales!.contexts.length,1);draft=setSalesDevice(f.data,draft,null);assert.equal(draft.sales!.contexts.length,0)
  draft=setSalesDevice(f.data,draft,{kind:'sku',skuId:'phone-a'});draft=addSalesCandidate(f.data,draft,querySalesCandidates(f.data,draft,'phone-a').rows.find(row=>row.skuId==='case-sku')!)
  draft=setSalesDevice(f.data,draft,{kind:'sku',skuId:'phone-b'});assert(draft.sales!.contexts.some(context=>context.sourceSkuId==='phone-a'));assert.equal(draft.goods.length,1)
  const duplicate={...cloneSales(f.phoneBinding),id:'conflict-default',planId:f.casePlan.id};f.data.salesOptionBindings!.push(duplicate)
  assert.throws(()=>attachSalesSource(f.data,draft,'phone-a'),/冲突/)
})
check('new real SKU uses its frozen source version; a new publication needs explicit binding',()=>{
  const f=createSalesConfigurationFixture(),sku={...cloneSales(f.data.skus.find(item=>item.id==='phone-a')!),id:'new-phone',code:'NEW-PHONE'}
  f.data.skus.push(sku);assert.equal(resolveSalesPlan(f.data,sku.id).state,'matched');assert.equal(previewSalesBinding(f.data,f.phoneBinding).skuCount,9)
  const version={...cloneSales(f.version),id:'new-version',version:2};f.data.specModelVersions.push(version);sku.modelVersionId=version.id;sku.creationSource!.modelVersionId=version.id
  assert.equal(resolveSalesPlan(f.data,sku.id).state,'unconfigured')
  f.data.salesOptionBindings!.push({...cloneSales(f.phoneBinding),id:'new-version-binding',scope:{kind:'model',modelId:f.modelId,versionId:version.id}})
  assert.equal(resolveSalesPlan(f.data,sku.id).state,'matched')
})
check('reused candidate indexes react to categories/plans/bindings/relations/status/declarations',()=>{
  const f=createSalesConfigurationFixture(),draft=draftFor(f.data),index=createSalesCandidateIndex(f.data)
  const initial=querySalesCandidates(f.data,draft,'phone-a',index);assert.equal(initial.index,index)
  for(const change of [()=>{f.data.categories[0]!.name+='变更'},()=>{f.phonePlan.status='disabled'},()=>{f.phonePlan.status='available';f.phoneBinding.enabled=false},()=>{f.phoneBinding.enabled=true;f.data.skus.find(sku=>sku.id==='case-sku')!.status='off_sale'},()=>{f.data.skus.find(sku=>sku.id==='case-sku')!.status='on_sale';f.data.compatibilities[0]!.note+='新依据'}]){
    change();const reused=querySalesCandidates(f.data,draft,'phone-a',index),fresh=querySalesCandidates(f.data,draft,'phone-a');assert.notEqual(reused.index,index);assert.deepEqual(reused.rows,fresh.rows)
  }
})
check('known malformed nested schemas fail safely, opaque future schemas are preserved',()=>{
  const f=createSalesConfigurationFixture();assert.deepEqual(salesConfigurationImportProblems(f.data),[])
  const broken=cloneSales(f.data);(broken.salesOptionPlans![0]!.versions[0]!.items[0]!.scope as any).ids=null;assert(salesConfigurationImportProblems(broken).length)
  const future={id:'future',schemaVersion:8,anything:{retained:true}};const data={...f.data,salesOptionPlans:[future]};assert.deepEqual(salesConfigurationImportProblems(data),[]);assert.deepEqual(data.salesOptionPlans[0],future)
})
check('saved sales origins cannot be removed, retargeted or stripped of required context',()=>{
  const f=createSalesConfigurationFixture();let draft=draftFor(f.data)
  const source=draft.goods[0]!.id;draft=addSalesCandidate(f.data,draft,querySalesCandidates(f.data,draft,'phone-a').rows.find(row=>row.skuId==='case-sku')!,{sourcePositionId:source})
  draft.id='saved-sales';draft.code='SAVED';draft.revision=1;draft.createdAt=f.now;draft.updatedAt=f.now;f.data.benefitPackages=[cloneSales(draft)]
  for(const change of [(value:typeof draft)=>{delete value.sales},(value:typeof draft)=>{value.sales!.contexts=[]},(value:typeof draft)=>{value.sales!.origins[0]!.checkTarget='none'},(value:typeof draft)=>{value.sales!.origins=[]}]){
    const changed=cloneSales(draft);change(changed);const validation=validateBenefitPackage(f.data,changed)
    assert.equal(validation.canSaveDraft,false);assert.equal(validation.canDeliver,false)
  }
  const changed=cloneSales(draft);changed.goods.find(line=>line.skuId==='case-sku')!.quantity=2;assert.equal(validateBenefitPackage(f.data,changed).canSaveDraft,true)
  f.data.compatibilities.find(link=>(link.targetId||link.accessorySkuId)==='case-sku')!.note+=' updated'
  const increment=addSalesCandidate(f.data,draft,querySalesCandidates(f.data,draft,'phone-a',undefined,source).rows.find(row=>row.skuId==='case-sku')!,{sourcePositionId:source})
  assert.deepEqual(increment.sales!.origins[0],draft.sales!.origins[0]);assert.equal(validateBenefitPackage(f.data,increment).canSaveDraft,true)
  const removed=removeSalesPosition(draft,draft.goods.find(line=>line.skuId==='case-sku')!.id);assert.equal(validateBenefitPackage(f.data,removed).canSaveDraft,true)
})
check('existing selections retain old option versions after binding upgrade; new selections use the new version',()=>{
  const f=createSalesConfigurationFixture(),draft=draftFor(f.data),source=draft.goods[0]!.id
  const v2={...cloneSales(f.phonePlan.versions[0]!),version:2,name:'新版',items:[salesTestItem('new-film','skus',['film-sku'])]}
  f.phonePlan.versions.push(v2);f.phonePlan.publishedVersion=2;f.phoneBinding.planVersion=2
  const oldRows=querySalesCandidates(f.data,draft,'phone-a',undefined,source);assert.equal(oldRows.resolution.plan?.version,1);assert(oldRows.rows.some(row=>row.item.id==='case-choice'))
  const fresh=querySalesCandidates(f.data,newBenefitPackageDraft({kind:'sku',skuId:'phone-a'}),'phone-a');assert.equal(fresh.resolution.plan?.version,2);assert(fresh.rows.some(row=>row.item.id==='new-film'))
  const next=addSalesCandidate(f.data,draft,oldRows.rows.find(row=>row.skuId==='case-sku')!,{sourcePositionId:source});assert.equal(next.sales!.origins[0]!.plan?.version,1)
  f.phonePlan.status='disabled';assert.equal(validateBenefitPackage(f.data,next).canDeliver,false)
})
check('range preview and candidate cache include material identity and legal business definition dependencies',()=>{
  const f=createSalesConfigurationFixture(),draft=draftFor(f.data),initial=previewSalesBinding(f.data,f.phoneBinding),index=createSalesCandidateIndex(f.data)
  f.data.materialReceipts=[...(f.data.materialReceipts||[]),{skuId:'phone-a'} as any]
  const changed=previewSalesBinding(f.data,f.phoneBinding);assert.notEqual(changed.stamp,initial.stamp);assert.equal(changed.skuCount,initial.skuCount-1)
  assert.notEqual(querySalesCandidates(f.data,draft,'phone-a',index).index,index)
  const stamp=changed.stamp;f.data.businessDefinitions=[...(f.data.businessDefinitions||[]),{id:'stamp-dependency',name:'真实规则依赖'} as any]
  assert.notEqual(previewSalesBinding(f.data,f.phoneBinding).stamp,stamp)
  const latest=previewSalesBinding(f.data,f.phoneBinding).stamp;f.data.productPlans=[...(f.data.productPlans||[]),{id:'stamp-plan-dependency'} as any]
  assert.notEqual(previewSalesBinding(f.data,f.phoneBinding).stamp,latest)
})
check('100×100 is one range configuration, not ten thousand SKU pairs or new goods',()=>{
  const f=createSalesConfigurationFixture({styles:2,colors:5,packs:10}),base=f.data.skus.find(sku=>sku.id==='case-sku')!
  for(let i=1;i<100;i++)f.data.skus.push({...cloneSales(base),id:`case-${i}`,code:`CASE-${i}`})
  const original=f.data.compatibilities.find(link=>(link.targetId||link.accessorySkuId)==='case-sku')!
  for(let i=1;i<100;i++)f.data.compatibilities.push({...cloneSales(original),id:`case-evidence-${i}`,targetKind:'sku',targetId:`case-${i}`,accessorySkuId:`case-${i}`})
  f.data.salesOptionPlans=[f.phonePlan];f.data.salesOptionBindings=[f.phoneBinding]
  const before=business(f.data),preview=previewSalesBinding(f.data,f.phoneBinding)
  assert.equal(preview.legalCount,100);assert.equal(preview.skuCount,100);assert.equal(f.data.salesOptionBindings.length,1)
  const rows=querySalesCandidates(f.data,draftFor(f.data),'phone-a').rows.filter(row=>row.item.id==='case-choice')
  assert.equal(rows.length,101,'100 new/old case SKUs plus existing off-sale case remains visible as unavailable')
  assert(f.data.compatibilities.length<200);assert.equal(business(f.data),before)
})
console.log(`PASS sales configuration domain ${groups} groups`)
