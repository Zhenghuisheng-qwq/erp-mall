import {projectAttrs} from './logic'
import {familyProductTypeId} from './productIdentity'
import {modelSpecificationContext} from './modelSourceContext'
import {roleOfType} from './productTypePurpose'
import { isMaterialArchive, isRealSku } from './catalogIdentity'
import { legalPlanningCombinations } from './planning'
import type { AppData, PlanningStep, ProductFamily, ProductSpecNode, Sku } from './types'
export interface CatalogHost {scope:'model'|'planning';productTypeId:string;productModelId:string;identityKey:string;steps:{attributeId:string;attributeName:string;valueId:string}[];planningId?:string}
export interface DeviceModelOption {key:string;host:CatalogHost;label:string;productTypeName:string;source:'model'|'template'|'manual'|'legacy';planningIds:string[];versionIds:string[]}
export interface DeviceResolution {status:'resolved'|'unconfigured'|'ambiguous'|'invalid';skuId:string;host?:CatalogHost;planningId?:string;candidates:DeviceModelOption[];message:string;source:string;attributes:Record<string,string>;sourceStamp:string}
export function hostLabel(host: CatalogHost) {
  return host.steps.map((step) => step.valueId).filter(Boolean).join(' ')
}

export function hostFrom(productTypeId: string, productModelId: string, steps: { attributeId: string; attributeName: string; valueId: string }[], planningId = ''): CatalogHost {
  return {
    scope: planningId ? 'planning' : 'model',
    productTypeId,
    productModelId,
    identityKey: hostIdentityKey(steps),
    steps: steps.map((step) => ({ attributeId: step.attributeId, attributeName: step.attributeName, valueId: step.valueId })),
    planningId: planningId || undefined,
  }
}

export function hostIdentityKey(steps: { attributeId: string; valueId: string }[]) {
  return steps.map((step) => `${step.attributeId}=${step.valueId}`).join('\u001e')
}

