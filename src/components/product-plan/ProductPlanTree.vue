<template>
  <section class="tree">
    <header class="tree-bar">
      <strong>{{ view === 'mind' ? '导图模式' : '竖向编辑' }}</strong>
      <span class="muted">{{ count }} 个节点 · 两种视图共用这一棵树</span>
    </header>
    <div class="tree-body" :class="{ 'is-mind': view === 'mind' }">
      <ProductPlanMindMap v-if="root && view === 'mind'" :root="root" :selected-id="selectedId" :collapsed-ids="collapsedIds" @select="emit('select', $event)" @toggle="emit('toggle', $event)" />
      <ProductPlanVerticalEditor v-else-if="root" :root="root" :selected-id="selectedId" @select="emit('select', $event)" />
      <div v-else class="tree-empty">这棵规划还没有节点。</div>
    </div>
  </section>
</template>

<script setup lang="ts">
import ProductPlanMindMap from './ProductPlanMindMap.vue'
import ProductPlanVerticalEditor from './ProductPlanVerticalEditor.vue'
import type { ProductPlanNode } from '../../mock/product-v3/productPlan'

defineProps<{
  root: ProductPlanNode | null
  view: 'mind' | 'vertical'
  selectedId: string
  collapsedIds: string[]
  count: number
}>()

const emit = defineEmits<{
  select: [id: string]
  toggle: [id: string]
}>()
</script>

<style scoped>
.tree { background: #fff; border: 1px solid #e6edf5; border-radius: 10px; min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.tree-bar { flex: none; display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 12px 14px; border-bottom: 1px solid #eef2f6; }
.tree-bar strong { font-size: 14px; }
.tree-body { flex: 1; min-height: 0; overflow: auto; background: #fff; }
.tree-body.is-mind { background-color: #f5f7fb; background-image: radial-gradient(#d7dee8 1px, transparent 1px); background-size: 16px 16px; }
.tree-empty { padding: 28px 16px; color: #66788a; }
</style>
