<template>
  <div>
    <PageHead title="商品规划" desc="从已发布模型点选一个上层取值。保存后按它下面真实存在的规格路径选择 SPU 并追加多条 SKU。">
      <el-button v-if="activeModel" @click="activeModelId = ''">返回模型列表</el-button>
    </PageHead>
    <div v-if="!activeModel" class="panel">
      <h2>已发布模型</h2>
      <p v-if="models.length === 0" class="muted">还没有已发布的商品模型。请先到商品模型里发布。</p>
      <button v-for="item in models" :key="item.id" type="button" class="model-card" @click="enter(item.id)">
        <strong>{{ item.name }}</strong>
        <span>{{ item.productType }} · {{ item.category }} · {{ item.versionName }}</span>
        <em>进入规划</em>
      </button>
      <h2 v-if="plans.length">已保存的规划</h2>
      <div v-for="item in plans" :key="item.id" class="plan-card">
        <div>
          <strong>{{ item.name }}</strong>
          <span>{{ modelName(item.productModelId) }} · {{ skuCount(item) }} 个 SKU · {{ item.createdTime.slice(0, 16).replace('T', ' ') }}</span>
        </div>
        <div class="row-actions">
          <el-button v-if="productOf(item.id)" link type="primary" @click="router.push(`/spus/${productOf(item.id)}`)">查看 SPU</el-button>
          <el-button link type="primary" @click="generateProduct(item.id)">创建 SKU</el-button>
          <el-button link type="primary" @click="openPlan(item.id)">继续编辑</el-button>
          <el-button link type="danger" @click="removePlan(item.id)">删除</el-button>
        </div>
      </div>
    </div>
    <div v-else class="plan-board">
      <section class="panel tree-pane">
        <h2>{{ activeModel.name }}</h2>
        <p class="muted">点选车型或型号这一层。系统会展开它下面真实存在的电池、颜色等路径，不会搭配树上没有的组合。选到最末一级时，只会生成这一条 SKU。</p>
        <div v-for="row in treeRows" :key="row.node.id" class="tree-line" :style="{ paddingLeft: row.depth * 22 + 'px' }">
          <strong v-if="row.node.nodeType === 'ATTRIBUTE'">{{ attrName(row.node.attributeId) }}</strong>
          <el-checkbox v-else :model-value="selectedIds.includes(row.node.id)" @change="choose(row.node.id)">{{ row.node.valueId }}</el-checkbox>
        </div>
      </section>
      <section class="panel result-pane">
        <h2>规划结果</h2>
        <p class="muted">产品名称</p>
        <el-input v-model="planName" placeholder="选择取值后自动生成，也可以改名" />
        <p class="muted">已选择节点</p>
        <p v-if="chosen.length === 0" class="muted">还没有选择。</p>
        <p v-for="item in chosen" :key="item.id" class="chosen">
          <span>{{ attrName(item.attributeId) }}</span>
          <strong>{{ item.valueId }}</strong>
        </p>
        <p v-if="preview" class="sku-preview">按当前选择，将生成 {{ preview.skus.length }} 个 SKU。</p>
        <p v-for="item in preview?.skus || []" :key="item.name" class="chosen"><span>SKU</span><strong>{{ item.name }}</strong></p>
        <div class="row-actions">
          <el-button type="primary" @click="save">保存规划</el-button>
          <el-button v-if="generatedId" @click="router.push(`/spus/${generatedId}`)">查看 SPU</el-button>
          <el-button :disabled="!editingPlanId" @click="generateProduct(editingPlanId)">创建 SKU</el-button>
        </div>
        <p v-if="!editingPlanId" class="muted">保存规划后才能创建 SKU。</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHead from '../components/PageHead.vue'
import { categoryPath, latestPublishedVersion, orderedPlanNodes, paramById, planSkuLines, planTitle, specCanvasOf, togglePlanValue } from '../domain/logic'
import type { ProductPlan, ProductSpecNode } from '../domain/types'
import { uid, useCatalogStore } from '../stores/catalog'

const store = useCatalogStore()
const router = useRouter()
const activeModelId = ref('')
const planningVersionId = ref('')
const editingPlanId = ref('')
const selectedIds = ref<string[]>([])
const planName = ref('')

const models = computed(() =>
  store.data.specCanvases.flatMap((canvas) => {
    const version = latestPublishedVersion(store.data, canvas.templateId)
    if (!version) return []
    const productType = store.data.productTypes.find((item) => item.id === canvas.productTypeId)
    return [{
      id: canvas.templateId,
      name: canvas.name || store.data.templates.find((item) => item.id === canvas.templateId)?.name || '未命名模型',
      productTypeId: canvas.productTypeId || '',
      productType: productType?.name || '未指定',
      category: productType ? categoryPath(store.data, productType.categoryId) : '未指定',
      versionName: version.versionName,
      versionId: version.id,
    }]
  }),
)
const plans = computed(() => (store.data.productPlans || []).slice().sort((a, b) => b.createdTime.localeCompare(a.createdTime)))
const activeModel = computed(() => models.value.find((item) => item.id === activeModelId.value))
const snapshot = computed(() => store.data.specModelVersions.find((item) => item.id === planningVersionId.value && item.status === 'published')?.nodesSnapshot || [])
const treeRows = computed(() => {
  const rows: { node: ProductSpecNode; depth: number }[] = []
  const walk = (parentId: string | null, depth: number) => {
    snapshot.value
      .filter((item) => item.parentId === parentId)
      .sort((a, b) => a.sort - b.sort)
      .forEach((node) => {
        rows.push({ node, depth })
        walk(node.id, depth + 1)
      })
  }
  walk(null, 0)
  return rows
})
const chosen = computed(() => orderedPlanNodes(snapshot.value, selectedIds.value))
const preview = computed(() => {
  if (!activeModel.value || !planningVersionId.value || !selectedIds.value.length) return null
  return planSkuLines(store.data, {
    id: 'preview',
    productModelId: activeModel.value.id,
    productTypeId: activeModel.value.productTypeId,
    modelVersionId: planningVersionId.value,
    name: planName.value || '预览',
    status: 'saved',
    selectedNodes: selectedIds.value,
    createdTime: '',
  })
})
const generatedId = computed(() => (editingPlanId.value ? productOf(editingPlanId.value) : ''))

