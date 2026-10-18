import { latestPublishedVersion, projectAttrs } from './logic'
import { suggestMaterialName, suggestTemporaryName } from './naming'
import { legalPlanningCombinations } from './planning'
import type { AppData, ManualAttr, MaterialCreateReceipt, PlanningRecord, PlanningStep, ProductFamily, ProductGrade, ProductSpecNode, Sku, SpecModelVersion } from './types'

/**
 * V3 物料建档。规格只来自已发布快照上的规划档，不调用 generateSkuFromModel。
 * localStorage 没有跨标签页锁，两个页面同时保存仍可能撞号。正式环境要用数据库唯一约束和事务。
 */
export interface ResolvedMaterialSpec {
  label: string
  planningId: string
  productModelId: string
  modelVersionId: string
  versionName: string
  sourceNodeIds: string[]
  commonAttrs: Record<string, string>
  variantAttrs: Record<string, string>
  commonSignature: string
  productName: string
}

export interface MaterialChoice {
  id: string
  name: string
}

export type MaterialCreateResult =
  | { ok: true; created: boolean; familyId: string; skuId: string; materialCode: string; planningId: string; label: string; name: string; namingStatus: 'rule' | 'default' | 'conflict'; namingMessage: string }
  | { ok: false; message: string; choices?: MaterialChoice[]; reason?: 'material-deleted' }

export const MATERIAL_DELETED_MESSAGE = '该请求对应的物料已经删除。如需重新建档，请发起新的创建请求。'

function deletedReceiptResult(): MaterialCreateResult {
  return { ok: false, reason: 'material-deleted', message: MATERIAL_DELETED_MESSAGE }
}

/** 删除物料后保留原回执，只标记已删除。不改 requestId，不回收物料编码。 */
export function tombstoneMaterialReceipts(data: AppData, skuId: string, now = new Date().toISOString()) {
  if (!Array.isArray(data.materialReceipts)) return
  data.materialReceipts.forEach((item) => {
    if (item.skuId !== skuId || item.lifecycle === 'deleted') return
    item.lifecycle = 'deleted'
    item.deletedTime = now
  })
}

export interface PublishedModelOption {
  productModelId: string
  productTypeId: string
  productTypeName: string
  modelName: string
  categoryId: string
  versionId: string
  versionName: string
}

function parentValueNodeId(nodes: ProductSpecNode[], valueNodeId: string) {
  const byId = new Map(nodes.map((item) => [item.id, item]))
  let cursor = byId.get(valueNodeId)
  const guard = new Set<string>()
  while (cursor && !guard.has(cursor.id)) {
    guard.add(cursor.id)
    const parent = cursor.parentId ? byId.get(cursor.parentId) : undefined
    if (!parent) return null
    if (parent.nodeType === 'VALUE') return parent.id
    cursor = parent
  }
  return null
}

function commonSignature(steps: PlanningStep[]) {
  return steps
    .filter((step) => step.role === 'common')
    .map((step) => `${step.attributeId}=${step.valueId}`)
    .sort()
    .join('\u001e')
}

function productNameOf(steps: PlanningStep[], fallback: string) {
  const values = steps.filter((step) => step.role === 'common').map((step) => step.valueId).filter(Boolean)
  return values.join(' ') || fallback || '未命名商品'
}

export function publishedModelsForCategory(data: AppData, categoryId: string): PublishedModelOption[] {
  const types = data.productTypes.filter((item) => item.categoryId === categoryId && item.status === 'enabled')
  return types.flatMap((type) =>
    data.specCanvases.filter((item) => item.productTypeId === type.id).flatMap((canvas) => {
      const version = latestPublishedVersion(data, canvas.templateId)
      if (!version) return []
      const modelName = canvas.name || data.templates.find((item) => item.id === canvas.templateId)?.name || '商品模型'
      return [{
        productModelId: canvas.templateId,
        productTypeId: type.id,
        productTypeName: type.name,
        modelName,
        categoryId,
        versionId: version.id,
        versionName: version.versionName,
      }]
    }),
  )
}

export interface MaterialOffering {
  label: string
  planningId: string
  identityKey: string
  modelVersionId: string
  versionName: string
  materialCount: number
  retired: boolean
  grade?: 'core' | 'general'
}

