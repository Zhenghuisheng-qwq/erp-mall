import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createAccessoryCompatibilityFixture, ACCESSORY_TEST_TIME as now } from './accessory-compatibility-fixtures'
import { compatibilityTarget, declarationDefaults, queryAccessoryDevices, queryDeviceAccessories } from '../src/domain/accessoryCompatibilityQuery'
import { createDeviceResolutionContext, deviceHostKey, deviceSourceStamp, listDeviceModels, resolveDeviceSku } from '../src/domain/deviceResolution'
import { legalPlanningCombinations } from '../src/domain/planning'
import type { CompatibilityHost, CompatibilityLink, ProductSpecNode, Sku } from '../src/domain/types'

const output = resolve(process.env.ACCESSORY_OUTPUT_DIR || 'work/accessory-compatibility')
mkdirSync(output, { recursive: true })
const checks: { name: string; result: string }[] = []
function check(name: string, run: () => void) { run(); checks.push({ name, result: 'PASS' }); console.log(`PASS accessory query ${name}`) }
const ids = (items: { target: { id: string } }[]) => items.map(item => item.target.id).sort()
function saleDeclaration(id: string, targetId: string, host: CompatibilityHost, extra: Partial<CompatibilityLink> = {}): CompatibilityLink {
  return { id, accessorySkuId: targetId, targetId, targetKind: 'sku', host: structuredClone(host), conclusion: 'compatible', verification: 'confirmed', capability: 'basic', conditions: [], source: '独立领域测试依据', note: '', createdAt: now, updatedAt: now, ...extra }
}
function modelFixture() {
  const fixture = createAccessoryCompatibilityFixture(), { data } = fixture
  const modelId = 'model-query-fixture', versionId = 'version-query-fixture-v1'
  data.templates.push({ id: modelId, name: '独立历史模型测试', enabled: true, parentId: null, structureOrder: [] })
  data.specCanvases.push({ templateId: modelId, productTypeId: 'type-device', name: '独立历史模型测试', zoom: 1, panX: 0, panY: 0, status: 'published', version: 1, versionName: 'V1' })
  const nodes: ProductSpecNode[] = []
  const attribute = (id: string, paramId: string, parentId: string | null, role: 'COMMON' | 'VARIANT'): string => { nodes.push({ id, templateId: modelId, parentId, nodeType: 'ATTRIBUTE', attributeId: paramId, valueId: '', sort: nodes.length, role }); return id }
  const value = (id: string, valueId: string, parentId: string): string => { const parent = nodes.find(node => node.id === parentId); assert.ok(parent); nodes.push({ id, templateId: modelId, parentId, nodeType: 'VALUE', attributeId: parent.attributeId, valueId, sort: nodes.length }); return id }
  const brand = value('brand-value', 'DeviceLab', attribute('brand-attribute', 'attr-brand', null, 'COMMON'))
  const modelAttribute = attribute('model-attribute', 'attr-device-model', brand, 'VARIANT')
  for (const [key, name] of [['pro', 'Orion Pro'], ['max', 'Orion Pro Max']]) {
    const model = value(`${key}-value`, name || '', modelAttribute)
    const capacity = attribute(`${key}-capacity`, 'attr-capacity', model, 'VARIANT')
    value(`${key}-128`, '128G', capacity); value(`${key}-256`, '256G', capacity)
    const color = attribute(`${key}-color`, 'attr-color', model, 'VARIANT')
    value(`${key}-black`, '黑色', color); value(`${key}-white`, '白色', color)
  }
  data.specModelVersions.push({ id: versionId, templateId: modelId, version: 1, versionName: 'V1', status: 'published', nodesSnapshot: nodes, createdTime: now, publishTime: now })
  const family = structuredClone(data.families[0]); assert.ok(family)
  Object.assign(family, { id: 'family-modeled', templateId: modelId, productModelId: modelId, modelVersionId: versionId, commonAttrs: { 品牌: 'DeviceLab' } })
  data.families.push(family)
  const combinations = legalPlanningCombinations(data, modelId, nodes)
  data.planningRecords.push(...combinations.map((combo, index) => ({ planningId: `PLN-HOST-${index + 1}`, productModelId: modelId, originModelVersionId: versionId, modelVersionId: versionId, modelVersionIds: [versionId], steps: combo.steps, identityKey: combo.identityKey, status: 'active' as const, createdTime: now })))
  const make = (id: string, index: number, kind: 'manual' | 'model' | 'plan' = 'model'): Sku => {
    const combo = combinations[index]; assert.ok(combo)
    return { id, familyId: family.id, recordKind: 'sku', code: id.toUpperCase(), skuName: `【独立测试】${id}`, oaSkuId: '', status: 'on_sale', projectedAttrs: {}, variantAttrs: Object.fromEntries(combo.steps.filter(step => step.role === 'variant').map(step => [step.attributeName, step.valueId])), modelVersionId: versionId, sourceNodeIds: combo.steps.map(step => step.valueNodeId), creationSource: { kind, templateId: modelId, modelVersionId: versionId, ...(kind === 'plan' ? { productPlanId: 'product-plan-query' } : {}), createdAt: now }, createdAt: now, updatedAt: now }
  }
  data.productPlans.push({ id: 'product-plan-query', productModelId: modelId, productTypeId: 'type-device', modelVersionId: versionId, name: '独立产品规划', status: 'saved', selectedNodes: ['brand-value', 'pro-value'], createdTime: now })
  data.skus.push(make('model-phone', 0), make('model-phone-other-spec', 3), make('max-phone', 4), make('plan-phone', 0, 'plan'))
  const resolution = resolveDeviceSku(data, 'model-phone'); assert.equal(resolution.status, 'resolved'); assert.ok(resolution.host)
  return { ...fixture, modelId, versionId, nodes, combinations, host: resolution.host, make }
}

