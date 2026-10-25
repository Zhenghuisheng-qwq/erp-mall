import assert from 'node:assert/strict'
import { createSeed } from '../src/domain/seed'
import { skuFields, skuFieldValue } from '../src/domain/skuWorkbenchFields'
import { describeSkuConditions, matchesSkuValue, querySkuWorkbench, skuRelativeRange, validateSkuConfig } from '../src/domain/skuWorkbenchQuery'
import { emptyModeQuery } from '../src/domain/productListQuery'
import type { SkuCondition, SkuConditionGroup, SkuViewConfig } from '../src/domain/skuWorkbenchTypes'
import type { ProductFamily, Sku } from '../src/domain/types'

const now = '2026-10-22T04:00:00Z'
const data = createSeed()
const family = data.families[0]
assert.ok(family)
const makeFamily = (id: string, templateId = 'work', categoryId = 'child'): ProductFamily => ({ ...family, id, templateId, categoryId, name: id, commonAttrs: {}, productGroupIds: [], updatedAt: '2026-10-22T04:00:00Z', createdAt: '2026-01-01T00:00:00Z' })
data.families = [makeFamily('f1'), makeFamily('f2', 'other'), makeFamily('f3', 'work', 'sibling')]
data.params = [
  { id: 'color', name: '颜色', values: ['白色', '黑色'], valueGroups: [], participateInStructure: true },
  { id: 'capacity', name: '容量', values: ['256GB', '512GB'], valueGroups: [], participateInStructure: true },
]
data.templateParams = data.params.map(param => ({ templateId: 'work', paramId: param.id, role: 'variant', required: false }))
data.categories = [
  { id: 'parent', name: '主类', parentId: null, enabled: true, sort: 1 },
  { id: 'child', name: '子类', parentId: 'parent', enabled: true, sort: 1 },
  { id: 'sibling', name: '其他', parentId: null, enabled: true, sort: 2 },
]
data.planningRecords = []
data.materialReceipts = []
data.skus = []
const sku = (id: string, color: string | null, capacity: string | null, familyId = 'f1', status: Sku['status'] = 'on_sale'): Sku => ({
  id, familyId, recordKind: 'sku', code: id, oaSkuId: '', skuName: id, status,
  variantAttrs: { ...(color !== null ? { 颜色: color } : {}), ...(capacity !== null ? { 容量: capacity } : {}) }, projectedAttrs: {},
  createdAt: '2026-10-21T16:00:00Z', updatedAt: '2026-10-22T04:00:00Z',
})
data.skus = [sku('a', '白色', '256GB'), sku('b', '黑色', '512GB'), sku('c', '白色', '512GB'), sku('d', '', null), sku('e', '白色', '256GB', 'f2'), sku('f', '白色', '256GB', 'f3', 'off_sale'), { ...sku('mat', '白色', '256GB'), recordKind: 'material', materialCode: 'MAT-001' }]
const config = (): SkuViewConfig => ({ version: 1, conditions: { kind: 'group', id: 'root', logic: 'all', children: [] }, columns: [{ key: 'code', visible: true }], sorts: [], groups: [], density: 'comfortable', manualOrder: [], sortMode: 'default', categoryLayout: 'popover' })
let seq = 0
const rule = (field: string, operator: SkuCondition['operator'], value: SkuCondition['value']): SkuCondition => ({ kind: 'rule', id: `r${seq++}`, field, operator, value })
const group = (logic: 'all' | 'any', children: SkuConditionGroup['children']): SkuConditionGroup => ({ kind: 'group', id: `g${seq++}`, logic, children })
function expectIds(test: string, current: SkuViewConfig, expected: string[], scopeId?: string, source = data) {
  const output = querySkuWorkbench(source, current, { now, scopeId, pageSize: 100 })
  assert.deepEqual(output.errors, [], test)
  assert.deepEqual(output.allIds, expected, test)
  console.log(`PASS query ${test}`)
  return output
}
let current = config()
current.conditions = group('any', [group('all', [rule('status', 'eq', 'on_sale'), rule('attr:color', 'eq', '白色'), rule('attr:capacity', 'eq', '256GB')]), group('all', [rule('status', 'eq', 'on_sale'), rule('attr:color', 'eq', '黑色'), rule('attr:capacity', 'eq', '512GB')])])
expectIds('AND / OR groups with independent expected IDs; MAT excluded', current, ['a', 'b'])
assert.ok(describeSkuConditions(data, current).includes(' 或 '))
expectIds('SPU scope intersects grouped view', current, ['a', 'b'], 'f1')
expectIds('scope cannot widen to all records', current, [], 'missing')
current = config(); current.conditions.children = [rule('attr:color', 'neq', '黑色')]
expectIds('new negation excludes empty and inapplicable', current, ['a', 'c', 'f'])
current.conditions.children = [rule('attr:color', 'empty', null)]
expectIds('empty applicable differs from inapplicable', current, ['d'])
current = config(); current.legacy = { ...emptyModeQuery('sku'), filters: [{ id: 'old', field: 'attr:color', operator: 'neq', value: '黑色' }] }
expectIds('legacy negation retains original inclusion of empty and inapplicable saved values', current, ['a', 'c', 'd', 'e', 'f'])
current = config(); current.legacy = { ...emptyModeQuery('sku'), keyword: '512GB' }
expectIds('legacy keyword preserved separately from transient search', current, ['b', 'c'])
assert.deepEqual(querySkuWorkbench(data, current, { search: '黑色', now }).allIds, ['b'])
const legacyDates = structuredClone(data)
const undated = legacyDates.families.find(item => item.id === 'f3')
assert.ok(undated); undated.createdAt = ''; undated.updatedAt = ''
current = config(); current.legacy = { ...emptyModeQuery('sku'), sorting: { field: 'created', direction: 'asc' }, sortMode: 'field' }
current.sortMode = 'field'; current.sorts = [{ field: 'legacy.created', direction: 'asc' }]
expectIds('unchanged legacy sort preserves original empty-first placement', current, ['f', 'a', 'b', 'c', 'd', 'e'], undefined, legacyDates)
current.sorts = [{ field: 'legacy.created', direction: 'desc' }]
expectIds('changed legacy sort opts into new empty-last semantics', current, ['a', 'b', 'c', 'd', 'e', 'f'], undefined, legacyDates)
current = config(); current.legacy = { ...emptyModeQuery('sku'), grouping: { field: 'category', direction: 'asc' } }; current.groups = [{ field: 'category', direction: 'asc' }]
expectIds('unchanged legacy grouping preserves label ordering', current, ['f', 'a', 'b', 'c', 'd', 'e'])
current = config(); current.conditions.children = [rule('createdAt', 'relative', 'today')]
expectIds('SKU creation uses Shanghai date boundary', current, ['a', 'b', 'c', 'd', 'e', 'f'])
current.conditions.children = [rule('legacy.created', 'eq', '2026-01-01')]
expectIds('SPU historical created date has a distinct field', current, ['a', 'b', 'c', 'd', 'e', 'f'])
const legacySummary = config(); legacySummary.legacy = { ...emptyModeQuery('sku'), keyword: '历史关键词', filters: [{ id: 'history', field: 'created', operator: 'before', value: '2026-10-22' }] }
assert.ok(describeSkuConditions(data, legacySummary).includes('SPU 创建日期（历史含义） 早于 2026-10-22'))
assert.ok(describeSkuConditions(data, legacySummary).includes('已保存关键词「历史关键词」'))
current.conditions.children = [rule('category', 'eq', 'parent')]
expectIds('category exact excludes descendants', current, [])
current.conditions.children = [rule('category', 'descendants', 'parent')]
expectIds('category descendants explicitly includes child', current, ['a', 'b', 'c', 'd', 'e'])
assert.deepEqual(skuRelativeRange('week', now), { from: '2026-10-19', to: '2026-10-25' })
assert.deepEqual(skuRelativeRange('month', now), { from: '2026-10-01', to: '2026-10-31' })
assert.deepEqual(skuRelativeRange('last7', now), { from: '2026-10-16', to: '2026-10-22' })
assert.deepEqual(skuRelativeRange('last30', now), { from: '2026-09-23', to: '2026-10-22' })
assert.deepEqual(skuRelativeRange('yesterday', '2026-10-21T16:00:00Z'), { from: '2026-10-21', to: '2026-10-21' })
assert.deepEqual(skuRelativeRange('today', '2026-10-21T15:59:59Z'), { from: '2026-10-21', to: '2026-10-21' })
assert.equal(matchesSkuValue('number', { applicable: true, value: 0 }, rule('test', 'eq', 0)), true)
assert.equal(matchesSkuValue('number', { applicable: true, value: 0 }, rule('test', 'empty', null)), false)
assert.equal(matchesSkuValue('boolean', { applicable: true, value: false }, rule('test', 'eq', false)), true)
assert.equal(matchesSkuValue('boolean', { applicable: false, value: false }, rule('test', 'eq', false)), false)
console.log('PASS relative ranges / timezone boundaries / zero / false')
current = config(); current.conditions.children = [rule('attr:deleted', 'eq', 'x')]
assert.ok(validateSkuConfig(data, current).some(error => error.includes('失效字段')))
assert.deepEqual(querySkuWorkbench(data, current).allIds, [])
current.conditions = group('all', [group('any', [])])
assert.ok(validateSkuConfig(data, current).includes('条件组不能为空。'))
current.conditions = group('all', [rule('name', 'contains', '')])
assert.ok(validateSkuConfig(data, current).some(error => error.includes('尚未填写')))
current.conditions = group('all', [rule('name', 'eq', false)])
assert.ok(validateSkuConfig(data, current).some(error => error.includes('需要文本')))
current = config(); current.legacy = { ...emptyModeQuery('sku'), filters: [Object.assign({ id: 'bad-operation', field: 'name', operator: 'eq' as const, value: 'a' }, { operator: 'unsupported-import-operation' })] }
assert.ok(validateSkuConfig(data, current).some(error => error.includes('历史条件操作符失效')))
assert.deepEqual(querySkuWorkbench(data, current).allIds, [])
console.log('PASS invalid query fails closed rather than widening results')
current = config(); current.sortMode = 'field'; current.sorts = [{ field: 'attr:color', direction: 'asc' }, { field: 'attr:capacity', direction: 'asc' }]
expectIds('multi sort, empty values last, stable equal-value order', current, ['a', 'f', 'c', 'b', 'd', 'e'])
current.sorts[0] = { field: 'attr:color', direction: 'desc' }
expectIds('descending keeps empty and inapplicable values last', current, ['b', 'a', 'f', 'c', 'd', 'e'])
current = config(); current.groups = [{ field: 'category', direction: 'asc' }, { field: 'status', direction: 'asc' }]
const paged = querySkuWorkbench(data, current, { now, pageSize: 2 })
assert.equal(paged.total, 6)
assert.equal(paged.rows.length, 2)
assert.deepEqual(paged.groups.find(item => item.labels[0]?.includes('子类'))?.totals, [5, 5])
assert.equal(paged.groups.find(item => item.labels[0]?.includes('子类'))?.total, 5)
const allPages = [1, 2, 3].flatMap(page => querySkuWorkbench(data, current, { now, pageSize: 2, page }).rows.map(row => row.id))
assert.equal(new Set(allPages).size, 6)
assert.deepEqual(allPages, querySkuWorkbench(data, current, { now, pageSize: 100 }).allIds)
current = config(); current.sortMode = 'manual'; current.manualOrder = ['c', 'a', 'b']
expectIds('saved manual order and new-record append', current, ['c', 'a', 'b', 'd', 'e', 'f'])
current.groups = [{ field: 'category', direction: 'asc' }]
const groupedManual = querySkuWorkbench(data, current, { now, pageSize: 100 })
assert.equal(groupedManual.manualBlocked, false)
for (const group of groupedManual.groups) {
  const ids = new Set(group.rows.map(row => row.id))
  assert.deepEqual(group.rows.map(row => row.id), ['c', 'a', 'b', 'd', 'e', 'f'].filter(id => ids.has(id)))
}
const groupedDefault = querySkuWorkbench(data, { ...current, sortMode: 'default' }, { now, pageSize: 100 })
assert.deepEqual(groupedManual.groups.map(group => group.key), groupedDefault.groups.map(group => group.key))
console.log('PASS grouped whole-result counts / stable pagination / manual leaf order independent of group order')
const dynamic = skuFields(data).find(field => field.id === 'attr:color')
assert.equal(dynamic?.type, 'enum')
const renamed = structuredClone(data)
const colorParam = renamed.params.find(param => param.id === 'color')
assert.ok(colorParam); colorParam.name = '机身颜色'
current = config(); current.attributeNames = { color: ['颜色', '机身颜色'] }; current.conditions.children = [rule('attr:color', 'eq', '白色')]
assert.deepEqual(querySkuWorkbench(renamed, current, { now }).allIds, ['a', 'c', 'f'])
const dateData = structuredClone(data)
const first = dateData.skus[0]
assert.ok(first)
first.createdAt = '2026-10-22T05:00:00Z'
current = config(); current.groups = [{ field: 'createdAt', direction: 'asc' }]
const byDate = querySkuWorkbench(dateData, current, { now, pageSize: 100 })
assert.equal(byDate.groups.length, 1)
assert.deepEqual(byDate.groups[0]?.labels, ['2026-10-22'])
assert.equal(byDate.groups[0]?.total, 6)
const noMatch = config(); noMatch.conditions.children = [rule('name', 'eq', '不存在')]
assert.deepEqual(querySkuWorkbench(data, noMatch).groups, [{ key: 'all', keys: [], labels: [], totals: [], total: 0, rows: [] }])
const duplicateLabelData = structuredClone(data)
const namedEmpty = duplicateLabelData.skus[0]
assert.ok(namedEmpty); namedEmpty.oaSkuId = '未记录'
current = config(); current.groups = [{ field: 'oaSkuId', direction: 'asc' }]
const duplicateLabels = querySkuWorkbench(duplicateLabelData, current, { now, pageSize: 100 }).groups
assert.equal(duplicateLabels.length, 2)
assert.deepEqual(duplicateLabels.map(item => item.labels), [['未记录'], ['未记录']])
assert.notDeepEqual(duplicateLabels[0]?.keys, duplicateLabels[1]?.keys)
for (const width of [0, 79, 601, Number.NaN, Number.POSITIVE_INFINITY]) {
  const invalidWidth = config(); invalidWidth.columns[0] = { key: 'code', visible: true, width }
  assert.ok(validateSkuConfig(data, invalidWidth).some(error => error.includes('列宽')))
}
const duplicateColumns = config(); duplicateColumns.columns.push({ key: 'code', visible: false })
assert.ok(validateSkuConfig(data, duplicateColumns).some(error => error.includes('展示字段身份')))
const excessiveFrozen = config(); excessiveFrozen.columns = ['code', 'name', 'status'].map(key => ({ key, visible: true, frozen: 'left' }))
assert.ok(validateSkuConfig(data, excessiveFrozen).some(error => error.includes('最多冻结')))
console.log('PASS same-day timestamp grouping and legal empty-result render group')
console.log('PASS stable group identities and imported width / duplicate-column / frozen validation')
assert.equal(skuFieldValue(data, data.skus[4] as Sku, data.families[1] as ProductFamily, 'attr:color').applicable, false)
function freeze(value: unknown) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) } }
const snapshot = structuredClone(data)
freeze(data); freeze(current)
querySkuWorkbench(data, current, { now })
assert.deepEqual(data, snapshot)
console.log('PASS stable dynamic IDs / observed rename aliases / pure frozen input')
