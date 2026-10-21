import { runArchiveChecks } from '../src/domain/materialArchiveCheck'
import { runComboMaterialStatusChecks } from '../src/domain/comboMaterialStatusCheck'
import { runNamingChecks } from '../src/domain/namingCheck'
import { runProductListChecks } from '../src/domain/productListCheck'

function report(title: string, results: { id: string; ok: boolean; detail: string }[]) {
  results.forEach((item) => console.log(`${item.ok ? 'PASS' : 'FAIL'} ${title} ${item.id} ${item.detail}`))
  return results.some((item) => !item.ok)
}

const failed = [
  report('list', runProductListChecks()),
  report('naming', runNamingChecks()),
  report('combo', runComboMaterialStatusChecks()),
  report('archive', runArchiveChecks()),
].some(Boolean)

if (failed) process.exit(1)
console.log('product list checks ok')
