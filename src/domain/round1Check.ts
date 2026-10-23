import { installCatalogTestLocks } from '../../scripts/catalog-storage-test-env'
installCatalogTestLocks()
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { NON_LEAF_TYPE_BLOCK, TYPED_CATEGORY_CHILD_BLOCK } from './categoryTree'
import { dictionaryRemovalBlock } from './dictionaryGuard'
import { specPublishProblems } from './logic'
import { MATERIAL_DELETED_MESSAGE, createTemporaryMaterial, createV3Material } from './material'
import { legalPlanningCombinations, reconcilePlanningRecords } from './planning'
import { legacyPhoneSpecNodes, stagePhoneModelCorrection, createSeed } from './seed'
import { normalizeStored, useCatalogStore } from '../stores/catalog'
import { DATA_VERSION, STORAGE_KEY, type AppData, type ProductSpecNode } from './types'

const DEFAULT_PHONE = [
  '品牌 Apple · 系列 iPhone · 型号 iPhone 17 · 容量 128G · 颜色 黑色',
  '品牌 Apple · 系列 iPhone · 型号 iPhone 17 · 容量 128G · 颜色 白色',
  '品牌 Apple · 系列 iPhone · 型号 iPhone 17 · 容量 256G · 颜色 白色',
  '品牌 华为 · 系列 Mate · 容量 128G · 颜色 黑色',
]

const TEST_APPLE = [
  '品牌 Apple · 系列 iPhone测试系列 · 型号 测试型号 · 容量 256G · 颜色 黑色',
  '品牌 Apple · 系列 iPhone测试系列 · 型号 测试型号 · 容量 256G · 颜色 白色',
  '品牌 Apple · 系列 iPhone测试系列 · 型号 测试型号 · 容量 512G · 颜色 白色',
  '品牌 Apple · 系列 iPhone测试系列 · 型号 测试型号 · 容量 1TB · 颜色 白色',
]

const TEST_HUAWEI = ['品牌 华为 · 型号 Mate测试型号 · 容量 256G · 颜色 黑色']

interface CheckRow {
  group: 'G1' | 'G2' | 'G3' | 'G4'
  id: string
  ok: boolean
  detail: string
}

function sorted(values: string[]) {
  return [...values].sort()
}

function sameSet(actual: string[], expected: string[]) {
  return sorted(actual).join('\n') === sorted(expected).join('\n')
}

function crossBrand(label: string) {
  return (label.includes('Apple') && (label.includes('华为') || label.includes('Mate'))) || (label.includes('华为') && label.includes('iPhone'))
}

function labelsOf(data: AppData, modelId: string, nodes: ProductSpecNode[]) {
  return legalPlanningCombinations(data, modelId, nodes).map((item) => item.label)
}

function spec(templateId: string, partial: Partial<ProductSpecNode> & Pick<ProductSpecNode, 'id' | 'parentId' | 'nodeType' | 'attributeId' | 'sort'>): ProductSpecNode {
  return { templateId, valueId: '', ...partial }
}

