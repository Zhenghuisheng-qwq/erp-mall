<template>
  <section class="guide-failure" role="alert" :data-failure-kind="failure.kind">
    <div class="guide-failure-title"><strong>{{kindText[failure.kind]}}</strong><span>{{stateText[failure.savedState]}}</span></div><p>{{failure.message}}</p>
    <dl v-if="Object.keys(failure.context||{}).length"><template v-for="(value,key) in failure.context" :key="key"><dt>{{contextLabel[key]||key}}</dt><dd>{{value}}</dd></template></dl>
    <p v-if="failure.fields?.length">请检查：{{failure.fields.join('、')}}</p>
    <div class="guide-failure-actions"><el-button v-if="showRule" size="small" @click="explain">{{failure.ruleId?'查看规则':'查看本页指南'}}</el-button><el-button v-for="action in availableRecovery" :key="action" size="small" :disabled="action==='feedback'&&!catalog.can('system:feedback:create')" @click="recover(action)">{{recoveryText[action]||action}}</el-button></div>
  </section>
</template>
<script setup lang="ts">
import {computed} from 'vue'
import {useCatalogStore} from '../../stores/catalog'
import type {GuideFailure} from '../../domain/guide/types'
import {openGuide,requestGuideFeedback} from '../../domain/guide/presentation'
const props=withDefaults(defineProps<{failure:GuideFailure;showRule?:boolean;supportedRecovery?:string[]}>(),{showRule:true,supportedRecovery:()=>[]}),emit=defineEmits<{recover:[action:string]}>()
const catalog=useCatalogStore()
const kindText={business:'业务条件未满足',input:'请检查输入',permission:'当前操作未获授权',persistence:'本机保存失败',conflict:'操作依据已变化',unknown:'操作未完成'}
const stateText={unchanged:'原数据未变','memory-only':'内存已修改，尚未写盘',unconfirmed:'保存结果待确认'}
const recoveryText:Record<string,string>={'edit-input':'修改输入','choose-target':'选择其他目标','view-related':'查看关联',retry:'重试',repreview:'重新预览','read-latest':'读取最新',feedback:'反馈问题'}
const contextLabel:Record<string,string>={categoryId:'来源分类',categoryName:'来源分类名称',targetId:'目标分类',targetName:'目标分类名称',nodePath:'节点位置',requiredPermissions:'所需权限',mode:'权限模式',modelId:'模型',planningId:'规划',materialId:'物料',spuId:'SPU',skuId:'SKU',revision:'依据修订',versionId:'来源版本',packageId:'权益包',frameworkId:'选配框架',attributeId:'属性',nodeId:'节点'}
const availableRecovery=computed(()=>(props.failure.recovery||[]).filter(action=>action==='feedback'||props.supportedRecovery.includes(action)))
function explain(){openGuide({failure:{...props.failure,recovery:availableRecovery.value},articleId:props.failure.ruleId,onRecover:action=>emit('recover',action)})}
function recover(action:string){if(action==='feedback')requestGuideFeedback({ruleId:props.failure.ruleId,actionId:props.failure.actionId});else emit('recover',action)}
</script>
<style>
.guide-failure{border:1px solid var(--el-color-warning-light-5);background:var(--el-color-warning-light-9);border-radius:6px;padding:12px 14px;margin:12px 0;overflow-wrap:anywhere}.guide-failure-title{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.guide-failure-title span{font-size:12px;color:var(--text-secondary)}.guide-failure p{margin:9px 0;line-height:1.6}.guide-failure dl{display:grid;grid-template-columns:auto 1fr;gap:5px 12px;font-size:12px;margin:10px 0}.guide-failure dt{color:var(--text-secondary)}.guide-failure dd{margin:0}.guide-failure-actions{display:flex;gap:8px;flex-wrap:wrap}.guide-failure-actions .el-button+.el-button{margin:0}
</style>
