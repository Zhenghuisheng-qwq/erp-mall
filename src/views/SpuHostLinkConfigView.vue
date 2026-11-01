<template>
 <div><PageHead title="兼容性配置" desc="选择配件 SPU，再勾选它关联的主机 SPU；可选一项或多项。"><el-button @click="router.push('/compatibility/list')">查看关联列表</el-button></PageHead>
 <section class="panel relation-config"><el-form label-position="top" :disabled="busy"><el-form-item label="配件 SPU" required><el-select :model-value="accessory||undefined" filterable clearable placeholder="搜索配件名称或编号" aria-label="选择配件SPU" @change="chooseAccessory(String($event||''))"><el-option v-for="s in accessories" :key="s.id" :value="s.id" :label="label(s.id)"/></el-select></el-form-item></el-form>
 <template v-if="accessory"><h2>关联主机 SPU</h2><div class="tools"><el-input v-model="keyword" clearable placeholder="搜索主机名称或编号" aria-label="搜索主机SPU"/><span>已选 {{hostIds.length}} 项，可单选或多选</span></div><el-checkbox-group v-model="hostIds" :disabled="busy||!editable"><div v-for="s in filtered.slice((page-1)*20,page*20)" :key="s.id" class="host-row"><el-checkbox :value="s.id" :data-host-choice="s.id">{{s.name}} · {{s.code}} <small>{{statusLabels[s.status]}}</small></el-checkbox></div></el-checkbox-group><el-empty v-if="!filtered.length" description="没有匹配的主机 SPU"/><el-pagination v-model:current-page="page" :total="filtered.length" :page-size="20" layout="prev,pager,next,total"/>
 <div class="selected"><el-tag v-for="id in hostIds" :key="id" :closable="!busy&&editable" @close="hostIds=hostIds.filter(x=>x!==id)">{{label(id)}}</el-tag></div></template>
 <el-alert v-if="error" :title="error" type="error" :closable="false"/>
 <div class="tools"><el-button type="primary" :loading="busy" :disabled="!accessory||!hostIds.length||!editable" data-save-spu-host-link @click="save">保存关联</el-button><el-button :disabled="busy" @click="router.push('/compatibility/list')">返回列表</el-button></div><p v-if="savedAt" class="muted">最近保存：{{savedAt}}</p>
 </section></div>
</template>
<script setup lang="ts">
import {computed,ref,watch,onBeforeUnmount} from 'vue'
import {useRoute,useRouter,onBeforeRouteLeave,onBeforeRouteUpdate} from 'vue-router'
import {ElMessage,ElMessageBox} from 'element-plus'
import PageHead from '../components/PageHead.vue'
import {useCatalogStore} from '../stores/catalog'
import {linkSpuOptions} from '../domain/spuHostLinks'
import {spuLinkLabel} from '../domain/spuHostLinks'
const store=useCatalogStore(),route=useRoute(),router=useRouter(),accessory=ref(''),hostIds=ref<string[]>([]),revision=ref(0),initial=ref(''),keyword=ref(''),page=ref(1),busy=ref(false),error=ref(''),savedAt=ref('')
const statusLabels={online:'已上架',offline:'已下架',draft:'草稿'},accessories=computed(()=>linkSpuOptions(store.data,'accessory')),hosts=computed(()=>linkSpuOptions(store.data,'host')),filtered=computed(()=>hosts.value.filter(s=>`${s.name} ${s.code}`.toLowerCase().includes(keyword.value.trim().toLowerCase())))
const editable=computed(()=>store.can('product:sku-host-link:'+(revision.value?'update':'create')))
const stamp=()=>JSON.stringify([accessory.value,[...hostIds.value].sort()]),dirty=computed(()=>stamp()!==initial.value),actor=()=>JSON.stringify([store.activeUserId,store.previewUserId])
function label(id:string){return spuLinkLabel(store.data,id)}
function load(id:string){accessory.value=id;const row=store.data.spuHostLinks?.find(r=>r.accessorySpuId===id);hostIds.value=[...(row?.hostSpuIds||[])];revision.value=row?.revision||0;initial.value=stamp();error.value='';savedAt.value=row?.updatedAt||'';keyword.value='';page.value=1}
async function discard(){if(busy.value)return false;if(!dirty.value)return true;try{await ElMessageBox.confirm('关联选择尚未保存，确定放弃修改？','未保存关联');return true}catch{return false}}
async function chooseAccessory(id:string){if(await discard())load(id)}
async function save(){if(busy.value||!editable.value)return;const owner=actor();busy.value=true;error.value='';try{const result=await store.saveSpuHostLink(accessory.value,hostIds.value,revision.value);if(owner!==actor())return;if(!result.ok){error.value=result.message||'保存失败，选择已保留';return}if('record'in result&&result.record){revision.value=result.record.revision;savedAt.value=result.record.updatedAt;initial.value=stamp()}ElMessage.success('配件与主机关联已保存')}catch(e){if(owner===actor())error.value=String(e)}finally{busy.value=false}}
watch(()=>[route.query.spu,route.query.sku],()=>load(typeof route.query.spu==='string'?route.query.spu:typeof route.query.sku==='string'?store.data.skus.find(s=>s.id===route.query.sku)?.familyId||'':''),{immediate:true});watch(keyword,()=>page.value=1);watch(()=>[store.activeUserId,store.previewUserId],()=>load(''))
onBeforeRouteLeave(discard);onBeforeRouteUpdate(discard)
function unload(e:BeforeUnloadEvent){if(dirty.value||busy.value){e.preventDefault();e.returnValue=''}}window.addEventListener('beforeunload',unload);onBeforeUnmount(()=>window.removeEventListener('beforeunload',unload))
</script>
<style scoped>.relation-config{max-width:1100px;margin:18px auto;padding:24px}.el-select{width:100%}.tools{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:16px 0}.tools .el-input{max-width:400px}.host-row{padding:8px;border-bottom:1px solid var(--el-border-color-lighter);overflow-wrap:anywhere}.selected{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}.selected .el-tag{height:auto;white-space:normal;max-width:100%;padding:5px;line-height:1.5}.muted,small{color:var(--el-text-color-secondary)}</style>

<style scoped>.host-row :deep(.el-checkbox){height:auto;white-space:normal}.host-row :deep(.el-checkbox__label){white-space:normal;line-height:1.6}</style>
