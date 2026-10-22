<template>
  <div>
    <PageHead title="商品模型" desc="模型挂在产品类型下面。先选分类和产品类型，再创建模型。发布会留下版本快照。">
      <el-button type="primary" @click="openCreate">新建模型</el-button>
    </PageHead>
    <div class="panel">
      <el-table :data="rows">
        <el-table-column prop="category" label="分类路径" min-width="180" />
        <el-table-column prop="productType" label="产品类型" min-width="140" />
        <el-table-column prop="name" label="模型名称" min-width="160" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">{{ statusText(row.status) }}</template>
        </el-table-column>
        <el-table-column prop="version" label="版本" width="80" />
        <el-table-column prop="products" label="商品数量" width="100" />
        <el-table-column prop="skus" label="SKU数量" width="100" />
        <el-table-column prop="updatedAt" label="更新时间" width="160" />
        <el-table-column label="操作" width="320" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="open(row.id, true)">查看模型</el-button>
            <el-button link type="primary" @click="open(row.id, false)">编辑模型</el-button>
            <el-button link @click="router.push({ path: '/skus/new', query: { template: row.id } })">创建 SKU</el-button>
            <el-button link @click="copy(row.id)">复制模型</el-button>
            <el-button link @click="setStatus(row.id, 'published')">发布模型</el-button>
            <el-button link @click="setStatus(row.id, 'offline')">下线模型</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <el-dialog v-model="createOpen" title="新建模型" width="480px">
      <el-form label-width="88px">
        <el-form-item label="分类">
          <CategoryTreeSelect :model-value="draft.categoryId" :categories="store.data.categories" placeholder="选择分类" style="width: 100%" @update:model-value="onCategoryValue" />
        </el-form-item>
        <el-form-item label="产品类型">
          <el-select v-model="draft.productTypeId" placeholder="选择产品类型" style="width: 100%">
            <el-option v-for="item in typeOptions" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="模型名称"><el-input v-model="draft.name" placeholder="例如：手机标准模型" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createOpen = false">取消</el-button>
        <el-button type="primary" @click="create">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import CategoryTreeSelect from '../components/CategoryTreeSelect.vue'
import PageHead from '../components/PageHead.vue'
import { categoryPath } from '../domain/logic'
import { isRealSku } from '../domain/catalogIdentity'
import type { SpecModelStatus } from '../domain/types'
import { uid, useCatalogStore } from '../stores/catalog'

const store = useCatalogStore()
const router = useRouter()
const createOpen = ref(false)
const draft = reactive({ categoryId: '', productTypeId: '', name: '' })
const typeOptions = computed(() => store.productTypesOf(draft.categoryId))
const rows = computed(() => {
  const ids = new Set<string>([
    ...store.data.specCanvases.map((item) => item.templateId),
    ...store.data.productSpecNodes.map((item) => item.templateId),
  ])
  return [...ids].map((id) => {
    const canvas = store.data.specCanvases.find((item) => item.templateId === id)
    const scheme = store.data.templates.find((item) => item.id === id)
    const productType = store.data.productTypes.find((item) => item.id === canvas?.productTypeId)
    const published = store.data.specModelVersions.filter((item) => item.templateId === id && item.status === 'published').slice().sort((a, b) => a.version - b.version)
    const latest = published[published.length - 1]
    const families = store.data.families.filter((item) => item.templateId === id)
    const familyIds = new Set(families.map((item) => item.id))
    return {
      id,
      name: canvas?.name || `${scheme?.name || '未命名'}模型`,
      category: productType ? categoryPath(store.data, productType.categoryId) : '未指定分类',
      productType: productType?.name || '未指定产品类型',
      status: canvas?.status || (latest ? 'published' : 'draft'),
      version: canvas?.status === 'draft' ? canvas.versionName || `V${(latest?.version || 0) + 1}` : latest?.versionName || canvas?.versionName || 'V1',
      products: families.length,
      skus: store.data.skus.filter((item) => familyIds.has(item.familyId) && isRealSku(store.data, item)).length,
      updatedAt: canvas?.updatedAt ? canvas.updatedAt.slice(0, 16).replace('T', ' ') : '尚未单独保存',
    }
  })
})

