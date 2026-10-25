import { benefitSkuCandidates, benefitSkuSummary, benefitRuleStructureIssues, cloneBenefit } from './benefitPackages'
import { queryDeviceAccessories, queryModelAccessories } from './accessoryCompatibilityQuery'
import { compatibilityRecordRole } from './deviceResolution'
import { isMaterialArchive } from './catalogIdentity'
import type { AppData } from './types'
import type { BenefitFramework, BenefitFrameworkSnapshot, BenefitPackageDraft, BenefitSelectionGroup, BenefitIssue } from './benefitPackageTypes'
/** Object key order is not a rule or request change; array order remains explicit. */
export function frameworkSignature(value:unknown):string {
 if(Array.isArray(value))return `[${value.map(frameworkSignature).join(',')}]`
 if(value&&typeof value==='object')return `{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${frameworkSignature(v)}`).join(',')}}`
 return JSON.stringify(value)??'undefined'
}
export function frameworkSnapshot(f:BenefitFramework):BenefitFrameworkSnapshot { return {kind:f.history?.at(-1)?.kind||'type-v1',frameworkId:f.id,revision:f.revision,name:f.name,groups:cloneBenefit(f.groups)} }
function snapshotContent(v:BenefitFrameworkSnapshot){return {kind:v.kind,frameworkId:v.frameworkId,revision:v.revision,name:v.name,groups:v.groups}}
export function frameworkProblems(data:AppData,groups:BenefitSelectionGroup[]):string[] {
 const issues=benefitRuleStructureIssues(groups).map(i=>i.message);if(issues.length)return issues
 if(!groups.length)issues.push('至少定义一个类型选配组。')
 const owners=new Map<string,string>()
 for(const g of groups){
  if(!g.name.trim()||!g.scope||g.scope.kind!=='product-types'||!g.scope.productTypeIds.length||g.candidateSkuIds.length)issues.push(`组「${g.name}」必须定义真实产品类型范围，不保存 SKU 白名单；未知范围不支持执行。`)
  if(g.minKinds>g.maxKinds||g.required&&g.minKinds<1||g.minQuantity>g.defaultQuantity||g.defaultQuantity>g.maxQuantity)issues.push(`组「${g.name}」种数或数量范围无效。`)
  for(const id of g.scope?.productTypeIds||[]){if(!data.productTypes.some(t=>t.id===id&&t.status==='enabled'))issues.push(`组「${g.name}」产品类型 ${id} 已失效。`);if(g.enabled){if(owners.has(id))issues.push(`类型 ${id} 同时属于「${owners.get(id)}」和「${g.name}」，不能默认归组。`);owners.set(id,g.name)}}
 }
 return issues
}
export function applyBenefitFramework(draft:BenefitPackageDraft,f?:BenefitFramework):BenefitPackageDraft {
 if(f&&(f.deletedAt||f.status!=='available'))throw Error('停用框架不能供新实例选用。')
 const next=cloneBenefit(draft);if(f)next.framework=frameworkSnapshot(f);else delete next.framework
 next.confirmations=[];next.quote.reviewedBasis='';return next
}
/** One resolver for candidates, add/replace, validation and delivery. Host inclusion is explicit. */
export function resolveBenefitRange(data:AppData,draft:BenefitPackageDraft) {
 const groups=draft.framework?.groups|| (draft.rulesEnabled?draft.groups:[]),problems:string[]=[]
 if(draft.framework){if(frameworkSnapshotProblem(draft.framework))problems.push(frameworkSnapshotProblem(draft.framework));else if(draft.framework.kind!=='type-v1')problems.push('不支持的框架版本，原文保留，不能执行。');else problems.push(...frameworkProblems(data,groups))}
 const query=draft.device?.kind==='sku'?queryDeviceAccessories(data,draft.device.skuId):draft.device?.kind==='model'?queryModelAccessories(data,draft.device.host):undefined
 const compatible=new Set((query?.sales||[]).filter(m=>m.target.kind==='sku'&&['compatible','conditional'].includes(m.capabilities.find(c=>c.capability==='basic')?.status||'')).map(m=>m.target.id))
 const sale=benefitSkuCandidates(data,draft.device),allowed=new Set(sale.map(s=>s.skuId))
 const membership=(skuId:string)=>groups.filter(g=>g.enabled&&(g.scope?g.scope.kind==='product-types'&&g.scope.productTypeIds.includes(benefitSkuSummary(data,skuId)?.productTypeId||''):g.candidateSkuIds.includes(skuId)))
 const reason=(skuId:string)=>{
  if(!allowed.has(skuId))return '不是当前在售的真实销售 SKU。'
  if(draft.framework&&skuId===draft.includedPhoneSkuId&&compatibilityRecordRole(data,skuId)==='host')return ''
  const hits=membership(skuId)
  if(hits.length>1)return `商品同时属于 ${hits.map(g=>g.name).join('、')}，请调整重叠范围。`
  if(draft.framework&&!hits.length)return '商品不在本次框架的任何启用类型组内。'
  if(hits.some(g=>g.scope&&g.scope.kind!=='product-types'))return '不支持的选配范围。'
  if(hits.some(g=>g.scope?.compatibleOnly)&&!compatible.has(skuId))return draft.device?'缺少本次主机的正式销售 SKU 适用结论（待确认、不适用或精确规划不匹配）。':'请选择本次适配主机。'
  return ''
 }
 const candidates=problems.length?[]:sale.filter(s=>!reason(s.skuId))
 const emptyReasons=groups.filter(g=>g.enabled&&!candidates.some(s=>membership(s.skuId).some(m=>m.id===g.id))).map(g=>{
   const typed=sale.filter(s=>membership(s.skuId).some(m=>m.id===g.id))
   return `「${g.name}」：${!typed.length?'类型范围内没有当前在售的真实销售 SKU。':g.scope?.compatibleOnly&&!draft.device?'尚未选择适配主机。':'在售商品没有匹配本次主机的正式基本适用结论，需检查精确规划、待确认或不适用声明。'}`
 })
 return {groups,problems,membership,reason,candidates,emptyReasons,recommendedSkuIds:compatible}

}
export function frameworkSelectionIssues(data:AppData,draft:BenefitPackageDraft):BenefitIssue[]{
 if(!draft.framework)return []
 const range=resolveBenefitRange(data,draft),issues:BenefitIssue[]=range.problems.map(message=>({code:'framework',message,severity:'error'}))
 for(const line of draft.goods){const message=range.reason(line.skuId);if(message)issues.push({code:'framework-member',message:`${line.snapshot.name}：${message}`,skuId:line.skuId,severity:'error'})}
 for(const g of range.groups.filter(g=>g.enabled)){
  const selected=draft.goods.filter(l=>l.skuId!==draft.includedPhoneSkuId&&range.membership(l.skuId).some(m=>m.id===g.id)),min=g.required||selected.length?g.minKinds:0
  if(selected.length<min||selected.length>g.maxKinds)issues.push({code:'framework-selection',message:`「${g.name}」须选 ${min}～${g.maxKinds} 种，当前 ${selected.length} 种。`,groupId:g.id,severity:'error'})
  for(const l of selected)if(g.adjustable?l.quantity<g.minQuantity||l.quantity>g.maxQuantity:l.quantity!==g.defaultQuantity)issues.push({code:'framework-quantity',message:`「${g.name}」件数不符合规则。`,skuId:l.skuId,groupId:g.id,severity:'error'})
 }
 return issues
}
const obj=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x)
export function frameworkSnapshotProblem(x:unknown):string {
 if(!obj(x)||typeof x.kind!=='string'||!x.kind||typeof x.frameworkId!=='string'||!x.frameworkId||typeof x.name!=='string'||!Number.isSafeInteger(x.revision)||Number(x.revision)<1||benefitRuleStructureIssues(x.groups).length)return '框架引用快照结构损坏。'
 return ''
}
export function frameworkImportProblems(data:AppData):string[]{
 if(data.benefitFrameworks!==undefined&&!Array.isArray(data.benefitFrameworks))return ['选配框架集合必须为数组。']
 const issues:string[]=[],ids=new Set<string>(),requests=new Set<string>()
 for(const f of data.benefitFrameworks||[]){
  if(!obj(f)||!['id','name','createdAt','updatedAt','creationRequestId','creationIntent'].every(k=>typeof f[k]==='string'&&!!f[k])||!['available','disabled'].includes(f.status)||!Number.isSafeInteger(f.revision)||f.revision<1||!Number.isFinite(Date.parse(f.createdAt))||!Number.isFinite(Date.parse(f.updatedAt))||!Array.isArray(f.history)||f.history.some(v=>frameworkSnapshotProblem(v))||benefitRuleStructureIssues(f.groups).length){issues.push('选配框架结构损坏。');continue}
  if(f.deletedAt!==undefined&&(!Number.isFinite(Date.parse(f.deletedAt))||f.status!=='disabled'))issues.push('框架删除回执无效。')
  if(ids.has(f.id)||requests.has(f.creationRequestId))issues.push('框架身份或创建请求重复。');ids.add(f.id);requests.add(f.creationRequestId)
  if(f.history.length!==f.revision||f.history.some((v,i)=>v.frameworkId!==f.id||v.revision!==i+1)||frameworkSignature(snapshotContent(f.history.at(-1)!))!==frameworkSignature(frameworkSnapshot(f)))issues.push('框架修订历史与当前规则不一致。')
 }
 if(issues.length)return issues
 for(const p of data.benefitPackages||[])if(p.framework){const e=frameworkSnapshotProblem(p.framework);if(e)issues.push(e);else if(!data.benefitFrameworks?.some(f=>f.id===p.framework!.frameworkId&&f.history.some(v=>frameworkSignature(snapshotContent(v))===frameworkSignature(snapshotContent(p.framework!)))))issues.push('权益包框架快照不属于已保存修订。')}
 for(const p of data.benefitPackages||[])if(p.status==='available'&&p.framework?.kind==='type-v1'&&!frameworkSnapshotProblem(p.framework)&&p.framework.groups.every(g=>g.scope?.kind==='product-types')){
  const range=resolveBenefitRange(data,p)
  for(const line of p.goods){if(line.skuId===p.includedPhoneSkuId&&compatibilityRecordRole(data,line.skuId)==='host')continue
    // Missing live references remain repairable; existing out-of-group identities are still rejected.
    const sku=data.skus.find(s=>s.id===line.skuId)
    if(!sku||(!isMaterialArchive(data,sku)&&!data.families.some(f=>f.id===sku.familyId)))continue
    if(range.membership(line.skuId).length!==1)issues.push(`可用权益包「${p.name}」成员不属于唯一框架类型组；不能通过导入绕过选配范围。`)
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
 const f=input.draft,previous=data.benefitFrameworks?.find(x=>x.id===f.id),intent=frameworkSignature([f.name,f.status,f.groups])
 if(!input.requestId.trim())return {ok:false,message:'缺少框架保存请求。'}
 if(!f.id){const receipt=data.benefitFrameworks?.find(x=>x.creationRequestId===input.requestId);if(receipt)return receipt.deletedAt?{ok:false,message:'原创建请求对应框架已删除，请明确发起新请求。'}:receipt.creationIntent===intent?{ok:true,id:receipt.id}:{ok:false,message:'请求 ID 已用于不同框架内容。'}}
 if(previous?.deletedAt)return {ok:false,message:'框架已删除，不能通过旧修订重新保存。'}
 if(f.id&&!previous||previous&&previous.revision!==input.expectedRevision)return {ok:false,message:'框架已更新或不存在；请重新读取，输入已保留。'}
 if(previous?.history.at(-1)?.kind&&previous.history.at(-1)!.kind!=='type-v1')return {ok:false,message:'不支持的框架版本，原文保留，不能改写。'}
 const problems=frameworkProblems(data,f.groups);if(!f.name.trim()||!['available','disabled'].includes(f.status))problems.push('框架名称或状态无效。')
 if(problems.length)return {ok:false,message:problems.join(' ')}
 const revision=(previous?.revision||0)+1;if(!Number.isSafeInteger(revision))return {ok:false,message:'修订号溢出。'}
 const now=new Date().toISOString(),record:BenefitFramework={...cloneBenefit(f),id:previous?.id||id(),revision,createdAt:previous?.createdAt||now,updatedAt:now,creationRequestId:previous?.creationRequestId||input.requestId,creationIntent:previous?.creationIntent||intent,history:cloneBenefit(previous?.history||[])}
 record.history.push(frameworkSnapshot(record));data.benefitFrameworks=[...(data.benefitFrameworks||[]).filter(x=>x.id!==record.id),record];return {ok:true,id:record.id}
}
