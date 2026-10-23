import { createCatalogIdentityContext } from './catalogIdentity'
import { compatibilityFamilyRole, sameDeviceHost } from './deviceResolution'
import { conditionProblem } from './compatibilityValidation'
import { cloneCompatibility, declarationDraft } from './accessoryCompatibilityCommands'
import { createTemplateCompatibilityContext, mapTemplateCombination, resolveTemplateCompatibility, templateClaimContentSignature } from './templateCompatibility'
import type { AccessoryTarget } from './accessoryCompatibilityTypes'
import type { AppData, CompatibilityLink, PlanningStep, ProductFamily, Sku } from './types'
import type { EffectiveTemplateClaim, TemplateCompatibilityClaim } from './templateCompatibilityTypes'

/** A durable, per-claim three-way baseline. Deleted entries are deliberate suppression tombstones. */
export interface TemplateCompatibilityOrigin {
  key: string
  target: AccessoryTarget
  modelId: string
  sourceVersionId: string
  ruleIds: string[]
  claimIds: string[]
  lineage?: { ruleId: string; claimId: string }[]
  identityKey: string
  steps: PlanningStep[]
  sourceStamp: string
  baseline: TemplateCompatibilityClaim
  declarationId?: string
  state: 'managed' | 'modified' | 'deleted' | 'kept' | 'stale' | 'obsolete'
  updatedAt: string
}
export interface TemplateSyncItem {
  id: string
  target: AccessoryTarget
  targetName: string
  state: 'add' | 'update' | 'remove' | 'protected' | 'conflict' | 'invalid' | 'unchanged'
  message: string
  defaultSelected: boolean
  originKey: string
  declarationId?: string
  before?: TemplateCompatibilityClaim
  after?: TemplateCompatibilityClaim
  sourceVersionId?: string
  ruleIds: string[]
  claimIds: string[]
  /** Internal immutable proposal, included in the basis and re-derived before committing. */
  origin?: TemplateCompatibilityOrigin
  blockingIds?: string[]
  duplicateManual?: boolean
}
export interface TemplateSyncPreview {
  modelId: string
  targetVersionId: string
  targetIds?: string[]
  basis: string
  items: TemplateSyncItem[]
  counts: Record<TemplateSyncItem['state'], number>
  stats?: TemplateCompatibilityStats
}
export interface TemplateCompatibilityStats { contextBuilds: number; combinationExpansions: number; declarationScans: number; originScans: number }
export interface TemplateSyncResult { ok: boolean; message?: string; added?: number; updated?: number; removed?: number; protected?: number; stats?: TemplateCompatibilityStats }
const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`
  return JSON.stringify(value) ?? 'undefined'
}
const targetKey = (target: AccessoryTarget) => `${target.kind}:${target.id}`
function indexRow<T>(index: Map<string, T[]>, key: string, row: T) {
  const bucket = index.get(key)
  if (bucket) bucket.push(row)
  else index.set(key, [row])
}
const linkTarget = (link: CompatibilityLink): AccessoryTarget => ({ kind: link.targetKind || 'material', id: link.targetId || link.accessorySkuId })
const originKey = (target: AccessoryTarget, modelId: string, claim: EffectiveTemplateClaim) => stable([targetKey(target), modelId, claim.ruleIds.slice().sort(), claim.claimIds.slice().sort()])
const content = templateClaimContentSignature
function claimOf(link: CompatibilityLink): TemplateCompatibilityClaim {
  const draft = declarationDraft(link)
  return { id: '', host: draft.host, conclusion: draft.conclusion, verification: draft.verification, capability: draft.capability, conditions: draft.conditions, source: draft.source, note: draft.note }
}
const sameContent = (a: TemplateCompatibilityClaim, b: TemplateCompatibilityClaim) => content(a) === content(b)
/** An explicit model-wide denial also protects a narrower planning-level allowance. */
function overlaps(a: TemplateCompatibilityClaim, b: TemplateCompatibilityClaim) {
  return a.capability === b.capability && sameDeviceHost(a.host, b.host, false) && (a.host.scope === 'model' || b.host.scope === 'model' || a.host.planningId === b.host.planningId)
}
export function templateCompatibilitySourceStamp(sku: Sku, family: ProductFamily) {
  return stable([sku.id, sku.familyId, family.templateId, family.modelVersionId || '', sku.modelVersionId || '', sku.creationSource?.modelVersionId || '', family.commonAttrs, sku.variantAttrs, sku.sourceNodeIds || [], sku.planningId || ''])
}
function boundVersion(sku: Sku, family: ProductFamily, material: boolean) {
  // A reused MAT family can retain V1 while a newly filed material explicitly binds V2.
  if (material && sku.modelVersionId) return sku.modelVersionId
  const versions = [...new Set([sku.modelVersionId, sku.creationSource?.modelVersionId, family.modelVersionId].filter((id): id is string => Boolean(id)))]
  return versions.length === 1 ? versions[0] : ''
}
type Context = ReturnType<typeof createTemplateCompatibilityContext>
function lookup(context: Context, data: AppData) {
  const nodes = new Map<string, Context['combinations']>(), attrs = new Map<string, Context['combinations']>(), manual = new Map<string, Context['combinations']>()
  const currentNames = new Map(data.params.map(param => [param.id, param.name]))
  const fields = new Map<string, { role: string; attributeId: string; name: string; currentName: string }>()
  for (const combo of context.combinations) {
    const key = stable(combo.steps.map(step => step.valueNodeId).sort())
    indexRow(nodes, key, combo)
    combo.steps.forEach(step => fields.set(`${step.role}:${step.attributeId}`, { role: step.role, attributeId: step.attributeId, name: step.attributeName, currentName: currentNames.get(step.attributeId) || step.attributeName }))
    const values = stable(combo.steps.map(step => [step.role, step.attributeId, step.valueId]).sort((a, b) => stable(a).localeCompare(stable(b))))
    indexRow(attrs, values, combo)
    const flat = stable(combo.steps.map(step => [step.attributeId, step.valueId]).sort((a, b) => stable(a).localeCompare(stable(b))))
    indexRow(manual, flat, combo)
  }
  return { nodes, attrs, manual, fields: [...fields.values()] }
}
function findCombination(index: ReturnType<typeof lookup>, family: ProductFamily, sku: Pick<Sku, 'variantAttrs' | 'sourceNodeIds' | 'manualAttrs'>) {
  if (sku.manualAttrs?.length) {
    const modelFields = new Set(index.fields.map(field => field.attributeId))
    const key = stable(sku.manualAttrs.filter(attr => modelFields.has(attr.attributeId)).map(attr => [attr.attributeId, attr.value]).sort((a, b) => stable(a).localeCompare(stable(b))))
    const matches = index.manual.get(key)
    return matches?.length === 1 ? matches[0] : undefined
  }
  const values = stable(index.fields.flatMap(field => {
    const attrs = field.role === 'common' ? family.commonAttrs : sku.variantAttrs, value = attrs[field.attributeId] ?? attrs[field.name] ?? attrs[field.currentName]
    return value ? [[field.role, field.attributeId, value]] : []
  }).sort((a, b) => stable(a).localeCompare(stable(b))))
  const possible = sku.sourceNodeIds?.length ? index.nodes.get(stable([...sku.sourceNodeIds].sort())) : index.attrs.get(values)
  const matches = (possible || []).filter(combo => combo.steps.every(step => {
    const attrs = step.role === 'common' ? family.commonAttrs : sku.variantAttrs
    const field = index.fields.find(item => item.role === step.role && item.attributeId === step.attributeId)
    return (attrs[step.attributeId] ?? attrs[step.attributeName] ?? attrs[field?.currentName || '']) === step.valueId
  }))
  return matches.length === 1 ? matches[0] : undefined
}
function linkFrom(origin: TemplateCompatibilityOrigin, id: string, now: string, createdAt = now): CompatibilityLink {
  const claim = origin.baseline
  return { id, accessorySkuId: origin.target.id, targetKind: origin.target.kind, targetId: origin.target.id, host: cloneCompatibility(claim.host), conclusion: claim.conclusion, verification: claim.verification, capability: claim.capability, conditions: cloneCompatibility(claim.conditions), source: claim.source, note: claim.note,
    provenance: { kind: 'template', detail: '从绑定的已发布模板兼容配置生成；每条声明独立保留来源与人工保护。', template: { originKey: origin.key, modelId: origin.modelId, sourceVersionId: origin.sourceVersionId, ruleIds: [...origin.ruleIds], claimIds: [...origin.claimIds], state: 'managed' } }, createdAt, updatedAt: now }
}
function expectedOrigin(target: AccessoryTarget, sku: Sku, family: ProductFamily, versionId: string, combo: Context['combinations'][number], expected: EffectiveTemplateClaim, now: string): TemplateCompatibilityOrigin {
  return { key: originKey(target, family.templateId, expected), target, modelId: family.templateId, sourceVersionId: versionId, ruleIds: [...expected.ruleIds], claimIds: [...expected.claimIds], lineage: cloneCompatibility(expected.origins), identityKey: combo.identityKey, steps: cloneCompatibility(combo.steps), sourceStamp: templateCompatibilitySourceStamp(sku, family), baseline: cloneCompatibility(expected.claim), state: 'managed', updatedAt: now }
}

/** Reuses one expanded/indexed published version per batch; previews never allocate official ids. */
export function previewTemplateForSkuDrafts(data: AppData, familyId: string, drafts: Pick<Sku, 'variantAttrs' | 'sourceNodeIds'>[]) {
  const family = data.families.find(item => item.id === familyId)
  if (compatibilityFamilyRole(data, familyId) !== 'accessory') return drafts.map(() => ({ state: 'unconfigured' as const, claims: [], message: '此商品不是配件，不带入配件兼容声明。' }))
  if (!family?.modelVersionId) return drafts.map(() => ({ state: 'unconfigured' as const, claims: [], message: '未绑定带兼容配置的发布版本，不阻止原有创建。' }))
  const context = createTemplateCompatibilityContext(data, { modelId: family.templateId, versionId: family.modelVersionId }), index = lookup(context, data)
  return drafts.map(draft => {
    const combo = findCombination(index, family, draft)
    return combo ? resolveTemplateCompatibility(context, combo) : { state: 'invalid' as const, claims: [], message: '无法唯一定位绑定版本的完整合法规格，不生成兼容声明。' }
  })
}

export function previewTemplateForManualAttributes(data: AppData, input: { modelId: string; versionId: string; attrs: { attributeId: string; value: string }[] }) {
  const version = data.specModelVersions.find(item => item.id === input.versionId && item.templateId === input.modelId)
  if (!version?.templateCompatibilitySnapshot) return { state: 'unconfigured' as const, claims: [], message: '未指定带兼容配置的发布版本，不带入模板声明。' }
  const context = createTemplateCompatibilityContext(data, { modelId: input.modelId, versionId: input.versionId }), index = lookup(context, data)
  const matches = index.manual.get(stable(input.attrs.filter(attr => index.fields.some(field => field.attributeId === attr.attributeId)).map(attr => [attr.attributeId, attr.value]).sort((a, b) => stable(a).localeCompare(stable(b)))))
  return matches?.length === 1 ? resolveTemplateCompatibility(context, matches[0]!) : { state: 'invalid' as const, claims: [], message: '实际属性无法唯一对应该版本的完整合法规格，不带入兼容声明。' }
}

export function materializeTemplateCompatibility(data: AppData, skuIds: string[], nextId: () => string, now: string): TemplateSyncResult {
  if (!skuIds.length) return { ok: true, added: 0, stats: { contextBuilds: 0, combinationExpansions: 0, declarationScans: 0, originScans: 0 } }
  const identity = createCatalogIdentityContext(data)
  const stats: TemplateCompatibilityStats = { contextBuilds: 0, combinationExpansions: 0, declarationScans: data.compatibilities.length, originScans: (data.templateCompatibilityOrigins || []).length }
  const ids = new Set(skuIds), contexts = new Map<string, { context: Context; index: ReturnType<typeof lookup> }>(), families = new Map(data.families.map(item => [item.id, item]))
  const linksByTarget = new Map<string, CompatibilityLink[]>(), used = new Set<string>()
  for (const link of data.compatibilities) { indexRow(linksByTarget, targetKey(linkTarget(link)), link); used.add(link.id) }
  const originKeys = new Set((data.templateCompatibilityOrigins || []).map(item => item.key)), roles = new Map<string, boolean>()
  let added = 0
  for (const sku of data.skus) {
    if (!ids.has(sku.id)) continue
    if (!roles.has(sku.familyId)) roles.set(sku.familyId, compatibilityFamilyRole(data, sku.familyId) === 'accessory')
    if (!roles.get(sku.familyId)) continue
    const material = identity.isMaterialArchive(sku), family = families.get(sku.familyId), versionId = family && boundVersion(sku, family, material)
    if (!family || !versionId) continue
    const key = `${family.templateId}:${versionId}`
    let entry = contexts.get(key)
    if (!entry) { const context = createTemplateCompatibilityContext(data, { modelId: family.templateId, versionId }); entry = { context, index: lookup(context, data) }; contexts.set(key, entry); stats.contextBuilds++; stats.combinationExpansions += context.stats.combinationExpansions }
    const combo = findCombination(entry.index, family, sku)
    if (!combo) {
      if (sku.sourceNodeIds?.length || sku.planningId && !sku.manualAttrs?.length) return { ok: false, message: '无法证明新建对象的完整规格与绑定版本一致，未创建商品或声明。' }
      continue
    }
    const expected = resolveTemplateCompatibility(entry.context, combo)
    if (expected.state === 'conflict' || expected.state === 'invalid') return { ok: false, message: `兼容配置不能生成：${expected.message}` }
    const target: AccessoryTarget = { kind: material ? 'material' : 'sku', id: sku.id }, links = linksByTarget.get(targetKey(target)) || []
    for (const effective of expected.claims) {
      const origin = expectedOrigin(target, sku, family, versionId, combo, effective, now)
      if (originKeys.has(origin.key)) continue
      if (links.some(link => sameContent(claimOf(link), effective.claim) || overlaps(claimOf(link), effective.claim) && (claimOf(link).conclusion === 'incompatible') !== (effective.claim.conclusion === 'incompatible'))) continue
      // The context validates each claim once; this loop has already proved target identity and role.
      let id = nextId(); while (used.has(id)) id = nextId(); used.add(id)
      origin.declarationId = id
      const link = linkFrom(origin, id, now)
      data.compatibilities.push(link); links.push(link)
      ;(data.templateCompatibilityOrigins ||= []).push(origin)
      originKeys.add(origin.key)
      added++
    }
  }
  return { ok: true, added, stats }
}

export function markTemplateManualChanges(data: AppData, changes: { kind: string; id?: string }[], now: string) {
  for (const change of changes) {
    if (change.kind !== 'edit' && change.kind !== 'remove') continue
    for (const origin of data.templateCompatibilityOrigins || []) {
      if (origin.declarationId !== change.id) continue
      origin.state = change.kind === 'remove' ? 'deleted' : 'modified'; origin.updatedAt = now
      const link = data.compatibilities.find(item => item.id === change.id)
      if (link?.provenance?.template) link.provenance.template.state = 'modified'
    }
  }
}
export function invalidateTemplateSpec(data: AppData, skuId: string, now: string) {
  for (const origin of data.templateCompatibilityOrigins || []) if (origin.target.id === skuId && origin.state !== 'deleted' && origin.state !== 'obsolete') {
    origin.state = 'stale'; origin.updatedAt = now
    const link = data.compatibilities.find(item => item.id === origin.declarationId)
    if (link?.provenance?.template) link.provenance.template.state = 'stale'
  }
}

export function previewTemplateCompatibilitySync(data: AppData, input: { modelId: string; targetVersionId: string; targetIds?: string[] }): TemplateSyncPreview {
  const identity = createCatalogIdentityContext(data)
  const items: TemplateSyncItem[] = [], targetContext = createTemplateCompatibilityContext(data, { modelId: input.modelId, versionId: input.targetVersionId })
  const stats: TemplateCompatibilityStats = { contextBuilds: 1, combinationExpansions: targetContext.stats.combinationExpansions, declarationScans: data.compatibilities.length, originScans: (data.templateCompatibilityOrigins || []).length }
  const families = new Map(data.families.map(item => [item.id, item])), targets = input.targetIds ? new Set(input.targetIds) : undefined
  const originsByTarget = new Map<string, TemplateCompatibilityOrigin[]>(), linksByTarget = new Map<string, CompatibilityLink[]>(), sourceContexts = new Map<string, { context: Context; index: ReturnType<typeof lookup> }>()
  for (const origin of data.templateCompatibilityOrigins || []) if (origin.modelId === input.modelId) indexRow(originsByTarget, targetKey(origin.target), origin)
  for (const link of data.compatibilities) indexRow(linksByTarget, targetKey(linkTarget(link)), link)
  const affected: Sku[] = []
  const roles = new Map<string, boolean>()
  for (const sku of data.skus) {
    const family = families.get(sku.familyId)
    if (!family || family.templateId !== input.modelId || targets && !targets.has(sku.id)) continue
    if (!roles.has(family.id)) roles.set(family.id, compatibilityFamilyRole(data, family.id) === 'accessory')
    if (!roles.get(family.id)) continue
    affected.push(sku)
    const target: AccessoryTarget = { kind: identity.isMaterialArchive(sku) ? 'material' : 'sku', id: sku.id }, key = targetKey(target), origins = originsByTarget.get(key) || [], links = linksByTarget.get(key) || [], versionId = boundVersion(sku, family, target.kind === 'material')
    const append = (item: Omit<TemplateSyncItem, 'id' | 'target' | 'targetName' | 'defaultSelected'> & { defaultSelected?: boolean }) => items.push({ ...item, id: `${key}:${item.originKey}`, target, targetName: sku.skuName || sku.code || sku.id, defaultSelected: item.defaultSelected ?? ['add', 'update', 'remove'].includes(item.state) })
    let entry = sourceContexts.get(versionId)
    if (!entry) { const context = versionId === input.targetVersionId ? targetContext : createTemplateCompatibilityContext(data, { modelId: input.modelId, versionId }); entry = { context, index: lookup(context, data) }; sourceContexts.set(versionId, entry); if (context !== targetContext) { stats.contextBuilds++; stats.combinationExpansions += context.stats.combinationExpansions } }
    const current = findCombination(entry.index, family, sku)
    const mapping = current ? mapTemplateCombination(entry.context, targetContext, { steps: current.steps }) : undefined
    if (!versionId || !current || !mapping || mapping.state !== 'resolved' || !mapping.combination) {
      append({ state: 'invalid', originKey: 'invalid', ruleIds: [], claimIds: [], message: '来源规格已改变、版本缺失或无法准确映射目标合法组合；保留全部当前声明，不执行清空。' }); continue
    }
    const expected = resolveTemplateCompatibility(targetContext, mapping.combination)
    if (expected.state === 'invalid' || expected.state === 'conflict' || expected.state === 'unconfigured') {
      append({ state: expected.state === 'conflict' ? 'conflict' : 'invalid', originKey: 'invalid', ruleIds: expected.ruleIds, claimIds: [], message: expected.state === 'unconfigured' ? '目标版本未配置，不能据此清空已有声明。' : expected.message }); continue
    }
    const desired = new Set<string>()
    for (const effective of expected.claims) {
      const origin = expectedOrigin(target, sku, family, input.targetVersionId, mapping.combination, effective, '')
      const related = origins.filter(item => item.key === origin.key || effective.origins.some(pair => item.lineage ? item.lineage.some(prior => prior.ruleId === pair.ruleId && prior.claimId === pair.claimId) : item.ruleIds.includes(pair.ruleId) && item.claimIds.includes(pair.claimId)))
      const previous = related.find(item => item.key === origin.key) || (related.length === 1 ? related[0] : undefined)
      if (previous) origin.key = previous.key
      const link = previous?.declarationId ? links.find(item => item.id === previous.declarationId) : undefined
      desired.add(origin.key)
      const manual = links.filter(item => item.id !== link?.id && item.provenance?.kind !== 'template'), sameManual = manual.some(item => sameContent(claimOf(item), effective.claim))
      const blockers = manual.filter(item => overlaps(claimOf(item), effective.claim) && (claimOf(item).conclusion === 'incompatible') !== (effective.claim.conclusion === 'incompatible'))
      const suppressed = previous && ['deleted', 'kept', 'modified', 'stale'].includes(previous.state)
      const base = { originKey: origin.key, declarationId: previous?.declarationId, before: link ? claimOf(link) : undefined, after: effective.claim, sourceVersionId: previous?.sourceVersionId, ruleIds: effective.ruleIds, claimIds: effective.claimIds, origin, blockingIds: blockers.map(item => item.id), duplicateManual: sameManual }
      if (sameManual) append({ ...base, state: 'protected', message: '相同内容的人工/历史/物料复制声明已存在，跳过且不认领为模板来源。' })
      else if (related.length > 1) append({ ...base, state: 'conflict', message: '多个历史模板来源映射到同一声明，需先处理来源歧义；不自动合并或删除。' })
      else if (blockers.length || suppressed || previous && previous.state !== 'managed' && previous.state !== 'obsolete' || link && previous && !sameContent(claimOf(link), previous.baseline) || previous?.state === 'managed' && !link || previous && previous.sourceStamp !== templateCompatibilitySourceStamp(sku, family)) append({ ...base, state: 'protected', message: '存在人工维护、规格变化、手动删除或明确不兼容保护；默认保留，只有明确采用模板才替换对应项。' })
      else if (!link) append({ ...base, state: 'add', message: '新增模板声明，不改商品来源或规格。' })
      else if (!sameContent(claimOf(link), effective.claim) || previous?.sourceVersionId !== input.targetVersionId) append({ ...base, state: 'update', message: '当前声明仍等于上次模板基线，可安全更新兼容内容与来源版本。' })
      else append({ ...base, state: 'unchanged', message: '兼容内容和来源版本未变化。' })
    }
    for (const previous of origins) {
      if (desired.has(previous.key) || previous.state === 'obsolete') continue
      const link = links.find(item => item.id === previous.declarationId)
      if (!link && previous.state === 'deleted') continue
      const safe = previous.state === 'managed' && link && sameContent(claimOf(link), previous.baseline)
      append({ state: safe ? 'remove' : 'protected', originKey: previous.key, declarationId: previous.declarationId, before: link ? claimOf(link) : undefined, sourceVersionId: previous.sourceVersionId, ruleIds: previous.ruleIds, claimIds: previous.claimIds, origin: cloneCompatibility(previous), message: safe ? '目标版本已移除此模板声明，安全取消该模板管理项。' : '目标版本不再需要，但当前声明已人工维护；默认保留。' })
    }
  }
  const counts: TemplateSyncPreview['counts'] = { add: 0, update: 0, remove: 0, protected: 0, conflict: 0, invalid: 0, unchanged: 0 }
  items.forEach(item => counts[item.state]++)
  const basis = stable([input, affected.map(sku => [sku, families.get(sku.familyId)]), data.specModelVersions.filter(version => version.templateId === input.modelId), data.compatibilities, data.templateCompatibilityOrigins || [], data.productTypes, data.params, data.deviceModels || []])
  return { ...input, basis, items, counts, stats }
}

/** The store supplies a private candidate. Re-preview rejects edited/stale proposals before any mutation. */
export function applyTemplateCompatibilitySync(data: AppData, preview: TemplateSyncPreview, decisions: Record<string, 'take-template' | 'keep'>, nextId: () => string, now: string): TemplateSyncResult {
  const current = previewTemplateCompatibilitySync(data, { modelId: preview.modelId, targetVersionId: preview.targetVersionId, targetIds: preview.targetIds })
  if (current.basis !== preview.basis || stable(current.items) !== stable(preview.items)) return { ok: false, message: '预览后商品、声明或版本已变化，请重新预览；未写入任何内容。' }
  const result = { ok: true, added: 0, updated: 0, removed: 0, protected: 0 }, used = new Set(data.compatibilities.map(item => item.id))
  for (const item of current.items) {
    const decision = decisions[item.id] || (item.defaultSelected ? 'take-template' : 'keep')
    if (item.state === 'invalid' || item.state === 'conflict' || item.state === 'unchanged' || item.duplicateManual) continue
    const existing = data.templateCompatibilityOrigins?.find(origin => origin.key === item.originKey)
    if (decision === 'keep') {
      if (existing && existing.state !== 'kept') { existing.state = 'kept'; existing.updatedAt = now }
      else if (!existing && item.origin) { (data.templateCompatibilityOrigins ||= []).push({ ...cloneCompatibility(item.origin), state: 'kept', updatedAt: now }) }
      result.protected++; continue
    }
    if (!item.after) {
      if (item.declarationId) { data.compatibilities = data.compatibilities.filter(link => link.id !== item.declarationId); result.removed++ }
      if (existing) { existing.state = 'obsolete'; existing.declarationId = undefined; existing.updatedAt = now }
      continue
    }
    if (!item.origin) continue
    const origin = cloneCompatibility(item.origin), original = data.compatibilities.find(link => link.id === item.declarationId)
    // Re-preview has validated both the exact target and this frozen claim before mutation.
    if (item.blockingIds?.length) data.compatibilities = data.compatibilities.filter(link => !item.blockingIds?.includes(link.id))
    let id = original?.id || nextId(); while (!original && used.has(id)) id = nextId(); used.add(id)
    origin.declarationId = id; origin.updatedAt = now; origin.state = 'managed'
    const link = linkFrom(origin, id, now, original?.createdAt)
    if (original) { data.compatibilities[data.compatibilities.findIndex(record => record.id === original.id)] = link; result.updated++ }
    else { data.compatibilities.push(link); result.added++ }
    if (existing) Object.assign(existing, origin)
    else (data.templateCompatibilityOrigins ||= []).push(origin)
  }
  return result
}

export function templateCompatibilityOriginProblems(data: AppData): string[] {
  const problems: string[] = [], origins = data.templateCompatibilityOrigins
  if (origins === undefined) {
    if (Array.isArray(data.compatibilities) && data.compatibilities.some(link => link?.provenance?.kind === 'template')) problems.push('模板声明缺少逐条来源基线，不能作为无来源声明恢复。')
    return problems
  }
  if (!Array.isArray(origins)) return ['模板声明来源必须是数组。']
  const keys = new Set<string>()
  for (const origin of origins) {
    if (!origin || typeof origin !== 'object' || !origin.target || !['sku', 'material'].includes(origin.target.kind) || typeof origin.target.id !== 'string' || !origin.target.id || ![origin.key, origin.modelId, origin.sourceVersionId, origin.identityKey, origin.sourceStamp, origin.updatedAt].every(value => typeof value === 'string') || !origin.key || !Array.isArray(origin.ruleIds) || !origin.ruleIds.length || !origin.ruleIds.every(value => typeof value === 'string' && Boolean(value)) || !Array.isArray(origin.claimIds) || !origin.claimIds.length || !origin.claimIds.every(value => typeof value === 'string' && Boolean(value)) || !Array.isArray(origin.steps) || !origin.baseline || !['managed', 'modified', 'deleted', 'kept', 'stale', 'obsolete'].includes(origin.state)) { problems.push('模板声明来源结构无效。'); continue }
    if (keys.has(origin.key)) problems.push('模板声明来源身份重复。')
    keys.add(origin.key)
    if (origin.declarationId !== undefined && typeof origin.declarationId !== 'string') problems.push('模板声明关联身份无效。')
    const baseline = origin.baseline, host = baseline.host
    if (!host || !['model', 'planning'].includes(host.scope) || ![host.productTypeId, host.productModelId, host.identityKey].every(value => typeof value === 'string' && Boolean(value)) || !Array.isArray(host.steps) || !host.steps.length || host.steps.some(step => !step || ![step.attributeId, step.attributeName, step.valueId].every(value => typeof value === 'string')) || host.scope === 'planning' && !host.planningId || !['compatible', 'conditional', 'incompatible'].includes(baseline.conclusion) || !['confirmed', 'pending'].includes(baseline.verification) || !['basic', 'fast-charge', 'other'].includes(baseline.capability) || ![baseline.id, baseline.source, baseline.note].every(value => typeof value === 'string') || !Array.isArray(baseline.conditions) || baseline.conditions.some(condition => conditionProblem(condition))) problems.push('模板来源声明基线结构无效。')
    if (baseline.conclusion === 'conditional' && !baseline.conditions?.length) problems.push('模板来源基线缺少必要条件。')
    if (origin.steps.some(step => !step || ![step.valueNodeId, step.attributeNodeId, step.attributeId, step.attributeName, step.valueId].every(value => typeof value === 'string') || !['common', 'variant'].includes(step.role) || !['node', 'scheme'].includes(step.roleSource) || step.parentValueNodeId !== null && typeof step.parentValueNodeId !== 'string')) problems.push('模板来源规格快照结构无效。')
    if (origin.lineage !== undefined && (!Array.isArray(origin.lineage) || origin.lineage.some(pair => !pair || typeof pair.ruleId !== 'string' || typeof pair.claimId !== 'string'))) problems.push('模板声明逐条来源身份无效。')
  }
  const byKey = new Map(origins.filter(origin => origin && typeof origin === 'object').map(origin => [origin.key, origin]))
  for (const link of Array.isArray(data.compatibilities) ? data.compatibilities : []) {
    if (link?.provenance?.kind !== 'template') continue
    const source = link.provenance.template, origin = source && byKey.get(source.originKey)
    if (!origin?.target || origin.declarationId !== link.id || targetKey(origin.target) !== targetKey(linkTarget(link)) || origin.modelId !== source?.modelId) problems.push(`模板声明 ${link.id} 的逐条来源关联不一致。`)
  }
  return problems
}
