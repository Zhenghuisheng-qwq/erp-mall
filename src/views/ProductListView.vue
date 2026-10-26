<template>
  <div>
    <PageHead :title="mode === 'spu' ? 'SPU 管理' : 'SKU 管理'" :desc="mode === 'spu' ? '维护商品主体，查看和追加其下 SKU。' : '独立管理真实规格商品；物料档案在物料管理中维护。'">
      <el-button @click="router.push(mode === 'spu' ? '/skus' : '/spus')">{{ mode === 'spu' ? 'SKU 管理' : 'SPU 管理' }}</el-button>
      <el-button v-if="mode === 'spu'" @click="router.push('/materials/new')" :disabled="!(store.can('product:material:create'))">物料建档</el-button>
      <el-button type="primary" @click="router.push(mode === 'spu' ? '/spus/new' : { path: '/skus/new', query: scopeId ? { spu: scopeId } : {} })" :disabled="!(store.can(mode === 'spu' ? 'product:spu:create' : 'product:sku:create'))">{{ mode === 'spu' ? '新建 SPU' : '新增 SKU' }}</el-button>
    </PageHead>
    <div v-if="scopeId" class="panel" style="margin-bottom: 12px" data-spu-scope>
      当前查看：{{ scopeFamily?.name || '已删除的 SPU' }} 的 SKU
      <el-button v-if="scopeFamily" link type="primary" @click="router.push(`/spus/${scopeId}`)">查看 SPU</el-button>
      <el-button @click="router.push('/skus')">查看全部 SKU</el-button>
      <p class="muted">当前为临时范围，筛选和视图调整不会覆盖全部 SKU 的保存设置。</p>
    </div>
    <div class="spu-view-tabs" :data-mode="listMode" :data-view-id="activeView.id">
      <ProductListViewTabs :views="displayViews" :active-id="activeView.id" :busy="manualBusy" :can-create="canSaveView" @select="switchDisplayView" @create="openCreate">
        <template #actions><span :class="['view-save-state',{failed:!!saveError}]" data-view-save-state>{{saveStatus}}</span><el-button v-if="saveError || manualSaveError" link type="danger" @click="retryPageSave">重试保存</el-button><el-dropdown trigger="click"><el-button :disabled="pageSaving || manualBusy" data-view-management>视图管理</el-button><template #dropdown><el-dropdown-menu><el-dropdown-item :disabled="!canSaveView" @click="openCreate">新建视图</el-dropdown-item><el-dropdown-item :disabled="!canSaveView" @click="openSettings">当前视图设置</el-dropdown-item><el-dropdown-item :disabled="!canSaveView" @click="confirmCopy">复制当前视图</el-dropdown-item><el-dropdown-item :disabled="!canSaveView" @click="saveFilter">保存当前筛选预设</el-dropdown-item><el-dropdown-item @click="router.push('/import')">导入导出</el-dropdown-item></el-dropdown-menu></template></el-dropdown></template>
      </ProductListViewTabs><p v-if="saveError || manualSaveError" class="warn" role="status">{{saveError || manualSaveError}} 当前输入与排序暂存已保留。</p>
    </div>
    <div class="panel" :class="{ 'is-category-side': showSidebar }" :data-category-layout="categoryLayout">
      <aside v-if="showSidebar" class="category-side" data-category-side>
        <div class="category-side-head"><strong>商品分类</strong><el-button link @click="closeSidebar">收起分类栏</el-button></div>
        <template v-if="!categoryQuick.simple"><p class="muted">分类使用高级条件，请在更多筛选中管理。</p><el-button @click="filterOpen = true">管理分类条件</el-button><el-button @click="clearCategory">清除分类</el-button></template>
        <CategoryFilterTree v-else :categories="store.data.categories" :selected-ids="selectedCategoryIds" :key="`ProductListView.vue:${activeView.id}:${scopeId}`" :state-key="`ProductListView.vue:${activeView.id}:${scopeId}`" @toggle="toggleCategory" @clear="clearCategory" />
      </aside>
      <div class="list-main">
      <div class="list-toolbar"><div class="filters">
        <el-select v-if="mode === 'sku'" :model-value="scopeId" filterable clearable placeholder="筛选所属 SPU" style="width: 220px" data-list-spu @change="(id: string) => router.push({ path: '/skus', query: id ? { spu: id } : {} })"><el-option v-for="item in store.data.families" :key="item.id" :value="item.id" :label="`${item.name} · ${item.oaProductId || item.id}`" /></el-select>
        <el-input :model-value="activeQuery.keyword" placeholder="名称、分类、属性、SKU、OA 编号" clearable style="width: 260px" data-filter="keyword" @update:model-value="onKeyword" />
        <el-button v-if="!showSidebar" data-category-trigger :title="categoryCaption.title" :class="{'is-filter-active':categoryCaption.active}" :aria-expanded="categoryOpen" @click="openCategory"><span class="category-caption">{{categoryCaption.label}}</span></el-button>
        <el-button data-filter-count :class="{'is-filter-active':filterCount>0}" @click="filterOpen = true">筛选<span v-if="filterCount"> {{ filterCount }}</span></el-button>
      </div>
      <div class="list-configuration">
        <el-button data-group-control @click="openToolsSection('group')">{{groupStatusLabel?`分组：${groupStatusLabel}`:'分组'}}</el-button><el-button data-sort-control @click="openToolsSection('sort')">{{sortStatusLabel?`排序：${sortStatusLabel}`:'排序'}}</el-button>
        <ProductListViewTools v-model:visible="columnOpen" :section="toolsSection" @open="toolsSection='columns'" :category-sidebar="categoryLayout === 'sidebar'" @category-sidebar="setCategorySidebar" :columns="modeColumns" :group-options="groupOptions" :sort-options="sortOptions" :grouping="activeQuery.grouping" :sorting="activeQuery.sorting" :sort-mode="sortMode" @column-visible="toggleColumn" @column-move="moveColumn" @reset-columns="resetColumns" @group-change="setViewGrouping(listData,$event)" @sort-change="setViewSorting(listData,$event)" @sort-mode="onSortMode" @manage="manageView"/>
        <span class="muted" data-result-count>{{listMode==='spu'?`商品 ${presentation.total} 款`:`SKU ${presentation.total} 条`}}</span>
      </div>
      </div>
      <ProductListExposedFilters ref="exposedFiltersRef" :key="`${activeView.id}:${scopeId}:${store.activeUserId}:${store.previewUserId}`" :fields="filterFields" :error="saveError" @retry="retryPageSave" @pin="field=>setViewExposed(listData,field,true)" @move="moveExposed" :rows="exposedRows" :busy="manualBusy" @value="setExposedTypedValue" @clear="clearExposedField" @clear-all="clearExposedValues" @unexpose="unexposeField" @unexpose-all="unexposeAll" @advanced="filterOpen=true"/>
      <div v-if="summaries.length" class="active-filters" data-active-filters aria-label="已生效筛选">
        <span class="muted">已筛选（条件同时满足）：</span>
        <el-tag v-for="item in summaries" :key="item.id" closable :data-filter-summary="item.id" @close="removeSummary(item.id)">{{ item.label }}</el-tag>
        <el-button link type="primary" @click="clearFilters">清空筛选</el-button>
      </div>
      <div v-if="listMode === 'spu' && familyIds.length" class="row-actions batch-actions" style="margin-bottom: 10px">
        <span data-selected-count>已选 {{ familyIds.length }} 条</span>
        <el-button :disabled="(familyIds.length === 0) || !(store.can('product:spu:update'))" @click="setShelfMany('online')">批量发布</el-button>
        <el-button :disabled="(familyIds.length === 0) || !(store.can('product:spu:update'))" @click="setShelfMany('offline')">批量下架</el-button>
        <el-button :disabled="(familyIds.length === 0) || !(store.can('product:spu:delete'))" type="danger" @click="removeMany">批量删除</el-button>
      </div>
      <div v-if="mode === 'sku' && skuIds.length" class="row-actions" style="margin-bottom: 10px">
        <span>已选 {{ skuIds.length }} 条</span><el-button @click="store.setSkuStatus(skuIds, 'on_sale')" :disabled="!(store.can('product:sku:update'))">批量在售</el-button><el-button @click="store.setSkuStatus(skuIds, 'off_sale')" :disabled="!(store.can('product:sku:update'))">批量停售</el-button><el-button type="danger" @click="removeSkuMany" :disabled="!(store.can('product:sku:delete'))">批量删除</el-button>
      </div>
      <div v-if="listData.listViews.length > 1" class="row-actions" style="margin-bottom: 10px">
        <span class="muted">筛选预设（仅替换筛选条件）</span>
        <el-tag v-for="view in listData.listViews" :key="view.id" :type="listData.activeViewId === view.id ? 'primary' : 'info'" style="cursor: pointer" @click="applyPreset(view.id)" @close="removePreset(view.id)" :closable="view.id !== 'view-all'">{{ view.name }}</el-tag>
      </div>
      <p v-if="presentation.errors.length" class="warn">{{presentation.errors.join('；')}}</p><p v-if="manualOn" class="manual-scope">手工排序范围：{{manualScopeLabel}}。仅调整完整匹配结果内同组记录，不按当前页局限排序。</p><p v-if="manualOn&&dropMessage" class="warn" data-manual-drop-error>{{dropMessage}}</p><p v-if="stageIds.length && !stageContextValid" class="warn" data-stage-context-error>范围已变化，暂存内容保留；请重新核对并暂存，不会自动只提交仍可见部分。</p>
      <div v-if="manualOn && pickedIds.length" class="row-actions" style="margin-bottom: 8px">
        <span data-stage-pick>待放入暂存 {{ pickedIds.length }} 条</span>
        <el-button size="small" type="primary" @click="addStage" :disabled="!(store.can('product:view:update'))">加入排序暂存区</el-button>
      </div>
      <div v-if="manualOn && stageIds.length" class="stage-bar">
        <span>排序暂存区（{{ stageIds.length }}） · {{stageGroupLabel}}</span>
        <el-button size="small" @click="stageOpen = true">展开暂存</el-button>
        <el-button size="small" @click="clearStage" :disabled="!(store.can('product:view:update'))">清空暂存</el-button>
      </div>
      <template v-for="group in shownGroups" :key="group.key">
      <button v-if="group.label" type="button" class="group-head" :data-group-key="group.key" @click="toggleGroup(group.key)">{{ collapsed[group.key] ? '展开' : '收起' }} {{ group.label }}（{{ group.total }}）</button>
      <el-table v-if="listMode === 'spu'" v-show="!group.label || !collapsed[group.key]" class="spu-table" :data="group.families" row-key="id" :row-class-name="manualRowClass" @dragover="onTableDragOver" @drop="onTableDrop" @selection-change="onFamilySelect">
        <template #empty><span data-empty="spu">{{ spuEmpty }}</span></template>
        <el-table-column v-if="manualOn" width="46">
          <template #default="{ row }"><button type="button" class="drag-handle" draggable="true" :disabled="manualBusy || !canSaveView" :data-drag-id="row.id" :aria-label="`拖动排序 ${row.name}`" @dragstart="onRowDrag(row.id,$event)" @dragend="endDrag">☰</button></template>
        </el-table-column>
        <el-table-column v-if="manualOn" width="42">
          <template #default="{ row }"><el-checkbox :disabled="manualBusy || !canSaveView" :data-pick-id="row.id" :model-value="pickedIds.includes(row.id)" @change="(value: boolean | string | number) => togglePick(row.id, Boolean(value))" /></template>
        </el-table-column>
        <el-table-column type="selection" width="42" />
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="sku-expand" :data-family-id="row.id">
              <div class="row-actions" style="margin-bottom: 8px">
                <el-button size="small" @click="router.push(`/spus/${row.id}`)">编辑 SPU</el-button>
                <el-button size="small" @click="router.push({ path: '/skus/new', query: { spu: row.id } })" :disabled="!(store.can('product:sku:create'))">新增 SKU</el-button>
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
                    <el-select :model-value="sku.status" size="small" @change="(value: string) => store.patchSku(sku.id, { status: value as Sku['status'] })" :disabled="!(store.can('product:sku:update'))">
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
                    <el-button link type="danger" @click="removeSku(sku.id)" :disabled="!(store.can('product:sku:delete'))">删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </template>
        </el-table-column>
        <el-table-column v-for="col in tableColumns" :key="col.key" :prop="col.key" :label="col.label" :width="col.width ?? fixedListWidth(col.key)" :min-width="col.width === undefined ? contentListWidth(col.key) : undefined" :fixed="col.frozen || false" :align="['skuCount','sale'].includes(col.key) ? 'right' : 'left'">
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
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="router.push(`/spus/${row.id}`)">编辑</el-button>
            <el-button link @click="router.push({ path: '/skus/new', query: { spu: row.id } })" :disabled="!(store.can('product:sku:create'))">新增 SKU</el-button>
            <el-dropdown trigger="click"><el-button link :data-spu-more="row.id" :aria-label="`更多 SPU 操作 ${row.name}`">更多</el-button><template #dropdown><el-dropdown-menu>
            <el-dropdown-item v-if="compatibilityFamilyRole(store.data, row.id) === 'host' && realCount(row.id)" :data-spu-compatibility="row.id" @click.stop="openCompatibilityFamily(row.id)">适用配件</el-dropdown-item>
            <el-dropdown-item v-else-if="row.line === 'v3'" @click="router.push(compatTarget(row))" :disabled="!(store.can('product:compatibility:read'))">{{ compatTitle(row) }}</el-dropdown-item>
            <el-dropdown-item v-if="row.line === 'v3'" @click="router.push(`/materials/${row.id}`)" :disabled="!(store.can('product:material:read'))">管理物料</el-dropdown-item>
            <el-dropdown-item @click="copyFamily(row.id)" :disabled="!(store.can('product:spu:create'))">复制 SPU</el-dropdown-item>
            <el-dropdown-item @click="removeFamily(row.id, row.name)" :disabled="!(store.can('product:spu:delete'))">删除</el-dropdown-item>
            <el-dropdown-item v-if="manualOn && stageIds.length" @click="askInsert(row.id, row.name, 'before')" :disabled="!(store.can('product:view:update'))">插到前面</el-dropdown-item>
            <el-dropdown-item v-if="manualOn && stageIds.length" @click="askInsert(row.id, row.name, 'after')" :disabled="!(store.can('product:view:update'))">插到后面</el-dropdown-item>
            <el-dropdown-item v-if="manualOn" :disabled="!canSaveView || manualBusy" @click="askBoundary('top',[row.id])">移到{{activeQuery.grouping?'当前分组':'当前匹配范围'}}顶部</el-dropdown-item><el-dropdown-item v-if="manualOn" :disabled="!canSaveView || manualBusy" @click="askBoundary('bottom',[row.id])">移到{{activeQuery.grouping?'当前分组':'当前匹配范围'}}底部</el-dropdown-item>
            </el-dropdown-menu></template></el-dropdown>
          </template>
        </el-table-column>
      </el-table>
      <el-table v-else v-show="!group.label || !collapsed[group.key]" class="sku-table" :data="group.skus" row-key="id" @selection-change="(rows: { id: string }[]) => onSkuSelect(group.key, rows)">
        <el-table-column type="selection" width="42" reserve-selection />
        <template #empty><span data-empty="sku">{{ skuEmpty }}</span></template>
        <el-table-column v-if="manualOn" width="46">
          <template #default="{ row }"><button type="button" class="drag-handle" draggable="true" :disabled="manualBusy || !canSaveView" :data-drag-id="row.id" :aria-label="`拖动排序 ${row.name}`" @dragstart="onRowDrag(row.id,$event)" @dragend="endDrag">☰</button></template>
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
            <template v-else-if="col.key === 'status'"><el-select :model-value="row.status" size="small" @change="(status: Sku['status']) => store.patchSku(row.id, { status })" :disabled="!(store.can('product:sku:update'))"><el-option label="草稿" value="draft" /><el-option label="在售" value="on_sale" /><el-option label="停售" value="off_sale" /></el-select></template>
            <template v-else-if="col.key === 'updatedAt'">{{ row.updatedAt || '—' }}</template>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="router.push({ path: `/skus/${row.id}`, query: scopeId ? { spu: scopeId } : {} })">编辑 SKU</el-button>
            <el-button link type="danger" @click="removeSku(row.id)" :disabled="!(store.can('product:sku:delete'))">删除</el-button>
            <el-button v-if="manualOn && stageIds.length" link @click="askInsert(row.id, row.name, 'before')" :disabled="!(store.can('product:view:update'))">插到前面</el-button>
            <el-button v-if="manualOn && stageIds.length" link @click="askInsert(row.id, row.name, 'after')" :disabled="!(store.can('product:view:update'))">插到后面</el-button>
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
        <el-button @click="confirmCopy" :disabled="!(store.can('product:view:update'))">复制</el-button>
        <el-button type="danger" :disabled="activeView.id === defaultViewId" @click="confirmDelete">删除</el-button>
      </div>
      <p v-if="activeView.id === defaultViewId" class="muted">默认视图不能删除，可以调整它的列。</p>
    </el-dialog>
    <el-drawer v-model="stageOpen" title="排序暂存区" size="360px">
      <p class="muted">共 {{ stageIds.length }} 条 · {{stageGroupLabel}}。插入或移到同组边界，保存成功后才清理暂存。</p><p v-if="!stageContextValid" class="warn">暂存范围已失效，原内容保留。</p><div class="row-actions"><el-button :disabled="!stageContextValid || manualBusy || !canSaveView" @click="askBoundary('top')">移到范围顶部</el-button><el-button :disabled="!stageContextValid || manualBusy || !canSaveView" @click="askBoundary('bottom')">移到范围底部</el-button></div>
      <ul class="column-list">
        <li v-for="id in stageIds" :key="id">
          <span>{{ stageLabel(id) }}<small class="stage-path">{{groupLabelForId(id)}}</small></span>
          <el-button link type="danger" @click="removeStaged(id)">移除</el-button>
        </li>
      </ul>
      <el-button @click="clearStage" :disabled="!(store.can('product:view:update'))">清空暂存</el-button>
    </el-drawer>
    <el-drawer v-if="narrowScreen" v-model="categoryOpen" title="商品分类" size="min(340px,96vw)"><template v-if="!categoryQuick.simple"><p>分类使用复杂条件，请到更多筛选管理。</p><el-button @click="categoryOpen=false;filterOpen=true">管理分类条件</el-button></template><CategoryFilterTree v-else :categories="store.data.categories" :selected-ids="selectedCategoryIds" :key="`ProductListView.vue:${activeView.id}:${scopeId}`" :state-key="`ProductListView.vue:${activeView.id}:${scopeId}`" @toggle="toggleCategory" @clear="clearCategory"/></el-drawer>
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
import { categoryFilterCaption } from '../domain/categoryTree'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useProductListPageDraft } from '../components/product-list/useProductListPageDraft'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import CategoryFilterTree from '../components/CategoryFilterTree.vue'
import ProductListFilterDialog from '../components/product-list/ProductListFilterDialog.vue'
import AccessoryCompatibilityDrawer from '../components/compatibility/AccessoryCompatibilityDrawer.vue'
import { compatibilityFamilyRole } from '../domain/deviceResolution'
import { conditionRange, filterOperators, filterSummaries, quickFilterState, type FilterEditorRow, type FilterField } from '../components/product-list/filterPresentation'
import PageHead from '../components/PageHead.vue'
import ProductListViewTools from '../components/product-list/ProductListViewTools.vue'
import ProductListViewTabs from '../components/product-list/ProductListViewTabs.vue'
import ProductListExposedFilters from '../components/product-list/ProductListExposedFilters.vue'
import {planScopedManualOrder,resolveManualOrder} from '../domain/productListManual'
import type {ListManualGuard} from '../domain/listManualCommit'
import { useProductListManualOrder } from '../components/product-list/useProductListManualOrder'
import { useProductListCategoryLayout } from '../components/product-list/useProductListCategoryLayout'
import { presentTableGroups } from '../components/product-list/tablePresentation'
import { familyBrandText, familyBrandValues, isRealSku, linkedModelName, materialArchivesOf, productTypeName, realSkusOf, savedSkuCode, savedSkuName, savedSkuSpec, skuCountText } from '../domain/productList'
import { catalogRole, compatibilitySkuBlock, roleOfType } from '../domain/compatibility'
import { categoryPath, shelfOf, shelfText, templateById } from '../domain/logic'
import { materialPlanningIds } from '../domain/materialRelations'
import { fixedListWidth, contentListWidth } from '../components/product-list/columnPresentation'
import { emptyModeQuery, groupFields, knownFilterFields, presentProductList, resolveCategoryFilter, sortFields, sortModeOf, unfilteredIds, clearProductListFilterValue, setProductListFilterValue, productCategorySelection, updateProductCategorySelection } from '../domain/productListQuery'
import { DEFAULT_PRODUCT_LIST_VIEW_ID, activeProductListView, copyProductListView, createProductListView, currentModeQuery, deleteProductListView, orderedColumns, renameProductListView, reorderProductListColumn, resetProductListColumns, selectProductListView, setProductListColumnVisible, applyPresetToActiveView, setViewCategoryLayout, setViewExposed, setViewGrouping, setViewKeyword, setViewSortMode, setViewSorting } from '../domain/productListViews'
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
const clonePage = (value: ProductListPageState): ProductListPageState => JSON.parse(JSON.stringify(value))
const pagePersistence = useProductListPageDraft(mode, temporary)
const { pageDraft, pageSaving, saveError, canSaveView, persistPage } = pagePersistence
const manualSaveError = ref('')
let pendingManualRetry: {ids:string[];targetId?:string;place:'before'|'after'|'top'|'bottom';context:string}|undefined
const listData = computed(() => productListPageData(store.data, mode, temporary.value || pageDraft.value))
const saveStatus = computed(() => manualSaveError.value ? '保存失败 · 排序暂存已保留' : pagePersistence.saveStatus.value)
async function retryPageSave() {
  if (!await pagePersistence.retryPageSave()) return
  const pending = pendingManualRetry
  if (!pending) return
  if (pending.context !== manualContext()) { manualSaveError.value = '排序范围已变化，请重新选择目标；暂存仍保留。'; return }
  const result = await commitManual(pending.ids, pending.targetId, pending.place)
  if (result.ok) for (const id of pending.ids) removeStaged(id)
}
const exposedFiltersRef = ref<InstanceType<typeof ProductListExposedFilters>>()
const query = computed(() => listData.value.listQuery)
const columnOpen = ref(false),toolsSection=ref<'columns'|'group'|'sort'|'display'>('columns')
function openToolsSection(section:'group'|'sort') {toolsSection.value=section;columnOpen.value=true}
const createOpen = ref(false)
const settingsOpen = ref(false)
const filterOpen = ref(false)
const stageOpen = ref(false)
const collapsed = reactive<Record<string, boolean>>({})
const draftName = ref(''),pendingCreatedViewId=ref('')
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
const tableColumns = computed(() => orderedColumns(activeView.value, listMode.value).filter(column => column.visible))
const modeColumns = computed(() => orderedColumns(activeView.value, listMode.value))
const activeQuery = computed(() => currentModeQuery(activeView.value))
const presentation = computed(() => presentProductList(scopeId.value ? { ...store.data, families: store.data.families.filter(item => item.id === scopeId.value) } : store.data, activeView.value, query.value.page, query.value.pageSize))
const shownGroups = computed(() => presentTableGroups(store.data, presentation.value.groups))
const activeTotal = computed(() => presentation.value.total)
const summaries = computed(() => filterSummaries(activeQuery.value, filterFields.value, value => categoryPath(store.data, value) || value))
const filterCount = computed(() => summaries.value.length)
const filterFields = computed(() => knownFilterFields(store.data, listMode.value).map(field => ({ ...field, label: field.field === 'brand' ? '商品品牌汇总' : field.field.startsWith('attr:') ? `规格属性 · ${field.label}` : field.label })))
const exposedFields = computed(() => activeQuery.value.exposed.flatMap((field) => {
  const found = filterFields.value.find((item) => item.field === field)
  return field === 'category' ? [] : [found || {field,label:`失效字段：${field}`,kind:'text' as const}]
}))
// Convert saved conditions to editor values without duplicating editable state.
const filterRows = computed<FilterEditorRow[]>(() => activeQuery.value.filters.map((filter) => ({
  id: filter.id, field: filter.field, operator: filter.operator, active: summaries.value.some(item=>item.id===filter.id),
  kind: kindOf(filter.field), operators: operatorsFor(filter.field), options: fieldOptions(filter.field),
  text: textValue(filter), values: Array.isArray(filter.value) ? filter.value : [], range: conditionRange(filter),
  categoryId: filter.field === 'category' ? categoryConditionId(filter) : '',
  categoryIds: filter.field === 'category' ? categoryConditionIds(filter) : [],
  valueKind: Array.isArray(filter.value) ? 'array' : filter.value && typeof filter.value === 'object' ? 'range' : 'text',
})))
const exposedRows = computed(() => exposedFields.value.map(field => {
  const state=quickState(field),operator=state.filter?.operator || (field.kind==='date'?'between':field.kind==='text'?'contains':'in'),filter=state.filter || {id:`quick:${field.field}`,field:field.field,operator,value:operator==='between'?{from:'',to:''}:operator==='in'?[]:''}
  return {id:filter.id,field:field.field,label:field.label,simple:state.simple,active:summaries.value.some(item=>item.id===filter.id),invalid:filterFields.value.some(item=>item.field===field.field)?undefined:'字段已失效',operator,kind:field.kind,options:fieldOptions(field.field),operators:filterOperators(field.kind,field.field),text:typeof filter.value==='string'?filter.value:'',values:Array.isArray(filter.value)?filter.value:[],range:conditionRange(filter),categoryId:'',categoryIds:[]}
}))
const groupOptions = computed(() => groupFields(store.data, listMode.value))
const sortOptions = computed(() => sortFields(listMode.value))
const sortMode = computed(() => sortModeOf(activeQuery.value))
const manualOn = computed(() => sortMode.value === 'manual')
const fullPresentation = computed(() => presentProductList(store.data, activeView.value, 1, Number.MAX_SAFE_INTEGER))
const manualScopeLabel = computed(() => activeQuery.value.grouping ? `当前匹配范围的「${groupStatusLabel.value}」同一分组` : '当前完整匹配范围')
function manualContext() { return JSON.stringify([activeView.value.id, scopeId.value, activeQuery.value.keyword, activeQuery.value.filters, activeQuery.value.grouping, sortMode.value, fullPresentation.value.allIds.slice().sort(), Object.fromEntries(Object.entries(fullPresentation.value.groupKeys).sort(([a],[b])=>a.localeCompare(b))), store.activeUserId, store.previewUserId]) }
function groupLabelForId(id:string) { const key=fullPresentation.value.groupKeys[id],label=fullPresentation.value.groups.find(group=>group.key===key)?.label;return label?`${groupStatusLabel.value} / ${label}`:key==='all'?'当前匹配范围':'已不在当前匹配范围' }
function validateManualIds(ids:string[]) : {ok:true}|{ok:false;message:string} {
  if (!canSaveView.value || !manualOn.value) return {ok:false,message:'需要视图修改权限及手工排序模式。'}
  const rows=fullPresentation.value
  if (rows.errors.length) return {ok:false,message:rows.errors.join('；')}
  if (!ids.length || ids.some(id=>!rows.allIds.includes(id))) return {ok:false,message:'有来源不在当前完整匹配结果中，原暂存保留。'}
  if (new Set(ids.map(id=>rows.groupKeys[id])).size!==1) return {ok:false,message:'只能调整当前完整匹配范围的同一分组，不能跨组提交。'}
  return {ok:true}
}
async function commitManual(ids:string[], targetId?:string, place:'before'|'after'|'top'|'bottom'='before') : Promise<{ok:true}|{ok:false;message:string}> {
  const context=manualContext()
  if (!await persistPage()) return {ok:false,message:saveError.value || '请先保存当前视图配置。'}
  if (context!==manualContext()) return {ok:false,message:'排序范围已变化，请重新核对；暂存保留。'}
  const valid=validateManualIds(targetId?[...ids,targetId]:ids);if(!valid.ok)return valid
  const before=activeView.value, matches=fullPresentation.value, next=clonePage(pageDraft.value), view=next.views.find(view=>view.id===before.id)!
  const order=resolveManualOrder(before.manualOrder?.spuIds,unfilteredIds(store.data,before,'spu'))
  const plan=planScopedManualOrder({order,matchedIds:matches.allIds,groupKeys:matches.groupKeys,movingIds:ids,targetId,place})
  if(!plan.ok)return {ok:false,message:plan.message||'无法调整顺序。'}
  if(!plan.changed)return {ok:true}
  view.manualOrder={...view.manualOrder,spuIds:plan.order,skuIds:view.manualOrder?.skuIds||[]};view.updatedAt=new Date().toISOString()
  const guard:ListManualGuard={viewId:before.id,configStamp:JSON.stringify(before),search:currentModeQuery(before).keyword,scopeId:'',sourceIds:[...ids],targetId,...(place==='top'||place==='bottom'?{edge:place}:{place}),matchedIds:[...matches.allIds],groupKeys:{...matches.groupKeys}}
  const failed=(message:string)=>{manualSaveError.value=message;pendingManualRetry={ids:[...ids],targetId,place,context};return {ok:false as const,message}}
  try {const result=await pagePersistence.commitProtected(next,()=>context===manualContext(),guard);if(!result.ok)return failed(result.message||'顺序没有保存，暂存已保留。');manualSaveError.value='';pendingManualRetry=undefined;return {ok:true}}
  catch(error){return failed(error instanceof Error?error.message:'顺序没有保存，暂存已保留。')}
}
const { pickedIds, stageIds, busy:manualBusy, stageContextValid, stageGroupLabel, dropMessage, confirmStage, onRowDrag, onRowOver, onRowDrop, endDrag, rowDropClass, togglePick, addStage, clearStage, removeStaged, askInsert, askBoundary } = useProductListManualOrder({
  move:(id,target,place)=>commitManual([id],target,place),insert:(ids,target,place)=>commitManual(ids,target,place),boundary:(ids,edge)=>commitManual(ids,undefined,edge),
  hasFilters:()=>filterCount.value>0,context:manualContext,validateStage:validateManualIds,groupLabel:groupLabelForId,
})
function manualRowClass({row}:{row:ProductFamily}) {return rowDropClass(row.id)}
function rowIdFromDrag(event:DragEvent) {const row=event.target instanceof Element?event.target.closest('.el-table__row'):null;return row?.querySelector<HTMLElement>('[data-drag-id]')?.dataset.dragId}
function onTableDragOver(event:DragEvent) {const id=rowIdFromDrag(event);if(id)onRowOver(id,event)}
function onTableDrop(event:DragEvent) {const id=rowIdFromDrag(event);if(id)void onRowDrop(id,event)}
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
const categoryState = computed(() => productCategorySelection(store.data,activeQuery.value))
const categoryQuick = computed(() => ({simple:categoryState.value.supported}))
const selectedCategoryIds = computed(() => categoryState.value.ids)
const categoryCaption=computed(()=>categoryFilterCaption(store.data.categories,selectedCategoryIds.value,categoryQuick.value.simple))
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
  const rows = materialArchivesOf(store.data, familyId)
  return `物料 ${new Set(rows.map(row => row.id)).size} · 关联规划 ${new Set(rows.flatMap(row => materialPlanningIds(store.data, row.id))).size}`
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
  if (id === activeView.value.id || manualBusy.value) return
  exposedFiltersRef.value?.flush()
  if (!(await confirmStage(false))) return
  if (!warn(selectProductListView(listData.value,id))) return
  query.value.page=1
  clearStage()
}
function onKeyword(value: string) {
  if (activeQuery.value.keyword !== value) setViewKeyword(listData.value, value)
}
function quickState(field: FilterField) { return quickFilterState(activeQuery.value, field) }
function toggleCategory(id:string,multiple=false) {
  const ids=multiple?(selectedCategoryIds.value.includes(id)?selectedCategoryIds.value.filter(value=>value!==id):[...selectedCategoryIds.value,id]):[id]
  const next=updateProductCategorySelection(store.data,liveQuery(),ids)
  if(!next){filterOpen.value=true;return}if(JSON.stringify(next)===JSON.stringify(liveQuery()))return;Object.assign(liveQuery(),next);touchFilters()
}
function clearCategory() {
  const next=updateProductCategorySelection(store.data,liveQuery(),[])
  if(next)Object.assign(liveQuery(),next);else liveQuery().filters=liveQuery().filters.filter(item=>item.field!=='category')
  touchFilters()
}
function hasFilterValue(value:ProductListViewFilter['value']) {return Array.isArray(value)?value.some(item=>item.trim()):typeof value==='string'?!!value.trim():!!(value.from?.trim()||value.to?.trim())}
function setExposedTypedValue(fieldName:string,value:ProductListViewFilter['value']) {
  const field=filterFields.value.find(field=>field.field===fieldName);if(!field)return
  const state=quickState(field);if(!state.simple){filterOpen.value=true;return}
  const queryState=liveQuery();let filter=state.filter&&queryState.filters.find(filter=>filter.id===state.filter!.id)
  if(!filter){const operator=field.kind==='date'?'between':field.kind==='text'?'contains':'in';filter={id:uid('filter'),field:fieldName,operator,value:operator==='between'?{from:'',to:''}:operator==='in'?[]:'',active:false};queryState.filters.push(filter)}
  const next=hasFilterValue(value)?setProductListFilterValue(queryState,filter.id,value):clearProductListFilterValue(queryState,filter.id)
  if(JSON.stringify(next)===JSON.stringify(queryState))return
  Object.assign(queryState,next);touchFilters()
}
function commitClearFilterValues(ids:string[],keyword=false,fields?:string[]) {
  if (manualBusy.value) return
  // Discard only inputs covered by this clear, before any async save response arrives.
  exposedFiltersRef.value?.discardInputs(fields)
  const current = liveQuery()
  let cleared = current
  for (const id of ids) cleared = clearProductListFilterValue(cleared,id)
  if (keyword) cleared = {...cleared, keyword:''}
  if (JSON.stringify(cleared) === JSON.stringify(current)) return
  Object.assign(current,cleared)
  touchFilters()
}
function clearExposedField(fieldName:string) {
  const field=filterFields.value.find(field=>field.field===fieldName);if(!field)return
  const state=quickState(field);if(!state.simple)return
  commitClearFilterValues(state.filter?[state.filter.id]:[],false,[fieldName])
}
function clearExposedValues() {
  const fields=exposedFields.value.map(field=>field.field)
  commitClearFilterValues(liveQuery().filters.filter(filter=>fields.includes(filter.field)).map(filter=>filter.id),false,fields)
}
function moveExposed(field:string,delta:number){const values=liveQuery().exposed,index=values.indexOf(field),target=index+delta;if(index<0||target<0||target>=values.length)return;const [item]=values.splice(index,1);values.splice(target,0,item!);touchFilters()}
function unexposeField(field:string) {setViewExposed(listData.value,field,false)}
function unexposeAll() {for(const field of [...exposedFields.value])setViewExposed(listData.value,field.field,false)}
function removeSummary(id: string) {
  if (id === '$keyword') onKeyword('')
  else removeCondition(id)
}
function clearFilters() {void commitClearFilterValues(liveQuery().filters.map(filter=>filter.id),true)}
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
  return filterOperators(kindOf(field),field)
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
  liveQuery().filters.push({ id: uid('filter'), field: field.field, operator, value: operator === 'between' ? { from: '', to: '' } : ['in','descendants'].includes(operator) ? [] : '', active:false })
  touchFilters()
}
function changeFilterField(id: string, field: string) {
  const filter = liveQuery().filters.find((item) => item.id === id)
  if (!filter) return
  filter.field = field
  filter.operator = operatorsFor(field)[0].value
  filter.value = filter.operator === 'between' ? { from: '', to: '' } : ['in','descendants'].includes(filter.operator) ? [] : '';filter.active=false
  touchFilters()
}
function changeFilterOperator(id: string, operator: ProductListFilterOperator) {
  const filter = liveQuery().filters.find((item) => item.id === id)
  if (!filter) return
  filter.operator = operator
  filter.value = operator === 'between' ? { from: '', to: '' } : ['in','descendants'].includes(operator) ? [] : '';filter.active=false
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
  Object.assign(liveQuery(),hasFilterValue(value)?setProductListFilterValue(liveQuery(),id,value):clearProductListFilterValue(liveQuery(),id))
  touchFilters()
}
function removeCondition(id: string) {
  const queryState = liveQuery()
  const field=queryState.filters.find(item=>item.id===id)?.field
  if(field)exposedFiltersRef.value?.discardInputs([field])
  queryState.filters = queryState.filters.filter((item) => item.id !== id)
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
  void persistPage()
}
async function openCreate() {
  if(!canSaveView.value||!await confirmStage(false))return
  pendingCreatedViewId.value=''
  draftName.value = ''
  nameError.value = ''
  createOpen.value = true
}
async function confirmCreate() {
  if(!canSaveView.value)return
  if(pendingCreatedViewId.value){const renamed=renameProductListView(listData.value,pendingCreatedViewId.value,draftName.value);if(!renamed.ok){nameError.value=renamed.message;return}}
  else {const result=createProductListView(listData.value,draftName.value,activeView.value.id,()=>uid('view'));if(!result.ok){nameError.value=result.message;return}pendingCreatedViewId.value=result.id;const created=pageDraft.value.views.find(view=>view.id===result.id);if(created)created.categoryFilterLayout='popover'}
  query.value.page=1
  if(!await persistPage()){nameError.value=saveError.value;return}
  pendingCreatedViewId.value='';createOpen.value=false;clearStage();ElMessage.success('视图已创建并保存')
}
function openSettings() {
  renameDraft.value = activeView.value.name
  renameError.value = ''
  settingsOpen.value = true
}
async function confirmRename() {
  if(!canSaveView.value)return
  const result = renameProductListView(listData.value, activeView.value.id, renameDraft.value)
  if (!result.ok) {
    renameError.value = result.message
    return
  }
  if(!await persistPage()){renameError.value=saveError.value;return}
  ElMessage.success('名称已保存')
}
async function confirmCopy() {
  if(!canSaveView.value||!await confirmStage(false)||!await persistPage())return
  const result = copyProductListView(listData.value, activeView.value.id, () => uid('view'))
  if (!warn(result)) return
  query.value.page=1
  if(!await persistPage())return
  settingsOpen.value=false;clearStage();ElMessage.success('已复制并保存为独立视图')
}
async function confirmDelete() {
  await ElMessageBox.confirm(`删除视图「${activeView.value.name}」？商品不会被删除。`, '删除视图')
  const result = deleteProductListView(listData.value, activeView.value.id)
  if (!warn(result)) return
  query.value.page=1
  if(!await persistPage())return
  settingsOpen.value=false;ElMessage.success('视图已删除')
}
async function saveFilter() {
  if(!canSaveView.value)return
  const page = listData.value
  const view: ListView = { id: uid('view'), name: `筛选${page.listViews.length}`, query: { ...JSON.parse(JSON.stringify(query.value)), page: 1 }, columns: [], keyword: activeQuery.value.keyword, viewFilters: JSON.parse(JSON.stringify(activeQuery.value.filters)) }
  page.listViews.push(view); page.activeViewId = view.id
  if(await persistPage())ElMessage.success('筛选预设已保存，不会创建新视图')
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
const { categoryOpen, narrowScreen, categoryLayout, showSidebar, setCategorySidebar, openCategory, closeSidebar } = useProductListCategoryLayout(
  activeView,
  layout => setViewCategoryLayout(listData.value, layout),
)
async function allowListLeave() {
  if(manualBusy.value)return false
  exposedFiltersRef.value?.flush()
  if(!await confirmStage(false))return false
  return await persistPage()
}
onBeforeRouteLeave(allowListLeave)
onBeforeRouteUpdate((to,from)=>mode==='sku'&&String(to.query.spu||'')!==String(from.query.spu||'')?allowListLeave():true)
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
.spu-table :deep(.el-table__row > .el-table__cell){height:64px;box-sizing:border-box}

.list-main{overflow:hidden}.view-save-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.view-save-actions .el-button{margin:0}.list-switch{padding-bottom:12px;border-bottom:1px solid var(--el-border-color-lighter);margin-bottom:12px}.filters{gap:8px}.spu-table :deep(th){color:var(--el-text-color-secondary);font-weight:600}.spu-table .linkish{text-align:left;font-weight:600;overflow-wrap:anywhere}.spu-table .sku-hint{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px;color:var(--el-text-color-secondary)}.spu-table :deep(.el-dropdown){margin-left:12px;vertical-align:middle}

.panel.is-category-side { display: flex; align-items: flex-start; gap: 12px; }
.category-side { width:var(--product-category-width,240px); flex:0 0 var(--product-category-width,240px); min-width:0; overflow:hidden; }
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
.drag-handle { cursor:grab;color:var(--el-text-color-secondary);user-select:none;border:0;background:transparent;padding:5px;font:inherit }.drag-handle:disabled{cursor:default;opacity:.4}
.spu-table :deep(.manual-drop-before>td){box-shadow:inset 0 2px var(--el-color-primary)}.spu-table :deep(.manual-drop-after>td){box-shadow:inset 0 -2px var(--el-color-primary)}.spu-table :deep(.manual-drop-blocked>td){background:var(--el-color-warning-light-9)}
.configuration-pop{display:flex;flex-direction:column;gap:10px}.list-configuration{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 12px}.list-configuration .el-button{margin-left:0}.view-save-state{font-size:12px;color:var(--el-text-color-secondary)}.view-save-state.failed{color:var(--el-color-danger)}.manual-scope{font-size:12px;color:var(--el-text-color-secondary);line-height:1.6}.stage-path{display:block;font-size:12px;color:var(--el-text-color-secondary)}
.stage-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.sku-expand { padding: 0 12px 8px; }
.group-head { display: block; width: 100%; margin: 8px 0 4px; padding: 8px 10px; border: 0; border-radius: 6px; background: var(--app-surface-muted); color: inherit; text-align: left; cursor: pointer; }
.warn { color: var(--el-color-danger); font-size: 13px; }
</style>

<style>
.product-category-pop { max-width: calc(100vw - 24px); max-height: calc(100vh - 24px); overflow: auto; box-sizing: border-box; }
</style>

<style scoped>
.category-caption{max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.is-filter-active{color:var(--el-color-primary);border-color:var(--el-color-primary-light-5);background:var(--el-color-primary-light-9)}
</style>

<style scoped>
.list-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:8px}.list-toolbar>.filters,.list-toolbar>.list-configuration{display:contents}.list-toolbar [data-result-count]{margin-left:auto;font-size:12px}.list-toolbar :deep(.el-button+.el-button){margin-left:0}
</style>