export function deviceHostKey(host: CatalogHost) { return JSON.stringify([host.productTypeId, host.productModelId, host.identityKey]) }
export function sameDeviceHost(left: CatalogHost, right: CatalogHost, includeScope = true) {
  return deviceHostKey(left) === deviceHostKey(right) && (!includeScope || (left.scope === right.scope && (left.planningId || '') === (right.planningId || '')))
}
export function familyCatalogRole(data: AppData, familyId: string): 'host' | 'accessory' | 'other' {
  const typeId = familyProductTypeId(data, familyId)
  return typeId ? roleOfType(data, typeId) : 'other'
}
export function skuCatalogRole(data: AppData, skuId: string) {
  const sku = data.skus.find(item => item.id === skuId)
  return sku ? familyCatalogRole(data, sku.familyId) : 'other'
}
function familyType(data: AppData, family: ProductFamily) {
  return family.productTypeId || data.specCanvases.find(item => item.templateId === (family.productModelId || family.templateId))?.productTypeId || ''
}
function modelType(data: AppData, modelId: string) {
  return data.specCanvases.find(item => item.templateId === modelId)?.productTypeId || data.families.find(item => (item.productModelId || item.templateId) === modelId && item.productTypeId)?.productTypeId || data.productPlans.find(item => item.productModelId === modelId)?.productTypeId || ''
}
function identityIds(data: AppData) {
  const explicit = data.params.filter(item => item.identityRole === 'host-model').map(item => item.id)
  // Legacy fallback uses the existing dictionary role convention, never product names.
  return new Set(explicit.length ? explicit : data.params.filter(item => item.name === '型号').map(item => item.id))
}
function stepChain(data: AppData, steps: PlanningStep[]) {
  const ids = identityIds(data), model = steps.find(step => ids.has(step.attributeId))
  if (!model) return undefined
  const values = new Map(steps.map(step => [step.valueNodeId, step]))
  const chain: PlanningStep[] = [], seen = new Set<string>()
  let current: PlanningStep | undefined = model
  while (current && !seen.has(current.valueNodeId)) {
    seen.add(current.valueNodeId); chain.push(current)
    current = current.parentValueNodeId ? values.get(current.parentValueNodeId) : undefined
  }
  return chain.reverse()
}
function snapshotHosts(data: AppData, nodes: ProductSpecNode[]) {
  const ids = identityIds(data), byId = new Map(nodes.map(node => [node.id, node]))
  return nodes.filter(node => node.nodeType === 'VALUE' && ids.has(byId.get(node.parentId || '')?.attributeId || node.attributeId)).flatMap(node => {
    const chain: { attributeId: string; attributeName: string; valueId: string }[] = [], seen = new Set<string>()
    let current: ProductSpecNode | undefined = node
    while (current && !seen.has(current.id)) {
      seen.add(current.id)
      if (current.nodeType === 'VALUE') {
        const attribute = byId.get(current.parentId || ''), id = attribute?.attributeId || current.attributeId
        if (!id || !current.valueId) return []
        chain.push({ attributeId: id, attributeName: data.params.find(param => param.id === id)?.name || id, valueId: current.valueId })
      }
      current = current.parentId ? byId.get(current.parentId) : undefined
    }
    return chain.length ? [chain.reverse()] : []
  })
}
function actualAttributes(data: AppData, family: ProductFamily, sku: Sku) {
  const attributes: Record<string, string> = {}, conflicts: string[] = []
  for (const param of data.params) {
    const common = family.commonAttrs[param.id] ?? family.commonAttrs[param.name]
    const variant = sku.variantAttrs[param.id] ?? sku.variantAttrs[param.name]
    if (common && variant && common !== variant) conflicts.push(param.name)
    const value = variant || common
    if (value) attributes[param.id] = value
  }
  return { attributes, conflicts }
}
function templateHost(data: AppData, family: ProductFamily, sku: Sku) {
  if (!data.templates.some(template => template.id === family.templateId && template.enabled)) return undefined
  const bound = new Set(data.templateParams.filter(item => item.templateId === family.templateId).map(item => item.paramId))
  const { attributes, conflicts } = actualAttributes(data, family, sku)
  if (conflicts.length) return undefined
  const steps = data.params.filter(param => identityIds(data).has(param.id) && bound.has(param.id) && attributes[param.id]).map(param => ({ attributeId: param.id, attributeName: param.name, valueId: attributes[param.id] || '' }))
  return steps.length ? hostFrom(familyType(data, family), `template:${family.templateId}`, steps) : undefined
}

/** Candidate catalogue includes frozen versions and explicit models even without MAT, active PLN or sale SKU. */
export function listDeviceModels(data: AppData): DeviceModelOption[] {
  const options = new Map<string, DeviceModelOption>()
  function add(host: CatalogHost, source: DeviceModelOption['source'], versionId = '', planningId = '', label = '') {
    if (roleOfType(data, host.productTypeId) !== 'host') return
    const modelHost = { ...host, scope: 'model' as const, planningId: undefined, steps: host.steps.map(step => ({ ...step })) }
    const key = deviceHostKey(modelHost), previous = options.get(key)
    if (previous) {
      if (versionId && !previous.versionIds.includes(versionId)) previous.versionIds.push(versionId)
      if (planningId && !previous.planningIds.includes(planningId)) previous.planningIds.push(planningId)
      return
    }
    options.set(key, { key, host: modelHost, label: label || host.steps.map(step=>step.valueId).filter((value,index,values)=>!values.slice(index+1).some(next=>next.startsWith(value+' '))).join(' '), productTypeName: data.productTypes.find(type => type.id === host.productTypeId)?.name || '未分类', source, versionIds: versionId ? [versionId] : [], planningIds: planningId ? [planningId] : [] })
  }
  for (const version of data.specModelVersions) {
    const typeId = modelType(data, version.templateId)
    if (roleOfType(data, typeId) !== 'host') continue
    for (const chain of snapshotHosts(data, version.nodesSnapshot)) add(hostFrom(typeId, version.templateId, chain), 'model', version.id)
  }
  for (const record of data.planningRecords || []) {
    if (record.origin === 'temporary' || !data.templates.some(item => item.id === record.productModelId)) continue
    const chain = stepChain(data, record.steps), typeId = modelType(data, record.productModelId)
    if (chain) add(hostFrom(typeId, record.productModelId, chain), 'legacy', record.modelVersionId, record.planningId)
  }
  for (const sku of data.skus) {
    const family = data.families.find(item => item.id === sku.familyId)
    if (!family || !isRealSku(data, sku) || family.modelVersionId || sku.modelVersionId || sku.creationSource?.modelVersionId || familyCatalogRole(data, family.id) !== 'host') continue
    const host = templateHost(data, family, sku)
    if (host) add(host, 'template')
  }
  return [...options.values()].sort((a, b) => a.label.localeCompare(b.label, 'zh') || a.key.localeCompare(b.key))
}

