import { dedupeIds, insertManualIds, moveManualId, resolveManualOrder } from './productListManual'
import { cloneSku, repairSkuConfig } from './skuWorkbenchState'
import { emptyModeQuery, groupFields, knownFilterFields, sortFields, unfilteredIds, writePresetFilters } from './productListQuery'
import type { AppData, CategoryFilterLayout, ColumnPref, ListView, ProductListColumnConfig, ProductListFieldOrder, ProductListMode, ProductListModeQuery, ProductListSavedView, ProductListSortMode, ProductListViewFilter } from './types'

export const DEFAULT_PRODUCT_LIST_VIEW_ID = 'view-default'

interface ColumnField {
  key: string
  label: string
  required?: boolean
  defaultVisible: boolean
}

/** 只收录商品列表已经能展示的字段。不编造商品编码之类的新数据。 */
const SPU_FIELDS: ColumnField[] = [
  { key: 'shelf', label: '商品状态', defaultVisible: true },
  { key: 'name', label: '商品名称', required: true, defaultVisible: true },
  { key: 'category', label: '商品分类', defaultVisible: true },
  { key: 'template', label: '属性方案', defaultVisible: false },
  { key: 'brand', label: '品牌', defaultVisible: true },
  { key: 'skuCount', label: 'SKU 数量', defaultVisible: true },
  { key: 'sale', label: '在售', defaultVisible: true },
  { key: 'oaProductId', label: 'OA_ProductID', defaultVisible: true },
  { key: 'origin', label: '数据来源', defaultVisible: true },
  { key: 'updatedAt', label: '最近维护', defaultVisible: true },
  { key: 'productType', label: '产品类型', defaultVisible: true },
  { key: 'model', label: '商品模型', defaultVisible: true },
]

const SKU_FIELDS: ColumnField[] = [
  { key: 'code', label: 'SKU 编号', defaultVisible: true },
  { key: 'name', label: 'SKU 名称', required: true, defaultVisible: true },
  { key: 'spec', label: '完整规格', defaultVisible: true },
  { key: 'family', label: '所属 SPU', defaultVisible: true },
  { key: 'category', label: '商品分类', defaultVisible: true },
  { key: 'typeName', label: '产品类型', defaultVisible: true },
  { key: 'status', label: 'SKU 状态', defaultVisible: true },
  { key: 'updatedAt', label: '最近维护', defaultVisible: true },
]

export function columnFields(mode: ProductListMode) {
  return mode === 'sku' ? SKU_FIELDS : SPU_FIELDS
}

export function columnLabel(mode: ProductListMode, key: string) {
  return columnFields(mode).find((item) => item.key === key)?.label || ''
}

function columnsFromLegacy(legacy: ColumnPref[] | undefined, mode: ProductListMode): ProductListColumnConfig[] {
  const catalog = columnFields(mode)
  const known = new Set(catalog.map((item) => item.key))
  const rows: ProductListColumnConfig[] = []
  const used = new Set<string>()
  if (mode === 'spu') {
    rows.push({ key: 'shelf', visible: true, order: 0 })
    used.add('shelf')
  }
  ;(legacy || []).forEach((item) => {
    if (!known.has(item.key) || used.has(item.key)) return
    rows.push({ key: item.key, visible: item.visible !== false, order: rows.length })
    used.add(item.key)
  })
  catalog.forEach((item) => {
    if (used.has(item.key)) return
    rows.push({ key: item.key, visible: item.defaultVisible, order: rows.length })
  })
  return repairColumns(rows, mode)
}

