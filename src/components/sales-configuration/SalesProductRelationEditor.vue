<template>
  <el-dialog :model-value="modelValue" title="商品关联" width="min(760px,96vw)" :close-on-click-modal="false" :before-close="close" :show-close="!busy" data-sales-relation-editor>
    <el-form v-if="draft" label-position="top" :disabled="busy || !canEdit">
      <div class="form-grid"><el-form-item label="推荐来源商品"><el-select v-model="draft.sourceSkuId" filterable aria-label="关联来源 SKU"><el-option v-for="sku in skus" :key="sku.id" :label="sku.label" :value="sku.id"/></el-select></el-form-item><el-form-item label="相关商品"><el-select v-model="draft.targetSkuId" filterable aria-label="关联目标 SKU"><el-option v-for="sku in skus" :key="sku.id" :label="sku.label" :value="sku.id"/></el-select></el-form-item></div>
      <el-form-item label="关系用途"><el-radio-group v-model="draft.kind" aria-label="商品关系用途"><el-radio-button value="recommendation">搭配推荐</el-radio-button><el-radio-button value="applicability">直接适用声明</el-radio-button></el-radio-group></el-form-item>
      <el-form-item v-if="draft.kind==='recommendation'" label="候选实际用途"><el-select v-model="draft.checkTarget" aria-label="推荐用途"><el-option value="device" label="本次使用设备"/><el-option value="source" label="当前来源商品（需要直接适用依据）"/><el-option value="none" label="独立商品（不适用于配件免检）"/></el-select></el-form-item><p v-if="draft.kind==='recommendation'" class="muted">只提供继续查看的入口。推荐不会替代设备或来源商品的适用核对。</p>
      <div v-else class="form-grid"><el-form-item label="适用结论"><el-select v-model="draft.conclusion" aria-label="直接适用结论"><el-option value="compatible" label="适用"/><el-option value="conditional" label="有条件适用"/><el-option value="incompatible" label="明确不适用"/></el-select></el-form-item><el-form-item label="核验状态"><el-select v-model="draft.verification" aria-label="直接适用核验"><el-option value="pending" label="待核验"/><el-option value="confirmed" label="已核验"/></el-select></el-form-item></div>
      <el-form-item label="依据来源"><el-input v-model="draft.source" aria-label="关联依据来源" placeholder="填写可核验的说明或资料来源"/></el-form-item>
      <details v-if="draft.kind==='applicability'" :open="draft.conclusion==='conditional'"><summary>适用条件（{{draft.conditions.length}}）</summary>
        <article v-for="(condition,index) in draft.conditions" :key="index" class="condition"><el-select :model-value="condition.kind" aria-label="条件类型" @change="(kind:CompatibilityCondition['kind'])=>changeCondition(index,kind)"><el-option value="attribute" label="来源商品属性"/><el-option value="manual" label="需要人工核对"/><el-option value="equipment" label="需要配套设备"/></el-select>
          <template v-if="condition.kind==='attribute'"><el-select v-model="condition.attributeId" filterable aria-label="条件属性"><el-option v-for="attribute in store.data.params" :key="attribute.id" :value="attribute.id" :label="`${attribute.name} · ${attribute.id}`"/></el-select><el-select v-model="condition.operator" aria-label="条件操作符"><el-option value="eq" label="等于"/><el-option value="gte" label="至少"/></el-select><el-input v-model="condition.value" aria-label="条件属性值"/></template>
          <el-input v-else v-model="condition.text" aria-label="使用条件" placeholder="说明需要核对的条件"/>
          <el-button link type="danger" @click="draft.conditions.splice(index,1)">移除</el-button>
        </article><el-button link type="primary" @click="draft.conditions.push({kind:'manual',text:''})">＋使用条件</el-button>
      </details>
      <el-form-item label="简短说明"><el-input v-model="draft.note" type="textarea" aria-label="关联说明"/></el-form-item>
      <el-checkbox v-model="draft.enabled">启用此关系</el-checkbox>
    </el-form>
    <el-alert v-if="error" :title="error" type="error" :closable="false" role="alert"/>
    <template #footer><el-button :disabled="busy" @click="close()">关闭</el-button><el-button v-if="canEdit" type="primary" :loading="busy" data-sales-save-relation @click="save">保存关联</el-button></template>
  </el-dialog>
