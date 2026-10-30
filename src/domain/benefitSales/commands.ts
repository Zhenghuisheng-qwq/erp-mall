import {commonIds,validCommonIds,commonSpusProblem} from './publicSpuPool'
import type {AppData} from '../types'
import type {BenefitGroup,BenefitSale,GroupInput,SaleInput,SaleLine,SaleScope,WriteResult} from './types'
import {groupTypesProblem,saleTypesProblem,saleQuery} from './query'
export const copy=<T>(v:T):T=>JSON.parse(JSON.stringify(v))
export function total(lines:SaleLine[]){let cents=0;for(const l of lines){if(!Number.isSafeInteger(l.quantity)||l.quantity<1||l.quantity>100000)return {error:'数量应为 1 至 100000 的整数',cents:0,complete:false};if(l.unitPriceCents!==null&&(!Number.isSafeInteger(l.unitPriceCents)||l.unitPriceCents<0||l.unitPriceCents>100000000000))return {error:'报价无效，请填写最多两位小数的非负金额',cents:0,complete:false};cents+=l.quantity*(l.unitPriceCents||0);if(!Number.isSafeInteger(cents))return {error:'合计超出可计算范围',cents:0,complete:false}}
 return {error:'',cents,complete:lines.every(l=>l.unitPriceCents!==null)} }
export function writeGroup(data:AppData,input:GroupInput,revision:number,id:()=>string,now:string):WriteResult<BenefitGroup>{
 const old=data.benefitTypeGroups?.find(g=>g.id===input.id)
 if(input.id&&!old||revision!==(old?.revision||0))return {ok:false,message:'权益包已变更，请重新打开核对；输入保留'}
 const selected=input.commonSpuIds===undefined?commonIds(old||{}):input.commonSpuIds
 const problem=typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>80?'名称须为 1 至 80 个字符':groupTypesProblem(data,input.categoryId,input.productTypeIds)||(JSON.stringify(selected)!==JSON.stringify(commonIds(old||{}))?commonSpusProblem(data,selected):'')||(!Number.isSafeInteger(input.sort)||Math.abs(input.sort)>100000?'排序无效':'')
 if(problem)return {ok:false,message:problem}
 const record:BenefitGroup={id:old?.id||id(),name:input.name.trim(),categoryId:input.categoryId,productTypeIds:[...input.productTypeIds],enabled:!!input.enabled,sort:input.sort,revision:revision+1,createdAt:old?.createdAt||now,updatedAt:now}
 if(input.commonSpuIds!==undefined||old?.commonSpuIds!==undefined)record.commonSpuIds=[...selected]
 data.benefitTypeGroups=[...(data.benefitTypeGroups||[]).filter(g=>g.id!==record.id),record];return {ok:true,record}
}
export function deleteGroup(data:AppData,id:string,revision:number):{ok:true}|{ok:false;message:string}{
 const group=data.benefitTypeGroups?.find(g=>g.id===id)
 if(!group)return {ok:false,message:'权益包已不存在，请刷新列表。'}
 if(group.revision!==revision)return {ok:false,message:'权益包已被修改，请重新核对后删除。'}
 data.benefitTypeGroups=data.benefitTypeGroups!.filter(g=>g.id!==id)
 return {ok:true}
}
/** Validate only the new namespaces; old raw fields remain opaque and untouched. */
export function benefitStorageProblems(data:AppData):string[]{
 const errors:string[]=[]
 for(const key of ['benefitTypeGroups','benefitSalesLists'] as const){const rows=data[key];if(rows===undefined)continue;if(!Array.isArray(rows)){errors.push('权益包数据集合格式无效');continue}const ids=new Set<string>();for(const row of rows){if(!row||typeof row.id!=='string'||!row.id||ids.has(row.id)||!Number.isSafeInteger(row.revision)||row.revision<1||typeof row.createdAt!=='string'||typeof row.updatedAt!=='string'){errors.push('权益包记录身份或修订无效');continue}ids.add(row.id)
  if(key==='benefitTypeGroups'){const g=row as BenefitGroup;if(typeof g.name!=='string'||!g.name.trim()||g.name.length>80||typeof g.categoryId!=='string'||!validIds(g.productTypeIds)||g.commonSpuIds!==undefined&&!validCommonIds(g.commonSpuIds)||typeof g.enabled!=='boolean'||!Number.isSafeInteger(g.sort)||Object.keys(g).some(k=>!['id','name','categoryId','productTypeIds','commonSpuIds','enabled','sort','revision','createdAt','updatedAt'].includes(k)))errors.push('权益包类型组合格式无效')}
  else {const s=row as BenefitSale;if(!s.scope||!['free','group'].includes(s.scope.mode)||typeof s.scope.categoryId!=='string'||!validSaleTypes(s.scope)||s.scope.commonSpuIds!==undefined&&!validCommonIds(s.scope.commonSpuIds)||s.scope.mode==='group'&&typeof s.scope.groupId!=='string'||!validDevice(s.scope.device)||!['draft','confirmed'].includes(s.status)||!Array.isArray(s.lines)||!s.lines.length||s.lines.some(l=>!l||typeof l.skuId!=='string')||new Set(s.lines.map(l=>l.skuId)).size!==s.lines.length||total(s.lines).error){errors.push('销售清单格式无效');continue}
   if(s.status==='confirmed'){const snap=s.snapshot;if(!snap||!total(s.lines).complete||snap.totalCents!==total(s.lines).cents||JSON.stringify(snap.scope)!==JSON.stringify(s.scope)||!Array.isArray(snap.lines)||JSON.stringify(snap.lines.map(({skuId,quantity,unitPriceCents})=>({skuId,quantity,unitPriceCents})))!==JSON.stringify(s.lines)||snap.lines.some(l=>typeof l.name!=='string'||typeof l.spec!=='string')||typeof snap.confirmedAt!=='string')errors.push('确认快照无效')}
  }
 }}return errors
}
function validIds(v:unknown):v is string[]{return Array.isArray(v)&&v.length>0&&v.every(x=>typeof x==='string'&&!!x)&&new Set(v).size===v.length}
function validSaleTypes(scope:SaleScope){if(!Array.isArray(scope.productTypeIds))return false;if(!scope.productTypeIds.length)return scope.mode==='free'&&validCommonIds(scope.commonSpuIds)&&scope.commonSpuIds.length>0;return validIds(scope.productTypeIds)}
function validDevice(v:SaleScope['device']){return v===null||!!v&&(v.kind==='sku'?typeof v.skuId==='string'&&!!v.skuId:v.kind==='model'&&typeof v.key==='string'&&!!v.key)}

