import { runGradeChecks } from '../src/domain/gradeCheck'

const results = runGradeChecks()
results.forEach((item) => console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.id} ${item.detail}`))
if (results.some((item) => !item.ok)) process.exit(1)
console.log(`grade checks ${results.length}`)