function statusText(status: SpecModelStatus) {
  if (status === 'published') return '已发布'
  if (status === 'offline') return '已下线'
  return '草稿'
}
function ensure(id: string) {
  let canvas = store.data.specCanvases.find((item) => item.templateId === id)
  if (!canvas) {
    const mapping = store.data.mappings.find((item) => item.templateId === id)
    const owner = store.data.productTypes.find((item) => mapping && item.categoryId === mapping.categoryId) || store.data.productTypes[0]
    canvas = {
      templateId: id,
      productTypeId: owner?.id,
      name: store.data.templates.find((item) => item.id === id)?.name || '商品模型',
      zoom: 1,
      panX: 0,
      panY: 0,
      status: 'draft',
      version: 1,
      versionName: 'V1',
      direction: 'ltr',
      updatedAt: new Date().toISOString(),
    }
    store.data.specCanvases.push(canvas)
  }
  return canvas
}
function open(id: string, view: boolean) {
  router.push({ path: '/specs', query: view ? { template: id, mode: 'view' } : { template: id } })
}
function openCreate() {
  const phone = store.data.categories.find((item) => item.id === 'c-phone')
  draft.categoryId = phone?.id || store.data.categories[0]?.id || ''
  draft.productTypeId = store.productTypesOf(draft.categoryId)[0]?.id || ''
  draft.name = ''
  createOpen.value = true
}
function onCategoryValue(value: string | string[]) {
  if (typeof value !== 'string') return
  draft.categoryId = value
  onCategory()
}
function onCategory() {
  draft.productTypeId = typeOptions.value[0]?.id || ''
}
function create() {
  const result = store.createProductModel({ productTypeId: draft.productTypeId, name: draft.name })
  if (!result.ok) {
    ElMessage.warning(result.message)
    return
  }
  createOpen.value = false
  router.push({ path: '/specs', query: { template: result.templateId } })
}
function setStatus(id: string, status: SpecModelStatus) {
  if (status === 'published') {
    const result = store.publishSpecModel(id)
    if (result.ok) ElMessage.success(result.message)
    else ElMessage.warning(result.message)
    return
  }
  const canvas = ensure(id)
  canvas.status = status
  canvas.updatedAt = new Date().toISOString()
  ElMessage.success(status === 'offline' ? '已下线，新商品不能使用，历史商品仍读取创建时的版本' : '已改为草稿，新商品继续使用最近发布版本')
}
function copy(id: string) {
  const source = store.data.templates.find((item) => item.id === id)
  const sourceCanvas = store.data.specCanvases.find((item) => item.templateId === id)
  if (!source || !sourceCanvas?.productTypeId) return
  const name = `${sourceCanvas.name || source.name} 副本`
  const nextId = uid('tpl')
  store.data.templates.push({ ...source, id: nextId, name, parentId: null, structureOrder: [...source.structureOrder] })
  store.data.templateParams.filter((item) => item.templateId === id).forEach((item) => store.data.templateParams.push({ ...item, templateId: nextId }))
  const map = new Map(store.data.productSpecNodes.filter((item) => item.templateId === id).map((item) => [item.id, uid('sn')]))
  store.data.productSpecNodes.filter((item) => item.templateId === id).forEach((item) => {
    store.data.productSpecNodes.push({
      ...item,
      id: map.get(item.id) || uid('sn'),
      templateId: nextId,
      parentId: item.parentId ? map.get(item.parentId) || null : null,
    })
  })
  store.data.specCanvases.push({
    templateId: nextId,
    productTypeId: sourceCanvas.productTypeId,
    name,
    zoom: 1,
    panX: 0,
    panY: 0,
    status: 'draft',
    version: 1,
    versionName: 'V1',
    direction: 'ltr',
    updatedAt: new Date().toISOString(),
  })
  ElMessage.success('已复制模型。新模型是草稿，没有复制商品。')
}
</script>
