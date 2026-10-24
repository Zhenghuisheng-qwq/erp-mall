import { isRealSku } from './catalogIdentity'
import { categoryPath } from './logic'
import { skuListText } from './productList'
import { resolveManualOrder } from './productListManual'
import { knownFilterFields, presentProductList } from './productListQuery'
import { skuFields, skuFieldValue, skuOperators } from './skuWorkbenchFields'
import type { AppData, ProductFamily, ProductListSavedView, Sku } from './types'
import type { SkuCondition, SkuConditionGroup, SkuFieldType, SkuFieldValue, SkuOrder, SkuViewConfig } from './skuWorkbenchTypes'

export interface SkuRecord { id: string; family: ProductFamily; sku: Sku }
export interface SkuGroup { key: string; keys: string[]; labels: string[]; totals: number[]; total: number; rows: SkuRecord[] }
export interface SkuQueryOptions { scopeId?: string; search?: string; page?: number; pageSize?: number; now?: Date | string | number }
const relativeLabels: Record<string, string> = { today: '今天', yesterday: '昨天', week: '本周', month: '本月', last7: '近7天（含今天）', last30: '近30天（含今天）' }
const empty = (value: SkuFieldValue['value']) => value === null || typeof value === 'string' && value.trim() === '' || Array.isArray(value) && value.length === 0
const dayPattern = /^\d{4}-\d{2}-\d{2}$/
const dayFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' })

