import type { AppData } from './types'
import type { SalesOptionPlan, SalesOptionBinding, SalesProductRelation } from './salesConfigurationTypes'
import { planProblems, bindingProblems, relationProblems, previewSalesBinding } from './salesConfiguration'

type Receipt = { requestId: string; intent: string; sourceRevision: number; resultRevision: number }
type RecordBase = { id: string; revision: number; schemaVersion: number; receipts?: Receipt[] }
export type SalesConfigurationResult = { ok: boolean; message?: string; id?: string; plan?: SalesOptionPlan; binding?: SalesOptionBinding; bindings?: SalesOptionBinding[]; relation?: SalesProductRelation }
export interface SalesPlanSave { draft: SalesOptionPlan; expectedRevision: number; requestId: string }
export interface SalesPlanPublish { id: string; expectedRevision: number; requestId: string }
export interface SalesPlanStatus extends SalesPlanPublish { status: 'available' | 'disabled' }
export interface SalesBindingSave { draft: SalesOptionBinding; expectedRevision: number; expectedBasis: string; requestId: string }
export interface SalesBindingsSave { drafts: SalesOptionBinding[]; expectedRevisions: Record<string, number>; expectedBasis: Record<string, string>; requestId: string }
export interface SalesRelationSave { draft: SalesProductRelation; expectedRevision: number; requestId: string }
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const fail = (message: string): SalesConfigurationResult => ({ ok: false, message })
function intent(action: string, value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const { receipts: _receipts, updatedAt: _updatedAt, createdAt: _createdAt, revision: _revision, ...content } = value as Record<string, unknown>
    return JSON.stringify([action, content])
  }
  return JSON.stringify([action, value])
}
function receipt<T extends RecordBase>(rows: T[], id: string, requestId: string, signature: string, expected: number): T | string | undefined {
  if (!requestId?.trim()) return '保存请求缺少标识，请重新发起操作。'
  const used = rows.find(row => row.schemaVersion === 1 && Array.isArray(row.receipts) && row.receipts.some(item => item.requestId === requestId))
  if (!used) return undefined
  const item = used.receipts!.find(item => item.requestId === requestId)!
  return (!id || used.id === id) && item.intent === signature && item.sourceRevision === expected && item.resultRevision === used.revision
    ? used : '该请求已用于不同内容或旧修订，请核对后发起新的保存。'
}
function checkRevision(previous: RecordBase | undefined, id: string, expected: number) {
  if (id && !previous) return '记录已不存在，本次没有重新创建。'
  if (previous && previous.schemaVersion !== 1) return '未知销售配置版本保留为只读，不能改写。'
  if (!Number.isSafeInteger(expected) || expected < 0 || (previous?.revision || 0) !== expected) return '配置已被其他操作更新，请重新读取核对；当前输入保留。'
  if (!Number.isSafeInteger(expected + 1)) return '配置修订已超出安全范围。'
  return ''
}
function recordReceipt<T extends RecordBase>(record: T, previous: T | undefined, requestId: string, signature: string) {
  record.revision = (previous?.revision || 0) + 1
  record.receipts = [...(previous?.receipts || []), { requestId, intent: signature, sourceRevision: previous?.revision || 0, resultRevision: record.revision }]
}
function safeInput(value: unknown) { return !!value && typeof value === 'object' && !Array.isArray(value) }

/** All commands mutate a private candidate only; the Store performs one protected write. */
export function saveSalesPlanCommand(data: AppData, input: SalesPlanSave, newId: () => string, now: string): SalesConfigurationResult {
  if (!safeInput(input?.draft)) return fail('选配方案草稿无效。')
  const rows = data.salesOptionPlans || [], draft = input.draft
  const signature = intent('save-plan', draft), repeated = receipt(rows, draft.id, input.requestId, signature, input.expectedRevision)
  if (typeof repeated === 'string') return fail(repeated)
  if (repeated) return { ok: true, id: repeated.id, plan: copy(repeated) }
  const previous = rows.find(item => item.id === draft.id), problem = checkRevision(previous, draft.id, input.expectedRevision)
  if (problem) return fail(problem)
  if (draft.schemaVersion !== 1) return fail('当前只支持第 1 版销售选配方案。')
  if (typeof draft.name !== 'string') return fail('请填写有效的方案名称。')
  if (JSON.stringify(draft.versions || []) !== JSON.stringify(previous?.versions || []) || (draft.publishedVersion ?? null) !== (previous?.publishedVersion ?? null)) return fail('已发布版本不能在草稿保存中改写，请发布新版本。')
  const record: SalesOptionPlan = { ...copy(draft), id: previous?.id || newId(), status: previous?.status || 'draft', name: draft.name.trim(), createdAt: previous?.createdAt || now, updatedAt: now }
  recordReceipt(record, previous, input.requestId, signature)
  const problems = planProblems(data, record)
  if (problems.length) return fail(problems.join('；'))
  data.salesOptionPlans = [...rows.filter(item => item.id !== record.id), record]
  return { ok: true, id: record.id, plan: copy(record) }
}