/** 独立测试模型。取值带“测试”，不写入 createSeed。 */
function conditionalTestNodes(templateId: string) {
  return [
    spec(templateId, { id: 'd-brand', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'p-brand', sort: 1, role: 'COMMON' }),
    spec(templateId, { id: 'd-apple', parentId: 'd-brand', nodeType: 'VALUE', attributeId: 'p-brand', valueId: 'Apple', sort: 1 }),
    spec(templateId, { id: 'd-huawei', parentId: 'd-brand', nodeType: 'VALUE', attributeId: 'p-brand', valueId: '华为', sort: 2 }),
    spec(templateId, { id: 'd-apple-series', parentId: 'd-apple', nodeType: 'ATTRIBUTE', attributeId: 'p-series', sort: 1, role: 'COMMON' }),
    spec(templateId, { id: 'd-apple-series-value', parentId: 'd-apple-series', nodeType: 'VALUE', attributeId: 'p-series', valueId: 'iPhone测试系列', sort: 1 }),
    spec(templateId, { id: 'd-apple-model', parentId: 'd-apple-series-value', nodeType: 'ATTRIBUTE', attributeId: 'p-model', sort: 1, role: 'COMMON' }),
    spec(templateId, { id: 'd-apple-model-value', parentId: 'd-apple-model', nodeType: 'VALUE', attributeId: 'p-model', valueId: '测试型号', sort: 1 }),
    spec(templateId, { id: 'd-cap', parentId: 'd-apple-model-value', nodeType: 'ATTRIBUTE', attributeId: 'p-cap', sort: 1, role: 'VARIANT' }),
    spec(templateId, { id: 'd-256', parentId: 'd-cap', nodeType: 'VALUE', attributeId: 'p-cap', valueId: '256G', sort: 1 }),
    spec(templateId, { id: 'd-color-256', parentId: 'd-256', nodeType: 'ATTRIBUTE', attributeId: 'p-color', sort: 1, role: 'VARIANT' }),
    spec(templateId, { id: 'd-256-black', parentId: 'd-color-256', nodeType: 'VALUE', attributeId: 'p-color', valueId: '黑色', sort: 1 }),
    spec(templateId, { id: 'd-256-white', parentId: 'd-color-256', nodeType: 'VALUE', attributeId: 'p-color', valueId: '白色', sort: 2 }),
    spec(templateId, { id: 'd-512', parentId: 'd-cap', nodeType: 'VALUE', attributeId: 'p-cap', valueId: '512G', sort: 2 }),
    spec(templateId, { id: 'd-color-512', parentId: 'd-512', nodeType: 'ATTRIBUTE', attributeId: 'p-color', sort: 1, role: 'VARIANT' }),
    spec(templateId, { id: 'd-512-white', parentId: 'd-color-512', nodeType: 'VALUE', attributeId: 'p-color', valueId: '白色', sort: 1 }),
    spec(templateId, { id: 'd-1t', parentId: 'd-cap', nodeType: 'VALUE', attributeId: 'p-cap', valueId: '1TB', sort: 3 }),
    spec(templateId, { id: 'd-color-1t', parentId: 'd-1t', nodeType: 'ATTRIBUTE', attributeId: 'p-color', sort: 1, role: 'VARIANT' }),
    spec(templateId, { id: 'd-1t-white', parentId: 'd-color-1t', nodeType: 'VALUE', attributeId: 'p-color', valueId: '白色', sort: 1 }),
    spec(templateId, { id: 'd-huawei-model', parentId: 'd-huawei', nodeType: 'ATTRIBUTE', attributeId: 'p-model', sort: 1, role: 'COMMON' }),
    spec(templateId, { id: 'd-huawei-model-value', parentId: 'd-huawei-model', nodeType: 'VALUE', attributeId: 'p-model', valueId: 'Mate测试型号', sort: 1 }),
    spec(templateId, { id: 'd-huawei-cap', parentId: 'd-huawei-model-value', nodeType: 'ATTRIBUTE', attributeId: 'p-cap', sort: 1, role: 'VARIANT' }),
    spec(templateId, { id: 'd-huawei-256', parentId: 'd-huawei-cap', nodeType: 'VALUE', attributeId: 'p-cap', valueId: '256G', sort: 1 }),
    spec(templateId, { id: 'd-huawei-color', parentId: 'd-huawei-256', nodeType: 'ATTRIBUTE', attributeId: 'p-color', sort: 1, role: 'VARIANT' }),
    spec(templateId, { id: 'd-huawei-black', parentId: 'd-huawei-color', nodeType: 'VALUE', attributeId: 'p-color', valueId: '黑色', sort: 1 }),
  ]
}

function withTestDictionary(data: AppData) {
  const add = (id: string, value: string) => {
    const param = data.params.find((item) => item.id === id)
    if (param && !param.values.includes(value)) param.values.push(value)
  }
  add('p-series', 'iPhone测试系列')
  add('p-model', '测试型号')
  add('p-model', 'Mate测试型号')
  add('p-cap', '1TB')
}

