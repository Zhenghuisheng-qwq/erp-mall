import type { Category } from './types'

export type CatalogCategoryLayout = 'tree' | 'list'
export type CatalogCategoryRelation = 'hit' | 'path' | 'context'
export type CatalogCategoryAnomaly = '' | 'missing-parent' | 'self-parent' | 'cycle'
export type CatalogCategoryEmpty = '' | 'none' | 'search' | 'status' | 'both'

export interface CatalogCategoryProjectionRow {
  id: string
  name: string
  enabled: boolean
  depth: number
  parentId: string | null
  hasChildren: boolean
  expanded: boolean
  path: string
  section: 'main' | 'anomaly'
  relation: CatalogCategoryRelation
  anomaly: CatalogCategoryAnomaly
  anomalyLabel: string
  anomalyLead: boolean
}

export interface CatalogCategoryProjection {
  rows: CatalogCategoryProjectionRow[]
  anomalyTotal: number
  empty: CatalogCategoryEmpty
}

const categoryName = (category: Category) => typeof category.name === 'string' && category.name ? category.name : category.id
const parentKey = (category: Category) => category.parentId || null

/** 展示顺序。不写回 Category.sort。 */
export function compareCatalogCategories(a: Category, b: Category, sort: string) {
  const byName = categoryName(a).localeCompare(categoryName(b), 'zh') || a.id.localeCompare(b.id)
  if (sort === 'name-desc') return categoryName(b).localeCompare(categoryName(a), 'zh') || a.id.localeCompare(b.id)
  if (sort === 'status') return Number(a.enabled === false) - Number(b.enabled === false) || byName
  return byName
}

function uniqueCategories(categories: readonly Category[]) {
  const seen = new Set<string>()
  const rows: Category[] = []
  for (const category of categories) {
    if (!category?.id || seen.has(category.id)) continue
    seen.add(category.id)
    rows.push(category)
  }
  return rows
}

export function catalogCategoryAnomalies(categories: readonly Category[]) {
  const rows = uniqueCategories(categories)
  const byId = new Map(rows.map(category => [category.id, category]))
  const result = new Map<string, Exclude<CatalogCategoryAnomaly, ''>>()
  for (const category of rows) {
    if (category.parentId && category.parentId === category.id) result.set(category.id, 'self-parent')
    else if (category.parentId && !byId.has(category.parentId)) result.set(category.id, 'missing-parent')
  }
  const color = new Map<string, number>()
  const stack: string[] = []
  const walk = (id: string) => {
    if ((color.get(id) || 0) !== 0) return
    color.set(id, 1)
    stack.push(id)
    const parentId = byId.get(id)?.parentId
    if (parentId && parentId !== id && byId.has(parentId)) {
      if ((color.get(parentId) || 0) === 1) {
        for (let index = stack.indexOf(parentId); index >= 0 && index < stack.length; index += 1) result.set(stack[index]!, 'cycle')
      } else walk(parentId)
    }
    stack.pop()
    color.set(id, 2)
  }
  for (const category of rows) walk(category.id)
  return result
}

function anomalyLabel(category: Category, anomaly: CatalogCategoryAnomaly) {
  if (anomaly === 'missing-parent') return `上级不存在（${category.parentId}）`
  if (anomaly === 'self-parent') return '上级指向自己'
  if (anomaly === 'cycle') return `与上级形成循环（${category.parentId}）`
  return ''
}

interface CategoryForest {
  rows: Category[]
  byId: Map<string, Category>
  anomalies: Map<string, Exclude<CatalogCategoryAnomaly, ''>>
  main: Map<string | null, Category[]>
  anomaly: Map<string | null, Category[]>
  paths: Map<string, string>
}

