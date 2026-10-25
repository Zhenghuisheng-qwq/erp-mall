import { groupPathKey, resolveManualOrder, type GroupIdentityPart } from './productListManual'
import { categoryPath, projectAttrs, shelfOf, shelfText, statusText } from './logic'
import { familyBrandValues, familyListText, isRealSku, productTypeName, realSkusOf, savedSkuCode, savedSkuName, skuListText } from './productList'
import type { AppData, ListQuery, ProductFamily, ProductListMode, ProductListModeQuery, ProductListPageState, ProductListSavedView, ProductListSortMode, ProductListViewFilter, Sku } from './types'

export interface ProductListRecord {
  id: string
  family: ProductFamily
  sku?: Sku
}

export interface ProductListGroup {
  key: string
  label: string
  total: number
  rows: ProductListRecord[]
}

export interface ProductListPresentation {
  total: number
  page: number
  groups: ProductListGroup[]
  manualBlocked: boolean
  allIds: string[]
  groupKeys: Record<string, string>
  errors: string[]
}

const SPU_EXPOSED = ['category', 'brand', 'shelf']
const SKU_EXPOSED = ['category', 'brand', 'status']

export function emptyModeQuery(mode: ProductListMode): ProductListModeQuery {
  return {
    keyword: '',
    filters: [],
    exposed: mode === 'sku' ? [...SKU_EXPOSED] : [...SPU_EXPOSED],
    grouping: null,
    sorting: null,
    sortMode: 'default',
  }
}

export function sortModeOf(query: ProductListModeQuery): ProductListSortMode {
  if (query.sortMode === 'manual' || query.sortMode === 'field' || query.sortMode === 'default') return query.sortMode
  return query.sorting ? 'field' : 'default'
}

export function modeQuery(view: ProductListSavedView, mode: ProductListMode = view.mode): ProductListModeQuery {
  const current = mode === 'sku' ? view.skuQuery : view.spuQuery
  return current || emptyModeQuery(mode)
}

function textOf(value: unknown) {
  return String(value || '').trim()
}

function listOf(value: ProductListViewFilter['value']) {
  if (Array.isArray(value)) return value.map((item) => textOf(item)).filter(Boolean)
  if (value && typeof value === 'object') return []
  const text = textOf(value)
  return text ? [text] : []
}

function rangeOf(value: ProductListViewFilter['value']) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { from: '', to: '' }
  return { from: textOf(value.from), to: textOf(value.to) }
}

export function knownFilterFields(data: AppData, mode: ProductListMode) {
  const rows: { field: string; label: string; kind: 'text' | 'enum' | 'date' | 'attr' }[] = mode === 'sku'
    ? [
        { field: 'name', label: 'SKU 名称', kind: 'text' as const },
        { field: 'code', label: 'SKU 编号', kind: 'text' as const },
        { field: 'familyName', label: '所属商品', kind: 'text' as const },
        { field: 'category', label: '商品分类', kind: 'enum' as const },
        { field: 'brand', label: '品牌', kind: 'enum' as const },
        { field: 'productType', label: '产品类型', kind: 'enum' as const },
        { field: 'status', label: 'SKU 状态', kind: 'enum' as const },
        { field: 'created', label: '创建日期', kind: 'date' as const },
      ]
    : [
        { field: 'name', label: '商品名称', kind: 'text' as const },
        { field: 'oaProductId', label: 'OA_ProductID', kind: 'text' as const },
        { field: 'category', label: '商品分类', kind: 'enum' as const },
        { field: 'brand', label: '品牌', kind: 'enum' as const },
        { field: 'productType', label: '产品类型', kind: 'enum' as const },
        { field: 'shelf', label: '商品状态', kind: 'enum' as const },
        { field: 'status', label: '规格状态', kind: 'enum' as const },
        { field: 'created', label: '创建日期', kind: 'date' as const },
        { field: 'template', label: '属性方案', kind: 'enum' as const },
        { field: 'group', label: '商品组', kind: 'enum' as const },
      ]
  data.params.forEach((param) => rows.push({ field: `attr:${param.id}`, label: param.name, kind: 'attr' }))
  return rows
}

