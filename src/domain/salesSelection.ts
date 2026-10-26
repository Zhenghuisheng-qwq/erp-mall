import { evaluateCompatibilityCondition } from './accessoryCompatibilityQuery'
import { addBenefitSku, benefitCompatibilitySummary, benefitSkuSummary, cloneBenefit, removeBenefitPosition, setBenefitDevice } from './benefitPackages'
import { benefitSelectionCatalogStamp, createBenefitSelectionIndex, resolveBenefitRange, type BenefitSelectionIndex } from './benefitFrameworks'
import { benefitGroupRuleIssues } from './benefitPositions'
import { compatibilityRecordRole } from './deviceResolution'
import { isRealSku } from './catalogIdentity'
import { cloneSales, planProblems, relationProblems, resolveSalesPlan, resolveSalesSource, salesConfigurationStamp, salesSignature, salesPlanVersionProblems } from './salesConfiguration'
import type { AppData } from './types'
import type { BenefitCompatibilitySummary, BenefitDeviceContext, BenefitIssue, BenefitPackageDraft } from './benefitPackageTypes'
import type { DeviceResolution } from './accessoryCompatibilityTypes'
import type { SalesCandidate, SalesOptionItem, SalesOptionPlanVersion, SalesSelectionOrigin } from './salesConfigurationTypes'

