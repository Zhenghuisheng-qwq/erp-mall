import { isRealSku } from './catalogIdentity'
import { planScopedManualOrder, resolveManualOrder } from './productListManual'
import { modeQuery, presentProductList, unfilteredIds } from './productListQuery'
import { configFromLegacy, SYSTEM_SKU_VIEW_ID } from './skuWorkbenchState'
import { querySkuWorkbench } from './skuWorkbenchQuery'
import type { AppData, ProductListMode, ProductListPageState } from './types'

/** An operation intent, not a second saved order or a business-data snapshot. */
export interface ListManualGuard {
  viewId: string
  configStamp: string
  search: string
  scopeId: string
  sourceIds: string[]
  targetId?: string
  place?: 'before' | 'after'
  edge?: 'top' | 'bottom'
  matchedIds: string[]
  groupKeys: Record<string, string>
  now?: string
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Re-query the real catalog inside the persistence lock, then verify the proposed order. */
export function validateListManualCommit(data: AppData, mode: ProductListMode, next: ProductListPageState, guard: ListManualGuard): string {
  if (!guard || typeof guard !== 'object' || typeof guard.viewId !== 'string' || typeof guard.configStamp !== 'string' || typeof guard.search !== 'string' || typeof guard.scopeId !== 'string'
    || !Array.isArray(guard.sourceIds) || !guard.sourceIds.length || guard.sourceIds.some(id => typeof id !== 'string' || !id)
    || !Array.isArray(guard.matchedIds) || guard.matchedIds.some(id => typeof id !== 'string') || !guard.groupKeys || typeof guard.groupKeys !== 'object' || Array.isArray(guard.groupKeys)
    || guard.edge !== undefined && !['top', 'bottom'].includes(guard.edge) || guard.place !== undefined && !['before', 'after'].includes(guard.place)
    || guard.targetId !== undefined && typeof guard.targetId !== 'string') return '排序操作上下文无效，本批没有提交。'
  const page = data.productListPages?.[mode]
  const view = page?.views.find(item => item.id === guard.viewId)
  if (!page || !view) return '当前排序视图已经不存在，本批没有提交；排序暂存保留。'
  let allIds: string[], groupKeys: Record<string, string>, order: string[], proposed: string[]
  if (mode === 'spu') {
    if (page.activeId !== view.id || guard.configStamp !== JSON.stringify(view)) return '当前视图或排序设置已变化，请重新核对；排序暂存保留。'
    if (modeQuery(view, 'spu').sortMode !== 'manual') return '请先切换手工排序；未修改已保存的字段排序规则。'
    const scoped = guard.scopeId ? { ...data, families: data.families.filter(item => item.id === guard.scopeId) } : data
    const result = presentProductList(scoped, view, 1, Number.MAX_SAFE_INTEGER)
    if (result.errors.length) return result.errors.join('；')
    allIds = result.allIds; groupKeys = result.groupKeys
    order = resolveManualOrder(view.manualOrder?.spuIds, unfilteredIds(data, view, 'spu'))
    proposed = next.views.find(item => item.id === view.id)?.manualOrder?.spuIds ?? []
  } else {
    const key = view.id === SYSTEM_SKU_VIEW_ID && guard.scopeId ? `${view.id}@spu:${guard.scopeId}` : view.id
    const config = page.skuWorkbench?.working[key] ?? configFromLegacy(view, data)
    if (guard.configStamp !== JSON.stringify(config)) return 'SKU 工作配置已变化，请重新核对；排序暂存保留。'
    if (config.sortMode !== 'manual') return '请先切换手工排序；未修改已保存的字段排序规则。'
    const result = querySkuWorkbench(data, config, { scopeId: guard.scopeId, search: guard.search, now: guard.now })
    if (result.errors.length) return result.errors.join('；')
    allIds = result.allIds; groupKeys = result.groupKeys
    order = resolveManualOrder(config.manualOrder, data.skus.filter(item => isRealSku(data, item)).map(item => item.id))
    proposed = next.skuWorkbench?.working[key]?.manualOrder ?? []
  }
  if (!same(allIds, guard.matchedIds) || allIds.some(id => groupKeys[id] !== guard.groupKeys[id])) return '匹配结果或分组已变化，本批未提交；请按当前结果重新核对，排序暂存保留。'
  const plan = planScopedManualOrder({ order, matchedIds: allIds, groupKeys, movingIds: guard.sourceIds, targetId: guard.targetId, place: guard.edge ?? guard.place ?? 'before' })
  if (!plan.ok) return plan.message
  if (!same(plan.order, proposed)) return '待保存顺序与本次排序操作不一致，本批没有提交。'
  return ''
}
