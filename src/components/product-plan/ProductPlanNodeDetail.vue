<template>
  <aside class="detail">
    <header class="detail-head">
      <strong>{{ readonly ? '节点详情' : '节点配置' }}</strong>
      <span>{{ readonly ? '查看模式不能修改' : '改名称、物料标记和规则' }}</span>
    </header>
    <div v-if="node" class="detail-body">
      <h3 class="section">基础信息</h3>
      <el-descriptions :column="1" border size="small" class="identity">
        <el-descriptions-item label="节点类型">{{ typeLabel }}</el-descriptions-item>
        <el-descriptions-item label="父节点">{{ parentName }}</el-descriptions-item>
        <el-descriptions-item label="完整路径">{{ node.path }}</el-descriptions-item>
      </el-descriptions>
      <PlanNodeEditor :node="node" :readonly="readonly" @save="emit('save', $event)" @remove="emit('remove')" />
      <h3 class="section">关联信息</h3>
      <div class="rel-stats">
        <button type="button" @click="openSku"><b>{{ skuCount }}</b><span>SKU数量</span></button>
        <button type="button" @click="openMaterials"><b>{{ materialCount }}</b><span>物料数量</span></button>
        <button type="button" @click="openCompatibility"><b>{{ compatCount }}</b><span>兼容数量</span></button>
      </div>
      <div class="archive-actions">
        <span>链路</span>
        <el-button size="small" @click="openSku">查看SKU预览</el-button>
        <template v-if="leaf">
          <el-button v-if="!readonly" size="small" type="primary" @click="createMaterial">创建物料</el-button>
          <el-button size="small" @click="openMaterial">查看物料</el-button>
          <el-button size="small" @click="openCompatibility">查看兼容</el-button>
        </template>
      </div>
    </div>
    <div v-else class="detail-empty">请在规划树中选择一个节点。</div>
  </aside>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { findPlanNode, isPlanLeafNode, nodeChain, PLAN_NODE_TYPE_LABEL, type ProductPlanNode } from '../../mock/product-v3/productPlan'
import { generatePlanSkuPreview } from '../../mock/product-v3/productPlanSku'
import type { PlanNodePatch } from '../../mock/product-v3/productPlanActions'
import { useMaterialStore } from '../../stores/material'
import { useCompatibilityStore } from '../../stores/product-v3'
import { useProductPlanStore } from '../../stores/productPlan'
import PlanNodeEditor from './PlanNodeEditor.vue'

const props = defineProps<{
  root: ProductPlanNode | null
  selectedId: string
  readonly: boolean
  planId: string
  planName: string
  applicableType: string
}>()

const emit = defineEmits<{
  save: [patch: PlanNodePatch]
  remove: []
}>()

const router = useRouter()
const materialStore = useMaterialStore()
const compatibilityStore = useCompatibilityStore()
const planStore = useProductPlanStore()
const node = computed(() => findPlanNode(props.root, props.selectedId))
const leaf = computed(() => (node.value ? isPlanLeafNode(node.value) : false))
const typeLabel = computed(() => (node.value ? PLAN_NODE_TYPE_LABEL[node.value.nodeType] : ''))
const parentName = computed(() => {
  if (!node.value?.parentId || !props.root) return '无'
  return findPlanNode(props.root, node.value.parentId)?.name || '无'
})

const compatCount = computed(() => {
  const ids = new Set(chain().map((item) => item.id))
  return compatibilityStore.list.filter((item) => ids.has(item.mainProductId)).length
})
const subtreeIds = computed(() => {
  const ids: string[] = []
  const walk = (current: ProductPlanNode) => {
    ids.push(current.id)
    current.children?.forEach(walk)
  }
  if (node.value) walk(node.value)
  return ids
})
const skuCount = computed(() => {
  if (!props.root || !node.value) return 0
  return generatePlanSkuPreview(planStore.nodesOf(props.planId), props.root.id, node.value.id).length
})
const materialCount = computed(() => materialStore.state.materials.filter((item) => subtreeIds.value.includes(item.sourceNodeId)).length)

function chain() {
  if (!props.root || !node.value) return []
  return nodeChain(props.root, node.value.id)
}

function openSku() {
  if (!node.value) return
  router.push({ path: '/sku-plan-preview', query: { plan: props.planId, scope: node.value.id } })
}

function createMaterial() {
  if (!leaf.value) {
    ElMessage.warning('请选择走到头的属性值')
    return
  }
  const result = materialStore.createFromNode({
    planId: props.planId,
    planName: props.planName,
    applicableType: props.applicableType,
    chain: chain(),
  })
  if (!result.id) {
    ElMessage.warning(result.error || '没有生成物料')
    return
  }
  ElMessage.success(result.created ? '已生成物料' : '这个节点已经有物料')
  router.push(`/material/${result.id}`)
}

function openMaterials() {
  if (materialCount.value === 1) {
    const found = materialStore.state.materials.find((item) => subtreeIds.value.includes(item.sourceNodeId))
    if (found) {
      router.push(`/material/${found.id}`)
      return
    }
  }
  if (!materialCount.value) {
    ElMessage.info('这个节点还没有物料')
    return
  }
  router.push('/material')
}

function openMaterial() {
  const current = node.value
  if (!current) return
  const found = materialStore.materialsBySource(current.id)[0]
  if (!found) {
    ElMessage.info('这个节点还没有物料')
    return
  }
  router.push(`/material/${found.id}`)
}

function openCompatibility() {
  const ids = new Set(chain().map((item) => item.id))
  const matched = compatibilityStore.list.filter((item) => ids.has(item.mainProductId))
  if (!matched.length) {
    ElMessage.info('这个节点还没有兼容关系')
    return
  }
  if (matched.length === 1) {
    router.push(`/compatibility/${matched[0].id}`)
    return
  }
  router.push({ path: '/compatibility', query: { main: matched[0].mainProductId } })
}
</script>

<style scoped>
.detail { background: #fff; border: 1px solid #e6edf5; border-radius: 10px; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.detail-head { padding: 14px 14px 10px; border-bottom: 1px solid #eef2f6; }
.detail-head strong { display: block; font-size: 14px; }
.detail-head span { display: block; margin-top: 4px; color: #66788a; font-size: 12px; }
.detail-body { padding: 12px; overflow: auto; }
.section { margin: 0 0 8px; font-size: 13px; font-weight: 650; }
.rel-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-bottom: 12px; }
.rel-stats button { border: 1px solid #e6edf5; background: #f7faff; border-radius: 8px; padding: 8px 6px; cursor: pointer; }
.rel-stats b { display: block; font-size: 18px; }
.rel-stats span { color: #66788a; font-size: 12px; }
.archive-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 14px; }
.archive-actions span { color: #66788a; font-size: 12px; margin-right: 4px; }
.detail-empty { padding: 24px 16px; color: #66788a; font-size: 13px; }
.detail-body :deep(.el-descriptions__label) { width: 88px; }
.detail-body :deep(.el-descriptions__content) { word-break: break-all; }
</style>
