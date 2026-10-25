import { isMaterialArchive } from './catalogIdentity'
import type { AppData, PlanningStep, Sku } from './types'
import type { NodeBusinessConfig } from './nodeBusiness'
import type { TemplateCompatibilityClaim } from './templateCompatibilityTypes'

export interface MaterialScope {
  kind: 'planning' | 'node'
  modelId: string
  versionId: string
  planningId?: string
  anchorNodeId?: string
  scope: 'current' | 'subtree'
}
export interface MaterialRelation {
  id: string
  materialId: string
  kind: string
  source: MaterialScope
  prefix: PlanningStep[]
  coverage: { planningId: string; identityKey: string; steps: PlanningStep[] }[]
  policy: NodeBusinessConfig[]
  createdAt: string
  lifecycle: 'active' | 'revoked'
  revokedAt?: string
  original: boolean
  requestId: string
  requestIntent?: string
  requestAliases?: { requestId: string; intent: string }[]
}
export interface MaterialContribution {
  id: string
  materialId: string
  declarationId: string
  baseline: TemplateCompatibilityClaim
  /** Stable source pairs survive unlink and content changes; absent on legacy records. */
  lineage?: { modelId: string; ruleId: string; claimId: string }[]
  generated: boolean
  owners: { relationId: string; planningId: string; ruleIds: string[]; claimIds: string[]; origins?: { ruleId: string; claimId: string }[] }[]
  state: 'managed' | 'modified' | 'deleted' | 'retired'
}
export const activeMaterialRelations = (data: AppData) => (data.materialRelations || []).filter(r => r.kind === 'scope-v1' && r.lifecycle === 'active')
export function relatedMaterials(data: AppData, planningId: string, versionId?: string): Sku[] {
  const ids = new Set(activeMaterialRelations(data).filter(r => (!versionId || r.source.versionId === versionId) && r.coverage.some(c => c.planningId === planningId)).map(r => r.materialId))
  return data.skus.filter(s => isMaterialArchive(data,s) && ((s.planningId === planningId && (!versionId || s.modelVersionId === versionId)) || ids.has(s.id)))
}
export function materialSources(data: AppData, materialId: string) {
  const sku = data.skus.find(s => s.id === materialId)
  const rows = activeMaterialRelations(data).filter(r => r.materialId === materialId).map(r => ({id:r.id,source:r.source,original:r.original,label:r.original?'节点范围建档':'显式关联',prefix:r.prefix,coverage:r.coverage}))
  const plan = data.planningRecords.find(p => p.planningId === sku?.planningId)
  if (sku && plan) rows.unshift({id:`original:${sku.id}`,source:{kind:'planning',modelId:plan.productModelId,versionId:sku.modelVersionId || plan.originModelVersionId,planningId:plan.planningId,scope:'current'},original:true,label:'原始建档',prefix:plan.steps,coverage:[{planningId:plan.planningId,identityKey:plan.identityKey,steps:plan.steps}]})
  return rows
}
export function nodeMaterialCards(data: AppData, modelId: string, versionId: string, nodeId: string) {
  const rows = data.skus.filter(s => isMaterialArchive(data,s)).flatMap(s => materialSources(data,s.id).flatMap(r => {
    if (r.source.modelId !== modelId || r.source.versionId !== versionId) return []
    const anchor = r.source.anchorNodeId || r.prefix.at(-1)?.valueNodeId
    const inherited = anchor !== nodeId && r.source.scope === 'subtree' && r.coverage.some(c => c.steps.some(p => p.valueNodeId === nodeId))
    return anchor === nodeId || inherited ? [{sku:s,source:r,label:inherited?'范围继承':r.label}] : []
  }))
  return [...new Map(rows.map(r=>[r.sku.id,r])).values()]
}
export function materialRelationBlock(data: AppData, kind: 'material'|'model'|'version', id: string) {
  const hit = (data.materialRelations || []).find(r => r.lifecycle !== 'revoked' && (kind==='material'?r.materialId===id:kind==='model'?r.source.modelId===id:r.source.versionId===id))
  return hit ? `仍被物料关联 ${hit.id}（${hit.source.modelId} / ${hit.source.versionId}）引用，不能删除；原始建档事实需保留。` : ''
}

/** All active published ranges plus original filing, across versions; PLN identity deduplicated. */
export function materialPlanningIds(data: AppData, materialId: string, versionId?: string): string[] {
  return [...new Set(materialSources(data,materialId).filter(r=>!versionId||r.source.versionId===versionId).flatMap(r=>r.coverage.map(c=>c.planningId)))]
}
