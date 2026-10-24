import { moveCategoryNode, relocateCategoryNodes, type DropPosition } from './categoryTree'
import type { Category } from './types'

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
  const message = request.position
    ? relocateCategoryNodes(candidate, request.id, request.targetId || '', request.position, typedIds)
    : moveCategoryNode(candidate, request.id, request.targetId, typedIds)
  return { message, changed: !message && categoryStructureStamp(candidate) !== categoryStructureStamp(categories) }
}
