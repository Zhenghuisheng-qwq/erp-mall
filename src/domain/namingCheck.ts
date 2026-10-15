import { sameSpecSnapshot } from './logic'
import { createV3Material, updateV3Material } from './material'
import { applicableNamingRules, composeName, suggestMaterialName } from './naming'
import { reconcilePlanningRecords } from './planning'
import { createSeed } from './seed'
import type { AppData, NamingPart, PlanningRecord, ProductSpecNode } from './types'

export interface CheckResult { id: string; ok: boolean; detail: string }

const phone: NamingPart[] = [
  { kind: 'field', key: 'productType' },
  { kind: 'field', key: 'p-brand' },
  { kind: 'field', key: 'p-model' },
  { kind: 'field', key: 'p-cap' },
  { kind: 'field', key: 'p-color' },
  { kind: 'field', key: 'p-country' },
  { kind: 'field', key: 'p-net' },
]
const values = { productType: '手机', 'p-brand': 'Apple', 'p-model': 'iPhone 16', 'p-cap': '128GB', 'p-color': '黑色', 'p-country': '', 'p-net': 'null' }

function spec(partial: Partial<ProductSpecNode> & Pick<ProductSpecNode, 'id' | 'parentId' | 'nodeType'>): ProductSpecNode {
  return { templateId: 'm', attributeId: '', valueId: '', sort: 1, role: 'VARIANT', ...partial }
}

function tree(): ProductSpecNode[] {
  return [
    spec({ id: 'cap', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'p-cap' }),
    spec({ id: 'v128', parentId: 'cap', nodeType: 'VALUE', attributeId: 'p-cap', valueId: '128GB' }),
    spec({ id: 'color', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'p-color', sort: 2 }),
    spec({ id: 'black', parentId: 'color', nodeType: 'VALUE', attributeId: 'p-color', valueId: '黑色' }),
  ]
}

function dataWith(): AppData {
  return {
    params: [
      { id: 'p-cap', name: '容量', values: [], valueGroups: [], participateInStructure: true },
      { id: 'p-color', name: '颜色', values: [], valueGroups: [], participateInStructure: true },
    ],
    templates: [{ id: 'm', name: '手机', parentId: null, enabled: true, structureOrder: [] }, { id: 'other', name: '别的', parentId: null, enabled: true, structureOrder: [] }],
    productTypes: [{ id: 'pt', name: '手机', categoryId: 'c', status: 'enabled', sort: 1, description: '' }],
    specCanvases: [{ templateId: 'm', productTypeId: 'pt', name: '手机', zoom: 1, panX: 0, panY: 0, status: 'published', version: 1, versionName: 'V1' }],
    specModelVersions: [],
    planningRecords: [] as PlanningRecord[],
    materialReceipts: [],
    families: [],
    skus: [],
    rules: [],
    categories: [],
    mappings: [],
    templateParams: [],
  } as unknown as AppData
}

function publish(data: AppData, nodes: ProductSpecNode[], versionId: string) {
  data.specModelVersions.push({ id: versionId, templateId: 'm', version: data.specModelVersions.length + 1, versionName: versionId, status: 'published', nodesSnapshot: nodes.map((item) => ({ ...item, namingRule: item.namingRule?.map((part) => ({ ...part })) })), createdTime: '', publishTime: '' })
  data.planningRecords = reconcilePlanningRecords({ records: data.planningRecords, data, productModelId: 'm', modelVersionId: versionId, nodes, now: '2026-10-15T00:00:00.000Z' }).records
}

