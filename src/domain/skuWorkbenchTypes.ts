import type { CategoryFilterLayout, ProductListModeQuery } from './types'

export type SkuOperator = 'contains' | 'notContains' | 'eq' | 'neq' | 'startsWith' | 'in' | 'notIn' | 'hasAny' | 'hasAll' | 'empty' | 'notEmpty' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'before' | 'after' | 'relative' | 'descendants'
export type SkuValue = string | number | boolean | string[] | { from: string; to: string } | null
export interface SkuCondition { kind: 'rule'; id: string; field: string; operator: SkuOperator; value: SkuValue }
export interface SkuConditionGroup { kind: 'group'; id: string; logic: 'all' | 'any'; children: (SkuCondition | SkuConditionGroup)[] }
export interface SkuColumn { key: string; visible: boolean; width?: number; frozen?: 'left' | 'right' | false }
export interface SkuOrder { field: string; direction: 'asc' | 'desc' }
export type SkuQuickFilterRef = { source: 'condition'; ruleId: string } | { source: 'legacy'; filterId: string }
export interface SkuViewConfig {
  quickFilters?: SkuQuickFilterRef[]
  version: 1
  conditions: SkuConditionGroup
  /** Original query semantics, including saved keyword. New rules intersect it. */
  legacy?: ProductListModeQuery
  columns: SkuColumn[]
  sorts: SkuOrder[]
  groups: SkuOrder[]
  density: 'comfortable' | 'compact'
  manualOrder: string[]
  sortMode: 'default' | 'field' | 'manual'
  categoryLayout: CategoryFilterLayout
  /** Attribute IDs stay stable while legacy business attributes use name keys. */
  attributeNames?: Record<string, string[]>
}
export interface SkuWorkbenchState {
  version: 1
  activeId: string
  defaultId: string
  favorites: string[]
  order: string[]
  working: Record<string, SkuViewConfig>
  /** Completed preset migrations survive deletion of the generated view. */
  migratedPresetIds?: string[]
}
export type SkuFieldType = 'text' | 'enum' | 'multi' | 'number' | 'date' | 'boolean' | 'spu' | 'category'
export interface SkuField {
  id: string
  label: string
  source: string
  type: SkuFieldType
  sortable: boolean
  groupable: boolean
  options: { value: string; label: string }[]
}
export interface SkuFieldValue { applicable: boolean; value: string | number | boolean | string[] | null }
