import type { AppData, CompatibilityHost, CompatibilityLink, Sku } from '../../domain/types'
import { savedSkuSpec } from '../../domain/productList'
import type { AccessoryTarget, CompatibilityCapability, CompatibilityConclusion, CompatibilityCondition, CompatibilityVerification } from '../../domain/accessoryCompatibilityTypes'
import { compatibilityTarget, declarationDefaults } from '../../domain/accessoryCompatibilityQuery'

export const conclusionLabels: Record<CompatibilityConclusion, string> = { compatible: '适用', conditional: '有条件适用', incompatible: '明确不兼容' }
export const verificationLabels: Record<CompatibilityVerification, string> = { confirmed: '已确认', pending: '待确认' }
export const capabilityLabels: Record<CompatibilityCapability, string> = { basic: '基本使用', 'fast-charge': '快充能力', other: '指定能力' }
export function hostText(host: CompatibilityHost) { return (Array.isArray(host?.steps)?host.steps.map(step => step?.valueId||'').join(' · '):'') || '型号信息未记录' }
export function hostKey(host: CompatibilityHost) { return JSON.stringify([host?.productTypeId, host?.productModelId, host?.identityKey]) }
export function scopeText(host: CompatibilityHost) { return host?.scope === 'planning' ? `仅规划规格 ${host.planningId || '引用失效'}` : '整款型号，全部容量和颜色' }
export function recordSpec(data: AppData, record: Sku) {
  const family = data.families.find(item => item.id === record.familyId)
  return family ? savedSkuSpec(family, record) : '所属商品引用失效'
}
export function targetText(data: AppData, target: AccessoryTarget) {
  const record = data.skus.find(item => item.id === target.id)
  const family = data.families.find(item => item.id === record?.familyId)
  return `${target.kind === 'material' ? 'MAT' : 'SKU'} · ${target.kind === 'material' ? record?.materialCode || target.id : record?.code || target.id} · ${record?.skuName || family?.name || '引用失效'}`
}
export function conditionText(data: AppData, condition: CompatibilityCondition) {
  if (condition.kind !== 'attribute') return condition.text + (condition.kind === 'capability' ? `${condition.protocol ? ` · 协议 ${condition.protocol}` : ''}${condition.powerWatts ? ` · 要求 ${condition.powerWatts}W` : ''}` : '')
  return `${data.params.find(item => item.id === condition.attributeId)?.name || condition.attributeId} ${{ eq: '为', in: '属于', gte: '不低于' }[condition.operator]} ${Array.isArray(condition.value) ? condition.value.join('、') : condition.value}${condition.text ? ` · ${condition.text}` : ''}`
}
export function declarationText(data: AppData, link: CompatibilityLink) {
  const state = declarationDefaults(link)
  return `${targetText(data, compatibilityTarget(link))} → ${hostText(link.host)} · ${scopeText(link.host)} · ${capabilityLabels[state.capability]} · ${verificationLabels[state.verification]}${conclusionLabels[state.conclusion]}`
}
