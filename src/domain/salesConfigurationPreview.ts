import {cloneBenefit,newBenefitPackageDraft,validateBenefitPackage} from './benefitPackages'
import {compatibilityRecordRole} from './deviceResolution'
import {planProblems,previewSalesBinding,salesSignature} from './salesConfiguration'
import {addSalesCandidate,querySalesCandidates,removeSalesPosition} from './salesSelection'
import {salesSkuAdmission} from './salesCatalog'
import type {AppData} from './types'
import type {BenefitPackageDraft} from './benefitPackageTypes'
import type {SalesCandidate,SalesOptionBinding,SalesOptionPlan,SalesOptionPlanVersion} from './salesConfigurationTypes'

export interface SalesConfigurationPreviewInput {
  planDraft?: SalesOptionPlan
  bindings: SalesOptionBinding[]
}
export const SALES_DRAFT_PREVIEW_PREFIX='preview:draft:'
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value))

/** Scope counts must not require the unfinished rule draft to be publishable. */
export function previewSalesConfigurationScope(data:AppData,binding:SalesOptionBinding){
  const id=`${SALES_DRAFT_PREVIEW_PREFIX}scope-only`
  const item={id:'scope-only-service',name:'范围计算',enabled:true,order:0,scope:{kind:'service' as const,ids:[] as string[]},recommended:false,required:false,minKinds:0,maxKinds:1,defaultQuantity:1,minQuantity:1,maxQuantity:1,checkTarget:'none' as const,source:'',note:'',service:{unit:'项',measurement:'per-package' as const,validity:'',description:''}}
  const version:SalesOptionPlanVersion={schemaVersion:1,planId:id,version:1,name:'范围计算',items:[item],rules:[],publishedAt:'2000-01-01T00:00:00.000Z'}
  const plan:SalesOptionPlan={schemaVersion:1,id,name:'范围计算',revision:0,status:'available',items:[item],rules:[],publishedVersion:1,versions:[version],createdAt:'',updatedAt:''}
  const candidate:AppData={...data,salesOptionPlans:[...(data.salesOptionPlans||[]).filter(item=>item.id!==id),plan],salesOptionBindings:[]}
  return previewSalesBinding(candidate,{...clone(binding),planId:binding.mode==='none'?null:id,planVersion:binding.mode==='none'?null:1})
}

/**
 * Private candidate overlay, never a Store command. Synthetic identities are explicitly
 * namespaced and marked as draft simulation, never presented as a published revision.
 * Only selected bindings move; unselected shared bindings retain their exact versions.
 */
export function createSalesConfigurationPreviewData(data:AppData,input:SalesConfigurationPreviewInput){
  const candidate:AppData={...data,salesOptionPlans:clone(data.salesOptionPlans||[]),salesOptionBindings:clone(data.salesOptionBindings||[])}
  const issues:string[]=[],plan=input.planDraft
  if(plan&&!input.bindings.length)issues.push('请先确认本次配置的应用范围，再查看本次草稿效果。')
  let previewPlanId=''
  if(plan){
    issues.push(...planProblems(data,plan))
    previewPlanId=`${SALES_DRAFT_PREVIEW_PREFIX}${plan.id||'new'}`
    for(let suffix=1;candidate.salesOptionPlans!.some(item=>item.id===previewPlanId);suffix++)previewPlanId=`${SALES_DRAFT_PREVIEW_PREFIX}${plan.id||'new'}:${suffix}`
    const version:SalesOptionPlanVersion & {previewOnly:true}={schemaVersion:1,planId:previewPlanId,version:1,name:plan.name,items:clone(plan.items),rules:clone(plan.rules),publishedAt:'2000-01-01T00:00:00.000Z',previewOnly:true}
    candidate.salesOptionPlans!.push({...clone(plan),id:previewPlanId,status:'available',publishedVersion:1,versions:[version],receipts:[]})
  }
  const bindings=input.bindings.map((binding,index)=>{
    const next=clone(binding)
    if(!next.id){next.id=`${SALES_DRAFT_PREVIEW_PREFIX}binding:${index}`;for(let suffix=1;candidate.salesOptionBindings!.some(item=>item.id===next.id);suffix++)next.id=`${SALES_DRAFT_PREVIEW_PREFIX}binding:${index}:${suffix}`}
    if(plan&&next.mode!=='none'&&(!next.planId||next.planId===plan.id)){next.planId=previewPlanId;next.planVersion=1}
    return next
  })
  for(const binding of bindings){
    candidate.salesOptionBindings=candidate.salesOptionBindings!.filter(item=>item.id!==binding.id)
    candidate.salesOptionBindings.push(binding)
  }
  const ranges=bindings.map(binding=>previewSalesBinding(candidate,binding))
  for(const range of ranges)issues.push(...range.issues)
  const mode:'draft'|'effective'=plan||bindings.length?'draft':'effective'
  return {data:candidate,bindings,ranges,issues:[...new Set(issues)],previewPlanId,mode,versionLabel:plan?'本次未发布配置草稿模拟（尚未生效）':bindings.length?'本次范围调整模拟（尚未生效）':'当前已生效配置',stamp:salesSignature([plan,input.bindings])}
}

