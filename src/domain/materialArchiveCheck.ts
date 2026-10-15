import { generateSkuFromModel, inspectFamily } from './logic'
import { createV3Material, materialCodeConflict, resolveV3MaterialSpec, updateV3Material } from './material'
import { reconcilePlanningRecords, tracePlanning } from './planning'
import { createSeed } from './seed'
import { normalizeStored } from '../stores/catalog'
import type { AppData, PlanningRecord, ProductSpecNode } from './types'

export interface CheckResult { id: string; ok: boolean; detail: string }

function spec(partial: Partial<ProductSpecNode> & Pick<ProductSpecNode, 'id' | 'parentId' | 'nodeType'>): ProductSpecNode {
  return { templateId: 'm', attributeId: '', valueId: '', sort: 1, role: 'VARIANT', ...partial }
}

function nodes(): ProductSpecNode[] {
  return [
    spec({ id: 'cap', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'p-cap', sort: 1 }),
    spec({ id: 'v128', parentId: 'cap', nodeType: 'VALUE', attributeId: 'p-cap', valueId: '128GB' }),
    spec({ id: 'v256', parentId: 'cap', nodeType: 'VALUE', attributeId: 'p-cap', valueId: '256GB', sort: 2 }),
    spec({ id: 'color', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'p-color', sort: 2 }),
    spec({ id: 'black', parentId: 'color', nodeType: 'VALUE', attributeId: 'p-color', valueId: '黑色' }),
    spec({ id: 'white', parentId: 'color', nodeType: 'VALUE', attributeId: 'p-color', valueId: '白色', sort: 2 }),
  ]
}

function dataOf(): AppData {
  return {
    params: [
      { id: 'p-cap', name: '容量', values: [], valueGroups: [], participateInStructure: true },
      { id: 'p-color', name: '颜色', values: [], valueGroups: [], participateInStructure: true },
    ],
    templates: [{ id: 'm', name: '手机模型', parentId: null, enabled: true, structureOrder: [] }],
    productTypes: [{ id: 'pt', name: '手机', categoryId: 'c', status: 'enabled', sort: 1, description: '' }],
    specCanvases: [{ templateId: 'm', productTypeId: 'pt', name: '手机模型', zoom: 1, panX: 0, panY: 0, status: 'published', version: 1, versionName: 'V1' }],
    specModelVersions: [],
    planningRecords: [] as PlanningRecord[],
    materialReceipts: [],
    families: [],
    skus: [],
    rules: [],
    categories: [],
    mappings: [],
    templateParams: [],
    productSpecNodes: nodes(),
  } as unknown as AppData
}

function publish(data: AppData, versionId: string, tree = nodes()) {
  data.specModelVersions.push({ id: versionId, templateId: 'm', version: data.specModelVersions.length + 1, versionName: versionId, status: 'published', nodesSnapshot: tree.map((item) => ({ ...item })), createdTime: '', publishTime: '' })
  const result = reconcilePlanningRecords({ records: data.planningRecords, data, productModelId: 'm', modelVersionId: versionId, nodes: tree, now: '2026-10-15T00:00:00.000Z' })
  data.planningRecords = result.records
}

function create(data: AppData, planningId: string, requestId: string, versionId = 'v1') {
  let seq = data.skus.length + data.families.length
  return createV3Material(data, { productModelId: 'm', modelVersionId: versionId, planningId, requestId, categoryId: 'c', productTypeId: 'pt', now: '2026-10-15T00:00:00.000Z', nextId: (prefix) => `${prefix}-${++seq}` })
}

