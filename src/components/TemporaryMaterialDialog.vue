<template>
  <el-dialog :model-value="open" class="v3-material-dialog" title="创建临时物料" width="560px" :close-on-click-modal="false" @close="emit('close')">
    <div @keydown.tab.stop>
      <h3>商品归属</h3>
      <p>{{ categoryName }} · {{ typeName }}<template v-if="modelName"> · {{ modelName }}</template></p>
      <p class="muted">已经确定的分类和类型不用再填。手工填写的值只属于这一条物料。</p>
      <h3>属性信息</h3>
      <div v-for="row in rows" :key="row.attributeId" class="attr">
        <label>{{ row.name }}</label>
        <el-select v-if="row.values.length && row.mode === 'dictionary'" v-model="row.value" clearable filterable placeholder="从已有取值里选" style="width: 100%">
          <el-option v-for="item in row.values" :key="item" :label="item" :value="item" />
        </el-select>
        <el-input v-else v-model="row.value" :placeholder="`填写${row.name}`" />
        <button v-if="row.values.length" type="button" class="linkish" @click="toggle(row)">{{ row.mode === 'dictionary' ? '改为手工填写' : '改回已有取值' }}</button>
        <p v-if="row.mode === 'manual'" class="muted">此值仅用于当前临时物料，不会自动加入属性词典。</p>
      </div>
      <h3>物料信息</h3>
      <p v-if="namingMessage" class="warn">{{ namingMessage }}</p>
      <label>物料名称<el-input v-model="skuName" @input="nameTouched = true" /></label>
      <label>系统物料编码<span class="req">必填</span><el-input v-model="materialCode" placeholder="例如 MAT-900001 或业务自己的编码" /></label>
      <p class="muted">临时物料仍要手工指定全局唯一的系统编码。确认后到档案里只读，不能再改。</p>
      <label>供应商编码<el-input v-model="supplierCode" clearable placeholder="可留空" /></label>
      <label>物料描述<el-input v-model="materialDescription" type="textarea" :rows="2" /></label>
      <p class="summary">{{ summary || '填写属性后这里会显示摘要。' }}</p>
      <p class="muted" data-temporary-template-summary>{{ compatibilitySummary }}</p>
      <p v-if="errorText" class="warn">{{ errorText }}</p>
      <p v-if="lastCode" class="muted">刚创建 {{ lastCode }}。可以继续填写下一条，或打开刚创建的物料。</p>
    </div>
    <template #footer>
      <el-button v-if="lastFamilyId" @click="emit('open', lastFamilyId, lastSkuId)">查看刚创建的物料</el-button>
      <el-button :disabled="saving" @click="emit('close')">关闭</el-button>
      <el-button type="primary" :loading="saving" :disabled="!store.isAdmin" @click="save">保存临时物料</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'
import { temporaryAttributeFields } from '../domain/material'
import { suggestTemporaryName } from '../domain/naming'
import { uid, useCatalogStore } from '../stores/catalog'
import { previewTemplateForManualAttributes } from '../domain/templateCompatibilitySync'
import { templateCreationSummary } from './template-compatibility/creationPresentation'
import { roleOfType } from '../domain/compatibility'

const props = defineProps<{ open: boolean; categoryId: string; productTypeId: string; productModelId?: string; modelVersionId?: string }>()
const emit = defineEmits<{ close: []; open: [familyId: string, skuId: string] }>()
const store = useCatalogStore()
const rows = reactive<{ attributeId: string; name: string; values: string[]; value: string; mode: 'dictionary' | 'manual' }[]>([])
const skuName = ref('')
const nameTouched = ref(false)
const materialCode = ref('')
const supplierCode = ref('')
const materialDescription = ref('')
const errorText = ref('')
const saving = ref(false)
const requestId = ref('')
const lastCode = ref('')
const lastFamilyId = ref('')
const lastSkuId = ref('')