export function groupFields(data: AppData, mode: ProductListMode) {
  const rows = mode === 'sku'
    ? [
        { field: 'category', label: '商品分类' },
        { field: 'brand', label: '品牌' },
        { field: 'productType', label: '产品类型' },
        { field: 'status', label: 'SKU 状态' },
      ]
    : [
        { field: 'category', label: '商品分类' },
        { field: 'brand', label: '品牌' },
        { field: 'productType', label: '产品类型' },
        { field: 'shelf', label: '商品状态' },
      ]
  if (mode === 'sku') {
    data.params.forEach((param) => rows.push({ field: `attr:${param.id}`, label: param.name }))
    return rows
  }
  const commonNames = new Set(data.families.flatMap((family) => Object.keys(family.commonAttrs || {})))
  data.params.forEach((param) => {
    if (commonNames.has(param.name)) rows.push({ field: `attr:${param.id}`, label: param.name })
  })
  return rows
}

export function sortFields(mode: ProductListMode) {
  return mode === 'sku'
    ? [
        { field: 'name', label: 'SKU 名称' },
        { field: 'code', label: 'SKU 编号' },
        { field: 'created', label: '创建日期' },
        { field: 'status', label: 'SKU 状态' },
        { field: 'category', label: '商品分类' },
        { field: 'brand', label: '品牌' },
      ]
    : [
        { field: 'name', label: '商品名称' },
        { field: 'oaProductId', label: 'OA_ProductID' },
        { field: 'created', label: '创建日期' },
        { field: 'shelf', label: '商品状态' },
        { field: 'category', label: '商品分类' },
        { field: 'brand', label: '品牌' },
      ]
}

function createdDay(family: ProductFamily) {
  return (family.createdAt || family.updatedAt || '').slice(0, 10)
}

function attrName(data: AppData, field: string) {
  const id = field.slice('attr:'.length)
  return data.params.find((item) => item.id === id)?.name || ''
}

function valuesOf(data: AppData, record: ProductListRecord, field: string, grouping: boolean): string[] | null {
  const family = record.family
  const sku = record.sku
  if (field.startsWith('attr:')) {
    const name = attrName(data, field)
    if (!name) return null
    if (sku) {
      const value = projectAttrs(family, sku)[name] || ''
      return value ? [value] : []
    }
    if (grouping) {
      const value = family.commonAttrs[name] || ''
      return value ? [value] : []
    }
    const values = new Set<string>()
    if (family.commonAttrs[name]) values.add(family.commonAttrs[name])
    realSkusOf(data, family.id).forEach((item) => {
      const value = projectAttrs(family, item)[name]
      if (value) values.add(value)
    })
    return [...values]
  }
  if (field === 'name') return [sku ? savedSkuName(sku) : family.name]
  if (field === 'code') return sku ? [savedSkuCode(sku)] : null
  if (field === 'familyName') return [family.name]
  if (field === 'oaProductId') return [family.oaProductId || '']
  if (field === 'category') {
    const path = categoryPath(data, family.categoryId)
    const rows: string[] = []
    if (path) rows.push(path)
    if (family.categoryId) rows.push(family.categoryId)
    return rows
  }
  if (field === 'categoryId') return [family.categoryId]
  if (field === 'brand') return familyBrandValues(data, family)
  if (field === 'productType') return [productTypeName(data, family)]
  if (field === 'shelf') return [shelfText(shelfOf(family))]
  if (field === 'status') {
    if (sku) return [statusText(sku.status)]
    return realSkusOf(data, family.id).map((item) => statusText(item.status))
  }
  if (field === 'created') return [createdDay(family)]
  if (field === 'template') {
    const name = data.templates.find((item) => item.id === family.templateId)?.name || ''
    return name ? [name] : []
  }
  if (field === 'group') {
    return (family.productGroupIds || []).map((id) => data.productGroups.find((item) => item.id === id)?.name || '').filter(Boolean)
  }
  return null
}

function compareValue(data: AppData, record: ProductListRecord, field: string) {
  return (valuesOf(data, record, field, false) || []).filter(Boolean).join('、')
}

