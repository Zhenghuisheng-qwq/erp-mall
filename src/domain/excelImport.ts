import { latestPublishedVersion } from './logic'
import { createTemporaryMaterial, createV3Material, nextMaterialCode, type MaterialCreateResult } from './material'
import type { AppData } from './types'

export type SheetKind = 'material' | 'notes' | 'service' | 'special' | 'dictionary' | 'unknown'
export type ColumnTarget = 'ignore' | 'guanjiapo' | 'legacyName' | 'stock' | 'supplier' | 'skuName' | 'category' | 'productType' | 'manage' | 'attrName' | 'attrValue'

export interface SheetProfile {
  name: string
  kind: SheetKind
  title: string
  reason: string
  headers: string[]
  rows: string[][]
  sample: string[]
}

export interface ColumnMapping {
  index: number
  header: string
  target: ColumnTarget
  sample: string
}

export type ImportBlock = 'empty' | 'imported' | 'category' | 'product-type' | 'model' | 'model-choice' | 'spec' | 'source' | 'ambiguous' | 'formal' | 'temporary'

export interface ImportPreviewRow {
  sheet: string
  rowNumber: number
  supplierCode: string
  guanjiapoCode: string
  skuName: string
  legacyName: string
  categoryName: string
  productTypeName: string
  attrs: { name: string; value: string }[]
  status: 'ready' | 'blocked'
  action: 'formal' | 'temporary' | 'skip'
  block: ImportBlock
  groupKey: string
  planningId: string
  categoryId: string
  productTypeId: string
  productModelId: string
  modelVersionId: string
  message: string
  requestId: string
}

export interface ValueAlias {
  attributeName: string
  from: string
  to: string
  reason: string
}

export interface PreviewOptions {
  aliases?: ValueAlias[]
  temporaryGroups?: string[]
  modelChoice?: Record<string, string>
}

export interface ImportGroup {
  key: string
  block: ImportBlock
  count: number
  title: string
  detail: string
  href: string
  allowTemporary: boolean
  productTypeId: string
  models: { id: string; name: string }[]
}

export function classifySheet(name: string, headers: string[]): { kind: SheetKind; title: string; reason: string } {
  if (name.includes('属性的定义') || name.includes('属性定义')) return { kind: 'dictionary', title: '属性说明', reason: '这是属性定义说明，不是物料清单，本轮不导入成商品。' }
  if (name.includes('增值服务')) return { kind: 'service', title: '增值服务', reason: '这是服务项目说明，不是普通商品物料，本轮不导入。' }
  if (name.includes('特殊物料')) return { kind: 'special', title: '特殊物料', reason: '这里是优惠券、费用等特殊记录，和普通商品规格不是同一类，本轮不导入。' }
  if (name.includes('公用产品') || name.includes('非公用')) return { kind: 'notes', title: '管理说明', reason: '这是公用和非公用物料的说明，不是一行一条的物料表，本轮不导入。' }
  if (headers.includes('供应商编码') && headers.some((item) => /^属性\d+$/.test(item))) return { kind: 'material', title: '物料表', reason: '识别到供应商编码和成对的属性列，可以预览后导入。' }
  return { kind: 'unknown', title: '未能识别', reason: '看不出这是物料表，不会自动导入。' }
}

export function readSheet(name: string, matrix: unknown[][]): SheetProfile {
  const rows = matrix.map((row) => (Array.isArray(row) ? row : []).map((cell) => cell == null ? '' : String(cell).trim()))
  const headers = rows[0] || []
  const data = rows.slice(1).filter((row) => row.some((cell) => cell))
  const kind = classifySheet(name, headers)
  return { name, ...kind, headers, rows: data, sample: data[0] || [] }
}

export function suggestMapping(headers: string[], sample: string[]): ColumnMapping[] {
  return headers.map((header, index) => ({
    index,
    header,
    target: targetOf(header),
    sample: sample[index] || '',
  }))
}

