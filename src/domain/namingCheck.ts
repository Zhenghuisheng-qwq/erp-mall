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
    spec({ id: 'color', parentId: 'v128', nodeType: 'ATTRIBUTE', attributeId: 'p-color', sort: 2 }),
    spec({ id: 'black', parentId: 'color', nodeType: 'VALUE', attributeId: 'p-color', valueId: '黑色' }),
  ]
}

function siblings(): ProductSpecNode[] {
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
  check('single-rule', named.status === 'rule' && named.canAuto === true && named.name === '手机128GB黑色' && named.nodeId === 'cap' && isolated.name === named.name && !isolated.name.includes('别人的'), named.name)

  const conflicted = siblings()
  conflicted[0].namingRule = [{ kind: 'field', key: 'p-cap' }]
  conflicted[2].namingRule = [{ kind: 'field', key: 'p-color' }]
  const rules = applicableNamingRules(conflicted, ['v128', 'black'])
  const conflictData = dataWith()
  publish(conflictData, conflicted, 'c1')
  const conflictPlan = conflictData.planningRecords[0]
  const conflictName = suggestMaterialName(conflictData, { productModelId: 'm', modelVersionId: 'c1', productTypeName: '手机', steps: conflictPlan.steps.map((step) => ({ valueNodeId: step.valueNodeId, attributeId: step.attributeId, valueId: step.valueId })) })
  check('conflict', rules.length === 2 && conflictName.status === 'conflict' && conflictName.canAuto === false && conflictName.name === '' && !conflictName.message.includes('手机 128GB') && conflictPlan.planningId === conflictData.planningRecords[0].planningId, conflictName.message)

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
  check('manual-version', Boolean(manual.ok && made.ok && made.name === '手机128GB黑色' && after?.skuName === '苹果 iPhone 16 128G 黑色 国行' && after.nameSource === 'manual' && after.suggestedName === '手机128GB黑色' && after.planningId === plan.planningId && fresh?.skuName === '新款128GB' && fresh.planningId === plan.planningId && data.specModelVersions[0].nodesSnapshot[0].namingRule?.[0].text !== '新款'), `旧名 ${after?.skuName} 新名 ${fresh?.skuName}`)

  const seed = createSeed()
  check('v2', seed.families.find((item) => item.id === 'f-iphone')?.name === 'Apple iPhone 17' && seed.skus.every((item) => !item.nameSource), '旧商品名称没被改写')
  results.push(...runAncestorChecks())
  return results
}

function branchNode(partial: Partial<ProductSpecNode> & Pick<ProductSpecNode, 'id' | 'parentId' | 'nodeType'>): ProductSpecNode {
  return spec(partial)
}

function ancestorData() {
  const data = dataWith()
  data.params.push(
    { id: 'p-brand', name: '品牌', values: [], valueGroups: [], participateInStructure: true },
    { id: 'p-model', name: '型号', values: [], valueGroups: [], participateInStructure: true },
  )
  return data
}

function branchTree(blackRule = true): ProductSpecNode[] {
  const appleRule: NamingPart[] = [
    { kind: 'field', key: 'p-model' },
    { kind: 'text', text: ' ' },
    { kind: 'field', key: 'p-brand' },
    { kind: 'text', text: ' 壳' },
  ]
  return [
    branchNode({ id: 'brand', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'p-brand' }),
    branchNode({ id: 'apple', parentId: 'brand', nodeType: 'VALUE', attributeId: 'p-brand', valueId: 'Apple', namingRule: appleRule.map((item) => ({ ...item })) }),
    branchNode({ id: 'model', parentId: 'apple', nodeType: 'ATTRIBUTE', attributeId: 'p-model' }),
    branchNode({ id: 'iphone', parentId: 'model', nodeType: 'VALUE', attributeId: 'p-model', valueId: 'iPhone 17' }),
    branchNode({ id: 'color', parentId: 'iphone', nodeType: 'ATTRIBUTE', attributeId: 'p-color' }),
    branchNode({ id: 'black', parentId: 'color', nodeType: 'VALUE', attributeId: 'p-color', valueId: '黑色', namingRule: blackRule ? [{ kind: 'field', key: 'p-color' }, { kind: 'text', text: ' 黑规' }] : undefined }),
    branchNode({ id: 'white', parentId: 'color', nodeType: 'VALUE', attributeId: 'p-color', valueId: '白色', sort: 2 }),
    branchNode({ id: 'huawei', parentId: 'brand', nodeType: 'VALUE', attributeId: 'p-brand', valueId: '华为', sort: 2 }),
    branchNode({ id: 'hcolor', parentId: 'huawei', nodeType: 'ATTRIBUTE', attributeId: 'p-color' }),
    branchNode({ id: 'hblack', parentId: 'hcolor', nodeType: 'VALUE', attributeId: 'p-color', valueId: '黑色' }),
  ]
}