/** Selection is caller-owned and discarded/reset on a changed source/device or draft stamp. */
export function previewSalesConfiguration(data:AppData,input:SalesConfigurationPreviewInput & {sourceSkuId:string;deviceSkuId?:string;selection?:BenefitPackageDraft}){
  const overlay=createSalesConfigurationPreviewData(data,input),issues=[...overlay.issues]
  const sourceIssue=salesSkuAdmission(data,input.sourceSkuId)
  if(input.sourceSkuId&&!sourceIssue.allowed)issues.push(sourceIssue.reason)
  if(input.deviceSkuId){const admission=salesSkuAdmission(data,input.deviceSkuId);if(!admission.allowed)issues.push(`本次使用设备：${admission.reason}`);else if(compatibilityRecordRole(data,input.deviceSkuId)!=='host')issues.push('本次使用设备必须是明确的主机销售 SKU。')}
  if(input.sourceSkuId&&input.bindings.length&&!overlay.ranges.some(range=>range.skuIds.includes(input.sourceSkuId)))issues.push('试选来源不属于当前已确认的应用范围。')
  const contextKey=salesSignature([overlay.stamp,input.sourceSkuId,input.deviceSkuId||''])
  const supplied=input.selection as (BenefitPackageDraft & {previewContextKey?:string})|undefined
  const selection=(supplied?.previewContextKey===contextKey?cloneBenefit(supplied):newBenefitPackageDraft(input.deviceSkuId?{kind:'sku',skuId:input.deviceSkuId}:null)) as BenefitPackageDraft & {previewContextKey?:string}
  selection.previewContextKey=contextKey
  const expectedDevice=input.deviceSkuId||(compatibilityRecordRole(data,input.sourceSkuId)==='host'?input.sourceSkuId:'')
  if(expectedDevice&&(!selection.device||selection.device.kind!=='sku'||selection.device.skuId!==expectedDevice)){
    selection.device={kind:'sku',skuId:expectedDevice};selection.confirmations=[]
  }
  const query=querySalesCandidates(overlay.data,selection,input.sourceSkuId)
  if(!input.sourceSkuId){query.resolution={...query.resolution,state:'unconfigured',message:''};query.sourceIssue=''}
  else if(query.sourceIssue)issues.push(query.sourceIssue)
  else if(['invalid','conflict'].includes(query.resolution.state)&&query.resolution.message)issues.push(query.resolution.message)
  return {...overlay,selection,query,issues:[...new Set(issues)],canPreview:!!input.sourceSkuId&&!issues.length,hasActualSku:!!input.sourceSkuId&&sourceIssue.allowed,emptyMessage:input.sourceSkuId?'':'可查看配置范围，暂不能进行实际商品试选。',validation:validateBenefitPackage(overlay.data,selection)}
}

/** Simulation add uses the same evidence/quantity/scope gates as actual shopping. */
export function addSalesPreviewCandidate(preview:ReturnType<typeof previewSalesConfiguration>,candidate:SalesCandidate){
  if(!preview.canPreview)throw Error(preview.issues[0]||'请先明确当前范围内的实际销售 SKU。')
  return addSalesCandidate(preview.data,preview.selection,candidate)
}
export function removeSalesPreviewPosition(selection:BenefitPackageDraft,id:string){return removeSalesPosition(selection,id)}
