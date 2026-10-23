import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { platform, arch, cpus } from 'node:os'
import { applyLegacyTemplateCompatibilityConversion, cloneTemplateCompatibility, createEmptyTemplateCompatibilityConfig, createTemplateCompatibilityContext, freezeTemplateCompatibility, mapTemplateCombination, previewLegacyTemplateCompatibilityConversion, resolveTemplateCompatibility, selectorForCombination, selectorForNode, templateClaimContentSignature, templateCompatibilityContentSignature, templateCompatibilityImportProblems, validateTemplateCompatibilityConfig } from '../src/domain/templateCompatibility'
import { legalPlanningCombinations, planningIdentityKey } from '../src/domain/planning'
import { createCatalogIdentityContext, isMaterialArchive, isRealSku } from '../src/domain/catalogIdentity'
import { createTemplateCompatibilityFixture, TEMPLATE_COMPATIBILITY_TIME } from './template-compatibility-fixtures'
import type { AppData } from '../src/domain/types'
import type { TemplateCompatibilityClaim } from '../src/domain/templateCompatibilityTypes'

const evidence: { name: string; passed: boolean }[] = []
function check(name: string, test: () => void) { test(); evidence.push({ name, passed: true }); console.log(`PASS ${name}`) }
function draftRows(data: AppData, modelId: string) { const context = createTemplateCompatibilityContext(data, { modelId }); return { context, rows: context.combinations.map(combo => resolveTemplateCompatibility(context, combo)) } }
check('conditional branches × sibling multiplication and order match the existing planning entry', () => {
  const { data, modelId } = createTemplateCompatibilityFixture(), before = JSON.stringify(data), { context, rows } = draftRows(data, modelId)
  assert.deepEqual(context.combinations, legalPlanningCombinations(data, modelId, data.productSpecNodes))
  assert.equal(rows.length, 8)
  assert.equal(rows.filter(row => row.origin === 'default').length, 4)
  assert.equal(rows.filter(row => row.origin === 'exception').length, 4)
  assert(rows.every(row => row.state === 'configured'))
  assert.equal(context.stats.combinationExpansions, 1); assert.equal(context.stats.claimValidations, 2)
  assert.equal(JSON.stringify(data), before, 'preview must preserve all arrays, identities, IDs and records')
})
check('unconfigured, explicit empty, inherited default and explicit negative remain distinct', () => {
  const { data, modelId, config, claim } = createTemplateCompatibilityFixture()
  data.templateCompatibilityConfigs = []
  assert(draftRows(data, modelId).rows.every(row => row.state === 'unconfigured'))
  data.templateCompatibilityConfigs = [config]; config.exceptions[0]!.claims = []
  let { rows } = draftRows(data, modelId)
  assert.equal(rows.filter(row => row.state === 'empty').length, 4)
  assert(rows.filter(row => row.origin === 'default').every(row => row.claims.length === 1))
  config.exceptions[0]!.claims = [{ ...claim('negative'), conclusion: 'incompatible', verification: 'pending' }]
  rows = draftRows(data, modelId).rows
  assert(rows.filter(row => row.origin === 'exception').every(row => row.claims[0]?.claim.conclusion === 'incompatible' && row.claims[0]?.claim.verification === 'pending'))
  const empty = createEmptyTemplateCompatibilityConfig(modelId)
  assert.equal(templateCompatibilityContentSignature(undefined), templateCompatibilityContentSignature(empty))
  empty.defaultRule.configured = true
  assert.notEqual(templateCompatibilityContentSignature(undefined), templateCompatibilityContentSignature(empty))
})
check('multiple identical full replacements deduplicate and retain exact origin pairs', () => {
  const { data, modelId, config } = createTemplateCompatibilityFixture()
  const rule = structuredClone(config.exceptions[0]!); rule.id = 'same-result-rule'; rule.claims[0]!.id = 'same-result-claim'; config.exceptions.push(rule)
  const rows = draftRows(data, modelId).rows.filter(row => row.origin === 'exception')
  assert(rows.every(row => row.state === 'configured' && row.claims.length === 1 && row.ruleIds.length === 2))
  assert.deepEqual(rows[0]?.claims[0]?.origins, [{ ruleId: 'compat-rule-pro', claimId: 'compat-claim-pro' }, { ruleId: 'same-result-rule', claimId: 'same-result-claim' }])
})
check('every result-affecting field participates in multi-exception conflict; no order/depth priority', () => {
  const mutations: ((claim: TemplateCompatibilityClaim) => void)[] = [claim => { claim.host = createTemplateCompatibilityFixture().hosts.a }, claim => { claim.note += '新说明' }, claim => { claim.source += '新证据' }, claim => { claim.verification = 'pending' }, claim => { claim.capability = 'fast-charge' }, claim => { claim.conclusion = 'incompatible' }, claim => { claim.conditions = [{ kind: 'manual', text: '需测试配套设备' }] }]
  for (const mutate of mutations) {
    const { data, modelId, config } = createTemplateCompatibilityFixture(), second = structuredClone(config.exceptions[0]!)
    second.id = 'overlap'; second.claims[0]!.id = 'different-claim'; mutate(second.claims[0]!); config.exceptions.unshift(second)
    let rows = draftRows(data, modelId).rows.filter(row => row.origin === 'exception')
    assert(rows.every(row => row.state === 'conflict'))
    config.exceptions.reverse(); rows = draftRows(data, modelId).rows.filter(row => row.origin === 'exception')
    assert(rows.every(row => row.state === 'conflict'))
  }
})
check('condition/value order normalization preserves full content equality', () => {
  const { claim } = createTemplateCompatibilityFixture(), first = claim(), second = structuredClone(first)
  first.conditions = [{ kind: 'attribute', attributeId: 'attr-port', operator: 'in', value: ['USB-C', 'Lightning'] }, { kind: 'equipment', text: '指定线缆' }]
  second.conditions = [...first.conditions].reverse().map(condition => condition.kind === 'attribute' ? { ...condition, value: ['Lightning', 'USB-C', 'USB-C'] } : condition)
  assert.equal(templateClaimContentSignature(first), templateClaimContentSignature(second))
  second.host.steps[0]!.attributeName = '改显示名称'
  second.host.steps[0]!.valueId = '独立设备目录改名'
  assert.equal(templateClaimContentSignature(first), templateClaimContentSignature(second), 'explicit device catalogue id determines identity, not its label stored in steps')
})
check('selector identity uses actual node/attribute/value/ancestor scope and never display names', () => {
  const { data, modelId, config } = createTemplateCompatibilityFixture()
  const before = draftRows(data, modelId).rows.map(row => [row.identityKey, row.origin])
  data.params.find(param => param.id === 'attr-color')!.name = '改名颜色'
  assert.deepEqual(draftRows(data, modelId).rows.map(row => [row.identityKey, row.origin]), before)
  const context = createTemplateCompatibilityContext(data, { modelId }), nodeScope = selectorForNode(context, 'compat-color-0-0')
  assert.equal(nodeScope.count, 2)
  config.exceptions[0]!.selector = nodeScope.selector!
  assert.equal(draftRows(data, modelId).rows.filter(row => row.origin === 'exception').length, 2, 'identical values in the other branch are excluded')
  config.exceptions[0]!.selector.anyOf[0]![0]!.attributeId = 'same-name-but-different-id'
  assert(draftRows(data, modelId).rows.every(row => row.state === 'invalid'))
})
check('invalid host, condition and scope references block affected output rather than falling back', () => {
  for (const mutate of [(claim: TemplateCompatibilityClaim) => { claim.host.productModelId = 'device:gone' }, (claim: TemplateCompatibilityClaim) => { claim.conditions = [{ kind: 'attribute', attributeId: 'gone', operator: 'eq', value: 'x' }] }]) {
    const { data, modelId, config } = createTemplateCompatibilityFixture(); mutate(config.exceptions[0]!.claims[0]!)
    const rows = draftRows(data, modelId).rows
    assert(rows.filter(row => row.origin === 'exception').every(row => row.state === 'invalid'))
    assert(rows.filter(row => row.origin === 'default').every(row => row.state === 'configured'))
    assert(validateTemplateCompatibilityConfig(data, config).length > 0)
  }
})
check('published snapshots are independent and preserve fallback roles/names/history', () => {
  const { data, modelId, config, versionId, version } = createTemplateCompatibilityFixture(), snapshotText = JSON.stringify(version)
  const old = createTemplateCompatibilityContext(data, { modelId, versionId }), originalKeys = old.combinations.map(combo => combo.identityKey)
  config.defaultRule.claims[0]!.note = '草稿新内容'; config.exceptions[0]!.claims = []
  data.templateParams.find(binding => binding.templateId === modelId && binding.paramId === 'attr-pack')!.role = 'variant'
  data.params.find(param => param.id === 'attr-pack')!.name = '新的展示名'
  data.productSpecNodes = []
  const after = createTemplateCompatibilityContext(data, { modelId, versionId })
  assert.deepEqual(after.combinations.map(combo => combo.identityKey), originalKeys)
  assert(after.combinations.every(combo => combo.steps.find(step => step.attributeId === 'attr-pack')?.role === 'common'))
  assert(after.combinations.every(combo => combo.steps.find(step => step.attributeId === 'attr-pack')?.roleSource === 'scheme'))
  assert(after.combinations.every(combo => combo.steps.find(step => step.attributeId === 'attr-pack')?.attributeName === '包装'))
  assert.equal(resolveTemplateCompatibility(after, after.combinations[0]!).claims[0]?.claim.note, '默认配置')
  assert.equal(JSON.stringify(version), snapshotText)
})
check('compatibility-only edits are publish differences; no-op revision/timestamp edits are not', () => {
  const { data, modelId, config } = createTemplateCompatibilityFixture(), snapshot = freezeTemplateCompatibility(data, modelId)
  assert.equal(templateCompatibilityContentSignature(config), templateCompatibilityContentSignature(snapshot))
  config.revision++; config.updatedAt = 'later'
  assert.equal(templateCompatibilityContentSignature(config), templateCompatibilityContentSignature(snapshot))
  config.defaultRule.claims[0]!.note += '兼容配置变更'
  assert.notEqual(templateCompatibilityContentSignature(config), templateCompatibilityContentSignature(snapshot))
})
check('old versions with only legacy metadata are unconfigured and never borrow current draft', () => {
  const { data, modelId, versionId, version } = createTemplateCompatibilityFixture()
  delete version.templateCompatibilitySnapshot
  const context = createTemplateCompatibilityContext(data, { modelId, versionId })
  assert(context.combinations.map(combo => resolveTemplateCompatibility(context, combo)).every(row => row.state === 'unconfigured'))
  const invalid = createTemplateCompatibilityContext(data, { modelId, versionId: 'deleted-version' })
  assert.equal(resolveTemplateCompatibility(invalid, 'x').state, 'invalid')
})
check('strong cross-version mapping preserves identity; recreated nodes and ambiguous subsets fail', () => {
  const { data, modelId, versionId, version } = createTemplateCompatibilityFixture()
  const source = createTemplateCompatibilityContext(data, { modelId, versionId }), sourceCombo = source.combinations[0]!
  const newVersion = structuredClone(version); newVersion.id = 'compat-version-2'; data.specModelVersions.push(newVersion)
  let target = createTemplateCompatibilityContext(data, { modelId, versionId: newVersion.id })
  assert.equal(mapTemplateCombination(source, target, { steps: sourceCombo.steps }).combination?.identityKey, sourceCombo.identityKey)
  assert.equal(mapTemplateCombination(source, target, { sourceNodeIds: sourceCombo.steps.map(step => step.valueNodeId) }).state, 'resolved')
  assert.equal(mapTemplateCombination(source, target, { sourceNodeIds: [sourceCombo.steps[0]!.valueNodeId] }).state, 'invalid')
  const valueNode = newVersion.nodesSnapshot.find(node => node.id === sourceCombo.steps[0]!.valueNodeId)!, priorId = valueNode.id
  valueNode.id = 'recreated-same-value'; newVersion.nodesSnapshot.filter(node => node.parentId === priorId).forEach(node => { node.parentId = valueNode.id })
  target = createTemplateCompatibilityContext(data, { modelId, versionId: newVersion.id })
  assert.equal(mapTemplateCombination(source, target, { steps: sourceCombo.steps }).state, 'invalid')
  assert.equal(planningIdentityKey(sourceCombo.steps), sourceCombo.identityKey)
})
check('legacy conversion is explicit, provable, pending, idempotent and preserves old/history arrays', () => {
  const { data, modelId, hosts, version } = createTemplateCompatibilityFixture()
  data.nodeCompatibilityRules = [{ id: 'old-draft-rule', templateId: modelId, nodeId: 'compat-style-0', modelVersionId: '', hosts: [hosts.a], updatedAt: TEMPLATE_COMPATIBILITY_TIME }, { id: 'old-draft-unresolved', templateId: modelId, nodeId: 'missing-node', modelVersionId: '', hosts: [hosts.a], updatedAt: TEMPLATE_COMPATIBILITY_TIME }, { id: 'old-frozen', templateId: modelId, nodeId: 'compat-style-0', modelVersionId: version.id, hosts: [hosts.b], updatedAt: TEMPLATE_COMPATIBILITY_TIME }]
  const before = JSON.stringify(data), preview = previewLegacyTemplateCompatibilityConversion(data, modelId)
  assert.equal(preview.items.length, 2); assert.equal(preview.items[0]?.count, 4); assert.equal(preview.items[1]?.state, 'invalid')
  const invalid = applyLegacyTemplateCompatibilityConversion(data, modelId, ['old-draft-rule', 'old-draft-unresolved'], TEMPLATE_COMPATIBILITY_TIME)
  assert.equal(invalid.ok, false); assert.equal(invalid.converted, 0)
  const converted = applyLegacyTemplateCompatibilityConversion(data, modelId, ['old-draft-rule'], TEMPLATE_COMPATIBILITY_TIME)
  assert.equal(converted.ok, true); assert.equal(converted.converted, 1)
  const legacy = converted.config.exceptions.find(rule => rule.id.startsWith('legacy-exception:'))!
  assert(legacy.claims.every(claim => claim.verification === 'pending' && claim.source.includes('待核验')))
  const repeat = applyLegacyTemplateCompatibilityConversion(data, modelId, ['old-draft-rule'], 'later', structuredClone(converted.config))
  assert.equal(repeat.converted, 0); assert.deepEqual(repeat.config, converted.config)
  assert.equal(JSON.stringify(data), before, 'conversion returns a draft and never writes legacy nodes, SKU/MAT or published snapshots')
})
check('save/clone/export-import round trips preserve new fields and unknown extension fields', () => {
  const { data, modelId, config } = createTemplateCompatibilityFixture(), exported = JSON.parse(JSON.stringify(data)) as AppData
  Object.assign(config, { futureExtension: { retain: true } })
  const roundTrip = cloneTemplateCompatibility(data)
  assert.deepEqual(templateCompatibilityImportProblems(roundTrip), [])
  assert.deepEqual(roundTrip.templateCompatibilityConfigs, data.templateCompatibilityConfigs)
  assert.deepEqual(templateCompatibilityImportProblems(exported), [])
  assert.deepEqual(draftRows(roundTrip, modelId).rows, draftRows(data, modelId).rows)
  const corrupt = structuredClone(data); (corrupt as unknown as Record<string, unknown>).templateCompatibilityConfigs = {}
  assert(templateCompatibilityImportProblems(corrupt).length > 0)
  const brokenClaim = JSON.parse(JSON.stringify(data)) as AppData; (brokenClaim.templateCompatibilityConfigs![0]!.defaultRule.claims as unknown[]) = [null]
  assert(templateCompatibilityImportProblems(brokenClaim).length > 0)
  assert.equal(resolveTemplateCompatibility(createTemplateCompatibilityContext(brokenClaim, { modelId }), 'x').state, 'invalid')
  const legacy = structuredClone(data); delete legacy.templateCompatibilityConfigs; legacy.specModelVersions.forEach(version => { delete version.templateCompatibilitySnapshot })
  assert.deepEqual(templateCompatibilityImportProblems(legacy), [])
})
check('full combination selectors preserve tuple boundaries and cannot match partial OR fragments', () => {
  const { data, modelId, config } = createTemplateCompatibilityFixture(), context = createTemplateCompatibilityContext(data, { modelId })
  config.exceptions[0]!.selector = selectorForCombination(context.combinations[3]!)
  assert.equal(draftRows(data, modelId).rows.filter(row => row.origin === 'exception').length, 1)
})
check('operation-local SKU/MAT identity index preserves receipt/code/explicit/legacy precedence', () => {
  const { data } = createTemplateCompatibilityFixture(), base = data.skus[0]!, family = data.families[0]!
  data.families.push({ ...family, id: 'legacy-v3', line: 'v3' }, { ...family, id: 'duplicate-family', line: 'v2' }, { ...family, id: 'duplicate-family', line: 'v3' })
  const cases = [base, { ...base, id: 'explicit-sku', recordKind: 'sku' as const }, { ...base, id: 'explicit-material', recordKind: 'material' as const }, { ...base, id: 'receipt-wins', recordKind: 'sku' as const }, { ...base, id: 'material-code-wins', materialCode: ' MAT-TEST ', recordKind: 'sku' as const }, { ...base, id: 'legacy-line', familyId: 'legacy-v3', recordKind: undefined }, { ...base, id: 'duplicate-family-case', familyId: 'duplicate-family', recordKind: undefined }, { ...base, id: 'orphan', familyId: 'missing', recordKind: undefined }]
  data.materialReceipts.push({ requestId: 'receipt', skuId: 'receipt-wins', planningId: 'PLN-TEST', materialCode: 'MAT-TEST', createdTime: TEMPLATE_COMPATIBILITY_TIME, lifecycle: 'deleted' })
  const before = JSON.stringify(data), context = createCatalogIdentityContext(data)
  for (const sku of cases) { assert.equal(context.isMaterialArchive(sku), isMaterialArchive(data, sku)); assert.equal(context.isRealSku(sku), isRealSku(data, sku)) }
  assert.equal(context.isMaterialArchive(cases[3]!), true)
  assert.equal(context.isMaterialArchive(cases[6]!), false, 'first legacy family wins exactly as find()')
  assert.equal(context.isRealSku(cases[7]!), false)
  assert.equal(JSON.stringify(data), before)
})
check('malformed frozen configuration is reported without current-draft fallback or exceptions', () => {
  const { data, modelId, versionId, version } = createTemplateCompatibilityFixture()
  ;(version.templateCompatibilitySnapshot!.attributeRoles as unknown[]) = [null]
  assert(templateCompatibilityImportProblems(data).length > 0)
  const context = createTemplateCompatibilityContext(data, { modelId, versionId })
  assert.equal(resolveTemplateCompatibility(context, 'x').state, 'invalid')
})
check('pure preview and validation consume no random IDs or clock values and can reuse prepared context', () => {
  const { data, modelId, config } = createTemplateCompatibilityFixture(), random = Math.random, now = Date.now
  try {
    Math.random = () => { throw new Error('preview consumed an ID source') }; Date.now = () => { throw new Error('preview consumed a clock source') }
    const context = createTemplateCompatibilityContext(data, { modelId, config })
    assert.deepEqual(validateTemplateCompatibilityConfig(data, config, context), [])
    context.combinations.forEach(combo => resolveTemplateCompatibility(context, combo))
    assert.equal(context.stats.combinationExpansions, 1)
  } finally { Math.random = random; Date.now = now }
})
check('an incomplete exception keeps actual structure available to repair scope in one context', () => {
  const { data, modelId, config } = createTemplateCompatibilityFixture()
  config.exceptions.push({ id: 'unselected-draft', name: '尚未选择范围', selector: { anyOf: [] }, claims: [] })
  const context = createTemplateCompatibilityContext(data, { modelId, config })
  assert.equal(context.combinations.length, 8); assert.equal(context.stats.combinationExpansions, 1)
  assert(context.combinations.map(combo => resolveTemplateCompatibility(context, combo)).every(row => row.state === 'invalid'))
  assert.equal(selectorForNode(context, 'compat-style-1').count, 4)
  assert(validateTemplateCompatibilityConfig(data, config, context).length > 0)
  previewLegacyTemplateCompatibilityConversion(data, modelId, config, context)
  assert.equal(context.stats.combinationExpansions, 1)
})
mkdirSync('work/template-compatibility', { recursive: true })
writeFileSync('work/template-compatibility/domain-evidence.json', JSON.stringify({ executedAt: new Date().toISOString(), runtime: { node: process.version, platform: platform(), arch: arch(), cpu: cpus()[0]?.model }, fixedBusinessTime: TEMPLATE_COMPATIBILITY_TIME, checks: evidence.length, results: evidence }, null, 2))
console.log(`Template compatibility domain: ${evidence.length} checks passed`)
