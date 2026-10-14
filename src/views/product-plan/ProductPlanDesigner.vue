<template>
  <div v-if="plan && root" class="designer">
    <header class="designer-head">
      <div class="designer-title">
        <button type="button" class="linkish" @click="router.push('/product-plan')">返回列表</button>
        <div class="title-row">
          <h1>{{ plan.name }}</h1>
          <StatusTag kind="plan" :status="plan.status" />
          <el-tag v-if="readonly" type="info" effect="plain">查看</el-tag>
        </div>
        <p>{{ categoryLabel }} · {{ nodeCount }} 个节点<span v-if="plan.description"> · {{ plan.description }}</span></p>
      </div>
      <div class="head-actions">
        <el-button size="small" @click="router.push({ path: '/sku-plan-preview', query: { plan: plan.id } })">SKU预览</el-button>
        <el-radio-group :model-value="ui.view" size="small" @change="onView">
          <el-radio-button value="mind">导图模式</el-radio-button>
          <el-radio-button value="vertical">竖向编辑</el-radio-button>
        </el-radio-group>
      </div>
    </header>
    <div class="designer-body">
      <ProductPlanToolbar
        :selected-name="selected?.name || ''"
        :selected-type="selectedType"
        :readonly="readonly"
        :nodes="planNodes"
        :root-id="plan.rootNodeId"
        :selected-id="ui.selectedId"
        :plan-id="plan.id"
        @submit="onCreate"
      />
      <ProductPlanTree :root="root" :view="ui.view" :selected-id="ui.selectedId" :collapsed-ids="ui.collapsed" :count="nodeCount" @select="onSelect" @toggle="onToggle" />
      <ProductPlanNodeDetail
        :root="root"
        :selected-id="ui.selectedId"
        :readonly="readonly"
        :plan-id="plan.id"
        :plan-name="plan.name"
        :applicable-type="categoryLeaf"
        @save="onSave"
        @remove="onDelete"
      />
    </div>
  </div>
  <div v-else class="panel">
    <p>没有找到这个商品规划。</p>
    <el-button style="margin-top: 12px" @click="router.push('/product-plan')">返回列表</el-button>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, reactive, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ProductPlanNodeDetail from '../../components/product-plan/ProductPlanNodeDetail.vue'
import StatusTag from '../../components/product-v3/StatusTag.vue'
import ProductPlanToolbar from '../../components/product-plan/ProductPlanToolbar.vue'
import ProductPlanTree from '../../components/product-plan/ProductPlanTree.vue'
import { categoryChain } from '../../domain/categoryTree'
import {
  buildPlanTree,
  findPlanNode,
  nodeChain,
  PLAN_NODE_TYPE_LABEL,
  PLAN_UI_KEY,
  type ProductPlanNode,
} from '../../mock/product-v3/productPlan'
import { describeNodeDelete, type PlanNodePatch } from '../../mock/product-v3/productPlanActions'
import { useCatalogStore } from '../../stores/catalog'
import { useMaterialStore } from '../../stores/material'
import { useProductPlanStore } from '../../stores/productPlan'

interface PlanUiState {
  view: 'mind' | 'vertical'
  selectedId: string
  collapsed: string[]
}

const route = useRoute()
const router = useRouter()
const catalog = useCatalogStore()
const planStore = useProductPlanStore()
const materialStore = useMaterialStore()
const planId = computed(() => String(route.params.id || ''))
const readonly = computed(() => route.query.mode === 'view')
const plan = computed(() => planStore.planById(planId.value))
const root = computed(() => {
  const current = plan.value
  if (!current) return null
  const nodes = planStore.nodesOf(current.id)
  return nodes.length ? buildPlanTree(nodes, current.rootNodeId) : null
})

const ui = reactive<PlanUiState>({ view: 'mind', selectedId: '', collapsed: [] })
const planNodes = computed(() => (plan.value ? planStore.nodesOf(plan.value.id) : []))
const nodeCount = computed(() => planNodes.value.length)
const selected = computed(() => findPlanNode(root.value, ui.selectedId))
const selectedType = computed(() => (selected.value ? PLAN_NODE_TYPE_LABEL[selected.value.nodeType] : ''))
const categoryLabel = computed(() => {
  if (!plan.value) return ''
  const chain = categoryChain(catalog.data.categories, plan.value.categoryId)
  return chain.length ? chain.map((item) => item.name).join(' / ') : '未找到分类'
})
const categoryLeaf = computed(() => {
  if (!plan.value) return ''
  return catalog.data.categories.find((item) => item.id === plan.value?.categoryId)?.name || ''
})

function firstLeafId(tree: ProductPlanNode) {
  let current = tree
  while (current.children?.length) {
    const next = current.children[0]
    if (!next) break
    current = next
  }
  return current.id
}

