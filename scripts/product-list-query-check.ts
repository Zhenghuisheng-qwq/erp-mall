import { runArchiveChecks } from '../src/domain/materialArchiveCheck'
import { runComboMaterialStatusChecks } from '../src/domain/comboMaterialStatusCheck'
import { runNamingChecks } from '../src/domain/namingCheck'
import { runProductListChecks } from '../src/domain/productListCheck'
import { runProductListCategoryChecks } from '../src/domain/productListCategoryCheck'
import { runProductListManualChecks } from '../src/domain/productListManualCheck'
import { runProductListQueryChecks } from '../src/domain/productListQueryCheck'
import { runProductListViewChecks } from '../src/domain/productListViewCheck'

function report(title: string, results: { id: string; ok: boolean; detail: string }[]) {
  results.forEach((item) => console.log(`${item.ok ? 'PASS' : 'FAIL'} ${title} ${item.id} ${item.detail}`))
  return results.some((item) => !item.ok)
}

const failed = [
  report('category', runProductListCategoryChecks()),
  report('manual', runProductListManualChecks()),
  report('query', runProductListQueryChecks()),
  report('view', runProductListViewChecks()),
  report('list', runProductListChecks()),
  report('naming', runNamingChecks()),
  report('combo', runComboMaterialStatusChecks()),
  report('archive', runArchiveChecks()),
].some(Boolean)

if (failed) process.exit(1)
console.log('product list query checks ok')
