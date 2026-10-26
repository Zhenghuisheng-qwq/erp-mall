import { isRealSku } from './catalogIdentity'
import { benefitGroupRuleIssues, benefitGroupRuleStructureIssues } from './benefitPositions'
import { conditionProblem } from './compatibilityValidation'
import { createEmptyTemplateCompatibilityConfig, createTemplateCompatibilityContext, templateSelectorCoverage } from './templateCompatibility'
import type { AppData } from './types'
import type { SalesBindingPreview, SalesOptionBinding, SalesOptionPlan, SalesOptionPlanVersion, SalesPlanResolution, SalesProductRelation, SalesSourceResolution } from './salesConfigurationTypes'

export const cloneSales = <T>(value:T):T => JSON.parse(JSON.stringify(value))
export function salesSignature(value:unknown):string {
  if(Array.isArray(value))return `[${value.map(salesSignature).join(',')}]`
  if(value&&typeof value==='object')return `{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>`${JSON.stringify(key)}:${salesSignature(item)}`).join(',')}}`
  return JSON.stringify(value)??'undefined'
}
const obj=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)
const strings=(value:unknown):value is string[]=>Array.isArray(value)&&value.every(item=>typeof item==='string'&&!!item)
const integer=(value:unknown,min=0):value is number=>Number.isSafeInteger(value)&&Number(value)>=min
function itemShape(item:unknown):boolean{
  if(!obj(item)||!['id','name','source','note'].every(key=>typeof item[key]==='string')||!item.id||!item.name||typeof item.enabled!=='boolean'||typeof item.recommended!=='boolean'||typeof item.required!=='boolean'||!integer(item.order)||!obj(item.scope)||!['product-types','families','skus','service'].includes(String(item.scope.kind))||!strings(item.scope.ids)||!['device','source','none'].includes(String(item.checkTarget))||!integer(item.minKinds)||!['maxKinds','defaultQuantity','minQuantity','maxQuantity'].every(key=>integer(item[key],1)))return false
  const service=item.service
  return item.scope.kind!=='service'||obj(service)&&['unit','measurement','validity','description'].every(key=>typeof service[key]==='string')&&['per-package','per-delivery'].includes(String(service.measurement))
}
export function salesPlanVersionProblems(value:unknown):string[]{
  if(!obj(value)||value.schemaVersion!==1||typeof value.planId!=='string'||!value.planId||!integer(value.version,1)||typeof value.name!=='string'||!value.name.trim()||typeof value.publishedAt!=='string'||!Number.isFinite(Date.parse(value.publishedAt))||!Array.isArray(value.items)||!value.items.length||!value.items.every(itemShape)||new Set(value.items.map(item=>item.id)).size!==value.items.length||benefitGroupRuleStructureIssues(value.rules).length)return ['销售方案发布快照结构无效。']
  return []
}
function selectorShape(value:unknown):boolean{return obj(value)&&Array.isArray(value.anyOf)&&!!value.anyOf.length&&value.anyOf.every(group=>Array.isArray(group)&&!!group.length&&group.every(term=>obj(term)&&['attributeNodeId','attributeId','valueNodeId','valueId'].every(key=>typeof term[key]==='string'&&!!term[key])&&(term.parentValueNodeId===null||typeof term.parentValueNodeId==='string')))}
function bindingShape(value:unknown):boolean{
  if(!obj(value)||value.schemaVersion!==1||!['id','name','source','updatedAt'].every(key=>typeof value[key]==='string')||typeof value.enabled!=='boolean'||!integer(value.revision)||!['default','replace','none'].includes(String(value.mode))||!obj(value.scope)||!(value.planId===null||typeof value.planId==='string')||!(value.planVersion===null||integer(value.planVersion,1)))return false
  const scope=value.scope
  return scope.kind==='model'?typeof scope.modelId==='string'&&(scope.versionId===null||typeof scope.versionId==='string')&&(scope.nodeId===undefined||typeof scope.nodeId==='string')&&(scope.selector===undefined||selectorShape(scope.selector)):scope.kind==='products'&&strings(scope.familyIds)&&strings(scope.skuIds)
}
function relationShape(value:unknown):boolean{return obj(value)&&value.schemaVersion===1&&['id','sourceSkuId','targetSkuId','source','note','updatedAt'].every(key=>typeof value[key]==='string')&&integer(value.revision)&&typeof value.enabled==='boolean'&&['recommendation','applicability'].includes(String(value.kind))&&(value.checkTarget===undefined||['device','source','none'].includes(String(value.checkTarget)))&&['compatible','conditional','incompatible'].includes(String(value.conclusion))&&['pending','confirmed'].includes(String(value.verification))&&Array.isArray(value.conditions)&&value.conditions.every(condition=>!conditionProblem(condition))}
function receiptsShape(value:unknown,revision:number):boolean{return value===undefined||Array.isArray(value)&&value.every(receipt=>obj(receipt)&&typeof receipt.requestId==='string'&&!!receipt.requestId&&typeof receipt.intent==='string'&&!!receipt.intent&&integer(receipt.sourceRevision)&&integer(receipt.resultRevision,1)&&receipt.resultRevision===receipt.sourceRevision+1&&receipt.resultRevision<=revision)&&new Set(value.map(receipt=>receipt.requestId)).size===value.length}

