import { createCatalogIdentityContext } from './catalogIdentity'
import { legalPlanningCombinations } from './planning'
import type { AppData, PlanningRecord, Sku } from './types'

/** 一条已保存物料的展示卡片。名称和编号只取档案原值。 */
export interface ComboMaterialCard {
  skuId: string
  familyId: string
  skuName: string
  materialCode: string
  nameSource?: 'auto' | 'manual' | 'rule' | 'default'
  modelVersionId: string
  /** 建档版本的版本名。对不上已发布版本时为空，不能补一个猜测的名字。 */
  versionName: string
  anomaly: string
}

export interface UnmatchedComboMaterial {
  skuId: string
  familyId: string
  planningId: string
  skuName: string
  materialCode: string
  note: string
}

export interface LegalComboMaterialRow {
  identityKey: string
  valueNodeIds: string[]
  /** 当前发布版本快照上的完整规格路径。 */
  label: string
  /** 展示用规划编号。对上多条时全部列出，不挑选。 */
  planningLabel: string
  /** 唯一且仍有效时才用于勾选和创建。 */
  actionPlanningId: string
  retired: boolean
  grade?: 'core' | 'general'
  /** 当前选定的已发布版本。 */
  modelVersionId: string
  /** 建档版本就是当前查看版本的物料。 */
  materials: ComboMaterialCard[]
  /** 同一 PLN 在其他已关联发布版本上的物料。不计入本版本建档。 */
  historicalMaterials: ComboMaterialCard[]
  /** 本版本已经关联上的物料数。有规划编号但没有物料时是 0。历史物料不计入。 */
  materialCount: number
  /** 本版本有关联物料时为真。只有历史物料时为假。 */
  filed: boolean
  anomalies: string[]
}

export interface LegalComboMaterialStatus {
  versionId: string
  versionName: string
  message: string
  rows: LegalComboMaterialRow[]
  unmatched: UnmatchedComboMaterial[]
}

/**
 * 只读：用选定发布版本的合法组合，按规划编号和物料上的版本找已有物料。
 * 不创建规划、物料或商品，不改名称、编号、快照。
 */
export function legalComboMaterialStatus(data: AppData, productModelId: string, modelVersionId: string): LegalComboMaterialStatus {
  const empty = (message: string): LegalComboMaterialStatus => ({ versionId: '', versionName: '', message, rows: [], unmatched: [] })
  if (!productModelId) return empty('还没有打开商品模型。')
  const version = (data.specModelVersions || []).find((item) => item.id === modelVersionId && item.templateId === productModelId && item.status === 'published')
  if (!version) return empty(modelVersionId ? '找不到这个已发布版本。' : '发布模型后，这里会列出可以建档的合法组合。')
  const combos = legalPlanningCombinations(data, productModelId, version.nodesSnapshot)
  const records = (data.planningRecords || []).filter((item) => item.productModelId === productModelId && item.origin !== 'temporary')
  const usedPlanningIds = new Set<string>()
  const index = materialReadIndex(data)
  const recordsByIdentity = new Map<string, PlanningRecord[]>()
  for (const record of records) {
    if (!record.modelVersionIds.includes(version.id)) continue
    const list = recordsByIdentity.get(record.identityKey) || []; list.push(record); recordsByIdentity.set(record.identityKey, list)
  }
  const rows = combos.map((combo) => {
    const linked = recordsByIdentity.get(combo.identityKey) || []
    linked.forEach((item) => usedPlanningIds.add(item.planningId))
    const anomalies: string[] = []
    if (linked.length > 1) anomalies.push('本版本有多条规划编号对上同一组合，没有自动合并。')
    const materials: ComboMaterialCard[] = []
    const historical: ComboMaterialCard[] = []
    linked.forEach((record) => {
      const found = materialsOfRecord(data, record, version.id, index)
      materials.push(...found.cards)
      historical.push(...found.historical)
      anomalies.push(...found.notes)
    })
    materials.sort((a, b) => (a.materialCode || a.skuId).localeCompare(b.materialCode || b.skuId, 'zh'))
    historical.sort((a, b) => (a.materialCode || a.skuId).localeCompare(b.materialCode || b.skuId, 'zh'))
    const sole = linked.length === 1 ? linked[0] : undefined
    return {
      identityKey: combo.identityKey,
      valueNodeIds: combo.steps.map(step => step.valueNodeId),
      label: combo.label,
      planningLabel: linked.map((item) => item.planningId).join('、'),
      actionPlanningId: sole && sole.status === 'active' ? sole.planningId : '',
      retired: linked.length === 1 && linked[0].status === 'retired',
      grade: sole?.grade,
      modelVersionId: version.id,
      materials,
      historicalMaterials: historical,
      materialCount: materials.length,
      filed: materials.length > 0,
      anomalies,
    }
  })
  return {
    versionId: version.id,
    versionName: version.versionName,
    message: '',
    rows,
    unmatched: unmatchedMaterials(data, productModelId, version.id, usedPlanningIds, index),
  }
}

