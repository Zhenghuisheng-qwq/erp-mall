<template>
  <div ref="rootRef" class="category-tree-select" data-category-tree-select :data-open="open ? '1' : '0'">
    <button
      ref="triggerRef"
      type="button"
      class="trigger"
      :class="{ 'is-open': open, 'is-disabled': disabled }"
      :disabled="disabled"
      :title="displayText"
      aria-haspopup="tree"
      :aria-expanded="open"
      @click="toggle"
      @keydown="onTriggerKey"
    >
      <span v-if="displayText" class="value">{{ displayText }}</span>
      <span v-else class="value is-placeholder">{{ placeholder }}</span>
      <i class="caret" aria-hidden="true">{{ open ? '▴' : '▾' }}</i>
    </button>
    <Teleport to="body">
      <div
        v-if="open"
        ref="panelRef"
        class="category-tree-select-panel"
        data-category-tree-select-panel
        role="tree"
        :style="panelStyle"
        @keydown="onPanelKey"
      >
        <el-input ref="searchRef" v-model="keyword" placeholder="搜索分类" clearable />
        <ul class="tree-list" :style="listStyle">
          <li v-for="(row, index) in rows" :key="row.id">
            <div
              class="tree-row"
              :class="{ 'is-on': selectedSet.has(row.id), 'is-focus': index === focusIndex, 'is-off': !row.enabled, 'is-ban': Boolean(reasonOf(row)) }"
              :style="{ paddingLeft: `${8 + row.depth * 16}px` }"
              :data-category-id="row.id"
              :data-selected="selectedSet.has(row.id) ? '1' : '0'"
            >
              <button
                v-if="row.hasChildren"
                type="button"
                class="twist"
                :data-expand-id="row.id"
                :aria-label="row.expanded ? '收起' : '展开'"
                @click.stop="toggleExpand(row.id)"
              >{{ row.expanded ? '▼' : '▸' }}</button>
              <span v-else class="twist is-empty"></span>
              <button
                type="button"
                class="node"
                :tabindex="index === focusIndex ? 0 : -1"
                :title="pathOf(row.id)"
                @click="pick(row)"
                @focus="focusIndex = index"
              >
                <template v-for="(part, partIndex) in highlightParts(row.name, keyword)" :key="partIndex">
                  <mark v-if="part.hit">{{ part.text }}</mark>
                  <template v-else>{{ part.text }}</template>
                </template>
              </button>
              <span v-if="selectedSet.has(row.id)" class="mark" aria-hidden="true">✓</span>
            </div>
            <p v-if="rejectId === row.id" class="reason" :style="{ paddingLeft: `${28 + row.depth * 16}px` }">{{ rejectText }}</p>
          </li>
        </ul>
        <p v-if="keyword.trim() && rows.length === 0" class="empty">没有匹配的分类。</p>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { categoryChain, categoryPathLabel, highlightParts, visibleCategoryRows, type CategoryRow } from '../domain/categoryTree'
import type { Category } from '../domain/types'

const props = withDefaults(defineProps<{
  categories: Category[]
  modelValue?: string | string[]
  multiple?: boolean
  leafOnly?: boolean
  disabled?: boolean
  placeholder?: string
  blockReason?: (id: string) => string
}>(), {
  modelValue: '',
  multiple: false,
  leafOnly: false,
  disabled: false,
  placeholder: '选择分类',
})

const emit = defineEmits<{
  'update:modelValue': [value: string | string[]]
  change: [value: string | string[]]
}>()

const rootRef = ref<HTMLElement>()
const triggerRef = ref<HTMLButtonElement>()
const panelRef = ref<HTMLElement>()
const searchRef = ref<{ focus: () => void }>()
const open = ref(false)
const keyword = ref('')
const expanded = ref(new Set<string>())
const closed = ref(new Set<string>())
const focusIndex = ref(0)
const rejectId = ref('')
const rejectText = ref('')
const panelStyle = ref<Record<string, string>>({})
const listStyle = ref<Record<string, string>>({ maxHeight: '240px' })
let swallowClick = false

const selectedIds = computed(() => {
  if (props.multiple) return Array.isArray(props.modelValue) ? props.modelValue.filter(Boolean) : []
  return typeof props.modelValue === 'string' && props.modelValue ? [props.modelValue] : []
})
const selectedSet = computed(() => new Set(selectedIds.value))
const rows = computed(() => visibleCategoryRows(props.categories, expanded.value, keyword.value, closed.value))
const displayText = computed(() => selectedIds.value.map((id) => categoryPathLabel(props.categories, id) || '分类已不存在').join('、'))

watch(rows, (list) => {
  if (focusIndex.value > list.length - 1) focusIndex.value = Math.max(0, list.length - 1)
})

function pathOf(id: string) {
  return categoryPathLabel(props.categories, id) || '分类已不存在'
}

function reasonOf(row: CategoryRow) {
  const custom = props.blockReason?.(row.id) || ''
  if (custom) return custom
  if (props.leafOnly && row.hasChildren) return '只能选择末级分类。'
  return ''
}