/** 当前已发布版本上的合法规格。没有规划编号的组合不能建档。 */
export function materialOfferings(data: AppData, productModelId: string): { version?: SpecModelVersion; rows: MaterialOffering[] } {
  const version = latestPublishedVersion(data, productModelId)
  if (!version) return { rows: [] }
  const combos = legalPlanningCombinations(data, productModelId, version.nodesSnapshot)
  const records = (data.planningRecords || []).filter((item) => item.productModelId === productModelId)
  const rows = combos.map((combo) => {
    const matched = records.find((item) => item.identityKey === combo.identityKey && item.modelVersionIds.includes(version.id))
    return {
      label: combo.label,
      planningId: matched?.planningId || '',
      identityKey: combo.identityKey,
      modelVersionId: version.id,
      versionName: version.versionName,
      materialCount: matched && matched.origin !== 'temporary' ? materialsOfPlanning(data, matched.planningId).length : 0,
      retired: matched?.status === 'retired',
      grade: matched?.origin === 'temporary' ? undefined : matched?.grade,
    }
  })
  return { version, rows }
}

export function materialsOfPlanning(data: AppData, planningId: string) {
  if (!planningId) return []
  return data.skus.filter((item) => item.planningId === planningId)
}

/** 商品列表上的物料摘要。只统计这一款商品下的物料，规划编号去重，不读取模型的合法组合。 */
export function familyMaterialDigest(skus: { materialCode?: string; planningId?: string }[]) {
  const rows = Array.isArray(skus) ? skus : []
  const plans = new Set(rows.map((item) => (item.planningId || '').trim()).filter(Boolean))
  const parts = [`已建物料 ${rows.length} 条`]
  if (rows.length === 1) {
    const code = (rows[0]?.materialCode || '').trim()
    if (code) parts.push(code)
  }
  parts.push(`已关联规划 ${plans.size} 条`)
  return parts.join(' · ')
}

export function resolveV3MaterialSpec(data: AppData, input: { productModelId: string; modelVersionId: string; planningId: string }): { ok: true; spec: ResolvedMaterialSpec } | { ok: false; message: string } {
  const record = (data.planningRecords || []).find((item) => item.planningId === input.planningId)
  if (!record) return { ok: false, message: '找不到这个规格编号。' }
  if (record.origin === 'temporary') return { ok: false, message: '这是临时物料，不能按正式规格创建。' }
  if (record.productModelId !== input.productModelId) return { ok: false, message: '这个规格不属于当前商品模型。' }
  if (record.status !== 'active') return { ok: false, message: '这条规格已经停用，不能再建档。' }
  const version = data.specModelVersions.find((item) => item.id === input.modelVersionId)
  if (!version || version.templateId !== input.productModelId) return { ok: false, message: '找不到对应的模型版本。' }
  if (version.status !== 'published') return { ok: false, message: '模型还没发布，不能按这个版本建档。' }
  if (!record.modelVersionIds.includes(version.id)) return { ok: false, message: '这个版本里没有这条规格。' }
  const verified = verifySteps(data, version.nodesSnapshot, record)
  if (!verified.ok) return verified
  const alive = legalPlanningCombinations(data, input.productModelId, version.nodesSnapshot).some((item) => item.identityKey === record.identityKey)
  if (!alive) return { ok: false, message: '这个版本里已经没有这条规格。' }
  const canvas = data.specCanvases.find((item) => item.templateId === input.productModelId)
  const fallback = canvas?.name || data.templates.find((item) => item.id === input.productModelId)?.name || '未命名商品'
  return {
    ok: true,
    spec: {
      label: verified.label,
      planningId: record.planningId,
      productModelId: input.productModelId,
      modelVersionId: version.id,
      versionName: version.versionName,
      sourceNodeIds: verified.sourceNodeIds,
      commonAttrs: verified.commonAttrs,
      variantAttrs: verified.variantAttrs,
      commonSignature: commonSignature(record.steps),
      productName: productNameOf(record.steps, fallback),
    },
  }
}

