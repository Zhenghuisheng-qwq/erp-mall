<template>
  <section class="exposed-filters" aria-label="常用筛选">
    <div class="exposed-head"><strong>常用筛选</strong><CommonFilterPicker :items="pinOptions" :busy="busy" @add="field=>emit('pin',field)"/><el-button v-if="rows.length>4" link @click="expanded=!expanded">{{expanded?'收起':`展开其余 ${rows.length-4} 项`}}</el-button><el-dropdown v-if="rows.length" trigger="click"><el-button link :disabled="busy" aria-label="常用筛选管理">更多</el-button><template #dropdown><el-dropdown-menu><el-dropdown-item @click="emit('clearAll')">清除常用筛选值</el-dropdown-item><el-dropdown-item @click="emit('unexposeAll')">移出全部</el-dropdown-item><el-dropdown-item @click="emit('advanced')">高级筛选</el-dropdown-item></el-dropdown-menu></template></el-dropdown></div>
    <div class="exposed-grid">
      <div v-for="(row,index) in rows" v-show="expanded||index<4" :key="row.field" class="exposed-field" :class="{'is-active':row.active,'has-error':row.invalid||error}" :data-exposed-field="row.field">
        <div class="exposed-label"><span>{{row.label}}</span><small>{{error?'保存失败':row.invalid?'需修复':pending[row.field]!==undefined?'待应用':row.active?'已生效':'✓ 已固定'}}</small><el-dropdown trigger="click"><el-button link size="small" :disabled="busy" :aria-label="`${row.label}筛选操作`">更多</el-button><template #dropdown><el-dropdown-menu><el-dropdown-item :disabled="index===0" @click="emit('move',row.field,-1)">上移</el-dropdown-item><el-dropdown-item :disabled="index===rows.length-1" @click="emit('move',row.field,1)">下移</el-dropdown-item><el-dropdown-item @click="emit('unexpose',row.field)">移出常用筛选</el-dropdown-item><el-dropdown-item @click="emit('advanced')">{{operatorLabel(row.operator)}} · 编辑条件</el-dropdown-item></el-dropdown-menu></template></el-dropdown></div>
        <el-button v-if="!row.simple||row.invalid" :data-advanced-field="row.field" @click="emit('advanced')">{{row.invalid||'组合条件 · 管理'}}</el-button>
        <el-date-picker v-else-if="row.kind==='date'&&row.operator==='between'" :model-value="row.range" :disabled="busy" type="daterange" value-format="YYYY-MM-DD" start-placeholder="开始日期" end-placeholder="结束日期" @update:model-value="(value: unknown)=>dateRange(row.field,value)"/>
        <el-date-picker v-else-if="row.kind==='date'" :model-value="row.text" :disabled="busy" type="date" value-format="YYYY-MM-DD" @update:model-value="(value: unknown)=>emit('value',row.field,typeof value==='string'?value:'')"/>
        <el-input v-else-if="row.kind==='text'" :model-value="pending[row.field]??row.text" :disabled="busy" clearable :placeholder="row.label" :aria-label="`常用筛选 ${row.label}`" :data-exposed="row.field" @update:model-value="(value:string)=>pending[row.field]=value" @input.capture="captureText(row.field,$event)" @compositionstart="composing.add(row.field)" @compositionend="endComposition(row.field,$event)" @keydown.enter="enter(row.field,$event)" @blur="commit(row.field)" @clear="clear(row.field)"/>
        <el-select v-else-if="row.operator==='in'" :model-value="row.values" :disabled="busy" multiple filterable :allow-create="row.kind==='attr'" default-first-option collapse-tags clearable :placeholder="row.label" :aria-label="`常用筛选 ${row.label}`" :data-exposed="row.field" @change="(value: string[])=>emit('value',row.field,value)"><el-option v-for="value in row.options" :key="value" :label="value" :value="value"/></el-select>
        <el-select v-else :model-value="row.text" :disabled="busy" filterable :allow-create="row.kind==='attr'" default-first-option clearable :placeholder="row.label" :aria-label="`常用筛选 ${row.label}`" :data-exposed="row.field" @change="(value: string)=>emit('value',row.field,value||'')"><el-option v-for="value in row.options" :key="value" :label="value" :value="value"/></el-select>
        <el-button v-if="pending[row.field]!==undefined" link @click="commit(row.field)">应用输入</el-button><p v-if="error" role="alert">{{error}}<el-button link @click="emit('retry')">重试保存</el-button></p>
      </div>
    </div>
  </section>
