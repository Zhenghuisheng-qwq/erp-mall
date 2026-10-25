import { resolveBenefitRange, applyBenefitFramework } from '../../domain/benefitFrameworks'
import { nextTick, computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useCatalogStore } from '../../stores/catalog'
import { compatibilityRecordRole, deviceHostKey, listDeviceModels } from '../../domain/deviceResolution'
import { isRealSku } from '../../domain/catalogIdentity'
import { addBenefitSku, benefitSkuCandidates, benefitSkuSummary, cloneBenefit, confirmBenefitCondition, copyBenefitPackageDraft, newBenefitPackageDraft, parseBenefitAmount, previewBenefitDelivery, replaceBenefitSku, reviewBenefitQuote, setBenefitDevice, setBenefitIncludedPhone, validateBenefitPackage } from '../../domain/benefitPackages'
import type { BenefitCommandResult, BenefitDeviceContext, BenefitDeliveryPreview, BenefitIssue, BenefitPackageDraft, BenefitServiceLine } from '../../domain/benefitPackageTypes'
import { amountInput, localBenefitRequest } from './benefitPackagePresentation'
import { safeBenefitReturn } from './benefitNavigation'
import BenefitServiceDialog from './BenefitServiceDialog.vue'
import BenefitRuleEditor from './BenefitRuleEditor.vue'

// A bounded in-memory return point, released when the related package is reopened.
// Search/scroll/draft editing never writes business AppData.
let editorReturn: { path: string; draft: BenefitPackageDraft; original: string; keyword: string; type: string; tab: 'recommended' | 'all' | 'common'; quoteText: string; quoteError: string; notes: Record<string, string>; scroll: { selector: string; top: number }[] } | undefined

let previewOnArrival: { path: string; count: number } | undefined