function readUi(id: string): PlanUiState {
  try {
    const all = JSON.parse(localStorage.getItem(PLAN_UI_KEY) || '{}') as Record<string, Partial<PlanUiState>>
    const saved = all[id]
    return {
      view: saved?.view === 'vertical' ? 'vertical' : 'mind',
      selectedId: typeof saved?.selectedId === 'string' ? saved.selectedId : '',
      collapsed: Array.isArray(saved?.collapsed) ? saved.collapsed.filter((item) => typeof item === 'string') : [],
    }
  } catch {
    return { view: 'mind', selectedId: '', collapsed: [] }
  }
}

function writeUi() {
  if (!planId.value) return
  let all: Record<string, PlanUiState> = {}
  try {
    const parsed = JSON.parse(localStorage.getItem(PLAN_UI_KEY) || '{}') as Record<string, PlanUiState>
    if (parsed && typeof parsed === 'object') all = parsed
  } catch {
    all = {}
  }
  all[planId.value] = { view: ui.view, selectedId: ui.selectedId, collapsed: [...ui.collapsed] }
  localStorage.setItem(PLAN_UI_KEY, JSON.stringify(all))
}

watch(ui, writeUi)
watch(planId, (id) => {
  const next = readUi(id)
  ui.view = next.view
  ui.selectedId = next.selectedId
  ui.collapsed = next.collapsed
}, { immediate: true })
let appliedNode = ''
watch(root, (tree) => {
  if (!tree) return
  const asked = String(route.query.node || '')
  if (asked && asked !== appliedNode && findPlanNode(tree, asked)) {
    ui.selectedId = asked
    appliedNode = asked
    return
  }
  if (!ui.selectedId || !findPlanNode(tree, ui.selectedId)) ui.selectedId = firstLeafId(tree)
}, { immediate: true })
watch(
  () => route.query.node,
  (node) => {
    const id = String(node || '')
    if (!id || !root.value || !findPlanNode(root.value, id)) return
    ui.selectedId = id
    appliedNode = id
  },
)

function onView(value: string | number | boolean | undefined) {
  ui.view = value === 'vertical' ? 'vertical' : 'mind'
}

function onSelect(id: string) {
  ui.selectedId = id
}

function onToggle(id: string) {
  ui.collapsed = ui.collapsed.includes(id) ? ui.collapsed.filter((item) => item !== id) : [...ui.collapsed, id]
}

function onCreate(payload: { nodeType: 'PRODUCT_TYPE' | 'ATTRIBUTE' | 'VALUE' | 'MATERIAL'; name: string; parentId: string }) {
  if (readonly.value || !plan.value) return
  const created = planStore.createNode({ planId: plan.value.id, ...payload })
  if (!created.id) {
    ElMessage.warning(created.error || '没有加上')
    return
  }
  const chain = root.value ? nodeChain(root.value, payload.parentId).map((item) => item.id) : []
  ui.collapsed = ui.collapsed.filter((item) => !chain.includes(item))
  ui.selectedId = created.id
  ElMessage.success('已添加节点')
}

function onSave(patch: PlanNodePatch) {
  if (readonly.value || !plan.value || !ui.selectedId) return
  const error = planStore.updateNode(plan.value.id, ui.selectedId, patch)
  if (error) {
    ElMessage.warning(error)
    return
  }
  ElMessage.success('已保存节点')
}

async function onDelete() {
  if (readonly.value || !plan.value || !selected.value) return
  const current = selected.value
  const info = describeNodeDelete(planStore.nodesOf(plan.value.id), current.id)
  if (info.error) {
    ElMessage.warning(info.error)
    return
  }
  const linked = materialStore.state.materials.filter((item) => info.ids.includes(item.sourceNodeId)).length
  const archiveHint = linked ? `已有 ${linked} 条物料档案会保留，但来源节点会找不到。` : ''
  const extra = [info.hint, archiveHint].filter(Boolean).join('\n')
  const message = info.childCount
    ? `「${current.name}」下面还有 ${info.childCount} 个子节点。是否同时删除子节点？${extra ? `\n${extra}` : ''}`
    : `确认删除「${current.name}」？${extra ? `\n${extra}` : ''}`
  try {
    await ElMessageBox.confirm(message, '删除节点', {
      type: 'warning',
      confirmButtonText: info.childCount ? '同时删除' : '删除',
    })
  } catch {
    return
  }
  const parentId = current.parentId || ''
  const error = planStore.deleteNode(plan.value.id, current.id)
  if (error) {
    ElMessage.warning(error)
    return
  }
  ui.selectedId = parentId
  ElMessage.success(info.childCount ? '已连同子节点删除' : '已删除节点')
}
</script>

<style scoped>
.designer { height: calc(100vh - 134px); min-height: 560px; display: flex; flex-direction: column; gap: 12px; }
.designer-head { flex: none; display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
.designer-title h1 { font-size: 22px; font-weight: 650; }
.designer-title p { margin-top: 6px; color: #66788a; font-size: 13px; }
.title-row { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.designer-body { flex: 1; min-height: 0; display: grid; grid-template-columns: 240px minmax(0, 1fr) 340px; gap: 12px; }
.head-actions { display: flex; align-items: center; gap: 8px; flex: none; }
</style>
