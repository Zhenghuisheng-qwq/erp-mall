<template>
  <div class="sku-workbench" data-sku-workbench :aria-busy="workbench.pending.value">
    <PageHead title="SKU 管理" desc="按规则查看真实规格商品，将常用配置保存为本机视图。">
      <el-button @click="router.push('/spus')">SPU 管理</el-button>
      <el-button type="primary" @click="router.push({ path: '/skus/new', query: scopeId ? { spu: scopeId } : {} })" :disabled="!(store.can('product:sku:create'))">新增 SKU</el-button>
    </PageHead>
    <div v-if="scopeId" class="scope-banner" data-spu-scope>
      <div>当前查看：<strong>{{ scopeFamily?.name || '已删除的 SPU' }}</strong> 的 SKU <span class="muted">· {{ scopeId }}</span>
        <p class="muted">此范围与视图条件同时满足；保存视图时默认不包含当前范围。</p>
      </div>
      <el-button v-if="scopeFamily" link type="primary" @click="router.push(`/spus/${scopeId}`)">查看 SPU</el-button>
      <el-button @click="router.push('/skus')">查看全部 SKU</el-button>
    </div>
    <div class="panel workbench-panel" :inert="workbench.pending.value">
      <div class="view-bar list-switch" :inert="workbench.pending.value" data-mode="sku" :data-view-id="activeId" aria-label="常用视图">
        <el-popover v-model:visible="viewsOpen" trigger="click" placement="bottom-start" :width="310">
          <template #reference><el-button data-more-views><span class="view-current">{{ currentView.name }}</span> ▾</el-button></template>
          <el-input v-model="viewSearch" placeholder="搜索视图" clearable aria-label="搜索视图" />
          <div class="view-menu"><button v-for="view in searchedViews" :key="view.id" :data-saved-view="view.id" class="view-option" @click="selectView(view.id)">{{ view.name }} <span v-if="state.favorites.includes(view.id)">★</span><span v-if="state.defaultId === view.id" class="muted">默认</span></button><p v-if="!searchedViews.length" class="muted">没有同名视图</p></div>
          <el-button link type="primary" @click="viewsOpen = false; openName('新建视图')" :disabled="!(store.can('product:sku:read'))">新建视图</el-button>
        </el-popover>
        <span v-if="dirty" class="dirty-mark" data-unsaved>未保存</span>
        <span v-else class="muted">{{ activeId === SYSTEM_SKU_VIEW_ID ? '系统视图' : '已保存到本机' }}</span>
            <el-button data-fields-button @click="openDisplay('fields')">字段 {{ visibleColumns.length }}</el-button>
            <el-button data-sort-button @click="openDisplay('sort')">排序<span v-if="config.sorts.length"> {{ config.sorts.length }}</span></el-button>
            <el-popover v-model:visible="moreOpen" trigger="click" placement="bottom-end" :width="230">
              <template #reference><el-button>更多</el-button></template>
              <div class="more-menu" :inert="workbench.pending.value">
                <el-button @click="moreOpen = false; openDisplay('more')">分组与显示</el-button>
                <el-button @click="moreOpen = false; openName('新建视图')" :disabled="!(store.can('product:sku:read'))">新建视图</el-button>
                <el-button @click="result(workbench.favorite(activeId))" :disabled="!(store.can('product:sku:read'))">{{ state.favorites.includes(activeId) ? '取消收藏' : '收藏视图' }}</el-button>
                <el-button @click="result(workbench.setDefault(activeId))" :disabled="!(store.can('product:sku:read'))">设为默认视图</el-button>
                <el-button :disabled="(activeId === SYSTEM_SKU_VIEW_ID || !state.favorites.includes(activeId)) || !(store.can('product:sku:read'))" @click="result(workbench.moveFavorite(activeId, -1))">常用视图前移</el-button>
                <el-button :disabled="(activeId === SYSTEM_SKU_VIEW_ID || !state.favorites.includes(activeId)) || !(store.can('product:sku:read'))" @click="result(workbench.moveFavorite(activeId, 1))">常用视图后移</el-button>
                <el-button :disabled="(activeId === SYSTEM_SKU_VIEW_ID) || !(store.can('product:sku:read'))" @click="moreOpen = false; openName('重命名视图')">重命名</el-button>
                <el-button @click="copyView" :disabled="!(store.can('product:sku:read'))">复制视图</el-button>
                <el-button type="danger" :disabled="(activeId === SYSTEM_SKU_VIEW_ID) || !(store.can('product:sku:read'))" @click="deleteView">删除视图</el-button>
                <el-button @click="router.push('/import')">导入导出</el-button>
              </div>
            </el-popover>
        <div class="view-actions"><el-button :disabled="(!dirty && activeId !== SYSTEM_SKU_VIEW_ID) || !(store.can('product:sku:read'))" @click="saveCurrent">保存视图</el-button><el-button @click="openName('另存为')" :disabled="!(store.can('product:sku:read'))">另存为</el-button><el-button :disabled="(!dirty) || !(store.can('product:sku:read'))" @click="restoreView">恢复已保存配置</el-button></div>
      </div>
      <RuleExplanation v-if="workbench.guideFailure.value" :failure="workbench.guideFailure.value" :supported-recovery="[]" /><el-alert v-else-if="error" :title="error" type="error" show-icon :closable="false" data-save-error />
      <div class="workbench-body" :class="{ 'has-sidebar': showSidebar }" :data-category-layout="categoryLayout">
        <aside v-if="showSidebar" class="category-side" data-category-side>
          <div class="side-title"><strong>商品分类</strong><el-button link @click="categorySideClosed = true">收起分类栏</el-button></div>
          <small v-if="simpleCategory">{{ categorySelection.rule && categorySelection.rule.operator !== 'descendants' ? '当前精确匹配；重新选择包含下级分类' : '包含下级分类' }}</small>
          <CategoryFilterTree v-if="simpleCategory" :categories="store.data.categories" :selected-ids="categoryIds" @toggle="toggleCategory" @clear="clearCategory" />
          <template v-else><p class="muted">分类属于历史或组合条件。</p><el-button @click="openFilters">管理分类条件</el-button></template>
        </aside>
        <div class="table-area">
          <div class="workbench-tools">
            <el-input v-model="search" placeholder="名称、分类、属性、SKU、OA 编号" clearable data-filter="keyword" aria-label="在当前视图中搜索" />
            <el-button data-filter-count @click="openFilters">筛选<span v-if="conditionCount"> {{ conditionCount }}</span></el-button>
            <el-popover v-if="!showSidebar && !quickCategory" v-model:visible="categoryOpen" trigger="click" :width="300" placement="bottom-start" popper-class="product-category-pop" :hide-after="0">
              <template #reference><el-button data-category-trigger>商品分类{{ categoryIds.length ? ` ${categoryIds.length}` : '' }}</el-button></template>
              <small v-if="simpleCategory">{{ categorySelection.rule && categorySelection.rule.operator !== 'descendants' ? '当前精确匹配；重新选择包含下级分类' : '包含下级分类' }}</small>
              <CategoryFilterTree v-if="simpleCategory" closable :categories="store.data.categories" :selected-ids="categoryIds" @toggle="toggleCategory" @clear="clearCategory" @close="categoryOpen = false" />
              <template v-else><p>分类属于历史或组合条件，请在筛选中管理。</p><el-button @click="categoryOpen = false; filterOpen = true">管理分类条件</el-button></template>
            </el-popover>
            <el-button v-if="categorySideClosed && categoryLayout === 'sidebar' && !narrowScreen" link @click="categorySideClosed = false">展开分类栏</el-button>
            <el-select :model-value="scopeId" filterable clearable placeholder="筛选所属 SPU" data-list-spu @change="changeScope"><el-option v-for="family in store.data.families" :key="family.id" :value="family.id" :label="`${family.name} · ${family.oaProductId || family.id}`" /></el-select>
          </div>
          <SkuQuickFilters ref="quickFiltersRef" :key="`${activeId}:${scopeId}`" :data="store.data" :config="config" :apply="applyQuickConfig" :busy="workbench.pending.value" @edit="openFilters" />
          <div v-if="hasFilters || search" class="query-summary" data-active-filters>
            <el-button link @click="openFilters" aria-label="编辑条件摘要">{{ expandedSummary ? summary : summary.slice(0, 180) }}{{ !expandedSummary && summary.length > 180 ? '…' : '' }}</el-button>
            <el-button v-if="summary.length > 180" link @click="expandedSummary = !expandedSummary">{{ expandedSummary ? '折叠' : '完整条件' }}</el-button>
            <span v-if="search" class="muted">当前搜索：{{ search }}（不保存到视图）</span>
            <el-button link type="primary" @click="clearFilters">清空筛选</el-button>
            <div class="summary-tags">
              <el-tag v-for="node in config.conditions.children" :key="node.id" closable :title="nodeSummary(node.id)" @click="openFilters" @close="removeSummary(node.id)">{{ nodeSummary(node.id) }}</el-tag>
              <el-tag v-if="config.legacy && (config.legacy.keyword || config.legacy.filters.length)" closable @click="openFilters" @close="removeSummary('$legacy')">历史条件（原语义）</el-tag>
            </div>
          </div>
          <div class="result-line"><span class="muted" data-result-count>SKU {{ presentation.total }} 条</span><span v-if="config.groups.length" class="muted">组数量按全部匹配结果计算，分页按记录计算</span><span v-if="selectedIds.length">已选 {{ selectedIds.length }} 条（跨页保留）</span></div>
          <el-alert v-if="presentation.errors.length" type="error" :closable="false" show-icon title="配置失效，已暂停查询及批量操作" data-invalid-config><template #default><p v-for="item in presentation.errors" :key="item">{{ item }}</p><el-button @click="openFilters">修复筛选</el-button><el-button @click="restoreView" :disabled="!(store.can('product:sku:read'))">恢复已保存配置</el-button><el-button @click="rebuildInvalid">重建工作配置</el-button></template></el-alert>
          <p v-if="selectionNotice" class="muted" role="status">{{ selectionNotice }}</p>
          <div v-if="selectedIds.length" class="batch-actions"><el-button :disabled="(!!presentation.errors.length) || !(store.can('product:sku:update'))" @click="setSelectedStatus('on_sale')">批量在售</el-button><el-button :disabled="(!!presentation.errors.length) || !(store.can('product:sku:update'))" @click="setSelectedStatus('off_sale')">批量停售</el-button><el-button type="danger" :disabled="(!!presentation.errors.length) || !(store.can('product:sku:delete'))" @click="removeSelected">批量删除</el-button><el-button link @click="selectedIds = []">取消选择</el-button></div>
          <el-alert v-if="presentation.manualBlocked" title="手工顺序已保留。请在排序设置中清除分组和字段排序后使用。" type="info" :closable="false" />
          <p v-if="!frozenAllowed && config.columns.some(column => column.visible && column.frozen)" class="muted">当前窗口暂不冻结宽度较大的列，已保存的冻结配置仍保留。</p>
          <div v-if="manualOn" class="manual-tools"><span>手工排序：拖动行或勾选后跨页插入</span><el-button :disabled="(!pickedIds.length) || !(store.can('product:sku:read'))" @click="addStage">加入排序暂存区</el-button><el-button :disabled="!stageIds.length" @click="stageOpen = true">展开暂存 {{ stageIds.length }}</el-button></div>
          <template v-for="(group, index) in presentation.groups" :key="group.key">
            <div v-for="(label, level) in group.labels" v-show="level === 0 || !collapsed[parentKey(group.keys, level)]" :key="level" class="group-heading" :style="{ marginLeft: `${level * 18}px` }">
              <el-button v-if="index === 0 || parentKey(presentation.groups[index - 1]?.keys || [], level + 1) !== parentKey(group.keys, level + 1)" link @click="toggleGroup(group.keys, level)">{{ collapsed[parentKey(group.keys, level + 1)] ? '▸' : '▾' }} {{ label }} · {{ group.totals[level] }}</el-button>
            </div>
            <el-table v-show="!isCollapsed(group.keys)" class="sku-table" :class="config.density" :data="displayRows(group)" row-key="id" @header-dragend="onColumnWidth">
              <el-table-column width="46"><template #header><el-checkbox :model-value="allPageSelected" :indeterminate="somePageSelected && !allPageSelected" aria-label="全选本页" @change="togglePage" /></template><template #default="{ row }"><el-checkbox :model-value="selectedIds.includes(row.id)" :aria-label="`选择 SKU ${row.code}`" @change="(value: boolean | string | number) => toggleSelected(row.id, Boolean(value))" /></template></el-table-column>
              <el-table-column v-if="manualOn" width="48"><template #default="{ row }"><span draggable="true" class="drag-handle" :data-drag-id="row.id" @dragstart="onRowDrag(row.id)" @dragover.prevent @drop="onRowDrop(row.id)">☰</span><el-checkbox :data-pick-id="row.id" :model-value="pickedIds.includes(row.id)" :aria-label="`暂存排序 ${row.code}`" @change="(value: boolean | string | number) => togglePick(row.id, Boolean(value))" /></template></el-table-column>
              <el-table-column v-for="column in visibleColumns" :key="column.key" :column-key="column.key" :prop="column.key" :label="fieldLabel(column.key)" :width="column.width ?? fixedListWidth(column.key)" :min-width="column.width === undefined ? contentListWidth(column.key) : undefined" :fixed="frozenAllowed ? column.frozen || false : false" :align="fieldById.get(column.key)?.type === 'number' ? 'right' : 'left'" resizable>
                <template #default="{ row }">
                  <span v-if="column.key === 'code'" :data-sku-id="row.id">{{ row.code }}</span>
                  <SkuSummary v-else-if="column.key === 'spec'" :sku-id="row.id" :text="row.spec" :data-sku-spec="row.id" /><SkuSummary v-else-if="column.key === 'name'" :sku-id="row.id" :text="row.name" name />
                  <button v-else-if="column.key === 'family' || column.key === 'familyId'" class="linkish text-summary" @click="router.push(`/spus/${row.familyId}`)">{{ row.familyName }}</button>
                  <el-select v-else-if="column.key === 'status'" :model-value="row.status" size="small" aria-label="SKU 状态" @change="(status: Sku['status']) => store.patchSku(row.id, { status })" :disabled="!(store.can('product:sku:update'))"><el-option label="草稿" value="draft" /><el-option label="在售" value="on_sale" /><el-option label="停售" value="off_sale" /></el-select>
                  <span v-else>{{ displayCell(row.id, column.key, row) }}</span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="120"><template #default="{ row }"><div class="row-primary-actions"><el-button link type="primary" @click="router.push({ path: `/skus/${row.id}`, query: scopeId ? { spu: scopeId } : {} })">编辑</el-button><el-dropdown trigger="click"><el-button link :data-row-more="row.id" :data-benefit-more="row.id" :aria-label="`更多 SKU 操作 ${row.code}`">更多</el-button><template #dropdown><el-dropdown-menu><el-dropdown-item v-if="compatibilityRoles.get(row.id) !== 'other'" :data-open-compatibility="row.id" @click="openCompatibility(row.id)" :disabled="!(store.can('product:compatibility:read'))">{{ compatibilityRoles.get(row.id) === 'host' ? '适用配件' : '适用主机' }}</el-dropdown-item><el-dropdown-item v-if="store.can('product:benefit:create') && compatibilityRoles.get(row.id) === 'host'" :data-compose-benefit="row.id" @click="openBenefitPackage(row.id)" :disabled="!(store.can('product:benefit:create'))">组权益包</el-dropdown-item><el-dropdown-item @click="router.push(`/spus/${row.familyId}`)">查看 SPU</el-dropdown-item><el-dropdown-item @click="removeOne(row.id)" :disabled="!(store.can('product:sku:delete'))">删除</el-dropdown-item><el-dropdown-item v-if="manualOn && stageIds.length" @click="askInsert(row.id, row.name, 'before')" :disabled="!(store.can('product:sku:read'))">插到前面</el-dropdown-item><el-dropdown-item v-if="manualOn && stageIds.length" @click="askInsert(row.id, row.name, 'after')" :disabled="!(store.can('product:sku:read'))">插到后面</el-dropdown-item></el-dropdown-menu></template></el-dropdown></div></template></el-table-column>
              <template #empty><div class="empty-state" data-empty="sku"><strong>{{ emptyTitle }}</strong><p class="muted">{{ emptyDetail }}</p><el-button v-if="!scopeId" @click="router.push('/skus/new')">新增 SKU</el-button></div></template>
            </el-table>
          </template>
          <el-pagination v-model:current-page="page" :page-size="pageSize" :total="presentation.total" layout="total, prev, pager, next" @current-change="onPage" />
        </div>
      </div>
    </div>
    <SkuFilterDialog v-model="filterOpen" :data="store.data" :config="config" :view-name="currentView.name" :scope-id="scopeId" :now="now" :apply-config="applyQuickConfig" />
    <SkuDisplayDialog v-model="displayOpen" :data="store.data" :config="config" :tab="displayTab" @apply="applyConfig" />
    <AccessoryCompatibilityDrawer v-model="compatibilityOpen" :sku-id="compatibilitySkuId" @prepare-benefit-package="rememberPackageReturn" />
    <el-dialog v-model="nameOpen" :show-close="!workbench.pending.value" :close-on-press-escape="!workbench.pending.value" :title="nameAction" width="420px" :close-on-click-modal="false" @closed="nameError = ''">
      <el-input :disabled="workbench.pending.value" v-model="draftName" placeholder="视图名称" maxlength="80" @keyup.enter="submitName" />
      <el-checkbox v-if="scopeId && nameAction !== '重命名视图'" v-model="includeScope">将当前 SPU 范围保存为条件</el-checkbox>
      <p v-if="nameError" class="warn" role="alert">{{ nameError }}</p><p class="muted">视图仅保存在本机浏览器，不复制商品数据。</p>
      <template #footer><el-button :disabled="workbench.pending.value" @click="nameOpen = false">取消</el-button><el-button type="primary" :loading="workbench.pending.value" @click="submitName" :disabled="!(store.can('product:sku:read'))">{{ nameAction === '重命名视图' ? '保存名称' : '创建' }}</el-button></template>
    </el-dialog>
    <el-drawer v-model="stageOpen" title="排序暂存区" size="min(420px, 90vw)"><p>共 {{ stageIds.length }} 条，确认插入后更新工作配置。</p><ul><li v-for="item in stagedRows" :key="item.id" class="staged-row"><div :title="item.detail"><strong>{{ item.name }}</strong><span>{{ item.detail }}</span><em v-if="!item.valid">记录已删除或不再是销售 SKU</em><em v-else-if="!item.inResult">当前筛选外；调整筛选后可插入</em></div> <el-button link @click="removeStaged(item.id)">移除</el-button></li></ul><el-button @click="clearStage" :disabled="!(store.can('product:sku:read'))">清空暂存</el-button></el-drawer>
  </div>
