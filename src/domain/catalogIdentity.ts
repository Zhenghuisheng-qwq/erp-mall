import type { AppData, Sku } from './types'

function materialIdentity(sku: Sku, hasReceipt: () => boolean, legacyLine: () => string | undefined) {
  if ((sku.materialCode || '').trim() || hasReceipt()) return true
  if (sku.recordKind) return sku.recordKind === 'material'
  return legacyLine() === 'v3'
}
/** 物料证据优先；不在读取时改写不明确的历史记录。 */
export function isMaterialArchive(data: AppData, sku: Sku) {
  return materialIdentity(sku, () => Boolean(data.materialReceipts?.some(item => item.skuId === sku.id)), () => data.families.find(item => item.id === sku.familyId)?.line)
}

export function isRealSku(data: AppData, sku: Sku) {
  return data.families.some(item => item.id === sku.familyId) && !isMaterialArchive(data, sku)
}

/** Reuse within one batch only. Rebuild after families, receipts or record identity change. */
export function createCatalogIdentityContext(data: AppData) {
  const receiptIds = new Set((data.materialReceipts || []).map(item => item.skuId)), families = new Map<string, AppData['families'][number]>()
  // Keep the first record, exactly as the existing find() entry does for legacy data.
  for (const family of data.families) if (!families.has(family.id)) families.set(family.id, family)
  const isMaterial = (sku: Sku) => materialIdentity(sku, () => receiptIds.has(sku.id), () => families.get(sku.familyId)?.line)
  return { isMaterialArchive: isMaterial, isRealSku: (sku: Sku) => families.has(sku.familyId) && !isMaterial(sku) }
}
