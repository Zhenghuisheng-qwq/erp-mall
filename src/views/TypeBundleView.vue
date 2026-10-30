<template>
  <div class="bundle-page" :aria-busy="busy">
    <PageHead title="权益包管理" desc="管理同一分类下的产品类型组合，按设备匹配可选商品。">
      <el-button v-if="returnTo" :disabled="busy" @click="router.push(returnTo)">返回来源</el-button>
      <el-button :disabled="busy" @click="router.push('/benefits/shopping')" v-if="store.canRoute({path:'/benefits/shopping'})">权益包选购</el-button>
      <el-button v-if="store.can('product:type-bundle:create')" type="primary" :icon="Plus" :disabled="busy" data-new-bundle @click="edit()">新建权益包</el-button>
    </PageHead>
    <el-alert v-if="route.query.model" :closable="false" type="info" title="仅选择当前归属分类下的产品类型；试选设备用于预览，不绑定到权益包。" />
    <el-alert v-if="listError" class="list-error" :title="listError" type="error" :closable="false" show-icon />
    <div class="workspace">
      <aside class="panel scope-panel" :class="{'is-open':scopeOpen}">
        <h2><el-icon><Folder /></el-icon>分类与产品类型</h2>
        <CatalogScopeTree :categories="store.data.categories" :types="index.typeRows" :category-id="category" :scope-type-id="typeId" :expanded-ids="expanded" @expand="expanded=$event" @select="category=$event;typeId=''" @select-type="typeId=$event;category=''" />
      </aside>
      <section class="panel bundles-panel">
        <div class="list-heading">
          <div class="list-title"><h2>{{listTitle}}</h2><span class="count">{{groups.length}} 个</span></div>
          <el-button class="scope-toggle" :icon="Filter" :aria-expanded="scopeOpen" @click="scopeOpen=!scopeOpen">{{scopeOpen?'收起筛选':'筛选分类'}}</el-button>
        </div>
        <el-empty v-if="!groups.length" description="暂无权益包，可以新建产品类型集合" />
        <template v-else>
          <el-table class="bundle-table" :data="groups" row-key="id" data-bundle-table>
            <el-table-column label="名称" min-width="180"><template #default="{row}"><button type="button" class="bundle-name" :disabled="busy" :data-bundle-record="row.id" @click="edit(row)">{{row.name}}</button></template></el-table-column>
            <el-table-column label="归属分类" min-width="100"><template #default="{row}"><span class="category-text">{{categoryName(row.categoryId)}}</span></template></el-table-column>
            <el-table-column label="参与产品类型" min-width="200"><template #default="{row}"><div class="type-tags"><el-tag v-for="id in row.productTypeIds" :key="id" size="small" effect="plain" type="info">{{typeName(id)}}</el-tag></div></template></el-table-column>
            <el-table-column label="状态" width="78"><template #default="{row}"><span class="status" :class="{'is-enabled':row.enabled}"><i />{{row.enabled?'启用':'停用'}}</span></template></el-table-column>
            <el-table-column label="创建时间" width="120"><template #default="{row}"><time class="record-time" :datetime="row.createdAt" :title="row.createdAt">{{timeParts(row.createdAt).date}}<span>{{timeParts(row.createdAt).time}}</span></time></template></el-table-column>
            <el-table-column label="更新时间" width="120"><template #default="{row}"><time class="record-time" :datetime="row.updatedAt" :title="row.updatedAt">{{timeParts(row.updatedAt).date}}<span>{{timeParts(row.updatedAt).time}}</span></time></template></el-table-column>
            <el-table-column label="操作" width="216" fixed="right"><template #default="{row}"><div class="row-actions">
              <el-button v-if="row.enabled&&canShop" size="small" type="primary" plain :disabled="busy" @click="useGroup(row)">使用</el-button>
              <el-button size="small" text :icon="EditPen" :disabled="busy" @click="edit(row)">{{canUpdate(row)?'编辑':'查看'}}</el-button>
              <el-button v-if="canDelete" size="small" text type="danger" :icon="Delete" :loading="deletingId===row.id" :disabled="busy" :data-delete-bundle="row.id" @click="remove(row)">删除</el-button>
            </div></template></el-table-column>
          </el-table>
          <div class="bundle-cards" data-bundle-cards>
            <article v-for="row in groups" :key="row.id" class="bundle-card" :data-bundle-card="row.id">
              <div class="card-heading"><button type="button" class="bundle-name" :disabled="busy" @click="edit(row)">{{row.name}}</button><span class="status" :class="{'is-enabled':row.enabled}"><i />{{row.enabled?'启用':'停用'}}</span></div>
              <p class="card-category"><el-icon><Folder /></el-icon>{{categoryName(row.categoryId)}}</p>
              <div class="type-tags"><el-tag v-for="id in row.productTypeIds" :key="id" size="small" effect="plain" type="info">{{typeName(id)}}</el-tag></div>
              <dl class="card-times"><div><dt>创建时间</dt><dd><time :datetime="row.createdAt">{{formatTime(row.createdAt)}}</time></dd></div><div><dt>更新时间</dt><dd><time :datetime="row.updatedAt">{{formatTime(row.updatedAt)}}</time></dd></div></dl>
              <div class="card-footer"><el-button v-if="row.enabled&&canShop" type="primary" size="small" plain :icon="ShoppingCart" :disabled="busy" @click="useGroup(row)">使用权益包</el-button><div class="row-actions"><el-button size="small" text :icon="EditPen" :disabled="busy" @click="edit(row)">{{canUpdate(row)?'编辑':'查看'}}</el-button><el-button v-if="canDelete" size="small" text type="danger" :icon="Delete" :loading="deletingId===row.id" :disabled="busy" :data-delete-bundle="row.id" @click="remove(row)">删除</el-button></div></div>
            </article>
          </div>
        </template>
      </section>
    </div>
    <el-dialog v-model="opened" title="权益包配置" width="min(900px,95vw)" :close-on-click-modal="false" :before-close="close">
      <el-form v-if="draft" label-position="top" :disabled="!editable||busy">
        <el-form-item label="权益包名称"><el-input v-model="draft.name" maxlength="80" aria-label="权益包名称" /></el-form-item>
        <el-form-item label="归属分类"><el-select v-model="draft.categoryId" filterable aria-label="权益包归属分类"><el-option v-for="c in store.data.categories" :key="c.id" :value="c.id" :label="categoryName(c.id)" /></el-select></el-form-item>
        <el-form-item label="参与组合的产品类型"><TypeSetPicker v-model="draft.productTypeIds" :data="store.data" :category-id="draft.categoryId" category-only :disabled="!editable||busy" /></el-form-item>
        <el-alert v-if="scopeProblem" :title="scopeProblem" type="warning" :closable="false" />
        <el-form-item label="试选设备，预览可组合商品"><CompatibilityDeviceSelect v-model="previewDevice" :data="store.data" /><p class="muted">设备只用于本次预览，不会保存为权益包的型号绑定。</p><div v-if="previewDevice&&!scopeProblem" class="bundle-preview" data-bundle-preview><section v-for="g in preview.groups" :key="g.id"><strong>{{g.name}}</strong><p v-if="!g.candidates.length">{{g.empty}}</p><p v-for="c in g.candidates" :key="c.id">{{c.name}} · {{c.spec}}</p></section></div></el-form-item>
        <el-form-item label="启用"><el-switch v-model="draft.enabled" /></el-form-item>
        <el-form-item label="排序"><el-input-number v-model="draft.sort" :min="-100000" :max="100000" /></el-form-item>
      </el-form>
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <template #footer><el-button :disabled="busy" @click="close(()=>opened=false)">取消 / 关闭</el-button><el-button v-if="editable" type="primary" :loading="busy" data-save-bundle @click="save">保存权益包</el-button></template>
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
import {computed,ref,watch,onBeforeUnmount} from 'vue'
import {useRoute,useRouter,onBeforeRouteLeave} from 'vue-router'
import {ElMessage,ElMessageBox} from 'element-plus'
import {Plus,Filter,Folder,EditPen,Delete,ShoppingCart} from '@element-plus/icons-vue'
import CompatibilityDeviceSelect from '../components/compatibility/CompatibilityDeviceSelect.vue'
import {groupTypesProblem,saleQuery,deviceFromKey} from '../domain/benefitSales/query'
import PageHead from '../components/PageHead.vue'
import CatalogScopeTree from '../components/catalog-workspace/CatalogScopeTree.vue'
import TypeSetPicker from '../components/benefit-sales/TypeSetPicker.vue'
import {useCatalogStore} from '../stores/catalog'
import {buildCatalogWorkspaceIndex} from '../domain/catalogWorkspaceQuery'
import {categoryPathLabel} from '../domain/categoryTree'
import {internalReturnLocation} from '../domain/internalNavigation'
import {copy} from '../domain/benefitSales/commands'
import type {BenefitGroup,GroupInput} from '../domain/benefitSales/types'

