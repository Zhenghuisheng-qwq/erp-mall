import { categoryPath } from './logic'
import type { AppData, CompatibilityHost, CompatibilityLink, PlanningRecord, PlanningStep, Sku } from './types'

export interface HostModelOption {
  key: string
  host: CompatibilityHost
  label: string
  brand: string
  series: string
  modelName: string
  productTypeId: string
  productTypeName: string
  categoryName: string
  specRange: string
  planningIds: string[]
  accessoryCount: number
  typeCounts: { productTypeId: string; name: string; count: number }[]
  sample: boolean
}

export interface AccessoryCandidate {
  skuId: string
  materialCode: string
  skuName: string
  productTypeId: string
  productTypeName: string
  spec: string
  supplierCode: string
  hostCount: number
  linked: boolean
}

export interface CompatibilityResult {
  created: CompatibilityLink[]
  skipped: number
  failed: { message: string }[]
}

export function catalogRole(data: AppData, categoryId: string): 'host' | 'accessory' | 'other' {
  const names = categoryNames(data, categoryId)
  if (names.includes('主机')) return 'host'
  if (names.includes('配件') || names.includes('手机配件')) return 'accessory'
  return 'other'
}

/** 产品类型上的显式角色优先。没有配置时才看分类名称，避免把新数据猜成主机或配件。 */
export function roleOfType(data: AppData, productTypeId: string): 'host' | 'accessory' | 'other' {
  const type = data.productTypes.find((item) => item.id === productTypeId)
  if (!type) return 'other'
  if (type.catalogRole) return type.catalogRole
  return catalogRole(data, type.categoryId)
}

export function listHostModels(data: AppData, keyword = ''): HostModelOption[] {
  const groups = new Map<string, { steps: PlanningStep[]; records: PlanningRecord[]; productTypeId: string }>()
  activeRecords(data).forEach((record) => {
    const chain = modelChain(data, record)
    if (!chain) return
    const productTypeId = productTypeOfModel(data, record.productModelId)
    if (!productTypeId || roleOfType(data, productTypeId) !== 'host') return
    const key = hostIdentityKey(chain)
    const found = groups.get(`${record.productModelId}\u001f${key}`)
    if (found) found.records.push(record)
    else groups.set(`${record.productModelId}\u001f${key}`, { steps: chain, records: [record], productTypeId })
  })
  const text = keyword.trim().toLowerCase()
  return [...groups.values()].flatMap((group) => {
    const host = hostFrom(group.productTypeId, group.records[0].productModelId, group.steps)
    const option = decorateHost(data, host, group.records)
    const hay = `${option.label} ${option.productTypeName} ${option.categoryName} ${option.specRange}`.toLowerCase()
    if (text && !hay.includes(text)) return []
    return [option]
  }).sort((a, b) => a.label.localeCompare(b.label, 'zh'))
}

export function hostByKey(data: AppData, productModelId: string, identityKey: string) {
  return listHostModels(data).find((item) => item.host.productModelId === productModelId && item.host.identityKey === identityKey)
}

export function accessoryCandidates(data: AppData, productTypeId: string, keyword = '', host?: CompatibilityHost): AccessoryCandidate[] {
  const text = keyword.trim().toLowerCase()
  return data.skus.flatMap((sku) => {
    const family = data.families.find((item) => item.id === sku.familyId)
    if (!family?.productTypeId || family.productTypeId !== productTypeId) return []
    if (roleOfType(data, family.productTypeId) !== 'accessory') return []
    const productTypeName = data.productTypes.find((item) => item.id === family.productTypeId)?.name || ''
    const spec = Object.entries(sku.variantAttrs).map(([name, value]) => `${name} ${value}`).join(' · ')
    const hay = `${sku.materialCode || ''} ${sku.skuName || ''} ${spec} ${sku.supplierCode || ''}`.toLowerCase()
    if (text && !hay.includes(text)) return []
    return [{
      skuId: sku.id,
      materialCode: sku.materialCode || '',
      skuName: sku.skuName || '',
      productTypeId,
      productTypeName,
      spec,
      supplierCode: sku.supplierCode || '',
      hostCount: linksOfSku(data, sku.id).length,
      linked: host ? linksOfSku(data, sku.id).some((item) => sameHost(item.host, host)) : false,
    }]
  }).sort((a, b) => a.materialCode.localeCompare(b.materialCode))
}

export function linksOfHost(data: AppData, host: CompatibilityHost) {
  return (data.compatibilities || []).filter((item) => sameHost(item.host, host) || (host.scope === 'model' && item.host.scope === 'planning' && item.host.productModelId === host.productModelId && item.host.identityKey === host.identityKey))
}

export function linksOfSku(data: AppData, skuId: string) {
  return (data.compatibilities || []).filter((item) => item.accessorySkuId === skuId)
}