function targetOf(header: string): ColumnTarget {
  if (header === '9.0管家婆') return 'guanjiapo'
  if (header === '9.0物料描述') return 'legacyName'
  if (header.includes('库存')) return 'stock'
  if (header === '供应商编码') return 'supplier'
  if (header.includes('物料描述')) return 'skuName'
  if (header === '一级' || header === '二级' || header === '三级') return 'category'
  if (header === '产品类型') return 'productType'
  if (header === '管理方式') return 'manage'
  if (/^属性\d+$/.test(header)) return 'attrName'
  if (/^属\d+值$/.test(header)) return 'attrValue'
  return 'ignore'
}

function cell(row: string[], mapping: ColumnMapping[], target: ColumnTarget) {
  const found = mapping.find((item) => item.target === target)
  return found ? row[found.index] || '' : ''
}

function categoriesOf(row: string[], mapping: ColumnMapping[]) {
  return mapping.filter((item) => item.target === 'category').map((item) => row[item.index] || '').filter(Boolean)
}

function attributesOf(row: string[], mapping: ColumnMapping[]) {
  const names = mapping.filter((item) => item.target === 'attrName')
  return names.flatMap((item) => {
    const valueColumn = mapping.find((column) => column.target === 'attrValue' && column.header.replace('值', '') === item.header.replace('属性', '属'))
    const name = row[item.index] || ''
    const value = valueColumn ? row[valueColumn.index] || '' : ''
    if (!name || !value) return []
    return [{ name, value }]
  })
}

export function resolveCategoryPath(data: AppData, names: string[]) {
  let parentId: string | null = null
  let current: AppData['categories'][number] | undefined
  for (const name of names) {
    const found = data.categories.find((item) => item.name === name && (item.parentId || null) === parentId)
    if (!found) return { category: undefined, missing: name, parent: current }
    current = found
    parentId = found.id
  }
  return { category: current, missing: '', parent: undefined }
}

export function observedMaterials(sheet: SheetProfile, mapping: ColumnMapping[]) {
  return sheet.rows.map((row) => ({
    productType: cell(row, mapping, 'productType'),
    attrs: Object.fromEntries(attributesOf(row, mapping).map((item) => [item.name, item.value])),
  }))
}

export function suggestValueAliases(data: AppData, sheet: SheetProfile, mapping: ColumnMapping[]): ValueAlias[] {
  const modelValues = new Set<string>()
  data.specModelVersions.filter((item) => item.status === 'published').forEach((item) => {
    item.nodesSnapshot.forEach((node) => {
      const name = data.params.find((param) => param.id === node.attributeId)?.name
      if (node.nodeType === 'VALUE' && name === '容量') modelValues.add(node.valueId)
    })
  })
  const seen = new Set<string>()
  const aliases: ValueAlias[] = []
  sheet.rows.forEach((row) => {
    attributesOf(row, mapping).forEach((item) => {
      const matched = /^(\d+)GB$/i.exec(item.value)
      if (item.name !== '容量' || !matched) return
      const to = `${matched[1]}G`
      if (!modelValues.has(to) || modelValues.has(item.value) || seen.has(item.value)) return
      seen.add(item.value)
      aliases.push({ attributeName: '容量', from: item.value, to, reason: `容量「${item.value}」和模型里的「${to}」是同一容量，只是单位写法不同。确认后才参与匹配。` })
    })
  })
  return aliases
}

function findProductType(data: AppData, categoryId: string, name: string) {
  return data.productTypes.find((item) => item.categoryId === categoryId && item.name === name)
}

function publishedOf(data: AppData, productTypeId: string) {
  return data.specCanvases.filter((item) => item.productTypeId === productTypeId).flatMap((item) => {
    const version = latestPublishedVersion(data, item.templateId)
    return version ? [{ id: item.templateId, name: item.name || item.templateId, version }] : []
  })
}

