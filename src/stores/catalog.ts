import {supplementHuaweiProducts,phoneBrandKeys} from '../domain/benefitSales/phoneBrands'
import {addPublicSpus,updatePublicSpu,removePublicSpu,publicPoolStorageProblems,publicSpuReferences,publicSpuProblem,commonSpusProblem} from '../domain/benefitSales/publicSpuPool'
import {groupTypesProblem} from '../domain/benefitSales/query'
import {applyCompatibilityChanges,compatibilityImportProblems,type CompatibilityChange} from '../domain/accessoryCompatibilityCommands'
import {applyGeneralChanges,generalStorageProblems,type GeneralChange} from '../domain/generalCompatibility'
import {compatibilityWorkspaceBasis} from '../domain/compatibilityWorkspace'
import {cloneRecord} from '../domain/recordCopy'
import {modelSpecificationContext} from '../domain/modelSourceContext'
import {writeGroup,deleteGroup,writeSale,benefitStorageProblems} from '../domain/benefitSales/commands'
import type {GroupInput,SaleInput} from '../domain/benefitSales/types'
import { branchFailure, rejectGuide, getFailure, failureError, failureForResult, unknownFailure, withFailure, createFailure } from '../domain/guide/failure'
import type { GuideFailure } from '../domain/guide/types'
import { createCatalogSimulation } from './catalogSimulation'
import { RBAC_ENFORCEMENT_ENABLED } from '../domain/accessMode'
import { ensureRbac, rbacProblems, canPermission, isSuperAdmin, routePermissions, commandPermissions, effectivePermissions, isRetiredPermission, permissionRegistry, templateAccessResource } from '../domain/rbac'
import { loadMenu, saveMenu, defaultMenuNodes, type MenuNode } from '../domain/menuConfig'
import { createRbacCommands } from './catalogRbac'
import { catalogPublicData } from './catalogAccess'
import { defineStore } from 'pinia'
import { businessDefinitions, businessImportProblems, businessIssues, businessPath, configProblem, copyBusinessConfigs, freezeBusinessNodes, type BusinessDefinition, type NodeBusinessConfig } from '../domain/nodeBusiness'
import { executeMaterialRelation, materialRelationImportProblems, revokeMaterialRelation } from '../domain/materialRelationCommands'
import { materialRelationBlock } from '../domain/materialRelations'
import { computed, onScopeDispose, reactive, ref, watch } from 'vue'
import { createCatalogPersistence } from './catalogPersistence'
import { categoryMovesCandidate } from '../domain/categoryMovement'
import {
  blockChildOfTypedCategory,
  blockTypeOnNonLeaf,
  productTypeCategoryMoveMessage,
  categoryRemovalBlock as blockCategoryRemoval,
  moveCategoryNode,
  planCategoryCopy,
  relocateCategoryNodes,
  shiftCategoryNode,
  updateCategoryNode,
  type DropPosition,
} from '../domain/categoryTree'
import { dictionaryRemovalBlock } from '../domain/dictionaryGuard'
import { validProductTypePurpose } from '../domain/productTypePurpose'
import { applyModelDictionaryBatch, modelDictionaryInputProblem, type ModelDictionaryBatchInput, type ModelDictionaryBatchResult } from '../domain/modelDictionaryCommands'
import { captureEditor, editorEntry, prepareEditorUndo, type EditorHistoryEntry } from '../domain/editorHistory'
import { blankVariantAttrs, categoryPath, descendantIds, familySkus, sameSpecSnapshot, specPublishProblems } from '../domain/logic'
import { reconcilePlanningRecords } from '../domain/planning'
import { ensureProductListPages } from '../domain/productListPages'
import type { ProductListPageState } from '../domain/types'
import { validateProductListPage, validateProductListModeQuery } from '../domain/productListQuery'
import { validateSkuConfig } from '../domain/skuWorkbenchQuery'
import { validateListManualCommit, type ListManualGuard } from '../domain/listManualCommit'
import { SYSTEM_SKU_VIEW_ID, validateSkuWorkbenchPageShape } from '../domain/skuWorkbenchState'
import { isRealSku, isMaterialArchive } from '../domain/catalogIdentity'
import { appendSkuBatch, editSku, previewSkuAppend, saveSpu, spuRemovalBlock, type SkuDraft, type SkuGeneration } from '../domain/spuSku'
import { createTemporaryMaterial, createV3Material, renameV3Product, setPlanningGrades, tombstoneMaterialReceipts, updateV3Material } from '../domain/material'
import type { MaterialChoice } from '../domain/material'
import type { ProductGrade } from '../domain/types'
import { activeProductListView, applyPresetToActiveView, currentModeQuery, ensureProductListViews } from '../domain/productListViews'
import {supplementPhoneDemo,demoKeys} from '../domain/benefitSales/demo'
import {replacePhoneCatalogDemo,phoneCatalogKeys} from '../domain/benefitSales/phoneCatalogDemo'
import {installPhone18Demo,phone18DemoKeys} from '../domain/benefitSales/phone18Demo'
import { createSeed, defaultColumns, emptyQuery } from '../domain/seed'
import { DATA_VERSION, STORAGE_KEY, type AppData, type Category, type ColumnPref, type FeedbackItem, type ListQuery, type ListView, type ParamDef, type ProductFamily, type ProductGroup, type ProductType, type Sku, type SpecRule, type Brand, type UserRole } from '../domain/types'

type ModuleName = 'products' | 'categories' | 'templates' | 'params' | 'rules' | 'groups' | 'system'
type StoredPayload = { version?: number; data?: AppData }
export type TemplateSchemeInput = {
  id: string
  name: string
  structureOrder: string[]
  binds: { paramId: string; role: 'common' | 'variant'; required: boolean }[]
  sourceId?: string
  enabled?: boolean
}
type CommandFailure = { ok: false; message: string; package?: undefined; delivery?: undefined; validation?: undefined; preview?: undefined; id?: undefined; choices?: MaterialChoice[]; reason?: 'material-deleted' }
let migrationStorageError = ''
export function catalogMigrationError() { return migrationStorageError }

function renameSchemeColumn(columns: ColumnPref[] | undefined, mark: { changed: boolean }) {
  columns?.forEach((column) => {
    if (column.key === 'template' && column.label === '模板') {
      column.label = '属性方案'
      mark.changed = true
    }
  })
}

/** Validate persisted records and normalize optional containers/UI preferences; never repair product rows on startup. */
export function normalizeStored(parsed: StoredPayload, options: { persist?: boolean } = {}): AppData | null {
  // Compatibility option retained for callers; normalization never writes. The
  // store commits migrations under the same lock as every other business write.
  void options
  migrationStorageError = ''
  const data = parsed.data
  if (!data?.families || !data.skus || !data.categories || !data.templates || !data.mappings || !data.templateParams) return null
  const version = parsed.version ?? 1
  if (version < 1 || version > DATA_VERSION) return null
  if(data.compatibilities===undefined)data.compatibilities=[]
  const compatibilityProblems=[...compatibilityImportProblems(data),...generalStorageProblems(data)]
  if(compatibilityProblems.length)throw new Error(compatibilityProblems.join('；'))
  const benefitProblems=[...benefitStorageProblems(data),...publicPoolStorageProblems(data)]
  if(benefitProblems.length)throw new Error(benefitProblems.join('；'))
  const businessProblems = businessImportProblems(data)
  if (businessProblems.length) throw new Error(`节点业务配置结构校验失败：${businessProblems.join(' ')} 原始记录已保留。`)
  const relationProblems = materialRelationImportProblems(data)
  if (relationProblems.length) throw new Error(`物料关联校验失败：${relationProblems.join(' ')} 原始记录已保留。`)
  const mark = { changed: version !== DATA_VERSION }
  renameSchemeColumn(data.columns, mark)
  data.listViews?.forEach((view) => renameSchemeColumn(view.columns, mark))
  if (!Array.isArray(data.productSpecNodes)) {
    data.productSpecNodes = []
    mark.changed = true
  }
  if (!Array.isArray(data.specCanvases)) {
    data.specCanvases = []
    mark.changed = true
  }
  if (!Array.isArray(data.specModelVersions)) {
    data.specModelVersions = []
    mark.changed = true
  }
  // Missing publication/source records remain missing. Shape compatibility must
  // never publish today's nodes or guess an archive's historical version.
  if (!Array.isArray(data.productTypes)) {
    data.productTypes = []
    mark.changed = true
  }
  if (!Array.isArray(data.brands)) data.brands=[]
  if (!Array.isArray(data.productPlans)) {
    data.productPlans = []
    mark.changed = true
  }
  if (!Array.isArray(data.planningRecords)) {
    data.planningRecords = []
    mark.changed = true
  }
  if (!Array.isArray(data.materialReceipts)) {
    data.materialReceipts = []
    mark.changed = true
  }
  if (data.listQuery) {
    const defaults = emptyQuery()
    const next = { ...defaults, ...data.listQuery, attrFilters: data.listQuery.attrFilters || {} }
    if (next.createdFrom === undefined || next.shelf === undefined) mark.changed = true
    data.listQuery = next
  }
  if (ensureProductListViews(data)) mark.changed = true
  if (ensureProductListPages(data)) mark.changed = true
  ensureRbac(data, loadMenu())
  return data
}

function loadData(raw: string | null): AppData {
  let loaded: AppData | undefined
  try {
    if (raw === null) return createSeed()
    const parsed = JSON.parse(raw) as StoredPayload
    const data = normalizeStored(parsed, { persist: false })
    if (!data) throw new Error('已有数据的基础结构或版本无法读取。')
    loaded = data
    return data
  } catch (error) {
    if (loaded) {
      migrationStorageError = `数据已在内存中读取，但无法写入本机：${error instanceof Error ? error.message : String(error)}。原存储未清空，可重试保存。`
      return loaded
    }
    throw new Error(`无法安全读取本机数据：${error instanceof Error ? error.message : String(error)}。原始存储已保留，未使用演示数据替换。请先下载原始数据，再恢复有效备份。`, { cause: error })
  }
}

let seq = 1
export function uid(prefix: string) {
  seq += 1
  return `${prefix}-${Date.now().toString(36)}-${seq}`
}

