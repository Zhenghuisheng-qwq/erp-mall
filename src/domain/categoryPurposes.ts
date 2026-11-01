import type {AppData,Category,CategoryPurpose} from './types'
export const defaultCategoryPurposes: CategoryPurpose[] = [{id:'host',name:'主机',behavior:'host'},{id:'accessory',name:'配件 / 增值业务',behavior:'accessory'}]
export const categoryPurposes=(data:Pick<AppData,'categoryPurposes'>)=>data.categoryPurposes??defaultCategoryPurposes
export const categoryPurposeId=(category?:Category)=>category?.purposeId??category?.catalogRole??''
export const categoryPurpose=(data:Pick<AppData,'categoryPurposes'>,category?:Category)=>categoryPurposes(data).find(p=>p.id===categoryPurposeId(category))
export const categoryPurposeLabel=(data:Pick<AppData,'categoryPurposes'>,category?:Category)=>categoryPurpose(data,category)?.name||(categoryPurposeId(category)?'用途已失效':'未配置')
export const categoryBehavior=(data:AppData,categoryId:string)=>categoryPurpose(data,data.categories.find(c=>c.id===categoryId))?.behavior
export const purposeReferences=(data:AppData,id:string)=>data.categories.filter(c=>categoryPurposeId(c)===id)
export function purposeBindingProblem(data:AppData,id:string){return id&&!categoryPurposes(data).some(p=>p.id===id)?'分类用途已不存在，请重新选择':''}
export function saveCategoryPurpose(data:AppData,input:CategoryPurpose,expected:string|null){
 if(typeof input.id!=='string'||!input.id||typeof input.name!=='string')return {ok:false,message:'用途身份或名称无效'}
 const rows=categoryPurposes(data),old=rows.find(p=>p.id===input.id)
 if((old?JSON.stringify(old):null)!==expected)return {ok:false,message:'用途已变化，请重新打开核对'}
 const name=input.name.trim()
 if(!name||name.length>40)return {ok:false,message:'用途名称须为 1 至 40 个字符'}
 if(rows.some(p=>p.id!==input.id&&p.name.trim().toLocaleLowerCase()===name.toLocaleLowerCase()))return {ok:false,message:'用途名称已存在'}
 if(!['host','accessory','other'].includes(input.behavior))return {ok:false,message:'请选择业务规则'}
 if(old&&old.behavior!==input.behavior&&purposeReferences(data,old.id).length)return {ok:false,message:'用途已关联分类，不能直接改变业务规则；请先调整分类绑定'}
 data.categoryPurposes=[...rows.filter(p=>p.id!==input.id),{...input,name}]
 return {ok:true}
}
export function removeCategoryPurpose(data:AppData,id:string,expected:string){
 const rows=categoryPurposes(data),old=rows.find(p=>p.id===id)
 if(!old||JSON.stringify(old)!==expected)return {ok:false,message:'用途已变化，请刷新后重试'}
 const refs=purposeReferences(data,id)
 if(refs.length)return {ok:false,message:`用途已被 ${refs.length} 个分类关联（${refs.map(c=>c.name).join('、')}），请先解除或调整绑定，不能直接删除`}
 data.categoryPurposes=rows.filter(p=>p.id!==id)
 return {ok:true}
}
export function categoryPurposeProblems(data:AppData){
 if(data.categoryPurposes!==undefined&&!Array.isArray(data.categoryPurposes))return ['分类用途列表格式无效']
 const rows=categoryPurposes(data),ids=new Set<string>(),names=new Set<string>(),errors:string[]=[]
 for(const p of rows){if(!p||typeof p.id!=='string'||!p.id||typeof p.name!=='string'||!p.name.trim()||p.name.length>40||!['host','accessory','other'].includes(p.behavior)||ids.has(p.id)||names.has(p.name.trim().toLocaleLowerCase()))errors.push('分类用途定义无效或重复');else{ids.add(p.id);names.add(p.name.trim().toLocaleLowerCase())}}
 for(const c of data.categories)if(categoryPurposeId(c)&&!ids.has(categoryPurposeId(c)))errors.push(`分类「${c.name}」引用的用途不存在`)
 return errors
}

export interface BoundCategoryInput {id:string;name:string;parentId:string|null;purposeId:string}
export function saveBoundCategory(data:AppData,input:BoundCategoryInput,expected:string|null){
 const old=data.categories.find(c=>c.id===input.id)
 if((old?JSON.stringify(old):null)!==expected)return {ok:false,message:'分类已变化，请重新打开核对'}
 const problem=purposeBindingProblem(data,input.purposeId)
 if(problem)return {ok:false,message:problem}
 const name=input.name.trim()
 if(!name)return {ok:false,message:'请填写分类名称'}
 if(!old&&!input.purposeId)return {ok:false,message:'请选择分类用途'}
 if(old){old.name=name;old.purposeId=input.purposeId;delete old.catalogRole;return {ok:true}}
 if(input.parentId&&!data.categories.some(c=>c.id===input.parentId))return {ok:false,message:'上级分类已不存在'}
 if(input.parentId&&data.productTypes.some(t=>t.categoryId===input.parentId))return {ok:false,message:'该分类已关联产品类型，不能再添加子分类'}
 if(data.categories.some(c=>c.parentId===input.parentId&&c.name.trim()===name))return {ok:false,message:'同级分类名称已存在'}
 data.categories.push({id:input.id,name,parentId:input.parentId,purposeId:input.purposeId,enabled:true,sort:Math.max(0,...data.categories.filter(c=>c.parentId===input.parentId).map(c=>c.sort))+1})
 return {ok:true}
}
