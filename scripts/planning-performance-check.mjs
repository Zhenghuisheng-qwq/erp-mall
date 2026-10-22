import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { cpus, platform, release, totalmem } from 'node:os'
import { resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import {
  BASELINE, NOW, outputDir, clone, loadImplementations, fixture, record, version,
  benchmarkFixture, reconcileInput,
} from './planning-performance-fixtures.mjs'

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    Object.values(value).forEach(freeze)
  }
  return value
}

const checks = []
const { server, before, after } = await loadImplementations()
const measured = []
try {
  function compare(name, input, preview = true) {
    const data = freeze(clone(input))
    const nodes = data.productSpecNodes
    const original = JSON.stringify(data)
    const expected = before.legalPlanningCombinations(data, 'm', nodes)
    const actual = after.legalPlanningCombinations(data, 'm', nodes)
    assert.deepStrictEqual(actual, expected, `${name}: combinations, order, identity and metadata`)
    const steps = actual.flatMap((combo) => combo.steps)
    assert.equal(new Set(steps).size, steps.length, `${name}: output steps must not alias`)
    assert.deepStrictEqual(after.planningRoleGaps(data, 'm', nodes), before.planningRoleGaps(data, 'm', nodes))
    const args = reconcileInput(data)
    const expectedResult = before.reconcilePlanningRecords(args)
    const result = after.reconcilePlanningRecords(args)
    assert.deepStrictEqual(result, expectedResult, `${name}: full reconcile result`)
    assert.deepStrictEqual(after.summarizePlanningCombinations(data.planningRecords, 'm', actual), {
      created: expectedResult.created, reused: expectedResult.reused,
    }, `${name}: read-only counts`)
    data.planningRecords.forEach((old, index) => {
      assert.notEqual(result.records[index], old)
      assert.notEqual(result.records[index].steps, old.steps)
      assert.notEqual(result.records[index].modelVersionIds, old.modelVersionIds)
    })
    if (preview) {
      const oldPreview = before.previewDraftCombinations(data, 'm', nodes)
      const newPreview = after.previewDraftCombinations(data, 'm', nodes)
      assert.deepStrictEqual(newPreview, oldPreview, `${name}: preview rows, counts and version metadata`)
      assert.equal(after.publishImpactText(newPreview), before.publishImpactText(oldPreview))
    }
    for (const mode of ['all', 'variant']) {
      const run = (implementation) => {
        const calls = []
        const paths = implementation.expandFilteredPaths(nodes, null, (attribute) => {
          calls.push(`accept:${attribute.id}`)
          return mode === 'all' || attribute.role !== 'COMMON'
        }, (attribute) => { calls.push(`label:${attribute.id}`); return attribute.attributeId })
        return { paths, calls }
      }
      assert.deepStrictEqual(run(after), run(before), `${name}: V2 shared path expansion / callback order`)
    }
    const historical = { ...data, planningRecords: result.records }
    for (const row of result.records.slice(0, 8)) {
      for (const versionId of ['v0', 'v1', 'v2', 'missing']) {
        assert.deepStrictEqual(after.tracePlanning(historical, row.planningId, versionId),
          before.tracePlanning(historical, row.planningId, versionId), `${name}: trace ${versionId}`)
      }
    }
    assert.equal(JSON.stringify(data), original, `${name}: immutable inputs`)
    checks.push(name)
    return { combos: actual, result }
  }

  const initial = fixture()
  const first = compare('conditional branches × sibling attributes; explicit / scheme / default roles', initial)
  assert.equal(first.combos.length, 16)
  assert.ok(first.combos.every((combo) => combo.steps.length === 4))
  const commonFallback = fixture()
  commonFallback.templateParams[0].role = 'common'
  commonFallback.templateParams.push(
    { templateId: 'm', paramId: 'model', role: 'variant', required: false },
    { templateId: 'm', paramId: 'pack', role: 'common', required: false },
  )
  const fallback = compare('COMMON scheme fallback; explicit node roles override conflicting scheme roles', commonFallback)
  assert.ok(fallback.combos.every((combo) => combo.steps.find((step) => step.attributeId === 'capacity').role === 'common'))
  assert.ok(fallback.combos.every((combo) => combo.steps.find((step) => step.attributeId === 'pack').role === 'variant'))
  const mixed = clone(initial)
  mixed.specModelVersions = [version(mixed.productSpecNodes)]
  const combos = first.combos
  mixed.planningRecords = [
    record(combos[0], 7, { status: 'retired', retiredTime: NOW, grade: 'core' }),
    record(combos[0], 8),
    record(combos[1], 7), // same PLN already used by the first identity
    record(combos[1], 9),
    record(combos[2], 7), // no unused match: must create a new PLN
    record(combos[3], 11, { origin: 'temporary' }),
    record(combos[4], 900, { productModelId: 'other' }),
    record(combos[5], 13, { identityKey: 'removed-combination', status: 'retired', retiredTime: 'old' }),
    record(combos[6], 14, { planningId: 'PLN-invalid-999999', identityKey: 'removed-active' }),
  ]
  const duplicates = compare('ordered duplicate identities / duplicate PLN / retired recovery / temporary / global max', mixed)
  assert.equal(duplicates.result.records[0].status, 'active')
  assert.equal(duplicates.result.records[0].retiredTime, undefined)
  assert.equal(duplicates.result.records[1].status, 'retired')
  assert.equal(duplicates.result.records[0].originModelVersionId, 'v1')
  assert.deepStrictEqual(duplicates.result.records[0].modelVersionIds, ['v0', 'v1', 'v2'])
  assert.equal(duplicates.result.records[mixed.planningRecords.length].planningId, 'PLN-000901')
  // Existing UI deliberately shows the last identity match; reconcile deliberately uses the first unused one.
  assert.equal(after.previewDraftCombinations(mixed, 'm', mixed.productSpecNodes).rows[0].planningId, 'PLN-000008')

  const removed = clone(mixed)
  removed.productSpecNodes = removed.productSpecNodes.filter((node) => node.id !== 'v0-0-0')
  removed.planningRecords = duplicates.result.records
  removed.specModelVersions.push(version(removed.productSpecNodes, 'v2', 2))
  const retired = compare('removed paths and retained history', removed)
  const restored = clone(initial)
  restored.planningRecords = retired.result.records
  restored.specModelVersions = removed.specModelVersions
  compare('restore original path after retirement', restored)

  const reordered = clone(mixed)
  reordered.productSpecNodes.reverse()
  reordered.productSpecNodes.forEach((node) => { node.sort = 1 })
  reordered.params[0].name = 'Renamed model'
  reordered.params.push({ ...reordered.params[0], name: 'Ignored duplicate name' })
  reordered.templateParams.push({ ...reordered.templateParams[0], role: 'common' })
  compare('stable equal-sort ordering / display rename / first dictionary and binding wins', reordered)

  const wrapped = fixture(1, 1, 2, 2)
  wrapped.productSpecNodes.find((node) => node.id === 'model').parentId = 'wrapper15'
  for (let i = 0; i < 16; i++) wrapped.productSpecNodes.push({
    id: `wrapper${i}`, parentId: i ? `wrapper${i - 1}` : null,
    templateId: 'm', nodeType: 'ATTRIBUTE', attributeId: 'model', valueId: '', sort: 0,
  })
  compare('ATTRIBUTE → ATTRIBUTE chain and ancestor lookup', wrapped)

  const duplicateNode = fixture(1, 1, 2, 1)
  duplicateNode.productSpecNodes.push({ ...duplicateNode.productSpecNodes.find((node) => node.id === 'v0-0-0') })
  compare('duplicate raw identity is deduplicated in first occurrence order', duplicateNode)
  duplicateNode.productSpecNodes.at(-1).valueId = ''
  compare('legacy duplicate node ID with per-path empty-value fallback', duplicateNode, false)

  const empty = fixture()
  empty.productSpecNodes = []
  compare('empty draft', empty)
  const invalid = fixture()
  invalid.productSpecNodes.push({ id: 'orphan', templateId: 'm', parentId: 'missing', nodeType: 'ATTRIBUTE', attributeId: 'color', valueId: '', sort: 0 })
  compare('invalid draft retains published count and blocks preview', invalid)

  let random = 20261022
  const next = (max) => { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; return random % max }
  for (let i = 0; i < 40; i++) {
    const data = fixture(1 + next(3), 1 + next(3), 1 + next(3), 1 + next(3))
    data.productSpecNodes.forEach((node) => {
      node.sort = next(3)
      if (node.nodeType === 'ATTRIBUTE') node.role = [undefined, 'COMMON', 'VARIANT'][next(3)]
    })
    const paths = before.legalPlanningCombinations(data, 'm', data.productSpecNodes)
    data.planningRecords = paths.filter(() => next(3) !== 0).map((combo, index) => record(combo, index + 1, {
      status: next(2) ? 'active' : 'retired', ...(next(4) ? {} : { origin: 'temporary' }),
    }))
    data.specModelVersions = [version(data.productSpecNodes)]
    compare(`seeded differential ${i + 1}`, data)
    const foreign = data.productSpecNodes.map((node) => ({ ...node, templateId: 'foreign' }))
    assert.deepStrictEqual(after.legalPlanningCombinations(data, 'm', foreign), before.legalPlanningCombinations(data, 'm', foreign))
    assert.deepStrictEqual(after.legalPlanningCombinations(data, 'm', [...data.productSpecNodes, ...foreign]),
      before.legalPlanningCombinations(data, 'm', [...data.productSpecNodes, ...foreign]))
  }

  const { createSeed } = await server.ssrLoadModule('/src/domain/seed.ts')
  const seed = freeze(createSeed())
  seed.productPlans.forEach((plan) => assert.deepStrictEqual(after.logic.planSkuLines(seed, plan), before.logic.planSkuLines(seed, plan)))
  checks.push(`seed V2 planSkuLines (${seed.productPlans.length} plans)`)
  const editable = fixture()
  const oldKeys = after.legalPlanningCombinations(editable, 'm', editable.productSpecNodes).map((combo) => combo.identityKey)
  editable.productSpecNodes.find((node) => node.id === 'pack0').valueId = 'edited'
  const newKeys = after.legalPlanningCombinations(editable, 'm', editable.productSpecNodes).map((combo) => combo.identityKey)
  assert.notDeepStrictEqual(newKeys, oldKeys)
  assert.deepStrictEqual(newKeys, before.legalPlanningCombinations(editable, 'm', editable.productSpecNodes).map((combo) => combo.identityKey))
  checks.push('editing the same input objects does not reuse stale cached data')
  console.log(`PASS ${checks.length} differential groups (full order/content, preview, reconcile, trace, immutability, V2)`)

  const samples = [
    { name: 'small', dimensions: [2, 2, 2, 2], history: 32, batch: 20 },
    { name: 'medium', dimensions: [6, 4, 4, 4], history: 1500, batch: 3 },
    { name: 'large', dimensions: [12, 6, 6, 8], history: 12000, batch: 1 },
  ]
  const operations = {
    combinations: (implementation, data) => implementation.legalPlanningCombinations(data, 'm', data.productSpecNodes),
    preview: (implementation, data) => implementation.previewDraftCombinations(data, 'm', data.productSpecNodes),
    reconcile: (implementation, data) => implementation.reconcilePlanningRecords(reconcileInput(data)),
  }
  const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
  let sink = 0
  for (const sample of samples) {
    const data = benchmarkFixture(before, sample.dimensions, sample.history)
    const inputBefore = JSON.stringify(data)
    const count = before.legalPlanningCombinations(data, 'm', data.productSpecNodes).length
    const result = { ...sample, nodes: data.productSpecNodes.length, depth: 6, combinations: count, operations: {} }
    for (const [name, operation] of Object.entries(operations)) {
      assert.deepStrictEqual(operation(after, data), operation(before, data), `${sample.name}: ${name}`)
      const timings = { before: [], after: [] }
      for (let round = -2; round < 7; round++) {
        for (const side of round % 2 ? ['after', 'before'] : ['before', 'after']) {
          global.gc?.()
          const start = performance.now()
          for (let batch = 0; batch < sample.batch; batch++) {
            const value = operation(side === 'before' ? before : after, data)
            sink += value.length ?? value.rows?.length ?? value.records.length
          }
          const elapsed = (performance.now() - start) / sample.batch
          if (round >= 0) timings[side].push(elapsed)
        }
      }
      result.operations[name] = { beforeMs: median(timings.before), afterMs: median(timings.after), runsMs: timings }
      console.log(`${sample.name} ${name}: ${result.operations[name].beforeMs.toFixed(3)} -> ${result.operations[name].afterMs.toFixed(3)} ms`)
    }
    assert.equal(JSON.stringify(data), inputBefore, `${sample.name}: repeated timings must not mutate input`)
    measured.push(result)
  }
  assert.ok(sink > 0)
} finally {
  await server.close()
}

