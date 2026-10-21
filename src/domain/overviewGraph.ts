import { categoryChain } from './categoryTree'
import { categoryPath, latestPublishedVersion, modelVersionsOf, specCanvasOf, specNodeSize, SPEC_LINK_GAP, SPEC_TREE_GAP, SPEC_TREE_ORIGIN_Y } from './logic'
import type { AppData, ProductSpecNode } from './types'

/** 关系图只读。分类、类型、模型、规格节点沿已有 id 关联，不按名称猜测。 */
export type OverviewKind = 'category' | 'type' | 'model' | 'attribute' | 'value'
export type OverviewModelSource = 'snapshot' | 'draft' | 'offline'

export const OVERVIEW_ORIGIN_X = 28
export const OVERVIEW_MIN_ZOOM = 0.65
export const OVERVIEW_MAX_ZOOM = 1.6

const CATEGORY_GAP = 28
const MODEL_GAP = 48

export interface OverviewGraphNode {
  id: string
  parentId: string | null
  kind: OverviewKind
  sort: number
  label: string
  meta: string
  entityId: string
  categoryId: string
  typeId: string
  templateId: string
  nodeId: string
  draft: boolean
  source: OverviewModelSource | ''
  childCount: number
  expandable: boolean
  head: boolean
  bound: boolean
}

export interface OverviewFrame {
  x: number
  y: number
  width: number
  height: number
  top: number
  bottom: number
}

export interface OverviewModelRead {
  nodes: ProductSpecNode[]
  source: OverviewModelSource
  draft: boolean
  statusText: string
}

interface LayoutInput {
  id: string
  parentId: string | null
  kind: OverviewKind
  sort: number
  label: string
  meta: string
}

function textWidth(label: string) {
  let width = 0
  for (const char of label) width += char.charCodeAt(0) > 255 ? 16 : 9
  return width
}

/** 宽度按文字估算，高度沿用单模型节点：属性 42、取值 34、模型 48。 */
export function overviewNodeSize(kind: OverviewKind, label: string, meta = '') {
  if (kind === 'value') {
    const base = specNodeSize('VALUE', label)
    return { width: Math.min(260, base.width + 40), height: base.height }
  }
  if (kind === 'attribute') {
    const base = specNodeSize('ATTRIBUTE', label)
    return { width: Math.min(280, base.width + 40), height: base.height }
  }
  const text = textWidth(label)
  if (kind === 'model') return { width: Math.min(440, Math.max(220, text + textWidth(meta) + 148)), height: 48 }
  if (kind === 'type') return { width: Math.min(260, Math.max(136, text + 72)), height: 42 }
  return { width: Math.min(260, Math.max(148, text + 72)), height: 42 }
}

function siblingGap(parent: LayoutInput | undefined) {
  if (!parent) return 24
  if (parent.kind === 'category') return CATEGORY_GAP
  if (parent.kind === 'type') return MODEL_GAP
  return SPEC_TREE_GAP
}

function layoutChildren(nodes: LayoutInput[], parentId: string | null) {
  return nodes.filter((item) => item.parentId === parentId).sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))
}

function nodeSize(node: LayoutInput) {
  return overviewNodeSize(node.kind, node.label, node.kind === 'model' ? node.meta : '')
}

function subtreeSpan(nodes: LayoutInput[], id: string, stack = new Set<string>()): number {
  if (stack.has(id)) return 0
  stack.add(id)
  const node = nodes.find((item) => item.id === id)
  const self = nodeSize(node || { id, parentId: null, kind: 'attribute', sort: 0, label: '', meta: '' }).height
  const children = layoutChildren(nodes, id)
  if (!children.length) {
    stack.delete(id)
    return self
  }
  const gap = siblingGap(node)
  const inner = children.reduce((sum, child, index) => sum + subtreeSpan(nodes, child.id, stack) + (index ? gap : 0), 0)
  stack.delete(id)
  return Math.max(self, inner)
}

