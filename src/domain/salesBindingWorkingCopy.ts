import type { AppData } from './types'
import type { SalesOptionBinding, SalesBindingScope, SalesOptionPlan } from './salesConfigurationTypes'
import { salesBindingContext, salesSignature } from './salesConfiguration'
import { templateSelectorCoverage } from './templateCompatibility'

export interface SalesBindingWorkingIdentity {
  schemaVersion: 1; bindingId: string; entryNodeId: string; scope: SalesBindingScope; mode: SalesOptionBinding['mode']
}
export interface SalesBindingWorkingContext {
  key: string; identity: SalesBindingWorkingIdentity; expectedRevision: number
}

/** Sort within each AND branch and then the OR branches. Never distribute terms. */
function normalizedScope(scope: SalesBindingScope): SalesBindingScope {
  if (scope.kind === 'products') return {kind:'products',familyIds:[...new Set(scope.familyIds)].sort(),skuIds:[...new Set(scope.skuIds)].sort()}
  const next: SalesBindingScope = {kind:'model',modelId:scope.modelId,versionId:scope.versionId,...(scope.nodeId?{nodeId:scope.nodeId}:{})}
  if (scope.selector) {
    const branches = scope.selector.anyOf.map(branch => [...new Map(branch.map(term => [salesSignature(term),term])).entries()].sort(([a],[b])=>a.localeCompare(b)).map(([,term])=>JSON.parse(JSON.stringify(term))))
    next.selector = {anyOf:[...new Map(branches.map(branch => [salesSignature(branch),branch])).entries()].sort(([a],[b])=>a.localeCompare(b)).map(([,branch])=>branch)}
  }
  return next
}
export function salesBindingWorkingIdentity(draft: SalesOptionBinding, entryNodeId?: string): SalesBindingWorkingIdentity {
  return {schemaVersion:1,bindingId:draft.id||'',entryNodeId:entryNodeId??(draft.scope.kind==='model'?draft.scope.nodeId||'':''),scope:normalizedScope(draft.scope),mode:draft.mode}
}
export function salesBindingWorkingIdentityEquals(a: SalesBindingWorkingIdentity, b: SalesBindingWorkingIdentity): boolean {
  return salesSignature(a)===salesSignature(b)
}
export function salesBindingWorkingTaskKey(draft: SalesOptionBinding, entryNodeId?: string): string {
  return draft.id || `scope-v2:${salesSignature(salesBindingWorkingIdentity(draft,entryNodeId))}`
}

export function salesBindingWorkingContextProblem(data: AppData, draft: SalesOptionBinding, task: Pick<SalesBindingWorkingContext,'key'|'identity'>): string {
  try {
    if (task.identity?.schemaVersion!==1 || !salesBindingWorkingIdentityEquals(task.identity,salesBindingWorkingIdentity(draft,task.identity.entryNodeId)) || task.key!==salesBindingWorkingTaskKey(draft,task.identity.entryNodeId)) return '当前编辑任务与草稿规格范围不一致，请重新核对范围；本次未保存。'
    if (draft.scope.kind==='model') {
      const scope=draft.scope,context=salesBindingContext(data,scope.modelId,scope.versionId)
      if (!data.specCanvases.some(canvas=>canvas.templateId===scope.modelId) || scope.versionId!==null&&!data.specModelVersions.some(version=>version.id===scope.versionId&&version.templateId===scope.modelId) || context.issues.length) return '模板或版本已变化，当前范围需要重新核对。'
      if (task.identity.entryNodeId&&!context.byNode.has(task.identity.entryNodeId)) return '节点入口已不属于当前模板版本，请重新核对。'
      if (scope.selector) { const coverage=templateSelectorCoverage(context,scope.selector); if(coverage.message||!coverage.identities.size)return coverage.message||'当前规格范围已失效，请重新选择。' }
      else if (draft.mode!=='default') return '此范围尚未选择实际合法规格，不能保存旧的已接受范围。'
    }
    return ''
  } catch { return '当前工作草稿的范围身份无法确认，请重新核对。' }
}

