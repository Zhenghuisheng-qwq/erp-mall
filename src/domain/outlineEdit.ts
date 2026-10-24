import type { AppData, ProductSpecNode } from './types'

export interface OutlineChoice {
  value: string
  label: string
}

/** 大纲下拉的候选项。属性来自词典 id，取值只来自所属属性，并且避开同级已占用的值。 */
export function outlineChoices(data: AppData, nodeId: string): OutlineChoice[] {
  const node = data.productSpecNodes.find((item) => item.id === nodeId)
  if (!node) return []
  if (node.nodeType === 'ATTRIBUTE') {
    return data.params.map((item) => ({ value: item.id, label: item.name }))
  }
  const parent = data.productSpecNodes.find((item) => item.id === node.parentId && item.nodeType === 'ATTRIBUTE')
  const param = data.params.find((item) => item.id === parent?.attributeId)
  if (!param) return []
  const used = new Set(
    data.productSpecNodes
      .filter((item) => item.parentId === node.parentId && item.id !== node.id && item.nodeType === 'VALUE')
      .map((item) => item.valueId),
  )
  return param.values.filter((item) => item === node.valueId || !used.has(item)).map((item) => ({ value: item, label: item }))
}

/**
 * 只改当前编辑树上的词典引用。
 * 不改已发布快照，不改规划编号，不删除下级。
 */
export function rebindSpecNode(data: AppData, nodeId: string, binding: { attributeId?: string; valueId?: string }): { ok: boolean; message: string; changed: boolean } {
  const node = data.productSpecNodes.find((item) => item.id === nodeId)
  if (!node) return { ok: false, message: '节点不存在', changed: false }
  if (node.nodeType === 'ATTRIBUTE') return rebindAttribute(data, node, binding.attributeId || '')
  return rebindValue(data, node, binding.valueId || '')
}

function rebindAttribute(data: AppData, node: ProductSpecNode, attributeId: string): { ok: boolean; message: string; changed: boolean } {
  const param = data.params.find((item) => item.id === attributeId)
  if (!attributeId || !param) return { ok: false, message: '请从属性词典里选择属性', changed: false }
  if (node.attributeId === attributeId) return { ok: true, message: '', changed: false }
  const sibling = data.productSpecNodes.find((item) => item.templateId === node.templateId && item.parentId === node.parentId && item.id !== node.id && item.nodeType === 'ATTRIBUTE' && item.attributeId === attributeId)
  if (sibling) return { ok: false, message: `同一个位置已经有属性「${param.name}」`, changed: false }
  const children = data.productSpecNodes.filter((item) => item.parentId === node.id && item.nodeType === 'VALUE')
  const illegal = children.filter((item) => item.valueId && !param.values.includes(item.valueId))
  if (illegal.length) {
    const names = illegal.map((item) => item.valueId).join('、')
    return { ok: false, message: `改成「${param.name}」后，下级取值「${names}」不在这个属性的词典里。已保持原样，没有删除下级。`, changed: false }
  }
  node.attributeId = attributeId
  children.forEach((item) => {
    item.attributeId = attributeId
  })
  return { ok: true, message: '', changed: true }
}

function rebindValue(data: AppData, node: ProductSpecNode, valueId: string): { ok: boolean; message: string; changed: boolean } {
  const parent = data.productSpecNodes.find((item) => item.id === node.parentId && item.nodeType === 'ATTRIBUTE')
  const param = data.params.find((item) => item.id === parent?.attributeId)
  if (!parent || !param) return { ok: false, message: '请先为上一级选择属性词典', changed: false }
  if (!valueId || !param.values.includes(valueId)) return { ok: false, message: `请从「${param.name}」的取值里选择`, changed: false }
  if (node.valueId === valueId) return { ok: true, message: '', changed: false }
  const duplicated = data.productSpecNodes.some((item) => item.parentId === node.parentId && item.id !== node.id && item.nodeType === 'VALUE' && item.valueId === valueId)
  if (duplicated) return { ok: false, message: '同一个属性下已有这个取值', changed: false }
  node.valueId = valueId
  node.attributeId = param.id
  return { ok: true, message: '', changed: true }
}
