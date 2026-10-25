<template>
  <div ref="rootEl" class="outline" :class="{ 'is-mubu': mubu }" @focusout="clearEditing">
    <p v-if="mubu && editingText" class="editing-now">正在编辑：{{ editingText }}</p>
    <div v-if="!viewing && !mubu" class="outline-tools">
      <el-button link type="primary" @click="emit('ask')">新增节点</el-button>
    </div>
    <div
      class="outline-root"
      :class="{ 'is-on': activeId === rootId, 'is-editing': editingId === rootId, 'drop-in': drop.place === 'inside' && drop.id === rootId }"
      @dragover.prevent="onDragOver(rootId, $event, true)"
      @drop.prevent="onDrop(rootId, true)"
      @contextmenu.prevent="openMenu(rootId, $event)"
    >
      <span class="twist"></span>
      <span class="line-wrap">
        <input class="root-line" :data-line="rootId" :value="rootTitle" readonly title="模型名称在创建时确定" @focus="markEditing(rootId, $event)" @keydown="onRootKey" />
      </span>
    </div>
    <div
      v-for="row in rows"
      :key="row.node.id"
      class="outline-row"
      :class="{ 'is-on': activeId === row.node.id, 'is-editing': editingId === row.node.id, 'is-head': row.depth === 0 && row.node.nodeType === 'ATTRIBUTE', 'is-attribute': row.node.nodeType === 'ATTRIBUTE', 'is-value': row.node.nodeType === 'VALUE', 'drop-before': drop.id === row.node.id && drop.place === 'before', 'drop-after': drop.id === row.node.id && drop.place === 'after', 'drop-in': drop.id === row.node.id && drop.place === 'inside' }"
      :style="{ paddingLeft: (mubu ? 4 : 12) + row.depth * (mubu ? 36 : 28) + 'px' }"
      @dragover.prevent="onDragOver(row.node.id, $event, false)"
      @drop.prevent="onDrop(row.node.id, false)"
      @contextmenu.prevent="openMenu(row.node.id, $event)"
    >
      <button v-if="row.hasChildren" type="button" class="twist" @click.stop="emit('toggle', row.node.id)">{{ isOpen(row.node) ? '▾' : '▸' }}</button>
      <span v-else class="twist"></span>
      <span v-if="!viewing" class="grip" draggable="true" @dragstart.stop="onDragStart(row.node.id, $event)" @dragend="drop = { id: '', place: '' }">⋮⋮</span>
      <span class="line-wrap">
        <el-select
          v-if="!viewing && pickingId === row.node.id"
          class="line-pick"
          :model-value="boundToken(row.node)"
          filterable
          default-first-option
          automatic-dropdown
          :filter-method="rememberQuery"
          placeholder="搜索词典，没有时可新增"
          style="flex: 1; min-width: 160px"
          :data-line="row.node.id"
          @change="onPick(row.node, $event)"
          @visible-change="onPickVisible"
          @keydown.esc.stop.prevent="closePick"
          @keydown.delete.stop
          @keydown.enter.stop
          @keydown.tab.stop
          @mousedown.stop
          @click.stop
        >
          <el-option v-for="item in shownOptions(row.node)" :key="item.value" :label="item.label" :value="item.value" />
          <el-option v-if="createOffer(row.node)" :key="createOffer(row.node)?.value" :label="createOffer(row.node)?.label" :value="createOffer(row.node)?.value || ''" />
          <template #empty>
            <p class="pick-empty">{{ pickQuery.trim() ? `没有匹配「${pickQuery.trim()}」` : '词典里还没有可选项，输入名称后可以新增' }}</p>
          </template>
        </el-select>
        <button
          v-else-if="!viewing && canPick(row.node)"
          type="button"
          class="line"
          :class="{ 'is-unbound': isUnbound(row.node) }"
          :title="label(row.node)"
          :data-line="row.node.id"
          @focus="markEditing(row.node.id, $event)"
          @click.stop="openPick(row.node)"
          @keydown="onLineKey(row.node, $event)"
        >{{ label(row.node) }}<em v-if="ruleText(row.node)" class="rule-mark" :class="{ 'is-inherit': ruleText(row.node) === '继承' }">{{ ruleText(row.node) }}</em></button>
        <input v-else class="line" :class="{ 'is-unbound': isUnbound(row.node) }" :title="label(row.node)" :data-line="row.node.id" :value="label(row.node)" readonly @focus="markEditing(row.node.id, $event)" />
        <em v-if="viewing && ruleText(row.node)" class="rule-mark" :class="{ 'is-inherit': ruleText(row.node) === '继承' }">{{ ruleText(row.node) }}</em>
        <span v-if="row.node.nodeType === 'ATTRIBUTE' && attributeHint(row.node).bound" class="bind-note" :title="`绑定：${label(row.node)} · 属性词典`">属性来源：属性词典</span>
        <button v-else-if="row.node.nodeType === 'ATTRIBUTE' && !viewing" type="button" class="bind-btn" @mousedown.stop @click.stop="emit('bind', row.node.id)">选择属性</button>
      </span>
      <el-button-group v-if="!viewing" class="ops" @mousedown.stop @click.stop>
        <el-button v-if="row.node.nodeType === 'ATTRIBUTE'" size="small" @click.stop="emit('add', { id: row.node.id, kind: 'child-attribute' })">添加子属性</el-button>
        <el-button v-if="row.node.nodeType === 'ATTRIBUTE'" size="small" @click.stop="emit('add', { id: row.node.id, kind: 'child-value' })">添加属性值</el-button>
        <el-button v-if="row.node.nodeType === 'VALUE'" size="small" @click.stop="emit('add', { id: row.node.id, kind: 'child-attribute' })">添加条件属性</el-button>
        <el-button size="small" @click.stop="emit('add', { id: row.node.id, kind: 'sibling' })">{{ row.node.nodeType === 'VALUE' ? '添加同级属性值' : '添加同级属性' }}</el-button>
        <el-button size="small" type="danger" @click.stop="emit('remove', row.node.id)">删除</el-button>
      </el-button-group>
      <div v-if="materialVersionId && row.node.nodeType === 'VALUE'" class="outline-material-slot"><NodeMaterialSummary :model-id="row.node.templateId" :version-id="materialVersionId" :node-id="row.node.id" /></div>
    </div>
    <div v-if="rows.length === 0" class="outline-empty">
      <p>还没有商品结构</p>
      <div v-if="!viewing" class="outline-start">
        <span>快速开始</span>
        <el-button size="small" @click="emit('createAttribute')">添加属性</el-button>
        <el-button size="small" @click="emit('copyModel')">复制已有模型</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { ProductSpecNode } from '../domain/types'
