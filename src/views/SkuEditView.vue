<template>
  <div :inert="saving" :aria-busy="saving">
    <PageHead title="编辑 SKU" desc="只维护当前规格商品，不更换所属 SPU。"><el-button @click="back">返回 SKU 管理</el-button></PageHead>
    <el-empty v-if="!sku || !family || !draft" description="SKU 不存在或此记录属于物料，请从物料管理查看。" />
    <section v-else class="panel">
      <p>所属 SPU：<el-button link type="primary" @click="router.push(`/spus/${family.id}`)">{{ family.name }}</el-button></p>
      <p>来源：{{ sourceText }} · 绑定版本：{{ versionName }}</p>
      <el-button v-if="compatibilityRole !== 'other'" data-detail-compatibility @click="compatibilityOpen = true">{{ compatibilityRole === 'host' ? '适用配件' : '适用主机' }}</el-button>
      <el-button v-if="compatibilityRole==='host'&&store.canRoute({path:'/benefits/shopping'})" data-device-bundle @click="router.push({path:'/benefits/shopping',query:{device:`sku:${sku.id}`,returnTo:route.fullPath}})">用此设备选配</el-button>
      <el-button v-if="compatibilityRole==='accessory'&&store.can('product:compatibility:read')" data-sku-range @click="router.push({path:'/compatibility',query:{tab:'ranges',targetId:sku.id,returnTo:route.fullPath}})">适用设备 / 适用范围</el-button>
      <div style="max-width: 760px"><SkuFields :disabled="!(store.can('product:sku:update'))" v-model="draft" :family="family" :spec-locked="Boolean(sku.sourceNodeIds?.length || sku.planningId || sku.creationSource?.kind === 'plan')" /></div>
      <RuleExplanation v-if="guideFailure" :failure="guideFailure" :supported-recovery="['edit-input']" @recover="recoverGuide" />
      <p v-else-if="error" class="issue-error" role="alert">{{ error }}</p>
      <div class="row-actions"><el-button @click="back">取消</el-button><el-button type="primary" :loading="saving" @click="save" :disabled="!(store.can('product:sku:update'))">保存 SKU</el-button></div>
    </section>

    <AccessoryCompatibilityDrawer v-model="compatibilityOpen" :sku-id="sku?.id || ''" />
  </div>
</template>
<script setup lang="ts">
import RuleExplanation from '../components/guide/RuleExplanation.vue'
import { getFailure } from '../domain/guide/failure'
import type { GuideFailure } from '../domain/guide/types'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import PageHead from '../components/PageHead.vue'
import SkuFields from '../components/catalog/SkuFields.vue'
import AccessoryCompatibilityDrawer from '../components/compatibility/AccessoryCompatibilityDrawer.vue'
import { compatibilityRecordRole } from '../domain/deviceResolution'
import { useUnsavedCatalog } from '../components/catalog/useUnsavedCatalog'
import { isRealSku } from '../domain/catalogIdentity'
import type { SkuDraft } from '../domain/spuSku'
import { useCatalogStore } from '../stores/catalog'
const store = useCatalogStore()
const route = useRoute()
const router = useRouter()
const dirty = ref(false)
const error = ref('')
const guideFailure = ref<GuideFailure>()
watch(error, value => { if (!value) guideFailure.value=undefined })
const saving = ref(false)
const compatibilityOpen = ref(false)
const sku = computed(() => store.data.skus.find(item => item.id === route.params.id && isRealSku(store.data, item)))
const compatibilityRole = computed(() => compatibilityRecordRole(store.data, sku.value?.id || ''))
const family = computed(() => store.data.families.find(item => item.id === sku.value?.familyId))
const draft = ref<SkuDraft>()
watch(() => route.params.id, () => { draft.value = sku.value ? { code: sku.value.code, skuName: sku.value.skuName, oaSkuId: sku.value.oaSkuId, status: sku.value.status, variantAttrs: { ...sku.value.variantAttrs } } : undefined; dirty.value = false }, { immediate: true })
watch(draft, () => { dirty.value = true }, { deep: true, flush: 'sync' })
useUnsavedCatalog(dirty)
const sourceText = computed(() => {
  const source = sku.value?.creationSource
  if (source) return `${{ manual: '手工录入', template: '模板生成', model: '模型生成', plan: '规划生成' }[source.kind]}${source.productPlanId ? `：${source.planName || source.productPlanId}` : ''}`
  return family.value?.productPlanId ? `历史规划：${store.data.productPlans.find(item => item.id === family.value?.productPlanId)?.name || family.value.productPlanId}` : '历史记录未记录来源'
})
const versionName = computed(() => { const id = sku.value?.modelVersionId || family.value?.modelVersionId; return store.data.specModelVersions.find(item => item.id === id)?.versionName || id || '未记录' })
async function save() {
  if (saving.value || !sku.value || !draft.value) return
  saving.value = true
  const result = (await store.editSku(sku.value.id, draft.value))
  if (!result.ok) { guideFailure.value=getFailure(result); error.value = result.message; saving.value = false; return }
  dirty.value = false; ElMessage.success('SKU 已保存'); await back(); saving.value = false
}
function back() { return router.push({ path: '/skus', query: typeof route.query.spu === 'string' ? { spu: route.query.spu } : {} }) }
function recoverGuide(action:string) { if(action==='edit-input') requestAnimationFrame(()=>document.querySelector<HTMLInputElement>('.spu-form input, .el-dialog.is-in-viewport input, .el-dialog input, .panel input')?.focus()) }
</script>
