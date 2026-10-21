<template>
  <div ref="wrapRef" class="rail-wrap" :data-mode="mode" @mouseenter="cancelClose" @mouseleave="scheduleClose" @focusout="onFocusOut" @keydown="onWrapKeydown">
    <div class="nav-column" :class="{ 'is-single': mode === 'single', 'is-icons': mode === 'icons' }">
    <aside v-if="mode === 'single'" class="sider" aria-label="主导航">
      <div class="sider-brand" title="商品配置">
        <span class="brand-mark">商</span>
        <strong>商品配置</strong>
      </div>
      <div class="sider-scroll">
        <el-menu
          :key="menuStamp"
          ref="menuRef"
          :default-active="active"
          :default-openeds="openeds"
          :collapse-transition="false"
          @open="onMenuOpen"
          @close="onMenuClose"
          @select="onMenuSelect"
        >
          <el-sub-menu v-for="group in groups" :key="group.key" :index="group.key">
            <template #title>
              <el-icon :size="18"><component :is="group.icon" /></el-icon>
              <span>{{ group.title }}</span>
            </template>
            <el-menu-item v-for="item in group.items" :key="item.index" :index="item.index">{{ item.title }}</el-menu-item>
            <el-sub-menu v-for="section in group.sections" :key="section.key" :index="section.key">
              <template #title>{{ section.title }}</template>
              <el-menu-item v-for="leaf in section.items" :key="leaf.index" :index="leaf.index">{{ leaf.title }}</el-menu-item>
            </el-sub-menu>
          </el-sub-menu>
        </el-menu>
      </div>
    </aside>
    <aside v-else ref="railRef" class="rail" :class="{ 'is-icons': mode === 'icons' }" aria-label="主导航">
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
          :title="group.title"
          :aria-label="group.title"
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
    <nav class="nav-dock" aria-label="导航布局">
      <button ref="layoutBtnRef" type="button" class="nav-tool" aria-haspopup="menu" :aria-expanded="layoutOpen" aria-label="切换布局" title="切换布局" @click="toggleLayout">
        <span class="nav-tool-label">布局</span>
        <span v-if="mode === 'icons'" class="nav-tool-mark" aria-hidden="true">≡</span>
      </button>
      <button v-if="mode === 'dual' && !menuOpen" type="button" class="nav-tool" @click="menuOpen = true">展开菜单</button>
    </nav>
    </div>
    <Teleport defer to="#iyge-nav-fold">
      <button type="button" class="nav-fold" data-nav-fold :aria-label="compactLabel" :title="compactLabel" @click="toggleFold">
        <el-icon :size="18"><Expand v-if="mode === 'icons'" /><Fold v-else /></el-icon>
      </button>
    </Teleport>
    <Teleport to="body">
      <div v-if="layoutOpen" ref="layoutPopRef" class="layout-pop" role="menu" aria-label="导航布局" :style="layoutStyle">
        <button
          v-for="item in layoutChoices"
          :key="item.id"
          type="button"
          class="layout-option"
          role="menuitemradio"
          :aria-checked="mode === item.id"
          :class="{ 'is-current': mode === item.id }"
          @click="chooseLayout(item.id)"
        >{{ item.label }}</button>
      </div>
    </Teleport>
    <div
      v-if="mode !== 'single' && shownGroup"
      id="nav-flyout"
      ref="flyoutRef"
      class="flyout"
      :class="{ 'is-pop': popped, 'is-dock': !popped, 'is-grid': flyoutLayout.mode === 'grid' }"
      :style="popped ? popStyle : undefined"
      role="navigation"
      :aria-label="shownGroup.title"
      @mouseenter="cancelClose"
      @keydown="onFlyoutKeydown"
    >
      <header class="flyout-head">
        <strong>{{ shownGroup.title }}</strong>
        <button type="button" class="nav-text-btn" @click="togglePin">{{ pinned ? '取消固定' : '固定' }}</button>
        <button v-if="mode === 'dual'" type="button" class="nav-text-btn" @click="menuOpen = false">收起</button>
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
import { Expand, Fold } from '@element-plus/icons-vue'
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

type NavMode = 'dual' | 'single' | 'icons'
type ExpandedMode = 'dual' | 'single'
const NAV_KEY = 'iyge-nav-layout'

