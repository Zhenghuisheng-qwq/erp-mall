import { normalizeStored } from '../stores/catalog'
import { presentProductList } from './productListQuery'
import { applyPresetToActiveView, copyProductListView, createProductListView, deleteProductListView, selectProductListView, setViewExposed, setViewFieldValues, setViewGrouping, setViewSorting } from './productListViews'
import { createSeed, emptyQuery } from './seed'
import type { AppData } from './types'

export interface CheckResult { id: string; ok: boolean; detail: string }

function check(id: string, ok: boolean, detail: string): CheckResult {
  return { id, ok, detail }
}

function idsOf(data: AppData, page = 1, pageSize = 50) {
  const view = data.productListViews?.find((item) => item.id === data.activeProductListViewId)
  if (!view) return []
  return presentProductList(data, view, page, pageSize).groups.flatMap((group) => group.rows.map((row) => row.id))
}

let seq = 0
const nextId = () => `view-4c-${seq += 1}`

export function runProductListQueryChecks(): CheckResult[] {
  const results: CheckResult[] = []
  const data = createSeed()
  const familyOrder = data.families.map((item) => item.id).join()
  const skuOrder = data.skus.map((item) => item.id).join()
  const madeA = createProductListView(data, 'Apple 商品', 'view-default', nextId, 't')
  const madeB = createProductListView(data, '全部商品', 'view-default', nextId, 't')
  if (!madeA.ok || !madeB.ok) return [check('A', false, '视图没建成')]
  selectProductListView(data, madeA.id)
  setViewFieldValues(data, 'brand', ['Apple'])
  selectProductListView(data, madeB.id)
  const without = idsOf(data)
  selectProductListView(data, madeA.id)
  const withBrand = idsOf(data)
  setViewFieldValues(data, 'brand', ['不存在的品牌'])
  const changed = idsOf(data)
  selectProductListView(data, madeB.id)
  const other = idsOf(data)
  results.push(check('A1', withBrand.length > 0 && withBrand.every((id) => data.families.find((item) => item.id === id)?.commonAttrs['品牌'] === 'Apple'), String(withBrand.length)))
  results.push(check('A2', without.length > withBrand.length || without.length === data.families.length, String(without.length)))
  results.push(check('A3', withBrand.length !== changed.length, `${withBrand.length}/${changed.length}`))
  results.push(check('A4', other.join() === without.join(), other.join()))
  const stored = JSON.parse(JSON.stringify(data)) as AppData
  const loaded = normalizeStored({ version: 13, data: stored })
  const kept = loaded?.productListViews?.find((item) => item.id === madeB.id)
  results.push(check('A5', Boolean(kept && !kept.spuQuery?.filters.some((item) => item.field === 'brand')), String(kept?.spuQuery?.filters.length || 0)))
  selectProductListView(data, madeA.id)
  const copied = copyProductListView(data, madeA.id, nextId, 't')
  const copy = copied.ok ? data.productListViews?.find((item) => item.id === copied.id) : undefined
  results.push(check('A6', Boolean(copy && copy.spuQuery?.filters.some((item) => item.value === '不存在的品牌')), copy?.id || ''))
  const beforeDelete = data.families.length
  if (copied.ok) deleteProductListView(data, copied.id)
  results.push(check('A7', data.families.length === beforeDelete && data.families.map((item) => item.id).join() === familyOrder, String(data.families.length)))
  const columnsBefore = JSON.stringify(data.productListViews?.find((item) => item.id === madeB.id)?.spuColumns)
  const groupingBefore = data.productListViews?.find((item) => item.id === madeB.id)?.spuQuery?.grouping
  selectProductListView(data, madeB.id)
  setViewSorting(data, { field: 'name', direction: 'asc' })
  setViewGrouping(data, { field: 'category', direction: 'asc' })
  const preset = emptyQuery()
  preset.brand = 'Apple'
  applyPresetToActiveView(data, { query: preset })
  const afterPreset = data.productListViews?.find((item) => item.id === madeB.id)
  const modeKept = afterPreset?.mode === 'spu'
  const columnsKept = JSON.stringify(afterPreset?.spuColumns) === columnsBefore
  const sortKept = afterPreset?.spuQuery?.sorting?.field === 'name'
  const groupKept = JSON.stringify(afterPreset?.spuQuery?.grouping) !== JSON.stringify(groupingBefore) && afterPreset?.spuQuery?.grouping?.field === 'category'
  const brandApplied = afterPreset?.spuQuery?.filters.some((item) => item.field === 'brand' && item.value === 'Apple')
  const otherUntouched = data.productListViews?.find((item) => item.id === madeA.id)?.spuQuery?.filters.some((item) => item.value === '不存在的品牌')
  results.push(check('A8', Boolean(modeKept && columnsKept && sortKept && groupKept && brandApplied && otherUntouched), `模式 ${modeKept} 列 ${columnsKept} 排序 ${sortKept} 分组 ${groupKept} 品牌 ${brandApplied}`))

  selectProductListView(data, madeB.id)
  setViewFieldValues(data, 'brand', ['Apple'])
  setViewFieldValues(data, 'shelf', ['已发布'])
  const online = idsOf(data)
  const offlineFamily = data.families.find((item) => item.id === 'f-film')
  if (offlineFamily) offlineFamily.shelfStatus = 'offline'
  const withoutOffline = idsOf(data)
  results.push(check('B1', online.includes('f-film') && !withoutOffline.includes('f-film') && withoutOffline.includes('f-iphone'), withoutOffline.join()))
  if (offlineFamily) offlineFamily.shelfStatus = 'online'
  const color = data.params.find((item) => item.name === '颜色')
  selectProductListView(data, madeA.id)
  data.productListViews!.find((item) => item.id === madeA.id)!.mode = 'sku'
  const query = data.productListViews!.find((item) => item.id === madeA.id)!.skuQuery!
  query.filters = [{ id: 'color', field: `attr:${color?.id}`, operator: 'in', value: ['黑色', '白色'] }]
  const colored = presentProductList(data, data.productListViews!.find((item) => item.id === madeA.id)!, 1, 50)
  const coloredIds = colored.groups.flatMap((group) => group.rows.map((row) => row.id))
  results.push(check('B2', coloredIds.includes('s-iphone-white') && coloredIds.includes('s-watch-1') && !coloredIds.includes('s-iphone-blue') && !coloredIds.includes('s-pad-1'), coloredIds.join()))
  results.push(check('B3', colored.groups.every((group) => group.rows.every((row) => row.sku && (row.sku.variantAttrs['颜色'] === '黑色' || row.sku.variantAttrs['颜色'] === '白色' || row.family.commonAttrs['颜色'] === '黑色' || row.family.commonAttrs['颜色'] === '白色'))), '逐条核对'))
  selectProductListView(data, madeB.id)
  const spuQuery = data.productListViews!.find((item) => item.id === madeB.id)!.spuQuery!
  spuQuery.filters = [{ id: 'color', field: `attr:${color?.id}`, operator: 'eq', value: '蓝色' }]
  data.families.unshift({ id: 'fam-mat', name: '物料款', templateId: 't-phone', categoryId: 'c-phone', line: 'v3', oaProductId: '', commonAttrs: { 品牌: 'Apple' }, productGroupIds: [], lifecycle: 'draft', origin: 'created', updatedAt: 't' })
  data.skus.push({ id: 'mat-blue', familyId: 'fam-mat', code: '', oaSkuId: '', status: 'draft', variantAttrs: { 颜色: '蓝色' }, projectedAttrs: {}, materialCode: 'MAT-BLUE', planningId: 'PLN-BLUE' })
  const spuBlue = idsOf(data)
  results.push(check('B4', spuBlue.includes('f-iphone') && spuBlue.includes('f-pad') && !spuBlue.includes('fam-mat'), spuBlue.join()))
  spuQuery.filters = [{ id: 'brand', field: 'brand', operator: 'eq', value: '没有这个品牌' }]
  const empty = presentProductList(data, data.productListViews!.find((item) => item.id === madeB.id)!, 1, 10)
  results.push(check('B5', empty.total === 0 && empty.groups.every((group) => group.rows.length === 0), String(empty.total)))
  data.productListViews!.find((item) => item.id === madeA.id)!.mode = 'sku'
  const skuAll = presentProductList(data, data.productListViews!.find((item) => item.id === madeA.id)!, 1, 50)
  const skuIds = skuAll.groups.flatMap((group) => group.rows.map((row) => row.id))
  results.push(check('B6', !skuIds.includes('mat-blue') && !skuIds.some((id) => id.includes('PLN')), skuIds.join()))
  data.listQuery.page = 4
  selectProductListView(data, madeB.id)
  setViewFieldValues(data, 'brand', ['Apple'])
  results.push(check('B7', data.listQuery.page === 1, String(data.listQuery.page)))

  const exposedView = data.productListViews!.find((item) => item.id === madeB.id)!
  setViewExposed(data, 'brand', true)
  results.push(check('C1', exposedView.spuQuery?.exposed.includes('brand') === true, (exposedView.spuQuery?.exposed || []).join()))
  setViewFieldValues(data, 'brand', ['Apple'])
  results.push(check('C2', idsOf(data).every((id) => id !== 'fam-mat' || data.families.find((item) => item.id === id)?.commonAttrs['品牌'] === 'Apple'), idsOf(data).join()))
  results.push(check('C3', exposedView.spuQuery?.filters.some((item) => item.field === 'brand' && item.value === 'Apple') === true, '同一份条件'))
  setViewExposed(data, 'brand', false)
  results.push(check('C4', Boolean(exposedView.spuQuery && !exposedView.spuQuery.exposed.includes('brand') && exposedView.spuQuery.filters.some((item) => item.field === 'brand')), '条件还在'))
  selectProductListView(data, madeA.id)
  results.push(check('C5', data.productListViews?.find((item) => item.id === madeA.id)?.skuQuery?.exposed.includes('brand') === true && data.productListViews?.find((item) => item.id === madeB.id)?.spuQuery?.exposed.includes('brand') === false, '外露隔离'))
  const again = JSON.parse(JSON.stringify(data)) as AppData
  const restored = normalizeStored({ version: 13, data: again })
  results.push(check('C6', restored?.productListViews?.find((item) => item.id === madeB.id)?.spuQuery?.filters.some((item) => item.field === 'brand' && item.value === 'Apple') === true, '刷新后还在'))

  selectProductListView(data, madeB.id)
  exposedView.spuQuery!.filters = []
  setViewGrouping(data, { field: 'category', direction: 'asc' })
  const grouped = presentProductList(data, exposedView, 1, 50)
  const phone = grouped.groups.find((group) => group.label.includes('手机') && !group.label.includes('配件'))
  results.push(check('D1', grouped.groups.some((group) => group.label.includes('手机')), grouped.groups.map((group) => group.label).join(' | ')))
  setViewGrouping(data, { field: 'brand', direction: 'asc' })
  const byBrand = presentProductList(data, exposedView, 1, 50)
  results.push(check('D2', byBrand.groups.some((group) => group.label === 'Apple'), byBrand.groups.map((group) => `${group.label}:${group.total}`).join(' | ')))
  setViewGrouping(data, { field: 'category', direction: 'asc' })
  results.push(check('D3', Boolean(phone && phone.rows.some((row) => row.id === 'f-iphone')), phone?.rows.map((row) => row.id).join() || ''))
  results.push(check('D4', Boolean(phone && phone.total === phone.rows.length), String(phone?.total || 0)))
  results.push(check('D5', grouped.groups.length > 1, '可按组展示'))
  setViewGrouping(data, null)
  const cleared = presentProductList(data, exposedView, 1, 50)
  results.push(check('D6', cleared.groups.length === 1 && cleared.groups[0].label === '', '已清除'))
  setViewGrouping(data, { field: 'category', direction: 'asc' })
  selectProductListView(data, madeA.id)
  results.push(check('D7', data.productListViews?.find((item) => item.id === madeA.id)?.skuQuery?.grouping == null && exposedView.spuQuery?.grouping?.field === 'category', '分组隔离'))
  const savedGroup = JSON.parse(JSON.stringify(data)) as AppData
  const groupLoaded = normalizeStored({ version: 13, data: savedGroup })
  results.push(check('D8', groupLoaded?.productListViews?.find((item) => item.id === madeB.id)?.spuQuery?.grouping?.field === 'category', '分组还在'))
  const pages = [1, 2, 3, 4].flatMap((page) => presentProductList(data, exposedView, page, 2).groups.flatMap((group) => group.rows.map((row) => row.id)))
  const full = presentProductList(data, exposedView, 1, 50).groups.flatMap((group) => group.rows.map((row) => row.id))
  results.push(check('D9', pages.length === full.length && new Set(pages).size === pages.length && pages.slice().sort().join() === full.slice().sort().join(), `${pages.length}/${full.length}`))
  data.families.push({ id: 'fam-blank', name: '无品牌', templateId: 't-phone', categoryId: '', oaProductId: '', commonAttrs: {}, productGroupIds: [], lifecycle: 'draft', origin: 'created', updatedAt: 't' })
  setViewGrouping(data, { field: 'brand', direction: 'asc' })
  const blank = presentProductList(data, exposedView, 1, 50).groups.find((group) => group.rows.some((row) => row.id === 'fam-blank'))
  results.push(check('D10', blank?.label === '未记录', blank?.label || ''))

  selectProductListView(data, madeB.id)
  data.productListViews!.find((item) => item.id === madeB.id)!.mode = 'spu'
  exposedView.spuQuery!.filters = []
  setViewGrouping(data, null)
  setViewSorting(data, { field: 'name', direction: 'asc' })
  const asc = idsOf(data)
  const ascNames = asc.map((id) => data.families.find((item) => item.id === id)?.name || '')
  setViewSorting(data, { field: 'name', direction: 'desc' })
  const desc = idsOf(data)
  results.push(check('E1', ascNames.join() === ascNames.slice().sort((a, b) => a.localeCompare(b, 'zh')).join(), ascNames.join('|')))
  results.push(check('E2', desc[0] === asc[asc.length - 1], desc.map((id) => data.families.find((item) => item.id === id)?.name).join('|')))
  setViewSorting(data, { field: 'created', direction: 'asc' })
  const byDate = idsOf(data)
  results.push(check('E3', byDate.length === asc.length, byDate.join()))
  setViewSorting(data, null)
  const clearedSort = idsOf(data)
  results.push(check('E4', clearedSort.length === asc.length, '已清除'))
  const page2 = presentProductList(data, exposedView, 2, 2).groups.flatMap((group) => group.rows.map((row) => row.id))
  setViewSorting(data, { field: 'name', direction: 'asc' })
  const sortedPage = presentProductList(data, exposedView, 2, 2).groups.flatMap((group) => group.rows.map((row) => row.id))
  results.push(check('E5', sortedPage.length > 0 && sortedPage.join() !== page2.join(), sortedPage.join()))
  data.families.push({ id: 'fam-z2', name: '同名商品', templateId: 't-phone', categoryId: 'c-phone', oaProductId: '', commonAttrs: { 品牌: 'Apple' }, productGroupIds: [], lifecycle: 'draft', origin: 'created', updatedAt: 't' })
  data.families.push({ id: 'fam-z1', name: '同名商品', templateId: 't-phone', categoryId: 'c-phone', oaProductId: '', commonAttrs: { 品牌: 'Apple' }, productGroupIds: [], lifecycle: 'draft', origin: 'created', updatedAt: 't' })
  const tied = idsOf(data)
  const tieAt = tied.filter((id) => data.families.find((item) => item.id === id)?.name === '同名商品')
  results.push(check('E6', tieAt.join() === 'fam-z1,fam-z2', tieAt.join()))
  selectProductListView(data, madeA.id)
  results.push(check('E7', data.productListViews?.find((item) => item.id === madeA.id)?.skuQuery?.sorting == null && exposedView.spuQuery?.sorting?.field === 'name', '排序隔离'))
  const sortSaved = JSON.parse(JSON.stringify(data)) as AppData
  const sortLoaded = normalizeStored({ version: 13, data: sortSaved })
  results.push(check('E8', sortLoaded?.productListViews?.find((item) => item.id === madeB.id)?.spuQuery?.sorting?.direction === 'asc', '排序还在'))
  const originalIds = familyOrder.split(',')
  const stillInOrder = data.families.map((item) => item.id).filter((id) => originalIds.includes(id)).join() === familyOrder
  results.push(check('E9', stillInOrder && data.skus.map((item) => item.id).join() === `${skuOrder},mat-blue`, '原数组顺序未被排序改写'))
  setViewSorting(data, { field: 'name', direction: 'asc' })
  selectProductListView(data, madeB.id)
  setViewGrouping(data, { field: 'brand', direction: 'asc' })
  const inner = presentProductList(data, exposedView, 1, 50).groups.find((group) => group.label === 'Apple')
  const innerNames = inner?.rows.map((row) => row.family.name) || []
  results.push(check('E10', innerNames.join() === innerNames.slice().sort((a, b) => a.localeCompare(b, 'zh')).join(), innerNames.join('|')))
  return results
}
