/** 规划节点的增删改。页面通过 store 调用，不直接改节点数组。 */

import {
  buildPlanTree,
  emptyPlanConfig,
  findPlanNode,
  planChildBlock,
  resolvePlanParent,
  type PlanAddNodeType,
  type ProductPlanNode,
} from './productPlan'

export interface CreatePlanNodeInput {
  id: string
  planId: string
  parentId: string
  nodeType: PlanAddNodeType
  name: string
}

export interface PlanNodePatch {
  name: string
  description: string
  isMaterialNode: boolean
  required: boolean
  descriptionRule: string
  codeRule: string
}

export interface PlanParentOption {
  id: string
  label: string
}

export function getNodePath(nodes: ProductPlanNode[], id: string) {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const names: string[] = []
  const guard = new Set<string>()
  let current = byId.get(id)
  while (current && !guard.has(current.id)) {
    guard.add(current.id)
    names.unshift(current.name)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return names.join(' / ')
}

export function parentOptions(nodes: ProductPlanNode[], planId: string, nodeType: PlanAddNodeType): PlanParentOption[] {
  return nodes
    .filter((node) => node.planId === planId && !planChildBlock(node.nodeType, nodeType))
    .map((node) => ({ id: node.id, label: getNodePath(nodes, node.id) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'))
}

export function defaultParentId(nodes: ProductPlanNode[], rootId: string, selectedId: string, nodeType: PlanAddNodeType) {
  const planId = nodes.find((node) => node.id === rootId)?.planId || ''
  const scoped = nodes.filter((node) => node.planId === planId)
  const root = buildPlanTree(scoped, rootId)
  const selected = root ? findPlanNode(root, selectedId) : null
  const suggested = root && selected ? resolvePlanParent(root, selected, nodeType).parentId : ''
  const options = parentOptions(scoped, planId, nodeType)
  if (suggested && options.some((item) => item.id === suggested)) return suggested
  return options[0]?.id || ''
}

export function createNode(nodes: ProductPlanNode[], input: CreatePlanNodeInput) {
  const name = input.name.trim()
  if (!name) return { node: null, error: '请填写节点名称' }
  const parent = nodes.find((node) => node.id === input.parentId && node.planId === input.planId)
  if (!parent) return { node: null, error: '请选择父节点' }
  const blocked = planChildBlock(parent.nodeType, input.nodeType)
  if (blocked) return { node: null, error: blocked }
  const siblings = nodes.filter((node) => node.planId === input.planId && node.parentId === input.parentId)
  const sort = siblings.reduce((max, node) => Math.max(max, node.sort), 0) + 1
  const node: ProductPlanNode = {
    id: input.id,
    planId: input.planId,
    parentId: input.parentId,
    nodeType: input.nodeType,
    name,
    sort,
    path: '',
    description: '',
    config: emptyPlanConfig({
      required: input.nodeType === 'ATTRIBUTE',
      isMaterialNode: input.nodeType === 'MATERIAL',
    }),
  }
  return { node, error: '' }
}

export function applyNodeUpdate(node: ProductPlanNode, patch: PlanNodePatch) {
  const name = patch.name.trim()
  if (!name) return '请填写节点名称'
  node.name = name
  node.description = patch.description.trim()
  node.config = {
    ...node.config,
    isMaterialNode: Boolean(patch.isMaterialNode),
    required: Boolean(patch.required),
    descriptionRule: patch.descriptionRule.trim(),
    codeRule: patch.codeRule.trim(),
  }
  return ''
}

function descendantIds(nodes: ProductPlanNode[], id: string) {
  const byParent = new Map<string, ProductPlanNode[]>()
  nodes.forEach((node) => {
    if (!node.parentId) return
    const list = byParent.get(node.parentId) || []
    list.push(node)
    byParent.set(node.parentId, list)
  })
  const ids = [id]
  const walk = (current: string) => {
    for (const child of byParent.get(current) || []) {
      ids.push(child.id)
      walk(child.id)
    }
  }
  walk(id)
  return ids
}

export function describeNodeDelete(nodes: ProductPlanNode[], id: string) {
  const node = nodes.find((item) => item.id === id)
  if (!node) return { error: '节点不存在', childCount: 0, hint: '', ids: [] as string[] }
  if (!node.parentId) return { error: '根节点是分类起点，不能删除', childCount: 0, hint: '', ids: [] as string[] }
  const ids = descendantIds(nodes, id)
  const marked = nodes.some((item) => ids.includes(item.id) && item.config.isMaterialNode)
  return {
    error: '',
    childCount: ids.length - 1,
    hint: marked ? '这些节点里有「生成物料」标记。删除只改这份规划，不会动已有商品。' : '',
    ids,
  }
}
