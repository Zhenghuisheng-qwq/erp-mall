import {familyProductTypeId} from '../productIdentity'
import type {AppData} from '../types'
import type {SaleScope,SaleDevice} from './types'
import {isRealSku} from '../catalogIdentity'
import {projectAttrs,shelfOf} from '../logic'
import {listDeviceModels} from '../deviceResolution'
import {queryDeviceAccessories,queryModelAccessories,accessoryUseEvaluation} from '../accessoryCompatibilityQuery'
import type {AccessoryMatch} from '../accessoryCompatibilityTypes'
export function categoryProblem(data:AppData,id:string){
 const seen=new Set<string>();let current:string|null=id
 while(current){const rows=data.categories.filter(c=>c.id===current);if(rows.length!==1||seen.has(current))return '分类不存在或层级引用无效';seen.add(current);current=rows[0]!.parentId}
 return seen.size?'':'请选择归属分类'
}
export function typeProblem(data:AppData,id:string){const rows=data.productTypes.filter(t=>t.id===id);if(rows.length!==1)return '产品类型不存在或身份冲突';const t=rows[0]!;return t.status!=='enabled'?'产品类型已停用':categoryProblem(data,t.categoryId)}
export function typesProblem(data:AppData,ids:string[]){return !Array.isArray(ids)||!ids.length?'请选择参与的产品类型':new Set(ids).size!==ids.length?'产品类型不能重复':ids.map(id=>typeProblem(data,id)).find(Boolean)||''}
export function groupTypesProblem(data:AppData,categoryId:string,ids:string[]){
 const problem=categoryProblem(data,categoryId)||typesProblem(data,ids)
 if(problem)return problem
 const outside=ids.filter(id=>data.productTypes.find(t=>t.id===id)?.categoryId!==categoryId)
 return outside.length?`权益包只能选择归属分类下的产品类型，请移除：${outside.map(id=>data.productTypes.find(t=>t.id===id)?.name||id).join('、')}`:''
}
export function saleLabel(data:AppData,id:string){const s=data.skus.find(x=>x.id===id),f=data.families.find(x=>x.id===s?.familyId);return {name:s?.skuName||f?.name||'商品已失效',code:s?.code||'',spec:s&&f?Object.entries(projectAttrs(f,s)).map(([k,v])=>`${data.params.find(p=>p.id===k)?.name||k} ${v}`).join(' · '):''}}
export function saleProblem(data:AppData,id:string){const rows=data.skus.filter(s=>s.id===id),s=rows[0],f=data.families.find(f=>f.id===s?.familyId);if(rows.length!==1||!s||!f||!isRealSku(data,s))return '不是有效的真实销售商品';return typeProblem(data,familyProductTypeId(data,f.id))||(!['host','accessory','other'].includes(data.productTypes.find(t=>t.id===familyProductTypeId(data,f.id))?.catalogRole||'')?'商品用途尚未明确':'')||(s.status!=='on_sale'||shelfOf(f)!=='online'?'商品当前不可售':'')}
export function deviceOptions(data:AppData){return {skus:data.skus.filter(s=>isRealSku(data,s)&&data.productTypes.find(t=>t.id===familyProductTypeId(data,s.familyId))?.catalogRole==='host').map(s=>({id:s.id,...saleLabel(data,s.id)})),models:listDeviceModels(data)}}
export function deviceKey(device:SaleDevice){return device?device.kind==='sku'?`sku:${device.skuId}`:`model:${device.key}`:''}
export function deviceFromKey(key:string):SaleDevice{return key.startsWith('sku:')?{kind:'sku',skuId:key.slice(4)}:key.startsWith('model:')?{kind:'model',key:key.slice(6)}:null}
export function saleQuery(data:AppData,scope:SaleScope){
 const error=scope.mode==='group'?groupTypesProblem(data,scope.categoryId,scope.productTypeIds):typesProblem(data,scope.productTypeIds)
 const query=scope.device?.kind==='sku'?queryDeviceAccessories(data,scope.device.skuId):scope.device?.kind==='model'?queryModelAccessories(data,listDeviceModels(data).find(m=>m.key===(scope.device as {key:string}).key)?.host):null
 return evaluate(data,scope,error,query)
}
/** Packages share type sets; the device is only a query context, never a package binding. */
export function availableBenefitGroups(data:AppData,device:SaleDevice){
 const result=saleQuery(data,{mode:'free',categoryId:'',productTypeIds:data.productTypes.filter(t=>!typeProblem(data,t.id)).map(t=>t.id),device})
 const categoryId=data.productTypes.find(t=>t.id===result.device?.host?.productTypeId)?.categoryId
 if(!categoryId||result.device?.status!=='resolved')return []
 const ready=new Set(result.groups.filter(g=>g.candidates.length).map(g=>g.id))
 if(result.device.host)ready.add(result.device.host.productTypeId)
 return (data.benefitTypeGroups||[]).filter(g=>g.enabled&&g.categoryId===categoryId&&!groupTypesProblem(data,g.categoryId,g.productTypeIds)&&g.productTypeIds.some(id=>ready.has(id))).map(g=>({...g,missingTypes:g.productTypeIds.filter(id=>!ready.has(id))})).sort((a,b)=>a.missingTypes.length-b.missingTypes.length||a.sort-b.sort||a.name.localeCompare(b.name))
}
function evaluate(data:AppData,scope:SaleScope,error:string,query:ReturnType<typeof queryDeviceAccessories>|null){
 const matches=new Map<string,AccessoryMatch>();for(const m of [...query?.sales||[],...query?.pending||[],...query?.excluded||[],...query?.unavailable||[]])if(m.target.kind==='sku')matches.set(m.sku.id,m)
 const invalid=new Set((query?.issues||[]).flatMap(i=>{const l=data.compatibilities.find(l=>l.id===i.declarationId);return l?[l.targetId||l.accessorySkuId]:[]}))
 const groups=scope.productTypeIds.map(id=>({id,name:data.productTypes.find(t=>t.id===id)?.name||'类型已失效',candidates:[] as {id:string;name:string;spec:string;code:string;note:string;match?:AccessoryMatch}[],diagnostics:[] as {id:string;name:string;reason:string}[],empty:''}))
 for(const g of groups){const type=data.productTypes.find(t=>t.id===g.id),families=data.families.filter(f=>familyProductTypeId(data,f.id)===g.id),ids=new Set(families.map(f=>f.id)),skus=data.skus.filter(s=>ids.has(s.familyId));let sellable=0,unknown=false
  for(const s of skus){if(!isRealSku(data,s))continue;const match=matches.get(s.id),use=accessoryUseEvaluation(match);let reason=error||saleProblem(data,s.id);if(!reason)sellable++
   if(!reason&&type?.catalogRole==='host'){if(scope.device?.kind!=='sku'||scope.device.skuId!==s.id)reason='这条设备不是本次选择的实际规格';else if(query?.device.status!=='resolved')reason='设备身份无法唯一识别，请先核对'}
   if(!reason&&type?.catalogRole==='accessory'){
    if(query?.device.host&&typeProblem(data,query.device.host.productTypeId))reason='设备产品类型已失效或停用'
    else if(!query||query.device.status!=='resolved')reason=query?.device.message||'请先选择明确的本次使用设备'
    else if(invalid.has(s.id))reason='适用资料存在失效引用，需核对'
    else if(use.conflict)reason='正式适用资料存在阻断冲突'
    else if(use.missingBasic)reason=query.generalDiagnostics?.find(d=>d.skuId===s.id)?.reason||'尚无当前设备的已确认基本适用依据'
    else if(use.status==='incompatible')reason='存在生效的明确不适用依据'
    else if(use.status==='pending'||use.status==='conditional'&&!(use.basic.evidence?use.basic.evidence.some(e=>e.effective&&e.record.conclusion!=='incompatible'):use.conditions.every(c=>c.state==='met'))){reason=use.evidence?.filter(e=>e.kind==='general'&&!e.effective).map(e=>[e.reason,...e.conditions.filter(c=>c.state!=='met').map(c=>c.label)].join('；')).join('；')||'必要条件或适用资料待核验';unknown=true}
    else if(use.status!=='compatible'&&use.status!=='conditional')reason='当前暂无已确认可选商品'
   }
   if(reason)g.diagnostics.push({id:s.id,name:saleLabel(data,s.id).name,reason})
   else g.candidates.push({id:s.id,...saleLabel(data,s.id),match,note:type?.catalogRole==='host'?'明确加入设备，不要求自适用声明':type?.catalogRole==='accessory'?`基本使用已确认${use.fastCharge.declarations?.length?'；快充'+(use.fastCharge.status==='compatible'?'已确认':'未确认'):''}`:'独立销售商品'})
  }
  g.empty=!families.length?'当前类型尚无商品建档':!sellable?'已建档但没有可售 SKU':unknown?'条件待核验':type?.catalogRole==='host'?'选择实际设备规格后可明确加入':'当前暂无已确认可选商品'
 }
 return {error,compatibility:query,device:query?.device||null,groups,candidates:groups.flatMap(g=>g.candidates)}
}
