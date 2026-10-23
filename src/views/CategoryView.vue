<template>
  <div>
    <PageHead title="商品分类中心" desc="默认只查看和展开分类。需要调整层级或顺序时，再打开编辑模式。" />
    <div class="cat-layout" :class="{ 'is-moving': moveOpen }">
      <section class="panel cat-tree-panel">
        <div class="cat-toolbar">
          <div class="cat-toolbar-ops">
            <el-radio-group v-model="treeMode">
              <el-radio-button value="view">查看模式</el-radio-button>
              <el-radio-button value="edit">编辑模式</el-radio-button>
            </el-radio-group>
            <el-button @click="expandAll">展开全部</el-button>
            <el-button @click="collapseAll">收起全部</el-button>
            <el-button v-if="editing" type="primary" @click="openCreate(null)">新增根分类</el-button>
          </div>
          <el-input v-model="keyword" class="cat-search" placeholder="搜索并定位分类" clearable />
        </div>
        <p class="muted">{{ editing ? '编辑模式：可拖动调整层级和顺序，双击名称直接改名。' : '查看模式：单击展开或收起，不能修改分类。' }}</p>
        <div v-if="rows.length" ref="treeScroll" class="cat-scroll">
          <div
            v-for="row in rows"
            :key="row.id"
            class="cat-row"
            :data-id="row.id"
            :class="{
              'is-active': row.id === selected,
              'is-located': row.id === locatedId,
              'is-editing': editing,
              'is-off': !row.enabled,
              'is-drop-before': dropState?.id === row.id && dropState.position === 'before' && !dropState.blocked,
              'is-drop-after': dropState?.id === row.id && dropState.position === 'after' && !dropState.blocked,
              'is-drop-inner': dropState?.id === row.id && dropState.position === 'inner' && !dropState.blocked,
              'is-drop-ban': dropState?.id === row.id && dropState.blocked,
            }"
            :style="{ paddingLeft: `${8 + row.depth * 18}px` }"
            :draggable="editing && renameId !== row.id"
            @click="onRowClick(row.id, $event)"
            @dragstart="onDragStart(row, $event)"
            @dragover="onDragOver(row, $event)"
            @drop="onDrop(row)"
            @dragend="onDragEnd"
          >
            <button type="button" class="cat-expand" draggable="false" :title="row.hasChildren ? (row.expanded ? '收起' : '展开') : ''" @pointerdown.stop.prevent="onExpandDown(row.id, $event)" @click.stop="onExpandClick(row.id, $event)">
              <span v-if="row.hasChildren">{{ row.expanded ? '▼' : '▸' }}</span>
            </button>
            <span v-if="row.icon" class="cat-emoji">{{ row.icon }}</span>
            <el-icon v-else-if="row.hasChildren" class="cat-icon"><FolderOpened v-if="row.expanded" /><Folder v-else /></el-icon>
            <el-icon v-else class="cat-icon"><Document /></el-icon>
            <input
              v-if="renameId === row.id"
              :ref="bindRenameInput"
              v-model="renameValue"
              class="cat-rename"
              draggable="false"
              @pointerdown.stop
              @mousedown.stop
              @click.stop
              @dblclick.stop
              @dragstart.stop.prevent
              @keydown.enter.prevent="commitRename"
              @keydown.esc.prevent="cancelRename"
              @blur="commitRename"
            />
            <span v-else class="cat-name" :title="row.name" @click="onNameClick(row.id, $event)" @dblclick.stop.prevent="onNameDblClick(row.id)">
              <span v-for="(part, index) in nameParts(row.name)" :key="index" :class="{ 'cat-hit': part.hit }">{{ part.text }}</span>
            </span>
            <span v-if="!row.enabled" class="cat-off-tag">停用</span>
            <span v-if="badgeOf(row.id)" class="cat-count">{{ badgeOf(row.id) }}</span>
            <span v-if="editing" class="cat-ops" draggable="false" @pointerdown.stop.prevent @click.stop>
              <button type="button" @click="openCreate(row.id)">新增子分类</button>
              <button type="button" @click="openEdit(row.id)">编辑</button>
              <button type="button" @click="copyNode(row.id)">复制</button>
              <button type="button" @click="openMove(row.id)">移动</button>
              <button type="button" class="is-danger" @click="remove(row.id)">删除</button>
            </span>
          </div>
        </div>
        <el-empty v-else :description="keyword.trim() ? '没有匹配的分类' : '还没有分类'" />
      </section>

      <section v-if="moveOpen" class="panel cat-move-panel">
        <h2>移动分类</h2>
        <p class="move-line"><span>正在移动</span>{{ moveSourcePath }}</p>
        <p class="move-line"><span>目标父级</span>{{ moveTargetLabel }}</p>
        <button type="button" class="move-root" :class="{ 'is-on': !moveParent }" @click="pickMoveTarget(null)">作为根分类</button>
        <div class="cat-scroll cat-move-scroll">
          <div
            v-for="row in moveRows"
            :key="row.id"
            class="cat-row"
            :class="{
              'is-source': row.id === moveId,
              'is-target': row.id === moveParent,
              'is-ban': Boolean(moveTargetBlocked(row.id)),
              'is-off': !row.enabled,
            }"
            :style="{ paddingLeft: `${8 + row.depth * 18}px` }"
            :title="moveTargetBlocked(row.id)"
          >
            <button type="button" class="cat-expand" :title="row.hasChildren ? (row.expanded ? '收起' : '展开') : ''" @click.stop="toggleMove(row.id)">
              <span v-if="row.hasChildren">{{ row.expanded ? '▼' : '▸' }}</span>
            </button>
            <button type="button" class="move-name" @click="pickMoveTarget(row.id)">{{ row.name }}</button>
          </div>
        </div>
        <div class="row-actions">
          <el-button @click="closeMove">取消</el-button>
          <el-button type="primary" @click="confirmMove">确定移动</el-button>
        </div>
      </section>

      <section v-if="current" class="panel cat-detail">
        <h2>{{ current.name }}</h2>
        <div class="info-card">
          <h3>基础信息</h3>
          <p><span>名称</span>{{ current.name }}</p>
          <p><span>父级</span>{{ parentName }}</p>
          <p><span>状态</span>{{ current.enabled === false ? '停用' : '启用' }}</p>
        </div>
        <div class="info-card">
          <h3>商品统计</h3>
          <p><span>商品</span>{{ productCount }}</p>
          <p><span>SKU</span>{{ skuCount }}</p>
          <p v-for="item in ownedFamilies" :key="item.id" class="owned-product">
            <button type="button" class="linkish" @click="openProduct(item.id)">{{ item.name }}</button>
            <span v-if="shelfOf(item) === 'online'">已发布</span>
          </p>
          <button v-if="ownedFamilies.length" type="button" class="linkish" @click="openProducts">在商品列表中查看</button>
        </div>
        <div class="info-card">
          <h3>属性方案</h3>
          <p><span>方案</span>{{ schemeName || '未配置' }}</p>
          <p><span>来源</span>{{ currentMapping ? '本级绑定' : '未绑定' }}</p>
          <div v-if="currentMapping" class="card-links">
            <button type="button" class="linkish" @click="refsOpen = true">该方案被 {{ schemeUsers.length }} 个分类使用</button>
            <button v-if="store.isAdmin" type="button" class="linkish" @click="openScheme">跳转属性方案</button>
          </div>
        </div>
        <div v-if="editing" class="row-actions">
          <el-button @click="openCreate(current.id)">新增子分类</el-button>
          <el-button @click="openEdit(current.id)">编辑</el-button>
          <el-button @click="openMove(current.id)">移动</el-button>
          <el-button type="danger" @click="remove(current.id)">删除</el-button>
        </div>
      </section>
      <section v-else class="panel cat-detail">
        <el-empty description="选择左侧分类后查看" />
      </section>
    </div>

    <el-dialog v-model="refsOpen" title="引用分类" width="420px">
      <p v-for="item in schemeUsers" :key="item">{{ item }}</p>
    </el-dialog>
    <el-dialog v-model="createOpen" :title="parentForCreate ? '新增子分类' : '新增根分类'" width="420px">
      <p class="muted" style="margin-bottom: 8px">{{ parentForCreate ? `上级：${createParentLabel}` : '将创建为根分类' }}</p>
      <el-input v-model="createName" placeholder="分类名称" @keyup.enter="create" />
      <template #footer>
        <el-button @click="createOpen = false">取消</el-button>
        <el-button type="primary" @click="create">保存</el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="editOpen" title="编辑分类" width="460px">
      <el-form label-width="88px">
        <el-form-item label="名称">
          <el-input v-model="draft.name" @keyup.enter="saveEdit" />
        </el-form-item>
        <p class="muted">调整上级请用「移动」，在旁边的分类树里选择。</p>
        <el-form-item label="状态">
          <el-switch v-model="draft.enabled" active-text="启用" inactive-text="停用" />
        </el-form-item>
        <el-form-item v-if="store.isAdmin" label="属性方案">
          <el-select v-model="draft.templateId" clearable placeholder="不绑定" style="width: 100%">
            <el-option v-for="item in bindableSchemes" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <p v-if="!store.isAdmin" class="muted">属性方案绑定由管理员操作。</p>
      <template #footer>
        <el-button @click="editOpen = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { Document, Folder, FolderOpened } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHead from '../components/PageHead.vue'
