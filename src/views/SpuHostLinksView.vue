<template>
 <div><PageHead title="兼容性列表" desc="查看每个配件 SPU 已关联的主机 SPU。"><el-button v-if="store.can('product:sku-host-link:create')" type="primary" @click="router.push('/compatibility/config')">新增关联</el-button></PageHead>
 <el-alert v-if="store.data.spuHostLinkMigrationIssues?.length" :title="'有 '+store.data.spuHostLinkMigrationIssues.length+' 条旧关联缺少来源商品，原始记录已保留，请核对后重新配置。'" type="warning" :closable="false"/><section class="panel"><div class="tools"><el-input v-model="keyword" clearable placeholder="搜索配件、主机名称或编号" aria-label="搜索关联"/><el-select v-model="host" clearable filterable placeholder="筛选已关联主机" aria-label="筛选关联主机"><el-option v-for="s in hosts" :key="s.id" :value="s.id" :label="label(s.id)"/></el-select><span>{{rows.length}} 个配件已配置</span></div>
 <el-alert v-if="error" :title="error" type="error" :closable="false"/>
 <el-table :data="rows.slice((page-1)*20,page*20)" row-key="id" empty-text="暂无关联，请到兼容性配置页选择配件和主机"><el-table-column label="配件 SPU" min-width="260"><template #default="{row}">{{label(row.accessorySpuId)}}</template></el-table-column><el-table-column label="关联主机 SPU" min-width="400"><template #default="{row}"><div class="tags"><el-tag v-for="id in row.hostSpuIds" :key="id" effect="plain">{{label(id)}}</el-tag></div></template></el-table-column><el-table-column label="数量" width="80"><template #default="{row}">{{row.hostSpuIds.length}}</template></el-table-column><el-table-column label="更新时间" width="170"><template #default="{row}">{{new Date(row.updatedAt).toLocaleString('zh-CN',{timeZone:'Asia/Singapore',hour12:false})}}</template></el-table-column><el-table-column label="操作" width="180"><template #default="{row}"><el-button link :disabled="busy" @click="router.push({path:'/compatibility/config',query:{spu:row.accessorySpuId}})">{{store.can('product:sku-host-link:update')?'编辑':'查看'}}</el-button><el-button v-if="store.can('product:sku-host-link:delete')" link type="danger" :disabled="busy" @click="remove(row)">解除关联</el-button></template></el-table-column></el-table>
 <el-pagination v-model:current-page="page" :page-size="20" :total="rows.length" layout="prev,pager,next,total"/>
 </section></div>
</template>
<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {useRouter} from 'vue-router'
import {ElMessage,ElMessageBox} from 'element-plus'
import PageHead from '../components/PageHead.vue'
import {useCatalogStore} from '../stores/catalog'
import {linkSpuOptions,type SpuHostLink} from '../domain/spuHostLinks'
import {spuLinkLabel} from '../domain/spuHostLinks'
const store=useCatalogStore(),router=useRouter(),keyword=ref(''),host=ref(''),page=ref(1),busy=ref(false),error=ref(''),actor=()=>JSON.stringify([store.activeUserId,store.previewUserId])
const hosts=computed(()=>linkSpuOptions(store.data,'host'))
function label(id:string){return spuLinkLabel(store.data,id)}
const rows=computed(()=>(store.data.spuHostLinks||[]).filter(r=>(!host.value||r.hostSpuIds.includes(host.value))&&`${label(r.accessorySpuId)} ${r.hostSpuIds.map(label).join(' ')}`.toLowerCase().includes(keyword.value.trim().toLowerCase())).slice().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)))
watch([keyword,host],()=>page.value=1);watch(()=>[store.activeUserId,store.previewUserId],()=>{error.value='';keyword.value='';host.value='';page.value=1})
async function remove(row:SpuHostLink){const owner=actor();try{await ElMessageBox.confirm('解除该配件与所列全部主机的关联？商品资料和历史清单保留。','解除关联',{type:'warning'})}catch{return}if(owner!==actor()||busy.value)return;busy.value=true;error.value='';try{const result=await store.removeSpuHostLink(row.id,row.revision);if(owner!==actor())return;if(!result.ok)error.value=result.message||'解除失败';else ElMessage.success('关联已解除')}catch(e){if(owner===actor())error.value=String(e)}finally{busy.value=false}}
</script>
<style scoped>.panel{padding:24px}.tools{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:18px}.tools .el-input{max-width:400px}.tools .el-select{width:360px}.tags{display:flex;flex-direction:column;align-items:flex-start;gap:6px}.tags .el-tag{height:auto;white-space:normal;max-width:100%;padding:5px;line-height:1.5}.el-pagination{margin-top:18px}</style>
