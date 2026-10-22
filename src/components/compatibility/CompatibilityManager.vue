<template>
  <section class="compatibility-manager" data-compatibility-manager>
    <div class="manager-head">
      <div><h2>兼容声明</h2><p class="muted">销售 SKU 与物料分别声明；型号级与指定规格分别生效。</p></div>
      <div class="row-actions" v-if="store.isAdmin"><el-button @click="openCopy">从物料适用关系复制</el-button><el-button type="primary" @click="openAdd">新增声明</el-button></div>
    </div>
    <el-alert v-if="!store.isAdmin" title="当前为只读角色，可查看声明与适用范围；维护需要管理员权限。" type="info" :closable="false" />
    <div class="manager-tools">
      <el-input v-model="keyword" placeholder="搜索配件、型号、编号或声明来源" clearable aria-label="搜索兼容声明" />
      <el-select v-model="kindFilter" aria-label="声明对象类型"><el-option label="销售 SKU 与物料" value="" /><el-option label="销售 SKU" value="sku" /><el-option label="物料 MAT" value="material" /></el-select>
      <el-select v-model="stateFilter" aria-label="声明状态"><el-option label="全部结论" value="" /><el-option label="已确认适用" value="compatible" /><el-option label="有条件适用" value="conditional" /><el-option label="明确不兼容" value="incompatible" /><el-option label="待确认" value="pending" /></el-select>
      <el-button v-if="target || host" @click="showAll = !showAll">{{ showAll ? '返回当前对象' : '查看全部声明' }}</el-button>
    </div>
    <p class="muted" data-declaration-count>共 {{ visible.length }} 条声明 · {{ objectCount }} 个配件对象 · {{ modelCount }} 个设备型号</p>
    <div v-if="store.isAdmin && selectedIds.length" class="batch-tools">
      <span>已选 {{ selectedIds.length }} 条</span><el-button @click="batch('pending')">标记待确认</el-button><el-button @click="batch('incompatible')">声明不兼容</el-button><el-button type="danger" @click="cancelMany">取消声明</el-button><el-button link @click="selectedIds = []">取消选择</el-button>
    </div>
    <el-empty v-if="!visible.length" :description="keyword ? '搜索没有结果，请调整关键词。' : '尚无适用声明，可以新增或从指定物料复制。'" />
    <article v-for="item in visible" :key="item.link.id" class="statement-card" :data-declaration-id="item.link.id">
      <div class="statement-top">
        <el-checkbox v-if="store.isAdmin" :model-value="selectedIds.includes(item.link.id)" :aria-label="`选择声明 ${item.link.id}`" @change="toggle(item.link.id)" />
        <div class="statement-main"><strong>{{ item.targetLabel }}</strong><p>{{ hostText(item.link.host) }} <span class="muted">· {{ scopeText(item.link.host) }}</span></p></div>
        <el-tag :type="item.state.verification === 'pending' ? 'warning' : item.state.conclusion === 'incompatible' ? 'danger' : item.state.conclusion === 'conditional' ? 'warning' : 'success'">{{ verificationLabels[item.state.verification] }} · {{ conclusionLabels[item.state.conclusion] }}</el-tag>
      </div>
      <p class="muted">{{ capabilityLabels[item.state.capability] }} · 来源：{{ item.state.source || '核验依据未记录' }}</p>
      <el-alert v-if="item.conflict" title="同一实际范围存在相反声明，已标记冲突；不会自动选择其中一条。" type="warning" :closable="false" data-declaration-conflict />
      <el-alert v-if="item.referenceProblem" :title="item.referenceProblem" type="warning" :closable="false" data-declaration-invalid />
      <ul v-if="item.state.conditions.length"><li v-for="(condition, index) in item.state.conditions" :key="index">{{ conditionText(store.data, condition) }}</li></ul>
      <p v-if="item.state.provenance.kind === 'material-copy'" class="muted">从物料 {{ item.state.provenance.materialSnapshot?.code }} · {{ item.state.provenance.materialSnapshot?.name }} 确认复制；副本独立维护。</p>
      <p v-if="item.link.note">备注：{{ item.link.note }}</p>
      <div class="statement-bottom"><span class="muted">更新 {{ item.link.updatedAt || '未记录' }} · {{ item.link.id }}</span><div v-if="store.isAdmin"><el-button link type="primary" @click="openEdit(item.link)">编辑声明</el-button><el-button link type="danger" @click="stageCancellation([item.link.id])">取消声明</el-button></div></div>
    </article>
    <div v-if="store.isAdmin" class="model-tools">
      <h3>设备型号与绑定</h3><p class="muted">手工或模板 SKU 未能唯一确认型号时，可以显式配置；无销售 SKU 的型号也可单独维护。</p>
      <el-select v-model="bindingSkuId" filterable clearable placeholder="选择要配置型号的主机 SKU" aria-label="选择主机 SKU"><el-option v-for="item in deviceSkus" :key="item.id" :value="item.id" :label="`${item.code} · ${item.skuName || item.id}`" /></el-select>
      <el-button :disabled="!bindingSkuId" @click="bindingOpen = true">配置设备型号</el-button><el-button @click="bindingSkuId = ''; bindingOpen = true">新建独立型号</el-button>
    </div>
    <DeviceBindingDialog v-model="bindingOpen" :sku-id="bindingSkuId" @saved="emit('updated')" />

    <el-dialog v-model="formOpen" :title="formTitle" width="min(820px, 96vw)" :close-on-click-modal="false" data-declaration-editor>
      <template v-if="mode === 'copy'">
        <el-alert title="明确选择一个源物料和一个销售 SKU。确认后形成独立声明；源物料后续修改不会联动副本。" type="info" :closable="false" />
        <el-form label-position="top" class="declaration-form">
          <el-form-item label="源物料 MAT" required><el-select v-model="sourceMaterialId" filterable placeholder="选择源物料" style="width:100%" data-copy-source><el-option v-for="item in materialObjects" :key="item.id" :value="item.id" :label="targetText(store.data, {kind:'material', id:item.id})" /></el-select></el-form-item>
          <div v-if="sourceMaterialId" class="copy-source"><strong>{{ targetText(store.data, {kind:'material', id:sourceMaterialId}) }}</strong><p v-for="item in sourceLinks" :key="item.id" class="muted">{{ declarationText(store.data, item) }}</p><p v-if="!sourceLinks.length" class="muted">该物料尚无正式适用声明。</p></div>
          <el-form-item label="复制到销售 SKU" required><el-select v-model="copySkuId" filterable placeholder="选择目标销售 SKU" style="width:100%" data-copy-target><el-option v-for="item in salesObjects" :key="item.id" :value="item.id" :label="targetText(store.data, {kind:'sku', id:item.id})" /></el-select></el-form-item>
        </el-form>
      </template>
      <el-form v-else-if="mode !== 'batch'" label-position="top" class="declaration-form">
        <p v-if="mode === 'edit'" class="muted">本次明确修改声明 {{ editId }}，不会覆盖其他声明。</p>
        <div class="form-grid">
          <el-form-item label="配件对象类型"><el-select v-model="objectKind" data-declaration-kind @change="targetIds = []"><el-option label="销售 SKU" value="sku" /><el-option label="物料 MAT" value="material" /></el-select></el-form-item>
          <el-form-item label="兼容能力"><el-select v-model="capability" data-declaration-capability><el-option v-for="(label, value) in capabilityLabels" :key="value" :label="label" :value="value" /></el-select></el-form-item>
        </div>
        <el-form-item label="实际配件对象" required><el-select v-model="targetIds" multiple filterable :multiple-limit="mode === 'edit' ? 1 : 0" placeholder="选择配件对象，可批量" style="width:100%" data-declaration-targets><el-option v-for="item in objectOptions" :key="item.id" :value="item.id" :label="targetText(store.data, {kind:objectKind, id:item.id})" /></el-select></el-form-item>
        <el-form-item label="主机型号" required><el-select v-model="hostKeys" multiple filterable :multiple-limit="mode === 'edit' || scope === 'planning' ? 1 : 0" placeholder="明确选择型号及来源，可批量" style="width:100%" data-declaration-hosts><el-option v-for="item in hostOptions" :key="item.key" :value="item.key" :label="`${item.label} · ${item.productTypeName} · ${hostOrigin(item.host.productModelId)}`" /></el-select></el-form-item>
        <div class="form-grid">
          <el-form-item label="适用范围"><el-select v-model="scope"><el-option label="整款型号，全部容量和颜色" value="model" /><el-option label="仅明确的规划规格" value="planning" /></el-select></el-form-item>
          <el-form-item v-if="scope === 'planning'" label="指定规划规格" required><el-select v-model="planningId" filterable placeholder="选择同型号 PLN" data-declaration-planning><el-option v-for="item in planningOptions" :key="item.planningId" :value="item.planningId" :label="`${item.planningId} · ${item.steps.map(step => step.valueId).join(' · ')}`" /></el-select></el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item label="兼容结论"><el-select v-model="conclusion" data-declaration-conclusion><el-option v-for="(label, value) in conclusionLabels" :key="value" :label="label" :value="value" /></el-select></el-form-item>
          <el-form-item label="核验状态"><el-select v-model="verification" data-declaration-verification><el-option label="已确认" value="confirmed" /><el-option label="待确认" value="pending" /></el-select></el-form-item>
        </div>
        <section class="condition-section"><div class="manager-head"><h3>使用条件</h3><el-button @click="addCondition">添加条件</el-button></div><p class="muted">设备属性按实际字段判断；配套线缆、协议和人工前提会显示为仍需确认，不会当作已经满足。</p>
          <div v-for="(condition, index) in conditionRows" :key="condition.id" class="condition-row">
            <el-select v-model="condition.kind" aria-label="条件类型"><el-option label="设备属性" value="attribute" /><el-option label="配套线缆或转换器" value="equipment" /><el-option label="协议、功率或能力" value="capability" /><el-option label="人工确认前提" value="manual" /></el-select>
            <template v-if="condition.kind === 'attribute'"><el-select v-model="condition.attributeId" filterable placeholder="设备属性"><el-option v-for="item in store.data.params" :key="item.id" :label="item.name" :value="item.id" /></el-select><el-select v-model="condition.operator" aria-label="属性判断"><el-option label="等于" value="eq" /><el-option label="属于" value="in" /><el-option label="不低于" value="gte" /></el-select><el-input v-model="condition.value" placeholder="属性值；多个值用逗号分隔" /></template>
            <el-input v-model="condition.text" :placeholder="condition.kind === 'attribute' ? '条件说明（可选）' : '填写实际使用前提'" />
            <template v-if="condition.kind === 'capability'"><el-input v-model="condition.protocol" placeholder="所需协议（未知可留空）" /><el-input-number v-model="condition.powerWatts" :min="1" :precision="1" placeholder="要求功率 W" /></template>
            <el-button link type="danger" :aria-label="`删除条件 ${index + 1}`" @click="conditionRows.splice(index, 1)">删除</el-button>
          </div>
        </section>
        <el-form-item label="声明来源或依据" required><el-input v-model="source" type="textarea" :rows="2" placeholder="填写实际依据；资料缺失请说明待核验，不虚构测试结果" data-declaration-source /></el-form-item>
        <el-form-item label="备注"><el-input v-model="note" type="textarea" :rows="2" placeholder="可选；备注不替代使用条件" data-declaration-note /></el-form-item>
      </el-form>
      <p v-else class="muted">本次只处理下列已选声明。取消声明不删除 SKU、MAT、PLN 或设备型号。</p>
      <section v-if="preview" class="preview" data-compatibility-preview>
        <h3>保存预览</h3><p>新增 {{ preview.added }} 条 · 修改 {{ preview.edited }} 条 · 取消 {{ preview.removed }} 条 · 重复跳过 {{ preview.skipped }} 条 · 冲突 {{ preview.conflicts }} 项 · 无效 {{ preview.invalid }} 项</p>
        <article v-for="(item, index) in preview.items" :key="index" class="preview-item" :class="item.state"><strong>{{ previewState[item.state] }}</strong><p>{{ item.change.kind === 'remove' ? `声明 ${item.change.id}` : `${targetText(store.data, item.change.draft.target)} → ${hostText(item.change.draft.host)} · ${scopeText(item.change.draft.host)} · ${capabilityLabels[item.change.draft.capability]}` }}</p><p>{{ item.message }}</p></article>
      </section>
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon data-declaration-error />
      <template #footer><el-button @click="formOpen = false">取消</el-button><el-button v-if="mode !== 'batch'" :disabled="!store.isAdmin" data-preview-compatibility @click="makePreview">预览变更</el-button><el-button type="primary" :disabled="!store.isAdmin || !preview?.canCommit || !preview.items.length" :loading="saving" data-confirm-compatibility @click="commit">确认保存</el-button></template>
    </el-dialog>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useCatalogStore } from '../../stores/catalog'
