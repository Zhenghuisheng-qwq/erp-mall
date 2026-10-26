import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import { useCatalogStore } from '../../stores/catalog'
import type { ProductListMode, ProductListPageState } from '../../domain/types'
import type { ListManualGuard } from '../../domain/listManualCommit'

const clone = (page: ProductListPageState): ProductListPageState => JSON.parse(JSON.stringify(page))

/** The page draft is immediate; only acknowledged, atomic Store writes advance the baseline. */
export function useProductListPageDraft(mode: ProductListMode, temporary: Ref<ProductListPageState | undefined>) {
  const store = useCatalogStore()
  const persisted = () => store.data.productListPages![mode]
  const pageDraft = ref(clone(persisted()))
  const savedPageStamp = ref(JSON.stringify(persisted()))
  const draftStamp = computed(() => JSON.stringify(pageDraft.value))
  const draftDirty = computed(() => draftStamp.value !== savedPageStamp.value)
  const pageSaving = ref(false), saveError = ref('')
  const canSaveView = computed(() => store.can('product:view:update'))
  const identity = computed(() => JSON.stringify([store.activeUserId, store.previewUserId]))
  // Drafts never migrate to another operator. Switching back can recover an unsaved draft.
  const retained = new Map<string, { page: ProductListPageState; baseline: string; error: string }>()
  let alive = true, generation = 0, revision = 0, ownWrite = false
  let timer: ReturnType<typeof setTimeout> | undefined, running: Promise<boolean> | undefined
  const saveStatus = computed(() => saveError.value ? '保存失败 · 最新修改已保留' : !canSaveView.value ? '临时查询 · 当前身份不保存视图' : pageSaving.value ? '保存中' : draftDirty.value ? '待保存' : '已保存')

  function schedule() {
    clearTimeout(timer)
    if (alive && !temporary.value && canSaveView.value && !saveError.value && draftDirty.value)
      timer = setTimeout(() => { void persistPage() }, 180)
  }
  watch(pageDraft, () => { revision++; schedule() }, { deep: true, flush: 'sync' })

  async function persistPage(): Promise<boolean> {
    clearTimeout(timer)
    if (!alive) return false
    if (temporary.value || !canSaveView.value) return true
    if (running) {
      const epoch = generation
      const result = await running
      if (!alive || epoch !== generation) return false
      return result || !saveError.value ? persistPage() : false
    }
    if (saveError.value) return false
    if (!draftDirty.value) return true
    if (pageSaving.value) return false // A guarded manual transaction will reschedule the draft.
    const epoch = generation, owner = identity.value
    const current = () => alive && generation === epoch && identity.value === owner && canSaveView.value && !temporary.value
    // One drain owns the Store queue. Edits made while a write is waiting are coalesced
    // into the next snapshot, including all views, fields and clear intentions.
    running = (async () => {
      pageSaving.value = true
      try {
        while (current() && draftDirty.value) {
          const next = clone(pageDraft.value), expected = savedPageStamp.value
          ownWrite = true
          const result = mode === 'spu'
            ? await store.commitSpuPage(next, expected, current)
            : await store.commitSkuPage(next, () => current() && JSON.stringify(persisted()) === expected)
          ownWrite = false
          if (!current()) return false
          if (!result.ok) { saveError.value = result.message || '视图设置没有写入本机。'; return false }
          savedPageStamp.value = JSON.stringify(persisted())
          // Never assign the old response to pageDraft: it may already contain newer input.
        }
        return current()
      } catch (cause) {
        if (current()) saveError.value = cause instanceof Error ? cause.message : '视图设置保存失败。'
        return false
      } finally { ownWrite = false; pageSaving.value = false }
    })()
    const task = running
    try { return await task } finally { if (running === task) running = undefined }
  }

  async function retryPageSave() { saveError.value = ''; return persistPage() }

  /** Manual order remains a guarded transaction, separate from reversible browsing edits. */
  async function commitProtected(next: ProductListPageState, isCurrent: () => boolean, guard: ListManualGuard) {
    clearTimeout(timer)
    const epoch = generation, version = revision, owner = identity.value
    const current = () => alive && epoch === generation && version === revision && owner === identity.value && isCurrent()
    pageSaving.value = true; ownWrite = true
    try {
      const expected = savedPageStamp.value
      const result = mode === 'spu'
        ? await store.commitSpuPage(next, expected, current, guard)
        : await store.commitSkuPage(next, () => current() && JSON.stringify(persisted()) === expected, guard)
      if (result.ok && current()) {
        savedPageStamp.value = JSON.stringify(persisted())
        pageDraft.value = clone(persisted())
        saveError.value = ''
      }
      return result
    } finally { pageSaving.value = false; ownWrite = false; schedule() }
  }

  watch(() => JSON.stringify(persisted()), stamp => {
    if (ownWrite || stamp === savedPageStamp.value) return
    if (!draftDirty.value) { savedPageStamp.value = stamp; pageDraft.value = clone(persisted()) }
    else saveError.value = '已保存的视图由其他操作更新，本页输入未覆盖；请先核对当前设置。'
  }, { flush: 'sync' })
  watch(identity, (next, previous) => {
    if (draftDirty.value || saveError.value) retained.set(previous, { page: clone(pageDraft.value), baseline: savedPageStamp.value, error: saveError.value })
    else retained.delete(previous)
    generation++; clearTimeout(timer)
    const kept = retained.get(next)
    savedPageStamp.value = kept?.baseline ?? JSON.stringify(persisted())
    saveError.value = kept ? kept.error || '已恢复此身份的本地修改，请核对后重试保存。' : ''
    pageDraft.value = kept?.page ?? clone(persisted())
  }, { flush: 'sync' })
  watch(canSaveView, allowed => {
    if (!allowed) { generation++; clearTimeout(timer); if (draftDirty.value) saveError.value = '保存权限已变化，最新修改保留；恢复权限后可重试。' }
    else schedule()
  }, { flush: 'sync' })
  watch(temporary, () => { generation++; clearTimeout(timer) }, { flush: 'sync' })
  onScopeDispose(() => { alive = false; generation++; clearTimeout(timer) })
  return { pageDraft, savedPageStamp, draftDirty, pageSaving, saveError, canSaveView, saveStatus, persistPage, retryPageSave, commitProtected }
}
