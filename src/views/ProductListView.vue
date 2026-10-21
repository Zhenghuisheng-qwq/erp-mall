<template>
  <div>
    <PageHead title="商品列表" desc="默认按商品主体查看。需要逐条规格时，切换到 SKU 视图。">
      <el-button type="primary" @click="router.push('/products/new')">新增商品</el-button>
    </PageHead>
    <div class="panel" :class="{ 'is-category-side': showSidebar }" :data-category-layout="categoryLayout">
      <aside v-if="showSidebar" class="category-side" data-category-side>
        <CategoryFilterTree placement="sidebar" :categories="store.data.categories" :selected-ids="selectedCategoryIds" @toggle="toggleCategory" @clear="clearCategory" @float="floatCategory" @hide="hideCategory" @dock="dockCategory" />
      </aside>
      <div class="list-main">
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
        <el-popover v-model:visible="columnOpen" trigger="click" placement="bottom-end" :width="360">
          <template #reference>
            <el-button>视图工具</el-button>
          </template>
          <div class="view-tools">
            <p class="muted">列、分组、排序和视图都保存在当前视图里。</p>
            <p class="tool-label">列</p>
            <el-input v-model="columnQuery" placeholder="搜索字段" clearable />
            <ul class="column-list">
              <li
                v-for="col in filteredColumns"
                :key="col.key"
                :data-column-key="col.key"
                :draggable="columnQuery.trim() ? 'false' : 'true'"
                @dragstart="onDragStart(col.key)"
                @dragover.prevent
                @drop="onDrop(col.key)"
              >
                <span class="drag-handle" :title="columnQuery.trim() ? '清除搜索后再调整顺序' : '拖动调整顺序'">⋮⋮</span>
                <el-checkbox :model-value="col.visible" :disabled="col.required" @change="(value: boolean | string | number) => toggleColumn(col.key, Boolean(value))">{{ col.label }}</el-checkbox>
              </li>
            </ul>
            <p v-if="filteredColumns.length === 0" class="muted">没有匹配的字段。</p>
            <el-button link type="primary" @click="resetColumns">恢复当前模式的默认列</el-button>
            <p class="tool-label">分组</p>
            <el-select :model-value="activeQuery.grouping?.field || ''" clearable placeholder="分组字段" @change="onGroupField">
              <el-option v-for="item in groupOptions" :key="item.field" :label="item.label" :value="item.field" />
            </el-select>
            <el-radio-group :model-value="activeQuery.grouping?.direction || 'asc'" @change="onGroupDirection">
              <el-radio-button value="asc">升序</el-radio-button>
              <el-radio-button value="desc">降序</el-radio-button>
            </el-radio-group>
            <el-button link type="primary" @click="clearGroup">清除分组</el-button>
            <p class="tool-label">排序</p>
            <el-radio-group :model-value="sortMode" @change="onSortMode">
              <el-radio-button value="default">默认顺序</el-radio-button>
              <el-radio-button value="field">按字段排序</el-radio-button>
              <el-radio-button value="manual">手工排序</el-radio-button>
            </el-radio-group>
            <el-select :model-value="activeQuery.sorting?.field || ''" clearable placeholder="排序字段" @change="onSortField">
              <el-option v-for="item in sortOptions" :key="item.field" :label="item.label" :value="item.field" />
            </el-select>
            <el-radio-group :model-value="activeQuery.sorting?.direction || 'asc'" @change="onSortDirection">
              <el-radio-button value="asc">升序</el-radio-button>
              <el-radio-button value="desc">降序</el-radio-button>
            </el-radio-group>
            <el-button link type="primary" @click="clearSort">清除排序</el-button>
            <div class="tool-links">
              <el-button @click="openCreate">新建视图</el-button>
              <el-button @click="openSettings">视图设置</el-button>
              <el-button @click="saveFilter">保存当前筛选</el-button>
              <el-button @click="router.push('/import')">导入导出</el-button>
            </div>
          </div>
        </el-popover>
        <span v-if="groupStatusLabel" class="tool-state" data-group-state>分组：{{ groupStatusLabel }}</span>
        <span v-if="sortStatusLabel" class="tool-state" data-sort-state>排序：{{ sortStatusLabel }}</span>
        <el-radio-group :model-value="listMode" size="small" @change="setListMode">
          <el-radio-button value="spu">商品</el-radio-button>
          <el-radio-button value="sku">规格</el-radio-button>
        </el-radio-group>
        <span class="muted" data-result-count>{{ listMode === 'spu' ? `商品 ${presentation.total} 款` : `SKU ${presentation.total} 条` }}</span>
      </div>
      <div class="filters">
        <el-input :model-value="activeQuery.keyword" placeholder="名称、分类、属性、SKU、OA 编号" clearable style="width: 260px" data-filter="keyword" @update:model-value="onKeyword" />
        <el-popover v-if="showCategoryPopover" v-model:visible="categoryOpen" trigger="click" placement="bottom-start" :width="280">
          <template #reference>
            <el-button data-category-trigger>{{ categoryButtonText }}</el-button>
          </template>
          <CategoryFilterTree placement="popover" :categories="store.data.categories" :selected-ids="selectedCategoryIds" @toggle="toggleCategory" @clear="clearCategory" @dock="dockCategory" @hide="hideCategory" @float="floatCategory" />
        </el-popover>
        <el-button v-else-if="categoryLayout === 'hidden' || narrowScreen" data-category-trigger @click="floatCategory">展开分类树</el-button>
        <span v-if="(categoryLayout === 'hidden' || narrowScreen) && categoryChipText" class="category-chip" data-category-chip>
          分类：{{ categoryChipText }}
          <button type="button" aria-label="清除分类" @click="clearCategory">×</button>
        </span>
        <span v-else-if="categoryLayout === 'sidebar' && categorySummary" class="category-chip" data-category-chip>
          {{ categorySummary }}
          <button type="button" @click="clearCategory">清除</button>
        </span>
        <template v-for="field in exposedFields" :key="field.field">
          <el-select v-if="field.field !== 'category' && field.kind !== 'date'" :model-value="chosen(field.field)" multiple collapse-tags clearable :placeholder="field.label" style="width: 160px" :data-exposed="field.field" @change="(value: string[]) => setExposedValue(field.field, value)">
            <el-option v-for="item in fieldOptions(field.field)" :key="item" :label="item" :value="item" />
          </el-select>
          <el-date-picker v-else :model-value="dateRange(field.field)" type="daterange" value-format="YYYY-MM-DD" start-placeholder="创建开始" end-placeholder="创建结束" style="width: 240px" :data-exposed="field.field" @update:model-value="(value: [string, string] | null) => setDate(value)" />
        </template>
        <el-button data-filter-count @click="filterOpen = true">筛选<span v-if="filterCount"> {{ filterCount }}</span></el-button>
      </div>
      <div v-if="listMode === 'spu' && familyIds.length" class="row-actions batch-actions" style="margin-bottom: 10px">
        <span data-selected-count>已选 {{ familyIds.length }} 条</span>
        <el-button :disabled="familyIds.length === 0" @click="setShelfMany('online')">批量发布</el-button>
        <el-button :disabled="familyIds.length === 0" @click="setShelfMany('offline')">批量下架</el-button>
        <el-button :disabled="familyIds.length === 0" type="danger" @click="removeMany">批量删除</el-button>
      </div>
      <div v-if="store.data.listViews.length > 1" class="row-actions" style="margin-bottom: 10px">
        <span class="muted">已存筛选</span>
        <el-tag v-for="view in store.data.listViews" :key="view.id" :type="store.data.activeViewId === view.id ? 'primary' : 'info'" style="cursor: pointer" @click="store.applyView(view.id)" @close="store.removeView(view.id)" :closable="view.id !== 'view-all'">{{ view.name }}</el-tag>
      </div>
      <p v-if="presentation.manualBlocked" class="warn">手工排序已保存。当前还有分组，请先清除分组，再按手工顺序查看。分组不会被自动改掉。</p>
      <div v-if="manualOn && pickedIds.length" class="row-actions" style="margin-bottom: 8px">
        <span data-stage-pick>待放入暂存 {{ pickedIds.length }} 条</span>
        <el-button size="small" type="primary" @click="addStage">加入排序暂存区</el-button>
      </div>
      <div v-if="manualOn && stageIds.length" class="stage-bar">
        <span>排序暂存区（{{ stageIds.length }}）</span>
        <el-button size="small" @click="stageOpen = true">展开暂存</el-button>
        <el-button size="small" @click="stageIds = []">清空暂存</el-button>
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
                <el-button size="small" @click="router.push(`/products/${row.id}`)">{{ row.line === 'v3' ? '管理物料' : '编辑整款商品' }}</el-button>
                <el-button v-if="row.line !== 'v3'" size="small" @click="router.push(`/products/${row.id}?add=1`)">新增规格</el-button>
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
                <el-table-column v-if="row.line !== 'v3'" prop="oaSkuId" label="OA_SKUID" width="140" />
                <el-table-column label="操作" width="180">
                  <template #default="{ row: sku }">
                    <el-button link type="primary" @click="router.push(`/products/${row.id}?sku=${sku.id}`)">编辑</el-button>
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
              <button class="linkish" :data-family-id="row.id" @click="router.push(`/products/${row.id}`)">{{ row.name }}</button>
              <span v-if="row.line === 'v3'" class="sku-hint">{{ materialSummary(row.id) }}</span>
              <span v-if="planSource(row)" class="sku-hint">来自规划：{{ planSource(row) }}</span>
            </template>
            <template v-else-if="col.key === 'category'">{{ categoryPath(store.data, row.categoryId) }}</template>
            <template v-else-if="col.key === 'template'">{{ templateById(store.data, row.templateId)?.name }}</template>
            <template v-else-if="col.key === 'brand'">{{ brandText(row) }}</template>
            <template v-else-if="col.key === 'skuCount'"><span :data-sku-count="realCount(row.id)">{{ skuCountText(realCount(row.id)) }}</span></template>
            <template v-else-if="col.key === 'sale'">{{ saleCount(row.id) }}</template>
            <template v-else-if="col.key === 'origin'">{{ row.origin === 'sample' ? '预设演示' : '本次新增' }}</template>
            <template v-else-if="col.key === 'updatedAt'">{{ row.updatedAt.slice(0, 16).replace('T', ' ') }}</template>
            <template v-else-if="col.key === 'productType'">{{ productTypeName(store.data, row) }}</template>
            <template v-else-if="col.key === 'model'">{{ linkedModelName(store.data, row) }}</template>
            <template v-else-if="col.key === 'shelf'">{{ shelfText(shelfOf(row)) }}</template>
            <template v-else-if="col.key === 'oaProductId'">{{ row.oaProductId || '-' }}</template>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="300" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.line === 'v3'" link type="primary" @click="router.push(compatTarget(row))">{{ compatTitle(row) }}</el-button>
            <el-button link type="primary" @click="router.push(`/products/${row.id}`)">{{ row.line === 'v3' ? '管理物料' : '编辑' }}</el-button>
            <el-button link @click="copyFamily(row.id)">复制</el-button>
            <el-button link type="danger" @click="removeFamily(row.id, row.name)">删除</el-button>
            <el-button v-if="manualOn && stageIds.length" link @click="askInsert(row.id, row.name, 'before')">插到前面</el-button>
            <el-button v-if="manualOn && stageIds.length" link @click="askInsert(row.id, row.name, 'after')">插到后面</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-table v-else v-show="!group.label || !collapsed[group.label]" class="sku-table" :data="group.skus" row-key="id">
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
              <button class="linkish" @click="router.push(`/products/${row.familyId}`)">{{ row.familyName }}</button>
            </template>
            <template v-else-if="col.key === 'category'">{{ row.category }}</template>
            <template v-else-if="col.key === 'typeName'">{{ row.typeName }}</template>
            <template v-else-if="col.key === 'status'">{{ statusText(row.status) }}</template>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="router.push(`/products/${row.familyId}?sku=${row.id}`)">商品详情</el-button>
            <el-button v-if="row.materialCount > 0" link @click="router.push(`/products/${row.familyId}`)">物料 {{ row.materialCount }} 条</el-button>
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
          <el-button link type="danger" @click="stageIds = stageIds.filter((item) => item !== id)">移除</el-button>
        </li>
      </ul>
      <el-button @click="stageIds = []">清空暂存</el-button>
    </el-drawer>
    <el-dialog v-model="filterOpen" title="筛选" width="720px">
      <div v-for="filter in activeQuery.filters" :key="filter.id" class="filter-row" :data-condition="filter.field">
        <el-select :model-value="filter.field" style="width: 140px" @change="(value: string) => changeFilterField(filter.id, value)">
          <el-option v-for="item in filterFields" :key="item.field" :label="item.label" :value="item.field" />
        </el-select>
        <el-select :model-value="filter.operator" style="width: 120px" @change="(value: string) => changeFilterOperator(filter.id, value)">
          <el-option v-for="item in operatorsFor(filter.field)" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-date-picker v-if="kindOf(filter.field) === 'date' && filter.operator === 'between'" :model-value="conditionRange(filter)" type="daterange" value-format="YYYY-MM-DD" style="width: 240px" @update:model-value="(value: [string, string] | null) => setConditionRange(filter.id, value)" />
        <el-date-picker v-else-if="kindOf(filter.field) === 'date'" :model-value="textValue(filter)" type="date" value-format="YYYY-MM-DD" @update:model-value="(value: string) => setConditionText(filter.id, value || '')" />
        <CategoryTreeSelect v-else-if="filter.field === 'category' && filter.operator === 'in'" multiple :model-value="categoryConditionIds(filter)" :categories="store.data.categories" placeholder="选择分类" style="width: 220px" @update:model-value="(value) => setConditionList(filter.id, Array.isArray(value) ? value : [])" />
        <CategoryTreeSelect v-else-if="filter.field === 'category'" :model-value="categoryConditionId(filter)" :categories="store.data.categories" placeholder="选择分类" style="width: 220px" @update:model-value="(value) => setConditionText(filter.id, typeof value === 'string' ? value : '')" />
        <el-select v-else-if="filter.operator === 'in'" :model-value="listValue(filter)" multiple collapse-tags style="width: 220px" @change="(value: string[]) => setConditionList(filter.id, value)">
          <el-option v-for="item in fieldOptions(filter.field)" :key="item" :label="item" :value="item" />
        </el-select>
        <el-select v-else-if="kindOf(filter.field) !== 'text'" :model-value="textValue(filter)" clearable filterable style="width: 220px" @change="(value: string) => setConditionText(filter.id, value || '')">
          <el-option v-for="item in fieldOptions(filter.field)" :key="item" :label="item" :value="item" />
        </el-select>
        <el-input v-else :model-value="textValue(filter)" style="width: 220px" @update:model-value="(value: string) => setConditionText(filter.id, value)" />
        <el-button link type="danger" @click="removeCondition(filter.id)">删除</el-button>
      </div>
      <el-button @click="addCondition">添加条件</el-button>
      <p class="muted">外露后显示在列表顶部。取消外露不会删掉已经生效的条件。</p>
      <el-checkbox v-for="field in filterFields" :key="field.field" :data-expose-field="field.field" :model-value="activeQuery.exposed.includes(field.field)" @change="(value: boolean | string | number) => setViewExposed(store.data, field.field, Boolean(value))">{{ field.label }}</el-checkbox>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CategoryFilterTree from '../components/CategoryFilterTree.vue'
