import type {BenefitPackageDraft} from './benefitPackageTypes'

/** Format support only; callers retain their permission, status and validity checks. */
export function supportsBenefitAdvanced(pack:BenefitPackageDraft){
  return (pack.compositionVersion===undefined||pack.compositionVersion===1||pack.compositionVersion===2)&&(!pack.sales||pack.sales.schemaVersion===1)&&(!pack.framework||['type-v1','type-v2'].includes(pack.framework.kind))
}
export function supportsBenefitShopping(pack:BenefitPackageDraft){
  return pack.compositionVersion===2&&supportsBenefitAdvanced(pack)
}