import { isMaterialArchive, isRealSku } from '../../domain/catalogIdentity'
import { compatibilityFamilyRole, compatibilityRecordRole, listDeviceModels, validateCompatibilityHost } from '../../domain/deviceResolution'
import { compatibilityTarget, declarationDefaults } from '../../domain/accessoryCompatibilityQuery'
import { cloneCompatibility, declarationDraft, previewCompatibilityChanges, previewMaterialCopy } from '../../domain/accessoryCompatibilityCommands'
import type { CompatibilityChange, CompatibilityPreview, DeclarationDraft } from '../../domain/accessoryCompatibilityCommands'
import type { CompatibilityHost, CompatibilityLink } from '../../domain/types'
import type { AccessoryTarget, AccessoryTargetKind, CompatibilityCapability, CompatibilityConclusion, CompatibilityCondition, CompatibilityVerification } from '../../domain/accessoryCompatibilityTypes'
import { capabilityLabels, conclusionLabels, verificationLabels, hostText, hostKey, scopeText, targetText, conditionText, declarationText } from './compatibilityPresentation'
import DeviceBindingDialog from './DeviceBindingDialog.vue'

const props = defineProps<{ target?: AccessoryTarget; host?: CompatibilityHost; deviceSkuId?: string }>()
const emit = defineEmits<{ updated: [] }>()
const store = useCatalogStore()
const keyword = ref(''), kindFilter = ref(''), stateFilter = ref(''), showAll = ref(false), selectedIds = ref<string[]>([])
const relatedDeclarations = computed(() => {
  const groups = new Map<string, CompatibilityLink[]>()
  for (const link of store.data.compatibilities) {
    const key = relationKey(link), group = groups.get(key) || []
    group.push(link); groups.set(key, group)
  }
  return groups
})
const visible = computed(() => store.data.compatibilities.flatMap(link => {
  const target = compatibilityTarget(link), state = declarationDefaults(link)
  if (!showAll.value && props.target && (target.kind !== props.target.kind || target.id !== props.target.id)) return []
  if (!showAll.value && props.host && hostKey(props.host) !== hostKey(link.host)) return []
  if (kindFilter.value && target.kind !== kindFilter.value) return []
  if (stateFilter.value && (stateFilter.value === 'pending' ? state.verification !== 'pending' : state.conclusion !== stateFilter.value || state.verification !== 'confirmed')) return []
  const targetLabel = targetText(store.data, target)
  if (keyword.value.trim() && !`${targetLabel} ${hostText(link.host)} ${state.source} ${link.note}`.toLowerCase().includes(keyword.value.trim().toLowerCase())) return []
  const overlapping = (relatedDeclarations.value.get(relationKey(link)) || []).filter(other => {
    const otherTarget = compatibilityTarget(other), otherState = declarationDefaults(other)
    return other.id !== link.id && otherTarget.kind === target.kind && otherTarget.id === target.id && hostKey(other.host) === hostKey(link.host) && (other.host.scope === 'model' || link.host.scope === 'model' || other.host.planningId === link.host.planningId) && otherState.capability === state.capability && otherState.verification === 'confirmed' && state.verification === 'confirmed' && otherState.conclusion !== state.conclusion && (otherState.conclusion === 'incompatible' || state.conclusion === 'incompatible')
  })
  const record = store.data.skus.find(item => item.id === target.id)
  const identityProblem = !record ? '配件引用已失效，需要重新选择实际对象或取消声明。' : target.kind === 'sku' ? !isRealSku(store.data, record) ? '销售 SKU 身份已失效，需要处理。' : '' : !isMaterialArchive(store.data, record) ? '物料身份已失效，需要处理。' : ''
  const referenceProblem = identityProblem || validateCompatibilityHost(store.data, link.host, hostOptions.value)
  return [{ link, targetLabel, target, state, conflict: overlapping.length > 0, referenceProblem }]
}))
const objectCount = computed(() => new Set(visible.value.map(item => JSON.stringify(item.target))).size)
const modelCount = computed(() => new Set(visible.value.map(item => hostKey(item.link.host))).size)
const salesObjects = computed(() => store.data.skus.filter(item => isRealSku(store.data, item) && accessory(item.familyId)))
const materialObjects = computed(() => store.data.skus.filter(item => isMaterialArchive(store.data, item) && accessory(item.familyId)))
const deviceSkus = computed(() => store.data.skus.filter(item => isRealSku(store.data, item) && compatibilityRecordRole(store.data, item.id) === 'host'))
const bindingSkuId = ref(props.deviceSkuId || ''), bindingOpen = ref(false)
const formOpen = ref(false), mode = ref<'add' | 'edit' | 'copy' | 'batch'>('add'), saving = ref(false), error = ref('')
const editId = ref(''), objectKind = ref<AccessoryTargetKind>('sku'), targetIds = ref<string[]>([]), hostKeys = ref<string[]>([])
const scope = ref<'model' | 'planning'>('model'), planningId = ref('')
const conclusion = ref<CompatibilityConclusion>('compatible'), verification = ref<CompatibilityVerification>('confirmed'), capability = ref<CompatibilityCapability>('basic')
const source = ref(''), note = ref(''), sourceMaterialId = ref(''), copySkuId = ref('')
interface ConditionRow { id: number; kind: CompatibilityCondition['kind']; attributeId: string; operator: 'eq' | 'in' | 'gte'; value: string; text: string; protocol: string; powerWatts?: number }
const conditionRows = ref<ConditionRow[]>([])
let conditionSequence = 0
const preview = ref<CompatibilityPreview>(), stagedChanges = ref<CompatibilityChange[]>([])
const previewState = { new: '新增', edit: '明确修改', remove: '取消', duplicate: '重复跳过', conflict: '冲突', invalid: '无效' }
const formTitle = computed(() => ({ add: '新增兼容声明', edit: '编辑兼容声明', copy: '从物料适用关系复制', batch: '确认批量变更' })[mode.value])
const objectOptions = computed(() => objectKind.value === 'sku' ? salesObjects.value : materialObjects.value)
const hostOptions = computed(() => listDeviceModels(store.data))
const planningOptions = computed(() => {
  const host = hostOptions.value.find(item => item.key === hostKeys.value[0])
  return hostKeys.value.length === 1 && host ? store.data.planningRecords.filter(item => host.planningIds.includes(item.planningId)) : []
})
const sourceLinks = computed(() => store.data.compatibilities.filter(link => { const target = compatibilityTarget(link); return target.kind === 'material' && target.id === sourceMaterialId.value }))
watch([objectKind, targetIds, hostKeys, scope, planningId, conclusion, verification, capability, source, note, conditionRows, sourceMaterialId, copySkuId], () => { preview.value = undefined; stagedChanges.value = []; error.value = '' }, { deep: true, flush: 'sync' })
watch(() => [props.target?.kind, props.target?.id, props.host?.productModelId, props.host?.identityKey, props.deviceSkuId], () => { showAll.value = false; selectedIds.value = []; bindingSkuId.value = props.deviceSkuId || ''; formOpen.value = false; bindingOpen.value = false; reset() })
function accessory(familyId: string) { return compatibilityFamilyRole(store.data, familyId) === 'accessory' }
function relationKey(link: CompatibilityLink) { const target = compatibilityTarget(link); return JSON.stringify([target.kind, target.id, hostKey(link.host), declarationDefaults(link).capability]) }
function hostOrigin(id: string) { return store.data.specCanvases.find(item => item.templateId === id)?.name || store.data.templates.find(item => item.id === id)?.name || (id.startsWith('device:') ? '独立型号' : id) }
function toggle(id: string) { selectedIds.value = selectedIds.value.includes(id) ? selectedIds.value.filter(item => item !== id) : [...selectedIds.value, id] }
function reset() {
  editId.value = ''; objectKind.value = props.target?.kind || 'sku'; targetIds.value = props.target ? [props.target.id] : []
  const presetHost = props.host
  hostKeys.value = presetHost ? hostOptions.value.filter(item => hostKey(item.host) === hostKey(presetHost)).map(item => item.key) : []
  scope.value = 'model'; planningId.value = ''; conclusion.value = 'compatible'; verification.value = 'confirmed'; capability.value = 'basic'
  source.value = ''; note.value = ''; conditionRows.value = []; sourceMaterialId.value = ''; copySkuId.value = props.target?.kind === 'sku' ? props.target.id : ''
  preview.value = undefined; stagedChanges.value = []; error.value = ''
}
function openAdd() { if (!store.isAdmin) return; reset(); mode.value = 'add'; formOpen.value = true }
function openCopy() { if (!store.isAdmin) return; reset(); mode.value = 'copy'; formOpen.value = true }
function addCondition() { conditionRows.value.push({ id: ++conditionSequence, kind: 'manual', attributeId: '', operator: 'eq', value: '', text: '', protocol: '' }) }
function openEdit(link: CompatibilityLink) {
  if (!store.isAdmin) return
  reset(); mode.value = 'edit'; editId.value = link.id
  const draft = declarationDraft(link)
  objectKind.value = draft.target.kind; targetIds.value = [draft.target.id]
  hostKeys.value = hostOptions.value.filter(item => hostKey(item.host) === hostKey(draft.host)).map(item => item.key)
  scope.value = draft.host.scope; planningId.value = draft.host.planningId || ''
  conclusion.value = draft.conclusion; verification.value = draft.verification; capability.value = draft.capability; source.value = draft.source; note.value = draft.note
  conditionRows.value = draft.conditions.map(condition => ({ id: ++conditionSequence, kind: condition.kind, attributeId: condition.kind === 'attribute' ? condition.attributeId : '', operator: condition.kind === 'attribute' ? condition.operator : 'eq', value: condition.kind === 'attribute' ? Array.isArray(condition.value) ? condition.value.join(', ') : condition.value : '', text: condition.text || '', protocol: condition.kind === 'capability' ? condition.protocol || '' : '', powerWatts: condition.kind === 'capability' ? condition.powerWatts : undefined }))
  formOpen.value = true
}
function conditions(): CompatibilityCondition[] {
  return conditionRows.value.map(row => row.kind === 'attribute'
    ? { kind: 'attribute', attributeId: row.attributeId, operator: row.operator, value: row.operator === 'in' ? row.value.split(/[,，、]/).map(value => value.trim()).filter(Boolean) : row.value.trim(), ...(row.text.trim() ? { text: row.text.trim() } : {}) }
    : row.kind === 'capability' ? { kind: 'capability', text: row.text.trim(), ...(row.protocol.trim() ? { protocol: row.protocol.trim() } : {}), ...(row.powerWatts ? { powerWatts: row.powerWatts } : {}) }
      : { kind: row.kind, text: row.text.trim() })
}
function makePreview() {
  error.value = ''
  if (mode.value === 'copy') {
    const result = previewMaterialCopy(store.data, sourceMaterialId.value, copySkuId.value)
    stagedChanges.value = cloneCompatibility(result.changes); preview.value = result; return
  }
  const chosen = hostOptions.value.filter(item => hostKeys.value.includes(item.key))
  if (!targetIds.value.length || !chosen.length) { error.value = '请选择实际配件对象和主机型号。'; return }
  if (mode.value === 'edit' && (targetIds.value.length !== 1 || chosen.length !== 1)) { error.value = '单条编辑必须选择一个配件对象和一个型号。'; return }
  if (scope.value === 'planning' && (chosen.length !== 1 || !planningId.value)) { error.value = '指定规格时请选择一个型号和明确 PLN。'; return }
  const original = store.data.compatibilities.find(item => item.id === editId.value)
  const changes: CompatibilityChange[] = targetIds.value.flatMap(id => chosen.map(item => {
    const host: CompatibilityHost = { ...cloneCompatibility(item.host), scope: scope.value, planningId: scope.value === 'planning' ? planningId.value : undefined }
    const draft: DeclarationDraft = { ...(original ? declarationDraft(original) : {}), target: { kind: objectKind.value, id }, host, conclusion: conclusion.value, verification: verification.value, capability: capability.value, conditions: conditions(), source: source.value, note: note.value }
    return mode.value === 'edit' ? { kind: 'edit', id: editId.value, draft } : { kind: 'add', draft }
  }))
  stagedChanges.value = cloneCompatibility(changes); preview.value = previewCompatibilityChanges(store.data, changes)
}
function stage(changes: CompatibilityChange[]) { if (!store.isAdmin) return; reset(); mode.value = 'batch'; stagedChanges.value = cloneCompatibility(changes); preview.value = previewCompatibilityChanges(store.data, changes); formOpen.value = true }
function stageCancellation(ids: string[]) { stage(ids.map(id => ({ kind: 'remove', id }))) }
function cancelMany() { stageCancellation(selectedIds.value) }
function batch(kind: 'pending' | 'incompatible') {
  stage(store.data.compatibilities.filter(link => selectedIds.value.includes(link.id)).map(link => ({ kind: 'edit', id: link.id, draft: { ...declarationDraft(link), ...(kind === 'pending' ? { verification: 'pending' as const } : { conclusion: 'incompatible' as const, verification: 'confirmed' as const }) } })))
}
function commit() {
  if (saving.value || !store.isAdmin || !preview.value?.canCommit || !stagedChanges.value.length) return
  saving.value = true
  const result = store.commitCompatibilityChanges(cloneCompatibility(stagedChanges.value))
  saving.value = false
  if (!result.ok) { error.value = result.message || '未能保存，草稿已保留，请重试。'; if (result.preview) preview.value = result.preview; return }
  error.value = ''; formOpen.value = false; selectedIds.value = []; ElMessage.success('兼容声明已保存，查询结果已更新。'); emit('updated')
}
</script>
<style scoped>
.manager-head,.statement-top,.statement-bottom,.manager-tools,.batch-tools { display:flex; align-items:center; gap:12px; }.manager-head,.statement-bottom { justify-content:space-between; }.manager-head { flex-wrap:wrap; margin-bottom:16px; }.manager-head h2,.manager-head h3 { margin:0; }.muted { color:var(--el-text-color-secondary); line-height:1.7; }.manager-head p { margin-bottom:0; }.manager-tools { flex-wrap:wrap; }.manager-tools>.el-input { width:320px; }.manager-tools>.el-select { width:180px; }.statement-card { padding:16px; border:1px solid var(--el-border-color-lighter); border-radius:12px; margin:12px 0; background:var(--el-bg-color); }.statement-main { flex:1; min-width:0; }.statement-main p { margin:7px 0; }.statement-bottom { flex-wrap:wrap; font-size:12px; }.statement-card p { overflow-wrap:anywhere; }.batch-tools { flex-wrap:wrap; padding:10px; background:var(--el-fill-color-light); border-radius:8px; }.model-tools { border-top:1px solid var(--el-border-color-lighter); margin-top:24px; padding-top:8px; }.model-tools>.el-select { width:min(380px,100%); margin-right:8px; }.declaration-form { margin-top:16px; }.form-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }.form-grid .el-select { width:100%; }.condition-section { margin:12px 0 20px; }.condition-row { border:1px solid var(--el-border-color-lighter); padding:12px; border-radius:10px; display:flex; gap:8px; flex-wrap:wrap; margin:8px 0; }.condition-row>.el-select { width:170px; }.condition-row>.el-input { flex:1; min-width:180px; }.preview { margin:16px 0; padding:16px; background:var(--el-fill-color-extra-light); border-radius:12px; }.preview-item { border-top:1px solid var(--el-border-color-lighter); padding:12px 0; }.preview-item p { margin:6px 0; overflow-wrap:anywhere; }.preview-item.conflict,.preview-item.invalid { color:var(--el-color-danger); }.copy-source { padding:12px; background:var(--el-fill-color-light); margin-bottom:16px; border-radius:8px; }
@media(max-width:700px) { .form-grid { grid-template-columns:1fr; gap:0; }.statement-top { align-items:flex-start; flex-wrap:wrap; }.manager-tools>.el-input,.manager-tools>.el-select { width:100%; }.manager-head .row-actions { width:100%; }.statement-bottom { align-items:flex-start; }.model-tools .el-button { margin-top:8px; } }
</style>
