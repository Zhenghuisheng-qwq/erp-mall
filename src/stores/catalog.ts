import { defineStore } from 'pinia'
import { computed, reactive, watch } from 'vue'
import {
  blockChildOfTypedCategory,
  blockTypeOnNonLeaf,
  productTypeCategoryMoveMessage,
  categoryRemovalBlock as blockCategoryRemoval,
  moveCategoryNode,
  planCategoryCopy,
  relocateCategoryNodes,
  shiftCategoryNode,
  updateCategoryNode,
  type DropPosition,
} from '../domain/categoryTree'
import { applyAccessoryCategoryFix, PHONE_CASE_CATEGORY_FIX } from '../domain/categoryFix'
import { dictionaryRemovalBlock } from '../domain/dictionaryGuard'
import { blankVariantAttrs, categoryPath, descendantIds, familySkus, projectAttrs, sameSpecSnapshot, specPublishProblems } from '../domain/logic'
import { reconcilePlanningRecords } from '../domain/planning'
import { compatibilityFamilyBlock, compatibilityModelBlock, compatibilitySkuBlock } from '../domain/compatibility'
import { draftHostRulesDiffer, forgetDraftNodeRules, freezeDraftNodeHosts } from '../domain/nodeCompatibility'
import { scrubSampleDictionary } from '../domain/compatibilitySamples'
import { createTemporaryMaterial, createV3Material, renameV3Product, setPlanningGrades, tombstoneMaterialReceipts, updateV3Material } from '../domain/material'
import type { ProductGrade } from '../domain/types'
import { arrangeSpecPositions } from '../domain/logic'
import { activeProductListView, applyPresetToActiveView, currentModeQuery, ensureProductListViews } from '../domain/productListViews'
import { createSeed, defaultColumns, emptyQuery, phoneCanvas, phoneSpecNodes } from '../domain/seed'
import { DATA_VERSION, STORAGE_KEY, type AppData, type Category, type ColumnPref, type FeedbackItem, type ListQuery, type ListView, type ParamDef, type ProductFamily, type ProductGroup, type ProductType, type Sku, type SpecRule, type UserRole } from '../domain/types'

type ModuleName = 'products' | 'categories' | 'templates' | 'params' | 'rules' | 'groups' | 'system'
type StoredPayload = { version?: number; data?: AppData }

function renameSchemeColumn(columns: ColumnPref[] | undefined, mark: { changed: boolean }) {
  columns?.forEach((column) => {
    if (column.key === 'template' && column.label === '模板') {
      column.label = '属性方案'
      mark.changed = true
    }
  })
}

