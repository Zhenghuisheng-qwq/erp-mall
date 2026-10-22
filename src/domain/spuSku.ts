import { boundParams, generateSkuFromModel, inspectFamily, modelSpecColumns, planSkuLines, projectAttrs } from './logic'
import { legalPlanningCombinations } from './planning'
import { compatibilityFamilyBlock } from './compatibility'
import { isMaterialArchive, isRealSku } from './catalogIdentity'
import type { AppData, ProductFamily, Sku } from './types'

type Result<T = object> = ({ ok: true } & T) | { ok: false; message: string }
export type SkuDraft = Pick<Sku, 'code' | 'skuName' | 'oaSkuId' | 'status' | 'variantAttrs'> & { sourceNodeIds?: string[] }
export interface SkuGeneration {
  kind: 'manual' | 'template' | 'model' | 'plan'
  rows?: SkuDraft[]
  selections?: Record<string, string[]>
  planId?: string
}
export interface SkuCandidate {
  key: string
  draft: SkuDraft
  state: 'new' | 'existing' | 'invalid'
  reason: string
  existingId?: string
}
const attrsKey = (attrs: Record<string, string>) => JSON.stringify(Object.entries(attrs).filter(([, value]) => value).sort(([a], [b]) => a.localeCompare(b)))
const projected = (family: ProductFamily, draft: SkuDraft) => projectAttrs(family, { ...draft, id: '', familyId: family.id, projectedAttrs: {} })
const blankDraft = (attrs: Record<string, string>, name = ''): SkuDraft => ({ code: '', oaSkuId: '', skuName: name, status: 'draft', variantAttrs: { ...attrs } })

export function spuIdentityLocked(data: AppData, family: ProductFamily) {
  return data.skus.some(item => item.familyId === family.id) || Boolean(family.productPlanId || family.commonSignature || compatibilityFamilyBlock(data, family.id))
}

export function saveSpu(data: AppData, family: ProductFamily, now: string): Result<{ id: string }> {
  const old = data.families.find(item => item.id === family.id)
  if (!family.name.trim()) return { ok: false, message: '请填写 SPU 名称。' }
  const category = data.categories.find(item => item.id === family.categoryId)
  if (!category) return { ok: false, message: '请选择有效的商品分类。' }
  if (family.productTypeId && !data.productTypes.some(item => item.id === family.productTypeId && item.categoryId === family.categoryId)) return { ok: false, message: '产品类型与 SPU 分类不一致。' }
  if (family.templateId && !data.templates.some(item => item.id === family.templateId)) return { ok: false, message: '属性方案已不存在，请重新选择。' }
  if (family.modelVersionId && !data.specModelVersions.some(item => item.id === family.modelVersionId && item.templateId === family.templateId && item.status === 'published')) return { ok: false, message: '请选择该模型的有效发布版本。' }
  if (family.productModelId && family.productModelId !== family.templateId) return { ok: false, message: '商品模型与属性方案不一致。' }
  const owner = data.specCanvases.find(item => item.templateId === family.templateId)?.productTypeId
  if (owner && (!old || old.templateId !== family.templateId || old.productTypeId !== family.productTypeId) && family.productTypeId !== owner) return { ok: false, message: '所选模型不属于这个产品类型。' }
  const identity = (item: ProductFamily) => JSON.stringify([item.categoryId, item.productTypeId || '', item.templateId, item.productModelId || '', item.modelVersionId || '', attrsKey(item.commonAttrs)])
  if (old && spuIdentityLocked(data, old) && identity(old) !== identity(family)) return { ok: false, message: '已有 SKU、物料或历史关联，不能直接修改分类、类型、模型版本和公共属性。请新建 SPU；现有记录不会被重生成。' }
  // Only public fields are editable. Historical source, line and identity signature stay intact.
  const next: ProductFamily = { ...(old || family), name: family.name.trim(), oaProductId: family.oaProductId.trim(), categoryId: family.categoryId, productTypeId: family.productTypeId,
    templateId: family.templateId, productModelId: family.productModelId, modelVersionId: family.modelVersionId, commonAttrs: { ...family.commonAttrs }, productGroupIds: [...family.productGroupIds],
    shelfStatus: family.shelfStatus, lifecycle: family.lifecycle, updatedAt: now }
  if (old) data.families[data.families.indexOf(old)] = next
  else data.families.unshift(next)
  return { ok: true, id: next.id }
}

