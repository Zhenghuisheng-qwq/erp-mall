<template>
  <div>
    <PageHead :title="mode === 'spu' ? 'SPU 管理' : 'SKU 管理'" :desc="mode === 'spu' ? '维护商品主体，查看和追加其下 SKU。' : '独立管理真实规格商品；物料档案在物料管理中维护。'">
      <el-button @click="router.push(mode === 'spu' ? '/skus' : '/spus')">{{ mode === 'spu' ? 'SKU 管理' : 'SPU 管理' }}</el-button>
      <el-button v-if="mode === 'spu'" @click="router.push('/materials/new')">物料建档</el-button>
      <el-button type="primary" @click="router.push(mode === 'spu' ? '/spus/new' : { path: '/skus/new', query: scopeId ? { spu: scopeId } : {} })">{{ mode === 'spu' ? '新建 SPU' : '新增 SKU' }}</el-button>
    </PageHead>
    <div v-if="scopeId" class="panel" style="margin-bottom: 12px" data-spu-scope>
      当前查看：{{ scopeFamily?.name || '已删除的 SPU' }} 的 SKU
      <el-button v-if="scopeFamily" link type="primary" @click="router.push(`/spus/${scopeId}`)">查看 SPU</el-button>
      <el-button @click="router.push('/skus')">查看全部 SKU</el-button>
      <p class="muted">当前为临时范围，筛选和视图调整不会覆盖全部 SKU 的保存设置。</p>
    </div>
    <div class="panel" :class="{ 'is-category-side': showSidebar }" :data-category-layout="categoryLayout">
      <aside v-if="showSidebar" class="category-side" data-category-side>
        <div class="category-side-head"><strong>商品分类</strong><el-button link @click="categorySideClosed = true">收起分类栏</el-button></div>
        <template v-if="!categoryQuick.simple"><p class="muted">分类使用高级条件，请在更多筛选中管理。</p><el-button @click="filterOpen = true">管理分类条件</el-button><el-button @click="clearCategory">清除分类</el-button></template>
        <CategoryFilterTree v-else :categories="store.data.categories" :selected-ids="selectedCategoryIds" @toggle="toggleCategory" @clear="clearCategory" />
      </aside>
      <div class="list-main">
      <div class="filters">
        <el-select v-if="mode === 'sku'" :model-value="scopeId" filterable clearable placeholder="筛选所属 SPU" style="width: 220px" data-list-spu @change="(id: string) => router.push({ path: '/skus', query: id ? { spu: id } : {} })"><el-option v-for="item in store.data.families" :key="item.id" :value="item.id" :label="`${item.name} · ${item.oaProductId || item.id}`" /></el-select>
        <el-input :model-value="activeQuery.keyword" placeholder="名称、分类、属性、SKU、OA 编号" clearable style="width: 260px" data-filter="keyword" @update:model-value="onKeyword" />
        <span v-if="showSidebar" class="category-chip" data-category-chip :title="categoryButtonText">{{ categoryButtonText }}</span>
        <el-popover v-else v-model:visible="categoryOpen" :hide-after="0" trigger="click" placement="bottom-start" :width="300" popper-class="product-category-pop">
          <template #reference><el-button data-category-trigger :title="categoryButtonText">{{ categoryButtonText }}</el-button></template>
          <template v-if="!categoryQuick.simple"><p>分类使用高级条件，请在更多筛选中管理。</p><el-button @click="categoryOpen = false; filterOpen = true">管理分类条件</el-button><el-button @click="clearCategory">清除分类</el-button></template>
          <CategoryFilterTree v-else closable :categories="store.data.categories" :selected-ids="selectedCategoryIds" @toggle="toggleCategory" @clear="clearCategory" @close="categoryOpen = false" />
        </el-popover>
        <el-button v-if="categoryLayout === 'sidebar' && categorySideClosed && !narrowScreen" link @click="categorySideClosed = false; categoryOpen = false">展开分类栏</el-button>
        <template v-for="field in exposedFields" :key="field.field">
          <el-button v-if="!quickState(field).simple" :data-advanced-field="field.field" @click="filterOpen = true">{{ field.label }}：高级条件</el-button>
          <el-input v-else-if="field.kind === 'text'" :model-value="quickText(field)" clearable :placeholder="field.label" style="width: 180px" :data-exposed="field.field" @update:model-value="(value: string) => setQuickText(field, value)" />
          <el-date-picker v-else-if="field.kind === 'date'" :model-value="dateRange(field.field)" type="daterange" value-format="YYYY-MM-DD" start-placeholder="创建开始" end-placeholder="创建结束" style="width: 240px" :data-exposed="field.field" @update:model-value="(value: [string, string] | null) => setDate(value)" />
          <el-select v-else :model-value="chosen(field.field)" multiple collapse-tags clearable :placeholder="field.label" style="width: 160px" :data-exposed="field.field" @change="(value: string[]) => setExposedValue(field.field, value)">
            <el-option v-for="item in fieldOptions(field.field)" :key="item" :label="item" :value="item" />
          </el-select>
        </template>
        <el-button data-filter-count @click="filterOpen = true">更多筛选<span v-if="filterCount"> {{ filterCount }}</span></el-button>
      </div>
      <div v-if="summaries.length" class="active-filters" data-active-filters aria-label="已生效筛选">
        <span class="muted">已筛选（条件同时满足）：</span>
        <el-tag v-for="item in summaries" :key="item.id" closable :data-filter-summary="item.id" @close="removeSummary(item.id)">{{ item.label }}</el-tag>
        <el-button link type="primary" @click="clearFilters">清空筛选</el-button>
      </div>
      <div class="list-switch" :data-mode="listMode" :data-view-id="activeView.id">
        <el-tooltip :content="activeView.name" placement="bottom">
          <el-dropdown trigger="click" @command="switchDisplayView">
            <el-button>
              <span class="view-current">{{ activeView.name }}</span>
              <span class="muted view-mode">{{ listMode === 'spu' ? 'SPU' : 'SKU' }}</span>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-for="view in displayViews" :key="view.id" :command="view.id">
                  <span :data-saved-view="view.id">{{ view.name }}</span>
                  <span class="muted">{{ view.mode === 'spu' ? 'SPU' : 'SKU' }}</span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </el-tooltip>
        <ProductListViewTools
          v-model:visible="columnOpen"
          :category-sidebar="categoryLayout === 'sidebar'" @category-sidebar="setCategorySidebar"
          :columns="modeColumns" :group-options="groupOptions" :sort-options="sortOptions"
          :grouping="activeQuery.grouping" :sorting="activeQuery.sorting" :sort-mode="sortMode"
          @column-visible="toggleColumn" @column-move="moveColumn" @reset-columns="resetColumns"
          @group-change="setViewGrouping(listData, $event)" @sort-change="setViewSorting(listData, $event)"
          @sort-mode="onSortMode" @manage="manageView"
        />
        <span v-if="groupStatusLabel" class="tool-state" data-group-state>分组：{{ groupStatusLabel }}</span>
        <span v-if="sortStatusLabel" class="tool-state" data-sort-state>排序：{{ sortStatusLabel }}</span>
        <span class="muted" data-result-count>{{ listMode === 'spu' ? `商品 ${presentation.total} 款` : `SKU ${presentation.total} 条` }}</span>
      </div>
      <div v-if="listMode === 'spu' && familyIds.length" class="row-actions batch-actions" style="margin-bottom: 10px">
        <span data-selected-count>已选 {{ familyIds.length }} 条</span>
        <el-button :disabled="familyIds.length === 0" @click="setShelfMany('online')">批量发布</el-button>
        <el-button :disabled="familyIds.length === 0" @click="setShelfMany('offline')">批量下架</el-button>
        <el-button :disabled="familyIds.length === 0" type="danger" @click="removeMany">批量删除</el-button>
      </div>
      <div v-if="mode === 'sku' && skuIds.length" class="row-actions" style="margin-bottom: 10px">
        <span>已选 {{ skuIds.length }} 条</span><el-button @click="store.setSkuStatus(skuIds, 'on_sale')">批量在售</el-button><el-button @click="store.setSkuStatus(skuIds, 'off_sale')">批量停售</el-button><el-button type="danger" @click="removeSkuMany">批量删除</el-button>
      </div>
      <div v-if="listData.listViews.length > 1" class="row-actions" style="margin-bottom: 10px">
        <span class="muted">已存筛选</span>
        <el-tag v-for="view in listData.listViews" :key="view.id" :type="listData.activeViewId === view.id ? 'primary' : 'info'" style="cursor: pointer" @click="applyPreset(view.id)" @close="removePreset(view.id)" :closable="view.id !== 'view-all'">{{ view.name }}</el-tag>
      </div>
      <p v-if="presentation.manualBlocked" class="warn">手工排序已保存。当前还有分组，请先清除分组，再按手工顺序查看。分组不会被自动改掉。</p>
      <div v-if="manualOn && pickedIds.length" class="row-actions" style="margin-bottom: 8px">
        <span data-stage-pick>待放入暂存 {{ pickedIds.length }} 条</span>
        <el-button size="small" type="primary" @click="addStage">加入排序暂存区</el-button>
      </div>
      <div v-if="manualOn && stageIds.length" class="stage-bar">
        <span>排序暂存区（{{ stageIds.length }}）</span>
        <el-button size="small" @click="stageOpen = true">展开暂存</el-button>
        <el-button size="small" @click="clearStage">清空暂存</el-button>
      </div>
      <template v-for="group in shownGroups" :key="group.key">
      <button v-if="group.label" type="button" class="group-head" :data-group-key="group.label" @click="toggleGroup(group.label)">{{ collapsed[group.label] ? '展开' : '收起' }} {{ group.label }}（{{ group.total }}）</button>
      <el-table v-if="listMode === 'spu'" v-show="!group.label || !collapsed[group.label]" class="spu-table" :data="group.families" row-key="id" @selection-change="onFamilySelect">
        <template #empty><span data-empty="spu">{{ spuEmpty }}</span></template>
        <el-table-column v-if="manualOn" width="46">
          <template #default="{ row }"><span class="drag-handle" draggable="true" :data-drag-id="row.id" @dragstart="onRowDrag(row.id)" @dragover.prevent @drop="onRowDrop(row.id)">☰</span></template>
        </el-table-column>
        <el-table-column v-if="manualOn" width="42">
          <template #default="{ row }"><el-checkbox :data-pick-id="row.id" :model-value="pickedIds.includes(row.id)" @change="(value: boolean | string | number) => togglePick(row.id, Boolean(value))" /></template>
        </el-table-column>
        <el-table-column type="selection" width="42" />
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="sku-expand" :data-family-id="row.id">
              <div class="row-actions" style="margin-bottom: 8px">
                <el-button size="small" @click="router.push(`/spus/${row.id}`)">编辑 SPU</el-button>
                <el-button size="small" @click="router.push({ path: '/skus/new', query: { spu: row.id } })">新增 SKU</el-button>
                <el-button v-if="realCount(row.id) > 0" size="small" :disabled="selected[row.id]?.length === 0" @click="batchStatus(row.id, 'on_sale')">所选改在售</el-button>
                <el-button v-if="realCount(row.id) > 0" size="small" :disabled="selected[row.id]?.length === 0" @click="batchStatus(row.id, 'off_sale')">所选改停售</el-button>
              </div>
              <p v-if="realCount(row.id) === 0" class="muted">这款商品还没有真实 SKU。{{ row.line === 'v3' ? '物料档案不计入 SKU。' : '' }}</p>
              <el-table v-else :data="realSkus(row.id)" size="small" @selection-change="onSelect(row.id, $event)">
                <el-table-column type="selection" width="42" />
                <el-table-column label="规格" min-width="280">
                  <template #default="{ row: sku }">
                    <div :data-sku-id="sku.id">{{ savedSkuName(sku) }}</div>
                    <div class="muted">{{ savedSkuCode(sku) }} · {{ savedSkuSpec(row, sku) }}</div>
                  </template>
                </el-table-column>
                <el-table-column label="状态" width="120">
                  <template #default="{ row: sku }">
                    <el-select :model-value="sku.status" size="small" @change="(value: string) => store.patchSku(sku.id, { status: value as Sku['status'] })">
                      <el-option label="在售" value="on_sale" />
                      <el-option label="停售" value="off_sale" />
                      <el-option label="草稿" value="draft" />
                    </el-select>
                  </template>
                </el-table-column>
                <el-table-column prop="oaSkuId" label="OA_SKUID" width="140" />
                <el-table-column label="操作" width="180">
                  <template #default="{ row: sku }">
                    <el-button link type="primary" @click="router.push(`/skus/${sku.id}?spu=${row.id}`)">编辑</el-button>
                    <el-button v-if="row.line !== 'v3'" link @click="copySku(row.id, sku.id)">复制</el-button>
                    <el-button link type="danger" @click="removeSku(sku.id)">删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </template>
        </el-table-column>
        <el-table-column v-for="col in tableColumns" :key="col.key" :prop="col.key" :label="col.label" min-width="120">
          <template #default="{ row }">
            <template v-if="col.key === 'name'">
              <button class="linkish" :data-family-id="row.id" @click="router.push(`/spus/${row.id}`)">{{ row.name }}</button>
              <span v-if="row.line === 'v3'" class="sku-hint">{{ materialSummary(row.id) }}</span>
              <span v-if="planSource(row)" class="sku-hint">来自规划：{{ planSource(row) }}</span>
            </template>
            <template v-else-if="col.key === 'category'">{{ categoryPath(store.data, row.categoryId) }}</template>
            <template v-else-if="col.key === 'template'">{{ templateById(store.data, row.templateId)?.name }}</template>
            <template v-else-if="col.key === 'brand'">{{ brandText(row) }}</template>
            <template v-else-if="col.key === 'skuCount'"><button class="linkish" :data-sku-count="realCount(row.id)" @click="router.push({ path: '/skus', query: { spu: row.id } })">{{ skuCountText(realCount(row.id)) }}</button></template>
            <template v-else-if="col.key === 'sale'">{{ saleCount(row.id) }}</template>
            <template v-else-if="col.key === 'origin'">{{ row.origin === 'sample' ? '预设演示' : '本次新增' }}</template>
            <template v-else-if="col.key === 'updatedAt'">{{ row.updatedAt.slice(0, 16).replace('T', ' ') }}</template>
            <template v-else-if="col.key === 'productType'">{{ productTypeName(store.data, row) }}</template>
            <template v-else-if="col.key === 'model'">{{ linkedModelName(store.data, row) }}</template>
            <template v-else-if="col.key === 'shelf'">{{ shelfText(shelfOf(row)) }}</template>
            <template v-else-if="col.key === 'oaProductId'">{{ row.oaProductId || '-' }}</template>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="390" fixed="right">
          <template #default="{ row }">
            <el-button v-if="compatibilityFamilyRole(store.data, row.id) === 'host' && realCount(row.id)" link type="primary" :data-spu-compatibility="row.id" @click.stop="openCompatibilityFamily(row.id)">适用配件</el-button>
            <el-button v-else-if="row.line === 'v3'" link type="primary" @click="router.push(compatTarget(row))">{{ compatTitle(row) }}</el-button>
            <el-button link type="primary" @click="router.push(`/spus/${row.id}`)">编辑 SPU</el-button>
            <el-button link @click="router.push({ path: '/skus/new', query: { spu: row.id } })">新增 SKU</el-button>
            <el-button v-if="row.line === 'v3'" link @click="router.push(`/materials/${row.id}`)">管理物料</el-button>
            <el-button link @click="copyFamily(row.id)">复制 SPU</el-button>
            <el-button link type="danger" @click="removeFamily(row.id, row.name)">删除</el-button>
            <el-button v-if="manualOn && stageIds.length" link @click="askInsert(row.id, row.name, 'before')">插到前面</el-button>
            <el-button v-if="manualOn && stageIds.length" link @click="askInsert(row.id, row.name, 'after')">插到后面</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-table v-else v-show="!group.label || !collapsed[group.label]" class="sku-table" :data="group.skus" row-key="id" @selection-change="(rows: { id: string }[]) => onSkuSelect(group.key, rows)">
        <el-table-column type="selection" width="42" reserve-selection />
        <template #empty><span data-empty="sku">{{ skuEmpty }}</span></template>
        <el-table-column v-if="manualOn" width="46">
          <template #default="{ row }"><span class="drag-handle" draggable="true" :data-drag-id="row.id" @dragstart="onRowDrag(row.id)" @dragover.prevent @drop="onRowDrop(row.id)">☰</span></template>
        </el-table-column>
        <el-table-column v-if="manualOn" width="42">
          <template #default="{ row }"><el-checkbox :data-pick-id="row.id" :model-value="pickedIds.includes(row.id)" @change="(value: boolean | string | number) => togglePick(row.id, Boolean(value))" /></template>
        </el-table-column>
        <el-table-column v-for="col in tableColumns" :key="col.key" :prop="col.key" :label="col.label" min-width="140">
          <template #default="{ row }">
            <template v-if="col.key === 'code'"><span :data-sku-id="row.id">{{ row.code }}</span></template>
            <template v-else-if="col.key === 'name'">{{ row.name }}</template>
            <template v-else-if="col.key === 'spec'"><span :data-sku-spec="row.id">{{ row.spec }}</span></template>
            <template v-else-if="col.key === 'family'">
              <button class="linkish" @click="router.push(`/spus/${row.familyId}`)">{{ row.familyName }}</button>
            </template>
            <template v-else-if="col.key === 'category'">{{ row.category }}</template>
            <template v-else-if="col.key === 'typeName'">{{ row.typeName }}</template>
            <template v-else-if="col.key === 'status'"><el-select :model-value="row.status" size="small" @change="(status: Sku['status']) => store.patchSku(row.id, { status })"><el-option label="草稿" value="draft" /><el-option label="在售" value="on_sale" /><el-option label="停售" value="off_sale" /></el-select></template>
            <template v-else-if="col.key === 'updatedAt'">{{ row.updatedAt || '—' }}</template>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="router.push({ path: `/skus/${row.id}`, query: scopeId ? { spu: scopeId } : {} })">编辑 SKU</el-button>
            <el-button link type="danger" @click="removeSku(row.id)">删除</el-button>
            <el-button v-if="manualOn && stageIds.length" link @click="askInsert(row.id, row.name, 'before')">插到前面</el-button>
            <el-button v-if="manualOn && stageIds.length" link @click="askInsert(row.id, row.name, 'after')">插到后面</el-button>
          </template>
        </el-table-column>
      </el-table>
      </template>
      <div style="display: flex; justify-content: flex-end; margin-top: 12px">
        <el-pagination :current-page="query.page" :page-size="query.pageSize" :total="activeTotal" layout="total, prev, pager, next" @current-change="(page: number) => (query.page = page)" />
      </div>
      </div>
    </div>

    <el-dialog v-model="createOpen" title="新建视图" width="420px">
      <el-input v-model="draftName" placeholder="视图名称" @keyup.enter="confirmCreate" />
      <p v-if="nameError" class="warn">{{ nameError }}</p>
      <template #footer>
        <el-button @click="createOpen = false">取消</el-button>
        <el-button type="primary" @click="confirmCreate">创建</el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="settingsOpen" title="视图设置" width="420px">
      <p class="muted">当前视图 {{ activeView.name }}。改名不会更换视图编号。</p>
      <el-input v-model="renameDraft" placeholder="视图名称" />
      <p v-if="renameError" class="warn">{{ renameError }}</p>
      <div class="row-actions" style="margin-top: 12px">
        <el-button type="primary" @click="confirmRename">保存名称</el-button>
        <el-button @click="confirmCopy">复制</el-button>
        <el-button type="danger" :disabled="activeView.id === defaultViewId" @click="confirmDelete">删除</el-button>
      </div>
      <p v-if="activeView.id === defaultViewId" class="muted">默认视图不能删除，可以调整它的列。</p>
    </el-dialog>
    <el-drawer v-model="stageOpen" title="排序暂存区" size="360px">
      <p class="muted">共 {{ stageIds.length }} 条。插入目标并确认后，才会改展示顺序。</p>
      <ul class="column-list">
        <li v-for="id in stageIds" :key="id">
          <span>{{ stageLabel(id) }}</span>
          <el-button link type="danger" @click="removeStaged(id)">移除</el-button>
        </li>
      </ul>
      <el-button @click="clearStage">清空暂存</el-button>
    </el-drawer>
    <ProductListFilterDialog
      v-model:visible="filterOpen" :rows="filterRows" :fields="filterFields"
      :categories="store.data.categories" :exposed="activeQuery.exposed"
      @add="addCondition" @field="changeFilterField" @operator="changeFilterOperator"
      @value="setConditionValue" @remove="removeCondition"
      @expose="(field, exposed) => setViewExposed(listData, field, exposed)"
    />
    <AccessoryCompatibilityDrawer v-model="compatibilityOpen" :family-id="compatibilityFamilyId" />
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CategoryFilterTree from '../components/CategoryFilterTree.vue'
import ProductListFilterDialog from '../components/product-list/ProductListFilterDialog.vue'
import AccessoryCompatibilityDrawer from '../components/compatibility/AccessoryCompatibilityDrawer.vue'
import { compatibilityFamilyRole } from '../domain/deviceResolution'
import { conditionRange, filterOperators, filterSummaries, quickFilterState, type FilterEditorRow, type FilterField } from '../components/product-list/filterPresentation'
import PageHead from '../components/PageHead.vue'
import ProductListViewTools from '../components/product-list/ProductListViewTools.vue'
import { useProductListManualOrder } from '../components/product-list/useProductListManualOrder'
import { useProductListCategoryLayout } from '../components/product-list/useProductListCategoryLayout'
import { presentTableGroups } from '../components/product-list/tablePresentation'
import { familyBrandText, familyBrandValues, isRealSku, linkedModelName, materialArchivesOf, productTypeName, realSkusOf, savedSkuCode, savedSkuName, savedSkuSpec, skuCountText } from '../domain/productList'
import { catalogRole, compatibilitySkuBlock, roleOfType } from '../domain/compatibility'
import { categoryPath, shelfOf, shelfText, templateById } from '../domain/logic'
import { familyMaterialDigest } from '../domain/material'
import { emptyModeQuery, groupFields, knownFilterFields, presentProductList, resolveCategoryFilter, sortFields, sortModeOf } from '../domain/productListQuery'
import { DEFAULT_PRODUCT_LIST_VIEW_ID, activeProductListView, copyProductListView, createProductListView, currentModeQuery, deleteProductListView, insertViewManual, moveViewManual, orderedColumns, renameProductListView, reorderProductListColumn, resetProductListColumns, selectProductListView, setProductListColumnVisible, applyPresetToActiveView, setViewCategoryLayout, setViewExposed, setViewFieldValues, setViewGrouping, setViewKeyword, setViewSortMode, setViewSorting, visibleColumns } from '../domain/productListViews'
import type { ListView, ProductFamily, ProductListMode, ProductListPageState, ProductListFilterOperator, ProductListViewFilter, Sku } from '../domain/types'
import { productListPageData } from '../domain/productListPages'
import { spuRemovalBlock } from '../domain/spuSku'
import { uid, useCatalogStore } from '../stores/catalog'

