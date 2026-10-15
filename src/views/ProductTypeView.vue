<template>
  <div>
    <PageHead title="产品类型" desc="产品类型挂在分类下面，用来说明这是什么产品。它不是分类的子节点。">
      <el-button type="primary" :disabled="!categoryId" @click="openCreate">新增产品类型</el-button>
    </PageHead>
    <div class="grid-2">
      <div class="panel">
        <h2>分类</h2>
        <el-tree
          :data="categoryTree"
          node-key="id"
          :current-node-key="categoryId"
          highlight-current
          default-expand-all
          @node-click="onPick"
        />
      </div>
      <div class="panel">
        <h2>当前分类</h2>
        <p class="path">{{ categoryId ? categoryPath(store.data, categoryId) : '请先在左侧选择分类' }}</p>
        <el-table :data="rows">
          <el-table-column prop="name" label="产品类型" min-width="160" />
          <el-table-column prop="description" label="说明" min-width="180" />
          <el-table-column prop="sort" label="排序" width="80" />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-switch :model-value="row.status === 'enabled'" @change="onStatus(row.id, Boolean($event))" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="140">
            <template #default="{ row }">
              <el-button link type="primary" @click="openEdit(row.id)">编辑</el-button>
              <el-button link type="danger" @click="onRemove(row.id)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>
    <el-dialog v-model="open" :title="editing.id ? '编辑产品类型' : '新增产品类型'" width="460px">
      <el-form label-width="72px">
        <el-form-item label="分类"><el-input :model-value="categoryId ? categoryPath(store.data, categoryId) : ''" disabled /></el-form-item>
        <el-form-item label="名称"><el-input v-model="editing.name" /></el-form-item>
        <el-form-item label="说明"><el-input v-model="editing.description" type="textarea" /></el-form-item>
        <el-form-item label="排序"><el-input-number v-model="editing.sort" :min="1" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="open = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, reactive, ref } from 'vue'
import PageHead from '../components/PageHead.vue'
import { categoryPath } from '../domain/logic'
import type { ProductType } from '../domain/types'
import { useCatalogStore } from '../stores/catalog'

const store = useCatalogStore()
const categoryId = ref(store.data.categories.some((item) => item.id === 'c-phone') ? 'c-phone' : store.data.categories[0]?.id || '')
const open = ref(false)
const editing = reactive({ id: '', name: '', description: '', sort: 1, status: 'enabled' as ProductType['status'] })

const categoryTree = computed(() => walk(null))
const rows = computed(() => (categoryId.value ? store.productTypesOf(categoryId.value) : []))

function walk(parentId: string | null): { id: string; label: string; children: ReturnType<typeof walk> }[] {
  return store.data.categories
    .filter((item) => item.parentId === parentId)
    .slice()
    .sort((a, b) => a.sort - b.sort)
    .map((item) => ({ id: item.id, label: item.name, children: walk(item.id) }))
}

function onPick(node: { id: string }) {
  categoryId.value = node.id
}

function nextSort() {
  return rows.value.reduce((max, item) => Math.max(max, item.sort), 0) + 1
}

function openCreate() {
  Object.assign(editing, { id: '', name: '', description: '', sort: nextSort(), status: 'enabled' })
  open.value = true
}

function openEdit(id: string) {
  const row = store.data.productTypes.find((item) => item.id === id)
  if (!row) return
  Object.assign(editing, { id: row.id, name: row.name, description: row.description, sort: row.sort, status: row.status })
  open.value = true
}

function save() {
  const message = store.saveProductType({
    id: editing.id,
    name: editing.name,
    categoryId: categoryId.value,
    description: editing.description,
    sort: editing.sort,
    status: editing.status,
  })
  if (message) {
    ElMessage.warning(message)
    return
  }
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
  ElMessage.success('已删除')
}
</script>

<style scoped>
.path { margin: 0 0 12px; color: #606266; }
</style>
