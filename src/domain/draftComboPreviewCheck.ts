import { previewDraftCombinations, publishImpactText } from './draftComboPreview'
import { legalComboMaterialStatus } from './comboMaterialStatus'
import { legalPlanningCombinations, reconcilePlanningRecords } from './planning'
import type { AppData, ProductSpecNode } from './types'

export interface CheckResult { id: string; ok: boolean; detail: string }

function node(partial: Partial<ProductSpecNode> & Pick<ProductSpecNode, 'id' | 'parentId' | 'nodeType'>): ProductSpecNode {
  return { templateId: 'm', attributeId: '', valueId: '', sort: 1, role: 'VARIANT', ...partial }
}

function tree(withBlue = false): ProductSpecNode[] {
  const rows = [
    node({ id: 'cap', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'p-cap' }),
    node({ id: 'g256', parentId: 'cap', nodeType: 'VALUE', attributeId: 'p-cap', valueId: '256GB' }),
    node({ id: 'c256', parentId: 'g256', nodeType: 'ATTRIBUTE', attributeId: 'p-color' }),
    node({ id: 'black', parentId: 'c256', nodeType: 'VALUE', attributeId: 'p-color', valueId: '黑色' }),
    node({ id: 'white256', parentId: 'c256', nodeType: 'VALUE', attributeId: 'p-color', valueId: '白色', sort: 2 }),
    node({ id: 'g512', parentId: 'cap', nodeType: 'VALUE', attributeId: 'p-cap', valueId: '512GB', sort: 2 }),
    node({ id: 'c512', parentId: 'g512', nodeType: 'ATTRIBUTE', attributeId: 'p-color' }),
    node({ id: 'white512', parentId: 'c512', nodeType: 'VALUE', attributeId: 'p-color', valueId: '白色' }),
  ]
  if (withBlue) rows.push(node({ id: 'blue', parentId: 'c256', nodeType: 'VALUE', attributeId: 'p-color', valueId: '蓝色', sort: 3 }))
  return rows
}

function dataOf(nodes = tree()): AppData {
  return {
    params: [
      { id: 'p-cap', name: '容量', values: ['256GB', '512GB'], valueGroups: [], participateInStructure: true },
      { id: 'p-color', name: '颜色', values: ['黑色', '白色', '蓝色'], valueGroups: [], participateInStructure: true },
    ],
    templates: [{ id: 'm', name: '手机', parentId: null, enabled: true, structureOrder: [] }],
    productTypes: [{ id: 'pt', name: '手机', categoryId: 'c', status: 'enabled', sort: 1, description: '' }],
    specCanvases: [{ templateId: 'm', productTypeId: 'pt', name: '手机', zoom: 1, panX: 0, panY: 0, status: 'draft', version: 1, versionName: 'V1' }],
    specModelVersions: [],
    planningRecords: [],
    materialReceipts: [],
    families: [],
    skus: [],
    rules: [],
    categories: [],
    mappings: [],
    templateParams: [],
    productSpecNodes: nodes,
  } as unknown as AppData
}

function fingerprint(data: AppData) {
  return JSON.stringify({
    versions: data.specModelVersions,
    plans: data.planningRecords,
    families: data.families,
    skus: data.skus,
    nodes: data.productSpecNodes,
    hosts: data.nodeCompatibilityRules || [],
  })
}

export function runDraftComboChecks(): CheckResult[] {
  const results: CheckResult[] = []
  const check = (id: string, ok: boolean, detail: string) => results.push({ id, ok, detail })
  const data = dataOf()
  const before = fingerprint(data)
  const draft = previewDraftCombinations(data, 'm', tree())
  const labels = draft.rows.map((item) => item.label)
  check('A1', draft.problems.length === 0 && draft.rows.length === 3, String(draft.rows.length))
  check('A2', labels.filter((item) => item.includes('256GB') && item.includes('黑色')).length === 1 && labels.filter((item) => item.includes('256GB') && item.includes('白色')).length === 1 && labels.filter((item) => item.includes('512GB') && item.includes('白色')).length === 1, labels.join(' | '))
  check('A3', !labels.some((item) => item.includes('512GB') && item.includes('黑色')), labels.join(' | '))
  check('A5', fingerprint(data) === before && draft.rows.every((item) => item.planningId === '') && !draft.rows.some((item) => /PLN-/.test(item.planningId)), '预览没有写数据')
  check('A6', publishImpactText(draft).includes('准备发布 V1') && publishImpactText(draft).includes('3 条') && publishImpactText(draft).includes('不分配规划编号'), publishImpactText(draft))

  const broken = previewDraftCombinations(data, 'm', [node({ id: 'color', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'p-color' })])
  check('A9', broken.rows.length === 0 && broken.problems.some((item) => item.includes('颜色') && item.includes('取值')) && publishImpactText(broken).startsWith('还不能发布'), broken.problems[0] || '')

  data.specModelVersions.push({
    id: 'v1',
    templateId: 'm',
    version: 1,
    versionName: 'V1',
    status: 'published',
    nodesSnapshot: tree().map((item) => ({ ...item })),
    createdTime: '',
    publishTime: '',
  })
  data.planningRecords = reconcilePlanningRecords({
    records: data.planningRecords,
    data,
    productModelId: 'm',
    modelVersionId: 'v1',
    nodes: tree(),
    now: '2026-10-21T00:00:00.000Z',
  }).records
  const planCount = data.planningRecords.length
  const snap = JSON.stringify(data.specModelVersions[0].nodesSnapshot)
  const next = previewDraftCombinations(data, 'm', tree(true))
  const formal = legalPlanningCombinations(data, 'm', data.specModelVersions[0].nodesSnapshot)
  const status = legalComboMaterialStatus(data, 'm', 'v1')
  check('A4', next.rows.length === 4 && next.rows.some((item) => item.label.includes('蓝色')) && !next.rows.some((item) => item.label.includes('512GB') && item.label.includes('黑色')), String(next.rows.length))
  check('A8', formal.length === 3 && status.rows.length === 3 && JSON.stringify(data.specModelVersions[0].nodesSnapshot) === snap && data.planningRecords.length === planCount, `正式 ${formal.length} 规划 ${data.planningRecords.length}`)
  check('A10', next.added === 1 && next.reused === 3 && next.previousCount === 3 && next.nextVersionName === 'V2' && next.previousVersionName === 'V1' && !next.sameAsPublished && next.rows.filter((item) => !item.planningId).length === 1 && next.rows.filter((item) => item.planningId).every((item) => /^PLN-/.test(item.planningId)), publishImpactText(next))
  const aligned = previewDraftCombinations(data, 'm', tree())
  check('C5', aligned.sameAsPublished && aligned.added === 0 && aligned.reused === 3 && publishImpactText(aligned).includes('不会生成新版本'), publishImpactText(aligned))
  return results
}
