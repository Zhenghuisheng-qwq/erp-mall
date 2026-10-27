import {isRealSku} from './catalogIdentity'
import {salesCatalogTypeId,salesSkuAdmission} from './salesCatalog'
import {resolveSalesPlan,planProblems,salesPlanVersionProblems} from './salesConfiguration'
import {validateBenefitPackage} from './benefitPackages'
import {savedSkuName,savedSkuSpec} from './productList'
import type {AppData} from './types'
import type {SalesOptionBinding,SalesOptionItem,SalesPlanResolution} from './salesConfigurationTypes'

export interface ProductBenefitCandidate {
  key:string;planId:string;planName:string;version:number|null;itemId:string;itemName:string
  scopeLabel:string;state:'published'|'draft'|'disabled'|'invalid'|'unknown';message:string;bindingIds:string[]
}
export interface ProductBenefitMember {
  id:string;name:string;code:string;status:string;favorite:boolean;quantity:number|null
  supported:boolean;usable:boolean;message:string
}
export interface ProductBenefitRelations {
  skuId:string;valid:boolean;message:string;skuLabel:string;spec:string
  configurationsReadable:boolean;packagesReadable:boolean
  effective?:SalesPlanResolution
  effectiveRanges:{id:string;planId:string|null;planVersion:number|null;label:string}[]
  candidates:ProductBenefitCandidate[];packages:ProductBenefitMember[];diagnostics:string[]
}

/** Stable IDs only. A declared candidate range never establishes compatibility. */
function includesSku(item:SalesOptionItem,skuId:string,familyId:string,typeId:string){
  const scope=item?.scope
  if(!scope||!Array.isArray(scope.ids))return false
  return scope.kind==='skus'?scope.ids.includes(skuId):scope.kind==='families'?scope.ids.includes(familyId):scope.kind==='product-types'?!!typeId&&scope.ids.includes(typeId):false
}
export function productBenefitBindingLabel(data:AppData,binding:SalesOptionBinding){
  if(binding.scope.kind==='products')return `明确 ${binding.scope.familyIds.length} 个 SPU／${binding.scope.skuIds.length} 个 SKU`
  const scope=binding.scope,model=data.specCanvases.find(item=>item.templateId===scope.modelId),version=data.specModelVersions.find(item=>item.id===scope.versionId&&item.templateId===scope.modelId)
  return `${model?.name||scope.modelId} · ${version?.versionName||(scope.versionId?'指定版本失效':'模型草稿')}${scope.selector?' · 明确规格范围':scope.nodeId?' · 节点范围':' · 全部合法规格'}`
}