function place() {
  const trigger = triggerRef.value
  if (!trigger) return
  const rect = trigger.getBoundingClientRect()
  const margin = 8
  const dialog = trigger.closest('.el-dialog')
  const footer = dialog?.querySelector('.el-dialog__footer')
  const footerTop = footer instanceof HTMLElement ? footer.getBoundingClientRect().top : window.innerHeight
  const limitBottom = Math.min(window.innerHeight - margin, footerTop - margin)
  const spaceBelow = limitBottom - rect.bottom
  const spaceAbove = rect.top - margin
  const openUp = spaceBelow < 220 && spaceAbove > spaceBelow
  const room = Math.max(160, openUp ? spaceAbove - 4 : spaceBelow - 4)
  const height = Math.min(360, room)
  const width = Math.min(360, Math.max(rect.width, 260, Math.min(320, window.innerWidth - margin * 2)))
  const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin))
  const top = openUp ? Math.max(margin, rect.top - 4 - height) : Math.min(rect.bottom + 4, limitBottom - height)
  panelStyle.value = {
    position: 'fixed',
    left: `${left}px`,
    top: `${Math.max(margin, top)}px`,
    width: `${width}px`,
    maxHeight: `${height}px`,
    zIndex: '5200',
  }
  listStyle.value = { maxHeight: `${Math.max(96, height - 52)}px` }
}

function scrollFocus() {
  nextTick(() => panelRef.value?.querySelector('.is-focus')?.scrollIntoView({ block: 'nearest' }))
}

function openPanel() {
  if (props.disabled) return
  keyword.value = ''
  rejectId.value = ''
  rejectText.value = ''
  const next = new Set<string>()
  selectedIds.value.forEach((id) => categoryChain(props.categories, id).slice(0, -1).forEach((item) => next.add(item.id)))
  expanded.value = next
  closed.value = new Set()
  open.value = true
  nextTick(() => {
    place()
    const index = rows.value.findIndex((row) => selectedSet.value.has(row.id))
    focusIndex.value = index >= 0 ? index : 0
    searchRef.value?.focus()
    scrollFocus()
  })
}

function close() {
  if (!open.value) return
  open.value = false
  rejectId.value = ''
}

function toggle() {
  if (props.disabled) return
  if (open.value) close()
  else openPanel()
}

function toggleExpand(id: string) {
  const kept = rows.value[focusIndex.value]?.id || id
  if (closed.value.has(id)) {
    closed.value.delete(id)
    expanded.value.add(id)
  } else if (expanded.value.has(id)) {
    expanded.value.delete(id)
    closed.value.add(id)
  } else expanded.value.add(id)
  expanded.value = new Set(expanded.value)
  closed.value = new Set(closed.value)
  nextTick(() => {
    const index = rows.value.findIndex((row) => row.id === kept)
    if (index >= 0) focusIndex.value = index
    scrollFocus()
  })
}

function commit(value: string | string[]) {
  emit('update:modelValue', value)
  emit('change', value)
}

function pick(row: CategoryRow) {
  const reason = reasonOf(row)
  if (reason) {
    rejectId.value = row.id
    rejectText.value = reason
    return
  }
  rejectId.value = ''
  rejectText.value = ''
  if (props.multiple) {
    const current = selectedIds.value
    const next = current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id]
    commit(next)
    return
  }
  commit(row.id)
  close()
  nextTick(() => triggerRef.value?.focus())
}

function moveFocus(next: number) {
  if (!rows.value.length) return
  focusIndex.value = Math.max(0, Math.min(rows.value.length - 1, next))
  scrollFocus()
  panelRef.value?.querySelectorAll<HTMLButtonElement>('.node')[focusIndex.value]?.focus()
}

function parentFocusIndex(index: number) {
  const depth = rows.value[index]?.depth ?? 0
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (rows.value[cursor].depth < depth) return cursor
  }
  return -1
}

function onPanelKey(event: KeyboardEvent) {
  if (event.isComposing) return
  if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Enter', 'Tab'].includes(event.key)) return
  event.stopPropagation()
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    const search = panelRef.value?.querySelector('input')
    if (event.target === search) moveFocus(focusIndex.value)
    else moveFocus(focusIndex.value + 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    const search = panelRef.value?.querySelector('input')
    if (focusIndex.value <= 0 && event.target !== search) search?.focus()
    else moveFocus(focusIndex.value - 1)
  } else if (event.key === 'ArrowRight') {
    const row = rows.value[focusIndex.value]
    if (!row?.hasChildren) return
    event.preventDefault()
    if (!row.expanded) toggleExpand(row.id)
    else moveFocus(focusIndex.value + 1)
  } else if (event.key === 'ArrowLeft') {
    const row = rows.value[focusIndex.value]
    if (!row) return
    event.preventDefault()
    if (row.hasChildren && row.expanded) toggleExpand(row.id)
    else {
      const parent = parentFocusIndex(focusIndex.value)
      if (parent >= 0) moveFocus(parent)
    }
  } else if (event.key === 'Enter') {
    const row = rows.value[focusIndex.value]
    if (!row) return
    event.preventDefault()
    pick(row)
  } else if (event.key === 'Tab') {
    event.preventDefault()
    tabOut(event.shiftKey)
  }
}

