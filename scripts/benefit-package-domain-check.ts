import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createBenefitPackageFixture, BENEFIT_TEST_TIME as now } from './benefit-package-fixtures'
import { addBenefitSku, benefitCompositionBasis, benefitPackageImportProblems, benefitPackageReferenceProblem, benefitSkuCandidates, cloneBenefit, confirmBenefitCondition, copyBenefitPackageDraft, createBenefitDeliverySnapshot, formatBenefitAmount, multiplyBenefitQuantity, newBenefitPackageDraft, parseBenefitAmount, previewBenefitDelivery, replaceBenefitSku, reviewBenefitQuote, setBenefitDevice, setBenefitIncludedPhone, validateBenefitPackage, validBenefitCents } from '../src/domain/benefitPackages'
import type { BenefitPackageDraft, BenefitServiceLine } from '../src/domain/benefitPackageTypes'
import { legalPlanningCombinations } from '../src/domain/planning'
import { resolveDeviceSku } from '../src/domain/deviceResolution'
import type { ProductSpecNode } from '../src/domain/types'

const artifacts = process.argv.includes('--artifacts')
const output = resolve(process.env.BENEFIT_DOMAIN_OUTPUT_DIR || 'work/benefit-package/domain')
if (artifacts) mkdirSync(output, { recursive: true })
const checks: { name: string; result: string }[] = []
function check(name: string, run: () => void) { try { run() } catch(error) { console.error(`FAIL ${name}`); throw error }; checks.push({ name, result: 'PASS' }); if (artifacts) console.log(`PASS benefit domain ${name}`) }
const saved = (draft: BenefitPackageDraft): BenefitPackageDraft => ({ ...cloneBenefit(draft), id: 'bp-independent-1', code: 'BPK-000001', revision: 1, status: 'available', createdAt: now, updatedAt: now })
const service = (id: string, measurement: BenefitServiceLine['measurement'] = 'per-package'): BenefitServiceLine => ({ id, name: '【独立测试】会员服务', quantity: 1, unit: '份', measurement, validity: '3 个月会员（按每份约定）', description: '未激活，仅为服务约定' })
function modelFixture() {
  const fixture = createBenefitPackageFixture(), data = fixture.data, modelId = 'benefit-historical-model', versionId = 'benefit-historical-v1'
  data.templates.push({ id: modelId, name: '【独立测试】历史型号模型', enabled: true, parentId: null, structureOrder: ['attr-device-model', 'attr-capacity'] })
  data.specCanvases.push({ templateId: modelId, productTypeId: 'type-device', name: '【独立测试】历史型号模型', zoom: 1, panX: 0, panY: 0, status: 'published', version: 1, versionName: 'V1' })
  const nodes: ProductSpecNode[] = [
    { id: 'model-attr', templateId: modelId, parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'attr-device-model', valueId: '', role: 'VARIANT', sort: 0 },
    { id: 'model-pro', templateId: modelId, parentId: 'model-attr', nodeType: 'VALUE', attributeId: 'attr-device-model', valueId: 'Orion Pro', sort: 1 },
    { id: 'capacity-attr', templateId: modelId, parentId: 'model-pro', nodeType: 'ATTRIBUTE', attributeId: 'attr-capacity', valueId: '', role: 'VARIANT', sort: 2 },
    { id: 'capacity-128', templateId: modelId, parentId: 'capacity-attr', nodeType: 'VALUE', attributeId: 'attr-capacity', valueId: '128G', sort: 3 },
    { id: 'capacity-256', templateId: modelId, parentId: 'capacity-attr', nodeType: 'VALUE', attributeId: 'attr-capacity', valueId: '256G', sort: 4 },
  ]
  data.specModelVersions.push({ id: versionId, templateId: modelId, version: 1, versionName: 'V1', status: 'published', nodesSnapshot: nodes, createdTime: now, publishTime: now })
  const combinations = legalPlanningCombinations(data, modelId, nodes)
  assert.equal(combinations.length, 2)
  data.planningRecords.push(...combinations.map((combo, index) => ({ planningId: `PLN-BENEFIT-${index}`, productModelId: modelId, originModelVersionId: versionId, modelVersionId: versionId, modelVersionIds: [versionId], steps: combo.steps, identityKey: combo.identityKey, status: 'active' as const, createdTime: now })))
  const family = data.families.find(item => item.id === 'family-device'); assert.ok(family)
  data.families.push({ ...cloneBenefit(family), id: 'family-benefit-model', templateId: modelId, productModelId: modelId, modelVersionId: versionId })
  const original = data.skus.find(item => item.id === 'phone-a'); assert.ok(original)
  data.skus.push({ ...cloneBenefit(original), id: 'phone-history-128', code: 'PHONE-HISTORY-128', familyId: 'family-benefit-model', variantAttrs: { 测试设备型号: 'Orion Pro', 容量: '128G' }, modelVersionId: versionId, sourceNodeIds: ['model-pro', 'capacity-128'], creationSource: { kind: 'model', templateId: modelId, modelVersionId: versionId, createdAt: now } })
  const resolution = resolveDeviceSku(data, 'phone-history-128'); assert.equal(resolution.status, 'resolved'); assert.ok(resolution.host); assert.equal(resolution.planningId, 'PLN-BENEFIT-0')
  data.compatibilities.push({ id: 'benefit-whole', accessorySkuId: 'case-sku', targetId: 'case-sku', targetKind: 'sku', host: cloneBenefit(resolution.host), conclusion: 'compatible', verification: 'confirmed', capability: 'basic', conditions: [], source: '独立测试型号级依据', note: '', createdAt: now, updatedAt: now }, { id: 'benefit-precise', accessorySkuId: 'film-sku', targetId: 'film-sku', targetKind: 'sku', host: { ...cloneBenefit(resolution.host), scope: 'planning', planningId: 'PLN-BENEFIT-0' }, conclusion: 'compatible', verification: 'confirmed', capability: 'basic', conditions: [], source: '独立测试精确 PLN', note: '', createdAt: now, updatedAt: now }, { id: 'benefit-other-plan', accessorySkuId: 'copy-sku', targetId: 'copy-sku', targetKind: 'sku', host: { ...cloneBenefit(resolution.host), scope: 'planning', planningId: 'PLN-BENEFIT-1' }, conclusion: 'compatible', verification: 'confirmed', capability: 'basic', conditions: [], source: '独立测试其他 PLN', note: '', createdAt: now, updatedAt: now })
  return { ...fixture, modelId, versionId, resolution }
}