export function addCompatibility(data: AppData, input: { accessorySkuIds: string[]; hosts: CompatibilityHost[]; note?: string; now?: string; nextId: (prefix: string) => string }): CompatibilityResult {
  if (!Array.isArray(data.compatibilities)) data.compatibilities = []
  const created: CompatibilityLink[] = []
  const failed: { message: string }[] = []
  let skipped = 0
  const now = input.now || new Date().toISOString()
  input.accessorySkuIds.forEach((skuId) => {
    input.hosts.forEach((host) => {
      const problem = validatePair(data, skuId, host)
      if (problem) {
        failed.push({ message: problem })
        return
      }
      if (data.compatibilities.some((item) => item.accessorySkuId === skuId && sameHost(item.host, host))) {
        skipped += 1
        return
      }
      const link: CompatibilityLink = { id: input.nextId('compat'), accessorySkuId: skuId, host: cloneHost(host), note: (input.note || '').trim(), createdAt: now, updatedAt: now }
      data.compatibilities.push(link)
      created.push(link)
    })
  })
  return { created, skipped, failed }
}

export function removeCompatibility(data: AppData, ids: string[]) {
  const wanted = new Set(ids)
  const before = (data.compatibilities || []).length
  data.compatibilities = (data.compatibilities || []).filter((item) => !wanted.has(item.id))
  return before - data.compatibilities.length
}

export function updateCompatibilityNote(data: AppData, id: string, note: string, now = new Date().toISOString()) {
  const link = (data.compatibilities || []).find((item) => item.id === id)
  if (!link) return false
  link.note = note.trim()
  link.updatedAt = now
  return true
}

export function compatibilitySkuBlock(data: AppData, skuId: string) {
  const count = linksOfSku(data, skuId).length
  return count ? `不能删除。这条物料还有 ${count} 条适用主机关系。请先取消这些关系。` : ''
}

export function compatibilityFamilyBlock(data: AppData, familyId: string) {
  const count = data.skus.filter((item) => item.familyId === familyId).reduce((sum, sku) => sum + linksOfSku(data, sku.id).length, 0)
  return count ? `不能删除。这款商品下还有 ${count} 条适用主机关系。请先取消这些关系。` : ''
}

export function compatibilityModelBlock(data: AppData, modelIds: string[]) {
  const count = (data.compatibilities || []).filter((item) => modelIds.includes(item.host.productModelId)).length
  return count ? `不能删除。还有 ${count} 条适用配件关系指向这个型号。请先取消这些关系。` : ''
}

export function hostLabel(host: CompatibilityHost) {
  return host.steps.map((step) => step.valueId).filter(Boolean).join(' ')
}

export function linkResolved(data: AppData, link: CompatibilityLink) {
  const sku = data.skus.find((item) => item.id === link.accessorySkuId)
  const current = listHostModels(data).find((item) => item.host.productModelId === link.host.productModelId && item.host.identityKey === link.host.identityKey)
  return { sku, host: current, missingSku: !sku, missingHost: !current }
}

function decorateHost(data: AppData, host: CompatibilityHost, records: PlanningRecord[]): HostModelOption {
  const type = data.productTypes.find((item) => item.id === host.productTypeId)
  const canvas = data.specCanvases.find((item) => item.templateId === host.productModelId)
  const links = (data.compatibilities || []).filter((item) => item.host.productModelId === host.productModelId && item.host.identityKey === host.identityKey)
  const typeCounts = new Map<string, { productTypeId: string; name: string; count: number }>()
  links.forEach((link) => {
    const sku = data.skus.find((item) => item.id === link.accessorySkuId)
    const family = sku && data.families.find((item) => item.id === sku.familyId)
    const typeId = family?.productTypeId || ''
    const name = data.productTypes.find((item) => item.id === typeId)?.name || '未分类'
    const found = typeCounts.get(typeId) || { productTypeId: typeId, name, count: 0 }
    found.count += 1
    typeCounts.set(typeId, found)
  })
  return {
    key: `${host.productModelId}\u001f${host.identityKey}`,
    host,
    label: hostLabel(host),
    brand: valueOf(host, '品牌'),
    series: valueOf(host, '系列'),
    modelName: valueOf(host, '型号'),
    productTypeId: host.productTypeId,
    productTypeName: type?.name || '',
    categoryName: type ? categoryPath(data, type.categoryId) : '',
    specRange: specRange(records),
    planningIds: records.map((item) => item.planningId),
    accessoryCount: links.length,
    typeCounts: [...typeCounts.values()],
    sample: Boolean(canvas?.name?.includes('测试样例')),
  }
}

function specRange(records: PlanningRecord[]) {
  const bag = new Map<string, Set<string>>()
  records.forEach((record) => record.steps.forEach((step) => {
    if (step.attributeName === '品牌' || step.attributeName === '系列' || step.attributeName === '型号') return
    const values = bag.get(step.attributeName) || new Set<string>()
    values.add(step.valueId)
    bag.set(step.attributeName, values)
  }))
  const text = [...bag.entries()].map(([name, values]) => `${name} ${[...values].join('、')}`).join(' · ')
  return text || '这一型号下面还没有容量、颜色等规格'
}

