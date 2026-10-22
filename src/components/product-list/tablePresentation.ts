import { categoryPath } from '../../domain/logic'
import { linkedModelName, productTypeName, savedSkuCode, savedSkuName, savedSkuSpec } from '../../domain/productList'
import type { SkuListRow } from '../../domain/productList'
import type { ProductListGroup } from '../../domain/productListQuery'
import type { AppData, ProductFamily } from '../../domain/types'

// Page-only values. Keep persisted records and their existing identities intact.
export type ProductListSkuRow = Omit<SkuListRow, 'materialCount'> & { updatedAt: string | undefined }
export interface ProductListTableGroup {
  key: string
  label: string
  total: number
  families: ProductFamily[]
  skus: ProductListSkuRow[]
}

/** Adapt already queried rows; filtering, ordering and paging belong to the query engine. */
export function presentTableGroups(data: AppData, groups: ProductListGroup[]): ProductListTableGroup[] {
  return groups.map(group => ({
    key: group.key,
    label: group.label,
    total: group.total,
    families: group.rows.map(row => row.family),
    skus: group.rows.flatMap(row => row.sku ? [{
      id: row.id,
      familyId: row.family.id,
      code: savedSkuCode(row.sku),
      name: savedSkuName(row.sku),
      spec: savedSkuSpec(row.family, row.sku),
      familyName: row.family.name,
      category: categoryPath(data, row.family.categoryId),
      typeName: productTypeName(data, row.family),
      modelName: linkedModelName(data, row.family),
      status: row.sku.status,
      updatedAt: row.sku.updatedAt?.slice(0, 16).replace('T', ' '),
    }] : []),
  }))
}
