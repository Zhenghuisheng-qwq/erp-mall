import type { BenefitConditionConfirmation, BenefitDeliveryPreview, BenefitDeliverySnapshot } from './benefitPackageTypes'

export const unsupportedDeliveryMessage = '当前客户端暂不支持完整解析此清单版本；原始内容保留，暂不支持业务打印和 Excel 导出。'
export function supportedBenefitDelivery(value: BenefitDeliveryPreview | BenefitDeliverySnapshot) {
  if(value.sales!==undefined&&value.sales?.schemaVersion!==1)return false
  return 'snapshotVersion' in value ? value.snapshotVersion === 1 || value.snapshotVersion === 2 : value.compositionVersion === undefined || value.compositionVersion === 1 || value.compositionVersion === 2
}
export function deliveryBasicText(value: unknown) { return typeof value === 'string' || typeof value === 'number' ? String(value) : '未记录' }
/** Resolve only the exact frozen position, never the first live or same-SKU row. */
export function deliveryConfirmationPosition(delivery: BenefitDeliveryPreview | BenefitDeliverySnapshot, confirmation: BenefitConditionConfirmation) {
  return delivery.goods.find(line => line.lineId === confirmation.positionId && line.skuId === confirmation.skuId)
}