export function countBlocks(rows: ImportPreviewRow[]) {
  const counts: Record<ImportBlock, number> = { empty: 0, imported: 0, category: 0, 'product-type': 0, model: 0, 'model-choice': 0, spec: 0, source: 0, ambiguous: 0, formal: 0, temporary: 0 }
  rows.forEach((item) => { counts[item.block] += 1 })
  return counts
}

export function previewGroups(data: AppData, rows: ImportPreviewRow[]): ImportGroup[] {
  const buckets = new Map<string, ImportPreviewRow[]>()
  rows.forEach((item) => {
    if (item.block === 'formal' || item.block === 'empty') return
    const list = buckets.get(item.groupKey) || []
    list.push(item)
    buckets.set(item.groupKey, list)
  })
  return [...buckets.values()].map((list) => {
    const first = list[0]
    const models = first.block === 'model-choice' ? publishedOf(data, first.productTypeId) : []
    const href = first.block === 'category' ? '/categories' : first.block === 'product-type' ? '/product-types' : first.productModelId ? `/specs?template=${first.productModelId}` : '/models'
    return {
      key: first.groupKey,
      block: first.block,
      count: list.length,
      title: blockTitle(first.block),
      detail: first.message.replace(/供应商编码和上面第 \d+ 行相同，仍会分成两条物料。/g, ''),
      href,
      allowTemporary: first.block === 'spec' || first.block === 'source' || first.block === 'temporary',
      productTypeId: first.productTypeId,
      models: models.map((item) => ({ id: item.id, name: item.name })),
    }
  }).sort((a, b) => b.count - a.count)
}

function blockTitle(block: ImportBlock) {
  if (block === 'imported') return '已经导入'
  if (block === 'category') return '分类还没配好'
  if (block === 'product-type') return '产品类型还没配好'
  if (block === 'model') return '商品模型还没发布'
  if (block === 'model-choice') return '要指定商品模型'
  if (block === 'spec') return '规格值对不上'
  if (block === 'source') return '源数据缺字段'
  if (block === 'ambiguous') return '对上了多条规划'
  if (block === 'temporary') return '已确认按临时物料导入'
  return '不能导入'
}