</template>

<script setup lang="ts">
import RuleExplanation from '../components/guide/RuleExplanation.vue'
import { skuCategorySelection, updateSkuCategorySelection } from '../domain/skuCategoryFilter'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { TableColumnCtx } from 'element-plus'
import SkuSummary from '../components/product-list/SkuSummary.vue'
import { fixedListWidth, contentListWidth } from '../components/product-list/columnPresentation'
import PageHead from '../components/PageHead.vue'
import CategoryFilterTree from '../components/CategoryFilterTree.vue'
import SkuFilterDialog from '../components/product-list/sku/SkuFilterDialog.vue'
import SkuDisplayDialog from '../components/product-list/sku/SkuDisplayDialog.vue'
import AccessoryCompatibilityDrawer from '../components/compatibility/AccessoryCompatibilityDrawer.vue'
import { compatibilityRecordRole } from '../domain/deviceResolution'
import { useSkuWorkbench } from '../components/product-list/useSkuWorkbench'
import { useProductListCategoryLayout } from '../components/product-list/useProductListCategoryLayout'
import { useProductListManualOrder } from '../components/product-list/useProductListManualOrder'
import { presentTableGroups, type ProductListSkuRow } from '../components/product-list/tablePresentation'
import { isRealSku } from '../domain/catalogIdentity'
import { compatibilitySkuBlock } from '../domain/compatibility'
import { skuFields, skuFieldValue } from '../domain/skuWorkbenchFields'
import { querySkuWorkbench, describeSkuConditions, type SkuGroup } from '../domain/skuWorkbenchQuery'
import { SYSTEM_SKU_VIEW_ID, defaultSkuConfig } from '../domain/skuWorkbenchState'
import { insertManualIds, moveManualId, resolveManualOrder } from '../domain/productListManual'
import { emptyModeQuery, unfilteredIds } from '../domain/productListQuery'
import SkuQuickFilters from '../components/product-list/sku/SkuQuickFilters.vue'
import type { SkuViewConfig } from '../domain/skuWorkbenchTypes'
import type { Sku } from '../domain/types'
import { useCatalogStore } from '../stores/catalog'
import { rememberBenefitSkuReturn, takeBenefitSkuReturn, restoreBenefitSkuScroll } from '../components/benefit-package/skuReturnState'

