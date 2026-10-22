import type { ComboMaterialCard, LegalComboMaterialRow } from '../../domain/comboMaterialStatus'
import { gradeText } from '../../domain/material'

export type MaterialLaunchMode = 'create' | 'list'

/** 仅用于设计器组合表格的展示结果，不是可写的规划记录。 */
export interface ComboTableRow extends Readonly<Pick<LegalComboMaterialRow, 'label' | 'modelVersionId' | 'retired' | 'grade' | 'materialCount' | 'filed'>> {
  readonly key: string
  readonly planningId: string
  readonly recordId: string
  readonly gradeLabel: string
  readonly materialCodes: string
  readonly materialNames: string
  readonly materialStatus: string
  readonly materials: readonly Readonly<ComboMaterialCard>[]
  readonly historicalMaterials: readonly Readonly<ComboMaterialCard>[]
  readonly anomalies: readonly string[]
  readonly hasAnomaly: boolean
}

export function presentComboRow(row: LegalComboMaterialRow): ComboTableRow {
  return {
    key: row.identityKey,
    label: row.label,
    planningId: row.actionPlanningId,
    recordId: row.planningLabel,
    modelVersionId: row.modelVersionId,
    retired: row.retired,
    grade: row.grade,
    gradeLabel: gradeText(row.grade),
    materialCount: row.materialCount,
    filed: row.filed,
    materialCodes: [row.materials, row.historicalMaterials].flatMap((list) => list.map((item) => item.materialCode.trim() || '未分配物料编号')).join('、'),
    materialNames: [row.materials, row.historicalMaterials].flatMap((list) => list.map((item) => item.skuName.trim() || '未填写物料名称')).join('、'),
    materialStatus: comboMaterialStatusText(row),
    materials: row.materials,
    historicalMaterials: row.historicalMaterials,
    anomalies: row.anomalies,
    hasAnomaly: row.anomalies.length > 0 || row.materials.some((item) => item.anomaly),
  }
}

function comboMaterialStatusText(row: Pick<LegalComboMaterialRow, 'materialCount' | 'historicalMaterials'>) {
  const history = row.historicalMaterials.length
  const names = [...new Set(row.historicalMaterials.map((item) => item.versionName).filter(Boolean))]
  const source = names.length ? names.join('、') : '未记录版本'
  if (row.materialCount && history) return `本版本已建 ${row.materialCount} 条 · 历史已建 ${history} 条 · 来源 ${source}`
  if (row.materialCount) return `已创建 ${row.materialCount} 条`
  if (history) return `本版本未建 · 历史已建 ${history} 条 · 来源 ${source}`
  return '未创建'
}