export function priceCents(text:string):number|null|undefined{if(!text.trim())return null;if(!/^\d+(?:\.\d{1,2})?$/.test(text.trim()))return undefined;const [a,b='']=text.trim().split('.'),n=Number(a)*100+Number(b.padEnd(2,'0'));return Number.isSafeInteger(n)&&n<=100000000000?n:undefined}

export function scopeProblem(data:AppData,scope:SaleScope){return !scope||!['free','group'].includes(scope.mode)?'选择有效的使用方式':saleTypesProblem(data,scope)||(scope.commonSpuIds!==undefined&&!validCommonIds(scope.commonSpuIds)?'公共 SPU 引用格式无效或重复':'')}

export function reviewLines(data:AppData,scope:SaleScope,lines:SaleLine[]){const query=saleQuery(data,scope),allowed=new Set(query.candidates.map(c=>c.id));return {query,issues:lines.filter(l=>!allowed.has(l.skuId)).map(l=>({skuId:l.skuId,reason:query.groups.flatMap(g=>g.diagnostics).find(d=>d.id===l.skuId)?.reason||'不在本次允许的产品类型范围内'}))}}

export function writeSale(data:AppData,input:SaleInput,revision:number,id:()=>string,now:string):WriteResult<BenefitSale>{
 const old=data.benefitSalesLists?.find(s=>s.id===input.id)
 if(input.id&&!old||revision!==(old?.revision||0))return {ok:false,message:'清单已变更，请重新打开核对；输入保留'}
 if(old?.status==='confirmed')return {ok:false,message:'已确认清单只读，请复制为新草稿'}
 const problem=scopeProblem(data,input.scope)
 if(problem)return {ok:false,message:problem}
 if(!Array.isArray(input.lines)||!input.lines.length||new Set(input.lines.map(l=>l.skuId)).size!==input.lines.length)return {ok:false,message:'请添加商品，清单商品不能重复'}
 if(!['draft','confirmed'].includes(input.status))return {ok:false,message:'清单状态无效'}
 const group=data.benefitTypeGroups?.find(g=>g.id===input.scope.groupId)
 const retained=old?.scope.mode==='group'&&old.scope.groupId===input.scope.groupId&&JSON.stringify(old.scope.productTypeIds)===JSON.stringify(input.scope.productTypeIds)
 if(input.scope.mode==='group'&&!retained&&(!group?.enabled||JSON.stringify(group.productTypeIds)!==JSON.stringify(input.scope.productTypeIds)))return {ok:false,message:'权益包已停用或内容变化，请明确重新采用最新类型后核对'}
 const {query,issues}=reviewLines(data,input.scope,input.lines);if(issues.length)return {ok:false,message:issues.map(i=>`${i.skuId}：${i.reason}`).join('；')}
 const amount=total(input.lines);if(amount.error||input.status==='confirmed'&&!amount.complete)return {ok:false,message:amount.error||'确认前请补齐全部报价'}
 const usedPublicIds=[...new Set(input.lines.flatMap(line=>query.candidates.find(c=>c.id===line.skuId)!.publicSpuIds))],savedScope=copy(input.scope)
 if(usedPublicIds.length||savedScope.commonSpuIds!==undefined)savedScope.commonSpuIds=usedPublicIds
 const record:BenefitSale={id:old?.id||id(),scope:savedScope,lines:copy(input.lines),status:input.status,revision:revision+1,createdAt:old?.createdAt||now,updatedAt:now}
 if(input.status==='confirmed')record.snapshot={device:copy(query.device),scope:copy(savedScope),groupName:group?.name,lines:input.lines.map(l=>{const c=query.candidates.find(c=>c.id===l.skuId)!;return {...copy(l),name:c.name,code:c.code,spec:c.spec,declarations:copy(c.match?.declarations||[]),evidence:copy(c.match?.evidence||[]),capabilities:copy(c.match?.capabilities||[]),...(usedPublicIds.length?{sources:copy(c.sources)}:{})}}),totalCents:amount.cents,confirmedAt:now}
 if(record.snapshot&&usedPublicIds.length)record.snapshot.commonSpus=usedPublicIds.map(spuId=>({spuId,name:data.families.find(f=>f.id===spuId)?.name||'公共商品引用已失效'}))
 data.benefitSalesLists=[...(data.benefitSalesLists||[]).filter(s=>s.id!==record.id),record];return {ok:true,record}
}
