import { normalizeStored } from '../stores/catalog'
import { listRealSkuRows, realSkusOf } from './productList'
import { DEFAULT_PRODUCT_LIST_VIEW_ID, columnLabel, copyProductListView, createProductListView, deleteProductListView, ensureProductListViews, renameProductListView, reorderProductListColumn, selectProductListView, setProductListColumnVisible, setProductListViewMode, visibleColumns } from './productListViews'
import { createSeed, defaultColumns } from './seed'
import type { AppData } from './types'

export interface CheckResult { id: string; ok: boolean; detail: string }

function check(id: string, ok: boolean, detail: string): CheckResult {
  return { id, ok, detail }
}

function business(data: AppData) {
  return JSON.stringify({
    families: data.families.map((item) => item.id),
    skus: data.skus.map((item) => `${item.id}:${item.familyId}:${item.materialCode || ''}:${item.planningId || ''}`),
    plans: (data.planningRecords || []).map((item) => item.planningId),
    receipts: (data.materialReceipts || []).map((item) => `${item.skuId}:${item.materialCode}`),
  })
}

let seq = 0
const nextId = () => `view-test-${seq += 1}`

export function runProductListViewChecks(): CheckResult[] {
  const results: CheckResult[] = []
  const data = createSeed()
  const before = business(data)
  const first = ensureProductListViews(data, '2026-10-20T00:00:00.000Z')
  const second = ensureProductListViews(data, '2026-10-20T00:00:00.000Z')
  const defaults = (data.productListViews || []).filter((item) => item.id === DEFAULT_PRODUCT_LIST_VIEW_ID)
  results.push(check('A1', defaults.length === 1 && data.activeProductListViewId === DEFAULT_PRODUCT_LIST_VIEW_ID && !first && !second, `默认 ${defaults.length} 再次补齐 ${second}`))

  const created = createProductListView(data, '商品总览', DEFAULT_PRODUCT_LIST_VIEW_ID, nextId, '2026-10-20T01:00:00.000Z')
  const detail = createProductListView(data, 'SKU 明细', DEFAULT_PRODUCT_LIST_VIEW_ID, nextId, '2026-10-20T01:00:00.000Z')
  results.push(check('A2', created.ok && data.productListViews?.some((item) => item.name === '商品总览') === true, created.ok ? created.id : created.message))
  results.push(check('A3', detail.ok && data.productListViews?.some((item) => item.name === 'SKU 明细') === true, detail.ok ? detail.id : detail.message))
  const overviewId = created.ok ? created.id : ''
  const detailId = detail.ok ? detail.id : ''
  const switched = selectProductListView(data, overviewId)
  const back = selectProductListView(data, detailId)
  results.push(check('A4', switched.ok && back.ok && data.activeProductListViewId === detailId, data.activeProductListViewId || ''))

  const idBefore = overviewId
  const renamed = renameProductListView(data, overviewId, '商品总览改名', '2026-10-20T02:00:00.000Z')
  const renamedView = data.productListViews?.find((item) => item.id === idBefore)
  results.push(check('A5', renamed.ok && renamedView?.id === idBefore && renamedView.name === '商品总览改名', renamedView?.name || ''))

  const copied = copyProductListView(data, detailId, nextId, '2026-10-20T03:00:00.000Z')
  const copyView = copied.ok ? data.productListViews?.find((item) => item.id === copied.id) : undefined
  const source = data.productListViews?.find((item) => item.id === detailId)
  results.push(check('A6', Boolean(copied.ok && copyView && source && copyView.id !== source.id && copyView.mode === source.mode && JSON.stringify(copyView.spuColumns) === JSON.stringify(source.spuColumns) && JSON.stringify(copyView.skuColumns) === JSON.stringify(source.skuColumns)), copied.ok ? copied.id : copied.message))

  const removed = copied.ok ? deleteProductListView(data, copied.id) : { ok: false as const, message: '没有副本' }
  const blocked = deleteProductListView(data, DEFAULT_PRODUCT_LIST_VIEW_ID)
  results.push(check('A7', removed.ok && data.productListViews?.some((item) => copied.ok && item.id === copied.id) === false, removed.ok ? '已删除' : removed.message))
  results.push(check('A8', !blocked.ok && blocked.message.includes('不能删除') && data.productListViews?.some((item) => item.id === DEFAULT_PRODUCT_LIST_VIEW_ID) === true, blocked.ok ? '被删了' : blocked.message))
  const blank = createProductListView(data, '  ', DEFAULT_PRODUCT_LIST_VIEW_ID, nextId)
  const duplicate = createProductListView(data, 'SKU 明细', DEFAULT_PRODUCT_LIST_VIEW_ID, nextId)
  const blankRename = renameProductListView(data, detailId, '')
  results.push(check('A9', !blank.ok && !duplicate.ok && !blankRename.ok, `${blank.ok ? '' : blank.message} / ${duplicate.ok ? '' : duplicate.message}`))

  setProductListViewMode(data, overviewId, 'spu')
  setProductListViewMode(data, detailId, 'sku')
  selectProductListView(data, overviewId)
  const modeOverview = data.productListViews?.find((item) => item.id === overviewId)?.mode
  selectProductListView(data, detailId)
  const modeDetail = data.productListViews?.find((item) => item.id === detailId)?.mode
  results.push(check('B1', modeOverview === 'spu', modeOverview || ''))
  results.push(check('B2', modeDetail === 'sku', modeDetail || ''))
  results.push(check('B3', data.activeProductListViewId === detailId && data.productListMode === 'sku', data.productListMode || ''))
  setProductListViewMode(data, detailId, 'spu')
  const overviewUntouched = data.productListViews?.find((item) => item.id === overviewId)?.mode === 'spu'
  setProductListViewMode(data, detailId, 'sku')
  results.push(check('B4', overviewUntouched && data.productListViews?.find((item) => item.id === overviewId)?.mode === 'spu', '总览仍是 SPU'))

  data.families.unshift({
    id: 'fam-4b', name: '只有物料', templateId: 't-phone', categoryId: 'c-phone', oaProductId: '', commonAttrs: {}, productGroupIds: [], lifecycle: 'draft', origin: 'created', updatedAt: '2026-10-20T00:00:00.000Z', line: 'v3',
  })
  data.skus.push(
    { id: 'mat-4b-1', familyId: 'fam-4b', code: '', oaSkuId: '', status: 'draft', variantAttrs: { 颜色: '黑色' }, projectedAttrs: {}, materialCode: 'MAT-4B-1', planningId: 'PLN-4B', skuName: '物料甲' },
    { id: 'mat-4b-2', familyId: 'fam-4b', code: '', oaSkuId: '', status: 'draft', variantAttrs: { 颜色: '白色' }, projectedAttrs: {}, materialCode: 'MAT-4B-2', planningId: 'PLN-4B', skuName: '物料乙' },
  )
  const skuRows = listRealSkuRows(data, data.listQuery)
  results.push(check('B5', skuRows.length === 10 && skuRows.every((item) => item.id !== 'mat-4b-1'), String(skuRows.length)))
  results.push(check('B6', !skuRows.some((item) => item.code.includes('MAT-') || item.spec.includes('PLN-')), '没有物料行'))
  results.push(check('B7', realSkusOf(data, 'fam-4b').length === 0, String(realSkusOf(data, 'fam-4b').length)))

  const hide = setProductListColumnVisible(data, overviewId, 'spu', 'brand', false)
  const hidden = visibleColumns(data.productListViews!.find((item) => item.id === overviewId)!, 'spu').map((item) => item.key)
  const show = setProductListColumnVisible(data, overviewId, 'spu', 'brand', true)
  const shown = visibleColumns(data.productListViews!.find((item) => item.id === overviewId)!, 'spu').map((item) => item.key)
  results.push(check('C1', hide.ok && !hidden.includes('brand'), hidden.join(',')))
  results.push(check('C2', show.ok && shown.includes('brand'), shown.join(',')))
  const beforeOrder = shown.join(',')
  const moved = reorderProductListColumn(data, overviewId, 'spu', 'brand', 'category')
  const afterOrder = visibleColumns(data.productListViews!.find((item) => item.id === overviewId)!, 'spu').map((item) => item.key)
  setProductListColumnVisible(data, overviewId, 'spu', 'brand', false)
  setProductListColumnVisible(data, overviewId, 'spu', 'brand', true)
  const restored = visibleColumns(data.productListViews!.find((item) => item.id === overviewId)!, 'spu').map((item) => item.key)
  results.push(check('C3', moved.ok && afterOrder.indexOf('brand') < afterOrder.indexOf('category') && afterOrder.join(',') !== beforeOrder, afterOrder.join(',')))
  results.push(check('C4', restored.join(',') === afterOrder.join(','), restored.join(',')))
  const other = visibleColumns(data.productListViews!.find((item) => item.id === detailId)!, 'spu').map((item) => item.key)
  results.push(check('C5', other.join(',') !== afterOrder.join(','), other.join(',')))
  const skuHeaders = visibleColumns(data.productListViews!.find((item) => item.id === detailId)!, 'sku').map((item) => item.label)
  const spuHeaders = visibleColumns(data.productListViews!.find((item) => item.id === overviewId)!, 'spu').map((item) => item.label)
  results.push(check('C6', skuHeaders.includes('SKU 编号') && !skuHeaders.includes('SKU 数量') && spuHeaders.includes('SKU 数量') && columnLabel('spu', 'skuCount') === 'SKU 数量', `${spuHeaders.join('|')} // ${skuHeaders.join('|')}`))
  const broken = data.productListViews!.find((item) => item.id === overviewId)!
  broken.spuColumns.push({ key: 'gone-field', visible: true, order: 50 })
  const safe = visibleColumns(broken, 'spu')
  results.push(check('C7', safe.every((item) => item.key !== 'gone-field') && safe.some((item) => item.key === 'name'), safe.map((item) => item.key).join(',')))

  const stored = JSON.parse(JSON.stringify(createSeed())) as AppData
  delete stored.productListViews
  delete stored.activeProductListViewId
  stored.productListMode = 'sku'
  stored.columns = defaultColumns().map((item) => (item.key === 'brand' ? { ...item, visible: false } : item))
  const loaded = normalizeStored({ version: 13, data: stored })
  const again = loaded ? ensureProductListViews(loaded, '2026-10-20T04:00:00.000Z') : true
  const loadedDefault = loaded?.productListViews?.filter((item) => item.id === DEFAULT_PRODUCT_LIST_VIEW_ID) || []
  const brandHidden = loadedDefault[0] ? visibleColumns(loadedDefault[0], 'spu').every((item) => item.key !== 'brand') : false
  results.push(check('D1', loadedDefault.length === 1, String(loaded?.productListViews?.length || 0)))
  results.push(check('D2', loaded?.activeProductListViewId === DEFAULT_PRODUCT_LIST_VIEW_ID, loaded?.activeProductListViewId || ''))
  results.push(check('D3', brandHidden && loadedDefault[0].spuColumns.some((item) => item.key === 'name' && item.visible), loadedDefault[0]?.spuColumns.map((item) => `${item.key}:${item.visible}`).join(',') || ''))
  results.push(check('D4', loadedDefault[0]?.mode === 'sku' && loaded?.productListMode === 'sku', loadedDefault[0]?.mode || ''))
  results.push(check('D5', loadedDefault.length === 1 && !again, `再次 ${again}`))
  const countBefore = loaded?.families.length || 0
  if (loaded && detailId) {
    const extra = createProductListView(loaded, '临时视图', DEFAULT_PRODUCT_LIST_VIEW_ID, nextId)
    if (extra.ok) deleteProductListView(loaded, extra.id)
  }
  results.push(check('D6', loaded?.families.length === countBefore, String(loaded?.families.length || 0)))
  results.push(check('D7', business(data) !== before && data.skus.filter((item) => item.id.startsWith('s-')).length === 10, '业务编号仍在'))

  const fresh = JSON.parse(JSON.stringify(createSeed())) as AppData
  fresh.productListViews = fresh.productListViews || []
  const custom = createProductListView(fresh, '保持选中', DEFAULT_PRODUCT_LIST_VIEW_ID, nextId)
  if (custom.ok) setProductListViewMode(fresh, custom.id, 'sku')
  fresh.productListMode = 'spu'
  ensureProductListViews(fresh, '2026-10-20T05:00:00.000Z')
  const keptId = custom.ok ? custom.id : ''
  const kept = fresh.productListViews?.find((item) => item.id === keptId)
  const modeAfter = String(fresh.productListMode)
  results.push(check('D8', Boolean(kept && fresh.activeProductListViewId === kept.id && kept.mode === 'sku' && modeAfter === 'sku'), `${fresh.activeProductListViewId} ${kept?.mode} ${modeAfter}`))

  const anchor = setProductListColumnVisible(data, overviewId, 'spu', 'name', false)
  results.push(check('E-name', !anchor.ok, anchor.ok ? '名称被隐藏' : anchor.message))
  return results
}
