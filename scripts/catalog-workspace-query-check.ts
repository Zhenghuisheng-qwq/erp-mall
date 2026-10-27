import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import { buildCatalogWorkspaceIndex, type CatalogMetricKind } from '../src/domain/catalogWorkspaceQuery'
import { createCatalogIdentityContext } from '../src/domain/catalogIdentity'
import { inspectFamily } from '../src/domain/logic'
import { createCatalogWorkspaceFixture, catalogCategory, catalogFamily, catalogModel, catalogSku, catalogType, catalogVersion } from './catalog-workspace-fixtures'

let groups = 0
const mark = (message: string) => console.log(`PASS ${++groups}: ${message}`)
const sorted = (values: readonly string[]) => [...values].sort()
const data = createCatalogWorkspaceFixture(), before = JSON.stringify(data)
const index = buildCatalogWorkspaceIndex(data)
const root = index.scope({ categoryId: 'root' }).metrics, direct = index.scope({ categoryId: 'root', includeDescendants: false }).metrics
assert.deepEqual(sorted(direct.spus.ids), ['spu-parent'])
assert.deepEqual(sorted(direct.skus.ids), ['sku-parent'])
assert.deepEqual(sorted(root.spus.ids), ['spu-bad-source', 'spu-child', 'spu-legacy', 'spu-material-only', 'spu-mixed', 'spu-parent'])
assert.deepEqual(sorted(root.skus.ids), ['sku-child', 'sku-legacy', 'sku-mixed', 'sku-parent'])
assert.deepEqual(sorted(root.materials.ids), ['mat-mixed', 'mat-one', 'mat-two'])
assert.deepEqual(sorted(root.types.ids), ['type-case', 'type-multi', 'type-phone'])
assert.equal(index.categoryMetrics('root').spus.count, root.spus.count)
mark('parent scope unions actual IDs, own-level products remain counted, explicit multiple type links deduplicate without inheritance')

assert.equal(index.scope().metrics.models.count, 6)
assert.equal(index.modelRows.filter(row => row.name === '同名模型').length, 2)
assert.equal(index.typeRows.filter(row => row.name === '同名类型').length, 2)
assert.equal(index.modelRows.find(row => row.id === 'model-phone')!.publishedVersions.length, 2)
assert.equal(index.modelRows.find(row => row.id === 'model-phone')!.status, 'published-draft')
assert.equal(index.modelRows.find(row => row.id === 'model-empty')!.latestPublishedVersion, undefined)
assert(!index.modelRows.some(row => row.id === 'scheme-only'))
assert(!index.issues.some(row => row.recordId === 'empty'))
assert(index.issues.filter(row => row.recordId === 'model-empty').every(row => row.level === 'incomplete'))
mark('same-name IDs stay distinct; draft plus multiple versions counts once; empty stages do not become errors or fabricated V1')

const identity = createCatalogIdentityContext(data), all = index.scope().metrics
assert.deepEqual(sorted(all.spus.ids), sorted(data.families.map(row => row.id)))
assert.deepEqual(sorted(all.skus.ids), sorted(data.skus.filter(identity.isRealSku).map(row => row.id)))
assert.deepEqual(sorted(all.materials.ids), sorted(data.skus.filter(identity.isMaterialArchive).map(row => row.id)))
assert.equal(all.materials.count, 4)
assert(!all.skus.ids.includes('sku-orphan')); assert(all.pending.ids.includes('skus:sku-orphan'))
assert.deepEqual(sorted(index.modelMetrics('model-phone').materials.ids), ['mat-mixed', 'mat-one', 'mat-two'])
assert(index.modelMetrics('model-phone').spus.ids.includes('spu-mixed'))
mark('Family SPU totals match existing product-subject definition; same PLN multiple MAT and mixed Family never inflate real SKU counts')

