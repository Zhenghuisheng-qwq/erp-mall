import { generateSkuFromModel, inspectFamily } from './logic'
import { createTemporaryMaterial, createV3Material, filingText, materialOfferings, setPlanningGrades } from './material'
import { legalPlanningCombinations } from './planning'
import { suggestTemporaryName } from './naming'
import { reconcilePlanningRecords } from './planning'
import { createSeed } from './seed'
import type { AppData, PlanningRecord, ProductSpecNode } from './types'

export interface CheckResult { id: string; ok: boolean; detail: string }

function spec(partial: Partial<ProductSpecNode> & Pick<ProductSpecNode, 'id' | 'parentId' | 'nodeType'>): ProductSpecNode {
  return { templateId: 'm', attributeId: '', valueId: '', sort: 1, role: 'VARIANT', ...partial }
}
function tree(): ProductSpecNode[] {
  return [
    spec({ id: 'cap', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'p-cap' }),
    spec({ id: 'v128', parentId: 'cap', nodeType: 'VALUE', attributeId: 'p-cap', valueId: '128GB' }),
    spec({ id: 'color', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'p-color', sort: 2 }),
    spec({ id: 'black', parentId: 'color', nodeType: 'VALUE', attributeId: 'p-color', valueId: '黑色' }),
    spec({ id: 'white', parentId: 'color', nodeType: 'VALUE', attributeId: 'p-color', valueId: '白色', sort: 2 }),
  ]
}
function dataOf(): AppData {
  return {
    params: [
      { id: 'p-cap', name: '容量', values: ['128GB', '256GB'], valueGroups: [], participateInStructure: true },
      { id: 'p-color', name: '颜色', values: ['黑色', '白色'], valueGroups: [], participateInStructure: true },
      { id: 'p-model', name: '型号', values: [], valueGroups: [], participateInStructure: true },
    ],
    templates: [{ id: 'm', name: '手机', parentId: null, enabled: true, structureOrder: [] }],
    productTypes: [{ id: 'pt', name: '手机', categoryId: 'c', status: 'enabled', sort: 1, description: '' }],
    categories: [{ id: 'c', name: '手机', parentId: null, sort: 1, enabled: true }],
    specCanvases: [{ templateId: 'm', productTypeId: 'pt', name: '手机模型', zoom: 1, panX: 0, panY: 0, status: 'published', version: 1, versionName: 'V1' }],
    specModelVersions: [],
    planningRecords: [] as PlanningRecord[],
    materialReceipts: [],
    families: [],
    skus: [],
    rules: [],
    mappings: [],
    templateParams: [],
    productSpecNodes: tree(),
  } as unknown as AppData
}
function publish(data: AppData) {
  const nodes = tree()
  data.specModelVersions.push({ id: 'v1', templateId: 'm', version: 1, versionName: 'V1', status: 'published', nodesSnapshot: nodes.map((item) => ({ ...item })), createdTime: '', publishTime: '' })
  data.planningRecords = reconcilePlanningRecords({ records: data.planningRecords, data, productModelId: 'm', modelVersionId: 'v1', nodes, now: '2026-10-15T00:00:00.000Z' }).records
}
let seq = 0
const nextId = (prefix: string) => `${prefix}-${++seq}`