check('device context is not delivered phone; no business identities allocated', () => {
  const { data, draft } = createBenefitPackageFixture(), before = cloneBenefit(data)
  assert.equal(draft.device?.kind, 'sku'); assert.equal(draft.includedPhoneSkuId, ''); assert.deepEqual(draft.goods.map(item => item.skuId), ['case-sku', 'film-sku'])
  assert.equal(draft.id, ''); assert.equal(draft.code, ''); assert.equal(draft.revision, 0)
  validateBenefitPackage(data, draft); previewBenefitDelivery(data, draft, 1)
  assert.deepEqual(data, before)
})
check('phone explicitly included once, removed deliberately, and model is not a physical SKU', () => {
  const { data, draft, hosts } = createBenefitPackageFixture()
  let next = setBenefitIncludedPhone(data, draft, true); next = setBenefitIncludedPhone(data, next, true)
  assert.equal(next.goods.find(line => line.skuId === 'phone-a')?.quantity, 1)
  assert.equal(next.goods.length, 3); assert.equal(draft.goods.length, 2)
  next = setBenefitIncludedPhone(data, next, false); assert.equal(next.goods.length, 2)
  assert.throws(() => setBenefitIncludedPhone(data, { ...draft, device: { kind: 'model', host: hosts.a } }, true), /具体销售(?:手机|主机)/)
})
check('switch context retains selected goods and old phone; explicit combined replacement preserves count', () => {
  const { data, draft } = createBenefitPackageFixture(), withPhone = setBenefitIncludedPhone(data, draft, true)
  const next = setBenefitDevice(data, withPhone, { kind: 'sku', skuId: 'phone-b' })
  assert.deepEqual(next.goods, withPhone.goods); assert.equal(next.includedPhoneSkuId, 'phone-a')
  const replacement = setBenefitDevice(data, withPhone, { kind: 'sku', skuId: 'phone-b' }, true)
  assert.equal(replacement.includedPhoneSkuId, 'phone-b'); assert.equal(replacement.goods.some(line => line.skuId === 'phone-a'), false); assert.equal(replacement.goods.find(line => line.skuId === 'phone-b')?.quantity, 1)
  assert.deepEqual(replacement.goods.filter(line => line.skuId !== 'phone-b'), draft.goods)
})
check('same stable SKU merges; equal names, SPU and specifications never merge distinct IDs', () => {
  const { data, draft } = createBenefitPackageFixture()
  const first = data.skus.find(item => item.id === 'film-sku'), second = data.skus.find(item => item.id === 'copy-sku'); assert.ok(first && second)
  second.skuName = first.skuName
  const merged = addBenefitSku(data, draft, 'film-sku', 2); assert.equal(merged.goods.find(item => item.skuId === 'film-sku')?.quantity, 3)
  const distinct = addBenefitSku(data, merged, 'copy-sku'); assert.equal(distinct.goods.length, 3)
  const unchanged = cloneBenefit(distinct)
  assert.throws(() => replaceBenefitSku(data, distinct, distinct.goods.find(line => line.skuId === 'copy-sku')!.id, 'film-sku'), /已有该 SKU 位置/)
  assert.deepEqual(distinct, unchanged, 'New positions never merge a replacement into an existing differently priced position')
  const legacy = cloneBenefit(distinct); delete legacy.compositionVersion
  for (const line of legacy.goods) { delete line.groupId; delete line.role }
  const replaced = replaceBenefitSku(data, legacy, legacy.goods.find(line => line.skuId === 'copy-sku')!.id, 'film-sku')
  assert.equal(replaced.goods.length, 2); assert.equal(replaced.goods.find(line => line.skuId === 'film-sku')?.quantity, 4)
})
check('MAT, PLN, SPU and nonexistent records cannot masquerade as sales goods', () => {
  const { data, draft } = createBenefitPackageFixture()
  for (const id of ['mat-copy', 'mat-only', 'PLN-MATERIAL', 'family-device', 'missing']) assert.throws(() => addBenefitSku(data, draft, id), /真实销售 SKU/)
  assert.equal(benefitSkuCandidates(data, null).some(item => item.skuId === 'mat-copy'), false)
})
check('invalid quantities are rejected without rounding or truncation; merging and multiplication guard overflow', () => {
  const { data, draft } = createBenefitPackageFixture()
  for (const quantity of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => addBenefitSku(data, draft, 'case-sku', quantity), /正整数/)
    const invalid = cloneBenefit(draft); invalid.goods[0]!.quantity = quantity
    assert.equal(validateBenefitPackage(data, invalid).canSaveDraft, false)
    assert.equal(previewBenefitDelivery(data, saved(draft), quantity).canConfirm, false)
  }
  const huge = cloneBenefit(draft); huge.goods = [huge.goods[0]!]; huge.goods[0]!.quantity = Number.MAX_SAFE_INTEGER
  assert.throws(() => addBenefitSku(data, huge, 'case-sku'), /安全范围/)
  assert.throws(() => multiplyBenefitQuantity(Number.MAX_SAFE_INTEGER, 2), /安全范围/)
  assert.equal(multiplyBenefitQuantity(3, 4), 12)
})
check('service per-package and per-delivery quantities stay separate; terms are never multiplied', () => {
  const { data, draft } = createBenefitPackageFixture()
  draft.goods[0]!.quantity = 2; draft.services = [service('service-one'), service('service-two', 'per-delivery')]
  const preview = previewBenefitDelivery(data, saved(draft), 3)
  assert.equal(preview.canConfirm, true); assert.deepEqual(preview.goods.map(item => item.totalQuantity), [6, 3])
  assert.deepEqual(preview.services.map(item => item.totalQuantity), [3, 1]); assert.equal(preview.services.length, 2)
  assert.equal(preview.services[0]?.validity, '3 个月会员（按每份约定）'); assert.equal(preview.services[1]?.measurement, 'per-delivery')
})
check('ordinary bundle is explicitly unchecked and does not claim universal device compatibility', () => {
  const { data } = createBenefitPackageFixture(); let draft = newBenefitPackageDraft(); draft.name = '【独立测试】普通组合包'; draft = addBenefitSku(data, draft, 'copy-sku')
  const result = validateBenefitPackage(data, draft); assert.equal(result.canSaveAvailable, true); assert.equal(result.goods[0]?.compatibility.basicStatus, 'unchecked'); assert.match(result.deviceLabel, /未做设备适配/)
})
check('directly selected phones freeze actual delivered hosts without choosing a compatibility context', () => {
  const { data } = createBenefitPackageFixture()
  let draft = newBenefitPackageDraft(); draft.name = '【独立测试】自由选择两台手机'
  draft = addBenefitSku(data, draft, 'phone-a'); draft = addBenefitSku(data, draft, 'phone-b', 2)
  const preview = previewBenefitDelivery(data, saved(draft), 3)
  assert.equal(preview.canConfirm, true); assert.equal(preview.device, null); assert.equal(preview.includedPhoneSkuId, '')
  assert.deepEqual(preview.hostSkuIds, ['phone-a', 'phone-b']); assert.deepEqual(preview.goods.map(line => line.totalQuantity), [3, 6])
  const snapshot = createBenefitDeliverySnapshot(preview, { id: 'direct-phone-delivery', code: 'BDL-000003', requestId: 'direct-phone-request', generatedAt: now })
  data.benefitDeliveries = [snapshot]; data.skus = []; data.families = []
  assert.deepEqual(snapshot.hostSkuIds, ['phone-a', 'phone-b']); assert.deepEqual(benefitPackageImportProblems(data), [])
  snapshot.hostSkuIds.push('not-in-goods'); assert.notEqual(benefitPackageImportProblems(data).length, 0)
  snapshot.hostSkuIds = ['phone-a', 'phone-a']; assert.notEqual(benefitPackageImportProblems(data).length, 0)
})
check('conditional manual acknowledgement records exact basis and never edits global declarations', () => {
  const { data, draft } = createBenefitPackageFixture(), globalBefore = cloneBenefit(data.compatibilities)
  const conditional = addBenefitSku(data, draft, 'cable-sku'), validation = validateBenefitPackage(data, conditional)
  assert.equal(validation.canSaveAvailable, false); assert.equal(validation.canDeliver, false)
  const legacy = cloneBenefit(conditional); delete legacy.compositionVersion
  for (const line of legacy.goods) { delete line.groupId; delete line.role }
  assert.equal(validateBenefitPackage(data, legacy).canSaveAvailable, true, 'Legacy conditional available status retains its original meaning before delivery confirmation')
  const acknowledged = confirmBenefitCondition(data, conditional, 'cable-sku', '本次按指定转换器条件交付', now)
  assert.equal(validateBenefitPackage(data, acknowledged).canDeliver, true)
  assert.equal(acknowledged.confirmations[0]?.capability, 'basic'); assert.deepEqual(acknowledged.confirmations[0]?.declarationIds, ['decl-cable-a']); assert.deepEqual(data.compatibilities, globalBefore)
  assert.equal(validateBenefitPackage(data, acknowledged).goods.find(item => item.line.skuId === 'cable-sku')?.compatibility.basicStatus, 'conditional')
})
check('acknowledgement expires on quantity, service, device, rule or relevant declaration changes', () => {
  const { data, draft } = createBenefitPackageFixture(), conditional = addBenefitSku(data, draft, 'cable-sku'), acknowledged = confirmBenefitCondition(data, conditional, 'cable-sku', '按当前条件', now)
  const quantity = cloneBenefit(acknowledged); quantity.goods[0]!.quantity++
  assert.equal(validateBenefitPackage(data, quantity).canDeliver, false)
  const services = cloneBenefit(acknowledged); services.services.push(service('service-a')); assert.equal(validateBenefitPackage(data, services).canDeliver, false)
  const rules = cloneBenefit(acknowledged); rules.rulesEnabled = true; assert.equal(validateBenefitPackage(data, rules).canDeliver, false)
  const source = data.compatibilities.find(item => item.id === 'decl-cable-a'); assert.ok(source); source.conditions = [{ kind: 'equipment', text: '另一款指定转换器' }]
  assert.equal(validateBenefitPackage(data, acknowledged).canDeliver, false)
  assert.equal(setBenefitDevice(data, acknowledged, { kind: 'sku', skuId: 'phone-b' }).confirmations.length, 0)
})
check('pending and explicit incompatibility cannot be promoted by manual package acknowledgement', () => {
  const { data, draft } = createBenefitPackageFixture()
  for (const id of ['pending-sku', 'blocked-sku']) {
    if (id === 'blocked-sku') assert.throws(() => addBenefitSku(data, draft, id), /明确不适用|条件不满足/)
    // A previously selected ordinary item remains present after choosing a
    // device; retaining it must never turn exclusion into an acknowledgement.
    const next = setBenefitDevice(data, addBenefitSku(data, { ...draft, device: null }, id), draft.device)
    assert.equal(next.goods.some(line => line.skuId === id), true)
    assert.equal(validateBenefitPackage(data, next).canSaveAvailable, false)
    assert.throws(() => confirmBenefitCondition(data, next, id, '不能覆盖全局事实', now), /待确认或不适用/)
  }
})
check('basic charge does not imply fast charge; only explicit fast requirement adds its prerequisite', () => {
  const { data, draft } = createBenefitPackageFixture(), charger = addBenefitSku(data, draft, 'charger-sku')
  assert.equal(validateBenefitPackage(data, charger).canDeliver, true)
  assert.equal(validateBenefitPackage(data, charger).goods.find(item => item.line.skuId === 'charger-sku')?.compatibility.fastChargeStatus, 'conditional')
  charger.requireFastCharge = true; assert.equal(validateBenefitPackage(data, charger).canDeliver, false)
  const acknowledged = confirmBenefitCondition(data, charger, 'charger-sku', '确认协议及配套线缆前提', now, 'fast-charge')
  assert.equal(validateBenefitPackage(data, acknowledged).canDeliver, true)
  assert.equal(validateBenefitPackage(data, { ...draft, requireFastCharge: true }).canDeliver, false)
})
check('exact frozen PLN is reused; other PLN does not enter current-device package', () => {
  const { data } = modelFixture(); let draft = newBenefitPackageDraft({ kind: 'sku', skuId: 'phone-history-128' }); draft.name = '【独立测试】精确范围包'
  draft = addBenefitSku(data, draft, 'case-sku'); draft = addBenefitSku(data, draft, 'film-sku')
  assert.equal(validateBenefitPackage(data, draft).canDeliver, true)
  const other = addBenefitSku(data, draft, 'copy-sku'); assert.equal(validateBenefitPackage(data, other).goods.find(item => item.line.skuId === 'copy-sku')?.compatibility.basicStatus, 'pending')
  assert.equal(validateBenefitPackage(data, other).canDeliver, false)
})
check('standalone model context works without delivering a fake device or inventing a PLN', () => {
  const { data, hosts } = createBenefitPackageFixture(); let draft = newBenefitPackageDraft({ kind: 'model', host: hosts.a }); draft.name = '【独立测试】型号适配包'; draft = addBenefitSku(data, draft, 'case-sku')
  assert.equal(validateBenefitPackage(data, draft).canDeliver, true); assert.equal(draft.goods.length, 1); assert.equal(draft.includedPhoneSkuId, '')
})
check('unconfigured and missing device references retain draft but block available and delivery', () => {
  const { data, draft } = createBenefitPackageFixture()
  for (const skuId of ['phone-unbound', 'missing-device']) { const next = { ...draft, device: { kind: 'sku' as const, skuId } }; const result = validateBenefitPackage(data, next); assert.equal(result.canSaveDraft, true); assert.equal(result.canSaveAvailable, false); assert.equal(result.deviceValid, false) }
})
check('unquoted, zero and two decimals are distinct; invalid money and total overflow rejected', () => {
  assert.equal(parseBenefitAmount(''), null); assert.equal(parseBenefitAmount('0'), 0); assert.equal(parseBenefitAmount('0.00'), 0); assert.equal(parseBenefitAmount('12.34'), 1234); assert.equal(parseBenefitAmount('0.29'), 29); assert.equal(formatBenefitAmount(0), '0.00'); assert.equal(formatBenefitAmount(null), '未报价')
  for (const text of ['-1', 'NaN', 'Infinity', '1.234', '1e3', '9007199254740992']) assert.throws(() => parseBenefitAmount(text))
  assert.equal(validBenefitCents(NaN), false)
  const { data, draft } = createBenefitPackageFixture(); draft.quote.amountCents = 0
  assert.equal(previewBenefitDelivery(data, saved(draft), 3).quote.totalCents, 0)
  draft.quote.amountCents = Number.MAX_SAFE_INTEGER; assert.equal(previewBenefitDelivery(data, saved(draft), 2).canConfirm, false)
})
check('composition change keeps manual quote as review reference, without pretending a calculated price', () => {
  const { data, draft } = createBenefitPackageFixture(); draft.quote.amountCents = 1000
  const reviewed = reviewBenefitQuote(draft, data); assert.equal(validateBenefitPackage(data, reviewed).quoteNeedsReview, false)
  const changed = addBenefitSku(data, reviewed, 'film-sku'); assert.equal(changed.quote.amountCents, 1000); assert.equal(validateBenefitPackage(data, changed).quoteNeedsReview, true)
  assert.equal(previewBenefitDelivery(data, saved(changed), 2).quote.totalCents, 2000)
})
check('optional rules disabled preserve free composition; candidates are never auto-selected', () => {
  const { data, draft } = createBenefitPackageFixture()
  draft.groups = [{ id: 'group-case', name: '保护壳组', enabled: true, candidateSkuIds: ['case-sku', 'film-sku'], required: true, minKinds: 1, maxKinds: 1, defaultQuantity: 1, adjustable: false, minQuantity: 1, maxQuantity: 1 }]
  assert.equal(validateBenefitPackage(data, draft).canSaveAvailable, true)
  draft.rulesEnabled = true; const before = cloneBenefit(draft); assert.equal(validateBenefitPackage(data, draft).canSaveAvailable, false); assert.deepEqual(draft, before)
  draft.goods = []; assert.equal(validateBenefitPackage(data, draft).issues.some(issue => issue.code === 'group-selection'), true); assert.equal(draft.goods.length, 0)
})
check('kind-count and per-kind quantities have independent constraints; optional zero selection allowed', () => {
  const { data, draft } = createBenefitPackageFixture(); draft.goods.find(line=>line.skuId==='case-sku')!.groupId='group-case'; draft.goods = draft.goods.filter(line => line.skuId === 'case-sku'); draft.rulesEnabled = true
  draft.groups = [{ id: 'group-case', name: '保护壳组', enabled: true, candidateSkuIds: ['case-sku', 'film-sku'], required: true, minKinds: 1, maxKinds: 1, defaultQuantity: 1, adjustable: false, minQuantity: 1, maxQuantity: 1 }]
  assert.equal(validateBenefitPackage(data, draft).canSaveAvailable, true)
  draft.goods[0]!.quantity = 2; assert.equal(validateBenefitPackage(data, draft).issues.some(issue => issue.code === 'group-selected-quantity'), true)
  draft.groups[0]!.adjustable = true; draft.groups[0]!.maxQuantity = 3; assert.equal(validateBenefitPackage(data, draft).canSaveAvailable, true)
  draft.groups[0]!.required = false; draft.goods = []; draft.services = [service('service-only')]; assert.equal(validateBenefitPackage(data, draft).canSaveAvailable, true)
})
check('V1 SKU cannot satisfy two enabled groups; stale candidate references remain explicit problems', () => {
  const { data, draft } = createBenefitPackageFixture(); delete draft.compositionVersion;for(const line of draft.goods){delete line.groupId;delete line.role}; draft.rulesEnabled = true
  const group = { id: 'group-a', name: '第一组', enabled: true, candidateSkuIds: ['case-sku'], required: true, minKinds: 1, maxKinds: 1, defaultQuantity: 1, adjustable: false, minQuantity: 1, maxQuantity: 1 }
  draft.groups = [group, { ...cloneBenefit(group), id: 'group-b', name: '第二组' }]
  assert.equal(validateBenefitPackage(data, draft).issues.some(issue => issue.code === 'group-overlap'), true)
  draft.groups[1]!.enabled = false; assert.equal(validateBenefitPackage(data, draft).canSaveAvailable, true)
  group.candidateSkuIds = ['off-sale-sku']; assert.equal(validateBenefitPackage(data, draft).issues.some(issue => issue.code === 'group-reference'), true)
})
check('copy is deep, new identity, no old confirmations/request/history, quote reference needs review', () => {
  const { data, draft } = createBenefitPackageFixture(); draft.quote.amountCents = 0; draft.services = [service('copy-service')]
  const source = saved(confirmBenefitCondition(data, addBenefitSku(data, draft, 'cable-sku'), 'cable-sku', '源包确认', now)); source.creationRequestId = 'creation-source'
  const next = copyBenefitPackageDraft(source)
  assert.equal(next.id, ''); assert.equal(next.code, ''); assert.equal(next.revision, 0); assert.equal(next.creationRequestId, undefined); assert.deepEqual(next.confirmations, []); assert.equal(next.quote.amountCents, 0); assert.equal(next.quote.reviewedBasis, '')
  next.goods[0]!.quantity = 8; next.services[0]!.name = '副本服务'
  assert.equal(source.goods[0]?.quantity, 1); assert.equal(source.services[0]?.name, '【独立测试】会员服务')
})
check('off-sale or deleted items retain saved text, allow draft, and block new formal delivery', () => {
  const { data, draft } = createBenefitPackageFixture(), source = saved(draft), caseSku = data.skus.find(item => item.id === 'case-sku'); assert.ok(caseSku)
  caseSku.status = 'off_sale'; assert.equal(validateBenefitPackage(data, source).canSaveDraft, true); assert.equal(previewBenefitDelivery(data, source, 1).canConfirm, false)
  data.skus = data.skus.filter(item => item.id !== 'case-sku')
  const result = validateBenefitPackage(data, source); assert.match(result.goods[0]!.summary.name, /case-sku/); assert.equal(result.canSaveAvailable, false); assert.equal(source.goods.length, 2)
})
check('draft and disabled packages cannot generate formal deliveries', () => {
  const { data, draft } = createBenefitPackageFixture()
  assert.equal(previewBenefitDelivery(data, { ...saved(draft), status: 'disabled' }, 1).canConfirm, false)
  assert.equal(previewBenefitDelivery(data, { ...saved(draft), status: 'draft' }, 1).canConfirm, false)
})
check('current goods, group, device, model and type references protect objects; snapshots alone do not', () => {
  const { data, draft } = createBenefitPackageFixture(); data.benefitPackages = [saved(draft)]
  for (const id of ['case-sku', 'phone-a']) assert.match(benefitPackageReferenceProblem(data, 'sku', id) || '', /权益包/)
  assert.match(benefitPackageReferenceProblem(data, 'type', 'type-device') || '', /权益包/)
  data.benefitPackages[0]!.groups = [{ id: 'only-reference', name: '候选引用', enabled: false, candidateSkuIds: ['copy-sku'], required: false, minKinds: 0, maxKinds: 1, defaultQuantity: 1, adjustable: true, minQuantity: 1, maxQuantity: 9 }]
  assert.match(benefitPackageReferenceProblem(data, 'sku', 'copy-sku') || '', /权益包/)
  data.benefitPackages = []; assert.equal(benefitPackageReferenceProblem(data, 'sku', 'case-sku'), undefined)
})
check('fresh preview revalidates changed declarations and conditions, never trusts stale canConfirm', () => {
  const { data, draft } = createBenefitPackageFixture(), source = saved(draft), old = previewBenefitDelivery(data, source, 2)
  assert.equal(old.canConfirm, true)
  const declaration = data.compatibilities.find(item => item.id === 'decl-case-a'); assert.ok(declaration); declaration.conclusion = 'incompatible'
  const fresh = previewBenefitDelivery(data, source, 2); assert.equal(fresh.canConfirm, false); assert.notEqual(old.basis, fresh.basis)
})
check('delivery freezes complete SKU, services, abilities, quote, source revision and conditions independently', () => {
  const { data, draft } = createBenefitPackageFixture(); draft.services = [service('freeze-service')]; draft.quote.amountCents = 1234
  const source = saved(reviewBenefitQuote(draft,data)), preview = previewBenefitDelivery(data, source, 3), snapshot = createBenefitDeliverySnapshot(preview, { id: 'delivery-test', code: 'BDL-000001', requestId: 'request-test', generatedAt: now }), frozen = cloneBenefit(snapshot)
  source.name = '后来修改'; source.goods[0]!.quantity = 9; source.services[0]!.validity = '后来修改'; source.quote.amountCents = 0
  source.rulesEnabled = true; source.groups = [{ id: 'later-group', name: '后来新增规则', enabled: true, candidateSkuIds: ['film-sku'], required: true, minKinds: 1, maxKinds: 1, defaultQuantity: 8, adjustable: false, minQuantity: 8, maxQuantity: 8 }]
  data.skus[0]!.skuName = '后来商品名称'; data.families[0]!.commonAttrs['品牌'] = '后来公共规格'; data.compatibilities = []; preview.goods[0]!.name = '预览对象被修改'
  assert.deepEqual(snapshot, frozen); assert.equal(snapshot.goods[0]?.totalQuantity, 3); assert.equal(snapshot.quote.totalCents, 3702); assert.equal(snapshot.sourceRevision, 1); assert.equal(snapshot.snapshotVersion, 2)
})
check('old data absence and repeated serialization preserve optional arrays and independently readable snapshots', () => {
  const { data, draft } = createBenefitPackageFixture(); delete data.benefitPackages; delete data.benefitDeliveries; assert.deepEqual(benefitPackageImportProblems(data), [])
  const source = saved(draft), delivery = createBenefitDeliverySnapshot(previewBenefitDelivery(data, source, 2), { id: 'roundtrip-delivery', code: 'BDL-000001', requestId: 'request-roundtrip', generatedAt: now })
  data.benefitPackages = [source]; data.benefitDeliveries = [delivery]
  const reloaded = JSON.parse(JSON.stringify(data)); assert.deepEqual(benefitPackageImportProblems(reloaded), []); assert.deepEqual(JSON.parse(JSON.stringify(reloaded)), reloaded)
  reloaded.skus = []; reloaded.families = []; assert.deepEqual(benefitPackageImportProblems(reloaded), [], 'Live references do not invalidate frozen history or drop retained configurations')
})
check('import rejects malformed quantity, quote, measurements, duplicate identities and request collisions', () => {
  const { data, draft } = createBenefitPackageFixture(); data.benefitPackages = [saved(draft)]
  const invalid = cloneBenefit(data); invalid.benefitPackages![0]!.goods[0]!.quantity = NaN; assert.notEqual(benefitPackageImportProblems(invalid).length, 0)
  const money = cloneBenefit(data); money.benefitPackages![0]!.quote.amountCents = -1; assert.notEqual(benefitPackageImportProblems(money).length, 0)
  const collision = cloneBenefit(data); const second = cloneBenefit(collision.benefitPackages![0]!); second.id += '-2'; second.code += '-2'; second.creationRequestId = 'same-create'; collision.benefitPackages![0]!.creationRequestId = 'same-create'; collision.benefitPackages!.push(second); assert.notEqual(benefitPackageImportProblems(collision).length, 0)
  const measurements = cloneBenefit(data); measurements.benefitPackages![0]!.services = [{ ...service('bad-service'), measurement: 'bad' as 'per-package' }]; assert.notEqual(benefitPackageImportProblems(measurements).length, 0)
  const sameLine = cloneBenefit(data); sameLine.benefitPackages![0]!.services = [service(sameLine.benefitPackages![0]!.goods[0]!.id)]; assert.notEqual(benefitPackageImportProblems(sameLine).length, 0)
  const alias = cloneBenefit(data); alias.benefitPackages![0]!.goods[0]!.snapshot.skuId = 'another-object'; assert.notEqual(benefitPackageImportProblems(alias).length, 0)
  const delivery = createBenefitDeliverySnapshot(previewBenefitDelivery(data, saved(draft), 2), { id: 'unique-test-delivery', code: 'BDL-000001', requestId: 'unique-test-request', generatedAt: now })
  const duplicates = cloneBenefit(data); duplicates.benefitDeliveries = [delivery]; duplicates.benefitDeliveries[0]!.goods.push(cloneBenefit(delivery.goods[0]!)); assert.notEqual(benefitPackageImportProblems(duplicates).length, 0)
  const badDate = cloneBenefit(data); badDate.benefitPackages![0]!.createdAt = 'not-a-date'; assert.notEqual(benefitPackageImportProblems(badDate).length, 0)
})
check('query, validation, candidate filtering, preview and copy preserve all original business arrays and input', () => {
  const { data, draft } = createBenefitPackageFixture(), before = cloneBenefit(data), draftBefore = cloneBenefit(draft)
  benefitSkuCandidates(data, draft.device, { accessoriesOnly: true, keyword: 'case' }); validateBenefitPackage(data, draft); previewBenefitDelivery(data, saved(draft), 3); copyBenefitPackageDraft(saved(draft)); benefitCompositionBasis(draft)
  assert.deepEqual(data, before); assert.deepEqual(draft, draftBefore)
})

if (artifacts) writeFileSync(resolve(output, 'result.json'), JSON.stringify({ result: 'PASS', fixedTime: now, checks, total: checks.length }, null, 2))
console.log(`PASS ${checks.length} benefit package domain groups`)
