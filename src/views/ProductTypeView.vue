<template>
  <div>
    <PageHead title="产品类型" desc="产品类型挂在分类下面，用来说明这是什么产品。它不是分类的子节点。">
      <el-button type="primary" :disabled="(!categoryId) || !(store.can('product:type:create'))" @click="openCreate">新增产品类型</el-button>
    </PageHead>
    <div class="grid-2">
      <div class="panel">
        <h2>分类</h2>
        <p class="path">只用来筛选产品类型，不会修改分类。</p>
        <el-tree
          ref="treeRef"
          :data="categoryTree"
          node-key="id"
          :current-node-key="categoryId"
          highlight-current
          :expand-on-click-node="false"
          default-expand-all
          @node-click="onPick"
        />
      </div>
      <div class="panel">
        <div class="panel-head">
          <h2>产品类型</h2>
          <el-radio-group v-model="scope" size="small">
            <el-radio-button value="current">仅当前分类</el-radio-button>
            <el-radio-button value="with-children">包含下级分类</el-radio-button>
          </el-radio-group>
        </div>
        <p class="path">{{ scopeText }}</p>
        <el-table v-if="rows.length" :data="rows" row-key="id" :expand-row-keys="expandedIds" @expand-change="onExpand">
          <el-table-column type="expand">
            <template #default="{ row }">
              <div class="detail">
                <p>关联分类</p>
                <ul>
                  <li v-for="item in row.categories" :key="item.id">{{ item.path }}</li>
                </ul>
                <p>商品模型</p>
                <ul v-if="row.models.length">
                  <li v-for="item in row.models" :key="item.id">
                    <span>{{ item.name }}</span>
                    <el-button v-if="canOpenModel" link type="primary" @click="openModel(item.id)">查看</el-button>
                  </li>
                </ul>
                <p v-else class="quiet">这个产品类型下还没有商品模型。</p>
                <p v-if="row.models.length && !canOpenModel" class="quiet">当前角色不能打开商品模型页面。这里只列出已有模型，不会改分类或模型归属。</p>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="产品类型" min-width="140" />
          <el-table-column label="关联分类" min-width="220">
            <template #default="{ row }">
              <span v-if="row.categories.length <= 1">{{ row.categories[0]?.path || '未关联分类' }}</span>
              <span v-else>{{ row.categories[0].path }} 等 {{ row.categories.length }} 个</span>
            </template>
          </el-table-column>
          <el-table-column label="商品模型" width="100">
            <template #default="{ row }">{{ row.models.length }}</template>
          </el-table-column>
          <el-table-column prop="description" label="说明" min-width="140" />
          <el-table-column prop="sort" label="排序" width="70" />
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-switch :model-value="row.status === 'enabled'" @change="onStatus(row.id, Boolean($event))" :disabled="!(store.can('product:type:update'))" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="210">
            <template #default="{ row }">
              <el-button link type="primary" @click="onViewModels(row)">查看模型</el-button>
              <el-button link type="primary" @click="openEdit(row.id)" :disabled="!(store.can('product:type:update'))">编辑</el-button>
              <el-button link type="danger" @click="onRemove(row.id)" :disabled="!(store.can('product:type:delete'))">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else :description="emptyText" />
      </div>
    </div>
    <el-dialog v-model="open" :title="editing.id ? '编辑产品类型' : '新增产品类型'" width="460px">
      <el-form label-width="72px">
        <el-form-item label="分类">
          <el-input v-if="!editing.id" :model-value="categoryId ? categoryPath(store.data, categoryId) : ''" disabled />
          <CategoryTreeSelect v-else :model-value="targetCategoryId" :categories="store.data.categories" :block-reason="typeMoveBlock" placeholder="选择末级分类" style="width: 100%" @update:model-value="onTargetCategory" />
        </el-form-item>
        <p v-if="moveHint" class="move-hint">{{ moveHint }}</p>
        <el-form-item label="名称"><el-input v-model="editing.name" /></el-form-item>
        <el-form-item label="说明"><el-input v-model="editing.description" type="textarea" /></el-form-item>
        <el-form-item label="排序"><el-input-number v-model="editing.sort" :min="1" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="open = false">取消</el-button>
        <el-button type="primary" @click="save" :disabled="!(store.can(editing.id ? 'product:type:update' : 'product:type:create'))">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import CategoryTreeSelect from '../components/CategoryTreeSelect.vue'
