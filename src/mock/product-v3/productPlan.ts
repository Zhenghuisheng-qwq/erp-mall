/** V3 商品规划演示数据。只存在本模块，不写入商品配置 V2。 */

export type ProductPlanStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED'

export type ProductPlanNodeType = 'CATEGORY' | 'PRODUCT_TYPE' | 'ATTRIBUTE' | 'VALUE' | 'MATERIAL'

export interface ProductPlanNodeConfig {
  isMaterialNode: boolean
  required: boolean
  descriptionRule: string
  codeRule: string
}

export interface ProductPlanNode {
  id: string
  planId: string
  parentId: string | null
  nodeType: ProductPlanNodeType
  name: string
  sort: number
  children?: ProductPlanNode[]
  path: string
  description: string
  config: ProductPlanNodeConfig
}

export interface ProductPlan {
  id: string
  name: string
  categoryId: string
  description: string
  status: ProductPlanStatus
  createdTime: string
  updatedTime: string
  rootNodeId: string
}

export interface ProductPlanState {
  plans: ProductPlan[]
  nodes: ProductPlanNode[]
}

export interface PlanVerticalOption {
  id: string
  name: string
}

export interface PlanVerticalLevel {
  key: string
  label: string
  anchorId: string
  currentId: string | null
  options: PlanVerticalOption[]
}

export const PLAN_STORAGE_KEY = 'iyge-v3-product-plan'
export const PLAN_UI_KEY = 'iyge-v3-product-plan-ui'
export const PLAN_DATA_VERSION = 1

export const PLAN_STATUS_LABEL: Record<ProductPlanStatus, string> = {
  DRAFT: '草稿',
  ACTIVE: '生效',
  ARCHIVED: '已归档',
}

export function normalizePlanStatus(status: string): ProductPlanStatus {
  if (status === 'ACTIVE' || status === 'planning') return 'ACTIVE'
  if (status === 'ARCHIVED' || status === 'archived') return 'ARCHIVED'
  return 'DRAFT'
}

export const PLAN_NODE_TYPE_LABEL: Record<ProductPlanNodeType, string> = {
  CATEGORY: '分类',
  PRODUCT_TYPE: '产品类型',
  ATTRIBUTE: '属性',
  VALUE: '属性值',
  MATERIAL: '物料',
}

const ADDABLE_NODE_TYPES = ['PRODUCT_TYPE', 'ATTRIBUTE', 'VALUE', 'MATERIAL'] as const
export type PlanAddNodeType = (typeof ADDABLE_NODE_TYPES)[number]

export function formatPlanTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value || '—'
  const pad = (num: number) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function emptyPlanConfig(partial: Partial<ProductPlanNodeConfig> = {}): ProductPlanNodeConfig {
  return {
    isMaterialNode: false,
    required: false,
    descriptionRule: '',
    codeRule: '',
    ...partial,
  }
}

function makeNode(
  planId: string,
  id: string,
  parentId: string | null,
  nodeType: ProductPlanNodeType,
  name: string,
  sort: number,
  nodeConfig: Partial<ProductPlanNodeConfig> = {},
): ProductPlanNode {
  return {
    id,
    planId,
    parentId,
    nodeType,
    name,
    sort,
    path: '',
    description: '',
    config: emptyPlanConfig(nodeConfig),
  }
}

/** 给人看的路径：分类、产品类型、属性值、物料。属性轴只在它自己被选中时出现，避免「型号 / 容量」插进物料路径。 */
export function planDisplayPath(chain: ProductPlanNode[]) {
  return chain
    .filter((node, index) => {
      if (node.nodeType === 'ATTRIBUTE') return index === chain.length - 1
      return node.nodeType === 'CATEGORY' || node.nodeType === 'PRODUCT_TYPE' || node.nodeType === 'VALUE' || node.nodeType === 'MATERIAL'
    })
    .map((node) => node.name)
    .join(' / ')
}

