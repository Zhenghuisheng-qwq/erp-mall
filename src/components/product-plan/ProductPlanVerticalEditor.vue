<template>
  <div class="sheet">
    <p class="sheet-tip">按层级维护同一棵规划树。点某一项会切到对应分支，右侧详情跟着变。</p>
    <div v-for="(level, index) in levels" :key="level.key" class="level">
      <div class="level-index">{{ index + 1 }}</div>
      <button type="button" class="level-label" :class="{ 'is-active': selectedId === level.anchorId }" @click="emit('select', level.anchorId)">
        {{ level.label }}
      </button>
      <div class="level-options">
        <button
          v-for="option in level.options"
          :key="option.id"
          type="button"
          class="option"
          :class="{ 'is-active': option.id === level.currentId }"
          @click="emit('select', option.id)"
        >
          {{ option.name }}
        </button>
        <span v-if="!level.options.length" class="muted">这一层还没有取值</span>
      </div>
    </div>
    <p v-if="pathText" class="path">当前路径：{{ pathText }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { findPlanNode, verticalLevels, type ProductPlanNode } from '../../mock/product-v3/productPlan'

const props = defineProps<{
  root: ProductPlanNode
  selectedId: string
}>()

const emit = defineEmits<{
  select: [id: string]
}>()

const levels = computed(() => verticalLevels(props.root, props.selectedId))
const pathText = computed(() => findPlanNode(props.root, props.selectedId)?.path || props.root.path)
</script>

<style scoped>
.sheet { padding: 16px 18px 20px; overflow: auto; height: 100%; }
.sheet-tip { color: #66788a; font-size: 13px; margin-bottom: 14px; }
.level { display: grid; grid-template-columns: 28px 96px minmax(0, 1fr); gap: 10px; align-items: start; padding: 10px 0; border-bottom: 1px solid #eef2f6; }
.level-index { width: 22px; height: 22px; border-radius: 50%; background: #f2f4f7; color: #66788a; font-size: 12px; display: inline-flex; align-items: center; justify-content: center; margin-top: 4px; }
.level-label { border: 0; background: transparent; color: #66788a; font-size: 13px; text-align: left; padding: 6px 0; cursor: pointer; }
.level-label.is-active { color: #409eff; font-weight: 650; }
.level-options { display: flex; flex-wrap: wrap; gap: 8px; }
.option { border: 1px solid #d9e2ec; background: #fff; color: #1f2a37; border-radius: 4px; min-width: 72px; padding: 6px 12px; cursor: pointer; font-size: 13px; }
.option:hover { border-color: #b9d6fb; }
.option.is-active { background: #409eff; border-color: #409eff; color: #fff; }
.path { margin-top: 16px; color: #66788a; font-size: 12px; line-height: 1.6; }
</style>