import PageHead from '../components/PageHead.vue'
import { productTypeCategoryMoveMessage, productTypesInScope, type ProductTypeScope } from '../domain/categoryTree'
import { categoryPath } from '../domain/logic'
import type { ProductType } from '../domain/types'
import { useCatalogStore } from '../stores/catalog'

const store = useCatalogStore()
const router = useRouter()
const categoryId = ref(store.data.categories.some((item) => item.id === 'c-phone') ? 'c-phone' : store.data.categories[0]?.id || '')
const scope = ref<ProductTypeScope>('current')
const expandedIds = ref<string[]>([])
const treeRef = ref<{ setCurrentKey: (key?: string) => void }>()
const open = ref(false)
const editing = reactive({ id: '', name: '', description: '', sort: 1, status: 'enabled' as ProductType['status'] })
const targetCategoryId = ref('')

const categoryTree = computed(() => walk(null))
const canOpenModel = computed(() => store.canRoute({ path: '/specs' }))
const rows = computed(() => {
  const scoped = productTypesInScope(store.data.productTypes, store.data.categories, categoryId.value, scope.value)
  return scoped
    .map((item) => ({
      id: item.type.id,
      name: item.type.name,
      description: item.type.description,
      sort: item.type.sort,
      status: item.type.status,
      categories: categoryLinks(item.categoryIds),
      models: modelsOf(item.type.id),
    }))
    .sort((a, b) => (a.categories[0]?.path || '').localeCompare(b.categories[0]?.path || '', 'zh') || a.sort - b.sort || a.name.localeCompare(b.name, 'zh') || a.id.localeCompare(b.id))
})
const moveHint = computed(() => {
  if (!editing.id || !targetCategoryId.value) return ''
  return productTypeCategoryMoveMessage(store.data, editing.id, targetCategoryId.value, categoryPath(store.data, targetCategoryId.value))
})
const scopeText = computed(() => {
  if (!categoryId.value) return '请先在左侧选择分类'
  const path = categoryPath(store.data, categoryId.value)
  return scope.value === 'current' ? `当前范围：${path} · 仅当前分类` : `当前范围：${path} · 包含下级分类`
})
const emptyText = computed(() => {
  if (!categoryId.value) return '请先在左侧选择分类'
  return scope.value === 'current' ? '当前分类没有直接关联的产品类型' : '当前分类和它的下级分类都没有产品类型'
})

watch(categoryId, (id) => {
  nextTick(() => treeRef.value?.setCurrentKey(id || undefined))
})
onMounted(() => {
  nextTick(() => treeRef.value?.setCurrentKey(categoryId.value || undefined))
})

function walk(parentId: string | null): { id: string; label: string; children: ReturnType<typeof walk> }[] {
  return store.data.categories
    .filter((item) => item.parentId === parentId)
    .slice()
    .sort((a, b) => a.sort - b.sort)
    .map((item) => ({ id: item.id, label: item.name, children: walk(item.id) }))
}

function categoryLinks(ids: string[]) {
  const seen = new Set<string>()
  return ids
    .filter((id) => {
      if (!id || seen.has(id)) return false
      seen.add(id)
      return true
    })
    .map((id) => ({ id, path: categoryPath(store.data, id) || '未找到分类' }))
    .sort((a, b) => a.path.localeCompare(b.path, 'zh'))
}

function modelsOf(typeId: string) {
  const seen = new Set<string>()
  const models: { id: string; name: string }[] = []
  store.data.specCanvases.forEach((item) => {
    if (item.productTypeId !== typeId || !item.templateId || seen.has(item.templateId)) return
    seen.add(item.templateId)
    models.push({
      id: item.templateId,
      name: item.name?.trim() || store.data.templates.find((template) => template.id === item.templateId)?.name || '未命名模型',
    })
  })
  return models
}

