import type {AppData} from '../types'
import type {BenefitDevice,BenefitLine,BenefitSelection,BenefitSelectionInput,BenefitGroup,BenefitGroupInput,BenefitSnapshot,BenefitWrite} from './types'
import {benefitCandidates,benefitSkuLabel,benefitScopeProblem,sellableSkuProblem} from './query'
export const MAX_QUANTITY=9999,MAX_PRICE_CENTS=100000000
export const benefitClone=<T>(value:T):T=>JSON.parse(JSON.stringify(value))
export function parseBenefitPrice(text:string):number|null|undefined {if(!text.trim())return null;if(!/^\d+(\.\d{1,2})?$/.test(text.trim()))return undefined;const [a,b='']=text.trim().split('.');const cents=Number(a)*100+Number(b.padEnd(2,'0'));return Number.isSafeInteger(cents)&&cents<=MAX_PRICE_CENTS?cents:undefined}
export function benefitTotal(lines:BenefitLine[]){const complete=lines.every(l=>l.unitPriceCents!==null),cents=lines.reduce((n,l)=>n+l.quantity*(l.unitPriceCents||0),0);return {complete,cents}}
export function benefitLineProblem(line:BenefitLine){return !line||typeof line.skuId!=='string'||!line.skuId?'商品标识无效':!Number.isSafeInteger(line.quantity)||line.quantity<1||line.quantity>MAX_QUANTITY?'数量须为 1–9999 的整数':line.unitPriceCents!==null&&(!Number.isSafeInteger(line.unitPriceCents)||line.unitPriceCents<0||line.unitPriceCents>MAX_PRICE_CENTS)?'请输入有效报价（最多两位小数）':''}
export function benefitAdmission(data:AppData,device:BenefitDevice,skuId:string,context=benefitCandidates(data,device)){
 if(context.issue)return context.issue
 if(device.kind==='sku'&&device.skuId===skuId)return sellableSkuProblem(data,skuId,'host')
 return context.candidates.some(c=>c.sku.id===skuId)?'':sellableSkuProblem(data,skuId,'accessory')||'当前设备没有已确认可用的基本适用依据'
}
export function reviewBenefitSelection(data:AppData,input:Pick<BenefitSelectionInput,'device'|'lines'>){
 const context=benefitCandidates(data,input.device)
 const issues=input.lines.flatMap(l=>{const message=benefitLineProblem(l)||benefitAdmission(data,input.device,l.skuId,context);return message?[{skuId:l.skuId,name:benefitSkuLabel(data,l.skuId).name,message}]:[]})
 if(new Set(input.lines.map(l=>l.skuId)).size!==input.lines.length)issues.push({skuId:'',name:'清单',message:'同一商品只能保留一行'})
 return {context,issues}
}
export function addBenefitLine(data:AppData,device:BenefitDevice,lines:BenefitLine[],skuId:string){
 const message=benefitAdmission(data,device,skuId);if(message)return {ok:false,message,lines}
 const copy=benefitClone(lines),old=copy.find(l=>l.skuId===skuId)
 if(old){if(old.quantity>=MAX_QUANTITY)return {ok:false,message:'数量已达到上限',lines};old.quantity++}else copy.push({skuId,quantity:1,unitPriceCents:null})
 return {ok:true,lines:copy}
}
export function previewBenefitDeviceChange(data:AppData,oldDevice:BenefitDevice,nextDevice:BenefitDevice,lines:BenefitLine[]){
 const context=benefitCandidates(data,nextDevice),keep:BenefitLine[]=[],remove:{line:BenefitLine;name:string;reason:string}[]=[]
 for(const line of lines){const oldPhone=oldDevice.kind==='sku'&&line.skuId===oldDevice.skuId&&(nextDevice.kind!=='sku'||nextDevice.skuId!==line.skuId);const reason=oldPhone?'本次购买的原手机将移除，不自动加入新手机':benefitAdmission(data,nextDevice,line.skuId,context);if(reason)remove.push({line,name:benefitSkuLabel(data,line.skuId).name,reason});else keep.push(benefitClone(line))}
 return {keep,remove,issue:context.issue}
}
export function saveBenefitGroup(data:AppData,input:BenefitGroupInput,revision:number,id:()=>string,now:string):BenefitWrite<BenefitGroup>{
 const old=(data.benefitGroups||[]).find(g=>g.id===input.id)
 if(input.id&&(!old||old.revision!==revision))return {ok:false,message:'权益包已变更或删除，请重新打开；输入保留'}
 const message=benefitScopeProblem(data,input.scope)
 if(message)return {ok:false,message}
 if(!input.name.trim()||input.name.length>80||!input.productTypeIds.length||new Set(input.productTypeIds).size!==input.productTypeIds.length||typeof input.enabled!=='boolean'||!Number.isSafeInteger(input.sort)||input.sort<0||input.sort>9999)return {ok:false,message:'请填写名称、产品类型和有效排序'}
 if(input.productTypeIds.some(typeId=>!data.productTypes.some(t=>t.id===typeId&&t.status==='enabled'&&t.catalogRole==='accessory')))return {ok:false,message:'包含已停用、失效或非配件的产品类型，请重新选择'}
 const record:BenefitGroup={...benefitClone(input),id:old?.id||id(),name:input.name.trim(),revision:(old?.revision||0)+1,createdAt:old?.createdAt||now,updatedAt:now}
 data.benefitGroups=[...(data.benefitGroups||[]).filter(g=>g.id!==record.id),record];return {ok:true,record}
}
export function saveBenefitSelection(data:AppData,input:BenefitSelectionInput,revision:number,id:()=>string,now:string):BenefitWrite<BenefitSelection>{
 const old=(data.benefitSelections||[]).find(s=>s.id===input.id)
 if(input.id&&(!old||old.revision!==revision))return {ok:false,message:'清单已变更或删除，请重新打开；输入保留'}
 if(old?.status==='confirmed')return {ok:false,message:'已确认清单只读，请复制为新草稿'}
 if(!['draft','confirmed'].includes(input.status)||!input.lines.length)return {ok:false,message:'请先添加商品'}
 const {context,issues}=reviewBenefitSelection(data,input)
 if(context.issue||issues.length)return {ok:false,message:context.issue||`请处理 ${issues.length} 项商品问题后保存；原输入已保留`}
 const total=benefitTotal(input.lines)
 if(!Number.isSafeInteger(total.cents))return {ok:false,message:'报价合计超出支持范围'}
 if(input.status==='confirmed'&&!total.complete)return {ok:false,message:'请补齐所有商品的本次报价'}
 let snapshot:BenefitSnapshot|undefined
 if(input.status==='confirmed')snapshot={device:{label:context.label.name,spec:context.label.spec,host:benefitClone(context.query.device.host!),...(input.device.kind==='sku'?{skuId:input.device.skuId}:{}),planningId:context.query.device.planningId,attributes:benefitClone(context.query.device.attributes),source:context.query.device.source},lines:input.lines.map(l=>({...benefitClone(l),...benefitSkuLabel(data,l.skuId),role:input.device.kind==='sku'&&l.skuId===input.device.skuId?'device':'accessory',declarations:benefitClone(context.candidates.find(c=>c.sku.id===l.skuId)?.declarations||[])})),totalCents:total.cents,confirmedAt:now}
 const record:BenefitSelection={id:old?.id||id(),device:benefitClone(input.device),lines:benefitClone(input.lines),status:input.status,revision:(old?.revision||0)+1,createdAt:old?.createdAt||now,updatedAt:now,...(snapshot?{snapshot}:{})}
 data.benefitSelections=[...(data.benefitSelections||[]).filter(s=>s.id!==record.id),record];return {ok:true,record}
}
/** Structural import validation permits stale drafts and immutable historical facts; no legacy fields are consumed. */
export function benefitDataProblems(data:AppData):string[]{
 const problems:string[]=[]
 for(const key of ['benefitGroups','benefitSelections'] as const){const rows=data[key];if(rows===undefined)continue;if(!Array.isArray(rows)){problems.push(`${key} 必须为数组`);continue}const ids=new Set<string>();for(const r of rows){if(!r||typeof r.id!=='string'||!r.id||ids.has(r.id)||!Number.isSafeInteger(r.revision)||r.revision<1||typeof r.createdAt!=='string'||typeof r.updatedAt!=='string'){problems.push('权益包记录身份或修订无效');continue}ids.add(r.id)}}
 if(Array.isArray(data.benefitGroups))for(const g of data.benefitGroups){if(!g||typeof g.name!=='string'||!g.name.trim()||!g.scope||typeof g.scope.modelId!=='string'||!g.scope.modelId||(g.scope.hostKey!==undefined&&typeof g.scope.hostKey!=='string')||!Array.isArray(g.productTypeIds)||g.productTypeIds.some(id=>typeof id!=='string')||new Set(g.productTypeIds).size!==g.productTypeIds.length||typeof g.enabled!=='boolean'||!Number.isSafeInteger(g.sort))problems.push('权益包配置结构无效')}
 if(Array.isArray(data.benefitSelections))for(const s of data.benefitSelections){if(!s||!s.device||(s.device.kind==='sku'?typeof s.device.skuId!=='string'||!s.device.skuId:s.device.kind!=='model'||typeof s.device.hostKey!=='string'||!s.device.hostKey)||!['draft','confirmed'].includes(s.status)||!Array.isArray(s.lines)||s.lines.some(l=>!!benefitLineProblem(l))||new Set(s.lines.map(l=>l.skuId)).size!==s.lines.length){problems.push('选购清单结构无效');continue}
 if(s.status==='confirmed'){const snap=s.snapshot;if(!snap||!snap.device?.host||typeof snap.device.label!=='string'||!Array.isArray(snap.lines)||JSON.stringify(snap.lines.map(({skuId,quantity,unitPriceCents})=>({skuId,quantity,unitPriceCents})))!==JSON.stringify(s.lines)||!benefitTotal(s.lines).complete||snap.totalCents!==benefitTotal(s.lines).cents||typeof snap.confirmedAt!=='string'||snap.lines.some(l=>typeof l.name!=='string'||typeof l.spec!=='string'||!Array.isArray(l.declarations)))problems.push('已确认清单快照无效')}
 else if(s.snapshot!==undefined)problems.push('草稿不能携带确认快照')}
 return problems
}