for (const kind of ['types', 'models', 'spus', 'skus', 'materials', 'pending'] as CatalogMetricKind[]) {
  for (const metrics of [all, root, direct, index.unassigned, index.typeMetrics('type-phone'), index.modelMetrics('model-phone')]) {
    assert.equal(index.details(kind, metrics[kind].ids).length, metrics[kind].count)
    assert.deepEqual(sorted(index.details(kind, metrics[kind].ids).map(row => row.id)), sorted(metrics[kind].ids))
  }
}
const pending = index.details('pending', all.pending.ids)
assert(pending.some(row => row.issues.length > 1))
assert(pending.reduce((n, row) => n + row.issues.length, 0) > all.pending.count!)
assert(index.unassigned.spus.ids.includes('spu-unassigned')); assert(index.unassigned.spus.ids.includes('spu-bad-category'))
assert(index.unassigned.models.ids.includes('model-orphan')); assert(index.unassigned.types.ids.includes('type-orphan'))
assert(!index.scope({ categoryId: 'gone' }).valid); assert.equal(index.scope({ categoryId: 'gone' }).metrics.spus.count, 0)
mark('every count opens the exact stable object set; unassigned and invalid references stay visible; missing scope never falls back to all')

const legacy = index.details('spus', ['spu-legacy'])[0]!
assert.equal(legacy.modelId, ''); assert.equal(legacy.productTypeId, ''); assert.match(legacy.sourceText, /模型来源未记录/)
const relocated = structuredClone(data)
relocated.specCanvases.find(row => row.templateId === 'model-phone')!.productTypeId = 'type-case'
const moved = buildCatalogWorkspaceIndex(relocated)
assert(moved.scope({ categoryId: 'case', includeDescendants: false }).metrics.models.ids.includes('model-phone'))
assert(!moved.scope({ categoryId: 'case', includeDescendants: false }).metrics.spus.ids.includes('spu-parent'))
assert(moved.typeMetrics('type-phone').spus.ids.includes('spu-parent'))
assert(!moved.typeMetrics('type-case').skus.ids.includes('sku-parent'))
assert.match(moved.details('spus', ['spu-parent'])[0]!.sourceText, /phone-v1|已发布 V1/)
const own = structuredClone(data); own.skus.find(row => row.id === 'sku-child')!.creationSource = { kind: 'model', templateId: 'model-case', modelVersionId: 'case-v1', createdAt: '2026-10-27' }
const ownIndex = buildCatalogWorkspaceIndex(own)
assert(ownIndex.modelMetrics('model-case').skus.ids.includes('sku-child')); assert(!ownIndex.modelMetrics('model-phone').skus.ids.includes('sku-child'))
assert(!ownIndex.typeMetrics('type-phone').skus.ids.includes('sku-child')); assert(!ownIndex.typeMetrics('type-case').skus.ids.includes('sku-child'))
assert.match(ownIndex.details('skus', ['sku-child'])[0]!.sourceText, /类型来源未记录/)
const associationOnly = structuredClone(data)
associationOnly.families.push(catalogFamily('association-only', 'leaf', { templateId: 'model-phone' }))
associationOnly.skus.push(catalogSku('sku-scheme-only', 'spu-legacy', { creationSource: { kind: 'template', templateId: 'scheme-only', modelVersionId: '', createdAt: '2026-10-27' } }))
const associationIndex = buildCatalogWorkspaceIndex(associationOnly)
assert.match(associationIndex.details('spus', ['association-only'])[0]!.sourceText, /模型关联 model-phone（创建来源未记录）/)
assert(!associationIndex.issues.some(issue => issue.recordId === 'sku-scheme-only' && issue.code === 'source-model-invalid'))
mark('current model ownership, actual product category and per-record historical source are independent; per-SKU source wins without rewriting history')

assert.equal(index.details('materials', ['mat-one'])[0]!.route, '/materials/spu-material-only?sku=mat-one')
assert.equal(index.details('materials', ['mat-mixed'])[0]!.route, undefined)
assert.match(index.details('materials', ['mat-mixed'])[0]!.routeUnavailableReason!, /只读明细/)
assert.equal(index.details('materials', ['mat-orphan'])[0]!.route, undefined)
assert.equal(index.details('pending', ['skus:sku-orphan'])[0]!.recordId, 'sku-orphan')
mark('material management links use the actual Family ID and selected MAT; unsupported legacy subjects stay in accurate read-only detail')