export function planProblems(data:AppData,plan:SalesOptionPlan|SalesOptionPlanVersion):string[]{
  if(!obj(plan)||plan.schemaVersion!==1)return ['不支持的销售方案版本，原内容只读保留。']
  if(typeof plan.name!=='string'||!plan.name.trim()||!Array.isArray(plan.items)||!Array.isArray(plan.rules))return ['请填写方案名称及有效选配项目。']
  if(!plan.items.every(itemShape)||benefitGroupRuleStructureIssues(plan.rules).length)return ['选配项目或项目规则结构无效。']
  if('version'in plan&&salesPlanVersionProblems(plan).length)return salesPlanVersionProblems(plan)
  if('versions'in plan&&(!Array.isArray(plan.versions)||plan.versions.some(version=>salesPlanVersionProblems(version).length)))return ['方案发布历史结构无效。']
  const issues:string[]=[],ids=new Set<string>()
  if(!plan.items.length)issues.push('至少添加一个选配项目。')
  for(const item of plan.items){
    if(!obj(item)||typeof item.id!=='string'||!item.id||ids.has(item.id)||typeof item.name!=='string'||!item.name.trim()||typeof item.enabled!=='boolean'||!integer(item.order)||!obj(item.scope)||!['product-types','families','skus','service'].includes(item.scope.kind)||!Array.isArray(item.scope.ids)||!item.scope.ids.every(id=>typeof id==='string'&&!!id)||typeof item.required!=='boolean'||typeof item.recommended!=='boolean'||!['device','source','none'].includes(item.checkTarget)||typeof item.source!=='string'||typeof item.note!=='string'){issues.push('选配项目的名称、身份、范围或状态无效。');continue}
    ids.add(item.id)
    if(!integer(item.minKinds)||!integer(item.maxKinds,1)||item.minKinds>item.maxKinds||item.required&&item.minKinds<1||![item.defaultQuantity,item.minQuantity,item.maxQuantity].every(value=>integer(value,1))||item.minQuantity>item.defaultQuantity||item.defaultQuantity>item.maxQuantity)issues.push(`「${item.name}」数量或选择种数范围无效。`)
    if(item.scope.kind==='service'){
      if(item.scope.ids.length||!item.service||!item.service.unit?.trim()||!['per-package','per-delivery'].includes(item.service.measurement)||typeof item.service.validity!=='string'||typeof item.service.description!=='string')issues.push(`「${item.name}」服务单位或计量方式无效。`)
    }else{
      if(!item.scope.ids.length||new Set(item.scope.ids).size!==item.scope.ids.length)issues.push(`「${item.name}」请选择不重复的真实候选范围。`)
      const known=new Set(item.scope.kind==='product-types'?data.productTypes.filter(type=>type.status==='enabled').map(type=>type.id):item.scope.kind==='families'?data.families.map(family=>family.id):data.skus.filter(sku=>isRealSku(data,sku)).map(sku=>sku.id))
      for(const id of item.scope.ids)if(!known.has(id))issues.push(`「${item.name}」候选引用 ${id} 已失效。`)
    }
  }
  const groups=plan.items.filter(item=>item&&typeof item.id==='string').map(item=>({id:item.id,name:item.name,enabled:item.enabled,candidateSkuIds:[],required:item.required,minKinds:item.minKinds,maxKinds:item.maxKinds,defaultQuantity:item.defaultQuantity,adjustable:true,minQuantity:item.minQuantity,maxQuantity:item.maxQuantity}))
  issues.push(...benefitGroupRuleIssues(groups,plan.rules).map(issue=>issue.message))
  return [...new Set(issues)]
}

