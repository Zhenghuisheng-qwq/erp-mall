import type { AppData, ProductSpecNode } from './types'
import { businessRecordProblems, configStructureProblem, definitionStructureProblem, safeBusinessConfigs } from './nodeBusinessStructure'

export interface BusinessDefinition { id: string; kind: string; name: string; description: string; enabled: boolean }
export interface NodeBusinessConfig {
  id: string; definitionId: string; modelId: string; nodeId: string
  enabled: boolean; scope: string; parameters: Record<string, unknown>
  /** Only published nodes carry this immutable directory description. */
  definitionSnapshot?: BusinessDefinition
  dictionarySnapshot?: { id: string; name: string; values: string[] }
}
export interface BusinessIssue { nodeId: string; configId?: string; code: string; message: string }
export const BUSINESS_KINDS = ['sales-position', 'material-policy', 'allowed-values', 'naming'] as const
export function defaultBusinessDefinitions(): BusinessDefinition[] {
  return [
    { id:'business:sales', kind:'sales-position', name:'销售定位', description:'畅销或不畅销，不改变规格和商品等级。', enabled:true },
    { id:'business:material', kind:'material-policy', name:'物料策略', description:'独立物料或共用物料；执行时明确选择 MAT 并确认发布版本范围。', enabled:true },
    { id:'business:allowed', kind:'allowed-values', name:'允许值限制', description:'限制本值分支下指定属性的词典候选，不修改全局词典。', enabled:true },
    { id:'business:naming', kind:'naming', name:'命名规则', description:'进入原命名编辑器，沿用最近祖先继承与发布版本。', enabled:true },
  ]
}
export const businessDefinitions = (data: AppData): BusinessDefinition[] => data.businessDefinitions === undefined ? defaultBusinessDefinitions() : Array.isArray(data.businessDefinitions) ? data.businessDefinitions.filter(d => !definitionStructureProblem(d)) : []
export function businessImportProblems(data: AppData): string[] {
  const definitions = businessDefinitions(data)
  return [...businessRecordProblems(data, Array.isArray(data.productSpecNodes) ? data.productSpecNodes : [], definitions),
    ...(Array.isArray(data.specModelVersions) ? data.specModelVersions : []).flatMap(v => businessRecordProblems({ ...data, businessDefinitions: undefined }, Array.isArray(v.nodesSnapshot) ? v.nodesSnapshot : [], definitions).map(p => `历史版本 ${v.id} (${v.versionName || v.version})：${p}`))]
}
const clone = <T>(value:T):T => JSON.parse(JSON.stringify(value))
export function businessDefinition(data:AppData, config:NodeBusinessConfig) {
  return (config?.definitionSnapshot && !definitionStructureProblem(config.definitionSnapshot) ? config.definitionSnapshot : undefined) || businessDefinitions(data).find(d=>d.id===config?.definitionId)
}
export function businessPath(nodes:ProductSpecNode[], nodeId:string):ProductSpecNode[] {
  const byId=new Map(nodes.map(n=>[n.id,n])), result:ProductSpecNode[]=[], seen=new Set<string>()
  let node=byId.get(nodeId)
  const modelId=node?.templateId
  while(node && node.templateId===modelId && !seen.has(node.id)) { seen.add(node.id); result.unshift(node); node=node.parentId?byId.get(node.parentId):undefined }
  return result
}
export function configProblem(data:AppData,nodes:ProductSpecNode[],node:ProductSpecNode,config:NodeBusinessConfig):string {
  const structure = configStructureProblem(config, businessDefinitions(data))
  if(structure)return `配置结构无效：${structure} 原文保留。`
  const def=businessDefinition(data,config)
  if(!def || !(BUSINESS_KINDS as readonly string[]).includes(def.kind))return '不支持的配置定义，原文保留；请勿当作空配置发布。'
  if(node.nodeType!=='VALUE'||config.modelId!==node.templateId||config.nodeId!==node.id||!config.id)return '配置必须归属当前模型的具体值节点。'
  if(typeof config.enabled!=='boolean'||!['current','subtree'].includes(config.scope))return '请选择合法的启用状态与明确作用范围。'
  if(!config.parameters || typeof config.parameters!=='object'||Array.isArray(config.parameters))return '配置参数无效。'
  const p=config.parameters
  if(def.kind==='naming')return '命名规则请使用原命名编辑器，不支持第二套命名实例。'
  if(def.kind==='sales-position'&&!['hot','not-hot'].includes(String(p.value)))return '销售定位必须为畅销或不畅销。'
  if(def.kind==='material-policy'&&!['independent','shared'].includes(String(p.value)))return '物料策略必须为独立物料或共用物料。'
  if(def.kind==='allowed-values') {
    if(config.scope!=='subtree')return '允许值限制仅支持当前值下级（subtree），不能限制当前值自身。'
    const param=config.dictionarySnapshot || data.params.find(a=>a.id===p.attributeId)
    if(param && param.id!==p.attributeId)return '冻结词典身份与目标属性不一致。'
    if(!param)return '限制的目标属性已不存在。'
    if(!Array.isArray(p.values)||!p.values.length||p.values.some(v=>typeof v!=='string'||!param.values.includes(v))||new Set(p.values).size!==p.values.length)return '允许值必须是目标词典中有效且不重复的取值，至少选择一项。'
    if(!nodes.some(n=>n.nodeType==='ATTRIBUTE'&&n.attributeId===param.id&&n.id!==node.id&&businessPath(nodes,n.id).some(a=>a.id===node.id)))return '目标属性必须存在于此值的真实下级路径中。'
  }
  return ''
}
export function resolveNodeBusiness(data:AppData,nodes:ProductSpecNode[],nodeId:string,kind:string,targetAttributeId?:string) {
  const path=businessPath(nodes,nodeId), hits:{node:ProductSpecNode;config:NodeBusinessConfig;definition:BusinessDefinition}[]=[], errors:string[]=[]
  errors.push(...businessRecordProblems(data, path, businessDefinitions(data)))
  for(const node of path)for(const config of safeBusinessConfigs(node.businessConfigs)) {
    const def=businessDefinition(data,config)
    if(def?.kind!==kind||!config.enabled||!(node.id===nodeId||config.scope==='subtree'))continue
    if(kind==='allowed-values'&&(node.id===nodeId||config.parameters?.attributeId!==targetAttributeId))continue
    const error=configProblem(data,nodes,node,config)
    if(error)errors.push(`${node.valueId} (${node.id})：${error}`)
    hits.push({node,config,definition:def})
  }
  const signature=(c:NodeBusinessConfig)=>kind==='allowed-values'?JSON.stringify([c.parameters.attributeId,[...(c.parameters.values as string[] || [])].sort()]):JSON.stringify(c.parameters.value)
  const keys=new Set(hits.filter(h=>!configProblem(data,nodes,h.node,h.config)).map(h=>signature(h.config)))
  const state=errors.length?'invalid':keys.size>1?'conflict':hits.length?'effective':'none'
  const sources=hits.map(h=>`${h.node.valueId} (${h.node.id}) · ${h.config.scope==='subtree'?'当前值及其下级':'仅当前值'}`)
  return { state, hits, sources, parameters:state==='effective'?hits[0]?.config.parameters:undefined, message:errors.join('；') || (state==='conflict'?`配置冲突，尚未确定覆盖或交集规则：${sources.join('；')}`:'') }
}
export function allowedBusinessValues(data:AppData,nodes:ProductSpecNode[],attributeNodeId:string):{values:string[];message:string} {
  const node=nodes.find(n=>n.id===attributeNodeId), values=data.params.find(p=>p.id===node?.attributeId)?.values || []
  if(!node)return {values:[],message:'属性节点不存在。'}
  const result=resolveNodeBusiness(data,nodes,node.id,'allowed-values',node.attributeId)
  if(result.state==='invalid'||result.state==='conflict')return {values:[],message:result.message}
  const allowed=result.parameters?.values as string[]|undefined
  const frozenValues=result.hits.find(h=>h.config.dictionarySnapshot)?.config.dictionarySnapshot?.values
  return {values:allowed?(frozenValues || values).filter(v=>allowed.includes(v)):values,message:''}
}
export function businessIssues(data:AppData,nodes:ProductSpecNode[]):BusinessIssue[] {
  const issues:BusinessIssue[]=businessRecordProblems(data,nodes,businessDefinitions(data)).map(message=>({nodeId:'',code:'structure',message})), ids=new Set<string>()
  if (!issues.length && !nodes.some(n=>n.businessConfigs?.length)) return []
  for(const node of nodes) {
    const defs=new Set<string>()
    for(const config of safeBusinessConfigs(node.businessConfigs)) {
      const problem=configProblem(data,nodes,node,config)
      if(problem)issues.push({nodeId:node.id,configId:config?.id,code:'config',message:`${node.valueId || node.id} (${node.id})：${problem}`})
      if(ids.has(config?.id)||defs.has(config?.definitionId))issues.push({nodeId:node.id,configId:config?.id,code:'duplicate',message:`${node.valueId}：重复配置实例，请保留一条。`})
      ids.add(config?.id);defs.add(config?.definitionId)
    }
    if(node.nodeType==='VALUE') {
      for(const kind of ['sales-position','material-policy']) {
        const result=resolveNodeBusiness(data,nodes,node.id,kind)
        if(result.state==='conflict'||result.state==='invalid')issues.push({nodeId:node.id,code:kind,message:`${node.valueId}：${result.message}`})
      }
      if(node.parentId) {
        const allowed=allowedBusinessValues(data,nodes,node.parentId)
        if(allowed.message || (node.valueId&&!allowed.values.includes(node.valueId)&&data.params.find(p=>p.id===node.attributeId)?.values.includes(node.valueId)))issues.push({nodeId:node.id,code:'value',message:`${node.valueId} (${node.id})：${allowed.message || '超出当前路径允许值范围，请修正节点或上级配置。'}`})
      }
    }
    if(node.nodeType==='ATTRIBUTE') {
      const result=resolveNodeBusiness(data,nodes,node.id,'allowed-values',node.attributeId)
      if(result.state==='conflict'||result.state==='invalid')issues.push({nodeId:node.id,code:'restriction',message:result.message})
    }
  }
  return issues
}
/** Structural edits may repair existing invalid drafts, but cannot introduce new violations. */
export function businessStructureProblem(data:AppData,before:ProductSpecNode[],after:ProductSpecNode[]) {
  const key=(i:BusinessIssue)=>`${i.nodeId}:${i.code}:${i.message}`
  const previous=new Set(businessIssues(data,before).map(key))
  return businessIssues(data,after).find(i=>!previous.has(key(i)))?.message || ''
}
export function businessConfigSignature(nodes:ProductSpecNode[]) {
  return JSON.stringify(nodes.map(n=>[n.id,Array.isArray(n.businessConfigs)?n.businessConfigs.map(c=>{if(!c)return c;const {definitionSnapshot,dictionarySnapshot,...rest}=c;return rest}):n.businessConfigs ?? []]))
}
export function freezeBusinessNodes(data:AppData,nodes:ProductSpecNode[]) {
  return clone(nodes).map(n=>({...n,...(n.businessConfigs?{businessConfigs:n.businessConfigs.map(c=>{
    const definition=businessDefinition(data,c)!, param=data.params.find(p=>p.id===c.parameters.attributeId)
    return {...c,definitionSnapshot:clone(definition),...(definition.kind==='allowed-values'&&param?{dictionarySnapshot:{id:param.id,name:param.name,values:[...param.values]}}:{})}
  })}:{})}))
}
export function copyBusinessConfigs(node:ProductSpecNode,modelId:string,nodeId:string,nextId:(prefix:string)=>string) {
  return node.businessConfigs?.map(c=>{const copy=clone(c);delete copy.definitionSnapshot;delete copy.dictionarySnapshot;return {...copy,id:nextId('bc'),modelId,nodeId}})
}
export function businessLabel(value:unknown) { return ({hot:'畅销','not-hot':'不畅销',independent:'独立物料',shared:'共用物料（需明确选择目标）'} as Record<string,string>)[String(value)] || String(value || '未配置') }
