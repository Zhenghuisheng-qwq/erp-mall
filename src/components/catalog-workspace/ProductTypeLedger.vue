<template>
  <section data-catalog-types>
    <el-alert v-if="operationError" :title="operationError" type="error" :closable="false"><el-button link @click="retryPersistence">重试保存</el-button></el-alert>
    <el-empty v-if="!filtered.length" description="当前范围内没有符合关键词或状态的产品类型，请调整筛选。"/>
    <el-table :data="pageRows" row-key="id" highlight-current-row :current-row-key="prefs.selectedId" @current-change="selectRow" @header-dragend="resizeColumn" data-catalog-type-table>
      <el-table-column prop="name" label="产品类型名称" :width="narrow?150:width('name',190)" fixed="left"><template #default="{row}"><button class="record-name" :data-catalog-type="row.id" @click="requestDetail(row.id)">{{row.name}}</button><small>{{row.id}}</small></template></el-table-column>
      <el-table-column v-if="visible('category')" prop="category" label="明确关联分类" :min-width="width('category',190)"><template #default="{row}"><span :title="row.categoryPaths.join('；')">{{store.can('product:category:read') ? row.categoryPaths.join('；') || '未关联分类' : '不可查看'}}</span></template></el-table-column>
      <el-table-column v-if="visible('models')" prop="models" label="模型数" :width="width('models',95)"><template #default="{row}"><button v-if="row.metrics.models.readable" class="metric" @click="showMetric(row,'models')">{{row.metrics.models.count}}</button><span v-else class="muted">不可查看</span></template></el-table-column>
      <el-table-column v-if="visible('status')" prop="status" label="状态" :width="width('status',100)"><template #default="{row}"><el-tag :type="row.status==='enabled'?'success':'info'">{{row.status==='enabled'?'启用':'停用'}}</el-tag></template></el-table-column>
      <el-table-column v-if="visible('catalogRole')" prop="catalogRole" label="业务用途" :width="width('catalogRole',120)"><template #default="{row}"><el-tag type="info">{{productTypePurposeLabel(store.data.productTypes.find(item=>item.id===row.id)?.catalogRole)}}</el-tag></template></el-table-column>
      <el-table-column v-if="visible('description')" prop="description" label="简短说明" :min-width="width('description',180)" show-overflow-tooltip/>
      <el-table-column v-for="kind in optionalMetrics" :key="kind" :prop="kind" :label="metricLabels[kind]" :width="width(kind,105)"><template #default="{row}"><button v-if="row.metrics[kind].readable" class="metric" @click="showMetric(row,kind)">{{row.metrics[kind].count}}</button><span v-else class="muted">不可查看</span></template></el-table-column>
      <el-table-column label="操作" width="145" :fixed="narrow?false:'right'"><template #default="{row}"><el-button link type="primary" @click="requestDetail(row.id)">查看</el-button><el-dropdown v-if="canMaintain" trigger="click" @command="command($event,row.id)"><el-button link :disabled="saving" :aria-label="`${row.name}的更多操作`">更多 ▾</el-button><template #dropdown><el-dropdown-menu><el-dropdown-item v-if="store.can('product:type:update')" command="edit">编辑</el-dropdown-item><el-dropdown-item v-if="store.can('product:type:update')" command="status">{{row.status==='enabled'?'停用':'启用'}}</el-dropdown-item><el-dropdown-item v-if="store.can('product:type:delete')" command="delete" divided>删除</el-dropdown-item></el-dropdown-menu></template></el-dropdown></template></el-table-column>
    </el-table>
    <div class="ledger-footer"><span class="muted">当前筛选 {{filtered.length}} 个产品类型</span><el-pagination small layout="prev, pager, next" :total="filtered.length" :page-size="prefs.pageSize" :current-page="currentPage" @current-change="(page:number)=>update({page})"/></div>
    <el-dialog class="catalog-type-dialog" :model-value="!!detailId&&!suspended" title="产品类型详情" width="min(720px, calc(100vw - 32px))" align-center append-to-body @close="closeDetail" data-catalog-type-detail>
      <template v-if="detail"><h2>{{detail.name}}</h2><p class="muted">{{detail.id}} · {{detail.status==='enabled'?'启用':'停用'}}</p><p>{{detail.description || '说明未记录'}}</p><h3>关联分类</h3><p>{{store.can('product:category:read')?detail.categoryPaths.join('；')||'未关联分类':'不可查看'}}</p><h3>模型列表</h3><ul v-if="detail.metrics.models.readable && detailModels.length" class="record-list"><li v-for="model in detailModels" :key="model.id"><button class="record-name" @click="emit('model',model.id)">{{model.name}}</button><span class="muted">{{model.statusText}}</span></li></ul><p v-else class="muted">{{detail.metrics.models.readable?'尚无模型，可按实际需要创建':'不可查看'}}</p><h3>相关记录</h3><div class="detail-metrics"><template v-for="kind in ['spus','skus','materials','pending'] as const" :key="kind"><button v-if="detail.metrics[kind].readable" class="metric" @click="showMetric(detail,kind)">{{metricLabels[kind]}} {{detail.metrics[kind].count}}</button><span v-else class="muted">{{metricLabels[kind]}} 不可查看</span></template></div><p class="muted">商品按已记录的创建来源关联，不根据当前分类推测历史归属。</p><el-button v-if="store.can('product:type:update')" @click="openEdit(detail.id)">编辑产品类型</el-button></template>
      <p v-if="detail" data-type-purpose>业务用途：{{productTypePurposeLabel(store.data.productTypes.find(item=>item.id===detail?.id)?.catalogRole)}}</p>
      <el-empty v-else description="产品类型已不存在或不可读取"/>
    </el-dialog>
    <el-dialog class="catalog-type-dialog" :model-value="formOpen" :title="editing.id?'编辑产品类型':'新增产品类型'" width="min(560px, calc(100vw - 32px))" align-center append-to-body :before-close="closeForm" :close-on-click-modal="false" data-catalog-type-form>
      <el-form label-position="top" :disabled="saving">
        <el-form-item label="业务用途"><el-select v-model="editing.catalogRole" aria-label="产品类型业务用途"><el-option v-for="item in productTypePurposes" :key="item.value" :value="item.value" :label="item.label"/></el-select><p class="hint">主机／设备（如手机、平板）反查配件；配件（如手机壳、保护膜）配置适用机型。其他不提供这两种入口，未指定可稍后维护。</p></el-form-item>
        <el-form-item label="关联分类"><CategoryTreeSelect v-if="store.can('product:category:read')" :model-value="editing.categoryId" :categories="store.data.categories" :block-reason="categoryBlock" placeholder="选择可用的末级分类" @update:model-value="setCategory"/><el-input v-else model-value="不可查看分类，请联系有分类读取权限的人员维护" disabled/></el-form-item>
        <p v-if="categoryHint" class="hint" data-catalog-type-category-hint>{{categoryHint}}</p><p v-if="moveHint" class="error">{{moveHint}}</p>
        <el-form-item label="产品类型名称"><el-input v-model="editing.name" aria-label="产品类型名称"/></el-form-item><el-form-item label="说明"><el-input v-model="editing.description" type="textarea" aria-label="产品类型说明"/></el-form-item><el-form-item label="排序"><el-input-number v-model="editing.sort" :min="1"/></el-form-item><el-form-item label="状态"><el-select v-model="editing.status" aria-label="产品类型状态"><el-option value="enabled" label="启用"/><el-option value="disabled" label="停用"/></el-select></el-form-item>
      </el-form><el-alert v-if="formError" :title="formError" type="error" :closable="false"/>
      <template #footer><el-button :disabled="saving" @click="closeForm()">取消</el-button><el-button type="primary" :loading="saving" :disabled="!store.can(editing.id?'product:type:update':'product:type:create') || !store.can('product:category:read')" @click="saveType">{{formError?'重试保存':'保存'}}</el-button></template>
    </el-dialog>
  </section>
