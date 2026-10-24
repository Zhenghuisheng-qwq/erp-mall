<template>
  <Teleport to="body">
    <section v-if="modelValue" ref="panel" class="node-add-panel" role="dialog" :aria-label="title" :style="position"
      @pointerdown.stop @mousedown.stop @click.stop @wheel.stop @keydown.stop>
      <header><strong>{{ title }}</strong><el-button text aria-label="关闭新增面板" @click="close">×</el-button></header>
      <div class="node-add-content"><slot /></div>
      <footer><slot name="footer" /></footer>
    </section>
  </Teleport>
</template>
<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
const props = defineProps<{ modelValue: boolean; title: string; anchor: HTMLElement | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; closed: [] }>()
const panel = ref<HTMLElement>(), position = ref<Record<string, string>>({ visibility: 'hidden' })
let frame = 0
function close() { emit('update:modelValue', false) }
function place() {
  if (!props.modelValue) return
  const anchor = props.anchor
  if (!anchor?.isConnected) { close(); return }
  const rect = anchor.getBoundingClientRect(), width = Math.min(420, window.innerWidth - 24)
  const board = anchor.closest('.vue-flow, .outline')?.getBoundingClientRect()
  if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > innerHeight || rect.right < 0 || rect.left > innerWidth ||
      (board && (rect.bottom < board.top || rect.top > board.bottom || rect.right < board.left || rect.left > board.right))) { close(); return }
  const height = Math.min(panel.value?.offsetHeight || 360, innerHeight - 24)
  const narrow = innerWidth < 760
  const x = narrow ? (innerWidth - width) / 2 : rect.right + width + 12 < innerWidth ? rect.right + 8 : rect.left - width - 8
  const y = narrow ? (innerHeight - height) / 2 : rect.top
  position.value = { left: `${Math.max(12, Math.min(x, innerWidth - width - 12))}px`, top: `${Math.max(12, Math.min(y, innerHeight - height - 12))}px`, width: `${width}px` }
  frame = requestAnimationFrame(place)
}
watch(() => props.modelValue, async open => {
  cancelAnimationFrame(frame)
  if (open) { position.value = { visibility: 'hidden' }; await nextTick(); place(); panel.value?.querySelector<HTMLInputElement>('input')?.focus({preventScroll: true}) }
  else { emit('closed'); if (props.anchor?.isConnected) props.anchor.focus({preventScroll: true}) }
})
onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>
<style scoped>
.node-add-panel{position:fixed;z-index:2000;box-sizing:border-box;max-height:calc(100vh - 24px);display:flex;flex-direction:column;border:1px solid var(--el-border-color);border-radius:10px;background:var(--el-bg-color-overlay);color:var(--el-text-color-primary);box-shadow:var(--el-box-shadow);padding:14px}
header,footer{display:flex;align-items:center;justify-content:space-between;gap:10px;flex:none}header{margin-bottom:12px}footer{justify-content:flex-end;padding-top:12px}.node-add-content{overflow:auto;min-height:0;padding:2px}
</style>
