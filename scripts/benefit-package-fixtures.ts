import { createAccessoryCompatibilityFixture } from './accessory-compatibility-fixtures'
import { addBenefitSku, newBenefitPackageDraft } from '../src/domain/benefitPackages'

export const BENEFIT_TEST_TIME = '2026-10-23T09:00:00.000Z'
/** Explicitly independent test catalogue, never installed into the user's everyday context. */
export function createBenefitPackageFixture() {
  const fixture = createAccessoryCompatibilityFixture()
  fixture.data.benefitPackages = []
  fixture.data.benefitDeliveries = []
  let draft = newBenefitPackageDraft({ kind: 'sku', skuId: fixture.ids.phoneA })
  draft.name = '【独立测试】设备随行权益包'
  draft = addBenefitSku(fixture.data, draft, fixture.ids.caseSku)
  draft = addBenefitSku(fixture.data, draft, fixture.ids.filmSku)
  return { ...fixture, draft }
}