import NodeMaterialSummary from './model-editor/NodeMaterialSummary.vue'

const props = defineProps<{
  nodes: ProductSpecNode[]
  materialVersionId?: string
  rootTitle: string
  rootId: string
  activeId: string
  viewing: boolean
  foldedIds?: string[]
  mubu?: boolean
  focusTick: number
  focusId: string
  label: (node: ProductSpecNode) => string
  ruleMark?: (node: ProductSpecNode) => '' | '自有' | '继承'
  attributeHint: (node: ProductSpecNode) => { bound: boolean; source: string; values: string }
  optionsFor: (node: ProductSpecNode) => { value: string; label: string }[]
}>()

const emit = defineEmits<{
  select: [id: string]
  rename: [payload: { id: string; name: string }]
  add: [payload: { id: string; kind: 'sibling' | 'child-value' | 'child-attribute' }]
  remove: [id: string]
  promote: [id: string]
  shift: [payload: { id: string; direction: -1 | 1 }]
  undo: []
  ask: []
  createAttribute: []
  copyModel: []
  toggle: [id: string]
  move: [payload: { id: string; targetId: string; place: 'before' | 'after' | 'inside' }]
  menu: [payload: { id: string; x: number; y: number }]
  bind: [id: string]
  choose: [payload: { id: string; token: string }]
  create: [payload: { id: string; name: string }]
}>()

const rootEl = ref<HTMLElement | null>(null)
const drop = ref({ id: '', place: '' as '' | 'before' | 'after' | 'inside' })
const draggingId = ref('')
const editingId = ref('')
const editingText = ref('')
const pickingId = ref('')
const pickQuery = ref('')
let pickOpened = false
let lastCommit = ''
let skipCommit = false

const rows = computed(() => {
  const list: { node: ProductSpecNode; depth: number; hasChildren: boolean }[] = []
  const walk = (parentId: string | null, depth: number) => {
    props.nodes
      .filter((item) => item.parentId === parentId)
      .sort((a, b) => a.sort - b.sort)
      .forEach((node) => {
        const hasChildren = props.nodes.some((item) => item.parentId === node.id)
        list.push({ node, depth, hasChildren })
        if (hasChildren && isOpen(node)) walk(node.id, depth + 1)
      })
  }
  walk(null, 0)
  return list
})