function validatePair(data: AppData, skuId: string, host: CompatibilityHost) {
  const sku = data.skus.find((item) => item.id === skuId)
  if (!sku) return '找不到这条配件物料。'
  const family = data.families.find((item) => item.id === sku.familyId)
  if (!family) return '这条物料没有所属商品。'
  if (!family.productTypeId || roleOfType(data, family.productTypeId) !== 'accessory') return '这条物料不是配件，不能把它关联到主机。'
  const known = listHostModels(data).find((item) => item.host.productModelId === host.productModelId && item.host.identityKey === host.identityKey)
  if (!known) return '找不到这款已建档的主机型号，没有自动新建。'
  if (host.scope === 'planning') {
    if (!host.planningId || !known.planningIds.includes(host.planningId)) return '指定的规格不属于这款主机型号。'
  }
  if (roleOfType(data, host.productTypeId) !== 'host') return '所选目标不是主机型号。'
  return ''
}

function sameHost(left: CompatibilityHost, right: CompatibilityHost) {
  return left.scope === right.scope && left.productModelId === right.productModelId && left.identityKey === right.identityKey && (left.planningId || '') === (right.planningId || '')
}

function cloneHost(host: CompatibilityHost): CompatibilityHost {
  return { ...host, steps: host.steps.map((step) => ({ ...step })), planningId: host.planningId }
}

export function hostFrom(productTypeId: string, productModelId: string, steps: { attributeId: string; attributeName: string; valueId: string }[], planningId = ''): CompatibilityHost {
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

function identityAttributeIds(data: AppData) {
  return new Set(data.params.filter((item) => item.identityRole === 'host-model').map((item) => item.id))
}

function modelChain(data: AppData, record: PlanningRecord) {
  const ids = identityAttributeIds(data)
  const modelStep = ids.size
    ? record.steps.find((step) => ids.has(step.attributeId))
    : record.steps.find((step) => step.attributeName === '型号')
  if (!modelStep) return null
  const byValue = new Map(record.steps.map((step) => [step.valueNodeId, step]))
  const chain: PlanningStep[] = []
  let cursor: PlanningStep | undefined = modelStep
  const guard = new Set<string>()
  while (cursor && !guard.has(cursor.valueNodeId)) {
    guard.add(cursor.valueNodeId)
    chain.push(cursor)
    cursor = cursor.parentValueNodeId ? byValue.get(cursor.parentValueNodeId) : undefined
  }
  return chain.reverse()
}

function activeRecords(data: AppData) {
  return (data.planningRecords || []).filter((item) => item.origin !== 'temporary' && item.status === 'active' && item.steps.length)
}

function productTypeOfModel(data: AppData, productModelId: string) {
  return data.specCanvases.find((item) => item.templateId === productModelId)?.productTypeId || ''
}

function categoryNames(data: AppData, categoryId: string) {
  const names: string[] = []
  let cursor = data.categories.find((item) => item.id === categoryId)
  const guard = new Set<string>()
  while (cursor && !guard.has(cursor.id)) {
    guard.add(cursor.id)
    names.push(cursor.name)
    cursor = cursor.parentId ? data.categories.find((item) => item.id === cursor!.parentId) : undefined
  }
  return names
}

function valueOf(host: CompatibilityHost, name: string) {
  return host.steps.find((step) => step.attributeName === name)?.valueId || ''
}

export function unconfiguredHostPlans(data: AppData) {
  return activeRecords(data).flatMap((record) => {
    const productTypeId = productTypeOfModel(data, record.productModelId)
    if (!productTypeId || roleOfType(data, productTypeId) !== 'host') return []
    if (modelChain(data, record)) return []
    return [{ planningId: record.planningId, reason: '这条规划没有主机型号属性，不能把系列当成具体型号。' }]
  })
}

/** 适用型号只做精确匹配。斜杠、顿号和范围先待确认，不做模糊包含。 */
export function previewHostText(data: AppData, raw: string) {
  const text = raw.trim()
  if (!text) return { status: 'none' as const, hosts: [] as ReturnType<typeof listHostModels>, reason: '' }
  if (/[/／,，、~～]|\d+\s*-\s*\d+/.test(text)) {
    return { status: 'ambiguous' as const, hosts: [], reason: `适用型号「${text}」有多种读法，没有自动关联。` }
  }
  const hosts = listHostModels(data).filter((item) => item.modelName === text)
  if (hosts.length !== 1) return { status: 'unresolved' as const, hosts: [], reason: `适用型号「${text}」对不上已建档的主机型号。` }
  return { status: 'exact' as const, hosts, reason: '' }
}

export function accessoryTypes(data: AppData) {
  return data.productTypes.filter((item) => roleOfType(data, item.id) === 'accessory' && item.status === 'enabled')
}

export function skuSpec(sku: Sku) {
  return Object.entries(sku.variantAttrs).map(([name, value]) => `${name} ${value}`).join(' · ')
}
