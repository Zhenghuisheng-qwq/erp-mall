<template>
  <div data-benefit-packages>
    <PageHead title="常用权益包" desc="选择一份组合开始本次选购，原组合与历史交付保持独立。"><el-button v-if="store.can('product:sales:read')" type="primary" data-start-sales-shopping @click="startShopping()">开始选购</el-button><el-button v-if="store.can('product:sales:read')" data-compose-with-host @click="hostOpen=true">从手机开始</el-button><el-dropdown v-if="store.can('product:benefit:create')" trigger="click"><el-button aria-label="常用权益包更多操作">更多</el-button><template #dropdown><el-dropdown-menu><el-dropdown-item data-new-benefit-package @click="router.push('/benefit-packages/new')">高级新建</el-dropdown-item></el-dropdown-menu></template></el-dropdown></PageHead>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="page-error" />
    <section class="panel list-panel">
      <el-tabs v-model="tab"><el-tab-pane v-if="store.can('product:benefit:read')" label="常用组合" name="packages" /><el-tab-pane v-if="store.can('product:benefit:read')" label="高级框架" name="frameworks" /><el-tab-pane v-if="store.can('product:delivery:read')" :label="`交付清单 ${deliveries.length}`" name="deliveries" /></el-tabs>
      <BenefitFrameworkManager v-if="tab === 'frameworks' && store.can('product:benefit:read')"/><div v-if="(tab === 'packages' && store.can('product:benefit:read')) || (tab === 'deliveries' && store.can('product:delivery:read'))" class="list-tools"><el-input v-model="keyword" clearable :placeholder="tab === 'packages' ? '搜索组合名称或编号' : '搜索清单、包名称或编号'" aria-label="搜索常用组合" /><el-select v-if="tab === 'packages'" v-model="status" placeholder="全部状态" aria-label="组合状态"><el-option label="全部状态" value="" /><el-option label="草稿" value="draft" /><el-option label="可用" value="available" /><el-option label="停用" value="disabled" /><el-option label="需处理" value="issues" /></el-select><el-checkbox v-if="tab === 'packages'" v-model="favoritesOnly">只看已收藏</el-checkbox></div>
      <template v-if="tab === 'packages' && store.can('product:benefit:read')">
        <p class="list-count">{{ rows.length }} 个组合 · 已收藏优先展示</p>
        <el-empty v-if="!rows.length" :description="keyword || status || favoritesOnly ? '没有匹配的组合，请调整搜索或状态。' : '还没有组合。可以在销售选购中完成清单，再存为常用组合。'"><el-button v-if="store.can('product:sales:read') && !keyword && !status && !favoritesOnly" @click="startShopping()">开始选购</el-button></el-empty>
        <article v-for="row in rows" :key="row.item.id" class="package-card" :data-benefit-package="row.item.id">
          <div class="card-main"><div class="card-heading"><h2><button class="linkish" @click="edit(row.item.id)">{{ row.item.name || '未命名草稿' }}</button></h2><el-tag size="small" :type="row.item.status === 'disabled' ? 'info' : row.needsAttention ? 'warning' : row.item.status === 'available' ? 'success' : 'info'">{{ row.needsAttention ? '需处理' : packageStatusLabels[row.item.status] }}</el-tag><el-tag v-if="!supported(row.item)" size="small" type="warning">未知版本 · 只读</el-tag><el-tag v-else-if="row.item.compositionVersion !== 2" size="small" type="info">旧版 · 高级详情</el-tag><el-tag v-if="row.item.favorite" size="small" effect="plain">常用</el-tag></div><p class="muted">{{ memberSummary(row.item) }}</p><p class="device-line">{{ row.validation.deviceLabel || '未指定使用设备' }}</p><p v-if="row.needsAttention" class="issue-warn attention">{{ row.validation.issues.find(issue => issue.severity === 'error')?.message }}</p></div>
          <div class="card-price"><strong>{{ formatBenefitCents(row.item.quote.amountCents) }}</strong><span>参考报价 · {{ row.validation.issues.some(issue => /quote/.test(issue.code)) || !row.item.quote.reviewedBasis ? '需复核' : '已复核' }}</span></div>
          <div class="card-actions"><el-button v-if="store.can('product:sales:read') && store.can('product:benefit:create')" type="primary" :disabled="row.item.status === 'disabled' || !supported(row.item) || row.item.compositionVersion !== 2" :data-use-combination="row.item.id" @click="useCombination(row.item.id)">使用此组合</el-button><el-button @click="edit(row.item.id)">{{ supported(row.item) ? '高级详情' : '只读详情' }}</el-button><el-button v-if="store.can('product:benefit:create')" @click="copy(row.item.id)" :data-copy-benefit-package="row.item.id" :disabled="!supported(row.item)">高级复制</el-button><el-button v-if="store.can('product:benefit:update') && supported(row.item)" link :loading="pendingId === row.item.id" :disabled="Boolean(pendingId)" @click="favorite(row.item.id)">{{ row.item.favorite ? '取消收藏' : '收藏' }}</el-button><el-button v-if="store.can('product:benefit:update') && supported(row.item)" link :disabled="Boolean(pendingId)" :type="row.item.status === 'disabled' ? 'primary' : 'danger'" @click="setStatus(row.item.id)">{{ row.item.status === 'disabled' ? '启用' : '停用' }}</el-button></div>
        </article>
      </template>
      <template v-else-if="tab === 'deliveries' && store.can('product:delivery:read')"><el-empty v-if="!deliveries.length" description="还没有匹配的交付清单。先保存权益包，再明确发起一次清单生成。" /><article v-for="item in deliveries" :key="item.id" class="package-card" :data-benefit-delivery="item.id"><div class="card-main"><h2>{{ item.packageName }}</h2><p class="muted">{{ item.code }} · 来源 {{ item.packageCode }} / 修订 {{ item.sourceRevision }}</p><p class="device-line">{{ item.packageCount }} 包 · {{ item.generatedAt }}</p></div><div class="card-price"><strong>{{ supportedBenefitDelivery(item) ? formatBenefitCents(item.quote.totalCents) : '版本暂不支持' }}</strong><span>本次总报价</span></div><el-button @click="router.push(`/benefit-packages/deliveries/${encodeURIComponent(item.id)}`)">查看清单</el-button></article></template>
    </section>
    <el-dialog v-model="hostOpen" title="选择手机" width="min(650px,94vw)"><p>选择手机后进入权益包选购。停售手机可作为已有设备查看配件，只有在售商品才能由您明确加入实物清单。</p><el-select v-model="hostSkuId" filterable placeholder="搜索主机名称、编号或规格" aria-label="选择开始选购的手机" style="width:100%"><el-option v-for="host in hostSkus" :key="host.skuId" :value="host.skuId" :label="`${host.name} · ${host.code} · ${host.spec}`"/></el-select><template #footer><el-button @click="hostOpen=false">取消</el-button><el-button type="primary" :disabled="!hostSkuId" @click="startShopping(hostSkuId)">查看此手机</el-button></template></el-dialog>
  </div>
