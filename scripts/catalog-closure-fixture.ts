import {r01Fixture} from './r01-fixture'
import {freezeBusinessNodes} from '../src/domain/nodeBusiness'
import {freezeTemplateCompatibility} from '../src/domain/templateCompatibility'
import {reconcilePlanningRecords} from '../src/domain/planning'
import {ensureRbac} from '../src/domain/rbac'
import type {SpecModelVersion} from '../src/domain/types'

export function catalogClosureFixture(){
  const {data,modelId:a}=r01Fixture(),b='closure-model-b',c='closure-model-c',now='2026-10-27T00:00:00.000Z'
  data.params.find(param=>param.id==='r01-color')!.identityRole='host-model'
  data.productTypes.find(type=>type.id==='r01-type')!.catalogRole='host'
  for(const id of [b,c]){
    data.templates.push({...structuredClone(data.templates.find(item=>item.id===a)!),id,name:id})
    data.specCanvases.push({...structuredClone(data.specCanvases.find(item=>item.templateId===a)!),templateId:id,name:id})
    data.templateParams.push(...data.templateParams.filter(item=>item.templateId===a).map(item=>({...item,templateId:id})))
    data.productSpecNodes.push(...data.productSpecNodes.filter(item=>item.templateId===a).map(item=>({...structuredClone(item),id:item.id.replace(a,id),templateId:id,parentId:item.parentId?.replace(a,id)||null})))
  }
  const versions:SpecModelVersion[]=[]
  for(const [modelId,number] of [[a,1],[a,2],[b,1]] as const){
    const attr=data.productSpecNodes.find(item=>item.id===`${modelId}-brand`)!
    attr.namingRule=[{kind:'text',text:`${modelId}-V${number}`}]
    const version:SpecModelVersion={id:`${modelId}-v${number}`,templateId:modelId,version:number,versionName:`${modelId} V${number}`,status:'published',nodesSnapshot:freezeBusinessNodes(data,data.productSpecNodes.filter(item=>item.templateId===modelId)),createdTime:now,publishTime:now,templateCompatibilitySnapshot:freezeTemplateCompatibility(data,modelId)}
    versions.push(version);data.specModelVersions.push(version)
    data.planningRecords=reconcilePlanningRecords({records:data.planningRecords,data,productModelId:modelId,modelVersionId:version.id,nodes:version.nodesSnapshot,now}).records
  }
  data.productSpecNodes.find(item=>item.id===`${a}-brand`)!.namingRule=[{kind:'text',text:'closure-current-draft'}]
  const bVersion=versions.find(item=>item.templateId===b)!,record=data.planningRecords.find(item=>item.productModelId===b&&item.modelVersionIds.includes(bVersion.id))!
  const family={...structuredClone(data.families[0]!),id:'closure-material-family',templateId:b,productModelId:b,productTypeId:'r01-type',modelVersionId:bVersion.id,line:'v3' as const}
  data.families.push(family)
  data.skus.push({...structuredClone(data.skus[0]!),id:'closure-material',familyId:family.id,recordKind:'material',line:'v3',skuName:'B版本真实物料',materialCode:'MAT-CLOSURE-B',modelVersionId:bVersion.id,planningId:record.planningId})
  ensureRbac(data)
  for(const [id,codes] of [['closure-create',['product:type:read','product:type:create','product:category:read']],['closure-read',['product:model-designer:read','product:model:read','product:type:read','product:category:read','product:compatibility:read','product:sales-config:read']]] as const){
    data.rbac!.roles.push({id,code:id,name:id,description:'isolated regression',enabled:true,permissionCodes:[...codes]})
    data.users.push({id,username:id,displayName:id,enabled:true,role:'operator',roleIds:[id]})
  }
  return {data,a,b,c,v1:versions[0]!,v2:versions[1]!,bv:bVersion}
}