function verifySteps(data: AppData, nodes: ProductSpecNode[], record: PlanningRecord): { ok: true; label: string; sourceNodeIds: string[]; commonAttrs: Record<string, string>; variantAttrs: Record<string, string> } | { ok: false; message: string } {
  const commonAttrs: Record<string, string> = {}
  const variantAttrs: Record<string, string> = {}
  const labels: string[] = []
  const sourceNodeIds: string[] = []
  for (const step of record.steps) {
    const node = nodes.find((item) => item.id === step.valueNodeId && item.nodeType === 'VALUE')
    if (!node || node.valueId !== step.valueId || node.attributeId !== step.attributeId) {
      return { ok: false, message: '规格来源和发布版本不一致。' }
    }
    if (parentValueNodeId(nodes, node.id) !== step.parentValueNodeId) return { ok: false, message: '规格的条件路径已经变了。' }
    const name = data.params.find((item) => item.id === step.attributeId)?.name || step.attributeName || '规格'
    if (step.role === 'common') commonAttrs[name] = node.valueId
    else variantAttrs[name] = node.valueId
    labels.push(`${name} ${node.valueId}`)
    sourceNodeIds.push(node.id)
  }
  if (!sourceNodeIds.length) return { ok: false, message: '这条规格没有可用的取值。' }
  return { ok: true, label: labels.join(' · '), sourceNodeIds, commonAttrs, variantAttrs }
}

export function nextMaterialCode(data: AppData) {
  let max = 0
  const take = (value?: string) => {
    const matched = /^MAT-(\d+)$/.exec(value || '')
    if (matched) max = Math.max(max, Number(matched[1]))
  }
  data.skus.forEach((item) => take(item.materialCode))
  ;(data.materialReceipts || []).forEach((item) => take(item.materialCode))
  return `MAT-${String(max + 1).padStart(6, '0')}`
}

export function familyChoicesFor(data: AppData, input: { productModelId: string; productTypeId: string; categoryId: string; commonSignature: string }): ProductFamily[] {
  return data.families.filter((item) => item.line === 'v3' && item.productModelId === input.productModelId && item.productTypeId === input.productTypeId && item.categoryId === input.categoryId && (item.commonSignature || '') === input.commonSignature)
}

