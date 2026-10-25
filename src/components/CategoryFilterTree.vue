<template>
  <div class="category-filter-tree" data-category-tree>
    <el-input v-model="keyword" placeholder="搜索分类" clearable />
    <button type="button" class="tree-all" :class="{ 'is-on': selectedIds.length === 0 }" @click="$emit('clear')">全部分类</button>
    <div class="tree-scroll" data-category-scroll tabindex="0" aria-label="分类树滚动区域"><ul class="tree-list">
      <li v-for="row in rows" :key="row.id" :style="{ paddingLeft: `${8 + row.depth * 16}px` }" :class="{ 'is-on': selectedIds.includes(row.id), 'is-off': !row.enabled }">
        <button v-if="row.hasChildren" type="button" class="twist" :data-expand-id="row.id" @click.stop="toggleExpand(row.id)">{{ row.expanded ? '▼' : '▸' }}</button>
        <span v-else class="twist is-empty"></span>
        <button type="button" class="node" :data-category-id="row.id" :title="row.name" @click="$emit('toggle', row.id)">
          <template v-for="(part, index) in highlightParts(row.name, keyword)" :key="index">
            <mark v-if="part.hit">{{ part.text }}</mark>
            <template v-else>{{ part.text }}</template>
          </template>
        </button>
        <span v-if="selectedIds.includes(row.id)" class="mark">✓</span>
      </li>
    </ul>
    <p v-if="keyword.trim() && rows.length === 0" class="muted">没有匹配的分类。</p>
    </div>
    <div class="tree-actions">
      <button type="button" @click="$emit('clear')">清除分类</button>
      <button v-if="closable" type="button" @click="$emit('close')">收起分类面板</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { highlightParts, visibleCategoryRows } from '../domain/categoryTree'
import type { Category } from '../domain/types'

const props = defineProps<{ categories: Category[]; selectedIds: string[]; closable?: boolean }>()
defineEmits<{ toggle: [id: string]; clear: []; close: [] }>()

const keyword = ref('')
const expanded = ref(new Set<string>())
const closed = ref(new Set<string>())
const rows = computed(() => visibleCategoryRows(props.categories, expanded.value, keyword.value, closed.value))

function toggleExpand(id: string) {
  if (closed.value.has(id)) {
    closed.value.delete(id)
    expanded.value.add(id)
  } else if (expanded.value.has(id)) {
    expanded.value.delete(id)
    closed.value.add(id)
  } else expanded.value.add(id)
  expanded.value = new Set(expanded.value)
  closed.value = new Set(closed.value)
}
</script>

<style scoped>
.category-filter-tree { display: flex; flex-direction: column; gap: 8px; min-width: 0; width:100%; min-height:0; }
.category-filter-tree > :not(.tree-scroll) { flex-shrink:0; }
.tree-scroll { overflow:auto; min-height:72px; max-height:min(58vh,640px); overscroll-behavior:contain; }
.tree-list { list-style: none; margin: 0; padding: 0; width:max-content; min-width:100%; }
.tree-list li { display: flex; align-items: center; gap: 4px; min-height: 30px; border-radius: 4px; padding-right:8px; box-sizing:border-box; }
.tree-list li.is-on { background: color-mix(in srgb, var(--el-color-primary) 14%, transparent); }
.tree-list li.is-off { opacity: 0.55; }
.twist, .node, .tree-all, .tree-actions button { border: 0; background: transparent; color: inherit; cursor: pointer; }
.twist { width: 18px; padding: 0; flex:none; }
.twist.is-empty { cursor: default; }
.node { flex: 1; white-space: nowrap; text-align: left; padding: 4px 0; }
.mark { flex: none; color: var(--el-color-primary); font-size: 12px; font-weight: 700; }
mark { background: color-mix(in srgb, var(--el-color-primary) 28%, transparent); color: inherit; padding: 0 1px; border-radius: 2px; }
.tree-all.is-on { font-weight: 650; color: var(--el-color-primary); }
.tree-actions { display: flex; justify-content: space-between; gap: 8px; }
.muted { color: var(--text-secondary, #607089); font-size: 13px; }
</style>
<style>:root { --product-category-width:240px; }</style>
