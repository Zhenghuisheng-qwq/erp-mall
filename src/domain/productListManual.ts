/** 手工顺序只保存记录 id。不改商品数组，也不用名称或编号当身份。 */

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
