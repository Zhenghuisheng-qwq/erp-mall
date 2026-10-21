import type { AppData, NamingPart, ProductSpecNode } from './types'

const PRODUCT_TYPE = 'productType'

export function composeName(parts: NamingPart[], values: Record<string, string>) {
  const chunks = parts.flatMap((part) => {
    const text = part.kind === 'text' ? (part.text || '').trim() : (values[part.key || ''] || '').trim()
    if (!text || text === 'undefined' || text === 'null') return []
    return [text]
  })
  return chunks.join(' ').replace(/\s+/g, ' ').trim()
}

function ancestorIds(nodes: ProductSpecNode[], startId: string) {
  const byId = new Map(nodes.map((item) => [item.id, item]))
  const ids: string[] = []
  let cursor = byId.get(startId)
  const guard = new Set<string>()
  while (cursor && !guard.has(cursor.id)) {
    guard.add(cursor.id)
    ids.push(cursor.id)
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined
  }
  return ids
}

/** 只收集真正落在这条规格路径上的规则。平级另一支的规则不算。 */
export function applicableNamingRules(nodes: ProductSpecNode[], valueNodeIds: string[]) {
  const seen = new Set<string>()
  const found: { nodeId: string; rule: NamingPart[] }[] = []
  valueNodeIds.forEach((id) => {
    ancestorIds(nodes, id).forEach((nodeId) => {
      if (seen.has(nodeId)) return
      seen.add(nodeId)
      const node = nodes.find((item) => item.id === nodeId)
      if (!node?.namingRule?.length) return
      found.push({ nodeId, rule: node.namingRule })
    })
  })
  return found
}

export interface NameSuggestion {
  name: string
  status: 'rule' | 'default' | 'conflict' | 'incomplete'
  message: string
  /** 唯一命中的规则节点。没有规则，或同级分支无法收成同一条规则时为空。 */
  nodeId?: string
  /** 规则节点的展示名。只用于说明来源。 */
  nodeLabel?: string
  /** false 时不能把 name 当作自动名称写入。缺省表示沿用原有自动名称。 */
  canAuto?: boolean
}

function isStrictAncestor(nodes: ProductSpecNode[], ancestorId: string, startId: string) {
  const byId = new Map(nodes.map((item) => [item.id, item]))
  let cursor = byId.get(startId)
  const guard = new Set<string>()
  while (cursor && !guard.has(cursor.id)) {
    guard.add(cursor.id)
    if (!cursor.parentId) return false
    if (cursor.parentId === ancestorId) return true
    cursor = byId.get(cursor.parentId)
  }
  return false
}

/** 组合里不被其他取值包含的节点。一条父子链只剩末端；同级相乘会剩下多个。 */
export function namingLeaves(nodes: ProductSpecNode[], valueNodeIds: string[]) {
  const ids = [...new Set(valueNodeIds.filter(Boolean))]
  return ids.filter((id) => !ids.some((other) => other !== id && isStrictAncestor(nodes, id, other)))
}

export function suggestMaterialName(data: AppData, input: { productModelId: string; modelVersionId: string; steps: { valueNodeId: string; attributeId: string; valueId: string }[]; productTypeName: string }): NameSuggestion {
  const version = data.specModelVersions.find((item) => item.id === input.modelVersionId && item.templateId === input.productModelId)
  const nodes = version?.nodesSnapshot || []
  const values: Record<string, string> = { [PRODUCT_TYPE]: input.productTypeName }
  input.steps.forEach((step) => {
    if (step.attributeId && step.valueId) values[step.attributeId] = step.valueId
  })
  const fallback = composeName(
    [{ kind: 'field', key: PRODUCT_TYPE }, ...input.steps.map((step) => ({ kind: 'field' as const, key: step.attributeId }))],
    values,
  )
  const leaves = namingLeaves(nodes, input.steps.map((step) => step.valueNodeId))
  const hits = leaves.map((id) => nearestNamingRule(nodes, id))
  const present = hits.filter((item): item is NamingHit => Boolean(item))
  if (!present.length) return { name: fallback, status: 'default', message: '', canAuto: true }
  const unique = [...new Set(present.map((item) => item.nodeId))]
  const shared = leaves.length === 1 || (unique.length === 1 && present.length === leaves.length)
  if (!shared) {
    const detail = leaves.map((id, index) => {
      const hit = hits[index]
      const place = valuePlace(nodes, id)
      return hit ? `「${place}」落到「${rulePlace(data, nodes, hit.nodeId)}」` : `「${place}」没有命名规则`
    }).join('，')
    return { name: '', status: 'conflict', canAuto: false, message: `这条规格由同级属性相乘，${detail}。不能任选一条规则，请手工填写名称。` }
  }
  const hit = present[0]
  const labels = Object.fromEntries(data.params.map((item) => [item.id, item.name]))
  labels[PRODUCT_TYPE] = '产品类型'
  const rendered = renderNamingRule(hit.rule, input.steps, { [PRODUCT_TYPE]: input.productTypeName }, labels)
  const gaps = [...rendered.missing, ...rendered.ambiguous]
  if (gaps.length) {
    return {
      name: '',
      status: 'incomplete',
      canAuto: false,
      nodeId: hit.nodeId,
      nodeLabel: rulePlace(data, nodes, hit.nodeId),
      message: gaps.map((item) => item.reason).join(' '),
    }
  }
  return { name: rendered.name, status: 'rule', message: '', canAuto: true, nodeId: hit.nodeId, nodeLabel: rulePlace(data, nodes, hit.nodeId) }
}