let mountedStore: ReturnType<typeof useCatalogStore> | undefined
function boot(seed?: AppData) {
  mountedStore?.$dispose()
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
  if (seed) memory.set(STORAGE_KEY, JSON.stringify({ version: DATA_VERSION, data: seed }))
  setActivePinia(createPinia())
  mountedStore = useCatalogStore()
  return mountedStore
}

export async function runRound1Checks() {
  const results: CheckRow[] = []
  const check = (group: CheckRow['group'], id: string, ok: boolean, detail: string) => results.push({ group, id, ok, detail })

  const fresh = createSeed()
  const phoneNodes = fresh.productSpecNodes.filter((item) => item.templateId === 't-phone')
  const phoneLabels = labelsOf(fresh, 't-phone', phoneNodes)
  const phoneRoots = phoneNodes.filter((item) => !item.parentId)
  const published = fresh.specModelVersions.find((item) => item.id === 'phone-model-v1')
  const publishedLabels = labelsOf(fresh, 't-phone', published?.nodesSnapshot || [])
  check('G1', 'default-paths', sameSet(phoneLabels, DEFAULT_PHONE) && phoneLabels.filter(crossBrand).length === 0 && !phoneLabels.some((item) => item.includes('容量 256G · 颜色 黑色')), phoneLabels.join(' | '))
  check('G1', 'default-shape', phoneRoots.length === 1 && phoneRoots[0]?.attributeId === 'p-brand' && phoneNodes.every((item) => item.attributeId && (item.nodeType === 'ATTRIBUTE' || item.valueId)), `根属性 ${phoneRoots.map((item) => item.attributeId).join(',')}`)
  check('G1', 'default-snapshot', Boolean(published && sameSet(publishedLabels, DEFAULT_PHONE) && specPublishProblems(fresh, phoneNodes).length === 0), specPublishProblems(fresh, phoneNodes).join('；') || publishedLabels.join(' | '))
  check('G1', 'historical-anomaly-kept', fresh.productTypes.some((item) => item.id === 'pt-film' && item.categoryId === 'c-phone-acc') && fresh.categories.some((item) => item.id === 'c-case' && item.parentId === 'c-phone-acc'), '手机膜仍挂在已有子分类的手机配件下')

  const demo = createSeed()
  withTestDictionary(demo)
  const demoNodes = conditionalTestNodes('t-phone-test')
  const demoLabels = labelsOf(demo, 't-phone-test', demoNodes)
  const apple = demoLabels.filter((item) => item.includes('Apple'))
  const huawei = demoLabels.filter((item) => item.includes('华为'))
  const banned = demoLabels.filter((item) => crossBrand(item) || item.includes('512G') && item.includes('黑色') || item.includes('1TB') && item.includes('黑色'))
  check('G1', 'test-apple', sameSet(apple, TEST_APPLE), apple.join(' | '))
  check('G1', 'test-huawei', sameSet(huawei, TEST_HUAWEI), huawei.join(' | '))
  check('G1', 'test-illegal', demoLabels.length === TEST_APPLE.length + TEST_HUAWEI.length && banned.length === 0, `合法 ${demoLabels.length}，非法 ${banned.length}`)
  check('G1', 'test-publishable', specPublishProblems(demo, demoNodes).length === 0, specPublishProblems(demo, demoNodes).join('；') || '词典引用完整')
  const numbered = reconcilePlanningRecords({ records: [], data: demo, productModelId: 't-phone-test', modelVersionId: 'demo-v1', nodes: demoNodes, now: '2026-10-16T00:00:00.000Z' })
  const again = reconcilePlanningRecords({ records: numbered.records, data: demo, productModelId: 't-phone-test', modelVersionId: 'demo-v1', nodes: demoNodes, now: '2026-10-16T01:00:00.000Z' })
  const reordered = demoNodes.map((item) => (item.id === 'd-256-black' ? { ...item, sort: 2 } : item.id === 'd-256-white' ? { ...item, sort: 1 } : item))
  const afterOrder = reconcilePlanningRecords({ records: again.records, data: demo, productModelId: 't-phone-test', modelVersionId: 'demo-v1', nodes: reordered, now: '2026-10-16T02:00:00.000Z' })
  const planIds = (rows: typeof numbered.records) => rows.filter((item) => item.status === 'active').map((item) => item.planningId).sort().join()
  check('G1', 'test-pln', numbered.created === demoLabels.length && again.created === 0 && planIds(again.records) === planIds(numbered.records) && planIds(afterOrder.records) === planIds(numbered.records), `首次 ${numbered.created}，重算 ${again.created}，调序后 ${planIds(afterOrder.records)}`)

  const legacyNodes = legacyPhoneSpecNodes()
  const legacyLabels = labelsOf(fresh, 't-phone', legacyNodes)
  check('G1', 'LEGACY-parallel-phone', legacyLabels.length === 16 && legacyLabels.some(crossBrand) && legacyNodes.filter((item) => !item.parentId).length === 4, `旧并列结构仍交叉 ${legacyLabels.filter(crossBrand).length} 条，共 ${legacyLabels.length} 条，不能当作现行验收`)

  const storedLegacy = JSON.parse(JSON.stringify(createSeed())) as AppData
  storedLegacy.productSpecNodes = [...storedLegacy.productSpecNodes.filter((item) => item.templateId !== 't-phone'), ...legacyPhoneSpecNodes()]
  const legacyVersion = storedLegacy.specModelVersions.find((item) => item.id === 'phone-model-v1')
  if (legacyVersion) legacyVersion.nodesSnapshot = legacyPhoneSpecNodes()
  const legacySnapshot = JSON.stringify(legacyVersion?.nodesSnapshot)
  const legacyPlans = JSON.stringify(storedLegacy.planningRecords)
  const legacySkus = JSON.stringify(storedLegacy.skus.map((item) => item.id))
  const loadedLegacy = normalizeStored({ version: DATA_VERSION, data: storedLegacy })
  const loadedSnapshot = JSON.stringify(loadedLegacy?.specModelVersions.find((item) => item.id === 'phone-model-v1')?.nodesSnapshot)
  const loadedRoots = (loadedLegacy?.productSpecNodes || []).filter((item) => item.templateId === 't-phone' && !item.parentId).map((item) => item.attributeId).sort()
  check('G1', 'load-keeps-legacy', Boolean(loadedLegacy && loadedSnapshot === legacySnapshot && legacyPlans === JSON.stringify(loadedLegacy.planningRecords) && legacySkus === JSON.stringify(loadedLegacy.skus.map((item) => item.id)) && loadedRoots.join() === 'p-brand,p-cap,p-color,p-series'), `读取后根属性 ${loadedRoots.join(',')}`)

  storedLegacy.planningRecords = [{
    planningId: 'PLN-LEGACY',
    productModelId: 't-phone',
    originModelVersionId: 'phone-model-v1',
    modelVersionId: 'phone-model-v1',
    modelVersionIds: ['phone-model-v1'],
    steps: [],
    identityKey: 'legacy-key',
    status: 'active',
    createdTime: '2026-05-10T03:53:00.000Z',
  }]
  const sampleSku = storedLegacy.skus.find((item) => item.id === 's-iphone-blue')
  if (sampleSku) storedLegacy.skus.push({ ...sampleSku, id: 's-legacy-phone', variantAttrs: { ...sampleSku.variantAttrs }, projectedAttrs: { ...sampleSku.projectedAttrs }, planningId: 'PLN-LEGACY', modelVersionId: 'phone-model-v1' })
  const frozenSnapshot = JSON.stringify(storedLegacy.specModelVersions.find((item) => item.id === 'phone-model-v1')?.nodesSnapshot)
  const store = boot(storedLegacy)
  const staged = stagePhoneModelCorrection(store.data)
  const snapshotAfterStage = JSON.stringify(store.data.specModelVersions.find((item) => item.id === 'phone-model-v1')?.nodesSnapshot)
  const publishedCorrection = (await store.publishSpecModel('t-phone'))
  const v1 = store.data.specModelVersions.find((item) => item.id === 'phone-model-v1')
  const v2 = store.data.specModelVersions.filter((item) => item.templateId === 't-phone' && item.id !== 'phone-model-v1')
  const legacyPlan = store.data.planningRecords.find((item) => item.planningId === 'PLN-LEGACY')
  const legacySku = store.data.skus.find((item) => item.id === 's-legacy-phone')
  const correctedLabels = labelsOf(store.data, 't-phone', v2[0]?.nodesSnapshot || [])
  check('G1', 'explicit-new-version', Boolean(staged.ok && snapshotAfterStage === frozenSnapshot && publishedCorrection.ok && JSON.stringify(v1?.nodesSnapshot) === frozenSnapshot && v2.length === 1 && sameSet(correctedLabels, DEFAULT_PHONE) && legacyPlan?.planningId === 'PLN-LEGACY' && legacySku?.id === 's-legacy-phone' && legacySku.planningId === 'PLN-LEGACY' && legacySku.modelVersionId === 'phone-model-v1'), `发布「${publishedCorrection.message}」；旧规划 ${legacyPlan?.status || '丢失'}；新版本 ${v2.map((item) => item.versionName).join(',')}`)

  const categories = boot()
  const typeBefore = JSON.stringify(categories.data.productTypes)
  const categoryBefore = JSON.stringify(categories.data.categories)
  const rejectedType = categories.saveProductType({ id: '', name: '不该挂上的类型', categoryId: 'c-host', description: '', sort: 1, status: 'enabled' })
  const movedType = categories.saveProductType({ id: 'pt-phone', name: '手机', categoryId: 'c-host', description: '', sort: 1, status: 'enabled' })
  const phoneType = categories.data.productTypes.find((item) => item.id === 'pt-phone')
  check('G2', 'reject-non-leaf', rejectedType === NON_LEAF_TYPE_BLOCK && movedType === NON_LEAF_TYPE_BLOCK && phoneType?.categoryId === 'c-phone' && JSON.stringify(categories.data.productTypes) === typeBefore && JSON.stringify(categories.data.categories) === categoryBefore, rejectedType)
  const addedType = categories.saveProductType({ id: '', name: '手表第二类型', categoryId: 'c-watch', description: '', sort: 2, status: 'enabled' })
  const second = categories.saveProductType({ id: '', name: '手机第三类型', categoryId: 'c-phone', description: '', sort: 3, status: 'enabled' })
  check('G2', 'leaf-allows-many', addedType === '' && second === '' && categories.data.productTypes.filter((item) => item.categoryId === 'c-phone').length >= 3, `手表 ${addedType || '已添加'}，手机 ${categories.data.productTypes.filter((item) => item.categoryId === 'c-phone').length} 个类型`)
  const countBeforeChild = categories.data.categories.length
  const child = categories.addCategory('不该成为下级', 'c-watch')
  const move = categories.moveCategory('c-pad', 'c-watch')
  const update = categories.updateCategory('c-film', { name: '保护膜', enabled: true, sort: 1, parentId: 'c-phone' })
  const film = categories.data.categories.find((item) => item.id === 'c-film')
  const drag = categories.relocateCategory('c-pad', 'c-phone', 'inner')
  const pad = categories.data.categories.find((item) => item.id === 'c-pad')
  const copy = categories.copyCategory('c-case')
  check('G2', 'reject-nesting', child.message === TYPED_CATEGORY_CHILD_BLOCK && categories.data.categories.length === countBeforeChild && move === TYPED_CATEGORY_CHILD_BLOCK && update === TYPED_CATEGORY_CHILD_BLOCK && film?.parentId === 'c-protect' && drag === TYPED_CATEGORY_CHILD_BLOCK && pad?.parentId === 'c-host' && copy === TYPED_CATEGORY_CHILD_BLOCK && categories.data.productTypes.some((item) => item.id === 'pt-film' && item.categoryId === 'c-phone-acc'), `新增「${child.message}」；拖拽「${drag}」`)

  const dictionary = boot()
  const brand = dictionary.data.params.find((item) => item.id === 'p-brand')
  const brandValues = brand?.values.join('|')
  const removeBrand = dictionary.removeParam('p-brand')
  const removeApple = dictionary.removeParamValue('p-brand', 'Apple')
  check('G3', 'live-and-published', removeBrand.includes('已发布版本') && removeBrand.includes('不能删除') && removeApple.includes('商品模型的已发布版本') && removeApple.includes('不能删除') && dictionary.data.params.some((item) => item.id === 'p-brand') && dictionary.data.params.find((item) => item.id === 'p-brand')?.values.join('|') === brandValues, removeApple)
  const onlyPublished = JSON.parse(JSON.stringify(dictionary.data)) as AppData
  onlyPublished.productSpecNodes = onlyPublished.productSpecNodes.filter((item) => item.attributeId !== 'p-brand')
  onlyPublished.families.forEach((item) => { delete item.commonAttrs['品牌'] })
  onlyPublished.skus.forEach((item) => { delete item.variantAttrs['品牌']; delete item.projectedAttrs['品牌'] })
  onlyPublished.rules = onlyPublished.rules.filter((item) => item.targetParamId !== 'p-brand' && !item.sourceParamIds.includes('p-brand'))
  onlyPublished.templateParams = onlyPublished.templateParams.filter((item) => item.paramId !== 'p-brand')
  onlyPublished.planningRecords = []
  const onlyMessage = dictionaryRemovalBlock(onlyPublished, 'p-brand', 'Apple')
  const untouched = JSON.stringify(onlyPublished.params)
  check('G3', 'published-only', onlyMessage === '该属性值正在被商品模型的已发布版本使用，不能删除。' && JSON.stringify(onlyPublished.params) === untouched, onlyMessage)
  dictionary.addParamValue('p-color', 'Apple')
  const removedSameWord = dictionary.removeParamValue('p-color', 'Apple')
  check('G3', 'same-word-other-attribute', removedSameWord === '' && dictionary.data.params.find((item) => item.id === 'p-brand')?.values.includes('Apple') === true && dictionary.data.params.find((item) => item.id === 'p-color')?.values.includes('Apple') !== true, removedSameWord || '颜色里的 Apple 已删除，品牌 Apple 还在')
  dictionary.data.params.push({ id: 'p-round1-free', name: '孤立属性', values: ['可删除测试值'], valueGroups: [], participateInStructure: false })
  const removedFree = dictionary.removeParamValue('p-round1-free', '可删除测试值')
  const removedParam = dictionary.removeParam('p-round1-free')
  check('G3', 'unused-can-delete', removedFree === '' && removedParam === '' && !dictionary.data.params.some((item) => item.id === 'p-round1-free'), removedParam || '无引用词典已删除')
  dictionary.data.params.push({ id: 'p-round1-draft', name: '草稿属性', values: ['仅草稿值'], valueGroups: [], participateInStructure: false })
  dictionary.data.productSpecNodes.push({ id: 'sn-draft', templateId: 't-round1-draft', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'p-round1-draft', valueId: '', sort: 1, role: 'VARIANT' }, { id: 'sn-draft-value', templateId: 't-round1-draft', parentId: 'sn-draft', nodeType: 'VALUE', attributeId: 'p-round1-draft', valueId: '仅草稿值', sort: 1 })
  const blockedDraft = dictionary.removeParamValue('p-round1-draft', '仅草稿值')
  const broken = phoneNodes.map((item) => (item.id === 'sn-apple-128-black' ? { ...item, valueId: '缺失色' } : item))
  const publishProblems = specPublishProblems(fresh, broken)
  check('G3', 'draft-and-dangling', blockedDraft.includes('正在编辑的商品模型') && dictionary.data.params.find((item) => item.id === 'p-round1-draft')?.values.includes('仅草稿值') === true && publishProblems.some((item) => item.includes('属性词典')), `${blockedDraft}；${publishProblems.find((item) => item.includes('属性词典')) || '未发现失效引用'}`)

  const materials = boot()
  const publishedMaterial = (await materials.publishSpecModel('t-phone'))
  const plan = materials.data.planningRecords.find((item) => item.productModelId === 't-phone' && item.status === 'active')
  let sequence = 0
  const nextId = (prefix: string) => `${prefix}-${++sequence}`
  const first = plan ? createV3Material(materials.data, { productModelId: 't-phone', modelVersionId: 'phone-model-v1', planningId: plan.planningId, requestId: 'req-1', categoryId: 'c-phone', productTypeId: 'pt-phone', now: '2026-10-16T03:00:00.000Z', nextId }) : { ok: false as const, message: '没有规划' }
  const retry = plan ? createV3Material(materials.data, { productModelId: 't-phone', modelVersionId: 'phone-model-v1', planningId: plan.planningId, requestId: 'req-1', categoryId: 'c-phone', productTypeId: 'pt-phone', now: '2026-10-16T03:01:00.000Z', nextId }) : { ok: false as const, message: '没有规划' }
  const skuCount = materials.data.skus.length
  const removed = first.ok ? materials.removeSku(first.skuId) : '没有物料'
  const receipt = materials.data.materialReceipts.find((item) => item.requestId === 'req-1')
  const countAfterDelete = materials.data.skus.length
  const afterDelete = plan ? createV3Material(materials.data, { productModelId: 't-phone', modelVersionId: 'phone-model-v1', planningId: plan.planningId, requestId: 'req-1', categoryId: 'c-phone', productTypeId: 'pt-phone', now: '2026-10-16T03:02:00.000Z', nextId }) : { ok: false as const, message: '没有规划' }
  const recreated = plan ? createV3Material(materials.data, { productModelId: 't-phone', modelVersionId: 'phone-model-v1', planningId: plan.planningId, requestId: 'req-2', categoryId: 'c-phone', productTypeId: 'pt-phone', now: '2026-10-16T03:03:00.000Z', nextId }) : { ok: false as const, message: '没有规划' }
  check('G4', 'formal-lifecycle', Boolean(publishedMaterial.ok && first.ok && first.created && retry.ok && !retry.created && retry.skuId === first.skuId && removed === '' && receipt?.lifecycle === 'deleted' && receipt.requestId === 'req-1' && !afterDelete.ok && afterDelete.reason === 'material-deleted' && afterDelete.message === MATERIAL_DELETED_MESSAGE && countAfterDelete === skuCount - 1 && materials.data.skus.filter((item) => item.id === first.skuId).length === 0 && recreated.ok && recreated.created && recreated.skuId !== first.skuId && recreated.materialCode !== first.materialCode), `重试 ${retry.ok ? retry.skuId : retry.message}；删除后再请求 ${afterDelete.ok ? afterDelete.skuId : afterDelete.message}；新请求 ${recreated.ok ? `${recreated.skuId}/${recreated.materialCode}` : recreated.message}`)
  const oldReceiptCount = materials.data.materialReceipts.length
  materials.data.materialReceipts.push({ requestId: 'req-old', skuId: 'sku-missing', planningId: plan?.planningId || '', materialCode: 'MAT-OLD', createdTime: '2026-05-01T00:00:00.000Z' })
  const oldRetry = plan ? createV3Material(materials.data, { productModelId: 't-phone', modelVersionId: 'phone-model-v1', planningId: plan.planningId, requestId: 'req-old', categoryId: 'c-phone', productTypeId: 'pt-phone', now: '2026-10-16T03:04:00.000Z', nextId }) : { ok: false as const, message: '没有规划' }
  const oldReceipt = materials.data.materialReceipts.find((item) => item.requestId === 'req-old')
  check('G4', 'legacy-receipt', Boolean(!oldRetry.ok && oldRetry.reason === 'material-deleted' && oldReceipt && oldReceipt.lifecycle === undefined && oldReceipt.materialCode === 'MAT-OLD' && materials.data.materialReceipts.length === oldReceiptCount + 1), oldRetry.ok ? '错误地重建了' : oldRetry.message)
  const blockedSku = recreated.ok ? recreated.skuId : ''
  materials.data.compatibilities.push({ id: 'compat-round1', accessorySkuId: blockedSku, host: { scope: 'model', productTypeId: 'pt-phone', productModelId: 't-phone', identityKey: 'round1', steps: [] }, note: '', createdAt: '2026-10-16T03:05:00.000Z', updatedAt: '2026-10-16T03:05:00.000Z' })
  const blockedDelete = materials.removeSku(blockedSku)
  const blockedReceipt = materials.data.materialReceipts.find((item) => item.skuId === blockedSku)
  check('G4', 'compat-still-blocks', blockedDelete.includes('不能删除') && materials.data.skus.some((item) => item.id === blockedSku) && blockedReceipt?.lifecycle !== 'deleted', blockedDelete)
  const temporary = createTemporaryMaterial(materials.data, { requestId: 'tmp-1', categoryId: 'c-phone', productTypeId: 'pt-phone', productModelId: 't-phone', modelVersionId: 'phone-model-v1', attrs: [{ attributeId: 'p-color', value: '临时紫色', source: 'manual' }], materialCode: 'TMP-ROUND1', now: '2026-10-16T04:00:00.000Z', nextId })
  const temporaryRetry = createTemporaryMaterial(materials.data, { requestId: 'tmp-1', categoryId: 'c-phone', productTypeId: 'pt-phone', productModelId: 't-phone', modelVersionId: 'phone-model-v1', attrs: [{ attributeId: 'p-color', value: '临时紫色', source: 'manual' }], materialCode: 'TMP-ROUND1-B', now: '2026-10-16T04:01:00.000Z', nextId })
  const temporaryRemoved = temporary.ok ? materials.removeSku(temporary.skuId) : '没有临时物料'
  const temporaryAgain = createTemporaryMaterial(materials.data, { requestId: 'tmp-1', categoryId: 'c-phone', productTypeId: 'pt-phone', productModelId: 't-phone', modelVersionId: 'phone-model-v1', attrs: [{ attributeId: 'p-color', value: '临时紫色', source: 'manual' }], materialCode: 'TMP-ROUND1-C', now: '2026-10-16T04:02:00.000Z', nextId })
  const temporaryNew = createTemporaryMaterial(materials.data, { requestId: 'tmp-2', categoryId: 'c-phone', productTypeId: 'pt-phone', productModelId: 't-phone', modelVersionId: 'phone-model-v1', attrs: [{ attributeId: 'p-color', value: '临时紫色', source: 'manual' }], materialCode: 'TMP-ROUND1-D', now: '2026-10-16T04:03:00.000Z', nextId })
  const formalIds = new Set(materials.data.skus.filter((item) => item.planningId?.startsWith('PLN-')).map((item) => item.id))
  check('G4', 'temporary-separate', Boolean(temporary.ok && temporary.created && temporary.planningId.startsWith('TMP-') && temporaryRetry.ok && !temporaryRetry.created && temporaryRetry.skuId === temporary.skuId && temporaryRemoved === '' && !temporaryAgain.ok && temporaryAgain.reason === 'material-deleted' && temporaryNew.ok && temporaryNew.skuId !== temporary.skuId && !formalIds.has(temporaryNew.skuId)), `临时 ${temporary.ok ? temporary.planningId : temporary.message}；删除后 ${temporaryAgain.ok ? '重建了' : temporaryAgain.message}`)

  await nextTick()
  await materials.waitForPersistence()
  materials.$dispose()
  return results
}