export function applyPlanPaths(nodes: ProductPlanNode[], rootId: string) {
  const byParent = new Map<string, ProductPlanNode[]>()
  nodes.forEach((node) => {
    if (!node.parentId) return
    const list = byParent.get(node.parentId) || []
    list.push(node)
    byParent.set(node.parentId, list)
  })
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const walk = (id: string, chain: ProductPlanNode[]) => {
    const current = byId.get(id)
    if (!current) return
    const next = [...chain, current]
    current.path = planDisplayPath(next)
    const children = (byParent.get(id) || []).slice().sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))
    children.forEach((child) => walk(child.id, next))
  }
  walk(rootId, [])
}

export function createProductPlanSeed(): ProductPlanState {
  const plans: ProductPlan[] = [
    {
      id: 'plan-phone',
      name: '手机商品规划',
      categoryId: 'c-phone',
      description: '先把 Apple 手机的产品类型、型号、容量和颜色定成一棵规划树。',
      status: 'ACTIVE',
      createdTime: '2026-10-08T01:30:00.000Z',
      updatedTime: '2026-10-13T08:40:00.000Z',
      rootNodeId: 'ppn-phone',
    },
    {
      id: 'plan-pad',
      name: '平板商品规划',
      categoryId: 'c-pad',
      description: '平板品类的初步结构，尺寸和颜色还在整理。',
      status: 'DRAFT',
      createdTime: '2026-10-10T03:00:00.000Z',
      updatedTime: '2026-10-11T06:15:00.000Z',
      rootNodeId: 'ppn-pad',
    },
  ]

  const nodes: ProductPlanNode[] = [
    makeNode('plan-phone', 'ppn-phone', null, 'CATEGORY', '手机', 1, {
      descriptionRule: '{分类}',
      codeRule: 'PHONE',
    }),
    makeNode('plan-phone', 'ppn-apple', 'ppn-phone', 'PRODUCT_TYPE', 'Apple手机', 1, {
      descriptionRule: '{分类}-{产品类型}',
      codeRule: 'APPLE-PHONE',
    }),
    makeNode('plan-phone', 'ppn-model', 'ppn-apple', 'ATTRIBUTE', '型号', 1, {
      required: true,
      descriptionRule: '{型号}',
      codeRule: 'MODEL',
    }),
    makeNode('plan-phone', 'ppn-ip17', 'ppn-model', 'VALUE', 'iPhone17', 1, {
      descriptionRule: '{产品类型} {型号}',
      codeRule: 'IP17',
    }),
    makeNode('plan-phone', 'ppn-cap', 'ppn-ip17', 'ATTRIBUTE', '容量', 1, {
      required: true,
      descriptionRule: '{容量}',
      codeRule: 'CAP',
    }),
    makeNode('plan-phone', 'ppn-256', 'ppn-cap', 'VALUE', '256G', 1, {
      descriptionRule: '{型号}-{容量}',
      codeRule: '256',
    }),
    makeNode('plan-phone', 'ppn-color-256', 'ppn-256', 'ATTRIBUTE', '颜色', 1, {
      required: true,
      descriptionRule: '{颜色}',
      codeRule: 'COLOR',
    }),
    makeNode('plan-phone', 'ppn-black', 'ppn-color-256', 'VALUE', '黑色', 1, {
      isMaterialNode: true,
      descriptionRule: '{型号}-{容量}-{颜色}',
      codeRule: 'BK',
    }),
    makeNode('plan-phone', 'ppn-white-256', 'ppn-color-256', 'VALUE', '白色', 2, {
      isMaterialNode: true,
      descriptionRule: '{型号}-{容量}-{颜色}',
      codeRule: 'WH',
    }),
    makeNode('plan-phone', 'ppn-512', 'ppn-cap', 'VALUE', '512G', 2, {
      descriptionRule: '{型号}-{容量}',
      codeRule: '512',
    }),
    makeNode('plan-phone', 'ppn-color-512', 'ppn-512', 'ATTRIBUTE', '颜色', 1, {
      required: true,
      descriptionRule: '{颜色}',
      codeRule: 'COLOR',
    }),
    makeNode('plan-phone', 'ppn-white-512', 'ppn-color-512', 'VALUE', '白色', 1, {
      isMaterialNode: true,
      descriptionRule: '{型号}-{容量}-{颜色}',
      codeRule: 'WH',
    }),
    makeNode('plan-pad', 'ppn-pad', null, 'CATEGORY', '平板', 1, {
      descriptionRule: '{分类}',
      codeRule: 'PAD',
    }),
    makeNode('plan-pad', 'ppn-ipad', 'ppn-pad', 'PRODUCT_TYPE', 'iPad', 1, {
      descriptionRule: '{分类}-{产品类型}',
      codeRule: 'IPAD',
    }),
    makeNode('plan-pad', 'ppn-pad-model', 'ppn-ipad', 'ATTRIBUTE', '型号', 1, {
      required: true,
      codeRule: 'MODEL',
    }),
    makeNode('plan-pad', 'ppn-ipad-pro', 'ppn-pad-model', 'VALUE', 'iPad Pro', 1, {
      descriptionRule: '{产品类型} {型号}',
      codeRule: 'IPAD-PRO',
    }),
    makeNode('plan-pad', 'ppn-size', 'ppn-ipad-pro', 'ATTRIBUTE', '尺寸', 1, {
      required: true,
      codeRule: 'SIZE',
    }),
    makeNode('plan-pad', 'ppn-11', 'ppn-size', 'VALUE', '11英寸', 1, {
      codeRule: '11',
    }),
    makeNode('plan-pad', 'ppn-pad-color', 'ppn-11', 'ATTRIBUTE', '颜色', 1, {
      required: true,
      codeRule: 'COLOR',
    }),
    makeNode('plan-pad', 'ppn-gray', 'ppn-pad-color', 'VALUE', '深空灰', 1, {
      isMaterialNode: true,
      descriptionRule: '{型号}-{尺寸}-{颜色}',
      codeRule: 'SG',
    }),
  ]

  plans.forEach((plan) => applyPlanPaths(nodes.filter((node) => node.planId === plan.id), plan.rootNodeId))
  return { plans, nodes }
}

