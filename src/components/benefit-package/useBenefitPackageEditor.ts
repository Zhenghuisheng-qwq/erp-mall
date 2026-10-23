import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useCatalogStore } from '../../stores/catalog'
import { compatibilityRecordRole, listDeviceModels } from '../../domain/deviceResolution'
import { isRealSku } from '../../domain/catalogIdentity'
import { addBenefitSku, benefitSkuCandidates, benefitSkuSummary, cloneBenefit, confirmBenefitCondition, copyBenefitPackageDraft, newBenefitPackageDraft, parseBenefitAmount, previewBenefitDelivery, replaceBenefitSku, reviewBenefitQuote, setBenefitDevice, setBenefitIncludedPhone, validateBenefitPackage } from '../../domain/benefitPackages'
import type { BenefitDeviceContext, BenefitDeliveryPreview, BenefitPackageDraft, BenefitServiceLine } from '../../domain/benefitPackageTypes'
import { amountInput, localBenefitRequest } from './benefitPackagePresentation'

export function useBenefitPackageEditor() {
  const store = useCatalogStore(), route = useRoute(), router = useRouter()
  const draft = ref(newBenefitPackageDraft()), original = ref(''), missing = ref(false)
  const error = ref(''), saving = ref(false), saveRequest = ref('')
  const keyword = ref(''), productTypeId = ref(''), candidateTab = ref<'recommended' | 'all' | 'common'>('recommended')
  const quoteText = ref(''), quoteError = ref('')
  const serviceOpen = ref(false), editedService = ref<BenefitServiceLine>()
  const replaceOpen = ref(false), replaceLineId = ref(''), replaceSkuId = ref('')
  const deviceSwitchOpen = ref(false), pendingDevice = ref<BenefitDeviceContext>(null)
  const conditionNotes = ref<Record<string, string>>({})
  const deliveryCount = ref(1), deliveryPreview = ref<BenefitDeliveryPreview>(), deliveryConfirmed = ref(false), generating = ref(false), generationRequest = ref('')
  const leaveOpen = ref(false), leaving = ref(false)
  let resolveLeave: ((value: boolean) => void) | undefined
  const validation = computed(() => validateBenefitPackage(store.data, draft.value))
  const dirty = computed(() => JSON.stringify(draft.value) !== original.value || Boolean(quoteError.value))
  const saved = computed(() => store.data.benefitPackages?.find(item => item.id === draft.value.id))
  const stale = computed(() => Boolean(saved.value && saved.value.revision !== draft.value.revision))
  const commonPackages = computed(() => (store.data.benefitPackages || []).filter(item => item.favorite && item.status !== 'disabled'))
  const models = computed(() => listDeviceModels(store.data))
  const deviceSkus = computed(() => store.data.skus.filter(sku => isRealSku(store.data, sku) && compatibilityRecordRole(store.data, sku.id) === 'host').map(sku => benefitSkuSummary(store.data, sku.id)).filter(item => item !== undefined))
  const allCandidates = computed(() => benefitSkuCandidates(store.data, draft.value.device))
  const candidates = computed(() => benefitSkuCandidates(store.data, draft.value.device, { keyword: keyword.value, productTypeId: productTypeId.value, accessoriesOnly: candidateTab.value === 'recommended' }))
  const types = computed(() => [...new Map(allCandidates.value.map(item => [item.productTypeId, { id: item.productTypeId, name: item.typeName }])).values()])
  const currentPhone = computed(() => draft.value.device?.kind === 'sku' ? benefitSkuSummary(store.data, draft.value.device.skuId) : undefined)
  const includedPhone = computed(() => draft.value.goods.find(line => line.skuId === draft.value.includedPhoneSkuId)?.snapshot)
  const currentIsIncluded = computed(() => Boolean(currentPhone.value && draft.value.includedPhoneSkuId === currentPhone.value.skuId))
  const deviceValue = computed(() => {
    if (draft.value.device?.kind === 'sku') return `sku:${draft.value.device.skuId}`
    if (draft.value.device?.kind === 'model') {
      const host = draft.value.device.host
      return `model:${models.value.find(item => item.host.productModelId === host.productModelId && item.host.identityKey === host.identityKey)?.key || ''}`
    }
    return ''
  })
  const relatedDeliveries = computed(() => (store.data.benefitDeliveries || []).filter(item => item.packageId === draft.value.id))
  const canGenerate = computed(() => Boolean(draft.value.id && !dirty.value && !stale.value && draft.value.status === 'available' && store.isAdmin))
  function initialize() {
    const id = typeof route.params.id === 'string' ? route.params.id : ''
    const source = id ? store.data.benefitPackages?.find(item => item.id === id) : undefined
    const copyId = typeof route.query.copy === 'string' ? route.query.copy : ''
    const copySource = copyId ? store.data.benefitPackages?.find(item => item.id === copyId) : undefined
    missing.value = Boolean((id && !source) || (copyId && !copySource))
    const device = typeof route.query.device === 'string' ? { kind: 'sku' as const, skuId: route.query.device } : null
    serviceOpen.value = false; editedService.value = undefined
    replaceOpen.value = false; replaceLineId.value = ''; replaceSkuId.value = ''
    deviceSwitchOpen.value = false; pendingDevice.value = null
    deliveryPreview.value = undefined; deliveryConfirmed.value = false; deliveryCount.value = 1
    leaveOpen.value = false; leaving.value = false
    keyword.value = ''; productTypeId.value = ''
    draft.value = source ? cloneBenefit(source) : copySource ? copyBenefitPackageDraft(copySource) : newBenefitPackageDraft(device)
    quoteText.value = amountInput(draft.value.quote.amountCents); quoteError.value = ''; error.value = ''
    candidateTab.value = draft.value.device ? 'recommended' : 'all'
    original.value = JSON.stringify(draft.value); saveRequest.value = ''; generationRequest.value = ''; conditionNotes.value = {}
  }
  watch(() => route.fullPath, initialize, { immediate: true })
  watch(draft, () => { deliveryPreview.value = undefined; deliveryConfirmed.value = false }, { deep: true })
  watch(deliveryCount, () => { deliveryPreview.value = undefined; deliveryConfirmed.value = false; generationRequest.value = '' })
  function change(operation: () => BenefitPackageDraft) {
    if (!store.isAdmin) return
    try { draft.value = operation(); error.value = '' }
    catch (problem) { error.value = problem instanceof Error ? problem.message : String(problem) }
  }
  function addSku(skuId: string) { change(() => addBenefitSku(store.data, draft.value, skuId)) }
  function quantity(lineId: string, value: number) { if (store.isAdmin) draft.value.goods = draft.value.goods.map(line => line.id === lineId ? { ...line, quantity: value } : line) }
  async function removeSku(lineId: string) {
    const line = draft.value.goods.find(item => item.id === lineId)
    if (!line || !store.isAdmin) return
    if (line.skuId === draft.value.includedPhoneSkuId) { await includePhone(false); return }
    draft.value.goods = draft.value.goods.filter(item => item.id !== lineId)
  }
  function chooseReplacement(lineId: string) { if (!store.isAdmin) return; replaceLineId.value = lineId; replaceSkuId.value = ''; replaceOpen.value = true }
  function replace() {
    const before = draft.value
    change(() => replaceBenefitSku(store.data, draft.value, replaceLineId.value, replaceSkuId.value))
    if (draft.value !== before) replaceOpen.value = false
  }
  function requestDevice(value: string) {
    if (!store.isAdmin) return
    let next: BenefitDeviceContext = null
    if (value.startsWith('sku:')) next = { kind: 'sku', skuId: value.slice(4) }
    if (value.startsWith('model:')) {
      const model = models.value.find(item => item.key === value.slice(6))
      if (!model) { error.value = '该设备型号已不可用，请重新选择。'; return }
      next = { kind: 'model', host: cloneBenefit(model.host) }
    }
    if (JSON.stringify(next) === JSON.stringify(draft.value.device)) return
    if (draft.value.includedPhoneSkuId) { pendingDevice.value = next; deviceSwitchOpen.value = true; return }
    change(() => setBenefitDevice(store.data, draft.value, next)); candidateTab.value = next ? 'recommended' : 'all'; keyword.value = ''; productTypeId.value = ''
  }
  function finishDeviceSwitch(replacePhone: boolean) {
    const before = draft.value
    change(() => setBenefitDevice(store.data, draft.value, pendingDevice.value, replacePhone))
    if (draft.value !== before) { candidateTab.value = draft.value.device ? 'recommended' : 'all'; keyword.value = ''; productTypeId.value = ''; deviceSwitchOpen.value = false }
  }
  async function includePhone(value: boolean) {
    if (!store.isAdmin) return
    if (!value && draft.value.includedPhoneSkuId) {
      try { await ElMessageBox.confirm(`将从实物清单移除「${includedPhone.value?.name || draft.value.includedPhoneSkuId}」。适配设备保持不变。`, '移除包内手机', { confirmButtonText: '确认移除这条手机', cancelButtonText: '保留手机' }) }
      catch { return }
    }
    change(() => setBenefitIncludedPhone(store.data, draft.value, value))
  }
  function editService(service?: BenefitServiceLine) { editedService.value = service; serviceOpen.value = true }
  function saveService(service: BenefitServiceLine) {
    if (!store.isAdmin) return
    const index = draft.value.services.findIndex(item => item.id === service.id)
    draft.value.services = index < 0 ? [...draft.value.services, cloneBenefit(service)] : draft.value.services.map(item => item.id === service.id ? cloneBenefit(service) : item)
  }
  function removeService(id: string) { if (store.isAdmin) draft.value.services = draft.value.services.filter(item => item.id !== id) }
  function updateQuote(value: string | number) {
    if (!store.isAdmin) return
    quoteText.value = String(value)
    try { draft.value.quote.amountCents = parseBenefitAmount(quoteText.value); draft.value.quote.reviewedBasis = ''; quoteError.value = '' }
    catch (problem) { quoteError.value = problem instanceof Error ? problem.message : String(problem) }
  }
  function reviewQuote() { change(() => reviewBenefitQuote(draft.value)) }
  function confirmCondition(skuId: string, capability: 'basic' | 'fast-charge') { change(() => confirmBenefitCondition(store.data, draft.value, skuId, conditionNotes.value[`${skuId}:${capability}`] || '', new Date().toISOString(), capability)) }
  function isConditionConfirmed(skuId: string, capability: 'basic' | 'fast-charge') { return draft.value.confirmations.some(item => item.skuId === skuId && item.capability === capability && item.basis === validation.value.basis) }
  async function save(status: 'draft' | 'available', navigate = true) {
    if (saving.value || !store.isAdmin) return false
    if (quoteError.value) { error.value = quoteError.value; return false }
    if (!dirty.value && draft.value.id && draft.value.status === status) return true
    saving.value = true
    saveRequest.value ||= localBenefitRequest('save-package')
    const result = store.saveBenefitPackage({ draft: cloneBenefit(draft.value), status, expectedRevision: draft.value.revision, requestId: saveRequest.value })
    saving.value = false
    if (!result.ok || !result.package) { error.value = result.message || '保存失败，输入已保留，可直接重试。'; return false }
    draft.value = cloneBenefit(result.package); original.value = JSON.stringify(draft.value); saveRequest.value = ''; error.value = ''
    ElMessage.success(status === 'available' ? '权益包已保存，可继续生成交付清单' : '权益包草稿已保存')
    if (navigate && route.params.id !== draft.value.id) await router.replace({ path: `/benefit-packages/${draft.value.id}`, query: returnQuery() })
    return true
  }
  function makeDeliveryPreview() {
    if (!canGenerate.value || !saved.value) { error.value = '请先保存当前完整配置，再生成交付清单。'; return }
    deliveryPreview.value = previewBenefitDelivery(store.data, saved.value, deliveryCount.value)
    deliveryConfirmed.value = false; generationRequest.value = ''; error.value = ''
  }
  async function generate() {
    if (generating.value || !store.isAdmin || !deliveryPreview.value || !deliveryConfirmed.value || dirty.value) return
    generating.value = true; generationRequest.value ||= localBenefitRequest('delivery-request')
    const preview = deliveryPreview.value
    const result = store.generateBenefitDelivery({ packageId: preview.packageId, expectedRevision: preview.sourceRevision, requestId: generationRequest.value, packageCount: preview.packageCount, expectedBasis: preview.basis })
    generating.value = false
    if (!result.ok || !result.delivery) { error.value = result.message || '清单生成失败，当前预览和请求已保留，请重试。'; return }
    error.value = ''; generationRequest.value = ''; ElMessage.success('交付清单已确认保存')
    await router.push({ path: `/benefit-packages/deliveries/${result.delivery.id}`, query: returnQuery() })
  }
  function returnQuery() { return typeof route.query.returnTo === 'string' ? { returnTo: route.query.returnTo } : {} }
  function back() { const target = route.query.returnTo; router.push(typeof target === 'string' && target.startsWith('/') && !target.startsWith('//') ? target : '/benefit-packages') }
  function useCommon(id: string) { router.push({ path: '/benefit-packages/new', query: { copy: id, ...returnQuery() } }) }
  function openDelivery(id: string) { router.push({ path: `/benefit-packages/deliveries/${id}`, query: returnQuery() }) }
  async function setStatus(status: 'available' | 'disabled') {
    if (!store.isAdmin || !draft.value.id) return
    if (dirty.value) { error.value = '请先保存或放弃当前编辑，再变更权益包状态。'; return }
    if (status === 'disabled') { try { await ElMessageBox.confirm('停用后不能生成新的交付清单，已有清单仍保留。', '停用权益包', { confirmButtonText: '确认停用', cancelButtonText: '取消' }) } catch { return } }
    const result = store.setBenefitPackageStatus(draft.value.id, status, draft.value.revision)
    if (!result.ok || !result.package) { error.value = result.message || '状态未保存，可重试。'; return }
    draft.value = cloneBenefit(result.package); original.value = JSON.stringify(draft.value); error.value = ''
  }
  async function reload() {
    if (dirty.value) { try { await ElMessageBox.confirm('重新读取会放弃当前未保存编辑。', '读取最新配置', { confirmButtonText: '放弃编辑并读取', cancelButtonText: '继续编辑' }) } catch { return } }
    initialize()
  }
  const guard = () => {
    if (!dirty.value || !store.isAdmin) return true
    leaveOpen.value = true
    return new Promise<boolean>(resolve => { resolveLeave = resolve })
  }
  function continueEditing() { leaveOpen.value = false; resolveLeave?.(false); resolveLeave = undefined }
  function discardAndLeave() { leaveOpen.value = false; original.value = JSON.stringify(draft.value); quoteError.value = ''; resolveLeave?.(true); resolveLeave = undefined }
  async function saveAndLeave() { if (leaving.value) return; leaving.value = true; const ok = await save('draft', false); leaving.value = false; if (ok) { leaveOpen.value = false; resolveLeave?.(true); resolveLeave = undefined } }
  onBeforeRouteLeave(guard); onBeforeRouteUpdate(guard)
  const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty.value && store.isAdmin) { event.preventDefault(); event.returnValue = '' } }
  onMounted(() => window.addEventListener('beforeunload', beforeUnload))
  onBeforeUnmount(() => { window.removeEventListener('beforeunload', beforeUnload); resolveLeave?.(false) })
  return { store, draft, missing, dirty, stale, error, saving, keyword, productTypeId, candidateTab, candidates, allCandidates, commonPackages, types, models, deviceSkus, deviceValue, currentPhone, includedPhone, currentIsIncluded, validation, quoteText, quoteError, serviceOpen, editedService, replaceOpen, replaceSkuId, deviceSwitchOpen, pendingDevice, conditionNotes, deliveryCount, deliveryPreview, deliveryConfirmed, generating, canGenerate, relatedDeliveries, leaveOpen, leaving, addSku, quantity, removeSku, chooseReplacement, replace, requestDevice, finishDeviceSwitch, includePhone, editService, saveService, removeService, updateQuote, reviewQuote, confirmCondition, isConditionConfirmed, save, makeDeliveryPreview, generate, back, useCommon, openDelivery, setStatus, reload, continueEditing, discardAndLeave, saveAndLeave }
}
