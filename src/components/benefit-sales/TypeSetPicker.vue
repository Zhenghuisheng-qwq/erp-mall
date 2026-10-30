<template>
 <div class="type-picker">
  <div class="tools"><span v-if="categoryOnly">仅当前归属分类</span><el-radio-group v-else v-model="scope"><el-radio-button value="local" :disabled="!categoryId">本分类</el-radio-button><el-radio-button value="all">全目录</el-radio-button></el-radio-group><el-input v-model="keyword" placeholder="搜索分类和产品类型" aria-label="搜索参与类型" clearable/><el-button @click="collapseAll(false)">展开全部</el-button><el-button @click="collapseAll(true)">收起全部</el-button></div>
  <div class="tree" role="group" aria-label="参与产品类型目录"><div v-for="row in visible" :key="row.key" :style="{paddingLeft:`${depth(row.key)*16}px`}" class="tree-row">
   <el-button v-if="row.kind==='category'" text :aria-label="`展开收起 ${row.name}`" @click="toggle(row.key)">{{activeCollapsed.includes(row.key)?'＋':'−'}}</el-button><span v-else class="spacer"/>
   <el-checkbox :model-value="checked(row.key)" :indeterminate="partial(row.key)" :disabled="disabled||!ids(row.key).length" :aria-label="`选择${row.kind==='category'?'分类':'类型'} ${row.name}`" :data-type-choice="row.kind==='product-type'?row.id:undefined" @change="set(row.key,Boolean($event))"><el-icon><Folder v-if="row.kind==='category'"/><CollectionTag v-else/></el-icon> {{row.name}} <small>{{row.kind==='product-type'?'产品类型':''}}{{row.disabled?' · 停用':''}}</small></el-checkbox>
  </div><p v-if="!visible.length">没有匹配的分类或产品类型</p></div>
  <div class="selected" aria-label="已选产品类型"><span>已选 {{modelValue.length}} 项</span><el-tag v-for="id in modelValue" :key="id" :closable="!disabled" @close="emit('update:modelValue',modelValue.filter(x=>x!==id))">{{data.productTypes.find(t=>t.id===id)?.name||'类型已失效'}}<small v-if="categoryOnly&&data.productTypes.find(t=>t.id===id)?.categoryId!==categoryId"> · 不在当前分类，请移除</small><small v-if="!hasSku(id)"> · 暂无销售 SKU</small></el-tag></div>
 </div>
</template>
<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {Folder,CollectionTag} from '@element-plus/icons-vue'
import {buildCatalogWorkspaceIndex} from '../../domain/catalogWorkspaceQuery'
import {catalogScopeNodes,filterCatalogScopeNodes,type CatalogScopeNode} from '../../domain/catalogScopeTree'
import {typeProblem} from '../../domain/benefitSales/query'
import {familyProductTypeId} from '../../domain/productIdentity'
import {isRealSku} from '../../domain/catalogIdentity'
import type {AppData} from '../../domain/types'
const props=defineProps<{data:AppData;categoryId:string;modelValue:string[];disabled?:boolean;categoryOnly?:boolean}>(),emit=defineEmits<{'update:modelValue':[ids:string[]]}>()
const keyword=ref(''),scope=ref('all'),collapsed=ref<string[]>([])
const nodes=computed(()=>catalogScopeNodes(props.data.categories,buildCatalogWorkspaceIndex(props.data).typeRows))
const byKey=computed(()=>new Map(nodes.value.map(n=>[n.key,n])))
function beneath(key:string,parent:string){let n=byKey.value.get(key);const seen=new Set<string>();while(n&&!seen.has(n.key)){if(n.key===parent)return true;seen.add(n.key);n=n.parentKey?byKey.value.get(n.parentKey):undefined}return false}
function ids(key:string){return nodes.value.filter(n=>n.kind==='product-type'&&beneath(n.key,key)&&(!props.categoryOnly||props.data.productTypes.find(t=>t.id===n.id)?.categoryId===props.categoryId)&&!typeProblem(props.data,n.id)).map(n=>n.id)}
function checked(key:string){const choices=ids(key);return choices.length>0&&choices.every(id=>props.modelValue.includes(id))}
function partial(key:string){const choices=ids(key);return choices.some(id=>props.modelValue.includes(id))&&!checked(key)}
function set(key:string,on:boolean){const choices=ids(key);emit('update:modelValue',on?[...new Set([...props.modelValue,...choices])]:props.modelValue.filter(id=>!choices.includes(id)))}
const searchCollapsed=ref<string[]>([])
const activeCollapsed=computed(()=>keyword.value.trim()?searchCollapsed.value:collapsed.value)
watch(keyword,()=>{searchCollapsed.value=[]})
const visible=computed(()=>{
 const scoped=props.categoryOnly?nodes.value.filter(n=>n.key===`category:${props.categoryId}`||n.kind==='product-type'&&props.data.productTypes.find(t=>t.id===n.id)?.categoryId===props.categoryId):nodes.value
 const filtered=filterCatalogScopeNodes(scoped,keyword.value),children=new Map<string|null,CatalogScopeNode[]>()
 for(const row of filtered){const list=children.get(row.parentKey)||[];list.push(row);children.set(row.parentKey,list)}
 const result:CatalogScopeNode[]=[]
 function visit(rows:CatalogScopeNode[]){for(const row of rows){result.push(row);if(!activeCollapsed.value.includes(row.key))visit(children.get(row.key)||[])}}
 visit(props.categoryOnly||scope.value==='local'&&props.categoryId?filtered.filter(row=>row.key===`category:${props.categoryId}`):children.get(null)||[]);return result
})
function depth(key:string){let d=0,n=byKey.value.get(key);const seen=new Set<string>();while(n?.parentKey&&!seen.has(n.key)){seen.add(n.key);d++;n=byKey.value.get(n.parentKey)}return d}
function collapseAll(value:boolean){const target=keyword.value.trim()?searchCollapsed:collapsed;target.value=value?nodes.value.filter(n=>n.kind==='category').map(n=>n.key):[]}
function toggle(key:string){const target=keyword.value.trim()?searchCollapsed:collapsed;target.value=target.value.includes(key)?target.value.filter(k=>k!==key):[...target.value,key]}
function hasSku(id:string){return props.data.skus.some(s=>isRealSku(props.data,s)&&familyProductTypeId(props.data,s.familyId)===id)}
</script>
<style scoped>.tools,.selected{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.tools .el-input{max-width:250px}.tree{max-height:300px;overflow:auto;border:1px solid var(--el-border-color);border-radius:6px;margin:10px 0;padding:8px}.tree-row{display:flex;align-items:center;min-height:32px}.tree-row .el-button,.spacer{width:28px;flex:none;margin:0;padding:0}small{font-size:12px;color:var(--el-text-color-secondary);font-weight:normal}.selected{padding:8px 0}.el-icon{vertical-align:middle}</style>
