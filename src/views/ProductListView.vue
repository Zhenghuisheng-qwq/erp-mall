<template>
  <div>
    <PageHead title="商品列表" desc="一款商品下面挂多条规格。筛选和列设置会留在本机。">
      <el-button @click="columnOpen = true">列和视图</el-button>
      <el-button type="primary" @click="router.push('/products/new')">新增商品</el-button>
    </PageHead>
    <div class="panel">
      <div class="filters">
        <el-input v-model="query.keyword" placeholder="名称、分类、属性、SKU、OA 编号" clearable style="width: 260px" @change="query.page = 1" />
        <el-select v-model="query.categoryId" clearable placeholder="商品分类" style="width: 140px" @change="query.page = 1">
          <el-option v-for="item in categories" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
        <el-select v-model="query.brand" clearable placeholder="品牌" style="width: 120px" @change="query.page = 1">
          <el-option v-for="item in brands" :key="item" :label="item" :value="item" />
        </el-select>
        <el-select v-model="query.shelf" clearable placeholder="商品状态" style="width: 120px" @change="query.page = 1">
          <el-option label="草稿" value="draft" />
          <el-option label="已发布" value="online" />
          <el-option label="已下架" value="offline" />
        </el-select>
        <el-date-picker v-model="createdRange" type="daterange" value-format="YYYY-MM-DD" start-placeholder="创建开始" end-placeholder="创建结束" style="width: 240px" @change="onCreated" />
        <el-select v-model="query.status" clearable placeholder="规格状态" style="width: 120px" @change="query.page = 1">
          <el-option label="在售" value="on_sale" />
          <el-option label="停售" value="off_sale" />
          <el-option label="草稿" value="draft" />
        </el-select>
        <el-select v-model="query.productGroupId" clearable placeholder="商品组" style="width: 140px" @change="query.page = 1">
          <el-option v-for="item in store.data.productGroups" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
        <el-select v-model="attrKey" clearable placeholder="参数筛选" style="width: 120px">
          <el-option v-for="item in store.data.params" :key="item.id" :label="item.name" :value="item.name" />
        </el-select>
        <el-select v-if="attrKey" v-model="query.attrFilters[attrKey]" clearable placeholder="取值" style="width: 140px" @change="query.page = 1">
          <el-option v-for="item in attrValues" :key="item" :label="item" :value="item" />
        </el-select>
        <el-button @click="saveView">保存当前筛选</el-button>
        <el-button @click="router.push('/import')">导入导出</el-button>
      </div>
      <div class="row-actions" style="margin-bottom: 10px">
        <el-button :disabled="familyIds.length === 0" @click="setShelfMany('online')">批量发布</el-button>
        <el-button :disabled="familyIds.length === 0" @click="setShelfMany('offline')">批量下架</el-button>
        <el-button :disabled="familyIds.length === 0" type="danger" @click="removeMany">批量删除</el-button>
      </div>
      <div class="row-actions" style="margin-bottom: 10px">
        <span class="muted">视图</span>
        <el-tag v-for="view in store.data.listViews" :key="view.id" :type="store.data.activeViewId === view.id ? 'primary' : 'info'" style="cursor: pointer" @click="store.applyView(view.id)" @close="store.removeView(view.id)" :closable="view.id !== 'view-all'">{{ view.name }}</el-tag>
      </div>
      <el-table :data="pageRows" row-key="id" @sort-change="onSort" @expand-change="onExpand" @selection-change="onFamilySelect">
        <el-table-column type="selection" width="42" />
        <el-table-column label="商品状态" width="100">
          <template #default="{ row }">{{ shelfText(shelfOf(row)) }}</template>
        </el-table-column>
        <el-table-column type="expand">
          <template #default="{ row }">
            <div style="padding: 0 12px 8px">
              <div class="row-actions" style="margin-bottom: 8px">
                <el-button size="small" @click="router.push(`/products/${row.id}`)">编辑整款商品</el-button>
                <el-button size="small" @click="router.push(`/products/${row.id}?add=1`)">新增规格</el-button>
                <el-button size="small" :disabled="selected[row.id]?.length === 0" @click="batchStatus(row.id, 'on_sale')">所选改在售</el-button>
                <el-button size="small" :disabled="selected[row.id]?.length === 0" @click="batchStatus(row.id, 'off_sale')">所选改停售</el-button>
              </div>
              <el-table :data="store.skusOf(row.id)" size="small" @selection-change="onSelect(row.id, $event)">
                <el-table-column type="selection" width="42" />
                <el-table-column label="规格" min-width="220">
                  <template #default="{ row: sku }">{{ skuTitle(sku, boundParams(store.data, row.templateId, 'variant')) }}</template>
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
                    <el-button link type="primary" @click="router.push(`/products/${row.id}?sku=${sku.id}`)">编辑</el-button>
                    <el-button link @click="copySku(row.id, sku.id)">复制</el-button>
                    <el-button link type="danger" @click="removeSku(sku.id)">删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </template>
        </el-table-column>
        <el-table-column v-for="col in visibleColumns" :key="col.key" :prop="col.key" :label="col.label" :fixed="col.fixed ? 'left' : false" min-width="120" sortable="custom">
          <template #default="{ row }">
            <template v-if="col.key === 'name'">
              <button class="linkish" @click="router.push(`/products/${row.id}`)">{{ row.name }}</button>
            </template>
            <template v-else-if="col.key === 'category'">{{ categoryPath(store.data, row.categoryId) }}</template>
            <template v-else-if="col.key === 'template'">{{ templateById(store.data, row.templateId)?.name }}</template>
            <template v-else-if="col.key === 'brand'">{{ row.commonAttrs['品牌'] || '-' }}</template>
            <template v-else-if="col.key === 'skuCount'">{{ store.skusOf(row.id).length }}</template>
            <template v-else-if="col.key === 'sale'">{{ store.skusOf(row.id).filter((item) => item.status === 'on_sale').length }}</template>
            <template v-else-if="col.key === 'origin'">{{ row.origin === 'sample' ? '预设演示' : '本次新增' }}</template>
            <template v-else-if="col.key === 'updatedAt'">{{ row.updatedAt.slice(0, 16).replace('T', ' ') }}</template>
            <template v-else>{{ row.oaProductId || '-' }}</template>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="router.push(`/products/${row.id}`)">编辑</el-button>
            <el-button link @click="copyFamily(row.id)">复制</el-button>
            <el-button link type="danger" @click="removeFamily(row.id, row.name)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="display: flex; justify-content: flex-end; margin-top: 12px">
        <el-pagination :current-page="query.page" :page-size="query.pageSize" :total="filtered.length" layout="total, prev, pager, next" @current-change="(page: number) => (query.page = page)" />
      </div>
    </div>

    <el-drawer v-model="columnOpen" title="列和视图" size="420px">
      <p class="muted">勾选显示，拖动顺序只在本组里用上移下移完成。</p>
      <div v-for="(col, index) in store.data.columns" :key="col.key" class="row-actions" style="margin: 8px 0">
        <el-checkbox v-model="col.visible" :disabled="col.fixed">{{ col.label }}</el-checkbox>
        <el-button size="small" :disabled="index === 0" @click="moveCol(index, -1)">上移</el-button>
        <el-button size="small" :disabled="index === store.data.columns.length - 1" @click="moveCol(index, 1)">下移</el-button>
      </div>
      <el-button @click="store.data.columns = store.defaultColumns()">恢复默认列</el-button>
      <div class="row-actions" style="margin-top: 16px">
        <el-input v-model="viewName" placeholder="视图名称" />
        <el-button type="primary" @click="saveView">保存视图</el-button>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHead from '../components/PageHead.vue'