function matchFilter(data: AppData, record: ProductListRecord, filter: ProductListViewFilter) {
  if (filter.active === false) return true
  if (filter.field === 'category' && (filter.operator === 'eq' || filter.operator === 'in') && listOf(filter.value).length) {
    const values = listOf(filter.value), resolved = resolveCategoryFilter(data, filter.operator === 'eq' ? values.slice(0, 1) : values)
    return !resolved.missing.length && !resolved.ambiguous.length && resolved.ids.includes(record.family.categoryId)
  }
  if (filter.operator === 'descendants') {
    if (filter.field !== 'category') return false
    const roots = resolveCategoryFilter(data, listOf(filter.value))
    if (!roots.ids.length || roots.missing.length || roots.ambiguous.length) return false
    const byId = new Map(data.categories.map(category => [category.id, category]))
    const targets = new Set(roots.ids), seen = new Set<string>()
    let category = byId.get(record.family.categoryId)
    while (category && !seen.has(category.id)) { if (targets.has(category.id)) return true; seen.add(category.id); category = category.parentId ? byId.get(category.parentId) : undefined }
    return false
  }
  const values = valuesOf(data, record, filter.field, false)
  if (!values) return true
  const expected = listOf(filter.value)
  const range = rangeOf(filter.value)
  const day = values[0] || ''
  if (filter.operator === 'before') return Boolean(expected[0]) && day !== '' && day < expected[0]
  if (filter.operator === 'after') return Boolean(expected[0]) && day !== '' && day > expected[0]
  if (filter.operator === 'between') {
    if (!range.from && !range.to) return true
    if (!day) return false
    if (range.from && day < range.from) return false
    if (range.to && day > range.to) return false
    return true
  }
  if (!expected.length) return true
  const lower = values.map((item) => item.toLowerCase())
  const needles = expected.map((item) => item.toLowerCase())
  if (filter.operator === 'contains') return needles.some((needle) => lower.some((item) => item.includes(needle)))
  if (filter.operator === 'notContains') return needles.every((needle) => lower.every((item) => !item.includes(needle)))
  if (filter.operator === 'neq') return values.every((item) => item !== expected[0])
  if (filter.operator === 'in') return values.some((item) => expected.includes(item))
  return values.some((item) => item === expected[0])
}

function keywordMatch(data: AppData, record: ProductListRecord, keyword: string) {
  const text = keyword.trim().toLowerCase()
  if (!text) return true
  const source = record.sku ? `${record.family.name} ${categoryPath(data, record.family.categoryId)} ${familyBrandValues(data, record.family).join(' ')} ${skuListText(record.family, record.sku)}` : familyListText(data, record.family)
  return source.toLowerCase().includes(text)
}

function baseRecords(data: AppData, mode: ProductListMode): ProductListRecord[] {
  if (mode === 'sku') {
    return data.skus.flatMap((sku) => {
      if (!isRealSku(data, sku)) return []
      const family = data.families.find((item) => item.id === sku.familyId)
      if (!family) return []
      return [{ id: sku.id, family, sku }]
    }).sort((left, right) => {
      const leftTime = left.family.updatedAt || ''
      const rightTime = right.family.updatedAt || ''
      if (leftTime === rightTime) return left.id.localeCompare(right.id, 'zh')
      return leftTime < rightTime ? 1 : -1
    })
  }
  return data.families.map((family) => ({ id: family.id, family })).sort((left, right) => {
    if (left.family.updatedAt === right.family.updatedAt) return left.id.localeCompare(right.id, 'zh')
    return left.family.updatedAt < right.family.updatedAt ? 1 : -1
  })
}

function sortRecords(data: AppData, rows: ProductListRecord[], field: string, direction: 'asc' | 'desc') {
  const sign = direction === 'desc' ? -1 : 1
  return rows.slice().sort((left, right) => {
    const compared = compareValue(data, left, field).localeCompare(compareValue(data, right, field), 'zh')
    if (compared) return compared * sign
    return left.id.localeCompare(right.id, 'zh')
  })
}

function groupLabel(data: AppData, record: ProductListRecord, field: string) {
  if (field === 'brand') {
    const values = familyBrandValues(data, record.family)
    return values.length ? values.join('、') : '未记录'
  }
  const values = valuesOf(data, record, field, true) || []
  return values.map((item) => item.trim()).find(Boolean) || '未记录'
}
function productGroupPart(data: AppData, record: ProductListRecord, field: string): { identity: GroupIdentityPart; label: string } {
  let value: unknown = valuesOf(data, record, field, true)
  if (field === 'category') value = record.family.categoryId || null
  else if (field === 'productType') value = record.family.productTypeId || productTypeName(data, record.family) || null
  else if (field === 'shelf') value = shelfOf(record.family)
  else if (field === 'status' && record.sku) value = record.sku.status
  if (field.startsWith('attr:')) {
    const id = field.slice(5), name = attrName(data, field)
    const applicable = !!name && (Object.hasOwn(record.family.commonAttrs, name) || !!record.sku && Object.hasOwn(projectAttrs(record.family, record.sku), name) || data.templateParams.some(binding => binding.templateId === record.family.templateId && binding.paramId === id))
    if (!applicable) return { identity: { field, kind: 'not-applicable' }, label: '不适用' }
  }
  const absent = value === null || value === undefined || value === '' || Array.isArray(value) && !value.some(item => String(item).trim())
  return { identity: { field, kind: absent ? 'empty' : 'value', ...(absent ? {} : { value }) }, label: absent ? '未记录' : groupLabel(data, record, field) }
}

