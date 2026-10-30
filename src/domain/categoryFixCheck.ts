import { applyAccessoryCategoryFix } from './categoryFix'
import { familyChoicesFor } from './material'
import type { AppData } from './types'

export interface CheckResult { id: string; ok: boolean; detail: string }

function world(): AppData {
  return {
    categories: [
      { id: 'host', name: '主机', parentId: null, sort: 1, enabled: true },
      { id: 'c-phone', name: '手机', parentId: 'host', sort: 1, enabled: true },
      { id: 'acc', name: '手机配件', parentId: null, sort: 2, enabled: true },
      { id: 'c-case', name: '保护壳', parentId: 'acc', sort: 1, enabled: true },
      { id: 'dup-parent', name: '手机配件', parentId: 'acc', sort: 2, enabled: true },
    ],
    productTypes: [
      { id: 'pt-mvc6vur1-2', name: '手机壳', categoryId: 'c-phone', status: 'enabled', sort: 1, description: '' },
      { id: 'pt-case', name: '手机保护壳', categoryId: 'c-case', status: 'enabled', sort: 1, description: '', catalogRole: 'accessory' },
      { id: 'pt-phone', name: '手机', categoryId: 'c-phone', status: 'enabled', sort: 2, description: '' },
    ],
    specCanvases: [
      { templateId: 'tpl-case', productTypeId: 'pt-mvc6vur1-2', name: '手机壳模型', zoom: 1, panX: 0, panY: 0, status: 'published', version: 1, versionName: 'V1' },
    ],
    specModelVersions: [
      { id: 'mv-1', templateId: 'tpl-case', version: 1, versionName: 'V1', status: 'published', nodesSnapshot: [{ id: 'n1', templateId: 'tpl-case', parentId: null, nodeType: 'VALUE', attributeId: 'p', valueId: '白', sort: 1 }], createdTime: 't', publishTime: 't' },
    ],
    planningRecords: [
      { planningId: 'PLN-000013', productModelId: 'tpl-case', originModelVersionId: 'mv-1', modelVersionId: 'mv-1', modelVersionIds: ['mv-1'], steps: [], identityKey: 'k', status: 'active', createdTime: 't' },
      { planningId: 'PLN-000005', productModelId: 'tpl-case', originModelVersionId: 'mv-1', modelVersionId: 'mv-1', modelVersionIds: ['mv-1'], steps: [], identityKey: 'k2', status: 'active', createdTime: 't' },
    ],
    materialReceipts: [{ requestId: 'req-1', skuId: 'sku-1', planningId: 'PLN-000013', materialCode: 'MAT-000002', createdTime: 't', lifecycle: 'active' }],
    families: [
      { id: 'fam-mvc9fhvg-36', name: '手机壳模型', templateId: 'tpl-case', modelVersionId: 'mv-1', productModelId: 'tpl-case', productTypeId: 'pt-mvc6vur1-2', line: 'v3', commonSignature: '', categoryId: 'c-phone', oaProductId: '', commonAttrs: {}, productGroupIds: [], lifecycle: 'draft', shelfStatus: 'draft', origin: 'created', updatedAt: 't' },
      { id: 'f-iphone', name: 'Apple iPhone 17', templateId: 't-phone', categoryId: 'c-phone', oaProductId: '', commonAttrs: {}, productGroupIds: [], lifecycle: 'ready', shelfStatus: 'online', origin: 'sample', updatedAt: 't' },
    ],
    skus: [
      { id: 'sku-1', familyId: 'fam-mvc9fhvg-36', code: '', oaSkuId: '', status: 'draft', variantAttrs: { 颜色: '白色' }, projectedAttrs: {}, skuName: '白色壳', planningId: 'PLN-000013', materialCode: 'MAT-000002' },
      { id: 'sku-2', familyId: 'fam-mvc9fhvg-36', code: '', oaSkuId: '', status: 'draft', variantAttrs: { 颜色: '黑色' }, projectedAttrs: {}, skuName: '黑色壳', planningId: 'PLN-000005', materialCode: 'MAT-000003' },
    ],
    compatibilities: [],
    params: [],
    templates: [],
    rules: [],
    mappings: [],
    templateParams: [],
    productSpecNodes: [],
    productPlans: [],
  } as unknown as AppData
}

