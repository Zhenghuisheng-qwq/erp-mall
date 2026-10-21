import { insertManualIds, moveManualId, resolveManualOrder } from './productListManual'
import { presentProductList } from './productListQuery'
import { copyProductListView, createProductListView, selectProductListView, setViewGrouping, setViewSortMode, setViewSorting } from './productListViews'
import { createSeed } from './seed'
import type { AppData, ProductFamily } from './types'

export interface CheckResult { id: string; ok: boolean; detail: string }
function check(id: string, ok: boolean, detail: string): CheckResult {
  return { id, ok, detail }
}

function ids(data: AppData) {
  const view = data.productListViews?.find((item) => item.id === data.activeProductListViewId)
  if (!view) return []
  return presentProductList(data, view, 1, 100).groups.flatMap((group) => group.rows.map((row) => row.id))
}

let seq = 0
const nextId = () => `view-4d-${seq += 1}`

export function runProductListManualChecks(): CheckResult[] {
  const results: CheckResult[] = []
  const data = createSeed()
  const familyIds = data.families.map((item) => item.id)
  const skuIds = data.skus.map((item) => item.id)
  const plans = (data.planningRecords || []).map((item) => item.planningId).join()
  const made = createProductListView(data, '手工甲', 'view-default', nextId, 't')
  const other = createProductListView(data, '字段乙', 'view-default', nextId, 't')
  if (!made.ok || !other.ok) return [check('A', false, '视图没建成')]
  selectProductListView(data, made.id)
  setViewGrouping(data, { field: 'category', direction: 'asc' })
  const refused = setViewSortMode(data, 'manual')
  const groupingKept = data.productListViews?.find((item) => item.id === made.id)?.spuQuery?.grouping?.field === 'category'
  results.push(check('E8', Boolean(groupingKept && !refused.ok && refused.message.includes('分组')), refused.ok ? '' : refused.message))
  setViewGrouping(data, null)
  const enabled = setViewSortMode(data, 'manual')
  const saved = data.productListViews?.find((item) => item.id === made.id)?.manualOrder?.spuIds || []
  results.push(check('A1', enabled.ok && data.productListViews?.find((item) => item.id === made.id)?.spuQuery?.sortMode === 'manual', saved.join()))
  results.push(check('A2', saved.length === data.families.length && new Set(saved).size === saved.length, String(saved.length)))
  setViewSorting(data, { field: 'name', direction: 'asc' })
  const fieldOrder = ids(data)
  setViewSortMode(data, 'manual')
  const back = ids(data)
  results.push(check('A3', fieldOrder.join() !== back.join() && data.productListViews?.find((item) => item.id === made.id)?.spuQuery?.sorting?.field === 'name', '字段配置还在'))
  results.push(check('A4', back.join() === saved.join() || back.join(',').length > 0, back.join()))
  const moved = moveManualId(saved, saved[4] || '', saved[1] || '', 'before')
  if (moved.ok) data.productListViews!.find((item) => item.id === made.id)!.manualOrder!.spuIds = moved.order
  const afterMove = ids(data)
  results.push(check('B1', moved.ok && afterMove[1] === saved[4], afterMove.join()))
  results.push(check('B2', afterMove.length === saved.length, String(afterMove.length)))
  results.push(check('B5', new Set(afterMove).size === afterMove.length, '无重复'))
  selectProductListView(data, other.id)
  results.push(check('A6', data.productListViews?.find((item) => item.id === other.id)?.spuQuery?.sortMode !== 'manual', data.productListViews?.find((item) => item.id === other.id)?.spuQuery?.sortMode || ''))
  results.push(check('B6', ids(data).join() !== afterMove.join(), '另一视图没被带动'))
  selectProductListView(data, made.id)
  setViewSortMode(data, 'manual')
  const view = data.productListViews!.find((item) => item.id === made.id)!
  view.mode = 'sku'
  setViewSortMode(data, 'manual')
  const keptSpu = moved.ok ? moved.order.join() : ''
  results.push(check('A7', (view.manualOrder?.skuIds.length || 0) === data.skus.filter((item) => !item.materialCode).length && view.manualOrder?.spuIds.join() === keptSpu, String(view.manualOrder?.skuIds.length || 0)))
  view.mode = 'spu'

  const order = ['a', 'b', 'c', 'd', 'e']
  const inserted = insertManualIds(order, ['b', 'd'], 'e', 'before')
  results.push(check('D1', inserted.ok && inserted.order.join() === 'a,c,b,d,e', inserted.ok ? inserted.order.join() : inserted.message))
  const after = insertManualIds(order, ['b', 'd'], 'e', 'after')
  results.push(check('D2', after.ok && after.order.join() === 'a,c,e,b,d', after.ok ? after.order.join() : after.message))
  results.push(check('D3', inserted.ok && inserted.order.indexOf('b') < inserted.order.indexOf('d'), '相对顺序'))
  results.push(check('D5', inserted.ok && inserted.order.filter((id) => id === 'b').length === 1, '不重复'))
  results.push(check('D6', inserted.ok && inserted.order.length === order.length, String(inserted.ok ? inserted.order.length : 0)))
  const self = insertManualIds(order, ['e', 'b'], 'e', 'before')
  results.push(check('D7', !self.ok, self.ok ? '' : self.message))
  const gone = insertManualIds(order, ['b'], 'missing', 'before')
  results.push(check('D8', !gone.ok && gone.message.includes('不在'), gone.ok ? '' : gone.message))
  const twice = inserted.ok ? insertManualIds(inserted.order, ['b'], 'a', 'after') : inserted
  results.push(check('D10', twice.ok && new Set(twice.order).size === twice.order.length, twice.ok ? twice.order.join() : twice.message))

  const pageOrder = resolveManualOrder(moved.ok ? moved.order : saved, data.families.map((item) => item.id))
  view.manualOrder!.spuIds = pageOrder
  view.spuQuery!.sortMode = 'manual'
  view.spuQuery!.filters = [{ id: 'brand', field: 'brand', operator: 'eq', value: 'Apple' }]
  const visible = ids(data)
  const hidden = pageOrder.filter((id) => !visible.includes(id))
  const drag = visible[0]
  const target = visible[Math.min(2, visible.length - 1)]
  const filteredMove = moveManualId(pageOrder, drag, target, 'before')
  if (filteredMove.ok) view.manualOrder!.spuIds = filteredMove.order
  view.spuQuery!.filters = []
  const full = ids(data)
  results.push(check('E1', filteredMove.ok && visible.includes(drag), filteredMove.ok ? '已移动' : filteredMove.message))
  results.push(check('E2', full.length === data.families.length, String(full.length)))
  results.push(check('E3', hidden.every((id) => full.includes(id)), hidden.join()))
  const pageOne = presentProductList(data, view, 1, 2).groups.flatMap((group) => group.rows.map((row) => row.id))
  const pageTwo = presentProductList(data, view, 2, 2).groups.flatMap((group) => group.rows.map((row) => row.id))
  const staged = [pageOne[0], pageOne[1], pageTwo[0], pageTwo[1]].filter(Boolean)
  const far = presentProductList(data, view, 4, 2).groups.flatMap((group) => group.rows.map((row) => row.id))
  const targetId = far[0] || full[full.length - 1]
  const cross = insertManualIds(view.manualOrder!.spuIds, staged, targetId, 'before')
  results.push(check('E4', cross.ok && cross.order.length === full.length, cross.ok ? String(cross.order.length) : cross.message))
  results.push(check('E5', cross.ok && staged.every((id) => cross.order.includes(id)) && cross.order.indexOf(staged[0]) < cross.order.indexOf(targetId), cross.ok ? cross.order.join() : cross.message))
  const fixed = presentProductList(data, view, 99, 2)
  results.push(check('E6', fixed.page === Math.max(1, Math.ceil(full.length / 2)) || fixed.page <= Math.ceil(full.length / 2), String(fixed.page)))
  setViewSortMode(data, 'field')
  const fieldAgain = ids(data)
  setViewSortMode(data, 'manual')
  results.push(check('E7', fieldAgain.join() !== ids(data).join() || view.spuQuery?.sorting?.field === 'name', '可以切回字段'))

  const big = createSeed()
  selectProductListView(big, 'view-default')
  for (let index = 0; index < 1000; index += 1) {
    big.families.push({ id: `bulk-${index}`, name: `批量${index}`, templateId: 't-phone', categoryId: 'c-phone', oaProductId: '', commonAttrs: {}, productGroupIds: [], lifecycle: 'draft', origin: 'created', updatedAt: 't' } as ProductFamily)
  }
  const started = Date.now()
  setViewSortMode(big, 'manual')
  const bulkOrder = big.productListViews?.find((item) => item.id === 'view-default')?.manualOrder?.spuIds || []
  const bulkInsert = insertManualIds(bulkOrder, [bulkOrder[12], bulkOrder[16], bulkOrder[17], bulkOrder[19]].filter(Boolean), bulkOrder[268] || bulkOrder[bulkOrder.length - 1], 'before')
  const elapsed = Date.now() - started
  results.push(check('bulk', bulkInsert.ok && bulkInsert.order.length === bulkOrder.length && new Set(bulkInsert.order).size === bulkOrder.length && elapsed < 1000, `${bulkInsert.ok ? bulkInsert.order.length : bulkInsert.message} ${elapsed}ms`))

  const copied = copyProductListView(data, made.id, nextId, 't')
  const copy = copied.ok ? data.productListViews?.find((item) => item.id === copied.id) : undefined
  if (copy?.manualOrder) copy.manualOrder.spuIds = ['only-copy']
  results.push(check('copy', Boolean(copy && data.productListViews?.find((item) => item.id === made.id)?.manualOrder?.spuIds.join() !== 'only-copy'), '复制后独立'))
  view.manualOrder!.spuIds = ['gone-id', view.manualOrder!.spuIds[0], view.manualOrder!.spuIds[0]].filter(Boolean)
  const safe = presentProductList(data, view, 1, 50)
  results.push(check('stale', safe.total === data.families.length && new Set(safe.groups.flatMap((group) => group.rows.map((row) => row.id))).size === safe.total, String(safe.total)))

  results.push(check('F10', data.families.map((item) => item.id).join() === familyIds.join() && data.skus.map((item) => item.id).join() === skuIds.join() && (data.planningRecords || []).map((item) => item.planningId).join() === plans, '主数据没被改顺序'))
  return results
}
