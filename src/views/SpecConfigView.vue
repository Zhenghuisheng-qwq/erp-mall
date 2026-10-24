<template>
  <div class="designer" :aria-busy="modelSaving || copying || publishing">
    <div class="studio-switch">
      <el-radio-group :model-value="surface" size="small" @change="setSurface">
        <el-radio-button value="overview">全局总览</el-radio-button>
        <el-radio-button value="design">单模型设计</el-radio-button>
      </el-radio-group>
    </div>
    <div class="workbench" :class="{ 'is-cat-fold': treeFold, 'is-rail-fold': railFold, 'is-overview': surface === 'overview' }">
      <CategoryCatalog
        :rows="categoryRows"
        :leaf-id="leafId"
        :path-ids="categoryPathIds"
        :folded="treeFold"
        :stats="categoryStats"
        :keyword="categoryKeyword"
        @update:keyword="categoryKeyword = $event"
        @update:folded="setTreeFold"
        @toggle="toggleCategory"
        @select="selectCategory"
      />
      <TypeModelRail
        :path="leafPath"
        :groups="typeGroups"
        :active-type-id="activeTypeId"
        :template-id="templateId"
        :viewing="viewing"
        :folded="railFold"
        @update:folded="setRailFold"
        @open="openModel"
        @focus-type="focusType"
        @create="createModelFor"
        @copy="openCopyCurrent"
      />
      <div class="work-main" :class="{ 'with-materials': showStructureMaterials && editorMode === 'canvas' }">
        <ModelOverview
          v-if="surface === 'overview'"
          :category-id="overviewCategoryId"
          :type-id="overviewTypeId"
          :keyword="overviewKeyword"
          :focus-id="overviewFocusId"
          :view="overviewView"
          :root-id="overviewRootId"
          @open="openFromOverview"
          @view="setOverviewView"
          @root="setOverviewRoot"
        />
        <template v-else>
        <header v-if="templateId" class="studio-head">
          <div class="studio-copy">
            <div class="title-row">
              <h2>{{ schemeTitle }}</h2>
              <el-tag size="small" :type="versionBadge.type">{{ versionBadge.text }}</el-tag>
            </div>
            <p class="meta-row">
              <span>{{ leafPath || categoryText }}</span>
              <span class="meta-type">{{ productTypeText }}</span>
            </p>
            <p v-if="!viewing && publishImpact" class="meta-row">{{ publishImpact }}</p>
            <p class="meta-row" data-model-compatibility-summary>
              <span>适用设备：{{ compatibilitySummary }}</span>
              <el-button link type="primary" data-open-template-compatibility @click="openTemplateCompatibility()">{{ viewing || !store.isAdmin ? '查看适用设备' : '配置适用设备' }}</el-button>
              <span v-if="compatibilityUnpublished">兼容配置尚未发布</span>
            </p>
          </div>
          <div class="studio-actions">
            <el-button v-if="fromOverview" @click="backToOverview">返回总览</el-button>
            <el-button v-if="viewing" type="primary" @click="enterEdit">进入编辑</el-button>
            <el-button v-if="!viewing" :disabled="modelSaving || publishing || copying || !store.isAdmin" :loading="modelSaving" @click="saveModel">保存模型</el-button>
            <el-button v-if="!viewing" :disabled="modelSaving || publishing || copying || !store.isAdmin" :loading="publishing" type="primary" @click="publish">发布模型</el-button>
          </div>
        </header>
        <div v-if="templateId" class="head-tools">
            <el-segmented v-model="editorMode" class="view-switch" :options="modeOptions" />
            <div class="op-bar">
              <el-button-group>
                <el-button v-if="canEditStructure" @click="tidy">自动布局</el-button>
                <el-button v-if="canEditStructure" @click="useManualLayout">手工摆放</el-button>
                <el-button @click="fitAll">适应全部</el-button>
              </el-button-group>
              <el-dropdown trigger="click" @command="onZoomCommand">
                <el-button data-zoom-label>{{ zoomLabel }}</el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="reset">回到 100%</el-dropdown-item>
                    <el-dropdown-item command="map">{{ mapOpen ? '隐藏小地图' : '显示小地图' }}</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <el-button data-expand-toggle @click="toggleAllBranches">{{ anyCollapsed ? '全部展开' : '全部收起' }}</el-button>
              <el-popover placement="bottom-end" :width="360" trigger="click">
                <template #reference>
                  <el-button>结构检查</el-button>
                </template>
                <div class="version-pop">
                  <h3>当前父子关系</h3>
                  <p v-if="structureNotes.length === 0">层级清楚。布局只调整位置，不会移动或删除节点。</p>
                  <p v-for="(item, index) in structureNotes" :key="index">{{ item }}</p>
                  <p v-if="canvas.layoutLocked">当前是手工摆放的位置。点「自动布局」才会按子树重新对齐，父子关系保持不变。</p>
                </div>
              </el-popover>
              <el-popover placement="bottom-end" :width="300" trigger="click">
                <template #reference>
                  <el-button>发布记录</el-button>
                </template>
                <div class="version-pop">
                  <h3>当前版本：{{ versionBadge.text }}</h3>
                  <p>{{ versionBadge.note }}</p>
                  <h3>发布记录</h3>
                  <p v-if="records.length === 0" class="muted">还没有发布版本。</p>
                  <p v-for="item in records" :key="item.id">{{ item.versionName }} · {{ item.time }} · {{ item.products }} 个商品</p>
                </div>
              </el-popover>
              <button type="button" class="key-more" @click="keysOpen = true">全部快捷键</button>
            </div>
        </div>
        <div v-if="templateId && canEditStructure" class="key-strip" aria-label="常用快捷键">
          <span v-for="item in quickHints" :key="item.keys + item.label" class="key-chip" :class="{ 'is-off': !item.enabled }" :title="item.note">
            <kbd>{{ item.keys }}</kbd>{{ item.label }}
          </span>
          <button type="button" class="key-more" @click="keysOpen = true">全部快捷键</button>
        </div>
        <div v-if="templateId" class="node-ops">
          <template v-if="canEditStructure && selected">
            <span class="ops-copy">
              <strong>{{ current ? nodeTitle(current) : schemeTitle }}</strong>
              <em v-if="selectionTrail">{{ selectionTrail }}</em>
            </span>
            <el-button v-if="menuKind === 'model'" size="small" @click="runMenu('add-attribute')">添加属性</el-button>
            <template v-else-if="menuKind === 'attribute'">
              <el-button size="small" @click="runMenu('add-child')">添加子属性</el-button>
              <el-button size="small" @click="runMenu('add-value')">添加属性值</el-button>
              <el-button size="small" @click="runMenu('naming')">命名规则</el-button>
              <el-button size="small" @click="runMenu('hosts')">节点适用配置</el-button>
              <el-button size="small" type="danger" plain @click="runMenu('delete')">删除</el-button>
            </template>
            <template v-else>
              <el-button size="small" @click="runMenu('add-child')">添加条件属性</el-button>
              <el-tooltip content="属性值下面不能再挂属性值，请到所属属性上添加" placement="bottom">
                <span class="ops-disabled"><el-button size="small" disabled>添加属性值</el-button></span>
              </el-tooltip>
              <el-button size="small" @click="runMenu('naming')">命名规则</el-button>
              <el-button size="small" @click="runMenu('hosts')">节点适用配置</el-button>
              <el-button size="small" type="danger" plain @click="runMenu('delete')">删除</el-button>
            </template>
          </template>
          <span v-else class="ops-idle">{{ !canEditStructure ? '当前视图只读，不能改结构和命名规则' : '选中节点后，可以添加属性、属性值或条件属性' }}</span>
          <el-button v-if="!canEditStructure && selected && selected !== rootId" size="small" @click="namingOpen = true">查看命名规则</el-button>
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
        <section v-if="templateId" class="insight">
          <div class="insight-summary">
            <div class="summary-stats">
              <strong v-if="publishedComboVersions.length">已发布组合 {{ comboRows.length }} 条</strong>
              <strong v-else>尚未发布</strong>
              <span>已选 {{ checkedIds.length }} 条</span>
              <span>{{ comboNumbered }} 条已有规划编号<span v-if="comboRows.length > comboNumbered"> · 其余发布后自动编号</span></span>
              <span>{{ comboSummaryText }}</span>
              <span v-if="draftPreviewLine">{{ draftPreviewLine }}</span>
            </div>
            <el-button v-if="!viewing" type="primary" @click="comboManageOpen = true">管理合法组合</el-button>
            <span v-else>查看模式只浏览结构和版本，不会改模型、发布快照或物料。</span>
          </div>
          <TemporaryMaterialDialog :open="temporaryOpen" :category-id="canvasContext.categoryId" :product-type-id="canvasContext.productTypeId" :product-model-id="templateId" :model-version-id="latestPublishedVersion(store.data, templateId)?.id" @close="temporaryOpen = false" @open="openTemporary" />
          <button v-if="temporaryMaterials.length" type="button" class="combo-toggle temp-toggle" @click="temporaryListOpen = !temporaryListOpen">
            <span>临时物料 {{ temporaryMaterials.length }} 条</span>
            <span>对不上正式规划，编号以 TMP 开头</span>
          </button>
          <ul v-show="temporaryListOpen && temporaryMaterials.length">
            <li v-for="item in temporaryMaterials.slice(0, 30)" :key="item.id">
              <button type="button" @click="router.push(`/products/${item.familyId}`)">
                <span>{{ item.materialCode }} · {{ item.skuName }}</span>
                <em>{{ item.planningId }} · 供应商 {{ item.supplierCode || '未填' }}</em>
              </button>
            </li>
          </ul>
          <p v-if="temporaryListOpen && temporaryMaterials.length > 30" class="insight-empty">这里只列出前 30 条。其余到商品列表按供应商编码或物料编码搜索。</p>
        </section>
        <div v-if="templateId && editorMode === 'canvas'" class="structure-material-toggle"><el-checkbox v-model="showStructureMaterials">显示关联物料</el-checkbox></div>
        <StructureMaterials v-if="templateId && showStructureMaterials && editorMode === 'canvas'" :key="templateId" :data="store.data" :model-id="templateId" :nodes="nodes" :status="comboStatus" :versions="publishedComboVersions" :version-id="comboVersionId" @version="id => comboVersionId = id" @locate="ids => materialHighlight = new Set(ids)" @close="showStructureMaterials = false; materialHighlight = new Set()" />
        <LegalComboDialog
          v-model="comboManageOpen"
          v-model:keyword="comboKeyword"
          v-model:unfiled-only="comboUnfiledOnly"
          v-model:version-id="comboVersionId"
          :row-count="comboRows.length"
          :visible-combo-rows="visibleComboRows"
          :checked-ids="checkedIds"
          :scheme-title="schemeTitle"
          :show-draft-list="showDraftList"
          :draft-preview="draftPreview"
          :combo-status="comboStatus"
          :published-combo-versions="publishedComboVersions"
          :allow-temporary="!!canvasContext.productTypeId"
          @select-all="selectAllCombos"
          @clear-selection="clearComboSelection"
          @invert-selection="invertComboSelection"
          @toggle-selection="toggleCheck"
          @mark-grade="markGrade"
          @create-materials="batchCreateMaterials"
          @create-temporary="temporaryOpen = true"
          @open-material="openMaterialDetail"
          @open-combo="openComboMaterial"
        >
          <template #material-actions>
            <V3MaterialActions
              v-if="actionCombo && materialLaunch.token && canvasContext.productTypeId"
              :key="materialLaunch.token"
              bare
              :product-model-id="templateId"
              :model-version-id="actionCombo.modelVersionId"
              :planning-id="actionCombo.recordId"
              :category-id="canvasContext.categoryId"
              :product-type-id="canvasContext.productTypeId"
              :retired="actionCombo.retired"
              match-version
              :open-create-tick="materialLaunch.mode === 'create' ? materialLaunch.token : 0"
              :open-list-tick="materialLaunch.mode === 'list' ? materialLaunch.token : 0"
            />
          </template>
        </LegalComboDialog>
        <div v-if="templateId" class="board" tabindex="0" @pointerdown="focusBoard">
      <div v-if="editorMode === 'canvas'" class="canvas">
        <VueFlow
          id="model-designer"
          :nodes="flowNodes"
          :edges="flowEdges"
          :nodes-connectable="false"
          :nodes-draggable="canEditStructure"
          :default-viewport="{ x: canvas.panX, y: canvas.panY, zoom: canvas.zoom || 0.88 }"
          :default-edge-options="{ type: 'tree' }"
          :min-zoom="0.6"
          :max-zoom="1.6"
          :zoom-on-scroll="true"
          :prevent-scrolling="true"
          @nodes-initialized="onNodesReady"
          @node-click="onNodeClick"
          @node-double-click="onNodeDoubleClick"
          @node-context-menu="onNodeMenu"
          @node-drag-start="onNodeDragStart"
          @node-drag-stop="onNodeDragStop"
          @move="onViewportMove"
          @move-end="onMoveEnd"
          @pane-click="closeFloating"
        >
          <Background variant="dots" :gap="28" :size="1" pattern-color="#e7eef6" />
          <MiniMap v-if="mapOpen" />
          <template #edge-tree="{ source, data }">
            <path :d="treeBusPath(source, data?.childIds || [])" class="tree-bus" :class="{ 'is-hot': data?.hot !== false, 'is-dim': data?.hot === false }" />
          </template>
          <template #node-model="{ data }">
            <div class="model-root" :class="{ 'is-on': data.selected, 'is-path': data.onPath, 'is-quiet': data.quiet }" :style="{ width: data.boxWidth + 'px' }" title="模型名称在创建时确定">
              <strong>{{ data.label }}</strong>
              <Handle type="source" :position="Position.Right" />
            </div>
          </template>
          <template #node-attribute="{ data }">
            <div class="model-attr" :data-material-highlight="materialAttributeHighlight.has(data.id) ? data.id : undefined" :class="{ 'is-material-combo': materialAttributeHighlight.has(data.id), 'is-on': data.selected, 'is-path': data.onPath, 'is-quiet': data.quiet, 'is-head': data.head, 'is-nested': !data.head, 'is-unbound': !data.bound }" :style="{ width: data.boxWidth + 'px' }" :title="data.bound ? `${data.label} · 来自属性词典` : '未绑定属性'">
              <Handle type="target" :position="Position.Left" />
              <select v-if="editingId === data.id" class="inline-edit" :value="data.editValue" @change="commitInline(data.id, 'attribute', $event)" @blur="editingId = ''" @mousedown.stop @pointerdown.stop @click.stop @dblclick.stop>
                <option v-for="item in data.options" :key="item.value" :value="item.value">{{ item.label }}</option>
              </select>
              <template v-else>
                <strong>{{ data.label }}</strong>
                <i v-if="data.ruleKind" class="rule-mark" :class="{ 'is-inherit': data.ruleKind === 'inherited' }" :title="data.ruleTitle">{{ data.ruleKind === 'own' ? '自有' : '继承' }}</i>
                <button v-if="!data.bound && canEditStructure" type="button" class="pick-attr" @mousedown.stop @pointerdown.stop @click.stop="openBindAttribute(data.id)" @dblclick.stop>选择属性</button>
              </template>
              <button v-if="data.childCount" type="button" class="fold" @click.stop="toggleExpand(data.id)" @dblclick.stop>{{ data.expanded ? '−' : data.childCount }}</button>
              <Handle type="source" :position="Position.Right" />
            </div>
          </template>
          <template #node-value="{ data }">
            <div class="model-value" :data-material-highlight="showStructureMaterials && materialHighlight.has(data.id) ? data.id : undefined" :class="{ 'is-material-combo': showStructureMaterials && materialHighlight.has(data.id), 'is-on': data.selected, 'is-path': data.onPath, 'is-quiet': data.quiet }" :style="{ width: data.boxWidth + 'px' }" :title="data.label">
              <Handle type="target" :position="Position.Left" />
              <select v-if="editingId === data.id" class="inline-edit" :value="data.editValue" @change="commitInline(data.id, 'value', $event)" @blur="editingId = ''" @mousedown.stop @pointerdown.stop @click.stop @dblclick.stop>
                <option v-for="item in data.options" :key="item.value" :value="item.value">{{ item.label }}</option>
              </select>
              <span v-else>{{ data.label }}</span>
              <i v-if="data.ruleKind" class="rule-mark" :class="{ 'is-inherit': data.ruleKind === 'inherited' }" :title="data.ruleTitle">{{ data.ruleKind === 'own' ? '自有' : '继承' }}</i>
              <button v-if="data.childCount" type="button" class="fold" @click.stop="toggleExpand(data.id)" @dblclick.stop>{{ data.expanded ? '−' : data.childCount }}</button>
              <Handle type="source" :position="Position.Right" />
            </div>
          </template>
        </VueFlow>
        <div v-if="nodes.length === 0" class="structure-empty">
          <p>还没有商品结构</p>
          <div v-if="canEditStructure" class="structure-start">
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
        :viewing="!canEditStructure"
        :folded-ids="viewClosed"
        :focus-tick="outlineCue.tick"
        :focus-id="outlineCue.id"
        :label="nodeTitle"
        :rule-mark="ruleMark"
        :attribute-hint="attributeHint"
        :options-for="outlineOptions"
        @select="pickNode"
        @rename="renameOutline"
        @choose="applyOutlineChoice"
        @create="applyOutlineCreate"
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
        :viewing="!canEditStructure"
        :folded-ids="viewClosed"
        :focus-tick="outlineCue.tick"
        :focus-id="outlineCue.id"
        :label="nodeTitle"
        :rule-mark="ruleMark"
        :attribute-hint="attributeHint"
        :options-for="outlineOptions"
        @select="pickNode"
        @rename="renameOutline"
        @choose="applyOutlineChoice"
        @create="applyOutlineCreate"
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
        </template>
      </div>
    </div>
    <div v-if="menu.open && canEditStructure" class="context-menu" :style="{ left: menu.x + 'px', top: menu.y + 'px' }" @pointerdown.stop @click.stop>
      <template v-if="menuKind === 'model'">
        <el-button text @click="runMenu('add-attribute')">添加属性</el-button>
      </template>
      <template v-else-if="menuKind === 'attribute'">
        <el-button text @click="runMenu('add-child')">添加子属性</el-button>
        <el-button text @click="runMenu('add-value')">添加属性值</el-button>
        <el-button text @click="runMenu('sibling')">添加同级属性</el-button>
        <el-button text @click="runMenu('naming')">命名规则</el-button>
        <el-button text @click="runMenu('hosts')">节点适用配置</el-button>
        <el-button text type="danger" @click="runMenu('delete')">删除节点</el-button>
      </template>
      <template v-else>
        <el-button text @click="runMenu('sibling')">添加同级属性值</el-button>
        <el-button text @click="runMenu('add-child')">添加条件属性</el-button>
        <el-button text @click="runMenu('naming')">命名规则</el-button>
        <el-button text @click="runMenu('hosts')">节点适用配置</el-button>
        <el-button text type="danger" @click="runMenu('delete')">删除节点</el-button>
      </template>
    </div>
    <el-drawer v-model="keysOpen" title="全部快捷键" direction="rtl" size="380px" :modal="false" append-to-body class="key-drawer">
      <p class="key-lead">先点选节点，让结构区域获得焦点，再按键。输入框、下拉和弹窗里这些键只用于输入，不会改模型。</p>
      <section v-for="group in shortcutGroups" :key="group.title" class="key-group-block">
        <h3>{{ group.title }}</h3>
        <p v-for="item in group.items" :key="item.name" class="key-row" :class="{ 'is-off': !item.enabled }">
          <span>{{ item.name }}</span>
          <kbd>{{ item.keys }}</kbd>
          <em>{{ item.when }}</em>
        </p>
      </section>
    </el-drawer>
    <NamingRuleDialog :open="namingOpen" :readonly="!canEditStructure" :node-id="selected" :template-id="templateId" @close="namingOpen = false" @saved="markWorkingDraft" />
    <NodeAddPanel v-model="attributeOpen" :title="attributeTitle" :anchor="addAnchor" @closed="resetAttrComposer">
      <el-select v-if="attributeBindId" ref="attrBindSelect" v-model="attributePick" filterable placement="top-start" popper-class="dict-select-popper" placeholder="搜索已有属性" style="width: 100%" :filter-method="rememberAttrQuery" @visible-change="dictDropOpen = $event">
        <el-option v-for="item in filteredAttributeChoices" :key="item.id" :label="item.name" :value="item.id" />
        <template #empty><p class="dict-empty">没有匹配「{{ attrQuery.trim() || '当前关键字' }}」</p></template>
      </el-select>
      <el-select v-else ref="attrMultiSelect" v-model="attributeIds" multiple filterable collapse-tags collapse-tags-tooltip placement="top-start" popper-class="dict-select-popper" placeholder="搜索已有属性，可多选" style="width: 100%" :filter-method="rememberAttrQuery" @visible-change="dictDropOpen = $event">
        <el-option v-for="item in filteredAttributeChoices" :key="item.id" :label="item.name" :value="item.id" />
        <template #empty><p class="dict-empty">没有匹配「{{ attrQuery.trim() || '当前关键字' }}」</p></template>
      </el-select>
      <p v-if="attrQuery.trim() && !exactAttribute" class="dict-empty">没有找到「{{ attrQuery.trim() }}」。</p>
      <div class="dict-create">
        <el-button v-if="attrQuery.trim() && !exactAttribute" link type="primary" @click="beginCreateAttribute(attrQuery)">新增属性：{{ attrQuery.trim() }}</el-button>
        <el-button v-else-if="!creatingAttr" link type="primary" @click="creatingAttr = true">新增属性</el-button>
        <template v-if="creatingAttr">
          <el-input v-model="newAttrName" placeholder="新属性名称" @keydown.enter="createDictionaryAttribute" />
          <el-button type="primary" :loading="dictBusy" @click="createDictionaryAttribute">保存到词典并引用</el-button>
        </template>
      </div>
      <div v-if="boundParam" class="dict-global">
        <p>上面的选择只更换当前节点的引用，不会改「{{ boundParam.name }}」这个全局词典。</p>
        <el-button link type="primary" @click="openGlobalRename">编辑全局词典名称</el-button>
        <template v-if="globalRenameOpen">
          <p class="dict-empty">{{ globalRenameHint }}</p>
          <el-input v-model="globalName" :disabled="!globalRenameAllowed" placeholder="新的全局名称" />
          <el-button type="primary" :disabled="!globalRenameAllowed" @click="saveGlobalName">保存全局名称</el-button>
        </template>
      </div>
      <template #footer>
        <el-button @click="attributeOpen = false">取消</el-button>
        <el-button type="primary" @click="addAttribute">确定</el-button>
      </template>
    </NodeAddPanel>
    <NodeAddPanel v-model="valueOpen" title="添加属性值" :anchor="addAnchor" @closed="resetValueComposer">
      <p v-if="valueParentName" class="dict-empty">只搜索「{{ valueParentName }}」自己的取值，不会搜到其他属性。</p>
      <el-select v-if="valueBindNodeId" ref="valueBindSelect" v-model="valueBindPick" filterable placement="top-start" popper-class="dict-select-popper" placeholder="搜索已有取值" style="width: 100%" :filter-method="rememberValueQuery" @visible-change="dictDropOpen = $event">
        <el-option v-for="item in filteredRebindValues" :key="item" :label="item" :value="item" />
        <template #empty><p class="dict-empty">「{{ valueParentName }}」下没有匹配「{{ valueQuery.trim() || '当前关键字' }}」</p></template>
      </el-select>
      <el-select v-else ref="valueMultiSelect" v-model="valuePicks" multiple filterable collapse-tags collapse-tags-tooltip placement="top-start" popper-class="dict-select-popper" placeholder="搜索已有取值，可多选" style="width: 100%" :filter-method="rememberValueQuery" @visible-change="dictDropOpen = $event">
        <el-option v-for="item in filteredValueChoices" :key="item" :label="item" :value="item" />
        <template #empty><p class="dict-empty">「{{ valueParentName }}」下没有匹配「{{ valueQuery.trim() || '当前关键字' }}」</p></template>
      </el-select>
      <p v-if="valueQuery.trim() && !exactValue" class="dict-empty">没有找到「{{ valueQuery.trim() }}」。</p>
      <div class="dict-create">
        <el-button v-if="valueQuery.trim() && !exactValue" link type="primary" @click="beginCreateValue(valueQuery)">新增属性值：{{ valueQuery.trim() }}</el-button>
        <template v-if="creatingValue">
          <el-input v-model="newDictValue" placeholder="新属性值" @keydown.enter="createDictionaryValueForNode" />
          <el-button type="primary" :loading="dictBusy" @click="createDictionaryValueForNode">保存到词典并引用</el-button>
        </template>
      </div>
      <template #footer>
        <el-button @click="valueOpen = false">取消</el-button>
        <el-button v-if="valueBindNodeId" type="primary" :disabled="!valueBindPick" @click="rebindPickedValue">引用所选</el-button>
        <el-button v-else type="primary" :disabled="!valuePicks.length" @click="addValues">确定</el-button>
      </template>
    </NodeAddPanel>
    <el-dialog v-model="nodeDraftOpen" title="新增节点" width="420px">
      <p class="muted">类型</p>
      <el-radio-group v-model="nodeDraft.type">
        <el-radio value="ATTRIBUTE">属性节点</el-radio>
        <el-radio value="VALUE">属性值节点</el-radio>
      </el-radio-group>
      <el-input v-model="nodeDraft.name" placeholder="名称" style="margin-top: 12px" @keydown.enter="confirmNodeDraft" />
      <template #footer>
        <el-button @click="nodeDraftOpen = false">取消</el-button>
        <el-button type="primary" @click="confirmNodeDraft">确认</el-button>
      </template>
    </el-dialog>
    <TemplateCompatibilityDialog
      v-model="templateCompatibilityOpen"
      :model-id="templateId"
      :initial-node-id="compatibilityNodeId || undefined"
      :readonly="viewing || !store.isAdmin"
    />
    <el-dialog v-model="copyOpen" title="复制模型" width="440px" :show-close="!copying" :close-on-click-modal="!copying" :close-on-press-escape="!copying">
      <p class="copy-label">原模型</p>
      <strong v-if="!copyPick" class="copy-source">{{ copySourceName }}</strong>
      <el-select v-else :disabled="copying" v-model="copySourceId" placeholder="选择已有模型" style="width: 100%">
        <el-option v-for="item in copyChoices" :key="item.id" :label="item.label" :value="item.id" />
      </el-select>
      <p v-if="copyPick && copyChoices.length === 0" class="muted">还没有可复制的模型。</p>
      <p class="copy-label">新模型名称</p>
      <el-input :disabled="copying" v-model="copyName" placeholder="例如：二手机模型" @keydown.enter="confirmCopy" />
      <p class="muted">复制节点树、属性引用和当前草稿的适用设备配置。新模型从草稿开始，发布记录和商品仍属于原模型。</p>
      <template #footer>
        <el-button :disabled="copying" @click="copyOpen = false">取消</el-button>
        <el-button type="primary" :loading="copying" @click="confirmCopy">确认复制</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { Background } from '@vue-flow/background'
