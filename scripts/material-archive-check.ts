import { runArchiveChecks } from '../src/domain/materialArchiveCheck'

const results = runArchiveChecks()
results.forEach((item) => console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.id} ${item.detail}`))
if (results.some((item) => !item.ok)) process.exit(1)
console.log(`archive checks ${results.length}`)
