<template>
 <el-dialog class="public-spu-dialog" :model-value="open" :title="poolOnly?'选择公共商品（SPU）':'从商品库添加 SPU'" width="min(1220px,96vw)" align-center append-to-body :close-on-click-modal="false" :before-close="close" @update:model-value="emit('update:open',$event)">
  <div class="spu-picker" data-public-spu-picker>
   <div class="picker-layout">
    <aside class="picker-tree" data-public-spu-tree><h3>分类与产品类型</h3><CatalogScopeTree :categories="data.categories" :types="catalogIndex.typeRows" :category-id="filter.categoryId" :scope-type-id="filter.productTypeId" :expanded-ids="expanded" @expand="expanded=$event" @select="selectCategory" @select-type="selectType"/></aside>
    <div class="picker-main"><div class="filters">
    <el-input v-model="filter.keyword" clearable placeholder="搜索 SPU 名称、ID 或商品编号" aria-label="公共SPU关键词"/>
    <div v-if="filter.categoryId" class="category-caption">{{categoryPathLabel(data.categories,filter.categoryId)}}<el-button text @click="selectCategory('')">清除分类</el-button></div>
    <el-select v-model="filter.productTypeId" clearable filterable placeholder="全部产品类型" aria-label="公共SPU产品类型"><el-option v-for="t in types" :key="t.id" :label="t.name" :value="t.id"/></el-select>
    <el-select v-model="filter.modelId" clearable filterable placeholder="全部商品模型" aria-label="公共SPU商品模型"><el-option v-for="m in models" :key="m.id" :label="m.name" :value="m.id"/></el-select>
    <el-select v-if="brands.length" v-model="filter.brand" clearable placeholder="全部品牌" aria-label="公共SPU品牌"><el-option v-for="name in brands" :key="name" :value="name" :label="name"/></el-select>
    <el-select v-model="filter.status" placeholder="全部销售状态" aria-label="公共SPU销售状态"><el-option label="全部销售状态" value=""/><el-option label="在售" value="on"/><el-option label="非在售" value="off"/></el-select>
    <el-select v-if="!poolOnly" v-model="filter.joined" placeholder="全部加入状态" aria-label="公共SPU已加入状态"><el-option label="全部加入状态" value=""/><el-option label="已加入公共池" value="yes"/><el-option label="未加入公共池" value="no"/></el-select>
    <el-button @click="reset">重置筛选</el-button>
   </div>
   <p v-if="!poolOnly" class="identity-note">物料建档产生的 SPU 也可加入；物料不计入销售规格，选购时仍须有真实销售 SKU。</p>
   <div class="selection-tools"><span>{{rows.length}} 个 SPU</span><el-button text @click="selectPage(true)">全选本页</el-button><el-button text @click="selectPage(false)">取消本页</el-button><el-button text :disabled="busy" @click="refresh">刷新候选</el-button></div>
   <el-table :data="pageRows" max-height="max(220px, calc(100vh - 600px))" row-key="id" data-public-spu-table>
    <template #empty><p>{{poolOnly?'当前筛选下没有已启用的公共 SPU':'当前筛选下没有 SPU，可重置筛选或到 SPU 管理核对归属分类和产品类型。'}}</p></template>
    <el-table-column width="46"><template #default="{row}"><el-checkbox :model-value="selected.includes(row.id)||!poolOnly&&!!row.entry" :disabled="busy||!poolOnly&&!!row.entry" :aria-label="`选择SPU ${row.name}`" :data-pick-public-spu="row.id" @change="toggle(row.id,Boolean($event))"/></template></el-table-column>
    <el-table-column label="SPU 名称" min-width="220"><template #default="{row}"><el-button v-if="store.canRoute({path:'/spus/'+row.id})" link @click="router.push('/spus/'+row.id)">{{row.name}}</el-button><strong v-else>{{row.name}}</strong><small>{{row.code||row.id}}</small><el-tag v-if="row.entry" size="small" :type="row.entry.enabled?'info':'warning'">已加入{{row.entry.enabled?'':' · 停用'}}</el-tag></template></el-table-column>
    <el-table-column prop="typeName" label="产品类型" min-width="100"/>
    <el-table-column prop="categoryPath" label="所属分类" min-width="130" show-overflow-tooltip/>
    <el-table-column label="SKU 数量与状态" min-width="150"><template #default="{row}">{{row.skuCount?row.skuCount+' 个销售规格':'暂无销售规格'}}<small v-if="!row.skuCount&&row.materialCount">已建 {{row.materialCount}} 条物料，{{row.entry?'待补销售规格':'可先加入公共池'}}</small><small>{{row.onSale?'在售':'非在售'}}</small></template></el-table-column>
   </el-table>
   <el-pagination v-model:current-page="page" v-model:page-size="size" :page-sizes="[20,50]" :total="rows.length" layout="total, sizes, prev, pager, next"/>
   <details class="selected" open><summary>已选 {{selected.length}} 个 SPU（切换筛选和翻页保留）</summary><div class="tags"><el-tag v-for="id in selected" :key="id" closable :data-selected-public-spu="id" @close="toggle(id,false)">{{data.families.find(f=>f.id===id)?.name||'商品引用失效'}}</el-tag><el-button v-if="selected.length" text @click="selected=[]">清空已选</el-button></div></details>
   <el-alert v-if="error" :title="error" type="error" :closable="false"/>
    </div>
   </div>
  </div>
  <template #footer><el-button :disabled="busy" @click="close">取消</el-button><el-button type="primary" :loading="busy" data-confirm-public-spus @click="emit('confirm',[...selected],basis)">{{poolOnly?'应用公共商品':'加入公共池'}}</el-button></template>
 </el-dialog>
