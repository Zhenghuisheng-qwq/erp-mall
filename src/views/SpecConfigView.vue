<template>
  <div class="designer">
    <div class="workbench">
      <CategoryCatalog
        :rows="categoryRows"
        :leaf-id="leafId"
        :path-ids="categoryPathIds"
        :folded="treeFold"
        :stats="categoryStats"
        @update:folded="treeFold = $event"
        @toggle="toggleCategory"
        @select="selectCategory"
      />
      <TypeModelRail
        :path="leafPath"
        :groups="typeGroups"
        :active-type-id="activeTypeId"
        :template-id="templateId"
        :viewing="viewing"
        @open="openModel"
        @focus-type="focusType"
        @create="createModelFor"
        @copy="openCopyCurrent"
      />
      <div class="work-main">
        <header v-if="templateId" class="studio-head">
          <div class="studio-copy">
            <div class="title-row">
              <h2>{{ schemeTitle }}</h2>
              <span class="version-name">{{ canvas.versionName || 'V1' }}</span>
              <el-tag size="small" :type="statusTagType">{{ canvasStatusText }}</el-tag>
            </div>
            <p class="meta-row">
              <span><em>分类：</em>{{ leafPath || categoryText }}</span>
              <span class="meta-type"><em>关联产品类型：</em>{{ productTypeText }}</span>
              <span><em>关联方式：</em>分类关联</span>
              <span><em>节点数：</em>{{ nodeTotal }}</span>
            </p>
          </div>
        </header>
        <div v-if="templateId" class="key-strip" aria-label="快捷键">
          <span class="key-strip-label">快捷键</span>
          <span><kbd>Tab</kbd> 新增子属性</span>
          <span><kbd>V</kbd> 新增属性值</span>
          <span><kbd>Enter</kbd> {{ enterAction }}</span>
          <span v-if="menuKind !== 'value' || canPromote"><kbd>Shift+Tab</kbd> 提升节点</span>
          <span><kbd>↑↓</kbd> 调整顺序</span>
          <span><kbd>Delete</kbd> 删除节点</span>
          <span><kbd>Ctrl+Z</kbd> 撤销</span>
          <el-popover placement="bottom-start" :width="340" trigger="click">
            <template #reference>
              <button type="button" class="key-more">完整说明</button>
            </template>
            <strong>模型编辑快捷键</strong>
            <p class="key-lead">Tab 新增子属性。V 在选中属性时新增属性值。两者都从属性词典选择，不会生成空白节点。</p>
            <ul class="key-list">
              <li><kbd>Tab</kbd> 新增子属性</li>
              <li><kbd>V</kbd> 新增属性值</li>
              <li><kbd>Enter</kbd> 新增同级节点</li>
              <li><kbd>Shift+Tab</kbd> 提升节点层级</li>
              <li><kbd>↑ ↓</kbd> 调整同级顺序</li>
              <li><kbd>Delete</kbd> 删除选中节点</li>
              <li><kbd>Ctrl+Z</kbd> 撤销</li>
              <li><kbd>Ctrl+Enter</kbd> 完成编辑</li>
              <li><kbd>Esc</kbd> 取消编辑</li>
            </ul>
            <p class="key-group">属性可以继续嵌套属性。属性值挂在所属属性下，也可以从属性值再挂条件属性。</p>
          </el-popover>
        </div>
        <div v-if="templateId && !viewing && selected" class="node-ops">
          <strong>{{ current ? nodeTitle(current) : '模型' }}</strong>
          <el-button v-if="menuKind === 'model'" size="small" @click="runMenu('add-attribute')">添加属性</el-button>
          <template v-else-if="menuKind === 'attribute'">
            <el-button size="small" @click="runMenu('add-child')">添加子属性</el-button>
            <el-button size="small" @click="runMenu('add-value')">添加属性值</el-button>
            <el-button size="small" @click="runMenu('naming')">命名规则</el-button>
            <el-button size="small" @click="runMenu('rename')">编辑</el-button>
            <el-button size="small" type="danger" @click="runMenu('delete')">删除</el-button>
          </template>
          <template v-else>
            <el-button size="small" @click="runMenu('add-child')">添加条件属性</el-button>
            <el-button size="small" @click="runMenu('naming')">命名规则</el-button>
            <el-button size="small" @click="runMenu('rename')">编辑</el-button>
            <el-button size="small" type="danger" @click="runMenu('delete')">删除</el-button>
          </template>
        </div>
        <div v-if="templateId" class="head-tools">
            <el-segmented v-model="editorMode" class="view-switch" :options="modeOptions" />
            <div class="op-bar">
              <el-button-group>
                <el-button v-if="!viewing" @click="tidy">自动布局</el-button>
                <el-button @click="setExpanded(true)">全部展开</el-button>
                <el-button @click="setExpanded(false)">全部收起</el-button>
              </el-button-group>
              <el-popover placement="bottom-end" :width="300" trigger="click">
                <template #reference>
                  <el-button>发布记录</el-button>
                </template>
                <div class="version-pop">
                  <h3>当前版本：{{ canvas.versionName || 'V1' }}</h3>
                  <p>{{ canvasStatusText }}。修改已发布模型会变成下一版草稿，新商品仍用最近一次发布快照。</p>
                  <h3>发布记录</h3>
                  <p v-if="records.length === 0" class="muted">还没有发布版本。</p>
                  <p v-for="item in records" :key="item.id">{{ item.versionName }} · {{ item.time }} · {{ item.products }} 个商品</p>
                </div>
              </el-popover>
              <el-button v-if="!viewing" @click="saveModel">保存模型</el-button>
              <el-button v-if="!viewing" type="primary" @click="publish">发布模型</el-button>
            </div>
        </div>
        <EmptyModelGuide
          v-else-if="showEmptyGuide"
          :category-path="leafPath"
          :type-name="activeTypeName"
          :viewing="viewing"
          @create="createModelFor(activeTypeId)"
          @copy="openCopyPicker"
        />
        <div v-else class="quiet-guide">
          <h2>{{ leafId ? '选择一个商品模型' : '从左侧选择分类' }}</h2>
          <p>{{ leafId ? '在中间选一个产品类型，再打开商品模型。' : '先选分类，再选产品类型和商品模型。' }}</p>
        </div>
        <section v-if="templateId && comboRows.length" class="combo-preview">
          <button type="button" class="combo-toggle" @click="comboOpen = !comboOpen">
            <span>合法组合 {{ comboRows.length }} 条</span>
            <span>{{ comboNumbered }} 条已有规划编号</span>
          </button>
          <div v-if="checkedIds.length" class="combo-batch">
            <span>已选 {{ checkedIds.length }} 条</span>
            <el-button size="small" @click="markGrade('core')">标为核心商品</el-button>
            <el-button size="small" @click="markGrade('general')">标为一般产品</el-button>
          </div>
          <ul v-show="comboOpen">
            <li v-for="row in comboRows" :key="row.key">
              <label v-if="row.planningId" class="combo-check"><input type="checkbox" :checked="checkedIds.includes(row.planningId)" @change="toggleCheck(row.planningId)" /></label>
              <button type="button" :class="{ 'is-on': row.key === selectedComboKey }" @click="selectedComboKey = row.key">
                <span>{{ row.label }}</span>
                <em>{{ row.retired ? '已停用' : row.note }}</em>
              </button>
            </li>
          </ul>
          <el-button v-if="canvasContext.productTypeId" class="temp-entry" @click="temporaryOpen = true">创建临时物料</el-button>
          <TemporaryMaterialDialog :open="temporaryOpen" :category-id="canvasContext.categoryId" :product-type-id="canvasContext.productTypeId" :product-model-id="templateId" :model-version-id="latestPublishedVersion(store.data, templateId)?.id" @close="temporaryOpen = false" @open="openTemporary" />
          <V3MaterialActions
            v-if="selectedCombo && canvasContext.productTypeId"
            :product-model-id="templateId"
            :model-version-id="selectedCombo.modelVersionId"
            :planning-id="selectedCombo.planningId"
            :category-id="canvasContext.categoryId"
            :product-type-id="canvasContext.productTypeId"
            :retired="selectedCombo.retired"
          />
        </section>
        <section v-if="templateId && temporaryMaterials.length" class="combo-preview">
          <button type="button" class="combo-toggle" @click="temporaryListOpen = !temporaryListOpen">
            <span>临时物料 {{ temporaryMaterials.length }} 条</span>
            <span>对不上正式规划，编号以 TMP 开头</span>
          </button>
          <ul v-show="temporaryListOpen">
            <li v-for="item in temporaryMaterials.slice(0, 30)" :key="item.id">
              <button type="button" @click="router.push(`/products/${item.familyId}`)">
                <span>{{ item.materialCode }} · {{ item.skuName }}</span>
                <em>{{ item.planningId }} · 供应商 {{ item.supplierCode || '未填' }}</em>
              </button>
            </li>
          </ul>
          <p v-if="temporaryMaterials.length > 30" class="muted">这里只列出前 30 条。其余到商品列表按供应商编码或物料编码搜索。</p>
        </section>
        <div v-if="templateId" class="board" tabindex="0" @pointerdown="focusBoard">
      <div v-if="editorMode === 'canvas'" class="canvas">
        <VueFlow
          id="model-designer"
          :nodes="flowNodes"
          :edges="flowEdges"
          :nodes-connectable="false"
          :nodes-draggable="!viewing"
          :default-viewport="{ x: canvas.panX, y: canvas.panY, zoom: canvas.zoom || 0.88 }"
          :default-edge-options="{ type: 'tree' }"
          :min-zoom="0.2"
          :max-zoom="1.6"
          @nodes-initialized="onNodesReady"
          @node-click="onNodeClick"
          @node-double-click="onNodeDoubleClick"
          @node-context-menu="onNodeMenu"
          @node-drag-stop="onNodeDragStop"
          @move-end="onMoveEnd"
          @pane-click="closeFloating"
        >
          <Background variant="dots" :gap="22" :size="1.1" pattern-color="#e1e8f0" />
          <Controls />
          <MiniMap />
          <template #edge-tree="{ source, data }">
            <path :d="treeBusPath(source, data?.childIds || [])" class="tree-bus" />
          </template>
          <template #node-model="{ data }">
            <div class="model-root" :class="{ 'is-on': data.selected, 'is-path': data.onPath }" title="双击修改名称">
              <input v-if="editingId === data.id" class="inline-edit root-edit" :value="data.label" @keydown.enter.prevent="commitRootName" @keydown.esc.stop="cancelRootEdit" @blur="commitRootName" @mousedown.stop @pointerdown.stop @click.stop @dblclick.stop />
              <strong v-else>{{ data.label }}</strong>
              <Handle type="source" :position="Position.Right" />
            </div>
          </template>
          <template #node-attribute="{ data }">
            <div class="model-attr" :class="{ 'is-on': data.selected, 'is-path': data.onPath, 'is-head': data.head, 'is-unbound': !data.bound }" :title="data.bound ? `绑定：${data.label} · 属性词典` : '未绑定属性'">
              <Handle type="target" :position="Position.Left" />
              <select v-if="editingId === data.id" class="inline-edit" :value="data.editValue" @change="commitInline(data.id, 'attribute', $event)" @blur="editingId = ''" @mousedown.stop @pointerdown.stop @click.stop @dblclick.stop>
                <option v-for="item in data.options" :key="item.value" :value="item.value">{{ item.label }}</option>
              </select>
              <template v-else>
                <strong>{{ data.label }}</strong>
                <p v-if="data.bound" class="attr-meta">属性来源：属性词典</p>
                <button v-if="!data.bound && !viewing" type="button" class="pick-attr" @mousedown.stop @pointerdown.stop @click.stop="openBindAttribute(data.id)" @dblclick.stop>选择属性</button>
              </template>
              <button v-if="data.childCount" type="button" class="fold" @click.stop="toggleExpand(data.id)" @dblclick.stop>{{ data.expanded ? '−' : data.childCount }}</button>
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
              <button v-if="data.childCount" type="button" class="fold" @click.stop="toggleExpand(data.id)" @dblclick.stop>{{ data.expanded ? '−' : data.childCount }}</button>
              <Handle type="source" :position="Position.Right" />
            </div>
          </template>
        </VueFlow>
        <div v-if="nodes.length === 0" class="structure-empty">
          <p>还没有商品结构</p>
          <div v-if="!viewing" class="structure-start">
            <span>快速开始</span>
            <el-button size="small" @click="openAttributeAt(null)">添加属性</el-button>
            <el-button size="small" @click="openCopyPicker">复制已有模型</el-button>
          </div>
        </div>
        <div class="canvas-tools">
          <el-segmented v-model="viewMode" size="small" :options="viewOptions" />
        </div>
      </div>
      <ModelOutline
        v-else-if="editorMode === 'outline'"
        :nodes="nodes"
        :root-title="schemeTitle"
        :root-id="rootId"
        :active-id="selected"
        :viewing="viewing"
        :focus-tick="outlineCue.tick"
        :focus-id="outlineCue.id"
        :label="nodeTitle"
        :attribute-hint="attributeHint"
        @select="pickNode"
        @rename-root="applyRootName"
        @rename="renameOutline"
        @add="addOutline"
        @remove="removeOutline"
        @promote="promoteOutline"
        @shift="shiftOutline"
        @undo="undoOutline"
        @ask="openNodeDraft"
        @create-attribute="openAttributeAt(null)"
        @copy-model="openCopyPicker"
        @toggle="toggleExpand"
        @move="moveOutline"
        @menu="openNodeMenu"
        @bind="openBindAttribute"
      />
      <ModelOutline
        v-else
        mubu
        :nodes="nodes"
        :root-title="schemeTitle"
        :root-id="rootId"
        :active-id="selected"
        :viewing="viewing"
        :focus-tick="outlineCue.tick"
        :focus-id="outlineCue.id"
        :label="nodeTitle"
        :attribute-hint="attributeHint"
        @select="pickNode"
        @rename-root="applyRootName"
        @rename="renameOutline"
        @add="addOutline"
        @remove="removeOutline"
        @promote="promoteOutline"
        @shift="shiftOutline"
        @undo="undoOutline"
        @ask="openNodeDraft"
        @create-attribute="openAttributeAt(null)"
        @copy-model="openCopyPicker"
        @toggle="toggleExpand"
        @move="moveOutline"
        @menu="openNodeMenu"
        @bind="openBindAttribute"
      />
        </div>
      </div>
    </div>
    <div v-if="menu.open && !viewing" class="context-menu" :style="{ left: menu.x + 'px', top: menu.y + 'px' }" @pointerdown.stop @click.stop>
      <template v-if="menuKind === 'model'">
        <el-button text @click="runMenu('add-attribute')">添加属性</el-button>
      </template>
      <template v-else-if="menuKind === 'attribute'">
        <el-button text @click="runMenu('add-child')">添加子属性</el-button>
        <el-button text @click="runMenu('add-value')">添加属性值</el-button>
        <el-button text @click="runMenu('sibling')">添加同级属性</el-button>
        <el-button text @click="runMenu('rename')">编辑名称</el-button>
        <el-button text @click="runMenu('naming')">命名规则</el-button>
        <el-button text type="danger" @click="runMenu('delete')">删除节点</el-button>
      </template>
      <template v-else>
        <el-button text @click="runMenu('sibling')">添加同级属性值</el-button>
        <el-button text @click="runMenu('add-child')">添加条件属性</el-button>
        <el-button text @click="runMenu('rename')">编辑名称</el-button>
        <el-button text @click="runMenu('naming')">命名规则</el-button>
        <el-button text type="danger" @click="runMenu('delete')">删除节点</el-button>
      </template>
    </div>
    <NamingRuleDialog :open="namingOpen" :node-id="selected" :template-id="templateId" @close="namingOpen = false" @saved="markWorkingDraft" />
    <el-dialog v-model="attributeOpen" :title="attributeTitle" width="420px" @closed="resetAttrComposer">
      <el-select v-if="attributeBindId" v-model="attributePick" filterable placeholder="选择属性词典中的属性" style="width: 100%">
        <el-option v-for="item in attributeChoices" :key="item.id" :label="item.name" :value="item.id" />
      </el-select>
      <el-select v-else v-model="attributeIds" multiple filterable collapse-tags collapse-tags-tooltip placeholder="选择属性词典中的属性，可多选" style="width: 100%">
        <el-option v-for="item in attributeChoices" :key="item.id" :label="item.name" :value="item.id" />
      </el-select>
      <div class="dict-create">
        <el-button v-if="!creatingAttr" link type="primary" @click="creatingAttr = true">创建属性</el-button>
        <template v-else>
          <el-input v-model="newAttrName" placeholder="新属性名称" @keydown.enter.prevent="createDictionaryAttribute" />
          <el-button type="primary" @click="createDictionaryAttribute">创建并绑定</el-button>
        </template>
      </div>
      <template #footer>
        <el-button @click="attributeOpen = false">取消</el-button>
        <el-button type="primary" @click="addAttribute">确定</el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="valueOpen" title="选择属性值" width="420px">
      <p v-if="valueParentName" class="dict-empty">从「{{ valueParentName }}」的属性值里选择</p>
      <p v-if="valueChoices.length === 0" class="dict-empty">这个属性在词典里还没有可添加的属性值。</p>
      <el-select v-else v-model="valuePicks" multiple filterable collapse-tags collapse-tags-tooltip placeholder="选择属性值，可多选" style="width: 100%">
        <el-option v-for="item in valueChoices" :key="item" :label="item" :value="item" />
      </el-select>
      <template #footer>
        <el-button @click="valueOpen = false">取消</el-button>
        <el-button type="primary" :disabled="valueChoices.length === 0" @click="addValues">确定</el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="nodeDraftOpen" title="新增节点" width="420px">
      <p class="muted">类型</p>
      <el-radio-group v-model="nodeDraft.type">
        <el-radio value="ATTRIBUTE">属性节点</el-radio>
        <el-radio value="VALUE">属性值节点</el-radio>
      </el-radio-group>
      <el-input v-model="nodeDraft.name" placeholder="名称" style="margin-top: 12px" @keydown.enter.prevent="confirmNodeDraft" />
      <template #footer>
        <el-button @click="nodeDraftOpen = false">取消</el-button>
        <el-button type="primary" @click="confirmNodeDraft">确认</el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="copyOpen" title="复制模型" width="440px">
      <p class="copy-label">原模型</p>
      <strong v-if="!copyPick" class="copy-source">{{ copySourceName }}</strong>
      <el-select v-else v-model="copySourceId" placeholder="选择已有模型" style="width: 100%">
        <el-option v-for="item in copyChoices" :key="item.id" :label="item.label" :value="item.id" />
      </el-select>
      <p v-if="copyPick && copyChoices.length === 0" class="muted">还没有可复制的模型。</p>
      <p class="copy-label">新模型名称</p>
      <el-input v-model="copyName" placeholder="例如：二手机模型" @keydown.enter.prevent="confirmCopy" />
      <p class="muted">复制节点树、节点关系和属性、值引用。不复制发布记录和商品数据。</p>
      <template #footer>
        <el-button @click="copyOpen = false">取消</el-button>
        <el-button type="primary" @click="confirmCopy">确认复制</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { Handle, Position, useVueFlow, VueFlow } from '@vue-flow/core'
