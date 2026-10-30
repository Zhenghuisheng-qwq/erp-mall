<template>
  <div class="panel" v-if="family">
    <div class="head">
      <div>
        <h2>{{ family.name }}</h2>
        <p v-if="active" class="muted">物料 {{ active.materialCode?.trim() || '未分配编码' }} · 规划 {{ active.planningId?.trim() || '无规划编号' }}</p>
      </div>
      <button v-if="modelId" type="button" class="linkish" @click="router.push(`/specs?template=${modelId}`)">返回商品模型</button>
    </div>
    <section class="basics">
      <h3>商品基本信息</h3>
      <label>商品名称<span class="req">必填</span><el-input :disabled="!store.can('product:material:update')" v-model="productName" maxlength="80" /></label>
      <p class="muted">所属分类 {{ category || '未记录分类' }}</p>
      <p class="muted">产品类型 {{ typeName }}</p>
      <p class="muted">来源模型 {{ modelName }} · {{ versionName(family.modelVersionId) }}</p>
      <p class="muted">当前状态 {{ shelfText(shelfOf(family)) }}</p>
      <p class="muted">适用身份 {{ identity.label }}。{{ identity.note }}</p>
      <div class="row-actions">
        <el-button type="primary" :disabled="!store.can('product:material:update')" @click="saveProductName">保存商品名称</el-button>
      </div>
      <p v-if="nameError" class="warn">{{ nameError }}</p>
    </section>
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
        <p class="muted">规划编号 {{ active.planningId?.trim() || '无' }} · {{ versionName(active.modelVersionId) }}</p>
        <p v-for="item in active.manualAttrs || []" :key="item.attributeId" class="muted">{{ item.attributeName }} {{ item.value }} · {{ item.source === 'manual' ? '手工填写' : '词典取值' }}</p>
        <p v-if="active.manualAttrs?.some((item) => item.source === 'manual')" class="muted">手工填写的值只属于这条物料，不会改成词典取值，也不会写进商品模型。</p>
        <h3>物料</h3>
        <MaterialSourceList :material-id="active.id" />
        <label>物料名称<span class="req">必填</span><el-input :disabled="!store.can('product:material:update')" v-model="draft.skuName" /></label>
        <p v-if="active.nameSource" class="muted">名称来源：{{ originLabel(active.nameSource) }}。当前显示的是已保存名称。</p>
        <p v-if="active.suggestedName" class="muted">建档时的建议名称：{{ active.suggestedName }}</p>
        <label>物料描述<el-input :disabled="!store.can('product:material:update')" v-model="draft.materialDescription" type="textarea" :rows="3" /></label>
        <h3>系统编码</h3>
        <label>系统物料编号
          <div class="code-line">
            <el-input :model-value="active.materialCode || '未分配'" readonly />
            <el-button native-type="button" :disabled="!active.materialCode?.trim()" @click="copyMaterialCode">复制</el-button>
          </div>
        </label>
        <p class="muted">创建时自动生成。已有编号只读，不能修改，也不能重新生成。</p>
        <label>供应商编码<span class="opt">可选</span><el-input :disabled="!store.can('product:material:update')" v-model="draft.supplierCode" clearable placeholder="可留空" /></label>
        <p v-if="errorText" class="warn">{{ errorText }}</p>
        <div class="row-actions">
          <el-button type="primary" native-type="submit" :disabled="!store.can('product:material:update')">保存物料</el-button>
          <el-button :disabled="!store.can('product:material:update')" @click="regenerate">按当前规则生成名称</el-button>
        </div>




      </form>
    </div>
  </div>
  <div v-else class="panel"><p>没有找到这款商品。</p></div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import MaterialSourceList from './MaterialSourceList.vue'
import { isMaterialArchive } from '../domain/catalogIdentity'
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { categoryPath, modelVersionById, shelfOf, shelfText, specCanvasOf } from '../domain/logic'
import { materialNameOriginLabel, suggestMaterialName } from '../domain/naming'
import type { Sku } from '../domain/types'
import { useCatalogStore } from '../stores/catalog'

const props = defineProps<{ familyId: string; skuId?: string }>()
const store = useCatalogStore()
const router = useRouter()
const keyword = ref('')
const activeId = ref(props.skuId || '')
const errorText = ref('')
const draft = reactive({ skuName: '', materialDescription: '', supplierCode: '' })
const productName = ref('')
const nameError = ref('')
const family = computed(() => store.data.families.find((item) => item.id === props.familyId && item.line === 'v3'))
const category = computed(() => (family.value ? categoryPath(store.data, family.value.categoryId) : ''))
const typeName = computed(() => store.data.productTypes.find((item) => item.id === family.value?.productTypeId)?.name || '未记录产品类型')
const identity = computed(() => {
  const current = family.value
  if (!current) return { label: '未标记', note: '' }
  const type = store.data.productTypes.find((item) => item.id === current.productTypeId)
  const role = type?.catalogRole
  const label = role === 'host' ? '主机' : role === 'accessory' ? '配件' : '未标记'
  const note = type?.catalogRole ? '来自产品类型的显式标记。' : '产品类型尚未指定业务用途。'
  return { label, note }
})
const modelId = computed(() => family.value?.productModelId || family.value?.templateId || '')
const modelName = computed(() => (modelId.value ? specCanvasOf(store.data, modelId.value)?.name || '商品模型' : ''))
const materials = computed(() => store.data.skus.filter((item) => item.familyId === props.familyId && isMaterialArchive(store.data, item)))
const filtered = computed(() => {
  const text = keyword.value.trim()
  const rows = text ? materials.value.filter((item) => `${item.materialCode || ''} ${item.skuName || ''} ${item.materialDescription || ''} ${item.supplierCode || ''} ${item.guanjiapoCode || ''}`.includes(text)) : materials.value
  return rows.slice().sort((a, b) => (a.materialCode || '').localeCompare(b.materialCode || ''))
})
const active = computed(() => materials.value.find((item) => item.id === activeId.value) || filtered.value[0])

