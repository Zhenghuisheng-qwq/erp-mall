import { createSeed } from '../src/domain/seed'
import type { AppData, ProductFamily, Sku } from '../src/domain/types'

export const CATALOG_TEST_TIME = '2026-10-23T04:00:00.000Z'
export function createCatalogProductFixture() {
  const data: AppData = createSeed(false)
  const ids = { phoneA: 'phone-a', phoneB: 'phone-b', phoneUnbound: 'phone-unbound', familyDevice: 'family-device', caseSku: 'case-sku', filmSku: 'film-sku', chargerSku: 'charger-sku', cableSku: 'cable-sku', copySku: 'copy-sku', pendingSku: 'pending-sku', blockedSku: 'blocked-sku', offSaleSku: 'off-sale-sku', matCopy: 'mat-copy', matOnly: 'mat-only', modelA: 'model-a', modelB: 'model-b' }
  data.categories = [{ id: 'cat-device-test', name: '独立测试设备', parentId: null, enabled: true, sort: 1 }, { id: 'cat-accessory-test', name: '独立测试配件', parentId: null, enabled: true, sort: 2 }]
  data.productTypes = [
    { id: 'type-device', name: '测试手机', catalogRole: 'host' as const, categoryId: 'cat-device-test', status: 'enabled' as const, sort: 1, description: '独立测试，不是真实商品' },
    ...[['type-case', '测试保护壳'], ['type-film', '测试保护膜'], ['type-charger', '测试充电器'], ['type-cable', '测试线缆']].map(([id, name], index) => ({ id: id || '', name: name || '', catalogRole: 'accessory' as const, categoryId: 'cat-accessory-test', status: 'enabled' as const, sort: index + 2, description: '独立测试，不是真实商品' })),
  ]
  data.params = [
    { id: 'attr-device-model', name: '测试设备型号', values: ['Orion A', 'Orion B'], identityRole: 'host-model' as const, valueGroups: [], participateInStructure: true },
    { id: 'attr-color', name: '颜色', values: ['黑色', '白色'], valueGroups: [], participateInStructure: true },
    { id: 'attr-capacity', name: '容量', values: ['128G', '256G'], valueGroups: [], participateInStructure: true },
    { id: 'attr-brand', name: '品牌', values: ['DeviceLab', 'CaseWorks'], valueGroups: [], participateInStructure: true },
    { id: 'attr-port', name: '接口', values: ['USB-C', 'Lightning'], valueGroups: [], participateInStructure: true },
  ]
  data.templates = [{ id: 'template-device-test', name: '独立测试手机方案', parentId: null, enabled: true, structureOrder: ['attr-device-model', 'attr-capacity', 'attr-color'] }, { id: 'template-accessory-test', name: '独立测试配件方案', parentId: null, enabled: true, structureOrder: ['attr-color'] }]
  data.templateParams = [
    ...['attr-device-model', 'attr-capacity', 'attr-color', 'attr-port'].map(paramId => ({ templateId: 'template-device-test', paramId, role: 'variant' as const, required: false })),
    { templateId: 'template-device-test', paramId: 'attr-brand', role: 'common', required: false },
    { templateId: 'template-accessory-test', paramId: 'attr-brand', role: 'common', required: false },
    { templateId: 'template-accessory-test', paramId: 'attr-color', role: 'variant', required: false },
  ]
  data.mappings = [{ templateId: 'template-device-test', categoryId: 'cat-device-test' }, { templateId: 'template-accessory-test', categoryId: 'cat-accessory-test' }]
  data.specCanvases = []; data.specModelVersions = []; data.productSpecNodes = []; data.planningRecords = []; data.productPlans = []; data.materialReceipts = []; data.rules = []
  const family = (id: string, type: string): ProductFamily => ({ id, name: `【独立测试】${id}`, templateId: type === 'type-device' ? 'template-device-test' : 'template-accessory-test', productTypeId: type, categoryId: type === 'type-device' ? 'cat-device-test' : 'cat-accessory-test', oaProductId: '', commonAttrs: { 品牌: type === 'type-device' ? 'DeviceLab' : 'CaseWorks' }, productGroupIds: [], lifecycle: 'ready', shelfStatus: 'online', line: 'v2', origin: 'created', createdAt: CATALOG_TEST_TIME, updatedAt: CATALOG_TEST_TIME })
  data.families = [family('family-device', 'type-device'), family('family-unbound', 'type-device'), family('family-case', 'type-case'), family('family-film', 'type-film'), family('family-charger', 'type-charger'), family('family-cable', 'type-cable')]
  const sku = (id: string, familyId: string, attrs: Record<string, string> = {}): Sku => ({ id, familyId, code: id.toUpperCase(), skuName: `【独立测试】${id}`, oaSkuId: '', recordKind: 'sku', status: 'on_sale', variantAttrs: attrs, projectedAttrs: {}, createdAt: CATALOG_TEST_TIME, updatedAt: CATALOG_TEST_TIME, creationSource: { kind: 'manual', templateId: familyId.startsWith('family-device') || familyId === 'family-unbound' ? 'template-device-test' : 'template-accessory-test', modelVersionId: '', createdAt: CATALOG_TEST_TIME } })
  data.skus = [sku('phone-a', 'family-device', { 测试设备型号: 'Orion A', 颜色: '黑色', 容量: '128G', 接口: 'USB-C' }), sku('phone-b', 'family-device', { 测试设备型号: 'Orion B', 颜色: '白色', 容量: '256G' }), sku('phone-unbound', 'family-unbound', { 颜色: '黑色' }), sku('case-sku', 'family-case', { 颜色: '白色' }), sku('film-sku', 'family-film'), sku('charger-sku', 'family-charger'), sku('cable-sku', 'family-cable'), sku('copy-sku', 'family-film'), sku('pending-sku', 'family-film'), sku('blocked-sku', 'family-film'), { ...sku('off-sale-sku', 'family-case'), status: 'off_sale' }, ...['mat-copy', 'mat-only'].map(id => ({ ...sku(id, 'family-film'), recordKind: 'material' as const, materialCode: id.toUpperCase(), planningId: 'PLN-MATERIAL', creationSource: undefined }))]
  return { data, ids }
}
