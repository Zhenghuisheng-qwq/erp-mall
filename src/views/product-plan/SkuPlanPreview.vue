<template>
  <div>
    <PageHead title="SKU规划预览" desc="同一层的属性相乘；挂在某个取值下面的属性只走已连接的路径。结果不会写入商品。">
      <el-button @click="router.push('/product-plan')">返回规划列表</el-button>
    </PageHead>
    <div class="panel">
      <SkuPathGenerator v-model:plan-id="planId" v-model:scope-id="scopeId" @generate="generate" />
    </div>
    <div class="panel">
      <div class="compare">
        <div>
          <span>属性值叶子</span>
          <b>{{ leafCount }}</b>
          <em>个</em>
        </div>
        <span class="compare-arrow">↓</span>
        <div>
          <span>{{ combinationLabel }}</span>
          <b>{{ ready ? rows.length : '—' }}</b>
          <em>个 SKU</em>
        </div>
      </div>
      <SkuPreviewTable :rows="rows" :ready="ready">
        <template #material="{ row }">
          <el-button v-if="materialOf(row.leafId)" link type="primary" @click="router.push(`/material/${materialOf(row.leafId)}`)">查看物料</el-button>
          <span v-else class="muted">未建档</span>
        </template>
      </SkuPreviewTable>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHead from '../../components/PageHead.vue'
import SkuPathGenerator from '../../components/product-plan/SkuPathGenerator.vue'
import SkuPreviewTable from '../../components/product-plan/SkuPreviewTable.vue'
import { buildPlanTree, findPlanNode, isPlanLeafNode, type ProductPlanNode } from '../../mock/product-v3/productPlan'
import { generatePlanSkuPreview, type PlanSkuPreviewRow } from '../../mock/product-v3/productPlanSku'
import { useMaterialStore } from '../../stores/material'
import { useProductPlanStore } from '../../stores/productPlan'

const route = useRoute()
const router = useRouter()
const planStore = useProductPlanStore()
const materialStore = useMaterialStore()
const asked = String(route.query.plan || '')
const hasPlan = (id: string) => planStore.state.plans.some((item) => item.id === id)
const initial = hasPlan(asked) ? asked : hasPlan('plan-phone') ? 'plan-phone' : planStore.state.plans[0]?.id || ''
const planId = ref(initial)
const askedScope = String(route.query.scope || '')
const initialNodes = initial ? planStore.nodesOf(initial) : []
const preferredScope = initialNodes.some((item) => item.id === 'ppn-ip17') ? 'ppn-ip17' : planStore.planById(initial)?.rootNodeId || ''
const scopeId = ref(askedScope && initialNodes.some((item) => item.id === askedScope) ? askedScope : preferredScope)
const rows = ref<PlanSkuPreviewRow[]>([])
const ready = ref(false)

function generate() {
  const plan = planStore.planById(planId.value)
  if (!plan || !scopeId.value) {
    rows.value = []
    ready.value = false
    ElMessage.warning('请选择商品规划和生成范围')
    return
  }
  rows.value = generatePlanSkuPreview(planStore.nodesOf(plan.id), plan.rootNodeId, scopeId.value)
  ready.value = true
  if (!rows.value.length) ElMessage.info('这个范围下没有可预览的规格组合')
}

watch([planId, scopeId], () => {
  if (!planId.value || !scopeId.value) {
    rows.value = []
    ready.value = false
    return
  }
  generate()
}, { immediate: true })

const previewRows = computed(() => {
  const plan = planStore.planById(planId.value)
  if (!plan || !scopeId.value) return []
  return generatePlanSkuPreview(planStore.nodesOf(plan.id), plan.rootNodeId, scopeId.value)
})

function countLeaves(node: ProductPlanNode): number {
  if (isPlanLeafNode(node)) return 1
  return (node.children || []).reduce((sum, child) => sum + countLeaves(child), 0)
}

const leafCount = computed(() => {
  const plan = planStore.planById(planId.value)
  if (!plan || !scopeId.value) return 0
  const root = buildPlanTree(planStore.nodesOf(plan.id), plan.rootNodeId)
  const scope = findPlanNode(root, scopeId.value)
  return scope ? countLeaves(scope) : 0
})

const combinationLabel = computed(() => {
  const flags = new Set(previewRows.value.map((row) => row.combination))
  if (flags.has('同级相乘') && flags.has('路径组合')) return '混合'
  if (flags.has('同级相乘')) return '同级相乘'
  return '路径组合'
})

function materialOf(leafId: string) {
  return materialStore.materialsBySource(leafId)[0]?.id || ''
}
</script>

<style scoped>
.compare { display: flex; align-items: center; gap: 16px; margin-bottom: 14px; padding: 12px 14px; background: #f7faff; border-radius: 8px; }
.compare div { display: flex; align-items: baseline; gap: 6px; }
.compare span { color: #66788a; font-size: 13px; }
.compare b { font-size: 22px; font-weight: 650; }
.compare em { font-style: normal; color: #66788a; font-size: 13px; }
.compare-arrow { color: #409eff; font-size: 18px; }
</style>
