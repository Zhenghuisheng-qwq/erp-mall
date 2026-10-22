<template>
  <el-dialog v-model="visible" title="更多筛选" width="min(720px, calc(100vw - 24px))">
    <p class="muted">条件即时生效；关闭面板保留当前筛选。同字段的多条条件需同时满足。</p>
    <div v-for="filter in rows" :key="filter.id" class="filter-row" :data-condition="filter.field">
      <el-select :model-value="filter.field" style="width: 140px" @change="(value: string) => emit('field', filter.id, value)">
        <el-option v-for="item in fields" :key="item.field" :label="item.label" :value="item.field" />
      </el-select>
      <el-select :model-value="filter.operator" style="width: 120px" @change="(value: ProductListFilterOperator) => emit('operator', filter.id, value)">
        <el-option v-for="item in filter.operators" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <el-date-picker v-if="filter.kind === 'date' && filter.operator === 'between'" :model-value="filter.range" type="daterange" value-format="YYYY-MM-DD" style="width: 240px" @update:model-value="(value: [string, string] | null) => emit('value', filter.id, { from: value?.[0] || '', to: value?.[1] || '' })" />
      <el-date-picker v-else-if="filter.kind === 'date'" :model-value="filter.text" type="date" value-format="YYYY-MM-DD" @update:model-value="(value: string) => emit('value', filter.id, value || '')" />
      <CategoryTreeSelect v-else-if="filter.field === 'category' && filter.operator === 'in'" multiple :model-value="filter.categoryIds" :categories="categories" placeholder="选择分类" style="width: 220px" @update:model-value="(value) => emit('value', filter.id, Array.isArray(value) ? value : [])" />
      <CategoryTreeSelect v-else-if="filter.field === 'category'" :model-value="filter.categoryId" :categories="categories" placeholder="选择分类" style="width: 220px" @update:model-value="(value) => emit('value', filter.id, typeof value === 'string' ? value : '')" />
      <el-select v-else-if="filter.operator === 'in'" :model-value="filter.values" multiple collapse-tags style="width: 220px" @change="(value: string[]) => emit('value', filter.id, value)">
        <el-option v-for="item in filter.options" :key="item" :label="item" :value="item" />
      </el-select>
      <el-select v-else-if="filter.kind !== 'text'" :model-value="filter.text" clearable filterable style="width: 220px" @change="(value: string) => emit('value', filter.id, value || '')">
        <el-option v-for="item in filter.options" :key="item" :label="item" :value="item" />
      </el-select>
      <el-input v-else :model-value="filter.text" style="width: 220px" @update:model-value="(value: string) => emit('value', filter.id, value)" />
      <el-button link type="danger" @click="emit('remove', filter.id)">删除</el-button>
    </div>
    <el-button @click="emit('add')">添加条件</el-button>
    <p class="muted">显示在常用筛选：取消显示不会删除条件。复杂条件通过本面板管理。</p>
    <el-checkbox v-for="field in fields.filter(item => item.field !== 'category')" :key="field.field" :data-expose-field="field.field" :model-value="exposed.includes(field.field)" @change="(value: boolean | string | number) => emit('expose', field.field, Boolean(value))">{{ field.label }}</el-checkbox>
  </el-dialog>
</template>

<script setup lang="ts">
import CategoryTreeSelect from '../CategoryTreeSelect.vue'
import type { Category, ProductListFilterOperator, ProductListViewFilter } from '../../domain/types'
import type { FilterEditorRow, FilterField } from './filterPresentation'

// Conditions remain live in the active saved view; closing the dialog is not rollback.
defineProps<{
  rows: FilterEditorRow[]
  fields: FilterField[]
  categories: Category[]
  exposed: string[]
}>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{
  add: []
  field: [id: string, field: string]
  operator: [id: string, operator: ProductListFilterOperator]
  value: [id: string, value: ProductListViewFilter['value']]
  remove: [id: string]
  expose: [field: string, exposed: boolean]
}>()
</script>

<style scoped>
.filter-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }
.filter-row > * { max-width: 100%; }
</style>
