import { createTemplateCompatibilityFixture, TEMPLATE_COMPATIBILITY_TIME } from './template-compatibility-fixtures'
import { createTemplateCompatibilityContext, freezeTemplateCompatibility } from '../src/domain/templateCompatibility'
import { materializeTemplateCompatibility } from '../src/domain/templateCompatibilitySync'
import type { ProductFamily, Sku } from '../src/domain/types'

export const SYNC_REFINEMENT_TIME = TEMPLATE_COMPATIBILITY_TIME
/** Independent, fixed-clock sales SKU. The source version is never rebound by a sync. */
export function createRefinementSyncFixture(notes: string[]) {
  const fixture = createTemplateCompatibilityFixture({ styles: 1, colors: 1, packs: 1 })
  const { data, modelId, config, version, versionId } = fixture
  config.exceptions = []
  const setClaims = (values: string[]) => {
    config.defaultRule.claims = values.map((note, index) => ({ ...fixture.claim(`refinement-claim-${index}`), note }))
  }
  setClaims(notes)
  version.templateCompatibilitySnapshot = freezeTemplateCompatibility(data, modelId)
  const combination = createTemplateCompatibilityContext(data, { modelId, versionId }).combinations[0]!
  const family: ProductFamily = { id: 'refinement-sync-family', name: '【独立测试】同步配件', templateId: modelId, productModelId: modelId, modelVersionId: versionId, productTypeId: 'type-case', categoryId: 'cat-accessory-test', oaProductId: '', commonAttrs: { 包装: '包装 1' }, productGroupIds: [], lifecycle: 'ready', shelfStatus: 'online', line: 'v2', createdAt: SYNC_REFINEMENT_TIME, updatedAt: SYNC_REFINEMENT_TIME }
  const sku: Sku = { id: 'refinement-sync-sku', familyId: family.id, code: 'REFINEMENT-SYNC-SKU', skuName: '【独立测试】同步销售 SKU', oaSkuId: '', recordKind: 'sku', status: 'on_sale', variantAttrs: Object.fromEntries(combination.steps.filter(step => step.role === 'variant').map(step => [step.attributeName, step.valueId])), projectedAttrs: {}, sourceNodeIds: combination.steps.map(step => step.valueNodeId), modelVersionId: versionId, creationSource: { kind: 'model', templateId: modelId, modelVersionId: versionId, createdAt: SYNC_REFINEMENT_TIME }, createdAt: SYNC_REFINEMENT_TIME, updatedAt: SYNC_REFINEMENT_TIME }
  data.families.push(family); data.skus.push(sku)
  let allocated = 0
  const nextId = () => `refinement-formal-${++allocated}`
  const created = materializeTemplateCompatibility(data, [sku.id], nextId, SYNC_REFINEMENT_TIME)
  if (!created.ok) throw new Error(created.message)
  function publish(values: string[]) {
    setClaims(values); config.revision++
    const number = data.specModelVersions.filter(item => item.templateId === modelId).length + 1
    const published = { ...structuredClone(version), id: `refinement-version-${number}`, version: number, versionName: `【独立测试】V${number}`, templateCompatibilitySnapshot: freezeTemplateCompatibility(data, modelId) }
    data.specModelVersions.push(published)
    return published.id
  }
  return { ...fixture, family, sku, publish, nextId, allocated: () => allocated, links: () => data.compatibilities.filter(item => item.targetId === sku.id), origins: () => (data.templateCompatibilityOrigins || []).filter(item => item.target.id === sku.id) }
}
