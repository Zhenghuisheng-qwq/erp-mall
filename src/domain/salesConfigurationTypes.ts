import type { TemplateSpecSelector } from './templateCompatibilityTypes'
import type { BenefitGroupRule, BenefitServiceLine, BenefitSkuSummary } from './benefitPackageTypes'
import type { CompatibilityCondition } from './accessoryCompatibilityTypes'

export interface SalesCandidateScope { kind: 'product-types' | 'families' | 'skus' | 'service'; ids: string[] }
export interface SalesOptionItem {
  id: string; name: string; enabled: boolean; order: number
  scope: SalesCandidateScope
  recommended: boolean; required: boolean; minKinds: number; maxKinds: number
  defaultQuantity: number; minQuantity: number; maxQuantity: number
  checkTarget: 'device' | 'source' | 'none'
  source: string; note: string
  service?: Pick<BenefitServiceLine, 'unit' | 'measurement' | 'validity' | 'description'>
}
export interface SalesOptionPlanVersion { schemaVersion: 1; planId: string; version: number; name: string; items: SalesOptionItem[]; rules: BenefitGroupRule[]; publishedAt: string }
export interface SalesOptionPlan {
  schemaVersion: 1; id: string; name: string; revision: number; status: 'draft' | 'available' | 'disabled'
  items: SalesOptionItem[]; rules: BenefitGroupRule[]; publishedVersion: number | null; versions: SalesOptionPlanVersion[]
  createdAt: string; updatedAt: string
  receipts?: SalesCommandReceipt[]
}
export type SalesBindingScope =
  | { kind: 'model'; modelId: string; versionId: string | null; selector?: TemplateSpecSelector; nodeId?: string }
  | { kind: 'products'; familyIds: string[]; skuIds: string[] }
export interface SalesOptionBinding {
  schemaVersion: 1; id: string; revision: number; name: string; enabled: boolean
  scope: SalesBindingScope; mode: 'default' | 'replace' | 'none'
  planId: string | null; planVersion: number | null; source: string; updatedAt: string
  receipts?: SalesCommandReceipt[]
}
/** Directed exact-SKU relation; recommendations never establish direct applicability. */
export interface SalesProductRelation {
  schemaVersion: 1; id: string; revision: number; enabled: boolean; sourceSkuId: string; targetSkuId: string
  kind: 'recommendation' | 'applicability'; conclusion: 'compatible' | 'conditional' | 'incompatible'
  checkTarget?: 'device' | 'source' | 'none'
  verification: 'pending' | 'confirmed'; conditions: CompatibilityCondition[]; source: string; note: string; updatedAt: string
  receipts?: SalesCommandReceipt[]
}
export interface SalesCommandReceipt {
  requestId: string; intent: string; sourceRevision: number; resultRevision: number
  /** Receipt of one atomic configuration publication/application, never a second business relation. */
  configuration?: {planId:string;version:number;bindingIds:string[]}
}
export interface SalesSourceResolution { state: 'resolved' | 'legacy' | 'invalid'; skuId: string; modelId: string; versionId: string; identityKey: string; message: string }
export interface SalesBindingPreview {
  stamp: string; legalCount: number; skuCount: number; skuIds: string[]
  samples: { identityKey: string; label: string; skuIds: string[] }[]
  unresolved: { id: string; message: string }[]; issues: string[]; canApply: boolean; draftOnly: boolean
}
export interface SalesPlanResolution {
  state: 'matched' | 'none' | 'unconfigured' | 'conflict' | 'invalid'; message: string
  source: SalesSourceResolution; bindingIds: string[]; plan?: SalesOptionPlanVersion
}
export interface SalesSelectionOrigin {
  positionId: string; sourceSkuId: string; sourcePositionId?: string
  itemId: string; checkTarget: SalesOptionItem['checkTarget']; bindingIds: string[]
  plan?: SalesOptionPlanVersion; relationIds: string[]; evidence: string
}
export interface SalesSelectionContext { sourceSkuId: string; sourcePositionId?: string; bindingIds: string[]; plan: SalesOptionPlanVersion }
export interface SalesSelectionMetadata { schemaVersion: 1; origins: SalesSelectionOrigin[]; contexts: SalesSelectionContext[] }
export interface SalesCandidate {
  key: string; skuId?: string; summary?: BenefitSkuSummary; item: SalesOptionItem
  sourceSkuId: string; bindingIds: string[]; plan?: SalesOptionPlanVersion; relationIds: string[]
  status: 'compatible' | 'conditional' | 'pending' | 'incompatible' | 'not-required'
  canAdd: boolean; reason: string; evidence: string
}