</template>
<script setup lang="ts">
import { supportedBenefitDelivery } from '../domain/benefitDeliveryPresentation'
import BenefitFrameworkManager from '../components/benefit-package/BenefitFrameworkManager.vue'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import PageHead from '../components/PageHead.vue'
import { useCatalogStore } from '../stores/catalog'
import type { BenefitPackageDraft } from '../domain/benefitPackageTypes'
import { validateBenefitPackage,benefitSkuSummary } from '../domain/benefitPackages'
import {salesShoppingEntryQuery} from '../components/sales-shopping/salesShoppingNavigation'
import {salesDeviceSkus} from '../domain/salesCatalog'
import { formatBenefitCents, packageStatusLabels } from '../components/benefit-package/benefitPackagePresentation'
const store = useCatalogStore(), router = useRouter(),hostOpen=ref(false),hostSkuId=ref('')
const hostSkus=computed(()=>salesDeviceSkus(store.data).flatMap(sku=>{const summary=benefitSkuSummary(store.data,sku.id);return summary?[summary]:[]}))
const tab = ref(''), keyword = ref(''), status = ref(''), favoritesOnly = ref(false), error = ref(''), pendingId = ref('')
// Prefer the existing package landing view, then the other explicitly readable sections.
const availableTabs = computed(() => [
  ...(store.can('product:benefit:read') ? ['packages', 'frameworks'] : []),
  ...(store.can('product:delivery:read') ? ['deliveries'] : []),
])
watch(availableTabs, allowed => { if (!allowed.includes(tab.value)) tab.value = allowed[0] || '' }, { immediate: true, flush: 'sync' })
const validatedRows = computed(() => (store.data.benefitPackages || []).map(item => { const validation = validateBenefitPackage(store.data, item); return { item, validation, needsAttention: item.status !== 'disabled' && !validation.canSaveAvailable } }))
const rows = computed(() => validatedRows.value.filter(row => {
  const text = keyword.value.trim().toLocaleLowerCase()
  return (!text || `${row.item.name} ${row.item.code}`.toLocaleLowerCase().includes(text)) && (!favoritesOnly.value || row.item.favorite) && (!status.value || (status.value === 'issues' ? row.needsAttention : row.item.status === status.value))
}).sort((left, right) => Number(right.item.favorite) - Number(left.item.favorite)))
const deliveries = computed(() => (store.can('product:delivery:read') ? store.data.benefitDeliveries || [] : []).filter(item => !keyword.value.trim() || `${item.packageName} ${item.packageCode} ${item.code}`.toLocaleLowerCase().includes(keyword.value.trim().toLocaleLowerCase())).slice().reverse())
function supported(item:BenefitPackageDraft) { return (item.compositionVersion === undefined || item.compositionVersion === 1 || item.compositionVersion === 2) && (!item.sales || item.sales.schemaVersion === 1) && (!item.framework || ['type-v1','type-v2'].includes(item.framework.kind)) }
function memberSummary(item:BenefitPackageDraft) { return [...item.goods.slice(0,3).map(line=>`${line.snapshot?.name || line.skuId} × ${line.quantity}`),...item.services.slice(0,2).map(line=>`${line.name} × ${line.quantity}`),...(item.goods.length>3||item.services.length>2?['…']:[])].join(' · ') || '尚未添加商品和服务' }
function startShopping(skuId=''){if(!store.can('product:sales:read'))return;if(skuId&&!hostSkus.value.some(sku=>sku.skuId===skuId)){error.value='此手机的设备身份或适用依据已失效，请重新选择。';return}hostOpen.value=false;router.push({path:'/sales-shopping',query:{...salesShoppingEntryQuery(store,skuId),...(skuId?{sourceContext:'1'}:{})}})}
function useCombination(id:string) { router.push({path:'/sales-shopping',query:{scheme:id,copy:'1'}}) }
function edit(id: string) { router.push(`/benefit-packages/${encodeURIComponent(id)}`) }
function copy(id: string) { router.push({ path: '/benefit-packages/new', query: { copy: id } }) }
async function favorite(id: string) {
  const item = store.data.benefitPackages?.find(value => value.id === id); if (!store.can('product:benefit:update') || !item || pendingId.value) return
  pendingId.value = id
  try { const result = await store.setBenefitPackageFavorite(id, !item.favorite, item.revision); error.value = result.ok ? '' : result.message || '常用设置未保存，请重试。' }
  catch (problem) { error.value = `常用设置未保存：${problem instanceof Error ? problem.message : String(problem)}` }
  finally { pendingId.value = '' }
}
async function setStatus(id: string) {
  const item = store.data.benefitPackages?.find(value => value.id === id)
  if (!store.can('product:benefit:update') || !item || pendingId.value) return
  if (item.status !== 'disabled') { try { await ElMessageBox.confirm(`停用「${item.name || item.code}」后不能生成新清单，历史清单继续保留。`, '停用权益包', { confirmButtonText: '确认停用', cancelButtonText: '取消' }) } catch { return } }
  pendingId.value = id
  try { const result = await store.setBenefitPackageStatus(id, item.status === 'disabled' ? 'available' : 'disabled', item.revision); error.value = result.ok ? '' : result.message || '状态未保存，请重试。' }
  catch (problem) { error.value = `状态未保存：${problem instanceof Error ? problem.message : String(problem)}` }
  finally { pendingId.value = '' }
}
</script>
<style scoped>
.page-error { margin-bottom:14px; }.list-panel { min-height:300px; }.list-tools { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin:8px 0 16px; }.list-tools>.el-input { width:320px; }.list-tools>.el-select { width:150px; }.list-count { color:var(--text-secondary); font-size:13px; margin-bottom:12px; }.package-card { display:flex; align-items:center; gap:24px; padding:20px 0; border-top:1px solid var(--border-default); }.card-main { flex:1; min-width:0; }.card-heading { display:flex; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px; }.card-main h2 { margin:0; font-size:16px; overflow-wrap:anywhere; }.card-heading .linkish { font-weight:650; text-align:left; }.device-line { font-size:13px; margin-top:8px; line-height:1.7; }.attention { font-size:12px; margin-top:8px; line-height:1.7; }.card-price { display:flex; flex-direction:column; gap:6px; text-align:right; flex-shrink:0; }.card-price strong { font-size:17px; }.card-price span { font-size:12px; color:var(--text-secondary); }.card-actions { display:flex; align-items:center; gap:8px; flex-wrap:wrap; max-width:300px; }.card-actions>.el-button { margin-left:0; }
@media(max-width:1000px) { .package-card { flex-wrap:wrap; gap:16px; }.card-actions { width:100%; max-width:none; } }
@media(max-width:700px) { .list-tools>.el-input { width:100%; }.card-price { text-align:left; }.package-card { align-items:flex-start; }.card-main { flex-basis:100%; } }
</style>
