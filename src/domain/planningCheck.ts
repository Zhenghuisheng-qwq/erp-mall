import { installCatalogTestLocks } from '../../scripts/catalog-storage-test-env'
installCatalogTestLocks()
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { cloneProductModel } from '../components/model-editor/cloneModel'
import { chooseModelNode, collectModelSelections, emptyModelSelection, generateSkuFromModel, inspectFamily, planSkuLines } from './logic'
import { legalPlanningCombinations, planningIdentityKey, planningRoleGaps, reconcilePlanningRecords, tracePlanning } from './planning'
import { createSeed } from './seed'
import { useCatalogStore } from '../stores/catalog'
import { normalizeStored } from '../stores/catalog'
import type { AppData, ParamRole, PlanningRecord, ProductSpecNode, SpecModelVersion } from './types'

export interface CheckResult {
  id: string
  ok: boolean
  detail: string
}

function spec(partial: Partial<ProductSpecNode> & Pick<ProductSpecNode, 'id' | 'parentId' | 'nodeType'>): ProductSpecNode {
  return { templateId: 'm', attributeId: '', valueId: '', sort: 1, ...partial }
}

function catalog(params: { id: string; name: string }[], schemes: { templateId: string; paramId: string; role: ParamRole }[] = []): AppData {
  return {
    params: params.map((item) => ({ id: item.id, name: item.name, values: [], valueGroups: [], participateInStructure: true })),
    templateParams: schemes.map((item) => ({ templateId: item.templateId, paramId: item.paramId, role: item.role, required: false })),
    planningRecords: [],
    specModelVersions: [],
    productPlans: [],
  } as unknown as AppData
}

function cloneNodes(nodes: ProductSpecNode[]) {
  return nodes.map((item) => ({ ...item }))
}

function labelsOf(data: AppData, modelId: string, nodes: ProductSpecNode[]) {
  return legalPlanningCombinations(data, modelId, nodes).map((item) => item.label).sort()
}

function idsOf(records: PlanningRecord[], modelId: string) {
  return records.filter((item) => item.productModelId === modelId && item.status === 'active').map((item) => item.planningId).sort()
}

function reconcile(records: PlanningRecord[], data: AppData, modelId: string, versionId: string, nodes: ProductSpecNode[]) {
  return reconcilePlanningRecords({ records, data, productModelId: modelId, modelVersionId: versionId, nodes, now: '2026-10-15T00:00:00.000Z' })
}

function version(id: string, nodes: ProductSpecNode[]): SpecModelVersion {
  return { id, templateId: nodes[0]?.templateId || 'm', version: 1, versionName: id, status: 'published', nodesSnapshot: nodes, createdTime: '', publishTime: '' }
}

function flatNodes(): ProductSpecNode[] {
  return [
    spec({ id: 'cap', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'p-cap', sort: 1, role: 'VARIANT' }),
    spec({ id: 'c128', parentId: 'cap', nodeType: 'VALUE', attributeId: 'p-cap', valueId: '128GB', sort: 1 }),
    spec({ id: 'c256', parentId: 'cap', nodeType: 'VALUE', attributeId: 'p-cap', valueId: '256GB', sort: 2 }),
    spec({ id: 'color', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'p-color', sort: 2, role: 'VARIANT' }),
    spec({ id: 'black', parentId: 'color', nodeType: 'VALUE', attributeId: 'p-color', valueId: '黑色', sort: 1 }),
    spec({ id: 'white', parentId: 'color', nodeType: 'VALUE', attributeId: 'p-color', valueId: '白色', sort: 2 }),
    spec({ id: 'blue', parentId: 'color', nodeType: 'VALUE', attributeId: 'p-color', valueId: '蓝色', sort: 3 }),
  ]
}

