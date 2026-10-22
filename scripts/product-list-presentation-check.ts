import assert from 'node:assert/strict'
import { presentTableGroups } from '../src/components/product-list/tablePresentation'
import { createSeed } from '../src/domain/seed'
import { presentProductList } from '../src/domain/productListQuery'
import { buildDefaultView } from '../src/domain/productListViews'
import type { ProductListGroup } from '../src/domain/productListQuery'

function freeze(value: unknown) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
}

const data = createSeed()
const sourceSku = data.skus[0]
assert.ok(sourceSku)
const sourceFamily = data.families.find(item => item.id === sourceSku.familyId)
assert.ok(sourceFamily)
const family = { ...sourceFamily, name: '展示用 SPU', categoryId: 'missing', productTypeId: undefined, templateId: 'missing', commonAttrs: { 品牌: '原品牌' } }
const sku = { ...sourceSku, id: 'saved-sku-id', code: '  ', skuName: ' ', variantAttrs: { 颜色: ' 红色 ' }, updatedAt: '2026-10-22T04:05:06.000Z' }
const groups: ProductListGroup[] = [
  { key: 'second', label: '原顺序第一组', total: 30, rows: [
    { id: 'family-only', family },
    { id: 'row-identity', family, sku },
    { id: 'duplicate-source', family, sku },
  ] },
  { key: 'first', label: '空组', total: 0, rows: [] },
]
const original = structuredClone({ data, groups })
freeze(data)
freeze(groups)
const shown = presentTableGroups(data, groups)
assert.deepEqual(shown.map(group => [group.key, group.label, group.total]), [['second', '原顺序第一组', 30], ['first', '空组', 0]])
assert.deepEqual(shown[0]?.skus.map(row => row.id), ['row-identity', 'duplicate-source'])
assert.equal(shown[0]?.families.length, 3)
assert.equal(shown[0]?.families[0], family, 'SPU references must retain existing selection identity')
const row = shown[0]?.skus[0]
assert.ok(row)
assert.equal(row.code, 'saved-sku-id', 'Missing saved code must not allocate a new identifier')
assert.equal(row.name, '红色')
assert.equal(row.spec, '品牌 原品牌 · 颜色  红色 ')
assert.equal(row.typeName, '未记录')
assert.equal(row.modelName, '未关联')
assert.equal(row.updatedAt, '2026-10-22 04:05')
assert.deepEqual(shown[1]?.skus, [])
assert.deepEqual({ data, groups }, original, 'Presentation must never edit inputs')
console.log('PASS presentation order, saved identities, fallbacks and frozen inputs')

const edited = structuredClone(groups)
const editedSku = edited[0]?.rows[1]?.sku
assert.ok(editedSku)
editedSku.skuName = '编辑后的名称'
editedSku.status = 'off_sale'
const refreshed = presentTableGroups(data, edited)
assert.equal(refreshed[0]?.skus[0]?.name, '编辑后的名称')
assert.equal(refreshed[0]?.skus[0]?.status, 'off_sale')
assert.equal(shown[0]?.skus[0]?.name, '红色', 'No retained mutable presentation cache')
assert.deepEqual(presentTableGroups(data, []), [])
console.log('PASS presentation edits refresh without a cross-call cache; empty input')

// The adapter must preserve the query engine's empty-value and equal-value order.
const sortingData = structuredClone(data)
sortingData.families = [
  { ...sourceFamily, id: 'z-empty', name: '' },
  { ...sourceFamily, id: 'b-tie', name: '同名' },
  { ...sourceFamily, id: 'a-empty', name: '' },
  { ...sourceFamily, id: 'a-tie', name: '同名' },
]
const sortingView = buildDefaultView('spu', undefined, '2026-10-22T04:00:00.000Z')
const sortingQuery = sortingView.spuQuery
assert.ok(sortingQuery)
sortingQuery.sortMode = 'field'
freeze(sortingData)
for (const direction of ['asc', 'desc'] as const) {
  sortingQuery.sorting = { field: 'name', direction }
  const queried = presentProductList(sortingData, sortingView, 1, 20)
  const ids = presentTableGroups(sortingData, queried.groups).flatMap(group => group.families.map(item => item.id))
  assert.deepEqual(ids, direction === 'asc'
    ? ['a-empty', 'z-empty', 'a-tie', 'b-tie']
    : ['a-tie', 'b-tie', 'a-empty', 'z-empty'])
}
console.log('PASS queried empty-value / equal-value order survives presentation in both directions')
