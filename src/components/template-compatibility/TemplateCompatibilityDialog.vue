<template>
  <el-dialog :model-value="visible" :title="`适用设备配置 · ${modelName}${loadedVersionId ? '（历史版本只读）' : ''}`" width="min(1020px, 96vw)" :close-on-click-modal="false" :before-close="beforeClose" append-to-body data-template-compatibility-dialog @closed="returnFocus">
    <el-alert v-if="contextNotice" :title="contextNotice" type="warning" :closable="false" />
    <el-alert v-if="readOnly" title="当前配置只读，可以查看规则和预览，不能保存或转换。" type="info" :closable="false" />
    <p class="muted">默认配置应用于没有例外的规格。例外完整替换默认结果，空例外表示不产生声明；多条例外结果不同时标记冲突。保存只更新模型草稿，发布后才冻结到新版本。</p>
    <el-tabs v-if="draft" v-model="tab" data-template-tabs>
      <el-tab-pane label="默认配置" name="default">
        <el-form label-position="top">
          <el-form-item label="默认配置状态"><el-select :model-value="draft.defaultRule.configured" :disabled="readOnly" data-template-default-state @update:model-value="setDefaultConfigured"><el-option label="未配置：不产生声明" :value="false" /><el-option label="已明确配置（允许为空）" :value="true" /></el-select></el-form-item>
          <TemplateClaimSetEditor v-if="draft.defaultRule.configured" v-model="draft.defaultRule.claims" :readonly="readOnly" empty-text="已明确配置为空：不产生适用声明。这与未配置分别记录。" />
          <el-empty v-else description="默认配置尚未设置。可以启用配置，再选择实际设备型号。" :image-size="65" />
        </el-form>
      </el-tab-pane>
      <el-tab-pane :label="`规格例外 ${draft.exceptions.length}`" name="exceptions">
        <el-alert title="例外是完整结果：只配置一款设备，就只适用这一款；需要保留其他默认设备时先复制默认配置。" type="info" :closable="false" />
        <div class="exception-tools"><el-select v-model="selectedExceptionId" placeholder="选择已有例外" aria-label="选择模板兼容例外"><el-option v-for="item in draft.exceptions" :key="item.id" :label="item.name || '未命名例外'" :value="item.id" /></el-select><el-button v-if="!readOnly" data-template-add-exception @click="newException">新增规格例外</el-button></div>
        <el-form v-if="selectedException" label-position="top" data-template-exception-editor>
          <el-form-item label="例外名称"><el-input v-model="selectedException.name" :disabled="readOnly" placeholder="便于识别的配置名称" /></el-form-item>
          <p class="muted" data-template-exception-scope>配置范围：{{ selectorText(selectedException.selector) }} · 当前影响 {{ exceptionCount }} 个合法组合。只依据实际属性节点和值，不按名称推测。</p>
          <div v-if="!readOnly" class="exception-actions"><el-button @click="chooseRange = !chooseRange">{{ chooseRange ? '收起范围选择' : '重新选择实际规格范围' }}</el-button><el-button @click="copyDefaults">复制默认配置作为完整结果</el-button><el-button type="danger" plain @click="clearException">设为空结果</el-button><el-button type="danger" link @click="removeException">移除此例外，恢复继承默认</el-button></div>
          <div v-if="chooseRange && !readOnly" class="range-picker"><el-select v-model="combinationPicks" multiple filterable placeholder="选择一个或多个实际合法组合" aria-label="例外规格范围" data-template-exception-combinations><el-option v-for="item in context.combinations" :key="item.identityKey" :label="item.label" :value="item.identityKey" /></el-select><el-button :disabled="!combinationPicks.length" @click="applyRange">使用所选范围</el-button></div>
          <el-alert v-if="!selectedException.claims.length" title="此例外明确为空结果，不回退到默认设备。移除例外才会恢复继承。" type="warning" :closable="false" />
          <TemplateClaimSetEditor v-model="selectedException.claims" :readonly="readOnly" />
        </el-form>
        <el-empty v-else description="尚无规格例外。所有合法组合按默认配置处理。" :image-size="65" />
      </el-tab-pane>
      <el-tab-pane label="生效预览" name="preview">
        <p class="muted">预览共 {{ effective.length }} 个合法组合，只读计算，不创建 SKU、MAT 或正式声明，也不分配 PLN 编号。{{ previewSummary }}</p>
        <el-input v-model="previewKeyword" clearable placeholder="搜索组合规格或适用设备型号" aria-label="搜索模板兼容预览" />
        <el-alert v-for="(issue,index) in context.issues" :key="index" :title="issue.message" type="warning" :closable="false" />
        <article v-for="item in previewPageRows" :key="item.identityKey" class="preview-row" :data-template-preview-row="item.identityKey" :data-template-preview-state="item.state">
          <div class="preview-head"><strong>{{ item.label }}</strong><el-tag :type="item.state === 'configured' ? 'success' : item.state === 'invalid' || item.state === 'conflict' ? 'danger' : 'info'">{{ stateLabels[item.state] }}</el-tag></div><p>{{ item.message }}</p>
          <p class="muted">{{ item.origin === 'default' ? '继承默认配置' : item.origin === 'exception' ? '使用例外完整结果' : '没有生效规则' }}<template v-if="item.ruleIds.length"> · {{ item.ruleIds.map(ruleName).join('、') }}</template></p>
          <details v-if="item.ruleIds.length"><summary class="muted">规则追溯</summary><p class="muted">{{ item.ruleIds.join('、') }}</p></details>
          <p v-for="entry in item.claims" :key="entry.claim.id" class="claim-preview">{{ claimText(entry.claim) }}</p><p v-for="(issue,index) in item.issues" :key="index" class="danger">{{ issue.message }}</p>
        </article>
        <el-empty v-if="!previewRows.length" description="没有匹配的合法组合。" :image-size="60" />
        <el-pagination v-model:current-page="previewPage" :page-size="pageSize" :total="previewRows.length" layout="prev, pager, next, total" size="small" />
      </el-tab-pane>
      <el-tab-pane :label="`旧节点配置 ${legacy.items.length}`" name="legacy">
        <el-alert title="旧节点适用配置原样保留，不会自动用于新商品。仅转换范围可证明的记录；未记录核验状态的旧配置转换后为待确认。" type="warning" :closable="false" />
        <article v-for="item in legacy.items" :key="item.legacyRuleId" class="legacy-row" :data-template-legacy-rule="item.legacyRuleId"><el-checkbox :model-value="legacyPicks.includes(item.legacyRuleId)" :disabled="readOnly || item.state !== 'ready'" @change="toggleLegacy(item.legacyRuleId)">{{ item.nodeLabel }} · {{ item.hosts.length }} 个型号</el-checkbox><p>{{ item.message }} · 影响 {{ item.count }} 个合法组合</p><p class="muted">{{ item.selector ? selectorText(item.selector) : '无法证明范围，继续保留待处理' }}</p></article>
        <el-empty v-if="!legacy.items.length" description="当前模型没有旧节点适用配置。" :image-size="65" />
        <el-button v-if="!readOnly" :disabled="!legacyPicks.length" data-template-convert-legacy @click="convertLegacy">转换所选记录到本次草稿</el-button>
      </el-tab-pane>
    </el-tabs>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon data-template-config-error />
    <template #footer><span v-if="dirty" class="dirty-note">有未保存修改</span><el-button @click="requestClose">{{ readOnly ? '关闭' : '取消' }}</el-button><el-button @click="tab = 'preview'">查看生效预览</el-button><el-button v-if="!readOnly" type="primary" :loading="saving" data-template-save @click="save">保存到模型草稿</el-button></template>
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onBeforeRouteLeave } from 'vue-router'
import { useCatalogStore, uid } from '../../stores/catalog'
import { applyLegacyTemplateCompatibilityConversion, cloneTemplateCompatibility, createEmptyTemplateCompatibilityConfig, createTemplateCompatibilityContext, previewLegacyTemplateCompatibilityConversion, resolveTemplateCompatibility, selectorForCombination, selectorForNode } from '../../domain/templateCompatibility'
import type { TemplateCompatibilityClaim, TemplateCompatibilityConfig, TemplateSpecSelector } from '../../domain/templateCompatibilityTypes'
import { capabilityLabels, conclusionLabels, conditionText, hostText, scopeText, verificationLabels } from '../compatibility/compatibilityPresentation'
import TemplateClaimSetEditor from './TemplateClaimSetEditor.vue'

