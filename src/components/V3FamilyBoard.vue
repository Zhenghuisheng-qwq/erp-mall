<template>
  <div class="panel" v-if="family">
    <div class="head">
      <div>
        <h2>{{ family.name }}</h2>
        <p class="muted">{{ category }} · {{ modelName }}。规格来自建档时的模型，这里只改物料档案。</p>
      </div>
      <button v-if="modelId" type="button" class="linkish" @click="router.push(`/specs?template=${modelId}`)">返回商品模型</button>
    </div>
    <div class="archive">
      <section>
        <el-input v-model="keyword" placeholder="搜编码、名称或描述" clearable />
        <p v-if="filtered.length === 0" class="muted">还没有物料。</p>
        <ul class="materials">
          <li v-for="item in filtered" :key="item.id">
            <button type="button" :class="{ 'is-on': item.id === activeId }" @click="activeId = item.id">
              <strong>{{ item.materialCode || '未编号' }}</strong>
              <span>{{ item.skuName || '未命名物料' }}</span>
              <em>{{ specText(item) }}</em>
            </button>
          </li>
        </ul>
      </section>
      <form v-if="active" class="sheet" @submit.prevent="save">
        <h3>规格</h3>
        <p>{{ specText(active) }}</p>
        <p class="muted">规划编号 {{ active.planningId || '无' }} · {{ versionName(active.modelVersionId) }}</p>
        <p v-for="item in active.manualAttrs || []" :key="item.attributeId" class="muted">{{ item.attributeName }} {{ item.value }} · {{ item.source === 'manual' ? '手工填写' : '词典取值' }}</p>
        <p v-if="active.manualAttrs?.some((item) => item.source === 'manual')" class="muted">手工填写的值只属于这条物料，不会改成词典取值，也不会写进商品模型。</p>
        <h3>物料</h3>
        <label>物料名称<span class="req">必填</span><el-input v-model="draft.skuName" /></label>
        <label>物料描述<el-input v-model="draft.materialDescription" type="textarea" :rows="3" /></label>
        <h3>编码</h3>
        <label>系统物料编码<el-input :model-value="active.materialCode || ''" disabled /></label>
        <label>供应商编码<el-input v-model="draft.supplierCode" /></label>
        <label>管家婆编号<el-input v-model="draft.guanjiapoCode" /></label>
        <label>OA SKU 编号<el-input v-model="draft.oaSkuId" /></label>
        <p v-if="errorText" class="warn">{{ errorText }}</p>
        <div class="row-actions">
          <el-button type="primary" native-type="submit">保存物料</el-button>
          <el-button @click="regenerate">按当前规则生成名称</el-button>
        </div>
        <h3 v-if="accessoryMode">适用主机</h3>
        <template v-if="accessoryMode && active">
          <p class="muted">已关联 {{ skuHosts.length }} 款主机。这是在维护适用关系，不是新建物料。</p>
          <p v-for="item in skuHosts" :key="item.id">{{ item.label }}<span v-if="item.host.scope === 'planning'"> · 仅指定规格</span></p>
          <p v-if="skuHosts.length === 0" class="muted">还没有适用主机。</p>
          <el-button @click="router.push(`/compatibility?sku=${active.id}`)">添加适用主机</el-button>
        </template>
        <h3 v-if="familyHosts.length">适用配件</h3>
        <p v-for="item in familyHosts" :key="item.key" class="muted">
          {{ item.label }} · 已关联 {{ item.accessoryCount }} 条
          <el-button link type="primary" @click="router.push({ path: '/compatibility', query: { model: item.host.productModelId, key: item.host.identityKey } })">管理适用配件</el-button>
        </p>
      </form>
    </div>
  </div>
  <div v-else class="panel"><p>没有找到这款商品。</p></div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { catalogRole, hostLabel, linksOfSku, listHostModels } from '../domain/compatibility'
import { categoryPath, latestPublishedVersion, modelVersionById, specCanvasOf } from '../domain/logic'
import { suggestMaterialName } from '../domain/naming'
import type { Sku } from '../domain/types'
import { useCatalogStore } from '../stores/catalog'

