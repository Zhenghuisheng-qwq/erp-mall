import {categoryWithin} from './phoneBranches'
import {rangeProblem,groupRangeTypes} from './categoryRanges'
import {categoryBehavior} from '../categoryPurposes'
import {roleOfType} from '../productTypePurpose'
import {commonIds,validCommonIds,publicReferenceProblem,enabledPublicSpuIds} from './publicSpuPool'
import {familyProductTypeId} from '../productIdentity'
import type {AppData} from '../types'
import type {SaleScope,SaleDevice} from './types'
import {isRealSku} from '../catalogIdentity'
import {projectAttrs,shelfOf} from '../logic'
import {listDeviceModels,catalogDeviceOptions,resolveDeviceSku} from '../catalogDevices'
export {categoryAvailabilityProblem as categoryProblem,productTypeAvailabilityProblem as typeProblem} from '../productTypePurpose'
import {categoryAvailabilityProblem as categoryProblem,productTypeAvailabilityProblem as typeProblem} from '../productTypePurpose'
export function typesProblem(data:AppData,ids:string[]){return !Array.isArray(ids)||!ids.length?'请选择参与的产品类型':new Set(ids).size!==ids.length?'产品类型不能重复':ids.map(id=>typeProblem(data,id)).find(Boolean)||''}
export function groupTypesProblem(data:AppData,categoryId:string,ids:string[]){
 const problem=categoryProblem(data,categoryId)||typesProblem(data,ids)
 if(problem)return problem
 const ownerRole=categoryBehavior(data,categoryId)
 if(ownerRole&&ownerRole!=='host')return '权益包入口请选择主机分类'
 const outside=ids.filter(id=>{const t=data.productTypes.find(t=>t.id===id)!;return t.categoryId!==categoryId&&roleOfType(data,id)!=='accessory'})
 return outside.length?'跨分类仅可选择配件产品类型（含增值业务），请先配置分类用途':''

}
export function saleLabel(data:AppData,id:string){const s=data.skus.find(x=>x.id===id),f=data.families.find(x=>x.id===s?.familyId);return {name:s?.skuName||f?.name||'商品已失效',code:s?.code||'',spec:s&&f?Object.entries(projectAttrs(f,s)).map(([k,v])=>`${data.params.find(p=>p.id===k)?.name||k} ${v}`).join(' · '):''}}
export function saleProblem(data:AppData,id:string,requireRole=true){const rows=data.skus.filter(s=>s.id===id),s=rows[0],f=data.families.find(f=>f.id===s?.familyId);if(rows.length!==1||!s||!f||!isRealSku(data,s))return '不是有效的真实销售商品';const type=data.productTypes.find(t=>t.id===familyProductTypeId(data,f.id));const role=categoryBehavior(data,type?.categoryId||'')||type?.catalogRole||'';return typeProblem(data,familyProductTypeId(data,f.id))||(requireRole&&!['host','accessory','other'].includes(role)?'商品用途尚未明确':'')||(s.status!=='on_sale'||shelfOf(f)!=='online'?'商品当前不可售':'')}
export const deviceOptions=catalogDeviceOptions
export function deviceKey(device:SaleDevice){return device?device.kind==='sku'?`sku:${device.skuId}`:`model:${device.key}`:''}
export function deviceFromKey(key:string):SaleDevice{return key.startsWith('sku:')?{kind:'sku',skuId:key.slice(4)}:key.startsWith('model:')?{kind:'model',key:key.slice(6)}:null}
export function saleTypesProblem(data:AppData,scope:SaleScope){
 if(scope.purchaseMode!==undefined&&!['host_only','with_accessories'].includes(scope.purchaseMode))return '请选择有效的组合方式'
 const group=data.benefitTypeGroups?.find(g=>g.id===scope.groupId)
 if(!group?.enabled||rangeProblem(data,group.categoryId,group.accessoryCategoryIds))return '请选择有效的主机配件选购范围'
 if(scope.categoryId!==group.categoryId)return '主机分类与选购范围不一致'
 const allowed=groupRangeTypes(data,group)
 if(!Array.isArray(scope.productTypeIds)||scope.productTypeIds.some(id=>!allowed.includes(id)))return '产品类型超出配置的选购范围'
 return typesProblem(data,scope.productTypeIds)
}
export function selectedDevice(data:AppData,device:SaleDevice){
 if(device?.kind==='sku')return resolveDeviceSku(data,device.skuId)
 if(device?.kind==='model'){const option=listDeviceModels(data).find(m=>m.key===device.key);return {status:option?'resolved' as const:'invalid' as const,host:option?.host,message:option?'':'型号不存在'}}
 return null
}
export function saleQuery(data:AppData,scope:SaleScope){
 const device=selectedDevice(data,scope.device),categoryId=data.productTypes.find(t=>t.id===device?.host?.productTypeId)?.categoryId
 const error=saleTypesProblem(data,scope)||(scope.commonSpuIds!==undefined&&!validCommonIds(scope.commonSpuIds)?'公共 SPU 引用格式无效或重复':'')||(device?.status==='resolved'&&!categoryWithin(data,categoryId||'',scope.categoryId)?'设备不属于本次主机分类':'')
 const publicIds=enabledPublicSpuIds(data).filter(id=>scope.productTypeIds.includes(familyProductTypeId(data,id)))
 const displayed=[...new Set([...publicIds,...(validCommonIds(commonIds(scope))?commonIds(scope).filter(id=>scope.productTypeIds.includes(familyProductTypeId(data,id))):[])])]
 const groups=[...scope.productTypeIds.map(id=>({id,name:data.productTypes.find(t=>t.id===id)?.name||'类型已失效',kind:'type' as const,spuId:''})),...displayed.map(id=>({id:'public:'+id,name:data.families.find(f=>f.id===id)?.name||'公共商品已失效',kind:'public' as const,spuId:id}))].map(g=>({...g,candidates:[] as {id:string;name:string;spec:string;code:string;note:string;publicSpuIds:string[];sources:{kind:'type'|'public';id:string;name:string}[]}[],diagnostics:[] as {id:string;name:string;reason:string}[],empty:''}))
 const seen=new Set<string>()
 for(const g of groups){const families=data.families.filter(f=>g.kind==='public'?f.id===g.spuId:familyProductTypeId(data,f.id)===g.id),ids=new Set(families.map(f=>f.id)),skus=data.skus.filter(s=>ids.has(s.familyId)&&isRealSku(data,s)),referenceProblem=g.kind==='public'?publicReferenceProblem(data,g.spuId):''
 for(const sku of skus){const typeId=familyProductTypeId(data,sku.familyId),role=roleOfType(data,typeId);let reason=error||referenceProblem||saleProblem(data,sku.id,g.kind!=='public')
 if(!reason&&scope.purchaseMode==='host_only'&&role!=='host')reason='本次仅选主机'
 if(!reason&&role==='host'&&(scope.device?.kind!=='sku'||scope.device.skuId!==sku.id))reason='这条设备不是本次选择的实际规格'
 if(!reason&&device?.status!=='resolved')reason='请先选择本次主机'
 if(reason){g.diagnostics.push({id:sku.id,name:saleLabel(data,sku.id).name,reason});continue}
 if(seen.has(sku.id))continue;seen.add(sku.id)
 const type=data.productTypes.find(t=>t.id===typeId)!,publicSpuIds=publicIds.filter(id=>id===sku.familyId)
 const sources=[...(scope.productTypeIds.includes(typeId)?[{kind:'type' as const,id:typeId,name:type.name}]:[]),...publicSpuIds.map(id=>({kind:'public' as const,id,name:data.families.find(f=>f.id===id)!.name}))]
 g.candidates.push({id:sku.id,...saleLabel(data,sku.id),publicSpuIds,sources,note:'范围内可售商品'})
 }
 g.empty=referenceProblem||(!families.length?'当前类型尚无商品建档':!skus.length?'暂无可选规格':!g.candidates.length?'当前范围暂无可售商品':'')
 }
 return {error,device,publicSpuIds:publicIds,groups,candidates:groups.flatMap(g=>g.candidates)}
}
export function availableBenefitGroups(data:AppData,device:SaleDevice){
 const result=selectedDevice(data,device),categoryId=data.productTypes.find(t=>t.id===result?.host?.productTypeId)?.categoryId
 if(!categoryId||result?.status!=='resolved')return []
 return (data.benefitTypeGroups||[]).filter(g=>g.enabled&&categoryWithin(data,categoryId,g.categoryId)&&!rangeProblem(data,g.categoryId,g.accessoryCategoryIds)).map(g=>({...g,productTypeIds:groupRangeTypes(data,g),missingTypes:[] as string[]})).sort((a,b)=>a.sort-b.sort)
}
