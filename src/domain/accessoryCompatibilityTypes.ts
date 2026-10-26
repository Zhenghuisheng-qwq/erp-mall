import type { CompatibilityHost, CompatibilityLink, Sku } from './types'

export type AccessoryTargetKind = 'sku' | 'material'
export interface AccessoryTarget { kind: AccessoryTargetKind; id: string }
export type CompatibilityConclusion = 'compatible' | 'conditional' | 'incompatible'
export type CompatibilityVerification = 'confirmed' | 'pending'
export type CompatibilityCapability = 'basic' | 'fast-charge' | 'other'

/** Only attribute conditions are automatically evaluated. Equipment/capability prerequisites remain explicit unknowns. */
export type CompatibilityCondition =
  | { kind: 'attribute'; attributeId: string; operator: 'eq' | 'in' | 'gte'; value: string | string[]; text?: string }
  | { kind: 'equipment'; text: string }
  | { kind: 'capability'; text: string; protocol?: string; powerWatts?: number }
  | { kind: 'manual'; text: string }

export interface CompatibilityProvenance {
  kind: 'manual' | 'legacy' | 'material-copy' | 'template' | 'material-relation'
  contributionId?: string
  detail: string
  template?: {
    originKey: string
    modelId: string
    sourceVersionId: string
    ruleIds: string[]
    claimIds: string[]
    state: 'managed' | 'modified' | 'stale'
  }
  materialId?: string
  materialSnapshot?: { id: string; code: string; name: string }
  declarationId?: string
  declarationSnapshot?: { id: string; host: CompatibilityHost; note: string; conclusion: CompatibilityConclusion; verification: CompatibilityVerification; capability: CompatibilityCapability; conditions: CompatibilityCondition[]; source: string; createdAt: string; updatedAt: string }
}

/** A small explicitly maintained device catalogue; identity is its id, never its name. */
export interface DeviceModel {
  id: string
  name: string
  productTypeId: string
  attributes: Record<string, string>
  createdAt: string
  updatedAt: string
}
export interface DeviceBinding {
  skuId: string
  host: CompatibilityHost
  sourceStamp: string
  createdAt: string
  updatedAt: string
}
export interface DeviceModelOption {
  key: string
  host: CompatibilityHost
  label: string
  productTypeName: string
  source: 'model' | 'template' | 'manual' | 'legacy'
  planningIds: string[]
  versionIds: string[]
}
export interface DeviceResolution {
  status: 'resolved' | 'unconfigured' | 'ambiguous' | 'invalid'
  skuId: string
  host?: CompatibilityHost
  planningId?: string
  candidates: DeviceModelOption[]
  message: string
  source: string
  attributes: Record<string, string>
  sourceStamp: string
  binding?: DeviceBinding
}
export interface ConditionEvaluation { condition: CompatibilityCondition; state: 'met' | 'unmet' | 'unknown'; label: string }
export interface CapabilityEvaluation {
  capability: CompatibilityCapability
  status: 'compatible' | 'conditional' | 'incompatible' | 'pending'
  conflict: boolean
  conditions: ConditionEvaluation[]
  declarations: CompatibilityLink[]
}
export interface AccessoryMatch {
  target: AccessoryTarget
  sku: Sku
  name: string
  code: string
  spec: string
  productTypeId: string
  productTypeName: string
  status: 'compatible' | 'conditional' | 'incompatible' | 'pending'
  recommendable: boolean
  conflict: boolean
  reasons: string[]
  conditions: ConditionEvaluation[]
  declarations: CompatibilityLink[]
  capabilities: CapabilityEvaluation[]
  /** Basic use is independent from management's aggregate ability status. */
  basic: CapabilityEvaluation
}
export interface AccessoryUseEvaluation {
  status: CapabilityEvaluation['status']
  conflict: boolean
  conditions: ConditionEvaluation[]
  declarations: CompatibilityLink[]
  basic: CapabilityEvaluation
  fastCharge: CapabilityEvaluation
  missingBasic: boolean
  requiresFastCharge: boolean
}
export interface CompatibilityIssue { declarationId?: string; message: string }
export interface AccessoryQueryResult {
  device: DeviceResolution
  sales: AccessoryMatch[]
  materials: AccessoryMatch[]
  pending: AccessoryMatch[]
  excluded: AccessoryMatch[]
  unavailable: AccessoryMatch[]
  issues: CompatibilityIssue[]
  counts: { sales: number; materials: number; pending: number; excluded: number; unavailable: number; declarations: number; models: number }
}
export interface ReverseCompatibilityResult {
  target: AccessoryTarget
  hosts: { key: string; host: CompatibilityHost; label: string; declarations: CompatibilityLink[]; devices: { skuId: string; code: string; name: string; status: AccessoryMatch['status']; capabilities: CapabilityEvaluation[]; planningId?: string }[]; status: AccessoryMatch['status']; conflict: boolean; scopeSummary: string; capabilities: CapabilityEvaluation[] }[]
  issues: CompatibilityIssue[]
  counts: { models: number; declarations: number; devices: number }
}
