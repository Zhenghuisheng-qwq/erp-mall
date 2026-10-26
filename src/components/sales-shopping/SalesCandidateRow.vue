<template>
    <article class="candidate-card" :data-sales-candidate="candidate.key" :data-sales-candidate-sku="candidate.skuId||''">
      <div class="candidate-main"><strong>{{candidate.summary?.name||candidate.item.name}}</strong><p class="muted">{{candidate.summary?displaySpec(candidate.summary.skuId,candidate.summary.spec):candidate.item.service?.description}}</p><div class="candidate-state"><el-tag size="small" :type="candidate.status==='compatible'?'success':candidate.status==='incompatible'?'danger':['conditional','pending'].includes(candidate.status)?'warning':'info'">{{labels[candidate.status]}}</el-tag><small v-if="selected(candidate)">已选 {{selected(candidate)}}</small></div><details><summary>查看适用依据</summary><p>{{candidate.reason||'不要求适用核验，作为搭配选择。'}}</p><p>{{candidate.item.checkTarget==='source'?'仅核对当前来源商品':candidate.item.checkTarget==='device'?'核对本次使用设备':'不作适用承诺'}}</p><p v-if="candidate.item.note">{{candidate.item.note}}</p><p v-if="candidate.item.source" class="muted">{{candidate.item.source}}</p></details></div>
      <div class="candidate-actions"><el-button type="primary" size="small" :disabled="!candidate.canAdd||disabled||!!limitReason(candidate)" :data-sales-add-candidate="candidate.key" @click="emit('add',candidate)">加入</el-button><small v-if="limitReason(candidate)" class="limit-reason">{{limitReason(candidate)}}</small><el-button v-if="candidate.skuId" link size="small" @click="emit('browse',candidate)">查看相关</el-button></div>
    </article>
</template>
<script setup lang="ts">
import type {SalesCandidate} from '../../domain/salesConfigurationTypes'
defineProps<{candidate:SalesCandidate;disabled:boolean;selected:(candidate:SalesCandidate)=>number;displaySpec:(id:string,fallback?:string)=>string;limitReason:(candidate:SalesCandidate)=>string}>()
const emit=defineEmits<{add:[candidate:SalesCandidate];browse:[candidate:SalesCandidate]}>()
const labels={compatible:'已确认适用',conditional:'需核对条件',pending:'依据待确认',incompatible:'明确不适用','not-required':'搭配推荐'}
</script>
<style scoped>
.candidate-card{display:flex;gap:10px;align-items:flex-start;padding:12px 0;border-bottom:1px solid var(--el-border-color-lighter)}.candidate-main{flex:1;min-width:0}.candidate-main>strong{font-size:13px}.candidate-main p{font-size:12px;line-height:1.7;margin:7px 0}.candidate-actions{display:flex;flex-direction:column;gap:8px;flex-shrink:0}.candidate-actions .el-button{margin:0}.limit-reason{font-size:11px;color:var(--el-text-color-secondary);max-width:110px;line-height:1.5}.candidate-state{display:flex;gap:7px;align-items:center;flex-wrap:wrap;font-size:11px;color:var(--el-text-color-secondary)}details{font-size:12px;line-height:1.7;margin-top:9px;overflow-wrap:anywhere}summary{color:var(--el-color-primary);cursor:pointer}button:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:2px}
</style>