const store=useCatalogStore(),route=useRoute(),router=useRouter()
const category=ref(String(route.query.category||store.data.productTypes.find(t=>t.id===store.data.specCanvases.find(c=>c.templateId===route.query.model)?.productTypeId)?.categoryId||'')),typeId=ref(''),expanded=ref<string[]>([]),scopeOpen=ref(false)
const index=computed(()=>buildCatalogWorkspaceIndex(store.data,store.can)),returnTo=computed(()=>internalReturnLocation(route.query.returnTo))
const groups=computed(()=>(store.data.benefitTypeGroups||[]).filter(g=>typeId.value?g.productTypeIds.includes(typeId.value):!category.value||g.categoryId===category.value).slice().sort((a,b)=>a.sort-b.sort||a.name.localeCompare(b.name)))
const categoryName=(id:string)=>categoryPathLabel(store.data.categories,id)||'分类已失效',typeName=(id:string)=>store.data.productTypes.find(t=>t.id===id)?.name||'类型已失效'
const listTitle=computed(()=>typeId.value?`${typeName(typeId.value)}相关权益包`:category.value?`${categoryName(category.value)}权益包`:'全部权益包')
const canShop=computed(()=>store.canRoute({path:'/benefits/shopping'})),canDelete=computed(()=>store.can('product:type-bundle:delete'))
const canUpdate=(group:BenefitGroup)=>store.can(group.id?'product:type-bundle:update':'product:type-bundle:create')
const previewDevice=ref(''),previewByGroup=ref<Record<string,string>>({})
const opened=ref(false),draft=ref<GroupInput>(),revision=ref(0),initial=ref(''),error=ref(''),busy=ref(false),deletingId=ref(''),listError=ref('')
let alive=true
const scopeProblem=computed(()=>draft.value?groupTypesProblem(store.data,draft.value.categoryId,draft.value.productTypeIds):'')
const preview=computed(()=>saleQuery(store.data,{mode:'free',categoryId:draft.value?.categoryId||'',productTypeIds:draft.value?.productTypeIds||[],device:deviceFromKey(previewDevice.value)}))
const editable=computed(()=>store.can(`product:type-bundle:${draft.value?.id?'update':'create'}`))
const dateFormatter=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Singapore',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'})
function timeParts(value:string){const date=new Date(value);if(!Number.isFinite(date.getTime()))return {date:'未记录',time:''};const parts=dateFormatter.formatToParts(date),part=(name:string)=>parts.find(p=>p.type===name)?.value||'';return {date:`${part('year')}-${part('month')}-${part('day')}`,time:`${part('hour')}:${part('minute')}`}}
function formatTime(value:string){const parts=timeParts(value);return [parts.date,parts.time].filter(Boolean).join(' ')}
watch(()=>[store.activeUserId,store.previewUserId],()=>{opened.value=false;draft.value=undefined;previewDevice.value='';previewByGroup.value={};error.value='';listError.value=''})
function edit(g?:BenefitGroup){if(busy.value)return;previewDevice.value=g?previewByGroup.value[g.id]||'':'';draft.value=g?copy(g):{id:'',name:'',categoryId:category.value,productTypeIds:typeId.value?[typeId.value]:[],enabled:true,sort:0};revision.value=g?.revision||0;initial.value=JSON.stringify(draft.value);error.value='';opened.value=true}
function useGroup(group:BenefitGroup){if(busy.value)return;router.push({path:'/benefits/shopping',query:{group:group.id,device:previewByGroup.value[group.id]||undefined,model:route.query.model,version:route.query.version,node:route.query.node,returnTo:route.fullPath}})}
function beforeUnload(e:BeforeUnloadEvent){if(busy.value||opened.value&&JSON.stringify(draft.value)!==initial.value){e.preventDefault();e.returnValue=''}}
window.addEventListener('beforeunload',beforeUnload)
onBeforeUnmount(()=>{alive=false;window.removeEventListener('beforeunload',beforeUnload)})
async function discard(){if(!opened.value||JSON.stringify(draft.value)===initial.value)return true;try{await ElMessageBox.confirm('有未保存的配置，确定放弃本次修改？','保留或放弃修改',{confirmButtonText:'放弃修改',cancelButtonText:'继续编辑'});opened.value=false;return true}catch{return false}}
async function close(done:()=>void){if(!busy.value&&await discard())done()}
onBeforeRouteLeave(async()=>!busy.value&&await discard())
async function save(){if(!draft.value||busy.value)return;if(scopeProblem.value){error.value=scopeProblem.value;return}busy.value=true;error.value='';const owner=JSON.stringify([store.activeUserId,store.previewUserId]),stamp=JSON.stringify(draft.value);try{const result=await store.saveTypeBundle(draft.value,revision.value,()=>owner===JSON.stringify([store.activeUserId,store.previewUserId])&&JSON.stringify(draft.value)===stamp);if(owner!==JSON.stringify([store.activeUserId,store.previewUserId]))return;if(!result.ok){error.value=result.message||'保存失败';return}if('record' in result)previewByGroup.value[result.record.id]=previewDevice.value;opened.value=false;ElMessage.success('权益包已保存')}catch(e){if(owner===JSON.stringify([store.activeUserId,store.previewUserId]))error.value=String(e)}finally{busy.value=false}}
async function remove(group:BenefitGroup){
  if(busy.value||!canDelete.value)return
  const actor=store.activeUserId,preview=store.previewUserId,id=group.id,expectedRevision=group.revision,current=()=>alive&&actor===store.activeUserId&&preview===store.previewUserId
  try{await ElMessageBox.confirm(`确定删除“${group.name}”？删除后不再出现在权益包列表，已有清单和确认快照会保留。`,'删除权益包',{type:'warning',confirmButtonText:'确认删除',cancelButtonText:'取消',closeOnClickModal:false})}catch{return}
  if(!current())return
  busy.value=true;deletingId.value=id;listError.value=''
  try{const result=await store.removeTypeBundle(id,expectedRevision,current);if(!current())return;if(!result.ok){listError.value=result.message||'删除失败，请重试';return}delete previewByGroup.value[id];ElMessage.success('权益包已删除')}catch(cause){if(current())listError.value=cause instanceof Error?cause.message:String(cause)}finally{busy.value=false;deletingId.value=''}
}
</script>
<style scoped>
.bundle-page{max-width:1700px;margin:0 auto}.bundle-page:deep(.page-head){align-items:flex-start;margin-bottom:22px}.bundle-page:deep(.page-head p){max-width:560px;line-height:1.6}.bundle-page:deep(.page-head-actions){flex-wrap:wrap;gap:8px}.bundle-page:deep(.page-head-actions .el-button){margin:0}.list-error{margin-bottom:16px}.workspace{display:grid;grid-template-columns:210px minmax(0,1fr);gap:18px;align-items:start;margin-top:18px}.panel{padding:18px;min-width:0;border-radius:12px}.scope-panel h2{display:flex;gap:7px;align-items:center;font-size:13px;margin:0 0 16px;color:var(--el-text-color-secondary);font-weight:500}.scope-panel:deep(.scope-tree-scroll){max-height:380px;min-height:0}.scope-panel:deep(.all-categories),.scope-panel:deep(.node){border-radius:6px}.scope-panel:deep(.all-categories){padding:8px}.bundles-panel{padding:20px}.list-heading,.list-title{display:flex;align-items:center;gap:10px}.list-heading{justify-content:space-between;margin-bottom:18px}.list-title{min-width:0}.list-title h2{font-size:17px;margin:0;font-weight:600}.count{font-size:12px;color:var(--el-text-color-secondary);white-space:nowrap}.scope-toggle{display:none}.bundle-name{border:0;background:none;padding:0;color:var(--el-color-primary);text-align:left;line-height:1.5;font:inherit;font-weight:500;cursor:pointer;overflow-wrap:anywhere}.bundle-name:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:3px}.bundle-name:disabled{cursor:default;opacity:.6}.category-text{color:var(--el-text-color-secondary);font-size:13px}.type-tags{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.type-tags .el-tag{border-color:var(--el-border-color-lighter);background:var(--el-fill-color-lighter)}.status{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;font-size:12px;color:var(--el-text-color-secondary)}.status i{width:6px;height:6px;background:var(--el-text-color-placeholder);border-radius:50%;flex:none}.status.is-enabled{color:var(--el-color-success)}.status.is-enabled i{background:var(--el-color-success)}.record-time{display:block;white-space:nowrap;font-size:12px;font-variant-numeric:tabular-nums;line-height:1.6}.record-time span{display:block;color:var(--el-text-color-secondary)}.row-actions{display:flex;align-items:center;justify-content:flex-start;gap:2px;white-space:nowrap;flex-wrap:nowrap}.row-actions .el-button{margin:0;padding:6px 8px;border-radius:6px}.row-actions .el-button.is-plain{padding:6px 11px;margin-right:4px}.bundle-table:deep(.el-table__cell){padding:15px 0}.bundle-table:deep(th.el-table__cell){font-weight:500;background:var(--el-fill-color-lighter);color:var(--el-text-color-secondary)}.bundle-table:deep(.el-table__inner-wrapper:before){display:none}.bundle-cards{display:none}.el-form-item:deep(.type-picker){width:100%}.bundle-preview{width:100%;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}.bundle-preview section{padding:12px;border:1px solid var(--el-border-color-light);border-radius:8px}.bundle-preview p,.muted{font-size:12px;color:var(--el-text-color-secondary);line-height:1.7}.el-form-item:deep(.device-select){width:100%}
@media(max-width:1100px){.workspace{grid-template-columns:minmax(0,1fr);gap:12px}.scope-panel:not(.is-open){display:none}.scope-panel:deep(.scope-tree-scroll){max-height:220px}.scope-toggle{display:inline-flex}.bundle-table{display:none}.bundle-cards{display:grid;gap:12px}.bundles-panel{padding:18px}.bundle-card{padding:18px;border:1px solid var(--el-border-color-lighter);border-radius:10px;background:var(--el-fill-color-blank)}.card-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.card-heading .bundle-name{font-size:15px}.card-heading .status{padding-top:3px}.card-category{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--el-text-color-secondary);margin:9px 0 12px}.card-times{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}.card-times div{min-width:0}.card-times dt{font-size:11px;color:var(--el-text-color-secondary);margin-bottom:5px}.card-times dd{font-size:12px;font-variant-numeric:tabular-nums;margin:0;white-space:nowrap}.card-footer{display:flex;justify-content:space-between;align-items:center;gap:12px;padding-top:12px;border-top:1px solid var(--el-border-color-lighter)}.card-footer>.el-button{margin:0;border-radius:6px}.card-footer .row-actions{margin-left:auto}.bundle-page:deep(.page-head){gap:14px;flex-wrap:wrap}.bundle-page:deep(.page-head h1){font-size:24px}}
@media(max-width:500px){.bundles-panel,.bundle-card{padding:14px}.bundle-preview{grid-template-columns:1fr}.bundle-page:deep(.page-head-actions){width:100%}.card-times{gap:8px}.card-times dd{font-size:11px}.card-footer{flex-wrap:wrap;gap:8px}.card-heading{gap:10px}}
</style>
