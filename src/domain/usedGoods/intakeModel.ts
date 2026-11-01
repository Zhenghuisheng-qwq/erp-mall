import type {AppData,ProductSpecNode} from '../types'
import {isUsedCategory} from './modelKind'
export const intakeModelKeys=['productTypes','templates','specCanvases','productSpecNodes','params','usedIntakeModelVersion'] as const
export function usedIntakeModels(data:AppData){return data.specCanvases.filter(m=>m.status!=='offline'&&data.templates.some(t=>t.id===m.templateId&&t.enabled)&&data.productTypes.some(t=>t.id===m.productTypeId&&t.status==='enabled'&&isUsedCategory(data,t.categoryId)))}
export function ensureUsedIntakeModel(data:AppData){
 if(data.usedIntakeModelVersion===1)return false
 const category=data.categories.find(c=>c.goodsCondition==='used');if(!category)return false
 if(usedIntakeModels(data).length){data.usedIntakeModelVersion=1;return true}
 const id='used-phone-intake-model',typeId='used-phone-type'
 if(data.templates.some(t=>t.id===id)||data.productTypes.some(t=>t.id===typeId))throw Error('二手机模型编号已占用，请核对')
 const fields=data.usedIntakeChain?.fields||[{key:'brand',label:'品牌'},{key:'model',label:'型号'},{key:'color',label:'颜色'},{key:'memory',label:'内存'},{key:'capacity',label:'容量'}]
 data.productTypes.push({id:typeId,name:'二手机',categoryId:category.id,status:'enabled',sort:1,description:'二手机回收资料',catalogRole:'host'})
 data.templates.push({id,name:'二手机回收模型',parentId:null,enabled:true,structureOrder:[]})
 data.specCanvases.push({templateId:id,productTypeId:typeId,name:'二手机回收模型',zoom:1,panX:0,panY:0,status:'draft',version:1,versionName:'V1',direction:'logic',updatedAt:new Date().toISOString()})
 let parentId:string|null=null
 for(const [i,field] of fields.entries()){const paramId=`used-intake-${field.key}`,nodeId=`used-intake-node-${i}`
  if(data.params.some(p=>p.id===paramId)||data.productSpecNodes.some(n=>n.id===nodeId))throw Error('回收属性编号已占用，请核对')
  data.params.push({id:paramId,name:field.label,values:[],valueGroups:[],participateInStructure:true,intakeKey:field.key})
  const node:ProductSpecNode={id:nodeId,templateId:id,parentId,nodeType:'ATTRIBUTE',attributeId:paramId,valueId:'',sort:1,role:'VARIANT',expanded:true};data.productSpecNodes.push(node);parentId=nodeId
 }
 data.usedIntakeModelVersion=1;return true
}
