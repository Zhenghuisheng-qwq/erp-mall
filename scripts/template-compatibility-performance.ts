import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { arch, cpus, platform, totalmem } from 'node:os'
import { performance } from 'node:perf_hooks'
import { createTemplateCompatibilityContext, resolveTemplateCompatibility, selectorForNode } from '../src/domain/templateCompatibility'
import { createTemplateCompatibilityFixture, TEMPLATE_COMPATIBILITY_TIME } from './template-compatibility-fixtures'
import type { TemplateCompatibilityContext } from '../src/domain/templateCompatibility'
import type { AppData } from '../src/domain/types'

/** Same new feature/resolver in both cases: repeated construction versus operation-local reuse. */
const samples = [
  { name: 'small', styles: 2, colors: 2, packs: 2, targets: 8, history: 0 },
  { name: 'medium', styles: 8, colors: 16, packs: 4, targets: 32, history: 1000 },
  { name: 'large', styles: 16, colors: 32, packs: 8, targets: 64, history: 10000 },
]
const rounds = 5
function median(values: number[]) { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)]! }
function depthOf(data: AppData) {
  const byId = new Map(data.productSpecNodes.map(node => [node.id, node]))
  return Math.max(...data.productSpecNodes.map(node => { let depth = 1, cursor = node; const seen = new Set([node.id]); while (cursor.parentId && !seen.has(cursor.parentId)) { const parent = byId.get(cursor.parentId); if (!parent) break; depth++; seen.add(parent.id); cursor = parent } return depth }))
}
function emptyStats(): TemplateCompatibilityContext['stats'] { return { combinationExpansions: 0, selectorGroups: 0, selectorIndexLookups: 0, claimValidations: 0, resolvedRows: 0 } }
function addStats(to: TemplateCompatibilityContext['stats'], from: TemplateCompatibilityContext['stats']) { for (const key of Object.keys(to) as (keyof typeof to)[]) to[key] += from[key] }
const results = []
for (const sample of samples) {
  const { data, modelId, versionId, config, claim } = createTemplateCompatibilityFixture(sample)
  let context = createTemplateCompatibilityContext(data, { modelId })
  config.exceptions = Array.from({ length: sample.styles }, (_, style) => ({ id: `benchmark-rule-${style}`, name: `款式 ${style + 1}`, selector: selectorForNode(context, `compat-style-${style}`).selector!, claims: [claim(`benchmark-claim-${style}`)] }))
  context = createTemplateCompatibilityContext(data, { modelId })
  const combinations = context.combinations
  data.planningRecords = Array.from({ length: sample.history }, (_, index) => {
    const combo = combinations[index % combinations.length]!
    return { planningId: `PLN-${String(index + 1).padStart(5, '0')}`, productModelId: modelId, originModelVersionId: versionId, modelVersionId: versionId, modelVersionIds: [versionId], steps: structuredClone(combo.steps), identityKey: combo.identityKey, status: index % 3 ? 'active' as const : 'retired' as const, createdTime: TEMPLATE_COMPATIBILITY_TIME }
  })
  const keys = Array.from({ length: sample.targets }, (_, index) => combinations[Math.floor(index * combinations.length / sample.targets)]!.identityKey)
  const inputText = JSON.stringify(data)
  function repeated() {
    const stats = emptyStats(), rows = []
    for (const key of keys) { const current = createTemplateCompatibilityContext(data, { modelId }); rows.push(resolveTemplateCompatibility(current, key)); addStats(stats, current.stats) }
    return { rows, stats }
  }
  function shared() {
    const current = createTemplateCompatibilityContext(data, { modelId })
    return { rows: keys.map(key => resolveTemplateCompatibility(current, key)), stats: current.stats }
  }
  assert.deepEqual(repeated().rows, shared().rows, 'repeated and reused operation must have identical complete results')
  const repeatedMs: number[] = [], sharedMs: number[] = []
  let repeatedStats = emptyStats(), sharedStats = emptyStats()
  for (let round = 0; round < rounds; round++) {
    const functions = round % 2 ? [shared, repeated] : [repeated, shared]
    for (const run of functions) {
      const start = performance.now(), output = run(), elapsed = performance.now() - start
      if (run === repeated) { repeatedMs.push(elapsed); repeatedStats = output.stats } else { sharedMs.push(elapsed); sharedStats = output.stats }
    }
  }
  assert.equal(JSON.stringify(data), inputText)
  assert.equal(repeatedStats.combinationExpansions, sample.targets); assert.equal(sharedStats.combinationExpansions, 1)
  const result = { ...sample, nodes: data.productSpecNodes.length, depth: depthOf(data), combinations: combinations.length, exceptionRules: config.exceptions.length, claims: config.exceptions.length + config.defaultRule.claims.length, measuredRounds: rounds, warmupRounds: 1, repeatedContext: { medianMs: median(repeatedMs), samplesMs: repeatedMs, stats: repeatedStats }, sharedContext: { medianMs: median(sharedMs), samplesMs: sharedMs, stats: sharedStats } }
  results.push(result)
  console.log(JSON.stringify(result))
}
mkdirSync('work/template-compatibility', { recursive: true })
writeFileSync('work/template-compatibility/performance.json', JSON.stringify({ executedAt: new Date().toISOString(), environment: { node: process.version, platform: platform(), arch: arch(), cpu: cpus()[0]?.model, logicalCpus: cpus().length, totalMemoryBytes: totalmem() }, fixedBusinessTime: TEMPLATE_COMPATIBILITY_TIME, method: 'New-feature equivalent-resolver control: construct an operation context for each selected object versus construct once for the selected batch. All legal combinations remain expanded, with no cap. The targets count is an independently selected batch, not the total combination count. No claim of performance improvement over a pre-feature implementation. Five alternating measured rounds after one warmup per strategy; medians in milliseconds. Fixtures, history, IDs and business time fixed; complete output and input preservation asserted.', results }, null, 2))