export function previewSheet(data: AppData, sheet: SheetProfile, mapping: ColumnMapping[], fileKey: string, options: PreviewOptions = {}): ImportPreviewRow[] {
  if (sheet.kind !== 'material') return []
  const aliases = options.aliases || []
  const temporaryGroups = new Set(options.temporaryGroups || [])
  const seenSupplier = new Map<string, number>()
  return sheet.rows.map((row, index) => {
    const rowNumber = index + 2
    const supplierCode = cell(row, mapping, 'supplier')
    const guanjiapoCode = cell(row, mapping, 'guanjiapo')
    const skuName = cell(row, mapping, 'skuName')
    const legacyName = cell(row, mapping, 'legacyName')
    const productTypeName = cell(row, mapping, 'productType')
    const categoryNames = categoriesOf(row, mapping)
    const attrs = attributesOf(row, mapping)
    const requestId = `excel:${fileKey}:${sheet.name}:${rowNumber}:${guanjiapoCode}`
    const dup = supplierCode && seenSupplier.get(supplierCode)
    if (supplierCode) seenSupplier.set(supplierCode, rowNumber)
    const withDup = (message: string) => `${dup ? `供应商编码和上面第 ${dup} 行相同，仍会分成两条物料。` : ''}${message}`
    const base = { sheet: sheet.name, rowNumber, supplierCode, guanjiapoCode, skuName, legacyName, categoryName: categoryNames.join(' / '), productTypeName, attrs, requestId, planningId: '', categoryId: '', productTypeId: '', productModelId: '', modelVersionId: '', groupKey: '' }
    const finish = (block: ImportBlock, status: 'ready' | 'blocked', action: 'formal' | 'temporary' | 'skip', message: string, extra: Partial<ImportPreviewRow> = {}): ImportPreviewRow => {
      const groupKey = extra.groupKey || groupOf(block, extra.productTypeId || '', extra.categoryId || '', message)
      const temporary = (block === 'spec' || block === 'source') && temporaryGroups.has(groupKey)
      if (temporary) return { ...base, ...extra, block: 'temporary', status: 'ready', action: 'temporary', groupKey, message: withDup('已确认按临时物料导入，不占用正式规划编号。') }
      return { ...base, ...extra, block, status, action, groupKey, message: withDup(message) }
    }
    if (!skuName && !supplierCode && !guanjiapoCode) return finish('empty', 'blocked', 'skip', '空行', { groupKey: 'empty' })
    const receipt = (data.materialReceipts || []).find((item) => item.requestId === requestId)
    if (receipt) {
      const sku = data.skus.find((item) => item.id === receipt.skuId)
      const record = (data.planningRecords || []).find((item) => item.planningId === (sku?.planningId || receipt.planningId))
      const kind = record?.origin === 'temporary' || (sku?.planningId || '').startsWith('TMP-') ? '临时物料' : '正式物料'
      return finish('imported', 'blocked', 'skip', `这条来源已经导入过，当时记为${kind}，编码 ${sku?.materialCode || receipt.materialCode}。不会再自动建一条，也不会把临时物料改成正式规划。`, { groupKey: 'imported' })
    }
    const located = resolveCategoryPath(data, categoryNames)
    if (!located.category) {
      const where = located.parent ? `「${located.parent.name}」下面没有「${located.missing}」` : `顶层没有「${located.missing || '分类'}」`
      return finish('category', 'blocked', 'skip', `分类还没配好：${where}。`, { groupKey: `category:${located.parent?.id || 'root'}:${located.missing}` })
    }
    const productType = findProductType(data, located.category.id, productTypeName)
    if (!productType) return finish('product-type', 'blocked', 'skip', `分类「${located.category.name}」下还没有产品类型「${productTypeName || '空'}」。表格里的类型名称保持原样，不会改挂到别的分类。`, { categoryId: located.category.id, groupKey: `type:${located.category.id}:${productTypeName}` })
    const published = publishedOf(data, productType.id)
    const locatedIds = { categoryId: located.category.id, productTypeId: productType.id }
    if (!published.length) return finish('model', 'blocked', 'skip', `产品类型「${productType.name}」还没有已发布的商品模型。`, { ...locatedIds, groupKey: `model:${productType.id}` })
    const chosenId = published.length === 1 ? published[0].id : options.modelChoice?.[productType.id] || ''
    const chosen = published.find((item) => item.id === chosenId)
    if (!chosen) return finish('model-choice', 'blocked', 'skip', `产品类型「${productType.name}」有 ${published.length} 个已发布模型，需要指定用哪一个。`, { ...locatedIds, groupKey: `choice:${productType.id}` })
    const records = (data.planningRecords || []).filter((item) => item.origin !== 'temporary' && item.status === 'active' && item.productModelId === chosen.id && item.modelVersionIds.includes(chosen.version.id) && item.steps.length)
    if (!records.length) return finish('model', 'blocked', 'skip', `模型「${chosen.name}」还没有规划编号。发布一次后再匹配，不会先按临时物料导入。`, { ...locatedIds, productModelId: chosen.id, modelVersionId: chosen.version.id, groupKey: `numbers:${chosen.id}` })
    const allowed = new Map<string, Set<string>>()
    records.forEach((item) => item.steps.forEach((step) => {
      const values = allowed.get(step.attributeName) || new Set<string>()
      values.add(step.valueId)
      allowed.set(step.attributeName, values)
    }))
    const byName = new Map(attrs.map((item) => [item.name, item.value]))
    const normalized = new Map<string, string>()
    byName.forEach((value, name) => {
      const rule = aliases.find((item) => item.attributeName === name && item.from === value)
      normalized.set(name, rule && allowed.get(name)?.has(rule.to) ? rule.to : value)
    })
    const required = [...allowed.keys()].filter((name) => records.every((item) => item.steps.some((step) => step.attributeName === name)))
    const missing = required.filter((name) => !byName.get(name))
    const modelIds = { ...locatedIds, productModelId: chosen.id, modelVersionId: chosen.version.id }
    if (missing.length) return finish('source', 'blocked', 'skip', `源数据缺少${missing.map((name) => `「${name}」`).join('')}，对不上完整规划。`, { ...modelIds, groupKey: `source:${productType.id}:${missing.slice().sort().join('+')}` })
    const hits = records.filter((item) => item.steps.every((step) => normalized.get(step.attributeName) === step.valueId))
    if (hits.length > 1) return finish('ambiguous', 'blocked', 'skip', '对上了多条规划，没有自动挑选。', { ...modelIds, groupKey: `ambiguous:${productType.id}` })
    if (hits.length === 1) return finish('formal', 'ready', 'formal', `将挂到规划 ${hits[0].planningId}。`, { ...modelIds, planningId: hits[0].planningId, groupKey: `formal:${hits[0].planningId}` })
    const bad = [...allowed.keys()].filter((name) => byName.has(name) && !allowed.get(name)?.has(normalized.get(name) || ''))
    const aliasHint = bad.some((name) => suggestLoose(name, byName.get(name) || '', allowed.get(name))) ? '容量单位可以对照，确认后重新匹配。' : ''
    const structure = byName.has('型号') && !allowed.has('型号') ? '模型里没有「型号」这一层，不会把系列和型号当成同一个值。' : ''
    return finish('spec', 'blocked', 'skip', `规格值无法匹配：${bad.map((name) => `${name}「${byName.get(name)}」`).join('、') || '取值组合'}。${structure}${aliasHint}不会自动改成临时物料。`, { ...modelIds, groupKey: `spec:${productType.id}:${(structure ? ['结构'] : []).concat(bad).sort().join('+')}` })
  })
}