export function createV3Material(data: AppData, input: {
  productModelId: string
  modelVersionId: string
  planningId: string
  requestId: string
  categoryId: string
  productTypeId: string
  familyId?: string
  skuName?: string
  supplierCode?: string
  guanjiapoCode?: string
  oaSkuId?: string
  materialDescription?: string
  now?: string
  nextId: (prefix: string) => string
}): MaterialCreateResult {
  const requestId = input.requestId.trim()
  if (!requestId) return { ok: false, message: '创建请求无效。' }
  if (!Array.isArray(data.materialReceipts)) data.materialReceipts = []
  const receipt = data.materialReceipts.find((item) => item.requestId === requestId)
  if (receipt) {
    const sku = data.skus.find((item) => item.id === receipt.skuId)
    if (!sku) return deletedReceiptResult()
    return { ok: true, created: false, familyId: sku.familyId, skuId: sku.id, materialCode: sku.materialCode || receipt.materialCode, planningId: sku.planningId || receipt.planningId, label: sku.skuName || '', name: sku.skuName || '', namingStatus: sku.nameSource === 'manual' ? 'default' : 'rule', namingMessage: '' }
  }
  const resolved = resolveV3MaterialSpec(data, input)
  if (!resolved.ok) return resolved
  const canvas = data.specCanvases.find((item) => item.templateId === input.productModelId)
  if (!canvas?.productTypeId || canvas.productTypeId !== input.productTypeId) return { ok: false, message: '产品类型和商品模型不一致。' }
  const productType = data.productTypes.find((item) => item.id === input.productTypeId)
  if (!productType || productType.categoryId !== input.categoryId) return { ok: false, message: '商品分类和产品类型不一致。' }
  const spec = resolved.spec
  const productTypeName = productType?.name || ''
  const suggestion = suggestMaterialName(data, {
    productModelId: input.productModelId,
    modelVersionId: spec.modelVersionId,
    productTypeName,
    steps: (data.planningRecords.find((item) => item.planningId === spec.planningId)?.steps || []).map((step) => ({ valueNodeId: step.valueNodeId, attributeId: step.attributeId, valueId: step.valueId })),
  })
  const requested = (input.skuName || '').trim()
  const chosenName = requested || suggestion.name
  const choices = familyChoicesFor(data, { productModelId: input.productModelId, productTypeId: input.productTypeId, categoryId: input.categoryId, commonSignature: spec.commonSignature })
  let family = choices.find((item) => item.id === input.familyId)
  if (!family && choices.length > 1) {
    return { ok: false, message: '有多款商品都能放下这条规格，请选一款。', choices: choices.map((item) => ({ id: item.id, name: item.name })) }
  }
  if (!family && choices.length === 1) family = choices[0]
  const now = input.now || new Date().toISOString()
  if (!family) {
    family = {
      id: input.nextId('fam'),
      name: spec.productName,
      templateId: input.productModelId,
      modelVersionId: spec.modelVersionId,
      productModelId: input.productModelId,
      productTypeId: input.productTypeId,
      line: 'v3',
      commonSignature: spec.commonSignature,
      categoryId: input.categoryId,
      oaProductId: '',
      commonAttrs: { ...spec.commonAttrs },
      productGroupIds: [],
      lifecycle: 'draft',
      shelfStatus: 'draft',
      createdAt: now,
      origin: 'created',
      updatedAt: now,
    }
    data.families.unshift(family)
  } else {
    family.updatedAt = now
  }
  const materialCode = nextMaterialCode(data)
  const occupied = materialCodeConflict(data, materialCode)
  if (occupied) return { ok: false, message: occupied }
  const sku: Sku = {
    id: input.nextId('sku'),
    familyId: family.id,
    code: '',
    oaSkuId: '',
    status: 'draft',
    variantAttrs: { ...spec.variantAttrs },
    projectedAttrs: {},
    skuName: chosenName,
    sourceNodeIds: [...spec.sourceNodeIds],
    planningId: spec.planningId,
    modelVersionId: spec.modelVersionId,
  }
  sku.projectedAttrs = projectAttrs(family, sku)
  sku.materialCode = materialCode
  sku.supplierCode = (input.supplierCode || '').trim()
  sku.guanjiapoCode = (input.guanjiapoCode || '').trim()
  sku.oaSkuId = (input.oaSkuId || '').trim() || sku.oaSkuId
  sku.materialDescription = (input.materialDescription || '').trim()
  sku.nameSource = requested && requested !== suggestion.name ? 'manual' : 'auto'
  sku.createdAt = now
  sku.updatedAt = now
  data.skus.push(sku)
  const saved: MaterialCreateReceipt = { requestId, skuId: sku.id, planningId: spec.planningId, materialCode, createdTime: now, lifecycle: 'active' }
  data.materialReceipts.push(saved)
  return { ok: true, created: true, familyId: family.id, skuId: sku.id, materialCode, planningId: spec.planningId, label: spec.label, name: chosenName, namingStatus: suggestion.status, namingMessage: suggestion.message }
}

/** 系统物料编码在全部物料里唯一。供应商、管家婆和 OA 编号不走这里。 */
export function materialCodeConflict(data: AppData, code: string, exceptSkuId = '') {
  const hit = data.skus.find((item) => item.materialCode === code && item.id !== exceptSkuId)
  return hit ? `物料编码 ${code} 已被其他物料使用。` : ''
}

const PRODUCT_NAME_LIMIT = 80

/** 只改 V3 商品款名称。归并仍看模型、产品类型、分类和公共规格签名，不看这个名称。 */
export function renameV3Product(data: AppData, input: { familyId: string; name: string; now?: string }): { ok: true } | { ok: false; message: string } {
  const family = data.families.find((item) => item.id === input.familyId)
  if (!family || family.line !== 'v3') return { ok: false, message: '找不到这款商品。' }
  const name = input.name.trim()
  if (!name) return { ok: false, message: '请填写商品名称。' }
  if (name.length > PRODUCT_NAME_LIMIT) return { ok: false, message: `商品名称不能超过 ${PRODUCT_NAME_LIMIT} 个字。` }
  if (name === family.name) return { ok: true }
  family.name = name
  family.updatedAt = input.now || new Date().toISOString()
  return { ok: true }
}

