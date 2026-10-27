<template>
  <section class="catalog-summary-table" data-catalog-category-summary :data-catalog-layout="layout">
    <el-alert v-if="projection.anomalyTotal" type="warning" :closable="false" show-icon data-catalog-anomaly-alert :title="`${projection.anomalyTotal} 个分类无法按原父子关系挂入目录（上级缺失、指向自身或循环）。原始编号未改，可进入整理。`" />
    <el-table :data="pagedRows" row-key="id" size="small" :row-class-name="rowClass" @header-dragend="resizeColumn">
      <el-table-column prop="name" label="分类名称" :width="prefs.widths.name || 320" fixed="left">
        <template #default="{row}">
          <div class="category-cell" :style="{paddingLeft:layout==='tree'?`${row.depth*18}px`:'0'}">
            <button v-if="layout==='tree'&&row.hasChildren" class="twist" type="button" :data-catalog-expand="row.id" :aria-expanded="row.expanded" :aria-label="`${row.expanded?'折叠':'展开'} ${row.name}`" @click="toggle(row.id)">{{row.expanded?'▾':'▸'}}</button>
            <span v-else-if="layout==='tree'" class="twist twist-spacer"></span>
            <el-icon v-if="layout==='tree'" class="folder" aria-hidden="true"><FolderOpened v-if="row.expanded" /><Folder v-else /></el-icon>
            <span class="category-text">
              <button class="category-name" :class="{root:layout==='tree'&&row.depth===0&&row.relation!=='path'}" type="button" :data-catalog-category="row.id" :data-catalog-relation="row.relation" :data-catalog-anomaly="row.anomaly||undefined" :title="`${row.path}（${row.id}）${row.anomalyLabel?` · ${row.anomalyLabel}`:''}`" :aria-pressed="categoryId===row.id" @click="emit('select',row.id)"><template v-for="(part,index) in highlightParts(row.name,prefs.keyword)" :key="index"><mark v-if="part.hit">{{part.text}}</mark><template v-else>{{part.text}}</template></template></button>
              <small v-if="layout==='list'&&row.path.includes(' / ')" class="category-path" :data-catalog-path="row.id"><template v-for="(part,index) in highlightParts(row.path,prefs.keyword)" :key="index"><mark v-if="part.hit">{{part.text}}</mark><template v-else>{{part.text}}</template></template></small>
            </span>
            <el-tag v-if="row.relation==='path'" size="small" type="info">路径</el-tag>
            <el-tag v-if="row.anomaly" size="small" type="warning">{{row.anomalyLabel}}</el-tag>
            <el-tag v-if="!row.enabled" size="small" type="info">停用</el-tag>
          </div>
        </template>
      </el-table-column>
      <el-table-column v-if="shown('types')" prop="types" label="关联产品类型" :width="prefs.widths.types || 250">
        <template #default="{row}"><span v-if="!metrics(row.id).types.readable" class="muted">不可查看</span><template v-else><button type="button" class="metric-link" :data-catalog-metric="`${row.id}:types`" @click="open(row.id,'types')">{{metrics(row.id).types.count}} 个类型</button><div class="type-tags"><span v-for="item in types(row.id).slice(0,2)" :key="item.id" :title="`${item.name}（${item.id}）`">{{item.name}}</span><button v-if="types(row.id).length>2" type="button" class="metric-link" @click="open(row.id,'types')">更多</button></div></template></template>
      </el-table-column>
      <el-table-column v-for="kind in numberColumns" :key="kind" :prop="kind" :label="labels[kind]" :width="prefs.widths[kind] || (kind==='pending'?135:120)">
        <template #header><span :title="kind==='spus'?CATALOG_SPU_DEFINITION:kind==='pending'?'按受影响记录去重；一条记录可有多个事项。':undefined">{{labels[kind]}}</span></template>
        <template #default="{row}"><button v-if="metrics(row.id)[kind].readable" type="button" class="metric-link" :data-catalog-metric="`${row.id}:${kind}`" @click="open(row.id,kind)">{{metrics(row.id)[kind].count}}<span v-if="kind==='pending'"> 条记录</span></button><span v-else class="muted">不可查看</span></template>
      </el-table-column>
      <el-table-column label="操作" :width="168"><template #default="{row}"><el-button link @click="emit('select',row.id)">{{categoryId===row.id?'当前范围':'查看此范围'}}</el-button><el-button v-if="row.anomaly" link type="warning" :data-catalog-repair="row.id" @click="emit('repair',row.id)">整理</el-button></template></el-table-column>
      <template #empty><el-empty :description="emptyText" :image-size="72" /></template>
    </el-table>
    <div class="table-foot"><span class="muted">{{projection.rows.length}} 个可见分类 · 各行按该分类{{includeDescendants?'及下级':'本级'}}统计<template v-if="layout==='tree'"> · 排序只调整同级</template></span><el-pagination v-if="layout==='list'" small background layout="prev,pager,next" :total="projection.rows.length" :page-size="prefs.pageSize" :current-page="page" @current-change="setPage" /></div>
  </section>