const store = useCatalogStore(), route = useRoute(), router = useRouter()
const scopeId = computed(() => typeof route.query.spu === 'string' ? route.query.spu : '')
const scopeFamily = computed(() => store.data.families.find(item => item.id === scopeId.value))
const workbench = useSkuWorkbench(scopeId)
const { views, currentView, activeId, config, dirty, error, state } = workbench
const now = ref(new Date()), filterOpen = ref(false), displayOpen = ref(false), displayTab = ref<'fields' | 'sort' | 'more'>('fields')
const viewsOpen = ref(false), moreOpen = ref(false), viewSearch = ref(''), expandedSummary = ref(false)
const nameOpen = ref(false), nameAction = ref('新建视图'), draftName = ref(''), includeScope = ref(false), nameError = ref('')
const selectedIds = ref<string[]>([]), selectionNotice = ref(''), collapsed = reactive<Record<string, boolean>>({}), stageOpen = ref(false)
const compatibilityOpen = ref(false), compatibilitySkuId = ref('')
function openCompatibility(id: string) { compatibilitySkuId.value = id; compatibilityOpen.value = true }
const scopeSearch = ref(''), scopePage = ref(1)
const pageSettings = computed(() => store.data.productListPages?.sku)
const page = computed({ get: () => scopeId.value ? scopePage.value : pageSettings.value?.query.page || 1, set: value => { if (scopeId.value) scopePage.value = value; else if (pageSettings.value) pageSettings.value.query.page = value } })
const pageSize = computed(() => pageSettings.value?.query.pageSize || 10)
const search = computed({ get: () => scopeId.value ? scopeSearch.value : pageSettings.value?.query.keyword || '', set: value => { if (scopeId.value) scopeSearch.value = value; else if (pageSettings.value) pageSettings.value.query.keyword = value; page.value = 1 } })
watch(scopeId, () => { scopeSearch.value = ''; scopePage.value = 1 })
const presentation = computed(() => querySkuWorkbench(store.data, config.value, { scopeId: scopeId.value, search: search.value, page: page.value, pageSize: pageSize.value, now: now.value }))
const compatibilityRoles = computed(() => new Map(presentation.value.rows.map(row => [row.id, compatibilityRecordRole(store.data, row.id)])))
const fields = computed(() => skuFields(store.data))
const fieldById = computed(() => new Map(fields.value.map(field => [field.id, field])))
const visibleColumns = computed(() => config.value.columns.filter(column => column.visible))
const summary = computed(() => describeSkuConditions(store.data, config.value))
const conditionCount = computed(() => config.value.conditions.children.length + (config.value.legacy?.filters.length || 0) + (config.value.legacy?.keyword ? 1 : 0))
const hasFilters = computed(() => conditionCount.value > 0)
const searchedViews = computed(() => views.value.filter(view => view.name.toLocaleLowerCase().includes(viewSearch.value.trim().toLocaleLowerCase())))
const layoutView = computed(() => ({ id: activeId.value, categoryFilterLayout: config.value.categoryLayout }))
const { categoryOpen, categorySideClosed, narrowScreen, categoryLayout, showSidebar: layoutSidebar } = useProductListCategoryLayout(layoutView, layout => applyConfig({ ...config.value, categoryLayout: layout }))
const frozenAllowed = computed(() => !narrowScreen.value && visibleColumns.value.filter(column => column.frozen).reduce((total, column) => total + (column.width ?? fixedListWidth(column.key) ?? contentListWidth(column.key)), 0) <= 320)
const categorySelection = computed(() => skuCategorySelection(config.value))
const simpleCategory = computed(() => categorySelection.value.supported)
// The fixed category widget and an exposed simple root category rule edit the same condition.
const quickCategory = computed(() => simpleCategory.value && config.value.conditions.children.some(node => node.kind === 'rule' && node.field === 'category' && config.value.quickFilters?.some(ref => ref.source === 'condition' && ref.ruleId === node.id)))
const showSidebar = computed(() => layoutSidebar.value && !quickCategory.value)
const categoryIds = computed(() => categorySelection.value.ids)
const manualOn = computed(() => config.value.sortMode === 'manual' && !presentation.value.manualBlocked)
function manualOrder() { return resolveManualOrder(config.value.manualOrder, unfilteredIds(store.data, { ...currentView.value, mode: 'sku', skuQuery: emptyModeQuery('sku') }, 'sku')) }
async function orderResult(result: ReturnType<typeof insertManualIds>) { if (!result.ok) return result; const changed = await workbench.apply({ ...config.value, manualOrder: result.order }); return changed.ok ? { ok: true as const } : changed }
const { pickedIds, stageIds, onRowDrag, onRowDrop, togglePick, addStage, clearStage, removeStaged, askInsert, confirmStage } = useProductListManualOrder({ move: (id, target, place) => orderResult(moveManualId(manualOrder(), id, target, place)), insert: (ids, target, place) => {
  const allowed = new Set(presentation.value.allIds)
  if (!manualOn.value || [...ids,target].some(id => !allowed.has(id) || !store.data.skus.some(sku => sku.id === id && isRealSku(store.data, sku))))
    return {ok:false, message:'暂存或目标记录已删除、不是销售 SKU，或不在当前筛选范围。暂存已保留，请调整筛选或移除失效项。'}
  return orderResult(insertManualIds(manualOrder(), ids, target, place))
}, context: () => `${activeId.value}:${scopeId.value}`, hasFilters: () => hasFilters.value || !!search.value })
const stagedRows = computed(() => stageIds.value.map(id => {
  const sku = store.data.skus.find(item => item.id === id), valid = !!sku && isRealSku(store.data, sku)
  const family = store.data.families.find(item => item.id === sku?.familyId)
  return {id, valid, inResult: presentation.value.allIds.includes(id), name: valid ? sku!.skuName || family?.name || '未命名 SKU' : '失效记录',
    detail: valid ? `${sku!.code || '未编号'} · ${family?.name || '所属 SPU 不存在'} · ${family ? skuFieldValue(store.data,sku!,family,'spec').value || '' : ''}` : '请移除后重新选择'}
}))
const formattedGroups = computed(() => new Map(presentTableGroups(store.data, presentation.value.groups.map(group => ({ ...group, label: group.labels.join(' / ') }))).map(group => [group.key, group.skus])))
const pageRecords = computed(() => new Map(presentation.value.rows.map(record => [record.id, record])))
function displayRows(group: SkuGroup) { return formattedGroups.value.get(group.key) || [] }
function fieldLabel(key: string) { return fieldById.value.get(key === 'family' ? 'familyId' : key)?.label || `失效字段：${key}` }
function displayCell(id: string, key: string, row: ProductListSkuRow) {
  if (key === 'updatedAt') return row.updatedAt || '未记录'
  const record = pageRecords.value.get(id)
  if (!record) return '未记录'
  const cell = skuFieldValue(store.data, record.sku, record.family, key, config.value.attributeNames)
  if (!cell.applicable) return '不适用'
  if (cell.value === null || cell.value === '') return '未记录'
  const field = fieldById.value.get(key)
  const label = (value: string | number | boolean) => field?.options.find(option => option.value === value)?.label || String(value)
  return Array.isArray(cell.value) ? cell.value.map(label).join('、') : typeof cell.value === 'boolean' ? cell.value ? '是' : '否' : label(cell.value)
}
const realCount = computed(() => store.data.skus.filter(sku => isRealSku(store.data, sku)).length)
const emptyTitle = computed(() => presentation.value.errors.length ? '配置失效' : scopeId.value && !scopeFamily.value ? '入口不可访问' : !realCount.value ? '尚无真实 SKU' : scopeId.value && !store.data.skus.some(sku => sku.familyId === scopeId.value && isRealSku(store.data, sku)) ? '当前 SPU 暂无 SKU' : '没有符合条件的真实 SKU')
const emptyDetail = computed(() => presentation.value.errors.length ? '修复失效字段或恢复配置后继续。' : scopeId.value && !scopeFamily.value ? '该 SPU 不存在，可返回全部 SKU 查看。' : '可以调整筛选，或进入已有流程新增 SKU。')
const allPageSelected = computed(() => !!presentation.value.rows.length && presentation.value.rows.every(row => selectedIds.value.includes(row.id)))
const somePageSelected = computed(() => presentation.value.rows.some(row => selectedIds.value.includes(row.id)))
function toggleSelected(id: string, selected: boolean) { selectedIds.value = selected ? [...new Set([...selectedIds.value, id])] : selectedIds.value.filter(item => item !== id) }
function togglePage(value: boolean | string | number) { const ids = presentation.value.rows.map(row => row.id); selectedIds.value = value ? [...new Set([...selectedIds.value, ...ids])] : selectedIds.value.filter(id => !ids.includes(id)) }
watch([activeId, scopeId, () => presentation.value.allIds.join('|')], () => { if (selectedIds.value.length) selectionNotice.value = '视图、范围或结果已变化，已清理旧选择。'; selectedIds.value = [] })
watch([activeId, scopeId], () => { clearStage(); pickedIds.value = [] })
watch(() => presentation.value.page, value => { if (page.value !== value) page.value = value }, { immediate: true })
function parentKey(labels: string[], length: number) { return JSON.stringify(labels.slice(0, length)) }
function toggleGroup(labels: string[], level: number) { const key = parentKey(labels, level + 1); collapsed[key] = !collapsed[key] }
function isCollapsed(labels: string[]) { return labels.some((_, level) => collapsed[parentKey(labels, level + 1)]) }
async function result(pending: { ok: boolean; message?: string } | Promise<{ ok: boolean; message?: string }>) { const outcome = await pending; if (!outcome.ok && outcome.message) ElMessage.error(outcome.message); return outcome.ok }
const quickFiltersRef = ref<InstanceType<typeof SkuQuickFilters>>()
async function flushQuick() { return await quickFiltersRef.value?.flush() ?? true }
onBeforeRouteLeave(async () => !workbench.pending.value && await flushQuick() && await confirmStage(false))
onBeforeRouteUpdate(async to => !workbench.pending.value && await flushQuick() && (String(to.query.spu || '') === scopeId.value || await confirmStage(false)))
async function applyQuickConfig(next: SkuViewConfig) { const outcome = await workbench.apply(next); if (outcome.ok) page.value = 1; return outcome }
async function openFilters() { if (await flushQuick()) filterOpen.value = true }
async function applyConfig(next: SkuViewConfig) { if (await result(workbench.apply(next))) page.value = 1 }
async function openDisplay(tab: 'fields' | 'sort' | 'more') { if (!(await flushQuick())) return; displayTab.value = tab; displayOpen.value = true }
async function selectView(id: string) { if (!(await flushQuick()) || (id !== activeId.value && !(await confirmStage(false)))) return; if (await result(workbench.select(id))) { viewsOpen.value = false; page.value = 1 } }
async function restoreView() { if (!(await flushQuick())) return; if (await result(workbench.restore())) page.value = 1 }
async function rebuildInvalid() { try { await ElMessageBox.confirm('将当前工作配置重建为全部 SKU 的默认规则？原保存视图保留，只有再次保存才会覆盖。当前 SPU 范围仍保留。', '重建工作配置') } catch { return }; applyConfig(defaultSkuConfig()) }
function clearFilters() { search.value = ''; const next = structuredClone(JSON.parse(JSON.stringify(config.value))) as SkuViewConfig; next.conditions.children = []; if (next.legacy) { next.legacy.keyword = ''; next.legacy.filters = [] }; applyConfig(next) }
function nodeSummary(id: string) { return describeSkuConditions(store.data, { ...config.value, legacy: undefined, conditions: { ...config.value.conditions, children: config.value.conditions.children.filter(node => node.id === id) } }) }
function removeSummary(id: string) { const next = JSON.parse(JSON.stringify(config.value)) as SkuViewConfig; if (id === '$legacy' && next.legacy) { next.legacy.keyword = ''; next.legacy.filters = [] }; if (id !== '$legacy') next.conditions.children = next.conditions.children.filter(node => node.id !== id); applyConfig(next) }
function clearCategory() {
  const next = updateSkuCategorySelection(config.value, [])
  if (!next) { filterOpen.value = true; return }
  applyConfig(next)
}
function toggleCategory(id: string) {
  const ids = categoryIds.value.includes(id) ? categoryIds.value.filter(item => item !== id) : [...categoryIds.value, id]
  const next = updateSkuCategorySelection(config.value, ids)
  if (!next) { filterOpen.value = true; return }
  applyConfig(next)
}
async function changeScope(id: string) { if (!(await flushQuick())) return; router.push({ path: '/skus', query: id ? { spu: id } : {} }) }
function rememberPackageReturn(skuId: string) {
  rememberBenefitSkuReturn({ path: route.fullPath, activeId: activeId.value, scopeSearch: scopeSearch.value, scopePage: scopePage.value, selectedIds: selectedIds.value, collapsed, focusSkuId: skuId })
}
function openBenefitPackage(skuId: string) {
  rememberPackageReturn(skuId)
  void router.push({ path: '/benefit-packages/new', query: { device: skuId, returnTo: route.fullPath } })
}
function onPage(value: number) { page.value = value }
async function openName(action: string) { if (!(await flushQuick()) || (action !== '重命名视图' && !(await confirmStage(false)))) return; nameAction.value = action; draftName.value = action === '重命名视图' ? currentView.value.name : ''; includeScope.value = false; nameError.value = ''; nameOpen.value = true }
async function saveCurrent() { if (!(await flushQuick())) return; if (activeId.value === SYSTEM_SKU_VIEW_ID) { openName('另存为'); return }; result(workbench.save()) }
async function submitName() { if (workbench.pending.value) return; const outcome = await (nameAction.value === '重命名视图' ? workbench.rename(activeId.value, draftName.value) : workbench.create(draftName.value, includeScope.value)); if (!outcome.ok) { nameError.value = outcome.message; return }; nameOpen.value = false }
async function copyView() { if (!(await flushQuick()) || !(await confirmStage(false))) return; if (await result(workbench.copy(activeId.value))) moreOpen.value = false }
async function deleteView() { if (!(await confirmStage(false))) return; moreOpen.value = false; try { await ElMessageBox.confirm(`删除视图「${currentView.value.name}」？只删除视图，不删除任何商品。`, '删除视图', { type: 'warning' }) } catch { return }; result(workbench.remove(activeId.value)) }
function onColumnWidth(width: number, _old: number, column: TableColumnCtx<ProductListSkuRow>) { const next = JSON.parse(JSON.stringify(config.value)) as SkuViewConfig; const found = next.columns.find(item => item.key === column.columnKey); if (found) { found.width = Math.max(80, Math.min(600, Math.round(width))); result(workbench.apply(next)) } }
function validSelection() { return selectedIds.value.filter(id => presentation.value.allIds.includes(id) && store.data.skus.some(sku => sku.id === id && isRealSku(store.data, sku))) }
function setSelectedStatus(status: Sku['status']) { if (!presentation.value.errors.length) store.setSkuStatus(validSelection(), status) }
async function removeOne(id: string) { try { await ElMessageBox.confirm('删除这条 SKU？所属 SPU 会保留。', '删除规格') } catch { return }; const blocked = store.removeSku(id); if (blocked) ElMessage.warning(blocked) }
async function removeSelected() { if (presentation.value.errors.length) return; const ids = validSelection(); const blocked = ids.map(id => compatibilitySkuBlock(store.data, id)).find(Boolean); if (blocked) { ElMessage.warning(blocked); return }; try { await ElMessageBox.confirm(`删除选中的 ${ids.length} 条 SKU？SPU 会保留。`, '批量删除 SKU') } catch { return }; ids.forEach(id => store.removeSku(id)); selectedIds.value = [] }
let dateTimer: ReturnType<typeof setInterval> | undefined
let benefitReturnFrame: number | undefined
let benefitReturnActive = true
function updateDate() { now.value = new Date() }
onMounted(async () => {
  dateTimer = setInterval(updateDate, 60000); document.addEventListener('visibilitychange', updateDate)
  const previous = takeBenefitSkuReturn(route.fullPath)
  if (!previous) return
  if (views.value.some(view => view.id === previous.activeId)) activeId.value = previous.activeId
  scopeSearch.value = previous.scopeSearch; scopePage.value = previous.scopePage
  await nextTick()
  selectedIds.value = previous.selectedIds.filter(id => presentation.value.allIds.includes(id))
  Object.assign(collapsed, previous.collapsed)
  await nextTick()
  if (benefitReturnActive) benefitReturnFrame = requestAnimationFrame(() => restoreBenefitSkuScroll(previous))
})
onBeforeUnmount(() => { benefitReturnActive = false; if (benefitReturnFrame !== undefined) cancelAnimationFrame(benefitReturnFrame); clearInterval(dateTimer); document.removeEventListener('visibilitychange', updateDate) })
</script>

