<template>
  <div ref="wrapRef" class="rail-wrap" @mouseenter="cancelClose" @mouseleave="scheduleClose" @focusout="onFocusOut" @keydown="onWrapKeydown">
    <aside ref="railRef" class="rail" aria-label="主导航">
      <div class="rail-brand" title="商品配置">
        <span class="brand-mark">商</span>
      </div>
      <div class="rail-scroll">
        <button
          v-for="(group, index) in groups"
          :key="group.key"
          type="button"
          class="rail-btn"
          :class="{ 'is-current': currentGroup === group.key, 'is-open': shownKey === group.key }"
          :data-group="group.key"
          :aria-expanded="shownKey === group.key"
          :aria-controls="shownGroup ? 'nav-flyout' : undefined"
          @mouseenter="onRailEnter(group.key, $event)"
          @focus="onRailEnter(group.key, $event)"
          @click="onRailClick(group.key)"
          @keydown="onRailKeydown($event, index)"
        >
          <el-icon :size="20"><component :is="group.icon" /></el-icon>
          <span>{{ group.title }}</span>
        </button>
      </div>
    </aside>
    <div
      v-if="shownGroup"
      id="nav-flyout"
      ref="flyoutRef"
      class="flyout is-pop"
      :class="{ 'is-grid': flyoutLayout.mode === 'grid' }"
      :style="popStyle"
      role="navigation"
      :aria-label="shownGroup.title"
      @mouseenter="cancelClose"
      @keydown="onFlyoutKeydown"
    >
      <header class="flyout-head">
        <strong>{{ shownGroup.title }}</strong>
      </header>
      <div class="flyout-body" :class="flyoutLayout.mode === 'grid' ? 'is-grid' : 'is-single'">
        <template v-if="flyoutLayout.mode === 'grid'">
          <a
            v-for="item in flyoutLayout.shortcuts"
            :key="item.index"
            class="flyout-shortcut"
            :class="{ 'is-current': active === item.index }"
            :href="hrefOf(item.index)"
            :aria-current="active === item.index ? 'page' : undefined"
            :data-index="item.index"
            @click="go($event, item.index)"
          >{{ item.title }}</a>
          <div class="flyout-grid">
            <section
              v-for="section in flyoutLayout.sections"
              :key="section.key"
              class="flyout-section"
              :data-slot="section.key"
              :style="slotStyle(section.key)"
            >
              <h3 :class="{ 'is-current': section.items.some((item) => item.index === active) }">{{ section.title }}</h3>
              <a
                v-for="item in section.items"
                :key="item.index"
                class="flyout-link"
                :class="{ 'is-current': active === item.index }"
                :href="hrefOf(item.index)"
                :aria-current="active === item.index ? 'page' : undefined"
                :data-index="item.index"
                @click="go($event, item.index)"
              >{{ item.title }}</a>
            </section>
          </div>
        </template>
        <template v-else>
          <a
            v-for="item in flyoutLayout.loose"
            :key="item.index"
            class="flyout-link"
            :class="{ 'is-current': active === item.index }"
            :href="hrefOf(item.index)"
            :aria-current="active === item.index ? 'page' : undefined"
            :data-index="item.index"
            @click="go($event, item.index)"
          >{{ item.title }}</a>
          <section v-for="section in flyoutLayout.sections" :key="section.key" class="flyout-section">
            <h3 :class="{ 'is-current': section.items.some((item) => item.index === active) }">{{ section.title }}</h3>
            <a
              v-for="item in section.items"
              :key="item.index"
              class="flyout-link"
              :class="{ 'is-current': active === item.index }"
              :href="hrefOf(item.index)"
              :aria-current="active === item.index ? 'page' : undefined"
              :data-index="item.index"
              @click="go($event, item.index)"
            >{{ item.title }}</a>
          </section>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Component } from 'vue'
import { useRouter } from 'vue-router'

type Leaf = { index: string; title: string }
type Section = { key: string; title: string; items: Leaf[] }
export type RailGroup = { key: string; title: string; icon: Component; items: Leaf[]; sections: Section[] }

const props = defineProps<{
  groups: RailGroup[]
  active: string
  currentGroup: string
}>()

const router = useRouter()
const wrapRef = ref<HTMLElement>()
const railRef = ref<HTMLElement>()
const flyoutRef = ref<HTMLElement>()
const hoverKey = ref('')
const heldKey = ref('')
const flyoutTop = ref(8)
const popLeft = ref(96)
let closeTimer = 0