export function repairColumns(raw: unknown, mode: ProductListMode): ProductListColumnConfig[] {
  const catalog = columnFields(mode)
  const known = new Set(catalog.map((item) => item.key))
  const required = new Set(catalog.filter((item) => item.required).map((item) => item.key))
  const incoming = Array.isArray(raw) ? raw : []
  const seen = new Set<string>()
  const kept: ProductListColumnConfig[] = []
  const unknown: ProductListColumnConfig[] = []
  incoming.forEach((item) => {
    if (!item || typeof item !== 'object') return
    const key = String((item as { key?: unknown }).key || '')
    if (!key || seen.has(key)) return
    seen.add(key)
    const visible = (item as { visible?: unknown }).visible !== false
    const metadata = item as { width?: unknown; frozen?: unknown }
    const extra: Pick<ProductListColumnConfig, 'width' | 'frozen'> = { ...(typeof metadata.width === 'number' && Number.isFinite(metadata.width) ? { width: Math.max(72, Math.min(600, metadata.width)) } : {}), ...(metadata.frozen === 'left' || metadata.frozen === 'right' || metadata.frozen === false ? { frozen: metadata.frozen } : {}) }
    if (known.has(key)) kept.push({ key, visible: required.has(key) ? true : visible, order: kept.length, ...extra })
    else unknown.push({ key, visible, order: 0, ...extra })
  })
  catalog.forEach((item) => {
    if (seen.has(item.key)) return
    kept.push({ key: item.key, visible: required.has(item.key) ? true : item.defaultVisible, order: kept.length })
  })
  return [...kept, ...unknown].map((item, index) => ({ ...item, order: index }))
}

export function buildDefaultView(mode: ProductListMode, legacyColumns: ColumnPref[] | undefined, now: string): ProductListSavedView {
  const safeMode: ProductListMode = mode === 'sku' ? 'sku' : 'spu'
  return {
    id: DEFAULT_PRODUCT_LIST_VIEW_ID,
    name: '默认视图',
    mode: safeMode,
    spuColumns: columnsFromLegacy(legacyColumns, 'spu'),
    skuColumns: columnsFromLegacy(undefined, 'sku'),
    spuQuery: emptyModeQuery('spu'),
    skuQuery: emptyModeQuery('sku'),
    manualOrder: { spuIds: [], skuIds: [] },
    categoryFilterLayout: 'popover',
    createdAt: now,
    updatedAt: now,
  }
}

function viewStamp(view: ProductListSavedView) {
  return JSON.stringify({
    name: view.name,
    mode: view.mode,
    spuColumns: view.spuColumns,
    skuColumns: view.skuColumns,
    spuQuery: view.spuQuery,
    skuQuery: view.skuQuery,
    manualOrder: view.manualOrder,
    categoryFilterLayout: view.categoryFilterLayout,
    skuWorkbench: view.skuWorkbench,
  })
}

function repairModeQuery(raw: ProductListModeQuery | undefined, mode: ProductListMode, data: AppData): ProductListModeQuery {
  const base = emptyModeQuery(mode)
  const query = raw || base
  const fields = new Set(knownFilterFields(data, mode).map((item) => item.field))
  const groups = new Set(groupFields(data, mode).map((item) => item.field))
  const sorts = new Set(sortFields(mode).map((item) => item.field))
  const filters = Array.isArray(query.filters) ? query.filters.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const field = String(item.field || '')
    const operator = item.operator
    if (!field || !operator) return []
    const value = Array.isArray(item.value) ? [...item.value] : item.value && typeof item.value === 'object' ? { ...item.value } : item.value
    return [{ id: String(item.id || `f-${field}`), field, operator, value }]
  }) : []
  const order = (value: ProductListFieldOrder | null | undefined, allowed: Set<string>) => {
    if (!value || !allowed.has(value.field)) return null
    return { field: value.field, direction: value.direction === 'desc' ? 'desc' as const : 'asc' as const }
  }
  return {
    keyword: String(query.keyword || ''),
    filters,
    exposed: Array.isArray(query.exposed) ? query.exposed.filter((field) => fields.has(field)) : base.exposed,
    grouping: order(query.grouping, groups),
    sorting: order(query.sorting, sorts),
    sortMode: query.sortMode === 'manual' || query.sortMode === 'field' || query.sortMode === 'default' ? query.sortMode : query.sorting ? 'field' : 'default',
  }
}

function repairView(view: ProductListSavedView, data: AppData): boolean {
  const before = viewStamp(view)
  const name = view.name.trim()
  view.name = view.id === DEFAULT_PRODUCT_LIST_VIEW_ID ? (name || '默认视图') : (name || '未命名视图')
  view.mode = view.mode === 'sku' ? 'sku' : 'spu'
  view.spuColumns = repairColumns(view.spuColumns, 'spu')
  view.skuColumns = repairColumns(view.skuColumns, 'sku')
  view.spuQuery = repairModeQuery(view.spuQuery, 'spu', data)
  view.skuQuery = repairModeQuery(view.skuQuery, 'sku', data)
  if (view.skuWorkbench) view.skuWorkbench = repairSkuConfig(view.skuWorkbench, data)
  view.manualOrder = { spuIds: dedupeIds(view.manualOrder?.spuIds), skuIds: dedupeIds(view.manualOrder?.skuIds) }
  view.categoryFilterLayout = view.categoryFilterLayout === 'sidebar' || view.categoryFilterLayout === 'hidden' ? view.categoryFilterLayout : 'popover'
  if (!view.createdAt) view.createdAt = view.updatedAt || ''
  if (!view.updatedAt) view.updatedAt = view.createdAt
  return viewStamp(view) !== before
}

