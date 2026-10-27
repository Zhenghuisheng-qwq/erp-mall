import type { AppData } from './types'
import type { SalesOptionPlan, SalesOptionBinding, SalesProductRelation } from './salesConfigurationTypes'
import { planProblems, bindingProblems, relationProblems, previewSalesBinding, salesConfigurationStamp, salesSignature } from './salesConfiguration'
import type { SalesBindingWorkingContext } from './salesBindingWorkingCopy'

type Receipt = { requestId: string; intent: string; sourceRevision: number; resultRevision: number }
type RecordBase = { id: string; revision: number; schemaVersion: number; receipts?: Receipt[] }
export type SalesConfigurationResult = { ok: boolean; message?: string; id?: string; plan?: SalesOptionPlan; binding?: SalesOptionBinding; bindings?: SalesOptionBinding[]; relation?: SalesProductRelation; version?:number;appliedBindingIds?:string[];replayed?:boolean }
export interface SalesPlanSave { draft: SalesOptionPlan; expectedRevision: number; requestId: string }
export interface SalesPlanPublish { id: string; expectedRevision: number; requestId: string }
export interface SalesPlanStatus extends SalesPlanPublish { status: 'available' | 'disabled' }
export interface SalesBindingSave { draft: SalesOptionBinding; expectedRevision: number; expectedBasis: string; requestId: string; workingContext?:SalesBindingWorkingContext }
export interface SalesBindingsSave { drafts: SalesOptionBinding[]; expectedRevisions: Record<string, number>; expectedBasis: Record<string, string>; requestId: string }
export interface SalesRelationSave { draft: SalesProductRelation; expectedRevision: number; requestId: string }
export interface SalesConfigurationCommit {
  planDraft: SalesOptionPlan
  expectedPlanRevision: number
  bindings: SalesOptionBinding[]
  /** Existing ID, or String(index) for an as-yet unassigned binding. */
  expectedRevisions: Record<string,number>
  expectedBasis: string
  action: 'publish-only'|'publish-apply'|'apply-existing'
  existingVersion?: number
  requestId: string
  workingContext?: SalesBindingWorkingContext
  workingCopy?: {key:string;expectedRevision:number}
}
export const salesConfigurationCommitBasis = (data:AppData) => salesConfigurationStamp(data)
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

/**
 * One candidate, one final result. The Store owns locking and the single disk
 * commit; no outer Store command is reentered from here.
 */