import CategoryTreeSelect from '../components/CategoryTreeSelect.vue'
import PageHead from '../components/PageHead.vue'
import { familyBrandText, familyBrandValues, isRealSku, linkedModelName, materialArchivesOf, productTypeName, realSkusOf, savedSkuCode, savedSkuName, savedSkuSpec, skuCountText } from '../domain/productList'
import { catalogRole, compatibilityFamilyBlock, roleOfType } from '../domain/compatibility'
import { categoryPath, shelfOf, shelfText, statusText, templateById } from '../domain/logic'
import { familyMaterialDigest } from '../domain/material'
import { activeFilterCount, fieldSelection, groupFields, knownFilterFields, presentProductList, resolveCategoryFilter, sortFields, sortModeOf } from '../domain/productListQuery'
import { DEFAULT_PRODUCT_LIST_VIEW_ID, activeProductListView, copyProductListView, createProductListView, currentModeQuery, deleteProductListView, insertViewManual, moveViewManual, orderedColumns, renameProductListView, reorderProductListColumn, resetProductListColumns, selectProductListView, setProductListColumnVisible, setProductListViewMode, setViewCategoryLayout, setViewExposed, setViewFieldValues, setViewGrouping, setViewKeyword, setViewSortMode, setViewSorting, visibleColumns } from '../domain/productListViews'
import type { ProductFamily, ProductListFilterOperator, ProductListMode, ProductListViewFilter, Sku } from '../domain/types'
import { uid, useCatalogStore } from '../stores/catalog'