/**
 * 只在还没有展示视图时，用旧的 productListMode 和列设置生成默认视图。
 * 已经有视图时，不根据 productListMode 改用户当前选中的视图。
 */
export function ensureProductListViews(data: AppData, now = ''): boolean {
  let changed = false
  if (!Array.isArray(data.productListViews)) {
    data.productListViews = []
    changed = true
  }
  const defaults = data.productListViews.filter((item) => item.id === DEFAULT_PRODUCT_LIST_VIEW_ID)
  if (defaults.length > 1) {
    let seen = false
    data.productListViews = data.productListViews.filter((item) => {
      if (item.id !== DEFAULT_PRODUCT_LIST_VIEW_ID) return true
      if (seen) return false
      seen = true
      return true
    })
    changed = true
  }
  if (!data.productListViews.some((item) => item.id === DEFAULT_PRODUCT_LIST_VIEW_ID)) {
    const legacyMode: ProductListMode = data.productListViews.length === 0 && data.productListMode === 'sku' ? 'sku' : 'spu'
    const stamp = now || new Date().toISOString()
    data.productListViews.unshift(buildDefaultView(legacyMode, data.columns, stamp))
    changed = true
  }
  data.productListViews.forEach((view) => {
    if (repairView(view, data)) changed = true
  })
  if (!data.productListViews.some((item) => item.id === data.activeProductListViewId)) {
    data.activeProductListViewId = DEFAULT_PRODUCT_LIST_VIEW_ID
    changed = true
  }
  const active = data.productListViews.find((item) => item.id === data.activeProductListViewId) || data.productListViews[0]
  if (active && data.productListMode !== active.mode) {
    data.productListMode = active.mode
    changed = true
  }
  return changed
}

export function activeProductListView(data: AppData): ProductListSavedView {
  const views = data.productListViews || []
  return views.find((item) => item.id === data.activeProductListViewId)
    || views.find((item) => item.id === DEFAULT_PRODUCT_LIST_VIEW_ID)
    || views[0]
    || buildDefaultView('spu', data.columns, '')
}

export function visibleColumns(view: ProductListSavedView, mode: ProductListMode) {
  const catalog = new Map(columnFields(mode).map((item) => [item.key, item.label]))
  const source = mode === 'sku' ? view.skuColumns : view.spuColumns
  return [...source]
    .filter((item) => item.visible && catalog.has(item.key))
    .sort((a, b) => a.order - b.order || a.key.localeCompare(b.key))
    .map((item) => ({ key: item.key, label: catalog.get(item.key) || item.key }))
}

export function orderedColumns(view: ProductListSavedView, mode: ProductListMode) {
  const catalog = new Map(columnFields(mode).map((item) => [item.key, item]))
  const source = mode === 'sku' ? view.skuColumns : view.spuColumns
  return [...source]
    .filter((item) => catalog.has(item.key))
    .sort((a, b) => a.order - b.order || a.key.localeCompare(b.key))
    .map((item) => ({ ...item, label: catalog.get(item.key)?.label || item.key, required: Boolean(catalog.get(item.key)?.required) }))
}

function touch(view: ProductListSavedView, now: string) {
  view.updatedAt = now || new Date().toISOString()
}

function findView(data: AppData, id: string) {
  return (data.productListViews || []).find((item) => item.id === id)
}

function taken(data: AppData, name: string, exceptId = '') {
  const text = name.trim()
  return (data.productListViews || []).some((item) => item.id !== exceptId && item.name === text)
}

export function selectProductListView(data: AppData, id: string): { ok: true } | { ok: false; message: string } {
  const view = findView(data, id)
  if (!view) return { ok: false, message: '找不到这个视图。' }
  data.activeProductListViewId = view.id
  data.productListMode = view.mode
  return { ok: true }
}

