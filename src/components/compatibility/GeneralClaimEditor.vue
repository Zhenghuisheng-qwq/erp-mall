<template>
 <div class="general-editor">
  <div class="form-grid"><el-form-item label="适用设备产品类型"><el-select :model-value="modelValue.deviceTypeIds" multiple placeholder="选择设备类型" aria-label="通用适用设备类型" @update:model-value="set('deviceTypeIds',$event)"><el-option v-for="t in data.productTypes.filter(t=>t.catalogRole==='host'&&t.status==='enabled')" :key="t.id" :value="t.id" :label="t.name"/></el-select></el-form-item><el-form-item label="能力"><el-select :model-value="modelValue.capability" aria-label="通用能力" @update:model-value="set('capability',$event)"><el-option value="basic" label="基本使用"/><el-option value="fast-charge" label="快充"/><el-option value="other" label="其他"/></el-select></el-form-item></div>
  <p class="hint">勾选手机不代表全部手机适用；USB-C 接口也不证明全部要求。只有已核验且必要条件可证实满足，才进入正常候选。</p>
  <div v-for="(c,i) in modelValue.conditions" :key="i" class="condition"><el-select :model-value="c.attributeId" placeholder="必要参数" :aria-label="`条件参数 ${i+1}`" @update:model-value="condition(i,{attributeId:$event,value:c.operator==='in'?[]:''})"><el-option v-for="p in fields" :key="p.id" :value="p.id" :label="p.name"/></el-select><el-select :model-value="c.operator" :aria-label="`条件运算 ${i+1}`" @update:model-value="condition(i,{operator:$event,value:$event==='in'?[]:''})"><el-option value="eq" label="等于"/><el-option value="in" label="属于指定值"/></el-select><el-select :key="c.operator" :model-value="c.value" :multiple="c.operator==='in'" placeholder="必要取值" :aria-label="`条件取值 ${i+1}`" @update:model-value="condition(i,{value:$event})"><el-option v-for="v in data.params.find(p=>p.id===c.attributeId)?.values||[]" :key="v" :value="v" :label="v"/></el-select><el-button text type="danger" :aria-label="`删除条件 ${i+1}`" @click="set('conditions',modelValue.conditions.filter((_,n)=>n!==i))">移除</el-button></div>
  <el-button plain @click="set('conditions',[...modelValue.conditions,{kind:'attribute',attributeId:'',operator:'eq',value:''}])">添加必要条件</el-button>
  <div class="form-grid"><el-form-item label="适用结论"><el-select :model-value="modelValue.conclusion" aria-label="通用适用结论" @update:model-value="set('conclusion',$event)"><el-option value="compatible" label="适用"/><el-option value="conditional" label="条件适用"/><el-option value="incompatible" label="明确不适用"/></el-select></el-form-item><el-form-item label="核验状态"><el-select :model-value="modelValue.verification" aria-label="通用核验状态" @update:model-value="set('verification',$event)"><el-option value="confirmed" label="已核验"/><el-option value="pending" label="待核验"/></el-select></el-form-item></div>
  <el-form-item label="供应商或人工核对依据"><el-input :model-value="modelValue.source" type="textarea" :rows="2" maxlength="2000" aria-label="通用资料依据" @update:model-value="set('source',$event)"/></el-form-item>
 </div>
</template>
<script setup lang="ts">
import {computed} from 'vue'
import type {AppData} from '../../domain/types'
import type {GeneralDraft,GeneralCondition} from '../../domain/generalCompatibility'
const props=defineProps<{data:AppData;modelValue:GeneralDraft}>(),emit=defineEmits<{'update:modelValue':[GeneralDraft]}>()
const fields=computed(()=>props.data.params.filter(p=>p.identityRole!=='host-model'&&p.values.length))
function set<K extends keyof GeneralDraft>(key:K,value:GeneralDraft[K]){emit('update:modelValue',{...props.modelValue,[key]:value})}
function condition(i:number,patch:Partial<GeneralCondition>){set('conditions',props.modelValue.conditions.map((c,n)=>n===i?{...c,...patch}:c))}
</script>
<style scoped>.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}.form-grid .el-select{width:100%}.condition{display:grid;grid-template-columns:1fr 130px 1fr auto;gap:8px;margin:10px 0}.hint{font-size:12px;color:var(--el-text-color-secondary);line-height:1.7}@media(max-width:750px){.condition{grid-template-columns:1fr 1fr}.form-grid{grid-template-columns:1fr}}</style>
