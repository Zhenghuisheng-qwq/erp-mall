import type {AppData} from '../types'
import {isRealSku,isMaterialArchive} from '../catalogIdentity'
import {familyProductTypeId} from '../productIdentity'
import {categoryChain,categoryPathLabel} from '../categoryTree'
import {familyBrandValues} from '../productList'
import {shelfOf} from '../logic'

export interface PublicSpuEntry {spuId:string;enabled:boolean;revision:number;createdAt:string;updatedAt:string}
export const enabledPublicSpuIds=(data:AppData)=>[...new Set((data.publicSpuPool||[]).filter(entry=>entry.enabled).map(entry=>entry.spuId))]
export const commonIds=(value:{commonSpuIds?:string[]})=>value.commonSpuIds||[]
export function validCommonIds(value:unknown):value is string[]{return Array.isArray(value)&&value.every(id=>typeof id==='string'&&!!id.trim())&&new Set(value).size===value.length}
/** Family is the SPU identity, including subjects created by material filing.
 * Its line/origin and current child count do not turn the subject into a MAT.
 * Only isRealSku decides which children may become sales candidates. */
export function publicSpuProblem(data:AppData,id:string){
 const rows=data.families.filter(f=>f.id===id),f=rows[0]
 if(rows.length!==1||!f)return 'SPU 不存在或身份冲突'
 const typeId=familyProductTypeId(data,id),type=data.productTypes.filter(t=>t.id===typeId)
 if(type.length!==1||type[0]!.categoryId!==f.categoryId||data.categories.filter(c=>c.id===f.categoryId).length!==1)return 'SPU 的分类或产品类型引用失效'
 return ''
}
export function publicReferenceProblem(data:AppData,id:string){
 const entry=data.publicSpuPool?.filter(e=>e.spuId===id)||[]
 return publicSpuProblem(data,id)||(entry.length!==1?'商品未在公共池中或引用冲突':!entry[0]!.enabled?'公共商品已停用':'')
}
export function commonSpusProblem(data:AppData,value:unknown){return !validCommonIds(value)?'公共 SPU 引用格式无效或重复':value.map(id=>publicReferenceProblem(data,id)).find(Boolean)||''}
export const publicSpuReferences=(data:AppData,id:string)=>(data.benefitTypeGroups||[]).filter(g=>commonIds(g).includes(id))
export const publicPoolBasis=(data:AppData)=>JSON.stringify([data.publicSpuPool,data.families,data.skus,data.productTypes,data.categories,data.benefitTypeGroups])
export function addPublicSpus(data:AppData,ids:string[],basis:string,now:string){
 if(basis!==publicPoolBasis(data))return {ok:false as const,message:'商品或公共池已变化，请刷新候选后重试；已选内容保留。'}
 if(!validCommonIds(ids)||!ids.length)return {ok:false as const,message:'请至少选择一个真实 SPU，不能重复。'}
 const problem=ids.map(id=>publicSpuProblem(data,id)).find(Boolean);if(problem)return {ok:false as const,message:problem}
 const added=ids.filter(id=>!data.publicSpuPool?.some(e=>e.spuId===id))
 if(added.length)data.publicSpuPool=[...(data.publicSpuPool||[]),...added.map(spuId=>({spuId,enabled:true,revision:1,createdAt:now,updatedAt:now}))]
 return {ok:true as const,added:added.length,message:added.length?`已加入 ${added.length} 个公共 SPU`:'所选商品已在公共池中，未重复添加'}
}
export function updatePublicSpu(data:AppData,id:string,enabled:boolean,revision:number,now:string){
 const row=data.publicSpuPool?.find(e=>e.spuId===id)
 if(!row||row.revision!==revision)return {ok:false as const,message:'公共商品已变更，请刷新后重试。'}
 const problem=enabled?publicSpuProblem(data,id):'';if(problem)return {ok:false as const,message:problem}
 if(row.enabled!==enabled)Object.assign(row,{enabled,revision:revision+1,updatedAt:now})
 return {ok:true as const}
}
export function removePublicSpu(data:AppData,id:string,revision:number){
 const row=data.publicSpuPool?.find(e=>e.spuId===id)
 if(!row||row.revision!==revision)return {ok:false as const,message:'公共商品已变更，请刷新后重试。'}
 if(publicSpuReferences(data,id).length)return {ok:false as const,message:'此 SPU 仍被权益包引用，请先明确移除引用；也可以停用，原配置与历史保持。'}
 data.publicSpuPool=data.publicSpuPool!.filter(e=>e.spuId!==id);return {ok:true as const}
}
export function publicPoolStorageProblems(data:AppData){
 if(data.publicSpuPool===undefined)return []
 if(!Array.isArray(data.publicSpuPool))return ['公共商品池必须为数组']
 const ids=new Set<string>(),errors:string[]=[]
 for(const row of data.publicSpuPool){if(!row||typeof row.spuId!=='string'||!row.spuId||ids.has(row.spuId)||typeof row.enabled!=='boolean'||!Number.isSafeInteger(row.revision)||row.revision<1||typeof row.createdAt!=='string'||typeof row.updatedAt!=='string'||Object.keys(row).some(k=>!['spuId','enabled','revision','createdAt','updatedAt'].includes(k)))errors.push('公共商品池身份、修订或记录格式无效');if(row)ids.add(row.spuId)}
 return errors
}
export interface PublicSpuFilter {keyword:string;categoryId:string;productTypeId:string;modelId:string;brand:string;status:''|'on'|'off';joined:''|'yes'|'no'}
export const emptyPublicSpuFilter=():PublicSpuFilter=>({keyword:'',categoryId:'',productTypeId:'',modelId:'',brand:'',status:'',joined:''})
/** Read-only projection of the existing catalogue, not another product directory. */
export function publicSpuRows(data:AppData){return data.families.filter(f=>!publicSpuProblem(data,f.id)).map(f=>{
 const skus=data.skus.filter(s=>s.familyId===f.id&&isRealSku(data,s)),typeId=familyProductTypeId(data,f.id)
 return {id:f.id,name:f.name,code:f.oaProductId,typeId,typeName:data.productTypes.find(t=>t.id===typeId)?.name||'类型失效',categoryId:f.categoryId,categoryPath:categoryPathLabel(data.categories,f.categoryId),modelId:f.productModelId||f.templateId,brands:familyBrandValues(data,f),skuCount:skus.length,materialCount:data.skus.filter(s=>s.familyId===f.id&&isMaterialArchive(data,s)).length,onSale:shelfOf(f)==='online'&&skus.some(s=>s.status==='on_sale'),entry:data.publicSpuPool?.find(e=>e.spuId===f.id)}
})}
export function filterPublicSpus(data:AppData,filter:PublicSpuFilter,poolOnly=false){
 const needle=filter.keyword.trim().toLocaleLowerCase()
 return publicSpuRows(data).filter(r=>(!poolOnly||r.entry?.enabled)&&(!needle||`${r.name} ${r.id} ${r.code}`.toLocaleLowerCase().includes(needle))&&(!filter.categoryId||categoryChain(data.categories,r.categoryId).some(c=>c.id===filter.categoryId))&&(!filter.productTypeId||r.typeId===filter.productTypeId)&&(!filter.modelId||r.modelId===filter.modelId)&&(!filter.brand||r.brands.includes(filter.brand))&&(!filter.status||(filter.status==='on')===r.onSale)&&(!filter.joined||(filter.joined==='yes')===!!r.entry))
}
