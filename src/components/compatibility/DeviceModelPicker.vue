<template>
  <el-select :model-value="modelValue" :multiple="multiple" :multiple-limit="multipleLimit" filterable clearable :disabled="disabled" :placeholder="placeholder || '搜索并选择设备型号'" :aria-label="label || '选择设备型号'" class="device-model-picker" popper-class="device-model-options" @update:model-value="emit('update:modelValue', $event)">
    <el-option v-for="item in options" :key="item.key" :label="`${item.label} · ${sourceText(item)}`" :value="item.key">
      <div class="device-option"><strong>{{ item.label }}</strong><span>{{ sourceText(item) }} · 仅型号</span></div>
    </el-option>
  </el-select>
</template>
<script setup lang="ts">
import type { DeviceModelOption } from '../../domain/accessoryCompatibilityTypes'
import { computed } from 'vue'
import { useCatalogStore } from '../../stores/catalog'
const props=defineProps<{ modelValue: string | string[]; options: readonly DeviceModelOption[]; multiple?: boolean; multipleLimit?: number; disabled?: boolean; placeholder?: string; label?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string | string[]] }>()
const store=useCatalogStore()
const modelNames=computed(()=>new Map([...store.data.templates.map(item=>[item.id,item.name] as const),...store.data.specCanvases.map(item=>[item.templateId,item.name] as const)]))
const duplicatePositions=computed(()=>{const groups=new Map<string,DeviceModelOption[]>();for(const item of props.options){const key=JSON.stringify([item.label,item.productTypeName,item.source]),group=groups.get(key)||[];group.push(item);groups.set(key,group)}const result=new Map<string,string>();for(const group of groups.values())if(group.length>1)group.forEach((item,index)=>result.set(item.key,` · 来源 ${index+1}`));return result})
function sourceText(item: DeviceModelOption) {
  const source = item.source === 'manual' ? '独立型号' : item.source === 'model' ? '已发布模型' : item.source === 'template' ? '商品模板' : '规划型号'
  const model=modelNames.value.get(item.host.productModelId.replace(/^template:/,''))
  return `${item.productTypeName} · ${source}${model?` · ${model}`:''}${duplicatePositions.value.get(item.key)||''}`
}
</script>
<style scoped>
.device-model-picker{width:100%;min-width:0}.device-option{display:flex;align-items:center;justify-content:space-between;gap:18px;max-width:100%;font-weight:400}.device-option strong{overflow:hidden;text-overflow:ellipsis;font-weight:500}.device-option span{font-size:12px;color:var(--el-text-color-secondary);flex-shrink:0}@media(max-width:600px){.device-option{display:block;line-height:1.4}.device-option span{display:block}.device-option strong{display:block}}
:global(.device-model-options .el-select-dropdown__item){height:auto;min-height:38px;padding-top:4px;padding-bottom:4px;line-height:30px}@media(max-width:600px){:global(.device-model-options .el-select-dropdown__item){min-height:48px}}
</style>
