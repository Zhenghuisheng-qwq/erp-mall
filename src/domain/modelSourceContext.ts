import {isRealSku} from './catalogIdentity'
import {actualSkuAttributes} from './actualSkuAttributes'
import {createEmptyTemplateCompatibilityConfig,createTemplateCompatibilityContext} from './templateCompatibility'
import type {AppData} from './types'
export interface SkuModelSourceResolution {state:'resolved'|'legacy'|'invalid';skuId:string;modelId:string;versionId:string;identityKey:string;message:string}

/** Read frozen model nodes and roles independently of compatibility declarations. */
export function modelSpecificationContext(data:AppData,modelId:string,versionId?:string|null){
  const source={...data,templateCompatibilityConfigs:[],specModelVersions:data.specModelVersions.map(version=>version.id===versionId&&version.templateCompatibilitySnapshot?{...version,templateCompatibilitySnapshot:{...version.templateCompatibilitySnapshot,config:createEmptyTemplateCompatibilityConfig(modelId)}}:version)}
  return createTemplateCompatibilityContext(source,{modelId,versionId:versionId||undefined,config:createEmptyTemplateCompatibilityConfig(modelId)})
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
  const actual=actualSkuAttributes(data,family,sku,version.templateCompatibilitySnapshot?.attributeNames||[])
  matches=matches.filter(combo=>combo.steps.every(step=>!actual.conflicts.includes(step.attributeId)&&(actual.attributes[step.attributeId]===undefined||actual.attributes[step.attributeId]===step.valueId)))
  if(matches.length!==1)return {...result,message:`来源规格无法唯一解析（命中 ${matches.length} 个合法规格），请核对真实节点和属性来源。`}
  return {...result,state:'resolved',identityKey:matches[0]!.identityKey,message:''}
}

