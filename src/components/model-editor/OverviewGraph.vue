<template>
  <section class="stage" aria-label="关系图">
    <div class="graph-tools">
      <CategoryTreeSelect class="root-pick" :model-value="focusId" :categories="store.data.categories" placeholder="选择起点" @update:model-value="onCategory" />
      <el-button-group>
        <el-button data-action="layout" title="展开到模型，收回模型内部" @click="autoLayout">自动布局</el-button>
        <el-button data-action="fit" @click="fitAll">适应全部</el-button>
      </el-button-group>
      <el-button data-zoom @click="zoomReset">{{ zoomLabel }}</el-button>
      <el-button data-expand-toggle @click="toggleAll">{{ anyCollapsed ? '全部展开' : '全部收起' }}</el-button>
    </div>
    <p class="graph-note">{{ contextText }}</p>
    <ul class="legend">
      <li class="is-category">分类</li>
      <li class="is-type">类型</li>
      <li class="is-model">模型</li>
      <li class="is-attribute">属性</li>
      <li class="is-value">取值</li>
    </ul>
    <div ref="canvasRef" class="graph-canvas" @wheel.stop>
      <VueFlow
        id="overview-graph"
        :nodes="flowNodes"
        :edges="flowEdges"
        :nodes-connectable="false"
        :nodes-draggable="false"
        :elements-selectable="true"
        :selection-on-drag="false"
        :pan-on-drag="true"
        :pan-on-scroll="false"
        :zoom-on-scroll="true"
        :zoom-on-double-click="false"
        :prevent-scrolling="true"
        :elevate-nodes-on-select="false"
        :min-zoom="OVERVIEW_MIN_ZOOM"
        :max-zoom="OVERVIEW_MAX_ZOOM"
        :default-viewport="{ x: 28, y: 24, zoom: 1 }"
        :default-edge-options="{ type: 'tree' }"
        @nodes-initialized="onNodesReady"
        @node-click="onNodeClick"
        @node-double-click="onNodeDoubleClick"
        @move="onMove"
        @pane-click="selectedId = ''"
      >
        <Background variant="dots" :gap="28" :size="1" pattern-color="#e7eef6" />
        <template #edge-tree="{ source, data }">
          <path :d="treeBusPath(source, data?.childIds || [])" class="tree-bus" :class="{ 'is-hot': data?.hot !== false }" />
        </template>
        <template #node-category="{ data }">
          <div class="kind-category" :class="{ 'is-on': data.selected, 'is-path': data.onPath }" :title="tip(data)" :data-kind="data.kind" :data-entity="data.entityId" :data-label="data.label">
            <small>分类</small>
            <strong>{{ data.label }}</strong>
            <button v-if="data.childCount" type="button" class="fold" @click.stop="toggle(data.id)" @dblclick.stop>{{ data.expanded ? '−' : data.childCount }}</button>
            <Handle type="target" :position="Position.Left" />
            <Handle type="source" :position="Position.Right" />
          </div>
        </template>
        <template #node-productType="{ data }">
          <div class="kind-type" :class="{ 'is-on': data.selected, 'is-path': data.onPath }" :title="tip(data)" :data-kind="data.kind" :data-entity="data.entityId" :data-label="data.label">
            <small>类型</small>
            <strong>{{ data.label }}</strong>
            <button v-if="data.childCount" type="button" class="fold" @click.stop="toggle(data.id)" @dblclick.stop>{{ data.expanded ? '−' : data.childCount }}</button>
            <Handle type="target" :position="Position.Left" />
            <Handle type="source" :position="Position.Right" />
          </div>
        </template>
        <template #node-model="{ data }">
          <div class="model-root" :class="{ 'is-on': data.selected, 'is-path': data.onPath, 'is-draft': data.draft }" :title="tip(data)" :data-kind="data.kind" :data-entity="data.entityId" :data-template="data.templateId" :data-label="data.label">
            <small>模型</small>
            <strong>{{ data.label }}</strong>
            <em>{{ data.meta }}</em>
            <button v-if="data.canDraft" type="button" class="enter" @click.stop="toggleDraft(data.templateId)" @dblclick.stop>{{ data.draft ? '看已发布' : '看草稿' }}</button>
            <button type="button" class="enter" @click.stop="enter(data)" @dblclick.stop>进入设计</button>
            <button v-if="data.childCount" type="button" class="fold" @click.stop="toggle(data.id)" @dblclick.stop>{{ data.expanded ? '−' : data.childCount }}</button>
            <Handle type="target" :position="Position.Left" />
            <Handle type="source" :position="Position.Right" />
          </div>
        </template>
        <template #node-attribute="{ data }">
          <div class="model-attr" :class="{ 'is-on': data.selected, 'is-path': data.onPath, 'is-head': data.head, 'is-nested': !data.head, 'is-unbound': !data.bound }" :title="tip(data)" :data-kind="data.kind" :data-node-id="data.nodeId" :data-label="data.label">
            <small>属性</small>
            <strong>{{ data.label }}</strong>
            <button v-if="data.childCount" type="button" class="fold" @click.stop="toggle(data.id)" @dblclick.stop>{{ data.expanded ? '−' : data.childCount }}</button>
            <Handle type="target" :position="Position.Left" />
            <Handle type="source" :position="Position.Right" />
          </div>
        </template>
        <template #node-value="{ data }">
          <div class="model-value" :class="{ 'is-on': data.selected, 'is-path': data.onPath }" :title="tip(data)" :data-kind="data.kind" :data-node-id="data.nodeId" :data-label="data.label">
            <small>取值</small>
            <span>{{ data.label }}</span>
            <button v-if="data.childCount" type="button" class="fold" @click.stop="toggle(data.id)" @dblclick.stop>{{ data.expanded ? '−' : data.childCount }}</button>
            <Handle type="target" :position="Position.Left" />
            <Handle type="source" :position="Position.Right" />
          </div>
        </template>
      </VueFlow>
      <p v-if="!visibleNodes.length" class="graph-empty">这个起点下还没有分类。</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Background } from '@vue-flow/background'