function attrName(id: string) {
  return paramById(store.data, id)?.name || '属性'
}
function skuCount(plan: ProductPlan) {
  return planSkuLines(store.data, plan)?.skus.length || 0
}
function modelName(id: string) {
  return specCanvasOf(store.data, id)?.name || store.data.templates.find((item) => item.id === id)?.name || '商品模型'
}
function productOf(planId: string) {
  return store.data.families.find((item) => item.productPlanId === planId)?.id || store.data.skus.find(item => item.creationSource?.productPlanId === planId)?.familyId || ''
}
function generateProduct(id: string) {
  if (store.data.productPlans.some(item => item.id === id)) router.push({ path: '/skus/new', query: { plan: id } })
}
function enter(id: string) {
  const model = models.value.find((item) => item.id === id)
  activeModelId.value = id
  planningVersionId.value = model?.versionId || ''
  editingPlanId.value = ''
  selectedIds.value = []
  planName.value = ''
}
function choose(id: string) {
  selectedIds.value = togglePlanValue(snapshot.value, selectedIds.value, id)
  planName.value = planTitle(snapshot.value, selectedIds.value)
}
function openPlan(id: string) {
  const plan = store.data.productPlans.find((item) => item.id === id)
  if (!plan) return
  const version = plan.modelVersionId ? store.data.specModelVersions.find((item) => item.id === plan.modelVersionId) : latestPublishedVersion(store.data, plan.productModelId)
  if (!version || version.status !== 'published') {
    ElMessage.warning('这个规划对应的模型版本已经不能使用')
    return
  }
  activeModelId.value = plan.productModelId
  planningVersionId.value = version.id
  editingPlanId.value = plan.id
  const alive = new Set(version.nodesSnapshot.map((item) => item.id))
  selectedIds.value = plan.selectedNodes.filter((item) => alive.has(item))
  planName.value = plan.name
}
function save() {
  const model = activeModel.value
  if (!model) return
  const nodes = orderedPlanNodes(snapshot.value, selectedIds.value).map((item) => item.id)
  const name = planName.value.trim()
  if (!nodes.length || !name) {
    ElMessage.warning('请先选择取值')
    return
  }
  if (!model.productTypeId) {
    ElMessage.warning('这个模型还没有产品类型')
    return
  }
  const current = editingPlanId.value ? store.data.productPlans.find((item) => item.id === editingPlanId.value) : undefined
  if (current) {
    current.name = name
    current.productModelId = model.id
    current.productTypeId = model.productTypeId
    current.modelVersionId = planningVersionId.value
    current.selectedNodes = nodes
    current.status = 'saved'
    ElMessage.success('已更新规划')
    return
  }
  const plan: ProductPlan = {
    id: uid('plan'),
    productModelId: model.id,
    productTypeId: model.productTypeId,
    modelVersionId: planningVersionId.value,
    name,
    status: 'saved',
    selectedNodes: nodes,
    createdTime: new Date().toISOString(),
  }
  store.data.productPlans.unshift(plan)
  editingPlanId.value = plan.id
  ElMessage.success('已保存规划')
}
function removePlan(id: string) {
  if (productOf(id)) { ElMessage.warning('这个规划已有 SPU 或 SKU 来源关联，不能直接删除。'); return }
  store.data.productPlans = store.data.productPlans.filter((item) => item.id !== id)
  if (editingPlanId.value === id) editingPlanId.value = ''
  ElMessage.success('已删除规划')
}
</script>

<style scoped>
.plan-board { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr); gap: 14px; }
.tree-pane, .result-pane { min-height: 420px; }
.model-card, .plan-card { width: 100%; display: flex; justify-content: space-between; gap: 12px; align-items: center; text-align: left; background: #f7faff; border: 1px solid #e6edf5; border-radius: 10px; padding: 14px 16px; margin-bottom: 10px; }
.model-card { cursor: pointer; }
.model-card strong, .plan-card strong { display: block; }
.model-card span, .plan-card span { color: #66788a; font-size: 13px; }
.model-card em { color: #1677ff; font-style: normal; }
.tree-line { min-height: 32px; display: flex; align-items: center; }
.chosen { display: flex; justify-content: space-between; margin: 8px 0; }
.chosen span { color: #66788a; }
.sku-preview { margin: 12px 0 4px; color: #1f3b66; }
.result-pane .el-input { margin: 8px 0 16px; }
@media (max-width: 900px) {
  .plan-board { grid-template-columns: 1fr; }
}
</style>
