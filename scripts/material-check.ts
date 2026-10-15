import { runMaterialChecks } from '../src/domain/materialCheck'

const results = await runMaterialChecks()
results.forEach((item) => {
  console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.id} ${item.detail}`)
})
if (results.some((item) => !item.ok)) process.exit(1)
console.log(`material checks ${results.length}`)
