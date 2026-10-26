import { branchFailure, rejectGuide, getFailure, failureError, failureForResult, unknownFailure, withFailure, createFailure } from '../domain/guide/failure'
import type { GuideFailure } from '../domain/guide/types'
import { createCatalogSimulation } from './catalogSimulation'
import { RBAC_ENFORCEMENT_ENABLED } from '../domain/accessMode'
import { ensureRbac, rbacProblems, canPermission, isSuperAdmin, routePermissions, commandPermissions, effectivePermissions, permissionRegistry, templateAccessResource } from '../domain/rbac'
import { loadMenu, saveMenu, defaultMenuNodes, type MenuNode } from '../domain/menuConfig'
import { createRbacCommands } from './catalogRbac'
import { catalogPublicData } from './catalogAccess'
import { salesConfigurationImportProblems } from '../domain/salesConfiguration'
import { saveSalesPlanCommand, publishSalesPlanCommand, setSalesPlanStatusCommand, saveSalesBindingsCommand, saveSalesRelationCommand, type SalesPlanSave, type SalesPlanPublish, type SalesPlanStatus, type SalesBindingSave, type SalesBindingsSave, type SalesRelationSave, type SalesConfigurationResult } from '../domain/salesConfigurationCommands'
import { frameworkProductResetProblems, frameworkCommand, frameworkReference, frameworkSnapshot, frameworkSnapshotProblem, frameworkProblems, frameworkSignature } from '../domain/benefitFrameworks'
import type { BenefitFramework } from '../domain/benefitPackageTypes'
import { defineStore } from 'pinia'
import { businessDefinitions, businessImportProblems, businessIssues, businessPath, configProblem, copyBusinessConfigs, freezeBusinessNodes, type BusinessDefinition, type NodeBusinessConfig } from '../domain/nodeBusiness'
import { executeMaterialRelation, materialRelationImportProblems, markMaterialContributionChanges, revokeMaterialRelation } from '../domain/materialRelationCommands'
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
import { applyAccessoryCategoryFix, PHONE_CASE_CATEGORY_FIX } from '../domain/categoryFix'
import { dictionaryRemovalBlock } from '../domain/dictionaryGuard'
import { applyModelDictionaryBatch, modelDictionaryInputProblem, type ModelDictionaryBatchInput, type ModelDictionaryBatchResult } from '../domain/modelDictionaryCommands'
import { captureEditor, editorEntry, prepareEditorUndo, type EditorHistoryEntry } from '../domain/editorHistory'
import { blankVariantAttrs, categoryPath, descendantIds, familySkus, sameSpecSnapshot, specPublishProblems } from '../domain/logic'
import { reconcilePlanningRecords } from '../domain/planning'
import { compatibilityModelBlock, compatibilitySkuBlock } from '../domain/compatibility'
import { ensureProductListPages } from '../domain/productListPages'
import type { ProductListPageState } from '../domain/types'
import { validateProductListPage, validateProductListModeQuery } from '../domain/productListQuery'
import { validateSkuConfig } from '../domain/skuWorkbenchQuery'
import { validateListManualCommit, type ListManualGuard } from '../domain/listManualCommit'
import { SYSTEM_SKU_VIEW_ID, validateSkuWorkbenchPageShape } from '../domain/skuWorkbenchState'
import { isRealSku, isMaterialArchive } from '../domain/catalogIdentity'
import { applyCompatibilityChanges, cloneCompatibility, compatibilityImportProblems, deviceModelProblem } from '../domain/accessoryCompatibilityCommands'
import type { CompatibilityChange, CompatibilityCommandResult } from '../domain/accessoryCompatibilityCommands'
import { compatibilityFamilyTypeId, compatibilityRecordRole, deviceSourceStamp, sameDeviceHost, validateCompatibilityHost } from '../domain/deviceResolution'
import type { DeviceModel } from '../domain/accessoryCompatibilityTypes'
import { benefitPackageImportProblems, benefitPackageReferenceProblem, benefitDraftStructureIssues, cloneBenefit, createBenefitDeliverySnapshot, previewBenefitDelivery, validateBenefitPackage } from '../domain/benefitPackages'
import type { BenefitCommandResult, BenefitPackageDraft, BenefitPackageStatus } from '../domain/benefitPackageTypes'
import type { CompatibilityHost } from '../domain/types'
import { appendSkuBatch, editSku, previewSkuAppend, saveSpu, spuRemovalBlock, type SkuDraft, type SkuGeneration } from '../domain/spuSku'
import { draftHostRulesDiffer, forgetDraftNodeRules, freezeDraftNodeHosts } from '../domain/nodeCompatibility'
import { applyTemplateCompatibilitySync, invalidateTemplateSpec, markTemplateManualChanges, materializeTemplateCompatibility, previewTemplateCompatibilitySync, templateCompatibilityOriginProblems, type TemplateSyncPreview } from '../domain/templateCompatibilitySync'
import { createTemplateCompatibilityContext, freezeTemplateCompatibility, resolveTemplateCompatibility, templateCompatibilityContentSignature, templateCompatibilityImportProblems, validateTemplateCompatibilityConfig } from '../domain/templateCompatibility'
import type { TemplateCompatibilityConfig } from '../domain/templateCompatibilityTypes'
import { scrubSampleDictionary } from '../domain/compatibilitySamples'
import { createTemporaryMaterial, createV3Material, renameV3Product, setPlanningGrades, tombstoneMaterialReceipts, updateV3Material } from '../domain/material'
import type { MaterialChoice } from '../domain/material'
import type { ProductGrade } from '../domain/types'
import { arrangeSpecPositions } from '../domain/logic'
import { activeProductListView, applyPresetToActiveView, currentModeQuery, ensureProductListViews } from '../domain/productListViews'
import { createSeed, defaultColumns, emptyQuery, phoneCanvas, phoneSpecNodes } from '../domain/seed'
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

