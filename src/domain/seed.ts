import {completePhoneBenefitDemo} from './benefitSales/demo'
import { arrangeSpecPositions } from './logic'
import { buildDefaultView } from './productListViews'
import { resolveDeviceSku } from './deviceResolution'
import type { AppData, ColumnPref, ListQuery, ProductSpecNode, Sku } from './types'

const now = '2026-05-10T03:53:00.000Z'

export function defaultColumns(): ColumnPref[] {
  return [
    { key: 'name', label: '商品', visible: true, fixed: true },
    { key: 'category', label: '商品分类', visible: true },
    { key: 'template', label: '属性方案', visible: false },
    { key: 'brand', label: '品牌', visible: true },
    { key: 'skuCount', label: '规格数', visible: true },
    { key: 'sale', label: '在售', visible: true },
    { key: 'oaProductId', label: 'OA_ProductID', visible: true },
    { key: 'origin', label: '数据来源', visible: true },
    { key: 'updatedAt', label: '最近维护', visible: true },
  ]
}

export function emptyQuery(): ListQuery {
  return {
    keyword: '',
    categoryId: '',
    brand: '',
    status: '',
    templateId: '',
    productGroupId: '',
    attrFilters: {},
    createdFrom: '',
    createdTo: '',
    shelf: '',
    page: 1,
    pageSize: 10,
    sortProp: 'updatedAt',
    sortOrder: 'descending',
  }
}

/**
 * 全新初始化使用的手机条件分支。
 * 品牌各自往下走，容量决定颜色。不在读取旧 LocalStorage 时调用。
 */
export function phoneSpecNodes(): ProductSpecNode[] {
  const nodes: ProductSpecNode[] = [
    { id: 'sn-brand', templateId: 't-phone', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'p-brand', valueId: '', sort: 1, role: 'COMMON' },
    { id: 'sn-brand-apple', templateId: 't-phone', parentId: 'sn-brand', nodeType: 'VALUE', attributeId: 'p-brand', valueId: 'Apple', sort: 1 },
    { id: 'sn-brand-huawei', templateId: 't-phone', parentId: 'sn-brand', nodeType: 'VALUE', attributeId: 'p-brand', valueId: '华为', sort: 2 },
    { id: 'sn-apple-series', templateId: 't-phone', parentId: 'sn-brand-apple', nodeType: 'ATTRIBUTE', attributeId: 'p-series', valueId: '', sort: 1, role: 'COMMON' },
    { id: 'sn-apple-series-iphone', templateId: 't-phone', parentId: 'sn-apple-series', nodeType: 'VALUE', attributeId: 'p-series', valueId: 'iPhone', sort: 1 },
    { id: 'sn-apple-model', templateId: 't-phone', parentId: 'sn-apple-series-iphone', nodeType: 'ATTRIBUTE', attributeId: 'p-model', valueId: '', sort: 1, role: 'COMMON' },
    { id: 'sn-apple-model-17', templateId: 't-phone', parentId: 'sn-apple-model', nodeType: 'VALUE', attributeId: 'p-model', valueId: 'iPhone 17', sort: 1 },
    { id: 'sn-apple-cap', templateId: 't-phone', parentId: 'sn-apple-model-17', nodeType: 'ATTRIBUTE', attributeId: 'p-cap', valueId: '', sort: 1, role: 'VARIANT' },
    { id: 'sn-apple-cap-128', templateId: 't-phone', parentId: 'sn-apple-cap', nodeType: 'VALUE', attributeId: 'p-cap', valueId: '128G', sort: 1 },
    { id: 'sn-apple-color-128', templateId: 't-phone', parentId: 'sn-apple-cap-128', nodeType: 'ATTRIBUTE', attributeId: 'p-color', valueId: '', sort: 1, role: 'VARIANT' },
    { id: 'sn-apple-128-black', templateId: 't-phone', parentId: 'sn-apple-color-128', nodeType: 'VALUE', attributeId: 'p-color', valueId: '黑色', sort: 1 },
    { id: 'sn-apple-128-white', templateId: 't-phone', parentId: 'sn-apple-color-128', nodeType: 'VALUE', attributeId: 'p-color', valueId: '白色', sort: 2 },
    { id: 'sn-apple-cap-256', templateId: 't-phone', parentId: 'sn-apple-cap', nodeType: 'VALUE', attributeId: 'p-cap', valueId: '256G', sort: 2 },
    { id: 'sn-apple-color-256', templateId: 't-phone', parentId: 'sn-apple-cap-256', nodeType: 'ATTRIBUTE', attributeId: 'p-color', valueId: '', sort: 1, role: 'VARIANT' },
    { id: 'sn-apple-256-white', templateId: 't-phone', parentId: 'sn-apple-color-256', nodeType: 'VALUE', attributeId: 'p-color', valueId: '白色', sort: 1 },
    { id: 'sn-huawei-series', templateId: 't-phone', parentId: 'sn-brand-huawei', nodeType: 'ATTRIBUTE', attributeId: 'p-series', valueId: '', sort: 1, role: 'COMMON' },
    { id: 'sn-huawei-series-mate', templateId: 't-phone', parentId: 'sn-huawei-series', nodeType: 'VALUE', attributeId: 'p-series', valueId: 'Mate', sort: 1 },
    { id: 'sn-huawei-cap', templateId: 't-phone', parentId: 'sn-huawei-series-mate', nodeType: 'ATTRIBUTE', attributeId: 'p-cap', valueId: '', sort: 1, role: 'VARIANT' },
    { id: 'sn-huawei-cap-128', templateId: 't-phone', parentId: 'sn-huawei-cap', nodeType: 'VALUE', attributeId: 'p-cap', valueId: '128G', sort: 1 },
    { id: 'sn-huawei-color', templateId: 't-phone', parentId: 'sn-huawei-cap-128', nodeType: 'ATTRIBUTE', attributeId: 'p-color', valueId: '', sort: 1, role: 'VARIANT' },
    { id: 'sn-huawei-black', templateId: 't-phone', parentId: 'sn-huawei-color', nodeType: 'VALUE', attributeId: 'p-color', valueId: '黑色', sort: 1 },
  ]
  arrangeSpecPositions(nodes)
  return nodes
}

