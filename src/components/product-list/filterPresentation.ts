import type { knownFilterFields } from '../../domain/productListQuery'
import type { ProductListFilterOperator, ProductListViewFilter } from '../../domain/types'

export type FilterField = ReturnType<typeof knownFilterFields>[number]
type OperatorOption = { value: ProductListFilterOperator; label: string }

/** Read-only editor values; these are never stored in the business database. */
export interface FilterEditorRow {
  id: string
  field: string
  operator: ProductListFilterOperator
  kind: FilterField['kind']
  options: string[]
  operators: OperatorOption[]
  text: string
  values: string[]
  range: [string, string] | null
  categoryId: string
  categoryIds: string[]
}

export function filterOperators(kind: FilterField['kind']): [OperatorOption, ...OperatorOption[]] {
  if (kind === 'date') return [{ value: 'before', label: '早于' }, { value: 'after', label: '晚于' }, { value: 'between', label: '日期范围' }]
  if (kind === 'text') return [{ value: 'contains', label: '包含' }, { value: 'notContains', label: '不包含' }, { value: 'eq', label: '等于' }, { value: 'neq', label: '不等于' }]
  return [{ value: 'eq', label: '等于' }, { value: 'neq', label: '不等于' }, { value: 'in', label: '属于任一' }]
}

export function conditionRange(filter: ProductListViewFilter): [string, string] | null {
  if (!filter.value || typeof filter.value !== 'object' || Array.isArray(filter.value)) return null
  if (!filter.value.from && !filter.value.to) return null
  return [filter.value.from || '', filter.value.to || '']
}
