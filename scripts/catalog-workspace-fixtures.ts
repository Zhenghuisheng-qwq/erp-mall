import { createSeed } from '../src/domain/seed'
import type { AppData, Category, ProductFamily, ProductType, Sku, SpecCanvasConfig, SpecModelVersion } from '../src/domain/types'

export const CATALOG_WORKSPACE_TIME = '2026-10-27T03:00:00.000Z'
export const catalogCategory = (id: string, parentId: string | null = null, name = id): Category => ({ id, parentId, name, enabled: true, sort: 1 })
export const catalogType = (id: string, categoryId: string, name = id): ProductType => ({ id, categoryId, name, status: 'enabled', description: '隔离测试记录', sort: 1 })
export const catalogModel = (templateId: string, productTypeId: string, name = templateId): SpecCanvasConfig => ({ templateId, productTypeId, name, zoom: 1, panX: 0, panY: 0, status: 'draft', version: 1, versionName: '工作草稿', updatedAt: CATALOG_WORKSPACE_TIME })
export const catalogVersion = (templateId: string, id: string, version = 1): SpecModelVersion => ({ id, templateId, version, versionName: `已发布 V${version}`, status: 'published', nodesSnapshot: [], createdTime: CATALOG_WORKSPACE_TIME, publishTime: CATALOG_WORKSPACE_TIME })
export const catalogFamily = (id: string, categoryId: string, extra: Partial<ProductFamily> = {}): ProductFamily => ({ id, name: id, categoryId, templateId: '', oaProductId: '', commonAttrs: {}, productGroupIds: [], lifecycle: 'ready', origin: 'sample', updatedAt: CATALOG_WORKSPACE_TIME, ...extra })
export const catalogSku = (id: string, familyId: string, extra: Partial<Sku> = {}): Sku => ({ id, familyId, code: id, skuName: id, oaSkuId: '', recordKind: 'sku', status: 'on_sale', variantAttrs: {}, projectedAttrs: {}, createdAt: CATALOG_WORKSPACE_TIME, updatedAt: CATALOG_WORKSPACE_TIME, ...extra })

/** Deliberate legacy gaps and invalid references are isolated here, never patched during reads. */
export function createCatalogWorkspaceFixture(): AppData {
  const data = createSeed()
  data.categories = [catalogCategory('root', null, '手机目录'), catalogCategory('phone', 'root', '手机'), catalogCategory('case', 'root', '配件'), catalogCategory('leaf', 'phone', '手机'), catalogCategory('empty'), catalogCategory('bad-parent', 'gone')]
  data.productTypes = [catalogType('type-phone', 'leaf', '同名类型'), catalogType('type-case', 'case', '同名类型'), catalogType('type-empty', 'empty'), catalogType('type-multi', 'leaf'), catalogType('type-multi', 'case'), catalogType('type-orphan', 'gone')]
  data.specCanvases = [catalogModel('model-phone', 'type-phone', '同名模型'), catalogModel('model-case', 'type-case', '同名模型'), catalogModel('model-empty', 'type-empty'), catalogModel('model-orphan', 'missing-type'), catalogModel('model-multi', 'type-multi')]
  data.templates = data.specCanvases.map(row => ({ id: row.templateId, name: row.name!, parentId: null, enabled: true, structureOrder: [] }))
  data.templates.push({ id: 'scheme-only', name: '仅属性方案，不是模型', parentId: null, enabled: true, structureOrder: [] })
  data.specModelVersions = [catalogVersion('model-phone', 'phone-v1'), catalogVersion('model-phone', 'phone-v2', 2), catalogVersion('model-case', 'case-v1'), { ...catalogVersion('model-version-only', 'version-only'), status: 'offline' }]
  data.productSpecNodes = []; data.params = []; data.templateParams = []; data.rules = []; data.mappings = []; data.productPlans = []
  data.planningRecords = [{ planningId: 'PLN-ONE', productModelId: 'model-phone', originModelVersionId: 'phone-v1', modelVersionId: 'phone-v2', modelVersionIds: ['phone-v1', 'phone-v2'], steps: [], identityKey: 'one-real-planning-record', status: 'active', createdTime: CATALOG_WORKSPACE_TIME }]
  data.families = [
    catalogFamily('spu-parent', 'root', { name: '同名商品', templateId: 'model-phone', productModelId: 'model-phone', modelVersionId: 'phone-v1', productTypeId: 'type-phone' }),
    catalogFamily('spu-child', 'leaf', { name: '同名商品', templateId: 'model-phone', productModelId: 'model-phone', modelVersionId: 'phone-v1', productTypeId: 'type-phone' }),
    catalogFamily('spu-mixed', 'case', { templateId: 'model-case', productModelId: 'model-case', modelVersionId: 'case-v1', productTypeId: 'type-case' }),
    catalogFamily('spu-material-only', 'leaf', { line: 'v3', templateId: 'model-phone', productModelId: 'model-phone', modelVersionId: 'phone-v1', productTypeId: 'type-phone' }),
    catalogFamily('spu-legacy', 'phone', { templateId: 'scheme-only' }),
    catalogFamily('spu-unassigned', ''), catalogFamily('spu-bad-category', 'gone'),
    catalogFamily('spu-bad-source', 'leaf', { productModelId: 'missing-model', productTypeId: 'missing-type', modelVersionId: 'missing-version' }),
  ]
  data.skus = [
    catalogSku('sku-parent', 'spu-parent', { modelVersionId: 'phone-v1' }),
    catalogSku('sku-child', 'spu-child', { modelVersionId: 'phone-v1' }),
    catalogSku('sku-mixed', 'spu-mixed', { modelVersionId: 'case-v1' }),
    catalogSku('mat-mixed', 'spu-mixed', { recordKind: 'material', materialCode: 'MAT-MIXED', planningId: 'PLN-ONE', modelVersionId: 'phone-v1' }),
    catalogSku('mat-one', 'spu-material-only', { recordKind: 'material', materialCode: 'MAT-ONE', planningId: 'PLN-ONE', modelVersionId: 'phone-v1' }),
    catalogSku('mat-two', 'spu-material-only', { recordKind: 'material', materialCode: 'MAT-TWO', planningId: 'PLN-ONE', modelVersionId: 'phone-v1' }),
    catalogSku('sku-legacy', 'spu-legacy'), catalogSku('sku-unassigned', 'spu-unassigned'), catalogSku('sku-bad-category', 'spu-bad-category'),
    catalogSku('sku-orphan', 'missing-family'), catalogSku('mat-orphan', 'missing-family', { recordKind: 'material', materialCode: 'MAT-ORPHAN' }),
  ]
  data.materialReceipts = []; data.compatibilities = []; data.nodeCompatibilityRules = []; data.templateCompatibilityConfigs = []; data.templateCompatibilityOrigins = []
  return data
}
