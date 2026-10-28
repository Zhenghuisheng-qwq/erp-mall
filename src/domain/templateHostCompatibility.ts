import { hostFrom } from './compatibility'
import { createDeviceResolutionContext, deviceHostKey, resolveDeviceSku } from './deviceResolution'
import { modelSpecificationContext, resolveSkuModelSource } from './modelSourceContext'
import { selectorForNode, templateSelectorCoverage } from './templateCompatibility'
import type { AppData, PlanningStep } from './types'
import type { DeviceResolution } from './accessoryCompatibilityTypes'
import type { TemplateSpecSelector } from './templateCompatibilityTypes'

/** Direction needs an explicitly recorded product role. No category/name fallback. */
export function templateBusinessRole(data:AppData,modelId:string){
  return templateProductType(data,modelId)?.catalogRole||'unknown'
}
export function templateProductType(data:AppData,modelId:string){
  const ids=new Set(data.specCanvases.filter(item=>item.templateId===modelId).map(item=>item.productTypeId).filter(Boolean))
  if(ids.size!==1)return undefined
  return data.productTypes.find(item=>item.id===[...ids][0])
}
export interface TemplateDeviceChoice {key:string;label:string;groupKey:string;groupLabel:string;device:DeviceResolution;identityKey:string;skuId?:string}
export function templateHostChoices(data:AppData,input:{modelId:string;versionId?:string|null;nodeId?:string;selector?:TemplateSpecSelector}){
  const result={choices:[] as TemplateDeviceChoice[],issues:[] as string[],legalCount:0,skuCount:0}
  if(templateBusinessRole(data,input.modelId)!=='host'){result.issues.push(templateBusinessRole(data,input.modelId)==='other'?'此类型业务用途为「其他」，不提供主机反查配件。':'模板尚未明确登记为主机类型，请维护产品类型业务用途；不能按名称推测适配方向。');return result}
  const context=modelSpecificationContext(data,input.modelId,input.versionId)
  if(context.issues.length){result.issues.push(...context.issues.map(item=>item.message));return result}
  let selector=input.selector
  if(!selector&&input.nodeId){
    if(context.byNode.get(input.nodeId)?.nodeType!=='VALUE'){result.issues.push('请先明确选择真实属性值或完整合法规格范围。');return result}
    const scope=selectorForNode(context,input.nodeId);selector=scope.selector;if(scope.message)result.issues.push(scope.message)
  }
  const coverage=selector?templateSelectorCoverage(context,selector):undefined
  if(coverage?.message){result.issues.push(coverage.message);return result}
  const combos=context.combinations.filter(item=>!coverage||coverage.identities.has(item.identityKey));result.legalCount=combos.length
  const devices=createDeviceResolutionContext(data),identities=new Set(combos.map(combo=>combo.identityKey))
  const actual=new Map<string,{skuId:string;resolution:DeviceResolution}[]>()
  for(const sku of data.skus){const source=resolveSkuModelSource(data,sku.id);if(source.state!=='resolved'||source.modelId!==input.modelId||source.versionId!==(input.versionId||null)||!identities.has(source.identityKey))continue;const list=actual.get(source.identityKey)||[];list.push({skuId:sku.id,resolution:resolveDeviceSku(data,sku.id,devices)});actual.set(source.identityKey,list);result.skuCount++}
  const identityIds=new Set(data.params.filter(item=>item.identityRole==='host-model').map(item=>item.id)),typeId=data.specCanvases.find(item=>item.templateId===input.modelId)?.productTypeId||''
  for(const combo of combos){
    const rows=actual.get(combo.identityKey)||[]
    if(rows.length){for(const {skuId,resolution} of rows){if(resolution.status!=='resolved'||!resolution.host){result.issues.push(`${combo.label}：${resolution.message}`);continue}const sku=devices.skus.get(skuId)!;result.choices.push({key:`sku:${skuId}`,label:`${sku.code} · ${combo.label}`,groupKey:deviceHostKey(resolution.host),groupLabel:resolution.host.steps.map(step=>step.valueId).join(' · '),device:resolution,identityKey:combo.identityKey,skuId})}continue}
    const identity=combo.steps.find(step=>identityIds.has(step.attributeId)),byNode=new Map(combo.steps.map(step=>[step.valueNodeId,step])),chain:PlanningStep[]=[]
    let current=identity;const seen=new Set<string>()
    while(current&&!seen.has(current.valueNodeId)){chain.unshift(current);seen.add(current.valueNodeId);current=current.parentValueNodeId?byNode.get(current.parentValueNodeId):undefined}
    const host=chain.length?hostFrom(typeId,input.modelId,chain):undefined
    const option=host?devices.hostOptions.find(item=>item.key===deviceHostKey(host)&&(!input.versionId||item.versionIds.includes(input.versionId))):undefined
    if(!option){result.issues.push(`${combo.label}：尚无法准确对应此版本的设备身份，需要核对。`);continue}
    const plans=data.planningRecords.filter(record=>record.productModelId===input.modelId&&record.identityKey===combo.identityKey&&!!input.versionId&&(record.modelVersionId===input.versionId||record.originModelVersionId===input.versionId||record.modelVersionIds.includes(input.versionId)))
    const device:DeviceResolution={status:'resolved',skuId:'',host:option.host,planningId:plans.length===1?plans[0]!.planningId:undefined,candidates:[option],attributes:Object.fromEntries(combo.steps.map(step=>[step.attributeId,step.valueId])),message:'',source:'当前明确版本的合法规格；未创建商品',sourceStamp:''}
    result.choices.push({key:`combination:${combo.identityKey}`,label:combo.label,groupKey:option.key,groupLabel:option.label,device,identityKey:combo.identityKey})
  }
  result.issues=[...new Set(result.issues)]
  return result
}