import { blockChildOfTypedCategory, branchIds, categoryChain, relocateBlockMessage, subtreeCounts, visibleCategoryRows, type CategoryRow, type DropPosition } from '../domain/categoryTree'
import { descendantIds, shelfOf, templateById } from '../domain/logic'
import { applyPresetToActiveView } from '../domain/productListViews'
import { useCatalogStore } from '../stores/catalog'

const store = useCatalogStore()
const router = useRouter()
const treeMode = ref<'view' | 'edit'>('view')
const editing = computed(() => treeMode.value === 'edit')
const keyword = ref('')
const pinnedClosed = ref(new Set<string>())
const dragged = ref(false)
const dragId = ref('')
const dropState = ref<{ id: string; position: DropPosition; blocked: boolean } | null>(null)
const initialId = store.data.categories.some((item) => item.id === 'c-phone') ? 'c-phone' : store.data.categories.find((item) => item.parentId === null)?.id || ''
const selected = ref(initialId)
const locatedId = ref('')
const expanded = ref(new Set(ancestorIds(initialId)))
const treeScroll = ref<HTMLElement | null>(null)
const createOpen = ref(false)
const editOpen = ref(false)
const refsOpen = ref(false)
const moveOpen = ref(false)
const createName = ref('')
const parentForCreate = ref<string | null>(null)
let pendingCreateId = ''
const editId = ref('')
const moveId = ref('')
const moveParent = ref('')
const moveExpanded = ref(new Set<string>())
const moveClosed = ref(new Set<string>())
const renameId = ref('')
const renameValue = ref('')
const renameInput = ref<HTMLInputElement | null>(null)
let renameClosing = false
let renameFocused = false
const draft = reactive({ name: '', enabled: true, templateId: '' })

