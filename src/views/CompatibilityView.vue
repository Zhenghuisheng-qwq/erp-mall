<template>
  <div>
    <PageHead :title="compatibilityPageTitle(tab)"><el-button data-compatibility-return @click="router.push(returnPath)">{{returnLabel}}</el-button></PageHead>
    <el-tabs :model-value="tab" class="compatibility-tabs" @tab-change="switchTab"><el-tab-pane label="兼容性查询" name="results" /><el-tab-pane label="兼容性维护" name="workbench" /><el-tab-pane label="商品适用范围" name="ranges" /><el-tab-pane label="原物料兼容性（高级）" name="legacy" /></el-tabs>
    <el-alert v-if="contextError" :title="contextError" type="error" :closable="false" data-compatibility-context-error/>
    <section v-else-if="tab==='results'" class="panel"><CompatibilityResults :target="initialTarget" :host="initialHost" :device-sku-id="deviceSkuId" @maintain="openMaintenance" @bind="bindingSkuId=$event;bindingOpen=true" /></section>
    <section v-if="!contextError&&tab==='workbench'" class="panel"><CompatibilityManager ref="manager" :active="tab==='workbench'" @navigate="switchTab" :target="maintenanceTarget" :host="maintenanceHost" :device-sku-id="deviceSkuId" /></section>
    <section v-if="!contextError&&tab==='ranges'" class="panel"><GeneralCompatibilityPanel :sku-ids="rangeTargets" :device-sku-id="deviceSkuId" :model-key="typeof route.query.deviceModel==='string'?route.query.deviceModel:undefined" @navigate="switchTab"/></section>
    <LegacyMaterialCompatibility v-if="!contextError&&tab==='legacy'" />
    <DeviceBindingDialog v-model="bindingOpen" :sku-id="bindingSkuId || deviceSkuId" />
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GeneralCompatibilityPanel from '../components/compatibility/GeneralCompatibilityPanel.vue'
import PageHead from '../components/PageHead.vue'
import CompatibilityResults from '../components/compatibility/CompatibilityResults.vue'
import CompatibilityManager from '../components/compatibility/CompatibilityManager.vue'
import LegacyMaterialCompatibility from '../components/compatibility/LegacyMaterialCompatibility.vue'
import DeviceBindingDialog from '../components/compatibility/DeviceBindingDialog.vue'
import { useCatalogStore } from '../stores/catalog'
import { isMaterialArchive } from '../domain/catalogIdentity'
import { deviceHostKey, listDeviceModels } from '../domain/deviceResolution'
import {compatibilityPageTitle,compatibilityReturnLocation,isCompatibilityTab} from '../domain/compatibilityNavigation'
import type { CompatibilityHost } from '../domain/types'
import type { AccessoryTarget } from '../domain/accessoryCompatibilityTypes'

const store = useCatalogStore(), route = useRoute(), router = useRouter()
const tab = ref('results'), bindingOpen = ref(false),bindingSkuId=ref('')
const maintenanceTarget=ref<AccessoryTarget>(),maintenanceHost=ref<CompatibilityHost>()
const manager=ref<InstanceType<typeof CompatibilityManager>>()
async function switchTab(value:string|number){if(!isCompatibilityTab(value)||value===tab.value)return;if(manager.value&&!await manager.value.canDiscard())return;manager.value?.acceptContextChange();await router.push({path:'/compatibility',query:{...route.query,tab:value}})}
async function openMaintenance(target?:AccessoryTarget,host?:CompatibilityHost){if(manager.value&&!await manager.value.canDiscard())return;manager.value?.acceptContextChange();await router.push({path:'/compatibility',query:{...route.query,tab:'workbench',targetId:target?.id||undefined,deviceModel:host?deviceHostKey(host):route.query.deviceModel}})}
const routeSku = computed(() => store.data.skus.find(item => item.id === String(route.query.targetId || route.query.manage || route.query.sku || '')))
const initialTarget = computed<AccessoryTarget | undefined>(() => routeSku.value ? { kind: isMaterialArchive(store.data, routeSku.value) ? 'material' : 'sku', id: routeSku.value.id } : undefined)
const deviceSkuId = computed(() => typeof route.query.device === 'string' ? route.query.device : '')
const initialHost=computed(()=>typeof route.query.deviceModel==='string'?listDeviceModels(store.data).find(item=>item.key===route.query.deviceModel)?.host:undefined)
const rangeTargets=computed(()=>{if(typeof route.query.targets==='string'){try{const ids=JSON.parse(route.query.targets);if(Array.isArray(ids)&&ids.every(id=>typeof id==='string'))return ids as string[]}catch{return []}}return initialTarget.value?.kind==='sku'?[initialTarget.value.id]:[]})
const returnPath = computed(() => compatibilityReturnLocation(route.query.returnTo)||'/skus')
const returnLabel=computed(()=>returnPath.value.startsWith('/benefits/')?'返回权益包':returnPath.value.startsWith('/specs')?'返回商品模型':returnPath.value.startsWith('/catalog')?'返回商品资料管理':'返回商品管理')
const contextError=computed(()=>route.query.tab!==undefined&&!isCompatibilityTab(route.query.tab)?'兼容性页签无效，请选择兼容性查询或维护。':(route.query.targetId||route.query.manage||route.query.sku)&&!routeSku.value?'指定商品已失效，未退回全部商品。':route.query.deviceModel&&!initialHost.value?'指定设备型号已失效，未使用其他型号代替。':route.query.device&&!store.data.skus.some(item=>item.id===deviceSkuId.value)?'指定使用设备已失效，请返回配置核对。':'')
watch(() => [route.query.tab,route.query.targetId, route.query.manage, route.query.sku, route.query.model, route.query.legacy, route.query.device, route.query.deviceModel] as const, () => {
  tab.value = isCompatibilityTab(route.query.tab)?route.query.tab:route.query.legacy || route.query.model || (route.query.sku && routeSku.value && isMaterialArchive(store.data, routeSku.value)) ? 'legacy' : route.query.manage ? 'workbench' : 'results'
  maintenanceTarget.value=initialTarget.value;maintenanceHost.value=initialHost.value
  bindingOpen.value=false
  if(route.query.tab===undefined)void router.replace({path:'/compatibility',query:{...route.query,tab:tab.value}})
}, { immediate: true })
</script>
<style scoped>
.compatibility-tabs { margin-bottom:8px; }
</style>
