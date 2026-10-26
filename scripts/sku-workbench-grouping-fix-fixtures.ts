import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createSeed } from '../src/domain/seed'
import { querySkuWorkbench } from '../src/domain/skuWorkbenchQuery'
import { presentTableGroups } from '../src/components/product-list/tablePresentation'
import type { AppData, ProductFamily, Sku } from '../src/domain/types'
import type { SkuOrder, SkuViewConfig } from '../src/domain/skuWorkbenchTypes'

const now = '2026-10-23T04:00:00.000Z'
export function groupingFixData() {
  const data = createSeed()
  const source = data.families[0]
  assert.ok(source)
  const family = (id: string, templateId: string): ProductFamily => ({ ...source, id, name: id, templateId, commonAttrs: {}, productGroupIds: [], updatedAt: now, createdAt: now })
  data.params = [{ id: 'group-color', name: '颜色', values: ['白色', '黑色'], valueGroups: [], participateInStructure: true }]
  data.templateParams = [{ templateId: 'bound', paramId: 'group-color', role: 'variant', required: false }]
  data.families = [family('bound-family', 'bound'), family('unbound-family', 'unbound')]
  const sku = (id: string, familyId: string): Sku => ({ id, familyId, recordKind: 'sku', code: id, skuName: id, oaSkuId: '', status: 'on_sale', variantAttrs: {}, projectedAttrs: {}, createdAt: now, updatedAt: now })
  data.skus = [sku('s1', 'bound-family'), sku('s2', 'unbound-family'), sku('s3', 'bound-family')]
  data.materialReceipts = []; data.planningRecords = []
  return data
}
function groupingConfig(groups: SkuOrder[] = [{ field: 'attr:group-color', direction: 'asc' }]): SkuViewConfig {
  return { version: 1, conditions: { kind: 'group', id: 'root', logic: 'all', children: [] }, columns: [{ key: 'code', visible: true }], sorts: [], groups, density: 'comfortable', sortMode: 'default', manualOrder: [], categoryLayout: 'popover' }
}
export function consumeLikePage(data: AppData, result: ReturnType<typeof querySkuWorkbench>) {
  const formatted = new Map(presentTableGroups(data, result.groups.map(group => ({ ...group, label: group.labels.join(' / ') }))).map(group => [group.key, group.skus]))
  return result.groups.flatMap(group => (formatted.get(group.key) || []).map(row => row.id))
}
function pageInvariant(data: AppData, result: ReturnType<typeof querySkuWorkbench>) {
  assert.deepEqual(result.errors, [])
  const queryIds = result.rows.map(row => row.id), shown = consumeLikePage(data, result)
  assert.equal(new Set(result.groups.map(group => group.key)).size, result.groups.length, 'Each query group key must be unique before the page consumes its Map')
  assert.deepEqual(result.groups.flatMap(group => group.rows.map(row => row.id)), queryIds, 'Groups and current-page query rows must have the same order')
  assert.deepEqual(shown, queryIds, 'The actual presentation/Map consumption must show each query row once in order')
  assert.equal(new Set(shown).size, shown.length, 'No displayed SKU may be repeated')
  assert.equal(shown.length, queryIds.length)
  return shown
}
function assertPages(data: AppData, config: SkuViewConfig, expected: string[], sizes: number[]) {
  for (const pageSize of sizes) {
    const all: string[] = []
    const totalPages = Math.max(1, Math.ceil(expected.length / pageSize))
    for (let page = 1; page <= totalPages; page++) {
      const result = querySkuWorkbench(data, config, { now, page, pageSize })
      assert.equal(result.total, expected.length)
      assert.equal(result.page, page)
      assert.deepEqual(result.allIds, expected)
      all.push(...pageInvariant(data, result))
      for (const group of result.groups) {
        const whole = querySkuWorkbench(data, config, { now, pageSize: 100 }).groups.find(item => item.key === group.key)
        assert.ok(whole)
        assert.equal(group.total, whole.total, 'Leaf counts describe the full group, including rows on other pages')
        assert.deepEqual(group.totals, whole.totals, 'All ancestor counts describe full groups')
      }
    }
    assert.deepEqual(all, expected, `Stable pages of size ${pageSize} must contain every matched ID once`)
    assert.equal(new Set(all).size, expected.length)
  }
}
export function runGroupingFixChecks(phase: 'before' | 'after', output: string, source: { baseline: string; querySha256: string }) {
  mkdirSync(output, { recursive: true })
  const data = groupingFixData(), config = groupingConfig()
  const unchanged = structuredClone({ data, config })
  assert.deepEqual(querySkuWorkbench(data, groupingConfig([]), { now, pageSize: 100 }).allIds, ['s1', 's2', 's3'], 'Fixture must start in the independently specified default order')
  const result = querySkuWorkbench(data, config, { now, pageSize: 100 })
  const reproduction = {
    phase, ...source, fixture: { templates: ['bound', 'unbound'], boundAttribute: 'group-color', defaultIds: ['s1', 's2', 's3'], businessTime: now },
    queryIds: result.rows.map(row => row.id), queryAllIds: result.allIds,
    groups: result.groups.map(group => ({ key: group.key, keys: group.keys, labels: group.labels, total: group.total, totals: group.totals, ids: group.rows.map(row => row.id) })),
    shownIds: consumeLikePage(data, result),
  }
  writeFileSync(`${output}/${phase}-grouping-reproduction.json`, JSON.stringify(reproduction, null, 2))
  console.log(JSON.stringify(reproduction, null, 2))
  // These correctness assertions intentionally fail on the original production module.
  pageInvariant(data, result)
  assert.deepEqual(result.allIds, ['s1', 's3', 's2'])
  assert.deepEqual(result.groups.map(group => ({ labels: group.labels, total: group.total })), [{ labels: ['未记录'], total: 2 }, { labels: ['不适用'], total: 1 }])
  assert.deepEqual({ data, config }, unchanged, 'Grouping and presentation cannot mutate their inputs')
  assertPages(data, config, ['s1', 's3', 's2'], [1, 2, 3, 10])
  console.log('PASS alternating empty/applicable and inapplicable groups; real page Map; all page boundaries')
  for (const direction of ['asc', 'desc'] as const) {
    const ordered = groupingConfig([{ field: 'attr:group-color', direction }])
    assertPages(data, ordered, ['s1', 's3', 's2'], [1, 2, 3])
  }
  console.log('PASS ascending and descending keep missing states separate with stable first-seen group tie order')
  const larger = groupingFixData()
  const sourceSku = larger.skus[0]
  assert.ok(sourceSku)
  const row = (id: string, name: string, color: string | null, status: Sku['status']): Sku => ({ ...sourceSku, id, skuName: name, code: id, status, ...(color === null ? { familyId: 'unbound-family', variantAttrs: {} } : { familyId: 'bound-family', variantAttrs: { 颜色: color } }) })
  larger.skus = [
    row('s1', 'K', '', 'on_sale'), row('s2', 'Z', null, 'on_sale'), row('s3', 'K', '', 'off_sale'),
    row('s4', 'A', '白色', 'off_sale'), row('s5', 'B', null, 'off_sale'), row('s6', 'C', '', 'on_sale'),
    row('s7', 'D', '黑色', 'on_sale'), row('s8', 'E', '白色', 'on_sale'), row('s9', 'K', '', 'on_sale'),
  ]
  const count = (labels: string[], totals: number[]) => ({ labels, totals, total: totals.at(-1) || 0 })
  const matrix: { name: string; config: SkuViewConfig; expected: string[]; counts: ReturnType<typeof count>[] }[] = [
    { name: 'one level ascending', config: groupingConfig(), expected: ['s4', 's8', 's7', 's1', 's3', 's6', 's9', 's2', 's5'], counts: [count(['白色'], [2]), count(['黑色'], [1]), count(['未记录'], [4]), count(['不适用'], [2])] },
    { name: 'one level descending', config: groupingConfig([{ field: 'attr:group-color', direction: 'desc' }]), expected: ['s7', 's4', 's8', 's1', 's3', 's6', 's9', 's2', 's5'], counts: [count(['黑色'], [1]), count(['白色'], [2]), count(['未记录'], [4]), count(['不适用'], [2])] },
    { name: 'two levels status then color', config: groupingConfig([{ field: 'status', direction: 'asc' }, { field: 'attr:group-color', direction: 'asc' }]), expected: ['s4', 's3', 's5', 's8', 's7', 's1', 's6', 's9', 's2'], counts: [count(['停售', '白色'], [3, 1]), count(['停售', '未记录'], [3, 1]), count(['停售', '不适用'], [3, 1]), count(['在售', '白色'], [6, 1]), count(['在售', '黑色'], [6, 1]), count(['在售', '未记录'], [6, 3]), count(['在售', '不适用'], [6, 1])] },
    { name: 'two levels color then status', config: groupingConfig([{ field: 'attr:group-color', direction: 'asc' }, { field: 'status', direction: 'desc' }]), expected: ['s8', 's4', 's7', 's1', 's6', 's9', 's3', 's2', 's5'], counts: [count(['白色', '在售'], [2, 1]), count(['白色', '停售'], [2, 1]), count(['黑色', '在售'], [1, 1]), count(['未记录', '在售'], [4, 3]), count(['未记录', '停售'], [4, 1]), count(['不适用', '在售'], [2, 1]), count(['不适用', '停售'], [2, 1])] },
  ]
  const sorted = groupingConfig()
  sorted.sortMode = 'field'; sorted.sorts = [{ field: 'name', direction: 'asc' }, { field: 'code', direction: 'desc' }]
  // Group order is independent of row sorting; only rows inside each identity bucket use the multi-sort.
  matrix.push({ name: 'grouped multi-sort applies inside each identity bucket', config: sorted, expected: ['s4', 's8', 's7', 's6', 's9', 's3', 's1', 's5', 's2'], counts: [count(['白色'], [2]), count(['黑色'], [1]), count(['未记录'], [4]), count(['不适用'], [2])] })
  for (const item of matrix) {
    const whole = querySkuWorkbench(larger, item.config, { now, pageSize: 100 })
    assert.deepEqual(whole.groups.map(group => ({ labels: group.labels, totals: group.totals, total: group.total })), item.counts, 'Fixed independent expectations protect full ancestor and leaf counts')
    assertPages(larger, item.config, item.expected, [1, 2, 4, 5, 20])
    console.log(`PASS ${item.name}; whole counts, unique group keys, query/table set-count-order and pagination`)
  }
  writeFileSync(`${output}/${phase}-grouping-matrix.json`, JSON.stringify({ result: 'PASS', ...source, cases: matrix.map(item => ({ name: item.name, groups: item.config.groups, sorts: item.config.sorts, expected: item.expected, counts: item.counts })), minimalIds: ['s1', 's3', 's2'], pageSizes: [1, 2, 3, 4, 5, 10, 20] }, null, 2))
}
