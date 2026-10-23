<template>
  <el-dialog :model-value="modelValue" title="检查模板兼容更新" width="min(1080px, 96vw)" top="4vh" class="template-sync-dialog" append-to-body :close-on-click-modal="false" :close-on-press-escape="!saving" :show-close="!saving" data-template-sync-dialog @update:model-value="!saving && emit('update:modelValue',$event)" @closed="returnFocus">
    <p class="muted">只检查明确选择的真实 SKU / MAT，不改变商品建档版本。模板来源声明可以更新；手工声明、人工修改和已取消声明默认保留。恢复已取消声明也必须先预览并逐条确认。</p>
    <el-alert v-if="!store.isAdmin" title="当前为只读角色，可以预览更新，不能应用。" type="info" :closable="false" />
    <el-form label-position="top" :disabled="saving">
      <div class="form-grid"><el-form-item label="商品模型"><el-select v-model="modelId" filterable placeholder="选择模型" data-template-sync-model><el-option v-for="item in models" :key="item.id" :label="item.name" :value="item.id" /></el-select></el-form-item><el-form-item label="目标已发布版本"><el-select v-model="versionId" placeholder="选择具有兼容快照的已发布版本" data-template-sync-version><el-option v-for="item in versions" :key="item.id" :label="`${item.versionName} · ${item.publishTime}`" :value="item.id" :disabled="!item.templateCompatibilitySnapshot" /></el-select></el-form-item></div>
      <el-form-item label="更新对象"><el-select v-model="targetIds" multiple filterable placeholder="明确选择 SKU 或 MAT，可多选" data-template-sync-targets><el-option v-for="item in targets" :key="item.id" :label="targetText(store.data,item.target)" :value="item.id" /></el-select></el-form-item>
    </el-form>
    <el-button :disabled="!modelId || !versionId || !targetIds.length || saving" data-template-sync-preview @click="makePreview(true)">{{ preview ? '重新预览，保留有效选择' : '预览所选对象的更新' }}</el-button>
    <el-alert v-if="receipt" :title="receipt" type="success" :closable="false" show-icon data-template-sync-receipt />
    <template v-if="preview">
      <p class="muted" data-template-sync-summary>本次预览 {{ preview.items.length }} 项：{{ summary }}。检查期间不写入正式关系。</p>
      <div class="sync-tools"><el-select v-model="filter" aria-label="筛选同步变更" data-template-sync-filter><el-option label="需要处理的变更" value="changes" /><el-option v-for="(label,key) in stateLabels" :key="key" :label="`${label}（${preview.items.filter(item=>item.state===key).length}）`" :value="key" /></el-select><el-button :disabled="saving || !store.isAdmin" @click="selectSafe">采用全部安全变更</el-button><span class="muted">人工保护与合并／拆分组始终保留独立选择</span></div>
      <el-empty v-if="!preview.items.length" description="所选对象没有需要处理的模板声明。" :image-size="60" />
      <el-empty v-else-if="!filteredRows.length" description="此分类没有变更。未变化项目可通过筛选查看。" :image-size="50" />
      <section v-for="targetGroup in targetGroups" :key="targetGroup.id" class="target-group"><h3>{{ targetGroup.name }}</h3>
      <article v-for="item in targetGroup.items" :key="item.id" class="sync-row" :data-template-sync-item="item.id" :data-template-sync-state="item.state">
        <div class="sync-head"><strong>{{ item.group ? groupLabels[item.group.kind] : item.after ? hostText(item.after.host) : item.before ? hostText(item.before.host) : '适用结果' }}</strong><el-tag :type="item.state === 'protected' || item.state === 'conflict' || item.state === 'invalid' ? 'warning' : 'info'">{{ item.group ? '关联变更组 · 默认保留' : stateLabels[item.state] }}</el-tag></div>
        <p>{{ item.message }}</p>
        <template v-if="item.group">
          <p class="muted">{{ item.group.before.length }} 条旧来源 → {{ item.group.after.length }} 条新结果。整组应用，不能拆分选择。</p>
          <div class="diff-grid"><div><strong>当前声明（{{ item.group.before.filter(entry=>entry.declaration).length }}）</strong><p v-for="entry in item.group.before" :key="entry.origin.key">{{ entry.declaration ? claimText(entry.declaration) : '已人工取消 · 继续保护' }}</p></div><div><strong>模板结果（{{ item.group.after.length }}）</strong><p v-for="entry in item.group.after" :key="entry.origin.key">{{ claimText(entry.origin.baseline) }}</p></div></div>
          <p v-if="!item.group.canAdopt" class="protected-note">整组不可覆盖：{{ item.group.blockedReasons.join('；') }}。请先维护对应商品声明，再重新预览。</p>
          <el-button v-if="!item.group.canAdopt" link type="primary" :disabled="saving" @click="manageTarget(item)">维护此商品声明</el-button>
          <p v-else class="muted">显式采用后移除 {{ item.group.operations.filter(op=>op.kind==='remove').length }} 条旧声明、新增 {{ item.group.operations.filter(op=>op.kind==='add').length }} 条结果；旧来源保留追溯。</p>
        </template>
        <div v-else class="field-diffs"><div class="field-diff diff-heading"><span>字段</span><strong>当前商品声明</strong><strong>目标模板结果</strong></div><div v-for="field in diffFields(item)" :key="field.label" class="field-diff" :class="{changed:field.changed}"><span>{{ field.label }}{{ field.changed ? ' · 变化' : '' }}</span><span>{{ field.before }}</span><span>{{ field.after }}</span></div></div>
        <section v-if="item.blockingIds?.length" data-template-sync-manual-denial><el-alert :title="item.group ? '相反人工结论使整组受保护，不能直接采用模板。请先维护对应声明，再重新预览。' : '采用目标模板将取消以下人工不兼容声明。默认保留当前结果，请核对后再明确选择采用。'" type="warning" :closable="false" show-icon /><p v-for="id in item.blockingIds" :key="id">{{ manualDeclarationText(id) }}</p></section>
        <details class="baseline"><summary>查看完整依据、上次基线与历史来源</summary><p class="muted">{{ item.sourceVersionId ? `原来源版本 ${versionName(item.sourceVersionId)}` : '没有旧模板来源' }} → {{ versionName(preview.targetVersionId) }}</p><p>{{ previousBaselineText(item) }}</p><p v-if="item.group" v-for="entry in item.group.before" :key="entry.origin.key" class="muted">{{ versionName(entry.origin.sourceVersionId) }} · {{ claimText(entry.origin.baseline) }}</p><p class="muted">追溯规则：{{ item.ruleIds.join('、') || '无' }}</p></details>
        <el-radio-group v-if="canChoose(item)" :model-value="decisions[item.id] || 'keep'" :disabled="!store.isAdmin || saving" @update:model-value="setDecision(item.id,$event)"><el-radio value="keep">保留当前结果</el-radio><el-radio value="take-template">{{ item.group ? '采用这组模板结果' : item.state === 'protected' && !item.before && item.after ? '明确恢复为目标模板结果' : '采用目标模板结果' }}</el-radio></el-radio-group>
        <p v-else class="muted">{{ item.duplicateManual ? '保留已有独立声明，不重新创建或认领模板来源。' : item.state === 'unchanged' ? '结果一致，无需写入。' : '此项不可应用，请先处理来源或规则问题。' }}</p>
      </article>
      </section>
      <el-pagination v-if="filteredRows.length > pageSize" v-model:current-page="page" :page-size="pageSize" :total="filteredRows.length" layout="prev, pager, next, total" size="small" />
    </template>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon data-template-sync-error />
    <template #footer><span v-if="preview" class="muted">采用 {{ selectedCount }} 项／组 · 保留 {{ keepCount }} 项决定</span><el-button :disabled="saving" @click="emit('update:modelValue',false)">关闭</el-button><el-button type="primary" :disabled="!store.isAdmin || !preview || !actionCount" :loading="saving" data-template-sync-apply @click="apply">确认更新与保留</el-button></template>
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
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
const router=useRouter(),route=useRoute()
const filter=ref('changes'),receipt=ref('')
const groupLabels={'many-to-one':'合并模板来源','one-to-many':'拆分模板来源','many-to-many':'重组模板来源'}
let opener:HTMLElement|null=null
const models=computed(() => store.data.specCanvases.filter(item => store.data.specModelVersions.some(version => version.templateId === item.templateId && !!version.templateCompatibilitySnapshot)).map(item => ({id:item.templateId,name:item.name || store.data.templates.find(template => template.id === item.templateId)?.name || item.templateId})))
const versions=computed(() => store.data.specModelVersions.filter(item => item.templateId===modelId.value && item.status==='published').slice().sort((a,b) => b.version-a.version))
const targets=computed(() => store.data.skus.filter(item => (isRealSku(store.data,item) || isMaterialArchive(store.data,item)) && compatibilityFamilyRole(store.data,item.familyId)==='accessory' && (item.creationSource?.templateId || store.data.families.find(family => family.id===item.familyId)?.templateId)===modelId.value).map(item => ({id:item.id,target:{kind:isMaterialArchive(store.data,item)?'material':'sku',id:item.id} as AccessoryTarget})))
const stateLabels={add:'新增',update:'更新',remove:'移除',protected:'人工保护',conflict:'来源冲突',invalid:'引用失效',unchanged:'保持不变'}
const summary=computed(() => Object.entries(stateLabels).map(([key,label]) => `${label} ${preview.value?.items.filter(item => item.state===key).length || 0}`).join(' · '))
const filteredRows=computed(()=>preview.value?.items.filter(item=>filter.value==='changes'?item.state!=='unchanged':item.state===filter.value)||[])
const pageRows=computed(() => filteredRows.value.slice((page.value-1)*pageSize,page.value*pageSize))
const targetGroups=computed(()=>{const groups=new Map<string,{id:string;name:string;items:TemplateSyncItem[]}>();for(const item of pageRows.value){const id=JSON.stringify(item.target),group=groups.get(id)||{id,name:item.targetName,items:[]};group.items.push(item);groups.set(id,group)}return [...groups.values()]})
const selectedCount=computed(() => preview.value?.items.filter(item => canChoose(item) && decisions.value[item.id]==='take-template').length || 0)
const keepCount=computed(() => preview.value?.items.filter(item => canChoose(item) && decisions.value[item.id]==='keep' && (item.defaultSelected || touchedDecisions.value.includes(item.id))).length || 0)
const actionCount=computed(() => selectedCount.value + keepCount.value)
watch(() => props.modelValue,open => {if(!open) return; opener=document.activeElement instanceof HTMLElement ? document.activeElement : null; const record=store.data.skus.find(item => item.id===props.target?.id); modelId.value=record?.creationSource?.templateId || store.data.families.find(item => item.id===record?.familyId)?.templateId || models.value[0]?.id || ''; versionId.value=versions.value.find(item => item.templateCompatibilitySnapshot)?.id || ''; targetIds.value=props.target && targets.value.some(item => item.id===props.target?.id) ? [props.target.id] : []; resetPreview()})
watch(modelId,() => {versionId.value=versions.value.find(item => item.templateCompatibilitySnapshot)?.id || '';targetIds.value=[];resetPreview()},{flush:'sync'})
watch([versionId,targetIds],resetPreview,{deep:true,flush:'sync'})
watch(filter,()=>{page.value=1})
function resetPreview(){preview.value=undefined;decisions.value={};touchedDecisions.value=[];error.value='';receipt.value='';page.value=1;filter.value='changes'}
function canChoose(item:TemplateSyncItem){return !item.duplicateManual && item.state!=='unchanged'&&item.state!=='invalid'&&(item.state!=='conflict'||!!item.group?.canAdopt)}
function selectSafe(){for(const item of preview.value?.items||[])if(canChoose(item)&&!item.group&&item.state!=='protected')setDecision(item.id,'take-template')}
function makePreview(preserve=false){error.value='';try{const old=decisions.value,touched=new Set(touchedDecisions.value),result=store.previewTemplateCompatibilitySync({modelId:modelId.value,targetVersionId:versionId.value,targetIds:[...targetIds.value]});preview.value=result;decisions.value=Object.fromEntries(result.items.map(item => [item.id,preserve&&touched.has(item.id)&&canChoose(item)?old[item.id]||'keep':item.defaultSelected?'take-template':'keep']));touchedDecisions.value=preserve?result.items.filter(item=>touched.has(item.id)&&canChoose(item)).map(item=>item.id):[];page.value=1}catch(cause){error.value=cause instanceof Error?cause.message:'无法生成更新预览。'}}
function diffFields(item:TemplateSyncItem){const fields=[['型号',(claim:TemplateCompatibilityClaim)=>hostText(claim.host)],['范围',(claim:TemplateCompatibilityClaim)=>scopeText(claim.host)],['能力',(claim:TemplateCompatibilityClaim)=>capabilityLabels[claim.capability]],['结论',(claim:TemplateCompatibilityClaim)=>conclusionLabels[claim.conclusion]],['核验',(claim:TemplateCompatibilityClaim)=>verificationLabels[claim.verification]],['条件',(claim:TemplateCompatibilityClaim)=>claim.conditions.map(condition=>conditionText(store.data,condition)).join('；')||'无'],['依据',(claim:TemplateCompatibilityClaim)=>claim.source],['备注',(claim:TemplateCompatibilityClaim)=>claim.note||'无']] as const;return fields.map(([label,read])=>{const before=item.before?read(item.before):'无声明',after=item.after?read(item.after):'移除声明';return {label,before,after,changed:before!==after}})}
function setDecision(id:string,value:string|number|boolean|undefined){if(value==='keep'||value==='take-template'){decisions.value={...decisions.value,[id]:value};if(!touchedDecisions.value.includes(id))touchedDecisions.value=[...touchedDecisions.value,id]}}
async function manageTarget(item:TemplateSyncItem){if(saving.value)return;emit('update:modelValue',false);await router.push({path:'/compatibility',query:{manage:item.target.id,...(typeof route.query.returnTo==='string'?{returnTo:route.query.returnTo}:route.path==='/skus'?{returnTo:route.fullPath}:{})}})}
function previousBaselineText(item:TemplateSyncItem){if(item.group)return '下列历史基线按旧来源分别保留，采用新结果后仍可追溯。';const baseline=store.data.templateCompatibilityOrigins?.find(origin=>origin.key===item.originKey)?.baseline;return baseline?claimText(baseline):'没有旧模板基线（首次新增或未认领的手工声明）。'}
function manualDeclarationText(id:string){const link=store.data.compatibilities.find(item=>item.id===id);return link?`${id} · ${claimText({...declarationDraft(link),id:link.id})}`:`人工声明 ${id} 已变化，请重新预览。`}
function versionName(id:string){return store.data.specModelVersions.find(item=>item.id===id)?.versionName || id}
function claimText(claim:TemplateCompatibilityClaim){return `${hostText(claim.host)} · ${scopeText(claim.host)} · ${capabilityLabels[claim.capability]} · ${verificationLabels[claim.verification]}${conclusionLabels[claim.conclusion]}${claim.conditions.length?` · ${claim.conditions.map(item=>conditionText(store.data,item)).join('；')}`:''} · 依据：${claim.source || '未填写'}${claim.note?` · 备注：${claim.note}`:''}`}
async function apply(){if(!store.isAdmin||!preview.value||saving.value||!actionCount.value)return;saving.value=true;try{const result=await store.applyTemplateCompatibilitySync(preview.value,{...decisions.value});if(!result.ok){error.value=result.message || '更新失败，预览与选择已保留；数据可能已变化，请重新预览。';return}receipt.value=`已完成：新增 ${result.added || 0} 条、更新 ${result.updated || 0} 条、移除 ${result.removed || 0} 条、保留 ${result.protected || 0} 项。`;ElMessage.success(receipt.value);emit('updated');makePreview()}catch(cause){error.value=cause instanceof Error?cause.message:'更新失败，选择已保留。'}finally{saving.value=false}}
async function returnFocus(){await nextTick();if(opener?.isConnected)opener.focus()}
</script>
<style scoped>
.muted {color:var(--el-text-color-secondary);font-size:13px;line-height:1.65;}.form-grid,.diff-grid {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;}.el-form .el-select {width:100%;}.sync-row {padding:14px;margin:12px 0;border:1px solid var(--el-border-color-lighter);border-radius:10px;overflow-wrap:anywhere;}.sync-row p {line-height:1.65;margin:8px 0;}.sync-head {display:flex;justify-content:space-between;gap:12px;}.diff-grid>div {padding:10px;background:var(--el-fill-color-extra-light);border-radius:6px;}.sync-row .el-radio-group {margin-top:10px;display:flex;flex-wrap:wrap;}.sync-row .el-radio {height:auto;min-height:30px;white-space:normal;}.el-pagination {flex-wrap:wrap;}
@media(max-width:700px){.form-grid,.diff-grid{grid-template-columns:1fr;gap:8px;}.sync-head{flex-wrap:wrap;}.sync-row{padding:10px;}}
.sync-tools{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:16px 0}.sync-tools>.el-select{width:220px}.target-group>h3{font-size:15px;padding:12px 0 0;color:var(--el-text-color-primary);overflow-wrap:anywhere}.sync-row{border-radius:12px;background:var(--el-bg-color);margin-top:8px}.baseline{margin:14px 0}.baseline summary{cursor:pointer;color:var(--el-text-color-secondary);font-size:13px}.field-diffs{border:1px solid var(--el-border-color-extra-light);border-radius:8px;overflow:hidden}.field-diff{display:grid;grid-template-columns:90px minmax(0,1fr) minmax(0,1fr);gap:12px;padding:9px 12px;font-size:13px;line-height:1.6}.field-diff+.field-diff{border-top:1px solid var(--el-border-color-extra-light)}.field-diff>span:first-child{color:var(--el-text-color-secondary)}.field-diff.changed{background:var(--el-color-primary-light-9)}.field-diff.changed>span:last-child{font-weight:500}.diff-heading{background:var(--el-fill-color-light)}.protected-note{color:var(--el-color-warning-dark-2);padding:10px 12px;border-left:3px solid var(--el-color-warning);background:var(--el-color-warning-light-9)}
:global(.template-sync-dialog){display:flex;flex-direction:column;max-height:92dvh;padding:0;border-radius:14px;overflow:hidden}:global(.template-sync-dialog .el-dialog__header){padding:20px 24px 16px;margin:0;border-bottom:1px solid var(--el-border-color-extra-light);flex-shrink:0}:global(.template-sync-dialog .el-dialog__body){padding:18px 24px;overflow:auto;min-height:0;overscroll-behavior:contain}:global(.template-sync-dialog .el-dialog__footer){padding:14px 24px;border-top:1px solid var(--el-border-color-extra-light);flex-shrink:0;background:var(--el-bg-color)}
@media(max-width:600px){.field-diff{grid-template-columns:55px minmax(0,1fr) minmax(0,1fr);gap:8px;padding:8px;font-size:12px}.sync-tools>.el-select{width:100%}:global(.template-sync-dialog .el-dialog__header),:global(.template-sync-dialog .el-dialog__body),:global(.template-sync-dialog .el-dialog__footer){padding:14px}:global(.template-sync-dialog .el-dialog__footer){display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}:global(.template-sync-dialog .el-dialog__footer .muted){width:100%}:global(.template-sync-dialog .el-dialog__footer .el-button){margin:0}}
</style>