function branchNodes(): ProductSpecNode[] {
  return [
    spec({ id: 'cap', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'p-cap', sort: 1, role: 'VARIANT' }),
    spec({ id: 'v256', parentId: 'cap', nodeType: 'VALUE', attributeId: 'p-cap', valueId: '256GB', sort: 1 }),
    spec({ id: 'c256', parentId: 'v256', nodeType: 'ATTRIBUTE', attributeId: 'p-color', sort: 1, role: 'VARIANT' }),
    spec({ id: 'black', parentId: 'c256', nodeType: 'VALUE', attributeId: 'p-color', valueId: '黑色', sort: 1 }),
    spec({ id: 'white256', parentId: 'c256', nodeType: 'VALUE', attributeId: 'p-color', valueId: '白色', sort: 2 }),
    spec({ id: 'v512', parentId: 'cap', nodeType: 'VALUE', attributeId: 'p-cap', valueId: '512GB', sort: 2 }),
    spec({ id: 'c512', parentId: 'v512', nodeType: 'ATTRIBUTE', attributeId: 'p-color', sort: 1, role: 'VARIANT' }),
    spec({ id: 'white512', parentId: 'c512', nodeType: 'VALUE', attributeId: 'p-color', valueId: '白色', sort: 1 }),
    spec({ id: 'v1t', parentId: 'cap', nodeType: 'VALUE', attributeId: 'p-cap', valueId: '1TB', sort: 3 }),
    spec({ id: 'c1t', parentId: 'v1t', nodeType: 'ATTRIBUTE', attributeId: 'p-color', sort: 1, role: 'VARIANT' }),
    spec({ id: 'white1t', parentId: 'c1t', nodeType: 'VALUE', attributeId: 'p-color', valueId: '白色', sort: 1 }),
  ]
}

function mixedNodes(): ProductSpecNode[] {
  return [
    spec({ id: 'net', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'p-net', sort: 1, role: 'VARIANT' }),
    spec({ id: 'g5', parentId: 'net', nodeType: 'VALUE', attributeId: 'p-net', valueId: '5G', sort: 1 }),
    spec({ id: 'g4', parentId: 'net', nodeType: 'VALUE', attributeId: 'p-net', valueId: '4G', sort: 2 }),
    spec({ id: 'cap', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'p-cap', sort: 2, role: 'VARIANT' }),
    spec({ id: 'v256', parentId: 'cap', nodeType: 'VALUE', attributeId: 'p-cap', valueId: '256GB', sort: 1 }),
    spec({ id: 'c256', parentId: 'v256', nodeType: 'ATTRIBUTE', attributeId: 'p-color', sort: 1, role: 'VARIANT' }),
    spec({ id: 'black', parentId: 'c256', nodeType: 'VALUE', attributeId: 'p-color', valueId: '黑色', sort: 1 }),
    spec({ id: 'white256', parentId: 'c256', nodeType: 'VALUE', attributeId: 'p-color', valueId: '白色', sort: 2 }),
    spec({ id: 'v512', parentId: 'cap', nodeType: 'VALUE', attributeId: 'p-cap', valueId: '512GB', sort: 2 }),
    spec({ id: 'c512', parentId: 'v512', nodeType: 'ATTRIBUTE', attributeId: 'p-color', sort: 1, role: 'VARIANT' }),
    spec({ id: 'white512', parentId: 'c512', nodeType: 'VALUE', attributeId: 'p-color', valueId: '白色', sort: 1 }),
  ]
}

