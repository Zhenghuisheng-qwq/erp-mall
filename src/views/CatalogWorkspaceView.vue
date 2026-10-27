<template>
  <div class="catalog-workspace" data-catalog-workspace>
    <PageHead title="商品资料管理">
      <el-button v-if="view==='categories' && store.can('product:category:read')" data-catalog-organize @click="organize">整理分类</el-button>
      <el-button v-if="view==='types' && store.can('product:type:create')" type="primary" data-catalog-create-type @click="typeLedger?.openCreate()">新增产品类型</el-button>
      <el-button v-if="view==='models' && store.can('product:model:create')" type="primary" data-catalog-create-model @click="modelLedger?.openCreate()">新建模型</el-button>
    </PageHead>
    <nav class="view-tabs" aria-label="商品资料视图"><button v-for="item in allowedViews" :key="item" type="button" :data-catalog-view="item" :aria-current="view===item?'page':undefined" @click="switchView(item)">{{viewLabels[item]}}</button></nav>
    <el-alert v-if="viewError" :title="viewError" type="error" :closable="false" data-catalog-view-error />
    <template v-else-if="view">
      <div class="workspace-toolbar">
        <el-button v-if="view!=='categories' && store.can('product:category:read')" :aria-expanded="narrow?categoryDrawer:preferences.sidebar" @click="toggleCategory">{{!narrow&&preferences.sidebar?'收起分类':'分类范围'}}</el-button>
        <span class="scope-label" :title="scopeLabel" data-catalog-scope>{{scopeLabel}}</span>
        <el-button v-if="categoryId" link @click="pickCategory('')">全部分类</el-button>
        <el-radio-group :model-value="scopeMode" size="small" aria-label="统计分类范围" @change="changeScope(String($event))"><el-radio-button value="current">仅本级</el-radio-button><el-radio-button value="with-children">包含下级</el-radio-button></el-radio-group>
      </div>
      <el-alert v-if="!summary.valid" :title="summary.message" type="warning" :closable="false" data-catalog-invalid-scope />
      <div v-if="summary.valid" class="scope-totals" aria-label="当前分类范围汇总" data-catalog-totals><template v-for="kind in metricKinds" :key="kind"><button v-if="summary.metrics[kind].readable" type="button" :data-catalog-total="kind" :title="kind==='spus'?CATALOG_SPU_DEFINITION:undefined" @click="showMetric(kind,summary.metrics[kind],`${scopeLabel} · ${metricLabels[kind]}`)">{{metricLabels[kind]}} <strong>{{summary.metrics[kind].count}}</strong></button><span v-else>{{metricLabels[kind]}} <span class="muted">不可查看</span></span></template></div>
      <div class="query-toolbar">
        <el-input :model-value="prefs.keyword" clearable :placeholder="searchPlaceholder" :aria-label="searchPlaceholder" @update:model-value="changePreference({keyword:String($event),page:1})" />
        <el-select :model-value="prefs.status" clearable placeholder="全部状态" aria-label="资料状态" @update:model-value="changePreference({status:String($event||''),page:1})"><el-option v-for="option in statusOptions" :key="option.value" :label="option.label" :value="option.value" /></el-select>
        <el-select :model-value="prefs.sort" aria-label="资料排序" @update:model-value="changePreference({sort:String($event),page:1})"><el-option label="名称升序" value="name"/><el-option label="名称降序" value="name-desc"/><el-option label="状态" value="status"/><el-option v-if="view==='models'" label="最近维护" value="updated"/></el-select>
        <div class="query-tools">
          <el-segmented v-if="view==='categories'" :model-value="prefs.categoryLayout" size="small" aria-label="分类汇总展示方式" :options="categoryLayoutOptions" @change="setCategoryLayout" />
          <el-button v-if="view==='categories' && prefs.categoryLayout!=='list'" data-catalog-expand-all @click="setTreeExpansion(true)">展开全部</el-button>
          <el-button v-if="view==='categories' && prefs.categoryLayout!=='list'" data-catalog-collapse-all @click="setTreeExpansion(false)">收起全部</el-button>
          <el-popover trigger="click" width="230" placement="bottom-end"><template #reference><el-button>列表设置</el-button></template><div class="column-options"><strong>显示列</strong><el-checkbox v-for="column in catalogColumns[view]" :key="column.key" :model-value="prefs.columns.includes(column.key)" :disabled="column.required" @change="setColumn(column.key,!!$event)">{{column.label}}</el-checkbox><span class="muted">拖动表头边界调整列宽。</span></div></el-popover>
        </div>
      </div>
      <div v-if="preferenceError" class="preference-error" role="status">{{preferenceError}} <el-button link type="primary" @click="retryPreferences">重试保存偏好</el-button></div>
      <div class="workspace-body" :class="{'with-category':view!=='categories'&&preferences.sidebar&&!narrow&&store.can('product:category:read')}">
        <aside v-if="view!=='categories'&&preferences.sidebar&&!narrow&&store.can('product:category:read')" class="catalog-sidebar" aria-label="分类范围"><CatalogScopeTree :categories="index.categories" :category-id="categoryId" :expanded-ids="prefs.expandedIds" @select="pickCategory" @expand="changePreference({expandedIds:$event})" /></aside>
        <section class="catalog-main">
          <el-empty v-if="!summary.valid" description="请重新选择有效分类范围" />
          <CatalogCategorySummary v-else-if="view==='categories'" :index="index" :prefs="prefs" :category-id="categoryId" :include-descendants="scopeMode!=='current'" @select="pickCategory" @repair="openOrganize" @update:prefs="updatePreferences" @details="openDetails" />
          <ProductTypeLedger v-else-if="view==='types'" ref="typeLedger" :index="index" :summary="summary" :prefs="prefs" :category-id="categoryId" :return-to="route.fullPath" :suspended="!!modelId && store.can('product:model:read')" @update:prefs="updatePreferences" @details="openDetails" @model="openModel" @type="openType" />
          <ModelLedger v-else ref="modelLedger" :index="index" :summary="summary" :prefs="prefs" :category-id="categoryId" :return-to="route.fullPath" @update:prefs="updatePreferences" @details="openDetails" @model="openModel" />
        </section>
      </div>
      <div v-if="unassignedItems.length" class="unassigned-strip"><span>无归属或分类引用失效</span><button v-for="kind in unassignedItems" :key="kind" type="button" @click="showMetric(kind,index.unassigned[kind],`无归属或分类引用失效 · ${metricLabels[kind]}`)">{{metricLabels[kind]}} {{index.unassigned[kind].count}}</button></div>
      <CatalogModelDetail v-if="modelId && store.can('product:model:read')" ref="modelDetail" :model-id="modelId" :version="modelVersion" :return-to="route.fullPath" :index="index" @close="closeModel" @version="setModelVersion" @details="openDetails" />
    </template>
    <CatalogMetricDetails :index="index" :request="detailRequest" @close="closeDetails" @record="openRecord" />
    <el-drawer v-model="categoryDrawer" title="分类范围" size="min(320px,100vw)"><CatalogScopeTree v-if="store.can('product:category:read')" :categories="index.categories" :category-id="categoryId" :expanded-ids="prefs.expandedIds" @select="pickCategory" @expand="changePreference({expandedIds:$event})" /></el-drawer>
  </div>