export function runArchiveChecks(): CheckResult[] {
  const results: CheckResult[] = []
  const check = (id: string, ok: boolean, detail: string) => results.push({ id, ok, detail })
  const data = dataOf()
  publish(data, 'v1')
  const black = data.planningRecords.find((item) => item.steps.some((step) => step.valueId === '黑色') && item.steps.some((step) => step.valueId === '128GB'))
  const white = data.planningRecords.find((item) => item.steps.some((step) => step.valueId === '白色') && item.steps.some((step) => step.valueId === '128GB'))
  const first = black ? create(data, black.planningId, 'b1') : { ok: false as const, message: 'missing' }
  const whiteMade = white ? create(data, white.planningId, 'w1') : { ok: false as const, message: 'missing' }
  const second = black ? create(data, black.planningId, 'b2') : { ok: false as const, message: 'missing' }
  const blackSkus = data.skus.filter((item) => item.planningId === black?.planningId)
  check('1-2', Boolean(first.ok && whiteMade.ok && second.ok && first.materialCode !== whiteMade.materialCode && blackSkus.length === 2 && new Set(blackSkus.map((item) => item.materialCode)).size === 2), `黑 ${first.ok ? first.materialCode : ''} 白 ${whiteMade.ok ? whiteMade.materialCode : ''} 再一笔 ${second.ok ? second.materialCode : ''}`)

  const edited = first.ok ? updateV3Material(data, { skuId: first.skuId, skuName: '苹果 128G 黑色 国行', supplierCode: 'SUP-1', guanjiapoCode: 'GJP-9', oaSkuId: 'OA-1', materialDescription: '国行现货', now: '2026-10-15T01:00:00.000Z' }) : { ok: false as const, message: 'missing' }
  const again = second.ok ? updateV3Material(data, { skuId: second.skuId, skuName: data.skus.find((item) => item.id === second.skuId)?.skuName || '', supplierCode: 'SUP-1', guanjiapoCode: 'GJP-9', oaSkuId: 'OA-1', materialDescription: '美版', now: '2026-10-15T01:00:00.000Z' }) : { ok: false as const, message: 'missing' }
  const saved = data.skus.find((item) => item.id === (first.ok ? first.skuId : ''))
  const codeBefore = saved?.materialCode
  const planBefore = saved?.planningId
  const versionBefore = saved?.modelVersionId
  const renamed = saved ? updateV3Material(data, { skuId: saved.id, skuName: '苹果 128G 黑色 国行 修订', supplierCode: saved.supplierCode || '', guanjiapoCode: saved.guanjiapoCode || '', oaSkuId: saved.oaSkuId, materialDescription: '国行现货，已核对', now: '2026-10-15T02:00:00.000Z' }) : { ok: false as const, message: 'missing' }
  const reopened = data.skus.find((item) => item.id === saved?.id)
  check('3-6', Boolean(edited.ok && again.ok && renamed.ok && reopened?.supplierCode === 'SUP-1' && data.skus.filter((item) => item.supplierCode === 'SUP-1').length === 2 && reopened?.materialDescription === '国行现货，已核对' && reopened.materialCode === codeBefore && reopened.planningId === planBefore && reopened.modelVersionId === versionBefore && reopened.nameSource === 'manual' && reopened.createdAt && reopened.updatedAt !== reopened.createdAt), `描述 ${reopened?.materialDescription || ''} 编码 ${reopened?.materialCode}`)

  const conflict = saved ? materialCodeConflict(data, saved.materialCode || '', 'someone-else') : 'missing'
  const emptyName = saved ? updateV3Material(data, { skuId: saved.id, skuName: '  ', supplierCode: '', guanjiapoCode: '', oaSkuId: '', materialDescription: reopened?.materialDescription || '' }) : { ok: false as const, message: 'missing' }
  check('4', Boolean(conflict && !emptyName.ok && reopened?.materialDescription === '国行现货，已核对'), conflict || '没有拦住重复编码')

  const traced = black ? tracePlanning(data, black.planningId, 'v1') : null
  const preview = black ? resolveV3MaterialSpec(data, { productModelId: 'm', modelVersionId: 'v1', planningId: black.planningId }) : { ok: false as const, message: '' }
  check('7-8', Boolean(traced?.linked && preview.ok && data.skus.filter((item) => item.planningId === black?.planningId).length === 2), '规划来源和列表看到的是同一批物料')

  const packed = JSON.parse(JSON.stringify({ version: 12, data })) as { version: number; data: AppData }
  const loaded = normalizeStored(packed)
  const kept = loaded?.skus.find((item) => item.id === saved?.id)
  check('9-10', Boolean(kept?.materialDescription === '国行现货，已核对' && kept.guanjiapoCode === 'GJP-9' && kept.supplierCode === 'SUP-1' && createSeed().families.some((item) => item.id === 'f-iphone') && createSeed().skus.every((item) => !item.materialCode)), '刷新后档案还在，旧商品没有被补编码')

  const frozen = generateSkuFromModel({ commonAttrs: { 品牌: 'Apple' }, variantSelections: { 容量: ['128GB'], 颜色: ['黑色', '白色'] }, modelSnapshot: nodes() })
  const dup = inspectFamily(createSeed(), createSeed().families[0], [createSeed().skus[0], { ...createSeed().skus[0], id: 'dup' }])
  check('11', frozen.skus.length === 2 && dup.some((item) => item.kind === 'duplicate'), `V2 仍生成 ${frozen.skus.length} 条并继续判重`)
  return results
}
