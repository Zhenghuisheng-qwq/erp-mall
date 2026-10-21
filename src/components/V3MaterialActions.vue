<template>
  <div class="v3-actions" :class="{ 'is-bare': bare }">
    <template v-if="!bare">
    <p v-if="retired">这条规格已经停用，不能再建档。</p>
    <p v-else-if="!planningId" class="muted">发布模型后，这里才能创建物料。</p>
    <template v-else-if="preview">
      <p class="spec">{{ preview.label }}</p>
      <p class="meta">规划编号 {{ preview.planningId }} · {{ preview.versionName }} · {{ gradeLabel }} · {{ filingLabel }} · {{ codeText || '尚未建档' }}</p>
      <div class="row-actions">
        <el-button type="primary" @click="openCreate">创建物料</el-button>
        <el-button :disabled="count === 0" @click="listOpen = true">查看已有物料</el-button>
      </div>
      <p v-if="lastCode" class="meta">刚创建 {{ lastCode }}。<button type="button" class="linkish" @click="listOpen = true">查看</button></p>
    </template>
    <p v-else class="warn">{{ previewMessage }}</p>
    </template>

    <el-dialog v-model="createOpen" class="v3-material-dialog" title="创建物料" width="480px" append-to-body :close-on-click-modal="false" @closed="onCreateClosed">
      <div v-if="preview" @keydown.tab.stop>
        <p class="spec">{{ preview.label }}</p>
        <p class="meta">规划编号 {{ preview.planningId }} · 模型版本 {{ preview.versionName }}</p>
        <p v-if="choices.length" class="warn">有多款商品都能放下这条规格，请选一款。不会按名称自动合并。</p>
        <el-radio-group v-if="choices.length" v-model="pickedFamilyId" class="choices">
          <el-radio v-for="item in choices" :key="item.id" :value="item.id">{{ item.name }}</el-radio>
        </el-radio-group>
        <p v-else-if="existingName">将记在商品「{{ existingName }}」下面。规格不用再填。</p>
        <p v-else>将新建商品「{{ preview.productName }}」。规格不用再填。</p>
        <p v-if="namingSource" class="meta">{{ namingSource }}</p>
        <p v-if="namingMessage" class="warn">{{ namingMessage }}</p>
        <label class="name-label">物料名称<el-input v-model="nameDraft" :placeholder="namingMessage ? '请手工填写物料名称' : ''" /></label>
        <label class="name-label">物料描述<el-input v-model="descDraft" type="textarea" :rows="2" /></label>
        <label class="name-label">供应商编码<el-input v-model="supplierDraft" clearable placeholder="可留空" /></label>
        <p class="meta">规格已经选好，不用再填。系统物料编号确认后自动分配，不能手改。</p>
        <p v-if="errorText" class="warn">{{ errorText }}</p>
      </div>
      <template #footer>
        <el-button :disabled="saving" @click="createOpen = false">取消</el-button>
        <el-button :loading="saving" @click="confirm(true)">创建并继续下一条</el-button>
        <el-button type="primary" :loading="saving" @click="confirm(false)">确认创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="listOpen" class="v3-material-dialog" title="已有物料" width="560px" append-to-body>
      <el-input v-model="keyword" placeholder="搜物料编码或规格" clearable />
      <p v-if="filtered.length === 0" class="muted">还没有物料。</p>
      <ul v-else class="materials">
        <li v-for="item in filtered" :key="item.id">
          <div>
            <strong>{{ item.materialCode?.trim() || '未分配物料编号' }}</strong>
            <span>{{ item.skuName?.trim() || '未填写物料名称' }} · {{ item.status === 'on_sale' ? '在售' : item.status === 'off_sale' ? '停售' : '草稿' }}</span>
            <em v-if="item.nameSource === 'manual'">手工修改</em>
            <em v-else-if="item.nameSource === 'auto'">规则带入</em>
            <em v-if="item.materialDescription">{{ item.materialDescription }}</em>
          </div>
          <button type="button" class="linkish" @click="openMaterial(item)">打开</button>
        </li>
      </ul>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { familyChoicesFor, filingText, gradeText, resolveV3MaterialSpec } from '../domain/material'
import { suggestMaterialName } from '../domain/naming'
import type { MaterialChoice } from '../domain/material'
import { uid, useCatalogStore } from '../stores/catalog'

const props = defineProps<{
  productModelId: string
  modelVersionId: string
  planningId: string
  categoryId: string
  productTypeId: string
  retired?: boolean
  bare?: boolean
  openCreateTick?: number
  openListTick?: number
  matchVersion?: boolean
}>()

const store = useCatalogStore()
const router = useRouter()
const createOpen = ref(false)
const listOpen = ref(false)
const saving = ref(false)
const requestId = ref('')
const errorText = ref('')
const choices = ref<MaterialChoice[]>([])
const pickedFamilyId = ref('')
const lastCode = ref('')
const keyword = ref('')
const nameDraft = ref('')
const namingMessage = ref('')
const namingSource = ref('')
const descDraft = ref('')
const supplierDraft = ref('')
const planRecord = computed(() => store.data.planningRecords.find((item) => item.planningId === props.planningId))
const gradeLabel = computed(() => gradeText(planRecord.value?.grade))
const filingLabel = computed(() => filingText(planRecord.value?.grade, count.value))