/** 销售演示用的已发布版本。V1 快照保持原样，这里只增加一条能覆盖现有 SPU/SKU 的发布记录。 */
export function phoneDemoV2Nodes(): ProductSpecNode[] {
  const nodes = phoneSpecNodes().map((item) => ({ ...item }))
  const series = nodes.find((item) => item.id === 'sn-apple-series-iphone')
  if (series) series.valueId = 'iPhone 17'
  if (!nodes.some((item) => item.id === 'sn-apple-256-blue')) {
    nodes.push({ id: 'sn-apple-256-blue', templateId: 't-phone', parentId: 'sn-apple-color-256', nodeType: 'VALUE', attributeId: 'p-color', valueId: '蓝色', sort: 2 })
  }
  arrangeSpecPositions(nodes)
  return nodes
}

/** 旧演示把品牌、系列、容量、颜色并列在根上。只保留给历史快照对照，不再作为初始模型。 */
export function legacyPhoneSpecNodes(): ProductSpecNode[] {
  const nodes: ProductSpecNode[] = [
    { id: 'sn-brand', templateId: 't-phone', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'p-brand', valueId: '', sort: 1, role: 'COMMON' },
    { id: 'sn-brand-apple', templateId: 't-phone', parentId: 'sn-brand', nodeType: 'VALUE', attributeId: 'p-brand', valueId: 'Apple', sort: 1 },
    { id: 'sn-brand-huawei', templateId: 't-phone', parentId: 'sn-brand', nodeType: 'VALUE', attributeId: 'p-brand', valueId: '华为', sort: 2 },
    { id: 'sn-series', templateId: 't-phone', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'p-series', valueId: '', sort: 2, role: 'COMMON' },
    { id: 'sn-series-iphone', templateId: 't-phone', parentId: 'sn-series', nodeType: 'VALUE', attributeId: 'p-series', valueId: 'iPhone', sort: 1 },
    { id: 'sn-series-mate', templateId: 't-phone', parentId: 'sn-series', nodeType: 'VALUE', attributeId: 'p-series', valueId: 'Mate', sort: 2 },
    { id: 'sn-color', templateId: 't-phone', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'p-color', valueId: '', sort: 3, role: 'VARIANT' },
    { id: 'sn-color-black', templateId: 't-phone', parentId: 'sn-color', nodeType: 'VALUE', attributeId: 'p-color', valueId: '黑色', sort: 1 },
    { id: 'sn-color-white', templateId: 't-phone', parentId: 'sn-color', nodeType: 'VALUE', attributeId: 'p-color', valueId: '白色', sort: 2 },
    { id: 'sn-cap', templateId: 't-phone', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'p-cap', valueId: '', sort: 4, role: 'VARIANT' },
    { id: 'sn-cap-128', templateId: 't-phone', parentId: 'sn-cap', nodeType: 'VALUE', attributeId: 'p-cap', valueId: '128G', sort: 1 },
    { id: 'sn-cap-256', templateId: 't-phone', parentId: 'sn-cap', nodeType: 'VALUE', attributeId: 'p-cap', valueId: '256G', sort: 2 },
  ]
  arrangeSpecPositions(nodes)
  return nodes
}

/**
 * 显式把正在编辑的手机节点换成正确分支，供随后走现有发布生成新版本。
 * 不改已发布 nodesSnapshot、规划编号、物料和回执。
 */
export function stagePhoneModelCorrection(data: AppData) {
  if (!data.templates.some((item) => item.id === 't-phone')) return { ok: false as const, message: '没有手机模型，不能生成新的修正版本。' }
  const versions = JSON.stringify(data.specModelVersions)
  const plans = JSON.stringify(data.planningRecords || [])
  const skus = JSON.stringify(data.skus)
  const receipts = JSON.stringify(data.materialReceipts || [])
  const previous = data.productSpecNodes
  data.productSpecNodes = [...data.productSpecNodes.filter((item) => item.templateId !== 't-phone'), ...phoneSpecNodes()]
  if (JSON.stringify(data.specModelVersions) !== versions || JSON.stringify(data.planningRecords || []) !== plans || JSON.stringify(data.skus) !== skus || JSON.stringify(data.materialReceipts || []) !== receipts) {
    data.productSpecNodes = previous
    return { ok: false as const, message: '修正碰到了已发布数据，已停止，没有改动。' }
  }
  return { ok: true as const, message: '' }
}

export function phoneCanvas(): AppData['specCanvases'][number] {
  return { templateId: 't-phone', productTypeId: 'pt-phone', name: '手机模型 V1', zoom: 1, panX: 0, panY: 0, status: 'published', version: 1, versionName: 'V1', direction: 'logic', updatedAt: now }
}