import { boundParams, categoryPath, projectAttrs, shelfOf, shelfText, skuTitle, templateById } from '../domain/logic'
import type { ProductFamily, Sku } from '../domain/types'
import { useCatalogStore } from '../stores/catalog'

const store = useCatalogStore()
const router = useRouter()
const route = useRoute()
const query = store.data.listQuery
const columnOpen = ref(false)
const viewName = ref('')
const attrKey = ref('')
const selected = reactive<Record<string, string[]>>({})
const familyIds = ref<string[]>([])
const createdRange = ref<[string, string] | null>(null)
const categories = computed(() => store.data.categories)
const brands = computed(() => Array.from(new Set(store.data.families.map((item) => item.commonAttrs['品牌']).filter(Boolean))))
const attrValues = computed(() => store.data.params.find((item) => item.name === attrKey.value)?.values ?? [])
const visibleColumns = computed(() => store.data.columns.filter((item) => item.visible))

const filtered = computed(() => {
  const q = query
  let rows = store.data.families.filter((family) => {
    const skus = store.skusOf(family.id)
    const text = `${family.name} ${categoryPath(store.data, family.categoryId)} ${family.oaProductId} ${skus.map((sku) => `${sku.id} ${sku.oaSkuId} ${Object.entries(projectAttrs(family, sku)).map(([name, value]) => name + value).join(' ')}`).join(' ')}`
    if (q.keyword && !text.toLowerCase().includes(q.keyword.toLowerCase())) return false
    if (q.categoryId && family.categoryId !== q.categoryId) return false
    if (q.shelf && shelfOf(family) !== q.shelf) return false
    const created = (family.createdAt || family.updatedAt).slice(0, 10)
    if (q.createdFrom && created < q.createdFrom) return false
    if (q.createdTo && created > q.createdTo) return false
    if (q.brand && family.commonAttrs['品牌'] !== q.brand) return false
    if (q.templateId && family.templateId !== q.templateId) return false
    if (q.productGroupId && !family.productGroupIds.includes(q.productGroupId)) return false
    if (q.status && !skus.some((sku) => sku.status === q.status)) return false
    const attrsOk = Object.entries(q.attrFilters).every(([name, value]) => {
      if (!value) return true
      return skus.some((sku) => projectAttrs(family, sku)[name] === value)
    })
    return attrsOk
  })
  rows = rows.slice().sort((a, b) => compareFamily(a, b))
  return rows
})
const pageRows = computed(() => filtered.value.slice((query.page - 1) * query.pageSize, query.page * query.pageSize))