export function setProductListViewMode(data: AppData, id: string, mode: ProductListMode, now = ''): { ok: true } | { ok: false; message: string } {
  const view = findView(data, id)
  if (!view) return { ok: false, message: '找不到这个视图。' }
  if (mode !== 'spu' && mode !== 'sku') return { ok: false, message: '视图模式无效。' }
  if (view.mode === mode) {
    data.productListMode = mode
    return { ok: true }
  }
  view.mode = mode
  touch(view, now)
  if (data.activeProductListViewId === view.id) data.productListMode = mode
  return { ok: true }
}

export function setProductListColumnVisible(data: AppData, id: string, mode: ProductListMode, key: string, visible: boolean, now = ''): { ok: true } | { ok: false; message: string } {
  const view = findView(data, id)
  if (!view) return { ok: false, message: '找不到这个视图。' }
  const field = columnFields(mode).find((item) => item.key === key)
  if (!field) return { ok: false, message: '这个字段不能配置。' }
  if (field.required && !visible) return { ok: false, message: mode === 'sku' ? 'SKU 名称需要保留，方便识别每一条规格。' : '商品名称需要保留，方便识别每一行。' }
  const columns = mode === 'sku' ? view.skuColumns : view.spuColumns
  const column = columns.find((item) => item.key === key)
  if (!column) return { ok: false, message: '这个字段不能配置。' }
  column.visible = visible
  touch(view, now)
  return { ok: true }
}

export function reorderProductListColumn(data: AppData, id: string, mode: ProductListMode, fromKey: string, toKey: string, now = ''): { ok: true } | { ok: false; message: string } {
  const view = findView(data, id)
  if (!view) return { ok: false, message: '找不到这个视图。' }
  if (fromKey === toKey) return { ok: true }
  const known = new Set(columnFields(mode).map((item) => item.key))
  if (!known.has(fromKey) || !known.has(toKey)) return { ok: false, message: '这个字段不能调整顺序。' }
  const columns = mode === 'sku' ? view.skuColumns : view.spuColumns
  const sorted = [...columns].sort((a, b) => a.order - b.order || a.key.localeCompare(b.key))
  const from = sorted.findIndex((item) => item.key === fromKey)
  const to = sorted.findIndex((item) => item.key === toKey)
  if (from < 0 || to < 0) return { ok: false, message: '这个字段不能调整顺序。' }
  const [moved] = sorted.splice(from, 1)
  sorted.splice(to, 0, moved)
  const next = sorted.map((item, index) => ({ ...item, order: index }))
  if (mode === 'sku') view.skuColumns = next
  else view.spuColumns = next
  touch(view, now)
  return { ok: true }
}

export function resetProductListColumns(data: AppData, id: string, mode: ProductListMode, legacyColumns: ColumnPref[] | undefined, now = ''): { ok: true } | { ok: false; message: string } {
  const view = findView(data, id)
  if (!view) return { ok: false, message: '找不到这个视图。' }
  if (mode === 'sku') view.skuColumns = columnsFromLegacy(undefined, 'sku')
  else view.spuColumns = columnsFromLegacy(legacyColumns, 'spu')
  touch(view, now)
  return { ok: true }
}

export function createProductListView(data: AppData, name: string, sourceId: string, nextId: () => string, now = ''): { ok: true; id: string } | { ok: false; message: string } {
  const text = name.trim()
  if (!text) return { ok: false, message: '请填写视图名称。' }
  if (taken(data, text)) return { ok: false, message: '已经有同名视图。' }
  const source = findView(data, sourceId) || activeProductListView(data)
  const stamp = now || new Date().toISOString()
  const view: ProductListSavedView = {
    id: nextId(),
    name: text,
    mode: source.mode,
    spuColumns: source.spuColumns.map((item) => ({ ...item })),
    skuColumns: source.skuColumns.map((item) => ({ ...item })),
    spuQuery: repairModeQuery(source.spuQuery, 'spu', data),
    skuQuery: repairModeQuery(source.skuQuery, 'sku', data),
    manualOrder: { spuIds: dedupeIds(source.manualOrder?.spuIds), skuIds: dedupeIds(source.manualOrder?.skuIds) },
    categoryFilterLayout: source.categoryFilterLayout === 'sidebar' || source.categoryFilterLayout === 'hidden' ? source.categoryFilterLayout : 'popover',
    createdAt: stamp,
    updatedAt: stamp,
    ...(source.skuWorkbench ? { skuWorkbench: cloneSku(source.skuWorkbench) } : {}),
  }
  data.productListViews = data.productListViews || []
  data.productListViews.push(view)
  data.activeProductListViewId = view.id
  data.productListMode = view.mode
  return { ok: true, id: view.id }
}

