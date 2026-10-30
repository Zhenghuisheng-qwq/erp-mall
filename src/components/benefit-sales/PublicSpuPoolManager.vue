<template>
 <section class="panel" data-public-pool-workspace>
  <p class="muted">公共池启用商品自动展示在所有权益包和自由组合中。停用后停止提供新候选，历史清单保留。</p>
  <div class="toolbar"><el-button v-if="store.can('product:type-bundle:create')" type="primary" :disabled="busy" data-add-pool @click="pickerOpen=true;error=''">从商品库添加</el-button><span>{{rows.length}} 个公共 SPU</span></div>
  <el-alert v-if="error" :title="error" type="error" :closable="false"/>
  <el-table :data="pageRows" max-height="max(220px, calc(100vh - 320px))" row-key="spuId" data-public-pool>
   <el-table-column label="商品" min-width="220"><template #default="{row}"><strong>{{row.name}}</strong><small>{{row.typeName}} · {{row.categoryPath}}</small><small v-if="row.problem" class="warning">{{row.problem}}</small></template></el-table-column>
   <el-table-column label="销售规格" width="110"><template #default="{row}">{{row.skuCount}} 个</template></el-table-column>
   <el-table-column label="可用范围" width="110"><template #default>全部选购模式</template></el-table-column>
   <el-table-column label="状态" width="82"><template #default="{row}"><el-tag :type="row.enabled?'success':'warning'" size="small">{{row.enabled?'启用':'停用'}}</el-tag></template></el-table-column>
   <el-table-column label="操作" width="150"><template #default="{row}"><div class="pool-actions"><el-button v-if="store.can('product:type-bundle:update')" text :disabled="busy" :data-toggle-pool="row.spuId" @click="toggle(row)">{{row.enabled?'停用':'启用'}}</el-button><el-button v-if="store.can('product:type-bundle:delete')" text type="danger" :disabled="busy" :data-remove-pool="row.spuId" @click="remove(row)">移除</el-button></div></template></el-table-column>
  </el-table>
  <el-pagination v-model:current-page="page" v-model:page-size="size" :page-sizes="[20,50]" :total="rows.length" layout="total, sizes, prev, pager, next"/>
  <PublicSpuPicker v-model:open="pickerOpen" :data="store.data" :busy="busy" :error="error" @confirm="add"/>
  <div class="pool-footer"><el-button :disabled="busy" @click="close">返回权益包管理</el-button></div>
 </section>
</template>
<script setup lang="ts">
import {computed,ref,watch,onBeforeUnmount} from 'vue'
import {ElMessage,ElMessageBox} from 'element-plus'
import PublicSpuPicker from './PublicSpuPicker.vue'
import {useCatalogStore} from '../../stores/catalog'
import {publicSpuRows,publicSpuProblem,publicSpuReferences,type PublicSpuEntry} from '../../domain/benefitSales/publicSpuPool'
const emit=defineEmits<{close:[];busy:[value:boolean]}>(),store=useCatalogStore(),page=ref(1),size=ref(20),pickerOpen=ref(false),busy=ref(false),error=ref('')
const rows=computed(()=>{const index=new Map(publicSpuRows(store.data).map(r=>[r.id,r]));return (store.data.publicSpuPool||[]).map(row=>({...index.get(row.spuId),...row,name:store.data.families.find(f=>f.id===row.spuId)?.name||'SPU 引用失效',skuCount:index.get(row.spuId)?.skuCount||0,references:publicSpuReferences(store.data,row.spuId),problem:publicSpuProblem(store.data,row.spuId)}))})
const pageRows=computed(()=>rows.value.slice((page.value-1)*size.value,page.value*size.value))
let alive=true
onBeforeUnmount(()=>{alive=false;pickerOpen.value=false})
watch(busy,value=>emit('busy',value))
const actor=()=>JSON.stringify([store.activeUserId,store.previewUserId])
watch(actor,()=>{pickerOpen.value=false;error.value=''})
async function run(action:()=>Promise<{ok:boolean;message?:string}>){if(busy.value)return;busy.value=true;error.value='';const owner=actor();try{const result=await action();if(owner!==actor())return;if(!result.ok)error.value=result.message||'保存失败，原数据保持';else ElMessage.success(result.message||'公共池已保存')}catch(e){if(owner===actor())error.value=String(e)}finally{busy.value=false}}
async function add(ids:string[],basis:string){const owner=actor();await run(async()=>{const result=await store.addPublicSpus(ids,basis,()=>alive&&owner===actor()&&pickerOpen.value);if(result.ok)pickerOpen.value=false;return result})}
async function toggle(row:PublicSpuEntry){try{if(row.enabled)await ElMessageBox.confirm('停用将停止提供此公共 SPU 的新候选，已有权益包引用与确认历史保留。','停用公共商品',{confirmButtonText:'确认停用',cancelButtonText:'取消'});await run(()=>store.setPublicSpuEnabled(row.spuId,!row.enabled,row.revision))}catch{}}
async function remove(row:PublicSpuEntry){if(publicSpuReferences(store.data,row.spuId).length){error.value='此商品仍被权益包引用，请先明确移除引用，或使用停用。';return}try{await ElMessageBox.confirm('仅从公共池移除引用，不删除 SPU、SKU 或历史清单。','移除公共商品',{confirmButtonText:'确认移除',cancelButtonText:'取消'});await run(()=>store.removePublicSpu(row.spuId,row.revision))}catch{}}
function close(){if(!busy.value)emit('close')}
</script>
<style scoped>.pool-footer{margin-top:20px}.pool-actions{display:flex;gap:4px;white-space:nowrap}.pool-actions .el-button{margin:0}.toolbar{display:flex;align-items:center;gap:12px;margin:16px 0}.muted,small{font-size:12px;color:var(--el-text-color-secondary)}small{display:block;margin-top:5px}.warning{color:var(--el-color-warning)}.el-alert{margin-bottom:12px}.el-pagination{margin-top:16px;flex-wrap:wrap}</style>
