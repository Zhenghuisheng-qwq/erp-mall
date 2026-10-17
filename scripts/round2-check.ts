import { runRound2Checks } from '../src/domain/round2Check'

const results = await runRound2Checks()
results.forEach((item) => console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.id} ${item.detail}`))
console.log(`round2 checks ${results.filter((item) => item.ok).length}/${results.length}`)
if (results.some((item) => !item.ok)) process.exit(1)