function readNav() {
  const fallback = { mode: 'dual' as NavMode, pinned: false, menuOpen: true, openeds: null as string[] | null, expandedMode: 'dual' as ExpandedMode }
  try {
    const raw = localStorage.getItem(NAV_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as { mode?: string; pinned?: boolean; menuOpen?: boolean; openeds?: unknown; expandedMode?: string }
    const mode: NavMode = parsed.mode === 'single' || parsed.mode === 'icons' ? parsed.mode : 'dual'
    const openeds = Array.isArray(parsed.openeds) ? parsed.openeds.filter((item): item is string => typeof item === 'string') : null
    const storedExpanded: ExpandedMode = parsed.expandedMode === 'single' ? 'single' : 'dual'
    const expandedMode: ExpandedMode = mode === 'icons' ? storedExpanded : mode
    return { mode, pinned: Boolean(parsed.pinned), menuOpen: parsed.menuOpen !== false, openeds, expandedMode }
  } catch {
    return fallback
  }
}

const saved = readNav()
const router = useRouter()
const wrapRef = ref<HTMLElement>()
const railRef = ref<HTMLElement>()
const flyoutRef = ref<HTMLElement>()
const menuRef = ref<{ open: (index: string) => void }>()
const layoutBtnRef = ref<HTMLButtonElement>()
const layoutPopRef = ref<HTMLElement>()
const mode = ref<NavMode>(saved.mode)
const expandedMode = ref<ExpandedMode>(saved.expandedMode)
const pinned = ref(saved.pinned)
const menuOpen = ref(saved.menuOpen)
const layoutOpen = ref(false)
const layoutStyle = ref({ left: '0px', bottom: '0px' })
const hoverKey = ref('')
const heldKey = ref('')
const flyoutTop = ref(8)
const popLeft = ref(96)
let closeTimer = 0
let ignoreMenuEvents = false
const layoutChoices: { id: NavMode; label: string }[] = [
  { id: 'dual', label: '双栏' },
  { id: 'single', label: '单栏' },
  { id: 'icons', label: '仅图标' },
]

function visibleKeySet() {
  return new Set(props.groups.flatMap((group) => [group.key, ...group.sections.map((section) => section.key)]))
}
function placeKeys() {
  const keys: string[] = []
  if (props.currentGroup) keys.push(props.currentGroup)
  for (const group of props.groups) {
    for (const section of group.sections) {
      if (section.items.some((item) => item.index === props.active)) keys.push(section.key)
    }
  }
  return keys
}
function seedOpeneds() {
  const visible = visibleKeySet()
  const base = saved.openeds ?? ['product']
  const next = base.filter((key) => visible.has(key))
  if (saved.openeds === null) {
    for (const key of placeKeys()) if (visible.has(key) && !next.includes(key)) next.push(key)
  }
  for (const group of props.groups) {
    if (group.sections.some((section) => next.includes(section.key)) && visible.has(group.key) && !next.includes(group.key)) next.push(group.key)
  }
  return next
}

const openeds = ref<string[]>(seedOpeneds())
const popped = computed(() => mode.value === 'icons' || (mode.value === 'dual' && !menuOpen.value))
const shownKey = computed(() => {
  if (mode.value === 'single') return ''
  if (hoverKey.value) return hoverKey.value
  if (pinned.value && heldKey.value) return heldKey.value
  if (mode.value === 'dual' && menuOpen.value) return props.currentGroup
  return ''
})
const compactLabel = computed(() => (mode.value === 'icons' ? '展开菜单' : '缩小菜单'))
const menuStamp = computed(() => props.groups.map((group) => group.key).join('|'))
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
  const slotOrder = ['manage', 'model', 'operate', 'analysis'].filter((key) => slotted.some((section) => section.key === key)).join('|')
  const actualOrder = slotted.map((section) => section.key).join('|')
  if (slotted.length < 2 || actualOrder !== slotOrder) return { mode: 'single' as const, shortcuts: [] as Leaf[], loose: group?.items || [], sections }
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
function persist() {
  localStorage.setItem(NAV_KEY, JSON.stringify({ mode: mode.value, pinned: pinned.value, menuOpen: menuOpen.value, openeds: openeds.value, expandedMode: expandedMode.value }))
}
function groupKeyOf(index: string) {
  return props.groups.find((group) => group.items.some((item) => item.index === index) || group.sections.some((section) => section.items.some((item) => item.index === index)))?.key || ''
}
function setMode(next: NavMode, options?: { preserveDock?: boolean }) {
  if (next === 'dual' || next === 'single') expandedMode.value = next
  if (next !== 'single') ignoreMenuEvents = true
  if (next === 'single') {
    const visible = visibleKeySet()
    const merged = openeds.value.filter((key) => visible.has(key))
    for (const key of placeKeys()) if (visible.has(key) && !merged.includes(key)) merged.push(key)
    openeds.value = merged
  }
  mode.value = next
  hoverKey.value = ''
  layoutOpen.value = false
  if (next === 'dual' && !options?.preserveDock) menuOpen.value = true
  persist()
  nextTick(() => {
    ignoreMenuEvents = false
  })
}
function toggleFold() {
  if (mode.value === 'icons') {
    setMode(expandedMode.value, { preserveDock: true })
    return
  }
  expandedMode.value = mode.value
  setMode('icons', { preserveDock: true })
}
function placeLayout() {
  const button = layoutBtnRef.value
  if (!button) return
  const rect = button.getBoundingClientRect()
  const left = Math.min(rect.right + 6, window.innerWidth - 132)
  layoutStyle.value = { left: `${Math.round(left)}px`, bottom: `${Math.round(window.innerHeight - rect.bottom)}px` }
}
function toggleLayout() {
  layoutOpen.value = !layoutOpen.value
  if (layoutOpen.value) nextTick(placeLayout)
}
function chooseLayout(next: NavMode) {
  setMode(next)
}
function onMenuOpen(index: string) {
  if (ignoreMenuEvents || mode.value !== 'single' || openeds.value.includes(index)) return
  openeds.value = [...openeds.value, index]
}
function onMenuClose(index: string) {
  if (ignoreMenuEvents || mode.value !== 'single') return
  openeds.value = openeds.value.filter((key) => key !== index)
}
function onMenuSelect(index: string) {
  if (!index.startsWith('/')) return
  const target = router.resolve(index)
  if (target.fullPath !== router.currentRoute.value.fullPath) void router.push(target)
}
function togglePin() {
  const key = shownKey.value || props.currentGroup
  if (!key) return
  if (pinned.value && heldKey.value === key) {
    pinned.value = false
    heldKey.value = ''
  } else {
    pinned.value = true
    heldKey.value = key
    hoverKey.value = ''
  }
  persist()
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
  if (pinned.value && heldKey.value === key) {
    pinned.value = false
    heldKey.value = ''
    hoverKey.value = ''
    persist()
    return
  }
  pinned.value = true
  heldKey.value = key
  hoverKey.value = ''
  persist()
}
function hrefOf(index: string) {
  return router.resolve(index).href
}
function closePanel() {
  pinned.value = false
  heldKey.value = ''
  hoverKey.value = ''
  persist()
}
function go(event: MouseEvent, index: string) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  const target = router.resolve(index)
  if (target.fullPath !== router.currentRoute.value.fullPath) void router.push(target)
  hoverKey.value = ''
  if (pinned.value) {
    heldKey.value = groupKeyOf(index) || heldKey.value
    return
  }
  heldKey.value = ''
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
  if (layoutOpen.value) {
    layoutOpen.value = false
    return
  }
  closePanel()
}
function onFocusOut(event: FocusEvent) {
  if (!popped.value || pinned.value) return
  const next = event.relatedTarget as Node | null
  if (next && wrapRef.value?.contains(next)) return
  hoverKey.value = ''
  heldKey.value = ''
}
function isTypingTarget(target: EventTarget | null) {
  const node = target as HTMLElement | null
  if (!node?.closest) return false
  const tag = node.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || node.isContentEditable) return true
  return Boolean(node.closest('.el-dialog, .el-message-box, .el-overlay, .el-popper, .context-menu'))
}
function onDocPointerDown(event: PointerEvent) {
  const target = event.target as Node | null
  if (layoutOpen.value) {
    const inPop = Boolean(target && layoutPopRef.value?.contains(target))
    const inBtn = Boolean(target && layoutBtnRef.value?.contains(target))
    if (!inPop && !inBtn) layoutOpen.value = false
  }
  if (!shownKey.value || mode.value === 'single') return
  if (target && wrapRef.value?.contains(target)) return
  if (target instanceof Element && target.closest('#iyge-nav-fold')) return
  closePanel()
}
function onDocKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  if (layoutOpen.value) {
    layoutOpen.value = false
    return
  }
  if (!shownKey.value) return
  if (isTypingTarget(event.target)) return
  if (wrapRef.value?.contains(event.target as Node)) return
  closePanel()
}
watch([mode, pinned, menuOpen, openeds, expandedMode], persist)
watch(
  () => props.currentGroup,
  (group) => {
    if (pinned.value && group && !heldKey.value) heldKey.value = group
  },
  { immediate: true },
)
watch(
  () => props.groups.map((group) => group.key).join('|'),
  () => {
    if (hoverKey.value && !props.groups.some((group) => group.key === hoverKey.value)) hoverKey.value = ''
    if (heldKey.value && !props.groups.some((group) => group.key === heldKey.value)) heldKey.value = ''
    const visible = visibleKeySet()
    const next = openeds.value.filter((key) => visible.has(key))
    if (next.length !== openeds.value.length) openeds.value = next
  },
)
watch(
  () => props.active,
  () => {
    if (mode.value !== 'single') return
    const visible = visibleKeySet()
    const extra = placeKeys().filter((key) => visible.has(key) && !openeds.value.includes(key))
    if (!extra.length) return
    openeds.value = [...openeds.value, ...extra]
    nextTick(() => {
      for (const key of extra) {
        try {
          menuRef.value?.open(key)
        } catch {
          // 分组尚未挂载时不打断导航
        }
      }
    })
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
.nav-column { width: 96px; flex: none; height: 100%; min-height: 0; background: var(--nav-bg); color: var(--nav-text); display: flex; flex-direction: column; }
.nav-column.is-single { width: 228px; }
.nav-column.is-icons { width: 56px; }
.rail, .sider { width: 100%; flex: 1; min-height: 0; background: var(--nav-bg); color: var(--nav-text); display: flex; flex-direction: column; }
.rail.is-icons .rail-btn { min-height: 48px; gap: 0; padding: 8px 0; }
.rail.is-icons .rail-btn span { display: none; }
.nav-column.is-icons .nav-tool-label { display: none; }
.nav-column.is-icons .nav-tool-mark { display: inline; }
.nav-tool-mark { display: none; font-size: 16px; line-height: 1; }
.nav-fold { width: 40px; height: 40px; min-width: 32px; min-height: 32px; border: 0; border-radius: 4px; background: transparent; color: var(--text-primary); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex: none; }
.nav-fold:hover { background: var(--hover-bg); }
.nav-fold:focus-visible { outline: 2px solid var(--app-accent); outline-offset: 1px; }
.nav-dock { flex: none; display: flex; flex-direction: column; gap: 4px; padding: 6px; }
.nav-tool, .nav-text-btn { border: 0; background: transparent; color: var(--nav-text); cursor: pointer; font-size: 12px; line-height: 1.2; }
.nav-tool { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; min-height: 32px; padding: 6px 4px; border-radius: 6px; }
.nav-tool:hover, .nav-text-btn:hover { background: var(--nav-hover); color: var(--text-primary); }
.nav-tool:focus-visible { outline: 2px solid var(--app-accent); outline-offset: -2px; }
.layout-pop { position: fixed; z-index: 80; min-width: 120px; padding: 4px; border-radius: 8px; background: var(--flyout-bg); color: var(--flyout-text); border: 1px solid var(--flyout-border); box-shadow: var(--shadow-pop); }
.layout-option { display: block; width: 100%; text-align: left; border: 0; background: transparent; color: inherit; border-radius: 6px; padding: 8px 10px; cursor: pointer; font-size: 13px; }
.layout-option:hover { background: var(--flyout-hover); }
.layout-option.is-current { background: var(--flyout-current-bg); color: var(--flyout-current-text); }
.layout-option:focus-visible { outline: 2px solid var(--app-accent); outline-offset: -2px; }
.sider-brand { height: 56px; flex: none; display: flex; align-items: center; gap: 10px; padding: 0 16px; background: var(--nav-bg-deep); overflow: hidden; }
.sider-brand strong { font-size: 15px; font-weight: 650; color: var(--text-primary); white-space: nowrap; }
.sider-scroll { flex: 1; min-height: 0; overflow-x: hidden; overflow-y: auto; }
.sider-scroll::-webkit-scrollbar { width: 6px; }
.sider-scroll::-webkit-scrollbar-thumb { background: var(--border-default); border-radius: 3px; }
.sider :deep(.el-menu) { --el-menu-bg-color: var(--nav-bg); --el-menu-text-color: var(--nav-text); --el-menu-hover-bg-color: var(--nav-hover); --el-menu-hover-text-color: var(--text-primary); --el-menu-active-color: var(--nav-current-text); --el-menu-item-height: 42px; --el-menu-sub-item-height: 42px; --el-menu-item-font-size: 14px; border-right: 0; width: 100%; background: var(--nav-bg); }
.sider :deep(.el-menu-item),
.sider :deep(.el-sub-menu__title) { color: var(--nav-text); }
.sider :deep(.el-menu--inline) { background: var(--nav-bg-deep); }
.sider :deep(.el-sub-menu.is-active > .el-sub-menu__title) { color: var(--app-accent); }
.sider :deep(.el-menu-item.is-active),
.sider :deep(.el-menu-item.is-active:hover) { background: var(--nav-current-bg) !important; color: var(--nav-current-text) !important; }
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
.flyout.is-dock { position: relative; height: 100%; width: 240px; flex: none; border-right: 1px solid var(--flyout-border); }
.flyout.is-dock.is-grid { width: max-content; max-width: min(22rem, 42vw); }
.flyout-head { flex: none; display: flex; align-items: center; gap: 8px; padding: 14px 12px 8px; }
.nav-text-btn { flex: none; padding: 4px 6px; border-radius: 6px; color: var(--app-accent); }
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
