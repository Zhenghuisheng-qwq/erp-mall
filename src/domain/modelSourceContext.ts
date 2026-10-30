import {isRealSku} from './catalogIdentity'
import {actualSkuAttributes} from './actualSkuAttributes'
import {legalPlanningCombinations} from './planning'
import type {SpecModelVersion} from './types'
import type {AppData} from './types'
export interface SkuModelSourceResolution {state:'resolved'|'legacy'|'invalid';skuId:string;modelId:string;versionId:string;identityKey:string;message:string}

/** Read only frozen structural metadata from older publications; never interpret retired declarations. */
export function specificationMetadata(version?:SpecModelVersion){
 const raw=version?.templateCompatibilitySnapshot as {attributeRoles?:SpecModelVersion['attributeRoles'];attributeNames?:SpecModelVersion['attributeNames']}|undefined
 return {attributeRoles:(version?.attributeRoles||(Array.isArray(raw?.attributeRoles)?raw.attributeRoles:[])).filter(r=>r&&typeof r.attributeNodeId==='string'&&(r.role==='COMMON'||r.role==='VARIANT')),attributeNames:(version?.attributeNames||(Array.isArray(raw?.attributeNames)?raw.attributeNames:[])).filter(r=>r&&typeof r.attributeId==='string'&&typeof r.name==='string')}
}
export function modelSpecificationContext(data:AppData,modelId:string,versionId?:string|null){
 const version=versionId?data.specModelVersions.find(v=>v.id===versionId&&v.templateId===modelId):undefined
 const issues:{message:string}[]=[]
 if(versionId&&!version)issues.push({message:'指定发布版本不存在，不会使用当前草稿或其他版本。'})
 const metadata=specificationMetadata(version),roles=new Map(metadata.attributeRoles.map(r=>[r.attributeNodeId,r.role])),names=new Map(metadata.attributeNames.map(a=>[a.attributeId,a.name]))
 const nodes=(version?version.nodesSnapshot:versionId?[]:data.productSpecNodes.filter(n=>n.templateId===modelId)).map(n=>n.nodeType==='ATTRIBUTE'&&roles.has(n.id)?{...n,role:roles.get(n.id)!}:n)
 const combinations=issues.length?[]:legalPlanningCombinations(data,modelId,nodes)
 if(metadata.attributeNames.length)for(const combo of combinations){for(const step of combo.steps){step.attributeName=names.get(step.attributeId)||step.attributeId;step.roleSource=metadata.attributeRoles.find(r=>r.attributeNodeId===step.attributeNodeId)?.roleSource||step.roleSource;}combo.label=combo.steps.map(s=>`${s.attributeName} ${s.valueId}`).join(' · ')}
 return {modelId,versionId:versionId||'',nodes,byNode:new Map(nodes.map(n=>[n.id,n])),combinations,issues}
}

export function resolveSkuModelSource(data:AppData,skuId:string):SkuModelSourceResolution {
  const result:SkuModelSourceResolution={state:'invalid',skuId,modelId:'',versionId:'',identityKey:'',message:''}
  const sku=data.skus.find(item=>item.id===skuId),family=sku&&data.families.find(item=>item.id===sku.familyId)
  if(!sku||!family||!isRealSku(data,sku))return {...result,message:'来源不是有效的真实销售 SKU。'}
  const ownVersions=[...new Set([sku.modelVersionId,sku.creationSource?.modelVersionId].filter((id):id is string=>!!id))]
  if(ownVersions.length>1)return {...result,message:'SKU 的发布版本来源互相矛盾，请先核对来源。'}
  const versionId=sku.creationSource?sku.creationSource.modelVersionId:ownVersions[0]||(sku.sourceNodeIds?.length||sku.planningId?family.modelVersionId:'')||''
  const modelId=sku.creationSource?.templateId||family.productModelId||family.templateId
  Object.assign(result,{modelId,versionId})
  if(!versionId)return {...result,state:'legacy',message:'未记录发布规格来源。'}
  const version=data.specModelVersions.find(item=>item.id===versionId&&item.templateId===modelId)
  if(!version||version.status!=='published')return {...result,message:'来源发布版本不存在或已停用，不会按最新草稿反推。'}
  const context=modelSpecificationContext(data,modelId,versionId)
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
  const actual=actualSkuAttributes(data,family,sku,specificationMetadata(version).attributeNames)
  matches=matches.filter(combo=>combo.steps.every(step=>!actual.conflicts.includes(step.attributeId)&&(actual.attributes[step.attributeId]===undefined||actual.attributes[step.attributeId]===step.valueId)))
  if(matches.length!==1)return {...result,message:`来源规格无法唯一解析（命中 ${matches.length} 个合法规格），请核对真实节点和属性来源。`}
  return {...result,state:'resolved',identityKey:matches[0]!.identityKey,message:''}
}
