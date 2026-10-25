import type { GuideFailure } from './types'
import { failureBranch } from './failureRegistry'

const kinds=new Set(['business','input','permission','persistence','conflict','unknown'])
const states=new Set(['unchanged','memory-only','unconfirmed'])
const contextKeys=new Set(['categoryId','categoryName','targetId','targetName','modelId','nodeId','nodePath','attributeId','planningId','versionId','skuId','spuId','materialId','packageId','frameworkId','revision','requiredPermissions','mode'])
const permissionContext=new Set(['requiredPermissions','mode'])
const recoveryKeys=new Set(['edit-input','choose-target','view-related','retry','repreview','read-latest','feedback'])
const strings=(value:unknown,limit=16)=>Array.isArray(value)?value.filter((item):item is string=>typeof item==='string').slice(0,limit).map(item=>item.slice(0,120)):[]
export function createFailure(value:GuideFailure):GuideFailure {
  const context=Object.fromEntries(Object.entries(value.context||{}).filter(([key,item])=>contextKeys.has(key)&&typeof item==='string'&&(value.kind!=='permission'||permissionContext.has(key))).map(([key,item])=>[key,item.slice(0,320)]))
  return {kind:value.kind,actionId:value.actionId.slice(0,120),...(value.ruleId?{ruleId:value.ruleId.slice(0,120)}:{}),message:value.message.slice(0,1800),savedState:value.savedState,...(Object.keys(context).length?{context}:{}),...(value.fields?{fields:strings(value.fields)}:{}),...(value.recovery?{recovery:strings(value.recovery).filter(action=>recoveryKeys.has(action))}:{})}
}
export function getFailure(value:unknown):GuideFailure|undefined {
  if(!value||typeof value!=='object')return undefined
  const failure=(value as {failure?:unknown}).failure
  if(!failure||typeof failure!=='object')return undefined
  const item=failure as GuideFailure
  if(!kinds.has(item.kind)||!states.has(item.savedState)||typeof item.actionId!=='string'||typeof item.message!=='string'||item.ruleId!==undefined&&typeof item.ruleId!=='string')return undefined
  return createFailure(item)
}
export type FailureOptions=Partial<Pick<GuideFailure,'context'|'fields'|'recovery'|'savedState'|'actionId'>>
export function branchFailure(branchId:string,message:string,options:FailureOptions={}):GuideFailure {
  const branch=failureBranch(branchId)
  if(!branch)throw Error(`Guide failure branch is not registered: ${branchId}`)
  return createFailure({kind:branch.kind,ruleId:branch.ruleId,actionId:options.actionId||branch.actionId,message,savedState:options.savedState||'unconfirmed',context:options.context,fields:options.fields,recovery:options.recovery})
}
export function rejectGuide(branchId:string,message:string,options:FailureOptions={}) {return {ok:false as const,message,failure:branchFailure(branchId,message,options)}}
export function withFailure<T extends object>(result:T,failure:GuideFailure):T&{failure:GuideFailure} {return Object.assign({},result,{failure:createFailure(failure)})}
export function failureError(message:string,failure:GuideFailure):Error&{failure:GuideFailure} {return Object.assign(new Error(message),{failure:createFailure(failure)})}
export function unknownFailure(message:string,actionId='action-business-save',savedState:GuideFailure['savedState']='unconfirmed'):GuideFailure {return createFailure({kind:'unknown',actionId,message,savedState,recovery:['feedback']})}
/** This copies supplied metadata only. It never classifies errors from their message text. */
export function failureForResult<T extends object>(result:T,actionId:string,savedState?:GuideFailure['savedState']):T&{failure?:GuideFailure} {
  if((result as {ok?:unknown}).ok!==false)return result
  const current=getFailure(result),message=typeof (result as {message?:unknown}).message==='string'?(result as {message:string}).message:''
  return withFailure(result,current?{...current,savedState:savedState||current.savedState}:unknownFailure(message,actionId,savedState||'unconfirmed'))
}
