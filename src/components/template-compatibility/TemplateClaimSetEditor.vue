<template>
  <section class="claim-set" data-template-claim-editor>
    <div v-if="!readonly" class="host-picker">
      <el-select v-model="hostPicks" multiple filterable clearable placeholder="搜索并选择适用设备型号，可多选" aria-label="选择模板适用型号" data-template-hosts>
        <el-option v-for="item in hosts" :key="item.key" :label="`${item.label} · ${item.productTypeName}`" :value="item.key" />
      </el-select>
      <el-button :disabled="!hostPicks.length" data-template-add-hosts @click="addHosts">添加所选型号</el-button>
    </div>
    <p class="muted">每条声明独立保存能力和核验状态；基本使用与快充不会相互替代。已选择的型号不会因搜索而取消。</p>
    <el-empty v-if="!modelValue.length" :description="emptyText || '当前为空结果：不产生适用声明。'" :image-size="60" />
    <article v-for="claim in pageClaims" :key="claim.id" class="claim-card" :data-template-claim="claim.id">
      <div class="claim-head"><strong>{{ hostLabel(claim.host) }}</strong><el-button v-if="!readonly" link type="danger" :aria-label="`移除 ${hostLabel(claim.host)} 声明`" @click="remove(claim.id)">移除</el-button></div>
      <el-alert v-if="!validHost(claim.host)" title="该型号引用已失效。请移除此声明并重新选择实际型号；不会按名称猜测匹配。" type="warning" :closable="false" />
      <div class="claim-grid">
        <el-form-item label="能力"><el-select :model-value="claim.capability" :disabled="readonly" @update:model-value="set(claim.id, {capability: $event})"><el-option v-for="(label,value) in capabilityLabels" :key="value" :label="label" :value="value" /></el-select></el-form-item>
        <el-form-item label="结论"><el-select :model-value="claim.conclusion" :disabled="readonly" @update:model-value="set(claim.id, {conclusion: $event})"><el-option v-for="(label,value) in conclusionLabels" :key="value" :label="label" :value="value" /></el-select></el-form-item>
        <el-form-item label="核验"><el-select :model-value="claim.verification" :disabled="readonly" @update:model-value="set(claim.id, {verification: $event})"><el-option label="待确认" value="pending" /><el-option label="已确认" value="confirmed" /></el-select></el-form-item>
      </div>
      <div class="claim-grid scope-grid">
        <el-form-item label="设备适用范围"><el-select :model-value="claim.host.scope" :disabled="readonly" @update:model-value="setScope(claim, $event)"><el-option label="整款型号，全部容量与颜色" value="model" /><el-option label="仅指定规划规格" value="planning" /></el-select></el-form-item>
        <el-form-item v-if="claim.host.scope === 'planning'" label="设备规划规格"><el-select :model-value="claim.host.planningId || ''" filterable :disabled="readonly" placeholder="明确选择设备 PLN" @update:model-value="set(claim.id, {host: {...claim.host, planningId: $event}})"><el-option v-for="item in planningFor(claim.host)" :key="item.planningId" :value="item.planningId" :label="`${item.planningId} · ${item.steps.map(step => step.valueId).join(' · ')}`" /></el-select></el-form-item>
      </div>
      <el-form-item label="来源或依据"><el-input :model-value="claim.source" :disabled="readonly" placeholder="填写真实依据；缺少核验时保留待确认" @update:model-value="set(claim.id, {source: $event})" /></el-form-item>
      <el-form-item label="备注"><el-input :model-value="claim.note" :disabled="readonly" type="textarea" :rows="2" @update:model-value="set(claim.id, {note: $event})" /></el-form-item>
      <details class="conditions" :open="claim.conditions.length > 0">
        <summary>高级条件（{{ claim.conditions.length }}）</summary>
        <p class="muted">使用真实设备属性，或明确填写配套设备、协议和人工核验前提。</p>
        <div v-for="(condition,index) in claim.conditions" :key="index" class="condition-row">
          <el-select :model-value="condition.kind" :disabled="readonly" aria-label="模板条件类型" @update:model-value="changeConditionKind(claim,index,$event)"><el-option label="设备属性" value="attribute" /><el-option label="配套设备" value="equipment" /><el-option label="协议或功率" value="capability" /><el-option label="人工前提" value="manual" /></el-select>
          <template v-if="condition.kind === 'attribute'">
            <el-select :model-value="condition.attributeId" filterable :disabled="readonly" placeholder="设备属性" @update:model-value="setCondition(claim,index,{...condition,attributeId:$event})"><el-option v-for="param in store.data.params" :key="param.id" :label="param.name" :value="param.id" /></el-select>
            <el-select :model-value="condition.operator" :disabled="readonly" aria-label="模板属性判断" @update:model-value="setCondition(claim,index,{...condition,operator:$event})"><el-option label="等于" value="eq" /><el-option label="属于" value="in" /><el-option label="不低于" value="gte" /></el-select>
            <el-input :model-value="Array.isArray(condition.value) ? condition.value.join(', ') : condition.value" :disabled="readonly" placeholder="多个值用逗号分隔" @update:model-value="setConditionValue(claim,index,condition,$event)" />
          </template>
          <el-input :model-value="condition.text || ''" :disabled="readonly" placeholder="填写真实使用条件" @update:model-value="setCondition(claim,index,{...condition,text:$event})" />
          <template v-if="condition.kind === 'capability'">
            <el-input :model-value="condition.protocol || ''" :disabled="readonly" placeholder="协议（可选）" @update:model-value="setCondition(claim,index,{...condition,protocol:$event})" />
            <el-input-number :model-value="condition.powerWatts" :disabled="readonly" :min="1" :precision="1" aria-label="要求功率 W" @update:model-value="setCondition(claim,index,{...condition,powerWatts:$event ?? undefined})" />
          </template>
          <el-button v-if="!readonly" link type="danger" @click="set(claim.id,{conditions:claim.conditions.filter((_,i) => i !== index)})">删除条件</el-button>
        </div>
        <el-button v-if="!readonly" @click="set(claim.id,{conditions:[...claim.conditions,{kind:'manual',text:''}]})">添加条件</el-button>
      </details>
    </article>
    <el-pagination v-if="modelValue.length > pageSize" v-model:current-page="page" :page-size="pageSize" :total="modelValue.length" layout="prev, pager, next, total" size="small" />
  </section>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useCatalogStore, uid } from '../../stores/catalog'