/** Private editing content, deliberately outside the published catalog/export. */
export interface SalesBindingWorkingCopy {
  key: string; draft: SalesOptionBinding; baseRevision: number; revision: number; updatedAt: string
  identity?: SalesBindingWorkingIdentity
  planDraft?: SalesOptionPlan
  expectedPlanRevision?: number
  ui?: Record<string,unknown>
}
export interface SalesBindingWorkingCopyInput {
  key: string; draft: SalesOptionBinding; baseRevision: number; expectedRevision: number
  identity?: SalesBindingWorkingIdentity
  planDraft?: SalesOptionPlan
  expectedPlanRevision?: number
  ui?: Record<string,unknown>
}
export interface SalesBindingWorkingCopyResult {
  ok: boolean; message?: string; copy?: SalesBindingWorkingCopy; conflict?: boolean; legacy?: boolean; contextMismatch?: boolean
}
export interface SalesBindingWorkingEntry {copy:SalesBindingWorkingCopy;legacy:boolean;conflict:boolean;message?:string}
export interface SalesBindingWorkingList {ok:boolean;message?:string;copies:SalesBindingWorkingEntry[]}
export const salesBindingWorkingCopyKey = (actor: string, preview: string | null, key: string) =>
  `iyge-sales-binding-work:${JSON.stringify([actor, preview, key])}`

function workingPlanProblem(data:AppData,input:Pick<SalesBindingWorkingCopyInput,'planDraft'|'expectedPlanRevision'>):string {
  if(!input.planDraft)return input.expectedPlanRevision===undefined?'':'配置工作草稿缺少配套的项目输入，原内容保留。'
  const draft=input.planDraft,expected=input.expectedPlanRevision
  if(draft.schemaVersion!==1||typeof draft.id!=='string'||typeof expected!=='number'||!Number.isSafeInteger(expected)||expected<0)return '配置工作草稿身份或基础修订无效。'
  const plan=draft.id?data.salesOptionPlans?.find(item=>item.id===draft.id):undefined
  return draft.id?(!plan||plan.schemaVersion!==1||plan.revision!==expected?'配置项目的正式修订已变化，请重新核对；项目和范围输入均保留。':''):expected!==0?'新配置工作草稿的基础修订必须为零。':''
}

export function readSalesBindingWorkingCopy(storageKey: string, data: AppData, expectedIdentity?:SalesBindingWorkingIdentity): SalesBindingWorkingCopyResult {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return { ok: true }
    const copy = JSON.parse(raw) as SalesBindingWorkingCopy
    if (!copy || typeof copy.key !== 'string' || copy.draft?.schemaVersion !== 1 || !Number.isSafeInteger(copy.revision) || copy.revision < 1 || !Number.isSafeInteger(copy.baseRevision))
      return { ok: false, message: '工作草稿格式暂不支持，原内容保留。' }
    const legacy=!copy.identity&&!copy.planDraft
    if(copy.identity&&!salesBindingWorkingIdentityEquals(copy.identity,salesBindingWorkingIdentity(copy.draft,copy.identity.entryNodeId)))return {ok:false,message:'工作草稿的规格范围身份不一致，原内容保留，请重新核对。',contextMismatch:true}
    if(expectedIdentity&&(legacy||!salesBindingWorkingIdentityEquals(copy.identity!,expectedIdentity)))return {ok:false,legacy,contextMismatch:true,message:legacy?'发现旧格式工作草稿，请明确查看并恢复其实际范围；未套用到当前范围。':'已有工作草稿属于其他规格范围，未套用到当前编辑任务。'}
    const record = copy.draft.id ? data.salesOptionBindings?.find(item => item.id === copy.draft.id) : undefined
    const planProblem=workingPlanProblem(data,copy)
    const conflict = (copy.draft.id ? !record || record.schemaVersion !== 1 || record.revision !== copy.baseRevision : copy.baseRevision !== 0)||!!planProblem
    return { ok: true, copy, conflict, legacy, ...(conflict ? { message: planProblem||'正式配置已更新，请重新核对；工作草稿保留。' } : legacy?{message:'旧格式工作草稿，需明确核对所属范围后恢复。'}:{}) }
  } catch { return { ok: false, message: '无法读取工作草稿，原内容保留。' } }
}

