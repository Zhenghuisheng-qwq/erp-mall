<template>
 <el-select :model-value="modelValue" filterable clearable placeholder="选择实际设备或明确型号" aria-label="预览设备" class="device-select" @update:model-value="emit('update:modelValue',$event||'')">
  <el-option-group label="实际设备 SKU（带实际规格事实）"><el-option v-for="s in options.skus" :key="s.id" :value="`sku:${s.id}`" :label="`${s.name} · ${s.spec||s.code}`"/></el-option-group>
  <el-option-group label="已有明确型号（缺少实际事实时保守核验）"><el-option v-for="m in options.models" :key="m.key" :value="`model:${m.key}`" :label="`${m.label} · ${m.productTypeName}`"/></el-option-group>
 </el-select>
</template>
<script setup lang="ts">
import {computed} from 'vue'
import {deviceOptions} from '../../domain/benefitSales/query'
import type {AppData} from '../../domain/types'
const props=defineProps<{data:AppData;modelValue:string}>(),emit=defineEmits<{'update:modelValue':[string]}>(),options=computed(()=>deviceOptions(props.data))
</script>
<style scoped>.device-select{width:100%}</style>
