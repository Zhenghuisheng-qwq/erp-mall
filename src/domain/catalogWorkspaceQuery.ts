import { createCatalogIdentityContext } from './catalogIdentity'
import { categoryDisplayParents } from './categoryTree'
import { inspectFamily } from './logic'
import { savedSkuCode, savedSkuName } from './productList'
import type { AppData, Category, ProductFamily, ProductType, Sku, SpecModelVersion } from './types'

export const CATALOG_SPU_DEFINITION = 'SPU 按现有商品管理的 Family 商品主体计数，包含承载物料的主体；不是销售 SPU 专属数量。销售 SKU 与 MAT 分开按真实身份统计。'
export type CatalogMetricKind = 'types' | 'models' | 'spus' | 'skus' | 'materials' | 'pending'
export type CatalogRecordKind = Exclude<CatalogMetricKind, 'pending'> | 'categories'
export interface CatalogMetric { readable: boolean; ids: string[]; count: number | null }
export type CatalogWorkspaceMetrics = Record<CatalogMetricKind, CatalogMetric>
export interface CatalogWorkspaceIssue {
  id: string; recordKey: string; kind: CatalogRecordKind; recordId: string
  level: 'error' | 'incomplete'; code: string; message: string
}
export interface CatalogDetailRow {
  id: string; recordId: string; kind: CatalogRecordKind; name: string; code: string; status: string
  categoryIds: string[]; categoryPaths: string[]; productTypeId: string; modelId: string
  sourceText: string; issues: CatalogWorkspaceIssue[]; route?: string; routeUnavailableReason?: string
}
export interface CatalogTypeRow {
  id: string; name: string; status: ProductType['status']; description: string
  categoryIds: string[]; categoryPaths: string[]; metrics: CatalogWorkspaceMetrics
}
export interface CatalogModelRow {
  id: string; name: string; productTypeId: string; typeName: string
  categoryIds: string[]; categoryPaths: string[]
  status: 'draft' | 'published' | 'published-draft' | 'offline' | 'unrecorded'
  statusText: string; publishedVersions: SpecModelVersion[]; latestPublishedVersion?: SpecModelVersion
  updatedAt: string; hasCanvas: boolean; metrics: CatalogWorkspaceMetrics
}
export interface CatalogScopeInput { categoryId?: string; includeDescendants?: boolean }
export interface CatalogScopeResult { valid: boolean; message?: string; categoryIds: string[]; metrics: CatalogWorkspaceMetrics }
export interface CatalogWorkspaceIndex {
  categories: Category[]; typeRows: CatalogTypeRow[]; modelRows: CatalogModelRow[]
  issues: CatalogWorkspaceIssue[]; unassigned: CatalogWorkspaceMetrics
  scope(input?: CatalogScopeInput): CatalogScopeResult
  categoryMetrics(id: string, includeDescendants?: boolean): CatalogWorkspaceMetrics
  typeMetrics(id: string): CatalogWorkspaceMetrics
  modelMetrics(id: string): CatalogWorkspaceMetrics
  details(kind: CatalogMetricKind, ids: readonly string[]): CatalogDetailRow[]
}

const metricKinds: CatalogMetricKind[] = ['types', 'models', 'spus', 'skus', 'materials', 'pending']
type Buckets = Record<CatalogMetricKind, Set<string>>
const buckets = (): Buckets => ({ types: new Set(), models: new Set(), spus: new Set(), skus: new Set(), materials: new Set(), pending: new Set() })
const unique = <T>(values: Iterable<T>) => [...new Set(values)]
const recordKey = (kind: CatalogRecordKind, id: string) => `${kind}:${id}`
interface SourceProof { modelId: string; typeId: string; versionId: string; modelRecorded: boolean }
const byId = <T extends { id: string }>(rows: readonly T[]) => { const result = new Map<string, T>(); for (const row of rows) if (!result.has(row.id)) result.set(row.id, row); return result }

