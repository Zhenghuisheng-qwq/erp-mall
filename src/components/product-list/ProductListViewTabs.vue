<template>
  <div class="list-view-bar" :aria-busy="busy">
    <div ref="rail" class="list-view-rail">
      <div class="list-view-tabs" role="tablist" aria-label="保存视图" @keydown="onKey">
        <button v-for="view in visibleViews" :key="view.id" role="tab" type="button" :aria-selected="view.id === activeId" :tabindex="view.id === activeId ? 0 : -1" :disabled="busy" :title="view.name" :data-view-tab="view.id" :class="{ active: view.id === activeId }" @click="emit('select', view.id)">{{ view.name }}</button>
      </div>
      <el-popover v-model:visible="open" placement="bottom-start" trigger="click" :width="300" popper-class="list-view-picker">
        <template #reference><el-button class="more-views" data-more-views :disabled="busy">更多视图</el-button></template>
        <el-input v-model="search" placeholder="搜索视图" aria-label="搜索视图" clearable />
        <div class="view-options">
          <button v-for="view in searchedViews" :key="view.id" type="button" :data-saved-view="view.id" :title="view.name" :disabled="busy" :class="{ active: view.id === activeId }" @click="choose(view.id)">{{ view.name }}<span v-if="view.id === activeId" aria-label="当前视图">✓</span></button>
          <p v-if="!searchedViews.length" class="muted">没有匹配的视图</p>
        </div>
        <el-button v-if="canCreate" link type="primary" :disabled="busy" @click="open = false; emit('create')">新建视图</el-button>
      </el-popover>
    </div>
    <div class="list-view-actions"><slot name="actions" /></div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
const props = withDefaults(defineProps<{ views: { id: string; name: string }[]; activeId: string; tabIds?: string[]; busy?: boolean; canCreate?: boolean }>(), { busy: false, canCreate: true })
const emit = defineEmits<{ select: [id: string]; create: [] }>()
const rail = ref<HTMLElement>(), available = ref(600), open = ref(false), search = ref('')
const orderedViews = computed(() => {
  const seen = new Set<string>(), byId = new Map(props.views.map(view => [view.id, view]))
  return [...(props.tabIds ?? props.views.map(view => view.id)), props.activeId].flatMap(id => {
    const view = byId.get(id)
    if (!view || seen.has(id)) return []
    seen.add(id); return [view]
  })
})
let canvas: HTMLCanvasElement | undefined
function width(name: string) {
  canvas ??= document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (context) context.font = rail.value ? getComputedStyle(rail.value).font : '14px sans-serif'
  return Math.min(184, Math.max(64, (context?.measureText(name).width ?? name.length * 14) + 28))
}
const visibleViews = computed(() => {
  const rows = orderedViews.value, limit = Math.max(72, available.value - 110)
  let used = 0
  const visible = rows.filter(row => { const size = width(row.name); if (used + size > limit) return false; used += size; return true })
  const active = rows.find(row => row.id === props.activeId)
  if (active && !visible.some(row => row.id === active.id)) {
    while (visible.length && used + width(active.name) > limit) used -= width(visible.pop()!.name)
    visible.push(active)
  }
  return visible.sort((a, b) => rows.indexOf(a) - rows.indexOf(b))
})
const searchedViews = computed(() => props.views.filter(view => view.name.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase())))
function choose(id: string) { open.value = false; emit('select', id) }
function onKey(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  const buttons = [...(rail.value?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [])]
  const at = buttons.indexOf(document.activeElement as HTMLButtonElement)
  if (at < 0 || !buttons.length) return
  event.preventDefault()
  const target = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (at + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length
  buttons[target]?.focus()
}
let observer: ResizeObserver | undefined
function measure() { if (rail.value) available.value = rail.value.clientWidth }
onMounted(() => { measure(); observer = new ResizeObserver(measure); if (rail.value) observer.observe(rail.value) })
watch(() => props.activeId, () => { open.value = false; void nextTick(measure) })
onBeforeUnmount(() => { observer?.disconnect(); canvas = undefined })
</script>

<style scoped>
.list-view-bar { display:flex; flex-wrap:wrap; align-items:center; gap:8px 16px; min-width:0; padding-bottom:10px; border-bottom:1px solid var(--el-border-color-lighter); margin-bottom:12px; }
.list-view-rail { flex:1 1 280px; min-width:0; display:flex; align-items:center; gap:6px; }
.list-view-tabs { display:flex; align-items:stretch; gap:2px; min-width:0; overflow:hidden; }
.list-view-tabs button { font:inherit; border:0; border-bottom:2px solid transparent; border-radius:4px 4px 0 0; padding:8px 12px; max-width:184px; min-width:0; flex-shrink:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; background:transparent; color:var(--el-text-color-regular); cursor:pointer; }
.list-view-tabs button.active { color:var(--el-color-primary); background:var(--el-color-primary-light-9); border-bottom-color:var(--el-color-primary); font-weight:600; }
.list-view-tabs button:focus-visible { outline:2px solid var(--el-color-primary); outline-offset:-2px; }
.list-view-tabs button:disabled { cursor:wait; }
.more-views { flex:none; margin-left:auto; }
.list-view-actions { display:flex; align-items:center; flex-wrap:wrap; gap:8px; min-width:0; }
.view-options { display:flex; flex-direction:column; gap:2px; max-height:min(360px,55vh); overflow:auto; margin:8px 0; }
.view-options button { display:flex; justify-content:space-between; text-align:left; font:inherit; padding:8px; color:var(--el-text-color-regular); background:transparent; border:0; border-radius:4px; cursor:pointer; overflow-wrap:anywhere; gap:8px; }
.view-options button:hover,.view-options button.active { color:var(--el-color-primary); background:var(--el-color-primary-light-9); }
.muted { color:var(--el-text-color-secondary); }
@media(max-width:600px) { .list-view-actions { width:100%; } .list-view-tabs button { max-width:160px; padding:8px; } }
</style>
<style>.list-view-picker { max-width:calc(100vw - 24px); box-sizing:border-box; }</style>
