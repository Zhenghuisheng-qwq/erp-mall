<template>
 <div><PageHead title="权益包管理"><el-button v-if="returnTo" @click="router.push(returnTo)">返回来源</el-button><el-button v-if="store.can('product:type-bundle:create')" type="primary" data-new-bundle @click="edit()">新建权益包</el-button><el-button v-if="store.canRoute({path:'/benefits/shopping'})" @click="router.push('/benefits/shopping')">自由组合</el-button></PageHead>
 <el-alert v-if="route.query.model" :closable="false" type="info" title="从商品模型进入：编辑同一份类型组合，不绑定型号或发布版本。可在选购时选择设备预览。"/>
 <div class="workspace"><aside class="panel"><CatalogScopeTree :categories="store.data.categories" :types="index.typeRows" :category-id="category" :scope-type-id="typeId" :expanded-ids="expanded" @expand="expanded=$event" @select="category=$event;typeId=''" @select-type="typeId=$event;category=''"/></aside>
 <section class="panel"><h3>{{typeId?'包含所选产品类型的权益包':category?'当前归属分类的权益包':'全部权益包'}}</h3><el-empty v-if="!groups.length" description="暂无权益包，可以新建，也可以直接自由组合"/><el-table v-else :data="groups" row-key="id"><el-table-column label="名称"><template #default="{row}"><el-button link type="primary" :data-bundle-record="row.id" @click="edit(row)">{{row.name}}</el-button></template></el-table-column><el-table-column label="归属分类"><template #default="{row}">{{categoryName(row.categoryId)}}</template></el-table-column><el-table-column label="参与产品类型" min-width="230"><template #default="{row}">{{row.productTypeIds.map(typeName).join('、')}}</template></el-table-column><el-table-column label="状态" width="80"><template #default="{row}"><el-tag :type="row.enabled?'success':'info'">{{row.enabled?'启用':'停用'}}</el-tag></template></el-table-column><el-table-column label="操作" width="130"><template #default="{row}"><el-button link @click="edit(row)">查看 / 编辑</el-button><el-button v-if="row.enabled&&store.canRoute({path:'/benefits/shopping'})" link type="primary" @click="use(row.id)">使用</el-button></template></el-table-column></el-table></section></div>
 <el-dialog v-model="opened" title="权益包配置" width="min(900px,95vw)" :close-on-click-modal="false" :before-close="close"><el-form v-if="draft" label-position="top" :disabled="!editable||busy"><el-form-item label="权益包名称"><el-input v-model="draft.name" maxlength="80" aria-label="权益包名称"/></el-form-item><el-form-item label="归属分类"><el-select v-model="draft.categoryId" filterable aria-label="权益包归属分类"><el-option v-for="c in store.data.categories" :key="c.id" :value="c.id" :label="categoryName(c.id)"/></el-select></el-form-item><el-form-item label="参与组合的产品类型"><TypeSetPicker v-model="draft.productTypeIds" :data="store.data" :category-id="draft.categoryId" :disabled="!editable||busy"/></el-form-item><el-form-item label="启用"><el-switch v-model="draft.enabled"/></el-form-item><el-form-item label="排序"><el-input-number v-model="draft.sort" :min="-100000" :max="100000"/></el-form-item></el-form><el-alert v-if="error" :title="error" type="error" :closable="false"/><template #footer><el-button @click="close(()=>opened=false)">取消 / 关闭</el-button><el-button v-if="editable" type="primary" :loading="busy" data-save-bundle @click="save">保存权益包</el-button></template></el-dialog>
 </div>
</template>
<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {useRoute,useRouter,onBeforeRouteLeave} from 'vue-router'
import {ElMessage,ElMessageBox} from 'element-plus'
import PageHead from '../components/PageHead.vue'
import CatalogScopeTree from '../components/catalog-workspace/CatalogScopeTree.vue'
import TypeSetPicker from '../components/benefit-sales/TypeSetPicker.vue'
import {useCatalogStore} from '../stores/catalog'
import {buildCatalogWorkspaceIndex} from '../domain/catalogWorkspaceQuery'
import {categoryPathLabel} from '../domain/categoryTree'
import {compatibilityReturnLocation} from '../domain/compatibilityNavigation'
import {copy} from '../domain/benefitSales/commands'
import type {BenefitGroup,GroupInput} from '../domain/benefitSales/types'
const store=useCatalogStore(),route=useRoute(),router=useRouter(),category=ref(String(route.query.category||'')),typeId=ref(''),expanded=ref<string[]>([])
const index=computed(()=>buildCatalogWorkspaceIndex(store.data,store.can)),returnTo=computed(()=>compatibilityReturnLocation(route.query.returnTo))
const groups=computed(()=>(store.data.benefitTypeGroups||[]).filter(g=>typeId.value?g.productTypeIds.includes(typeId.value):!category.value||g.categoryId===category.value).slice().sort((a,b)=>a.sort-b.sort||a.name.localeCompare(b.name)))
const categoryName=(id:string)=>categoryPathLabel(store.data.categories,id)||'分类已失效',typeName=(id:string)=>store.data.productTypes.find(t=>t.id===id)?.name||'类型已失效'
const opened=ref(false),draft=ref<GroupInput>(),revision=ref(0),initial=ref(''),error=ref(''),busy=ref(false)
watch(()=>[store.activeUserId,store.previewUserId],()=>{opened.value=false;draft.value=undefined;error.value=''})
const editable=computed(()=>store.can(`product:type-bundle:${draft.value?.id?'update':'create'}`))
function edit(g?:BenefitGroup){draft.value=g?copy(g):{id:'',name:'',categoryId:category.value,productTypeIds:typeId.value?[typeId.value]:[],enabled:true,sort:0};revision.value=g?.revision||0;initial.value=JSON.stringify(draft.value);error.value='';opened.value=true}
async function discard(){if(!opened.value||JSON.stringify(draft.value)===initial.value)return true;try{await ElMessageBox.confirm('有未保存的配置，确定放弃本次修改？','保留或放弃修改',{confirmButtonText:'放弃修改',cancelButtonText:'继续编辑'});return true}catch{return false}}
async function close(done:()=>void){if(!busy.value&&await discard())done()}
onBeforeRouteLeave(async()=>!busy.value&&await discard())
async function save(){if(!draft.value||busy.value)return;busy.value=true;error.value='';const stamp=JSON.stringify(draft.value);try{const result=await store.saveTypeBundle(draft.value,revision.value,()=>JSON.stringify(draft.value)===stamp);if(!result.ok){error.value=result.message||'保存失败';return}opened.value=false;ElMessage.success('权益包已保存')}catch(e){error.value=String(e)}finally{busy.value=false}}
function use(id:string){router.push({path:'/benefits/shopping',query:{group:id,device:typeof route.query.device==='string'?route.query.device:undefined,model:typeof route.query.model==='string'?route.query.model:undefined,version:typeof route.query.version==='string'?route.query.version:undefined,node:typeof route.query.node==='string'?route.query.node:undefined,returnTo:route.fullPath}})}
</script>
<style scoped>.workspace{display:grid;grid-template-columns:270px minmax(0,1fr);gap:16px;margin-top:16px}.panel{padding:16px;min-width:0}.el-form-item :deep(.type-picker){width:100%}@media(max-width:850px){.workspace{grid-template-columns:1fr}}</style>