const categoryName = computed(() => store.data.categories.find((item) => item.id === props.categoryId)?.name || '未选分类')
const typeName = computed(() => store.data.productTypes.find((item) => item.id === props.productTypeId)?.name || '未选类型')
const modelName = computed(() => store.data.specCanvases.find((item) => item.templateId === props.productModelId)?.name || '')
const summary = computed(() => rows.filter((item) => item.value.trim()).map((item) => `${item.name} ${item.value.trim()}`).join(' · '))
const compatibilitySummary = computed(() => {
  if (roleOfType(store.data, props.productTypeId) !== 'accessory') return '按当前产品类型和属性建档；配件适用设备配置仅用于配件对象。'
  const result = previewTemplateForManualAttributes(store.data, { modelId: props.productModelId || '', versionId: props.modelVersionId || '', attrs: rows.filter(item => item.value.trim()).map(item => ({ attributeId: item.attributeId, value: item.value.trim() })) })
  const version = store.data.specModelVersions.find(item => item.id === props.modelVersionId)
  return `${templateCreationSummary([result], version?.versionName || '', '临时物料')}。${result.message}`
})
const namingMessage = computed(() => suggestion.value.status === 'conflict' ? suggestion.value.message : '')
const suggestion = computed(() => suggestTemporaryName({
  productTypeName: typeName.value,
  attrs: rows.filter((item) => item.value.trim()).map((item) => ({ attributeId: item.attributeId, value: item.value })),
  rules: rulesOf(),
}))

watch(() => props.open, (open) => {
  if (!open) return
  const fields = temporaryAttributeFields(store.data, { categoryId: props.categoryId, productTypeId: props.productTypeId, productModelId: props.productModelId })
  rows.splice(0, rows.length, ...fields.map((item) => ({ ...item, value: '', mode: item.values.length ? 'dictionary' as const : 'manual' as const })))
  skuName.value = ''
  nameTouched.value = false
  materialCode.value = ''
  supplierCode.value = ''
  materialDescription.value = ''
  errorText.value = ''
  requestId.value = uid('req')
  lastCode.value = ''
})
watch(suggestion, (value) => {
  if (!nameTouched.value) skuName.value = value.name
})

function rulesOf() {
  if (!props.modelVersionId) return []
  const version = store.data.specModelVersions.find((item) => item.id === props.modelVersionId)
  return (version?.nodesSnapshot || []).map((item) => item.namingRule || []).filter((item) => item.length)
}
function toggle(row: { mode: 'dictionary' | 'manual'; value: string }) {
  row.mode = row.mode === 'dictionary' ? 'manual' : 'dictionary'
  row.value = ''
}
function save() {
  if (saving.value) return
  saving.value = true
  const result = store.createTemporary({
    requestId: requestId.value,
    categoryId: props.categoryId,
    productTypeId: props.productTypeId,
    productModelId: props.productModelId,
    modelVersionId: props.modelVersionId,
    attrs: rows.filter((item) => item.value.trim()).map((item) => ({ attributeId: item.attributeId, value: item.value.trim(), source: item.mode })),
    materialCode: materialCode.value,
    skuName: skuName.value,
    supplierCode: supplierCode.value,
    materialDescription: materialDescription.value,
  })
  saving.value = false
  if (!result.ok) {
    errorText.value = result.message
    return
  }
  errorText.value = ''
  lastCode.value = result.materialCode
  lastFamilyId.value = result.familyId
  lastSkuId.value = result.skuId
  ElMessage.success(result.created ? `已创建临时物料 ${result.materialCode}` : `这条已经创建过，编码仍是 ${result.materialCode}`)
  rows.forEach((item) => { item.value = '' })
  materialCode.value = ''
  materialDescription.value = ''
  nameTouched.value = false
  requestId.value = uid('req')
}
</script>

<style scoped>
h3 { margin: 14px 0 6px; font-size: 14px; }
.attr { margin-bottom: 8px; }
label { display: block; margin: 8px 0 4px; }
.req { margin-left: 6px; color: #c45656; font-size: 12px; }
.summary { margin-top: 10px; padding: 8px 10px; background: #f7f9fc; }
.warn { color: #c45656; }
.muted { color: #607089; font-size: 13px; }
.linkish { border: 0; background: none; color: #1677ff; cursor: pointer; padding: 0; }
</style>
