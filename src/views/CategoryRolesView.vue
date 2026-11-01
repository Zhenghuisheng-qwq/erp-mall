<template>
 <div>
  <PageHead title="分类用途配置" desc="维护主机、配件、维修等分类用途；分类绑定后在分类树中同步展示。"><el-button v-if="store.canRoute({path:'/benefits/manage'})" @click="router.push('/benefits/manage')">配置权益包</el-button></PageHead>
  <el-tabs v-model="tab"><el-tab-pane label="用途列表" name="purposes"/><el-tab-pane label="关联分类" name="categories"/></el-tabs>
  <div class="toolbar"><el-input v-model="keyword" :placeholder="tab==='purposes'?'搜索用途名称':'搜索分类路径'" clearable/>
   <template v-if="tab==='purposes'"><el-button v-if="store.can('product:category:create')" type="primary" @click="editPurpose()">新增用途</el-button></template>
   <template v-else><el-select v-model="filter" aria-label="筛选分类用途"><el-option label="全部用途" value="all"/><el-option label="未配置" value="unset"/><el-option v-for="p in purposes" :key="p.id" :label="p.name" :value="p.id"/></el-select><el-button v-if="store.can('product:category:create')" type="primary" @click="editCategory()">新增分类</el-button><el-button @click="router.push({path:'/categories',query:{mode:'edit'}})">查看分类树</el-button></template>
  </div>
  <el-alert v-if="listError" :title="listError" type="error" :closable="false"/>
  <el-table v-if="tab==='purposes'" :data="purposeRows" row-key="id" empty-text="暂无用途，可新增用途">
   <el-table-column prop="name" label="用途名称"/><el-table-column label="业务规则"><template #default="{row}">{{behaviorNames[row.behavior as Behavior]}}</template></el-table-column>
   <el-table-column label="关联分类" width="130"><template #default="{row}"><el-button link @click="showCategories(row.id)">{{references(row.id).length}} 个分类</el-button></template></el-table-column>
   <el-table-column label="操作" width="330"><template #default="{row}"><el-button link @click="showCategories(row.id)">查看分类</el-button><el-button link :disabled="busy||!store.can('product:category:create')" @click="editCategory(undefined,row.id)">添加分类</el-button><el-button link :disabled="busy||!store.can('product:category:update')" @click="editPurpose(row)">编辑</el-button><el-tooltip :disabled="!references(row.id).length" content="已关联分类，请先解除或调整绑定"><span><el-button link type="danger" :disabled="busy||!store.can('product:category:delete')||!!references(row.id).length" @click="remove(row)">删除</el-button></span></el-tooltip></template></el-table-column>
  </el-table>
  <el-table v-else :data="categoryRows" row-key="id" empty-text="暂无关联分类，可新增分类或从分类管理中绑定">
   <el-table-column label="分类路径"><template #default="{row}">{{categoryPathLabel(store.data.categories,row.id)}}</template></el-table-column><el-table-column label="用途"><template #default="{row}">{{categoryPurposeLabel(store.data,row)}}</template></el-table-column><el-table-column label="状态" width="100"><template #default="{row}">{{row.enabled?'启用':'停用'}}</template></el-table-column><el-table-column label="操作" width="160"><template #default="{row}"><el-button link :disabled="busy||!store.can('product:category:update')" @click="editCategory(row)">编辑 / 绑定用途</el-button></template></el-table-column>
  </el-table>
  <el-dialog v-model="opened" :title="dialogTitle" width="520px" :before-close="close" :close-on-click-modal="false">
   <el-form label-position="top" :disabled="busy">
    <el-form-item :label="kind==='purpose'?'用途名称':'分类名称'" required><el-input v-model="draft.name" :maxlength="kind==='purpose'?40:80" aria-label="名称"/></el-form-item>
    <template v-if="kind==='purpose'"><el-form-item label="业务规则" required><el-select v-model="draft.behavior" aria-label="业务规则" :disabled="!!expected&&!!references(draft.id).length"><el-option v-for="(label,value) in behaviorNames" :key="value" :label="label" :value="value"/></el-select></el-form-item><p class="muted">主机用于选择设备；配件用于跨分类选配及适用性核验；其他用途不作为主机或配件。已关联分类后可改名，修改业务规则需先解除绑定。</p></template>
    <template v-else><el-form-item label="分类用途" required><el-select v-model="draft.purposeId" aria-label="分类用途" :clearable="!!expected" placeholder="请选择用途"><el-option v-for="p in purposes" :key="p.id" :label="p.name" :value="p.id"/></el-select></el-form-item><el-form-item v-if="!expected" label="上级分类"><el-select v-model="draft.parentId" clearable filterable placeholder="顶级分类" aria-label="上级分类"><el-option v-for="c in parentChoices" :key="c.id" :label="categoryPathLabel(store.data.categories,c.id)" :value="c.id"/></el-select></el-form-item><p class="muted">新增分类直接加入现有分类树。用途只绑定当前分类；清除绑定后沿用产品类型原有用途。</p></template>
   </el-form><el-alert v-if="error" :title="error" type="error" :closable="false"/>
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
import {categoryPurposes,categoryPurposeId,categoryPurposeLabel,purposeReferences} from '../domain/categoryPurposes'
import type {Category,CategoryPurpose} from '../domain/types'
type Behavior=CategoryPurpose['behavior']
const behaviorNames:Record<Behavior,string>={host:'主机 / 设备',accessory:'配件 / 增值服务',other:'其他用途'}
const store=useCatalogStore(),router=useRouter(),tab=ref('purposes'),filter=ref('all'),keyword=ref(''),opened=ref(false),busy=ref(false),error=ref(''),listError=ref(''),kind=ref<'purpose'|'category'>('purpose'),expected=ref<string|null>(null),initial=ref('')
const blank=()=>({id:'',name:'',behavior:'accessory' as Behavior,purposeId:'',parentId:''}),draft=ref(blank())
const purposes=computed(()=>categoryPurposes(store.data)),purposeRows=computed(()=>purposes.value.filter(p=>p.name.includes(keyword.value.trim())))
const references=(id:string)=>purposeReferences(store.data,id)
const categoryRows=computed(()=>store.data.categories.filter(c=>(filter.value==='all'||(categoryPurposeId(c)||'unset')===filter.value)&&categoryPathLabel(store.data.categories,c.id).includes(keyword.value.trim())))
const parentChoices=computed(()=>store.data.categories.filter(c=>!store.data.productTypes.some(t=>t.categoryId===c.id)))
const dialogTitle=computed(()=>`${expected.value?'编辑':'新增'}${kind.value==='purpose'?'用途':'分类'}`)
const dirty=computed(()=>opened.value&&JSON.stringify(draft.value)!==initial.value)
function start(){initial.value=JSON.stringify(draft.value);error.value='';opened.value=true}
function editPurpose(p?:CategoryPurpose){kind.value='purpose';expected.value=p?JSON.stringify(p):null;draft.value={...blank(),id:p?.id||crypto.randomUUID(),name:p?.name||'',behavior:p?.behavior||'accessory'};start()}
function editCategory(c?:Category,purposeId?:string){kind.value='category';expected.value=c?JSON.stringify(c):null;draft.value={...blank(),id:c?.id||crypto.randomUUID(),name:c?.name||'',parentId:c?.parentId||'',purposeId:c?categoryPurposeId(c):purposeId||(purposes.value.some(p=>p.id===filter.value)?filter.value:'')};start()}
function showCategories(id:string){tab.value='categories';filter.value=id;keyword.value=''}
async function discard(){if(busy.value)return false;if(!dirty.value)return true;try{await ElMessageBox.confirm('放弃未保存的修改？','未保存内容');return true}catch{return false}}
async function close(done:()=>void){if(await discard())done()}
const actor=()=>JSON.stringify([store.activeUserId,store.previewUserId])
async function save(){if(busy.value)return;const owner=actor();busy.value=true;error.value='';try{const d=draft.value;const result=kind.value==='purpose'?await store.saveCategoryPurpose({id:d.id,name:d.name,behavior:d.behavior},expected.value):await store.saveBoundCategory({id:d.id,name:d.name,purposeId:d.purposeId||'',parentId:d.parentId||null},expected.value);if(owner!==actor())return;if(!result.ok){error.value=result.message||'保存失败，输入已保留';return}opened.value=false;ElMessage.success('已保存')}catch(e){if(owner===actor())error.value=String(e)}finally{busy.value=false}}
async function remove(p:CategoryPurpose){const owner=actor(),stamp=JSON.stringify(p);try{await ElMessageBox.confirm(`删除用途“${p.name}”？`,'删除用途',{type:'warning'})}catch{return}if(owner!==actor()||busy.value)return;busy.value=true;listError.value='';try{const result=await store.removeCategoryPurpose(p.id,stamp);if(owner!==actor())return;if(!result.ok)listError.value=result.message||'删除失败';else ElMessage.success('用途已删除')}catch(e){if(owner===actor())listError.value=String(e)}finally{busy.value=false}}
watch(()=>[store.activeUserId,store.previewUserId],()=>{opened.value=false;error.value='';listError.value=''})
onBeforeRouteLeave(discard)
function unload(e:BeforeUnloadEvent){if(dirty.value||busy.value){e.preventDefault();e.returnValue=''}}
window.addEventListener('beforeunload',unload);onBeforeUnmount(()=>window.removeEventListener('beforeunload',unload))
</script>
<style scoped>.toolbar{display:flex;flex-wrap:wrap;gap:12px;margin:12px 0 20px}.toolbar .el-input{max-width:280px}.toolbar .el-select{width:220px}.muted{color:var(--el-text-color-secondary);line-height:1.6}</style>