const props = defineProps<{ familyId: string; skuId?: string }>()
const store = useCatalogStore()
const router = useRouter()
const keyword = ref('')
const activeId = ref(props.skuId || '')
const errorText = ref('')
const draft = reactive({ skuName: '', materialDescription: '', supplierCode: '', guanjiapoCode: '', oaSkuId: '' })
const family = computed(() => store.data.families.find((item) => item.id === props.familyId && item.line === 'v3'))
const category = computed(() => (family.value ? categoryPath(store.data, family.value.categoryId) : ''))
const modelId = computed(() => family.value?.productModelId || family.value?.templateId || '')
const modelName = computed(() => (modelId.value ? specCanvasOf(store.data, modelId.value)?.name || '商品模型' : ''))
const materials = computed(() => store.data.skus.filter((item) => item.familyId === props.familyId))
const filtered = computed(() => {
  const text = keyword.value.trim()
  const rows = text ? materials.value.filter((item) => `${item.materialCode || ''} ${item.skuName || ''} ${item.materialDescription || ''} ${item.supplierCode || ''} ${item.guanjiapoCode || ''}`.includes(text)) : materials.value
  return rows.slice().sort((a, b) => (a.materialCode || '').localeCompare(b.materialCode || ''))
})
const active = computed(() => materials.value.find((item) => item.id === activeId.value) || filtered.value[0])
const accessoryMode = computed(() => (family.value ? catalogRole(store.data, family.value.categoryId) === 'accessory' : false))
const skuHosts = computed(() => (active.value ? linksOfSku(store.data, active.value.id) : []).map((item) => ({ ...item, label: hostLabel(item.host) })))
const familyHosts = computed(() => {
  if (!family.value || catalogRole(store.data, family.value.categoryId) !== 'host') return []
  const plans = new Set(materials.value.map((item) => item.planningId).filter(Boolean))
  return listHostModels(store.data).filter((item) => item.planningIds.some((id) => plans.has(id)))
})

watch(active, (sku) => {
  if (!sku) return
  activeId.value = sku.id
  errorText.value = ''
  draft.skuName = sku.skuName || ''
  draft.materialDescription = sku.materialDescription || ''
  draft.supplierCode = sku.supplierCode || ''
  draft.guanjiapoCode = sku.guanjiapoCode || ''
  draft.oaSkuId = sku.oaSkuId || ''
}, { immediate: true })

function specText(sku: Sku) {
  const common = family.value?.commonAttrs || {}
  return Object.entries({ ...common, ...sku.variantAttrs }).filter(([, value]) => value).map(([name, value]) => `${name} ${value}`).join(' · ')
}
function versionName(id?: string) {
  if (!id) return '未记录版本'
  return modelVersionById(store.data, id)?.versionName || '未记录版本'
}
function regenerate() {
  if (!active.value || !family.value) return
  const model = family.value.productModelId || family.value.templateId
  const version = latestPublishedVersion(store.data, model)
  const record = store.data.planningRecords.find((item) => item.planningId === active.value?.planningId)
  if (!version || !record) {
    errorText.value = '当前没有已发布的命名规则。'
    return
  }
  const suggestion = suggestMaterialName(store.data, {
    productModelId: model,
    modelVersionId: version.id,
    productTypeName: store.data.productTypes.find((item) => item.id === family.value?.productTypeId)?.name || '',
    steps: record.steps.map((step) => ({ valueNodeId: step.valueNodeId, attributeId: step.attributeId, valueId: step.valueId })),
  })
  if (suggestion.status === 'conflict') {
    errorText.value = suggestion.message
    return
  }
  draft.skuName = suggestion.name
  errorText.value = `按当前已发布规则，名称会改成「${suggestion.name}」。保存后才会写入。`
}
function save() {
  if (!active.value) return
  const result = store.updateMaterial({ skuId: active.value.id, ...draft })
  if (!result.ok) {
    errorText.value = result.message
    return
  }
  errorText.value = ''
  ElMessage.success('物料已保存')
}
</script>

<style scoped>
.head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
.archive { display: grid; grid-template-columns: minmax(220px, 0.8fr) minmax(280px, 1.2fr); gap: 18px; }
.materials { margin: 8px 0 0; padding: 0; list-style: none; max-height: 420px; overflow: auto; }
.materials button { width: 100%; border: 0; border-bottom: 1px solid #eef2f6; background: transparent; padding: 8px 4px; text-align: left; cursor: pointer; }
.materials button.is-on { background: #f3f8ff; }
.materials strong, .sheet h3 { display: block; margin: 0; }
.materials span, .materials em, .muted { display: block; color: #607089; font-size: 13px; font-style: normal; }
.sheet label { display: block; margin: 10px 0 4px; color: #303133; font-size: 13px; }
.req { margin-left: 6px; color: #c45656; font-size: 12px; }
.sheet h3 { margin-top: 14px; }
.warn { color: #c45656; }
.linkish { border: 0; background: none; color: #1677ff; cursor: pointer; padding: 0; }
@media (max-width: 900px) {
  .archive { grid-template-columns: 1fr; }
}
</style>