export function deviceSourceStamp(data: AppData, skuId: string): string {
  const sku = data.skus.find(item => item.id === skuId), family = sku && data.families.find(item => item.id === sku.familyId)
  if (!sku || !family) return ''
  const { attributes } = actualAttributes(data, family, sku)
  return JSON.stringify({ familyId: family.id, typeId: familyType(data, family), templateId: family.templateId, productModelId: family.productModelId || '', familyVersion: family.modelVersionId || '', skuVersion: sku.modelVersionId || '', source: sku.creationSource ? { kind: sku.creationSource.kind, templateId: sku.creationSource.templateId, modelVersionId: sku.creationSource.modelVersionId, productPlanId: sku.creationSource.productPlanId || '' } : null, identity: [...identityIds(data)].sort().map(id => [id, attributes[id] || '']) })
}

export interface DeviceResolutionContext {
  skus: Map<string, Sku>
  families: Map<string, ProductFamily>
  hostOptions: DeviceModelOption[]
  combinations: Map<string, ReturnType<typeof legalPlanningCombinations>>
  realSkuIds: Set<string>
  materialIds: Set<string>
}
/** A caller can share this within one read operation; never retain it across edits. */
export function createDeviceResolutionContext(data: AppData): DeviceResolutionContext {
  return { skus: new Map(data.skus.map(sku => [sku.id, sku])), families: new Map(data.families.map(family => [family.id, family])), hostOptions: listDeviceModels(data), combinations: new Map(), realSkuIds: new Set(data.skus.filter(sku => isRealSku(data, sku)).map(sku => sku.id)), materialIds: new Set(data.skus.filter(sku => isMaterialArchive(data, sku)).map(sku => sku.id)) }
}
export function resolveDeviceSku(data: AppData, skuId: string, context?: DeviceResolutionContext): DeviceResolution {
  const sourceStamp = deviceSourceStamp(data, skuId)
  const result: DeviceResolution = { status: 'unconfigured', skuId, candidates: [], message: '尚未确认设备型号，请配置型号。', source: '未记录', attributes: {}, sourceStamp }
  const sku = context ? context.skus.get(skuId) : data.skus.find(item => item.id === skuId), family = sku && (context ? context.families.get(sku.familyId) : data.families.find(item => item.id === sku.familyId))
  function invalid(message: string) { return { ...result, status: 'invalid' as const, message } }
  if (!sku || !family || !(context ? context.realSkuIds.has(sku.id) : isRealSku(data, sku))) return invalid('设备 SKU 引用已失效或不是销售 SKU。')
  if (familyCatalogRole(data, family.id) !== 'host') return invalid('当前记录未配置为主机产品类型。')
  const actual = actualAttributes(data, family, sku)
  result.attributes = actual.attributes
  if (actual.conflicts.length) return invalid(`公共属性与 SKU 规格矛盾：${actual.conflicts.join('、')}。请先处理来源。`)
  const all = context?.hostOptions || listDeviceModels(data)
  const source = sku.creationSource
  const versionIds = [...new Set([source?.modelVersionId, sku.modelVersionId, family.modelVersionId].filter((id): id is string => Boolean(id)))]
  if (versionIds.length > 1) return invalid('SKU 与 SPU 绑定的发布版本矛盾，请先处理来源。')
  const modelId = source?.templateId || family.productModelId || family.templateId
  const versionId = versionIds[0]
  if (source?.kind === 'plan') {
    const plan = data.productPlans.find(item => item.id === source.productPlanId)
    if (!plan || !versionId) return invalid('生成规划或绑定历史版本引用已失效，不会套用最新版本。')
    // ProductPlan is editable after generation. The SKU's own version, values
    // and node references are the frozen creation facts; current plan edits
    // must never narrow or replace that historical scope.
  }
  if ((source?.kind === 'model' || source?.kind === 'plan') && !versionId) return invalid('生成来源缺少绑定历史版本，不会套用最新版本。')
  if (versionId) {
    const version = data.specModelVersions.find(item => item.id === versionId && item.templateId === modelId)
    if (!version) return invalid('绑定历史版本引用已失效，不会套用最新版本。')
    const byNode = new Map(version.nodesSnapshot.map(node => [node.id, node]))
    if (sku.sourceNodeIds?.some(id => byNode.get(id)?.nodeType !== 'VALUE')) return invalid('SKU 来源节点在绑定历史快照中已失效。')
    const requiredNodes = sku.sourceNodeIds || []
    let versionCombos = context?.combinations.get(version.id)
    if (!versionCombos) { versionCombos = modelSpecificationContext(data, modelId, version.id).combinations; context?.combinations.set(version.id, versionCombos) }
    const combos = versionCombos.filter(combo => requiredNodes.every(id => combo.steps.some(step => step.valueNodeId === id)) && combo.steps.every(step => !actual.attributes[step.attributeId] || actual.attributes[step.attributeId] === step.valueId))
    if (!combos.length) return invalid('当前规格与绑定的历史快照不一致，请检查来源。')
    const keys = new Set(combos.flatMap(combo => { const chain = stepChain(data, combo.steps); return chain ? [deviceHostKey(hostFrom(familyType(data, family), modelId, chain))] : [] }))
    result.candidates = all.filter(option => keys.has(option.key) && option.versionIds.includes(versionId))
    result.source = source?.kind === 'plan' ? '规划生成 · 绑定历史快照' : '模型来源 · 绑定历史快照'
    if (combos.length === 1) {
      const combo = combos[0]
      const planning = data.planningRecords.filter(record => record.productModelId === modelId && record.identityKey === combo?.identityKey && (record.modelVersionId === versionId || record.originModelVersionId === versionId || record.modelVersionIds.includes(versionId)))
      if (sku.planningId && !planning.some(record => record.planningId === sku.planningId)) return invalid('SKU 的 PLN 引用与当前规格不一致。')
      if (sku.planningId || planning.length === 1) result.planningId = sku.planningId || planning[0]?.planningId
    } else if (sku.planningId) return invalid('无法唯一确认当前 PLN 的具体规格。')
  } else {
    if (!data.templates.some(template => template.id === family.templateId && template.enabled)) return invalid('设备属性方案引用已失效。')
    const host = templateHost(data, family, sku)
    result.candidates = host ? all.filter(option => sameDeviceHost(option.host, host, false)) : []
    result.source = source?.kind === 'template' ? '模板属性 · 型号身份' : '公共属性与 SKU 规格 · 型号身份'
  }
  if (result.candidates.length === 1) { result.status = 'resolved'; result.host = result.candidates[0]?.host; result.message = '' }
  else if (result.candidates.length > 1) { result.status = 'ambiguous'; result.message = '存在多个可能型号，请明确选择设备型号。' }
  return result
}

/** Read-only projection of the existing catalogue; no separately authored device directory. */
export function catalogDeviceOptions(data:AppData){return {models:listDeviceModels(data),skus:data.skus.filter(s=>isRealSku(data,s)&&skuCatalogRole(data,s.id)==='host').map(s=>{const f=data.families.find(f=>f.id===s.familyId)!;return {id:s.id,name:s.skuName||f.name,code:s.code,spec:Object.entries(projectAttrs(f,s)).map(([k,v])=>(data.params.find(p=>p.id===k)?.name||k)+' '+v).join(' · ')}})}}
