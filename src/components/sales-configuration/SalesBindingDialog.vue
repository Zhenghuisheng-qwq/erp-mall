<template>
  <el-dialog :model-value="modelValue" title="选配设置" width="min(900px,96vw)" top="5vh" :close-on-click-modal="false" :before-close="close" :show-close="!busy" data-sales-binding-dialog destroy-on-close>
    <el-form v-if="draft" label-position="top" :disabled="busy || !canEdit">
      <div class="form-grid"><el-form-item label="绑定名称"><el-input v-model="draft.name" aria-label="绑定名称" placeholder="例如：手机机型选配"/></el-form-item><el-form-item label="作用来源"><el-select :model-value="draft.scope.kind" aria-label="绑定来源类型" @change="changeSource"><el-option value="model" label="模型 / 规格范围"/><el-option value="products" label="明确的真实商品范围"/></el-select></el-form-item></div>
      <template v-if="draft.scope.kind==='model'">
        <div class="form-grid"><el-form-item label="商品模型"><el-select :model-value="draft.scope.modelId" filterable aria-label="绑定模型" @change="changeModel"><el-option v-for="model in models" :key="model.id" :value="model.id" :label="model.name"/></el-select></el-form-item><el-form-item label="来源版本"><el-select :model-value="draft.scope.versionId||'$draft'" aria-label="来源模型版本" @change="changeVersion"><el-option value="$draft" label="当前模型草稿 · 仅预览"/><el-option v-for="version in versions" :key="version.id" :value="version.id" :label="`${version.versionName || 'v'+version.version} · ${version.status==='published'?'已发布':'已下线'}`" :disabled="version.status!=='published'"/></el-select></el-form-item></div>
      </template>
      <div v-else class="form-grid"><el-form-item label="商品范围"><el-select v-model="draft.scope.familyIds" multiple filterable collapse-tags aria-label="绑定商品范围"><el-option v-for="family in store.data.families" :key="family.id" :value="family.id" :label="`${family.name} · ${family.oaProductId||family.id}`"/></el-select></el-form-item><el-form-item label="或指定 SKU"><el-select v-model="draft.scope.skuIds" multiple filterable collapse-tags aria-label="绑定 SKU 范围"><el-option v-for="sku in skus" :key="sku.id" :value="sku.id" :label="sku.label"/></el-select></el-form-item></div>
      <el-form-item label="匹配方式"><el-radio-group v-model="draft.mode" aria-label="方案匹配方式" @change="changeMode"><el-radio-button v-if="draft.scope.kind==='model'" value="default">模型默认方案</el-radio-button><el-radio-button value="replace">此范围替换方案</el-radio-button><el-radio-button value="none">此范围不使用方案</el-radio-button></el-radio-group></el-form-item>
      <SalesScopePicker v-if="draft.scope.kind==='model' && draft.mode!=='default'" :key="`${draft.scope.modelId}:${draft.scope.versionId||'draft'}:${draft.id}`" v-model="draft.scope.selector" :model-id="draft.scope.modelId" :version-id="draft.scope.versionId" :initial-node-id="draft.scope.nodeId"/>
      <div v-if="draft.mode!=='none'" class="form-grid"><el-form-item label="选配方案"><div class="inline-control"><el-select :model-value="draft.planId||''" filterable aria-label="选择选配方案" @change="changePlan"><el-option v-for="plan in (store.data.salesOptionPlans||[]).filter(item=>item.schemaVersion===1)" :key="plan.id" :value="plan.id" :label="`${plan.name}${plan.status==='disabled'?'（停用）':!plan.publishedVersion?'（待发布）':''}`"/></el-select><el-button v-if="draft.planId" link @click="planEditorId=draft.planId;planEditorOpen=true">编辑方案</el-button><el-button v-if="store.can('product:sales-config:create')" link @click="planEditorId='';planEditorOpen=true">新建</el-button></div></el-form-item><el-form-item label="方案版本"><el-select v-model="draft.planVersion" aria-label="选配方案版本" placeholder="选择已发布版本"><el-option v-for="version in selectedPlan?.versions||[]" :key="version.version" :value="version.version" :label="`v${version.version} · ${version.name}`"/></el-select></el-form-item></div>
      <el-form-item label="配置来源"><el-input v-model="draft.source" aria-label="绑定配置来源" placeholder="例如：门店销售选配规则"/></el-form-item>
    </el-form>
    <section v-if="preview" class="coverage" data-sales-binding-preview>
      <div class="counts"><span><strong data-sales-legal-count>{{preview.legalCount}}</strong> 合法规格</span><span><strong data-sales-sku-count>{{preview.skuCount}}</strong> 当前销售 SKU</span><el-tag v-if="preview.draftOnly" type="info">草稿预览</el-tag></div>
      <details v-if="preview.samples.length"><summary>查看覆盖样本（{{preview.samples.length}}）</summary><ul><li v-for="sample in preview.samples.slice(0,20)" :key="sample.identityKey">{{sample.label}}<span class="muted"> · 当前 SKU {{sample.skuIds.length}} 条</span></li></ul></details>
      <el-alert v-for="issue in preview.issues" :key="issue" :title="issue" type="warning" :closable="false"/>
      <details v-if="preview.unresolved.length" open><summary>未能准确解析 {{preview.unresolved.length}} 项</summary><ul><li v-for="item in preview.unresolved.slice(0,20)" :key="item.id">{{item.id}}：{{item.message}}</li></ul></details>
      <p v-if="preview.draftOnly" class="muted">应用到现有商品前，请选择其实际来源的已发布模型版本。草稿不会作为正式适用依据。</p>
    </section>
    <el-alert v-if="error" :title="error" type="error" :closable="false" role="alert"/>
    <template #footer><span v-if="dirty" class="muted">有未保存修改</span><el-button :disabled="busy" @click="close()">关闭</el-button><el-button v-if="canEdit" :loading="busy" data-sales-save-binding-draft @click="save(false)">{{draft?.enabled?'停用并保存':'保存配置草稿'}}</el-button><el-button v-if="canPublish" type="primary" :loading="busy" :disabled="!preview?.canApply" data-sales-apply-binding @click="save(true)">{{draft?.scope.kind==='products'?'应用到商品范围':'应用到已发布范围'}}</el-button></template>
    <SalesPlanEditor v-model="planEditorOpen" :plan-id="planEditorId" keep-open-after-save @saved="id=>{changePlan(id)}"/>
  </el-dialog>