import { listDeviceModels, validateCompatibilityHost } from '../../domain/deviceResolution'
import { cloneCompatibility } from '../../domain/accessoryCompatibilityCommands'
import type { CompatibilityHost } from '../../domain/types'
import type { CompatibilityCondition } from '../../domain/accessoryCompatibilityTypes'
import type { TemplateCompatibilityClaim } from '../../domain/templateCompatibilityTypes'
import { capabilityLabels, conclusionLabels, hostKey, hostText } from '../compatibility/compatibilityPresentation'

const props = defineProps<{ modelValue: readonly TemplateCompatibilityClaim[]; readonly?: boolean; emptyText?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: TemplateCompatibilityClaim[]] }>()
const store = useCatalogStore()
const hosts = computed(() => listDeviceModels(store.data))
const hostPicks = ref<string[]>([]), page = ref(1), pageSize = 8
const pageClaims = computed(() => props.modelValue.slice((page.value - 1) * pageSize, page.value * pageSize))
watch(() => props.modelValue.length, length => { page.value = Math.min(page.value, Math.max(1, Math.ceil(length / pageSize))) })
function hostLabel(host: CompatibilityHost) { return hosts.value.find(item => hostKey(item.host) === hostKey(host))?.label || hostText(host) }
function validHost(host: CompatibilityHost) { return !validateCompatibilityHost(store.data, host, hosts.value) }
function planningFor(host: CompatibilityHost) { const option = hosts.value.find(item => hostKey(item.host) === hostKey(host)); return store.data.planningRecords.filter(item => option?.planningIds.includes(item.planningId)) }
function set(id: string, patch: Partial<TemplateCompatibilityClaim>) { if (props.readonly) return; emit('update:modelValue', props.modelValue.map(item => item.id === id ? {...cloneCompatibility(item),...cloneCompatibility(patch)} : cloneCompatibility(item))) }
function remove(id: string) { if (!props.readonly) emit('update:modelValue', props.modelValue.filter(item => item.id !== id).map(item => cloneCompatibility(item))) }
function addHosts() {
  if (props.readonly) return
  const additions: TemplateCompatibilityClaim[] = hosts.value.filter(item => hostPicks.value.includes(item.key)).map(item => ({id:uid('tclaim'),host:{...cloneCompatibility(item.host),scope:'model',planningId:undefined},conclusion:'compatible',verification:'pending',capability:'basic',conditions:[],source:'',note:''}))
  emit('update:modelValue', [...props.modelValue.map(item => cloneCompatibility(item)),...additions]); hostPicks.value = []; page.value = Math.max(1,Math.ceil((props.modelValue.length + additions.length) / pageSize))
}
function setScope(claim: TemplateCompatibilityClaim, scope: 'model' | 'planning') { set(claim.id,{host:{...claim.host,scope,planningId:undefined}}) }
function setCondition(claim: TemplateCompatibilityClaim, index: number, condition: CompatibilityCondition) { set(claim.id,{conditions:claim.conditions.map((item,i) => i === index ? condition : item)}) }
function changeConditionKind(claim: TemplateCompatibilityClaim, index: number, kind: CompatibilityCondition['kind']) { setCondition(claim,index,kind === 'attribute' ? {kind,attributeId:'',operator:'eq',value:''} : {kind,text:''}) }
function setConditionValue(claim: TemplateCompatibilityClaim,index:number,condition:Extract<CompatibilityCondition,{kind:'attribute'}>,value:string) { setCondition(claim,index,{...condition,value:condition.operator === 'in' ? value.split(/[,，、]/).map(item => item.trim()).filter(Boolean) : value}) }
</script>
<style scoped>
.host-picker { display:flex; gap:10px; align-items:flex-start; }.host-picker>.el-select { flex:1; min-width:0; }.muted { color:var(--el-text-color-secondary); line-height:1.65; font-size:13px; }.claim-card { border:1px solid var(--el-border-color-lighter); border-radius:10px; padding:14px; margin:12px 0; background:var(--el-bg-color); }.claim-head { display:flex; justify-content:space-between; gap:12px; margin-bottom:12px; overflow-wrap:anywhere; }.claim-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }.scope-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }.claim-grid .el-select { width:100%; }.conditions summary { cursor:pointer; color:var(--el-color-primary); padding:6px 0; }.condition-row { display:flex; gap:8px; flex-wrap:wrap; padding:10px 0; border-top:1px solid var(--el-border-color-extra-light); }.condition-row>.el-select { width:160px; }.condition-row>.el-input { min-width:150px; flex:1; }.el-pagination { margin-top:14px; flex-wrap:wrap; }
@media(max-width:700px) { .host-picker { flex-wrap:wrap; }.host-picker>.el-select { flex-basis:100%; }.claim-grid,.scope-grid { grid-template-columns:1fr; gap:0; }.claim-card { padding:10px; } }
</style>
