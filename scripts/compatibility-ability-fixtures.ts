import { createTemplateCompatibilityFixture, TEMPLATE_COMPATIBILITY_TIME as now } from './template-compatibility-fixtures'
import { createTemplateCompatibilityContext } from '../src/domain/templateCompatibility'
import { deviceSourceStamp } from '../src/domain/deviceResolution'
import { ensureProductListPages } from '../src/domain/productListPages'
import { ensureRbac } from '../src/domain/rbac'
import type { Sku } from '../src/domain/types'

import {hostFrom} from '../src/domain/compatibility'
import {legalPlanningCombinations} from '../src/domain/planning'
import type {CompatibilityLink,ProductSpecNode} from '../src/domain/types'
export function createCompatibilityAbilityFixture(){
  const fixture=createHostModelFixture({styles:2,colors:2,packs:1}),{data,hosts,now}=fixture
  const clone=(id:string,targetId:string,capability:CompatibilityLink['capability'],conclusion:CompatibilityLink['conclusion'],host=hosts.a):CompatibilityLink=>({...structuredClone(data.compatibilities[0]!),id,accessorySkuId:targetId,targetId,host:structuredClone(host),capability,conclusion,verification:'confirmed',conditions:[]})
  data.compatibilities=data.compatibilities.filter(item=>item.id!=='decl-charger-fast')
  data.compatibilities.push(clone('matrix-fast-allow','charger-sku','fast-charge','compatible'),clone('matrix-fast-deny','charger-sku','fast-charge','incompatible'),clone('matrix-case-fast-deny','case-sku','fast-charge','incompatible'),clone('matrix-film-basic-deny','film-sku','basic','incompatible'),clone('matrix-film-fast-allow','film-sku','fast-charge','compatible'))
  // A separate, explicitly identified published model proves PLN differences.
  const modelId='matrix-host-model',versionId='matrix-host-v1'
  data.templates.push({id:modelId,name:'能力测试型号',enabled:true,parentId:null,structureOrder:['attr-device-model','attr-capacity']})
  data.specCanvases.push({templateId:modelId,productTypeId:'type-device',name:'能力测试主机模型',zoom:1,panX:0,panY:0,status:'published',version:1,versionName:'V1'})
  const nodes:ProductSpecNode[]=[{id:'matrix-model',templateId:modelId,parentId:null,nodeType:'ATTRIBUTE',attributeId:'attr-device-model',valueId:'',sort:1,role:'VARIANT'},{id:'matrix-model-a',templateId:modelId,parentId:'matrix-model',nodeType:'VALUE',attributeId:'attr-device-model',valueId:'Orion A',sort:1},{id:'matrix-capacity',templateId:modelId,parentId:null,nodeType:'ATTRIBUTE',attributeId:'attr-capacity',valueId:'',sort:2,role:'VARIANT'},...['128G','256G'].map((valueId,index)=>({id:`matrix-capacity-${index}`,templateId:modelId,parentId:'matrix-capacity',nodeType:'VALUE' as const,attributeId:'attr-capacity',valueId,sort:index+1}))]
  data.productSpecNodes.push(...nodes);data.specModelVersions.push({id:versionId,templateId:modelId,version:1,versionName:'V1',status:'published',nodesSnapshot:structuredClone(nodes),createdTime:now,publishTime:now})
  const combos=legalPlanningCombinations(data,modelId,nodes),host=hostFrom('type-device',modelId,[{attributeId:'attr-device-model',attributeName:'测试设备型号',valueId:'Orion A'}])
  data.families.push({...structuredClone(data.families[0]!),id:'matrix-family',templateId:modelId,productModelId:modelId,modelVersionId:versionId,commonAttrs:{}})
  for(const [index,combo] of combos.entries()){
    data.planningRecords.push({planningId:`MATRIX-PLN-${index}`,productModelId:modelId,originModelVersionId:versionId,modelVersionId:versionId,modelVersionIds:[versionId],steps:combo.steps,identityKey:combo.identityKey,status:'active',createdTime:now})
    data.skus.push({...structuredClone(data.skus.find(item=>item.id==='phone-a')!),id:`matrix-phone-${index}`,familyId:'matrix-family',code:`MATRIX-PHONE-${index}`,skuName:`能力测试手机 ${index}`,sourceNodeIds:combo.steps.map(step=>step.valueNodeId),variantAttrs:Object.fromEntries(combo.steps.map(step=>[step.attributeId,step.valueId])),modelVersionId:versionId,creationSource:{kind:'model',templateId:modelId,modelVersionId:versionId,createdAt:now},planningId:`MATRIX-PLN-${index}`})
  }
  data.compatibilities.push(clone('matrix-model-basic','cable-sku','basic','compatible',host),clone('matrix-spec-basic-deny','cable-sku','basic','incompatible',{...host,scope:'planning',planningId:'MATRIX-PLN-1'}),clone('matrix-only-fast-basic','case-sku','basic','compatible',host),clone('matrix-only-fast-deny','case-sku','fast-charge','incompatible',{...host,scope:'planning',planningId:'MATRIX-PLN-1'}))
  return {...fixture,matrixModelId:modelId,matrixVersionId:versionId,matrixHost:host}
}

