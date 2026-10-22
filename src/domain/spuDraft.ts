import { latestPublishedVersion, planSkuLines } from './logic'
import type { AppData, ProductFamily } from './types'

/** A local form draft. Never writes business records or upgrades an existing SPU's version. */
export function newSpuDraft(data: AppData, context: { templateId?: string; planId?: string; fromId?: string; categoryId?: string } = {}): ProductFamily {
  const source = data.families.find(item => item.id === context.fromId)
  const plan = data.productPlans.find(item => item.id === context.planId)
  const parts = plan && (!plan.modelVersionId || data.specModelVersions.some(item => item.id === plan.modelVersionId && item.templateId === plan.productModelId)) ? planSkuLines(data, plan) : undefined
  const templateId = plan?.productModelId || context.templateId || source?.templateId || ''
  const canvas = data.specCanvases.find(item => item.templateId === templateId)
  const typeId = plan?.productTypeId || canvas?.productTypeId || source?.productTypeId
  const type = data.productTypes.find(item => item.id === typeId)
  return { id: '', name: parts?.productName || (source ? `${source.name} 副本` : ''), oaProductId: '', categoryId: type?.categoryId || context.categoryId || source?.categoryId || '',
    productTypeId: typeId, templateId, productModelId: canvas ? templateId : undefined, modelVersionId: parts?.modelVersionId || source?.modelVersionId || latestPublishedVersion(data, templateId)?.id || '',
    commonAttrs: { ...(parts?.commonAttrs || source?.commonAttrs || {}) }, productGroupIds: [], shelfStatus: 'draft', lifecycle: 'draft', origin: 'created', updatedAt: '' }
}
