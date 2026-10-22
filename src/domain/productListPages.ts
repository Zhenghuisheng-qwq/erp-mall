import { ensureProductListViews } from './productListViews'
import { emptyQuery } from './seed'
import { ensureSkuWorkbench } from './skuWorkbenchState'
import type { AppData, ProductListMode, ProductListPageState } from './types'

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value))

/** 一次兼容迁移保留每个旧视图的两套设置；不依赖当时激活的是哪种模式。 */
export function ensureProductListPages(data: AppData) {
  if (data.productListPages?.spu && data.productListPages.sku) {
    const spu = ensureProductListViews(productListPageData(data, 'spu'))
    const sku = ensureProductListViews(productListPageData(data, 'sku'))
    const workbench = ensureSkuWorkbench(data)
    return spu || sku || workbench
  }
  ensureProductListViews(data)
  const page = (mode: ProductListMode): ProductListPageState => ({
    views: (data.productListViews || []).map(view => ({ ...copy(view), mode })),
    activeId: data.activeProductListViewId || 'view-default',
    query: copy(data.listQuery || emptyQuery()),
    presets: copy(data.listViews || []),
    activePresetId: data.activeViewId || '',
  })
  data.productListPages = { spu: data.productListPages?.spu || page('spu'), sku: data.productListPages?.sku || page('sku') }
  ensureSkuWorkbench(data)
  return true
}

/**
 * 给既有视图命令提供本页的设置引用。没有同步 watch，也不复制业务记录。
 * 只有这里列出的偏好字段可写；业务数据仍由原 store 的命令负责。
 */
export function productListPageData(data: AppData, mode: ProductListMode, temporary?: ProductListPageState): AppData {
  const page = temporary || data.productListPages?.[mode]
  if (!page) throw new Error('商品列表页面设置尚未初始化')
  return {
    ...data,
    get productListViews() { return page.views },
    set productListViews(value) { page.views = value || [] },
    get activeProductListViewId() { return page.activeId },
    set activeProductListViewId(value) { page.activeId = value || 'view-default' },
    get listQuery() { return page.query },
    set listQuery(value) { page.query = value },
    get listViews() { return page.presets },
    set listViews(value) { page.presets = value },
    get activeViewId() { return page.activePresetId },
    set activeViewId(value) { page.activePresetId = value },
    productListMode: mode,
  }
}
