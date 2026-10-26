<template>
  <section class="group-relations" data-group-relations>
    <div class="section-head"><div><h3>组间依赖与互斥</h3><p class="muted">依赖只提示补选，互斥要求明确保留；不会自动加件或删件。</p></div><el-button v-if="!disabled" data-add-group-relation @click="add">添加组间规则</el-button></div>
    <p v-for="issue in issues.filter(issue=>!issue.ruleId)" :key="issue.message" class="relation-error" role="alert">{{issue.message}}</p><p v-if="!modelValue.length" class="muted">尚未配置组间规则。</p>
    <article v-for="rule in modelValue" :key="rule.id" :data-group-relation="rule.id" class="relation-row">
      <el-checkbox :model-value="rule.enabled" :disabled="disabled" @change="update(rule.id,{enabled:$event===true})">启用</el-checkbox>
      <el-select :model-value="rule.sourceGroupId" :disabled="disabled" filterable aria-label="规则来源组" @change="update(rule.id,{sourceGroupId:String($event)})"><el-option v-for="group in groups" :key="group.id" :value="group.id" :label="`${group.name||'未命名组'} · ${group.id}`"/></el-select>
      <el-select :model-value="rule.kind" :disabled="disabled" aria-label="组间规则类型" @change="update(rule.id,{kind:String($event)})"><el-option value="requires" label="已选时需要"/><el-option value="excludes" label="不能同时选"/><el-option v-if="!['requires','excludes'].includes(rule.kind)" :value="rule.kind" :label="`不支持：${rule.kind}`" disabled/></el-select>
      <el-select :model-value="rule.targetGroupId" :disabled="disabled" filterable aria-label="规则目标组" @change="update(rule.id,{targetGroupId:String($event)})"><el-option v-for="group in groups" :key="group.id" :value="group.id" :label="`${group.name||'未命名组'} · ${group.id}`"/></el-select>
      <el-input :model-value="rule.note" :disabled="disabled" placeholder="简短说明" aria-label="组间规则说明" @update:model-value="update(rule.id,{note:String($event)})"/>
      <el-button v-if="!disabled" link type="danger" :aria-label="`移除组间规则 ${rule.id}`" @click="emit('update:modelValue',modelValue.filter(item=>item.id!==rule.id))">移除</el-button>
      <p v-for="message in problems(rule)" :key="message" class="relation-error" role="alert">{{message}}</p>
      <small>{{rule.id}}</small>
    </article>
  </section>
</template>
<script setup lang="ts">
import {computed} from 'vue'
import {benefitGroupRuleIssues} from '../../domain/benefitPositions'
import type {BenefitGroupRule,BenefitSelectionGroup} from '../../domain/benefitPackageTypes'
import {localBenefitRequest} from './benefitPackagePresentation'
const props=withDefaults(defineProps<{modelValue:BenefitGroupRule[];groups:BenefitSelectionGroup[];disabled?:boolean}>(),{disabled:false})
const emit=defineEmits<{'update:modelValue':[rules:BenefitGroupRule[]]}>()
function add(){emit('update:modelValue',[...props.modelValue,{id:localBenefitRequest('group-rule'),kind:'requires',sourceGroupId:'',targetGroupId:'',enabled:true,note:''}])}
function update(id:string,patch:Partial<BenefitGroupRule>){if(!props.disabled)emit('update:modelValue',props.modelValue.map(rule=>rule.id===id?{...rule,...patch}:rule))}
const issues=computed(()=>benefitGroupRuleIssues(props.groups,props.modelValue))
function problems(rule:BenefitGroupRule){return issues.value.filter(issue=>issue.ruleId===rule.id).map(issue=>issue.message)}
</script>
<style scoped>
.group-relations{margin-top:20px}.section-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.section-head h3{margin:0}.muted,small{font-size:12px;color:var(--el-text-color-secondary);line-height:1.6}.relation-row{display:grid;grid-template-columns:70px minmax(130px,1fr) 140px minmax(130px,1fr);gap:10px;padding:14px 0;border-bottom:1px solid var(--el-border-color)}.relation-row>.el-input{grid-column:2/4}.relation-row>small,.relation-error{grid-column:1/-1;overflow-wrap:anywhere}.relation-error{margin:0;color:var(--el-color-danger);font-size:12px}@media(max-width:650px){.relation-row{grid-template-columns:1fr 1fr}.relation-row>.el-select,.relation-row>.el-input{grid-column:auto;min-width:0}.relation-row>.el-input{grid-column:1/-1}}
</style>