watch(
  () => props.focusTick,
  () => {
    if (!props.focusId) return
    const node = props.nodes.find((item) => item.id === props.focusId)
    if (node && !props.viewing && canPick(node)) {
      pickingId.value = node.id
      emit('select', node.id)
      return
    }
    nextTick(() => {
      const input = rootEl.value?.querySelector<HTMLInputElement>(`[data-line="${props.focusId}"]`)
      input?.focus()
      input?.select()
    })
  },
)
watch(() => props.activeId, () => nextTick(scrollActive))
onMounted(() => nextTick(scrollActive))

function isOpen(node: ProductSpecNode) {
  if (props.viewing) return !(props.foldedIds || []).includes(node.id)
  return node.expanded !== false
}
function ruleText(node: ProductSpecNode) {
  return props.ruleMark?.(node) || ''
}
function isUnbound(node: ProductSpecNode) {
  return node.nodeType === 'ATTRIBUTE' && !props.attributeHint(node).bound
}
function canPick(node: ProductSpecNode) {
  return node.nodeType === 'ATTRIBUTE' || node.nodeType === 'VALUE'
}
function boundToken(node: ProductSpecNode) {
  return node.nodeType === 'ATTRIBUTE' ? node.attributeId : node.valueId
}
function rememberQuery(query: string) {
  pickQuery.value = query
}
function shownOptions(node: ProductSpecNode) {
  const query = pickQuery.value.trim().toLowerCase()
  const options = props.optionsFor(node)
  if (!query) return options
  return options.filter((item) => item.label.toLowerCase().includes(query) || item.value.toLowerCase().includes(query))
}
function createOffer(node: ProductSpecNode) {
  const query = pickQuery.value.trim()
  if (!query) return null
  const options = props.optionsFor(node)
  if (options.some((item) => item.label === query || item.value === query)) return null
  return { value: `__create__:${query}`, label: node.nodeType === 'ATTRIBUTE' ? `新增属性：${query}` : `新增属性值：${query}` }
}
function openPick(node: ProductSpecNode) {
  pickQuery.value = ''
  pickingId.value = node.id
  pickOpened = false
  emit('select', node.id)
  nextTick(() => rootEl.value?.querySelector<HTMLElement>('.line-pick')?.querySelector('input')?.click())
}
function onPick(node: ProductSpecNode, token: string | number | boolean) {
  const next = String(token)
  const name = pickQuery.value.trim()
  pickingId.value = ''
  pickOpened = false
  pickQuery.value = ''
  if (next.startsWith('__create__:')) {
    emit('create', { id: node.id, name: next.slice('__create__:'.length) || name })
    return
  }
  if (next && next !== boundToken(node)) emit('choose', { id: node.id, token: next })
}
function onPickVisible(open: boolean) {
  if (open) {
    pickOpened = true
    return
  }
  if (!pickOpened) return
  pickOpened = false
  pickingId.value = ''
}
function closePick() {
  pickingId.value = ''
}
function openMenu(id: string, event: MouseEvent) {
  if (props.viewing) return
  emit('menu', { id, x: event.clientX, y: event.clientY })
}
function scrollActive() {
  const id = props.activeId
  if (!id || !rootEl.value) return
  rootEl.value.querySelector(`[data-line="${id}"]`)?.scrollIntoView({ block: 'nearest' })
}
function markEditing(id: string, event: FocusEvent) {
  editingId.value = id
  editingText.value = (event.target as HTMLInputElement).value.trim()
  emit('select', id)
}
function clearEditing(event: FocusEvent) {
  const next = event.relatedTarget as Node | null
  if (next && rootEl.value?.contains(next)) return
  editingId.value = ''
  editingText.value = ''
}

