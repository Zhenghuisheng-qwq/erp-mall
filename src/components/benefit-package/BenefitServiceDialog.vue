<template>
  <el-dialog class="benefit-service-dialog" :model-value="modelValue" :title="service ? '编辑服务权益' : '添加服务权益'" width="min(560px,94vw)" :close-on-click-modal="false" append-to-body :before-close="() => emit('request-close')" data-benefit-service-dialog>
    <el-form :disabled="disabled" label-position="top" @submit.prevent="save">
      <el-form-item label="服务名称" required><el-input v-model="draft.name" aria-label="服务名称" placeholder="例如贴膜服务" data-benefit-service-name /></el-form-item>
      <div class="service-grid"><el-form-item label="约定数量" required><BenefitIntegerInput v-model="draft.quantity" label="服务数量" /></el-form-item><el-form-item label="单位" required><el-input v-model="draft.unit" aria-label="服务单位" placeholder="次、项、份" /></el-form-item></div>
      <el-form-item label="计量方式"><el-radio-group v-model="draft.measurement" aria-label="服务计量方式"><el-radio value="per-package">每包计量</el-radio><el-radio value="per-delivery">本次交付计量</el-radio></el-radio-group></el-form-item>
      <p class="muted service-hint">{{ draft.measurement === 'per-package' ? '本次交付多包时，服务数量随包数相乘。' : '本次交付无论有多少包，都使用这里约定的服务数量。' }}</p>
      <BenefitReferenceInput v-model="draft.referencePrice" :quantity="draft.quantity" :disabled="disabled" label="服务参考单价"/><el-form-item label="有效期说明（可选）"><el-input v-model="draft.validity" aria-label="服务有效期说明" placeholder="例如每份 3 个月会员，自实际激活起计算" /></el-form-item>
      <el-form-item label="使用条件或服务说明（可选）"><el-input v-model="draft.description" type="textarea" :rows="3" aria-label="服务说明" /></el-form-item>
      <el-alert v-if="error" :title="error" type="error" :closable="false" data-benefit-service-error />
    </el-form>
    <template #footer><el-button :disabled="disabled" @click="emit('request-close')">取消</el-button><el-button type="primary" :disabled="disabled" @click="save" data-benefit-save-service>{{ service ? '确认服务修改' : '加入服务清单' }}</el-button></template>
  </el-dialog>
</template>
<script setup lang="ts">
import BenefitReferenceInput from './BenefitReferenceInput.vue'
import { referencePriceProblem } from '../../domain/benefitPricing'
import { ref, watch } from 'vue'
import type { BenefitServiceLine } from '../../domain/benefitPackageTypes'
import BenefitIntegerInput from './BenefitIntegerInput.vue'
import { localBenefitRequest } from './benefitPackagePresentation'
const props = defineProps<{ modelValue: boolean; service?: BenefitServiceLine; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; save: [value: BenefitServiceLine]; 'dirty-change': [value: boolean]; 'request-close': [] }>()
const empty = (): BenefitServiceLine => ({ id: '', name: '', quantity: 1, unit: '次', measurement: 'per-package', validity: '', description: '' })
const draft = ref(empty()), error = ref(''), original = ref('')
watch(() => [props.modelValue, props.service] as const, ([open]) => { if (open) { draft.value = props.service ? { ...props.service } : empty(); original.value = JSON.stringify(draft.value); error.value = '' } else emit('dirty-change', false) })
watch(draft, () => emit('dirty-change', props.modelValue && JSON.stringify(draft.value) !== original.value), { deep: true })
function save() {
  if (props.disabled) return false
  if (!draft.value.name.trim() || !draft.value.unit.trim()) { error.value = '请填写服务名称和单位。'; return false }
  if (!Number.isSafeInteger(draft.value.quantity) || draft.value.quantity < 1) { error.value = '服务数量必须是有效范围内的正整数，不能使用小数或负数。'; return false }
  if(referencePriceProblem(draft.value.referencePrice)){error.value=referencePriceProblem(draft.value.referencePrice);return false}
  emit('save', { ...draft.value, id: draft.value.id || localBenefitRequest('service'), name: draft.value.name.trim(), unit: draft.value.unit.trim() }); emit('update:modelValue', false)
  emit('dirty-change', false); return true
}
defineExpose({ commit: save })
</script>
<style scoped>
:global(.benefit-service-dialog) { max-height:90dvh; display:flex; flex-direction:column; margin-top:5dvh !important; }:global(.benefit-service-dialog .el-dialog__body) { overflow:auto; min-height:0; }:global(.benefit-service-dialog .el-dialog__header),:global(.benefit-service-dialog .el-dialog__footer) { flex-shrink:0; }
.service-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }.service-hint { margin:-6px 0 20px; line-height:1.7; }
@media(max-width:620px) { .service-grid { grid-template-columns:1fr; gap:0; } }
</style>