export function spuRemovalBlock(data: AppData, id: string) {
  const children = data.skus.filter(item => item.familyId === id)
  if (children.length) {
    const materials = children.filter(item => isMaterialArchive(data, item)).length
    return `不能删除：还有 ${children.length - materials} 条 SKU、${materials} 条物料。请先到 SKU 管理或物料管理处理；不会级联删除。`
  }
  return compatibilityFamilyBlock(data, id)
}

export function skuFields(data: AppData, family: ProductFamily) {
  if (family.modelVersionId) {
    const version = data.specModelVersions.find(item => item.id === family.modelVersionId && item.templateId === family.templateId)
    return version ? modelSpecColumns(data, family.templateId, version.nodesSnapshot, 'variant') : []
  }
  return boundParams(data, family.templateId, 'variant').map(item => ({ paramId: item.paramId, name: item.param.name, values: item.param.values, required: item.required, role: 'variant' as const }))
}

export function skuSpecKey(data: AppData, family: ProductFamily, attrs: Record<string, string>) {
  const fields = skuFields(data, family)
  const names = fields.length ? fields.map(item => item.name).sort() : Object.keys(attrs).sort()
  return JSON.stringify(names.map(name => [name, attrs[name] || '']))
}

export function skuConfigurationProblem(data: AppData, family: ProductFamily) {
  if (!data.categories.some(item => item.id === family.categoryId)) return 'SPU 的分类已不存在，请先补全 SPU 配置。'
  if (!family.templateId || !data.templates.some(item => item.id === family.templateId)) return 'SPU 尚未选择有效属性方案，请先补全 SPU 配置。'
  if (!family.modelVersionId && data.specCanvases.some(item => item.templateId === family.templateId)) return 'SPU 的模型尚未绑定发布版本，请先发布模型并补全 SPU 配置。'
  if (family.productTypeId && !data.productTypes.some(item => item.id === family.productTypeId && item.categoryId === family.categoryId)) return 'SPU 的产品类型与分类不一致，请先处理主体配置。'
  if (family.modelVersionId && !data.specModelVersions.some(item => item.id === family.modelVersionId && item.templateId === family.templateId && item.status === 'published')) return 'SPU 绑定的历史发布版本已不可用；不会自动切换到最新版本。'
  return ''
}

function modelRows(data: AppData, family: ProductFamily) {
  const version = data.specModelVersions.find(item => item.id === family.modelVersionId && item.templateId === family.templateId && item.status === 'published')
  if (!version) return []
  return legalPlanningCombinations(data, family.templateId, version.nodesSnapshot).flatMap(combo => {
    const common = Object.fromEntries(combo.steps.filter(step => step.role === 'common').map(step => [step.attributeName, step.valueId]))
    if (Object.entries(common).some(([name, value]) => family.commonAttrs[name] !== value)) return []
    const variant = Object.fromEntries(combo.steps.filter(step => step.role === 'variant').map(step => [step.attributeName, step.valueId]))
    // Reuse the existing V2 generator after the domain has selected a real conditional path.
    const generated = generateSkuFromModel({ commonAttrs: family.commonAttrs, variantSelections: Object.fromEntries(Object.entries(variant).map(([name, value]) => [name, [value]])), modelSnapshot: version.nodesSnapshot })
    return generated.skus.map(item => ({ ...blankDraft(item.variant, Object.values(item.variant).join(' / ')), sourceNodeIds: combo.steps.map(step => step.valueNodeId) }))
  })
}

