import { runCategoryTreeSelectChecks } from '../src/domain/categoryTreeSelectCheck'

const results = runCategoryTreeSelectChecks()
results.forEach((item) => console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.id} ${item.detail}`))
if (results.some((item) => !item.ok)) process.exit(1)
console.log(`category tree select checks ${results.length}`)
