<template>
  <el-dialog :model-value="open" title="物料建档与关联" width="720px" class="material-relation-dialog" append-to-body :close-on-click-modal="false" :show-close="!busy" :close-on-press-escape="!busy" @close="emit('close')">
    <div :inert="busy" data-material-relation-form>
      <p>按指定发布版本执行。节点范围只确定前缀规格，不裁剪完整规划或销售 SKU。</p>
      <el-alert v-if="draftDiffers" title="当前草稿与所选快照不同。本次明确采用所选已发布版本；需要新结构时请先发布后重新预览。" type="warning" :closable="false" />
      <el-form label-position="top">
        <el-form-item label="发布版本"><el-select v-model="form.versionId" aria-label="关联发布版本" @change="clear"><el-option v-for="v in versions" :key="v.id" :value="v.id" :label="v.versionName" /></el-select></el-form-item>
        <el-form-item v-if="form.kind === 'node'" label="节点范围"><el-radio-group v-model="form.scope" @change="clear"><el-radio value="current">仅当前节点（current）</el-radio><el-radio value="subtree">当前节点及真实下级（subtree）</el-radio></el-radio-group></el-form-item>
        <el-form-item label="本次操作"><el-radio-group v-model="mode" @change="clear"><el-radio v-if="form.kind === 'node'" value="create">按范围创建物料</el-radio><el-radio value="link">关联已有物料</el-radio></el-radio-group></el-form-item>
        <el-form-item v-if="mode === 'link'" label="明确选择真实 MAT"><el-select v-model="target" filterable placeholder="按 MAT 编号或名称搜索，不自动选择" aria-label="关联目标物料" @change="clear"><el-option v-for="s in candidates" :key="s.id" :value="s.id" :label="`${s.materialCode || s.id} · ${s.skuName || '未命名'} · 原来源 ${s.planningId || '节点范围'}`" /></el-select></el-form-item>
        <p v-if="target && mode === 'link'">原始建档与现有关联：{{ targetSources }}</p>
        <el-form-item v-if="mode === 'create'" label="物料名称"><el-input v-model="name" aria-label="范围物料名称" placeholder="预览后采用建议名称；缺少字段时可人工填写" /></el-form-item>
      </el-form>
      <el-button :disabled="mode === 'link' && !target" @click="preview">预览规格范围</el-button>
      <section v-if="result" data-material-scope-preview>
        <p>策略：{{ result.policyValue === 'shared' ? '共用物料' : result.policyValue === 'independent' ? '独立物料' : '待配置' }} · {{ result.policySources.join('；') }}</p>
        <p>实际确定规格：{{ result.prefix.map(s=>`${s.attributeName} ${s.valueId}`).join(' · ') }}</p>
        <p>覆盖 {{ result.coverage.length }} 条完整规划。{{ form.scope === 'current' && form.kind === 'node' ? 'current 不扩散到下级；下列完整路径仅用于核对规格来源。' : '按当前发布版本冻结范围。' }}</p>
        <details><summary>逐条规格范围（{{ result.proof.length }} 条）</summary><div v-for="c in result.proof" :key="c.planningId">{{ c.planningId }} · {{ c.label }}</div></details>


        <p v-if="result.suggestion.message">命名：{{ result.suggestion.message }}</p>
        <p v-if="result.previous.length">新版本范围：新增 {{ result.added.join('、') || '无' }}；移出 {{ result.removed.join('、') || '无' }}。旧版本关联保持原样。</p>
        <RuleExplanation v-for="(failure,index) in result.failures" :key="index" :failure="failure" :supported-recovery="[]" /><el-alert v-for="problem in result.problems" :key="problem" :title="problem" type="error" :closable="false" />
        <el-checkbox v-if="!result.problems.length" v-model="confirmed">确认上述发布版本、范围和目标；不自动扩张旧版本关联</el-checkbox>
      </section>
      <RuleExplanation v-if="guideFailure" :failure="guideFailure" :supported-recovery="['repreview']" @recover="preview" /><el-alert v-else-if="error" :title="error" type="error" :closable="false" />
    </div>
    <template #footer><el-button :disabled="busy" @click="emit('close')">关闭</el-button><el-button type="primary" :loading="busy" :disabled="!store.can(mode === 'create' ? 'product:material:create' : 'product:material:update') || !result || !!result.problems.length || !confirmed" @click="save">确认执行</el-button></template>
  </el-dialog>
</template>
<script setup lang="ts">
import RuleExplanation from './guide/RuleExplanation.vue'
import {getFailure} from '../domain/guide/failure'
import type {GuideFailure} from '../domain/guide/types'
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { uid, useCatalogStore } from '../stores/catalog'
import { isMaterialArchive } from '../domain/catalogIdentity'
import { materialSources, type MaterialScope } from '../domain/materialRelations'
import { previewMaterialScope, type MaterialScopePreview } from '../domain/materialRelationCommands'
import { sameSpecSnapshot } from '../domain/logic'
const props=defineProps<{open:boolean;source:MaterialScope}>(),emit=defineEmits<{close:[];saved:[id:string]}>()
const store=useCatalogStore(),form=ref<MaterialScope>({...props.source}),mode=ref('link'),target=ref(''),name=ref(''),error=ref(''),busy=ref(false),confirmed=ref(false),request=ref(''),result=ref<MaterialScopePreview>()
const guideFailure=ref<GuideFailure>()
const versions=computed(()=>store.data.specModelVersions.filter(v=>v.templateId===form.value.modelId&&v.status==='published'))
const draftDiffers=computed(()=>{const v=versions.value.find(v=>v.id===form.value.versionId);return v&&!sameSpecSnapshot(store.data.productSpecNodes.filter(n=>n.templateId===v.templateId),v.nodesSnapshot)})
const candidates=computed(()=>{const type=store.data.specCanvases.find(c=>c.templateId===form.value.modelId)?.productTypeId;return store.data.skus.filter(s=>isMaterialArchive(store.data,s)&&store.data.families.some(f=>f.id===s.familyId&&f.productTypeId===type))})
const targetSources=computed(()=>materialSources(store.data,target.value).map(s=>`${s.label} ${s.source.modelId} / ${s.source.versionId} / ${s.source.planningId || s.source.anchorNodeId}`).join('；'))
function clear(){guideFailure.value=undefined;result.value=undefined;confirmed.value=false;error.value='';request.value=uid('relation-request')}
watch(()=>props.open,open=>{if(open){form.value={...props.source};mode.value=props.source.kind==='node'?'create':'link';target.value='';name.value='';clear()}},{immediate:true})
function preview(){result.value=previewMaterialScope(store.data,form.value,mode.value==='link'?target.value:'');confirmed.value=false;error.value='';if(mode.value==='create'&&!name.value&&result.value.suggestion.canAuto)name.value=result.value.suggestion.name}
async function save(){if(!result.value||busy.value)return;busy.value=true;try{const r=await store.saveMaterialRelation({source:{...form.value},materialId:mode.value==='link'?target.value:undefined,name:name.value,requestId:request.value,basis:result.value.basis,confirmVersionChange:confirmed.value});if(r.ok){ElMessage.success(r.message);emit('saved',r.materialId);emit('close')}else {guideFailure.value=getFailure(r);error.value=r.message||'保存失败，输入保留。'}}finally{busy.value=false}}
</script>
<style>.material-relation-dialog{max-width:calc(100vw - 24px)}.material-relation-dialog .el-dialog__body{max-height:65vh;overflow:auto}.material-relation-dialog .el-select{width:100%}.material-relation-dialog section{margin-top:14px}.material-relation-dialog p{overflow-wrap:anywhere}</style>
