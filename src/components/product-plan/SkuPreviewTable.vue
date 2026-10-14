<template>
  <div>
    <div class="table-head">
      <strong>预览结果</strong>
      <span class="muted">{{ ready ? `共 ${rows.length} 条` : '尚未生成' }}</span>
    </div>
    <el-table :data="rows" :empty-text="ready ? '这个范围下没有可预览的规格组合' : '选择规划和范围后，点击生成预览'">
      <el-table-column prop="code" label="SKU编码" width="120" />
      <el-table-column v-for="name in specNames" :key="name" :label="name" min-width="100">
        <template #default="{ row }">{{ specOf(row, name) }}</template>
      </el-table-column>
      <el-table-column label="完整路径" min-width="280">
        <template #default="{ row }">{{ row.trail || row.path }}</template>
      </el-table-column>
      <el-table-column prop="combination" label="组合方式" width="110" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag effect="plain">{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="物料" width="110">
        <template #default="{ row }">
          <slot name="material" :row="row" />
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PlanSkuPreviewRow } from '../../mock/product-v3/productPlanSku'

const props = defineProps<{
  rows: PlanSkuPreviewRow[]
  ready: boolean
}>()

const specNames = computed(() => {
  const names: string[] = []
  props.rows.forEach((row) => {
    row.specs.forEach((spec) => {
      const name = spec.slice(0, spec.indexOf(':'))
      if (name && !names.includes(name)) names.push(name)
    })
  })
  return names
})

function specOf(row: PlanSkuPreviewRow, name: string) {
  const found = row.specs.find((item) => item.startsWith(`${name}:`))
  return found ? found.slice(name.length + 1) : '—'
}
</script>

<style scoped>
.table-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.table-head strong { font-size: 15px; }
</style>
