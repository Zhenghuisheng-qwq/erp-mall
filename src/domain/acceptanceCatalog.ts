import { arrangeSpecPositions } from './logic'
import { reconcilePlanningRecords } from './planning'
import type { AppData, ParamDef, ProductSpecNode, SpecNodeRole } from './types'

export interface ObservedMaterial {
  productType: string
  attrs: Record<string, string>
}

interface Level {
  name: string
  role: SpecNodeRole
}

interface Bundle {
  attrs: Map<string, Map<string, Bundle>>
}

const now = '2026-10-15T12:00:00.000Z'

/**
 * 只在调用方传入的数据上补三套模型。
 * 不改已有手机模型的节点、已发布版本和规划编号。
 * 显示屏玻璃、屏幕膜、笔记本等没有足够明确的规则，这里不生成。
 */
export function installAcceptanceCatalog(data: AppData, observed: ObservedMaterial[]) {
  const before = frozenPhone(data)
  const phoneRows = observed.filter((item) => item.productType === '手机' && filled(item.attrs, ['品牌', '系列', '型号', '容量', '颜色']))
  const padRows = observed.filter((item) => item.productType === '平板电脑' && filled(item.attrs, ['品牌', '系列', '型号', '连接', '容量', '颜色']))
  const caseRows = observed.filter((item) => item.productType === '保护壳' && filled(item.attrs, ['适用品类', '适用品牌', '品牌', '系列', '适用型号', '颜色']))
  const host = data.categories.find((item) => item.name === '主机' && !item.parentId)
  const accessory = data.categories.find((item) => item.name === '配件' && !item.parentId)
  const protect = data.categories.find((item) => item.name === '保护及保护设备' && item.parentId === accessory?.id)
  const phoneType = data.productTypes.find((item) => item.name === '手机' && item.categoryId === 'c-phone')
  if (host && !data.categories.some((item) => item.parentId === host.id && item.name === '平板电脑')) {
    data.categories.push({ id: 'c-excel-tablet', name: '平板电脑', parentId: host.id, sort: 8, enabled: true })
  }
  const tabletCategory = data.categories.find((item) => item.name === '平板电脑' && item.parentId === host?.id)
  if (tabletCategory && !data.productTypes.some((item) => item.categoryId === tabletCategory.id && item.name === '平板电脑')) {
    data.productTypes.push({ id: 'pt-excel-tablet', name: '平板电脑', categoryId: tabletCategory.id, status: 'enabled', sort: 1, description: '来自物料表的平板电脑，不挂在手机下面。' })
  }
  if (protect && !data.productTypes.some((item) => item.categoryId === protect.id && item.name === '保护壳')) {
    data.productTypes.push({ id: 'pt-excel-case', name: '保护壳', categoryId: protect.id, status: 'enabled', sort: 2, description: '保护壳挂在保护及保护设备下，不并进手机。' })
  }
  const tabletType = data.productTypes.find((item) => item.name === '平板电脑' && item.categoryId === tabletCategory?.id)
  const caseType = data.productTypes.find((item) => item.name === '保护壳' && item.categoryId === protect?.id)
  let created = 0
  if (phoneType) created += compile(data, 't-excel-phone', 'Apple 手机', phoneType.id, phoneType.categoryId, [
    { name: '品牌', role: 'COMMON' },
    { name: '系列', role: 'COMMON' },
    { name: '型号', role: 'VARIANT' },
    { name: '容量', role: 'VARIANT' },
    { name: '颜色', role: 'VARIANT' },
  ], phoneRows)
  if (tabletType) created += compile(data, 't-excel-tablet', 'Apple 平板', tabletType.id, tabletType.categoryId, [
    { name: '品牌', role: 'COMMON' },
    { name: '系列', role: 'COMMON' },
    { name: '型号', role: 'VARIANT' },
    { name: '型号备注', role: 'VARIANT' },
    { name: '连接', role: 'VARIANT' },
    { name: '容量', role: 'VARIANT' },
    { name: '颜色', role: 'VARIANT' },
  ], padRows)
  if (caseType) created += compile(data, 't-excel-case', '保护壳', caseType.id, caseType.categoryId, [
    { name: '适用品类', role: 'COMMON' },
    { name: '适用品牌', role: 'COMMON' },
    { name: '品牌', role: 'VARIANT' },
    { name: '系列', role: 'VARIANT' },
    { name: '适用型号', role: 'VARIANT' },
    { name: '颜色', role: 'VARIANT' },
  ], caseRows)
  const after = frozenPhone(data)
  if (before !== after) throw new Error('验收模型改动了原有手机模型')
  return { created }
}