export function validateProductListModeQuery(data: AppData, query: ProductListModeQuery | undefined, mode: ProductListMode): string[] {
  if (!query || typeof query !== 'object' || typeof query.keyword !== 'string' || !Array.isArray(query.filters) || !Array.isArray(query.exposed)) return ['列表查询结构无效。']
  const errors: string[] = [], fields = new Set(knownFilterFields(data, mode).map(item => item.field)), ids = new Set<string>()
  const operators = new Set(['contains', 'notContains', 'eq', 'neq', 'in', 'before', 'after', 'between', 'descendants'])
  for (const filter of query.filters) {
    if (!filter || typeof filter !== 'object' || typeof filter.id !== 'string' || !filter.id || ids.has(filter.id)) { errors.push('筛选身份缺失或重复。'); continue }
    ids.add(filter.id)
    if (!fields.has(filter.field)) errors.push(`筛选字段失效：${filter.field}。`)
    if (!operators.has(filter.operator) || filter.operator === 'descendants' && filter.field !== 'category') errors.push(`筛选操作符不适用于该字段：${filter.field}。`)
    if (filter.active !== undefined && typeof filter.active !== 'boolean') errors.push('筛选启用状态无效。')
    const value = filter.value
    if (typeof value !== 'string' && !(Array.isArray(value) && value.every(item => typeof item === 'string')) && !(value && typeof value === 'object' && !Array.isArray(value) && (value.from === undefined || typeof value.from === 'string') && (value.to === undefined || typeof value.to === 'string'))) errors.push(`筛选值结构无效：${filter.field}。`)
    if (filter.field === 'category' && filter.active !== false && (filter.operator === 'descendants' || ['eq', 'in'].includes(filter.operator) && listOf(filter.value).length)) {
      const category = resolveCategoryFilter(data, listOf(filter.value))
      if (!category.ids.length || category.missing.length || category.ambiguous.length) errors.push('分类范围引用失效或旧分类路径不唯一，请按分类 ID 重新选择。')
    }
  }
  if (query.exposed.some(field => typeof field !== 'string' || !fields.has(field)) || new Set(query.exposed).size !== query.exposed.length) errors.push('已暴露筛选字段失效或重复。')
  if (query.sortMode !== undefined && !['default', 'field', 'manual'].includes(query.sortMode)) errors.push('排序模式无效。')
  for (const [order, allowed, title] of [[query.grouping, groupFields(data, mode), '分组'], [query.sorting, sortFields(mode), '排序']] as const) {
    if (order !== null && order !== undefined && (!order || typeof order !== 'object' || !allowed.some(item => item.field === order.field) || !['asc', 'desc'].includes(order.direction))) errors.push(`${title}字段或方向失效。`)
  }
  return [...new Set(errors)]
}
export function validateProductListPage(data: AppData, page: ProductListPageState, mode: ProductListMode, options: { validateConfigs?: boolean } = {}): string[] {
  if (!page || !Array.isArray(page.views) || !page.views.length || typeof page.activeId !== 'string' || !page.views.some(view => view?.id === page.activeId) || !Array.isArray(page.presets) || !page.query || typeof page.query !== 'object') return ['列表页面配置结构无效。']
  const errors: string[] = [], ids = new Set<string>()
  for (const view of page.views) {
    if (!view || typeof view !== 'object' || typeof view.id !== 'string' || !view.id || ids.has(view.id) || typeof view.name !== 'string' || !['spu', 'sku'].includes(view.mode)) { errors.push('视图身份、名称或模式无效。'); continue }
    ids.add(view.id)
    const query = mode === 'sku' ? view.skuQuery : view.spuQuery
    if (query && options.validateConfigs !== false) errors.push(...validateProductListModeQuery(data, query, mode))
    const columns = mode === 'sku' ? view.skuColumns : view.spuColumns
    if (!Array.isArray(columns) || columns.some(column => !column || typeof column.key !== 'string' || typeof column.visible !== 'boolean' || typeof column.order !== 'number' || column.width !== undefined && (!Number.isFinite(column.width) || column.width < 72 || column.width > 600) || column.frozen !== undefined && ![false, 'left', 'right'].includes(column.frozen))) errors.push('展示列结构、列宽或冻结配置无效。')
    for (const order of [view.manualOrder?.spuIds, view.manualOrder?.skuIds]) if (order !== undefined && (!Array.isArray(order) || order.some(id => typeof id !== 'string' || !id) || new Set(order).size !== order.length)) errors.push('手工顺序身份无效或重复。')
  }
  return [...new Set(errors)]
}

