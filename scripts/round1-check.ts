import { runRound1Checks } from '../src/domain/round1Check'

const results = await runRound1Checks()
const groups = ['G1', 'G2', 'G3', 'G4'] as const
results.forEach((item) => console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.group} ${item.id} ${item.detail}`))
groups.forEach((group) => {
  const rows = results.filter((item) => item.group === group)
  console.log(`${group} ${rows.filter((item) => item.ok).length}/${rows.length}`)
})
if (results.some((item) => !item.ok)) process.exit(1)
console.log(`round1 checks ${results.length}`)