</template>
<script setup lang="ts">
import {computed,nextTick,onBeforeUnmount,onMounted,ref,watch} from 'vue'
import {onBeforeRouteLeave,onBeforeRouteUpdate,useRoute,useRouter,type LocationQueryRaw} from 'vue-router'
import PageHead from '../components/PageHead.vue'
import CatalogCategorySummary from '../components/catalog-workspace/CatalogCategorySummary.vue'
import CatalogMetricDetails,{type CatalogDetailRequest} from '../components/catalog-workspace/CatalogMetricDetails.vue'
import CatalogScopeTree from '../components/catalog-workspace/CatalogScopeTree.vue'
import ProductTypeLedger from '../components/catalog-workspace/ProductTypeLedger.vue'
import ModelLedger from '../components/catalog-workspace/ModelLedger.vue'
import CatalogModelDetail from '../components/catalog-workspace/CatalogModelDetail.vue'
import {catalogColumns,catalogWorkspacePreferenceKey,readCatalogWorkspacePreferences,repairCatalogViewPreferences,saveCatalogWorkspacePreferences,type CatalogViewPreferences,type CatalogWorkspacePreferences} from '../components/catalog-workspace/catalogWorkspaceState'
import {buildCatalogWorkspaceIndex,CATALOG_SPU_DEFINITION,type CatalogDetailRow,type CatalogMetric,type CatalogMetricKind} from '../domain/catalogWorkspaceQuery'
import {catalogViewPermissions,firstReadableCatalogView,isCatalogView,catalogSearchKeyword,withCatalogSearch,type CatalogView} from '../domain/catalogWorkspaceNavigation'
import {catalogExpandableCategoryIds} from '../domain/catalogCategoryProjection'
import {categoryPathLabel} from '../domain/categoryTree'
import {useCatalogStore} from '../stores/catalog'
const store=useCatalogStore(),route=useRoute(),router=useRouter()
const owner=computed(()=>JSON.stringify([store.activeUserId,store.previewUserId]))
const preferenceKey=computed(()=>catalogWorkspacePreferenceKey(store.activeUserId,store.previewUserId||''))
const preferences=ref(readCatalogWorkspacePreferences(localStorage,preferenceKey.value)),preferenceError=ref('')
const viewLabels:Record<CatalogView,string>={categories:'分类汇总',types:'产品类型',models:'商品模型'}
const allowedViews=computed(()=>(Object.keys(viewLabels) as CatalogView[]).filter(item=>store.can(catalogViewPermissions[item])))
const view=computed(()=>isCatalogView(route.query.view)?route.query.view:firstReadableCatalogView(code=>store.can(code)))
const viewError=computed(()=>route.query.view&&!isCatalogView(route.query.view)?'资料视图不存在，请选择可用视图。':view.value&&!store.can(catalogViewPermissions[view.value])?'当前身份不能查看此资料视图。':!view.value?'当前身份没有可读取的资料视图。':'')
const prefs=computed(()=>preferences.value.views[view.value||'categories'])
const categoryId=computed(()=>scalar(route.query.categoryId)||scalar(route.query.category))
const scopeMode=computed(()=>route.query.scope==='current'?'current':'with-children')
const index=computed(()=>buildCatalogWorkspaceIndex(store.data,code=>store.can(code)))
const summary=computed(()=>index.value.scope({categoryId:categoryId.value,includeDescendants:scopeMode.value!=='current'}))
const scopeLabel=computed(()=>!categoryId.value?'全部可读分类':!store.can('product:category:read')?'分类范围不可查看':categoryPathLabel(index.value.categories,categoryId.value)||`分类已失效（${categoryId.value}）`)
const metricKinds:CatalogMetricKind[]=['types','models','spus','skus','materials','pending']
const metricLabels:Record<CatalogMetricKind,string>={types:'产品类型',models:'模型',spus:'SPU',skus:'销售 SKU',materials:'MAT',pending:'待处理记录'}
const unassignedItems=computed(()=>metricKinds.filter(kind=>index.value.unassigned[kind].readable&&!!index.value.unassigned[kind].count))
const categoryLayoutOptions=[{label:'树形结构',value:'tree'},{label:'列表表格',value:'list'}]
const searchPlaceholder=computed(()=>view.value==='categories'?'搜索分类名称或编号':view.value==='types'?'搜索类型名称或编号':'搜索模型名称、编号或关联信息')
const statusOptions=computed(()=>view.value==='models'?[{value:'draft',label:'草稿，尚未发布'},{value:'published',label:'已有发布版本'},{value:'published-draft',label:'发布版本与编辑草稿并存'},{value:'offline',label:'已下线'},{value:'unrecorded',label:'没有可用发布版本'}]:[{value:'enabled',label:'启用'},{value:'disabled',label:'停用'}])
const modelId=computed(()=>scalar(route.query.modelId)||(view.value==='models'?(scalar(route.query.template)||scalar(route.query.focus)||scalar(route.query.id)):''))
const modelVersion=computed(()=>scalar(route.query.version)||scalar(route.query.versionId)||undefined)
const typeId=computed(()=>scalar(route.query.typeId)||(view.value==='types'?(scalar(route.query.type)||scalar(route.query.focus)||scalar(route.query.id)):''))
const typeLedger=ref<InstanceType<typeof ProductTypeLedger>>(),modelLedger=ref<InstanceType<typeof ModelLedger>>()
const modelDetail=ref<InstanceType<typeof CatalogModelDetail>>()
const detailRequest=ref<CatalogDetailRequest|null>(null),categoryDrawer=ref(false),narrow=ref(window.innerWidth<900)
let writeTimer:ReturnType<typeof setTimeout>|undefined,pendingWrite:{key:string;value:CatalogWorkspacePreferences}|undefined,content:HTMLElement|null=null,scrollTimer:ReturnType<typeof setTimeout>|undefined
let restoringScroll=false,scrollRestoreEpoch=0,alive=true
function scalar(value:unknown){return typeof value==='string'?value:''}
function queuePreferenceSave(){pendingWrite={key:preferenceKey.value,value:JSON.parse(JSON.stringify(preferences.value))};if(writeTimer)clearTimeout(writeTimer);writeTimer=setTimeout(flushPreferences,180)}
function flushPreferences(){if(writeTimer)clearTimeout(writeTimer);writeTimer=undefined;if(!pendingWrite)return;const task=pendingWrite;pendingWrite=undefined;const result=saveCatalogWorkspacePreferences(localStorage,task.key,task.value);if(task.key===preferenceKey.value)preferenceError.value=result.ok?'':result.message||''}
function retryPreferences(){queuePreferenceSave();flushPreferences()}
function updatePreferences(value:CatalogViewPreferences){if(!view.value)return;const previous=prefs.value;preferences.value.views[view.value]=repairCatalogViewPreferences(view.value,value);queuePreferenceSave();if(['keyword','status','sort','page'].some(key=>previous[key as keyof CatalogViewPreferences]!==prefs.value[key as keyof CatalogViewPreferences]))syncQueryPreferences()}
function changePreference(patch:Partial<CatalogViewPreferences>){updatePreferences({...prefs.value,...patch})}
function syncQueryPreferences(){if(route.path!=='/catalog'||!view.value)return;const state=prefs.value;const query={...withCatalogSearch(route.query,state.keyword),status:state.status||undefined,sort:state.sort==='name'?undefined:state.sort,page:state.page===1?undefined:String(state.page)};const target={path:'/catalog',query};if(router.resolve(target).fullPath!==route.fullPath)void router.replace(target)}
function setColumn(key:string,visible:boolean){const columns=visible?[...prefs.value.columns,key]:prefs.value.columns.filter(value=>value!==key);changePreference({columns})}
function setCategoryLayout(value:string|number|boolean){changePreference({categoryLayout:value==='list'?'list':'tree'})}
function setTreeExpansion(open:boolean){changePreference({treeExpandReady:true,expandedIds:open?catalogExpandableCategoryIds(index.value.categories):[]})}
async function canChangeContext(){if(modelDetail.value&&!await modelDetail.value.canLeave())return false;const ledger=view.value==='types'?typeLedger.value:view.value==='models'?modelLedger.value:undefined;return !ledger||await ledger.canLeave()}
function acceptContextChange(){modelDetail.value?.acceptContextChange();if(view.value==='types')typeLedger.value?.acceptContextChange();if(view.value==='models')modelLedger.value?.acceptContextChange()}
function cleanDetails(query:LocationQueryRaw){for(const key of ['modelId','typeId','version','versionId','template','focus','id','type','metric'])delete query[key];return query}
async function switchView(next:CatalogView){if(next===view.value||!store.can(catalogViewPermissions[next]))return;if(!await canChangeContext())return;rememberScroll();acceptContextChange();const state=preferences.value.views[next];await router.push({path:'/catalog',query:cleanDetails({...route.query,view:next,q:state.keyword,keyword:undefined,search:undefined,status:state.status||undefined,sort:state.sort==='name'?undefined:state.sort,page:state.page===1?undefined:String(state.page)})})}
async function pickCategory(id:string){if(id===categoryId.value){categoryDrawer.value=false;return}if(!await canChangeContext())return;rememberScroll();acceptContextChange();const query=cleanDetails({...route.query,view:view.value,categoryId:id||undefined});delete query.category;await router.push({path:'/catalog',query});categoryDrawer.value=false}
async function changeScope(value:string){if(value===scopeMode.value)return;if(!await canChangeContext())return;acceptContextChange();await router.push({path:'/catalog',query:{...route.query,scope:value==='current'?'current':'with-children',metric:undefined}})}
function toggleCategory(){if(narrow.value)categoryDrawer.value=true;else{preferences.value.sidebar=!preferences.value.sidebar;queuePreferenceSave()}}
function openDetails(request:CatalogDetailRequest){if(viewError.value)return;detailRequest.value={...request,ids:[...request.ids]}}
function showMetric(kind:CatalogMetricKind,metric:CatalogMetric,title:string){if(metric.readable)openDetails({kind,ids:metric.ids,title})}
function closeDetails(){detailRequest.value=null;if(route.query.metric)void router.replace({query:{...route.query,metric:undefined}})}
function openModel(id:string,version?:string){if(!store.can('product:model:read'))return;changePreference({selectedId:id});rememberScroll();void router.push({path:'/catalog',query:{...route.query,modelId:id,version,versionId:undefined,metric:undefined}})}
function closeModel(){void router.replace({query:{...route.query,modelId:undefined,template:undefined,focus:undefined,id:undefined,version:undefined,versionId:undefined}})}
function setModelVersion(version:string){void router.replace({query:{...route.query,version:version||undefined,versionId:undefined}})}
function openType(id:string){if(!store.can('product:type:read'))return;changePreference({selectedId:id});void router.replace({query:{...route.query,typeId:id||undefined,type:undefined,id:undefined,focus:undefined,metric:undefined}})}
async function openRecord(row:CatalogDetailRow){const id=row.recordId,returnTo=route.fullPath;detailRequest.value=null;if(row.kind==='models')openModel(id);else if(row.kind==='types'){if(view.value!=='types')await switchView('types');openType(id)}else if(row.kind==='categories')await pickCategory(id);else if(row.route){rememberScroll();const target=router.resolve(row.route);await router.push({path:target.path,query:{...target.query,returnTo}})}}
function openOrganize(id:string){rememberScroll();void router.push({path:'/categories',query:{mode:'organize',categoryId:id||undefined,returnTo:route.fullPath}})}
function organize(){openOrganize(categoryId.value)}
function rememberScroll(){if(!restoringScroll&&content&&view.value){preferences.value.views[view.value].scrollTop=content.scrollTop;preferences.value.views[view.value].scrollLeft=content.scrollLeft;queuePreferenceSave()}}
function onScroll(){if(restoringScroll)return;if(scrollTimer)clearTimeout(scrollTimer);scrollTimer=setTimeout(rememberScroll,100)}
async function restoreScroll(){const epoch=++scrollRestoreEpoch,target={top:prefs.value.scrollTop,left:prefs.value.scrollLeft};restoringScroll=true;if(scrollTimer)clearTimeout(scrollTimer);await nextTick();for(let frame=0;frame<4;frame++){await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));if(!alive||epoch!==scrollRestoreEpoch)return;if(content){content.scrollTop=target.top;content.scrollLeft=target.left}}restoringScroll=false}
function resize(){narrow.value=window.innerWidth<900;if(!narrow.value)categoryDrawer.value=false}
watch(owner,()=>{flushPreferences();preferences.value=readCatalogWorkspacePreferences(localStorage,preferenceKey.value);preferenceError.value='';detailRequest.value=null;categoryDrawer.value=false;const next=firstReadableCatalogView(code=>store.can(code)),state=preferences.value.views[next||'categories'];void router.replace({path:'/catalog',query:{view:next,q:state.keyword,status:state.status||undefined,sort:state.sort==='name'?undefined:state.sort,page:state.page===1?undefined:String(state.page)}})})
let initialRoutePreferences=true
watch([()=>view.value,()=>route.query.q,()=>route.query.keyword,()=>route.query.search,()=>route.query.status,()=>route.query.sort,()=>route.query.page],()=>{if(!view.value)return;const query=route.query,patch:Partial<CatalogViewPreferences>={};if(!initialRoutePreferences||query.q!==undefined||query.keyword!==undefined||query.search!==undefined)patch.keyword=catalogSearchKeyword(query)??'';if(!initialRoutePreferences||query.status!==undefined)patch.status=scalar(query.status);if(!initialRoutePreferences||query.sort!==undefined)patch.sort=scalar(query.sort)||'name';if(!initialRoutePreferences||query.page!==undefined)patch.page=Number(query.page)||1;preferences.value.views[view.value]=repairCatalogViewPreferences(view.value,{...prefs.value,...patch});initialRoutePreferences=false;queuePreferenceSave()},{immediate:true})
watch([()=>route.query.view,()=>route.query.categoryId,()=>route.query.category,()=>route.query.scope],()=>{detailRequest.value=null;void restoreScroll()})
watch(()=>[typeId.value,view.value],async()=>{await nextTick();if(view.value==='types'&&store.can('product:type:read'))typeLedger.value?.openDetail(typeId.value)},{immediate:true})
watch(()=>[route.query.metric,index.value,categoryId.value,scopeMode.value],()=>{const raw=scalar(route.query.metric),kind=raw==='issues'?'pending':raw;if(metricKinds.includes(kind as CatalogMetricKind)&&summary.value.valid)showMetric(kind as CatalogMetricKind,summary.value.metrics[kind as CatalogMetricKind],`${scopeLabel.value} · ${metricLabels[kind as CatalogMetricKind]}`)},{immediate:true})
watch(viewError,()=>{if(viewError.value)detailRequest.value=null})
// A same-user role change must not leave the previous metric's title or source count visible.
watch(()=>['category','type','model','spu','sku','material'].map(resource=>store.can(`product:${resource}:read`)).join(','),()=>{detailRequest.value=null;categoryDrawer.value=false;if(route.query.metric)void router.replace({query:{...route.query,metric:undefined}})})
onBeforeRouteUpdate(async(to,from)=>{if(to.path!==from.path)return;if(['view','categoryId','category','scope','modelId','template','focus','id','version','versionId'].some(key=>to.query[key]!==from.query[key])){if(!await canChangeContext())return false;acceptContextChange()}return true})
onBeforeRouteLeave(()=>{rememberScroll();flushPreferences()})
onMounted(()=>{content=document.querySelector('.content');content?.addEventListener('scroll',onScroll,{passive:true});window.addEventListener('resize',resize);void restoreScroll()})
onBeforeUnmount(()=>{alive=false;scrollRestoreEpoch++;if(route.path==='/catalog')rememberScroll();flushPreferences();if(scrollTimer)clearTimeout(scrollTimer);content?.removeEventListener('scroll',onScroll);window.removeEventListener('resize',resize)})
</script>
<style scoped>
.catalog-workspace{min-width:0}.view-tabs{display:flex;gap:6px;border-bottom:1px solid var(--el-border-color);margin-bottom:14px}.view-tabs button{border:0;background:transparent;color:var(--el-text-color-regular);font:inherit;padding:9px 16px;cursor:pointer;border-bottom:2px solid transparent}.view-tabs button[aria-current=page]{color:var(--el-color-primary);border-bottom-color:var(--el-color-primary);font-weight:600}.workspace-toolbar,.query-toolbar,.scope-totals{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:12px 0}.scope-label{font-size:14px;font-weight:600;max-width:min(500px,55vw);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.scope-totals{font-size:13px;gap:14px}.scope-totals button,.unassigned-strip button{border:0;background:none;color:var(--el-text-color-regular);cursor:pointer;padding:0;font:inherit}.scope-totals strong{color:var(--el-color-primary);margin-left:3px}.query-toolbar :deep(.el-input){max-width:340px}.query-toolbar :deep(.el-select){width:160px}.query-tools{margin-left:auto;display:flex;align-items:center;gap:8px;flex-wrap:wrap}.query-toolbar :deep(.el-button){margin-left:0}.workspace-body{display:grid;grid-template-columns:minmax(0,1fr);gap:14px;align-items:start}.workspace-body.with-category{grid-template-columns:240px minmax(0,1fr)}.catalog-sidebar{min-width:0;border:1px solid var(--el-border-color);border-radius:6px;padding:12px;box-sizing:border-box;position:sticky;top:0}.catalog-main{min-width:0;background:var(--el-bg-color);padding:12px;border:1px solid var(--el-border-color);border-radius:6px}.column-options{display:flex;flex-direction:column}.muted{color:var(--el-text-color-secondary);font-size:12px}.unassigned-strip{display:flex;flex-wrap:wrap;gap:12px;padding:12px 0;color:var(--el-text-color-secondary);font-size:12px}.unassigned-strip button{color:var(--el-color-primary)}.preference-error{font-size:13px;color:var(--el-color-warning);margin:8px 0}button:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:2px}@media(max-width:899px){.catalog-main{padding:8px}.view-tabs button{padding:9px 10px}.query-toolbar :deep(.el-input){max-width:100%;flex-basis:100%}.scope-label{max-width:70vw}}
</style>