export function planSpuCompatibility(data: AppData, family: ProductFamily, planId: string) {
  const plan = data.productPlans.find(item => item.id === planId)
  if (!plan) return '规划已不存在。'
  if (plan.modelVersionId && !data.specModelVersions.some(item => item.id === plan.modelVersionId && item.templateId === plan.productModelId)) return '规划绑定的历史版本已不存在。'
  const parts = planSkuLines(data, plan)
  if (!parts?.skus.length) return '规划尚无可生成的规格，请先配置并保存规划。'
  const type = data.productTypes.find(item => item.id === plan.productTypeId)
  if (type?.categoryId !== family.categoryId) return '分类不同。'
  const familyType = family.productTypeId || data.specCanvases.find(item => item.templateId === family.templateId)?.productTypeId
  if (familyType !== plan.productTypeId) return '产品类型不同。'
  if (family.templateId !== plan.productModelId) return '所属模型不同。'
  if (family.modelVersionId !== parts.modelVersionId) return '发布版本不同；不会自动升级已有 SPU。'
  if (Object.entries(parts.commonAttrs).some(([name, value]) => family.commonAttrs[name] !== value)) return '公共属性不同，不能仅按名称合并。'
  return ''
}

export function previewSkuAppend(data: AppData, familyId: string, input: SkuGeneration): { problem: string; rows: SkuCandidate[] } {
  const family = data.families.find(item => item.id === familyId)
  if (!family) return { problem: '请先选择一个有效 SPU。', rows: [] }
  const problem = skuConfigurationProblem(data, family) || (input.kind === 'plan' ? planSpuCompatibility(data, family, input.planId || '') : '')
  if (problem) return { problem, rows: [] }
  const modeled = family.modelVersionId ? modelRows(data, family) : undefined
  let drafts: SkuDraft[] = []
  if (input.kind === 'manual') drafts = input.rows || []
  else if (input.kind === 'model') drafts = modeled || []
  else if (input.kind === 'plan') {
    const plan = data.productPlans.find(item => item.id === input.planId)
    const parts = plan && planSkuLines(data, plan)
    drafts = parts?.skus.map(item => ({ ...blankDraft(item.variantAttrs, item.name), sourceNodeIds: [...item.sourceNodeIds] })) || []
  } else drafts = generateSkuFromModel({ commonAttrs: family.commonAttrs, variantSelections: input.selections || {}, modelSnapshot: [] }).skus.map(item => blankDraft(item.variant, Object.values(item.variant).filter(Boolean).join(' / ')))
  const existing = new Map(data.skus.filter(item => item.familyId === familyId && isRealSku(data, item)).map(item => [skuSpecKey(data, family, item.variantAttrs), item.id]))
  const seen = new Set<string>()
  const allowed = modeled ? new Set(modeled.map(item => skuSpecKey(data, family, item.variantAttrs))) : undefined
  const rows = drafts.map((draft, index): SkuCandidate => {
    const key = skuSpecKey(data, family, draft.variantAttrs)
    const duplicate = existing.get(key)
    const errors = validateSkuDraft(data, family, draft, allowed)
    const repeated = seen.has(key)
    seen.add(key)
    return { key: `${index}:${key}`, draft, state: errors ? 'invalid' : duplicate || repeated ? 'existing' : 'new', reason: errors || (duplicate ? '目标 SPU 已有相同规格。' : repeated ? '本次候选中的规格重复。' : ''), existingId: duplicate }
  })
  return { problem: drafts.length ? '' : '没有可生成的规格。请核对 SPU 公共属性、所选发布版本及规格范围。', rows }
}

function validateSkuDraft(data: AppData, family: ProductFamily, draft: SkuDraft, allowed?: Set<string>) {
  if (!['draft', 'on_sale', 'off_sale'].includes(draft.status)) return 'SKU 状态无效。'
  if (Object.keys(draft.variantAttrs).some(name => family.commonAttrs[name] && family.commonAttrs[name] !== draft.variantAttrs[name])) return '规格属性不能覆盖 SPU 的公共属性。'
  const known = new Set(skuFields(data, family).map(field => field.name))
  if (Object.entries(draft.variantAttrs).some(([name, value]) => value && !known.has(name))) return '包含该 SPU 方案中不存在的规格属性，请重新选择规格。'
  if (allowed && !allowed.has(skuSpecKey(data, family, draft.variantAttrs))) return '不是该 SPU 绑定版本及公共属性下的合法规格。'
  const row: Sku = { ...draft, id: 'preview', familyId: family.id, projectedAttrs: {} }
  const issues = inspectFamily(data, family, [row], family.modelVersionId ? Object.keys(draft.variantAttrs) : undefined)
  return issues.find(issue => issue.level === 'error')?.message || ''
}

