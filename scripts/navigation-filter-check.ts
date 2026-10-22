import assert from 'node:assert/strict'
import { readNavigation } from '../src/layouts/navigationPreferences'
import { filterSummaries, quickFilterState } from '../src/components/product-list/filterPresentation'
import { emptyModeQuery } from '../src/domain/productListQuery'
import type { ProductListViewFilter } from '../src/domain/types'

const allowed = ['product', 'manage', 'tools']
const read = (value: unknown) => readNavigation(typeof value === 'string' ? value : JSON.stringify(value), allowed, ['product', 'manage'])
assert.deepEqual(read(null), { layout: 'single', collapsed: false, openeds: ['product', 'manage'] })
for (const value of ['broken', 'null', '[]', '{"mode":"broken"}']) assert.deepEqual(read(value), read(null))
for (const mode of ['single', 'dual'] as const) {
  assert.deepEqual(read({ mode, pinned: true, openeds: ['manage', 'removed', 'manage', 'forbidden'] }), { layout: mode, collapsed: false, openeds: ['manage'] })
  assert.equal(read({ mode: 'icons', expandedMode: mode }).layout, mode)
  assert.equal(read({ mode: 'icons', expandedMode: mode }).collapsed, true)
}
assert.equal(read({ mode: 'dual', menuOpen: false }).collapsed, true)
assert.equal(read({ mode: 'single', menuOpen: false }).collapsed, false)
assert.deepEqual(read({ layout: 'dual', collapsed: true, openeds: [] }), { layout: 'dual', collapsed: true, openeds: [] })
assert.deepEqual(read({ layout: 'single', collapsed: 'false', openeds: [1, 'tools'] }), { layout: 'single', collapsed: false, openeds: ['tools'] })
console.log('PASS navigation migration/defaults/invalid config/permission filtering')

const query = emptyModeQuery('spu')
const category = { field: 'category', label: '商品分类', kind: 'enum' as const }
const brand = { field: 'brand', label: '品牌', kind: 'enum' as const }
const created = { field: 'created', label: '创建日期', kind: 'date' as const }
const name = { field: 'name', label: '商品名称', kind: 'text' as const }
const conditions: ProductListViewFilter[] = [
  { id: 'one', field: 'category', operator: 'in', value: ['phone', 'watch'] },
  { id: 'two', field: 'category', operator: 'neq', value: 'watch' },
  { id: 'three', field: 'brand', operator: 'eq', value: 'Apple' },
  { id: 'four', field: 'brand', operator: 'eq', value: 'Other' },
  { id: 'five', field: 'created', operator: 'between', value: { from: '2026-01-01', to: '2026-10-22' } },
  { id: 'six', field: 'name', operator: 'notContains', value: ['坏', '旧'] },
  { id: 'seven', field: 'created', operator: 'before', value: '' },
  { id: 'empty', field: 'name', operator: 'eq', value: '' },
  { id: 'gone', field: 'deleted', operator: 'eq', value: 'x' },
]
query.filters = conditions; query.keyword = '  iPhone  '
const original = JSON.stringify(query)
assert.equal(quickFilterState(query, category).simple, false)
assert.equal(quickFilterState(query, brand).simple, false)
assert.equal(quickFilterState(query, created).simple, false)
assert.equal(quickFilterState(query, name).simple, false)
const summaries = filterSummaries(query, [category, brand, created, name], value => ({ phone: '手机', watch: '手表' })[value] || value)
assert.deepEqual(summaries.map(item => item.id), ['$keyword', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'])
assert.match(summaries[1]!.label, /手机.*或.*手表/)
assert.match(summaries[2]!.label, /不等于/)
assert.match(summaries[5]!.label, /含边界/)
assert.match(summaries[6]!.label, /不包含.*且/)
assert.match(summaries[7]!.label, /无匹配结果/)
assert.equal(JSON.stringify(query), original)
for (const field of [category, brand, created, name]) assert.equal(quickFilterState(emptyModeQuery('spu'), field).simple, true)
assert.equal(quickFilterState({ ...query, filters: [conditions[0]!] }, category).simple, true)
assert.equal(quickFilterState({ ...query, filters: [conditions[4]!] }, created).simple, true)
assert.equal(quickFilterState({ ...query, filters: [{ id: 'text', field: 'name', operator: 'contains', value: 'phone' }] }, name).simple, true)
assert.deepEqual(filterSummaries(emptyModeQuery('sku'), [category], value => value), [])
console.log('PASS filter AND/OR/exclusion/range/empty date/hidden fields/immutability')
