import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { arch, cpus, platform } from 'node:os'
import { performance } from 'node:perf_hooks'
import { createTemplateCompatibilityContext, freezeTemplateCompatibility } from '../src/domain/templateCompatibility'
import { materializeTemplateCompatibility, previewTemplateCompatibilitySync } from '../src/domain/templateCompatibilitySync'
import { createTemplateCompatibilityFixture, TEMPLATE_COMPATIBILITY_TIME } from './template-compatibility-fixtures'
import type { AppData, ProductFamily, Sku } from '../src/domain/types'

const samples = [
  { name: 'small', styles: 2, colors: 2, packs: 2, targets: 8, historyPlanning: 0, historyDeclarations: 100, historyReceipts: 100 },
  { name: 'medium', styles: 8, colors: 16, packs: 4, targets: 32, historyPlanning: 1000, historyDeclarations: 2000, historyReceipts: 1000 },
  { name: 'large', styles: 16, colors: 32, packs: 8, targets: 64, historyPlanning: 10000, historyDeclarations: 10000, historyReceipts: 10000 },
]
const median = (times: number[]) => [...times].sort((a, b) => a - b)[Math.floor(times.length / 2)]!
const results = []
for (const sample of samples) {
  const { data, modelId, versionId, version } = createTemplateCompatibilityFixture(sample)
  const context = createTemplateCompatibilityContext(data, { modelId, versionId }), combinations = context.combinations
  const history = data.compatibilities[0]!, historyTargets = data.skus.filter(sku => sku.recordKind === 'sku' && data.families.find(family => family.id === sku.familyId)?.productTypeId?.startsWith('type-') && sku.familyId !== 'family-device' && sku.familyId !== 'family-unbound')
  for (let index = 0; index < sample.historyDeclarations; index++) {
    const target = historyTargets[index % historyTargets.length]!
    data.compatibilities.push({ ...structuredClone(history), id: `benchmark-history-${index}`, accessorySkuId: target.id, targetId: target.id, source: `独立历史资料 ${index}`, note: `独立历史说明 ${index}` })
  }
  data.materialReceipts = Array.from({ length: sample.historyReceipts }, (_, index) => ({ requestId: `deleted-history-request-${index}`, skuId: `deleted-history-material-${index}`, planningId: `PLN-${index + 100000}`, materialCode: `MAT-HISTORY-${index}`, createdTime: TEMPLATE_COMPATIBILITY_TIME, lifecycle: 'deleted' as const, deletedTime: TEMPLATE_COMPATIBILITY_TIME }))
  data.planningRecords = Array.from({ length: sample.historyPlanning }, (_, index) => { const combo = combinations[index % combinations.length]!; return { planningId: `PLN-${String(index + 1).padStart(5, '0')}`, productModelId: modelId, originModelVersionId: versionId, modelVersionId: versionId, modelVersionIds: [versionId], steps: structuredClone(combo.steps), identityKey: combo.identityKey, status: 'active' as const, createdTime: TEMPLATE_COMPATIBILITY_TIME } })
  const familyBase = data.families.find(family => family.id === 'family-case')!, skuBase = data.skus.find(sku => sku.id === 'case-sku')!, families = new Map<string, ProductFamily>(), ids: string[] = []
  for (let index = 0; index < sample.targets; index++) {
    const combo = combinations[Math.floor(index * combinations.length / sample.targets)]!, commonAttrs = Object.fromEntries(combo.steps.filter(step => step.role === 'common').map(step => [step.attributeName, step.valueId])), commonKey = JSON.stringify(commonAttrs)
    let family = families.get(commonKey)
    if (!family) { family = { ...structuredClone(familyBase), id: `batch-family-${families.size}`, templateId: modelId, productModelId: modelId, modelVersionId: versionId, commonAttrs }; families.set(commonKey, family); data.families.push(family) }
    const sku: Sku = { ...structuredClone(skuBase), id: `batch-object-${index}`, familyId: family.id, modelVersionId: versionId, sourceNodeIds: combo.steps.map(step => step.valueNodeId), variantAttrs: Object.fromEntries(combo.steps.filter(step => step.role === 'variant').map(step => [step.attributeName, step.valueId])), creationSource: { kind: 'model', templateId: modelId, modelVersionId: versionId, createdAt: TEMPLATE_COMPATIBILITY_TIME }, ...(index % 2 ? { recordKind: 'material' as const, materialCode: `BATCH-MAT-${index}` } : { recordKind: 'sku' as const }) }
    data.skus.push(sku); ids.push(sku.id)
  }
  const initial = JSON.stringify(data), materializeMs: number[] = [], syncMs: number[] = []
  let successful: AppData | undefined, materializeStats, syncStats
  for (let round = -1; round < 5; round++) {
    const trial = structuredClone(data); let nextId = 0
    const started = performance.now(), result = materializeTemplateCompatibility(trial, ids, () => `batch-declaration-${++nextId}`, TEMPLATE_COMPATIBILITY_TIME), elapsed = performance.now() - started
    assert.equal(result.ok, true, result.message); assert.equal(result.added, sample.targets); assert.equal(nextId, sample.targets)
    assert.equal(trial.templateCompatibilityOrigins?.length, sample.targets)
    assert.equal(result.stats?.combinationExpansions, 1)
    assert.equal(result.stats?.contextBuilds, 1)
    assert.equal(result.stats?.declarationScans, data.compatibilities.length)
    materializeStats = result.stats
    if (round >= 0) materializeMs.push(elapsed)
    successful = trial
  }
  assert.equal(JSON.stringify(data), initial)
  const syncData = successful!, nextVersion = structuredClone(version)
  nextVersion.id = 'batch-version-2'; nextVersion.version = 2; nextVersion.versionName = '独立性能 V2'; nextVersion.templateCompatibilitySnapshot = freezeTemplateCompatibility(syncData, modelId)
  nextVersion.templateCompatibilitySnapshot.config.defaultRule.claims.forEach(claim => { claim.note += ' V2更新' }); nextVersion.templateCompatibilitySnapshot.config.exceptions.forEach(rule => rule.claims.forEach(claim => { claim.note += ' V2更新' }))
  syncData.specModelVersions.push(nextVersion)
  const beforeSync = JSON.stringify(syncData)
  let counts
  for (let round = -1; round < 5; round++) {
    const started = performance.now(), preview = previewTemplateCompatibilitySync(syncData, { modelId, targetVersionId: nextVersion.id, targetIds: ids }), elapsed = performance.now() - started
    assert.equal(preview.counts.update, sample.targets); assert.equal(preview.counts.invalid, 0); assert.equal(preview.counts.conflict, 0)
    counts = preview.counts
    assert.equal(preview.stats?.combinationExpansions, 2)
    assert.equal(preview.stats?.contextBuilds, 2)
    assert.equal(preview.stats?.declarationScans, syncData.compatibilities.length)
    syncStats = preview.stats
    if (round >= 0) syncMs.push(elapsed)
  }
  assert.equal(JSON.stringify(syncData), beforeSync, 'sync preview is strictly read-only and allocates no ids')
  const result = { ...sample, nodes: data.productSpecNodes.length, depth: 4, combinations: combinations.length, existingSkus: data.skus.length - sample.targets, actualHistoryDeclarations: data.compatibilities.length, sourceVersionCount: 1, targetVersionCount: 1, measuredRounds: 5, warmupRounds: 1, materialize: { medianMs: median(materializeMs), samplesMs: materializeMs, added: sample.targets, stats: materializeStats }, syncPreview: { medianMs: median(syncMs), samplesMs: syncMs, counts, stats: syncStats } }
  results.push(result); console.log(JSON.stringify(result))
}
mkdirSync('work/template-compatibility', { recursive: true })
writeFileSync('work/template-compatibility/batch-performance.json', JSON.stringify({ executedAt: new Date().toISOString(), environment: { node: process.version, platform: platform(), arch: arch(), cpu: cpus()[0]?.model }, fixedBusinessTime: TEMPLATE_COMPATIBILITY_TIME, method: 'Real batch materialization and read-only three-way sync preview, one warmup and five measured runs. Full independent data clone occurs outside materialization timing. Every batch mixes separate SKU/MAT targets; history arrays, IDs and business time fixed. All created rows and sync update counts asserted, with untouched input and read-only preview asserted. This records the new feature cost, not a comparison to the pre-feature application.', results }, null, 2))