export function unfilteredIds(data: AppData, view: ProductListSavedView, mode: ProductListMode = view.mode) {
  const query = modeQuery(view, mode)
  let rows = baseRecords(data, mode)
  const sorting = query.sorting && sortFields(mode).some((item) => item.field === query.sorting?.field) ? query.sorting : null
  if (sortModeOf(query) === 'field' && sorting) rows = sortRecords(data, rows, sorting.field, sorting.direction)
  return rows.map((item) => item.id)
}

export function presentProductList(data: AppData, view: ProductListSavedView, page: number, pageSize: number): ProductListPresentation {
  const query = modeQuery(view, view.mode)
  const errors = validateProductListModeQuery(data, query, view.mode)
  if (errors.length) return { total: 0, page: 1, manualBlocked: false, allIds: [], groupKeys: {}, errors, groups: [{ key: 'all', label: '', total: 0, rows: [] }] }
  const allowedSort = new Set(sortFields(view.mode).map((item) => item.field))
  const allowedGroup = new Set(groupFields(data, view.mode).map((item) => item.field))
  let rows = baseRecords(data, view.mode).filter((record) => keywordMatch(data, record, query.keyword) && query.filters.every((filter) => matchFilter(data, record, filter)))
  const sorting = query.sorting && allowedSort.has(query.sorting.field) ? query.sorting : null
  const grouping = query.grouping && allowedGroup.has(query.grouping.field) ? query.grouping : null
  const sortMode = sortModeOf(query)
  const manualBlocked = false
  if (sortMode === 'manual') {
    const saved = view.mode === 'sku' ? view.manualOrder?.skuIds : view.manualOrder?.spuIds
    const order = resolveManualOrder(saved, baseRecords(data, view.mode).map((item) => item.id))
    const rank = new Map(order.map((id, index) => [id, index]))
    rows = rows.slice().sort((left, right) => (rank.get(left.id) ?? order.length) - (rank.get(right.id) ?? order.length) || left.id.localeCompare(right.id, 'zh'))
  } else if (sortMode === 'field' && sorting) rows = sortRecords(data, rows, sorting.field, sorting.direction)
  if (!grouping) {
    const size = pageSize > 0 ? pageSize : 10
    const pages = Math.max(1, Math.ceil(rows.length / size))
    const safe = Math.min(Math.max(1, Math.floor(page) || 1), pages)
    const start = (safe - 1) * size
    const pageRows = rows.slice(start, start + size)
    return { total: rows.length, page: safe, manualBlocked, allIds: rows.map(row => row.id), groupKeys: Object.fromEntries(rows.map(row => [row.id, 'all'])), errors, groups: [{ key: 'all', label: '', total: rows.length, rows: pageRows }] }
  }
  const buckets = new Map<string, { label: string; rows: ProductListRecord[] }>()
  const groupKeys: Record<string, string> = {}
  rows.forEach((record) => {
    const part = productGroupPart(data, record, grouping.field), key = groupPathKey([part.identity])
    const bucket = buckets.get(key) || { label: part.label, rows: [] }
    bucket.rows.push(record); buckets.set(key, bucket); groupKeys[record.id] = key
  })
  const sign = grouping.direction === 'desc' ? -1 : 1
  const ordered = [...buckets.entries()].sort((left, right) => left[1].label.localeCompare(right[1].label, 'zh') * sign || left[0].localeCompare(right[0], 'zh'))
  const flat = ordered.flatMap(([, bucket]) => bucket.rows)
  const totals = new Map(ordered.map(([key, bucket]) => [key, bucket.rows.length]))
  const size = pageSize > 0 ? pageSize : 10
  const pages = Math.max(1, Math.ceil(flat.length / size))
  const safe = Math.min(Math.max(1, Math.floor(page) || 1), pages)
  const slice = flat.slice((safe - 1) * size, safe * size)
  const groups: ProductListGroup[] = []
  slice.forEach((record) => {
    const key = groupKeys[record.id], label = buckets.get(key)!.label
    const last = groups[groups.length - 1]
    if (!last || last.key !== key) groups.push({ key, label, total: totals.get(key) || 0, rows: [record] })
    else last.rows.push(record)
  })
  if (!groups.length) groups.push({ key: 'empty', label: '', total: 0, rows: [] })
  return { total: flat.length, page: safe, manualBlocked, allIds: flat.map(row => row.id), groupKeys, errors, groups }
}

