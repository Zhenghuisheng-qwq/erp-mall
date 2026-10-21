<template>
  <aside class="cat" :class="{ 'is-fold': folded }">
    <div class="cat-head">
      <strong v-show="!folded">商品分类</strong>
      <button type="button" @click="emit('update:folded', !folded)">{{ folded ? '展开' : '收起' }}</button>
    </div>
    <div v-show="!folded" class="cat-list" @keydown="onTreeKey">
      <el-input :model-value="keyword" class="cat-search" placeholder="搜索分类" clearable @update:model-value="emit('update:keyword', String($event ?? ''))" />
      <div
        v-for="row in rows"
        :key="row.id"
        class="cat-item"
        :class="{ 'is-on': row.id === leafId, 'is-path': pathSet.has(row.id) && row.id !== leafId, 'is-root': row.depth === 0, 'is-child': row.depth > 0 }"
        :style="{ paddingLeft: `${8 + row.depth * 16}px` }"
      >
        <button v-if="row.hasChildren" type="button" class="twist" :data-expand-id="row.id" :aria-label="row.expanded ? '收起' : '展开'" @click.stop="emit('toggle', row.id)">{{ row.expanded ? '▼' : '▸' }}</button>
        <span v-else class="twist"></span>
        <button type="button" class="cat-label" :data-category-id="row.id" @click="emit('select', row.id)">
          <span class="cat-name" :title="row.name">
            <template v-for="(part, index) in highlightParts(row.name, keyword)" :key="index">
              <mark v-if="part.hit">{{ part.text }}</mark>
              <template v-else>{{ part.text }}</template>
            </template>
          </span>
          <span v-if="!row.hasChildren && stats[row.id]?.models" class="cat-meta">{{ stats[row.id].models }}个模型</span>
        </button>
        <span v-if="row.id === leafId" class="mark">✓</span>
      </div>
      <p v-if="keyword.trim() && rows.length === 0" class="muted">没有匹配的分类。</p>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { highlightParts, type CategoryRow } from '../../domain/categoryTree'

const props = defineProps<{
  rows: CategoryRow[]
  leafId: string
  pathIds: string[]
  folded: boolean
  stats: Record<string, { types: number; models: number }>
  keyword?: string
}>()

const emit = defineEmits<{
  toggle: [id: string]
  select: [id: string]
  'update:folded': [value: boolean]
  'update:keyword': [value: string]
}>()

const keyword = computed(() => props.keyword || '')

function onTreeKey(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (!target || event.isComposing) return
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
    if (event.key !== 'ArrowDown') return
    event.preventDefault()
    target.closest('.cat-list')?.querySelector<HTMLElement>('[data-category-id]')?.focus()
    return
  }
  const current = target.closest<HTMLElement>('[data-category-id]')
  if (!current) return
  const buttons = [...(current.closest('.cat-list')?.querySelectorAll<HTMLElement>('[data-category-id]') || [])]
  const index = buttons.indexOf(current)
  const row = props.rows.find((item) => item.id === current.dataset.categoryId)
  if (event.key === 'ArrowDown' && buttons[index + 1]) {
    event.preventDefault()
    buttons[index + 1].focus()
  } else if (event.key === 'ArrowUp' && buttons[index - 1]) {
    event.preventDefault()
    buttons[index - 1].focus()
  } else if (event.key === 'ArrowRight' && row?.hasChildren && !row.expanded) {
    event.preventDefault()
    emit('toggle', row.id)
  } else if (event.key === 'ArrowLeft' && row) {
    event.preventDefault()
    if (row.hasChildren && row.expanded) emit('toggle', row.id)
    else if (row.parentId) buttons.find((item) => item.dataset.categoryId === row.parentId)?.focus()
  }
}

const pathSet = computed(() => new Set(props.pathIds))
</script>

<style scoped>
.cat { display: flex; flex-direction: column; min-height: 0; background: transparent; border: 0; border-radius: 0; overflow: hidden; }
.cat.is-fold .cat-head { justify-content: center; padding: 14px 4px; }
.cat-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 16px 14px 8px; color: #909399; }
.cat-head strong { font-size: 12px; font-weight: 500; }
.cat-head button { border: 0; background: none; color: #c0c4cc; cursor: pointer; padding: 0; font-size: 12px; }
.cat-list { overflow: auto; padding: 0 8px 16px; }
.cat-search { margin-bottom: 8px; }
.cat-item { width: 100%; min-height: 32px; display: flex; gap: 4px; align-items: center; border: 0; background: transparent; text-align: left; border-radius: 4px; padding-top: 2px; padding-bottom: 2px; color: var(--text-secondary, #606266); }
.cat-item:hover:not(.is-on) { background: var(--hover-bg, #f4f7fb); }
.cat-label { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 6px; border: 0; background: transparent; color: inherit; text-align: left; cursor: pointer; padding: 4px 0; }
.cat-label:focus-visible { outline: 1px solid var(--app-accent, #409eff); outline-offset: 2px; border-radius: 4px; }
.mark { flex: none; color: var(--app-accent, #409eff); font-size: 12px; font-weight: 700; }
.cat-name mark { background: color-mix(in srgb, var(--status-warning, #ad7a12) 42%, transparent); color: inherit; padding: 0 1px; border-radius: 2px; }
.muted { margin: 8px 4px; color: var(--text-muted, #909399); font-size: 12px; }
.cat-item.is-root .cat-name { color: var(--text-primary, #303133); font-size: 14px; font-weight: 600; }
.cat-item.is-child .cat-name { color: var(--text-secondary, #606266); font-size: 13px; font-weight: 400; }
.cat-item.is-on { background: var(--app-selected-bg, #ebf0ff); box-shadow: inset 2px 0 0 var(--app-accent, #409eff); }
.cat-item.is-on .cat-name { color: var(--text-primary, #303133); }
.twist { flex: none; width: 16px; padding: 0; border: 0; background: transparent; color: #c0c4cc; font-style: normal; font-size: 11px; line-height: 1; text-align: center; cursor: pointer; }
.cat-copy { min-width: 0; flex: 1; display: flex; align-items: baseline; gap: 6px; }
.cat-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 20px; }
.cat-meta { flex: none; color: #c0c4cc; font-size: 11px; line-height: 16px; font-weight: 400; }
</style>