export function ebikeSpecNodes(): ProductSpecNode[] {
  const nodes: ProductSpecNode[] = [
    { id: 'sn-ebike-model', templateId: 't-ebike', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'p-ebike-model', valueId: '', sort: 1, role: 'COMMON' },
    { id: 'sn-ebike-city', templateId: 't-ebike', parentId: 'sn-ebike-model', nodeType: 'VALUE', attributeId: 'p-ebike-model', valueId: '都市款', sort: 1 },
    { id: 'sn-ebike-bat', templateId: 't-ebike', parentId: 'sn-ebike-city', nodeType: 'ATTRIBUTE', attributeId: 'p-ebike-battery', valueId: '', sort: 1, role: 'VARIANT' },
    { id: 'sn-ebike-12', templateId: 't-ebike', parentId: 'sn-ebike-bat', nodeType: 'VALUE', attributeId: 'p-ebike-battery', valueId: '48V12Ah', sort: 1 },
    { id: 'sn-ebike-color-12', templateId: 't-ebike', parentId: 'sn-ebike-12', nodeType: 'ATTRIBUTE', attributeId: 'p-ebike-color', valueId: '', sort: 1, role: 'VARIANT' },
    { id: 'sn-ebike-12-black', templateId: 't-ebike', parentId: 'sn-ebike-color-12', nodeType: 'VALUE', attributeId: 'p-ebike-color', valueId: '黑色', sort: 1 },
    { id: 'sn-ebike-12-white', templateId: 't-ebike', parentId: 'sn-ebike-color-12', nodeType: 'VALUE', attributeId: 'p-ebike-color', valueId: '白色', sort: 2 },
    { id: 'sn-ebike-20', templateId: 't-ebike', parentId: 'sn-ebike-bat', nodeType: 'VALUE', attributeId: 'p-ebike-battery', valueId: '48V20Ah', sort: 2 },
    { id: 'sn-ebike-color-20', templateId: 't-ebike', parentId: 'sn-ebike-20', nodeType: 'ATTRIBUTE', attributeId: 'p-ebike-color', valueId: '', sort: 1, role: 'VARIANT' },
    { id: 'sn-ebike-20-gray', templateId: 't-ebike', parentId: 'sn-ebike-color-20', nodeType: 'VALUE', attributeId: 'p-ebike-color', valueId: '灰色', sort: 1 },
    { id: 'sn-ebike-long', templateId: 't-ebike', parentId: 'sn-ebike-model', nodeType: 'VALUE', attributeId: 'p-ebike-model', valueId: '长续航款', sort: 2 },
    { id: 'sn-ebike-long-bat', templateId: 't-ebike', parentId: 'sn-ebike-long', nodeType: 'ATTRIBUTE', attributeId: 'p-ebike-battery', valueId: '', sort: 1, role: 'VARIANT' },
    { id: 'sn-ebike-long-20', templateId: 't-ebike', parentId: 'sn-ebike-long-bat', nodeType: 'VALUE', attributeId: 'p-ebike-battery', valueId: '48V20Ah', sort: 1 },
    { id: 'sn-ebike-long-color', templateId: 't-ebike', parentId: 'sn-ebike-long-20', nodeType: 'ATTRIBUTE', attributeId: 'p-ebike-color', valueId: '', sort: 1, role: 'VARIANT' },
    { id: 'sn-ebike-long-black', templateId: 't-ebike', parentId: 'sn-ebike-long-color', nodeType: 'VALUE', attributeId: 'p-ebike-color', valueId: '黑色', sort: 1 },
    { id: 'sn-ebike-long-gray', templateId: 't-ebike', parentId: 'sn-ebike-long-color', nodeType: 'VALUE', attributeId: 'p-ebike-color', valueId: '灰色', sort: 2 },
  ]
  arrangeSpecPositions(nodes)
  return nodes
}

