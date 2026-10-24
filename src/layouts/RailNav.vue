<template>
  <div ref="wrapRef" class="rail-wrap" :data-mode="mode">
    <div class="nav-column" :class="{ 'is-single': mode === 'single' || mode === 'center', 'is-icons': mode === 'icons' }">
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
            <el-menu-item v-for="item in group.items" :key="item.index" :index="item.index"><a :href="hrefOf(item.index)" :aria-current="active === item.index ? 'page' : undefined" @click.stop="go($event, item.index)">{{ item.title }}</a></el-menu-item>
            <el-sub-menu v-for="section in group.sections" :key="section.key" :index="section.key">
              <template #title>{{ section.title }}</template>
              <el-menu-item v-for="leaf in section.items" :key="leaf.index" :index="leaf.index"><a :href="hrefOf(leaf.index)" :aria-current="active === leaf.index ? 'page' : undefined" @click.stop="go($event, leaf.index)">{{ leaf.title }}</a></el-menu-item>
            </el-sub-menu>
          </el-sub-menu>
        </el-menu>
      </div>
    </aside>
    <aside v-else-if="mode === 'center'" class="sider" aria-label="当前中心菜单">
      <div class="sider-brand"><select aria-label="切换业务中心" :value="centerGroup?.key || ''" @change="switchCenter(($event.target as HTMLSelectElement).value)"><option v-for="group in groups" :key="group.key" :value="group.key">{{ group.title }}</option></select></div>
      <div class="sider-scroll" v-if="centerGroup">
        <el-menu :key="centerGroup.key" :default-active="active" :default-openeds="centerGroup.sections.map(s => s.key)">
          <el-menu-item v-for="item in centerGroup.items" :key="item.index" :index="item.index"><a :href="hrefOf(item.index)" @click.stop="go($event,item.index)">{{ item.title }}</a></el-menu-item>
          <el-sub-menu v-for="section in centerGroup.sections" :key="section.key" :index="section.key"><template #title>{{ section.title }}</template><el-menu-item v-for="item in section.items" :key="item.index" :index="item.index"><a :href="hrefOf(item.index)" @click.stop="go($event,item.index)">{{ item.title }}</a></el-menu-item></el-sub-menu>
        </el-menu>
      </div>
      <p v-else>当前角色没有可见菜单</p>
    </aside>
    <aside v-else-if="layout === 'center'" class="center-compact"><button class="nav-tool" aria-label="打开当前中心菜单" @click="onRailClick(centerGroup?.key || '',$event.currentTarget)">☰</button></aside>
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
          @click="onRailClick(group.key, $event.currentTarget)"
          @keydown="onRailKeydown($event, index)"
        >
          <el-icon :size="20"><component :is="group.icon" /></el-icon>
          <span>{{ group.title }}</span>
        </button>
      </div>
    </aside>
    <a v-if="canManageMenus" class="menu-recovery" :href="hrefOf('/menus')" @click="go($event,'/menus')" title="菜单配置" aria-label="菜单配置恢复入口">⚙</a>
    <nav class="nav-dock" aria-label="导航设置">
      <button ref="layoutBtnRef" type="button" class="nav-tool" aria-haspopup="menu" :aria-expanded="layoutOpen" aria-label="导航设置" title="导航设置" @click="toggleLayout">
        <span class="nav-tool-label">导航设置</span>
        <span v-if="mode === 'icons'" class="nav-tool-mark" aria-hidden="true">≡</span>
      </button>
    </nav>
    </div>
    <Teleport defer to="#iyge-nav-fold">
      <button type="button" class="nav-fold" data-nav-fold :aria-label="compactLabel" :title="compactLabel" :aria-expanded="temporaryCompact ? Boolean(shownGroup) : undefined" :aria-controls="temporaryCompact && shownGroup ? 'nav-flyout' : undefined" @click="toggleFold">
        <el-icon :size="18"><Expand v-if="mode === 'icons'" /><Fold v-else /></el-icon>
      </button>
    </Teleport>
    <Teleport to="body">
      <div v-if="layoutOpen" ref="layoutPopRef" class="layout-pop" role="menu" aria-label="导航设置" :style="layoutStyle">
        <button
          v-for="item in layoutChoices"
          :key="item.id"
          type="button"
          class="layout-option"
          role="menuitemradio"
          :aria-checked="layout === item.id"
          :class="{ 'is-current': layout === item.id }"
          @click="chooseLayout(item.id)"
        >{{ item.label }}</button>
      </div>
    </Teleport>
    <div
      v-if="mode !== 'single' && mode !== 'center' && shownGroup"
      id="nav-flyout"
      ref="flyoutRef"
      class="flyout"
      :class="{ 'is-pop': popped, 'is-dock': !popped, 'is-grid': flyoutLayout.mode === 'grid' }"
      :style="popped ? popStyle : undefined"
      role="navigation"
      :aria-label="shownGroup.title"
      @keydown="onFlyoutKeydown"
    >
      <header class="flyout-head">
        <select v-if="layout === 'center'" aria-label="切换业务中心" :value="shownGroup.key" @change="switchCenter(($event.target as HTMLSelectElement).value)"><option v-for="group in groups" :key="group.key" :value="group.key">{{ group.title }}</option></select><strong v-else>{{ shownGroup.title }}</strong>
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
import { useCatalogStore } from '../stores/catalog'
import { NAV_KEY, readNavigation, type NavigationLayout } from './navigationPreferences'

