<template>
  <el-dialog :model-value="visible" :title="`适用设备配置 · ${modelName}${loadedVersionId ? '（历史版本只读）' : ''}`" width="min(1080px, 96vw)" top="4vh" class="template-config-dialog" :close-on-click-modal="false" :close-on-press-escape="!saving" :show-close="!saving" :before-close="beforeClose" append-to-body data-template-compatibility-dialog @closed="returnFocus">
    <el-alert v-if="contextNotice" :title="contextNotice" type="warning" :closable="false" />
    <el-alert v-if="readOnly" title="当前配置只读，可以查看规则和预览，不能保存或转换。" type="info" :closable="false" />
    <p class="muted task-guide">选择适用设备 → 有特殊规格时设置例外 → 检查结果 → 保存草稿。发布后才冻结到新版本。</p>
    <nav v-if="draft" class="config-summary" aria-label="配置摘要">
      <button type="button" @click="tab='default'"><strong>{{ defaultDeviceCount }}</strong><span>默认适用型号</span></button>
      <button type="button" @click="tab='exceptions'"><strong>{{ draft.exceptions.length }}</strong><span>规格例外</span></button>
      <button type="button" @click="showPreview('default')"><strong>{{ originCounts.default }}</strong><span>规格使用默认</span></button>
      <button type="button" @click="showPreview('exception')"><strong>{{ originCounts.exception }}</strong><span>规格使用例外</span></button>
      <button type="button" :class="{problem: issues.length}" data-template-issue-summary @click="issues[0] && locateIssue(issues[0])"><strong>{{ issues.length }}</strong><span>处待完善</span></button>
    </nav>
    <details v-if="issues.length" class="issue-summary" :open="!!error"><summary>{{ issues.length }} 处待完善 · 点击定位</summary><button v-for="(issue,index) in issues" :key="`${issue.ruleId}:${issue.claimId}:${issue.message}`" type="button" @click="locateIssue(issue)">{{ index+1 }}. {{ ruleName(issue.ruleId || '') }} · {{ issue.message }}</button></details>
    <el-tabs v-if="draft" v-model="tab" data-template-tabs>
      <el-tab-pane label="默认配置" name="default">
        <el-form label-position="top">
          <el-form-item label="默认配置状态"><el-select :model-value="draft.defaultRule.configured" :disabled="readOnly || converting || saving" data-template-default-state @update:model-value="setDefaultConfigured"><el-option label="未配置：不产生声明" :value="false" /><el-option label="已明确配置（允许为空）" :value="true" /></el-select></el-form-item>
          <TemplateClaimSetEditor v-if="draft.defaultRule.configured" ref="defaultEditor" v-model="draft.defaultRule.claims" @batch-change="defaultBatchDirty=$event" :issues="ruleIssues(draft.defaultRule.id)" :readonly="readOnly || saving" empty-text="已明确配置为空：不产生适用声明。这与未配置分别记录。" />
          <el-empty v-else description="默认配置尚未设置。可以启用配置，再选择实际设备型号。" :image-size="65" />
        </el-form>
      </el-tab-pane>
      <el-tab-pane :label="`规格例外 ${draft.exceptions.length}`" name="exceptions">
        <el-alert title="例外是完整结果：只配置一款设备，就只适用这一款；需要保留其他默认设备时先复制默认配置。" type="info" :closable="false" />
        <div class="exception-tools"><el-select :model-value="selectedExceptionId" :disabled="converting || saving" @update:model-value="selectException" placeholder="选择已有例外" aria-label="选择模板兼容例外"><el-option v-for="item in draft.exceptions" :key="item.id" :label="item.name || '未命名例外'" :value="item.id" /></el-select><el-button v-if="!readOnly" :disabled="converting || saving" data-template-add-exception @click="newException">新增规格例外</el-button></div>
        <el-form v-if="selectedException" label-position="top" data-template-exception-editor>
          <h3 class="step-title">1 · 选择规格范围</h3>
          <el-form-item label="例外名称"><el-input v-model="selectedException.name" :disabled="readOnly || converting || saving" placeholder="便于识别的配置名称" /></el-form-item>
          <p class="muted" data-template-exception-scope>配置范围：{{ selectorText(selectedException.selector) }} · 当前影响 {{ exceptionCount }} 个合法组合。只依据实际属性节点和值，不按名称推测。</p>
          <div v-if="!readOnly" class="exception-actions"><el-button :disabled="converting || saving" @click="chooseRange = !chooseRange">{{ chooseRange ? '收起范围选择' : '重新选择实际规格范围' }}</el-button></div>
          <div v-if="chooseRange && !readOnly" class="range-picker" data-template-scope-field><el-select v-model="combinationPicks" :disabled="converting || saving" multiple filterable placeholder="选择一个或多个实际合法组合" aria-label="例外规格范围" data-template-exception-combinations><el-option v-for="item in context.combinations" :key="item.identityKey" :label="item.label" :value="item.identityKey" /></el-select><el-button :disabled="converting || saving || !combinationPicks.length" @click="applyRange">使用所选范围</el-button></div>
          <h3 class="step-title">2 · 设置完整适用结果</h3>
          <div v-if="!readOnly" class="exception-actions"><el-button :disabled="converting || saving" @click="copyDefaults">复制默认配置</el-button><el-dropdown :disabled="converting || saving" trigger="click" @command="exceptionCommand"><el-button :disabled="converting || saving">更多操作 ▾</el-button><template #dropdown><el-dropdown-menu><el-dropdown-item command="empty">这些规格不产生适用声明</el-dropdown-item><el-dropdown-item command="remove" divided>删除例外并恢复默认</el-dropdown-item></el-dropdown-menu></template></el-dropdown></div>
          <el-alert v-if="!selectedException.claims.length" title="此例外明确为空结果，不回退到默认设备。移除例外才会恢复继承。" type="warning" :closable="false" />
          <TemplateClaimSetEditor :key="selectedException.id" ref="exceptionEditor" v-model="selectedException.claims" @batch-change="exceptionBatchDirty=$event" :issues="ruleIssues(selectedException.id)" :readonly="readOnly || saving" />
          <h3 class="step-title">3 · 检查影响</h3><p class="muted">当前范围影响 {{ exceptionCount }} 个合法组合，例外完整替代默认。<el-button link type="primary" @click="showPreview('exception')">查看受影响规格与最终结果</el-button></p>
        </el-form>
        <el-empty v-else description="尚无规格例外。所有合法组合按默认配置处理。" :image-size="65" />
      </el-tab-pane>
      <el-tab-pane label="生效预览" name="preview">
        <p class="muted">预览共 {{ effective.length }} 个合法组合，只读计算，不创建 SKU、MAT 或正式声明，也不分配 PLN 编号。{{ previewSummary }}</p>
        <el-input v-model="previewKeyword" clearable placeholder="搜索组合规格或适用设备型号" aria-label="搜索模板兼容预览" />
        <el-radio-group v-model="previewOrigin" size="small" class="preview-origin" aria-label="预览结果范围"><el-radio-button value="all">全部规格</el-radio-button><el-radio-button value="default">使用默认</el-radio-button><el-radio-button value="exception">使用例外</el-radio-button><el-radio-button value="problems">冲突或待完善</el-radio-button></el-radio-group>
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
      <el-tab-pane :label="`旧节点工具 ${legacy.items.length}`" name="legacy">
        <details><summary class="legacy-summary">展开旧节点转换工具（{{ legacy.items.length }} 项）</summary>
        <el-alert title="旧节点适用配置原样保留，不会自动用于新商品。仅转换范围可证明的记录；未记录核验状态的旧配置转换后为待确认。" type="warning" :closable="false" />
        <article v-for="item in legacy.items" :key="item.legacyRuleId" class="legacy-row" :data-template-legacy-rule="item.legacyRuleId"><el-checkbox :model-value="legacyPicks.includes(item.legacyRuleId)" :disabled="readOnly || converting || saving || item.state !== 'ready'" @change="toggleLegacy(item.legacyRuleId)">{{ item.nodeLabel }} · {{ item.hosts.length }} 个型号</el-checkbox><p>{{ item.message }} · 影响 {{ item.count }} 个合法组合</p><p class="muted">{{ item.selector ? selectorText(item.selector) : '无法证明范围，继续保留待处理' }}</p></article>
        <el-empty v-if="!legacy.items.length" description="当前模型没有旧节点适用配置。" :image-size="65" />
        <el-button v-if="!readOnly" :disabled="converting || saving || !legacyPicks.length" :loading="converting" data-template-convert-legacy @click="convertLegacy">转换所选记录到本次草稿</el-button>
        </details>
      </el-tab-pane>
    </el-tabs>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon data-template-config-error />
    <template #footer><span v-if="dirty" class="dirty-note">有未保存修改</span><el-button :disabled="converting || saving" @click="requestClose">{{ readOnly ? '关闭' : '取消' }}</el-button><el-button @click="showPreview('all')">查看生效预览</el-button><el-button v-if="!readOnly" type="primary" :loading="saving" data-template-save @click="save">保存到模型草稿</el-button></template>
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onBeforeRouteLeave } from 'vue-router'
import { useCatalogStore, uid } from '../../stores/catalog'
import { applyLegacyTemplateCompatibilityConversion, cloneTemplateCompatibility, createEmptyTemplateCompatibilityConfig, createTemplateCompatibilityContext, prepareTemplateCompatibilityConfig, previewLegacyTemplateCompatibilityConversion, resolveTemplateCompatibility, selectorForCombination, selectorForNode } from '../../domain/templateCompatibility'
import type { TemplateCompatibilityClaim, TemplateCompatibilityConfig, TemplateCompatibilityIssue, TemplateSpecSelector } from '../../domain/templateCompatibilityTypes'
import { capabilityLabels, conclusionLabels, conditionText, hostText, scopeText, verificationLabels } from '../compatibility/compatibilityPresentation'
import TemplateClaimSetEditor from './TemplateClaimSetEditor.vue'

