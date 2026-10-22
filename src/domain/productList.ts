import { categoryPath, projectAttrs, shelfOf } from './logic'
import type { AppData, ListQuery, ProductFamily, ProductListMode, Sku } from './types'
import { isMaterialArchive, isRealSku } from './catalogIdentity'
export { isMaterialArchive, isRealSku } from './catalogIdentity'

/**
 * 商品列表只读适配。
 * Family 是已经在用的商品主体，所以 SPU 行就是 Family，不是商品模型。
 * 真实 SKU 包括历史规格及显式标记的新规格。MAT 与 PLN 都不作为 SKU。
 */

export interface SkuListRow {
  id: string
  familyId: string
  code: string
  name: string
  spec: string
  familyName: string
  category: string
  typeName: string
  modelName: string
  status: Sku['status']
  /** 所属 SPU 的物料数，不表示这条 SKU 与这些物料存在关联。 */
  materialCount: number
}

export function realSkusOf(data: AppData, familyId: string) {
  return data.skus.filter((item) => item.familyId === familyId && isRealSku(data, item))
}

export function materialArchivesOf(data: AppData, familyId: string) {
  return data.skus.filter((item) => item.familyId === familyId && isMaterialArchive(data, item))
}

export function familyBrandValues(data: AppData, family: ProductFamily) {
  const param = data.params.find((item) => item.id === 'p-brand')
  const key = param?.name || ''
  const saved = key ? (family.commonAttrs[key] || '').trim() : (family.commonAttrs['品牌'] || '').trim()
  if (saved) return [saved]
  if (family.line !== 'v3' || !param) return []
  const found = new Set<string>()
  materialArchivesOf(data, family.id).forEach((sku) => {
    const record = (data.planningRecords || []).find((item) => item.planningId && item.planningId === sku.planningId && item.origin !== 'temporary')
    const step = record?.steps.find((item) => item.attributeId === param.id && item.valueId.trim())
    const versionId = (sku.modelVersionId || record?.originModelVersionId || '').trim()
    const published = versionId ? data.specModelVersions.some((item) => item.id === versionId && item.status === 'published') : false
    if (!published) return
    if (step) {
      found.add(step.valueId.trim())
      return
    }
    const filed = key ? (sku.variantAttrs[key] || '').trim() : ''
    if (filed) found.add(filed)
  })
  return [...found].sort((left, right) => left.localeCompare(right, 'zh'))
}

export function familyBrandText(data: AppData, family: ProductFamily) {
  const values = familyBrandValues(data, family)
  return values.length ? values.join('、') : '未记录'
}

export function productTypeName(data: AppData, family: ProductFamily) {
  if (!family.productTypeId) return '未记录'
  return data.productTypes.find((item) => item.id === family.productTypeId)?.name || '未记录'
}

export function linkedModelName(data: AppData, family: ProductFamily) {
  const canvas = data.specCanvases.find((item) => item.templateId === family.templateId)
  const named = (canvas?.name || '').trim()
  if (named) return named
  return (data.templates.find((item) => item.id === family.templateId)?.name || '').trim() || '未关联'
}

/** 编号只用已保存的 code。没有 code 时用记录 id，不新编一个号。 */
export function savedSkuCode(sku: Sku) {
  return (sku.code || '').trim() || sku.id
}

/** 名称只用已保存的 skuName 或规格取值，不读取商品名称。 */
export function savedSkuName(sku: Sku) {
  const named = (sku.skuName || '').trim()
  if (named) return named
  const parts = Object.values(sku.variantAttrs).map((item) => item.trim()).filter(Boolean)
  return parts.join(' / ') || '未命名规格'
}

/** 完整规格只用商品公共属性和 SKU 上已保存的规格值。 */
export function savedSkuSpec(family: ProductFamily, sku: Sku) {
  const parts = Object.entries(projectAttrs(family, sku))
    .filter(([, value]) => value.trim())
    .map(([name, value]) => `${name} ${value}`)
  return parts.join(' · ') || '未保存规格'
}

export function skuCountText(count: number) {
  return count > 0 ? String(count) : '未建立'
}

export function normalizeListMode(value: unknown): ProductListMode {
  return value === 'sku' ? 'sku' : 'spu'
}

export function clampPage(page: number, total: number, pageSize: number) {
  const size = pageSize > 0 ? pageSize : 10
  const pages = Math.max(1, Math.ceil(total / size))
  const current = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
  return Math.min(current, pages)
}

export function slicePage<T>(rows: T[], page: number, pageSize: number) {
  const size = pageSize > 0 ? pageSize : 10
  const safe = clampPage(page, rows.length, size)
  const start = (safe - 1) * size
  return { page: safe, rows: rows.slice(start, start + size) }
}