watch(family, (row) => {
  productName.value = row?.name || ''
  nameError.value = ''
}, { immediate: true })
async function saveProductName() {
  if (!family.value) return
  const result = store.renameProduct(family.value.id, productName.value)
  if (!result.ok) {
    nameError.value = result.message
    return
  }
  const saved = await store.flushPersistence()
  if (!saved.ok) { nameError.value = store.persistenceState.message || '商品名称尚未保存，当前输入已保留。'; return }
  nameError.value = ''
  productName.value = family.value.name
  ElMessage.success('商品名称已保存')
}
watch(active, (sku) => {
  if (!sku) return
  activeId.value = sku.id
  errorText.value = ''
  draft.skuName = sku.skuName || ''
  draft.materialDescription = sku.materialDescription || ''
  draft.supplierCode = sku.supplierCode || ''
}, { immediate: true })

function specText(sku: Sku) {
  const common = family.value?.commonAttrs || {}
  return Object.entries({ ...common, ...sku.variantAttrs }).filter(([, value]) => value).map(([name, value]) => `${name} ${value}`).join(' · ')
}
function versionName(id?: string) {
  if (!id) return '未记录版本'
  return modelVersionById(store.data, id)?.versionName || '未记录版本'
}
function originLabel(source?: string) {
  return materialNameOriginLabel(source)
}
function regenerate() {
  if (!active.value || !family.value) return
  const model = family.value.productModelId || family.value.templateId
  const record = store.data.planningRecords.find((item) => item.planningId === active.value?.planningId)
    const scope = store.data.materialRelations?.find(r => r.materialId === active.value?.id && r.kind === 'scope-v1' && r.original)
    const versionId = scope?.source.versionId || active.value.modelVersionId || record?.modelVersionId || ''
    const steps = scope?.prefix || record?.steps
    if (!versionId || !steps) {
    errorText.value = '这条物料没有可追溯的已发布版本。'
    return
  }
  const suggestion = suggestMaterialName(store.data, {
    productModelId: model,
    modelVersionId: versionId,
    productTypeName: store.data.productTypes.find((item) => item.id === family.value?.productTypeId)?.name || '',
      steps: steps.map((step) => ({ valueNodeId: step.valueNodeId, attributeId: step.attributeId, valueId: step.valueId })),
  })
  if (suggestion.canAuto === false) {
    errorText.value = suggestion.message
    return
  }
  draft.skuName = suggestion.name
  errorText.value = `按建档时的发布版本，名称会改成「${suggestion.name}」。保存后才会写入。`
}
async function copyMaterialCode() {
  const code = active.value?.materialCode?.trim()
  if (!code) return
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(code)
    else {
      const area = document.createElement('textarea')
      area.value = code
      area.setAttribute('readonly', 'true')
      area.style.position = 'fixed'
      area.style.left = '-9999px'
      document.body.appendChild(area)
      area.select()
      const copied = document.execCommand('copy')
      area.remove()
      if (!copied) throw new Error('copy')
    }
    ElMessage.success('已复制系统物料编号')
  } catch {
    ElMessage.warning('没能复制，请选中编号后手动复制')
  }
}
async function save() {
  if (!active.value) return
  const result = store.updateMaterial({
    skuId: active.value.id,
    skuName: draft.skuName,
    supplierCode: draft.supplierCode,
    guanjiapoCode: active.value.guanjiapoCode || '',
    oaSkuId: active.value.oaSkuId || '',
    materialDescription: draft.materialDescription,
  })
  if (!result.ok) {
    errorText.value = result.message
    return
  }
  const saved = await store.flushPersistence()
  if (!saved.ok) { errorText.value = store.persistenceState.message || '物料尚未保存，当前输入已保留。'; return }
  errorText.value = ''
  ElMessage.success('物料已保存')
}
</script>

<style scoped>
.head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
.basics { margin: 14px 0; padding-bottom: 12px; border-bottom: 1px solid var(--border-default); }
.basics h3 { margin: 0 0 8px; font-size: 15px; }
.basics label { display: block; margin: 8px 0 4px; font-size: 13px; }
.basics .el-input { max-width: 360px; }
.basics .muted { margin-top: 4px; }
.archive { display: grid; grid-template-columns: minmax(220px, 0.8fr) minmax(280px, 1.2fr); gap: 18px; }
.materials { margin: 8px 0 0; padding: 0; list-style: none; max-height: 420px; overflow: auto; }
.materials button { width: 100%; border: 0; border-bottom: 1px solid #eef2f6; background: transparent; padding: 8px 4px; text-align: left; cursor: pointer; }
.materials button.is-on { background: #f3f8ff; }
.materials strong, .sheet h3 { display: block; margin: 0; }
.materials span, .materials em, .muted { display: block; color: #607089; font-size: 13px; font-style: normal; }
.sheet label { display: block; margin: 10px 0 4px; color: var(--text-primary, #303133); font-size: 13px; }
.code-line { display: flex; gap: 8px; align-items: center; margin-top: 4px; }
.code-line .el-input { flex: 1; min-width: 0; }
.req { margin-left: 6px; color: #c45656; font-size: 12px; }
.opt { margin-left: 6px; color: var(--text-secondary, #607089); font-size: 12px; }
.sheet h3 { margin-top: 14px; }
.warn { color: #c45656; }
.linkish { border: 0; background: none; color: #1677ff; cursor: pointer; padding: 0; }
@media (max-width: 900px) {
  .archive { grid-template-columns: 1fr; }
}
</style>