</template>
<script setup lang="ts">
import {computed,onBeforeUnmount,ref,watch} from 'vue'
import {ElMessageBox} from 'element-plus'
import {onBeforeRouteLeave} from 'vue-router'
import {useCatalogStore,uid} from '../../stores/catalog'
import {isRealSku} from '../../domain/catalogIdentity'
import {savedSkuCode,savedSkuName} from '../../domain/productList'
import type {SalesProductRelation} from '../../domain/salesConfigurationTypes'
import type {CompatibilityCondition} from '../../domain/accessoryCompatibilityTypes'
const props=defineProps<{modelValue:boolean;relationId?:string}>(),emit=defineEmits<{'update:modelValue':[boolean];saved:[]}>()
const store=useCatalogStore(),draft=ref<SalesProductRelation>(),baseline=ref(''),busy=ref(false),error=ref('')
let alive=true,epoch=0,requestId=''
const clone=<T,>(value:T):T=>JSON.parse(JSON.stringify(value))
const canEdit=computed(()=>store.can(draft.value?.id?'product:compatibility:update':'product:compatibility:create'))
const skus=computed(()=>store.data.skus.filter(item=>isRealSku(store.data,item)).map(item=>({id:item.id,label:`${savedSkuName(item)} · ${savedSkuCode(item)}`})))
watch(()=>[props.modelValue,props.relationId],()=>{if(!props.modelValue)return;epoch++;requestId=uid('sales-relation-request');error.value='';const found=store.data.salesProductRelations?.find(item=>item.id===props.relationId);draft.value=found?clone(found):{schemaVersion:1,id:'',revision:0,enabled:true,sourceSkuId:'',targetSkuId:'',kind:'recommendation',checkTarget:'device',conclusion:'compatible',verification:'pending',conditions:[],source:'',note:'',updatedAt:''};baseline.value=JSON.stringify(draft.value)},{immediate:true})
function changeCondition(index:number,kind:CompatibilityCondition['kind']){if(!draft.value)return;draft.value.conditions[index]=kind==='attribute'?{kind,attributeId:'',operator:'eq',value:''}:{kind,text:''}}
async function close(done?:()=>void){if(busy.value)return;if(JSON.stringify(draft.value)!==baseline.value){try{await ElMessageBox.confirm('商品关联尚未保存，放弃本次输入？','未保存修改',{confirmButtonText:'放弃修改',cancelButtonText:'继续编辑'})}catch{return}}emit('update:modelValue',false);done?.()}
async function save(){if(!draft.value||busy.value||!canEdit.value)return;const version=epoch,owner=store.activeUserId,preview=store.previewUserId,input=JSON.stringify(draft.value);busy.value=true;error.value='';try{const result=await store.saveSalesProductRelation({draft:clone(draft.value),expectedRevision:draft.value.revision,requestId},()=>alive&&version===epoch&&props.modelValue&&owner===store.activeUserId&&preview===store.previewUserId&&input===JSON.stringify(draft.value));if(!result.ok){error.value=result.message||'保存失败，输入保留。';return}baseline.value=JSON.stringify(draft.value);emit('saved');emit('update:modelValue',false)}catch(cause){error.value=cause instanceof Error?cause.message:'保存失败，输入保留。'}finally{busy.value=false}}
onBeforeRouteLeave(async()=>{if(!props.modelValue)return true;await close();return !props.modelValue});onBeforeUnmount(()=>{alive=false;epoch++})
</script>
<style scoped>.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px}.el-select{width:100%}.condition{display:flex;align-items:center;gap:8px;margin:12px 0}.condition>.el-select{min-width:100px;flex:1}.condition>.el-input{flex:1}summary{cursor:pointer;color:var(--el-color-primary);margin-bottom:10px}.muted{font-size:13px;color:var(--el-text-color-secondary)}@media(max-width:650px){.form-grid{grid-template-columns:1fr}.condition{flex-wrap:wrap}.condition>.el-input{min-width:100%}}</style>
