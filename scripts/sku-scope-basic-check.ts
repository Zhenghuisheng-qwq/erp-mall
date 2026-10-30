import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { effectScope, nextTick, ref } from 'vue'
import { installCatalogTestLocks } from './catalog-storage-test-env'
import { createCatalogProductFixture, CATALOG_TEST_TIME as now } from './catalog-product-fixture'
import { ensureProductListPages } from '../src/domain/productListPages'
import { addScopeCondition, cloneSku, defaultSkuConfig, ensureSkuWorkbench } from '../src/domain/skuWorkbenchState'
import { conditionEntries } from '../src/domain/skuQuickFilters'
import { querySkuWorkbench, validateSkuConfig } from '../src/domain/skuWorkbenchQuery'
import { useSkuWorkbench } from '../src/components/product-list/useSkuWorkbench'
import { normalizeStored, useCatalogStore } from '../src/stores/catalog'
import { ensureRbac } from '../src/domain/rbac'
import { DATA_VERSION, STORAGE_KEY } from '../src/domain/types'
import { RBAC_ENFORCEMENT_ENABLED } from '../src/domain/accessMode'
import type { SkuCondition, SkuConditionGroup, SkuViewConfig } from '../src/domain/skuWorkbenchTypes'

const restoreLocks = installCatalogTestLocks(), disk = new Map<string, string>()
let fail = false, groups = 0
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => disk.get(key) ?? null,
  setItem: (key: string, value: string) => { if (fail) throw new Error('QuotaExceededError scope fixture'); disk.set(key, String(value)) },
  removeItem: (key: string) => disk.delete(key),
} })
const mark = (name: string) => { groups++; console.log(`PASS ${name}`) }
const { data } = createCatalogProductFixture()
ensureRbac(data); ensureProductListPages(data); ensureSkuWorkbench(data)
const familyId = 'family-device'
const inactive = (id: string): SkuCondition => ({ kind: 'rule', id, field: 'name', operator: 'contains', value: null, active: false })
const active = (id: string, field: string, value: string): SkuCondition => ({ kind: 'rule', id, field, operator: field === 'name' ? 'contains' : 'eq', value })
const nested = (id: string, logic: 'all' | 'any', children: SkuCondition[]): SkuConditionGroup => ({ kind: 'group', id, logic, children })
const cases: { name: string; logic: 'all' | 'any'; children: (SkuCondition | SkuConditionGroup)[] }[] = [
  { name: 'empty OR', logic: 'any', children: [] },
  { name: 'inactive AND', logic: 'all', children: [inactive('a-one'), inactive('a-two')] },
  { name: 'inactive OR', logic: 'any', children: [inactive('o-one'), inactive('o-two')] },
  { name: 'inactive nested AND', logic: 'any', children: [nested('n-all', 'all', [inactive('n-one'), inactive('n-two')])] },
  { name: 'inactive nested OR', logic: 'any', children: [nested('n-any', 'any', [inactive('n-three'), inactive('n-four')])] },
  { name: 'partly inactive AND', logic: 'all', children: [active('a-name', 'name', 'phone-a'), inactive('a-old')] },
  { name: 'partly inactive OR', logic: 'any', children: [active('o-name', 'name', 'phone-a'), active('o-status', 'status', 'off_sale'), inactive('o-old')] },
  { name: 'nested OR distribution', logic: 'any', children: [nested('n-active-any', 'any', [active('n-name', 'name', 'phone-a'), inactive('n-old'), active('n-status', 'status', 'off_sale')]), inactive('outer-old')] },
  { name: 'nested AND intersection', logic: 'any', children: [nested('n-active-all', 'all', [active('n-all-name', 'name', 'phone'), active('n-all-status', 'status', 'on_sale'), inactive('n-all-old')]), active('outer-status', 'status', 'off_sale')] },
]
const configs = cases.map(test => {
  const config = defaultSkuConfig(); config.conditions = { kind: 'group', id: 'root', logic: test.logic, children: test.children }
  config.quickFilters = conditionEntries(config.conditions).map(({ rule }) => ({ source: 'condition', ruleId: rule.id }))
  return config
})
const ids = (d: typeof data, c: SkuViewConfig, scopeId = '') => querySkuWorkbench(d, c, { scopeId, pageSize: 1000 }).allIds.slice().sort()
for (const [index, config] of configs.entries()) {
  const original = cloneSku(config), saved = addScopeCondition(config, familyId)
  assert.deepEqual(config, original, 'Scope saving does not mutate caller draft')
  assert.deepEqual(validateSkuConfig(data, saved), [], cases[index]!.name)
  assert.deepEqual(ids(data, saved), ids(data, config, familyId), cases[index]!.name)
  assert.deepEqual(addScopeCondition(saved, familyId), saved, 'Repeated scope save does not accumulate rules')
  assert.deepEqual(saved.quickFilters, original.quickFilters)
  const afterRules = new Map(conditionEntries(saved.conditions).map(({ rule }) => [rule.id, rule]))
  for (const { rule } of conditionEntries(config.conditions)) assert.deepEqual(afterRules.get(rule.id), rule, 'Original rule identity/operator/value/enabled state survives')
  assert.deepEqual(addScopeCondition(config, ''), config, 'No scope does not fabricate a constraint')
  mark(`scope expression ${cases[index]!.name}`)
}