type Leaf = { index: string; title: string }
type Section = { key: string; title: string; items: Leaf[] }
export type RailGroup = { key: string; title: string; icon: Component; items: Leaf[]; sections: Section[] }

const props = defineProps<{
  groups: RailGroup[]
  active: string
  currentGroup: string
  temporaryCompact?: boolean
}>()

const router = useRouter()
const catalog = useCatalogStore()
const canManageMenus = computed(() => catalog.isAdmin)
const centerGroup = computed(() => props.groups.find(g => g.key === props.currentGroup) || props.groups[0])
function switchCenter(key: string) {
  const group = props.groups.find(g => g.key === key)
  const target = group?.items[0]?.index || group?.sections[0]?.items[0]?.index
  if (target) void router.push(target)
}
const wrapRef = ref<HTMLElement>()
const railRef = ref<HTMLElement>()
const flyoutRef = ref<HTMLElement>()
const menuRef = ref<{ open: (index: string) => void }>()
const layoutBtnRef = ref<HTMLButtonElement>()
const layoutPopRef = ref<HTMLElement>()
function visibleKeys() {
  return props.groups.flatMap(group => [group.key, ...group.sections.map(section => section.key)])
}
function placeKeys() {
  return props.groups.flatMap(group => [
    ...(group.key === props.currentGroup ? [group.key] : []),
    ...group.sections.filter(section => section.items.some(item => item.index === props.active)).map(section => section.key),
  ])
}
function storedPreferences() {
  try { return localStorage.getItem(NAV_KEY) } catch { return null }
}
const saved = readNavigation(storedPreferences(), visibleKeys(), placeKeys())
const layout = ref(saved.layout)
const collapsed = ref(saved.collapsed)
const openeds = ref(saved.openeds)
// A selected group in an expanded dual layout is transient, just like an icon flyout.
const openGroup = ref('')
const layoutOpen = ref(false)
const layoutStyle = ref({ left: '0px', bottom: '0px' })
const flyoutTop = ref(8)
const popLeft = ref(56)
let ignoreMenuEvents = false
const layoutChoices: { id: NavigationLayout; label: string }[] = [
  { id: 'single', label: '单栏导航' },
  { id: 'dual', label: '双栏导航' },
  { id: 'center', label: '仅当前中心菜单' },
]
const effectiveCollapsed = computed(() => collapsed.value || props.temporaryCompact === true)
const mode = computed(() => effectiveCollapsed.value ? 'icons' : layout.value)
const popped = computed(() => effectiveCollapsed.value)
const shownKey = computed(() => mode.value === 'single' ? '' : openGroup.value || (effectiveCollapsed.value ? '' : props.currentGroup || props.groups[0]?.key || ''))
const compactLabel = computed(() => props.temporaryCompact ? '打开导航菜单' : effectiveCollapsed.value ? '展开导航' : '收起导航')
const menuStamp = computed(() => visibleKeys().join('|'))
const shownGroup = computed(() => props.groups.find(group => group.key === shownKey.value) || null)
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

