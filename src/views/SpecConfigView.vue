<template>
  <div class="designer">
    <PageHead title="商品模型设计" desc="从左往右展开，像思维导图。发布会生成新版本快照，不会覆盖历史版本。">
      <span class="muted">当前方案</span>
      <el-select v-model="templateId" style="width: 180px">
        <el-option v-for="item in schemes" :key="item.id" :label="item.name" :value="item.id" />
      </el-select>
      <el-tag>当前版本 {{ canvas.versionName || 'V1' }}</el-tag>
      <el-tag :type="canvas.status === 'published' ? 'success' : canvas.status === 'offline' ? 'warning' : 'info'">{{ canvasStatusText }}</el-tag>
      <el-button v-if="!viewing" @click="tidy">自动布局</el-button>
      <el-button @click="setExpanded(true)">全部展开</el-button>
      <el-button @click="setExpanded(false)">全部收起</el-button>
      <el-button v-if="!viewing" @click="saveModel">保存模型</el-button>
      <el-button v-if="!viewing" type="primary" @click="publish">发布模型</el-button>
    </PageHead>
    <div class="board">
      <div class="canvas">
        <VueFlow
          :nodes="flowNodes"
          :edges="flowEdges"
          :nodes-connectable="false"
          :nodes-draggable="!viewing"
          :default-viewport="{ x: canvas.panX, y: canvas.panY, zoom: canvas.zoom }"
          fit-view-on-init
          @node-click="onNodeClick"
          @node-double-click="onNodeDoubleClick"
          @node-context-menu="onNodeMenu"
          @node-drag-stop="onNodeDragStop"
          @move-end="onMoveEnd"
          @pane-click="menu.open = false"
        >
          <Background />
          <Controls />
          <MiniMap />
          <div class="path-preview">
            <strong>路径预览</strong>
            <p v-for="(item, index) in pathItems" :key="item.id"><span v-if="index">|</span>{{ item.label }}</p>
          </div>
          <div class="model-summary">
            <strong>{{ schemeTitle }}</strong>
            <span>节点 {{ nodes.length }}</span>
            <span>属性 {{ attributeTotal }}</span>
            <span>属性值 {{ valueTotal }}</span>
            <span>{{ canvas.versionName || 'V1' }} · {{ canvasStatusText }}</span>
          </div>
          <template #node-model="{ data }">
            <div class="model-root" :class="{ 'is-on': data.selected, 'is-path': data.onPath }" title="双击修改名称">
              <input v-if="editingId === data.id" class="inline-edit root-edit" :value="data.label" @keydown.enter.prevent="commitRootName" @keydown.esc.stop="cancelRootEdit" @blur="commitRootName" @mousedown.stop @pointerdown.stop @click.stop @dblclick.stop />
              <strong v-else>{{ data.label }}</strong>
              <Handle type="source" :position="Position.Right" />
            </div>
          </template>
          <template #node-attribute="{ data }">
            <div class="model-attr" :class="{ 'is-on': data.selected, 'is-path': data.onPath, 'is-common': data.role === 'COMMON', 'is-variant': data.role !== 'COMMON' }" title="双击修改">
              <Handle type="target" :position="Position.Left" />
              <select v-if="editingId === data.id" class="inline-edit" :value="data.editValue" @change="commitInline(data.id, 'attribute', $event)" @blur="editingId = ''" @mousedown.stop @pointerdown.stop @click.stop @dblclick.stop>
                <option v-for="item in data.options" :key="item.value" :value="item.value">{{ item.label }}</option>
              </select>
              <strong v-else>{{ data.label }}</strong>
              <span class="node-kind">{{ data.role === 'COMMON' ? '属性节点' : '规格属性' }}</span>
              <span class="node-role">角色：{{ data.role === 'COMMON' ? '公共属性' : '规格属性' }}</span>
              <button v-if="data.childCount" type="button" class="fold" @click.stop="toggleExpand(data.id)" @dblclick.stop>{{ data.expanded ? '−' : '+' }}</button>
              <em v-if="data.childCount && !data.expanded">（{{ data.childCount }}）</em>
              <Handle type="source" :position="Position.Right" />
            </div>
          </template>
          <template #node-value="{ data }">
            <div class="model-value" :class="{ 'is-on': data.selected, 'is-path': data.onPath }" title="双击修改">
              <Handle type="target" :position="Position.Left" />
              <select v-if="editingId === data.id" class="inline-edit" :value="data.editValue" @change="commitInline(data.id, 'value', $event)" @blur="editingId = ''" @mousedown.stop @pointerdown.stop @click.stop @dblclick.stop>
                <option v-for="item in data.options" :key="item.value" :value="item.value">{{ item.label }}</option>
              </select>
              <span v-else>{{ data.label }}</span>
              <small class="node-kind">属性值</small>
              <button v-if="data.childCount" type="button" class="fold" @click.stop="toggleExpand(data.id)" @dblclick.stop>{{ data.expanded ? '−' : '+' }}</button>
              <em v-if="data.childCount && !data.expanded">（{{ data.childCount }}）</em>
              <Handle type="source" :position="Position.Right" />
            </div>
          </template>
        </VueFlow>
      </div>
      <div class="side panel">
        <div class="version-box">
          <h2>当前版本：{{ canvas.versionName || 'V1' }}</h2>
          <p>{{ canvasStatusText }}。修改已发布模型会变成下一版草稿，新商品仍用最近一次发布快照。</p>
          <h3>发布记录</h3>
          <p v-if="records.length === 0" class="muted">还没有发布版本。</p>
          <p v-for="item in records" :key="item.id">{{ item.versionName }} · {{ item.time }} · {{ item.products }} 个商品</p>
        </div>
        <template v-if="current">
          <div class="node-card" :class="current.nodeType === 'ATTRIBUTE' ? (current.role === 'COMMON' ? 'is-common' : 'is-variant') : 'is-value'">
            <h2>{{ nodeTitle(current) }}</h2>
            <p><span>节点类型</span>{{ current.nodeType === 'ATTRIBUTE' ? '属性节点' : '属性值' }}</p>
            <p><span>节点信息</span>{{ current.nodeType === 'ATTRIBUTE' ? '下面可以继续挂属性，也可以挂属性值' : '下面只能继续挂属性' }}</p>
            <p><span>关联属性</span>{{ paramName(current.attributeId) }}</p>
            <p v-if="current.nodeType === 'ATTRIBUTE'"><span>角色</span>{{ current.role === 'COMMON' ? '公共属性' : '规格属性' }}</p>
            <p><span>父节点</span>{{ parentTitle }}</p>
          </div>
          <el-form v-if="current.nodeType === 'ATTRIBUTE'" label-width="88px">
            <el-form-item label="关联属性">
              <el-select :model-value="current.attributeId" style="width: 180px" @change="setAttribute">
                <el-option v-for="item in attributeChoices" :key="item.id" :label="item.name" :value="item.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="角色">
              <el-radio-group :model-value="current.role || 'VARIANT'" @change="setRole">
                <el-radio value="COMMON">公共属性</el-radio>
                <el-radio value="VARIANT">规格属性</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-form>
          <p class="path-line">
            <span>路径</span>
            <button v-for="(item, index) in pathItems" :key="item.id" type="button" @click="selected = item.id">{{ item.label }}<span v-if="index < pathItems.length - 1"> &gt; </span></button>
          </p>
          <p class="muted">双击画布上的名称即可修改。</p>
          <div v-if="!viewing" class="row-actions">
            <el-button type="primary" @click="openAttributeAt(current.id)">新增下级属性</el-button>
            <el-button v-if="current.nodeType === 'ATTRIBUTE'" @click="openValueAt(current.id)">新增属性值</el-button>
            <el-button v-if="current.nodeType === 'ATTRIBUTE'" @click="openAttributeAt(current.parentId)">新增同级属性</el-button>
            <el-button v-else-if="current.parentId" @click="openValueAt(current.parentId)">新增同级属性值</el-button>
            <el-button @click="copyNode">复制</el-button>
            <el-button type="danger" @click="remove">删除</el-button>
          </div>
        </template>
        <template v-else-if="selected === rootId">
          <div class="node-card is-root">
            <h2>{{ schemeTitle }}</h2>
            <p><span>节点信息</span>从这里开始加第一层属性</p>
            <p><span>父节点</span>无</p>
          </div>
          <p class="path-line"><span>路径</span><button type="button">{{ schemeTitle }}</button></p>
          <p v-if="!viewing" class="muted">双击画布上的深色标题即可修改模型名称，回车保存。</p>
          <div v-if="!viewing" class="row-actions">
            <el-button type="primary" @click="openAttributeAt(null)">新增属性</el-button>
          </div>
        </template>
        <p v-else class="muted">点击画布上的节点，在这里继续往下设计。</p>
      </div>
    </div>
    <div v-if="menu.open" class="context-menu" :style="{ left: menu.x + 'px', top: menu.y + 'px' }" @click.stop>
      <button v-if="menuCanChild" type="button" @click="runMenu('child')">{{ selected === rootId ? '新增属性' : '新增下级属性' }}</button>
      <button v-if="menuCanValue" type="button" @click="runMenu('value')">新增属性值</button>
      <button v-if="menuCanSibling" type="button" @click="runMenu('sibling')">新增同级</button>
      <button v-if="menuCanEdit" type="button" @click="runMenu('copy')">复制</button>
      <button v-if="menuCanEdit" type="button" @click="runMenu('delete')">删除</button>
      <button v-if="menuCanFold" type="button" @click="runMenu('expand')">展开</button>
      <button v-if="menuCanFold" type="button" @click="runMenu('collapse')">收起</button>
    </div>
    <el-dialog v-model="attributeOpen" :title="attributeTitle" width="420px">
      <el-select v-model="attributeIds" multiple collapse-tags collapse-tags-tooltip placeholder="选择属性，可多选" style="width: 100%">
        <el-option v-for="item in attributeChoices" :key="item.id" :label="item.name" :value="item.id" />
      </el-select>
      <template #footer>
        <el-button @click="attributeOpen = false">取消</el-button>
        <el-button type="primary" @click="addAttribute">保存</el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="valueOpen" title="新增取值" width="420px">
      <el-select v-model="valueIds" multiple collapse-tags collapse-tags-tooltip placeholder="选择属性值，可多选" style="width: 100%">
        <el-option v-for="item in childValueChoices" :key="item" :label="item" :value="item" />
      </el-select>
      <template #footer>
        <el-button @click="valueOpen = false">取消</el-button>
        <el-button type="primary" @click="addValue">保存</el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="copyOpen" title="复制商品模型" width="420px">
      <p class="muted">会复制节点、父子关系和画布位置，生成一个新的属性方案。不复制商品和 SKU。</p>
      <el-input v-model="copyName" placeholder="新模型名称" />
      <template #footer>
        <el-button @click="copyOpen = false">取消</el-button>
        <el-button type="primary" @click="copyModel">复制</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { Handle, Position, VueFlow } from '@vue-flow/core'