</template>
<script setup lang="ts">
import {computed,onBeforeUnmount,onMounted,reactive,ref,watch} from 'vue'
import {onBeforeRouteLeave} from 'vue-router'
import {ElMessage,ElMessageBox} from 'element-plus'
import {useCatalogStore} from '../../stores/catalog'
import {productTypeCategoryMoveMessage} from '../../domain/categoryTree'
import type {CatalogWorkspaceIndex,CatalogScopeResult,CatalogMetricKind,CatalogTypeRow} from '../../domain/catalogWorkspaceQuery'
import type {CatalogViewPreferences} from './catalogWorkspaceState'
import CategoryTreeSelect from '../CategoryTreeSelect.vue'
import {productTypePurposes,productTypePurposeLabel} from '../../domain/productTypePurpose'
import type {ProductType} from '../../domain/types'
const props=defineProps<{index:CatalogWorkspaceIndex;summary:CatalogScopeResult;prefs:CatalogViewPreferences;categoryId:string;returnTo:string;suspended?:boolean}>()
const emit=defineEmits<{'update:prefs':[CatalogViewPreferences];details:[{kind:CatalogMetricKind;ids:string[];title:string}];model:[string];type:[string]}>()
const store=useCatalogStore(),detailId=ref(''),formOpen=ref(false),saving=ref(false),formError=ref(''),operationError=ref('')
const editing=reactive({id:'',categoryId:'',name:'',description:'',sort:1,status:'enabled' as 'enabled'|'disabled',catalogRole:'' as NonNullable<ProductType['catalogRole']>|''})
let baseline='',expectedRecord='',alive=true
let pendingAction:{id:string;action:'delete'|'enabled'|'disabled';expected:string;actor:string;preview:string}|undefined
const narrow=ref(typeof window!=='undefined'&&window.innerWidth<700)
function resizeViewport(){narrow.value=window.innerWidth<700}
onMounted(()=>window.addEventListener('resize',resizeViewport))
onBeforeUnmount(()=>window.removeEventListener('resize',resizeViewport))
const metricLabels={types:'产品类型',models:'模型',spus:'SPU',skus:'销售 SKU',materials:'MAT',pending:'待处理'}
const canMaintain=computed(()=>store.can('product:type:update')||store.can('product:type:delete'))
const visible=(key:string)=>props.prefs.columns.includes(key),width=(key:string,fallback:number)=>props.prefs.widths[key]||fallback
const optionalMetrics=computed(()=>(['spus','skus','materials'] as const).filter(visible))
const filtered=computed(()=>{const ids=new Set(props.summary.metrics.types.ids),kw=props.prefs.keyword.trim().toLowerCase();return props.index.typeRows.filter(row=>ids.has(row.id)&&(!kw||`${row.name} ${row.id}`.toLowerCase().includes(kw))&&(!props.prefs.status||row.status===props.prefs.status)).sort((a,b)=>props.prefs.sort==='status'?a.status.localeCompare(b.status)||a.name.localeCompare(b.name,'zh'):props.prefs.sort==='name-desc'?b.name.localeCompare(a.name,'zh'):a.name.localeCompare(b.name,'zh')||a.id.localeCompare(b.id))})
const currentPage=computed(()=>Math.min(Math.max(1,props.prefs.page),Math.max(1,Math.ceil(filtered.value.length/props.prefs.pageSize))))
const pageRows=computed(()=>filtered.value.slice((currentPage.value-1)*props.prefs.pageSize,currentPage.value*props.prefs.pageSize))
const detail=computed(()=>props.index.typeRows.find(row=>row.id===detailId.value)),detailModels=computed(()=>props.index.modelRows.filter(row=>detail.value?.metrics.models.ids.includes(row.id)))
const categoryHint=computed(()=>editing.categoryId?categoryBlock(editing.categoryId):'请选择实际关联的末级分类；父分类仅用于汇总。')
const moveHint=computed(()=>editing.id&&editing.categoryId?productTypeCategoryMoveMessage(store.data,editing.id,editing.categoryId,props.index.typeRows.find(row=>row.id===editing.id)?.categoryPaths[0]||editing.categoryId):'')
function update(patch:Partial<CatalogViewPreferences>){emit('update:prefs',{...props.prefs,...patch})}
function selectRow(row?:CatalogTypeRow){if(row)update({selectedId:row.id})}
function resizeColumn(size:number,_old:number,column:{property:string}){if(column.property)update({widths:{...props.prefs.widths,[column.property]:size}})}
function showMetric(row:CatalogTypeRow,kind:CatalogMetricKind){const metric=row.metrics[kind];if(metric.readable)emit('details',{kind,ids:[...metric.ids],title:`${row.name} · ${metricLabels[kind]}`})}
function requestDetail(id:string){update({selectedId:id});emit('type',id);openDetail(id)}
function openDetail(id:string){detailId.value=store.can('product:type:read')?id:''}
function closeDetail(){if(props.suspended)return;detailId.value='';emit('type','')}
function categoryBlock(id:string){const row=store.data.categories.find(item=>item.id===id);return !row?'分类已不存在':row.enabled===false?'此分类已停用':store.data.categories.some(item=>item.parentId===id)?'请选择末级分类；父分类不能直接关联产品类型。':''}
function setCategory(value:string|string[]){if(typeof value==='string')editing.categoryId=value}
function beginForm(){expectedRecord=editing.id?JSON.stringify(store.data.productTypes.find(row=>row.id===editing.id)):'';baseline=JSON.stringify(editing);formError.value='';formOpen.value=true}
function openCreate(){if(!store.can('product:type:create'))return;const id=store.can('product:category:read')?props.categoryId:'';Object.assign(editing,{id:'',categoryId:id,name:'',description:'',sort:store.productTypesOf(id).reduce((max,item)=>Math.max(max,item.sort),0)+1,status:'enabled',catalogRole:''});beginForm()}
function openEdit(id:string){if(!store.can('product:type:update'))return;const row=store.data.productTypes.find(item=>item.id===id);if(!row)return;Object.assign(editing,{id:row.id,categoryId:row.categoryId,name:row.name,description:row.description,sort:row.sort,status:row.status,catalogRole:row.catalogRole||''});beginForm()}
async function canLeave(){if(saving.value)return false;if(!formOpen.value||JSON.stringify(editing)===baseline&&!formError.value)return true;try{await ElMessageBox.confirm('产品类型还有未保存输入，放弃后离开？','未保存产品类型',{confirmButtonText:'放弃输入',cancelButtonText:'继续编辑'});return true}catch{return false}}
async function closeForm(done?:()=>void){if(!await canLeave())return;formOpen.value=false;formError.value='';done?.()}
async function saveType(){
  if(saving.value)return
  const actor=store.activeUserId,preview=store.previewUserId,current=()=>alive&&formOpen.value&&actor===store.activeUserId&&preview===store.previewUserId
  saving.value=true;formError.value=''
  try{const saved=await store.commitProductType({...editing,catalogRole:editing.catalogRole||undefined},expectedRecord,current);if(!current())return;if(!saved.ok){formError.value=saved.message||'保存失败，输入已保留，请重试。';return}baseline=JSON.stringify(editing);formOpen.value=false;ElMessage.success('产品类型已保存')}
  catch(error){if(current())formError.value=error instanceof Error?error.message:'保存失败，输入已保留。'}finally{saving.value=false}
}
async function command(action:string,id:string){
  if(action==='edit'){openEdit(id);return}if(saving.value)return
  const row=store.data.productTypes.find(item=>item.id===id);if(!row)return
  const actor=store.activeUserId,preview=store.previewUserId,expected=JSON.stringify(row),status=row.status==='enabled'?'disabled':'enabled'
  try{await ElMessageBox.confirm(action==='delete'?`删除产品类型「${row.name}」？已被模型或历史数据引用的类型不能删除。`:`${row.status==='enabled'?'停用':'启用'}产品类型「${row.name}」？`,action==='delete'?'删除产品类型':'调整类型状态',{type:'warning'})}catch{return}
  if(actor!==store.activeUserId||preview!==store.previewUserId||!alive)return
  pendingAction={id,action:action==='delete'?'delete':status,expected,actor,preview};await retryPersistence()
}
async function retryPersistence(){
  if(saving.value||!pendingAction)return
  const task=pendingAction,current=()=>alive&&task===pendingAction&&task.actor===store.activeUserId&&task.preview===store.previewUserId
  saving.value=true;operationError.value=''
  try{const result=await store.commitProductTypeAction(task.id,task.action,task.expected,current);if(!current())return;if(!result.ok){operationError.value=result.message||'保存失败，原数据未改变，请重试。';return}pendingAction=undefined;ElMessage.success(result.message||'已保存')}
  catch(error){if(current())operationError.value=error instanceof Error?error.message:'操作失败'}finally{saving.value=false}
}
watch(()=>[store.activeUserId,store.previewUserId,store.can('product:type:read')],()=>{pendingAction=undefined;detailId.value='';formOpen.value=false;formError.value='';operationError.value='';Object.assign(editing,{id:'',categoryId:'',name:'',description:'',sort:1,status:'enabled',catalogRole:''})})
onBeforeRouteLeave(canLeave);onBeforeUnmount(()=>{alive=false})
function acceptContextChange(){formOpen.value=false;formError.value=''}
defineExpose({openCreate,openDetail,canLeave,acceptContextChange})
</script>
<style scoped>
.record-name,.metric{border:0;background:none;color:var(--el-color-primary);cursor:pointer;padding:3px 0;text-align:left;font:inherit}.record-name:focus-visible,.metric:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:3px}.record-name{font-weight:600}small{display:block;color:var(--el-text-color-secondary);font-size:11px;overflow-wrap:anywhere}.muted{color:var(--el-text-color-secondary);font-size:12px}.ledger-footer,.detail-metrics{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-top:14px}.detail-metrics{justify-content:flex-start}.record-list{padding:0;list-style:none}.record-list li{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--el-border-color-lighter)}.hint{color:var(--el-text-color-secondary);font-size:13px}.error{color:var(--el-color-danger);font-size:13px}h2{margin-top:0}h3{font-size:14px;margin-top:24px}:deep(.el-drawer__body){overflow-wrap:anywhere}
</style>
<style>
.catalog-type-dialog.el-dialog{max-height:min(760px,calc(100vh - 48px));display:flex;flex-direction:column}
.catalog-type-dialog .el-dialog__body{overflow:auto;overflow-wrap:anywhere}
</style>
