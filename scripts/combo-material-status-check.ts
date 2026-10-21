import { runArchiveChecks } from '../src/domain/materialArchiveCheck'
import { runComboMaterialStatusChecks } from '../src/domain/comboMaterialStatusCheck'
import { runNamingChecks } from '../src/domain/namingCheck'

function report(title: string, results: { id: string; ok: boolean; detail: string }[]) {
  results.forEach((item) => console.log(`${item.ok ? 'PASS' : 'FAIL'} ${title} ${item.id} ${item.detail}`))
  return results.some((item) => !item.ok)
}

const failed = [
  report('combo', runComboMaterialStatusChecks()),
  report('naming', runNamingChecks()),
  report('archive', runArchiveChecks()),
].some(Boolean)

if (failed) process.exit(1)
console.log('combo material status checks ok')
