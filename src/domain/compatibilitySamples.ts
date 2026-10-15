import { arrangeSpecPositions } from './logic'
import { createTemporaryMaterial, nextMaterialCode } from './material'
import { reconcilePlanningRecords } from './planning'
import { listHostModels } from './compatibility'
import type { AppData, ProductSpecNode, SpecNodeRole } from './types'

const now = '2026-10-15T16:00:00.000Z'

/** 只补测试样例。不改原手机模型，也不把这些物料说成 Excel 已导入。 */
export function installCompatibilitySamples(data: AppData, nextId: (prefix: string) => string) {
  const before = JSON.stringify({
    nodes: data.productSpecNodes.filter((item) => item.templateId === 't-phone'),
    version: data.specModelVersions.find((item) => item.id === 'phone-model-v1'),
    plans: (data.planningRecords || []).filter((item) => item.productModelId === 't-phone'),
  })
  ensureHostModel(data)
  const protect = data.categories.find((item) => item.name === '保护及保护设备')
  if (protect && !data.productTypes.some((item) => item.categoryId === protect.id && item.name === '屏幕膜')) {
    data.productTypes.push({ id: 'pt-sample-film', name: '屏幕膜', categoryId: protect.id, status: 'enabled', sort: 3, description: '测试样例。颜色在真实表格里可能是高清、防窥，这里不重新定义。' })
  }
  if (protect && !data.productTypes.some((item) => item.categoryId === protect.id && item.name === '保护壳')) {
    data.productTypes.push({ id: 'pt-sample-case', name: '保护壳', categoryId: protect.id, status: 'enabled', sort: 4, description: '测试样例。不是 Excel 导入的 288 条保护壳。' })
  }
  const filmType = data.productTypes.find((item) => item.name === '屏幕膜' && item.categoryId === protect?.id)
  const caseType = data.productTypes.find((item) => item.name === '保护壳' && item.categoryId === protect?.id)
  const filmA = ensureSku(data, nextId, filmType?.id || '', filmType?.categoryId || '', 'sample-film-a', '【测试样例】高清膜')
  const filmB = ensureSku(data, nextId, filmType?.id || '', filmType?.categoryId || '', 'sample-film-b', '【测试样例】防窥膜')
  const caseSku = ensureSku(data, nextId, caseType?.id || '', caseType?.categoryId || '', 'sample-case', '【测试样例】保护壳')
  const hosts = listHostModels(data).filter((item) => item.sample)
  const after = JSON.stringify({
    nodes: data.productSpecNodes.filter((item) => item.templateId === 't-phone'),
    version: data.specModelVersions.find((item) => item.id === 'phone-model-v1'),
    plans: (data.planningRecords || []).filter((item) => item.productModelId === 't-phone'),
  })
  if (before !== after) throw new Error('测试样例改动了原有手机模型')
  return { hosts, filmA, filmB, caseSku }
}

function ensureSku(data: AppData, nextId: (prefix: string) => string, productTypeId: string, categoryId: string, requestId: string, skuName: string) {
  if (!productTypeId || !categoryId) return ''
  const existed = data.materialReceipts?.find((item) => item.requestId === requestId)
  if (existed) return existed.skuId
  const param = data.params.find((item) => item.name === '品牌')
  const result = createTemporaryMaterial(data, {
    requestId,
    categoryId,
    productTypeId,
    attrs: param ? [{ attributeId: param.id, value: '测试样例', source: 'manual' }] : [],
    materialCode: nextMaterialCode(data),
    skuName,
    now,
    nextId,
  })
  return result.ok ? result.skuId : ''
}

