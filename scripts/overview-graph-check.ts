import { runOverviewGraphChecks } from '../src/domain/overviewGraphCheck'

const results = runOverviewGraphChecks()
results.forEach((item) => console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.id} ${item.detail}`))
if (results.some((item) => !item.ok)) process.exit(1)
console.log(`overview graph checks ${results.length}`)