import { MiniMap } from '@vue-flow/minimap'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ModelOutline from '../components/ModelOutline.vue'
import CategoryCatalog from '../components/model-editor/CategoryCatalog.vue'
import { cloneProductModel } from '../components/model-editor/cloneModel'
import EmptyModelGuide from '../components/model-editor/EmptyModelGuide.vue'
import TypeModelRail from '../components/model-editor/TypeModelRail.vue'
import { categoryChain, visibleCategoryRows } from '../domain/categoryTree'
import { arrangeSpecPositions, categoryPath, latestPublishedVersion, layoutSpecTree, sameSpecSnapshot, SPEC_VALUE_TO_VALUE } from '../domain/logic'
import { legalPlanningCombinations } from '../domain/planning'
import NamingRuleDialog from '../components/NamingRuleDialog.vue'
import TemporaryMaterialDialog from '../components/TemporaryMaterialDialog.vue'
import { filingText, gradeText } from '../domain/material'
import V3MaterialActions from '../components/V3MaterialActions.vue'
import type { ProductSpecNode, ParamDef } from '../domain/types'
import { uid, useCatalogStore } from '../stores/catalog'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'

const store = useCatalogStore()
const route = useRoute()
const router = useRouter()
const { fitView, findNode, onNodesChange } = useVueFlow({ id: 'model-designer' })
const flowRevision = ref(0)
onNodesChange(() => {
  flowRevision.value += 1
})
const templateId = ref(typeof route.query.template === 'string' ? route.query.template : '')
watch(
  () => route.query.template,
  (value) => {
    if (typeof value === 'string' && value) templateId.value = value
  },
)
const treeFold = ref(false)
const viewing = computed(() => route.query.mode === 'view')
const leafId = ref('')
const activeTypeId = ref('')
const closedIds = ref(new Set<string>())
const categoryRows = computed(() => {
  const parents = new Set(store.data.categories.map((item) => item.parentId).filter((id): id is string => Boolean(id)))
  return visibleCategoryRows(store.data.categories, parents, '', closedIds.value)
})
const categoryPathIds = computed(() => (leafId.value ? categoryChain(store.data.categories, leafId.value).map((item) => item.id) : []))
const leafTypes = computed(() => store.data.productTypes.filter((item) => item.categoryId === leafId.value).slice().sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'zh')))
const leafPath = computed(() => (leafId.value ? categoryPath(store.data, leafId.value) : ''))
const typeGroups = computed(() => leafTypes.value.map((type) => ({
  id: type.id,
  name: type.name,
  models: store.data.specCanvases
    .filter((item) => item.productTypeId === type.id)
    .map((item) => ({
      templateId: item.templateId,
      name: item.name?.trim() || store.data.templates.find((tpl) => tpl.id === item.templateId)?.name || '未命名模型',
      published: item.status === 'published',
    })),
})))
const categoryStats = computed(() => {
  const stats: Record<string, { types: number; models: number }> = {}
  const parents = new Set(store.data.categories.map((item) => item.parentId).filter((id): id is string => Boolean(id)))
  store.data.categories.forEach((category) => {
    if (parents.has(category.id)) return
    const types = store.data.productTypes.filter((item) => item.categoryId === category.id)
    const ids = new Set(types.map((item) => item.id))
    stats[category.id] = {
      types: types.length,
      models: store.data.specCanvases.filter((item) => item.productTypeId && ids.has(item.productTypeId)).length,
    }
  })
  return stats
})
const activeType = computed(() => leafTypes.value.find((item) => item.id === activeTypeId.value) || leafTypes.value[0])
const activeTypeName = computed(() => activeType.value?.name || '')
const activeTypeModels = computed(() => typeGroups.value.find((item) => item.id === activeType.value?.id)?.models || [])
const showEmptyGuide = computed(() => Boolean(leafId.value && activeType.value && activeTypeModels.value.length === 0 && !templateId.value))
function toggleCategory(id: string) {
  const next = new Set(closedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  closedIds.value = next
}
function clearOpenModel() {
  templateId.value = ''
  router.replace({ path: '/specs', query: viewing.value ? { mode: 'view' } : {} })
}
function belongsToLeaf(id: string) {
  return typeGroups.value.some((group) => group.models.some((item) => item.templateId === id))
}
function selectCategory(id: string) {
  leafId.value = id
  if (!leafTypes.value.some((item) => item.id === activeTypeId.value)) activeTypeId.value = leafTypes.value[0]?.id || ''
  if (templateId.value && !belongsToLeaf(templateId.value)) clearOpenModel()
}
function focusType(typeId: string) {
  activeTypeId.value = typeId
  const owns = typeGroups.value.find((group) => group.id === typeId)?.models.some((item) => item.templateId === templateId.value)
  if (templateId.value && !owns) clearOpenModel()
}
function openModel(id: string) {
  templateId.value = id
  router.replace({ path: '/specs', query: viewing.value ? { template: id, mode: 'view' } : { template: id } })
}
async function createModelFor(typeId: string) {
  const type = store.data.productTypes.find((item) => item.id === typeId)
  if (!type || viewing.value) return
  activeTypeId.value = typeId
  try {
    const result = await ElMessageBox.prompt('模型名称', '创建空白模型', { inputValue: `${type.name}模型` })
    const created = store.createProductModel({ productTypeId: type.id, name: result.value })
    if (!created.ok) {
      ElMessage.warning(created.message)
      return
    }
    openModel(created.templateId)
  } catch {
    return
  }
}
const selected = ref('')
const viewMode = ref<'all' | 'attribute' | 'value'>('all')
const editorMode = ref<'canvas' | 'outline' | 'document'>('canvas')
const modeOptions = [
  { label: '结构视图', value: 'canvas' },
  { label: '大纲视图', value: 'outline' },
  { label: '幕布模式', value: 'document' },
]
const viewOptions = [
  { label: '完整结构', value: 'all' },
  { label: '属性', value: 'attribute' },
  { label: '值', value: 'value' },
]
const outlineCue = ref({ id: '', tick: 0 })
const undoStack = ref<string[]>([])
const nodeDraftOpen = ref(false)
const nodeDraft = ref({ type: 'ATTRIBUTE' as 'ATTRIBUTE' | 'VALUE', name: '' })
const editingId = ref('')
const menu = ref({ open: false, x: 0, y: 0 })
const attributeOpen = ref(false)
const copyOpen = ref(false)
const namingOpen = ref(false)
const copyPick = ref(false)
const copySourceId = ref('')
const copyTargetTypeId = ref('')
const attributeIds = ref<string[]>([])
const attributeBindId = ref('')
const attributePick = ref('')
const attributeTitle = ref('选择属性')
const creatingAttr = ref(false)
const newAttrName = ref('')
const valueOpen = ref(false)
const valueParentId = ref('')
const valuePicks = ref<string[]>([])
const copyName = ref('')
const rootId = 'model-root'
let skipRootCommit = false
const attachParent = ref<string | null>(null)
type FlowOption = { value: string; label: string }
type FlowNodeData = { id: string; label: string; role?: string; head?: boolean; selected: boolean; onPath: boolean; expanded: boolean; childCount: number; editValue: string; options: FlowOption[]; bound: boolean; source: string; valueText: string }
const flowNodes = ref<{ id: string; type: string; position: { x: number; y: number }; data: FlowNodeData }[]>([])
const flowEdges = ref<{ id: string; source: string; target: string; type: string; data: { childIds: string[] } }[]>([])
let didInitialFit = false

const nodes = computed(() => store.data.productSpecNodes.filter((item) => item.templateId === templateId.value))
const comboOpen = ref(true)
const selectedComboKey = ref('')
const checkedIds = ref<string[]>([])
const temporaryOpen = ref(false)
const temporaryListOpen = ref(true)
const temporaryMaterials = computed(() => {
  if (!templateId.value) return []
  const ids = new Set((store.data.planningRecords || []).filter((item) => item.origin === 'temporary' && item.productModelId === templateId.value).map((item) => item.planningId))
  return store.data.skus.filter((item) => item.planningId && ids.has(item.planningId))
})
const comboRows = computed(() => {
  if (!templateId.value) return []
  const known = store.data.planningRecords || []
  const versionId = latestPublishedVersion(store.data, templateId.value)?.id || ''
  return legalPlanningCombinations(store.data, templateId.value, nodes.value).map((row) => {
    const matched = known.find((item) => item.productModelId === templateId.value && item.identityKey === row.identityKey)
    return {
      key: row.identityKey,
      label: row.label,
      planningId: matched?.status === 'active' ? matched.planningId : '',
      modelVersionId: matched?.status === 'active' ? matched.modelVersionId : versionId,
      retired: matched?.status === 'retired',
      note: matched?.status === 'retired' ? '已停用' : matched?.planningId ? `${matched.planningId} · ${gradeText(matched.grade)} · ${filingText(matched.grade, store.data.skus.filter((item) => item.planningId === matched.planningId).length)}` : '发布后自动编号',
    }
  })
})
const comboNumbered = computed(() => comboRows.value.filter((item) => item.planningId).length)
const selectedCombo = computed(() => comboRows.value.find((item) => item.key === selectedComboKey.value))
const canvasContext = computed(() => {
  const canvas = store.data.specCanvases.find((item) => item.templateId === templateId.value)
  const productType = store.data.productTypes.find((item) => item.id === canvas?.productTypeId)
  return { productTypeId: canvas?.productTypeId || '', categoryId: productType?.categoryId || '' }
})
const current = computed(() => nodes.value.find((item) => item.id === selected.value))
const menuKind = computed<'model' | 'attribute' | 'value'>(() => {
  if (!current.value || selected.value === rootId) return 'model'
  return current.value.nodeType === 'VALUE' ? 'value' : 'attribute'
})
const canPromote = computed(() => {
  const node = current.value
  if (!node?.parentId) return menuKind.value !== 'value'
  if (node.nodeType !== 'VALUE') return true
  const parent = nodes.value.find((item) => item.id === node.parentId)
  const grand = parent?.parentId ? nodes.value.find((item) => item.id === parent.parentId) : undefined
  return grand?.nodeType === 'ATTRIBUTE'
})
const enterAction = computed(() => {
  if (menuKind.value === 'attribute') return '新增同级属性'
  if (menuKind.value === 'value') return '新增同级值'
  return '新增同级节点'
})
const canvas = computed(() => store.data.specCanvases.find((item) => item.templateId === templateId.value) || { templateId: templateId.value, zoom: 1, panX: 0, panY: 0, status: 'draft' as const, version: 1, versionName: 'V1' })
const canvasStatusText = computed(() => (canvas.value.status === 'published' ? '已发布' : canvas.value.status === 'offline' ? '已下线' : '草稿'))
const statusTagType = computed(() => (canvas.value.status === 'published' ? 'success' : canvas.value.status === 'offline' ? 'warning' : 'info'))
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
const attributeChoices = computed(() => store.data.params.slice().sort((a, b) => a.name.localeCompare(b.name, 'zh')))
const valueChoices = computed(() => {
  const parent = nodes.value.find((item) => item.id === valueParentId.value && item.nodeType === 'ATTRIBUTE')
  const defined = store.data.params.find((item) => item.id === parent?.attributeId)?.values || []
  const used = new Set(nodes.value.filter((item) => item.parentId === valueParentId.value && item.nodeType === 'VALUE').map((item) => item.valueId))
  return defined.filter((item) => !used.has(item))
})
const valueParentName = computed(() => {
  const parent = nodes.value.find((item) => item.id === valueParentId.value)
  return parent ? nodeTitle(parent) : ''
})
const schemeTitle = computed(() => store.data.specCanvases.find((item) => item.templateId === templateId.value)?.name?.trim() || store.data.templates.find((item) => item.id === templateId.value)?.name?.trim() || '商品模型')
const currentProductType = computed(() => {
  const canvasRow = store.data.specCanvases.find((item) => item.templateId === templateId.value)
  return store.data.productTypes.find((item) => item.id === canvasRow?.productTypeId)
})
const categoryText = computed(() => (currentProductType.value ? categoryPath(store.data, currentProductType.value.categoryId) : '未指定'))
const productTypeText = computed(() => currentProductType.value?.name || '未指定')
const nodeTotal = computed(() => nodes.value.length)

watch(templateId, () => {
  if (!templateId.value) return
  didInitialFit = false
  selected.value = ''
  ensureCanvas()
  ensureTreeLayout()
  const canvasRow = store.data.specCanvases.find((item) => item.templateId === templateId.value)
  const owner = store.data.productTypes.find((item) => item.id === canvasRow?.productTypeId)
  if (owner) {
    leafId.value = owner.categoryId
    activeTypeId.value = owner.id
  }
}, { immediate: true })
watch(editorMode, (mode) => {
  menu.value.open = false
  if ((mode === 'outline' || mode === 'document') && selected.value) revealAncestors(selected.value)
})
watch(
  () => [templateId.value, selected.value, editingId.value, viewMode.value, store.data.productSpecNodes.map((item) => `${item.id}:${item.parentId}:${item.positionX}:${item.positionY}:${item.attributeId}:${item.valueId}:${item.role}:${item.expanded}`).join('|'), store.data.params.map((item) => `${item.id}:${item.name}`).join('|')].join('#'),
  paint,
  { immediate: true },
)
watch(viewMode, () => {
  frameCanvas()
})
watch(
  () => `${templateId.value}#${nodes.value.map((item) => `${item.id}:${item.parentId}:${item.nodeType}:${item.attributeId}:${item.valueId}:${item.role || ''}:${item.sort}`).join('|')}`,
  (_next, prev) => {
    if (!prev || viewing.value) return
    if (prev.slice(0, prev.indexOf('#')) !== templateId.value) return
    markWorkingDraft()
  },
)

function ensureTreeLayout() {
  const row = ensureCanvas()
  if (row.direction === 'logic' || row.direction === 'custom') return
  arrangeSpecPositions(nodes.value)
  row.direction = 'logic'
}
function reflowTree() {
  ensureCanvas()
}
function ensureCanvas() {
  let row = store.data.specCanvases.find((item) => item.templateId === templateId.value)
  if (!row) {
    row = { templateId: templateId.value, zoom: 1, panX: 0, panY: 0, status: 'draft', version: 1, versionName: 'V1', direction: 'ltr' }
    store.data.specCanvases.push(row)
  }
  if (!row.productTypeId) {
    const mapping = store.data.mappings.find((item) => item.templateId === row.templateId)
    const owner = store.data.productTypes.find((item) => mapping && item.categoryId === mapping.categoryId) || store.data.productTypes[0]
    if (owner) row.productTypeId = owner.id
  }
  if (!row.name) row.name = store.data.templates.find((item) => item.id === row.templateId)?.name || '商品模型'
  return row
}
function attributeSourceLabel(name: string) {
  const text = name.trim()
  if (!text) return '属性'
  return text.endsWith('属性') ? text : `${text}属性`
}
function attributeValueText(node: ProductSpecNode) {
  return nodes.value
    .filter((item) => item.parentId === node.id && item.nodeType === 'VALUE' && item.valueId)
    .sort((a, b) => a.sort - b.sort)
    .map((item) => item.valueId)
    .join('、')
}
function attributeHint(node: ProductSpecNode): { bound: boolean; source: string; values: string } {
  const param = node.nodeType === 'ATTRIBUTE' && node.attributeId ? store.data.params.find((item) => item.id === node.attributeId) : undefined
  if (!param) return { bound: false, source: '', values: '' }
  return { bound: true, source: attributeSourceLabel(param.name), values: attributeValueText(node) }
}
function nodeTitle(node: ProductSpecNode) {
  if (node.nodeType === 'VALUE') return node.valueId || '未命名取值'
  return attributeHint(node).bound ? store.data.params.find((item) => item.id === node.attributeId)?.name || '未绑定属性' : '未绑定属性'
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
function matchesView(node: ProductSpecNode) {
  if (viewMode.value === 'attribute') return node.nodeType === 'ATTRIBUTE'
  if (viewMode.value === 'value') return node.nodeType === 'VALUE'
  return true
}
function isShown(node: ProductSpecNode) {
  if (!matchesView(node)) return false
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
function visibleAnchor(node: ProductSpecNode) {
  let parentId = node.parentId
  const guard = new Set<string>()
  while (parentId && !guard.has(parentId)) {
    guard.add(parentId)
    const parent = nodes.value.find((item) => item.id === parentId)
    if (!parent) break
    if (isShown(parent)) return parent.id
    parentId = parent.parentId
  }
  return rootId
}
function viewChildCount(id: string): number {
  return nodes.value.filter((item) => item.parentId === id).reduce((sum, child) => sum + (matchesView(child) ? 1 : 0) + viewChildCount(child.id), 0)
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
  const projected = viewMode.value === 'all'
    ? null
    : layoutSpecTree(visible.map((node) => ({
      id: node.id,
      parentId: visibleAnchor(node) === rootId ? null : visibleAnchor(node),
      sort: node.sort,
      nodeType: node.nodeType,
    })))
  const posOf = (node: ProductSpecNode) => projected?.get(node.id) || { x: node.positionX ?? 248, y: node.positionY ?? 36 }
  const anchored = visible.filter((node) => visibleAnchor(node) === rootId)
  const basis = anchored.length ? anchored : visible
  const rootY = basis.length ? Math.round(basis.reduce((sum, item) => sum + posOf(item).y + (item.nodeType === 'VALUE' ? 13 : 17), 0) / basis.length - 16) : 48
  flowNodes.value = [
    { id: rootId, type: 'model', position: { x: 16, y: rootY }, data: { id: rootId, label: schemeTitle.value, selected: selected.value === rootId, onPath: highlight.has(rootId), expanded: true, childCount: basis.length, editValue: '', options: [], bound: false, source: '', valueText: '' } },
    ...visible.map((node) => {
      const hint = node.nodeType === 'ATTRIBUTE' ? attributeHint(node) : { bound: false, source: '', values: '' }
      return {
        id: node.id,
        type: node.nodeType === 'ATTRIBUTE' ? 'attribute' : 'value',
        position: posOf(node),
        data: {
          id: node.id,
          label: nodeTitle(node),
          role: node.role,
          head: node.nodeType === 'ATTRIBUTE' && !node.parentId,
          selected: node.id === selected.value,
          onPath: highlight.has(node.id),
          expanded: node.expanded !== false,
          childCount: viewChildCount(node.id),
          editValue: node.nodeType === 'ATTRIBUTE' ? node.attributeId : node.valueId,
          options: node.nodeType === 'ATTRIBUTE' ? attributeOptions() : valueOptions(node),
          bound: hint.bound,
          source: hint.source,
          valueText: hint.values,
        },
      }
    }),
  ]
  const buses = new Map<string, string[]>()
  visible.forEach((node) => {
    const parent = visibleAnchor(node)
    const list = buses.get(parent) || []
    list.push(node.id)
    buses.set(parent, list)
  })
  flowEdges.value = [...buses.entries()].map(([source, childIds]) => ({
    id: `bus-${source}`,
    source,
    target: childIds[0],
    type: 'tree',
    data: { childIds },
  }))
}
function measuredBox(id: string) {
  const live = findNode(id)
  const stored = flowNodes.value.find((item) => item.id === id)
  const x = live?.position.x ?? stored?.position.x
  const y = live?.position.y ?? stored?.position.y
  if (x === undefined || y === undefined) return null
  const width = live?.dimensions?.width || (id === rootId ? 124 : stored?.type === 'value' ? 72 : 112)
  const height = live?.dimensions?.height || (id === rootId ? 36 : stored?.type === 'value' ? 28 : 44)
  return { x, y, width, height }
}
function treeBusPath(sourceId: string, childIds: string[]) {
  flowRevision.value
  const parent = measuredBox(sourceId)
  const children = childIds.map((id) => measuredBox(id)).filter((item): item is { x: number; y: number; width: number; height: number } => Boolean(item))
  if (!parent || !children.length) return ''
  const sx = Math.round(parent.x + parent.width)
  const sy = Math.round(parent.y + parent.height / 2)
  const targets = children
    .map((item) => ({ x: Math.round(item.x), y: Math.round(item.y + item.height / 2) }))
    .filter((item) => item.x > sx + 4)
    .sort((a, b) => a.y - b.y)
  if (!targets.length) return ''
  if (targets.length === 1) {
    const target = targets[0]
    if (target.y === sy) return `M ${sx} ${sy} H ${target.x}`
    const mid = Math.round(sx + (target.x - sx) / 2)
    return `M ${sx} ${sy} H ${mid} V ${target.y} H ${target.x}`
  }
  const left = Math.min(...targets.map((item) => item.x))
  const trunkX = Math.round(sx + Math.max(12, Math.min(20, (left - sx) / 2)))
  const top = Math.min(sy, targets[0].y)
  const bottom = Math.max(sy, targets[targets.length - 1].y)
  const parts = [`M ${sx} ${sy} H ${trunkX}`, `M ${trunkX} ${top} V ${bottom}`]
  targets.forEach((item) => parts.push(`M ${trunkX} ${item.y} H ${item.x}`))
  return parts.join(' ')
}
function closeFloating() {
  menu.value.open = false
}
function revealAncestors(id: string) {
  if (!id || id === rootId) return
  let parentId = nodes.value.find((item) => item.id === id)?.parentId || null
  const guard = new Set<string>()
  while (parentId && !guard.has(parentId)) {
    guard.add(parentId)
    const parent = nodes.value.find((item) => item.id === parentId)
    if (!parent) return
    if (parent.expanded === false) parent.expanded = true
    parentId = parent.parentId
  }
}
function onNodeClick(payload: { event?: { target?: EventTarget | null }; node: { id: string } }) {
  const target = payload.event?.target as HTMLElement | null
  if (target?.closest?.('.fold, .inline-edit, .pick-attr')) return
  selected.value = payload.node.id
  revealAncestors(payload.node.id)
  menu.value.open = false
}
function frameCanvas() {
  nextTick(() => {
    fitView({ padding: 0.16, maxZoom: 1, duration: 180 }).catch(() => undefined)
  })
}
function onNodesReady() {
  if (didInitialFit) return
  didInitialFit = true
  frameCanvas()
}
function onNodeDoubleClick(payload: { event: { target?: EventTarget | null }; node: { id: string } }) {
  const target = payload.event.target as HTMLElement | null
  if (target?.closest?.('.fold, .inline-edit, .pick-attr')) return
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
  if (node.nodeType === 'ATTRIBUTE' && !attributeHint(node).bound) {
    selected.value = id
    openBindAttribute(id)
    return
  }
  const options = node.nodeType === 'ATTRIBUTE' ? attributeOptions() : valueOptions(node)
  if (!options.length) {
    ElMessage.warning(node.nodeType === 'ATTRIBUTE' ? '当前模型还没有可选属性' : '这个属性还没有可选取值')
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
function applyRootName(name: string) {
  const text = name.trim()
  if (!text) {
    ElMessage.warning('请填写模型名称')
    return
  }
  const row = store.data.templates.find((item) => item.id === templateId.value)
  if (row) row.name = text
  const canvasRow = ensureCanvas()
  canvasRow.name = text
  canvasRow.updatedAt = new Date().toISOString()
}
function commitRootName(event: Event) {
  if (skipRootCommit) {
    skipRootCommit = false
    return
  }
  if (event.type === 'blur' && editingId.value !== rootId) return
  editingId.value = ''
  applyRootName((event.target as HTMLInputElement).value)
}
function cueOutline(id: string) {
  selected.value = id
  outlineCue.value = { id, tick: outlineCue.value.tick + 1 }
}
function outlineIds() {
  const ids = [rootId]
  const walk = (parentId: string | null) => {
    nodes.value
      .filter((item) => item.parentId === parentId)
      .sort((a, b) => a.sort - b.sort)
      .forEach((node) => {
        ids.push(node.id)
        if (node.expanded !== false) walk(node.id)
      })
  }
  walk(null)
  return ids
}
function orderSiblings(parentId: string | null, orderedIds: string[]) {
  orderedIds.forEach((id, index) => {
    const node = nodes.value.find((item) => item.id === id)
    if (node && node.parentId === parentId) node.sort = index + 1
  })
}
function pushUndo() {
  const template = store.data.templates.find((item) => item.id === templateId.value)
  undoStack.value.push(JSON.stringify({
    nodes: nodes.value.map((item) => ({ ...item })),
    params: store.data.params.map((item) => ({ ...item, values: [...item.values], valueGroups: item.valueGroups.map((group) => ({ ...group, values: [...group.values] })) })),
    templateParams: store.data.templateParams.map((item) => ({ ...item })),
    structureOrder: template ? [...template.structureOrder] : [],
  }))
  if (undoStack.value.length > 40) undoStack.value.shift()
}
function undoOutline() {
  const snap = undoStack.value.pop()
  if (!snap) return
  const restored = JSON.parse(snap) as { nodes: ProductSpecNode[]; params?: ParamDef[]; templateParams?: { templateId: string; paramId: string; role: 'common' | 'variant'; required: boolean }[]; structureOrder?: string[] }
  const nodesSnap = Array.isArray(restored) ? restored : restored.nodes
  store.data.productSpecNodes = [...store.data.productSpecNodes.filter((item) => item.templateId !== templateId.value), ...nodesSnap]
  if (!Array.isArray(restored) && restored.params && restored.templateParams) {
    store.data.params = restored.params
    store.data.templateParams = restored.templateParams
    const template = store.data.templates.find((item) => item.id === templateId.value)
    if (template && restored.structureOrder) template.structureOrder = restored.structureOrder
  }
  reflowTree()
}
function attachParam(paramId: string) {
  if (!paramId) return undefined
  if (!store.data.templateParams.some((item) => item.templateId === templateId.value && item.paramId === paramId)) {
    store.data.templateParams.push({ templateId: templateId.value, paramId, role: 'variant', required: false })
    const order = store.data.templates.find((item) => item.id === templateId.value)
    if (order && !order.structureOrder.includes(paramId)) order.structureOrder.push(paramId)
  }
  return store.data.templateParams.find((item) => item.templateId === templateId.value && item.paramId === paramId)
}
function ensureParam(name: string) {
  let param = store.data.params.find((item) => item.name === name)
  if (!param) {
    param = { id: uid('p'), name, values: [], valueGroups: [], participateInStructure: true }
    store.data.params.push(param)
  }
  attachParam(param.id)
  return param
}
function linkAttribute(node: ProductSpecNode, paramId: string) {
  const bound = attachParam(paramId)
  node.attributeId = paramId
  node.role = bound?.role === 'common' ? 'COMMON' : 'VARIANT'
  nodes.value.filter((item) => item.parentId === node.id && item.nodeType === 'VALUE').forEach((item) => {
    item.attributeId = paramId
  })
}
async function renameOutline(payload: { id: string; name: string }) {
  const node = nodes.value.find((item) => item.id === payload.id)
  const text = payload.name.trim()
  if (!node || !text || text === nodeTitle(node)) return
  if (node.nodeType === 'ATTRIBUTE') {
    const found = store.data.params.find((item) => item.name === text)
    if (found) {
      pushUndo()
      linkAttribute(node, found.id)
      return
    }
    const current = store.data.params.find((item) => item.id === node.attributeId)
    const usedElsewhere = store.data.productSpecNodes.some((item) => item.id !== node.id && item.attributeId === current?.id && !(item.parentId === node.id && item.nodeType === 'VALUE'))
      || store.data.templateParams.some((item) => item.paramId === current?.id && item.templateId !== templateId.value)
    if (current && !usedElsewhere) {
      pushUndo()
      current.name = text
      return
    }
    try {
      await ElMessageBox.confirm(`属性词典里没有「${text}」。是否创建新的属性？`, '创建属性')
    } catch {
      return
    }
    pushUndo()
    linkAttribute(node, ensureParam(text).id)
    return
  }
  const allowed = store.data.params.find((item) => item.id === node.attributeId)?.values || []
  if (!allowed.includes(text)) {
    ElMessage.warning('请从该属性的属性值里选择')
    return
  }
  const duplicated = nodes.value.some((item) => item.parentId === node.parentId && item.id !== node.id && item.nodeType === 'VALUE' && item.valueId === text)
  if (duplicated) {
    ElMessage.warning('同一个属性下已有这个取值')
    return
  }
  pushUndo()
  node.valueId = text
}
function addOutline(payload: { id: string; kind: 'sibling' | 'child-value' | 'child-attribute' }) {
  if (viewing.value) return
  const source = payload.id === rootId ? undefined : nodes.value.find((item) => item.id === payload.id)
  if (payload.kind === 'child-value') {
    const attributeId = source?.nodeType === 'ATTRIBUTE' ? source.id : source?.nodeType === 'VALUE' ? source.parentId : ''
    const attribute = attributeId ? nodes.value.find((item) => item.id === attributeId && item.nodeType === 'ATTRIBUTE') : undefined
    if (!attribute) {
      ElMessage.warning('请先选中一个属性，再添加属性值')
      return
    }
    openValuePicker(attribute.id)
    return
  }
  if (payload.kind === 'child-attribute') {
    if (source && source.expanded === false) source.expanded = true
    openAttributeAt(source ? source.id : null)
    return
  }
  if (!source) {
    openAttributeAt(null)
    return
  }
  if (source.nodeType === 'VALUE') {
    const parent = nodes.value.find((item) => item.id === source.parentId && item.nodeType === 'ATTRIBUTE')
    if (!parent) {
      ElMessage.warning('属性值只能挂在属性下面')
      return
    }
    openValuePicker(parent.id)
    return
  }
  openAttributeAt(source.parentId)
}
async function removeOutline(id: string) {
  const hasChildren = nodes.value.some((item) => item.parentId === id)
  if (hasChildren) {
    try {
      await ElMessageBox.confirm('是否删除当前节点以及所有子节点？', '删除节点')
    } catch {
      return
    }
  }
  const ids = outlineIds()
  const index = ids.indexOf(id)
  const neighbor = ids[index - 1] || rootId
  selected.value = id
  pushUndo()
  const message = current.value ? store.removeSpecNode(current.value.id) : '请选择节点'
  if (message) {
    undoStack.value.pop()
    ElMessage.warning(message)
    return
  }
  reflowTree()
  cueOutline(neighbor)
}
function promoteOutline(id: string) {
  const node = nodes.value.find((item) => item.id === id)
  if (!node?.parentId) {
    ElMessage.warning('已经是第一层')
    return
  }
  const parent = nodes.value.find((item) => item.id === node.parentId)
  const grandId = parent?.parentId || null
  const grand = grandId ? nodes.value.find((item) => item.id === grandId) : undefined
  if (node.nodeType === 'VALUE' && grand?.nodeType !== 'ATTRIBUTE') {
    ElMessage.warning('属性值只能挂在属性下面')
    return
  }
  pushUndo()
  node.parentId = grandId
  if (node.nodeType === 'VALUE' && grand) node.attributeId = grand.attributeId
  const siblings = nodes.value.filter((item) => item.parentId === grandId).sort((a, b) => a.sort - b.sort)
  const ordered = siblings.filter((item) => item.id !== node.id)
  const after = ordered.findIndex((item) => item.id === parent?.id)
  ordered.splice(after + 1, 0, node)
  orderSiblings(grandId, ordered.map((item) => item.id))
  reflowTree()
  cueOutline(node.id)
}
function shiftOutline(payload: { id: string; direction: -1 | 1 }) {
  const node = nodes.value.find((item) => item.id === payload.id)
  if (!node) return
  const siblings = nodes.value.filter((item) => item.parentId === node.parentId).sort((a, b) => a.sort - b.sort)
  const index = siblings.findIndex((item) => item.id === node.id)
  const target = index + payload.direction
  if (target < 0 || target >= siblings.length) return
  pushUndo()
  const order = siblings.map((item) => item.id)
  const [moved] = order.splice(index, 1)
  order.splice(target, 0, moved)
  orderSiblings(node.parentId, order)
  reflowTree()
  cueOutline(node.id)
}
function openNodeDraft() {
  nodeDraft.value = { type: 'ATTRIBUTE', name: '' }
  nodeDraftOpen.value = true
}
async function confirmNodeDraft() {
  const name = nodeDraft.value.name.trim()
  if (!name) {
    ElMessage.warning('请填写名称')
    return
  }
  const source = selected.value && selected.value !== rootId ? nodes.value.find((item) => item.id === selected.value) : undefined
  let parentId: string | null = null
  if (nodeDraft.value.type === 'VALUE') {
    const parent = source?.nodeType === 'ATTRIBUTE' ? source : nodes.value.find((item) => item.id === source?.parentId && item.nodeType === 'ATTRIBUTE')
    if (!parent) {
      ElMessage.warning('属性值只能挂在属性下面')
      return
    }
    parentId = parent.id
    parent.expanded = true
  } else if (source?.nodeType === 'VALUE' || source?.nodeType === 'ATTRIBUTE') {
    parentId = source.id
    source.expanded = true
  }
  if (nodeDraft.value.type === 'ATTRIBUTE' && !store.data.params.some((item) => item.name === name)) {
    try {
      await ElMessageBox.confirm(`属性词典里没有「${name}」。是否创建并绑定到当前模型？`, '创建属性')
    } catch {
      return
    }
  }
  if (nodeDraft.value.type === 'VALUE') {
    const allowed = store.data.params.find((item) => item.id === nodes.value.find((row) => row.id === parentId)?.attributeId)?.values || []
    if (!allowed.includes(name)) {
      ElMessage.warning('请从该属性的属性值里选择')
      return
    }
    const duplicated = nodes.value.some((item) => item.parentId === parentId && item.nodeType === 'VALUE' && item.valueId === name)
    if (duplicated) {
      ElMessage.warning('同一个属性下已有这个取值')
      return
    }
  }
  pushUndo()
  const id = uid('sn')
  const attributeId = nodeDraft.value.type === 'VALUE'
    ? nodes.value.find((item) => item.id === parentId)?.attributeId || ''
    : ensureParam(name).id
  const bound = store.data.templateParams.find((item) => item.templateId === templateId.value && item.paramId === attributeId)
  store.data.productSpecNodes.push({
    id,
    templateId: templateId.value,
    parentId,
    nodeType: nodeDraft.value.type,
    attributeId,
    valueId: nodeDraft.value.type === 'VALUE' ? name : '',
    role: nodeDraft.value.type === 'ATTRIBUTE' ? (bound?.role === 'common' ? 'COMMON' : 'VARIANT') : undefined,
    sort: nextSort(parentId),
    positionX: 0,
    positionY: 0,
  })
  reflowTree()
  nodeDraftOpen.value = false
  cueOutline(id)
}
function moveOutline(payload: { id: string; targetId: string; place: 'before' | 'after' | 'inside' }) {
  const node = nodes.value.find((item) => item.id === payload.id)
  if (!node || viewing.value) return
  pushUndo()
  if (payload.place === 'inside') {
    const message = reparent(node, payload.targetId)
    if (message) {
      undoStack.value.pop()
      ElMessage.warning(message)
      paint()
      return
    }
    if (payload.targetId !== rootId) {
      const target = nodes.value.find((item) => item.id === payload.targetId)
      if (target) target.expanded = true
    }
    node.sort = nextSort(node.parentId)
    reflowTree()
    cueOutline(node.id)
    return
  }
  const target = nodes.value.find((item) => item.id === payload.targetId)
  if (!target) return
  const message = reparent(node, target.parentId || rootId)
  if (message) {
    undoStack.value.pop()
    ElMessage.warning(message)
    paint()
    return
  }
  const siblings = nodes.value.filter((item) => item.parentId === node.parentId && item.id !== node.id).sort((a, b) => a.sort - b.sort)
  const index = siblings.findIndex((item) => item.id === target.id)
  siblings.splice(payload.place === 'before' ? Math.max(index, 0) : index + 1, 0, node)
  orderSiblings(node.parentId, siblings.map((item) => item.id))
  reflowTree()
  cueOutline(node.id)
}
function commitInline(id: string, kind: 'attribute' | 'value', event: Event) {
  const value = (event.target as HTMLSelectElement).value
  const node = store.data.productSpecNodes.find((item) => item.id === id)
  if (!node || !value) return
  if (kind === 'attribute' && node.nodeType === 'ATTRIBUTE') {
    if (node.attributeId !== value) {
      pushUndo()
      linkAttribute(node, value)
    }
  }
  if (kind === 'value' && node.nodeType === 'VALUE') node.valueId = value
  editingId.value = ''
}
function openNodeMenu(payload: { id: string; x: number; y: number }) {
  if (viewing.value) return
  selected.value = payload.id
  revealAncestors(payload.id)
  menu.value = { open: true, x: payload.x, y: payload.y }
}
function onNodeMenu(payload: { event: { preventDefault: () => void; clientX?: number; clientY?: number }; node: { id: string } }) {
  payload.event.preventDefault()
  openNodeMenu({ id: payload.node.id, x: payload.event.clientX || 0, y: payload.event.clientY || 0 })
}
function runMenu(action: 'add-attribute' | 'add-child' | 'add-value' | 'sibling' | 'rename' | 'delete' | 'bind' | 'naming') {
  menu.value.open = false
  const id = selected.value || rootId
  if (action === 'naming') {
    namingOpen.value = true
    return
  }
  if (action === 'bind') {
    openBindAttribute(id)
    return
  }
  if (action === 'add-attribute' || action === 'add-child') {
    addOutline({ id, kind: 'child-attribute' })
    return
  }
  if (action === 'add-value') {
    addOutline({ id, kind: 'child-value' })
    return
  }
  if (action === 'rename') {
    if (editorMode.value === 'canvas') beginEdit(id)
    else cueOutline(id)
    return
  }
  if (action === 'delete') {
    if (id === rootId) return
    if (editorMode.value === 'canvas') remove()
    else removeOutline(id)
    return
  }
  if (id === rootId) return
  addOutline({ id, kind: 'sibling' })
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
  const hit = hitNode(event.node.position.x + 36, event.node.position.y + 16, row.id)
  if (!hit) {
    if (viewMode.value !== 'all') {
      paint()
      return
    }
    row.positionX = event.node.position.x
    row.positionY = event.node.position.y
    ensureCanvas().direction = 'custom'
    return
  }
  const message = reparent(row, hit)
  if (message) {
    ElMessage.warning(message)
    paint()
    return
  }
  if (ensureCanvas().direction === 'custom') {
    row.positionX = event.node.position.x
    row.positionY = event.node.position.y
  } else reflowTree()
  ElMessage.success('已调整层级')
}
function hitNode(x: number, y: number, selfId: string) {
  const root = flowNodes.value.find((item) => item.id === rootId)
  if (root && x >= root.position.x && x <= root.position.x + 168 && y >= root.position.y && y <= root.position.y + 52) return rootId
  const target = flowNodes.value.find((item) => {
    if (item.id === selfId || item.id === rootId) return false
    const width = item.type === 'attribute' ? 132 : item.type === 'value' ? 88 : 120
    const height = item.type === 'attribute' ? 46 : 32
    return x >= item.position.x && x <= item.position.x + width && y >= item.position.y && y <= item.position.y + height
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
  ensureCanvas().direction = 'logic'
  frameCanvas()
  ElMessage.success('已按产品结构整理')
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
function openAttributeAt(parentId: string | null) {
  if (viewing.value) return
  attributeBindId.value = ''
  attachParent.value = parentId
  attributeIds.value = []
  attributePick.value = ''
  creatingAttr.value = false
  newAttrName.value = ''
  attributeTitle.value = parentId ? '选择下一级属性' : '选择属性'
  attributeOpen.value = true
}
function resetAttrComposer() {
  creatingAttr.value = false
  newAttrName.value = ''
}
function openValuePicker(attributeNodeId: string) {
  if (viewing.value) return
  const node = nodes.value.find((item) => item.id === attributeNodeId && item.nodeType === 'ATTRIBUTE')
  if (!node) {
    ElMessage.warning('属性值只能挂在属性下面')
    return
  }
  if (!attributeHint(node).bound) {
    ElMessage.warning('请先选择属性')
    openBindAttribute(node.id)
    return
  }
  valueParentId.value = node.id
  valuePicks.value = []
  selected.value = node.id
  valueOpen.value = true
}
function openBindAttribute(id: string) {
  if (viewing.value || !id || id === rootId) return
  const node = nodes.value.find((item) => item.id === id && item.nodeType === 'ATTRIBUTE')
  if (!node) return
  attributeBindId.value = id
  attributePick.value = attributeChoices.value.some((item) => item.id === node.attributeId) ? node.attributeId : ''
  attributeTitle.value = '选择属性'
  selected.value = id
  attributeOpen.value = true
}
function nextSort(parentId: string | null) {
  return nodes.value.filter((item) => item.parentId === parentId).reduce((max, item) => Math.max(max, item.sort), 0) + 1
}
function insertAttributeNodes(paramIds: string[]) {
  const parentId = attachParent.value
  const parent = nodes.value.find((item) => item.id === parentId)
  if (parent && parent.expanded === false) parent.expanded = true
  const siblings = nodes.value.filter((item) => item.parentId === parentId)
  const baseX = parent ? (parent.positionX ?? 300) + 340 : 300
  let cursorY = siblings.length ? Math.max(...siblings.map((item) => item.positionY ?? 40)) + 136 : (parent?.positionY ?? 48)
  let sort = nextSort(parentId)
  let lastId = ''
  paramIds.forEach((paramId) => {
    const id = uid('sn')
    const bound = attachParam(paramId)
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
    cursorY += 136
    lastId = id
  })
  reflowTree()
  selected.value = lastId
  attributeOpen.value = false
  attributeBindId.value = ''
}
function createDictionaryAttribute() {
  const name = newAttrName.value.trim()
  if (!name) {
    ElMessage.warning('请填写属性名称')
    return
  }
  const existed = store.data.params.some((item) => item.name === name)
  pushUndo()
  const param = ensureParam(name)
  if (attributeBindId.value) {
    const node = nodes.value.find((item) => item.id === attributeBindId.value && item.nodeType === 'ATTRIBUTE')
    if (!node) {
      undoStack.value.pop()
      ElMessage.warning('请选择属性节点')
      return
    }
    linkAttribute(node, param.id)
    attributeOpen.value = false
    attributeBindId.value = ''
  } else {
    insertAttributeNodes([param.id])
  }
  creatingAttr.value = false
  newAttrName.value = ''
  ElMessage.success(existed ? '已绑定到当前模型' : '已创建并绑定到当前模型')
}
function addAttribute() {
  if (attributeBindId.value) {
    const paramId = attributePick.value
    const node = nodes.value.find((item) => item.id === attributeBindId.value && item.nodeType === 'ATTRIBUTE')
    if (!paramId || !node) {
      ElMessage.warning('请选择属性')
      return
    }
    if (node.attributeId === paramId) {
      attributeOpen.value = false
      attributeBindId.value = ''
      return
    }
    pushUndo()
    linkAttribute(node, paramId)
    attributeOpen.value = false
    attributeBindId.value = ''
    return
  }
  const ids = [...new Set(attributeIds.value.filter(Boolean))]
  if (!ids.length) {
    ElMessage.warning('请至少选择一个属性')
    return
  }
  pushUndo()
  insertAttributeNodes(ids)
}
function addValues() {
  const parent = nodes.value.find((item) => item.id === valueParentId.value && item.nodeType === 'ATTRIBUTE')
  const allowed = new Set(store.data.params.find((item) => item.id === parent?.attributeId)?.values || [])
  const fresh = [...new Set(valuePicks.value.filter((item) => allowed.has(item)))]
    .filter((item) => !nodes.value.some((row) => row.parentId === parent?.id && row.nodeType === 'VALUE' && row.valueId === item))
  if (!parent?.attributeId || !fresh.length) {
    ElMessage.warning('请选择属性值')
    return
  }
  pushUndo()
  parent.expanded = true
  let sort = nextSort(parent.id)
  let lastId = ''
  fresh.forEach((valueId) => {
    const id = uid('sn')
    store.data.productSpecNodes.push({
      id,
      templateId: templateId.value,
      parentId: parent.id,
      nodeType: 'VALUE',
      attributeId: parent.attributeId,
      valueId,
      sort,
      positionX: 0,
      positionY: 0,
    })
    sort += 1
    lastId = id
  })
  reflowTree()
  selected.value = lastId
  valueOpen.value = false
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
    reflowTree()
    ElMessage.success('已删除')
  }
}
const copySourceName = computed(() => {
  const canvasRow = store.data.specCanvases.find((item) => item.templateId === copySourceId.value)
  return canvasRow?.name?.trim() || store.data.templates.find((item) => item.id === copySourceId.value)?.name || '未命名模型'
})
const copyChoices = computed(() => store.data.specCanvases.map((item) => {
  const typeName = store.data.productTypes.find((type) => type.id === item.productTypeId)?.name
  const name = item.name?.trim() || store.data.templates.find((tpl) => tpl.id === item.templateId)?.name || '未命名模型'
  return { id: item.templateId, label: typeName ? `${name} · ${typeName}` : name }
}))
function openCopyCurrent() {
  if (!templateId.value || viewing.value) return
  copyPick.value = false
  copySourceId.value = templateId.value
  copyTargetTypeId.value = currentProductType.value?.id || activeTypeId.value
  copyName.value = ''
  copyOpen.value = true
}
function openCopyPicker() {
  if (viewing.value) return
  copyPick.value = true
  copySourceId.value = copyChoices.value[0]?.id || ''
  copyTargetTypeId.value = activeType.value?.id || activeTypeId.value
  copyName.value = ''
  copyOpen.value = true
}
function duplicateModel(sourceId: string, name: string, productTypeId: string) {
  const cloned = cloneProductModel({
    sourceId,
    name,
    productTypeId,
    nextId: uid,
    templates: store.data.templates,
    nodes: store.data.productSpecNodes,
    templateParams: store.data.templateParams,
  })
  if (!cloned) return ''
  store.data.templates.push(cloned.template)
  cloned.params.forEach((item) => store.data.templateParams.push(item))
  cloned.nodes.forEach((item) => store.data.productSpecNodes.push(item))
  store.data.specCanvases.push(cloned.canvas)
  return cloned.templateId
}
function confirmCopy() {
  const name = copyName.value.trim()
  const sourceId = copySourceId.value
  const productTypeId = copyTargetTypeId.value
  if (!sourceId) {
    ElMessage.warning('请选择原模型')
    return
  }
  if (!name) {
    ElMessage.warning('请填写新模型名称')
    return
  }
  if (!productTypeId) {
    ElMessage.warning('请先选择产品类型')
    return
  }
  const duplicated = store.data.specCanvases.some((item) => item.productTypeId === productTypeId && (item.name || '').trim() === name)
  if (duplicated) {
    ElMessage.warning('这个产品类型下已有同名模型')
    return
  }
  const nextId = duplicateModel(sourceId, name, productTypeId)
  if (!nextId) {
    ElMessage.warning('原模型不存在')
    return
  }
  copyOpen.value = false
  activeTypeId.value = productTypeId
  openModel(nextId)
  ElMessage.success('已复制为新模型，可以继续编辑。')
}
function pickNode(id: string) {
  selected.value = id
  revealAncestors(id)
}
function focusBoard(event: PointerEvent) {
  const board = event.currentTarget as HTMLElement
  const target = event.target as HTMLElement | null
  if (target?.closest('input, textarea, select, button, a')) return
  board.focus()
}
function toggleCheck(id: string) {
  checkedIds.value = checkedIds.value.includes(id) ? checkedIds.value.filter((item) => item !== id) : [...checkedIds.value, id]
}
function markGrade(grade: 'core' | 'general') {
  const count = store.markPlanningGrades(checkedIds.value, grade)
  checkedIds.value = []
  ElMessage.success(`已标记 ${count} 条规划，没有新建物料。`)
}
function openTemporary(familyId: string, skuId: string) {
  temporaryOpen.value = false
  router.push(`/products/${familyId}?sku=${skuId}`)
}
function shortcutBlocked() {
  if (attributeOpen.value || valueOpen.value || copyOpen.value || nodeDraftOpen.value || editingId.value || namingOpen.value) return true
  if (document.querySelector('.v3-material-dialog')) return true
  return false
}
function onKey(event: KeyboardEvent) {
  if (document.querySelector('.v3-material-dialog')) return
  const target = event.target as HTMLElement | null
  if (!target?.closest?.('.board')) return
  const tag = target.tagName
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    if (!shortcutBlocked()) saveModel()
    return
  }
  if ((editorMode.value === 'outline' || editorMode.value === 'document') && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    if (!shortcutBlocked()) undoOutline()
    return
  }
  if (editorMode.value === 'outline' || editorMode.value === 'document' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable || shortcutBlocked()) return
  if (event.key === 'Escape') {
    closeFloating()
    editingId.value = ''
    return
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
    event.preventDefault()
    setExpanded(true)
    return
  }
  if (event.key.toLowerCase() === 'v' && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.repeat) {
    if (current.value?.nodeType !== 'ATTRIBUTE') return
    event.preventDefault()
    addOutline({ id: current.value.id, kind: 'child-value' })
    return
  }
  if (event.key === 'Tab') {
    event.preventDefault()
    if (event.shiftKey) {
      if (current.value) promoteOutline(current.value.id)
      return
    }
    addOutline({ id: selected.value || rootId, kind: 'child-attribute' })
    return
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    addOutline({ id: selected.value || rootId, kind: 'sibling' })
    return
  }
  if ((event.key === 'Delete' || event.key === 'Backspace') && current.value) {
    event.preventDefault()
    remove()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
.designer { display: flex; flex-direction: column; height: calc(100vh - 132px); min-height: 520px; }
.workbench { display: grid; grid-template-columns: 200px 248px minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); gap: 0; flex: 1; min-height: 0; background: #fff; border: 1px solid #ebeef5; border-radius: 8px; overflow: hidden; }
.workbench:has(.cat.is-fold) { grid-template-columns: 44px 248px minmax(0, 1fr); }
.studio-head { margin-bottom: 6px; }
.version-name { color: #909399; font-size: 13px; font-weight: 500; }
.meta-row { display: flex; flex-wrap: wrap; gap: 4px 18px; margin: 6px 0 0; color: #303133; font-size: 12px; line-height: 1.5; }
.meta-row em { margin-right: 4px; color: #909399; font-style: normal; }
.node-ops { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 8px; }
.node-ops strong { margin-right: 4px; }
.key-strip { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 12px; margin: 0 0 6px; padding: 2px 10px; border-radius: 6px; background: #f4f7fb; color: #8d9bab; font-size: 12px; line-height: 20px; }
.key-strip-label { color: #9aa8b8; }
.key-strip-label::after { content: "："; }
.key-strip kbd { margin-right: 3px; padding: 0; border: 0; background: transparent; color: #7d8da1; font: 12px/20px Consolas, "Cascadia Mono", monospace; }
.key-more { margin-left: auto; border: 0; background: none; padding: 0; color: #8aa0b8; font-size: 12px; line-height: 20px; cursor: pointer; }
.key-more:hover { color: #606266; }
.studio-copy { min-width: 0; }
.title-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.studio-head h2 { margin: 0; font-size: 16px; font-weight: 650; line-height: 1.3; }
.studio-head .meta-row { display: flex; flex-wrap: wrap; gap: 4px 18px; align-items: center; margin: 6px 0 0; color: #303133; font-size: 12px; }
.meta-type { padding: 1px 8px; border-radius: 4px; background: #f4f8fc; }
.head-tools { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
.combo-preview { margin: 0 0 8px; border: 1px solid #e6edf5; border-radius: 8px; background: #fff; }
.combo-toggle { width: 100%; display: flex; justify-content: space-between; gap: 12px; border: 0; background: transparent; padding: 8px 12px; color: #1f3b66; font-size: 13px; cursor: pointer; }
.combo-toggle span:last-child { color: #8aa0b8; }
.combo-preview ul { max-height: 148px; margin: 0; padding: 0 12px 8px; overflow: auto; list-style: none; }
.combo-preview li { padding: 0; }
.combo-preview li { display: flex; align-items: center; gap: 6px; }
.combo-check { display: flex; align-items: center; }
.combo-batch { display: flex; align-items: center; gap: 8px; margin: 4px 12px; color: #607089; font-size: 13px; }
.temp-entry { margin: 0 12px 8px; }
.combo-preview button { width: 100%; display: flex; justify-content: space-between; gap: 12px; border: 0; background: transparent; padding: 4px 0; color: #1f2a37; font-size: 13px; text-align: left; cursor: pointer; }
.combo-preview button.is-on { color: #1677ff; }
.combo-preview em { color: #1677ff; font-style: normal; white-space: nowrap; }
.op-bar { display: flex; align-items: center; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.view-switch { --el-segmented-item-selected-bg-color: var(--el-color-primary); --el-segmented-item-selected-color: #fff; }
.work-main { min-width: 0; min-height: 0; height: 100%; display: flex; flex-direction: column; overflow: hidden; padding: 14px 16px 12px; background: #f5f7fa; border-left: 1px solid #eef0f3; }
.quiet-guide { margin: 64px auto 0; max-width: 420px; color: #66788a; }
.quiet-guide h2 { margin: 0 0 8px; color: #1f3b66; font-size: 18px; }
.quiet-guide p { margin: 0; font-size: 13px; }
.key-list { margin: 4px 0 0; padding: 0; list-style: none; }
.key-list kbd { display: inline-block; margin-right: 4px; padding: 1px 5px; border: 1px solid #e1e7ef; border-radius: 4px; background: #fff; color: #607089; font: 11px/1.4 Consolas, monospace; }
.key-list li { margin: 6px 0; color: #1f2a37; font-size: 13px; }
.key-lead { margin: 8px 0 0; color: #606266; font-size: 12px; line-height: 1.5; }
.key-group { margin: 10px 0 0; color: #909399; font-size: 12px; }
.key-extra { display: flex; gap: 12px; margin-top: 8px; }
.key-extra button { border: 0; background: none; color: #2f6fed; cursor: pointer; padding: 0; }
.copy-label { margin: 12px 0 6px; color: #8aa0b8; font-size: 12px; }
.copy-label:first-child { margin-top: 0; }
.copy-source { display: block; margin-bottom: 4px; color: #1f2a37; }
.model-context em { margin-right: 6px; color: #8a97a8; font-style: normal; }
.model-context .context-count { color: #607089; font-size: 13px; }
.model-context .mode-bar { margin-left: auto; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.model-context .view-switch { display: flex; align-items: center; gap: 8px; margin-left: 0; }
.doc-mode { flex: 1; min-width: 0; display: flex; flex-direction: column; background: #fff; border: 1px solid #e6edf5; border-radius: 8px; padding: 20px 28px 28px; }
.doc-mode p { margin: 0 0 10px; color: #98a4b3; font-size: 13px; }
.doc-mode textarea { flex: 1; min-height: 360px; border: 0; resize: none; outline: none; font: 15px/1.7 "Cascadia Mono", Consolas, monospace; color: #1c2b3a; }
.board { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; outline: none; }
.board:focus-within { box-shadow: inset 0 0 0 1px #d7e4f4; border-radius: 8px; }
.canvas { position: relative; flex: 1; width: 100%; min-width: 0; min-height: 0; border: 1px solid #e6edf5; border-radius: 8px; overflow: hidden; background: #f7f9fc; }
.canvas-tools { position: absolute; top: 10px; right: 12px; z-index: 5; }
.canvas :deep(.vue-flow) { width: 100%; height: 100%; background: #f7f9fc; }
.canvas :deep(.vue-flow__node) { padding: 0; border: 0; background: transparent; box-shadow: none; }
.canvas :deep(.vue-flow__handle) { width: 8px; height: 8px; border: 0; background: transparent; opacity: 0; }
.canvas :deep(.vue-flow__edge-path) { stroke-linecap: butt; stroke-linejoin: miter; }
.canvas :deep(.vue-flow__controls) { left: 12px; bottom: 16px; box-shadow: none; border: 1px solid #e6edf5; }
.canvas :deep(.vue-flow__minimap) { left: 12px; right: auto; bottom: 12px; border-radius: 8px; overflow: hidden; box-shadow: none; border: 1px solid #e6edf5; }
.canvas :deep(.tree-bus) { fill: none; stroke: #c5d0dc; stroke-width: 1.25px; stroke-linejoin: round; stroke-linecap: butt; pointer-events: none; }
.model-root, .model-attr, .model-value { position: relative; box-sizing: border-box; text-align: left; }
.model-root { min-width: 108px; height: 36px; display: flex; align-items: center; background: #fff; color: #303133; border: 1px solid #dcdfe6; border-left: 3px solid #303133; border-radius: 6px; padding: 0 12px; font-size: 16px; font-weight: 600; }
.model-attr { width: 128px; height: 44px; display: flex; flex-direction: column; justify-content: center; background: #fff; border: 1px solid #e4e7ed; border-radius: 6px; padding: 0 10px; }
.model-attr strong { display: block; overflow: hidden; color: #303133; font-size: 13px; font-weight: 500; line-height: 18px; white-space: nowrap; text-overflow: ellipsis; }
.model-attr.is-unbound strong { color: #909399; font-weight: 500; }
.attr-meta { margin: 0; overflow: hidden; color: #909399; font-size: 11px; line-height: 14px; white-space: nowrap; text-overflow: ellipsis; }
.pick-attr { display: inline-block; margin-top: 2px; border: 0; background: none; padding: 0; color: #409eff; font-size: 12px; line-height: 1.4; cursor: pointer; }
.dict-create { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
.dict-create .el-input { flex: 1; }
.dict-empty { margin: 0 0 8px; color: #909399; font-size: 13px; line-height: 1.45; }
.model-attr.is-head { border-color: #dcdfe6; }
.model-attr.is-head strong { color: #303133; font-size: 13px; font-weight: 500; }
.model-value { min-width: 64px; height: 28px; display: flex; align-items: center; background: #f7f8fa; border: 1px solid #e4e7ed; border-radius: 6px; padding: 0 10px; color: #606266; font-size: 12px; font-weight: 400; line-height: 28px; }
.structure-empty { position: absolute; z-index: 4; top: 52px; left: 50%; transform: translateX(-50%); padding: 12px 14px; border: 1px solid #e6edf5; border-radius: 8px; background: rgba(255, 255, 255, 0.96); }
.structure-empty p { margin: 0; color: #606266; font-size: 13px; }
.structure-start { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 8px; color: #909399; font-size: 12px; }
.path-preview { position: absolute; left: 12px; top: 12px; z-index: 5; max-width: 460px; padding: 6px 10px; color: #7d8da1; background: rgba(255, 255, 255, 0.88); border-radius: 999px; font-size: 12px; pointer-events: none; }
.path-preview i { margin: 0 6px; color: #c5d0de; font-style: normal; }
.model-attr.is-on, .model-value.is-on, .model-root.is-on { border-color: #409eff; background: #f3f8ff; box-shadow: none; }
.model-value.is-on { color: #303133; }
.model-attr.is-path { border-color: #dcdfe6; }
.model-value.is-path { border-color: #e4e7ed; background: #f7f8fa; }
.model-root.is-path { background: #fff; }
.model-attr.is-on, .model-value.is-on, .model-root.is-on { border-color: #409eff; background: #f3f8ff; }
.model-value.is-on { color: #303133; }
.fold { position: absolute; right: -7px; top: 50%; width: 16px; height: 16px; margin-top: -8px; border: 1px solid #d5deea; border-radius: 50%; background: #fff; color: #7d8da1; cursor: pointer; font-size: 10px; line-height: 14px; padding: 0; }
.inline-edit { width: 100%; max-width: 140px; border: 1px solid #9eb6d6; border-radius: 8px; background: #fff; color: #1f2d3d; font: inherit; }
.model-root .root-edit { width: 148px; max-width: none; color: #1f2d3d; background: #fff; text-align: center; font-weight: 650; }
.path-line { color: #1f3b66; display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.path-line button { background: none; border: 0; padding: 0; color: #1f3b66; cursor: pointer; }
.version-pop h3 { margin: 8px 0 6px; font-size: 14px; }
.version-pop p { margin: 4px 0; }
.node-card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; margin-bottom: 12px; }
.node-card.is-common { border-color: #7aa2d6; }
.node-card.is-variant { border-color: #d7c4a3; }
.node-card.is-value { border-color: #b7c9be; }
.node-card.is-root { background: #1f3b66; color: #fff; }
.node-card p { display: flex; justify-content: space-between; margin: 6px 0; }
.node-card span { color: #607089; }
.node-card.is-root span { color: #d5e2f5; }
.context-menu { position: fixed; z-index: 40; background: #fff; border: 1px solid var(--el-border-color); border-radius: 8px; padding: 4px; display: flex; flex-direction: column; align-items: stretch; min-width: 132px; box-shadow: var(--el-box-shadow-light); }
.context-menu :deep(.el-button) { justify-content: flex-start; margin: 0; }
</style>
