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
  status: 'rule' | 'default' | 'conflict'
  message: string
}

export function suggestMaterialName(data: AppData, input: { productModelId: string; modelVersionId: string; steps: { valueNodeId: string; attributeId: string; valueId: string }[]; productTypeName: string }): NameSuggestion {
  const version = data.specModelVersions.find((item) => item.id === input.modelVersionId && item.templateId === input.productModelId)
  const nodes = version?.nodesSnapshot || []
  const values: Record<string, string> = { [PRODUCT_TYPE]: input.productTypeName }
  input.steps.forEach((step) => {
    if (step.attributeId && step.valueId) values[step.attributeId] = step.valueId
  })
  const rules = applicableNamingRules(nodes, input.steps.map((step) => step.valueNodeId))
  const fallback = composeName(
    [{ kind: 'field', key: PRODUCT_TYPE }, ...input.steps.map((step) => ({ kind: 'field' as const, key: step.attributeId }))],
    values,
  )
  if (rules.length > 1) {
    const places = rules.map((rule) => rulePlace(data, nodes, rule.nodeId))
    return { name: fallback, status: 'conflict', message: `「${places.join('」和「')}」上都有命名规则。系统不会自动选一条，当前先用「${fallback}」。请只保留一条，或自己填写名称。` }
  }
  if (rules.length === 1) {
    return { name: composeName(rules[0].rule, values), status: 'rule', message: '' }
  }
  return { name: fallback, status: 'default', message: '' }
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

export { PRODUCT_TYPE }