const shownKey = computed(() => hoverKey.value || heldKey.value)
const shownGroup = computed(() => props.groups.find((group) => group.key === shownKey.value) || null)
const SLOT: Record<string, { column: number; row: number }> = {
  manage: { column: 1, row: 1 },
  model: { column: 2, row: 1 },
  operate: { column: 1, row: 2 },
  analysis: { column: 2, row: 2 },
}
const flyoutLayout = computed(() => {
  const group = shownGroup.value
  const sections = (group?.sections || []).filter((section) => section.items.length)
  const slotted = sections.filter((section) => SLOT[section.key])
  const extra = sections.filter((section) => !SLOT[section.key])
  if (slotted.length < 2) return { mode: 'single' as const, shortcuts: [] as Leaf[], loose: group?.items || [], sections: [...slotted, ...extra] }
  return { mode: 'grid' as const, shortcuts: group?.items || [], loose: [] as Leaf[], sections: [...slotted, ...extra] }
})
function slotStyle(key: string) {
  const slot = SLOT[key]
  if (!slot) return undefined
  return { gridColumn: String(slot.column), gridRow: String(slot.row) }
}
const popStyle = computed(() => {
  const viewportCap = `calc(100vw - ${popLeft.value + 12}px)`
  return {
    top: `${flyoutTop.value}px`,
    left: `${popLeft.value}px`,
    maxHeight: `calc(100vh - ${flyoutTop.value + 8}px)`,
    maxWidth: flyoutLayout.value.mode === 'grid' ? `min(22rem, ${viewportCap})` : viewportCap,
  }
})

function cancelClose() {
  window.clearTimeout(closeTimer)
}
function scheduleClose() {
  cancelClose()
  closeTimer = window.setTimeout(() => {
    hoverKey.value = ''
  }, 180)
}
function placePop(target: EventTarget | null) {
  const button = target as HTMLElement | null
  const rail = railRef.value
  if (!button || !rail) return
  const buttonTop = button.getBoundingClientRect().top
  popLeft.value = Math.round(rail.getBoundingClientRect().right - 8)
  flyoutTop.value = Math.max(8, buttonTop)
  nextTick(() => {
    const panel = flyoutRef.value
    if (!panel) return
    const height = panel.getBoundingClientRect().height
    const maxTop = Math.max(8, window.innerHeight - height - 8)
    if (flyoutTop.value > maxTop) flyoutTop.value = maxTop
  })
}
function onRailEnter(key: string, event: MouseEvent | FocusEvent) {
  cancelClose()
  hoverKey.value = key
  placePop(event.currentTarget)
}
function onRailClick(key: string) {
  cancelClose()
  if (heldKey.value === key) {
    heldKey.value = ''
    hoverKey.value = ''
    return
  }
  heldKey.value = key
  hoverKey.value = ''
}
function hrefOf(index: string) {
  return router.resolve(index).href
}
function closePanel() {
  heldKey.value = ''
  hoverKey.value = ''
}
function go(event: MouseEvent, index: string) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  const target = router.resolve(index)
  if (target.fullPath !== router.currentRoute.value.fullPath) void router.push(target)
  closePanel()
}
function onRailKeydown(event: KeyboardEvent, index: number) {
  const target = event.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    const buttons = railRef.value?.querySelectorAll<HTMLButtonElement>('.rail-btn')
    if (!buttons?.length) return
    const step = event.key === 'ArrowDown' ? 1 : -1
    buttons[(index + step + buttons.length) % buttons.length]?.focus()
    return
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault()
    flyoutRef.value?.querySelector<HTMLElement>('a.flyout-link')?.focus()
  }
}
function onFlyoutKeydown(event: KeyboardEvent) {
  if (event.key !== 'ArrowLeft') return
  const target = event.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
  const key = shownKey.value
  if (!key) return
  event.preventDefault()
  railRef.value?.querySelector<HTMLButtonElement>(`[data-group="${key}"]`)?.focus()
}
function onWrapKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  const target = event.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return
  closePanel()
}
function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget as Node | null
  if (next && wrapRef.value?.contains(next)) return
  closePanel()
}
function isTypingTarget(target: EventTarget | null) {
  const node = target as HTMLElement | null
  if (!node?.closest) return false
  const tag = node.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || node.isContentEditable) return true
  return Boolean(node.closest('.el-dialog, .el-message-box, .el-overlay, .el-popper, .context-menu'))
}
function onDocPointerDown(event: PointerEvent) {
  if (!shownKey.value) return
  const target = event.target as Node | null
  if (target && wrapRef.value?.contains(target)) return
  closePanel()
}
function onDocKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !shownKey.value) return
  if (isTypingTarget(event.target)) return
  if (wrapRef.value?.contains(event.target as Node)) return
  closePanel()
}
watch(
  () => props.groups.map((group) => group.key).join('|'),
  () => {
    if (hoverKey.value && !props.groups.some((group) => group.key === hoverKey.value)) hoverKey.value = ''
    if (heldKey.value && !props.groups.some((group) => group.key === heldKey.value)) heldKey.value = ''
  },
)

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown)
  window.addEventListener('keydown', onDocKeydown)
})
onBeforeUnmount(() => {
  cancelClose()
  document.removeEventListener('pointerdown', onDocPointerDown)
  window.removeEventListener('keydown', onDocKeydown)
})
</script>

