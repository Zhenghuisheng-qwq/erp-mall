<template>
  <section class="catalog-summary-table" data-catalog-category-summary>
    <el-table :data="pagedRows" row-key="id" :row-class-name="rowClass" @header-dragend="resizeColumn">
      <el-table-column prop="name" label="分类名称" :width="prefs.widths.name || 300" fixed="left">
        <template #default="{row}">
          <div class="category-cell" :style="{paddingLeft:`${row.depth*16}px`}">
            <button v-if="row.hasChildren" class="twist" type="button" :data-catalog-expand="row.id" :aria-expanded="row.expanded" :aria-label="`${row.expanded?'折叠':'展开'} ${row.name}`" @click="toggle(row.id)">{{row.expanded?'▾':'▸'}}</button><span v-else class="twist"></span>
            <button class="category-name" type="button" :data-catalog-category="row.id" :title="`${path(row.id)}（${row.id}）`" :aria-pressed="categoryId===row.id" @click="emit('select',row.id)"><template v-for="(part,i) in highlightParts(row.name,prefs.keyword)" :key="i"><mark v-if="part.hit">{{part.text}}</mark><template v-else>{{part.text}}</template></template></button>
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
      <el-table-column label="操作" width="110"><template #default="{row}"><el-button link @click="emit('select',row.id)">{{categoryId===row.id?'当前范围':'查看此范围'}}</el-button></template></el-table-column>
      <template #empty><el-empty description="没有匹配的分类" :image-size="72" /></template>
    </el-table>
    <div class="table-foot"><span class="muted">{{rows.length}} 个可见分类 · 各行按该分类{{includeDescendants?'及下级':'本级'}}统计</span><el-pagination small background layout="prev,pager,next" :total="rows.length" :page-size="prefs.pageSize" :current-page="page" @current-change="setPage" /></div>
  </section>
</template>
<script setup lang="ts">
import {computed} from 'vue'
import {categoryChain,categoryPathLabel,highlightParts,visibleCategoryRows} from '../../domain/categoryTree'
import {CATALOG_SPU_DEFINITION,type CatalogMetricKind,type CatalogWorkspaceIndex} from '../../domain/catalogWorkspaceQuery'
import type {CatalogViewPreferences} from './catalogWorkspaceState'
const props=defineProps<{index:CatalogWorkspaceIndex;prefs:CatalogViewPreferences;categoryId:string;includeDescendants:boolean}>()
const emit=defineEmits<{'update:prefs':[value:CatalogViewPreferences];select:[id:string];details:[value:{kind:CatalogMetricKind;ids:string[];title:string} ]}>()
const labels:Record<CatalogMetricKind,string>={types:'关联产品类型',models:'模型数',spus:'SPU 数',skus:'销售 SKU 数',materials:'MAT 数',pending:'待处理'}
const shown=(key:string)=>props.prefs.columns.includes(key)
const numberColumns=computed(()=>(['models','spus','skus','pending','materials'] as CatalogMetricKind[]).filter(shown))
const rows=computed(()=>{
  const source=[...props.index.categories]
  if(props.prefs.sort==='name'||props.prefs.sort==='name-desc')source.sort((a,b)=>(props.prefs.sort==='name-desc'?-1:1)*a.name.localeCompare(b.name,'zh')||a.id.localeCompare(b.id))
  else if(props.prefs.sort==='status')source.sort((a,b)=>Number(a.enabled===false)-Number(b.enabled===false)||a.name.localeCompare(b.name,'zh')||a.id.localeCompare(b.id))
  const categories=source.map((row,i)=>({...row,sort:i})),expanded=new Set(props.prefs.expandedIds)
  const keyword=props.prefs.keyword.trim().toLocaleLowerCase(),status=props.prefs.status,matched=new Set<string>()
  if(keyword||status)for(const row of categories)if((!keyword||`${row.name} ${row.id}`.toLocaleLowerCase().includes(keyword))&&(!status||(status==='disabled')===(row.enabled===false))){matched.add(row.id);for(const ancestor of categoryChain(categories,row.id)){matched.add(ancestor.id);if(ancestor.id!==row.id)expanded.add(ancestor.id)}}
  return visibleCategoryRows(categories,expanded,'').filter(row=>!keyword&&!status||matched.has(row.id))
})
const page=computed(()=>Math.min(props.prefs.page,Math.max(1,Math.ceil(rows.value.length/props.prefs.pageSize))))
const pagedRows=computed(()=>rows.value.slice((page.value-1)*props.prefs.pageSize,page.value*props.prefs.pageSize))
const metricMap=computed(()=>new Map(pagedRows.value.map(row=>[row.id,props.index.categoryMetrics(row.id,props.includeDescendants)])))
const metrics=(id:string)=>metricMap.value.get(id)||props.index.categoryMetrics(id,props.includeDescendants)
const types=(id:string)=>props.index.details('types',metrics(id).types.ids)
const path=(id:string)=>categoryPathLabel(props.index.categories,id)
function open(id:string,kind:CatalogMetricKind){const metric=metrics(id)[kind];if(metric.readable)emit('details',{kind,ids:[...metric.ids],title:`${path(id)} · ${labels[kind]}（${props.includeDescendants?'包含下级':'仅本级'}）`})}
function toggle(id:string){const expanded=new Set(props.prefs.expandedIds);if(expanded.has(id))expanded.delete(id);else expanded.add(id);emit('update:prefs',{...props.prefs,expandedIds:[...expanded]})}
function setPage(page:number){emit('update:prefs',{...props.prefs,page})}
function resizeColumn(width:number,_old:number,column:{property?:string}){if(column.property)emit('update:prefs',{...props.prefs,widths:{...props.prefs.widths,[column.property]:width}})}
function rowClass({row}:{row:{id:string}}){return row.id===props.categoryId?'is-current-category':''}
</script>
<style scoped>
.catalog-summary-table{min-width:0}.category-cell{display:flex;align-items:center;gap:5px;min-width:0}.twist{width:20px;flex:none;border:0;background:none;color:var(--el-text-color-regular);cursor:pointer}.category-name{border:0;background:none;color:var(--el-text-color-primary);font:inherit;text-align:left;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.category-name[aria-pressed=true]{font-weight:650;color:var(--el-color-primary)}.metric-link{border:0;background:none;padding:2px 0;color:var(--el-color-primary);font:inherit;cursor:pointer}.type-tags{display:flex;gap:6px;align-items:center;max-width:220px}.type-tags>span{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:95px;color:var(--el-text-color-secondary)}.table-foot{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center;padding:12px 0}.muted{font-size:12px;color:var(--el-text-color-secondary)}mark{background:color-mix(in srgb,var(--el-color-primary) 25%,transparent);color:inherit}:deep(.is-current-category){--el-table-tr-bg-color:color-mix(in srgb,var(--el-color-primary) 7%,var(--el-bg-color))}button:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:2px}
</style>