export function activeFilterCount(view: ProductListSavedView) {
  const query = modeQuery(view)
  const valued = query.filters.filter((filter) => filter.active !== false && (listOf(filter.value).length > 0 || rangeOf(filter.value).from || rangeOf(filter.value).to)).length
  return valued + (query.keyword.trim() ? 1 : 0)
}

export function resolveCategoryFilter(data: AppData, values: string[]) {
  const byId = new Set(data.categories.map((item) => item.id))
  const byPath = new Map<string, string[]>()
  data.categories.forEach((item) => { const path = categoryPath(data, item.id); byPath.set(path, [...byPath.get(path) || [], item.id]) })
  const ids: string[] = []
  const missing: string[] = []
  const ambiguous: string[] = []
  values.forEach((value) => {
    if (byId.has(value)) ids.push(value)
    else if (byPath.get(value)?.length === 1) ids.push(byPath.get(value)![0])
    else if (byPath.get(value)?.length) ambiguous.push(value)
    else if (value) missing.push(value)
  })
  return { ids: [...new Set(ids.filter(Boolean))], missing, ambiguous }
}

export function fieldSelection(query: ProductListModeQuery, field: string) {
  const filter = query.filters.find((item) => item.field === field && item.active !== false && (item.operator === 'eq' || item.operator === 'in' || item.field === 'category' && item.operator === 'descendants'))
  if (!filter) return []
  return listOf(filter.value)
}

export function clearProductListFilterValue(query: ProductListModeQuery, filterId: string): ProductListModeQuery {
  const next = JSON.parse(JSON.stringify(query)) as ProductListModeQuery
  const filter = next.filters.find(item => item.id === filterId)
  if (filter) { filter.value = Array.isArray(filter.value) ? [] : filter.value && typeof filter.value === 'object' ? { from: '', to: '' } : ''; filter.active = false }
  return next
}
export function setProductListFilterValue(query: ProductListModeQuery, filterId: string, value: ProductListViewFilter['value']): ProductListModeQuery {
  const next = JSON.parse(JSON.stringify(query)) as ProductListModeQuery
  const filter = next.filters.find(item => item.id === filterId)
  if (filter) { filter.value = Array.isArray(value) ? [...value] : typeof value === 'object' ? { ...value } : value; filter.active = true }
  return next
}
export function productCategorySelection(data: AppData, query: ProductListModeQuery) {
  const rules = query.filters.filter(filter => filter.field === 'category')
  const supported = rules.length <= 1 && rules.every(filter => ['eq', 'in', 'descendants'].includes(filter.operator))
  const rule = supported ? rules[0] : undefined
  const resolved = resolveCategoryFilter(data, rule && rule.active !== false ? listOf(rule.value) : [])
  return { supported: supported && !resolved.missing.length && !resolved.ambiguous.length, rule, ...resolved }
}
export function updateProductCategorySelection(data: AppData, query: ProductListModeQuery, ids: string[]): ProductListModeQuery | undefined {
  const selected = productCategorySelection(data, query), roots = [...new Set(ids)]
  if (!selected.supported || roots.some(id => !data.categories.some(category => category.id === id))) return undefined
  const next = JSON.parse(JSON.stringify(query)) as ProductListModeQuery
  if (selected.rule) {
    const rule = next.filters.find(filter => filter.id === selected.rule!.id)!
    rule.value = roots; rule.active = roots.length > 0
    if (roots.length) rule.operator = 'descendants'
  } else if (roots.length) {
    let id = 'category-quick', suffix = 1
    while (next.filters.some(filter => filter.id === id)) id = `category-quick-${suffix++}`
    next.filters.push({ id, field: 'category', operator: 'descendants', value: roots })
  }
  return next
}