function suggestLoose(name: string, value: string, targets?: Set<string>) {
  const matched = /^(\d+)GB$/i.exec(value)
  return name === '容量' && Boolean(matched && targets?.has(`${matched[1]}G`))
}

function groupOf(block: ImportBlock, productTypeId: string, categoryId: string, message: string) {
  return `${block}:${productTypeId}:${categoryId}:${message}`
}

export function applyExcelImport(data: AppData, rows: ImportPreviewRow[], nextId: (prefix: string) => string) {
  const imported: MaterialCreateResult[] = []
  rows.filter((item) => item.status === 'ready').forEach((row) => {
    if (row.action === 'formal') {
      imported.push(createV3Material(data, {
        productModelId: row.productModelId,
        modelVersionId: row.modelVersionId,
        planningId: row.planningId,
        requestId: row.requestId,
        categoryId: row.categoryId,
        productTypeId: row.productTypeId,
        skuName: row.skuName,
        supplierCode: row.supplierCode,
        guanjiapoCode: row.guanjiapoCode,
        materialDescription: row.legacyName,
        now: new Date().toISOString(),
        nextId,
      }))
      return
    }
    const attrs = row.attrs.flatMap((item) => {
      const param = data.params.find((param) => param.name === item.name)
      if (!param) return []
      const source = param.values.includes(item.value) ? 'dictionary' as const : 'manual' as const
      return [{ attributeId: param.id, value: item.value, source }]
    })
    imported.push(createTemporaryMaterial(data, {
      requestId: row.requestId,
      categoryId: row.categoryId,
      productTypeId: row.productTypeId,
      productModelId: row.productModelId,
      modelVersionId: row.modelVersionId,
      attrs,
      materialCode: nextMaterialCode(data),
      skuName: row.skuName,
      supplierCode: row.supplierCode,
      guanjiapoCode: row.guanjiapoCode,
      materialDescription: row.legacyName,
      now: new Date().toISOString(),
      nextId,
    }))
  })
  return imported
}