export function runGradeChecks(): CheckResult[] {
  const results: CheckResult[] = []
  const check = (id: string, ok: boolean, detail: string) => results.push({ id, ok, detail })
  const data = dataOf()
  const beforeCombos = legalPlanningCombinations(data, 'm', tree()).length
  publish(data)
  const [first, second] = data.planningRecords
  const marked = setPlanningGrades(data.planningRecords, [first.planningId], 'core')
  data.planningRecords = marked.records
  const core = data.planningRecords.find((item) => item.planningId === first.planningId)
  check('A', Boolean(core?.grade === 'core' && core.planningId === first.planningId && filingText('core', 0) === '待创建物料' && data.specModelVersions.length === 1), '核心规划可以先发布，没有物料时是待创建')

  const made = createV3Material(data, { productModelId: 'm', modelVersionId: 'v1', planningId: first.planningId, requestId: 'c1', categoryId: 'c', productTypeId: 'pt', now: '2026-10-15T00:00:00.000Z', nextId })
  check('B', Boolean(made.ok && made.planningId === first.planningId && data.skus.filter((item) => item.planningId === first.planningId).length === 1 && filingText('core', 1) === '已有 1 条物料'), made.ok ? made.materialCode : made.message)

  const general = setPlanningGrades(data.planningRecords, [second.planningId], 'general')
  data.planningRecords = general.records
  check('C', filingText('general', 0) === '暂未创建物料' && data.skus.every((item) => item.planningId !== second.planningId), '一般产品可以没有物料')

  const back = setPlanningGrades(data.planningRecords, [first.planningId], 'general')
  data.planningRecords = back.records
  const kept = data.skus.find((item) => made.ok && item.id === made.skuId)
  check('D', Boolean(kept && data.planningRecords.find((item) => item.planningId === first.planningId)?.grade === 'general' && kept.planningId === first.planningId && kept.modelVersionId === 'v1'), '改成一般产品后物料和编号都还在')

  const dictBefore = data.params.map((item) => item.values.join(',')).join('|')
  const nodesBefore = data.productSpecNodes.length
  const snapBefore = JSON.stringify(data.specModelVersions)
  const temp = createTemporaryMaterial(data, {
    requestId: 't1', categoryId: 'c', productTypeId: 'pt', productModelId: 'm', modelVersionId: 'v1',
    attrs: [{ attributeId: 'p-model', value: '特殊版本', source: 'manual' }, { attributeId: 'p-color', value: '黑色', source: 'manual' }, { attributeId: 'p-cap', value: '', source: 'manual' }],
    materialCode: 'TMP-CODE-1', skuName: '', now: '2026-10-15T03:00:00.000Z', nextId,
  })
  const tempSku = data.skus.find((item) => temp.ok && item.id === temp.skuId)
  check('E', Boolean(temp.ok && tempSku?.manualAttrs?.some((item) => item.value === '特殊版本' && item.source === 'manual') && data.params.map((item) => item.values.join(',')).join('|') === dictBefore && data.productSpecNodes.length === nodesBefore && JSON.stringify(data.specModelVersions) === snapBefore && legalPlanningCombinations(data, 'm', tree()).length === beforeCombos), temp.ok ? temp.planningId : temp.message)

  const again = createTemporaryMaterial(data, { requestId: 't2', categoryId: 'c', productTypeId: 'pt', productModelId: 'm', modelVersionId: 'v1', attrs: [{ attributeId: 'p-color', value: '紫色', source: 'manual' }], materialCode: 'TMP-CODE-1', now: '2026-10-15T04:00:00.000Z', nextId })
  const replay = JSON.parse(JSON.stringify(tempSku?.materialCode || ''))
  check('F', Boolean(temp.ok && !again.ok && again.message.includes('物料编码') && data.skus.filter((item) => item.materialCode === 'TMP-CODE-1').length === 1 && replay === 'TMP-CODE-1'), again.ok ? '没有拒绝' : again.message)

  const sameWord = createTemporaryMaterial(data, { requestId: 't3', categoryId: 'c', productTypeId: 'pt', productModelId: 'm', modelVersionId: 'v1', attrs: [{ attributeId: 'p-color', value: '黑色', source: 'manual' }], materialCode: 'HAND-2', now: '2026-10-15T05:00:00.000Z', nextId })
  const hand = data.skus.find((item) => sameWord.ok && item.id === sameWord.skuId)
  check('G', Boolean(hand?.manualAttrs?.[0].source === 'manual' && hand.manualAttrs[0].value === '黑色' && !data.planningRecords.some((item) => item.planningId === hand.planningId && item.origin !== 'temporary')), '同名手工值没有并进正式规划')

  const named = suggestTemporaryName({ productTypeName: '手机', attrs: [{ attributeId: 'p-brand', value: 'Apple' }, { attributeId: 'p-model', value: '特殊版本' }, { attributeId: 'p-color', value: '紫色' }, { attributeId: 'p-country', value: '' }], rules: [] })
  const renamed = hand ? { ok: true as const } : { ok: false as const }
  if (hand) hand.skuName = '苹果特殊紫色'
  if (hand) hand.nameSource = 'manual'
  check('H', named.name === '手机 Apple 特殊版本 紫色' && !named.name.includes('undefined') && renamed.ok && hand?.skuName === '苹果特殊紫色', named.name)

  const batch = setPlanningGrades(data.planningRecords, [first.planningId, second.planningId], 'core')
  const untouched = data.planningRecords.filter((item) => item.origin !== 'temporary' && item.planningId !== first.planningId && item.planningId !== second.planningId)
  const skuCount = data.skus.length
  data.planningRecords = batch.records
  check('I', batch.changed >= 1 && untouched.every((item) => data.planningRecords.find((row) => row.planningId === item.planningId)?.grade === item.grade) && data.skus.length === skuCount && data.planningRecords.find((item) => item.planningId === first.planningId)?.planningId === first.planningId, `批量改了 ${batch.changed} 条`)

  const old = createSeed()
  const oldPlan: PlanningRecord = { planningId: 'PLN-000001', productModelId: 'm', originModelVersionId: 'v1', modelVersionId: 'v1', modelVersionIds: ['v1'], steps: [], identityKey: 'old', status: 'active', createdTime: '' }
  check('J', oldPlan.grade === undefined && filingText(oldPlan.grade, 1) === '已有 1 条物料' && old.families.find((item) => item.id === 'f-iphone')?.name === 'Apple iPhone 17', '旧规划没有档次字段也能读')

  const frozen = generateSkuFromModel({ commonAttrs: {}, variantSelections: { 容量: ['128GB'], 颜色: ['黑色'] }, modelSnapshot: tree() })
  const dup = inspectFamily(old, old.families[0], [old.skus[0], { ...old.skus[0], id: 'dup' }])
  const numbered = createV3Material(data, { productModelId: 'm', modelVersionId: 'v1', planningId: second.planningId, requestId: 'auto', categoryId: 'c', productTypeId: 'pt', now: '2026-10-15T06:00:00.000Z', nextId })
  createTemporaryMaterial(data, { requestId: 't4', categoryId: 'c', productTypeId: 'pt', productModelId: 'm', modelVersionId: 'v1', attrs: [{ attributeId: 'p-color', value: '蓝紫', source: 'manual' }], materialCode: 'MAT-000050', now: '2026-10-15T07:00:00.000Z', nextId })
  const later = createV3Material(data, { productModelId: 'm', modelVersionId: 'v1', planningId: first.planningId, requestId: 'auto2', categoryId: 'c', productTypeId: 'pt', now: '2026-10-15T08:00:00.000Z', nextId })
  check('K', frozen.skus.length === 1 && dup.some((item) => item.kind === 'duplicate') && numbered.ok && later.ok && later.materialCode === 'MAT-000051', `自动编码 ${later.ok ? later.materialCode : later.message}`)
  const offerings = materialOfferings(data, 'm')
  check('offer', offerings.rows.length === beforeCombos && offerings.rows.some((item) => item.grade === 'core'), `清单 ${offerings.rows.length} 条`)
  return results
}
