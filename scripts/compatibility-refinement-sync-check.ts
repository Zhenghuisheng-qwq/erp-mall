import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { applyTemplateCompatibilitySync, markTemplateManualChanges, materializeTemplateCompatibility, previewTemplateCompatibilitySync, templateCompatibilityOriginProblems } from '../src/domain/templateCompatibilitySync'
import { createTemplateCompatibilityContext, freezeTemplateCompatibility, selectorForCombination } from '../src/domain/templateCompatibility'
import { createRefinementSyncFixture, SYNC_REFINEMENT_TIME as now } from './compatibility-refinement-sync-fixtures'

const phase = process.env.SYNC_REFINEMENT_PHASE || 'after'
const output = resolve(process.env.SYNC_REFINEMENT_OUTPUT || `work/compatibility-refinement/sync-${phase}.json`)
const results: { name: string; passed: boolean; detail: string }[] = []
function check(name: string, run: () => void) {
  try { run(); results.push({ name, passed: true, detail: 'strict assertions passed' }); console.log(`PASS ${name}`) }
  catch (cause) { const detail = cause instanceof Error ? cause.message : String(cause); results.push({ name, passed: false, detail }); console.error(`FAIL ${name}: ${detail}`) }
}
const preview = (f: ReturnType<typeof createRefinementSyncFixture>, targetVersionId: string) => previewTemplateCompatibilitySync(f.data, { modelId: f.modelId, targetVersionId, targetIds: [f.sku.id] })

check('many-to-one-default-never-deletes-conflict-sources', () => {
  const f = createRefinementSyncFixture(['甲', '乙']), version = f.publish(['相同', '相同'])
  assert.equal(f.links().length, 2)
  const prior = JSON.stringify(f.links()), plan = preview(f, version)
  assert.equal(plan.items.filter(item => item.state === 'remove' && item.defaultSelected).length, 0, 'conflict participant cannot become a default removal')
  const receipt = applyTemplateCompatibilitySync(f.data, plan, {}, f.nextId, now)
  assert.equal(receipt.ok, true); assert.equal(JSON.stringify(f.links()), prior, 'unresolved merge must retain both declarations')
})
check('one-to-many-preview-operations-have-unique-identities', () => {
  const f = createRefinementSyncFixture(['相同', '相同']), version = f.publish(['甲', '乙']), plan = preview(f, version)
  assert.equal(new Set(plan.items.map(item => item.id)).size, plan.items.length, 'one old source cannot be greedily claimed twice')
  const declarations = plan.items.filter(item => item.defaultSelected && item.declarationId).map(item => item.declarationId)
  assert.equal(new Set(declarations).size, declarations.length, 'default operations cannot share a formal declaration')
})
check('one-to-many-default-preserves-unresolved-current-result', () => {
  const f = createRefinementSyncFixture(['相同', '相同']), version = f.publish(['甲', '乙']), prior = JSON.stringify(f.links())
  const receipt = applyTemplateCompatibilitySync(f.data, preview(f, version), {}, f.nextId, now)
  assert.equal(receipt.ok, true); assert.equal(JSON.stringify(f.links()), prior)
})
check('explicit-split-receipt-matches-two-real-results', () => {
  const f = createRefinementSyncFixture(['相同', '相同']), version = f.publish(['甲', '乙']), plan = preview(f, version)
  const receipt = applyTemplateCompatibilitySync(f.data, plan, Object.fromEntries(plan.items.map(item => [item.id, 'take-template'])), f.nextId, now)
  assert.equal(receipt.ok, true); assert.equal(f.links().length, 2, `receipt ${JSON.stringify(receipt)} must correspond to two distinct formal statements`)
  assert.deepEqual(f.links().map(item => item.note), ['甲', '乙'])
})

