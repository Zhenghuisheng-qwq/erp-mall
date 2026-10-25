<template>
  <section v-if="rows.length" class="exposed-filters" aria-label="常用筛选">
    <div class="exposed-head"><span>常用筛选 {{rows.length}} 项</span><el-button link @click="expanded=!expanded">{{expanded?'收起常用筛选':`展开全部 ${rows.length} 项`}}</el-button><el-button link type="primary" :disabled="busy" @click="emit('clearAll')">清除外露值</el-button><el-button link :disabled="busy" @click="emit('unexposeAll')">取消全部外露</el-button></div>
    <div v-if="expanded" class="exposed-grid">
      <div v-for="row in rows" :key="row.field" class="exposed-field" :data-exposed-field="row.field">
        <div class="exposed-label"><span>{{row.label}}<small v-if="row.simple"> · {{operatorLabel(row.operator)}}</small></span><el-dropdown trigger="click"><el-button link size="small" :disabled="busy" :aria-label="`${row.label}筛选操作`">操作</el-button><template #dropdown><el-dropdown-menu><el-dropdown-item :disabled="!row.simple" @click="emit('clear',row.field)">清除值</el-dropdown-item><el-dropdown-item @click="emit('unexpose',row.field)">取消外露</el-dropdown-item></el-dropdown-menu></template></el-dropdown></div>
        <el-button v-if="!row.simple" :data-advanced-field="row.field" @click="emit('advanced')">多条或复杂条件 · 打开管理</el-button>
        <el-date-picker v-else-if="row.kind==='date'&&row.operator==='between'" :model-value="row.range" type="daterange" value-format="YYYY-MM-DD" start-placeholder="开始日期" end-placeholder="结束日期" @update:model-value="(value: unknown)=>dateRange(row.field,value)"/>
        <el-date-picker v-else-if="row.kind==='date'" :model-value="row.text" type="date" value-format="YYYY-MM-DD" @update:model-value="(value: unknown)=>singleDate(row.field,value)"/>
        <el-input v-else-if="row.kind==='text'" :model-value="row.text" clearable :placeholder="row.label" :data-exposed="row.field" @update:model-value="(value: string)=>emit('value',row.field,value)"/>
        <el-select v-else-if="row.operator==='in'" :model-value="row.values" multiple filterable collapse-tags clearable :placeholder="row.label" :data-exposed="row.field" @change="(value: string[])=>emit('value',row.field,value)"><el-option v-for="value in row.options" :key="value" :label="value" :value="value"/></el-select>
        <el-select v-else :model-value="row.text" filterable clearable :placeholder="row.label" :data-exposed="row.field" @change="(value: string)=>emit('value',row.field,value||'')"><el-option v-for="value in row.options" :key="value" :label="value" :value="value"/></el-select>
      </div>
    </div>
  </section>
</template>
<script setup lang="ts">
import {ref} from 'vue'
import type {ProductListViewFilter,ProductListFilterOperator} from '../../domain/types'
import type {FilterEditorRow} from './filterPresentation'
defineProps<{busy?:boolean;rows:(FilterEditorRow&{label:string;simple:boolean})[]}>()
const emit=defineEmits<{value:[field:string,value:ProductListViewFilter['value']];clear:[field:string];clearAll:[];unexpose:[field:string];unexposeAll:[];advanced:[]}>()
const expanded=ref(true)
function dateRange(field:string,value:unknown) {const range=Array.isArray(value)?value:[];emit('value',field,{from:typeof range[0]==='string'?range[0]:'',to:typeof range[1]==='string'?range[1]:''})}
function singleDate(field:string,value:unknown) {emit('value',field,typeof value==='string'?value:'')}
const operatorLabel=(operator:ProductListFilterOperator)=>({eq:'等于',neq:'不等于',in:'属于任一',descendants:'包含下级',contains:'包含',notContains:'不包含',before:'早于',after:'晚于',between:'日期范围'})[operator]
</script>
<style scoped>
.exposed-filters{margin:0 0 14px}.exposed-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--el-text-color-secondary)}.exposed-head .el-button{margin:0}.exposed-grid{display:flex;flex-wrap:wrap;gap:10px 14px;margin-top:8px}.exposed-field{width:210px;max-width:100%;min-width:0}.exposed-label{display:flex;align-items:center;justify-content:space-between;font-size:13px;gap:4px;min-height:24px;margin-bottom:4px}.exposed-label small{font-size:12px;color:var(--el-text-color-secondary)}.exposed-field:has(.el-date-editor--daterange){width:300px}.exposed-field :deep(.el-select),.exposed-field :deep(.el-date-editor){width:100%;max-width:100%;box-sizing:border-box}
</style>
