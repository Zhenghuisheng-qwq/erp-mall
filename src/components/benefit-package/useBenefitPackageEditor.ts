import { benefitGroupSelection } from '../../domain/benefitPositions'
import { getFailure } from '../../domain/guide/failure'
import type { GuideFailure } from '../../domain/guide/types'
import { resolveBenefitSelection,createBenefitSelectionIndex,previewBenefitFrameworkAdoption } from '../../domain/benefitFrameworks'
import { nextTick, computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useCatalogStore } from '../../stores/catalog'
import { deviceHostKey, listDeviceModels } from '../../domain/deviceResolution'
import { salesDeviceSkus } from '../../domain/salesCatalog'
import { addBenefitSku,removeBenefitPosition,setBenefitPositionQuantity,setBenefitPositionPrice,assignBenefitPositionGroup, benefitSkuSummary, cloneBenefit, confirmBenefitCondition, copyBenefitPackageDraft, newBenefitPackageDraft, parseBenefitAmount, previewBenefitDelivery, replaceBenefitSku, reviewBenefitQuote, setBenefitDevice, setBenefitIncludedPhone, validateBenefitPackage } from '../../domain/benefitPackages'
import type { BenefitCommandResult, BenefitDeviceContext, BenefitDeliveryPreview, BenefitIssue, BenefitPackageDraft, BenefitServiceLine,BenefitReferencePrice } from '../../domain/benefitPackageTypes'
import {referencePriceProblem} from '../../domain/benefitPricing'
import { amountInput, localBenefitRequest } from './benefitPackagePresentation'
import { safeBenefitReturn } from './benefitNavigation'
import BenefitServiceDialog from './BenefitServiceDialog.vue'
import BenefitRuleEditor from './BenefitRuleEditor.vue'
import type {CompositionCandidate} from './BenefitCandidatePanel.vue'

// A bounded in-memory return point, released when the related package is reopened.
// Search/scroll/draft editing never writes business AppData.
let editorReturn: { path: string; draft: BenefitPackageDraft; original: string; keyword: string; type: string; tab: 'recommended' | 'all' | 'common'; quoteText: string; quoteError: string; notes: Record<string, string>; scroll: { selector: string; top: number }[] } | undefined

let previewOnArrival: { path: string; count: number } | undefined

