import type {AppData,CompatibilityLink} from './types'
import type {CompatibilityCapability,CompatibilityCondition,CompatibilityConclusion,CompatibilityVerification,ConditionEvaluation,DeviceResolution} from './accessoryCompatibilityTypes'
import {isRealSku} from './catalogIdentity'
import {compatibilityRecordRole} from './deviceResolution'
export type GeneralCondition=Extract<CompatibilityCondition,{kind:'attribute'}> & {operator:'eq'|'in'}
export interface GeneralCompatibilityClaim {id:string;skuId:string;deviceTypeIds:string[];capability:CompatibilityCapability;conditions:GeneralCondition[];conclusion:CompatibilityConclusion;verification:CompatibilityVerification;source:string;note:string;revision:number;createdAt:string;updatedAt:string}
export type GeneralDraft=Omit<GeneralCompatibilityClaim,'id'|'revision'|'createdAt'|'updatedAt'>
export type GeneralChange={kind:'add';draft:GeneralDraft}|{kind:'edit';id:string;revision:number;draft:GeneralDraft}|{kind:'remove';id:string;revision:number}
export interface CompatibilityEvidence {scopeLabel?:string;key:string;kind:'model'|'general';record:CompatibilityLink|GeneralCompatibilityClaim;conditions:ConditionEvaluation[];effective:boolean;reason:string}
export function generalConditionProblem(data:AppData,condition:GeneralCondition){
 if(!condition||condition.kind!=='attribute'||!['eq','in'].includes(condition.operator))return '条件运算不受支持'
 const fields=data.params.filter(p=>p.id===condition.attributeId),field=fields[0]
 if(fields.length!==1||!field||field.identityRole==='host-model')return '条件参数已失效、身份不唯一或不是能力事实字段'
 const values=Array.isArray(condition.value)?condition.value:[condition.value]
 if(!values.length||values.some(v=>typeof v!=='string'||!v||!field.values.includes(v))||condition.operator==='eq'&&Array.isArray(condition.value)||condition.operator==='in'&&!Array.isArray(condition.value))return '条件词典值已失效或运算和值不匹配'
 return ''
}
export function generalFactProblem(data:AppData,condition:GeneralCondition,device:DeviceResolution){
 const param=data.params.find(p=>p.id===condition.attributeId),actual=device.attributes[condition.attributeId]
 if(actual&&param&&!param.values.includes(actual))return '设备事实的词典值已失效，无法核验'
 const sku=data.skus.find(s=>s.id===device.skuId),family=data.families.find(f=>f.id===sku?.familyId)
 if(param&&sku&&family&&data.params.filter(p=>p.name===param.name).length>1&&sku.variantAttrs[param.id]===undefined&&family.commonAttrs[param.id]===undefined)return '设备事实存在同名参数歧义，请使用明确字段登记'
 return ''
}
export function generalReferenceProblem(data:AppData,claim:GeneralDraft){
 const matches=data.skus.filter(s=>s.id===claim.skuId),sku=matches[0]
 if(matches.length!==1||!sku||!isRealSku(data,sku)||compatibilityRecordRole(data,sku.id)!=='accessory')return '目标销售 SKU 已失效或不属于配件'
 if(!Array.isArray(claim.deviceTypeIds)||!claim.deviceTypeIds.length||new Set(claim.deviceTypeIds).size!==claim.deviceTypeIds.length)return '请选择明确的设备产品类型'
 for(const id of claim.deviceTypeIds){const rows=data.productTypes.filter(t=>t.id===id);if(rows.length!==1||rows[0]!.status!=='enabled'||rows[0]!.catalogRole!=='host')return '设备产品类型已失效、停用或不属于设备'}
 if(!['basic','fast-charge','other'].includes(claim.capability))return '能力身份已失效'
 if(typeof claim.source!=='string'||!claim.source.trim())return '正式资料依据未记录，不能提供适用证明'
 return claim.conditions.map(c=>generalConditionProblem(data,c)).find(Boolean)||''
}
export function generalDraftProblem(data:AppData,claim:GeneralDraft){
 if(!claim||!Array.isArray(claim.conditions)||!['compatible','conditional','incompatible'].includes(claim.conclusion)||!['confirmed','pending'].includes(claim.verification))return '声明结构无效'
 const problem=generalReferenceProblem(data,claim);if(problem)return problem
 if(typeof claim.source!=='string'||!claim.source.trim()||claim.source.length>2000)return '请填写 1 至 2000 字的真实资料依据'
 if(claim.verification==='confirmed'&&!claim.conditions.length)return '只勾选设备类型不能确认通用适用；请补充供应商确认的必要条件，或保存待核验'
 return ''
}
export function generalStorageProblems(data:AppData){const rows=data.generalCompatibilityClaims;if(rows===undefined)return [];if(!Array.isArray(rows))return ['通用适用声明必须为数组'];const ids=new Set<string>(),errors:string[]=[];for(const c of rows){if(!c||typeof c.id!=='string'||!c.id||ids.has(c.id)||typeof c.skuId!=='string'||!Array.isArray(c.deviceTypeIds)||!c.deviceTypeIds.every(x=>typeof x==='string')||!Array.isArray(c.conditions)||c.conditions.some(x=>!x||x.kind!=='attribute'||typeof x.attributeId!=='string'||typeof x.operator!=='string'||!(typeof x.value==='string'||Array.isArray(x.value)&&x.value.every(v=>typeof v==='string')))||!['basic','fast-charge','other'].includes(c.capability)||!['compatible','conditional','incompatible'].includes(c.conclusion)||!['confirmed','pending'].includes(c.verification)||typeof c.source!=='string'||typeof c.note!=='string'||!Number.isSafeInteger(c.revision)||c.revision<1||typeof c.createdAt!=='string'||typeof c.updatedAt!=='string')errors.push('通用适用声明结构或修订无效');else ids.add(c.id)}return errors}
const clone=<T>(v:T):T=>JSON.parse(JSON.stringify(v))
function signature(c:GeneralDraft){return JSON.stringify([c.skuId,[...c.deviceTypeIds].sort(),c.capability,c.conditions.map(x=>JSON.stringify([x.attributeId,x.operator,Array.isArray(x.value)?[...x.value].sort():x.value])).sort(),c.conclusion,c.verification,c.source.trim(),c.note||''])}
/** Entire batch is staged before the caller commits the single candidate payload. */
export function applyGeneralChanges(data:AppData,changes:GeneralChange[],nextId:()=>string,now:string){
 const rows=clone(data.generalCompatibilityClaims||[]),items:{skuId:string;state:string;message:string}[]=[]
 if(!Array.isArray(changes)||!changes.length)return {ok:false,message:'请明确选择要维护的实际 SKU',items}
 const changedIds=new Set<string>()
 for(const change of changes){const old=change.kind==='add'?undefined:rows.find(c=>c.id===change.id)
  if(change.kind!=='add'&&(!old||old.revision!==change.revision||changedIds.has(change.id)))return {ok:false,message:'声明已变更、删除或在本批重复修改，请重新打开；输入保留',items}
  if(change.kind!=='add')changedIds.add(change.id)
  if(change.kind==='remove'){rows.splice(rows.indexOf(old!),1);items.push({skuId:old!.skuId,state:'remove',message:'仅删除明确选定的声明，其他人工资料不变'});continue}
  const problem=generalDraftProblem(data,change.draft);if(problem)return {ok:false,message:problem,items}
  if(rows.some(r=>r.id!==old?.id&&signature(r)===signature(change.draft))||old&&signature(old)===signature(change.draft)){items.push({skuId:change.draft.skuId,state:'duplicate',message:'同一完整声明已存在，跳过重复项'});continue}
  const record:GeneralCompatibilityClaim={...clone(change.draft),source:change.draft.source.trim(),note:change.draft.note||'',id:old?.id||nextId(),revision:(old?.revision||0)+1,createdAt:old?.createdAt||now,updatedAt:now}
  if(rows.some(r=>r.id===record.id&&r!==old))return {ok:false,message:'声明身份重复',items}
  if(old)rows[rows.indexOf(old)]=record;else rows.push(record)
  items.push({skuId:record.skuId,state:old?'edit':'add',message:old?'明确编辑此声明；其他来源保留':'新增独立依据，不覆盖现有人工声明'})
 }
 data.generalCompatibilityClaims=rows;return {ok:true,items}
}
