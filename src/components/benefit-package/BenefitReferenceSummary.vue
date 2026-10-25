<template><section data-reference-totals><p v-if="!totals">参考价格未记录或金额无效，需检查成员输入。</p><template v-else><p>每包商品及按包服务已知参考合计：{{ money(totals.perPackageKnownCents) }} 元</p><p>按次服务本次参考金额：{{ money(totals.perDeliveryKnownCents) }} 元</p><p>本次全部已知参考合计：{{ money(totals.totalKnownCents) }} 元 · {{ totals.complete?'参考价完整':`未完整，缺价 ${totals.missingCount} 项` }}</p><p v-if="totals.differenceCents!==null">人工参考合计减整包报价差额：{{ totals.differenceCents<0?'-':'' }}{{ money(Math.abs(totals.differenceCents)) }} 元（负值表示报价高于人工参考合计）</p></template></section></template>
<script setup lang="ts">
import type {BenefitReferenceTotals} from '../../domain/benefitPackageTypes'
import {formatBenefitAmount as money} from '../../domain/benefitPackages'
defineProps<{totals?:BenefitReferenceTotals}>()
</script>
<style scoped>section{font-size:13px;line-height:1.8;margin:12px 0;padding:12px;background:var(--app-surface-muted);border-radius:8px}</style>