export interface SalesCandidateIndex { stamp:string; benefit:BenefitSelectionIndex; queries:Map<string,{resolution:ReturnType<typeof resolveSalesPlan>;rows:SalesCandidate[]}> }
export function salesCandidateStamp(data:AppData){return salesSignature([salesConfigurationStamp(data),benefitSelectionCatalogStamp(data)])}
export function createSalesCandidateIndex(data:AppData):SalesCandidateIndex{return {stamp:salesCandidateStamp(data),benefit:createBenefitSelectionIndex(data),queries:new Map()}}
const purposeKey=(sourceSkuId:string,itemId:string,plan?:SalesOptionPlanVersion,sourcePositionId?:string)=>salesSignature([sourceSkuId,sourcePositionId||'',plan?.planId||'',plan?.version||0,itemId])
const groupKey=(origin:Pick<SalesSelectionOrigin,'sourceSkuId'|'sourcePositionId'|'itemId'|'plan'>)=>`sales:${purposeKey(origin.sourceSkuId,origin.itemId,origin.plan,origin.sourcePositionId)}`
export function synchronizeSalesGroupIds(draft:BenefitPackageDraft){
  if(draft.sales?.schemaVersion!==1)return
  const ids=new Map<string,string>()
  for(const origin of draft.sales.origins){const line=draft.goods.find(item=>item.id===origin.positionId);if(line?.groupId?.startsWith('sales:'))ids.set(line.groupId,groupKey(origin))}
  for(const line of draft.goods)if(line.groupId&&ids.has(line.groupId))line.groupId=ids.get(line.groupId)!
  for(const group of draft.groups)if(ids.has(group.id))group.id=ids.get(group.id)!
}
const uid=()=>`sales-position:${typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`}`
function sourceAttributes(data:AppData,skuId:string):DeviceResolution{
  const sku=data.skus.find(item=>item.id===skuId),family=sku&&data.families.find(item=>item.id===sku.familyId),attributes:Record<string,string>={}
  if(sku&&family)for(const param of data.params){const unique=data.params.filter(item=>item.name===param.name).length===1;const common=family.commonAttrs[param.id]??(unique?family.commonAttrs[param.name]:undefined),variant=sku.variantAttrs[param.id]??(unique?sku.variantAttrs[param.name]:undefined);if(!(common&&variant&&common!==variant)&&(variant||common))attributes[param.id]=variant||common!}
  return {status:sku&&family?'resolved':'invalid',skuId,candidates:[],message:'',source:'明确商品关系',attributes,sourceStamp:salesSignature([sku,family])}
}
/** Direct SKU applicability has its own identity and evidence; the source is never masqueraded as a host. */
export function salesDirectCompatibility(data:AppData,sourceSkuId:string,targetSkuId:string):BenefitCompatibilitySummary{
  const relations=(data.salesProductRelations||[]).filter(relation=>relation.schemaVersion===1&&relation.enabled&&relation.kind==='applicability'&&relation.sourceSkuId===sourceSkuId&&relation.targetSkuId===targetSkuId)
  const valid=relations.filter(relation=>!relationProblems(data,relation).length),device=sourceAttributes(data,sourceSkuId)
  const evaluated=valid.filter(relation=>relation.verification==='confirmed').map(relation=>({relation,conditions:relation.conditions.map(condition=>evaluateCompatibilityCondition(data,condition,device))}))
  const deny=evaluated.some(row=>row.relation.conclusion==='incompatible'&&row.conditions.every(condition=>condition.state==='met'))
  const uncertainDeny=evaluated.some(row=>row.relation.conclusion==='incompatible'&&!row.conditions.some(condition=>condition.state==='unmet'))
  const allows=evaluated.filter(row=>row.relation.conclusion!=='incompatible'),applicable=allows.filter(row=>!row.conditions.some(condition=>condition.state==='unmet'))
  const status=deny?'incompatible':uncertainDeny?'pending':applicable.some(row=>row.relation.conclusion==='compatible'&&row.conditions.every(condition=>condition.state==='met'))?'compatible':applicable.length?'conditional':allows.length?'incompatible':'pending'
  const conditions=evaluated.flatMap(row=>row.conditions.map(condition=>({state:condition.state,label:condition.label})))
  return {skuId:targetSkuId,basicStatus:status,fastChargeStatus:'pending',reasons:[status==='pending'?'缺少当前来源商品的已核验直接适用依据。':status==='incompatible'?'当前来源商品明确不适用或条件不满足。':status==='conditional'?'按已记录使用前提核对后确认。':'有已核验的直接适用依据。'],capabilities:[{capability:'basic',status,conditions,declarationIds:valid.map(relation=>relation.id),sources:valid.map(relation=>relation.source)}]}
}
function itemSummary(data:AppData,draft:BenefitPackageDraft,sourceSkuId:string,item:SalesOptionItem,skuId:string,index:BenefitSelectionIndex):BenefitCompatibilitySummary{
  if(item.checkTarget==='source')return salesDirectCompatibility(data,sourceSkuId,skuId)
  if(item.checkTarget==='none'&&compatibilityRecordRole(data,skuId)!=='accessory')return benefitCompatibilitySummary(skuId,undefined,false,false)
  const context=!draft.device&&compatibilityRecordRole(data,sourceSkuId)==='host'?{...draft,device:{kind:'sku' as const,skuId:sourceSkuId}}:draft
  const range=resolveBenefitRange(data,{...context,framework:undefined,rulesEnabled:false,groups:[]},index)
  if(compatibilityRecordRole(data,skuId)==='accessory'&&!context.device)return {skuId,basicStatus:'pending',fastChargeStatus:'pending',reasons:['请先确定本次使用设备，再核对基本适用依据。'],capabilities:[]}
  return benefitCompatibilitySummary(skuId,range.matches.get(skuId),compatibilityRecordRole(data,skuId)==='accessory',!!context.device)
}
function matchesScope(summary:NonNullable<SalesCandidate['summary']>,item:SalesOptionItem){return item.scope.kind==='product-types'?item.scope.ids.includes(summary.productTypeId):item.scope.kind==='families'?item.scope.ids.includes(summary.familyId):item.scope.kind==='skus'?item.scope.ids.includes(summary.skuId):false}
export function querySalesCandidates(data:AppData,draft:BenefitPackageDraft,sourceSkuId:string,supplied?:SalesCandidateIndex,sourcePositionId?:string){
  const retained=draft.sales?.schemaVersion===1?draft.sales.contexts.filter(context=>context.sourceSkuId===sourceSkuId&&(sourcePositionId===undefined||context.sourcePositionId===sourcePositionId)):[]
  const stamp=salesCandidateStamp(data),index=supplied?.stamp===stamp?supplied:createSalesCandidateIndex(data),key=salesSignature([sourceSkuId,sourcePositionId,draft.device,draft.requireFastCharge,retained])
  const cached=index.queries.get(key);if(cached)return {...cached,index}
  let resolution=resolveSalesPlan(data,sourceSkuId)
  const rows:SalesCandidate[]=[]
  if(retained.length&&!['conflict','invalid'].includes(resolution.state)){
    const versions=new Set(retained.map(context=>salesSignature(context.plan)))
    if(versions.size>1)resolution={...resolution,state:'conflict',message:'此商品在本次清单中有多个用途版本，请从已选位置明确查看来源。',plan:undefined}
    else {const context=retained[0]!,owner=data.salesOptionPlans?.find(plan=>plan.schemaVersion===1&&plan.id===context.plan.planId),version=owner?.versions.find(version=>version.version===context.plan.version)
      resolution=!version||owner?.status!=='available'||salesSignature(version)!==salesSignature(context.plan)?{...resolution,state:'invalid',message:'本次保留的方案版本已失效，请核对配置。',plan:undefined}:{...resolution,state:'matched',message:'本次选择保留原方案版本。',bindingIds:[...context.bindingIds],plan:cloneSales(context.plan)}
    }
  }
  function add(item:SalesOptionItem,plan?:SalesOptionPlanVersion,bindingIds:string[]=[],relationIds:string[]=[]){
    if(!item.enabled)return
    const base={item:cloneSales(item),sourceSkuId,bindingIds:[...bindingIds],...(plan?{plan:cloneSales(plan)}:{}),relationIds}
    if(item.scope.kind==='service'){rows.push({...base,key:purposeKey(sourceSkuId,item.id,plan),status:'not-required',canAdd:true,reason:'服务权益，按实际内容和计量方式提供。',evidence:salesSignature([plan,item])});return}
    for(const summary of index.benefit.summaries.values()){
      if(!matchesScope(summary,item)||summary.skuId===sourceSkuId)continue
      const compatibility=itemSummary(data,draft,sourceSkuId,item,summary.skuId,index.benefit),status=compatibility.basicStatus==='unchecked'?'pending':compatibility.basicStatus
      const available=index.benefit.saleIds.has(summary.skuId),source=resolveSalesSource(data,sourceSkuId)
      rows.push({...base,key:salesSignature([purposeKey(sourceSkuId,item.id,plan),summary.skuId]),skuId:summary.skuId,summary:cloneSales(summary),status,canAdd:available&&status!=='incompatible',reason:!available?'商品当前不在售。':compatibility.reasons.join('；')||(['pending','conditional'].includes(status)?'需要核对使用依据。':status==='not-required'?'独立商品；未宣称与来源兼容。':'已核对当前适用对象。'),evidence:salesSignature([source,data.salesOptionBindings?.filter(binding=>bindingIds.includes(binding.id)),item,compatibility,data.salesProductRelations?.filter(relation=>relation.sourceSkuId===sourceSkuId&&relation.targetSkuId===summary.skuId)])})
    }
  }
  if(resolution.state==='matched')for(const item of [...resolution.plan!.items].sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id)))add(item,resolution.plan,resolution.bindingIds)
  if(!['conflict','invalid','none'].includes(resolution.state)){
    const targets=new Map<string,{skuId:string;target:SalesOptionItem['checkTarget'];ids:string[]}>()
    for(const relation of data.salesProductRelations||[])if(relation.schemaVersion===1&&relation.enabled&&relation.sourceSkuId===sourceSkuId&&!relationProblems(data,relation).length){const target=relation.kind==='applicability'?'source':relation.checkTarget||'device',key=salesSignature([relation.targetSkuId,target]),item=targets.get(key)||{skuId:relation.targetSkuId,target,ids:[]};item.ids.push(relation.id);targets.set(key,item)}
    for(const {skuId,target,ids} of targets.values())add({id:`relation:${target}:${skuId}`,name:'相关商品',enabled:true,order:1000,scope:{kind:'skus',ids:[skuId]},recommended:true,required:false,minKinds:0,maxKinds:1,defaultQuantity:1,minQuantity:1,maxQuantity:999,checkTarget:target,source:'商品关联',note:''},undefined,[],ids)
  }
  const result={resolution,rows};index.queries.set(key,result);return {...result,index}
}

export function attachSalesSource(data:AppData,draft:BenefitPackageDraft,sourceSkuId:string,sourcePositionId?:string):BenefitPackageDraft{
  const next=cloneBenefit(draft);next.sales??={schemaVersion:1,origins:[],contexts:[]}
  if(next.sales.schemaVersion!==1)throw Error('未知销售方案版本只读保留。')
  const resolved=resolveSalesPlan(data,sourceSkuId)
  if(['conflict','invalid'].includes(resolved.state))throw Error(resolved.message)
  if(resolved.state==='matched'&&!next.sales.contexts.some(context=>context.sourceSkuId===sourceSkuId&&context.sourcePositionId===sourcePositionId))next.sales.contexts.push({sourceSkuId,...(sourcePositionId?{sourcePositionId}:{}),bindingIds:resolved.bindingIds,plan:cloneSales(resolved.plan!)})
  return next
}
export function setSalesDevice(data:AppData,draft:BenefitPackageDraft,device:BenefitDeviceContext):BenefitPackageDraft{
  let next=setBenefitDevice(data,draft,device)
  if(next.sales?.schemaVersion===1)next.sales.contexts=next.sales.contexts.filter(context=>context.sourcePositionId||device?.kind==='sku'&&device.skuId===context.sourceSkuId||next.sales!.origins.some(origin=>origin.sourceSkuId===context.sourceSkuId&&origin.sourcePositionId===context.sourcePositionId&&origin.plan?.planId===context.plan.planId&&origin.plan.version===context.plan.version))
  if(device?.kind==='sku')next=attachSalesSource(data,next,device.skuId)
  return next
}
export function addSalesCandidate(data:AppData,draft:BenefitPackageDraft,candidate:SalesCandidate,options:{sourcePositionId?:string}={}):BenefitPackageDraft{
  const current=querySalesCandidates(data,draft,candidate.sourceSkuId,undefined,options.sourcePositionId).rows.find(row=>row.key===candidate.key)
  if(!current||!current.canAdd)throw Error(current?.reason||'候选或来源方案已变化，请重新查看相关商品。')
  if(current.evidence!==candidate.evidence)throw Error('适用依据或方案范围已变化，请重新核对当前候选。')
  let next=attachSalesSource(data,draft,current.sourceSkuId,options.sourcePositionId)
  if(!next.device&&compatibilityRecordRole(data,current.sourceSkuId)==='host')next.device={kind:'sku',skuId:current.sourceSkuId}
  const origin:SalesSelectionOrigin={positionId:'',sourceSkuId:current.sourceSkuId,...(options.sourcePositionId?{sourcePositionId:options.sourcePositionId}:{}),itemId:current.item.id,checkTarget:current.item.checkTarget,bindingIds:current.bindingIds,...(current.plan?{plan:cloneSales(current.plan)}:{}),relationIds:[...current.relationIds],evidence:current.evidence}
  const existingOrigin=next.sales!.origins.find(item=>purposeKey(item.sourceSkuId,item.itemId,item.plan,item.sourcePositionId)===purposeKey(origin.sourceSkuId,origin.itemId,origin.plan,origin.sourcePositionId)&&(current.skuId?next.goods.some(line=>line.id===item.positionId&&line.skuId===current.skuId):next.services.some(line=>line.id===item.positionId)))
  if(current.item.scope.kind==='service'){
    const existing=next.services.find(line=>line.id===existingOrigin?.positionId),quantity=(existing?.quantity||0)+current.item.defaultQuantity
    if(quantity>current.item.maxQuantity)throw Error(`「${current.item.name}」最多 ${current.item.maxQuantity} ${current.item.service!.unit}。`)
    if(existing){existing.quantity=quantity;origin.positionId=existing.id}else{origin.positionId=uid();next.services.push({id:origin.positionId,name:current.item.name,quantity,...cloneSales(current.item.service!)})}
  }else{
    if(!current.skuId)throw Error('候选没有真实销售 SKU。')
    const existing=next.goods.find(line=>line.id===existingOrigin?.positionId),id=existing?.groupId||groupKey(origin)
    if((existing?.quantity||0)+current.item.defaultQuantity>current.item.maxQuantity)throw Error(`「${current.item.name}」每种商品最多 ${current.item.maxQuantity} 件。`)
    const selected=next.sales!.origins.filter(item=>groupKey(item)===id).flatMap(item=>next.goods.filter(line=>line.id===item.positionId).map(line=>line.skuId))
    if(!selected.includes(current.skuId)&&new Set(selected).size>=current.item.maxKinds)throw Error(`「${current.item.name}」最多选择 ${current.item.maxKinds} 种。`)
    let group=next.groups.find(item=>item.id===id)
    if(!group){group={id,name:current.item.name,enabled:true,candidateSkuIds:[],required:false,minKinds:0,maxKinds:1,defaultQuantity:1,adjustable:true,minQuantity:1,maxQuantity:Number.MAX_SAFE_INTEGER};next.groups.push(group)}
    group.candidateSkuIds=[...new Set([...group.candidateSkuIds,current.skuId])];group.maxKinds=group.candidateSkuIds.length;next.rulesEnabled=true
    // Existing ordinary position machinery remains the sole SKU ledger. Direct-source
    // applicability is separately revalidated below instead of faking a host context.
    const device=next.device
    const forAdd=current.item.checkTarget==='source'?{...next,device:null}:next
    next=addBenefitSku(data,forAdd,current.skuId,current.item.defaultQuantity,{groupId:id,role:'item'})
    next.device=device;origin.positionId=next.goods.find(line=>line.groupId===id&&line.skuId===current.skuId)!.id
  }
  next.sales!.origins=next.sales!.origins.filter(item=>item.positionId!==origin.positionId);next.sales!.origins.push(existingOrigin?cloneSales(existingOrigin):origin)
  if(current.skuId)next=attachSalesSource(data,next,current.skuId,origin.positionId)
  next.confirmations=[];next.quote.reviewedBasis='';return next
}
export function removeSalesPosition(draft:BenefitPackageDraft,positionId:string):BenefitPackageDraft{
  let next=draft.goods.some(line=>line.id===positionId)?removeBenefitPosition(draft,positionId):cloneBenefit(draft)
  next.services=next.services.filter(line=>line.id!==positionId)
  if(next.sales?.schemaVersion===1){next.sales.origins=next.sales.origins.filter(origin=>origin.positionId!==positionId);next.sales.contexts=next.sales.contexts.filter(context=>context.sourcePositionId!==positionId)}
  next.groups=next.groups.filter(group=>!group.id.startsWith('sales:')||next.goods.some(line=>line.groupId===group.id))
  next.confirmations=[];next.quote.reviewedBasis='';return next
}

export function salesPositionCompatibility(data:AppData,draft:BenefitPackageDraft,positionId:string,index:BenefitSelectionIndex):BenefitCompatibilitySummary|undefined{
  if(draft.sales?.schemaVersion!==1)return
  const origin=draft.sales.origins.find(item=>item.positionId===positionId),line=draft.goods.find(item=>item.id===positionId)
  if(!origin||!line)return
  if(origin.checkTarget==='source')return salesDirectCompatibility(data,origin.sourceSkuId,line.skuId)
  if(origin.checkTarget==='none'&&compatibilityRecordRole(data,line.skuId)!=='accessory')return benefitCompatibilitySummary(line.skuId,undefined,false,false)
  const item=origin.plan?.items.find(item=>item.id===origin.itemId)||{id:origin.itemId,name:'相关商品',enabled:true,order:0,scope:{kind:'skus' as const,ids:[line.skuId]},recommended:true,required:false,minKinds:0,maxKinds:1,defaultQuantity:1,minQuantity:1,maxQuantity:999,checkTarget:origin.checkTarget,source:'商品关联',note:''}
  if(item)return itemSummary(data,draft,origin.sourceSkuId,item,line.skuId,index)
  return undefined
}
export function salesMetadataProblems(value:unknown):string[]{
  if(value===undefined)return []
  if(!value||typeof value!=='object'||Array.isArray(value))return ['销售来源结构无效。']
  const sales=value as NonNullable<BenefitPackageDraft['sales']>
  if(sales.schemaVersion!==1)return ['未知销售来源版本，不能执行或重新生成交付。']
  if(!Array.isArray(sales.origins)||!Array.isArray(sales.contexts))return ['销售来源及方案上下文必须是数组。']
  for(const origin of sales.origins)if(!origin||!['positionId','sourceSkuId','itemId','evidence'].every(key=>typeof origin[key as keyof typeof origin]==='string'&&!!origin[key as keyof typeof origin])||!['device','source','none'].includes(origin.checkTarget)||!Array.isArray(origin.bindingIds)||!origin.bindingIds.every(id=>typeof id==='string')||!Array.isArray(origin.relationIds)||!origin.relationIds.every(id=>typeof id==='string')||origin.sourcePositionId!==undefined&&typeof origin.sourcePositionId!=='string'||origin.plan!==undefined&&salesPlanVersionProblems(origin.plan).length)return ['销售位置来源结构无效。']
  for(const context of sales.contexts)if(!context||typeof context.sourceSkuId!=='string'||!context.sourceSkuId||!Array.isArray(context.bindingIds)||!context.bindingIds.every(id=>typeof id==='string')||context.sourcePositionId!==undefined&&typeof context.sourcePositionId!=='string'||salesPlanVersionProblems(context.plan).length)return ['销售方案上下文结构无效。']
  return []
}
export function salesSelectionIssues(data:AppData,draft:BenefitPackageDraft):BenefitIssue[]{
  const previous=draft.id?data.benefitPackages?.find(item=>item.id===draft.id):undefined
  const tampered=(message:string):BenefitIssue=>({code:'sales-origin-identity',message,severity:'error',structural:true})
  if(previous?.sales&&(!draft.sales||previous.sales.schemaVersion!==1))return [tampered('已保存销售方案的来源版本不能移除或降级；请保留原记录。')]
  if(!draft.sales)return draft.goods.some(line=>line.groupId?.startsWith('sales:'))?[tampered('销售用途位置必须保留其来源记录。')]:[]
  const malformed=salesMetadataProblems(draft.sales);if(malformed.length)return malformed.map(message=>({code:'sales-structure',message,severity:'error',structural:true}))
  const issues:BenefitIssue[]=[],add=(message:string,positionId?:string)=>issues.push({code:'sales-selection',message,positionId,severity:'error'})
  const alive=new Map([...draft.goods,...draft.services].map(line=>[line.id,line])),seen=new Set<string>()
  if(draft.goods.some(line=>line.groupId?.startsWith('sales:')&&!draft.sales!.origins.some(origin=>origin.positionId===line.id)))issues.push(tampered('销售用途位置缺少来源记录，不能绕过原方案规则。'))
  if(previous?.sales?.schemaVersion===1){
    for(const old of previous.sales.origins)if(alive.has(old.positionId)){
      const retained=draft.sales.origins.find(origin=>origin.positionId===old.positionId)
      if(!retained||salesSignature(retained)!==salesSignature(old))issues.push(tampered('已保存位置的用途、方案版本或来源依据不能直接改写；请明确移除后从新用途重新加入。'))
    }
    for(const old of previous.sales.contexts){
      const needed=old.sourcePositionId?draft.goods.some(line=>line.id===old.sourcePositionId&&line.skuId===old.sourceSkuId):draft.device?.kind==='sku'&&draft.device.skuId===old.sourceSkuId||draft.sales.origins.some(origin=>origin.sourceSkuId===old.sourceSkuId&&!origin.sourcePositionId&&origin.plan?.planId===old.plan.planId&&origin.plan.version===old.plan.version)
      if(needed&&!draft.sales.contexts.some(context=>salesSignature(context)===salesSignature(old)))issues.push(tampered('仍在使用的已保存选配方案上下文不能删除或改写。'))
    }
  }
  for(const origin of draft.sales.origins){
    const line=alive.get(origin.positionId)
    if(!line||seen.has(origin.positionId)){add('销售来源对应的位置缺失或重复，请修复来源记录。',origin.positionId);continue}seen.add(origin.positionId)
    if(!data.skus.some(sku=>sku.id===origin.sourceSkuId&&isRealSku(data,sku)))add('推荐来源商品已失效，请重新核对本次用途。',origin.positionId)
    if(origin.sourcePositionId&&!draft.goods.some(item=>item.id===origin.sourcePositionId&&item.skuId===origin.sourceSkuId))add(`「${'snapshot'in line?line.snapshot.name:line.name}」依赖的来源商品已移除或更换，请重新选择用途或移除此项。`,origin.positionId)
    const item=origin.plan?.items.find(item=>item.id===origin.itemId)
    if(origin.plan){
      const owner=data.salesOptionPlans?.find(plan=>plan.schemaVersion===1&&plan.id===origin.plan!.planId),version=owner?.versions.find(version=>version.version===origin.plan!.version)
      if(!version||owner?.status!=='available'||salesSignature(version)!==salesSignature(origin.plan)||planProblems(data,origin.plan).length)add('本次冻结的选配方案版本失效或已停用，请重新核对来源；已选内容保留。',origin.positionId)
      if(!item||!item.enabled)add('选配项目已失效。',origin.positionId)
      if(!draft.sales.contexts.some(context=>context.sourceSkuId===origin.sourceSkuId&&context.sourcePositionId===origin.sourcePositionId&&salesSignature(context.plan)===salesSignature(origin.plan)))issues.push(tampered('销售位置必须保留其完整方案上下文，不能只保留选中的项目以绕过必选规则。'))
      if(item&&origin.checkTarget!==item.checkTarget)issues.push(tampered('位置的实际适用对象与冻结方案不一致，不能改变核验对象来绕过限制。'))
    }else{
      const relations=(data.salesProductRelations||[]).filter(relation=>origin.relationIds.includes(relation.id))
      if(!('skuId'in line)||!origin.relationIds.length||origin.itemId!==`relation:${origin.checkTarget}:${'skuId'in line?line.skuId:''}`)issues.push(tampered('直接商品关联的位置用途或来源身份无效。'))
      if(relations.some(relation=>relationProblems(data,relation).length||(relation.kind==='applicability'?'source':relation.checkTarget||'device')!==origin.checkTarget))add('直接商品关联的适用对象或依据已改变，请移除此项后从当前用途重新加入。',origin.positionId)
    }
    if(item){
      if(line.quantity<item.minQuantity||line.quantity>item.maxQuantity)add(`「${item.name}」数量须为 ${item.minQuantity}～${item.maxQuantity}。`,origin.positionId)
      if('skuId'in line){const summary=benefitSkuSummary(data,line.skuId);if(!summary||!matchesScope(summary,item))add(`「${item.name}」商品不属于保存的候选范围。`,origin.positionId)}
    }
    if(origin.relationIds.length&&origin.relationIds.some(id=>!data.salesProductRelations?.some(relation=>relation.id===id&&relation.enabled&&relation.sourceSkuId===origin.sourceSkuId&&(!('skuId'in line)||relation.targetSkuId===line.skuId))))add('此项的推荐关联已改变或停用，请重新查看来源后选择。',origin.positionId)
  }
  for(const context of draft.sales.contexts){
    if(context.sourcePositionId&&!alive.has(context.sourcePositionId))continue
    const owner=data.salesOptionPlans?.find(plan=>plan.schemaVersion===1&&plan.id===context.plan.planId),version=owner?.versions.find(version=>version.version===context.plan.version)
    if(!version||owner?.status!=='available'||salesSignature(version)!==salesSignature(context.plan)||planProblems(data,context.plan).length){add('本次来源选配方案已停用或发布版本无效，请核对后重新选择。');continue}
    const current=resolveSalesPlan(data,context.sourceSkuId);if(['conflict','invalid'].includes(current.state)){add(current.message,context.sourcePositionId);continue}
    const counts=new Map<string,number>()
    for(const item of context.plan.items.filter(item=>item.enabled)){
      const origins=draft.sales.origins.filter(origin=>origin.sourceSkuId===context.sourceSkuId&&origin.sourcePositionId===context.sourcePositionId&&origin.plan?.planId===context.plan.planId&&origin.plan.version===context.plan.version&&origin.itemId===item.id)
      const count=new Set(origins.map(origin=>{const line=alive.get(origin.positionId);return line&&'skuId'in line?line.skuId:line?.id}).filter(Boolean)).size;counts.set(item.id,count)
      const min=item.required||count?item.minKinds:0
      if(count<min||count>item.maxKinds)add(`「${context.plan.name} / ${item.name}」须选 ${min}～${item.maxKinds} 种，当前 ${count} 种。`)
    }
    const groups=context.plan.items.map(item=>({id:item.id,name:item.name,enabled:item.enabled,candidateSkuIds:[],required:item.required,minKinds:item.minKinds,maxKinds:item.maxKinds,defaultQuantity:item.defaultQuantity,adjustable:true,minQuantity:item.minQuantity,maxQuantity:item.maxQuantity}))
    issues.push(...benefitGroupRuleIssues(groups,context.plan.rules,counts))
  }
  return issues
}
export function salesSelectionEvidence(data:AppData,draft:BenefitPackageDraft){
  if(!draft.sales)return undefined
  return {metadata:draft.sales,sources:draft.sales.origins.map(origin=>resolveSalesSource(data,origin.sourceSkuId)),relations:data.salesProductRelations?.filter(relation=>draft.sales!.origins.some(origin=>origin.sourceSkuId===relation.sourceSkuId)),plans:data.salesOptionPlans?.filter(plan=>plan.schemaVersion===1&&draft.sales!.contexts.some(context=>context.plan.planId===plan.id)).map(plan=>({id:plan.id,status:plan.status,versions:plan.versions.filter(version=>draft.sales!.contexts.some(context=>context.plan.planId===plan.id&&context.plan.version===version.version))}))}
}