function tabOut(backward: boolean) {
  const trigger = triggerRef.value
  close()
  if (!trigger) return
  const list = [...document.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])')].filter((el) => {
    if (el.closest('[data-category-tree-select-panel]')) return false
    const style = getComputedStyle(el)
    return style.display !== 'none' && style.visibility !== 'hidden'
  })
  const index = list.indexOf(trigger)
  list[index + (backward ? -1 : 1)]?.focus()
}

function onTriggerKey(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (!open.value) openPanel()
  }
}

function onDocKey(event: KeyboardEvent) {
  if (!open.value || event.key !== 'Escape' || event.isComposing) return
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
  close()
  nextTick(() => triggerRef.value?.focus())
}

function onPointerDown(event: PointerEvent) {
  if (!open.value) return
  const target = event.target
  if (!(target instanceof Node)) return
  if (rootRef.value?.contains(target) || panelRef.value?.contains(target)) return
  const element = target instanceof Element ? target : null
  const another = Boolean(element?.closest('[data-category-tree-select]'))
  close()
  if (another) return
  swallowClick = true
}

function onClick(event: MouseEvent) {
  if (!swallowClick) return
  swallowClick = false
  event.preventDefault()
  event.stopPropagation()
}

function onLayout() {
  if (open.value) place()
}

onMounted(() => {
  document.addEventListener('keydown', onDocKey, true)
  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('click', onClick, true)
  window.addEventListener('resize', onLayout)
  window.addEventListener('scroll', onLayout, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onDocKey, true)
  document.removeEventListener('pointerdown', onPointerDown, true)
  document.removeEventListener('click', onClick, true)
  window.removeEventListener('resize', onLayout)
  window.removeEventListener('scroll', onLayout, true)
})
</script>

<style scoped>
.category-tree-select { display: inline-block; width: 240px; max-width: 100%; vertical-align: middle; }
.trigger { width: 100%; min-height: 32px; display: flex; align-items: center; gap: 8px; padding: 0 11px; border: 1px solid var(--border-default, #dcdfe6); border-radius: 4px; background: var(--surface-bg, #fff); color: var(--text-primary, #253044); cursor: pointer; text-align: left; }
.trigger:hover:not(:disabled), .trigger.is-open { border-color: var(--el-color-primary, #409eff); }
.trigger:disabled, .trigger.is-disabled { cursor: not-allowed; opacity: 0.6; }
.value { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; line-height: 30px; }
.value.is-placeholder { color: var(--text-secondary, #909399); }
.caret { flex: none; color: var(--text-secondary, #909399); font-style: normal; font-size: 12px; }
</style>

<style>
.category-tree-select-panel { box-sizing: border-box; display: flex; flex-direction: column; gap: 8px; padding: 8px; border: 1px solid var(--border-default, #e4e8ef); border-radius: 8px; background: var(--surface-bg, #fff); color: var(--text-primary, #253044); box-shadow: 0 8px 24px color-mix(in srgb, #000 18%, transparent); }
.category-tree-select-panel .tree-list { list-style: none; margin: 0; padding: 0; overflow: auto; }
.category-tree-select-panel .tree-row { display: flex; align-items: center; gap: 4px; min-height: 30px; border-radius: 4px; }
.category-tree-select-panel .tree-row:hover:not(.is-on) { background: color-mix(in srgb, var(--text-primary, #253044) 6%, transparent); }
.category-tree-select-panel .tree-row.is-on { background: color-mix(in srgb, var(--el-color-primary, #409eff) 16%, transparent); }
.category-tree-select-panel .tree-row.is-focus { outline: 1px solid color-mix(in srgb, var(--el-color-primary, #409eff) 70%, transparent); outline-offset: -1px; }
.category-tree-select-panel .tree-row.is-off { opacity: 0.55; }
.category-tree-select-panel .twist, .category-tree-select-panel .node { border: 0; background: transparent; color: inherit; cursor: pointer; }
.category-tree-select-panel .twist { flex: none; width: 18px; padding: 0; color: var(--text-secondary, #909399); font-size: 12px; line-height: 1; }
.category-tree-select-panel .twist.is-empty { cursor: default; }
.category-tree-select-panel .node { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; padding: 4px 0; font-size: 13px; line-height: 20px; }
.category-tree-select-panel .tree-row.is-on .node { font-weight: 650; color: var(--el-color-primary, #409eff); }
.category-tree-select-panel .tree-row.is-ban .node { cursor: not-allowed; }
.category-tree-select-panel .mark { flex: none; color: var(--el-color-primary, #409eff); font-size: 12px; font-weight: 700; }
.category-tree-select-panel mark { background: color-mix(in srgb, var(--el-color-primary, #409eff) 28%, transparent); color: inherit; padding: 0 1px; border-radius: 2px; }
.category-tree-select-panel .reason, .category-tree-select-panel .empty { margin: 0; color: var(--text-secondary, #909399); font-size: 12px; line-height: 1.45; }
.category-tree-select-panel .reason { color: var(--status-danger, #c45656); }
</style>
