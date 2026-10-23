import { runRound5Checks } from '../src/domain/round5Check'

const results = await runRound5Checks()
results.forEach((item) => console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.group} ${item.id} ${item.detail}`))
const groups = ['R5-A', 'R5-B'] as const
groups.forEach((group) => {
  const rows = results.filter((item) => item.group === group)
  console.log(`${group} ${rows.filter((item) => item.ok).length}/${rows.length}`)
})
if (results.some((item) => !item.ok)) process.exit(1)
console.log(`round5 checks ${results.length}`)
