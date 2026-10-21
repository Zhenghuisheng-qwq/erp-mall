import { descendantIds } from './logic'
import type { Category, CategoryMapping } from './types'

export type DropPosition = 'before' | 'after' | 'inner'

export interface CategoryRow {
  id: string
  name: string
  enabled: boolean
  depth: number
  parentId: string | null
  hasChildren: boolean
  expanded: boolean
  childCount: number
  icon?: string
}

export function childrenOfParent(categories: Category[], parentId: string | null) {
  return categories
    .filter((item) => item.parentId === parentId)
    .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))
}

export function categoryChain(categories: Category[], id: string) {
  const byId = new Map(categories.map((item) => [item.id, item]))
  const chain: Category[] = []
  const guard = new Set<string>()
  let current = byId.get(id)
  while (current && !guard.has(current.id)) {
    guard.add(current.id)
    chain.unshift(current)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return chain
}

/** 路径只用于辨认。层级来自 id / parentId，不从名称或斜杠反推。 */
export function categoryPathLabel(categories: Category[], id: string) {
  return categoryChain(categories, id).map((item) => item.name).join(' / ')
}

export function highlightParts(name: string, keyword: string) {
  const needle = keyword.trim().toLowerCase()
  if (!needle) return [{ text: name, hit: false }]
  const lower = name.toLowerCase()
  const parts: { text: string; hit: boolean }[] = []
  let start = 0
  let index = lower.indexOf(needle)
  while (index >= 0) {
    if (index > start) parts.push({ text: name.slice(start, index), hit: false })
    parts.push({ text: name.slice(index, index + needle.length), hit: true })
    start = index + needle.length
    index = lower.indexOf(needle, start)
  }
  if (start < name.length) parts.push({ text: name.slice(start), hit: false })
  if (!parts.length) parts.push({ text: name, hit: false })
  return parts
}

/**
 * 只用于展示。父级缺失、指向自己或成环时，把节点安放到可见根上。
 * 不改分类记录上的 parentId。
 */
export function categoryDisplayParents(categories: { id: string; parentId: string | null }[]) {
  const ids = new Set(categories.map((item) => item.id))
  const parentOf = new Map<string, string | null>()
  categories.forEach((item) => {
    const parent = item.parentId && item.parentId !== item.id && ids.has(item.parentId) ? item.parentId : null
    parentOf.set(item.id, parent)
  })
  categories.forEach((item) => {
    const seen = new Set<string>()
    let current: string | null = item.id
    while (current) {
      if (seen.has(current)) {
        parentOf.set(current, null)
        break
      }
      seen.add(current)
      current = parentOf.get(current) || null
    }
  })
  return parentOf
}

/** 产品类型列表的分类范围。只决定查哪些分类，不改类型归属。 */
export type ProductTypeScope = 'current' | 'with-children'

export function categoryScopeIds(
  categories: { id: string; parentId: string | null }[],
  categoryId: string,
  scope: ProductTypeScope,
) {
  if (!categoryId || !categories.some((item) => item.id === categoryId)) return []
  if (scope === 'current') return [categoryId]
  return [categoryId, ...descendantIds(categories, categoryId)]
}

/**
 * 按分类范围取出产品类型。
 * 同一类型 ID 只保留一行，并收齐范围内真实挂上的分类。
 * 同名不同类型不合并。
 */
export function productTypesInScope<T extends { id: string; categoryId: string; sort: number; name: string }>(
  types: readonly T[],
  categories: { id: string; parentId: string | null }[],
  categoryId: string,
  scope: ProductTypeScope,
) {
  const allowed = new Set(categoryScopeIds(categories, categoryId, scope))
  if (!allowed.size) return []
  const order: string[] = []
  const grouped = new Map<string, { type: T; categoryIds: string[] }>()
  const matched = types
    .filter((item) => item.categoryId && allowed.has(item.categoryId))
    .slice()
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'zh') || a.id.localeCompare(b.id))
  matched.forEach((item) => {
    const found = grouped.get(item.id)
    if (!found) {
      grouped.set(item.id, { type: item, categoryIds: [item.categoryId] })
      order.push(item.id)
      return
    }
    if (!found.categoryIds.includes(item.categoryId)) found.categoryIds.push(item.categoryId)
  })
  return order.map((id) => grouped.get(id)).filter((item): item is { type: T; categoryIds: string[] } => Boolean(item))
}

