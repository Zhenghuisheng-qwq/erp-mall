<template>
  <section class="rule-editor" data-benefit-rules>
    <div class="section-head"><div><h2>选配规则</h2><p class="muted">按需开启。候选范围与包内实际选择分别维护。</p></div><el-switch :model-value="enabled" :disabled="disabled" aria-label="启用选配规则" @update:model-value="emit('update:enabled', $event === true)" /></div>
    <template v-if="enabled">
      <div v-for="(group, index) in modelValue" :key="group.id" class="selection-group" :data-benefit-rule="group.id">
        <div class="section-head"><el-input :model-value="group.name" :disabled="disabled" placeholder="选配组名称，例如保护壳组" aria-label="选配组名称" @update:model-value="update(index, 'name', String($event))" /><el-button :disabled="disabled" text type="danger" @click="emit('update:modelValue', modelValue.filter(item => item.id !== group.id))">移除规则组</el-button></div>
        <el-checkbox :model-value="group.enabled" :disabled="disabled" @update:model-value="update(index, 'enabled', $event === true)">启用此组</el-checkbox>
        <el-form label-position="top" class="rule-form">
          <el-form-item label="候选销售 SKU"><el-select :model-value="group.candidateSkuIds" :disabled="disabled" multiple filterable placeholder="明确选择候选 SKU，不会自动加入清单" style="width:100%" :data-rule-candidates="group.id" @update:model-value="update(index, 'candidateSkuIds', $event)"><el-option v-for="sku in candidates" :key="sku.skuId" :label="`${sku.code} · ${sku.name} · ${sku.spec}`" :value="sku.skuId" /></el-select></el-form-item>
          <div class="fields-grid"><el-form-item label="是否必须选择"><el-checkbox :model-value="group.required" :disabled="disabled" @update:model-value="update(index, 'required', $event === true)">必选组</el-checkbox></el-form-item><el-form-item label="选择商品种类数"><div class="range"><BenefitIntegerInput :model-value="group.minKinds" zero-allowed label="最少选择种数" :disabled="disabled" @update:model-value="update(index, 'minKinds', $event)" /><span>至</span><BenefitIntegerInput :model-value="group.maxKinds" zero-allowed label="最多选择种数" :disabled="disabled" @update:model-value="update(index, 'maxKinds', $event)" /></div></el-form-item></div>
          <div class="fields-grid"><el-form-item label="每种商品默认件数"><BenefitIntegerInput :model-value="group.defaultQuantity" label="每种默认数量" :disabled="disabled" @update:model-value="update(index, 'defaultQuantity', $event)" /></el-form-item><el-form-item label="每种商品数量"><el-checkbox :model-value="group.adjustable" :disabled="disabled" @update:model-value="update(index, 'adjustable', $event === true)">允许调整件数</el-checkbox></el-form-item></div>
          <el-form-item v-if="group.adjustable" label="每种商品允许件数范围"><div class="range"><BenefitIntegerInput :model-value="group.minQuantity" label="每种最少件数" :disabled="disabled" @update:model-value="update(index, 'minQuantity', $event)" /><span>至</span><BenefitIntegerInput :model-value="group.maxQuantity" label="每种最多件数" :disabled="disabled" @update:model-value="update(index, 'maxQuantity', $event)" /></div></el-form-item>
        </el-form>
        <p class="rule-summary">{{ group.name || '未命名组' }}：{{ group.required ? '必选' : '可选' }} {{ group.minKinds }}～{{ group.maxKinds }} 种；每种{{ group.adjustable ? `${group.minQuantity}～${group.maxQuantity}` : group.defaultQuantity }} 件。</p>
      </div>
      <el-button v-if="!disabled" @click="add" data-add-benefit-rule>添加选配组</el-button>
      <p class="muted footnote">同一 SKU 不能重复归属到多个启用组。关闭规则不会自动移除已选商品。</p>
    </template>
  </section>
</template>
<script setup lang="ts">
import type { BenefitSelectionGroup, BenefitSkuSummary } from '../../domain/benefitPackageTypes'
import BenefitIntegerInput from './BenefitIntegerInput.vue'
import { localBenefitRequest } from './benefitPackagePresentation'
const props = defineProps<{ modelValue: BenefitSelectionGroup[]; enabled: boolean; candidates: BenefitSkuSummary[]; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: BenefitSelectionGroup[]]; 'update:enabled': [value: boolean] }>()
function update<K extends keyof BenefitSelectionGroup>(index: number, key: K, value: BenefitSelectionGroup[K]) {
  emit('update:modelValue', props.modelValue.map((group, at) => {
    if (at !== index) return group
    const next = { ...group, [key]: value }
    if (key === 'defaultQuantity' && !next.adjustable && typeof value === 'number') { next.minQuantity = value; next.maxQuantity = value }
    if (key === 'adjustable' && value === false) { next.minQuantity = next.defaultQuantity; next.maxQuantity = next.defaultQuantity }
    return next
  }))
}
function add() { emit('update:modelValue', [...props.modelValue, { id: localBenefitRequest('group'), name: '', enabled: true, candidateSkuIds: [], required: false, minKinds: 0, maxKinds: 1, defaultQuantity: 1, adjustable: false, minQuantity: 1, maxQuantity: 1 }]) }
</script>
<style scoped>
.section-head { display:flex; align-items:center; justify-content:space-between; gap:12px; }.section-head h2 { margin:0 0 5px; }.selection-group { padding:16px; margin-top:16px; border:1px solid var(--border-default); border-radius:10px; }.selection-group>.section-head { margin-bottom:12px; }.rule-form { margin-top:12px; }.fields-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }.range { display:flex; align-items:center; gap:8px; }.range>.integer-input { width:95px; }.rule-summary { padding:10px; border-radius:6px; background:var(--app-surface-muted); line-height:1.6; font-size:13px; margin-bottom:0; }.footnote { margin-top:12px; line-height:1.7; }
@media(max-width:700px) { .fields-grid { grid-template-columns:1fr; gap:0; }.section-head { align-items:flex-start; }.selection-group { padding:12px; }.selection-group>.section-head { flex-wrap:wrap; } }
</style>