disk.set(STORAGE_KEY, JSON.stringify({ version: DATA_VERSION, data }))
setActivePinia(createPinia())
const owner = effectScope(), scopeId = ref(familyId)
const workbench = owner.run(() => useSkuWorkbench(scopeId))!
const store = useCatalogStore(); await store.waitForPersistence(); await nextTick()
const business = (d: typeof data) => JSON.stringify([d.families, d.skus, d.specModelVersions, d.planningRecords, d.compatibilities, d.materialRelations])
const originalBusiness = business(store.data)
try {
  for (const [index, config] of configs.entries()) {
    scopeId.value = familyId; await nextTick()
    assert.ok((await workbench.apply(config)).ok)
    const result = await workbench.create(`边界验证 ${index}`, true); assert.ok(result.ok && result.id)
    const saved = store.data.productListPages!.sku.views.find(view => view.id === result.id)!.skuWorkbench!
    scopeId.value = ''; await nextTick(); assert.ok((await workbench.select(result.id)).ok)
    assert.deepEqual(ids(store.data, workbench.config.value), ids(data, config, familyId))
    const restored = normalizeStored(JSON.parse(disk.get(STORAGE_KEY)!)); assert.ok(restored)
    const reopened = restored.productListPages!.sku.views.find(view => view.id === result.id)!.skuWorkbench!
    assert.deepEqual(ids(restored, reopened), ids(data, config, familyId)); assert.deepEqual(reopened.quickFilters, config.quickFilters)
    assert.deepEqual(reopened.conditions, saved.conditions)
  }
  mark('real Store save scope / leave temporary SPU / reopen normalized persistence for all expression cases')
  scopeId.value = familyId; await nextTick(); assert.ok((await workbench.apply(configs[2]!)).ok)
  const unscoped = await workbench.create('未勾选保存范围', false); assert.ok(unscoped.ok && unscoped.id)
  const noScope = store.data.productListPages!.sku.views.find(view => view.id === unscoped.id)!.skuWorkbench!
  assert.deepEqual(noScope.conditions, configs[2]!.conditions); assert(ids(store.data, noScope).length > ids(store.data, noScope, familyId).length)
  mark('unchecked save keeps temporary SPU convention without inserting a hidden permanent scope')
  const before = JSON.stringify(store.data), raw = disk.get(STORAGE_KEY)
  fail = true; const failed = await workbench.create('范围失败重试', true); fail = false
  assert.equal(failed.ok, false); assert.equal(JSON.stringify(store.data), before); assert.equal(disk.get(STORAGE_KEY), raw)
  assert.deepEqual(workbench.config.value.conditions, configs[2]!.conditions)
  const retried = await workbench.create('范围失败重试', true); assert.ok(retried.ok && retried.id)
  assert.equal(store.data.productListPages!.sku.views.filter(view => view.name === '范围失败重试').length, 1)
  assert.equal(business(store.data), originalBusiness)
  mark('real Store quota failure is atomic, caller config preserved, explicit retry writes one view, business/history unchanged')
} finally { owner.stop(); restoreLocks() }

console.log(`PASS scope/basic boundary ${RBAC_ENFORCEMENT_ENABLED ? 'strict' : 'default'} ${groups} groups`)