/** 只列出已展开节点。搜索时自动带上命中节点的上级路径，并展开这条路径。 */
export function visibleCategoryRows(
  categories: Category[],
  expandedIds: ReadonlySet<string>,
  keyword: string,
  closedIds: ReadonlySet<string> = new Set(),
): CategoryRow[] {
  const displayParent = categoryDisplayParents(categories)
  const byParent = new Map<string | null, Category[]>()
  categories.forEach((item) => {
    const parentId = displayParent.get(item.id) ?? null
    const list = byParent.get(parentId) || []
    list.push(item)
    byParent.set(parentId, list)
  })
  byParent.forEach((list) => list.sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id)))

  const kw = keyword.trim().toLowerCase()
  const visibleIds = new Set<string>()
  const forceOpen = new Set<string>()
  if (kw) {
    categories.forEach((item) => {
      if (!item.name.toLowerCase().includes(kw)) return
      const chain = categoryChain(categories, item.id)
      chain.forEach((node) => visibleIds.add(node.id))
      chain.slice(0, -1).forEach((node) => forceOpen.add(node.id))
    })
  }

  const rows: CategoryRow[] = []
  const walk = (parentId: string | null, depth: number) => {
    for (const item of byParent.get(parentId) || []) {
      if (kw && !visibleIds.has(item.id)) continue
      const kids = byParent.get(item.id) || []
      const expanded = kids.length > 0 && (forceOpen.has(item.id) || (!closedIds.has(item.id) && expandedIds.has(item.id)))
      rows.push({
        id: item.id,
        name: item.name,
        enabled: item.enabled !== false,
        depth,
        parentId: item.parentId,
        hasChildren: kids.length > 0,
        expanded,
        childCount: kids.length,
        icon: item.icon,
      })
      if (expanded) walk(item.id, depth + 1)
    }
  }
  walk(null, 0)
  return rows
}

export function branchIds(categories: Category[]) {
  const parents = new Set(categories.map((item) => item.parentId).filter((id): id is string => Boolean(id)))
  return categories.filter((item) => parents.has(item.id)).map((item) => item.id)
}

export function subtreeCounts(categories: { id: string; parentId: string | null }[], rows: { categoryId: string }[]) {
  const children = new Map<string, string[]>()
  categories.forEach((item) => {
    if (!item.parentId) return
    const list = children.get(item.parentId) || []
    list.push(item.id)
    children.set(item.parentId, list)
  })
  const direct = new Map<string, number>()
  rows.forEach((row) => {
    if (!row.categoryId) return
    direct.set(row.categoryId, (direct.get(row.categoryId) || 0) + 1)
  })
  const memo = new Map<string, number>()
  const walk = (id: string, stack: Set<string>): number => {
    if (stack.has(id)) return 0
    const cached = memo.get(id)
    if (cached !== undefined) return cached
    stack.add(id)
    let total = direct.get(id) || 0
    for (const child of children.get(id) || []) total += walk(child, stack)
    stack.delete(id)
    memo.set(id, total)
    return total
  }
  categories.forEach((item) => walk(item.id, new Set()))
  return memo
}

export function categoryRemovalBlock(categories: { id: string; parentId: string | null }[], familyCategoryIds: string[], id: string) {
  if (categories.some((item) => item.parentId === id)) return '请先删除子分类。'
  if (familyCategoryIds.includes(id)) return '分类下还有商品，不能删除。'
  return ''
}

function clearDerived(category: Category) {
  delete category.level
  delete category.path
}

export function resequence(categories: Category[], parentId: string | null) {
  childrenOfParent(categories, parentId).forEach((item, index) => {
    item.sort = index + 1
  })
}

export function relocateBlockMessage(categories: Category[], id: string, targetId: string, position: DropPosition) {
  if (id === targetId) return '不能移动到自己下面'
  const category = categories.find((item) => item.id === id)
  const target = categories.find((item) => item.id === targetId)
  if (!category || !target) return '分类不存在'
  const descendants = new Set(descendantIds(categories, id))
  if (descendants.has(targetId)) return '不能移动到自己的子分类下面'
  const nextParentId = position === 'inner' ? targetId : target.parentId
  if (nextParentId === id || (nextParentId && descendants.has(nextParentId))) return '不能移动到自己的子分类下面'
  return ''
}