export function runNamingChecks(): CheckResult[] {
  const results: CheckResult[] = []
  const check = (id: string, ok: boolean, detail: string) => results.push({ id, ok, detail })
  const normal = composeName(phone, values)
  const flipped = composeName([...phone].reverse(), values)
  const fixed = composeName([{ kind: 'text', text: '行货' }, ...phone], values)
  check('order-empty', normal === '手机 Apple iPhone 16 128GB 黑色' && flipped !== normal && flipped.startsWith('黑色') && !normal.includes('  ') && !fixed.startsWith(' ') && fixed.includes('行货'), `${normal} | ${flipped} | ${fixed}`)

  const nodes = tree()
  nodes[0].namingRule = [{ kind: 'field', key: 'productType' }, { kind: 'field', key: 'p-cap' }, { kind: 'field', key: 'p-color' }]
  const data = dataWith()
  publish(data, nodes, 'v1')
  const plan = data.planningRecords[0]
  const named = suggestMaterialName(data, { productModelId: 'm', modelVersionId: 'v1', productTypeName: '手机', steps: plan.steps.map((step) => ({ valueNodeId: step.valueNodeId, attributeId: step.attributeId, valueId: step.valueId })) })
  const other = dataWith()
  other.specModelVersions.push({ id: 'o1', templateId: 'other', version: 1, versionName: 'V1', status: 'published', nodesSnapshot: tree().map((item) => ({ ...item, templateId: 'other', namingRule: [{ kind: 'text', text: '别人的' }] })), createdTime: '', publishTime: '' })
  const isolated = suggestMaterialName(data, { productModelId: 'm', modelVersionId: 'v1', productTypeName: '手机', steps: plan.steps.map((step) => ({ valueNodeId: step.valueNodeId, attributeId: step.attributeId, valueId: step.valueId })) })
  check('single-rule', named.status === 'rule' && named.name === '手机 128GB 黑色' && isolated.name === named.name && !isolated.name.includes('别人的'), named.name)

  const conflicted = tree()
  conflicted[0].namingRule = [{ kind: 'field', key: 'p-cap' }]
  conflicted[2].namingRule = [{ kind: 'field', key: 'p-color' }]
  const rules = applicableNamingRules(conflicted, ['v128', 'black'])
  const conflictData = dataWith()
  publish(conflictData, conflicted, 'c1')
  const conflictPlan = conflictData.planningRecords[0]
  const conflictName = suggestMaterialName(conflictData, { productModelId: 'm', modelVersionId: 'c1', productTypeName: '手机', steps: conflictPlan.steps.map((step) => ({ valueNodeId: step.valueNodeId, attributeId: step.attributeId, valueId: step.valueId })) })
  check('conflict', rules.length === 2 && conflictName.status === 'conflict' && conflictName.name === '手机 128GB 黑色' && conflictPlan.planningId === conflictData.planningRecords[0].planningId, conflictName.message)

  const live = tree()
  live[0].namingRule = [{ kind: 'text', text: '旧规则' }]
  const frozen = live.map((item) => ({ ...item, namingRule: item.namingRule?.map((part) => ({ ...part })) }))
  live[0].namingRule[0].text = '新规则'
  check('snapshot', frozen[0].namingRule?.[0].text === '旧规则' && !sameSpecSnapshot(live, frozen), '已发布快照没有跟着草稿变')

  let seq = 0
  const made = createV3Material(data, { productModelId: 'm', modelVersionId: 'v1', planningId: plan.planningId, requestId: 'n1', categoryId: 'c', productTypeId: 'pt', now: '2026-10-15T00:00:00.000Z', nextId: (prefix) => `${prefix}-${++seq}` })
  const manual = made.ok ? updateV3Material(data, { skuId: made.skuId, skuName: '苹果 iPhone 16 128G 黑色 国行', supplierCode: '', guanjiapoCode: '', oaSkuId: '', materialDescription: '', now: '2026-10-15T01:00:00.000Z' }) : { ok: false as const }
  const kept = data.skus.find((item) => made.ok && item.id === made.skuId)
  const nextTree = tree()
  nextTree[0].namingRule = [{ kind: 'text', text: '新款' }, { kind: 'field', key: 'p-cap' }]
  publish(data, nextTree, 'v2')
  const after = data.skus.find((item) => item.id === kept?.id)
  const created = createV3Material(data, { productModelId: 'm', modelVersionId: 'v2', planningId: plan.planningId, requestId: 'n2', categoryId: 'c', productTypeId: 'pt', now: '2026-10-15T02:00:00.000Z', nextId: (prefix) => `${prefix}-${++seq}` })
  const fresh = data.skus.find((item) => created.ok && item.id === created.skuId)
  check('manual-version', Boolean(manual.ok && made.ok && made.name === '手机 128GB 黑色' && after?.skuName === '苹果 iPhone 16 128G 黑色 国行' && after.nameSource === 'manual' && after.planningId === plan.planningId && fresh?.skuName === '新款 128GB' && fresh.planningId === plan.planningId && data.specModelVersions[0].nodesSnapshot[0].namingRule?.[0].text !== '新款'), `旧名 ${after?.skuName} 新名 ${fresh?.skuName}`)

  const seed = createSeed()
  check('v2', seed.families.find((item) => item.id === 'f-iphone')?.name === 'Apple iPhone 17' && seed.skus.every((item) => !item.nameSource), '旧商品名称没被改写')
  return results
}
