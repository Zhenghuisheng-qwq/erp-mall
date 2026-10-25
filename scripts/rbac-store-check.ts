import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
import {createPinia,setActivePinia} from 'pinia'
import {nextTick} from 'vue'
import {installCatalogTestLocks} from './catalog-storage-test-env'
import {createSeed} from '../src/domain/seed'
import {defaultMenuNodes,MENU_KEY} from '../src/domain/menuConfig'
import {ensureRbac,type RbacRole} from '../src/domain/rbac'
import {normalizeStored,useCatalogStore,catalogMigrationError} from '../src/stores/catalog'
import {DATA_VERSION,STORAGE_KEY,type AppData} from '../src/domain/types'

const output='work/rbac/store';mkdirSync(output,{recursive:true})
const disk=new Map<string,string>(),session=new Map<string,string>(),checks:string[]=[]
const restoreLocks=installCatalogTestLocks()
let failNext=false,store:ReturnType<typeof useCatalogStore>|undefined
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>disk.get(key)??null,setItem:(key:string,value:string)=>{if(failNext){failNext=false;throw Error('RBAC quota injection')};disk.set(key,value)},removeItem:(key:string)=>disk.delete(key)}})
Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:(key:string)=>session.get(key)??null,setItem:(key:string,value:string)=>session.set(key,value),removeItem:(key:string)=>session.delete(key)}})
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value))
const mark=(name:string)=>{checks.push(name);console.log('PASS RBAC Store '+name)}
const snapshot=()=>JSON.stringify(store!.data)
const raw=()=>disk.get(STORAGE_KEY)
const payload=()=>JSON.parse(raw()!).data as AppData
async function mount(data:AppData,userId='u-admin',menus=defaultMenuNodes(),fail=false){
  if(store){await nextTick();await store.waitForPersistence();store.$dispose()}
  disk.clear();session.clear();disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data:clone(data)}));disk.set(MENU_KEY,JSON.stringify({version:1,nodes:menus}));session.set('iyge-rbac-simulated-user',userId);failNext=fail
  setActivePinia(createPinia());store=useCatalogStore();await store.waitForPersistence();return store
}
const normalized=()=>normalizeStored({version:DATA_VERSION,data:createSeed()})!
function fixture(){
  const data=normalized();ensureRbac(data)
  const role=(id:string,permissionCodes:string[]):RbacRole=>({id,code:id,name:id,description:'独立验收',enabled:true,permissionCodes})
  data.rbac!.roles.push(role('spu-editor',['product:spu:read','product:spu:update']),role('model-editor',['product:model:read','product:model-designer:read','product:model:update','product:model:publish']),role('limited-delegator',['system:role:read','system:role:grant','product:spu:read','product:spu:update']),role('importer',['product:spu:read','product:import:read','product:import:execute']))
  data.users.push({id:'only-spu',username:'only-spu',displayName:'仅SPU编辑',role:'operator',enabled:true,roleIds:['spu-editor']},{id:'only-model',username:'only-model',displayName:'仅模型',role:'operator',enabled:true,roleIds:['model-editor']},{id:'multi',username:'multi',displayName:'多角色',role:'operator',enabled:true,roleIds:['spu-editor','model-editor']},{id:'delegator',username:'delegator',displayName:'有限委派',role:'operator',enabled:true,roleIds:['limited-delegator']},{id:'importer',username:'importer',displayName:'仅导入入口',role:'operator',enabled:true,roleIds:['importer']})
  data.activeRole='admin';return data
}
async function refuses(operation:()=>unknown){let refused=false;try{const result=await operation() as {ok?:boolean};refused=result?.ok===false}catch{refused=true}assert(refused,'Expected exact Store operation to refuse')}
try{
  // Isolate the RBAC-only extension of an otherwise normalized existing dataset.
  const legacy=normalized();delete legacy.rbac;legacy.users=legacy.users.map(user=>{const old={...user};delete old.roleIds;return old});legacy.activeRole='admin'
  const history=clone({families:legacy.families,skus:legacy.skus,productSpecNodes:legacy.productSpecNodes,specModelVersions:legacy.specModelVersions,planningRecords:legacy.planningRecords,productListViews:legacy.productListViews,productListPages:legacy.productListPages})
  let s=await mount(legacy)
  assert(s.authorizationReady&&s.isAdmin);assert(s.data.users.every(user=>Array.isArray(user.roleIds)))
  assert.deepEqual(clone({families:s.data.families,skus:s.data.skus,productSpecNodes:s.data.productSpecNodes,specModelVersions:s.data.specModelVersions,planningRecords:s.data.planningRecords,productListViews:s.data.productListViews,productListPages:s.data.productListPages}),history)
  const migrated=payload();s=await mount(migrated);assert.deepEqual(s.data.rbac,migrated.rbac)
  const restricted=defaultMenuNodes();restricted.find(node=>node.id==='manage')!.roles=['admin']
  s=await mount(legacy,'u-op',restricted);assert(!s.can('product:spu:read'));assert(!s.canRoute({path:'/spus'}));assert(s.can('product:workbench:read'))
  mark('legacy candidate migration preserves business/history/views; parent menu restrictions and reload idempotence')

  for(const id of ['u-admin','u-op','only-spu','only-model','multi']){
    s=await mount(fixture(),id)
    const spu=['u-admin','u-op','only-spu','multi'].includes(id),model=['u-admin','only-model','multi'].includes(id)
    assert.equal(s.canRoute({path:'/spus'}),spu,id);assert.equal(s.canRoute({path:'/models'}),model,id);assert.equal(s.canRoute({path:'/not-registered'}),false)
    assert.equal(s.isAdmin,id==='u-admin')
    if(id!=='u-admin'){
      const before=snapshot(),previous=raw();await refuses(()=>s.saveRbacRole({id:'forged',code:'forged',name:'假管理员',description:'',enabled:true,superAdmin:true,permissionCodes:[]}));assert.equal(snapshot(),before);assert.equal(raw(),previous)
    }
    if(id==='only-spu'){
      const family=clone(s.data.families[0]!);family.name+=' 授权编辑';assert((await s.saveSpu(family)).ok)
      const before=snapshot(),previous=raw();await refuses(()=>s.publishSpecModel(s.data.templates[0]!.id));await refuses(()=>s.updateMaterial({skuId:'fake',skuName:'',supplierCode:'',guanjiapoCode:'',oaSkuId:'',materialDescription:''}));assert.equal(snapshot(),before);assert.equal(raw(),previous)
    }
  }
  mark('five actual users share can/canRoute/Store guards; SPU edit grants no model/material/system power or isAdmin')

  s=await mount(fixture());assert(s.startPermissionPreview('multi').ok);assert(!s.isAdmin&&s.can('product:spu:update')&&s.can('product:model:publish'));const base=s.activeUserId;assert.equal(base,'u-admin');assert.equal(session.get('iyge-rbac-simulated-user'),'u-admin')
  assert(s.stopPermissionPreview().ok&&s.isAdmin)
  const modelRole=clone(s.data.rbac!.roles.find(role=>role.id==='model-editor')!);modelRole.enabled=false;assert((await s.saveRbacRole(modelRole)).ok)
  assert(s.startPermissionPreview('multi').ok);assert(!s.can('product:model:publish')&&s.can('product:spu:update'));s.stopPermissionPreview()
  const disabledUser=clone(s.data.users.find(user=>user.id==='multi')!);disabledUser.enabled=false;assert((await s.saveRbacUser(disabledUser)).ok);assert.equal(s.startPermissionPreview('multi').ok,false)
  s=await mount(fixture(),'only-spu');assert.equal(s.startPermissionPreview('u-admin').ok,false);assert.equal(s.simulateUser('u-admin').ok,false)
  mark('multi-role union, role/user disable, separate preview and non-root simulation protection')

  s=await mount(fixture());const before=snapshot(),previous=raw()
  await refuses(()=>s.removeRbacRole('spu-editor'));await refuses(()=>s.saveRbacUser({...clone(s.data.users.find(user=>user.id==='u-admin')!),enabled:false}));await refuses(()=>s.removeRbacRole('role:super-admin'));assert.equal(snapshot(),before);assert.equal(raw(),previous)
  assert(s.startPermissionPreview('delegator').ok);await refuses(()=>s.grantRbacRole('spu-editor',['product:model:read','product:model:update']));s.stopPermissionPreview();assert.equal(snapshot(),before);assert.equal(raw(),previous)
  mark('referenced role deletion, last super administrator loss and excess delegation reject atomically')
  const authBeforeMenu=JSON.stringify(s.data.rbac),businessBeforeMenu=snapshot(),rawBeforeMenu=raw(),menu=defaultMenuNodes()
  menu.find(node=>node.route==='/spus')!.hidden=true
  assert((await s.saveMenuStructure(menu)).ok);assert.equal(JSON.stringify(s.data.rbac),authBeforeMenu);assert.equal(snapshot(),businessBeforeMenu);assert.equal(raw(),rawBeforeMenu)
  assert(s.startPermissionPreview('u-op').ok);assert(s.canRoute({path:'/spus'}));s.stopPermissionPreview()
  mark('menu hidden state changes navigation only; persisted grants and direct-route access are unchanged')
  const beforeProxy=snapshot(),diskBeforeProxy=raw()
  const userReaders=[()=>s.data.users.find(user=>user.id==='u-op')!,()=>s.data.users.map(user=>user).find(user=>user.id==='u-op')!,()=>[...s.data.users].find(user=>user.id==='u-op')!]
  for(const reader of userReaders)await refuses(()=>reader().roleIds!.push('role:super-admin'))
  const roleReaders=[()=>s.data.rbac!.roles.find(role=>role.id==='spu-editor')!,()=>s.data.rbac!.roles.map(role=>role).find(role=>role.id==='spu-editor')!,()=>[...s.data.rbac!.roles].find(role=>role.id==='spu-editor')!]
  for(const reader of roleReaders)await refuses(()=>reader().permissionCodes.push('system:role:grant'))
  assert.equal(snapshot(),beforeProxy);assert.equal(raw(),diskBeforeProxy)
  const historyFixture=fixture();historyFixture.rbac!.roles.find(role=>role.id==='model-editor')!.permissionCodes=historyFixture.rbac!.roles.find(role=>role.id==='model-editor')!.permissionCodes.filter(code=>code!=='product:model:publish')
  s=await mount(historyFixture,'only-model');assert(s.can('product:model:update'));assert(!s.can('product:model:publish'))
  const historyBefore=snapshot(),historyDisk=raw();assert(s.data.specModelVersions[0]!.nodesSnapshot.length)
  await refuses(()=>{s.data.specModelVersions.find(version=>version.id===s.data.specModelVersions[0]!.id)!.nodesSnapshot[0]!.valueId='attempted-history-rewrite'})
  assert.equal(snapshot(),historyBefore);assert.equal(raw(),historyDisk)
  mark('find/map/iterator cannot bypass command-only users/RBAC or frozen historical model snapshots')
  const skuFixture=fixture();skuFixture.rbac!.roles.push({id:'sku-editor',code:'sku-editor',name:'SKU编辑',description:'仅SKU',enabled:true,permissionCodes:['product:sku:read','product:sku:update']});skuFixture.users.push({id:'only-sku',username:'only-sku',displayName:'仅SKU',role:'operator',enabled:true,roleIds:['sku-editor']})
  skuFixture.skus.push({...clone(skuFixture.skus[0]!),id:'rbac-mat',recordKind:'material',materialCode:'MAT-RBAC-ONLY',skuName:'保留物料名称'})
  s=await mount(skuFixture,'only-sku');assert(s.can('product:sku:update')&&!s.can('product:material:update'))
  const returned=s.data.skus.reverse();assert.strictEqual(returned,s.data.skus,'Array mutator must return its protected receiver')
  await nextTick();await s.waitForPersistence();const afterReverse=snapshot(),diskAfterReverse=raw()
  await refuses(()=>{returned.find(item=>item.id==='rbac-mat')!.skuName='attempted-material-rewrite'})
  assert.equal(snapshot(),afterReverse);assert.equal(raw(),diskAfterReverse)
  mark('array mutator return chains remain guarded and cannot convert SKU update into MAT update')




  const limitedImportFixture=fixture();limitedImportFixture.rbac!.roles.find(role=>role.id==='importer')!.permissionCodes.push('product:spu:update')
  s=await mount(limitedImportFixture,'importer');const importBase=clone(s.data),importMemory=snapshot(),importDisk=raw()
  const publishing=clone(importBase);publishing.families[0]!.shelfStatus=publishing.families[0]!.shelfStatus==='online'?'offline':'online'
  await refuses(()=>s.importJson(JSON.stringify({version:DATA_VERSION,data:publishing})));assert.equal(snapshot(),importMemory);assert.equal(raw(),importDisk)
  const metadata=clone(importBase);metadata.families[0]!.name+='授权元数据恢复';await s.importJson(JSON.stringify({version:DATA_VERSION,data:metadata}));assert.equal(s.data.families[0]!.name,metadata.families[0]!.name);assert(!s.can('product:spu:publish'))
  mark('limited import restores authorized SPU metadata but cannot bypass separate publishing permission')

  const importerFixture=fixture();importerFixture.activeRole='operator';s=await mount(importerFixture,'importer')
  const protectedData=clone(s.data),beforeImport=snapshot(),diskBefore=raw(),actor=s.activeUserId
  const forged=clone(protectedData);forged.users.find(user=>user.id==='importer')!.roleIds=['role:super-admin']
  await refuses(()=>s.importJson(JSON.stringify({version:DATA_VERSION,data:forged})));assert.equal(snapshot(),beforeImport);assert.equal(raw(),diskBefore);assert.equal(s.activeUserId,actor)
  const legacyIdentity=clone(protectedData);legacyIdentity.activeRole='admin';await s.importJson(JSON.stringify({version:DATA_VERSION,data:legacyIdentity}));assert.equal(s.activeUserId,actor);assert(!s.isAdmin);assert(!s.can('system:role:grant'))
  const sameBackup={version:DATA_VERSION,data:clone(s.data)};assert.equal(sameBackup.data.users.find(user=>user.id==='importer')!.roleIds![0],'importer')
  mark('real import checks pre-import actor; forged role binding refused; legacy activeRole cannot replace simulated session')

  s=await mount(fixture());const role=clone(s.data.rbac!.roles.find(role=>role.id==='spu-editor')!);role.name+='写盘失败';const failMemory=snapshot(),failDisk=raw();failNext=true;await refuses(()=>s.saveRbacRole(role));assert.equal(snapshot(),failMemory);assert.equal(raw(),failDisk);assert((await s.saveRbacRole(role)).ok)
  const backup=s.exportJson(),userBefore=s.activeUserId;await s.importJson(backup);assert.equal(s.activeUserId,userBefore);assert.deepEqual(s.data.rbac,payload().rbac)
  s=await mount(legacy,'u-admin',defaultMenuNodes(),true);assert(!s.authorizationReady);assert.equal(JSON.parse(raw()!).data.rbac,undefined);assert.equal(s.data.rbac,undefined);assert(catalogMigrationError().includes('迁移'))
  mark('authorization save/import roundtrip and migration write failure preserve original memory/disk and recovery evidence')
  writeFileSync(output+'/result.json',JSON.stringify({status:'PASS',checks},null,2))
}finally{store?.$dispose();restoreLocks()}