/** 版本 1 没有分类启用状态。缺省视为启用，并写回版本 2。商品、方案、映射原样保留。 */
export function normalizeStored(parsed: StoredPayload): AppData | null {
  const data = parsed.data
  if (!data?.families || !data.skus || !data.categories || !data.templates || !data.mappings || !data.templateParams) return null
  const version = parsed.version ?? 1
  if (version < 1 || version > DATA_VERSION) return null
  const mark = { changed: version !== DATA_VERSION }
  data.categories = data.categories.map((item) => {
    if (typeof item.enabled === 'boolean') return item
    mark.changed = true
    return { ...item, enabled: true }
  })
  renameSchemeColumn(data.columns, mark)
  data.listViews?.forEach((view) => renameSchemeColumn(view.columns, mark))
  if (!Array.isArray(data.productSpecNodes)) {
    data.productSpecNodes = phoneSpecNodes()
    mark.changed = true
  }
  if (!Array.isArray(data.specCanvases)) {
    data.specCanvases = []
    mark.changed = true
  }
  const templatesWithNodes = new Set(data.productSpecNodes.map((item) => item.templateId))
  templatesWithNodes.forEach((templateId) => {
    if (!data.specCanvases.some((item) => item.templateId === templateId)) {
      data.specCanvases.push({ ...phoneCanvas(), templateId })
      mark.changed = true
    }
  })
  data.specCanvases.forEach((canvas) => {
    if (canvas.direction === 'ltr' || canvas.direction === 'tree' || canvas.direction === 'logic' || canvas.direction === 'custom') return
    arrangeSpecPositions(data.productSpecNodes.filter((item) => item.templateId === canvas.templateId))
    canvas.direction = 'ltr'
    mark.changed = true
  })
  const needsLayout = data.productSpecNodes.some((item) => typeof item.positionX !== 'number' || typeof item.positionY !== 'number')
  if (needsLayout) {
    templatesWithNodes.forEach((templateId) => arrangeSpecPositions(data.productSpecNodes.filter((item) => item.templateId === templateId)))
    mark.changed = true
  }
  data.productSpecNodes.forEach((node) => {
    if (node.nodeType !== 'ATTRIBUTE' || node.role === 'COMMON' || node.role === 'VARIANT') return
    const bound = data.templateParams.find((item) => item.templateId === node.templateId && item.paramId === node.attributeId)
    node.role = bound?.role === 'common' ? 'COMMON' : 'VARIANT'
    mark.changed = true
  })
  if (!Array.isArray(data.specModelVersions)) {
    data.specModelVersions = []
    mark.changed = true
  }
  const versionTemplates = new Set(data.productSpecNodes.map((item) => item.templateId))
  versionTemplates.forEach((templateId) => {
    if (data.specModelVersions.some((item) => item.templateId === templateId)) return
    const canvas = data.specCanvases.find((item) => item.templateId === templateId)
    if (canvas && canvas.status !== 'published') return
    const nodes = data.productSpecNodes.filter((item) => item.templateId === templateId)
    if (!nodes.some((item) => item.nodeType === 'ATTRIBUTE')) return
    const now = canvas?.updatedAt || new Date().toISOString()
    data.specModelVersions.push({
      id: `mv-${templateId}-v1`,
      templateId,
      version: canvas?.version || 1,
      versionName: canvas?.versionName || 'V1',
      status: 'published',
      nodesSnapshot: nodes.map((item) => ({ ...item, namingRule: item.namingRule?.map((part) => ({ ...part })) })),
      createdTime: now,
      publishTime: now,
    })
    mark.changed = true
  })
  data.families.forEach((family) => {
    if (family.modelVersionId) return
    const published = data.specModelVersions
      .filter((item) => item.templateId === family.templateId && item.status === 'published')
      .slice()
      .sort((a, b) => a.version - b.version)
    const latest = published[published.length - 1]
    if (!latest) return
    family.modelVersionId = latest.id
    mark.changed = true
  })
  if (!Array.isArray(data.productTypes)) {
    data.productTypes = []
    mark.changed = true
  }
  data.specCanvases.forEach((canvas) => {
    if (!canvas.name) {
      const template = data.templates.find((item) => item.id === canvas.templateId)
      canvas.name = template?.name || '未命名模型'
      mark.changed = true
    }
  })
  if (!Array.isArray(data.brands)) {
    const names = new Set<string>()
    data.params.find((item) => item.name === '品牌')?.values.forEach((item) => names.add(item))
    data.families.forEach((family) => {
      if (family.commonAttrs['品牌']) names.add(family.commonAttrs['品牌'])
    })
    data.brands = [...names].map((name, index) => ({ id: `brand-${index + 1}`, name, logo: '', description: '', status: 'enabled' as const }))
    mark.changed = true
  }
  data.families.forEach((family) => {
    if (!family.shelfStatus) {
      family.shelfStatus = family.lifecycle === 'ready' ? 'online' : 'draft'
      mark.changed = true
    }
    if (!family.createdAt) {
      family.createdAt = family.updatedAt
      mark.changed = true
    }
  })
  if (!Array.isArray(data.productPlans)) {
    data.productPlans = []
    mark.changed = true
  }
  if (!Array.isArray(data.planningRecords)) {
    data.planningRecords = []
    mark.changed = true
  }
  if (!Array.isArray(data.materialReceipts)) {
    data.materialReceipts = []
    mark.changed = true
  }
  if (!Array.isArray(data.compatibilities)) {
    data.compatibilities = []
    mark.changed = true
  }
  if (!Array.isArray(data.nodeCompatibilityRules)) {
    data.nodeCompatibilityRules = []
    mark.changed = true
  }
  if (scrubSampleDictionary(data)) mark.changed = true
  if (data.listQuery) {
    const defaults = emptyQuery()
    const next = { ...defaults, ...data.listQuery, attrFilters: data.listQuery.attrFilters || {} }
    if (next.createdFrom === undefined || next.shelf === undefined) mark.changed = true
    data.listQuery = next
  }
  if (ensureProductListViews(data)) mark.changed = true
  if (mark.changed && typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: DATA_VERSION, data }))
  }
  return data
}

