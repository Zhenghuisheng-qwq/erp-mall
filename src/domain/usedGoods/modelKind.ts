import type {AppData,ProductSpecNode} from '../types'
/** Eligibility belongs to the category (including descendants), never to a model name or id. */
export function isUsedCategory(data:AppData,categoryId:string){let category=data.categories.find(c=>c.id===categoryId);const seen=new Set<string>();while(category&&!seen.has(category.id)){if(category.goodsCondition)return category.goodsCondition==='used';seen.add(category.id);category=data.categories.find(c=>c.id===category!.parentId)}return false}
export function isUsedModel(data:AppData,id:string){const model=data.specCanvases.find(m=>m.templateId===id),type=data.productTypes.find(t=>t.id===model?.productTypeId);return !!type&&isUsedCategory(data,type.categoryId)}
export const isKeyOnlyUsedModel=(data:AppData,id:string,nodes:ProductSpecNode[])=>isUsedModel(data,id)&&nodes.length>0&&nodes.every(n=>n.nodeType==='ATTRIBUTE'&&!n.valueId)
