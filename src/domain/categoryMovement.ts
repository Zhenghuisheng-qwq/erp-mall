import { blockChildOfTypedCategory, moveCategoryNode, relocateCategoryNodes, type DropPosition } from './categoryTree'
import type { Category } from './types'
import { branchFailure, createFailure } from './guide/failure'
import type { CategoryMoveRejection } from './categoryTree'
import type { GuideFailure } from './guide/types'

export interface CategoryMoveRequest {
  id: string
  targetId: string | null
  position?: DropPosition
}
/** A compact structure basis, independent of presentation/search/selection. */
export function categoryStructureStamp(categories: readonly Category[]) {
  return JSON.stringify(categories.map(item => [item.id, item.parentId, item.sort]))
}
/** Reuse the actual domain commands on category records only, before touching live data. */
export function previewCategoryMove(categories: Category[], request: CategoryMoveRequest, typedIds: ReadonlySet<string>) {
  const candidate = categories.map(item => ({ ...item }))
  let branch: CategoryMoveRejection | undefined
  const message = request.position
    ? relocateCategoryNodes(candidate, request.id, request.targetId || '', request.position, typedIds)
    : moveCategoryNode(candidate, request.id, request.targetId, typedIds, value => { branch = value })
  const context = { categoryId: request.id, categoryName: categories.find(item => item.id === request.id)?.name || '', targetId: request.targetId || '', targetName: categories.find(item => item.id === request.targetId)?.name || '' }
  return { message, changed: !message && categoryStructureStamp(candidate) !== categoryStructureStamp(categories), ...(branch ? { failure: branchFailure(`category.move.${branch}`, message, { savedState: 'unchanged', context, recovery: ['choose-target'] }) } : {}) }
}

export interface CategoryMoveSources {
  requestedIds: string[]
  sourceIds: string[]
  merged: { id: string; ancestorId: string }[]
}
export interface CategoryMovesRequest { sourceIds: readonly string[]; targetId: string | null }
export interface CategoryMovesPreview extends CategoryMoveSources {
  ok: boolean; message: string; changed: boolean; movedIds: string[]; skippedIds: string[]; failure?: GuideFailure
}

/** A selected ancestor owns its complete subtree. Its position is the first selected
 * member of that subtree, so adding an ancestor does not reorder unrelated sources. */
export function normalizeCategoryMoveSources(categories: readonly Category[], ids: readonly string[]): CategoryMoveSources {
  const requestedIds = [...new Set(Array.isArray(ids) ? ids.filter(id => typeof id === 'string') : [])]
  const selected = new Set(requestedIds), byId = new Map(categories.map(item => [item.id, item]))
  const roots = new Map<string, string>()
  for (const id of requestedIds) {
    let ancestorId = id, cursor = byId.get(id)?.parentId
    const seen = new Set([id])
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor)
      if (selected.has(cursor)) ancestorId = cursor
      cursor = byId.get(cursor)?.parentId
    }
    roots.set(id, ancestorId)
  }
  return { requestedIds, sourceIds: [...new Set(requestedIds.map(id => roots.get(id)!))], merged: requestedIds.filter(id => roots.get(id) !== id).map(id => ({ id, ancestorId: roots.get(id)! })) }
}

/** Private category records only; no live mutation, IDs, clock or storage side effects. */
export function categoryMovesCandidate(categories: readonly Category[], request: CategoryMovesRequest, typedIds: ReadonlySet<string>) {
  const normalized = normalizeCategoryMoveSources(categories, request?.sourceIds)
  const unchanged = (): Category[] => categories.map(item => ({ ...item }))
  const context = (id = '') => ({ categoryId: id, categoryName: categories.find(item => item.id === id)?.name || '', targetId: request?.targetId || '', targetName: categories.find(item => item.id === request?.targetId)?.name || '' })
  const reject = (message: string, failure: GuideFailure) => ({ categories: unchanged(), preview: { ...normalized, ok: false, message, changed: false, movedIds: [], skippedIds: [], failure } as CategoryMovesPreview })
  const rejectBranch = (branch: CategoryMoveRejection, message: string, id = '') => reject(message, branchFailure(`category.move.${branch}`, message, { savedState: 'unchanged', context: context(id), recovery: ['choose-target'] }))
  if (!request || !Array.isArray(request.sourceIds) || !request.sourceIds.length || request.sourceIds.some(id => typeof id !== 'string' || !id) || request.targetId !== null && (typeof request.targetId !== 'string' || !request.targetId)) {
    const message = '请加入有效的待移动分类，并明确选择目标父级或顶级分类。'
    return reject(message, createFailure({ kind: 'input', actionId: 'action-category-move', ruleId: 'rule-category-input', message, savedState: 'unchanged', recovery: ['choose-target'] }))
  }
  const byId = new Map(categories.map(item => [item.id, item]))
  // Check every original request, including a descendant later merged under its ancestor.
  for (const id of normalized.requestedIds) if (!byId.has(id)) return rejectBranch('source-missing', `待移动分类「${id}」已不存在；整批未移动。`, id)
  if (request.targetId && !byId.has(request.targetId)) return rejectBranch('target-missing', '目标父级已不存在；整批未移动。')
  const ancestors = (id: string | null) => {
    const result = new Set<string>()
    while (id) { if (result.has(id)) return { ids: result, cycle: true }; result.add(id); id = byId.get(id)?.parentId || null }
    return { ids: result, cycle: false }
  }
  const targetAncestors = ancestors(request.targetId)
  for (const id of normalized.sourceIds) {
    const name = byId.get(id)!.name
    if (id === request.targetId) return rejectBranch('self', `「${name}」不能移动到自己下面；整批未移动。`, id)
    if (targetAncestors.ids.has(id)) return rejectBranch('descendant', `「${name}」不能移动到自己的子分类下面；整批未移动。`, id)
    if (ancestors(id).cycle || targetAncestors.cycle) return rejectBranch('descendant', '来源或目标存在循环层级，请先修正；整批未移动。', id)
  }
  const skippedIds = normalized.sourceIds.filter(id => byId.get(id)!.parentId === request.targetId)
  const movedIds = normalized.sourceIds.filter(id => byId.get(id)!.parentId !== request.targetId)
  if (movedIds.length && blockChildOfTypedCategory(request.targetId, typedIds)) return rejectBranch('target-typed', `目标「${byId.get(request.targetId!)!.name}」已关联产品类型，不能接收子分类；整批未移动。`, movedIds[0])
  const candidate = unchanged()
  // All boundaries above are checked against the original/latest structure before any move.
  // Existing single-node rules still own typed-target and sibling resequencing semantics.
  for (const id of movedIds) {
    let branch: CategoryMoveRejection | undefined
    const message = moveCategoryNode(candidate, id, request.targetId, typedIds, value => { branch = value })
    if (message) return rejectBranch(branch!, `「${byId.get(id)!.name}」：${message} 整批未移动。`, id)
  }
  const preview: CategoryMovesPreview = { ...normalized, ok: true, message: movedIds.length ? `已移动 ${movedIds.length} 项分类${skippedIds.length ? `，跳过 ${skippedIds.length} 项位置未变化的分类` : ''}。` : '所选分类的位置没有变化，未写入数据。', changed: !!movedIds.length, movedIds, skippedIds }
  return { categories: candidate, preview }
}

export function previewCategoryMoves(categories: readonly Category[], request: CategoryMovesRequest, typedIds: ReadonlySet<string>) {
  return categoryMovesCandidate(categories, request, typedIds).preview
}