function columnOffsets(nodes: LayoutInput[], originX: number) {
  const widths: number[] = []
  const visit = (parentId: string | null, depth: number, stack = new Set<string>()) => {
    layoutChildren(nodes, parentId).forEach((node) => {
      if (stack.has(node.id)) return
      stack.add(node.id)
      widths[depth] = Math.max(widths[depth] || 0, nodeSize(node).width)
      visit(node.id, depth + 1, stack)
      stack.delete(node.id)
    })
  }
  visit(null, 0)
  const offsets: number[] = []
  let cursor = originX
  widths.forEach((width, depth) => {
    offsets[depth] = cursor
    cursor += width + SPEC_LINK_GAP
  })
  return offsets
}

/**
 * 只读适配层。父子带子、同层列宽和连线空隙沿用单模型树算法，
 * 另外按分类、类型、模型加大纵向间隔，避免不同模型的内部结构叠在一起。
 */
export function layoutOverviewGraph(nodes: LayoutInput[], originX = OVERVIEW_ORIGIN_X) {
  const frames = new Map<string, OverviewFrame>()
  const columns = columnOffsets(nodes, originX)
  const place = (parentId: string | null, depth: number, top: number, stack = new Set<string>()) => {
    let cursor = top
    const parent = parentId ? nodes.find((item) => item.id === parentId) : undefined
    const gap = siblingGap(parent)
    layoutChildren(nodes, parentId).forEach((node, index) => {
      if (stack.has(node.id)) return
      stack.add(node.id)
      if (index) cursor += gap
      const block = subtreeSpan(nodes, node.id)
      const self = nodeSize(node)
      const y = Math.round(cursor + block / 2 - self.height / 2)
      frames.set(node.id, { x: columns[depth] ?? originX, y, width: self.width, height: self.height, top: cursor, bottom: cursor + block })
      place(node.id, depth + 1, cursor, stack)
      stack.delete(node.id)
      cursor += block
    })
  }
  place(null, 0, SPEC_TREE_ORIGIN_Y)
  return frames
}

export function overviewLayoutIssues(nodes: LayoutInput[], originX = OVERVIEW_ORIGIN_X) {
  const frames = layoutOverviewGraph(nodes, originX)
  const missing = nodes.filter((node) => !frames.has(node.id)).map((node) => node.id)
  const overlap: string[] = []
  const entries = [...frames.entries()]
  entries.forEach(([leftId, left], index) => {
    entries.slice(index + 1).forEach(([rightId, right]) => {
      const separated = left.x + left.width <= right.x || right.x + right.width <= left.x || left.y + left.height <= right.y || right.y + right.height <= left.y
      if (!separated) overlap.push(`${leftId}/${rightId}`)
    })
  })
  const crossings: string[] = []
  const parents = new Set<string | null>([null])
  nodes.forEach((node) => parents.add(node.parentId))
  parents.forEach((parentId) => {
    const parent = parentId ? nodes.find((item) => item.id === parentId) : undefined
    const gap = siblingGap(parent)
    const kids = layoutChildren(nodes, parentId)
    for (let index = 1; index < kids.length; index += 1) {
      const previous = frames.get(kids[index - 1].id)
      const next = frames.get(kids[index].id)
      if (!previous || !next) continue
      if (previous.bottom + gap > next.top + 0.01) crossings.push(`${kids[index - 1].id}/${kids[index].id}`)
    }
  })
  const walk = (id: string) => {
    const band = frames.get(id)
    if (!band) return
    layoutChildren(nodes, id).forEach((child) => {
      const childBand = frames.get(child.id)
      if (!childBand) return
      if (childBand.top < band.top - 0.01 || childBand.bottom > band.bottom + 0.01) crossings.push(`out:${child.id}`)
      if (childBand.x < band.x + band.width + SPEC_LINK_GAP - 0.01) crossings.push(`x:${child.id}`)
      walk(child.id)
    })
  }
  layoutChildren(nodes, null).forEach((node) => walk(node.id))
  return { frames, missing, overlap, crossings }
}