<style scoped>
.sku-table.comfortable :deep(.el-table__row .el-table__cell){height:80px;box-sizing:border-box}.sku-table.compact :deep(.el-table__row .el-table__cell){height:70px;box-sizing:border-box}

.sku-workbench,.workbench-panel{min-width:0;max-width:100%}.table-area{overflow:hidden}.row-primary-actions{display:flex;gap:12px;align-items:center;white-space:nowrap}.text-summary{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-align:left}.sku-table :deep(.cell){overflow-wrap:anywhere}.sku-table :deep(th){color:var(--el-text-color-secondary);font-weight:600}

.staged-row{display:flex;align-items:center;gap:12px;margin:12px 0}.staged-row>div{flex:1;min-width:0}.staged-row strong,.staged-row span,.staged-row em{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.staged-row span{font-size:12px;color:var(--el-text-color-secondary)}.staged-row em{color:var(--el-color-warning);font-size:12px}

.workbench-panel { padding: 0; overflow: hidden; }
.scope-banner { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; padding: 14px 18px; margin-bottom: 14px; border: 1px solid var(--el-border-color); border-radius: 8px; background: var(--el-fill-color-light); }
.scope-banner p { margin: 5px 0 0; }.scope-banner>div { flex: 1; }
.view-bar { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 16px; border-bottom: 1px solid var(--el-border-color-lighter); }
.view-tabs { display: flex; max-width: 50%; overflow-x: auto; gap: 6px; }.view-tabs .el-button { margin-left: 0; }.view-actions { display: flex; gap: 6px; margin-left: auto; }.view-actions .el-button { margin: 0; }
.default-mark { font-size: 11px; opacity: .7; margin-left: 6px; }.dirty-mark { font-size: 12px; color: var(--el-color-warning-dark-2); }
.view-menu { max-height: 300px; overflow: auto; margin: 8px 0; }.view-option { display: flex; gap: 8px; text-align: left; width: 100%; padding: 10px; border: 0; border-radius: 4px; background: none; color: var(--el-text-color-primary); cursor: pointer; }.view-option:hover,.view-option:focus-visible { background: var(--el-fill-color); }.view-option .muted { margin-left: auto; }
.workbench-body { padding: 16px; }.workbench-body.has-sidebar { display: grid; grid-template-columns: 230px minmax(0,1fr); gap: 16px; }.category-side { border-right: 1px solid var(--el-border-color-lighter); padding-right: 12px; }.side-title { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }.table-area { min-width: 0; }
.workbench-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }.workbench-tools>.el-input { width: 260px; }.workbench-tools>.el-select { width: 200px; }.workbench-tools>.el-button { margin: 0; }
.more-menu { display: grid; gap: 4px; }.more-menu .el-button { justify-content: flex-start; margin: 0; }
.query-summary { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px 0 0; }.query-summary>.el-button:first-child { white-space: normal; text-align: left; height: auto; line-height: 1.7; }
.summary-tags { display: flex; flex-wrap: wrap; gap: 6px; width: 100%; }.summary-tags .el-tag { max-width: 100%; cursor: pointer; }.summary-tags :deep(.el-tag__content) { overflow: hidden; text-overflow: ellipsis; }
.result-line,.batch-actions,.manual-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 12px 0; }.group-heading { background: var(--el-fill-color-light); }.group-heading:empty { display:none; }.sku-table { width: 100%; }.sku-table.compact :deep(.el-table__cell) { padding-top: 5px; padding-bottom: 5px; }.sku-table.comfortable :deep(.el-table__cell) { padding-top: 10px; padding-bottom: 10px; }.empty-state { padding: 24px 10px; line-height: 1.8; }.drag-handle { cursor: grab; }.el-pagination { margin-top: 16px; justify-content: flex-end; }
@media(max-width:1100px) { .view-tabs { max-width: 100%; }.view-actions { margin-left: 0; }.workbench-body.has-sidebar { grid-template-columns: 200px minmax(0,1fr); } }
@media(max-width:640px) { .view-bar,.workbench-body { padding: 12px; }.view-tabs { width: 100%; }.view-actions { flex-wrap: wrap; }.workbench-tools>.el-input { width: 100%; }.workbench-tools>.el-select { width: 100%; }.el-pagination { overflow-x: auto; justify-content: flex-start; } }
</style>
