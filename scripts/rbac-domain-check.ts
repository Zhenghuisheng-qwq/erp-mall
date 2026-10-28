import assert from 'node:assert/strict'
import { createSeed } from '../src/domain/seed'
import { defaultMenuNodes } from '../src/domain/menuConfig'
import { ensureRbac, rbacProblems, canPermission, effectivePermissions, isSuperAdmin, permissionRegistry, routePermissions, commandPermissions, missingPermissionDependencies, type RbacState } from '../src/domain/rbac'
import type { AppData } from '../src/domain/types'
import { RBAC_ENFORCEMENT_ENABLED } from '../src/domain/accessMode'

if (!RBAC_ENFORCEMENT_ENABLED) {
  const current=createSeed();ensureRbac(current)
  assert(isSuperAdmin(current,'u-op'));assert(isSuperAdmin(current,'deleted-legacy-user'))
  assert.equal(effectivePermissions(current,'u-op').size,permissionRegistry().length)
  assert(canPermission(current,'u-op','system:role:grant'))
  current.rbac!.permissions.push({...permissionRegistry()[0]!,code:'product:benefit:delete',name:'旧目录原文'})
  assert.deepEqual(rbacProblems(current),[])
  const preserved=JSON.stringify(current.rbac);ensureRbac(current);assert.equal(JSON.stringify(current.rbac),preserved)
  console.log('PASS RBAC default remains unrestricted and preserves stale configuration; explicit VITE_RBAC_ENFORCEMENT=true runs every strict rejection below')
} else {

type Authorized = AppData & {rbac:RbacState}
const clone = <T>(value:T):T => JSON.parse(JSON.stringify(value))
const data = createSeed() as Authorized
const original = clone(data)
ensureRbac(data)
assert.deepEqual(rbacProblems(data), [])
const after = JSON.stringify(data); ensureRbac(data); assert.equal(JSON.stringify(data), after)
const unchanged = clone(data) as Partial<Authorized>; delete unchanged.rbac
unchanged.users = unchanged.users!.map(({roleIds: _roleIds, ...user}) => user)
assert.deepEqual(unchanged, original)
assert(isSuperAdmin(data,'u-admin')); assert(!isSuperAdmin(data,'u-op'))
assert(canPermission(data,'u-op','product:spu:read')); assert(!canPermission(data,'u-op','product:spu:update'))
console.log('PASS RBAC migration is idempotent; user identities survive; business/history/list data unchanged')

const restrictedMenus = defaultMenuNodes()
restrictedMenus.find(node => node.id === 'manage')!.roles = ['admin']
const restricted = createSeed() as Authorized; ensureRbac(restricted,restrictedMenus)
assert(!canPermission(restricted,'u-op','product:spu:read'))
const movedMenus = defaultMenuNodes()
movedMenus.find(node => node.route === '/models')!.parentId = 'manage'
movedMenus.find(node => node.route === '/models')!.roles = ['admin','operator']
const moved = createSeed() as Authorized; ensureRbac(moved,movedMenus)
assert(canPermission(moved,'u-op','product:model:read'))
assert(!canPermission(moved,'u-op','product:model-designer:read'))
assert(!canPermission(moved,'u-op','product:template:read'))
const hiddenMenus = defaultMenuNodes(); hiddenMenus.find(node => node.route === '/spus')!.hidden = true
const hidden = createSeed() as Authorized; ensureRbac(hidden,hiddenMenus)
assert(canPermission(hidden,'u-op','product:spu:read'))
console.log('PASS legacy parent/center restrictions and admin-only routes migrate without widening; hide is not revocation')

const role = (id:string, codes:string[]) => ({id,code:id,name:id,description:'test',enabled:true,permissionCodes:codes})
data.rbac.roles.push(role('spu-editor',['product:spu:read','product:spu:update']),role('model-editor',['product:model:read','product:model-designer:read','product:model:update','product:model:publish']))
data.users.push({id:'spu-user',username:'spu-user',displayName:'SPU编辑',role:'operator',enabled:true,roleIds:['spu-editor']},{id:'model-user',username:'model-user',displayName:'模型编辑',role:'operator',enabled:true,roleIds:['model-editor']},{id:'multi-user',username:'multi-user',displayName:'多角色',role:'operator',enabled:true,roleIds:['spu-editor','model-editor']})
assert.deepEqual(rbacProblems(data),[])
assert(canPermission(data,'spu-user','product:spu:update'))
for(const code of ['product:model:update','product:material:update','system:role:grant']) assert(!canPermission(data,'spu-user',code))
assert(!isSuperAdmin(data,'spu-user'))
assert(canPermission(data,'multi-user','product:spu:update'));assert(canPermission(data,'multi-user','product:model:publish'))
data.rbac.roles.find(item => item.id==='model-editor')!.enabled=false
assert(!canPermission(data,'multi-user','product:model:publish'));assert(canPermission(data,'multi-user','product:spu:update'))
data.users.find(item => item.id==='spu-user')!.enabled=false
assert.equal(effectivePermissions(data,'spu-user').size,0)
data.rbac.permissions.find(item => item.code==='product:spu:read')!.enabled=false
assert(!canPermission(data,'multi-user','product:spu:update')) // an inactive dependency cannot leave the write action live.
console.log('PASS five identities, exact grants, multi-role union, user/role/permission disable and explicit dependency invalidation')

for(const [path,query,expected] of [
  ['/spus/new',{},['product:spu:read','product:spu:create']],['/spus/arbitrary-id',{},['product:spu:read']],
  ['/skus/new',{spu:'one'},['product:sku:read','product:sku:create']],['/skus/sku-1',{spu:'one'},['product:sku:read']],
  ['/materials/new',{},['product:material:read','product:material:create']],['/materials/fam-1',{},['product:material:read']],
  ['/products/new',{},['product:spu:read','product:spu:create']],['/products/fam-1',{copySku:'sku-1'},['product:sku:read','product:sku:create']],
  ['/columns',{},['product:view:read','product:spu:read']],['/skus',{panel:'columns'},['product:view:read','product:sku:read']],
  ['/specs',{},['product:model-designer:read']],['/roles',{},['system:role:read']],['/permissions',{},['system:permission:read']],
  ['/forbidden',{},[]],['/not-a-route',{},null]
] as const) assert.deepEqual(routePermissions(path,query),expected,path)
assert.deepEqual(commandPermissions('unknownCommand'),['!unregistered-command'])
const familyForPublish=clone(data.families[0]!);familyForPublish.shelfStatus=familyForPublish.shelfStatus==='online'?'offline':'online';assert(commandPermissions('saveBundle',[familyForPublish,[]],data).includes('product:spu:publish'));
assert(commandPermissions('saveSpu',[{...familyForPublish,id:'new-published',shelfStatus:'online'}],data).includes('product:spu:publish'));
assert.deepEqual(commandPermissions('editSku',['sku-1',{}],data),['product:sku:update'])
assert.deepEqual(commandPermissions('publishSpecModel',['model-1'],data),['product:model:publish'])
assert.deepEqual(commandPermissions('importJson',['{}'],data),['product:import:execute'])
assert.deepEqual(commandPermissions('saveRbacRole',[{id:'new-role'}],data),['system:role:create'])
assert.deepEqual(commandPermissions('saveRbacRole',[{id:'spu-editor'}],data),['system:role:update'])
assert.deepEqual(commandPermissions('grantRbacRole',[],data),['system:role:grant'])
console.log('PASS route aliases, dynamic/new/query routes, separate model designer access and exact command bindings fail closed')

const valid = createSeed() as Authorized;ensureRbac(valid)
const broken = clone(valid);broken.rbac.roles.push({...role('fake-super',[]),superAdmin:true})
assert(rbacProblems(broken).some(message=>message.includes('超级管理员')))
const orphan = clone(valid);orphan.users[0]!.roleIds=['missing-role'];assert(rbacProblems(orphan).some(message=>message.includes('绑定')))
const noSuper = clone(valid);noSuper.users.find(user => user.id==='u-admin')!.enabled=false;assert(rbacProblems(noSuper).some(message=>message.includes('至少一个')))
const missingDirectory = clone(valid);missingDirectory.rbac.permissions.pop();assert(rbacProblems(missingDirectory).some(message=>message.includes('目录缺项')))
const unregistered = clone(valid);unregistered.rbac.permissions[0]!.code='anything:anything:anything';assert(rbacProblems(unregistered).some(message=>message.includes('未登记')))
const nullState = clone(valid);(nullState as unknown as {rbac:unknown}).rbac=null;assert.throws(()=>ensureRbac(nullState),/容器/);
const damaged = clone(valid);(damaged.rbac as unknown as {roles:unknown}).roles={};assert(rbacProblems(damaged).some(message=>message.includes('容器')))
const noDependency = clone(valid);noDependency.rbac.roles.push(role('bad',['product:spu:update']));assert(rbacProblems(noDependency).some(message=>message.includes('依赖')))
const lostRecovery = clone(valid);lostRecovery.rbac.roles[0]!.permissionCodes=lostRecovery.rbac.roles[0]!.permissionCodes.filter(code=>code!=='system:role:grant');assert(rbacProblems(lostRecovery).some(message=>message.includes('恢复路径')))
const forgedBinding = clone(valid);forgedBinding.rbac.permissions[0]!.route='/fake';assert(rbacProblems(forgedBinding).some(message=>message.includes('执行绑定')))
assert.deepEqual(missingPermissionDependencies(['product:spu:update']),['product:spu:read'])
assert.equal(new Set(permissionRegistry().map(permission=>permission.code)).size,permissionRegistry().length)
console.log('PASS malformed containers, dangling roles, forged super/admin binding, missing directory/dependencies and recovery loss are rejected')
}