/** Pure detail query. It neither creates member relations nor expands dynamic ranges into saved SKUs. */
export function queryProductBenefitRelations(data:AppData,skuId:string,can:(permission:string)=>boolean=()=>true):ProductBenefitRelations{
  const result:ProductBenefitRelations={skuId,valid:false,message:'',skuLabel:'',spec:'',configurationsReadable:can('product:sales-config:read'),packagesReadable:can('product:benefit:read'),effectiveRanges:[],candidates:[],packages:[],diagnostics:[]}
  if(!can('product:sku:read')){result.message='当前身份没有销售 SKU 读取权限，无法查看具体规格的关联权益包。';return result}
  const sku=data.skus.find(item=>item.id===skuId)
  if(!sku||!isRealSku(data,sku)){result.message='请选择仍存在的真实销售 SKU；物料和规划记录不计入关联权益包。';return result}
  const family=data.families.find(item=>item.id===sku.familyId)
  if(!family){result.message='此 SKU 的所属 SPU 已失效，请先核对商品资料。';return result}
  result.valid=true;result.skuLabel=savedSkuName(sku);result.spec=savedSkuSpec(family,sku)
  if(result.configurationsReadable){
    try{
      result.effective=resolveSalesPlan(data,skuId)
      // Use the resolver's complete hit set, including all conflicting records.
      result.effectiveRanges=result.effective.bindingIds.flatMap(id=>{const binding=data.salesOptionBindings?.find(item=>item.id===id);return binding?[{id,planId:binding.planId,planVersion:binding.planVersion,label:productBenefitBindingLabel(data,binding)}]:[]})
    }catch{result.effective={state:'invalid',message:'此商品的来源或范围配置无法解析，请进入权益包配置核对原记录。',bindingIds:[],source:{state:'invalid',skuId,modelId:'',versionId:'',identityKey:'',message:'原记录无法解析'}}}
    const typeId=salesCatalogTypeId(data,family)
    const admission=salesSkuAdmission(data,sku)
    for(const plan of data.salesOptionPlans||[]){
      if(plan.schemaVersion!==1){result.diagnostics.push(`配置「${plan.name||plan.id}」格式暂不支持，未作为正常候选配置推荐。`);continue}
      const versions=Array.isArray(plan.versions)?plan.versions:[]
      for(const version of versions){
        const problems=salesPlanVersionProblems(version)
        if(problems.length){result.diagnostics.push(`配置「${plan.name}」v${version.version} 内容无法完整解析。`);continue}
        for(const item of version.items.filter(entry=>includesSku(entry,skuId,family.id,typeId))){
          const bindings=(data.salesOptionBindings||[]).filter(binding=>binding.schemaVersion===1&&binding.planId===plan.id&&binding.planVersion===version.version)
          const invalid=planProblems(data,version),state=plan.status==='disabled'||!item.enabled?'disabled':invalid.length?'invalid':'published'
          const message=state==='disabled'?(plan.status==='disabled'?'配置已停用':'此项目已停用'):invalid[0]||(!bindings.some(binding=>binding.enabled)?'已发布版本尚无启用的应用范围；不代表此商品已经可选。':'列为候选，实际适用性仍按具体设备核对。')
          result.candidates.push({key:`${plan.id}:${version.version}:${item.id}`,planId:plan.id,planName:plan.name,version:version.version,itemId:item.id,itemName:item.name,scopeLabel:item.scope.kind==='product-types'?'动态产品类型范围':item.scope.kind==='families'?'动态 SPU 范围':'明确销售 SKU 范围',state,message:message+(admission.allowed?'':` 当前规格不能作为购买实物：${admission.reason}`),bindingIds:bindings.map(binding=>binding.id)})
        }
      }
      const current=versions.find(version=>version.version===plan.publishedVersion)
      const changed=!current||JSON.stringify([plan.name,plan.items,plan.rules])!==JSON.stringify([current.name,current.items,current.rules])
      if(changed&&Array.isArray(plan.items))for(const item of plan.items.filter(entry=>includesSku(entry,skuId,family.id,typeId))){
        result.candidates.push({key:`${plan.id}:draft:${item.id}`,planId:plan.id,planName:plan.name,version:null,itemId:item.id,itemName:item.name,scopeLabel:item.scope.kind==='product-types'?'动态产品类型范围':item.scope.kind==='families'?'动态 SPU 范围':'明确销售 SKU 范围',state:'draft',message:'未发布配置输入，不参与当前正式选购。',bindingIds:[]})
      }
    }
  }
  if(result.packagesReadable)for(const pack of data.benefitPackages||[]){
    if(!Array.isArray(pack.goods)){result.diagnostics.push(`权益包「${pack.name||pack.id}」成员格式无法解析，未作为可用组合推荐。`);continue}
    const members=pack.goods.filter(line=>line?.skuId===skuId)
    if(!members.length)continue
    const supported=(pack.compositionVersion===undefined||pack.compositionVersion===1||pack.compositionVersion===2)&&(!pack.sales||pack.sales.schemaVersion===1)&&(!pack.framework||['type-v1','type-v2'].includes(pack.framework.kind))
    const count=members.reduce((total,line)=>Number.isSafeInteger(line.quantity)&&line.quantity>0?total+line.quantity:NaN,0),quantity=Number.isSafeInteger(count)&&count>0?count:null
    let usable=false,message=''
    if(!supported)message='未知配置版本，仅保留查看，不作为正常可用组合推荐。'
    else if(pack.status==='disabled')message='权益包已停用，不能作为可用组合使用。'
    else if(pack.status!=='available')message='权益包仍为草稿，请先补齐并核对内容。'
    else if(quantity===null)message='此商品的成员数量记录异常，请核对权益包。'
    else try{const validation=validateBenefitPackage(data,pack);usable=validation.canSaveAvailable;message=usable?'实际成员已保存；使用此组合会建立新的选购草稿。':validation.issues.find(issue=>issue.severity==='error'||issue.severity==='condition')?.message||'权益包内容需要重新核对。'}catch{message='权益包内容无法完整校验，请查看原记录处理。'}
    result.packages.push({id:pack.id,name:pack.name||'未命名权益包',code:pack.code,status:pack.status,favorite:!!pack.favorite,quantity,supported,usable,message})
  }
  return result
}
