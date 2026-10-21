import { normalizeStored } from '../stores/catalog'
import { presentProductList, resolveCategoryFilter } from './productListQuery'
import { copyProductListView, createProductListView, selectProductListView, setViewCategoryLayout, setViewFieldValues } from './productListViews'
import { createSeed } from './seed'
import type { AppData } from './types'

export interface CheckResult { id: string; ok: boolean; detail: string }
function check(id: string, ok: boolean, detail: string): CheckResult {
  return { id, ok, detail }
}
function ids(data: AppData) {
  const view = data.productListViews?.find((item) => item.id === data.activeProductListViewId)
  if (!view) return []
  return presentProductList(data, view, 1, 50).groups.flatMap((group) => group.rows.map((row) => row.id))
}
let seq = 0

export function runProductListCategoryChecks(): CheckResult[] {
  const results: CheckResult[] = []
  const data = createSeed()
  const before = data.families.map((item) => item.id).join()
  const viewA = createProductListView(data, '分类甲', 'view-default', () => `cat-${seq += 1}`, 't')
  const viewB = createProductListView(data, '分类乙', 'view-default', () => `cat-${seq += 1}`, 't')
  if (!viewA.ok || !viewB.ok) return [check('D', false, '视图没建成')]
  selectProductListView(data, viewA.id)
  setViewFieldValues(data, 'category', ['c-phone'])
  setViewCategoryLayout(data, 'sidebar')
  const phone = ids(data)
  results.push(check('A5', phone.includes('f-iphone') && !phone.includes('f-watch') && !phone.includes('f-pad'), phone.join()))
  setViewFieldValues(data, 'category', ['c-host'])
  const hostOnly = ids(data)
  results.push(check('exact', !hostOnly.includes('f-iphone') && !hostOnly.includes('f-watch'), hostOnly.join() || '空'))
  setViewFieldValues(data, 'category', [])
  results.push(check('A6', ids(data).length === data.families.length, String(ids(data).length)))
  setViewFieldValues(data, 'category', ['c-phone'])

  selectProductListView(data, viewB.id)
  setViewFieldValues(data, 'category', ['c-watch'])
  setViewCategoryLayout(data, 'popover')
  selectProductListView(data, viewA.id)
  const restored = data.productListViews?.find((item) => item.id === viewA.id)
  results.push(check('D1', restored?.spuQuery?.filters.some((item) => item.value === 'c-phone' || (Array.isArray(item.value) ? item.value.includes('c-phone') : false) || item.value === 'c-phone') || restored?.spuQuery?.filters.some((item) => item.field === 'category' && JSON.stringify(item.value).includes('c-phone')) === true, JSON.stringify(restored?.spuQuery?.filters)))
  results.push(check('D2', restored?.categoryFilterLayout === 'sidebar' && data.productListViews?.find((item) => item.id === viewB.id)?.categoryFilterLayout === 'popover', `${restored?.categoryFilterLayout}`))
  const loaded = normalizeStored({ version: 13, data: JSON.parse(JSON.stringify(data)) as AppData })
  results.push(check('D4', loaded?.productListViews?.find((item) => item.id === viewA.id)?.categoryFilterLayout === 'sidebar', loaded?.productListViews?.find((item) => item.id === viewA.id)?.categoryFilterLayout || ''))
  const copied = copyProductListView(data, viewA.id, () => `cat-${seq += 1}`, 't')
  const copy = copied.ok ? data.productListViews?.find((item) => item.id === copied.id) : undefined
  if (copy) copy.categoryFilterLayout = 'hidden'
  results.push(check('D5', Boolean(copy) && data.productListViews?.find((item) => item.id === viewA.id)?.categoryFilterLayout === 'sidebar', copy?.categoryFilterLayout || ''))
  const legacy = JSON.parse(JSON.stringify(createSeed())) as AppData
  delete legacy.productListViews?.[0].categoryFilterLayout
  legacy.productListViews![0].spuQuery!.filters = [{ id: 'old', field: 'category', operator: 'eq', value: '主机 / 手机' }]
  const migrated = normalizeStored({ version: 13, data: legacy })
  const legacyView = migrated?.productListViews?.[0]
  selectProductListView(migrated!, legacyView!.id)
  results.push(check('D8', legacyView?.categoryFilterLayout === 'popover' && ids(migrated!).includes('f-iphone') && !ids(migrated!).includes('f-watch'), ids(migrated!).join()))
  const resolved = resolveCategoryFilter(migrated!, ['c-missing', '主机 / 手机'])
  results.push(check('E8', resolved.ids.includes('c-phone') && resolved.missing.includes('c-missing') && !resolved.ids.includes('c-watch'), resolved.ids.join()))
  results.push(check('safe', before === data.families.map((item) => item.id).join(), '分类数据没被改'))
  return results
}
