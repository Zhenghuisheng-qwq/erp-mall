import { benefitSkuSummary, benefitRuleStructureIssues, benefitCompatibilitySummary, cloneBenefit, validateBenefitPackage } from './benefitPackages'
import { accessoryUseEvaluation, queryDeviceAccessories, queryModelAccessories } from './accessoryCompatibilityQuery'
import { compatibilityRecordRole } from './deviceResolution'
import { createCatalogIdentityContext, isMaterialArchive } from './catalogIdentity'
import { savedSkuCode, savedSkuName, savedSkuSpec } from './productList'
import { shelfOf } from './logic'
import { roleOfType } from './compatibility'
import { benefitCompositionVersion, benefitGroupSelection, benefitGroupRuleIssues, benefitGroupRuleStructureIssues } from './benefitPositions'
import type { AppData } from './types'
import type { BenefitFramework, BenefitFrameworkSnapshot, BenefitPackageDraft, BenefitSelectionGroup, BenefitIssue, BenefitGroupRule, BenefitSkuSummary } from './benefitPackageTypes'
import type { AccessoryQueryResult } from './accessoryCompatibilityTypes'
/** Object key order is not a rule or request change; array order remains explicit. */
export function frameworkSignature(value:unknown):string {
 if(Array.isArray(value))return `[${value.map(frameworkSignature).join(',')}]`
 if(value&&typeof value==='object')return `{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${frameworkSignature(v)}`).join(',')}}`
 return JSON.stringify(value)??'undefined'
}
export function frameworkSnapshot(f:BenefitFramework):BenefitFrameworkSnapshot { const kind=f.kind||f.history?.at(-1)?.kind||'type-v1';return {kind,frameworkId:f.id,revision:f.revision,name:f.name,groups:cloneBenefit(f.groups),...(kind==='type-v2'||f.rules!==undefined?{rules:cloneBenefit(f.rules||[])}:{})} }
function snapshotContent(v:BenefitFrameworkSnapshot){return {kind:v.kind,frameworkId:v.frameworkId,revision:v.revision,name:v.name,groups:v.groups,...(v.rules!==undefined?{rules:v.rules}:{})}}
export function frameworkProblems(data:AppData,groups:BenefitSelectionGroup[],kind='type-v1',rules:BenefitGroupRule[]=[]):string[] {
 const issues=benefitRuleStructureIssues(groups).map(i=>i.message);if(issues.length)return issues
 if(!['type-v1','type-v2'].includes(kind))return ['不支持的框架版本，原文保留，不能执行。']
 if(kind==='type-v1'&&rules.length)issues.push('旧版框架不支持组间规则，请明确升级为 type-v2。')
 issues.push(...benefitGroupRuleIssues(groups,rules).map(issue=>issue.message))
 if(!groups.length)issues.push('至少定义一个类型选配组。')
 const owners=new Map<string,string>()
 for(const g of groups){
  if(!g.name.trim()||!g.scope||g.scope.kind!=='product-types'||!g.scope.productTypeIds.length||g.candidateSkuIds.length)issues.push(`组「${g.name}」必须定义真实产品类型范围，不保存 SKU 白名单；未知范围不支持执行。`)
  if(g.minKinds>g.maxKinds||g.required&&g.minKinds<1||g.minQuantity>g.defaultQuantity||g.defaultQuantity>g.maxQuantity)issues.push(`组「${g.name}」种数或数量范围无效。`)
  for(const id of g.scope?.productTypeIds||[]){if(!data.productTypes.some(t=>t.id===id&&t.status==='enabled'))issues.push(`组「${g.name}」产品类型 ${id} 已失效。`);if(g.enabled){if(kind==='type-v1'&&owners.has(id))issues.push(`类型 ${id} 同时属于「${owners.get(id)}」和「${g.name}」，不能默认归组。`);owners.set(id,g.name)}}
 }
 return issues
}
export function applyBenefitFramework(draft:BenefitPackageDraft,f?:BenefitFramework):BenefitPackageDraft {
 if(f&&(f.deletedAt||f.status!=='available'))throw Error('停用框架不能供新实例选用。')
 const next=cloneBenefit(draft);if(f)next.framework=frameworkSnapshot(f);else delete next.framework
 if(next.framework?.kind==='type-v2'){
  next.compositionVersion=2
  for(const line of next.goods){if(line.role===undefined)line.role=line.skuId===next.includedPhoneSkuId?'host':'item';if(line.groupId===undefined){const groups=next.framework.groups.filter(group=>group.enabled&&group.scope?.productTypeIds.includes(line.snapshot.productTypeId));line.groupId=line.role==='host'?null:groups.length===1?groups[0].id:null}}
 }
 if(!f&&benefitCompositionVersion(next)===2){
  const legacy=next.rulesEnabled?next.groups.filter(group=>group.enabled&&!group.scope):[]
  for(const line of next.goods){
   if(line.role==='host'){line.groupId=null;continue}
   const matches=legacy.filter(group=>group.candidateSkuIds.includes(line.skuId))
   line.groupId=matches.some(group=>group.id===line.groupId)?line.groupId!:matches.length===1?matches[0].id:null
  }
  const identities=new Set<string>()
  for(const line of next.goods){const identity=JSON.stringify([line.groupId,line.role,line.skuId]);if(identities.has(identity))throw Error(`解除框架后，「${line.snapshot.name}」的多个位置将归入同一组，参考价格可能不同。请先明确处理这些位置后再解除；不会自动合并数量、价格或删除位置。`);identities.add(identity)}
 }
 next.confirmations=[];next.quote.reviewedBasis='';return next
}
export function previewBenefitFrameworkAdoption(data:AppData,draft:BenefitPackageDraft,f?:BenefitFramework){
 const next=applyBenefitFramework(draft,f),range=resolveBenefitRange(data,next)
 const unassignedPositionIds=benefitCompositionVersion(next)!==2?[]:next.goods.filter(line=>{
  if(line.role==='host')return false
  const membership=range.membership(line.skuId)
  return (!!next.framework||next.rulesEnabled&&membership.length>0)&&!membership.some(group=>group.id===line.groupId)
 }).map(line=>line.id)
 return {draft:next,issues:validateBenefitPackage(data,next,range.index).issues,unassignedPositionIds}
}

export interface BenefitSelectionIndex { stamp:string; summaries:Map<string,BenefitSkuSummary>; saleIds:Set<string>; roles:Map<string,string>; queryCache:Map<string,AccessoryQueryResult> }
// Legacy types derive their role from category names and ancestry when catalogRole is absent.
export function benefitSelectionCatalogStamp(data:AppData){return frameworkSignature([data.skus,data.families,data.productTypes,data.categories,data.specCanvases,data.specModelVersions,data.planningRecords,data.materialReceipts,data.compatibilities,data.deviceModels,data.deviceBindings,data.params,data.templateParams,data.templates,data.productPlans])}
export function createBenefitSelectionIndex(data:AppData):BenefitSelectionIndex{
 const families=new Map(data.families.map(f=>[f.id,f])),types=new Map(data.productTypes.map(t=>[t.id,t])),canvases=new Map(data.specCanvases.map(c=>[c.templateId,c])),identity=createCatalogIdentityContext(data),summaries=new Map<string,BenefitSkuSummary>(),saleIds=new Set<string>(),roles=new Map(data.productTypes.map(t=>[t.id,roleOfType(data,t.id)]))
 for(const sku of data.skus){const family=families.get(sku.familyId);if(!family||!identity.isRealSku(sku))continue;const productTypeId=family.productTypeId||canvases.get(family.productModelId||family.templateId)?.productTypeId||'';summaries.set(sku.id,{skuId:sku.id,code:savedSkuCode(sku),name:savedSkuName(sku),familyId:family.id,familyName:family.name,spec:savedSkuSpec(family,sku),productTypeId,typeName:types.get(productTypeId)?.name||'未分类',status:sku.status});if(sku.status==='on_sale'&&shelfOf(family)==='online')saleIds.add(sku.id)}
 return {stamp:benefitSelectionCatalogStamp(data),summaries,saleIds,roles,queryCache:new Map()}
}
/** One resolver for candidates, add/replace, validation and delivery. Host inclusion is explicit. */
export function resolveBenefitRange(data:AppData,draft:BenefitPackageDraft,supplied?:BenefitSelectionIndex) {
 const index=supplied&&supplied.stamp===benefitSelectionCatalogStamp(data)?supplied:createBenefitSelectionIndex(data)
 const rawGroups=draft.framework?.groups|| (draft.rulesEnabled?draft.groups:[]),groups=Array.isArray(rawGroups)?rawGroups:[],problems:string[]=[]
 if(![1,2].includes(benefitCompositionVersion(draft)))problems.push('不支持的组成版本，原文保留，不能执行选配。')
 if(!Array.isArray(rawGroups))problems.push('选配组容器结构损坏，不能执行。')
 if(!draft.framework&&Array.isArray(draft.groups)&&draft.groups.some(group=>group?.scope))problems.push('普通旧规则中的扩展范围尚不支持，请明确采用受支持的正式框架。')
 if(draft.framework){if(frameworkSnapshotProblem(draft.framework))problems.push(frameworkSnapshotProblem(draft.framework));else problems.push(...frameworkProblems(data,groups,draft.framework.kind,draft.framework.rules||[]))}
 const queryKey=frameworkSignature(draft.device),query=draft.device?(index.queryCache.get(queryKey)|| (draft.device.kind==='sku'?queryDeviceAccessories(data,draft.device.skuId):queryModelAccessories(data,draft.device.host))):undefined
 if(query)index.queryCache.set(queryKey,query)
 const matches=new Map([...(query?.sales||[]),...(query?.pending||[]),...(query?.excluded||[]),...(query?.unavailable||[])].filter(match=>match.target.kind==='sku').map(match=>[match.target.id,match]))
 const compatible=new Set((query?.sales||[]).filter(m=>m.target.kind==='sku'&&['compatible','conditional'].includes(m.capabilities.find(c=>c.capability==='basic')?.status||'')).map(m=>m.target.id))
 const sale=[...index.summaries.values()].filter(s=>index.saleIds.has(s.skuId)),allowed=index.saleIds
 const membership=(skuId:string)=>groups.filter(g=>g.enabled&&(g.scope?g.scope.kind==='product-types'&&g.scope.productTypeIds.includes(index.summaries.get(skuId)?.productTypeId||''):g.candidateSkuIds.includes(skuId)))
 const reason=(skuId:string,groupId?:string|null,role?:'host'|'item',previewOnly=false)=>{
  if(!allowed.has(skuId))return '不是当前在售的真实销售 SKU。'
  if(draft.device&&query?.device.status!=='resolved')return query?.device.message||'当前主机尚未唯一确认。'
  if(draft.framework&&(role==='host'||skuId===draft.includedPhoneSkuId&&benefitCompositionVersion(draft)===1)&&index.roles.get(index.summaries.get(skuId)?.productTypeId||'')==='host')return ''
  const hits=membership(skuId)
  if(benefitCompositionVersion(draft)===1&&hits.length>1)return `商品同时属于 ${hits.map(g=>g.name).join('、')}，请调整重叠范围。`
  if(!previewOnly&&draft.framework?.kind==='type-v2'&&(groupId===null||groupId===undefined&&hits.length>1))return '该商品需要明确选择目标选配组。'
  if(groupId!==undefined&&groupId!==null&&!hits.some(g=>g.id===groupId))return '商品不在所选组的真实类型范围内。'
  if(draft.framework&&!hits.length)return '商品不在本次框架的任何启用类型组内。'
  if(hits.some(g=>g.scope&&g.scope.kind!=='product-types'))return '不支持的选配范围。'
  if(draft.framework?.kind!=='type-v2'&&hits.some(g=>g.scope?.compatibleOnly)&&!compatible.has(skuId))return draft.device?'缺少本次主机的正式销售 SKU 适用结论（待确认、不适用或精确规划不匹配）。':'请选择本次适配主机。'
  const match=matches.get(skuId),use=accessoryUseEvaluation(match,{requireFastCharge:draft.requireFastCharge&&!!match?.capabilities.some(capability=>capability.capability==='fast-charge')})
  if(benefitCompositionVersion(draft)===2&&draft.device&&index.roles.get(index.summaries.get(skuId)?.productTypeId||'')==='accessory'&&use.status==='incompatible')return '当前设备的基本适用或所要求能力明确不适用／条件不满足，不能新增。'
  return ''
 }
 const rows=[...index.summaries.values()].map(summary=>{const match=matches.get(summary.skuId),compatibility=benefitCompatibilitySummary(summary.skuId,match,index.roles.get(summary.productTypeId)==='accessory',!!draft.device),basic=compatibility.basicStatus,fastCharge=compatibility.fastChargeStatus,allowedGroups=membership(summary.skuId),block=reason(summary.skuId,undefined,undefined,true),use=accessoryUseEvaluation(match,{requireFastCharge:draft.requireFastCharge&&!!match?.capabilities.some(capability=>capability.capability==='fast-charge')});const bucket: 'recommended'|'conditional'|'pending'|'blocked'=problems.length||block||!!draft.device&&query?.device.status!=='resolved'?'blocked':draft.device&&index.roles.get(summary.productTypeId)==='accessory'?use.status==='compatible'?'recommended':use.status==='conditional'?'conditional':use.status==='incompatible'?'blocked':'pending':'recommended';return {summary,allowedGroups,compatibility,basic,fastCharge,bucket,canAdd:bucket!=='blocked',reason:problems.join(' ')||block||(draft.framework?.kind==='type-v2'&&allowedGroups.length>1?'多个组均可选，请明确指定目标组；不会自动取第一组。':bucket==='pending'?'缺少基本适用或所要求能力的明确依据，可留草稿，正式可用前须处理。':bucket==='conditional'?'存在明确使用前提，正式交付前须按当前依据确认。':'')}})
 const candidates=rows.filter(row=>row.canAdd&&(benefitCompositionVersion(draft)===2||!reason(row.summary.skuId))).map(row=>row.summary)
 const emptyReasons=groups.filter(g=>g.enabled&&!candidates.some(s=>membership(s.skuId).some(m=>m.id===g.id))).map(g=>{
   const typed=sale.filter(s=>membership(s.skuId).some(m=>m.id===g.id))
   return `「${g.name}」：${!typed.length?'类型范围内没有当前在售的真实销售 SKU。':g.scope?.compatibleOnly&&!draft.device?'尚未选择适配主机。':'在售商品没有匹配本次主机的正式基本适用结论，需检查精确规划、待确认或不适用声明。'}`
 })
 return {groups,problems,membership,reason,candidates,emptyReasons,recommendedSkuIds:compatible,rows,index,query,matches}

}
export const resolveBenefitSelection=resolveBenefitRange
export function frameworkSelectionIssues(data:AppData,draft:BenefitPackageDraft,resolved?:ReturnType<typeof resolveBenefitRange>):BenefitIssue[]{
 if(!draft.framework)return []
 const range=resolved||resolveBenefitRange(data,draft),issues:BenefitIssue[]=range.problems.map(message=>({code:'framework',message,severity:'error',structural:!['type-v1','type-v2'].includes(draft.framework!.kind)||draft.framework!.rules?.some(rule=>!['requires','excludes'].includes(rule.kind))}))
 for(const line of draft.goods){const message=range.reason(line.skuId,benefitCompositionVersion(draft)===2?line.groupId:undefined,line.role);if(message)issues.push({code:'framework-member',message:`${line.snapshot.name}：${message}`,skuId:line.skuId,positionId:line.id,groupId:line.groupId||undefined,severity:'error'})}
 const selectedCounts=new Map<string,number>()
 for(const g of range.groups.filter(g=>g.enabled)){
  const {lines:selected,kinds}=benefitGroupSelection(draft,g,skuId=>(benefitCompositionVersion(draft)===2||skuId!==draft.includedPhoneSkuId)&&range.membership(skuId).some(m=>m.id===g.id)),min=g.required||kinds?g.minKinds:0
  selectedCounts.set(g.id,new Set(selected.filter(line=>range.index.saleIds.has(line.skuId)&&Number.isSafeInteger(line.quantity)&&line.quantity>0).map(line=>line.skuId)).size)
  if(kinds<min||kinds>g.maxKinds)issues.push({code:'framework-selection',message:`「${g.name}」须选 ${min}～${g.maxKinds} 种，当前 ${kinds} 种。`,groupId:g.id,severity:'error'})
  for(const l of selected){if(g.adjustable?l.quantity<g.minQuantity||l.quantity>g.maxQuantity:l.quantity!==g.defaultQuantity)issues.push({code:'framework-quantity',message:`「${g.name}」件数不符合规则。`,skuId:l.skuId,positionId:l.id,groupId:g.id,severity:'error'});if(g.scope?.compatibleOnly&&!range.recommendedSkuIds.has(l.skuId))issues.push({code:'framework-compatibility',message:`「${g.name}」要求当前主机正式基本适用，请补齐主机及销售 SKU 依据。`,skuId:l.skuId,positionId:l.id,groupId:g.id,severity:'error'})}
 }
 issues.push(...benefitGroupRuleIssues(range.groups,draft.framework.rules||[],selectedCounts))
 return issues
}
const obj=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x)
export function frameworkSnapshotProblem(x:unknown):string {
 if(!obj(x)||typeof x.kind!=='string'||!x.kind||typeof x.frameworkId!=='string'||!x.frameworkId||typeof x.name!=='string'||!Number.isSafeInteger(x.revision)||Number(x.revision)<1||benefitRuleStructureIssues(x.groups).length||benefitGroupRuleStructureIssues(x.rules).length)return '框架引用快照结构损坏。'
 return ''
}
export function frameworkImportProblems(data:AppData):string[]{
 if(data.benefitFrameworks!==undefined&&!Array.isArray(data.benefitFrameworks))return ['选配框架集合必须为数组。']
 const issues:string[]=[],ids=new Set<string>(),requests=new Set<string>()
 for(const f of data.benefitFrameworks||[]){
  if(!obj(f)||!['id','name','createdAt','updatedAt','creationRequestId','creationIntent'].every(k=>typeof f[k]==='string'&&!!f[k])||f.kind!==undefined&&(typeof f.kind!=='string'||!f.kind)||!['available','disabled'].includes(f.status)||!Number.isSafeInteger(f.revision)||f.revision<1||!Number.isFinite(Date.parse(f.createdAt))||!Number.isFinite(Date.parse(f.updatedAt))||!Array.isArray(f.history)||f.history.some(v=>frameworkSnapshotProblem(v))||benefitRuleStructureIssues(f.groups).length||benefitGroupRuleStructureIssues(f.rules).length){issues.push('选配框架结构损坏。');continue}
  if(f.deletedAt!==undefined&&(!Number.isFinite(Date.parse(f.deletedAt))||f.status!=='disabled'))issues.push('框架删除回执无效。')
  if(ids.has(f.id)||requests.has(f.creationRequestId))issues.push('框架身份或创建请求重复。');ids.add(f.id);requests.add(f.creationRequestId)
  if(f.history.length!==f.revision||f.history.some((v,i)=>v.frameworkId!==f.id||v.revision!==i+1)||frameworkSignature(snapshotContent(f.history.at(-1)!))!==frameworkSignature(frameworkSnapshot(f)))issues.push('框架修订历史与当前规则不一致。')
 }
 if(issues.length)return issues
 for(const p of data.benefitPackages||[])if(p.framework){const e=frameworkSnapshotProblem(p.framework);if(e)issues.push(e);else if(!data.benefitFrameworks?.some(f=>f.id===p.framework!.frameworkId&&f.history.some(v=>frameworkSignature(snapshotContent(v))===frameworkSignature(snapshotContent(p.framework!)))))issues.push('权益包框架快照不属于已保存修订。')}
 for(const p of data.benefitPackages||[])if(p.status==='available'&&['type-v1','type-v2'].includes(p.framework?.kind||'')&&!frameworkSnapshotProblem(p.framework)&&p.framework!.groups.every(g=>g.scope?.kind==='product-types')){
  const range=resolveBenefitRange(data,p)
  for(const line of p.goods){if((benefitCompositionVersion(p)===2?line.role==='host':line.skuId===p.includedPhoneSkuId)&&compatibilityRecordRole(data,line.skuId)==='host')continue
    // Missing live references remain repairable; existing out-of-group identities are still rejected.
    const sku=data.skus.find(s=>s.id===line.skuId)
    if(!sku||(!isMaterialArchive(data,sku)&&!data.families.some(f=>f.id===sku.familyId)))continue
    if(p.framework!.kind==='type-v1'?range.membership(line.skuId).length!==1:line.role!=='host'&&(!line.groupId||!range.membership(line.skuId).some(group=>group.id===line.groupId)))issues.push(`可用权益包「${p.name}」成员不属于${p.framework!.kind==='type-v1'?'唯一':'指定'}框架类型组；不能通过导入绕过选配范围。`)
  }
 }
 for(const d of data.benefitDeliveries||[])if(d.framework){const e=frameworkSnapshotProblem(d.framework);if(e)issues.push(e)}
 return issues
}
/** Product reset must not invalidate a previously resolvable framework member or host. */
export function frameworkProductResetProblems(before:AppData,after:AppData):string[]{
 const issues:string[]=[]
 for(const p of before.benefitPackages||[])if(p.framework){
  const refs=[...p.goods.map(l=>({id:l.skuId,name:l.snapshot.name})),...(p.device?.kind==='sku'?[{id:p.device.skuId,name:'适配主机'}]:[])]
  for(const ref of refs){
   const old=benefitSkuSummary(before,ref.id),next=benefitSkuSummary(after,ref.id)
   if(old&&(!next||old.familyId!==next.familyId||old.productTypeId!==next.productTypeId))issues.push(`权益包「${p.name}」的「${ref.name}」（${ref.id}）引用将失效或改变。`)
  }
 }
 return issues
}
export function frameworkReference(data:AppData,kind:'framework'|'type',id:string):string {
 const snapshots=[...(data.benefitPackages||[]).flatMap(p=>p.framework?[p.framework]:[]),...(data.benefitDeliveries||[]).flatMap(d=>d.framework?[d.framework]:[])]
 const hit=kind==='framework'?snapshots.some(s=>s.frameworkId===id):[...(data.benefitFrameworks||[]).filter(f=>!f.deletedAt).flatMap(f=>f.history),...snapshots].some(s=>s.groups.some(g=>g.scope?.productTypeIds.includes(id)))
 return hit?'仍被权益包框架或历史清单引用，不能删除。':''
}
export function frameworkCommand(data:AppData,input:{draft:BenefitFramework;expectedRevision:number;requestId:string},id:()=>string){
 const f=input.draft,previous=data.benefitFrameworks?.find(x=>x.id===f.id),kind=f.kind||previous?.history.at(-1)?.kind||'type-v1',intent=frameworkSignature([f.name,f.status,f.groups,kind,f.rules||[]])
 if(!input.requestId.trim())return {ok:false,message:'缺少框架保存请求。'}
 if(!f.id){const receipt=data.benefitFrameworks?.find(x=>x.creationRequestId===input.requestId);if(receipt)return receipt.deletedAt?{ok:false,message:'原创建请求对应框架已删除，请明确发起新请求。'}:receipt.creationIntent===intent?{ok:true,id:receipt.id}:{ok:false,message:'请求 ID 已用于不同框架内容。'}}
 if(previous?.deletedAt)return {ok:false,message:'框架已删除，不能通过旧修订重新保存。'}
 if(f.id&&!previous||previous&&previous.revision!==input.expectedRevision)return {ok:false,message:'框架已更新或不存在；请重新读取，输入已保留。'}
 if(previous?.history.at(-1)?.kind&&!['type-v1','type-v2'].includes(previous.history.at(-1)!.kind))return {ok:false,message:'不支持的框架版本，原文保留，不能改写。'}
 const problems=frameworkProblems(data,f.groups,kind,f.rules||[]);if(!f.name.trim()||!['available','disabled'].includes(f.status))problems.push('框架名称或状态无效。')
 if(problems.length)return {ok:false,message:problems.join(' ')}
 const revision=(previous?.revision||0)+1;if(!Number.isSafeInteger(revision))return {ok:false,message:'修订号溢出。'}
 const now=new Date().toISOString(),record:BenefitFramework={...cloneBenefit(f),...(f.kind!==undefined||kind==='type-v2'?{kind}:{}),id:previous?.id||id(),revision,createdAt:previous?.createdAt||now,updatedAt:now,creationRequestId:previous?.creationRequestId||input.requestId,creationIntent:previous?.creationIntent||intent,history:cloneBenefit(previous?.history||[])}
 record.history.push(frameworkSnapshot(record));data.benefitFrameworks=[...(data.benefitFrameworks||[]).filter(x=>x.id!==record.id),record];return {ok:true,id:record.id}
}