function compareFamily(a: ProductFamily, b: ProductFamily) {
  const order = query.sortOrder === 'ascending' ? 1 : -1
  const prop = query.sortProp
  const left = prop === 'name' ? a.name : a.updatedAt
  const right = prop === 'name' ? b.name : b.updatedAt
  return left > right ? order : left < right ? -order : 0
}
function onSort(payload: { prop: string; order: 'ascending' | 'descending' | null }) {
  query.sortProp = payload.prop || 'updatedAt'
  query.sortOrder = payload.order
}
function onExpand() {
  return undefined
}
function moveCol(index: number, direction: -1 | 1) {
  const list = store.data.columns
  const target = index + direction
  const current = list[index]
  const next = list[target]
  if (!current || !next) return
  list[index] = next
  list[target] = current
}
function saveView() {
  const name = viewName.value.trim() || `视图${store.data.listViews.length}`
  store.saveView(name)
  viewName.value = ''
  ElMessage.success('视图已保存，刷新后还在')
}
function copyFamily(id: string) {
  router.push(`/products/new?from=${id}`)
}
async function removeFamily(id: string, name: string) {
  const family = store.data.families.find((item) => item.id === id)
  if (family && shelfOf(family) === 'online') {
    ElMessage.warning('已发布的商品不能直接删除，请先下架。')
    return
  }
  await ElMessageBox.confirm(`删除「${name}」和它下面的全部规格？`, '删除商品')
  store.removeFamily(id)
  ElMessage.success('已删除')
}
function onFamilySelect(rows: ProductFamily[]) {
  familyIds.value = rows.map((item) => item.id)
}
function onCreated(value: [string, string] | null) {
  query.createdFrom = value?.[0] || ''
  query.createdTo = value?.[1] || ''
  query.page = 1
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
  familyIds.value.forEach((id) => store.removeFamily(id))
  familyIds.value = []
  ElMessage.success('已删除')
}
async function removeSku(id: string) {
  await ElMessageBox.confirm('删除这条规格。如果这是最后一条，整款商品也会去掉。', '删除规格')
  store.removeSku(id)
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

onMounted(() => {
  if (route.query.panel === 'columns') columnOpen.value = true
})
watch(
  () => route.query.panel,
  (panel) => {
    if (panel === 'columns') columnOpen.value = true
  },
)
</script>
