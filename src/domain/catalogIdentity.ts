import type { AppData, Sku } from './types'

/** 物料证据优先；不在读取时改写不明确的历史记录。 */
export function isMaterialArchive(data: AppData, sku: Sku) {
  if ((sku.materialCode || '').trim() || data.materialReceipts?.some(item => item.skuId === sku.id)) return true
  if (sku.recordKind) return sku.recordKind === 'material'
  return data.families.find(item => item.id === sku.familyId)?.line === 'v3'
}

export function isRealSku(data: AppData, sku: Sku) {
  return data.families.some(item => item.id === sku.familyId) && !isMaterialArchive(data, sku)
}