/** A real published sibling-product model; fixture-only records, no generated pair catalogue. */
export function createHostModelFixture(input:{styles?:number;colors?:number;packs?:number}={}) {
  const base=createTemplateCompatibilityFixture(input),{data,modelId,versionId,version,hosts}=base
  const canvas=data.specCanvases.find(item=>item.templateId===modelId)!
  canvas.productTypeId='type-device';canvas.name='隔离测试手机规格模型';canvas.status='published';canvas.version=1
  for(const node of [...data.productSpecNodes,...version.nodesSnapshot])if(node.nodeType==='ATTRIBUTE')node.role='VARIANT'
  for(const role of version.templateCompatibilitySnapshot!.attributeRoles)role.role='VARIANT'
  for(const bind of data.templateParams.filter(item=>item.templateId===modelId))bind.role='variant'
  const context=createTemplateCompatibilityContext(data,{modelId,versionId})
  if(context.issues.length)throw Error(context.issues.map(issue=>issue.message).join('；'))
  const family=data.families.find(item=>item.id==='family-device')!
  Object.assign(family,{name:'隔离测试手机',templateId:modelId,productModelId:modelId,modelVersionId:versionId,commonAttrs:{'attr-brand':'DeviceLab'}})
  const phoneIds:string[]=[]
  const old=data.skus.find(item=>item.id==='phone-a')!
  data.skus=data.skus.filter(item=>!['phone-a','phone-b'].includes(item.id))
  data.deviceBindings=[]
  for(const [index,combo] of context.combinations.entries()) {
    const id=index===0?'phone-a':index===1?'phone-b':`model-phone-${index}`
    const sku:Sku={...structuredClone(old),id,code:`MODEL-PHONE-${index}`,skuName:`隔离测试手机 ${combo.label}`,familyId:family.id,variantAttrs:Object.fromEntries(combo.steps.map(step=>[step.attributeId,step.valueId])),sourceNodeIds:combo.steps.map(step=>step.valueNodeId),modelVersionId:versionId,creationSource:{kind:'model',templateId:modelId,modelVersionId:versionId,createdAt:now}}
    data.skus.push(sku);phoneIds.push(id)
    const host=combo.steps.some(step=>step.valueNodeId==='compat-style-1')?hosts.b:hosts.a
    data.deviceBindings.push({skuId:id,host:structuredClone(host),sourceStamp:deviceSourceStamp(data,id),createdAt:now,updatedAt:now})
  }
  ensureProductListPages(data);ensureRbac(data)
  return {...base,data,phoneIds,context,now}
}
