import assert from 'node:assert/strict'
import {defaultMenuNodes,loadMenu,sanitizeMenu,railModel,MENU_KEY,saveMenu} from '../src/domain/menuConfig'
import {createSeed} from '../src/domain/seed'
import {ensureRbac,canPermission,routePermissions} from '../src/domain/rbac'
import {RBAC_ENFORCEMENT_ENABLED} from '../src/domain/accessMode'
const disk=new Map<string,string>();let writes=0,failWrite=false
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>disk.get(key)||null,setItem:(key:string,value:string)=>{if(failWrite)throw Error('menu quota');disk.set(key,value);writes++},removeItem:(key:string)=>disk.delete(key)}})
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value))
const defaultNodes=defaultMenuNodes(),guide=defaultNodes.find(n=>n.route==='/guide')!
assert.equal(guide.parentId,'guide');assert.equal(guide.title,'系统说明')
const fresh=railModel(()=>true,defaultNodes);assert.equal(fresh.find(g=>g.key==='guide')?.directIndex,'/guide');assert(fresh.findIndex(g=>g.key==='guide')>fresh.findIndex(g=>g.key==='system'))
const legacy=defaultNodes.filter(n=>n.id!=='guide').map(n=>n.route==='/guide'?{...n,parentId:'product',title:'业务指南',permissionCode:'system:guide:read'}:n)
legacy.find(n=>n.route==='/skus')!.title='自定义销售规格';legacy.find(n=>n.route==='/brands')!.hidden=true;legacy.find(n=>n.id==='system')!.sort=12
legacy.push({id:'custom-center-preserved',kind:'center',title:'已有中心',parentId:null,sort:13,route:'',hidden:false,roles:['admin','operator'],custom:true},{id:'custom-group-preserved',kind:'group',title:'已有分组',parentId:'product',sort:90,route:'',hidden:false,roles:['admin','operator'],custom:true})
const expectedOthers=clone(legacy.filter(n=>n.route!=='/guide'))
disk.set(MENU_KEY,JSON.stringify({version:1,nodes:legacy}));const migrated=loadMenu(),stored=JSON.parse(disk.get(MENU_KEY)!)
assert.equal(writes,1);assert.equal(stored.guideCenterVersion,1);assert.equal(stored.nodes.find((n:{route:string})=>n.route==='/guide').parentId,'guide');assert.equal(migrated.find(n=>n.route==='/guide')!.permissionCode,'system:guide:read');assert.deepEqual(migrated.filter(n=>n.route!=='/guide'&&n.id!=='guide'),expectedOthers)
const first=disk.get(MENU_KEY);assert.deepEqual(loadMenu(),migrated);assert.equal(disk.get(MENU_KEY),first);assert.equal(writes,1);assert.equal(migrated.filter(n=>n.id==='guide').length,1);assert.equal(migrated.filter(n=>n.route==='/guide').length,1)
const ordered=railModel(()=>true,migrated);assert.equal(ordered[ordered.findIndex(g=>g.key==='system')+1]!.key,'guide')
for(const hidden of [false,true]){const saved=clone(legacy);Object.assign(saved.find(n=>n.route==='/guide')!,{title:'自定义培训说明',hidden});disk.set(MENU_KEY,JSON.stringify({version:1,nodes:saved}));const rows=loadMenu(),page=rows.find(n=>n.route==='/guide')!;assert.equal(page.title,'自定义培训说明');assert.equal(page.hidden,hidden);assert.equal(page.permissionCode,'system:guide:read');assert.equal(railModel(()=>true,rows).some(g=>g.key==='guide'),!hidden);if(!hidden)assert.equal(railModel(()=>true,rows).find(g=>g.key==='guide')!.title,page.title)}
disk.set(MENU_KEY,JSON.stringify({version:1,nodes:legacy}));const before=disk.get(MENU_KEY);failWrite=true;assert.equal(loadMenu().find(n=>n.route==='/guide')!.parentId,'guide');assert.equal(disk.get(MENU_KEY),before);failWrite=false
const data=createSeed();ensureRbac(data);data.rbac!.roles.push({id:'menu-guide-reader',code:'menu-guide-reader',name:'仅说明',description:'test',enabled:true,permissionCodes:['system:guide:read']},{id:'menu-no-guide',code:'menu-no-guide',name:'无说明',description:'test',enabled:true,permissionCodes:['product:category:read']})
for(const id of ['menu-guide-reader','menu-no-guide'])data.users.push({id,username:id,displayName:id,enabled:true,role:'operator',roleIds:[id]})
const allowed=(id:string)=>(location:{path:string;query?:Record<string,string>})=>{const permissions=routePermissions(location.path,location.query);return permissions!==null&&permissions.every(code=>canPermission(data,id,code))}
const reader=railModel(allowed('menu-guide-reader'),defaultNodes),nonreader=railModel(allowed('menu-no-guide'),defaultNodes)
assert(reader.some(g=>g.key==='guide'));assert.equal(allowed('menu-guide-reader')({path:'/guide'}),true)
if(RBAC_ENFORCEMENT_ENABLED){assert.equal(reader.length,1);assert.equal(reader[0]!.directIndex,'/guide');assert.equal(nonreader.some(g=>g.key==='guide'),false);assert.equal(allowed('menu-no-guide')({path:'/guide'}),false);assert.equal(canPermission(data,'menu-guide-reader','product:category:update'),false)}else assert(nonreader.some(g=>g.key==='guide'))
const centerRenamed=clone(migrated);centerRenamed.find(n=>n.id==='guide')!.title='自定义说明中心';assert.equal(railModel(()=>true,centerRenamed).find(g=>g.key==='guide')!.title,'自定义说明中心')
assert.deepEqual(sanitizeMenu(migrated),migrated);saveMenu(migrated);const afterSave=disk.get(MENU_KEY);loadMenu();assert.equal(disk.get(MENU_KEY),afterSave)
console.log(`PASS standalone system explanation menu ${RBAC_ENFORCEMENT_ENABLED?'strict':'default'} (migration/idempotency/custom settings/permission) `)