export function appendSkuBatch(data: AppData, input: { familyId: string; generation: SkuGeneration; selectedKeys: string[]; now: string; nextId: () => string }): Result<{ ids: string[]; skipped: number }> {
  const family = data.families.find(item => item.id === input.familyId)
  if (!family) return { ok: false, message: 'SPU 已不存在，请重新选择。' }
  const preview = previewSkuAppend(data, family.id, input.generation)
  if (preview.problem) return { ok: false, message: preview.problem }
  const selected = new Set(input.selectedKeys)
  if (preview.rows.some(row => selected.has(row.key) && row.state === 'invalid') || [...selected].some(key => !preview.rows.some(row => row.key === key))) return { ok: false, message: '候选已变化或包含无效规格，请重新预览。未写入任何 SKU。' }
  const rows = preview.rows.filter(row => selected.has(row.key) && row.state === 'new')
  if (!rows.length) return { ok: true, ids: [], skipped: selected.size }
  const plan = data.productPlans.find(item => item.id === input.generation.planId)
  const next = rows.map(({ draft }): Sku => ({ ...draft, variantAttrs: { ...draft.variantAttrs }, sourceNodeIds: draft.sourceNodeIds ? [...draft.sourceNodeIds] : undefined,
    id: input.nextId(), familyId: family.id, recordKind: 'sku', modelVersionId: family.modelVersionId,
    projectedAttrs: projected(family, draft), createdAt: input.now, updatedAt: input.now,
    creationSource: { kind: input.generation.kind, templateId: family.templateId, modelVersionId: family.modelVersionId || '', productPlanId: plan?.id, planName: plan?.name, createdAt: input.now } }))
  if (new Set(next.map(item => item.id)).size !== next.length || next.some(item => data.skus.some(old => old.id === item.id))) return { ok: false, message: '新记录标识冲突，未写入任何 SKU，请重试。' }
  data.skus.push(...next)
  family.updatedAt = input.now
  return { ok: true, ids: next.map(item => item.id), skipped: selected.size - next.length }
}

export function editSku(data: AppData, id: string, draft: SkuDraft, now: string): Result {
  const sku = data.skus.find(item => item.id === id && isRealSku(data, item))
  const family = sku && data.families.find(item => item.id === sku.familyId)
  if (!sku || !family) return { ok: false, message: '找不到真实 SKU，请到物料管理处理物料档案。' }
  if (!['draft', 'on_sale', 'off_sale'].includes(draft.status)) return { ok: false, message: 'SKU 状态无效。' }
  const changedSpec = attrsKey(sku.variantAttrs) !== attrsKey(draft.variantAttrs)
  // Historical bound/generated identities stay traceable; ordinary template SKU can edit its spec.
  if (changedSpec && (sku.sourceNodeIds?.length || sku.creationSource?.kind === 'plan' || sku.planningId)) return { ok: false, message: '这条 SKU 保留模型或规划来源，规格身份不可直接改写。请追加新规格。' }
  if (changedSpec) {
    const allowed = family.modelVersionId ? new Set(modelRows(data, family).map(item => skuSpecKey(data, family, item.variantAttrs))) : undefined
    const error = validateSkuDraft(data, family, draft, allowed)
    if (error) return { ok: false, message: error }
    if (data.skus.some(item => item.id !== id && item.familyId === family.id && isRealSku(data, item) && skuSpecKey(data, family, item.variantAttrs) === skuSpecKey(data, family, draft.variantAttrs))) return { ok: false, message: '该 SPU 已有相同规格。' }
  }
  Object.assign(sku, { code: draft.code.trim(), skuName: draft.skuName?.trim(), oaSkuId: draft.oaSkuId.trim(), status: draft.status, variantAttrs: { ...draft.variantAttrs }, projectedAttrs: projected(family, draft), updatedAt: now })
  family.updatedAt = now
  return { ok: true }
}
