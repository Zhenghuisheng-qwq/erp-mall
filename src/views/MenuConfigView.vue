<template>
  <div>
    <PageHead title="菜单配置" desc="这是前端演示权限。改的是菜单名称、层级和角色可见性，不会改页面地址，也不是服务器上的正式权限。">
      <el-button @click="reload">取消</el-button>
      <el-button @click="restore">恢复默认</el-button>
      <el-button type="primary" @click="save">保存</el-button>
    </PageHead>
    <div class="menu-layout">
      <section class="panel">
        <div class="menu-tools">
          <el-select v-model="newParent" style="width: 180px">
            <el-option v-for="item in centers" :key="item.id" :label="item.title" :value="item.id" />
          </el-select>
          <el-input v-model="newTitle" placeholder="新分组名称" style="width: 180px" @keyup.enter="createGroup" />
          <el-button @click="createGroup">新增分组</el-button>
        </div>
        <div v-for="item in rows" :key="item.id" class="menu-row" :style="{ paddingLeft: `${item.depth * 22}px` }">
          <el-input v-model="item.node.title" />
          <span class="menu-kind">{{ kindText(item.node.kind) }}</span>
          <span class="menu-route">{{ item.node.route || '—' }}</span>
          <el-select :model-value="item.node.parentId || ''" :disabled="item.node.kind === 'center'" style="width: 160px" @change="onParent(item.node, $event)">
            <el-option v-for="parent in parentsFor(item.node)" :key="parent.id" :label="parent.title" :value="parent.id" />
          </el-select>
          <el-button :disabled="!canMove(item.node, -1)" @click="shift(item.node.id, -1)">上移</el-button>
          <el-button :disabled="!canMove(item.node, 1)" @click="shift(item.node.id, 1)">下移</el-button>
          <el-switch v-model="item.node.hidden" active-text="隐藏" inactive-text="显示" />
          <el-checkbox :model-value="item.node.roles.includes('operator')" @change="onOperator(item.node, Boolean($event))">运营可访问</el-checkbox>
          <el-button v-if="item.node.kind === 'group'" link type="danger" @click="dropGroup(item.node)">删除</el-button>
        </div>
      </section>
      <aside class="panel">
        <h2>预览</h2>
        <el-radio-group v-model="previewRole" size="small">
          <el-radio-button value="admin">管理员</el-radio-button>
          <el-radio-button value="operator">运营</el-radio-button>
        </el-radio-group>
        <p v-for="(line, index) in preview" :key="index" :style="{ paddingLeft: `${line.depth * 16}px` }">{{ line.title }}</p>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, ref } from 'vue'
import PageHead from '../components/PageHead.vue'
import { addGroup, changeParent, childrenOf, descendantIds, loadMenu, moveSibling, previewLines, removeGroup, resetMenu, saveMenu, type MenuKind, type MenuNode } from '../domain/menuConfig'
import type { UserRole } from '../domain/types'

const draft = ref<MenuNode[]>(loadMenu())
const newParent = ref('product')
const newTitle = ref('')
const previewRole = ref<UserRole>('operator')
const centers = computed(() => draft.value.filter((item) => item.kind === 'center'))
const rows = computed(() => {
  const list: { id: string; depth: number; node: MenuNode }[] = []
  function walk(parentId: string | null, depth: number) {
    for (const node of childrenOf(draft.value, parentId)) {
      list.push({ id: node.id, depth, node })
      walk(node.id, depth + 1)
    }
  }
  walk(null, 0)
  return list
})
const preview = computed(() => previewLines(draft.value, previewRole.value))

function kindText(kind: MenuKind) {
  if (kind === 'center') return '一级中心'
  if (kind === 'group') return '二级分组'
  return '页面'
}
function parentsFor(node: MenuNode) {
  const blocked = new Set([node.id, ...descendantIds(draft.value, node.id)])
  return draft.value.filter((item) => {
    if (blocked.has(item.id)) return false
    if (node.kind === 'group') return item.kind === 'center'
    if (node.kind === 'page') return item.kind === 'center' || item.kind === 'group'
    return false
  })
}
function canMove(node: MenuNode, direction: -1 | 1) {
  const siblings = childrenOf(draft.value, node.parentId)
  const index = siblings.findIndex((item) => item.id === node.id)
  return index + direction >= 0 && index + direction < siblings.length
}
function shift(id: string, direction: -1 | 1) {
  draft.value = moveSibling(draft.value, id, direction)
}
function onParent(node: MenuNode, parentId: string) {
  const result = changeParent(draft.value, node.id, parentId)
  if (!result.ok) {
    ElMessage.warning(result.message)
    return
  }
  draft.value = result.nodes
}
function onOperator(node: MenuNode, enabled: boolean) {
  node.roles = enabled ? ['admin', 'operator'] : ['admin']
}
function createGroup() {
  const result = addGroup(draft.value, newParent.value, newTitle.value)
  if (!result.ok) {
    ElMessage.warning(result.message)
    return
  }
  draft.value = result.nodes
  newTitle.value = ''
  ElMessage.success('已加入草稿，保存后才会生效')
}
async function dropGroup(node: MenuNode) {
  const result = removeGroup(draft.value, node.id)
  if (!result.ok) {
    ElMessage.warning(result.message)
    return
  }
  try {
    await ElMessageBox.confirm(`删除空分组「${node.title}」？`, '删除分组', { type: 'warning' })
  } catch {
    return
  }
  draft.value = result.nodes
}
function reload() {
  draft.value = loadMenu()
  ElMessage.success('已取消未保存的修改')
}
async function restore() {
  try {
    await ElMessageBox.confirm('菜单恢复成系统默认。商品演示数据不会被清空。', '恢复默认菜单', { type: 'warning' })
  } catch {
    return
  }
  draft.value = resetMenu()
  ElMessage.success('已恢复默认菜单')
}
function save() {
  draft.value = saveMenu(draft.value)
  ElMessage.success('菜单已保存在这台浏览器')
}
</script>

<style scoped>
.menu-layout { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 14px; align-items: start; }
.menu-tools, .menu-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
.menu-row .el-input { width: 180px; }
.menu-kind, .menu-route { flex: none; width: 72px; color: var(--text-secondary); font-size: 12px; }
.menu-route { width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.panel p { margin: 6px 0; font-size: 14px; }
@media (max-width: 1100px) { .menu-layout { grid-template-columns: 1fr; } }
</style>
