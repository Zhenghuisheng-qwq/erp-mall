import type { AppData, ProductListPageState, ProductListSavedView, ProductListFilterOperator, ProductListViewFilter } from './types'
import { filtersFromListQuery } from './productListQuery'
import type { SkuColumn, SkuCondition, SkuConditionGroup, SkuOperator, SkuViewConfig, SkuWorkbenchState } from './skuWorkbenchTypes'

export const SYSTEM_SKU_VIEW_ID = 'sku-system-all'
export type SkuCommandResult = { ok: true; id?: string } | { ok: false; message: string }
export const cloneSku = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value))

export function defaultSkuConfig(): SkuViewConfig {
  return {
    version: 1, conditions: { kind: 'group', id: 'root', logic: 'all', children: [] },
    columns: ['code', 'name', 'spec', 'familyId', 'category', 'status', 'updatedAt'].map(key => ({ key, visible: true })),
    sorts: [], groups: [], density: 'comfortable', manualOrder: [], sortMode: 'default', categoryLayout: 'popover',
  }
}

const fieldKey = (key: string) => key === 'family' ? 'familyId' : key === 'created' ? 'legacy.created' : key

/** Shape repair retains invalid rules/unknown field identities so validation can explain them. */
export function repairSkuConfig(raw: unknown, data?: AppData): SkuViewConfig {
  const base = defaultSkuConfig()
  const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
  const input = record(raw) ? raw : {}
  let broken = !record(raw)
  const invalid = (): SkuCondition => ({ kind: 'rule', id: 'invalid-import', field: '__invalid_import__', operator: 'eq', value: null })
  function condition(value: unknown, depth: number): SkuCondition | SkuConditionGroup {
    if (!record(value) || depth > 2) { broken = true; return invalid() }
    if (value.kind === 'group') {
      if (!Array.isArray(value.children) || !['all', 'any'].includes(String(value.logic))) { broken = true; return invalid() }
      return { kind: 'group', id: String(value.id || ''), logic: value.logic === 'any' ? 'any' : 'all', children: value.children.map(child => condition(child, depth + 1)) }
    }
    if (value.kind !== 'rule' || typeof value.field !== 'string' || typeof value.operator !== 'string') { broken = true; return invalid() }
    const val = value.value
    const safeValue = val === null || typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean'
      ? val : Array.isArray(val) && val.every(item => typeof item === 'string') ? [...val]
        : record(val) && typeof val.from === 'string' && typeof val.to === 'string' ? { from: val.from, to: val.to } : null
    if (safeValue === null && val !== null) broken = true
    return { kind: 'rule', id: String(value.id || ''), field: value.field, operator: value.operator as SkuOperator, value: safeValue }
  }
  const root = condition(input.conditions, 0)
  const next: SkuViewConfig = { ...base, conditions: root.kind === 'group' ? root : { ...base.conditions, children: [root] } }
  if (!Array.isArray(input.columns)) broken = true
  else next.columns = input.columns.map(column => {
    if (!record(column) || typeof column.key !== 'string') { broken = true; return { key: '__invalid_column__', visible: true } }
    const width = typeof column.width === 'number' ? column.width : undefined
    if (column.width !== undefined && width === undefined) broken = true
    if (column.frozen !== undefined && column.frozen !== false && column.frozen !== 'left' && column.frozen !== 'right') broken = true
    return { key: column.key, visible: column.visible !== false, ...(width === undefined ? {} : { width }), ...(column.frozen === 'left' || column.frozen === 'right' || column.frozen === false ? { frozen: column.frozen } : {}) }
  })
  const orders = (value: unknown) => {
    if (!Array.isArray(value)) { broken = true; return [] }
    return value.map(order => {
      if (!record(order) || typeof order.field !== 'string' || !['asc', 'desc'].includes(String(order.direction))) { broken = true; return { field: '__invalid_order__', direction: 'asc' as const } }
      return { field: order.field, direction: order.direction === 'desc' ? 'desc' as const : 'asc' as const }
    })
  }
  next.sorts = orders(input.sorts); next.groups = orders(input.groups)
  next.manualOrder = Array.isArray(input.manualOrder) ? input.manualOrder.filter((id): id is string => typeof id === 'string') : []
  next.density = input.density === 'compact' ? 'compact' : 'comfortable'
  next.sortMode = input.sortMode === 'manual' || input.sortMode === 'field' ? input.sortMode : 'default'
  next.categoryLayout = input.categoryLayout === 'sidebar' || input.categoryLayout === 'hidden' ? input.categoryLayout : 'popover'
  if (input.legacy !== undefined) {
    if (!record(input.legacy) || !Array.isArray(input.legacy.filters) || typeof input.legacy.keyword !== 'string') broken = true
    else {
      const legacy = input.legacy
      next.legacy = { keyword: String(legacy.keyword), filters: [], exposed: Array.isArray(legacy.exposed) ? legacy.exposed.filter((item): item is string => typeof item === 'string') : [], grouping: null, sorting: null, sortMode: legacy.sortMode === 'manual' || legacy.sortMode === 'field' ? legacy.sortMode : 'default' }
      const filters: unknown[] = Array.isArray(legacy.filters) ? legacy.filters : []
      filters.forEach(filter => {
        if (!record(filter) || typeof filter.field !== 'string' || typeof filter.operator !== 'string') { broken = true; return }
        let value: ProductListViewFilter['value'] = ''
        if (typeof filter.value === 'string') value = filter.value
        else if (Array.isArray(filter.value) && filter.value.every(item => typeof item === 'string')) value = [...filter.value]
        else if (record(filter.value) && (filter.value.from === undefined || typeof filter.value.from === 'string') && (filter.value.to === undefined || typeof filter.value.to === 'string')) value = { ...(filter.value.from === undefined ? {} : { from: filter.value.from }), ...(filter.value.to === undefined ? {} : { to: filter.value.to }) }
        else broken = true
        next.legacy?.filters.push({ id: String(filter.id || ''), field: filter.field, operator: filter.operator as ProductListFilterOperator, value })
      })
      for (const key of ['sorting', 'grouping'] as const) {
        const order = legacy[key]
        if (order === null || order === undefined) continue
        if (!record(order) || typeof order.field !== 'string' || !['asc', 'desc'].includes(String(order.direction))) broken = true
        else next.legacy[key] = { field: order.field, direction: order.direction === 'desc' ? 'desc' : 'asc' }
      }
    }
  }
  const aliases: Record<string, string[]> = {}
  if (record(input.attributeNames)) Object.entries(input.attributeNames).forEach(([id, names]) => { if (Array.isArray(names)) aliases[id] = names.filter((name): name is string => typeof name === 'string') })
  data?.params.forEach(param => { aliases[param.id] = [...new Set([param.name, ...(aliases[param.id] || [])])] })
  next.attributeNames = aliases
  if (broken && !next.conditions.children.some(item => item.id === 'invalid-import')) next.conditions.children.push(invalid())
  return next
}