function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createSeed()
    const parsed = JSON.parse(raw) as StoredPayload
    const data = normalizeStored(parsed) ?? createSeed()
    const fix = applyAccessoryCategoryFix(data, PHONE_CASE_CATEGORY_FIX)
    if (fix.changed && typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: DATA_VERSION, data }))
    }
    return data
  } catch {
    return createSeed()
  }
}

let seq = 1
export function uid(prefix: string) {
  seq += 1
  return `${prefix}-${Date.now().toString(36)}-${seq}`
}

export const useCatalogStore = defineStore('catalog', () => {
  const data = reactive<AppData>(loadData())

  watch(
    data,
    () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: DATA_VERSION, data }))
    },
    { deep: true },
  )

  const isAdmin = computed(() => data.activeRole === 'admin')

  function replaceAll(next: AppData) {
    Object.assign(data, next)
  }

  function resetAll() {
    replaceAll(createSeed())
  }

  function resetModule(name: ModuleName) {
    const fresh = createSeed()
    if (name === 'products') {
      data.families = fresh.families
      data.skus = fresh.skus
    } else if (name === 'categories') {
      data.categories = fresh.categories
      data.mappings = fresh.mappings
      data.productTypes = fresh.productTypes
    } else if (name === 'templates') {
      data.templates = fresh.templates
      data.templateParams = fresh.templateParams
      data.mappings = fresh.mappings
      data.productSpecNodes = fresh.productSpecNodes
      data.specCanvases = fresh.specCanvases
      data.specModelVersions = fresh.specModelVersions
    } else if (name === 'params') {
      data.params = fresh.params
      data.templateParams = fresh.templateParams
    } else if (name === 'rules') {
      data.rules = fresh.rules
    } else if (name === 'groups') {
      data.productGroups = fresh.productGroups
    } else {
      data.users = fresh.users
      data.feedbacks = fresh.feedbacks
      data.profile = fresh.profile
    }
  }

  function exportJson() {
    return JSON.stringify({ version: DATA_VERSION, data }, null, 2)
  }

  function importJson(text: string) {
    const parsed = JSON.parse(text) as StoredPayload
    const next = normalizeStored(parsed)
    if (!next?.params) throw new Error('演示数据版本不匹配，当前数据没有被替换')
    replaceAll(next)
  }

  function skusOf(familyId: string) {
    return familySkus(data, familyId)
  }

  function saveBundle(family: ProductFamily, skus: Sku[]) {
    const nextFamily = { ...family, updatedAt: new Date().toISOString() }
    const nextSkus = skus.map((item) => ({ ...item, familyId: nextFamily.id, projectedAttrs: projectAttrs(nextFamily, item) }))
    const index = data.families.findIndex((item) => item.id === nextFamily.id)
    if (index >= 0) data.families[index] = nextFamily
    else data.families.unshift(nextFamily)
    const others = data.skus.filter((item) => item.familyId !== nextFamily.id)
    data.skus = others.concat(nextSkus)
  }

  function removeFamily(id: string) {
    const blocked = compatibilityFamilyBlock(data, id)
    if (blocked) return blocked
    const removed = data.skus.filter((item) => item.familyId === id)
    data.families = data.families.filter((item) => item.id !== id)
    data.skus = data.skus.filter((item) => item.familyId !== id)
    removed.forEach((item) => tombstoneMaterialReceipts(data, item.id))
    return ''
  }

  function patchSku(id: string, patch: Partial<Sku>) {
    const sku = data.skus.find((item) => item.id === id)
    const family = sku && data.families.find((item) => item.id === sku.familyId)
    if (!sku || !family) return
    Object.assign(sku, patch, { projectedAttrs: projectAttrs(family, { ...sku, ...patch }) })
    family.updatedAt = new Date().toISOString()
  }

  function removeSku(id: string) {
    const blocked = compatibilitySkuBlock(data, id)
    if (blocked) return blocked
    const sku = data.skus.find((item) => item.id === id)
    if (!sku) return ''
    data.skus = data.skus.filter((item) => item.id !== id)
    if (!data.skus.some((item) => item.familyId === sku.familyId)) {
      data.families = data.families.filter((item) => item.id !== sku.familyId)
    }
    tombstoneMaterialReceipts(data, id)
    return ''
  }

  function setSkuStatus(ids: string[], status: Sku['status']) {
    ids.forEach((id) => patchSku(id, { status }))
  }

  function addParamValue(paramId: string, value: string) {
    const param = data.params.find((item) => item.id === paramId)
    const name = value.trim()
    if (!param || !name || param.values.includes(name)) return false
    param.values.push(name)
    return true
  }

  function removeParam(id: string) {
    const message = dictionaryRemovalBlock(data, id)
    if (message) return message
    data.params = data.params.filter((item) => item.id !== id)
    data.templates.forEach((template) => {
      template.structureOrder = template.structureOrder.filter((item) => item !== id)
    })
    return ''
  }

  function removeParamValue(paramId: string, value: string) {
    const message = dictionaryRemovalBlock(data, paramId, value)
    if (message) return message
    const param = data.params.find((item) => item.id === paramId)
    if (!param) return '参数不存在'
    param.values = param.values.filter((item) => item !== value)
    param.valueGroups.forEach((group) => {
      group.values = group.values.filter((item) => item !== value)
    })
    return ''
  }

  function categoryRemovalBlock(id: string) {
    return blockCategoryRemoval(
      data.categories,
      data.families.map((item) => item.categoryId),
      id,
    )
  }

  function removeCategory(id: string) {
    const message = categoryRemovalBlock(id)
    if (message) return message
    if (data.productTypes.some((item) => item.categoryId === id)) return '分类下还有产品类型，不能删除。'
    data.categories = data.categories.filter((item) => item.id !== id)
    data.mappings = data.mappings.filter((item) => item.categoryId !== id)
    return ''
  }

  function productTypesOf(categoryId: string) {
    return data.productTypes.filter((item) => item.categoryId === categoryId).slice().sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'zh'))
  }

  function saveProductType(input: { id: string; name: string; categoryId: string; description: string; sort: number; status: ProductType['status'] }) {
    const name = input.name.trim()
    if (!name) return '请填写产品类型名称。'
    const category = data.categories.find((item) => item.id === input.categoryId)
    if (!category) return '目标分类不存在或已经删除。'
    if (category.enabled === false) return '目标分类已停用，不能关联。'
    const leafBlock = blockTypeOnNonLeaf(data.categories, input.categoryId)
    if (leafBlock) return leafBlock
    const duplicated = data.productTypes.some((item) => item.categoryId === input.categoryId && item.name === name && item.id !== input.id)
    if (duplicated) return '这个分类下已经有同名产品类型。'
    const description = input.description.trim()
    const sort = Number.isFinite(input.sort) ? input.sort : 1
    if (input.id) {
      const row = data.productTypes.find((item) => item.id === input.id)
      if (!row) return '产品类型不存在。'
      const blocked = productTypeCategoryMoveMessage(data, input.id, input.categoryId, categoryPath(data, input.categoryId))
      if (blocked) return blocked
      Object.assign(row, { name, categoryId: input.categoryId, description, sort, status: input.status })
      return ''
    }
    data.productTypes.push({ id: uid('pt'), name, categoryId: input.categoryId, description, sort, status: input.status })
    return ''
  }

  function removeProductType(id: string) {
    const message = productTypeRemovalBlock(id)
    if (message) return message
    data.productTypes = data.productTypes.filter((item) => item.id !== id)
    return ''
  }

  function productTypeRemovalBlock(id: string) {
    if (!data.productTypes.some((item) => item.id === id)) return '产品类型不存在。'
    const modelIds = new Set(data.specCanvases.filter((item) => item.productTypeId === id).map((item) => item.templateId))
    const usedByModel = modelIds.size > 0
    const usedByVersion = data.specModelVersions.some((item) => item.status === 'published' && modelIds.has(item.templateId))
    const usedByPlanning = (data.planningRecords || []).some((item) => modelIds.has(item.productModelId)) || (data.productPlans || []).some((item) => item.productTypeId === id)
    const usedByMaterial = data.families.some((item) => item.productTypeId === id) || data.skus.some((sku) => data.families.some((item) => item.id === sku.familyId && item.productTypeId === id))
    const usedByLink = (data.compatibilities || []).some((item) => item.host.productTypeId === id)
    if (usedByModel || usedByVersion || usedByPlanning || usedByMaterial || usedByLink) return '该产品类型已被商品模型 / 已发布数据引用，不能删除。'
    return ''
  }

  function setProductTypeStatus(id: string, status: ProductType['status']) {
    const row = data.productTypes.find((item) => item.id === id)
    if (row) row.status = status
  }

  function createProductModel(input: { productTypeId: string; name: string }) {
    const productType = data.productTypes.find((item) => item.id === input.productTypeId)
    const name = input.name.trim()
    if (!productType) return { ok: false, message: '请选择产品类型。', templateId: '' }
    if (!name) return { ok: false, message: '请填写模型名称。', templateId: '' }
    const templateId = uid('tpl')
    data.templates.push({ id: templateId, name, parentId: null, enabled: true, structureOrder: [] })
    data.specCanvases.push({
      templateId,
      productTypeId: productType.id,
      name,
      zoom: 1,
      panX: 0,
      panY: 0,
      status: 'draft',
      version: 1,
      versionName: 'V1',
      direction: 'ltr',
      updatedAt: new Date().toISOString(),
    })
    return { ok: true, message: '', templateId }
  }

  function typedCategoryIds() {
    return new Set(data.productTypes.map((item) => item.categoryId))
  }

  function addCategory(name: string, parentId: string | null) {
    const trimmed = name.trim()
    if (!trimmed) return { id: '', message: '请填写分类名称' }
    const blocked = blockChildOfTypedCategory(parentId, typedCategoryIds())
    if (blocked) return { id: '', message: blocked }
    const siblings = data.categories.filter((item) => item.parentId === parentId)
    const id = uid('cat')
    data.categories.push({
      id,
      name: trimmed,
      parentId,
      sort: siblings.reduce((max, item) => Math.max(max, item.sort), 0) + 1,
      enabled: true,
    })
    return { id, message: '' }
  }

  function moveCategory(id: string, parentId: string | null) {
    return moveCategoryNode(data.categories, id, parentId, typedCategoryIds())
  }

  function shiftCategory(id: string, direction: -1 | 1) {
    shiftCategoryNode(data.categories, id, direction)
  }

  function relocateCategory(id: string, targetId: string, position: DropPosition) {
    return relocateCategoryNodes(data.categories, id, targetId, position, typedCategoryIds())
  }

  function updateCategory(id: string, patch: { name: string; enabled: boolean; sort: number; parentId: string | null; icon?: string }) {
    return updateCategoryNode(data.categories, id, patch, typedCategoryIds())
  }

  function copyCategory(id: string) {
    const source = data.categories.find((item) => item.id === id)
    if (!source) return ''
    const blocked = blockChildOfTypedCategory(source.parentId, typedCategoryIds())
    if (blocked) return blocked
    const plan = planCategoryCopy(data.categories, data.mappings, id, () => uid('cat'))
    if (!plan) return ''
    data.categories.push(...plan.categories)
    data.mappings.push(...plan.mappings)
    return plan.rootId
  }

  function setCategoryMapping(categoryId: string, templateId: string) {
    data.mappings = data.mappings.filter((item) => item.categoryId !== categoryId)
    if (!templateId) return ''
    data.mappings.push({ categoryId, templateId })
    return ''
  }

  function removeSpecNode(id: string) {
    const node = data.productSpecNodes.find((item) => item.id === id)
    if (!node) return '节点不存在'
    const ids = [id, ...descendantIds(data.productSpecNodes, id)]
    const nodes = data.productSpecNodes.filter((item) => ids.includes(item.id))
    const families = data.families.filter((item) => item.templateId === node.templateId)
    const familyIds = new Set(families.map((item) => item.id))
    const used = nodes.some((item) => {
      if (item.nodeType !== 'VALUE' || !item.valueId) return false
      const name = data.params.find((param) => param.id === item.attributeId)?.name
      if (!name) return false
      return families.some((family) => family.commonAttrs[name] === item.valueId) || data.skus.some((sku) => familyIds.has(sku.familyId) && sku.variantAttrs[name] === item.valueId)
    })
    if (used) return '这个节点或下级取值已经被商品使用，不能删除。'
    data.productSpecNodes = data.productSpecNodes.filter((item) => !ids.includes(item.id))
    forgetDraftNodeRules(data, ids)
    return ''
  }

  function shiftSpecNode(id: string, direction: -1 | 1) {
    const node = data.productSpecNodes.find((item) => item.id === id)
    if (!node) return
    const siblings = data.productSpecNodes.filter((item) => item.templateId === node.templateId && item.parentId === node.parentId).sort((a, b) => a.sort - b.sort)
    const index = siblings.findIndex((item) => item.id === id)
    const target = siblings[index + direction]
    if (!target) return
    const sort = node.sort
    node.sort = target.sort
    target.sort = sort
  }

  function removeTemplate(id: string) {
    const ids = [id, ...descendantIds(data.templates, id)]
    const blocked = modelRemovalBlock(ids)
    if (blocked) return blocked
    if (data.families.some((family) => ids.includes(family.templateId))) return '方案下还有商品，不能删除。'
    data.templates = data.templates.filter((item) => !ids.includes(item.id))
    data.templateParams = data.templateParams.filter((item) => !ids.includes(item.templateId))
    data.mappings = data.mappings.filter((item) => !ids.includes(item.templateId))
    data.productSpecNodes = data.productSpecNodes.filter((item) => !ids.includes(item.templateId))
    data.specCanvases = data.specCanvases.filter((item) => !ids.includes(item.templateId))
    data.specModelVersions = data.specModelVersions.filter((item) => !ids.includes(item.templateId))
    data.rules = data.rules.filter((item) => !ids.includes(item.templateId))
    return ''
  }

  function modelRemovalBlock(ids: string[]) {
    const versions = data.specModelVersions.filter((item) => ids.includes(item.templateId))
    const versionIds = new Set(versions.map((item) => item.id))
    const plans = (data.planningRecords || []).filter((item) => ids.includes(item.productModelId) || item.modelVersionIds.some((id) => versionIds.has(id)))
    const planIds = new Set(plans.map((item) => item.planningId))
    const materials = data.skus.filter((item) => (item.modelVersionId && versionIds.has(item.modelVersionId)) || (item.planningId && planIds.has(item.planningId)))
    const families = data.families.filter((item) => ids.includes(item.templateId) || ids.includes(item.productModelId || '') || Boolean(item.modelVersionId && versionIds.has(item.modelVersionId)))
    const linked = compatibilityModelBlock(data, ids)
    if (linked) return linked
    if (families.length || materials.length) return `不能删除。已有 ${families.length} 款商品、${materials.length} 条物料还指向这个模型，删掉后就打不开当时的规格。`
    if (plans.length) return `不能删除。还有 ${plans.length} 条规格编号需要这些发布版本才能查看。`
    if (versions.length) return `不能删除。这个模型已有 ${versions.length} 个发布版本，直接删除会丢掉历史快照。`
    return ''
  }

  function removeGroup(id: string) {
    const ids = [id, ...descendantIds(data.productGroups, id)]
    data.productGroups = data.productGroups.filter((item) => !ids.includes(item.id))
    data.families.forEach((family) => {
      family.productGroupIds = family.productGroupIds.filter((item) => !ids.includes(item))
    })
  }

  function saveView(name: string) {
    const current = currentModeQuery(activeProductListView(data))
    const view: ListView = {
      id: uid('view'),
      name,
      query: JSON.parse(JSON.stringify(data.listQuery)) as ListQuery,
      columns: JSON.parse(JSON.stringify(data.columns)) as ColumnPref[],
      keyword: current.keyword,
      viewFilters: JSON.parse(JSON.stringify(current.filters)) as ListView['viewFilters'],
    }
    view.query.keyword = current.keyword
    view.query.page = 1
    data.listViews.push(view)
    data.activeViewId = view.id
  }

  function applyView(id: string) {
    const view = data.listViews.find((item) => item.id === id)
    if (!view) return
    data.activeViewId = id
    data.listQuery = JSON.parse(JSON.stringify(view.query)) as ListQuery
    applyPresetToActiveView(data, view)
  }

  function removeView(id: string) {
    if (id === 'view-all') return
    data.listViews = data.listViews.filter((item) => item.id !== id)
    if (data.activeViewId === id) applyView('view-all')
  }

  function setRole(role: UserRole) {
    data.activeRole = role
  }

  function publishSpecModel(templateId: string): { ok: boolean; message: string } {
    const nodes = data.productSpecNodes.filter((item) => item.templateId === templateId)
    const problems = specPublishProblems(data, nodes)
    if (problems.length) return { ok: false, message: problems[0] }
    const versions = data.specModelVersions.filter((item) => item.templateId === templateId).slice().sort((a, b) => a.version - b.version)
    const latest = versions[versions.length - 1]
    const now = new Date().toISOString()
    let canvas = data.specCanvases.find((item) => item.templateId === templateId)
    if (!canvas) {
      canvas = { templateId, zoom: 1, panX: 0, panY: 0, status: 'draft', version: 1, versionName: 'V1', direction: 'ltr', updatedAt: now }
      data.specCanvases.push(canvas)
    }
    if (latest && latest.status === 'published' && sameSpecSnapshot(latest.nodesSnapshot, nodes) && !draftHostRulesDiffer(data, templateId, latest.id)) {
      canvas.status = 'published'
      canvas.version = latest.version
      canvas.versionName = latest.versionName
      canvas.updatedAt = now
      const outcome = alignPlanning(templateId, latest.id, now)
      if (outcome.created > 0) return { ok: true, message: `当前内容和 ${latest.versionName} 一致，没有生成新版本。已为 ${outcome.created} 条规格组合生成规划编号。` }
      return { ok: false, message: `当前内容和 ${latest.versionName} 一致，没有生成新版本。` }
    }
    const version = (latest?.version || 0) + 1
    const versionName = `V${version}`
    const versionId = uid('mv')
    data.specModelVersions.push({
      id: versionId,
      templateId,
      version,
      versionName,
      status: 'published',
      nodesSnapshot: nodes.map((item) => ({ ...item, namingRule: item.namingRule?.map((part) => ({ ...part })) })),
      createdTime: now,
      publishTime: now,
    })
    freezeDraftNodeHosts(data, templateId, versionId, now, uid)
    canvas.status = 'published'
    canvas.version = version
    canvas.versionName = versionName
    canvas.updatedAt = now
    const outcome = alignPlanning(templateId, versionId, now)
    const retired = outcome.retired ? `，停用 ${outcome.retired} 个不再存在的组合` : ''
    return { ok: true, message: `已发布 ${versionName}。合法组合 ${outcome.created + outcome.reused} 条，新增编号 ${outcome.created} 个，沿用 ${outcome.reused} 个${retired}。已有版本不会被覆盖。` }
  }

  function alignPlanning(templateId: string, versionId: string, now: string) {
    if (!Array.isArray(data.planningRecords)) data.planningRecords = []
    const version = data.specModelVersions.find((item) => item.id === versionId)
    if (!version) return { created: 0, reused: 0, retired: 0 }
    const outcome = reconcilePlanningRecords({
      records: data.planningRecords,
      data,
      productModelId: templateId,
      modelVersionId: version.id,
      nodes: version.nodesSnapshot,
      now,
    })
    data.planningRecords = outcome.records
    return outcome
  }

  function createMaterial(input: { productModelId: string; modelVersionId: string; planningId: string; requestId: string; categoryId: string; productTypeId: string; familyId?: string; skuName?: string; supplierCode?: string; guanjiapoCode?: string; oaSkuId?: string; materialDescription?: string }) {
    return createV3Material(data, { ...input, nextId: uid })
  }

  function createTemporary(input: { requestId: string; categoryId: string; productTypeId: string; productModelId?: string; modelVersionId?: string; attrs: { attributeId: string; value: string; source: 'dictionary' | 'manual' }[]; materialCode: string; skuName?: string; supplierCode?: string; guanjiapoCode?: string; oaSkuId?: string; materialDescription?: string }) {
    return createTemporaryMaterial(data, { ...input, nextId: uid })
  }

  function markPlanningGrades(ids: string[], grade: ProductGrade) {
    const result = setPlanningGrades(data.planningRecords || [], ids, grade)
    data.planningRecords = result.records
    return result.changed
  }

  function updateMaterial(input: { skuId: string; skuName: string; supplierCode: string; guanjiapoCode: string; oaSkuId: string; materialDescription: string }) {
    return updateV3Material(data, input)
  }

  function renameProduct(familyId: string, name: string) {
    return renameV3Product(data, { familyId, name })
  }

  function blankSku(familyId: string, templateId: string): Sku {
    const variants = data.templateParams.filter((item) => item.templateId === templateId && item.role === 'variant')
    const bound = variants.map((item) => ({ ...item, param: data.params.find((param) => param.id === item.paramId)! })).filter((item) => item.param)
    return {
      id: uid('sku'),
      familyId,
      code: '',
      oaSkuId: '',
      status: 'on_sale',
      variantAttrs: blankVariantAttrs(bound),
      projectedAttrs: {},
    }
  }

  return {
    data,
    isAdmin,
    resetAll,
    resetModule,
    exportJson,
    importJson,
    skusOf,
    saveBundle,
    removeFamily,
    patchSku,
    removeSku,
    setSkuStatus,
    addParamValue,
    removeParam,
    removeParamValue,
    categoryRemovalBlock,
    removeCategory,
    productTypesOf,
    saveProductType,
    removeProductType,
    setProductTypeStatus,
    createProductModel,
    addCategory,
    moveCategory,
    shiftCategory,
    relocateCategory,
    updateCategory,
    copyCategory,
    setCategoryMapping,
    removeSpecNode,
    shiftSpecNode,
    removeTemplate,
    publishSpecModel,
    createMaterial,
    createTemporary,
    markPlanningGrades,
    updateMaterial,
    renameProduct,
    removeGroup,
    saveView,
    applyView,
    removeView,
    setRole,
    blankSku,
    defaultColumns,
    emptyQuery,
  }
})

export type { Category, FeedbackItem, ParamDef, ProductFamily, ProductGroup, ProductType, SpecRule }
