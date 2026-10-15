<template>
  <div class="v3-flow">
    <h2>选择规格并创建物料</h2>
    <p v-if="models.length === 0" class="muted">这个分类下还没有已发布的商品模型。没有模型的商品仍按原来的方式录入。</p>
    <template v-else>
      <p v-if="typeOptions.length > 1">
        <span class="label">产品类型</span>
        <el-select :model-value="productTypeId" placeholder="选择产品类型" style="width: 280px" @change="onType">
          <el-option v-for="item in typeOptions" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
      </p>
      <p v-else-if="currentType"><span class="label">产品类型</span>{{ currentType.name }}</p>
      <p v-if="modelOptions.length > 1">
        <span class="label">商品模型</span>
        <el-select :model-value="productModelId" placeholder="选择已发布模型" style="width: 280px" @change="onModel">
          <el-option v-for="item in modelOptions" :key="item.productModelId" :label="`${item.modelName} · ${item.versionName}`" :value="item.productModelId" />
        </el-select>
      </p>
      <p v-else-if="currentModel"><span class="label">商品模型</span>{{ currentModel.modelName }} · {{ currentModel.versionName }}</p>
      <p v-if="rows.length" class="muted">点一条规格。容量、颜色这些已经在模型里，不用再填一遍。</p>
      <div class="row-actions">
        <el-button v-if="currentModel" @click="temporaryOpen = true">创建临时物料</el-button>
      </div>
      <ul v-if="rows.length" class="combos">
        <li v-for="row in rows" :key="row.identityKey">
          <button type="button" :class="{ 'is-on': row.planningId && row.planningId === planningId }" :disabled="!row.planningId || row.retired" @click="planningId = row.planningId">
            <span>{{ row.label }}</span>
            <em>{{ row.retired ? '已停用' : row.planningId ? `${row.planningId} · ${gradeText(row.grade)} · ${filingText(row.grade, row.materialCount)}` : '未编号' }}</em>
          </button>
        </li>
      </ul>
      <V3MaterialActions
        v-if="currentModel && planningId"
        :product-model-id="currentModel.productModelId"
        :model-version-id="currentModel.versionId"
        :planning-id="planningId"
        :category-id="categoryId"
        :product-type-id="currentModel.productTypeId"
        :retired="selectedRetired"
      />
      <TemporaryMaterialDialog :open="temporaryOpen" :category-id="categoryId" :product-type-id="currentModel?.productTypeId || ''" :product-model-id="currentModel?.productModelId" :model-version-id="currentModel?.versionId" @close="temporaryOpen = false" @open="openMade" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { filingText, gradeText, materialOfferings, publishedModelsForCategory } from '../domain/material'
import { useCatalogStore } from '../stores/catalog'
import TemporaryMaterialDialog from './TemporaryMaterialDialog.vue'
import V3MaterialActions from './V3MaterialActions.vue'

const props = defineProps<{ categoryId: string }>()
const store = useCatalogStore()
const router = useRouter()
const productTypeId = ref('')
const productModelId = ref('')
const planningId = ref('')
const temporaryOpen = ref(false)
const prepared = new Set<string>()

const models = computed(() => publishedModelsForCategory(store.data, props.categoryId))
const typeOptions = computed(() => {
  const seen = new Set<string>()
  return models.value.filter((item) => {
    if (seen.has(item.productTypeId)) return false
    seen.add(item.productTypeId)
    return true
  }).map((item) => ({ id: item.productTypeId, name: item.productTypeName }))
})
const currentType = computed(() => typeOptions.value.find((item) => item.id === productTypeId.value))
const modelOptions = computed(() => models.value.filter((item) => item.productTypeId === productTypeId.value))
const currentModel = computed(() => modelOptions.value.find((item) => item.productModelId === productModelId.value))
const rows = computed(() => (currentModel.value ? materialOfferings(store.data, currentModel.value.productModelId).rows : []))
const selectedRetired = computed(() => rows.value.find((item) => item.planningId === planningId.value)?.retired || false)

watch(models, align, { immediate: true })
watch(() => props.categoryId, () => {
  productTypeId.value = ''
  productModelId.value = ''
  planningId.value = ''
  align()
})

function align() {
  if (!typeOptions.value.some((item) => item.id === productTypeId.value)) productTypeId.value = typeOptions.value[0]?.id || ''
  if (!modelOptions.value.some((item) => item.productModelId === productModelId.value)) productModelId.value = modelOptions.value[0]?.productModelId || ''
  if (!rows.value.some((item) => item.planningId === planningId.value)) planningId.value = ''
}
function onType(id: string) {
  productTypeId.value = id
  productModelId.value = ''
  planningId.value = ''
  align()
}
function onModel(id: string) {
  productModelId.value = id
  planningId.value = ''
}
watch(currentModel, (model) => {
  if (!model || prepared.has(model.productModelId)) return
  const offering = materialOfferings(store.data, model.productModelId)
  const missing = offering.version && offering.rows.length > 0 && offering.rows.every((item) => !item.planningId)
  if (!missing) return
  prepared.add(model.productModelId)
  store.publishSpecModel(model.productModelId)
}, { immediate: true })
function openMade(familyId: string, skuId: string) {
  temporaryOpen.value = false
  router.push(`/products/${familyId}?sku=${skuId}`)
}
</script>

<style scoped>
.label { display: inline-block; width: 72px; color: #607089; }
.combos { margin: 8px 0 12px; padding: 0; list-style: none; max-height: 240px; overflow: auto; border: 1px solid #e6edf5; border-radius: 8px; }
.combos button { width: 100%; display: flex; justify-content: space-between; gap: 12px; border: 0; border-bottom: 1px solid #f0f3f7; background: #fff; padding: 8px 12px; text-align: left; cursor: pointer; }
.combos button.is-on { background: #f3f8ff; }
.combos em { color: #1677ff; font-style: normal; white-space: nowrap; }
</style>