const props = defineProps<{ modelValue: boolean; modelId: string; initialNodeId?: string; readonly?: boolean; versionId?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value:boolean]; saved: [] }>()
const store = useCatalogStore(), visible = ref(false), loadedModelId = ref(''), loadedVersionId = ref(''), loadedInitialNodeId = ref('')
const draft = ref<TemplateCompatibilityConfig>(), baseline = ref(''), expectedRevision = ref(0), error = ref(''), saving = ref(false), contextNotice = ref('')
const selectedExceptionId = ref(''), combinationPicks = ref<string[]>([]), chooseRange = ref(false), legacyPicks = ref<string[]>([])
const tab = ref('default'), previewKeyword = ref(''), previewPage = ref(1), pageSize = 12
let opener: HTMLElement | null = null, guardPending = false
onBeforeRouteLeave(async () => !visible.value || await canDiscard())
const readOnly = computed(() => !!props.readonly || !store.isAdmin || !!loadedVersionId.value)
const modelName = computed(() => store.data.specCanvases.find(item => item.templateId === loadedModelId.value)?.name || store.data.templates.find(item => item.id === loadedModelId.value)?.name || loadedModelId.value)
const dirty = computed(() => !!draft.value && JSON.stringify(draft.value) !== baseline.value)
const context = computed(() => createTemplateCompatibilityContext(store.data,{modelId:loadedModelId.value,versionId:loadedVersionId.value || undefined,config:draft.value}))
const effective = computed(() => context.value.combinations.map(item => resolveTemplateCompatibility(context.value,item)))
const previewRows = computed(() => effective.value.filter(item => !previewKeyword.value.trim() || `${item.label} ${item.claims.map(entry => hostText(entry.claim.host)).join(' ')}`.toLowerCase().includes(previewKeyword.value.trim().toLowerCase())))
const previewPageRows = computed(() => previewRows.value.slice((previewPage.value - 1) * pageSize,previewPage.value * pageSize))
const previewSummary = computed(() => Object.entries(stateLabels).map(([key,label]) => `${label} ${effective.value.filter(item => item.state === key).length}`).join(' · '))
const selectedException = computed(() => draft.value?.exceptions.find(item => item.id === selectedExceptionId.value))
const exceptionCount = computed(() => effective.value.filter(item => item.ruleIds.includes(selectedExceptionId.value)).length)
const legacy = computed(() => previewLegacyTemplateCompatibilityConversion(store.data,loadedModelId.value,draft.value,context.value))
const stateLabels = {unconfigured:'未配置',configured:'已配置',empty:'空结果',invalid:'引用失效',conflict:'规则冲突'}
watch(previewKeyword,() => {previewPage.value = 1})
watch(() => props.modelValue,async value => {
  if (value && !visible.value) { opener = document.activeElement instanceof HTMLElement ? document.activeElement : null; load(); visible.value = true }
  else if (!value && visible.value) { if (await canDiscard()) visible.value = false; else emit('update:modelValue',true) }
},{immediate:true})
watch(() => [props.modelId,props.versionId,props.initialNodeId] as const,async () => {
  if (!visible.value) return
  if (props.modelId === loadedModelId.value && (props.versionId || '') === loadedVersionId.value && (props.initialNodeId || '') === loadedInitialNodeId.value) return
  if (await canDiscard()) load()
  else contextNotice.value = `已保留“${modelName.value}”的未保存配置。当前弹窗仍属于该模型，请先保存或取消后再打开其他模型。`
})
function load() {
  loadedModelId.value = props.modelId; loadedVersionId.value = props.versionId || ''; loadedInitialNodeId.value = props.initialNodeId || ''
  const version = store.data.specModelVersions.find(item => item.id === loadedVersionId.value)
  const saved = loadedVersionId.value ? version?.templateCompatibilitySnapshot?.config : store.data.templateCompatibilityConfigs?.find(item => item.modelId === loadedModelId.value)
  draft.value = cloneTemplateCompatibility(saved || createEmptyTemplateCompatibilityConfig(loadedModelId.value)); baseline.value = JSON.stringify(draft.value); expectedRevision.value = draft.value.revision
  tab.value = 'default'; selectedExceptionId.value = draft.value.exceptions[0]?.id || ''; combinationPicks.value = []; legacyPicks.value = []; chooseRange.value = false; previewKeyword.value = ''; previewPage.value = 1; error.value = ''; contextNotice.value = ''
  if (props.initialNodeId && !readOnly.value) {
    const result = selectorForNode(context.value,props.initialNodeId)
    tab.value = 'exceptions'
    if (!result.selector) {error.value = result.message; return}
    const existing = draft.value.exceptions.find(item => JSON.stringify(item.selector) === JSON.stringify(result.selector))
    if (existing) selectedExceptionId.value = existing.id
    else { const id = uid('texception'); draft.value.exceptions.push({id,name:`节点规格例外（${result.count} 个组合）`,selector:result.selector,claims:[]}); selectedExceptionId.value = id }
  }
}
async function canDiscard() { if (!dirty.value) return true; if (guardPending) return false; guardPending = true; try {await ElMessageBox.confirm('当前适用设备配置尚未保存，放弃这些修改？','未保存配置',{confirmButtonText:'放弃修改',cancelButtonText:'继续编辑',type:'warning'}); return true} catch {return false} finally {guardPending = false} }
async function requestClose() { if (await canDiscard()) {visible.value = false; emit('update:modelValue',false)} }
function beforeClose(done:() => void) { void canDiscard().then(ok => {if(ok) {emit('update:modelValue',false); visible.value = false; done()}}) }
async function returnFocus() {await nextTick(); if(opener?.isConnected) opener.focus()}
function newException() { if(!draft.value || readOnly.value) return; const id=uid('texception'); draft.value.exceptions.push({id,name:`规格例外 ${draft.value.exceptions.length + 1}`,selector:{anyOf:[]},claims:[]}); selectedExceptionId.value = id; combinationPicks.value = []; chooseRange.value = true }
function applyRange() { if(!selectedException.value || readOnly.value) return; selectedException.value.selector = {anyOf:context.value.combinations.filter(item => combinationPicks.value.includes(item.identityKey)).flatMap(item => selectorForCombination(item).anyOf)}; chooseRange.value = false; error.value = '' }
function copyDefaults() { if(!selectedException.value || !draft.value || readOnly.value) return; selectedException.value.claims = cloneTemplateCompatibility(draft.value.defaultRule.claims).map(item => ({...item,id:uid('tclaim')})) }
function clearException() {if(selectedException.value && !readOnly.value) selectedException.value.claims = []}
function removeException() {if(!draft.value || readOnly.value) return; draft.value.exceptions = draft.value.exceptions.filter(item => item.id !== selectedExceptionId.value); selectedExceptionId.value = draft.value.exceptions[0]?.id || ''; chooseRange.value = false}
function attributeName(id:string) {const snapshot=store.data.specModelVersions.find(item=>item.id===loadedVersionId.value)?.templateCompatibilitySnapshot;return loadedVersionId.value ? snapshot?.attributeNames.find(item=>item.attributeId===id)?.name || id : store.data.params.find(item=>item.id===id)?.name || id}
function selectorText(selector:TemplateSpecSelector) { if(!selector.anyOf.length) return '尚未选择有效范围'; return selector.anyOf.map(terms => terms.map(term => `${attributeName(term.attributeId)}：${term.valueId}`).join(' 且 ')).join('；或 ') }
function ruleName(id:string) {return id===draft.value?.defaultRule.id ? '默认配置' : draft.value?.exceptions.find(item=>item.id===id)?.name || '已保留的来源规则'}
async function setDefaultConfigured(value:boolean) {if(!draft.value||readOnly.value)return;if(!value&&draft.value.defaultRule.claims.length){try{await ElMessageBox.confirm('改为未配置会移除本次草稿中的默认声明，规格例外保持。继续？','停用默认配置',{confirmButtonText:'改为未配置',cancelButtonText:'继续保留',type:'warning'})}catch{return}draft.value.defaultRule.claims=[]}draft.value.defaultRule.configured=value}
function claimText(claim:TemplateCompatibilityClaim) { return `${hostText(claim.host)} · ${scopeText(claim.host)} · ${capabilityLabels[claim.capability]} · ${verificationLabels[claim.verification]}${conclusionLabels[claim.conclusion]}${claim.conditions.length ? ` · ${claim.conditions.map(item => conditionText(store.data,item)).join('；')}` : ''} · 依据：${claim.source || '未填写'}${claim.note ? ` · 备注：${claim.note}` : ''}` }
function toggleLegacy(id:string) {legacyPicks.value = legacyPicks.value.includes(id) ? legacyPicks.value.filter(item => item !== id) : [...legacyPicks.value,id]}
function convertLegacy() {if(readOnly.value || !draft.value) return; const result = applyLegacyTemplateCompatibilityConversion(store.data,loadedModelId.value,legacyPicks.value,new Date().toISOString(),draft.value); if(!result.ok) {error.value=result.message; return}; draft.value = result.config; selectedExceptionId.value=result.config.conversions.find(item=>legacyPicks.value.includes(item.legacyRuleId))?.exceptionId || result.config.exceptions[0]?.id || ''; legacyPicks.value=[]; error.value=''; ElMessage.success(`${result.message}；尚未保存到模型草稿。`)}
function save() {if(readOnly.value || !draft.value || saving.value) return; saving.value=true; const result=store.saveTemplateCompatibility(cloneTemplateCompatibility(draft.value),expectedRevision.value); saving.value=false; if(!result.ok) {error.value=result.message || '保存失败，当前草稿已保留。'; return}; const saved=store.data.templateCompatibilityConfigs?.find(item => item.modelId===loadedModelId.value); if(saved) draft.value=cloneTemplateCompatibility(saved); baseline.value=JSON.stringify(draft.value); expectedRevision.value=draft.value.revision; error.value=''; emit('saved'); ElMessage.success(result.message || '适用设备配置已保存到模型草稿。')}
</script>
<style scoped>
.muted { color:var(--el-text-color-secondary); font-size:13px; line-height:1.65; }.exception-tools,.exception-actions,.range-picker { display:flex; gap:10px; flex-wrap:wrap; margin:14px 0; }.exception-tools>.el-select { flex:1; min-width:220px; }.range-picker>.el-select { width:100%; }.preview-row,.legacy-row { border:1px solid var(--el-border-color-lighter); border-radius:10px; padding:12px; margin:12px 0; overflow-wrap:anywhere; }.preview-head { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }.preview-row p,.legacy-row p { margin:8px 0; line-height:1.65; }.claim-preview { padding-left:12px; border-left:2px solid var(--el-color-primary-light-5); font-size:13px; }.danger {color:var(--el-color-danger);}.dirty-note { color:var(--el-color-warning); margin-right:12px; font-size:13px; }.el-pagination { flex-wrap:wrap; }
@media(max-width:700px) { .preview-head {flex-wrap:wrap;}.exception-actions .el-button {margin-left:0;}.dirty-note {display:block;margin-bottom:8px;} }
</style>