export function commitSalesConfigurationCommand(data:AppData,input:SalesConfigurationCommit,newId:(kind:'plan'|'binding')=>string,now:string,validateWorking?:()=>string):SalesConfigurationResult {
  if(!safeInput(input?.planDraft)||!Array.isArray(input.bindings)||input.bindings.some(binding=>!safeInput(binding))||!input.expectedRevisions||!input.requestId?.trim()||!['publish-only','publish-apply','apply-existing'].includes(input.action))return fail('权益包配置提交内容无效，请重新核对。')
  const signature=salesSignature({action:input.action,plan:intent('plan',input.planDraft),expectedPlanRevision:input.expectedPlanRevision,bindings:input.bindings.map(binding=>intent('binding',binding)),expectedRevisions:input.expectedRevisions,existingVersion:input.existingVersion??null,expectedBasis:input.expectedBasis,workingContext:input.workingContext||null,workingCopy:input.workingCopy||null})
  const transactionId=`configuration:${input.requestId}`
  const candidates=[...(data.salesOptionPlans||[]),...(data.salesOptionBindings||[])]
  for(const row of candidates){
    if(row.schemaVersion!==1||!Array.isArray(row.receipts))continue
    const used=row.receipts.find(item=>item.requestId===transactionId)
    if(!used)continue
    if(used.intent!==signature||used.resultRevision!==row.revision||!used.configuration||!Array.isArray(used.configuration.bindingIds)||typeof used.configuration.planId!=='string'||!Number.isSafeInteger(used.configuration.version))return fail('此请求已经用于不同内容或已变化的记录，请重新核对后发起新请求。')
    const saved=used.configuration,plan=data.salesOptionPlans?.find(item=>item.id===saved.planId),bindings=(data.salesOptionBindings||[]).filter(item=>saved.bindingIds.includes(item.id))
    if(!plan||bindings.length!==saved.bindingIds.length)return fail('已提交结果的记录已变化，请读取最新配置；不会重复发布。')
    return {ok:true,id:plan.id,plan:copy(plan),bindings:copy(bindings),binding:bindings[0],version:saved.version,appliedBindingIds:[...saved.bindingIds],replayed:true,message:'此请求已成功提交，没有重复发布或创建范围。'}
  }
  const workingProblem=validateWorking?.()
  if(workingProblem)return fail(workingProblem)
  if(input.expectedBasis!==salesConfigurationCommitBasis(data))return fail('配置、商品来源或适用依据在核对后已变化，请重新核对本次影响；本次未保存。')
  if(input.action==='publish-only'&&input.bindings.length)return fail('仅发布新版本时不能夹带应用范围，请明确选择发布并应用。')
  if(input.action!=='publish-only'&&!input.bindings.length)return fail('请选择本次要正式应用的明确范围。')
  // Keep even the caller's private candidate unchanged on a failed intermediate step.
  const next=copy(data)
  let plan:SalesOptionPlan|undefined,version:number
  if(input.action==='apply-existing'){
    plan=next.salesOptionPlans?.find(item=>item.id===input.planDraft.id)
    const problem=checkRevision(plan,input.planDraft.id,input.expectedPlanRevision)
    if(problem||!plan)return fail(problem||'请选择已有发布配置。')
    if(plan.status!=='available'||!plan.versions.some(item=>item.version===input.existingVersion))return fail('所选配置发布版本不存在或已停用，未自动换用最新版本。')
    version=input.existingVersion!
  }else{
    const saved=saveSalesPlanCommand(next,{draft:input.planDraft,expectedRevision:input.expectedPlanRevision,requestId:`${input.requestId}:plan`},()=>newId('plan'),now)
    if(!saved.ok||!saved.plan)return saved
    const published=publishSalesPlanCommand(next,{id:saved.plan.id,expectedRevision:saved.plan.revision,requestId:`${input.requestId}:publish`},now)
    if(!published.ok||!published.plan)return published
    plan=next.salesOptionPlans!.find(item=>item.id===published.plan!.id)!
    version=published.plan.publishedVersion!
  }
  let bindings:SalesOptionBinding[]=[]
  if(input.bindings.length){
    const drafts=input.bindings.map(binding=>({...copy(binding),enabled:true,planId:binding.mode==='none'?null:plan!.id,planVersion:binding.mode==='none'?null:version}))
    const expectedBasis=Object.fromEntries(drafts.map((draft,index)=>[draft.id||String(index),previewSalesBinding(next,draft).stamp]))
    const applied=saveSalesBindingsCommand(next,{drafts,expectedRevisions:input.expectedRevisions,expectedBasis,requestId:`${input.requestId}:bindings`},()=>newId('binding'),now)
    if(!applied.ok)return applied
    bindings=applied.bindings||[]
  }
  const holder=input.action==='apply-existing'?next.salesOptionBindings!.find(item=>item.id===bindings[0]?.id):plan
  if(!holder)return fail('本次提交缺少可追踪的正式结果，未保存。')
  holder.receipts=[...(holder.receipts||[]),{requestId:transactionId,intent:signature,sourceRevision:holder.revision-1,resultRevision:holder.revision,configuration:{planId:plan.id,version,bindingIds:bindings.map(item=>item.id)}}]
  // Existing validators check the final overall candidate, including conflicts.
  const problems=planProblems(next,plan)
  for(const binding of bindings){const preview=previewSalesBinding(next,binding);if(!preview.canApply||preview.draftOnly)problems.push(...preview.issues,...preview.unresolved.map(item=>item.message))}
  if(problems.length)return fail([...new Set(problems)].join('；'))
  data.salesOptionPlans=next.salesOptionPlans
  data.salesOptionBindings=next.salesOptionBindings
  return {ok:true,id:plan.id,plan:copy(plan),bindings:copy(bindings),binding:bindings[0],version,appliedBindingIds:bindings.map(item=>item.id),message:input.action==='publish-only'?`权益包配置 V${version} 已发布，现有范围继续使用原版本。`:`权益包配置 V${version} 已应用到 ${bindings.length} 个明确范围。`}
}
