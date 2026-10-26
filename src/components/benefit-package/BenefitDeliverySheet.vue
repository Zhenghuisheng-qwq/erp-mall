<template>
  <section v-if="!supportedBenefitDelivery(delivery)" data-unsupported-delivery role="status"><p>{{ unsupportedDeliveryMessage }}</p><p>编号：{{ deliveryBasicText('code' in delivery ? delivery.code : delivery.packageCode) }} · 版本：{{ deliveryBasicText('snapshotVersion' in delivery ? delivery.snapshotVersion : delivery.compositionVersion) }}</p></section>
  <article v-else class="delivery-sheet" data-benefit-delivery-sheet>
    <header class="sheet-header">
      <div><p class="eyebrow">权益包交付清单</p><h1><button class="member-toggle" @click="membersOpen=!membersOpen" :aria-expanded="membersOpen" data-toggle-delivery-members>{{ delivery.packageName }} · {{ membersOpen?'收起成员':'展开成员' }}</button></h1><p>{{ 'code' in delivery ? delivery.code : '确认后生成清单编号' }}</p></div>
      <div class="sheet-price"><span>本次总报价</span><strong data-delivery-total-quote>{{ formatBenefitCents(delivery.quote.totalCents) }}</strong><span>人民币 CNY · {{ delivery.packageCount }} 包</span></div>
    </header>
    <dl class="sheet-facts">
      <div><dt>来源权益包</dt><dd>{{ delivery.packageCode }} · 修订 {{ delivery.sourceRevision }}</dd></div>
      <div><dt>适配设备</dt><dd>{{ delivery.deviceLabel || '普通组合包，未做设备适配校验' }}</dd></div>
      <div><dt>包含主机</dt><dd>{{ includedHostText || '不包含手机商品' }}</dd></div>
      <div><dt>每包报价</dt><dd>{{ formatBenefitCents(delivery.quote.amountCents) }}<span v-if="delivery.quote.needsReview"> · 人工参考报价，需核对</span></dd></div>
      <div v-if="'generatedAt' in delivery"><dt>生成时间</dt><dd>{{ delivery.generatedAt }}</dd></div>
    </dl>
    <p>{{goodsSummary.length}} 种商品 · {{delivery.goods.length}} 个位置 · {{ delivery.goods.reduce((n,l)=>n+l.totalQuantity,0) }} 件 · {{ delivery.services.length }} 项服务</p><p v-if="delivery.framework">框架：{{ delivery.framework.name }} · 修订 {{ delivery.framework.revision }}</p><BenefitReferenceSummary :totals="delivery.referenceTotals"/><p v-if="delivery.issues.length">{{ delivery.issues.map(i=>i.message).join('；') }}</p>
    <div v-show="membersOpen" class="delivery-members">
    <section class="sheet-section">
      <h2>组成位置明细 <span>{{delivery.goods.length}} 个位置</span></h2>
      <div class="sheet-table-wrap"><table data-delivery-goods><thead><tr><th>商品与规格</th><th>每包</th><th>本次总量</th><th>人工参考单价／行金额</th><th>适配结论</th></tr></thead><tbody>
        <tr v-for="item in delivery.goods" :key="item.lineId" :data-delivery-sku="item.skuId" :data-delivery-position="item.lineId"><td><el-tag size="small" effect="plain">{{item.role==='host'?'主机实物':item.groupName||(!item.groupId?'未分组':item.groupId)}}</el-tag><p class="fine">来源位置：{{item.lineId}}</p><strong>{{ item.name }}</strong><p>{{ item.code }} · {{ item.typeName }}</p><p>{{ item.spec }}</p><p class="fine">所属 SPU：{{ item.familyName }}</p></td><td>{{ item.perPackageQuantity }} 件</td><td>{{ item.totalQuantity }} 件</td><td>{{ referenceMoney(item.referencePrice?.amountCents) }} / {{ referenceMoney(item.referenceLineCents) }}<p>本次 {{ referenceMoney(item.referenceTotalCents) }}</p><p>来源：{{ item.referencePrice ? '本次人工输入' : '未记录' }}</p></td><td>{{ compatibilityLabels[item.compatibility.basicStatus] }}<p>快充：{{ compatibilityLabels[item.compatibility.fastChargeStatus] }}</p></td></tr>
        <tr v-if="!delivery.goods.length"><td colspan="4">本清单没有实物商品。</td></tr>
      </tbody></table></div>
    </section>
    <section class="sheet-section" data-delivery-sku-summary><h2>按 SKU 汇总核对</h2><p class="sheet-note">仅汇总实物数量；各位置独立价格与来源保留在上表，服务另列。</p><div class="sheet-table-wrap"><table><thead><tr><th>销售 SKU</th><th>每包合计</th><th>本次总量</th><th>来源位置</th></tr></thead><tbody><tr v-for="item in goodsSummary" :key="item.skuId" :data-aggregate-sku="item.skuId"><td>{{item.name}} · {{item.code}}</td><td>{{item.perPackageQuantity}} 件</td><td>{{item.totalQuantity}} 件</td><td>{{item.positionIds.join('、')}}</td></tr></tbody></table></div></section>
    <section v-if="delivery.framework?.rules?.length" class="sheet-section" data-delivery-group-rules><h2>冻结框架组间规则</h2><p v-for="rule in delivery.framework.rules" :key="rule.id">{{rule.id}} · {{delivery.framework.groups.find(group=>group.id===rule.sourceGroupId)?.name||rule.sourceGroupId}} {{rule.kind==='requires'?'有选配时需要':rule.kind==='excludes'?'不能同时选':'不支持的历史规则'}} {{delivery.framework.groups.find(group=>group.id===rule.targetGroupId)?.name||rule.targetGroupId}} · {{rule.enabled?'启用':'停用'}} · {{rule.note}}</p></section>
    <section class="sheet-section">
      <h2>服务权益 <span>{{ delivery.services.length }} 项</span></h2>
      <div class="sheet-table-wrap"><table data-delivery-services><thead><tr><th>服务约定</th><th>计量方式</th><th>约定数量</th><th>本次总量</th><th>人工参考单价／本次金额</th></tr></thead><tbody>
        <tr v-for="item in delivery.services" :key="item.id" :data-delivery-service="item.id"><td><strong>{{ item.name }}</strong><p v-if="item.validity">期限说明：{{ item.validity }}</p><p v-if="item.description">{{ item.description }}</p></td><td>{{ item.measurement === 'per-package' ? '每包计量' : '本次交付计量' }}</td><td>{{ item.quantity }} {{ item.unit }}</td><td>{{ item.totalQuantity }} {{ item.unit }}</td><td>{{ referenceMoney(item.referencePrice?.amountCents) }} / {{ referenceMoney(item.referenceTotalCents) }}<p>{{ item.referencePrice?'本次人工输入':'未记录' }}</p></td></tr>
        <tr v-if="!delivery.services.length"><td colspan="4">本清单没有服务权益。</td></tr>
      </tbody></table></div>
      <p class="sheet-note">期限描述保持原约定，不因包数相乘；本清单不代表服务已激活或已核销。</p>
    </section>
    <section class="sheet-section" data-delivery-conditions>
      <h2>适配依据与交付前提</h2>
      <p v-if="!delivery.device" class="sheet-note">普通组合包，未做设备适配校验，不作全机型兼容承诺。</p>
      <div v-for="item in delivery.goods" :key="item.lineId" class="basis-block">
        <strong>{{ item.name }}</strong><p v-for="reason in item.compatibility.reasons" :key="reason">{{ reason }}</p>
        <div v-for="capability in item.compatibility.capabilities" :key="capability.capability" class="capability-summary"><b>{{ capabilityLabels[capability.capability] }}：{{ compatibilityLabels[capability.status] }}</b><p v-for="condition in capability.conditions" :key="condition.label">{{ {met:'已满足',unmet:'不满足',unknown:'需确认'}[condition.state] }} · {{ condition.label }}</p><p v-for="source in capability.sources" :key="source" class="fine">依据：{{ source }}</p></div>
      </div>
      <div v-if="delivery.confirmations.length" class="confirmation-list"><h3>本次包内人工确认</h3><div v-for="confirmation in delivery.confirmations" :key="confirmation.key"><p><strong>{{ confirmation.skuId }} · {{ capabilityLabels[confirmation.capability] }}</strong></p><p v-if="positioned" class="fine">位置：{{ confirmation.positionId || '位置未记录' }} · 组：{{ confirmationPosition(confirmation)?.groupId || '未分组／未记录' }} · {{ confirmationPosition(confirmation)?.groupName || '组名未记录' }} · {{ confirmationPosition(confirmation)?.name || '商品名称未记录' }} · {{ confirmationPosition(confirmation)?.role === 'host' ? '主机实物' : '商品' }}</p><p>按前提交付，仍为有条件适用</p><p>{{ confirmation.note }}</p><p class="fine">确认依据：{{ confirmation.declarationIds.join('、') || '声明未记录' }}</p><p v-for="condition in confirmation.conditionLabels" :key="condition">{{ condition }}</p><p class="fine">确认时间：{{ confirmation.confirmedAt }}</p></div></div>
      <p class="sheet-note">人工确认仅用于本包约定，不改变全局兼容声明；有条件适用仍按所列前提交付。</p>
    </section>
    </div><p class="sheet-footer">此清单保存的是商品与服务交付约定，不代表已支付、已出库或已发货。</p>
  </article>
