import { isRealSku } from './catalogIdentity'
import { shelfOf } from './logic'
import type { AppData, ProductFamily, Sku } from './types'

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

/** Shared read-only admission for shopping, configuration preview, add and delivery checks. */
export function salesSkuAdmission(data: AppData, value: string | Sku): {allowed:boolean;reason:string} {
  const sku=typeof value==='string'?data.skus.find(item=>item.id===value):value
  if(!sku)return {allowed:false,reason:'实际销售 SKU 已不存在，请重新选择商品。'}
  if(!isRealSku(data,sku))return {allowed:false,reason:'此记录不是可选购的真实销售 SKU；SPU、PLN 和 MAT 不能直接加入权益包。'}
  const family=data.families.find(item=>item.id===sku.familyId)
  if(!family)return {allowed:false,reason:'销售 SKU 的商品资料已失效。'}
  if(sku.status!=='on_sale'||shelfOf(family)!=='online')return {allowed:false,reason:'商品或 SKU 当前不在售。'}
  if(!salesCatalogReady(data,family))return {allowed:false,reason:'商品分类、产品类型或模型归属未满足销售准入，请先维护对应商品资料。'}
  return {allowed:true,reason:''}
}

export function salesCatalogSkus(data: AppData) {
  return data.skus.filter(sku=>salesSkuAdmission(data,sku).allowed)
}
