import type { BenefitGoodsLine, BenefitGroupRule, BenefitIssue, BenefitPackageDraft, BenefitSelectionGroup } from './benefitPackageTypes'

export const benefitCompositionVersion = (draft: Pick<BenefitPackageDraft, 'compositionVersion'>) => draft.compositionVersion ?? 1
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown): value is string => typeof value === 'string' && !!value.trim()
export function benefitPositionStructureIssues(draft: BenefitPackageDraft): BenefitIssue[] {
  const issues: BenefitIssue[] = [], version = benefitCompositionVersion(draft)
  const add = (message: string, positionId?: string) => issues.push({ code: 'position-structure', message, positionId, severity: 'error', structural: true })
  if (version !== 1 && version !== 2) { add(`不支持的组成版本 ${version}，原文保留，不能执行。`); return issues }
  if (!Array.isArray(draft.goods)) { add('商品位置必须为数组。'); return issues }
  const ids = new Set<string>(), identities = new Set<string>()
  for (const line of draft.goods) {
    if (!object(line) || !text(line.id) || !text(line.skuId) || !object(line.snapshot) || line.snapshot.skuId !== line.skuId || !(['code', 'name', 'familyId', 'familyName', 'spec', 'productTypeId', 'typeName', 'status'] as const).every(key => typeof line.snapshot[key] === 'string')) { add('商品位置及名称快照结构无效。'); continue }
    if (ids.has(line.id)) add('商品位置 ID 重复。', line.id)
    ids.add(line.id)
    if (version === 2 && (!(line.groupId === null || text(line.groupId)) || !['host', 'item'].includes(String(line.role)) || line.role === 'host' && line.groupId !== null)) add('新组成位置必须明确所属组及主机／商品身份；主机位置不能归配件组。', line.id)
    const identity = version === 2 ? JSON.stringify([line.groupId, line.role, line.skuId]) : line.skuId
    if (identities.has(identity)) add(version === 2 ? '同一组的同一 SKU 存在重复位置，请明确合并数量。' : '旧明细同一 SKU 不能重复。', line.id)
    identities.add(identity)
  }
  if (version === 2 && draft.goods.filter(line => line?.role === 'host').length > 1) add('只能有一个明确的主机实物位置。')
  return issues
}
export function benefitGroupRuleStructureIssues(raw: unknown): BenefitIssue[] {
  if (raw === undefined) return []
  if (!Array.isArray(raw)) return [{ code: 'group-rule-structure', message: '组间规则必须为数组。', severity: 'error', structural: true }]
  const ids = new Set<string>(), issues: BenefitIssue[] = []
  for (const value of raw) {
    if (!object(value) || !['id', 'kind', 'sourceGroupId', 'targetGroupId'].every(key => text(value[key])) || typeof value.enabled !== 'boolean' || typeof value.note !== 'string') { issues.push({ code: 'group-rule-structure', message: '组间规则记录结构无效。', severity: 'error', structural: true }); continue }
    if (ids.has(value.id as string)) issues.push({ code: 'group-rule-structure', ruleId: value.id as string, message: '组间规则 ID 重复。', severity: 'error', structural: true })
    ids.add(value.id as string)
  }
  return issues
}
export function benefitGroupRuleIssues(groups: BenefitSelectionGroup[], rules: BenefitGroupRule[] = [], selected?: ReadonlyMap<string, number>): BenefitIssue[] {
  const structure = benefitGroupRuleStructureIssues(rules)
  if (structure.length) return structure
  const issues: BenefitIssue[] = [], byId = new Map(groups.map(group => [group.id, group])), seen = new Set<string>()
  const add = (rule: BenefitGroupRule, message: string, code = 'group-rule', structural = false, groupId = rule.targetGroupId) => issues.push({ code, ruleId: rule.id, groupId, message, severity: 'error', structural })
  for (const rule of rules) {
    if (!['requires', 'excludes'].includes(rule.kind)) { add(rule, `不支持的规则类型「${rule.kind}」，原文保留，不能执行。`, 'group-rule-unsupported', true); continue }
    if (rule.sourceGroupId === rule.targetGroupId) add(rule, '组间规则不能引用自身。')
    const identity = JSON.stringify([rule.kind, ...(rule.kind === 'excludes' ? [rule.sourceGroupId, rule.targetGroupId].sort() : [rule.sourceGroupId, rule.targetGroupId])])
    if (seen.has(identity)) add(rule, '组间规则重复；互斥的 A/B 与 B/A 为同一规则。')
    seen.add(identity)
    if (rule.enabled && (!byId.get(rule.sourceGroupId)?.enabled || !byId.get(rule.targetGroupId)?.enabled)) add(rule, '启用的规则引用了已删除或停用的选配组。')
  }
  const active = rules.filter(rule => rule.enabled && ['requires', 'excludes'].includes(rule.kind)), dependencies = new Map<string, string[]>()
  for (const rule of active.filter(rule => rule.kind === 'requires')) dependencies.set(rule.sourceGroupId, [...dependencies.get(rule.sourceGroupId) || [], rule.targetGroupId])
  for (const trigger of groups.filter(group => group.enabled)) {
    const closure = new Set<string>(), pending = [trigger.id]
    while (pending.length) { const id = pending.pop()!; if (closure.has(id)) continue; closure.add(id); pending.push(...dependencies.get(id) || []) }
    for (const rule of active.filter(rule => rule.kind === 'excludes')) if (closure.has(rule.sourceGroupId) && closure.has(rule.targetGroupId)) add(rule, `选择「${trigger.name}」会同时要求依赖与互斥组，规则明显矛盾。`, 'group-rule-contradiction')
  }
  if (selected) for (const rule of active) {
    const source = selected.get(rule.sourceGroupId) || 0, target = selected.get(rule.targetGroupId) || 0
    if (rule.kind === 'requires' && source > 0 && target < 1) add(rule, `已选「${byId.get(rule.sourceGroupId)?.name || rule.sourceGroupId}」，需要补选「${byId.get(rule.targetGroupId)?.name || rule.targetGroupId}」。`, 'group-requires')
    if (rule.kind === 'excludes' && source > 0 && target > 0) add(rule, `「${byId.get(rule.sourceGroupId)?.name || rule.sourceGroupId}」与「${byId.get(rule.targetGroupId)?.name || rule.targetGroupId}」不能同时选配，请明确保留或移除。`, 'group-excludes')
  }
  return issues
}
export function benefitPositionKey(line: Pick<BenefitGoodsLine, 'skuId' | 'groupId' | 'role'>) { return JSON.stringify([line.groupId, line.role, line.skuId]) }