const current = computed(() => store.data.categories.find((item) => item.id === selected.value))
const rows = computed(() => visibleCategoryRows(store.data.categories, expanded.value, keyword.value, pinnedClosed.value))
const productBadges = computed(() => subtreeCounts(store.data.categories, store.data.families))
const parentName = computed(() => {
  if (!current.value?.parentId) return '根分类'
  return store.data.categories.find((item) => item.id === current.value?.parentId)?.name || '根分类'
})
const currentMapping = computed(() => (current.value ? store.data.mappings.find((item) => item.categoryId === current.value!.id) : undefined))
const schemeName = computed(() => (currentMapping.value ? templateById(store.data, currentMapping.value.templateId)?.name || '' : ''))
const schemeUsers = computed(() => {
  const templateId = currentMapping.value?.templateId
  if (!templateId) return []
  return store.data.mappings
    .filter((item) => item.templateId === templateId)
    .map((item) => store.data.categories.find((category) => category.id === item.categoryId)?.name || '')
    .filter(Boolean)
})
const bindableSchemes = computed(() => store.data.templates.filter((item) => item.structureOrder.length > 0))
const createParentLabel = computed(() => (parentForCreate.value ? categoryChain(store.data.categories, parentForCreate.value).map((item) => item.name).join(' / ') : ''))
const moveRows = computed(() => visibleCategoryRows(store.data.categories, moveExpanded.value, '', moveClosed.value))
const moveSourcePath = computed(() => (moveId.value ? categoryChain(store.data.categories, moveId.value).map((item) => item.name).join(' / ') : ''))
const moveTargetLabel = computed(() => (moveParent.value ? categoryChain(store.data.categories, moveParent.value).map((item) => item.name).join(' / ') : '根分类'))
const ownedFamilies = computed(() => store.data.families.filter((item) => item.categoryId === current.value?.id))
const productCount = computed(() => ownedFamilies.value.length)
const skuCount = computed(() => {
  const ids = new Set(ownedFamilies.value.map((item) => item.id))
  return store.data.skus.filter((item) => ids.has(item.familyId)).length
})

