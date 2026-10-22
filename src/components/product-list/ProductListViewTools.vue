<template>
  <el-popover v-model:visible="visible" :hide-after="0" trigger="click" placement="bottom-end" :width="360" popper-class="product-list-tools-pop" :popper-options="{ modifiers: [{ name: 'preventOverflow', options: { altAxis: true, tether: false, padding: 12 } }] }">
    <template #reference>
      <el-button>列表设置</el-button>
    </template>
    <div class="view-tools">
      <p class="muted">列、分组、排序和视图都保存在当前视图里。</p>
      <el-checkbox :model-value="categorySidebar" @change="(value: boolean | string | number) => emit('categorySidebar', Boolean(value))">常驻分类栏</el-checkbox>
      <p class="tool-label">列</p>
      <el-input v-model="columnQuery" placeholder="搜索字段" clearable />
      <ul class="column-list">
        <li
          v-for="col in filteredColumns"
          :key="col.key"
          :data-column-key="col.key"
          :draggable="columnQuery.trim() ? 'false' : 'true'"
          @dragstart="onDragStart(col.key)"
          @dragover.prevent
          @drop="onDrop(col.key)"
        >
          <span class="drag-handle" :title="columnQuery.trim() ? '清除搜索后再调整顺序' : '拖动调整顺序'">⋮⋮</span>
          <el-checkbox :model-value="col.visible" :disabled="col.required" @change="(value: boolean | string | number) => emit('columnVisible', col.key, Boolean(value))">{{ col.label }}</el-checkbox>
        </li>
      </ul>
      <p v-if="filteredColumns.length === 0" class="muted">没有匹配的字段。</p>
      <el-button link type="primary" @click="emit('resetColumns')">恢复当前模式的默认列</el-button>
      <p class="tool-label">分组</p>
      <el-select :model-value="grouping?.field || ''" clearable placeholder="分组字段" @change="onGroupField">
        <el-option v-for="item in groupOptions" :key="item.field" :label="item.label" :value="item.field" />
      </el-select>
      <el-radio-group :model-value="grouping?.direction || 'asc'" @change="onGroupDirection">
        <el-radio-button value="asc">升序</el-radio-button>
        <el-radio-button value="desc">降序</el-radio-button>
      </el-radio-group>
      <el-button link type="primary" @click="emit('groupChange', null)">清除分组</el-button>
      <p class="tool-label">排序</p>
      <el-radio-group :model-value="sortMode" @change="onSortMode">
        <el-radio-button value="default">默认顺序</el-radio-button>
        <el-radio-button value="field">按字段排序</el-radio-button>
        <el-radio-button value="manual">手工排序</el-radio-button>
      </el-radio-group>
      <el-select :model-value="sorting?.field || ''" clearable placeholder="排序字段" @change="onSortField">
        <el-option v-for="item in sortOptions" :key="item.field" :label="item.label" :value="item.field" />
      </el-select>
      <el-radio-group :model-value="sorting?.direction || 'asc'" @change="onSortDirection">
        <el-radio-button value="asc">升序</el-radio-button>
        <el-radio-button value="desc">降序</el-radio-button>
      </el-radio-group>
      <el-button link type="primary" @click="emit('sortChange', null)">清除排序</el-button>
      <div class="tool-links">
        <el-button @click="emit('manage', 'create')">新建视图</el-button>
        <el-button @click="emit('manage', 'settings')">视图设置</el-button>
        <el-button @click="emit('manage', 'save-filter')">保存当前筛选</el-button>
        <el-button @click="emit('manage', 'import')">导入导出</el-button>
      </div>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ProductListFieldOrder, ProductListSortMode } from '../../domain/types'
import type { orderedColumns } from '../../domain/productListViews'

// Only transient column search/drag state lives here. Persisted changes go to the page.
const props = defineProps<{
  columns: ReturnType<typeof orderedColumns>
  groupOptions: { field: string; label: string }[]
  sortOptions: { field: string; label: string }[]
  grouping: ProductListFieldOrder | null
  sorting: ProductListFieldOrder | null
  categorySidebar: boolean
  sortMode: ProductListSortMode
}>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{
  categorySidebar: [enabled: boolean]
  columnVisible: [key: string, visible: boolean]
  columnMove: [from: string, to: string]
  resetColumns: []
  groupChange: [order: ProductListFieldOrder | null]
  sortChange: [order: ProductListFieldOrder | null]
  sortMode: [mode: ProductListSortMode]
  manage: [action: 'create' | 'settings' | 'save-filter' | 'import']
}>()
const columnQuery = ref('')
const dragKey = ref('')
const filteredColumns = computed(() => {
  const text = columnQuery.value.trim().toLowerCase()
  if (!text) return props.columns
  return props.columns.filter((item) => item.label.toLowerCase().includes(text) || item.key.toLowerCase().includes(text))
})
function onDragStart(key: string) {
  dragKey.value = key
}
function onDrop(key: string) {
  if (!dragKey.value || columnQuery.value.trim()) return
  emit('columnMove', dragKey.value, key)
  dragKey.value = ''
}
function onGroupField(field: string) {
  const direction = props.grouping?.direction || 'asc'
  emit('groupChange', field ? { field, direction } : null)
}
function onGroupDirection(direction: string | number | boolean) {
  const field = props.grouping?.field
  if (!field || (direction !== 'asc' && direction !== 'desc')) return
  emit('groupChange', { field, direction })
}
function onSortField(field: string) {
  const direction = props.sorting?.direction || 'asc'
  emit('sortChange', field ? { field, direction } : null)
}
function onSortDirection(direction: string | number | boolean) {
  const field = props.sorting?.field
  if (!field || (direction !== 'asc' && direction !== 'desc')) return
  emit('sortChange', { field, direction })
}
function onSortMode(mode: string | number | boolean) {
  if (mode === 'default' || mode === 'field' || mode === 'manual') emit('sortMode', mode)
}
</script>

<style scoped>
.view-tools { display: flex; flex-direction: column; gap: 8px; max-height: 70vh; overflow: auto; }
.view-tools > * { flex-shrink: 0; }
.tool-label { margin: 4px 0 0; color: #607089; font-size: 12px; }
.tool-links { display: flex; flex-wrap: wrap; gap: 8px; }
.column-list { list-style: none; margin: 0; padding: 0; max-height: 240px; overflow: auto; }
.column-list li { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
.drag-handle { cursor: grab; color: var(--text-secondary, #607089); user-select: none; }
</style>

<style>
.product-list-tools-pop { max-width: calc(100vw - 24px); box-sizing: border-box; }
</style>
