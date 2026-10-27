<template>
  <section data-catalog-models>
    <el-alert v-if="error" :title="error" type="error" :closable="false"/>
    <RuleExplanation v-if="publishFailure" :failure="publishFailure" :supported-recovery="[]"/>
    <el-table :data="pageRows" row-key="id" highlight-current-row :current-row-key="prefs.selectedId" @current-change="selectRow" @header-dragend="resizeColumn" data-catalog-model-table>
      <el-table-column prop="name" label="模型名称" :width="narrow?150:width('name',190)" fixed="left"><template #default="{row}"><button class="record-name" :data-catalog-model="row.id" @click="viewModel(row.id)">{{row.name}}</button><small>{{row.id}}</small></template></el-table-column>
      <el-table-column v-if="visible('type')" prop="type" label="产品类型" :min-width="width('type',145)"><template #default="{row}">{{row.typeName || '未记录'}}</template></el-table-column>
      <el-table-column v-if="visible('category')" prop="category" label="分类路径" :min-width="width('category',180)" show-overflow-tooltip><template #default="{row}">{{row.categoryPaths.join('；') || '未记录'}}</template></el-table-column>
      <el-table-column v-if="visible('status')" prop="status" label="当前工作状态" :min-width="width('status',170)"><template #default="{row}"><el-tag :type="row.status==='offline'?'info':row.status==='published'?'success':'warning'">{{row.statusText}}</el-tag></template></el-table-column>
      <el-table-column v-if="visible('version')" prop="version" label="最近发布版本" :width="width('version',135)"><template #default="{row}"><button v-if="row.latestPublishedVersion" class="metric" @click="viewModel(row.id,row.latestPublishedVersion.id)">{{row.latestPublishedVersion.versionName||`V${row.latestPublishedVersion.version}`}}</button><span v-else class="muted">尚未发布</span></template></el-table-column>
      <el-table-column v-for="kind in visibleMetrics" :key="kind" :prop="kind" :label="metricLabels[kind]" :width="width(kind,105)"><template #default="{row}"><button v-if="row.metrics[kind].readable" class="metric" @click="showMetric(row,kind)">{{row.metrics[kind].count}}</button><span v-else class="muted">不可查看</span></template></el-table-column>
      <el-table-column v-if="visible('updated')" prop="updated" label="最近维护" :width="width('updated',160)"><template #default="{row}">{{row.updatedAt ? row.updatedAt.slice(0,16).replace('T',' ') : '未记录'}}</template></el-table-column>
      <el-table-column label="操作" width="190" :fixed="narrow?false:'right'"><template #default="{row}"><el-button link type="primary" @click="viewModel(row.id)">查看</el-button><el-button v-if="canDesign" link @click="design(row.id)">设计</el-button><el-dropdown v-if="canMaintain" trigger="click" @command="command($event,row)"><el-button link :disabled="saving" :aria-label="`${row.name}的更多操作`">更多 ▾</el-button><template #dropdown><el-dropdown-menu><el-dropdown-item v-if="store.can('product:model:create')" command="copy">复制模型</el-dropdown-item><el-dropdown-item v-if="store.can('product:model:publish')" command="publish">发布当前草稿</el-dropdown-item><el-dropdown-item v-if="store.can('product:model:update')" command="offline" :disabled="!row.hasCanvas||row.status==='offline'">下线模型</el-dropdown-item></el-dropdown-menu></template></el-dropdown></template></el-table-column>
    </el-table>
    <div class="ledger-footer"><span class="muted">当前筛选 {{filtered.length}} 个模型 · 版本单独计数</span><el-pagination small layout="prev, pager, next" :total="filtered.length" :page-size="prefs.pageSize" :current-page="currentPage" @current-change="(page:number)=>update({page})"/></div>
    <el-drawer :model-value="createOpen" title="新建模型" size="min(500px,96vw)" :before-close="closeCreate" :close-on-click-modal="false" data-catalog-model-form>
      <el-form label-position="top" :disabled="saving"><el-form-item label="分类"><CategoryTreeSelect v-if="store.can('product:category:read')" :model-value="draft.categoryId" :categories="store.data.categories" leaf-only placeholder="选择产品类型关联的末级分类" @update:model-value="changeCategory"/><el-input v-else model-value="不可查看分类" disabled/></el-form-item><el-form-item label="产品类型"><el-select v-if="store.can('product:type:read')" v-model="draft.productTypeId" placeholder="选择真实产品类型" aria-label="模型产品类型"><el-option v-for="item in typeOptions" :key="item.id" :value="item.id" :label="`${item.name} · ${item.id}`" :disabled="item.status==='disabled'"/></el-select><el-input v-else model-value="不可查看产品类型" disabled/></el-form-item><p v-if="draft.categoryId&&!typeOptions.length" class="muted">此分类没有可选产品类型，请先选择已关联类型的末级分类。</p><el-form-item label="模型名称"><el-input v-model="draft.name" aria-label="模型名称"/></el-form-item></el-form><el-alert v-if="createError" :title="createError" type="error" :closable="false"/>
      <template #footer><el-button :disabled="saving" @click="closeCreate()">取消</el-button><el-button type="primary" :loading="saving" :disabled="!store.can('product:model:create')||!store.can('product:type:read')" @click="create">{{createError?'重试创建':'创建模型'}}</el-button></template>
    </el-drawer>
  </section>