/** 只在缺少电助力车模型时补演示数据，不覆盖已有商品、规划和模型。 */
export function appendEbikeDemo(data: AppData) {
  if (data.templates.some((item) => item.id === 't-ebike')) return false
  if (!data.categories.some((item) => item.id === 'c-ride')) {
    data.categories.push({ id: 'c-ride', name: '出行', parentId: null, sort: 3, enabled: true })
  }
  if (!data.categories.some((item) => item.id === 'c-ebike')) {
    data.categories.push({ id: 'c-ebike', name: '电助力车', parentId: 'c-ride', sort: 1, enabled: true })
  }
  if (!data.productTypes.some((item) => item.id === 'pt-ebike')) {
    data.productTypes.push({ id: 'pt-ebike', name: '电助力车', categoryId: 'c-ebike', status: 'enabled', sort: 1, description: '演示多层规格路径' })
  }
  data.templates.push({ id: 't-ebike', name: '电助力车', parentId: null, enabled: true, structureOrder: ['p-ebike-model', 'p-ebike-battery', 'p-ebike-color'] })
  const params = [
    { id: 'p-ebike-model', name: '车型', values: ['都市款', '长续航款'], valueGroups: [], participateInStructure: true },
    { id: 'p-ebike-battery', name: '电池', values: ['48V12Ah', '48V20Ah'], valueGroups: [], participateInStructure: true },
    { id: 'p-ebike-color', name: '车身颜色', values: ['黑色', '白色', '灰色'], valueGroups: [], participateInStructure: true },
  ]
  params.forEach((item) => {
    if (!data.params.some((param) => param.id === item.id)) data.params.push(item)
  })
  data.templateParams.push(...assign('t-ebike', [
    ['p-ebike-model', 'common', true],
    ['p-ebike-battery', 'variant', true],
    ['p-ebike-color', 'variant', true],
  ]))
  if (!data.mappings.some((item) => item.templateId === 't-ebike')) data.mappings.push({ templateId: 't-ebike', categoryId: 'c-ebike' })
  const nodes = ebikeSpecNodes()
  data.productSpecNodes.push(...nodes)
  data.specCanvases.push({ templateId: 't-ebike', productTypeId: 'pt-ebike', name: '电助力车模型', zoom: 1, panX: 0, panY: 0, status: 'published', version: 1, versionName: 'V1', direction: 'logic', updatedAt: now })
  data.specModelVersions.push({ id: 'ebike-model-v1', templateId: 't-ebike', version: 1, versionName: 'V1', status: 'published', nodesSnapshot: nodes.map((item) => ({ ...item })), createdTime: now, publishTime: now })
  if (!data.productPlans.some((item) => item.id === 'plan-ebike-city')) {
    data.productPlans.push({ id: 'plan-ebike-city', productModelId: 't-ebike', productTypeId: 'pt-ebike', modelVersionId: 'ebike-model-v1', name: '都市款', status: 'saved', selectedNodes: ['sn-ebike-city'], createdTime: now })
  }
  if (!data.families.some((item) => item.id === 'f-ebike')) {
    data.families.push({
      id: 'f-ebike',
      name: '都市款',
      templateId: 't-ebike',
      productModelId: 't-ebike',
      modelVersionId: 'ebike-model-v1',
      productTypeId: 'pt-ebike',
      productPlanId: 'plan-ebike-city',
      categoryId: 'c-ebike',
      oaProductId: '',
      commonAttrs: { 车型: '都市款' },
      productGroupIds: [],
      lifecycle: 'ready',
      shelfStatus: 'online',
      createdAt: now,
      origin: 'sample',
      updatedAt: now,
    })
    data.skus.push(
      { id: 's-ebike-12-black', familyId: 'f-ebike', code: '', oaSkuId: '', status: 'on_sale', variantAttrs: { 电池: '48V12Ah', 车身颜色: '黑色' }, projectedAttrs: { 车型: '都市款', 电池: '48V12Ah', 车身颜色: '黑色' }, skuName: '48V12Ah 黑色', sourceNodeIds: ['sn-ebike-12', 'sn-ebike-12-black'] },
      { id: 's-ebike-12-white', familyId: 'f-ebike', code: '', oaSkuId: '', status: 'on_sale', variantAttrs: { 电池: '48V12Ah', 车身颜色: '白色' }, projectedAttrs: { 车型: '都市款', 电池: '48V12Ah', 车身颜色: '白色' }, skuName: '48V12Ah 白色', sourceNodeIds: ['sn-ebike-12', 'sn-ebike-12-white'] },
      { id: 's-ebike-20-gray', familyId: 'f-ebike', code: '', oaSkuId: '', status: 'on_sale', variantAttrs: { 电池: '48V20Ah', 车身颜色: '灰色' }, projectedAttrs: { 车型: '都市款', 电池: '48V20Ah', 车身颜色: '灰色' }, skuName: '48V20Ah 灰色', sourceNodeIds: ['sn-ebike-20', 'sn-ebike-20-gray'] },
    )
  }
  return true
}

/** 只校正保护壳这条演示数据，让分类和产品类型不再同名。 */
export function alignCaseDemo(data: AppData) {
  let changed = false
  const phoneAcc = data.categories.find((item) => item.id === 'c-phone-acc')
  if (phoneAcc && phoneAcc.parentId !== null) {
    phoneAcc.parentId = null
    phoneAcc.sort = 3
    changed = true
  }
  const caseCategory = data.categories.find((item) => item.id === 'c-case')
  if (caseCategory && caseCategory.parentId !== 'c-phone-acc') {
    caseCategory.parentId = 'c-phone-acc'
    caseCategory.sort = 1
    changed = true
  }
  const caseType = data.productTypes?.find((item) => item.id === 'pt-case')
  if (caseType) {
    if (caseType.name !== '手机保护壳') {
      caseType.name = '手机保护壳'
      changed = true
    }
    if (caseType.categoryId !== 'c-case') {
      caseType.categoryId = 'c-case'
      changed = true
    }
  }
  if (caseType && data.productTypes.some((item) => item.categoryId === 'c-case' && item.id !== 'pt-case' && (item.id === 'pt-leaf-c-case' || item.name === '保护壳'))) {
    data.productTypes = data.productTypes.filter((item) => !(item.categoryId === 'c-case' && item.id !== 'pt-case' && (item.id === 'pt-leaf-c-case' || item.name === '保护壳')))
    changed = true
  }
  const template = data.templates.find((item) => item.id === 't-case-model')
  if (template && template.name !== '手机保护壳模型') {
    template.name = '手机保护壳模型'
    changed = true
  }
  const canvas = data.specCanvases.find((item) => item.templateId === 't-case-model')
  if (canvas && canvas.name !== '手机保护壳模型') {
    canvas.name = '手机保护壳模型'
    changed = true
  }
  return changed
}

export function ensureLeafProductTypes(data: AppData) {
  const parentIds = new Set(data.categories.map((item) => item.parentId).filter((id): id is string => Boolean(id)))
  let changed = false
  data.categories.forEach((category) => {
    if (parentIds.has(category.id)) return
    if (data.productTypes.some((item) => item.categoryId === category.id)) return
    data.productTypes.push({ id: `pt-leaf-${category.id}`, name: category.name, categoryId: category.id, status: 'enabled', sort: 1, description: '' })
    changed = true
  })
  return changed
}

