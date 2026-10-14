<template>
  <div>
    <PageHead title="兼容关系" desc="主商品对应配件类型，再落到具体物料。">
    </PageHead>
    <div class="panel">
      <h2>关系视图</h2>
      <p v-if="!groups.length" class="muted">暂无兼容关系</p>
      <div v-for="group in groups" :key="group.id" class="rel">
        <button type="button" class="rel-main" @click="openMain(group.id)">{{ group.name }}</button>
        <div class="rel-stem" />
        <div class="rel-types">
          <div v-for="item in group.items" :key="item.id" class="rel-type">
            <button type="button" class="rel-kind" @click="router.push(`/compatibility/${item.id}`)">{{ item.type }}</button>
            <div class="rel-skus">
              <span v-for="name in item.skus" :key="name">{{ name }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="panel">
      <el-table :data="rows" empty-text="暂无兼容关系">
        <el-table-column label="主商品" min-width="140">
          <template #default="{ row }">
            <button type="button" class="linkish" @click="openMain(row.mainProductId)">{{ row.mainProductName }}</button>
          </template>
        </el-table-column>
        <el-table-column prop="accessoryType" label="兼容类型" min-width="140" />
        <el-table-column prop="count" label="兼容SKU数量" width="140" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <StatusTag kind="compat" :status="row.status" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="router.push(`/compatibility/${row.id}`)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
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
const mainFilter = computed(() => String(route.query.main || ''))

const rows = computed(() =>
  compatibilityStore.list
    .filter((item) => !mainFilter.value || item.mainProductId === mainFilter.value)
    .map((item) => ({
      ...item,
      mainProductName: planStore.state.nodes.find((node) => node.id === item.mainProductId)?.name || item.mainProductName,
      count: item.compatibleSkuIds.length,
    })),
)

function openMain(mainProductId: string) {
  const node = planStore.state.nodes.find((item) => item.id === mainProductId)
  if (!node) return
  router.push({ path: `/product-plan/${node.planId}`, query: { node: node.id } })
}

const groups = computed(() => {
  const grouped = new Map<string, { id: string; name: string; items: { id: string; type: string; skus: string[] }[] }>()
  rows.value.forEach((row) => {
    const current = grouped.get(row.mainProductId) || { id: row.mainProductId, name: row.mainProductName, items: [] }
    current.items.push({
      id: row.id,
      type: row.accessoryType,
      skus: row.compatibleSkuIds.map((id) => materialStore.materialById(id)?.name || id),
    })
    grouped.set(row.mainProductId, current)
  })
  return [...grouped.values()]
})
</script>

<style scoped>
.rel { display: flex; flex-direction: column; align-items: center; margin-top: 8px; }
.rel-main, .rel-kind { border: 1px solid #d9e2ec; background: #fff; border-radius: 6px; padding: 8px 16px; cursor: pointer; font-weight: 650; }
.rel-main { border-left: 4px solid #409eff; }
.rel-kind { border-left: 4px solid #67c23a; font-weight: 500; }
.rel-stem { width: 1px; height: 16px; background: #c5d0dc; }
.rel-types { display: flex; flex-wrap: wrap; justify-content: center; gap: 16px; }
.rel-type { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.rel-skus { display: flex; flex-direction: column; gap: 4px; color: #66788a; font-size: 12px; text-align: center; }
</style>