function gatedNodes(): ProductSpecNode[] {
  return [
    spec({ id: 'line', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'p-line', sort: 1, role: 'COMMON' }),
    spec({ id: 'city', parentId: 'line', nodeType: 'VALUE', attributeId: 'p-line', valueId: '都市款', sort: 1 }),
    spec({ id: 'bat-city', parentId: 'city', nodeType: 'ATTRIBUTE', attributeId: 'p-bat', sort: 1, role: 'VARIANT' }),
    spec({ id: 'bat12', parentId: 'bat-city', nodeType: 'VALUE', attributeId: 'p-bat', valueId: '12Ah', sort: 1 }),
    spec({ id: 'long', parentId: 'line', nodeType: 'VALUE', attributeId: 'p-line', valueId: '长续航', sort: 2 }),
    spec({ id: 'bat-long', parentId: 'long', nodeType: 'ATTRIBUTE', attributeId: 'p-bat', sort: 1, role: 'VARIANT' }),
    spec({ id: 'bat20', parentId: 'bat-long', nodeType: 'VALUE', attributeId: 'p-bat', valueId: '20Ah', sort: 1 }),
    spec({ id: 'pack', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'p-pack', sort: 2, role: 'VARIANT' }),
    spec({ id: 'plain', parentId: 'pack', nodeType: 'VALUE', attributeId: 'p-pack', valueId: '简装', sort: 1 }),
    spec({ id: 'gift', parentId: 'pack', nodeType: 'VALUE', attributeId: 'p-pack', valueId: '礼盒', sort: 2 }),
  ]
}

const phoneParams = [
  { id: 'p-cap', name: '容量' },
  { id: 'p-color', name: '颜色' },
  { id: 'p-net', name: '网络' },
  { id: 'p-line', name: '车型' },
  { id: 'p-bat', name: '电池' },
  { id: 'p-pack', name: '包装' },
]

