import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import ts from 'typescript'

const root = process.cwd(), baselinePath = 'work/template-compatibility/baseline/manifest.json'
if (!existsSync(baselinePath)) throw new Error(`Missing real start-of-task manifest: ${baselinePath}. Prepare the independent baseline; current code cannot substitute for it.`)
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
const sha = value => createHash('sha256').update(value).digest('hex')
const text = file => readFileSync(file, 'utf8').replaceAll('\r\n', '\n')
const changed = [], missing = [], comparisons = []
for (const [file, beforeSha256] of Object.entries(baseline.hashes)) {
  const path = join(root, file), afterSha256 = existsSync(path) ? sha(readFileSync(path)) : null
  const source = join(root, 'work/template-compatibility/baseline/source', file)
  const rawUnchanged = beforeSha256 === afterSha256
  const normalizedUnchanged = rawUnchanged || Boolean(afterSha256 && existsSync(source) && sha(readFileSync(source)) === beforeSha256 && text(path) === text(source))
  const strictRaw = file.startsWith('work/') || ['docs/benefit-package-workbench.md', 'docs/benefit-package-workbench-evidence.json'].includes(file)
  const item = { file, beforeSha256, afterSha256, rawUnchanged, normalizedUnchanged, lineEndingsOnly: !rawUnchanged && normalizedUnchanged, comparison: strictRaw ? 'raw SHA256' : 'normalized text when raw differs', unchanged: strictRaw ? rawUnchanged : normalizedUnchanged }
  comparisons.push(item)
  if (!afterSha256) missing.push(file)
  else if (!item.unchanged) changed.push(file)
}
const exactCore = ['src/domain/logic.ts', 'src/domain/draftComboPreview.ts', 'src/domain/spuSku.ts', 'src/domain/material.ts', 'src/domain/nodeCompatibility.ts', 'src/domain/deviceResolution.ts', 'src/domain/compatibility.ts', 'src/domain/layoutCheck.ts', 'src/components/ProductModelSelector.vue', 'src/layouts/AdminLayout.vue', 'src/layouts/RailNav.vue', 'src/layouts/navigationPreferences.ts']
const immutable = comparisons.filter(item => exactCore.includes(item.file) || item.file.startsWith('src/components/model-editor/') || /benefit/i.test(item.file) && !item.file.startsWith('work/template-compatibility/') || item.file.startsWith('docs/') || item.file.startsWith('work/'))
const violations = immutable.filter(item => !item.unchanged)
function original(file) {
  const path = join(root, 'work/template-compatibility/baseline/source', file)
  if (!existsSync(path)) throw new Error(`Missing independent baseline source: ${path}`)
  return text(path)
}
function functionBody(source, file, name) {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const declaration = parsed.statements.find(item => ts.isFunctionDeclaration(item) && item.name?.text === name)
  if (!declaration?.body) throw new Error(`Missing audited function ${name} in ${file}`)
  return declaration.body.getText(parsed)
}
const planning = text('src/domain/planning.ts'), planningOriginal = original('src/domain/planning.ts')
const planningWithoutReuseParameter = planning.replace('  /** A caller may reuse its already expanded, deduplicated combinations from these same nodes. */\n  combinations?: LegalCombination[]\n', '').replace('input.combinations ?? legalPlanningCombinations(input.data, input.productModelId, input.nodes)', 'legalPlanningCombinations(input.data, input.productModelId, input.nodes)')
const conditionOriginal = functionBody(original('src/domain/accessoryCompatibilityCommands.ts'), 'commands.before.ts', 'conditionProblem')
const conditionFinal = functionBody(text('src/domain/compatibilityValidation.ts'), 'validation.after.ts', 'conditionProblem')
const specialCases = {
  planningOptionalReuseOnly: planningWithoutReuseParameter === planningOriginal,
  legalCombinationBodyUnchanged: functionBody(planning, 'planning.after.ts', 'legalPlanningCombinations') === functionBody(planningOriginal, 'planning.before.ts', 'legalPlanningCombinations'),
  generatorBodyUnchanged: functionBody(text('src/domain/logic.ts'), 'logic.after.ts', 'generateSkuFromModel') === functionBody(original('src/domain/logic.ts'), 'logic.before.ts', 'generateSkuFromModel'),
  conditionValidatorBodyUnchanged: conditionOriginal === conditionFinal,
  userReadmePrefixPreserved: text('README.md').startsWith(text('work/template-compatibility/baseline/README.start.md')),
  eolOperationExactlyUndone: (() => { const path = 'work/template-compatibility/eol-restoration.json'; if (!existsSync(path)) return true; const operation = JSON.parse(readFileSync(path, 'utf8')); return operation.restored.every(item => sha(readFileSync(item.file)) === item.beforeRestoration) })(),
}
const output = { executedAt: new Date().toISOString(), baseline: { path: baselinePath, branch: baseline.branch, head: baseline.head, sourceZip: baseline.sourceZip, initialStatus: baseline.initialStatus }, counts: { baselineFiles: comparisons.length, rawUnchanged: comparisons.filter(item => item.rawUnchanged).length, normalizedContentUnchanged: comparisons.filter(item => item.normalizedUnchanged).length, changed: changed.length, missing: missing.length, protectedFiles: immutable.length, protectedUnchanged: immutable.filter(item => item.unchanged).length, originalWorkFilesRawUnchanged: comparisons.filter(item => item.file.startsWith('work/') && item.rawUnchanged).length }, changed, missing, protectedViolations: violations, specialCases, protectedComparisons: immutable, scopeNotes: { planning: 'Only an optional caller-supplied combination array was added. Default expansion, ordering, roles, identity and reconciliation body remain the original implementation.', catalogIdentity: 'One shared identity rule plus operation-local receipt/family indexes. Original entry versus indexed entry behavior is explicitly checked in template-compatibility-domain-check.ts.', commands: 'Condition validator body moved unchanged into an acyclic shared module; template provenance shape added. Existing manual/legacy/material-copy semantics retained.', historicalEvidence: 'All old work artifacts and two initially untracked benefit reports use raw SHA256. Protected source and tracked reports use exact normalized text against independently saved baseline/source (with original/raw hashes reported separately). The preexisting README content is preserved as a normalized prefix while authorized new guidance may be appended. Historical runs are not relabeled as current runs. An unnecessary EOL restoration was fully undone, with every touched file matching its recorded pre-operation raw SHA256.' } }
writeFileSync('work/template-compatibility/scope-audit.json', JSON.stringify(output, null, 2))
assert.equal(missing.length, 0, 'a pre-task file was removed')
assert.deepEqual(violations, [], 'a protected core or historical artifact changed')
assert(Object.values(specialCases).every(Boolean), 'a narrowly permitted source change exceeded its boundary')
console.log(JSON.stringify({ counts: output.counts, specialCases, result: 'PASS' }, null, 2))
