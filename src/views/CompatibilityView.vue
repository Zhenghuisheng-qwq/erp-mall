<template>
  <div>
    <el-tabs v-model="tab" class="compatibility-tabs"><el-tab-pane label="兼容关系工作台" name="workbench" /><el-tab-pane label="原物料适用关系" name="legacy" /></el-tabs>
    <template v-if="tab === 'workbench'">
      <PageHead title="适用关系" desc="按明确设备型号维护销售配件和物料声明。查看与维护分离，兼容事实和在售状态分别保留。"><el-button @click="router.push('/skus')">返回 SKU 管理</el-button></PageHead>
      <section class="panel"><CompatibilityManager :target="initialTarget" :device-sku-id="deviceSkuId" /></section>
    </template>
    <LegacyMaterialCompatibility v-else />
    <DeviceBindingDialog v-model="bindingOpen" :sku-id="deviceSkuId" />
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHead from '../components/PageHead.vue'
import CompatibilityManager from '../components/compatibility/CompatibilityManager.vue'
import LegacyMaterialCompatibility from '../components/compatibility/LegacyMaterialCompatibility.vue'
import DeviceBindingDialog from '../components/compatibility/DeviceBindingDialog.vue'
import { useCatalogStore } from '../stores/catalog'
import { isMaterialArchive } from '../domain/catalogIdentity'
import type { AccessoryTarget } from '../domain/accessoryCompatibilityTypes'

const store = useCatalogStore(), route = useRoute(), router = useRouter()
const tab = ref('workbench'), bindingOpen = ref(false)
const routeSku = computed(() => store.data.skus.find(item => item.id === String(route.query.manage || route.query.sku || '')))
const initialTarget = computed<AccessoryTarget | undefined>(() => routeSku.value ? { kind: isMaterialArchive(store.data, routeSku.value) ? 'material' : 'sku', id: routeSku.value.id } : undefined)
const deviceSkuId = computed(() => typeof route.query.device === 'string' ? route.query.device : '')
watch(() => [route.query.sku, route.query.model, route.query.legacy, route.query.device] as const, () => {
  tab.value = route.query.legacy || route.query.model || (route.query.sku && routeSku.value && isMaterialArchive(store.data, routeSku.value)) ? 'legacy' : 'workbench'
  bindingOpen.value = Boolean(deviceSkuId.value && store.isAdmin)
}, { immediate: true })
</script>
<style scoped>
.compatibility-tabs { margin-bottom:8px; }
</style>
