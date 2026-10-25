import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { createSeed } from '../src/domain/seed'
import { ensureRbac, templateAccessResource } from '../src/domain/rbac'
import { RBAC_ENFORCEMENT_ENABLED } from '../src/domain/accessMode'
import { DATA_VERSION, STORAGE_KEY, type AppData } from '../src/domain/types'
import { normalizeStored, useCatalogStore, type TemplateSchemeInput } from '../src/stores/catalog'
import { installCatalogTestLocks } from './catalog-storage-test-env'

const strict=RBAC_ENFORCEMENT_ENABLED,output=`work/compact-menu-template/scheme-store/${strict?'strict':'default'}`
mkdirSync(output,{recursive:true})
const disk=new Map<string,string>(),session=new Map<string,string>(),checks:string[]=[]
const restoreLocks=installCatalogTestLocks(),clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value))
let store:ReturnType<typeof useCatalogStore>|undefined,writes=0,failWrite=false
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>disk.get(key)??null,setItem:(key:string,value:string)=>{if(key===STORAGE_KEY&&failWrite)throw Error('scheme quota failure');disk.set(key,value);if(key===STORAGE_KEY)writes++},removeItem:(key:string)=>disk.delete(key)}})
Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:(key:string)=>session.get(key)??null,setItem:(key:string,value:string)=>session.set(key,value),removeItem:(key:string)=>session.delete(key)}})
function fixture(){
  const data=normalizeStored({version:DATA_VERSION,data:createSeed()})!;ensureRbac(data)
  for(const [id,codes] of Object.entries({creator:['product:template:read','product:template:create'],editor:['product:template:read','product:template:update'],reader:['product:template:read'],model:['product:model:read','product:model:update']})){
    data.rbac!.roles.push({id:`scheme-${id}`,code:`scheme-${id}`,name:id,description:'scheme regression',enabled:true,permissionCodes:codes})
    data.users.push({id:`scheme-${id}`,username:`scheme-${id}`,displayName:id,enabled:true,role:'operator',roleIds:[`scheme-${id}`]})
  }
  data.templates.push({id:'scheme-source',name:'普通方案来源',parentId:'t-host',enabled:false,structureOrder:['p-color','p-brand']})
  data.templateParams.push({templateId:'scheme-source',paramId:'p-brand',role:'common',required:true},{templateId:'scheme-source',paramId:'p-color',role:'variant',required:false})
  return data
}
async function mount(user='creator',data=fixture()){
  if(store){await nextTick();await store.waitForPersistence();store.$dispose()}
  failWrite=false;disk.clear();session.clear();disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data:clone(data)}));session.set('iyge-rbac-simulated-user',`scheme-${user}`)
  setActivePinia(createPinia());store=useCatalogStore();await store.waitForPersistence();writes=0;assert.equal(store.rbacEnforced,strict);return store
}
const draft=():TemplateSchemeInput=>({id:'',name:'创建权限方案',structureOrder:['p-color','p-brand'],binds:[{paramId:'p-brand',role:'common',required:true},{paramId:'p-color',role:'variant',required:false}]})
const snapshot=()=>({memory:JSON.stringify(store!.data),raw:disk.get(STORAGE_KEY),writes})
async function rejected(operation:()=>unknown){const before=snapshot();let denied=false;try{const result=await operation() as {ok?:boolean};denied=result?.ok===false}catch{denied=true}assert(denied);await nextTick();await store!.waitForPersistence();assert.deepEqual(snapshot(),before)}
const mark=(name:string)=>{checks.push(name);console.log(`PASS scheme Store ${strict?'strict':'default'} ${name}`)}
try{
  let s=await mount();const input=draft(),original=clone(input),before=clone(s.data)
  const created=await s.saveTemplateScheme(input);assert(created.ok,created.message);assert('templateId'in created&&created.templateId);const id=created.templateId!
  await nextTick();await s.waitForPersistence();assert.equal(writes,1);assert.deepEqual(input,original);assert.equal(s.data.templates.find(t=>t.id===id)!.name,input.name)
  assert.deepEqual(s.data.templateParams.filter(b=>b.templateId===id),input.binds.map(b=>({templateId:id,...b})))
  const restored=normalizeStored(JSON.parse(disk.get(STORAGE_KEY)!))!;assert.deepEqual(restored.templates,s.data.templates);assert.deepEqual(restored.templateParams,s.data.templateParams)
  const after=clone(s.data);after.templates=before.templates;after.templateParams=before.templateParams;assert.deepEqual(after,before)
  mark('create-only saves template and every binding in exactly one write; input, other business and reopen remain intact')

  const update={...input,id,name:'创建后需要编辑权限'}
  if(strict)await rejected(()=>s.saveTemplateScheme(update));else assert((await s.saveTemplateScheme(update)).ok)
  s=await mount('editor');const editorInput={...draft(),id:'scheme-source',name:'已有方案编辑',enabled:true};assert((await s.saveTemplateScheme(editorInput)).ok)
  assert.equal(s.data.templates.find(t=>t.id==='scheme-source')!.parentId,'t-host')
  if(strict)await rejected(()=>s.saveTemplateScheme(draft()));else assert((await s.saveTemplateScheme(draft())).ok)
  mark('first save uses create; existing save uses update; editor cannot create in strict and parent/identity persist')

  s=await mount();const copy={...draft(),sourceId:'scheme-source',name:'普通方案完整副本'},copyInput=clone(copy),copyBefore=clone(s.data)
  const copied=await s.saveTemplateScheme(copy);assert(copied.ok,copied.message);assert('templateId'in copied&&copied.templateId);const copyId=copied.templateId!
  await nextTick();await s.waitForPersistence();assert.equal(writes,1);assert.deepEqual(copy,copyInput)
  assert.deepEqual(s.data.templates.find(t=>t.id===copyId),{...copyBefore.templates.find(t=>t.id==='scheme-source')!,id:copyId,name:copy.name,structureOrder:copy.structureOrder})
  assert.deepEqual(s.data.templateParams.filter(b=>b.templateId===copyId),copy.binds.map(b=>({templateId:copyId,...b})))
  assert.deepEqual(s.data.templateParams.filter(b=>b.templateId==='scheme-source'),copyBefore.templateParams.filter(b=>b.templateId==='scheme-source'))
  mark('copy with create but no update is one transaction, preserving source, parent, status, roles, required flags and order')

  for(const sourceId of [undefined,'scheme-source']){
    s=await mount();const failed={...draft(),...(sourceId?{sourceId}:{}),name:sourceId?'失败副本草稿':'失败新建草稿'},untouched=clone(failed)
    failWrite=true;await rejected(()=>s.saveTemplateScheme(failed));assert.deepEqual(failed,untouched);failWrite=false
    const result=await s.saveTemplateScheme(failed);assert(result.ok,result.message);await nextTick();await s.waitForPersistence();assert.equal(writes,1)
    assert.equal(s.data.templates.filter(t=>t.name===failed.name).length,1)
  }
  mark('failed new/copy writes preserve exact memory/disk and draft; retry creates one complete result')

  s=await mount('reader');if(strict){await rejected(()=>s.saveTemplateScheme(draft()));await rejected(()=>s.saveTemplateScheme({...draft(),sourceId:'scheme-source'}))}else assert((await s.saveTemplateScheme(draft())).ok)
  s=await mount();for(const invalid of [{...draft(),id:'deleted-id'},{...draft(),sourceId:'missing-source'},{...draft(),binds:[{paramId:'missing-param',role:'variant' as const,required:true}]},{...draft(),binds:[...draft().binds,draft().binds[0]!]}])await rejected(()=>s.saveTemplateScheme(invalid))
  mark('readonly, deleted sources/IDs and malformed bindings reject without partial objects or persistence')

  s=await mount('model');const modelId=s.data.specCanvases.find(c=>c.productTypeId)?.templateId;assert(modelId);assert.equal(templateAccessResource(s.data,modelId),'model')
  const modelDraft={id:modelId,name:'按模型权限保存',structureOrder:[...s.data.templates.find(t=>t.id===modelId)!.structureOrder],binds:s.data.templateParams.filter(b=>b.templateId===modelId).map(({paramId,role,required})=>({paramId,role,required}))}
  assert((await s.saveTemplateScheme(modelDraft)).ok);if(strict)await rejected(()=>s.saveTemplateScheme({...draft(),id:'scheme-source'}))
  s=await mount('editor');if(strict)await rejected(()=>s.saveTemplateScheme(modelDraft))
  await rejected(()=>s.saveTemplateScheme({...draft(),sourceId:modelId}))
  mark('model and ordinary scheme update permissions remain distinct; model copy cannot enter ordinary scheme creation')

  writeFileSync(`${output}/result.json`,JSON.stringify({status:'PASS',rbacEnforced:strict,checks},null,2))
}finally{if(store){await nextTick();await store.waitForPersistence();store.$dispose()};restoreLocks()}
