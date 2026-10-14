<template>
  <div v-if="record">
    <PageHead :title="`${mainName} · ${record.accessoryType}`" desc="主商品类型下的一类配件，以及具体可配物料。">
      <el-button @click="openMain">查看主商品</el-button>
      <el-button @click="router.push('/compatibility')">返回列表</el-button>
    </PageHead>
    <div class="panel">
      <h2>关系</h2>
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="主商品">
          <button type="button" class="linkish" @click="openMain">{{ mainName }}</button>
        </el-descriptions-item>
        <el-descriptions-item label="兼容类型">{{ record.accessoryType }}</el-descriptions-item>
        <el-descriptions-item label="状态"><StatusTag kind="compat" :status="record.status" /></el-descriptions-item>
        <el-descriptions-item label="说明">{{ record.description || '无' }}</el-descriptions-item>
      </el-descriptions>
    </div>
    <div class="panel">
      <h2>具体SKU</h2>
      <el-table :data="skus">
        <el-table-column prop="materialCode" label="物料编码" width="140" />
        <el-table-column prop="name" label="名称" min-width="180" />
        <el-table-column prop="sourcePath" label="来源" min-width="220" />
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button v-if="row.id" link type="primary" @click="router.push(`/material/${row.id}`)">查看物料</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
  <div v-else class="panel">
    <p>没有找到这条兼容关系。</p>
    <el-button style="margin-top: 12px" @click="router.push('/compatibility')">返回列表</el-button>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHead from '../../components/PageHead.vue'
import StatusTag from '../../components/product-v3/StatusTag.vue'
import { useCompatibilityStore } from '../../stores/product-v3'
import { useMaterialStore } from '../../stores/material'
import { useProductPlanStore } from '../../stores/productPlan'

const route = useRoute()
const router = useRouter()
const compatibilityStore = useCompatibilityStore()
const materialStore = useMaterialStore()
const planStore = useProductPlanStore()
const record = computed(() => compatibilityStore.byId(String(route.params.id || '')))
const mainName = computed(() => {
  const current = record.value
  if (!current) return ''
  return planStore.state.nodes.find((node) => node.id === current.mainProductId)?.name || current.mainProductName
})
const skus = computed(() => {
  const current = record.value
  if (!current) return []
  return current.compatibleSkuIds.map((id) => {
    const material = materialStore.materialById(id)
    return material || { id: '', materialCode: id, name: '未找到物料', sourcePath: '' }
  })
})
function openMain() {
  const current = record.value
  if (!current) return
  const node = planStore.state.nodes.find((item) => item.id === current.mainProductId)
  if (!node) {
    ElMessage.warning('规划里已经没有这个主商品')
    return
  }
  router.push({ path: `/product-plan/${node.planId}`, query: { node: node.id } })
}
</script>