import { Handle, Position, useVueFlow, VueFlow } from '@vue-flow/core'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import CategoryTreeSelect from '../CategoryTreeSelect.vue'
import { categoryChain } from '../../domain/categoryTree'
import { categoryPath } from '../../domain/logic'
import {
  OVERVIEW_MAX_ZOOM,
  OVERVIEW_MIN_ZOOM,
  buildOverviewForest,
  categoryVisualId,
  defaultExpandedIds,
  defaultOverviewCategoryId,
  layoutOverviewGraph,
  overviewCanPreviewDraft,
  overviewFitViewport,
  visibleOverviewNodes,
  type OverviewGraphNode,
  type OverviewKind,
} from '../../domain/overviewGraph'
import { useCatalogStore } from '../../stores/catalog'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

interface FlowData {
  id: string
  kind: OverviewKind
  label: string
  meta: string
  selected: boolean
  onPath: boolean
  expanded: boolean
  childCount: number
  draft: boolean
  head: boolean
  bound: boolean
  entityId: string
  categoryId: string
  typeId: string
  templateId: string
  nodeId: string
  canDraft: boolean
}

const props = defineProps<{
  active: boolean
  rootId: string
  pinTick: number
  pinTemplateId: string
  pinCategoryId: string
}>()

const emit = defineEmits<{
  open: [payload: { templateId: string; categoryId: string; typeId: string }]
  root: [rootId: string]
}>()

const store = useCatalogStore()
const canvasRef = ref<HTMLElement>()
const focusId = ref(props.rootId || defaultOverviewCategoryId(store.data))
const expandedIds = ref<string[]>([])
const collapsedSpecIds = ref<string[]>([])
const draftTemplates = ref<string[]>([])
const selectedId = ref('')
const zoomValue = ref(1)
const framed = ref(false)
const flowRevision = ref(0)
const flowNodes = ref<{ id: string; type: string; position: { x: number; y: number }; data: FlowData; draggable: boolean; connectable: boolean; style: { width: string; height: string } }[]>([])
const flowEdges = ref<{ id: string; source: string; target: string; type: string; data: { childIds: string[]; hot: boolean } }[]>([])
const { findNode, getViewport, onNodesChange, setViewport } = useVueFlow({ id: 'overview-graph' })

