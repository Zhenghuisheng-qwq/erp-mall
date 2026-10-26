import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { installCatalogTestLocks } from './catalog-storage-test-env'
import { createSalesConfigurationFixture, salesTestPlan } from './sales-configuration-fixtures'
import { useCatalogStore } from '../src/stores/catalog'
import { DATA_VERSION, STORAGE_KEY, type AppData } from '../src/domain/types'
import { previewSalesBinding } from '../src/domain/salesConfiguration'
import { RBAC_ENFORCEMENT_ENABLED as strict } from '../src/domain/accessMode'
import type { SalesOptionBinding, SalesProductRelation } from '../src/domain/salesConfigurationTypes'

installCatalogTestLocks()
const copy=<T>(v:T):T=>JSON.parse(JSON.stringify(v)),disk=new Map<string,string>(),session=new Map<string,string>(),failures:string[]=[]
let store:ReturnType<typeof useCatalogStore>|undefined,groups=0,writes=0
const storage=(map:Map<string,string>)=>({getItem:(key:string)=>map.get(key)??null,removeItem:(key:string)=>map.delete(key),setItem:(key:string,value:string)=>{if(key===STORAGE_KEY)writes++;map.set(key,value)}})
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage(disk)})
Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:storage(session)})
const grants=['product:sales-config:read','product:sales-config:update','product:compatibility:read','product:compatibility:update','product:import:read','product:import:execute']
async function mount(role='editor',change?:(data:AppData)=>void){
  await store?.waitForPersistence();store?.$dispose();disk.clear();session.clear()
  const {data}=createSalesConfigurationFixture()
  for(const [id,extra]of [['editor',[]],['publisher',['product:sales-config:publish']],['creator',['product:sales-config:create','product:compatibility:create']],['all',['product:sales-config:create','product:sales-config:publish','product:compatibility:create','product:compatibility:delete']]] as const){
    data.rbac!.roles.push({id:`repair-${id}`,code:`repair-${id}`,name:id,description:'隔离权限回归',enabled:true,permissionCodes:[...grants,...extra]})
    data.users.push({id:`repair-${id}`,username:`repair-${id}`,displayName:id,role:'operator',enabled:true,roleIds:[`repair-${id}`]})
  }
  change?.(data);disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data}));setActivePinia(createPinia());store=useCatalogStore();await store.waitForPersistence()
  if(role!=='admin')assert(store.startPermissionPreview(`repair-${role}`).ok)
  return store
}
const snapshot=()=>JSON.stringify([store!.data,disk.get(STORAGE_KEY),store!.activeUserId,store!.previewUserId,writes])
const payload=(data:AppData)=>JSON.stringify({version:DATA_VERSION,data})
const draftPlan=(id:string)=>({...salesTestPlan(id),revision:1,status:'draft' as const,versions:[],publishedVersion:null})
const relation=(id='repair-relation'):SalesProductRelation=>({schemaVersion:1,id,revision:1,enabled:true,sourceSkuId:'case-sku',targetSkuId:'film-sku',kind:'recommendation',checkTarget:'device',conclusion:'compatible',verification:'pending',conditions:[],source:'真实关系回归',note:'',updatedAt:'2026-10-26T00:00:00Z'})
const bindingInput=(binding:SalesOptionBinding,id:string)=>({draft:binding,expectedRevision:binding.id?binding.revision:0,expectedBasis:previewSalesBinding(store!.data,binding).stamp,requestId:id})
async function outcome(operation:()=>unknown){try{const value=await operation() as {ok?:boolean;message?:string}|undefined;return {ok:value?.ok!==false,message:value?.message||''}}catch(error){return {ok:false,message:String(error)}}}
async function denied(operation:()=>unknown,expected=strict){const before=snapshot(),result=await outcome(operation);assert.equal(result.ok,!expected,result.message||'Operation unexpectedly accepted');if(expected)assert.equal(snapshot(),before,'Denied operation must leave memory/disk/identity/receipts unchanged')}
async function check(name:string,run:()=>Promise<void>){try{await run();groups++;console.log(`PASS sales permission repair: ${name}`)}catch(error){failures.push(name);console.error(`FAIL sales permission repair: ${name}: ${error instanceof Error?error.message:String(error)}`)}}