function validDay(value: string) {
  if (!dayPattern.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}
/** Date-only inputs retain their date; timestamps are interpreted in the business timezone. */
export function skuBusinessDay(value: Date | string | number) {
  if (typeof value === 'string' && dayPattern.test(value)) return validDay(value) ? value : ''
  const date = value instanceof Date ? value : new Date(value)
  return Number.isFinite(date.getTime()) ? dayFormatter.format(date) : ''
}
function shiftDay(day: string, amount: number) {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}
export function skuRelativeRange(rule: string, now: Date | string | number = new Date()) {
  const today = skuBusinessDay(now)
  if (!today || !Object.hasOwn(relativeLabels, rule)) return null
  if (rule === 'today') return { from: today, to: today }
  if (rule === 'yesterday') { const yesterday = shiftDay(today, -1); return { from: yesterday, to: yesterday } }
  if (rule === 'last7' || rule === 'last30') return { from: shiftDay(today, rule === 'last7' ? -6 : -29), to: today }
  const date = new Date(`${today}T00:00:00Z`)
  if (rule === 'week') { const monday = shiftDay(today, -((date.getUTCDay() + 6) % 7)); return { from: monday, to: shiftDay(monday, 6) } }
  const from = `${today.slice(0, 7)}-01`
  date.setUTCMonth(date.getUTCMonth() + 1, 0)
  return { from, to: date.toISOString().slice(0, 10) }
}

/** Shared by preview and effective queries. Negation requires an applicable, filled value. */
export function matchesSkuValue(type: SkuFieldType, cell: SkuFieldValue, condition: SkuCondition, now: Date | string | number = new Date(), descendantIds: ReadonlySet<string> = new Set()) {
  if (!cell.applicable) return false
  const raw = cell.value
  const value = type === 'date' && typeof raw === 'string' ? skuBusinessDay(raw) : raw
  const absent = empty(value)
  if (condition.operator === 'empty') return absent
  if (condition.operator === 'notEmpty') return !absent
  if (absent) return false
  const expected = condition.value
  const values = Array.isArray(value) ? value : [value]
  const needles = Array.isArray(expected) ? expected : [expected]
  const compare = (left: unknown, right: unknown) => type === 'text'
    ? String(left).toLocaleLowerCase('zh-CN') === String(right).toLocaleLowerCase('zh-CN') : left === right
  switch (condition.operator) {
    case 'eq': return values.some(item => compare(item, expected))
    case 'neq': return values.every(item => !compare(item, expected))
    case 'in': case 'hasAny': return values.some(item => needles.some(needle => compare(item, needle)))
    case 'notIn': return values.every(item => needles.every(needle => !compare(item, needle)))
    case 'hasAll': return needles.every(needle => values.some(item => compare(item, needle)))
    case 'contains': return values.some(item => String(item).toLocaleLowerCase('zh-CN').includes(String(expected).toLocaleLowerCase('zh-CN')))
    case 'notContains': return values.every(item => !String(item).toLocaleLowerCase('zh-CN').includes(String(expected).toLocaleLowerCase('zh-CN')))
    case 'startsWith': return values.some(item => String(item).toLocaleLowerCase('zh-CN').startsWith(String(expected).toLocaleLowerCase('zh-CN')))
    case 'gt': return typeof value === 'number' && typeof expected === 'number' && value > expected
    case 'gte': return typeof value === 'number' && typeof expected === 'number' && value >= expected
    case 'lt': return typeof value === 'number' && typeof expected === 'number' && value < expected
    case 'lte': return typeof value === 'number' && typeof expected === 'number' && value <= expected
    case 'before': return typeof value === 'string' && typeof expected === 'string' && value < expected
    case 'after': return typeof value === 'string' && typeof expected === 'string' && value > expected
    case 'between': {
      if (!expected || typeof expected !== 'object' || Array.isArray(expected)) return false
      if (type === 'number') return typeof value === 'number' && value >= Number(expected.from) && value <= Number(expected.to)
      return typeof value === 'string' && value >= expected.from && value <= expected.to
    }
    case 'relative': {
      const range = typeof expected === 'string' ? skuRelativeRange(expected, now) : null
      return Boolean(range && typeof value === 'string' && value >= range.from && value <= range.to)
    }
    case 'descendants': return typeof value === 'string' && descendantIds.has(value)
  }
  return false
}

export function validateSkuConfig(data: AppData, config: SkuViewConfig): string[] {
  const fields = new Map(skuFields(data).map(item => [item.id, item]))
  const errors: string[] = []
  const ids = new Set<string>()
  function group(node: SkuConditionGroup, depth: number) {
    if (!node || node.kind !== 'group' || !Array.isArray(node.children) || !['all', 'any'].includes(node.logic)) { errors.push('条件组格式无效。'); return }
    if (depth > 1) { errors.push('仅支持外层和一层条件组。'); return }
    if (depth && !node.children.length) errors.push('条件组不能为空。')
    for (const item of node.children) {
      if (!item || typeof item !== 'object') { errors.push('存在无效条件。'); continue }
      if (!item.id || ids.has(item.id)) errors.push('条件身份缺失或重复。')
      ids.add(item.id)
      if (item.kind === 'group') { group(item, depth + 1); continue }
      const field = fields.get(item.field)
      if (item.kind !== 'rule' || !field) { errors.push(`失效字段：${item.field || '未选择字段'}。`); continue }
      if (!skuOperators(field.type).some(operator => operator.value === item.operator)) { errors.push(`${field.label} 的操作符无效。`); continue }
      if (item.operator === 'empty' || item.operator === 'notEmpty') continue
      const value = item.value
      if (value === null || typeof value === 'string' && !value.trim() || Array.isArray(value) && !value.length) { errors.push(`${field.label} 尚未填写条件值。`); continue }
      if (['in', 'notIn', 'hasAny', 'hasAll'].includes(item.operator) || item.operator === 'descendants' && Array.isArray(value)) {
        if (!Array.isArray(value) || value.some(entry => typeof entry !== 'string' || !entry.trim())) errors.push(`${field.label} 需要至少一个有效选项。`)
      } else if (item.operator === 'between') {
        if (!value || typeof value !== 'object' || Array.isArray(value) || !value.from || !value.to) errors.push(`${field.label} 需要完整范围。`)
        else if (field.type === 'date' ? !validDay(value.from) || !validDay(value.to) || value.from > value.to : !Number.isFinite(Number(value.from)) || !Number.isFinite(Number(value.to)) || Number(value.from) > Number(value.to)) errors.push(`${field.label} 的范围无效。`)
      } else if (item.operator === 'relative') {
        if (typeof value !== 'string' || !Object.hasOwn(relativeLabels, value)) errors.push(`${field.label} 的相对日期无效。`)
      } else if (field.type === 'date') {
        if (typeof value !== 'string' || !validDay(value)) errors.push(`${field.label} 需要有效日期。`)
      } else if (field.type === 'number') {
        if (typeof value !== 'number' || !Number.isFinite(value)) errors.push(`${field.label} 需要数字。`)
      } else if (field.type === 'boolean') {
        if (typeof value !== 'boolean') errors.push(`${field.label} 需要是或否。`)
      } else if (typeof value !== 'string') errors.push(`${field.label} 需要文本或选项值。`)
      if (field.type === 'spu' || field.type === 'category') {
        const selected = Array.isArray(value) ? value : [value]
        if (selected.some(entry => typeof entry !== 'string' || !field.options.some(option => option.value === entry))) errors.push(`${field.label} 引用的记录已失效。`)
      }
    }
  }
  group(config.conditions, 0)
  for (const [rules, limit, title, capability] of [[config.sorts, 3, '排序', 'sortable'], [config.groups, 2, '分组', 'groupable']] as const) {
    if (!Array.isArray(rules) || rules.length > limit) { errors.push(`${title}最多 ${limit} 项。`); continue }
    const used = new Set<string>()
    for (const rule of rules) {
      const field = fields.get(rule.field)
      if (!field || !field[capability] || !['asc', 'desc'].includes(rule.direction)) errors.push(`${title}字段失效：${rule.field}。`)
      if (used.has(rule.field)) errors.push(`${title}字段不能重复。`)
      used.add(rule.field)
    }
  }
  if (!config.columns.some(column => column.visible && ['code', 'name'].includes(column.key))) errors.push('至少显示 SKU 编号或 SKU 名称。')
  const columnKeys = new Set<string>()
  for (const column of config.columns) {
    if (!column.key || columnKeys.has(column.key)) errors.push('展示字段身份缺失或重复。')
    columnKeys.add(column.key)
    if (column.visible && !fields.has(column.key) && column.key !== 'family') errors.push(`展示字段失效：${column.key}。`)
    if (column.width !== undefined && (!Number.isFinite(column.width) || column.width < 80 || column.width > 600)) errors.push(`列宽必须在 80 至 600 像素之间：${column.key}。`)
    if (column.frozen !== undefined && column.frozen !== false && column.frozen !== 'left' && column.frozen !== 'right') errors.push(`冻结位置无效：${column.key}。`)
  }
  if (config.columns.filter(column => column.visible && column.frozen).length > 2) errors.push('最多冻结两个显示字段。')
  if (config.legacy) {
    const known = new Set(knownFilterFields(data, 'sku').map(item => item.field))
    const allowedOperators = new Set(['contains', 'notContains', 'eq', 'neq', 'in', 'before', 'after', 'between'])
    for (const filter of config.legacy.filters) {
      if (!known.has(filter.field)) errors.push(`历史条件字段失效：${filter.field}。`)
      if (!allowedOperators.has(filter.operator)) errors.push(`历史条件操作符失效：${filter.operator}。`)
    }
  }
  return [...new Set(errors)]
}

export function querySkuWorkbench(data: AppData, config: SkuViewConfig, options: SkuQueryOptions = {}) {
  const errors = validateSkuConfig(data, config)
  const manualBlocked = config.sortMode === 'manual' && (config.groups.length > 0 || config.sorts.length > 0)
  const failure = { rows: [] as SkuRecord[], groups: [] as SkuGroup[], total: 0, page: 1, errors, allIds: [] as string[], manualBlocked }
  if (errors.length) return failure
  const fields = new Map(skuFields(data).map(item => [item.id, item]))
  const families = new Map(data.families.map(item => [item.id, item]))
  let base = data.skus.flatMap(sku => {
    const family = families.get(sku.familyId)
    return family && isRealSku(data, sku) ? [{ id: sku.id, family, sku }] : []
  }).sort((left, right) => (right.family.updatedAt || '').localeCompare(left.family.updatedAt || '') || left.id.localeCompare(right.id, 'zh'))
  const legacyField = (id: string) => id === 'created' ? 'legacy.created' : id === 'family' ? 'familyId' : id
  const sameOrder = (orders: SkuOrder[], original: SkuOrder | null | undefined) => Boolean(original && orders.length === 1 && orders[0]?.field === legacyField(original.field) && orders[0]?.direction === original.direction)
  const preserveLegacySorting = config.sortMode === 'field' && sameOrder(config.sorts, config.legacy?.sorting)
  const preserveLegacyGrouping = sameOrder(config.groups, config.legacy?.grouping)
  if (config.legacy) {
    const view: ProductListSavedView = { id: 'legacy-query', name: '', mode: 'sku', skuColumns: [], spuColumns: [], skuQuery: { ...config.legacy, sorting: preserveLegacySorting ? config.legacy.sorting : null, grouping: preserveLegacyGrouping ? config.legacy.grouping : null, sortMode: preserveLegacySorting ? 'field' : 'default' }, createdAt: '', updatedAt: '' }
    const ids = new Map(presentProductList(data, view, 1, Math.max(1, data.skus.length)).groups.flatMap(item => item.rows.map(row => row.id)).map((id, index) => [id, index]))
    base = base.filter(row => ids.has(row.id)).sort((left, right) => (ids.get(left.id) || 0) - (ids.get(right.id) || 0))
  }
  const allBaseIds = base.map(row => row.id)
  const values = new Map<string, Map<string, SkuFieldValue>>()
  function get(row: SkuRecord, id: string) {
    let rowValues = values.get(row.id)
    if (!rowValues) { rowValues = new Map(); values.set(row.id, rowValues) }
    let entry = rowValues.get(id)
    if (!entry) { entry = skuFieldValue(data, row.sku, row.family, id, config.attributeNames); rowValues.set(id, entry) }
    return entry
  }
  const categoryChildren = new Map<string, string[]>()
  data.categories.forEach(item => { if (item.parentId) { const list = categoryChildren.get(item.parentId) || []; list.push(item.id); categoryChildren.set(item.parentId, list) } })
  function descendants(id: string) {
    const found = new Set<string>(), pending = [id]
    while (pending.length) { const next = pending.pop(); if (!next || found.has(next)) continue; found.add(next); pending.push(...categoryChildren.get(next) || []) }
    return found
  }
  const descendantCache = new Map<string, Set<string>>()
  const now = options.now ?? new Date()
  function match(row: SkuRecord, node: SkuConditionGroup | SkuCondition): boolean {
    if (node.kind === 'group') return !node.children.length || (node.logic === 'all' ? node.children.every(item => match(row, item)) : node.children.some(item => match(row, item)))
    const type = fields.get(node.field)?.type
    if (!type) return false
    let included = new Set<string>()
    if (node.operator === 'descendants') {
      const roots = Array.isArray(node.value) ? node.value : typeof node.value === 'string' ? [node.value] : []
      for (const root of roots) {
        const subtree = descendantCache.get(root) || descendants(root)
        descendantCache.set(root, subtree)
        subtree.forEach(id => included.add(id))
      }
    }
    return matchesSkuValue(type, get(row, node.field), node, now, included)
  }
  const keyword = (options.search || '').trim().toLocaleLowerCase('zh-CN')
  let rows = base.filter(row => (!options.scopeId || row.family.id === options.scopeId) && match(row, config.conditions) && (!keyword || `${row.family.name} ${categoryPath(data, row.family.categoryId)} ${skuListText(row.family, row.sku)} ${row.sku.oaSkuId || ''}`.toLocaleLowerCase('zh-CN').includes(keyword)))
  function compare(left: SkuRecord, right: SkuRecord, rules: SkuOrder[]) {
    for (const rule of rules) {
      const l = get(left, rule.field), r = get(right, rule.field)
      const la = !l.applicable || empty(l.value), ra = !r.applicable || empty(r.value)
      if (la || ra) { if (la !== ra) return la ? 1 : -1; continue }
      const field = fields.get(rule.field), type = field?.type
      const lv = type === 'date' && typeof l.value === 'string' ? skuBusinessDay(l.value) : l.value
      const rv = type === 'date' && typeof r.value === 'string' ? skuBusinessDay(r.value) : r.value
      const display = (value: unknown) => field?.options.find(option => option.value === value)?.label || String(value)
      const result = typeof lv === 'number' && typeof rv === 'number' ? lv - rv : typeof lv === 'boolean' && typeof rv === 'boolean' ? Number(lv) - Number(rv) : display(lv).localeCompare(display(rv), 'zh')
      if (result) return result * (rule.direction === 'desc' ? -1 : 1)
    }
    return 0 // Modern stable Array.sort retains the existing identity order on ties.
  }
  if (config.sortMode === 'manual' && !manualBlocked) {
    const ranks = new Map(resolveManualOrder(config.manualOrder, allBaseIds).map((id, index) => [id, index]))
    rows = rows.slice().sort((left, right) => (ranks.get(left.id) ?? ranks.size) - (ranks.get(right.id) ?? ranks.size))
  } else if (config.sortMode === 'field' || config.groups.length) {
    // Original single sorting/grouping retains original null and tie semantics.
    // As soon as its rules change, the new typed comparator takes over.
    const rules = [...(preserveLegacyGrouping ? [] : config.groups), ...(config.sortMode === 'field' && !preserveLegacySorting ? config.sorts : [])]
    if (rules.length) {
      if (preserveLegacyGrouping) {
        const rank = new Map<string, number>()
        for (const row of rows) { const key = JSON.stringify(config.groups.map(rule => get(row, rule.field).value)); if (!rank.has(key)) rank.set(key, rank.size) }
        rows = rows.slice().sort((left, right) => (rank.get(JSON.stringify(config.groups.map(rule => get(left, rule.field).value))) || 0) - (rank.get(JSON.stringify(config.groups.map(rule => get(right, rule.field).value))) || 0) || compare(left, right, rules))
      } else rows = rows.slice().sort((left, right) => compare(left, right, rules))
    }
  }
  function groupParts(row: SkuRecord) {
    return config.groups.map(rule => {
      const cell = get(row, rule.field), field = fields.get(rule.field)
      if (!cell.applicable) return { key: '__not_applicable__', label: '不适用' }
      if (empty(cell.value)) return { key: '__empty__', label: '未记录' }
      if (field?.type === 'date') {
        const day = skuBusinessDay(String(cell.value))
        return day ? { key: day, label: day } : { key: '__empty__', label: '未记录' }
      }
      const text = Array.isArray(cell.value) ? cell.value.map(value => field?.options.find(option => option.value === value)?.label || value).join('、') : String(cell.value)
      return { key: JSON.stringify(cell.value), label: field?.options.find(option => option.value === cell.value)?.label || text }
    })
  }
  if (config.groups.length) {
    // Comparison can tie distinct identities (empty vs inapplicable, or equal
    // display names). Gather each identity before paging so Map consumers cannot
    // overwrite repeated group keys. First appearance breaks group ties; each
    // leaf retains the existing comparator's row order.
    interface Bucket { children: Map<string, Bucket>; rows: SkuRecord[] }
    const root: Bucket = { children: new Map(), rows: [] }
    for (const row of rows) {
      let bucket = root
      for (const part of groupParts(row)) {
        let child = bucket.children.get(part.key)
        if (!child) { child = { children: new Map(), rows: [] }; bucket.children.set(part.key, child) }
        bucket = child
      }
      bucket.rows.push(row)
    }
    const flatten = (bucket: Bucket): SkuRecord[] => bucket.children.size ? [...bucket.children.values()].flatMap(flatten) : bucket.rows
    rows = flatten(root)
  }
  const allIds = rows.map(row => row.id)
  const total = rows.length
  const size = Number.isFinite(options.pageSize) && (options.pageSize || 0) > 0 ? Math.floor(options.pageSize || 20) : 20
  const page = Math.max(1, Math.min(Math.floor(options.page || 1) || 1, Math.max(1, Math.ceil(total / size))))
  const counts = new Map<string, number>()
  for (const row of rows) { const parts = groupParts(row); parts.forEach((_, i) => { const key = JSON.stringify(parts.slice(0, i + 1).map(item => item.key)); counts.set(key, (counts.get(key) || 0) + 1) }) }
  const currentRows = rows.slice((page - 1) * size, page * size)
  const groups: SkuGroup[] = []
  for (const row of currentRows) {
    const parts = groupParts(row), key = JSON.stringify(parts.map(item => item.key))
    const previous = groups.at(-1)
    if (previous?.key === key) previous.rows.push(row)
    else groups.push({ key, keys: parts.map(item => item.key), labels: parts.map(item => item.label), totals: parts.map((_, i) => counts.get(JSON.stringify(parts.slice(0, i + 1).map(item => item.key))) || 0), total: parts.length ? counts.get(key) || 0 : total, rows: [row] })
  }
  if (!groups.length) groups.push({ key: 'all', keys: [], labels: [], totals: [], total: 0, rows: [] })
  return { rows: currentRows, groups, total, page, errors, allIds, manualBlocked }
}

export function describeSkuConditions(data: AppData, config: SkuViewConfig): string {
  const fields = new Map(skuFields(data).map(item => [item.id, item]))
  function describe(node: SkuConditionGroup | SkuCondition): string {
    if (node.kind === 'group') return node.children.length ? `（${node.children.map(describe).join(node.logic === 'all' ? ' 且 ' : ' 或 ')}）` : ''
    const field = fields.get(node.field)
    const operator = skuOperators(field?.type || 'text').find(item => item.value === node.operator)?.label || node.operator
    const show = (value: unknown) => field?.options.find(item => item.value === value)?.label || String(value ?? '')
    const value = node.value && typeof node.value === 'object' && !Array.isArray(node.value) ? `${node.value.from} 至 ${node.value.to}` : Array.isArray(node.value) ? node.value.map(show).join('、') : node.operator === 'relative' ? relativeLabels[String(node.value)] || String(node.value) : show(node.value)
    return `${field?.label || `失效字段 ${node.field}`} ${operator}${['empty', 'notEmpty'].includes(node.operator) ? '' : ` ${value}`}`
  }
  const old = config.legacy
  const legacyOperators: Record<string, string> = { contains: '包含', notContains: '不包含', eq: '等于', neq: '不等于', in: '属于任意一个', before: '早于', after: '晚于', between: '日期范围' }
  const legacyLabels: Record<string, string> = { created: 'SPU 创建日期（历史含义）', brand: '品牌', productType: '产品类型', template: '属性方案', group: '所属 SPU 分组', familyName: 'SPU 名称', shelf: '商品状态' }
  const legacy = old && (old.keyword.trim() || old.filters.length) ? `历史条件（原语义：${[old.keyword ? `已保存关键词「${old.keyword}」` : '', ...old.filters.map(item => {
    const field = fields.get(item.field === 'created' ? 'legacy.created' : item.field)
    const label = legacyLabels[item.field] || field?.label || `失效字段 ${item.field}`
    const show = (value: unknown) => field?.options.find(option => option.value === value)?.label || String(value ?? '')
    const value = item.value && typeof item.value === 'object' && !Array.isArray(item.value)
      ? `${item.value.from || '不限开始'} 至 ${item.value.to || '不限结束'}`
      : Array.isArray(item.value) ? item.value.map(show).join('、') : show(item.value)
    return `${label} ${legacyOperators[item.operator] || `失效操作符 ${item.operator}`} ${value || (item.operator === 'before' || item.operator === 'after' ? '未填写（不会匹配记录）' : '未填写（沿用旧规则）')}`
  })].filter(Boolean).join(' 且 ')}）` : ''
  return [legacy, describe(config.conditions)].filter(Boolean).join(' 且 ')
}
