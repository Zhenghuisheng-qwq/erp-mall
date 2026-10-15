import { runNamingChecks } from '../src/domain/namingCheck'

const results = runNamingChecks()
results.forEach((item) => console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.id} ${item.detail}`))
if (results.some((item) => !item.ok)) process.exit(1)
console.log(`naming checks ${results.length}`)