function filled(attrs: Record<string, string>, names: string[]) {
  return names.every((name) => attrs[name])
}

function frozenPhone(data: AppData) {
  const nodes = data.productSpecNodes.filter((item) => item.templateId === 't-phone')
  const version = data.specModelVersions.find((item) => item.id === 'phone-model-v1')
  const plans = (data.planningRecords || []).filter((item) => item.productModelId === 't-phone')
  return JSON.stringify({ nodes, version, plans })
}

function compile(data: AppData, templateId: string, name: string, productTypeId: string, categoryId: string, levels: Level[], rows: ObservedMaterial[]) {
  if (data.templates.some((item) => item.id === templateId) || !rows.length) return 0
  const root: Bundle = { attrs: new Map() }
  rows.forEach((row) => insert(root, levels, 0, row.attrs))
  data.templates.push({ id: templateId, name, parentId: null, enabled: true, structureOrder: levels.map((item) => ensureParam(data, item.name).id) })
  levels.forEach((item) => {
    const param = ensureParam(data, item.name)
    if (!data.templateParams.some((bound) => bound.templateId === templateId && bound.paramId === param.id)) {
      data.templateParams.push({ templateId, paramId: param.id, role: item.role === 'COMMON' ? 'common' : 'variant', required: true })
    }
  })
  if (!data.mappings.some((item) => item.templateId === templateId)) data.mappings.push({ templateId, categoryId })
  const seq = { n: 0 }
  const nodes = emit(data, templateId, null, root, levels, seq)
  arrangeSpecPositions(nodes)
  data.productSpecNodes.push(...nodes)
  data.specCanvases.push({ templateId, productTypeId, name, zoom: 1, panX: 0, panY: 0, status: 'published', version: 1, versionName: 'V1', direction: 'logic', updatedAt: now })
  const versionId = `${templateId}-v1`
  data.specModelVersions.push({ id: versionId, templateId, version: 1, versionName: 'V1', status: 'published', nodesSnapshot: nodes.map((item) => ({ ...item })), createdTime: now, publishTime: now })
  if (!Array.isArray(data.planningRecords)) data.planningRecords = []
  data.planningRecords = reconcilePlanningRecords({ records: data.planningRecords, data, productModelId: templateId, modelVersionId: versionId, nodes, now }).records
  return 1
}

function insert(bundle: Bundle, levels: Level[], index: number, attrs: Record<string, string>) {
  let cursor = index
  while (cursor < levels.length && !attrs[levels[cursor].name]) cursor += 1
  if (cursor >= levels.length) return
  const level = levels[cursor]
  const values = bundle.attrs.get(level.name) || new Map<string, Bundle>()
  bundle.attrs.set(level.name, values)
  const child = values.get(attrs[level.name]) || { attrs: new Map() }
  values.set(attrs[level.name], child)
  insert(child, levels, cursor + 1, attrs)
}

function emit(data: AppData, templateId: string, parentId: string | null, bundle: Bundle, levels: Level[], seq: { n: number }): ProductSpecNode[] {
  const nodes: ProductSpecNode[] = []
  let sort = 1
  bundle.attrs.forEach((values, attrName) => {
    const level = levels.find((item) => item.name === attrName)
    const param = ensureParam(data, attrName)
    const attrId = `${templateId}-n${++seq.n}`
    nodes.push({ id: attrId, templateId, parentId, nodeType: 'ATTRIBUTE', attributeId: param.id, valueId: '', sort: sort++, role: level?.role || 'VARIANT' })
    let valueSort = 1
    values.forEach((child, value) => {
      if (!param.values.includes(value)) param.values.push(value)
      const valueNodeId = `${templateId}-n${++seq.n}`
      nodes.push({ id: valueNodeId, templateId, parentId: attrId, nodeType: 'VALUE', attributeId: param.id, valueId: value, sort: valueSort++ })
      nodes.push(...emit(data, templateId, valueNodeId, child, levels, seq))
    })
  })
  return nodes
}

function ensureParam(data: AppData, name: string): ParamDef {
  const found = data.params.find((item) => item.name === name)
  if (found) return found
  const ids: Record<string, string> = { 适用品类: 'p-fit-kind', 适用品牌: 'p-fit-brand', 适用型号: 'p-fit-model', 型号备注: 'p-model-note' }
  const created: ParamDef = { id: ids[name] || `p-${name}`, name, values: [], valueGroups: [], participateInStructure: true }
  data.params.push(created)
  return created
}
