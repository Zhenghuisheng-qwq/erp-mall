import { createSeed } from '../src/domain/seed'
import type { ProductSpecNode } from '../src/domain/types'
export function r01Fixture() {
  const data=createSeed(), modelId='r01-model', now='2026-10-25T08:00:00.000Z'
  data.activeRole='admin'
  data.params.push({id:'r01-brand',name:'R01品牌',values:['Apple','其他品牌'],valueGroups:[],participateInStructure:true},{id:'r01-color',name:'R01颜色',values:Array.from({length:10},(_,i)=>`颜色${i+1}`),valueGroups:[],participateInStructure:true})
  for(const [id,categoryId] of [['r01-type','c-phone'],['r01-other-type','c-film']]) data.productTypes.push({id:id!,name:id!,categoryId:categoryId!,status:'enabled',sort:1,description:''})
  for(const [model,type] of [[modelId,'r01-type'],['r01-other','r01-other-type']]) {
    data.templates.push({id:model!,name:model==='r01-model'?'R01节点配置验收':'R01跨分类模型',parentId:null,enabled:true,structureOrder:['r01-brand','r01-color']})
    data.specCanvases.push({templateId:model!,productTypeId:type!,name:model==='r01-model'?'R01节点配置验收':'R01跨分类模型',status:'draft',version:1,versionName:'V1',zoom:1,panX:0,panY:0,updatedAt:now,direction:'logic'})
    for(const paramId of ['r01-brand','r01-color'])data.templateParams.push({templateId:model!,paramId,role:'variant',required:false})
    const n=(suffix:string,parent:string|null,nodeType:ProductSpecNode['nodeType'],attributeId:string,valueId='',sort=1):ProductSpecNode=>({id:`${model}-${suffix}`,templateId:model!,parentId:parent?`${model}-${parent}`:null,nodeType,attributeId,valueId,sort,role:'VARIANT',expanded:true})
    data.productSpecNodes.push(n('brand',null,'ATTRIBUTE','r01-brand'),n('apple','brand','VALUE','r01-brand','Apple'),n('other','brand','VALUE','r01-brand','其他品牌',2),n('apple-color','apple','ATTRIBUTE','r01-color'),n('other-color','other','ATTRIBUTE','r01-color'),n('apple-c1','apple-color','VALUE','r01-color','颜色1'),n('other-c1','other-color','VALUE','r01-color','颜色1'))
  }
  return {data,modelId}
}
