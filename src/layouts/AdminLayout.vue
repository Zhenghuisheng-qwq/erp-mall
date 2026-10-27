<template>
  <div class="layout" :class="{ 'compact-workbench': temporaryCompact }" :inert="dataBusy" :aria-busy="dataBusy" data-nav="flyout">
    <RailNav :groups="groups" :active="active" :current-group="currentPlace.group" :temporary-compact="temporaryCompact" />
    <section class="main">
      <RuleExplanation v-if="importFailure" :failure="importFailure" :supported-recovery="[]" />
      <header class="topbar">
        <div class="topbar-left">
          <el-button v-if="catalogReturn" size="small" data-catalog-return @click="router.push(catalogReturn)">返回商品资料管理</el-button>
          <div class="crumb">{{ title }}</div>
        </div>
        <div class="row-actions">
            <PageAssist :path="route.path" :full-path="route.fullPath" :title="title" :query-panel="route.query.panel" />
          <el-tag v-if="!store.rbacEnforced" effect="plain" title="当前统一按超级管理员运行，权限限制暂未启用">超级管理员</el-tag>
          <el-select v-else :model-value="store.previewUserId || store.activeUserId" :disabled="dataBusy" size="small" style="width:180px" aria-label="模拟用户" @change="onUser">
            <el-option v-for="user in store.data.users" :key="user.id" :label="`模拟用户：${user.displayName}`" :value="user.id" :disabled="!user.enabled || (!canSwitchUser && user.id !== store.activeUserId)" />
          </el-select>
          <el-button v-if="store.rbacEnforced && (store.previewUserId || store.simulationReturnId)" size="small" @click="store.stopPermissionPreview()">退出权限预览／模拟</el-button>
          <button type="button" class="theme-switch" :title="themeTitle" :aria-label="themeTitle" @click="onToggleTheme">
            <el-icon :size="16"><Sunny v-if="theme === 'dark'" /><Moon v-else /></el-icon>
          </button>
          <el-dropdown :disabled="dataBusy">
            <el-button size="small" :loading="dataBusy">演示数据</el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-if="store.isAdmin && !route.path.startsWith('/benefit-packages')" :disabled="dataBusy" @click="resetCurrent">重置当前模块</el-dropdown-item>
                <el-dropdown-item v-if="store.isAdmin" :disabled="dataBusy" @click="resetAll">重置全部演示数据</el-dropdown-item>
                <el-dropdown-item v-if="store.can('product:export:execute')" :disabled="dataBusy" @click="download">导出演示数据</el-dropdown-item>
                <el-dropdown-item v-if="store.can('product:import:execute')" :disabled="dataBusy" @click="pickFile">导入演示数据</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <input ref="fileRef" type="file" accept="application/json" hidden @change="onImport" />
        </div>
      </header>
      <div class="demo-strip">演示数据只保存在这台浏览器里。不会连接客户数据库，也不会改线上商品。</div>
      <main class="content">
        <RuleExplanation v-if="store.persistenceState.failure" :failure="store.persistenceState.failure" :supported-recovery="[]" />
        <router-view :key="['spu-new', 'spu-edit', 'sku-new', 'sku-edit', 'benefit-package-new', 'benefit-package-edit', 'benefit-delivery'].includes(String(route.name)) ? route.fullPath : route.name" />
      </main>
    </section>
  </div>
</template>

<script setup lang="ts">
import RuleExplanation from '../components/guide/RuleExplanation.vue'
import { getFailure } from '../domain/guide/failure'
import type { GuideFailure } from '../domain/guide/types'
import { Goods, Moon, Setting, SetUp, Sunny, Notebook } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, markRaw, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Component } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import { menuRouteForLocation, menuRevision, railModel } from '../domain/menuConfig'
import {compatibilityPageTitle} from '../domain/compatibilityNavigation'
import { useCatalogStore } from '../stores/catalog'
import { isSuperAdmin } from '../domain/rbac'
import PageAssist from '../components/PageAssist.vue'
import RailNav from './RailNav.vue'
import { applyTheme, readTheme, type AppTheme } from '../theme'
import { catalogReturnLocation, firstReadableCatalogView } from '../domain/catalogWorkspaceNavigation'

const ICONS: Record<string, Component> = { product: Goods, tools: SetUp, system: Setting, guide: Notebook }

const store = useCatalogStore()
const route = useRoute(), router = useRouter()
const catalogReturn = computed(() => !['/catalog','/categories','/specs'].includes(route.path) ? catalogReturnLocation(route.query.returnTo) : undefined)
const canSwitchUser=computed(()=>isSuperAdmin(store.data,store.activeUserId))
const dataBusy = ref(false)
const importFailure=ref<GuideFailure>()
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
const title = computed(() => route.path==='/compatibility'?compatibilityPageTitle(route.query.tab):String(route.meta.title || '商品配置'))
const active = computed(() => menuRouteForLocation(route.path, route.query))

const groups = computed(() => {
  menuRevision.value
  return railModel(location=>store.canRoute(location)).map((group) => ({
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

function onUser(id:string){const result=store.simulateUser(id);if(!result.ok)ElMessage.error(result.message||'切换被拒绝')}
watch(()=>[store.persistenceState.external,store.activeUserId,store.previewUserId,JSON.stringify(store.data.rbac),JSON.stringify(store.data.users)],()=>{
  if(route.path==='/forbidden'||store.canRoute({path:route.path,query:route.query}))return
  if(route.path==='/catalog'){
    const next=firstReadableCatalogView(code=>store.can(code))
    if(next){void router.replace({path:'/catalog',query:{view:next}});return}
  }
  ElMessage.warning('当前用户的访问授权已失效，请选择有权限的入口。')
  void router.replace({path:'/forbidden',query:{from:route.fullPath}})
})

const moduleOf = computed(() => {
  const path = route.path
  if (path.startsWith('/products') || path.startsWith('/spus') || path.startsWith('/skus') || path.startsWith('/materials') || path.startsWith('/import') || path.startsWith('/compatibility') || path === '/' || path.startsWith('/check') || path.startsWith('/overview')) return 'products' as const
  if (path.startsWith('/categories') || path.startsWith('/mappings') || path === '/catalog' && (!route.query.view || route.query.view === 'categories' || route.query.view === 'types')) return 'categories' as const
  if (path.startsWith('/templates') || path.startsWith('/specs') || path.startsWith('/models') || path === '/catalog') return 'templates' as const
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
  if (!store.can('product:import:execute')) ElMessage.info('运营导入仍受只读权限约束，不能修改业务目录、节点配置、物料关联、权益包框架、参考价格或历史冻结信息。')
  fileRef.value?.click()
}
async function onImport(event: Event) {
  if (dataBusy.value) return
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  dataBusy.value = true
  try {
    ;(await store.importJson(await file.text()))
    importFailure.value=undefined;ElMessage.success('已导入演示数据')
  } catch (error) {
    importFailure.value=getFailure(error);ElMessage.error(error instanceof Error ? error.message : '导入失败')
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
