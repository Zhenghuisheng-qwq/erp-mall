import type { knownFilterFields } from '../../domain/productListQuery'
import type { ProductListFilterOperator, ProductListModeQuery, ProductListViewFilter } from '../../domain/types'

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
  valueKind?: 'text' | 'array' | 'range'
}

export function filterOperators(kind: FilterField['kind'], field?: string): [OperatorOption, ...OperatorOption[]] {
  if (field === 'category') return [{ value: 'descendants', label: '包含下级' }, { value: 'eq', label: '等于' }, { value: 'neq', label: '不等于' }, { value: 'in', label: '属于任一' }]
  if (kind === 'date') return [{ value: 'before', label: '早于' }, { value: 'after', label: '晚于' }, { value: 'between', label: '日期范围' }]
  if (kind === 'text') return [{ value: 'contains', label: '包含' }, { value: 'notContains', label: '不包含' }, { value: 'eq', label: '等于' }, { value: 'neq', label: '不等于' }]
  return [{ value: 'eq', label: '等于' }, { value: 'neq', label: '不等于' }, { value: 'in', label: '属于任一' }]
}

export function conditionRange(filter: ProductListViewFilter): [string, string] | null {
  if (!filter.value || typeof filter.value !== 'object' || Array.isArray(filter.value)) return null
  if (!filter.value.from && !filter.value.to) return null
  return [filter.value.from || '', filter.value.to || '']
}

/** A shortcut may edit exactly one representable condition, never collapse AND into OR. */
export function quickFilterState(query: ProductListModeQuery, field: FilterField) {
  const filters = query.filters.filter(item => item.field === field.field)
  const filter = filters[0]
  const simple = filters.length === 0 || (filters.length === 1 && filter !== undefined && (
    field.kind === 'date' ? filter.operator === 'between' && typeof filter.value === 'object' && !Array.isArray(filter.value) && filter.value !== null || ['before','after'].includes(filter.operator) && typeof filter.value === 'string'
      : field.kind === 'text' ? ['contains','notContains','eq','neq'].includes(filter.operator) && typeof filter.value === 'string'
        : ['eq','neq'].includes(filter.operator) && typeof filter.value === 'string' || ['in','descendants'].includes(filter.operator) && Array.isArray(filter.value)
  ))
  return { simple, filter }
}

/** Only valued predicates appear, except empty before/after which really reject every row. */
export function filterSummaries(query: ProductListModeQuery, fields: FilterField[], categoryLabel: (value: string) => string) {
  const rows: { id: string; label: string }[] = []
  if (query.keyword.trim()) rows.push({ id: '$keyword', label: `关键词「${query.keyword.trim()}」` })
  for (const filter of query.filters) {
    if (filter.active === false) continue
    const field = fields.find(item => item.field === filter.field)
    if (!field) continue // The query engine ignores unavailable fields too.
    const values = (Array.isArray(filter.value) ? filter.value : typeof filter.value === 'string' ? [filter.value] : []).map(value => value.trim()).filter(Boolean)
    const range = conditionRange(filter)?.map(value => value.trim())
    let text: string
    if (filter.operator === 'between') {
      if (!range || !range.some(Boolean)) continue
      text = `${range[0] || '不限开始'} 至 ${range[1] || '不限结束'}（含边界）`
    } else {
      if (!values.length && filter.operator !== 'before' && filter.operator !== 'after') continue
      const shown = ['eq', 'neq', 'before', 'after'].includes(filter.operator) ? values.slice(0, 1) : values
      text = shown.map(value => `「${field.field === 'category' ? categoryLabel(value) : value}」`).join(filter.operator === 'notContains' ? ' 且 ' : ' 或 ')
      if (!text) text = '未填写日期（无匹配结果）'
    }
    const operators: Record<ProductListFilterOperator, string> = { eq: '等于', neq: '不等于', in: '属于任一', descendants: '包含下级', contains: '包含', notContains: '不包含', before: '早于', after: '晚于', between: '范围' }
    rows.push({ id: filter.id, label: `${field.label} ${operators[filter.operator]} ${text}` })
  }
  return rows
}