export function listSalesBindingWorkingCopies(actor:string,preview:string|null,data:AppData):SalesBindingWorkingList {
  const copies:SalesBindingWorkingEntry[]=[],problems:string[]=[]
  try {
    if(typeof localStorage.key!=='function')return {ok:true,copies}
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i)
      if(!key?.startsWith('iyge-sales-binding-work:'))continue
      let owner:unknown;try{owner=JSON.parse(key.slice('iyge-sales-binding-work:'.length))}catch{continue}
      if(!Array.isArray(owner)||owner[0]!==actor||owner[1]!==preview||typeof owner[2]!=='string')continue
      const result=readSalesBindingWorkingCopy(key,data)
      if(result.copy)copies.push({copy:result.copy,legacy:!!result.legacy,conflict:!!result.conflict,message:result.message})
      else if(result.message)problems.push(result.message)
    }
    copies.sort((a,b)=>b.copy.updatedAt.localeCompare(a.copy.updatedAt))
    return {ok:!problems.length,copies,...(problems.length?{message:[...new Set(problems)].join(' ')}:{})}
  } catch {return {ok:false,copies,message:'无法读取全部工作草稿，已有内容保留。'}}
}

/** Called only under the catalog Store's identity/permission guard and Web Lock. */
export function writeSalesBindingWorkingCopy(storageKey: string, data: AppData, input: SalesBindingWorkingCopyInput): SalesBindingWorkingCopyResult {
  if (!input.key?.trim() || input.draft?.schemaVersion !== 1 || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 || !Number.isSafeInteger(input.baseRevision) || input.baseRevision < 0)
    return { ok: false, message: '工作草稿身份或版本无效。' }
  const prior = readSalesBindingWorkingCopy(storageKey, data)
  if (!prior.ok) return prior
  const planProblem=workingPlanProblem(data,input)
  if(planProblem)return {ok:false,conflict:true,message:planProblem}
  if (input.identity) {const problem=salesBindingWorkingContextProblem(data,input.draft,{key:input.key,identity:input.identity});if(problem)return {ok:false,contextMismatch:true,message:problem}}
  else if(input.key.startsWith('scope-v2:'))return {ok:false,message:'当前范围缺少工作任务身份，未保存。',contextMismatch:true}
  if ((prior.copy?.revision || 0) !== input.expectedRevision) return { ok: false, message: '工作草稿已在其他页面更新，请重新打开核对；输入保留。' }
  const record = input.draft.id ? data.salesOptionBindings?.find(item => item.id === input.draft.id) : undefined
  if (input.draft.id ? !record || record.schemaVersion !== 1 || record.revision !== input.baseRevision : input.baseRevision !== 0)
    return { ok: false, conflict: true, message: '正式配置已更新，请重新核对基础修订；输入保留。' }
  const copy: SalesBindingWorkingCopy = { key: input.key, draft: JSON.parse(JSON.stringify(input.draft)), baseRevision: input.baseRevision, revision: input.expectedRevision + 1, updatedAt: new Date().toISOString(),...(input.identity?{identity:JSON.parse(JSON.stringify(input.identity))}:{}),...(input.planDraft?{planDraft:JSON.parse(JSON.stringify(input.planDraft)),expectedPlanRevision:input.expectedPlanRevision}:{}),...(input.ui?{ui:JSON.parse(JSON.stringify(input.ui))}:{}) }
  try { localStorage.setItem(storageKey, JSON.stringify(copy)); return { ok: true, copy } }
  catch { return { ok: false, message: '工作草稿未能写入本机，当前输入保留，请重试。' } }
}

/** The formal Store command calls this inside its existing catalog lock. */
export function validateSalesBindingWorkingApplication(storageKey:string,data:AppData,draft:SalesOptionBinding,task:SalesBindingWorkingContext):string {
  const problem=salesBindingWorkingContextProblem(data,draft,task)
  if(problem)return problem
  if(!Number.isSafeInteger(task.expectedRevision)||task.expectedRevision<0)return '工作草稿修订无效，请重新核对。'
  const result=readSalesBindingWorkingCopy(storageKey,data)
  if(!result.ok)return result.message||'无法读取工作草稿。'
  if((result.copy?.revision||0)!==task.expectedRevision)return '工作草稿已在其他页面变化，请重新核对；未应用过期内容。'
  if(result.copy){
    if(result.conflict)return result.message||'正式修订已变化。'
    if(!result.copy.identity||!salesBindingWorkingIdentityEquals(result.copy.identity,task.identity))return '待应用的工作草稿属于其他范围或旧格式，请明确恢复核对后保存。'
  }
  return ''
}