import { MiniMap } from '@vue-flow/minimap'
import { ElMessage } from 'element-plus'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import PageHead from '../components/PageHead.vue'
import { arrangeSpecPositions, sameSpecSnapshot, SPEC_VALUE_TO_VALUE } from '../domain/logic'
import type { ProductSpecNode, SpecNodeRole } from '../domain/types'
import { uid, useCatalogStore } from '../stores/catalog'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'

const store = useCatalogStore()
const route = useRoute()
const templateId = ref(String(route.query.template || 't-phone'))
const viewing = computed(() => route.query.mode === 'view')
const selected = ref('model-root')
const editingId = ref('')
const menu = ref({ open: false, x: 0, y: 0 })
const attributeOpen = ref(false)
const valueOpen = ref(false)
const copyOpen = ref(false)
const attributeIds = ref<string[]>([])
const attributeTitle = ref('新增属性')
const valueIds = ref<string[]>([])
const copyName = ref('平板模型')
const rootId = 'model-root'
let skipRootCommit = false
const attachParent = ref<string | null>(null)
type FlowOption = { value: string; label: string }
type FlowNodeData = { id: string; label: string; role?: string; selected: boolean; onPath: boolean; expanded: boolean; childCount: number; editValue: string; options: FlowOption[] }
const flowNodes = ref<{ id: string; type: string; position: { x: number; y: number }; data: FlowNodeData }[]>([])
const flowEdges = ref<{ id: string; source: string; target: string; style?: { stroke: string; strokeWidth: number } }[]>([])