export function useBenefitPackageEditor() {
  const store = useCatalogStore(), route = useRoute(), router = useRouter()
  const inputEpoch=ref(0),draft = ref(newBenefitPackageDraft()), original = ref(''), missing = ref(false)
  const error = ref(''), saving = ref(false), saveRequest = ref('')
  const guideFailure=ref<GuideFailure>()
  watch(error,value=>{if(!value)guideFailure.value=undefined})
  const keyword = ref(''), productTypeId = ref(''), candidateTab = ref<'recommended' | 'all' | 'common'>('recommended')
  const quoteText = ref(''), quoteError = ref(''),referenceErrors=ref<Record<string,string>>({}),quantityErrors=ref<Record<string,string>>({})
  const serviceOpen = ref(false), editedService = ref<BenefitServiceLine>(), serviceDirty = ref(false)
  const serviceDialog = ref<InstanceType<typeof BenefitServiceDialog>>()
  const ruleEditor = ref<InstanceType<typeof BenefitRuleEditor>>()
  const membersOpen=ref(true), frameworkId=ref(''),activeGroupId=ref(''),groupChoiceOpen=ref(false),pendingAddSkuId=ref(''),targetGroupId=ref('')
  const advancedOpen = ref<string[]>([]), narrowPane = ref('candidates')
  const leaveIntent = ref<'route' | 'service'>('route')
  let allowNextNavigation = false
  const replaceOpen = ref(false), replaceLineId = ref(''), replaceSkuId = ref('')
  const deviceSwitchOpen = ref(false), pendingDevice = ref<BenefitDeviceContext>(null)
  const conditionNotes = ref<Record<string, string>>({})
  const deliveryCount = ref(1), deliveryPreview = ref<BenefitDeliveryPreview>(), deliveryConfirmed = ref(false), generating = ref(false), generationRequest = ref('')
  const leaveOpen = ref(false), leaving = ref(false)
  let resolveLeave: ((value: boolean) => void) | undefined
  const selectionIndex=computed(()=>createBenefitSelectionIndex(store.data))
  const validation = computed(() => validateBenefitPackage(store.data,draft.value,selectionIndex.value))
  const dirty = computed(() => JSON.stringify(draft.value) !== original.value || Boolean(quoteError.value)||Object.values(referenceErrors.value).some(Boolean)||Object.values(quantityErrors.value).some(Boolean))
  const busy = computed(() => saving.value || generating.value || leaving.value)
  const unsaved = computed(() => dirty.value || serviceDirty.value)
  const saved = computed(() => store.data.benefitPackages?.find(item => item.id === draft.value.id))
  const stale = computed(() => Boolean(saved.value && saved.value.revision !== draft.value.revision))
  const commonPackages = computed(() => (store.data.benefitPackages || []).filter(item => item.favorite && item.status !== 'disabled'))
  const models = computed(() => listDeviceModels(store.data))
  const deviceSkus = computed(() => salesDeviceSkus(store.data).map(sku => benefitSkuSummary(store.data, sku.id)).filter(item => item !== undefined))
  const frameworkRange=computed(()=>resolveBenefitSelection(store.data,draft.value,selectionIndex.value))
  const allCandidates=computed(()=>frameworkRange.value.rows.map(row=>row.summary))
  const candidateRows=computed<CompositionCandidate[]>(()=>frameworkRange.value.rows.filter(row=>!activeGroupId.value||activeGroupId.value==='$ungrouped'?!activeGroupId.value||!row.allowedGroups.length:row.allowedGroups.some(group=>group.id===activeGroupId.value)).map(row=>{const group=activeGroupId.value&&activeGroupId.value!=='$ungrouped'?activeGroupId.value:undefined,possible=row.allowedGroups.length?row.allowedGroups.some(target=>!frameworkRange.value.reason(row.summary.skuId,target.id,'item')):!frameworkRange.value.reason(row.summary.skuId,null,'item');return {summary:row.summary,basicStatus:row.basic,fastChargeStatus:row.fastCharge,capabilities:row.compatibility.capabilities,reasons:row.compatibility.reasons,recommended:frameworkRange.value.recommendedSkuIds.has(row.summary.skuId),reason:group?frameworkRange.value.reason(row.summary.skuId,group,'item'):row.reason,canAdd:row.canAdd&&(group?!frameworkRange.value.reason(row.summary.skuId,group,'item'):possible),bucket:row.bucket==='recommended'?(row.basic==='compatible'?'confirmed':'pending'):row.bucket,groupIds:row.allowedGroups.map(group=>group.id)}}))
  const candidates=computed(()=>candidateRows.value.filter(row=>(candidateTab.value!=='recommended'||['confirmed','conditional'].includes(row.bucket))&&(!productTypeId.value||row.summary.productTypeId===productTypeId.value)&&(!keyword.value||`${row.summary.name} ${row.summary.code} ${row.summary.spec}`.toLocaleLowerCase().includes(keyword.value.toLocaleLowerCase()))).map(row=>row.summary))
  const types=computed(()=>[...new Map(allCandidates.value.map(item=>[item.productTypeId,{id:item.productTypeId,name:item.typeName}])).values()])
  const selectionGroups=computed(()=>frameworkRange.value.groups)
  const pendingAddGroups=computed(()=>frameworkRange.value.membership(pendingAddSkuId.value))
  function positionGroupName(id:string){const line=draft.value.goods.find(line=>line.id===id);return line?.role==='host'?'主机实物':line?.groupId?selectionGroups.value.find(group=>group.id===line.groupId)?.name||`失效组 ${line.groupId}`:draft.value.compositionVersion===2?'未分组／待指定':'旧版唯一归组'}
  const groupCounts=computed(()=>new Map(selectionGroups.value.map(group=>[group.id,benefitGroupSelection(draft.value,group,skuId=>(draft.value.compositionVersion===2||skuId!==draft.value.includedPhoneSkuId)&&frameworkRange.value.membership(skuId).some(hit=>hit.id===group.id))])))
  const contentGroups=computed(()=>{const result=new Map<string,{key:string;name:string;rows:typeof validation.value.goods}>();for(const row of validation.value.goods){const host=row.line.role==='host'||draft.value.compositionVersion!==2&&row.line.skuId===draft.value.includedPhoneSkuId;const hits=host?[]:frameworkRange.value.membership(row.line.skuId),key=host?'$host':row.line.groupId||(draft.value.compositionVersion!==2&&hits.length===1?hits[0]!.id:'$ungrouped');const name=host?'主机实物':key==='$ungrouped'?'未分组／待指定':selectionGroups.value.find(group=>group.id===key)?.name||`失效组 ${key}`;if(!result.has(key))result.set(key,{key,name,rows:[]});result.get(key)!.rows.push(row)}const order=new Map(selectionGroups.value.map((group,index)=>[group.id,index]));const rank=(key:string)=>key==='$host'?-1:order.get(key)??Number.MAX_SAFE_INTEGER;return [...result.values()].sort((a,b)=>rank(a.key)-rank(b.key))})
  const currentPhone = computed(() => draft.value.device?.kind === 'sku' ? benefitSkuSummary(store.data, draft.value.device.skuId) : undefined)
  const includedPhone = computed(() => draft.value.goods.find(line => line.skuId === draft.value.includedPhoneSkuId&&(draft.value.compositionVersion!==2||line.role==='host'))?.snapshot)
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
  const canGenerate = computed(() => Boolean(draft.value.id && !dirty.value && !stale.value && draft.value.status === 'available' && store.can('product:delivery:create') && !store.persistenceState.external))
  function initialize() {
    inputEpoch.value++
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
    keyword.value = ''; productTypeId.value = '';activeGroupId.value='';groupChoiceOpen.value=false
    draft.value = source ? cloneBenefit(source) : copySource ? copyBenefitPackageDraft(copySource) : newBenefitPackageDraft(device)
    referenceErrors.value={};quantityErrors.value={};quoteText.value = amountInput(draft.value.quote.amountCents); quoteError.value = ''; error.value = ''
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
  watch([quoteError,referenceErrors,quantityErrors],()=>{deliveryPreview.value=undefined;deliveryConfirmed.value=false},{deep:true})
  watch(deliveryCount, () => { deliveryPreview.value = undefined; deliveryConfirmed.value = false; generationRequest.value = '' })
  function change(operation: () => BenefitPackageDraft) {
    if (!store.can(draft.value.id ? 'product:benefit:update' : 'product:benefit:create') || saving.value || generating.value) return
    try {
      const previous = draft.value, next = operation()
      draft.value = next
      // Clear only positions actually removed by a successful command (including host switches).
      const retained = new Set(next.goods.map(line => line.id))
      for (const line of previous.goods) if (!retained.has(line.id)) {
        delete quantityErrors.value[line.id]; delete referenceErrors.value[line.id]
        delete conditionNotes.value[`${line.id}:basic`]; delete conditionNotes.value[`${line.id}:fast-charge`]
      }
      error.value = ''
    }
    catch (problem) { guideFailure.value=getFailure(problem);error.value = problem instanceof Error ? problem.message : String(problem) }
  }
  async function useFramework(){
    if(!store.can(draft.value.id ? 'product:benefit:update' : 'product:benefit:create')||busy.value)return
    if(Object.values(referenceErrors.value).some(Boolean)||Object.values(quantityErrors.value).some(Boolean)){error.value='位置价格或件数有待修正输入，请先处理；框架和全部原输入保留。';return}
    const f=store.data.benefitFrameworks?.find(f=>f.id===frameworkId.value)
    if(frameworkId.value&&!f){error.value='框架已不存在。';return}
    let next:BenefitPackageDraft
    const before=JSON.stringify(draft.value),actor=store.activeUserId,previewActor=store.previewUserId,revision=f?.revision
    try{const preview=previewBenefitFrameworkAdoption(store.data,draft.value,f);next=preview.draft;const lines=[`保留 ${draft.value.goods.length} 个位置、全部服务与独立人工价格。`,`位置待指定：${preview.unassignedPositionIds.length}。`,...preview.issues.map(issue=>issue.message)];await ElMessageBox.confirm(`${f?`采用「${f.name}」修订 ${f.revision}`:'解除框架'}。${lines.join(' ')} 条件确认及报价需要重新核对。`,'框架变更影响预览',{confirmButtonText:'保留位置并采用',cancelButtonText:'取消'})}catch(problem){if(problem instanceof Error)error.value=problem.message;return}
    if(before!==JSON.stringify(draft.value)||actor!==store.activeUserId||previewActor!==store.previewUserId||f&&store.data.benefitFrameworks?.find(item=>item.id===f.id)?.revision!==revision){error.value='框架或编辑上下文已变化，原草稿保留，请重新预览后采用。';return}
    change(()=>next);activeGroupId.value=''
  }
  function addSku(skuId:string){const hits=frameworkRange.value.membership(skuId);if(draft.value.compositionVersion===2&&hits.length>1&&!hits.some(group=>group.id===activeGroupId.value)){pendingAddSkuId.value=skuId;targetGroupId.value='';groupChoiceOpen.value=true;return}const groupId=hits.some(group=>group.id===activeGroupId.value)?activeGroupId.value:hits.length===1?hits[0]!.id:null;change(()=>addBenefitSku(store.data,draft.value,skuId,undefined,{groupId,role:'item',index:selectionIndex.value}))}
  function confirmGroupAdd(){if(!targetGroupId.value)return;const before=draft.value;change(()=>addBenefitSku(store.data,draft.value,pendingAddSkuId.value,undefined,{groupId:targetGroupId.value,role:'item',index:selectionIndex.value}));if(draft.value!==before)groupChoiceOpen.value=false}
  function quantity(lineId:string,value:number){if(!store.can(draft.value.id?'product:benefit:update':'product:benefit:create')||busy.value)return;try{const next=setBenefitPositionQuantity(store.data,draft.value,lineId,value,selectionIndex.value);delete quantityErrors.value[lineId];change(()=>next)}catch(problem){quantityErrors.value[lineId]=problem instanceof Error?problem.message:String(problem);error.value=quantityErrors.value[lineId]!}}
  function referenceValidity(lineId:string,message:string){if(message)referenceErrors.value[lineId]=message;else delete referenceErrors.value[lineId]}
  function setReference(lineId:string,price:BenefitReferencePrice){const problem=referencePriceProblem(price);referenceValidity(lineId,problem);if(!problem)change(()=>setBenefitPositionPrice(draft.value,lineId,price))}
  function assignGroup(lineId:string,groupId:string|null){if(referenceErrors.value[lineId]||quantityErrors.value[lineId]){error.value='请先修正此位置的数量或参考价，原输入和所属组保留。';return}change(()=>assignBenefitPositionGroup(store.data,draft.value,lineId,groupId,selectionIndex.value))}
  async function removeSku(lineId: string) {
    const line = draft.value.goods.find(item => item.id === lineId)
    if (!line || !store.can(draft.value.id ? 'product:benefit:update' : 'product:benefit:create') || busy.value) return
    if (line.skuId === draft.value.includedPhoneSkuId&&(draft.value.compositionVersion!==2||line.role==='host')) { await includePhone(false); return }
    change(()=>removeBenefitPosition(draft.value,lineId))
  }
  function chooseReplacement(lineId: string) {if(referenceErrors.value[lineId]||quantityErrors.value[lineId]){error.value='请先修正此位置的数量或参考价，原输入保留。';return} if (!store.can(draft.value.id ? 'product:benefit:update' : 'product:benefit:create') || saving.value || generating.value) return; replaceLineId.value = lineId; replaceSkuId.value = ''; replaceOpen.value = true }
  function replace() {
    const before = draft.value
    change(() => replaceBenefitSku(store.data, draft.value, replaceLineId.value, replaceSkuId.value,selectionIndex.value))
    if (draft.value !== before) replaceOpen.value = false
  }
  function requestDevice(value: string) {
    if (!store.can(draft.value.id ? 'product:benefit:update' : 'product:benefit:create') || saving.value || generating.value) return
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
    if (!store.can(draft.value.id ? 'product:benefit:update' : 'product:benefit:create') || saving.value || generating.value) return
    if (!value && draft.value.includedPhoneSkuId) {
      try { await ElMessageBox.confirm(`将从实物清单移除「${includedPhone.value?.name || draft.value.includedPhoneSkuId}」。适配设备保持不变。`, '移除包内手机', { confirmButtonText: '确认移除这条手机', cancelButtonText: '保留手机' }) }
      catch { return }
    }
    change(() => setBenefitIncludedPhone(store.data, draft.value, value))
  }
  function editService(service?: BenefitServiceLine) { if (!store.can(draft.value.id ? 'product:benefit:update' : 'product:benefit:create') || busy.value) return; serviceDirty.value = false; editedService.value = service; serviceOpen.value = true }
  function saveService(service: BenefitServiceLine) {
    if (!store.can(draft.value.id ? 'product:benefit:update' : 'product:benefit:create') || saving.value || generating.value) return
    const index = draft.value.services.findIndex(item => item.id === service.id)
    draft.value.services = index < 0 ? [...draft.value.services, cloneBenefit(service)] : draft.value.services.map(item => item.id === service.id ? cloneBenefit(service) : item)
  }
  function removeService(id: string) { if (store.can(draft.value.id ? 'product:benefit:update' : 'product:benefit:create') && !busy.value) draft.value.services = draft.value.services.filter(item => item.id !== id) }
  function updateQuote(value: string | number) {
    if (!store.can(draft.value.id ? 'product:benefit:update' : 'product:benefit:create') || saving.value || generating.value) return
    quoteText.value = String(value)
    try { draft.value.quote.amountCents = parseBenefitAmount(quoteText.value); draft.value.quote.reviewedBasis = ''; quoteError.value = '' }
    catch (problem) { quoteError.value = problem instanceof Error ? problem.message : String(problem) }
  }
  function reviewQuote() { change(() => reviewBenefitQuote(draft.value,store.data,selectionIndex.value)) }
  function confirmCondition(positionId:string,capability:'basic'|'fast-charge'){change(()=>confirmBenefitCondition(store.data,draft.value,positionId,conditionNotes.value[`${positionId}:${capability}`]||'',new Date().toISOString(),capability))}
  function isConditionConfirmed(positionId:string,capability:'basic'|'fast-charge'){const line=draft.value.goods.find(line=>line.id===positionId);return draft.value.confirmations.some(item=>(draft.value.compositionVersion===2?item.positionId===positionId:item.skuId===line?.skuId)&&item.capability===capability&&item.basis===validation.value.basis)}
  async function save(status: 'draft' | 'available', navigate = true) {
    if (serviceDirty.value) { error.value = '服务弹窗还有未确认输入，请先加入服务清单或明确放弃，再保存权益包。'; return false }
    if (saving.value || !store.can(draft.value.id ? 'product:benefit:update' : 'product:benefit:create')) return false
    if (quoteError.value) { error.value = quoteError.value; return false }
    if(Object.values(quantityErrors.value).some(Boolean)){error.value='位置件数还有无效输入，已完整保留；请修正后再保存。';const id=Object.keys(quantityErrors.value)[0];if(id)void locateIssue({code:'position-quantity-input',positionId:id,message:error.value,severity:'error'});return false}
    if(Object.values(referenceErrors.value).some(Boolean)){error.value='人工参考价还有无效输入，已完整保留；请修正位置价格后再保存。';return false}
    // Live references may become invalid without changing the saved package itself.
    if (!dirty.value && draft.value.id && draft.value.status === status && !store.persistenceState.external && (status === 'draft' ? validation.value.canSaveDraft : validation.value.canSaveAvailable)) return true
    saving.value = true
    saveRequest.value ||= localBenefitRequest('save-package')
    let result: BenefitCommandResult
    const actor=store.activeUserId,previewActor=store.previewUserId,path=route.fullPath,stamp=JSON.stringify(draft.value)
    try { result = await store.saveBenefitPackage({ draft: cloneBenefit(draft.value), status, expectedRevision: draft.value.revision, requestId: saveRequest.value },()=>actor===store.activeUserId&&previewActor===store.previewUserId&&path===route.fullPath&&stamp===JSON.stringify(draft.value)&&!Object.values(referenceErrors.value).some(Boolean)&&!Object.values(quantityErrors.value).some(Boolean)) }
    catch (problem) { guideFailure.value=getFailure(problem);error.value = `保存未完成，当前输入已保留：${problem instanceof Error ? problem.message : String(problem)}`; return false }
    finally { saving.value = false }
    if (!result.ok || !result.package) { guideFailure.value=getFailure(result);error.value = result.message || '保存失败，输入已保留，可直接重试。'; const first = result.validation?.issues.find(issue => issue.structural || status === 'available' && issue.severity === 'error'); if (first) void locateIssue(first); return false }
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
    if (generating.value || !store.can('product:delivery:create') || !deliveryPreview.value || !deliveryConfirmed.value || dirty.value) return
    generating.value = true; generationRequest.value ||= localBenefitRequest('delivery-request')
    const preview = deliveryPreview.value
    let result: BenefitCommandResult
    const actor=store.activeUserId,previewActor=store.previewUserId,path=route.fullPath,stamp=JSON.stringify(draft.value),previewStamp=JSON.stringify(preview)
    try { result = await store.generateBenefitDelivery({ packageId: preview.packageId, expectedRevision: preview.sourceRevision, requestId: generationRequest.value, packageCount: preview.packageCount, expectedBasis: preview.basis },()=>actor===store.activeUserId&&previewActor===store.previewUserId&&path===route.fullPath&&stamp===JSON.stringify(draft.value)&&previewStamp===JSON.stringify(deliveryPreview.value)&&deliveryCount.value===preview.packageCount&&deliveryConfirmed.value&&!dirty.value) }
    catch (problem) { guideFailure.value=getFailure(problem);error.value = `清单生成未完成，当前请求已保留：${problem instanceof Error ? problem.message : String(problem)}`; return }
    finally { generating.value = false }
    if (!result.ok || !result.delivery) { guideFailure.value=getFailure(result);error.value = result.message || '清单生成失败，当前预览和请求已保留，请重试。'; return }
    error.value = ''; generationRequest.value = ''; ElMessage.success('交付清单已确认保存')
    await router.push({ path: `/benefit-packages/deliveries/${result.delivery.id}`, query: returnQuery() })
  }
  function returnQuery() { return route.query.returnTo ? { returnTo: safeBenefitReturn(router, route.query.returnTo) } : {} }
  function back() { void router.push(safeBenefitReturn(router, route.query.returnTo)) }
  function useCommon(id: string) { router.push({ path: '/benefit-packages/new', query: { copy: id, ...returnQuery() } }) }
  function openDelivery(id: string) { router.push({ path: `/benefit-packages/deliveries/${id}`, query: returnQuery() }) }
  async function setStatus(status: 'available' | 'disabled') {
    if (!store.can(draft.value.id ? 'product:benefit:update' : 'product:benefit:create') || !draft.value.id || saving.value) return
    if (dirty.value) { error.value = '请先保存或放弃当前编辑，再变更权益包状态。'; return }
    if (status === 'disabled') { try { await ElMessageBox.confirm('停用后不能生成新的交付清单，已有清单仍保留。', '停用权益包', { confirmButtonText: '确认停用', cancelButtonText: '取消' }) } catch { return } }
    saving.value = true
    let result: BenefitCommandResult
    try { result = await store.setBenefitPackageStatus(draft.value.id, status, draft.value.revision) }
    catch (problem) { guideFailure.value=getFailure(problem);error.value = `状态未保存：${problem instanceof Error ? problem.message : String(problem)}`; return }
    finally { saving.value = false }
    if (!result.ok || !result.package) { guideFailure.value=getFailure(result);error.value = result.message || '状态未保存，可重试。'; return }
    draft.value = cloneBenefit(result.package); original.value = JSON.stringify(draft.value); error.value = ''
  }
  async function reload() {
    if (busy.value) return
    if (unsaved.value) { try { await ElMessageBox.confirm('重新读取会放弃当前未保存的组包及服务弹窗输入。', '读取最新配置', { confirmButtonText: '放弃编辑并读取', cancelButtonText: '继续编辑' }) } catch { return } }
    initialize()
  }
  async function locateIssue(issue: BenefitIssue) {
    membersOpen.value=true;await nextTick()
    if(!issue.positionId&&!issue.skuId&&!issue.serviceId&&issue.groupId){activeGroupId.value=issue.groupId;narrowPane.value='candidates';await nextTick();const target=document.querySelector<HTMLElement>(`[data-selection-group="${CSS.escape(issue.groupId)}"]`);if(target){target.scrollIntoView({block:'center'});target.focus({preventScroll:true})}else{const details=document.querySelector<HTMLDetailsElement>('[data-framework-binding] details');if(details)details.open=true;document.querySelector('[data-framework-binding]')?.scrollIntoView({block:'center'})}return}
    if (!issue.skuId && !issue.serviceId && (issue.groupId || issue.code.startsWith('group-'))) {
      advancedOpen.value = ['rules']; await nextTick(); await ruleEditor.value?.focusIssue(issue); return
    }
    narrowPane.value = 'contents'; await nextTick()
    const selector = issue.positionId?`[data-benefit-position="${CSS.escape(issue.positionId)}"]`:issue.skuId ? `[data-benefit-goods="${CSS.escape(issue.skuId)}"]` : issue.serviceId ? `[data-benefit-service="${CSS.escape(issue.serviceId)}"]` : issue.code.startsWith('quote') ? '.quote-panel' : issue.code.startsWith('device') ? '.device-field' : issue.code === 'name' ? '[data-benefit-name]' : '[data-benefit-contents]'
    const target = document.querySelector<HTMLElement>(selector)
    if (issue.code === 'condition-confirmation') { const details = target?.querySelector('details'); if (details) details.open = true }
    const input = issue.code.includes('quantity') ? target?.querySelector<HTMLElement>('[data-benefit-quantity] input') : undefined
    target?.scrollIntoView({ block: 'center', behavior: 'instant' }); (input || target?.querySelector<HTMLElement>('input,textarea,button'))?.focus({ preventScroll: true })
  }
  async function manageCompatibility(skuId?: string) {
    if(!store.can('product:compatibility:read')){error.value='当前身份没有适用关系查看权限，选配草稿保留。';return}
    if (busy.value) return
    if (serviceDirty.value) { error.value = '请先确认或放弃服务弹窗输入，再维护适用关系。'; return }
    if(Object.values(referenceErrors.value).some(Boolean)||Object.values(quantityErrors.value).some(Boolean)){error.value='位置价格或数量还有无效输入，请先修正；当前全部输入保留。';return}
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
    if (!unsaved.value || !store.can(draft.value.id ? 'product:benefit:update' : 'product:benefit:create')) return true
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
  const beforeUnload = (event: BeforeUnloadEvent) => { if (unsaved.value && store.can(draft.value.id ? 'product:benefit:update' : 'product:benefit:create') && !store.persistenceState.discardConfirmed) { event.preventDefault(); event.returnValue = '' } }
  onMounted(() => window.addEventListener('beforeunload', beforeUnload))
  onBeforeUnmount(() => { window.removeEventListener('beforeunload', beforeUnload); resolveLeave?.(false); resolveLeave = undefined })
  return {inputEpoch,quantityErrors,referenceValidity,contentGroups,candidateRows,selectionGroups,groupCounts,positionGroupName,activeGroupId,groupChoiceOpen,pendingAddSkuId,pendingAddGroups,targetGroupId,confirmGroupAdd,assignGroup,setReference,frameworkRange, guideFailure, membersOpen,frameworkId,useFramework,busy, serviceDialog, serviceDirty, requestServiceClose, leaveIntent, ruleEditor, advancedOpen, narrowPane, unsaved, saveAndPreview, locateIssue, manageCompatibility, store, draft, missing, dirty, stale, error, saving, keyword, productTypeId, candidateTab, candidates, allCandidates, commonPackages, types, models, deviceSkus, deviceValue, currentPhone, includedPhone, currentIsIncluded, validation, quoteText, quoteError, serviceOpen, editedService, replaceOpen, replaceSkuId, deviceSwitchOpen, pendingDevice, conditionNotes, deliveryCount, deliveryPreview, deliveryConfirmed, generating, canGenerate, relatedDeliveries, leaveOpen, leaving, addSku, quantity, removeSku, chooseReplacement, replace, requestDevice, finishDeviceSwitch, includePhone, editService, saveService, removeService, updateQuote, reviewQuote, confirmCondition, isConditionConfirmed, save, makeDeliveryPreview, generate, back, useCommon, openDelivery, setStatus, reload, continueEditing, discardAndLeave, saveAndLeave }
}
