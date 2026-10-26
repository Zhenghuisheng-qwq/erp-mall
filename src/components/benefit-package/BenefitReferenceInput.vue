<template><div class="reference-price"><label>本次人工参考单价（元）<el-input :model-value="text" :disabled="disabled" :aria-label="label || '本次人工参考单价'" placeholder="未记录；0 表示免费" @update:model-value="update(String($event))" /></label><p v-if="error" role="alert" class="issue-error">{{ error }}</p><p v-else class="muted">{{ value === null ? '未记录参考单价' : `人工输入 · 行金额 ${amount}` }}；不作为全局售价，不额外计入整包报价。</p></div></template>
<script setup lang="ts">
import {computed,ref,watch,onMounted,onBeforeUnmount} from 'vue'
import {parseBenefitAmount,formatBenefitAmount} from '../../domain/benefitPackages'
import {referenceLine,referencePriceProblem} from '../../domain/benefitPricing'
import type {BenefitReferencePrice} from '../../domain/benefitPackageTypes'
const props=defineProps<{modelValue?:BenefitReferencePrice;quantity:number;label?:string;disabled?:boolean}>(),emit=defineEmits<{'update:modelValue':[BenefitReferencePrice];'validity-change':[message:string]}>()
const text=ref(props.modelValue?.inputText??(props.modelValue?.amountCents===null||props.modelValue?.amountCents===undefined?'':formatBenefitAmount(props.modelValue.amountCents))),localError=ref(referencePriceProblem(props.modelValue))
const value=computed(()=>props.modelValue?.amountCents??null),error=computed(()=>localError.value||referencePriceProblem(props.modelValue)),amount=computed(()=>{try{const n=referenceLine(props.modelValue,props.quantity);return n===null?'未记录':formatBenefitAmount(n)+' 元'}catch(e){return String(e)}})
watch(()=>JSON.stringify(props.modelValue),()=>{text.value=props.modelValue?.inputText??(value.value===null?'':formatBenefitAmount(value.value));localError.value=referencePriceProblem(props.modelValue);emit('validity-change',localError.value)})
function update(raw:string){text.value=raw;let amountCents:number|null;try{amountCents=parseBenefitAmount(raw)}catch{amountCents=NaN}const price:BenefitReferencePrice={amountCents,source:'manual',enteredAt:new Date().toISOString(),inputText:raw};localError.value=referencePriceProblem(price);emit('validity-change',localError.value);emit('update:modelValue',price)}
onMounted(()=>emit('validity-change',localError.value));onBeforeUnmount(()=>emit('validity-change',''))

</script>
<style scoped>.reference-price{margin:12px 0;max-width:460px}.reference-price p{font-size:12px;line-height:1.6;margin-top:6px}</style>