const props = defineProps<{ modelValue: boolean; modelId: string; initialNodeId?: string; readonly?: boolean; versionId?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value:boolean]; saved: [] }>()
const store = useCatalogStore(), visible = ref(false), loadedModelId = ref(''), loadedVersionId = ref(''), loadedInitialNodeId = ref('')
const draft = ref<TemplateCompatibilityConfig>(), baseline = ref(''), expectedRevision = ref(0), error = ref(''), saving = ref(false), converting=ref(false), contextNotice = ref('')
const selectedExceptionId = ref(''), combinationPicks = ref<string[]>([]), chooseRange = ref(false), legacyPicks = ref<string[]>([])
const tab = ref('default'), previewKeyword = ref(''), previewPage = ref(1), pageSize = 12
const defaultBatchDirty=ref(false),exceptionBatchDirty=ref(false)
const previewOrigin=ref('all'), defaultEditor=ref<InstanceType<typeof TemplateClaimSetEditor>>(),exceptionEditor=ref<InstanceType<typeof TemplateClaimSetEditor>>()
let opener: HTMLElement | null = null, guardPending = false, contextEpoch = 0
watch(
  () => [props.modelValue, props.modelId, props.versionId, props.initialNodeId, props.readonly,
    store.editorGeneration, store.isAdmin, store.data, visible.value, loadedModelId.value, loadedVersionId.value, selectedExceptionId.value],
  () => { contextEpoch++ }, { flush: 'sync' },
)
// Only this editor's draft and batch inputs are captured; no whole-catalog snapshot.
function inputStamp() {
  return JSON.stringify([contextEpoch, visible.value, readOnly.value, loadedModelId.value,
    loadedVersionId.value, selectedExceptionId.value, expectedRevision.value, draft.value,
    legacyPicks.value, exceptionEditor.value?.batchSignature, defaultEditor.value?.batchSignature,
    store.data.templateCompatibilityConfigs?.find(config => config.modelId === loadedModelId.value)])
}
async function confirmBatchDiscard(
  confirmButtonText = '放弃这批输入',
  message = '当前例外的批量输入尚未应用，切换会放弃这批输入。其他模型草稿继续保留。',
) {
  if (!exceptionBatchDirty.value) return true
  try {
    await ElMessageBox.confirm(message, '尚未应用的批量输入', {
      confirmButtonText, cancelButtonText: '继续填写', type: 'warning',
    })
    return true
  } catch { return false }
}
onBeforeRouteLeave(async () => !visible.value || await canDiscard())
const readOnly = computed(() => !!props.readonly || !store.isAdmin || !!loadedVersionId.value)
const modelName = computed(() => store.data.specCanvases.find(item => item.templateId === loadedModelId.value)?.name || store.data.templates.find(item => item.id === loadedModelId.value)?.name || loadedModelId.value)
const dirty = computed(() => !!draft.value && (JSON.stringify(draft.value) !== baseline.value || defaultBatchDirty.value || exceptionBatchDirty.value))
// Structural dependencies are tracked by Vue; typing evidence/notes only prepares rules, never re-expands the model.
const structure = computed(() => createTemplateCompatibilityContext(store.data,{modelId:loadedModelId.value,versionId:loadedVersionId.value || undefined,config:createEmptyTemplateCompatibilityConfig(loadedModelId.value)}))
const context = computed(() => draft.value && !loadedVersionId.value ? prepareTemplateCompatibilityConfig(store.data,structure.value,draft.value) : structure.value)
// Hidden preview panes do not clone every effective claim while the user types.
const effective = computed(() => tab.value==='preview' ? context.value.combinations.map(item => resolveTemplateCompatibility(context.value,item)) : [])
const originCounts=computed(()=>{const current=context.value,result={default:0,exception:0};if(current.issues.length)return result;for(const combo of current.combinations){if(current.matches.get(combo.identityKey)?.length)result.exception++;else if(current.config.defaultRule.configured)result.default++}return result})
const defaultDeviceCount=computed(()=>new Set(draft.value?.defaultRule.claims.map(claim=>JSON.stringify([claim.host.productTypeId,claim.host.productModelId,claim.host.identityKey]))).size)
const issues=computed(()=>{const current=context.value,conflicts:TemplateCompatibilityIssue[]=[];for(const ids of current.matches.values()){const rules=ids.flatMap(id=>{const rule=current.rules.get(id);return rule?[rule]:[]});if(rules.every(rule=>!rule.issues.length)&&new Set(rules.map(rule=>rule.signature)).size>1)for(const ruleId of ids)conflicts.push({ruleId,message:'同一规格命中不同的完整替代配置。'})}return [...new Map([...current.issues,...[...current.rules.values()].flatMap(rule=>rule.issues),...conflicts].map(issue=>[JSON.stringify([issue.ruleId,issue.claimId,issue.field,issue.message]),issue])).values()]})
const previewRows = computed(() => effective.value.filter(item => (previewOrigin.value==='all'||previewOrigin.value===item.origin||previewOrigin.value==='problems'&&['invalid','conflict'].includes(item.state)) && (!previewKeyword.value.trim() || `${item.label} ${item.claims.map(entry => hostText(entry.claim.host)).join(' ')}`.toLowerCase().includes(previewKeyword.value.trim().toLowerCase()))))
const previewPageRows = computed(() => previewRows.value.slice((previewPage.value - 1) * pageSize,previewPage.value * pageSize))
const previewSummary = computed(() => Object.entries(stateLabels).map(([key,label]) => `${label} ${effective.value.filter(item => item.state === key).length}`).join(' · '))
const selectedException = computed(() => draft.value?.exceptions.find(item => item.id === selectedExceptionId.value))
const exceptionCount = computed(() => [...context.value.matches.values()].filter(ids=>ids.includes(selectedExceptionId.value)).length)
const legacy = computed(() => previewLegacyTemplateCompatibilityConversion(store.data,loadedModelId.value,draft.value,context.value))
const stateLabels = {unconfigured:'未配置',configured:'已配置',empty:'空结果',invalid:'引用失效',conflict:'规则冲突'}
watch([previewKeyword,previewOrigin],() => {previewPage.value = 1})
function preventUnload(event:BeforeUnloadEvent){if(visible.value&&dirty.value&&!store.persistenceState.discardConfirmed){event.preventDefault();event.returnValue=''}}
onMounted(()=>window.addEventListener('beforeunload',preventUnload));onUnmounted(()=>window.removeEventListener('beforeunload',preventUnload))
function ruleIssues(id:string){return issues.value.filter(issue=>issue.ruleId===id)}
function showPreview(origin:string){previewOrigin.value=origin;tab.value='preview';previewPage.value=1}
async function locateIssue(issue:TemplateCompatibilityIssue){
  if(issue.ruleId && issue.ruleId!==draft.value?.defaultRule.id){if(issue.ruleId!==selectedExceptionId.value&&!await discardExceptionBatch())return;tab.value='exceptions';selectedExceptionId.value=issue.ruleId;if(!issue.claimId)chooseRange.value=true}
  else tab.value='default'
  await nextTick()
  if(issue.claimId)await (tab.value==='default'?defaultEditor.value:exceptionEditor.value)?.locate(issue)
  else {const target=document.querySelector<HTMLElement>('[data-template-compatibility-dialog] [data-template-scope-field]');target?.scrollIntoView({block:'center'});target?.querySelector<HTMLElement>('input')?.focus({preventScroll:true})}
}
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
  contextEpoch++
  defaultEditor.value?.resetPendingBatch();exceptionEditor.value?.resetPendingBatch();defaultBatchDirty.value=false;exceptionBatchDirty.value=false
  loadedModelId.value = props.modelId; loadedVersionId.value = props.versionId || ''; loadedInitialNodeId.value = props.initialNodeId || ''
  const version = store.data.specModelVersions.find(item => item.id === loadedVersionId.value)
  const saved = loadedVersionId.value ? version?.templateCompatibilitySnapshot?.config : store.data.templateCompatibilityConfigs?.find(item => item.modelId === loadedModelId.value)
  draft.value = cloneTemplateCompatibility(saved || createEmptyTemplateCompatibilityConfig(loadedModelId.value)); baseline.value = JSON.stringify(draft.value); expectedRevision.value = draft.value.revision
  tab.value = 'default'; selectedExceptionId.value = draft.value.exceptions[0]?.id || ''; combinationPicks.value = []; legacyPicks.value = []; chooseRange.value = false; previewKeyword.value = ''; previewOrigin.value='all'; previewPage.value = 1; error.value = ''; contextNotice.value = ''
  if (props.initialNodeId && !readOnly.value) {
    const result = selectorForNode(context.value,props.initialNodeId)
    tab.value = 'exceptions'
    if (!result.selector) {error.value = result.message; return}
    const existing = draft.value.exceptions.find(item => JSON.stringify(item.selector) === JSON.stringify(result.selector))
    if (existing) selectedExceptionId.value = existing.id
    else { const id = uid('texception'); draft.value.exceptions.push({id,name:`节点规格例外（${result.count} 个组合）`,selector:result.selector,claims:[]}); selectedExceptionId.value = id }
  }
}
async function canDiscard() { if(saving.value||converting.value) return false; if (!dirty.value) return true; if (guardPending) return false; guardPending = true; try {await ElMessageBox.confirm('当前适用设备配置尚未保存，放弃这些修改？','未保存配置',{confirmButtonText:'放弃修改',cancelButtonText:'继续编辑',type:'warning'});defaultEditor.value?.resetPendingBatch();exceptionEditor.value?.resetPendingBatch(); return true} catch {return false} finally {guardPending = false} }
async function requestClose() { if (await canDiscard()) {visible.value = false; emit('update:modelValue',false)} }
function beforeClose(done:() => void) { void canDiscard().then(ok => {if(ok) {emit('update:modelValue',false); visible.value = false; done()}}) }
async function returnFocus() {await nextTick(); if(opener?.isConnected) opener.focus()}
async function newException() { if(!draft.value || readOnly.value || saving.value || !await discardExceptionBatch()) return; const id=uid('texception'); draft.value.exceptions.push({id,name:`规格例外 ${draft.value.exceptions.length + 1}`,selector:{anyOf:[]},claims:[]}); selectedExceptionId.value = id; combinationPicks.value = []; chooseRange.value = true }
async function discardExceptionBatch() {
  if (saving.value || converting.value || guardPending) return false
  const stamp = inputStamp()
  guardPending = true
  try {
    if (!await confirmBatchDiscard()) return false
    if (stamp !== inputStamp()) {
      error.value = '配置或输入已变化，本次操作已取消，输入已保留。'
      return false
    }
    exceptionEditor.value?.resetPendingBatch()
    return true
  } finally { guardPending = false }
}
async function selectException(value:string){if(saving.value||value===selectedExceptionId.value||!await discardExceptionBatch())return;selectedExceptionId.value=value}
function applyRange() { if(!selectedException.value || readOnly.value || saving.value) return; selectedException.value.selector = {anyOf:context.value.combinations.filter(item => combinationPicks.value.includes(item.identityKey)).flatMap(item => selectorForCombination(item).anyOf)}; chooseRange.value = false; error.value = '' }
function copyDefaults() { if(!selectedException.value || !draft.value || readOnly.value || saving.value) return; selectedException.value.claims = cloneTemplateCompatibility(draft.value.defaultRule.claims).map(item => ({...item,id:uid('tclaim')})) }
function clearException() {if(selectedException.value && !readOnly.value && !saving.value) selectedException.value.claims = []}
function removeException() {if(!draft.value || readOnly.value || saving.value) return;exceptionEditor.value?.resetPendingBatch(); draft.value.exceptions = draft.value.exceptions.filter(item => item.id !== selectedExceptionId.value); selectedExceptionId.value = draft.value.exceptions[0]?.id || ''; chooseRange.value = false}
async function exceptionCommand(command:string){if(saving.value||readOnly.value)return;const message=command==='empty'?'此范围将不产生任何适用声明，默认设备也不会带入。':'删除这条例外后，其范围重新使用默认配置。';try{await ElMessageBox.confirm(message,command==='empty'?'设置空覆盖':'删除例外并恢复默认',{confirmButtonText:'确认修改草稿',cancelButtonText:'保留当前配置',type:'warning'})}catch{return}if(command==='empty')clearException();else if(command==='remove')removeException()}
function attributeName(id:string) {const snapshot=store.data.specModelVersions.find(item=>item.id===loadedVersionId.value)?.templateCompatibilitySnapshot;return loadedVersionId.value ? snapshot?.attributeNames.find(item=>item.attributeId===id)?.name || id : store.data.params.find(item=>item.id===id)?.name || id}
function selectorText(selector:TemplateSpecSelector) { if(!selector.anyOf.length) return '尚未选择有效范围'; return selector.anyOf.map(terms => terms.map(term => `${attributeName(term.attributeId)}：${term.valueId}`).join(' 且 ')).join('；或 ') }
function ruleName(id:string) {return id===draft.value?.defaultRule.id ? '默认配置' : draft.value?.exceptions.find(item=>item.id===id)?.name || '已保留的来源规则'}
async function setDefaultConfigured(value:boolean) {if(!draft.value||readOnly.value||saving.value)return;if(!value&&(draft.value.defaultRule.claims.length||defaultBatchDirty.value)){try{await ElMessageBox.confirm('改为未配置会移除本次草稿中的默认声明，规格例外保持。继续？','停用默认配置',{confirmButtonText:'改为未配置',cancelButtonText:'继续保留',type:'warning'})}catch{return}defaultEditor.value?.resetPendingBatch();draft.value.defaultRule.claims=[]}draft.value.defaultRule.configured=value}
function claimText(claim:TemplateCompatibilityClaim) { return `${hostText(claim.host)} · ${scopeText(claim.host)} · ${capabilityLabels[claim.capability]} · ${verificationLabels[claim.verification]}${conclusionLabels[claim.conclusion]}${claim.conditions.length ? ` · ${claim.conditions.map(item => conditionText(store.data,item)).join('；')}` : ''} · 依据：${claim.source || '未填写'}${claim.note ? ` · 备注：${claim.note}` : ''}` }
function toggleLegacy(id:string) {if(saving.value)return;legacyPicks.value = legacyPicks.value.includes(id) ? legacyPicks.value.filter(item => item !== id) : [...legacyPicks.value,id]}
async function convertLegacy() {
  if (readOnly.value || !draft.value || saving.value || converting.value || guardPending || !legacyPicks.value.length) return
  converting.value = true
  const stamp = inputStamp(), now = new Date().toISOString(), editor = exceptionEditor.value
  const discardBatch = exceptionBatchDirty.value
  try {
    const candidate = applyLegacyTemplateCompatibilityConversion(store.data, loadedModelId.value, [...legacyPicks.value], now, draft.value)
    if (!candidate.ok || !candidate.converted) { error.value = candidate.message; return }
    if (!await confirmBatchDiscard('放弃输入并转换', '当前例外还有尚未应用的批量输入。转换并切换到新例外会放弃这批输入，是否继续？')) return
    if (stamp !== inputStamp() || readOnly.value) {
      error.value = '确认期间模型、配置或输入已变化，转换已取消，当前输入已保留。'
      return
    }
    const checked = applyLegacyTemplateCompatibilityConversion(store.data, loadedModelId.value, [...legacyPicks.value], now, draft.value)
    if (!checked.ok || !checked.converted || JSON.stringify(checked.config) !== JSON.stringify(candidate.config)) {
      error.value = '旧记录或规格范围已变化，转换已取消，当前输入已保留。'
      return
    }
    const nextId = checked.config.conversions.find(item => legacyPicks.value.includes(item.legacyRuleId))?.exceptionId
    if (!nextId) { error.value = '未找到转换结果，当前输入已保留。'; return }
    draft.value = checked.config
    selectedExceptionId.value = nextId
    if (discardBatch) editor?.resetPendingBatch()
    legacyPicks.value = []
    error.value = ''
    ElMessage.success(`${checked.message}；尚未保存到模型草稿。`)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '转换失败，当前输入已保留。'
  } finally { converting.value = false }
}
async function save() {if(readOnly.value || !draft.value || saving.value || converting.value) return;if(defaultBatchDirty.value||exceptionBatchDirty.value){tab.value=defaultBatchDirty.value?'default':'exceptions';error.value='还有尚未应用的批量型号，请先点击“对所选型号应用”，或明确放弃这批输入后保存。';return}if(issues.value.length){error.value=`请先处理 ${issues.value.length} 处待完善，当前输入已保留。`;if(issues.value[0])await locateIssue(issues.value[0]);return}const submittedModelId=loadedModelId.value;saving.value=true;try{const result=await store.saveTemplateCompatibility(cloneTemplateCompatibility(draft.value),expectedRevision.value);if(!result.ok) {error.value=result.message || '保存失败，当前草稿已保留。'; return}; const saved=store.data.templateCompatibilityConfigs?.find(item => item.modelId===submittedModelId); if(saved) draft.value=cloneTemplateCompatibility(saved); baseline.value=JSON.stringify(draft.value); expectedRevision.value=draft.value.revision; error.value=''; emit('saved'); ElMessage.success(result.message || '适用设备配置已保存到模型草稿。')}catch(cause){error.value=cause instanceof Error?cause.message:'保存失败，当前输入已保留。'}finally{saving.value=false}}
</script>
<style scoped>
.muted { color:var(--el-text-color-secondary); font-size:13px; line-height:1.65; }.exception-tools,.exception-actions,.range-picker { display:flex; gap:10px; flex-wrap:wrap; margin:14px 0; }.exception-tools>.el-select { flex:1; min-width:220px; }.range-picker>.el-select { width:100%; }.preview-row,.legacy-row { border:1px solid var(--el-border-color-lighter); border-radius:10px; padding:12px; margin:12px 0; overflow-wrap:anywhere; }.preview-head { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }.preview-row p,.legacy-row p { margin:8px 0; line-height:1.65; }.claim-preview { padding-left:12px; border-left:2px solid var(--el-color-primary-light-5); font-size:13px; }.danger {color:var(--el-color-danger);}.dirty-note { color:var(--el-color-warning); margin-right:12px; font-size:13px; }.el-pagination { flex-wrap:wrap; }
@media(max-width:700px) { .preview-head {flex-wrap:wrap;}.exception-actions .el-button {margin-left:0;}.dirty-note {display:block;margin-bottom:8px;} }
.task-guide{margin-top:0}.config-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));background:var(--el-fill-color-light);border-radius:12px;padding:12px 4px;margin:16px 0}.config-summary button{display:flex;flex-direction:column;gap:5px;align-items:center;border:0;background:none;color:var(--el-text-color-regular);cursor:pointer;padding:6px}.config-summary strong{font-size:22px;font-weight:600;color:var(--el-text-color-primary)}.config-summary span{font-size:12px}.config-summary .problem strong{color:var(--el-color-danger)}.config-summary button:focus-visible{outline:2px solid var(--el-color-primary);border-radius:6px}.issue-summary{padding:10px 14px;border:1px solid var(--el-color-danger-light-7);border-radius:8px;color:var(--el-color-danger);margin-bottom:14px}.issue-summary summary,.legacy-summary{cursor:pointer;line-height:1.7}.issue-summary button{display:block;text-align:left;color:var(--el-color-danger);padding:8px 0;border:0;background:none;cursor:pointer;line-height:1.5}.step-title{font-size:15px;margin:22px 0 12px}.preview-origin{margin-top:14px;flex-wrap:wrap}.preview-row{background:var(--el-bg-color)}
:global(.template-config-dialog){display:flex;flex-direction:column;max-height:92dvh;padding:0;border-radius:14px;overflow:hidden}:global(.template-config-dialog .el-dialog__header){padding:20px 24px 16px;margin:0;border-bottom:1px solid var(--el-border-color-extra-light);flex-shrink:0}:global(.template-config-dialog .el-dialog__body){padding:18px 24px;overflow:auto;min-height:0;overscroll-behavior:contain}:global(.template-config-dialog .el-dialog__footer){padding:14px 24px;border-top:1px solid var(--el-border-color-extra-light);flex-shrink:0;background:var(--el-bg-color)}
@media(max-width:600px){.config-summary{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.config-summary strong{font-size:19px}:global(.template-config-dialog .el-dialog__header),:global(.template-config-dialog .el-dialog__body),:global(.template-config-dialog .el-dialog__footer){padding:14px}:global(.template-config-dialog .el-dialog__footer){display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}:global(.template-config-dialog .el-dialog__footer .el-button){margin:0}.dirty-note{width:100%;margin:0}.exception-tools>.el-select{min-width:0;width:100%}}
</style>
