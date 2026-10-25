<template><div class="reference-price"><label>本次人工参考单价（元）<el-input :model-value="text" :disabled="disabled" :aria-label="label || '本次人工参考单价'" placeholder="未记录；0 表示免费" @update:model-value="update(String($event))" /></label><p v-if="error" role="alert" class="issue-error">{{ error }}</p><p v-else class="muted">{{ value === null ? '未记录参考单价' : `人工输入 · 行金额 ${amount}` }}；不作为全局售价，不额外计入整包报价。</p></div></template>
<script setup lang="ts">
import {computed} from 'vue'
import {parseBenefitAmount,formatBenefitAmount} from '../../domain/benefitPackages'
import {referenceLine,referencePriceProblem} from '../../domain/benefitPricing'
import type {BenefitReferencePrice} from '../../domain/benefitPackageTypes'
const props=defineProps<{modelValue?:BenefitReferencePrice;quantity:number;label?:string;disabled?:boolean}>(),emit=defineEmits<{'update:modelValue':[BenefitReferencePrice]}>()
const value=computed(()=>props.modelValue?.amountCents??null),text=computed(()=>props.modelValue?.inputText??(value.value===null?'':formatBenefitAmount(value.value))),error=computed(()=>referencePriceProblem(props.modelValue)),amount=computed(()=>{try{const n=referenceLine(props.modelValue,props.quantity);return n===null?'未记录':formatBenefitAmount(n)+' 元'}catch(e){return String(e)}})
function update(text:string){let amountCents:number|null;try{amountCents=parseBenefitAmount(text)}catch{amountCents=NaN}emit('update:modelValue',{amountCents,source:'manual',enteredAt:new Date().toISOString(),inputText:text})}
</script>
<style scoped>.reference-price{margin:12px 0;max-width:460px}.reference-price p{font-size:12px;line-height:1.6;margin-top:6px}</style>
