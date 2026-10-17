import { createPinia, setActivePinia } from 'pinia'
import { chooseModelNode, emptyModelSelection, generateSkuFromModel, inspectFamily } from './logic'
import { createV3Material, materialOfferings, resolveV3MaterialSpec } from './material'
import { legalPlanningCombinations, reconcilePlanningRecords, tracePlanning } from './planning'
import { createSeed } from './seed'
import { normalizeStored, useCatalogStore } from '../stores/catalog'
import type { AppData, ParamRole, PlanningRecord, ProductSpecNode } from './types'

export interface CheckResult {
  id: string
  ok: boolean
  detail: string
}

function spec(partial: Partial<ProductSpecNode> & Pick<ProductSpecNode, 'id' | 'parentId' | 'nodeType'>): ProductSpecNode {
  return { templateId: 'm', attributeId: '', valueId: '', sort: 1, role: 'VARIANT', ...partial }
}

function branchNodes(): ProductSpecNode[] {
  return [
    spec({ id: 'brand', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'p-brand', sort: 1, role: 'COMMON' }),
    spec({ id: 'apple', parentId: 'brand', nodeType: 'VALUE', attributeId: 'p-brand', valueId: 'Apple', sort: 1 }),
    spec({ id: 'huawei', parentId: 'brand', nodeType: 'VALUE', attributeId: 'p-brand', valueId: '华为', sort: 2 }),
    spec({ id: 'cap', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'p-cap', sort: 2, role: 'VARIANT' }),
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

function flatNodes(): ProductSpecNode[] {
  return [
    spec({ id: 'cap', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'p-cap', sort: 1 }),
    spec({ id: 'c128', parentId: 'cap', nodeType: 'VALUE', attributeId: 'p-cap', valueId: '128GB' }),
    spec({ id: 'c256', parentId: 'cap', nodeType: 'VALUE', attributeId: 'p-cap', valueId: '256GB', sort: 2 }),
    spec({ id: 'color', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'p-color', sort: 2 }),
    spec({ id: 'black', parentId: 'color', nodeType: 'VALUE', attributeId: 'p-color', valueId: '黑色' }),
    spec({ id: 'white', parentId: 'color', nodeType: 'VALUE', attributeId: 'p-color', valueId: '白色', sort: 2 }),
    spec({ id: 'blue', parentId: 'color', nodeType: 'VALUE', attributeId: 'p-color', valueId: '蓝色', sort: 3 }),
  ]
}

function world(nodes: ProductSpecNode[], modelId = 'm'): AppData {
  const data = {
    params: [
      { id: 'p-brand', name: '品牌', values: [], valueGroups: [], participateInStructure: true },
      { id: 'p-cap', name: '容量', values: [], valueGroups: [], participateInStructure: true },
      { id: 'p-color', name: '颜色', values: [], valueGroups: [], participateInStructure: true },
    ],
    templateParams: [] as { templateId: string; paramId: string; role: ParamRole; required: boolean }[],
    templates: [{ id: modelId, name: '手机模型', parentId: null, enabled: true, structureOrder: [] }],
    productTypes: [{ id: 'pt', name: '手机', categoryId: 'c', status: 'enabled', sort: 1, description: '' }],
    specCanvases: [{ templateId: modelId, productTypeId: 'pt', name: '手机模型', zoom: 1, panX: 0, panY: 0, status: 'published', version: 1, versionName: 'V1' }],
    specModelVersions: [],
    planningRecords: [] as PlanningRecord[],
    materialReceipts: [],
    families: [],
    skus: [],
    rules: [],
    productSpecNodes: nodes,
  } as unknown as AppData
  return data
}

function publish(data: AppData, nodes: ProductSpecNode[], versionId: string, modelId = 'm') {
  data.specModelVersions.push({ id: versionId, templateId: modelId, version: data.specModelVersions.length + 1, versionName: versionId, status: 'published', nodesSnapshot: nodes.map((item) => ({ ...item })), createdTime: '', publishTime: '' })
  const result = reconcilePlanningRecords({ records: data.planningRecords, data, productModelId: modelId, modelVersionId: versionId, nodes, now: '2026-10-15T00:00:00.000Z' })
  data.planningRecords = result.records
  return result
}

function create(data: AppData, planningId: string, requestId: string, versionId: string, familyId?: string) {
  let seq = data.skus.length + data.families.length
  return createV3Material(data, {
    productModelId: 'm',
    modelVersionId: versionId,
    planningId,
    requestId,
    categoryId: 'c',
    productTypeId: 'pt',
    familyId,
    now: '2026-10-15T00:00:00.000Z',
    nextId: (prefix) => `${prefix}-${++seq}`,
  })
}

export async function runMaterialChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = []
  const check = (id: string, ok: boolean, detail: string) => results.push({ id, ok, detail })

  const branched = world(branchNodes())
  publish(branched, branchNodes(), 'v1')
  const offers = materialOfferings(branched, 'm')
  const labels = offers.rows.map((item) => item.label)
  const black = offers.rows.find((item) => item.label.includes('256GB') && item.label.includes('黑色') && item.label.includes('Apple'))
  const banned = labels.filter((item) => item.includes('512GB') && item.includes('黑色') || item.includes('1TB') && item.includes('黑色'))
  const created = black ? create(branched, black.planningId, 'req-a', 'v1') : { ok: false as const, message: 'missing' }
  const createdSku = created.ok ? branched.skus.find((item) => item.id === created.skuId) : undefined
  const earlyPreview = black ? resolveV3MaterialSpec(branched, { productModelId: 'm', modelVersionId: 'v1', planningId: black.planningId }) : { ok: false as const, message: 'missing' }
  const appleRows = offers.rows.filter((item) => item.label.includes('Apple'))
  check('A', Boolean(appleRows.length === 4 && offers.rows.length === 8 && banned.length === 0 && black?.planningId && created.ok && createdSku?.sourceNodeIds?.includes('black') && createdSku?.sourceNodeIds?.includes('v256') && createdSku?.planningId === black?.planningId), `Apple 条件规格 ${appleRows.length} 条，全部 ${offers.rows.length} 条，建档 ${created.ok ? created.materialCode : created.message}`)

  const second = black ? create(branched, black.planningId, 'req-b', 'v1') : { ok: false as const, message: 'missing' }
  const duo = branched.skus.filter((item) => item.planningId === black?.planningId)
  const owner = branched.families.find((item) => item.id === duo[0]?.familyId)
  const inspected = owner ? inspectFamily(branched, owner, duo, ['容量', '颜色']) : []
  check('B', Boolean(second.ok && second.materialCode !== (created.ok ? created.materialCode : '') && duo.length === 2 && new Set(duo.map((item) => item.id)).size === 2 && duo.every((item) => item.planningId === black?.planningId) && owner?.line === 'v3' && inspected.every((item) => item.kind !== 'duplicate')), `同规划物料 ${duo.map((item) => item.materialCode).join(',')}，V3 重复规格 ${inspected.filter((item) => item.kind === 'duplicate').length} 条`)

  const flat = world(flatNodes())
  publish(flat, flatNodes(), 'flat-v1')
  const flatOffers = materialOfferings(flat, 'm')
  const flatCreated = flatOffers.rows.map((row, index) => create(flat, row.planningId, `flat-${index}`, 'flat-v1'))
  check('C', flatOffers.rows.length === 6 && flatCreated.every((item) => item.ok) && new Set(flat.skus.map((item) => item.planningId)).size === 6 && flat.skus.every((item) => (item.sourceNodeIds || []).length === 2), `平级 ${flatOffers.rows.length} 条都已建档`)

  const fromList = black ? create(branched, black.planningId, 'req-list', 'v1') : { ok: false as const, message: 'missing' }
  const listSku = fromList.ok ? branched.skus.find((item) => item.id === fromList.skuId) : undefined
  check('D', Boolean(fromList.ok && listSku?.planningId === black?.planningId && listSku?.sourceNodeIds?.join() === createdSku?.sourceNodeIds?.join() && listSku?.modelVersionId === 'v1'), `列表入口 ${fromList.ok ? fromList.materialCode : fromList.message}`)

  const replay = black ? create(branched, black.planningId, 'req-a', 'v1') : { ok: false as const, message: 'missing' }
  const beforeReplay = duo.length
  check('E', Boolean(replay.ok && !replay.created && replay.materialCode === (created.ok ? created.materialCode : '') && branched.skus.filter((item) => item.planningId === black?.planningId).length === beforeReplay + 1), `重复提交 created=${replay.ok ? replay.created : 'fail'} 编码 ${replay.ok ? replay.materialCode : ''}`)

  const moved = branchNodes().map((item) => (item.id === 'black' ? { ...item, parentId: 'c512' } : { ...item }))
  const oldSku = createdSku ? { ...createdSku, variantAttrs: { ...createdSku.variantAttrs }, sourceNodeIds: [...(createdSku.sourceNodeIds || [])] } : undefined
  publish(branched, moved, 'v2')
  const traced = oldSku ? tracePlanning(branched, oldSku.planningId || '', 'v1') : null
  const still = branched.skus.find((item) => item.id === oldSku?.id)
  const newBlack = branched.planningRecords.find((item) => item.status === 'active' && item.steps.some((step) => step.valueNodeId === 'black' && step.parentValueNodeId === 'v512'))
  const newer = newBlack ? create(branched, newBlack.planningId, 'req-new-path', 'v2') : { ok: false as const, message: 'missing' }
  check('F', Boolean(still?.modelVersionId === 'v1' && still.variantAttrs['颜色'] === '黑色' && still.variantAttrs['容量'] === '256GB' && traced?.linked && traced.version?.nodesSnapshot.find((item) => item.id === 'black')?.parentId === 'c256' && newer.ok && newer.planningId !== still?.planningId && branched.specModelVersions[0].nodesSnapshot.find((item) => item.id === 'black')?.parentId === 'c256'), `旧物料版本 ${still?.modelVersionId}，新规划 ${newer.ok ? newer.planningId : newer.message}`)

  const memory = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value), removeItem: (key: string) => memory.delete(key), clear: () => memory.clear(), key: () => null, get length() { return memory.size } } })
  setActivePinia(createPinia())
  const store = useCatalogStore()
  const versionCount = store.data.specModelVersions.length
  const blocked = store.removeTemplate('t-phone')
  check('G', blocked.includes('不能删除') && store.data.specModelVersions.length === versionCount && store.data.families.some((item) => item.id === 'f-iphone'), blocked || '删除未被拦住')
  const typeCount = store.data.productTypes.length
  const blockedType = store.removeProductType('pt-phone')
  const added = store.saveProductType({ id: '', name: '未被引用的类型', categoryId: 'c-watch', description: '', sort: 9, status: 'enabled' })
  const freshType = store.data.productTypes.find((item) => item.name === '未被引用的类型')
  const removedType = freshType ? store.removeProductType(freshType.id) : '没有创建出来'
  check('type-guard', blockedType.includes('不能删除') && store.data.productTypes.length === typeCount && added === '' && removedType === '' && !store.data.productTypes.some((item) => item.name === '未被引用的类型'), blockedType || removedType)

  const retiredCreate = black ? create(branched, black.planningId, 'req-retired', 'v1') : { ok: false as const, message: 'missing' }
  const frozen = generateSkuFromModel({ commonAttrs: { 品牌: 'Apple' }, variantSelections: { 容量: ['128GB', '256GB'], 颜色: ['黑色', '白色'] }, modelSnapshot: flatNodes() })
  const selector = chooseModelNode(world(flatNodes()), 'm', flatNodes(), emptyModelSelection(), 'p-cap', ['128GB'])
  const seed = createSeed()
  const iphone = seed.families.find((item) => item.id === 'f-iphone')
  const iphoneIssues = iphone ? inspectFamily(seed, iphone, seed.skus.filter((item) => item.familyId === 'f-iphone')) : []
  const dupFamily = { ...seed.families[0], name: '重复校验' }
  const dupSkus = [seed.skus[0], { ...seed.skus[0], id: 'dup' }]
  check('H', Boolean(earlyPreview.ok && createdSku?.planningId === black?.planningId && Boolean(createdSku?.skuName) && !retiredCreate.ok && frozen.skus.length === 4 && selector.variantSelections['容量']?.includes('128GB') && iphoneIssues.every((item) => item.level !== 'error') && inspectFamily(seed, dupFamily, dupSkus).some((item) => item.kind === 'duplicate') && seed.families.every((item) => !item.line)), `V2 SKU ${frozen.skus.length}，停用拦截 ${retiredCreate.ok ? '失败' : retiredCreate.message}`)

  const huawei = materialOfferings(branched, 'm').rows.find((item) => item.label.includes('华为') && item.planningId && !item.retired)
  const huaweiCreated = huawei ? create(branched, huawei.planningId, 'req-huawei', huawei.modelVersionId) : { ok: false as const, message: 'missing' }
  const appleFamily = created.ok ? branched.families.find((item) => item.id === created.familyId) : undefined
  const huaweiFamily = huaweiCreated.ok ? branched.families.find((item) => item.id === huaweiCreated.familyId) : undefined
  check('family', Boolean(created.ok && second.ok && created.familyId === second.familyId && huaweiCreated.ok && huaweiFamily?.id !== appleFamily?.id && appleFamily?.line === 'v3' && appleFamily.commonSignature?.includes('p-brand=Apple') && branched.families.every((item) => item.id === 'same-name' || item.line === 'v3')), `苹果商品 ${appleFamily?.id}，华为商品 ${huaweiFamily?.id}`)

  const loaded = normalizeStored({ version: 11, data: createSeed() })
  check('keep', Boolean(loaded && loaded.materialReceipts.length === 0 && loaded.planningRecords.length === 0 && loaded.families.some((item) => item.id === 'f-iphone')), '旧数据补了空回执，没有改商品')

  const combos = legalPlanningCombinations(branched, 'm', branched.specModelVersions.find((item) => item.id === 'v1')?.nodesSnapshot || [])
  check('same-spec', earlyPreview.ok && combos.some((item) => item.label === earlyPreview.spec.label), '预览和发布快照是同一条规格')

  return results
}
