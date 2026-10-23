<template>
  <el-dialog :model-value="modelValue" title="检查模板兼容更新" width="min(1040px, 96vw)" append-to-body :close-on-click-modal="false" data-template-sync-dialog @update:model-value="emit('update:modelValue',$event)" @closed="returnFocus">
    <p class="muted">只检查明确选择的真实 SKU / MAT，不改变商品建档版本。模板来源声明可以更新；手工声明、人工修改和已取消声明默认保留。恢复已取消声明也必须先预览并逐条确认。</p>
    <el-alert v-if="!store.isAdmin" title="当前为只读角色，可以预览更新，不能应用。" type="info" :closable="false" />
    <el-form label-position="top">
      <div class="form-grid"><el-form-item label="商品模型"><el-select v-model="modelId" filterable placeholder="选择模型" data-template-sync-model><el-option v-for="item in models" :key="item.id" :label="item.name" :value="item.id" /></el-select></el-form-item><el-form-item label="目标已发布版本"><el-select v-model="versionId" placeholder="选择具有兼容快照的已发布版本" data-template-sync-version><el-option v-for="item in versions" :key="item.id" :label="`${item.versionName} · ${item.publishTime}`" :value="item.id" :disabled="!item.templateCompatibilitySnapshot" /></el-select></el-form-item></div>
      <el-form-item label="更新对象"><el-select v-model="targetIds" multiple filterable placeholder="明确选择 SKU 或 MAT，可多选" data-template-sync-targets><el-option v-for="item in targets" :key="item.id" :label="targetText(store.data,item.target)" :value="item.id" /></el-select></el-form-item>
    </el-form>
    <el-button :disabled="!modelId || !versionId || !targetIds.length" data-template-sync-preview @click="makePreview">预览所选对象的更新</el-button>
    <template v-if="preview">
      <p class="muted" data-template-sync-summary>本次预览 {{ preview.items.length }} 项：{{ summary }}。检查期间不写入正式关系。</p>
      <el-empty v-if="!preview.items.length" description="所选对象没有需要处理的模板声明。" :image-size="60" />
      <article v-for="item in pageRows" :key="item.id" class="sync-row" :data-template-sync-item="item.id" :data-template-sync-state="item.state">
        <div class="sync-head"><strong>{{ item.targetName }}</strong><el-tag :type="item.state === 'protected' || item.state === 'conflict' || item.state === 'invalid' ? 'warning' : 'info'">{{ stateLabels[item.state] }}</el-tag></div>
        <p>{{ item.message }}</p><p class="muted">{{ item.sourceVersionId ? `原来源版本 ${versionName(item.sourceVersionId)}` : '没有旧模板来源' }} → {{ versionName(preview.targetVersionId) }} · 模板规则 {{ item.ruleIds.join('、') || '无' }}</p>
        <div class="diff-grid"><div><span class="muted">当前商品声明</span><p>{{ item.before ? claimText(item.before) : item.blockingIds?.length ? '无对应模板管理声明；存在下列人工不兼容声明。' : '无声明（可能已由用户取消）' }}</p></div><div><span class="muted">目标模板结果</span><p>{{ item.after ? claimText(item.after) : '移除此模板来源声明' }}</p></div></div>
        <section v-if="item.blockingIds?.length" data-template-sync-manual-denial><el-alert title="采用目标模板将取消以下人工不兼容声明。默认保留当前结果，请核对后再明确选择采用。" type="warning" :closable="false" show-icon /><p v-for="id in item.blockingIds" :key="id">{{ manualDeclarationText(id) }}</p></section>
        <details class="baseline"><summary>查看上次模板基线</summary><p>{{ previousBaselineText(item) }}</p></details>
        <el-radio-group v-if="!item.duplicateManual && item.state !== 'unchanged' && item.state !== 'invalid' && item.state !== 'conflict'" :model-value="decisions[item.id] || 'keep'" :disabled="!store.isAdmin" @update:model-value="setDecision(item.id,$event)"><el-radio value="keep">保留当前结果</el-radio><el-radio value="take-template">{{ item.state === 'protected' && !item.before && item.after ? '明确恢复为目标模板结果' : '采用目标模板结果' }}</el-radio></el-radio-group>
        <p v-else class="muted">{{ item.duplicateManual ? '保留已有独立声明，不重新创建或认领模板来源。' : item.state === 'unchanged' ? '结果一致，无需写入。' : '此项不可应用，请先处理来源或规则问题。' }}</p>
      </article>
      <el-pagination v-if="preview.items.length > pageSize" v-model:current-page="page" :page-size="pageSize" :total="preview.items.length" layout="prev, pager, next, total" size="small" />
    </template>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon data-template-sync-error />
    <template #footer><span v-if="preview" class="muted">采用模板 {{ selectedCount }} 项 · 保留当前 {{ keepCount }} 项</span><el-button @click="emit('update:modelValue',false)">关闭</el-button><el-button type="primary" :disabled="!store.isAdmin || !preview || !actionCount" :loading="saving" data-template-sync-apply @click="apply">确认更新与保留</el-button></template>
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useCatalogStore } from '../../stores/catalog'
import { isMaterialArchive, isRealSku } from '../../domain/catalogIdentity'
import { compatibilityFamilyRole } from '../../domain/deviceResolution'
import { declarationDraft } from '../../domain/accessoryCompatibilityCommands'
import type { AccessoryTarget } from '../../domain/accessoryCompatibilityTypes'
import type { TemplateCompatibilityClaim } from '../../domain/templateCompatibilityTypes'
import type { TemplateSyncItem, TemplateSyncPreview } from '../../domain/templateCompatibilitySync'
import { capabilityLabels, conclusionLabels, conditionText, hostText, scopeText, targetText, verificationLabels } from '../compatibility/compatibilityPresentation'

