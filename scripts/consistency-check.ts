import { runConsistencyChecks } from '../src/domain/consistencyCheck'

const results = runConsistencyChecks()
results.forEach((item) => console.log(`${item.ok ? 'PASS' : 'FAIL'} 5C-1 ${item.id} ${item.detail}`))
if (results.some((item) => !item.ok)) process.exit(1)
console.log('5C-1 consistency checks ok')
