import { createSeed } from '../src/domain/seed'
import { deviceSourceStamp } from '../src/domain/deviceResolution'
import type { AppData, CompatibilityHost, CompatibilityLink, ProductFamily, Sku } from '../src/domain/types'
import type { DeviceModel } from '../src/domain/accessoryCompatibilityTypes'

export const ACCESSORY_TEST_TIME = '2026-10-23T04:00:00.000Z'
export function createAccessoryCompatibilityFixture() {
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
  data.specCanvases = []; data.specModelVersions = []; data.productSpecNodes = []; data.planningRecords = []; data.productPlans = []; data.materialReceipts = []; data.compatibilities = []; data.nodeCompatibilityRules = []; data.rules = []
  const family = (id: string, type: string): ProductFamily => ({ id, name: `【独立测试】${id}`, templateId: type === 'type-device' ? 'template-device-test' : 'template-accessory-test', productTypeId: type, categoryId: type === 'type-device' ? 'cat-device-test' : 'cat-accessory-test', oaProductId: '', commonAttrs: { 品牌: type === 'type-device' ? 'DeviceLab' : 'CaseWorks' }, productGroupIds: [], lifecycle: 'ready', shelfStatus: 'online', line: 'v2', origin: 'created', createdAt: ACCESSORY_TEST_TIME, updatedAt: ACCESSORY_TEST_TIME })
  data.families = [family('family-device', 'type-device'), family('family-unbound', 'type-device'), family('family-case', 'type-case'), family('family-film', 'type-film'), family('family-charger', 'type-charger'), family('family-cable', 'type-cable')]
  const sku = (id: string, familyId: string, attrs: Record<string, string> = {}): Sku => ({ id, familyId, code: id.toUpperCase(), skuName: `【独立测试】${id}`, oaSkuId: '', recordKind: 'sku', status: 'on_sale', variantAttrs: attrs, projectedAttrs: {}, createdAt: ACCESSORY_TEST_TIME, updatedAt: ACCESSORY_TEST_TIME, creationSource: { kind: 'manual', templateId: familyId.startsWith('family-device') || familyId === 'family-unbound' ? 'template-device-test' : 'template-accessory-test', modelVersionId: '', createdAt: ACCESSORY_TEST_TIME } })
  data.skus = [sku('phone-a', 'family-device', { 测试设备型号: 'Orion A', 颜色: '黑色', 容量: '128G', 接口: 'USB-C' }), sku('phone-b', 'family-device', { 测试设备型号: 'Orion B', 颜色: '白色', 容量: '256G' }), sku('phone-unbound', 'family-unbound', { 颜色: '黑色' }), sku('case-sku', 'family-case', { 颜色: '白色' }), sku('film-sku', 'family-film'), sku('charger-sku', 'family-charger'), sku('cable-sku', 'family-cable'), sku('copy-sku', 'family-film'), sku('pending-sku', 'family-film'), sku('blocked-sku', 'family-film'), { ...sku('off-sale-sku', 'family-case'), status: 'off_sale' }, ...['mat-copy', 'mat-only'].map(id => ({ ...sku(id, 'family-film'), recordKind: 'material' as const, materialCode: id.toUpperCase(), planningId: 'PLN-MATERIAL', creationSource: undefined }))]
  data.deviceModels = ['a', 'b'].map((key): DeviceModel => ({ id: `model-${key}`, name: `【独立测试】Orion ${key.toUpperCase()}`, productTypeId: 'type-device', attributes: key === 'a' ? { 'attr-port': 'USB-C' } : {}, createdAt: ACCESSORY_TEST_TIME, updatedAt: ACCESSORY_TEST_TIME }))
  const host = (key: string): CompatibilityHost => ({ scope: 'model', productTypeId: 'type-device', productModelId: `device:model-${key}`, identityKey: `device:model-${key}`, steps: [{ attributeId: 'device-model', attributeName: '设备型号', valueId: `【独立测试】Orion ${key.toUpperCase()}` }] })
  const hosts = { a: host('a'), b: host('b') }
  data.deviceBindings = [{ skuId: 'phone-a', host: hosts.a, sourceStamp: deviceSourceStamp(data, 'phone-a'), createdAt: ACCESSORY_TEST_TIME, updatedAt: ACCESSORY_TEST_TIME }, { skuId: 'phone-b', host: hosts.b, sourceStamp: deviceSourceStamp(data, 'phone-b'), createdAt: ACCESSORY_TEST_TIME, updatedAt: ACCESSORY_TEST_TIME }]
  const declaration = (id: string, targetId: string, targetHost = hosts.a, extra: Partial<CompatibilityLink> = {}): CompatibilityLink => ({ id, accessorySkuId: targetId, targetKind: 'sku', targetId, host: structuredClone(targetHost), conclusion: 'compatible', verification: 'confirmed', capability: 'basic', conditions: [], source: '独立测试人工确认依据', provenance: { kind: 'manual', detail: '独立测试，不是真实核验资料' }, note: '', createdAt: ACCESSORY_TEST_TIME, updatedAt: ACCESSORY_TEST_TIME, ...extra })
  data.compatibilities = [declaration('decl-case-a', 'case-sku'), declaration('decl-case-b', 'case-sku', hosts.b), declaration('decl-film-a', 'film-sku'), declaration('decl-charger-basic', 'charger-sku'), declaration('decl-charger-fast', 'charger-sku', hosts.a, { capability: 'fast-charge', conclusion: 'conditional', conditions: [{ kind: 'capability', text: '设备协议和功率仍需确认', protocol: '测试协议', powerWatts: 20 }, { kind: 'equipment', text: '经确认支持该协议的测试线缆' }] }), declaration('decl-cable-a', 'cable-sku', hosts.a, { conclusion: 'conditional', conditions: [{ kind: 'equipment', text: '指定测试转换器' }] }), declaration('decl-pending-a', 'pending-sku', hosts.a, { verification: 'pending' }), declaration('decl-blocked-allow', 'blocked-sku'), declaration('decl-blocked-deny', 'blocked-sku', hosts.a, { conclusion: 'incompatible', source: '独立测试明确排除依据' }), declaration('decl-off-sale-a', 'off-sale-sku'), { id: 'decl-mat-copy-a', accessorySkuId: 'mat-copy', host: structuredClone(hosts.a), note: '历史物料关系测试', createdAt: ACCESSORY_TEST_TIME, updatedAt: ACCESSORY_TEST_TIME }, { id: 'decl-mat-copy-b', accessorySkuId: 'mat-copy', host: structuredClone(hosts.b), note: '同一物料多型号测试', createdAt: ACCESSORY_TEST_TIME, updatedAt: ACCESSORY_TEST_TIME }, { id: 'decl-mat-only-a', accessorySkuId: 'mat-only', host: structuredClone(hosts.a), note: '仅MAT关系，不自动映射销售SKU', createdAt: ACCESSORY_TEST_TIME, updatedAt: ACCESSORY_TEST_TIME }]
  return { data, ids, hosts }
}