/** 版本 1 没有分类启用状态。缺省视为启用，并写回版本 2。商品、方案、映射原样保留。 */
export function normalizeStored(parsed: StoredPayload, options: { persist?: boolean } = {}): AppData | null {
  // Compatibility option retained for callers; normalization never writes. The
  // store commits migrations under the same lock as every other business write.
  void options
  migrationStorageError = ''
  const data = parsed.data
  if (!data?.families || !data.skus || !data.categories || !data.templates || !data.mappings || !data.templateParams) return null
  const version = parsed.version ?? 1
  if (version < 1 || version > DATA_VERSION) return null
  const businessProblems = businessImportProblems(data)
  if (businessProblems.length) throw new Error(`节点业务配置结构校验失败：${businessProblems.join(' ')} 原始记录已保留。`)
  const relationProblems = materialRelationImportProblems(data)
  if (relationProblems.length) throw new Error(`物料关联校验失败：${relationProblems.join(' ')} 原始记录已保留。`)
  const benefitProblems = benefitPackageImportProblems(data)
  if (benefitProblems.length) throw new Error(`权益包数据校验失败：${benefitProblems.join(' ')} 原始记录已保留。`)
  const salesProblems = salesConfigurationImportProblems(data)
  if (salesProblems.length) throw new Error(`销售配置结构校验失败：${salesProblems.join(' ')} 原始记录已保留。`)
  const templateProblems = [...templateCompatibilityImportProblems(data), ...templateCompatibilityOriginProblems(data)]
  if (templateProblems.length) throw new Error(`模板兼容数据校验失败：${templateProblems.join(' ')} 原始记录已保留。`)
  const mark = { changed: version !== DATA_VERSION }
  data.categories = data.categories.map((item) => {
    if (typeof item.enabled === 'boolean') return item
    mark.changed = true
    return { ...item, enabled: true }
  })
  renameSchemeColumn(data.columns, mark)
  data.listViews?.forEach((view) => renameSchemeColumn(view.columns, mark))
  if (!Array.isArray(data.productSpecNodes)) {
    data.productSpecNodes = phoneSpecNodes()
    mark.changed = true
  }
  if (!Array.isArray(data.specCanvases)) {
    data.specCanvases = []
    mark.changed = true
  }
  const templatesWithNodes = new Set(data.productSpecNodes.map((item) => item.templateId))
  templatesWithNodes.forEach((templateId) => {
    if (!data.specCanvases.some((item) => item.templateId === templateId)) {
      data.specCanvases.push({ ...phoneCanvas(), templateId })
      mark.changed = true
    }
  })
  data.specCanvases.forEach((canvas) => {
    if (canvas.direction === 'ltr' || canvas.direction === 'tree' || canvas.direction === 'logic' || canvas.direction === 'custom') return
    arrangeSpecPositions(data.productSpecNodes.filter((item) => item.templateId === canvas.templateId))
    canvas.direction = 'ltr'
    mark.changed = true
  })
  const needsLayout = data.productSpecNodes.some((item) => typeof item.positionX !== 'number' || typeof item.positionY !== 'number')
  if (needsLayout) {
    templatesWithNodes.forEach((templateId) => arrangeSpecPositions(data.productSpecNodes.filter((item) => item.templateId === templateId)))
    mark.changed = true
  }
  data.productSpecNodes.forEach((node) => {
    if (node.nodeType !== 'ATTRIBUTE' || node.role === 'COMMON' || node.role === 'VARIANT') return
    const bound = data.templateParams.find((item) => item.templateId === node.templateId && item.paramId === node.attributeId)
    node.role = bound?.role === 'common' ? 'COMMON' : 'VARIANT'
    mark.changed = true
  })
  if (!Array.isArray(data.specModelVersions)) {
    data.specModelVersions = []
    mark.changed = true
  }
  const versionTemplates = new Set(data.productSpecNodes.map((item) => item.templateId))
  versionTemplates.forEach((templateId) => {
    if (data.specModelVersions.some((item) => item.templateId === templateId)) return
    const canvas = data.specCanvases.find((item) => item.templateId === templateId)
    if (canvas && canvas.status !== 'published') return
    const nodes = data.productSpecNodes.filter((item) => item.templateId === templateId)
    if (!nodes.some((item) => item.nodeType === 'ATTRIBUTE')) return
    const now = canvas?.updatedAt || new Date().toISOString()
    data.specModelVersions.push({
      id: `mv-${templateId}-v1`,
      templateId,
      version: canvas?.version || 1,
      versionName: canvas?.versionName || 'V1',
      status: 'published',
      nodesSnapshot: nodes.map((item) => ({ ...item, namingRule: item.namingRule?.map((part) => ({ ...part })) })),
      createdTime: now,
      publishTime: now,
    })
    mark.changed = true
  })
  data.families.forEach((family) => {
    if (family.modelVersionId || version >= 14) return
    const published = data.specModelVersions
      .filter((item) => item.templateId === family.templateId && item.status === 'published')
      .slice()
      .sort((a, b) => a.version - b.version)
    const latest = published[published.length - 1]
    if (!latest) return
    family.modelVersionId = latest.id
    mark.changed = true
  })
  if (!Array.isArray(data.productTypes)) {
    data.productTypes = []
    mark.changed = true
  }
  data.specCanvases.forEach((canvas) => {
    if (!canvas.name) {
      const template = data.templates.find((item) => item.id === canvas.templateId)
      canvas.name = template?.name || '未命名模型'
      mark.changed = true
    }
  })
  if (!Array.isArray(data.brands)) {
    const names = new Set<string>()
    data.params.find((item) => item.name === '品牌')?.values.forEach((item) => names.add(item))
    data.families.forEach((family) => {
      if (family.commonAttrs['品牌']) names.add(family.commonAttrs['品牌'])
    })
    data.brands = [...names].map((name, index) => ({ id: `brand-${index + 1}`, name, logo: '', description: '', status: 'enabled' as const }))
    mark.changed = true
  }
  data.families.forEach((family) => {
    if (!family.shelfStatus) {
      family.shelfStatus = family.lifecycle === 'ready' ? 'online' : 'draft'
      mark.changed = true
    }
    if (!family.createdAt) {
      family.createdAt = family.updatedAt
      mark.changed = true
    }
  })
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
  if (!Array.isArray(data.compatibilities)) {
    data.compatibilities = []
    mark.changed = true
  }
  if (!Array.isArray(data.nodeCompatibilityRules)) {
    data.nodeCompatibilityRules = []
    mark.changed = true
  }
  if (scrubSampleDictionary(data)) mark.changed = true
  if (data.listQuery) {
    const defaults = emptyQuery()
    const next = { ...defaults, ...data.listQuery, attrFilters: data.listQuery.attrFilters || {} }
    if (next.createdFrom === undefined || next.shelf === undefined) mark.changed = true
    data.listQuery = next
  }
  if (ensureProductListViews(data)) mark.changed = true
  if (ensureProductListPages(data)) mark.changed = true
  const compatibilityProblems = compatibilityImportProblems(data)
  if (compatibilityProblems.length) migrationStorageError = `适用关系配置有待处理项：${compatibilityProblems.join(' ')} 原始记录已保留，请修复或导出备份。`
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
    applyAccessoryCategoryFix(data, PHONE_CASE_CATEGORY_FIX)
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
  const needsAuthorizationMigration = !originalAuthorization || originalAuthorization.salesAccessVersion !== 1
  const startingData = cloneCompatibility(startupCandidate)
  if(needsAuthorizationMigration){if(originalAuthorization)startingData.rbac=cloneCompatibility(originalAuthorization);else delete startingData.rbac;startingData.users=originalRaw?JSON.parse(originalRaw).data.users:startingData.users.map(u=>{const x={...u};delete x.roleIds;return x})}
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
    const legacy=/^\/products\/([^/]+)$/.exec(path)
    if(legacy&&legacy[1]!=='new'&&location.query?.sku){const sku=data.skus.find(s=>s.id===location.query!.sku&&s.familyId===legacy[1]);path=sku?(isMaterialArchive(data,sku)?`/materials/${sku.familyId}`:`/skus/${sku.id}`):`/spus/${legacy[1]}`}
    const permissions=routePermissions(path,location.query);return permissions!==null&&permissions.every(can)
  }
  type CommandContext={codes:string[];actor:string;name:string}
  let invocation:CommandContext|undefined
  let executingAction = 'action-business-save'
  const commandAction = (name:string) => ({ commitCategoryMove:'action-category-move', commitCategoryMoves:'action-category-move', renameCategoryName:'action-category-rename', publishSpecModel:'action-model-publish', createMaterial:'action-material-create', createTemporary:'action-material-create', saveMaterialRelation:'action-material-create', saveSpu:'action-spu-save', saveBundle:'action-spu-save', appendSkus:'action-sku-save', editSku:'action-sku-save', commitDeviceBinding:'action-compatibility-bind', applyTemplateSync:'action-compatibility-sync', applyTemplateCompatibilitySync:'action-compatibility-sync', commitSkuPage:'action-view-save', saveBenefitPackage:'action-benefit-save', generateBenefitDelivery:'action-benefit-deliver', importJson:'action-json-import', commitMaterialImport:'action-json-import', saveView:'action-view-save', saveSkuView:'action-view-save', saveRbacRole:'action-rbac-authorize', grantRbacRole:'action-rbac-authorize' } as Record<string,string>)[name] || 'action-business-save'
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
  function command<T extends { ok: boolean; message?: string }>(operation: () => T): Promise<T | CommandFailure> {
    const context=invocation
    const actionId=context?commandAction(context.name):'action-business-save'
    return persistence.run<T | CommandFailure>(()=>{
      if(context&&(context.actor!==effectiveUserId.value||!context.codes.every(can)))return rejectGuide('command.authorization-changed','操作者或授权已变化，本次提交被拒绝，草稿保留。',{actionId,savedState:'unchanged',context:{requiredPermissions:context.codes.join('、'),mode:RBAC_ENFORCEMENT_ENABLED?'enforced':'unrestricted'}})
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
  const creationKeys: (keyof AppData)[] = ['families', 'skus', 'planningRecords', 'materialReceipts', 'compatibilities', 'templateCompatibilityOrigins', 'materialRelations', 'materialContributions']
  function salesCommand(operation: (next: AppData) => SalesConfigurationResult, keys: (keyof AppData)[], isCurrent: () => boolean) {
    const owner = activeUserId.value, preview = previewUserId.value
    return command(() => {
      const current = () => owner === activeUserId.value && preview === previewUserId.value && typeof isCurrent === 'function' && isCurrent()
      if (!current()) return { ok: false, message: '操作者或配置上下文已变化，本次未保存，输入保留。' }
      const next = cloneCompatibility(data), result = operation(next)
      if (!result.ok) return result
      if (!current()) return { ok: false, message: '配置上下文已变化，本次未保存。' }
      return commitCandidate(next, result, keys)
    })
  }
  function saveMaterialRelation(input: Parameters<typeof executeMaterialRelation>[1]) {
    const next = cloneCompatibility(data)
    const result = executeMaterialRelation(next, input, uid)
    return commitCandidate(next, result, creationKeys)
  }
  function unlinkMaterialRelation(id: string, basis: string) {
    const next = cloneCompatibility(data)
    return commitCandidate(next, revokeMaterialRelation(next, id, basis), creationKeys)
  }
  function commitCreated<T extends { ok: boolean; message?: string }>(next: AppData, result: T, ids: string[], now: string) {
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
    const inherited = materializeTemplateCompatibility(next, ids, () => uid('compat'), now)
    if (!inherited.ok) return { ok: false as const, message: inherited.message || '兼容声明生成失败，未创建商品或物料。', choices: undefined, reason: undefined }
    return commitCandidate(next, result, creationKeys)
  }
  function saveTemplateCompatibility(config: TemplateCompatibilityConfig, expectedRevision?: number) {
    if (!data.templates.some(item => item.id === config.modelId) || !data.specCanvases.some(item => item.templateId === config.modelId)) return { ok: false, message: '模型或画布已不存在，未重新创建已删除模型的兼容配置；当前草稿保留。' }
    const previous = data.templateCompatibilityConfigs?.find(item => item.modelId === config.modelId)
    if ((expectedRevision ?? config.revision) !== (previous?.revision || 0)) return { ok: false, message: '模板兼容配置已更新，请重新打开后核对；当前草稿保留。' }
    const issues = validateTemplateCompatibilityConfig(data, config)
    if (issues.length) return { ok: false, message: issues.map(issue => issue.message).join(' ') }
    if (previous && templateCompatibilityContentSignature(previous) === templateCompatibilityContentSignature(config)) return { ok: true }
    const next = cloneCompatibility(data), record = cloneCompatibility(config)
    record.revision = (previous?.revision || 0) + 1; record.updatedAt = new Date().toISOString()
    next.templateCompatibilityConfigs = (next.templateCompatibilityConfigs || []).filter(item => item.modelId !== config.modelId)
    next.templateCompatibilityConfigs.push(record)
    const canvas = next.specCanvases.find(item => item.templateId === config.modelId)
    if (canvas) {
      const latest = next.specModelVersions.filter(item => item.templateId === config.modelId).sort((a, b) => a.version - b.version).at(-1)
      canvas.status = 'draft'; canvas.version = (latest?.version || 0) + 1; canvas.versionName = `V${canvas.version}`; canvas.updatedAt = record.updatedAt
    }
    return commitCandidate(next, { ok: true }, ['templateCompatibilityConfigs', 'specCanvases'])
  }
  function applyTemplateSync(preview: TemplateSyncPreview, decisions: Record<string, 'take-template' | 'keep'>) {
    const next = cloneCompatibility(data)
    const result = applyTemplateCompatibilitySync(next, preview, decisions, () => uid('compat'), new Date().toISOString())
    return commitCandidate(next, result, ['compatibilities', 'templateCompatibilityOrigins'])
  }
  function saveModelDraft(templateId: string, isCurrent: () => boolean = () => true) {
    if (!isCurrent()) return { ok: false, message: '编辑上下文已变化，本次保存已取消。' }
    if (!data.templates.some(item => item.id === templateId)) return { ok: false, message: '模型已不存在。' }
    const next = cloneCompatibility(data), canvas = next.specCanvases.find(item => item.templateId === templateId)
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
    const records = cloneCompatibility(configs)
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
    const next = cloneCompatibility(data)
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
    const next = cloneCompatibility(data)
    next.businessDefinitions = definitions.filter(d => d.id !== input.id).map(d => ({ ...d }))
    if (!remove) next.businessDefinitions.push({ ...old, name: input.name.trim(), description: input.description.trim(), enabled: input.enabled })
    return commitCandidate(next, { ok: true, message: '公共配置目录已保存，已引用实例和旧版本保持原义。' }, ['businessDefinitions'])
  }
  function materialImportBasis() {
    return JSON.stringify([data.families, data.skus, data.planningRecords, data.materialReceipts, data.compatibilities, data.templateCompatibilityOrigins, data.specModelVersions, data.templateCompatibilityConfigs, data.categories, data.productTypes, data.params, data.templates, data.specCanvases, data.productSpecNodes, data.nodeCompatibilityRules])
  }
  function commitMaterialImport(candidate:AppData,expectedBasis:string){
    if(materialImportBasis()!==expectedBasis)return rejectGuide('import.material.basis','预览后商品或模型数据已变化，请重新预览导入；当前数据未改变。',{savedState:'unchanged',recovery:['repreview']})
    const next=cloneCompatibility(data),existing=new Set(data.skus.map(item=>item.id))
    for(const key of creationKeys){if(candidate[key]!==undefined){if(!Array.isArray(candidate[key]))return {ok:false,message:`导入候选 ${key} 结构无效。`};Object.assign(next,{[key]:cloneCompatibility(candidate[key])})}}
    const changed=(a:unknown,b:unknown)=>JSON.stringify(a)!==JSON.stringify(b)
    const prefix:Partial<Record<keyof AppData,string>>={families:'product:spu',planningRecords:'product:planning',compatibilities:'product:compatibility',templateCompatibilityOrigins:'product:compatibility',materialRelations:'product:material',materialContributions:'product:material',materialReceipts:'product:material'}
    for(const key of creationKeys){
      const before=(data[key]||[]) as {id?:string}[],after=(next[key]||[]) as {id?:string}[]
      const identityOf=(row:{id?:string})=>row?.id||(key==='planningRecords'?(row as {planningId?:string})?.planningId:key==='materialReceipts'?(row as {requestId?:string})?.requestId:key==='templateCompatibilityOrigins'?(row as {key?:string})?.key:undefined)||JSON.stringify(row)
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
        else if(['materialReceipts','materialContributions','materialRelations'].includes(key)){if(old)codes=[`${prefix[key]}:${action}`]}
        else codes=[`${prefix[key]}:${action}`]
        if(!codes.every(can))return {ok:false,message:`物料导入含未经授权的其他资源修改（${key}）：${codes.filter(code=>!can(code)).join('、')}。本次未写入任何数据。`}
      }
    }
    const problems=[...materialRelationImportProblems(next),...compatibilityImportProblems(next)]
    if(problems.length)return {ok:false,message:`导入候选校验失败：${problems.join(' ')}`}
    return commitCreated(next,{ok:true},next.skus.filter(item=>!existing.has(item.id)).map(item=>item.id),new Date().toISOString())
  }

  function benefitPermission(): BenefitCommandResult | undefined {
    return undefined
  }

  /** Persist a complete candidate before exposing either configuration or snapshot changes. */
  function commitBenefitState(next: AppData, result: BenefitCommandResult): BenefitCommandResult {
    if (!result.ok) return failureForResult(result, executingAction, 'unchanged')
    if (JSON.stringify([data.benefitPackages, data.benefitDeliveries, data.benefitFrameworks]) === JSON.stringify([next.benefitPackages, next.benefitDeliveries, next.benefitFrameworks])) return result
    try {
      persistence.write(next)
      if (next.benefitPackages !== undefined) data.benefitPackages = next.benefitPackages
      else delete data.benefitPackages
      if (next.benefitDeliveries !== undefined) data.benefitDeliveries = next.benefitDeliveries
      else delete data.benefitDeliveries
      if(next.benefitFrameworks!==undefined)data.benefitFrameworks=next.benefitFrameworks;else delete data.benefitFrameworks
      explicitlyPersisted = JSON.stringify(data)
      migrationStorageError = ''
      return result
    } catch (error) {
      const message=`无法保存到本机：${error instanceof Error ? error.message : String(error)}。原数据、编辑草稿和本次请求保留，请重试。`;return withFailure({ok:false,message,validation:result.validation},caughtFailure(error,message,'unchanged'))
    }
  }

  function nextBenefitIdentity(kind: 'package' | 'delivery') {
    const codePrefix = kind === 'package' ? 'BPK' : 'BDL', idPrefix = kind === 'package' ? 'benefit-package' : 'benefit-delivery'
    const records = [...(data.benefitPackages || []), ...(data.benefitDeliveries || [])]
    const usedIds = new Set(records.map(record => record.id)), usedCodes = new Set(records.map(record => record.code))
    let number = 0
    for (const code of usedCodes) {
      const match = new RegExp(`^${codePrefix}-(\\d+)$`).exec(code)
      const value = match ? Number(match[1]) : 0
      if (Number.isSafeInteger(value)) number = Math.max(number, value)
    }
    do {
      number += 1
      if (!Number.isSafeInteger(number)) throw new Error('权益包或清单编号已超出安全范围，请检查导入编号。')
    } while (usedIds.has(`${idPrefix}-${String(number).padStart(6, '0')}`) || usedCodes.has(`${codePrefix}-${String(number).padStart(6, '0')}`))
    return { id: `${idPrefix}-${String(number).padStart(6, '0')}`, code: `${codePrefix}-${String(number).padStart(6, '0')}` }
  }

  function saveBenefitFramework(input:{draft:BenefitFramework;expectedRevision:number;requestId:string}, isCurrent: () => boolean = () => true) {
    const denied=benefitPermission();if(denied)return denied
    if (typeof isCurrent !== 'function' || !isCurrent()) return { ok: false, message: '框架编辑上下文已变化，当前规则与输入未提交。' }
    const next=cloneCompatibility(data)
    const result=frameworkCommand(next,input,()=>uid('benefit-framework'))
    if (!isCurrent()) return { ok: false, message: '框架编辑上下文已变化，当前规则与输入未提交。' }
    return commitBenefitState(next,result)
  }
  function removeBenefitFramework(id:string,revision:number){
    const denied=benefitPermission();if(denied)return denied
    const item=data.benefitFrameworks?.find(f=>f.id===id)
    if(!item||item.deletedAt||item.revision!==revision)return {ok:false,message:'框架不存在或已更新。'}
    const block=frameworkReference(data,'framework',id);if(block)return {ok:false,message:block}
    const next=cloneCompatibility(data),removed=next.benefitFrameworks!.find(f=>f.id===id)!
    removed.deletedAt=new Date().toISOString();removed.status='disabled';removed.updatedAt=removed.deletedAt
    return commitBenefitState(next,{ok:true})
  }
  function benefitSaveIntent(draft: BenefitPackageDraft, status: string) {
    const { id: _id, code: _code, revision: _revision, createdAt: _createdAt, updatedAt: _updatedAt, issues: _issues, creationRequestId: _request, creationIntent: _creation, saveReceipt: _receipt, saveReceipts: _receipts, ...content } = draft
    return frameworkSignature({ ...content, status })
  }
  function nonfiniteBenefitInput(value: unknown): boolean {
    if (typeof value === 'number') return !Number.isFinite(value)
    return !!value && typeof value === 'object' && Object.values(value).some(nonfiniteBenefitInput)
  }
  function saveBenefitPackage(input: { draft: BenefitPackageDraft; status: 'draft' | 'available'; expectedRevision?: number; requestId: string }, isCurrent: () => boolean = () => true): BenefitCommandResult {
    const denied = benefitPermission()
    if (denied) return denied
    if (typeof isCurrent !== 'function' || !isCurrent()) return { ok: false, message: '选配会话或输入已变化，本次未保存；完整草稿保留。' }
    if (!input || !input.draft || typeof input.draft !== 'object' || Array.isArray(input.draft)) return { ok: false, message: '组合草稿结构无效，本次没有保存。' }
    const structural = benefitDraftStructureIssues(input.draft)
    if (structural.length) return { ok: false, message: structural.map(issue => issue.message).join('；') }
    // JSON maps NaN/Infinity to null; reject before comparing an accepted request's intent.
    if (nonfiniteBenefitInput(input.draft)) return { ok: false, message: '组合数量或金额含无效数字，本次未保存，原输入保留。' }
    if (typeof input.requestId !== 'string' || !input.requestId.trim()) return { ok: false, message: '保存请求缺少标识，请重新打开权益包后重试。' }
    if (!['draft', 'available'].includes(input.status)) return { ok: false, message: '请选择保存草稿或保存为可用权益包。' }
    const intent = benefitSaveIntent(input.draft, input.status)
    const previous = input.draft.id ? data.benefitPackages?.find(item => item.id === input.draft.id) : undefined
    const used = data.benefitPackages?.find(item => item.id !== input.draft.id && (item.creationRequestId === input.requestId || item.saveReceipt?.requestId === input.requestId || item.saveReceipts?.some(receipt => receipt.requestId === input.requestId)))
    if (input.draft.id && used) return { ok: false, message: '该保存请求已用于另一份组合，请明确发起新的保存操作。' }
    if (!input.draft.id) {
      const receipt = data.benefitPackages?.find(item => item.creationRequestId === input.requestId)
      if (receipt) return (receipt.creationIntent ? receipt.creationIntent === intent : benefitSaveIntent(receipt, receipt.status) === intent)
        ? { ok: true, id: receipt.id, package: cloneBenefit(receipt) }
        : { ok: false, message: '该创建请求已经成功用于不同的组合内容；原组合保留，请明确发起新操作。' }
      if (used) return { ok: false, message: '该请求已经成功保存过另一份组合，不能再次用于新建；请明确发起新操作。' }
    } else if (!previous) return { ok: false, message: '权益包已不存在，未重新创建已删除的配置。' }
    if (previous?.creationRequestId === input.requestId) return (previous.creationIntent ? previous.creationIntent === intent : benefitSaveIntent(previous, previous.status) === intent)
      ? { ok: true, id: previous.id, package: cloneBenefit(previous) }
      : { ok: false, message: '该请求已经用于创建此组合，不能用不同内容重复执行保存；请发起新操作。' }
    const previousReceipt = previous?.saveReceipts?.find(receipt => receipt.requestId === input.requestId) ?? (previous?.saveReceipt?.requestId === input.requestId ? previous.saveReceipt : undefined)
    if (previous && previousReceipt) {
      const receipt = previousReceipt
      return receipt.intent === intent && receipt.sourceRevision === (input.expectedRevision ?? input.draft.revision) && receipt.resultRevision === previous.revision
        ? { ok: true, id: previous.id, package: cloneBenefit(previous) }
        : { ok: false, message: '该保存请求已成功受理，但意图或修订已变化；请重新核对后发起新操作。' }
    }
    if (previous && (input.expectedRevision ?? input.draft.revision) !== previous.revision) return rejectGuide('benefit.save.revision', '权益包已被更新，请重新打开并核对最新配置；当前草稿保留。', {savedState:'unchanged',recovery:['repreview','edit-input']})
    if (previous && !Number.isSafeInteger(previous.revision + 1)) return { ok: false, message: '权益包修订版本已超出安全范围，当前配置未改变。' }
    if (previous && !previous.creationRequestId && data.benefitPackages?.some(item => item.id !== previous.id && item.creationRequestId === input.requestId)) return { ok: false, message: '保存请求已属于另一权益包，请重新发起当前保存操作。' }
    if(input.draft.framework){
      const binding=input.draft.framework, problem=frameworkSnapshotProblem(binding)
      if(problem)return {ok:false,message:problem}
      if(frameworkSignature(previous?.framework)!==frameworkSignature(binding)){
        const f=data.benefitFrameworks?.find(f=>f.id===binding.frameworkId)
        if(!f||f.status!=='available'||frameworkSignature(frameworkSnapshot(f))!==frameworkSignature(binding))return {ok:false,message:'框架已变更或停用，请重新选择当前修订；原成员和报价保留。'}
      }
    }
    const draft = cloneBenefit(input.draft)
    draft.status = input.status
    const validation = validateBenefitPackage(data, draft)
    if (!validation.canSaveDraft || input.status === 'available' && !validation.canSaveAvailable) return withFailure({ ok: false, message: validation.issues.filter(issue => issue.structural || input.status === 'available' && issue.severity === 'error').map(issue => issue.message).join(' ') || '当前配置需要处理，请保存草稿或完善内容。', validation }, branchFailure(validation.issues.some(issue=>issue.code==='quote')?'benefit.quote.invalid':'benefit.save.validation',validation.issues.filter(issue=>issue.structural||input.status==='available'&&issue.severity==='error').map(issue=>issue.message).join(' ')||'当前配置需要处理，请保存草稿或完善内容。',{savedState:'unchanged',fields:validation.issues.flatMap(issue=>issue.field?[issue.field]:[]),context:{packageId:input.draft.id||''},recovery:['edit-input']}))
    try {
      const next = cloneCompatibility(data), now = new Date().toISOString(), identity = previous ? { id: previous.id, code: previous.code } : nextBenefitIdentity('package')
      const record: BenefitPackageDraft = { ...draft, ...identity, goods: validation.goods.map(item => ({ ...cloneBenefit(item.line), snapshot: cloneBenefit(item.summary) })), revision: (previous?.revision || 0) + 1, createdAt: previous?.createdAt || now, updatedAt: now, issues: validation.issues.map(issue => issue.message), creationRequestId: previous?.creationRequestId || input.requestId,
        creationIntent: previous ? previous.creationIntent : intent,
        saveReceipts: [...(previous?.saveReceipts ?? (previous?.saveReceipt ? [cloneBenefit(previous.saveReceipt)] : [])), { requestId: input.requestId, intent, sourceRevision: previous?.revision || 0, resultRevision: (previous?.revision || 0) + 1 }] }
      delete record.saveReceipt
      next.benefitPackages = [...(next.benefitPackages || [])]
      const index = next.benefitPackages.findIndex(item => item.id === identity.id)
      if (index >= 0) next.benefitPackages[index] = record
      else next.benefitPackages.push(record)
      if (!isCurrent()) return { ok: false, message: '选配会话或输入已变化，本次未保存；完整草稿保留。' }
      return commitBenefitState(next, { ok: true, id: record.id, package: cloneBenefit(record), validation })
    } catch (error) { return { ok: false, message: error instanceof Error ? error.message : String(error), validation } }
  }

  function setBenefitPackageStatus(id: string, status: BenefitPackageStatus, expectedRevision: number): BenefitCommandResult {
    const denied = benefitPermission()
    if (denied) return denied
    const previous = data.benefitPackages?.find(item => item.id === id)
    if (!previous || previous.revision !== expectedRevision) return { ok: false, message: '权益包不存在或已更新，请重新打开最新配置。' }
    if (!['draft', 'available', 'disabled'].includes(status)) return { ok: false, message: '权益包状态无效。' }
    if (previous.status === status) return { ok: true, id, package: cloneCompatibility(previous) }
    if (!Number.isSafeInteger(previous.revision + 1)) return { ok: false, message: '权益包修订版本已超出安全范围，当前配置未改变。' }
    const validation = validateBenefitPackage(data, { ...previous, status })
    if (status === 'available' && !validation.canSaveAvailable) return { ok: false, message: validation.issues.filter(issue => issue.severity === 'error').map(issue => issue.message).join(' '), validation }
    const next = cloneCompatibility(data), record = next.benefitPackages?.find(item => item.id === id)
    if (!record) return { ok: false, message: '权益包已不存在，请重新打开列表。' }
    record.status = status; record.revision += 1; record.updatedAt = new Date().toISOString(); record.issues = validation.issues.map(issue => issue.message)
    return commitBenefitState(next, { ok: true, id, package: cloneCompatibility(record), validation })
  }

  function setBenefitPackageFavorite(id: string, favorite: boolean, expectedRevision: number): BenefitCommandResult {
    const denied = benefitPermission()
    if (denied) return denied
    const previous = data.benefitPackages?.find(item => item.id === id)
    if (!previous || previous.revision !== expectedRevision) return { ok: false, message: '权益包不存在或已更新，请重新打开最新配置。' }
    if (previous.favorite === favorite) return { ok: true, id, package: cloneCompatibility(previous) }
    if (!Number.isSafeInteger(previous.revision + 1)) return { ok: false, message: '权益包修订版本已超出安全范围，当前配置未改变。' }
    const next = cloneCompatibility(data), record = next.benefitPackages?.find(item => item.id === id)
    if (!record) return { ok: false, message: '权益包已不存在，请重新打开列表。' }
    record.favorite = favorite; record.revision += 1; record.updatedAt = new Date().toISOString()
    return commitBenefitState(next, { ok: true, id, package: cloneCompatibility(record) })
  }

  function generateBenefitDelivery(input: { packageId: string; expectedRevision: number; requestId: string; packageCount: number; expectedBasis: string }, isCurrent: () => boolean = () => true): BenefitCommandResult {
    const denied = benefitPermission()
    if (denied) return denied
    if (typeof isCurrent !== 'function' || !isCurrent()) return { ok: false, message: '交付预览或选配会话已变化，本次没有生成清单。' }
    if (typeof input.requestId !== 'string' || !input.requestId.trim()) return { ok: false, message: '本次生成请求缺少标识，请重新预览。' }
    const receipt = data.benefitDeliveries?.find(item => item.requestId === input.requestId)
    if (receipt) return receipt.packageId === input.packageId && (!(receipt.snapshotVersion !== 1 || receipt.framework || receipt.goods.some(l=>l.referencePrice) || receipt.services.some(l=>l.referencePrice)) || receipt.packageCount === input.packageCount && receipt.sourceRevision === input.expectedRevision && receipt.basis === input.expectedBasis) ? { ok: true, id: receipt.id, delivery: cloneCompatibility(receipt) } : { ok: false, message: '本次请求已用于其他权益包或不同交付依据，请发起新的生成操作。' }
    const source = data.benefitPackages?.find(item => item.id === input.packageId)
    if (!source || source.revision !== input.expectedRevision) return rejectGuide('benefit.deliver.revision', '权益包已更新或不存在，请重新预览完整组成和报价。', {savedState:'unchanged',recovery:['repreview','edit-input']})
    const preview = previewBenefitDelivery(data, source, input.packageCount)
    if (!preview.canConfirm) { const message=preview.issues.filter(issue => issue.severity !== 'warning').map(issue => issue.message).join(' ') || '当前配置不能生成正式清单。';return rejectGuide(preview.issues.some(issue=>['quote','quote-review','delivery-quote'].includes(issue.code))?'benefit.deliver.quote':'benefit.deliver.validation',message,{actionId:'action-benefit-deliver',savedState:'unchanged',context:{packageId:input.packageId},recovery:['edit-input','repreview']}) }
    if (!input.expectedBasis || preview.basis !== input.expectedBasis) return rejectGuide('benefit.deliver.basis', '商品、兼容条件或报价依据已变化，请重新预览并确认。', {savedState:'unchanged',recovery:['repreview','edit-input']})
    try {
      const identity = nextBenefitIdentity('delivery')
      const delivery = createBenefitDeliverySnapshot(preview, { ...identity, requestId: input.requestId, generatedAt: new Date().toISOString() })
      const next = cloneCompatibility(data)
      next.benefitDeliveries = [...(next.benefitDeliveries || []), delivery]
      if (!isCurrent()) return { ok: false, message: '交付预览或选配会话已变化，本次没有生成清单。' }
      return commitBenefitState(next, { ok: true, id: delivery.id, delivery: cloneCompatibility(delivery) })
    } catch (error) { return { ok: false, message: error instanceof Error ? error.message : String(error) } }
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

  function compatibilityPermission(): CompatibilityCommandResult | undefined {
    return undefined
  }

  /** Only these compatibility-owned arrays are changed, after the full payload is stored. */
  function commitCompatibilityState(next: AppData, result: CompatibilityCommandResult): CompatibilityCommandResult {
    if (!result.ok) return failureForResult(result, executingAction, 'unchanged')
    const before = JSON.stringify([data.compatibilities, data.deviceModels, data.deviceBindings, data.templateCompatibilityOrigins, data.materialContributions])
    if (before === JSON.stringify([next.compatibilities, next.deviceModels, next.deviceBindings, next.templateCompatibilityOrigins, next.materialContributions])) return result
    try {
      persistence.write(next)
      data.compatibilities = next.compatibilities
      if (next.deviceModels !== undefined) data.deviceModels = next.deviceModels
      else delete data.deviceModels
      if (next.deviceBindings !== undefined) data.deviceBindings = next.deviceBindings
      else delete data.deviceBindings
      if (next.templateCompatibilityOrigins !== undefined) data.templateCompatibilityOrigins = next.templateCompatibilityOrigins
      else delete data.templateCompatibilityOrigins
        if (next.materialContributions !== undefined) data.materialContributions = next.materialContributions
        else delete data.materialContributions
      explicitlyPersisted = JSON.stringify(data)
      migrationStorageError = ''
      return result
    } catch (error) {
      const message=`无法保存到本机：${error instanceof Error ? error.message : String(error)}。当前数据未改变，操作草稿已保留，请重试。`;return withFailure({...result,ok:false,message},caughtFailure(error,message,'unchanged'))
    }
  }

  function commitCompatibilityChanges(changes: CompatibilityChange[]): CompatibilityCommandResult {
    const denied = compatibilityPermission()
    if (denied) return denied
    const next = cloneCompatibility(data)
    const now = new Date().toISOString()
    const result = applyCompatibilityChanges(next, changes, () => uid('compat'), now)
    if (result.ok) markTemplateManualChanges(next, (result.preview?.items || []).filter(item => item.state === 'edit' || item.state === 'remove').map(item => item.change), now)
    if (result.ok) markMaterialContributionChanges(next, (result.preview?.items || []).filter(item => item.state === 'edit' || item.state === 'remove').map(item => item.change))
    return commitCompatibilityState(next, result)
  }

  function commitDeviceBinding(input: { skuId: string; host: CompatibilityHost; replaceExisting?: boolean; expectedSourceStamp?: string }): CompatibilityCommandResult {
    const denied = compatibilityPermission()
    if (denied) return denied
    const sku = data.skus.find(item => item.id === input.skuId)
    if (!sku || !isRealSku(data, sku) || compatibilityRecordRole(data, sku.id) !== 'host') return rejectGuide('compatibility.bind.target', '请选择真实的主机销售 SKU，不能绑定 MAT 或配件。', {savedState:'unchanged',recovery:['repreview','edit-input']})
    if (input.host.productTypeId !== compatibilityFamilyTypeId(data, sku.familyId)) return rejectGuide('compatibility.bind.type', '设备型号与当前 SKU 的产品类型不一致，请选择相同主机类型的型号。', {savedState:'unchanged',recovery:['repreview','edit-input']})
    if (input.host.scope !== 'model') return rejectGuide('compatibility.bind.scope', '绑定设备型号时请选择型号级目标，规划范围由设备自己的来源确认。', {savedState:'unchanged',recovery:['repreview','edit-input']})
    const problem = validateCompatibilityHost(data, input.host)
    if (problem) return { ok: false, message: problem }
    const stamp = deviceSourceStamp(data, sku.id)
    if (input.expectedSourceStamp !== undefined && stamp !== input.expectedSourceStamp) return rejectGuide('compatibility.bind.basis', '设备来源已变化，请重新打开型号配置后确认。', {savedState:'unchanged',recovery:['repreview','edit-input']})
    const previous = data.deviceBindings?.find(binding => binding.skuId === sku.id)
    if (previous && !input.replaceExisting) return rejectGuide('compatibility.bind.replace', '这条设备已有绑定；重新绑定会改变查询适用配件的型号，请明确确认原绑定及影响。', {savedState:'unchanged',recovery:['repreview','edit-input']})
    if (previous && previous.sourceStamp === stamp && sameDeviceHost(previous.host, input.host)) return { ok: true }
    const next = cloneCompatibility(data), now = new Date().toISOString()
    next.deviceBindings = (next.deviceBindings || []).filter(binding => binding.skuId !== sku.id)
    next.deviceBindings.push({ skuId: sku.id, host: cloneCompatibility(input.host), sourceStamp: stamp, createdAt: previous?.createdAt || now, updatedAt: now })
    return commitCompatibilityState(next, { ok: true })
  }

  function clearDeviceBinding(skuId: string): CompatibilityCommandResult {
    const denied = compatibilityPermission()
    if (denied) return denied
    const next = cloneCompatibility(data)
    if (!next.deviceBindings?.some(binding => binding.skuId === skuId)) return { ok: true }
    next.deviceBindings = next.deviceBindings.filter(binding => binding.skuId !== skuId)
    return commitCompatibilityState(next, { ok: true })
  }

  function saveDeviceModel(input: { id?: string; name: string; productTypeId: string; attributes: Record<string, string> }): CompatibilityCommandResult {
    const denied = compatibilityPermission()
    if (denied) return denied
    const problem = deviceModelProblem(data, input)
    if (problem) return { ok: false, message: problem }
    const previous = input.id ? data.deviceModels?.find(model => model.id === input.id) : undefined
    if (input.id && !previous) return { ok: false, message: '设备型号已不存在，未重新创建已删除的记录。' }
    if (previous && previous.productTypeId !== input.productTypeId && (data.compatibilities.some(link => link.host.productModelId === `device:${previous.id}`) || data.deviceBindings?.some(binding => binding.host.productModelId === `device:${previous.id}`))) return { ok: false, message: '型号已有正式声明或设备绑定，不能改变产品类型。' }
    const next = cloneCompatibility(data), now = new Date().toISOString()
    let id = previous?.id || uid('device')
    while (!previous && next.deviceModels?.some(model => model.id === id)) id = uid('device')
    const model: DeviceModel = { id, name: input.name.trim(), productTypeId: input.productTypeId, attributes: cloneCompatibility(input.attributes), createdAt: previous?.createdAt || now, updatedAt: now }
    next.deviceModels = (next.deviceModels || []).filter(item => item.id !== id)
    next.deviceModels.push(model)
    return commitCompatibilityState(next, { ok: true, id })
  }

  function removeDeviceModel(id: string): CompatibilityCommandResult {
    const denied = compatibilityPermission()
    if (denied) return denied
    const benefitBlock = benefitPackageReferenceProblem(data, 'model', `device:${id}`)
    if (benefitBlock) return { ok: false, message: benefitBlock }
    if (data.compatibilities.some(link => link.host.productModelId === `device:${id}`) || data.deviceBindings?.some(binding => binding.host.productModelId === `device:${id}`)) return { ok: false, message: '型号仍有正式兼容声明或设备绑定，请先处理引用。' }
    const next = cloneCompatibility(data)
    if (!next.deviceModels?.some(model => model.id === id)) return { ok: true }
    next.deviceModels = next.deviceModels.filter(model => model.id !== id)
    return commitCompatibilityState(next, { ok: true })
  }

  function unusedCatalogId(prefix: 'fam' | 'sku') {
    let id: string
    do { id = uid(prefix) } while (data.families.some(item => item.id === id) || data.skus.some(item => item.id === id) || data.materialReceipts.some(item => item.skuId === id) || data.compatibilities.some(item => item.accessorySkuId === id))
    return id
  }

  function replaceAll(next: AppData) {
    editorGeneration.value += 1
    ensureProductListPages(next)
    Object.assign(data, next)
    if (next.salesOptionPlans === undefined) delete data.salesOptionPlans
    if (next.salesOptionBindings === undefined) delete data.salesOptionBindings
    if (next.salesProductRelations === undefined) delete data.salesProductRelations
    if (next.deviceModels === undefined) delete data.deviceModels
    if (next.deviceBindings === undefined) delete data.deviceBindings
    if (next.benefitFrameworks === undefined) delete data.benefitFrameworks
    if (next.benefitPackages === undefined) delete data.benefitPackages
    if (next.benefitDeliveries === undefined) delete data.benefitDeliveries
    if (next.templateCompatibilityConfigs === undefined) delete data.templateCompatibilityConfigs
    if (next.templateCompatibilityOrigins === undefined) delete data.templateCompatibilityOrigins
    if (next.materialRelations === undefined) delete data.materialRelations
    if (next.materialContributions === undefined) delete data.materialContributions
  }

  function resetAll() {
    const next = createSeed()
    next.rbac=cloneCompatibility(data.rbac);next.users=cloneCompatibility(data.users)
    persistence.write(next, true)
    replaceAll(next)
    explicitlyPersisted = JSON.stringify(data)
    return { ok: true as const }
  }

  function resetModule(name: ModuleName) {
    const next = cloneCompatibility(data)
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
    if(name==='products'){
      const problems=frameworkProductResetProblems(data,next)
      if(problems.length)return {ok:false,message:`商品模块重置被拒绝：${problems.join(' ')} 请先修正相关框架包。`}
    }
    const frameworkResetProblems=(next.benefitFrameworks||[]).filter(f=>!f.deletedAt).flatMap(f=>f.history.flatMap(v=>frameworkProblems(next,v.groups)))
    if(frameworkResetProblems.length)return {ok:false,message:`模块重置会破坏权益包框架：${frameworkResetProblems.join(' ')}`}
    const relationProblems = materialRelationImportProblems(next)
    if (relationProblems.length) return { ok: false as const, message: `本模块重置会破坏物料关联：${relationProblems.join(' ')}；请保留当前数据或恢复完整备份。` }
    persistence.write(next, true)
    replaceAll(next)
    explicitlyPersisted = JSON.stringify(data)
    return { ok: true as const }
  }

  function exportJson() {
    return JSON.stringify({ version: DATA_VERSION, data }, null, 2)
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
    const templateProblems = [...templateCompatibilityImportProblems(parsed.data), ...templateCompatibilityOriginProblems(parsed.data)]
    if (templateProblems.length) throwImportValidation(`模板兼容导入校验失败：${templateProblems.join(' ')} 当前数据没有被替换。`)
    const benefitProblems = benefitPackageImportProblems(parsed.data)
    if (benefitProblems.length) throwImportValidation(`权益包导入校验失败：${benefitProblems.join(' ')} 当前数据没有被替换。`)
    const salesProblems = salesConfigurationImportProblems(parsed.data)
    if (salesProblems.length) throwImportValidation(`销售配置导入校验失败：${salesProblems.join(' ')} 当前数据没有被替换。`)
    const compatibilityProblems = compatibilityImportProblems(parsed.data)
    if (compatibilityProblems.length) throwImportValidation(`适用关系导入校验失败：${compatibilityProblems.join(' ')} 当前数据没有被替换。`)
    const next = normalizeStored(parsed, { persist: false })
    if (!next?.params) throwImportValidation('演示数据版本不匹配，当前数据没有被替换')
    const authChanged=JSON.stringify([next.rbac,next.users])!==JSON.stringify([data.rbac,data.users])
    if(authChanged){
      if(!can('system:role:grant')||!can('system:user:bind')||!can('system:permission:update'))throwImportPermission('导入不能修改当前操作者无权维护的授权或用户角色绑定。')
      const own=effectivePermissions(data,effectiveUserId.value)
      if(!isAdmin.value&&next.rbac!.roles.some(role=>role.superAdmin||role.permissionCodes.some(code=>!own.has(code))))throwImportPermission('导入不能取得超级管理员身份或超出操作者委派范围。')
    }
    const prefixes:Partial<Record<keyof AppData,string>>={families:'product:spu',skus:'product:sku',productSpecNodes:'product:model',specCanvases:'product:model',specModelVersions:'product:model',businessDefinitions:'product:model',nodeCompatibilityRules:'product:model',materialRelations:'product:material',materialContributions:'product:material',materialReceipts:'product:material',compatibilities:'product:compatibility',deviceModels:'product:compatibility',deviceBindings:'product:compatibility',templateCompatibilityConfigs:'product:model',templateCompatibilityOrigins:'product:compatibility',benefitPackages:'product:benefit',benefitDeliveries:'product:delivery',benefitFrameworks:'product:framework',salesOptionPlans:'product:sales-config',salesOptionBindings:'product:sales-config',salesProductRelations:'product:compatibility',categories:'product:category',params:'product:dictionary',templates:'product:model',templateParams:'product:template',mappings:'product:template',productTypes:'product:type',rules:'product:rule',brands:'product:brand',productGroups:'product:group',planningRecords:'product:planning',productPlans:'product:planning',feedbacks:'system:feedback',profile:'system:account'}
    const preferences=new Set(['mode','activeRole','productListPages','productListViews','activeProductListViewId','columns','listViews','activeViewId','listQuery','productListMode'])
    for(const key of new Set([...Object.keys(data),...Object.keys(next)])){
      if(key==='rbac'||key==='users'||preferences.has(key)||JSON.stringify((data as any)[key])===JSON.stringify((next as any)[key]))continue
      const prefix=prefixes[key as keyof AppData]
      if(!prefix)throwImportValidation(`导入含未登记的变更字段：${key}`)
      const old=(data as any)[key],value=(next as any)[key]
      if (['salesOptionPlans','salesOptionBindings','salesProductRelations'].includes(key) && Array.isArray(old)) {
        for (const previous of old.filter(row=>row.schemaVersion!==1)) {
          const incoming = Array.isArray(value) ? value.find(row=>row.id===previous.id) : undefined
          if (!incoming || frameworkSignature(incoming)!==frameworkSignature(previous)) throwImportValidation('未知版本销售记录只读保留，导入不能改写、移除或降级已有记录。')
        }
      }
      if (key === 'salesOptionPlans' || key === 'salesOptionBindings') {
        const oldRows = Array.isArray(old) ? old : [], nextRows = Array.isArray(value) ? value : []
        const formalChange = key === 'salesOptionPlans'
          ? JSON.stringify(oldRows.map(row=>[row.id,row.versions,row.publishedVersion,row.status])) !== JSON.stringify(nextRows.map(row=>[row.id,row.versions,row.publishedVersion,row.status]))
          : oldRows.some(row=>row.enabled) || nextRows.some(row=>row.enabled)
        if (formalChange && !can('product:sales-config:publish')) throwImportPermission('导入不能绕过销售方案发布及正式范围应用权限。')
        if (key === 'salesOptionPlans') for (const previous of oldRows.filter(row=>row.schemaVersion===1)) {
          const replacement = nextRows.find(row=>row.id===previous.id)
          if (!replacement) continue
          for (const version of previous.versions) {
            const incoming = replacement.schemaVersion===1 && replacement.versions.find((row:{version:number})=>row.version===version.version)
            if (!incoming || JSON.stringify(incoming) !== JSON.stringify(version)) throwImportValidation('导入不能改写或移除已有销售方案的冻结发布版本，请发布新版本。')
          }
        }
      }
      if(key==='specModelVersions'){if(!can('product:model:publish'))throwImportPermission('无权导入或改写模型发布快照。');continue}
      if(Array.isArray(old)&&Array.isArray(value)){
        const byId=(item:any)=>item.id||JSON.stringify(item)
        const keys=new Set([...old,...value].map(byId))
        for(const identity of keys){const a=old.find((v:any)=>byId(v)===identity),b=value.find((v:any)=>byId(v)===identity);if(JSON.stringify(a)===JSON.stringify(b))continue;if(key==='families'&&b&&!commandPermissions('saveSpu',[b],data).every(can))throwImportPermission('导入不能绕过商品编辑或发布权限。');if(key==='skus'&&a&&b&&isMaterialArchive(data,a)!==isMaterialArchive(next,b)&&(!can('product:sku:update')||!can('product:material:update')))throwImportPermission('导入不能跨越 SKU/MAT 身份权限。');const templateRow=(key==='templates'||key==='templateParams'||key==='mappings');const templateId=key==='templates'?(b||a)?.id:(b||a)?.templateId;const resource=templateRow?`product:${templateAccessResource(b?next:data,templateId||'')}`:key==='skus'&&((a||b)?.recordKind==='material'||(a||b)?.materialCode)?'product:material':prefix;const action=key==='templateParams'||key==='mappings'?'update':!a?'create':!b?'delete':'update';if(!can(`${resource}:${action}`))throwImportPermission(`导入被拒绝：没有 ${resource}:${action}，当前数据及会话未改变。`)}
      }else if(!can(`${prefix}:update`))throwImportPermission(`导入被拒绝：没有 ${prefix}:update。`)
    }
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
        const oldAttrs = JSON.stringify(existing.variantAttrs)
        const edited = editSku(trial, sku.id, sku, now)
        if (!edited.ok) return edited
        if (oldAttrs !== JSON.stringify(sku.variantAttrs)) invalidateTemplateSpec(trial, sku.id, now)
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
    const next = cloneCompatibility(data), now = new Date().toISOString()
    const result = appendSkuBatch(next, { familyId, generation, selectedKeys, now, nextId: () => unusedCatalogId('sku') })
    return commitCreated(next, result, result.ok ? result.ids : [], now)
  }
  function editSalesSku(id: string, draft: SkuDraft) {
    const next = cloneCompatibility(data), before = next.skus.find(item => item.id === id), oldAttrs = before && JSON.stringify(before.variantAttrs), now = new Date().toISOString()
    const result = editSku(next, id, draft, now)
    if (result.ok && oldAttrs !== JSON.stringify(draft.variantAttrs)) invalidateTemplateSpec(next, id, now)
    return commitCandidate(next, result, ['families', 'skus', 'compatibilities', 'templateCompatibilityOrigins'])
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
    const benefitBlock = benefitPackageReferenceProblem(data, 'sku', id)
    if (benefitBlock) return benefitBlock
    const blocked = compatibilitySkuBlock(data, id)
    if (blocked) return blocked
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
    const next = cloneCompatibility(data)
    next.params.find(param => param.id === attributeId)!.values.push(...addedValues)
    return commitCandidate(next, { ok: true, message: addedValues.length ? `已保存 ${addedValues.length} 个新取值${existingValues.length ? `，跳过 ${existingValues.length} 个已有取值` : ''}。` : '所选取值均已存在，没有重复写入。', addedValues, existingValues }, ['params'])
  }

  function markDictionaryDraft(next: AppData, modelId: string) {
    const canvas = next.specCanvases.find(item => item.templateId === modelId)
    if (!canvas || canvas.status === 'offline') return
    const latest = next.specModelVersions.filter(item => item.templateId === modelId && item.status === 'published').sort((a, b) => a.version - b.version).at(-1)
    const sameCompatibility = templateCompatibilityContentSignature(next.templateCompatibilityConfigs?.find(item => item.modelId === modelId)) === templateCompatibilityContentSignature(latest?.templateCompatibilitySnapshot)
    if (latest && sameSpecSnapshot(latest.nodesSnapshot, next.productSpecNodes.filter(item => item.templateId === modelId)) && sameCompatibility) {
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
    const before = captureEditor(data, input.modelId), next = cloneCompatibility(data)
    const planned = { ...applyModelDictionaryBatch(next, input, uid), requiredPermissions: codes }
    if (!planned.ok) return planned
    const historyEntry = editorEntry(input.modelId, input.session, before, captureEditor(next, input.modelId))
    if (historyEntry) { historyEntry.commandId = uid('editor-command'); markDictionaryDraft(next, input.modelId) }
    if (!isCurrent()) return { ok: false, message: '模型编辑上下文已变化，本次没有保存；原输入保留。' }
    const committed = commitCandidate(next, { ...planned, historyEntry }, ['params', 'templates', 'templateParams', 'productSpecNodes', 'specCanvases'])
    if (committed.ok && historyEntry?.commandId) dictionaryCommandReceipts.set(historyEntry.commandId, { actor: effectiveUserId.value, generation: editorGeneration.value, entry: cloneCompatibility(historyEntry), codes })
    return committed
  }
  function undoModelDictionaryBatch(entry: EditorHistoryEntry, modelId: string, session: number, isCurrent: () => boolean) {
    const receipt = entry?.commandId && dictionaryCommandReceipts.get(entry.commandId)
    if (!isCurrent() || !receipt || receipt.actor !== effectiveUserId.value || receipt.generation !== editorGeneration.value || JSON.stringify(entry) !== JSON.stringify(receipt.entry)) return { ok: false, message: '本次撤销回执或编辑身份已失效，未修改当前数据。' }
    if (![...receipt.codes, ...commandPermissions('undoModelDictionaryBatch', [receipt.entry], data)].every(can)) return { ok: false, message: '当前授权已变化，不能撤销这次词典和模型操作。' }
    const prepared = prepareEditorUndo(data, receipt.entry, modelId, session)
    if (!prepared.ok) return prepared
    const next = cloneCompatibility(data)
    next.params = prepared.params; next.productSpecNodes = prepared.nodes; next.templateParams = prepared.bindings; next.nodeCompatibilityRules = prepared.nodeRules
    next.templates.find(item => item.id === modelId)!.structureOrder = prepared.order
    markDictionaryDraft(next, modelId)
    const committed = commitCandidate(next, { ok: true, message: '已撤销这一次批量操作，其他模型和历史版本保持。' }, ['params', 'templates', 'templateParams', 'productSpecNodes', 'nodeCompatibilityRules', 'specCanvases'])
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

  function saveProductType(input: { id: string; name: string; categoryId: string; description: string; sort: number; status: ProductType['status'] }) {
    const name = input.name.trim()
    if (!name) return '请填写产品类型名称。'
    const category = data.categories.find((item) => item.id === input.categoryId)
    if (!category) return '目标分类不存在或已经删除。'
    if (category.enabled === false) return '目标分类已停用，不能关联。'
    const leafBlock = blockTypeOnNonLeaf(data.categories, input.categoryId)
    if (leafBlock) return leafBlock
    const duplicated = data.productTypes.some((item) => item.categoryId === input.categoryId && item.name === name && item.id !== input.id)
    if (duplicated) return '这个分类下已经有同名产品类型。'
    const description = input.description.trim()
    const sort = Number.isFinite(input.sort) ? input.sort : 1
    if (input.id) {
      const row = data.productTypes.find((item) => item.id === input.id)
      if (!row) return '产品类型不存在。'
      const blocked = productTypeCategoryMoveMessage(data, input.id, input.categoryId, categoryPath(data, input.categoryId))
      if (blocked) return blocked
      Object.assign(row, { name, categoryId: input.categoryId, description, sort, status: input.status })
      return ''
    }
    data.productTypes.push({ id: uid('pt'), name, categoryId: input.categoryId, description, sort, status: input.status })
    return ''
  }

  function removeProductType(id: string) {
    const message = productTypeRemovalBlock(id)
    if (message) return message
    data.productTypes = data.productTypes.filter((item) => item.id !== id)
    return ''
  }

  function productTypeRemovalBlock(id: string) {
    const benefitBlock = benefitPackageReferenceProblem(data, 'type', id)
    if (benefitBlock) return benefitBlock
    if (!data.productTypes.some((item) => item.id === id)) return '产品类型不存在。'
    const modelIds = new Set(data.specCanvases.filter((item) => item.productTypeId === id).map((item) => item.templateId))
    const usedByModel = modelIds.size > 0
    const usedByVersion = data.specModelVersions.some((item) => item.status === 'published' && modelIds.has(item.templateId))
    const usedByPlanning = (data.planningRecords || []).some((item) => modelIds.has(item.productModelId)) || (data.productPlans || []).some((item) => item.productTypeId === id)
    const usedByMaterial = data.families.some((item) => item.productTypeId === id) || data.skus.some((sku) => data.families.some((item) => item.id === sku.familyId && item.productTypeId === id))
    const usedByLink = (data.compatibilities || []).some((item) => item.host.productTypeId === id)
    const usedByDevice = data.deviceModels?.some(model => model.productTypeId === id) || data.deviceBindings?.some(binding => binding.host.productTypeId === id)
    if (usedByModel || usedByVersion || usedByPlanning || usedByMaterial || usedByLink || usedByDevice) return '该产品类型已被商品模型 / 已发布数据引用，不能删除。'
    return ''
  }

  function setProductTypeStatus(id: string, status: ProductType['status']) {
    const row = data.productTypes.find((item) => item.id === id)
    if (row) row.status = status
  }

  function createProductModel(input: { productTypeId: string; name: string }) {
    const productType = data.productTypes.find((item) => item.id === input.productTypeId)
    const name = input.name.trim()
    if (!productType) return { ok: false, message: '请选择产品类型。', templateId: '' }
    if (!name) return { ok: false, message: '请填写模型名称。', templateId: '' }
    const next = cloneCompatibility(data)
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
    const next = cloneCompatibility(data), source = next.templates.find(item => item.id === id), canvas = next.specCanvases.find(item => item.templateId === id)
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
    next.productSpecNodes.push(...next.productSpecNodes.filter(item => item.templateId === id).map(item => ({ ...cloneCompatibility(item), id: nodeMap.get(item.id)!, templateId, parentId: item.parentId ? nodeMap.get(item.parentId) || null : null, ...(item.businessConfigs ? { businessConfigs: copyBusinessConfigs(item, templateId, nodeMap.get(item.id)!, uid) } : {}) })))
    next.specCanvases.push({ templateId, productTypeId, name, zoom: 1, panX: 0, panY: 0, status: 'draft', version: 1, versionName: 'V1', direction: options.direction || 'ltr', updatedAt: now })
    const legacyIds = new Map<string, string>()
    next.nodeCompatibilityRules.push(...next.nodeCompatibilityRules.filter(item => item.templateId === id && !item.modelVersionId).map(item => {
      const legacyId = uid('ncompat'); legacyIds.set(item.id, legacyId)
      return { ...cloneCompatibility(item), id: legacyId, templateId, nodeId: nodeMap.get(item.nodeId) || item.nodeId, updatedAt: now }
    }))
    const config = next.templateCompatibilityConfigs?.find(item => item.modelId === id)
    if (config) {
      const copied = cloneCompatibility(config), rules = new Map<string, string>()
      copied.modelId = templateId; copied.revision = 1; copied.updatedAt = now
      rules.set(copied.defaultRule.id, uid('tcompat-rule')); copied.defaultRule.id = rules.get(copied.defaultRule.id)!
      copied.defaultRule.claims.forEach(claim => { claim.id = uid('tcompat-claim') })
      copied.exceptions.forEach(rule => {
        const previousId = rule.id; rule.id = uid('tcompat-rule'); rules.set(previousId, rule.id)
        rule.claims.forEach(claim => { claim.id = uid('tcompat-claim') })
        rule.selector.anyOf.forEach(group => group.forEach(term => { term.attributeNodeId = nodeMap.get(term.attributeNodeId) || term.attributeNodeId; term.valueNodeId = nodeMap.get(term.valueNodeId) || term.valueNodeId; if (term.parentValueNodeId) term.parentValueNodeId = nodeMap.get(term.parentValueNodeId) || term.parentValueNodeId }))
      })
      // Rebase conversion receipts together with the copied nodes/rules so opening
      // the conversion tab cannot import an already converted rule a second time.
      copied.conversions = copied.conversions.flatMap(receipt => {
        const legacyRuleId = legacyIds.get(receipt.legacyRuleId)
        return legacyRuleId ? [{ ...receipt, legacyRuleId, nodeId: nodeMap.get(receipt.nodeId) || receipt.nodeId, exceptionId: rules.get(receipt.exceptionId) || receipt.exceptionId }] : []
      })
      ;(next.templateCompatibilityConfigs ||= []).push(copied)
    }
    return commitCandidate(next, { ok: true, templateId }, ['templates', 'templateParams', 'productSpecNodes', 'specCanvases', 'nodeCompatibilityRules', 'templateCompatibilityConfigs'])
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
    forgetDraftNodeRules(data, ids)
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
      const benefitBlock = benefitPackageReferenceProblem(data, 'model', id) || benefitPackageReferenceProblem(data, 'model', `template:${id}`)
      if (benefitBlock) return benefitBlock
    }
    const versions = data.specModelVersions.filter((item) => ids.includes(item.templateId))
    const versionIds = new Set(versions.map((item) => item.id))
    const plans = (data.planningRecords || []).filter((item) => ids.includes(item.productModelId) || item.modelVersionIds.some((id) => versionIds.has(id)))
    const planIds = new Set(plans.map((item) => item.planningId))
    const materials = data.skus.filter((item) => (item.modelVersionId && versionIds.has(item.modelVersionId)) || (item.planningId && planIds.has(item.planningId)))
    const families = data.families.filter((item) => ids.includes(item.templateId) || ids.includes(item.productModelId || '') || Boolean(item.modelVersionId && versionIds.has(item.modelVersionId)))
    const linked = compatibilityModelBlock(data, ids)
    if (linked) return linked
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
    const next = cloneCompatibility(data)
    const nodes = next.productSpecNodes.filter((item) => item.templateId === templateId)
    let first: {branch:string;nodeId?:string;nodePath?:string;attributeId?:string}|undefined
    const problems = specPublishProblems(next, nodes, issue=>{if(issue.index===0)first=issue})
    if (problems.length) return first ? rejectGuide(`model.publish.${first.branch}`,problems[0]!,{savedState:'unchanged',context:{modelId:templateId,nodeId:first.nodeId||'',nodePath:first.nodePath||'',attributeId:first.attributeId||''},recovery:['edit-input','view-related']}) : withFailure({ok:false,message:problems[0]!},unknownFailure(problems[0]!,'action-model-publish','unchanged'))
    const config = next.templateCompatibilityConfigs?.find(item => item.modelId === templateId)
    const context = createTemplateCompatibilityContext(next, { modelId: templateId })
    const configProblems = config ? validateTemplateCompatibilityConfig(next, config, context) : []
    if (configProblems.length) return { ok: false, message: configProblems[0]!.message }
    for (const combination of context.combinations) {
      const effective = resolveTemplateCompatibility(context, combination)
      if (effective.state === 'conflict' || effective.state === 'invalid') return { ok: false, message: effective.message }
    }
    const snapshot = freezeTemplateCompatibility(next, templateId)
    const versions = next.specModelVersions.filter((item) => item.templateId === templateId).slice().sort((a, b) => a.version - b.version)
    const latest = versions[versions.length - 1]
    const now = new Date().toISOString()
    let canvas = next.specCanvases.find((item) => item.templateId === templateId)
    if (!canvas) {
      canvas = { templateId, zoom: 1, panX: 0, panY: 0, status: 'draft', version: 1, versionName: 'V1', direction: 'ltr', updatedAt: now }
      next.specCanvases.push(canvas)
    }
    const publishKeys: (keyof AppData)[] = ['specModelVersions', 'specCanvases', 'planningRecords', 'nodeCompatibilityRules']
    if (latest && latest.status === 'published' && sameSpecSnapshot(latest.nodesSnapshot, nodes) && !draftHostRulesDiffer(next, templateId, latest.id) && templateCompatibilityContentSignature(latest.templateCompatibilitySnapshot) === templateCompatibilityContentSignature(snapshot)) {
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
      templateCompatibilitySnapshot: snapshot,
    })
    freezeDraftNodeHosts(next, templateId, versionId, now, uid)
    canvas.status = 'published'
    canvas.version = version
    canvas.versionName = versionName
    canvas.updatedAt = now
    const outcome = alignPlanning(next, templateId, versionId, now, context.combinations)
    const retired = outcome.retired ? `，停用 ${outcome.retired} 个不再存在的组合` : ''
    return commitCandidate(next, { ok: true, message: `已发布 ${versionName}。合法组合 ${outcome.created + outcome.reused} 条，新增编号 ${outcome.created} 个，沿用 ${outcome.reused} 个${retired}。已有版本不会被覆盖。` }, publishKeys)
  }

  function alignPlanning(target: AppData, templateId: string, versionId: string, now: string, combinations: ReturnType<typeof createTemplateCompatibilityContext>['combinations']) {
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
    const next = cloneCompatibility(data), now = new Date().toISOString()
    const result = createV3Material(next, { ...input, nextId: uid })
    return commitCreated(next, result, result.ok && result.created ? [result.skuId] : [], now)
  }

  function createTemporary(input: { requestId: string; categoryId: string; productTypeId: string; productModelId?: string; modelVersionId?: string; attrs: { attributeId: string; value: string; source: 'dictionary' | 'manual' }[]; materialCode: string; skuName?: string; supplierCode?: string; guanjiapoCode?: string; oaSkuId?: string; materialDescription?: string }) {
    const next = cloneCompatibility(data), now = new Date().toISOString()
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
  function importFeedbackPack(incoming:FeedbackItem[]){const next=cloneCompatibility(data);if(!Array.isArray(incoming)||incoming.some(item=>!item||typeof item.id!=='string'||typeof item.title!=='string'||typeof item.content!=='string'))return {ok:false,message:'反馈包记录结构不合法。'};const known=new Set(next.feedbacks.map(item=>item.id));next.feedbacks.unshift(...cloneCompatibility(incoming.filter(item=>!known.has(item.id))));return commitCandidate(next,{ok:true},['feedbacks'])}
  function markFeedbacksExported(ids:string[]){const next=cloneCompatibility(data),now=new Date().toISOString();next.feedbacks.forEach(item=>{if(ids.includes(item.id))item.exportedAt=now});return commitCandidate(next,{ok:true},['feedbacks'])}
  function saveBrand(input:Brand){
    const next=cloneCompatibility(data),old=next.brands.find(b=>b.id===input.id),name=input.name?.trim()
    if(!name||!['enabled','disabled'].includes(input.status))return {ok:false,message:'请填写品牌名称和有效状态。'}
    if(input.id&&!old)return {ok:false,message:'品牌已不存在，请重新打开；当前草稿保留。'}
    const record:Brand={...cloneCompatibility(input),id:old?.id||uid('brand'),name}
    if(old)Object.assign(old,record);else next.brands.push(record)
    const dictionary=next.params.find(p=>p.name==='品牌')
    if(dictionary&&!dictionary.values.includes(name)){
      if(!can('product:dictionary:update'))return {ok:false,message:'品牌名称需要同步品牌词典，但没有编辑词典权限；品牌与词典均未改变。'}
      dictionary.values.push(name)
    }
    return commitCandidate(next,{ok:true,id:record.id,message:'品牌及关联词典已保存。'},['brands','params'])
  }
  function saveRule(input:SpecRule){
    const next=cloneCompatibility(data),old=next.rules.find(r=>r.id===input.id)
    if(typeof input.templateId!=='string'||typeof input.targetParamId!=='string'||!Array.isArray(input.sourceParamIds)||!input.sourceParamIds.every(id=>typeof id==='string')||!Array.isArray(input.options)||!input.options.every(value=>typeof value==='string')||!input.conditions||typeof input.conditions!=='object'||Array.isArray(input.conditions)||Object.values(input.conditions).some(value=>typeof value!=='string')||typeof input.enabled!=='boolean')return {ok:false,message:'规则结构无效，当前草稿保留。'}
    if(input.id&&!old)return {ok:false,message:'规则已不存在，当前草稿保留。'}
    const record={...cloneCompatibility(input),id:old?.id||uid('rule')}
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
    const next=cloneCompatibility(data),templateId=old?.id||uid('tpl')
    const record={...(old||source||{parentId:null,enabled:true}),id:templateId,name:input.name.trim(),structureOrder:[...input.structureOrder],enabled:input.enabled??old?.enabled??source?.enabled??true}
    if(old)Object.assign(next.templates.find(item=>item.id===templateId)!,record)
    else next.templates.push(record)
    next.templateParams=next.templateParams.filter(bind=>bind.templateId!==templateId)
    next.templateParams.push(...input.binds.map(bind=>({templateId,paramId:bind.paramId,role:bind.role,required:bind.required})))
    return commitCandidate(next,{ok:true,templateId,message:'方案及全部参数绑定已保存。'},['templates','templateParams'])
  }
  function commitCategoryMove(sourceId:string,parentId:string|null){
    const next=cloneCompatibility(data)
    let branch:string|undefined
    const problem=moveCategoryNode(next.categories,sourceId,parentId,new Set(next.productTypes.map(t=>t.categoryId)), value=>{branch=value})
    if(problem)return rejectGuide(`category.move.${branch}`,problem,{savedState:'unchanged',context:{categoryId:sourceId,categoryName:data.categories.find(c=>c.id===sourceId)?.name||'',targetId:parentId||'',targetName:data.categories.find(c=>c.id===parentId)?.name||''},recovery:['choose-target']})
    return commitCandidate(next,{ok:true,message:'分类已移动。'},['categories'])
  }
  function commitCategoryMoves(sourceIds: readonly string[], targetId: string | null) {
    const planned = categoryMovesCandidate(data.categories, { sourceIds, targetId }, typedCategoryIds())
    if (!planned.preview.ok || !planned.preview.changed) return planned.preview
    const next = cloneCompatibility(data)
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
    const next = cloneCompatibility(data), index = next.categories.findIndex(item => item.id === id)
    next.categories[index] = { ...next.categories[index]!, name }
    return commitCandidate(next, { ok: true, id, name, changed: true, message: '分类名称已保存。' }, ['categories'])
  }
  function restoreSuperAdminAccess(){
    if(!isSuperAdmin(data,effectiveUserId.value))return {ok:false,message:'只有有效的内置超级管理员可恢复其权限。'}
    const next=cloneCompatibility(data),role=next.rbac?.roles.find(r=>r.id==='role:super-admin'&&r.superAdmin&&r.builtIn)
    if(!role)return {ok:false,message:'内置超级管理员配置已损坏，不能伪造替换。'}
    role.permissionCodes=[...new Set([...role.permissionCodes,...permissionRegistry().map(p=>p.code)])]
    const issues=rbacProblems(next);if(issues.length)return {ok:false,message:issues.join(' ')}
    return commitCandidate(next,{ok:true,message:'已恢复内置超级管理员的登记权限；其他角色及业务保持。'},['rbac'])
  }
  const api = {
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
    saveTemplateCompatibility: (...args: Parameters<typeof saveTemplateCompatibility>) => command(() => saveTemplateCompatibility(...args)),
    previewTemplateCompatibilitySync: (input: { modelId: string; targetVersionId: string; targetIds?: string[] }) => previewTemplateCompatibilitySync(data, input),
    applyTemplateCompatibilitySync: (...args: Parameters<typeof applyTemplateSync>) => command(() => applyTemplateSync(...args)),
    saveModelDraft: (...args: Parameters<typeof saveModelDraft>) => command(() => saveModelDraft(...args)),
    saveNodeBusiness: (...args: Parameters<typeof saveNodeBusiness>) => command(() => saveNodeBusiness(...args)),
    saveBusinessDefinition: (...args: Parameters<typeof saveBusinessDefinition>) => command(() => saveBusinessDefinition(...args)),
    materialImportBasis,
    commitMaterialImport: (...args: Parameters<typeof commitMaterialImport>) => command(() => commitMaterialImport(...args)),
    copyProductModel: (...args: Parameters<typeof copyProductModel>) => command(() => copyProductModel(...args)),
    commitSpuPage: (next: ProductListPageState, expectedPage = JSON.stringify(data.productListPages?.spu), isCurrent: () => boolean = () => true, manualGuard?: ListManualGuard) => {
      const copied = cloneCompatibility(next), copiedGuard = manualGuard && cloneCompatibility(manualGuard)
      return command(() => commitListPage('spu', copied, expectedPage, isCurrent, copiedGuard))
    },
    commitSkuPage: (next: ProductListPageState, isCurrent: () => boolean = () => true, manualGuard?: ListManualGuard) => {
      const expectedPage = JSON.stringify(data.productListPages?.sku)
      const copied = cloneCompatibility(next), copiedGuard = manualGuard && cloneCompatibility(manualGuard)
      return command(() => commitListPage('sku', copied, expectedPage, isCurrent, copiedGuard))
    },
    saveSalesOptionPlan: (input: SalesPlanSave, isCurrent: () => boolean = () => true) => { const value=cloneCompatibility(input); return salesCommand(next=>saveSalesPlanCommand(next,value,()=>uid('sales-plan'),new Date().toISOString()),['salesOptionPlans'],isCurrent) },
    publishSalesOptionPlan: (input: SalesPlanPublish, isCurrent: () => boolean = () => true) => { const value=cloneCompatibility(input); return salesCommand(next=>publishSalesPlanCommand(next,value,new Date().toISOString()),['salesOptionPlans'],isCurrent) },
    setSalesOptionPlanStatus: (input: SalesPlanStatus, isCurrent: () => boolean = () => true) => { const value=cloneCompatibility(input); return salesCommand(next=>setSalesPlanStatusCommand(next,value,new Date().toISOString()),['salesOptionPlans'],isCurrent) },
    saveSalesOptionBinding: (input: SalesBindingSave, isCurrent: () => boolean = () => true) => { const value=cloneCompatibility(input),key=value.draft?.id||'0'; return salesCommand(next=>saveSalesBindingsCommand(next,{drafts:[value.draft],expectedRevisions:{[key]:value.expectedRevision},expectedBasis:{[key]:value.expectedBasis},requestId:value.requestId},()=>uid('sales-binding'),new Date().toISOString()),['salesOptionBindings'],isCurrent) },
    saveSalesOptionBindings: (input: SalesBindingsSave, isCurrent: () => boolean = () => true) => { const value=cloneCompatibility(input); return salesCommand(next=>saveSalesBindingsCommand(next,value,()=>uid('sales-binding'),new Date().toISOString()),['salesOptionBindings'],isCurrent) },
    saveSalesProductRelation: (input: SalesRelationSave, isCurrent: () => boolean = () => true) => { const value=cloneCompatibility(input); return salesCommand(next=>saveSalesRelationCommand(next,value,()=>uid('sales-relation'),new Date().toISOString()),['salesProductRelations'],isCurrent) },
    saveBenefitFramework: (input: Parameters<typeof saveBenefitFramework>[0], isCurrent: () => boolean = () => true) => { const copied = cloneBenefit(input); return command(() => saveBenefitFramework(copied, isCurrent)) },
    removeBenefitFramework: (...args: Parameters<typeof removeBenefitFramework>) => command(() => removeBenefitFramework(...args)),
    saveBenefitPackage: (input: Parameters<typeof saveBenefitPackage>[0], isCurrent: () => boolean = () => true) => { const copied = cloneBenefit(input); return command<BenefitCommandResult>(() => saveBenefitPackage(copied, isCurrent)) },
    setBenefitPackageStatus: (...args: Parameters<typeof setBenefitPackageStatus>) => command<BenefitCommandResult>(() => setBenefitPackageStatus(...args)),
    setBenefitPackageFavorite: (...args: Parameters<typeof setBenefitPackageFavorite>) => command<BenefitCommandResult>(() => setBenefitPackageFavorite(...args)),
    generateBenefitDelivery: (input: Parameters<typeof generateBenefitDelivery>[0], isCurrent: () => boolean = () => true) => { const copied = cloneBenefit(input); return command<BenefitCommandResult>(() => generateBenefitDelivery(copied, isCurrent)) },
    commitCompatibilityChanges: (...args: Parameters<typeof commitCompatibilityChanges>) => command<CompatibilityCommandResult>(() => commitCompatibilityChanges(...args)),
    commitDeviceBinding: (...args: Parameters<typeof commitDeviceBinding>) => command<CompatibilityCommandResult>(() => commitDeviceBinding(...args)),
    clearDeviceBinding: (...args: Parameters<typeof clearDeviceBinding>) => command<CompatibilityCommandResult>(() => clearDeviceBinding(...args)),
    saveDeviceModel: (...args: Parameters<typeof saveDeviceModel>) => command<CompatibilityCommandResult>(() => saveDeviceModel(...args)),
    removeDeviceModel: (...args: Parameters<typeof removeDeviceModel>) => command<CompatibilityCommandResult>(() => removeDeviceModel(...args)),
    isAdmin,
    resetAll: () => command(resetAll),
    resetModule: (...args: Parameters<typeof resetModule>) => command(() => resetModule(...args)),
    exportJson,
    importJson: (text: string) => persistence.run(() => importJson(text), (message,failure) => { throw failureError(message,failure) }, {actionId:'action-json-import',savedState:'unchanged'}),
    skusOf,
    saveBundle: (...args: Parameters<typeof saveBundle>) => command(() => saveBundle(...args)),
    saveSpu: (family: ProductFamily) => command(() => {
      if (family.id && !data.families.some(item => item.id === family.id)) return { ok: false as const, message: 'SPU 已不存在，请重新打开列表；未重新创建已删除的记录。' }
      const next = cloneCompatibility(data), result = saveSpu(next, { ...family, id: family.id || unusedCatalogId('fam') }, new Date().toISOString())
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
      const copied = input === undefined ? input : cloneCompatibility(input)
      return command(() => commitModelDictionaryBatch(copied, isCurrent)).then((result): ModelDictionaryBatchResult => ({ changed: false, nodeIds: [], skipped: [], items: [], requiredPermissions: [], ...result }))
    },
    undoModelDictionaryBatch: (entry: EditorHistoryEntry, modelId: string, session: number, isCurrent: () => boolean = () => true) => {
      const copied = cloneCompatibility(entry)
      return command(() => undoModelDictionaryBatch(copied, modelId, session, isCurrent))
    },
    removeParam,
    removeParamValue,
    categoryRemovalBlock,
    removeCategory,
    productTypesOf,
    saveProductType,
    removeProductType,
    setProductTypeStatus,
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
  const unguarded=new Set(['can','canRoute','waitForPersistence','flushPersistence','simulateUser','startPermissionPreview','stopPermissionPreview','setRole','categoryRemovalBlock','skusOf','productTypesOf','blankSku','defaultColumns','emptyQuery','materialImportBasis','previewTemplateCompatibilitySync'])
  for(const [name,original]of Object.entries(api))if(typeof original==='function'&&!unguarded.has(name)){
    (api as any)[name]=(...args:unknown[])=>{
      const codes=commandPermissions(name,args,data)
      if(!codes.every(can)){const message=`未授权操作：${codes.join('、')}。`;throw failureError(message,branchFailure('command.permission',message,{actionId:commandAction(name),savedState:'unchanged',context:{requiredPermissions:codes.join('、'),mode:RBAC_ENFORCEMENT_ENABLED?'enforced':'unrestricted'},recovery:['view-related','feedback']}))}
      if((name==='resetAll'||name==='resetModule')&&!isAdmin.value)throw new Error('只有受保护的超级管理员可重置演示数据。')
      const previous=invocation;invocation={codes,actor:effectiveUserId.value,name}
      try{return (original as (...a:unknown[])=>unknown)(...args)}finally{invocation=previous}
    }
  }
  return api
})

export type { Category, FeedbackItem, ParamDef, ProductFamily, ProductGroup, ProductType, SpecRule }
