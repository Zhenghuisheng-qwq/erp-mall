import { runPlanningChecks } from '../src/domain/planningCheck'

const results = await runPlanningChecks()
results.forEach((item) => {
  console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.id} ${item.detail}`)
})
if (results.some((item) => !item.ok)) process.exit(1)
console.log(`planning checks ${results.length}`)