/** 仅供首次 createSeed／明确演示重置初始化销售样例，不属于旧数据结构兼容。 */
export function ensureSalesShelfDemo(data: AppData) {
  if (data.families.some(item => item.id === 'f-case')) return false
  const type = data.productTypes.find(item => item.id === 'pt-case')
  const canvas = data.specCanvases.find(item => item.templateId === 't-case-model')
  if (!type || type.categoryId !== 'c-case' || !data.categories.some(item => item.id === 'c-case') || !canvas || canvas.productTypeId !== 'pt-case' || !data.templates.some(item => item.id === 't-case-model')) return false
  if (data.skus.some(item => item.id === 's-case-orange' || item.id === 's-case-clear')) return false
  data.families.push({
    id: 'f-case', name: '手机保护壳', templateId: 't-case-model', productModelId: 't-case-model', productTypeId: 'pt-case', categoryId: 'c-case',
    oaProductId: '', commonAttrs: { 品牌: 'Apple' }, productGroupIds: ['g-acc'], lifecycle: 'ready', shelfStatus: 'online', origin: 'sample', createdAt: now, updatedAt: now,
  })
  data.skus.push(
    { id: 's-case-orange', familyId: 'f-case', code: '', oaSkuId: '', skuName: '橙色保护壳', status: 'on_sale', variantAttrs: { 颜色: '橙色' }, projectedAttrs: { 品牌: 'Apple', 颜色: '橙色' } },
    { id: 's-case-clear', familyId: 'f-case', code: '', oaSkuId: '', skuName: '透明保护壳', status: 'on_sale', variantAttrs: { 颜色: '透明' }, projectedAttrs: { 品牌: 'Apple', 颜色: '透明' } },
  )
  return true
}

function originalIphoneDemo(data: AppData) {
  const family = data.families.find((item) => item.id === 'f-iphone')
  const blue = data.skus.find((item) => item.id === 's-iphone-blue' && item.familyId === 'f-iphone')
  const white = data.skus.find((item) => item.id === 's-iphone-white' && item.familyId === 'f-iphone')
  if (!family || !blue || !white) return undefined
  if (family.commonAttrs['系列'] !== 'iPhone 17' || family.commonAttrs['型号'] !== 'iPhone 17') return undefined
  if (blue.variantAttrs['容量'] !== '256G' || blue.variantAttrs['颜色'] !== '蓝色') return undefined
  if (white.variantAttrs['容量'] !== '256G' || white.variantAttrs['颜色'] !== '白色') return undefined
  return { family, blue, white }
}

/** 仅供首次 createSeed／明确演示重置初始化。不得用于已有数据加载、导入或修复。 */
export function ensureDemoPhonePublished(data: AppData) {
  const demo = originalIphoneDemo(data)
  if (!demo) return false
  const { family, blue, white } = demo
  let changed = false
  if (!data.specModelVersions.some((item) => item.id === 'phone-demo-v2')) {
    data.specModelVersions.push({
      id: 'phone-demo-v2', templateId: 't-phone', version: 2, versionName: 'V2', status: 'published',
      nodesSnapshot: phoneDemoV2Nodes().map((item) => ({ ...item })), createdTime: now, publishTime: now,
    })
    changed = true
  }
  if (family.productTypeId !== 'pt-phone') { family.productTypeId = 'pt-phone'; changed = true }
  if (family.productModelId !== 't-phone') { family.productModelId = 't-phone'; changed = true }
  if (family.modelVersionId !== 'phone-demo-v2') { family.modelVersionId = 'phone-demo-v2'; changed = true }
  const bind = (sku: Sku, sourceNodeIds: string[]) => {
    if (sku.modelVersionId !== 'phone-demo-v2') { sku.modelVersionId = 'phone-demo-v2'; changed = true }
    if (JSON.stringify(sku.sourceNodeIds || []) !== JSON.stringify(sourceNodeIds)) { sku.sourceNodeIds = [...sourceNodeIds]; changed = true }
    if (sku.creationSource?.kind !== 'model' || sku.creationSource.templateId !== 't-phone' || sku.creationSource.modelVersionId !== 'phone-demo-v2') {
      sku.creationSource = { kind: 'model', templateId: 't-phone', modelVersionId: 'phone-demo-v2', createdAt: now }
      changed = true
    }
  }
  bind(blue, ['sn-brand-apple', 'sn-apple-series-iphone', 'sn-apple-model-17', 'sn-apple-cap-256', 'sn-apple-256-blue'])
  bind(white, ['sn-brand-apple', 'sn-apple-series-iphone', 'sn-apple-model-17', 'sn-apple-cap-256', 'sn-apple-256-white'])
  return changed
}

function sku(
  id: string,
  familyId: string,
  status: Sku['status'],
  variantAttrs: Record<string, string>,
  oaSkuId = '',
): Sku {
  return { id, familyId, code: '', oaSkuId, status, variantAttrs, projectedAttrs: {} }
}