const resolved = computed(() => {
  if (!props.planningId || props.retired) return null
  return resolveV3MaterialSpec(store.data, props)
})
const preview = computed(() => (resolved.value && resolved.value.ok ? resolved.value.spec : null))
const previewMessage = computed(() => (resolved.value && !resolved.value.ok ? resolved.value.message : ''))
function listedMaterial(item: { planningId?: string; modelVersionId?: string }) {
  if (item.planningId !== props.planningId) return false
  if (!props.matchVersion) return true
  return (item.modelVersionId || '') === props.modelVersionId
}
const count = computed(() => store.data.skus.filter((item) => listedMaterial(item)).length)
const existingName = computed(() => {
  if (!preview.value) return ''
  const found = familyChoicesFor(store.data, {
    productModelId: props.productModelId,
    productTypeId: props.productTypeId,
    categoryId: props.categoryId,
    commonSignature: preview.value.commonSignature,
  })
  return found.length === 1 ? found[0].name : ''
})
const materials = computed(() => store.data.skus.filter((item) => listedMaterial(item)))
const codeText = computed(() => materials.value.map((item) => item.materialCode).filter(Boolean).join('、'))
const filtered = computed(() => {
  const text = keyword.value.trim()
  if (!text) return materials.value
  return materials.value.filter((item) => `${item.materialCode || ''} ${item.skuName || ''} ${item.materialDescription || ''} ${item.supplierCode || ''}`.includes(text))
})

function suggestionName() {
  const record = store.data.planningRecords.find((item) => item.planningId === props.planningId)
  const typeName = store.data.productTypes.find((item) => item.id === props.productTypeId)?.name || ''
  const suggestion = record ? suggestMaterialName(store.data, {
    productModelId: props.productModelId,
    modelVersionId: props.modelVersionId,
    productTypeName: typeName,
    steps: record.steps.map((step) => ({ valueNodeId: step.valueNodeId, attributeId: step.attributeId, valueId: step.valueId })),
  }) : null
  namingMessage.value = suggestion?.canAuto === false ? suggestion.message : ''
  namingSource.value = suggestion?.canAuto !== false && suggestion?.nodeLabel ? `建议名称来自已发布版本里的节点「${suggestion.nodeLabel}」。` : ''
  return suggestion?.canAuto === false ? '' : (suggestion?.name || '')
}
function openCreate() {
  if (!props.planningId || props.retired) return
  requestId.value = uid('req')
  errorText.value = ''
  choices.value = []
  pickedFamilyId.value = ''
  nameDraft.value = suggestionName()
  descDraft.value = ''
  supplierDraft.value = ''
  createOpen.value = true
}
watch(() => props.openCreateTick, (tick) => {
  if (!tick) return
  openCreate()
}, { immediate: true })
watch(() => props.openListTick, (tick) => {
  if (!tick) return
  listOpen.value = true
}, { immediate: true })
function onCreateClosed() {
  if (!saving.value) errorText.value = ''
}
function confirm(keep: boolean) {
  if (saving.value || !requestId.value) return
  saving.value = true
  const result = store.createMaterial({
    productModelId: props.productModelId,
    modelVersionId: props.modelVersionId,
    planningId: props.planningId,
    requestId: requestId.value,
    categoryId: props.categoryId,
    productTypeId: props.productTypeId,
    familyId: pickedFamilyId.value || undefined,
    skuName: nameDraft.value,
    materialDescription: descDraft.value,
    supplierCode: supplierDraft.value,
  })
  saving.value = false
  if (!result.ok) {
    errorText.value = result.message
    choices.value = result.choices || []
    return
  }
  lastCode.value = result.materialCode
  ElMessage.success(result.created ? `已创建物料 ${result.materialCode}` : `这条已经创建过，物料编码仍是 ${result.materialCode}`)
  if (!keep || !result.created) {
    createOpen.value = false
    return
  }
  requestId.value = uid('req')
  descDraft.value = ''
  supplierDraft.value = ''
  nameDraft.value = suggestionName()
}
function openMaterial(item: { familyId: string; id: string }) {
  listOpen.value = false
  router.push(`/products/${item.familyId}?sku=${item.id}`)
}
</script>

<style scoped>
.v3-actions.is-bare { display: contents; }
.spec { margin: 0; color: #1f2a37; font-weight: 650; }
.meta { margin: 6px 0; color: #607089; font-size: 13px; }
.warn { margin: 8px 0 0; color: #c45656; }
.choices { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; margin: 8px 0; }
.materials { margin: 12px 0 0; padding: 0; list-style: none; max-height: 320px; overflow: auto; }
.materials li { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid #eef2f6; }
.materials strong { display: block; }
.materials span, .materials em { color: #607089; font-size: 13px; font-style: normal; }
.materials em { display: block; }
.linkish { border: 0; background: none; color: #1677ff; cursor: pointer; padding: 0; }
.name-label { display: block; margin-top: 8px; color: #303133; }
</style>
