import { defineStore } from 'pinia'
import { computed, reactive, watch } from 'vue'
import {
  categoryRemovalBlock as blockCategoryRemoval,
  moveCategoryNode,
  planCategoryCopy,
  relocateCategoryNodes,
  shiftCategoryNode,
  updateCategoryNode,
  type DropPosition,
} from '../domain/categoryTree'
import { blankVariantAttrs, descendantIds, familySkus, projectAttrs, sameSpecSnapshot, specPublishProblems } from '../domain/logic'
import { arrangeSpecPositions } from '../domain/logic'
import { createSeed, defaultColumns, emptyQuery, phoneCanvas, phoneSpecNodes } from '../domain/seed'
import { DATA_VERSION, STORAGE_KEY, type AppData, type Category, type ColumnPref, type FeedbackItem, type ListQuery, type ListView, type ParamDef, type ProductFamily, type ProductGroup, type Sku, type SpecRule, type UserRole } from '../domain/types'

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
    if (canvas.direction === 'ltr') return
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
      nodesSnapshot: nodes.map((item) => ({ ...item })),
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
  if (data.listQuery) {
    const defaults = emptyQuery()
    const next = { ...defaults, ...data.listQuery, attrFilters: data.listQuery.attrFilters || {} }
    if (next.createdFrom === undefined || next.shelf === undefined) mark.changed = true
    data.listQuery = next
  }
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
    return normalizeStored(parsed) ?? createSeed()
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
    data.families = data.families.filter((item) => item.id !== id)
    data.skus = data.skus.filter((item) => item.familyId !== id)
  }

  function patchSku(id: string, patch: Partial<Sku>) {
    const sku = data.skus.find((item) => item.id === id)
    const family = sku && data.families.find((item) => item.id === sku.familyId)
    if (!sku || !family) return
    Object.assign(sku, patch, { projectedAttrs: projectAttrs(family, { ...sku, ...patch }) })
    family.updatedAt = new Date().toISOString()
  }

  function removeSku(id: string) {
    const sku = data.skus.find((item) => item.id === id)
    if (!sku) return
    data.skus = data.skus.filter((item) => item.id !== id)
    if (!data.skus.some((item) => item.familyId === sku.familyId)) {
      data.families = data.families.filter((item) => item.id !== sku.familyId)
    }
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
    const param = data.params.find((item) => item.id === id)
    if (!param) return '参数不存在'
    const usedTemplate = data.templateParams.some((item) => item.paramId === id)
    const usedRule = data.rules.some((rule) => !rule.legacy && (rule.targetParamId === id || rule.sourceParamIds.includes(id)))
    const usedProduct = data.families.some((family) => family.commonAttrs[param.name]) || data.skus.some((sku) => sku.variantAttrs[param.name])
    if (usedTemplate || usedRule || usedProduct) return '这个属性还被属性方案、规则或商品使用，不能删除。'
    data.params = data.params.filter((item) => item.id !== id)
    data.templates.forEach((template) => {
      template.structureOrder = template.structureOrder.filter((item) => item !== id)
    })
    return ''
  }

  function removeParamValue(paramId: string, value: string) {
    const param = data.params.find((item) => item.id === paramId)
    if (!param) return '参数不存在'
    const used =
      data.families.some((family) => family.commonAttrs[param.name] === value) ||
      data.skus.some((sku) => sku.variantAttrs[param.name] === value) ||
      data.rules.some((rule) => !rule.legacy && (Object.values(rule.conditions).includes(value) || rule.options.includes(value)))
    if (used) return '这个取值还被商品或规则使用，不能删除。'
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
    data.categories = data.categories.filter((item) => item.id !== id)
    data.mappings = data.mappings.filter((item) => item.categoryId !== id)
    return ''
  }

  function moveCategory(id: string, parentId: string | null) {
    return moveCategoryNode(data.categories, id, parentId)
  }

  function shiftCategory(id: string, direction: -1 | 1) {
    shiftCategoryNode(data.categories, id, direction)
  }

  function relocateCategory(id: string, targetId: string, position: DropPosition) {
    return relocateCategoryNodes(data.categories, id, targetId, position)
  }

  function updateCategory(id: string, patch: { name: string; enabled: boolean; sort: number; parentId: string | null; icon?: string }) {
    return updateCategoryNode(data.categories, id, patch)
  }

  function copyCategory(id: string) {
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

  function removeGroup(id: string) {
    const ids = [id, ...descendantIds(data.productGroups, id)]
    data.productGroups = data.productGroups.filter((item) => !ids.includes(item.id))
    data.families.forEach((family) => {
      family.productGroupIds = family.productGroupIds.filter((item) => !ids.includes(item))
    })
  }

  function saveView(name: string) {
    const view: ListView = {
      id: uid('view'),
      name,
      query: JSON.parse(JSON.stringify(data.listQuery)) as ListQuery,
      columns: JSON.parse(JSON.stringify(data.columns)) as ColumnPref[],
    }
    data.listViews.push(view)
    data.activeViewId = view.id
  }

  function applyView(id: string) {
    const view = data.listViews.find((item) => item.id === id)
    if (!view) return
    data.activeViewId = id
    data.listQuery = JSON.parse(JSON.stringify(view.query)) as ListQuery
    data.columns = JSON.parse(JSON.stringify(view.columns)) as ColumnPref[]
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
    if (latest && latest.status === 'published' && sameSpecSnapshot(latest.nodesSnapshot, nodes)) {
      canvas.status = 'published'
      canvas.version = latest.version
      canvas.versionName = latest.versionName
      canvas.updatedAt = now
      return { ok: false, message: `当前内容和 ${latest.versionName} 一致，没有生成新版本。` }
    }
    const version = (latest?.version || 0) + 1
    const versionName = `V${version}`
    data.specModelVersions.push({
      id: uid('mv'),
      templateId,
      version,
      versionName,
      status: 'published',
      nodesSnapshot: nodes.map((item) => ({ ...item })),
      createdTime: now,
      publishTime: now,
    })
    canvas.status = 'published'
    canvas.version = version
    canvas.versionName = versionName
    canvas.updatedAt = now
    return { ok: true, message: `已发布 ${versionName}。新建商品读取这一版，已有版本不会被覆盖。` }
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

export type { Category, FeedbackItem, ParamDef, ProductFamily, ProductGroup, SpecRule }
