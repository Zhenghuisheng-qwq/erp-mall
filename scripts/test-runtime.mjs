import assert from 'node:assert/strict'
import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'

// Only disposable runtime inputs/cache/profile live here. Evidence is separately opt-in.
const created = new Set()
export function createTestRuntime(label) {
  assert(/^[a-z0-9-]+$/.test(label), 'runtime label must be a simple name')
  const root = mkdtempSync(join(tmpdir(), `iyge-${label}-`))
  created.add(realpathSync(root))
  return root
}
export function removeTestRuntime(directory) {
  const resolved = realpathSync(directory), temporaryRoot = realpathSync(tmpdir())
  assert(created.has(resolved), 'only this process-created runtime may be removed')
  assert(resolved.startsWith(temporaryRoot + sep), 'runtime must stay below OS temporary directory')
  assert(resolve(directory) === resolved, 'runtime removal must not follow a changed path')
  rmSync(resolved, {recursive:true, force:true})
  created.delete(resolved)
}
