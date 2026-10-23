import type { CompatibilityHost } from './types'

export type BenefitPackageStatus = 'draft' | 'available' | 'disabled'
export type BenefitDeviceContext = { kind: 'sku'; skuId: string } | { kind: 'model'; host: CompatibilityHost } | null
export interface BenefitSkuSummary {
  skuId: string
  code: string
  name: string
  familyId: string
  familyName: string
  spec: string
  productTypeId: string
  typeName: string
  status: string
}
export interface BenefitGoodsLine { id: string; skuId: string; quantity: number; snapshot: BenefitSkuSummary }
export interface BenefitServiceLine {
  id: string
  name: string
  quantity: number
  unit: string
  measurement: 'per-package' | 'per-delivery'
  validity: string
  description: string
}
export interface BenefitSelectionGroup {
  id: string
  name: string
  enabled: boolean
  candidateSkuIds: string[]
  required: boolean
  minKinds: number
  maxKinds: number
  defaultQuantity: number
  adjustable: boolean
  minQuantity: number
  maxQuantity: number
}
export interface BenefitQuote { currency: 'CNY'; amountCents: number | null; reviewedBasis: string }
export type BenefitCompatibilityStatus = 'compatible' | 'conditional' | 'incompatible' | 'pending' | 'not-required' | 'unchecked'
export interface BenefitCapabilitySummary {
  capability: 'basic' | 'fast-charge' | 'other'
  status: BenefitCompatibilityStatus
  conditions: { state: 'met' | 'unmet' | 'unknown'; label: string }[]
  declarationIds: string[]
  sources: string[]
}
export interface BenefitCompatibilitySummary {
  skuId: string
  basicStatus: BenefitCompatibilityStatus
  fastChargeStatus: BenefitCompatibilityStatus
  reasons: string[]
  capabilities: BenefitCapabilitySummary[]
}
export interface BenefitConditionConfirmation {
  key: string
  skuId: string
  capability: 'basic' | 'fast-charge'
  device: BenefitDeviceContext
  declarationIds: string[]
  conditionLabels: string[]
  note: string
  confirmedAt: string
  basis: string
}
/** New local drafts have empty id/code/times and revision 0; commands allocate identities only on save. */
export interface BenefitPackageDraft {
  id: string
  code: string
  revision: number
  creationRequestId?: string
  name: string
  status: BenefitPackageStatus
  favorite: boolean
  device: BenefitDeviceContext
  includedPhoneSkuId: string
  requireFastCharge: boolean
  goods: BenefitGoodsLine[]
  services: BenefitServiceLine[]
  rulesEnabled: boolean
  groups: BenefitSelectionGroup[]
  quote: BenefitQuote
  confirmations: BenefitConditionConfirmation[]
  issues: string[]
  createdAt: string
  updatedAt: string
}
export type BenefitPackage = BenefitPackageDraft
export interface BenefitIssue {
  code: string
  message: string
  severity: 'error' | 'condition' | 'warning'
  structural?: boolean
  skuId?: string
  groupId?: string
  confirmationKey?: string
}
export interface BenefitValidation {
  issues: BenefitIssue[]
  goods: { line: BenefitGoodsLine; summary: BenefitSkuSummary; available: boolean; compatibility: BenefitCompatibilitySummary }[]
  deviceLabel: string
  deviceValid: boolean
  canSaveDraft: boolean
  canSaveAvailable: boolean
  canDeliver: boolean
  basis: string
  physicalCount: number
  serviceCount: number
  quoteNeedsReview: boolean
}
export interface BenefitDeliveryGoods extends BenefitSkuSummary { lineId: string; perPackageQuantity: number; totalQuantity: number; compatibility: BenefitCompatibilitySummary }
export interface BenefitDeliveryService extends BenefitServiceLine { perPackageQuantity: number; totalQuantity: number }
export interface BenefitDeliveryPreview {
  packageId: string
  packageCode: string
  sourceRevision: number
  packageName: string
  packageCount: number
  device: BenefitDeviceContext
  deviceLabel: string
  includedPhoneSkuId: string
  /** Actual delivered host SKUs, independent of the context inclusion switch. */
  hostSkuIds: string[]
  goods: BenefitDeliveryGoods[]
  services: BenefitDeliveryService[]
  quote: { currency: 'CNY'; amountCents: number | null; totalCents: number | null; needsReview: boolean }
  confirmations: BenefitConditionConfirmation[]
  issues: BenefitIssue[]
  canConfirm: boolean
  basis: string
}
export interface BenefitDeliverySnapshot extends BenefitDeliveryPreview {
  id: string
  code: string
  requestId: string
  generatedAt: string
  snapshotVersion: 1
}
export interface BenefitCommandResult {
  ok: boolean
  message?: string
  id?: string
  package?: BenefitPackage
  delivery?: BenefitDeliverySnapshot
  validation?: BenefitValidation
}
