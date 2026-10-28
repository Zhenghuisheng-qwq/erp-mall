import {isRealSku} from '../catalogIdentity'
import {projectAttrs,shelfOf} from '../logic'
import {compatibilityFamilyTypeId,compatibilityRecordRole,deviceHostKey,listDeviceModels} from '../deviceResolution'
import {queryDeviceAccessories,queryModelAccessories,accessoryUseEvaluation} from '../accessoryCompatibilityQuery'
import {templateProductType} from '../templateHostCompatibility'
import type {AppData} from '../types'
import type {BenefitDevice,BenefitGroup,BenefitScope} from './types'
export function sellableSkuProblem(data:AppData,id:string,role:'host'|'accessory'){
 const sku=data.skus.find(s=>s.id===id),family=data.families.find(f=>f.id===sku?.familyId)
 if(!sku||!family||!isRealSku(data,sku))return '不是有效的真实销售商品'
 const type=data.productTypes.find(t=>t.id===compatibilityFamilyTypeId(data,family.id))
 if(!type||type.status!=='enabled'||type.catalogRole!==role)return '产品类型已停用或身份不符'
 if(sku.status!=='on_sale'||shelfOf(family)!=='online')return '商品当前不在售'
 return ''
}
export function benefitSkuLabel(data:AppData,id:string){
 const sku=data.skus.find(s=>s.id===id),family=data.families.find(f=>f.id===sku?.familyId)
 return {name:sku?.skuName||family?.name||'商品已不存在',code:sku?.code||'',spec:sku&&family?Object.entries(projectAttrs(family,sku)).map(([k,v])=>`${data.params.find(p=>p.id===k)?.name||k} ${v}`).join(' · '):''}
}
export function benefitDevices(data:AppData){return data.skus.filter(s=>isRealSku(data,s)&&compatibilityRecordRole(data,s.id)==='host').map(s=>{
 const family=data.families.find(f=>f.id===s.familyId)!,type=data.productTypes.find(t=>t.id===compatibilityFamilyTypeId(data,family.id))
 return {id:s.id,...benefitSkuLabel(data,s.id),typeName:type?.name||'',categoryName:data.categories.find(c=>c.id===(family.categoryId||type?.categoryId))?.name||'',offSale:!!sellableSkuProblem(data,s.id,'host')}
})}
export function benefitCandidates(data:AppData,device:BenefitDevice){
 const option=device.kind==='model'?listDeviceModels(data).find(o=>o.key===device.hostKey):undefined
 const query=device.kind==='sku'?queryDeviceAccessories(data,device.skuId):queryModelAccessories(data,option?.host)
 const host=query.device.host,sku=device.kind==='sku'?data.skus.find(s=>s.id===device.skuId):undefined,family=data.families.find(f=>f.id===sku?.familyId)
 const modelId=sku?(sku.creationSource?.templateId||family?.productModelId||family?.templateId||''):host?.productModelId||''
 const validType=host&&data.productTypes.some(t=>t.id===host.productTypeId&&t.catalogRole==='host'&&t.status==='enabled')
 const issue=query.device.status!=='resolved'||!host?query.device.message||'当前设备型号尚未明确，需要先维护设备身份':!validType?'设备产品类型已停用或身份不符':''
 const invalidTargets=new Set(query.issues.flatMap(i=>{const l=data.compatibilities.find(l=>l.id===i.declarationId);return l?[l.targetId||l.accessorySkuId]:[]}))
 const candidates=issue?[]:query.sales.filter(match=>{const use=accessoryUseEvaluation(match);return match.target.kind==='sku'&&!sellableSkuProblem(data,match.sku.id,'accessory')&&!invalidTargets.has(match.sku.id)&&use.status==='compatible'&&!use.conflict&&use.conditions.every(c=>c.state==='met')})
 const label=sku?benefitSkuLabel(data,sku.id):{name:option?.label||'型号已失效',spec:'客户自有设备 · 型号级依据',code:''}
 return {query,candidates,issue,modelId,hostKey:host?deviceHostKey(host):'',label}
}
export function applicableBenefitGroups(groups:BenefitGroup[],context:ReturnType<typeof benefitCandidates>){return groups.filter(g=>g.enabled&&!context.issue&&g.scope.modelId===context.modelId&&(!g.scope.hostKey||g.scope.hostKey===context.hostKey)).sort((a,b)=>a.sort-b.sort||a.name.localeCompare(b.name,'zh'))}
export function benefitScopeProblem(data:AppData,scope:BenefitScope){
 const type=templateProductType(data,scope.modelId)
 if(!type||type.catalogRole!=='host'||type.status!=='enabled')return '请选择明确、启用的主机商品模型'
 if(scope.hostKey&&!listDeviceModels(data).some(o=>o.key===scope.hostKey&&o.host.productModelId===scope.modelId))return '型号不属于当前模型或身份已失效'
 return ''
}
/** Walk the selected branch to its real identity attribute; never expand the model Cartesian product. */
export function benefitNodeHosts(data:AppData,modelId:string,nodeId:string,versionId?:string){
 const options=listDeviceModels(data).filter(o=>o.host.productModelId===modelId&&(!versionId||o.versionIds.includes(versionId)))
 if(!nodeId)return options
 const nodes=versionId?data.specModelVersions.find(v=>v.id===versionId&&v.templateId===modelId)?.nodesSnapshot||[]:data.productSpecNodes.filter(n=>n.templateId===modelId)
 const byId=new Map(nodes.map(n=>[n.id,n])),chain:{attributeId:string;valueId:string}[]=[],seen=new Set<string>()
 let node=byId.get(nodeId)
 while(node&&!seen.has(node.id)){seen.add(node.id);if(node.nodeType==='VALUE')chain.push({attributeId:byId.get(node.parentId||'')?.attributeId||node.attributeId,valueId:node.valueId});node=byId.get(node.parentId||'')}
 const ids=new Set(data.params.filter(p=>p.identityRole==='host-model').map(p=>p.id)),identity=chain.find(s=>ids.has(s.attributeId))
 return identity?options.filter(o=>o.host.steps.some(s=>s.attributeId===identity.attributeId&&s.valueId===identity.valueId)&&o.host.steps.every(s=>!chain.some(c=>c.attributeId===s.attributeId&&c.valueId!==s.valueId))):[]
}