function persist() {
  try { localStorage.setItem(NAV_KEY, JSON.stringify({ layout: layout.value, collapsed: collapsed.value, openeds: openeds.value })) } catch { /* Storage may be unavailable; navigation still works. */ }
}
function revealCurrent() {
  const valid = new Set(visibleKeys())
  openeds.value = [...new Set([...openeds.value, ...placeKeys()])].filter(key => valid.has(key))
  nextTick(() => {
    if (mode.value === 'single') for (const key of placeKeys()) menuRef.value?.open(key)
  })
}
function transitionNavigation(change: () => void) {
  ignoreMenuEvents = true
  change()
  openGroup.value = ''
  layoutOpen.value = false
  if (!effectiveCollapsed.value) revealCurrent()
  nextTick(() => { ignoreMenuEvents = false })
}
function toggleFold(event: MouseEvent) {
  if (props.temporaryCompact) { onRailClick(props.currentGroup || props.groups[0]?.key || '', event.currentTarget); nextTick(() => flyoutRef.value?.querySelector<HTMLAnchorElement>('a')?.focus()); return }
  transitionNavigation(() => { collapsed.value = !collapsed.value })
}
function chooseLayout(next: NavigationLayout) {
  transitionNavigation(() => { layout.value = next })
  nextTick(() => layoutBtnRef.value?.focus())
}
function placeLayout() {
  const rect = layoutBtnRef.value?.getBoundingClientRect()
  if (rect) layoutStyle.value = { left: `${Math.max(8, Math.min(rect.right + 6, window.innerWidth - 160))}px`, bottom: `${Math.max(8, window.innerHeight - rect.bottom)}px` }
}
function toggleLayout() {
  layoutOpen.value = !layoutOpen.value
  if (layoutOpen.value) {
    if (effectiveCollapsed.value) closePanel(false)
    nextTick(() => { placeLayout(); layoutPopRef.value?.querySelector<HTMLButtonElement>('button')?.focus() })
  }
}
function onMenuOpen(index: string) {
  if (!ignoreMenuEvents && mode.value === 'single' && !openeds.value.includes(index)) openeds.value = [...openeds.value, index]
}
function onMenuClose(index: string) {
  if (!ignoreMenuEvents && mode.value === 'single') openeds.value = openeds.value.filter(key => key !== index)
}
function onMenuSelect(index: string) {
  if (index.startsWith('/') && router.resolve(index).fullPath !== router.currentRoute.value.fullPath) void router.push(index)
}
function groupButton(key: string) {
  return [...(railRef.value?.querySelectorAll<HTMLButtonElement>('[data-group]') || [])].find(button => button.dataset.group === key)
}
function placePop(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return
  popLeft.value = Math.round((railRef.value || wrapRef.value)?.getBoundingClientRect().right || 56)
  // Reserve useful vertical space even for groups near the bottom of a short viewport.
  flyoutTop.value = Math.max(8, Math.min(target.getBoundingClientRect().top, window.innerHeight - 360))
}
function onRailClick(key: string, target: EventTarget | null) {
  layoutOpen.value = false
  openGroup.value = effectiveCollapsed.value && openGroup.value === key ? '' : key
  if (effectiveCollapsed.value) placePop(target)
}
function hrefOf(index: string) { return router.resolve(index).href }
function closePanel(restoreFocus: boolean) {
  const key = openGroup.value
  openGroup.value = ''
  if (restoreFocus && key) groupButton(key)?.focus()
}
function go(event: MouseEvent, index: string) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  onMenuSelect(index)
  if (effectiveCollapsed.value) closePanel(true)
}
function onRailKeydown(event: KeyboardEvent, index: number) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    const buttons = railRef.value?.querySelectorAll<HTMLButtonElement>('.rail-btn')
    if (buttons?.length) buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus()
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    const key = props.groups[index]?.key
    if (!key) return
    openGroup.value = key
    placePop(event.currentTarget)
    nextTick(() => flyoutRef.value?.querySelector<HTMLAnchorElement>('a')?.focus())
  }
}
function onFlyoutKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    groupButton(shownKey.value)?.focus()
  }
}
function onDocPointerDown(event: PointerEvent) {
  const target = event.target as Node | null
  if (!target) return
  if (!layoutPopRef.value?.contains(target) && !layoutBtnRef.value?.contains(target)) layoutOpen.value = false
  if (effectiveCollapsed.value && !wrapRef.value?.contains(target) && !(target instanceof Element && target.closest('#iyge-nav-fold'))) closePanel(false)
}
function onDocKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.defaultPrevented) return
  const target = event.target instanceof HTMLElement ? event.target : null
  // Element Plus dialogs/dropdowns own Escape first; never intercept typing or their focus.
  if (target?.matches('input, textarea, select, [contenteditable="true"]') || target?.closest('.el-dialog, .el-message-box, .el-popper, .context-menu')) return
  if ([...document.querySelectorAll<HTMLElement>('.el-overlay, .el-popper')].some(node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden')) return
  if (layoutOpen.value) { layoutOpen.value = false; layoutBtnRef.value?.focus() }
  else if (effectiveCollapsed.value && openGroup.value) closePanel(true)
}
function onResize() {
  if (effectiveCollapsed.value && openGroup.value) placePop(groupButton(openGroup.value) || null)
  if (layoutOpen.value) placeLayout()
}
watch(() => props.temporaryCompact, () => { openGroup.value = ''; layoutOpen.value = false; nextTick(onResize) })
watch([layout, collapsed, openeds], persist)
watch(() => router.currentRoute.value.fullPath, () => { openGroup.value = ''; layoutOpen.value = false; revealCurrent() })
watch(menuStamp, () => {
  if (!props.groups.some(group => group.key === openGroup.value)) openGroup.value = ''
  revealCurrent()
})
onMounted(() => {
  revealCurrent()
  persist()
  document.addEventListener('pointerdown', onDocPointerDown)
  window.addEventListener('keydown', onDocKeydown)
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown)
  window.removeEventListener('keydown', onDocKeydown)
  window.removeEventListener('resize', onResize)
})
</script>