// Instrument separate module instances only after timings. No counters ship in application code.
function instrument(code) {
  const count = (name) => `globalThis.__planningMetrics.${name}++`
  code = code.replace(/(export function legalPlanningCombinations[^\n]+\{)/,
    `$1\n${count('legalCalls')}; if (nodes === globalThis.__planningDraftNodes) ${count('draftLegalCalls')};`)
  code = code.replace('const combinations = legalPlanningCombinations(input.data',
    `${count('reconcileCalls')}; globalThis.__planningMetrics.recordCopies += input.records.length;\n  const combinations = legalPlanningCombinations(input.data`)
  code = code.replace(/(function (?:nextPlanningId|maxPlanningNumber)\(records: PlanningRecord\[\]\) \{)/,
    `$1\n${count('maxScans')};`)
  code = code.replace('const matched = /^PLN-', `${count('numberRecordsExamined')}; const matched = /^PLN-`)
  code = code.replace('const planningId = ', `${count('allocatedNumbers')}; const planningId = `)
  code = code.replace('let cursor = byId.get(valueNodeId)', `${count('ancestorLookups')}; let cursor = byId.get(valueNodeId)`)
  code = code.replace('nodes.forEach((node) => {', `nodes.forEach((node) => { ${count('nodeIndexEntries')};`)
  code = code.replaceAll('item.parentId === parentId &&', `(${count('childChecks')}, item.parentId === parentId) &&`)
  code = code.replaceAll('item.parentId === attribute.id &&', `(${count('childChecks')}, item.parentId === attribute.id) &&`)
  code = code.replace(".filter((item) => item.nodeType === 'ATTRIBUTE' && accepts(item))",
    `.filter((item) => (${count('childChecks')}, item.nodeType === 'ATTRIBUTE') && accepts(item))`)
  code = code.replace(".filter((item) => item.nodeType === 'VALUE')",
    `.filter((item) => (${count('childChecks')}, item.nodeType === 'VALUE'))`)
  code = code.replace('item.identityKey === combo.identityKey &&', `(${count('matchCandidates')}, item.identityKey === combo.identityKey) &&`)
  code = code.replace('.find((item) => !used.has(item.planningId))', `.find((item) => (${count('matchCandidates')}, !used.has(item.planningId)))`)
  return code
}

const counted = await loadImplementations(instrument)
const counters = {}
try {
  const data = benchmarkFixture(before, [6, 4, 4, 4], 1500)
  for (const side of ['before', 'after']) {
    counters[side] = {}
    for (const operation of ['preview', 'reconcile']) {
      globalThis.__planningMetrics = Object.fromEntries([
        'legalCalls', 'draftLegalCalls', 'reconcileCalls', 'recordCopies', 'maxScans',
        'numberRecordsExamined', 'allocatedNumbers', 'ancestorLookups', 'nodeIndexEntries', 'childChecks', 'matchCandidates',
      ].map((key) => [key, 0]))
      globalThis.__planningDraftNodes = data.productSpecNodes
      if (operation === 'preview') counted[side].previewDraftCombinations(data, 'm', data.productSpecNodes)
      else counted[side].reconcilePlanningRecords(reconcileInput(data))
      counters[side][operation] = { ...globalThis.__planningMetrics }
    }
  }
  assert.equal(counters.before.preview.draftLegalCalls, 2)
  assert.equal(counters.after.preview.draftLegalCalls, 1)
  for (const name of ['reconcileCalls', 'recordCopies', 'maxScans', 'allocatedNumbers']) assert.equal(counters.after.preview[name], 0)
  assert.equal(counters.before.reconcile.maxScans, 192)
  assert.equal(counters.after.reconcile.maxScans, 1)
  assert.ok(counters.after.reconcile.childChecks < counters.before.reconcile.childChecks)
  assert.ok(counters.after.reconcile.matchCandidates < counters.before.reconcile.matchCandidates)
  assert.ok(counters.after.reconcile.ancestorLookups < counters.before.reconcile.ancestorLookups)
  console.log('PASS separate instrumentation', JSON.stringify(counters))
} finally {
  await counted.server.close()
  delete globalThis.__planningMetrics
  delete globalThis.__planningDraftNodes
}

const report = {
  baseline: BASELINE, environment: { node: process.version, platform: platform(), release: release(),
    cpu: cpus()[0]?.model, logicalCpus: cpus().length, memoryGiB: +(totalmem() / 2 ** 30).toFixed(1) },
  method: { warmups: 2, repetitions: 7, alternatingOrder: true, manualGc: Boolean(global.gc),
    time: NOW, timing: 'Uninstrumented Vite SSR modules; fixture creation and equality checks excluded; ms per call; median of 7 batch means' },
  checks, measured, counters,
}
writeFileSync(resolve(outputDir, 'performance.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log('PASS performance evidence written to work/performance-round1/performance.json')