await check('update-only cannot deactivate an active binding through direct or batch commands',async()=>{
  const s=await mount(),active=copy(s.data.salesOptionBindings![0]!);active.enabled=false
  await denied(()=>s.saveSalesOptionBinding(bindingInput(active,'disable-direct')))
  if(strict){const other={...copy(s.data.salesOptionBindings![1]!),enabled:false};await denied(()=>s.saveSalesOptionBindings({drafts:[active,other],expectedRevisions:{[active.id]:active.revision,[other.id]:other.revision},expectedBasis:{[active.id]:previewSalesBinding(s.data,active).stamp,[other.id]:previewSalesBinding(s.data,other).stamp},requestId:'disable-batch'}))}
})
await check('publish grant permits deactivate/reactivate; update grant retains draft maintenance',async()=>{
  let s=await mount('publisher'),row={...copy(s.data.salesOptionBindings![0]!),enabled:false}
  const disabled=await s.saveSalesOptionBinding(bindingInput(row,'legal-disable'));assert(disabled.ok&&disabled.binding)
  row={...copy(disabled.binding),enabled:true};assert((await s.saveSalesOptionBinding(bindingInput(row,'legal-enable'))).ok)
  s=await mount('editor',data=>{data.salesOptionBindings![0]!.enabled=false});row={...copy(s.data.salesOptionBindings![0]!),name:'只改未启用草稿'}
  assert((await s.saveSalesOptionBinding(bindingInput(row,'draft-edit'))).ok)
})
await check('first plan import requires create just like direct creation',async()=>{
  let s=await mount('publisher',data=>{delete data.salesOptionPlans;delete data.salesOptionBindings})
  const fresh={...draftPlan(''),revision:0};await denied(()=>s.saveSalesOptionPlan({draft:fresh,expectedRevision:0,requestId:'create-without-grant'}))
  s=await mount('publisher',data=>{delete data.salesOptionPlans;delete data.salesOptionBindings});const incoming=copy(s.data)
  incoming.salesOptionPlans=[draftPlan('import-first-plan')];await denied(()=>s.importJson(payload(incoming)))
})
await check('draft plan create import needs no publish grant and malformed container never becomes empty',async()=>{
  const s=await mount('creator',data=>{delete data.salesOptionPlans;delete data.salesOptionBindings}),incoming=copy(s.data)
  incoming.salesOptionPlans=[draftPlan('draft-first-plan')];assert((await outcome(()=>s.importJson(payload(incoming)))).ok)
  const malformed=copy(s.data) as any;malformed.salesOptionPlans={};await denied(()=>s.importJson(payload(malformed)),true)
})
await check('first relationship import requires compatibility create; update/delete remain distinct',async()=>{
  let s=await mount('publisher',data=>{delete data.salesProductRelations}),incoming=copy(s.data)
  incoming.salesProductRelations=[relation()];await denied(()=>s.importJson(payload(incoming)))
  s=await mount('creator',data=>{delete data.salesProductRelations});incoming=copy(s.data);incoming.salesProductRelations=[relation()];assert((await outcome(()=>s.importJson(payload(incoming)))).ok)
  incoming=copy(s.data);incoming.salesProductRelations![0]!.note='合法编辑';assert((await outcome(()=>s.importJson(payload(incoming)))).ok)
  incoming=copy(s.data);delete incoming.salesProductRelations;await denied(()=>s.importJson(payload(incoming)))
  s=await mount('all',data=>{data.salesProductRelations=[relation()]});incoming=copy(s.data);delete incoming.salesProductRelations;assert((await outcome(()=>s.importJson(payload(incoming)))).ok);assert.equal(s.data.salesProductRelations,undefined)
})
await check('first binding import follows binding update contract; active effect always requires publish',async()=>{
  const fixture=createSalesConfigurationFixture(),row={...copy(fixture.phoneBinding),enabled:false}
  let s=await mount('editor',data=>{delete data.salesOptionBindings}),incoming=copy(s.data);incoming.salesOptionBindings=[row]
  assert((await outcome(()=>s.importJson(payload(incoming)))).ok)
  incoming=copy(s.data);incoming.salesOptionBindings![0]!.enabled=true;await denied(()=>s.importJson(payload(incoming)))
  s=await mount('editor');incoming=copy(s.data);incoming.salesOptionBindings![0]!.enabled=false;await denied(()=>s.importJson(payload(incoming)))
})

const request=navigator.locks.request.bind(navigator.locks)
let gate: {entered:()=>void;wait:Promise<void>}|undefined
navigator.locks.request=((name:string,options:LockOptions,callback:LockGrantedCallback)=>request(name,options,async lock=>{const held=gate;gate=undefined;if(held){held.entered();await held.wait}return callback(lock)})) as typeof navigator.locks.request
function hold(){let entered!:()=>void,release!:()=>void;const ready=new Promise<void>(resolve=>entered=resolve),wait=new Promise<void>(resolve=>release=resolve);gate={entered,wait};return {ready,release}}
await check('queued binding recomputes publish needs from current record and permission state',async()=>{
  const s=await mount('admin',data=>{data.salesOptionBindings![0]!.enabled=false;for(const role of data.rbac!.roles)if(!role.superAdmin)role.permissionCodes=role.permissionCodes.filter(code=>code!=='product:sales-config:publish')}),old=copy(s.data.salesOptionBindings![0]!),held=hold()
  const enable=s.saveSalesOptionBinding(bindingInput({...old,enabled:true},'queued-enable'));await held.ready
  const permission=copy(s.data.rbac!.permissions.find(item=>item.code==='product:sales-config:publish')!);permission.enabled=false
  const revoke=s.saveRbacPermission(permission)
  const late=s.saveSalesOptionBinding({...bindingInput(old,'queued-disable'),expectedRevision:old.revision+1,expectedBasis:'earlier-preview'})
  held.release();assert((await enable).ok);assert((await revoke).ok);const before=snapshot(),result=await late
  assert.equal(result.ok,false);if(strict)assert.match(result.message!,/授权已变化/);assert.equal(snapshot(),before)
})
await check('queued import never commits under a changed operator/preview identity',async()=>{
  const s=await mount('all'),incoming=copy(s.data);incoming.salesOptionPlans![0]!.name+='未提交编辑';const held=hold()
  const pending=outcome(()=>s.importJson(payload(incoming)));await held.ready;assert(s.stopPermissionPreview().ok)
  const before=snapshot();held.release();assert.equal((await pending).ok,false);assert.equal(snapshot(),before)
})
await store?.waitForPersistence();store?.$dispose()
assert.deepEqual(failures,[],`Failed repair cases: ${failures.join('; ')}`)
console.log(`PASS sales permission repair ${groups} groups (${strict?'strict':'default'})`)