onNodesChange(() => {
  flowRevision.value += 1
})

const catalog = computed(() => buildOverviewForest(store.data, new Set(draftTemplates.value)))
const anyCollapsed = computed(() => catalog.value.some((item) => (item.kind === 'category' || item.kind === 'type') && item.expandable && !expandedIds.value.includes(item.id)))
const visibleNodes = computed(() => visibleOverviewNodes(catalog.value, new Set(expandedIds.value), new Set(collapsedSpecIds.value)))
const frames = computed(() => layoutOverviewGraph(visibleNodes.value))
const zoomLabel = computed(() => `${Math.round(zoomValue.value * 100)}%`)
const contextText = computed(() => {
  const path = focusId.value ? categoryPath(store.data, focusId.value) : '未选择分类'
  const selected = catalog.value.find((item) => item.id === selectedId.value)
  const tail = selected && selected.id !== categoryVisualId(focusId.value) ? ` / ${selected.label}` : ''
  return `当前起点：${path}${tail}。关系图只读，点模型进入现有单模型设计。`
})

function tip(data: FlowData) {
  return data.meta ? `${data.label} · ${data.meta}` : data.label
}

function nodeOpen(node: OverviewGraphNode) {
  if (!node.expandable) return false
  if (node.kind === 'attribute' || node.kind === 'value') return !collapsedSpecIds.value.includes(node.id)
  return expandedIds.value.includes(node.id)
}

function flowType(kind: OverviewKind) {
  return kind === 'type' ? 'productType' : kind
}

function paint() {
  const visible = visibleNodes.value
  const placed = frames.value
  const byId = new Map(catalog.value.map((item) => [item.id, item]))
  const path = new Set<string>()
  let cursor = selectedId.value ? byId.get(selectedId.value) : undefined
  const guard = new Set<string>()
  while (cursor && !guard.has(cursor.id)) {
    guard.add(cursor.id)
    path.add(cursor.id)
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined
  }
  flowNodes.value = visible.flatMap((node) => {
    const frame = placed.get(node.id)
    if (!frame) return []
    return [{
      id: node.id,
      type: flowType(node.kind),
      position: { x: frame.x, y: frame.y },
      draggable: false,
      connectable: false,
      style: { width: `${frame.width}px`, height: `${frame.height}px` },
      data: {
        id: node.id,
        kind: node.kind,
        label: node.label,
        meta: node.meta,
        selected: node.id === selectedId.value,
        onPath: path.has(node.id),
        expanded: nodeOpen(node),
        childCount: node.childCount,
        draft: node.draft,
        head: node.head,
        bound: node.bound,
        entityId: node.entityId,
        categoryId: node.categoryId,
        typeId: node.typeId,
        templateId: node.templateId,
        nodeId: node.nodeId,
        canDraft: node.kind === 'model' && overviewCanPreviewDraft(store.data, node.templateId),
      },
    }]
  })
  const buses = new Map<string, string[]>()
  visible.forEach((node) => {
    if (!node.parentId) return
    const list = buses.get(node.parentId) || []
    list.push(node.id)
    buses.set(node.parentId, list)
  })
  flowEdges.value = [...buses.entries()].map(([source, childIds]) => ({
    id: `bus-${source}`,
    source,
    target: childIds[0],
    type: 'tree',
    data: { childIds, hot: !selectedId.value || path.has(source) },
  }))
}

watch([visibleNodes, selectedId], paint, { immediate: true })