export function renameProductListView(data: AppData, id: string, name: string, now = ''): { ok: true } | { ok: false; message: string } {
  const view = findView(data, id)
  if (!view) return { ok: false, message: '找不到这个视图。' }
  const text = name.trim()
  if (!text) return { ok: false, message: '请填写视图名称。' }
  if (taken(data, text, id)) return { ok: false, message: '已经有同名视图。' }
  if (view.name === text) return { ok: true }
  view.name = text
  touch(view, now)
  return { ok: true }
}

export function copyProductListView(data: AppData, id: string, nextId: () => string, now = ''): { ok: true; id: string } | { ok: false; message: string } {
  const source = findView(data, id)
  if (!source) return { ok: false, message: '找不到这个视图。' }
  let name = `${source.name} 副本`
  let index = 2
  while (taken(data, name)) {
    name = `${source.name} 副本${index}`
    index += 1
  }
  return createProductListView(data, name, source.id, nextId, now)
}

export function currentModeQuery(view: ProductListSavedView) {
  return view.mode === 'sku' ? (view.skuQuery || emptyModeQuery('sku')) : (view.spuQuery || emptyModeQuery('spu'))
}

export function setViewKeyword(data: AppData, keyword: string, now = '') {
  const view = activeProductListView(data)
  const query = currentModeQuery(view)
  if (view.mode === 'sku') view.skuQuery = query
  else view.spuQuery = query
  query.keyword = keyword
  view.updatedAt = now || new Date().toISOString()
  data.listQuery.page = 1
}

export function setViewFieldValues(data: AppData, field: string, values: string[], now = '') {
  const view = activeProductListView(data)
  const query = currentModeQuery(view)
  if (view.mode === 'sku') view.skuQuery = query
  else view.spuQuery = query
  const rest = query.filters.filter((item) => !(item.field === field && (item.operator === 'eq' || item.operator === 'in')))
  const next = values.map((item) => item.trim()).filter(Boolean)
  query.filters = next.length
    ? [...rest, { id: `f-${field}`, field, operator: next.length > 1 ? 'in' : 'eq', value: next.length > 1 ? next : next[0] }]
    : rest
  view.updatedAt = now || new Date().toISOString()
  data.listQuery.page = 1
}

export function replaceViewFilters(data: AppData, filters: ProductListViewFilter[], now = '') {
  const view = activeProductListView(data)
  const query = currentModeQuery(view)
  if (view.mode === 'sku') view.skuQuery = query
  else view.spuQuery = query
  query.filters = filters
  view.updatedAt = now || new Date().toISOString()
  data.listQuery.page = 1
}

export function setViewExposed(data: AppData, field: string, exposed: boolean, now = '') {
  const view = activeProductListView(data)
  const query = currentModeQuery(view)
  if (view.mode === 'sku') view.skuQuery = query
  else view.spuQuery = query
  const has = query.exposed.includes(field)
  if (exposed && !has) query.exposed = [...query.exposed, field]
  if (!exposed && has) query.exposed = query.exposed.filter((item) => item !== field)
  view.updatedAt = now || new Date().toISOString()
}

export function setViewGrouping(data: AppData, grouping: ProductListFieldOrder | null, now = '') {
  const view = activeProductListView(data)
  const query = currentModeQuery(view)
  if (view.mode === 'sku') view.skuQuery = query
  else view.spuQuery = query
  query.grouping = grouping
  view.updatedAt = now || new Date().toISOString()
  data.listQuery.page = 1
}

export function setViewSorting(data: AppData, sorting: ProductListFieldOrder | null, now = '') {
  const view = activeProductListView(data)
  const query = currentModeQuery(view)
  if (view.mode === 'sku') view.skuQuery = query
  else view.spuQuery = query
  query.sorting = sorting
  query.sortMode = sorting ? 'field' : 'default'
  view.updatedAt = now || new Date().toISOString()
  data.listQuery.page = 1
}

