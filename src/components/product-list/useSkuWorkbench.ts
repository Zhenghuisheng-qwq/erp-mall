import {getFailure} from '../../domain/guide/failure'
import type {GuideFailure} from '../../domain/guide/types'
import { repairQuickFilters } from '../../domain/skuQuickFilters'
import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { useCatalogStore, uid, catalogMigrationError } from '../../stores/catalog'
import { addScopeCondition, cloneSku, configFromLegacy, createSkuSavedView, defaultSkuConfig, ensureSkuWorkbench, skuConfigStamp, SYSTEM_SKU_VIEW_ID } from '../../domain/skuWorkbenchState'
import type { SkuCommandResult } from '../../domain/skuWorkbenchState'
import type { ProductListPageState } from '../../domain/types'
import type { SkuViewConfig } from '../../domain/skuWorkbenchTypes'
import type { ListManualGuard } from '../../domain/listManualCommit'
import { validateSkuConfig } from '../../domain/skuWorkbenchQuery'

let enteredSkuWorkbench = false

/** Saved rules live in the SKU page. Applied work is independent; dialogs own their own drafts. */
export function useSkuWorkbench(scopeId: Readonly<Ref<string>>) {
  const store = useCatalogStore()
  ensureSkuWorkbench(store.data)
  const pageData = computed(() => store.data.productListPages?.sku)
  const state = computed(() => {
    const value = pageData.value?.skuWorkbench
    if (!value) throw new Error('SKU 工作台配置未初始化。')
    return value
  })
  const error = ref(catalogMigrationError())
  const guideFailure=ref<GuideFailure>()
  watch(error,value=>{if(!value)guideFailure.value=undefined})
  const pending = ref(false)
  const localWork = ref<Record<string, SkuViewConfig>>(cloneSku(state.value?.working || {}))
  const navigation = typeof performance === 'undefined' ? undefined : performance.getEntriesByType('navigation')[0]
  const reloadSku = navigation && 'type' in navigation && navigation.type === 'reload' && new URL(navigation.name).pathname === '/skus'
  const initial = enteredSkuWorkbench || reloadSku ? state.value.activeId : state.value.defaultId
  enteredSkuWorkbench = true
  const activeId = ref(scopeId.value ? SYSTEM_SKU_VIEW_ID : initial)
  const workingKey = computed(() => activeId.value === SYSTEM_SKU_VIEW_ID && scopeId.value ? `${SYSTEM_SKU_VIEW_ID}@spu:${scopeId.value}` : activeId.value)
  const views = computed(() => {
    const order = state.value?.order || []
    return [...(pageData.value?.views || [])].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
  })
  const currentView = computed(() => {
    const value = views.value.find(view => view.id === activeId.value) || views.value.find(view => view.id === SYSTEM_SKU_VIEW_ID)
    if (!value) throw new Error('SKU 系统视图不存在。')
    return value
  })
  const savedConfig = computed(() => currentView.value ? configFromLegacy(currentView.value, store.data) : defaultSkuConfig())
  const config = computed(() => localWork.value[workingKey.value] || savedConfig.value)
  const dirty = computed(() => skuConfigStamp(config.value) !== skuConfigStamp(savedConfig.value))

  async function commit(next: ProductListPageState, isCurrent?:()=>boolean, manualGuard?:ListManualGuard): Promise<SkuCommandResult> {
    if (pending.value) return { ok: false, message: '上一项视图操作正在保存，请完成后重试；当前工作配置保留。' }
    const owner=store.activeUserId,preview=store.previewUserId,key=workingKey.value
    pending.value = true
    try {
      const result = await store.commitSkuPage(next,()=>owner===store.activeUserId&&preview===store.previewUserId&&key===workingKey.value&&(!isCurrent||isCurrent()),manualGuard)
      if (!result.ok) { guideFailure.value=getFailure(result);error.value = result.message; return result }
      error.value = ''
      return { ok: true }
    } catch(cause) { guideFailure.value=getFailure(cause);error.value=cause instanceof Error?cause.message:'视图保存失败，当前配置保留。';return {ok:false,message:error.value} } finally { pending.value = false }
  }
  function trial(): ProductListPageState | undefined {
    const page = pageData.value
    return page ? cloneSku(page) : undefined
  }
  function missing(): SkuCommandResult { const message = 'SKU 视图配置尚未初始化，请重新打开页面。'; error.value = message; return { ok: false, message } }
  function syncWork(next: ProductListPageState) {
    if (next.skuWorkbench) next.skuWorkbench.working = cloneSku(localWork.value)
  }
  async function apply(nextConfig: SkuViewConfig,isCurrent?:()=>boolean,manualGuard?:ListManualGuard): Promise<SkuCommandResult> {
    if (pending.value) return { ok: false, message: '上一项操作尚未完成，请重试。' }
    nextConfig = { ...nextConfig, quickFilters: repairQuickFilters(nextConfig) }
    const errors = validateSkuConfig(store.data, nextConfig)
    if (errors.length) { error.value = errors.join('；'); return { ok: false, message: error.value } }
    const candidate=cloneSku(nextConfig),key=workingKey.value
    const next = trial()
    if (!next?.skuWorkbench) return missing()
    syncWork(next)
    next.skuWorkbench.working[key]=candidate
    const result=await commit(next,isCurrent,manualGuard)
    if(result.ok)localWork.value[key]=candidate
    return result
  }
  async function select(id: string): Promise<SkuCommandResult> {
    if (!views.value.some(view => view.id === id)) return { ok: false, message: '找不到这个视图。' }
    if (pending.value) return { ok: false, message: '上一项操作尚未完成，请重试。' }
    const next = trial()
    if (!next?.skuWorkbench) return missing()
    syncWork(next)
    if (!scopeId.value) { next.activeId = id; next.skuWorkbench.activeId = id }
    const result = await commit(next)
    if (result.ok) activeId.value = id
    return result
  }
  async function restore(): Promise<SkuCommandResult> {
    const key = workingKey.value
    const next = trial()
    if (!next?.skuWorkbench) return missing()
    syncWork(next)
    delete next.skuWorkbench.working[key]
    const result = await commit(next)
    if (result.ok) delete localWork.value[key]
    return result
  }
  function nameError(name: string, except = '') {
    const text = name.trim()
    if (!text) return '请填写视图名称。'
    if (views.value.some(view => view.id !== except && view.name === text)) return '已经有同名视图，请使用其他名称。'
    return ''
  }
  async function create(name: string, includeScope = false, resetLayout = false): Promise<SkuCommandResult> {
    const invalid = nameError(name)
    if (invalid) return { ok: false, message: invalid }
    const next = trial()
    if (!next?.skuWorkbench) return missing()
    let id = uid('sku-view')
    while (next.views.some(view => view.id === id)) id = uid('sku-view')
    const current = includeScope && scopeId.value ? addScopeCondition(config.value, scopeId.value) : cloneSku(config.value)
    if(resetLayout)current.categoryLayout='popover'
    const errors = validateSkuConfig(store.data, current)
    if (errors.length) { error.value = errors.join('；'); return { ok: false, message: error.value } }
    next.views.push(createSkuSavedView(id, name.trim(), current, currentView.value))
    next.skuWorkbench.order.push(id)
    syncWork(next)
    if (!scopeId.value) { next.activeId = id; next.skuWorkbench.activeId = id }
    const result = await commit(next)
    if (result.ok) activeId.value = id
    return result.ok ? { ok: true, id } : result
  }
  async function save(name?: string, includeScope = false): Promise<SkuCommandResult> {
    if (name !== undefined) return create(name, includeScope)
    if (activeId.value === SYSTEM_SKU_VIEW_ID) return { ok: false, message: '全部 SKU 为系统视图，请另存为自己的视图。' }
    const errors = validateSkuConfig(store.data, config.value)
    if (errors.length) { error.value = errors.join('；'); return { ok: false, message: error.value } }
    const key = workingKey.value
    const next = trial()
    const view = next?.views.find(item => item.id === activeId.value)
    if (!next?.skuWorkbench || !view) return missing()
    view.skuWorkbench = cloneSku(config.value)
    view.updatedAt = new Date().toISOString()
    syncWork(next)
    delete next.skuWorkbench.working[activeId.value]
    const result = await commit(next)
    if (result.ok) delete localWork.value[key]
    return result
  }
  async function rename(id: string, name: string): Promise<SkuCommandResult> {
    if (id === SYSTEM_SKU_VIEW_ID) return { ok: false, message: '系统视图不能重命名。' }
    const invalid = nameError(name, id)
    if (invalid) return { ok: false, message: invalid }
    const next = trial(), view = next?.views.find(item => item.id === id)
    if (!next || !view) return missing()
    view.name = name.trim(); view.updatedAt = new Date().toISOString()
    syncWork(next)
    return commit(next)
  }
  async function copy(id: string): Promise<SkuCommandResult> {
    const source = views.value.find(view => view.id === id)
    if (!source) return { ok: false, message: '找不到这个视图。' }
    const next = trial()
    if (!next?.skuWorkbench) return missing()
    let name = `${source.name} 副本`, index = 2
    while (views.value.some(view => view.name === name)) name = `${source.name} 副本 ${index++}`
    let newId = uid('sku-view')
    while (next.views.some(view => view.id === newId)) newId = uid('sku-view')
    next.views.push(createSkuSavedView(newId, name, configFromLegacy(source, store.data), source))
    next.skuWorkbench.order.push(newId)
    syncWork(next)
    if (!scopeId.value) { next.activeId = newId; next.skuWorkbench.activeId = newId }
    const result = await commit(next)
    if (result.ok) activeId.value = newId
    return result.ok ? { ok: true, id: newId } : result
  }
  async function remove(id: string): Promise<SkuCommandResult> {
    if (id === SYSTEM_SKU_VIEW_ID) return { ok: false, message: '系统视图不能删除。' }
    const next = trial()
    if (!next?.skuWorkbench) return missing()
    next.views = next.views.filter(view => view.id !== id)
    next.skuWorkbench.favorites = next.skuWorkbench.favorites.filter(value => value !== id)
    next.skuWorkbench.order = next.skuWorkbench.order.filter(value => value !== id)
    if (next.skuWorkbench.defaultId === id) next.skuWorkbench.defaultId = SYSTEM_SKU_VIEW_ID
    if (next.skuWorkbench.activeId === id) { next.skuWorkbench.activeId = next.skuWorkbench.defaultId; next.activeId = next.skuWorkbench.defaultId }
    syncWork(next)
    delete next.skuWorkbench.working[id]
    const result = await commit(next)
    if (result.ok) { delete localWork.value[id]; if (activeId.value === id) activeId.value = next.skuWorkbench.defaultId }
    return result
  }
  async function preference(update: (next: NonNullable<ProductListPageState['skuWorkbench']>) => void): Promise<SkuCommandResult> {
    const next = trial()
    if (!next?.skuWorkbench) return missing()
    syncWork(next); update(next.skuWorkbench)
    return commit(next)
  }
  async function favorite(id: string): Promise<SkuCommandResult> {
    return preference(next => { next.favorites = next.favorites.includes(id) ? next.favorites.filter(value => value !== id) : [...next.favorites, id] })
  }
  async function setDefault(id: string): Promise<SkuCommandResult> { return views.value.some(view => view.id === id) ? preference(next => { next.defaultId = id }) : { ok: false, message: '找不到这个视图。' } }
  async function moveFavorite(id: string, delta: number): Promise<SkuCommandResult> {
    if (id === SYSTEM_SKU_VIEW_ID || !state.value.favorites.includes(id)) return { ok: false, message: '请先收藏一个自定义视图。' }
    return preference(next => {
      const favorites = next.order.filter(value => value !== SYSTEM_SKU_VIEW_ID && next.favorites.includes(value))
      const index = favorites.indexOf(id), neighbor = favorites[index + delta]
      if (index < 0 || !neighbor) return
      const source = next.order.indexOf(id), target = next.order.indexOf(neighbor)
      next.order[source] = neighbor
      next.order[target] = id
    })
  }
  watch(scopeId, id => { activeId.value = id ? SYSTEM_SKU_VIEW_ID : state.value?.activeId || SYSTEM_SKU_VIEW_ID })
  if (!scopeId.value && activeId.value !== state.value.activeId) select(activeId.value)
  return { guideFailure, views, currentView, activeId, config, dirty, error, pending, state, select, apply, save, create, rename, copy, remove, favorite, setDefault, moveFavorite, restore }
}