export function buildPlanTree(nodes: ProductPlanNode[], rootId: string): ProductPlanNode | null {
  const copies = nodes.map((node) => ({
    ...node,
    config: { ...node.config },
    children: [] as ProductPlanNode[],
  }))
  const byId = new Map(copies.map((node) => [node.id, node]))
  copies.forEach((node) => {
    if (!node.parentId) return
    byId.get(node.parentId)?.children?.push(node)
  })
  copies.forEach((node) => {
    node.children?.sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))
  })
  const root = byId.get(rootId) || null
  if (!root) return null
  const fill = (node: ProductPlanNode, chain: ProductPlanNode[]) => {
    const next = [...chain, node]
    node.path = planDisplayPath(next)
    node.children?.forEach((child) => fill(child, next))
  }
  fill(root, [])
  return root
}

export function findPlanNode(root: ProductPlanNode | null, id: string): ProductPlanNode | null {
  if (!root) return null
  if (root.id === id) return root
  for (const child of root.children || []) {
    const found = findPlanNode(child, id)
    if (found) return found
  }
  return null
}

export function nodeChain(root: ProductPlanNode, id: string): ProductPlanNode[] {
  const walk = (node: ProductPlanNode, chain: ProductPlanNode[]): ProductPlanNode[] | null => {
    const next = [...chain, node]
    if (node.id === id) return next
    for (const child of node.children || []) {
      const found = walk(child, next)
      if (found) return found
    }
    return null
  }
  return walk(root, []) || []
}

export function isPlanLeafNode(node: ProductPlanNode) {
  if (node.nodeType !== 'VALUE' && node.nodeType !== 'MATERIAL') return false
  const nested = (current: ProductPlanNode): boolean => {
    for (const child of current.children || []) {
      if (child.nodeType === 'VALUE' || child.nodeType === 'MATERIAL') return true
      if (nested(child)) return true
    }
    return false
  }
  return !nested(node)
}

function toOption(node: ProductPlanNode): PlanVerticalOption {
  return { id: node.id, name: node.name }
}

function levelLabel(node: ProductPlanNode) {
  if (node.nodeType === 'CATEGORY') return '分类'
  if (node.nodeType === 'PRODUCT_TYPE') return '产品类型'
  return PLAN_NODE_TYPE_LABEL[node.nodeType]
}

