import { conditionProblem } from './compatibilityValidation'
import { deviceHostKey, listDeviceModels, validateCompatibilityHost } from './deviceResolution'
import { legalPlanningCombinations, planningIdentityKey } from './planning'
import type { LegalCombination } from './planning'
import type { AppData, CompatibilityHost, PlanningStep, ProductSpecNode } from './types'
import type { EffectiveTemplateClaim, EffectiveTemplateCompatibility, TemplateCompatibilityClaim, TemplateCompatibilityConfig, TemplateCompatibilityException, TemplateCompatibilityIssue, TemplateCompatibilitySnapshot, TemplateSpecSelector, TemplateSpecTerm } from './templateCompatibilityTypes'

export const cloneTemplateCompatibility = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
function object(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) }
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (object(value)) return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`
  return JSON.stringify(value) ?? 'undefined'
}
export function createEmptyTemplateCompatibilityConfig(modelId: string): TemplateCompatibilityConfig {
  return { schemaVersion: 1, modelId, revision: 0, defaultRule: { id: `template-default:${modelId}`, configured: false, claims: [] }, exceptions: [], conversions: [], updatedAt: '' }
}
export function readTemplateCompatibilityConfig(data: AppData, modelId: string) {
  return Array.isArray(data.templateCompatibilityConfigs) ? data.templateCompatibilityConfigs.find(item => item?.modelId === modelId) : undefined
}

/** Display names and array order do not change a statement; conditions/notes/evidence do. */
export function templateClaimContentSignature(claim: TemplateCompatibilityClaim): string {
  const host = claim.host
  // Device directory hosts carry their display name in steps.valueId; the validated host identity
  // already captures real model attributes, so labels must not become another source identity.
  return stable({ host: { scope: host.scope, productTypeId: host.productTypeId, productModelId: host.productModelId, identityKey: host.identityKey, planningId: host.planningId || '' }, conclusion: claim.conclusion, verification: claim.verification, capability: claim.capability, conditions: claim.conditions.map(condition => condition.kind === 'attribute' && Array.isArray(condition.value) ? { ...condition, value: [...new Set(condition.value)].sort() } : condition).map(stable).sort(), source: claim.source, note: claim.note })
}
function claimSetSignature(claims: TemplateCompatibilityClaim[]) { return stable([...new Set(claims.map(templateClaimContentSignature))].sort()) }
/** Publishing compares content and stable lineage, but ignores edit timestamps/revision counters. */
export function templateCompatibilityContentSignature(input: TemplateCompatibilityConfig | TemplateCompatibilitySnapshot | undefined): string {
  const config = input && 'config' in input ? input.config : input
  if (!config) return 'unconfigured'
  if (configShapeProblem(config, config.modelId)) return stable({ invalid: config })
  if (!config.defaultRule.configured && !config.exceptions.length) return 'unconfigured'
  return stable({ schemaVersion: config.schemaVersion, modelId: config.modelId, defaultRule: { id: config.defaultRule.id, configured: config.defaultRule.configured, claims: config.defaultRule.claims.map(claim => [claim.id, templateClaimContentSignature(claim)]).sort((a, b) => stable(a).localeCompare(stable(b))) }, exceptions: config.exceptions.map(rule => ({ id: rule.id, name: rule.name, selector: rule.selector.anyOf.map(group => group.map(stable).sort()).sort((a, b) => stable(a).localeCompare(stable(b))), claims: rule.claims.map(claim => [claim.id, templateClaimContentSignature(claim)]).sort((a, b) => stable(a).localeCompare(stable(b))) })).sort((a, b) => a.id.localeCompare(b.id)), conversions: config.conversions.map(receipt => [receipt.legacyRuleId, receipt.nodeId, receipt.exceptionId]).sort((a, b) => stable(a).localeCompare(stable(b))) })
}
function configShapeProblem(value: unknown, modelId: string): string {
  if (!object(value) || value.schemaVersion !== 1 || value.modelId !== modelId || !Number.isInteger(value.revision) || Number(value.revision) < 0 || typeof value.updatedAt !== 'string' || !object(value.defaultRule) || typeof value.defaultRule.id !== 'string' || !value.defaultRule.id || typeof value.defaultRule.configured !== 'boolean' || !Array.isArray(value.defaultRule.claims) || !Array.isArray(value.exceptions) || !Array.isArray(value.conversions)) return '模型适用配置结构无效，请先检查导入数据。'
  if (value.defaultRule.configured === false && value.defaultRule.claims.length) return '尚未启用的默认配置不能包含已生效声明。'
  const ids = new Set([value.defaultRule.id])
  const allClaims: unknown[][] = [value.defaultRule.claims]
  for (const rule of value.exceptions) {
    if (!object(rule) || typeof rule.id !== 'string' || !rule.id || ids.has(rule.id) || typeof rule.name !== 'string' || !object(rule.selector) || !Array.isArray(rule.selector.anyOf) || !rule.selector.anyOf.length || !Array.isArray(rule.claims)) return '规格例外结构或规则标识无效。'
    ids.add(rule.id)
    allClaims.push(rule.claims)
    for (const group of rule.selector.anyOf) {
      if (!Array.isArray(group) || !group.length || group.some(term => !object(term) || !['attributeNodeId', 'attributeId', 'valueNodeId', 'valueId'].every(key => typeof term[key] === 'string' && Boolean(term[key])) || term.parentValueNodeId !== null && typeof term.parentValueNodeId !== 'string')) return '规格范围结构无效。'
    }
  }
  for (const claims of allClaims) {
    const claimIds = new Set<string>()
    for (const claim of claims) {
      const problem = claimShapeProblem(claim)
      if (problem) return problem
      if (!object(claim) || typeof claim.id !== 'string') return '声明结构无效。'
      if (claimIds.has(claim.id)) return '同一规则中声明标识重复。'
      claimIds.add(claim.id)
    }
  }
  const receipts = new Set<string>()
  for (const receipt of value.conversions) {
    if (!object(receipt) || typeof receipt.legacyRuleId !== 'string' || !receipt.legacyRuleId || receipts.has(receipt.legacyRuleId) || typeof receipt.nodeId !== 'string' || typeof receipt.exceptionId !== 'string' || typeof receipt.convertedAt !== 'string') return '旧节点转换记录无效。'
    receipts.add(receipt.legacyRuleId)
  }
  return ''
}
function claimShapeProblem(claim: unknown): string {
  if (!object(claim) || typeof claim.id !== 'string' || !claim.id || !object(claim.host)) return '适用声明或稳定标识无效。'
  const host = claim.host
  if (!['model', 'planning'].includes(String(host.scope)) || !['productTypeId', 'productModelId', 'identityKey'].every(key => typeof host[key] === 'string' && Boolean(host[key])) || !Array.isArray(host.steps) || !host.steps.length || host.steps.some(step => !object(step) || !['attributeId', 'attributeName', 'valueId'].every(key => typeof step[key] === 'string')) || host.planningId !== undefined && typeof host.planningId !== 'string') return '主机范围结构无效。'
  if (!['compatible', 'conditional', 'incompatible'].includes(String(claim.conclusion)) || !['confirmed', 'pending'].includes(String(claim.verification)) || !['basic', 'fast-charge', 'other'].includes(String(claim.capability)) || !Array.isArray(claim.conditions) || claim.conditions.some(condition => conditionProblem(condition)) || typeof claim.source !== 'string' || !claim.source.trim() || typeof claim.note !== 'string') return '兼容声明内容结构无效。'
  return ''
}
/** Structure-only import guard: missing legacy fields are valid; unknown fields are preserved by callers. */
export function templateCompatibilityImportProblems(data: unknown): string[] {
  if (!object(data)) return ['备份结构无效。']
  const problems: string[] = []
  if (data.templateCompatibilityConfigs !== undefined) {
    if (!Array.isArray(data.templateCompatibilityConfigs)) problems.push('模型适用配置必须为数组。')
    else {
      const models = new Set<string>()
      for (const config of data.templateCompatibilityConfigs) {
        const modelId = object(config) && typeof config.modelId === 'string' ? config.modelId : ''
        const problem = configShapeProblem(config, modelId)
        if (!modelId || problem) problems.push(problem || '模型标识无效。')
        else if (models.has(modelId)) problems.push(`模型 ${modelId} 的适用配置重复。`)
        models.add(modelId)
      }
    }
  }
  if (Array.isArray(data.specModelVersions)) for (const version of data.specModelVersions) {
    if (!object(version) || version.templateCompatibilitySnapshot === undefined) continue
    const problem = snapshotShapeProblem(version.templateCompatibilitySnapshot, typeof version.templateId === 'string' ? version.templateId : '')
    if (problem) problems.push(`版本 ${String(version.id)}：${problem}`)
  }
  return problems
}
function snapshotShapeProblem(snapshot: unknown, modelId: string): string {
  if (!object(snapshot) || snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.attributeRoles) || !Array.isArray(snapshot.attributeNames) || snapshot.attributeRoles.some(role => !object(role) || typeof role.attributeNodeId !== 'string' || !['COMMON', 'VARIANT'].includes(String(role.role)) || role.roleSource !== undefined && !['node', 'scheme'].includes(String(role.roleSource))) || snapshot.attributeNames.some(attribute => !object(attribute) || typeof attribute.attributeId !== 'string' || typeof attribute.name !== 'string')) return '发布版本兼容快照结构无效。'
  if (new Set(snapshot.attributeRoles.map(role => role.attributeNodeId)).size !== snapshot.attributeRoles.length || new Set(snapshot.attributeNames.map(attribute => attribute.attributeId)).size !== snapshot.attributeNames.length) return '发布版本兼容范围信息存在重复标识。'
  return configShapeProblem(snapshot.config, modelId)
}
function claimProblem(data: AppData, claim: TemplateCompatibilityClaim, hostOptions: ReturnType<typeof listDeviceModels>, attributes: Set<string>): string {
  if (!object(claim) || typeof claim.id !== 'string' || !claim.id || !object(claim.host)) return '适用声明或稳定标识无效。'
  const hostError = validateCompatibilityHost(data, claim.host, hostOptions)
  if (hostError) return hostError
  if (!['compatible', 'conditional', 'incompatible'].includes(claim.conclusion) || !['confirmed', 'pending'].includes(claim.verification) || !['basic', 'fast-charge', 'other'].includes(claim.capability)) return '兼容结论、核验状态或能力范围无效。'
  if (!Array.isArray(claim.conditions)) return '声明条件列表无效。'
  for (const condition of claim.conditions) {
    const error = conditionProblem(condition)
    if (error) return error
    if (condition.kind === 'attribute' && !attributes.has(condition.attributeId)) return '条件引用的设备属性已不存在。'
  }
  if (claim.conclusion === 'conditional' && !claim.conditions.length) return '有条件兼容必须填写使用条件。'
  if (typeof claim.source !== 'string' || !claim.source.trim()) return '请填写声明来源或依据。'
  if (typeof claim.note !== 'string') return '声明备注格式无效。'
  return ''
}
function termOf(step: PlanningStep): TemplateSpecTerm { return { attributeNodeId: step.attributeNodeId, attributeId: step.attributeId, valueNodeId: step.valueNodeId, valueId: step.valueId, parentValueNodeId: step.parentValueNodeId } }
function termKey(term: TemplateSpecTerm) { return stable([term.attributeNodeId, term.attributeId, term.valueNodeId, term.valueId, term.parentValueNodeId]) }
export function selectorForCombination(combination: LegalCombination): TemplateSpecSelector { return { anyOf: [combination.steps.map(termOf)] } }
interface PreparedRule {
  id: string
  claims: TemplateCompatibilityClaim[]
  signature: string
  issues: TemplateCompatibilityIssue[]
}
export interface TemplateCompatibilityContext {
  modelId: string
  versionId: string
  nodes: ProductSpecNode[]
  config: TemplateCompatibilityConfig
  sourceConfig?: TemplateCompatibilityConfig
  hostOptions: ReturnType<typeof listDeviceModels>
  combinations: LegalCombination[]
  byIdentity: Map<string, LegalCombination>
  byNode: Map<string, ProductSpecNode>
  issues: TemplateCompatibilityIssue[]
  rules: Map<string, PreparedRule>
  matches: Map<string, string[]>
  terms: Map<string, TemplateSpecTerm>
  rowsByValueNode: Map<string, Set<string>>
  stats: { combinationExpansions: number; selectorGroups: number; selectorIndexLookups: number; claimValidations: number; resolvedRows: number }
}
/** An operation-local context only. Never save it in a store or retain it across edits. */
export function createTemplateCompatibilityContext(data: AppData, input: { modelId: string; versionId?: string; config?: TemplateCompatibilityConfig }): TemplateCompatibilityContext {
  const { modelId } = input, versionId = input.versionId || ''
  const context: TemplateCompatibilityContext = { modelId, versionId, nodes: [], config: createEmptyTemplateCompatibilityConfig(modelId), hostOptions: [], combinations: [], byIdentity: new Map(), byNode: new Map(), issues: [], rules: new Map(), matches: new Map(), terms: new Map(), rowsByValueNode: new Map(), stats: { combinationExpansions: 0, selectorGroups: 0, selectorIndexLookups: 0, claimValidations: 0, resolvedRows: 0 } }
  const version = versionId ? data.specModelVersions.find(item => item.id === versionId && item.templateId === modelId) : undefined
  if (versionId && !version) { context.issues.push({ message: '指定发布版本不存在，不会使用当前草稿或其他版本。' }); return context }
  const snapshot = version?.templateCompatibilitySnapshot
  context.nodes = version ? version.nodesSnapshot : data.productSpecNodes.filter(node => node.templateId === modelId)
  if (versionId && snapshot !== undefined) { const problem = snapshotShapeProblem(snapshot, modelId); if (problem) { context.issues.push({ message: problem }); return context } }
  const configs = data.templateCompatibilityConfigs
  if (!versionId && configs !== undefined && !Array.isArray(configs)) context.issues.push({ message: '模型适用配置集合损坏，未使用空配置覆盖。' })
  if (!versionId && Array.isArray(configs) && configs.filter(item => item?.modelId === modelId).length > 1) context.issues.push({ message: '当前模型存在多份适用配置，请先处理重复数据。' })
  const config = versionId ? snapshot?.config : input.config || readTemplateCompatibilityConfig(data, modelId)
  context.sourceConfig = config
  if (config) {
    const shapeError = configShapeProblem(config, modelId)
    if (shapeError) context.issues.push({ message: shapeError })
    else context.config = config
  }
  const frozenRoles = new Map(snapshot?.attributeRoles.map(item => [item.attributeNodeId, item.role]) || [])
  if (snapshot && context.nodes.some(node => node.nodeType === 'ATTRIBUTE' && !frozenRoles.has(node.id))) { context.issues.push({ message: '发布快照缺少规格角色，不能使用当前属性方案补齐。' }); return context }
  const sourceNodes = snapshot ? context.nodes.map(node => node.nodeType === 'ATTRIBUTE' ? { ...node, role: frozenRoles.get(node.id) || node.role } : node) : context.nodes
  context.byNode = new Map(sourceNodes.map(node => [node.id, node]))
  context.stats.combinationExpansions++
  context.combinations = legalPlanningCombinations(data, modelId, sourceNodes)
  const frozenNames = new Map(snapshot?.attributeNames.map(item => [item.attributeId, item.name]) || [])
  const frozenRoleSources = new Map(snapshot?.attributeRoles.map(item => [item.attributeNodeId, item.roleSource]) || [])
  if (snapshot) context.combinations.forEach(combo => {
    combo.steps.forEach(step => { step.attributeName = frozenNames.get(step.attributeId) || step.attributeId; step.roleSource = frozenRoleSources.get(step.attributeNodeId) || step.roleSource })
    combo.label = combo.steps.map(step => `${step.attributeName} ${step.valueId}`.trim()).join(' · ')
  })
  for (const combo of context.combinations) {
    context.byIdentity.set(combo.identityKey, combo)
    for (const step of combo.steps) {
      context.terms.set(step.valueNodeId, termOf(step))
      const rows = context.rowsByValueNode.get(step.valueNodeId) || new Set<string>()
      rows.add(combo.identityKey); context.rowsByValueNode.set(step.valueNodeId, rows)
    }
  }
  // Keep structure available for repairing draft ranges, without letting invalid rules take effect.
  if (context.issues.length) return context
  const hosts = listDeviceModels(data), attributes = new Set(data.params.map(param => param.id))
  context.hostOptions = hosts
  function prepare(id: string, claims: TemplateCompatibilityClaim[]) {
    const issues: TemplateCompatibilityIssue[] = [], ids = new Set<string>()
    for (const claim of claims) {
      context.stats.claimValidations++
      const problem = claimProblem(data, claim, hosts, attributes)
      if (problem) issues.push({ ruleId: id, claimId: claim?.id, message: problem })
      else if (ids.has(claim.id)) issues.push({ ruleId: id, claimId: claim.id, message: '同一规则中声明标识重复。' })
      ids.add(claim?.id)
    }
    // Reject internally contradictory conclusions before they can create formal statements.
    const ranges = new Map<string, TemplateCompatibilityClaim[]>()
    for (const claim of claims) {
      if (issues.some(issue => issue.claimId === claim?.id)) continue
      const key = stable([deviceHostKey(claim.host), claim.host.scope, claim.host.planningId || '', claim.capability])
      const previous = ranges.get(key) || []
      if (previous.some(other => other.conclusion !== claim.conclusion && (other.conclusion === 'incompatible' || claim.conclusion === 'incompatible'))) issues.push({ ruleId: id, claimId: claim.id, message: '同一设备范围和能力存在相反结论。' })
      previous.push(claim); ranges.set(key, previous)
    }
    context.rules.set(id, { id, claims, signature: issues.length ? '' : claimSetSignature(claims), issues })
  }
  prepare(context.config.defaultRule.id, context.config.defaultRule.claims)
  for (const rule of context.config.exceptions) {
    prepare(rule.id, rule.claims)
    const scope = selectorMatches(context, rule.selector)
    if (scope.message) context.issues.push({ ruleId: rule.id, message: scope.message })
    else if (!scope.identities.size) context.issues.push({ ruleId: rule.id, message: '规格例外未命中当前版本的任何合法组合。' })
    else for (const identity of scope.identities) { const rules = context.matches.get(identity) || []; rules.push(rule.id); context.matches.set(identity, rules) }
  }
  return context
}
function selectorMatches(context: TemplateCompatibilityContext, selector: TemplateSpecSelector): { identities: Set<string>; message: string } {
  const identities = new Set<string>()
  for (const group of selector.anyOf) {
    context.stats.selectorGroups++
    if (!Array.isArray(group) || !group.length) return { identities, message: '规格例外必须明确选择实际规格范围，不能隐式覆盖全部模型。' }
    let matches: Set<string> | undefined
    for (const term of group) {
      if (!object(term) || typeof term.valueNodeId !== 'string' || !context.terms.has(term.valueNodeId) || termKey(context.terms.get(term.valueNodeId)!) !== termKey(term)) return { identities, message: '规格条件在当前版本无法准确解析，请重新选择范围。' }
      context.stats.selectorIndexLookups++
      const rows = context.rowsByValueNode.get(term.valueNodeId) || new Set<string>()
      matches = matches ? new Set([...matches].filter(identity => rows.has(identity))) : new Set(rows)
    }
    for (const identity of matches || []) identities.add(identity)
  }
  return { identities, message: '' }
}
export function selectorForNode(context: TemplateCompatibilityContext, nodeId: string): { selector?: TemplateSpecSelector; message: string; count: number } {
  const node = context.byNode.get(nodeId)
  if (!node) return { message: '来源节点不在当前实际规格中。', count: 0 }
  if (node.nodeType === 'VALUE') {
    const term = context.terms.get(nodeId)
    return term ? { selector: { anyOf: [[cloneTemplateCompatibility(term)]] }, message: '', count: context.rowsByValueNode.get(nodeId)?.size || 0 } : { message: '此节点未出现在合法组合中，无法证明作用范围。', count: 0 }
  }
  const terms = [...context.terms.values()].filter(term => term.attributeNodeId === nodeId)
  if (!terms.length) return { message: '此属性没有可证明的合法取值范围，请手动选择规格。', count: 0 }
  const selector = { anyOf: terms.map(term => [cloneTemplateCompatibility(term)]) }
  return { selector, message: '', count: selectorMatches(context, selector).identities.size }
}
function resultFor(combo?: LegalCombination): EffectiveTemplateCompatibility {
  return { state: 'unconfigured', origin: 'none', identityKey: combo?.identityKey || '', label: combo?.label || '', steps: combo?.steps || [], claims: [], ruleIds: [], issues: [], message: '尚未配置适用设备。' }
}
/** Preview, creation and synchronization all call this exact resolver. No ids or business writes. */
export function resolveTemplateCompatibility(context: TemplateCompatibilityContext, combination: LegalCombination | string): EffectiveTemplateCompatibility {
  context.stats.resolvedRows++
  const identity = typeof combination === 'string' ? combination : combination.identityKey
  const combo = context.byIdentity.get(identity), result = resultFor(combo)
  if (context.issues.length || !combo) return { ...result, state: 'invalid', issues: context.issues.length ? context.issues : [{ message: '规格不属于指定版本的完整合法组合。' }], message: context.issues[0]?.message || '规格不属于指定版本的完整合法组合。' }
  const matched = context.matches.get(identity) || []
  if (!matched.length && !context.config.defaultRule.configured) return result
  const ruleIds = matched.length ? matched : [context.config.defaultRule.id]
  result.ruleIds = ruleIds; result.origin = matched.length ? 'exception' : 'default'
  const rules = ruleIds.flatMap(id => { const rule = context.rules.get(id); return rule ? [rule] : [] })
  const issues = rules.flatMap(rule => rule.issues)
  if (issues.length) return { ...result, state: 'invalid', issues, message: issues[0]?.message || '适用配置引用无效。' }
  if (new Set(rules.map(rule => rule.signature)).size > 1) return { ...result, state: 'conflict', issues: ruleIds.map(ruleId => ({ ruleId, message: '同一规格命中不同的完整替代配置。' })), message: '多个规格例外的完整结果不同，请处理冲突。' }
  const claims = new Map<string, EffectiveTemplateClaim>()
  for (const rule of rules) for (const claim of rule.claims) {
    const key = templateClaimContentSignature(claim), previous = claims.get(key)
    if (previous) { if (!previous.ruleIds.includes(rule.id)) previous.ruleIds.push(rule.id); if (!previous.claimIds.includes(claim.id)) previous.claimIds.push(claim.id); previous.origins.push({ ruleId: rule.id, claimId: claim.id }) }
    else claims.set(key, { claim: cloneTemplateCompatibility(claim), ruleIds: [rule.id], claimIds: [claim.id], origins: [{ ruleId: rule.id, claimId: claim.id }] })
  }
  result.claims = [...claims.values()]; result.state = claims.size ? 'configured' : 'empty'
  result.message = claims.size ? result.origin === 'default' ? '使用模型默认配置。' : '使用规格单独配置。' : '该范围已明确设置为空，尚未配置适用设备，不代表不兼容。'
  return result
}
export function validateTemplateCompatibilityConfig(data: AppData, config: TemplateCompatibilityConfig, prepared?: TemplateCompatibilityContext): TemplateCompatibilityIssue[] {
  const context = prepared?.modelId === config.modelId && (prepared.config === config || prepared.sourceConfig === config) ? prepared : createTemplateCompatibilityContext(data, { modelId: config.modelId, config })
  return [...context.issues, ...[...context.rules.values()].flatMap(rule => rule.issues)]
}
export function freezeTemplateCompatibility(data: AppData, modelId: string): TemplateCompatibilitySnapshot {
  const nodes = data.productSpecNodes.filter(node => node.templateId === modelId)
  const attributeIds = new Set(nodes.map(node => node.attributeId))
  const roles = new Map<string, 'common' | 'variant'>(), names = new Map<string, string>()
  data.templateParams.forEach(binding => { if (binding.templateId === modelId && !roles.has(binding.paramId)) roles.set(binding.paramId, binding.role) })
  data.params.forEach(param => { if (attributeIds.has(param.id) && !names.has(param.id)) names.set(param.id, param.name) })
  return cloneTemplateCompatibility({ schemaVersion: 1 as const, config: readTemplateCompatibilityConfig(data, modelId) || createEmptyTemplateCompatibilityConfig(modelId), attributeRoles: nodes.filter(node => node.nodeType === 'ATTRIBUTE').map(node => { const explicit = node.role === 'COMMON' || node.role === 'VARIANT'; return { attributeNodeId: node.id, role: explicit ? node.role! : roles.get(node.attributeId) === 'common' ? 'COMMON' as const : 'VARIANT' as const, roleSource: explicit ? 'node' as const : 'scheme' as const } }), attributeNames: [...names].map(([attributeId, name]) => ({ attributeId, name })) })
}
/** Stable structural identity is the only cross-version mapping; no names/values-only fallback. */
export function mapTemplateCombination(source: TemplateCompatibilityContext, target: TemplateCompatibilityContext, input: { steps?: PlanningStep[]; sourceNodeIds?: string[]; identityKey?: string }): { state: 'resolved' | 'invalid'; combination?: LegalCombination; message: string } {
  if (source.modelId !== target.modelId || source.issues.length || target.issues.length) return { state: 'invalid', message: '来源或目标模型版本无效，未改动商品关系。' }
  let combos: LegalCombination[]
  if (input.steps?.length) {
    const identity = planningIdentityKey(input.steps)
    if (input.identityKey && input.identityKey !== identity) return { state: 'invalid', message: '来源身份与冻结规格不一致。' }
    combos = source.byIdentity.has(identity) ? [source.byIdentity.get(identity)!] : []
  } else if (input.identityKey) combos = source.byIdentity.has(input.identityKey) ? [source.byIdentity.get(input.identityKey)!] : []
  else if (input.sourceNodeIds?.length) {
    const nodes = new Set(input.sourceNodeIds)
    combos = source.combinations.filter(combo => combo.steps.length === nodes.size && combo.steps.every(step => nodes.has(step.valueNodeId)))
  } else return { state: 'invalid', message: '缺少可证明的冻结规格来源，不能按名称猜测。' }
  const combo = combos.length === 1 ? combos[0] : undefined, mapped = combo && target.byIdentity.get(combo.identityKey)
  if (!combo || !mapped) return { state: 'invalid', message: '目标版本缺少唯一相同的结构规格，原关系已保留，需人工处理。' }
  return { state: 'resolved', combination: mapped, message: '' }
}
export interface LegacyTemplateConversionItem {
  legacyRuleId: string
  nodeId: string
  nodeLabel: string
  hosts: CompatibilityHost[]
  selector?: TemplateSpecSelector
  count: number
  state: 'ready' | 'converted' | 'invalid'
  message: string
}
export function previewLegacyTemplateCompatibilityConversion(data: AppData, modelId: string, config = readTemplateCompatibilityConfig(data, modelId) || createEmptyTemplateCompatibilityConfig(modelId), prepared?: TemplateCompatibilityContext) {
  const context = prepared?.modelId === modelId && !prepared.versionId && (prepared.config === config || prepared.sourceConfig === config) ? prepared : createTemplateCompatibilityContext(data, { modelId, config }), items: LegacyTemplateConversionItem[] = []
  const hosts = context.hostOptions, legacy = Array.isArray(data.nodeCompatibilityRules) ? data.nodeCompatibilityRules.filter(rule => rule.templateId === modelId && !rule.modelVersionId) : []
  const receiptIds = new Set(config.conversions.map(receipt => receipt.legacyRuleId))
  for (const rule of legacy) {
    const scope = selectorForNode(context, rule.nodeId), node = context.byNode.get(rule.nodeId)
    const hostError = !Array.isArray(rule.hosts) || !rule.hosts.length ? '旧配置没有有效的设备声明。' : rule.hosts.map(host => validateCompatibilityHost(data, host, hosts)).find(Boolean) || ''
    const message = context.issues[0]?.message || scope.message || hostError
    items.push({ legacyRuleId: rule.id, nodeId: rule.nodeId, nodeLabel: node ? `${data.params.find(param => param.id === node.attributeId)?.name || node.attributeId} ${node.valueId}`.trim() : rule.nodeId, hosts: cloneTemplateCompatibility(rule.hosts), selector: scope.selector, count: scope.count, state: receiptIds.has(rule.id) ? 'converted' : message ? 'invalid' : 'ready', message: receiptIds.has(rule.id) ? '已转换，不会重复生成。' : message || '可转换为待确认规格例外；原节点配置保留。' })
  }
  return { items, config: cloneTemplateCompatibility(config) }
}
/** Returns a new draft only; the caller persists it atomically after user confirmation. */
export function applyLegacyTemplateCompatibilityConversion(data: AppData, modelId: string, sourceIds: string[], now: string, config = readTemplateCompatibilityConfig(data, modelId) || createEmptyTemplateCompatibilityConfig(modelId)): { ok: boolean; config: TemplateCompatibilityConfig; message: string; converted: number } {
  const preview = previewLegacyTemplateCompatibilityConversion(data, modelId, config), selected = new Set(sourceIds), byId = new Map(preview.items.map(item => [item.legacyRuleId, item]))
  if ([...selected].some(id => !byId.has(id) || byId.get(id)?.state === 'invalid')) return { ok: false, config: cloneTemplateCompatibility(config), message: '存在无法准确转换的旧配置，未写入任何规则。', converted: 0 }
  const next = preview.config
  let converted = 0
  for (const id of selected) {
    const item = byId.get(id)
    if (!item || item.state === 'converted' || !item.selector) continue
    const exceptionId = `legacy-exception:${modelId}:${id}`
    const rule: TemplateCompatibilityException = { id: exceptionId, name: `旧节点转换 · ${item.nodeLabel}`, selector: cloneTemplateCompatibility(item.selector), claims: item.hosts.map(host => ({ id: `legacy-claim:${id}:${encodeURIComponent(stable([host.scope, deviceHostKey(host), host.planningId || '']))}`, host: cloneTemplateCompatibility(host), conclusion: 'compatible', verification: 'pending', capability: 'basic', conditions: [], source: '旧节点适用元数据转换，尚无已确认兼容依据，待核验。', note: `来源节点 ${item.nodeId}；旧配置 ${id}。` })) }
    if (next.exceptions.some(existing => existing.id === exceptionId)) return { ok: false, config: cloneTemplateCompatibility(config), message: '转换来源标识冲突，未写入任何规则。', converted: 0 }
    next.exceptions.push(rule); next.conversions.push({ legacyRuleId: id, nodeId: item.nodeId, exceptionId, convertedAt: now }); converted++
  }
  if (converted) { next.revision++; next.updatedAt = now }
  return { ok: true, config: next, converted, message: converted ? `已转换 ${converted} 项，保存后生效；尚待确认，不回填历史商品。` : '没有新增转换，原记录保持。' }
}
