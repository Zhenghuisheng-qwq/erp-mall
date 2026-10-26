<template>
  <section data-sales-scope-picker>
    <el-alert v-if="attributeStart" title="属性节点本身不代表已选择全部取值，请明确选择下面的值或完整规格。" type="info" :closable="false"/>
    <el-radio-group :key="`${method}:${!!proposal}`" :model-value="method" :disabled="!valid&&!proposal" aria-label="规格范围选择方式" @change="changeMethod"><el-radio-button value="values">属性值条件</el-radio-button><el-radio-button value="specs">完整合法规格</el-radio-button></el-radio-group>
    <div v-if="method==='values'" class="scope-values">
      <el-select v-model="valueIds" multiple filterable aria-label="范围属性值" placeholder="选择需要限定的属性值，未选属性不受限制" @change="setValues"><el-option v-for="term in terms" :key="term.valueNodeId" :value="term.valueNodeId" :label="termLabel(term.valueNodeId)"/></el-select>
      <p class="muted">不同属性同时满足；同一属性可选多个值。颜色、容量未限定时自动覆盖该范围内的合法组合。</p>
    </div>
    <el-select v-else v-model="identities" multiple filterable collapse-tags collapse-tags-tooltip aria-label="完整合法规格范围" placeholder="搜索并选择真实合法规格" @change="setSpecs"><el-option v-for="combo in context.combinations" :key="combo.identityKey" :value="combo.identityKey" :label="combo.label"/></el-select>
    <section v-if="proposal" class="mode-proposal" data-sales-scope-proposal>
      <p>当前 OR 范围不能直接表示为属性值条件。重新定义将新增 {{proposal.added.length}} 条、移除 {{proposal.removed.length}} 条规格；确认前仍使用原范围。</p>
      <details><summary>查看规格变化</summary><ul><li v-for="id in proposal.added" :key="`add:${id}`">新增：{{context.byIdentity.get(id)?.label||id}}</li><li v-for="id in proposal.removed" :key="`remove:${id}`">移除：{{context.byIdentity.get(id)?.label||id}}</li></ul></details>
      <el-button size="small" @click="cancelMethod">保留完整规格</el-button><el-button size="small" type="primary" @click="confirmMethod">确认重新定义范围</el-button>
    </section>
    <el-alert v-for="issue in context.issues" :key="issue.message" :title="issue.message" type="warning" :closable="false"/>
    <p v-if="message" class="warn" role="alert">{{message}}</p>
  </section>
</template>
<script setup lang="ts">
import {computed} from 'vue'
import {useCatalogStore} from '../../stores/catalog'
import {salesBindingContext} from '../../domain/salesConfiguration'
import type {TemplateSpecSelector} from '../../domain/templateCompatibilityTypes'
import {useSalesScopeSelection} from './useSalesScopeSelection'
const props=defineProps<{modelValue?:TemplateSpecSelector;modelId:string;versionId?:string|null;initialNodeId?:string}>()
const emit=defineEmits<{'update:modelValue':[TemplateSpecSelector|undefined];'validity-change':[boolean]}>()
const store=useCatalogStore()
const context=computed(()=>salesBindingContext(store.data,props.modelId,props.versionId))
const {method,valueIds,identities,message,proposal,valid,setValues,setSpecs,requestMethod,cancelMethod,confirmMethod}=useSalesScopeSelection({context,modelValue:()=>props.modelValue,sourceKey:()=>JSON.stringify([props.modelId,props.versionId,props.initialNodeId]),initialNodeId:()=>props.initialNodeId},selector=>emit('update:modelValue',selector),value=>emit('validity-change',value))
const terms=computed(()=>[...context.value.terms.values()])
const attributeStart=computed(()=>context.value.byNode.get(props.initialNodeId||'')?.nodeType==='ATTRIBUTE')
function changeMethod(value:string|number|boolean|undefined){if(value==='values'||value==='specs')requestMethod(value)}
function termLabel(id:string){const term=context.value.terms.get(id);if(!term)return id;const attribute=context.value.byNode.get(term.attributeNodeId);const name=store.data.params.find(item=>item.id===term.attributeId)?.name||term.attributeId;const ancestors:string[]=[];let node=attribute;const seen=new Set<string>();while(node?.parentId&&!seen.has(node.id)){seen.add(node.id);const parent=context.value.byNode.get(node.parentId);if(parent?.nodeType==='VALUE')ancestors.unshift(parent.valueId||parent.id);node=parent}return `${ancestors.length?ancestors.join(' / ')+' / ':''}${name}＝${term.valueId} · ${term.valueNodeId}`}
</script>
<style scoped>.el-radio-group{margin:12px 0}.el-select{width:100%}.muted{font-size:12px;color:var(--el-text-color-secondary);line-height:1.5}.warn{color:var(--el-color-warning)}.mode-proposal{padding:12px;margin-top:12px;border:1px solid var(--el-color-warning-light-5);border-radius:6px;font-size:13px;line-height:1.6}.mode-proposal details{margin-bottom:12px}.mode-proposal summary{cursor:pointer}.mode-proposal li{overflow-wrap:anywhere}</style>