<style scoped>
.rail-wrap { display: flex; flex: none; height: 100%; min-height: 0; position: relative; z-index: 20; }
.rail { width: 96px; flex: none; height: 100%; background: var(--nav-bg); color: var(--nav-text); display: flex; flex-direction: column; }
.rail-brand { height: 56px; flex: none; display: flex; align-items: center; justify-content: center; background: var(--nav-bg-deep); }
.rail-scroll { flex: 1; min-height: 0; overflow-x: hidden; overflow-y: auto; padding: 6px 0 12px; }
.rail-scroll::-webkit-scrollbar { width: 0; }
.rail-btn {
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--nav-text);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 64px;
  padding: 10px 4px;
  cursor: pointer;
  font-size: 12px;
  line-height: 1.25;
}
.rail-btn span { white-space: nowrap; }
.rail-btn:hover, .rail-btn.is-open { background: var(--nav-hover); color: var(--text-primary); }
.rail-btn.is-current, .rail-btn.is-current:hover { background: var(--nav-current-bg); color: var(--nav-current-text); }
.rail-btn:focus-visible { outline: 2px solid var(--app-accent); outline-offset: -3px; }
.flyout { width: 260px; max-width: calc(100vw - 120px); background: var(--flyout-bg); color: var(--flyout-text); display: flex; flex-direction: column; min-height: 0; }
.flyout.is-grid {
  width: max-content;
  max-width: min(22rem, calc(100vw - 7.5rem));
}
.flyout.is-pop {
  position: fixed;
  z-index: 30;
  border: 1px solid var(--flyout-border);
  border-left: 0;
  border-radius: 0 10px 10px 0;
  box-shadow: var(--shadow-pop);
}
.flyout-head { flex: none; padding: 14px 16px 8px; }
.flyout-head strong { font-size: 15px; font-weight: 700; color: var(--text-primary); }
.flyout-link:focus-visible, .flyout-shortcut:focus-visible { outline: 2px solid var(--app-accent); outline-offset: 1px; }
.flyout-body { flex: 1; min-height: 0; overflow: auto; padding: 0 12px 16px; }
.flyout-body.is-grid { padding-right: 10px; padding-left: 10px; }
.flyout-body::-webkit-scrollbar { width: 8px; }
.flyout-body::-webkit-scrollbar-thumb { background: var(--border-default); border-radius: 4px; }
.flyout-shortcut {
  display: block;
  margin: 0 4px 10px;
  padding: 8px 10px;
  border-radius: 6px;
  border-bottom: 1px solid var(--flyout-border);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 650;
  line-height: 1.4;
}
.flyout-shortcut:hover { background: var(--flyout-hover); }
.flyout-shortcut.is-current { background: var(--flyout-current-bg); color: var(--flyout-current-text); }
.flyout-grid {
  display: grid;
  width: max-content;
  max-width: 100%;
  grid-template-columns: max-content max-content;
  column-gap: clamp(0.75rem, 1vw, 1rem);
  align-items: start;
  position: relative;
}
.flyout-body.is-grid .flyout-section { min-width: min-content; }
.flyout-body.is-grid .flyout-section h3,
.flyout-body.is-grid .flyout-link { white-space: nowrap; }
@media (max-width: 23rem) {
  .flyout.is-grid { width: min(22rem, calc(100vw - 7.5rem)); }
  .flyout-grid { width: 100%; grid-template-columns: minmax(0, 1fr); }
  .flyout-grid::before { display: none; }
  .flyout-body.is-grid .flyout-section {
    grid-column: 1 / -1 !important;
    grid-row: auto !important;
    min-width: 0;
  }
}
.flyout-grid::before {
  content: "";
  position: absolute;
  top: 6px;
  bottom: 6px;
  left: 50%;
  width: 1px;
  background: var(--flyout-border);
  transform: translateX(-0.5px);
}
.flyout-section { min-width: 0; padding: 2px 0 6px; }
.flyout-section[data-slot="operate"],
.flyout-section[data-slot="analysis"] { border-top: 1px solid var(--flyout-border); margin-top: 6px; padding-top: 10px; }
.flyout-section h3 { margin: 4px 10px 2px; font-size: 13px; line-height: 1.4; font-weight: 700; color: var(--text-primary); }
.flyout-section h3.is-current { color: var(--app-accent); }
.flyout-link {
  display: block;
  margin: 0;
  padding: 7px 10px;
  border-radius: 6px;
  color: var(--flyout-text);
  font-size: 14px;
  font-weight: 400;
  line-height: 1.4;
  white-space: normal;
}
.flyout-link:hover { background: var(--flyout-hover); }
.flyout-link.is-current { background: var(--flyout-current-bg); color: var(--flyout-current-text); font-weight: 650; }
</style>
