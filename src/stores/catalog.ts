import { ensureRbac, rbacProblems, canPermission, isSuperAdmin, routePermissions, commandPermissions, effectivePermissions } from '../domain/rbac'
import { loadMenu, saveMenu, defaultMenuNodes, type MenuNode } from '../domain/menuConfig'
import { createRbacCommands } from './catalogRbac'
import { catalogPublicData } from './catalogAccess'
import { frameworkProductResetProblems, frameworkCommand, frameworkReference, frameworkSnapshot, frameworkSnapshotProblem, frameworkProblems, frameworkSignature } from '../domain/benefitFrameworks'
import type { BenefitFramework } from '../domain/benefitPackageTypes'
import { defineStore } from 'pinia'
import { businessDefinitions, businessImportProblems, businessIssues, businessPath, configProblem, copyBusinessConfigs, freezeBusinessNodes, type BusinessDefinition, type NodeBusinessConfig } from '../domain/nodeBusiness'
import { executeMaterialRelation, materialRelationImportProblems, markMaterialContributionChanges, revokeMaterialRelation } from '../domain/materialRelationCommands'
import { materialRelationBlock } from '../domain/materialRelations'
import { computed, onScopeDispose, reactive, ref, watch } from 'vue'
import { createCatalogPersistence } from './catalogPersistence'
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
import { blankVariantAttrs, categoryPath, descendantIds, familySkus, sameSpecSnapshot, specPublishProblems } from '../domain/logic'
import { reconcilePlanningRecords } from '../domain/planning'
import { compatibilityModelBlock, compatibilitySkuBlock } from '../domain/compatibility'
import { ensureProductListPages } from '../domain/productListPages'
import type { ProductListPageState } from '../domain/types'
import { isRealSku, isMaterialArchive } from '../domain/catalogIdentity'
import { applyCompatibilityChanges, cloneCompatibility, compatibilityImportProblems, deviceModelProblem } from '../domain/accessoryCompatibilityCommands'
import type { CompatibilityChange, CompatibilityCommandResult } from '../domain/accessoryCompatibilityCommands'
import { compatibilityFamilyTypeId, compatibilityRecordRole, deviceSourceStamp, sameDeviceHost, validateCompatibilityHost } from '../domain/deviceResolution'
import type { DeviceModel } from '../domain/accessoryCompatibilityTypes'
import { benefitPackageImportProblems, benefitPackageReferenceProblem, cloneBenefit, createBenefitDeliverySnapshot, previewBenefitDelivery, validateBenefitPackage } from '../domain/benefitPackages'
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
import { DATA_VERSION, STORAGE_KEY, type AppData, type Category, type ColumnPref, type FeedbackItem, type ListQuery, type ListView, type ParamDef, type ProductFamily, type ProductGroup, type ProductType, type Sku, type SpecRule, type UserRole } from '../domain/types'