function descendantIds(id: string) {
  const ids = new Set<string>()
  const walk = (parentId: string) => {
    catalog.value.filter((item) => item.parentId === parentId).forEach((child) => {
      ids.add(child.id)
      walk(child.id)
    })
  }
  walk(id)
  return ids
}
function branchIds(id: string) {
  const ids = [id]
  const walk = (parentId: string) => {
    catalog.value.filter((item) => item.parentId === parentId && (item.kind === 'category' || item.kind === 'type')).forEach((child) => {
      ids.push(child.id)
      walk(child.id)
    })
  }
  walk(id)
  return ids
}
function deepExpand(id: string) {
  const node = catalog.value.find((item) => item.id === id)
  if (!node) return
  if (node.kind === 'model' || node.kind === 'attribute' || node.kind === 'value') {
    expandedIds.value = [...new Set([...expandedIds.value, id])]
    return
  }
  expandedIds.value = [...new Set([...expandedIds.value, ...branchIds(id)])]
}
function deepCollapse(id: string) {
  const drop = descendantIds(id)
  drop.add(id)
  expandedIds.value = expandedIds.value.filter((item) => !drop.has(item))
}
function toggle(id: string) {
  const node = catalog.value.find((item) => item.id === id)
  if (!node?.expandable) return
  selectedId.value = id
  if (node.kind === 'attribute' || node.kind === 'value') {
    collapsedSpecIds.value = collapsedSpecIds.value.includes(id)
      ? collapsedSpecIds.value.filter((item) => item !== id)
      : [...collapsedSpecIds.value, id]
    nextTick(() => reveal(id))
    return
  }
  if (node.kind === 'model') {
    expandedIds.value = expandedIds.value.includes(id) ? expandedIds.value.filter((item) => item !== id) : [...expandedIds.value, id]
    nextTick(() => reveal(id))
    return
  }
  if (expandedIds.value.includes(id)) deepCollapse(id)
  else deepExpand(id)
  nextTick(() => reveal(id))
}
function toggleAll() {
  if (anyCollapsed.value) {
    expandedIds.value = defaultExpandedIds(catalog.value)
    return
  }
  expandedIds.value = []
  collapsedSpecIds.value = []
}
function toggleDraft(templateId: string) {
  if (!templateId) return
  draftTemplates.value = draftTemplates.value.includes(templateId)
    ? draftTemplates.value.filter((item) => item !== templateId)
    : [...draftTemplates.value, templateId]
}

function enter(data: { id: string; templateId: string; categoryId: string; typeId: string }) {
  if (!data.templateId) return
  selectedId.value = data.id
  emit('open', { templateId: data.templateId, categoryId: data.categoryId, typeId: data.typeId })
}

function onNodeClick(payload: { event?: { target?: EventTarget | null }; node: { id: string } }) {
  const target = payload.event?.target as HTMLElement | null
  if (target?.closest?.('.fold, .enter')) return
  const node = catalog.value.find((item) => item.id === payload.node.id)
  if (!node) return
  selectedId.value = node.id
  if ((node.kind === 'category' || node.kind === 'type') && !expandedIds.value.includes(node.id)) deepExpand(node.id)
}

function onNodeDoubleClick(payload: { event?: { target?: EventTarget | null }; node: { id: string } }) {
  const target = payload.event?.target as HTMLElement | null
  if (target?.closest?.('.fold, .enter')) return
  const node = catalog.value.find((item) => item.id === payload.node.id)
  if (!node || node.kind === 'model') return
  if (!expandedIds.value.includes(node.id)) deepExpand(node.id)
}

function applyRoot(id: string, fit: boolean) {
  if (!id) return
  focusId.value = id
  const visualId = categoryVisualId(id)
  selectedId.value = visualId
  const ancestors = categoryChain(store.data.categories, id).map((item) => categoryVisualId(item.id))
  expandedIds.value = [...new Set([...expandedIds.value, ...ancestors, ...branchIds(visualId)])]
  if (props.rootId !== id) emit('root', id)
  if (fit) nextTick(() => reveal(visualId))
}

function onCategory(value: string | string[]) {
  if (typeof value === 'string' && value) setFocus(value)
}

function setFocus(id: string) {
  applyRoot(id, true)
}

function locate(templateId: string, categoryId: string) {
  if (!templateId) return
  const nodes = catalog.value
  const model = nodes.find((item) => item.kind === 'model' && item.templateId === templateId && (!categoryId || item.categoryId === categoryId))
    || nodes.find((item) => item.kind === 'model' && item.templateId === templateId)
  if (!model) return
  const byId = new Map(nodes.map((item) => [item.id, item]))
  const next = new Set(expandedIds.value)
  let parentId = model.parentId
  const guard = new Set<string>()
  while (parentId && !guard.has(parentId)) {
    guard.add(parentId)
    next.add(parentId)
    parentId = byId.get(parentId)?.parentId || null
  }
  expandedIds.value = [...next]
  selectedId.value = model.id
  nextTick(() => reveal(model.id))
}