export function overviewFitViewport(
  bounds: { minX: number; minY: number; width: number; height: number },
  size: { width: number; height: number },
) {
  const pad = 48
  const fit = Math.min((size.width - pad * 2) / bounds.width, (size.height - pad * 2) / bounds.height)
  const zoom = !Number.isFinite(fit) || fit <= 0 ? 1 : Math.min(1, Math.max(OVERVIEW_MIN_ZOOM, fit))
  const fitsW = bounds.width * zoom + pad * 2 <= size.width
  const fitsH = bounds.height * zoom + pad * 2 <= size.height
  const x = fitsW ? (size.width - bounds.width * zoom) / 2 - bounds.minX * zoom : pad - bounds.minX * zoom
  const y = fitsH ? (size.height - bounds.height * zoom) / 2 - bounds.minY * zoom : pad - bounds.minY * zoom
  return { x, y, zoom }
}

/** 没有指定起点时，用排序第一的根分类。不拿名称去对产品类型或模型。 */
export function defaultOverviewCategoryId(data: AppData, preferred = '') {
  if (preferred && data.categories.some((item) => item.id === preferred)) return preferred
  const roots = data.categories.filter((item) => !item.parentId).sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))
  return roots[0]?.id || ''
}

export function overviewRootId(data: AppData, categoryId: string) {
  if (!categoryId || !data.categories.some((item) => item.id === categoryId)) return defaultOverviewCategoryId(data)
  return categoryChain(data.categories, categoryId)[0]?.id || categoryId
}

export function categoryVisualId(categoryId: string) {
  return `category:${categoryId}`
}

export function typeVisualId(categoryId: string, typeId: string) {
  return `type:${categoryId}:${typeId}`
}

export function modelVisualId(categoryId: string, typeId: string, templateId: string) {
  return `model:${categoryId}:${typeId}:${templateId}`
}

export function specVisualId(categoryId: string, typeId: string, templateId: string, nodeId: string) {
  return `spec:${categoryId}:${typeId}:${templateId}:${nodeId}`
}

/** 已发布读最近快照。只有明确选择草稿时才读正在编辑的节点。不下写任何一份数据。 */
export function readOverviewModel(data: AppData, templateId: string, prefer: 'auto' | 'draft' = 'auto'): OverviewModelRead {
  const canvas = specCanvasOf(data, templateId)
  const status = canvas?.status || 'draft'
  const versions = modelVersionsOf(data, templateId)
  const published = versions.filter((item) => item.status === 'published')
  const latest = published[published.length - 1]
  const live = () => data.productSpecNodes.filter((item) => item.templateId === templateId).map((item) => ({ ...item }))
  if (prefer === 'draft') {
    return {
      nodes: live(),
      source: 'draft',
      draft: true,
      statusText: latest ? `草稿 · 快照 ${latest.versionName}` : '草稿',
    }
  }
  if (status === 'offline') {
    const version = [...versions].reverse().find((item) => item.nodesSnapshot.length) || versions[versions.length - 1]
    return {
      nodes: (version?.nodesSnapshot || []).map((item) => ({ ...item })),
      source: 'offline',
      draft: false,
      statusText: version ? `已下线 · 快照 ${version.versionName}` : '已下线',
    }
  }
  if (latest) {
    const version = latestPublishedVersion(data, templateId) || latest
    return {
      nodes: (version?.nodesSnapshot || []).map((item) => ({ ...item })),
      source: 'snapshot',
      draft: false,
      statusText: version ? `已发布 ${version.versionName}` : '已发布',
    }
  }
  return {
    nodes: live(),
    source: 'draft',
    draft: true,
    statusText: '草稿',
  }
}

/** 已有发布快照，同时画布不是这份已发布内容时，才允许另看草稿。 */
export function overviewCanPreviewDraft(data: AppData, templateId: string) {
  const canvas = specCanvasOf(data, templateId)
  const published = modelVersionsOf(data, templateId).some((item) => item.status === 'published')
  return published && canvas?.status !== 'published'
}