for (const [resource, viewKind] of [['category', 'categories'], ['type', 'types'], ['model', 'models']] as const) {
  const limited = buildCatalogWorkspaceIndex(data, code => code === `product:${resource}:read`)
  assert.equal(limited.categories.length > 0, viewKind === 'categories')
  assert.equal(limited.typeRows.length > 0, viewKind === 'types')
  assert.equal(limited.modelRows.length > 0, viewKind === 'models')
  for (const kind of ['spus', 'skus', 'materials'] as const) { assert.equal(limited.scope().metrics[kind].count, null); assert.deepEqual(limited.details(kind, all[kind].ids), []) }
  if (resource !== 'category') { assert(!limited.scope({ categoryId: 'root' }).valid); assert(!JSON.stringify(limited.typeRows).includes('手机目录')); assert(!JSON.stringify(limited.modelRows).includes('手机目录')) }
  if (resource === 'category') { assert.equal(limited.typeMetrics('type-phone').spus.count, null); assert.equal(limited.modelMetrics('model-phone').models.count, null) }
}
const forbidden = buildCatalogWorkspaceIndex(data, () => false)
assert.deepEqual(forbidden.issues, []); assert.equal(forbidden.scope().metrics.pending.count, null)
assert.equal(JSON.stringify(data), before)
mark('independent read masks do not leak names, counts or detail IDs; opening and querying leave all business arrays unchanged')

const quality = structuredClone(data), family = quality.families.find(row => row.id === 'spu-child')!
family.name = ''
const existing = inspectFamily(quality, family, quality.skus.filter(row => row.familyId === family.id))
const checked = buildCatalogWorkspaceIndex(quality)
for (const issue of existing) assert(checked.issues.some(row => row.message === issue.message))
mark('quality messages reuse existing validation output; affected-record count is distinct from issue count')

const large = createCatalogWorkspaceFixture(); large.categories = []; large.productTypes = []; large.templates = []; large.specCanvases = []; large.specModelVersions = []; large.families = []; large.skus = []; large.productSpecNodes = []; large.planningRecords = []
for (let i = 0; i < 160; i++) large.categories.push(catalogCategory(`c-${i}`, i ? `c-${Math.floor((i - 1) / 4)}` : null))
for (let i = 0; i < 600; i++) { large.productTypes.push(catalogType(`t-${i}`, `c-${i % 160}`)); large.specCanvases.push(catalogModel(`m-${i}`, `t-${i}`)); large.specModelVersions.push(catalogVersion(`m-${i}`, `v-${i}`)); large.templates.push({ id: `m-${i}`, name: `m-${i}`, parentId: null, enabled: true, structureOrder: [] }) }
for (let i = 0; i < 1800; i++) { const m = i % 600; large.families.push(catalogFamily(`f-${i}`, `c-${i % 160}`, { line: 'v3', templateId: `m-${m}`, productModelId: `m-${m}`, productTypeId: `t-${m}`, modelVersionId: `v-${m}` })); for (let j = 0; j < 20; j++) large.skus.push(catalogSku(`s-${i}-${j}`, `f-${i}`, j % 3 ? { modelVersionId: `v-${m}` } : { recordKind: 'material', materialCode: `MAT-${i}-${j}`, modelVersionId: `v-${m}` })) }
const started = performance.now(), bulk = buildCatalogWorkspaceIndex(large), indexed = performance.now()
for (let i = 0; i < 160; i++) bulk.categoryMetrics(`c-${i}`)
const queried = performance.now()
assert.equal(bulk.scope().metrics.skus.count, 23400); assert.equal(bulk.scope().metrics.materials.count, 12600); assert.equal(bulk.categoryMetrics('c-0').spus.count, 1800)
assert(indexed - started < 6000); assert(queried - indexed < 3000)
console.log(`PERF: 160 categories, 600 types/models, 1800 Family, 36000 SKU/MAT: index ${Math.round(indexed-started)} ms; all category aggregates ${Math.round(queried-indexed)} ms`)
mark('large catalog uses shared indexes and ID unions; no legal-combination expansion during aggregation')
console.log(`Catalog workspace query checks: ${groups} groups passed`)