watch(treeMode, (mode) => {
  if (mode === 'view') {
    dragId.value = ''
    dropState.value = null
    dragged.value = false
    cancelRename()
    closeMove()
    createOpen.value = false
    editOpen.value = false
  }
})

watch(keyword, (value) => {
  pinnedClosed.value = new Set()
  const id = firstMatchId(value)
  locatedId.value = id
  if (!id) return
  pick(id)
  focusRow(id)
})

function ancestorIds(id: string) {
  return categoryChain(store.data.categories, id).slice(0, -1).map((item) => item.id)
}
function firstMatchId(value: string) {
  const token = value.trim().toLowerCase()
  if (!token) return ''
  const walk = (parentId: string | null): string => {
    const children = store.data.categories.filter((item) => item.parentId === parentId).sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))
    for (const item of children) {
      if (item.name.toLowerCase().includes(token)) return item.id
      const nested = walk(item.id)
      if (nested) return nested
    }
    return ''
  }
  return walk(null)
}
function badgeOf(id: string) {
  return productBadges.value.get(id) || 0
}
function nameParts(name: string) {
  const needle = keyword.value.trim()
  if (!needle) return [{ text: name, hit: false }]
  const lower = name.toLowerCase()
  const token = needle.toLowerCase()
  const parts: { text: string; hit: boolean }[] = []
  let start = 0
  let index = lower.indexOf(token)
  if (index < 0) return [{ text: name, hit: false }]
  while (index >= 0) {
    if (index > start) parts.push({ text: name.slice(start, index), hit: false })
    parts.push({ text: name.slice(index, index + token.length), hit: true })
    start = index + token.length
    index = lower.indexOf(token, start)
  }
  if (start < name.length) parts.push({ text: name.slice(start), hit: false })
  return parts
}
function reveal(id: string) {
  const next = new Set(expanded.value)
  ancestorIds(id).forEach((item) => next.add(item))
  expanded.value = next
  const closed = new Set(pinnedClosed.value)
  ancestorIds(id).forEach((item) => closed.delete(item))
  pinnedClosed.value = closed
}
function pick(id: string) {
  selected.value = id
  reveal(id)
}
function focusRow(id: string) {
  nextTick(() => {
    const box = treeScroll.value
    const row = box?.querySelector(`[data-id="${CSS.escape(id)}"]`) as HTMLElement | null
    if (!box || !row) return
    const top = row.offsetTop
    const bottom = top + row.offsetHeight
    if (top < box.scrollTop) box.scrollTop = Math.max(0, top - 8)
    else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight + 8
  })
}
function toggle(id: string) {
  const row = rows.value.find((item) => item.id === id)
  if (!row?.hasChildren) return
  const nextExpanded = new Set(expanded.value)
  const nextClosed = new Set(pinnedClosed.value)
  if (row.expanded) {
    nextExpanded.delete(id)
    nextClosed.add(id)
  } else {
    nextExpanded.add(id)
    nextClosed.delete(id)
  }
  expanded.value = nextExpanded
  pinnedClosed.value = nextClosed
}
function onExpandDown(id: string, event: Event) {
  event.stopPropagation()
  event.preventDefault()
  toggle(id)
}
function onExpandClick(id: string, event: MouseEvent) {
  if (event.detail !== 0) return
  toggle(id)
}
function expandAll() {
  pinnedClosed.value = new Set()
  expanded.value = new Set(branchIds(store.data.categories))
}
function collapseAll() {
  expanded.value = new Set()
  pinnedClosed.value = keyword.value.trim() ? new Set(branchIds(store.data.categories)) : new Set()
}
function onRowClick(id: string, event: MouseEvent) {
  if (dragged.value) return
  const target = event.target as HTMLElement | null
  if (target?.closest('input, button')) return
  if (!editing.value) {
    selected.value = id
    const row = rows.value.find((item) => item.id === id)
    if (row?.hasChildren) toggle(id)
    return
  }
  pick(id)
}
function onNameClick(id: string, event: MouseEvent) {
  if (!editing.value || dragged.value || renameId.value) return
  event.stopPropagation()
  pick(id)
}
function onNameDblClick(id: string) {
  if (!editing.value || dragged.value) return
  startRename(id)
}
function bindRenameInput(el: unknown) {
  renameInput.value = el instanceof HTMLInputElement ? el : null
  if (!renameInput.value || renameFocused) return
  renameFocused = true
  renameInput.value.focus()
  renameInput.value.select()
}
function startRename(id: string) {
  const item = store.data.categories.find((row) => row.id === id)
  if (!item || !editing.value) return
  renameClosing = false
  renameFocused = false
  renameId.value = id
  renameValue.value = item.name
  selected.value = id
}
function cancelRename() {
  renameClosing = true
  renameId.value = ''
  renameValue.value = ''
}
async function flushChanges() {
  const result = await store.flushPersistence()
  if (!result.ok) { ElMessage.error(store.persistenceState.message || '分类修改尚未保存，当前输入已保留。'); return false }
  return true
}
async function commitRename() {
  if (renameClosing || !renameId.value) return
  const id = renameId.value
  const item = store.data.categories.find((row) => row.id === id)
  if (!item) {
    cancelRename()
    return
  }
  if (renameValue.value.trim() === item.name) {
    renameClosing = true
    if (!await flushChanges()) { renameClosing = false; nextTick(() => renameInput.value?.focus()); return }
    cancelRename()
    return
  }
  const siblings = store.data.categories
    .filter((row) => (row.parentId || null) === (item.parentId || null))
    .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))
  const index = Math.max(0, siblings.findIndex((row) => row.id === id))
  const message = store.updateCategory(id, {
    name: renameValue.value,
    enabled: item.enabled !== false,
    sort: index + 1,
    parentId: item.parentId,
    icon: item.icon,
  })
  if (message) {
    ElMessage.warning(message)
    nextTick(() => renameInput.value?.focus())
    return
  }
  renameClosing = true
  if (!await flushChanges()) { renameClosing = false; nextTick(() => renameInput.value?.focus()); return }
  renameId.value = ''
  renameValue.value = ''
  ElMessage.success('已保存')
}
function openCreate(parentId: string | null) {
  if (!editing.value) return
  parentForCreate.value = parentId
  pendingCreateId = ''
  createName.value = ''
  createOpen.value = true
}
async function create() {
  if (!editing.value) return
  const name = createName.value.trim()
  if (!name) {
    ElMessage.warning('请填写分类名称')
    return
  }
  const parentId = parentForCreate.value
  const pending = store.data.categories.find(row => row.id === pendingCreateId)
  const created = pending ? { id: pending.id, message: store.updateCategory(pending.id, { ...pending, name, parentId }) } : store.addCategory(name, parentId)
  if (created.message) {
    ElMessage.warning(created.message)
    return
  }
  pendingCreateId = created.id
  if (!await flushChanges()) return
  const id = created.id
  if (parentId) reveal(id)
  selected.value = id
  createOpen.value = false
  ElMessage.success('已新增分类')
}
function openEdit(id: string) {
  if (!editing.value) return
  const item = store.data.categories.find((row) => row.id === id)
  if (!item) return
  pick(id)
  editId.value = id
  draft.name = item.name
  draft.enabled = item.enabled !== false
  draft.templateId = store.data.mappings.find((row) => row.categoryId === id)?.templateId || ''
  editOpen.value = true
}
async function saveEdit() {
  if (!editing.value) return
  const item = store.data.categories.find((row) => row.id === editId.value)
  if (!item) return
  const message = store.updateCategory(item.id, {
    name: draft.name,
    enabled: draft.enabled,
    sort: item.sort,
    parentId: item.parentId,
    icon: item.icon,
  })
  if (message) {
    ElMessage.warning(message)
    return
  }
  if (store.isAdmin) {
    const currentTemplate = store.data.mappings.find((row) => row.categoryId === item.id)?.templateId || ''
    if (currentTemplate !== draft.templateId) store.setCategoryMapping(item.id, draft.templateId)
  }
  if (!await flushChanges()) return
  reveal(item.id)
  editOpen.value = false
  ElMessage.success('已保存')
}
function moveTargetBlocked(id: string | null) {
  if (!id) return ''
  if (id === moveId.value) return '不能移动到自己下面'
  if (descendantIds(store.data.categories, moveId.value).includes(id)) return '不能移动到自己的子分类下面'
  return blockChildOfTypedCategory(id, new Set(store.data.productTypes.map((item) => item.categoryId)))
}
function openMove(id: string) {
  if (!editing.value) return
  const item = store.data.categories.find((row) => row.id === id)
  if (!item) return
  moveId.value = id
  moveParent.value = item.parentId || ''
  moveExpanded.value = new Set(ancestorIds(id))
  moveClosed.value = new Set()
  moveOpen.value = true
}
function closeMove() {
  moveOpen.value = false
}
function toggleMove(id: string) {
  const row = moveRows.value.find((item) => item.id === id)
  if (!row?.hasChildren) return
  const nextExpanded = new Set(moveExpanded.value)
  const nextClosed = new Set(moveClosed.value)
  if (row.expanded) {
    nextExpanded.delete(id)
    nextClosed.add(id)
  } else {
    nextExpanded.add(id)
    nextClosed.delete(id)
  }
  moveExpanded.value = nextExpanded
  moveClosed.value = nextClosed
}
function pickMoveTarget(id: string | null) {
  const message = id ? moveTargetBlocked(id) : ''
  if (message) {
    ElMessage.warning(message)
    return
  }
  moveParent.value = id || ''
}
async function confirmMove() {
  if (!editing.value) return
  const item = store.data.categories.find((row) => row.id === moveId.value)
  if (!item) return
  const blocked = moveTargetBlocked(moveParent.value || null)
  if (blocked) {
    ElMessage.warning(blocked)
    return
  }
  if ((item.parentId || '') === (moveParent.value || '')) {
    if (!await flushChanges()) return
    closeMove()
    return
  }
  const message = store.moveCategory(item.id, moveParent.value || null)
  if (message) ElMessage.warning(message)
  else {
    if (!await flushChanges()) return
    reveal(item.id)
    closeMove()
    ElMessage.success('已移动分类')
  }
}
async function copyNode(id: string) {
  if (!editing.value) return
  const item = store.data.categories.find((row) => row.id === id)
  if (!item) return
  try {
    await ElMessageBox.confirm(`将复制「${item.name}」及其子分类。商品不会被复制。`, '复制分类', { confirmButtonText: '复制', cancelButtonText: '取消' })
  } catch {
    return
  }
  const nextId = store.copyCategory(id)
  if (!nextId || !store.data.categories.some((row) => row.id === nextId)) {
    ElMessage.warning(nextId || '分类不存在')
    return
  }
  if (!await flushChanges()) return
  reveal(nextId)
  selected.value = nextId
  ElMessage.success('已复制分类')
}
function openProduct(id: string) {
  router.push(`/products/${id}`)
}
function openProducts() {
  if (!current.value) return
  applyPresetToActiveView(store.data, {
    query: { ...store.data.listQuery, keyword: '', categoryId: current.value.id, brand: '', status: '', templateId: '', productGroupId: '', attrFilters: {}, createdFrom: '', createdTo: '', shelf: '', page: 1 },
  })
  router.push('/products')
}
async function remove(id: string) {
  if (!editing.value) return
  const block = store.categoryRemovalBlock(id)
  if (block) {
    const owned = store.data.families.filter((item) => item.categoryId === id)
    if (!owned.length) {
      ElMessage.warning(block)
      return
    }
    const names = owned.slice(0, 3).map((item) => item.name).join('、')
    const extra = owned.length > 3 ? `等 ${owned.length} 款` : ''
    const published = owned.some((item) => shelfOf(item) === 'online')
    ElMessage.warning(published ? `不能删除。还挂着已发布商品「${names}」${extra}。请先下架，再在商品列表删除。` : `不能删除。还挂着「${names}」${extra}。请先到商品列表删除。`)
    return
  }
  const item = store.data.categories.find((row) => row.id === id)
  if (!item) return
  try {
    await ElMessageBox.confirm(`确定删除分类「${item.name}」？`, '删除分类', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
  } catch {
    return
  }
  const parentId = item.parentId || ''
  const message = store.removeCategory(id)
  if (message) ElMessage.warning(message)
  else {
    if (!await flushChanges()) return
    if (selected.value === id) selected.value = parentId
    ElMessage.success('已删除')
  }
}
function openScheme() {
  if (!currentMapping.value || !store.isAdmin) return
  router.push({ path: '/templates', query: { scheme: currentMapping.value.templateId } })
}
function dropPosition(event: DragEvent): DropPosition {
  const el = event.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  const ratio = (event.clientY - rect.top) / Math.max(rect.height, 1)
  if (ratio < 0.28) return 'before'
  if (ratio > 0.72) return 'after'
  return 'inner'
}
function onDragStart(row: CategoryRow, event: DragEvent) {
  if (!editing.value) {
    event.preventDefault()
    return
  }
  const target = event.target as HTMLElement | null
  if (target?.closest('button, input')) {
    event.preventDefault()
    return
  }
  dragged.value = true
  dragId.value = row.id
  event.dataTransfer?.setData('text/plain', row.id)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}
function onDragOver(row: CategoryRow, event: DragEvent) {
  if (!editing.value || !dragId.value) return
  event.preventDefault()
  const position = dropPosition(event)
  const moving = store.data.categories.find((item) => item.id === dragId.value)
  const nextParent = position === 'inner' ? row.id : row.parentId
  const parentChanged = (moving?.parentId || null) !== (nextParent || null)
  const typedBlock = parentChanged ? blockChildOfTypedCategory(nextParent, new Set(store.data.productTypes.map((item) => item.categoryId))) : ''
  const message = relocateBlockMessage(store.data.categories, dragId.value, row.id, position) || typedBlock
  dropState.value = { id: row.id, position, blocked: Boolean(message) }
  if (event.dataTransfer) event.dataTransfer.dropEffect = message ? 'none' : 'move'
}
async function onDrop(row: CategoryRow) {
  if (!editing.value) return
  const id = dragId.value
  const state = dropState.value
  if (!id || !state || state.id !== row.id) return
  const previousParent = store.data.categories.find((item) => item.id === id)?.parentId
  const message = store.relocateCategory(id, row.id, state.position)
  if (message) {
    ElMessage.warning(message)
    return
  }
  if (!await flushChanges()) return
  const nextParent = store.data.categories.find((item) => item.id === id)?.parentId ?? null
  if (state.position === 'inner' || previousParent !== nextParent) reveal(id)
  ElMessage.success(previousParent !== nextParent ? '已移动分类' : '已更新排序')
}
function onDragEnd() {
  dragId.value = ''
  dropState.value = null
  window.setTimeout(() => {
    dragged.value = false
  }, 40)
}
</script>

<style scoped>
.cat-layout { display: grid; grid-template-columns: calc(40% - 7px) calc(60% - 7px); gap: 14px; align-items: start; }
.cat-layout.is-moving { grid-template-columns: minmax(280px, 1.15fr) minmax(260px, 0.9fr) minmax(280px, 1fr); }
.cat-tree-panel { min-height: 640px; }
.cat-move-panel { min-height: 640px; }
.cat-move-panel h2 { font-size: 18px; }
.move-line { display: flex; gap: 12px; margin: 8px 0; font-size: 14px; line-height: 22px; }
.move-line span { width: 64px; flex: none; color: #66788a; }
.move-root, .move-name { border: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.move-root { display: block; margin: 8px 0; padding: 6px 8px; border-radius: 6px; }
.move-root.is-on, .cat-row.is-target { background: #e8f3ff; }
.cat-row.is-source .move-name { font-weight: 650; }
.cat-row.is-ban .move-name { color: #98a2b3; cursor: not-allowed; }
.move-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cat-move-scroll { max-height: calc(100vh - 360px); }
.cat-detail { padding-bottom: 16px; }
.cat-detail h2 { font-size: 20px; }
.cat-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
.cat-toolbar-ops { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.cat-search { width: 220px; flex: none; }
.cat-scroll { margin-top: 10px; max-height: calc(100vh - 230px); overflow: auto; border: 1px solid #e6edf5; border-radius: 8px; background: #fbfcfe; position: relative; }
.cat-row { position: relative; display: flex; align-items: center; gap: 6px; min-height: 36px; padding-right: 8px; border-bottom: 1px solid #f0f3f8; cursor: default; }
.cat-row.is-editing { cursor: grab; }
.cat-row:hover { background: #f5f9ff; }
.cat-row.is-active { background: #ecf5ff; }
.cat-row.is-located { box-shadow: inset 3px 0 0 #409eff; }
.cat-row.is-off .cat-name { color: #98a2b3; }
.cat-row.is-drop-before { box-shadow: inset 0 2px 0 #409eff; }
.cat-row.is-drop-after { box-shadow: inset 0 -2px 0 #409eff; }
.cat-row.is-drop-inner { background: #e8f3ff; outline: 1px dashed #409eff; outline-offset: -1px; }
.cat-row.is-drop-ban { background: #fff6f6; cursor: not-allowed; }
.cat-expand { width: 22px; height: 22px; border: 0; padding: 0; background: transparent; color: #66788a; cursor: pointer; flex: none; position: relative; z-index: 1; }
.cat-icon { color: #5b8def; flex: none; }
.cat-emoji { width: 16px; text-align: center; flex: none; }
.cat-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
.cat-rename { flex: 1; min-width: 0; height: 26px; border: 1px solid #409eff; border-radius: 4px; padding: 0 6px; font-size: 14px; background: #fff; }
.cat-row.is-editing .cat-name { cursor: pointer; }
.cat-hit { background: #ffe58f; border-radius: 2px; }
.cat-off-tag { flex: none; font-size: 12px; line-height: 18px; color: #8a94a6; background: #f2f4f7; border-radius: 4px; padding: 0 6px; }
.cat-count { flex: none; color: #98a2b3; font-size: 12px; }
.cat-ops { display: none; position: absolute; right: 0; top: 0; bottom: 0; align-items: center; gap: 2px; padding: 0 6px 0 16px; background: linear-gradient(90deg, rgba(245, 249, 255, 0), #f5f9ff 14px); }
.cat-row:hover .cat-ops { display: flex; }
.cat-row:hover .cat-count { display: none; }
.cat-ops button { border: 0; background: transparent; color: #1677ff; font-size: 12px; cursor: pointer; padding: 0 3px; white-space: nowrap; }
.cat-ops button.is-danger { color: #cf3b3b; }
.info-card { margin-top: 12px; padding: 12px 14px; background: #f7faff; border: 1px solid #e6edf5; border-radius: 8px; }
.info-card h3 { margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #66788a; }
.info-card p { display: flex; gap: 12px; margin: 0; font-size: 14px; line-height: 26px; }
.info-card p span { width: 42px; flex: none; color: #66788a; }
.owned-product { align-items: center; }
.owned-product span { width: auto; color: #b45309; font-size: 12px; }
.card-links { display: flex; gap: 12px; margin-top: 4px; }
.cat-detail .row-actions { margin-top: 14px; }
@media (max-width: 1100px) {
  .cat-layout, .cat-layout.is-moving { grid-template-columns: 1fr; }
  .cat-search { width: 100%; }
}
</style>