function typesOn(data: AppData, categoryId: string) {
  const seen = new Set<string>()
  return data.productTypes
    .filter((item) => item.categoryId === categoryId)
    .slice()
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'zh') || a.id.localeCompare(b.id))
    .filter((item) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
}

function modelName(data: AppData, templateId: string, canvasName?: string) {
  return canvasName?.trim() || data.templates.find((item) => item.id === templateId)?.name || '未命名模型'
}

function specLabel(data: AppData, node: ProductSpecNode) {
  if (node.nodeType === 'VALUE') return node.valueId || '未命名取值'
  return data.params.find((item) => item.id === node.attributeId)?.name || '未绑定属性'
}

function pushSpec(nodes: OverviewGraphNode[], data: AppData, place: { categoryId: string; typeId: string; templateId: string; modelId: string; source: OverviewModelSource }, specNodes: ProductSpecNode[]) {
  const present = new Set(specNodes.map((item) => item.id))
  const linked = specNodes.filter((item) => !item.parentId || (item.parentId && present.has(item.parentId)))
  const byId = new Map(linked.map((item) => [item.id, item]))
  const visual = (nodeId: string) => specVisualId(place.categoryId, place.typeId, place.templateId, nodeId)
  const walking = new Set<string>()
  const visit = (node: ProductSpecNode) => {
    if (walking.has(node.id)) return
    walking.add(node.id)
    const children = linked.filter((item) => item.parentId === node.id).sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))
    const bound = node.nodeType !== 'ATTRIBUTE' || Boolean(node.attributeId && data.params.some((item) => item.id === node.attributeId))
    nodes.push({
      id: visual(node.id),
      parentId: node.parentId && byId.has(node.parentId) ? visual(node.parentId) : place.modelId,
      kind: node.nodeType === 'VALUE' ? 'value' : 'attribute',
      sort: node.sort,
      label: specLabel(data, node),
      meta: node.nodeType === 'VALUE' ? '取值' : '属性',
      entityId: node.id,
      categoryId: place.categoryId,
      typeId: place.typeId,
      templateId: place.templateId,
      nodeId: node.id,
      draft: place.source === 'draft',
      source: place.source,
      childCount: children.length,
      expandable: children.length > 0,
      head: !node.parentId && node.nodeType === 'ATTRIBUTE',
      bound,
    })
    children.forEach(visit)
  }
  linked.filter((item) => !item.parentId).sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id)).forEach(visit)
}