const { mode } = defineProps<{ mode: ProductListMode }>()
const store = useCatalogStore()
const compatibilityOpen = ref(false), compatibilityFamilyId = ref('')
function openCompatibilityFamily(id: string) { compatibilityFamilyId.value = id; compatibilityOpen.value = true }
const router = useRouter()
const route = useRoute()
const scopeId = computed(() => mode === 'sku' && typeof route.query.spu === 'string' ? route.query.spu : '')
const scopeFamily = computed(() => store.data.families.find(item => item.id === scopeId.value))
const temporary = ref<ProductListPageState>()
watch(scopeId, id => {
  temporary.value = undefined
  if (!id) return
  const page = store.data.productListPages?.sku
  if (!page) return
  const next: ProductListPageState = JSON.parse(JSON.stringify(page))
  next.query.page = 1
  next.views.forEach(view => { view.skuQuery = emptyModeQuery('sku') })
  temporary.value = next
}, { immediate: true })
const listData = computed(() => productListPageData(store.data, mode, temporary.value))
const query = computed(() => listData.value.listQuery)
const columnOpen = ref(false)
const createOpen = ref(false)
const settingsOpen = ref(false)
const filterOpen = ref(false)
const stageOpen = ref(false)
const collapsed = reactive<Record<string, boolean>>({})
const draftName = ref('')
const renameDraft = ref('')
const nameError = ref('')
const renameError = ref('')
const selected = reactive<Record<string, string[]>>({})
const familyIds = ref<string[]>([])
const skuSelections = reactive<Record<string, string[]>>({})
const skuIds = computed(() => [...new Set(Object.values(skuSelections).flat())].filter(id => store.data.skus.some(item => item.id === id && isRealSku(store.data, item))))
function onSkuSelect(group: string, rows: { id: string }[]) { skuSelections[group] = rows.map(row => row.id) }
async function removeSkuMany() {
  const blocked = skuIds.value.map(id => compatibilitySkuBlock(store.data, id)).find(Boolean)
  if (blocked) { ElMessage.warning(blocked); return }
  try { await ElMessageBox.confirm(`删除选中的 ${skuIds.value.length} 条 SKU？SPU 会保留。`, '批量删除 SKU') } catch { return }
  skuIds.value.forEach(id => store.removeSku(id))
  if (!await flushListChanges()) return
  Object.keys(skuSelections).forEach(key => delete skuSelections[key])
}
function applyPreset(id: string) {
  const page = listData.value
  const preset = page.listViews.find(item => item.id === id)
  if (!preset) return
  page.activeViewId = id; page.listQuery = JSON.parse(JSON.stringify(preset.query)); applyPresetToActiveView(page, preset)
}
function removePreset(id: string) {
  if (id === 'view-all') return
  listData.value.listViews = listData.value.listViews.filter(item => item.id !== id)
  if (listData.value.activeViewId === id) applyPreset('view-all')
}
const defaultViewId = DEFAULT_PRODUCT_LIST_VIEW_ID
const brands = computed(() => Array.from(new Set(store.data.families.flatMap((item) => familyBrandValues(store.data, item)))).sort((left, right) => left.localeCompare(right, 'zh')))
const displayViews = computed(() => listData.value.productListViews || [])
const activeView = computed(() => activeProductListView(listData.value))
const listMode = computed(() => mode)
const tableColumns = computed(() => visibleColumns(activeView.value, listMode.value))
const modeColumns = computed(() => orderedColumns(activeView.value, listMode.value))
const activeQuery = computed(() => currentModeQuery(activeView.value))
const presentation = computed(() => presentProductList(scopeId.value ? { ...store.data, families: store.data.families.filter(item => item.id === scopeId.value) } : store.data, activeView.value, query.value.page, query.value.pageSize))
const shownGroups = computed(() => presentTableGroups(store.data, presentation.value.groups))
const activeTotal = computed(() => presentation.value.total)
const summaries = computed(() => filterSummaries(activeQuery.value, filterFields.value, value => categoryPath(store.data, value) || value))
const filterCount = computed(() => summaries.value.length)
const filterFields = computed(() => knownFilterFields(store.data, listMode.value))
const exposedFields = computed(() => activeQuery.value.exposed.flatMap((field) => {
  const found = filterFields.value.find((item) => item.field === field)
  return found && found.field !== 'category' ? [found] : []
}))
// Convert saved conditions to editor values without duplicating editable state.
const filterRows = computed<FilterEditorRow[]>(() => activeQuery.value.filters.map((filter) => ({
  id: filter.id, field: filter.field, operator: filter.operator,
  kind: kindOf(filter.field), operators: operatorsFor(filter.field), options: fieldOptions(filter.field),
  text: textValue(filter), values: Array.isArray(filter.value) ? filter.value : [], range: conditionRange(filter),
  categoryId: filter.field === 'category' ? categoryConditionId(filter) : '',
  categoryIds: filter.field === 'category' ? categoryConditionIds(filter) : [],
})))
const groupOptions = computed(() => groupFields(store.data, listMode.value))
const sortOptions = computed(() => sortFields(listMode.value))
const sortMode = computed(() => sortModeOf(activeQuery.value))
const manualOn = computed(() => sortMode.value === 'manual' && !activeQuery.value.grouping)
const { pickedIds, stageIds, confirmStage, onRowDrag, onRowDrop, togglePick, addStage, clearStage, removeStaged, askInsert } = useProductListManualOrder({
  move: (dragId, targetId, place) => moveViewManual(listData.value, dragId, targetId, place),
  insert: (stagedIds, targetId, place) => insertViewManual(listData.value, stagedIds, targetId, place),
  hasFilters: () => filterCount.value > 0,
})
const groupStatusLabel = computed(() => {
  const field = activeQuery.value.grouping?.field
  if (!field) return ''
  return groupOptions.value.find((item) => item.field === field)?.label || field
})
const sortStatusLabel = computed(() => {
  if (sortMode.value === 'manual') return '手工排序'
  if (sortMode.value !== 'field') return ''
  const field = activeQuery.value.sorting?.field
  const label = sortOptions.value.find((item) => item.field === field)?.label
  return label ? `按${label}` : '按字段'
})
const categoryQuick = computed(() => quickFilterState(activeQuery.value, { field: 'category', label: '商品分类', kind: 'enum' }))
const categoryState = computed(() => resolveCategoryFilter(store.data, chosen('category')))
const selectedCategoryIds = computed(() => categoryState.value.ids)
const categorySummary = computed(() => {
  const names = selectedCategoryIds.value.map(id => categoryPath(store.data, id)).filter(Boolean)
  return [...names, ...categoryState.value.missing.map(value => `分类已不存在：${value}`)].join('、')
})
const categoryButtonText = computed(() => !categoryQuick.value.simple ? '商品分类：高级条件' : categorySummary.value ? `商品分类：${categorySummary.value}` : '商品分类：全部分类')
const spuEmpty = computed(() => (store.data.families.length === 0 ? '当前没有商品。' : filterCount.value ? '没有符合条件的商品。' : '当前没有商品。'))
const skuEmpty = computed(() => (store.data.skus.some((item) => isRealSku(store.data, item)) ? (filterCount.value ? '没有符合条件的真实 SKU。' : '当前没有真实 SKU。') : '当前没有真实 SKU。已有商品、规划组合和物料不会显示成 SKU。'))

