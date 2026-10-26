<template>
  <section class="option-group" :data-sales-group="group.item.id">
    <div class="group-head"><h3>{{group.item.name}} <el-tag v-if="group.item.required" size="small" type="warning">必选</el-tag></h3><span>{{allProductCount}} 款商品 · {{group.rows.filter(row=>row.skuId).length}} 个规格<span v-if="group.rows.some(row=>!row.skuId)"> · {{group.rows.filter(row=>!row.skuId).length}} 项服务</span> · 已选 {{selectedCount}}</span></div>
    <div v-if="group.rows.length" class="group-tools"><el-input v-model="search" clearable :placeholder="`搜索${group.item.name}`" :aria-label="`搜索${group.item.name}候选`"/><div class="status-filters"><button :aria-pressed="status==='all'" @click="status='all'">全部 {{group.rows.length}}</button><button v-if="reviewCount" :aria-pressed="status==='review'" @click="status=status==='review'?'all':'review'">需核对 {{reviewCount}}</button><button v-if="blockedCount" :aria-pressed="status==='blocked'" @click="status=status==='blocked'?'all':'blocked'">不可选 {{blockedCount}}</button></div></div>
    <p v-if="!group.rows.length" class="muted" role="status">{{emptyReason}}</p><p v-else-if="!filtered.length" class="muted">没有匹配的候选。<el-button link @click="search='';status='all'">清除组内筛选</el-button></p>
    <article v-for="card in cards.slice(0,shown)" :key="card.key" class="product-card" :data-sales-product-card="card.familyId||'service'" :data-sales-product-context="card.key">
      <template v-if="card.familyId">
        <div class="product-heading"><div><strong>{{card.name}}</strong><p class="muted">{{card.rows.length}} 个规格 · {{cardStatus(card.rows)}}</p><small v-if="card.rows.some(row=>selected(row))" class="selected-summary">{{card.rows.filter(row=>selected(row)).map(row=>`${displaySpec(row.skuId!)} × ${selected(row)}`).join('；')}}</small></div><el-button v-if="card.rows.length>1" size="small" :aria-expanded="!!expanded[card.key]" :aria-label="`${expanded[card.key]?'收起':'选择'} ${card.name} 规格`" @click="expanded[card.key]=!expanded[card.key]">{{expanded[card.key]?'收起规格':'选规格'}}</el-button></div>
      </template>
      <div v-if="card.rows.length===1 || expanded[card.key]" class="actual-candidates">
        <SalesCandidateRow v-for="candidate in card.rows.slice(0,skuShown[card.key]||12)" :key="candidate.key" :candidate="candidate" :disabled="disabled" :selected="selected" :display-spec="displaySpec" :limit-reason="limitReason" @add="emit('add',$event)" @browse="emit('browse',$event)"/>
        <el-button v-if="card.rows.length>(skuShown[card.key]||12)" link @click="skuShown[card.key]=(skuShown[card.key]||12)+12">继续查看 {{Math.min(12,card.rows.length-(skuShown[card.key]||12))}} 个规格</el-button>
      </div>
    </article>
    <el-button v-if="cards.length>shown" link @click="shown+=12">继续查看 {{Math.min(12,cards.length-shown)}} 款（其余 {{cards.length-shown}} 款）</el-button>
  </section>
