<template>
  <section class="claim-set" data-template-claim-editor>
    <div v-if="!readonly" class="host-picker">
      <DeviceModelPicker :model-value="hostPicks" :options="hosts" multiple placeholder="搜索并选择适用设备型号，可多选" label="选择模板适用型号" data-template-hosts @update:model-value="hostPicks = Array.isArray($event) ? $event : []" />
    </div>
    <section v-if="hostPicks.length && !readonly" class="batch-form" data-template-batch>
      <strong>本批 {{ hostPicks.length }} 款型号 · 公共信息</strong><p class="muted">只加入所选型号，已有声明保持。生成后可逐条调整，最后保存模型草稿。</p>
      <div class="claim-grid">
        <el-form-item label="能力"><el-select v-model="batch.capability" aria-label="本批能力"><el-option v-for="(label,value) in capabilityLabels" :key="value" :label="label" :value="value" /></el-select></el-form-item>
        <el-form-item label="结论"><el-select v-model="batch.conclusion" aria-label="本批结论"><el-option v-for="(label,value) in conclusionLabels" :key="value" :label="label" :value="value" /></el-select></el-form-item>
        <el-form-item label="核验"><el-select v-model="batch.verification" aria-label="本批核验"><el-option label="待确认" value="pending" /><el-option label="已确认" value="confirmed" /></el-select></el-form-item>
      </div>
      <el-form-item label="来源或依据（必填，可逐条完善）"><el-input v-model="batch.source" aria-label="本批来源或依据" placeholder="本批共同依据" /></el-form-item>
      <el-form-item v-if="batch.conclusion === 'conditional'" label="本批使用前提（必填）"><el-input v-model="batchCondition" aria-label="本批使用前提" /></el-form-item>
      <el-button data-template-add-hosts @click="addHosts">对所选 {{ hostPicks.length }} 款应用</el-button>
    </section>
    <p class="muted">基本使用与快充分别声明。待确认状态不会自动变为已确认；展开后可维护范围、依据和条件。</p>
    <el-empty v-if="!modelValue.length" :description="emptyText || '当前为空结果：不产生适用声明。'" :image-size="60" />
    <article v-for="claim in pageClaims" :key="claim.id" class="claim-card" :data-template-claim="claim.id">
      <div class="claim-head"><div class="host-title"><strong>{{ hostLabel(claim.host) }}</strong><span class="muted">{{ hostSource(claim.host) }}</span></div><div class="row-status"><el-tag v-if="issuesFor(claim.id).length" type="danger" size="small">{{ issuesFor(claim.id).length }} 处待完善</el-tag><el-tag v-else-if="claim.verification === 'pending'" type="warning" size="small">待确认</el-tag><el-tag v-else size="small" type="info">已填写</el-tag><el-button link :aria-expanded="expanded.includes(claim.id)" :data-template-expand="claim.id" @click="toggle(claim.id)">{{ expanded.includes(claim.id) ? '收起' : '展开编辑' }}</el-button></div></div>
      <el-alert v-if="!validHost(claim.host)" title="该型号引用已失效。请移除此声明并重新选择实际型号；不会按名称猜测匹配。" type="warning" :closable="false" />
      <div class="claim-grid">
        <el-form-item label="能力"><el-select :model-value="claim.capability" :disabled="readonly" @update:model-value="set(claim.id, {capability: $event})"><el-option v-for="(label,value) in capabilityLabels" :key="value" :label="label" :value="value" /></el-select></el-form-item>
        <el-form-item label="结论"><el-select :model-value="claim.conclusion" :disabled="readonly" @update:model-value="set(claim.id, {conclusion: $event})"><el-option v-for="(label,value) in conclusionLabels" :key="value" :label="label" :value="value" /></el-select></el-form-item>
        <el-form-item label="核验"><el-select :model-value="claim.verification" :disabled="readonly" @update:model-value="set(claim.id, {verification: $event})"><el-option label="待确认" value="pending" /><el-option label="已确认" value="confirmed" /></el-select></el-form-item>
      </div>
      <button v-for="issue in issuesFor(claim.id)" :key="issue.message" type="button" class="issue-link" @click="locate(issue)">！{{ issue.message }} · 前往处理</button>
      <div v-if="expanded.includes(claim.id) || claim.conclusion === 'conditional'" class="claim-details">
      <div class="claim-grid scope-grid">
        <el-form-item label="设备适用范围" data-claim-field="host"><el-select :model-value="claim.host.scope" :disabled="readonly" @update:model-value="setScope(claim, $event)"><el-option label="整款型号，全部容量与颜色" value="model" /><el-option label="仅指定规划规格" value="planning" /></el-select></el-form-item>
        <el-form-item v-if="claim.host.scope === 'planning'" label="设备规划规格"><el-select :model-value="claim.host.planningId || ''" filterable :disabled="readonly" placeholder="明确选择设备 PLN" @update:model-value="set(claim.id, {host: {...claim.host, planningId: $event}})"><el-option v-for="item in planningFor(claim.host)" :key="item.planningId" :value="item.planningId" :label="`${item.planningId} · ${item.steps.map(step => step.valueId).join(' · ')}`" /></el-select></el-form-item>
      </div>
      <el-form-item label="来源或依据（必填）" :error="fieldError(claim.id,'source')" data-claim-field="source"><el-input :model-value="claim.source" :disabled="readonly" placeholder="填写真实依据；缺少核验时保留待确认" @update:model-value="set(claim.id, {source: $event})" /></el-form-item>
      <el-form-item label="备注" data-claim-field="note"><el-input :model-value="claim.note" :disabled="readonly" type="textarea" :rows="2" @update:model-value="set(claim.id, {note: $event})" /></el-form-item>
      <details class="conditions" :open="claim.conditions.length > 0 || claim.conclusion === 'conditional' || !!fieldError(claim.id,'conditions')" data-claim-field="conditions">
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
        <p v-if="fieldError(claim.id,'conditions')" class="field-error">{{ fieldError(claim.id,'conditions') }}</p>
      </details>
      <div class="detail-actions"><el-button v-if="!readonly" link type="danger" :aria-label="`移除 ${hostLabel(claim.host)} 声明`" @click="remove(claim.id)">移除此条声明</el-button></div>
      </div>
    </article>
    <el-pagination v-if="modelValue.length > pageSize" v-model:current-page="page" :page-size="pageSize" :total="modelValue.length" layout="prev, pager, next, total" size="small" />
  </section>
