<template>
  <el-drawer :model-value="modelValue" :title="accessoryMode ? '适用主机' : '适用配件'" size="min(760px, 100vw)" :close-on-click-modal="false" @update:model-value="emit('update:modelValue', $event)" @closed="returnFocus">
    <div class="accessory-drawer" data-accessory-drawer>
      <template v-if="familyId && !viewSkuId">
        <h2>{{ entryFamily?.name }}</h2><el-alert :title="familyChoiceMessage" type="info" :closable="false" />
      </template>
      <div v-if="familyId || !accessoryMode" class="device-choice">
        <label for="compatibility-device-choice">{{ familyId ? '查看具体 SKU' : '当前查看设备' }}</label>
        <el-select id="compatibility-device-choice" :model-value="viewSkuId" filterable placeholder="先选择一条具体 SKU" style="width:100%" data-device-choice @change="chooseSku(String($event))"><el-option v-for="item in chooserSkus" :key="item.id" :value="item.id" :label="`${item.code} · ${item.skuName || item.id}`" /></el-select>
      </div>
      <template v-if="viewSku">
        <div class="device-summary"><div><el-tag size="small">{{ isMaterialArchive(store.data, viewSku) ? 'MAT' : 'SKU' }}</el-tag><h2>{{ viewSku.skuName || viewFamily?.name || '未命名记录' }}</h2><p class="muted">{{ viewSku.materialCode || viewSku.code }} · {{ recordSpec(store.data, viewSku) }}</p></div><el-button v-if="viewSkuId !== entrySkuId && entrySkuId" link @click="chooseSku(entrySkuId)">返回原查看对象</el-button></div>
        <template v-if="!accessoryMode">
          <el-button v-if="store.can('product:benefit:create') && isRealSku(store.data, viewSku)" type="primary" plain data-compose-from-compatibility @click="composePackage">组权益包</el-button>
          <div class="device-state" :data-device-status="forward.device.status">
            <el-tag :type="forward.device.status === 'resolved' ? 'success' : 'warning'">{{ deviceStatusLabels[forward.device.status] }}</el-tag>
            <strong v-if="forward.device.host">{{ hostText(forward.device.host) }}</strong><p>{{ forward.device.message }}</p><p class="muted">型号来源：{{ forward.device.source || '未记录' }}<template v-if="forward.device.planningId"> · 当前规格 {{ forward.device.planningId }}</template></p>
            <el-button v-if="store.can('product:compatibility:update')" link type="primary" @click="bindingOpen = true">{{ forward.device.status === 'resolved' ? '查看或重新绑定型号' : '配置设备型号' }}</el-button><p v-else-if="forward.device.status !== 'resolved'" class="muted">请联系管理员配置型号。</p>
          </div>
          <template v-if="forward.device.status === 'resolved'">
            <div class="query-tools"><el-input v-model="keyword" clearable placeholder="搜索配件名称、编号或规格" aria-label="搜索适用配件" /><el-select v-model="typeId" clearable placeholder="全部配件类型" aria-label="配件产品类型" data-accessory-type-filter><el-option v-for="item in accessoryTypes" :key="item.id" :value="item.id" :label="item.name" /></el-select></div>
            <el-alert v-if="forward.materials.length && !hasSalesDeclarations && !keyword && !typeId" title="当前设备仅有适用物料，尚无匹配的销售 SKU 声明。不会自动把同 SPU 或同 PLN 的记录作为销售配件。" type="info" :closable="false" data-material-only><template #default><el-button v-if="store.can('product:compatibility:update')" link type="primary" @click="managerOpen = true">选择销售 SKU 并复制或直接维护</el-button></template></el-alert>
            <el-tabs v-model="section" class="result-tabs">
              <el-tab-pane :label="`销售配件 ${forward.counts.sales}`" name="sales" />
              <el-tab-pane :label="`适用物料 ${forward.counts.materials}`" name="materials" />
              <el-tab-pane :label="`待处理 ${forward.counts.pending + forward.issues.length}`" name="pending" />
              <el-tab-pane :label="`不兼容 ${forward.counts.excluded}`" name="excluded" />
              <el-tab-pane :label="`非在售 ${forward.counts.unavailable}`" name="unavailable" />
            </el-tabs>
            <p class="muted" data-accessory-count>{{ currentMatches.length }} 个{{ section === 'materials' ? '物料' : '配件对象' }} · 当前匹配 {{ forward.counts.declarations }} 条声明；基本使用与快充结论分别列示。</p>
            <div v-if="section === 'pending' && forward.issues.length" class="issues"><p v-for="(issue, index) in forward.issues" :key="`${issue.declarationId}-${index}`">{{ issue.message }}<span v-if="issue.declarationId"> · {{ issue.declarationId }}</span></p><el-button v-if="store.can('product:compatibility:update')" link type="primary" @click="managerOpen = true">处理失效声明</el-button></div>
            <el-empty v-if="!currentMatches.length" :description="emptyMessage" />
            <section v-for="group in groupedMatches" :key="group.id" class="accessory-group"><h3>{{ group.name }} <span>{{ group.items.length }}</span></h3>
              <article v-for="item in group.items" :key="`${item.target.kind}:${item.target.id}`" class="accessory-card" :data-accessory-match="item.target.id" :data-target-kind="item.target.kind">
                <div class="match-head"><div><el-tag size="small" effect="plain">{{ item.target.kind === 'sku' ? '销售 SKU' : 'MAT 物料' }}</el-tag><strong>{{ item.name }}</strong><p class="muted">{{ item.code }} · {{ item.spec || '未记录规格' }}</p></div><div class="match-status"><el-tag :type="statusType(item.target.kind === 'sku' ? item.basic.status : item.status)">{{ compatibilityUseLabel(accessoryUseEvaluation(item)) }}</el-tag><small v-if="item.target.kind === 'sku' && item.status !== item.basic.status" class="muted">能力资料汇总：{{ statusLabels[item.status] }}</small></div></div>
                <p v-for="(reason, index) in item.reasons" :key="index" class="reason">{{ reason }}</p>
                <el-alert v-if="accessoryUseEvaluation(item).conflict" title="基本使用存在相反声明，请维护人员核对。" type="warning" :closable="false" />
                <div v-for="cap in item.capabilities" :key="cap.capability" class="capability-line"><strong>{{ capabilityLabels[cap.capability] }}</strong><span>{{ statusLabels[cap.status] }}</span><span v-if="cap.conflict" class="warn"> · 存在冲突</span><ul v-if="cap.conditions.length"><li v-for="(evaluation, index) in cap.conditions" :key="index"><el-tag size="small" :type="evaluation.state === 'met' ? 'success' : evaluation.state === 'unmet' ? 'danger' : 'warning'">{{ conditionStatus[evaluation.state] }}</el-tag> {{ evaluation.label }}</li></ul></div>
                <details class="evidence"><summary>查看 {{ item.declarations.length }} 条匹配依据与范围</summary><div v-for="link in item.declarations" :key="link.id" class="evidence-row"><p>{{ scopeText(link.host) }} · {{ capabilityLabels[declarationDefaults(link).capability] }} · {{ verificationLabels[declarationDefaults(link).verification] }}{{ conclusionLabels[declarationDefaults(link).conclusion] }}</p><p>来源：{{ declarationDefaults(link).source }}</p><TemplateCompatibilitySource :link="link" /><p v-if="declarationDefaults(link).provenance.kind === 'material-copy'">确认复制自物料 {{ declarationDefaults(link).provenance.materialSnapshot?.code }} · {{ declarationDefaults(link).provenance.materialSnapshot?.name }}；原声明 {{ declarationDefaults(link).provenance.declarationId }} 的历史快照保留。</p><p v-if="link.note">备注：{{ link.note }}</p><p class="muted">{{ link.id }} · 更新 {{ link.updatedAt || '未记录' }}</p></div></details>
                <div class="card-actions"><el-button link type="primary" @click="detailId = item.target.id">查看详情</el-button><el-button link type="primary" @click="chooseSku(item.target.id)">适用主机</el-button><el-button v-if="store.can('product:compatibility:read')" link @click="manageTarget = item.target; managerOpen = true">维护声明</el-button></div>
              </article>
            </section>
          </template>
        </template>
        <template v-else>
          <p class="muted">同一配件读取同一份正式声明反查。型号数量、具体 SKU 数量与声明条数分别统计。</p>
          <p data-reverse-count>{{ reverse.counts.models }} 个型号 · {{ reverse.counts.devices }} 条设备 SKU · {{ reverse.counts.declarations }} 条声明</p>
          <el-empty v-if="!reverse.hosts.length" description="尚无适用主机声明。可以选择已有型号维护；不要求主机已有 MAT 或在售 SKU。" />
          <article v-for="item in reverse.hosts" :key="item.key" class="accessory-card" :data-reverse-host="item.key">
            <div class="match-head"><strong>{{ item.label }}</strong><el-tag :type="statusType(reverseAccessoryUseEvaluation(item).status)">{{ reverseAccessoryUseEvaluation(item).hasSpecDifferences ? '包含规格例外，需逐项核对' : compatibilityUseLabel(reverseAccessoryUseEvaluation(item)) }}</el-tag></div>
            <p>{{ item.scopeSummary }}</p>
            <el-alert v-if="reverseAccessoryUseEvaluation(item).conflict" title="此型号的基本使用存在相反声明，需要核对。" type="warning" :closable="false" />
            <div v-for="cap in item.capabilities" :key="cap.capability" class="capability-line"><strong>{{ capabilityLabels[cap.capability] }}</strong><span>{{ statusLabels[cap.status] }}</span><span v-if="cap.conflict" class="warn"> · 存在冲突</span></div>
            <div v-for="link in item.declarations" :key="link.id" class="evidence-row"><p>{{ scopeText(link.host) }} · {{ capabilityLabels[declarationDefaults(link).capability] }} · {{ verificationLabels[declarationDefaults(link).verification] }}{{ conclusionLabels[declarationDefaults(link).conclusion] }}</p><p class="muted">来源：{{ declarationDefaults(link).source }}</p><TemplateCompatibilitySource :link="link" /><ul><li v-for="(condition, index) in declarationDefaults(link).conditions" :key="index">{{ conditionText(store.data, condition) }} · 具体前提请结合设备核验</li></ul></div>
            <div class="reverse-devices"><p v-if="!item.devices.length" class="muted">该型号尚无可查看的具体销售 SKU；型号声明仍保留。</p><el-button v-for="device in item.devices" :key="device.skuId" @click="chooseSku(device.skuId)">{{ device.code }} · {{ device.name }} · {{ compatibilityUseLabel(accessoryUseEvaluation(device)) }}</el-button></div>
          </article>
          <el-alert v-for="(issue, index) in reverse.issues" :key="index" :title="issue.message" type="warning" :closable="false" />
        </template>
        <div class="drawer-maintenance"><el-button v-if="store.can('product:compatibility:read')" @click="manageTarget = undefined; managerOpen = true">管理适用关系</el-button><el-button v-if="accessoryMode" data-check-template-updates @click="syncOpen = true">检查模板更新</el-button><span v-if="!store.can('product:compatibility:update')" class="muted">当前角色只读，维护请联系管理员。</span></div>
      </template>
      <el-empty v-else-if="!familyId" description="该对象不存在或引用已经失效，请返回列表重新选择。" />
    </div>
    <DeviceBindingDialog v-model="bindingOpen" :sku-id="viewSkuId" />
    <TemplateCompatibilitySyncDialog v-model="syncOpen" :target="target" />
    <el-dialog v-model="managerOpen" title="管理适用关系" width="min(1100px, 96vw)" :close-on-click-modal="false" destroy-on-close append-to-body><CompatibilityManager :target="managerTarget" :host="managerHost" :device-sku-id="!accessoryMode ? viewSkuId : undefined" /></el-dialog>
    <el-dialog :model-value="!!detailId" title="配件详情" width="min(600px, 94vw)" append-to-body @update:model-value="(value: boolean) => { if (!value) detailId = '' }"><template v-if="detail"><el-tag>{{ isMaterialArchive(store.data, detail) ? 'MAT 物料' : '销售 SKU' }}</el-tag><h3>{{ detail.skuName || '未命名' }}</h3><p>{{ detail.materialCode || detail.code }}</p><p>{{ recordSpec(store.data, detail) }}</p><p>当前状态：{{ {on_sale:'在售',off_sale:'停售',draft:'草稿'}[detail.status] }}</p><p v-if="detail.materialDescription">{{ detail.materialDescription }}</p><el-button @click="chooseSku(detail.id); detailId = ''">查看适用主机</el-button></template></el-dialog>
  </el-drawer>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCatalogStore } from '../../stores/catalog'
