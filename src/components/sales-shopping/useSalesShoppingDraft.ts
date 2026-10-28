import { computed, onScopeDispose, ref, watch } from 'vue'
import { useCatalogStore } from '../../stores/catalog'
import { cloneBenefit, copyBenefitPackageDraft, newBenefitPackageDraft, previewBenefitDelivery, validateBenefitPackage } from '../../domain/benefitPackages'
import type { BenefitCommandResult, BenefitDeliveryPreview, BenefitPackageDraft } from '../../domain/benefitPackageTypes'
import {rememberSalesScheme} from './salesShoppingNavigation'
import { localBenefitRequest } from '../benefit-package/benefitPackagePresentation'

function freshDraft(): BenefitPackageDraft {
  return { ...newBenefitPackageDraft(), name: '销售方案', sales: { schemaVersion: 1, origins: [], contexts: [] } }
}
function content(draft: BenefitPackageDraft) {
  const { id: _id, code: _code, revision: _revision, createdAt: _created, updatedAt: _updated, issues: _issues,
    creationRequestId: _request, creationIntent: _intent, saveReceipt: _receipt, saveReceipts: _receipts, ...body } = draft
  return JSON.stringify(body)
}

/** One composition ledger; local edits are immediate and Store writes are serialized. */
export function useSalesShoppingDraft() {
  const store = useCatalogStore(), draft = ref<BenefitPackageDraft>(freshDraft())
  watch(()=>draft.value.id,id=>rememberSalesScheme(store,id),{flush:'sync',immediate:true})
  const saving = ref(false), businessPending = ref(false), error = ref(''), inputError = ref('')
  const missing = ref(false), dirty = ref(false), preview = ref<BenefitDeliveryPreview>()
  const confirmed = ref(false), packageCount = ref(1)
  const supported = computed(() => draft.value.compositionVersion === 2 && (!draft.value.sales || draft.value.sales.schemaVersion === 1) && (!draft.value.framework || ['type-v1', 'type-v2'].includes(draft.value.framework.kind)))
  const canEdit = computed(() => supported.value && store.can('product:sales:read'))
  const canPersist = computed(() => supported.value && store.can(draft.value.id ? 'product:benefit:update' : 'product:benefit:create'))
  const validation = computed(() => validateBenefitPackage(store.data, draft.value))
  const saveState = computed(() => error.value ? 'failed' : saving.value ? 'saving' : dirty.value ? 'queued' : 'saved')
  const saveLabel = computed(() => error.value ? '保存失败 · 修改已保留' : saving.value ? '保存中' : dirty.value ? canPersist.value ? '待保存' : '临时选购 · 当前身份无保存权限' : draft.value.id ? '已保存' : '尚未开始选购')
  let generation = 0, version = 0, acknowledged = 0, alive = true
  let timer: ReturnType<typeof setTimeout> | undefined, running: Promise<boolean> | undefined
  let attempt: { version: number; requestId: string } | undefined, deliveryRequest = ''
  const identity = () => JSON.stringify([store.activeUserId, store.previewUserId])
  const identityDrafts = new Map<string, { draft: BenefitPackageDraft; dirty: boolean; error: string }>()

  function invalidatePreview() { preview.value = undefined; confirmed.value = false; deliveryRequest = '' }
  watch(packageCount, invalidatePreview)
  function schedule() {
    clearTimeout(timer)
    if (alive && dirty.value && canPersist.value && !error.value && !inputError.value)
      timer = setTimeout(() => { void flush() }, 180)
  }
  function change(operation: (current: BenefitPackageDraft) => BenefitPackageDraft, contextOnly=false): boolean {
    if (!canEdit.value || missing.value || businessPending.value) { error.value = '当前不能修改销售方案，请核对权限或等待正式提交完成。'; return false }
    try {
      const next = operation(cloneBenefit(draft.value))
      if (content(next) === content(draft.value)) return true
      next.status = 'draft'
      const transient=contextOnly&&!draft.value.id&&!draft.value.goods.length&&!draft.value.services.length&&!dirty.value
      draft.value = next; version++; invalidatePreview();if(!transient){dirty.value = true;schedule()}
      return true
    } catch (cause) { inputError.value = cause instanceof Error ? cause.message : String(cause); return false }
  }
  function clearInputError() { inputError.value = ''; schedule() }
  async function flush(): Promise<boolean> {
    clearTimeout(timer)
    if (!alive) return false
    if (!dirty.value && !running) return true
    if (missing.value || !canPersist.value || inputError.value) return false
    if (running) { const epoch = generation; const ok = await running; return epoch === generation && (ok || !error.value) ? flush() : false }
    if (error.value) return false
    if (!dirty.value) return true
    const epoch = generation, owner = identity()
    const valid = () => alive && generation === epoch && owner === identity() && canPersist.value
    running = (async () => {
      saving.value = true
      try {
        while (valid() && dirty.value && !inputError.value) {
          const sent = version, candidate = cloneBenefit(draft.value)
          if (!attempt || attempt.version !== sent) attempt = { version: sent, requestId: localBenefitRequest('sales-draft') }
          const result = await store.saveBenefitPackage({ draft: candidate, status: 'draft', expectedRevision: candidate.revision, requestId: attempt.requestId }, valid)
          if (!valid()) return false
          if (!result.ok || !result.package) { error.value = result.message || '保存失败，最新清单已保留，请重试。'; return false }
          const saved = result.package
          if (version === sent) draft.value = cloneBenefit(saved)
          else {
            // Advance identity and optimistic revision only; the newer composition stays intact.
            const latest = draft.value
            draft.value = { ...latest, id: saved.id, code: saved.code, revision: saved.revision, createdAt: saved.createdAt, updatedAt: saved.updatedAt,
              creationRequestId: saved.creationRequestId, creationIntent: saved.creationIntent, saveReceipt: saved.saveReceipt, saveReceipts: cloneBenefit(saved.saveReceipts) }
          }
          acknowledged = sent; dirty.value = version !== acknowledged; attempt = undefined
        }
        return valid() && !dirty.value
      } catch (cause) {
        if (valid()) error.value = cause instanceof Error ? cause.message : '保存失败，最新清单已保留。'
        return false
      } finally { saving.value = false }
    })()
    const task = running
    try { return await task } finally { if (running === task) running = undefined }
  }
  async function retry() { error.value = ''; return flush() }
  async function replaceSession(source?: BenefitPackageDraft, copy = false, discard = false): Promise<boolean> {
    if (copy && source && (source.compositionVersion !== 2 || source.sales && source.sales.schemaVersion !== 1 || source.framework && !['type-v1', 'type-v2'].includes(source.framework.kind))) { inputError.value = '此版本仅支持原样查看，请使用原有高级编辑入口。'; return false }
    if (source && !store.can('product:benefit:read')) { inputError.value = '当前身份没有查看已保存销售方案的权限。'; return false }
    if (businessPending.value || !discard && !await flush()) return false
    generation++; clearTimeout(timer); version = 0; acknowledged = 0; attempt = undefined
    draft.value = source ? cloneBenefit(source) : freshDraft()
    if (copy) {
      draft.value = copyBenefitPackageDraft(draft.value)
      draft.value.favorite = false
      draft.value.sales ??= { schemaVersion: 1, origins: [], contexts: [] }
      version++; dirty.value = true
    } else dirty.value = false
    missing.value = false; error.value = ''; inputError.value = ''; invalidatePreview(); schedule()
    return true
  }
  function loadInitial(id: string) {
    if (!store.can('product:benefit:read')) { missing.value = true; error.value = '销售方案不存在或当前身份不可访问。'; return }
    const source = store.data.benefitPackages?.find(item => item.id === id)
    if (!source) { missing.value = true; error.value = '销售方案不存在或当前身份不可访问。'; return }
    draft.value = cloneBenefit(source); dirty.value = false
  }
  async function prepareDelivery(): Promise<boolean> {
    if (businessPending.value || !store.can('product:delivery:create') || !await flush()) return false
    const epoch = generation, owner = identity(), captured = version
    const valid = () => alive && epoch === generation && owner === identity() && captured === version
    businessPending.value = true
    try {
      const check = validateBenefitPackage(store.data, draft.value)
      if (!check.canSaveAvailable) { inputError.value = check.issues.filter(issue => issue.severity !== 'warning').map(issue => issue.message).join('；'); return false }
      const result = await store.saveBenefitPackage({ draft: cloneBenefit(draft.value), status: 'available', expectedRevision: draft.value.revision, requestId: localBenefitRequest('sales-confirm') }, valid)
      if (!valid()) return false
      if (!result.ok || !result.package) { error.value = result.message || '方案确认失败，清单已保留。'; return false }
      draft.value = cloneBenefit(result.package); preview.value = previewBenefitDelivery(store.data, result.package, packageCount.value); confirmed.value = false; deliveryRequest = ''
      return true
    } catch (cause) { if (valid()) error.value = cause instanceof Error ? cause.message : '方案确认失败。'; return false }
    finally { businessPending.value = false }
  }
  async function generate(): Promise<BenefitCommandResult> {
    const target = preview.value
    if (!target || !confirmed.value || dirty.value || businessPending.value || !store.can('product:delivery:create')) return { ok: false, message: '请先核对交付清单并确认。' }
    const epoch = generation, owner = identity(), captured = version
    const valid = () => alive && epoch === generation && owner === identity() && captured === version && preview.value === target && confirmed.value
    businessPending.value = true; deliveryRequest ||= localBenefitRequest('sales-delivery')
    try {
      const result = await store.generateBenefitDelivery({ packageId: target.packageId, expectedRevision: target.sourceRevision, requestId: deliveryRequest, packageCount: target.packageCount, expectedBasis: target.basis }, valid)
      if (!result.ok && valid()) error.value = result.message || '生成失败，请重新核对后重试。'
      if (result.ok) { error.value = ''; deliveryRequest = '' }
      return result
    } catch (cause) { const message = cause instanceof Error ? cause.message : '生成失败。'; if (valid()) error.value = message; return { ok: false, message } }
    finally { businessPending.value = false }
  }
  watch([() => store.activeUserId, () => store.previewUserId, canPersist], ([owner, previewActor], [previousOwner, previousPreview]) => {
    generation++; clearTimeout(timer); attempt = undefined; invalidatePreview()
    if (owner !== previousOwner || previewActor !== previousPreview) {
      identityDrafts.set(JSON.stringify([previousOwner, previousPreview]), { draft: cloneBenefit(draft.value), dirty: dirty.value, error: error.value })
      const kept = identityDrafts.get(identity())
      draft.value = kept?.draft ?? freshDraft(); dirty.value = kept?.dirty ?? false
      error.value = kept?.error || (dirty.value ? '已恢复此身份的最新清单，请核对后重试保存。' : '')
      missing.value = false; inputError.value = ''; version++; acknowledged = dirty.value ? version - 1 : version
    } else if (dirty.value) error.value = '保存权限已变化，最新清单已保留；恢复权限后可重试。'
  }, { flush: 'sync' })
  onScopeDispose(() => { alive = false; generation++; clearTimeout(timer) })
  return { store, draft, validation, saving, businessPending, dirty, error, inputError, missing, canEdit, canPersist, saveState, saveLabel,
    preview, confirmed, packageCount, change, clearInputError, flush, retry, replaceSession, loadInitial, prepareDelivery, generate }
}
