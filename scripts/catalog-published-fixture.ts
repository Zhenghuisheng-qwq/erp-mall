import {createCatalogModelFixture,MODEL_TEST_TIME as now} from './catalog-model-fixture'
import {modelSpecificationContext} from '../src/domain/modelSourceContext'
import {ensureProductListPages} from '../src/domain/productListPages'
import {ensureRbac} from '../src/domain/rbac'
import type {Sku} from '../src/domain/types'
/** A real published sibling-product model; fixture-only records, no generated pair catalogue. */
export function createHostModelFixture(input:{styles?:number;colors?:number;packs?:number}={}) {
  const base=createCatalogModelFixture(input),{data,modelId,versionId,version}=base
  const canvas=data.specCanvases.find(item=>item.templateId===modelId)!
  canvas.productTypeId='type-device';canvas.name='隔离测试手机规格模型';canvas.status='published';canvas.version=1
  for(const node of [...data.productSpecNodes,...version.nodesSnapshot])if(node.nodeType==='ATTRIBUTE')node.role='VARIANT'
  for(const bind of data.templateParams.filter(item=>item.templateId===modelId))bind.role='variant'
  const context=modelSpecificationContext(data,modelId,versionId)
  if(context.issues.length)throw Error(context.issues.map(issue=>issue.message).join('；'))
  const family=data.families.find(item=>item.id==='family-device')!
  Object.assign(family,{name:'隔离测试手机',templateId:modelId,productModelId:modelId,modelVersionId:versionId,commonAttrs:{'attr-brand':'DeviceLab'}})
  const phoneIds:string[]=[]
  const old=data.skus.find(item=>item.id==='phone-a')!
  data.skus=data.skus.filter(item=>!['phone-a','phone-b'].includes(item.id))
  for(const [index,combo] of context.combinations.entries()) {
    const id=index===0?'phone-a':index===1?'phone-b':`model-phone-${index}`
    const sku:Sku={...structuredClone(old),id,code:`MODEL-PHONE-${index}`,skuName:`隔离测试手机 ${combo.label}`,familyId:family.id,variantAttrs:Object.fromEntries(combo.steps.map(step=>[step.attributeId,step.valueId])),sourceNodeIds:combo.steps.map(step=>step.valueNodeId),modelVersionId:versionId,creationSource:{kind:'model',templateId:modelId,modelVersionId:versionId,createdAt:now}}
    data.skus.push(sku);phoneIds.push(id)
  }
  ensureProductListPages(data);ensureRbac(data)
  return {...base,data,phoneIds,context,now}
}