function measuredBox(id: string) {
  const live = findNode(id)
  const stored = flowNodes.value.find((item) => item.id === id)
  const frame = frames.value.get(id)
  const x = live?.position.x ?? stored?.position.x ?? frame?.x
  const y = live?.position.y ?? stored?.position.y ?? frame?.y
  if (x === undefined || y === undefined) return null
  const width = live?.dimensions?.width || frame?.width || 120
  const height = live?.dimensions?.height || frame?.height || 42
  return { x, y, width, height }
}

function treeBusPath(sourceId: string, childIds: string[]) {
  flowRevision.value
  const parent = measuredBox(sourceId)
  const children = childIds.map((id) => measuredBox(id)).filter((item): item is { x: number; y: number; width: number; height: number } => Boolean(item))
  if (!parent || !children.length) return ''
  const sx = Math.round(parent.x + parent.width)
  const sy = Math.round(parent.y + parent.height / 2)
  const targets = children
    .map((item) => ({ x: Math.round(item.x), y: Math.round(item.y + item.height / 2) }))
    .filter((item) => item.x > sx + 4)
    .sort((a, b) => a.y - b.y)
  if (!targets.length) return ''
  if (targets.length === 1 && Math.abs(targets[0].y - sy) < 3) return `M ${sx} ${sy} H ${targets[0].x}`
  const spine = Math.max(sx + 12, Math.min(...targets.map((item) => item.x)) - 14)
  const top = Math.min(sy, targets[0].y)
  const bottom = Math.max(sy, targets[targets.length - 1].y)
  const parts = [`M ${sx} ${sy} H ${spine}`, `M ${spine} ${top} V ${bottom}`]
  targets.forEach((item) => parts.push(`M ${spine} ${item.y} H ${item.x}`))
  return parts.join(' ')
}

function canvasSize() {
  const el = canvasRef.value
  if (!el) return null
  return { width: el.clientWidth, height: el.clientHeight }
}

function contentBounds() {
  const boxes = [...frames.value.values()]
  if (!boxes.length) return null
  const minX = Math.min(...boxes.map((item) => item.x))
  const minY = Math.min(...boxes.map((item) => item.y))
  const maxX = Math.max(...boxes.map((item) => item.x + item.width))
  const maxY = Math.max(...boxes.map((item) => item.y + item.height))
  return { minX, minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) }
}

function fitAll() {
  const bounds = contentBounds()
  const size = canvasSize()
  if (!bounds || !size || size.width < 80 || size.height < 80) return
  const next = overviewFitViewport(bounds, size)
  zoomValue.value = next.zoom
  setViewport(next, { duration: 180 }).catch(() => undefined)
}

function autoLayout() {
  collapsedSpecIds.value = []
  expandedIds.value = defaultExpandedIds(catalog.value)
  selectedId.value = categoryVisualId(focusId.value)
  nextTick(() => fitAll())
}

function zoomReset() {
  const size = canvasSize()
  const vp = getViewport()
  if (!size || !vp.zoom) return
  const zoom = 1
  const cx = size.width / 2
  const cy = size.height / 2
  zoomValue.value = zoom
  setViewport({
    x: cx - ((cx - vp.x) / vp.zoom) * zoom,
    y: cy - ((cy - vp.y) / vp.zoom) * zoom,
    zoom,
  }, { duration: 160 }).catch(() => undefined)
}

function reveal(id: string) {
  nextTick(() => {
    requestAnimationFrame(() => {
      const box = measuredBox(id)
      const size = canvasSize()
      if (!box || !size || size.width < 80 || size.height < 80) return
      const vp = getViewport()
      const left = box.x * vp.zoom + vp.x
      const top = box.y * vp.zoom + vp.y
      const right = (box.x + box.width) * vp.zoom + vp.x
      const bottom = (box.y + box.height) * vp.zoom + vp.y
      const margin = 64
      let dx = 0
      let dy = 0
      if (left < margin) dx = margin - left
      else if (right > size.width - margin) dx = size.width - margin - right
      if (top < margin) dy = margin - top
      else if (bottom > size.height - margin) dy = size.height - margin - bottom
      if (!dx && !dy) return
      setViewport({ x: vp.x + dx, y: vp.y + dy, zoom: vp.zoom }, { duration: 180 }).catch(() => undefined)
    })
  })
}