/** Read-only identity index. No canvas creation, ownership repair or specification expansion is performed. */
export function buildCatalogWorkspaceIndex(data: AppData, can: (permission: string) => boolean = () => true): CatalogWorkspaceIndex {
  const readable = {
    categories: can('product:category:read'), types: can('product:type:read'), models: can('product:model:read'),
    spus: can('product:spu:read'), skus: can('product:sku:read'), materials: can('product:material:read'),
    pending: false,
  }
  readable.pending = Object.values(readable).some(Boolean)
  const categories = byId(data.categories), families = byId(data.families), skus = byId(data.skus), versions = byId(data.specModelVersions)
  const templates = byId(data.templates), plans = byId(data.productPlans)
  const typeRecords = new Map<string, ProductType[]>(), canvases = new Map(data.specCanvases.map(row => [row.templateId, row]))
  for (const row of data.productTypes) { const list = typeRecords.get(row.id) || []; list.push(row); typeRecords.set(row.id, list) }
  const nodeModelIds = new Set(data.productSpecNodes.map(row => row.templateId))
  const modelIds = new Set([...canvases.keys(), ...nodeModelIds, ...data.specModelVersions.map(row => row.templateId)])
  modelIds.delete('')
  const versionsByModel = new Map<string, SpecModelVersion[]>()
  for (const version of versions.values()) { const list = versionsByModel.get(version.templateId) || []; list.push(version); versionsByModel.set(version.templateId, list) }
  const planning = new Map(data.planningRecords.map(row => [row.planningId, row]))
  const identity = createCatalogIdentityContext(data)
  const rawCategory = new Map<string, Buckets>(), rawType = new Map<string, Buckets>(), rawModel = new Map<string, Buckets>(), all = buckets(), unassigned = buckets()
  const recordCategories = new Map<string, string[]>(), recordTypes = new Map<string, string[]>(), recordModels = new Map<string, string[]>()
  const detailRows = new Map<string, CatalogDetailRow>(), issues: CatalogWorkspaceIssue[] = [], issueIds = new Set<string>()
  const paths = new Map<string, string>()
  function categoryPath(id: string): string {
    if (!readable.categories) return '不可查看'
    if (!categories.has(id)) return id ? `失效分类（${id}）` : '未归属'
    if (paths.has(id)) return paths.get(id)!
    const names: string[] = [], seen = new Set<string>(); let current = categories.get(id)
    while (current && !seen.has(current.id)) { seen.add(current.id); names.unshift(current.name); current = current.parentId ? categories.get(current.parentId) : undefined }
    const result = names.join(' / '); paths.set(id, result); return result
  }
  function getBucket(map: Map<string, Buckets>, id: string) { let value = map.get(id); if (!value) { value = buckets(); map.set(id, value) } return value }
  function mask(raw: Buckets): CatalogWorkspaceMetrics {
    return Object.fromEntries(metricKinds.map(kind => [kind, { readable: readable[kind], ids: readable[kind] ? [...raw[kind]] : [], count: readable[kind] ? raw[kind].size : null }])) as CatalogWorkspaceMetrics
  }
  function register(kind: CatalogRecordKind, id: string, categoryIds: string[], typeIds: string[] = [], linkedModels: string[] = []) {
    const key = recordKey(kind, id)
    recordCategories.set(key, unique(categoryIds)); recordTypes.set(key, unique(typeIds)); recordModels.set(key, unique(linkedModels))
    if (kind === 'categories') return
    all[kind].add(id)
    const validCategories = categoryIds.filter(categoryId => categories.has(categoryId))
    if (!validCategories.length) unassigned[kind].add(id)
    for (const categoryId of validCategories) getBucket(rawCategory, categoryId)[kind].add(id)
    for (const typeId of typeIds) if (typeRecords.has(typeId)) getBucket(rawType, typeId)[kind].add(id)
    for (const modelId of linkedModels) if (modelIds.has(modelId)) getBucket(rawModel, modelId)[kind].add(id)
  }
  function addIssue(kind: CatalogRecordKind, id: string, code: string, message: string, level: CatalogWorkspaceIssue['level'] = 'incomplete') {
    if (!readable[kind]) return
    const key = recordKey(kind, id), issueId = `${key}:${code}`
    if (issueIds.has(issueId)) return
    issueIds.add(issueId)
    issues.push({ id: issueId, recordKey: key, kind, recordId: id, level, code, message })
  }
  function makeDetail(kind: CatalogRecordKind, id: string, name: string, status: string, sourceText = '', code = id) {
    if (!readable[kind]) return
    const key = recordKey(kind, id), categoryIds = recordCategories.get(key) || []
    const materialFamily = kind === 'materials' ? families.get(skus.get(id)?.familyId || '') : undefined
    const route = kind === 'spus' ? `/spus/${encodeURIComponent(id)}` : kind === 'skus' && families.has(skus.get(id)?.familyId || '') ? `/skus/${encodeURIComponent(id)}` : kind === 'materials' && materialFamily?.line === 'v3' ? `/materials/${encodeURIComponent(materialFamily.id)}?sku=${encodeURIComponent(id)}` : undefined
    detailRows.set(key, { id, recordId: id, kind, name, code, status, categoryIds: readable.categories ? [...categoryIds] : [], categoryPaths: readable.categories ? categoryIds.length ? categoryIds.map(categoryPath) : ['未归属'] : ['不可查看'], productTypeId: readable.types ? recordTypes.get(key)?.[0] || '' : '', modelId: readable.models ? recordModels.get(key)?.[0] || '' : '', sourceText, issues: [], ...(route ? { route } : {}), ...(kind === 'materials' && !route ? { routeUnavailableReason: '此历史物料的主体无法由现有物料管理页准确承接，保留在当前只读明细中核对。' } : {}) })
  }
  function typeCategoryIds(typeId: string) { return unique((typeRecords.get(typeId) || []).map(row => row.categoryId).filter(Boolean)) }
  function familySource(family: ProductFamily): SourceProof {
    const plan = family.productPlanId ? plans.get(family.productPlanId) : undefined
    const version = family.modelVersionId ? versions.get(family.modelVersionId) : undefined
    return { modelId: family.productModelId || version?.templateId || plan?.productModelId || (modelIds.has(family.templateId) ? family.templateId : ''), typeId: family.productTypeId || plan?.productTypeId || '', versionId: family.modelVersionId || plan?.modelVersionId || '', modelRecorded: !!(family.productModelId || version?.templateId || plan?.productModelId) }
  }
  function skuSource(sku: Sku, family: ProductFamily | undefined) {
    const own = sku.creationSource, plan = own?.productPlanId ? plans.get(own.productPlanId) : undefined
    const record = sku.planningId ? planning.get(sku.planningId) : undefined
    const familyProof = family ? familySource(family) : { modelId: '', typeId: '', versionId: '', modelRecorded: false }
    // An explicit per-SKU source wins over the shared Family's historical single-source fields.
    const versionId = own ? own.modelVersionId : sku.modelVersionId || record?.originModelVersionId || ((sku.sourceNodeIds?.length || sku.planningId) ? familyProof.versionId : '')
    const ownModelId = own && (own.kind === 'model' || own.kind === 'plan' || modelIds.has(own.templateId)) ? own.templateId : ''
    const modelId = own ? ownModelId || versions.get(versionId)?.templateId || plan?.productModelId || '' : versions.get(versionId)?.templateId || record?.productModelId || familyProof.modelId
    const sameFamilySource = modelId === familyProof.modelId && (!own ? !versionId || !familyProof.versionId || versionId === familyProof.versionId : !!modelId && !!versionId && versionId === familyProof.versionId)
    return { modelId, typeId: plan?.productTypeId || (sameFamilySource ? familyProof.typeId : ''), versionId, modelRecorded: own ? !!(own.kind === 'model' || own.kind === 'plan' || versions.has(versionId)) : !!(versions.has(versionId) || record?.productModelId || familyProof.modelRecorded) }
  }
  function sourceText(source: SourceProof) {
    const model = !readable.models ? '模型不可查看' : source.modelId ? modelIds.has(source.modelId) ? source.modelRecorded ? `模型 ${source.modelId}` : `模型关联 ${source.modelId}（创建来源未记录）` : `失效模型 ${source.modelId}` : '模型来源未记录'
    const type = !readable.types ? '类型不可查看' : source.typeId ? typeRecords.has(source.typeId) ? `类型 ${source.typeId}` : `失效类型 ${source.typeId}` : '类型来源未记录'
    const version = !readable.models ? '' : source.versionId ? `版本 ${versions.get(source.versionId)?.versionName || source.versionId}` : '发布版本未记录'
    return [model, type, version].filter(Boolean).join(' · ')
  }
  function sourceIssues(kind: 'spus' | 'skus' | 'materials', id: string, source: SourceProof) {
    if (readable.models) {
      if (!source.modelId || !source.modelRecorded) addIssue(kind, id, 'source-model-missing', '创建时的模型来源未记录；已有模型关联不代替历史来源。')
      else if (!modelIds.has(source.modelId)) addIssue(kind, id, 'source-model-invalid', '记录的模型来源已失效。', 'error')
      if (!source.versionId) addIssue(kind, id, 'source-version-missing', '发布版本来源未记录。')
      else if (!versions.has(source.versionId) || (source.modelId && versions.get(source.versionId)?.templateId !== source.modelId)) addIssue(kind, id, 'source-version-invalid', '发布版本来源不存在或与记录的模型不一致。', 'error')
    }
    if (readable.types) {
      if (!source.typeId) addIssue(kind, id, 'source-type-missing', '创建时的产品类型未记录。')
      else if (!typeRecords.has(source.typeId)) addIssue(kind, id, 'source-type-invalid', '创建时记录的产品类型已失效。', 'error')
    }
  }

  for (const category of categories.values()) {
    register('categories', category.id, [category.id])
    makeDetail('categories', category.id, category.name, category.enabled === false ? '停用' : '启用')
    if (category.parentId && !categories.has(category.parentId)) addIssue('categories', category.id, 'parent-invalid', '上级分类不存在；当前记录仍保留。', 'error')
  }
  for (const [id, records] of typeRecords) {
    const row = records[0]!, categoryIds = typeCategoryIds(id)
    register('types', id, categoryIds, [id]); makeDetail('types', id, row.name, row.status === 'disabled' ? '停用' : '启用')
    if (readable.categories && (!categoryIds.length || categoryIds.some(categoryId => !categories.has(categoryId)))) addIssue('types', id, 'category-invalid', '明确关联的分类未记录或已失效。', 'error')
  }
  const modelBase = new Map<string, Omit<CatalogModelRow, 'metrics'>>()
  for (const id of modelIds) {
    const canvas = canvases.get(id), typeId = canvas?.productTypeId || '', categoryIds = typeCategoryIds(typeId)
    const publishedVersions = (versionsByModel.get(id) || []).filter(version => version.status === 'published').sort((a, b) => b.version - a.version || b.publishTime.localeCompare(a.publishTime) || a.id.localeCompare(b.id))
    const latestPublishedVersion = publishedVersions[0]
    const status: CatalogModelRow['status'] = canvas?.status === 'offline' ? 'offline' : publishedVersions.length ? canvas?.status === 'draft' ? 'published-draft' : 'published' : canvas?.status === 'published' ? 'unrecorded' : canvas || nodeModelIds.has(id) ? 'draft' : 'unrecorded'
    const statusText = { draft: '草稿，尚未发布', published: '已有发布版本', 'published-draft': '已有发布版本 · 草稿编辑中', offline: '已下线', unrecorded: '没有可用发布版本' }[status]
    const name = canvas?.name?.trim() || templates.get(id)?.name?.trim() || '未命名模型'
    register('models', id, categoryIds, typeId ? [typeId] : [], [id]); makeDetail('models', id, name, statusText)
    if (readable.types && (!typeId || !typeRecords.has(typeId))) addIssue('models', id, typeId ? 'type-invalid' : 'type-missing', typeId ? '当前归属的产品类型已失效。' : '当前产品类型归属未记录。', typeId ? 'error' : 'incomplete')
    if (!publishedVersions.length && canvas?.status !== 'offline') addIssue('models', id, 'unpublished', '尚无发布版本；可继续完善模型。')
    modelBase.set(id, { id, name, productTypeId: readable.types ? typeId : '', typeName: !readable.types ? '不可查看' : typeRecords.get(typeId)?.[0]?.name || (typeId ? '类型已失效' : '未记录'), categoryIds: readable.categories ? categoryIds : [], categoryPaths: readable.categories ? categoryIds.length ? categoryIds.map(categoryPath) : ['未归属'] : ['不可查看'], status, statusText, publishedVersions, ...(latestPublishedVersion ? { latestPublishedVersion } : {}), updatedAt: canvas?.updatedAt || '', hasCanvas: !!canvas })
  }
  for (const family of families.values()) {
    const source = familySource(family)
    register('spus', family.id, family.categoryId ? [family.categoryId] : [], source.typeId ? [source.typeId] : [], source.modelId ? [source.modelId] : [])
    makeDetail('spus', family.id, family.name, family.shelfStatus || family.lifecycle, sourceText(source), family.oaProductId || family.id)
    if (readable.categories && (!family.categoryId || !categories.has(family.categoryId))) addIssue('spus', family.id, 'category-invalid', family.categoryId ? '商品实际分类已失效。' : '商品尚未归属分类。', family.categoryId ? 'error' : 'incomplete')
    sourceIssues('spus', family.id, source)
  }
  const skusByFamily = new Map<string, Sku[]>(), additionalFamilyModels = new Map<string, Set<string>>()
  for (const sku of skus.values()) {
    const list = skusByFamily.get(sku.familyId) || []; list.push(sku); skusByFamily.set(sku.familyId, list)
    const family = families.get(sku.familyId), material = identity.isMaterialArchive(sku), real = identity.isRealSku(sku)
    const kind = material ? 'materials' : 'skus', source = skuSource(sku, family)
    if (real || material) register(kind, sku.id, family?.categoryId ? [family.categoryId] : [], source.typeId ? [source.typeId] : [], source.modelId ? [source.modelId] : [])
    else { recordCategories.set(recordKey(kind, sku.id), []); recordTypes.set(recordKey(kind, sku.id), []); recordModels.set(recordKey(kind, sku.id), []) }
    makeDetail(kind, sku.id, savedSkuName(sku), sku.status, sourceText(source), material ? sku.materialCode || sku.id : savedSkuCode(sku))
    if (!family) addIssue(kind, sku.id, 'family-invalid', '所属商品主体不存在，不能计作有效销售 SKU。', 'error')
    if (family && readable.categories && (!family.categoryId || !categories.has(family.categoryId))) addIssue(kind, sku.id, 'category-invalid', '所属商品的实际分类未记录或已失效。', family.categoryId ? 'error' : 'incomplete')
    sourceIssues(kind, sku.id, source)
    if (sku.planningId && !planning.has(sku.planningId) && can('product:planning:read')) addIssue(kind, sku.id, 'planning-invalid', '引用的规划编号已失效。', 'error')
    // A Family can legitimately contain SKUs created from more than one model. Keep each explicit source.
    if (family && (real || material)) {
      const familyKey = recordKey('spus', family.id)
      if (source.modelId && modelIds.has(source.modelId)) {
        getBucket(rawModel, source.modelId).spus.add(family.id)
        recordModels.set(familyKey, unique([...(recordModels.get(familyKey) || []), source.modelId]))
        if (source.modelId !== familySource(family).modelId) { const ids = additionalFamilyModels.get(family.id) || new Set<string>(); ids.add(source.modelId); additionalFamilyModels.set(family.id, ids) }
      }
      if (source.typeId && typeRecords.has(source.typeId)) { getBucket(rawType, source.typeId).spus.add(family.id); recordTypes.set(familyKey, unique([...(recordTypes.get(familyKey) || []), source.typeId])) }
    }
  }
  if (readable.models) for (const [id, sourceIds] of additionalFamilyModels) { const row = detailRows.get(recordKey('spus', id)); if (row) row.sourceText += `；部分规格另有已记录模型来源：${[...sourceIds].join('、')}` }
  for (const id of typeRecords.keys()) if (readable.models && !getBucket(rawType, id).models.size) addIssue('types', id, 'no-model', '尚未建立模型；这是可继续完善的正常阶段。')
  // Reuse existing quality decisions only where they apply. Empty subjects remain a normal stage.
  // Product validation is gated by its own read permission and evaluated once per Family, never once per tree row.
  if (can('product:check:read')) for (const family of families.values()) {
    const children = skusByFamily.get(family.id) || []
    if (!children.length) continue
    for (const issue of inspectFamily(data, family, children)) {
      const sku = issue.skuId ? skus.get(issue.skuId) : undefined
      const kind = sku ? identity.isMaterialArchive(sku) ? 'materials' : 'skus' : 'spus'
      addIssue(kind, sku?.id || family.id, `quality:${issue.kind}:${issue.paramId || issue.paramName || ''}:${issue.message}`, issue.message, issue.level === 'error' ? 'error' : 'incomplete')
    }
  }
  for (const issue of issues) {
    all.pending.add(issue.recordKey)
    const ids = recordCategories.get(issue.recordKey) || []
    if (!ids.some(id => categories.has(id))) unassigned.pending.add(issue.recordKey)
    for (const id of ids) if (categories.has(id)) getBucket(rawCategory, id).pending.add(issue.recordKey)
    for (const id of recordTypes.get(issue.recordKey) || []) if (typeRecords.has(id)) getBucket(rawType, id).pending.add(issue.recordKey)
    for (const id of recordModels.get(issue.recordKey) || []) if (modelIds.has(id)) getBucket(rawModel, id).pending.add(issue.recordKey)
    detailRows.get(issue.recordKey)?.issues.push(issue)
  }
  const displayParents = categoryDisplayParents([...categories.values()]), children = new Map<string, string[]>()
  for (const [id, parent] of displayParents) if (parent) { const list = children.get(parent) || []; list.push(id); children.set(parent, list) }
  const scopeCache = new Map<string, CatalogScopeResult>()
  function scope(input: CatalogScopeInput = {}): CatalogScopeResult {
    const id = input.categoryId || '', include = input.includeDescendants !== false, cacheKey = JSON.stringify([id, include])
    const cached = scopeCache.get(cacheKey); if (cached) return cached
    if (id && (!readable.categories || !categories.has(id))) return { valid: false, message: readable.categories ? '分类范围已失效，请重新选择；未切换到全部数据。' : '当前身份不能查看此分类范围。', categoryIds: [], metrics: mask(buckets()) }
    if (!id) return { valid: true, categoryIds: readable.categories ? [...categories.keys()] : [], metrics: mask(all) }
    const selected = new Set<string>(), stack = [id]
    while (stack.length) { const next = stack.pop()!; if (selected.has(next)) continue; selected.add(next); if (include) stack.push(...children.get(next) || []) }
    const merged = buckets()
    for (const categoryId of selected) { const part = rawCategory.get(categoryId); if (!part) continue; for (const kind of metricKinds) for (const value of part[kind]) merged[kind].add(value) }
    const result = { valid: true, categoryIds: [...selected], metrics: mask(merged) }; scopeCache.set(cacheKey, result); return result
  }
  const unavailableMetrics = () => Object.fromEntries(metricKinds.map(kind => [kind, { readable: false, ids: [], count: null }])) as unknown as CatalogWorkspaceMetrics
  const typeMetrics = (id: string) => readable.types ? mask(typeRecords.has(id) ? getBucket(rawType, id) : buckets()) : unavailableMetrics()
  const modelMetrics = (id: string) => readable.models ? mask(modelIds.has(id) ? getBucket(rawModel, id) : buckets()) : unavailableMetrics()
  return {
    categories: readable.categories ? [...categories.values()] : [],
    typeRows: readable.types ? [...typeRecords].map(([id, records]) => ({ id, name: records[0]!.name, status: records[0]!.status, description: records[0]!.description, categoryIds: readable.categories ? typeCategoryIds(id) : [], categoryPaths: readable.categories ? typeCategoryIds(id).length ? typeCategoryIds(id).map(categoryPath) : ['未归属'] : ['不可查看'], metrics: typeMetrics(id) })) : [],
    modelRows: readable.models ? [...modelBase.values()].map(row => ({ ...row, metrics: modelMetrics(row.id) })) : [],
    issues, unassigned: mask(unassigned), scope, categoryMetrics: (id, includeDescendants = true) => scope({ categoryId: id, includeDescendants }).metrics, typeMetrics, modelMetrics,
    details(kind, ids) { if (!readable[kind]) return []; return unique(ids).flatMap(id => { const row = detailRows.get(kind === 'pending' ? id : recordKey(kind, id)); return row ? [{ ...row, ...(kind === 'pending' ? { id } : {}), categoryIds: [...row.categoryIds], categoryPaths: [...row.categoryPaths], issues: [...row.issues] }] : [] }) },
  }
}