</template>
<script setup lang="ts">
import {computed, onMounted, ref, watch} from 'vue'
import {Folder, FolderOpened} from '@element-plus/icons-vue'
import {categoryPathLabel, highlightParts} from '../../domain/categoryTree'
import {defaultCatalogTreeExpandedIds, projectCatalogCategories, type CatalogCategoryProjectionRow} from '../../domain/catalogCategoryProjection'
import {CATALOG_SPU_DEFINITION, type CatalogMetricKind, type CatalogWorkspaceIndex} from '../../domain/catalogWorkspaceQuery'
import type {CatalogViewPreferences} from './catalogWorkspaceState'
const props=defineProps<{index:CatalogWorkspaceIndex;prefs:CatalogViewPreferences;categoryId:string;includeDescendants:boolean}>()
const emit=defineEmits<{'update:prefs':[value:CatalogViewPreferences];select:[id:string];repair:[id:string];details:[value:{kind:CatalogMetricKind;ids:string[];title:string}]}>()
const labels:Record<CatalogMetricKind,string>={types:'关联产品类型',models:'模型数',spus:'SPU 数',skus:'销售 SKU 数',materials:'MAT 数',pending:'待处理'}
const layout=computed(()=>props.prefs.categoryLayout==='list'?'list':'tree')
const filterActive=computed(()=>!!(props.prefs.keyword.trim()||props.prefs.status))
const expansionSnapshot=ref<string[]|null>(null)
const shown=(key:string)=>props.prefs.columns.includes(key)
const numberColumns=computed(()=>(['models','spus','skus','pending','materials'] as CatalogMetricKind[]).filter(shown))
function resolvedExpanded(){return props.prefs.treeExpandReady?props.prefs.expandedIds:defaultCatalogTreeExpandedIds(props.index.categories)}
const projection=computed(()=>projectCatalogCategories({categories:props.index.categories,layout:layout.value,sort:props.prefs.sort,keyword:props.prefs.keyword,status:props.prefs.status,expandedIds:resolvedExpanded()}))
const emptyText=computed(()=>({none:'当前没有分类',search:'没有匹配的分类',status:'当前状态筛选无结果',both:'没有同时符合搜索和状态筛选的分类','':'没有可显示的分类'})[projection.value.empty])
const page=computed(()=>Math.min(props.prefs.page,Math.max(1,Math.ceil(projection.value.rows.length/props.prefs.pageSize)||1)))
const pagedRows=computed(()=>layout.value==='tree'?projection.value.rows:projection.value.rows.slice((page.value-1)*props.prefs.pageSize,page.value*props.prefs.pageSize))
const metricMap=computed(()=>new Map(pagedRows.value.map(row=>[row.id,props.index.categoryMetrics(row.id,props.includeDescendants)])))
const metrics=(id:string)=>metricMap.value.get(id)||props.index.categoryMetrics(id,props.includeDescendants)
const types=(id:string)=>props.index.details('types',metrics(id).types.ids)
const path=(id:string)=>categoryPathLabel(props.index.categories,id)
function seedTree(){if(layout.value==='list'||props.prefs.treeExpandReady)return;emit('update:prefs',{...props.prefs,treeExpandReady:true,expandedIds:defaultCatalogTreeExpandedIds(props.index.categories)})}
function open(id:string,kind:CatalogMetricKind){const metric=metrics(id)[kind];if(metric.readable)emit('details',{kind,ids:[...metric.ids],title:`${path(id)} · ${labels[kind]}（${props.includeDescendants?'包含下级':'仅本级'}）`})}
function toggle(id:string){const expanded=new Set(resolvedExpanded());if(expanded.has(id))expanded.delete(id);else expanded.add(id);emit('update:prefs',{...props.prefs,treeExpandReady:true,expandedIds:[...expanded]})}
function setPage(page:number){emit('update:prefs',{...props.prefs,page})}
function resizeColumn(width:number,_old:number,column:{property?:string}){if(column.property)emit('update:prefs',{...props.prefs,widths:{...props.prefs.widths,[column.property]:width}})}
function rowClass({row}:{row:CatalogCategoryProjectionRow}){return [row.id===props.categoryId?'is-current-category':'',row.relation==='path'?'is-path-ancestor':'',row.anomalyLead?'is-anomaly-lead':''].filter(Boolean).join(' ')}
onMounted(seedTree)
watch(layout,()=>seedTree())
watch(filterActive,(active,previous)=>{if(active&&!previous)expansionSnapshot.value=[...resolvedExpanded()];if(!active&&previous&&expansionSnapshot.value){const expandedIds=expansionSnapshot.value;expansionSnapshot.value=null;if(!props.prefs.treeExpandReady||expandedIds.join('|')!==props.prefs.expandedIds.join('|'))emit('update:prefs',{...props.prefs,treeExpandReady:true,expandedIds})}},{immediate:true})
</script>
<style scoped>
.catalog-summary-table{min-width:0;display:flex;flex-direction:column;gap:8px}.category-cell{display:flex;align-items:center;gap:6px;min-width:0}.category-text{display:flex;flex-direction:column;min-width:0}.twist{width:22px;height:22px;flex:none;border:1px solid var(--el-border-color);border-radius:4px;background:var(--el-fill-color-blank);color:var(--el-text-color-primary);cursor:pointer;padding:0}.twist-spacer{border-color:transparent;background:transparent}.folder{flex:none;color:var(--el-text-color-secondary);font-size:15px}.category-name{border:0;background:none;color:var(--el-text-color-primary);font:inherit;text-align:left;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0}.category-name.root{font-weight:650}.category-name[aria-pressed=true]{color:var(--el-color-primary)}.category-path{color:var(--el-text-color-secondary);font-size:12px;line-height:1.35}.metric-link{border:0;background:none;padding:2px 0;color:var(--el-color-primary);font:inherit;font-variant-numeric:tabular-nums;cursor:pointer}.type-tags{display:flex;gap:6px;align-items:center;max-width:220px}.type-tags>span{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:95px;color:var(--el-text-color-secondary)}.table-foot{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center;padding:8px 0}.muted{font-size:12px;color:var(--el-text-color-secondary)}mark{background:color-mix(in srgb,var(--el-color-primary) 25%,transparent);color:inherit}:deep(.is-current-category){--el-table-tr-bg-color:color-mix(in srgb,var(--el-color-primary) 8%,var(--el-bg-color))}:deep(.is-path-ancestor) .category-name{color:var(--el-text-color-secondary);font-weight:500}:deep(.is-anomaly-lead td){border-top:2px solid var(--el-color-warning)}:deep(.el-table .cell){line-height:22px}button:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:2px}
</style>