function onMove(event: { flowTransform?: { zoom?: number } }) {
  const zoom = event.flowTransform?.zoom
  if (typeof zoom === 'number') zoomValue.value = zoom
}

function onNodesReady() {
  if (!props.active || framed.value) return
  framed.value = true
  if (selectedId.value) reveal(selectedId.value)
  else fitAll()
}

watch(() => props.rootId, (id) => {
  if (!id || id === focusId.value) return
  focusId.value = id
  selectedId.value = categoryVisualId(id)
})

watch(() => props.pinTick, (tick) => {
  if (!tick || !props.pinTemplateId) return
  locate(props.pinTemplateId, props.pinCategoryId)
}, { immediate: true })

watch(() => props.active, (on) => {
  if (!on) return
  nextTick(() => requestAnimationFrame(() => {
    if (selectedId.value) reveal(selectedId.value)
    else fitAll()
  }))
})

onMounted(() => {
  if (focusId.value && props.rootId !== focusId.value) emit('root', focusId.value)
})
</script>

<style scoped>
.stage { min-height: 560px; flex: 1; display: flex; flex-direction: column; gap: 8px; height: 100%; }
.stage:fullscreen, .stage.is-full { position: fixed; inset: 0; z-index: 80; padding: 12px; background: var(--canvas-bg, #f4f7fb); }
.graph-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.root-pick { width: 240px; }
.zoom { color: var(--text-secondary, #66758b); font-size: 13px; font-weight: 650; }
.graph-note { margin: 0; color: var(--text-secondary, #66788a); font-size: 13px; }
.legend { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; }
.legend li { padding: 2px 8px; border-radius: 999px; color: var(--text-primary, #253044); font-size: 12px; line-height: 20px; }
.legend .is-category { background: color-mix(in srgb, var(--app-accent, #409eff) 14%, var(--surface-bg, #fff)); font-weight: 650; }
.legend .is-type { background: var(--surface-bg, #fff); border: 1px solid var(--border-default, #e4e8ef); font-weight: 600; }
.legend .is-model { background: var(--accent, #2c4068); color: #fff; font-weight: 650; }
.legend .is-attribute { border-radius: 6px; background: var(--spec-attr-bg, color-mix(in srgb, #5d6eb8 16%, #fff)); border: 1px solid var(--spec-attr-border, #9aa6d4); font-weight: 600; }
.legend .is-value { background: var(--spec-value-bg, #fff); border: 1px solid var(--spec-value-border, #c3ccd6); font-weight: 400; }
.graph-canvas { position: relative; flex: 1; width: 100%; min-height: 520px; height: calc(100vh - 280px); border: 1px solid var(--border-default, #e4e8ef); border-radius: 12px; overflow: hidden; background: var(--canvas-bg, #f4f7fb); }
.stage:fullscreen .graph-canvas, .stage.is-full .graph-canvas { height: calc(100vh - 140px); }
.graph-canvas :deep(.vue-flow) { width: 100%; height: 100%; background: var(--canvas-bg, #f4f7fb); }
.graph-canvas :deep(.vue-flow__node) { overflow: visible; padding: 0; border: 0; background: transparent; box-shadow: none; }
.graph-canvas :deep(.vue-flow__handle) { width: 8px; height: 8px; border: 0; background: transparent; opacity: 0; }
.graph-canvas :deep(.tree-bus) { fill: none; stroke: var(--connector-color, #8ea0b3); stroke-width: 1.15px; stroke-linejoin: round; stroke-linecap: round; pointer-events: none; }
.graph-canvas :deep(.tree-bus.is-hot) { stroke: var(--accent, #6d84c4); stroke-width: 1.7px; }
.graph-empty { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; margin: 0; color: var(--text-secondary, #66788a); }
.kind-category, .kind-type, .model-root, .model-attr, .model-value { position: relative; box-sizing: border-box; display: flex; align-items: center; gap: 6px; width: 100%; height: 100%; min-width: 0; user-select: none; }
.kind-category, .kind-type, .model-attr, .model-value { padding: 0 16px 0 10px; }
.kind-category { background: color-mix(in srgb, var(--app-accent, #409eff) 14%, var(--surface-bg, #fff)); border-radius: 10px; }
.kind-type { background: var(--surface-bg, #fff); border: 1px solid var(--border-default, #e4e8ef); border-radius: 8px; }
.kind-category strong, .kind-type strong { font-size: 16px; font-weight: 650; }
.kind-type strong { font-size: 15px; font-weight: 600; }
.model-root { padding: 0 18px 0 12px; background: var(--accent, #2c4068); color: #fff; border-radius: 12px; }
.model-root strong { color: inherit; font-size: 16px; font-weight: 650; }
.model-root small, .model-root em, .model-root .enter { color: rgba(255, 255, 255, 0.82); }
.model-root.is-draft { box-shadow: inset 3px 0 0 var(--status-warning, #ad7a12); }
.model-attr,
.model-attr.is-head,
.model-attr.is-nested { background: var(--spec-attr-bg, color-mix(in srgb, #5d6eb8 16%, #fff)); border: 1px solid var(--spec-attr-border, #9aa6d4); border-radius: 6px; cursor: pointer; }
.model-attr:hover:not(.is-on) { background: var(--spec-attr-bg-hover, color-mix(in srgb, #5d6eb8 24%, #fff)); border-color: var(--spec-attr-border-hover, #7f8bc4); }
.model-attr strong { color: var(--spec-attr-text, var(--node-text, var(--text-primary, #253044))); font-size: 15px; font-weight: 600; }
.model-attr.is-head strong,
.model-attr.is-nested strong { font-weight: 600; }
.model-attr.is-unbound strong { color: var(--text-muted, #909399); font-weight: 500; }
.model-value { background: var(--spec-value-bg, #fff); border: 1px solid var(--spec-value-border, #c3ccd6); border-radius: 999px; color: var(--spec-value-text, var(--text-primary, #253044)); font-size: 15px; font-weight: 400; cursor: pointer; }
.model-value:hover:not(.is-on) { background: var(--spec-value-bg-hover, #f7f9fc); border-color: var(--spec-value-border-hover, #8ea0b4); }
.kind-category strong, .kind-type strong, .model-root strong, .model-attr strong, .model-value span { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.model-root em { flex: none; max-width: 42%; overflow: hidden; font-style: normal; font-size: 12px; white-space: nowrap; text-overflow: ellipsis; }
small { flex: none; color: var(--text-muted, #8b98a8); font-size: 10px; font-weight: 650; }
.enter { flex: none; margin-left: auto; border: 0; background: transparent; padding: 0; font-size: 12px; text-decoration: underline; cursor: pointer; }
.kind-category.is-on, .kind-type.is-on { box-shadow: inset 0 0 0 2px var(--app-accent, #409eff); }
.model-attr.is-on { background: var(--spec-selected-attr-bg, color-mix(in srgb, #5d6eb8 30%, #fff)); border-color: var(--spec-node-ring, #3d6fe0); box-shadow: inset 0 0 0 1px var(--spec-node-ring, #3d6fe0); }
.model-value.is-on { background: var(--spec-selected-value-bg, #f3f6ff); border-color: var(--spec-node-ring, #3d6fe0); box-shadow: inset 0 0 0 1px var(--spec-node-ring, #3d6fe0); }
.model-root.is-on { box-shadow: 0 0 0 3px color-mix(in srgb, var(--app-accent, #8ea0b8) 55%, transparent); }
.model-root.is-draft.is-on { box-shadow: inset 3px 0 0 var(--status-warning, #ad7a12), 0 0 0 3px color-mix(in srgb, var(--app-accent, #8ea0b8) 55%, transparent); }
.fold { position: absolute; right: -7px; top: 50%; width: 16px; height: 16px; margin-top: -8px; border: 1px solid var(--border-default, #d5deea); border-radius: 50%; background: var(--surface-bg, #fff); color: var(--text-muted, #7d8da1); cursor: pointer; font-size: 10px; line-height: 14px; padding: 0; }
</style>