export function createSeed(includePhoneBenefits=true): AppData {
  const columns = defaultColumns()
  const listQuery = emptyQuery()
  const data: AppData = {
    mode: 'daily',
    activeRole: 'admin',
    categories: [
      { id: 'c-host', name: '主机', parentId: null, sort: 1 },
      { id: 'c-phone', name: '手机', parentId: 'c-host', sort: 1 },
      { id: 'c-pad', name: '平板', parentId: 'c-host', sort: 2 },
      { id: 'c-watch', name: '手表', parentId: 'c-host', sort: 3 },
      { id: 'c-pc', name: '电脑', parentId: 'c-host', sort: 4 },
      { id: 'c-acc', name: '配件', parentId: null, sort: 2 },
      { id: 'c-protect', name: '保护及保护设备', parentId: 'c-acc', sort: 1 },
      { id: 'c-film', name: '保护膜', parentId: 'c-protect', sort: 1 },
      { id: 'c-charge', name: '充电类', parentId: 'c-acc', sort: 2 },
      { id: 'c-phone-acc', name: '手机配件', parentId: null, sort: 3 },
      { id: 'c-case', name: '保护壳', parentId: 'c-phone-acc', sort: 1 },
    ].map((item) => ({ ...item, enabled: true })),
    productTypes: [
      { id: 'pt-phone', name: '手机', categoryId: 'c-phone', status: 'enabled', sort: 1, description: '', catalogRole: 'host' },
      { id: 'pt-phone-part', name: '手机维修零件', categoryId: 'c-phone', status: 'enabled', sort: 2, description: '' },
      { id: 'pt-case', name: '手机保护壳', categoryId: 'c-case', status: 'enabled', sort: 1, description: '', catalogRole: 'accessory' },
      { id: 'pt-film', name: '手机膜', categoryId: 'c-phone-acc', status: 'enabled', sort: 2, description: '', catalogRole: 'accessory' },
    ],
    templates: [
      { id: 't-host', name: '主机', parentId: null, enabled: true, structureOrder: [] },
      {
        id: 't-phone',
        name: '手机',
        parentId: 't-host',
        enabled: true,
        structureOrder: ['p-cap', 'p-brand', 'p-series', 'p-model', 'p-config', 'p-ram', 'p-color', 'p-acc', 'p-country', 'p-type', 'p-net'],
      },
      {
        id: 't-pad',
        name: '平板',
        parentId: 't-host',
        enabled: true,
        structureOrder: ['p-cap', 'p-brand', 'p-series', 'p-model', 'p-color', 'p-conn'],
      },
      {
        id: 't-pc',
        name: '电脑',
        parentId: 't-host',
        enabled: true,
        structureOrder: ['p-brand', 'p-series', 'p-model', 'p-config', 'p-color'],
      },
      {
        id: 't-watch',
        name: 'Apple Watch',
        parentId: 't-host',
        enabled: true,
        structureOrder: ['p-brand', 'p-series', 'p-model', 'p-conn', 'p-case', 'p-size', 'p-color', 'p-band', 'p-band-color', 'p-band-size'],
      },
      { id: 't-acc', name: '配件', parentId: null, enabled: true, structureOrder: [] },
      { id: 't-film', name: '保护膜', parentId: 't-acc', enabled: true, structureOrder: ['p-brand', 'p-color', 'p-acc'] },
      { id: 't-case-model', name: '手机保护壳模型', parentId: null, enabled: true, structureOrder: [] },
    ],
    params: [
      { id: 'p-brand', name: '品牌', values: ['Apple', '华为', 'huawei'], valueGroups: [], participateInStructure: true },
      { id: 'p-series', name: '系列', values: ['iPhone', 'Mate', 'iPhone 17', 'iPhone 16', 'iPhone 15', 'Watch Series 10', 'iPad', 'MacBook'], valueGroups: [], participateInStructure: true },
      { id: 'p-model', name: '型号', values: ['iPhone 17', 'iPhone 17 Pro', 'iPhone 17 Pro Max', 'iPhone 16', 'iPad Air', 'MacBook Air', 'Watch 42'], valueGroups: [], participateInStructure: true, identityRole: 'host-model' },
      { id: 'p-cap', name: '容量', values: ['128G', '256G', '512G'], valueGroups: [{ id: 'vg-cap', name: '常用容量', values: ['128G', '256G'] }], participateInStructure: true },
      { id: 'p-color', name: '颜色', values: ['蓝色', '白色', '橙色', '黑色', '银色', '透明'], valueGroups: [], participateInStructure: true },
      { id: 'p-config', name: '配置', values: ['M4 16GB/256GB'], valueGroups: [], participateInStructure: true },
      { id: 'p-ram', name: '内存', values: ['8GB'], valueGroups: [], participateInStructure: true },
      { id: 'p-country', name: '国家', values: ['国行'], valueGroups: [], participateInStructure: true },
      { id: 'p-type', name: '类型', values: ['演示机'], valueGroups: [], participateInStructure: true },
      { id: 'p-net', name: '网络版本', values: ['A1533（电信）'], valueGroups: [], participateInStructure: true },
      { id: 'p-acc', name: '配件', values: ['简版'], valueGroups: [], participateInStructure: true },
      { id: 'p-conn', name: '连接', values: ['Wi-Fi', 'WLAN Cellular'], valueGroups: [], participateInStructure: true },
      { id: 'p-case', name: '表壳', values: ['铝金属表壳'], valueGroups: [], participateInStructure: true },
      { id: 'p-size', name: '尺寸', values: ['40MM', '42MM', '44MM', '46MM'], valueGroups: [], participateInStructure: true },
      { id: 'p-band', name: '表带类型', values: ['运动表带'], valueGroups: [], participateInStructure: true },
      { id: 'p-band-color', name: '表带颜色', values: ['黑色'], valueGroups: [], participateInStructure: true },
      { id: 'p-band-size', name: '表带尺码', values: ['S/M', 'M/L'], valueGroups: [], participateInStructure: true },
    ],
    templateParams: [
      ...phoneParams(),
      ...assign('t-pad', [
        ['p-brand', 'common', true],
        ['p-series', 'common', true],
        ['p-model', 'common', true],
        ['p-cap', 'variant', true],
        ['p-color', 'variant', true],
        ['p-conn', 'variant', false],
      ]),
      ...assign('t-pc', [
        ['p-brand', 'common', true],
        ['p-series', 'common', true],
        ['p-model', 'common', true],
        ['p-config', 'variant', true],
        ['p-color', 'variant', false],
      ]),
      ...assign('t-watch', [
        ['p-brand', 'common', true],
        ['p-series', 'common', true],
        ['p-model', 'common', true],
        ['p-conn', 'variant', false],
        ['p-case', 'variant', false],
        ['p-size', 'variant', true],
        ['p-color', 'variant', true],
        ['p-band', 'variant', false],
        ['p-band-color', 'variant', false],
        ['p-band-size', 'variant', false],
      ]),
      ...assign('t-film', [
        ['p-brand', 'common', true],
        ['p-color', 'variant', true],
        ['p-acc', 'variant', false],
      ]),
    ],
    mappings: [
      { templateId: 't-phone', categoryId: 'c-phone' },
      { templateId: 't-pad', categoryId: 'c-pad' },
      { templateId: 't-pc', categoryId: 'c-pc' },
      { templateId: 't-watch', categoryId: 'c-watch' },
      { templateId: 't-film', categoryId: 'c-film' },
    ],
    productSpecNodes: phoneSpecNodes(),
    specCanvases: [
      phoneCanvas(),
      { templateId: 't-case-model', productTypeId: 'pt-case', name: '手机保护壳模型', zoom: 1, panX: 0, panY: 0, status: 'draft', version: 1, versionName: 'V1', direction: 'ltr', updatedAt: now },
    ],
    specModelVersions: [
      {
        id: 'phone-model-v1',
        templateId: 't-phone',
        version: 1,
        versionName: 'V1',
        status: 'published',
        nodesSnapshot: phoneSpecNodes(),
        createdTime: now,
        publishTime: now,
      },
    ],
    productPlans: [],
    planningRecords: [],
    materialReceipts: [],
    compatibilities: [],
    nodeCompatibilityRules: [],
    rules: [
      rule('r1', 't-phone', 'p-series', ['p-brand'], { 'p-brand': 'Apple' }, ['iPhone 17', 'iPhone 16'], 'Apple 只能选这两个系列'),
      rule('r2', 't-phone', 'p-model', ['p-brand', 'p-series'], { 'p-brand': 'Apple', 'p-series': 'iPhone 17' }, ['iPhone 17', 'iPhone 17 Pro'], 'iPhone 17 系列的型号'),
      rule('r3', 't-phone', 'p-cap', ['p-brand', 'p-series', 'p-model'], { 'p-brand': 'Apple', 'p-series': 'iPhone 17', 'p-model': 'iPhone 17' }, ['128G', '256G'], '这个型号没有 512G'),
      rule('r4', 't-phone', 'p-color', ['p-brand', 'p-series', 'p-model', 'p-cap'], { 'p-brand': 'Apple', 'p-series': 'iPhone 17', 'p-model': 'iPhone 17', 'p-cap': '128G' }, ['蓝色', '白色', '橙色'], '只限制了 128G 的颜色'),
      {
        id: 'r-old',
        templateId: 't-phone',
        targetParamId: 'p-removed',
        sourceParamIds: ['p-removed-brand'],
        conditions: { 'p-removed-brand': '苹果' },
        options: ['iPhone15'],
        enabled: false,
        note: '旧系统残留。参数已经不在词典里，不能无损并进现行规则，只作参考。',
        legacy: true,
      },
    ],
    families: [
      family('f-iphone', 'Apple iPhone 17', 't-phone', 'c-phone', { 品牌: 'Apple', 系列: 'iPhone 17', 型号: 'iPhone 17' }, ['g-phone'], 'sample', now, 'phone-model-v1'),
      family('f-watch', 'Apple Watch 演示款', 't-watch', 'c-watch', { 品牌: 'Apple', 系列: 'Watch Series 10', 型号: 'Watch 42' }, ['g-watch'], 'sample', '2026-05-12T02:00:00.000Z'),
      family('f-pad', 'iPad Air 演示款', 't-pad', 'c-pad', { 品牌: 'Apple', 系列: 'iPad', 型号: 'iPad Air' }, [], 'sample', '2026-05-11T02:00:00.000Z'),
      family('f-mac', 'MacBook Air 演示款', 't-pc', 'c-pc', { 品牌: 'Apple', 系列: 'MacBook', 型号: 'MacBook Air' }, [], 'sample', '2026-05-09T02:00:00.000Z'),
      family('f-film', '保护膜演示款', 't-film', 'c-film', { 品牌: 'Apple' }, ['g-acc'], 'sample', '2026-05-08T02:00:00.000Z'),
    ],
    skus: [
      sku('s-iphone-blue', 'f-iphone', 'on_sale', { 容量: '256G', 颜色: '蓝色', 配件: '', 网络版本: '', 配置: '', 内存: '', 国家: '', 类型: '' }),
      sku('s-iphone-white', 'f-iphone', 'on_sale', { 容量: '256G', 颜色: '白色', 配件: '简版', 网络版本: 'A1533（电信）', 配置: '', 内存: '', 国家: '', 类型: '' }),
      sku('s-watch-1', 'f-watch', 'on_sale', { 连接: 'Wi-Fi', 表壳: '铝金属表壳', 尺寸: '42MM', 颜色: '黑色', 表带类型: '运动表带', 表带颜色: '黑色', 表带尺码: 'S/M' }),
      sku('s-watch-2', 'f-watch', 'draft', { 连接: 'WLAN Cellular', 表壳: '', 尺寸: '46MM', 颜色: '白色', 表带类型: '', 表带颜色: '', 表带尺码: '' }),
      sku('s-pad-1', 'f-pad', 'on_sale', { 容量: '256G', 颜色: '蓝色', 连接: 'Wi-Fi' }),
      sku('s-mac-1', 'f-mac', 'on_sale', { 配置: 'M4 16GB/256GB', 颜色: '银色' }),
      sku('s-film-1', 'f-film', 'on_sale', { 颜色: '透明', 配件: '' }),
    ],
    brands: [
      { id: 'brand-apple', name: 'Apple', logo: '', description: '预设品牌，历史商品仍读取公共属性里的品牌。', status: 'enabled' },
      { id: 'brand-huawei', name: 'huawei', logo: '', description: '', status: 'enabled' },
    ],
    productGroups: [
      { id: 'g-phone', name: '手机运营组', parentId: null },
      { id: 'g-watch', name: '手表运营组', parentId: null },
      { id: 'g-acc', name: '配件运营组', parentId: null },
      { id: 'g-hot', name: '主推', parentId: 'g-phone' },
    ],
    users: [
      { id: 'u-op', username: 'operator', displayName: '运营同事', role: 'operator', enabled: true },
      { id: 'u-admin', username: 'manager', displayName: '配置管理员', role: 'admin', enabled: true },
    ],
    feedbacks: [
      { id: 'fb-1', title: '希望少跳几个页面', content: '录入两个颜色不要建成两款商品。', status: 'doing', page: '商品编辑', createdAt: now },
    ],
    profile: { displayName: '演示用户', username: 'demo' },
    columns,
    listViews: [{ id: 'view-all', name: '全部商品', query: listQuery, columns }],
    activeViewId: 'view-all',
    listQuery,
    productListMode: 'spu',
    productListViews: [buildDefaultView('spu', columns, now)],
    activeProductListViewId: 'view-default',
  }
  appendEbikeDemo(data)
  ensureLeafProductTypes(data)
  ensureSalesShelfDemo(data)
  ensureDemoPhonePublished(data)
  // createSeed is used only for first demonstration initialization or an explicit reset.
  // Never add evidence while loading existing user records.
  const demoDevice = resolveDeviceSku(data, 's-iphone-blue')
  if (demoDevice.status === 'resolved' && demoDevice.host && data.skus.some(s => s.id === 's-case-clear')) {
    data.compatibilities.push({
      id: 'demo-benefit-case', accessorySkuId: 's-case-clear', targetKind: 'sku', targetId: 's-case-clear',
      host: demoDevice.host, capability: 'basic', conclusion: 'compatible', verification: 'confirmed', conditions: [],
      source: '仅供初始化演示：透明保护壳与演示 iPhone 的适用链，不代表真实商品核验',
      note: '演示依据', createdAt: now, updatedAt: now,
    })
  }
  if(includePhoneBenefits)completePhoneBenefitDemo(data)
  data.skus = data.skus.map((item) => {
    const owner = data.families.find((family) => family.id === item.familyId)
    if (!owner) return item
    const projected = { ...owner.commonAttrs }
    Object.entries(item.variantAttrs).forEach(([key, value]) => {
      if (value) projected[key] = value
    })
    Object.keys(projected).forEach((key) => {
      if (!projected[key]) delete projected[key]
    })
    return { ...item, projectedAttrs: projected }
  })
  return data
}