function realSkus(familyId: string) {
  return realSkusOf(store.data, familyId)
}
function realCount(familyId: string) {
  return realSkus(familyId).length
}
function brandText(family: ProductFamily) {
  return familyBrandText(store.data, family)
}
function saleCount(familyId: string) {
  return realSkus(familyId).filter((item) => item.status === 'on_sale').length
}
function materialSummary(familyId: string) {
  return familyMaterialDigest(materialArchivesOf(store.data, familyId))
}
function planSource(row: { productPlanId?: string }) {
  if (!row.productPlanId) return ''
  return store.data.productPlans.find((item) => item.id === row.productPlanId)?.name || '商品规划'
}
function warn(result: { ok: true } | { ok: false; message: string }) {
  if (!result.ok) ElMessage.warning(result.message)
  return result.ok
}
async function switchDisplayView(id: string) {
  if (id === activeView.value.id) return
  if (!(await confirmStage())) return
  if (!warn(selectProductListView(listData.value, id))) return
  query.value.page = 1
}
function onKeyword(value: string) {
  setViewKeyword(listData.value, value)
}
function quickState(field: FilterField) { return quickFilterState(activeQuery.value, field) }
function chosen(field: string) {
  const definition = filterFields.value.find(item => item.field === field)
  if (!definition) return []
  const state = quickState(definition)
  if (!state.simple) return []
  const value = state.filter?.value
  return Array.isArray(value) ? value : typeof value === 'string' && value ? [value] : []
}
function setExposedValue(field: string, values: string[]) {
  const definition = filterFields.value.find(item => item.field === field)
  if (!definition || !quickState(definition).simple) { filterOpen.value = true; return }
  setViewFieldValues(listData.value, field, values)
}
function quickText(field: FilterField) {
  const value = quickState(field).filter?.value
  return typeof value === 'string' ? value : ''
}
function setQuickText(field: FilterField, value: string) {
  const state = quickState(field)
  if (!state.simple) return
  if (state.filter) state.filter.value = value
  else liveQuery().filters.push({ id: uid('filter'), field: field.field, operator: 'contains', value })
  touchFilters()
}
function toggleCategory(id: string) {
  // Keep unresolved historical categories until explicitly cleared as well.
  const current = [...selectedCategoryIds.value, ...categoryState.value.missing]
  setExposedValue('category', current.includes(id) ? current.filter(item => item !== id) : [...current, id])
}
function clearCategory() {
  liveQuery().filters = liveQuery().filters.filter(item => item.field !== 'category')
  touchFilters()
}
function removeSummary(id: string) {
  if (id === '$keyword') onKeyword('')
  else removeCondition(id)
}
function clearFilters() {
  liveQuery().keyword = ''
  liveQuery().filters = []
  touchFilters()
}
function kindOf(field: string) {
  return filterFields.value.find((item) => item.field === field)?.kind || 'text'
}
function fieldOptions(field: string) {
  if (field === 'category') return store.data.categories.map((item) => categoryPath(store.data, item.id)).filter(Boolean)
  if (field === 'brand') return brands.value
  if (field === 'shelf') return ['草稿', '已发布', '已下架']
  if (field === 'status') return ['在售', '停售', '草稿']
  if (field === 'productType') return [...store.data.productTypes.map((item) => item.name), '未记录']
  if (field === 'template') return store.data.templates.map((item) => item.name)
  if (field === 'group') return store.data.productGroups.map((item) => item.name)
  if (field.startsWith('attr:')) return store.data.params.find((item) => item.id === field.slice(5))?.values || []
  return []
}
function operatorsFor(field: string) {
  return filterOperators(kindOf(field))
}
function liveQuery() {
  const view = activeView.value
  const next = currentModeQuery(view)
  if (view.mode === 'sku') view.skuQuery = next
  else view.spuQuery = next
  return next
}
function touchFilters() {
  activeView.value.updatedAt = new Date().toISOString()
  query.value.page = 1
}
function addCondition() {
  const field = filterFields.value[0]
  if (!field) return
  const operator = operatorsFor(field.field)[0].value
  liveQuery().filters.push({ id: uid('filter'), field: field.field, operator, value: operator === 'between' ? { from: '', to: '' } : operator === 'in' ? [] : '' })
  touchFilters()
}
function changeFilterField(id: string, field: string) {
  const filter = liveQuery().filters.find((item) => item.id === id)
  if (!filter) return
  filter.field = field
  filter.operator = operatorsFor(field)[0].value
  filter.value = filter.operator === 'between' ? { from: '', to: '' } : filter.operator === 'in' ? [] : ''
  touchFilters()
}
function changeFilterOperator(id: string, operator: ProductListFilterOperator) {
  const filter = liveQuery().filters.find((item) => item.id === id)
  if (!filter) return
  filter.operator = operator
  filter.value = operator === 'between' ? { from: '', to: '' } : operator === 'in' ? [] : ''
  touchFilters()
}
function categoryConditionId(filter: ProductListViewFilter) {
  if (typeof filter.value !== 'string' || !filter.value) return ''
  return resolveCategoryFilter(store.data, [filter.value]).ids[0] || filter.value
}
function categoryConditionIds(filter: ProductListViewFilter) {
  const values = Array.isArray(filter.value) ? filter.value : []
  const resolved = resolveCategoryFilter(store.data, values)
  return [...resolved.ids, ...resolved.missing]
}
function textValue(filter: ProductListViewFilter) {
  if (typeof filter.value !== 'string') return ''
  if (filter.field === 'category') return categoryPath(store.data, filter.value) || filter.value
  return filter.value
}
function setConditionValue(id: string, value: ProductListViewFilter['value']) {
  const filter = liveQuery().filters.find((item) => item.id === id)
  if (!filter) return
  filter.value = value
  touchFilters()
}
function removeCondition(id: string) {
  const queryState = liveQuery()
  queryState.filters = queryState.filters.filter((item) => item.id !== id)
  touchFilters()
}
function dateRange(field: string): [string, string] | null {
  const filter = activeQuery.value.filters.find((item) => item.field === field && item.operator === 'between')
  return filter ? conditionRange(filter) : null
}
function setDate(value: [string, string] | null) {
  if (!quickState({ field: 'created', label: '创建日期', kind: 'date' }).simple) return
  const queryState = liveQuery()
  const rest = queryState.filters.filter((item) => item.field !== 'created')
  queryState.filters = value ? [...rest, { id: 'f-created', field: 'created', operator: 'between', value: { from: value[0], to: value[1] } }] : rest
  touchFilters()
}
function toggleGroup(label: string) {
  collapsed[label] = !collapsed[label]
}
function onSortMode(mode: string | number | boolean) {
  if (mode !== 'default' && mode !== 'field' && mode !== 'manual') return
  const result = setViewSortMode(listData.value, mode)
  if (!result.ok) ElMessage.warning(result.message)
}
function stageLabel(id: string) {
  if (listMode.value === 'sku') {
    const sku = store.data.skus.find((item) => item.id === id)
    return sku ? savedSkuName(sku) : id
  }
  return store.data.families.find((item) => item.id === id)?.name || id
}
function toggleColumn(key: string, visible: boolean) {
  warn(setProductListColumnVisible(listData.value, activeView.value.id, listMode.value, key, visible))
}
function moveColumn(from: string, to: string) {
  warn(reorderProductListColumn(listData.value, activeView.value.id, listMode.value, from, to))
}
function manageView(action: 'create' | 'settings' | 'save-filter' | 'import') {
  if (action === 'create') openCreate()
  else if (action === 'settings') openSettings()
  else if (action === 'save-filter') saveFilter()
  else router.push('/import')
}
function resetColumns() {
  if (!warn(resetProductListColumns(listData.value, activeView.value.id, listMode.value, store.defaultColumns()))) return
  ElMessage.success('已恢复当前模式的默认列')
}
function openCreate() {
  draftName.value = ''
  nameError.value = ''
  createOpen.value = true
}
function confirmCreate() {
  const result = createProductListView(listData.value, draftName.value, activeView.value.id, () => uid('view'))
  if (!result.ok) {
    nameError.value = result.message
    return
  }
  createOpen.value = false
  query.value.page = 1
  ElMessage.success('视图已创建')
}
function openSettings() {
  renameDraft.value = activeView.value.name
  renameError.value = ''
  settingsOpen.value = true
}
function confirmRename() {
  const result = renameProductListView(listData.value, activeView.value.id, renameDraft.value)
  if (!result.ok) {
    renameError.value = result.message
    return
  }
  ElMessage.success('名称已保存')
}
function confirmCopy() {
  const result = copyProductListView(listData.value, activeView.value.id, () => uid('view'))
  if (!warn(result)) return
  settingsOpen.value = false
  query.value.page = 1
  ElMessage.success('已复制为独立视图')
}
async function confirmDelete() {
  await ElMessageBox.confirm(`删除视图「${activeView.value.name}」？商品不会被删除。`, '删除视图')
  const result = deleteProductListView(listData.value, activeView.value.id)
  if (!warn(result)) return
  settingsOpen.value = false
  query.value.page = 1
  ElMessage.success('视图已删除')
}
function saveFilter() {
  const page = listData.value
  const view: ListView = { id: uid('view'), name: `筛选${page.listViews.length}`, query: { ...JSON.parse(JSON.stringify(query.value)), page: 1 }, columns: [], keyword: activeQuery.value.keyword, viewFilters: JSON.parse(JSON.stringify(activeQuery.value.filters)) }
  page.listViews.push(view); page.activeViewId = view.id
  ElMessage.success('筛选已保存，刷新后还在')
}
function familyRole(row: ProductFamily) {
  if (row.productTypeId) return roleOfType(store.data, row.productTypeId)
  return catalogRole(store.data, row.categoryId)
}
function compatTitle(row: ProductFamily) {
  return familyRole(row) === 'accessory' ? '适用主机' : '适用配件'
}
function compatTarget(row: ProductFamily) {
  if (familyRole(row) !== 'accessory') return `/compatibility?family=${row.id}`
  const material = materialArchivesOf(store.data, row.id)[0]
  return material ? `/compatibility?sku=${material.id}` : '/compatibility'
}
function copyFamily(id: string) {
  const family = store.data.families.find((item) => item.id === id)
  if (family?.line === 'v3') {
    ElMessage.warning('物料请在对应规格上继续创建，不会整款复制。')
    return
  }
  router.push(`/spus/new?from=${id}`)
}
async function removeFamily(id: string, name: string) {
  const family = store.data.families.find((item) => item.id === id)
  if (family && shelfOf(family) === 'online') {
    ElMessage.warning('已发布的商品不能直接删除，请先下架。')
    return
  }
  await ElMessageBox.confirm(`删除空 SPU「${name}」？有关联记录时会阻止删除。`, '删除商品')
  const blocked = store.removeFamily(id)
  if (blocked) {
    ElMessage.warning(blocked)
    return
  }
  if (!await flushListChanges()) return
  ElMessage.success('已删除')
}
function onFamilySelect(rows: ProductFamily[]) {
  familyIds.value = rows.map((item) => item.id)
}
async function flushListChanges() {
  const result = await store.flushPersistence()
  if (!result.ok) { ElMessage.error(store.persistenceState.message || '当前修改尚未保存，本页内容保留。'); return false }
  return true
}
async function setShelfMany(status: 'online' | 'offline') {
  familyIds.value.forEach((id) => {
    const family = store.data.families.find((item) => item.id === id)
    if (!family) return
    family.shelfStatus = status
    if (status === 'online') family.lifecycle = 'ready'
  })
  if (!await flushListChanges()) return
  ElMessage.success(status === 'online' ? '已批量发布' : '已批量下架')
}
async function removeMany() {
  const online = familyIds.value.filter((id) => {
    const family = store.data.families.find((item) => item.id === id)
    return family && shelfOf(family) === 'online'
  })
  if (online.length) {
    ElMessage.warning('选中的商品里有已发布的，请先下架再删除。')
    return
  }
  await ElMessageBox.confirm(`删除选中的 ${familyIds.value.length} 个空 SPU？不会级联删除 SKU 或物料。`, '批量删除')
  const blocked = familyIds.value.map((id) => spuRemovalBlock(store.data, id)).find(Boolean)
  if (blocked) {
    ElMessage.warning(blocked)
    return
  }
  familyIds.value.forEach((id) => store.removeFamily(id))
  if (!await flushListChanges()) return
  familyIds.value = []
  ElMessage.success('已删除')
}
async function removeSku(id: string) {
  await ElMessageBox.confirm('删除这条 SKU？所属 SPU 会保留。', '删除规格')
  const blocked = store.removeSku(id)
  if (blocked) { ElMessage.warning(blocked); return }
  await flushListChanges()
}
function copySku(familyId: string, skuId: string) {
  router.push({ path: '/skus/new', query: { spu: familyId, copy: skuId } })
}
function onSelect(familyId: string, rows: Sku[]) {
  selected[familyId] = rows.map((item) => item.id)
}
async function batchStatus(familyId: string, status: Sku['status']) {
  store.setSkuStatus(selected[familyId] || [], status)
  if (!await flushListChanges()) return
  ElMessage.success('状态已更新')
}

