<template>
  <div class="layout" :class="{ 'compact-workbench': temporaryCompact }" :inert="dataBusy" :aria-busy="dataBusy" data-nav="flyout">
    <RailNav :groups="groups" :active="active" :current-group="currentPlace.group" :temporary-compact="temporaryCompact" />
    <section class="main">
      <header class="topbar">
        <div class="topbar-left">
          <div id="iyge-nav-fold"></div>
          <div class="crumb">{{ title }}</div>
        </div>
        <div class="row-actions">
          <PageAssist :path="route.path" :query-panel="route.query.panel" />
          <el-select :model-value="store.data.activeRole" :disabled="dataBusy" size="small" style="width: 130px" @change="onRole">
            <el-option label="身份：管理员" value="admin" />
            <el-option label="身份：运营" value="operator" />
          </el-select>
          <button type="button" class="theme-switch" :title="themeTitle" :aria-label="themeTitle" @click="onToggleTheme">
            <el-icon :size="16"><Sunny v-if="theme === 'dark'" /><Moon v-else /></el-icon>
          </button>
          <el-dropdown :disabled="dataBusy">
            <el-button size="small" :loading="dataBusy">演示数据</el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-if="!route.path.startsWith('/benefit-packages')" :disabled="dataBusy" @click="resetCurrent">重置当前模块</el-dropdown-item>
                <el-dropdown-item :disabled="dataBusy" @click="resetAll">重置全部演示数据</el-dropdown-item>
                <el-dropdown-item :disabled="dataBusy" @click="download">导出演示数据</el-dropdown-item>
                <el-dropdown-item :disabled="dataBusy" @click="pickFile">导入演示数据</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <input ref="fileRef" type="file" accept="application/json" hidden @change="onImport" />
        </div>
      </header>
      <div class="demo-strip">演示数据只保存在这台浏览器里。不会连接客户数据库，也不会改线上商品。</div>
      <main class="content">
        <router-view :key="['spu-new', 'spu-edit', 'sku-new', 'sku-edit', 'benefit-package-new', 'benefit-package-edit', 'benefit-delivery'].includes(String(route.name)) ? route.fullPath : route.name" />
      </main>
    </section>
  </div>
</template>

<script setup lang="ts">
import { Goods, Moon, Setting, SetUp, Sunny } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, markRaw, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Component } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute } from 'vue-router'
import { canAccessLocation, menuRevision, railModel } from '../domain/menuConfig'
import { useCatalogStore } from '../stores/catalog'
import type { UserRole } from '../domain/types'
import PageAssist from '../components/PageAssist.vue'
import RailNav from './RailNav.vue'
import { applyTheme, readTheme, type AppTheme } from '../theme'

const ICONS: Record<string, Component> = { product: Goods, tools: SetUp, system: Setting }

const store = useCatalogStore()
const route = useRoute()
const dataBusy = ref(false)
const workbenchMedia = window.matchMedia('(max-width: 700px)')
const narrowWorkbench = ref(workbenchMedia.matches)
const temporaryCompact = computed(() => narrowWorkbench.value && (route.path.startsWith('/benefit-packages') || route.path === '/compatibility'))
const updateWorkbenchMedia = (event: MediaQueryListEvent) => { narrowWorkbench.value = event.matches }
onMounted(() => workbenchMedia.addEventListener('change', updateWorkbenchMedia))
onBeforeUnmount(() => workbenchMedia.removeEventListener('change', updateWorkbenchMedia))
const theme = ref<AppTheme>(readTheme())
const themeTitle = computed(() => (theme.value === 'dark' ? '当前暗黑模式，切换为明亮模式' : '当前明亮模式，切换为暗黑模式'))
function onToggleTheme() {
  const next: AppTheme = theme.value === 'dark' ? 'light' : 'dark'
  theme.value = next
  applyTheme(next)
}
const fileRef = ref<HTMLInputElement>()
const title = computed(() => String(route.meta.title || '商品配置'))
const active = computed(() => {
  if (['/products', '/spus', '/skus'].includes(route.path) && route.query.panel === 'columns') return '/products?panel=columns'
  if (route.path.startsWith('/products') || route.path.startsWith('/spus') || route.path.startsWith('/materials')) return '/spus'
  if (route.path.startsWith('/skus')) return '/skus'
  if (route.path.startsWith('/benefit-packages')) return '/benefit-packages'
  if (route.path.startsWith('/specs')) return '/specs'
  return route.path || '/'
})