/** Scope resolution uses frozen nodes/roles, but never interprets compatibility claims as sales bindings. */
export function salesBindingContext(data:AppData,modelId:string,versionId?:string|null){
  const source={...data,templateCompatibilityConfigs:[],specModelVersions:data.specModelVersions.map(version=>version.id===versionId&&version.templateCompatibilitySnapshot?{...version,templateCompatibilitySnapshot:{...version.templateCompatibilitySnapshot,config:createEmptyTemplateCompatibilityConfig(modelId)}}:version)}
  return createTemplateCompatibilityContext(source,{modelId,versionId:versionId||undefined,config:createEmptyTemplateCompatibilityConfig(modelId)})
}

export function resolveSalesSource(data:AppData,skuId:string):SalesSourceResolution {
  const result:SalesSourceResolution={state:'invalid',skuId,modelId:'',versionId:'',identityKey:'',message:''}
  const sku=data.skus.find(item=>item.id===skuId),family=sku&&data.families.find(item=>item.id===sku.familyId)
  if(!sku||!family||!isRealSku(data,sku))return {...result,message:'来源不是有效的真实销售 SKU。'}
  const ownVersions=[...new Set([sku.modelVersionId,sku.creationSource?.modelVersionId].filter((id):id is string=>!!id))]
  if(ownVersions.length>1)return {...result,message:'SKU 的发布版本来源互相矛盾，请先核对来源。'}
  const versionId=sku.creationSource?sku.creationSource.modelVersionId:ownVersions[0]||(sku.sourceNodeIds?.length||sku.planningId?family.modelVersionId:'')||''
  const modelId=sku.creationSource?.templateId||family.productModelId||family.templateId
  Object.assign(result,{modelId,versionId})
  if(!versionId)return {...result,state:'legacy',message:'未记录发布规格来源；可明确选择真实商品范围绑定。'}
  const version=data.specModelVersions.find(item=>item.id===versionId&&item.templateId===modelId)
  if(!version||version.status!=='published')return {...result,message:'来源发布版本不存在或已停用，不会按最新草稿反推。'}
  const context=salesBindingContext(data,modelId,versionId)
  if(context.issues.length)return {...result,message:context.issues.map(issue=>issue.message).join('；')}
  let matches=context.combinations
  if(sku.sourceNodeIds?.length){
    const ids=new Set(sku.sourceNodeIds)
    if([...ids].some(id=>!context.byNode.has(id)))return {...result,message:'SKU 来源节点不属于其发布版本。'}
    const values=[...ids].filter(id=>context.byNode.get(id)?.nodeType==='VALUE')
    matches=matches.filter(combo=>values.every(id=>combo.steps.some(step=>step.valueNodeId===id)))
  }
  if(sku.planningId){
    const record=data.planningRecords.find(item=>item.planningId===sku.planningId)
    if(!record||record.productModelId!==modelId||![record.modelVersionId,record.originModelVersionId,...record.modelVersionIds].includes(versionId))return {...result,message:'SKU 的规划来源与发布版本不一致。'}
    matches=matches.filter(combo=>combo.identityKey===record.identityKey)
  }
  // Attribute identity is accepted only by actual dictionary id; ambiguous legacy names do not infer a match.
  const names=version.templateCompatibilitySnapshot?.attributeNames||[]
  const read=(id:string)=>{
    const name=names.find(item=>item.attributeId===id)?.name
    const uniqueName=name&&names.filter(item=>item.name===name).length===1?name:undefined
    const common=family.commonAttrs[id]??(uniqueName?family.commonAttrs[uniqueName]:undefined)
    const variant=sku.variantAttrs[id]??(uniqueName?sku.variantAttrs[uniqueName]:undefined)
    return common&&variant&&common!==variant?null:variant||common
  }
  matches=matches.filter(combo=>combo.steps.every(step=>{const value=read(step.attributeId);return value!==null&&(value===undefined||value===step.valueId)}))
  if(matches.length!==1)return {...result,message:`来源规格无法唯一解析（命中 ${matches.length} 个合法规格），请核对真实节点和属性来源。`}
  return {...result,state:'resolved',identityKey:matches[0]!.identityKey,message:''}
}

