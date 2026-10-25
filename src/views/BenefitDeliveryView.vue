<template>
  <div class="benefit-delivery-page" data-benefit-delivery-detail>
    <PageHead title="交付清单" desc="已确认的商品、服务、报价与适配约定，按生成时的内容独立保存。"><el-button @click="router.push('/benefit-packages')">返回权益包</el-button><el-button v-if="delivery && sourceExists" @click="router.push({ path: `/benefit-packages/${encodeURIComponent(delivery.packageId)}`, query: returnQuery })">查看当前包配置</el-button><el-button v-if="route.query.returnTo" @click="router.push(safeBenefitReturn(router, route.query.returnTo))">返回原页面</el-button><el-button v-if="delivery" @click="print" data-benefit-print>打印清单</el-button><el-button v-if="delivery" type="primary" @click="download" data-benefit-export :disabled="!(store.can('product:delivery:export'))">导出 Excel</el-button></PageHead>
    <el-alert v-if="error" :title="error" type="error" :closable="false" class="export-error" data-benefit-export-error />
    <BenefitDeliverySheet v-if="delivery" :delivery="delivery" />
    <el-empty v-else description="交付清单不存在，请返回权益包查看已保存清单。" />
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { safeBenefitReturn } from '../components/benefit-package/benefitNavigation'
import PageHead from '../components/PageHead.vue'
import BenefitDeliverySheet from '../components/benefit-package/BenefitDeliverySheet.vue'
import { useCatalogStore } from '../stores/catalog'
import { downloadBenefitDelivery } from '../domain/benefitPackageExport'
const store = useCatalogStore(), route = useRoute(), router = useRouter(), error = ref('')
const delivery = computed(() => store.data.benefitDeliveries?.find(item => item.id === route.params.id))
const returnQuery = computed(() => route.query.returnTo ? { returnTo: safeBenefitReturn(router, route.query.returnTo) } : {})
const sourceExists = computed(() => store.data.benefitPackages?.some(item => item.id === delivery.value?.packageId))
function print() { try { window.print(); error.value = '' } catch (problem) { error.value = `打印未能打开：${problem instanceof Error ? problem.message : String(problem)}。清单已保存，可再次打印。` } }
function download() { if (!store.can('product:delivery:export')) { error.value = '没有导出交付清单的权限。'; return }; if (!delivery.value) return; try { downloadBenefitDelivery(delivery.value); error.value = '' } catch (problem) { error.value = `Excel 导出失败：${problem instanceof Error ? problem.message : String(problem)}。清单仍已保存，可直接重试导出。` } }
</script>
<style scoped>
.export-error { margin-bottom:16px; }
</style>
<style>
@media print {
  @page { size:A4; margin:14mm; }
  html:has(.benefit-delivery-page),body:has(.benefit-delivery-page),body:has(.benefit-delivery-page) #app { height:auto !important; overflow:visible !important; background:#fff !important; }
  body:has(.benefit-delivery-page) .layout,body:has(.benefit-delivery-page) .layout>.main { display:block !important; height:auto !important; overflow:visible !important; }
  body:has(.benefit-delivery-page) .layout>.main>.topbar,body:has(.benefit-delivery-page) .layout>.main>.demo-strip,body:has(.benefit-delivery-page) .layout>.rail-wrap { display:none !important; }
  body:has(.benefit-delivery-page) .content { overflow:visible !important; padding:0 !important; height:auto !important; }
  .benefit-delivery-page>.page-head,.benefit-delivery-page>.export-error { display:none !important; }
  body:has(.benefit-delivery-page) .el-overlay,body:has(.benefit-delivery-page) .el-message,body:has(.benefit-delivery-page) .el-popper { display:none !important; }
}
</style>
