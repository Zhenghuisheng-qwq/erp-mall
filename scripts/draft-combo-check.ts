import { runDraftComboChecks } from '../src/domain/draftComboPreviewCheck'

const results = runDraftComboChecks()
results.forEach((item) => console.log(`${item.ok ? 'PASS' : 'FAIL'} 5C-2 ${item.id} ${item.detail}`))
if (results.some((item) => !item.ok)) process.exit(1)
console.log('5C-2 draft combo checks ok')
