import {getFailure} from '../../domain/guide/failure'
import type {GuideFailure} from '../../domain/guide/types'
import { repairQuickFilters } from '../../domain/skuQuickFilters'
import { computed, onScopeDispose, reactive, ref, watch } from 'vue'
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
  const saving = ref(false), commandPending = ref(false), queued = ref(false)
  const pending = computed(() => saving.value || commandPending.value)
  const saveState = computed(() => error.value ? 'failed' : saving.value || commandPending.value ? 'saving' : queued.value ? 'queued' : 'saved')
  const localWork = ref<Record<string, SkuViewConfig>>(cloneSku(state.value?.working || {}))
  const navigation = typeof performance === 'undefined' ? undefined : performance.getEntriesByType('navigation')[0]
  const reloadSku = navigation && 'type' in navigation && navigation.type === 'reload' && new URL(navigation.name).pathname === '/skus'
  const initial = enteredSkuWorkbench || reloadSku ? state.value.activeId : state.value.defaultId
  enteredSkuWorkbench = true
  const activeId = ref(scopeId.value ? SYSTEM_SKU_VIEW_ID : initial)
  const globalActiveId=ref(initial)
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
  const config = computed(() => revisions.has(workingKey.value) ? localWork.value[workingKey.value] || savedConfig.value : state.value.working[workingKey.value] || savedConfig.value)
  const dirty = computed(() => skuConfigStamp(config.value) !== skuConfigStamp(savedConfig.value))

  // Work drafts never alias Store data. Only revisions belonging to this identity
  // are overlaid onto a fresh page when their serialized write actually starts.
  let generation = 0, revision = 0, disposed = false, scheduled = false, commandWriting = false, blocked = false
  const revisions = reactive(new Map<string, number>()), baselines=new Map<string,string>()
  function persistedWorkStamp(key:string,page=pageData.value){
    const id=key.startsWith(`${SYSTEM_SKU_VIEW_ID}@spu:`)?SYSTEM_SKU_VIEW_ID:key
    const view=page?.views.find(item=>item.id===id)
    return JSON.stringify([view?.id,view?.skuWorkbench,page?.skuWorkbench?.working[key]])
  }
  const queryEdits=ref<Partial<ProductListPageState['query']>>({})
  let queryRevision=0,queryTimer:ReturnType<typeof setTimeout>|undefined
  const query=computed(()=>({...pageData.value!.query,...queryEdits.value}))
  function updateQuery(patch:Partial<ProductListPageState['query']>){
    if(disposed||!store.can('product:sku:read'))return
    if(Object.entries(patch).every(([key,value])=>query.value[key as keyof typeof patch]===value))return
    queryEdits.value={...queryEdits.value,...patch};queryRevision=++revision;refreshQueued()
    if(queryTimer)clearTimeout(queryTimer)
    queryTimer=setTimeout(()=>{queryTimer=undefined;requestSave()},180)
  }
  let selection: { id: string; revision: number } | undefined
  let waiters: ((result: SkuCommandResult) => void)[] = []
  function finish(result: SkuCommandResult) { const current = waiters; waiters = []; current.forEach(resolve => resolve(result)) }
  function context() { const owner=store.activeUserId, preview=store.previewUserId, epoch=generation; return () => !disposed && epoch===generation && owner===store.activeUserId && preview===store.previewUserId && store.can('product:sku:read') }
  function failure(result: SkuCommandResult | {message?:string}) { guideFailure.value=getFailure(result); error.value=('message' in result ? result.message : '') || '保存失败，最新工作配置已保留，请重试。'; blocked=true }
  function refreshQueued() { queued.value=!!revisions.size || !!selection || !!queryRevision }
  function requestSave() {
    refreshQueued()
    if (scheduled || saving.value || commandWriting || blocked || disposed || !queued.value || queryTimer&&!revisions.size&&!selection) return
    scheduled=true
    queueMicrotask(() => { scheduled=false; void drain() })
  }
  async function drain() {
    if (saving.value || commandWriting || blocked || disposed || !queued.value) return
    const valid=context(), next=trial(), sent=new Map(revisions), selected=selection, sentQuery=queryRevision, queryPatch=cloneSku(queryEdits.value)
    if (!next?.skuWorkbench) { failure(missing()); finish({ok:false,message:error.value}); return }
    if([...sent.keys()].some(key=>baselines.get(key)!==persistedWorkStamp(key,next))){
      const result={ok:false as const,message:'此视图的工作配置已由其他操作更新，本次未覆盖；当前草稿已保留，请重新读取并核对最新配置。'}
      failure(result);finish(result);return
    }
    for (const key of sent.keys()) {
      const value=localWork.value[key]
      if(value) next.skuWorkbench.working[key]=cloneSku(value)
      else delete next.skuWorkbench.working[key]
    }
    if(sentQuery)next.query={...next.query,...queryPatch}
    if(selected){next.activeId=selected.id;next.skuWorkbench.activeId=selected.id}
    saving.value=true
    try {
      const result=await store.commitSkuPage(next,valid)
      if(!valid())return
      if(!result.ok){failure(result);finish(result);return}
      for(const [key,version] of sent){
        if(revisions.get(key)===version){revisions.delete(key);baselines.delete(key)}
        else baselines.set(key,persistedWorkStamp(key,next))
      }
      if(selection?.revision===selected?.revision)selection=undefined
      if(queryRevision===sentQuery){queryRevision=0;queryEdits.value={}}
      error.value=''; refreshQueued()
      if(!queued.value)finish({ok:true})
    } catch(cause) { if(valid()){failure({message:cause instanceof Error?cause.message:'保存失败，请重试。'});finish({ok:false,message:error.value})} }
    finally {saving.value=false;requestSave()}
  }
  function flush(): Promise<SkuCommandResult> {
    if(queryTimer){clearTimeout(queryTimer);queryTimer=undefined}
    if(disposed)return Promise.resolve({ok:false,message:'页面已关闭。'})
    if(blocked)return Promise.resolve({ok:false,message:error.value})
    if(!queued.value&&!saving.value)return Promise.resolve({ok:true})
    const promise=new Promise<SkuCommandResult>(resolve=>waiters.push(resolve));requestSave();return promise
  }
  function retry() {
    if(disposed||!store.can('product:sku:read'))return Promise.resolve({ok:false as const,message:'当前没有保存工作配置的权限，草稿已保留。'})
    blocked=false;error.value='';requestSave();return flush()
  }
  type RetainedWork={work:Record<string,SkuViewConfig>;versions:Map<string,number>;bases:Map<string,string>;selection:typeof selection;query:Partial<ProductListPageState['query']>;queryRevision:number}
  const identityDrafts=new Map<string,RetainedWork>()
  watch([()=>store.activeUserId,()=>store.previewUserId,()=>store.can('product:sku:read')],([owner,preview],[oldOwner,oldPreview])=>{
    generation++
    if(queryTimer){clearTimeout(queryTimer);queryTimer=undefined}
    const changed=owner!==oldOwner||preview!==oldPreview
    if(changed){
      const oldKey=JSON.stringify([oldOwner,oldPreview]),newKey=JSON.stringify([owner,preview])
      if(queued.value)identityDrafts.set(oldKey,{work:cloneSku(localWork.value),versions:new Map(revisions),bases:new Map(baselines),selection,query:cloneSku(queryEdits.value),queryRevision})
      else identityDrafts.delete(oldKey)
      const retained=identityDrafts.get(newKey)
      localWork.value=retained?.work||cloneSku(state.value.working)
      revisions.clear();for(const [key,value] of retained?.versions||[])revisions.set(key,value)
      baselines.clear();for(const [key,value] of retained?.bases||[])baselines.set(key,value)
      selection=retained?.selection;queryRevision=retained?.queryRevision||0;queryEdits.value=retained?.query||{}
    }
    refreshQueued();blocked=queued.value
    finish({ok:false,message:'操作者或授权已变化，旧任务已停止，草稿已保留。'})
    error.value=queued.value?'操作者或授权已变化，草稿已保留；请核对后重试保存。':''
  },{flush:'sync'})
  onScopeDispose(()=>{disposed=true;generation++;if(queryTimer)clearTimeout(queryTimer);finish({ok:false,message:'页面已关闭，未提交任务已停止。'})})
  async function exclusive(action:()=>Promise<SkuCommandResult>):Promise<SkuCommandResult>{
    if(commandPending.value)return {ok:false,message:'上一项视图操作正在保存，请完成后重试。'}
    const valid=context(),key=workingKey.value
    commandPending.value=true
    try {
      const settled=await flush();if(!settled.ok)return settled
      if(!valid()||key!==workingKey.value)return {ok:false,message:'视图或操作者已变化，本次操作未提交。'}
      commandWriting=true
      return await action()
    }finally{commandWriting=false;commandPending.value=false;requestSave()}
  }
  async function commit(next: ProductListPageState, isCurrent?:()=>boolean, manualGuard?:ListManualGuard): Promise<SkuCommandResult> {
    const valid=context(),key=workingKey.value,before=trial()
    try {
      const result = await store.commitSkuPage(next,()=>valid()&&key===workingKey.value&&(!isCurrent||isCurrent()),manualGuard)
      if(!valid())return {ok:false,message:'操作者或页面已变化，旧任务已停止。'}
      if (!result.ok) { guideFailure.value=getFailure(result);error.value = result.message; return result }
      for(const key of revisions.keys())if(baselines.get(key)===persistedWorkStamp(key,before))baselines.set(key,persistedWorkStamp(key,next))
      error.value = ''
      return { ok: true }
    } catch(cause) { if(!valid())return {ok:false,message:'操作者或页面已变化，旧任务已停止。'};guideFailure.value=getFailure(cause);error.value=cause instanceof Error?cause.message:'视图保存失败，当前配置保留。';return {ok:false,message:error.value} }
  }
  function trial(): ProductListPageState | undefined {
    const page = pageData.value
    return page ? cloneSku(page) : undefined
  }
  function missing(): SkuCommandResult { const message = 'SKU 视图配置尚未初始化，请重新打开页面。'; error.value = message; return { ok: false, message } }
  function syncWork(next: ProductListPageState) {
    if (!next.skuWorkbench) return
    for(const key of revisions.keys())if(localWork.value[key])next.skuWorkbench.working[key]=cloneSku(localWork.value[key])
  }
  function update(nextConfig:SkuViewConfig):SkuCommandResult {
    if(disposed||!store.can('product:sku:read'))return {ok:false,message:'当前没有保存工作配置的权限。'}
    nextConfig={...nextConfig,quickFilters:repairQuickFilters(nextConfig)}
    if(JSON.stringify(nextConfig)===JSON.stringify(config.value))return {ok:true}
    const errors=validateSkuConfig(store.data,nextConfig)
    if(errors.length){error.value=errors.join('；');return {ok:false,message:error.value}}
    const key=workingKey.value
    if(!revisions.has(key))baselines.set(key,persistedWorkStamp(key))
    localWork.value[key]=cloneSku(nextConfig);revisions.set(key,++revision);requestSave()
    return {ok:true}
  }
  async function apply(nextConfig: SkuViewConfig,isCurrent?:()=>boolean,manualGuard?:ListManualGuard): Promise<SkuCommandResult> {
    if(manualGuard||isCurrent)return exclusive(async()=>{
      const candidate=cloneSku(nextConfig),key=workingKey.value,prior=JSON.stringify(config.value),next=trial()
      if(!next?.skuWorkbench)return missing()
      next.skuWorkbench.working[key]=candidate
      const result=await commit(next,()=>JSON.stringify(config.value)===prior&&(!isCurrent||isCurrent()),manualGuard)
      if(result.ok)localWork.value[key]=candidate
      return result
    })
    const accepted=update(nextConfig)
    if(!accepted.ok)return accepted
    return flush()
  }
  function select(id: string): Promise<SkuCommandResult> {
    if (!views.value.some(view => view.id === id)) return Promise.resolve({ ok: false, message: '找不到这个视图。' })
    if(disposed||!store.can('product:sku:read'))return Promise.resolve({ok:false,message:'当前没有保存工作配置的权限。'})
    activeId.value=id
    if(!scopeId.value){globalActiveId.value=id;selection={id,revision:++revision};requestSave()}
    return Promise.resolve({ok:true})
  }
  async function restoreCommand(): Promise<SkuCommandResult> {
    const key = workingKey.value
    const next = trial()
    if (!next?.skuWorkbench) return missing()
    syncWork(next)
    delete next.skuWorkbench.working[key]
    const result = await commit(next)
    if (result.ok && !revisions.has(key)) delete localWork.value[key]
    return result
  }
  function nameError(name: string, except = '') {
    const text = name.trim()
    if (!text) return '请填写视图名称。'
    if (views.value.some(view => view.id !== except && view.name === text)) return '已经有同名视图，请使用其他名称。'
    return ''
  }
  async function createCommand(name: string, includeScope = false, resetLayout = false): Promise<SkuCommandResult> {
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
    if (result.ok) {activeId.value = id;if(!scopeId.value)globalActiveId.value=id}
    return result.ok ? { ok: true, id } : result
  }
  async function saveCommand(name?: string, includeScope = false): Promise<SkuCommandResult> {
    if (name !== undefined) return createCommand(name, includeScope)
    if (activeId.value === SYSTEM_SKU_VIEW_ID) return { ok: false, message: '全部 SKU 为系统视图，请另存为自己的视图。' }
    if(!dirty.value)return {ok:true}
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
    if (result.ok && !revisions.has(key)) delete localWork.value[key]
    return result
  }
  async function renameCommand(id: string, name: string): Promise<SkuCommandResult> {
    if (id === SYSTEM_SKU_VIEW_ID) return { ok: false, message: '系统视图不能重命名。' }
    const invalid = nameError(name, id)
    if (invalid) return { ok: false, message: invalid }
    const next = trial(), view = next?.views.find(item => item.id === id)
    if (!next || !view) return missing()
    view.name = name.trim(); view.updatedAt = new Date().toISOString()
    syncWork(next)
    return commit(next)
  }
  async function copyCommand(id: string): Promise<SkuCommandResult> {
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
    if (result.ok) {activeId.value = newId;if(!scopeId.value)globalActiveId.value=newId}
    return result.ok ? { ok: true, id: newId } : result
  }
  async function removeCommand(id: string): Promise<SkuCommandResult> {
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
    if (result.ok) { delete localWork.value[id]; if (activeId.value === id) activeId.value = next.skuWorkbench.defaultId; if(globalActiveId.value===id)globalActiveId.value=next.skuWorkbench.defaultId }
    return result
  }
  async function preference(update: (next: NonNullable<ProductListPageState['skuWorkbench']>) => void): Promise<SkuCommandResult> {
    const next = trial()
    if (!next?.skuWorkbench) return missing()
    syncWork(next); update(next.skuWorkbench)
    return commit(next)
  }
  async function favoriteCommand(id: string): Promise<SkuCommandResult> {
    return preference(next => { next.favorites = next.favorites.includes(id) ? next.favorites.filter(value => value !== id) : [...next.favorites, id] })
  }
  async function setDefaultCommand(id: string): Promise<SkuCommandResult> { return views.value.some(view => view.id === id) ? preference(next => { next.defaultId = id }) : { ok: false, message: '找不到这个视图。' } }
  async function moveFavoriteCommand(id: string, delta: number): Promise<SkuCommandResult> {
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
  const restore=()=>exclusive(restoreCommand)
  const create=(name:string,includeScope=false,resetLayout=false)=>exclusive(()=>createCommand(name,includeScope,resetLayout))
  const save=(name?:string,includeScope=false)=>exclusive(()=>saveCommand(name,includeScope))
  const rename=(id:string,name:string)=>exclusive(()=>renameCommand(id,name))
  const copy=(id:string)=>exclusive(()=>copyCommand(id))
  const remove=(id:string)=>exclusive(()=>removeCommand(id))
  const favorite=(id:string)=>exclusive(()=>favoriteCommand(id))
  const setDefault=(id:string)=>exclusive(()=>setDefaultCommand(id))
  const moveFavorite=(id:string,delta:number)=>exclusive(()=>moveFavoriteCommand(id,delta))
  watch(scopeId, id => { activeId.value = id ? SYSTEM_SKU_VIEW_ID : globalActiveId.value })
  if (!scopeId.value && activeId.value !== state.value.activeId) select(activeId.value)
  return { guideFailure, views, currentView, activeId, config, dirty, error, pending, commandPending, saveState, queued, flush, retry, update, query, updateQuery, state, select, apply, save, create, rename, copy, remove, favorite, setDefault, moveFavorite, restore }
}