export function configFromLegacy(view: ProductListSavedView, data?: AppData): SkuViewConfig {
  if (Object.prototype.hasOwnProperty.call(view, 'skuWorkbench')) return repairSkuConfig(view.skuWorkbench, data)
  const config = defaultSkuConfig()
  const query = view.skuQuery
  if (query) {
    config.legacy = cloneSku(query)
    config.sorts = query.sorting ? [{ ...query.sorting, field: fieldKey(query.sorting.field) }] : []
    config.groups = query.grouping ? [{ ...query.grouping, field: fieldKey(query.grouping.field) }] : []
    config.sortMode = query.sortMode || (query.sorting ? 'field' : 'default')
  }
  if (view.skuColumns.length) config.columns = [...view.skuColumns].sort((a, b) => a.order - b.order).map(({ key, visible, width, frozen }) => ({ key: fieldKey(key), visible, ...(width === undefined ? {} : { width }), ...(frozen === undefined ? {} : { frozen }) }))
  config.manualOrder = [...(view.manualOrder?.skuIds || [])]
  config.categoryLayout = view.categoryFilterLayout || 'popover'
  return repairSkuConfig(config, data)
}

export function skuConfigStamp(config: SkuViewConfig) {
  const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).filter(([key, item]) => key !== 'id' && item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)])) : value
  // Attribute aliases are lookup metadata, not a user's configuration adjustment.
  const { attributeNames: _aliases, ...effective } = config
  return JSON.stringify(canonical(effective))
}

export function createSkuSavedView(id: string, name: string, config: SkuViewConfig, source?: ProductListSavedView): ProductListSavedView {
  const now = new Date().toISOString()
  return {
    id, name, mode: 'sku', spuColumns: cloneSku(source?.spuColumns || []), skuColumns: cloneSku(source?.skuColumns || []),
    spuQuery: cloneSku(source?.spuQuery), skuQuery: cloneSku(source?.skuQuery), manualOrder: cloneSku(source?.manualOrder),
    categoryFilterLayout: config.categoryLayout, skuWorkbench: cloneSku(config), createdAt: now, updatedAt: now,
  }
}

