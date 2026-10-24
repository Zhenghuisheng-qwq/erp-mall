import type { SkuColumn } from './skuWorkbenchTypes'
/** Move one stable key in the complete draft, never in a filtered projection. */
export function reorderSkuColumn(columns: SkuColumn[], source: string, target: string, place: 'before' | 'after') {
  if (source === target || !columns.some(c => c.key === source) || !columns.some(c => c.key === target)) return columns
  const next = columns.filter(c => c.key !== source)
  const at = next.findIndex(c => c.key === target) + (place === 'after' ? 1 : 0)
  next.splice(at, 0, columns.find(c => c.key === source)!)
  return next.every((c, i) => c.key === columns[i]?.key) ? columns : next
}
