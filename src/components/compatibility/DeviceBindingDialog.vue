<template>
  <el-dialog :model-value="modelValue" :title="skuId ? '配置设备型号' : '维护独立设备型号'" width="min(600px, 94vw)" :close-on-click-modal="false" @update:model-value="emit('update:modelValue', $event)" data-device-binding>
    <template v-if="skuId">
      <p><strong>{{ sku?.skuName || family?.name || skuId }}</strong> · {{ sku?.code }}</p>
      <el-alert :title="resolution.message" :type="resolution.status === 'resolved' ? 'info' : 'warning'" :closable="false" />
      <p v-if="activeBinding" class="muted">原显式绑定：{{ hostText(activeBinding.host) }}。重新绑定会改变这条 SKU 的适配查询；已有兼容声明不会被修改。</p>
      <el-form label-position="top" style="margin-top:16px">
        <el-form-item label="明确选择已有设备型号">
          <el-select v-model="selectedKey" filterable placeholder="选择型号及其来源" style="width:100%" data-binding-host>
            <el-option v-for="item in options" :key="item.key" :value="item.key" :label="`${item.label} · ${item.productTypeName} · ${modelSource(item.host.productModelId)}`" />
          </el-select>
        </el-form-item>
      </el-form>
      <p class="muted">同名型号按来源分别保留。绑定不改 SKU 规格，也不创建 MAT 或 PLN。</p>
      <el-button v-if="store.isAdmin" type="primary" :disabled="!selectedKey" :loading="saving" @click="bind">确认绑定型号</el-button>
      <el-button v-if="store.isAdmin && activeBinding" type="danger" plain :loading="saving" @click="clearBinding">解除显式绑定</el-button>
      <el-divider />
    </template>
    <template v-if="store.isAdmin">
      <el-button v-if="!creating" @click="creating = true">新建独立型号</el-button>
      <el-form v-if="creating" label-position="top" class="model-form" @submit.prevent="createModel">
        <h3>新建独立设备型号</h3>
        <p class="muted">没有 MAT 或在售 SKU 也能建立型号，再维护其兼容声明。</p>
        <el-form-item label="型号名称" required><el-input v-model="modelName" placeholder="填写明确设备型号" maxlength="100" data-device-model-name /></el-form-item>
        <el-form-item label="主机产品类型" required><el-select v-model="productTypeId" placeholder="选择主机类型" style="width:100%" data-device-model-type><el-option v-for="item in hostTypes" :key="item.id" :label="item.name" :value="item.id" /></el-select></el-form-item>
        <el-button type="primary" :loading="saving" @click="createModel">保存独立型号</el-button>
        <el-button v-if="skuId" @click="creating = false">取消新建</el-button>
      </el-form>
    </template>
    <p v-else class="muted">当前角色可以查看；型号绑定和维护需要管理员权限。</p>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon style="margin-top:12px" data-binding-error />
    <p v-if="notice" role="status" class="success">{{ notice }}</p>
    <template #footer><el-button @click="emit('update:modelValue', false)">关闭</el-button></template>
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useCatalogStore } from '../../stores/catalog'
import { compatibilityFamilyTypeId, listDeviceModels, resolveDeviceSku } from '../../domain/deviceResolution'
import { roleOfType } from '../../domain/compatibility'
import { hostKey, hostText } from './compatibilityPresentation'

