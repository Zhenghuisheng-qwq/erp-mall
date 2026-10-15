<template>
  <div class="layout">
    <aside class="sider" :class="{ 'is-collapse': collapsed }">
      <div class="brand">
        <span class="brand-mark">商</span>
        <div class="brand-copy">
          <strong>商品配置</strong>
          <span>演示版</span>
        </div>
      </div>
      <div class="sider-scroll">
        <el-menu
          ref="menuRef"
          :default-active="active"
          :default-openeds="initialOpeneds"
          :collapse="collapsed"
          :collapse-transition="false"
          popper-class="iyge-menu-popup"
          background-color="#304156"
          text-color="#bfcbd9"
          active-text-color="#ffffff"
          router
          @open="onOpen"
          @close="onClose"
        >
          <el-sub-menu v-for="group in groups" :key="group.key" :index="group.key">
            <template #title>
              <el-icon><component :is="group.icon" /></el-icon>
              <span>{{ group.title }}</span>
            </template>
            <el-menu-item v-for="item in group.items" :key="item.index" :index="item.index">{{ item.title }}</el-menu-item>
            <el-sub-menu v-for="section in group.sections" :key="section.key" :index="section.key">
              <template #title>{{ section.title }}</template>
              <el-menu-item v-for="item in section.items" :key="item.index" :index="item.index">{{ item.title }}</el-menu-item>
            </el-sub-menu>
          </el-sub-menu>
        </el-menu>
      </div>
    </aside>
    <section class="main">
      <header class="topbar">
        <div class="topbar-left">
          <button type="button" class="collapse-btn" :title="collapsed ? '展开菜单' : '收起菜单'" @click="toggleCollapse">
            <el-icon :size="18"><Expand v-if="collapsed" /><Fold v-else /></el-icon>
          </button>
          <div class="crumb">{{ title }}</div>
        </div>
        <div class="row-actions">
          <el-select :model-value="store.data.activeRole" size="small" style="width: 130px" @change="onRole">
            <el-option label="身份：管理员" value="admin" />
            <el-option label="身份：运营" value="operator" />
          </el-select>
          <el-dropdown>
            <el-button size="small">演示数据</el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="resetCurrent">重置当前模块</el-dropdown-item>
                <el-dropdown-item @click="resetAll">重置全部演示数据</el-dropdown-item>
                <el-dropdown-item @click="download">导出演示数据</el-dropdown-item>
                <el-dropdown-item @click="pickFile">导入演示数据</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <input ref="fileRef" type="file" accept="application/json" hidden @change="onImport" />
        </div>
      </header>
      <div class="demo-strip">演示数据只保存在这台浏览器里。不会连接客户数据库，也不会改线上商品。</div>
      <main class="content">
        <router-view />
      </main>
    </section>
  </div>
</template>

<script setup lang="ts">
import { Expand, Fold, Goods, Setting, SetUp } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, markRaw, nextTick, ref, watch } from 'vue'
import type { Component } from 'vue'
import { useRoute } from 'vue-router'
import { useCatalogStore } from '../stores/catalog'
import type { UserRole } from '../domain/types'

const COLLAPSE_KEY = 'iyge-v2-sider-collapsed'
const OPEN_KEY = 'iyge-v2-sider-open'

type MenuLeaf = { index: string; title: string; admin?: boolean }
type MenuSection = { key: string; title: string; admin?: boolean; items: MenuLeaf[] }
type MenuGroup = { key: string; title: string; icon: Component; admin?: boolean; items: MenuLeaf[]; sections: MenuSection[] }

const MENU: MenuGroup[] = [
  {
    key: 'product',
    title: '商品中心',
    icon: markRaw(Goods),
    items: [{ index: '/', title: '商品工作台' }],
    sections: [
      {
        key: 'manage',
        title: '商品管理',
        items: [
          { index: '/products', title: '商品列表' },
          { index: '/import', title: '商品导入导出' },
          { index: '/compatibility', title: '适用关系' },
          { index: '/categories', title: '商品分类中心' },
          { index: '/product-types', title: '产品类型' },
          { index: '/plans', title: '商品规划' },
        ],
      },
      {
        key: 'model',
        title: '商品模型配置',
        admin: true,
        items: [
          { index: '/templates', title: '属性方案', admin: true },
          { index: '/models', title: '商品模型' },
          { index: '/specs', title: '商品模型设计' },
          { index: '/params', title: '属性词典' },
          { index: '/rules', title: '规格约束', admin: true },
        ],
      },
      {
        key: 'operate',
        title: '商品运营',
        items: [
          { index: '/brands', title: '品牌中心' },
          { index: '/groups', title: '运营分组' },
        ],
      },
      {
        key: 'analysis',
        title: '商品分析',
        items: [
          { index: '/overview', title: '商品总览' },
          { index: '/check', title: '商品质量检查' },
        ],
      },
    ],
  },
  {
    key: 'tools',
    title: '开发工具',
    icon: markRaw(SetUp),
    admin: true,
    items: [
      { index: '/tree', title: '商品结构视图' },
      { index: '/products?panel=columns', title: '列配置与视图' },
    ],
    sections: [],
  },
  {
    key: 'system',
    title: '系统管理',
    icon: markRaw(Setting),
    admin: true,
    items: [
      { index: '/users', title: '用户管理', admin: true },
      { index: '/feedback', title: '反馈管理' },
      { index: '/account', title: '账号设置' },
    ],
    sections: [],
  },
]

