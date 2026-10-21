import { legalComboMaterialStatus } from './comboMaterialStatus'
import { createV3Material, updateV3Material } from './material'
import { filedNameSource, materialNameOriginLabel, renderNamingRule, suggestMaterialName } from './naming'
import { familyBrandText, familyBrandValues, isRealSku, listRealSkuRows } from './productList'
import { presentProductList } from './productListQuery'
import { ensureProductListViews } from './productListViews'
import { reconcilePlanningRecords } from './planning'
import { createSeed } from './seed'
import type { AppData, NamingPart, ProductSpecNode } from './types'

export interface CheckResult { id: string; ok: boolean; detail: string }

function spec(partial: Partial<ProductSpecNode> & Pick<ProductSpecNode, 'id' | 'parentId' | 'nodeType'>): ProductSpecNode {
  return { templateId: 'm', attributeId: '', valueId: '', sort: 1, role: 'VARIANT', ...partial }
}

function tree(rule?: NamingPart[]): ProductSpecNode[] {
  return [
    spec({ id: 'brand', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'p-brand', role: 'VARIANT' }),
    spec({ id: 'apple', parentId: 'brand', nodeType: 'VALUE', attributeId: 'p-brand', valueId: 'Apple', namingRule: rule }),
    spec({ id: 'huawei', parentId: 'brand', nodeType: 'VALUE', attributeId: 'p-brand', valueId: '华为', sort: 2 }),
  ]
}

function dataOf(nodes = tree()): AppData {
  return {
    params: [{ id: 'p-brand', name: '品牌', values: ['Apple', '华为'], valueGroups: [], participateInStructure: true }],
    templates: [{ id: 'm', name: '体验模型', parentId: null, enabled: true, structureOrder: [] }],
    productTypes: [{ id: 'pt', name: '手机', categoryId: 'c', status: 'enabled', sort: 1, description: '' }],
    specCanvases: [{ templateId: 'm', productTypeId: 'pt', name: '体验模型', zoom: 1, panX: 0, panY: 0, status: 'published', version: 1, versionName: 'V1' }],
    specModelVersions: [],
    planningRecords: [],
    materialReceipts: [],
    families: [],
    skus: [],
    rules: [],
    categories: [],
    mappings: [],
    templateParams: [],
    productSpecNodes: nodes,
    productListViews: [],
    activeProductListViewId: '',
  } as unknown as AppData
}

function publish(data: AppData, versionId: string, nodes: ProductSpecNode[]) {
  data.specModelVersions.push({
    id: versionId,
    templateId: 'm',
    version: data.specModelVersions.length + 1,
    versionName: versionId === 'v1' ? 'V1' : 'V2',
    status: 'published',
    nodesSnapshot: nodes.map((item) => ({ ...item, namingRule: item.namingRule?.map((part) => ({ ...part })) })),
    createdTime: '',
    publishTime: '',
  })
  data.productSpecNodes = nodes.map((item) => ({ ...item, namingRule: item.namingRule?.map((part) => ({ ...part })) }))
  data.planningRecords = reconcilePlanningRecords({
    records: data.planningRecords,
    data,
    productModelId: 'm',
    modelVersionId: versionId,
    nodes,
    now: '2026-10-21T00:00:00.000Z',
  }).records
}

function create(data: AppData, planningId: string, requestId: string, versionId: string, skuName?: string) {
  let seq = data.skus.length + data.families.length
  return createV3Material(data, {
    productModelId: 'm',
    modelVersionId: versionId,
    planningId,
    requestId,
    categoryId: 'c',
    productTypeId: 'pt',
    skuName,
    now: '2026-10-21T01:00:00.000Z',
    nextId: (prefix) => `${prefix}-${++seq}`,
  })
}

function stepsOf(data: AppData, planningId: string) {
  return (data.planningRecords.find((item) => item.planningId === planningId)?.steps || []).map((step) => ({
    valueNodeId: step.valueNodeId,
    attributeId: step.attributeId,
    valueId: step.valueId,
  }))
}

