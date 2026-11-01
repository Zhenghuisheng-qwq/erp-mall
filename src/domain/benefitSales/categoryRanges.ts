import {categoryWithin} from './phoneBranches'
import type {AppData} from '../types'
import type {BenefitGroup} from './types'
import {categoryBehavior} from '../categoryPurposes'
import {productTypeAvailabilityProblem} from '../productTypePurpose'
export function rangeTypes(data:AppData,categoryId:string,accessoryCategoryIds:string[]){const ids=new Set([categoryId,...accessoryCategoryIds]);return data.productTypes.filter(t=>(ids.has(t.categoryId)||categoryWithin(data,t.categoryId,categoryId)&&categoryBehavior(data,t.categoryId)==='host')&&!productTypeAvailabilityProblem(data,t.id)).map(t=>t.id)}
export function rangeProblem(data:AppData,categoryId:string,ids:unknown){
 if(data.categories.find(c=>c.id===categoryId)?.enabled===false||categoryBehavior(data,categoryId)!=='host')return '一级请选择已配置主机用途的分类'
 if(!Array.isArray(ids)||!ids.length||ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length)return '二级请选择配件分类，且不能重复'
 if(ids.some(id=>id===categoryId||categoryBehavior(data,id)!=='accessory'||data.categories.find(c=>c.id===id)?.enabled===false))return '二级只能关联配件用途的分类，不能关联主机分类'
 if(!rangeTypes(data,categoryId,ids).length)return '所选范围暂无启用的产品类型'
 return ''
}
export const groupRangeTypes=(data:AppData,g:BenefitGroup)=>g.accessoryCategoryIds?rangeTypes(data,g.categoryId,g.accessoryCategoryIds):[]
/** One-time replacement authorized for the category-range redesign. Sales history is preserved. */
export function upgradeBenefitRanges(data:AppData){
 if(data.benefitCategoryScopeVersion===1)return false
 data.benefitTypeGroups=[]
 data.benefitCategoryScopeVersion=1
 // Only the existing Apple/Huawei sample catalog is reorganized. Other categories are configured explicitly.
 if(data.phoneDemoCatalogVersion!==1)return true
 const host=data.categories.find(c=>c.id==='c-phone');if(!host)return true
 const purposes=data.categoryPurposes??[{id:'host',name:'主机',behavior:'host' as const},{id:'accessory',name:'配件 / 增值业务',behavior:'accessory' as const}]
 const hostPurpose=purposes.find(p=>p.behavior==='host'),accessoryPurpose=purposes.find(p=>p.behavior==='accessory');if(!hostPurpose||!accessoryPurpose)return true
 host.purposeId=hostPurpose.id;delete host.catalogRole
 const categoryIds:string[]=[]
 for(const [id,name,typeIds] of [['benefit-protection','保护及保护设备',['pt-case','pt-film']],['benefit-power','电源与线缆',['pt-leaf-c-charge']]] as const){
  if(!data.categories.some(c=>c.id===id))data.categories.push({id,name,parentId:null,sort:categoryIds.length+2,enabled:true,purposeId:accessoryPurpose.id})
  categoryIds.push(id)
  for(const typeId of typeIds){const t=data.productTypes.find(t=>t.id===typeId);if(!t)continue;t.categoryId=id
   const models=new Set(data.specCanvases.filter(m=>m.productTypeId===typeId).map(m=>m.templateId))
   for(const family of data.families)if(family.productTypeId===typeId||models.has(family.productModelId||family.templateId))family.categoryId=id
  }
 }
 const now=new Date().toISOString()
 data.benefitTypeGroups=[{id:'phone-category-range',name:'手机配件选购范围',categoryId:host.id,accessoryCategoryIds:categoryIds,productTypeIds:rangeTypes(data,host.id,categoryIds),enabled:true,sort:0,revision:1,createdAt:now,updatedAt:now}]
 return true
}

export function rangeHostConflict(data:AppData,categoryId:string,recordId=''){
 const existing=data.benefitTypeGroups?.find(g=>g.categoryId===categoryId&&g.id!==recordId)
 return existing?`该主机分类已配置选购范围“${existing.name}”，请编辑已有范围，不能重复新建`:''
}
