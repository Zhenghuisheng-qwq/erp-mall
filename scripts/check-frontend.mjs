import { spawnSync } from 'node:child_process'

// Reuse the existing assertions, fail immediately on a missing or failing check.
const checks = [
  // Query already runs list/view/category/manual-order/naming/combo/archive checks.
  'product-list-query', 'category-tree-select', 'planning', 'draft-combo',
  'material', 'consistency', 'layout', 'round5', 'round1',
]
for (const name of checks) {
  const entry = `scripts/${name}-check.ts`
  console.log(`\nRUN ${entry}`)
  const result = spawnSync(process.execPath, ['scripts/run-domain-check.mjs', entry], { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status || 1)
}
console.log(`PASS ${checks.length} frontend check scripts`)
