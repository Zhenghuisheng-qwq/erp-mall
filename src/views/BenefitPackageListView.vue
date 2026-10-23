<template>
  <div data-benefit-packages>
    <PageHead title="权益包" desc="把真实商品和服务约定组合保存，按本次包数生成独立的交付清单。"><el-button v-if="store.isAdmin" type="primary" data-new-benefit-package @click="router.push('/benefit-packages/new')">新建权益包</el-button></PageHead>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="page-error" />
    <section class="panel list-panel">
      <el-tabs v-model="tab"><el-tab-pane label="权益包配置" name="packages" /><el-tab-pane :label="`交付清单 ${deliveries.length}`" name="deliveries" /></el-tabs>
      <div class="list-tools"><el-input v-model="keyword" clearable :placeholder="tab === 'packages' ? '搜索包名称或编号' : '搜索清单、包名称或编号'" aria-label="搜索权益包" /><el-select v-if="tab === 'packages'" v-model="status" placeholder="全部状态" aria-label="权益包状态"><el-option label="全部状态" value="" /><el-option label="草稿" value="draft" /><el-option label="可用" value="available" /><el-option label="停用" value="disabled" /><el-option label="需处理" value="issues" /></el-select><el-checkbox v-if="tab === 'packages'" v-model="favoritesOnly">只看常用包</el-checkbox></div>
      <template v-if="tab === 'packages'">
        <p class="list-count">{{ rows.length }} 个权益包 · 常用包优先展示</p>
        <el-empty v-if="!rows.length" :description="keyword || status || favoritesOnly ? '没有匹配的权益包，请调整搜索或状态。' : '还没有权益包。从设备或已有 SKU 开始，也可以自由添加商品和服务。'"><el-button v-if="store.isAdmin && !keyword && !status && !favoritesOnly" @click="router.push('/benefit-packages/new')">开始组包</el-button></el-empty>
        <article v-for="row in rows" :key="row.item.id" class="package-card" :data-benefit-package="row.item.id">
          <div class="card-main"><div class="card-heading"><h2><button class="linkish" @click="edit(row.item.id)">{{ row.item.name || '未命名草稿' }}</button></h2><el-tag size="small" :type="row.item.status === 'disabled' ? 'info' : row.needsAttention ? 'warning' : row.item.status === 'available' ? 'success' : 'info'">{{ row.needsAttention ? '需处理' : packageStatusLabels[row.item.status] }}</el-tag><el-tag v-if="row.item.favorite" size="small" effect="plain">常用</el-tag></div><p class="muted">{{ row.item.code }} · 修订 {{ row.item.revision }} · {{ row.item.goods.length }} 种商品 / {{ row.item.services.length }} 项服务</p><p class="device-line">{{ row.validation.deviceLabel || '普通组合包 · 未做设备适配校验' }}</p><p v-if="row.needsAttention" class="issue-warn attention">{{ row.validation.issues.find(issue => issue.severity === 'error')?.message }}</p></div>
          <div class="card-price"><strong>{{ formatBenefitCents(row.item.quote.amountCents) }}</strong><span>每包 · 人民币 CNY</span></div>
          <div class="card-actions"><el-button @click="edit(row.item.id)">{{ store.isAdmin ? '打开权益包' : '查看权益包' }}</el-button><el-button v-if="store.isAdmin" @click="copy(row.item.id)" :data-copy-benefit-package="row.item.id">复制组包</el-button><el-button v-if="store.isAdmin" link @click="favorite(row.item.id)">{{ row.item.favorite ? '取消常用' : '设为常用' }}</el-button><el-button v-if="store.isAdmin" link :type="row.item.status === 'disabled' ? 'primary' : 'danger'" @click="setStatus(row.item.id)">{{ row.item.status === 'disabled' ? '启用' : '停用' }}</el-button></div>
        </article>
      </template>
      <template v-else><el-empty v-if="!deliveries.length" description="还没有匹配的交付清单。先保存权益包，再明确发起一次清单生成。" /><article v-for="item in deliveries" :key="item.id" class="package-card" :data-benefit-delivery="item.id"><div class="card-main"><h2>{{ item.packageName }}</h2><p class="muted">{{ item.code }} · 来源 {{ item.packageCode }} / 修订 {{ item.sourceRevision }}</p><p class="device-line">{{ item.packageCount }} 包 · {{ item.generatedAt }}</p></div><div class="card-price"><strong>{{ formatBenefitCents(item.quote.totalCents) }}</strong><span>本次总报价</span></div><el-button @click="router.push(`/benefit-packages/deliveries/${encodeURIComponent(item.id)}`)">查看清单</el-button></article></template>
    </section>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import PageHead from '../components/PageHead.vue'
