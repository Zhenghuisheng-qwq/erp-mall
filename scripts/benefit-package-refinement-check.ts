import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createPinia, setActivePinia } from 'pinia'
import { installCatalogTestLocks } from './catalog-storage-test-env'
import { createBenefitPackageFixture, BENEFIT_TEST_TIME } from './benefit-package-fixtures'
import { benefitPackageImportProblems, cloneBenefit, validateBenefitPackage } from '../src/domain/benefitPackages'
import type { BenefitSelectionGroup } from '../src/domain/benefitPackageTypes'
import { ensureProductListPages } from '../src/domain/productListPages'
import { DATA_VERSION, STORAGE_KEY } from '../src/domain/types'
import { useCatalogStore } from '../src/stores/catalog'

const output = resolve(process.env.BENEFIT_REFINEMENT_OUTPUT || 'work/compatibility-benefit-refinement/benefit-structure-final.json')
const checks: { name: string; result: string; detail?: string }[] = []
function check(name: string, run: () => void) { try { run(); checks.push({ name, result: 'PASS' }) } catch (error) { checks.push({ name, result: 'FAIL', detail: String(error) }) } }
const { data, draft: base } = createBenefitPackageFixture()
const group: BenefitSelectionGroup = { id: 'disabled-numeric-group', name: '保留的停用组', enabled: false, candidateSkuIds: [], required: false, minKinds: 0, maxKinds: 1, defaultQuantity: 1, adjustable: false, minQuantity: 1, maxQuantity: 1 }
const invalid = [['zero', 0], ['empty-input', NaN], ['non-number', 'abc'], ['infinity', Infinity], ['fraction', 1.5], ['negative', -1], ['overflow', Number.MAX_SAFE_INTEGER + 1]] as const
for (const rulesEnabled of [false, true]) for (const field of ['maxKinds', 'defaultQuantity', 'minQuantity', 'maxQuantity'] as const) for (const [label, value] of invalid) {
  check(`${rulesEnabled ? 'disabled-group' : 'disabled-rules'}:${field}:${label}:reject-before-serialization`, () => {
    const draft = cloneBenefit(base); draft.rulesEnabled = rulesEnabled; draft.groups = [{ ...group, [field]: value } as BenefitSelectionGroup]
    const original = cloneBenefit(draft), validation = validateBenefitPackage(data, draft)
    assert.equal(validation.canSaveDraft, false, 'must reject structural error even while rules/group disabled')
    assert.equal(validation.canSaveAvailable, false)
    assert.ok(validation.issues.some(issue => issue.structural && issue.groupId === group.id && issue.field === field), 'must identify group and field')
    assert.deepEqual(draft, original, 'validation must retain the exact invalid draft')
    const persisted = { ...draft, id: 'bpk-fixed', code: 'BPK-000001', revision: 1, createdAt: BENEFIT_TEST_TIME, updatedAt: BENEFIT_TEST_TIME }
    assert.ok(benefitPackageImportProblems({ benefitPackages: [persisted] }).length)
    assert.ok(benefitPackageImportProblems(JSON.parse(JSON.stringify({ benefitPackages: [persisted] }))).length)
  })
}
check('disabled-incomplete-business-content-roundtrip', () => {
  const draft = cloneBenefit(base); draft.rulesEnabled = false; draft.groups = [{ ...group, name: '', minKinds: 0, maxKinds: 5 }]
  assert.equal(validateBenefitPackage(data, draft).canSaveDraft, true)
  assert.equal(validateBenefitPackage(data, draft).canSaveAvailable, true)
  const persisted = { ...draft, id: 'bpk-roundtrip', code: 'BPK-000002', revision: 1, createdAt: BENEFIT_TEST_TIME, updatedAt: BENEFIT_TEST_TIME }
  assert.deepEqual(benefitPackageImportProblems({ benefitPackages: [persisted] }), [])
  assert.deepEqual(benefitPackageImportProblems(JSON.parse(JSON.stringify({ benefitPackages: [persisted] }))), [])
})
check('negative-minKinds-still-invalid-when-disabled', () => {
  const draft = cloneBenefit(base); draft.rulesEnabled = false; draft.groups = [{ ...group, minKinds: -1 }]
  assert.equal(validateBenefitPackage(data, draft).canSaveDraft, false)
})
const restoreLocks = installCatalogTestLocks(), oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
const disk = new Map<string, string>(); let writes = 0, store: ReturnType<typeof useCatalogStore> | undefined
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => disk.get(key) ?? null, setItem: (key: string, value: string) => { writes++; disk.set(key, value) }, removeItem: (key: string) => disk.delete(key) } })
const mount = () => { store?.$dispose(); setActivePinia(createPinia()); return store = useCatalogStore() }
async function transactionCheck(name: string, run: () => Promise<void>) { try { await run(); checks.push({ name, result: 'PASS' }) } catch (error) { checks.push({ name, result: 'FAIL', detail: String(error) }) } }
try {
  const independent = cloneBenefit(data); ensureProductListPages(independent); disk.set(STORAGE_KEY, JSON.stringify({ version: DATA_VERSION, data: independent }))
  const active = mount()
  await transactionCheck('actual-save-rejects-invalid-disabled-rules-in-both-statuses-with-no-write', async () => {
    const bytes = disk.get(STORAGE_KEY), originalWrites = writes
    for (const rulesEnabled of [false, true]) for (const field of ['maxKinds', 'defaultQuantity', 'minQuantity', 'maxQuantity'] as const) for (const [label, value] of invalid) for (const status of ['draft', 'available'] as const) {
      const draft = cloneBenefit(base); draft.rulesEnabled = rulesEnabled; draft.groups = [{ ...group, [field]: value } as BenefitSelectionGroup]
      const before = cloneBenefit(draft), result = await active.saveBenefitPackage({ draft, status, requestId: `invalid:${rulesEnabled}:${field}:${label}:${status}` })
      assert.equal(result.ok, false); assert.ok(result.validation?.issues.some(issue => issue.groupId === group.id && issue.field === field)); assert.deepEqual(draft, before)
      assert.equal(disk.get(STORAGE_KEY), bytes); assert.equal(writes, originalWrites)
    }
  })
  await transactionCheck('disabled-business-incomplete-actual-save-export-import-startup-roundtrip-and-malformed-bytes-retained', async () => {
    const draft = cloneBenefit(base); draft.rulesEnabled = false; draft.groups = [{ ...group, name: '', maxKinds: 9 }]
    const result = await active.saveBenefitPackage({ draft, status: 'available', requestId: 'valid-disabled-roundtrip' })
    assert.equal(result.ok, true); assert.ok(result.package)
    const snapshot = cloneBenefit(result.package), exported = active.exportJson()
    await active.importJson(exported); assert.deepEqual(active.data.benefitPackages?.[0], snapshot)
    const loaded = mount(); assert.deepEqual(loaded.data.benefitPackages?.[0], snapshot)
    const disabledGroupDraft = cloneBenefit(snapshot); disabledGroupDraft.rulesEnabled = true
    const disabledGroupSave = await loaded.saveBenefitPackage({ draft: disabledGroupDraft, status: 'available', expectedRevision: snapshot.revision, requestId: 'disabled-group-roundtrip' })
    assert.equal(disabledGroupSave.ok, true); assert.ok(disabledGroupSave.package)
    await loaded.importJson(loaded.exportJson())
    const loadedGroup = mount(); assert.deepEqual(loadedGroup.data.benefitPackages?.[0], disabledGroupSave.package)
    const corrupt = JSON.parse(loadedGroup.exportJson()); corrupt.data.benefitPackages[0].groups[0].maxKinds = 0
    await assert.rejects(() => loadedGroup.importJson(JSON.stringify(corrupt)), /最多选择种数/)
    const raw = JSON.stringify(corrupt); disk.set(STORAGE_KEY, raw); const beforeWrites = writes
    assert.throws(mount, /原始存储已保留/); assert.equal(disk.get(STORAGE_KEY), raw); assert.equal(writes, beforeWrites)
  })
} finally {
  store?.$dispose(); restoreLocks()
  if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage)
  else Reflect.deleteProperty(globalThis, 'localStorage')
}
mkdirSync(resolve(output, '..'), { recursive: true }); writeFileSync(output, JSON.stringify({ checks, passed: checks.filter(check => check.result === 'PASS').length, failed: checks.filter(check => check.result === 'FAIL').length }, null, 2))
checks.forEach(check => console.log(`${check.result} ${check.name}${check.detail ? `: ${check.detail}` : ''}`))
assert.equal(checks.filter(check => check.result === 'FAIL').length, 0, `Benefit structural regressions; evidence: ${output}`)
