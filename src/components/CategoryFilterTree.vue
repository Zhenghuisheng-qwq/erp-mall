<template>
  <div class="category-filter-tree" data-category-tree>
    <el-input v-model="keyword" placeholder="搜索分类" clearable />
    <button type="button" class="tree-all" :class="{ 'is-on': selectedIds.length === 0 }" @click="$emit('clear')">全部分类</button>
    <ul class="tree-list">
      <li v-for="row in rows" :key="row.id" :style="{ paddingLeft: `${8 + row.depth * 14}px` }" :class="{ 'is-on': selectedIds.includes(row.id), 'is-off': !row.enabled }">
        <button v-if="row.hasChildren" type="button" class="twist" :data-expand-id="row.id" @click.stop="toggleExpand(row.id)">{{ row.expanded ? '▼' : '▸' }}</button>
        <span v-else class="twist is-empty"></span>
        <button type="button" class="node" :data-category-id="row.id" @click="$emit('toggle', row.id)">{{ row.name }}</button>
      </li>
    </ul>
    <p v-if="keyword.trim() && rows.length === 0" class="muted">没有匹配的分类。</p>
    <div class="tree-actions">
      <button v-if="placement !== 'sidebar'" type="button" @click="$emit('dock')">停靠左侧</button>
      <button v-else type="button" @click="$emit('float')">回到顶部</button>
      <button type="button" @click="$emit('hide')">收起</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { visibleCategoryRows } from '../domain/categoryTree'
import type { Category } from '../domain/types'

const props = defineProps<{ categories: Category[]; selectedIds: string[]; placement: 'popover' | 'sidebar' }>()
defineEmits<{ toggle: [id: string]; clear: []; dock: []; float: []; hide: [] }>()

const keyword = ref('')
const expanded = ref(new Set<string>())
const closed = ref(new Set<string>())
const rows = computed(() => visibleCategoryRows(props.categories, expanded.value, keyword.value, closed.value))

function toggleExpand(id: string) {
  if (closed.value.has(id)) closed.value.delete(id)
  else if (expanded.value.has(id)) {
    expanded.value.delete(id)
    closed.value.add(id)
  } else expanded.value.add(id)
  expanded.value = new Set(expanded.value)
  closed.value = new Set(closed.value)
}
</script>

<style scoped>
.category-filter-tree { display: flex; flex-direction: column; gap: 8px; min-width: 220px; }
.tree-list { list-style: none; margin: 0; padding: 0; max-height: 320px; overflow: auto; }
.tree-list li { display: flex; align-items: center; gap: 4px; min-height: 28px; border-radius: 4px; }
.tree-list li.is-on { background: color-mix(in srgb, var(--el-color-primary) 14%, transparent); }
.tree-list li.is-off { opacity: 0.55; }
.twist, .node, .tree-all, .tree-actions button { border: 0; background: transparent; color: inherit; cursor: pointer; }
.twist { width: 18px; padding: 0; }
.twist.is-empty { cursor: default; }
.node { flex: 1; text-align: left; padding: 4px 0; }
.tree-all.is-on { font-weight: 650; color: var(--el-color-primary); }
.tree-actions { display: flex; justify-content: space-between; gap: 8px; }
.muted { color: var(--text-secondary, #607089); font-size: 13px; }
</style>
