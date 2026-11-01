<template>
 <div>
  <PageHead title="二手机回收" desc="按二手机商品模型中的属性顺序逐步填写，建立独立设备档案。"><el-button v-if="store.canRoute({path:'/catalog',query:{view:'models'}})" @click="router.push({path:'/catalog',query:{view:'models',categoryId:chain.categoryId}})">管理二手机模型</el-button><el-button @click="router.push('/skus?goods=used')">查看二手机</el-button></PageHead>
  <el-alert v-if="error" :title="error" type="error" :closable="false"/>
  <section v-if="success" class="panel intake-panel"><el-result icon="success" title="回收建档成功" :sub-title="success+' · 待上架'"/><el-button type="primary" @click="reset">继续回收下一台</el-button><el-button @click="router.push('/spus?goods=used')">查看二手 SPU</el-button><el-button @click="router.push('/skus?goods=used')">查看二手 SKU</el-button></section>
  <section v-else class="panel intake-panel">
   <el-select v-if="models.length>1" :model-value="selectedModel" aria-label="回收商品模型" @change="changeModel(String($event))"><el-option v-for="m in models" :key="m.templateId" :value="m.templateId" :label="m.name||m.templateId"/></el-select>
   <el-alert v-if="!chain.fields.length" title="请在商品模型中创建一条只有属性、没有属性值的单链路，再返回回收。" type="warning" :closable="false"/>
   <p class="muted">{{categoryPathLabel(store.data.categories,chain.categoryId)}} · {{chain.fields.map(f=>f.label).join(' → ')}}</p>
   <p class="muted">按顺序填写，当前项有值后自动显示下一项；没有该属性请填写“无”。</p>
   <el-form label-position="top" @submit.prevent><div v-for="(field,i) in chain.fields.slice(0,filledCount+1)" :key="field.key" class="intake-step"><el-form-item :label="`${i+1}. ${field.label}`" required><el-input v-model="answers[field.key]" :aria-label="field.label" :placeholder="`请输入${field.label}，没有该属性请填“无”`" maxlength="160" :disabled="busy"/></el-form-item></div></el-form>
   <el-form v-if="allFilled" label-position="top" :disabled="busy" @submit.prevent><h2>回收登记</h2><el-form-item label="回收金额（元，可选）"><el-input v-model="details.cost" aria-label="回收金额"/></el-form-item><el-form-item label="IMEI（可选）"><el-input v-model="details.imei" aria-label="回收IMEI" maxlength="160"/></el-form-item><el-form-item label="序列号（可选）"><el-input v-model="details.serial" maxlength="160"/></el-form-item><el-form-item label="备注（可选）"><el-input v-model="details.note" type="textarea" maxlength="2000"/></el-form-item><el-checkbox v-if="ambiguous" v-model="details.newSpu">存在同名主体，明确新建独立主体</el-checkbox><p class="muted">保存为待上架设备。相同品牌、型号可归入同一二手 SPU，每台实物编号独立。</p></el-form><el-button type="primary" :disabled="!allFilled" :loading="busy" data-submit-intake @click="submit">保存</el-button>
  </section>
 </div>
</template>
<script setup lang="ts">
import {computed,ref,watch,onBeforeUnmount} from 'vue'
import {useRoute,useRouter,onBeforeRouteLeave,onBeforeRouteUpdate} from 'vue-router'
import {ElMessageBox} from 'element-plus'
import PageHead from '../components/PageHead.vue'
import {useCatalogStore} from '../stores/catalog'
import {usedIntakeModels} from '../domain/usedGoods/intakeModel'
import {intakeChain,type IntakeChain,type IntakeDetails} from '../domain/usedGoods/intake'
import {categoryPathLabel} from '../domain/categoryTree'
const store=useCatalogStore(),route=useRoute(),router=useRouter(),selectedModel=ref(intakeChain(store.data).modelId||''),models=computed(()=>usedIntakeModels(store.data)),chain=ref<IntakeChain>(JSON.parse(JSON.stringify(intakeChain(store.data)))),basis=ref(JSON.stringify(chain.value)),answers=ref<Record<string,string>>({}),details=ref<IntakeDetails>({cost:'',serial:'',imei:'',note:''}),busy=ref(false),error=ref(''),success=ref(''),requestId=ref(crypto.randomUUID()),ambiguous=ref(false)
const cloneChain=()=>JSON.parse(JSON.stringify(intakeChain(store.data,selectedModel.value))) as IntakeChain
function reset(){chain.value=cloneChain();basis.value=JSON.stringify(chain.value);answers.value={};details.value={cost:'',serial:'',imei:'',note:''};requestId.value=crypto.randomUUID();error.value='';success.value='';ambiguous.value=false}
const dirty=computed(()=>!success.value&&(Object.values(answers.value).some(v=>v.trim())||!!details.value.cost||!!details.value.serial||!!details.value.imei||!!details.value.note))
async function changeModel(id:string){if(await leave()){selectedModel.value=id;reset()}}
const filledCount=computed(()=>{const first=chain.value.fields.findIndex(f=>!answers.value[f.key]?.trim());return first<0?chain.value.fields.length:first})
const allFilled=computed(()=>chain.value.fields.length>0&&filledCount.value===chain.value.fields.length)
const actor=()=>JSON.stringify([store.activeUserId,store.previewUserId])
async function submit(){if(busy.value||!allFilled.value)return;busy.value=true;error.value='';const owner=actor();try{const result=await store.receiveUsedPhone(answers.value,details.value,basis.value,requestId.value);if(owner!==actor())return;if(!result.ok){error.value=result.message||'建档失败，输入保留';ambiguous.value='choices'in result;return}if('record'in result&&result.record)success.value=result.record.code}catch(e){if(owner===actor())error.value=String(e)}finally{busy.value=false}}
async function leave(){if(busy.value)return false;if(!dirty.value)return true;try{await ElMessageBox.confirm('回收资料或链路尚未保存，确定离开？','未保存内容');return true}catch{return false}}
onBeforeRouteLeave(leave)
onBeforeRouteUpdate(leave)
watch(()=>route.path,reset);watch(()=>[store.activeUserId,store.previewUserId],reset)
function unload(e:BeforeUnloadEvent){if(dirty.value||busy.value){e.preventDefault();e.returnValue=''}}
window.addEventListener('beforeunload',unload);onBeforeUnmount(()=>window.removeEventListener('beforeunload',unload))
</script>
<style scoped>.intake-panel{max-width:880px;margin:18px auto;padding:28px}.field-row{display:flex;gap:8px;align-items:center;margin:12px 0}.field-row .el-input{min-width:90px}.completed{display:flex;justify-content:space-between;gap:16px}.intake-step{padding:16px 0;border-bottom:1px solid var(--el-border-color-lighter)}.intake-step:last-child{border-bottom:0}.muted{color:var(--el-text-color-secondary);line-height:1.8}.el-form h2{margin:20px 0}@media(max-width:700px){.field-row{flex-wrap:wrap}.field-row .el-input{width:38%}.intake-panel{padding:16px}}</style>
