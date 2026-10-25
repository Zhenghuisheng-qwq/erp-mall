import type { SkuCondition, SkuConditionGroup, SkuViewConfig } from './skuWorkbenchTypes'
import { cloneSku } from './skuWorkbenchState'
import { repairQuickFilters } from './skuQuickFilters'

export function skuCategorySelection(config: SkuViewConfig) {
  const root = config.conditions
  const rules = root.children.filter((node): node is SkuCondition => node.kind === 'rule' && node.field === 'category')
  const hasCategory = (node: SkuCondition | SkuConditionGroup): boolean => node.kind === 'rule' ? node.field === 'category' : node.children.some(hasCategory)
  const supported = root.logic === 'all' && !root.children.some(node => node.kind === 'group' && hasCategory(node))
    && !config.legacy?.filters.some(rule => rule.field === 'category') && rules.length <= 1
    && rules.every(rule => ['eq', 'in', 'descendants'].includes(rule.operator))
  const rule = supported ? rules[0] : undefined
  const ids = rule && rule.active !== false ? (Array.isArray(rule.value) ? rule.value.filter((id): id is string => typeof id === 'string') : typeof rule.value === 'string' ? [rule.value] : []) : []
  return { supported, rule, ids: [...new Set(ids)] }
}
/** A shortcut edit changes only the recognized category rule, retaining its quick-filter identity. */
export function updateSkuCategorySelection(config: SkuViewConfig, ids: string[]) {
  const selection = skuCategorySelection(config)
  if (!selection.supported) return undefined
  const next = cloneSku(config), roots = [...new Set(ids)]
  if (selection.rule) {
    const rule = next.conditions.children.find(node => node.id === selection.rule!.id) as SkuCondition
    if (roots.length) rule.operator = 'descendants'
    rule.value = roots; rule.active = roots.length > 0
  } else if (roots.length) {
    const used = new Set([next.conditions.id, ...next.conditions.children.map(node => node.id)])
    let id = 'category-quick', suffix = 1
    while (used.has(id)) id = `category-quick-${suffix++}`
    next.conditions.children.push({ kind: 'rule', id, field: 'category', operator: 'descendants', value: roots })
  }
  next.quickFilters = repairQuickFilters(next)
  return next
}
