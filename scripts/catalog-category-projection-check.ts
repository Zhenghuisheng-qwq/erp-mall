import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import { catalogExpandableCategoryIds, compareCatalogCategories, defaultCatalogTreeExpandedIds, projectCatalogCategories } from '../src/domain/catalogCategoryProjection'
import { buildCatalogWorkspaceIndex } from '../src/domain/catalogWorkspaceQuery'
import type { Category } from '../src/domain/types'
import { catalogCategory, createCatalogWorkspaceFixture } from './catalog-workspace-fixtures'

const category = (id: string, parentId: string | null, name: string, extra: Partial<Category> = {}): Category => ({ ...catalogCategory(id, parentId, name), ...extra })
const ids = (rows: { id: string }[]) => rows.map(row => row.id)
const project = (categories: readonly Category[], extra: Partial<Parameters<typeof projectCatalogCategories>[0]> = {}) => projectCatalogCategories({ categories, layout: 'tree', sort: 'name', keyword: '', status: '', expandedIds: [], ...extra })

let groups = 0
const mark = (message: string) => console.log(`PASS ${++groups}: ${message}`)

const flat = [category('only', null, '单层')]
assert.deepEqual(ids(project(flat).rows), ['only'])
assert.equal(project(flat).rows[0]?.depth, 0)
assert.equal(project(flat).rows[0]?.hasChildren, false)
mark('single level renders without a fake expander')

const tree = [
  category('host', null, '主机', { sort: 2 }),
  category('phone', 'host', '手机', { sort: 2 }),
  category('pad', 'host', '平板', { sort: 1 }),
  category('smart', 'phone', '智能手机'),
  category('film', 'shell', '保护膜'),
  category('shell', 'acc', '保护壳'),
  category('acc', null, '配件', { sort: 1 }),
  category('same', 'acc', '保护膜'),
]
const beforeTree = JSON.stringify(tree)
const opened = project(tree, { expandedIds: catalogExpandableCategoryIds(tree) })
const position = new Map(ids(opened.rows).map((id, index) => [id, index]))
for (const row of opened.rows) if (row.parentId && position.has(row.parentId)) assert.ok(position.get(row.parentId)! < position.get(row.id)!)
assert.equal(opened.rows.find(row => row.id === 'phone')?.parentId, 'host')
assert.equal(opened.rows.find(row => row.id === 'phone')?.depth, 1)
assert.equal(opened.rows.find(row => row.id === 'smart')?.depth, 2)
assert.equal(opened.rows.find(row => row.id === 'film')?.path, '配件 / 保护壳 / 保护膜')
assert.equal(opened.rows.find(row => row.id === 'same')?.path, '配件 / 保护膜')
assert.notEqual(opened.rows.find(row => row.id === 'film')?.path, opened.rows.find(row => row.id === 'same')?.path)
assert.deepEqual(defaultCatalogTreeExpandedIds(tree).sort(), ['acc', 'host', 'phone', 'shell'])
const topOnly = project(tree, { expandedIds: ['host', 'acc'] })
assert.equal(topOnly.rows.some(row => row.id === 'smart'), false)
assert.equal(topOnly.rows.some(row => row.id === 'phone'), true)
assert.equal(topOnly.rows.find(row => row.id === 'phone')?.hasChildren, true)
assert.equal(JSON.stringify(tree), beforeTree)
mark('parentId builds the tree, same names stay distinct, and the first two levels expand by default')

const hostChildren = project(tree, { sort: 'name-desc', expandedIds: ['host'] }).rows.filter(row => row.parentId === 'host').map(row => row.id)
assert.deepEqual(hostChildren, ['phone', 'pad'].sort((a, b) => compareCatalogCategories(tree.find(row => row.id === a)!, tree.find(row => row.id === b)!, 'name-desc')))
assert.equal(project(tree, { sort: 'name-desc', expandedIds: ['host'] }).rows.find(row => row.id === 'pad')?.depth, 1)
const lifted = [category('m-parent', null, 'm-parent'), category('a-child', 'm-parent', 'a-child'), category('z-child', 'm-parent', 'z-child')]
assert.deepEqual(ids(project(lifted, { expandedIds: ['m-parent'] }).rows), ['m-parent', 'a-child', 'z-child'])
assert.deepEqual(ids(project(lifted, { sort: 'name-desc', expandedIds: ['m-parent'] }).rows), ['m-parent', 'z-child', 'a-child'])
const liftedList = project(lifted, { layout: 'list', sort: 'name' })
assert.deepEqual(ids(liftedList.rows), ['a-child', 'm-parent', 'z-child'])
assert.ok(ids(liftedList.rows).indexOf('a-child') < ids(liftedList.rows).indexOf('m-parent'))
assert.deepEqual(ids(opened.rows).sort(), ids(project(tree, { layout: 'list' }).rows).sort())
const disabled = [category('parent', null, '父级'), category('off', 'parent', '停用子级', { enabled: false }), category('on', 'parent', '启用子级')]
const byStatus = project(disabled, { sort: 'status', expandedIds: ['parent'] })
assert.deepEqual(ids(byStatus.rows), ['parent', 'on', 'off'])
assert.equal(byStatus.rows.find(row => row.id === 'off')?.enabled, false)
mark('tree sort stays inside siblings; list sort is global; disabled categories remain')

