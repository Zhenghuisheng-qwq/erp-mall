import { runLayoutChecks } from '../src/domain/layoutCheck'

const results = runLayoutChecks()
results.forEach((item) => console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.id} ${item.detail}`))
if (results.some((item) => !item.ok)) process.exit(1)
console.log(`layout checks ${results.length}`)