import { Handle, Position, useVueFlow, VueFlow } from '@vue-flow/core'
import { MiniMap } from '@vue-flow/minimap'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import NodeAddPanel from '../components/model-editor/NodeAddPanel.vue'
import ModelOutline from '../components/ModelOutline.vue'
import CategoryCatalog from '../components/model-editor/CategoryCatalog.vue'
import EmptyModelGuide from '../components/model-editor/EmptyModelGuide.vue'
import ModelOverview from '../components/model-editor/ModelOverview.vue'
import StructureMaterials from '../components/model-editor/StructureMaterials.vue'
import LegalComboDialog from '../components/model-editor/LegalComboDialog.vue'
import { presentComboRow, type MaterialLaunchMode } from '../components/model-editor/comboPresentation'
import { useComboSelection } from '../components/model-editor/useComboSelection'
import TemplateCompatibilityDialog from '../components/template-compatibility/TemplateCompatibilityDialog.vue'
import TypeModelRail from '../components/model-editor/TypeModelRail.vue'
import { categoryChain, visibleCategoryRows } from '../domain/categoryTree'
import { nearestNamingRule } from '../domain/naming'
import { arrangeSpecPositions, categoryPath, latestPublishedVersion, layoutSpecTree, modelVersionsOf, sameSpecSnapshot, specNodeSize, specTreeAdvance, SPEC_LINK_GAP, SPEC_TREE_GAP, SPEC_TREE_ORIGIN_X, SPEC_TREE_ORIGIN_Y, SPEC_VALUE_TO_VALUE } from '../domain/logic'
import { defaultOverviewCategoryId, overviewRootId as graphRootId } from '../domain/overviewGraph'
import { attributeRenameDecision, createDictionaryParam, createDictionaryValue } from '../domain/dictionaryGuard'
import { readTemplateCompatibilityConfig, templateCompatibilityContentSignature } from '../domain/templateCompatibility'
import { outlineChoices, rebindSpecNode } from '../domain/outlineEdit'
import { legalComboMaterialStatus } from '../domain/comboMaterialStatus'
import { previewDraftCombinations, publishImpactText } from '../domain/draftComboPreview'
import NamingRuleDialog from '../components/NamingRuleDialog.vue'
import TemporaryMaterialDialog from '../components/TemporaryMaterialDialog.vue'
import V3MaterialActions from '../components/V3MaterialActions.vue'
import type { ProductGrade, ProductSpecNode } from '../domain/types'
import { uid, useCatalogStore } from '../stores/catalog'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/minimap/dist/style.css'

import { captureEditor, editorEntry, prepareEditorUndo, sameEditorModel, type EditorHistoryEntry, type EditorSnapshot } from '../domain/editorHistory'