export async function runPlanningChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = []
  const check = (id: string, ok: boolean, detail: string) => results.push({ id, ok, detail })
  const data = catalog(phoneParams)

  const flat = labelsOf(data, 'm', flatNodes())
  check('1', flat.length === 6 && flat.every((item) => item.startsWith('容量 ') && item.includes('颜色 ')), `平级组合 ${flat.length} 条：${flat.join(' | ')}`)

  const branched = labelsOf(data, 'm', branchNodes())
  const banned = branched.filter((item) => item.includes('512GB') && item.includes('黑色') || item.includes('1TB') && item.includes('黑色'))
  check('2', branched.length === 4 && banned.length === 0, `条件组合 ${branched.length} 条：${branched.join(' | ')}`)

  const mixed = labelsOf(data, 'm', mixedNodes())
  const gated = labelsOf(data, 'm', gatedNodes())
  const networkIllegal = mixed.filter((item) => item.includes('512GB') && item.includes('黑色'))
  const crossed = gated.filter((item) => (item.includes('都市款') && item.includes('20Ah')) || (item.includes('长续航') && item.includes('12Ah')))
  check('3', mixed.length === 6 && networkIllegal.length === 0 && gated.length === 4 && crossed.length === 0, `混合：网络×条件 ${mixed.length}（${mixed.join(' | ')}）；车型×包装 ${gated.length}（${gated.join(' | ')}）`)

  const flatResult = reconcile([], data, 'flat', 'flat-v1', flatNodes())
  const branchResult = reconcile(flatResult.records, data, 'branch', 'branch-v1', branchNodes())
  const flatIds = idsOf(branchResult.records, 'flat')
  const branchIds = idsOf(branchResult.records, 'branch')
  check('4', flatIds.length === 6 && branchIds.length === 4 && new Set([...flatIds, ...branchIds]).size === 10, `编号 平级 ${flatIds.join(',')}；条件 ${branchIds.join(',')}`)

  const again = reconcile(branchResult.records, data, 'flat', 'flat-v1', flatNodes())
  check('5', again.created === 0 && idsOf(again.records, 'flat').join() === flatIds.join() && again.records.filter((item) => item.productModelId === 'flat').length === 6, `重算新增 ${again.created}，编号 ${idsOf(again.records, 'flat').join(',')}`)

  const resorted = flatNodes()
  const black = resorted.find((item) => item.id === 'black')
  const blue = resorted.find((item) => item.id === 'blue')
  if (black && blue) {
    black.sort = 3
    blue.sort = 1
  }
  const resortedKeys = legalPlanningCombinations(data, 'flat', resorted).map((item) => item.identityKey).sort()
  const originalKeys = legalPlanningCombinations(data, 'flat', flatNodes()).map((item) => item.identityKey).sort()
  const afterSort = reconcile(flatResult.records, data, 'flat', 'flat-v2', resorted)
  check('6', resortedKeys.join() === originalKeys.join() && idsOf(afterSort.records, 'flat').join() === flatIds.join(), `顺序调整后编号 ${idsOf(afterSort.records, 'flat').join(',')}`)

  const moved = branchNodes().map((item) => (item.id === 'black' ? { ...item, parentId: 'c512' } : { ...item }))
  const movedResult = reconcile(branchResult.records, data, 'branch', 'branch-v2', moved)
  const oldBlack = branchResult.records.find((item) => item.productModelId === 'branch' && item.steps.some((step) => step.valueNodeId === 'black' && step.parentValueNodeId === 'v256'))
  const newBlack = movedResult.records.find((item) => item.productModelId === 'branch' && item.status === 'active' && item.steps.some((step) => step.valueNodeId === 'black' && step.parentValueNodeId === 'v512'))
  const whiteKept = movedResult.records.find((item) => item.productModelId === 'branch' && item.status === 'active' && item.steps.some((step) => step.valueNodeId === 'white256'))
  const whiteBefore = branchResult.records.find((item) => item.productModelId === 'branch' && item.steps.some((step) => step.valueNodeId === 'white256'))
  check(
    '7',
    Boolean(oldBlack && newBlack && oldBlack.planningId !== newBlack.planningId && oldBlack.status === 'active' && movedResult.records.find((item) => item.planningId === oldBlack.planningId)?.status === 'retired' && whiteKept?.planningId === whiteBefore?.planningId),
    `旧编号 ${oldBlack?.planningId} 停用，新父级编号 ${newBlack?.planningId}，未变化的白色 ${whiteKept?.planningId}`,
  )

  const republish = reconcile(flatResult.records, data, 'flat', 'flat-v3', flatNodes())
  const sample = republish.records.find((item) => item.productModelId === 'flat' && item.status === 'active')
  check('8', republish.created === 0 && republish.reused === 6 && sample?.originModelVersionId === 'flat-v1' && sample.modelVersionIds.includes('flat-v1') && sample.modelVersionIds.includes('flat-v3'), `重发沿用 ${republish.reused}，来源版本 ${sample?.originModelVersionId}，版本 ${sample?.modelVersionIds.join('>')}`)

  const copied = cloneProductModel({
    sourceId: 'flat',
    name: '复制模型',
    productTypeId: 'pt',
    nextId: (() => {
      let seq = 0
      return (prefix: string) => `${prefix}-copy-${++seq}`
    })(),
    templates: [{ id: 'flat', name: '原模型', parentId: null, enabled: true, structureOrder: [] }],
    nodes: flatNodes().map((item) => ({ ...item, templateId: 'flat' })),
    templateParams: [],
  })
  const copyResult = copied ? reconcile(flatResult.records, data, copied.templateId, 'copy-v1', copied.nodes) : null
  const copyIds = copyResult ? idsOf(copyResult.records, copied?.templateId || '') : []
  check('9', Boolean(copied && copyIds.length === 6 && copyIds.every((item) => !flatIds.includes(item)) && idsOf(copyResult?.records || [], 'flat').join() === flatIds.join()), `复制模型新编号 ${copyIds.join(',')}`)

  const recreated = branchNodes().filter((item) => item.id !== 'black').concat(spec({ id: 'black-new', parentId: 'c256', nodeType: 'VALUE', attributeId: 'p-color', valueId: '黑色', sort: 1 }))
  const recreatedResult = reconcile(branchResult.records, data, 'branch', 'branch-v3', recreated)
  const retiredBlack = recreatedResult.records.find((item) => item.planningId === oldBlack?.planningId)
  const freshBlack = recreatedResult.records.find((item) => item.productModelId === 'branch' && item.status === 'active' && item.steps.some((step) => step.valueNodeId === 'black-new'))
  check('10', Boolean(retiredBlack?.status === 'retired' && freshBlack && freshBlack.planningId !== retiredBlack.planningId), `删除重建：旧 ${retiredBlack?.planningId} 仍在且停用，新 ${freshBlack?.planningId}`)

  const v1Snapshot = cloneNodes(branchNodes())
  const v2Snapshot = cloneNodes(moved)
  const traceData = catalog(phoneParams)
  traceData.planningRecords = movedResult.records
  traceData.specModelVersions = [version('branch-v1', v1Snapshot), version('branch-v2', v2Snapshot)]
  const tracedOld = oldBlack ? tracePlanning(traceData, oldBlack.planningId, 'branch-v1') : null
  const tracedNew = newBlack ? tracePlanning(traceData, newBlack.planningId, 'branch-v2') : null
  const oldStep = tracedOld?.steps.find((item) => item.step.valueNodeId === 'black')
  const newStep = tracedNew?.steps.find((item) => item.step.valueNodeId === 'black')
  check(
    '11',
    Boolean(tracedOld?.linked && tracedOld.version?.nodesSnapshot.find((item) => item.id === 'black')?.parentId === 'c256' && oldStep?.parentValueNodeId === 'v256' && tracedNew?.linked && newStep?.parentValueNodeId === 'v512' && tracePlanning(traceData, oldBlack?.planningId || '', 'branch-v2')?.linked === false && v1Snapshot.find((item) => item.id === 'black')?.parentId === 'c256'),
    `旧版本父级 ${oldStep?.parentValueNodeId}，新版本父级 ${newStep?.parentValueNodeId}`,
  )

  const renamed = catalog(phoneParams.map((item) => (item.id === 'p-color' ? { ...item, name: '机身颜色' } : item)))
  const renamedLabels = legalPlanningCombinations(renamed, 'flat', flatNodes())
  const renamedKeys = renamedLabels.map((item) => item.identityKey).sort()
  check('6b', renamedKeys.join() === originalKeys.join() && renamedLabels.every((item) => item.label.includes('机身颜色')) && renamedLabels.every((item) => planningIdentityKey(item.steps) === item.identityKey), '展示名变化不改变身份键')

  const bare = flatNodes().map((item) => (item.id === 'color' ? { ...item, role: undefined } : item))
  const schemeData = catalog(phoneParams, [{ templateId: 'm', paramId: 'p-color', role: 'variant' }])
  const gaps = planningRoleGaps(schemeData, 'm', bare)
  const withScheme = legalPlanningCombinations(schemeData, 'm', bare)
  const explicit = bare.map((item) => (item.id === 'color' ? { ...item, role: 'VARIANT' as const } : item))
  const explicitKeys = legalPlanningCombinations(schemeData, 'm', explicit).map((item) => item.identityKey).sort()
  check('role', gaps.some((item) => item.attributeNodeId === 'color') && withScheme.length === 6 && explicitKeys.join() === withScheme.map((item) => item.identityKey).sort().join(), `缺角色节点 ${gaps.map((item) => item.attributeNodeId).join(',')}`)

  const seed = createSeed()
  const versionText = JSON.stringify(seed.specModelVersions)
  const familyText = JSON.stringify(seed.families.map((item) => item.line || ''))
  const skuPlanText = JSON.stringify(seed.skus.map((item) => item.planningId || ''))
  delete (seed as { planningRecords?: PlanningRecord[] }).planningRecords
  const loaded = normalizeStored({ version: 10, data: seed })
  check('migrate', Boolean(loaded && loaded.planningRecords.length === 0 && JSON.stringify(loaded.specModelVersions) === versionText && loaded.families.every((item) => !item.line) && loaded.skus.every((item) => !item.planningId) && familyText === JSON.stringify(loaded.families.map((item) => item.line || '')) && skuPlanText === JSON.stringify(loaded.skus.map((item) => item.planningId || ''))), `迁移后规划档 ${loaded?.planningRecords.length ?? -1} 条`)

  const persisted = JSON.parse(JSON.stringify({ version: 11, data: { ...createSeed(), planningRecords: flatResult.records } })) as { version: number; data: AppData }
  const roundTrip = normalizeStored(persisted)
  check('12-domain', Boolean(roundTrip && JSON.stringify(roundTrip.planningRecords) === JSON.stringify(flatResult.records)), `往返后 ${roundTrip?.planningRecords.length ?? 0} 条规划档`)

  const frozenInput = { commonAttrs: { 品牌: 'Apple' }, variantSelections: { 容量: ['128G', '256G'], 颜色: ['黑色', '白色', '不存在'] }, modelSnapshot: flatNodes().map((item) => ({ ...item, valueId: item.valueId.replace('GB', 'G') })) }
  const frozen = generateSkuFromModel(frozenInput)
  const frozenVariants = frozen.skus.map((item) => item.variant)
  check(
    '13',
    JSON.stringify(frozen.commonAttrs) === JSON.stringify({ 品牌: 'Apple' }) && frozenVariants.length === 4 && frozenVariants.some((item) => item['容量'] === '128G' && item['颜色'] === '黑色') && frozenVariants.some((item) => item['容量'] === '256G' && item['颜色'] === '白色') && !frozenVariants.some((item) => item['颜色'] === '不存在') && JSON.stringify(frozenInput.commonAttrs) === JSON.stringify({ 品牌: 'Apple' }),
    `V2 SKU ${frozenVariants.length} 条`,
  )

  const selectorNodes = [
    spec({ id: 'cap', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'p-cap', role: 'VARIANT' }),
    spec({ id: 'v256', parentId: 'cap', nodeType: 'VALUE', attributeId: 'p-cap', valueId: '256G' }),
    spec({ id: 'c256', parentId: 'v256', nodeType: 'ATTRIBUTE', attributeId: 'p-color', role: 'VARIANT' }),
    spec({ id: 'black', parentId: 'c256', nodeType: 'VALUE', attributeId: 'p-color', valueId: '黑色' }),
    spec({ id: 'white256', parentId: 'c256', nodeType: 'VALUE', attributeId: 'p-color', valueId: '白色', sort: 2 }),
    spec({ id: 'v512', parentId: 'cap', nodeType: 'VALUE', attributeId: 'p-cap', valueId: '512G', sort: 2 }),
    spec({ id: 'c512', parentId: 'v512', nodeType: 'ATTRIBUTE', attributeId: 'p-color', role: 'VARIANT' }),
    spec({ id: 'white512', parentId: 'c512', nodeType: 'VALUE', attributeId: 'p-color', valueId: '白色' }),
    spec({ id: 'gray', parentId: 'c512', nodeType: 'VALUE', attributeId: 'p-color', valueId: '灰色', sort: 2 }),
  ]
  const selected = chooseModelNode(data, 'm', selectorNodes, emptyModelSelection(), 'p-cap', ['256G'])
  const collected = collectModelSelections(data, 'm', selectorNodes, selected)
  const colorRow = collected.rows.find((item) => item.label === '颜色')
  const both = chooseModelNode(data, 'm', selectorNodes, emptyModelSelection(), 'p-cap', ['256G', '512G'])
  const bothColors = collectModelSelections(data, 'm', selectorNodes, both).rows.find((item) => item.label === '颜色')?.options.map((item) => item.name).sort()
  const v2Cross = generateSkuFromModel({ commonAttrs: {}, variantSelections: { 容量: ['256G', '512G'], 颜色: ['黑色', '白色', '灰色'] }, modelSnapshot: selectorNodes })
  const legalSelector = labelsOf(data, 'm', selectorNodes)
  const seedData = createSeed()
  const iphone = seedData.families.find((item) => item.id === 'f-iphone')
  const iphoneSkus = seedData.skus.filter((item) => item.familyId === 'f-iphone')
  const iphoneErrors = iphone ? inspectFamily(seedData, iphone, iphoneSkus).filter((item) => item.level === 'error') : [{ message: 'missing' }]
  const ebikePlan = seedData.productPlans.find((item) => item.id === 'plan-ebike-city')
  const ebikeLines = ebikePlan ? planSkuLines(seedData, ebikePlan) : null
  check(
    '14',
    Boolean(colorRow && colorRow.options.map((item) => item.name).sort().join() === '白色,黑色' && !colorRow.options.some((item) => item.name === '灰色') && bothColors?.join() === '灰色,白色,黑色' && v2Cross.skus.length === 6 && v2Cross.skus.some((item) => item.variant['容量'] === '512G' && item.variant['颜色'] === '黑色') && legalSelector.length === 4 && !legalSelector.some((item) => item.includes('512G') && item.includes('黑色')) && !legalSelector.some((item) => item.includes('256G') && item.includes('灰色')) && iphoneErrors.length === 0 && ebikeLines?.skus.map((item) => item.name).join('|') === '48V12Ah 黑色|48V12Ah 白色|48V20Ah 灰色'),
    `选择器颜色 ${colorRow?.options.map((item) => item.name).join('/') || '无'}；V2 交叉 ${v2Cross.skus.length}；合法 ${legalSelector.length}；旧商品错误 ${iphoneErrors.length}；电助力 ${ebikeLines?.skus.map((item) => item.name).join('|') || '无'}`,
  )

  const memory = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
      removeItem: (key: string) => memory.delete(key),
      clear: () => memory.clear(),
      key: () => null,
      get length() {
        return memory.size
      },
    },
  })
  setActivePinia(createPinia())
  const store = useCatalogStore()
  await store.waitForPersistence()
  const beforeVersions = JSON.stringify(store.data.specModelVersions)
  const published = (await store.publishSpecModel('t-phone'))
  const phoneIds = idsOf(store.data.planningRecords, 't-phone')
  const publishedAgain = (await store.publishSpecModel('t-phone'))
  const phoneIdsAgain = idsOf(store.data.planningRecords, 't-phone')
  await nextTick()
  setActivePinia(createPinia())
  const restored = useCatalogStore()
  await restored.waitForPersistence()
  const restoredIds = idsOf(restored.data.planningRecords, 't-phone')
  const expectedPhone = [
    '品牌 Apple · 系列 iPhone · 型号 iPhone 17 · 容量 128G · 颜色 黑色',
    '品牌 Apple · 系列 iPhone · 型号 iPhone 17 · 容量 128G · 颜色 白色',
    '品牌 Apple · 系列 iPhone · 型号 iPhone 17 · 容量 256G · 颜色 白色',
    '品牌 华为 · 系列 Mate · 容量 128G · 颜色 黑色',
  ].sort()
  const phoneLabels = legalPlanningCombinations(store.data, 't-phone', store.data.productSpecNodes.filter((item) => item.templateId === 't-phone')).map((item) => item.label).sort()
  check('12-refresh', published.ok && phoneLabels.join('\n') === expectedPhone.join('\n') && phoneIds.length === expectedPhone.length && !publishedAgain.ok && phoneIdsAgain.join() === phoneIds.join() && restoredIds.join() === phoneIds.join() && JSON.stringify(restored.data.specModelVersions) === beforeVersions && restored.data.families.every((item) => !item.line) && restored.data.skus.every((item) => !item.planningId), `发布「${published.message}」；路径 ${phoneLabels.join(' | ')}`)

  return results
}