</template>
<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useCatalogStore, uid } from '../../stores/catalog'
import { listDeviceModels, validateCompatibilityHost } from '../../domain/deviceResolution'
import { cloneCompatibility } from '../../domain/accessoryCompatibilityCommands'
import type { CompatibilityHost } from '../../domain/types'
import type { CompatibilityCondition } from '../../domain/accessoryCompatibilityTypes'
import type { TemplateCompatibilityClaim, TemplateCompatibilityIssue } from '../../domain/templateCompatibilityTypes'
import { capabilityLabels, conclusionLabels, hostKey, hostText } from '../compatibility/compatibilityPresentation'
import DeviceModelPicker from '../compatibility/DeviceModelPicker.vue'

const props = defineProps<{ modelValue: readonly TemplateCompatibilityClaim[]; issues?: readonly TemplateCompatibilityIssue[]; readonly?: boolean; emptyText?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: TemplateCompatibilityClaim[]]; 'batch-change': [pending: boolean] }>()
const store = useCatalogStore()
const hosts = computed(() => listDeviceModels(store.data))
const hostPicks = ref<string[]>([]), page = ref(1), pageSize = 8
const expanded = ref<string[]>([])
const batch = ref<Pick<TemplateCompatibilityClaim,'capability'|'conclusion'|'verification'|'source'>>({capability:'basic',conclusion:'compatible',verification:'pending',source:''}), batchCondition = ref('')
const pendingBatch=computed(()=>hostPicks.value.length>0)
watch(pendingBatch,value=>emit('batch-change',value),{immediate:true,flush:'sync'})
onUnmounted(()=>emit('batch-change',false))
function resetPendingBatch(){hostPicks.value=[];batch.value={capability:'basic',conclusion:'compatible',verification:'pending',source:''};batchCondition.value=''}
const hostIndex = computed(() => new Map(hosts.value.map(item => [item.key,item])))
const pageClaims = computed(() => props.modelValue.slice((page.value - 1) * pageSize, page.value * pageSize))
watch(() => props.modelValue.length, length => { page.value = Math.min(page.value, Math.max(1, Math.ceil(length / pageSize))) })
function hostLabel(host: CompatibilityHost) { return hostIndex.value.get(hostKey(host))?.label || hostText(host) }
function hostSource(host: CompatibilityHost) { const item=hostIndex.value.get(hostKey(host)); return item ? `${item.productTypeName} · ${item.source === 'manual' ? '独立型号' : '模型型号'} · ${host.scope === 'planning' ? '指定规划' : '整款型号'}` : '型号引用待处理' }
function issuesFor(id: string) { return props.issues?.filter(issue => issue.claimId === id) || [] }
function fieldError(id: string, field: TemplateCompatibilityIssue['field']) { return issuesFor(id).find(issue => issue.field === field)?.message }
function toggle(id: string) { expanded.value = expanded.value.includes(id) ? expanded.value.filter(value=>value!==id) : [...expanded.value,id] }
async function locate(issue: TemplateCompatibilityIssue) {
  const index=props.modelValue.findIndex(claim=>claim.id===issue.claimId); if(index<0)return
  page.value=Math.floor(index/pageSize)+1
  if(issue.claimId&&!expanded.value.includes(issue.claimId))expanded.value=[...expanded.value,issue.claimId]
  await nextTick()
  const row=[...document.querySelectorAll<HTMLElement>('[data-template-claim]')].find(element=>element.dataset.templateClaim===issue.claimId && element.offsetParent !== null)
  const target=row?.querySelector<HTMLElement>(`[data-claim-field="${issue.field || 'source'}"]`) || row
  target?.scrollIntoView({block:'center',behavior:'instant'}); target?.querySelector<HTMLElement>('input,textarea,button,[tabindex="0"]')?.focus({preventScroll:true})
}
defineExpose({locate,pendingBatch,resetPendingBatch})
function validHost(host: CompatibilityHost) { return !validateCompatibilityHost(store.data, host, hosts.value) }
function planningFor(host: CompatibilityHost) { const option = hosts.value.find(item => hostKey(item.host) === hostKey(host)); return store.data.planningRecords.filter(item => option?.planningIds.includes(item.planningId)) }
function set(id: string, patch: Partial<TemplateCompatibilityClaim>) { if (props.readonly) return; emit('update:modelValue', props.modelValue.map(item => item.id === id ? {...cloneCompatibility(item),...cloneCompatibility(patch)} : cloneCompatibility(item))) }
function remove(id: string) { if (!props.readonly) emit('update:modelValue', props.modelValue.filter(item => item.id !== id).map(item => cloneCompatibility(item))) }
function addHosts() {
  if (props.readonly) return
  const picks=new Set(hostPicks.value)
  const additions: TemplateCompatibilityClaim[] = hosts.value.filter(item => picks.has(item.key)).map(item => ({id:uid('tclaim'),host:{...cloneCompatibility(item.host),scope:'model',planningId:undefined},...batch.value,conditions:batch.value.conclusion === 'conditional' ? [{kind:'manual',text:batchCondition.value}] : [],note:''}))
  emit('update:modelValue', [...props.modelValue.map(item => cloneCompatibility(item)),...additions]); hostPicks.value = []; page.value = Math.max(1,Math.ceil((props.modelValue.length + additions.length) / pageSize))
  if(additions.length===1&&additions[0])expanded.value=[...expanded.value,additions[0].id]
}
function setScope(claim: TemplateCompatibilityClaim, scope: 'model' | 'planning') { set(claim.id,{host:{...claim.host,scope,planningId:undefined}}) }
function setCondition(claim: TemplateCompatibilityClaim, index: number, condition: CompatibilityCondition) { set(claim.id,{conditions:claim.conditions.map((item,i) => i === index ? condition : item)}) }
function changeConditionKind(claim: TemplateCompatibilityClaim, index: number, kind: CompatibilityCondition['kind']) { setCondition(claim,index,kind === 'attribute' ? {kind,attributeId:'',operator:'eq',value:''} : {kind,text:''}) }
function setConditionValue(claim: TemplateCompatibilityClaim,index:number,condition:Extract<CompatibilityCondition,{kind:'attribute'}>,value:string) { setCondition(claim,index,{...condition,value:condition.operator === 'in' ? value.split(/[,，、]/).map(item => item.trim()).filter(Boolean) : value}) }
</script>
<style scoped>
.host-picker { display:flex; gap:10px; align-items:flex-start; }.host-picker>.el-select { flex:1; min-width:0; }.muted { color:var(--el-text-color-secondary); line-height:1.65; font-size:13px; }.claim-card { border:1px solid var(--el-border-color-lighter); border-radius:10px; padding:14px; margin:12px 0; background:var(--el-bg-color); }.claim-head { display:flex; justify-content:space-between; gap:12px; margin-bottom:12px; overflow-wrap:anywhere; }.claim-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }.scope-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }.claim-grid .el-select { width:100%; }.conditions summary { cursor:pointer; color:var(--el-color-primary); padding:6px 0; }.condition-row { display:flex; gap:8px; flex-wrap:wrap; padding:10px 0; border-top:1px solid var(--el-border-color-extra-light); }.condition-row>.el-select { width:160px; }.condition-row>.el-input { min-width:150px; flex:1; }.el-pagination { margin-top:14px; flex-wrap:wrap; }
.batch-form{padding:14px 16px;margin-top:12px;border-radius:10px;background:var(--el-fill-color-light)}.batch-form p{margin:6px 0 12px}.host-title{display:flex;flex-direction:column;gap:4px;min-width:0}.row-status{display:flex;align-items:center;gap:10px;flex-shrink:0}.claim-card>.claim-grid :deep(.el-form-item){margin-bottom:6px}.claim-details{margin-top:16px;border-top:1px solid var(--el-border-color-extra-light);padding-top:16px}.issue-link{display:block;max-width:100%;border:0;padding:6px 0;color:var(--el-color-danger);background:none;text-align:left;cursor:pointer;line-height:1.6}.field-error{color:var(--el-color-danger);font-size:13px}.detail-actions{display:flex;justify-content:flex-end;margin-top:10px}.claim-head strong{font-size:15px}.claim-card:focus-within{border-color:var(--el-color-primary-light-5)}.issue-link:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:3px}
@media(min-width:900px){.claim-card{display:grid;grid-template-columns:minmax(165px,1fr) minmax(340px,1.7fr) auto;gap:8px 16px;align-items:center}.claim-head{display:contents}.host-title{grid-column:1;grid-row:1}.row-status{grid-column:3;grid-row:1;gap:8px}.claim-card>.claim-grid{grid-column:2;grid-row:1;gap:10px}.claim-card>.claim-grid :deep(.el-form-item__label){font-size:12px;padding-bottom:4px;margin:0}.claim-card>.claim-grid :deep(.el-form-item){margin:0}.claim-details,.claim-card>.el-alert,.issue-link{grid-column:1/-1}.claim-details{margin-top:8px}}
@media(max-width:700px) { .host-picker { flex-wrap:wrap; }.host-picker>.el-select { flex-basis:100%; }.claim-grid,.scope-grid { grid-template-columns:1fr; gap:0; }.claim-card { padding:10px; } }
@media(max-width:480px){.claim-head{flex-wrap:wrap}.row-status{width:100%;justify-content:space-between}.condition-row>.el-select,.condition-row>.el-input{width:100%;min-width:0}.claim-card>.claim-grid{grid-template-columns:1fr}}
</style>