export function bindingProblems(data:AppData,binding:SalesOptionBinding):string[]{
  if(!obj(binding)||binding.schemaVersion!==1)return ['不支持的销售绑定版本，原内容只读保留。']
  if(!bindingShape(binding))return ['绑定的节点条件、方案或范围结构无效。']
  const issues:string[]=[]
  if(typeof binding.id!=='string'||typeof binding.name!=='string'||!binding.name.trim()||!integer(binding.revision)||typeof binding.enabled!=='boolean'||!['default','replace','none'].includes(binding.mode)||typeof binding.source!=='string'||!obj(binding.scope))return ['绑定的身份、名称、范围或状态无效。']
  const scope=binding.scope
  if(scope.kind==='model'){
    if(typeof scope.modelId!=='string'||!data.templates.some(item=>item.id===scope.modelId)&&!data.specCanvases.some(item=>item.templateId===scope.modelId))issues.push('来源模型已失效。')
    if(scope.versionId!==null&&(typeof scope.versionId!=='string'||!data.specModelVersions.some(item=>item.id===scope.versionId&&item.templateId===scope.modelId)))issues.push('绑定发布版本不存在，不会自动换用其他版本。')
    if(binding.mode==='default'&&(scope.selector||scope.nodeId))issues.push('默认方案必须作用于整个模型；节点范围请使用替换或不使用。')
    if(binding.mode!=='default'&&!scope.selector)issues.push('请明确选择实际规格条件范围，不能默认覆盖所有属性值。')
    if(scope.selector){const context=salesBindingContext(data,scope.modelId,scope.versionId),coverage=templateSelectorCoverage(context,scope.selector);issues.push(...context.issues.map(issue=>issue.message));if(coverage.message)issues.push(coverage.message);if(!coverage.identities.size)issues.push('范围未命中合法规格。');if(scope.nodeId&&!context.byNode.has(scope.nodeId))issues.push('绑定节点已不属于指定模型版本。')}
  }else if(scope.kind==='products'){
    if(!Array.isArray(scope.familyIds)||!Array.isArray(scope.skuIds)||!scope.familyIds.length&&!scope.skuIds.length||binding.mode==='default')issues.push('请明确选择真实 SPU/SKU 范围，商品范围使用替换或不使用。')
    else {for(const id of scope.familyIds)if(!data.families.some(item=>item.id===id))issues.push(`商品范围 SPU ${id} 已失效。`);for(const id of scope.skuIds)if(!data.skus.some(item=>item.id===id&&isRealSku(data,item)))issues.push(`商品范围 SKU ${id} 已失效。`)}
  }else issues.push('未知绑定范围不可执行。')
  if(binding.mode==='none'){if(binding.planId!==null||binding.planVersion!==null)issues.push('不使用方案不能同时指定方案版本。')}
  else {const plan=data.salesOptionPlans?.find(item=>item.id===binding.planId);if(!plan||plan.schemaVersion!==1||!Array.isArray(plan.versions)||!plan.versions.some(version=>version.version===binding.planVersion&&!salesPlanVersionProblems(version).length))issues.push('请选择已发布的有效方案版本。')}
  return [...new Set(issues)]
}

export function relationProblems(data:AppData,relation:SalesProductRelation):string[]{
  if(!obj(relation)||relation.schemaVersion!==1)return ['不支持的商品关联版本，原内容只读保留。']
  if(!relationShape(relation))return ['商品关联结构或条件无效。']
  if(typeof relation.id!=='string'||!integer(relation.revision)||typeof relation.enabled!=='boolean'||!['recommendation','applicability'].includes(relation.kind)||!['compatible','conditional','incompatible'].includes(relation.conclusion)||!['pending','confirmed'].includes(relation.verification)||!Array.isArray(relation.conditions)||typeof relation.source!=='string'||!relation.source.trim()||typeof relation.note!=='string')return ['商品关联的身份、类型、条件或来源依据无效。']
  const issues:string[]=[]
  for(const id of [relation.sourceSkuId,relation.targetSkuId])if(!data.skus.some(sku=>sku.id===id&&isRealSku(data,sku)))issues.push('关联两端必须是真实销售 SKU。')
  if(relation.sourceSkuId===relation.targetSkuId)issues.push('同一 SKU 不建立指向自己的商品关联。')
  for(const condition of relation.conditions){const problem=conditionProblem(condition);if(problem)issues.push(problem);if(condition.kind==='attribute'&&!data.params.some(param=>param.id===condition.attributeId))issues.push('关联条件的真实属性已失效。')}
  if(relation.kind==='applicability'&&relation.conclusion==='conditional'&&!relation.conditions.length)issues.push('有条件适用必须记录具体使用前提。')
  return issues
}

