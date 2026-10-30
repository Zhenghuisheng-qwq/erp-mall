import type {AppData,ProductFamily,ProductSpecNode} from '../types'
import {cloneRecord} from '../recordCopy'
import {sameSpecSnapshot,specPublishProblems} from '../logic'
import {freezeBusinessNodes} from '../nodeBusiness'
import {legalPlanningCombinations,reconcilePlanningRecords} from '../planning'
import {saveSpu,previewSkuAppend,appendSkuBatch,editSku} from '../spuSku'
import {createV3Material} from '../material'
import {resolveDeviceSku} from '../deviceResolution'
import {resolveSkuModelSource} from '../modelSourceContext'
import {nodesFor,type Axis} from './phone18Demo'
import {saleQuery} from './query'

export const phoneBrandKeys=['phoneDemoBrandsVersion','params','templates','productSpecNodes','specCanvases','specModelVersions','planningRecords','families','skus','compatibilities','materialReceipts','materialRelations','materialContributions','brands'] as const satisfies readonly (keyof AppData)[]
const time='2026-10-30T10:00:00.000Z'
export const phoneProductSource='内部流程验证资料：用于系统功能验收，不构成真实供应商适用承诺。'
const axis=(key:string,name:string,values:string[],common=false):Axis=>({id:`demo18-${key}`,name,values,common})
const fields={
 brand:axis('brand','品牌',['华为'],true),series:axis('series','系列',['Mate 70'],true),model:axis('model','型号',['Mate 70 Pro'],true),
 capacity:axis('capacity','容量',['256G','512G']),color:axis('color','颜色',['曜石黑','雪域白']),port:axis('port','接口',['USB-C'],true),
 target:axis('target','适配型号',['Mate 70 Pro'],true),caseStyle:axis('case-style','保护壳款式',['透明防护壳','商务素皮壳']),filmStyle:axis('film-style','保护膜材质',['高清钢化膜','防窥钢化膜'])
}
/** Add to the existing four models. Published Apple snapshots and SKU sources stay intact. */
export function supplementHuaweiProducts(current:AppData){
 const next=cloneRecord(current)
 if(next.phoneDemoBrandsVersion===1)return {ok:true as const,next,added:0,message:'苹果与华为商品资料已补齐。'}
 const fail=(message:string)=>({ok:false as const,message:`${message}；原商品和历史清单保持不变。`})
 try{
  if(next.phoneDemoCatalogVersion!==1)throw Error('请先完成手机四类型商品整理')
  if(next.skus.some(s=>s.id.startsWith('huawei-'))||next.families.some(f=>f.id.startsWith('huawei-'))||next.productSpecNodes.some(n=>n.id.startsWith('huawei-')))throw Error('华为预留标识被部分记录占用，请先核对资料')
  for(const f of Object.values(fields)){
   const p=next.params.find(p=>p.id===f.id);if(!p||p.name!==f.name)throw Error(`共享参数“${f.name}”已变更，请先核对模型`)
   for(const value of f.values)if(!p.values.includes(value))p.values.push(value)
  }
  for(const kind of ['phone','case','film'] as const){
   const id=`demo18-model-${kind}`,canvas=next.specCanvases.find(c=>c.templateId===id),template=next.templates.find(t=>t.id===id)
   const previous=next.specModelVersions.filter(v=>v.templateId===id&&v.status==='published').sort((a,b)=>b.version-a.version)[0]
   const original=next.productSpecNodes.filter(n=>n.templateId===id),root=original.find(n=>n.parentId===null&&n.nodeType==='ATTRIBUTE')
   if(!canvas||!template||!previous||!root||canvas.status!=='published'||!sameSpecSnapshot(original,previous.nodesSnapshot))throw Error(`“${canvas?.name||id}”有未发布修改或来源缺失，请先处理后重试`)
   const first=kind==='phone'?fields.brand:fields.target
   if(root.attributeId!==first.id||root.role!=='COMMON')throw Error(`“${canvas.name}”的分支结构已变化，请先核对`)
   const valueId=`huawei-${kind}-root`,value:ProductSpecNode={id:valueId,templateId:id,parentId:root.id,nodeType:'VALUE',attributeId:first.id,valueId:first.values[0]!,sort:Math.max(0,...original.filter(n=>n.parentId===root.id).map(n=>n.sort))+1}
   const branch=nodesFor(id,kind==='phone'?[fields.series,fields.model,fields.capacity,fields.color,fields.port]:[kind==='case'?fields.caseStyle:fields.filmStyle],`huawei-${kind}`,valueId)
   next.productSpecNodes.push(value,...branch)
   const nodes=next.productSpecNodes.filter(n=>n.templateId===id),problems=specPublishProblems(next,nodes)
   if(problems.length)throw Error(problems.join('；'))
   const version=Math.max(...next.specModelVersions.filter(v=>v.templateId===id).map(v=>v.version))+1,versionId=`huawei-${kind}-v${version}`
   if(next.specModelVersions.some(v=>v.id===versionId))throw Error('发布版本标识已占用')
   const name=kind==='phone'?'手机规格模型':kind==='case'?'手机壳规格模型':'手机膜规格模型'
   template.name=name;Object.assign(canvas,{name,status:'published',version,versionName:`V${version}`,updatedAt:time})
   next.specModelVersions.push({id:versionId,templateId:id,version,versionName:`V${version}`,status:'published',nodesSnapshot:freezeBusinessNodes(next,nodes),createdTime:time,publishTime:time,attributeRoles:nodes.filter(n=>n.nodeType==='ATTRIBUTE').map(n=>({attributeNodeId:n.id,role:n.role!,roleSource:'node'})),attributeNames:previous.attributeNames?.map(n=>({...n}))})
   const beforePlans=new Set(next.planningRecords.map(p=>p.planningId))
   next.planningRecords=reconcilePlanningRecords({records:next.planningRecords,data:next,productModelId:id,modelVersionId:versionId,nodes,now:time}).records
   const combo=legalPlanningCombinations(next,id,nodes).find(c=>c.steps.some(s=>s.valueNodeId===valueId))
   if(!combo)throw Error('华为分支未形成合法规格')
   const typeId=canvas.productTypeId!,productName=kind==='phone'?'华为 Mate 70 Pro':`Mate 70 Pro ${kind==='case'?'手机壳':'手机膜'}`
   const family:ProductFamily={id:`huawei-spu-${kind}`,name:productName,categoryId:'c-phone',productTypeId:typeId,templateId:id,productModelId:id,modelVersionId:versionId,oaProductId:'',commonAttrs:Object.fromEntries(combo.steps.filter(s=>s.role==='common').map(s=>[s.attributeName,s.valueId])),productGroupIds:[],lifecycle:'ready',shelfStatus:'online',origin:'sample',createdAt:time,updatedAt:time}
   const saved=saveSpu(next,family,time);if(!saved.ok)throw Error(saved.message)
   const generation={kind:'model' as const},preview=previewSkuAppend(next,family.id,generation)
   if(preview.problem||preview.rows.length!==(kind==='phone'?4:2)||preview.rows.some(r=>r.state!=='new'))throw Error(preview.problem||'华为销售规格未能完整生成')
   let sequence=0
   const appended=appendSkuBatch(next,{familyId:family.id,generation,selectedKeys:preview.rows.map(r=>r.key),now:time,nextId:()=>`huawei-sku-${kind}-${++sequence}`})
   if(!appended.ok)throw Error(appended.message)
   for(const [index,skuId] of appended.ids.entries()){
    const sku=next.skus.find(s=>s.id===skuId)!,code=`HUAWEI-${kind.toUpperCase()}-${String(index+1).padStart(3,'0')}`
    if(next.skus.some(s=>s.id!==skuId&&s.code===code))throw Error(`SKU 编号 ${code} 已占用`)
    const result=editSku(next,skuId,{...sku,code,skuName:`${productName} · ${Object.values(sku.variantAttrs).join(' / ')}`,status:'on_sale'},time)
    if(!result.ok)throw Error(result.message)
    if(resolveSkuModelSource(next,skuId).state!=='resolved')throw Error('华为 SKU 发布来源无法解析')
   }
   let materialSequence=0
   for(const plan of next.planningRecords.filter(p=>p.productModelId===id&&!beforePlans.has(p.planningId))){
    const made=createV3Material(next,{productModelId:id,modelVersionId:versionId,planningId:plan.planningId,requestId:`huawei-mat-${plan.planningId}`,categoryId:'c-phone',productTypeId:typeId,skuName:`${productName}物料 · ${plan.steps.filter(s=>s.role==='variant').map(s=>s.valueId).join(' / ')}`,now:time,nextId:prefix=>`huawei-mat-${kind}-${prefix}-${++materialSequence}`})
    if(!made.ok)throw Error(made.message)
    next.skus.find(s=>s.id===made.skuId)!.status='on_sale';Object.assign(next.families.find(f=>f.id===made.familyId)!,{lifecycle:'ready',shelfStatus:'online'})
   }
  }
  const device=resolveDeviceSku(next,'huawei-sku-phone-1')
  if(!device.host||device.status!=='resolved')throw Error('华为型号未能唯一识别')
  for(const kind of ['case','film'])for(const sku of next.skus.filter(s=>s.familyId===`huawei-spu-${kind}`))next.compatibilities.push({id:`huawei-claim-${sku.id}`,accessorySkuId:sku.id,targetKind:'sku',targetId:sku.id,host:cloneRecord(device.host),capability:'basic',conclusion:'compatible',verification:'confirmed',conditions:[],source:phoneProductSource,note:'Mate 70 Pro 型号专属适用资料',createdAt:time,updatedAt:time})
  // Chargers reuse existing verified general claims. Do not broaden or replace an administrator's restrictions.
  for(const phone of next.skus.filter(s=>s.familyId==='huawei-spu-phone')){
   const result=saleQuery(next,{mode:'free',categoryId:'c-phone',productTypeIds:['pt-case','pt-film','pt-leaf-c-charge'],device:{kind:'sku',skuId:phone.id}})
   for(const kind of ['case','film','charger'])if(!result.candidates.some(c=>c.id.startsWith(kind==='charger'?'demo18-sku-charger-':`huawei-sku-${kind}-`)))throw Error(`华为 ${kind} 缺少有效适用资料，请核对现有声明后重试`)
  }
  if(!next.brands.some(b=>b.name==='华为')){
   if(next.brands.some(b=>b.id==='brand-huawei'))throw Error('华为品牌标识已被其他品牌占用')
   next.brands.push({id:'brand-huawei',name:'华为',logo:'',description:'手机品牌',status:'enabled'})
  }
  next.phoneDemoBrandsVersion=1
  return {ok:true as const,next,added:8,message:'已补齐华为 Mate 70 Pro：4 个手机规格、2 款手机壳、2 款手机膜及对应物料均已发布上架，充电器与苹果共用。'}
 }catch(error){return fail(error instanceof Error?error.message:String(error))}
}
