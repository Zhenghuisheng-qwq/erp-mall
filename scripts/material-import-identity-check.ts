import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
import {createPinia,setActivePinia} from 'pinia'
import {nextTick} from 'vue'
import {installCatalogTestLocks} from './catalog-storage-test-env'
import {createSeed} from '../src/domain/seed'
import {ensureRbac} from '../src/domain/rbac'
import {RBAC_ENFORCEMENT_ENABLED} from '../src/domain/accessMode'
import {normalizeStored,useCatalogStore} from '../src/stores/catalog'
import {DATA_VERSION,STORAGE_KEY,type AppData} from '../src/domain/types'

const output=`work/closure-rbac-menu/material-identity/${RBAC_ENFORCEMENT_ENABLED?'strict':'default'}`;mkdirSync(output,{recursive:true})
const disk=new Map<string,string>(),session=new Map<string,string>(),checks:string[]=[]
const restoreLocks=installCatalogTestLocks(),clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value))
let store:ReturnType<typeof useCatalogStore>|undefined
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>disk.get(key)??null,setItem:(key:string,value:string)=>disk.set(key,value),removeItem:(key:string)=>disk.delete(key)}})
Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:(key:string)=>session.get(key)??null,setItem:(key:string,value:string)=>session.set(key,value),removeItem:(key:string)=>session.delete(key)}})
const keys=['families','skus','planningRecords','materialReceipts','materialRelations'] as const
async function mount(data:AppData){if(store){await nextTick();await store.waitForPersistence();store.$dispose()};disk.clear();session.clear();disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data:clone(data)}));session.set('iyge-rbac-simulated-user','review-import-user');setActivePinia(createPinia());store=useCatalogStore();await store.waitForPersistence();return store}
function fixture(){const data=normalizeStored({version:DATA_VERSION,data:createSeed()})!;ensureRbac(data);data.rbac!.roles.push({id:'review-import-role',code:'review-import-role',name:'仅物料导入',description:'identity review',enabled:true,permissionCodes:['product:material:read','product:material:import']});data.users.push({id:'review-import-user',username:'review-import-user',displayName:'仅物料导入',role:'operator',enabled:true,roleIds:['review-import-role']});return data}
const mark=(name:string)=>{checks.push(name);console.log(`PASS material identity ${name}`)}
try{
 let s=await mount(fixture())
 for(const key of keys){
  const candidate=clone(s.data),rows=(candidate[key]||[]) as Record<string,unknown>[];Object.assign(candidate,{[key]:rows})
  const id=`duplicate-${key}`,record=key==='planningRecords'?{planningId:id}:key==='materialReceipts'?{requestId:id}:{id}
  rows.push(record,clone(record))
  const before=JSON.stringify(s.data),raw=disk.get(STORAGE_KEY),result=await s.commitMaterialImport(candidate,s.materialImportBasis())
  assert.equal(result.ok,false,key);assert.match(result.message||'',/新增或加剧重复身份/,key)
  assert.equal(JSON.stringify(s.data),before);assert.equal(disk.get(STORAGE_KEY),raw)
 }
 mark('all eight owned arrays reject newly duplicated stable identities before authorization or persistence')
 const shadow=clone(s.data),target=shadow.skus[0]!
 shadow.skus.push({...clone(target),skuName:'duplicate unauthorized SKU content'})
 const beforeShadow=JSON.stringify(s.data),diskBeforeShadow=disk.get(STORAGE_KEY),shadowResult=await s.commitMaterialImport(shadow,s.materialImportBasis())
 assert.equal(shadowResult.ok,false);assert.match(shadowResult.message||'',/重复身份/);assert.equal(JSON.stringify(s.data),beforeShadow);assert.equal(disk.get(STORAGE_KEY),diskBeforeShadow)
 mark('MAT import cannot append a differently-valued shadow row under an existing sales SKU ID')

 const historical=fixture();historical.skus.push({...clone(historical.skus[0]!),skuName:'historical second occurrence'})
 s=await mount(historical);const retained=clone(s.data),retainedDisk=disk.get(STORAGE_KEY)
 const unchanged=await s.commitMaterialImport(clone(s.data),s.materialImportBasis());assert(unchanged.ok,unchanged.message);assert.deepEqual(clone(s.data),retained);assert.equal(disk.get(STORAGE_KEY),retainedDisk)
 const increased=clone(s.data);increased.skus.push(clone(increased.skus.at(-1)!));const increasedResult=await s.commitMaterialImport(increased,s.materialImportBasis());assert.equal(increasedResult.ok,false);assert.match(increasedResult.message||'',/重复身份/)
 const edited=clone(s.data);edited.skus.at(-1)!.skuName='changed second historical occurrence'
 const editedResult=await s.commitMaterialImport(edited,s.materialImportBasis())
 if(RBAC_ENFORCEMENT_ENABLED){assert.equal(editedResult.ok,false);assert.match(editedResult.message||'',/product:sku:update/);assert.deepEqual(clone(s.data),retained);assert.equal(disk.get(STORAGE_KEY),retainedDisk)}
 else {assert(editedResult.ok,editedResult.message);assert.equal(s.data.skus.at(-1)!.skuName,'changed second historical occurrence')}
 mark('existing historical duplicates remain unchanged; count growth rejects and each changed occurrence receives actual resource authorization')
 writeFileSync(output+'/result.json',JSON.stringify({status:'PASS',rbacEnforced:RBAC_ENFORCEMENT_ENABLED,checks},null,2))
}finally{store?.$dispose();restoreLocks()}