function phoneParams(): AppData['templateParams'] {
  return assign('t-phone', [
    ['p-brand', 'common', true],
    ['p-series', 'common', true],
    ['p-model', 'common', true],
    ['p-cap', 'variant', true],
    ['p-color', 'variant', true],
    ['p-acc', 'variant', false],
    ['p-net', 'variant', false],
    ['p-config', 'variant', false],
    ['p-ram', 'variant', false],
    ['p-country', 'variant', false],
    ['p-type', 'variant', false],
  ])
}

function assign(templateId: string, rows: [string, 'common' | 'variant', boolean][]): AppData['templateParams'] {
  return rows.map(([paramId, role, required]) => ({ templateId, paramId, role, required }))
}

function rule(
  id: string,
  templateId: string,
  targetParamId: string,
  sourceParamIds: string[],
  conditions: Record<string, string>,
  options: string[],
  note: string,
): AppData['rules'][number] {
  return { id, templateId, targetParamId, sourceParamIds, conditions, options, enabled: true, note, legacy: false }
}

function family(
  id: string,
  name: string,
  templateId: string,
  categoryId: string,
  commonAttrs: Record<string, string>,
  productGroupIds: string[],
  origin: 'sample' | 'created',
  updatedAt: string,
  modelVersionId = '',
): AppData['families'][number] {
  return { id, name, templateId, modelVersionId, categoryId, oaProductId: '', commonAttrs, productGroupIds, lifecycle: 'ready', shelfStatus: 'online', createdAt: updatedAt, origin, updatedAt }
}
