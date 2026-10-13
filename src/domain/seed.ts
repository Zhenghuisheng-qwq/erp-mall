import { arrangeSpecPositions } from './logic'
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

export function phoneSpecNodes(): ProductSpecNode[] {
  const nodes: ProductSpecNode[] = [
    { id: 'sn-brand', templateId: 't-phone', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'p-brand', valueId: '', sort: 1, role: 'COMMON' },
    { id: 'sn-apple', templateId: 't-phone', parentId: 'sn-brand', nodeType: 'VALUE', attributeId: 'p-brand', valueId: 'Apple', sort: 1 },
    { id: 'sn-model', templateId: 't-phone', parentId: 'sn-apple', nodeType: 'ATTRIBUTE', attributeId: 'p-model', valueId: '', sort: 1, role: 'COMMON' },
    { id: 'sn-ip17', templateId: 't-phone', parentId: 'sn-model', nodeType: 'VALUE', attributeId: 'p-model', valueId: 'iPhone 17', sort: 1 },
    { id: 'sn-cap', templateId: 't-phone', parentId: 'sn-ip17', nodeType: 'ATTRIBUTE', attributeId: 'p-cap', valueId: '', sort: 1, role: 'VARIANT' },
    { id: 'sn-128', templateId: 't-phone', parentId: 'sn-cap', nodeType: 'VALUE', attributeId: 'p-cap', valueId: '128G', sort: 1 },
    { id: 'sn-color-128', templateId: 't-phone', parentId: 'sn-128', nodeType: 'ATTRIBUTE', attributeId: 'p-color', valueId: '', sort: 1, role: 'VARIANT' },
    { id: 'sn-black-128', templateId: 't-phone', parentId: 'sn-color-128', nodeType: 'VALUE', attributeId: 'p-color', valueId: '黑色', sort: 1 },
    { id: 'sn-white-128', templateId: 't-phone', parentId: 'sn-color-128', nodeType: 'VALUE', attributeId: 'p-color', valueId: '白色', sort: 2 },
    { id: 'sn-256', templateId: 't-phone', parentId: 'sn-cap', nodeType: 'VALUE', attributeId: 'p-cap', valueId: '256G', sort: 2 },
    { id: 'sn-color', templateId: 't-phone', parentId: 'sn-256', nodeType: 'ATTRIBUTE', attributeId: 'p-color', valueId: '', sort: 1, role: 'VARIANT' },
    { id: 'sn-black', templateId: 't-phone', parentId: 'sn-color', nodeType: 'VALUE', attributeId: 'p-color', valueId: '黑色', sort: 1 },
    { id: 'sn-white', templateId: 't-phone', parentId: 'sn-color', nodeType: 'VALUE', attributeId: 'p-color', valueId: '白色', sort: 2 },
  ]
  arrangeSpecPositions(nodes)
  return nodes
}

export function phoneCanvas(): AppData['specCanvases'][number] {
  return { templateId: 't-phone', zoom: 1, panX: 0, panY: 0, status: 'published', version: 1, versionName: 'V1', direction: 'ltr' }
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

export function createSeed(): AppData {
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
      { id: 'c-case', name: '保护壳', parentId: 'c-protect', sort: 2 },
      { id: 'c-charge', name: '充电类', parentId: 'c-acc', sort: 2 },
    ].map((item) => ({ ...item, enabled: true })),
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
    ],
    params: [
      { id: 'p-brand', name: '品牌', values: ['Apple', 'huawei'], valueGroups: [], participateInStructure: true },
      { id: 'p-series', name: '系列', values: ['iPhone 17', 'iPhone 16', 'iPhone 15', 'Watch Series 10', 'iPad', 'MacBook'], valueGroups: [], participateInStructure: true },
      { id: 'p-model', name: '型号', values: ['iPhone 17', 'iPhone 17 Pro', 'iPhone 17 Pro Max', 'iPhone 16', 'iPad Air', 'MacBook Air', 'Watch 42'], valueGroups: [], participateInStructure: true },
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
    specCanvases: [phoneCanvas()],
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
  }
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