check('one-to-one-update-keeps-formal-identity-and-explicit-keep', () => {
  const f = createRefinementSyncFixture(['旧']), version = f.publish(['新']), id = f.links()[0]!.id
  let plan = preview(f, version)
  assert.equal(plan.items.length, 1); assert.equal(plan.items[0]!.state, 'update'); assert.equal(plan.items[0]!.group, undefined)
  const kept = applyTemplateCompatibilitySync(f.data, plan, { [plan.items[0]!.id]: 'keep' }, f.nextId, now)
  assert.equal(kept.protected, 1); assert.equal(f.links()[0]!.note, '旧')
  plan = preview(f, version); assert.equal(plan.items[0]!.state, 'protected')
  const adopted = applyTemplateCompatibilitySync(f.data, plan, { [plan.items[0]!.id]: 'take-template' }, f.nextId, now)
  assert.equal(adopted.updated, 1); assert.equal(f.links()[0]!.id, id); assert.equal(f.links()[0]!.note, '新')
})
check('explicit-merge-archives-two-origins-and-creates-one-real-result', () => {
  const f = createRefinementSyncFixture(['甲', '乙']), version = f.publish(['相同', '相同']), source = JSON.stringify(f.version)
  const old = structuredClone(f.origins()), plan = preview(f, version), item = plan.items[0]!
  assert.equal(plan.items.length, 1); assert.equal(item.group?.kind, 'many-to-one'); assert.equal(item.group?.canAdopt, true)
  assert.equal(item.group?.operations.filter(operation => operation.kind === 'remove').length, 2)
  assert.equal(item.group?.operations.filter(operation => operation.kind === 'add').length, 1)
  const receipt = applyTemplateCompatibilitySync(f.data, plan, { [item.id]: 'take-template' }, f.nextId, now)
  assert.deepEqual([receipt.added, receipt.updated, receipt.removed], [1, 0, 2]); assert.equal(f.links().length, 1)
  assert.deepEqual(f.origins().filter(origin => origin.state === 'obsolete').map(origin => [origin.key, origin.declarationId, origin.baseline]), old.map(origin => [origin.key, origin.declarationId, origin.baseline]))
  assert.equal(JSON.stringify(f.version), source); assert.deepEqual(templateCompatibilityOriginProblems(f.data), [])
})
check('many-to-many-is-one-deterministic-atomic-component', () => {
  const f = createRefinementSyncFixture(['甲', '甲', '乙', '乙']), version = f.publish(['丙', '丁', '丙', '丁'])
  const plan = preview(f, version), item = plan.items[0]!
  assert.equal(plan.items.length, 1); assert.equal(item.group?.kind, 'many-to-many'); assert.equal(item.group?.canAdopt, true)
  const operations = item.group!.operations
  assert.equal(new Set(operations.map(operation => operation.id)).size, operations.length)
  assert.equal(new Set(item.group!.before.map(row => row.origin.key)).size, 2)
  assert.equal(new Set(item.group!.after.map(row => row.origin.key)).size, 2)
  const before = JSON.stringify(f.data), allocation = f.allocated()
  assert.deepEqual(preview(f, version), plan); assert.equal(JSON.stringify(f.data), before); assert.equal(f.allocated(), allocation)
  const receipt = applyTemplateCompatibilitySync(f.data, plan, { [item.id]: 'take-template' }, f.nextId, now)
  assert.deepEqual([receipt.added, receipt.removed, receipt.updated], [2, 2, 0]); assert.deepEqual(f.links().map(link => link.note), ['丙', '丁'])
  assert.deepEqual(templateCompatibilityOriginProblems(f.data), [])
})
check('split-merge-split-multiple-versions-are-stable-and-idempotent', () => {
  const f = createRefinementSyncFixture(['甲', '乙']), frozen = JSON.stringify([f.data.skus, f.data.families, f.data.planningRecords, f.version])
  for (const notes of [['合并', '合并'], ['再次甲', '再次乙'], ['再合并', '再合并'], ['最后甲', '最后乙']]) {
    const version = f.publish(notes), plan = preview(f, version), group = plan.items.find(item => item.group)!
    assert.equal(group.group!.canAdopt, true)
    const receipt = applyTemplateCompatibilitySync(f.data, plan, { [group.id]: 'take-template' }, f.nextId, now)
    assert.equal(receipt.ok, true); assert.deepEqual(f.links().map(link => link.note), [...new Set(notes)])
    const settled = preview(f, version), prior = JSON.stringify(f.data), allocated = f.allocated()
    assert.equal(settled.counts.unchanged, new Set(notes).size); assert.equal(settled.counts.conflict, 0)
    assert.equal(applyTemplateCompatibilitySync(f.data, settled, {}, f.nextId, now).ok, true)
    assert.equal(JSON.stringify(f.data), prior); assert.equal(f.allocated(), allocated)
    assert.equal(new Set(f.origins().map(origin => origin.key)).size, f.origins().length)
    assert.deepEqual(templateCompatibilityOriginProblems(f.data), [])
  }
  assert.equal(JSON.stringify([f.data.skus, f.data.families, f.data.planningRecords, f.version]), frozen)
})
for (const mode of ['modified', 'deleted', 'kept', 'stale'] as const) check(`split-preserves-${mode}-protection-and-refuses-group-bypass`, () => {
  const f = createRefinementSyncFixture(['相同', '相同']), id = f.links()[0]!.id
  if (mode === 'modified') { f.links()[0]!.note = '人工修订'; markTemplateManualChanges(f.data, [{ kind: 'edit', id }], now) }
  else if (mode === 'deleted') { f.data.compatibilities = f.data.compatibilities.filter(link => link.id !== id); markTemplateManualChanges(f.data, [{ kind: 'remove', id }], now) }
  else f.origins()[0]!.state = mode
  const version = f.publish(['甲', '乙']), plan = preview(f, version), group = plan.items.find(item => item.group)!
  assert.equal(group.group!.canAdopt, false); assert(group.group!.blockedReasons.length)
  const before = JSON.stringify(f.data), allocation = f.allocated()
  assert.equal(applyTemplateCompatibilitySync(f.data, plan, {}, f.nextId, now).ok, true); assert.equal(JSON.stringify(f.data), before)
  assert.equal(applyTemplateCompatibilitySync(f.data, plan, { [group.id]: 'take-template' }, f.nextId, now).ok, false)
  assert.equal(JSON.stringify(f.data), before); assert.equal(f.allocated(), allocation)
  if (mode === 'deleted') {
    const later = f.publish(['又合并', '又合并']), protectedPlan = preview(f, later)
    assert.equal(protectedPlan.items[0]!.state, 'protected'); assert.equal(protectedPlan.items[0]!.defaultSelected, false)
    assert.equal(applyTemplateCompatibilitySync(f.data, protectedPlan, {}, f.nextId, now).ok, true); assert.equal(f.links().length, 0)
    assert.equal(f.origins()[0]!.state, 'deleted', 'suppression tombstone must survive default keep and later regrouping')
  }
})
check('manual-denial-blocks-the-whole-group-and-is-never-removed', () => {
  const f = createRefinementSyncFixture(['相同', '相同']), denial = { ...structuredClone(f.links()[0]!), id: 'refinement-manual-denial', conclusion: 'incompatible' as const, provenance: { kind: 'manual' as const, detail: '【独立测试】人工排除' } }
  f.data.compatibilities.push(denial)
  const version = f.publish(['甲', '乙']), plan = preview(f, version), group = plan.items.find(item => item.group)!
  assert.equal(group.group!.canAdopt, false); assert.deepEqual(group.blockingIds, [denial.id])
  const before = JSON.stringify(f.data)
  assert.equal(applyTemplateCompatibilitySync(f.data, plan, {}, f.nextId, now).ok, true); assert.equal(JSON.stringify(f.data), before)
  assert.equal(applyTemplateCompatibilitySync(f.data, plan, { [group.id]: 'take-template' }, f.nextId, now).ok, false); assert.equal(JSON.stringify(f.data), before)
})
check('default-conflict-does-not-block-an-independent-safe-update', () => {
  const f = createRefinementSyncFixture(['甲', '乙', '独立旧']), version = f.publish(['合并', '合并', '独立新']), plan = preview(f, version)
  assert.equal(plan.counts.conflict, 1); assert.equal(plan.counts.update, 1); assert.equal(plan.counts.remove, 0)
  const receipt = applyTemplateCompatibilitySync(f.data, plan, {}, f.nextId, now)
  assert.deepEqual([receipt.updated, receipt.removed, receipt.added, receipt.protected], [1, 0, 0, 2]); assert.deepEqual(f.links().map(link => link.note), ['甲', '乙', '独立新'])
})
check('legacy-lineage-fallback-is-safe-and-obsolete-history-does-not-compete', () => {
  const f = createRefinementSyncFixture(['甲', '乙'])
  f.origins().forEach(origin => delete origin.lineage)
  const merged = f.publish(['合并', '合并']), plan = preview(f, merged), group = plan.items.find(item => item.group)!
  assert.equal(group.group!.kind, 'many-to-one'); assert.equal(applyTemplateCompatibilitySync(f.data, plan, { [group.id]: 'take-template' }, f.nextId, now).ok, true)
  const split = f.publish(['甲新', '乙新']), splitPlan = preview(f, split)
  assert.equal(splitPlan.items.length, 1); assert.equal(splitPlan.items[0]!.group!.kind, 'one-to-many'); assert.equal(splitPlan.items[0]!.group!.before.length, 1)
})
check('removed-and-reintroduced-source-keeps-its-historical-baseline', () => {
  const f = createRefinementSyncFixture(['旧']), old = structuredClone(f.origins()[0]!), empty = f.publish([])
  const removal = applyTemplateCompatibilitySync(f.data, preview(f, empty), {}, f.nextId, now)
  assert.equal(removal.removed, 1); assert.equal(f.links().length, 0)
  const restored = f.publish(['新']), plan = preview(f, restored)
  assert.equal(plan.counts.add, 1); assert.notEqual(plan.items[0]!.originKey, old.key)
  assert.equal(applyTemplateCompatibilitySync(f.data, plan, {}, f.nextId, now).added, 1)
  assert.deepEqual(f.origins().find(origin => origin.key === old.key)?.baseline, old.baseline)
  assert.equal(f.origins().find(origin => origin.key === old.key)?.state, 'obsolete'); assert.deepEqual(templateCompatibilityOriginProblems(f.data), [])
})
check('stale-preview-and-edited-plan-are-rejected-before-any-write-or-id', () => {
  const f = createRefinementSyncFixture(['甲', '乙']), version = f.publish(['合并', '合并']), plan = preview(f, version)
  f.links()[0]!.note = '预览后人工修改'
  const before = JSON.stringify(f.data), allocation = f.allocated()
  assert.equal(applyTemplateCompatibilitySync(f.data, plan, { [plan.items[0]!.id]: 'take-template' }, f.nextId, now).ok, false)
  assert.equal(JSON.stringify(f.data), before); assert.equal(f.allocated(), allocation)
  const fresh = preview(f, version); fresh.items[0]!.group!.canAdopt = true
  assert.equal(applyTemplateCompatibilitySync(f.data, fresh, { [fresh.items[0]!.id]: 'take-template' }, f.nextId, now).ok, false)
  assert.equal(JSON.stringify(f.data), before); assert.equal(f.allocated(), allocation)
})
check('crossed-rule-claim-pairs-have-distinct-origin-identities', () => {
  const f = createRefinementSyncFixture(['起点']), context = createTemplateCompatibilityContext(f.data, { modelId: f.modelId }), selector = selectorForCombination(context.combinations[0]!)
  f.config.defaultRule.claims = []
  f.config.exceptions = [
    { id: 'refinement-rule-a', name: '完整结果甲乙', selector, claims: [{ ...f.claim('claim-a'), note: '甲' }, { ...f.claim('claim-b'), note: '乙' }] },
    { id: 'refinement-rule-b', name: '同结果交叉来源', selector: structuredClone(selector), claims: [{ ...f.claim('claim-b'), note: '甲' }, { ...f.claim('claim-a'), note: '乙' }] },
  ]
  f.version.templateCompatibilitySnapshot = freezeTemplateCompatibility(f.data, f.modelId)
  f.data.compatibilities = f.data.compatibilities.filter(link => link.targetId !== f.sku.id)
  f.data.templateCompatibilityOrigins = f.data.templateCompatibilityOrigins!.filter(origin => origin.target.id !== f.sku.id)
  const receipt = materializeTemplateCompatibility(f.data, [f.sku.id], f.nextId, now)
  assert.equal(receipt.ok, true); assert.equal(receipt.added, 2); assert.equal(new Set(f.origins().map(origin => origin.key)).size, 2)
  assert.deepEqual(f.links().map(link => link.note), ['甲', '乙']); assert.deepEqual(templateCompatibilityOriginProblems(f.data), [])
})
check('duplicate-active-declaration-reference-is-invalid-and-never-applied', () => {
  const f = createRefinementSyncFixture(['旧']), duplicate = structuredClone(f.origins()[0]!)
  duplicate.key += ':invalid-duplicate'; f.data.templateCompatibilityOrigins!.push(duplicate)
  const version = f.publish(['新']), plan = preview(f, version), before = JSON.stringify(f.data)
  assert.equal(plan.counts.invalid, 1); assert.equal(plan.counts.update, 0)
  assert.equal(applyTemplateCompatibilitySync(f.data, plan, {}, f.nextId, now).ok, true); assert.equal(JSON.stringify(f.data), before)
})

mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, JSON.stringify({ phase, fixedTime: now, runtime: { node: process.version, platform: process.platform, arch: process.arch }, results, passed: results.every(item => item.passed) }, null, 2))
if (phase === 'after') {
  const browserFixtures = [
    { name: 'merge', before: ['甲', '乙'], after: ['相同', '相同'] },
    { name: 'split', before: ['相同', '相同'], after: ['甲', '乙'] },
  ].map(sample => {
    const f = createRefinementSyncFixture(sample.before), targetVersionId = f.publish(sample.after)
    return { name: sample.name, data: f.data, input: { modelId: f.modelId, targetVersionId, targetIds: [f.sku.id] }, expectedNotes: [...new Set(sample.after)] }
  })
  writeFileSync(resolve(dirname(output), 'sync-browser-fixtures.json'), JSON.stringify(browserFixtures))
}
if (results.some(item => !item.passed)) process.exitCode = 1