</template>
<script setup lang="ts">
import {computed,onBeforeUnmount,onMounted,reactive,ref,watch} from 'vue'
import {onBeforeRouteLeave,useRouter} from 'vue-router'
import {ElMessage,ElMessageBox} from 'element-plus'
import {useCatalogStore} from '../../stores/catalog'
import type {CatalogWorkspaceIndex,CatalogScopeResult,CatalogMetricKind,CatalogModelRow} from '../../domain/catalogWorkspaceQuery'
import type {CatalogViewPreferences} from './catalogWorkspaceState'
import {getFailure} from '../../domain/guide/failure'
import type {GuideFailure} from '../../domain/guide/types'
import RuleExplanation from '../guide/RuleExplanation.vue'
import CategoryTreeSelect from '../CategoryTreeSelect.vue'
const props=defineProps<{index:CatalogWorkspaceIndex;summary:CatalogScopeResult;prefs:CatalogViewPreferences;categoryId:string;returnTo:string}>()
const emit=defineEmits<{'update:prefs':[CatalogViewPreferences];details:[{kind:CatalogMetricKind;ids:string[];title:string}];model:[string,string?]}>()
const store=useCatalogStore(),router=useRouter(),saving=ref(false),error=ref(''),createOpen=ref(false),createError=ref(''),publishFailure=ref<GuideFailure>()
const draft=reactive({categoryId:'',productTypeId:'',name:''});let baseline='',alive=true
const narrow=ref(typeof window!=='undefined'&&window.innerWidth<700)
function resizeViewport(){narrow.value=window.innerWidth<700}
onMounted(()=>window.addEventListener('resize',resizeViewport))
onBeforeUnmount(()=>window.removeEventListener('resize',resizeViewport))
const metricLabels={spus:'SPU 数',skus:'销售 SKU 数',materials:'MAT 数'}
const canDesign=computed(()=>store.can('product:model:update')&&store.canRoute({path:'/specs'})),canMaintain=computed(()=>store.can('product:model:create')||store.can('product:model:publish')||store.can('product:model:update'))
const visible=(key:string)=>props.prefs.columns.includes(key),width=(key:string,fallback:number)=>props.prefs.widths[key]||fallback
const visibleMetrics=computed(()=>(['spus','skus','materials'] as const).filter(visible))
const filtered=computed(()=>{const ids=new Set(props.summary.metrics.models.ids),kw=props.prefs.keyword.trim().toLowerCase();return props.index.modelRows.filter(row=>ids.has(row.id)&&(!kw||`${row.name} ${row.id} ${row.typeName} ${row.productTypeId} ${row.categoryPaths.join(' ')}`.toLowerCase().includes(kw))&&(!props.prefs.status||row.status===props.prefs.status)).sort((a,b)=>props.prefs.sort==='updated'?b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id):props.prefs.sort==='status'?a.status.localeCompare(b.status)||a.name.localeCompare(b.name,'zh'):props.prefs.sort==='name-desc'?b.name.localeCompare(a.name,'zh'):a.name.localeCompare(b.name,'zh')||a.id.localeCompare(b.id))})
const currentPage=computed(()=>Math.min(Math.max(1,props.prefs.page),Math.max(1,Math.ceil(filtered.value.length/props.prefs.pageSize))))
const pageRows=computed(()=>filtered.value.slice((currentPage.value-1)*props.prefs.pageSize,currentPage.value*props.prefs.pageSize))
const typeOptions=computed(()=>store.can('product:type:read')?store.data.productTypes.filter(item=>!draft.categoryId||item.categoryId===draft.categoryId):[])
function update(patch:Partial<CatalogViewPreferences>){emit('update:prefs',{...props.prefs,...patch})}
function selectRow(row?:CatalogModelRow){if(row)update({selectedId:row.id})}
function resizeColumn(size:number,_old:number,column:{property:string}){if(column.property)update({widths:{...props.prefs.widths,[column.property]:size}})}
function viewModel(id:string,version?:string){update({selectedId:id});emit('model',id,version)}
function showMetric(row:CatalogModelRow,kind:'spus'|'skus'|'materials'){const metric=row.metrics[kind];if(metric.readable)emit('details',{kind,ids:[...metric.ids],title:`${row.name} · ${metricLabels[kind]}`})}
function design(id:string){if(canDesign.value)router.push({path:'/specs',query:{template:id,returnTo:props.returnTo}})}
function openCreate(){if(!store.can('product:model:create'))return;draft.categoryId=store.can('product:category:read')?props.categoryId:'';draft.productTypeId='';draft.name='';createError.value='';baseline=JSON.stringify(draft);createOpen.value=true}
function changeCategory(value:string|string[]){if(typeof value!=='string')return;draft.categoryId=value;draft.productTypeId=''}
async function canLeave(){if(saving.value)return false;if(!createOpen.value||JSON.stringify(draft)===baseline&&!createError.value)return true;try{await ElMessageBox.confirm('模型还有未保存输入，放弃后离开？','未保存模型',{confirmButtonText:'放弃输入',cancelButtonText:'继续编辑'});return true}catch{return false}}
async function closeCreate(done?:()=>void){if(!await canLeave())return;createOpen.value=false;createError.value='';done?.()}
async function create(){if(saving.value)return;const actor=store.activeUserId,preview=store.previewUserId;const current=()=>alive&&createOpen.value&&actor===store.activeUserId&&preview===store.previewUserId;saving.value=true;createError.value='';try{const result=await store.createProductModel({productTypeId:draft.productTypeId,name:draft.name});if(!current())return;if(!result.ok){createError.value=result.message||'创建失败，输入已保留。';return}createOpen.value=false;emit('model',result.templateId);ElMessage.success('模型已创建，可先查看资料，再进入设计')}catch(cause){if(current())createError.value=cause instanceof Error?cause.message:'创建失败，输入已保留。'}finally{saving.value=false}}
async function command(action:string,row:CatalogModelRow){if(saving.value)return;const actor=store.activeUserId,preview=store.previewUserId,current=()=>alive&&actor===store.activeUserId&&preview===store.previewUserId;const title=action==='copy'?'复制模型':action==='publish'?'发布当前草稿':'下线模型';try{await ElMessageBox.confirm(action==='copy'?`复制「${row.name}」为新草稿？商品与发布历史保持原样。`:action==='publish'?`发布「${row.name}」当前草稿？仍需通过现有模型及适用关系检查。`:`下线「${row.name}」？历史商品和发布快照保持原样。`,title,{type:'warning'})}catch{return}if(!current())return;saving.value=true;error.value='';publishFailure.value=undefined;try{const result=action==='copy'?await store.copyProductModel(row.id):action==='publish'?await store.publishSpecModel(row.id):await store.setProductModelStatus(row.id,'offline',row.updatedAt,current);if(!current())return;if(action==='publish')publishFailure.value=getFailure(result);if(!result.ok){error.value=result.message||`${title}失败，请核对后重试。`;return}ElMessage.success(('message' in result?result.message:'')||`${title}完成`)}catch(cause){if(current())error.value=cause instanceof Error?cause.message:`${title}失败`}finally{saving.value=false}}
watch(()=>[store.activeUserId,store.previewUserId,store.can('product:model:read')],()=>{createOpen.value=false;createError.value='';error.value='';publishFailure.value=undefined;Object.assign(draft,{categoryId:'',productTypeId:'',name:''})})
onBeforeRouteLeave(canLeave);onBeforeUnmount(()=>{alive=false})
function acceptContextChange(){createOpen.value=false;createError.value=''}
defineExpose({openCreate,canLeave,acceptContextChange})
</script>
<style scoped>
.record-name,.metric{border:0;background:none;color:var(--el-color-primary);cursor:pointer;padding:3px 0;text-align:left;font:inherit}.record-name:focus-visible,.metric:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:3px}.record-name{font-weight:600}small{display:block;color:var(--el-text-color-secondary);font-size:11px;overflow-wrap:anywhere}.muted{color:var(--el-text-color-secondary);font-size:12px}.ledger-footer{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-top:14px}:deep(.el-alert){margin-bottom:10px}
</style>
