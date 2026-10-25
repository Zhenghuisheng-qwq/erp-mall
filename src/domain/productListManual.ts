/** 手工顺序只保存记录 id。不改商品数组，也不用名称或编号当身份。 */
export interface GroupIdentityPart { field: string; kind: 'value' | 'empty' | 'not-applicable'; value?: unknown }
function typedGroupValue(value: unknown): unknown {
  if (Array.isArray(value)) return ['array', value.map(typedGroupValue)]
  if (value !== null && typeof value === 'object') return ['object', Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, typedGroupValue(item)])]
  return [value === null ? 'null' : typeof value, value]
}
/** Field IDs, typed values and the entire ancestor path identify a group. Labels never do. */
export function groupPathKey(parts: readonly GroupIdentityPart[]): string {
  return parts.length ? JSON.stringify(parts.map(part => [part.field, part.kind, ...(part.kind === 'value' ? [typedGroupValue(part.value)] : [])])) : 'all'
}
export interface ScopedManualOrderInput {
  order: readonly string[]
  matchedIds: readonly string[]
  groupKeys: ReadonlyMap<string, string> | Record<string, string>
  movingIds: readonly string[]
  targetId?: string
  place: 'before' | 'after' | 'top' | 'bottom'
}
/** Only matched slots in one complete leaf are reordered; all other slots retain their identity. */
export function planScopedManualOrder(input: ScopedManualOrderInput): { ok: true; order: string[]; changed: boolean; groupKey: string; message?: string } | { ok: false; message: string } {
  const fail = (message: string) => ({ ok: false as const, message })
  if (!input || !Array.isArray(input.order) || !Array.isArray(input.matchedIds) || !Array.isArray(input.movingIds) || !input.groupKeys || typeof input.groupKeys !== 'object' || !['before', 'after', 'top', 'bottom'].includes(input.place) || input.movingIds.some(id => typeof id !== 'string' || !id)) return fail('手工排序上下文无效，请重新打开列表。')
  const order = [...input.order], matched = new Set(input.matchedIds), moving = dedupeIds(input.movingIds)
  if (new Set(order).size !== order.length || order.some(id => typeof id !== 'string' || !id) || new Set(input.matchedIds).size !== input.matchedIds.length || input.matchedIds.some(id => !order.includes(id))) return fail('完整匹配结果或手工顺序已变化，请重新核对。')
  if (!moving.length) return fail('请先选择或暂存要移动的记录。')
  if (moving.some(id => !matched.has(id) || !order.includes(id))) return fail('有记录已不在当前完整筛选结果中，请重新暂存。')
  const keyOf = (id: string) => input.groupKeys instanceof Map ? input.groupKeys.get(id) : Object.hasOwn(input.groupKeys, id) ? (input.groupKeys as Record<string, string>)[id] : undefined
  const groupKey = keyOf(moving[0])
  if (typeof groupKey !== 'string' || !groupKey || moving.some(id => keyOf(id) !== groupKey)) return fail('只能在同一个最末级分组内调整顺序，请重新选择同组记录。')
  if (input.place === 'before' || input.place === 'after') {
    if (!input.targetId || !matched.has(input.targetId) || keyOf(input.targetId) !== groupKey) return fail('目标记录已不在当前完整筛选结果的同一分组内。')
    if (moving.includes(input.targetId)) return moving.length === 1 && moving[0] === input.targetId ? { ok: true, order, changed: false, groupKey } : fail('目标记录就在暂存区里，请重新选择目标。')
  }
  const scoped = order.filter(id => matched.has(id) && keyOf(id) === groupKey), selected = new Set(moving), remaining = scoped.filter(id => !selected.has(id))
  const at = input.place === 'top' ? 0 : input.place === 'bottom' ? remaining.length : remaining.indexOf(input.targetId!) + (input.place === 'after' ? 1 : 0)
  if (at < 0) return fail('目标记录已不存在，本次没有调整顺序。')
  const projected = [...remaining.slice(0, at), ...moving, ...remaining.slice(at)]
  let cursor = 0
  const next = order.map(id => matched.has(id) && keyOf(id) === groupKey ? projected[cursor++]! : id)
  return { ok: true, order: next, changed: next.some((id, index) => id !== order[index]), groupKey }
}

export function dedupeIds(raw: unknown) {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const rows: string[] = []
  raw.forEach((item) => {
    const id = String(item || '').trim()
    if (!id || seen.has(id)) return
    seen.add(id)
    rows.push(id)
  })
  return rows
}

/** 已保存的 id 保持相对顺序；已删除的跳过；新记录按当前完整序列追加到末尾。 */
export function resolveManualOrder(saved: unknown, currentIds: string[]) {
  const alive = new Set(currentIds)
  const seen = new Set<string>()
  const rows: string[] = []
  dedupeIds(saved).forEach((id) => {
    if (!alive.has(id) || seen.has(id)) return
    seen.add(id)
    rows.push(id)
  })
  currentIds.forEach((id) => {
    if (seen.has(id)) return
    seen.add(id)
    rows.push(id)
  })
  return rows
}

export function moveManualId(order: string[], dragId: string, targetId: string, place: 'before' | 'after' = 'before') {
  if (!order.includes(dragId) || !order.includes(targetId)) return { ok: false as const, message: '这条记录已经不在列表里。' }
  if (dragId === targetId) return { ok: true as const, order: [...order] }
  return insertManualIds(order, [dragId], targetId, place)
}

export function insertManualIds(order: string[], staged: string[], targetId: string, place: 'before' | 'after') {
  const unique = dedupeIds(staged)
  if (!unique.length) return { ok: false as const, message: '暂存区是空的。' }
  if (!order.includes(targetId)) return { ok: false as const, message: '目标记录已经不在列表里，请重新选择。' }
  if (unique.includes(targetId)) return { ok: false as const, message: '目标记录就在暂存区里，请重新选择一个目标。' }
  const missing = unique.filter((id) => !order.includes(id))
  if (missing.length) return { ok: false as const, message: '有暂存记录已经不在列表里，请先从暂存区移除。' }
  const moving = new Set(unique)
  const rest = order.filter((id) => !moving.has(id))
  const index = rest.indexOf(targetId)
  if (index < 0) return { ok: false as const, message: '目标记录已经不在列表里，请重新选择。' }
  const at = place === 'after' ? index + 1 : index
  const next = [...rest.slice(0, at), ...unique, ...rest.slice(at)]
  if (new Set(next).size !== next.length || next.length !== order.length) return { ok: false as const, message: '排序结果出现重复或遗漏，没有保存。' }
  return { ok: true as const, order: next }
}
