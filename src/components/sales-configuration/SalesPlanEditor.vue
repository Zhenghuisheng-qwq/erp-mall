<template>
  <el-dialog :model-value="modelValue" title="选配方案" width="min(920px,96vw)" top="5vh" :close-on-click-modal="false" :before-close="close" :show-close="!busy" data-sales-plan-editor>
    <el-form v-if="draft" label-position="top" :disabled="!canEdit || busy">
      <el-form-item label="方案名称"><el-input v-model="draft.name" maxlength="80" aria-label="方案名称" placeholder="例如：手机日常配件" /></el-form-item>
      <div class="section-heading"><strong>选配项目</strong><el-button @click="addItem" data-sales-add-item>＋选配项目</el-button></div>
      <article v-for="(item,index) in draft.items" :key="item.id" class="option-item" :data-sales-option-item="item.id">
        <div class="item-heading"><el-input v-model="item.name" :aria-label="`选配项目 ${index+1} 名称`" placeholder="例如：手机壳" /><el-switch v-model="item.enabled" :aria-label="`${item.name || '选配项目'}启用`" /><el-dropdown trigger="click"><el-button :disabled="!canEdit || busy" :aria-label="`${item.name || '选配项目'}更多`">更多</el-button><template #dropdown><el-dropdown-menu><el-dropdown-item :disabled="index===0" @click="moveItem(index,-1)">上移</el-dropdown-item><el-dropdown-item :disabled="index===draft.items.length-1" @click="moveItem(index,1)">下移</el-dropdown-item><el-dropdown-item @click="removeItem(item.id)">移除项目</el-dropdown-item></el-dropdown-menu></template></el-dropdown></div>
        <div class="scope-row"><el-select :model-value="item.scope.kind" aria-label="候选范围类型" @change="(kind:SalesCandidateScope['kind'])=>changeScope(item,kind)"><el-option value="product-types" label="按产品类型"/><el-option value="families" label="按商品"/><el-option value="skus" label="指定 SKU"/><el-option value="service" label="服务权益"/></el-select>
          <el-select v-if="item.scope.kind!=='service'" v-model="item.scope.ids" multiple filterable collapse-tags collapse-tags-tooltip aria-label="候选范围" placeholder="搜索并选择候选范围"><el-option v-for="choice in scopeOptions(item.scope.kind)" :key="choice.id" :value="choice.id" :label="choice.label"/></el-select>
          <span v-else class="muted">服务直接加入本次清单，不生成商品。</span>
        </div>
        <details class="advanced"><summary>高级设置</summary><div class="advanced-grid">
          <el-form-item label="需要核对的对象"><el-select v-model="item.checkTarget" aria-label="需要核对的对象"><el-option value="device" label="本次使用设备"/><el-option value="source" label="当前推荐来源商品"/><el-option value="none" label="无需对象适用核对"/></el-select></el-form-item>
          <el-form-item label="选择建议"><el-checkbox v-model="item.recommended">推荐</el-checkbox><el-checkbox v-model="item.required" @change="(value:boolean|string|number)=>{if(value&&item.minKinds===0)item.minKinds=1}">必选</el-checkbox></el-form-item>
          <el-form-item label="最少 / 最多款数"><div class="range"><el-input-number v-model="item.minKinds" :min="0" :max="999" controls-position="right" aria-label="最少款数"/><el-input-number v-model="item.maxKinds" :min="1" :max="999" controls-position="right" aria-label="最多款数"/></div></el-form-item>
          <el-form-item label="默认数量"><el-input-number v-model="item.defaultQuantity" :min="1" :max="9999" controls-position="right" aria-label="默认数量"/></el-form-item>
          <el-form-item label="最少 / 最多数量"><div class="range"><el-input-number v-model="item.minQuantity" :min="1" :max="9999" controls-position="right" aria-label="最少数量"/><el-input-number v-model="item.maxQuantity" :min="1" :max="9999" controls-position="right" aria-label="最多数量"/></div></el-form-item>
          <el-form-item label="来源"><el-input v-model="item.source" aria-label="项目来源" placeholder="例如：门店选配指引"/></el-form-item>
          <template v-if="item.scope.kind==='service' && item.service"><el-form-item label="服务单位"><el-input v-model="item.service.unit" aria-label="服务单位"/></el-form-item><el-form-item label="计量"><el-select v-model="item.service.measurement" aria-label="服务计量"><el-option value="per-package" label="每份方案"/><el-option value="per-delivery" label="每次交付"/></el-select></el-form-item><el-form-item label="有效期"><el-input v-model="item.service.validity" aria-label="服务有效期"/></el-form-item><el-form-item label="服务内容"><el-input v-model="item.service.description" type="textarea" aria-label="服务内容"/></el-form-item></template>
          <el-form-item label="说明"><el-input v-model="item.note" type="textarea" aria-label="项目说明"/></el-form-item>
        </div></details>
      </article>
      <el-empty v-if="!draft.items.length" description="添加第一个选配项目" :image-size="55"/>
      <details v-if="draft.items.length>1" class="advanced"><summary>项目依赖与互斥</summary><BenefitGroupRelationsEditor v-model="draft.rules" :groups="ruleGroups" :disabled="!canEdit || busy"/></details>
    </el-form>
    <el-alert v-if="error" :title="error" type="error" :closable="false" role="alert"/>
    <p v-if="draft?.publishedVersion" class="muted">当前发布版本 v{{draft.publishedVersion}}。保存草稿不会改写现有绑定；发布后可单独预览绑定升级。</p>
    <template #footer><span v-if="dirty" class="muted">有未保存修改</span><span v-else-if="draft?.id" class="muted">草稿已保存</span><el-button :disabled="busy" @click="close()">关闭</el-button><el-button v-if="canEdit" :type="keepOpenAfterSave?'default':'primary'" :loading="busy" data-sales-save-plan @click="save">保存草稿</el-button><el-button v-if="store.can('product:sales-config:publish')" type="primary" :loading="busy" :disabled="!draft?.id||dirty" data-sales-editor-publish @click="publish">{{draft?.publishedVersion?'发布新版本':'发布方案'}}</el-button></template>
  </el-dialog>