</template>
<script setup lang="ts">
import { computed,ref } from 'vue'
import { supportedBenefitDelivery, unsupportedDeliveryMessage, deliveryBasicText, deliveryConfirmationPosition } from '../../domain/benefitDeliveryPresentation'
import BenefitReferenceSummary from './BenefitReferenceSummary.vue'
import {formatBenefitAmount} from '../../domain/benefitPackages'
const membersOpen=ref(true)
const referenceMoney=(n:number|null|undefined)=>n===null||n===undefined?'未记录':formatBenefitAmount(n)+' 元'
import type { BenefitDeliveryPreview, BenefitDeliverySnapshot,BenefitDeliverySkuTotal } from '../../domain/benefitPackageTypes'
import { capabilityLabels, compatibilityLabels, formatBenefitCents } from './benefitPackagePresentation'
const props = defineProps<{ delivery: BenefitDeliveryPreview | BenefitDeliverySnapshot }>()
const positioned=computed(()=> 'snapshotVersion' in props.delivery ? props.delivery.snapshotVersion===2 : props.delivery.compositionVersion===2)
const confirmationPosition=(confirmation: Parameters<typeof deliveryConfirmationPosition>[1])=>deliveryConfirmationPosition(props.delivery,confirmation)
const goodsSummary=computed(()=>{if(!supportedBenefitDelivery(props.delivery))return [];if(props.delivery.goodsSummary)return props.delivery.goodsSummary;const map=new Map<string,BenefitDeliverySkuTotal>();for(const line of props.delivery.goods){const current=map.get(line.skuId);if(current){current.perPackageQuantity+=line.perPackageQuantity;current.totalQuantity+=line.totalQuantity;current.positionIds.push(line.lineId)}else map.set(line.skuId,{skuId:line.skuId,name:line.name,code:line.code,perPackageQuantity:line.perPackageQuantity,totalQuantity:line.totalQuantity,positionIds:[line.lineId]})}return [...map.values()]})
const includedHostText = computed(() => !supportedBenefitDelivery(props.delivery) ? '' : props.delivery.hostSkuIds.map(id => {
  const item = props.delivery.goods.find(row => row.skuId === id)
  return item ? `${item.name}（${item.code}）` : id
}).join('、'))
</script>
<style scoped>
.delivery-sheet { background:var(--surface-bg); border:1px solid var(--border-default); border-radius:12px; padding:28px; color:var(--text-primary); line-height:1.65; }.sheet-header { display:flex; justify-content:space-between; gap:24px; padding-bottom:24px; border-bottom:1px solid var(--border-default); }.eyebrow { color:var(--text-secondary); font-size:13px; margin-bottom:6px; }.sheet-header h1 { font-size:24px; margin-bottom:6px; overflow-wrap:anywhere; }.sheet-price { display:flex; flex-direction:column; text-align:right; flex-shrink:0; font-size:13px; color:var(--text-secondary); }.sheet-price strong { font-size:26px; color:var(--text-primary); }.sheet-facts { display:grid; grid-template-columns:1fr 1fr; gap:14px 24px; padding:20px 0; margin:0; }.sheet-facts dt { font-size:12px; color:var(--text-secondary); }.sheet-facts dd { margin:3px 0 0; overflow-wrap:anywhere; font-size:14px; }.sheet-section { margin-top:24px; }.sheet-section h2 { font-size:16px; margin-bottom:12px; }.sheet-section h2 span { font-size:13px; color:var(--text-secondary); font-weight:400; margin-left:8px; }.sheet-table-wrap { overflow:auto; }table { overflow-wrap:anywhere; table-layout:fixed; border-collapse:collapse; width:100%; font-size:13px; }th,td { border:1px solid var(--border-default); text-align:left; padding:12px; vertical-align:top; }th { background:var(--app-surface-muted); white-space:nowrap; }td:first-child { min-width:200px; }td p { margin-top:5px; overflow-wrap:anywhere; }.fine,.sheet-note,.sheet-footer { color:var(--text-secondary); font-size:12px; }.sheet-note { margin-top:10px; }.basis-block { padding:12px 0; border-top:1px solid var(--border-default); font-size:13px; overflow-wrap:anywhere; }.basis-block p { margin-top:5px; }.capability-summary { margin-top:10px; padding-left:12px; border-left:2px solid var(--border-default); }.confirmation-list { overflow-wrap:anywhere; padding:16px; border:1px solid var(--border-default); border-radius:8px; margin-top:12px; font-size:13px; }.confirmation-list h3 { font-size:14px; margin-bottom:12px; }.confirmation-list>div+div { margin-top:14px; }.sheet-footer { margin-top:28px; padding-top:16px; border-top:1px solid var(--border-default); }
@media(max-width:800px) { .delivery-sheet { padding:16px; }.sheet-header { flex-direction:column; gap:12px; }.sheet-price { text-align:left; }.sheet-facts { grid-template-columns:1fr; gap:10px; } }
.member-toggle{font:inherit;color:inherit;border:0;background:none;text-align:left;cursor:pointer}
@media print { .delivery-members{display:block!important}.member-toggle{pointer-events:none} .delivery-sheet { border:0; padding:0; border-radius:0; background:#fff; color:#000; }.sheet-header,.sheet-facts,.basis-block,.confirmation-list { break-inside:avoid; }.sheet-table-wrap { overflow:visible; }thead { display:table-header-group; }tr { break-inside:avoid; }th,td { border-color:#bbb; }th { background:#f4f4f4 !important; }.fine,.sheet-note,.sheet-footer,.sheet-facts dt,.sheet-price { color:#444; }.sheet-price strong { color:#000; }.sheet-section { break-inside:auto; } }
</style>
