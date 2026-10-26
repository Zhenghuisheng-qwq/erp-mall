import type { AppData } from './types'
import type { SalesOptionBinding } from './salesConfigurationTypes'

/** Private editing content, deliberately outside the published catalog/export. */
export interface SalesBindingWorkingCopy {
  key: string; draft: SalesOptionBinding; baseRevision: number; revision: number; updatedAt: string
}
export interface SalesBindingWorkingCopyInput {
  key: string; draft: SalesOptionBinding; baseRevision: number; expectedRevision: number
}
export interface SalesBindingWorkingCopyResult {
  ok: boolean; message?: string; copy?: SalesBindingWorkingCopy; conflict?: boolean
}
export const salesBindingWorkingCopyKey = (actor: string, preview: string | null, key: string) =>
  `iyge-sales-binding-work:${JSON.stringify([actor, preview, key])}`

export function readSalesBindingWorkingCopy(storageKey: string, data: AppData): SalesBindingWorkingCopyResult {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return { ok: true }
    const copy = JSON.parse(raw) as SalesBindingWorkingCopy
    if (!copy || typeof copy.key !== 'string' || copy.draft?.schemaVersion !== 1 || !Number.isSafeInteger(copy.revision) || copy.revision < 1 || !Number.isSafeInteger(copy.baseRevision))
      return { ok: false, message: '工作草稿格式暂不支持，原内容保留。' }
    const record = copy.draft.id ? data.salesOptionBindings?.find(item => item.id === copy.draft.id) : undefined
    const conflict = copy.draft.id ? !record || record.schemaVersion !== 1 || record.revision !== copy.baseRevision : copy.baseRevision !== 0
    return { ok: true, copy, conflict, ...(conflict ? { message: '正式配置已更新，请重新核对；工作草稿保留。' } : {}) }
  } catch { return { ok: false, message: '无法读取工作草稿，原内容保留。' } }
}

/** Called only under the catalog Store's identity/permission guard and Web Lock. */
export function writeSalesBindingWorkingCopy(storageKey: string, data: AppData, input: SalesBindingWorkingCopyInput): SalesBindingWorkingCopyResult {
  if (!input.key?.trim() || input.draft?.schemaVersion !== 1 || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 || !Number.isSafeInteger(input.baseRevision) || input.baseRevision < 0)
    return { ok: false, message: '工作草稿身份或版本无效。' }
  const prior = readSalesBindingWorkingCopy(storageKey, data)
  if (!prior.ok) return prior
  if ((prior.copy?.revision || 0) !== input.expectedRevision) return { ok: false, message: '工作草稿已在其他页面更新，请重新打开核对；输入保留。' }
  const record = input.draft.id ? data.salesOptionBindings?.find(item => item.id === input.draft.id) : undefined
  if (input.draft.id ? !record || record.schemaVersion !== 1 || record.revision !== input.baseRevision : input.baseRevision !== 0)
    return { ok: false, conflict: true, message: '正式配置已更新，请重新核对基础修订；输入保留。' }
  const copy: SalesBindingWorkingCopy = { key: input.key, draft: JSON.parse(JSON.stringify(input.draft)), baseRevision: input.baseRevision, revision: input.expectedRevision + 1, updatedAt: new Date().toISOString() }
  try { localStorage.setItem(storageKey, JSON.stringify(copy)); return { ok: true, copy } }
  catch { return { ok: false, message: '工作草稿未能写入本机，当前输入保留，请重试。' } }
}
