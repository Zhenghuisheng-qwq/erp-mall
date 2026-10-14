<template>
  <div class="mind">
    <div class="legend">
      <span><i class="swatch cat" />分类</span>
      <span><i class="swatch type" />产品类型</span>
      <span><i class="swatch attr" />属性</span>
      <span><i class="swatch value" />属性值</span>
      <span><i class="swatch material" />物料</span>
    </div>
    <div class="canvas" :style="{ width: layout.width + 'px', height: layout.height + 'px' }">
      <svg class="wires" :width="layout.width" :height="layout.height">
        <path v-for="(wire, index) in layout.wires" :key="index" :d="wire.d" />
      </svg>
      <button
        v-for="wire in layout.wires.filter((item) => item.showLabel)"
        :key="wire.key"
        type="button"
        class="edge-label"
        :class="{ 'is-active': wire.attributeId === selectedId, 'is-center': wire.centerLabel }"
        :style="{ left: wire.labelX + 'px', top: wire.labelY + 'px' }"
        @click="wire.attributeId && emit('select', wire.attributeId)"
      >
        {{ wire.attributeName }}
      </button>
      <div v-for="box in layout.boxes" :key="box.id" class="node-wrap" :style="{ left: box.x + 'px', top: box.y + 'px' }">
        <button type="button" class="node" :class="[box.kind, { 'is-active': box.id === selectedId }]" :title="box.path" @click="emit('select', box.id)">
          <span class="node-type">{{ box.typeLabel }}</span>
          <span class="node-name">{{ box.name }}</span>
        </button>
        <button v-if="box.childCount" type="button" class="fold" :title="box.collapsed ? '展开' : '收起'" @click="emit('toggle', box.id)">
          {{ box.collapsed ? box.childCount : '−' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { PLAN_NODE_TYPE_LABEL, type ProductPlanNode, type ProductPlanNodeType } from '../../mock/product-v3/productPlan'

const props = defineProps<{
  root: ProductPlanNode
  selectedId: string
  collapsedIds: string[]
}>()

const emit = defineEmits<{
  select: [id: string]
  toggle: [id: string]
}>()

const NODE_W = 172
const NODE_H = 62
const GAP_X = 168
const GAP_Y = 28
const PAD = 44

interface VisualNode {
  id: string
  name: string
  nodeType: ProductPlanNodeType
  path: string
  edges: VisualEdge[]
}

interface VisualEdge {
  attributeId: string | null
  attributeName: string
  target: VisualNode
}

interface Wire {
  key: string
  d: string
  attributeId: string | null
  attributeName: string
  labelX: number
  labelY: number
  showLabel: boolean
  centerLabel: boolean
}

interface Box {
  id: string
  name: string
  path: string
  nodeType: ProductPlanNodeType
  kind: string
  typeLabel: string
  x: number
  y: number
  childCount: number
  collapsed: boolean
}

function toVisual(node: ProductPlanNode): VisualNode {
  const edges: VisualEdge[] = []
  for (const child of node.children || []) {
    if (child.nodeType !== 'ATTRIBUTE') {
      edges.push({ attributeId: null, attributeName: '', target: toVisual(child) })
      continue
    }
    const values = (child.children || []).filter((item) => item.nodeType === 'VALUE')
    if (!values.length) {
      edges.push({ attributeId: null, attributeName: '', target: toVisual(child) })
      continue
    }
    values.forEach((value) => {
      edges.push({ attributeId: child.id, attributeName: child.name, target: toVisual(value) })
    })
    ;(child.children || [])
      .filter((item) => item.nodeType !== 'VALUE')
      .forEach((extra) => {
        edges.push({ attributeId: child.id, attributeName: child.name, target: toVisual(extra) })
      })
  }
  return { id: node.id, name: node.name, nodeType: node.nodeType, path: node.path, edges }
}

const layout = computed(() => {
  const collapsed = new Set(props.collapsedIds)
  const visual = toVisual(props.root)
  const boxes: Box[] = []
  const wires: Wire[] = []

  function blockHeight(node: VisualNode): number {
    if (collapsed.has(node.id) || !node.edges.length) return NODE_H
    const inner = node.edges.reduce((sum, edge) => sum + blockHeight(edge.target), 0) + GAP_Y * (node.edges.length - 1)
    return Math.max(NODE_H, inner)
  }

  function place(node: VisualNode, x: number, top: number) {
    const height = blockHeight(node)
    const y = top + (height - NODE_H) / 2
    const hidden = collapsed.has(node.id)
    boxes.push({
      id: node.id,
      name: node.name,
      path: node.path,
      nodeType: node.nodeType,
      kind: `is-${node.nodeType}`,
      typeLabel: PLAN_NODE_TYPE_LABEL[node.nodeType],
      x,
      y,
      childCount: node.edges.length,
      collapsed: hidden,
    })
    if (hidden || !node.edges.length) return
    const childHeights = node.edges.map((edge) => blockHeight(edge.target))
    const childSum = childHeights.reduce((sum, item) => sum + item, 0) + GAP_Y * (node.edges.length - 1)
    let cursor = top + (height - childSum) / 2
    const sameAttr = node.edges.every((edge) => edge.attributeId && edge.attributeId === node.edges[0].attributeId)
    const spine = x + NODE_W + 52
    node.edges.forEach((edge, index) => {
      place(edge.target, x + NODE_W + GAP_X, cursor)
      const target = boxes.find((item) => item.id === edge.target.id)
      if (target) {
        const y1 = y + NODE_H / 2
        const y2 = target.y + NODE_H / 2
        wires.push({
          key: `${node.id}-${edge.target.id}-${edge.attributeId || 'direct'}`,
          d: `M ${x + NODE_W} ${y1} H ${spine} V ${y2} H ${target.x}`,
          attributeId: edge.attributeId,
          attributeName: edge.attributeName,
          labelX: sameAttr ? x + NODE_W + 16 : (spine + target.x) / 2,
          labelY: sameAttr ? y1 : y2,
          showLabel: Boolean(edge.attributeName) && (!sameAttr || index === 0),
          centerLabel: !sameAttr,
        })
      }
      cursor += childHeights[index] + GAP_Y
    })
  }

  place(visual, PAD, PAD)
  const width = Math.max(...boxes.map((item) => item.x), PAD) + NODE_W + PAD
  const height = Math.max(...boxes.map((item) => item.y), PAD) + NODE_H + PAD
  return { boxes, wires, width, height }
})
</script>

<style scoped>
.mind { position: relative; min-width: min-content; min-height: 100%; }
.legend { position: sticky; top: 0; z-index: 3; display: flex; gap: 14px; padding: 8px 12px; color: #66788a; font-size: 12px; background: rgba(245, 247, 251, 0.92); }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.swatch { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.swatch.cat { background: #304156; }
.swatch.type { background: #409eff; }
.swatch.attr { background: #e6a23c; }
.swatch.value { background: #67c23a; }
.swatch.material { background: #909399; }
.canvas { position: relative; }
.wires { position: absolute; inset: 0; }
.wires path { fill: none; stroke: #c5d0dc; stroke-width: 1.5; }
.node-wrap { position: absolute; width: 172px; height: 62px; transition: left 0.18s ease, top 0.18s ease; }
.node { width: 172px; height: 62px; border: 1px solid #d9e2ec; border-left-width: 4px; border-radius: 6px; background: #fff; box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05); display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 4px; padding: 0 12px; cursor: pointer; text-align: left; }
.node.is-CATEGORY { border-left-color: #304156; }
.node.is-PRODUCT_TYPE { border-left-color: #409eff; }
.node.is-ATTRIBUTE { border-left-color: #e6a23c; }
.node.is-VALUE { border-left-color: #67c23a; }
.node.is-MATERIAL { border-left-color: #909399; }
.node.is-active { border-color: #409eff; background: #f5f9ff; box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.22); }
.node-type { display: inline-block; font-size: 11px; line-height: 1; padding: 2px 6px; border-radius: 10px; }
.node.is-CATEGORY .node-type { background: #eef1f5; color: #304156; }
.node.is-PRODUCT_TYPE .node-type { background: #e8f3ff; color: #1677ff; }
.node.is-ATTRIBUTE .node-type { background: #fdf6ec; color: #b88230; }
.node.is-VALUE .node-type { background: #f0f9eb; color: #3d8b40; }
.node.is-MATERIAL .node-type { background: #f4f4f5; color: #606266; }
.node-name { max-width: 100%; font-size: 14px; font-weight: 650; color: #1f2a37; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fold { position: absolute; right: -9px; top: 22px; width: 18px; height: 18px; border-radius: 50%; border: 1px solid #c5d0dc; background: #fff; color: #304156; font-size: 12px; line-height: 16px; padding: 0; cursor: pointer; z-index: 2; }
.fold:hover { border-color: #409eff; color: #409eff; }
.edge-label { position: absolute; z-index: 2; transform: translateY(-50%); border: 1px solid #f3d19e; background: #fdf6ec; color: #b88230; border-radius: 10px; font-size: 12px; line-height: 1; padding: 3px 8px; cursor: pointer; }
.edge-label.is-center { transform: translate(-50%, -50%); }
.edge-label.is-active { background: #e6a23c; border-color: #e6a23c; color: #fff; }
</style>