function commitLine(node: ProductSpecNode, event: Event) {
  if (skipCommit) {
    skipCommit = false
    return
  }
  const input = event.target as HTMLInputElement
  const next = input.value.trim()
  const key = `${node.id}:${next}`
  if (lastCommit === key) return
  lastCommit = key
  if (next && next !== props.label(node)) emit('rename', { id: node.id, name: next })
  nextTick(() => {
    input.value = props.label(node)
  })
}
function onRootKey(event: KeyboardEvent) {
  if (props.viewing || event.isComposing) return
  if (event.key === 'Enter') {
    event.preventDefault()
    return
  }
  if (event.key !== 'Tab' || event.shiftKey) return
  event.preventDefault()
  emit('add', { id: props.rootId, kind: 'child-attribute' })
}
function onLineKey(node: ProductSpecNode, event: KeyboardEvent) {
  if (props.viewing || event.isComposing) return
  const input = event.target as HTMLInputElement
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') return
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    input.blur()
    return
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    skipCommit = true
    input.value = props.label(node)
    input.blur()
    return
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    commitLine(node, event)
    emit('add', { id: node.id, kind: 'sibling' })
    return
  }
  if (event.key === 'Tab' && event.shiftKey) {
    event.preventDefault()
    commitLine(node, event)
    emit('promote', node.id)
    return
  }
  if (event.key === 'Tab') {
    event.preventDefault()
    commitLine(node, event)
    emit('add', { id: node.id, kind: 'child-attribute' })
    return
  }
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault()
    emit('shift', { id: node.id, direction: event.key === 'ArrowUp' ? -1 : 1 })
    return
  }
  const canBackspace = input.tagName === 'INPUT' && !input.value
  if (event.key === 'Delete' || (event.key === 'Backspace' && canBackspace)) {
    event.preventDefault()
    emit('remove', node.id)
  }
}
function onDragStart(id: string, event: DragEvent) {
  draggingId.value = id
  event.dataTransfer?.setData('text/plain', id)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}
function onDragOver(id: string, event: DragEvent, root: boolean) {
  if (!draggingId.value || draggingId.value === id) return
  if (root) {
    drop.value = { id, place: 'inside' }
    return
  }
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const ratio = (event.clientY - rect.top) / rect.height
  drop.value = { id, place: ratio < 0.28 ? 'before' : ratio > 0.72 ? 'after' : 'inside' }
}
function onDrop(targetId: string, root: boolean) {
  const id = draggingId.value
  const place = root ? 'inside' : drop.value.place
  draggingId.value = ''
  drop.value = { id: '', place: '' }
  if (!id || !place || id === targetId) return
  emit('move', { id, targetId, place })
}
</script>

