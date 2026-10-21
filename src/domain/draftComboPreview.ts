import { specPublishProblems, sameSpecSnapshot } from './logic'
import { nodeHostSignature } from './nodeCompatibility'
import { legalPlanningCombinations, reconcilePlanningRecords } from './planning'
import type { AppData, ProductSpecNode } from './types'

export interface DraftComboRow {
  label: string
  identityKey: string
  /** 已经存在的规划编号。新组合留空，预览不分配编号。 */
  planningId: string
}

export interface DraftComboPreview {
  problems: string[]
  rows: DraftComboRow[]
  nextVersionName: string
  previousVersionName: string
  previousCount: number
  added: number
  reused: number
  reliableDelta: boolean
  sameAsPublished: boolean
}

function hostRulesDiffer(data: AppData, templateId: string, modelVersionId: string) {
  const rules = data.nodeCompatibilityRules || []
  const draft = rules.filter((item) => item.templateId === templateId && item.modelVersionId === '')
  const frozen = rules.filter((item) => item.modelVersionId === modelVersionId)
  return nodeHostSignature(draft) !== nodeHostSignature(frozen)
}
export function previewDraftCombinations(data: AppData, templateId: string, nodes: ProductSpecNode[]): DraftComboPreview {
  const published = (data.specModelVersions || [])
    .filter((item) => item.templateId === templateId && item.status === 'published')
    .slice()
    .sort((left, right) => left.version - right.version)
  const latest = published[published.length - 1]
  const nextVersionName = `V${(latest?.version || 0) + 1}`
  const previousVersionName = latest?.versionName || ''
  const previousCombos = latest ? legalPlanningCombinations(data, templateId, latest.nodesSnapshot) : []
  const problems = specPublishProblems(data, nodes)
  const base = {
    nextVersionName,
    previousVersionName,
    previousCount: previousCombos.length,
    sameAsPublished: Boolean(latest && sameSpecSnapshot(latest.nodesSnapshot, nodes) && !hostRulesDiffer(data, templateId, latest.id)),
  }
  if (problems.length) {
    return { ...base, problems, rows: [], added: 0, reused: 0, reliableDelta: false }
  }
  const combos = legalPlanningCombinations(data, templateId, nodes)
  const known = new Map((data.planningRecords || [])
    .filter((item) => item.productModelId === templateId && item.origin !== 'temporary')
    .map((item) => [item.identityKey, item.planningId]))
  const outcome = reconcilePlanningRecords({
    records: data.planningRecords || [],
    data,
    productModelId: templateId,
    modelVersionId: latest?.id || 'preview',
    nodes,
    now: '',
  })
  return {
    ...base,
    problems: [],
    rows: combos.map((combo) => ({ label: combo.label, identityKey: combo.identityKey, planningId: known.get(combo.identityKey) || '' })),
    added: outcome.created,
    reused: outcome.reused,
    reliableDelta: true,
  }
}

export function publishImpactText(preview: DraftComboPreview) {
  if (preview.problems.length) return `还不能发布：${preview.problems[0]}`
  if (preview.sameAsPublished && preview.previousVersionName) return `当前内容和 ${preview.previousVersionName} 一致，再次发布不会生成新版本。`
  if (!preview.previousVersionName) return `准备发布 ${preview.nextVersionName}。草稿合法组合 ${preview.rows.length} 条。发布前不分配规划编号。发布后创建快照。`
  if (!preview.reliableDelta) return `准备发布 ${preview.nextVersionName}。草稿合法组合 ${preview.rows.length} 条。上一版本 ${preview.previousVersionName}。发布后创建新快照，${preview.previousVersionName} 不会被覆盖。`
  return `准备发布 ${preview.nextVersionName}。草稿合法组合 ${preview.rows.length} 条。上一版本 ${preview.previousVersionName}，${preview.previousCount} 条。预计新增 ${preview.added} 条，沿用 ${preview.reused} 条。发布后创建新快照，${preview.previousVersionName} 不会被覆盖。`
}
