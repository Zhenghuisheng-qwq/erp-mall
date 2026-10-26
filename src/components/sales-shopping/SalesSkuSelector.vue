<template>
  <div class="sales-sku-selector">
    <div v-if="dimensions.length" class="spec-fields">
      <label v-for="dimension in dimensions" :key="dimension.id"><span :title="dimension.id">{{dimension.label}}</span><el-select :model-value="selection[dimension.id]" clearable :aria-label="`选择规格 ${dimension.label}`" :data-sales-spec-attribute="dimension.id" @change="(value:string)=>choose(dimension.id,value)"><el-option v-for="value in optionsFor(dimension.id)" :key="value" :value="value" :label="value"/></el-select></label>
    </div>
    <div class="spec-summary"><span>{{matches.length}} 个实际在售规格</span><el-button v-if="Object.keys(selection).length||modelValue" link @click="clearSelection">清除规格选择</el-button></div>
    <p v-if="ambiguous" class="muted">部分历史规格无法按属性唯一识别，请选择实际商品规格。</p>
    <p v-if="!matches.length" class="muted" role="status" data-sales-no-matching-sku>没有符合条件的在售规格，请调整或清除规格选择。</p>
    <p v-else-if="!modelValue" class="muted" role="status">请选择具体规格后加入清单。</p>
    <div class="sku-options"><button v-for="sku in matches.slice(0,shown)" :key="sku.id" :data-sales-sku="sku.id" :class="{selected:modelValue===sku.id}" :aria-pressed="modelValue===sku.id" @click="selectSku(sku.id)"><strong>{{label(sku.id)||sku.skuName||sku.code}}</strong><small>{{savedSkuCode(sku)}}</small></button></div>
    <el-button v-if="matches.length>shown" link @click="shown+=12">继续查看 {{Math.min(12,matches.length-shown)}} 个规格</el-button>
  </div>
</template>
<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import type {AppData,ProductFamily,Sku} from '../../domain/types'
import {actualSkuAttributes} from '../../domain/actualSkuAttributes'
import {savedSkuCode} from '../../domain/productList'
const props=defineProps<{data:AppData;family:ProductFamily;skus:Sku[];modelValue:string;label:(id:string)=>string}>()
const emit=defineEmits<{'selection-state':[state:SalesSkuSelectionState]}>()
import type {SalesSkuSelectionState} from './salesSkuSelection'
let emittedId:string|undefined
const selection=ref<Record<string,string>>({}),shown=ref(12)
const rows=computed(()=>props.skus.map(sku=>({sku,...actualSkuAttributes(props.data,props.family,sku)})))
const dimensions=computed(()=>props.data.params.flatMap(param=>{const values=new Set(rows.value.map(row=>row.attributes[param.id]).filter(Boolean));return values.size>1?[{id:param.id,label:props.data.params.filter(other=>other.name===param.name).length>1?`${param.name}（${param.id}）`:param.name}]:[]}))
const ambiguous=computed(()=>rows.value.some(row=>row.conflicts.length)||new Set(rows.value.map(row=>JSON.stringify(Object.entries(row.attributes).sort(([a],[b])=>a.localeCompare(b))))).size<rows.value.length)
const matches=computed(()=>rows.value.filter(row=>Object.entries(selection.value).every(([id,value])=>row.attributes[id]===value)).map(row=>row.sku))
function optionsFor(id:string){return [...new Set(rows.value.filter(row=>Object.entries(selection.value).every(([other,value])=>other===id||row.attributes[other]===value)).map(row=>row.attributes[id]).filter((value):value is string=>!!value))]}
function publish(selectedSkuId:string,reason:SalesSkuSelectionState['reason']){emittedId=selectedSkuId;emit('selection-state',{familyId:props.family.id,selectedSkuId,matchingSkuIds:matches.value.map(sku=>sku.id),reason})}
function reconcile(reason:SalesSkuSelectionState['reason'],autoUnique=false){const current=matches.value.some(sku=>sku.id===props.modelValue)?props.modelValue:'';publish(current||(autoUnique&&matches.value.length===1?matches.value[0]!.id:''),reason)}
function choose(id:string,value?:string){const next={...selection.value};if(value)next[id]=value;else delete next[id];selection.value=next;shown.value=12;reconcile('filter',true)}
function clearSelection(){selection.value={};shown.value=12;publish('','clear')}
function selectSku(id:string){publish(matches.value.some(sku=>sku.id===id)?id:'','select')}
watch(()=>[props.family.id,props.modelValue] as const,([familyId,id],previous)=>{const oldFamilyId=previous?.[0];if(familyId!==oldFamilyId){selection.value={};shown.value=12;emittedId=undefined}if(id===emittedId){emittedId=undefined;return}if(id&&!matches.value.some(sku=>sku.id===id))selection.value={};reconcile('external')},{immediate:true})
watch(rows,()=>reconcile('catalog'),{deep:true})
// Parent reads the current computed match set again immediately before adding.
function allows(id:string){return !!id&&id===props.modelValue&&matches.value.some(sku=>sku.id===id&&sku.status==='on_sale')}
defineExpose({allows})
</script>
<style scoped>
.spec-fields{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}.spec-fields label{display:flex;flex-direction:column;gap:5px;min-width:120px;flex:1}.spec-fields label>span,.spec-summary,.muted{font-size:12px;color:var(--el-text-color-secondary)}.spec-summary{display:flex;align-items:center;gap:8px;margin:10px 0}.sku-options{display:flex;gap:8px;flex-wrap:wrap}.sku-options button{border:1px solid var(--el-border-color);background:var(--el-bg-color);color:var(--el-text-color-primary);padding:9px;border-radius:6px;cursor:pointer;max-width:100%;text-align:left}.sku-options button.selected{border-color:var(--el-color-primary);background:var(--el-color-primary-light-9)}.sku-options strong,.sku-options small{display:block;line-height:1.7;font-size:12px}.sku-options small{color:var(--el-text-color-secondary)}button:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:2px}
</style>