const found = project(tree, { keyword: '保护膜', expandedIds: [] })
assert.deepEqual(ids(found.rows).sort(), ['acc', 'film', 'same', 'shell'])
assert.ok(ids(found.rows).indexOf('acc') < ids(found.rows).indexOf('shell') && ids(found.rows).indexOf('shell') < ids(found.rows).indexOf('film'))
assert.equal(found.rows.find(row => row.id === 'film')?.relation, 'hit')
assert.equal(found.rows.find(row => row.id === 'shell')?.relation, 'path')
assert.equal(found.rows.find(row => row.id === 'acc')?.relation, 'path')
assert.equal(found.rows.find(row => row.id === 'host'), undefined)
const byCode = project(tree, { keyword: 'SMART', expandedIds: [] })
assert.deepEqual(ids(byCode.rows), ['host', 'phone', 'smart'])
const byPath = project(tree, { keyword: '保护壳 / 保护膜', expandedIds: [] })
assert.equal(byPath.rows.find(row => row.id === 'film')?.relation, 'hit')
assert.equal(byPath.rows.some(row => row.id === 'shell'), true)
const parentHit = project(tree, { keyword: 'host', expandedIds: [] })
assert.deepEqual(ids(parentHit.rows).sort(), ['host', 'pad', 'phone', 'smart'])
assert.ok(ids(parentHit.rows).indexOf('host') < ids(parentHit.rows).indexOf('phone') && ids(parentHit.rows).indexOf('phone') < ids(parentHit.rows).indexOf('smart'))
assert.equal(parentHit.rows.find(row => row.id === 'pad')?.relation, 'context')
const statusOnly = project([...tree, category('retired', 'host', '停用主机', { enabled: false })], { status: 'disabled', expandedIds: [] })
assert.equal(statusOnly.rows.find(row => row.id === 'retired')?.relation, 'hit')
assert.equal(statusOnly.rows.find(row => row.id === 'host')?.relation, 'path')
assert.equal(statusOnly.rows.some(row => row.id === 'phone'), false)
assert.equal(project(tree, { keyword: '不存在的分类' }).empty, 'search')
assert.equal(project(tree, { status: 'disabled' }).empty, 'status')
assert.equal(project(tree, { keyword: '手机', status: 'disabled' }).empty, 'both')
assert.equal(project([], ).empty, 'none')
const listHit = project(tree, { layout: 'list', keyword: '保护膜' })
assert.deepEqual(ids(listHit.rows).sort(), ['film', 'same'])
assert.equal(listHit.rows.find(row => row.id === 'film')?.path, '配件 / 保护壳 / 保护膜')
mark('search keeps ancestor paths, matches code and full path, and list rows carry the real path')

const broken = [
  category('root', null, '正常根'),
  category('child', 'root', '正常子级'),
  category('orphan', 'missing', '上级缺失'),
  category('orphan-child', 'orphan', '缺失上级的子级'),
  category('loop-a', 'loop-b', '环A'),
  category('loop-b', 'loop-a', '环B'),
  category('self', 'self', '自指'),
]
const brokenBefore = JSON.stringify(broken)
const safe = project(broken, { expandedIds: catalogExpandableCategoryIds(broken) })
assert.equal(safe.rows.length, broken.length)
assert.equal(new Set(ids(safe.rows)).size, broken.length)
assert.equal(safe.anomalyTotal, 4)
assert.equal(safe.rows.find(row => row.id === 'orphan')?.anomaly, 'missing-parent')
assert.equal(safe.rows.find(row => row.id === 'self')?.anomaly, 'self-parent')
assert.equal(safe.rows.find(row => row.id === 'loop-a')?.anomaly, 'cycle')
assert.equal(safe.rows.find(row => row.id === 'loop-b')?.anomaly, 'cycle')
assert.equal(safe.rows.find(row => row.id === 'orphan')?.depth, 0)
assert.equal(safe.rows.find(row => row.id === 'orphan-child')?.depth, 1)
assert.equal(safe.rows.find(row => row.id === 'child')?.section, 'main')
assert.equal(safe.rows.find(row => row.id === 'loop-a')?.section, 'anomaly')
assert.equal(JSON.stringify(broken), brokenBefore)
assert.equal(broken.find(row => row.id === 'orphan')?.parentId, 'missing')
mark('missing parents, self parents and cycles stay visible without recursion or data repair')

