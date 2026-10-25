import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
import {catalogPublicData} from '../src/stores/catalogAccess'
import {createSeed} from '../src/domain/seed'
import {ensureRbac,commandPermissions,templateAccessResource,permissionRegistry} from '../src/domain/rbac'
import {RBAC_ENFORCEMENT_ENABLED} from '../src/domain/accessMode'
import type {AppData,Sku} from '../src/domain/types'

const output=`work/rbac-repair/proxy-${RBAC_ENFORCEMENT_ENABLED?'enforced':'default'}`;mkdirSync(output,{recursive:true})
const checks:string[]=[],clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value))
const mark=(name:string)=>{checks.push(name);console.log(`PASS proxy ${name}`)}
function fixture(){
  const data=createSeed();ensureRbac(data)
  const family={...clone(data.families[0]!),id:'guard-family',line:'v2' as const};data.families=[family,{...family,id:'legacy-mat-family',line:'v3'}]
  const sku=(id:string):Sku=>({id,recordKind:'sku',familyId:family.id,code:id,oaSkuId:'',skuName:id,status:'on_sale',variantAttrs:{},projectedAttrs:{}})
  data.skus=[sku('sku-a'),sku('sku-b'),{...sku('mat'),recordKind:'material',materialCode:'MAT-GUARDED'}]
  data.materialReceipts=[]
  data.params=[{id:'dict',name:'词典',values:['值1','值2'],valueGroups:[],participateInStructure:false}]
  data.templates=[{id:'scheme',name:'普通属性方案',parentId:null,enabled:true,structureOrder:[]},{id:'owned-model',name:'真实商品模型',parentId:null,enabled:true,structureOrder:[]}]
  data.specCanvases=[{templateId:'owned-model',productTypeId:'real-type',status:'draft',version:1,versionName:'V1',direction:'ltr',zoom:1,panX:0,panY:0,updatedAt:'2026-10-25T00:00:00Z'}]
  data.templateParams=[{templateId:'scheme',paramId:'dict',role:'variant',required:false},{templateId:'owned-model',paramId:'dict',role:'variant',required:false}]
  data.mappings=[]
  return data
}
function guard(codes:string[],raw=fixture()){const permissions=new Set(codes);return {raw,data:catalogPublicData(raw,code=>permissions.has(code))}}
function rejectsUnchanged(raw:AppData,operation:()=>unknown){const before=JSON.stringify(raw);assert.throws(operation);assert.equal(JSON.stringify(raw),before,'rejection must preserve the complete original graph')}

for(const call of [(s:Sku[])=>s.splice(-1,1),(s:Sku[])=>s.splice(-2),(s:Sku[])=>s.splice(1),(s:Sku[])=>s.splice(-Infinity)]){
  const {raw,data}=guard(['product:sku:update','product:sku:create','product:sku:delete']);rejectsUnchanged(raw,()=>call(data.skus))
}
{
  const {raw,data}=guard(['product:sku:create']);data.skus.splice(-1,undefined!,{...clone(raw.skus[0]!),id:'new-sku'});assert.equal(raw.skus.length,4);assert.equal(raw.skus.at(-1)!.id,'mat')
  const allowed=guard(['product:material:delete']);const removed=allowed.data.skus.splice(-1);assert.equal(removed[0]!.id,'mat');assert.equal(allowed.raw.skus.length,2)
}
mark('negative/omitted splice protects the actual MAT removal range; explicit undefined and authorized deletion retain native semantics')

{
  const {raw,data}=guard(['product:sku:update','product:sku:create','product:sku:delete']);rejectsUnchanged(raw,()=>{data.skus.length=1})
  rejectsUnchanged(raw,()=>{data.skus[2]={...clone(raw.skus[0]!),id:'mat'}})
  rejectsUnchanged(raw,()=>{data.skus[2]={...clone(raw.skus[0]!),id:'new-sku'}})
  rejectsUnchanged(raw,()=>{data.skus=data.skus.filter(row=>row.id!=='mat')})
  rejectsUnchanged(raw,()=>{data.skus=[...data.skus,clone(raw.skus[2]!)]})
  rejectsUnchanged(raw,()=>data.skus.push(clone(raw.skus[2]!)))
  rejectsUnchanged(raw,()=>{data.skus=data.skus.map(row=>row.id==='mat'?{...clone(row),recordKind:'sku' as const,materialCode:''}:row)})
  const legacy={...clone(raw.skus[0]!),id:'legacy-mat',familyId:'legacy-mat-family'};delete legacy.recordKind;raw.skus.push(legacy)
  rejectsUnchanged(raw,()=>data.skus.splice(-1,1))
  const receipt={...clone(raw.skus[0]!),id:'receipt-mat'};raw.skus.push(receipt);raw.materialReceipts.push({skuId:'receipt-mat'} as AppData['materialReceipts'][number]);rejectsUnchanged(raw,()=>data.skus.splice(-1,1))
  const allowed=guard(['product:sku:update']);allowed.data.skus[0]={...clone(allowed.raw.skus[0]!),skuName:'SKU合法编辑'};assert.equal(allowed.raw.skus[0]!.skuName,'SKU合法编辑')
  const material=guard(['product:material:update']);material.data.skus[2]={...clone(material.raw.skus[2]!),skuName:'物料合法编辑'};assert.equal(material.raw.skus[2]!.skuName,'物料合法编辑')
}
mark('length, index and root replacement check old/new identities including receipt/legacy MAT evidence before any change')