function matchBindings(data:AppData,source:SalesSourceResolution,familyId:string,bindings=data.salesOptionBindings||[]){
  return bindings.filter(binding=>bindingShape(binding)&&binding.enabled).filter(binding=>{
    const scope=binding.scope
    if(scope.kind==='products')return scope.skuIds.includes(source.skuId)||scope.familyIds.includes(familyId)
    if(source.state!=='resolved'||scope.modelId!==source.modelId||scope.versionId!==source.versionId)return false
    if(binding.mode==='default')return true
    return !!scope.selector&&templateSelectorCoverage(salesBindingContext(data,scope.modelId,scope.versionId),scope.selector).identities.has(source.identityKey)
  })
}
function resultForBindings(data:AppData,source:SalesSourceResolution,hits:SalesOptionBinding[]):SalesPlanResolution{
  const result:SalesPlanResolution={state:'unconfigured',message:'尚未配置选配方案，可浏览商品或维护商品范围绑定。',source,bindingIds:[]}
  const replacements=hits.filter(binding=>binding.mode!=='default'),chosen=replacements.length?replacements:hits
  if(!chosen.length)return result
  result.bindingIds=chosen.map(binding=>binding.id)
  const choices=new Set(chosen.map(binding=>salesSignature(binding.mode==='none'?['none']:[binding.planId,binding.planVersion])))
  if(choices.size>1)return {...result,state:'conflict',message:'此规格命中多个不同替换结果，请配置人员处理冲突后再正式使用。'}
  if(chosen[0]!.mode==='none')return {...result,state:'none',message:'此范围不展示选配方案，既有适用限制仍然有效。'}
  const owner=data.salesOptionPlans?.find(plan=>plan.id===chosen[0]!.planId),plan=Array.isArray(owner?.versions)?owner.versions.find(version=>version.version===chosen[0]!.planVersion):undefined
  if(!owner||owner.schemaVersion!==1||owner.status!=='available'||!plan||planProblems(data,plan).length)return {...result,state:'invalid',message:'此范围引用的销售方案已停用或失效，请维护方案。'}
  return {...result,state:'matched',message:'',plan:cloneSales(plan)}
}
export function resolveSalesPlan(data:AppData,skuId:string):SalesPlanResolution{
  const source=resolveSalesSource(data,skuId),familyId=data.skus.find(sku=>sku.id===skuId)?.familyId||''
  const result=resultForBindings(data,source,matchBindings(data,source,familyId))
  if(result.state==='unconfigured'&&source.state==='invalid')return {...result,state:'invalid',message:source.message}
  return result
}