check('one device, many types; direct sales and MAT stay independent; confirmed/pending/excluded/off-sale separated', () => {
  const { data } = createAccessoryCompatibilityFixture(), result = queryDeviceAccessories(data, 'phone-a')
  assert.deepEqual(ids(result.sales), ['cable-sku', 'case-sku', 'charger-sku', 'film-sku'])
  assert.deepEqual(ids(result.materials), ['mat-copy', 'mat-only'])
  assert.deepEqual(ids(result.pending), ['pending-sku']); assert.deepEqual(ids(result.excluded), ['blocked-sku']); assert.deepEqual(ids(result.unavailable), ['off-sale-sku'])
  assert.equal(result.counts.sales, 4); assert.equal(result.counts.materials, 2)
  assert.equal(result.excluded[0]?.conflict, true)
  assert.equal(result.unavailable[0]?.status, 'compatible')
  assert.equal(result.materials.some(item => item.target.kind === 'sku'), false)
  assert.equal(result.sales.some(item => item.target.id === 'copy-sku'), false, 'Same SPU or PLN cannot create a sales/MAT mapping')
  assert.equal(new Set(result.sales.map(item => item.productTypeId)).size, 4)
  assert.equal(result.sales.find(item => item.target.id === 'case-sku')?.spec, '品牌 CaseWorks · 颜色 白色')
  assert.equal(result.sales.find(item => item.target.id === 'charger-sku')?.spec, '品牌 CaseWorks')
  const appleFixture = createAccessoryCompatibilityFixture()
  const phoneFamily = appleFixture.data.families.find(item => item.id === 'family-device'); assert.ok(phoneFamily)
  phoneFamily.commonAttrs['品牌'] = 'Apple'
  for (const binding of appleFixture.data.deviceBindings || []) binding.sourceStamp = deviceSourceStamp(appleFixture.data, binding.skuId)
  const thirdParty = queryDeviceAccessories(appleFixture.data, 'phone-a').sales.find(item => item.target.id === 'case-sku')
  assert.ok(thirdParty, 'An explicitly declared third-party accessory remains compatible with an Apple-branded device')
  assert.equal(thirdParty.spec, '品牌 CaseWorks · 颜色 白色')
})
check('one accessory many models; real object and model counts distinct from relation counts', () => {
  const { data } = createAccessoryCompatibilityFixture(), result = queryAccessoryDevices(data, { kind: 'sku', id: 'case-sku' })
  assert.equal(result.counts.models, 2); assert.equal(result.counts.declarations, 2); assert.equal(result.counts.devices, 2)
  assert.deepEqual(result.hosts.flatMap(host => host.devices.map(device => device.skuId)).sort(), ['phone-a', 'phone-b'])
})
check('missing model and brand-only/name-only records never guess; manual/template explicit bindings and changed source detected', () => {
  const { data, hosts } = createAccessoryCompatibilityFixture()
  const unresolved = resolveDeviceSku(data, 'phone-unbound'); assert.equal(unresolved.status, 'unconfigured')
  const phone = data.skus.find(sku => sku.id === 'phone-unbound'); assert.ok(phone)
  phone.skuName = 'Apple iPhone Orion A 65W PD compatible'
  assert.equal(resolveDeviceSku(data, phone.id).status, 'unconfigured')
  data.deviceBindings?.push({ skuId: phone.id, host: hosts.a, sourceStamp: deviceSourceStamp(data, phone.id), createdAt: now, updatedAt: now })
  assert.equal(resolveDeviceSku(data, phone.id).status, 'resolved')
  phone.variantAttrs['测试设备型号'] = 'Different identity'
  assert.equal(resolveDeviceSku(data, phone.id).status, 'invalid')
  assert.equal(queryDeviceAccessories(data, phone.id).sales.length, 0)
})
check('template identity uses stable bound param IDs, not brand or names; common/variant conflicts are invalid', () => {
  const { data } = createAccessoryCompatibilityFixture()
  data.deviceBindings = []
  const phone = data.skus.find(sku => sku.id === 'phone-a'); assert.ok(phone)
  phone.creationSource = { kind: 'template', templateId: 'template-device-test', modelVersionId: '', createdAt: now }
  assert.equal(resolveDeviceSku(data, phone.id).host?.productModelId, 'template:template-device-test')
  const family = data.families.find(item => item.id === phone.familyId); assert.ok(family)
  family.commonAttrs['测试设备型号'] = 'Contradiction'
  assert.equal(resolveDeviceSku(data, phone.id).status, 'invalid')
})
check('historical cross-product-type bindings and duplicate explicit bindings stay invalid', () => {
  const { data } = createAccessoryCompatibilityFixture()
  const phoneType = data.productTypes.find(type => type.id === 'type-device'); assert.ok(phoneType)
  data.productTypes.push({ ...phoneType, id: 'type-tablet-test', name: '独立测试平板' })
  const model = data.deviceModels?.find(item => item.id === 'model-a'), binding = data.deviceBindings?.find(item => item.skuId === 'phone-a'); assert.ok(model && binding)
  model.productTypeId = 'type-tablet-test'; binding.host.productTypeId = 'type-tablet-test'
  assert.equal(resolveDeviceSku(data, 'phone-a').status, 'invalid')
  assert.equal(queryDeviceAccessories(data, 'phone-a').sales.length, 0)
  model.productTypeId = 'type-device'; binding.host.productTypeId = 'type-device'
  data.deviceBindings?.push(structuredClone(binding))
  assert.equal(resolveDeviceSku(data, 'phone-a').status, 'invalid')
})
check('model/plan/historical SKU use pinned snapshot and actual generation source; plan SKU need not have sku.planningId', () => {
  const { data, make, host, modelId, nodes } = modelFixture()
  const planned = resolveDeviceSku(data, 'plan-phone')
  assert.equal(data.skus.find(sku => sku.id === 'plan-phone')?.planningId, undefined)
  assert.equal(planned.status, 'resolved'); assert.equal(planned.planningId, 'PLN-HOST-1')
  const historical = make('historical-phone', 0); delete historical.creationSource; delete historical.sourceNodeIds
  data.skus.push(historical)
  assert.equal(deviceHostKey(resolveDeviceSku(data, historical.id).host || host), deviceHostKey(host))
  data.specModelVersions.push({ id: 'version-query-v2', templateId: modelId, version: 2, versionName: 'V2', status: 'published', nodesSnapshot: nodes.map(node => node.id === 'pro-value' ? { ...node, valueId: 'New Name' } : { ...node }), createdTime: now, publishTime: now })
  assert.equal(resolveDeviceSku(data, 'model-phone').host?.identityKey, host.identityKey)
  data.specModelVersions = data.specModelVersions.filter(version => version.id !== 'version-query-fixture-v1')
  assert.equal(resolveDeviceSku(data, 'model-phone').status, 'invalid')
})
check('one read context reuses a frozen version expansion across multiple device resolutions and releases with caller', () => {
  const { data } = modelFixture(), context = createDeviceResolutionContext(data)
  resolveDeviceSku(data, 'model-phone', context); resolveDeviceSku(data, 'model-phone-other-spec', context); resolveDeviceSku(data, 'plan-phone', context)
  assert.equal(context.combinations.size, 1)
  const fresh = createDeviceResolutionContext(data)
  assert.notEqual(fresh, context); assert.equal(fresh.combinations.size, 0)
})
check('later ProductPlan node/version edits do not rewrite historical SKU device identity or exact PLN', () => {
  const { data, host } = modelFixture(), plan = data.productPlans.find(item => item.id === 'product-plan-query'); assert.ok(plan)
  data.compatibilities = [saleDeclaration('historical-plan-rule', 'case-sku', { ...host, scope: 'planning', planningId: 'PLN-HOST-1' })]
  const before = resolveDeviceSku(data, 'plan-phone'), shown = ids(queryDeviceAccessories(data, 'plan-phone').sales)
  assert.equal(before.planningId, 'PLN-HOST-1')
  plan.selectedNodes = ['brand-value', 'max-value']; plan.modelVersionId = 'later-current-plan-version'; plan.productModelId = 'later-current-plan-model'
  const after = resolveDeviceSku(data, 'plan-phone')
  assert.equal(after.status, 'resolved'); assert.deepEqual(after.host, before.host); assert.equal(after.planningId, before.planningId)
  assert.deepEqual(ids(queryDeviceAccessories(data, 'plan-phone').sales), shown)
  const phone = data.skus.find(item => item.id === 'plan-phone'); assert.ok(phone); phone.sourceNodeIds = undefined
  assert.equal(resolveDeviceSku(data, 'plan-phone').planningId, 'PLN-HOST-1', 'Complete persisted variant attributes still resolve against SKU historical version, not mutable plan')
  data.productPlans = []
  assert.equal(resolveDeviceSku(data, 'plan-phone').status, 'invalid', 'A deleted provenance reference is explicitly reported, never replaced by a latest plan')
})
check('same model colors/capacities share model declarations; Pro/Pro Max and other PLN remain isolated', () => {
  const { data, host } = modelFixture()
  data.compatibilities = [saleDeclaration('same-model', 'case-sku', host), saleDeclaration('precise', 'film-sku', { ...host, scope: 'planning', planningId: 'PLN-HOST-1' }), saleDeclaration('other-spec', 'cable-sku', { ...host, scope: 'planning', planningId: 'PLN-HOST-4' })]
  assert.deepEqual(ids(queryDeviceAccessories(data, 'model-phone').sales), ['case-sku', 'film-sku'])
  assert.deepEqual(ids(queryDeviceAccessories(data, 'model-phone-other-spec').sales), ['cable-sku', 'case-sku'])
  assert.deepEqual(ids(queryDeviceAccessories(data, 'max-phone').sales), [])
  const reverse = queryAccessoryDevices(data, { kind: 'sku', id: 'film-sku' })
  assert.equal(reverse.hosts[0]?.status, 'pending'); assert.match(reverse.hosts[0]?.scopeSummary || '', /限定/)
  assert.deepEqual(reverse.hosts[0]?.devices.map(device => device.skuId).sort(), ['model-phone', 'plan-phone'])
})
check('same-named models in distinct model namespaces do not merge; ambiguous snapshot not silently first', () => {
  const { data, make, modelId, nodes, host } = modelFixture()
  data.templates.push({ id: 'other-model', name: 'same name', enabled: true, parentId: null, structureOrder: [] })
  data.specCanvases.push({ templateId: 'other-model', productTypeId: 'type-device', zoom: 1, panX: 0, panY: 0, status: 'published', version: 1, versionName: 'V1' })
  data.specModelVersions.push({ id: 'other-version', templateId: 'other-model', version: 1, versionName: 'V1', status: 'published', nodesSnapshot: nodes.map(node => ({ ...node, templateId: 'other-model' })), createdTime: now, publishTime: now })
  const sameName = listDeviceModels(data).filter(option => option.host.identityKey === host.identityKey)
  assert.equal(sameName.length, 2); assert.notEqual(sameName[0]?.key, sameName[1]?.key)
  const ambiguous = make('ambiguous-phone', 0); ambiguous.variantAttrs = {}; ambiguous.sourceNodeIds = undefined
  data.skus.push(ambiguous)
  assert.equal(resolveDeviceSku(data, ambiguous.id).status, 'ambiguous')
  assert.equal(resolveDeviceSku(data, ambiguous.id).candidates.every(option => option.host.productModelId === modelId), true)
})
check('confirmed explicit deny wins across model/PLN scope; pending deny never becomes confirmed recommendation', () => {
  const { data, host } = modelFixture()
  data.compatibilities = [saleDeclaration('model-deny', 'case-sku', host, { conclusion: 'incompatible' }), saleDeclaration('precise-allow', 'case-sku', { ...host, scope: 'planning', planningId: 'PLN-HOST-1' })]
  const match = queryDeviceAccessories(data, 'model-phone').excluded[0]
  assert.equal(match?.target.id, 'case-sku'); assert.equal(match?.conflict, true); assert.equal(match?.declarations.length, 2)
  data.compatibilities = [saleDeclaration('pending-allow', 'case-sku', host, { verification: 'pending' })]
  assert.equal(queryDeviceAccessories(data, 'model-phone').pending[0]?.target.id, 'case-sku')
})
check('conditional exclusions respect actual attributes: met denies, unmet does not, unknown remains pending', () => {
  const { data, hosts } = createAccessoryCompatibilityFixture()
  const capacityCondition = { kind: 'attribute' as const, attributeId: 'attr-capacity', operator: 'eq' as const, value: '256G' }
  data.compatibilities = [saleDeclaration('allow', 'case-sku', hosts.a), saleDeclaration('deny-256', 'case-sku', hosts.a, { conclusion: 'incompatible', conditions: [capacityCondition] })]
  assert.equal(queryDeviceAccessories(data, 'phone-a').sales[0]?.status, 'compatible')
  const phone = data.skus.find(sku => sku.id === 'phone-a'); assert.ok(phone)
  phone.variantAttrs['容量'] = '256G'
  assert.equal(queryDeviceAccessories(data, phone.id).excluded[0]?.status, 'incompatible')
  delete phone.variantAttrs['容量']
  assert.equal(queryDeviceAccessories(data, phone.id).pending[0]?.status, 'pending')
})
check('conditions use actual attributes; unknown equipment/protocol/power never count as satisfied; basic/fast-charge independent', () => {
  const { data, hosts } = createAccessoryCompatibilityFixture(), result = queryDeviceAccessories(data, 'phone-a')
  const charger = result.sales.find(match => match.target.id === 'charger-sku'); assert.ok(charger)
  assert.equal(charger.capabilities.find(item => item.capability === 'basic')?.status, 'compatible')
  assert.equal(charger.capabilities.find(item => item.capability === 'fast-charge')?.status, 'conditional')
  assert.equal(charger.conditions.every(condition => condition.state === 'unknown'), true)
  data.compatibilities = [saleDeclaration('attr-met', 'case-sku', hosts.a, { conditions: [{ kind: 'attribute', attributeId: 'attr-port', operator: 'eq', value: 'USB-C' }] }), saleDeclaration('attr-unknown', 'film-sku', hosts.a, { conditions: [{ kind: 'attribute', attributeId: 'attr-capacity', operator: 'gte', value: '512' }] }), saleDeclaration('attr-unmet', 'cable-sku', hosts.a, { conditions: [{ kind: 'attribute', attributeId: 'attr-port', operator: 'eq', value: 'Lightning' }] }), saleDeclaration('fast-only', 'charger-sku', hosts.a, { capability: 'fast-charge' })]
  const actual = queryDeviceAccessories(data, 'phone-a')
  assert.equal(actual.sales.find(match => match.target.id === 'case-sku')?.conditions[0]?.state, 'met')
  assert.equal(actual.sales.find(match => match.target.id === 'film-sku')?.status, 'conditional', '128G is not silently parsed into a numeric power/capacity')
  assert.equal(actual.sales.find(match => match.target.id === 'charger-sku')?.status, 'conditional')
  assert.equal(actual.excluded.find(match => match.target.id === 'cable-sku')?.conditions[0]?.state, 'unmet')
  assert.equal(queryAccessoryDevices(data, { kind: 'sku', id: 'charger-sku' }).hosts[0]?.devices[0]?.status, 'conditional')
})
check('reverse PLN-specific opposite results are not collapsed into unconditional model fact', () => {
  const { data, host } = modelFixture()
  data.compatibilities = [saleDeclaration('plan-allow', 'case-sku', { ...host, scope: 'planning', planningId: 'PLN-HOST-1' }), saleDeclaration('plan-deny', 'case-sku', { ...host, scope: 'planning', planningId: 'PLN-HOST-4' }, { conclusion: 'incompatible' })]
  const result = queryAccessoryDevices(data, { kind: 'sku', id: 'case-sku' })
  assert.equal(result.counts.models, 1); assert.equal(result.counts.declarations, 2)
  assert.equal(result.hosts[0]?.status, 'pending')
  assert.equal(result.hosts[0]?.devices.find(item => item.skuId === 'model-phone')?.status, 'compatible')
  assert.equal(result.hosts[0]?.devices.find(item => item.skuId === 'model-phone-other-spec')?.status, 'incompatible')
})
check('no-basic multiple specific abilities aggregate conservatively and never depend on declaration array order', () => {
  const cases: { fast: CompatibilityLink['conclusion']; other: CompatibilityLink['conclusion']; pending?: boolean; expected: 'pending' | 'conditional' | 'incompatible' }[] = [
    { fast: 'incompatible', other: 'compatible', expected: 'pending' },
    { fast: 'compatible', other: 'compatible', expected: 'conditional' },
    { fast: 'incompatible', other: 'incompatible', expected: 'incompatible' },
    { fast: 'compatible', other: 'compatible', pending: true, expected: 'pending' },
  ]
  for (const item of cases) {
    const { data, hosts } = createAccessoryCompatibilityFixture()
    data.compatibilities = [saleDeclaration('specific-fast', 'charger-sku', hosts.a, { capability: 'fast-charge', conclusion: item.fast, verification: item.pending ? 'pending' : 'confirmed' }), saleDeclaration('specific-other', 'charger-sku', hosts.a, { capability: 'other', conclusion: item.other })]
    const snapshot = () => {
      const forward = queryDeviceAccessories(data, 'phone-a'), reverse = queryAccessoryDevices(data, { kind: 'sku', id: 'charger-sku' })
      const matches = [...forward.sales, ...forward.pending, ...forward.excluded], match = matches[0]
      assert.equal(match?.status, item.expected); assert.match(match?.reasons.join('；') || '', /基本使用能力尚未单独维护/)
      assert.equal(forward.sales.length, item.expected === 'conditional' ? 1 : 0)
      assert.equal(reverse.hosts[0]?.devices.find(device => device.skuId === 'phone-a')?.status, item.expected)
      assert.equal(reverse.hosts[0]?.status, item.expected); assert.match(reverse.hosts[0]?.scopeSummary || '', /基本使用能力尚未单独维护/)
      return { forward: { sales: ids(forward.sales), pending: ids(forward.pending), excluded: ids(forward.excluded), status: match?.status, recommendable: match?.recommendable, abilities: match?.capabilities.map(capability => [capability.capability, capability.status]) }, reverse: reverse.hosts.map(host => ({ status: host.status, devices: host.devices, abilities: host.capabilities.map(capability => [capability.capability, capability.status]), scope: host.scopeSummary })) }
    }
    const before = snapshot(); data.compatibilities.reverse(); assert.deepEqual(snapshot(), before)
  }
})
check('unique confirmed model works without PLN; standalone candidates require no MAT/SKU/active planning', () => {
  const { data } = createAccessoryCompatibilityFixture()
  assert.equal(resolveDeviceSku(data, 'phone-a').planningId, undefined)
  assert.equal(queryDeviceAccessories(data, 'phone-a').sales.length, 4)
  data.skus = []; data.planningRecords = []
  const independent = listDeviceModels(data)
  assert.equal(independent.length, 2); assert.equal(independent.every(option => option.planningIds.length === 0), true)
})
check('legacy MAT defaults retain identity and history; invalid target/type/condition/source stay issues, not recommendations', () => {
  const { data } = createAccessoryCompatibilityFixture()
  const legacy = data.compatibilities.find(link => link.id === 'decl-mat-only-a'); assert.ok(legacy)
  assert.deepEqual(compatibilityTarget(legacy), { kind: 'material', id: 'mat-only' })
  assert.equal(declarationDefaults(legacy).verification, 'confirmed'); assert.match(declarationDefaults(legacy).source, /未记录/)
  const original = structuredClone(data.compatibilities)
  data.skus = data.skus.filter(sku => sku.id !== 'case-sku')
  const invalidCondition = data.compatibilities.find(link => link.id === 'decl-film-a'); assert.ok(invalidCondition)
  invalidCondition.conditions = [{ kind: 'attribute', attributeId: 'removed-param', operator: 'eq', value: 'x' }]
  const result = queryDeviceAccessories(data, 'phone-a')
  assert.equal(result.sales.some(match => match.target.id === 'case-sku' || match.target.id === 'film-sku'), false)
  assert.equal(result.issues.length, 2)
  assert.equal(data.compatibilities.length, original.length, 'Read-only queries preserve invalid declarations for repair')
})
check('loaded target aliases that disagree or omit target kind are preserved as issues, never reinterpreted as another valid object', () => {
  const { data, hosts } = createAccessoryCompatibilityFixture()
  const legacy = data.compatibilities.find(link => link.id === 'decl-mat-copy-a'); assert.ok(legacy)
  data.compatibilities = [saleDeclaration('bad-alias-target', 'case-sku', hosts.a, { targetId: 'film-sku' }), { ...structuredClone(legacy), id: 'bad-missing-kind', targetId: 'mat-only' }]
  const before = structuredClone(data.compatibilities), result = queryDeviceAccessories(data, 'phone-a')
  assert.equal(result.sales.length, 0); assert.equal(result.materials.length, 0)
  assert.deepEqual(result.issues.map(issue => issue.declarationId).sort(), ['bad-alias-target', 'bad-missing-kind'])
  assert.match(result.issues.find(issue => issue.declarationId === 'bad-alias-target')?.message || '', /身份矛盾/)
  assert.match(result.issues.find(issue => issue.declarationId === 'bad-missing-kind')?.message || '', /类型缺失/)
  assert.equal(queryAccessoryDevices(data, { kind: 'sku', id: 'film-sku' }).issues[0]?.declarationId, 'bad-alias-target')
  assert.equal(queryAccessoryDevices(data, { kind: 'material', id: 'mat-only' }).issues[0]?.declarationId, 'bad-missing-kind')
  assert.deepEqual(data.compatibilities, before, 'Bad loaded records remain available for explicit repair')
})
check('query and reverse are fully read-only; no node rule becomes a formal statement; search/type filters count actual objects', () => {
  const { data, hosts } = createAccessoryCompatibilityFixture()
  data.nodeCompatibilityRules.push({ id: 'node-rule-only', templateId: 'template-accessory-test', nodeId: 'node-test', modelVersionId: '', hosts: [hosts.b], updatedAt: now })
  const before = structuredClone(data)
  queryDeviceAccessories(data, 'phone-a'); queryAccessoryDevices(data, { kind: 'material', id: 'mat-copy' }); listDeviceModels(data); resolveDeviceSku(data, 'phone-a')
  assert.deepEqual(data, before)
  assert.equal(queryDeviceAccessories(data, 'phone-b').sales.some(match => match.target.id === 'copy-sku'), false)
  const filtered = queryDeviceAccessories(data, 'phone-a', { productTypeId: 'type-case', keyword: 'case-sku' })
  assert.deepEqual(ids(filtered.sales), ['case-sku']); assert.equal(filtered.counts.sales, 1)
})

writeFileSync(resolve(output, 'query-result.json'), JSON.stringify({ result: 'PASS', fixedTime: now, checks, total: checks.length }, null, 2))
console.log(`PASS ${checks.length} accessory compatibility query groups`)
