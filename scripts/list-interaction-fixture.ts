import { createSeed, emptyQuery } from '../src/domain/seed'
import { emptyModeQuery } from '../src/domain/productListQuery'
import { defaultSkuConfig } from '../src/domain/skuWorkbenchState'
import type { AppData, ProductFamily, ProductListSavedView, Sku } from '../src/domain/types'
export function listInteractionFixture(): AppData {
  const data = createSeed(), sourceFamily = data.families[0], sourceSku = data.skus.find(sku => sku.familyId === sourceFamily.id)!
  data.params.push({ id: 'list-axis', name: '列表属性', values: ['A', 'B', '__empty__'], valueGroups: [], participateInStructure: true })
  data.templates.push({ id: 'list-template', name: '列表测试方案', parentId: null, enabled: true, structureOrder: ['list-axis'] })
  data.templateParams.push({ templateId: 'list-template', paramId: 'list-axis', role: 'variant', required: false })
  data.categories.push({ id: 'list-parent', name: '验收分类', parentId: null, sort: 90, enabled: true }, { id: 'list-child', name: '子类', parentId: 'list-parent', sort: 1, enabled: true }, { id: 'list-grandchild', name: '孙类', parentId: 'list-child', sort: 1, enabled: true }, { id: 'list-other', name: '其他分类', parentId: null, sort: 91, enabled: true }, { id: 'list-alias-1', name: '同路径分类', parentId: null, sort: 92, enabled: true }, { id: 'list-alias-2', name: '同路径分类', parentId: null, sort: 93, enabled: true })
  const records = [
    ['a1', 'list-child', 'A', '共同'], ['a2', 'list-child', 'A', '共同'], ['a3', 'list-grandchild', 'A', '共同'],
    ['b1', 'list-child', 'B', '另组'], ['empty', 'list-child', '', '空值'], ['literal', 'list-child', '__empty__', '字面值'],
    ['na', 'list-child', null, '不适用'], ['outside', 'list-other', 'A', '外部'], ['alias1', 'list-alias-1', 'A', '同名'], ['alias2', 'list-alias-2', 'A', '同名'],
  ] as const
  data.families = records.map(([id, categoryId, axis, name]) => ({ ...JSON.parse(JSON.stringify(sourceFamily)), id: `list-f-${id}`, oaProductId: `LIST-${id}`, name: `${name} ${id}`, templateId: axis === null ? '' : 'list-template', categoryId, commonAttrs: axis === null ? {} : { 列表属性: axis }, productGroupIds: [], line: 'v2', updatedAt: '2026-10-26 12:00:00', createdAt: '2026-10-26 12:00:00', shelfStatus: 'draft' } as ProductFamily))
  data.skus = records.map(([id, , axis]) => ({ ...JSON.parse(JSON.stringify(sourceSku)), id: `list-s-${id}`, familyId: `list-f-${id}`, recordKind: 'sku', materialCode: '', planningId: '', variantAttrs: axis === null ? {} : { 列表属性: axis }, projectedAttrs: {}, manualAttrs: [], specText: '', skuName: `SKU ${id}`, skuCode: `SKU-${id}`, status: 'on_sale', updatedAt: '2026-10-26 12:00:00', createdAt: '2026-10-26 12:00:00' } as Sku))
  data.materialReceipts = []; data.planningRecords = []; data.compatibilities = []; data.listQuery = emptyQuery(); data.listViews = []; data.activeViewId = ''; data.productListViews = [listInteractionSpuView()]; data.activeProductListViewId = 'list-spu-view'; delete data.productListPages
  return data
}
export function listInteractionSpuView(): ProductListSavedView {
  return { id: 'list-spu-view', name: '列表验收', mode: 'spu', spuColumns: [{ key: 'name', visible: true, order: 0 }], skuColumns: [{ key: 'name', visible: true, order: 0 }], spuQuery: emptyModeQuery('spu'), skuQuery: emptyModeQuery('sku'), manualOrder: { spuIds: [], skuIds: [] }, createdAt: '', updatedAt: '' }
}
export function listInteractionSkuConfig() { return defaultSkuConfig() }
export function listRelationshipIdentityFixture(): AppData {
  const data = listInteractionFixture()
  for (const side of ['left', 'right']) {
    data.productTypes.push({ id: `list-type-${side}`, name: '同名产品类型', categoryId: 'list-child', status: 'enabled', sort: 99, description: '' })
    data.templates.push({ id: `list-template-${side}`, name: '同名属性方案', parentId: null, enabled: true, structureOrder: ['list-axis'] })
    data.templateParams.push({ templateId: `list-template-${side}`, paramId: 'list-axis', role: 'variant', required: false })
    const family = data.families.find(item => item.id === `list-f-${side === 'left' ? 'a1' : 'a2'}`)!
    family.productTypeId = `list-type-${side}`; family.templateId = `list-template-${side}`
  }
  return data
}