import { useCatalogStore } from '../stores/catalog'
import { validateBenefitPackage } from '../domain/benefitPackages'
import { formatBenefitCents, packageStatusLabels } from '../components/benefit-package/benefitPackagePresentation'
const store = useCatalogStore(), router = useRouter()
const tab = ref('packages'), keyword = ref(''), status = ref(''), favoritesOnly = ref(false), error = ref('')
const rows = computed(() => (store.data.benefitPackages || []).map(item => { const validation = validateBenefitPackage(store.data, item); return { item, validation, needsAttention: item.status !== 'disabled' && !validation.canSaveAvailable } }).filter(row => {
  const text = keyword.value.trim().toLocaleLowerCase()
  return (!text || `${row.item.name} ${row.item.code}`.toLocaleLowerCase().includes(text)) && (!favoritesOnly.value || row.item.favorite) && (!status.value || (status.value === 'issues' ? row.needsAttention : row.item.status === status.value))
}).sort((left, right) => Number(right.item.favorite) - Number(left.item.favorite)))
const deliveries = computed(() => (store.data.benefitDeliveries || []).filter(item => !keyword.value.trim() || `${item.packageName} ${item.packageCode} ${item.code}`.toLocaleLowerCase().includes(keyword.value.trim().toLocaleLowerCase())).slice().reverse())
function edit(id: string) { router.push(`/benefit-packages/${encodeURIComponent(id)}`) }
function copy(id: string) { router.push({ path: '/benefit-packages/new', query: { copy: id } }) }
function favorite(id: string) { const item = store.data.benefitPackages?.find(value => value.id === id); if (!store.isAdmin || !item) return; const result = store.setBenefitPackageFavorite(id, !item.favorite, item.revision); error.value = result.ok ? '' : result.message || '常用设置未保存，请重试。' }
async function setStatus(id: string) {
  const item = store.data.benefitPackages?.find(value => value.id === id)
  if (!store.isAdmin || !item) return
  if (item.status !== 'disabled') { try { await ElMessageBox.confirm(`停用「${item.name || item.code}」后不能生成新清单，历史清单继续保留。`, '停用权益包', { confirmButtonText: '确认停用', cancelButtonText: '取消' }) } catch { return } }
  const result = store.setBenefitPackageStatus(id, item.status === 'disabled' ? 'available' : 'disabled', item.revision)
  error.value = result.ok ? '' : result.message || '状态未保存，请重试。'
}
</script>
<style scoped>
.page-error { margin-bottom:14px; }.list-panel { min-height:300px; }.list-tools { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin:8px 0 16px; }.list-tools>.el-input { width:320px; }.list-tools>.el-select { width:150px; }.list-count { color:var(--text-secondary); font-size:13px; margin-bottom:12px; }.package-card { display:flex; align-items:center; gap:24px; padding:20px 0; border-top:1px solid var(--border-default); }.card-main { flex:1; min-width:0; }.card-heading { display:flex; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px; }.card-main h2 { margin:0; font-size:16px; overflow-wrap:anywhere; }.card-heading .linkish { font-weight:650; text-align:left; }.device-line { font-size:13px; margin-top:8px; line-height:1.7; }.attention { font-size:12px; margin-top:8px; line-height:1.7; }.card-price { display:flex; flex-direction:column; gap:6px; text-align:right; flex-shrink:0; }.card-price strong { font-size:17px; }.card-price span { font-size:12px; color:var(--text-secondary); }.card-actions { display:flex; align-items:center; gap:8px; flex-wrap:wrap; max-width:300px; }.card-actions>.el-button { margin-left:0; }
@media(max-width:1000px) { .package-card { flex-wrap:wrap; gap:16px; }.card-actions { width:100%; max-width:none; } }
@media(max-width:700px) { .list-tools>.el-input { width:100%; }.card-price { text-align:left; }.package-card { align-items:flex-start; }.card-main { flex-basis:100%; } }
</style>
