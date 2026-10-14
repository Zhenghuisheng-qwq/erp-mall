import { defineStore } from 'pinia'
import { reactive, watch } from 'vue'
import {
  applyNodeUpdate,
  createNode as buildPlanNode,
  describeNodeDelete,
  type PlanNodePatch,
} from '../mock/product-v3/productPlanActions'
import {
  applyPlanPaths,
  createProductPlanSeed,
  emptyPlanConfig,
  normalizePlanStatus,
  PLAN_DATA_VERSION,
  PLAN_STORAGE_KEY,
  PLAN_UI_KEY,
  type PlanAddNodeType,
  type ProductPlan,
  type ProductPlanNode,
  type ProductPlanState,
} from '../mock/product-v3/productPlan'

type StoredPayload = { version?: number; plans?: ProductPlan[]; nodes?: ProductPlanNode[] }

let seq = 1
function uid(prefix: string) {
  seq += 1
  return `${prefix}-${Date.now().toString(36)}-${seq}`
}

function normalizeNode(input: ProductPlanNode): ProductPlanNode {
  const config = input.config || emptyPlanConfig()
  return {
    id: input.id,
    planId: input.planId,
    parentId: input.parentId ?? null,
    nodeType: input.nodeType,
    name: input.name,
    sort: typeof input.sort === 'number' ? input.sort : 0,
    path: input.path || '',
    description: input.description || '',
    config: emptyPlanConfig({
      isMaterialNode: Boolean(config.isMaterialNode),
      required: Boolean(config.required),
      descriptionRule: config.descriptionRule || '',
      codeRule: config.codeRule || '',
    }),
  }
}

function normalizePlan(input: ProductPlan): ProductPlan {
  return {
    ...input,
    description: input.description || '',
    status: normalizePlanStatus(input.status),
    updatedTime: input.updatedTime || input.createdTime,
  }
}

function hydrate(plans: ProductPlan[], nodes: ProductPlanNode[]) {
  plans.forEach((plan) => applyPlanPaths(nodes.filter((node) => node.planId === plan.id), plan.rootNodeId))
  return { plans, nodes }
}

function loadState(): ProductPlanState {
  const seed = createProductPlanSeed()
  try {
    const raw = localStorage.getItem(PLAN_STORAGE_KEY)
    if (!raw) return seed
    const parsed = JSON.parse(raw) as StoredPayload
    if (parsed.version !== PLAN_DATA_VERSION || !Array.isArray(parsed.plans) || !Array.isArray(parsed.nodes)) return seed
    if (!parsed.plans.length || !parsed.nodes.length) return seed
    return hydrate(parsed.plans.map(normalizePlan), parsed.nodes.map(normalizeNode))
  } catch {
    return seed
  }
}

export const useProductPlanStore = defineStore('product-plan', () => {
  const state = reactive<ProductPlanState>(loadState())

  watch(
    state,
    () => {
      const payload = {
        version: PLAN_DATA_VERSION,
        plans: state.plans,
        nodes: state.nodes.map((node) => ({
          id: node.id,
          planId: node.planId,
          parentId: node.parentId,
          nodeType: node.nodeType,
          name: node.name,
          sort: node.sort,
          path: node.path,
          description: node.description || '',
          config: { ...node.config },
        })),
      }
      localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(payload))
    },
    { deep: true },
  )

  function planById(id: string) {
    return state.plans.find((item) => item.id === id)
  }

  function nodesOf(planId: string) {
    return state.nodes.filter((item) => item.planId === planId)
  }

  function touch(planId: string) {
    const plan = planById(planId)
    if (plan) plan.updatedTime = new Date().toISOString()
  }

  function createPlan(input: { name: string; categoryId: string; description: string; rootName: string }) {
    const now = new Date().toISOString()
    const planId = uid('plan')
    const rootId = uid('ppn')
    state.plans.unshift({
      id: planId,
      name: input.name.trim(),
      categoryId: input.categoryId,
      description: input.description.trim(),
      status: 'DRAFT',
      createdTime: now,
      updatedTime: now,
      rootNodeId: rootId,
    })
    state.nodes.push({
      id: rootId,
      planId,
      parentId: null,
      nodeType: 'CATEGORY',
      name: input.rootName.trim() || '未命名分类',
      sort: 1,
      path: input.rootName.trim() || '未命名分类',
      description: '',
      config: emptyPlanConfig({ descriptionRule: '{分类}', codeRule: 'CAT' }),
    })
    return planId
  }

  function createNode(input: { planId: string; parentId: string; nodeType: PlanAddNodeType; name: string }) {
    const plan = planById(input.planId)
    if (!plan) return { id: '', error: '规划不存在' }
    const built = buildPlanNode(nodesOf(input.planId), { ...input, id: uid('ppn') })
    if (!built.node) return { id: '', error: built.error }
    state.nodes.push(built.node)
    applyPlanPaths(nodesOf(input.planId), plan.rootNodeId)
    touch(input.planId)
    return { id: built.node.id, error: '' }
  }

  function updateNode(planId: string, id: string, patch: PlanNodePatch) {
    const plan = planById(planId)
    const node = state.nodes.find((item) => item.id === id && item.planId === planId)
    if (!plan || !node) return '节点不存在'
    const error = applyNodeUpdate(node, patch)
    if (error) return error
    applyPlanPaths(nodesOf(planId), plan.rootNodeId)
    touch(planId)
    return ''
  }

  function deleteNode(planId: string, id: string) {
    const plan = planById(planId)
    if (!plan) return '规划不存在'
    const info = describeNodeDelete(nodesOf(planId), id)
    if (info.error) return info.error
    const drop = new Set(info.ids)
    state.nodes = state.nodes.filter((item) => !drop.has(item.id))
    applyPlanPaths(nodesOf(planId), plan.rootNodeId)
    touch(planId)
    return ''
  }

  function resetAll() {
    const seed = createProductPlanSeed()
    state.plans = seed.plans
    state.nodes = seed.nodes
    localStorage.removeItem(PLAN_UI_KEY)
  }

  return { state, planById, nodesOf, createPlan, createNode, updateNode, deleteNode, resetAll }
})