const store = useCatalogStore()
const router = useRouter()
const route = useRoute()
const query = store.data.listQuery
const columnOpen = ref(false)
const columnQuery = ref('')
const createOpen = ref(false)
const settingsOpen = ref(false)
const filterOpen = ref(false)
const categoryOpen = ref(false)
const narrowScreen = ref(false)
const stageOpen = ref(false)
const collapsed = reactive<Record<string, boolean>>({})
const pickedIds = ref<string[]>([])
const stageIds = ref<string[]>([])
const dragId = ref('')
const draftName = ref('')
const renameDraft = ref('')
const nameError = ref('')
const renameError = ref('')
const dragKey = ref('')
const selected = reactive<Record<string, string[]>>({})
const familyIds = ref<string[]>([])
const defaultViewId = DEFAULT_PRODUCT_LIST_VIEW_ID
const brands = computed(() => Array.from(new Set(store.data.families.flatMap((item) => familyBrandValues(store.data, item)))).sort((left, right) => left.localeCompare(right, 'zh')))
const displayViews = computed(() => store.data.productListViews || [])
const activeView = computed(() => activeProductListView(store.data))
const listMode = computed(() => activeView.value.mode)
const tableColumns = computed(() => visibleColumns(activeView.value, listMode.value))
const modeColumns = computed(() => orderedColumns(activeView.value, listMode.value))
const filteredColumns = computed(() => {
  const text = columnQuery.value.trim().toLowerCase()
  if (!text) return modeColumns.value
  return modeColumns.value.filter((item) => item.label.toLowerCase().includes(text) || item.key.toLowerCase().includes(text))
})
const activeQuery = computed(() => currentModeQuery(activeView.value))
const presentation = computed(() => presentProductList(store.data, activeView.value, query.page, query.pageSize))
const shownGroups = computed(() => presentation.value.groups.map((group) => ({
  key: group.key,
  label: group.label,
  total: group.total,
  families: group.rows.map((row) => row.family),
  skus: group.rows.flatMap((row) => row.sku ? [{
    id: row.id,
    familyId: row.family.id,
    code: savedSkuCode(row.sku),
    name: savedSkuName(row.sku),
    spec: savedSkuSpec(row.family, row.sku),
    familyName: row.family.name,
    category: categoryPath(store.data, row.family.categoryId),
    typeName: productTypeName(store.data, row.family),
    modelName: linkedModelName(store.data, row.family),
    status: row.sku.status,
    materialCount: materialArchivesOf(store.data, row.family.id).length,
  }] : []),
})))
const activeTotal = computed(() => presentation.value.total)
const filterCount = computed(() => activeFilterCount(activeView.value))
const filterFields = computed(() => knownFilterFields(store.data, listMode.value))
const exposedFields = computed(() => activeQuery.value.exposed.flatMap((field) => {
  const found = filterFields.value.find((item) => item.field === field)
  return found ? [found] : []
}))
const groupOptions = computed(() => groupFields(store.data, listMode.value))
const sortOptions = computed(() => sortFields(listMode.value))
const sortMode = computed(() => sortModeOf(activeQuery.value))
const manualOn = computed(() => sortMode.value === 'manual' && !activeQuery.value.grouping)
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
const categoryLayout = computed(() => activeView.value.categoryFilterLayout === 'sidebar' || activeView.value.categoryFilterLayout === 'hidden' ? activeView.value.categoryFilterLayout : 'popover')
const showSidebar = computed(() => categoryLayout.value === 'sidebar' && !narrowScreen.value)
const showCategoryPopover = computed(() => categoryLayout.value === 'popover' && !narrowScreen.value)
const categoryState = computed(() => resolveCategoryFilter(store.data, chosen('category')))
const selectedCategoryIds = computed(() => categoryState.value.ids)
const categorySummary = computed(() => {
  const names = selectedCategoryIds.value.map((id) => categoryPath(store.data, id)).filter(Boolean)
  const missing = categoryState.value.missing.length ? [`分类已不存在 ${categoryState.value.missing.length} 个`] : []
  return [...names, ...missing].join('、')
})
const categoryChipText = computed(() => {
  const names = selectedCategoryIds.value.map((id) => store.data.categories.find((item) => item.id === id)?.name || '').filter(Boolean)
  const missing = categoryState.value.missing.length ? ['分类已不存在'] : []
  return [...names, ...missing].join('、')
})
const categoryButtonText = computed(() => (categorySummary.value ? `商品分类：${categorySummary.value}` : '商品分类：全部分类'))
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
async function confirmStage() {
  if (!stageIds.value.length) return true
  try {
    await ElMessageBox.confirm('还有未提交的排序暂存。继续后会清空暂存，已经保存的手工顺序不受影响。', '清空暂存')
    stageIds.value = []
    pickedIds.value = []
    return true
  } catch {
    return false
  }
}
async function switchDisplayView(id: string) {
  if (id === activeView.value.id) return
  if (!(await confirmStage())) return
  if (!warn(selectProductListView(store.data, id))) return
  query.page = 1
}
async function setListMode(next: string | number | boolean) {
  if (next !== 'spu' && next !== 'sku') return
  const mode = next as ProductListMode
  if (activeView.value.mode === mode) return
  if (!(await confirmStage())) return
  if (!warn(setProductListViewMode(store.data, activeView.value.id, mode))) return
  query.page = 1
}
function onKeyword(value: string) {
  setViewKeyword(store.data, value)
}
function chosen(field: string) {
  return fieldSelection(activeQuery.value, field)
}
function setExposedValue(field: string, values: string[]) {
  setViewFieldValues(store.data, field, values)
}
function toggleCategory(id: string) {
  const next = selectedCategoryIds.value.includes(id) ? selectedCategoryIds.value.filter((item) => item !== id) : [...selectedCategoryIds.value, id]
  setViewFieldValues(store.data, 'category', next)
}
function clearCategory() {
  setViewFieldValues(store.data, 'category', [])
}
function dockCategory() {
  setViewCategoryLayout(store.data, 'sidebar')
  categoryOpen.value = false
}
function floatCategory() {
  setViewCategoryLayout(store.data, 'popover')
  categoryOpen.value = true
}
function hideCategory() {
  setViewCategoryLayout(store.data, 'hidden')
  categoryOpen.value = false
}
function syncNarrow() {
  narrowScreen.value = window.innerWidth < 960
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
  const kind = kindOf(field)
  if (kind === 'date') return [{ value: 'before', label: '早于' }, { value: 'after', label: '晚于' }, { value: 'between', label: '日期范围' }]
  if (kind === 'text') return [{ value: 'contains', label: '包含' }, { value: 'notContains', label: '不包含' }, { value: 'eq', label: '等于' }, { value: 'neq', label: '不等于' }]
  return [{ value: 'eq', label: '等于' }, { value: 'neq', label: '不等于' }, { value: 'in', label: '属于任一' }]
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
  query.page = 1
}
function addCondition() {
  const field = filterFields.value[0]
  if (!field) return
  const operator = operatorsFor(field.field)[0].value as ProductListFilterOperator
  liveQuery().filters.push({ id: `f-${Date.now()}`, field: field.field, operator, value: operator === 'between' ? { from: '', to: '' } : operator === 'in' ? [] : '' })
  touchFilters()
}
function changeFilterField(id: string, field: string) {
  const filter = liveQuery().filters.find((item) => item.id === id)
  if (!filter) return
  filter.field = field
  filter.operator = operatorsFor(field)[0].value as ProductListFilterOperator
  filter.value = filter.operator === 'between' ? { from: '', to: '' } : filter.operator === 'in' ? [] : ''
  touchFilters()
}
function changeFilterOperator(id: string, operator: string) {
  const filter = liveQuery().filters.find((item) => item.id === id)
  if (!filter) return
  filter.operator = operator as ProductListFilterOperator
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
function listValue(filter: ProductListViewFilter) {
  return Array.isArray(filter.value) ? filter.value : []
}
function conditionRange(filter: ProductListViewFilter): [string, string] | null {
  if (!filter.value || typeof filter.value !== 'object' || Array.isArray(filter.value)) return null
  if (!filter.value.from && !filter.value.to) return null
  return [filter.value.from || '', filter.value.to || '']
}
function setConditionText(id: string, value: string) {
  const filter = liveQuery().filters.find((item) => item.id === id)
  if (!filter) return
  filter.value = value
  touchFilters()
}
function setConditionList(id: string, value: string[]) {
  const filter = liveQuery().filters.find((item) => item.id === id)
  if (!filter) return
  filter.value = value
  touchFilters()
}
function setConditionRange(id: string, value: [string, string] | null) {
  const filter = liveQuery().filters.find((item) => item.id === id)
  if (!filter) return
  filter.value = { from: value?.[0] || '', to: value?.[1] || '' }
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
  const queryState = liveQuery()
  const rest = queryState.filters.filter((item) => item.field !== 'created')
  queryState.filters = value ? [...rest, { id: 'f-created', field: 'created', operator: 'between', value: { from: value[0], to: value[1] } }] : rest
  touchFilters()
}
function toggleGroup(label: string) {
  collapsed[label] = !collapsed[label]
}
function onGroupField(field: string) {
  const direction = activeQuery.value.grouping?.direction || 'asc'
  setViewGrouping(store.data, field ? { field, direction } : null)
}
function onGroupDirection(direction: string | number | boolean) {
  const field = activeQuery.value.grouping?.field
  if (!field || (direction !== 'asc' && direction !== 'desc')) return
  setViewGrouping(store.data, { field, direction })
}
function clearGroup() {
  setViewGrouping(store.data, null)
}
function onSortField(field: string) {
  const direction = activeQuery.value.sorting?.direction || 'asc'
  setViewSorting(store.data, field ? { field, direction } : null)
}
function onSortDirection(direction: string | number | boolean) {
  const field = activeQuery.value.sorting?.field
  if (!field || (direction !== 'asc' && direction !== 'desc')) return
  setViewSorting(store.data, { field, direction })
}
function clearSort() {
  setViewSorting(store.data, null)
}
function onSortMode(mode: string | number | boolean) {
  if (mode !== 'default' && mode !== 'field' && mode !== 'manual') return
  const result = setViewSortMode(store.data, mode)
  if (!result.ok) ElMessage.warning(result.message)
}
function onRowDrag(id: string) {
  dragId.value = id
}
function onRowDrop(id: string) {
  if (!dragId.value) return
  const result = moveViewManual(store.data, dragId.value, id, 'before')
  dragId.value = ''
  if (!result.ok) ElMessage.warning(result.message)
}
function togglePick(id: string, checked: boolean) {
  pickedIds.value = checked ? [...pickedIds.value, id] : pickedIds.value.filter((item) => item !== id)
}
function addStage() {
  const next = [...stageIds.value]
  pickedIds.value.forEach((id) => {
    if (!next.includes(id)) next.push(id)
  })
  stageIds.value = next
  pickedIds.value = []
  ElMessage.success(`排序暂存区现有 ${next.length} 条`)
}
function stageLabel(id: string) {
  if (listMode.value === 'sku') {
    const sku = store.data.skus.find((item) => item.id === id)
    return sku ? savedSkuName(sku) : id
  }
  return store.data.families.find((item) => item.id === id)?.name || id
}
async function askInsert(id: string, name: string, place: 'before' | 'after') {
  const where = place === 'before' ? '之前' : '之后'
  try {
    await ElMessageBox.confirm(`把暂存的 ${stageIds.value.length} 条插入「${name}」${where}？`, '确认插入')
  } catch {
    return
  }
  const result = insertViewManual(store.data, stageIds.value, id, place)
  if (!result.ok) {
    ElMessage.warning(result.message)
    return
  }
  stageIds.value = []
  const hidden = activeFilterCount(activeView.value) > 0 ? '当前筛选下可能看不到全部记录。' : ''
  ElMessage.success(`展示顺序已更新。${hidden}`)
}
function toggleColumn(key: string, visible: boolean) {
  warn(setProductListColumnVisible(store.data, activeView.value.id, listMode.value, key, visible))
}
function onDragStart(key: string) {
  dragKey.value = key
}
function onDrop(key: string) {
  if (!dragKey.value || columnQuery.value.trim()) return
  warn(reorderProductListColumn(store.data, activeView.value.id, listMode.value, dragKey.value, key))
  dragKey.value = ''
}
function resetColumns() {
  if (!warn(resetProductListColumns(store.data, activeView.value.id, listMode.value, store.defaultColumns()))) return
  ElMessage.success('已恢复当前模式的默认列')
}
function openCreate() {
  draftName.value = ''
  nameError.value = ''
  createOpen.value = true
}
function confirmCreate() {
  const result = createProductListView(store.data, draftName.value, activeView.value.id, () => uid('view'))
  if (!result.ok) {
    nameError.value = result.message
    return
  }
  createOpen.value = false
  query.page = 1
  ElMessage.success('视图已创建')
}
function openSettings() {
  renameDraft.value = activeView.value.name
  renameError.value = ''
  settingsOpen.value = true
}
function confirmRename() {
  const result = renameProductListView(store.data, activeView.value.id, renameDraft.value)
  if (!result.ok) {
    renameError.value = result.message
    return
  }
  ElMessage.success('名称已保存')
}
function confirmCopy() {
  const result = copyProductListView(store.data, activeView.value.id, () => uid('view'))
  if (!warn(result)) return
  settingsOpen.value = false
  query.page = 1
  ElMessage.success('已复制为独立视图')
}
async function confirmDelete() {
  await ElMessageBox.confirm(`删除视图「${activeView.value.name}」？商品不会被删除。`, '删除视图')
  const result = deleteProductListView(store.data, activeView.value.id)
  if (!warn(result)) return
  settingsOpen.value = false
  query.page = 1
  ElMessage.success('视图已删除')
}
function saveFilter() {
  store.saveView(`筛选${store.data.listViews.length}`)
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
  router.push(`/products/new?from=${id}`)
}
async function removeFamily(id: string, name: string) {
  const family = store.data.families.find((item) => item.id === id)
  if (family && shelfOf(family) === 'online') {
    ElMessage.warning('已发布的商品不能直接删除，请先下架。')
    return
  }
  await ElMessageBox.confirm(`删除「${name}」和它下面的全部规格？`, '删除商品')
  const blocked = store.removeFamily(id)
  if (blocked) {
    ElMessage.warning(blocked)
    return
  }
  ElMessage.success('已删除')
}
function onFamilySelect(rows: ProductFamily[]) {
  familyIds.value = rows.map((item) => item.id)
}
function setShelfMany(status: 'online' | 'offline') {
  familyIds.value.forEach((id) => {
    const family = store.data.families.find((item) => item.id === id)
    if (!family) return
    family.shelfStatus = status
    if (status === 'online') family.lifecycle = 'ready'
  })
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
  await ElMessageBox.confirm(`删除选中的 ${familyIds.value.length} 款商品和它们的规格？`, '批量删除')
  const blocked = familyIds.value.map((id) => compatibilityFamilyBlock(store.data, id)).find(Boolean)
  if (blocked) {
    ElMessage.warning(blocked)
    return
  }
  familyIds.value.forEach((id) => store.removeFamily(id))
  familyIds.value = []
  ElMessage.success('已删除')
}
async function removeSku(id: string) {
  await ElMessageBox.confirm('删除这条规格。如果这是最后一条，整款商品也会去掉。', '删除规格')
  const blocked = store.removeSku(id)
  if (blocked) ElMessage.warning(blocked)
}
function copySku(familyId: string, skuId: string) {
  router.push(`/products/${familyId}?copySku=${skuId}`)
}
function onSelect(familyId: string, rows: Sku[]) {
  selected[familyId] = rows.map((item) => item.id)
}
function batchStatus(familyId: string, status: Sku['status']) {
  store.setSkuStatus(selected[familyId] || [], status)
  ElMessage.success('状态已更新')
}

watch(presentation, () => {
  if (query.page !== presentation.value.page) query.page = presentation.value.page
}, { immediate: true })
onMounted(() => {
  if (route.query.panel === 'columns') columnOpen.value = true
  syncNarrow()
  window.addEventListener('resize', syncNarrow)
})
onBeforeUnmount(() => window.removeEventListener('resize', syncNarrow))
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
.category-chip { display: inline-flex; align-items: center; gap: 6px; }
.category-chip button { border: 0; background: transparent; color: var(--el-color-primary); cursor: pointer; }
.list-switch { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.filters { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.view-tools { display: flex; flex-direction: column; gap: 8px; max-height: 70vh; overflow: auto; }
.tool-label { margin: 4px 0 0; color: #607089; font-size: 12px; }
.tool-links { display: flex; flex-wrap: wrap; gap: 8px; }
.tool-state { color: #1f3b66; font-size: 13px; }
.batch-actions { padding-top: 4px; border-top: 1px solid #e5e7eb; }
.view-current { display: inline-block; max-width: 140px; overflow: hidden; text-overflow: ellipsis; vertical-align: bottom; white-space: nowrap; }
.view-mode { margin-left: 6px; }
.column-panel { display: flex; flex-direction: column; gap: 8px; }
.column-list { list-style: none; margin: 0; padding: 0; max-height: 320px; overflow: auto; }
.column-list li { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
.drag-handle { cursor: grab; color: var(--text-secondary, #607089); user-select: none; }
.stage-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.sku-expand { padding: 0 12px 8px; }
.group-head { display: block; width: 100%; margin: 8px 0 4px; padding: 8px 10px; border: 0; border-radius: 6px; background: var(--surface-muted, #f4f7fb); color: inherit; text-align: left; cursor: pointer; }
.filter-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
.warn { color: var(--el-color-danger); font-size: 13px; }
</style>
