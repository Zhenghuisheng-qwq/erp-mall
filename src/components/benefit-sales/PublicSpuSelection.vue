<template>
 <div class="public-selection">
  <div class="heading"><strong>公共商品（SPU）</strong><el-button :disabled="disabled" size="small" data-select-common-spus @click="opened=true;error=''">添加公共商品</el-button></div>
  <p v-if="!modelValue?.length" class="muted">可从全局公共池引用其他分类的商品，使用时逐个规格核验适用与在售状态。</p>
  <div v-for="id in modelValue||[]" :key="id" class="selected-row" :data-common-spu="id"><div><strong>{{data.families.find(f=>f.id===id)?.name||'SPU 引用失效'}}</strong><small>{{row(id)?.typeName||'类型失效'}} · {{row(id)?.skuCount||0}} 个销售规格</small><small v-if="publicReferenceProblem(data,id)" class="warning">{{publicReferenceProblem(data,id)}}，请明确移除或由管理员处理</small></div><el-button text :disabled="disabled" @click="emit('update:modelValue',(modelValue||[]).filter(x=>x!==id))">移除</el-button></div>
  <PublicSpuPicker v-model:open="opened" :data="data" :model-value="modelValue||[]" pool-only :error="error" @confirm="apply"/>
 </div>
</template>
<script setup lang="ts">
import {ref,computed,watch} from 'vue'
import type {AppData} from '../../domain/types'
import {publicSpuRows,commonSpusProblem,publicReferenceProblem} from '../../domain/benefitSales/publicSpuPool'
import PublicSpuPicker from './PublicSpuPicker.vue'
const props=defineProps<{data:AppData;modelValue?:string[];disabled?:boolean}>(),emit=defineEmits<{'update:modelValue':[ids:string[]]}>(),opened=ref(false),error=ref('')
const rows=computed(()=>new Map(publicSpuRows(props.data).map(r=>[r.id,r]))),row=(id:string)=>rows.value.get(id)
watch(()=>props.disabled,on=>{if(on)opened.value=false})
function apply(ids:string[]){const problem=commonSpusProblem(props.data,ids);if(problem){error.value=problem;return}emit('update:modelValue',ids);opened.value=false}
</script>
<style scoped>.public-selection{width:100%;border:1px solid var(--el-border-color-light);border-radius:8px;padding:12px}.heading,.selected-row{display:flex;align-items:center;justify-content:space-between;gap:12px}.selected-row{padding:10px 0;border-bottom:1px solid var(--el-border-color-lighter)}small{display:block}.muted,small{color:var(--el-text-color-secondary);font-size:12px;line-height:1.7}.warning{color:var(--el-color-warning)}</style>