<style scoped>
.sider-brand select,.flyout-head select{width:100%;padding:8px;background:var(--nav-bg);color:var(--nav-text);border:1px solid var(--flyout-border);border-radius:6px}.center-compact{flex:1}.menu-recovery{color:var(--nav-text);text-align:center;text-decoration:none;padding:5px}

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
.nav-tool { border: 0; background: transparent; color: var(--nav-text); cursor: pointer; font-size: 12px; line-height: 1.2; }
.nav-tool { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; min-height: 32px; padding: 6px 4px; border-radius: 6px; }
.nav-tool:hover { background: var(--nav-hover); color: var(--text-primary); }
.nav-tool:focus-visible { outline: 2px solid var(--app-accent); outline-offset: -2px; }
.layout-pop { position: fixed; z-index: 80; min-width: 120px; padding: 4px; border-radius: 8px; background: var(--flyout-bg); color: var(--flyout-text); border: 1px solid var(--flyout-border); box-shadow: var(--shadow-pop); }
.layout-option { display: block; width: 100%; text-align: left; border: 0; background: transparent; color: inherit; border-radius: 6px; padding: 8px 10px; cursor: pointer; font-size: 13px; }
.layout-option:hover { background: var(--flyout-hover); }
.layout-option.is-current { background: var(--flyout-current-bg); color: var(--flyout-current-text); }
.layout-option:focus-visible { outline: 2px solid var(--app-accent); outline-offset: -2px; }
.sider-brand { height: 56px; flex: none; display: flex; align-items: center; gap: 10px; padding: 0 16px; background: var(--nav-bg-deep); overflow: hidden; }
.sider-brand strong { font-size: 15px; font-weight: 650; color: var(--text-primary); white-space: nowrap; }
.sider :deep(.el-menu-item a) { color: inherit; display: block; width: 100%; text-decoration: none; }
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