function typeMoveBlock(id: string) {
  const category = store.data.categories.find((item) => item.id === id)
  if (!category) return '目标分类不存在或已经删除。'
  if (category.enabled === false) return '目标分类已停用，不能关联。'
  if (store.data.categories.some((item) => item.parentId === id)) return '只有末级分类可以关联产品类型。'
  return ''
}
function onTargetCategory(value: string | string[]) {
  if (typeof value === 'string') targetCategoryId.value = value
}
function onPick(node: { id: string }) {
  categoryId.value = node.id
}

function onExpand(_row: { id: string }, expanded: { id: string }[]) {
  expandedIds.value = expanded.map((item) => item.id)
}

function reveal(id: string) {
  if (!expandedIds.value.includes(id)) expandedIds.value = [...expandedIds.value, id]
}

function onViewModels(row: { id: string; models: { id: string }[] }) {
  if (row.models.length === 1 && canOpenModel.value) {
    openModel(row.models[0].id)
    return
  }
  reveal(row.id)
}

function openModel(templateId: string) {
  if (!canOpenModel.value || !templateId) return
  router.push({ path: '/specs', query: { template: templateId, mode: 'view' } })
}

function nextSort() {
  return store.productTypesOf(categoryId.value).reduce((max, item) => Math.max(max, item.sort), 0) + 1
}

function openCreate() {
  Object.assign(editing, { id: '', name: '', description: '', sort: nextSort(), status: 'enabled' })
  open.value = true
}

function openEdit(id: string) {
  const row = store.data.productTypes.find((item) => item.id === id)
  if (!row) return
  Object.assign(editing, { id: row.id, name: row.name, description: row.description, sort: row.sort, status: row.status })
  targetCategoryId.value = row.categoryId
  open.value = true
}

async function save() {
  const message = store.saveProductType({
    id: editing.id,
    name: editing.name,
    categoryId: editing.id ? targetCategoryId.value : categoryId.value,
    description: editing.description,
    sort: editing.sort,
    status: editing.status,
  })
  if (message) {
    ElMessage.warning(message)
    return
  }
  if (!editing.id) {
    const created = store.productTypesOf(categoryId.value).find(item => item.name === editing.name.trim())
    if (created) { editing.id = created.id; targetCategoryId.value = created.categoryId }
  }
  const saved = await store.flushPersistence()
  if (!saved.ok) { ElMessage.error(store.persistenceState.message || '产品类型尚未保存，当前输入已保留。'); return }
  open.value = false
  ElMessage.success('产品类型已保存')
}

function onStatus(id: string, enabled: boolean) {
  store.setProductTypeStatus(id, enabled ? 'enabled' : 'disabled')
}

async function onRemove(id: string) {
  const row = store.data.productTypes.find((item) => item.id === id)
  if (!row) return
  try {
    await ElMessageBox.confirm(`删除产品类型「${row.name}」？`, '删除产品类型', { type: 'warning' })
  } catch {
    return
  }
  const message = store.removeProductType(id)
  if (message) {
    ElMessage.warning(message)
    return
  }
  const saved = await store.flushPersistence()
  if (!saved.ok) { ElMessage.error(store.persistenceState.message || '删除尚未保存，请处理保存提示。'); return }
  ElMessage.success('已删除')
}
</script>

<style scoped>
.panel-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.panel-head h2 { margin: 0; }
.path { margin: 0 0 12px; color: var(--text-secondary); font-size: 13px; line-height: 1.5; }
.move-hint { margin: 0 0 12px; color: var(--status-danger); font-size: 13px; line-height: 1.5; }
.detail { padding: 4px 8px 8px 8px; }
.detail p { margin: 8px 0 4px; font-size: 13px; }
.detail ul { margin: 0; padding-left: 18px; }
.detail li { display: flex; align-items: center; gap: 8px; margin: 2px 0; }
.quiet { color: var(--text-secondary); }
.panel :deep(.el-tree-node.is-current > .el-tree-node__content) { background: var(--el-color-primary-light-9); color: var(--el-color-primary); font-weight: 600; }
</style>
