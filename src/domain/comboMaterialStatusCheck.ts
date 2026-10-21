import { legalComboMaterialStatus } from './comboMaterialStatus'
import { createV3Material, updateV3Material } from './material'
import { reconcilePlanningRecords } from './planning'
import { createSeed } from './seed'
import type { AppData, PlanningRecord, ProductSpecNode, Sku } from './types'

export interface CheckResult { id: string; ok: boolean; detail: string }

function spec(partial: Partial<ProductSpecNode> & Pick<ProductSpecNode, 'id' | 'parentId' | 'nodeType'>): ProductSpecNode {
  return { templateId: 'm', attributeId: '', valueId: '', sort: 1, role: 'VARIANT', ...partial }
}

function nodes(): ProductSpecNode[] {
  return [
    spec({ id: 'cap', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'p-cap', sort: 1 }),
    spec({ id: 'v128', parentId: 'cap', nodeType: 'VALUE', attributeId: 'p-cap', valueId: '128GB' }),
    spec({ id: 'color', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'p-color', sort: 2 }),
    spec({ id: 'black', parentId: 'color', nodeType: 'VALUE', attributeId: 'p-color', valueId: '黑色' }),
    spec({ id: 'white', parentId: 'color', nodeType: 'VALUE', attributeId: 'p-color', valueId: '白色', sort: 2 }),
  ]
}

function dataOf(): AppData {
  return {
    params: [
      { id: 'p-cap', name: '容量', values: [], valueGroups: [], participateInStructure: true },
      { id: 'p-color', name: '颜色', values: [], valueGroups: [], participateInStructure: true },
    ],
    templates: [{ id: 'm', name: '手机模型', parentId: null, enabled: true, structureOrder: [] }],
    productTypes: [{ id: 'pt', name: '手机', categoryId: 'c', status: 'enabled', sort: 1, description: '' }],
    specCanvases: [{ templateId: 'm', productTypeId: 'pt', name: '手机模型', zoom: 1, panX: 0, panY: 0, status: 'published', version: 1, versionName: 'V1' }],
    specModelVersions: [],
    planningRecords: [] as PlanningRecord[],
    materialReceipts: [],
    families: [],
    skus: [],
    rules: [],
    categories: [],
    mappings: [],
    templateParams: [],
    productSpecNodes: nodes(),
  } as unknown as AppData
}

function publish(data: AppData, versionId: string, tree = nodes()) {
  data.specModelVersions.push({
    id: versionId,
    templateId: 'm',
    version: data.specModelVersions.length + 1,
    versionName: versionId === 'v1' ? 'V1' : 'V2',
    status: 'published',
    nodesSnapshot: tree.map((item) => ({ ...item })),
    createdTime: '',
    publishTime: '',
  })
  data.planningRecords = reconcilePlanningRecords({
    records: data.planningRecords,
    data,
    productModelId: 'm',
    modelVersionId: versionId,
    nodes: tree,
    now: '2026-10-20T00:00:00.000Z',
  }).records
}

function create(data: AppData, planningId: string, requestId: string, versionId: string, skuName?: string) {
  let seq = data.skus.length + data.families.length
  return createV3Material(data, {
    productModelId: 'm',
    modelVersionId: versionId,
    planningId,
    requestId,
    categoryId: 'c',
    productTypeId: 'pt',
    skuName,
    now: '2026-10-20T01:00:00.000Z',
    nextId: (prefix) => `${prefix}-${++seq}`,
  })
}

function fingerprint(data: AppData) {
  return JSON.stringify({
    versions: data.specModelVersions,
    plans: data.planningRecords,
    families: data.families.map((item) => ({ id: item.id, name: item.name })),
    skus: data.skus.map((item) => ({
      id: item.id,
      skuName: item.skuName,
      materialCode: item.materialCode,
      planningId: item.planningId,
      modelVersionId: item.modelVersionId,
      nameSource: item.nameSource,
      suggestedName: item.suggestedName,
      namingNodeId: item.namingNodeId,
    })),
    receipts: data.materialReceipts,
  })
}

function rowOf(data: AppData, versionId: string, valueId: string) {
  return legalComboMaterialStatus(data, 'm', versionId).rows.find((item) => item.label.includes(valueId))
}

