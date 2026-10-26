<template>
  <div>
    <PageHead title="适用关系"><el-button data-compatibility-return @click="router.push(returnPath)">{{ returnPath.startsWith('/benefit-packages') ? '返回销售方案' : returnPath.startsWith('/sales-shopping') ? '返回销售选购' : '返回 SKU 管理' }}</el-button></PageHead>
    <el-tabs v-model="tab" class="compatibility-tabs"><el-tab-pane label="查看结果" name="results" /><el-tab-pane label="声明与型号维护" name="workbench" /><el-tab-pane label="原物料适用关系" name="legacy" /></el-tabs>
    <section v-show="tab==='results'" class="panel"><CompatibilityResults :target="initialTarget" :host="initialHost" :device-sku-id="deviceSkuId" @maintain="openMaintenance" @bind="bindingSkuId=$event;bindingOpen=true" /></section>
    <section v-show="tab==='workbench'" class="panel"><CompatibilityManager ref="manager" :active="tab==='workbench'" @navigate="tab=$event" :target="maintenanceTarget" :host="maintenanceHost" :device-sku-id="deviceSkuId" /></section>
    <LegacyMaterialCompatibility v-if="tab==='legacy'" />
    <DeviceBindingDialog v-model="bindingOpen" :sku-id="bindingSkuId || deviceSkuId" />
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHead from '../components/PageHead.vue'
import CompatibilityResults from '../components/compatibility/CompatibilityResults.vue'
import CompatibilityManager from '../components/compatibility/CompatibilityManager.vue'
import LegacyMaterialCompatibility from '../components/compatibility/LegacyMaterialCompatibility.vue'
import DeviceBindingDialog from '../components/compatibility/DeviceBindingDialog.vue'
import { useCatalogStore } from '../stores/catalog'
import { isMaterialArchive } from '../domain/catalogIdentity'
import { listDeviceModels } from '../domain/deviceResolution'
import type { CompatibilityHost } from '../domain/types'
import type { AccessoryTarget } from '../domain/accessoryCompatibilityTypes'

const store = useCatalogStore(), route = useRoute(), router = useRouter()
const tab = ref('results'), bindingOpen = ref(false),bindingSkuId=ref('')
const maintenanceTarget=ref<AccessoryTarget>(),maintenanceHost=ref<CompatibilityHost>()
const manager=ref<InstanceType<typeof CompatibilityManager>>()
async function openMaintenance(target?:AccessoryTarget,host?:CompatibilityHost){if(JSON.stringify([target,host])!==JSON.stringify([maintenanceTarget.value,maintenanceHost.value])){if(!await manager.value?.canDiscard())return;manager.value?.acceptContextChange()}maintenanceTarget.value=target;maintenanceHost.value=host;tab.value='workbench'}
const routeSku = computed(() => store.data.skus.find(item => item.id === String(route.query.targetId || route.query.manage || route.query.sku || '')))
const initialTarget = computed<AccessoryTarget | undefined>(() => routeSku.value ? { kind: isMaterialArchive(store.data, routeSku.value) ? 'material' : 'sku', id: routeSku.value.id } : undefined)
const deviceSkuId = computed(() => typeof route.query.device === 'string' ? route.query.device : '')
const initialHost=computed(()=>typeof route.query.deviceModel==='string'?listDeviceModels(store.data).find(item=>item.key===route.query.deviceModel)?.host:undefined)
const returnPath = computed(() => { const path=typeof route.query.returnTo==='string'?route.query.returnTo:''; if(!path.startsWith('/')||path.startsWith('//')||/[\\\u0000-\u001f]/.test(path))return '/skus';const resolved=router.resolve(path);return resolved.matched.length && (resolved.path.startsWith('/benefit-packages')||resolved.path==='/sales-shopping'||resolved.path==='/skus')?resolved.fullPath:'/skus' })
watch(() => [route.query.targetId, route.query.manage, route.query.sku, route.query.model, route.query.legacy, route.query.device, route.query.deviceModel] as const, () => {
  tab.value = route.query.legacy || route.query.model || (route.query.sku && routeSku.value && isMaterialArchive(store.data, routeSku.value)) ? 'legacy' : route.query.manage ? 'workbench' : 'results'
  maintenanceTarget.value=initialTarget.value;maintenanceHost.value=initialHost.value
  bindingOpen.value=false
}, { immediate: true })
</script>
<style scoped>
.compatibility-tabs { margin-bottom:8px; }
</style>