export function salesConfigurationStamp(data:AppData){return salesSignature([data.salesOptionPlans,data.salesOptionBindings,data.salesProductRelations,data.specModelVersions,data.productSpecNodes,data.specCanvases,data.params,data.templateParams,data.templates,data.skus,data.families,data.productTypes,data.categories,data.planningRecords,data.businessDefinitions,data.productPlans,data.materialReceipts,data.compatibilities,data.deviceModels,data.deviceBindings])}
export function previewSalesBinding(data:AppData,binding:SalesOptionBinding):SalesBindingPreview{
  const result:SalesBindingPreview={stamp:salesSignature([salesConfigurationStamp(data),binding]),legalCount:0,skuCount:0,skuIds:[],samples:[],unresolved:[],issues:bindingProblems(data,binding),canApply:false,draftOnly:binding.scope?.kind==='model'&&!binding.scope.versionId}
  if(result.issues.length)return result
  const scope=binding.scope,sourceBySku=new Map<string,SalesSourceResolution>()
  const candidate={...data,salesOptionBindings:[...(data.salesOptionBindings||[]).filter(item=>item.id!==binding.id),{...binding,enabled:true}]}
  if(scope.kind==='model'){
    const context=salesBindingContext(data,scope.modelId,scope.versionId)
    const identities=scope.selector?templateSelectorCoverage(context,scope.selector).identities:new Set(context.combinations.map(combo=>combo.identityKey))
    result.issues.push(...context.issues.map(issue=>issue.message));result.legalCount=identities.size
    if(scope.versionId&&data.specModelVersions.find(version=>version.id===scope.versionId)?.status!=='published')result.issues.push('指定模型发布版本已停用，不能正式应用。')
    for(const sku of data.skus.filter(item=>isRealSku(data,item))){
      const source=resolveSalesSource(data,sku.id);sourceBySku.set(sku.id,source)
      if(source.modelId!==scope.modelId||source.versionId!==scope.versionId)continue
      if(source.state!=='resolved'){result.unresolved.push({id:sku.id,message:source.message});continue}
      if(identities.has(source.identityKey))result.skuIds.push(sku.id)
    }
    for(const combo of context.combinations.filter(item=>identities.has(item.identityKey))){
      const source:SalesSourceResolution={state:'resolved',skuId:'',modelId:scope.modelId,versionId:scope.versionId||'',identityKey:combo.identityKey,message:''}
      if(!result.draftOnly&&resultForBindings(candidate,source,matchBindings(candidate,source,'')).state==='conflict')result.issues.push(`规格「${combo.label}」命中多个替换结果。`)
      if(result.samples.length<20)result.samples.push({identityKey:combo.identityKey,label:combo.label,skuIds:result.skuIds.filter(id=>sourceBySku.get(id)?.identityKey===combo.identityKey)})
    }
  }else{
    result.skuIds=data.skus.filter(sku=>isRealSku(data,sku)&&(scope.skuIds.includes(sku.id)||scope.familyIds.includes(sku.familyId))).map(sku=>sku.id)
    for(const id of result.skuIds){const source=resolveSalesSource(data,id);if(source.state==='resolved')sourceBySku.set(id,source)}
    result.legalCount=new Set([...sourceBySku.values()].map(source=>salesSignature([source.modelId,source.versionId,source.identityKey]))).size
    result.samples=result.skuIds.slice(0,20).map(id=>({identityKey:sourceBySku.get(id)?.identityKey||`sku:${id}`,label:data.skus.find(sku=>sku.id===id)?.skuName||id,skuIds:[id]}))
  }
  for(const id of result.skuIds){const resolved=resolveSalesPlan(candidate,id);if(['conflict','invalid'].includes(resolved.state))result.issues.push(`${id}：${resolved.message}`)}
  result.skuCount=result.skuIds.length;result.issues=[...new Set(result.issues)]
  if(binding.mode!=='none'&&!data.salesOptionPlans?.some(plan=>plan.id===binding.planId&&plan.status==='available'))result.issues.push('方案尚未正式启用。')
  result.canApply=!result.draftOnly&&!result.issues.length&&!result.unresolved.length&&(scope.kind==='model'?result.legalCount>0:result.skuCount>0)
  return result
}

/** Unknown schemas are preserved but never dispatched to known-version execution. */
export function salesConfigurationImportProblems(data:unknown):string[]{
  if(!obj(data))return ['销售配置数据容器无效。']
  const issues:string[]=[]
  for(const field of ['salesOptionPlans','salesOptionBindings','salesProductRelations']){
    const rows=data[field];if(rows===undefined)continue
    if(!Array.isArray(rows)){issues.push(`${field} 必须为数组。`);continue}
    const ids=new Set<string>()
    for(const row of rows){
      if(!obj(row)||typeof row.id!=='string'||!row.id||ids.has(row.id)||!integer(row.schemaVersion,1)){issues.push(`${field} 身份或版本无效。`);continue}
      ids.add(row.id);if(row.schemaVersion!==1)continue
      if(!integer(row.revision,1)||typeof row.updatedAt!=='string')issues.push(`${field} 修订结构无效。`)
      if(!receiptsShape(row.receipts,Number(row.revision)))issues.push(`${field} 保存回执结构无效。`)
      if(field==='salesOptionPlans'){
        if(typeof row.name!=='string'||!row.name.trim()||typeof row.createdAt!=='string'||!Array.isArray(row.items)||!row.items.every(itemShape)||new Set(row.items.map(item=>item.id)).size!==row.items.length||benefitGroupRuleStructureIssues(row.rules).length||!Array.isArray(row.versions)||row.versions.some(version=>salesPlanVersionProblems(version).length)||!['draft','available','disabled'].includes(String(row.status)))issues.push('销售方案结构无效。')
        else if(row.versions.some(version=>version.planId!==row.id)||new Set(row.versions.map(version=>version.version)).size!==row.versions.length||!(row.publishedVersion===null||integer(row.publishedVersion,1)&&row.versions.some(version=>version.version===row.publishedVersion)))issues.push('销售方案发布版本身份无效。')
      }
      if(field==='salesOptionBindings'&&!bindingShape(row))issues.push('销售绑定结构无效。')
      if(field==='salesProductRelations'&&!relationShape(row))issues.push('商品关联结构无效。')
    }
  }
  return [...new Set(issues)]
}