const schemes = computed(() => store.data.templates.filter((item) => item.structureOrder.length > 0 || store.data.productSpecNodes.some((node) => node.templateId === item.id)))
const nodes = computed(() => store.data.productSpecNodes.filter((item) => item.templateId === templateId.value))
const current = computed(() => nodes.value.find((item) => item.id === selected.value))
const canvas = computed(() => store.data.specCanvases.find((item) => item.templateId === templateId.value) || { templateId: templateId.value, zoom: 1, panX: 0, panY: 0, status: 'draft' as const, version: 1, versionName: 'V1' })
const canvasStatusText = computed(() => (canvas.value.status === 'published' ? '已发布' : canvas.value.status === 'offline' ? '已下线' : '草稿'))
const records = computed(() =>
  store.data.specModelVersions
    .filter((item) => item.templateId === templateId.value)
    .slice()
    .sort((a, b) => b.version - a.version)
    .map((item) => ({
      ...item,
      time: item.publishTime ? item.publishTime.slice(0, 16).replace('T', ' ') : '未记录',
      products: store.data.families.filter((family) => family.modelVersionId === item.id).length,
    })),
)
const attributeChoices = computed(() => {
  const bound = new Set(store.data.templateParams.filter((item) => item.templateId === templateId.value).map((item) => item.paramId))
  return store.data.params.filter((item) => bound.size === 0 || bound.has(item.id))
})
const childValueChoices = computed(() => {
  const parent = nodes.value.find((item) => item.id === attachParent.value && item.nodeType === 'ATTRIBUTE')
  if (!parent) return []
  const values = store.data.params.find((item) => item.id === parent.attributeId)?.values || []
  const used = new Set(nodes.value.filter((item) => item.parentId === parent.id && item.nodeType === 'VALUE').map((item) => item.valueId))
  return values.filter((item) => !used.has(item))
})
const parentTitle = computed(() => {
  if (!current.value?.parentId) return schemeTitle.value
  const parent = nodes.value.find((item) => item.id === current.value?.parentId)
  return parent ? nodeTitle(parent) : schemeTitle.value
})
const schemeTitle = computed(() => store.data.templates.find((item) => item.id === templateId.value)?.name?.trim() || '商品模型')
const pathItems = computed(() => {
  const items = [{ id: rootId, label: schemeTitle.value }]
  if (!current.value) return items
  const chain: ProductSpecNode[] = []
  let cursor: ProductSpecNode | undefined = current.value
  const guard = new Set<string>()
  while (cursor && !guard.has(cursor.id)) {
    guard.add(cursor.id)
    chain.unshift(cursor)
    cursor = nodes.value.find((item) => item.id === cursor?.parentId)
  }
  chain.forEach((item) => items.push({ id: item.id, label: nodeTitle(item) }))
  return items
})
const attributeTotal = computed(() => nodes.value.filter((item) => item.nodeType === 'ATTRIBUTE').length)
const valueTotal = computed(() => nodes.value.filter((item) => item.nodeType === 'VALUE').length)
const menuNode = computed(() => nodes.value.find((item) => item.id === selected.value))
const menuCanChild = computed(() => !viewing.value && (selected.value === rootId || Boolean(menuNode.value)))
const menuCanValue = computed(() => !viewing.value && menuNode.value?.nodeType === 'ATTRIBUTE')
const menuCanSibling = computed(() => !viewing.value && Boolean(menuNode.value) && (menuNode.value?.nodeType === 'ATTRIBUTE' || Boolean(menuNode.value?.parentId)))
const menuCanEdit = computed(() => !viewing.value && Boolean(menuNode.value))
const menuCanFold = computed(() => Boolean(menuNode.value && childCount(menuNode.value.id)))