export function runComboMaterialStatusChecks(): CheckResult[] {
  const results: CheckResult[] = []
  const check = (id: string, ok: boolean, detail: string) => results.push({ id, ok, detail })
  const data = dataOf()
  publish(data, 'v1')
  const black = data.planningRecords.find((item) => item.steps.some((step) => step.valueId === '黑色'))
  const white = data.planningRecords.find((item) => item.steps.some((step) => step.valueId === '白色'))
  const beforeOpen = fingerprint(data)
  const opened = legalComboMaterialStatus(data, 'm', 'v1')
  const blackOpen = opened.rows.find((item) => item.label.includes('黑色'))
  const whiteOpen = opened.rows.find((item) => item.label.includes('白色'))
  check('A', Boolean(black && white && blackOpen?.planningLabel && whiteOpen?.planningLabel && blackOpen.materialCount === 0 && !blackOpen.filed && whiteOpen.materialCount === 0 && !whiteOpen.filed && fingerprint(data) === beforeOpen), `黑 ${blackOpen?.materialCount} 白 ${whiteOpen?.materialCount}`)

  const first = black ? create(data, black.planningId, 'b1', 'v1') : { ok: false as const, message: 'missing' }
  const one = rowOf(data, 'v1', '黑色')
  const firstSku = data.skus.find((item) => first.ok && item.id === first.skuId)
  check('B', Boolean(first.ok && one?.filed && one.materialCount === 1 && one.materials[0]?.materialCode === firstSku?.materialCode && one.materials[0]?.skuName === firstSku?.skuName && one.materials[0]?.skuName), `${one?.materialCount} ${one?.materials[0]?.skuName || ''}`)

  const second = black ? create(data, black.planningId, 'b2', 'v1', '第二份档案名') : { ok: false as const, message: 'missing' }
  const two = rowOf(data, 'v1', '黑色')
  const codes = new Set(two?.materials.map((item) => item.materialCode))
  check('C', Boolean(second.ok && two?.materialCount === 2 && codes.size === 2 && two.materials.some((item) => item.skuName === '第二份档案名') && two.materials.some((item) => item.skuName === firstSku?.skuName)), two?.materials.map((item) => `${item.materialCode}:${item.skuName}`).join(' | ') || '')

  const renamed = first.ok ? updateV3Material(data, { skuId: first.skuId, skuName: '柜台最终名', supplierCode: '', guanjiapoCode: '', oaSkuId: '', materialDescription: '', now: '2026-10-20T02:00:00.000Z' }) : { ok: false as const }
  const edited = data.skus.find((item) => first.ok && item.id === first.skuId)
  const shown = rowOf(data, 'v1', '黑色')?.materials.find((item) => item.skuId === edited?.id)
  check('D', Boolean(renamed.ok && edited?.nameSource === 'manual' && edited.suggestedName && shown?.skuName === '柜台最终名' && shown.skuName !== edited.suggestedName && shown.nameSource === 'manual'), `${shown?.skuName || ''} / 建议 ${edited?.suggestedName || ''}`)

  const decoy: Sku = {
    ...(firstSku as Sku),
    id: 'decoy-name',
    familyId: firstSku?.familyId || 'fam',
    planningId: white?.planningId,
    modelVersionId: 'v1',
    skuName: shown?.skuName || '柜台最终名',
    materialCode: 'MAT-DECOY',
    nameSource: 'manual',
  }
  data.skus.push(decoy)
  const blackRow = rowOf(data, 'v1', '黑色')
  const whiteRow = rowOf(data, 'v1', '白色')
  const separated = Boolean(blackRow && whiteRow && blackRow.materialCount === 2 && whiteRow.materialCount === 1 && whiteRow.materials[0]?.materialCode === 'MAT-DECOY' && blackRow.materials.every((item) => item.materialCode !== 'MAT-DECOY') && !blackRow.materials.some((item) => item.skuId === 'decoy-name'))
  check('E', separated, `黑 ${blackRow?.materials.map((item) => item.materialCode).join(',')} 白 ${whiteRow?.materials.map((item) => item.materialCode).join(',')}`)

  publish(data, 'v2', nodes())
  const third = black ? create(data, black.planningId, 'b3', 'v2', '二版物料') : { ok: false as const, message: 'missing' }
  const onV1 = rowOf(data, 'v1', '黑色')
  const onV2 = rowOf(data, 'v2', '黑色')
  const whiteV2 = rowOf(data, 'v2', '白色')
  const snapshotV1 = JSON.stringify(data.specModelVersions.find((item) => item.id === 'v1')?.nodesSnapshot)
  check('F', Boolean(third.ok && onV1?.materialCount === 2 && onV1.materials.every((item) => item.modelVersionId === 'v1') && onV2?.materialCount === 1 && onV2.materials[0]?.skuName === '二版物料' && onV2.materials[0]?.modelVersionId === 'v2' && whiteV2?.materialCount === 0 && data.specModelVersions.find((item) => item.id === 'v1')), `V1 ${onV1?.materialCount} V2 ${onV2?.materials.map((item) => item.skuName).join(',')}`)

  const blank = data.skus.find((item) => item.materialCode === 'MAT-DECOY')
  if (blank) blank.skuName = ''
  const odd = data.skus.find((item) => second.ok && item.id === second.skuId)
  const oddName = odd?.skuName
  if (odd) odd.modelVersionId = 'not-a-version'
  data.materialReceipts.push({ requestId: 'ghost', skuId: 'missing-sku', planningId: black?.planningId || '', materialCode: 'MAT-GHOST', createdTime: 't', lifecycle: 'active' })
  const skuCount = data.skus.length
  const familyCount = data.families.length
  const planCount = data.planningRecords.length
  const broken = legalComboMaterialStatus(data, 'm', 'v1')
  const brokenBlack = broken.rows.find((item) => item.label.includes('黑色'))
  const brokenWhite = broken.rows.find((item) => item.label.includes('白色'))
  const blankCard = brokenWhite?.materials.find((item) => item.materialCode === 'MAT-DECOY')
  const ghostCreated = data.skus.some((item) => item.materialCode === 'MAT-GHOST' || item.id === 'missing-sku')
  const oddUntouched = data.skus.find((item) => item.id === odd?.id)?.skuName === oddName && data.skus.find((item) => item.id === odd?.id)?.modelVersionId === 'not-a-version'
  const reported = Boolean(brokenBlack?.anomalies.some((item) => item.includes('没有重建')) && brokenBlack.anomalies.some((item) => item.includes('未关联')) && !brokenBlack.materials.some((item) => item.materialCode === 'MAT-GHOST' || item.skuId === odd?.id))
  check('G', Boolean(blankCard && blankCard.skuName === '' && !blankCard.skuName.includes('容量') && reported && !ghostCreated && oddUntouched && data.skus.length === skuCount), `空名「${blankCard?.skuName}」 异常 ${brokenBlack?.anomalies.join(' / ')}`)

  const again = JSON.stringify(legalComboMaterialStatus(data, 'm', 'v1'))
  const twice = JSON.stringify(legalComboMaterialStatus(data, 'm', 'v1'))
  check('H', again === twice && JSON.stringify(data.specModelVersions.find((item) => item.id === 'v1')?.nodesSnapshot) === snapshotV1, '重复读取结果一致')

  const seed = createSeed()
  const seedBefore = fingerprint(seed)
  const seedView = legalComboMaterialStatus(seed, 't-phone', 'phone-model-v1')
  const countsHeld = data.skus.length === skuCount && data.families.length === familyCount && data.planningRecords.length === planCount
  check('I', Boolean(seedView.rows.length > 0 && seedView.rows.every((item) => item.materialCount === 0) && fingerprint(seed) === seedBefore && countsHeld && !seed.planningRecords.length), `正式组合 ${seedView.rows.length} 条，规划仍是 ${seed.planningRecords.length}`)

  const draft = data.productSpecNodes.find((item) => item.id === 'black')
  if (draft) draft.valueId = '草稿黑'
  const afterDraft = rowOf(data, 'v1', '黑色')
  check('J-read', Boolean(afterDraft?.label.includes('黑色') && !afterDraft.label.includes('草稿黑') && data.specModelVersions.find((item) => item.id === 'v1')?.nodesSnapshot.find((item) => item.id === 'black')?.valueId === '黑色'), afterDraft?.label || '')
  return results
}
