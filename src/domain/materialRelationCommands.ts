import { branchFailure, withFailure } from './guide/failure'
import type { GuideFailure } from './guide/types'
import { isMaterialArchive } from './catalogIdentity'
import { nextMaterialCode, materialCodeConflict } from './material'
import { businessPath, resolveNodeBusiness } from './nodeBusiness'
import { legalPlanningCombinations } from './planning'
import { suggestMaterialName, filedNameSource } from './naming'
import { activeMaterialRelations } from './materialRelations'
import { configStructureProblem } from './nodeBusinessStructure'
import type { MaterialScope, MaterialRelation } from './materialRelations'
import type { AppData, PlanningStep } from './types'

const clone = <T>(v:T):T => JSON.parse(JSON.stringify(v))
const sourceKey = (s:MaterialScope) => JSON.stringify([s.kind,s.modelId,s.versionId,s.planningId||'',s.anchorNodeId||'',s.scope])
export const materialRelationBasis = (d:AppData) => JSON.stringify([d.materialRelations,d.skus,d.families,d.materialReceipts,d.specModelVersions,d.planningRecords,d.specCanvases,d.productTypes,d.params])
export function materialRelationImportSignature(d:AppData) {
  const ids=new Set((Array.isArray(d.materialRelations)?d.materialRelations:[]).map(r=>r?.materialId))
  return JSON.stringify([d.materialRelations,d.skus.filter(s=>ids.has(s.id)),d.materialReceipts?.filter(r=>ids.has(r.skuId))])
}
const requestIntent = (input:{source:MaterialScope;materialId?:string;name?:string}) => JSON.stringify([sourceKey(input.source),input.materialId||'',input.materialId?'':input.name?.trim()||''])
export function previewMaterialScope(data:AppData,source:MaterialScope,materialId='') {
  const problems:string[]=[], version=data.specModelVersions.find(v=>v.id===source.versionId&&v.templateId===source.modelId&&v.status==='published')
  const failures:GuideFailure[]=[]
  let firstFailure:GuideFailure|undefined
  const reject=(branch:string,message:string)=>{const failure=branchFailure(branch,message,{savedState:'unchanged',context:{modelId:source.modelId,versionId:source.versionId,materialId,planningId:source.planningId||'',nodeId:source.anchorNodeId||''},recovery:['view-related','edit-input']});if(!problems.length)firstFailure=failure;failures.push(failure);problems.push(message)}
  const canvas=data.specCanvases.find(c=>c.templateId===source.modelId),type=data.productTypes.find(t=>t.id===canvas?.productTypeId)
  const nodes=version?.nodesSnapshot || [], all=version?legalPlanningCombinations(data,source.modelId,nodes):[]
  if(!version||!type)reject('material.scope.source','请选择真实的已发布模型版本及产品类型。')
  if((data.materialRelations||[]).some(r=>r.kind!=='scope-v1'&&(r.source.modelId===source.modelId||r.materialId===materialId)))problems.push('存在不支持的未来关联，原文保留；请先确认其语义，不能忽略后执行。')
  let combinations=all, prefix:PlanningStep[]=[]
  if(source.kind==='planning') {
    if(source.anchorNodeId!==undefined)problems.push('完整规划来源不能混入节点锚点。')
    const p=data.planningRecords.find(p=>p.planningId===source.planningId&&p.productModelId===source.modelId&&p.origin!=='temporary'&&p.modelVersionIds.includes(source.versionId))
    combinations=all.filter(c=>c.identityKey===p?.identityKey)
    if(!p||p.status!=='active'||combinations.length!==1)reject('material.scope.planning','完整规划不属于指定版本的有效合法组合。')
    prefix=combinations[0]?.steps || []
    if(source.scope!=='current')problems.push('完整规划使用 current 精确范围。')
  } else if(source.kind==='node') {
    if(source.planningId!==undefined)problems.push('节点范围不能冒充完整 PLN 来源。')
    const anchor=nodes.find(n=>n.id===source.anchorNodeId&&n.nodeType==='VALUE')
    if(!anchor)problems.push('锚点必须是指定发布版本中的 VALUE 节点。')
    const path=businessPath(nodes,anchor?.id||'').filter(n=>n.nodeType==='VALUE')
    combinations=all.filter(c=>path.length&&path.every(n=>c.steps.some(s=>s.valueNodeId===n.id)))
    prefix=path.flatMap(n=>{const step=combinations[0]?.steps.find(s=>s.valueNodeId===n.id);return step?[step]:[]})
    if(!combinations.length||prefix.length!==path.length)problems.push('无法证明节点前缀与完整合法规划的关系。')
    if(!['current','subtree'].includes(source.scope))problems.push('请选择 current 或 subtree 范围。')
  } else { combinations=[];problems.push('不支持的来源类型，原文保留。') }
  const proof=combinations.flatMap(c=>{
    const plans=data.planningRecords.filter(p=>p.productModelId===source.modelId&&p.identityKey===c.identityKey&&p.modelVersionIds.includes(source.versionId)&&p.origin!=='temporary')
    if(plans.length!==1){problems.push(`路径 ${c.label} 缺少唯一的真实 PLN。`);return []}
    return [{planningId:plans[0]!.planningId,identityKey:c.identityKey,steps:c.steps,label:c.label}]
  })
  const anchorId=source.anchorNodeId || prefix.at(-1)?.valueNodeId || ''
  const policy=resolveNodeBusiness(data,nodes,anchorId,'material-policy')
  if(source.kind==='planning') {
    const leaves=prefix.filter(s=>!prefix.some(other=>other.valueNodeId!==s.valueNodeId&&businessPath(nodes,other.valueNodeId).some(n=>n.id===s.valueNodeId)))
    const resolutions=leaves.map(s=>resolveNodeBusiness(data,nodes,s.valueNodeId,'material-policy')).filter(r=>r.state!=='none')
    const values=new Set(resolutions.map(r=>r.parameters?.value).filter(Boolean))
    policy.hits=[...new Map(resolutions.flatMap(r=>r.hits).map(h=>[h.config.id,h])).values()]
    policy.sources=[...new Set(resolutions.flatMap(r=>r.sources))]
    policy.message=resolutions.map(r=>r.message).filter(Boolean).join('；')
    policy.state=resolutions.some(r=>r.state==='invalid'||r.state==='conflict')?'invalid':values.size>1?'conflict':values.size===1?'effective':'none'
    policy.parameters=policy.state==='effective'?resolutions.find(r=>r.parameters)?.parameters:undefined
    if(values.size>1)policy.message='完整规划的不同实际分支物料策略冲突，不能任选一个分支。'
  }
  if(policy.state!=='effective')problems.push(policy.message||'物料策略待配置：请配置并发布独立／共用策略。')
  const policyValue=String(policy.parameters?.value||'')
  if(materialId&&policyValue!=='shared')problems.push('关联已有物料需要明确的共用策略。')
  if(source.kind==='node'&&source.scope==='subtree'&&proof.length>1&&policyValue!=='shared')problems.push('跨多个完整规划的范围建档需要共用策略。')
  if(source.scope==='subtree')for(const c of proof)for(const step of c.steps){
    if(!businessPath(nodes,step.valueNodeId).some(n=>n.id===anchorId))continue
    const child=resolveNodeBusiness(data,nodes,step.valueNodeId,'material-policy')
    if(child.state==='conflict'||child.state==='invalid'||child.parameters&&child.parameters.value!==policyValue)problems.push(`${c.label}：${child.message||'下级物料策略不同，范围执行不能隐式覆盖。'}`)
  }
  const target=data.skus.find(s=>s.id===materialId),family=data.families.find(f=>f.id===target?.familyId)
  if(materialId&&(!target||!isMaterialArchive(data,target)))problems.push('关联目标不是有效的真实 MAT 档案。')
  if(materialId&&(family?.productTypeId!==type?.id||family?.categoryId!==type?.categoryId))problems.push('仅允许同产品类型、同分类内明确复用，不按名称跨类型关联。')
  const suggestion=suggestMaterialName(data,{productModelId:source.modelId,modelVersionId:source.versionId,productTypeName:type?.name||'',steps:prefix})
  const coverage=source.kind==='node'&&source.scope==='current'?[]:proof.map(({label,...p})=>p)
  const earlier=activeMaterialRelations(data).filter(r=>r.materialId===materialId&&r.source.modelId===source.modelId&&r.source.versionId!==source.versionId&&r.source.kind===source.kind&&(source.kind==='node'?r.source.anchorNodeId===source.anchorNodeId:r.source.planningId===source.planningId))
  const previousIds=new Set(earlier.flatMap(r=>r.coverage.map(c=>c.planningId)))
  return {failure:firstFailure,failures,source:clone(source),materialId,basis:materialRelationBasis(data),problems:[...new Set(problems)],prefix,coverage,proof,policy:policy.hits.map(h=>clone(h.config)),policyValue,policySources:policy.sources,suggestion,type,
    versionName:version?.versionName||'',previous:earlier.map(r=>r.id),added:coverage.filter(c=>!previousIds.has(c.planningId)).map(c=>c.planningId),removed:[...previousIds].filter(id=>!coverage.some(c=>c.planningId===id))}
}
export type MaterialScopePreview=ReturnType<typeof previewMaterialScope>
export function executeMaterialRelation(data:AppData,input:{source:MaterialScope;materialId?:string;name?:string;requestId:string;basis:string;confirmVersionChange?:boolean},nextId:(prefix:string)=>string) {
  const fail=(message:string)=>({ok:false as const,message,materialId:'',relationId:''})
  if(!input.requestId.trim())return fail('缺少请求 ID。')
  const receipt=(data.materialRelations||[]).find(r=>r.requestId===input.requestId||r.requestAliases?.some(a=>a.requestId===input.requestId))
  if(receipt){
    const intent=receipt.requestId===input.requestId?receipt.requestIntent:receipt.requestAliases?.find(a=>a.requestId===input.requestId)?.intent
    if(intent?intent!==requestIntent(input):sourceKey(receipt.source)!==sourceKey(input.source)||(receipt.original?!!input.materialId:receipt.materialId!==input.materialId))return fail('请求 ID 已用于其他关系，不能改写原请求。')
    if(receipt.lifecycle!=='active'||!data.skus.some(s=>s.id===receipt.materialId))return fail('原请求已解除或物料已删除，请发起新的请求。')
    return {ok:true as const,message:'原请求已完成。',materialId:receipt.materialId,relationId:receipt.id}
  }
  if(data.materialReceipts.some(r=>r.requestId===input.requestId))return fail('该请求已用于原物料建档，不能改作新的范围关联请求。')
  if(input.basis!==materialRelationBasis(data))return fail('预览后数据已变化，请重新预览并确认；没有写入。')
  const p=previewMaterialScope(data,input.source,input.materialId)
  if(p.problems.length){const result=fail(p.problems.join(' '));return p.failure?withFailure(result,{...p.failure,message:result.message}):result}
  if(p.previous.length&&!input.confirmVersionChange)return fail('请确认新版本范围变化；旧版本关系不会扩张。')
  const same=activeMaterialRelations(data).find(r=>r.materialId===input.materialId&&sourceKey(r.source)===sourceKey(input.source))
  if(same){
    ;(same.requestAliases||=[]).push({requestId:input.requestId,intent:requestIntent(input)})
    return {ok:true as const,message:'该关系已存在，请求回执已保存。',materialId:same.materialId,relationId:same.id}
  }
  const now=new Date().toISOString(),id=nextId('matrel')
  let sku=data.skus.find(s=>s.id===input.materialId)
  if(!sku){
    if(input.source.kind!=='node')return fail('完整规划请沿用创建物料入口。')
    const name=input.name?.trim() || (p.suggestion.canAuto?p.suggestion.name:'')
    if(!name)return fail(p.suggestion.message||'请填写物料名称。')
    const materialCode=nextMaterialCode(data),conflict=materialCodeConflict(data,materialCode)
    if(conflict)return fail(conflict)
    const familyId=nextId('fam'),attrs=Object.fromEntries(p.prefix.map(s=>[s.attributeName,s.valueId]))
    data.families.push({id:familyId,name,templateId:input.source.modelId,productModelId:input.source.modelId,modelVersionId:input.source.versionId,productTypeId:p.type!.id,categoryId:p.type!.categoryId,line:'v3',commonAttrs:{},commonSignature:`node-scope:${id}`,oaProductId:'',productGroupIds:[],lifecycle:'draft',shelfStatus:'draft',createdAt:now,updatedAt:now,origin:'created'})
    sku={id:nextId('sku'),recordKind:'material',familyId,code:'',oaSkuId:'',status:'draft',variantAttrs:attrs,projectedAttrs:{...attrs},skuName:name,materialCode,modelVersionId:input.source.versionId,sourceNodeIds:p.prefix.map(s=>s.valueNodeId),nameSource:filedNameSource(p.suggestion,input.name||''),namingNodeId:p.suggestion.nodeId,suggestedName:p.suggestion.canAuto?p.suggestion.name:undefined,createdAt:now,updatedAt:now}
    data.skus.push(sku);data.materialReceipts.push({requestId:input.requestId,skuId:sku.id,planningId:'',materialCode,createdTime:now,lifecycle:'active'})
  }
  const relation:MaterialRelation={id,kind:'scope-v1',materialId:sku.id,source:clone(input.source),prefix:clone(p.prefix),coverage:clone(p.coverage),policy:clone(p.policy),createdAt:now,lifecycle:'active',original:!input.materialId,requestId:input.requestId,requestIntent:requestIntent(input)}
  ;(data.materialRelations||=[]).push(relation)
  return {ok:true as const,message:input.materialId?'已建立关联，原始建档来源不变。':'已按节点范围建档，未创建或裁剪 PLN。',materialId:sku.id,relationId:id}
}
export function revokeMaterialRelation(data:AppData,id:string,basis:string){
  if(basis!==materialRelationBasis(data))return {ok:false,message:'数据已变化，请刷新后重新确认。'}
  const relation=(data.materialRelations||[]).find(r=>r.id===id)
  if(!relation||relation.kind!=='scope-v1'||relation.original)return {ok:false,message:'原始建档或不支持的关系不能作为普通关联解除。'}
  if(relation.lifecycle==='revoked')return {ok:true,message:'本条关联已解除。'}
  relation.lifecycle='revoked';relation.revokedAt=new Date().toISOString()
  return {ok:true,message:'已解除本条新增关联，物料和其他来源保留。'}
}