/** Only the actual SKU page is migrated; its legacy views and presets remain intact. */
export function ensureSkuWorkbench(data: AppData): boolean {
  const page = data.productListPages?.sku
  if (!page) return false
  const before = JSON.stringify(page)
  page.views.forEach(view => { if (view.id !== SYSTEM_SKU_VIEW_ID) view.skuWorkbench = configFromLegacy(view, data) })
  const legacy = page.views.find(view => view.id === 'view-default')
  if (!page.views.some(view => view.id === SYSTEM_SKU_VIEW_ID)) page.views.unshift(createSkuSavedView(SYSTEM_SKU_VIEW_ID, '全部 SKU', repairSkuConfig(defaultSkuConfig(), data), legacy))
  const system = page.views.find(view => view.id === SYSTEM_SKU_VIEW_ID)
  if (system) { system.name = '全部 SKU'; system.mode = 'sku'; system.skuWorkbench = repairSkuConfig(defaultSkuConfig(), data) }
  page.presets.filter(preset => preset.id !== 'view-all').forEach(preset => {
    const id = `sku-preset:${preset.id}`
    if (page.views.some(view => view.id === id)) return
    const config = legacy ? configFromLegacy(legacy, data) : defaultSkuConfig()
    const query = cloneSku(legacy?.skuQuery || { keyword: '', filters: [], exposed: [], grouping: null, sorting: null })
    const converted = filtersFromListQuery(data, preset.query)
    query.keyword = preset.viewFilters ? preset.keyword || '' : converted.keyword
    query.filters = cloneSku(preset.viewFilters || converted.filters)
    config.legacy = query
    let name = `筛选预设 · ${preset.name}`
    while (page.views.some(view => view.name === name)) name += '（历史）'
    page.views.push(createSkuSavedView(id, name, repairSkuConfig(config, data), legacy))
  })
  const ids = new Set(page.views.map(view => view.id))
  const previous = page.skuWorkbench
  const work: Record<string, SkuViewConfig> = {}
  Object.entries(previous?.working || {}).forEach(([id, config]) => {
    const scoped = id.startsWith(`${SYSTEM_SKU_VIEW_ID}@spu:`) && data.families.some(family => family.id === id.slice(`${SYSTEM_SKU_VIEW_ID}@spu:`.length))
    if (ids.has(id) || scoped) work[id] = repairSkuConfig(config, data)
  })
  const list = (items: unknown): string[] => Array.isArray(items) ? items.filter((item): item is string => typeof item === 'string') : []
  const unique = (items: string[]) => [...new Set(items)].filter(id => ids.has(id))
  const fallback = ids.has(page.activeId) ? page.activeId : SYSTEM_SKU_VIEW_ID
  const state: SkuWorkbenchState = {
    version: 1, activeId: previous && ids.has(previous.activeId) ? previous.activeId : fallback,
    defaultId: previous && ids.has(previous.defaultId) ? previous.defaultId : SYSTEM_SKU_VIEW_ID,
    favorites: unique(list(previous?.favorites)), order: unique([...list(previous?.order), ...page.views.map(view => view.id)]), working: work,
  }
  page.skuWorkbench = state
  return JSON.stringify(page) !== before
}

/** Persist the candidate before replacing live settings. Business arrays are shared, never cloned. */
export function persistSkuPage(data: AppData, next: ProductListPageState, write: (text: string) => void, version: number): { ok: true; encoded: string } | { ok: false; message: string } {
  try {
    if (!data.productListPages) throw new Error('SKU 页面配置尚未初始化。')
    const candidate = { ...data, productListPages: { ...data.productListPages, sku: next } }
    const encoded = JSON.stringify({ version, data: candidate })
    write(encoded)
    data.productListPages.sku = next
    return { ok: true, encoded }
  } catch (error) {
    return { ok: false, message: `无法保存到本机：${error instanceof Error ? error.message : String(error)}。当前工作配置已保留，请重试。` }
  }
}

export function addScopeCondition(config: SkuViewConfig, scopeId: string): SkuViewConfig {
  const next = cloneSku(config)
  const root: SkuConditionGroup = next.conditions
  const exactScope = (node: SkuCondition | SkuConditionGroup) => node.kind === 'rule' && node.field === 'familyId' && (node.operator === 'eq' && node.value === scopeId || node.operator === 'in' && Array.isArray(node.value) && node.value.length === 1 && node.value[0] === scopeId)
  if (root.logic === 'all' && root.children.some(exactScope) || root.logic === 'any' && root.children.length && root.children.every(child => child.kind === 'group' && child.logic === 'all' && child.children.some(exactScope))) return next
  const usedIds = new Set<string>()
  function collect(node: SkuCondition | SkuConditionGroup) { usedIds.add(node.id); if (node.kind === 'group') node.children.forEach(collect) }
  collect(root)
  let serial = 0
  function newId(prefix: string) { let id: string; do { id = `${prefix}-${serial++}` } while (usedIds.has(id)); usedIds.add(id); return id }
  const scope = () => ({ kind: 'rule' as const, id: newId('saved-spu-scope'), field: 'familyId', operator: 'eq' as const, value: scopeId })
  if (root.logic === 'all' || !root.children.length) next.conditions = { ...root, logic: 'all', children: [...root.children, scope()] }
  else next.conditions = { ...root, children: root.children.flatMap(child => child.kind === 'group' && child.logic === 'any'
    ? child.children.map(rule => ({ kind: 'group' as const, id: newId('saved-spu-group'), logic: 'all' as const, children: [rule, scope()] }))
    : [{ kind: 'group' as const, id: newId('saved-spu-group'), logic: 'all' as const, children: [...(child.kind === 'group' ? child.children : [child]), scope()] }]) }
  return next
}

export function mergeSkuColumnMetadata(column: SkuColumn) { return { ...(column.width === undefined ? {} : { width: column.width }), ...(column.frozen === undefined ? {} : { frozen: column.frozen }) } }