export function runCategoryFixChecks(): CheckResult[] {
  const results: CheckResult[] = []
  const check = (id: string, ok: boolean, detail: string) => results.push({ id, ok, detail })
  const data = world()
  const snapshot = JSON.stringify(data.specModelVersions)
  const planIds = data.planningRecords.map((item) => item.planningId).join()
  const skuIds = data.skus.map((item) => `${item.id}:${item.materialCode}:${item.planningId}:${item.skuName}`).join()
  const receipt = JSON.stringify(data.materialReceipts)
  const first = applyAccessoryCategoryFix(data, { productTypeId: 'pt-mvc6vur1-2', categoryNames: ['手机配件', '保护壳'] })
  const type = data.productTypes.find((item) => item.id === 'pt-mvc6vur1-2')
  const other = data.productTypes.find((item) => item.id === 'pt-case')
  const phone = data.productTypes.find((item) => item.id === 'pt-phone')
  const family = data.families.find((item) => item.id === 'fam-mvc9fhvg-36')
  const iphone = data.families.find((item) => item.id === 'f-iphone')
  const reused = familyChoicesFor(data, { productModelId: 'tpl-case', productTypeId: 'pt-mvc6vur1-2', categoryId: 'c-case', commonSignature: '' })
  check('move', Boolean(first.ok && first.changed && first.toCategoryId === 'c-case' && first.familyIds.length === 1 && first.materialCodes.includes('MAT-000002') && first.materialCodes.includes('MAT-000003') && first.planningCount === 2 && type?.categoryId === 'c-case' && type.catalogRole === 'accessory' && family?.categoryId === 'c-case' && family.name === '手机壳模型' && family.productModelId === 'tpl-case' && iphone?.categoryId === 'c-phone' && other?.categoryId === 'c-case' && other.catalogRole === 'accessory' && phone?.categoryId === 'c-phone' && !phone.catalogRole && reused.length === 1 && reused[0].id === 'fam-mvc9fhvg-36'), first.message)
  const second = applyAccessoryCategoryFix(data, { productTypeId: 'pt-mvc6vur1-2', categoryNames: ['手机配件', '保护壳'] })
  check('idempotent', second.ok && !second.changed && JSON.stringify(data.specModelVersions) === snapshot && data.planningRecords.map((item) => item.planningId).join() === planIds && data.skus.map((item) => `${item.id}:${item.materialCode}:${item.planningId}:${item.skuName}`).join() === skuIds && JSON.stringify(data.materialReceipts) === receipt, second.message)

  const clash = world()
  clash.families.push({ ...clash.families[0], id: 'fam-other', categoryId: 'c-case', name: '另一款' })
  const blocked = applyAccessoryCategoryFix(clash, { productTypeId: 'pt-mvc6vur1-2', categoryNames: ['手机配件', '保护壳'] })
  check('clash', !blocked.ok && clash.productTypes[0].categoryId === 'c-phone' && clash.families[0].categoryId === 'c-phone', blocked.message)

  const ambiguous = world()
  ambiguous.categories.push({ id: 'acc-2', name: '手机配件', parentId: null, sort: 3, enabled: true })
  const many = applyAccessoryCategoryFix(ambiguous, { productTypeId: 'pt-mvc6vur1-2', categoryNames: ['手机配件', '保护壳'] })
  check('ambiguous-path', !many.ok && ambiguous.productTypes[0].categoryId === 'c-phone', many.message)

  const missing = applyAccessoryCategoryFix(world(), { productTypeId: 'missing', categoryNames: ['手机配件', '保护壳'] })
  check('missing-type', missing.ok && !missing.changed, missing.message)
  return results
}
