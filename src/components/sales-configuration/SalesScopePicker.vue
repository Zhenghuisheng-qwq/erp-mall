<template>
  <section data-sales-scope-picker>
    <el-alert v-if="attributeStart" title="属性节点本身不代表已选择全部取值，请明确选择下面的值或完整规格。" type="info" :closable="false"/>
    <el-radio-group v-model="method" aria-label="规格范围选择方式" @change="reset"><el-radio-button value="values">属性值条件</el-radio-button><el-radio-button value="specs">完整合法规格</el-radio-button></el-radio-group>
    <div v-if="method==='values'" class="scope-values">
      <el-select v-model="valueIds" multiple filterable aria-label="范围属性值" placeholder="选择需要限定的属性值，未选属性不受限制" @change="setValues"><el-option v-for="term in terms" :key="term.valueNodeId" :value="term.valueNodeId" :label="termLabel(term.valueNodeId)"/></el-select>
      <p class="muted">不同属性同时满足；同一属性可选多个值。颜色、容量未限定时自动覆盖该范围内的合法组合。</p>
    </div>
    <el-select v-else v-model="identities" multiple filterable collapse-tags collapse-tags-tooltip aria-label="完整合法规格范围" placeholder="搜索并选择真实合法规格" @change="setSpecs"><el-option v-for="combo in context.combinations" :key="combo.identityKey" :value="combo.identityKey" :label="combo.label"/></el-select>
    <el-alert v-for="issue in context.issues" :key="issue.message" :title="issue.message" type="warning" :closable="false"/>
    <p v-if="message" class="warn" role="alert">{{message}}</p>
  </section>
</template>
<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {useCatalogStore} from '../../stores/catalog'
import {selectorForCombination,selectorForNode} from '../../domain/templateCompatibility'
import {salesBindingContext} from '../../domain/salesConfiguration'
import type {TemplateSpecSelector,TemplateSpecTerm} from '../../domain/templateCompatibilityTypes'
const props=defineProps<{modelValue?:TemplateSpecSelector;modelId:string;versionId?:string|null;initialNodeId?:string}>()
const emit=defineEmits<{'update:modelValue':[TemplateSpecSelector|undefined]}>()
const store=useCatalogStore(),method=ref('values'),valueIds=ref<string[]>([]),identities=ref<string[]>([]),message=ref('')
const context=computed(()=>salesBindingContext(store.data,props.modelId,props.versionId))
const terms=computed(()=>[...context.value.terms.values()])
const attributeStart=computed(()=>context.value.byNode.get(props.initialNodeId||'')?.nodeType==='ATTRIBUTE')
function termLabel(id:string){const term=context.value.terms.get(id);if(!term)return id;const attribute=context.value.byNode.get(term.attributeNodeId);const name=store.data.params.find(item=>item.id===term.attributeId)?.name||term.attributeId;const ancestors:string[]=[];let node=attribute;const seen=new Set<string>();while(node?.parentId&&!seen.has(node.id)){seen.add(node.id);const parent=context.value.byNode.get(node.parentId);if(parent?.nodeType==='VALUE')ancestors.unshift(parent.valueId||parent.id);node=parent}return `${ancestors.length?ancestors.join(' / ')+' / ':''}${name}＝${term.valueId} · ${term.valueNodeId}`}
function reset(){valueIds.value=[];identities.value=[];message.value='';emit('update:modelValue',undefined)}
function setValues(){message.value='';const grouped=new Map<string,TemplateSpecTerm[]>();for(const id of valueIds.value){const term=context.value.terms.get(id);if(!term)continue;const key=term.attributeNodeId;grouped.set(key,[...grouped.get(key)||[],term])}let groups:TemplateSpecTerm[][]=[[]];for(const choices of grouped.values()){if(groups.length*choices.length>500){message.value='条件组合过多，请缩小范围或选择完整规格。';emit('update:modelValue',undefined);return}groups=groups.flatMap(group=>choices.map(term=>[...group,term]))}emit('update:modelValue',grouped.size?{anyOf:groups}:undefined)}
function setSpecs(){const combos=identities.value.flatMap(id=>{const combo=context.value.byIdentity.get(id);return combo?[combo]:[]});emit('update:modelValue',combos.length?{anyOf:combos.flatMap(combo=>selectorForCombination(combo).anyOf)}:undefined)}
watch(()=>[props.modelId,props.versionId,props.initialNodeId],()=>{message.value='';valueIds.value=[];identities.value=[];method.value='values';if(props.modelValue){const termIds=[...new Set(props.modelValue.anyOf.flatMap(group=>group.map(term=>term.valueNodeId)))];valueIds.value=termIds;return}if(props.initialNodeId&&context.value.byNode.get(props.initialNodeId)?.nodeType==='VALUE'){const result=selectorForNode(context.value,props.initialNodeId);message.value=result.message;valueIds.value=[props.initialNodeId];emit('update:modelValue',result.selector)}else emit('update:modelValue',undefined)},{immediate:true})
</script>
<style scoped>.el-radio-group{margin:12px 0}.el-select{width:100%}.muted{font-size:12px;color:var(--el-text-color-secondary);line-height:1.5}.warn{color:var(--el-color-warning)}</style>