function orderKey(view: ProductListSavedView) {
  return view.mode === 'sku' ? 'skuIds' as const : 'spuIds' as const
}

function currentOrder(data: AppData, view: ProductListSavedView) {
  const saved = view.manualOrder?.[orderKey(view)]
  return resolveManualOrder(saved, unfilteredIds(data, view, view.mode))
}

export function setViewCategoryLayout(data: AppData, layout: CategoryFilterLayout, now = '') {
  const view = activeProductListView(data)
  view.categoryFilterLayout = layout === 'sidebar' || layout === 'hidden' ? layout : 'popover'
  view.updatedAt = now || new Date().toISOString()
}

export function setViewSortMode(data: AppData, sortMode: ProductListSortMode, now = ''): { ok: true } | { ok: false; message: string } {
  const view = activeProductListView(data)
  const query = currentModeQuery(view)
  if (view.mode === 'sku') view.skuQuery = query
  else view.spuQuery = query
  if (sortMode === 'manual' && query.grouping) return { ok: false, message: '请先清除分组，再使用手工排序。分组设置会保留。' }
  if (sortMode === 'manual') {
    if (!view.manualOrder) view.manualOrder = { spuIds: [], skuIds: [] }
    const key = orderKey(view)
    if (!view.manualOrder[key].length) view.manualOrder[key] = unfilteredIds(data, view, view.mode)
  }
  query.sortMode = sortMode
  view.updatedAt = now || new Date().toISOString()
  data.listQuery.page = 1
  return { ok: true }
}

export function moveViewManual(data: AppData, dragId: string, targetId: string, place: 'before' | 'after' = 'before', now = ''): { ok: true } | { ok: false; message: string } {
  const view = activeProductListView(data)
  const query = currentModeQuery(view)
  if (query.sortMode !== 'manual') return { ok: false, message: '请先切换到手工排序。' }
  if (query.grouping) return { ok: false, message: '请先清除分组，再调整手工顺序。' }
  const result = moveManualId(currentOrder(data, view), dragId, targetId, place)
  if (!result.ok) return result
  if (!view.manualOrder) view.manualOrder = { spuIds: [], skuIds: [] }
  view.manualOrder[orderKey(view)] = result.order
  view.updatedAt = now || new Date().toISOString()
  return { ok: true }
}

export function insertViewManual(data: AppData, staged: string[], targetId: string, place: 'before' | 'after', now = ''): { ok: true } | { ok: false; message: string } {
  const view = activeProductListView(data)
  const query = currentModeQuery(view)
  if (query.sortMode !== 'manual') return { ok: false, message: '请先切换到手工排序。' }
  if (query.grouping) return { ok: false, message: '请先清除分组，再调整手工顺序。' }
  const result = insertManualIds(currentOrder(data, view), staged, targetId, place)
  if (!result.ok) return result
  if (!view.manualOrder) view.manualOrder = { spuIds: [], skuIds: [] }
  view.manualOrder[orderKey(view)] = result.order
  view.updatedAt = now || new Date().toISOString()
  return { ok: true }
}

export function applyPresetToActiveView(data: AppData, preset: Pick<ListView, 'query' | 'keyword' | 'viewFilters'>, now = '') {
  writePresetFilters(activeProductListView(data), data, preset, now)
  data.listQuery.page = 1
}

export function deleteProductListView(data: AppData, id: string): { ok: true; nextId: string } | { ok: false; message: string } {
  if (id === DEFAULT_PRODUCT_LIST_VIEW_ID) return { ok: false, message: '默认视图不能删除。' }
  const views = data.productListViews || []
  if (!views.some((item) => item.id === id)) return { ok: false, message: '找不到这个视图。' }
  if (views.length <= 1) return { ok: false, message: '至少保留一个视图。' }
  data.productListViews = views.filter((item) => item.id !== id)
  if (data.activeProductListViewId === id) {
    data.activeProductListViewId = DEFAULT_PRODUCT_LIST_VIEW_ID
    const next = findView(data, DEFAULT_PRODUCT_LIST_VIEW_ID)
    if (next) data.productListMode = next.mode
  }
  return { ok: true, nextId: data.activeProductListViewId || DEFAULT_PRODUCT_LIST_VIEW_ID }
}