watch(templateId, () => {
  if (!store.data.specCanvases.some((item) => item.templateId === templateId.value)) {
    store.data.specCanvases.push({ templateId: templateId.value, zoom: 1, panX: 0, panY: 0, status: 'draft', version: 1, versionName: 'V1', direction: 'ltr' })
  }
}, { immediate: true })
watch(
  () => [templateId.value, selected.value, editingId.value, store.data.productSpecNodes.map((item) => `${item.id}:${item.parentId}:${item.positionX}:${item.positionY}:${item.attributeId}:${item.valueId}:${item.role}:${item.expanded}`).join('|')].join('#'),
  paint,
  { immediate: true },
)
watch(
  () => `${templateId.value}#${nodes.value.map((item) => `${item.id}:${item.parentId}:${item.nodeType}:${item.attributeId}:${item.valueId}:${item.role || ''}:${item.sort}`).join('|')}`,
  (_next, prev) => {
    if (!prev || viewing.value) return
    if (prev.slice(0, prev.indexOf('#')) !== templateId.value) return
    markWorkingDraft()
  },
)

function ensureCanvas() {
  let row = store.data.specCanvases.find((item) => item.templateId === templateId.value)
  if (!row) {
    row = { templateId: templateId.value, zoom: 1, panX: 0, panY: 0, status: 'draft', version: 1, versionName: 'V1', direction: 'ltr' }
    store.data.specCanvases.push(row)
  }
  return row
}
function paramName(id: string) {
  return store.data.params.find((item) => item.id === id)?.name || id
}
function nodeTitle(node: ProductSpecNode) {
  return node.nodeType === 'ATTRIBUTE' ? paramName(node.attributeId) : node.valueId || '未命名取值'
}
function valueOptions(node: ProductSpecNode): FlowOption[] {
  const values = store.data.params.find((item) => item.id === node.attributeId)?.values || []
  const used = new Set(nodes.value.filter((item) => item.parentId === node.parentId && item.id !== node.id && item.nodeType === 'VALUE').map((item) => item.valueId))
  return values.filter((item) => item === node.valueId || !used.has(item)).map((item) => ({ value: item, label: item }))
}
function attributeOptions(): FlowOption[] {
  return attributeChoices.value.map((item) => ({ value: item.id, label: item.name }))
}
function childCount(id: string) {
  return descendantIds(id).length
}
function isShown(node: ProductSpecNode) {
  let parentId = node.parentId
  const guard = new Set<string>()
  while (parentId && !guard.has(parentId)) {
    guard.add(parentId)
    const parent = nodes.value.find((item) => item.id === parentId)
    if (!parent) return true
    if (parent.expanded === false) return false
    parentId = parent.parentId
  }
  return true
}
function pathIds() {
  const ids = new Set<string>([rootId])
  let cursor = current.value
  const guard = new Set<string>()
  while (cursor && !guard.has(cursor.id)) {
    guard.add(cursor.id)
    ids.add(cursor.id)
    cursor = nodes.value.find((item) => item.id === cursor?.parentId)
  }
  return ids
}
function paint() {
  const visible = nodes.value.filter(isShown)
  const highlight = pathIds()
  const roots = visible.filter((item) => !item.parentId)
  const rootY = roots.length ? roots.reduce((sum, item) => sum + (item.positionY ?? 0), 0) / roots.length : 80
  flowNodes.value = [
    { id: rootId, type: 'model', position: { x: 24, y: rootY }, data: { id: rootId, label: schemeTitle.value, selected: selected.value === rootId, onPath: highlight.has(rootId), expanded: true, childCount: roots.length, editValue: '', options: [] } },
    ...visible.map((node) => ({
      id: node.id,
      type: node.nodeType === 'ATTRIBUTE' ? 'attribute' : 'value',
      position: { x: node.positionX ?? 280, y: node.positionY ?? 40 },
      data: {
        id: node.id,
        label: nodeTitle(node),
        role: node.role,
        selected: node.id === selected.value,
        onPath: highlight.has(node.id),
        expanded: node.expanded !== false,
        childCount: childCount(node.id),
        editValue: node.nodeType === 'ATTRIBUTE' ? node.attributeId : node.valueId,
        options: node.nodeType === 'ATTRIBUTE' ? attributeOptions() : valueOptions(node),
      },
    })),
  ]
  flowEdges.value = [
    ...roots.map((node) => edge(rootId, node.id, highlight)),
    ...visible.filter((node) => node.parentId && visible.some((item) => item.id === node.parentId)).map((node) => edge(node.parentId || '', node.id, highlight)),
  ]
}
function edge(source: string, target: string, highlight: Set<string>) {
  const onPath = highlight.has(source) && highlight.has(target)
  return { id: `e-${source}-${target}`, source, target, style: { stroke: onPath ? '#2f6fed' : '#c5d0de', strokeWidth: onPath ? 2.5 : 1.25 } }
}
function onNodeClick(event: { node: { id: string } }) {
  selected.value = event.node.id
  menu.value.open = false
}
function onNodeDoubleClick(payload: { event: { target?: EventTarget | null }; node: { id: string } }) {
  const target = payload.event.target as HTMLElement | null
  if (target?.closest?.('.fold, .inline-edit')) return
  beginEdit(payload.node.id)
}
function beginEdit(id: string) {
  if (viewing.value) return
  if (id === rootId) {
    selected.value = id
    editingId.value = id
    nextTick(() => {
      const input = document.querySelector<HTMLInputElement>('.root-edit')
      input?.focus()
      input?.select()
    })
    return
  }
  const node = nodes.value.find((item) => item.id === id)
  if (!node) return
  const options = node.nodeType === 'ATTRIBUTE' ? attributeOptions() : valueOptions(node)
  if (!options.length) {
    ElMessage.warning(node.nodeType === 'ATTRIBUTE' ? '当前方案还没有可选属性' : '这个属性还没有可选取值')
    return
  }
  selected.value = id
  editingId.value = id
  nextTick(() => document.querySelector<HTMLSelectElement>('.inline-edit')?.focus())
}
function cancelRootEdit() {
  skipRootCommit = true
  editingId.value = ''
}
function commitRootName(event: Event) {
  if (skipRootCommit) {
    skipRootCommit = false
    return
  }
  if (event.type === 'blur' && editingId.value !== rootId) return
  const name = (event.target as HTMLInputElement).value.trim()
  editingId.value = ''
  if (!name) {
    ElMessage.warning('请填写模型名称')
    return
  }
  const row = store.data.templates.find((item) => item.id === templateId.value)
  if (row) row.name = name
}
function commitInline(id: string, kind: 'attribute' | 'value', event: Event) {
  const value = (event.target as HTMLSelectElement).value
  const node = store.data.productSpecNodes.find((item) => item.id === id)
  if (!node || !value) return
  if (kind === 'attribute' && node.nodeType === 'ATTRIBUTE') {
    node.attributeId = value
    const bound = store.data.templateParams.find((item) => item.templateId === templateId.value && item.paramId === value)
    node.role = bound?.role === 'common' ? 'COMMON' : 'VARIANT'
  }
  if (kind === 'value' && node.nodeType === 'VALUE') node.valueId = value
  editingId.value = ''
}
function onNodeMenu(payload: { event: { preventDefault: () => void; clientX?: number; clientY?: number }; node: { id: string } }) {
  payload.event.preventDefault()
  selected.value = payload.node.id
  menu.value = { open: true, x: payload.event.clientX || 0, y: payload.event.clientY || 0 }
}
function runMenu(action: 'child' | 'value' | 'sibling' | 'copy' | 'delete' | 'expand' | 'collapse') {
  menu.value.open = false
  if (action === 'child') openChild()
  if (action === 'value' && current.value?.nodeType === 'ATTRIBUTE') openValueAt(current.value.id)
  if (action === 'sibling') openSibling()
  if (action === 'copy') copyNode()
  if (action === 'delete') remove()
  if (action === 'expand' && menuNode.value) menuNode.value.expanded = true
  if (action === 'collapse' && menuNode.value) menuNode.value.expanded = false
}
function illegalStructure() {
  return nodes.value.flatMap((node) => {
    const parent = node.parentId ? nodes.value.find((item) => item.id === node.parentId) : undefined
    if (!node.parentId && node.nodeType !== 'ATTRIBUTE') return [`「${nodeTitle(node)}」只能挂在属性下面`]
    if (parent?.nodeType === 'VALUE' && node.nodeType !== 'ATTRIBUTE') return [SPEC_VALUE_TO_VALUE]
    return []
  })
}
function onNodeDragStop(event: { node: { id: string; position: { x: number; y: number } } }) {
  if (event.node.id === rootId) return
  const row = store.data.productSpecNodes.find((item) => item.id === event.node.id)
  if (!row) return
  const hit = hitNode(event.node.position.x + 80, event.node.position.y + 24, row.id)
  if (!hit) {
    row.positionX = event.node.position.x
    row.positionY = event.node.position.y
    return
  }
  const message = reparent(row, hit)
  if (message) {
    ElMessage.warning(message)
    paint()
    return
  }
  arrangeSpecPositions(nodes.value)
  ElMessage.success('已调整层级')
}
function hitNode(x: number, y: number, selfId: string) {
  const root = flowNodes.value.find((item) => item.id === rootId)
  if (root && x >= root.position.x && x <= root.position.x + 180 && y >= root.position.y && y <= root.position.y + 72) return rootId
  const target = nodes.value.find((item) => {
    if (item.id === selfId || !isShown(item)) return false
    const left = item.positionX ?? 0
    const top = item.positionY ?? 0
    return x >= left && x <= left + 170 && y >= top && y <= top + 64
  })
  return target?.id || ''
}
function reparent(node: ProductSpecNode, targetId: string) {
  if (targetId === node.id) return '不能拖到自己下面'
  if (descendantIds(node.id).includes(targetId)) return '不能拖到自己的子节点下面'
  if (targetId === rootId) {
    if (node.nodeType !== 'ATTRIBUTE') return '属性值只能挂在属性下面'
    node.parentId = null
    return ''
  }
  const target = nodes.value.find((item) => item.id === targetId)
  if (!target) return '目标节点不存在'
  if (node.nodeType === 'ATTRIBUTE' && target.nodeType === 'VALUE') {
    node.parentId = target.id
    return ''
  }
  if (node.nodeType === 'ATTRIBUTE') {
    node.parentId = target.id
    return ''
  }
  if (node.nodeType === 'VALUE' && target.nodeType !== 'ATTRIBUTE') return target.nodeType === 'VALUE' ? SPEC_VALUE_TO_VALUE : '属性值只能挂在属性下面'
  node.parentId = target.id
  if (node.nodeType === 'VALUE') node.attributeId = target.attributeId
  return ''
}
function onMoveEnd(event: { flowTransform: { x: number; y: number; zoom: number } }) {
  const row = ensureCanvas()
  row.panX = event.flowTransform.x
  row.panY = event.flowTransform.y
  row.zoom = event.flowTransform.zoom
}
function tidy() {
  arrangeSpecPositions(nodes.value)
  const row = ensureCanvas()
  row.direction = 'ltr'
  ElMessage.success('已按从左到右整理')
}
function setExpanded(expanded: boolean) {
  nodes.value.forEach((item) => {
    if (childCount(item.id)) item.expanded = expanded
  })
}
function toggleExpand(id: string) {
  const row = store.data.productSpecNodes.find((item) => item.id === id)
  if (!row || !childCount(id)) return
  row.expanded = row.expanded === false
}
function saveModel() {
  const problems = illegalStructure()
  if (problems.length) {
    ElMessage.warning(problems[0])
    return
  }
  markWorkingDraft()
  const row = ensureCanvas()
  if (row.status === 'published') {
    ElMessage.success('当前内容和已发布版本一致。')
    return
  }
  row.updatedAt = new Date().toISOString()
  ElMessage.success('已保存为草稿。新商品仍使用最近一次发布的版本。')
}
function publish() {
  const result = store.publishSpecModel(templateId.value)
  if (result.ok) ElMessage.success(result.message)
  else ElMessage.warning(result.message)
}
function markWorkingDraft() {
  const row = ensureCanvas()
  if (row.status === 'offline') return
  const latest = store.data.specModelVersions
    .filter((item) => item.templateId === templateId.value && item.status === 'published')
    .slice()
    .sort((a, b) => a.version - b.version)
    .at(-1)
  if (latest && sameSpecSnapshot(latest.nodesSnapshot, nodes.value)) {
    row.status = 'published'
    row.version = latest.version
    row.versionName = latest.versionName
    return
  }
  const next = (latest?.version || 0) + 1
  row.status = 'draft'
  row.version = next
  row.versionName = `V${next}`
  row.updatedAt = new Date().toISOString()
}
function setAttribute(id: string) {
  if (!current.value || current.value.nodeType !== 'ATTRIBUTE') return
  current.value.attributeId = id
  const bound = store.data.templateParams.find((item) => item.templateId === templateId.value && item.paramId === id)
  current.value.role = bound?.role === 'common' ? 'COMMON' : 'VARIANT'
}
function setRole(role: string | number | boolean) {
  if (!current.value) return
  const next = role === 'COMMON' ? 'COMMON' : 'VARIANT'
  store.data.productSpecNodes.forEach((node) => {
    if (node.templateId === templateId.value && node.nodeType === 'ATTRIBUTE' && node.attributeId === current.value?.attributeId) node.role = next as SpecNodeRole
  })
}
function openAttributeAt(parentId: string | null) {
  attachParent.value = parentId
  attributeIds.value = []
  attributeTitle.value = parentId ? '新增下一级属性' : '新增属性'
  attributeOpen.value = true
}
function openValueAt(parentId: string) {
  attachParent.value = parentId
  valueIds.value = []
  valueOpen.value = true
}
function openChild() {
  if (selected.value === rootId || !current.value) {
    openAttributeAt(null)
    return
  }
  openAttributeAt(current.value.id)
}
function openSibling() {
  if (!current.value) {
    openAttributeAt(null)
    return
  }
  if (current.value.nodeType === 'ATTRIBUTE') openAttributeAt(current.value.parentId)
  else if (current.value.parentId) openValueAt(current.value.parentId)
}
function nextSort(parentId: string | null) {
  return nodes.value.filter((item) => item.parentId === parentId).reduce((max, item) => Math.max(max, item.sort), 0) + 1
}
function addAttribute() {
  const ids = [...new Set(attributeIds.value.filter(Boolean))]
  if (!ids.length) {
    ElMessage.warning('请至少选择一个属性')
    return
  }
  const parentId = attachParent.value
  const parent = nodes.value.find((item) => item.id === parentId)
  if (parent && parent.expanded === false) parent.expanded = true
  const siblings = nodes.value.filter((item) => item.parentId === parentId)
  const baseX = (parent?.positionX ?? 240) + 230
  let cursorY = siblings.length ? Math.max(...siblings.map((item) => item.positionY ?? 40)) + 88 : (parent?.positionY ?? 40) + 36
  let sort = nextSort(parentId)
  let lastId = ''
  ids.forEach((paramId) => {
    const id = uid('sn')
    const bound = store.data.templateParams.find((item) => item.templateId === templateId.value && item.paramId === paramId)
    store.data.productSpecNodes.push({
      id,
      templateId: templateId.value,
      parentId,
      nodeType: 'ATTRIBUTE',
      attributeId: paramId,
      valueId: '',
      role: bound?.role === 'common' ? 'COMMON' : 'VARIANT',
      sort,
      positionX: baseX,
      positionY: cursorY,
    })
    sort += 1
    cursorY += 88
    lastId = id
  })
  selected.value = lastId
  attributeOpen.value = false
}
function addValue() {
  const parent = nodes.value.find((item) => item.id === attachParent.value && item.nodeType === 'ATTRIBUTE')
  const ids = [...new Set(valueIds.value.filter(Boolean))]
  if (!parent || !ids.length) {
    ElMessage.warning('请至少选择一个属性值')
    return
  }
  if (parent.expanded === false) parent.expanded = true
  const siblings = nodes.value.filter((item) => item.parentId === parent.id)
  const baseX = (parent.positionX ?? 240) + 230
  let cursorY = siblings.length ? Math.max(...siblings.map((item) => item.positionY ?? 40)) + 88 : (parent.positionY ?? 40) + 36
  let sort = nextSort(parent.id)
  let lastId = ''
  ids.forEach((nextValue) => {
    const id = uid('sn')
    store.data.productSpecNodes.push({
      id,
      templateId: templateId.value,
      parentId: parent.id,
      nodeType: 'VALUE',
      attributeId: parent.attributeId,
      valueId: nextValue,
      sort,
      positionX: baseX,
      positionY: cursorY,
    })
    sort += 1
    cursorY += 88
    lastId = id
  })
  selected.value = lastId
  valueOpen.value = false
}
function copyNode() {
  if (!current.value) return
  const sourceIds = [current.value.id, ...descendantIds(current.value.id)]
  const map = new Map(sourceIds.map((id) => [id, uid('sn')]))
  nodes.value.filter((item) => sourceIds.includes(item.id)).forEach((item) => {
    const id = map.get(item.id) || uid('sn')
    store.data.productSpecNodes.push({
      ...item,
      id,
      parentId: item.id === current.value?.id ? item.parentId : map.get(item.parentId || '') || null,
      positionX: (item.positionX ?? 0) + 48,
      positionY: (item.positionY ?? 0) + 48,
      sort: item.id === current.value?.id ? item.sort + 1 : item.sort,
    })
  })
  selected.value = map.get(current.value.id) || ''
  ElMessage.success('已复制节点')
}
function descendantIds(id: string): string[] {
  const children = nodes.value.filter((item) => item.parentId === id)
  return children.flatMap((item) => [item.id, ...descendantIds(item.id)])
}
function remove() {
  if (!current.value) return
  const message = store.removeSpecNode(current.value.id)
  if (message) ElMessage.warning(message)
  else {
    selected.value = ''
    ElMessage.success('已删除')
  }
}
function copyModel() {
  const name = copyName.value.trim()
  const source = store.data.templates.find((item) => item.id === templateId.value)
  if (!name || !source) return
  const nextId = uid('tpl')
  store.data.templates.push({ id: nextId, name, parentId: null, enabled: true, structureOrder: [...source.structureOrder] })
  store.data.templateParams.filter((item) => item.templateId === source.id).forEach((item) => store.data.templateParams.push({ ...item, templateId: nextId }))
  const map = new Map(nodes.value.map((item) => [item.id, uid('sn')]))
  nodes.value.forEach((item) => {
    store.data.productSpecNodes.push({
      ...item,
      id: map.get(item.id) || uid('sn'),
      templateId: nextId,
      parentId: item.parentId ? map.get(item.parentId) || null : null,
    })
  })
  store.data.specCanvases.push({ templateId: nextId, zoom: 1, panX: 0, panY: 0, status: 'draft', version: 1, versionName: 'V1', direction: 'ltr' })
  templateId.value = nextId
  copyOpen.value = false
  ElMessage.success('已复制为新的商品模型。它现在是草稿，不会改动已有商品。')
}
function onKey(event: KeyboardEvent) {
  const tag = (event.target as HTMLElement | null)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    saveModel()
    return
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
    event.preventDefault()
    setExpanded(true)
    return
  }
  if (event.key === 'Tab') {
    event.preventDefault()
    openChild()
  } else if (event.key === 'Enter' && selected.value && selected.value !== rootId) {
    event.preventDefault()
    openSibling()
  } else if ((event.key === 'Delete' || event.key === 'Backspace') && current.value) {
    event.preventDefault()
    remove()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
.designer { display: flex; flex-direction: column; height: calc(100vh - 118px); }
.board { display: flex; gap: 14px; flex: 1; min-height: 0; }
.canvas { position: relative; flex: 1; min-width: 0; border: 1px solid var(--line, #e5e7eb); border-radius: 8px; overflow: hidden; background: #f8fafc; }
.canvas :deep(.vue-flow) { width: 100%; height: 100%; }
.side { width: 320px; overflow: auto; }
.model-root, .model-attr, .model-value { position: relative; text-align: center; }
.model-root { min-width: 148px; background: #1f3b66; color: #fff; border-radius: 12px; padding: 16px 18px; font-size: 16px; }
.model-attr { min-width: 132px; background: #e8f1ff; border: 1px solid #2f6fed; border-radius: 8px; padding: 8px 28px 8px 12px; }
.model-attr.is-common { border-color: #2f6fed; background: #e8f1ff; }
.model-attr.is-variant { border-color: #e59a3c; background: #fff4e8; }
.model-attr.is-variant .node-kind,
.model-attr.is-variant .node-role { color: #b86a12; }
.model-attr strong { display: block; color: #1f2d3d; }
.model-attr span { color: #607089; font-size: 12px; }
.model-attr .node-kind,
.model-attr .node-role,
.model-value .node-kind { display: block; font-size: 12px; font-weight: 400; color: #607089; }
.model-value { min-width: 96px; background: #e7f6ee; border: 1px solid #3aaa6d; border-radius: 999px; padding: 8px 28px 8px 14px; color: #145c32; }
.path-preview { position: absolute; left: 12px; bottom: 12px; z-index: 5; background: rgba(255, 255, 255, 0.94); border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 12px; font-size: 12px; color: #1f3b66; }
.path-preview strong { display: block; margin-bottom: 4px; }
.path-preview p { margin: 0; }
.path-preview span { display: block; color: #8aa0b8; line-height: 10px; }
.model-attr.is-on, .model-value.is-on, .model-root.is-on { box-shadow: 0 0 0 2px rgba(47, 111, 237, 0.35); }
.model-attr.is-path { border-color: #1d4f91; background: #d9e8ff; }
.model-value.is-path { border-color: #1f8a52; background: #d8f3e4; }
.model-root.is-path { background: #17345f; }
.fold { position: absolute; right: 4px; top: 6px; width: 18px; height: 18px; border: 1px solid #9eb0c8; border-radius: 4px; background: #fff; cursor: pointer; line-height: 14px; }
.model-attr em, .model-value em { display: block; color: #2f6fed; font-style: normal; font-size: 12px; }
.inline-edit { width: 100%; max-width: 140px; border: 1px solid #2f6fed; border-radius: 4px; background: #fff; color: #1f2d3d; font: inherit; }
.model-root .root-edit { width: 148px; max-width: none; color: #1f2d3d; background: #fff; text-align: center; font-weight: 650; }
.path-line { color: #1f3b66; display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.path-line button { background: none; border: 0; padding: 0; color: #1f3b66; cursor: pointer; }
.version-box { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; margin-bottom: 12px; }
.version-box h2, .version-box h3 { margin: 0 0 6px; font-size: 14px; }
.version-box p { margin: 4px 0; }
.node-card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; margin-bottom: 12px; }
.node-card.is-common { border-color: #7aa2d6; }
.node-card.is-variant { border-color: #d7c4a3; }
.node-card.is-value { border-color: #b7c9be; }
.node-card.is-root { background: #1f3b66; color: #fff; }
.node-card p { display: flex; justify-content: space-between; margin: 6px 0; }
.node-card span { color: #607089; }
.node-card.is-root span { color: #d5e2f5; }
.model-summary { position: absolute; right: 12px; bottom: 12px; z-index: 5; background: rgba(255, 255, 255, 0.94); border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: #607089; }
.model-summary strong { color: #1f2d3d; }
.context-menu { position: fixed; z-index: 40; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 6px; display: flex; flex-direction: column; min-width: 140px; }
.context-menu button { text-align: left; background: none; border: 0; padding: 6px 8px; cursor: pointer; }
</style>