</template>
<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import SalesCandidateRow from './SalesCandidateRow.vue'
import type {SalesCandidate,SalesOptionItem} from '../../domain/salesConfigurationTypes'
const props=defineProps<{group:{item:SalesOptionItem;rows:SalesCandidate[]};disabled:boolean;selected:(candidate:SalesCandidate)=>number;displaySpec:(id:string,fallback?:string)=>string;contextKey:string}>()
const emit=defineEmits<{add:[candidate:SalesCandidate];browse:[candidate:SalesCandidate]}>()
const expanded=ref<Record<string,boolean>>({}),skuShown=ref<Record<string,number>>({})
const search=ref(''),status=ref<'all'|'review'|'blocked'>('all'),shown=ref(12)
const reviewCount=computed(()=>props.group.rows.filter(row=>row.canAdd&&['pending','conditional'].includes(row.status)).length)
const blockedCount=computed(()=>props.group.rows.filter(row=>!row.canAdd).length)
const selectedCount=computed(()=>props.group.rows.reduce((count,row)=>count+props.selected(row),0))
const filtered=computed(()=>{const term=search.value.trim().toLocaleLowerCase();return props.group.rows.filter(row=>(status.value!=='review'||row.canAdd&&['pending','conditional'].includes(row.status))&&(status.value!=='blocked'||!row.canAdd)&&(!term||`${row.summary?.familyName||''} ${row.summary?.name||row.item.name} ${row.summary?props.displaySpec(row.summary.skuId,row.summary.spec):row.item.service?.description||''} ${row.summary?.code||''}`.toLocaleLowerCase().includes(term))).slice().sort((a,b)=>Number(b.canAdd)-Number(a.canAdd))})
function cardKey(row:SalesCandidate){return JSON.stringify([props.contextKey,row.sourceSkuId,row.item.id,row.item.checkTarget,row.plan?.planId||'',row.plan?.version||0,row.summary?.familyId||`service:${row.key}`])}
const allProductCount=computed(()=>new Set(props.group.rows.filter(row=>row.skuId).map(cardKey)).size)
const cards=computed(()=>{const grouped=new Map<string,{key:string;familyId:string;name:string;rows:SalesCandidate[]}>();for(const row of filtered.value){const key=cardKey(row);if(!grouped.has(key))grouped.set(key,{key,familyId:row.summary?.familyId||'',name:row.summary?.familyName||row.item.name,rows:[]});grouped.get(key)!.rows.push(row)}return [...grouped.values()]})
function cardStatus(rows:SalesCandidate[]){const available=rows.filter(row=>row.canAdd&&['compatible','not-required'].includes(row.status)).length,review=rows.filter(row=>row.canAdd&&['pending','conditional'].includes(row.status)).length,blocked=rows.filter(row=>!row.canAdd).length;return [available?`${available} 个规格${rows.every(row=>row.status==='not-required')?'可搭配':'适用'}`:'',review?`${review} 个需核对`:'',blocked?`${blocked} 个不可选`:''].filter(Boolean).join('、')}
const emptyReason=computed(()=>!props.group.item.scope.ids.length&&props.group.item.scope.kind!=='service'?'此项目尚未设置候选范围，请联系配置人员补齐。':'候选范围中没有实际商品；请核对范围、商品是否存在及上架状态。')
function limitReason(candidate:SalesCandidate){const quantity=props.selected(candidate);if(quantity+candidate.item.defaultQuantity>candidate.item.maxQuantity)return `最多 ${candidate.item.maxQuantity} ${candidate.item.service?.unit||'件'}`;if(candidate.skuId&&!quantity&&new Set(props.group.rows.filter(row=>row.skuId&&props.selected(row)>0).map(row=>row.skuId)).size>=candidate.item.maxKinds)return `本项目最多 ${candidate.item.maxKinds} 种`;return ''}
watch([search,status],()=>{shown.value=12})
</script>
<style scoped>
.option-group{margin-top:18px}.group-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.group-head h3{font-size:14px;margin:0}.group-head>span,.muted{font-size:12px;color:var(--el-text-color-secondary)}.group-tools{margin:10px 0}.status-filters{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}.status-filters button{border:1px solid var(--el-border-color);background:var(--el-bg-color);color:var(--el-text-color-secondary);font-size:12px;padding:4px 8px;border-radius:5px;cursor:pointer}.status-filters button[aria-pressed=true]{border-color:var(--el-color-primary);color:var(--el-color-primary);background:var(--el-color-primary-light-9)}.candidate-card{display:flex;gap:10px;align-items:flex-start;padding:14px 0;border-bottom:1px solid var(--el-border-color-lighter)}.candidate-main{flex:1;min-width:0}.candidate-main>strong{font-size:14px}.candidate-main p{font-size:12px;line-height:1.7;margin:7px 0}.candidate-actions{display:flex;flex-direction:column;gap:8px;flex-shrink:0}.limit-reason{font-size:11px;color:var(--el-text-color-secondary);max-width:110px;line-height:1.5}.candidate-actions .el-button{margin:0}.candidate-state{display:flex;gap:7px;align-items:center;flex-wrap:wrap;font-size:11px;color:var(--el-text-color-secondary)}details{font-size:12px;line-height:1.7;margin-top:9px;overflow-wrap:anywhere}summary{color:var(--el-color-primary);cursor:pointer}button:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:2px}
.product-card{margin-top:10px;border:1px solid var(--el-border-color-lighter);border-radius:7px;padding:10px}.product-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.product-heading strong{font-size:14px}.product-heading p{margin:7px 0}.selected-summary{display:block;font-size:11px;color:var(--el-text-color-secondary);line-height:1.6}.actual-candidates{min-width:0}.actual-candidates :deep(.candidate-card:last-child){border-bottom:0}
</style>