/** Optional records are never migrated or repaired by silently dropping content. */
export function materialRelationImportProblems(data:AppData):string[]{
  const problems:string[]=[],obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v),str=(v:unknown)=>typeof v==='string'&&!!v.trim()
  for(const key of ['materialRelations'] as const)if(data[key]!==undefined&&!Array.isArray(data[key]))problems.push(`${key} 必须是数组。`)
  if(problems.length)return problems
  const ids=new Set<string>()
  const requests=new Set<string>()
  for(const r of data.materialRelations||[]){
    if(!obj(r)||!['id','kind','materialId','requestId','createdAt','lifecycle'].every(k=>str(r[k]))||!obj(r.source)||!Array.isArray(r.prefix)||!Array.isArray(r.coverage)||!Array.isArray(r.policy)||typeof r.original!=='boolean'){problems.push('物料关联记录结构损坏。');continue}
    if(ids.has(r.id))problems.push(`重复关联 ID ${r.id}`);ids.add(r.id)
    if(requests.has(r.requestId))problems.push(`重复关联请求 ${r.requestId}`);requests.add(r.requestId)
    if(r.requestAliases!==undefined&&(!Array.isArray(r.requestAliases)||r.requestAliases.some(a=>!obj(a)||!str(a.requestId)||!str(a.intent)))){problems.push(`关联 ${r.id} 请求回执结构损坏。`);continue}
    const validIntent=(intent:unknown,alias:boolean)=>{if(typeof intent!=='string')return false;try{const v=JSON.parse(intent);return Array.isArray(v)&&v.length===3&&v[0]===sourceKey(r.source)&&v[1]===(alias||!r.original?r.materialId:'')&&typeof v[2]==='string'&&(!(alias||!r.original)||v[2]==='')}catch{return false}}
    if(r.requestIntent!==undefined&&!validIntent(r.requestIntent,false))problems.push(`关联 ${r.id} 原请求意图损坏。`)
    for(const a of r.requestAliases||[]){if(requests.has(a.requestId)||!validIntent(a.intent,true))problems.push(`关联 ${r.id} 重复或无效的请求回执。`);requests.add(a.requestId)}
    if(r.kind!=='scope-v1')continue
    if(!['active','revoked'].includes(r.lifecycle)||!['planning','node'].includes(r.source.kind)||!str(r.source.modelId)||!str(r.source.versionId)||!['current','subtree'].includes(r.source.scope)||!(r.source.kind==='node'?str(r.source.anchorNodeId):str(r.source.planningId))){problems.push(`关联 ${r.id} 来源结构损坏。`);continue}
    const validSteps=(steps:unknown)=>Array.isArray(steps)&&steps.every(s=>obj(s)&&['valueNodeId','attributeNodeId','attributeId','attributeName','valueId','role','roleSource'].every(k=>str(s[k]))&&(s.parentValueNodeId===null||str(s.parentValueNodeId)))
    if(!validSteps(r.prefix)||!r.coverage.every(c=>obj(c)&&str(c.planningId)&&str(c.identityKey)&&validSteps(c.steps))){problems.push(`关联 ${r.id} 范围依据损坏。`);continue}
    if(!r.policy.length||r.policy.some(c=>configStructureProblem(c))){problems.push(`关联 ${r.id} 策略冻结结构损坏。`);continue}
    const version=data.specModelVersions?.find(v=>v.id===r.source.versionId&&v.templateId===r.source.modelId&&v.status==='published')
    if(!version||!r.prefix.every(s=>version.nodesSnapshot.some(n=>n.id===s.valueNodeId&&n.attributeId===s.attributeId&&n.valueId===s.valueId)))problems.push(`关联 ${r.id} 发布版本或节点引用无效。`)
    const sku=data.skus.find(s=>s.id===r.materialId)
    if(r.lifecycle==='active'&&(!sku||!isMaterialArchive(data,sku)))problems.push(`关联 ${r.id} 目标不是有效 MAT。`)
    if(version){const combos=legalPlanningCombinations(data,r.source.modelId,version.nodesSnapshot)
      if(r.source.kind==='planning'&&r.source.anchorNodeId!==undefined||r.source.kind==='node'&&r.source.planningId!==undefined)problems.push(`关联 ${r.id} 混用了完整规划和节点范围来源。`)
      if(r.policy.some(c=>!version.nodesSnapshot.some(n=>n.id===c.nodeId&&n.businessConfigs?.some(saved=>saved.id===c.id&&saved.definitionId===c.definitionId&&saved.scope===c.scope&&saved.enabled===c.enabled&&JSON.stringify(saved.parameters)===JSON.stringify(c.parameters)))))problems.push(`关联 ${r.id} 策略来源不属于指定发布版本。`)
      if(r.coverage.some(c=>!data.planningRecords.some(p=>p.planningId===c.planningId&&p.productModelId===r.source.modelId&&p.modelVersionIds.includes(version.id)&&p.identityKey===c.identityKey)||!combos.some(x=>x.identityKey===c.identityKey&&JSON.stringify(x.steps)===JSON.stringify(c.steps))))problems.push(`关联 ${r.id} 完整规划证明无效。`)
      const path=r.source.kind==='node'?businessPath(version.nodesSnapshot,r.source.anchorNodeId||'').filter(n=>n.nodeType==='VALUE'):[]
      const plan=data.planningRecords.find(p=>p.planningId===r.source.planningId&&p.productModelId===r.source.modelId&&p.modelVersionIds.includes(version.id))
      const matches=combos.filter(c=>r.source.kind==='node'?path.length&&path.every(n=>c.steps.some(s=>s.valueNodeId===n.id)):c.identityKey===plan?.identityKey)
      const expectedPrefix=r.source.kind==='node'?path.flatMap(n=>matches[0]?.steps.filter(s=>s.valueNodeId===n.id)||[]):matches[0]?.steps||[]
      const expectedCoverage=r.source.kind==='node'&&r.source.scope==='current'?[]:matches.map(c=>c.identityKey).sort()
      if(!expectedPrefix.length||JSON.stringify(expectedPrefix)!==JSON.stringify(r.prefix)||JSON.stringify(expectedCoverage)!==JSON.stringify(r.coverage.map(c=>c.identityKey).sort())||r.source.kind==='planning'&&r.source.scope!=='current')problems.push(`关联 ${r.id} 锚点、前缀或覆盖范围与快照不一致。`)
      const type=data.specCanvases?.find(c=>c.templateId===r.source.modelId)?.productTypeId,family=data.families.find(f=>f.id===sku?.familyId)
      if(sku&&family?.productTypeId!==type)problems.push(`关联 ${r.id} 跨产品类型引用无效。`)
    }
  }
  return problems
}
