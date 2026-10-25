import { isMaterialArchive, isRealSku } from './catalogIdentity'
import { roleOfType } from './compatibility'
import { compatibilityRecordRole, sameDeviceHost, validateCompatibilityHost } from './deviceResolution'
import { declarationDefaults } from './accessoryCompatibilityQuery'
import { templateClaimContentSignature } from './templateCompatibility'
import { conditionProblem } from './compatibilityValidation'
export { conditionProblem } from './compatibilityValidation'
import type { AppData, CompatibilityHost, CompatibilityLink } from './types'
import type { AccessoryTarget, CompatibilityCapability, CompatibilityConclusion, CompatibilityCondition, CompatibilityProvenance, CompatibilityVerification, DeviceModel } from './accessoryCompatibilityTypes'

export interface DeclarationDraft {
  target: AccessoryTarget
  host: CompatibilityHost
  conclusion: CompatibilityConclusion
  verification: CompatibilityVerification
  capability: CompatibilityCapability
  conditions: CompatibilityCondition[]
  source: string
  note: string
  provenance?: CompatibilityProvenance
}
export type CompatibilityChange = { kind: 'add'; draft: DeclarationDraft } | { kind: 'edit'; id: string; draft: DeclarationDraft } | { kind: 'remove'; id: string }
export interface CompatibilityPreviewItem { change: CompatibilityChange; state: 'new' | 'edit' | 'remove' | 'duplicate' | 'conflict' | 'invalid'; message: string }
export interface CompatibilityPreview {
  items: CompatibilityPreviewItem[]
  added: number
  edited: number
  removed: number
  skipped: number
  conflicts: number
  invalid: number
  canCommit: boolean
}
export interface CompatibilityCommandResult { ok: boolean; message?: string; preview?: CompatibilityPreview; createdIds?: string[]; id?: string }
export const cloneCompatibility = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

