import type { BenefitCompatibilityStatus, BenefitPackageStatus } from '../../domain/benefitPackageTypes'

export const packageStatusLabels: Record<BenefitPackageStatus, string> = { draft: '草稿', available: '可用', disabled: '停用' }
export const compatibilityLabels: Record<BenefitCompatibilityStatus, string> = {
  compatible: '适用', conditional: '有条件适用', incompatible: '明确不适用', pending: '待确认', 'not-required': '无需配件适配', unchecked: '未做设备适配校验',
}
export const capabilityLabels = { basic: '基本使用', 'fast-charge': '快充能力', other: '指定能力' } as const
export function formatBenefitCents(cents: number | null) {
  if (cents === null) return '未报价'
  if (!Number.isSafeInteger(cents) || cents < 0) return '报价需处理'
  const value = BigInt(cents)
  return `¥${value / 100n}.${String(value % 100n).padStart(2, '0')}`
}
export function amountInput(cents: number | null) { return cents === null ? '' : formatBenefitCents(cents).replace('¥', '') }
export function compatibilityTag(status: BenefitCompatibilityStatus): 'success' | 'warning' | 'danger' | 'info' {
  return status === 'compatible' ? 'success' : status === 'incompatible' ? 'danger' : status === 'conditional' || status === 'pending' ? 'warning' : 'info'
}
export function localBenefitRequest(kind: string) { return `${kind}-${typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : [...crypto.getRandomValues(new Uint32Array(4))].map(value => value.toString(16)).join('-')}` }
