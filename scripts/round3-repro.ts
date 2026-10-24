import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { functionalGapsFixture } from './functional-gaps-fixture'
import { defaultSkuConfig } from '../src/domain/skuWorkbenchState'
import { querySkuWorkbench } from '../src/domain/skuWorkbenchQuery'
import { createRefinementSyncFixture } from './compatibility-refinement-sync-fixtures'
import { markTemplateManualChanges, previewTemplateCompatibilitySync } from '../src/domain/templateCompatibilitySync'
if (!process.env.ROUND3_OUTPUT) throw Error('ROUND3_OUTPUT required')
const results = []
const { data } = functionalGapsFixture(), config = defaultSkuConfig()
config.conditions.children = [{ kind: 'rule', id: 'category-quick', field: 'category', operator: 'in', value: ['c-host'] }]
const exact = querySkuWorkbench(data, config).allIds
config.conditions.children[0]!.value = ['c-phone']
const leaf = querySkuWorkbench(data, config).allIds
assert(leaf.includes('gaps-a') && !exact.includes('gaps-a'))
results.push({ issue: 'A', observed: 'category shortcut uses exact in; selecting parent excludes child SKU', parentCount: exact.length, leafCount: leaf.length })
const f = createRefinementSyncFixture(['甲', '乙', '丙'])
const third = f.links().find(link => link.note === '丙')!
third.conclusion = 'incompatible'
markTemplateManualChanges(f.data, [{ kind: 'update', id: third.id }], '2026-10-24T12:00:00Z')
const version = f.publish(['合并', '合并', '丙'])
const plan = previewTemplateCompatibilitySync(f.data, { modelId: f.modelId, targetVersionId: version, targetIds: [f.sku.id] })
assert.equal(plan.items.find(item => item.group)?.group?.canAdopt, true)
results.push({ issue: 'B', observed: 'merge is adoptable despite outside-group modified template denial', declaration: third.id, provenance: third.provenance?.kind })
const source = readFileSync('src/components/template-compatibility/TemplateClaimSetEditor.vue', 'utf8')
assert(source.includes('pendingBatch=computed(()=>hostPicks.value.length>0)'))
results.push({ issue: 'C', level: 'source confirmation; browser reproduction follows', observed: 'pendingBatch only considers host selections; convertLegacy immediately replaces draft/editor selection' })
const output = resolve(process.env.ROUND3_OUTPUT)
mkdirSync(output, { recursive: true })
writeFileSync(resolve(output, 'baseline.json'), JSON.stringify(results, null, 2))
console.log(JSON.stringify(results))