</template>
<script setup lang="ts">
import {computed,reactive,ref} from 'vue'
import CommonFilterPicker from './CommonFilterPicker.vue'
import type {ProductListViewFilter,ProductListFilterOperator} from '../../domain/types'
import type {FilterEditorRow,FilterField} from './filterPresentation'
const props=defineProps<{busy?:boolean;error?:string;fields:FilterField[];rows:(FilterEditorRow&{label:string;simple:boolean;active?:boolean;invalid?:string})[]}>()
const emit=defineEmits<{value:[field:string,value:ProductListViewFilter['value']];clear:[field:string];clearAll:[];unexpose:[field:string];unexposeAll:[];advanced:[];pin:[field:string];move:[field:string,delta:number];retry:[]}>()
const expanded=ref(false),pending=reactive<Record<string,string>>({}),composing=new Set<string>()
const pinOptions=computed(()=>props.fields.filter(field=>field.field!=='category').map(field=>({id:field.field,label:field.label,group:field.kind==='attr'?'规格属性':field.kind==='date'?'日期':'商品资料',pinned:props.rows.some(row=>row.field===field.field)})))
function captureText(field:string,event:Event){if(composing.has(field))pending[field]=(event.target as HTMLInputElement).value}
function endComposition(field:string,event:CompositionEvent){composing.delete(field);pending[field]=(event.target as HTMLInputElement).value}
function commit(field:string){if(composing.has(field)||pending[field]===undefined||props.busy)return;emit('value',field,pending[field]);delete pending[field]}
function clear(field:string){pending[field]='';commit(field)}
function enter(field:string,event:KeyboardEvent){if(event.isComposing||event.keyCode===229||composing.has(field))return;event.preventDefault();commit(field)}
function dateRange(field:string,value:unknown){const range=Array.isArray(value)?value:[];emit('value',field,{from:typeof range[0]==='string'?range[0]:'',to:typeof range[1]==='string'?range[1]:''})}
const operatorLabel=(operator:ProductListFilterOperator)=>({eq:'等于',neq:'不等于',in:'属于任一',descendants:'包含下级',contains:'包含',notContains:'不包含',before:'早于',after:'晚于',between:'日期范围'})[operator]
</script>
<style scoped>
.exposed-filters{margin-top:12px;padding:10px 0;border-block:1px solid var(--el-border-color-lighter)}.exposed-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:13px;color:var(--el-text-color-secondary);margin-bottom:8px}.exposed-head .el-button{margin:0}.exposed-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}.exposed-field{min-width:0;padding:8px;border:1px solid var(--el-border-color-lighter);border-radius:6px}.exposed-field.is-active{border-color:var(--el-color-primary-light-5);background:var(--el-color-primary-light-9)}.exposed-field.has-error{border-color:var(--el-color-danger)}.exposed-label{display:flex;align-items:center;justify-content:space-between;font-size:12px;gap:6px;min-height:24px;margin-bottom:4px}.exposed-label span{flex:1}.exposed-label small{font-size:12px;color:var(--el-text-color-secondary)}.exposed-field :deep(.el-select),.exposed-field :deep(.el-date-editor){width:100%;max-width:100%;box-sizing:border-box}.exposed-field p{color:var(--el-color-danger);font-size:12px;overflow-wrap:anywhere}@media(max-width:640px){.exposed-grid{grid-template-columns:minmax(0,1fr)}}
</style>
