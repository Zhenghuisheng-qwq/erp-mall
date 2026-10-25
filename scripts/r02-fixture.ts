import { r01Fixture } from './r01-fixture'
import type { ProductSpecNode } from '../src/domain/types'
export function r02Fixture(configured=true) {
  const {data,modelId}=r01Fixture()
  data.params.push({id:'r02-capacity',name:'R02容量',values:['128G','256G'],valueGroups:[],participateInStructure:true})
  data.templateParams.push({templateId:modelId,paramId:'r02-capacity',role:'variant',required:false})
  data.templates.find(t=>t.id===modelId)!.name='R02多路径物料验收'
  data.specCanvases.find(c=>c.templateId===modelId)!.name='R02多路径物料验收'
  const n=(id:string,parentId:string,nodeType:ProductSpecNode['nodeType'],attributeId:string,valueId='',sort=1):ProductSpecNode=>({id,templateId:modelId,parentId,nodeType,attributeId,valueId,sort,role:'VARIANT',expanded:true})
  data.productSpecNodes.push(n('r02-cap','r01-model-apple','ATTRIBUTE','r02-capacity'),n('r02-128','r02-cap','VALUE','r02-capacity','128G'),n('r02-256','r02-cap','VALUE','r02-capacity','256G',2),n('r02-color-256','r02-256','ATTRIBUTE','r01-color'),n('r02-blue-256','r02-color-256','VALUE','r01-color','颜色1'),n('r02-red-128','r01-model-apple-color','VALUE','r01-color','颜色2',2))
  data.productSpecNodes.find(n=>n.id==='r01-model-apple-color')!.parentId='r02-128'
  if(configured)for(const id of ['r01-model-apple','r01-model-other'])data.productSpecNodes.find(n=>n.id===id)!.businessConfigs=[{id:`policy-${id}`,definitionId:'business:material',modelId,nodeId:id,scope:'subtree',enabled:true,parameters:{value:'shared'}}]
  return {data,modelId,anchor:'r01-model-apple',other:'r01-model-other'}
}