export const useCatalogStore = defineStore('catalog', () => {
  const originalRaw = localStorage.getItem(STORAGE_KEY)
  const startupCandidate = loadData(originalRaw)
  ensureRbac(startupCandidate,loadMenu())
  const originalAuthorization = originalRaw ? JSON.parse(originalRaw).data?.rbac : undefined
  const needsAuthorizationMigration = !originalAuthorization || JSON.stringify(originalAuthorization) !== JSON.stringify(startupCandidate.rbac)
  const startingData = cloneRecord(startupCandidate)
  if(needsAuthorizationMigration){if(originalAuthorization)startingData.rbac=cloneRecord(originalAuthorization);else delete startingData.rbac;startingData.users=originalRaw?JSON.parse(originalRaw).data.users:startingData.users.map(u=>{const x={...u};delete x.roleIds;return x})}
  const data = reactive<AppData>(startingData)
  const authorizationReady=ref(!needsAuthorizationMigration)
  const SESSION_KEY='iyge-rbac-simulated-user'
  let storedUser:string|null=null
  try{storedUser=sessionStorage.getItem(SESSION_KEY)||localStorage.getItem(SESSION_KEY)}catch{try{storedUser=localStorage.getItem(SESSION_KEY)}catch{}}
  const activeUserId=ref(storedUser||startupCandidate.users.find(u=>u.enabled&&u.role===startupCandidate.activeRole)?.id||'')
  const previewUserId=ref('')
  const effectiveUserId=computed(()=>previewUserId.value||activeUserId.value)
  const currentUser=computed(()=>data.users.find(u=>u.id===effectiveUserId.value))
  const authorizationStamp=(value:AppData)=>JSON.stringify([value.rbac?.roles.map(r=>[r.id,r.enabled,r.superAdmin,r.permissionCodes]),value.rbac?.permissions.map(p=>[p.code,p.enabled,p.dependsOn]),value.users.map(u=>[u.id,u.enabled,u.roleIds])])
  function authorizationFresh(){if(!persistence.state.external)return true;try{return authorizationStamp(JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}').data)===authorizationStamp(data)}catch{return false}}
  const {simulationReturnId,simulateUser,startPermissionPreview,stopPermissionPreview}=createCatalogSimulation(data,activeUserId,previewUserId,authorizationFresh)
  const can=(code:string)=>authorizationReady.value&&(!RBAC_ENFORCEMENT_ENABLED||authorizationFresh())&&canPermission(data,effectiveUserId.value,code)
  function canRoute(location:{path:string;query?:Record<string,unknown>}){
    let path=location.path
    if(path==='/catalog'&&(location.query?.view===undefined||location.query.view===''))return ['product:category:read','product:type:read','product:model:read'].some(can)
    const legacy=/^\/products\/([^/]+)$/.exec(path)
    if(legacy&&legacy[1]!=='new'&&location.query?.sku){const sku=data.skus.find(s=>s.id===location.query!.sku&&s.familyId===legacy[1]);path=sku?(isMaterialArchive(data,sku)?`/materials/${sku.familyId}`:`/skus/${sku.id}`):`/spus/${legacy[1]}`}
    const permissions=routePermissions(path,location.query);return permissions!==null&&permissions.every(can)
  }
  type CommandContext={codes:string[];actor:string;name:string}
  let invocation:CommandContext|undefined
  let executingAction = 'action-business-save'
  const commandAction = (name:string) => ({ commitCategoryMove:'action-category-move', commitCategoryMoves:'action-category-move', renameCategoryName:'action-category-rename', publishSpecModel:'action-model-publish', createMaterial:'action-material-create', createTemporary:'action-material-create', saveMaterialRelation:'action-material-create', saveSpu:'action-spu-save', saveBundle:'action-spu-save', appendSkus:'action-sku-save', editSku:'action-sku-save',  commitSkuPage:'action-view-save', importJson:'action-json-import', commitMaterialImport:'action-json-import', saveView:'action-view-save', saveSkuView:'action-view-save', saveRbacRole:'action-rbac-authorize', grantRbacRole:'action-rbac-authorize' } as Record<string,string>)[name] || 'action-business-save'
  const caughtFailure = (error:unknown,message:string,savedState:GuideFailure['savedState']='unconfirmed') => { const known=getFailure(error);return known?{...known,message,savedState}:unknownFailure(message,executingAction,savedState) }
  const publicData=catalogPublicData(data,can)
  const editorGeneration = ref(0)
  const dictionaryCommandReceipts = new Map<string, { actor: string; generation: number; entry: EditorHistoryEntry; codes: string[] }>()
  const persistence = createCatalogPersistence(originalRaw)
  onScopeDispose(persistence.dispose)
  ensureProductListPages(data)
  let explicitlyPersisted = JSON.stringify(data)
  function persistLive() {
    return persistence.run(() => {
      const encoded = JSON.stringify(data)
      if (encoded === explicitlyPersisted) return { ok: true }
      persistence.write(data)
      explicitlyPersisted = encoded
      return { ok: true }
    }, (message,failure) => { migrationStorageError = `当前内容无法写入本机：${message}。原始数据未被清空。`; return { ok: false, message, failure } }, {actionId:'action-business-save',savedState:'memory-only'})
  }

  watch(
    data,
    () => {
      if (JSON.stringify(data) !== explicitlyPersisted) void persistLive()
    },
    { deep: true },
  )

  const isAdmin = computed(() => authorizationReady.value&&(!RBAC_ENFORCEMENT_ENABLED||authorizationFresh())&&isSuperAdmin(data,effectiveUserId.value))
  // Seed and migration writes use the very same protected path, never a startup
  // overwrite. Existing unmodified payloads acquire identity on their first edit.
  if(needsAuthorizationMigration){
    void persistence.run(()=>{persistence.write(startupCandidate);Object.assign(data,startupCandidate);authorizationReady.value=true;explicitlyPersisted=JSON.stringify(data);return {ok:true}},message=>{migrationStorageError=`授权迁移未提交：${message}。原数据保留。`;return {ok:false,message}})
  } else if (JSON.stringify(JSON.parse(originalRaw!).data)!==explicitlyPersisted||JSON.parse(originalRaw!).version!==DATA_VERSION){explicitlyPersisted='';void persistLive()}
  // Existing business records are never rebuilt, renamed or supplemented on startup.
  function command<T extends { ok: boolean; message?: string }>(operation: () => T): Promise<T | CommandFailure> {
    const context=invocation
    const actionId=context?commandAction(context.name):'action-business-save'
    return persistence.run<T | CommandFailure>(()=>{
      const codes=context?.codes||[]
      if(context&&(context.actor!==effectiveUserId.value||!codes.every(can)))return rejectGuide('command.authorization-changed','操作者或授权已变化，本次提交被拒绝，草稿保留。',{actionId,savedState:'unchanged',context:{requiredPermissions:codes.join('、'),mode:RBAC_ENFORCEMENT_ENABLED?'enforced':'unrestricted'}})
      const previous=executingAction;executingAction=actionId
      try{return failureForResult(operation(),actionId)}finally{executingAction=previous}
    }, (message,failure) => ({ ok: false as const, message, failure }), {actionId,savedState:'unchanged'})
  }

  /** Persist the whole candidate once, then expose only this command's owned fields. */
  function commitCandidate<T extends { ok: boolean; message?: string }>(next: AppData, result: T, keys: (keyof AppData)[]): T | { ok: false; message: string; choices?: MaterialChoice[]; reason?: 'material-deleted' } {
    if (!result.ok) return failureForResult(result, executingAction, 'unchanged')
    if (JSON.stringify(keys.map(key => data[key])) === JSON.stringify(keys.map(key => next[key]))) return result
    try {
      persistence.write(next)
      for (const key of keys) {
        if (next[key] === undefined) delete data[key]
        else Object.assign(data, { [key]: next[key] })
      }
      explicitlyPersisted = JSON.stringify(data)
      migrationStorageError = ''
      return result
    } catch (error) { const message=`无法保存到本机：${error instanceof Error ? error.message : String(error)}。当前数据未改变，操作草稿已保留，请重试。`;return withFailure({ok:false,message},caughtFailure(error,message,'unchanged')) }
  }
  const creationKeys: (keyof AppData)[] = ['families', 'skus', 'planningRecords', 'materialReceipts', 'materialRelations']
  function saveMaterialRelation(input: Parameters<typeof executeMaterialRelation>[1]) {
    const next = cloneRecord(data)
    const result = executeMaterialRelation(next, input, uid)
    return commitCandidate(next, result, creationKeys)
  }
  function unlinkMaterialRelation(id: string, basis: string) {
    const next = cloneRecord(data)
    return commitCandidate(next, revokeMaterialRelation(next, id, basis), creationKeys)
  }
  function commitCreated<T extends { ok: boolean; message?: string }>(next: AppData, result: T, ids: string[], _now: string) {
    if (!result.ok) return failureForResult(result, executingAction, 'unchanged')
    for (const id of ids) {
      const sku = next.skus.find(s => s.id === id), family = next.families.find(f => f.id === sku?.familyId)
      const version = next.specModelVersions.find(v => v.id === (sku?.modelVersionId || family?.modelVersionId))
      if (!sku || !version?.nodesSnapshot.some(n => n.businessConfigs?.length)) continue
      const attrs = { ...family?.commonAttrs, ...sku.variantAttrs }
      const selected = sku.sourceNodeIds?.length ? sku.sourceNodeIds : version.nodesSnapshot.filter(n => n.nodeType === 'VALUE' && attrs[next.params.find(p => p.id === n.attributeId)?.name || ''] === n.valueId).map(n => n.id)
      const path = new Set(selected.flatMap(nodeId => businessPath(version.nodesSnapshot, nodeId).map(n => n.id)))
      const issue = businessIssues(next, version.nodesSnapshot).find(i => path.has(i.nodeId))
      if (issue) return { ok: false as const, message: `当前规格的业务配置需要修正，未创建商品：${issue.message}`, choices: undefined, reason: undefined }
    }
    return commitCandidate(next, result, creationKeys)
  }
  function saveModelDraft(templateId: string, isCurrent: () => boolean = () => true) {
    if (!isCurrent()) return { ok: false, message: '编辑上下文已变化，本次保存已取消。' }
    if (!data.templates.some(item => item.id === templateId)) return { ok: false, message: '模型已不存在。' }
    const next = cloneRecord(data), canvas = next.specCanvases.find(item => item.templateId === templateId)
    if (canvas) canvas.updatedAt = new Date().toISOString()
    // The canvas may already be dirty in memory. Explicit save must still probe storage.
    try { persistence.write(next) }
    catch (error) { return { ok: false, message: `无法保存到本机：${error instanceof Error ? error.message : String(error)}。画布草稿保留，请重试。` } }
    if (canvas) data.specCanvases = next.specCanvases
    explicitlyPersisted = JSON.stringify(data)
    return { ok: true, message: '已保存模型草稿。' }
  }
  function saveNodeBusiness(modelId: string, nodeId: string, configs: NodeBusinessConfig[], expected: string) {
    const node = data.productSpecNodes.find(n => n.id === nodeId && n.templateId === modelId && n.nodeType === 'VALUE')
    if (!node || JSON.stringify(node) !== expected) return { ok: false, message: '节点或配置已变化，请重新打开核对；输入保留。' }
    const records = cloneRecord(configs)
    const seen = new Set<string>(), instanceIds = new Set<string>()
    for (const record of records) {
      delete record.definitionSnapshot
      delete record.dictionarySnapshot
      const old = node.businessConfigs?.find(c => c.id === record.id)
      if (old && old.definitionId !== record.definitionId) return { ok: false, message: '实例不能更换配置定义，请删除后重新添加。' }
      const definition = businessDefinitions(data).find(d => d.id === record.definitionId)
      if (!old && !definition?.enabled) return { ok: false, message: '目录项已停用或不存在，不能新增实例。' }
      const problem = configProblem(data, data.productSpecNodes.filter(n => n.templateId === modelId), node, record)
      if (problem && (!old || JSON.stringify(old) !== JSON.stringify(record))) return { ok: false, message: problem }
      if (seen.has(record.definitionId) || instanceIds.has(record.id) || data.productSpecNodes.some(n => n.id !== nodeId && n.businessConfigs?.some(c => c.id === record.id))) return { ok: false, message: '同一节点不能重复配置同一目录项，实例身份也不能重复。' }
      seen.add(record.definitionId)
      instanceIds.add(record.id)
    }
    const next = cloneRecord(data)
    next.productSpecNodes.find(n => n.id === nodeId)!.businessConfigs = records
    const canvas = next.specCanvases.find(c => c.templateId === modelId)
    if (canvas) { canvas.status = 'draft'; canvas.updatedAt = new Date().toISOString() }
    return commitCandidate(next, { ok: true, message: '已保存节点业务配置；冲突仍需修正后发布。' }, ['productSpecNodes', 'specCanvases'])
  }
  function saveBusinessDefinition(input: BusinessDefinition, remove = false) {
    const definitions = businessDefinitions(data), old = definitions.find(d => d.id === input.id)
    if (!old || old.kind !== input.kind || !input.name.trim() || typeof input.enabled !== 'boolean') return { ok: false, message: '定义身份和功能类型不能更换，请填写名称及可用状态。' }
    const allNodes = [...data.productSpecNodes, ...data.specModelVersions.flatMap(v => v.nodesSnapshot)]
    if (remove && allNodes.some(n => n.businessConfigs?.some(c => c.definitionId === old.id) || old.kind === 'naming' && n.namingRule?.length)) return { ok: false, message: '定义被草稿或历史发布版本引用，不能删除；可以停用以禁止新增实例。' }
    const next = cloneRecord(data)
    next.businessDefinitions = definitions.filter(d => d.id !== input.id).map(d => ({ ...d }))
    if (!remove) next.businessDefinitions.push({ ...old, name: input.name.trim(), description: input.description.trim(), enabled: input.enabled })
    return commitCandidate(next, { ok: true, message: '公共配置目录已保存，已引用实例和旧版本保持原义。' }, ['businessDefinitions'])
  }
  function materialImportBasis() {
    return JSON.stringify([data.families, data.skus, data.planningRecords, data.materialReceipts, data.specModelVersions, data.categories, data.productTypes, data.params, data.templates, data.specCanvases, data.productSpecNodes])
  }
  function commitMaterialImport(candidate:AppData,expectedBasis:string){
    if(materialImportBasis()!==expectedBasis)return rejectGuide('import.material.basis','预览后商品或模型数据已变化，请重新预览导入；当前数据未改变。',{savedState:'unchanged',recovery:['repreview']})
    const next=cloneRecord(data),existing=new Set(data.skus.map(item=>item.id))
    for(const key of creationKeys){if(candidate[key]!==undefined){if(!Array.isArray(candidate[key]))return {ok:false,message:`导入候选 ${key} 结构无效。`};Object.assign(next,{[key]:cloneRecord(candidate[key])})}}
    const changed=(a:unknown,b:unknown)=>JSON.stringify(a)!==JSON.stringify(b)
    const prefix:Partial<Record<keyof AppData,string>>={families:'product:spu',planningRecords:'product:planning',materialRelations:'product:material',materialReceipts:'product:material'}
    for(const key of creationKeys){
      const before=(data[key]||[]) as {id?:string}[],after=(next[key]||[]) as {id?:string}[]
      const identityOf=(row:{id?:string})=>row?.id||(key==='planningRecords'?(row as {planningId?:string})?.planningId:key==='materialReceipts'?(row as {requestId?:string})?.requestId:undefined)||JSON.stringify(row)
      type ImportRow=typeof before[number]
      const groups=new Map<string|undefined,{before:ImportRow[];after:ImportRow[]}>()
      for(const [side,rows]of [['before',before],['after',after]] as const)for(const row of rows){const identity=identityOf(row),group=groups.get(identity)||{before:[],after:[]};group[side].push(row);groups.set(identity,group)}
      const differences:{old:ImportRow|undefined;record:ImportRow|undefined}[]=[]
      for(const [identity,group]of groups){
        if(group.after.length>1&&group.after.length>group.before.length)return {ok:false,message:`物料导入候选 ${key} 新增或加剧重复身份 ${identity}；本次未写入任何数据。`}
        // Existing historical duplicates may remain verbatim. Match every unchanged
        // occurrence, then authorize each changed/deleted occurrence individually.
        const unmatched=group.before.slice(),updates:ImportRow[]=[]
        for(const row of group.after){const match=unmatched.findIndex(previous=>!changed(previous,row));if(match>=0)unmatched.splice(match,1);else updates.push(row)}
        for(let index=0;index<Math.max(unmatched.length,updates.length);index++)differences.push({old:unmatched[index],record:updates[index]})
      }
      for(const {old,record}of differences){
        const action=!old?'create':!record?'delete':'update'
        let codes:string[]=[]
        if(key==='skus'){
          for(const [source,row]of [[data,old],[next,record]] as const){if(!row)continue;const material=isMaterialArchive(source,row as Sku);if(!material)codes.push(`product:sku:${action}`);else if(action==='delete')codes.push('product:material:delete')}
        }else if(key==='families'){codes=record?commandPermissions('saveSpu',[record],data):['product:spu:delete']}
        else if(['materialReceipts','materialRelations'].includes(key)){if(old)codes=[`${prefix[key]}:${action}`]}
        else codes=[`${prefix[key]}:${action}`]
        if(!codes.every(can))return {ok:false,message:`物料导入含未经授权的其他资源修改（${key}）：${codes.filter(code=>!can(code)).join('、')}。本次未写入任何数据。`}
      }
    }
    const problems=[...materialRelationImportProblems(next)]
    if(problems.length)return {ok:false,message:`导入候选校验失败：${problems.join(' ')}`}
    return commitCreated(next,{ok:true},next.skus.filter(item=>!existing.has(item.id)).map(item=>item.id),new Date().toISOString())
  }

  function commitListPage(mode: 'spu' | 'sku', next: ProductListPageState, expectedPage: string, isCurrent: () => boolean, manualGuard?: ListManualGuard) {
    const current = data.productListPages?.[mode]
    if (!current || !data.productListPages) return { ok: false as const, message: '列表页面配置尚未初始化。' }
    if (typeof isCurrent !== 'function' || !isCurrent()) return { ok: false, message: '当前页面、范围或操作上下文已变化，本次未保存；输入和排序暂存保留。' }
    if (JSON.stringify(current) !== expectedPage) return { ok: false, message: '页面设置已由上一个操作更新，本次未覆盖；当前输入和排序暂存保留，请重新核对后重试。' }
    if (!can(mode === 'spu' ? 'product:view:update' : 'product:sku:read')) return { ok: false, message: '当前没有保存该页面视图的权限，本次未修改。' }
    const errors = validateProductListPage(data, next, mode, { validateConfigs: false })
    if (!errors.length && mode === 'sku') errors.push(...validateSkuWorkbenchPageShape(data, next))
    if (!errors.length) for (const view of next.views) {
      const old = current.views.find(item => item.id === view.id)
      if (mode === 'spu' && JSON.stringify(view.spuQuery) !== JSON.stringify(old?.spuQuery)) errors.push(...validateProductListModeQuery(data, view.spuQuery, mode))
      if (mode === 'sku' && view.skuWorkbench && JSON.stringify(view.skuWorkbench) !== JSON.stringify(old?.skuWorkbench)) errors.push(...validateSkuConfig(data, view.skuWorkbench))
    }
    if (!errors.length && mode === 'sku') {
      const system = next.views.find(view => view.id === SYSTEM_SKU_VIEW_ID), beforeSystem = current.views.find(view => view.id === SYSTEM_SKU_VIEW_ID)
      if (beforeSystem && (!system || system.name !== beforeSystem.name || JSON.stringify(system.skuWorkbench) !== JSON.stringify(beforeSystem.skuWorkbench))) errors.push('全部 SKU 为系统视图，不能覆盖或删除；请另存为命名视图。')
      for (const [key, config] of Object.entries(next.skuWorkbench?.working ?? {})) if (JSON.stringify(config) !== JSON.stringify(current.skuWorkbench?.working[key])) errors.push(...validateSkuConfig(data, config))
    }
    if (errors.length) return { ok: false, message: `视图配置未保存：${[...new Set(errors)].join('；')}` }
    const manualProblem = manualGuard && validateListManualCommit(data, mode, next, manualGuard)
    if (manualProblem) return { ok: false, message: manualProblem }
    if (!isCurrent()) return { ok: false, message: '操作上下文已变化，本次未保存；输入和排序暂存保留。' }
    const candidate = { ...data, productListPages: { ...data.productListPages, [mode]: next } }
    return commitCandidate(candidate, { ok: true as const }, ['productListPages'])
  }

  function unusedCatalogId(prefix: 'fam' | 'sku') {
    let id: string
    do { id = uid(prefix) } while (data.families.some(item => item.id === id) || data.skus.some(item => item.id === id) || data.materialReceipts.some(item => item.skuId === id))
    return id
  }

  function replaceAll(next: AppData) {
    editorGeneration.value += 1
    ensureProductListPages(next)
    Object.assign(data, next)
    if (next.materialRelations === undefined) delete data.materialRelations
  }

  function resetAll() {
    const next = createSeed()
    next.rbac=cloneRecord(data.rbac);next.users=cloneRecord(data.users)
    persistence.write(next, true)
    replaceAll(next)
    explicitlyPersisted = JSON.stringify(data)
    return { ok: true as const }
  }

  function resetModule(name: ModuleName) {
    const next = cloneRecord(data)
    const fresh = createSeed()
    if (name === 'products') {
      next.families = fresh.families
      next.skus = fresh.skus
    } else if (name === 'categories') {
      next.categories = fresh.categories
      next.mappings = fresh.mappings
      next.productTypes = fresh.productTypes
    } else if (name === 'templates') {
      next.templates = fresh.templates
      next.templateParams = fresh.templateParams
      next.mappings = fresh.mappings
      next.productSpecNodes = fresh.productSpecNodes
      next.specCanvases = fresh.specCanvases
      next.specModelVersions = fresh.specModelVersions
    } else if (name === 'params') {
      next.params = fresh.params
      next.templateParams = fresh.templateParams
    } else if (name === 'rules') {
      next.rules = fresh.rules
    } else if (name === 'groups') {
      next.productGroups = fresh.productGroups
    } else {
      // Users and authorization are managed by the controlled system commands.
      next.feedbacks = fresh.feedbacks
      next.profile = fresh.profile
    }
    const relationProblems = materialRelationImportProblems(next)
    if (relationProblems.length) return { ok: false as const, message: `本模块重置会破坏物料关联：${relationProblems.join(' ')}；请保留当前数据或恢复完整备份。` }
    persistence.write(next, true)
    replaceAll(next)
    explicitlyPersisted = JSON.stringify(data)
    return { ok: true as const }
  }

  function exportJson() {
    const exported=cloneRecord(data)
    if(!can('product:type-bundle:read'))delete exported.benefitTypeGroups
    if(!can('product:type-bundle:read')&&!can('product:bundle-sale:read'))delete exported.publicSpuPool
    if(!can('product:bundle-sale:read'))delete exported.benefitSalesLists
    return JSON.stringify({ version: DATA_VERSION, data:exported }, null, 2)
  }

  function throwImportValidation(message:string):never{throw failureError(message,branchFailure('import.json.validation',message,{savedState:'unchanged',recovery:['edit-input','feedback']}))}
  function throwImportPermission(message:string):never{throw failureError(message,branchFailure('command.permission',message,{actionId:'action-json-import',savedState:'unchanged',context:{mode:RBAC_ENFORCEMENT_ENABLED?'enforced':'unrestricted'},recovery:['feedback']}))}
  function importJson(text: string) {
    let parsed:StoredPayload
    try { parsed=JSON.parse(text) as StoredPayload } catch(error) { const message=error instanceof Error?error.message:String(error);throw failureError(message,branchFailure('import.json.parse',message,{savedState:'unchanged',recovery:['edit-input','feedback']})) }
    if (!parsed.data) throw failureError('导入文件缺少商品数据，当前数据没有被替换。',branchFailure('import.json.missing','导入文件缺少商品数据，当前数据没有被替换。',{savedState:'unchanged',recovery:['edit-input']}))
    if (!Array.isArray(parsed.data.skus) || !Array.isArray(parsed.data.families)) throw failureError('导入文件缺少有效的商品数组，当前数据没有被替换。',branchFailure('import.json.missing','导入文件缺少有效的商品数组，当前数据没有被替换。',{savedState:'unchanged',recovery:['edit-input']}))
    const businessProblems = businessImportProblems(parsed.data)
    if (businessProblems.length) throwImportValidation(`节点业务配置结构校验失败：${businessProblems.join(' ')} 当前数据没有被替换。`)
    const relationProblems = materialRelationImportProblems(parsed.data)
    if (relationProblems.length) throwImportValidation(`物料关联校验失败：${relationProblems.join(' ')} 当前数据没有被替换。`)
    const prefixes:Partial<Record<keyof AppData,string>>={compatibilities:'product:compatibility',generalCompatibilityClaims:'product:compatibility',publicSpuPool:'product:type-bundle',benefitTypeGroups:'product:type-bundle',benefitSalesLists:'product:bundle-sale',families:'product:spu',skus:'product:sku',productSpecNodes:'product:model',specCanvases:'product:model',specModelVersions:'product:model',businessDefinitions:'product:model',materialRelations:'product:material',materialReceipts:'product:material',categories:'product:category',params:'product:dictionary',templates:'product:model',templateParams:'product:template',mappings:'product:template',productTypes:'product:type',rules:'product:rule',brands:'product:brand',productGroups:'product:group',planningRecords:'product:planning',productPlans:'product:planning',feedbacks:'system:feedback',profile:'system:account'}
    for(const key of Object.keys(prefixes))if(key!=='profile'&&(parsed.data as any)[key]!==undefined&&!Array.isArray((parsed.data as any)[key]))throwImportValidation(`导入记录集合 ${key} 必须为数组，不能按空集合处理损坏内容。`)
    const next = normalizeStored(parsed, { persist: false })
    if (!next?.params) throwImportValidation('演示数据版本不匹配，当前数据没有被替换')
    if(next.productTypes.some(type=>!validProductTypePurpose(type.catalogRole)))throwImportValidation('产品类型业务用途无效，只接受主机／设备、配件、其他或未指定。')
    for(const key of ['publicSpuPool','compatibilities','generalCompatibilityClaims','deviceModels','deviceBindings','templateCompatibilityConfigs','templateCompatibilityOrigins','nodeCompatibilityRules','materialContributions'] as const)if(next[key]===undefined&&data[key]!==undefined)Object.assign(next,{[key]:cloneRecord(data[key])})
    if(data.phoneDemoCatalogVersion!==undefined)next.phoneDemoCatalogVersion=data.phoneDemoCatalogVersion
    if(data.phoneDemoBrandsVersion!==undefined)next.phoneDemoBrandsVersion=data.phoneDemoBrandsVersion
    if(JSON.stringify(next.publicSpuPool)!==JSON.stringify(data.publicSpuPool)){
      for(const row of data.publicSpuPool||[])if(!next.publicSpuPool?.some(e=>e.spuId===row.spuId)&&publicSpuReferences(next,row.spuId).length)throwImportValidation('不能通过导入移除仍被权益包引用的公共 SPU，请先处理引用。')
      for(const row of next.publicSpuPool||[])if(row.enabled&&(!data.publicSpuPool?.some(e=>e.spuId===row.spuId&&e.enabled))){const issue=publicSpuProblem(next,row.spuId);if(issue)throwImportValidation(issue)}
    }
    const authChanged=JSON.stringify([next.rbac,next.users])!==JSON.stringify([data.rbac,data.users])
    if(authChanged){
      if(!can('system:role:grant')||!can('system:user:bind')||!can('system:permission:update'))throwImportPermission('导入不能修改当前操作者无权维护的授权或用户角色绑定。')
      const own=effectivePermissions(data,effectiveUserId.value)
      if(!isAdmin.value&&next.rbac!.roles.some(role=>role.superAdmin||role.permissionCodes.some(code=>!isRetiredPermission(code)&&!own.has(code))))throwImportPermission('导入不能取得超级管理员身份或超出操作者委派范围。')
    }
    const preferences=new Set(['mode','activeRole','productListPages','productListViews','activeProductListViewId','columns','listViews','activeViewId','listQuery','productListMode','phoneDemoCatalogVersion','phoneDemoBrandsVersion'])
    for(const key of new Set([...Object.keys(data),...Object.keys(next)])){
      if(key==='rbac'||key==='users'||preferences.has(key)||JSON.stringify((data as any)[key])===JSON.stringify((next as any)[key]))continue
      if(key==='benefitSalesLists'&&JSON.stringify(next.benefitSalesLists)!==JSON.stringify(data.benefitSalesLists))throwImportValidation('请通过选购页保存清单，不能通过导入改写历史记录。')
      const prefix=prefixes[key as keyof AppData]
      if(!prefix&&['compatibilities','generalCompatibilityClaims','deviceModels','deviceBindings','templateCompatibilityConfigs','templateCompatibilityOrigins','nodeCompatibilityRules','materialContributions','benefitPackages','benefitDeliveries','benefitFrameworks','salesOptionPlans','salesOptionBindings','salesProductRelations'].includes(key))continue
      if(!prefix)throwImportValidation(`导入含未登记的变更字段：${key}`)
      const old=(data as any)[key],value=(next as any)[key]
      const records=key!=='profile'
      if(records&&((old!==undefined&&!Array.isArray(old))||(value!==undefined&&!Array.isArray(value))))throwImportValidation(`导入记录集合 ${key} 必须为数组，不能按空集合处理损坏内容。`)
      if(key==='specModelVersions'){if(!can('product:model:publish'))throwImportPermission('无权导入或改写模型发布快照。');continue}
      if(records){
        const previousRows=old||[],incomingRows=value||[]
        const byId=(item:any)=>item.id||item.spuId||JSON.stringify(item)
        const keys=new Set([...previousRows,...incomingRows].map(byId))
        for(const identity of keys){const a=previousRows.find((v:any)=>byId(v)===identity),b=incomingRows.find((v:any)=>byId(v)===identity);if(JSON.stringify(a)===JSON.stringify(b))continue;if(key==='benefitTypeGroups'&&b){const issue=groupTypesProblem(next,b.categoryId,b.productTypeIds)||commonSpusProblem(next,b.commonSpuIds||[]);if(issue)throwImportValidation(issue)}if(key==='families'&&b&&!commandPermissions('saveSpu',[b],data).every(can))throwImportPermission('导入不能绕过商品编辑或发布权限。');if(key==='skus'&&a&&b&&isMaterialArchive(data,a)!==isMaterialArchive(next,b)&&(!can('product:sku:update')||!can('product:material:update')))throwImportPermission('导入不能跨越 SKU/MAT 身份权限。');const templateRow=(key==='templates'||key==='templateParams'||key==='mappings');const templateId=key==='templates'?(b||a)?.id:(b||a)?.templateId;const resource=templateRow?`product:${templateAccessResource(b?next:data,templateId||'')}`:key==='skus'&&((a||b)?.recordKind==='material'||(a||b)?.materialCode)?'product:material':prefix;const action=key==='templateParams'||key==='mappings'?'update':!a?'create':!b?'delete':'update';if(!can(`${resource}:${action}`))throwImportPermission(`导入被拒绝：没有 ${resource}:${action}，当前数据及会话未改变。`)}
      }else if(!can(`${prefix}:update`))throwImportPermission(`导入被拒绝：没有 ${prefix}:update。`)
    }
    for(const saved of data.benefitSalesLists||[])if(saved.status==='confirmed'&&JSON.stringify(next.benefitSalesLists?.find(s=>s.id===saved.id))!==JSON.stringify(saved))throwImportValidation('不能通过导入修改或删除已确认清单。')
    for(const saved of next.benefitSalesLists||[])if(saved.status==='confirmed'&&JSON.stringify(data.benefitSalesLists?.find(s=>s.id===saved.id))!==JSON.stringify(saved)&&!can('product:bundle-sale:confirm'))throwImportPermission('没有导入已确认清单的权限。')
    next.activeRole=data.activeRole // Deprecated backup mirror must never change the current or next mock identity.
    const authIssues=rbacProblems(next);if(authIssues.length)throwImportValidation(authIssues.join(' '))

    if (migrationStorageError) throw new Error(migrationStorageError)
    try { persistence.write(next, true) }
    catch (error) { const message=`无法写入本机：${error instanceof Error ? error.message : String(error)}。当前数据和原存储未改变，可重试导入。`;throw failureError(message,caughtFailure(error,message,'unchanged')) }
    replaceAll(next)
    // Object.assign preserves the live object's key order. The imported payload
    // may have a different order while containing identical data; suppress only
    // the immediate watch echo of the successfully committed live state.
    explicitlyPersisted = JSON.stringify(data)
  }

  function skusOf(familyId: string) {
    return familySkus(data, familyId)
  }

  function saveBundle(family: ProductFamily, skus: Sku[]) {
    // Compatibility entry for the old editor: validate the complete operation before writing.
    // Missing children are retained; an editor draft is never a deletion instruction.
    const trial: AppData = JSON.parse(JSON.stringify(data))
    const now = new Date().toISOString()
    const existingIds = new Set(trial.skus.map(item => item.id))
    const saved = saveSpu(trial, family, now)
    if (!saved.ok) return saved
    for (const sku of skus) {
      const existing = trial.skus.find(item => item.id === sku.id)
      if (existing) {
        if (existing.familyId !== family.id) return { ok: false as const, message: '不能更换 SKU 所属 SPU。' }
        const edited = editSku(trial, sku.id, sku, now)
        if (!edited.ok) return edited
      } else {
        const generation: SkuGeneration = { kind: 'manual', rows: [sku] }
        const preview = previewSkuAppend(trial, family.id, generation)
        const appended = appendSkuBatch(trial, { familyId: family.id, generation, selectedKeys: preview.rows.map(row => row.key), now, nextId: () => sku.id })
        if (!appended.ok) return appended
      }
    }
    return commitCreated(trial, { ok: true as const }, trial.skus.filter(item => !existingIds.has(item.id)).map(item => item.id), now)
  }

  function appendSkus(familyId: string, generation: SkuGeneration, selectedKeys: string[]) {
    const next = cloneRecord(data), now = new Date().toISOString()
    const result = appendSkuBatch(next, { familyId, generation, selectedKeys, now, nextId: () => unusedCatalogId('sku') })
    return commitCreated(next, result, result.ok ? result.ids : [], now)
  }
  function editSalesSku(id: string, draft: SkuDraft) {
    const next = cloneRecord(data), now = new Date().toISOString()
    const result = editSku(next, id, draft, now)
    return commitCandidate(next, result, ['families', 'skus'])
  }

  function removeFamily(id: string) {
    for (const sku of data.skus.filter(s => s.familyId === id)) {
      const blocked = materialRelationBlock(data, 'material', sku.id)
      if (blocked) return blocked
    }
    const blocked = spuRemovalBlock(data, id)
    if (blocked) return blocked
    data.families = data.families.filter((item) => item.id !== id)
    return ''
  }

  function patchSku(id: string, patch: Pick<Sku, 'status'>) {
    const sku = data.skus.find((item) => item.id === id && isRealSku(data, item))
    const family = sku && data.families.find((item) => item.id === sku.familyId)
    if (!sku || !family) return
    return editSku(data, id, { ...sku, status: patch.status }, new Date().toISOString())
  }

  function removeSku(id: string) {
    const relationBlock = materialRelationBlock(data, 'material', id)
    if (relationBlock) return relationBlock
    const sku = data.skus.find((item) => item.id === id)
    if (!sku) return ''
    data.skus = data.skus.filter((item) => item.id !== id)
    tombstoneMaterialReceipts(data, id)
    return ''
  }

  function setSkuStatus(ids: string[], status: Sku['status']) {
    ids.forEach((id) => patchSku(id, { status }))
  }

  function addParamValue(paramId: string, value: string) {
    const param = data.params.find((item) => item.id === paramId)
    const name = value.trim()
    if (!param || !name || param.values.includes(name)) return false
    param.values.push(name)
    return true
  }

  function appendDictionaryValues(attributeId: string, values: readonly string[], isCurrent: () => boolean) {
    const fail = (message: string) => ({ ok: false, message, addedValues: [] as string[], existingValues: [] as string[] })
    if (typeof attributeId !== 'string' || !attributeId.trim()) return fail('请选择有效的属性词典 ID。')
    if (typeof isCurrent !== 'function' || !isCurrent()) return fail('属性编辑上下文已变化，本次没有保存；原输入保留。')
    if (!Array.isArray(values) || values.some(value => typeof value !== 'string')) return fail('属性值必须是文字列表。')
    const owner = data.params.find(param => param.id === attributeId)
    if (!owner) return fail('属性词典已不存在，请重新选择属性。')
    if (!can('product:dictionary:update')) return fail('没有修改属性词典的权限，本次没有保存。')
    // Values supplied as individual identities are not split again (a value may contain punctuation).
    const cleaned = [...new Set(values.map(value => value.trim()).filter(Boolean))]
    const addedValues = cleaned.filter(value => !owner.values.includes(value)), existingValues = cleaned.filter(value => owner.values.includes(value))
    if (!cleaned.length) return fail('请至少输入一行有效属性值。')
    const next = cloneRecord(data)
    next.params.find(param => param.id === attributeId)!.values.push(...addedValues)
    return commitCandidate(next, { ok: true, message: addedValues.length ? `已保存 ${addedValues.length} 个新取值${existingValues.length ? `，跳过 ${existingValues.length} 个已有取值` : ''}。` : '所选取值均已存在，没有重复写入。', addedValues, existingValues }, ['params'])
  }

  function markDictionaryDraft(next: AppData, modelId: string) {
    const canvas = next.specCanvases.find(item => item.templateId === modelId)
    if (!canvas || canvas.status === 'offline') return
    const latest = next.specModelVersions.filter(item => item.templateId === modelId && item.status === 'published').sort((a, b) => a.version - b.version).at(-1)
    if (latest && sameSpecSnapshot(latest.nodesSnapshot, next.productSpecNodes.filter(item => item.templateId === modelId))) {
      canvas.status = 'published'; canvas.version = latest.version; canvas.versionName = latest.versionName
    } else {
      canvas.status = 'draft'; canvas.version = (latest?.version || 0) + 1; canvas.versionName = `V${canvas.version}`
      canvas.updatedAt = new Date().toISOString()
    }
  }
  function commitModelDictionaryBatch(input: ModelDictionaryBatchInput, isCurrent: () => boolean) {
    const inputProblem = modelDictionaryInputProblem(input)
    if (inputProblem) return { ok: false, message: inputProblem }
    if (typeof isCurrent !== 'function' || !isCurrent()) return { ok: false, message: '模型编辑上下文已变化，本次没有保存；原输入保留。' }
    const codes = commandPermissions('commitModelDictionaryBatch', [input], data)
    if (!codes.every(can)) return { ok: false, message: `当前授权不足：${codes.filter(code => !can(code)).join('、')}。原输入保留。` }
    const before = captureEditor(data, input.modelId), next = cloneRecord(data)
    const planned = { ...applyModelDictionaryBatch(next, input, uid), requiredPermissions: codes }
    if (!planned.ok) return planned
    const historyEntry = editorEntry(input.modelId, input.session, before, captureEditor(next, input.modelId))
    if (historyEntry) { historyEntry.commandId = uid('editor-command'); markDictionaryDraft(next, input.modelId) }
    if (!isCurrent()) return { ok: false, message: '模型编辑上下文已变化，本次没有保存；原输入保留。' }
    const committed = commitCandidate(next, { ...planned, historyEntry }, ['params', 'templates', 'templateParams', 'productSpecNodes', 'specCanvases'])
    if (committed.ok && historyEntry?.commandId) dictionaryCommandReceipts.set(historyEntry.commandId, { actor: effectiveUserId.value, generation: editorGeneration.value, entry: cloneRecord(historyEntry), codes })
    return committed
  }
  function undoModelDictionaryBatch(entry: EditorHistoryEntry, modelId: string, session: number, isCurrent: () => boolean) {
    const receipt = entry?.commandId && dictionaryCommandReceipts.get(entry.commandId)
    if (!isCurrent() || !receipt || receipt.actor !== effectiveUserId.value || receipt.generation !== editorGeneration.value || JSON.stringify(entry) !== JSON.stringify(receipt.entry)) return { ok: false, message: '本次撤销回执或编辑身份已失效，未修改当前数据。' }
    if (![...receipt.codes, ...commandPermissions('undoModelDictionaryBatch', [receipt.entry], data)].every(can)) return { ok: false, message: '当前授权已变化，不能撤销这次词典和模型操作。' }
    const prepared = prepareEditorUndo(data, receipt.entry, modelId, session)
    if (!prepared.ok) return prepared
    const next = cloneRecord(data)
    next.params = prepared.params; next.productSpecNodes = prepared.nodes; next.templateParams = prepared.bindings
    next.templates.find(item => item.id === modelId)!.structureOrder = prepared.order
    markDictionaryDraft(next, modelId)
    const committed = commitCandidate(next, { ok: true, message: '已撤销这一次批量操作，其他模型和历史版本保持。' }, ['params', 'templates', 'templateParams', 'productSpecNodes', 'specCanvases'])
    if (committed.ok) dictionaryCommandReceipts.delete(entry.commandId!)
    return committed
  }

  function removeParam(id: string) {
    const message = dictionaryRemovalBlock(data, id)
    if (message) return message
    data.params = data.params.filter((item) => item.id !== id)
    data.templates.forEach((template) => {
      template.structureOrder = template.structureOrder.filter((item) => item !== id)
    })
    return ''
  }

  function removeParamValue(paramId: string, value: string) {
    const message = dictionaryRemovalBlock(data, paramId, value)
    if (message) return message
    const param = data.params.find((item) => item.id === paramId)
    if (!param) return '参数不存在'
    param.values = param.values.filter((item) => item !== value)
    param.valueGroups.forEach((group) => {
      group.values = group.values.filter((item) => item !== value)
    })
    return ''
  }

  function categoryRemovalBlock(id: string) {
    return blockCategoryRemoval(
      data.categories,
      data.families.map((item) => item.categoryId),
      id,
    )
  }

  function removeCategory(id: string) {
    const message = categoryRemovalBlock(id)
    if (message) return message
    if (data.productTypes.some((item) => item.categoryId === id)) return '分类下还有产品类型，不能删除。'
    data.categories = data.categories.filter((item) => item.id !== id)
    data.mappings = data.mappings.filter((item) => item.categoryId !== id)
    return ''
  }

  function productTypesOf(categoryId: string) {
    return data.productTypes.filter((item) => item.categoryId === categoryId).slice().sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'zh'))
  }

  function saveProductType(input: { id: string; name: string; categoryId: string; description: string; sort: number; status: ProductType['status']; catalogRole?: ProductType['catalogRole'] }) {
    const next=cloneRecord(data),message=saveProductTypeInto(next,input)
    if(message)return message
    const result=commitCandidate(next,{ok:true},['productTypes'])
    return result.ok?'':result.message||'保存失败，原产品类型未改变。'
  }
  function saveProductTypeInto(target: AppData,input: Parameters<typeof saveProductType>[0]) {
    if (!validProductTypePurpose(input.catalogRole)) return '业务用途无效，请选择主机／设备、配件、其他或未指定。'
    const name = input.name.trim()
    if (!name) return '请填写产品类型名称。'
    const category = target.categories.find((item) => item.id === input.categoryId)
    if (!category) return '目标分类不存在或已经删除。'
    if (category.enabled === false) return '目标分类已停用，不能关联。'
    const leafBlock = blockTypeOnNonLeaf(target.categories, input.categoryId)
    if (leafBlock) return leafBlock
    const duplicated = target.productTypes.some((item) => item.categoryId === input.categoryId && item.name === name && item.id !== input.id)
    if (duplicated) return '这个分类下已经有同名产品类型。'
    const description = input.description.trim()
    const sort = Number.isFinite(input.sort) ? input.sort : 1
    if (input.id) {
      const row = target.productTypes.find((item) => item.id === input.id)
      if (!row) return '产品类型不存在。'
      // Older callers omit the field; only an explicitly supplied undefined clears it.
      const catalogRole = Object.hasOwn(input, 'catalogRole') ? input.catalogRole : row.catalogRole
      const blocked = productTypeCategoryMoveMessage(target, input.id, input.categoryId, categoryPath(target, input.categoryId))
      if (blocked) return blocked
      Object.assign(row, { name, categoryId: input.categoryId, description, sort, status: input.status, catalogRole })
      return ''
    }
    target.productTypes.push({ id: uid('pt'), name, categoryId: input.categoryId, description, sort, status: input.status, ...(input.catalogRole ? {catalogRole:input.catalogRole} : {}) })
    return ''
  }

  function commitProductType(input: Parameters<typeof saveProductType>[0], expectedRecord: string, isCurrent: () => boolean) {
    if (!isCurrent()) return { ok:false, message:'产品类型编辑上下文已变化，本次修改未保存。', id:'' }
    const current=data.productTypes.find(item=>item.id===input.id)
    if (input.id && (!current || JSON.stringify(current)!==expectedRecord)) return {ok:false,message:'产品类型已变化或被删除，请重新核对；当前输入已保留。',id:''}
    const next=cloneRecord(data),before=new Set(next.productTypes.map(item=>item.id)),message=saveProductTypeInto(next,input)
    if(message)return {ok:false,message,id:''}
    const id=input.id||next.productTypes.find(item=>!before.has(item.id))!.id
    return commitCandidate(next,{ok:true,message:'产品类型已保存',id},['productTypes'])
  }

  function commitProductTypeAction(id: string, action: 'delete'|'enabled'|'disabled', expectedRecord: string, isCurrent: () => boolean) {
    if(!isCurrent())return {ok:false,message:'产品类型操作上下文已变化，本次修改未保存。'}
    const current=data.productTypes.find(item=>item.id===id)
    if(!current||JSON.stringify(current)!==expectedRecord)return {ok:false,message:'产品类型已变化或被删除，请重新核对后操作。'}
    if(action==='delete'){const message=productTypeRemovalBlock(id);if(message)return {ok:false,message}}
    else if(action!=='enabled'&&action!=='disabled')return {ok:false,message:'不支持的产品类型操作。'}
    const next=cloneRecord(data)
    if(action==='delete')next.productTypes=next.productTypes.filter(item=>item.id!==id)
    else next.productTypes.find(item=>item.id===id)!.status=action
    return commitCandidate(next,{ok:true,message:action==='delete'?'产品类型已删除':'产品类型状态已保存'},['productTypes'])
  }

  function removeProductType(id: string) {
    const message = productTypeRemovalBlock(id)
    if (message) return message
    data.productTypes = data.productTypes.filter((item) => item.id !== id)
    return ''
  }

  function productTypeRemovalBlock(id: string) {
    if (!data.productTypes.some((item) => item.id === id)) return '产品类型不存在。'
    const modelIds = new Set(data.specCanvases.filter((item) => item.productTypeId === id).map((item) => item.templateId))
    const usedByModel = modelIds.size > 0
    const usedByVersion = data.specModelVersions.some((item) => item.status === 'published' && modelIds.has(item.templateId))
    const usedByPlanning = (data.planningRecords || []).some((item) => modelIds.has(item.productModelId)) || (data.productPlans || []).some((item) => item.productTypeId === id)
    const usedByMaterial = data.families.some((item) => item.productTypeId === id) || data.skus.some((sku) => data.families.some((item) => item.id === sku.familyId && item.productTypeId === id))
    if (usedByModel || usedByVersion || usedByPlanning || usedByMaterial) return '该产品类型已被商品模型 / 已发布数据引用，不能删除。'
    return ''
  }

  function setProductTypeStatus(id: string, status: ProductType['status']) {
    const row = data.productTypes.find((item) => item.id === id)
    if (row) row.status = status
  }

  function setProductModelStatus(id: string, status: 'offline', expectedUpdatedAt: string, isCurrent: () => boolean) {
    if (!isCurrent()) return { ok: false, message: '模型操作上下文已变化，本次修改未保存。' }
    const current = data.specCanvases.find(item => item.templateId === id)
    if (!current) return { ok: false, message: '模型工作资料不存在，请先在详情中核对；未自动补建模型。' }
    if ((current.updatedAt || '') !== expectedUpdatedAt) return { ok: false, message: '模型已被其他操作更新，请重新核对后再下线。' }
    if (status !== 'offline') return { ok: false, message: '不支持的模型状态操作。' }
    if (current.status === status) return { ok: true, message: '模型已经下线。' }
    const next = cloneRecord(data), canvas = next.specCanvases.find(item => item.templateId === id)!
    canvas.status = status
    canvas.updatedAt = new Date().toISOString()
    return commitCandidate(next, { ok: true, message: '模型已下线，历史商品及发布快照保持原样。' }, ['specCanvases'])
  }

  function createProductModel(input: { productTypeId: string; name: string }) {
    const productType = data.productTypes.find((item) => item.id === input.productTypeId)
    const name = input.name.trim()
    if (!productType) return { ok: false, message: '请选择产品类型。', templateId: '' }
    if (!name) return { ok: false, message: '请填写模型名称。', templateId: '' }
    const next = cloneRecord(data)
    const templateId = uid('tpl')
    next.templates.push({ id: templateId, name, parentId: null, enabled: true, structureOrder: [] })
    next.specCanvases.push({
      templateId,
      productTypeId: productType.id,
      name,
      zoom: 1,
      panX: 0,
      panY: 0,
      status: 'draft',
      version: 1,
      versionName: 'V1',
      direction: 'ltr',
      updatedAt: new Date().toISOString(),
    })
    return commitCandidate(next, { ok: true, message: '', templateId }, ['templates', 'specCanvases'])
  }

  function copyProductModel(id: string, options: { name?: string; productTypeId?: string; direction?: 'ltr' | 'logic' } = {}) {
    const next = cloneRecord(data), source = next.templates.find(item => item.id === id), canvas = next.specCanvases.find(item => item.templateId === id)
    if (!source || !canvas?.productTypeId) return { ok: false, message: '模型或产品类型已不存在。' }
    const businessProblem = businessIssues(next, next.productSpecNodes.filter(n => n.templateId === id))[0]
    if (businessProblem) return { ok: false, message: `请先修正源模型业务配置：${businessProblem.message}` }
    const name = options.name?.trim() || `${canvas.name || source.name} 副本`, productTypeId = options.productTypeId || canvas.productTypeId
    if (!next.productTypes.some(item => item.id === productTypeId)) return { ok: false, message: '目标产品类型已不存在。' }
    if (options.name && next.specCanvases.some(item => item.productTypeId === productTypeId && item.name?.trim() === name)) return { ok: false, message: '这个产品类型下已有同名模型。' }
    const templateId = uid('tpl'), now = new Date().toISOString()
    const nodeMap = new Map(next.productSpecNodes.filter(item => item.templateId === id).map(item => [item.id, uid('sn')]))
    next.templates.push({ ...source, id: templateId, name, parentId: null, structureOrder: [...source.structureOrder] })
    next.templateParams.push(...next.templateParams.filter(item => item.templateId === id).map(item => ({ ...item, templateId })))
    next.productSpecNodes.push(...next.productSpecNodes.filter(item => item.templateId === id).map(item => ({ ...cloneRecord(item), id: nodeMap.get(item.id)!, templateId, parentId: item.parentId ? nodeMap.get(item.parentId) || null : null, ...(item.businessConfigs ? { businessConfigs: copyBusinessConfigs(item, templateId, nodeMap.get(item.id)!, uid) } : {}) })))
    next.specCanvases.push({ templateId, productTypeId, name, zoom: 1, panX: 0, panY: 0, status: 'draft', version: 1, versionName: 'V1', direction: options.direction || 'ltr', updatedAt: now })
    return commitCandidate(next, { ok: true, templateId }, ['templates', 'templateParams', 'productSpecNodes', 'specCanvases'])
  }

  function typedCategoryIds() {
    return new Set(data.productTypes.map((item) => item.categoryId))
  }

  function addCategory(name: string, parentId: string | null) {
    const trimmed = name.trim()
    if (!trimmed) return { id: '', message: '请填写分类名称' }
    const blocked = blockChildOfTypedCategory(parentId, typedCategoryIds())
    if (blocked) return { id: '', message: blocked }
    const siblings = data.categories.filter((item) => item.parentId === parentId)
    const id = uid('cat')
    data.categories.push({
      id,
      name: trimmed,
      parentId,
      sort: siblings.reduce((max, item) => Math.max(max, item.sort), 0) + 1,
      enabled: true,
    })
    return { id, message: '' }
  }

  function moveCategory(id: string, parentId: string | null) {
    return moveCategoryNode(data.categories, id, parentId, typedCategoryIds())
  }

  function shiftCategory(id: string, direction: -1 | 1) {
    shiftCategoryNode(data.categories, id, direction)
  }

  function relocateCategory(id: string, targetId: string, position: DropPosition) {
    return relocateCategoryNodes(data.categories, id, targetId, position, typedCategoryIds())
  }

  function updateCategory(id: string, patch: { name: string; enabled: boolean; sort: number; parentId: string | null; icon?: string }) {
    return updateCategoryNode(data.categories, id, patch, typedCategoryIds())
  }

  function copyCategory(id: string) {
    const source = data.categories.find((item) => item.id === id)
    if (!source) return ''
    const blocked = blockChildOfTypedCategory(source.parentId, typedCategoryIds())
    if (blocked) return blocked
    const plan = planCategoryCopy(data.categories, data.mappings, id, () => uid('cat'))
    if (!plan) return ''
    data.categories.push(...plan.categories)
    data.mappings.push(...plan.mappings)
    return plan.rootId
  }

  function setCategoryMapping(categoryId: string, templateId: string) {
    data.mappings = data.mappings.filter((item) => item.categoryId !== categoryId)
    if (!templateId) return ''
    data.mappings.push({ categoryId, templateId })
    return ''
  }

  function removeSpecNode(id: string) {
    const node = data.productSpecNodes.find((item) => item.id === id)
    if (!node) return '节点不存在'
    const ids = [id, ...descendantIds(data.productSpecNodes, id)]
    const nodes = data.productSpecNodes.filter((item) => ids.includes(item.id))
    const families = data.families.filter((item) => item.templateId === node.templateId)
    const familyIds = new Set(families.map((item) => item.id))
    const used = nodes.some((item) => {
      if (item.nodeType !== 'VALUE' || !item.valueId) return false
      const name = data.params.find((param) => param.id === item.attributeId)?.name
      if (!name) return false
      return families.some((family) => family.commonAttrs[name] === item.valueId) || data.skus.some((sku) => familyIds.has(sku.familyId) && sku.variantAttrs[name] === item.valueId)
    })
    if (used) return '这个节点或下级取值已经被商品使用，不能删除。'
    data.productSpecNodes = data.productSpecNodes.filter((item) => !ids.includes(item.id))
    return ''
  }

  function shiftSpecNode(id: string, direction: -1 | 1) {
    const node = data.productSpecNodes.find((item) => item.id === id)
    if (!node) return
    const siblings = data.productSpecNodes.filter((item) => item.templateId === node.templateId && item.parentId === node.parentId).sort((a, b) => a.sort - b.sort)
    const index = siblings.findIndex((item) => item.id === id)
    const target = siblings[index + direction]
    if (!target) return
    const sort = node.sort
    node.sort = target.sort
    target.sort = sort
  }

  function removeTemplate(id: string) {
    const ids = [id, ...descendantIds(data.templates, id)]
    const blocked = modelRemovalBlock(ids)
    if (blocked) return blocked
    if (data.families.some((family) => ids.includes(family.templateId))) return '方案下还有商品，不能删除。'
    data.templates = data.templates.filter((item) => !ids.includes(item.id))
    data.templateParams = data.templateParams.filter((item) => !ids.includes(item.templateId))
    data.mappings = data.mappings.filter((item) => !ids.includes(item.templateId))
    data.productSpecNodes = data.productSpecNodes.filter((item) => !ids.includes(item.templateId))
    data.specCanvases = data.specCanvases.filter((item) => !ids.includes(item.templateId))
    data.specModelVersions = data.specModelVersions.filter((item) => !ids.includes(item.templateId))
    data.rules = data.rules.filter((item) => !ids.includes(item.templateId))
    return ''
  }

  function modelRemovalBlock(ids: string[]) {
    for (const id of ids) {
      const relationBlock = materialRelationBlock(data, 'model', id)
      if (relationBlock) return relationBlock
    }
    const versions = data.specModelVersions.filter((item) => ids.includes(item.templateId))
    const versionIds = new Set(versions.map((item) => item.id))
    const plans = (data.planningRecords || []).filter((item) => ids.includes(item.productModelId) || item.modelVersionIds.some((id) => versionIds.has(id)))
    const planIds = new Set(plans.map((item) => item.planningId))
    const materials = data.skus.filter((item) => (item.modelVersionId && versionIds.has(item.modelVersionId)) || (item.planningId && planIds.has(item.planningId)))
    const families = data.families.filter((item) => ids.includes(item.templateId) || ids.includes(item.productModelId || '') || Boolean(item.modelVersionId && versionIds.has(item.modelVersionId)))
    if (families.length || materials.length) return `不能删除。已有 ${families.length} 款商品、${materials.length} 条物料还指向这个模型，删掉后就打不开当时的规格。`
    if (plans.length) return `不能删除。还有 ${plans.length} 条规格编号需要这些发布版本才能查看。`
    if (versions.length) return `不能删除。这个模型已有 ${versions.length} 个发布版本，直接删除会丢掉历史快照。`
    return ''
  }

  function removeGroup(id: string) {
    const ids = [id, ...descendantIds(data.productGroups, id)]
    data.productGroups = data.productGroups.filter((item) => !ids.includes(item.id))
    data.families.forEach((family) => {
      family.productGroupIds = family.productGroupIds.filter((item) => !ids.includes(item))
    })
  }

  function saveView(name: string) {
    const current = currentModeQuery(activeProductListView(data))
    const view: ListView = {
      id: uid('view'),
      name,
      query: JSON.parse(JSON.stringify(data.listQuery)) as ListQuery,
      columns: JSON.parse(JSON.stringify(data.columns)) as ColumnPref[],
      keyword: current.keyword,
      viewFilters: JSON.parse(JSON.stringify(current.filters)) as ListView['viewFilters'],
    }
    view.query.keyword = current.keyword
    view.query.page = 1
    data.listViews.push(view)
    data.activeViewId = view.id
  }

  function applyView(id: string) {
    const view = data.listViews.find((item) => item.id === id)
    if (!view) return
    data.activeViewId = id
    data.listQuery = JSON.parse(JSON.stringify(view.query)) as ListQuery
    applyPresetToActiveView(data, view)
  }

  function removeView(id: string) {
    if (id === 'view-all') return
    data.listViews = data.listViews.filter((item) => item.id !== id)
    if (data.activeViewId === id) applyView('view-all')
  }

  function setRole(role: UserRole) {
    const user=data.users.find(u=>u.role===role&&u.enabled);if(user)simulateUser(user.id)
  }

  function publishSpecModel(templateId: string): { ok: boolean; message: string } {
    const next = cloneRecord(data)
    const nodes = next.productSpecNodes.filter((item) => item.templateId === templateId)
    let first: {branch:string;nodeId?:string;nodePath?:string;attributeId?:string}|undefined
    const problems = specPublishProblems(next, nodes, issue=>{if(issue.index===0)first=issue})
    if (problems.length) return first ? rejectGuide(`model.publish.${first.branch}`,problems[0]!,{savedState:'unchanged',context:{modelId:templateId,nodeId:first.nodeId||'',nodePath:first.nodePath||'',attributeId:first.attributeId||''},recovery:['edit-input','view-related']}) : withFailure({ok:false,message:problems[0]!},unknownFailure(problems[0]!,'action-model-publish','unchanged'))
    const context = modelSpecificationContext(next,templateId)
    const versions = next.specModelVersions.filter((item) => item.templateId === templateId).slice().sort((a, b) => a.version - b.version)
    const latest = versions[versions.length - 1]
    const now = new Date().toISOString()
    let canvas = next.specCanvases.find((item) => item.templateId === templateId)
    if (!canvas) {
      canvas = { templateId, zoom: 1, panX: 0, panY: 0, status: 'draft', version: 1, versionName: 'V1', direction: 'ltr', updatedAt: now }
      next.specCanvases.push(canvas)
    }
    const publishKeys: (keyof AppData)[] = ['specModelVersions', 'specCanvases', 'planningRecords']
    if (latest && latest.status === 'published' && sameSpecSnapshot(latest.nodesSnapshot, nodes)) {
      canvas.status = 'published'
      canvas.version = latest.version
      canvas.versionName = latest.versionName
      canvas.updatedAt = now
      const outcome = alignPlanning(next, templateId, latest.id, now, context.combinations)
      const committed = commitCandidate(next, { ok: true, message: `当前内容和 ${latest.versionName} 一致，没有生成新版本。${outcome.created > 0 ? `已为 ${outcome.created} 条规格组合生成规划编号。` : ''}` }, publishKeys)
      return committed.ok ? { ...committed, ok: outcome.created > 0 } : committed
    }
    const version = (latest?.version || 0) + 1
    const versionName = `V${version}`
    const versionId = uid('mv')
    next.specModelVersions.push({
      id: versionId,
      templateId,
      version,
      versionName,
      status: 'published',
      nodesSnapshot: freezeBusinessNodes(next, nodes),
      createdTime: now,
      publishTime: now,
      attributeRoles: nodes.filter(n=>n.nodeType==='ATTRIBUTE').map(n=>({attributeNodeId:n.id,roleSource:n.role?'node':'scheme',role:n.role|| (next.templateParams.find(p=>p.templateId===templateId&&p.paramId===n.attributeId)?.role==='common'?'COMMON':'VARIANT')})),
      attributeNames: next.params.map(p=>({attributeId:p.id,name:p.name})),
    })
    canvas.status = 'published'
    canvas.version = version
    canvas.versionName = versionName
    canvas.updatedAt = now
    const outcome = alignPlanning(next, templateId, versionId, now, context.combinations)
    const retired = outcome.retired ? `，停用 ${outcome.retired} 个不再存在的组合` : ''
    return commitCandidate(next, { ok: true, message: `已发布 ${versionName}。合法组合 ${outcome.created + outcome.reused} 条，新增编号 ${outcome.created} 个，沿用 ${outcome.reused} 个${retired}。已有版本不会被覆盖。` }, publishKeys)
  }

  function alignPlanning(target: AppData, templateId: string, versionId: string, now: string, combinations: ReturnType<typeof modelSpecificationContext>['combinations']) {
    if (!Array.isArray(target.planningRecords)) target.planningRecords = []
    const version = target.specModelVersions.find((item) => item.id === versionId)
    if (!version) return { created: 0, reused: 0, retired: 0 }
    const outcome = reconcilePlanningRecords({
      records: target.planningRecords,
      data: target,
      productModelId: templateId,
      modelVersionId: version.id,
      nodes: version.nodesSnapshot,
      combinations,
      now,
    })
    target.planningRecords = outcome.records
    return outcome
  }

  function createMaterial(input: { productModelId: string; modelVersionId: string; planningId: string; requestId: string; categoryId: string; productTypeId: string; familyId?: string; skuName?: string; supplierCode?: string; guanjiapoCode?: string; oaSkuId?: string; materialDescription?: string }) {
    const next = cloneRecord(data), now = new Date().toISOString()
    const result = createV3Material(next, { ...input, nextId: uid })
    return commitCreated(next, result, result.ok && result.created ? [result.skuId] : [], now)
  }

  function createTemporary(input: { requestId: string; categoryId: string; productTypeId: string; productModelId?: string; modelVersionId?: string; attrs: { attributeId: string; value: string; source: 'dictionary' | 'manual' }[]; materialCode: string; skuName?: string; supplierCode?: string; guanjiapoCode?: string; oaSkuId?: string; materialDescription?: string }) {
    const next = cloneRecord(data), now = new Date().toISOString()
    const result = createTemporaryMaterial(next, { ...input, nextId: uid })
    return commitCreated(next, result, result.ok && result.created ? [result.skuId] : [], now)
  }

  function markPlanningGrades(ids: string[], grade: ProductGrade) {
    const result = setPlanningGrades(data.planningRecords || [], ids, grade)
    data.planningRecords = result.records
    return result.changed
  }

  function updateMaterial(input: { skuId: string; skuName: string; supplierCode: string; guanjiapoCode: string; oaSkuId: string; materialDescription: string }) {
    return updateV3Material(data, input)
  }

  function renameProduct(familyId: string, name: string) {
    return renameV3Product(data, { familyId, name })
  }

  function blankSku(familyId: string, templateId: string): Sku {
    const variants = data.templateParams.filter((item) => item.templateId === templateId && item.role === 'variant')
    const bound = variants.map((item) => ({ ...item, param: data.params.find((param) => param.id === item.paramId)! })).filter((item) => item.param)
    return {
      id: uid('sku'),
      familyId,
      code: '',
      oaSkuId: '',
      status: 'on_sale',
      variantAttrs: blankVariantAttrs(bound),
      projectedAttrs: {},
    }
  }

  const rbacCommands=createRbacCommands(data,()=>effectiveUserId.value,can,next=>commitCandidate(next,{ok:true,message:'已保存。'},['rbac','users']),()=>uid('access'))
  function saveMenuStructure(nodes:MenuNode[]){
    if(!can('system:menu:update'))return {ok:false,message:'没有菜单管理权限。'}
    const registered=defaultMenuNodes()
    for(const node of nodes.filter(n=>n.kind==='page')){
      const route=registered.find(n=>n.id===node.id)?.route
      const [path,query]=String(route||'').split('?')
      const required=routePermissions(path||'/',Object.fromEntries(new URLSearchParams(query||'')))||[]
      if(node.permissionCode&&!required.includes(node.permissionCode))return {ok:false,message:'菜单只能绑定其真实路由登记的访问权限。'}
    }
    try{saveMenu(nodes);return {ok:true,message:'菜单结构已保存，角色授权保持。'}}catch(error){return {ok:false,message:String(error)}}
  }
  function resetMenuStructure(){return saveMenuStructure(defaultMenuNodes())}
  function importFeedbackPack(incoming:FeedbackItem[]){const next=cloneRecord(data);if(!Array.isArray(incoming)||incoming.some(item=>!item||typeof item.id!=='string'||typeof item.title!=='string'||typeof item.content!=='string'))return {ok:false,message:'反馈包记录结构不合法。'};const known=new Set(next.feedbacks.map(item=>item.id));next.feedbacks.unshift(...cloneRecord(incoming.filter(item=>!known.has(item.id))));return commitCandidate(next,{ok:true},['feedbacks'])}
  function markFeedbacksExported(ids:string[]){const next=cloneRecord(data),now=new Date().toISOString();next.feedbacks.forEach(item=>{if(ids.includes(item.id))item.exportedAt=now});return commitCandidate(next,{ok:true},['feedbacks'])}
  function saveBrand(input:Brand){
    const next=cloneRecord(data),old=next.brands.find(b=>b.id===input.id),name=input.name?.trim()
    if(!name||!['enabled','disabled'].includes(input.status))return {ok:false,message:'请填写品牌名称和有效状态。'}
    if(input.id&&!old)return {ok:false,message:'品牌已不存在，请重新打开；当前草稿保留。'}
    const record:Brand={...cloneRecord(input),id:old?.id||uid('brand'),name}
    if(old)Object.assign(old,record);else next.brands.push(record)
    const dictionary=next.params.find(p=>p.name==='品牌')
    if(dictionary&&!dictionary.values.includes(name)){
      if(!can('product:dictionary:update'))return {ok:false,message:'品牌名称需要同步品牌词典，但没有编辑词典权限；品牌与词典均未改变。'}
      dictionary.values.push(name)
    }
    return commitCandidate(next,{ok:true,id:record.id,message:'品牌及关联词典已保存。'},['brands','params'])
  }
  function saveRule(input:SpecRule){
    const next=cloneRecord(data),old=next.rules.find(r=>r.id===input.id)
    if(typeof input.templateId!=='string'||typeof input.targetParamId!=='string'||!Array.isArray(input.sourceParamIds)||!input.sourceParamIds.every(id=>typeof id==='string')||!Array.isArray(input.options)||!input.options.every(value=>typeof value==='string')||!input.conditions||typeof input.conditions!=='object'||Array.isArray(input.conditions)||Object.values(input.conditions).some(value=>typeof value!=='string')||typeof input.enabled!=='boolean')return {ok:false,message:'规则结构无效，当前草稿保留。'}
    if(input.id&&!old)return {ok:false,message:'规则已不存在，当前草稿保留。'}
    const record={...cloneRecord(input),id:old?.id||uid('rule')}
    if(old)Object.assign(old,record);else next.rules.push(record)
    return commitCandidate(next,{ok:true,id:record.id,message:'规则已保存。'},['rules'])
  }
  function saveTemplateScheme(input:TemplateSchemeInput){
    if(!input||typeof input.id!=='string'||typeof input.name!=='string'||!input.name.trim()||!Array.isArray(input.structureOrder)||input.structureOrder.some(id=>typeof id!=='string')||!Array.isArray(input.binds)||input.binds.some(bind=>!bind||typeof bind.paramId!=='string'||!['common','variant'].includes(bind.role)||typeof bind.required!=='boolean')||(input.enabled!==undefined&&typeof input.enabled!=='boolean')||(input.sourceId!==undefined&&typeof input.sourceId!=='string'))return {ok:false,message:'方案名称、顺序或参数绑定无效，当前草稿已保留。'}
    const old=data.templates.find(item=>item.id===input.id)
    if(input.id&&!old)return {ok:false,message:'方案已不存在，请重新打开；当前草稿保留。'}
    if(input.id&&input.sourceId)return {ok:false,message:'已有方案不能同时作为新副本提交，当前草稿保留。'}
    const source=input.sourceId?data.templates.find(item=>item.id===input.sourceId):undefined
    if(input.sourceId&&(!source||templateAccessResource(data,source.id)!=='template'))return {ok:false,message:'复制来源不是有效的普通属性方案；商品模型请使用模型复制。当前草稿保留。'}
    const codes=commandPermissions('saveTemplateScheme',[input],data)
    if(!codes.every(can))return {ok:false,message:`未授权操作：${codes.filter(code=>!can(code)).join('、')}。方案及参数绑定均未改变，草稿保留。`}
    const paramIds=new Set(data.params.map(item=>item.id))
    if(input.binds.some(bind=>!paramIds.has(bind.paramId))||input.structureOrder.some(id=>!paramIds.has(id)))return {ok:false,message:'方案使用的属性已不存在，请检查参数绑定；当前草稿保留。'}
    if(new Set(input.binds.map(bind=>bind.paramId)).size!==input.binds.length||new Set(input.structureOrder).size!==input.structureOrder.length)return {ok:false,message:'方案不能重复绑定同一属性，当前草稿保留。'}
    const next=cloneRecord(data),templateId=old?.id||uid('tpl')
    const record={...(old||source||{parentId:null,enabled:true}),id:templateId,name:input.name.trim(),structureOrder:[...input.structureOrder],enabled:input.enabled??old?.enabled??source?.enabled??true}
    if(old)Object.assign(next.templates.find(item=>item.id===templateId)!,record)
    else next.templates.push(record)
    next.templateParams=next.templateParams.filter(bind=>bind.templateId!==templateId)
    next.templateParams.push(...input.binds.map(bind=>({templateId,paramId:bind.paramId,role:bind.role,required:bind.required})))
    return commitCandidate(next,{ok:true,templateId,message:'方案及全部参数绑定已保存。'},['templates','templateParams'])
  }
  function commitCategoryMove(sourceId:string,parentId:string|null){
    const next=cloneRecord(data)
    let branch:string|undefined
    const problem=moveCategoryNode(next.categories,sourceId,parentId,new Set(next.productTypes.map(t=>t.categoryId)), value=>{branch=value})
    if(problem)return rejectGuide(`category.move.${branch}`,problem,{savedState:'unchanged',context:{categoryId:sourceId,categoryName:data.categories.find(c=>c.id===sourceId)?.name||'',targetId:parentId||'',targetName:data.categories.find(c=>c.id===parentId)?.name||''},recovery:['choose-target']})
    return commitCandidate(next,{ok:true,message:'分类已移动。'},['categories'])
  }
  function commitCategoryMoves(sourceIds: readonly string[], targetId: string | null) {
    const planned = categoryMovesCandidate(data.categories, { sourceIds, targetId }, typedCategoryIds())
    if (!planned.preview.ok || !planned.preview.changed) return planned.preview
    const next = cloneRecord(data)
    next.categories = planned.categories
    return commitCandidate(next, planned.preview, ['categories'])
  }
  function renameCategoryName(id: string, inputName: string) {
    const current = data.categories.find(item => item.id === id)
    if (!current) return rejectGuide('category.move.source-missing', '分类已不存在，名称没有保存；当前输入保留。', { actionId: 'action-category-rename', savedState: 'unchanged', context: { categoryId: id }, recovery: ['edit-input'] })
    const name = typeof inputName === 'string' ? inputName.trim() : ''
    if (!name) {
      const message = '请填写分类名称；当前输入保留。'
      return withFailure({ ok: false, message }, createFailure({ kind: 'input', actionId: 'action-category-rename', ruleId: 'rule-category-input', message, savedState: 'unchanged', context: { categoryId: id, categoryName: current.name }, fields: ['name'], recovery: ['edit-input'] }))
    }
    if (current.name === name) return { ok: true, id, name, changed: false, message: '名称没有变化，未写入数据。' }
    const next = cloneRecord(data), index = next.categories.findIndex(item => item.id === id)
    next.categories[index] = { ...next.categories[index]!, name }
    return commitCandidate(next, { ok: true, id, name, changed: true, message: '分类名称已保存。' }, ['categories'])
  }
  function restoreSuperAdminAccess(){
    if(!isSuperAdmin(data,effectiveUserId.value))return {ok:false,message:'只有有效的内置超级管理员可恢复其权限。'}
    const next=cloneRecord(data),role=next.rbac?.roles.find(r=>r.id==='role:super-admin'&&r.superAdmin&&r.builtIn)
    if(!role)return {ok:false,message:'内置超级管理员配置已损坏，不能伪造替换。'}
    role.permissionCodes=[...new Set([...role.permissionCodes,...permissionRegistry().map(p=>p.code)])]
    const issues=rbacProblems(next);if(issues.length)return {ok:false,message:issues.join(' ')}
    return commitCandidate(next,{ok:true,message:'已恢复内置超级管理员的登记权限；其他角色及业务保持。'},['rbac'])
  }
  const api = {
    addPublicSpus:(ids:string[],basis:string,isCurrent:()=>boolean=()=>true)=>{const selected=[...ids];return command(()=>{if(!isCurrent())return {ok:false,message:'选择上下文已变化，未添加'};const next=cloneRecord(data);return commitCandidate(next,addPublicSpus(next,selected,basis,new Date().toISOString()),['publicSpuPool'])})},
    setPublicSpuEnabled:(id:string,enabled:boolean,revision:number)=>command(()=>{const next=cloneRecord(data);return commitCandidate(next,updatePublicSpu(next,id,enabled,revision,new Date().toISOString()),['publicSpuPool'])}),
    removePublicSpu:(id:string,revision:number)=>command(()=>{const next=cloneRecord(data);return commitCandidate(next,removePublicSpu(next,id,revision),['publicSpuPool'])}),
    saveCompatibilityWorkspace:(changes:CompatibilityChange[],general:GeneralChange[],basis:string,isCurrent:()=>boolean=()=>true)=>{
      const commands=cloneRecord(changes),conditions=cloneRecord(general),owner=effectiveUserId.value,preview=previewUserId.value
      return command(()=>{
        if(!isCurrent()||owner!==effectiveUserId.value||preview!==previewUserId.value||basis!==compatibilityWorkspaceBasis(data))return {ok:false,message:'商品、设备或适用资料已变化，请重新打开核对；输入保留。'}
        if(!commands.length&&!conditions.length)return {ok:false,message:'没有需要保存的适用资料变更。'}
        const next=cloneRecord(data);next.compatibilities ||= []
        const explicit=applyCompatibilityChanges(next,commands,()=>uid('compat'),new Date().toISOString());if(!explicit.ok)return {ok:false,message:explicit.message||'明确型号资料无效，未保存'}
        if(conditions.length){const result=applyGeneralChanges(next,conditions,()=>uid('general'),new Date().toISOString());if(!result.ok)return {ok:false,message:result.message||'通用条件无效，未保存'}}
        return commitCandidate(next,{ok:true,message:'适用资料已保存'},['compatibilities','generalCompatibilityClaims'])
      })
    },
    saveBundleSale:(input:SaleInput,revision:number,isCurrent:()=>boolean=()=>true)=>{const value=cloneRecord(input);return command(()=>{if(!isCurrent())return {ok:false,message:'选购身份或上下文已变化，输入保留'};const next=cloneRecord(data);return commitCandidate(next,writeSale(next,value,revision,()=>uid('sale'),new Date().toISOString()),['benefitSalesLists'])})},

    saveTypeBundle:(input:GroupInput,revision:number,isCurrent:()=>boolean=()=>true)=>{const value=cloneRecord(input);return command(()=>{if(!isCurrent())return {ok:false,message:'编辑上下文已改变，输入保留'};const next=cloneRecord(data);return commitCandidate(next,writeGroup(next,value,revision,()=>uid('bundle'),new Date().toISOString()),['benefitTypeGroups'])})},
    removeTypeBundle:(id:string,revision:number,isCurrent:()=>boolean=()=>true)=>command(()=>{
      if(!isCurrent())return {ok:false,message:'操作身份或页面已变化，本次未删除。'}
      const next=cloneRecord(data)
      return commitCandidate(next,deleteGroup(next,id,revision),['benefitTypeGroups'])
    }),
    data:publicData,
    can,canRoute,currentUser,activeUserId:computed(()=>activeUserId.value),previewUserId:computed(()=>previewUserId.value),simulationReturnId,authorizationReady:computed(()=>authorizationReady.value),
    rbacEnforced: RBAC_ENFORCEMENT_ENABLED,
    simulateUser,startPermissionPreview,stopPermissionPreview,
    saveRbacRole:(...args:Parameters<typeof rbacCommands.saveRbacRole>)=>command(()=>rbacCommands.saveRbacRole(...args)),
    removeRbacRole:(...args:Parameters<typeof rbacCommands.removeRbacRole>)=>command(()=>rbacCommands.removeRbacRole(...args)),
    grantRbacRole:(...args:Parameters<typeof rbacCommands.grantRbacRole>)=>command(()=>rbacCommands.grantRbacRole(...args)),
    saveRbacPermission:(...args:Parameters<typeof rbacCommands.saveRbacPermission>)=>command(()=>rbacCommands.saveRbacPermission(...args)),
    saveRbacUser:(...args:Parameters<typeof rbacCommands.saveRbacUser>)=>command(()=>rbacCommands.saveRbacUser(...args)),
    removeRbacUser:(...args:Parameters<typeof rbacCommands.removeRbacUser>)=>command(()=>rbacCommands.removeRbacUser(...args)),
    saveMenuStructure,resetMenuStructure,
    saveBrand:(...args:Parameters<typeof saveBrand>)=>command(()=>saveBrand(...args)),
    saveRule:(...args:Parameters<typeof saveRule>)=>command(()=>saveRule(...args)),
    saveTemplateScheme:(...args:Parameters<typeof saveTemplateScheme>)=>command(()=>saveTemplateScheme(...args)),
    commitCategoryMove:(...args:Parameters<typeof commitCategoryMove>)=>command(()=>commitCategoryMove(...args)),
    commitCategoryMoves:(sourceIds: readonly string[], targetId: string | null)=>{const requested=Array.isArray(sourceIds)?[...sourceIds]:sourceIds;return command(()=>commitCategoryMoves(requested,targetId))},
    renameCategoryName:(...args:Parameters<typeof renameCategoryName>)=>command(()=>renameCategoryName(...args)),
    restoreSuperAdminAccess:()=>command(restoreSuperAdminAccess),
    importFeedbackPack:(...args:Parameters<typeof importFeedbackPack>)=>command(()=>importFeedbackPack(...args)),
    markFeedbacksExported:(...args:Parameters<typeof markFeedbacksExported>)=>command(()=>markFeedbacksExported(...args)),
    persistenceState: persistence.state,
    editorGeneration,
    waitForPersistence: persistence.idle,
    flushPersistence: persistLive,
    saveModelDraft: (...args: Parameters<typeof saveModelDraft>) => command(() => saveModelDraft(...args)),
    saveNodeBusiness: (...args: Parameters<typeof saveNodeBusiness>) => command(() => saveNodeBusiness(...args)),
    saveBusinessDefinition: (...args: Parameters<typeof saveBusinessDefinition>) => command(() => saveBusinessDefinition(...args)),
    materialImportBasis,
    commitMaterialImport: (...args: Parameters<typeof commitMaterialImport>) => command(() => commitMaterialImport(...args)),
    copyProductModel: (...args: Parameters<typeof copyProductModel>) => command(() => copyProductModel(...args)),
    commitSpuPage: (next: ProductListPageState, expectedPage = JSON.stringify(data.productListPages?.spu), isCurrent: () => boolean = () => true, manualGuard?: ListManualGuard) => {
      const copied = cloneRecord(next), copiedGuard = manualGuard && cloneRecord(manualGuard)
      return command(() => commitListPage('spu', copied, expectedPage, isCurrent, copiedGuard))
    },
    commitSkuPage: (next: ProductListPageState, isCurrent: () => boolean = () => true, manualGuard?: ListManualGuard) => {
      const expectedPage = JSON.stringify(data.productListPages?.sku)
      const copied = cloneRecord(next), copiedGuard = manualGuard && cloneRecord(manualGuard)
      return command(() => commitListPage('sku', copied, expectedPage, isCurrent, copiedGuard))
    },
    isAdmin,
    supplementHuaweiProducts:()=>command(()=>{const result=supplementHuaweiProducts(data);return result.ok?commitCandidate(result.next,{ok:true,message:result.message},[...phoneBrandKeys]):result}),
    rebuildPhoneCatalogDemo:()=>command(()=>{const result=replacePhoneCatalogDemo(data,defaultColumns(),emptyQuery());return result.ok?commitCandidate(result.next,{ok:true,message:result.message},[...phoneCatalogKeys]):result}),
    supplementPhone18Demo:()=>command(()=>{
      const result=installPhone18Demo(data)
      return result.ok?result.added?commitCandidate(result.next,{ok:true,message:result.message},[...phone18DemoKeys]):{ok:true,message:result.message}:result
    }),
    supplementPhoneDemo:()=>command(()=>{
      const before=normalizeStored({version:DATA_VERSION,data:createSeed(false)},{persist:false})!,after=normalizeStored({version:DATA_VERSION,data:createSeed()},{persist:false})!
      const result=supplementPhoneDemo(data,before,after)
      return result.ok?commitCandidate(result.next,{ok:true,message:result.message},[...demoKeys]):result
    }),
    resetAll: () => command(resetAll),
    resetModule: (...args: Parameters<typeof resetModule>) => command(() => resetModule(...args)),
    exportJson,
    importJson: (text: string) => {
      const owner=activeUserId.value,preview=previewUserId.value
      return persistence.run(() => {
        if(owner!==activeUserId.value||preview!==previewUserId.value||!can('product:import:execute'))throwImportPermission('操作者或导入授权已变化，本次导入未执行。')
        return importJson(text)
      }, (message,failure) => { throw failureError(message,failure) }, {actionId:'action-json-import',savedState:'unchanged'})
    },
    skusOf,
    saveBundle: (...args: Parameters<typeof saveBundle>) => command(() => saveBundle(...args)),
    saveSpu: (family: ProductFamily) => command(() => {
      if (family.id && !data.families.some(item => item.id === family.id)) return { ok: false as const, message: 'SPU 已不存在，请重新打开列表；未重新创建已删除的记录。' }
      const next = cloneRecord(data), result = saveSpu(next, { ...family, id: family.id || unusedCatalogId('fam') }, new Date().toISOString())
      return commitCandidate(next, result, ['families'])
    }),
    appendSkus: (...args: Parameters<typeof appendSkus>) => command(() => appendSkus(...args)),
    editSku: (...args: Parameters<typeof editSalesSku>) => command(() => editSalesSku(...args)),
    removeFamily,
    patchSku,
    removeSku,
    setSkuStatus,
    addParamValue,
    appendDictionaryValues: (attributeId: string, values: readonly string[], isCurrent: () => boolean = () => true) => {
      const copied = Array.isArray(values) ? [...values] : values
      return command(() => appendDictionaryValues(attributeId, copied, isCurrent))
    },
    commitModelDictionaryBatch: (input: ModelDictionaryBatchInput, isCurrent: () => boolean = () => true) => {
      const copied = input === undefined ? input : cloneRecord(input)
      return command(() => commitModelDictionaryBatch(copied, isCurrent)).then((result): ModelDictionaryBatchResult => ({ changed: false, nodeIds: [], skipped: [], items: [], requiredPermissions: [], ...result }))
    },
    undoModelDictionaryBatch: (entry: EditorHistoryEntry, modelId: string, session: number, isCurrent: () => boolean = () => true) => {
      const copied = cloneRecord(entry)
      return command(() => undoModelDictionaryBatch(copied, modelId, session, isCurrent))
    },
    removeParam,
    removeParamValue,
    categoryRemovalBlock,
    removeCategory,
    productTypesOf,
    saveProductType,
    commitProductType: (input: Parameters<typeof saveProductType>[0], expectedRecord = '', isCurrent: () => boolean = () => true) => {
      const value={...cloneRecord(input),...(Object.hasOwn(input,'catalogRole')?{catalogRole:input.catalogRole}:{})},owner=activeUserId.value,preview=previewUserId.value
      return command(()=>commitProductType(value,expectedRecord,()=>owner===activeUserId.value&&preview===previewUserId.value&&isCurrent()))
    },
    commitProductTypeAction: (id: string, action: 'delete'|'enabled'|'disabled', expectedRecord: string, isCurrent: () => boolean = () => true) => {
      const owner=activeUserId.value,preview=previewUserId.value
      return command(()=>commitProductTypeAction(id,action,expectedRecord,()=>owner===activeUserId.value&&preview===previewUserId.value&&isCurrent()))
    },
    removeProductType,
    setProductTypeStatus,
    setProductModelStatus: (id: string, status: 'offline', expectedUpdatedAt: string, isCurrent: () => boolean = () => true) => {
      const owner=activeUserId.value,preview=previewUserId.value
      return command(() => setProductModelStatus(id,status,expectedUpdatedAt,()=>owner===activeUserId.value&&preview===previewUserId.value&&isCurrent()))
    },
    createProductModel: (...args: Parameters<typeof createProductModel>) => command(() => createProductModel(...args)),
    addCategory,
    moveCategory,
    shiftCategory,
    relocateCategory,
    updateCategory,
    copyCategory,
    setCategoryMapping,
    removeSpecNode,
    shiftSpecNode,
    removeTemplate,
    publishSpecModel: (...args: Parameters<typeof publishSpecModel>) => command(() => publishSpecModel(...args)),
    createMaterial: (...args: Parameters<typeof createMaterial>) => command(() => createMaterial(...args)),
    saveMaterialRelation: (...args: Parameters<typeof saveMaterialRelation>) => command(() => saveMaterialRelation(...args)),
    unlinkMaterialRelation: (...args: Parameters<typeof unlinkMaterialRelation>) => command(() => unlinkMaterialRelation(...args)),
    createTemporary: (...args: Parameters<typeof createTemporary>) => command(() => createTemporary(...args)),
    markPlanningGrades,
    updateMaterial,
    renameProduct,
    removeGroup,
    saveView,
    applyView,
    removeView,
    setRole,
    blankSku,
    defaultColumns,
    emptyQuery,
  }
  const unguarded=new Set(['can','canRoute','waitForPersistence','flushPersistence','simulateUser','startPermissionPreview','stopPermissionPreview','setRole','categoryRemovalBlock','skusOf','productTypesOf','blankSku','defaultColumns','emptyQuery','materialImportBasis'])
  for(const [name,original]of Object.entries(api))if(typeof original==='function'&&!unguarded.has(name)){
    (api as any)[name]=(...args:unknown[])=>{
      const codes=commandPermissions(name,args,data)
      if(!codes.every(can)){const message=`未授权操作：${codes.join('、')}。`;throw failureError(message,branchFailure('command.permission',message,{actionId:commandAction(name),savedState:'unchanged',context:{requiredPermissions:codes.join('、'),mode:RBAC_ENFORCEMENT_ENABLED?'enforced':'unrestricted'},recovery:['view-related','feedback']}))}
      if((name==='resetAll'||name==='resetModule'||name==='supplementPhoneDemo'||name==='supplementPhone18Demo'||name==='rebuildPhoneCatalogDemo'||name==='supplementHuaweiProducts')&&!isAdmin.value)throw new Error('只有受保护的超级管理员可维护演示数据。')
      const previous=invocation;invocation={codes,actor:effectiveUserId.value,name}
      try{return (original as (...a:unknown[])=>unknown)(...args)}finally{invocation=previous}
    }
  }
  return api
})

export type { Category, FeedbackItem, ParamDef, ProductFamily, ProductGroup, ProductType, SpecRule }
