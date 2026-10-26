import { createTemplateCompatibilityFixture, TEMPLATE_COMPATIBILITY_TIME as now } from './template-compatibility-fixtures'
import { createTemplateCompatibilityContext } from '../src/domain/templateCompatibility'
import { deviceSourceStamp } from '../src/domain/deviceResolution'
import { ensureProductListPages } from '../src/domain/productListPages'
import { ensureRbac } from '../src/domain/rbac'
import type { SalesOptionPlan, SalesOptionItem, SalesOptionBinding } from '../src/domain/salesConfigurationTypes'
import type { Sku } from '../src/domain/types'

export const salesTestItem = (id='case-choice', kind:SalesOptionItem['scope']['kind']='product-types', ids=['type-case']):SalesOptionItem => ({
  id,name:id==='case-choice'?'手机壳':id==='service-choice'?'延保服务':'相关配件',enabled:true,order:0,scope:{kind,ids:kind==='service'?[]:ids},recommended:true,required:false,minKinds:0,maxKinds:5,defaultQuantity:1,minQuantity:1,maxQuantity:9,
  checkTarget:kind==='service'?'none':'device',source:'隔离测试销售指引',note:'不是真实商品或适配资料',...(kind==='service'?{service:{unit:'项',measurement:'per-package' as const,validity:'约定服务期',description:'隔离测试服务'}}:{}),
})
export function salesTestPlan(id='sales-plan-phone',items=[salesTestItem(),salesTestItem('service-choice','service')]):SalesOptionPlan {
  return {schemaVersion:1,id,name:id==='sales-plan-phone'?'手机日常选配':'手机壳相关选配',revision:1,status:'available',items,rules:[],publishedVersion:1,
    versions:[{schemaVersion:1,planId:id,version:1,name:id==='sales-plan-phone'?'手机日常选配':'手机壳相关选配',items:structuredClone(items),rules:[],publishedAt:now}],createdAt:now,updatedAt:now}
}

/** A real published sibling-product model; fixture-only records, no generated pair catalogue. */
export function createSalesConfigurationFixture(input:{styles?:number;colors?:number;packs?:number}={}) {
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
    const id=index===0?'phone-a':index===1?'phone-b':`sales-phone-${index}`
    const sku:Sku={...structuredClone(old),id,code:`SALE-PHONE-${index}`,skuName:`隔离测试手机 ${combo.label}`,familyId:family.id,variantAttrs:Object.fromEntries(combo.steps.map(step=>[step.attributeId,step.valueId])),sourceNodeIds:combo.steps.map(step=>step.valueNodeId),modelVersionId:versionId,creationSource:{kind:'model',templateId:modelId,modelVersionId:versionId,createdAt:now}}
    data.skus.push(sku);phoneIds.push(id)
    const host=combo.steps.some(step=>step.valueNodeId==='compat-style-1')?hosts.b:hosts.a
    data.deviceBindings.push({skuId:id,host:structuredClone(host),sourceStamp:deviceSourceStamp(data,id),createdAt:now,updatedAt:now})
  }
  const phonePlan=salesTestPlan(),casePlan=salesTestPlan('sales-plan-case',[salesTestItem('film-choice','skus',['film-sku'])])
  const phoneBinding:SalesOptionBinding={schemaVersion:1,id:'sales-binding-phone',revision:1,name:'手机规格共用选配',enabled:true,scope:{kind:'model',modelId,versionId},mode:'default',planId:phonePlan.id,planVersion:1,source:'隔离测试发布范围',updatedAt:now}
  const caseBinding:SalesOptionBinding={schemaVersion:1,id:'sales-binding-case',revision:1,name:'手机壳后续选配',enabled:true,scope:{kind:'products',familyIds:[],skuIds:['case-sku']},mode:'replace',planId:casePlan.id,planVersion:1,source:'隔离测试明确商品范围',updatedAt:now}
  data.salesOptionPlans=[phonePlan,casePlan];data.salesOptionBindings=[phoneBinding,caseBinding];data.salesProductRelations=[]
  data.benefitPackages=[];data.benefitDeliveries=[]
  ensureProductListPages(data);ensureRbac(data)
  return {...base,data,phoneIds,caseIds:['case-sku'],phonePlan,casePlan,phoneBinding,caseBinding,context,now}
}
