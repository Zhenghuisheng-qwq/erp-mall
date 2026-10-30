<template>
 <div class="model-picker">
  <div class="filters"><el-select v-model="type" clearable placeholder="设备产品类型" aria-label="筛选设备类型"><el-option v-for="t in hostTypes" :key="t.id" :value="t.id" :label="t.name"/></el-select><el-select v-model="brand" clearable placeholder="品牌" aria-label="筛选品牌"><el-option v-for="v in brands" :key="v" :value="v" :label="v"/></el-select><el-select v-model="series" clearable placeholder="系列" aria-label="筛选系列"><el-option v-for="v in seriesOptions" :key="v" :value="v" :label="v"/></el-select></div>
  <el-input v-model="search" placeholder="搜索适用型号" aria-label="搜索适用型号" clearable/>
  <div class="options" role="group" aria-label="适用型号多选"><el-checkbox v-for="m in options" :key="m.key" :model-value="modelValue.includes(m.key)" :disabled="disabled" @change="toggle(m.key,!!$event)"><span>{{m.label}}</span><small :title="m.key">{{m.productTypeName}} · {{sourceName(m.host.productModelId)}}</small></el-checkbox><p v-if="!options.length" class="muted">没有可识别的型号。请在商品模型中登记明确的型号属性并发布；名称搜索不会创建型号身份。</p></div>
  <div class="selected"><span>已选 {{modelValue.length}} 个型号</span><el-tag v-for="key in modelValue" :key="key" :closable="!disabled" @close="toggle(key,false)">{{models.find(m=>m.key===key)?.label||'型号引用失效'}}</el-tag></div>
  <p class="muted">型号按稳定身份关联；品牌、系列和类型筛选只用于查找。容量、颜色无需重复选择。</p>
 </div>
</template>
<script setup lang="ts">
import {computed,ref} from 'vue'
import {listDeviceModels} from '../../domain/deviceResolution'
import type {AppData} from '../../domain/types'
const props=defineProps<{data:AppData;modelValue:string[];disabled?:boolean}>(),emit=defineEmits<{ 'update:modelValue':[string[]]}>()
const search=ref(''),type=ref(''),brand=ref(''),series=ref(''),models=computed(()=>listDeviceModels(props.data)),hostTypes=computed(()=>props.data.productTypes.filter(t=>t.catalogRole==='host'))
const fact=(m:ReturnType<typeof listDeviceModels>[number],name:string)=>m.host.steps.find(s=>(props.data.params.find(p=>p.id===s.attributeId)?.name||s.attributeName)===name)?.valueId||''
const brands=computed(()=>[...new Set(models.value.map(m=>fact(m,'品牌')).filter(Boolean))]),seriesOptions=computed(()=>[...new Set(models.value.filter(m=>!brand.value||fact(m,'品牌')===brand.value).map(m=>fact(m,'系列')).filter(Boolean))])
const options=computed(()=>models.value.filter(m=>(!type.value||m.host.productTypeId===type.value)&&(!brand.value||fact(m,'品牌')===brand.value)&&(!series.value||fact(m,'系列')===series.value)&&`${m.label} ${m.productTypeName}`.toLowerCase().includes(search.value.trim().toLowerCase())))
const sourceName=(id:string)=>props.data.specCanvases.find(c=>c.templateId===id)?.name||props.data.templates.find(t=>t.id===id.replace(/^template:/,''))?.name||'已有型号资料'
function toggle(key:string,on:boolean){emit('update:modelValue',on?[...new Set([...props.modelValue,key])]:props.modelValue.filter(k=>k!==key))}
</script>
<style scoped>.filters{display:flex;gap:8px;margin-bottom:10px}.filters>.el-select{flex:1;min-width:0}.options{max-height:240px;overflow:auto;padding:10px 0;display:flex;flex-direction:column}.options .el-checkbox{height:auto;min-height:32px;margin-right:0}.options small{margin-left:10px;color:var(--el-text-color-secondary)}.selected{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:10px 0}.muted{font-size:12px;color:var(--el-text-color-secondary);line-height:1.7}@media(max-width:700px){.filters{flex-wrap:wrap}.filters>.el-select{min-width:120px}}</style>