// Register the existing route-open hook before the category layout's resize hook.
onMounted(() => {
  if (route.query.panel === 'columns') columnOpen.value = true
})
const { categoryOpen, categorySideClosed, narrowScreen, categoryLayout, showSidebar, setCategorySidebar } = useProductListCategoryLayout(
  activeView,
  layout => setViewCategoryLayout(listData.value, layout),
)
watch(presentation, () => {
  if (query.value.page !== presentation.value.page) query.value.page = presentation.value.page
}, { immediate: true })

watch(
  () => route.query.panel,
  (panel) => {
    if (panel === 'columns') columnOpen.value = true
  },
)
</script>

<style scoped>
.panel.is-category-side { display: flex; align-items: flex-start; gap: 12px; }
.category-side { width: 240px; flex: none; max-height: 70vh; overflow: auto; }
.list-main { flex: 1; min-width: 0; }
.category-chip { max-width: 100%; overflow-wrap: anywhere; font-size: 13px; color: var(--text-secondary); }
.category-side-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.active-filters { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 12px; }
.active-filters :deep(.el-tag) { max-width: 100%; height: auto; min-height: 24px; white-space: normal; overflow-wrap: anywhere; }
.active-filters :deep(.el-tag__content) { min-width: 0; }
.list-switch { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.filters > * { max-width: 100%; }
.filters [data-category-trigger] { height: auto; min-height: 32px; white-space: normal; text-align: left; }
.filters { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.tool-state { color: var(--text-secondary); font-size: 13px; }
.batch-actions { padding-top: 4px; border-top: 1px solid #e5e7eb; }
.view-current { display: inline-block; max-width: 140px; overflow: hidden; text-overflow: ellipsis; vertical-align: bottom; white-space: nowrap; }
.view-mode { margin-left: 6px; }
.column-list { list-style: none; margin: 0; padding: 0; max-height: 320px; overflow: auto; }
.column-list li { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
.drag-handle { cursor: grab; color: var(--text-secondary, #607089); user-select: none; }
.stage-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.sku-expand { padding: 0 12px 8px; }
.group-head { display: block; width: 100%; margin: 8px 0 4px; padding: 8px 10px; border: 0; border-radius: 6px; background: var(--app-surface-muted); color: inherit; text-align: left; cursor: pointer; }
.warn { color: var(--el-color-danger); font-size: 13px; }
</style>

<style>
.product-category-pop { max-width: calc(100vw - 24px); max-height: calc(100vh - 24px); overflow: auto; box-sizing: border-box; }
</style>