{
  const {raw,data}=guard(['product:sku:update']);let calls=0
  rejectsUnchanged(raw,()=>data.skus.sort((a,b)=>{if(++calls>=2)throw Error('comparator failure');return b.id.localeCompare(a.id)}))
  rejectsUnchanged(raw,()=>data.skus.sort((a,b)=>{a.skuName='illegal comparator write';return a.id.localeCompare(b.id)}))
  assert.strictEqual(data.skus.reverse(),data.skus)
  rejectsUnchanged(raw,()=>{data.skus.find(row=>row.id==='mat')!.skuName='MAT越权'})
  const before=clone(raw.skus.map(row=>row.id));data.skus.sort((a,b)=>a.id.localeCompare(b.id));assert.deepEqual(raw.skus.map(row=>row.id),before.slice().sort())
}
mark('sort throws atomically, comparator cannot mutate live records, successful sorting and guarded return chains remain usable')

{
  const raw=fixture(),data=catalogPublicData(raw,()=>true)
  for(const operation of [()=>data.users.splice(-1),()=>{data.users.length=0},()=>{data.users[0]={...clone(raw.users[0]!),roleIds:[]}},()=>{data.users=[]},()=>data.users.find(user=>user.id===raw.users[0]!.id)!.roleIds!.push('forged'),()=>data.users.map(user=>user)[0]!.roleIds!.splice(-1),()=>[...data.rbac!.roles][0]!.permissionCodes.push('forged')])rejectsUnchanged(raw,operation)
}
mark('users/RBAC remain controlled-command-only through negative splice, truncation, index/root replacement and nested readers')

{
  const {raw,data}=guard(['product:dictionary:update']);data.params[0]!.values.push('值3');data.params[0]!.values.splice(-1,1,'值4');assert.deepEqual(raw.params[0]!.values,['值1','值2','值4'])
  data.params[0]!.valueGroups.push({id:'g',name:'组',values:['值4']});assert.equal(raw.params[0]!.valueGroups.length,1)
  rejectsUnchanged(raw,()=>data.params.push({...clone(raw.params[0]!),id:'new-dictionary'}))
  rejectsUnchanged(raw,()=>{data.params=[...data.params,{...clone(raw.params[0]!),id:'new-dictionary'}]})
}
mark('nested dictionary candidates/groups require existing dictionary update; new dictionaries still require create')

{
  const scheme=guard(['product:template:update']);scheme.data.templates.find(row=>row.id==='scheme')!.name='方案修改';scheme.data.templates.find(row=>row.id==='scheme')!.structureOrder.push('dict')
  rejectsUnchanged(scheme.raw,()=>{scheme.data.templates.find(row=>row.id==='owned-model')!.name='模型越权'})
  const model=guard(['product:model:update']);model.data.templates.find(row=>row.id==='owned-model')!.name='模型修改'
  rejectsUnchanged(model.raw,()=>{model.data.templates.find(row=>row.id==='scheme')!.name='方案越权'})
  model.data.templateParams=model.data.templateParams.filter(row=>row.templateId!=='owned-model')
  model.data.templateParams.push({templateId:'owned-model',paramId:'dict',role:'common',required:true});model.data.mappings.push({categoryId:'cat',templateId:'owned-model'})
  assert.equal(model.raw.templateParams.find(row=>row.templateId==='owned-model')!.role,'common')
  scheme.data.templateParams=scheme.data.templateParams.filter(row=>row.templateId!=='scheme');scheme.data.templateParams.push({templateId:'scheme',paramId:'dict',role:'common',required:true})
  assert.equal(templateAccessResource(model.raw,'owned-model'),'model');assert.equal(templateAccessResource(model.raw,'scheme'),'template')
  assert.deepEqual(commandPermissions('removeTemplate',['owned-model'],model.raw),['product:model:delete'])
  assert.deepEqual(commandPermissions('removeTemplate',['scheme'],model.raw),['product:template:delete'])
  assert.deepEqual(commandPermissions('removeSku',['mat'],model.raw),['product:material:delete'])
  assert.deepEqual(commandPermissions('removeSku',['sku-a'],model.raw),['product:sku:delete'])
}
mark('templates, bindings and mapping mutations follow actual model ownership; MAT/SKU command deletion also uses record identity')

assert.equal(new Set(permissionRegistry().map(row=>row.code)).size,permissionRegistry().length)
writeFileSync(output+'/result.json',JSON.stringify({status:'PASS',rbacEnforced:RBAC_ENFORCEMENT_ENABLED,checks},null,2))