export function useBenefitPackageEditor() {
  const store = useCatalogStore(), route = useRoute(), router = useRouter()
  const draft = ref(newBenefitPackageDraft()), original = ref(''), missing = ref(false)
  const error = ref(''), saving = ref(false), saveRequest = ref('')
  const keyword = ref(''), productTypeId = ref(''), candidateTab = ref<'recommended' | 'all' | 'common'>('recommended')
  const quoteText = ref(''), quoteError = ref('')
  const serviceOpen = ref(false), editedService = ref<BenefitServiceLine>(), serviceDirty = ref(false)
  const serviceDialog = ref<InstanceType<typeof BenefitServiceDialog>>()
  const ruleEditor = ref<InstanceType<typeof BenefitRuleEditor>>()
  const membersOpen=ref(true), frameworkId=ref('')
  const advancedOpen = ref<string[]>([]), narrowPane = ref('candidates')
  const leaveIntent = ref<'route' | 'service'>('route')
  let allowNextNavigation = false
  const replaceOpen = ref(false), replaceLineId = ref(''), replaceSkuId = ref('')
  const deviceSwitchOpen = ref(false), pendingDevice = ref<BenefitDeviceContext>(null)
  const conditionNotes = ref<Record<string, string>>({})
  const deliveryCount = ref(1), deliveryPreview = ref<BenefitDeliveryPreview>(), deliveryConfirmed = ref(false), generating = ref(false), generationRequest = ref('')
  const leaveOpen = ref(false), leaving = ref(false)
  let resolveLeave: ((value: boolean) => void) | undefined
  const validation = computed(() => validateBenefitPackage(store.data, draft.value))
  const dirty = computed(() => JSON.stringify(draft.value) !== original.value || Boolean(quoteError.value))
  const busy = computed(() => saving.value || generating.value || leaving.value)
  const unsaved = computed(() => dirty.value || serviceDirty.value)
  const saved = computed(() => store.data.benefitPackages?.find(item => item.id === draft.value.id))
  const stale = computed(() => Boolean(saved.value && saved.value.revision !== draft.value.revision))
  const commonPackages = computed(() => (store.data.benefitPackages || []).filter(item => item.favorite && item.status !== 'disabled'))
  const models = computed(() => listDeviceModels(store.data))
  const deviceSkus = computed(() => store.data.skus.filter(sku => isRealSku(store.data, sku) && compatibilityRecordRole(store.data, sku.id) === 'host').map(sku => benefitSkuSummary(store.data, sku.id)).filter(item => item !== undefined))
  const frameworkRange = computed(() => resolveBenefitRange(store.data,draft.value))
  const allCandidates = computed(() => draft.value.framework?frameworkRange.value.candidates:benefitSkuCandidates(store.data, draft.value.device))
  const candidates = computed(() => draft.value.framework?allCandidates.value.filter(s=>(candidateTab.value!=='recommended'||frameworkRange.value.recommendedSkuIds.has(s.skuId))&&(!productTypeId.value||s.productTypeId===productTypeId.value)&&(!keyword.value||`${s.name} ${s.code} ${s.spec}`.toLowerCase().includes(keyword.value.toLowerCase()))):benefitSkuCandidates(store.data, draft.value.device, { keyword: keyword.value, productTypeId: productTypeId.value, accessoriesOnly: candidateTab.value === 'recommended' }))
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
  const canGenerate = computed(() => Boolean(draft.value.id && !dirty.value && !stale.value && draft.value.status === 'available' && store.isAdmin && !store.persistenceState.external))
  function initialize() {
    const id = typeof route.params.id === 'string' ? route.params.id : ''
    const source = id ? store.data.benefitPackages?.find(item => item.id === id) : undefined
    const copyId = typeof route.query.copy === 'string' ? route.query.copy : ''
    const copySource = copyId ? store.data.benefitPackages?.find(item => item.id === copyId) : undefined
    missing.value = Boolean((id && !source) || (copyId && !copySource))
    const device = typeof route.query.device === 'string' ? { kind: 'sku' as const, skuId: route.query.device } : null
    serviceOpen.value = false; serviceDirty.value = false; editedService.value = undefined
    replaceOpen.value = false; replaceLineId.value = ''; replaceSkuId.value = ''
    deviceSwitchOpen.value = false; pendingDevice.value = null
    deliveryPreview.value = undefined; deliveryConfirmed.value = false; deliveryCount.value = 1
    leaveOpen.value = false; leaving.value = false
    keyword.value = ''; productTypeId.value = ''
    draft.value = source ? cloneBenefit(source) : copySource ? copyBenefitPackageDraft(copySource) : newBenefitPackageDraft(device)
    quoteText.value = amountInput(draft.value.quote.amountCents); quoteError.value = ''; error.value = ''
    candidateTab.value = draft.value.device ? 'recommended' : 'all'
    original.value = JSON.stringify(draft.value); saveRequest.value = ''; generationRequest.value = ''; conditionNotes.value = {}
    if (editorReturn?.path === route.fullPath) {
      const retained = editorReturn; editorReturn = undefined
      draft.value = retained.draft; original.value = retained.original; keyword.value = retained.keyword; productTypeId.value = retained.type; candidateTab.value = retained.tab
      quoteText.value = retained.quoteText; quoteError.value = retained.quoteError; conditionNotes.value = retained.notes
      void nextTick(() => { for (const entry of retained.scroll) { const element = document.querySelector(entry.selector); if (element) element.scrollTop = entry.top } })
    }
  }
  // AdminLayout keys benefit pages by fullPath, so a route change creates a new editor.
  // Initialize once and hand only an ephemeral preview intent to that next instance.
  initialize()
  if (previewOnArrival?.path === route.fullPath) {
    const arrival = previewOnArrival; previewOnArrival = undefined
    void nextTick(async () => { deliveryCount.value = arrival.count; await nextTick(); makeDeliveryPreview(); await nextTick(); document.querySelector('[data-benefit-delivery-preview]')?.scrollIntoView({ block: 'start', behavior: 'instant' }) })
  }
  watch(draft, () => { deliveryPreview.value = undefined; deliveryConfirmed.value = false }, { deep: true })
  watch(deliveryCount, () => { deliveryPreview.value = undefined; deliveryConfirmed.value = false; generationRequest.value = '' })
  function change(operation: () => BenefitPackageDraft) {
    if (!store.isAdmin || saving.value || generating.value) return
    try { draft.value = operation(); error.value = '' }
    catch (problem) { error.value = problem instanceof Error ? problem.message : String(problem) }
  }
  async function useFramework(){
    if(!store.isAdmin||busy.value)return
    const f=store.data.benefitFrameworks?.find(f=>f.id===frameworkId.value)
    if(frameworkId.value&&!f){error.value='框架已不存在。';return}
    let next:BenefitPackageDraft
    try{next=applyBenefitFramework(draft.value,f)}catch(e){error.value=String(e);return}
    const issues=validateBenefitPackage(store.data,next).issues.filter(i=>i.code.startsWith('framework'))
    try{await ElMessageBox.confirm(`${f?`使用「${f.name}」修订 ${f.revision}`:'解除框架'}。保留 ${draft.value.goods.length} 种商品、服务及人工价格；清除旧条件确认并复核报价。${issues.map(i=>i.message).join(' ')||'当前成员符合新范围。'}`,'确认框架变更',{confirmButtonText:'保留成员并应用',cancelButtonText:'取消'})}catch{return}
    change(()=>next)
  }
  function addSku(skuId: string) { change(() => addBenefitSku(store.data, draft.value, skuId)) }
  function quantity(lineId: string, value: number) { if (store.isAdmin && !busy.value) draft.value.goods = draft.value.goods.map(line => line.id === lineId ? { ...line, quantity: value } : line) }
  async function removeSku(lineId: string) {
    const line = draft.value.goods.find(item => item.id === lineId)
    if (!line || !store.isAdmin || busy.value) return
    if (line.skuId === draft.value.includedPhoneSkuId) { await includePhone(false); return }
    draft.value.goods = draft.value.goods.filter(item => item.id !== lineId)
  }
  function chooseReplacement(lineId: string) { if (!store.isAdmin || saving.value || generating.value) return; replaceLineId.value = lineId; replaceSkuId.value = ''; replaceOpen.value = true }
  function replace() {
    const before = draft.value
    change(() => replaceBenefitSku(store.data, draft.value, replaceLineId.value, replaceSkuId.value))
    if (draft.value !== before) replaceOpen.value = false
  }
  function requestDevice(value: string) {
    if (!store.isAdmin || saving.value || generating.value) return
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
    if (!store.isAdmin || saving.value || generating.value) return
    if (!value && draft.value.includedPhoneSkuId) {
      try { await ElMessageBox.confirm(`将从实物清单移除「${includedPhone.value?.name || draft.value.includedPhoneSkuId}」。适配设备保持不变。`, '移除包内手机', { confirmButtonText: '确认移除这条手机', cancelButtonText: '保留手机' }) }
      catch { return }
    }
    change(() => setBenefitIncludedPhone(store.data, draft.value, value))
  }
  function editService(service?: BenefitServiceLine) { if (!store.isAdmin || busy.value) return; serviceDirty.value = false; editedService.value = service; serviceOpen.value = true }
  function saveService(service: BenefitServiceLine) {
    if (!store.isAdmin || saving.value || generating.value) return
    const index = draft.value.services.findIndex(item => item.id === service.id)
    draft.value.services = index < 0 ? [...draft.value.services, cloneBenefit(service)] : draft.value.services.map(item => item.id === service.id ? cloneBenefit(service) : item)
  }
  function removeService(id: string) { if (store.isAdmin && !busy.value) draft.value.services = draft.value.services.filter(item => item.id !== id) }
  function updateQuote(value: string | number) {
    if (!store.isAdmin || saving.value || generating.value) return
    quoteText.value = String(value)
    try { draft.value.quote.amountCents = parseBenefitAmount(quoteText.value); draft.value.quote.reviewedBasis = ''; quoteError.value = '' }
    catch (problem) { quoteError.value = problem instanceof Error ? problem.message : String(problem) }
  }
  function reviewQuote() { change(() => reviewBenefitQuote(draft.value)) }
  function confirmCondition(skuId: string, capability: 'basic' | 'fast-charge') { change(() => confirmBenefitCondition(store.data, draft.value, skuId, conditionNotes.value[`${skuId}:${capability}`] || '', new Date().toISOString(), capability)) }
  function isConditionConfirmed(skuId: string, capability: 'basic' | 'fast-charge') { return draft.value.confirmations.some(item => item.skuId === skuId && item.capability === capability && item.basis === validation.value.basis) }
  async function save(status: 'draft' | 'available', navigate = true) {
    if (serviceDirty.value) { error.value = '服务弹窗还有未确认输入，请先加入服务清单或明确放弃，再保存权益包。'; return false }
    if (saving.value || !store.isAdmin) return false
    if (quoteError.value) { error.value = quoteError.value; return false }
    if (!dirty.value && draft.value.id && draft.value.status === status && !store.persistenceState.external) return true
    saving.value = true
    saveRequest.value ||= localBenefitRequest('save-package')
    let result: BenefitCommandResult
    try { result = await store.saveBenefitPackage({ draft: cloneBenefit(draft.value), status, expectedRevision: draft.value.revision, requestId: saveRequest.value }) }
    catch (problem) { error.value = `保存未完成，当前输入已保留：${problem instanceof Error ? problem.message : String(problem)}`; return false }
    finally { saving.value = false }
    if (!result.ok || !result.package) { error.value = result.message || '保存失败，输入已保留，可直接重试。'; const first = result.validation?.issues.find(issue => issue.structural || status === 'available' && issue.severity === 'error'); if (first) void locateIssue(first); return false }
    draft.value = cloneBenefit(result.package); original.value = JSON.stringify(draft.value); saveRequest.value = ''; error.value = ''
    ElMessage.success(status === 'available' ? '权益包已保存，可继续生成交付清单' : '权益包草稿已保存')
    if (navigate && route.params.id !== draft.value.id) await router.replace({ path: `/benefit-packages/${draft.value.id}`, query: returnQuery() })
    return true
  }
  async function saveAndPreview() {
    deliveryPreview.value = undefined; deliveryConfirmed.value = false; generationRequest.value = ''
    if (!await save('available', false)) return
    if (route.params.id !== draft.value.id) {
      const location = { path: `/benefit-packages/${draft.value.id}`, query: returnQuery() }
      previewOnArrival = { path: router.resolve(location).fullPath, count: deliveryCount.value }
      await router.replace(location)
    } else { await nextTick(); makeDeliveryPreview(); await nextTick(); document.querySelector('[data-benefit-delivery-preview]')?.scrollIntoView({ block: 'start', behavior: 'instant' }) }
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
    let result: BenefitCommandResult
    try { result = await store.generateBenefitDelivery({ packageId: preview.packageId, expectedRevision: preview.sourceRevision, requestId: generationRequest.value, packageCount: preview.packageCount, expectedBasis: preview.basis }) }
    catch (problem) { error.value = `清单生成未完成，当前请求已保留：${problem instanceof Error ? problem.message : String(problem)}`; return }
    finally { generating.value = false }
    if (!result.ok || !result.delivery) { error.value = result.message || '清单生成失败，当前预览和请求已保留，请重试。'; return }
    error.value = ''; generationRequest.value = ''; ElMessage.success('交付清单已确认保存')
    await router.push({ path: `/benefit-packages/deliveries/${result.delivery.id}`, query: returnQuery() })
  }
  function returnQuery() { return route.query.returnTo ? { returnTo: safeBenefitReturn(router, route.query.returnTo) } : {} }
  function back() { void router.push(safeBenefitReturn(router, route.query.returnTo)) }
  function useCommon(id: string) { router.push({ path: '/benefit-packages/new', query: { copy: id, ...returnQuery() } }) }
  function openDelivery(id: string) { router.push({ path: `/benefit-packages/deliveries/${id}`, query: returnQuery() }) }
  async function setStatus(status: 'available' | 'disabled') {
    if (!store.isAdmin || !draft.value.id || saving.value) return
    if (dirty.value) { error.value = '请先保存或放弃当前编辑，再变更权益包状态。'; return }
    if (status === 'disabled') { try { await ElMessageBox.confirm('停用后不能生成新的交付清单，已有清单仍保留。', '停用权益包', { confirmButtonText: '确认停用', cancelButtonText: '取消' }) } catch { return } }
    saving.value = true
    let result: BenefitCommandResult
    try { result = await store.setBenefitPackageStatus(draft.value.id, status, draft.value.revision) }
    catch (problem) { error.value = `状态未保存：${problem instanceof Error ? problem.message : String(problem)}`; return }
    finally { saving.value = false }
    if (!result.ok || !result.package) { error.value = result.message || '状态未保存，可重试。'; return }
    draft.value = cloneBenefit(result.package); original.value = JSON.stringify(draft.value); error.value = ''
  }
  async function reload() {
    if (busy.value) return
    if (unsaved.value) { try { await ElMessageBox.confirm('重新读取会放弃当前未保存的组包及服务弹窗输入。', '读取最新配置', { confirmButtonText: '放弃编辑并读取', cancelButtonText: '继续编辑' }) } catch { return } }
    initialize()
  }
  async function locateIssue(issue: BenefitIssue) {
    membersOpen.value=true;await nextTick()
    if(!issue.skuId&&!issue.serviceId&&draft.value.framework&&issue.groupId){document.querySelector('[data-framework-binding]')?.scrollIntoView({block:'center'});return}
    if (!issue.skuId && !issue.serviceId && (issue.groupId || issue.code.startsWith('group-'))) {
      advancedOpen.value = ['rules']; await nextTick(); await ruleEditor.value?.focusIssue(issue); return
    }
    narrowPane.value = 'contents'; await nextTick()
    const selector = issue.skuId ? `[data-benefit-goods="${CSS.escape(issue.skuId)}"]` : issue.serviceId ? `[data-benefit-service="${CSS.escape(issue.serviceId)}"]` : issue.code.startsWith('quote') ? '.quote-panel' : issue.code.startsWith('device') ? '.device-field' : issue.code === 'name' ? '[data-benefit-name]' : '[data-benefit-contents]'
    const target = document.querySelector<HTMLElement>(selector)
    if (issue.code === 'condition-confirmation') { const details = target?.querySelector('details'); if (details) details.open = true }
    const input = issue.code.includes('quantity') ? target?.querySelector<HTMLElement>('[data-benefit-quantity] input') : undefined
    target?.scrollIntoView({ block: 'center', behavior: 'instant' }); (input || target?.querySelector<HTMLElement>('input,textarea,button'))?.focus({ preventScroll: true })
  }
  async function manageCompatibility(skuId?: string) {
    if (busy.value) return
    if (serviceDirty.value) { error.value = '请先确认或放弃服务弹窗输入，再维护适用关系。'; return }
    editorReturn = { path: route.fullPath, draft: cloneBenefit(draft.value), original: original.value, keyword: keyword.value, type: productTypeId.value, tab: candidateTab.value, quoteText: quoteText.value, quoteError: quoteError.value, notes: { ...conditionNotes.value }, scroll: ['.content', '.candidate-list'].map(selector => ({ selector, top: document.querySelector(selector)?.scrollTop || 0 })) }
    const targetSku = skuId || validation.value.issues.find(issue => issue.skuId)?.skuId || draft.value.goods[0]?.skuId
    allowNextNavigation = true
    await router.push({ path: '/compatibility', query: { ...(targetSku ? { manage: targetSku } : {}), ...(draft.value.device?.kind === 'sku' ? { device: draft.value.device.skuId } : draft.value.device?.kind === 'model' ? { deviceModel: deviceHostKey(draft.value.device.host) } : {}), returnTo: route.fullPath } })
  }
  function requestServiceClose() {
    if (busy.value) return
    if (!serviceDirty.value) { serviceOpen.value = false; return }
    leaveIntent.value = 'service'; leaveOpen.value = true
  }
  const guard = () => {
    if (saving.value || generating.value) return false
    if (store.persistenceState.discardConfirmed) return true
    if (allowNextNavigation) { allowNextNavigation = false; return true }
    if (!unsaved.value || !store.isAdmin) return true
    // Superseded navigation must resolve, otherwise quick back/forward can hang.
    resolveLeave?.(false); resolveLeave = undefined
    leaveIntent.value = 'route'; leaveOpen.value = true
    return new Promise<boolean>(resolve => { resolveLeave = resolve })
  }
  function continueEditing() { leaveOpen.value = false; resolveLeave?.(false); resolveLeave = undefined }
  function discardAndLeave() {
    leaveOpen.value = false; serviceDirty.value = false; serviceOpen.value = false
    if (leaveIntent.value === 'route') { original.value = JSON.stringify(draft.value); quoteError.value = ''; resolveLeave?.(true); resolveLeave = undefined }
  }
  async function saveAndLeave() {
    if (leaving.value) return
    if (serviceDirty.value && !serviceDialog.value?.commit()) {
      error.value = '服务输入尚未完整，已保留。请返回弹窗补全，或明确放弃后离开。'
      continueEditing(); return
    }
    if (leaveIntent.value === 'service') { leaveOpen.value = false; return }
    leaving.value = true
    try { if (await save('draft', false)) { leaveOpen.value = false; resolveLeave?.(true); resolveLeave = undefined } } finally { leaving.value = false }
  }
  onBeforeRouteLeave(guard); onBeforeRouteUpdate(guard)
  const beforeUnload = (event: BeforeUnloadEvent) => { if (unsaved.value && store.isAdmin && !store.persistenceState.discardConfirmed) { event.preventDefault(); event.returnValue = '' } }
  onMounted(() => window.addEventListener('beforeunload', beforeUnload))
  onBeforeUnmount(() => { window.removeEventListener('beforeunload', beforeUnload); resolveLeave?.(false); resolveLeave = undefined })
  return { membersOpen,frameworkId,useFramework,busy, serviceDialog, serviceDirty, requestServiceClose, leaveIntent, ruleEditor, advancedOpen, narrowPane, unsaved, saveAndPreview, locateIssue, manageCompatibility, store, draft, missing, dirty, stale, error, saving, keyword, productTypeId, candidateTab, candidates, allCandidates, commonPackages, types, models, deviceSkus, deviceValue, currentPhone, includedPhone, currentIsIncluded, validation, quoteText, quoteError, serviceOpen, editedService, replaceOpen, replaceSkuId, deviceSwitchOpen, pendingDevice, conditionNotes, deliveryCount, deliveryPreview, deliveryConfirmed, generating, canGenerate, relatedDeliveries, leaveOpen, leaving, addSku, quantity, removeSku, chooseReplacement, replace, requestDevice, finishDeviceSwitch, includePhone, editService, saveService, removeService, updateQuote, reviewQuote, confirmCondition, isConditionConfirmed, save, makeDeliveryPreview, generate, back, useCommon, openDelivery, setStatus, reload, continueEditing, discardAndLeave, saveAndLeave }
}