const groups = computed(() => {
  menuRevision.value
  return railModel(store.data.activeRole).map((group) => ({
    ...group,
    icon: markRaw(ICONS[group.key] || Setting),
  }))
})

const currentPlace = computed(() => {
  const current = active.value
  for (const group of groups.value) {
    if (group.items.some((item) => item.index === current)) return { group: group.key, section: '' }
    for (const section of group.sections) {
      if (section.items.some((item) => item.index === current)) return { group: group.key, section: section.key }
    }
  }
  return { group: '', section: '' }
})

function onRole(value: string) {
  if (dataBusy.value) return
  const role = value as UserRole
  store.setRole(role)
  if ((route.meta.admin && role !== 'admin') || !canAccessLocation(role, route.path, { panel: route.query.panel })) location.assign('/')
}

const moduleOf = computed(() => {
  const path = route.path
  if (path.startsWith('/products') || path.startsWith('/spus') || path.startsWith('/skus') || path.startsWith('/materials') || path.startsWith('/import') || path.startsWith('/compatibility') || path === '/' || path.startsWith('/check') || path.startsWith('/overview')) return 'products' as const
  if (path.startsWith('/categories') || path.startsWith('/mappings')) return 'categories' as const
  if (path.startsWith('/templates') || path.startsWith('/specs') || path.startsWith('/models')) return 'templates' as const
  if (path.startsWith('/params')) return 'params' as const
  if (path.startsWith('/rules')) return 'rules' as const
  if (path.startsWith('/groups')) return 'groups' as const
  return 'system' as const
})

async function resetAll() {
  if (dataBusy.value) return
  dataBusy.value = true
  try {
    await ElMessageBox.confirm('全部演示数据会恢复到初始样例，本机改过的内容会丢掉。', '重置全部')
    const result = await store.resetAll()
    if (!result.ok) { ElMessage.error(result.message); return }
    ElMessage.success('已恢复预设演示数据')
  } catch (cause) { if (cause !== 'cancel' && cause !== 'close') ElMessage.error(cause instanceof Error ? cause.message : '重置未完成，原数据保持。') }
  finally { dataBusy.value = false }
}
async function resetCurrent() {
  if (dataBusy.value) return
  const targetModule = moduleOf.value
  dataBusy.value = true
  try {
    await ElMessageBox.confirm('只恢复当前这一块的预设数据。', '重置当前模块')
    const result = await store.resetModule(targetModule)
    if (!result.ok) { ElMessage.error(result.message); return }
    ElMessage.success('当前模块已恢复')
  } catch (cause) { if (cause !== 'cancel' && cause !== 'close') ElMessage.error(cause instanceof Error ? cause.message : '重置未完成，原数据保持。') }
  finally { dataBusy.value = false }
}
function download() {
  if (dataBusy.value) return
  const blob = new Blob([store.exportJson()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'iyge-v2-mock-data.json'
  link.click()
  URL.revokeObjectURL(url)
}
function pickFile() {
  if (dataBusy.value) return
  fileRef.value?.click()
}
async function onImport(event: Event) {
  if (dataBusy.value) return
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  dataBusy.value = true
  try {
    ;(await store.importJson(await file.text()))
    ElMessage.success('已导入演示数据')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '导入失败')
  } finally { dataBusy.value = false; (event.target as HTMLInputElement).value = '' }
}
onBeforeRouteLeave(() => !dataBusy.value)
onBeforeRouteUpdate(() => !dataBusy.value)
const beforeUnload = (event: BeforeUnloadEvent) => { if (dataBusy.value) { event.preventDefault(); event.returnValue = '' } }
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
</script>

<style scoped>
.compact-workbench .content { padding:12px 12px 24px; }
.compact-workbench .topbar { height:auto; min-height:56px; flex-wrap:wrap; padding:6px 8px; gap:4px 8px; }
.compact-workbench .topbar>.row-actions { gap:4px; justify-content:flex-end; }
.compact-workbench .topbar-left { flex:1; }
.compact-workbench .demo-strip { padding:8px 12px; font-size:12px; line-height:1.5; }
</style>
