import { reactive } from 'vue'
import { DATA_VERSION, STORAGE_KEY, type AppData } from '../domain/types'

export const CATALOG_LOCK = `${STORAGE_KEY}:commit`
type CommitIdentity = { datasetId: string; revision: number; commitId: string }
export type CatalogPayload = { version?: number; data?: AppData; commit?: CommitIdentity }
export type PersistenceFailure = { ok: false; message: string }
const conflictMessage = '其他页面已更新数据，本次保存已拒绝；本页输入和草稿保留。请先备份需要保留的内容，再选择“读取最新”后继续。'
const capabilityMessage = '当前环境无法安全保存共享数据：需要安全上下文及 Web Locks。请使用 Windows Chrome / Edge，通过 localhost 或 HTTPS 打开；当前输入保留，未退回无保护写入。'

function identity() { return crypto.randomUUID() }
function validCommit(value: CommitIdentity | undefined): value is CommitIdentity {
  return Boolean(value && typeof value.datasetId === 'string' && value.datasetId && Number.isSafeInteger(value.revision) && value.revision > 0 && typeof value.commitId === 'string' && value.commitId)
}

/** One coordinator per catalogue store. Web Locks protects all tabs; raw equality
 * detects already-changed legacy payloads and writes that did not keep metadata.
 * All current app writers participate; non-cooperating old apps/devtools cannot
 * be made atomic by LocalStorage and are outside this transaction protocol.
 * No business state is merged or silently refreshed across an editing session. */
export function createCatalogPersistence(initialRaw: string | null) {
  let acceptedRaw = initialRaw, insideLock = false, disposed = false
  let queue: Promise<unknown> = Promise.resolve()
  const supported = typeof navigator !== 'undefined' && globalThis.isSecureContext === true && Boolean(navigator.locks?.request)
  const state = reactive({ external: false, message: supported ? '' : capabilityMessage, pending: 0, supported, discardConfirmed: false })

  function changed() {
    state.external = true; state.message = conflictMessage
  }
  function observe(event: StorageEvent) {
    if ((event.key === STORAGE_KEY || event.key === null) && event.storageArea === localStorage && localStorage.getItem(STORAGE_KEY) !== acceptedRaw) changed()
  }
  if (typeof window !== 'undefined') window.addEventListener('storage', observe)

  function run<T>(operation: () => T | Promise<T>, fail: (message: string) => T): Promise<T> {
    state.pending += 1
    const task = queue.then(async () => {
      if (!supported) return fail(capabilityMessage)
      try {
        return await navigator.locks.request(CATALOG_LOCK, { mode: 'exclusive' }, async () => {
          if (disposed) return fail('页面已关闭，未执行保存。')
          if (localStorage.getItem(STORAGE_KEY) !== acceptedRaw) { changed(); return fail(conflictMessage) }
          insideLock = true
          try { return await operation() } finally { insideLock = false }
        })
      } catch (error) {
        const message = `无法保存到本机：${error instanceof Error ? error.message : String(error)}。原存储和当前输入保留，请重试。`
        state.message = message
        return fail(message)
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
    localStorage.setItem(STORAGE_KEY, encoded)
    acceptedRaw = encoded
    state.external = false; state.message = ''
    return encoded
  }
  return { state, run, write, idle: () => queue, dispose() { disposed = true; if (typeof window !== 'undefined') window.removeEventListener('storage', observe) } }
}

/** Recovery is also a compare-and-swap under the same origin-wide lock. The
 * caller's captured raw payload prevents a late recovery page replacing new data. */
export async function restoreCatalogData(expectedRaw: string | null, data: AppData): Promise<{ ok: true } | PersistenceFailure> {
  const persistence = createCatalogPersistence(expectedRaw)
  try { return await persistence.run<{ ok: true } | PersistenceFailure>(() => { persistence.write(data, true); return { ok: true as const } }, message => ({ ok: false as const, message })) }
  finally { persistence.dispose() }
}