export function runConsistencyChecks(): CheckResult[] {
  const results: CheckResult[] = []
  const check = (id: string, ok: boolean, detail: string) => results.push({ id, ok, detail })
  const rule: NamingPart[] = [{ kind: 'text', text: '体验' }, { kind: 'field', key: 'p-brand' }]
  const data = dataOf()
  publish(data, 'v1', tree())
  const applePlan = data.planningRecords.find((item) => item.steps.some((step) => step.valueId === 'Apple'))
  const huaweiPlan = data.planningRecords.find((item) => item.steps.some((step) => step.valueId === '华为'))
  const v1Suggestion = applePlan ? suggestMaterialName(data, { productModelId: 'm', modelVersionId: 'v1', productTypeName: '手机', steps: stepsOf(data, applePlan.planningId) }) : undefined
  const draftNodes = tree(rule)
  const draftPreview = renderNamingRule(rule, [{ attributeId: 'p-brand', valueId: 'Apple' }], { productType: '手机' }, { 'p-brand': '品牌', productType: '产品类型' }).name
  const v1AfterDraft = applePlan ? suggestMaterialName(data, { productModelId: 'm', modelVersionId: 'v1', productTypeName: '手机', steps: stepsOf(data, applePlan.planningId) }) : undefined
  check('name-v1-default', Boolean(v1Suggestion?.status === 'default' && v1Suggestion.name === '手机 Apple' && v1AfterDraft?.name === '手机 Apple' && v1AfterDraft?.status === 'default' && draftPreview === '体验Apple' && filedNameSource(v1Suggestion || { name: '', status: 'default', message: '' }, '') === 'default'), `${v1Suggestion?.status} ${v1Suggestion?.name} / ${draftPreview}`)

  const first = applePlan ? create(data, applePlan.planningId, 'a1', 'v1') : { ok: false as const, message: 'missing' }
  const second = applePlan ? create(data, applePlan.planningId, 'a2', 'v1', '柜台手工名') : { ok: false as const, message: 'missing' }
  const firstSku = data.skus.find((item) => first.ok && item.id === first.skuId)
  const secondSku = data.skus.find((item) => second.ok && item.id === second.skuId)
  const family = data.families.find((item) => item.id === firstSku?.familyId)
  const savedBrand = family?.commonAttrs['品牌'] || ''
  const brandBefore = JSON.stringify(family?.commonAttrs || {})
  const readBrand = family ? familyBrandValues(data, family) : []
  check('brand-derived', Boolean(first.ok && family?.line === 'v3' && savedBrand === '' && readBrand.join() === 'Apple' && familyBrandText(data, family!) === 'Apple' && JSON.stringify(family?.commonAttrs) === brandBefore), `保存「${savedBrand}」 读取 ${readBrand.join()}`)
  const v1Snapshot = JSON.stringify(data.specModelVersions.find((item) => item.id === 'v1'))

  publish(data, 'v2', draftNodes)
  const v1Still = applePlan ? suggestMaterialName(data, { productModelId: 'm', modelVersionId: 'v1', productTypeName: '手机', steps: stepsOf(data, applePlan.planningId) }) : undefined
  const v2Suggestion = applePlan ? suggestMaterialName(data, { productModelId: 'm', modelVersionId: 'v2', productTypeName: '手机', steps: stepsOf(data, applePlan.planningId) }) : undefined
  const third = applePlan && v2Suggestion ? create(data, applePlan.planningId, 'a3', 'v2', v2Suggestion.name) : { ok: false as const, message: 'missing' }
  const thirdSku = data.skus.find((item) => third.ok && item.id === third.skuId)
  const firstStill = data.skus.find((item) => item.id === firstSku?.id)
  const secondStill = data.skus.find((item) => item.id === secondSku?.id)
  check('name-v2-rule', Boolean(v1Still?.name === '手机 Apple' && v1Still?.status === 'default' && v2Suggestion?.status === 'rule' && v2Suggestion.name === draftPreview && third.ok && thirdSku?.nameSource === 'rule' && thirdSku.skuName === draftPreview && firstStill?.skuName === '手机 Apple' && firstStill.nameSource === 'default' && secondStill?.skuName === '柜台手工名' && secondStill.nameSource === 'manual' && materialNameOriginLabel('default') === '默认名称生成' && materialNameOriginLabel('rule') === '已发布规则生成' && materialNameOriginLabel('manual') === '手工修改' && materialNameOriginLabel('auto') === '建档时自动带入'), `V1 ${v1Still?.name} V2 ${v2Suggestion?.name} 旧 ${firstStill?.skuName} 手改 ${secondStill?.skuName}`)

  const renamed = first.ok ? updateV3Material(data, { skuId: first.skuId, skuName: '不能被覆盖', supplierCode: '', guanjiapoCode: '', oaSkuId: '', materialDescription: '', now: '2026-10-21T02:00:00.000Z' }) : { ok: false as const }
  check('name-manual-kept', Boolean(renamed.ok && data.skus.find((item) => item.id === firstSku?.id)?.skuName === '不能被覆盖' && data.skus.find((item) => item.id === firstSku?.id)?.nameSource === 'manual' && data.skus.find((item) => item.id === firstSku?.id)?.materialCode === firstSku?.materialCode), data.skus.find((item) => item.id === firstSku?.id)?.skuName || '')

  const onV2 = legalComboMaterialStatus(data, 'm', 'v2').rows.find((item) => item.label.includes('Apple'))
  const onV1 = legalComboMaterialStatus(data, 'm', 'v1').rows.find((item) => item.label.includes('Apple'))
  const huaweiRow = legalComboMaterialStatus(data, 'm', 'v2').rows.find((item) => item.label.includes('华为'))
  const codes = new Set([...(onV2?.materials || []), ...(onV2?.historicalMaterials || [])].map((item) => item.materialCode))
  check('history-visible', Boolean(onV2 && onV1 && onV2.materialCount === 1 && !onV2.materials.some((item) => item.modelVersionId === 'v1') && onV2.historicalMaterials.length === 2 && onV2.historicalMaterials.every((item) => item.versionName === 'V1' && item.modelVersionId === 'v1') && onV1.materialCount === 2 && onV1.historicalMaterials.length === 1 && onV1.historicalMaterials[0]?.modelVersionId === 'v2' && codes.size === 3 && huaweiRow?.materials.length === 0 && huaweiRow.historicalMaterials.length === 0 && data.skus.length === 3), `V2 本版 ${onV2?.materialCount} 历史 ${onV2?.historicalMaterials.length} V1 本版 ${onV1?.materialCount}`)
  check('snapshot-untouched', JSON.stringify(data.specModelVersions.find((item) => item.id === 'v1')) === v1Snapshot && data.specModelVersions.find((item) => item.id === 'v1')?.nodesSnapshot.every((item) => !item.namingRule?.length) === true, 'V1 快照没有被改写')

  const blank = dataOf()
  blank.families.push({ id: 'bare', name: '只有草稿', templateId: 'm', productModelId: 'm', productTypeId: 'pt', line: 'v3', categoryId: 'c', oaProductId: '', commonAttrs: {}, productGroupIds: [], lifecycle: 'draft', shelfStatus: 'draft', origin: 'created', createdAt: '', updatedAt: '' })
  blank.productSpecNodes = tree()
  check('brand-ignores-draft', familyBrandValues(blank, blank.families[0]).length === 0 && familyBrandText(blank, blank.families[0]) === '未记录', familyBrandText(blank, blank.families[0]))

  data.families.push({ id: 'plain', name: '无品牌旧商品', templateId: 'm', categoryId: 'c', oaProductId: '', commonAttrs: {}, productGroupIds: [], lifecycle: 'draft', shelfStatus: 'draft', origin: 'sample', createdAt: '', updatedAt: '' })
  data.skus.push({ id: 'sku-old', familyId: 'plain', code: 's-old', oaSkuId: '', status: 'on_sale', variantAttrs: {}, projectedAttrs: {} })
  const huaweiFamily = huaweiPlan ? create(data, huaweiPlan.planningId, 'h1', 'v1') : { ok: false as const, message: 'missing' }
  const shared = data.families.find((item) => item.id === firstSku?.familyId)
  const many = shared ? familyBrandValues(data, shared) : []
  ensureProductListViews(data)
  data.productListViews![0].spuQuery!.filters = [{ id: 'brand', field: 'brand', operator: 'eq', value: 'Apple' }]
  const matched = presentProductList(data, data.productListViews![0], 1, 50).groups.flatMap((group) => group.rows).map((item) => item.family.id)
  const skuRows = listRealSkuRows(data, { keyword: '', categoryId: '', brand: '', status: '', templateId: '', productGroupId: '', attrFilters: {}, sortProp: '', sortOrder: null, page: 1, pageSize: 50, createdFrom: '', createdTo: '', shelf: '' })
  check('brand-filter', Boolean(huaweiFamily.ok && many.length === 2 && many.includes('Apple') && many.includes('华为') && familyBrandText(data, shared!) === many.join('、') && matched.includes(shared!.id) && !matched.includes('plain') && skuRows.length === 1 && skuRows[0]?.id === 'sku-old' && data.skus.filter((item) => item.materialCode).every((item) => !isRealSku(data, item))), `${many.join('、')} 命中 ${matched.join()} sku ${skuRows.map((item) => item.id).join()}`)

  const seed = createSeed()
  const seedBefore = JSON.stringify(seed.families.map((item) => ({ id: item.id, brand: item.commonAttrs['品牌'] || '', name: item.name })))
  const iphone = seed.families.find((item) => item.id === 'f-iphone')
  const emptyBrand = seed.families.find((item) => item.id !== 'f-iphone' && !(item.commonAttrs['品牌'] || '').trim())
  ensureProductListViews(seed)
  seed.productListViews![0].spuQuery!.filters = [{ id: 'brand', field: 'brand', operator: 'eq', value: 'Apple' }]
  const seedHits = presentProductList(seed, seed.productListViews![0], 1, 50).groups.flatMap((group) => group.rows).map((item) => item.family.id)
  const seedAfter = JSON.stringify(seed.families.map((item) => ({ id: item.id, brand: item.commonAttrs['品牌'] || '', name: item.name })))
  check('v2-brand-kept', Boolean(iphone && familyBrandText(seed, iphone) === 'Apple' && seedHits.includes('f-iphone') && emptyBrand && familyBrandText(seed, emptyBrand) === '未记录' && !seedHits.includes(emptyBrand.id) && seedBefore === seedAfter && seed.skus.every((item) => !item.nameSource)), `${iphone ? familyBrandText(seed, iphone) : ''} 空 ${emptyBrand?.id || ''}`)

  return results
}