const many: Category[] = [category('top', null, '规模根')]
for (let index = 0; index < 2400; index += 1) many.push(category(`n${index}`, index % 24 === 0 ? 'top' : `n${index - 1}`, `规模 ${String(index).padStart(4, '0')}`, { enabled: index % 19 !== 0, sort: index }))
many.push(category('cycle-a', 'cycle-b', '循环甲'), category('cycle-b', 'cycle-a', '循环乙'), category('lost', 'absent', '失联'))
const started = performance.now()
const expandedMany = project(many, { expandedIds: catalogExpandableCategoryIds(many) })
const listedMany = project(many, { layout: 'list', sort: 'name-desc' })
const elapsed = performance.now() - started
assert.equal(expandedMany.rows.length, many.length)
assert.equal(listedMany.rows.length, many.length)
assert.equal(expandedMany.rows.find(row => row.id === 'lost')?.anomaly, 'missing-parent')
assert.ok(elapsed < 1500, `projection took ${elapsed.toFixed(1)}ms`)
const scaleIndex = ids(expandedMany.rows).indexOf('top')
assert.ok(scaleIndex >= 0 && ids(expandedMany.rows).indexOf('n0') > scaleIndex)
mark(`large tree of ${many.length} categories projects both layouts in ${elapsed.toFixed(1)}ms without losing anomalies`)

const data = createCatalogWorkspaceFixture()
const businessBefore = JSON.stringify({ categories: data.categories, productTypes: data.productTypes, families: data.families, skus: data.skus, specCanvases: data.specCanvases, specModelVersions: data.specModelVersions })
const index = buildCatalogWorkspaceIndex(data)
const rootCurrent = index.categoryMetrics('root', false)
const rootWith = index.categoryMetrics('root', true)
const phoneCurrent = index.categoryMetrics('phone', false)
const phoneWith = index.categoryMetrics('phone', true)
assert.deepEqual([...rootCurrent.spus.ids].sort(), ['spu-parent'])
assert.deepEqual([...rootCurrent.skus.ids].sort(), ['sku-parent'])
assert.equal(rootCurrent.types.count, 0)
assert.equal(rootWith.spus.count, 6)
assert.deepEqual([...rootWith.skus.ids].sort(), ['sku-child', 'sku-legacy', 'sku-mixed', 'sku-parent'])
assert.deepEqual([...rootWith.materials.ids].sort(), ['mat-mixed', 'mat-one', 'mat-two'])
assert.ok(!rootWith.skus.ids.includes('mat-one'))
assert.ok(!rootWith.materials.ids.includes('sku-child'))
assert.equal(rootWith.types.count, new Set(rootWith.types.ids).size)
assert.equal(rootWith.models.count, new Set(rootWith.models.ids).size)
assert.deepEqual([...phoneCurrent.spus.ids].sort(), data.families.filter(row => row.categoryId === 'phone').map(row => row.id).sort())
assert.equal(phoneCurrent.spus.ids.includes('spu-child'), false)
assert.equal(phoneWith.spus.ids.includes('spu-child'), true)
assert.equal(phoneWith.spus.ids.includes('spu-legacy'), true)
assert.equal(phoneWith.spus.count, new Set(phoneWith.spus.ids).size)
const catalogRows = data.categories
const treeMetrics = project(catalogRows, { expandedIds: catalogExpandableCategoryIds(catalogRows) })
const listMetrics = project(catalogRows, { layout: 'list' })
assert.deepEqual(ids(treeMetrics.rows).sort(), ids(listMetrics.rows).sort())
assert.equal(treeMetrics.rows.find(row => row.id === 'bad-parent')?.anomaly, 'missing-parent')
assert.equal(treeMetrics.rows.some(row => row.id === 'leaf'), true)
for (const id of ['root', 'phone', 'leaf']) {
  assert.equal(index.categoryMetrics(id, true).spus.count, index.categoryMetrics(id, true).spus.count)
  assert.deepEqual(index.categoryMetrics(id, false).spus.ids, index.categoryMetrics(id, false).spus.ids)
}
assert.equal(JSON.stringify({ categories: data.categories, productTypes: data.productTypes, families: data.families, skus: data.skus, specCanvases: data.specCanvases, specModelVersions: data.specModelVersions }), businessBefore)
console.log(`STATS root 仅本级 SPU ${rootCurrent.spus.count}/SKU ${rootCurrent.skus.count}/类型 ${rootCurrent.types.count}；包含下级 SPU ${rootWith.spus.count}/SKU ${rootWith.skus.count}/MAT ${rootWith.materials.count}/类型 ${rootWith.types.count}/模型 ${rootWith.models.count}`)
console.log(`STATS phone 仅本级 SPU ${phoneCurrent.spus.count}/SKU ${phoneCurrent.skus.count}；包含下级 SPU ${phoneWith.spus.count}/SKU ${phoneWith.skus.count}/MAT ${phoneWith.materials.count}；leaf 仅本级 SPU ${index.categoryMetrics('leaf', false).spus.count}`)
mark('current and descendant metrics stay deduplicated, and both layouts expose the same categories')

console.log(`PASS catalog category projection ${groups} groups`)