/** 只把已经记下的来源说清楚。auto 是旧记录，不能改判成规则或默认。 */
export function materialNameOriginLabel(source?: string) {
  if (source === 'manual') return '手工修改'
  if (source === 'rule') return '已发布规则生成'
  if (source === 'default') return '默认名称生成'
  if (source === 'auto') return '建档时自动带入'
  return ''
}

export function filedNameSource(suggestion: NameSuggestion, requested: string): 'rule' | 'default' | 'manual' {
  if (suggestion.canAuto === false || (requested && requested !== suggestion.name)) return 'manual'
  return suggestion.status === 'rule' ? 'rule' : 'default'
}

function valuePlace(nodes: ProductSpecNode[], nodeId: string) {
  return nodes.find((item) => item.id === nodeId)?.valueId || '取值'
}

function rulePlace(data: AppData, nodes: ProductSpecNode[], nodeId: string) {
  const node = nodes.find((item) => item.id === nodeId)
  if (!node) return '未命名位置'
  if (node.nodeType === 'VALUE') return node.valueId || '取值'
  return data.params.find((item) => item.id === node.attributeId)?.name || '属性'
}

/** 临时物料没有正式取值节点。只在模型里恰好一条规则时套用，多条规则不猜测。 */
export function suggestTemporaryName(input: { productTypeName: string; attrs: { attributeId: string; value: string }[]; rules: NamingPart[][] }): NameSuggestion {
  const values: Record<string, string> = { [PRODUCT_TYPE]: input.productTypeName }
  input.attrs.forEach((item) => {
    if (item.attributeId && item.value.trim()) values[item.attributeId] = item.value.trim()
  })
  const fallback = composeName(
    [{ kind: 'field', key: PRODUCT_TYPE }, ...input.attrs.map((item) => ({ kind: 'field' as const, key: item.attributeId }))],
    values,
  )
  const rules = input.rules.filter((item) => item.length)
  if (rules.length > 1) return { name: fallback, status: 'conflict', message: '当前有多条命名规则，临时物料不会自动猜用哪一条。请直接填写名称。' }
  if (rules.length === 1) return { name: composeName(rules[0], values), status: 'rule', message: '' }
  return { name: fallback, status: 'default', message: '' }
}

export interface NamingHit {
  nodeId: string
  rule: NamingPart[]
}

/** 从当前节点沿父节点向上，取最近一条自有规则。不看兄弟，也不拼接更上层。 */
export function nearestNamingRule(nodes: ProductSpecNode[], startId: string): NamingHit | null {
  const byId = new Map(nodes.map((item) => [item.id, item]))
  let cursor = byId.get(startId)
  const guard = new Set<string>()
  while (cursor && !guard.has(cursor.id)) {
    guard.add(cursor.id)
    if (cursor.namingRule?.length) return { nodeId: cursor.id, rule: cursor.namingRule }
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined
  }
  return null
}

export interface NamingGap {
  key: string
  label: string
  reason: string
}

/** 按用户排列的片段直接拼接。缺字段或一条路径上同一属性有多个值时，不另取词典值。 */
export function renderNamingRule(parts: NamingPart[], steps: { attributeId: string; valueId: string }[], extras: Record<string, string>, labels: Record<string, string>) {
  const buckets = new Map<string, Set<string>>()
  steps.forEach((step) => {
    if (!step.attributeId || !step.valueId) return
    const values = buckets.get(step.attributeId) || new Set<string>()
    values.add(step.valueId)
    buckets.set(step.attributeId, values)
  })
  const missing: NamingGap[] = []
  const ambiguous: NamingGap[] = []
  let name = ''
  parts.forEach((part) => {
    if (part.kind === 'text') {
      name += part.text || ''
      return
    }
    const key = part.key || ''
    const label = labels[key] || (key === PRODUCT_TYPE ? '产品类型' : '未命名属性')
    if (key === PRODUCT_TYPE) {
      const text = extras[PRODUCT_TYPE] || ''
      if (!text) missing.push({ key, label, reason: '当前模型没有产品类型名称' })
      name += text || `【缺少：${label}】`
      return
    }
    const values = buckets.get(key)
    if (!values || values.size === 0) {
      missing.push({ key, label, reason: `这条合法组合路径里没有「${label}」` })
      name += `【缺少：${label}】`
      return
    }
    if (values.size > 1) {
      ambiguous.push({ key, label, reason: `「${label}」在这条路径上有多个取值：${[...values].join('、')}。不会任选一个。` })
      name += `【歧义：${label}】`
      return
    }
    name += [...values][0]
  })
  return { name: name.replace(/[ \t]{2,}/g, ' ').trim(), missing, ambiguous }
}

export { PRODUCT_TYPE }
