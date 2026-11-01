<template>
 <div>
  <PageHead title="分类用途配置" desc="主机分类用于选择设备；配件分类包含实物配件与增值业务，可跨分类参与权益包。">
   <el-button v-if="store.canRoute({path:'/benefits/manage'})" @click="router.push('/benefits/manage')">配置权益包</el-button>
  </PageHead>
  <el-alert title="旧分类标记为未配置，继续沿用原产品类型用途。设置分类用途后，该分类下的产品类型统一采用此用途；混合分类请先在商品资料管理中整理。" type="info" :closable="false"/>
  <div class="toolbar"><el-radio-group v-model="filter"><el-radio-button value="all">全部</el-radio-button><el-radio-button value="host">主机</el-radio-button><el-radio-button value="accessory">配件 / 增值业务</el-radio-button><el-radio-button value="unset">未配置</el-radio-button></el-radio-group><el-input v-model="keyword" placeholder="搜索分类" clearable/><el-button v-if="store.can('product:category:create')" @click="router.push({path:'/categories',query:{mode:'edit',role:filter==='accessory'?'accessory':'host'}})">新增分类</el-button></div>
  <el-table :data="rows" row-key="id"><el-table-column label="分类路径"><template #default="{row}">{{categoryPathLabel(store.data.categories,row.id)}}</template></el-table-column><el-table-column label="用途" width="180"><template #default="{row}">{{row.catalogRole==='host'?'主机':row.catalogRole==='accessory'?'配件 / 增值业务':'未配置'}}</template></el-table-column><el-table-column label="状态" width="100"><template #default="{row}">{{row.enabled?'启用':'停用'}}</template></el-table-column><el-table-column label="操作" width="120"><template #default="{row}"><el-button :disabled="busy||!store.can('product:category:update')" link @click="open(row)">配置用途</el-button></template></el-table-column></el-table>
  <el-dialog v-model="opened" title="配置分类用途" width="480px" :before-close="close" :close-on-click-modal="false">
   <p>{{editing?.name}}</p><el-radio-group v-model="role" :disabled="busy"><el-radio value="host">主机</el-radio><el-radio value="accessory">配件（含增值业务）</el-radio></el-radio-group>
   <p>仅设置当前分类，子分类各自配置。权益包的新选购按最新用途核验，已确认清单保留历史。</p>
   <el-alert v-if="conflicts.length" type="warning" :closable="false" :title="'用途将覆盖这些产品类型的旧设置：'+conflicts.join('、')"/>
   <el-alert v-if="error" :title="error" type="error" :closable="false"/>
   <template #footer><el-button :disabled="busy" @click="close(()=>opened=false)">取消</el-button><el-button type="primary" :loading="busy" @click="save">保存</el-button></template>
  </el-dialog>
 </div>
</template>
<script setup lang="ts">
import {computed,ref,watch,onBeforeUnmount} from 'vue'
import {useRouter,onBeforeRouteLeave} from 'vue-router'
import {ElMessage,ElMessageBox} from 'element-plus'
import PageHead from '../components/PageHead.vue'
import {useCatalogStore} from '../stores/catalog'
import {categoryPathLabel} from '../domain/categoryTree'
import type {Category} from '../domain/types'
const store=useCatalogStore(),router=useRouter(),filter=ref('all'),keyword=ref(''),opened=ref(false),busy=ref(false),error=ref(''),editing=ref<Category>(),role=ref<'host'|'accessory'>('host'),initial=ref('')
const rows=computed(()=>store.data.categories.filter(c=>(filter.value==='all'||(c.catalogRole||'unset')===filter.value)&&categoryPathLabel(store.data.categories,c.id).includes(keyword.value.trim())))
const conflicts=computed(()=>store.data.productTypes.filter(t=>t.categoryId===editing.value?.id&&t.catalogRole&&t.catalogRole!==role.value).map(t=>t.name))
const dirty=computed(()=>opened.value&&(role.value!==initial.value||!!error.value))
function open(row:Category){editing.value={...row};role.value=row.catalogRole||'host';initial.value=row.catalogRole||'';error.value='';opened.value=true}
async function discard(){if(busy.value)return false;if(!dirty.value)return true;try{await ElMessageBox.confirm('放弃未保存的分类用途？','未保存内容');return true}catch{return false}}
async function close(done:()=>void){if(await discard())done()}
async function save(){if(!editing.value||busy.value||!store.can('product:category:update'))return;const current=store.data.categories.find(c=>c.id===editing.value!.id);if(!current||JSON.stringify(current)!==JSON.stringify(editing.value)){error.value='分类已变化，请重新打开核对';return}busy.value=true;error.value='';try{const message=store.updateCategory(current.id,{...current,catalogRole:role.value});if(message){error.value=message;return}editing.value={...store.data.categories.find(c=>c.id===current.id)!};const result=await store.flushPersistence();if(!result.ok){error.value=store.persistenceState.message||'保存失败，输入已保留，请重试';return}opened.value=false;ElMessage.success('分类用途已保存')}catch(e){error.value=String(e)}finally{busy.value=false}}
watch(()=>[store.activeUserId,store.previewUserId],()=>{opened.value=false;editing.value=undefined;error.value=''})
onBeforeRouteLeave(discard)
function unload(e:BeforeUnloadEvent){if(dirty.value||busy.value){e.preventDefault();e.returnValue=''}}
window.addEventListener('beforeunload',unload)
onBeforeUnmount(()=>window.removeEventListener('beforeunload',unload))
</script>
<style scoped>.toolbar{display:flex;flex-wrap:wrap;gap:12px;margin:20px 0}.toolbar .el-input{max-width:260px}</style>