</template>
<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {useRouter} from 'vue-router'
import CatalogScopeTree from '../catalog-workspace/CatalogScopeTree.vue'
import {useCatalogStore} from '../../stores/catalog'
import type {AppData} from '../../domain/types'
import {categoryChain,categoryPathLabel} from '../../domain/categoryTree'
import {buildCatalogWorkspaceIndex} from '../../domain/catalogWorkspaceQuery'
import {emptyPublicSpuFilter,filterPublicSpus,publicSpuRows,publicPoolBasis} from '../../domain/benefitSales/publicSpuPool'
const props=defineProps<{open:boolean;data:AppData;modelValue?:string[];poolOnly?:boolean;busy?:boolean;error?:string}>(),emit=defineEmits<{'update:open':[value:boolean];confirm:[ids:string[],basis:string]}>()
const store=useCatalogStore(),router=useRouter(),filter=ref(emptyPublicSpuFilter()),selected=ref<string[]>([]),page=ref(1),size=ref(20),basis=ref(''),expanded=ref<string[]>([])
const catalogue=computed(()=>publicSpuRows(props.data)),rows=computed(()=>filterPublicSpus(props.data,filter.value,props.poolOnly)),pageRows=computed(()=>rows.value.slice((page.value-1)*size.value,page.value*size.value))
const types=computed(()=>props.data.productTypes.filter(t=>t.status==='enabled'&&(!filter.value.categoryId||categoryChain(props.data.categories,t.categoryId).some(c=>c.id===filter.value.categoryId))))
const catalogIndex=computed(()=>buildCatalogWorkspaceIndex(props.data))
const models=computed(()=>catalogIndex.value.modelRows.filter(m=>(!filter.value.productTypeId||m.productTypeId===filter.value.productTypeId)&&(!filter.value.categoryId||m.categoryIds.some(id=>categoryChain(props.data.categories,id).some(c=>c.id===filter.value.categoryId)))))
const brands=computed(()=>[...new Set(catalogue.value.flatMap(r=>r.brands))].sort())
watch(()=>props.open,on=>{if(on){selected.value=[...(props.modelValue||[])];reset();basis.value=publicPoolBasis(props.data)}})
watch(filter,()=>page.value=1,{deep:true})
watch(()=>filter.value.categoryId,()=>{if(!types.value.some(t=>t.id===filter.value.productTypeId))filter.value.productTypeId='';if(!models.value.some(m=>m.id===filter.value.modelId))filter.value.modelId=''})
watch(()=>filter.value.productTypeId,()=>{if(!models.value.some(m=>m.id===filter.value.modelId))filter.value.modelId=''})
watch(()=>[store.activeUserId,store.previewUserId],()=>{selected.value=[];emit('update:open',false)})
function selectCategory(id:string){filter.value.categoryId=id;filter.value.productTypeId=''}
function selectType(id:string){const type=props.data.productTypes.find(t=>t.id===id);if(type){filter.value.categoryId=type.categoryId;filter.value.productTypeId=id}}
function toggle(id:string,on:boolean){selected.value=on?[...new Set([...selected.value,id])]:selected.value.filter(value=>value!==id)}
function selectPage(on:boolean){for(const row of pageRows.value)if(props.poolOnly||!row.entry)toggle(row.id,on)}
function reset(){filter.value=emptyPublicSpuFilter();page.value=1}
function refresh(){basis.value=publicPoolBasis(props.data)}
function close(){if(!props.busy)emit('update:open',false)}
</script>
<style scoped>
:global(.public-spu-dialog .el-dialog__body){max-height:calc(100vh - 180px);overflow:auto}.picker-layout{display:grid;grid-template-columns:220px minmax(0,1fr);gap:20px}.picker-tree{border-right:1px solid var(--el-border-color-light);padding-right:16px;min-width:0}.picker-tree h3{font-size:14px;margin:0 0 12px}.picker-main{min-width:0}.category-caption{display:flex;align-items:center;font-size:12px;color:var(--el-text-color-secondary)}.filters{display:flex;gap:10px;flex-wrap:wrap}.filters>.el-input{width:290px}.filters>.el-select,.filters>.category-tree-select{width:190px}.selection-tools{display:flex;align-items:center;gap:8px;margin:14px 0;color:var(--el-text-color-secondary);font-size:13px}small{display:block;color:var(--el-text-color-secondary);font-size:12px;margin:4px 0}.el-pagination{margin:16px 0;flex-wrap:wrap}.selected{border-top:1px solid var(--el-border-color-light);padding-top:12px;font-size:13px}.tags{max-height:100px;overflow:auto;display:flex;flex-wrap:wrap;gap:8px;padding:12px 0}.el-alert{margin-top:12px}.el-table .el-button{white-space:normal;text-align:left}
@media(max-width:760px){.picker-layout{grid-template-columns:1fr}.picker-tree{border-right:0;border-bottom:1px solid var(--el-border-color-light);padding-right:0;padding-bottom:12px}.picker-tree:deep(.scope-tree-scroll){max-height:160px}}
</style>
