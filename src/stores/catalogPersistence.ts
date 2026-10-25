import { reactive } from 'vue'
import { DATA_VERSION, STORAGE_KEY, type AppData } from '../domain/types'
import { branchFailure, failureError, getFailure, unknownFailure, createFailure } from '../domain/guide/failure'
import type { GuideFailure } from '../domain/guide/types'

export const CATALOG_LOCK = `${STORAGE_KEY}:commit`
type CommitIdentity = { datasetId: string; revision: number; commitId: string }
export type CatalogPayload = { version?: number; data?: AppData; commit?: CommitIdentity }
export type PersistenceFailure = { ok: false; message: string; failure?: GuideFailure }
const conflictMessage = '其他页面已更新数据，本次保存已拒绝；本页输入和草稿保留。请先备份需要保留的内容，再选择“读取最新”后继续。'
function identity() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')
}
function validCommit(value: CommitIdentity | undefined): value is CommitIdentity {
  return Boolean(value && typeof value.datasetId === 'string' && value.datasetId && Number.isSafeInteger(value.revision) && value.revision > 0 && typeof value.commitId === 'string' && value.commitId)
}

/** Browser-local demo storage. Web Locks protects all tabs when available;
 * otherwise the per-store queue serializes local saves without requiring HTTPS.
 * The fallback does not provide atomic cross-tab transactions. Raw equality
 * detects already-changed legacy payloads and writes that did not keep metadata.
 * All current app writers participate; non-cooperating old apps/devtools cannot
 * be made atomic by LocalStorage and are outside this transaction protocol.
 * No business state is merged or silently refreshed across an editing session. */
export function createCatalogPersistence(initialRaw: string | null) {
  let acceptedRaw = initialRaw, insideLock = false, disposed = false
  let queue: Promise<unknown> = Promise.resolve()
  let activeContext: { actionId: string; savedState: GuideFailure['savedState'] } = { actionId: 'action-business-save', savedState: 'unconfirmed' }
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  const state = reactive({ external: false, message: '', pending: 0, supported: true, discardConfirmed: false, failure: undefined as GuideFailure | undefined })

  function changed() {
    state.external = true; state.message = conflictMessage; state.failure = branchFailure('persistence.external', conflictMessage, { savedState: 'unconfirmed', recovery: ['read-latest', 'feedback'] })
  }
  function observe(event: StorageEvent) {
    if ((event.key === STORAGE_KEY || event.key === null) && event.storageArea === localStorage && localStorage.getItem(STORAGE_KEY) !== acceptedRaw) changed()
  }
  if (typeof window !== 'undefined') window.addEventListener('storage', observe)

  function run<T>(operation: () => T | Promise<T>, fail: (message: string, failure: GuideFailure) => T, context = { actionId: 'action-business-save', savedState: 'unconfirmed' as GuideFailure['savedState'] }): Promise<T> {
    state.pending += 1
    const task = queue.then(async () => {
      try {
        const commit = async () => {
          if (disposed) { const message = '页面已关闭，未执行保存。'; return fail(message, branchFailure('persistence.disposed', message, { ...context, recovery: ['read-latest'] })) }
          if (localStorage.getItem(STORAGE_KEY) !== acceptedRaw) { changed(); const failure=branchFailure('persistence.external', conflictMessage, { ...context, recovery: ['read-latest', 'feedback'] });state.failure=failure;return fail(conflictMessage,failure) }
          activeContext = context
          insideLock = true
          try { return await operation() } finally { insideLock = false }
        }
        return locks?.request ? await locks.request(CATALOG_LOCK, { mode: 'exclusive' }, commit) : await commit()
      } catch (error) {
        const message = `无法保存到本机：${error instanceof Error ? error.message : String(error)}。原存储和当前输入保留，请重试。`
        state.message = message
        const known = getFailure(error)
        const failure=known ? createFailure({ ...known, message }) : unknownFailure(message, context.actionId, 'unconfirmed');state.failure=failure;return fail(message,failure)
      }
    }).finally(() => { state.pending -= 1 })
    queue = task.then(() => undefined, () => undefined)
    return task
  }

  /** Only callable within run(), including watcher, startup and dataset restore. */
  function write(data: AppData, replaceDataset = false) {
    if (!insideLock) throw new Error('共享数据写入必须在持久化互斥事务内执行。')
    const previous = acceptedRaw && !replaceDataset ? (JSON.parse(acceptedRaw) as CatalogPayload).commit : undefined
    const existing = validCommit(previous) && !replaceDataset ? previous : undefined
    if (existing && !Number.isSafeInteger(existing.revision + 1)) throw new Error('存储提交版本已超出安全范围，请导出备份后恢复。')
    const commit: CommitIdentity = { datasetId: existing?.datasetId || identity(), revision: (existing?.revision || 0) + 1, commitId: identity() }
    const encoded = JSON.stringify({ version: DATA_VERSION, data, commit })
    try { localStorage.setItem(STORAGE_KEY, encoded) }
    catch (error) { const message = error instanceof Error ? error.message : String(error); throw failureError(message, branchFailure('persistence.set-item', message, { ...activeContext, recovery: ['retry', 'feedback'] })) }
    acceptedRaw = encoded
    state.external = false; state.message = ''; state.failure = undefined
    return encoded
  }
  return { state, run, write, idle: () => queue, dispose() { disposed = true; if (typeof window !== 'undefined') window.removeEventListener('storage', observe) } }
}

/** Recovery is also a compare-and-swap under the same origin-wide lock. The
 * caller's captured raw payload prevents a late recovery page replacing new data. */
export async function restoreCatalogData(expectedRaw: string | null, data: AppData): Promise<{ ok: true } | PersistenceFailure> {
  const persistence = createCatalogPersistence(expectedRaw)
  try { return await persistence.run<{ ok: true } | PersistenceFailure>(() => { persistence.write(data, true); return { ok: true as const } }, (message, failure) => ({ ok: false as const, message, failure }), { actionId: 'action-json-import', savedState: 'unchanged' }) }
  finally { persistence.dispose() }
}