const store = useCatalogStore()
const route = useRoute()
const fileRef = ref<HTMLInputElement>()
const menuRef = ref<{ open: (index: string) => void }>()
const collapsed = ref(localStorage.getItem(COLLAPSE_KEY) === '1')
const title = computed(() => String(route.meta.title || '商品配置'))
const active = computed(() => {
  if (route.path === '/products' && route.query.panel === 'columns') return '/products?panel=columns'
  if (route.path.startsWith('/products')) return '/products'
  if (route.path.startsWith('/specs')) return '/specs'
  return route.path || '/'
})

function canSee(admin?: boolean) {
  return !admin || store.data.activeRole === 'admin'
}

const groups = computed(() =>
  MENU.filter((group) => canSee(group.admin))
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canSee(item.admin)),
      sections: group.sections
        .filter((section) => canSee(section.admin))
        .map((section) => ({ ...section, items: section.items.filter((item) => canSee(item.admin)) }))
        .filter((section) => section.items.length > 0),
    }))
    .filter((group) => group.items.length > 0 || group.sections.length > 0),
)

function visibleMenuKeys() {
  const keys: string[] = []
  groups.value.forEach((group) => {
    keys.push(group.key)
    group.sections.forEach((section) => keys.push(section.key))
  })
  return keys
}

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

function readOpeneds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(OPEN_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

function resolveOpeneds() {
  const visible = visibleMenuKeys()
  const saved = localStorage.getItem(OPEN_KEY)
  const next = (saved === null ? ['product', 'manage'] : readOpeneds()).filter((key) => visible.includes(key))
  if (currentPlace.value.group && visible.includes(currentPlace.value.group) && !next.includes(currentPlace.value.group)) next.push(currentPlace.value.group)
  if (currentPlace.value.section && visible.includes(currentPlace.value.section) && !next.includes(currentPlace.value.section)) next.push(currentPlace.value.section)
  if (next.length === 0 && visible.includes('product')) next.push('product')
  return next
}

const openedKeys = ref(resolveOpeneds())
const initialOpeneds = openedKeys.value.slice()
localStorage.setItem(OPEN_KEY, JSON.stringify(openedKeys.value))

function persistOpeneds() {
  localStorage.setItem(OPEN_KEY, JSON.stringify(openedKeys.value))
}
let suppressClose = false
function onOpen(index: string) {
  if (collapsed.value) return
  if (!openedKeys.value.includes(index)) openedKeys.value = [...openedKeys.value, index]
  persistOpeneds()
}
function onClose(index: string) {
  if (collapsed.value || suppressClose) return
  openedKeys.value = openedKeys.value.filter((key) => key !== index)
  persistOpeneds()
}
function safeOpen(key: string) {
  try {
    menuRef.value?.open(key)
  } catch {
    // 分组尚未挂载时不打断导航
  }
}
function openVisible() {
  const visible = new Set(visibleMenuKeys())
  for (const key of openedKeys.value) {
    if (visible.has(key)) safeOpen(key)
  }
  if (currentPlace.value.group && visible.has(currentPlace.value.group)) safeOpen(currentPlace.value.group)
  if (currentPlace.value.section && visible.has(currentPlace.value.section)) safeOpen(currentPlace.value.section)
}
function toggleCollapse() {
  collapsed.value = !collapsed.value
}

watch(collapsed, (value) => {
  localStorage.setItem(COLLAPSE_KEY, value ? '1' : '0')
  if (value) return
  suppressClose = true
  nextTick(openVisible)
  window.setTimeout(() => {
    openVisible()
    suppressClose = false
  }, 360)
})
watch(active, () => {
  if (collapsed.value) return
  nextTick(() => {
    if (currentPlace.value.group) safeOpen(currentPlace.value.group)
    if (currentPlace.value.section) safeOpen(currentPlace.value.section)
  })
})
watch(
  () => store.data.activeRole,
  () => {
    openedKeys.value = resolveOpeneds()
    nextTick(openVisible)
  },
)

function onRole(value: string) {
  store.setRole(value as UserRole)
  if (value === 'operator' && route.meta.admin) location.assign('/')
}

const moduleOf = computed(() => {
  const path = route.path
  if (path.startsWith('/products') || path.startsWith('/import') || path.startsWith('/compatibility') || path === '/' || path.startsWith('/check') || path.startsWith('/overview')) return 'products' as const
  if (path.startsWith('/categories') || path.startsWith('/mappings')) return 'categories' as const
  if (path.startsWith('/templates') || path.startsWith('/specs') || path.startsWith('/models')) return 'templates' as const
  if (path.startsWith('/params')) return 'params' as const
  if (path.startsWith('/rules')) return 'rules' as const
  if (path.startsWith('/groups')) return 'groups' as const
  return 'system' as const
})

async function resetAll() {
  await ElMessageBox.confirm('全部演示数据会恢复到初始样例，本机改过的内容会丢掉。', '重置全部')
  store.resetAll()
  ElMessage.success('已恢复预设演示数据')
}
async function resetCurrent() {
  await ElMessageBox.confirm('只恢复当前这一块的预设数据。', '重置当前模块')
  store.resetModule(moduleOf.value)
  ElMessage.success('当前模块已恢复')
}
function download() {
  const blob = new Blob([store.exportJson()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'iyge-v2-mock-data.json'
  link.click()
  URL.revokeObjectURL(url)
}
function pickFile() {
  fileRef.value?.click()
}
async function onImport(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    store.importJson(await file.text())
    ElMessage.success('已导入演示数据')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '导入失败')
  }
}
</script>
