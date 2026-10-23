import assert from 'node:assert/strict'
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { installCatalogTestLocks } from './catalog-storage-test-env'
import { createTemplateCompatibilityFixture } from './template-compatibility-fixtures'
import { newBenefitPackageDraft } from '../src/domain/benefitPackages'
import { DATA_VERSION, STORAGE_KEY } from '../src/domain/types'
import { createCatalogPersistence, restoreCatalogData } from '../src/stores/catalogPersistence'
import { normalizeStored, useCatalogStore } from '../src/stores/catalog'

const output = resolve(process.env.REFINEMENT_STORAGE_OUTPUT || 'work/compatibility-benefit-refinement/storage')
mkdirSync(output, { recursive: true })
const checks: { name: string; result: 'PASS'; detail: string }[] = []
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
const restoreLocks = installCatalogTestLocks()
const disk = new Map<string, string>()
let failNext = false, writes = 0
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => disk.get(key) ?? null,
  setItem: (key: string, value: string) => { if (failNext) { failNext = false; throw new DOMException('独立持久化失败注入', 'QuotaExceededError') }; writes++; disk.set(key, value) },
} })
const mark = (name: string, detail: string) => { checks.push({ name, result: 'PASS', detail }); console.log(`PASS storage ${name}`) }
const mount = () => { setActivePinia(createPinia()); return useCatalogStore() }
const parse = () => JSON.parse(disk.get(STORAGE_KEY)!)
const fixture = createTemplateCompatibilityFixture()
fixture.data.activeRole = 'admin'
fixture.data.benefitPackages = []; fixture.data.benefitDeliveries = []
const plain = JSON.stringify({ version: DATA_VERSION, data: fixture.data })
disk.set(STORAGE_KEY, plain)
let a: ReturnType<typeof useCatalogStore> | undefined, b: ReturnType<typeof useCatalogStore> | undefined
try {
  const beforeNormalize = disk.get(STORAGE_KEY), count = writes
  normalizeStored({ version: DATA_VERSION - 1, data: structuredClone(fixture.data) })
  assert.equal(disk.get(STORAGE_KEY), beforeNormalize); assert.equal(writes, count)
  mark('normalization-is-readonly', 'startup/import transformation has no independent storage writer')
  a = mount(); await a.waitForPersistence(); b = mount(); await b.waitForPersistence()
  const previousCommit = parse().commit
  const draft = newBenefitPackageDraft(); draft.name = '独立保护包'
  const saved = await a.saveBenefitPackage({ draft, status: 'draft', requestId: 'storage-one' }); assert(saved.ok)
  const newest = disk.get(STORAGE_KEY), commit = parse().commit
  assert(commit.datasetId && commit.commitId && commit.revision === (previousCommit?.revision || 0) + 1, 'one save advances the protected current revision once')
  assert.equal((await b.saveModelDraft(fixture.modelId)).ok, false); assert.equal(disk.get(STORAGE_KEY), newest)
  b.data.profile.name = '旧内存草稿'; await nextTick(); await b.waitForPersistence()
  assert.equal(disk.get(STORAGE_KEY), newest); assert.equal(b.data.profile.name, '旧内存草稿'); assert(b.persistenceState.external)
  assert.equal((await b.resetAll()).ok, false); assert.equal(disk.get(STORAGE_KEY), newest)
  mark('stale-command-watcher-and-reset-refuse', 'all operations compare exact accepted persisted base under lock; old live draft remains')
  const before = JSON.stringify(a.data), previousDisk = disk.get(STORAGE_KEY)
  failNext = true
  const failed = await a.setBenefitPackageFavorite(saved.id!, true, saved.package!.revision)
  assert.equal(failed.ok, false); assert.equal(JSON.stringify(a.data), before); assert.equal(disk.get(STORAGE_KEY), previousDisk)
  const retry = await a.setBenefitPackageFavorite(saved.id!, true, saved.package!.revision); assert(retry.ok)
  const afterRetry = disk.get(STORAGE_KEY), writesAfter = writes
  assert((await a.setBenefitPackageFavorite(saved.id!, true, retry.package!.revision)).ok)
  assert.equal(disk.get(STORAGE_KEY), afterRetry); assert.equal(writes, writesAfter)
  mark('failure-retry-and-noop-once', 'failed storage leaves memory/metadata unchanged; retry commits once; same favorite writes zero times')
  const oldIdentity = parse().commit
  await a.importJson(a.exportJson()); const imported = parse().commit
  assert.notEqual(imported.datasetId, oldIdentity.datasetId); assert.equal(imported.revision, 1)
  const replaced = disk.get(STORAGE_KEY)
  assert.equal((await restoreCatalogData(newest!, fixture.data)).ok, false); assert.equal(disk.get(STORAGE_KEY), replaced)
  mark('dataset-replacement-and-stale-recovery', 'import resets random dataset identity; a stale recovery page cannot overwrite it even at repeated revision 1')
  const beforeModule = JSON.stringify(a.data), moduleDisk = disk.get(STORAGE_KEY)
  failNext = true
  assert.equal((await a.resetModule('groups')).ok, false); assert.equal(JSON.stringify(a.data), beforeModule); assert.equal(disk.get(STORAGE_KEY), moduleDisk)
  assert((await a.resetModule('groups')).ok); assert.notEqual(parse().commit.datasetId, imported.datasetId)
  assert.deepEqual(parse().data.benefitPackages, JSON.parse(beforeModule).benefitPackages)
  assert.deepEqual(parse().data.specModelVersions, JSON.parse(beforeModule).specModelVersions)
  mark('module-reset-failure-and-retry-atomic', 'failed reset leaves live/disk unchanged; retry replaces dataset identity and retains unrelated packages and frozen versions')
  a.$dispose(); b.$dispose(); a = undefined; b = undefined
  const corrupt = '{invalid original JSON'
  disk.set(STORAGE_KEY, corrupt)
  const restored = await restoreCatalogData(corrupt, fixture.data); assert(restored.ok); assert(parse().commit.datasetId)
  mark('explicit-recovery-keeps-original-until-commit', 'invalid original bytes can only be replaced against their exact captured base under the shared lock')
  const standalone = createCatalogPersistence(disk.get(STORAGE_KEY)!)
  assert.throws(() => standalone.write(fixture.data), /互斥/); standalone.dispose()
  mark('direct-write-without-lock-rejected', 'the single production setItem boundary rejects calls outside its transaction')
  const paths = readdirSync(resolve('src'), { recursive: true }).map(String).filter(path => /\.(ts|vue)$/.test(path))
  const directWriters = paths.filter(path => /localStorage\.setItem\(STORAGE_KEY/.test(readFileSync(resolve('src', path), 'utf8')))
  assert.deepEqual(directWriters.map(path => path.replaceAll('\\', '/')), ['stores/catalogPersistence.ts'])
  mark('one-business-storage-writer', 'watch/startup/creation/template/benefit/SKU views/import/reset/recovery all use catalogPersistence.write')
  writeFileSync(resolve(output, 'evidence.json'), JSON.stringify({ result: 'PASS', checks, writes, lock: 'Node test double; real browser Web Locks separately tested' }, null, 2))
} finally {
  a?.$dispose(); b?.$dispose(); restoreLocks()
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
  else Reflect.deleteProperty(globalThis, 'localStorage')
}