export function updateV3Material(data: AppData, input: {
  skuId: string
  skuName: string
  supplierCode: string
  guanjiapoCode: string
  oaSkuId: string
  materialDescription: string
  now?: string
}): { ok: true } | { ok: false; message: string } {
  const sku = data.skus.find((item) => item.id === input.skuId)
  const family = sku ? data.families.find((item) => item.id === sku.familyId) : undefined
  if (!sku || !family || family.line !== 'v3') return { ok: false, message: '找不到这条物料。' }
  const skuName = input.skuName.trim()
  if (!skuName) return { ok: false, message: '请填写物料名称。' }
  const previousName = sku.skuName || ''
  const code = sku.materialCode || ''
  if (code && materialCodeConflict(data, code, sku.id)) return { ok: false, message: materialCodeConflict(data, code, sku.id) }
  if (skuName !== previousName) sku.nameSource = 'manual'
  sku.skuName = skuName
  sku.supplierCode = input.supplierCode.trim()
  sku.guanjiapoCode = input.guanjiapoCode.trim()
  sku.oaSkuId = input.oaSkuId.trim()
  sku.materialDescription = input.materialDescription.trim()
  sku.updatedAt = input.now || new Date().toISOString()
  family.updatedAt = sku.updatedAt
  return { ok: true }
}

export function gradeText(grade?: ProductGrade) {
  if (grade === 'core') return '核心商品'
  if (grade === 'general') return '一般产品'
  return '未标记'
}

export function filingText(grade: ProductGrade | undefined, count: number) {
  if (grade === 'core' && count === 0) return '待创建物料'
  if (grade === 'general' && count === 0) return '暂未创建物料'
  if (count > 0) return `已有 ${count} 条物料`
  return '未标记'
}

/** 只改正式规划的档次。不新建物料，不改编号，不改快照。 */
export function setPlanningGrades(records: PlanningRecord[], ids: string[], grade: ProductGrade) {
  const wanted = new Set(ids)
  let changed = 0
  const next = records.map((item) => {
    if (!wanted.has(item.planningId) || item.origin === 'temporary') return item
    if (item.grade === grade) return item
    changed += 1
    return { ...item, grade }
  })
  return { records: next, changed }
}

function nextTemporaryId(records: PlanningRecord[]) {
  let max = 0
  records.forEach((item) => {
    const matched = /^TMP-(\d+)$/.exec(item.planningId)
    if (matched) max = Math.max(max, Number(matched[1]))
  })
  return `TMP-${String(max + 1).padStart(6, '0')}`
}

function manualKey(attrs: ManualAttr[]) {
  return attrs.map((item) => [item.attributeId, item.value, item.source].join('\u001f')).sort()
}

/** 旧临时编号只认模型和手工值。新编号再带上分类和产品类型，避免不同业务共用一个 TMP。 */
function temporaryIdentity(modelId: string, attrs: ManualAttr[]) {
  return ['temporary', modelId, ...manualKey(attrs)].join('\u001e')
}

function temporaryContextIdentity(categoryId: string, productTypeId: string, modelId: string, attrs: ManualAttr[]) {
  return ['temporary', 'ctx', categoryId, productTypeId, modelId, ...manualKey(attrs)].join('\u001e')
}

function temporaryRecordMatchesContext(data: AppData, record: PlanningRecord, categoryId: string, productTypeId: string) {
  const users = data.skus.filter((item) => item.planningId === record.planningId)
  if (!users.length) return false
  return users.every((sku) => {
    const family = data.families.find((item) => item.id === sku.familyId)
    return family?.categoryId === categoryId && family?.productTypeId === productTypeId
  })
}

/** 临时建档用的属性。优先已发布或草稿模型，没有模型时才读分类上的属性方案。不写词典，也不伪造发布版本。 */
export function temporaryAttributeFields(data: AppData, input: { categoryId: string; productTypeId: string; productModelId?: string }) {
  const preferred = input.productModelId || data.specCanvases.find((item) => item.productTypeId === input.productTypeId)?.templateId || ''
  if (preferred) {
    const fields = modelAttributeFields(data, preferred)
    if (fields.length) return fields
  }
  const mapped = data.mappings.find((item) => item.categoryId === input.categoryId)?.templateId || ''
  const seen = new Set<string>()
  const rows: { attributeId: string; name: string; values: string[] }[] = []
  data.templateParams.filter((item) => item.templateId === mapped).forEach((item) => {
    if (!item.paramId || seen.has(item.paramId)) return
    seen.add(item.paramId)
    const param = data.params.find((param) => param.id === item.paramId)
    if (!param) return
    rows.push({ attributeId: param.id, name: param.name, values: [...param.values] })
  })
  return rows
}