</template>
<script setup lang="ts">
import {computed,onBeforeUnmount,ref,watch} from 'vue'
import {ElMessageBox} from 'element-plus'
import {onBeforeRouteLeave} from 'vue-router'
import {useCatalogStore,uid} from '../../stores/catalog'
import {isRealSku} from '../../domain/catalogIdentity'
import {savedSkuName,savedSkuCode} from '../../domain/productList'
import type {SalesOptionItem,SalesOptionPlan,SalesCandidateScope} from '../../domain/salesConfigurationTypes'
import type {BenefitSelectionGroup} from '../../domain/benefitPackageTypes'
import BenefitGroupRelationsEditor from '../benefit-package/BenefitGroupRelationsEditor.vue'
const props=defineProps<{modelValue:boolean;planId?:string;copyId?:string;keepOpenAfterSave?:boolean}>()
const emit=defineEmits<{'update:modelValue':[boolean];saved:[string]}>()
const store=useCatalogStore(),draft=ref<SalesOptionPlan>(),baseline=ref(''),error=ref(''),busy=ref(false)
let alive=true,epoch=0,requestId='',publishRequest=''
const clone=<T,>(value:T):T=>JSON.parse(JSON.stringify(value))
const canEdit=computed(()=>store.can(draft.value?.id?'product:sales-config:update':'product:sales-config:create'))
const dirty=computed(()=>!!draft.value&&JSON.stringify(draft.value)!==baseline.value)
const ruleGroups=computed<BenefitSelectionGroup[]>(()=>draft.value?.items.map(item=>({id:item.id,name:item.name,enabled:item.enabled,candidateSkuIds:[],required:item.required,minKinds:item.minKinds,maxKinds:item.maxKinds,defaultQuantity:item.defaultQuantity,adjustable:true,minQuantity:item.minQuantity,maxQuantity:item.maxQuantity}))||[])
watch(()=>[props.modelValue,props.planId,props.copyId],()=>{if(!props.modelValue)return;epoch++;error.value='';requestId=uid('sales-plan-request');publishRequest=uid('sales-plan-publish');const source=store.data.salesOptionPlans?.find(item=>item.id===(props.copyId||props.planId));draft.value=source?clone(source):{schemaVersion:1,id:'',name:'',revision:0,status:'draft',items:[],rules:[],publishedVersion:null,versions:[],createdAt:'',updatedAt:''};if(props.copyId&&source)Object.assign(draft.value,{id:'',name:`${source.name} 副本`,revision:0,status:'draft',publishedVersion:null,versions:[],createdAt:'',updatedAt:''});baseline.value=JSON.stringify(draft.value)},{immediate:true})
function addItem(){draft.value?.items.push({id:uid('sales-item'),name:'',enabled:true,order:draft.value.items.length,scope:{kind:'product-types',ids:[]},recommended:false,required:false,minKinds:0,maxKinds:99,defaultQuantity:1,minQuantity:1,maxQuantity:99,checkTarget:'device',source:'人工配置',note:''})}
function changeScope(item:SalesOptionItem,kind:SalesCandidateScope['kind']){item.scope={kind,ids:[]};if(kind==='service'){item.checkTarget='none';item.service={unit:'项',measurement:'per-package',validity:'',description:''}}else delete item.service}
function scopeOptions(kind:SalesCandidateScope['kind']){if(kind==='product-types')return store.data.productTypes.map(x=>({id:x.id,label:x.name}));if(kind==='families')return store.data.families.map(x=>({id:x.id,label:`${x.name} · ${x.oaProductId||x.id}`}));return store.data.skus.filter(x=>isRealSku(store.data,x)).map(x=>({id:x.id,label:`${savedSkuName(x)} · ${savedSkuCode(x)}`}))}
function moveItem(index:number,delta:number){const items=draft.value?.items;if(!items||index+delta<0||index+delta>=items.length)return;const [item]=items.splice(index,1);items.splice(index+delta,0,item!);items.forEach((entry,i)=>entry.order=i)}
function removeItem(id:string){if(!draft.value)return;draft.value.items=draft.value.items.filter(item=>item.id!==id);draft.value.items.forEach((item,i)=>item.order=i)}
async function close(done?:()=>void){if(busy.value)return;if(dirty.value){try{await ElMessageBox.confirm('选配方案尚未保存，放弃本次输入？','未保存修改',{confirmButtonText:'放弃修改',cancelButtonText:'继续编辑'})}catch{return}}emit('update:modelValue',false);done?.()}
async function save(){if(!draft.value||busy.value||!canEdit.value)return;const version=epoch,owner=store.activeUserId,preview=store.previewUserId,input=JSON.stringify(draft.value);busy.value=true;error.value='';try{const result=await store.saveSalesOptionPlan({draft:clone(draft.value),expectedRevision:draft.value.revision,requestId},()=>alive&&version===epoch&&props.modelValue&&owner===store.activeUserId&&preview===store.previewUserId&&input===JSON.stringify(draft.value));if(!result.ok){error.value=result.message||'保存失败，输入已保留。';return}if(result.plan)draft.value=clone(result.plan);baseline.value=JSON.stringify(draft.value);requestId=uid('sales-plan-request');publishRequest=uid('sales-plan-publish');emit('saved',result.id!);if(!props.keepOpenAfterSave)emit('update:modelValue',false)}catch(cause){error.value=cause instanceof Error?cause.message:'保存失败，输入已保留。'}finally{busy.value=false}}
async function publish(){
  if(!draft.value?.id||dirty.value||busy.value||!store.can('product:sales-config:publish'))return
  const candidate=clone(draft.value),version=epoch,owner=store.activeUserId,preview=store.previewUserId,input=JSON.stringify(draft.value)
  const current=()=>alive&&version===epoch&&props.modelValue&&owner===store.activeUserId&&preview===store.previewUserId&&input===JSON.stringify(draft.value)
  try{await ElMessageBox.confirm(`发布「${candidate.name}」的新版本？已有范围继续使用原版本，可另行预览后更新。`,'发布选配方案',{confirmButtonText:'确认发布方案',cancelButtonText:'继续编辑'})}catch{return}
  if(!current()){error.value='输入或操作者已变化，请重新核对后发布。';return}
  busy.value=true;error.value=''
  try{const result=await store.publishSalesOptionPlan({id:candidate.id,expectedRevision:candidate.revision,requestId:publishRequest},current);if(!result.ok){error.value=result.message||'发布失败，已保存草稿保留，可重试。';return}if(result.plan)draft.value=clone(result.plan);baseline.value=JSON.stringify(draft.value);emit('saved',result.id!);emit('update:modelValue',false)}catch(cause){error.value=cause instanceof Error?cause.message:'发布失败，已保存草稿保留，可重试。'}finally{busy.value=false}
}
onBeforeRouteLeave(async()=>{if(!props.modelValue)return true;await close();return !props.modelValue})
onBeforeUnmount(()=>{alive=false;epoch++})
</script>
<style scoped>
.section-heading,.item-heading,.scope-row,.range{display:flex;align-items:center;gap:10px}.section-heading{justify-content:space-between;margin-bottom:12px}.option-item{padding:14px;margin:12px 0;border:1px solid var(--el-border-color);border-radius:8px}.item-heading>.el-input{flex:1}.scope-row{margin-top:12px;align-items:flex-start}.scope-row>.el-select:first-child{width:160px;flex:none}.scope-row>.el-select:nth-child(2){flex:1;min-width:0}.advanced{margin-top:14px}.advanced summary{cursor:pointer;color:var(--el-color-primary);font-size:13px}.advanced-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 16px;margin-top:14px}.range .el-input-number{width:50%;min-width:0}.advanced-grid .el-select{width:100%}.muted{font-size:13px;color:var(--el-text-color-secondary)}@media(max-width:650px){.advanced-grid{grid-template-columns:1fr}.scope-row{flex-wrap:wrap}.scope-row>.el-select:first-child,.scope-row>.el-select:nth-child(2){width:100%;flex:auto}.item-heading{flex-wrap:wrap}}
</style>
