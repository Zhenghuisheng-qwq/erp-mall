import type {AppData,ParamDef,ProductFamily,ProductSpecNode} from '../types'
import {cloneRecord} from '../recordCopy'
import {specPublishProblems} from '../logic'
import {freezeBusinessNodes} from '../nodeBusiness'
import {legalPlanningCombinations,reconcilePlanningRecords} from '../planning'
import {saveSpu,previewSkuAppend,appendSkuBatch,editSku} from '../spuSku'
import {resolveDeviceSku} from '../deviceResolution'
import {resolveSkuModelSource} from '../modelSourceContext'
import {writeGroup} from './commands'
import {saleQuery,groupTypesProblem} from './query'

const prefix='demo18-',time='2026-10-30T08:00:00.000Z'
export const phone18DemoKeys=['categories','productTypes','params','templates','templateParams','mappings','productSpecNodes','specCanvases','specModelVersions','planningRecords','families','skus','compatibilities','generalCompatibilityClaims','benefitTypeGroups'] as const
export const phone18Models=['phone','case','film','charger'] as const
const modelId=(kind:string)=>`${prefix}model-${kind}`,familyId=(kind:string)=>`${prefix}spu-${kind}`
const source='仅供 ERP 软件演示：型号及规格均为模拟数据，不代表真实供应商核验或商品承诺。'
type Axis={id:string;name:string;values:string[];common?:boolean;identity?:boolean}
const axes={
 brand:{id:'demo18-brand',name:'品牌',values:['Apple'],common:true},
 series:{id:'demo18-series',name:'系列',values:['iPhone 18'],common:true},
 model:{id:'demo18-model',name:'型号',values:['iPhone 18 Pro Max'],common:true,identity:true},
 capacity:{id:'demo18-capacity',name:'容量',values:['256G','512G']},
 color:{id:'demo18-color',name:'颜色',values:['深空黑','银色']},
 port:{id:'demo18-port',name:'接口',values:['USB-C'],common:true},
 target:{id:'demo18-target',name:'适配型号',values:['iPhone 18 Pro Max'],common:true},
 caseStyle:{id:'demo18-case-style',name:'保护壳款式',values:['透明磁吸壳','磨砂防摔壳']},
 filmStyle:{id:'demo18-film-style',name:'保护膜材质',values:['高清钢化膜','防窥钢化膜']},
 power:{id:'demo18-power',name:'充电器规格',values:['20W USB-C','30W USB-C']}
} satisfies Record<string,Axis>
function nodesFor(id:string,fields:Axis[]){
 const nodes:ProductSpecNode[]=[]
 function add(level:number,parentId:string|null,path:string){const field=fields[level];if(!field)return
  const attributeId=`${id}-${path}a${level}`
  nodes.push({id:attributeId,templateId:id,parentId,nodeType:'ATTRIBUTE',attributeId:field.id,valueId:'',sort:1,role:field.common?'COMMON':'VARIANT'})
  field.values.forEach((valueId,index)=>{const nodeId=`${attributeId}-v${index}`;nodes.push({id:nodeId,templateId:id,parentId:attributeId,nodeType:'VALUE',attributeId:field.id,valueId,sort:index+1});add(level+1,nodeId,`${path}${index}-`)})
 }
 add(0,null,'');return nodes
}
function checkInstalled(data:AppData){
 for(const kind of phone18Models){const id=modelId(kind),version=data.specModelVersions.find(v=>v.id===`${id}-v1`&&v.templateId===id&&v.status==='published'),canvas=data.specCanvases.find(c=>c.templateId===id)
  if(!version||canvas?.status!=='published'||specPublishProblems(data,version.nodesSnapshot).length)return `演示${kind}模型或发布版本需要核对`
  const skus=data.skus.filter(s=>s.familyId===familyId(kind));if(skus.length!==(kind==='phone'?4:2)||skus.some(s=>s.recordKind!=='sku'||s.status!=='on_sale'||resolveSkuModelSource(data,s.id).state!=='resolved'))return `演示${kind}销售 SKU 或规格来源需要核对`
 }
 const group=data.benefitTypeGroups?.find(g=>g.id==='demo18-bundle-full')
 if(!group||groupTypesProblem(data,group.categoryId,group.productTypeIds))return '演示权益包的分类与类型需要核对'
 for(const phone of data.skus.filter(s=>s.familyId===familyId('phone'))){const query=saleQuery(data,{mode:'group',categoryId:group.categoryId,groupId:group.id,productTypeIds:group.productTypeIds,device:{kind:'sku',skuId:phone.id}})
  for(const kind of ['case','film','charger'])if(!query.candidates.some(c=>data.skus.find(s=>s.id===c.id)?.familyId===familyId(kind)))return `演示设备 ${phone.code} 的${kind}适用资料需要核对`
 }
 return ''
}
/** Add an entire, detached demo chain using the existing publish, planning and V2 SKU paths. */
export function installPhone18Demo(current:AppData){
 const next=cloneRecord(current)
 const fail=(message:string)=>({ok:false as const,message:`${message}。本次未覆盖任何商品、模型或历史清单。`})
 if(next.benefitTypeGroups?.some(g=>g.id==='demo18-bundle-full')){const problem=checkInstalled(next);return problem?fail(problem):{ok:true as const,next,message:'18 Pro Max 完整演示链路已存在，无需重复创建。',added:0}}
 const occupied=phone18DemoKeys.some(key=>Array.isArray(next[key])&&(next[key] as unknown as Record<string,unknown>[]).some(r=>typeof r.id==='string'&&r.id.startsWith(prefix)||typeof r.templateId==='string'&&r.templateId.startsWith(prefix)))
 if(occupied)return fail('18 Pro Max 演示标识已被部分记录占用，请核对已有演示资料')
 try{
  let categoryId='c-phone'
  const category=next.categories.find(c=>c.id===categoryId)
  if(!category||!category.enabled||next.categories.some(c=>c.parentId===categoryId)){categoryId='demo18-category';next.categories.push({id:categoryId,name:'手机权益包演示',parentId:null,sort:90,enabled:true})}
  const typeIds:Record<string,string>={}
  for(const [kind,known,name,role] of [['phone','pt-phone','手机','host'],['case','pt-case','手机壳','accessory'],['film','pt-film','手机膜','accessory'],['charger','pt-leaf-c-charge','充电器','accessory']] as const){
   const existing=next.productTypes.find(t=>t.id===known&&t.categoryId===categoryId&&t.status==='enabled'&&t.catalogRole===role)
   typeIds[kind]=existing?.id||`demo18-type-${kind}`
   if(!existing)next.productTypes.push({id:typeIds[kind]!,name:name,categoryId,catalogRole:role,status:'enabled',sort:20+Object.keys(typeIds).length,description:'完整模型、SKU 与权益包演示'})
  }
  for(const axis of Object.values(axes)){const param:ParamDef={id:axis.id,name:axis.name,values:[...axis.values],valueGroups:[],participateInStructure:true,...('identity' in axis&&axis.identity?{identityRole:'host-model'}:{})};next.params.push(param)}
  const definitions=[
   {kind:'phone',name:'Apple iPhone 18 Pro Max',fields:[axes.brand,axes.series,axes.model,axes.capacity,axes.color,axes.port]},
   {kind:'case',name:'iPhone 18 Pro Max 手机壳',fields:[axes.target,axes.caseStyle]},
   {kind:'film',name:'iPhone 18 Pro Max 手机膜',fields:[axes.target,axes.filmStyle]},
   {kind:'charger',name:'USB-C 充电器',fields:[axes.port,axes.power]}
  ]
  for(const definition of definitions){const {kind,name,fields}=definition,id=modelId(kind),versionId=`${id}-v1`,nodes=nodesFor(id,fields)
   next.templates.push({id,name,parentId:null,enabled:true,structureOrder:fields.map(a=>a.id)})
   next.templateParams.push(...fields.map(a=>({templateId:id,paramId:a.id,role:('common' in a&&a.common?'common':'variant') as 'common'|'variant',required:true})))
   next.mappings.push({templateId:id,categoryId});next.productSpecNodes.push(...nodes)
   next.specCanvases.push({templateId:id,productTypeId:typeIds[kind],name,zoom:1,panX:0,panY:0,status:'published',version:1,versionName:'V1',updatedAt:time})
   const problems=specPublishProblems(next,nodes);if(problems.length)throw Error(problems.join('；'))
   next.specModelVersions.push({id:versionId,templateId:id,version:1,versionName:'V1',status:'published',nodesSnapshot:freezeBusinessNodes(next,nodes),createdTime:time,publishTime:time,attributeRoles:nodes.filter(n=>n.nodeType==='ATTRIBUTE').map(n=>({attributeNodeId:n.id,role:n.role!,roleSource:'node'})),attributeNames:fields.map(a=>({attributeId:a.id,name:a.name}))})
   next.planningRecords=reconcilePlanningRecords({records:next.planningRecords,data:next,productModelId:id,modelVersionId:versionId,nodes,now:time}).records
   const combo=legalPlanningCombinations(next,id,nodes)[0]!
   const family:ProductFamily={id:familyId(kind),name,categoryId,productTypeId:typeIds[kind],templateId:id,productModelId:id,modelVersionId:versionId,oaProductId:'',commonAttrs:Object.fromEntries(combo.steps.filter(s=>s.role==='common').map(s=>[s.attributeName,s.valueId])),productGroupIds:[],lifecycle:'ready',shelfStatus:'online',origin:'sample',createdAt:time,updatedAt:time}
   const saved=saveSpu(next,family,time);if(!saved.ok)throw Error(saved.message)
   const generation={kind:'model' as const},preview=previewSkuAppend(next,family.id,generation)
   if(preview.problem||preview.rows.some(r=>r.state!=='new'))throw Error(preview.problem||'模型 SKU 候选未能全部通过')
   let seq=0;const appended=appendSkuBatch(next,{familyId:family.id,generation,selectedKeys:preview.rows.map(r=>r.key),now:time,nextId:()=>`demo18-sku-${kind}-${++seq}`})
   if(!appended.ok)throw Error(appended.message)
   for(const [index,skuId] of appended.ids.entries()){const sku=next.skus.find(s=>s.id===skuId)!,code=`DEMO18-${kind.toUpperCase()}-${String(index+1).padStart(3,'0')}`
    if(next.skus.some(s=>s.id!==skuId&&s.code===code))throw Error(`演示 SKU 编码 ${code} 已占用`)
    const published=editSku(next,skuId,{...sku,code,skuName:`${name} · ${Object.values(sku.variantAttrs).join(' / ')}`,status:'on_sale'},time);if(!published.ok)throw Error(published.message)
   }
  }
  const phone=next.skus.find(s=>s.familyId===familyId('phone'))!,device=resolveDeviceSku(next,phone.id)
  if(!device.host||device.status!=='resolved')throw Error('演示手机型号未能唯一解析')
  for(const kind of ['case','film'])for(const sku of next.skus.filter(s=>s.familyId===familyId(kind)))next.compatibilities.push({id:`${prefix}claim-${sku.id}`,accessorySkuId:sku.id,targetKind:'sku',targetId:sku.id,host:cloneRecord(device.host!),capability:'basic',conclusion:'compatible',verification:'confirmed',conditions:[],source,note:'18 Pro Max 模拟型号专属资料',createdAt:time,updatedAt:time})
  for(const sku of next.skus.filter(s=>s.familyId===familyId('charger')))(next.generalCompatibilityClaims||=[]).push({id:`${prefix}general-${sku.id}`,skuId:sku.id,deviceTypeIds:[typeIds.phone!],capability:'basic',conditions:[{kind:'attribute',attributeId:axes.port.id,operator:'eq',value:'USB-C'}],conclusion:'compatible',verification:'confirmed',source,note:'仅演示必要接口事实核验，不推测快充',revision:1,createdAt:time,updatedAt:time})
  for(const [id,name,types,sort] of [['demo18-bundle-full','手机充电保护权益包',[typeIds.phone!,typeIds.case!,typeIds.film!,typeIds.charger!],-40],['demo18-bundle-protect','手机基础保护权益包',[typeIds.phone!,typeIds.case!,typeIds.film!],-30]] as const){const result=writeGroup(next,{id:'',name,categoryId,productTypeIds:[...types],enabled:true,sort},0,()=>id,time);if(!result.ok)throw Error(result.message)}
  const problem=checkInstalled(next);if(problem)throw Error(problem)
  return {ok:true as const,next,added:10,message:'已创建 18 Pro Max 完整演示：4 个已发布模型、10 个在售 SKU、正式适用资料和 2 个权益包。'}
 }catch(error){return fail(error instanceof Error?error.message:String(error))}
}