/** Missing new fields are legacy MAT statements, not inferred sales statements. */
export function declarationDraft(link: CompatibilityLink): DeclarationDraft {
  return cloneCompatibility({ ...declarationDefaults(link), host: link.host, note: link.note || '' })
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`
  return JSON.stringify(value) ?? 'undefined'
}
function sameClaim(left: DeclarationDraft, right: DeclarationDraft) {
  return left.conclusion === right.conclusion && left.verification === right.verification && stable(left.conditions) === stable(right.conditions)
}
function sameRange(left: DeclarationDraft, right: DeclarationDraft) {
  return left.target.kind === right.target.kind && left.target.id === right.target.id && left.capability === right.capability && sameDeviceHost(left.host, right.host)
}
function opposite(left: CompatibilityConclusion, right: CompatibilityConclusion) { return left !== right && (left === 'incompatible' || right === 'incompatible') }
function object(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) }
const string = (value: unknown): value is string => typeof value === 'string'
const oneOf = (value: unknown, options: string[]) => string(value) && options.includes(value)

function hostShape(value: unknown): value is CompatibilityHost {
  return object(value) && oneOf(value.scope, ['model', 'planning']) && string(value.productTypeId) && Boolean(value.productTypeId) && string(value.productModelId) && Boolean(value.productModelId) && string(value.identityKey) && Boolean(value.identityKey) && Array.isArray(value.steps) && value.steps.length > 0 && value.steps.every(step => object(step) && string(step.attributeId) && Boolean(step.attributeId) && string(step.attributeName) && string(step.valueId)) && (value.scope === 'planning' ? string(value.planningId) && Boolean(value.planningId) : value.planningId === undefined || value.planningId === '')
}
function provenanceProblem(value: unknown): string {
  if (value === undefined) return ''
  if (!object(value) || !oneOf(value.kind, ['manual', 'legacy', 'material-copy', 'template', 'material-relation']) || !string(value.detail)) return '声明来源结构无效。'
  if (value.kind === 'material-relation' && (!string(value.contributionId) || !value.contributionId.trim())) return '物料关联声明缺少贡献来源。'
  if (value.kind === 'template') {
    const source = value.template
    if (!object(source) || ![source.originKey, source.modelId, source.sourceVersionId].every(item => string(item) && Boolean(item)) || !Array.isArray(source.ruleIds) || !source.ruleIds.length || !source.ruleIds.every(string) || !Array.isArray(source.claimIds) || !source.claimIds.length || !source.claimIds.every(string) || !oneOf(source.state, ['managed', 'modified', 'stale'])) return '模板声明来源结构无效。'
  }
  if (value.kind === 'material-copy') {
    const material = value.materialSnapshot, declaration = value.declarationSnapshot
    if (!string(value.materialId) || !string(value.declarationId) || !object(material) || ![material.id, material.code, material.name].every(string) || !object(declaration) || !string(declaration.id) || !hostShape(declaration.host) || !string(declaration.note) || !oneOf(declaration.conclusion, ['compatible', 'conditional', 'incompatible']) || !oneOf(declaration.verification, ['confirmed', 'pending']) || !oneOf(declaration.capability, ['basic', 'fast-charge', 'other']) || !Array.isArray(declaration.conditions) || declaration.conditions.some(item => conditionProblem(item)) || ![declaration.source, declaration.createdAt, declaration.updatedAt].every(string)) return '物料复制来源快照不完整。'
  }
  return ''
}
export function declarationProblem(data: AppData, draft: DeclarationDraft): string {
  if (!draft || !object(draft.target) || !oneOf(draft.target.kind, ['sku', 'material']) || !string(draft.target.id)) return '请选择销售 SKU 或物料。'
  const sku = data.skus.find(item => item.id === draft.target.id)
  if (!sku) return '配件对象已不存在，请重新选择。'
  if (draft.target.kind === 'sku' ? !isRealSku(data, sku) : !isMaterialArchive(data, sku)) return '所选对象与销售 SKU / MAT 身份不一致。'
  const family = data.families.find(item => item.id === sku.familyId)
  if (!family || compatibilityRecordRole(data, sku.id) !== 'accessory') return '请选择产品类型已配置为配件的对象。'
  if (!hostShape(draft.host)) return '主机型号或范围结构无效。'
  const hostError = validateCompatibilityHost(data, draft.host)
  if (hostError) return hostError
  if (!oneOf(draft.conclusion, ['compatible', 'conditional', 'incompatible']) || !oneOf(draft.verification, ['confirmed', 'pending']) || !oneOf(draft.capability, ['basic', 'fast-charge', 'other'])) return '兼容结论、核验状态或能力范围无效。'
  if (!Array.isArray(draft.conditions)) return '条件列表无效。'
  for (const condition of draft.conditions) {
    const error = conditionProblem(condition)
    if (error) return error
    if (condition.kind === 'attribute' && !data.params.some(param => param.id === condition.attributeId)) return '条件引用的设备属性已不存在。'
  }
  if (draft.conclusion === 'conditional' && !draft.conditions.length) return '有条件兼容必须填写使用条件，不能只写备注。'
  if (!string(draft.source) || !draft.source.trim()) return '请填写声明来源或依据；未知资料请如实说明。'
  if (!string(draft.note)) return '备注格式无效。'
  return provenanceProblem(draft.provenance)
}

function asLink(draft: DeclarationDraft, id: string, now: string, createdAt = now): CompatibilityLink {
  return { id, accessorySkuId: draft.target.id, targetKind: draft.target.kind, targetId: draft.target.id, host: cloneCompatibility(draft.host), conclusion: draft.conclusion, verification: draft.verification, capability: draft.capability, conditions: cloneCompatibility(draft.conditions), source: draft.source.trim(), note: draft.note.trim(), provenance: cloneCompatibility(draft.provenance || { kind: 'manual', detail: draft.source.trim() }), createdAt, updatedAt: now }
}

/** Read-only preview. Every accepted row is compared with earlier rows in the same batch. */
export function previewCompatibilityChanges(data: AppData, changes: CompatibilityChange[]): CompatibilityPreview {
  const items: CompatibilityPreviewItem[] = [], trial = cloneCompatibility(data.compatibilities || [])
  if (!Array.isArray(changes)) return { items, added: 0, edited: 0, removed: 0, skipped: 0, conflicts: 0, invalid: 1, canCommit: false }
  changes.forEach((change, index) => {
    const append = (state: CompatibilityPreviewItem['state'], message: string) => items.push({ change, state, message })
    if (!change || !oneOf(change.kind, ['add', 'edit', 'remove'])) { append('invalid', '未知的声明操作。'); return }
    if (change.kind === 'remove') {
      const found = trial.findIndex(link => link.id === change.id)
      if (found === -1) { append('duplicate', '声明已经取消，不重复操作。'); return }
      trial.splice(found, 1); append('remove', '只取消这条声明，不删除商品或物料。'); return
    }
    const problem = declarationProblem(data, change.draft)
    if (problem) { append('invalid', problem); return }
    const original = change.kind === 'edit' ? trial.find(link => link.id === change.id) : undefined
    if (change.kind === 'edit' && !original) { append('invalid', '待编辑声明已不存在，请重新打开。'); return }
    const others = trial.filter(link => link.id !== original?.id).map(declarationDraft).filter(draft => sameRange(draft, change.draft))
    if (others.some(draft => opposite(draft.conclusion, change.draft.conclusion))) { append('conflict', '同一对象、型号范围和能力已有相反结论；不会自动覆盖。'); return }
    const sameExistingClaim = (draft: DeclarationDraft) => original?.provenance?.kind === 'template'
      ? templateClaimContentSignature({ ...draft, id: '' }) === templateClaimContentSignature({ ...change.draft, id: '' })
      : sameClaim(draft, change.draft)
    if (others.some(sameExistingClaim)) { append('duplicate', '同范围、同能力和条件的声明已存在，跳过重复。'); return }
    if (original) {
      const next = asLink(change.draft, original.id, original.updatedAt, original.createdAt)
      if (stable(original) === stable(next)) { append('duplicate', '声明内容没有变化。'); return }
      trial[trial.indexOf(original)] = next; append('edit', `明确修改声明 ${original.id}。`)
    } else { trial.push(asLink(change.draft, `preview:${index}`, '')); append('new', '新增独立声明，不覆盖已有结论。') }
  })
  const count = (state: CompatibilityPreviewItem['state']) => items.filter(item => item.state === state).length
  const preview = { items, added: count('new'), edited: count('edit'), removed: count('remove'), skipped: count('duplicate'), conflicts: count('conflict'), invalid: count('invalid'), canCommit: false }
  preview.canCommit = preview.conflicts === 0 && preview.invalid === 0
  return preview
}

export function applyCompatibilityChanges(data: AppData, changes: CompatibilityChange[], nextId: () => string, now: string): CompatibilityCommandResult {
  const preview = previewCompatibilityChanges(data, changes)
  if (!preview.canCommit) return { ok: false, message: '存在冲突或无效项，请先处理，未写入任何声明。', preview }
  const createdIds: string[] = [], existingIds = new Set(data.compatibilities.map(link => link.id))
  for (const item of preview.items) {
    const change = item.change
    if (item.state === 'duplicate') continue
    if (change.kind === 'remove') data.compatibilities = data.compatibilities.filter(link => link.id !== change.id)
    else if (change.kind === 'edit') {
      const original = data.compatibilities.find(link => link.id === change.id)
      if (original) data.compatibilities[data.compatibilities.indexOf(original)] = asLink(change.draft, original.id, now, original.createdAt)
    } else {
      let id = nextId()
      while (existingIds.has(id)) id = nextId()
      existingIds.add(id); createdIds.push(id); data.compatibilities.push(asLink(change.draft, id, now))
    }
  }
  return { ok: true, preview, createdIds }
}

export function previewMaterialCopy(data: AppData, materialId: string, skuId: string): CompatibilityPreview & { changes: CompatibilityChange[] } {
  const material = data.skus.find(item => item.id === materialId), sku = data.skus.find(item => item.id === skuId)
  const links = (data.compatibilities || []).filter(link => (link.targetKind || 'material') === 'material' && (link.targetId || link.accessorySkuId) === materialId)
  const changes: CompatibilityChange[] = links.map(link => {
    const original = declarationDraft(link)
    return { kind: 'add', draft: { ...original, target: { kind: 'sku', id: skuId }, provenance: {
      kind: 'material-copy', detail: '用户确认从指定物料复制；副本独立维护，不是 BOM 或动态继承。', materialId,
      materialSnapshot: { id: materialId, code: material?.materialCode || material?.code || '', name: material?.skuName || '' }, declarationId: link.id,
      declarationSnapshot: { id: link.id, host: cloneCompatibility(link.host), note: link.note, conclusion: original.conclusion, verification: original.verification, capability: original.capability, conditions: cloneCompatibility(original.conditions), source: original.source, createdAt: link.createdAt, updatedAt: link.updatedAt },
    } } }
  })
  const preview = previewCompatibilityChanges(data, changes)
  const error = !material || !isMaterialArchive(data, material) ? '请选择真实源物料 MAT。' : !sku || !isRealSku(data, sku) ? '请选择真实目标销售 SKU。' : !links.length ? '源物料尚无可复制的正式声明。' : ''
  if (error) { preview.invalid++; preview.canCommit = false; preview.items.push({ change: { kind: 'remove', id: '' }, state: 'invalid', message: error }) }
  return { ...preview, changes }
}

export function deviceModelProblem(data: AppData, model: Pick<DeviceModel, 'name' | 'productTypeId' | 'attributes'>): string {
  if (!string(model.name) || !model.name.trim()) return '请填写设备型号名称。'
  const type = data.productTypes.find(item => item.id === model.productTypeId)
  if (!type || type.status !== 'enabled' || roleOfType(data, type.id) !== 'host') return '请选择有效的主机产品类型。'
  if (!object(model.attributes) || Object.entries(model.attributes).some(([id, value]) => !data.params.some(param => param.id === id) || !string(value))) return '型号属性必须使用有效属性及文本值。'
  return ''
}

/** Validate import schema and identity, retaining dangling references for repair instead of guessing replacements. */
export function compatibilityImportProblems(data: AppData): string[] {
  const problems: string[] = []
  if (data.deviceModels !== undefined && !Array.isArray(data.deviceModels)) problems.push('设备型号列表必须是数组。')
  if (data.deviceBindings !== undefined && !Array.isArray(data.deviceBindings)) problems.push('设备绑定列表必须是数组。')
  const duplicate = (ids: string[], label: string) => { if (new Set(ids).size !== ids.length) problems.push(`${label}身份重复。`) }
  if (Array.isArray(data.deviceModels)) {
    duplicate(data.deviceModels.map(model => model?.id), '设备型号')
    data.deviceModels.forEach(model => { if (!object(model) || ![model.id, model.name, model.productTypeId, model.createdAt, model.updatedAt].every(string) || !model.id || !object(model.attributes) || Object.values(model.attributes).some(value => !string(value))) problems.push('设备型号结构无效。') })
  }
  if (Array.isArray(data.deviceBindings)) {
    duplicate(data.deviceBindings.map(binding => binding?.skuId), '设备绑定')
    data.deviceBindings.forEach(binding => {
      if (!object(binding) || ![binding.skuId, binding.sourceStamp, binding.createdAt, binding.updatedAt].every(string) || !hostShape(binding.host)) { problems.push('设备绑定结构无效。'); return }
      const sku = data.skus.find(item => item.id === binding.skuId)
      if (sku && !isRealSku(data, sku)) problems.push('设备绑定不能指向 MAT。')
    })
  }
  if (Array.isArray(data.compatibilities)) {
    duplicate(data.compatibilities.map(link => link?.id), '兼容声明')
    data.compatibilities.forEach(link => {
      if (!object(link) || ![link.id, link.accessorySkuId, link.note, link.createdAt, link.updatedAt].every(string) || !hostShape(link.host)) { problems.push('兼容声明基础结构无效。'); return }
      const extended = link.targetKind !== undefined || link.targetId !== undefined || link.conclusion !== undefined || link.conditions !== undefined || link.verification !== undefined || link.capability !== undefined || link.provenance !== undefined
      if (!extended) return
      if (!oneOf(link.targetKind, ['sku', 'material']) || !string(link.targetId) || !link.targetId || link.accessorySkuId !== link.targetId) problems.push(`声明 ${link.id} 的对象身份无效。`)
      const target = data.skus.find(item => item.id === link.targetId)
      // A missing family is a repairable live reference; explicit SKU/MAT identity conflicts still fail.
      if (target && (link.targetKind === 'sku' ? isMaterialArchive(data, target) : !isMaterialArchive(data, target))) problems.push(`声明 ${link.id} 的 SKU / MAT 类型不符。`)
      if (!oneOf(link.conclusion, ['compatible', 'conditional', 'incompatible']) || !oneOf(link.verification, ['confirmed', 'pending']) || !oneOf(link.capability, ['basic', 'fast-charge', 'other']) || !Array.isArray(link.conditions) || link.conditions.some(condition => conditionProblem(condition)) || !string(link.source)) problems.push(`声明 ${link.id} 的结论、条件或来源无效。`)
      if (link.conclusion === 'conditional' && Array.isArray(link.conditions) && !link.conditions.length) problems.push(`声明 ${link.id} 缺少使用条件。`)
      const provenance = provenanceProblem(link.provenance)
      if (provenance) problems.push(provenance)
    })
  } else if (data.compatibilities !== undefined) problems.push('兼容声明列表必须是数组。')
  return problems
}