<style scoped>
.outline { flex: 1; min-width: 0; min-height: 0; height: 100%; overflow: auto; background: #fff; border: 1px solid #e6edf5; border-radius: 8px; padding: 12px 20px 40px; }
.outline.is-mubu { padding: 16px 40px 56px; background: #fcfdff; }
.outline.is-mubu .ops, .outline.is-mubu .grip { display: none; }
.outline.is-mubu .line { font-size: 15px; }
.outline.is-mubu .root-line { font-size: 18px; font-weight: 700; }
.outline.is-mubu .outline-row.is-head .line,
.outline.is-mubu .outline-row.is-attribute .line { font-weight: 600; color: var(--spec-attr-text, #303133); }
.outline.is-mubu .outline-row.is-value .line { font-size: 14px; color: var(--spec-value-text, #253044); font-weight: 400; }
.outline.is-mubu .outline-row, .outline.is-mubu .outline-root { min-height: 32px; }
.editing-now { margin: 0 0 8px; color: #8aa0b8; font-size: 12px; }
.outline-empty { margin: 4px 0 12px 26px; }
.outline-empty p { margin: 0; color: #909399; font-size: 13px; }
.outline-start { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 8px; color: #909399; font-size: 12px; }
.outline-tools { margin: 0 0 8px; }
.outline-root, .outline-row { display: flex; align-items: center; gap: 8px; min-height: 32px; border-radius: 6px; }
.outline-row { flex-wrap:wrap; }
.outline-material-slot { flex-basis:100%; min-width:0; padding:0 0 4px 28px; box-sizing:border-box; }
.outline-material-slot:not(:has(.node-material-summary)) { display:none; }
.outline-root { margin-bottom: 4px; }
.outline-row.is-on, .outline-root.is-on { background: #e8f1ff; box-shadow: inset 3px 0 0 #2f6fed; }
.outline.is-mubu .outline-row.is-editing, .outline.is-mubu .outline-root.is-editing { background: #fff; box-shadow: inset 0 0 0 1.5px #2f6fed; }
.line-wrap { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 8px; }
.bind-note { flex-basis: 100%; display: flex; flex-wrap: wrap; gap: 2px 10px; color: #909399; font-size: 12px; line-height: 1.4; }
.bind-btn { flex: none; border: 0; background: none; padding: 0; color: #409eff; font-size: 12px; line-height: 1.4; cursor: pointer; }
.pick-empty { margin: 0; padding: 8px 12px; color: #909399; font-size: 13px; }
.rule-mark { margin-left: 6px; color: #8a5a00; font-style: normal; font-size: 11px; }
.rule-mark.is-inherit { color: #607089; }
.line.is-unbound { color: #909399; font-weight: 500; }
.outline.is-mubu .line-wrap { flex-direction: column; align-items: flex-start; gap: 0; }
.outline.is-mubu .outline-row, .outline.is-mubu .outline-root { align-items: flex-start; }
.outline-row.drop-before { box-shadow: inset 0 2px 0 #7ea6e6; }
.outline-row.drop-after { box-shadow: inset 0 -2px 0 #7ea6e6; }
.outline-row.drop-in, .outline-root.drop-in { background: #e8f0ff; }
.root-line, .line { flex: 1; min-width: 0; border: 0; background: transparent; outline: none; font: inherit; color: #1c2b3a; padding: 8px 0; }
.root-line { font-size: 18px; font-weight: 650; }
button.line { width: 100%; text-align: left; cursor: pointer; }
.line { font-size: 14px; color: #303133; font-weight: 500; }
.outline-row.is-head .line { color: var(--spec-attr-text, #303133); font-weight: 600; }
.outline-row.is-attribute .line,
.outline.is-mubu .outline-row.is-attribute .line {
  flex: 0 1 auto;
  width: max-content;
  max-width: 100%;
  margin: 3px 0;
  padding: 2px 8px;
  border: 1px solid var(--spec-attr-border, #9aa6d4);
  border-radius: 6px;
  background: var(--spec-attr-bg, color-mix(in srgb, #5d6eb8 16%, #fff));
  color: var(--spec-attr-text, #253044);
  font-weight: 600;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.outline-row.is-attribute:hover:not(.is-on) .line { background: var(--spec-attr-bg-hover, #eef1fb); border-color: var(--spec-attr-border-hover, #7f8bc4); }
.outline-row.is-value .line,
.outline.is-mubu .outline-row.is-value .line {
  flex: 0 1 auto;
  width: max-content;
  max-width: 100%;
  margin: 3px 0;
  padding: 2px 10px;
  border: 1px solid var(--spec-value-border, #c3ccd6);
  border-radius: 999px;
  background: var(--spec-value-bg, #fff);
  color: var(--spec-value-text, #253044);
  font-size: 13px;
  font-weight: 400;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.outline.is-mubu .outline-row.is-value .line { font-size: 14px; }
.outline-row.is-value:hover:not(.is-on) .line { background: var(--spec-value-bg-hover, #f7f9fc); border-color: var(--spec-value-border-hover, #8ea0b4); }
.outline-row.is-attribute.is-on .line { background: var(--spec-selected-attr-bg, #e4e9fb); border-color: var(--spec-node-ring, #3d6fe0); box-shadow: inset 0 0 0 1px var(--spec-node-ring, #3d6fe0); }
.outline-row.is-value.is-on .line { background: var(--spec-selected-value-bg, #f3f6ff); border-color: var(--spec-node-ring, #3d6fe0); color: var(--spec-value-text, #253044); box-shadow: inset 0 0 0 1px var(--spec-node-ring, #3d6fe0); }
.outline-row.is-attribute .line.is-unbound { color: var(--text-muted, #909399); font-weight: 500; }
.outline-row.is-on .line, .outline-root.is-on .root-line { color: var(--text-primary, #303133); }
.outline.is-mubu .root-line { width: 100%; padding: 2px 0; }
.outline.is-mubu .bind-btn { padding-left: 0; }
.twist { width: 18px; height: 18px; border: 0; background: transparent; color: #8aa0b8; cursor: pointer; padding: 0; }
.grip { color: #d5dde8; cursor: grab; user-select: none; letter-spacing: -2px; font-size: 12px; }
.ops { display: none; flex: none; margin-right: 4px; }
.ops { flex-wrap:wrap; max-width:100%; }
.outline-row:hover .ops,
.outline-row.is-on .ops,
.outline-row:focus-within .ops { display: inline-flex; }
.outline.is-mubu .ops,
.outline.is-mubu .outline-row:hover .ops,
.outline.is-mubu .outline-row.is-on .ops,
.outline.is-mubu .outline-row:focus-within .ops { display: none; }
</style>