</template>
<script setup lang="ts">
import {computed,onBeforeUnmount,ref,watch} from 'vue'
import {ElMessageBox} from 'element-plus'
import {onBeforeRouteLeave} from 'vue-router'
import {useCatalogStore,uid} from '../../stores/catalog'
import {isRealSku} from '../../domain/catalogIdentity'
import {savedSkuName,savedSkuCode} from '../../domain/productList'
import {previewSalesBinding} from '../../domain/salesConfiguration'
import type {SalesOptionBinding} from '../../domain/salesConfigurationTypes'
import SalesScopePicker from './SalesScopePicker.vue'
import SalesPlanEditor from './SalesPlanEditor.vue'
const props=defineProps<{modelValue:boolean;bindingId?:string;modelId?:string;nodeId?:string}>()
const emit=defineEmits<{'update:modelValue':[boolean];saved:[string]}>()
const store=useCatalogStore(),draft=ref<SalesOptionBinding>(),baseline=ref(''),busy=ref(false),error=ref(''),planEditorOpen=ref(false),planEditorId=ref('')
let requestId='',epoch=0,alive=true
const clone=<T,>(value:T):T=>JSON.parse(JSON.stringify(value))
const dirty=computed(()=>!!draft.value&&JSON.stringify(draft.value)!==baseline.value)
const canEdit=computed(()=>store.can('product:sales-config:update'))
const canPublish=computed(()=>canEdit.value&&store.can('product:sales-config:publish'))
const models=computed(()=>store.data.specCanvases.map(item=>({id:item.templateId,name:item.name||store.data.templates.find(x=>x.id===item.templateId)?.name||item.templateId})))
const versions=computed(()=>draft.value?.scope.kind==='model'?store.data.specModelVersions.filter(item=>item.templateId===(draft.value!.scope as Extract<SalesOptionBinding['scope'],{kind:'model'}>).modelId).sort((a,b)=>b.version-a.version):[])
const skus=computed(()=>store.data.skus.filter(item=>isRealSku(store.data,item)).map(item=>({id:item.id,label:`${savedSkuName(item)} · ${savedSkuCode(item)}`})))
const selectedPlan=computed(()=>store.data.salesOptionPlans?.find(item=>item.schemaVersion===1&&item.id===draft.value?.planId))
const preview=computed(()=>draft.value?previewSalesBinding(store.data,draft.value):undefined)
watch(()=>[props.modelValue,props.bindingId,props.modelId,props.nodeId],()=>{if(!props.modelValue)return;epoch++;requestId=uid('sales-binding-request');error.value='';const found=store.data.salesOptionBindings?.find(item=>item.id===props.bindingId);draft.value=found?clone(found):{schemaVersion:1,id:'',revision:0,name:props.nodeId?'节点选配':props.modelId?'模型默认选配':'',enabled:false,scope:{kind:'model',modelId:props.modelId||'',versionId:null,...(props.nodeId?{nodeId:props.nodeId}:{})},mode:props.nodeId?'replace':'default',planId:null,planVersion:null,source:'人工配置',updatedAt:''};baseline.value=JSON.stringify(draft.value)},{immediate:true})
function changeSource(kind:string){if(!draft.value)return;draft.value.scope=kind==='model'?{kind:'model',modelId:props.modelId||'',versionId:null}:{kind:'products',familyIds:[],skuIds:[]};draft.value.mode=kind==='model'?'default':'replace'}
function changeModel(id:string){if(draft.value?.scope.kind!=='model')return;draft.value.scope={kind:'model',modelId:id,versionId:null};draft.value.mode='default'}
function changeVersion(id:string){if(draft.value?.scope.kind!=='model')return;draft.value.scope={...draft.value.scope,versionId:id==='$draft'?null:id,selector:undefined}}
function changeMode(){if(!draft.value)return;if(draft.value.mode==='default'&&draft.value.scope.kind==='model'){delete draft.value.scope.selector;delete draft.value.scope.nodeId}if(draft.value.mode==='none'){draft.value.planId=null;draft.value.planVersion=null}}
function changePlan(id:string){if(!draft.value)return;draft.value.planId=id||null;draft.value.planVersion=store.data.salesOptionPlans?.find(item=>item.id===id)?.publishedVersion??null}
async function close(done?:()=>void){if(busy.value)return;if(dirty.value){try{await ElMessageBox.confirm('选配绑定尚未保存，放弃本次输入？','未保存修改',{confirmButtonText:'放弃修改',cancelButtonText:'继续编辑'})}catch{return}}emit('update:modelValue',false);done?.()}
async function save(enabled:boolean){
  if(!draft.value||busy.value||!canEdit.value||enabled&&!canPublish.value)return
  const candidate={...clone(draft.value),enabled},reviewed=previewSalesBinding(store.data,candidate)
  const input=JSON.stringify(draft.value),version=epoch,owner=store.activeUserId,identity=store.previewUserId
  const current=()=>alive&&version===epoch&&props.modelValue&&owner===store.activeUserId&&identity===store.previewUserId&&input===JSON.stringify(draft.value)
  if(enabled){if(!reviewed.canApply)return;try{await ElMessageBox.confirm(`将此销售绑定应用到 ${reviewed.legalCount} 条合法规格、当前 ${reviewed.skuCount} 条销售 SKU？商品规格、已发布模型和历史清单保持原样。`,'确认应用范围',{confirmButtonText:'启用此绑定',cancelButtonText:'继续核对'})}catch{return}}
  if(!current()){error.value='输入或操作者已变化，请重新核对范围。';return}
  busy.value=true;error.value=''
  try{const result=await store.saveSalesOptionBinding({draft:candidate,expectedRevision:candidate.revision,expectedBasis:reviewed.stamp,requestId},current);if(!result.ok){error.value=result.message||'保存失败，输入已保留。';return}baseline.value=JSON.stringify(draft.value);emit('saved',result.id!);emit('update:modelValue',false)}catch(cause){error.value=cause instanceof Error?cause.message:'保存失败，输入已保留。'}finally{busy.value=false}
}
onBeforeRouteLeave(async()=>{if(!props.modelValue)return true;await close();return !props.modelValue})
onBeforeUnmount(()=>{alive=false;epoch++})
</script>
<style scoped>.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px}.el-select{width:100%}.inline-control{display:flex;width:100%;align-items:center;gap:8px}.inline-control .el-select{min-width:0;flex:1}.coverage{padding:14px;border:1px solid var(--el-border-color);border-radius:8px;margin:12px 0}.counts{display:flex;align-items:center;gap:22px;flex-wrap:wrap}.counts strong{font-size:22px}.coverage details{margin-top:12px}.coverage summary{cursor:pointer}.coverage li{margin:7px 0;overflow-wrap:anywhere}.coverage .el-alert{margin-top:10px}.muted{font-size:12px;color:var(--el-text-color-secondary)}@media(max-width:650px){.form-grid{grid-template-columns:1fr}.inline-control{flex-wrap:wrap}}</style>