const store = useCatalogStore()
const route = useRoute()
const router = useRouter()
const { fitView, findNode, getViewport, onNodesChange, setViewport } = useVueFlow({ id: 'model-designer' })
const flowRevision = ref(0)
onNodesChange(() => {
  flowRevision.value += 1
})
const templateId = ref(typeof route.query.template === 'string' ? route.query.template : '')
watch(
  () => route.query.template,
  (value) => {
    if (typeof value === 'string' && value) templateId.value = value
    else if (route.query.panel === 'overview') templateId.value = ''
  },
)
function storedFold(key: string) {
  const saved = localStorage.getItem(key)
  if (saved === '0') return false
  if (saved === '1') return true
  return true
}
const treeFold = ref(storedFold('iyge-spec-cat-fold'))
const railFold = ref(storedFold('iyge-spec-rail-fold'))
function setTreeFold(value: boolean) {
  treeFold.value = value
  localStorage.setItem('iyge-spec-cat-fold', value ? '1' : '0')
}
function setRailFold(value: boolean) {
  railFold.value = value
  localStorage.setItem('iyge-spec-rail-fold', value ? '1' : '0')
}
const zoomRatio = ref(1)
const zoomLabel = computed(() => `${Math.round(zoomRatio.value * 100)}%`)
const viewing = computed(() => route.query.mode === 'view')
const surface = computed(() => (route.query.panel === 'overview' ? 'overview' : 'design'))
const fromOverview = computed(() => route.query.from === 'overview')
const overviewCategoryId = computed(() => (typeof route.query.category === 'string' ? route.query.category : ''))
const overviewTypeId = computed(() => (typeof route.query.type === 'string' ? route.query.type : ''))
const overviewKeyword = computed(() => (typeof route.query.q === 'string' ? route.query.q : ''))
const overviewFocusId = computed(() => (typeof route.query.focus === 'string' ? route.query.focus : ''))
const overviewView = computed(() => {
  if (route.query.view === 'list' || route.query.view === 'graph') return route.query.view
  const saved = sessionValue(OVERVIEW_VIEW_KEY)
  if (saved === 'list' || saved === 'graph') return saved
  return 'graph'
})
const overviewRootId = computed(() => (typeof route.query.root === 'string' ? route.query.root : ''))
const OVERVIEW_VIEW_KEY = 'iyge-overview-view'
const OVERVIEW_ROOT_KEY = 'iyge-overview-root'
const viewClosed = ref<string[]>([])
const leafId = ref('')
const activeTypeId = ref('')
const categoryKeyword = ref('')
const closedIds = ref(new Set<string>())
const categoryRows = computed(() => {
  const parents = new Set(store.data.categories.map((item) => item.parentId).filter((id): id is string => Boolean(id)))
  return visibleCategoryRows(store.data.categories, parents, categoryKeyword.value, closedIds.value)
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
  const context = editContext()
  activeTypeId.value = typeId
  try {
    const result = await ElMessageBox.prompt('模型名称', '创建空白模型', { inputValue: `${type.name}模型` })
    if (!sameContext(context) || viewing.value || !store.data.productTypes.some(item => item.id === type.id)) return
    const created = await store.createProductModel({ productTypeId: type.id, name: result.value })
    if (!sameContext(context)) return
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
const undoStack = ref<EditorHistoryEntry[]>([])
let editSession = 0
let interaction = 0
let pendingUndo: { modelId: string; session: number; before: EditorSnapshot } | undefined
const canEditStructure = computed(() => !viewing.value && surface.value === 'design' && store.isAdmin && !!templateId.value && store.data.templates.some(t => t.id === templateId.value) && (editorMode.value !== 'canvas' || viewMode.value === 'all'))
function editContext() { return { modelId: templateId.value, session: editSession, interaction } }
function sameContext(context: ReturnType<typeof editContext>) {
  return context.modelId === templateId.value && context.session === editSession && context.interaction === interaction
}
function validContext(context: ReturnType<typeof editContext>, nodeId?: string) {
  return canEditStructure.value && sameContext(context) && (!nodeId || nodes.value.some(n => n.id === nodeId))
}
const nodeDraftOpen = ref(false)
const nodeDraft = ref<{ type: ProductSpecNode['nodeType']; name: string }>({ type: 'ATTRIBUTE', name: '' })
const editingId = ref('')
const menu = ref({ open: false, x: 0, y: 0 })
const addAnchor = ref<HTMLElement | null>(null)
let addSourceId = ''
function captureAddAnchor(id: string) {
  const selector = editorMode.value === 'canvas' ? `.vue-flow__node[data-id="${CSS.escape(id || rootId)}"]` : `[data-line="${CSS.escape(id || rootId)}"]`
  addAnchor.value = document.querySelector<HTMLElement>(`.designer ${selector}`)
  if (!addAnchor.value) addAnchor.value = document.querySelector<HTMLElement>('.designer .board')
}
const attributeOpen = ref(false)
const dictDropOpen = ref(false)
type DictSelectExpose = { blur: () => void; expanded: boolean }
const attrBindSelect = ref<DictSelectExpose | null>(null)
const attrMultiSelect = ref<DictSelectExpose | null>(null)
const valueBindSelect = ref<DictSelectExpose | null>(null)
const valueMultiSelect = ref<DictSelectExpose | null>(null)
function dictSelects() {
  return [attrBindSelect.value, attrMultiSelect.value, valueBindSelect.value, valueMultiSelect.value]
}
function selectExpanded(item: DictSelectExpose | null) {
  if (!item) return false
  const flag = item.expanded as unknown
  if (flag && typeof flag === 'object' && 'value' in flag) return Boolean((flag as { value: boolean }).value)
  return Boolean(flag)
}
function closeDictDropdown() {
  const active = document.activeElement
  if (active instanceof HTMLElement && active.closest('.dict-select-popper, .el-select-dropdown')) active.blur()
  for (const node of document.querySelectorAll('.el-dialog .el-select input, .node-add-panel .el-select input')) {
    if (!(node instanceof HTMLInputElement) || !node.value) continue
    node.value = ''
    node.dispatchEvent(new Event('input', { bubbles: true }))
  }
  dictDropOpen.value = false
  for (const item of dictSelects()) {
    if (!item) continue
    item.expanded = false
    item.blur()
  }
  nextTick(() => {
    dictDropOpen.value = false
    for (const item of dictSelects()) if (item?.expanded) item.expanded = false
  })
}
function onDictEsc(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.isComposing) return
  if (!attributeOpen.value && !valueOpen.value) return
  event.preventDefault()
  event.stopImmediatePropagation()
  if (dictSelects().some((item) => selectExpanded(item))) {
    closeDictDropdown()
    return
  }
  if (valueOpen.value) valueOpen.value = false
  else attributeOpen.value = false
}
const copyOpen = ref(false)
const copying = ref(false), modelSaving = ref(false)
const templateCompatibilityOpen = ref(false)
const compatibilityNodeId = ref('')
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
const attrQuery = ref('')
const dictBusy = ref(false)
const globalRenameOpen = ref(false)
const globalName = ref('')
const valueOpen = ref(false)
const valueParentId = ref('')
const valueBindNodeId = ref('')
const valueBindPick = ref('')
const valuePicks = ref<string[]>([])
const valueQuery = ref('')
const creatingValue = ref(false)
const newDictValue = ref('')
const copyName = ref('')
const rootId = 'model-root'
const attachParent = ref<string | null>(null)
type FlowOption = { value: string; label: string }
type FlowNodeData = { id: string; label: string; role?: string; head?: boolean; selected: boolean; onPath: boolean; quiet: boolean; expanded: boolean; childCount: number; editValue: string; options: FlowOption[]; bound: boolean; source: string; valueText: string; boxWidth: number }
const flowNodes = ref<{ id: string; type: string; position: { x: number; y: number }; data: FlowNodeData }[]>([])
const flowEdges = ref<{ id: string; source: string; target: string; type: string; data: { childIds: string[]; hot: boolean } }[]>([])
const mapForced = ref<boolean | null>(null)

const nodes = computed(() => store.data.productSpecNodes.filter((item) => item.templateId === templateId.value))
const comboSelection = useComboSelection()
const { checkedIds, toggle: toggleCheck, clear: clearComboSelection } = comboSelection
const comboManageOpen = ref(false)
const comboKeyword = ref('')
const comboUnfiledOnly = ref(false)
const comboVersionId = ref('')
const showStructureMaterials = ref(false)
const materialHighlight = ref(new Set<string>())
const materialAttributeHighlight = computed(() => showStructureMaterials.value && viewMode.value === 'attribute'
  ? new Set(nodes.value.filter(node => materialHighlight.value.has(node.id)).map(node => node.parentId).filter(Boolean))
  : new Set<string>())
watch(templateId, () => { materialHighlight.value = new Set(); showStructureMaterials.value = false })
const publishedComboVersions = computed(() => modelVersionsOf(store.data, templateId.value).filter((item) => item.status === 'published'))
watch(
  () => `${templateId.value}#${publishedComboVersions.value.map((item) => item.id).join('|')}`,
  () => {
    comboVersionId.value = publishedComboVersions.value[publishedComboVersions.value.length - 1]?.id || ''
  },
  { immediate: true },
)
const materialLaunch = ref<{ token: number; key: string; mode: '' | MaterialLaunchMode }>({ token: 0, key: '', mode: '' })
const temporaryOpen = ref(false)
const temporaryListOpen = ref(false)
const temporaryMaterials = computed(() => {
  if (!templateId.value) return []
  const ids = new Set((store.data.planningRecords || []).filter((item) => item.origin === 'temporary' && item.productModelId === templateId.value).map((item) => item.planningId))
  return store.data.skus.filter((item) => item.planningId && ids.has(item.planningId))
})
const comboStatus = computed(() => legalComboMaterialStatus(store.data, templateId.value, comboVersionId.value))
const comboRows = computed(() => comboStatus.value.rows.map(presentComboRow))
const comboNumbered = computed(() => comboRows.value.filter((item) => item.planningId).length)
const comboFiled = computed(() => comboRows.value.filter((item) => item.materialCount > 0).length)
const comboHistorical = computed(() => comboRows.value.filter((item) => item.historicalMaterials.length > 0).length)
const comboSummaryText = computed(() => {
  if (comboFiled.value) return `已建物料 ${comboFiled.value} 条组合`
  if (comboHistorical.value) return `本版本尚无已建物料 · 另有 ${comboHistorical.value} 条组合在历史版本已建档`
  return '尚无已建物料'
})
const draftPreview = computed(() => previewDraftCombinations(store.data, templateId.value, nodes.value))
const publishImpact = computed(() => publishImpactText(draftPreview.value))
const compatibilityConfig = computed(() => readTemplateCompatibilityConfig(store.data, templateId.value))
const compatibilityUnpublished = computed(() => {
  const latest = latestPublishedVersion(store.data, templateId.value)
  return templateCompatibilityContentSignature(compatibilityConfig.value) !== templateCompatibilityContentSignature(latest?.templateCompatibilitySnapshot)
})
const compatibilitySummary = computed(() => {
  const config = compatibilityConfig.value
  if (!config || (!config.defaultRule.configured && !config.exceptions.length)) return '尚未配置'
  const claims = [...config.defaultRule.claims, ...config.exceptions.flatMap(rule => rule.claims)]
  const models = new Set(claims.map(item => `${item.host.productModelId}\u001f${item.host.identityKey}`)).size
  const state = config.defaultRule.configured ? config.defaultRule.claims.length ? '全部规格使用默认配置' : '默认明确留空' : '默认尚未配置'
  return `${models} 款设备 · ${state}${config.exceptions.length ? ` · ${config.exceptions.length} 项规格例外` : ''}`
})
function openTemplateCompatibility(nodeId = '') {
  if (nodeId && !canEditStructure.value) return
  compatibilityNodeId.value = nodeId
  templateCompatibilityOpen.value = true
}
const showDraftList = computed(() => draftPreview.value.problems.length > 0 || canvas.value.status !== 'published' || draftPreview.value.rows.length !== comboRows.value.length)
const draftPreviewLine = computed(() => {
  const preview = draftPreview.value
  if (preview.problems.length) return `草稿预览暂时无法生成：${preview.problems[0]}`
  if (!showDraftList.value) return ''
  return `草稿预览 ${preview.rows.length} 条 · 尚未发布`
})
const visibleComboRows = computed(() => {
  const text = comboKeyword.value.trim().toLowerCase()
  return comboRows.value.filter((row) => {
    if (comboUnfiledOnly.value && row.materialCount > 0) return false
    if (!text) return true
    return `${row.label} ${row.recordId} ${row.materialCodes} ${row.materialNames}`.toLowerCase().includes(text)
  })
})
const actionCombo = computed(() => comboRows.value.find((item) => item.key === materialLaunch.value.key))
watch(templateId, () => {
  clearComboSelection()
  comboManageOpen.value = false
  comboKeyword.value = ''
  comboUnfiledOnly.value = false
  materialLaunch.value = { token: 0, key: '', mode: '' }
})
watch(comboRows, (rows) => {
  comboSelection.retain(rows.map((item) => item.planningId).filter(Boolean))
})
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
  if (!node?.parentId) return false
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
const keysOpen = ref(localStorage.getItem('iyge-spec-keys-open') === '1')
watch(keysOpen, (open) => localStorage.setItem('iyge-spec-keys-open', open ? '1' : '0'))
const quickHints = computed(() => {
  const kind = menuKind.value
  return [
    { keys: 'Tab', label: kind === 'value' ? '条件属性' : kind === 'model' ? '添加属性' : '子属性', enabled: true, note: '' },
    { keys: 'V', label: '属性值', enabled: kind === 'attribute', note: kind === 'attribute' ? '给当前属性添加取值' : '只有选中属性时才能添加属性值' },
    { keys: 'Enter', label: kind === 'value' ? '同级取值' : '同级', enabled: true, note: enterAction.value },
    { keys: 'Delete', label: '删除', enabled: kind !== 'model', note: kind === 'model' ? '不能删除模型本身' : '删除当前节点' },
    { keys: 'Ctrl+Z', label: '撤销', enabled: true, note: '撤销最近一次结构编辑。输入框里仍是文字撤销' },
  ]
})
const shortcutGroups = computed(() => {
  const kind = menuKind.value
  return [
    {
      title: '节点创建',
      items: [
        { name: kind === 'value' ? '添加条件属性' : kind === 'model' ? '添加属性' : '添加子属性', keys: 'Tab', enabled: true, when: '画布有焦点，且没有打开输入框或弹窗' },
        { name: '添加属性值', keys: 'V', enabled: kind === 'attribute', when: kind === 'attribute' ? '当前选中的是属性' : '取值和模型上按 V 不会添加节点' },
        { name: enterAction.value, keys: 'Enter', enabled: true, when: '属性上是同级属性，取值上是同级取值' },
      ],
    },
    {
      title: '节点管理',
      items: [
        { name: '提升一层', keys: 'Shift+Tab', enabled: canPromote.value, when: '已经是第一层，或取值提升后无处可挂时，只提示，不改结构' },
        { name: '调整同级顺序', keys: '↑ ↓', enabled: kind !== 'model', when: '结构视图在画布有焦点时可用。大纲和幕布在当前编辑行上可用' },
        { name: '删除节点', keys: 'Delete', enabled: kind !== 'model', when: '不能删除模型本身。已被商品使用的节点仍会被拦住' },
      ],
    },
    {
      title: '编辑',
      items: [
        { name: '撤销结构编辑', keys: 'Ctrl+Z', enabled: true, when: '画布有焦点时撤销模型。输入框里交给文字自己撤销' },
        { name: '保存模型', keys: 'Ctrl+S', enabled: true, when: '画布有焦点，且没有弹窗' },
        { name: '结束本行编辑', keys: 'Ctrl+Enter', enabled: editorMode.value !== 'canvas', when: '只在大纲或幕布正在编辑一行时可用' },
        { name: '取消编辑或关闭菜单', keys: 'Esc', enabled: true, when: '大纲里取消当前行。结构视图里关闭节点菜单' },
        { name: '全部展开', keys: 'Ctrl+A', enabled: editorMode.value === 'canvas', when: '只在结构视图、画布有焦点时展开节点' },
      ],
    },
    {
      title: '画布',
      items: [
        { name: '缩放和平移', keys: '鼠标', enabled: true, when: '滚轮缩放，按住空白拖动画布。没有单独的键盘缩放键' },
        { name: '适应全部 / 回到 100%', keys: '工具栏', enabled: true, when: '缩放比例显示在工具条上。滚轮按鼠标位置缩放，没有单独的放大缩小按钮' },
      ],
    },
  ]
})
const canvas = computed(() => store.data.specCanvases.find((item) => item.templateId === templateId.value) || { templateId: templateId.value, zoom: 1, panX: 0, panY: 0, status: 'draft' as const, version: 1, versionName: 'V1' })
const versionBadge = computed(() => {
  const published = modelVersionsOf(store.data, templateId.value).filter((item) => item.status === 'published')
  const latest = published[published.length - 1]
  if (canvas.value.status === 'published' && latest) return { text: `已发布 ${latest.versionName}`, type: 'success' as const, note: '当前内容与最近发布快照一致。查看不会改写这份快照。' }
  if (canvas.value.status === 'offline') return { text: latest ? `已下线 · 快照 ${latest.versionName}` : '已下线', type: 'warning' as const, note: '历史发布快照仍保留。查看不会把它换成草稿。' }
  if (latest) return { text: `草稿 · 快照 ${latest.versionName}`, type: 'info' as const, note: `最近发布快照是 ${latest.versionName}。当前画布是草稿，查看不会覆盖快照。` }
  return { text: '草稿', type: 'info' as const, note: '还没有发布快照。' }
})
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
const filteredAttributeChoices = computed(() => {
  const query = attrQuery.value.trim().toLowerCase()
  if (!query) return attributeChoices.value
  return attributeChoices.value.filter((item) => item.name.toLowerCase().includes(query))
})
const exactAttribute = computed(() => attributeChoices.value.some((item) => item.name === attrQuery.value.trim()))
const boundParam = computed(() => {
  const node = nodes.value.find((item) => item.id === attributeBindId.value && item.nodeType === 'ATTRIBUTE')
  return store.data.params.find((item) => item.id === node?.attributeId)
})
const globalRenameHint = computed(() => {
  if (!boundParam.value) return ''
  const probe = globalName.value.trim() && globalName.value.trim() !== boundParam.value.name ? globalName.value : `${boundParam.value.name}新名`
  return attributeRenameDecision(store.data, boundParam.value.id, probe).message
})
const globalRenameAllowed = computed(() => {
  if (!boundParam.value) return false
  const probe = globalName.value.trim() && globalName.value.trim() !== boundParam.value.name ? globalName.value : `${boundParam.value.name}新名`
  return attributeRenameDecision(store.data, boundParam.value.id, probe).ok
})
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
const parentParamValues = computed(() => {
  const parent = nodes.value.find((item) => item.id === valueParentId.value && item.nodeType === 'ATTRIBUTE')
  return store.data.params.find((item) => item.id === parent?.attributeId)?.values || []
})
const exactValue = computed(() => parentParamValues.value.includes(valueQuery.value.trim()))
const filteredValueChoices = computed(() => {
  const query = valueQuery.value.trim().toLowerCase()
  return valueChoices.value.filter((item) => !query || item.toLowerCase().includes(query))
})
const filteredRebindValues = computed(() => {
  const node = nodes.value.find((item) => item.id === valueBindNodeId.value)
  const used = new Set(nodes.value.filter((item) => item.parentId === valueParentId.value && item.id !== node?.id && item.nodeType === 'VALUE').map((item) => item.valueId))
  const query = valueQuery.value.trim().toLowerCase()
  return parentParamValues.value.filter((item) => (item === node?.valueId || !used.has(item)) && (!query || item.toLowerCase().includes(query)))
})
const schemeTitle = computed(() => store.data.specCanvases.find((item) => item.templateId === templateId.value)?.name?.trim() || store.data.templates.find((item) => item.id === templateId.value)?.name?.trim() || '商品模型')
const currentProductType = computed(() => {
  const canvasRow = store.data.specCanvases.find((item) => item.templateId === templateId.value)
  return store.data.productTypes.find((item) => item.id === canvasRow?.productTypeId)
})
const categoryText = computed(() => (currentProductType.value ? categoryPath(store.data, currentProductType.value.categoryId) : '未指定'))
const productTypeText = computed(() => currentProductType.value?.name || '未指定')
const nodeTotal = computed(() => nodes.value.length)
const selectionTrail = computed(() => {
  if (!current.value) return ''
  const names: string[] = []
  let parentId = current.value.parentId
  const guard = new Set<string>()
  while (parentId && !guard.has(parentId)) {
    guard.add(parentId)
    const parent = nodes.value.find((item) => item.id === parentId)
    if (!parent) break
    names.unshift(nodeTitle(parent))
    parentId = parent.parentId
  }
  return names.join(' / ')
})
const structureNotes = computed(() => {
  const notes: string[] = []
  const groups = new Map<string, ProductSpecNode[]>()
  nodes.value.filter((item) => item.nodeType === 'ATTRIBUTE' && item.attributeId).forEach((item) => {
    const list = groups.get(item.attributeId) || []
    list.push(item)
    groups.set(item.attributeId, list)
  })
  groups.forEach((list) => {
    if (list.length < 2) return
    const name = nodeTitle(list[0])
    const places = list.map((item) => {
      const parent = item.parentId ? nodes.value.find((row) => row.id === item.parentId) : undefined
      return parent ? nodeTitle(parent) : '模型根'
    })
    notes.push(`「${name}」出现了 ${list.length} 次，分别挂在 ${places.join('、')} 下面。这是当前保存的父子关系，自动布局不会删掉或挪走它们。`)
  })
  nodes.value.filter((item) => item.nodeType === 'VALUE').forEach((item) => {
    const children = nodes.value.filter((row) => row.parentId === item.id && row.nodeType === 'ATTRIBUTE')
    if (children.length < 4) return
    notes.push(`「${nodeTitle(item)}」下面有 ${children.length} 个条件属性。它们会收成这一取值右侧的一组，不会改成别的父节点。`)
  })
  if (notes.length) notes.unshift(`当前模型共 ${nodeTotal.value} 个节点。`)
  return notes
})

watch([templateId, surface, viewing, () => store.editorGeneration, () => store.data.templates.some(t => t.id === templateId.value)], () => {
  editSession += 1
  pendingUndo = undefined
  undoStack.value = []
  invalidateEditorDialogs()
}, { flush: 'sync' })
watch(() => [editorMode.value, viewMode.value], () => {
  invalidateEditorDialogs()
}, { flush: 'sync' })
const dialogContexts = new Map<string, ReturnType<typeof editContext> & { nodeId: string }>()
for (const [kind, open] of [['attribute', attributeOpen], ['value', valueOpen], ['node', nodeDraftOpen]] as const) {
  watch(open, value => {
    interaction += 1
    if (value) {
      if (kind === 'attribute') valueOpen.value = false
      if (kind === 'value') attributeOpen.value = false
      const nodeId = kind === 'attribute' ? attributeBindId.value || attachParent.value || '' : kind === 'value' ? valueBindNodeId.value || valueParentId.value : selected.value === rootId ? '' : selected.value
      captureAddAnchor(addSourceId || nodeId || selected.value)
      addSourceId = ''
      dialogContexts.set(kind, { ...editContext(), nodeId })
    }
    else dialogContexts.delete(kind)
  }, { flush: 'sync' })
}
function validDialog(kind: string, nodeId?: string) {
  const context = dialogContexts.get(kind)
  return !!context && validContext(context, context.nodeId || undefined) && (!nodeId || nodeId === context.nodeId || (kind === 'value' && nodeId === valueParentId.value))
}
watch(() => [canEditStructure.value, nodes.value.map(n => n.id).join('|')], () => {
  for (const [kind, open] of [['attribute', attributeOpen], ['value', valueOpen]] as const) {
    if (open.value && !validDialog(kind)) open.value = false
  }
})
watch(comboVersionId, () => { dragStart = undefined; attributeOpen.value = false; valueOpen.value = false })
function invalidateEditorDialogs() {
  interaction += 1
  dragStart = undefined
  editingId.value = ''
  menu.value.open = false
  attributeOpen.value = false
  valueOpen.value = false
  nodeDraftOpen.value = false
  namingOpen.value = false
}
watch(templateId, () => {
  if (!templateId.value) return
  selected.value = ''
  if (viewing.value || route.query.mode === 'view') {
    viewClosed.value = store.data.productSpecNodes.filter((item) => item.templateId === templateId.value && item.expanded === false).map((item) => item.id)
  } else {
    ensureCanvas()
    ensureTreeLayout()
  }
  frameCanvas()
  const canvasRow = store.data.specCanvases.find((item) => item.templateId === templateId.value)
  const owner = store.data.productTypes.find((item) => item.id === canvasRow?.productTypeId)
  if (owner) {
    leafId.value = owner.categoryId
    activeTypeId.value = owner.id
  }
}, { immediate: true })
watch(viewing, (isView) => {
  if (!isView || !templateId.value) return
  viewClosed.value = store.data.productSpecNodes.filter((item) => item.templateId === templateId.value && item.expanded === false).map((item) => item.id)
})
watch(editorMode, (mode) => {
  menu.value.open = false
  if (mode === 'canvas' && canEditStructure.value) reflowTree()
  if ((mode === 'outline' || mode === 'document') && selected.value) revealAncestors(selected.value)
})
watch(
  () => [templateId.value, selected.value, editingId.value, viewMode.value, viewing.value ? 'view' : 'edit', viewClosed.value.join(','), store.data.productSpecNodes.map((item) => `${item.id}:${item.parentId}:${item.positionX}:${item.positionY}:${item.attributeId}:${item.valueId}:${item.role}:${item.expanded}:${(item.namingRule || []).map((part) => part.kind + (part.key || '') + (part.text || '')).join(',')}`).join('|'), store.data.params.map((item) => `${item.id}:${item.name}`).join('|')].join('#'),
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

function layoutOriginX() {
  const rootWidth = Math.max(148, specNodeSize('ATTRIBUTE', schemeTitle.value).width)
  return 16 + rootWidth + SPEC_LINK_GAP
}
function freshNodes() {
  return nodes.value.filter((item) => item.positionX === 0 && item.positionY === 0)
}
function placeFreshNodes() {
  freshNodes().slice().sort((a, b) => a.sort - b.sort).forEach((node) => {
    const parent = node.parentId ? nodes.value.find((item) => item.id === node.parentId) : undefined
    const step = parent ? specTreeAdvance(parent.nodeType, nodeTitle(parent)) : 0
    const leftEdge = parent ? (parent.positionX ?? layoutOriginX()) + step : layoutOriginX()
    node.positionX = leftEdge
    const size = specNodeSize(node.nodeType, nodeTitle(node))
    let y = parent?.positionY ?? SPEC_TREE_ORIGIN_Y
    const placed = () => nodes.value.filter((item) => item.id !== node.id && !(item.positionX === 0 && item.positionY === 0))
    const hits = (top: number) => placed().some((item) => {
      const box = specNodeSize(item.nodeType, nodeTitle(item))
      const left = item.positionX ?? 0
      const itemTop = item.positionY ?? 0
      const separated = leftEdge + size.width <= left || left + box.width <= leftEdge || top + size.height <= itemTop || itemTop + box.height <= top
      return !separated
    })
    let guard = 0
    while (hits(y) && guard < 64) {
      const bottoms = placed().map((item) => (item.positionY ?? 0) + specNodeSize(item.nodeType, nodeTitle(item)).height)
      y = Math.max(y + size.height, ...bottoms) + SPEC_TREE_GAP
      guard += 1
    }
    node.positionY = y
  })
}
function manualHold() {
  const row = ensureCanvas()
  return row.direction === 'custom' && row.layoutLocked === true
}
function ensureTreeLayout() {
  const row = ensureCanvas()
  if (manualHold()) {
    if (freshNodes().length) placeFreshNodes()
    return
  }
  arrangeSpecPositions(nodes.value, nodeTitle, layoutOriginX())
  row.direction = 'logic'
  row.layoutLocked = false
}
function reflowTree() {
  if (!canEditStructure.value) { paint(); return }
  const row = ensureCanvas()
  if (manualHold()) {
    placeFreshNodes()
    return
  }
  arrangeSpecPositions(nodes.value, nodeTitle, layoutOriginX())
  row.direction = 'logic'
  row.layoutLocked = false
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
function outlineOptions(node: ProductSpecNode) {
  return outlineChoices(store.data, node.id)
}
function applyOutlineCreate(payload: { id: string; name: string }) {
  if (!canEditStructure.value) return
  if (viewing.value) return
  const node = nodes.value.find((item) => item.id === payload.id)
  if (!node) return
  if (node.nodeType === 'ATTRIBUTE') {
    attributeBindId.value = node.id
    attributePick.value = node.attributeId
    attributeTitle.value = '新增属性'
    beginCreateAttribute(payload.name)
    attributeOpen.value = true
    return
  }
  valueBindNodeId.value = node.id
  valueParentId.value = node.parentId || ''
  valueBindPick.value = node.valueId
  beginCreateValue(payload.name)
  valueOpen.value = true
}
function rememberAttrQuery(query: string) {
  attrQuery.value = query
}
function rememberValueQuery(query: string) {
  valueQuery.value = query
}
function beginCreateAttribute(name: string) {
  creatingAttr.value = true
  newAttrName.value = name.trim()
}
function beginCreateValue(name: string) {
  creatingValue.value = true
  newDictValue.value = name.trim()
}
function resetValueComposer() {
  valueQuery.value = ''
  creatingValue.value = false
  newDictValue.value = ''
  valueBindNodeId.value = ''
  valueBindPick.value = ''
}
function applyOutlineChoice(payload: { id: string; token: string }) {
  if (!canEditStructure.value) return
  const node = nodes.value.find((item) => item.id === payload.id)
  if (!node) return
  if (!payload.token) {
    ElMessage.warning(node.nodeType === 'ATTRIBUTE' ? '属性词典里还没有可选属性' : '这个属性还没有可选取值')
    return
  }
  pushUndo()
  const result = rebindSpecNode(store.data, node.id, node.nodeType === 'ATTRIBUTE' ? { attributeId: payload.token } : { valueId: payload.token })
  if (!result.ok || !result.changed) cancelUndo()
  if (!result.ok) ElMessage.warning(result.message)
  else if (result.changed) reflowTree()
}
function openHostConfig() {
  if (viewing.value || !current.value) return
  openTemplateCompatibility(selected.value)
}
function ruleMark(node: ProductSpecNode) {
  if (node.namingRule?.length) return '自有' as const
  if (!node.parentId) return '' as const
  return nearestNamingRule(nodes.value, node.parentId) ? '继承' as const : '' as const
}
function nodeTitle(node: ProductSpecNode) {
  if (node.nodeType === 'VALUE') return node.valueId || '未命名取值'
  return attributeHint(node).bound ? store.data.params.find((item) => item.id === node.attributeId)?.name || '未绑定属性' : '未绑定属性'
}
function valueOptions(node: ProductSpecNode): FlowOption[] {
  const values = store.data.params.find((item) => item.id === node.attributeId)?.values || []
  const used = new Set(nodes.value.filter((item) => item.parentId === node.parentId && item.id !== node.id && item.nodeType === 'VALUE').map((item) => item.valueId))
  return [...values.filter((item) => item === node.valueId || !used.has(item)).map((item) => ({ value: item, label: item })), { value: '__create__', label: '新增属性值…' }]
}
function attributeOptions(): FlowOption[] {
  return [...attributeChoices.value.map((item) => ({ value: item.id, label: item.name })), { value: '__create__', label: '新增属性…' }]
}
function childCount(id: string) {
  return descendantIds(id).length
}
function matchesView(node: ProductSpecNode) {
  if (viewMode.value === 'attribute') return node.nodeType === 'ATTRIBUTE'
  if (viewMode.value === 'value') return node.nodeType === 'VALUE'
  return true
}
function nodeOpen(node: ProductSpecNode) {
  if (!canEditStructure.value) return !viewClosed.value.includes(node.id)
  return node.expanded !== false
}
function isShown(node: ProductSpecNode) {
  if (!matchesView(node)) return false
  let parentId = node.parentId
  const guard = new Set<string>()
  while (parentId && !guard.has(parentId)) {
    guard.add(parentId)
    const parent = nodes.value.find((item) => item.id === parentId)
    if (!parent) return true
    if (!nodeOpen(parent)) return false
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
const mapOpen = computed(() => (mapForced.value === null ? nodes.value.length >= 48 : mapForced.value))
function toggleMap() {
  mapForced.value = !mapOpen.value
}
function paint() {
  const visible = nodes.value.filter(isShown)
  const highlight = pathIds()
  const focused = Boolean(selected.value)
  const near = new Set<string>()
  if (selected.value) {
    const parentKey = selected.value === rootId ? null : selected.value
    visible.forEach((node) => {
      if ((parentKey === null && !node.parentId) || node.parentId === parentKey) near.add(node.id)
    })
    if (selected.value !== rootId) near.add(selected.value)
  }
  const projected = viewing.value || viewMode.value !== 'all'
    ? layoutSpecTree(visible.map((node) => ({
      id: node.id,
      parentId: visibleAnchor(node) === rootId ? null : visibleAnchor(node),
      sort: node.sort,
      nodeType: node.nodeType,
      label: nodeTitle(node),
    })), layoutOriginX())
    : null
  const posOf = (node: ProductSpecNode) => projected?.get(node.id) || { x: node.positionX ?? 248, y: node.positionY ?? 36 }
  const anchored = visible.filter((node) => visibleAnchor(node) === rootId)
  const basis = anchored.length ? anchored : visible
  const rootY = basis.length ? Math.round(basis.reduce((sum, item) => sum + posOf(item).y + (item.nodeType === 'VALUE' ? 17 : 21), 0) / basis.length - 24) : 28
  const rootWidth = Math.max(148, specNodeSize('ATTRIBUTE', schemeTitle.value).width)
  flowNodes.value = [
    { id: rootId, type: 'model', position: { x: 16, y: Math.max(8, rootY) }, data: { id: rootId, label: schemeTitle.value, selected: selected.value === rootId, onPath: highlight.has(rootId), quiet: focused && !highlight.has(rootId) && !near.has(rootId), expanded: true, childCount: basis.length, editValue: '', options: [], bound: false, source: '', valueText: '', boxWidth: rootWidth } },
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
          quiet: focused && !highlight.has(node.id) && !near.has(node.id),
          expanded: nodeOpen(node),
          childCount: viewChildCount(node.id),
          editValue: node.nodeType === 'ATTRIBUTE' ? node.attributeId : node.valueId,
          options: node.nodeType === 'ATTRIBUTE' ? attributeOptions() : valueOptions(node),
          bound: hint.bound,
          source: hint.source,
          valueText: hint.values,
          ruleKind: ruleMark(node) === '自有' ? 'own' : ruleMark(node) === '继承' ? 'inherited' : '',
          ruleTitle: ruleMark(node) === '自有' ? '这个节点有自己的命名规则' : '这个节点使用最近祖先的命名规则',
          boxWidth: specNodeSize(node.nodeType, nodeTitle(node)).width,
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
    data: { childIds, hot: !focused || highlight.has(source) },
  }))
}
function measuredBox(id: string) {
  const live = findNode(id)
  const stored = flowNodes.value.find((item) => item.id === id)
  const x = live?.position.x ?? stored?.position.x
  const y = live?.position.y ?? stored?.position.y
  if (x === undefined || y === undefined) return null
  const width = live?.dimensions?.width || stored?.data.boxWidth || (id === rootId ? 160 : stored?.type === 'value' ? 84 : 136)
  const height = live?.dimensions?.height || (id === rootId ? 48 : stored?.type === 'value' ? 34 : 42)
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
  if (targets.length === 1 && Math.abs(targets[0].y - sy) < 3) return `M ${sx} ${sy} H ${targets[0].x}`
  const spine = Math.max(sx + 12, Math.min(...targets.map((item) => item.x)) - 14)
  const top = Math.min(sy, targets[0].y)
  const bottom = Math.max(sy, targets[targets.length - 1].y)
  const parts = [`M ${sx} ${sy} H ${spine}`, `M ${spine} ${top} V ${bottom}`]
  targets.forEach((item) => parts.push(`M ${spine} ${item.y} H ${item.x}`))
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
    if (!canEditStructure.value) viewClosed.value = viewClosed.value.filter(id => id !== parent.id)
    else if (parent.expanded === false) parent.expanded = true
    parentId = parent.parentId
  }
}
function onNodeClick(payload: { event?: { target?: EventTarget | null }; node: { id: string } }) {
  const target = payload.event?.target as HTMLElement | null
  if (target?.closest?.('.fold, .inline-edit, .pick-attr')) return
  selected.value = payload.node.id
  revealAncestors(payload.node.id)
  menu.value.open = false
  nextTick(() => document.querySelector<HTMLElement>('.designer .board')?.focus({ preventScroll: true }))
}
function canvasSize() {
  const el = document.querySelector('.designer .canvas') as HTMLElement | null
  if (!el) return null
  return { width: el.clientWidth, height: el.clientHeight }
}
function contentBounds() {
  const boxes = flowNodes.value.map((item) => measuredBox(item.id)).filter((item): item is { x: number; y: number; width: number; height: number } => Boolean(item))
  if (!boxes.length) return null
  const minX = Math.min(...boxes.map((item) => item.x))
  const minY = Math.min(...boxes.map((item) => item.y))
  const maxX = Math.max(...boxes.map((item) => item.x + item.width))
  const maxY = Math.max(...boxes.map((item) => item.y + item.height))
  return { minX, minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) }
}
function frameCanvas() {
  if (editorMode.value !== 'canvas' || !templateId.value) return
  nextTick(() => {
    requestAnimationFrame(() => {
      const bounds = contentBounds()
      const size = canvasSize()
      if (!bounds || !size || size.width < 80 || size.height < 80) return
      const pad = 56
      const fitZoom = Math.min((size.width - pad * 2) / bounds.width, (size.height - pad * 2) / bounds.height)
      const zoom = fitZoom >= 1.4 ? 1.22 : 1
      const fits = bounds.width * zoom + pad <= size.width && bounds.height * zoom + pad <= size.height
      const x = fits ? (size.width - bounds.width * zoom) / 2 - bounds.minX * zoom : pad - bounds.minX * zoom
      const y = bounds.height * zoom + pad <= size.height ? (size.height - bounds.height * zoom) / 2 - bounds.minY * zoom : pad - bounds.minY * zoom
      setViewport({ x, y, zoom }, { duration: 180 }).catch(() => undefined)
    })
  })
}
function fitAll() {
  const bounds = contentBounds()
  const size = canvasSize()
  if (!bounds || !size || size.width < 80 || size.height < 80) {
    fitView({ padding: 0.12, minZoom: 0.85, maxZoom: 1, duration: 180 }).catch(() => undefined)
    return
  }
  const pad = 48
  const fitZoom = Math.min((size.width - pad * 2) / bounds.width, (size.height - pad * 2) / bounds.height)
  const zoom = Math.min(1, Math.max(0.85, Number.isFinite(fitZoom) ? fitZoom : 1))
  const fitsW = bounds.width * zoom + pad * 2 <= size.width
  const fitsH = bounds.height * zoom + pad * 2 <= size.height
  const focus = selected.value && selected.value !== rootId ? measuredBox(selected.value) : null
  const x = !fitsW && focus ? size.width / 2 - (focus.x + focus.width / 2) * zoom : fitsW ? (size.width - bounds.width * zoom) / 2 - bounds.minX * zoom : pad - bounds.minX * zoom
  const y = !fitsH && focus ? size.height / 2 - (focus.y + focus.height / 2) * zoom : fitsH ? (size.height - bounds.height * zoom) / 2 - bounds.minY * zoom : pad - bounds.minY * zoom
  setViewport({ x, y, zoom }, { duration: 180 }).catch(() => undefined)
}
function zoomReset() {
  const size = canvasSize()
  const vp = getViewport()
  if (!size) return
  const cx = size.width / 2
  const cy = size.height / 2
  const zoom = 1
  setViewport({
    x: cx - ((cx - vp.x) / vp.zoom) * zoom,
    y: cy - ((cy - vp.y) / vp.zoom) * zoom,
    zoom,
  }, { duration: 160 }).catch(() => undefined)
}
function onZoomCommand(command: string) {
  if (command === 'reset') zoomReset()
  if (command === 'map') toggleMap()
}
function toggleAllBranches() {
  setExpanded(anyCollapsed.value)
}
function revealNode(id: string) {
  if (editorMode.value !== 'canvas' || !id) return
  nextTick(() => {
    requestAnimationFrame(() => {
      const box = measuredBox(id)
      const size = canvasSize()
      if (!box || !size) return
      const vp = getViewport()
      const left = box.x * vp.zoom + vp.x
      const top = box.y * vp.zoom + vp.y
      const right = (box.x + box.width) * vp.zoom + vp.x
      const bottom = (box.y + box.height) * vp.zoom + vp.y
      const margin = 48
      let dx = 0
      let dy = 0
      if (left < margin) dx = margin - left
      else if (right > size.width - margin) dx = size.width - margin - right
      if (top < margin) dy = margin - top
      else if (bottom > size.height - margin) dy = size.height - margin - bottom
      if (!dx && !dy) return
      setViewport({ x: vp.x + dx, y: vp.y + dy, zoom: vp.zoom }, { duration: 180 }).catch(() => undefined)
    })
  })
}
const framedTemplate = ref('')
function onNodesReady() {
  if (framedTemplate.value === templateId.value) return
  framedTemplate.value = templateId.value
  frameCanvas()
}
function onNodeDoubleClick(payload: { event: { target?: EventTarget | null }; node: { id: string } }) {
  const target = payload.event.target as HTMLElement | null
  if (target?.closest?.('.fold, .inline-edit, .pick-attr')) return
  beginEdit(payload.node.id)
}
function beginEdit(id: string) {
  if (!canEditStructure.value) return
  if (viewing.value) return
  if (id === rootId) {
    selected.value = id
    editingId.value = ''
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
function finishUndo() {
  const pending = pendingUndo
  pendingUndo = undefined
  if (!pending || pending.modelId !== templateId.value || pending.session !== editSession) return
  const entry = editorEntry(pending.modelId, pending.session, pending.before, captureEditor(store.data, pending.modelId))
  if (entry) undoStack.value.push(entry)
  if (undoStack.value.length > 40) undoStack.value.shift()
}
function pushUndo() {
  if (!canEditStructure.value || pendingUndo) return
  pendingUndo = { ...editContext(), before: captureEditor(store.data, templateId.value) }
  queueMicrotask(finishUndo)
}
function cancelUndo() {
  const pending = pendingUndo
  pendingUndo = undefined
  if (!pending || pending.modelId !== templateId.value || pending.session !== editSession) return
  const entry = editorEntry(pending.modelId, pending.session, pending.before, captureEditor(store.data, pending.modelId))
  if (!entry) return
  // This is the synchronous transaction's own rollback; no awaited work is captured here.
  store.data.productSpecNodes = [...store.data.productSpecNodes.filter(n => n.templateId !== pending.modelId), ...pending.before.nodes]
  store.data.templateParams = [...store.data.templateParams.filter(n => n.templateId !== pending.modelId), ...pending.before.bindings]
  store.data.templates.find(t => t.id === pending.modelId)!.structureOrder = pending.before.order
  for (const change of entry.dictionary) {
    const index = store.data.params.findIndex(p => p.id === change.id)
    if (change.before && index >= 0) store.data.params.splice(index, 1, change.before)
    else if (change.before) store.data.params.push(change.before)
    else if (index >= 0) store.data.params.splice(index, 1)
  }
}
function undoOutline() {
  if (!canEditStructure.value) return
  finishUndo()
  const entry = undoStack.value.at(-1)
  if (!entry) return
  const candidate = prepareEditorUndo(store.data, entry, templateId.value, editSession)
  if (!candidate.ok) { ElMessage.warning(candidate.message); return }
  store.data.productSpecNodes = candidate.nodes
  store.data.templateParams = candidate.bindings
  store.data.nodeCompatibilityRules = candidate.nodeRules
  for (const change of entry.dictionary) {
    const index = store.data.params.findIndex(p => p.id === change.id)
    const restored = candidate.params.find(p => p.id === change.id)
    if (restored && index >= 0) store.data.params.splice(index, 1, restored)
    else if (restored) store.data.params.push(restored)
    else if (index >= 0) store.data.params.splice(index, 1)
  }
  store.data.templates.find(t => t.id === entry.modelId)!.structureOrder = candidate.order
  undoStack.value.pop()
  selected.value = ''
  markWorkingDraft()
  paint()
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
  const result = createDictionaryParam(store.data, name, () => uid('p'))
  if (!result.ok || !result.id) {
    ElMessage.warning(result.message)
    return undefined
  }
  attachParam(result.id)
  return store.data.params.find((item) => item.id === result.id)
}
function linkAttribute(node: ProductSpecNode, paramId: string) {
  const result = rebindSpecNode(store.data, node.id, { attributeId: paramId })
  if (!result.ok) {
    cancelUndo()
    ElMessage.warning(result.message)
    return false
  }
  const bound = attachParam(paramId)
  node.role = bound?.role === 'common' ? 'COMMON' : 'VARIANT'
  return true
}
async function renameOutline(payload: { id: string; name: string }) {
  if (!canEditStructure.value) return
  const context = editContext()
  const node = nodes.value.find((item) => item.id === payload.id)
  const text = payload.name.trim()
  if (!node || !text || text === nodeTitle(node)) return
  if (node.nodeType === 'ATTRIBUTE') {
    const found = store.data.params.find((item) => item.name === text)
    if (found) {
      pushUndo()
      if (!linkAttribute(node, found.id)) return
      return
    }
    const current = store.data.params.find((item) => item.id === node.attributeId)
    const usedElsewhere = store.data.productSpecNodes.some((item) => item.id !== node.id && item.attributeId === current?.id && !(item.parentId === node.id && item.nodeType === 'VALUE'))
      || store.data.templateParams.some((item) => item.paramId === current?.id && item.templateId !== templateId.value)
    if (current && !usedElsewhere) {
      const decision = attributeRenameDecision(store.data, current.id, text)
      if (!decision.ok) {
        ElMessage.warning(decision.message)
        return
      }
      pushUndo()
      current.name = text
      return
    }
    try {
      await ElMessageBox.confirm(`属性词典里没有「${text}」。是否创建新的属性？`, '创建属性')
      if (!validContext(context)) return
    } catch {
      return
    }
    if (!validContext(context, node.id)) return
    pushUndo()
    const created = ensureParam(text)
    if (!created) return
    pushUndo()
    if (!linkAttribute(node, created.id)) return
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
  if (!canEditStructure.value) return
  if (viewing.value) return
  addSourceId = payload.id
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
  if (!canEditStructure.value) return
  const context = editContext()
  const hasChildren = nodes.value.some((item) => item.parentId === id)
  if (hasChildren) {
    try {
      await ElMessageBox.confirm('是否删除当前节点以及所有子节点？', '删除节点')
      if (!validContext(context)) return
    } catch {
      return
    }
  }
  if (!validContext(context, id)) return
  const ids = outlineIds()
  const index = ids.indexOf(id)
  const neighbor = ids[index - 1] || rootId
  selected.value = id
  pushUndo()
  const message = current.value ? store.removeSpecNode(current.value.id) : '请选择节点'
  if (message) {
    cancelUndo()
    ElMessage.warning(message)
    return
  }
  reflowTree()
  cueOutline(neighbor)
}
function promoteOutline(id: string) {
  if (!canEditStructure.value) return
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
  if (!canEditStructure.value) return
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
  if (!canEditStructure.value) return
  nodeDraft.value = { type: 'ATTRIBUTE', name: '' }
  nodeDraftOpen.value = true
}
async function confirmNodeDraft(event?: Event) {
  if (event instanceof KeyboardEvent && event.isComposing) return
  event?.preventDefault()
  if (!validDialog('node', dialogContexts.get('node')?.nodeId)) return
  if (!canEditStructure.value) return
  const context = editContext()
  const name = nodeDraft.value.name.trim()
  const nodeType = nodeDraft.value.type
  if (!name) {
    ElMessage.warning('请填写名称')
    return
  }
  const sourceId = dialogContexts.get('node')?.nodeId
  const source = nodes.value.find(item => item.id === sourceId)
  let parentId: string | null = null
  if (nodeType === 'VALUE') {
    const parent = source?.nodeType === 'ATTRIBUTE' ? source : nodes.value.find((item) => item.id === source?.parentId && item.nodeType === 'ATTRIBUTE')
    if (!parent) {
      ElMessage.warning('属性值只能挂在属性下面')
      return
    }
    parentId = parent.id
  } else if (source?.nodeType === 'VALUE' || source?.nodeType === 'ATTRIBUTE') {
    parentId = source.id
  }
  if (nodeType === 'ATTRIBUTE' && !store.data.params.some((item) => item.name === name)) {
    try {
      await ElMessageBox.confirm(`属性词典里没有「${name}」。是否创建并绑定到当前模型？`, '创建属性')
      if (!validContext(context)) return
    } catch {
      return
    }
  }
  if (!validContext(context, source?.id)) return
  pushUndo()
  let valueText = name
  if (nodeType === 'VALUE') {
    const ownerId = nodes.value.find((row) => row.id === parentId)?.attributeId || ''
    if (!ownerId) {
      ElMessage.warning('请先为上一级选择属性')
      return
    }
    const duplicated = nodes.value.some((item) => item.parentId === parentId && item.nodeType === 'VALUE' && item.valueId === name)
    if (duplicated) {
      ElMessage.warning('同一个属性下已有这个取值')
      return
    }
    const created = createDictionaryValue(store.data, ownerId, name)
    if (!created.ok || !created.value) {
      ElMessage.warning(created.message)
      return
    }
    valueText = created.value
    if (created.created) ElMessage.success(`${created.message} 模型不会因此发布。`)
  }
  const attributeId = nodeType === 'VALUE'
    ? nodes.value.find((item) => item.id === parentId)?.attributeId || ''
    : ensureParam(name)?.id || ''
  if (!attributeId) return
  pushUndo()
  const id = uid('sn')
  const bound = store.data.templateParams.find((item) => item.templateId === templateId.value && item.paramId === attributeId)
  store.data.productSpecNodes.push({
    id,
    templateId: templateId.value,
    parentId,
    nodeType: nodeType,
    attributeId,
    valueId: nodeType === 'VALUE' ? valueText : '',
    role: nodeType === 'ATTRIBUTE' ? (bound?.role === 'common' ? 'COMMON' : 'VARIANT') : undefined,
    sort: nextSort(parentId),
    positionX: 0,
    positionY: 0,
  })
  if (source) source.expanded = true
  reflowTree()
  nodeDraftOpen.value = false
  cueOutline(id)
}
function moveOutline(payload: { id: string; targetId: string; place: 'before' | 'after' | 'inside' }) {
  if (!canEditStructure.value) return
  const node = nodes.value.find((item) => item.id === payload.id)
  if (!node || viewing.value) return
  pushUndo()
  if (payload.place === 'inside') {
    const message = reparent(node, payload.targetId)
    if (message) {
      cancelUndo()
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
    cancelUndo()
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
  if (!canEditStructure.value) return
  const value = (event.target as HTMLSelectElement).value
  const node = nodes.value.find((item) => item.id === id)
  if (!node || !value) return
  if (value === '__create__') {
    editingId.value = ''
    if (kind === 'attribute' && node.nodeType === 'ATTRIBUTE') {
      openBindAttribute(id)
      creatingAttr.value = true
      return
    }
    if (kind === 'value' && node.nodeType === 'VALUE') {
      valueBindNodeId.value = id
      valueParentId.value = node.parentId || ''
      valueBindPick.value = node.valueId
      valueQuery.value = ''
      creatingValue.value = true
      newDictValue.value = ''
      valueOpen.value = true
    }
    return
  }
  if (kind === 'attribute' && node.nodeType === 'ATTRIBUTE') {
    if (node.attributeId !== value) {
      pushUndo()
      if (!linkAttribute(node, value)) return
    }
  }
  if (kind === 'value' && node.nodeType === 'VALUE' && node.valueId !== value) {
    pushUndo()
    const result = rebindSpecNode(store.data, node.id, { valueId: value })
    if (!result.ok || !result.changed) cancelUndo()
    if (!result.ok) ElMessage.warning(result.message)
  }
  editingId.value = ''
  reflowTree()
}
function openNodeMenu(payload: { id: string; x: number; y: number }) {
  if (!canEditStructure.value) return
  if (viewing.value) return
  selected.value = payload.id
  revealAncestors(payload.id)
  menu.value = { open: true, x: payload.x, y: payload.y }
}
function onNodeMenu(payload: { event: { preventDefault: () => void; clientX?: number; clientY?: number }; node: { id: string } }) {
  payload.event.preventDefault()
  openNodeMenu({ id: payload.node.id, x: payload.event.clientX || 0, y: payload.event.clientY || 0 })
}
function runMenu(action: 'add-attribute' | 'add-child' | 'add-value' | 'sibling' | 'rename' | 'delete' | 'bind' | 'naming' | 'hosts') {
  if (!canEditStructure.value) return
  menu.value.open = false
  const id = selected.value || rootId
  if (action === 'hosts') {
    openHostConfig()
    return
  }
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
    if (id === rootId) return
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
let dragStart: { context: ReturnType<typeof editContext>; id: string; before: EditorSnapshot } | undefined
function onNodeDragStart(event: { node: { id: string } }) {
  dragStart = undefined
  if (!canEditStructure.value || event.node.id === rootId) return
  finishUndo()
  dragStart = { context: editContext(), id: event.node.id, before: captureEditor(store.data, templateId.value) }
}
function onNodeDragStop(event: { node: { id: string; position: { x: number; y: number } } }) {
  const start = dragStart
  dragStart = undefined
  if (!start || start.id !== event.node.id || !validContext(start.context, start.id)) { paint(); return }
  if (!sameEditorModel(start.before, captureEditor(store.data, templateId.value))) {
    ElMessage.warning('拖动期间模型已变化，请重新操作。')
    paint()
    return
  }
  const row = nodes.value.find(item => item.id === start.id)!
  const hit = hitNode(event.node.position.x + 36, event.node.position.y + 16, row.id)
  if (!hit) {
    if (manualHold()) {
      row.positionX = event.node.position.x
      row.positionY = event.node.position.y
    } else paint()
    return
  }
  if ((row.parentId || rootId) === hit) { paint(); return }
  // reparent validates before touching this detached candidate.
  const candidate = { ...row }
  const message = reparent(candidate, hit)
  if (message) { ElMessage.warning(message); paint(); return }
  candidate.sort = nextSort(candidate.parentId)
  Object.assign(row, candidate)
  if (manualHold()) {
    row.positionX = event.node.position.x
    row.positionY = event.node.position.y
  } else reflowTree()
  const after = captureEditor(store.data, templateId.value)
  // A drag never owns dictionary edits that happened independently during the gesture.
  const entry = editorEntry(start.context.modelId, start.context.session, { ...start.before, params: after.params }, after)
  if (entry) undoStack.value.push(entry)
  if (undoStack.value.length > 40) undoStack.value.shift()
  ElMessage.success('已调整层级')
}
function hitNode(x: number, y: number, selfId: string) {
  const root = flowNodes.value.find((item) => item.id === rootId)
  if (root && x >= root.position.x && x <= root.position.x + 188 && y >= root.position.y && y <= root.position.y + 48) return rootId
  const target = flowNodes.value.find((item) => {
    if (item.id === selfId || item.id === rootId) return false
    const width = item.type === 'attribute' ? 160 : item.type === 'value' ? 120 : 140
    const height = item.type === 'attribute' ? 48 : 32
    return x >= item.position.x && x <= item.position.x + width && y >= item.position.y && y <= item.position.y + height
  })
  return target?.id || ''
}
function reparent(node: ProductSpecNode, targetId: string) {
  if (!canEditStructure.value) return '当前视图只读'
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
  if (node.nodeType === 'VALUE' && !store.data.params.find(p => p.id === target.attributeId)?.values.includes(node.valueId)) return '目标属性没有这个取值'
  node.parentId = target.id
  if (node.nodeType === 'VALUE') node.attributeId = target.attributeId
  return ''
}
function onViewportMove(event: { flowTransform: { x: number; y: number; zoom: number } }) {
  zoomRatio.value = event.flowTransform.zoom
}
function onMoveEnd(event: { flowTransform: { x: number; y: number; zoom: number } }) {
  zoomRatio.value = event.flowTransform.zoom
  if (!canEditStructure.value) return
  const row = ensureCanvas()
  row.panX = event.flowTransform.x
  row.panY = event.flowTransform.y
  row.zoom = event.flowTransform.zoom
}
function tidy() {
  if (!canEditStructure.value) return
  const row = ensureCanvas()
  row.layoutLocked = false
  row.direction = 'logic'
  arrangeSpecPositions(nodes.value, nodeTitle, layoutOriginX())
  ElMessage.success('已按产品结构整理')
}
function useManualLayout() {
  if (!canEditStructure.value) return
  const row = ensureCanvas()
  row.direction = 'custom'
  row.layoutLocked = true
  ElMessage.success('已改为手工摆放。新增节点不会挪动现有位置，需要分区时再点自动布局。')
}
const anyCollapsed = computed(() => {
  const branches = nodes.value.filter((item) => nodes.value.some((child) => child.parentId === item.id))
  return branches.some((item) => !nodeOpen(item))
})
function setExpanded(expanded: boolean) {
  if (!canEditStructure.value) {
    viewClosed.value = expanded ? [] : nodes.value.filter((item) => childCount(item.id)).map((item) => item.id)
    return
  }
  nodes.value.forEach((item) => {
    if (childCount(item.id)) item.expanded = expanded
  })
  reflowTree()
}
function toggleExpand(id: string) {
  if (!childCount(id)) return
  if (!canEditStructure.value) {
    viewClosed.value = viewClosed.value.includes(id) ? viewClosed.value.filter((item) => item !== id) : [...viewClosed.value, id]
    return
  }
  const row = store.data.productSpecNodes.find((item) => item.id === id)
  if (!row) return
  row.expanded = row.expanded === false
  reflowTree()
}
function queryText(value: unknown) {
  return typeof value === 'string' ? value : ''
}
function sessionValue(key: string) {
  try { return sessionStorage.getItem(key) || '' } catch { return '' }
}
function carriedOverview() {
  const root = queryText(route.query.root) || sessionValue(OVERVIEW_ROOT_KEY)
  const carried: Record<string, string> = { view: overviewView.value }
  if (root) carried.root = root
  return carried
}
function setOverviewView(view: 'list' | 'graph') {
  const query: Record<string, string | string[] | undefined> = { ...route.query, view }
  if (view === 'graph' && !queryText(query.root)) query.root = graphRootId(store.data, overviewCategoryId.value) || defaultOverviewCategoryId(store.data)
  try {
    sessionStorage.setItem(OVERVIEW_VIEW_KEY, view)
    if (queryText(query.root)) sessionStorage.setItem(OVERVIEW_ROOT_KEY, queryText(query.root))
  } catch { /* 偏好写不进去时仍切换当前画面 */ }
  router.replace({ path: '/specs', query })
}
function setOverviewRoot(rootId: string) {
  if (!rootId) return
  try { sessionStorage.setItem(OVERVIEW_ROOT_KEY, rootId) } catch { /* 偏好写不进去时仍保留当前起点 */ }
  if (queryText(route.query.root) === rootId) return
  router.replace({ path: '/specs', query: { ...route.query, panel: 'overview', root: rootId } })
}
function restoreOverviewMemory() {
  if (route.query.panel !== 'overview') return
  if (route.query.view === 'graph' || route.query.view === 'list') return
  const saved = sessionValue(OVERVIEW_VIEW_KEY)
  const view = saved === 'list' ? 'list' : 'graph'
  const root = queryText(route.query.root) || sessionValue(OVERVIEW_ROOT_KEY) || graphRootId(store.data, overviewCategoryId.value) || defaultOverviewCategoryId(store.data)
  router.replace({ path: '/specs', query: { ...route.query, view, root } })
}
function setSurface(next: string | number | boolean) {
  if (next === 'overview') {
    router.push({
      path: '/specs',
      query: {
        panel: 'overview',
        category: leafId.value || overviewCategoryId.value,
        type: activeTypeId.value || overviewTypeId.value,
        focus: templateId.value || overviewFocusId.value,
        q: overviewKeyword.value,
        ...carriedOverview(),
      },
    })
    return
  }
  const focus = overviewFocusId.value || templateId.value
  router.push({
    path: '/specs',
    query: focus
      ? { template: focus, mode: 'view', from: 'overview', category: overviewCategoryId.value, type: overviewTypeId.value, q: overviewKeyword.value, ...carriedOverview() }
      : {},
  })
}
function openFromOverview(payload: { templateId: string; categoryId: string; typeId: string; keyword: string }) {
  router.push({
    path: '/specs',
    query: {
      template: payload.templateId,
      mode: 'view',
      from: 'overview',
      category: payload.categoryId,
      type: payload.typeId,
      q: payload.keyword,
      ...carriedOverview(),
    },
  })
}
function backToOverview() {
  router.push({
    path: '/specs',
    query: {
      panel: 'overview',
      category: queryText(route.query.category) || leafId.value,
      type: queryText(route.query.type) || activeTypeId.value,
      q: queryText(route.query.q),
      focus: templateId.value,
      ...carriedOverview(),
    },
  })
}
function enterEdit() {
  const next = { ...route.query }
  delete next.mode
  router.replace({ path: '/specs', query: next })
}
async function saveModel() {
  if (modelSaving.value || publishing.value || copying.value) return
  const problems = illegalStructure()
  if (problems.length) {
    ElMessage.warning(problems[0])
    return
  }
  markWorkingDraft()
  ensureCanvas()
  const context = editContext()
  modelSaving.value = true
  try {
  const result = (await store.saveModelDraft(context.modelId, () => context.modelId === templateId.value && context.session === editSession))
  if (context.modelId !== templateId.value || context.session !== editSession) return
  if (!result.ok) { ElMessage.error(result.message || '保存失败，画布草稿已保留。'); return }
  const published = store.data.specModelVersions.some((item) => item.templateId === templateId.value && item.status === 'published')
  ElMessage.success(published ? '已保存草稿，尚未发布。新商品仍使用最近一次发布的版本。' : '已保存草稿，尚未发布。')
  } finally { modelSaving.value = false }
}
const publishing = ref(false)
async function publish() {
  if (publishing.value || modelSaving.value || copying.value) return
  publishing.value = true
  try {
    const result = (await store.publishSpecModel(templateId.value))
    if (result.ok) ElMessage.success(result.message)
    else ElMessage.warning(result.message)
  } finally {
    publishing.value = false
  }
}
function markWorkingDraft() {
  const row = ensureCanvas()
  if (row.status === 'offline') return
  const latest = store.data.specModelVersions
    .filter((item) => item.templateId === templateId.value && item.status === 'published')
    .slice()
    .sort((a, b) => a.version - b.version)
    .at(-1)
  if (latest && sameSpecSnapshot(latest.nodesSnapshot, nodes.value) && !compatibilityUnpublished.value) {
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
  if (!canEditStructure.value) return
  attributeOpen.value = false
  if (viewing.value) return
  attributeBindId.value = ''
  attachParent.value = parentId
  attributeIds.value = []
  attributePick.value = ''
  creatingAttr.value = false
  newAttrName.value = ''
  attributeTitle.value = nodes.value.find(n => n.id === parentId)?.nodeType === 'VALUE' ? '添加条件属性' : parentId ? '添加子属性' : '添加属性'
  attributeOpen.value = true
}
function resetAttrComposer() {
  creatingAttr.value = false
  newAttrName.value = ''
  attrQuery.value = ''
  globalRenameOpen.value = false
  globalName.value = ''
}
function openGlobalRename() {
  if (!canEditStructure.value) return
  globalName.value = boundParam.value?.name || ''
  globalRenameOpen.value = true
}
async function saveGlobalName() {
  if (!validDialog('attribute', attributeBindId.value || undefined)) return
  if (!canEditStructure.value) return
  const context = editContext()
  if (viewing.value || dictBusy.value || !boundParam.value) return
  const target = boundParam.value
  const name = globalName.value.trim()
  const original = JSON.stringify(target)
  const decision = attributeRenameDecision(store.data, boundParam.value.id, globalName.value)
  if (!decision.ok) {
    ElMessage.warning(decision.message)
    return
  }
  if (decision.needsConfirm) {
    try {
      await ElMessageBox.confirm(decision.message, '编辑全局词典')
      if (!validContext(context)) return
    } catch {
      return
    }
  }
  dictBusy.value = true
  if (!target || !validContext(context) || !store.data.params.includes(target) || JSON.stringify(target) !== original || !validDialog('attribute', attributeBindId.value || undefined)) { dictBusy.value = false; return }
  pushUndo()
  target.name = name
  dictBusy.value = false
  globalRenameOpen.value = false
  ElMessage.success('已修改全局属性名称。节点引用和已发布快照没有改写。')
}
function openValuePicker(attributeNodeId: string) {
  if (!canEditStructure.value) return
  valueOpen.value = false
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
  valueBindNodeId.value = ''
  valuePicks.value = []
  valueQuery.value = ''
  creatingValue.value = false
  newDictValue.value = ''
  selected.value = node.id
  valueOpen.value = true
}
function openBindAttribute(id: string) {
  if (!canEditStructure.value) return
  attributeOpen.value = false
  if (viewing.value || !id || id === rootId) return
  const node = nodes.value.find((item) => item.id === id && item.nodeType === 'ATTRIBUTE')
  if (!node) return
  attributeBindId.value = id
  attributePick.value = attributeChoices.value.some((item) => item.id === node.attributeId) ? node.attributeId : ''
  attributeTitle.value = '选择已有属性引用'
  selected.value = id
  attributeOpen.value = true
}
function nextSort(parentId: string | null) {
  return nodes.value.filter((item) => item.parentId === parentId).reduce((max, item) => Math.max(max, item.sort), 0) + 1
}
function insertAttributeNodes(paramIds: string[]) {
  if (!canEditStructure.value) return
  const parentId = attachParent.value
  const parent = nodes.value.find((item) => item.id === parentId)
  if (parent && parent.expanded === false) parent.expanded = true
  const siblings = nodes.value.filter((item) => item.parentId === parentId)
  const baseX = parent ? (parent.positionX ?? SPEC_TREE_ORIGIN_X) + specTreeAdvance(parent.nodeType, nodeTitle(parent)) : SPEC_TREE_ORIGIN_X
  let cursorY = siblings.length ? Math.max(...siblings.map((item) => item.positionY ?? 12)) + 54 : (parent?.positionY ?? 12)
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
    cursorY += 54
    lastId = id
  })
  reflowTree()
  selected.value = lastId
  attributeOpen.value = false
  attributeBindId.value = ''
  revealNode(lastId)
}
function createDictionaryAttribute(event?: Event) {
  if (event instanceof KeyboardEvent && event.isComposing) return
  event?.preventDefault()
  if (!validDialog('attribute', attributeBindId.value || attachParent.value || undefined)) return
  if (!canEditStructure.value) return
  if (viewing.value || dictBusy.value) return
  pushUndo()
  dictBusy.value = true
  const result = createDictionaryParam(store.data, newAttrName.value, () => uid('p'))
  if (!result.ok || !result.id) {
    dictBusy.value = false
    ElMessage.warning(result.message)
    return
  }
  attachParam(result.id)
  if (attributeBindId.value) {
    const node = nodes.value.find((item) => item.id === attributeBindId.value && item.nodeType === 'ATTRIBUTE')
    if (!node) {
      cancelUndo()
      dictBusy.value = false
      ElMessage.warning('请选择属性节点')
      return
    }
    pushUndo()
    const rebound = rebindSpecNode(store.data, node.id, { attributeId: result.id })
    if (!rebound.ok) {
      cancelUndo()
      dictBusy.value = false
      ElMessage.warning(rebound.message)
      return
    }
    if (!linkAttribute(node, result.id)) return
    attributeOpen.value = false
    attributeBindId.value = ''
  } else {
    pushUndo()
    insertAttributeNodes([result.id])
  }
  creatingAttr.value = false
  newAttrName.value = ''
  dictBusy.value = false
  ElMessage.success(`${result.message} 当前节点已引用。模型不会因此发布。`)
}
function createDictionaryValueForNode(event?: Event) {
  if (event instanceof KeyboardEvent && event.isComposing) return
  event?.preventDefault()
  if (!validDialog('value', valueParentId.value)) return
  if (!canEditStructure.value) return
  if (viewing.value || dictBusy.value) return
  const parent = nodes.value.find((item) => item.id === valueParentId.value && item.nodeType === 'ATTRIBUTE')
  if (!parent?.attributeId) {
    ElMessage.warning('请先为上一级选择属性')
    return
  }
  pushUndo()
  dictBusy.value = true
  const result = createDictionaryValue(store.data, parent.attributeId, newDictValue.value || valueQuery.value)
  if (!result.ok || !result.value) {
    dictBusy.value = false
    ElMessage.warning(result.message)
    return
  }
  if (valueBindNodeId.value) {
    pushUndo()
    const rebound = rebindSpecNode(store.data, valueBindNodeId.value, { valueId: result.value })
    if (!rebound.ok) {
      cancelUndo()
      dictBusy.value = false
      ElMessage.warning(rebound.message)
      return
    }
  } else if (!nodes.value.some((item) => item.parentId === parent.id && item.nodeType === 'VALUE' && item.valueId === result.value)) {
    valuePicks.value = [result.value]
    addValues()
  }
  creatingValue.value = false
  newDictValue.value = ''
  valueOpen.value = false
  dictBusy.value = false
  ElMessage.success(`${result.message} 当前节点已引用。模型不会因此发布。`)
}
function rebindPickedValue() {
  if (!validDialog('value', valueBindNodeId.value)) return
  if (!canEditStructure.value) return
  if (viewing.value || !valueBindNodeId.value || !valueBindPick.value) return
  pushUndo()
  const result = rebindSpecNode(store.data, valueBindNodeId.value, { valueId: valueBindPick.value })
  if (!result.ok) {
    cancelUndo()
    ElMessage.warning(result.message)
    return
  }
  valueOpen.value = false
  if (result.changed) ElMessage.success('已更换当前节点的取值引用，原词典没有修改。')
}
function addAttribute() {
  if (!validDialog('attribute', attributeBindId.value || attachParent.value || undefined)) return
  if (!canEditStructure.value) return
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
    if (!linkAttribute(node, paramId)) return
    attributeOpen.value = false
    attributeBindId.value = ''
    return
  }
  const ids = [...new Set(attributeIds.value.filter(Boolean))]
  if (!ids.length || ids.some(id => !store.data.params.some(p => p.id === id))) {
    ElMessage.warning('请选择仍存在的属性词典项')
    return
  }
  pushUndo()
  insertAttributeNodes(ids)
}
function addValues() {
  if (!validDialog('value', valueParentId.value)) return
  if (!canEditStructure.value) return
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
  })
  reflowTree()
  selected.value = parent.id
  valueOpen.value = false
  revealNode(parent.id)
}
function descendantIds(id: string): string[] {
  const children = nodes.value.filter((item) => item.parentId === id)
  return children.flatMap((item) => [item.id, ...descendantIds(item.id)])
}
function remove() {
  if (!canEditStructure.value || !current.value) return
  void removeOutline(current.value.id)
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
async function confirmCopy(event?: Event) {
  if (event instanceof KeyboardEvent && event.isComposing) return
  event?.preventDefault()
  if (copying.value || modelSaving.value || publishing.value) return
  const context = editContext()
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
  copying.value = true
  try {
  const result = (await store.copyProductModel(sourceId, { name, productTypeId, direction: 'logic' }))
  if (!sameContext(context)) return
  if (!result.ok || !('templateId' in result)) {
    ElMessage.warning(result.message || '复制失败，原模型和输入均已保留。')
    return
  }
  copyOpen.value = false
  activeTypeId.value = productTypeId
  openModel(result.templateId)
  ElMessage.success('已复制为新模型，可以继续编辑。')
  } finally { copying.value = false }
}
function pickNode(id: string) {
  selected.value = id
  revealAncestors(id)
}
function focusBoard(event: PointerEvent) {
  const board = event.currentTarget as HTMLElement
  const target = event.target as HTMLElement | null
  if (target?.closest('input, textarea, select, button, a, label, .el-segmented, .el-select, [contenteditable]')) return
  board.focus({ preventScroll: true })
}
function openMaterialDetail(item: { familyId: string; skuId: string }) {
  if (!item.familyId) return
  router.push(`/products/${item.familyId}?sku=${item.skuId}`)
}
function visibleSelectableIds() {
  return visibleComboRows.value.map((row) => row.planningId).filter(Boolean)
}
function selectAllCombos() {
  const ids = visibleSelectableIds()
  if (!ids.length) {
    ElMessage.warning('没有可选择的组合。发布模型后才能勾选。')
    return
  }
  comboSelection.selectAll(ids)
}
function invertComboSelection() {
  const visible = visibleSelectableIds()
  if (!visible.length) {
    ElMessage.warning('没有可选择的组合。发布模型后才能勾选。')
    return
  }
  comboSelection.invert(visible)
}
function openComboMaterial(row: { key: string }, mode: MaterialLaunchMode) {
  materialLaunch.value = { token: materialLaunch.value.token + 1, key: row.key, mode }
}
async function batchCreateMaterials() {
  if (!checkedIds.value.length) {
    ElMessage.warning('请先选择组合')
    return
  }
  const context = canvasContext.value
  if (!context.productTypeId) {
    ElMessage.warning('当前模型还没有产品类型，不能创建物料。')
    return
  }
  const picked = new Set(checkedIds.value)
  const rows = comboRows.value.filter((row) => row.planningId && picked.has(row.planningId))
  let created = 0
  let skipped = 0
  const failed: string[] = []
  for (const row of rows) {
    if (store.data.skus.some((item) => item.planningId === row.planningId)) {
      skipped += 1
      continue
    }
    const result = (await store.createMaterial({
      productModelId: templateId.value,
      modelVersionId: row.modelVersionId,
      planningId: row.planningId,
      requestId: uid('req'),
      categoryId: context.categoryId,
      productTypeId: context.productTypeId,
    }))
    if (!result.ok) failed.push(`${row.label}：${result.message}`)
    else if (result.created) created += 1
    else skipped += 1
  }
  if (failed.length && !created) {
    ElMessage.warning(failed.length === 1 ? failed[0] : `${failed.length} 条没有创建。${failed[0]}`)
    return
  }
  if (!created) {
    ElMessage.info(skipped ? `所选组合里 ${skipped} 条已经有物料，没有重复创建。` : '没有可创建的组合。')
    return
  }
  const extra = failed.length ? `，${failed.length} 条需要单条创建` : ''
  const skipText = skipped ? `，跳过已有物料 ${skipped} 条` : ''
  ElMessage.success(`已创建 ${created} 条物料${skipText}${extra}`)
}
async function markGrade(grade: ProductGrade) {
  if (!checkedIds.value.length) {
    ElMessage.warning('请先选择组合')
    return
  }
  const count = store.markPlanningGrades(checkedIds.value, grade)
  const saved = await store.flushPersistence()
  if (!saved.ok) { ElMessage.error(store.persistenceState.message || '规划标记尚未保存，当前选择已保留。'); return }
  clearComboSelection()
  ElMessage.success(`已标记 ${count} 条规划，没有新建物料。`)
}
function openTemporary(familyId: string, skuId: string) {
  temporaryOpen.value = false
  router.push(`/products/${familyId}?sku=${skuId}`)
}
function visibleOverlay(selector: string) {
  return [...document.querySelectorAll(selector)].some((el) => {
    const overlay = (el.closest('.el-overlay') || el) as HTMLElement
    return getComputedStyle(overlay).display !== 'none' && getComputedStyle(overlay).visibility !== 'hidden'
  })
}
function shortcutBlocked() {
  if (modelSaving.value || copying.value || publishing.value) return true
  if (attributeOpen.value || valueOpen.value || copyOpen.value || nodeDraftOpen.value || editingId.value || namingOpen.value || temporaryOpen.value || templateCompatibilityOpen.value || comboManageOpen.value) return true
  if (document.querySelector('.v3-material-dialog')) return true
  return visibleOverlay('.el-overlay-dialog, .el-message-box')
}
function isTypingTarget(target: EventTarget | null) {
  const node = target as HTMLElement | null
  if (!node?.closest) return false
  const tag = node.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || node.isContentEditable) return true
  return Boolean(node.closest('.node-add-panel, .el-dialog, .el-message-box, .el-popper, .el-select, .context-menu, #nav-flyout, .category-tree-select, .category-tree-select-panel'))
}
function onKey(event: KeyboardEvent) {
  if (viewing.value || event.isComposing) return
  if (isTypingTarget(event.target) || shortcutBlocked()) return
  const target = event.target as HTMLElement | null
  if (!target?.closest?.('.board')) return
  const key = event.key.toLowerCase()
  if ((event.ctrlKey || event.metaKey) && key === 's') {
    event.preventDefault()
    saveModel()
    return
  }
  if (!canEditStructure.value) return
  if ((event.ctrlKey || event.metaKey) && key === 'z' && !event.shiftKey) {
    if (!undoStack.value.length) return
    event.preventDefault()
    undoOutline()
    return
  }
  if (editorMode.value === 'outline' || editorMode.value === 'document') return
  if (event.key === 'Escape') {
    dragStart = undefined
    paint()
    closeFloating()
    editingId.value = ''
    return
  }
  if ((event.ctrlKey || event.metaKey) && key === 'a') {
    event.preventDefault()
    setExpanded(true)
    return
  }
  if (key === 'v' && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.repeat) {
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
  if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && current.value) {
    event.preventDefault()
    shiftOutline({ id: current.value.id, direction: event.key === 'ArrowUp' ? -1 : 1 })
    return
  }
  if ((event.key === 'Delete' || event.key === 'Backspace') && current.value) {
    event.preventDefault()
    remove()
  }
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  document.addEventListener('keydown', onDictEsc, true)
  restoreOverviewMemory()
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.removeEventListener('keydown', onDictEsc, true)
})
</script>

<style scoped>
.work-main.with-materials { overflow-y: auto; }
.work-main.with-materials .board { flex: 1 0 240px; }
.structure-material-toggle { padding: 4px 12px; }
.model-value.is-material-combo, .model-attr.is-material-combo { outline: 3px solid var(--el-color-success); outline-offset: 3px; }
.designer { display: flex; flex-direction: column; height: calc(100vh - 132px); min-height: 520px; color: var(--text-primary, #253044); }
.studio-switch { margin-bottom: 8px; }
.dict-global { margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--border-default, #e4e8ef); }
.dict-global p { margin: 0 0 8px; }
.workbench.is-overview { grid-template-columns: minmax(0, 1fr); }
.workbench.is-overview :deep(.cat),
.workbench.is-overview :deep(.rail) { display: none; }
.workbench { display: grid; grid-template-columns: 212px 228px minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); gap: 0; flex: 1; min-height: 0; background: var(--surface-bg, #fff); border: 1px solid var(--border-default, #e4e8ef); border-radius: 8px; overflow: hidden; }
.workbench.is-cat-fold { grid-template-columns: 44px 228px minmax(0, 1fr); }
.workbench.is-rail-fold { grid-template-columns: 212px 44px minmax(0, 1fr); }
.workbench.is-cat-fold.is-rail-fold { grid-template-columns: 44px 44px minmax(0, 1fr); }
.workbench.is-overview.is-cat-fold,
.workbench.is-overview.is-rail-fold,
.workbench.is-overview.is-cat-fold.is-rail-fold { grid-template-columns: minmax(0, 1fr); }
.studio-actions { display: flex; flex: none; gap: 8px; }
.version-name { color: #909399; font-size: 13px; font-weight: 500; }
.meta-row { display: flex; flex-wrap: wrap; gap: 4px 18px; margin: 6px 0 0; color: #303133; font-size: 12px; line-height: 1.5; }
.meta-row em { margin-right: 4px; color: #909399; font-style: normal; }
.node-ops { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-height: 32px; margin: 0 0 8px; }
.node-ops strong { margin-right: 4px; color: var(--text-primary, #253044); font-size: 13px; }
.ops-copy { display: flex; flex-direction: column; min-width: 120px; margin-right: 4px; }
.ops-copy em { color: var(--text-muted, #8b98a8); font-style: normal; font-size: 12px; line-height: 1.3; }
.ops-idle { color: #98a4b3; font-size: 12px; }
.ops-disabled { display: inline-flex; }
.key-strip { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; min-height: 28px; margin: 0 0 8px; color: var(--text-secondary, #66758b); font-size: 12px; }
.key-chip { display: inline-flex; align-items: center; gap: 4px; }
.key-chip.is-off { opacity: 0.45; }
.key-strip kbd, .key-row kbd { display: inline-block; min-width: 1.4em; padding: 0 5px; border: 1px solid var(--border-default, #e4e8ef); border-radius: 4px; background: var(--surface-bg, #fff); color: var(--text-primary, #253044); font: 11px/18px Consolas, "Cascadia Mono", monospace; text-align: center; }
.key-more { border: 0; background: none; padding: 0 2px; color: var(--accent, #409eff); font-size: 12px; line-height: 28px; cursor: pointer; }
.key-more:hover { text-decoration: underline; }
.key-lead { margin: 0 0 12px; color: var(--text-secondary, #66758b); font-size: 13px; line-height: 1.5; }
.key-group-block { margin: 0 0 16px; }
.key-group-block h3 { margin: 0 0 8px; font-size: 14px; }
.key-row { display: grid; grid-template-columns: 112px auto minmax(0, 1fr); gap: 8px; align-items: start; margin: 0 0 8px; color: var(--text-primary, #253044); font-size: 13px; }
.key-row em { color: var(--text-muted, #8b98a8); font-style: normal; font-size: 12px; line-height: 1.45; }
.key-row.is-off { opacity: 0.55; }
.studio-copy { min-width: 0; }
.title-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.studio-head h2 { margin: 0; font-size: 16px; font-weight: 650; line-height: 1.3; }
.studio-head .meta-row { display: flex; flex-wrap: wrap; gap: 4px 18px; align-items: center; margin: 6px 0 0; color: #303133; font-size: 12px; }
.meta-type { padding: 1px 8px; border-radius: 4px; background: #f4f8fc; }
.head-tools { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
.insight { margin: 0 0 8px; border: 1px solid var(--border-default, #e6edf5); border-radius: 10px; background: var(--surface-bg, #fff); color: var(--text-primary, #253044); }
.insight-summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 12px; }
.summary-stats { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; min-width: 0; font-size: 13px; }
.summary-stats strong { font-weight: 650; }
.summary-stats span { color: var(--text-secondary, #66758b); }
.combo-toggle { flex: 1; display: flex; justify-content: space-between; gap: 12px; border: 0; background: transparent; padding: 8px 12px; color: var(--text-primary, #1f3b66); font-size: 13px; cursor: pointer; }
.combo-toggle span:last-child { color: var(--text-muted, #8aa0b8); font-weight: 400; }
.temp-toggle { width: 100%; border-top: 1px solid var(--border-subtle, #f0f3f7); }
.insight ul { max-height: 132px; margin: 0; padding: 0 12px 8px; overflow: auto; list-style: none; }
.insight li { display: flex; align-items: center; gap: 6px; }
.insight li button { width: 100%; display: flex; justify-content: space-between; gap: 12px; border: 0; background: transparent; padding: 4px 0; color: var(--text-primary, #1f2a37); font-size: 13px; text-align: left; cursor: pointer; }
.insight li button.is-on { color: var(--app-accent, #1677ff); }
.insight em { color: var(--text-muted, #8aa0b8); font-style: normal; white-space: nowrap; }
.insight-empty { margin: 0; padding: 0 12px 10px; color: var(--text-muted, #98a4b3); font-size: 12px; }
.op-bar { display: flex; align-items: center; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.view-switch { --el-segmented-item-selected-bg-color: var(--el-color-primary); --el-segmented-item-selected-color: #fff; }
.work-main { min-width: 0; min-height: 0; height: 100%; display: flex; flex-direction: column; overflow: hidden; padding: 12px 14px 10px; background: var(--canvas-bg, #f4f7fb); border-left: 1px solid var(--border-subtle, #eef2f6); }
.quiet-guide { margin: 64px auto 0; max-width: 420px; color: #66788a; }
.quiet-guide h2 { margin: 0 0 8px; color: #1f3b66; font-size: 18px; }
.quiet-guide p { margin: 0; font-size: 13px; }
.key-list { margin: 4px 0 0; padding: 0; list-style: none; }
.key-list kbd { display: inline-block; margin-right: 4px; padding: 1px 5px; border: 1px solid #e1e7ef; border-radius: 4px; background: #fff; color: #607089; font: 11px/1.4 Consolas, monospace; }
.key-list li { margin: 6px 0; color: #1f2a37; font-size: 13px; }
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
.canvas { position: relative; flex: 1; width: 100%; min-width: 0; min-height: 0; border: 1px solid var(--border-default, #e4e8ef); border-radius: 12px; overflow: hidden; background: var(--canvas-bg, #f4f7fb); }
.canvas-tools { position: absolute; top: 10px; right: 12px; z-index: 5; }
.canvas :deep(.vue-flow) { width: 100%; height: 100%; background: var(--canvas-bg, #f4f7fb); }
.canvas :deep(.vue-flow__node) { padding: 0; border: 0; background: transparent; box-shadow: none; }
.canvas :deep(.vue-flow__handle) { width: 8px; height: 8px; border: 0; background: transparent; opacity: 0; }
.canvas :deep(.vue-flow__edge-path) { stroke-linecap: butt; stroke-linejoin: miter; }
.canvas :deep(.vue-flow__controls) { left: 12px; bottom: 16px; box-shadow: none; border: 1px solid #e6edf5; }
.canvas :deep(.vue-flow__minimap) { left: 12px; right: auto; bottom: 12px; border-radius: 8px; overflow: hidden; box-shadow: none; border: 1px solid var(--border-default, #e4e8ef); background: var(--surface-bg, #fff); }
.canvas :deep(.tree-bus) { fill: none; stroke: var(--connector-color, #8ea0b3); stroke-width: 1.15px; stroke-linejoin: round; stroke-linecap: round; pointer-events: none; opacity: 0.8; }
.canvas :deep(.tree-bus.is-hot) { stroke: var(--accent, #6d84c4); stroke-width: 1.7px; opacity: 1; }
.canvas :deep(.tree-bus.is-dim) { opacity: 0.32; }
.model-root, .model-attr, .model-value { position: relative; box-sizing: border-box; text-align: left; }
.model-root { height: 48px; display: flex; align-items: center; background: var(--accent, #2c4068); color: #fff; border: 0; border-radius: 12px; padding: 0 18px; font-size: 18px; font-weight: 650; }
.model-root strong { overflow: hidden; color: inherit; font-size: 18px; font-weight: 650; white-space: nowrap; text-overflow: ellipsis; }
.model-attr { height: 42px; display: flex; align-items: center; gap: 4px; background: var(--spec-attr-bg, color-mix(in srgb, #5d6eb8 16%, #fff)); border: 1px solid var(--spec-attr-border, #9aa6d4); border-radius: 6px; padding: 0 12px; cursor: pointer; }
.model-attr strong { flex: 1; min-width: 0; display: block; overflow: hidden; color: var(--spec-attr-text, var(--node-text, var(--text-primary, #253044))); font-size: 15px; font-weight: 600; line-height: 22px; white-space: nowrap; text-overflow: ellipsis; }
.model-attr.is-unbound strong { color: var(--text-muted, #909399); font-weight: 500; }
.model-attr:hover:not(.is-on) { background: var(--spec-attr-bg-hover, color-mix(in srgb, #5d6eb8 24%, #fff)); border-color: var(--spec-attr-border-hover, #7f8bc4); }
.attr-meta { margin: 0; overflow: hidden; color: #b0bcc8; font-size: 10px; line-height: 14px; white-space: nowrap; text-overflow: ellipsis; }
.pick-attr { display: inline-block; margin-top: 2px; border: 0; background: none; padding: 0; color: #409eff; font-size: 12px; line-height: 1.4; cursor: pointer; }
.dict-create { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
.dict-create .el-input { flex: 1; }
.dict-empty { margin: 0 0 8px; color: #909399; font-size: 13px; line-height: 1.45; }
.model-attr.is-head,
.model-attr.is-nested { background: var(--spec-attr-bg, color-mix(in srgb, #5d6eb8 16%, #fff)); border: 1px solid var(--spec-attr-border, #9aa6d4); border-radius: 6px; padding: 0 12px; }
.model-attr.is-head strong,
.model-attr.is-nested strong { font-size: 15px; font-weight: 600; }
.model-value { height: 34px; display: flex; align-items: center; gap: 4px; background: var(--spec-value-bg, #fff); border: 1px solid var(--spec-value-border, #c3ccd6); border-radius: 999px; padding: 0 14px; color: var(--spec-value-text, var(--text-primary, #253044)); font-size: 15px; font-weight: 400; line-height: 34px; cursor: pointer; }
.model-value:hover:not(.is-on) { background: var(--spec-value-bg-hover, #f7f9fc); border-color: var(--spec-value-border-hover, #8ea0b4); }
.model-value span { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.rule-mark { flex: none; margin-left: 4px; color: #8a5a00; font-style: normal; font-size: 10px; line-height: 1; }
.rule-mark.is-inherit { color: #607089; }
.structure-empty { position: absolute; z-index: 4; top: 52px; left: 50%; transform: translateX(-50%); padding: 12px 14px; border: 1px solid #e6edf5; border-radius: 8px; background: rgba(255, 255, 255, 0.96); }
.structure-empty p { margin: 0; color: #606266; font-size: 13px; }
.structure-start { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 8px; color: #909399; font-size: 12px; }
.path-preview { position: absolute; left: 12px; top: 12px; z-index: 5; max-width: 460px; padding: 6px 10px; color: #7d8da1; background: rgba(255, 255, 255, 0.88); border-radius: 999px; font-size: 12px; pointer-events: none; }
.path-preview i { margin: 0 6px; color: #c5d0de; font-style: normal; }
.model-attr.is-on { background: var(--spec-selected-attr-bg, color-mix(in srgb, #5d6eb8 30%, #fff)); border-color: var(--spec-node-ring, #3d6fe0); box-shadow: inset 0 0 0 1px var(--spec-node-ring, #3d6fe0); }
.model-value.is-on { background: var(--spec-selected-value-bg, #f3f6ff); border-color: var(--spec-node-ring, #3d6fe0); color: var(--spec-value-text, var(--text-primary, #253044)); box-shadow: inset 0 0 0 1px var(--spec-node-ring, #3d6fe0); }
.model-root.is-on { box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent, #8ea0b8) 55%, transparent); }
.model-attr.is-path strong { font-weight: 700; }
.model-root.is-quiet, .model-attr.is-quiet, .model-value.is-quiet { opacity: 0.72; }
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

<style>
/* 保留既有浮层全局样式的加载位置，避免改变样式覆盖顺序。 */
.el-overlay-dialog:has(.combo-manage-dialog) {
  display: flex !important;
  align-items: center;
  justify-content: center;
}
.combo-manage-dialog.el-dialog {
  width: min(82vw, 1360px) !important;
  max-width: 1360px;
  height: min(78vh, 820px);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  margin: auto;
  background: var(--el-bg-color-overlay, #fff);
  border: 1px solid var(--el-border-color, #e4e8ef);
}
.combo-manage-dialog .el-dialog__header {
  flex: none;
  margin-right: 0;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color-light, #e4e8ef);
}
.combo-manage-dialog .el-dialog__body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  color: var(--el-text-color-primary, #253044);
}
.combo-manage-dialog .el-dialog__footer {
  flex: none;
  border-top: 1px solid var(--el-border-color-light, #e4e8ef);
}
</style>

<style>
.dict-select-popper .el-select-dropdown__wrap { max-height: 180px; }
</style>