import { roleOfType } from '../../domain/compatibility'
import { isMaterialArchive, isRealSku } from '../../domain/catalogIdentity'
import { compatibilityRecordRole, resolveDeviceSku } from '../../domain/deviceResolution'
import { declarationDefaults, queryAccessoryDevices, queryDeviceAccessories, accessoryUseEvaluation, reverseAccessoryUseEvaluation } from '../../domain/accessoryCompatibilityQuery'
import type { AccessoryMatch, AccessoryTarget } from '../../domain/accessoryCompatibilityTypes'
import { capabilityLabels, conclusionLabels, verificationLabels, hostKey, hostText, scopeText, conditionText, recordSpec, compatibilityUseLabel } from './compatibilityPresentation'
import DeviceBindingDialog from './DeviceBindingDialog.vue'
import CompatibilityManager from './CompatibilityManager.vue'
import TemplateCompatibilitySource from '../template-compatibility/TemplateCompatibilitySource.vue'
import TemplateCompatibilitySyncDialog from '../template-compatibility/TemplateCompatibilitySyncDialog.vue'

const props = defineProps<{ modelValue: boolean; skuId?: string; familyId?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; 'prepare-benefit-package': [skuId: string] }>()
const store = useCatalogStore()
const router = useRouter(), route = useRoute()
const viewSkuId = ref(''), keyword = ref(''), typeId = ref('')
const section = ref<'sales' | 'materials' | 'pending' | 'excluded' | 'unavailable'>('sales')
const bindingOpen = ref(false), managerOpen = ref(false), detailId = ref(''), manageTarget = ref<AccessoryTarget>()
const syncOpen = ref(false)
let opener: HTMLElement | null = null
const entryFamily = computed(() => store.data.families.find(item => item.id === props.familyId))
const familySkus = computed(() => store.data.skus.filter(item => item.familyId === props.familyId && isRealSku(store.data, item)))
const deviceSkus = computed(() => store.data.skus.filter(item => isRealSku(store.data, item) && compatibilityRecordRole(store.data, item.id) === 'host'))
const chooserSkus = computed(() => props.familyId ? familySkus.value : deviceSkus.value)
const viewSku = computed(() => store.data.skus.find(item => item.id === viewSkuId.value))
const viewFamily = computed(() => store.data.families.find(item => item.id === viewSku.value?.familyId))
const accessoryMode = computed(() => compatibilityRecordRole(store.data, viewSkuId.value) === 'accessory')
const entrySkuId = computed(() => props.skuId || '')
const forward = computed(() => queryDeviceAccessories(store.data, viewSkuId.value))
const target = computed<AccessoryTarget>(() => ({ kind: viewSku.value && isMaterialArchive(store.data, viewSku.value) ? 'material' : 'sku', id: viewSkuId.value }))
const reverse = computed(() => queryAccessoryDevices(store.data, target.value))
const hasSalesDeclarations = computed(() => [...forward.value.sales, ...forward.value.pending, ...forward.value.excluded, ...forward.value.unavailable].some(item => item.target.kind === 'sku'))
const accessoryTypes = computed(() => store.data.productTypes.filter(item => roleOfType(store.data, item.id) === 'accessory'))
const currentMatches = computed(() => ({ sales: forward.value.sales, materials: forward.value.materials, pending: forward.value.pending, excluded: forward.value.excluded, unavailable: forward.value.unavailable })[section.value].filter(item=>(!typeId.value||item.productTypeId===typeId.value)&&(!keyword.value.trim()||`${item.name} ${item.code} ${item.spec}`.toLocaleLowerCase().includes(keyword.value.trim().toLocaleLowerCase()))) || [])
const groupedMatches = computed(() => {
  const groups = new Map<string, { id: string; name: string; items: AccessoryMatch[] }>()
  for (const item of currentMatches.value) { const group = groups.get(item.productTypeId) || { id: item.productTypeId, name: item.productTypeName || '未分类配件', items: [] }; group.items.push(item); groups.set(item.productTypeId, group) }
  return [...groups.values()]
})
const managerTarget = computed(() => manageTarget.value || (accessoryMode.value ? target.value : undefined))
const managerHost = computed(() => managerTarget.value ? undefined : forward.value.device.host)
const detail = computed(() => store.data.skus.find(item => item.id === detailId.value))
const familyChoiceMessage = computed(() => {
  const resolved = familySkus.value.map(item => resolveDeviceSku(store.data, item.id)).filter(item => item.status === 'resolved' && item.host)
  return new Set(resolved.map(item => item.host ? hostKey(item.host) : '')).size > 1 ? '此 SPU 包含多个设备型号，请先选择具体 SKU；不会把配件合集当作每条 SKU 均适用。' : '请先选择具体 SKU，确认其设备型号及适用范围。'
})
const emptyMessage = computed(() => keyword.value ? '搜索无结果，请调整关键词。' : typeId.value ? '当前配件类型没有结果，可切换其他类型。' : section.value === 'materials' ? '尚无适用物料声明。' : section.value === 'pending' ? '没有待确认声明或待处理配置。' : section.value === 'excluded' ? '当前范围没有明确不兼容声明；未声明不代表兼容。' : section.value === 'unavailable' ? '当前没有非在售的匹配配件。' : '当前没有可推荐的销售配件，可以查看其他状态或维护声明。')
const deviceStatusLabels = { resolved: '已确认设备型号', unconfigured: '尚未确认设备型号', ambiguous: '存在多个可能型号', invalid: '来源或引用失效' }
const statusLabels = { compatible: '已确认适用', conditional: '需核对条件', incompatible: '明确不适用', pending: '依据待确认' }
const conditionStatus = { met: '已满足', unmet: '不满足', unknown: '仍需确认' }
function statusType(status: AccessoryMatch['status']) { return status === 'compatible' ? 'success' : status === 'incompatible' ? 'danger' : 'warning' }
function chooseSku(id: string) { viewSkuId.value = id; keyword.value = ''; typeId.value = ''; section.value = 'sales'; manageTarget.value = undefined; detailId.value = ''; syncOpen.value = false }
function composePackage() {
  if (!store.can('product:benefit:create') || !viewSku.value || !isRealSku(store.data, viewSku.value)) return
  emit('prepare-benefit-package', viewSkuId.value)
  void router.push({ path: '/benefit-packages/new', query: { device: viewSkuId.value, returnTo: route.fullPath } })
}
watch(() => [props.modelValue, props.skuId, props.familyId] as const, ([open], old) => {
  if (!open) { managerOpen.value = false; bindingOpen.value = false; syncOpen.value = false; detailId.value = ''; return }
  if (!old?.[0] && typeof document !== 'undefined') opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
  if (props.skuId) chooseSku(props.skuId)
  else if (familySkus.value.length === 1) chooseSku(familySkus.value[0]?.id || '')
  else {
    const resolved = familySkus.value.map(item => ({ id: item.id, result: resolveDeviceSku(store.data, item.id) })).filter(item => item.result.status === 'resolved' && item.result.host)
    const identities = new Set(resolved.map(item => item.result.host ? hostKey(item.result.host) : ''))
    chooseSku(identities.size === 1 ? resolved[0]?.id || '' : '')
  }
}, { immediate: true })
async function returnFocus() { await nextTick(); if (opener?.isConnected) opener.focus() }
</script>
<style scoped>
.match-status { display:grid; gap:6px; justify-items:end; flex-shrink:0; }
.accessory-drawer { padding-bottom:20px; }.device-choice { margin-bottom:20px; }.device-choice label { display:block; margin-bottom:8px; font-size:13px; color:var(--el-text-color-secondary); }.device-summary,.match-head { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }.device-summary h2 { font-size:20px; margin:10px 0; }.muted { color:var(--el-text-color-secondary); line-height:1.7; }.device-state { padding:16px; border:1px solid var(--el-border-color-lighter); border-radius:12px; background:var(--el-fill-color-extra-light); margin:16px 0; }.device-state>strong { display:block; margin-top:12px; }.device-state p { line-height:1.7; }.query-tools { display:flex; gap:10px; margin:20px 0; }.query-tools .el-select { width:190px; flex-shrink:0; }.accessory-group h3 { font-size:15px; margin:22px 0 12px; }.accessory-group h3 span { color:var(--el-text-color-secondary); margin-left:6px; font-weight:normal; }.accessory-card { border:1px solid var(--el-border-color-lighter); border-radius:12px; padding:16px; margin-bottom:12px; }.match-head strong { display:block; margin-top:10px; font-size:15px; }.match-head .muted { font-size:12px; margin-bottom:0; }.reason { margin:10px 0; line-height:1.6; }.capability-line { padding:10px 0; border-top:1px solid var(--el-border-color-extra-light); }.capability-line>span { margin-left:12px; }.capability-line li { margin:8px 0; line-height:1.7; }.capability-line ul,.evidence-row ul { padding-left:20px; }.evidence { font-size:13px; line-height:1.7; }.evidence summary { color:var(--el-color-primary); cursor:pointer; padding:8px 0; }.evidence-row { padding:8px 0; border-top:1px solid var(--el-border-color-extra-light); }.evidence-row p { margin:7px 0; overflow-wrap:anywhere; }.card-actions { display:flex; gap:12px; margin-top:10px; flex-wrap:wrap; }.drawer-maintenance { padding-top:20px; margin-top:12px; border-top:1px solid var(--el-border-color-lighter); }.reverse-devices { display:flex; flex-wrap:wrap; gap:8px; padding-top:12px; }.reverse-devices>.el-button { margin-left:0; }.issues { border-radius:8px; padding:12px; background:var(--el-color-warning-light-9); color:var(--el-text-color-regular); font-size:13px; }
@media(max-width:620px) { .query-tools { flex-direction:column; }.query-tools .el-select { width:100%; }.match-head { flex-wrap:wrap; }.match-head>.el-tag { margin-top:10px; }.accessory-card { padding:12px; }.device-summary { flex-wrap:wrap; } }
</style>
