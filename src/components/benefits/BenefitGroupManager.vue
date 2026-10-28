<template>
 <section class="panel" data-benefit-manager>
  <h2>{{modelName}} · 权益包</h2><p class="muted">{{versionId?'设备预览来自所选历史版本；下面维护的是当前权益包配置，不会写入模型快照。':'权益包只组织候选类型，保存立即生效；不改变兼容性或全部可选商品。'}}</p>
  <el-alert v-if="scopeError" :title="scopeError" type="warning" :closable="false"/>
  <div class="group-list"><el-button v-if="store.can('product:benefit-group:create')" data-new-benefit-group @click="start()">新建权益包</el-button><el-button v-for="g in groups" :key="g.id" :data-benefit-group-record="g.id" @click="start(g)">{{g.name}} · {{g.scope.hostKey?'型号范围':'模型范围'}}{{g.enabled?'':' · 已停用'}}</el-button></div>
  <el-form v-if="draft" label-position="top" :disabled="busy||!editable" class="benefit-form">
   <el-form-item label="名称"><el-input v-model="draft.name" maxlength="80" aria-label="权益包名称"/></el-form-item>
   <el-form-item label="所属范围"><el-radio-group v-model="scopeKind" :disabled="!!draft.id||!!nodeId"><el-radio value="model">整个模型</el-radio><el-radio value="host">一个明确型号</el-radio></el-radio-group><el-select v-if="scopeKind==='host'" v-model="hostKey" filterable placeholder="选择实际型号" aria-label="权益包所属型号" :disabled="!!draft.id"><el-option v-for="o in hostOptions" :key="o.key" :label="o.label" :value="o.key"/></el-select><p v-if="nodeId&&!hostKey" class="muted">当前节点无法唯一确定型号，请明确选择；容量或颜色不建立独立作用范围。</p></el-form-item>
   <el-form-item label="包含的配件产品类型"><el-select v-model="draft.productTypeIds" data-benefit-group-types multiple filterable placeholder="搜索配件类型，可跨分类选择" aria-label="权益包产品类型"><el-option-group v-for="c in typeGroups" :key="c.name" :label="c.name"><el-option v-for="t in c.types" :key="t.id" :value="t.id" :label="t.name"/></el-option-group></el-select></el-form-item>
   <div class="inline"><el-form-item label="启用"><el-switch v-model="draft.enabled"/></el-form-item><el-form-item label="排序"><el-input-number v-model="draft.sort" :min="0" :max="9999" :precision="0" aria-label="权益包排序"/></el-form-item></div>
  </el-form>
  <div v-if="draft" class="preview"><h3>当前设备可选商品</h3><el-select v-model="previewKey" filterable clearable aria-label="权益包预览设备" placeholder="按需选择一个实际手机或型号"><el-option-group label="实际手机"><el-option v-for="d in devices" :key="d.id" :value="'sku:'+d.id" :label="d.name+' · '+d.spec"/></el-option-group><el-option-group label="仅型号预览"><el-option v-for="o in hostOptions" :key="o.key" :value="'model:'+o.key" :label="o.label"/></el-option-group></el-select>
   <p v-if="!preview">选择设备后计算，不展开整个模型的全部规格。</p><template v-else><p v-if="preview.issue">{{preview.issue}}</p><p v-else-if="!previewRows.length">当前没有可选商品。所选类型尚无已确认适用的在售配件；分组仍可保存。</p><div v-for="item in previewRows" :key="item.sku.id" :data-benefit-preview-sku="item.sku.id">{{item.name}} · {{item.spec}} · 基本使用已确认适用</div></template>
  </div>
  <el-alert v-if="error" :title="error" type="error" :closable="false"/>
  <div v-if="draft" class="actions"><el-button @click="cancel">关闭编辑</el-button><el-button v-if="editable" type="primary" :loading="busy" data-save-benefit-group @click="save">保存权益包</el-button></div>
 </section>