function stepsOf(data: AppData, planningId: string) {
  const plan = data.planningRecords.find((item) => item.planningId === planningId)
  return (plan?.steps || []).map((step) => ({ valueNodeId: step.valueNodeId, attributeId: step.attributeId, valueId: step.valueId }))
}

function suggestPlan(data: AppData, versionId: string, planningId: string) {
  return suggestMaterialName(data, { productModelId: 'm', modelVersionId: versionId, productTypeName: '手机', steps: stepsOf(data, planningId) })
}

function runAncestorChecks(): CheckResult[] {
  const results: CheckResult[] = []
  const check = (id: string, ok: boolean, detail: string) => results.push({ id, ok, detail })
  const data = ancestorData()
  const draft = branchTree()
  publish(data, draft.map((item) => ({ ...item, namingRule: item.namingRule?.map((part) => ({ ...part })) })), 'snap-rules')
  const bare = ancestorData()
  publish(bare, branchTree(false).map((item) => ({ ...item, namingRule: undefined })), 'snap-none')
  const blackPlan = data.planningRecords.find((item) => item.steps.some((step) => step.valueNodeId === 'black'))
  const whitePlan = data.planningRecords.find((item) => item.steps.some((step) => step.valueNodeId === 'white'))
  const huaweiPlan = data.planningRecords.find((item) => item.steps.some((step) => step.valueNodeId === 'hblack'))
  const black = blackPlan ? suggestPlan(data, 'snap-rules', blackPlan.planningId) : { name: '', status: 'default' as const, canAuto: false, nodeId: '' }
  const white = whitePlan ? suggestPlan(data, 'snap-rules', whitePlan.planningId) : { name: '', status: 'default' as const, canAuto: false, nodeId: '' }
  const huawei = huaweiPlan ? suggestPlan(data, 'snap-rules', huaweiPlan.planningId) : { name: '', status: 'rule' as const, canAuto: true, nodeId: 'apple' }
  check('A', Boolean(white.canAuto && white.nodeId === 'apple' && white.name === 'iPhone 17 Apple 壳'), white.name)
  check('B', Boolean(black.canAuto && black.nodeId === 'black' && black.name === '黑色 黑规' && !black.name.includes('壳')), black.name)
  check('C', Boolean(white.nodeId === 'apple' && white.name.includes('iPhone 17') && white.name.includes(' ')), white.name)
  check('D', Boolean(huawei.status === 'default' && huawei.canAuto && !huawei.name.includes('壳') && !huawei.name.includes('黑规') && huawei.name.includes('华为')), huawei.name)
  const restored = branchTree(false)
  publish(data, restored, 'snap-restored')
  const restoredBlack = blackPlan ? suggestPlan(data, 'snap-restored', blackPlan.planningId) : null
  check('E', Boolean(restoredBlack?.canAuto && restoredBlack.nodeId === 'apple' && restoredBlack.name === 'iPhone 17 Apple 壳' && data.specModelVersions.find((item) => item.id === 'snap-rules')?.nodesSnapshot.find((item) => item.id === 'black')?.namingRule?.[1]?.text === ' 黑规'), restoredBlack?.name || '')
  check('F', white.name.indexOf('iPhone 17') === 0 && white.name.indexOf(' Apple ') > 0 && white.name.endsWith('壳'), white.name)
  const missingTree = branchTree(false)
  const apple = missingTree.find((item) => item.id === 'apple')
  if (apple) apple.namingRule = [{ kind: 'field', key: 'p-cap' }, { kind: 'text', text: ' 缺' }]
  publish(data, missingTree, 'snap-missing')
  const missing = whitePlan ? suggestPlan(data, 'snap-missing', whitePlan.planningId) : null
  const blocked = whitePlan ? createV3Material(data, { productModelId: 'm', modelVersionId: 'snap-missing', planningId: whitePlan.planningId, requestId: 'miss', categoryId: 'c', productTypeId: 'pt', now: '2026-10-15T03:00:00.000Z', nextId: (prefix) => `${prefix}-miss` }) : { ok: false as const, message: '' }
  const typed = whitePlan ? createV3Material(data, { productModelId: 'm', modelVersionId: 'snap-missing', planningId: whitePlan.planningId, requestId: 'miss-ok', categoryId: 'c', productTypeId: 'pt', skuName: '手填缺字段', now: '2026-10-15T03:01:00.000Z', nextId: (prefix) => `${prefix}-miss` }) : { ok: false as const, message: '' }
  const typedSku = data.skus.find((item) => typed.ok && item.id === typed.skuId)
  check('G', Boolean(missing && missing.canAuto === false && missing.status === 'incomplete' && missing.name === '' && missing.message.includes('容量') && !blocked.ok && typed.ok && typedSku?.skuName === '手填缺字段' && !typedSku.skuName.includes('缺少')), `${missing?.message || ''} / ${blocked.ok ? '不该成功' : blocked.message}`)
  const ambiguous = suggestMaterialName(data, {
    productModelId: 'm',
    modelVersionId: 'snap-rules',
    productTypeName: '手机',
    steps: [
      { valueNodeId: 'black', attributeId: 'p-color', valueId: '黑色' },
      { valueNodeId: 'black', attributeId: 'p-color', valueId: '白色' },
    ],
  })
  check('H', ambiguous.canAuto === false && ambiguous.status === 'incomplete' && ambiguous.name === '' && ambiguous.message.includes('多个取值') && ambiguous.message.includes('不会任选') && ambiguous.nodeId === 'black', ambiguous.message)
  const nonePlan = bare.planningRecords.find((item) => item.steps.some((step) => step.valueNodeId === 'white'))
  const none = nonePlan ? suggestPlan(bare, 'snap-none', nonePlan.planningId) : null
  const noneMade = nonePlan ? createV3Material(bare, { productModelId: 'm', modelVersionId: 'snap-none', planningId: nonePlan.planningId, requestId: 'none', categoryId: 'c', productTypeId: 'pt', now: '2026-10-15T04:00:00.000Z', nextId: (prefix) => `${prefix}-none` }) : { ok: false as const, message: '' }
  check('I', Boolean(none?.status === 'default' && none.canAuto && none.name.includes('手机') && none.name.includes('Apple') && noneMade.ok && noneMade.ok && noneMade.name === none?.name), none?.name || '')
  draft.find((item) => item.id === 'apple')!.namingRule = [{ kind: 'text', text: '草稿新规则' }]
  const afterDraft = whitePlan ? suggestPlan(data, 'snap-rules', whitePlan.planningId) : null
  check('J', afterDraft?.name === 'iPhone 17 Apple 壳' && data.specModelVersions.find((item) => item.id === 'snap-rules')?.nodesSnapshot.find((item) => item.id === 'apple')?.namingRule?.[0]?.kind === 'field', afterDraft?.name || '')
  const kept = typedSku ? data.skus.find((item) => item.id === typedSku.id) : undefined
  if (kept) check('K', kept.skuName === '手填缺字段', kept.skuName || '')
  else check('K', false, '没有已创建物料')
  const first = blackPlan ? createV3Material(data, { productModelId: 'm', modelVersionId: 'snap-rules', planningId: blackPlan.planningId, requestId: 'same-a', categoryId: 'c', productTypeId: 'pt', now: '2026-10-15T05:00:00.000Z', nextId: (prefix) => `${prefix}-a` }) : { ok: false as const, message: '' }
  const second = blackPlan ? createV3Material(data, { productModelId: 'm', modelVersionId: 'snap-rules', planningId: blackPlan.planningId, requestId: 'same-b', categoryId: 'c', productTypeId: 'pt', now: '2026-10-15T05:01:00.000Z', nextId: (prefix) => `${prefix}-b` }) : { ok: false as const, message: '' }
  check('L', Boolean(first.ok && second.ok && first.skuId !== second.skuId && first.materialCode !== second.materialCode && first.name === second.name && first.planningId === second.planningId), `${first.ok ? first.materialCode : ''} ${second.ok ? second.materialCode : ''}`)
  const manualMade = whitePlan ? createV3Material(data, { productModelId: 'm', modelVersionId: 'snap-rules', planningId: whitePlan.planningId, requestId: 'hand', categoryId: 'c', productTypeId: 'pt', skuName: '柜台手改名', now: '2026-10-15T06:00:00.000Z', nextId: (prefix) => `${prefix}-hand` }) : { ok: false as const, message: '' }
  const manualSku = data.skus.find((item) => manualMade.ok && item.id === manualMade.skuId)
  check('M', Boolean(manualMade.ok && manualSku?.skuName === '柜台手改名' && manualSku.nameSource === 'manual' && manualSku.suggestedName === 'iPhone 17 Apple 壳' && manualSku.namingNodeId === 'apple' && manualSku.modelVersionId === 'snap-rules' && manualSku.planningId === whitePlan?.planningId), manualSku?.skuName || '')
  const again = whitePlan ? suggestPlan(data, 'snap-rules', whitePlan.planningId) : null
  check('N', again?.name === white.name && again?.nodeId === white.nodeId, again?.name || '')
  const crossed = siblings()
  crossed[1].namingRule = [{ kind: 'text', text: '容量规' }]
  crossed[3].namingRule = [{ kind: 'text', text: '颜色规' }]
  const crossData = dataWith()
  publish(crossData, crossed, 'snap-cross')
  const crossPlan = crossData.planningRecords[0]
  const cross = suggestPlan(crossData, 'snap-cross', crossPlan.planningId)
  const crossBlocked = createV3Material(crossData, { productModelId: 'm', modelVersionId: 'snap-cross', planningId: crossPlan.planningId, requestId: 'cross', categoryId: 'c', productTypeId: 'pt', now: '2026-10-15T07:00:00.000Z', nextId: (prefix) => `${prefix}-cross` })
  const crossNamed = createV3Material(crossData, { productModelId: 'm', modelVersionId: 'snap-cross', planningId: crossPlan.planningId, requestId: 'cross-ok', categoryId: 'c', productTypeId: 'pt', skuName: '同级手填', now: '2026-10-15T07:01:00.000Z', nextId: (prefix) => `${prefix}-cross` })
  const crossSku = crossData.skus.find((item) => crossNamed.ok && item.id === crossNamed.skuId)
  check('O', cross.canAuto === false && cross.status === 'conflict' && cross.name === '' && !crossBlocked.ok && crossNamed.ok && crossSku?.skuName === '同级手填' && !crossSku.namingNodeId, cross.message)
  check('P', Boolean(manualSku?.suggestedName === 'iPhone 17 Apple 壳' && manualSku.namingNodeId === 'apple' && manualSku.skuName === '柜台手改名' && manualSku.modelVersionId === 'snap-rules'), '来源字段随物料保存')
  const shared = siblings()
  shared[0].parentId = 'apple'
  shared[2].parentId = 'apple'
  const sharedNodes = [
    branchNode({ id: 'brand', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'p-brand' }),
    branchNode({ id: 'apple', parentId: 'brand', nodeType: 'VALUE', attributeId: 'p-brand', valueId: 'Apple', namingRule: [{ kind: 'text', text: '共同' }] }),
    ...shared.map((item) => ({ ...item, templateId: 'm' })),
  ]
  const sharedData = ancestorData()
  publish(sharedData, sharedNodes, 'snap-shared')
  const sharedPlan = sharedData.planningRecords[0]
  const sharedName = suggestPlan(sharedData, 'snap-shared', sharedPlan.planningId)
  check('O-shared', sharedName.canAuto === true && sharedName.nodeId === 'apple' && sharedName.name === '共同', sharedName.message || sharedName.name)
  check('Q', data.specModelVersions.find((item) => item.id === 'snap-rules')?.nodesSnapshot.find((item) => item.id === 'apple')?.namingRule?.[3]?.text === ' 壳', '历史快照规则未被草稿改写')
  return results
}