export function modelAttributeFields(data: AppData, productModelId: string) {
  const version = productModelId ? latestPublishedVersion(data, productModelId) : undefined
  const nodes = version?.nodesSnapshot || data.productSpecNodes.filter((item) => item.templateId === productModelId)
  const seen = new Set<string>()
  const rows: { attributeId: string; name: string; values: string[] }[] = []
  nodes.filter((item) => item.nodeType === 'ATTRIBUTE').forEach((item) => {
    if (!item.attributeId || seen.has(item.attributeId)) return
    seen.add(item.attributeId)
    const param = data.params.find((param) => param.id === item.attributeId)
    rows.push({ attributeId: item.attributeId, name: param?.name || '未命名属性', values: [...(param?.values || [])] })
  })
  return rows
}

export function createTemporaryMaterial(data: AppData, input: {
  requestId: string
  categoryId: string
  productTypeId: string
  productModelId?: string
  modelVersionId?: string
  attrs: { attributeId: string; value: string; source: 'dictionary' | 'manual' }[]
  materialCode: string
  skuName?: string
  supplierCode?: string
  guanjiapoCode?: string
  oaSkuId?: string
  materialDescription?: string
  now?: string
  nextId: (prefix: string) => string
}): MaterialCreateResult {
  const requestId = input.requestId.trim()
  if (!requestId) return { ok: false, message: '创建请求无效。' }
  if (!Array.isArray(data.materialReceipts)) data.materialReceipts = []
  if (!Array.isArray(data.planningRecords)) data.planningRecords = []
  const receipt = data.materialReceipts.find((item) => item.requestId === requestId)
  if (receipt) {
    const sku = data.skus.find((item) => item.id === receipt.skuId)
    if (!sku) return deletedReceiptResult()
    return { ok: true, created: false, familyId: sku.familyId, skuId: sku.id, materialCode: sku.materialCode || receipt.materialCode, planningId: sku.planningId || receipt.planningId, label: sku.skuName || '', name: sku.skuName || '', namingStatus: 'default', namingMessage: '' }
  }
  const materialCode = input.materialCode.trim()
  if (!materialCode) return { ok: false, message: '请填写物料编码。' }
  const occupied = materialCodeConflict(data, materialCode)
  if (occupied) return { ok: false, message: occupied }
  const productType = data.productTypes.find((item) => item.id === input.productTypeId)
  if (!productType || productType.categoryId !== input.categoryId) return { ok: false, message: '商品分类和产品类型不一致。' }
  const modelId = input.productModelId || ''
  let modelVersionId = ''
  if (input.modelVersionId) {
    const version = data.specModelVersions.find((item) => item.id === input.modelVersionId)
    if (!version || version.templateId !== modelId || version.status !== 'published') return { ok: false, message: '找不到对应的已发布模型版本。' }
    modelVersionId = version.id
  }
  const manualAttrs: ManualAttr[] = []
  for (const item of input.attrs) {
    const value = item.value.trim()
    if (!value) continue
    const param = data.params.find((param) => param.id === item.attributeId)
    if (!param) return { ok: false, message: '有属性不在属性词典里。' }
    if (item.source === 'dictionary' && !param.values.includes(value)) return { ok: false, message: `${param.name} 不在正式取值里。临时填写请改成手工输入。` }
    manualAttrs.push({ attributeId: param.id, attributeName: param.name, value, source: item.source === 'dictionary' ? 'dictionary' : 'manual' })
  }
  if (!manualAttrs.length) return { ok: false, message: '请至少填写一项属性。' }
  const dictSize = data.params.reduce((sum, item) => sum + item.values.length, 0)
  const nodeSize = data.productSpecNodes.length
  const versionText = JSON.stringify(data.specModelVersions)
  const identityKey = temporaryContextIdentity(input.categoryId, input.productTypeId, modelId, manualAttrs)
  let record = data.planningRecords.find((item) => item.origin === 'temporary' && item.identityKey === identityKey)
  if (!record) {
    const legacyKey = temporaryIdentity(modelId, manualAttrs)
    const legacy = data.planningRecords.find((item) => item.origin === 'temporary' && item.identityKey === legacyKey)
    if (legacy && temporaryRecordMatchesContext(data, legacy, input.categoryId, input.productTypeId)) record = legacy
  }
  const now = input.now || new Date().toISOString()
  if (!record) {
    record = {
      planningId: nextTemporaryId(data.planningRecords),
      productModelId: modelId,
      originModelVersionId: modelVersionId,
      modelVersionId,
      modelVersionIds: modelVersionId ? [modelVersionId] : [],
      steps: [],
      identityKey,
      status: 'active',
      createdTime: now,
      origin: 'temporary',
    }
    data.planningRecords.push(record)
  }
  const rules = modelVersionId
    ? (data.specModelVersions.find((item) => item.id === modelVersionId)?.nodesSnapshot || []).map((item) => item.namingRule || []).filter((item) => item.length)
    : []
  const suggestion = suggestTemporaryName({ productTypeName: productType.name, attrs: manualAttrs, rules })
  const requested = (input.skuName || '').trim()
  const chosenName = requested || suggestion.name
  const signature = temporaryIdentity(modelId, manualAttrs)
  const commonAttrs: Record<string, string> = {}
  const variantAttrs: Record<string, string> = {}
  manualAttrs.forEach((item) => { variantAttrs[item.attributeName] = item.value })
  let family = data.families.find((item) => item.line === 'v3' && item.productTypeId === input.productTypeId && item.categoryId === input.categoryId && item.commonSignature === signature)
  if (!family) {
    family = {
      id: input.nextId('fam'),
      name: chosenName || productType.name,
      templateId: modelId,
      modelVersionId: modelVersionId || undefined,
      productModelId: modelId || undefined,
      productTypeId: input.productTypeId,
      line: 'v3',
      commonSignature: signature,
      categoryId: input.categoryId,
      oaProductId: '',
      commonAttrs,
      productGroupIds: [],
      lifecycle: 'draft',
      shelfStatus: 'draft',
      createdAt: now,
      origin: 'created',
      updatedAt: now,
    }
    data.families.unshift(family)
  } else family.updatedAt = now
  const sku: Sku = {
    id: input.nextId('sku'),
    familyId: family.id,
    code: '',
    oaSkuId: (input.oaSkuId || '').trim(),
    status: 'draft',
    variantAttrs,
    projectedAttrs: {},
    skuName: chosenName,
    sourceNodeIds: [],
    planningId: record.planningId,
    modelVersionId: modelVersionId || undefined,
    materialCode,
    supplierCode: (input.supplierCode || '').trim(),
    guanjiapoCode: (input.guanjiapoCode || '').trim(),
    materialDescription: (input.materialDescription || '').trim(),
    nameSource: requested && requested !== suggestion.name ? 'manual' : 'auto',
    createdAt: now,
    updatedAt: now,
    manualAttrs: manualAttrs.map((item) => ({ ...item })),
  }
  sku.projectedAttrs = projectAttrs(family, sku)
  data.skus.push(sku)
  data.materialReceipts.push({ requestId, skuId: sku.id, planningId: record.planningId, materialCode, createdTime: now, lifecycle: 'active' })
  if (data.params.reduce((sum, item) => sum + item.values.length, 0) !== dictSize) return { ok: false, message: '临时值不应写入属性词典。' }
  if (data.productSpecNodes.length !== nodeSize || JSON.stringify(data.specModelVersions) !== versionText) return { ok: false, message: '临时建档不应改动正式模型。' }
  return { ok: true, created: true, familyId: family.id, skuId: sku.id, materialCode, planningId: record.planningId, label: manualAttrs.map((item) => `${item.attributeName} ${item.value}`).join(' · '), name: chosenName, namingStatus: suggestion.status, namingMessage: suggestion.message }
}