function ensureHostModel(data: AppData) {
  if (data.templates.some((item) => item.id === 't-compat-sample')) return
  const phone = data.productTypes.find((item) => item.id === 'pt-phone')
  if (!phone) return
  const levels: { name: string; role: SpecNodeRole }[] = [
    { name: '品牌', role: 'COMMON' },
    { name: '系列', role: 'COMMON' },
    { name: '型号', role: 'VARIANT' },
    { name: '容量', role: 'VARIANT' },
    { name: '颜色', role: 'VARIANT' },
  ]
  const rows = [
    ['Apple', 'iPhone 17', 'iPhone 17 Pro Max', '256GB', '黑色'],
    ['Apple', 'iPhone 17', 'iPhone 17 Pro Max', '256GB', '白色'],
    ['Apple', 'iPhone 18', 'iPhone 18 Pro Max', '256GB', '黑色'],
  ]
  data.templates.push({ id: 't-compat-sample', name: '测试样例 · 主机型号', parentId: null, enabled: true, structureOrder: levels.map((item) => paramId(data, item.name)) })
  levels.forEach((item) => data.templateParams.push({ templateId: 't-compat-sample', paramId: paramId(data, item.name), role: item.role === 'COMMON' ? 'common' : 'variant', required: true }))
  data.mappings.push({ templateId: 't-compat-sample', categoryId: phone.categoryId })
  const nodes = rowsToNodes(data, 't-compat-sample', levels, rows)
  arrangeSpecPositions(nodes)
  data.productSpecNodes.push(...nodes)
  data.specCanvases.push({ templateId: 't-compat-sample', productTypeId: phone.id, name: '测试样例 · 主机型号', zoom: 1, panX: 0, panY: 0, status: 'published', version: 1, versionName: 'V1', direction: 'logic', updatedAt: now })
  data.specModelVersions.push({ id: 't-compat-sample-v1', templateId: 't-compat-sample', version: 1, versionName: 'V1', status: 'published', nodesSnapshot: nodes.map((item) => ({ ...item })), createdTime: now, publishTime: now })
  if (!Array.isArray(data.planningRecords)) data.planningRecords = []
  data.planningRecords = reconcilePlanningRecords({ records: data.planningRecords, data, productModelId: 't-compat-sample', modelVersionId: 't-compat-sample-v1', nodes, now }).records
}

function paramId(data: AppData, name: string) {
  const found = data.params.find((item) => item.name === name)
  if (!found) throw new Error(`缺少属性 ${name}`)
  return found.id
}

function rowsToNodes(data: AppData, templateId: string, levels: { name: string; role: SpecNodeRole }[], rows: string[][]) {
  type Bundle = { attrs: Map<string, Map<string, Bundle>> }
  const root: Bundle = { attrs: new Map() }
  rows.forEach((row) => {
    let cursor = root
    levels.forEach((level, index) => {
      const values = cursor.attrs.get(level.name) || new Map<string, Bundle>()
      cursor.attrs.set(level.name, values)
      const child = values.get(row[index]) || { attrs: new Map() }
      values.set(row[index], child)
      cursor = child
    })
  })
  const seq = { n: 0 }
  const walk = (bundle: Bundle, parentId: string | null): ProductSpecNode[] => {
    const nodes: ProductSpecNode[] = []
    let sort = 1
    bundle.attrs.forEach((values, name) => {
      const level = levels.find((item) => item.name === name)
      const attributeId = paramId(data, name)
      const attrId = `${templateId}-n${++seq.n}`
      nodes.push({ id: attrId, templateId, parentId, nodeType: 'ATTRIBUTE', attributeId, valueId: '', sort: sort++, role: level?.role || 'VARIANT' })
      let valueSort = 1
      values.forEach((child, value) => {
        const param = data.params.find((item) => item.id === attributeId)
        if (param && !param.values.includes(value)) param.values.push(value)
        const valueId = `${templateId}-n${++seq.n}`
        nodes.push({ id: valueId, templateId, parentId: attrId, nodeType: 'VALUE', attributeId, valueId: value, sort: valueSort++ })
        nodes.push(...walk(child, valueId))
      })
    })
    return nodes
  }
  return walk(root, null)
}
