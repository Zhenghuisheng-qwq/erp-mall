import assert from 'node:assert/strict'
import { runProductListCategoryChecks } from '../src/domain/productListCategoryCheck'
import { runProductListManualChecks } from '../src/domain/productListManualCheck'
import { runProductListQueryChecks } from '../src/domain/productListQueryCheck'
import { runProductListViewChecks } from '../src/domain/productListViewCheck'
let assertions = 0
for (const [name, run] of [['category', runProductListCategoryChecks], ['manual', runProductListManualChecks], ['query', runProductListQueryChecks], ['view', runProductListViewChecks]] as const) {
  const results = run(); assertions += results.length
  assert.deepEqual(results.filter(item => !item.ok), [], `${name}: ${results.filter(item => !item.ok).map(item => `${item.id} ${item.detail}`).join('; ')}`)
}
console.log(`PASS list interaction legacy ${assertions} assertions`)