function familyContextMatch(data: AppData, family: ProductFamily, query: ListQuery) {
  if (query.categoryId && family.categoryId !== query.categoryId) return false
  if (query.shelf && shelfOf(family) !== query.shelf) return false
  const created = (family.createdAt || family.updatedAt).slice(0, 10)
  if (query.createdFrom && created < query.createdFrom) return false
  if (query.createdTo && created > query.createdTo) return false
  if (query.brand && !familyBrandValues(data, family).includes(query.brand)) return false
  if (query.templateId && family.templateId !== query.templateId) return false
  if (query.productGroupId && !(family.productGroupIds || []).includes(query.productGroupId)) return false
  return true
}

function keywordHit(query: ListQuery, text: string) {
  const keyword = query.keyword.trim().toLowerCase()
  if (!keyword) return true
  return text.toLowerCase().includes(keyword)
}

export function skuListText(family: ProductFamily, sku: Sku) {
  const spec = Object.entries(projectAttrs(family, sku)).map(([name, value]) => `${name}${value}`).join(' ')
  return [sku.id, sku.code, sku.oaSkuId, sku.skuName, spec, savedSkuSpec(family, sku)].join(' ')
}

function materialSearchText(sku: Sku) {
  return [sku.materialCode, sku.skuName, sku.planningId, sku.supplierCode, sku.guanjiapoCode, sku.materialDescription].join(' ')
}

export function familyListText(data: AppData, family: ProductFamily) {
  const real = realSkusOf(data, family.id).map((sku) => skuListText(family, sku)).join(' ')
  const materials = materialArchivesOf(data, family.id).map((sku) => materialSearchText(sku)).join(' ')
  const brand = familyBrandValues(data, family).join(' ')
  return `${family.name} ${categoryPath(data, family.categoryId)} ${family.oaProductId} ${brand} ${real} ${materials}`
}

function attrMatch(query: ListQuery, family: ProductFamily, skus: Sku[]) {
  return Object.entries(query.attrFilters || {}).every(([name, value]) => {
    if (!value) return true
    return skus.some((sku) => projectAttrs(family, sku)[name] === value)
  })
}

function compareText(query: ListQuery, leftName: string, leftTime: string, rightName: string, rightTime: string) {
  const order = query.sortOrder === 'ascending' ? 1 : -1
  const left = query.sortProp === 'name' ? leftName : leftTime
  const right = query.sortProp === 'name' ? rightName : rightTime
  return left > right ? order : left < right ? -order : 0
}

export function listFamilies(data: AppData, query: ListQuery) {
  const rows = data.families.filter((family) => {
    const skus = realSkusOf(data, family.id)
    if (!familyContextMatch(data, family, query)) return false
    if (!keywordHit(query, familyListText(data, family))) return false
    if (query.status && !skus.some((sku) => sku.status === query.status)) return false
    return attrMatch(query, family, skus)
  })
  return rows.slice().sort((left, right) => compareText(query, left.name, left.updatedAt, right.name, right.updatedAt))
}

export function listRealSkuRows(data: AppData, query: ListQuery): SkuListRow[] {
  const rows = data.skus.flatMap((sku) => {
    if (!isRealSku(data, sku)) return []
    const family = data.families.find((item) => item.id === sku.familyId)
    if (!family) return []
    if (!familyContextMatch(data, family, query)) return []
    if (query.status && sku.status !== query.status) return []
    if (!attrMatch(query, family, [sku])) return []
    const spec = savedSkuSpec(family, sku)
    const text = `${family.name} ${categoryPath(data, family.categoryId)} ${familyBrandValues(data, family).join(' ')} ${skuListText(family, sku)}`
    if (!keywordHit(query, text)) return []
    return [{
      id: sku.id,
      familyId: family.id,
      code: savedSkuCode(sku),
      name: savedSkuName(sku),
      spec,
      familyName: family.name,
      category: categoryPath(data, family.categoryId),
      typeName: productTypeName(data, family),
      modelName: linkedModelName(data, family),
      status: sku.status,
      materialCount: materialArchivesOf(data, family.id).length,
    }]
  })
  return rows.sort((left, right) => {
    const leftFamily = data.families.find((item) => item.id === left.familyId)
    const rightFamily = data.families.find((item) => item.id === right.familyId)
    const compared = compareText(query, left.familyName, leftFamily?.updatedAt || '', right.familyName, rightFamily?.updatedAt || '')
    return compared || left.id.localeCompare(right.id, 'zh')
  })
}

export function spuEmptyText(query: ListQuery, totalFamilies: number) {
  if (totalFamilies === 0) return '当前没有商品。'
  return queryHasFilter(query) ? '没有符合条件的商品。' : '当前没有商品。'
}

export function skuEmptyText(query: ListQuery, totalRealSkus: number) {
  if (totalRealSkus === 0) return '当前没有真实 SKU。已有商品、规划组合和物料不会显示成 SKU。'
  return queryHasFilter(query) ? '没有符合条件的真实 SKU。' : '当前没有真实 SKU。'
}

function queryHasFilter(query: ListQuery) {
  if (query.keyword.trim()) return true
  if (query.categoryId || query.brand || query.status || query.templateId || query.productGroupId) return true
  if (query.createdFrom || query.createdTo || query.shelf) return true
  return Object.values(query.attrFilters || {}).some(Boolean)
}