function buildForest(categories: readonly Category[], sort: string): CategoryForest {
  const rows = uniqueCategories(categories)
  const byId = new Map(rows.map(category => [category.id, category]))
  const anomalies = catalogCategoryAnomalies(rows)
  const paths = new Map<string, string>()
  const pathOf = (id: string) => {
    if (paths.has(id)) return paths.get(id)!
    const chain: Category[] = []
    const seen = new Set<string>()
    let current = byId.get(id)
    while (current && !seen.has(current.id) && !paths.has(current.id)) {
      seen.add(current.id)
      chain.push(current)
      current = current.parentId && current.parentId !== current.id ? byId.get(current.parentId) : undefined
    }
    let prefix = current && paths.has(current.id) ? paths.get(current.id)! : ''
    for (let index = chain.length - 1; index >= 0; index -= 1) {
      const category = chain[index]!
      prefix = prefix ? `${prefix} / ${categoryName(category)}` : categoryName(category)
      paths.set(category.id, prefix)
    }
    return paths.get(id) || ''
  }
  for (const category of rows) pathOf(category.id)
  const sectionOf = (id: string) => {
    const seen = new Set<string>()
    let current = byId.get(id)
    while (current && !seen.has(current.id)) {
      if (anomalies.has(current.id)) return 'anomaly' as const
      seen.add(current.id)
      if (!current.parentId) return 'main' as const
      current = byId.get(current.parentId)
    }
    return 'anomaly' as const
  }
  const displayParent = (category: Category) => anomalies.has(category.id) || !category.parentId || !byId.has(category.parentId) ? null : category.parentId
  const main = new Map<string | null, Category[]>()
  const anomaly = new Map<string | null, Category[]>()
  for (const category of rows) {
    const bucket = sectionOf(category.id) === 'anomaly' ? anomaly : main
    const parentId = displayParent(category)
    const list = bucket.get(parentId) || []
    list.push(category)
    bucket.set(parentId, list)
  }
  for (const bucket of [main, anomaly]) for (const list of bucket.values()) list.sort((a, b) => compareCatalogCategories(a, b, sort))
  return { rows, byId, anomalies, main, anomaly, paths }
}

function childMap(forest: CategoryForest) {
  const children = new Map<string, string[]>()
  for (const bucket of [forest.main, forest.anomaly]) {
    for (const [parentId, list] of bucket) {
      if (!parentId) continue
      children.set(parentId, list.map(category => category.id))
    }
  }
  return children
}

function ancestorsOf(forest: CategoryForest, id: string) {
  const chain: string[] = []
  const seen = new Set<string>()
  let current = forest.byId.get(id)
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    const parentId = current.parentId
    if (!parentId || !forest.byId.has(parentId) || parentId === current.id) break
    if (seen.has(parentId)) break
    chain.push(parentId)
    current = forest.byId.get(parentId)
  }
  return chain
}

function descendantsOf(children: Map<string, string[]>, id: string) {
  const result: string[] = []
  const seen = new Set<string>([id])
  const stack = [...(children.get(id) || [])]
  while (stack.length) {
    const next = stack.pop()!
    if (seen.has(next)) continue
    seen.add(next)
    result.push(next)
    stack.push(...(children.get(next) || []))
  }
  return result
}

function passesStatus(category: Category, status: string) {
  if (!status) return true
  const disabled = category.enabled === false
  return status === 'disabled' ? disabled : !disabled
}

function passesKeyword(category: Category, needle: string, path: string) {
  if (!needle) return true
  return categoryName(category).toLocaleLowerCase().includes(needle) || category.id.toLocaleLowerCase().includes(needle) || path.toLocaleLowerCase().includes(needle)
}

function collectExpanded(bucket: Map<string | null, Category[]>, parentId: string | null, depth: number, into: string[], limit: number | null, seen = new Set<string>()) {
  for (const category of bucket.get(parentId) || []) {
    if (seen.has(category.id)) continue
    seen.add(category.id)
    const children = bucket.get(category.id) || []
    if (children.length && (limit === null || depth < limit)) into.push(category.id)
    collectExpanded(bucket, category.id, depth + 1, into, limit, seen)
  }
}

/** 根为第一级。默认展开第一级和第二级，第三级可见但收起。 */
export function defaultCatalogTreeExpandedIds(categories: readonly Category[]) {
  const forest = buildForest(categories, 'name')
  const ids: string[] = []
  collectExpanded(forest.main, null, 0, ids, 2)
  collectExpanded(forest.anomaly, null, 0, ids, 2)
  return ids
}

export function catalogExpandableCategoryIds(categories: readonly Category[]) {
  const forest = buildForest(categories, 'name')
  const ids: string[] = []
  collectExpanded(forest.main, null, 0, ids, null)
  collectExpanded(forest.anomaly, null, 0, ids, null)
  return ids
}

