<template>
  <div>
    <PageHead title="商品模型" desc="从这里进入模型设计。发布会留下版本快照。新建商品用最新发布版，历史商品保持创建时的版本。">
    </PageHead>
    <div class="panel">
      <el-table :data="rows">
        <el-table-column prop="name" label="模型名称" min-width="140" />
        <el-table-column prop="scheme" label="所属属性方案" min-width="140" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">{{ statusText(row.status) }}</template>
        </el-table-column>
        <el-table-column prop="version" label="版本" width="80" />
        <el-table-column prop="categories" label="绑定分类数量" width="120" />
        <el-table-column prop="products" label="商品数量" width="100" />
        <el-table-column prop="skus" label="SKU数量" width="100" />
        <el-table-column prop="updatedAt" label="更新时间" width="160" />
        <el-table-column label="操作" width="320" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="open(row.id, true)">查看模型</el-button>
            <el-button link type="primary" @click="open(row.id, false)">编辑模型</el-button>
            <el-button link @click="copy(row.id)">复制模型</el-button>
            <el-button link @click="setStatus(row.id, 'published')">发布模型</el-button>
            <el-button link @click="setStatus(row.id, 'offline')">下线模型</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import PageHead from '../components/PageHead.vue'
import type { SpecModelStatus } from '../domain/types'
import { uid, useCatalogStore } from '../stores/catalog'

const store = useCatalogStore()
const router = useRouter()
const rows = computed(() => {
  const ids = new Set<string>([
    ...store.data.specCanvases.map((item) => item.templateId),
    ...store.data.productSpecNodes.map((item) => item.templateId),
  ])
  return [...ids].map((id) => {
    const scheme = store.data.templates.find((item) => item.id === id)
    const canvas = store.data.specCanvases.find((item) => item.templateId === id)
    const published = store.data.specModelVersions.filter((item) => item.templateId === id && item.status === 'published').slice().sort((a, b) => a.version - b.version)
    const latest = published[published.length - 1]
    const families = store.data.families.filter((item) => item.templateId === id)
    const familyIds = new Set(families.map((item) => item.id))
    return {
      id,
      name: `${scheme?.name || '未命名'}模型`,
      scheme: scheme?.name || '未命名方案',
      status: canvas?.status || (latest ? 'published' : 'draft'),
      version: canvas?.status === 'draft' ? canvas.versionName || `V${(latest?.version || 0) + 1}` : latest?.versionName || canvas?.versionName || 'V1',
      categories: store.data.mappings.filter((item) => item.templateId === id).length,
      products: families.length,
      skus: store.data.skus.filter((item) => familyIds.has(item.familyId)).length,
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
    canvas = { templateId: id, zoom: 1, panX: 0, panY: 0, status: 'draft', version: 1, versionName: 'V1', direction: 'ltr', updatedAt: new Date().toISOString() }
    store.data.specCanvases.push(canvas)
  }
  return canvas
}
function open(id: string, view: boolean) {
  router.push({ path: '/specs', query: view ? { template: id, mode: 'view' } : { template: id } })
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
  if (!source) return
  const nextId = uid('tpl')
  store.data.templates.push({ ...source, id: nextId, name: `${source.name} 副本`, parentId: null, structureOrder: [...source.structureOrder] })
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
  store.data.specCanvases.push({ templateId: nextId, zoom: 1, panX: 0, panY: 0, status: 'draft', version: 1, versionName: 'V1', direction: 'ltr', updatedAt: new Date().toISOString() })
  ElMessage.success('已复制模型。新模型是草稿，没有复制商品。')
}
</script>