export function listQueryFromMode(query: ProductListModeQuery, pageSize = 10): ListQuery {
  const filters = query.filters
  const one = (field: string) => {
    const found = filters.find((item) => item.field === field && item.operator === 'eq')
    return found ? listOf(found.value)[0] || '' : ''
  }
  const created = filters.find((item) => item.field === 'created' && item.operator === 'between')
  const range = created ? rangeOf(created.value) : { from: '', to: '' }
  const attrFilters: Record<string, string> = {}
  filters.forEach((filter) => {
    if (!filter.field.startsWith('attr:') || filter.operator !== 'eq') return
    const name = filter.field
    const value = listOf(filter.value)[0]
    if (value) attrFilters[name] = value
  })
  const statusTextValue = one('status')
  const status = statusTextValue === '在售' ? 'on_sale' : statusTextValue === '停售' ? 'off_sale' : statusTextValue === '草稿' ? 'draft' : ''
  const shelfTextValue = one('shelf')
  const shelf = shelfTextValue === '已发布' ? 'online' : shelfTextValue === '已下架' ? 'offline' : shelfTextValue === '草稿' ? 'draft' : ''
  return {
    keyword: query.keyword,
    categoryId: '',
    brand: one('brand'),
    status: status as ListQuery['status'],
    templateId: '',
    productGroupId: '',
    attrFilters,
    createdFrom: range.from,
    createdTo: range.to,
    shelf: shelf as ListQuery['shelf'],
    page: 1,
    pageSize,
    sortProp: 'updatedAt',
    sortOrder: 'descending',
  }
}

export function filtersFromListQuery(data: AppData, query: ListQuery): { keyword: string; filters: ProductListViewFilter[] } {
  const filters: ProductListViewFilter[] = []
  const push = (field: string, operator: ProductListViewFilter['operator'], value: ProductListViewFilter['value']) => {
    filters.push({ id: `preset-${field}-${filters.length}`, field, operator, value })
  }
  if (query.categoryId) {
    const path = categoryPath(data, query.categoryId)
    if (path) push('category', 'eq', path)
  }
  if (query.brand) push('brand', 'eq', query.brand)
  if (query.shelf) push('shelf', 'eq', shelfText(query.shelf))
  if (query.status) push('status', 'eq', statusText(query.status))
  if (query.templateId) {
    const name = data.templates.find((item) => item.id === query.templateId)?.name || ''
    if (name) push('template', 'eq', name)
  }
  if (query.productGroupId) {
    const name = data.productGroups.find((item) => item.id === query.productGroupId)?.name || ''
    if (name) push('group', 'eq', name)
  }
  if (query.createdFrom || query.createdTo) push('created', 'between', { from: query.createdFrom || '', to: query.createdTo || '' })
  Object.entries(query.attrFilters || {}).forEach(([name, value]) => {
    if (!value) return
    const param = data.params.find((item) => item.name === name)
    if (!param) return
    push(`attr:${param.id}`, 'eq', value)
  })
  return { keyword: query.keyword || '', filters }
}

export function writePresetFilters(view: ProductListSavedView, data: AppData, preset: { keyword?: string; viewFilters?: ProductListViewFilter[]; query: ListQuery }, now = '') {
  const mode = view.mode === 'sku' ? 'sku' : 'spu'
  const next = mode === 'sku' ? (view.skuQuery = view.skuQuery || emptyModeQuery('sku')) : (view.spuQuery = view.spuQuery || emptyModeQuery('spu'))
  if (preset.viewFilters) {
    next.keyword = preset.keyword || ''
    next.filters = preset.viewFilters.map((item) => ({ ...item, value: Array.isArray(item.value) ? [...item.value] : item.value && typeof item.value === 'object' ? { ...item.value } : item.value }))
  } else {
    const converted = filtersFromListQuery(data, preset.query)
    next.keyword = converted.keyword
    next.filters = converted.filters
  }
  view.updatedAt = now || new Date().toISOString()
}
