import { defineStore } from 'pinia'
import { computed, reactive, watch } from 'vue'
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
import { persistSkuPage } from '../domain/skuWorkbenchState'
import type { ProductListPageState } from '../domain/types'
import { isRealSku } from '../domain/catalogIdentity'
import { applyCompatibilityChanges, cloneCompatibility, compatibilityImportProblems, deviceModelProblem } from '../domain/accessoryCompatibilityCommands'
import type { CompatibilityChange, CompatibilityCommandResult } from '../domain/accessoryCompatibilityCommands'
import { compatibilityFamilyTypeId, compatibilityRecordRole, deviceSourceStamp, sameDeviceHost, validateCompatibilityHost } from '../domain/deviceResolution'
import type { DeviceModel } from '../domain/accessoryCompatibilityTypes'
import { benefitPackageImportProblems, benefitPackageReferenceProblem, cloneBenefit, createBenefitDeliverySnapshot, previewBenefitDelivery, validateBenefitPackage } from '../domain/benefitPackages'
import type { BenefitCommandResult, BenefitPackageDraft, BenefitPackageStatus } from '../domain/benefitPackageTypes'
import type { CompatibilityHost } from '../domain/types'
import { appendSkuBatch, editSku, previewSkuAppend, saveSpu, spuRemovalBlock, type SkuDraft, type SkuGeneration } from '../domain/spuSku'
import { draftHostRulesDiffer, forgetDraftNodeRules, freezeDraftNodeHosts } from '../domain/nodeCompatibility'
import { scrubSampleDictionary } from '../domain/compatibilitySamples'
import { createTemporaryMaterial, createV3Material, renameV3Product, setPlanningGrades, tombstoneMaterialReceipts, updateV3Material } from '../domain/material'
import type { ProductGrade } from '../domain/types'
import { arrangeSpecPositions } from '../domain/logic'
import { activeProductListView, applyPresetToActiveView, currentModeQuery, ensureProductListViews } from '../domain/productListViews'
import { createSeed, defaultColumns, emptyQuery, phoneCanvas, phoneSpecNodes } from '../domain/seed'
import { DATA_VERSION, STORAGE_KEY, type AppData, type Category, type ColumnPref, type FeedbackItem, type ListQuery, type ListView, type ParamDef, type ProductFamily, type ProductGroup, type ProductType, type Sku, type SpecRule, type UserRole } from '../domain/types'

type ModuleName = 'products' | 'categories' | 'templates' | 'params' | 'rules' | 'groups' | 'system'
type StoredPayload = { version?: number; data?: AppData }
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
  migrationStorageError = ''
  const data = parsed.data
  if (!data?.families || !data.skus || !data.categories || !data.templates || !data.mappings || !data.templateParams) return null
  const version = parsed.version ?? 1
  if (version < 1 || version > DATA_VERSION) return null
  const benefitProblems = benefitPackageImportProblems(data)
  if (benefitProblems.length) throw new Error(`权益包数据校验失败：${benefitProblems.join(' ')} 原始记录已保留。`)
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
  if (mark.changed && !compatibilityProblems.length && options.persist !== false && typeof localStorage !== 'undefined') {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: DATA_VERSION, data })); migrationStorageError = '' }
    catch (error) { migrationStorageError = `旧配置已在内存中兼容读取，但无法写入本机：${error instanceof Error ? error.message : String(error)}。原存储未被清空，可在解除存储限制后重试保存。` }
  }
  return data
}

