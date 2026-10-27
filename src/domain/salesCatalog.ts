import type { AppData, ProductFamily } from './types'

/** 销售选购认的模型：商品上的模型编号，没有时用属性方案编号。 */
export function salesCatalogModelId(family: ProductFamily) {
  return family.productModelId || family.templateId || ''
}

/** 产品类型只认商品或模型画布上的真实编号，不从分类名称或路径猜测。 */
export function salesCatalogTypeId(data: AppData, family: ProductFamily) {
  if (family.productTypeId) return family.productTypeId
  const modelId = salesCatalogModelId(family)
  return data.specCanvases.find(item => item.templateId === modelId)?.productTypeId || ''
}

/** 分类、产品类型、模型三者都存在，且类型就挂在这个分类上，才进入销售选购。 */
export function salesCatalogReady(data: AppData, family: ProductFamily) {
  if (!family.categoryId || !data.categories.some(item => item.id === family.categoryId)) return false
  const modelId = salesCatalogModelId(family)
  if (!modelId || (!data.templates.some(item => item.id === modelId) && !data.specCanvases.some(item => item.templateId === modelId))) return false
  const type = data.productTypes.find(item => item.id === salesCatalogTypeId(data, family))
  return !!type && type.categoryId === family.categoryId
}
