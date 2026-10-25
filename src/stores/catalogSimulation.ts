import {computed,ref,type Ref} from 'vue'
import type {AppData} from '../domain/types'
import {isSuperAdmin} from '../domain/rbac'
import {RBAC_ENFORCEMENT_ENABLED} from '../domain/accessMode'

const ID_KEY='iyge-rbac-simulated-user', RETURN_KEY=ID_KEY+':return', PROOF_KEY=ID_KEY+':return-proof', ISSUED_KEY=ID_KEY+':return-issued'
type ReturnContext={originId:string;targetId:string;token:string;enforced:boolean}
function shaped(v:unknown):v is ReturnContext {const x=v as ReturnContext;return !!x&&typeof x.originId==='string'&&typeof x.targetId==='string'&&typeof x.token==='string'&&!!x.token&&typeof x.enforced==='boolean'}

/** Return capabilities are issued only by an authorized simulation, never accepted from a public ref. */
export function createCatalogSimulation(data:AppData,activeId:Ref<string>,previewId:Ref<string>,fresh:()=>boolean){
  const context=ref<ReturnContext>()
  const issued=():ReturnContext[]=>{try{const x:unknown=JSON.parse(localStorage.getItem(ISSUED_KEY)||'[]');return Array.isArray(x)?x.filter(shaped):[]}catch{return []}}
  const same=(a:ReturnContext,b:ReturnContext)=>a.token===b.token&&a.originId===b.originId&&a.targetId===b.targetId&&a.enforced===b.enforced
  function valid(c:ReturnContext){
    return c.targetId===activeId.value&&(!RBAC_ENFORCEMENT_ENABLED||c.enforced)&&data.users.some(u=>u.id===c.originId&&u.enabled)&&isSuperAdmin(data,c.originId)&&issued().some(row=>same(row,c))
  }
  function clearSession(){try{sessionStorage.removeItem(RETURN_KEY);sessionStorage.removeItem(PROOF_KEY)}catch{}}
  try{const saved:unknown=JSON.parse(sessionStorage.getItem(RETURN_KEY)||'null');if(shaped(saved)&&saved.token===sessionStorage.getItem(PROOF_KEY)&&valid(saved))context.value=saved;else clearSession()}catch{clearSession()}
  function writeSession(id:string,next:ReturnContext|undefined){
    const sessionKeys=[ID_KEY,RETURN_KEY,PROOF_KEY],localKeys=[ID_KEY,ISSUED_KEY]
    const previousSession=sessionKeys.map(k=>sessionStorage.getItem(k)),previousLocal=localKeys.map(k=>localStorage.getItem(k))
    try{
      const records=issued().filter(r=>r.token!==context.value?.token)
      if(next)records.push(next)
      localStorage.setItem(ISSUED_KEY,JSON.stringify(records))
      if(next){sessionStorage.setItem(RETURN_KEY,JSON.stringify(next));sessionStorage.setItem(PROOF_KEY,next.token)}else clearSession()
      sessionStorage.setItem(ID_KEY,id);localStorage.setItem(ID_KEY,id)
    }catch(error){
      sessionKeys.forEach((k,i)=>{try{const v=previousSession[i];if(v===null)sessionStorage.removeItem(k);else sessionStorage.setItem(k,v!)}catch{}})
      localKeys.forEach((k,i)=>{try{const v=previousLocal[i];if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v!)}catch{}})
      throw error
    }
  }
  function simulateUser(id:string){
    if(id===activeId.value){previewId.value='';return {ok:true}}
    if(RBAC_ENFORCEMENT_ENABLED&&!fresh()||!isSuperAdmin(data,activeId.value))return {ok:false,message:'只有有效超级管理员模拟会话可以切换其他用户。'}
    if(!data.users.some(u=>u.id===id&&u.enabled))return {ok:false,message:'用户不存在或已停用。'}
    const next:ReturnContext={originId:context.value&&valid(context.value)?context.value.originId:activeId.value,targetId:id,token:typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join(''),enforced:RBAC_ENFORCEMENT_ENABLED}
    try{writeSession(id,next)}catch{return {ok:false,message:'模拟上下文无法保存，未切换用户，请重试。'}}
    context.value=next;activeId.value=id;previewId.value='';return {ok:true}
  }
  function startPermissionPreview(id:string){if(RBAC_ENFORCEMENT_ENABLED&&!fresh()||!isSuperAdmin(data,activeId.value))return {ok:false,message:'只有有效超级管理员可预览其他用户。'};if(!data.users.some(u=>u.id===id&&u.enabled))return {ok:false,message:'用户已停用或不存在。'};previewId.value=id;return {ok:true}}
  function stopPermissionPreview(){
    previewId.value=''
    if(!context.value)return {ok:true}
    if(!valid(context.value)){context.value=undefined;clearSession();return {ok:false,message:'原管理员返回会话已失效，当前身份保持。'}}
    const origin=context.value.originId
    try{writeSession(origin,undefined)}catch{return {ok:false,message:'退出模拟无法保存，当前身份保持，请重试。'}}
    activeId.value=origin;context.value=undefined;return {ok:true}
  }
  return {simulationReturnId:computed(()=>context.value?.originId||''),simulateUser,startPermissionPreview,stopPermissionPreview}
}