const props = defineProps<{ modelValue: boolean; skuId?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; saved: [] }>()
const store = useCatalogStore()
const selectedKey = ref(''), error = ref(''), notice = ref(''), saving = ref(false)
const creating = ref(false), modelName = ref(''), productTypeId = ref('')
const sku = computed(() => store.data.skus.find(item => item.id === props.skuId))
const family = computed(() => store.data.families.find(item => item.id === sku.value?.familyId))
const familyTypeId = computed(() => family.value ? compatibilityFamilyTypeId(store.data, family.value.id) : '')
const resolution = computed(() => resolveDeviceSku(store.data, props.skuId || ''))
const activeBinding = computed(() => resolution.value.binding || store.data.deviceBindings?.find(item => item.skuId === props.skuId))
const options = computed(() => listDeviceModels(store.data).filter(item => !familyTypeId.value || item.host.productTypeId === familyTypeId.value))
const hostTypes = computed(() => store.data.productTypes.filter(item => item.status === 'enabled' && roleOfType(store.data, item.id) === 'host'))
let contextGeneration = 0
watch(() => [props.modelValue, props.skuId] as const, ([open]) => {
  contextGeneration += 1
  saving.value = false
  if (!open) return
  const host = resolution.value.host || activeBinding.value?.host
  selectedKey.value = options.value.find(item => host && hostKey(item.host) === hostKey(host))?.key || ''
  error.value = ''; notice.value = ''; creating.value = !props.skuId; modelName.value = ''
  productTypeId.value = familyTypeId.value || hostTypes.value[0]?.id || ''
}, { immediate: true })
function modelSource(id: string) {
  return store.data.specCanvases.find(item => item.templateId === id)?.name || store.data.templates.find(item => item.id === id)?.name || (id.startsWith('device:') ? '独立型号' : id)
}
async function bind() {
  if (saving.value || !store.isAdmin || !props.skuId) return
  const candidate = options.value.find(item => item.key === selectedKey.value)?.host
  if (!candidate) return
  const host = { ...candidate, steps: candidate.steps.map(step => ({ ...step })) }
  const skuId = props.skuId, sourceStamp = resolution.value.sourceStamp, chosenKey = selectedKey.value, generation = contextGeneration
  saving.value = true
  if (activeBinding.value || (resolution.value.host && hostKey(resolution.value.host) !== hostKey(host))) {
    try { await ElMessageBox.confirm(`原型号：${hostText(activeBinding.value?.host || resolution.value.host || host)}。将改为：${hostText(host)}。适用配件结果会按新型号重新查询，原声明保持。`, '确认重新绑定型号', { confirmButtonText: '确认重新绑定', cancelButtonText: '取消' }) } catch { if (generation === contextGeneration) saving.value = false; return }
  }
  if (generation !== contextGeneration || !props.modelValue || props.skuId !== skuId || selectedKey.value !== chosenKey) { if (generation === contextGeneration) saving.value = false; return }
  const result = store.commitDeviceBinding({ skuId, host, replaceExisting: true, expectedSourceStamp: sourceStamp })
  saving.value = false
  if (!result.ok) { error.value = result.message || '型号未保存，请重试。'; return }
  error.value = ''; emit('saved'); emit('update:modelValue', false)
}
async function clearBinding() {
  if (saving.value || !store.isAdmin || !props.skuId || !activeBinding.value) return
  const skuId = props.skuId, generation = contextGeneration, bindingStamp = JSON.stringify(activeBinding.value), sourceStamp = resolution.value.sourceStamp
  const label = hostText(activeBinding.value.host)
  saving.value = true
  try { await ElMessageBox.confirm(`解除与「${label}」的显式绑定？解除后会按这条 SKU 的实际来源重新解析设备型号，已有兼容声明保持不变。`, '解除显式绑定', { confirmButtonText: '确认解除绑定', cancelButtonText: '保留绑定' }) } catch { if (generation === contextGeneration) saving.value = false; return }
  if (generation !== contextGeneration || !props.modelValue || props.skuId !== skuId) { if (generation === contextGeneration) saving.value = false; return }
  if (JSON.stringify(activeBinding.value) !== bindingStamp || resolution.value.sourceStamp !== sourceStamp) { saving.value = false; error.value = '设备来源或绑定已经变更，请重新查看后操作。'; return }
  const result = store.clearDeviceBinding(skuId)
  saving.value = false
  if (!result.ok) { error.value = result.message || '绑定未解除，请重试。'; return }
  error.value = ''; ElMessage.success('显式绑定已解除，已按 SKU 实际来源重新解析；原声明保留。'); emit('saved'); emit('update:modelValue', false)
}
function createModel() {
  if (saving.value || !store.isAdmin) return
  saving.value = true
  const result = store.saveDeviceModel({ name: modelName.value.trim(), productTypeId: productTypeId.value, attributes: {} })
  saving.value = false
  if (!result.ok) { error.value = result.message || '型号未保存，草稿已保留。'; return }
  error.value = ''; notice.value = '独立型号已保存，可以选择它维护兼容声明。'
  selectedKey.value = options.value.find(item => item.host.productModelId === `device:${result.id}`)?.key || ''
  modelName.value = ''; creating.value = !props.skuId; emit('saved')
}
</script>
<style scoped>
.muted { line-height:1.7; }.model-form { margin-top:16px; }.success { color:var(--el-color-success); }h3 { margin:0 0 12px; }
</style>
