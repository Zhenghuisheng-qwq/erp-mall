<template>
  <div class="scope-tree">
    <el-input v-model="keyword" clearable placeholder="搜索分类或产品类型" aria-label="搜索分类或产品类型" />
    <button type="button" class="all-categories" :aria-pressed="!categoryId&&!scopeTypeId" @click="emit('select','')">全部分类</button>
    <div class="scope-tree-scroll" tabindex="0" aria-label="分类与产品类型目录"><ul>
      <li v-for="row in rows" :key="row.key" :style="{paddingLeft:`${row.depth*14}px`}">
        <button v-if="row.hasChildren" type="button" class="twist" :aria-label="`${row.expanded?'折叠':'展开'} ${row.name}`" :aria-expanded="row.expanded" @click="toggle(row.id)"><el-icon><ArrowDown v-if="row.expanded"/><ArrowRight v-else/></el-icon></button><span v-else class="twist"/>
        <button type="button" class="node" :data-catalog-tree-category="row.kind==='category'?row.id:undefined" :data-catalog-tree-type="row.kind==='product-type'?row.id:undefined" :aria-pressed="row.kind==='category'?!scopeTypeId&&categoryId===row.id:scopeTypeId===row.id" :title="`${row.path}（${row.id}）`" @click="row.kind==='category'?emit('select',row.id):emit('selectType',row.id)">
          <el-icon><Folder v-if="row.kind==='category'"/><CollectionTag v-else/></el-icon><span class="name">{{row.name}}</span><small v-if="row.kind==='product-type'">类型</small><small v-if="row.disabled">停用</small>
        </button>
      </li>
    </ul><p v-if="!rows.length" class="empty">没有匹配的分类或产品类型</p></div>
  </div>
</template>
<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {ArrowDown,ArrowRight,Folder,CollectionTag} from '@element-plus/icons-vue'
import {categoryChain} from '../../domain/categoryTree'
import {catalogScopeNodes,filterCatalogScopeNodes,type CatalogScopeNode} from '../../domain/catalogScopeTree'
import type {Category} from '../../domain/types'
import type {CatalogTypeRow} from '../../domain/catalogWorkspaceQuery'
const props=defineProps<{categories:Category[];types:CatalogTypeRow[];categoryId:string;scopeTypeId:string;expandedIds:string[]}>()
const emit=defineEmits<{select:[id:string];selectType:[id:string];expand:[ids:string[]]}>(),keyword=ref(''),searchExpanded=ref<string[]>([])
const nodes=computed(()=>catalogScopeNodes(props.categories,props.types)),filtered=computed(()=>filterCatalogScopeNodes(nodes.value,keyword.value))
const selectedCategory=computed(()=>props.scopeTypeId?props.types.find(row=>row.id===props.scopeTypeId&&row.scopeEligible)?.categoryIds[0]||props.categoryId:props.categoryId)
watch([selectedCategory,()=>props.scopeTypeId],()=>{const expanded=new Set(props.expandedIds),chain=categoryChain(props.categories,selectedCategory.value);for(const parent of props.scopeTypeId?chain:chain.slice(0,-1))expanded.add(parent.id);if(expanded.size!==props.expandedIds.length)emit('expand',[...expanded])},{immediate:true})
// Initialize search expansion once per query; manual collapse remains effective.
watch(keyword,()=>{searchExpanded.value=filtered.value.filter(row=>row.kind==='category').map(row=>row.id)})
const rows=computed(()=>{
  const expanded=new Set(keyword.value.trim()?searchExpanded.value:props.expandedIds),children=new Map<string|null,CatalogScopeNode[]>()
  for(const row of filtered.value){const list=children.get(row.parentKey)||[];list.push(row);children.set(row.parentKey,list)}
  const result:(CatalogScopeNode&{depth:number;expanded:boolean;hasChildren:boolean})[]=[]
  function visit(parent:string|null,depth:number){for(const row of children.get(parent)||[]){const hasChildren=children.has(row.key),open=row.kind==='category'&&expanded.has(row.id);result.push({...row,depth,hasChildren,expanded:open});if(open)visit(row.key,depth+1)}}
  visit(null,0);return result
})
function toggle(id:string){const expanded=new Set(keyword.value.trim()?searchExpanded.value:props.expandedIds);if(expanded.has(id))expanded.delete(id);else expanded.add(id);if(keyword.value.trim())searchExpanded.value=[...expanded];else emit('expand',[...expanded])}
</script>
<style scoped>
.scope-tree{display:flex;flex-direction:column;gap:8px;min-width:0}.scope-tree-scroll{overflow:auto;max-height:60vh;min-height:100px}ul{list-style:none;margin:0;padding:0}li{display:flex;align-items:center;min-height:32px}button{font:inherit;cursor:pointer;border:0;background:none;color:var(--el-text-color-regular)}.node{display:flex;align-items:center;gap:5px;min-width:0;flex:1;text-align:left;white-space:nowrap;padding:5px 4px}.name{overflow:hidden;text-overflow:ellipsis}.node .el-icon{font-size:15px;flex:none}.twist{display:flex;align-items:center;justify-content:center;width:24px;min-height:28px;flex:none;padding:0}.twist .el-icon{font-size:14px}small,.empty{font-size:12px;color:var(--el-text-color-secondary)}small{flex:none}.all-categories{text-align:left;padding:6px 0}[aria-pressed=true]{color:var(--el-color-primary);background:var(--el-color-primary-light-9);font-weight:600}button:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:-2px}
</style>