export function projectCatalogCategories(input: {
  categories: readonly Category[]
  layout: CatalogCategoryLayout
  sort: string
  keyword: string
  status: string
  expandedIds: readonly string[]
}): CatalogCategoryProjection {
  const started = uniqueCategories(input.categories)
  const forest = buildForest(started, input.sort || 'name')
  const needle = input.keyword.trim().toLocaleLowerCase()
  const status = input.status
  const filtering = !!(needle || status)
  const children = childMap(forest)
  const direct = new Set<string>()
  for (const category of forest.rows) {
    if (!filtering || (passesKeyword(category, needle, forest.paths.get(category.id) || '') && passesStatus(category, status))) direct.add(category.id)
  }
  const included = new Set(direct)
  const ancestorOfDirect = new Set<string>()
  if (filtering && input.layout === 'tree') {
    for (const id of direct) for (const ancestor of ancestorsOf(forest, id)) { included.add(ancestor); ancestorOfDirect.add(ancestor) }
    if (needle) {
      for (const id of direct) {
        const category = forest.byId.get(id)
        if (!category || !passesKeyword(category, needle, forest.paths.get(id) || '')) continue
        for (const descendant of descendantsOf(children, id)) {
          const child = forest.byId.get(descendant)
          if (!child || !passesStatus(child, status)) continue
          included.add(descendant)
          for (const ancestor of ancestorsOf(forest, descendant)) included.add(ancestor)
        }
      }
    }
  }
  const open = new Set(input.expandedIds)
  if (filtering && input.layout === 'tree') {
    for (const id of included) if ((children.get(id) || []).some(child => included.has(child))) open.add(id)
  }
  const rows: CatalogCategoryProjectionRow[] = []
  const seen = new Set<string>()
  const pushTree = (bucket: Map<string | null, Category[]>, section: 'main' | 'anomaly', parentId: string | null, depth: number) => {
    for (const category of bucket.get(parentId) || []) {
      if (seen.has(category.id)) continue
      seen.add(category.id)
      const kids = (bucket.get(category.id) || []).filter(child => included.has(child.id))
      if (!included.has(category.id)) continue
      const anomaly = forest.anomalies.get(category.id) || ''
      rows.push({
        id: category.id,
        name: categoryName(category),
        enabled: category.enabled !== false,
        depth,
        parentId: parentKey(category),
        hasChildren: kids.length > 0,
        expanded: kids.length > 0 && open.has(category.id),
        path: forest.paths.get(category.id) || categoryName(category),
        section,
        relation: !filtering || direct.has(category.id) ? 'hit' : ancestorOfDirect.has(category.id) ? 'path' : 'context',
        anomaly,
        anomalyLabel: anomalyLabel(category, anomaly),
        anomalyLead: false,
      })
      if (kids.length > 0 && open.has(category.id)) pushTree(bucket, section, category.id, depth + 1)
    }
  }
  if (input.layout === 'list') {
    const listed = forest.rows.filter(category => included.has(category.id)).sort((a, b) => compareCatalogCategories(a, b, input.sort || 'name'))
    for (const category of listed) {
      const anomaly = forest.anomalies.get(category.id) || ''
      rows.push({
        id: category.id, name: categoryName(category), enabled: category.enabled !== false, depth: 0, parentId: parentKey(category),
        hasChildren: false, expanded: false, path: forest.paths.get(category.id) || categoryName(category),
        section: forest.anomalies.has(category.id) || ancestorsOf(forest, category.id).some(id => forest.anomalies.has(id)) ? 'anomaly' : 'main',
        relation: 'hit', anomaly, anomalyLabel: anomalyLabel(category, anomaly), anomalyLead: false,
      })
    }
  } else {
    pushTree(forest.main, 'main', null, 0)
    const anomalyStart = rows.length
    pushTree(forest.anomaly, 'anomaly', null, 0)
    if (rows[anomalyStart]) rows[anomalyStart].anomalyLead = true
  }
  const empty: CatalogCategoryEmpty = !started.length ? 'none' : rows.length ? '' : needle && status ? 'both' : needle ? 'search' : status ? 'status' : ''
  return { rows, anomalyTotal: forest.anomalies.size, empty }
}