const props = defineProps<{modelValue:boolean; target?:AccessoryTarget}>()
const emit = defineEmits<{'update:modelValue':[value:boolean]; updated:[]}>()
const store = useCatalogStore(), modelId=ref(''),versionId=ref(''),targetIds=ref<string[]>([]),preview=ref<TemplateSyncPreview>(),decisions=ref<Record<string,'take-template'|'keep'>>({}),error=ref(''),saving=ref(false),page=ref(1),pageSize=10
const touchedDecisions=ref<string[]>([])
let opener:HTMLElement|null=null
const models=computed(() => store.data.specCanvases.filter(item => store.data.specModelVersions.some(version => version.templateId === item.templateId && !!version.templateCompatibilitySnapshot)).map(item => ({id:item.templateId,name:item.name || store.data.templates.find(template => template.id === item.templateId)?.name || item.templateId})))
const versions=computed(() => store.data.specModelVersions.filter(item => item.templateId===modelId.value && item.status==='published').slice().sort((a,b) => b.version-a.version))
const targets=computed(() => store.data.skus.filter(item => (isRealSku(store.data,item) || isMaterialArchive(store.data,item)) && compatibilityFamilyRole(store.data,item.familyId)==='accessory' && (item.creationSource?.templateId || store.data.families.find(family => family.id===item.familyId)?.templateId)===modelId.value).map(item => ({id:item.id,target:{kind:isMaterialArchive(store.data,item)?'material':'sku',id:item.id} as AccessoryTarget})))
const stateLabels={add:'新增',update:'更新',remove:'移除',protected:'人工保护',conflict:'来源冲突',invalid:'引用失效',unchanged:'保持不变'}
const summary=computed(() => Object.entries(stateLabels).map(([key,label]) => `${label} ${preview.value?.items.filter(item => item.state===key).length || 0}`).join(' · '))
const pageRows=computed(() => preview.value?.items.slice((page.value-1)*pageSize,page.value*pageSize) || [])
const selectedCount=computed(() => preview.value?.items.filter(item => !item.duplicateManual && decisions.value[item.id]==='take-template' && !['unchanged','invalid','conflict'].includes(item.state)).length || 0)
const keepCount=computed(() => preview.value?.items.filter(item => !item.duplicateManual && decisions.value[item.id]==='keep' && (item.defaultSelected || touchedDecisions.value.includes(item.id)) && !['unchanged','invalid','conflict'].includes(item.state)).length || 0)
const actionCount=computed(() => selectedCount.value + keepCount.value)
watch(() => props.modelValue,open => {if(!open) return; opener=document.activeElement instanceof HTMLElement ? document.activeElement : null; const record=store.data.skus.find(item => item.id===props.target?.id); modelId.value=record?.creationSource?.templateId || store.data.families.find(item => item.id===record?.familyId)?.templateId || models.value[0]?.id || ''; versionId.value=versions.value.find(item => item.templateCompatibilitySnapshot)?.id || ''; targetIds.value=props.target && targets.value.some(item => item.id===props.target?.id) ? [props.target.id] : []; resetPreview()})
watch(modelId,() => {versionId.value=versions.value.find(item => item.templateCompatibilitySnapshot)?.id || '';targetIds.value=[];resetPreview()},{flush:'sync'})
watch([versionId,targetIds],resetPreview,{deep:true,flush:'sync'})
function resetPreview(){preview.value=undefined;decisions.value={};touchedDecisions.value=[];error.value='';page.value=1}
function makePreview(){error.value='';try{const result=store.previewTemplateCompatibilitySync({modelId:modelId.value,targetVersionId:versionId.value,targetIds:[...targetIds.value]});preview.value=result;decisions.value=Object.fromEntries(result.items.map(item => [item.id,item.defaultSelected?'take-template':'keep']));touchedDecisions.value=[];page.value=1}catch(cause){error.value=cause instanceof Error?cause.message:'无法生成更新预览。'}}
function setDecision(id:string,value:string|number|boolean|undefined){if(value==='keep'||value==='take-template'){decisions.value={...decisions.value,[id]:value};if(!touchedDecisions.value.includes(id))touchedDecisions.value=[...touchedDecisions.value,id]}}
function previousBaselineText(item:TemplateSyncItem){const baseline=store.data.templateCompatibilityOrigins?.find(origin=>origin.key===item.originKey)?.baseline;return baseline?claimText(baseline):'没有旧模板基线（首次新增或未认领的手工声明）。'}
function manualDeclarationText(id:string){const link=store.data.compatibilities.find(item=>item.id===id);return link?`${id} · ${claimText({...declarationDraft(link),id:link.id})}`:`人工声明 ${id} 已变化，请重新预览。`}
function versionName(id:string){return store.data.specModelVersions.find(item=>item.id===id)?.versionName || id}
function claimText(claim:TemplateCompatibilityClaim){return `${hostText(claim.host)} · ${scopeText(claim.host)} · ${capabilityLabels[claim.capability]} · ${verificationLabels[claim.verification]}${conclusionLabels[claim.conclusion]}${claim.conditions.length?` · ${claim.conditions.map(item=>conditionText(store.data,item)).join('；')}`:''} · 依据：${claim.source || '未填写'}${claim.note?` · 备注：${claim.note}`:''}`}
function apply(){if(!store.isAdmin||!preview.value||saving.value||!actionCount.value)return;saving.value=true;const result=store.applyTemplateCompatibilitySync(preview.value,{...decisions.value});saving.value=false;if(!result.ok){error.value=result.message || '更新失败，预览与选择已保留；数据可能已变化，请重新预览。';return}ElMessage.success(result.message || `已应用模板更新：新增 ${result.added || 0}，修改 ${result.updated || 0}，移除 ${result.removed || 0}。`);emit('updated');makePreview()}
async function returnFocus(){await nextTick();if(opener?.isConnected)opener.focus()}
</script>
<style scoped>
.muted {color:var(--el-text-color-secondary);font-size:13px;line-height:1.65;}.form-grid,.diff-grid {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;}.el-form .el-select {width:100%;}.sync-row {padding:14px;margin:12px 0;border:1px solid var(--el-border-color-lighter);border-radius:10px;overflow-wrap:anywhere;}.sync-row p {line-height:1.65;margin:8px 0;}.sync-head {display:flex;justify-content:space-between;gap:12px;}.diff-grid>div {padding:10px;background:var(--el-fill-color-extra-light);border-radius:6px;}.sync-row .el-radio-group {margin-top:10px;display:flex;flex-wrap:wrap;}.sync-row .el-radio {height:auto;min-height:30px;white-space:normal;}.el-pagination {flex-wrap:wrap;}
@media(max-width:700px){.form-grid,.diff-grid{grid-template-columns:1fr;gap:8px;}.sync-head{flex-wrap:wrap;}.sync-row{padding:10px;}}
</style>
