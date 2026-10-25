import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
import {createPinia,setActivePinia} from 'pinia'
import {nextTick} from 'vue'
import {installCatalogTestLocks} from './catalog-storage-test-env'
import {createSeed} from '../src/domain/seed'
import {RBAC_ENFORCEMENT_ENABLED} from '../src/domain/accessMode'
import {ensureRbac,rbacProblems,permissionRegistry,effectivePermissions,isSuperAdmin,type RbacPermission} from '../src/domain/rbac'
import {normalizeStored,useCatalogStore} from '../src/stores/catalog'
import {DATA_VERSION,STORAGE_KEY,type AppData} from '../src/domain/types'

const output='work/unrestricted-access';mkdirSync(output,{recursive:true})
const disk=new Map<string,string>(),session=new Map<string,string>(),checks:string[]=[]
const restoreLocks=installCatalogTestLocks()
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>disk.get(key)??null,setItem:(key:string,value:string)=>disk.set(key,value),removeItem:(key:string)=>disk.delete(key)}})
Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:(key:string)=>session.get(key)??null,setItem:(key:string,value:string)=>session.set(key,value),removeItem:(key:string)=>session.delete(key)}})
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value))
let store:ReturnType<typeof useCatalogStore>|undefined
const mark=(name:string)=>{checks.push(name);console.log('PASS unrestricted '+name)}
const business=(data:AppData)=>clone({families:data.families,skus:data.skus,productSpecNodes:data.productSpecNodes,specModelVersions:data.specModelVersions,planningRecords:data.planningRecords,materialReceipts:data.materialReceipts,materialRelations:data.materialRelations,materialContributions:data.materialContributions,compatibilities:data.compatibilities,templateCompatibilityOrigins:data.templateCompatibilityOrigins,benefitPackages:data.benefitPackages,benefitDeliveries:data.benefitDeliveries,benefitFrameworks:data.benefitFrameworks,productListPages:data.productListPages,productListViews:data.productListViews})
async function mount(data:AppData,userId:string){
  if(store){await nextTick();await store.waitForPersistence();store.$dispose();store=undefined}
  disk.clear();session.clear();disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data:clone(data)}));session.set('iyge-rbac-simulated-user',userId)
  setActivePinia(createPinia());store=useCatalogStore();await store.waitForPersistence();return store
}
function staleFixture(){
  const data=normalizeStored({version:DATA_VERSION,data:createSeed()})!;ensureRbac(data)
  const obsolete:RbacPermission & {retainedSource:string}={code:'product:benefit:delete',name:'旧版权益包删除',description:'原备份目录记录，应原文保留。',module:'商品中心',resource:'benefit',action:'delete',kind:'operation',route:'/benefit-packages',enabled:false,builtIn:true,retainedSource:'legacy-removed-permission'}
  data.rbac!.permissions=[obsolete,{...clone(obsolete),code:'future:resource:action',name:'未来配置记录',retainedSource:'unknown-future-code'}]
  data.rbac!.roles=[{id:'legacy-disabled-role',code:'legacy-disabled',name:'旧停用角色',description:'不参与本轮授权',enabled:false,permissionCodes:['product:benefit:delete','future:missing:permission']},{id:'ordinary-role',code:'ordinary',name:'普通角色',description:'无权限',enabled:true,permissionCodes:[]}]
  data.users.forEach(user=>{user.role='operator';user.roleIds=['ordinary-role']})
  data.users.push({id:'disabled-role-user',username:'disabled-role-user',displayName:'停用角色用户',role:'operator',enabled:true,roleIds:['legacy-disabled-role']},{id:'disabled-user',username:'disabled-user',displayName:'旧停用模拟用户',role:'operator',enabled:false,roleIds:['missing-role-from-old-backup']})
  data.activeRole='operator'
  return data
}
try{
  assert.equal(RBAC_ENFORCEMENT_ENABLED,false,'This task explicitly keeps enforcement disabled')
  const input=staleFixture(),authOriginal=clone(input.rbac),businessOriginal=business(input)
  assert.deepEqual(rbacProblems(input),[])
  const normalized=normalizeStored({version:DATA_VERSION,data:clone(input)})!
  assert.deepEqual(normalized.rbac,authOriginal);assert.deepEqual(business(normalized),businessOriginal)
  ensureRbac(normalized);assert.deepEqual(normalized.rbac,authOriginal)
  mark('obsolete product:benefit:delete, unknown code, directory drift and dangling old roles open without RBAC reset')

  for(const userId of ['u-op','disabled-role-user','disabled-user','old-deleted-simulated-user']){
    const s=await mount(input,userId)
    assert(s.authorizationReady);assert.equal(s.rbacEnforced,false);assert.equal(s.isAdmin,true,userId)
    for(const code of ['product:spu:update','product:model:publish','product:material:create','product:benefit:update','system:role:grant','system:menu:update'])assert.equal(s.can(code),true,`${userId}:${code}`)
    for(const path of ['/spus','/skus','/models','/specs','/materials/new','/benefit-packages/new','/menus','/roles','/permissions','/users'])assert.equal(s.canRoute({path}),true,`${userId}:${path}`)
    assert.equal(s.canRoute({path:'/not-a-registered-page'}),false,'Disabled RBAC does not register arbitrary pages')
    assert.equal(isSuperAdmin(s.data,userId),true)
    assert.deepEqual([...effectivePermissions(s.data,userId)].sort(),permissionRegistry().map(permission=>permission.code).sort())
    assert.deepEqual(s.data.rbac,authOriginal);assert.deepEqual(business(s.data),businessOriginal)
    const badFamily={...clone(s.data.families[0]!),name:''}
    const invalid=await s.saveSpu(badFamily);assert.equal(invalid.ok,false);assert.match(invalid.message||'',/填写 SPU 名称/,'The real command reaches business validation instead of RBAC refusal')
    const exported=s.exportJson();await s.importJson(exported)
    assert.deepEqual(s.data.rbac,authOriginal);assert.deepEqual(business(s.data),businessOriginal)
    const stored=JSON.parse(disk.get(STORAGE_KEY)!).data as AppData
    assert.deepEqual(stored.rbac,authOriginal);assert.deepEqual(business(stored),businessOriginal)
  }
  mark('ordinary, disabled-role, disabled-user and obsolete simulated IDs all use registered administrator access in real Store')
  mark('real SPU command still validates business fields; legitimate export/import preserves unknown authorization and business snapshots')

  const s=await mount(input,'u-op'),before=JSON.stringify(s.data),raw=disk.get(STORAGE_KEY)
  const damaged=clone(input)
  ;(damaged.productSpecNodes[0] as unknown as {businessConfigs:unknown}).businessConfigs={id:'object-not-array'}
  assert.throws(()=>normalizeStored({version:DATA_VERSION,data:clone(damaged)}),/业务配置结构校验失败/)
  await assert.rejects(()=>s.importJson(JSON.stringify({version:DATA_VERSION,data:damaged})),/业务配置结构校验失败/)
  assert.equal(JSON.stringify(s.data),before);assert.equal(disk.get(STORAGE_KEY),raw)
  mark('genuine damaged businessConfigs containers still reject normalization/import atomically')

  await nextTick();await s.waitForPersistence();s.$dispose();store=undefined
  const damagedRaw=JSON.stringify({version:DATA_VERSION,data:damaged});disk.set(STORAGE_KEY,damagedRaw);setActivePinia(createPinia())
  assert.throws(()=>useCatalogStore(),/无法安全读取|业务配置结构校验失败/)
  assert.equal(disk.get(STORAGE_KEY),damagedRaw)
  mark('damaged business startup still preserves original storage instead of silently loading seed data')
  writeFileSync(output+'/result.json',JSON.stringify({status:'PASS',mode:'unrestricted-mock-administrator',checks},null,2))
}finally{store?.$dispose();restoreLocks()}