function materialReadIndex(data: AppData) {
  const identity = createCatalogIdentityContext(data), byPlan = new Map<string, Sku[]>(), ids = new Set(data.skus.map(sku => sku.id))
  const materials = data.skus.filter(identity.isMaterialArchive)
  for (const sku of materials) { const key = sku.planningId || ''; const list = byPlan.get(key) || []; list.push(sku); byPlan.set(key, list) }
  const missingReceipts = new Map<string, string[]>()
  for (const receipt of data.materialReceipts || []) {
    if (receipt.lifecycle === 'deleted' || ids.has(receipt.skuId)) continue
    const list = missingReceipts.get(receipt.planningId) || []
    list.push(`回执 ${receipt.materialCode || receipt.requestId} 指向的物料已不在，没有重建。`); missingReceipts.set(receipt.planningId, list)
  }
  const versionNames = new Map<string, string>()
  for (const version of data.specModelVersions) if (!versionNames.has(version.id)) versionNames.set(version.id, version.versionName)
  return { byPlan, materials, missingReceipts, versionNames }
}
export function materialsOfRecord(data: AppData, record: PlanningRecord, versionId: string, index = materialReadIndex(data)) {
  const notes: string[] = []
  const anchor = record.modelVersionIds.includes(record.originModelVersionId) ? record.originModelVersionId : (record.modelVersionIds[0] || '')
  const cards: ComboMaterialCard[] = []
  const historical: ComboMaterialCard[] = []
  let missingVersion = 0
  let foreignVersion = 0
  ;(index.byPlan.get(record.planningId) || []).forEach((sku) => {
    const savedVersion = (sku.modelVersionId || '').trim()
    if (savedVersion === versionId) {
      cards.push(cardOf(index, sku, ''))
      return
    }
    if (!savedVersion) {
      if (versionId === anchor) cards.push(cardOf(index, sku, '没有记下建档版本。'))
      else missingVersion += 1
      return
    }
    if (record.modelVersionIds.includes(savedVersion)) {
      historical.push(cardOf(index, sku, ''))
      return
    }
    foreignVersion += 1
  })
  if (missingVersion) notes.push(`另有 ${missingVersion} 条物料没有建档版本，只在来源版本里展示，没有改写。`)
  if (foreignVersion) notes.push(`有 ${foreignVersion} 条物料记下了本规划未关联的版本，没有并入，也没有改写。`)
  notes.push(...(index.missingReceipts.get(record.planningId) || []))
  return { cards, historical, notes }
}

function cardOf(index: ReturnType<typeof materialReadIndex>, sku: Sku, anomaly: string): ComboMaterialCard {
  const parts = [anomaly]
  if (!(sku.materialCode || '').trim()) parts.push('没有保存物料编号。')
  return {
    skuId: sku.id,
    familyId: sku.familyId,
    skuName: sku.skuName || '',
    materialCode: sku.materialCode || '',
    nameSource: sku.nameSource,
    modelVersionId: sku.modelVersionId || '',
    versionName: index.versionNames.get(sku.modelVersionId || '') || '',
    anomaly: parts.filter(Boolean).join(''),
  }
}

function unmatchedMaterials(data: AppData, productModelId: string, versionId: string, usedPlanningIds: Set<string>, index: ReturnType<typeof materialReadIndex>): UnmatchedComboMaterial[] {
  const records = new Map<string, PlanningRecord>()
  for (const record of data.planningRecords || []) if (!records.has(record.planningId)) records.set(record.planningId, record)
  return index.materials.flatMap((sku) => {
    const planningId = (sku.planningId || '').trim()
    if (!planningId || usedPlanningIds.has(planningId)) return []
    if ((sku.modelVersionId || '').trim() !== versionId) return []
    const record = records.get(planningId)
    if (!record || record.productModelId !== productModelId || record.origin === 'temporary') return []
    return [{
      skuId: sku.id,
      familyId: sku.familyId,
      planningId,
      skuName: sku.skuName || '',
      materialCode: sku.materialCode || '',
      note: '这条物料的规划编号对不上当前版本的合法组合，没有自动归类。',
    }]
  })
}
