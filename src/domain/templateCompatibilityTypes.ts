import type { CompatibilityCapability, CompatibilityConclusion, CompatibilityCondition, CompatibilityVerification } from './accessoryCompatibilityTypes'
import type { CompatibilityHost, PlanningStep } from './types'

/** An accessory-side structural selector. valueId is the actual dictionary value, not a generated id. */
export interface TemplateSpecTerm {
  attributeNodeId: string
  attributeId: string
  valueNodeId: string
  valueId: string
  parentValueNodeId: string | null
}
export interface TemplateSpecSelector { anyOf: TemplateSpecTerm[][] }
export interface TemplateCompatibilityClaim {
  id: string
  host: CompatibilityHost
  conclusion: CompatibilityConclusion
  verification: CompatibilityVerification
  capability: CompatibilityCapability
  conditions: CompatibilityCondition[]
  source: string
  note: string
}
export interface TemplateCompatibilityDefaultRule {
  id: string
  configured: boolean
  claims: TemplateCompatibilityClaim[]
}
export interface TemplateCompatibilityException {
  id: string
  name: string
  selector: TemplateSpecSelector
  claims: TemplateCompatibilityClaim[]
}
export interface TemplateCompatibilityConversion {
  legacyRuleId: string
  nodeId: string
  exceptionId: string
  convertedAt: string
}
export interface TemplateCompatibilityConfig {
  schemaVersion: 1
  modelId: string
  revision: number
  defaultRule: TemplateCompatibilityDefaultRule
  exceptions: TemplateCompatibilityException[]
  conversions: TemplateCompatibilityConversion[]
  updatedAt: string
}
/** Roles and labels are frozen because old snapshots can rely on mutable scheme fallback. */
export interface TemplateCompatibilitySnapshot {
  schemaVersion: 1
  config: TemplateCompatibilityConfig
  attributeRoles: { attributeNodeId: string; role: 'COMMON' | 'VARIANT'; roleSource?: 'node' | 'scheme' }[]
  attributeNames: { attributeId: string; name: string }[]
}
export interface EffectiveTemplateClaim {
  claim: TemplateCompatibilityClaim
  ruleIds: string[]
  claimIds: string[]
  origins: { ruleId: string; claimId: string }[]
}
export interface TemplateCompatibilityIssue { ruleId?: string; claimId?: string; message: string }
export interface EffectiveTemplateCompatibility {
  state: 'unconfigured' | 'configured' | 'empty' | 'invalid' | 'conflict'
  origin: 'default' | 'exception' | 'none'
  identityKey: string
  label: string
  steps: PlanningStep[]
  claims: EffectiveTemplateClaim[]
  ruleIds: string[]
  issues: TemplateCompatibilityIssue[]
  message: string
}
