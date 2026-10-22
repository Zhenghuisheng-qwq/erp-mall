<template>
  <el-form label-width="112px" class="spu-form" @submit.prevent>
    <el-alert v-if="locked" title="已有 SKU、物料或历史关联，身份信息已锁定；名称、编号和状态仍可维护。" type="info" :closable="false" />
    <el-form-item label="SPU 名称" required><el-input v-model="draft.name" placeholder="填写商品主体名称" data-spu-name /></el-form-item>
    <el-form-item label="OA_ProductID"><el-input v-model="draft.oaProductId" placeholder="可空，沿用已有编号" /></el-form-item>
    <el-form-item label="商品分类" required><CategoryTreeSelect :model-value="draft.categoryId" :categories="store.data.categories" :disabled="locked" @update:model-value="categoryChanged" /></el-form-item>
    <el-form-item label="产品类型"><el-select v-model="draft.productTypeId" :disabled="locked" clearable placeholder="选择产品类型" @change="typeChanged"><el-option v-for="item in types" :key="item.id" :value="item.id" :label="item.name" /></el-select></el-form-item>
    <el-form-item label="模型 / 方案"><el-select v-model="draft.templateId" :disabled="locked" clearable placeholder="选择适用模型或属性方案" @change="templateChanged"><el-option v-for="item in templates" :key="item.id" :value="item.id" :label="item.name" /></el-select></el-form-item>
    <el-form-item v-if="versions.length || draft.modelVersionId" label="发布版本"><el-select v-model="draft.modelVersionId" :disabled="locked" placeholder="选择发布版本" @change="draft.commonAttrs = {}"><el-option v-for="item in versions" :key="item.id" :value="item.id" :label="item.versionName" /></el-select></el-form-item>
    <el-form-item v-for="field in commonFields" :key="field.name" :label="field.name" :required="field.required">
      <el-select v-model="draft.commonAttrs[field.name]" :disabled="locked" filterable clearable :allow-create="!draft.modelVersionId" default-first-option :placeholder="`选择${field.name}`"><el-option v-for="value in field.values" :key="value" :value="value" :label="value" /></el-select>
    </el-form-item>
    <el-form-item label="商品状态"><el-select v-model="draft.shelfStatus"><el-option label="草稿" value="draft" /><el-option label="已发布" value="online" /><el-option label="已下架" value="offline" /></el-select></el-form-item>
    <p v-if="error" class="issue-error" role="alert">{{ error }}</p>
    <p v-if="!locked" class="muted">可以先保存空 SPU。新增 SKU 前需补齐适用方案和公共属性。</p>
    <div class="row-actions">
      <el-button @click="emit('cancel')">取消</el-button>
      <el-button type="primary" :loading="saving" @click="save(false)">保存</el-button>
      <el-button v-if="!inline" :disabled="saving" @click="save(true)">保存并新增 SKU</el-button>
    </div>
  </el-form>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import CategoryTreeSelect from '../CategoryTreeSelect.vue'
import { boundParams, mappingForCategory, modelSpecColumns } from '../../domain/logic'
import { spuIdentityLocked } from '../../domain/spuSku'
import type { ProductFamily } from '../../domain/types'
import { useCatalogStore } from '../../stores/catalog'

const props = defineProps<{ initial: ProductFamily; inline?: boolean }>()
const emit = defineEmits<{ saved: [id: string, addSku: boolean]; cancel: []; dirty: [value: boolean] }>()
const store = useCatalogStore()
const draft = reactive<ProductFamily>(JSON.parse(JSON.stringify(props.initial)))
let original = JSON.stringify(draft)
const error = ref('')
const saving = ref(false)
const locked = computed(() => Boolean(draft.id && store.data.families.some(item => item.id === draft.id) && spuIdentityLocked(store.data, draft)))
const types = computed(() => store.data.productTypes.filter(item => item.categoryId === draft.categoryId))
const templates = computed(() => store.data.templates.filter(item => {
  const owner = store.data.specCanvases.find(canvas => canvas.templateId === item.id)?.productTypeId
  return item.id === draft.templateId || (owner ? owner === draft.productTypeId : item.enabled)
}))
const versions = computed(() => store.data.specModelVersions.filter(item => item.templateId === draft.templateId && item.status === 'published').slice().sort((a, b) => b.version - a.version))
const commonFields = computed(() => {
  const version = store.data.specModelVersions.find(item => item.id === draft.modelVersionId && item.templateId === draft.templateId)
  if (version) return modelSpecColumns(store.data, draft.templateId, version.nodesSnapshot, 'common')
  return boundParams(store.data, draft.templateId, 'common').map(item => ({ name: item.param.name, values: item.param.values, required: item.required }))
})
watch(draft, () => emit('dirty', JSON.stringify(draft) !== original), { deep: true })
function categoryChanged(value: string | string[]) {
  draft.categoryId = typeof value === 'string' ? value : value[0] || ''
  draft.productTypeId = types.value.length === 1 ? types.value[0]?.id : undefined
  draft.templateId = mappingForCategory(store.data, draft.categoryId)?.templateId || ''
  templateChanged()
}
function typeChanged() { draft.templateId = ''; templateChanged() }
function templateChanged() {
  draft.modelVersionId = versions.value[0]?.id || ''
  draft.productModelId = draft.modelVersionId ? draft.templateId : undefined
  draft.commonAttrs = {}
}
function save(addSku: boolean) {
  if (saving.value) return
  saving.value = true
  const now = new Date().toISOString()
  const result = store.saveSpu({ ...draft, createdAt: draft.createdAt || now, lifecycle: draft.shelfStatus === 'online' ? 'ready' : 'draft' })
  if (!result.ok) { error.value = result.message; saving.value = false; return }
  draft.id = result.id
  original = JSON.stringify(draft)
  error.value = ''
  emit('dirty', false)
  emit('saved', result.id, addSku)
  saving.value = false
}
</script>

<style scoped>
.spu-form { max-width: 760px; }
.spu-form .el-alert { margin-bottom: 20px; }
.spu-form :deep(.el-select), .spu-form :deep(.category-tree-select) { width: 100%; }
</style>