export const TYPED_CATEGORY_CHILD_BLOCK = '当前分类已经关联产品类型，不能直接新增子分类。请先处理产品类型关联。'
export const NON_LEAF_TYPE_BLOCK = '只有末级分类可以关联产品类型。'

export function blockChildOfTypedCategory(parentId: string | null, typedCategoryIds: ReadonlySet<string>) {
  if (parentId && typedCategoryIds.has(parentId)) return TYPED_CATEGORY_CHILD_BLOCK
  return ''
}

export function blockTypeOnNonLeaf(categories: Category[], categoryId: string) {
  if (categories.some((item) => item.parentId === categoryId)) return NON_LEAF_TYPE_BLOCK
  return ''
}

/** 产品类型改挂分类。只读检查，不改任何记录。有历史引用时拒绝，避免商品仍停在旧分类。 */
export function productTypeCategoryMoveMessage(data: {
  categories: Category[]
  productTypes: { id: string; categoryId: string }[]
  specCanvases: { templateId: string; productTypeId?: string }[]
  specModelVersions: { templateId: string; status: string }[]
  planningRecords?: { productModelId: string }[]
  productPlans?: { productTypeId: string }[]
  families: { id: string; productTypeId?: string }[]
  skus: { id: string; familyId: string }[]
  compatibilities?: { accessorySkuId: string; host: { productTypeId: string } }[]
}, productTypeId: string, nextCategoryId: string, categoryLabel = '') {
  const type = data.productTypes.find((item) => item.id === productTypeId)
  if (!type) return '产品类型不存在。'
  if (type.categoryId === nextCategoryId) return ''
  const next = data.categories.find((item) => item.id === nextCategoryId)
  if (!next) return '目标分类不存在或已经删除。'
  if (next.enabled === false) return '目标分类已停用，不能关联。'
  const leaf = blockTypeOnNonLeaf(data.categories, nextCategoryId)
  if (leaf) return leaf
  const modelIds = new Set(data.specCanvases.filter((item) => item.productTypeId === productTypeId).map((item) => item.templateId))
  const published = data.specModelVersions.filter((item) => item.status === 'published' && modelIds.has(item.templateId)).length
  const planning = (data.planningRecords || []).filter((item) => modelIds.has(item.productModelId)).length + (data.productPlans || []).filter((item) => item.productTypeId === productTypeId).length
  const families = data.families.filter((item) => item.productTypeId === productTypeId)
  const familyIds = new Set(families.map((item) => item.id))
  const materials = data.skus.filter((item) => familyIds.has(item.familyId)).length
  const links = (data.compatibilities || []).filter((item) => item.host.productTypeId === productTypeId || data.skus.some((sku) => familyIds.has(sku.familyId) && sku.id === item.accessorySkuId)).length
  if (!modelIds.size && !published && !planning && !families.length && !materials && !links) return ''
  const where = categoryLabel || next.name
  return `不能改到「${where}」。已有 ${modelIds.size} 个商品模型、${published} 个已发布版本、${planning} 条规划、${families.length} 款商品、${materials} 条物料、${links} 条适用关系。这些记录仍使用原来的分类。本次不会改写发布快照、规划编号和物料编码。`
}

export function relocateCategoryNodes(categories: Category[], id: string, targetId: string, position: DropPosition, typedCategoryIds: ReadonlySet<string> = new Set()) {
  const message = relocateBlockMessage(categories, id, targetId, position)
  if (message) return message
  const category = categories.find((item) => item.id === id)
  const target = categories.find((item) => item.id === targetId)
  if (!category || !target) return '分类不存在'
  const nextParentId = position === 'inner' ? targetId : target.parentId
  if ((category.parentId || null) !== (nextParentId || null)) {
    const blocked = blockChildOfTypedCategory(nextParentId, typedCategoryIds)
    if (blocked) return blocked
  }
  const oldParentId = category.parentId
  category.parentId = nextParentId
  clearDerived(category)
  const siblings = categories.filter((item) => item.parentId === nextParentId && item.id !== id).sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))
  if (position === 'inner') siblings.push(category)
  else {
    const index = siblings.findIndex((item) => item.id === targetId)
    siblings.splice(Math.max(0, position === 'before' ? index : index + 1), 0, category)
  }
  siblings.forEach((item, index) => {
    item.sort = index + 1
  })
  if (oldParentId !== nextParentId) resequence(categories, oldParentId)
  return ''
}