function modelsOn(data: AppData, typeId: string, draftTemplates?: ReadonlySet<string>) {
  const seen = new Set<string>()
  return data.specCanvases
    .filter((item) => item.productTypeId === typeId && item.templateId)
    .filter((item) => {
      if (seen.has(item.templateId)) return false
      seen.add(item.templateId)
      return true
    })
    .map((item) => ({
      templateId: item.templateId,
      name: modelName(data, item.templateId, item.name),
      read: readOverviewModel(data, item.templateId, draftTemplates?.has(item.templateId) ? 'draft' : 'auto'),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh') || a.templateId.localeCompare(b.templateId))
}

/** 从分类起点收集显式下级。类型只认 productType.categoryId，模型只认画布上的 productTypeId。 */
export function buildOverviewCatalog(data: AppData, focusCategoryId: string, draftTemplates?: ReadonlySet<string>): OverviewGraphNode[] {
  const focus = data.categories.find((item) => item.id === focusCategoryId)
  if (!focus) return []
  const nodes: OverviewGraphNode[] = []
  const childCategories = (parentId: string) => data.categories
    .filter((item) => item.parentId === parentId)
    .slice()
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'zh') || a.id.localeCompare(b.id))
  const pushCategory = (categoryId: string, parentVisual: string | null, sort: number) => {
    const category = data.categories.find((item) => item.id === categoryId)
    if (!category) return
    const id = categoryVisualId(category.id)
    const types = typesOn(data, category.id)
    const children = childCategories(category.id)
    nodes.push({
      id,
      parentId: parentVisual,
      kind: 'category',
      sort,
      label: category.name,
      meta: types.length ? `${types.length} 个类型` : children.length ? `${children.length} 个下级分类` : '还没有产品类型',
      entityId: category.id,
      categoryId: category.id,
      typeId: '',
      templateId: '',
      nodeId: '',
      draft: false,
      source: '',
      childCount: types.length + children.length,
      expandable: types.length + children.length > 0,
      head: false,
      bound: true,
    })
    types.forEach((type, index) => {
      const typeId = typeVisualId(category.id, type.id)
      const models = modelsOn(data, type.id, draftTemplates)
      nodes.push({
        id: typeId,
        parentId: id,
        kind: 'type',
        sort: index + 1,
        label: type.name,
        meta: `${models.length} 个模型${type.status === 'disabled' ? ' · 已停用' : ''}`,
        entityId: type.id,
        categoryId: category.id,
        typeId: type.id,
        templateId: '',
        nodeId: '',
        draft: false,
        source: '',
        childCount: models.length,
        expandable: models.length > 0,
        head: false,
        bound: true,
      })
      models.forEach((model, modelIndex) => {
        const modelId = modelVisualId(category.id, type.id, model.templateId)
        const roots = model.read.nodes.filter((item) => !item.parentId)
        nodes.push({
          id: modelId,
          parentId: typeId,
          kind: 'model',
          sort: modelIndex + 1,
          label: model.name,
          meta: `${model.read.statusText} · ${model.read.nodes.length} 个节点`,
          entityId: model.templateId,
          categoryId: category.id,
          typeId: type.id,
          templateId: model.templateId,
          nodeId: '',
          draft: model.read.draft,
          source: model.read.source,
          childCount: roots.length,
          expandable: roots.length > 0,
          head: false,
          bound: true,
        })
        pushSpec(nodes, data, { categoryId: category.id, typeId: type.id, templateId: model.templateId, modelId, source: model.read.source }, model.read.nodes)
      })
    })
    children.forEach((child, index) => pushCategory(child.id, id, 1000 + index + 1))
  }
  pushCategory(focus.id, null, focus.sort)
  return nodes
}

/** 第一屏用全部根分类。每个根仍按显式分类关系向下收集，不按名称合并。 */
export function buildOverviewForest(data: AppData, draftTemplates?: ReadonlySet<string>) {
  return data.categories
    .filter((item) => !item.parentId)
    .slice()
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'zh') || a.id.localeCompare(b.id))
    .flatMap((item) => buildOverviewCatalog(data, item.id, draftTemplates))
}

export function defaultExpandedIds(nodes: OverviewGraphNode[]) {
  return nodes.filter((item) => item.kind === 'category' || item.kind === 'type').map((item) => item.id)
}

export function visibleOverviewNodes(nodes: OverviewGraphNode[], expandedIds: ReadonlySet<string>, collapsedSpecIds: ReadonlySet<string>) {
  const byId = new Map(nodes.map((item) => [item.id, item]))
  const open = (node: OverviewGraphNode) => {
    if (node.kind === 'attribute' || node.kind === 'value') return !collapsedSpecIds.has(node.id)
    return expandedIds.has(node.id)
  }
  return nodes.filter((node) => {
    let parentId = node.parentId
    const guard = new Set<string>()
    while (parentId && !guard.has(parentId)) {
      guard.add(parentId)
      const parent = byId.get(parentId)
      if (!parent || !open(parent)) return false
      parentId = parent.parentId
    }
    return true
  })
}

export function overviewCategoryOptions(data: AppData) {
  return data.categories
    .slice()
    .sort((a, b) => categoryPath(data, a.id).localeCompare(categoryPath(data, b.id), 'zh') || a.id.localeCompare(b.id))
    .map((item) => ({ id: item.id, label: categoryPath(data, item.id) || item.name }))
}
