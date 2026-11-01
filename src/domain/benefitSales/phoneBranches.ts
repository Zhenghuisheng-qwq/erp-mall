import type {AppData} from '../types'
import {categoryChain} from '../categoryTree'
import {categoryBehavior} from '../categoryPurposes'
import {familyProductTypeId} from '../productIdentity'
export const categoryWithin=(data:AppData,id:string,parentId:string)=>categoryChain(data.categories,id).some(c=>c.id===parentId)
export const categoryGoodsCondition=(data:AppData,id:string)=>categoryChain(data.categories,id).reverse().find(c=>c.goodsCondition)?.goodsCondition
export function upgradePhoneBranches(data:AppData){
 if(data.phoneCategoryBranchesVersion===1)return false
 const phone=data.categories.find(c=>c.id==='c-phone')
 if(!phone||categoryBehavior(data,phone.id)!=='host')return false
 const existingNew=data.categories.find(c=>c.parentId===phone.id&&(c.goodsCondition==='new'||c.name==='新机'))
 const existingUsed=data.categories.find(c=>c.parentId===phone.id&&(c.goodsCondition==='used'||c.name==='二手机'))
 const newId=existingNew?.id||'phone-new',usedId=existingUsed?.id||'phone-used'
 if(!existingNew&&data.categories.some(c=>c.id===newId)||!existingUsed&&data.categories.some(c=>c.id===usedId))throw Error('新机或二手机分类编号已占用，请先核对分类')
 for(const [id,name,condition,existing] of [[newId,'新机','new',existingNew],[usedId,'二手机','used',existingUsed]] as const){
  if(existing){existing.goodsCondition=condition;existing.purposeId=phone.purposeId;existing.catalogRole=phone.catalogRole}
  else data.categories.push({id,name,parentId:phone.id,sort:condition==='new'?1:2,enabled:true,purposeId:phone.purposeId,catalogRole:phone.catalogRole,goodsCondition:condition})
 }
 const movedTypes=new Set(data.productTypes.filter(t=>t.categoryId===phone.id).map(t=>t.id))
 const familyIds=new Set(data.families.filter(f=>movedTypes.has(familyProductTypeId(data,f.id))).map(f=>f.id))
 for(const type of data.productTypes)if(movedTypes.has(type.id))type.categoryId=newId
 for(const family of data.families)if(familyIds.has(family.id))family.categoryId=newId
 // Model/version identities and confirmed sale snapshots keep their original source records.
 data.phoneCategoryBranchesVersion=1
 return true
}