</template>
<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {ElMessage,ElMessageBox} from 'element-plus'
import {useCatalogStore} from '../../stores/catalog'
import {benefitCandidates,benefitDevices,benefitNodeHosts,benefitScopeProblem} from '../../domain/benefits/query'
import {benefitClone} from '../../domain/benefits/selection'
import {categoryPath} from '../../domain/logic'
import type {BenefitGroup,BenefitGroupInput} from '../../domain/benefits/types'
import {onBeforeRouteLeave,onBeforeRouteUpdate} from 'vue-router'
const props=defineProps<{modelId:string;versionId?:string;nodeId?:string;initialHostKey?:string}>(),store=useCatalogStore()
const draft=ref<BenefitGroupInput>(),revision=ref(0),hostKey=ref(''),scopeKind=ref('model'),previewKey=ref(''),error=ref(''),busy=ref(false),initial=ref('')
const modelName=computed(()=>store.data.specCanvases.find(m=>m.templateId===props.modelId)?.name||'未选择模型')
const scopeError=computed(()=>benefitScopeProblem(store.data,{modelId:props.modelId}))
const hostOptions=computed(()=>benefitNodeHosts(store.data,props.modelId,'',props.versionId))
const groups=computed(()=>(store.data.benefitGroups||[]).filter(g=>g.scope.modelId===props.modelId).sort((a,b)=>a.sort-b.sort))
const editable=computed(()=>store.can(draft.value?.id?'product:benefit-group:update':'product:benefit-group:create'))
const signature=()=>JSON.stringify([draft.value,scopeKind.value,hostKey.value]),dirty=computed(()=>!!draft.value&&signature()!==initial.value)
onBeforeRouteLeave(()=>busy.value?false:discard())
onBeforeRouteUpdate(()=>busy.value?false:discard())
const devices=computed(()=>benefitDevices(store.data).filter(d=>{const s=store.data.skus.find(s=>s.id===d.id),f=store.data.families.find(f=>f.id===s?.familyId);return (s?.creationSource?.templateId||f?.productModelId||f?.templateId)===props.modelId}))
const typeGroups=computed(()=>{const groups=new Map<string,typeof store.data.productTypes>();for(const t of store.data.productTypes.filter(t=>t.catalogRole==='accessory'&&t.status==='enabled')){const name=categoryPath(store.data,t.categoryId)||'未分类';groups.set(name,[...(groups.get(name)||[]),t])}return [...groups].map(([name,types])=>({name,types}))})
const preview=computed(()=>previewKey.value?benefitCandidates(store.data,previewKey.value.startsWith('sku:')?{kind:'sku',skuId:previewKey.value.slice(4)}:{kind:'model',hostKey:previewKey.value.slice(6)}):undefined)
const previewRows=computed(()=>preview.value?.candidates.filter(c=>draft.value?.productTypeIds.includes(c.productTypeId)&&(!hostKey.value||scopeKind.value!=='host'||preview.value?.hostKey===hostKey.value))||[])
async function discard(){if(!dirty.value)return true;try{await ElMessageBox.confirm('放弃未保存的权益包输入？','未保存权益包',{confirmButtonText:'放弃输入',cancelButtonText:'继续编辑'});return true}catch{return false}}
async function start(g?:BenefitGroup){if(!await discard())return;error.value='';draft.value=g?benefitClone(g):{id:'',name:'',scope:{modelId:props.modelId},productTypeIds:[],enabled:true,sort:0};revision.value=g?.revision||0;const nodeOptions=props.nodeId?benefitNodeHosts(store.data,props.modelId,props.nodeId,props.versionId):[];hostKey.value=g?.scope.hostKey||props.initialHostKey||(nodeOptions.length===1?nodeOptions[0]!.key:'');scopeKind.value=g?(g.scope.hostKey?'host':'model'):props.nodeId||hostKey.value?'host':'model';previewKey.value=hostKey.value?'model:'+hostKey.value:'';initial.value=signature()}
async function cancel(){if(await discard())draft.value=undefined}
async function save(){if(!draft.value||busy.value)return;if(scopeKind.value==='host'&&!hostKey.value){error.value='请明确选择所属型号';return}busy.value=true;error.value='';const stamp=signature();try{const result=await store.saveBenefitGroup({...draft.value,scope:{modelId:props.modelId,...(scopeKind.value==='host'?{hostKey:hostKey.value}:{})}},revision.value,()=>signature()===stamp);if(!result.ok){error.value=result.message||'保存失败，输入保留';return}if('record' in result&&result.record){draft.value=benefitClone(result.record);revision.value=result.record.revision;initial.value=signature();ElMessage.success('权益包已保存')}}catch(e){error.value=String(e)}finally{busy.value=false}}
watch(()=>[store.activeUserId,store.previewUserId,props.modelId,props.nodeId,props.versionId],()=>{draft.value=undefined;error.value=''})
</script>
<style scoped>
.group-list,.actions,.inline{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}.benefit-form{max-width:720px}.el-select{width:100%}.preview{padding:16px 0;border-top:1px solid var(--el-border-color)}.preview>div{padding:8px 0}.muted{color:var(--el-text-color-secondary);line-height:1.7}
</style>
