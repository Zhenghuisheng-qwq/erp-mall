<template>
  <div>
    <PageHead title="商品总览" desc="按一整款查看商品，或用矩阵对照规格。">
      <el-select v-model="templateId" style="width: 180px">
        <el-option v-for="item in leafTemplates" :key="item.id" :label="groupLabel(item.id)" :value="item.id" />
      </el-select>
    </PageHead>
    <div class="panel">
      <el-radio-group v-model="tab" style="margin-bottom: 12px">
        <el-radio-button value="family">商品视图</el-radio-button>
        <el-radio-button value="matrix">规格矩阵</el-radio-button>
      </el-radio-group>
      <el-table v-if="tab === 'family'" :data="familyRows">
        <el-table-column prop="name" label="商品" min-width="180">
          <template #default="{ row }"><button class="linkish" @click="router.push(`/products/${row.id}`)">{{ row.name }}</button></template>
        </el-table-column>
        <el-table-column prop="total" label="规格数" width="90" />
        <el-table-column prop="sale" label="在售" width="80" />
        <el-table-column prop="draft" label="草稿" width="80" />
        <el-table-column prop="ready" label="必填完整" width="100" />
        <el-table-column prop="problem" label="有问题的规格" min-width="220" />
      </el-table>
      <div v-else>
        <div class="row-actions" style="margin-bottom: 8px">
          <span class="muted">列维度</span>
          <el-select v-model="columnId" style="width: 180px">
            <el-option v-for="item in axis" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </div>
        <el-table :data="matrix.rows" border>
          <el-table-column v-for="(name, index) in matrix.rowParams" :key="name" :label="name" min-width="100">
            <template #default="{ row }">{{ row.path[index] || '（空）' }}</template>
          </el-table-column>
          <el-table-column v-for="(col, index) in matrix.colValues" :key="col" :label="`${matrix.colParam}：${col}`" min-width="140">
            <template #default="{ row }">
              <button class="linkish matrix-cell" :class="cellClass(row.cells[index].state)" @click="openCell(row.cells[index])">{{ row.cells[index].label }}</button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHead from '../components/PageHead.vue'
import { buildMatrix, inspectFamily, mappingsForTemplate, structureParams } from '../domain/logic'
import type { MatrixCell } from '../domain/types'
import { useCatalogStore } from '../stores/catalog'

const store = useCatalogStore()
const router = useRouter()
const tab = ref('family')
const templateId = ref('t-phone')
const columnId = ref('p-net')
const leafTemplates = computed(() => store.data.templates.filter((item) => item.structureOrder.length > 0))
function groupLabel(id: string) {
  const name = store.data.templates.find((item) => item.id === id)?.name || id
  const count = mappingsForTemplate(store.data, id).length
  return count > 1 ? `${name}（${count}个分类）` : name
}
const axis = computed(() => structureParams(store.data, templateId.value))
const matrix = computed(() => buildMatrix(store.data, templateId.value, columnId.value))
const familyRows = computed(() =>
  store.data.families
    .filter((item) => item.templateId === templateId.value)
    .map((family) => {
      const skus = store.skusOf(family.id)
      const bad = skus.filter((sku) => inspectFamily(store.data, family, [sku]).some((issue) => issue.level === 'error' && issue.skuId === sku.id))
      const ready = skus.length - bad.length
      return {
        id: family.id,
        name: family.name,
        total: skus.length,
        sale: skus.filter((sku) => sku.status === 'on_sale').length,
        draft: skus.filter((sku) => sku.status === 'draft').length,
        ready,
        problem: bad.length ? bad.map((sku) => inspectFamily(store.data, family, [sku]).find((issue) => issue.level === 'error')?.message).join('；') : '无',
      }
    }),
)
watch(axis, (list) => {
  if (!list.some((item) => item.id === columnId.value)) columnId.value = list[list.length - 1]?.id || ''
})
function cellClass(state: MatrixCell['state']) {
  if (state === 'ok') return 'cell-ok'
  if (state === 'missing') return 'cell-miss'
  if (state === 'empty-axis') return 'cell-empty'
  return 'cell-bad'
}
function openCell(cell: MatrixCell) {
  if (cell.familyId) router.push(`/products/${cell.familyId}`)
}
</script>
