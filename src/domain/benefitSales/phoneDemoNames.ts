import type {AppData} from '../types'
import {cloneRecord} from '../recordCopy'
export const phoneDemoNameKeys=['params','productTypes','templates','specCanvases','specModelVersions','planningRecords','families','skus','benefitTypeGroups'] as const
const label=(text:string)=>text.replace(/（18演示）|（演示）/g,'').replace(/\s*·\s*(?:18演示|演示)(?=$|\s*·)/g,'').trim()
/** Rename only the owned sample records and their display aliases; IDs and confirmed snapshots are untouched. */
export function cleanPhoneDemoNames(current:AppData){
 const next=cloneRecord(current),aliases=new Map<string,string>()
 for(const p of next.params.filter(p=>p.id.startsWith('demo18-'))){const name=label(p.name);if(name!==p.name)aliases.set(p.name,name);p.name=name}
 function attrs(value:Record<string,string>){const result:Record<string,string>={};for(const [key,value0]of Object.entries(value)){const name=aliases.get(key)||key;if(result[name]!==undefined&&result[name]!==value0)throw Error(`参数名称 ${name} 存在不同值，未覆盖记录`);result[name]=value0}return result}
 try{
  for(const key of ['productTypes','templates','families','benefitTypeGroups'] as const)for(const row of next[key]||[])if(row.id.startsWith('demo18-'))row.name=label(row.name)
  for(const canvas of next.specCanvases)if(canvas.templateId.startsWith('demo18-')&&canvas.name)canvas.name=label(canvas.name)
  for(const version of next.specModelVersions)if(version.templateId.startsWith('demo18-'))version.attributeNames?.forEach(a=>{a.name=label(a.name)})
  for(const plan of next.planningRecords)if(plan.productModelId.startsWith('demo18-'))plan.steps.forEach(s=>{s.attributeName=label(s.attributeName)})
  for(const family of next.families)if(family.id.startsWith('demo18-'))family.commonAttrs=attrs(family.commonAttrs)
  for(const sku of next.skus)if(sku.id.startsWith('demo18-')){if(sku.skuName)sku.skuName=label(sku.skuName);sku.variantAttrs=attrs(sku.variantAttrs);sku.projectedAttrs=attrs(sku.projectedAttrs)}
  const changed=JSON.stringify(phoneDemoNameKeys.map(key=>current[key]))!==JSON.stringify(phoneDemoNameKeys.map(key=>next[key]))
  return {ok:true as const,next,changed}
 }catch(error){return {ok:false as const,message:error instanceof Error?error.message:String(error)}}
}
