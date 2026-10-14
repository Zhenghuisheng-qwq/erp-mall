<template>
  <div v-loading="loading">
    <PageHead title="商品规划看板" desc="从分类规划走到 SKU 预览、物料和兼容。数字来自当前这台浏览器里的演示数据。">
      <el-button @click="router.push('/product-plan')">进入商品规划</el-button>
    </PageHead>
    <div class="stat-grid">
      <button v-for="item in stats" :key="item.label" type="button" class="stat-card" @click="router.push(item.to)">
        <span>{{ item.label }}</span>
        <b>{{ item.value }}</b>
      </button>
    </div>
    <div class="panel">
      <h2>演示步骤</h2>
      <ol class="steps">
        <li><button type="button" class="linkish" @click="router.push('/product-plan/plan-phone')">打开手机商品规划</button>，从分类「手机」看到 Apple手机、iPhone17、容量和颜色。</li>
        <li><button type="button" class="linkish" @click="router.push({ path: '/sku-plan-preview', query: { plan: 'plan-phone', scope: 'ppn-ip17' } })">生成 SKU 预览</button>，得到 256G 黑色、256G 白色、512G 白色。</li>
        <li><button type="button" class="linkish" @click="router.push('/material/mat-black')">查看物料</button>，例如 Apple iPhone17 256G 黑色。</li>
        <li><button type="button" class="linkish" @click="router.push({ path: '/compatibility', query: { main: 'ppn-ip17' } })">查看兼容</button>，iPhone17 对应保护膜、手机壳和充电器。</li>
      </ol>
    </div>
    <div class="panel">
      <h2>商品规划树概览</h2>
      <p v-if="!trees.length" class="muted">暂无规划</p>
      <div v-for="plan in trees" :key="plan.id" class="plan-block">
        <div class="plan-name">
          <button type="button" class="linkish" @click="router.push(`/product-plan/${plan.id}`)">{{ plan.name }}</button>
          <StatusTag kind="plan" :status="plan.status" />
        </div>
        <ul class="overview">
          <li v-for="node in plan.rows" :key="node.id">
            <button type="button" class="overview-name" :style="{ paddingLeft: `${node.depth * 18}px` }" @click="openNode(plan.id, node.id)">{{ node.name }}</button>
          </li>
        </ul>
      </div>
    </div>
    <div class="panel">
      <h2>最近操作</h2>
      <p v-if="!activities.length" class="muted">暂无操作记录</p>
      <ul v-else class="activity">
        <li v-for="item in activities" :key="item.id">
          <span>{{ formatPlanTime(item.time) }}</span>
          <b>{{ item.title }}</b>
          <p>{{ item.detail }}</p>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHead from '../../components/PageHead.vue'
import StatusTag from '../../components/product-v3/StatusTag.vue'
import { buildPlanTree, formatPlanTime, type ProductPlanNode } from '../../mock/product-v3/productPlan'
import { generatePlanSkuPreview } from '../../mock/product-v3/productPlanSku'
import { useActivityStore, useCompatibilityStore, useMaterialStore, useProductPlanStore } from '../../stores/product-v3'

interface OverviewRow {
  id: string
  name: string
  depth: number
}

const router = useRouter()
const planStore = useProductPlanStore()
const materialStore = useMaterialStore()
const compatibilityStore = useCompatibilityStore()
const activityStore = useActivityStore()
const loading = ref(true)
onMounted(() => {
  loading.value = false
})

function flatten(node: ProductPlanNode, depth: number, rows: OverviewRow[]) {
  rows.push({ id: node.id, name: node.name, depth })
  for (const child of node.children || []) {
    if (child.nodeType === 'ATTRIBUTE') {
      for (const value of child.children || []) {
        if (value.nodeType === 'VALUE') flatten(value, depth + 1, rows)
      }
    } else if (child.nodeType === 'CATEGORY' || child.nodeType === 'PRODUCT_TYPE' || child.nodeType === 'VALUE') {
      flatten(child, depth + 1, rows)
    }
  }
}

const skuCount = computed(() =>
  planStore.state.plans.reduce((sum, plan) => sum + generatePlanSkuPreview(planStore.nodesOf(plan.id), plan.rootNodeId, plan.rootNodeId).length, 0),
)

const stats = computed(() => [
  { label: '商品规划数量', value: planStore.state.plans.length, to: '/product-plan' },
  { label: '规划节点数量', value: planStore.state.nodes.length, to: '/product-plan' },
  { label: 'SKU预览数量', value: skuCount.value, to: '/sku-plan-preview?plan=plan-phone&scope=ppn-ip17' },
  { label: '物料数量', value: materialStore.state.materials.length, to: '/material' },
  { label: '兼容关系数量', value: compatibilityStore.list.length, to: '/compatibility' },
])

const trees = computed(() =>
  planStore.state.plans.map((plan) => {
    const root = buildPlanTree(planStore.nodesOf(plan.id), plan.rootNodeId)
    const rows: OverviewRow[] = []
    if (root) flatten(root, 0, rows)
    return { id: plan.id, name: plan.name, status: plan.status, rows }
  }),
)

const activities = computed(() => activityStore.items)

function openNode(planId: string, nodeId: string) {
  router.push({ path: `/product-plan/${planId}`, query: { node: nodeId } })
}
</script>

<style scoped>
.stat-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
.stat-card { text-align: left; background: #fff; border: 1px solid #e6edf5; border-radius: 10px; padding: 14px 16px; cursor: pointer; }
.stat-card:hover { border-color: #b9d6fb; }
.stat-card span { display: block; color: #66788a; font-size: 13px; }
.stat-card b { display: block; margin-top: 6px; font-size: 24px; font-weight: 650; }
.steps { margin: 0; padding-left: 18px; color: #1f2a37; line-height: 1.9; }
.plan-block + .plan-block { margin-top: 14px; }
.plan-name { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.overview { list-style: none; margin: 0; padding: 0; }
.overview-name { border: 0; background: transparent; color: #1f2a37; cursor: pointer; font: inherit; line-height: 1.8; }
.overview-name:hover { color: #409eff; }
.activity { list-style: none; margin: 0; padding: 0; }
.activity li { padding: 10px 0; border-top: 1px solid #eef2f6; }
.activity span { color: #66788a; font-size: 12px; margin-right: 8px; }
.activity p { margin: 4px 0 0; color: #1f2a37; }
@media (max-width: 1100px) {
  .stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
