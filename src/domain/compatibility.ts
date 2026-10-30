import type {AppData,CompatibilityHost} from './types'
export function roleOfType(data: AppData, productTypeId: string): 'host' | 'accessory' | 'other' {
  const type = data.productTypes.find((item) => item.id === productTypeId)
  if (!type) return 'other'
  if (type.catalogRole) return type.catalogRole
  return 'other'
}

export function hostLabel(host: CompatibilityHost) {
  return host.steps.map((step) => step.valueId).filter(Boolean).join(' ')
}

export function hostFrom(productTypeId: string, productModelId: string, steps: { attributeId: string; attributeName: string; valueId: string }[], planningId = ''): CompatibilityHost {
  return {
    scope: planningId ? 'planning' : 'model',
    productTypeId,
    productModelId,
    identityKey: hostIdentityKey(steps),
    steps: steps.map((step) => ({ attributeId: step.attributeId, attributeName: step.attributeName, valueId: step.valueId })),
    planningId: planningId || undefined,
  }
}

export function hostIdentityKey(steps: { attributeId: string; valueId: string }[]) {
  return steps.map((step) => `${step.attributeId}=${step.valueId}`).join('\u001e')
}