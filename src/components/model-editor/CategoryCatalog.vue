<template>
  <aside class="cat" :class="{ 'is-fold': folded }">
    <div class="cat-head">
      <strong v-show="!folded">商品分类</strong>
      <button type="button" @click="emit('update:folded', !folded)">{{ folded ? '展开' : '收起' }}</button>
    </div>
    <div v-show="!folded" class="cat-list">
      <button
        v-for="row in rows"
        :key="row.id"
        type="button"
        class="cat-item"
        :class="{ 'is-on': row.id === leafId, 'is-path': pathSet.has(row.id) && row.id !== leafId, 'is-root': row.depth === 0, 'is-child': row.depth > 0 }"
        :style="{ paddingLeft: `${12 + row.depth * 16}px` }"
        @click="row.hasChildren ? emit('toggle', row.id) : emit('select', row.id)"
      >
        <i v-if="row.hasChildren" class="twist">{{ row.expanded ? '▾' : '▸' }}</i>
        <span v-else class="twist"></span>
        <span class="cat-copy">
          <span class="cat-name">{{ row.name }}</span>
          <span v-if="!row.hasChildren && stats[row.id]?.models" class="cat-meta">{{ stats[row.id].models }}个模型</span>
        </span>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CategoryRow } from '../../domain/categoryTree'

const props = defineProps<{
  rows: CategoryRow[]
  leafId: string
  pathIds: string[]
  folded: boolean
  stats: Record<string, { types: number; models: number }>
}>()

const emit = defineEmits<{
  toggle: [id: string]
  select: [id: string]
  'update:folded': [value: boolean]
}>()

const pathSet = computed(() => new Set(props.pathIds))
</script>

<style scoped>
.cat { display: flex; flex-direction: column; min-height: 0; background: transparent; border: 0; border-radius: 0; overflow: hidden; }
.cat.is-fold .cat-head { justify-content: center; padding: 14px 4px; }
.cat-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 16px 14px 8px; color: #909399; }
.cat-head strong { font-size: 12px; font-weight: 500; }
.cat-head button { border: 0; background: none; color: #c0c4cc; cursor: pointer; padding: 0; font-size: 12px; }
.cat-list { overflow: auto; padding: 0 8px 16px; }
.cat-item { width: 100%; min-height: 32px; display: flex; gap: 4px; align-items: center; border: 0; background: transparent; text-align: left; border-radius: 4px; padding-top: 4px; padding-bottom: 4px; cursor: pointer; color: #606266; }
.cat-item.is-root .cat-name { color: #303133; font-size: 14px; font-weight: 600; }
.cat-item.is-child .cat-name { color: #606266; font-size: 13px; font-weight: 400; }
.cat-item.is-path .cat-name { color: #303133; }
.cat-item.is-on { background: #f7f8fa; box-shadow: inset 2px 0 0 #409eff; }
.cat-item.is-on .cat-name { color: #303133; font-weight: 650; }
.twist { flex: none; width: 12px; color: #c0c4cc; font-style: normal; font-size: 11px; line-height: 1; text-align: center; }
.cat-copy { min-width: 0; flex: 1; display: flex; align-items: baseline; gap: 6px; }
.cat-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 20px; }
.cat-meta { flex: none; color: #c0c4cc; font-size: 11px; line-height: 16px; font-weight: 400; }
</style>