export function moveCategoryNode(categories: Category[], id: string, parentId: string | null, typedCategoryIds: ReadonlySet<string> = new Set()) {
  if (id === parentId) return '不能移动到自己下面'
  if (parentId && descendantIds(categories, id).includes(parentId)) return '不能移动到自己的子分类下面'
  const category = categories.find((item) => item.id === id)
  if (!category) return '分类不存在'
  if (parentId && !categories.some((item) => item.id === parentId)) return '父分类不存在'
  if (category.parentId === parentId) return ''
  const blocked = blockChildOfTypedCategory(parentId, typedCategoryIds)
  if (blocked) return blocked
  const oldParentId = category.parentId
  category.parentId = parentId
  clearDerived(category)
  const maxSort = categories.filter((item) => item.parentId === parentId && item.id !== id).reduce((max, item) => Math.max(max, item.sort), 0)
  category.sort = maxSort + 1
  resequence(categories, oldParentId)
  resequence(categories, parentId)
  return ''
}

export function shiftCategoryNode(categories: Category[], id: string, direction: -1 | 1) {
  const category = categories.find((item) => item.id === id)
  if (!category) return
  const siblings = childrenOfParent(categories, category.parentId)
  const index = siblings.findIndex((item) => item.id === id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= siblings.length) return
  const [item] = siblings.splice(index, 1)
  if (!item) return
  siblings.splice(target, 0, item)
  siblings.forEach((row, rowIndex) => {
    row.sort = rowIndex + 1
  })
}

export function updateCategoryNode(
  categories: Category[],
  id: string,
  patch: { name: string; enabled: boolean; sort: number; parentId: string | null; icon?: string },
  typedCategoryIds: ReadonlySet<string> = new Set(),
) {
  const category = categories.find((item) => item.id === id)
  if (!category) return '分类不存在'
  const name = patch.name.trim()
  if (!name) return '请填写分类名称'
  if ((patch.parentId || null) !== (category.parentId || null)) {
    const message = moveCategoryNode(categories, id, patch.parentId, typedCategoryIds)
    if (message) return message
  }
  category.name = name
  category.enabled = patch.enabled
  const icon = patch.icon?.trim() || ''
  if (icon) category.icon = icon.slice(0, 8)
  else delete category.icon
  const siblings = childrenOfParent(categories, category.parentId).filter((item) => item.id !== id)
  const index = Math.max(0, Math.min(siblings.length, (Number.isFinite(patch.sort) ? Math.round(patch.sort) : siblings.length + 1) - 1))
  siblings.splice(index, 0, category)
  siblings.forEach((item, rowIndex) => {
    item.sort = rowIndex + 1
  })
  return ''
}

function copyName(names: Set<string>, base: string) {
  let name = `${base}(复制)`
  let index = 2
  while (names.has(name)) {
    name = `${base}(复制${index})`
    index += 1
  }
  return name
}

/** 复制名称和子分类，并复制属性方案绑定。不复制商品。 */
export function planCategoryCopy(categories: Category[], mappings: CategoryMapping[], id: string, nextId: () => string) {
  const source = categories.find((item) => item.id === id)
  if (!source) return null
  const ids = [id, ...descendantIds(categories, id)]
  const idMap = new Map<string, string>()
  ids.forEach((oldId) => idMap.set(oldId, nextId()))
  const siblingNames = new Set(categories.filter((item) => item.parentId === source.parentId).map((item) => item.name))
  const maxSort = categories.filter((item) => item.parentId === source.parentId).reduce((max, item) => Math.max(max, item.sort), 0)
  const clones: Category[] = ids.map((oldId) => {
    const node = categories.find((item) => item.id === oldId)!
    const isRoot = oldId === id
    const clone: Category = {
      id: idMap.get(oldId)!,
      name: isRoot ? copyName(siblingNames, source.name) : node.name,
      parentId: isRoot ? source.parentId : node.parentId ? idMap.get(node.parentId) || null : null,
      sort: isRoot ? maxSort + 1 : node.sort,
      enabled: node.enabled !== false,
    }
    if (node.icon) clone.icon = node.icon
    return clone
  })
  const mappingClones = mappings.filter((item) => idMap.has(item.categoryId)).map((item) => ({ categoryId: idMap.get(item.categoryId)!, templateId: item.templateId }))
  return { categories: clones, mappings: mappingClones, rootId: idMap.get(id)! }
}
