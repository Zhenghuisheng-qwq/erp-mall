import type {AppData} from '../types'
import {cloneRecord} from '../recordCopy'
export const phoneDemoNameKeys=['params','productTypes','templates','specCanvases','specModelVersions','planningRecords','families','skus','benefitTypeGroups','compatibilities','generalCompatibilityClaims','brands'] as const
const owned=(id:string)=>id.startsWith('demo18-')||id.startsWith('huawei-')
const label=(text:string)=>text.replace(/（18演示）|（演示）/g,'').replace(/\s*·\s*(?:18演示|演示)(?=$|\s*·)/g,'').trim()
/** Rename only the owned sample records and their display aliases; IDs and confirmed snapshots are untouched. */
export function cleanPhoneDemoNames(current:AppData){
 const next=cloneRecord(current),aliases=new Map<string,string>()
 for(const p of next.params.filter(p=>owned(p.id))){const name=label(p.name);if(name!==p.name)aliases.set(p.name,name);p.name=name}
 function attrs(value:Record<string,string>){const result:Record<string,string>={};for(const [key,value0]of Object.entries(value)){const name=aliases.get(key)||key;if(result[name]!==undefined&&result[name]!==value0)throw Error(`参数名称 ${name} 存在不同值，未覆盖记录`);result[name]=value0}return result}
 try{
  for(const key of ['productTypes','templates','families','benefitTypeGroups'] as const)for(const row of next[key]||[])if(owned(row.id))row.name=label(row.name)
  for(const canvas of next.specCanvases)if(canvas.templateId.startsWith('demo18-')&&canvas.name)canvas.name=label(canvas.name)
  for(const version of next.specModelVersions)if(version.templateId.startsWith('demo18-'))version.attributeNames?.forEach(a=>{a.name=label(a.name)})
  for(const plan of next.planningRecords)if(plan.productModelId.startsWith('demo18-'))plan.steps.forEach(s=>{s.attributeName=label(s.attributeName)})
  for(const family of next.families)if(owned(family.id))family.commonAttrs=attrs(family.commonAttrs)
  for(const sku of next.skus)if(owned(sku.id)){if(sku.skuName)sku.skuName=label(sku.skuName);sku.variantAttrs=attrs(sku.variantAttrs);sku.projectedAttrs=attrs(sku.projectedAttrs)}
  for(const row of [...next.compatibilities,...(next.generalCompatibilityClaims||[])])if(owned(row.id)){
   if(row.source==='仅供 ERP 软件演示：型号及规格均为模拟数据，不代表真实供应商核验或商品承诺。')row.source='内部流程验证资料：用于系统功能验收，不构成真实供应商适用承诺。'
   if(row.note==='仅演示必要接口事实核验，不推测快充')row.note='仅核验必要接口事实，不推测快充'
  }
  for(const brand of next.brands)if(brand.id==='brand-demo18-apple'&&brand.description==='软件演示品牌')brand.description='手机品牌'
  const changed=JSON.stringify(phoneDemoNameKeys.map(key=>current[key]))!==JSON.stringify(phoneDemoNameKeys.map(key=>next[key]))
  return {ok:true as const,next,changed}
 }catch(error){return {ok:false as const,message:error instanceof Error?error.message:String(error)}}
}