type ModuleName = 'products' | 'categories' | 'templates' | 'params' | 'rules' | 'groups' | 'system'
type StoredPayload = { version?: number; data?: AppData }
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
  const needsAuthorizationMigration = !originalRaw || !JSON.parse(originalRaw).data?.rbac
  const startingData = cloneCompatibility(startupCandidate)
  if(needsAuthorizationMigration){delete startingData.rbac;startingData.users=originalRaw?JSON.parse(originalRaw).data.users:startingData.users.map(u=>{const x={...u};delete x.roleIds;return x})}
  const data = reactive<AppData>(startingData)
  const authorizationReady=ref(!needsAuthorizationMigration)
  const SESSION_KEY='iyge-rbac-simulated-user'
  let storedUser:string|null=null
  try{storedUser=sessionStorage.getItem(SESSION_KEY)||localStorage.getItem(SESSION_KEY)}catch{try{storedUser=localStorage.getItem(SESSION_KEY)}catch{}}
  const activeUserId=ref(storedUser||startupCandidate.users.find(u=>u.enabled&&u.role===startupCandidate.activeRole)?.id||'')
  const previewUserId=ref(''),simulationReturnId=ref('')
  const effectiveUserId=computed(()=>previewUserId.value||activeUserId.value)
  const currentUser=computed(()=>data.users.find(u=>u.id===effectiveUserId.value))
  const authorizationStamp=(value:AppData)=>JSON.stringify([value.rbac?.roles.map(r=>[r.id,r.enabled,r.superAdmin,r.permissionCodes]),value.rbac?.permissions.map(p=>[p.code,p.enabled,p.dependsOn]),value.users.map(u=>[u.id,u.enabled,u.roleIds])])
  function authorizationFresh(){if(!persistence.state.external)return true;try{return authorizationStamp(JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}').data)===authorizationStamp(data)}catch{return false}}
  const can=(code:string)=>authorizationReady.value&&authorizationFresh()&&canPermission(data,effectiveUserId.value,code)
  function canRoute(location:{path:string;query?:Record<string,unknown>}){
    let path=location.path
    const legacy=/^\/products\/([^/]+)$/.exec(path)
    if(legacy&&legacy[1]!=='new'&&location.query?.sku){const sku=data.skus.find(s=>s.id===location.query!.sku&&s.familyId===legacy[1]);path=sku?(isMaterialArchive(data,sku)?`/materials/${sku.familyId}`:`/skus/${sku.id}`):`/spus/${legacy[1]}`}
    const permissions=routePermissions(path,location.query);return permissions!==null&&permissions.every(can)
  }
  type CommandContext={codes:string[];actor:string}
  let invocation:CommandContext|undefined
  const publicData=catalogPublicData(data,can)
  const editorGeneration = ref(0)
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
    }, message => { migrationStorageError = `当前内容无法写入本机：${message}。原始数据未被清空。`; return { ok: false, message } })
  }

  watch(
    data,
    () => {
      if (JSON.stringify(data) !== explicitlyPersisted) void persistLive()
    },
    { deep: true },
  )

  const isAdmin = computed(() => authorizationReady.value&&authorizationFresh()&&isSuperAdmin(data,effectiveUserId.value))
  // Seed and migration writes use the very same protected path, never a startup
  // overwrite. Existing unmodified payloads acquire identity on their first edit.
  if(needsAuthorizationMigration){
    void persistence.run(()=>{persistence.write(startupCandidate);Object.assign(data,startupCandidate);authorizationReady.value=true;explicitlyPersisted=JSON.stringify(data);return {ok:true}},message=>{migrationStorageError=`授权迁移未提交：${message}。原数据保留。`;return {ok:false,message}})
  } else if (JSON.stringify(JSON.parse(originalRaw!).data)!==explicitlyPersisted||JSON.parse(originalRaw!).version!==DATA_VERSION){explicitlyPersisted='';void persistLive()}
  function command<T extends { ok: boolean; message?: string }>(operation: () => T): Promise<T | CommandFailure> {
    const context=invocation
    return persistence.run<T | CommandFailure>(()=>{if(context&&(context.actor!==effectiveUserId.value||!context.codes.every(can)))return {ok:false,message:'操作者或授权已变化，本次提交被拒绝，草稿保留。'};return operation()}, message => ({ ok: false as const, message }))
  }

  /** Persist the whole candidate once, then expose only this command's owned fields. */
  function commitCandidate<T extends { ok: boolean; message?: string }>(next: AppData, result: T, keys: (keyof AppData)[]): T | { ok: false; message: string; choices?: MaterialChoice[]; reason?: 'material-deleted' } {
    if (!result.ok) return result
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
    } catch (error) { return { ok: false, message: `无法保存到本机：${error instanceof Error ? error.message : String(error)}。当前数据未改变，操作草稿已保留，请重试。` } }
  }
  const creationKeys: (keyof AppData)[] = ['families', 'skus', 'planningRecords', 'materialReceipts', 'compatibilities', 'templateCompatibilityOrigins', 'materialRelations', 'materialContributions']
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
    if (!result.ok) return result
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
  function commitMaterialImport(candidate: AppData, expectedBasis: string) {
    if (materialImportBasis() !== expectedBasis) return { ok: false, message: '预览后商品或模型数据已变化，请重新预览导入；当前数据未改变。' }
    const next = cloneCompatibility(data), existing = new Set(data.skus.map(item => item.id))
    for (const key of creationKeys) {
      if (candidate[key] !== undefined) Object.assign(next, { [key]: cloneCompatibility(candidate[key]) })
    }
    return commitCreated(next, { ok: true }, next.skus.filter(item => !existing.has(item.id)).map(item => item.id), new Date().toISOString())
  }

  function benefitPermission(): BenefitCommandResult | undefined {
    return undefined
  }

  /** Persist a complete candidate before exposing either configuration or snapshot changes. */
  function commitBenefitState(next: AppData, result: BenefitCommandResult): BenefitCommandResult {
    if (!result.ok) return result
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
      return { ok: false, message: `无法保存到本机：${error instanceof Error ? error.message : String(error)}。原数据、编辑草稿和本次请求保留，请重试。`, validation: result.validation }
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

  function saveBenefitFramework(input:{draft:BenefitFramework;expectedRevision:number;requestId:string}) {
    const denied=benefitPermission();if(denied)return denied
    const next=cloneCompatibility(data)
    const result=frameworkCommand(next,input,()=>uid('benefit-framework'))
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
  function saveBenefitPackage(input: { draft: BenefitPackageDraft; status: 'draft' | 'available'; expectedRevision?: number; requestId: string }): BenefitCommandResult {
    const denied = benefitPermission()
    if (denied) return denied
    if (typeof input.requestId !== 'string' || !input.requestId.trim()) return { ok: false, message: '保存请求缺少标识，请重新打开权益包后重试。' }
    if (!['draft', 'available'].includes(input.status)) return { ok: false, message: '请选择保存草稿或保存为可用权益包。' }
    const previous = input.draft.id ? data.benefitPackages?.find(item => item.id === input.draft.id) : undefined
    if (!input.draft.id) {
      const receipt = data.benefitPackages?.find(item => item.creationRequestId === input.requestId)
      if (receipt) return { ok: true, id: receipt.id, package: cloneCompatibility(receipt) }
    } else if (!previous) return { ok: false, message: '权益包已不存在，未重新创建已删除的配置。' }
    if (previous && (input.expectedRevision ?? input.draft.revision) !== previous.revision) return { ok: false, message: '权益包已被更新，请重新打开并核对最新配置；当前草稿保留。' }
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
    if (!validation.canSaveDraft || input.status === 'available' && !validation.canSaveAvailable) return { ok: false, message: validation.issues.filter(issue => issue.structural || input.status === 'available' && issue.severity === 'error').map(issue => issue.message).join(' ') || '当前配置需要处理，请保存草稿或完善内容。', validation }
    try {
      const next = cloneCompatibility(data), now = new Date().toISOString(), identity = previous ? { id: previous.id, code: previous.code } : nextBenefitIdentity('package')
      const record: BenefitPackageDraft = { ...draft, ...identity, goods: validation.goods.map(item => ({ ...cloneBenefit(item.line), snapshot: cloneBenefit(item.summary) })), revision: (previous?.revision || 0) + 1, createdAt: previous?.createdAt || now, updatedAt: now, issues: validation.issues.map(issue => issue.message), creationRequestId: previous?.creationRequestId || input.requestId }
      next.benefitPackages = [...(next.benefitPackages || [])]
      const index = next.benefitPackages.findIndex(item => item.id === identity.id)
      if (index >= 0) next.benefitPackages[index] = record
      else next.benefitPackages.push(record)
      return commitBenefitState(next, { ok: true, id: record.id, package: cloneCompatibility(record), validation })
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

  function generateBenefitDelivery(input: { packageId: string; expectedRevision: number; requestId: string; packageCount: number; expectedBasis: string }): BenefitCommandResult {
    const denied = benefitPermission()
    if (denied) return denied
    if (typeof input.requestId !== 'string' || !input.requestId.trim()) return { ok: false, message: '本次生成请求缺少标识，请重新预览。' }
    const receipt = data.benefitDeliveries?.find(item => item.requestId === input.requestId)
    if (receipt) return receipt.packageId === input.packageId && (!(receipt.framework || receipt.goods.some(l=>l.referencePrice) || receipt.services.some(l=>l.referencePrice)) || receipt.packageCount === input.packageCount && receipt.sourceRevision === input.expectedRevision && receipt.basis === input.expectedBasis) ? { ok: true, id: receipt.id, delivery: cloneCompatibility(receipt) } : { ok: false, message: '本次请求已用于其他权益包或不同交付依据，请发起新的生成操作。' }
    const source = data.benefitPackages?.find(item => item.id === input.packageId)
    if (!source || source.revision !== input.expectedRevision) return { ok: false, message: '权益包已更新或不存在，请重新预览完整组成和报价。' }
    const preview = previewBenefitDelivery(data, source, input.packageCount)
    if (!preview.canConfirm) return { ok: false, message: preview.issues.filter(issue => issue.severity !== 'warning').map(issue => issue.message).join(' ') || '当前配置不能生成正式清单。' }
    if (!input.expectedBasis || preview.basis !== input.expectedBasis) return { ok: false, message: '商品、兼容条件或报价依据已变化，请重新预览并确认。' }
    try {
      const identity = nextBenefitIdentity('delivery')
      const delivery = createBenefitDeliverySnapshot(preview, { ...identity, requestId: input.requestId, generatedAt: new Date().toISOString() })
      const next = cloneCompatibility(data)
      next.benefitDeliveries = [...(next.benefitDeliveries || []), delivery]
      return commitBenefitState(next, { ok: true, id: delivery.id, delivery: cloneCompatibility(delivery) })
    } catch (error) { return { ok: false, message: error instanceof Error ? error.message : String(error) } }
  }

  function commitSkuPage(next: ProductListPageState) {
    if (!data.productListPages) return { ok: false as const, message: 'SKU 页面配置尚未初始化。' }
    const candidate = { ...data, productListPages: { ...data.productListPages, sku: next } }
    return commitCandidate(candidate, { ok: true as const }, ['productListPages'])
  }

  function compatibilityPermission(): CompatibilityCommandResult | undefined {
    return undefined
  }

  /** Only these compatibility-owned arrays are changed, after the full payload is stored. */
  function commitCompatibilityState(next: AppData, result: CompatibilityCommandResult): CompatibilityCommandResult {
    if (!result.ok) return result
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
      return { ...result, ok: false, message: `无法保存到本机：${error instanceof Error ? error.message : String(error)}。当前数据未改变，操作草稿已保留，请重试。` }
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
    if (!sku || !isRealSku(data, sku) || compatibilityRecordRole(data, sku.id) !== 'host') return { ok: false, message: '请选择真实的主机销售 SKU，不能绑定 MAT 或配件。' }
    if (input.host.productTypeId !== compatibilityFamilyTypeId(data, sku.familyId)) return { ok: false, message: '设备型号与当前 SKU 的产品类型不一致，请选择相同主机类型的型号。' }
    if (input.host.scope !== 'model') return { ok: false, message: '绑定设备型号时请选择型号级目标，规划范围由设备自己的来源确认。' }
    const problem = validateCompatibilityHost(data, input.host)
    if (problem) return { ok: false, message: problem }
    const stamp = deviceSourceStamp(data, sku.id)
    if (input.expectedSourceStamp !== undefined && stamp !== input.expectedSourceStamp) return { ok: false, message: '设备来源已变化，请重新打开型号配置后确认。' }
    const previous = data.deviceBindings?.find(binding => binding.skuId === sku.id)
    if (previous && !input.replaceExisting) return { ok: false, message: '这条设备已有绑定；重新绑定会改变查询适用配件的型号，请明确确认原绑定及影响。' }
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

  function importJson(text: string) {
    const parsed = JSON.parse(text) as StoredPayload
    if (!parsed.data) throw new Error('导入文件缺少商品数据，当前数据没有被替换。')
    if (!Array.isArray(parsed.data.skus) || !Array.isArray(parsed.data.families)) throw new Error('导入文件缺少有效的商品数组，当前数据没有被替换。')
    const businessProblems = businessImportProblems(parsed.data)
    if (businessProblems.length) throw new Error(`节点业务配置结构校验失败：${businessProblems.join(' ')} 当前数据没有被替换。`)
    const relationProblems = materialRelationImportProblems(parsed.data)
    if (relationProblems.length) throw new Error(`物料关联校验失败：${relationProblems.join(' ')} 当前数据没有被替换。`)
    const templateProblems = [...templateCompatibilityImportProblems(parsed.data), ...templateCompatibilityOriginProblems(parsed.data)]
    if (templateProblems.length) throw new Error(`模板兼容导入校验失败：${templateProblems.join(' ')} 当前数据没有被替换。`)
    const benefitProblems = benefitPackageImportProblems(parsed.data)
    if (benefitProblems.length) throw new Error(`权益包导入校验失败：${benefitProblems.join(' ')} 当前数据没有被替换。`)
    const compatibilityProblems = compatibilityImportProblems(parsed.data)
    if (compatibilityProblems.length) throw new Error(`适用关系导入校验失败：${compatibilityProblems.join(' ')} 当前数据没有被替换。`)
    const next = normalizeStored(parsed, { persist: false })
    if (!next?.params) throw new Error('演示数据版本不匹配，当前数据没有被替换')
    const authChanged=JSON.stringify([next.rbac,next.users])!==JSON.stringify([data.rbac,data.users])
    if(authChanged){
      if(!can('system:role:grant')||!can('system:user:bind')||!can('system:permission:update'))throw new Error('导入不能修改当前操作者无权维护的授权或用户角色绑定。')
      const own=effectivePermissions(data,effectiveUserId.value)
      if(!isAdmin.value&&next.rbac!.roles.some(role=>role.superAdmin||role.permissionCodes.some(code=>!own.has(code))))throw new Error('导入不能取得超级管理员身份或超出操作者委派范围。')
    }
    const prefixes:Partial<Record<keyof AppData,string>>={families:'product:spu',skus:'product:sku',productSpecNodes:'product:model',specCanvases:'product:model',specModelVersions:'product:model',businessDefinitions:'product:model',nodeCompatibilityRules:'product:model',materialRelations:'product:material',materialContributions:'product:material',materialReceipts:'product:material',compatibilities:'product:compatibility',deviceModels:'product:compatibility',deviceBindings:'product:compatibility',templateCompatibilityConfigs:'product:model',templateCompatibilityOrigins:'product:compatibility',benefitPackages:'product:benefit',benefitDeliveries:'product:delivery',benefitFrameworks:'product:framework',categories:'product:category',params:'product:dictionary',templates:'product:model',templateParams:'product:template',mappings:'product:template',productTypes:'product:type',rules:'product:rule',brands:'product:brand',productGroups:'product:group',planningRecords:'product:planning',productPlans:'product:planning',feedbacks:'system:feedback',profile:'system:account'}
    const preferences=new Set(['mode','activeRole','productListPages','productListViews','activeProductListViewId','columns','listViews','activeViewId','listQuery','productListMode'])
    for(const key of new Set([...Object.keys(data),...Object.keys(next)])){
      if(key==='rbac'||key==='users'||preferences.has(key)||JSON.stringify((data as any)[key])===JSON.stringify((next as any)[key]))continue
      const prefix=prefixes[key as keyof AppData]
      if(!prefix)throw new Error(`导入含未登记的变更字段：${key}`)
      const old=(data as any)[key],value=(next as any)[key]
      if(key==='specModelVersions'){if(!can('product:model:publish'))throw new Error('无权导入或改写模型发布快照。');continue}
      if(Array.isArray(old)&&Array.isArray(value)){
        const byId=(item:any)=>item.id||JSON.stringify(item)
        const keys=new Set([...old,...value].map(byId))
        for(const identity of keys){const a=old.find((v:any)=>byId(v)===identity),b=value.find((v:any)=>byId(v)===identity);if(JSON.stringify(a)===JSON.stringify(b))continue;if(key==='families'&&b&&!commandPermissions('saveSpu',[b],data).every(can))throw new Error('导入不能绕过商品编辑或发布权限。');if(key==='skus'&&a&&b&&isMaterialArchive(data,a)!==isMaterialArchive(next,b)&&(!can('product:sku:update')||!can('product:material:update')))throw new Error('导入不能跨越 SKU/MAT 身份权限。');const resource=key==='skus'&&((a||b)?.recordKind==='material'||(a||b)?.materialCode)?'product:material':prefix;const action=!a?'create':!b?'delete':'update';if(!can(`${resource}:${action}`))throw new Error(`导入被拒绝：没有 ${resource}:${action}，当前数据及会话未改变。`)}
      }else if(!can(`${prefix}:update`))throw new Error(`导入被拒绝：没有 ${prefix}:update。`)
    }
    next.activeRole=data.activeRole // Deprecated backup mirror must never change the current or next mock identity.
    const authIssues=rbacProblems(next);if(authIssues.length)throw new Error(authIssues.join(' '))

    if (migrationStorageError) throw new Error(migrationStorageError)
    try { persistence.write(next, true) }
    catch (error) { throw new Error(`无法写入本机：${error instanceof Error ? error.message : String(error)}。当前数据和原存储未改变，可重试导入。`) }
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
    const problems = specPublishProblems(next, nodes)
    if (problems.length) return { ok: false, message: problems[0] }
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

  function simulateUser(id:string){
    if(id===activeUserId.value){previewUserId.value='';return {ok:true}}
    if(!isSuperAdmin(data,activeUserId.value))return {ok:false,message:'只有超级管理员模拟会话可以切换其他用户。'}
    if(!data.users.some(u=>u.id===id&&u.enabled))return {ok:false,message:'用户不存在或已停用。'}
    if(!simulationReturnId.value)simulationReturnId.value=activeUserId.value
    activeUserId.value=id;previewUserId.value='';try{sessionStorage.setItem(SESSION_KEY,id);localStorage.setItem(SESSION_KEY,id)}catch{}
    return {ok:true}
  }
  function startPermissionPreview(id:string){if(!isSuperAdmin(data,activeUserId.value))return {ok:false,message:'只有超级管理员可预览其他用户。'};if(!data.users.some(u=>u.id===id&&u.enabled))return {ok:false,message:'用户已停用或不存在。'};previewUserId.value=id;return {ok:true}}
  function stopPermissionPreview(){previewUserId.value='';if(simulationReturnId.value){if(data.users.some(u=>u.id===simulationReturnId.value&&u.enabled))activeUserId.value=simulationReturnId.value;simulationReturnId.value='';try{sessionStorage.setItem(SESSION_KEY,activeUserId.value);localStorage.setItem(SESSION_KEY,activeUserId.value)}catch{}}return {ok:true}}
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
  const api = {
    data:publicData,
    can,canRoute,currentUser,activeUserId,previewUserId,simulationReturnId,authorizationReady,
    simulateUser,startPermissionPreview,stopPermissionPreview,
    saveRbacRole:(...args:Parameters<typeof rbacCommands.saveRbacRole>)=>command(()=>rbacCommands.saveRbacRole(...args)),
    removeRbacRole:(...args:Parameters<typeof rbacCommands.removeRbacRole>)=>command(()=>rbacCommands.removeRbacRole(...args)),
    grantRbacRole:(...args:Parameters<typeof rbacCommands.grantRbacRole>)=>command(()=>rbacCommands.grantRbacRole(...args)),
    saveRbacPermission:(...args:Parameters<typeof rbacCommands.saveRbacPermission>)=>command(()=>rbacCommands.saveRbacPermission(...args)),
    saveRbacUser:(...args:Parameters<typeof rbacCommands.saveRbacUser>)=>command(()=>rbacCommands.saveRbacUser(...args)),
    removeRbacUser:(...args:Parameters<typeof rbacCommands.removeRbacUser>)=>command(()=>rbacCommands.removeRbacUser(...args)),
    saveMenuStructure,resetMenuStructure,
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
    commitSkuPage: (next: ProductListPageState) => {
      const expectedPage = JSON.stringify(data.productListPages?.sku)
      return command(() => JSON.stringify(data.productListPages?.sku) === expectedPage
        ? commitSkuPage(next)
        : { ok: false, message: 'SKU 页面设置已由上一个操作更新，本次未覆盖；当前工作配置已保留，请重新核对后保存。' })
    },
    saveBenefitFramework: (...args: Parameters<typeof saveBenefitFramework>) => command(() => saveBenefitFramework(...args)),
    removeBenefitFramework: (...args: Parameters<typeof removeBenefitFramework>) => command(() => removeBenefitFramework(...args)),
    saveBenefitPackage: (...args: Parameters<typeof saveBenefitPackage>) => command<BenefitCommandResult>(() => saveBenefitPackage(...args)),
    setBenefitPackageStatus: (...args: Parameters<typeof setBenefitPackageStatus>) => command<BenefitCommandResult>(() => setBenefitPackageStatus(...args)),
    setBenefitPackageFavorite: (...args: Parameters<typeof setBenefitPackageFavorite>) => command<BenefitCommandResult>(() => setBenefitPackageFavorite(...args)),
    generateBenefitDelivery: (...args: Parameters<typeof generateBenefitDelivery>) => command<BenefitCommandResult>(() => generateBenefitDelivery(...args)),
    commitCompatibilityChanges: (...args: Parameters<typeof commitCompatibilityChanges>) => command<CompatibilityCommandResult>(() => commitCompatibilityChanges(...args)),
    commitDeviceBinding: (...args: Parameters<typeof commitDeviceBinding>) => command<CompatibilityCommandResult>(() => commitDeviceBinding(...args)),
    clearDeviceBinding: (...args: Parameters<typeof clearDeviceBinding>) => command<CompatibilityCommandResult>(() => clearDeviceBinding(...args)),
    saveDeviceModel: (...args: Parameters<typeof saveDeviceModel>) => command<CompatibilityCommandResult>(() => saveDeviceModel(...args)),
    removeDeviceModel: (...args: Parameters<typeof removeDeviceModel>) => command<CompatibilityCommandResult>(() => removeDeviceModel(...args)),
    isAdmin,
    resetAll: () => command(resetAll),
    resetModule: (...args: Parameters<typeof resetModule>) => command(() => resetModule(...args)),
    exportJson,
    importJson: (text: string) => persistence.run(() => importJson(text), message => { throw new Error(message) }),
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
      if(!codes.every(can))throw new Error(`未授权操作：${codes.join('、')}。`)
      if((name==='resetAll'||name==='resetModule')&&!isAdmin.value)throw new Error('只有受保护的超级管理员可重置演示数据。')
      const previous=invocation;invocation={codes,actor:effectiveUserId.value}
      try{return (original as (...a:unknown[])=>unknown)(...args)}finally{invocation=previous}
    }
  }
  return api
})

export type { Category, FeedbackItem, ParamDef, ProductFamily, ProductGroup, ProductType, SpecRule }
