import { createSeed } from '../src/domain/seed'
import { newSpuDraft } from '../src/domain/spuDraft'
import { createV3Material } from '../src/domain/material'
import { reconcilePlanningRecords } from '../src/domain/planning'

export const FIXED_NOW = '2026-10-22T04:00:00.000Z'
export function catalogFixture() {
  const data = createSeed()
  data.productPlans.push({ id: 'test-plan-a', name: '验收规划 A', productModelId: 't-phone', productTypeId: 'pt-phone', modelVersionId: 'phone-model-v1', selectedNodes: ['sn-brand-apple', 'sn-apple-series-iphone', 'sn-apple-model-17'], status: 'saved', createdTime: FIXED_NOW })
  data.productPlans.push({ ...data.productPlans.find(item => item.id === 'test-plan-a')!, id: 'test-plan-b', name: '验收规划 B' })
  const templateFamily = { ...newSpuDraft(data, { templateId: 't-film', categoryId: 'c-film' }), id: 'test-template-spu', name: '验收模板 SPU', commonAttrs: { 品牌: 'Apple' }, createdAt: FIXED_NOW, updatedAt: FIXED_NOW }
  const modelFamily = { ...newSpuDraft(data, { planId: 'test-plan-a' }), id: 'test-model-spu', name: '验收模型 SPU', createdAt: FIXED_NOW, updatedAt: FIXED_NOW }
  data.families.push(templateFamily, modelFamily)
  const version = data.specModelVersions.find(item => item.id === 'phone-model-v1')!
  data.planningRecords = reconcilePlanningRecords({ data, records: data.planningRecords, productModelId: 't-phone', modelVersionId: version.id, nodes: version.nodesSnapshot, now: FIXED_NOW }).records
  const planning = data.planningRecords.find(item => item.steps.some(step => step.valueId === 'iPhone 17'))!
  let sequence = 0
  const nextId = (prefix: string) => `test-${prefix}-${++sequence}`
  for (let i = 0; i < 2; i++) {
    const result = createV3Material(data, { productModelId: 't-phone', modelVersionId: version.id, planningId: planning.planningId, requestId: `test-mat-${i}`, categoryId: 'c-phone', productTypeId: 'pt-phone', now: FIXED_NOW, nextId })
    if (!result.ok) throw new Error(result.message)
  }
  return data
}