export function publishSalesPlanCommand(data: AppData, input: SalesPlanPublish, now: string): SalesConfigurationResult {
  const rows = data.salesOptionPlans || [], signature = intent('publish-plan', input.id), repeated = receipt(rows, input.id, input.requestId, signature, input.expectedRevision)
  if (typeof repeated === 'string') return fail(repeated)
  if (repeated) return { ok: true, id: repeated.id, plan: copy(repeated) }
  const previous = rows.find(item => item.id === input.id), problem = checkRevision(previous, input.id, input.expectedRevision)
  if (problem || !previous) return fail(problem || '方案不存在。')
  const problems = planProblems(data, previous)
  if (problems.length) return fail(problems.join('；'))
  const record = copy(previous), version = Math.max(0, ...record.versions.map(item => item.version)) + 1
  if (!Number.isSafeInteger(version)) return fail('发布版本已超出安全范围。')
  record.versions.push({ schemaVersion: 1, planId: record.id, version, name: record.name, items: copy(record.items), rules: copy(record.rules), publishedAt: now })
  record.publishedVersion = version; record.status = 'available'; record.updatedAt = now
  recordReceipt(record, previous, input.requestId, signature)
  data.salesOptionPlans = rows.map(item => item.id === record.id ? record : item)
  return { ok: true, id: record.id, plan: copy(record) }
}

export function setSalesPlanStatusCommand(data: AppData, input: SalesPlanStatus, now: string): SalesConfigurationResult {
  if (!['available', 'disabled'].includes(input.status)) return fail('请选择启用或停用。')
  const rows = data.salesOptionPlans || [], signature = intent('status-plan', [input.id, input.status]), repeated = receipt(rows, input.id, input.requestId, signature, input.expectedRevision)
  if (typeof repeated === 'string') return fail(repeated)
  if (repeated) return { ok: true, id: repeated.id, plan: copy(repeated) }
  const previous = rows.find(item => item.id === input.id), problem = checkRevision(previous, input.id, input.expectedRevision)
  if (problem || !previous) return fail(problem || '方案不存在。')
  if (input.status === 'available' && !previous.versions.some(version => version.version === previous.publishedVersion)) return fail('请先发布方案，再启用。')
  const record = copy(previous); record.status = input.status; record.updatedAt = now
  recordReceipt(record, previous, input.requestId, signature)
  data.salesOptionPlans = rows.map(item => item.id === record.id ? record : item)
  return { ok: true, id: record.id, plan: copy(record) }
}

export function saveSalesBindingsCommand(data: AppData, input: SalesBindingsSave, newId: () => string, now: string): SalesConfigurationResult {
  if (!Array.isArray(input?.drafts) || !input.drafts.length || !input.expectedBasis || !input.expectedRevisions || !input.requestId?.trim()) return fail('请选择要保存的范围，并先预览影响。')
  if (input.drafts.some(item => !safeInput(item))) return fail('范围绑定草稿无效。')
  if (new Set(input.drafts.filter(item => item.id).map(item => item.id)).size !== input.drafts.filter(item => item.id).length) return fail('同一批次不能重复修改同一绑定。')
  const original = data.salesOptionBindings || [], records: SalesOptionBinding[] = [], next = copy(data)
  for (const [index, draft] of input.drafts.entries()) {
    if (!safeInput(draft)) return fail('范围绑定草稿无效。')
    const key = draft.id || String(index), expected = input.expectedRevisions[key] ?? 0, signature = intent('save-binding', draft), requestId = `${input.requestId}:${index}`
    const repeated = receipt(original, draft.id, requestId, signature, expected)
    if (typeof repeated === 'string') return fail(repeated)
    if (repeated) { records.push(copy(repeated)); continue }
    const previous = original.find(item => item.id === draft.id), problem = checkRevision(previous, draft.id, expected)
    if (problem) return fail(problem)
    const problems = bindingProblems(data, draft)
    if (problems.length) return fail(problems.join('；'))
    const preview = previewSalesBinding(data, draft)
    if (input.expectedBasis[key] !== preview.stamp) return fail('覆盖范围或来源已变化，请重新预览；本批次未保存。')
    if (draft.enabled && preview.draftOnly) return fail('模型草稿只供预览，请选择已发布来源后正式应用。')
    const record = { ...copy(draft), id: previous?.id || newId(), updatedAt: now }
    recordReceipt(record, previous, requestId, signature); records.push(record)
  }
  next.salesOptionBindings = [...original.filter(item => !records.some(record => record.id === item.id)), ...records]
  for (const record of records.filter(item => item.enabled)) {
    const preview = previewSalesBinding(next, record)
    if (!preview.canApply || preview.draftOnly) return fail(preview.issues.concat(preview.unresolved.map(item => item.message)).join('；') || '批量范围之间存在冲突，本批次未保存。')
  }
  data.salesOptionBindings = next.salesOptionBindings
  return { ok: true, id: records[0]?.id, binding: records[0], bindings: copy(records) }
}

export function saveSalesRelationCommand(data: AppData, input: SalesRelationSave, newId: () => string, now: string): SalesConfigurationResult {
  if (!safeInput(input?.draft)) return fail('商品关系草稿无效。')
  const rows = data.salesProductRelations || [], draft = input.draft, signature = intent('save-relation', draft), repeated = receipt(rows, draft.id, input.requestId, signature, input.expectedRevision)
  if (typeof repeated === 'string') return fail(repeated)
  if (repeated) return { ok: true, id: repeated.id, relation: copy(repeated) }
  const previous = rows.find(item => item.id === draft.id), problem = checkRevision(previous, draft.id, input.expectedRevision)
  if (problem) return fail(problem)
  const problems = relationProblems(data, draft)
  if (problems.length) return fail(problems.join('；'))
  const record = { ...copy(draft), id: previous?.id || newId(), updatedAt: now }
  recordReceipt(record, previous, input.requestId, signature)
  data.salesProductRelations = [...rows.filter(item => item.id !== record.id), record]
  return { ok: true, id: record.id, relation: copy(record) }
}
