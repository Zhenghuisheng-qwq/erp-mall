<template>
  <div v-if="material">
    <PageHead :title="material.name" :desc="material.materialCode">
      <el-button @click="router.push('/material')">返回列表</el-button>
    </PageHead>
    <div class="panel">
      <h2>基础信息</h2>
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="物料编码">{{ material.materialCode }}</el-descriptions-item>
        <el-descriptions-item label="物料名称">{{ material.name }}</el-descriptions-item>
        <el-descriptions-item label="状态"><StatusTag kind="material" :status="material.status" /></el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ created }}</el-descriptions-item>
        <el-descriptions-item label="说明" :span="2">{{ material.description || '无' }}</el-descriptions-item>
      </el-descriptions>
    </div>
    <div class="panel">
      <h2>来源追溯</h2>
      <div class="trace">
        <div>
          <span>物料</span>
          <b>{{ material.name }}</b>
        </div>
        <span class="trace-arrow">↓</span>
        <div>
          <span>来源节点</span>
          <b>
            <button v-if="sourceNode" type="button" class="linkish" @click="openSource">{{ sourceNode.name }}</button>
            <template v-else>{{ material.sourceNodeId ? '节点已不在规划中' : '无' }}</template>
          </b>
        </div>
        <span class="trace-arrow">↓</span>
        <div>
          <span>SKU</span>
          <b>{{ skuRows[0]?.code || '无' }}<template v-if="skuRows[0]?.path"> · {{ skuRows[0].path }}</template></b>
        </div>
      </div>
      <el-descriptions :column="1" border size="small" class="source-desc">
        <el-descriptions-item label="所属规划">
          <button v-if="material.planId" type="button" class="linkish" @click="router.push({ path: `/product-plan/${material.planId}`, query: material.sourceNodeId ? { node: material.sourceNodeId } : {} })">{{ material.planName }}</button>
          <span v-else>{{ material.planName || '无' }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="来源节点">
          <button v-if="sourceNode" type="button" class="linkish" @click="openSource">{{ sourceNode.name }}</button>
          <span v-else>{{ material.sourceNodeId ? '节点已不在规划中' : '无' }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="完整路径">{{ material.sourcePath || '无' }}</el-descriptions-item>
      </el-descriptions>
    </div>
    <div class="panel">
      <h2>SKU列表</h2>
      <p class="muted">来自规划预览，不是商品列表里的 SKU。</p>
      <el-table :data="skuRows" style="margin-top: 10px">
        <el-table-column prop="code" label="SKU编码" width="140" />
        <el-table-column prop="path" label="完整路径" min-width="240" />
        <el-table-column label="规格组合" min-width="200">
          <template #default="{ row }">
            <div v-for="item in row.specs" :key="item">{{ item }}</div>
            <span v-if="!row.specs.length" class="muted">无</span>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <div class="panel">
      <h2>兼容关系</h2>
      <el-table :data="relations">
        <el-table-column prop="role" label="关系" width="120" />
        <el-table-column prop="mainProductName" label="主商品" width="140" />
        <el-table-column prop="accessoryType" label="兼容类型" width="140" />
        <el-table-column prop="count" label="具体SKU" width="100" />
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button link type="primary" @click="router.push(`/compatibility/${row.id}`)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
  <div v-else class="panel">
    <p>没有找到这个物料。</p>
    <el-button style="margin-top: 12px" @click="router.push('/material')">返回列表</el-button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHead from '../../components/PageHead.vue'
import StatusTag from '../../components/product-v3/StatusTag.vue'
import { buildPlanTree, findPlanNode, formatPlanTime, nodeChain } from '../../mock/product-v3/productPlan'
import { generatePlanSkuPreview } from '../../mock/product-v3/productPlanSku'
import { useCompatibilityStore } from '../../stores/product-v3'
import { useMaterialStore } from '../../stores/material'
import { useProductPlanStore } from '../../stores/productPlan'

const route = useRoute()
const router = useRouter()
const materialStore = useMaterialStore()
const compatibilityStore = useCompatibilityStore()
const planStore = useProductPlanStore()
const material = computed(() => materialStore.materialById(String(route.params.id || '')))
const created = computed(() => (material.value ? formatPlanTime(material.value.createTime) : ''))
const sourceNode = computed(() => {
  const current = material.value
  if (!current?.planId || !current.sourceNodeId) return null
  const plan = planStore.planById(current.planId)
  if (!plan) return null
  const tree = buildPlanTree(planStore.nodesOf(plan.id), plan.rootNodeId)
  return tree ? findPlanNode(tree, current.sourceNodeId) : null
})

function openSource() {
  const current = material.value
  const node = sourceNode.value
  if (!current?.planId || !node) return
  router.push({ path: `/product-plan/${current.planId}`, query: { node: node.id } })
}

const skuRows = computed(() => {
  const current = material.value
  if (!current) return []
  const plan = current.planId ? planStore.planById(current.planId) : undefined
  if (plan && current.sourceNodeId) {
    const nodes = planStore.nodesOf(plan.id)
    const tree = buildPlanTree(nodes, plan.rootNodeId)
    if (tree && findPlanNode(tree, current.sourceNodeId)) {
      return generatePlanSkuPreview(nodes, plan.rootNodeId, current.sourceNodeId).map((row) => ({
        code: row.code,
        path: row.path,
        specs: row.specs,
      }))
    }
  }
  return [{ code: current.materialCode, path: current.sourcePath, specs: [] as string[] }]
})

const relations = computed(() => {
  const current = material.value
  if (!current) return []
  const ancestorIds = new Set<string>()
  if (current.planId && current.sourceNodeId) {
    const plan = planStore.planById(current.planId)
    if (plan) {
      const tree = buildPlanTree(planStore.nodesOf(plan.id), plan.rootNodeId)
      if (tree) nodeChain(tree, current.sourceNodeId).forEach((node) => ancestorIds.add(node.id))
    }
  }
  return compatibilityStore.list
    .filter((item) => ancestorIds.has(item.mainProductId) || item.compatibleSkuIds.includes(current.id))
    .map((item) => ({
      id: item.id,
      role: item.compatibleSkuIds.includes(current.id) ? '作为配件' : '主商品',
      mainProductName: item.mainProductName,
      accessoryType: item.accessoryType,
      count: item.compatibleSkuIds.length,
    }))
})
</script>

<style scoped>
.trace { display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px; }
.trace div { background: #f7faff; border-radius: 8px; padding: 10px 12px; }
.trace span { display: block; color: #66788a; font-size: 12px; }
.trace b { display: block; margin-top: 4px; font-weight: 650; }
.trace-arrow { color: #409eff; padding-left: 12px; }
.source-desc { margin-top: 4px; }
</style>