function appendFollowing(levels: PlanVerticalLevel[], node: ProductPlanNode) {
  const attributes = (node.children || []).filter((item) => item.nodeType === 'ATTRIBUTE')
  attributes.forEach((attribute) => {
    if (levels.some((level) => level.key === attribute.id)) return
    levels.push({
      key: attribute.id,
      label: attribute.name,
      anchorId: attribute.id,
      currentId: null,
      options: (attribute.children || []).filter((item) => item.nodeType === 'VALUE').map(toOption),
    })
  })
  if (!attributes.length) {
    const productTypes = (node.children || []).filter((item) => item.nodeType === 'PRODUCT_TYPE')
    if (productTypes.length && !productTypes.some((item) => levels.some((level) => level.currentId === item.id))) {
      levels.push({
        key: `${node.id}:product-type`,
        label: '产品类型',
        anchorId: node.id,
        currentId: null,
        options: productTypes.map(toOption),
      })
    }
  }
  const materials = (node.children || []).filter((item) => item.nodeType === 'MATERIAL')
  if (!materials.length || materials.some((item) => levels.some((level) => level.currentId === item.id))) return
  levels.push({
    key: `${node.id}:material`,
    label: '物料',
    anchorId: node.id,
    currentId: null,
    options: materials.map(toOption),
  })
}

/** 竖向编辑和导图共用同一棵树，这里只把路径翻译成层级行。 */
export function verticalLevels(root: ProductPlanNode, selectedId: string | null): PlanVerticalLevel[] {
  const selected = (selectedId && findPlanNode(root, selectedId)) || root
  const path = nodeChain(root, selected.id)
  const levels: PlanVerticalLevel[] = []

  for (let index = 0; index < path.length; index += 1) {
    const node = path[index]
    if (node.nodeType === 'ATTRIBUTE') {
      const next = path[index + 1]
      const value = next && next.parentId === node.id && next.nodeType === 'VALUE' ? next : null
      levels.push({
        key: node.id,
        label: node.name,
        anchorId: node.id,
        currentId: value?.id ?? null,
        options: (node.children || []).filter((item) => item.nodeType === 'VALUE').map(toOption),
      })
      if (value) index += 1
      continue
    }
    if (node.nodeType === 'VALUE') {
      const parent = node.parentId ? findPlanNode(root, node.parentId) : null
      const pool = parent?.children || [node]
      levels.push({
        key: node.id,
        label: parent?.nodeType === 'ATTRIBUTE' ? parent.name : '属性值',
        anchorId: parent?.id || node.id,
        currentId: node.id,
        options: pool.filter((item) => item.nodeType === 'VALUE').map(toOption),
      })
      continue
    }
    const parent = node.parentId ? findPlanNode(root, node.parentId) : null
    const pool = (parent?.children || [root]).filter((item) => item.nodeType === node.nodeType)
    levels.push({
      key: node.id,
      label: levelLabel(node),
      anchorId: node.id,
      currentId: node.id,
      options: pool.map(toOption),
    })
  }

  const tail = path[path.length - 1]
  if (tail) appendFollowing(levels, tail)
  return levels
}

export function planChildBlock(parentType: ProductPlanNodeType, childType: PlanAddNodeType) {
  if (childType === 'PRODUCT_TYPE' && parentType !== 'CATEGORY' && parentType !== 'PRODUCT_TYPE') {
    return '产品类型只能加在分类或产品类型下面'
  }
  if (childType === 'ATTRIBUTE' && parentType !== 'PRODUCT_TYPE' && parentType !== 'VALUE') {
    return '属性只能加在产品类型或属性值下面'
  }
  if (childType === 'VALUE' && parentType !== 'ATTRIBUTE') {
    return '属性值只能加在属性下面'
  }
  if (childType === 'MATERIAL' && parentType !== 'PRODUCT_TYPE' && parentType !== 'VALUE') {
    return '物料节点只能加在产品类型或属性值下面'
  }
  return ''
}

export function resolvePlanParent(root: ProductPlanNode, selected: ProductPlanNode, nodeType: PlanAddNodeType) {
  if (selected.nodeType === nodeType && selected.parentId) {
    const parent = findPlanNode(root, selected.parentId)
    if (parent && !planChildBlock(parent.nodeType, nodeType)) return { parentId: parent.id, error: '' }
  }
  const error = planChildBlock(selected.nodeType, nodeType)
  if (error) return { parentId: '', error }
  return { parentId: selected.id, error: '' }
}
