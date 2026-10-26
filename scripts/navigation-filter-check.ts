import assert from 'node:assert/strict'
import { readNavigation } from '../src/layouts/navigationPreferences'
import { filterSummaries, quickFilterState } from '../src/components/product-list/filterPresentation'
import { emptyModeQuery } from '../src/domain/productListQuery'
import type { ProductListViewFilter } from '../src/domain/types'

const allowed = ['product', 'manage', 'tools']
const read = (value: unknown) => readNavigation(typeof value === 'string' ? value : JSON.stringify(value), allowed, ['product', 'manage'])
assert.deepEqual(read(null), { layout: 'dual', collapsed: false, pinned: false, openeds: ['product', 'manage'] })
for (const value of ['broken', 'null', '[]', '{"mode":"broken"}']) assert.deepEqual(read(value), read(null))
for (const mode of ['single', 'dual'] as const) {
  assert.deepEqual(read({ mode, pinned: true, openeds: ['manage', 'removed', 'manage', 'forbidden'] }), { layout: mode, collapsed: false, pinned: true, openeds: ['manage'] })
  assert.equal(read({ mode: 'icons', expandedMode: mode }).layout, mode)
  assert.equal(read({ mode: 'icons', expandedMode: mode }).collapsed, true)
}
assert.equal(read({ mode: 'dual', menuOpen: false }).collapsed, true)
assert.equal(read({ mode: 'single', menuOpen: false }).collapsed, false)
assert.deepEqual(read({ layout: 'dual', collapsed: true, pinned: false, openeds: [] }), { layout: 'dual', collapsed: true, pinned: false, openeds: [] })
assert.deepEqual(read({ layout: 'single', collapsed: 'false', openeds: [1, 'tools'] }), { layout: 'single', collapsed: false, pinned: false, openeds: ['tools'] })
assert.deepEqual(read({layout:'center',collapsed:true,openeds:['tools','gone']}),{layout:'single',collapsed:true,pinned:false,openeds:['tools']})
assert.equal(read({layout:'dual',pinned:true}).pinned,true)
assert.equal(read({layout:'dual',pinned:'true'}).pinned,false)
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

// List polishing uses the same query contracts; presentation changes never migrate history.
const {createAccessoryCompatibilityFixture}=await import('./accessory-compatibility-fixtures')
const {defaultSkuConfig}=await import('../src/domain/skuWorkbenchState')
const {pinSkuField,clearSkuFilterValues,conditionEntries,setSkuQuickFilterValue,clearSkuQuickFilterValue}=await import('../src/domain/skuQuickFilters')
const {skuFields}=await import('../src/domain/skuWorkbenchFields')
const {querySkuWorkbench}=await import('../src/domain/skuWorkbenchQuery')
const {updateSkuCategorySelection,skuCategorySelection}=await import('../src/domain/skuCategoryFilter')
const {updateProductCategorySelection,productCategorySelection}=await import('../src/domain/productListQuery')
const {categoryFilterCaption,categoryChain}=await import('../src/domain/categoryTree')
const fixture=createAccessoryCompatibilityFixture(),data=fixture.data
 data.categories.push({id:'parent',name:'主机',parentId:null,enabled:true,sort:0});data.categories[0]!.parentId='parent';data.categories[0]!.name='手机'
let config=defaultSkuConfig(),businessBefore=JSON.stringify(data),beforeIds=querySkuWorkbench(data,config).allIds
config=pinSkuField(config,skuFields(data).find(f=>f.id==='attr:attr-color')!)
assert.deepEqual(querySkuWorkbench(data,config).allIds,beforeIds);assert.equal(conditionEntries(config.conditions)[0]!.rule.active,false)
config.conditions.logic='any';config=pinSkuField(config,skuFields(data).find(f=>f.id==='status')!);const refs=JSON.stringify(config.quickFilters)
config=setSkuQuickFilterValue(config,config.quickFilters![1]!, 'on_sale');config=clearSkuFilterValues(config);assert.deepEqual(querySkuWorkbench(data,config).allIds,beforeIds);assert.equal(JSON.stringify(config.quickFilters),refs);assert.equal(config.conditions.logic,'any')
assert.deepEqual(querySkuWorkbench(data,config,{scopeId:'family-device'}).allIds,['phone-a','phone-b'])
const empty=defaultSkuConfig(),parent=updateSkuCategorySelection(empty,['parent'])!,child=updateSkuCategorySelection(parent,['cat-device-test'])!
assert.deepEqual(skuCategorySelection(child).ids,['cat-device-test']);assert.equal(querySkuWorkbench(data,child).total,3);assert.equal(querySkuWorkbench(data,parent).total,3)
const multiple=updateSkuCategorySelection(child,['cat-device-test','cat-accessory-test'])!;assert(querySkuWorkbench(data,multiple).total>3);assert.equal(categoryFilterCaption(data.categories,skuCategorySelection(multiple).ids).label,'分类：手机 等 2 项');assert.deepEqual(categoryChain(data.categories,'cat-device-test').map(c=>c.id),['parent','cat-device-test'])
const precise=defaultSkuConfig();precise.conditions.children=[{kind:'rule',id:'historical',field:'category',operator:'eq',value:'cat-device-test'}];const preciseRaw=JSON.stringify(precise);skuCategorySelection(precise);assert.equal(JSON.stringify(precise),preciseRaw)
precise.conditions.logic='any';assert(!skuCategorySelection(precise).supported);assert.equal(updateSkuCategorySelection(precise,['parent']),undefined)
let spu=updateProductCategorySelection(data,emptyModeQuery(),['parent'])!;spu=updateProductCategorySelection(data,spu,['cat-device-test'])!;assert.deepEqual(productCategorySelection(data,spu).ids,['cat-device-test'])
assert.equal(JSON.stringify(data),businessBefore)
data.skus.find(s=>s.id==='phone-a')!.variantAttrs['颜色']='历史紫色';businessBefore=JSON.stringify(data);let custom=pinSkuField(defaultSkuConfig(),skuFields(data).find(f=>f.id==='attr:attr-color')!);custom=setSkuQuickFilterValue(custom,custom.quickFilters![0]!, '历史紫色');assert.deepEqual(querySkuWorkbench(data,custom).allIds,['phone-a']);assert.equal(JSON.stringify(data),businessBefore);assert(!data.params.find(p=>p.id==='attr-color')!.values.includes('历史紫色'));assert.equal(skuFields(data).find(f=>f.id==='status')!.allowCustom,undefined)
const cleared=clearSkuQuickFilterValue(custom,custom.quickFilters![0]!);assert.equal(conditionEntries(cleared.conditions)[0]!.rule.id,conditionEntries(custom.conditions)[0]!.rule.id);assert.equal(conditionEntries(cleared.conditions)[0]!.rule.operator,conditionEntries(custom.conditions)[0]!.rule.operator)
console.log('PASS list polish: inactive pin, OR clear, scope, category selection, legacy semantics and ID-bound historical attribute queries')
