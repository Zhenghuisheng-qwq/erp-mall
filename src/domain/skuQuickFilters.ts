import type { SkuCondition, SkuConditionGroup, SkuQuickFilterRef, SkuViewConfig, SkuValue } from './skuWorkbenchTypes'

export function isSkuConditionActive(node: SkuCondition | SkuConditionGroup): boolean {
  return node.kind === 'rule' ? node.active !== false : node.children.some(isSkuConditionActive)
}
/** Exposed controls retain their identities and operators when cleared. */
export function setSkuQuickFilterValue(config: SkuViewConfig, ref: SkuQuickFilterRef, value: SkuValue): SkuViewConfig {
  const next = JSON.parse(JSON.stringify(config)) as SkuViewConfig
  if (ref.source === 'condition') {
    const rule = conditionEntries(next.conditions).find(item => item.rule.id === ref.ruleId)?.rule
    if (rule) { rule.value = value; rule.active = true }
  } else {
    const rule = next.legacy?.filters.find(item => item.id === ref.filterId)
    if (rule) { rule.value = value as typeof rule.value; rule.active = true }
  }
  return next
}
export function clearSkuQuickFilterValue(config: SkuViewConfig, ref: SkuQuickFilterRef): SkuViewConfig {
  const next = JSON.parse(JSON.stringify(config)) as SkuViewConfig
  if (ref.source === 'condition') {
    const rule = conditionEntries(next.conditions).find(item => item.rule.id === ref.ruleId)?.rule
    if (rule) { rule.value = Array.isArray(rule.value) ? [] : rule.value && typeof rule.value === 'object' ? { from: '', to: '' } : null; rule.active = false }
  } else {
    const rule = next.legacy?.filters.find(item => item.id === ref.filterId)
    if (rule) { rule.value = Array.isArray(rule.value) ? [] : rule.value && typeof rule.value === 'object' ? { from: '', to: '' } : ''; rule.active = false }
  }
  return next
}

export function quickFilterKey(ref: SkuQuickFilterRef) { return ref.source === 'condition' ? `condition:${ref.ruleId}` : `legacy:${ref.filterId}` }
export function conditionEntries(root: SkuConditionGroup): { rule: SkuCondition; context: string }[] {
  const label = (group: SkuConditionGroup) => group.logic === 'any' ? '任一满足' : '全部满足'
  const walk = (group: SkuConditionGroup, context: string): ReturnType<typeof conditionEntries> => group.children.flatMap((node, index) => node.kind === 'rule'
    ? [{ rule: node, context }] : walk(node, `${context} / 条件组 ${index + 1}（${label(node)}）`))
  return walk(root, `外层${label(root)}`)
}
/** Only presentation references are repaired; invalid business conditions remain diagnosable. */
export function repairQuickFilters(config: SkuViewConfig, raw: unknown = config.quickFilters): SkuQuickFilterRef[] {
  const rules = new Set(conditionEntries(config.conditions).map(item => item.rule.id))
  const legacy = new Set(config.legacy?.filters.map(item => item.id) || [])
  const candidates: unknown[] = Array.isArray(raw) ? raw : raw === undefined
    ? (config.legacy?.filters.filter(item => config.legacy?.exposed.includes(item.field)).map(item => ({ source: 'legacy', filterId: item.id })) || []) : []
  const seen = new Set<string>()
  return candidates.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const value = item as SkuQuickFilterRef
    const id = value.source === 'condition' ? value.ruleId : value.source === 'legacy' ? value.filterId : ''
    if (!id || !(value.source === 'condition' ? rules : legacy).has(id)) return []
    const key = quickFilterKey(value)
    if (seen.has(key)) return []
    seen.add(key)
    return [value.source === 'condition' ? { source: 'condition' as const, ruleId: id } : { source: 'legacy' as const, filterId: id }]
  })
}
export function setQuickFilter(config: SkuViewConfig, ref: SkuQuickFilterRef, shown: boolean) {
  const refs = repairQuickFilters(config).filter(item => quickFilterKey(item) !== quickFilterKey(ref))
  config.quickFilters = shown ? [...refs, ref] : refs
}
