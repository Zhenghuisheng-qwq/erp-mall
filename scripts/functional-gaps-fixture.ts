import { createSeed } from '../src/domain/seed'
import { reconcilePlanningRecords } from '../src/domain/planning'
import { createV3Material } from '../src/domain/material'
import { defaultSkuConfig, ensureSkuWorkbench, SYSTEM_SKU_VIEW_ID } from '../src/domain/skuWorkbenchState'
import { ensureProductListPages } from '../src/domain/productListPages'
import type { ProductSpecNode, Sku } from '../src/domain/types'
export function functionalGapsFixture(size = 2) {
  const data = createSeed(), modelId = 'gaps-model', versionId = 'gaps-v1'
  const time = '2026-10-24T04:00:00.000Z'
  data.params.push({id:'gaps-cap',name:'测试容量',values:Array.from({length:size},(_,i)=>`${i+1}GB`),valueGroups:[],participateInStructure:true},{id:'gaps-color',name:'测试颜色',values:['黑色','白色'],valueGroups:[],participateInStructure:true})
  data.productTypes.push({id:'gaps-type',name:'验收手机',categoryId:'c-phone',status:'enabled',sort:1,description:''})
  data.templates.push({id:modelId,name:'需求补齐模型',parentId:null,enabled:true,structureOrder:['gaps-cap','gaps-color']})
  data.specCanvases.push({templateId:modelId,productTypeId:'gaps-type',name:'需求补齐模型',status:'published',version:1,versionName:'V1',zoom:1,panX:0,panY:0,updatedAt:time})
  const node = (id:string,parentId:string|null,nodeType:ProductSpecNode['nodeType'],attributeId:string,valueId='',sort=1):ProductSpecNode => ({id,templateId:modelId,parentId,nodeType,attributeId,valueId,sort,role:'VARIANT',expanded:true})
  const nodes = [node('g-cap',null,'ATTRIBUTE','gaps-cap'),node('g-color',null,'ATTRIBUTE','gaps-color','',2),...Array.from({length:size},(_,i)=>node(`g-cap-${i}`,'g-cap','VALUE','gaps-cap',`${i+1}GB`,i+1)),node('g-black','g-color','VALUE','gaps-color','黑色'),node('g-white','g-color','VALUE','gaps-color','白色',2)]
  data.productSpecNodes.push(...nodes)
  data.specModelVersions.push({id:versionId,templateId:modelId,version:1,versionName:'V1',status:'published',nodesSnapshot:structuredClone(nodes),createdTime:time,publishTime:time})
  data.planningRecords = reconcilePlanningRecords({records:data.planningRecords,data,productModelId:modelId,modelVersionId:versionId,nodes,now:time}).records
  const record = data.planningRecords.find(item=>item.productModelId===modelId)!
  let serial=0
  for (let i=0;i<2;i++) {
    const result=createV3Material(data,{productModelId:modelId,modelVersionId:versionId,planningId:record.planningId,requestId:`gaps-material-${i}`,categoryId:'c-phone',productTypeId:'gaps-type',skuName:'同名历史物料（实际保存）',now:time,nextId:prefix=>`gaps-${prefix}-${++serial}`})
    if (!result.ok) throw new Error(JSON.stringify(result))
  }
  const parent = data.families.find(family=>family.templateId==='t-phone')!
  data.families.push({...parent,id:'gaps-spu',name:'筛选验收 SPU',line:'v2',commonAttrs:{},createdAt:'2020-01-01T00:00:00Z'})
  const sku=(id:string,name:string,status:Sku['status'],color:string):Sku=>({id,familyId:'gaps-spu',recordKind:'sku',code:id,skuName:name,status,oaSkuId:'',variantAttrs:{测试颜色:color},projectedAttrs:{},createdAt:time,updatedAt:time})
  data.skus.push(sku('gaps-a','甲手机','on_sale','黑色'),sku('gaps-b','乙手机','off_sale','白色'),{...sku('gaps-sale','销售 SKU 不是 MAT','draft','黑色'),planningId:record.planningId,modelVersionId:versionId})
  data.templateParams.push({templateId:parent.templateId,paramId:'gaps-color',role:'variant',required:false})
  ensureProductListPages(data); ensureSkuWorkbench(data)
  const config=defaultSkuConfig()
  config.conditions={kind:'group',id:'root',logic:'all',children:[{kind:'group',id:'names',logic:'any',children:[{kind:'rule',id:'qa',field:'name',operator:'contains',value:'甲'},{kind:'rule',id:'qb',field:'name',operator:'contains',value:'乙'}]}]}
  config.quickFilters=[{source:'condition',ruleId:'qa'},{source:'condition',ruleId:'qb'}]
  data.productListPages!.sku.skuWorkbench!.working[SYSTEM_SKU_VIEW_ID]=config
  data.productListPages!.sku.skuWorkbench!.defaultId=SYSTEM_SKU_VIEW_ID
  return {data,modelId,versionId,record,nodes,config}
}