function loadData(): AppData {
  let loaded: AppData | undefined
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return createSeed()
    const parsed = JSON.parse(raw) as StoredPayload
    const data = normalizeStored(parsed)
    if (!data) throw new Error('已有数据的基础结构或版本无法读取。')
    loaded = data
    const fix = applyAccessoryCategoryFix(data, PHONE_CASE_CATEGORY_FIX)
    if (fix.changed && typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: DATA_VERSION, data }))
    }
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
  const data = reactive<AppData>(loadData())
  ensureProductListPages(data)
  let explicitlyPersisted = ''

  watch(
    data,
    () => {
      const encoded = JSON.stringify({ version: DATA_VERSION, data })
      if (encoded === explicitlyPersisted) { explicitlyPersisted = ''; return }
      explicitlyPersisted = ''
      localStorage.setItem(STORAGE_KEY, encoded)
    },
    { deep: true },
  )

  const isAdmin = computed(() => data.activeRole === 'admin')

  function benefitPermission(): BenefitCommandResult | undefined {
    return isAdmin.value ? undefined : { ok: false, message: '当前角色仅可查看权益包和交付清单，请由管理员维护。' }
  }

  /** Persist a complete candidate before exposing either configuration or snapshot changes. */
  function commitBenefitState(next: AppData, result: BenefitCommandResult): BenefitCommandResult {
    if (!result.ok) return result
    if (JSON.stringify([data.benefitPackages, data.benefitDeliveries]) === JSON.stringify([next.benefitPackages, next.benefitDeliveries])) return result
    try {
      const encoded = JSON.stringify({ version: DATA_VERSION, data: next })
      localStorage.setItem(STORAGE_KEY, encoded)
      if (next.benefitPackages !== undefined) data.benefitPackages = next.benefitPackages
      else delete data.benefitPackages
      if (next.benefitDeliveries !== undefined) data.benefitDeliveries = next.benefitDeliveries
      else delete data.benefitDeliveries
      explicitlyPersisted = JSON.stringify({ version: DATA_VERSION, data })
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
    if (receipt) return receipt.packageId === input.packageId ? { ok: true, id: receipt.id, delivery: cloneCompatibility(receipt) } : { ok: false, message: '本次请求已属于另一权益包，请发起新的生成操作。' }
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
    const result = persistSkuPage(data, next, text => localStorage.setItem(STORAGE_KEY, text), DATA_VERSION)
    if (result.ok) { explicitlyPersisted = result.encoded; migrationStorageError = '' }
    return result
  }

  function compatibilityPermission(): CompatibilityCommandResult | undefined {
    return isAdmin.value ? undefined : { ok: false, message: '当前角色仅可查看适用关系，请由管理员维护。' }
  }

  /** Only these compatibility-owned arrays are changed, after the full payload is stored. */
  function commitCompatibilityState(next: AppData, result: CompatibilityCommandResult): CompatibilityCommandResult {
    if (!result.ok) return result
    const before = JSON.stringify([data.compatibilities, data.deviceModels, data.deviceBindings])
    if (before === JSON.stringify([next.compatibilities, next.deviceModels, next.deviceBindings])) return result
    try {
      const encoded = JSON.stringify({ version: DATA_VERSION, data: next })
      localStorage.setItem(STORAGE_KEY, encoded)
      explicitlyPersisted = encoded
      data.compatibilities = next.compatibilities
      if (next.deviceModels !== undefined) data.deviceModels = next.deviceModels
      else delete data.deviceModels
      if (next.deviceBindings !== undefined) data.deviceBindings = next.deviceBindings
      else delete data.deviceBindings
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
    const result = applyCompatibilityChanges(next, changes, () => uid('compat'), new Date().toISOString())
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
    ensureProductListPages(next)
    Object.assign(data, next)
    if (next.deviceModels === undefined) delete data.deviceModels
    if (next.deviceBindings === undefined) delete data.deviceBindings
    if (next.benefitPackages === undefined) delete data.benefitPackages
    if (next.benefitDeliveries === undefined) delete data.benefitDeliveries
  }

  function resetAll() {
    replaceAll(createSeed())
  }

  function resetModule(name: ModuleName) {
    const fresh = createSeed()
    if (name === 'products') {
      data.families = fresh.families
      data.skus = fresh.skus
    } else if (name === 'categories') {
      data.categories = fresh.categories
      data.mappings = fresh.mappings
      data.productTypes = fresh.productTypes
    } else if (name === 'templates') {
      data.templates = fresh.templates
      data.templateParams = fresh.templateParams
      data.mappings = fresh.mappings
      data.productSpecNodes = fresh.productSpecNodes
      data.specCanvases = fresh.specCanvases
      data.specModelVersions = fresh.specModelVersions
    } else if (name === 'params') {
      data.params = fresh.params
      data.templateParams = fresh.templateParams
    } else if (name === 'rules') {
      data.rules = fresh.rules
    } else if (name === 'groups') {
      data.productGroups = fresh.productGroups
    } else {
      data.users = fresh.users
      data.feedbacks = fresh.feedbacks
      data.profile = fresh.profile
    }
  }

  function exportJson() {
    return JSON.stringify({ version: DATA_VERSION, data }, null, 2)
  }

  function importJson(text: string) {
    const parsed = JSON.parse(text) as StoredPayload
    if (!parsed.data) throw new Error('导入文件缺少商品数据，当前数据没有被替换。')
    if (!Array.isArray(parsed.data.skus) || !Array.isArray(parsed.data.families)) throw new Error('导入文件缺少有效的商品数组，当前数据没有被替换。')
    if (!isAdmin.value && JSON.stringify([parsed.data.compatibilities || [], parsed.data.deviceModels, parsed.data.deviceBindings]) !== JSON.stringify([data.compatibilities, data.deviceModels, data.deviceBindings])) throw new Error('当前角色仅可查看适用关系，不能通过导入修改声明或设备绑定。')
    if (!isAdmin.value && JSON.stringify([parsed.data.benefitPackages || [], parsed.data.benefitDeliveries || []]) !== JSON.stringify([data.benefitPackages || [], data.benefitDeliveries || []])) throw new Error('当前角色仅可查看权益包，不能通过导入修改配置或交付清单。')
    const benefitProblems = benefitPackageImportProblems(parsed.data)
    if (benefitProblems.length) throw new Error(`权益包导入校验失败：${benefitProblems.join(' ')} 当前数据没有被替换。`)
    const compatibilityProblems = compatibilityImportProblems(parsed.data)
    if (compatibilityProblems.length) throw new Error(`适用关系导入校验失败：${compatibilityProblems.join(' ')} 当前数据没有被替换。`)
    const next = normalizeStored(parsed, { persist: false })
    if (!next?.params) throw new Error('演示数据版本不匹配，当前数据没有被替换')
    if (migrationStorageError) throw new Error(migrationStorageError)
    const encoded = JSON.stringify({ version: DATA_VERSION, data: next })
    try { localStorage.setItem(STORAGE_KEY, encoded) }
    catch (error) { throw new Error(`无法写入本机：${error instanceof Error ? error.message : String(error)}。当前数据和原存储未改变，可重试导入。`) }
    replaceAll(next)
    // Object.assign preserves the live object's key order. The imported payload
    // may have a different order while containing identical data; suppress only
    // the immediate watch echo of the successfully committed live state.
    explicitlyPersisted = JSON.stringify({ version: DATA_VERSION, data })
  }

  function skusOf(familyId: string) {
    return familySkus(data, familyId)
  }

  function saveBundle(family: ProductFamily, skus: Sku[]) {
    // Compatibility entry for the old editor: validate the complete operation before writing.
    // Missing children are retained; an editor draft is never a deletion instruction.
    const trial: AppData = JSON.parse(JSON.stringify(data))
    const now = new Date().toISOString()
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
    data.families = trial.families
    data.skus = trial.skus
    return { ok: true as const }
  }

  function removeFamily(id: string) {
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
    const templateId = uid('tpl')
    data.templates.push({ id: templateId, name, parentId: null, enabled: true, structureOrder: [] })
    data.specCanvases.push({
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
    return { ok: true, message: '', templateId }
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
    data.activeRole = role
  }

  function publishSpecModel(templateId: string): { ok: boolean; message: string } {
    const nodes = data.productSpecNodes.filter((item) => item.templateId === templateId)
    const problems = specPublishProblems(data, nodes)
    if (problems.length) return { ok: false, message: problems[0] }
    const versions = data.specModelVersions.filter((item) => item.templateId === templateId).slice().sort((a, b) => a.version - b.version)
    const latest = versions[versions.length - 1]
    const now = new Date().toISOString()
    let canvas = data.specCanvases.find((item) => item.templateId === templateId)
    if (!canvas) {
      canvas = { templateId, zoom: 1, panX: 0, panY: 0, status: 'draft', version: 1, versionName: 'V1', direction: 'ltr', updatedAt: now }
      data.specCanvases.push(canvas)
    }
    if (latest && latest.status === 'published' && sameSpecSnapshot(latest.nodesSnapshot, nodes) && !draftHostRulesDiffer(data, templateId, latest.id)) {
      canvas.status = 'published'
      canvas.version = latest.version
      canvas.versionName = latest.versionName
      canvas.updatedAt = now
      const outcome = alignPlanning(templateId, latest.id, now)
      if (outcome.created > 0) return { ok: true, message: `当前内容和 ${latest.versionName} 一致，没有生成新版本。已为 ${outcome.created} 条规格组合生成规划编号。` }
      return { ok: false, message: `当前内容和 ${latest.versionName} 一致，没有生成新版本。` }
    }
    const version = (latest?.version || 0) + 1
    const versionName = `V${version}`
    const versionId = uid('mv')
    data.specModelVersions.push({
      id: versionId,
      templateId,
      version,
      versionName,
      status: 'published',
      nodesSnapshot: nodes.map((item) => ({ ...item, namingRule: item.namingRule?.map((part) => ({ ...part })) })),
      createdTime: now,
      publishTime: now,
    })
    freezeDraftNodeHosts(data, templateId, versionId, now, uid)
    canvas.status = 'published'
    canvas.version = version
    canvas.versionName = versionName
    canvas.updatedAt = now
    const outcome = alignPlanning(templateId, versionId, now)
    const retired = outcome.retired ? `，停用 ${outcome.retired} 个不再存在的组合` : ''
    return { ok: true, message: `已发布 ${versionName}。合法组合 ${outcome.created + outcome.reused} 条，新增编号 ${outcome.created} 个，沿用 ${outcome.reused} 个${retired}。已有版本不会被覆盖。` }
  }

  function alignPlanning(templateId: string, versionId: string, now: string) {
    if (!Array.isArray(data.planningRecords)) data.planningRecords = []
    const version = data.specModelVersions.find((item) => item.id === versionId)
    if (!version) return { created: 0, reused: 0, retired: 0 }
    const outcome = reconcilePlanningRecords({
      records: data.planningRecords,
      data,
      productModelId: templateId,
      modelVersionId: version.id,
      nodes: version.nodesSnapshot,
      now,
    })
    data.planningRecords = outcome.records
    return outcome
  }

  function createMaterial(input: { productModelId: string; modelVersionId: string; planningId: string; requestId: string; categoryId: string; productTypeId: string; familyId?: string; skuName?: string; supplierCode?: string; guanjiapoCode?: string; oaSkuId?: string; materialDescription?: string }) {
    return createV3Material(data, { ...input, nextId: uid })
  }

  function createTemporary(input: { requestId: string; categoryId: string; productTypeId: string; productModelId?: string; modelVersionId?: string; attrs: { attributeId: string; value: string; source: 'dictionary' | 'manual' }[]; materialCode: string; skuName?: string; supplierCode?: string; guanjiapoCode?: string; oaSkuId?: string; materialDescription?: string }) {
    return createTemporaryMaterial(data, { ...input, nextId: uid })
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

  return {
    data,
    commitSkuPage,
    saveBenefitPackage,
    setBenefitPackageStatus,
    setBenefitPackageFavorite,
    generateBenefitDelivery,
    commitCompatibilityChanges,
    commitDeviceBinding,
    clearDeviceBinding,
    saveDeviceModel,
    removeDeviceModel,
    isAdmin,
    resetAll,
    resetModule,
    exportJson,
    importJson,
    skusOf,
    saveBundle,
    saveSpu: (family: ProductFamily) => family.id && !data.families.some(item => item.id === family.id)
      ? { ok: false as const, message: 'SPU 已不存在，请重新打开列表；未重新创建已删除的记录。' }
      : saveSpu(data, { ...family, id: family.id || unusedCatalogId('fam') }, new Date().toISOString()),
    appendSkus: (familyId: string, generation: SkuGeneration, selectedKeys: string[]) => appendSkuBatch(data, { familyId, generation, selectedKeys, now: new Date().toISOString(), nextId: () => unusedCatalogId('sku') }),
    editSku: (id: string, draft: SkuDraft) => editSku(data, id, draft, new Date().toISOString()),
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
    createProductModel,
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
    publishSpecModel,
    createMaterial,
    createTemporary,
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
})

export type { Category, FeedbackItem, ParamDef, ProductFamily, ProductGroup, ProductType, SpecRule }
