import {usedIntakeModels} from './intakeModel'
import type {AppData} from '../types'
import {categoryGoodsCondition} from '../benefitSales/phoneBranches'
import {emptyUsedInput,parseUsedPrice,saveUsedSku} from './index'
export interface IntakeField {key:string;label:string}
export interface IntakeChain {modelId?:string;categoryId:string;fields:IntakeField[];revision:number}
export const defaultIntakeFields:IntakeField[]=[{key:'brand',label:'品牌'},{key:'model',label:'型号'},{key:'color',label:'颜色'},{key:'memory',label:'内存'},{key:'capacity',label:'容量'}]
export function intakeChain(data:AppData,modelId?:string):IntakeChain{
 const model=usedIntakeModels(data).find(m=>modelId?m.templateId===modelId:true)
 if(!model)return {categoryId:'',fields:[],revision:0,modelId:modelId||''}
 const categoryId=data.productTypes.find(t=>t.id===model.productTypeId)!.categoryId,nodes=data.productSpecNodes.filter(n=>n.templateId===model.templateId),fields:IntakeField[]=[],seen=new Set<string>()
 let parent:string|null=null
 while(true){const children=nodes.filter(n=>n.parentId===parent);if(!children.length)break;if(children.length!==1)return {categoryId,fields:[],revision:model.version,modelId:model.templateId};const node=children[0]!;if(seen.has(node.id)||node.nodeType!=='ATTRIBUTE')return {categoryId,fields:[],revision:model.version,modelId:model.templateId};seen.add(node.id);const param=data.params.find(p=>p.id===node.attributeId);if(!param)return {categoryId,fields:[],revision:model.version,modelId:model.templateId};fields.push({key:param.intakeKey||defaultIntakeFields.find(f=>f.label===param.name)?.key||`field_${node.id.replace(/[^a-z0-9_]/gi,'_').toLowerCase()}`,label:param.name});parent=node.id}
 return {categoryId,fields:seen.size===nodes.length?fields:[],revision:model.version,modelId:model.templateId}
}
export function chainProblem(data:AppData,c:IntakeChain){
 if(!Number.isSafeInteger(c.revision)||c.revision<0)return '链路修订号无效'
 if(!data.categories.some(x=>x.id===c.categoryId&&x.enabled&&categoryGoodsCondition(data,x.id)==='used'))return '请选择启用的二手机分类'
 if(!Array.isArray(c.fields)||c.fields.length<2||c.fields.length>20||c.fields.some(f=>!f||typeof f.key!=='string'||!/^[a-z][a-z0-9_]{0,39}$/.test(f.key)||typeof f.label!=='string'||!f.label.trim()||f.label.length>50)||new Set(c.fields.map(f=>f.key)).size!==c.fields.length||new Set(c.fields.map(f=>f.label.trim())).size!==c.fields.length)return '请在商品模型中维护一条包含2至20个属性的单链路，不添加属性值'
 if(c.fields[0]?.key!=='brand'||c.fields[1]?.key!=='model')return '前两步必须依次为品牌、型号'
 return ''
}
export interface IntakeDetails {cost:string;serial:string;imei:string;note:string;newSpu?:boolean;spuId?:string}
export function receiveUsedPhone(data:AppData,answers:Record<string,string>,details:IntakeDetails,basis:string,requestId:string){
 let selectedModel:string|undefined;try{selectedModel=JSON.parse(basis).modelId}catch{return {ok:false as const,message:'模型资料无效，请重新打开'}}
 const chain=intakeChain(data,selectedModel)
 if(JSON.stringify(chain)!==basis)return {ok:false as const,message:'资料链路已调整，请重新打开并核对；输入保留'}
 const problem=chainProblem(data,chain);if(problem)return {ok:false as const,message:problem}
 for(const field of chain.fields)if(typeof answers[field.key]!=='string'||!answers[field.key]!.trim()||answers[field.key]!.trim().length>160)return {ok:false as const,message:`请填写${field.label}（最多160字）`}
 const cost=parseUsedPrice(details.cost);if(cost===undefined)return {ok:false as const,message:'回收金额格式无效'}
 const input=emptyUsedInput();input.brand=answers.brand!.trim();input.model=answers.model!.trim();input.name=`${input.brand} ${input.model}`;input.color=answers.color?.trim()||'';input.spec=[answers.capacity,answers.memory].filter(Boolean).map(x=>x!.trim()).join(' + ');input.costCents=cost;input.serial=details.serial;input.imei=details.imei;input.note=details.note;input.spuId=details.spuId;input.newSpu=details.newSpu
 input.extra=chain.fields.filter(f=>!['brand','model','color'].includes(f.key)).map(f=>({key:f.label,value:answers[f.key]!.trim()}))
 input.intake={modelId:chain.modelId,categoryId:chain.categoryId,chainRevision:chain.revision,fields:chain.fields.map(f=>({key:f.key,label:f.label,value:answers[f.key]!.trim()}))}
 return saveUsedSku(data.usedGoods,input,0,requestId,new Date().toISOString())
}
