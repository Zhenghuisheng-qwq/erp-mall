import assert from 'node:assert/strict'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { platform, release, arch, cpus } from 'node:os'
import { performance } from 'node:perf_hooks'
import { createSeed } from '../src/domain/seed'
import { querySkuWorkbench } from '../src/domain/skuWorkbenchQuery'
import { presentTableGroups } from '../src/components/product-list/tablePresentation'
import { skuFieldValue } from '../src/domain/skuWorkbenchFields'
import type { SkuViewConfig } from '../src/domain/skuWorkbenchTypes'
import type { Sku } from '../src/domain/types'

const now = '2026-10-22T04:00:00Z'
const warmups = 2, repetitions = 9
function median(values: number[]) { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)] || 0 }
const samples = [100, 10000].map(count => {
  const data = createSeed()
  const source = data.families[0]
  assert.ok(source)
  data.families = Array.from({ length: 10 }, (_, i) => ({ ...source, id: `spu-${i}`, templateId: 'performance', name: `样本主体 ${i}`, productGroupIds: [], commonAttrs: {}, updatedAt: now }))
  data.params = [{ id: 'sample-color', name: '颜色', values: ['白色', '黑色'], valueGroups: [], participateInStructure: true }, { id: 'sample-capacity', name: '容量', values: ['256GB', '512GB'], valueGroups: [], participateInStructure: true }]
  data.templateParams = data.params.map(param => ({ templateId: 'performance', paramId: param.id, role: 'variant', required: false }))
  data.skus = Array.from({ length: count }, (_, i): Sku => ({
    id: `sku-${String(i).padStart(6, '0')}`, familyId: `spu-${i % 10}`, recordKind: 'sku', code: `SKU-${i}`, oaSkuId: '', skuName: `样本规格 ${i}`, status: 'on_sale',
    variantAttrs: { 颜色: i % 2 ? '黑色' : '白色', 容量: i % 4 < 2 ? '256GB' : '512GB' }, projectedAttrs: {}, createdAt: now, updatedAt: now,
  }))
  data.materialReceipts = []; data.planningRecords = []
  const config: SkuViewConfig = {
    version: 1, conditions: { kind: 'group', id: 'all', logic: 'all', children: [{ kind: 'rule', id: 'color', field: 'attr:sample-color', operator: 'eq', value: '白色' }] },
    columns: [{ key: 'code', visible: true }, { key: 'name', visible: true }, { key: 'attr:sample-color', visible: true }, { key: 'attr:sample-capacity', visible: true }],
    sorts: [{ field: 'attr:sample-capacity', direction: 'asc' }, { field: 'name', direction: 'asc' }], groups: [{ field: 'familyId', direction: 'asc' }], density: 'comfortable', sortMode: 'field', manualOrder: [], categoryLayout: 'popover',
  }
  const queryMs: number[] = [], pagePresentationMs: number[] = []
  for (let repeat = -warmups; repeat < repetitions; repeat++) {
    const start = performance.now()
    const result = querySkuWorkbench(data, config, { now, page: 1, pageSize: 50 })
    const queried = performance.now()
    assert.deepEqual(result.errors, [])
    assert.equal(result.total, count / 2)
    assert.equal(result.rows.length, Math.min(50, count / 2))
    assert.equal(new Set(result.allIds).size, count / 2)
    assert.ok(result.allIds.every(id => Number(id.slice(4)) % 2 === 0), 'Fixture independent expectation: only even IDs have white color')
    const presentationStart = performance.now()
    presentTableGroups(data, result.groups.map(group => ({ key: group.key, label: group.labels.join(' / '), total: group.total, rows: group.rows })))
    for (const row of result.rows) for (const column of config.columns) skuFieldValue(data, row.sku, row.family, column.key)
    const presented = performance.now()
    if (repeat >= 0) { queryMs.push(queried - start); pagePresentationMs.push(presented - presentationStart) }
  }
  return { skuCount: count, spuCount: data.families.length, dynamicFieldCount: data.params.length, conditionCount: 1, sortCount: 2, groupLevels: 1, matchingCount: count / 2, pageSize: 50, queryMedianMs: median(queryMs), pagePresentationMedianMs: median(pagePresentationMs), queryMs, pagePresentationMs }
})
const output = process.env.SKU_WORKBENCH_PERFORMANCE_OUTPUT || 'work/sku-workbench/performance.json'
mkdirSync(dirname(output), { recursive: true })
const result = { result: 'PASS', environment: { node: process.version, platform: platform(), release: release(), arch: arch(), cpu: cpus()[0]?.model || 'unknown' }, businessTime: now, warmups, repetitions, method: 'Node performance.now; query and current-page field presentation timed separately; assertion cost excluded from both intervals; no browser/full-page timing or prior-speedup claim', samples }
writeFileSync(output, JSON.stringify(result, null, 2))
console.log(JSON.stringify(result, null, 2))
