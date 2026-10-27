import assert from 'node:assert/strict'
import {createPinia,setActivePinia} from 'pinia'
import {nextTick} from 'vue'
import {createSeed} from '../src/domain/seed'
import {DATA_VERSION,STORAGE_KEY} from '../src/domain/types'
import {RBAC_ENFORCEMENT_ENABLED} from '../src/domain/accessMode'
import {normalizeStored,useCatalogStore} from '../src/stores/catalog'
import {defaultMenuNodes,loadMenu,sanitizeMenu,railModel,MENU_KEY,menuRouteForLocation} from '../src/domain/menuConfig'
import {catalogReturnLocation,legacyCatalogLocation,firstReadableCatalogView} from '../src/domain/catalogWorkspaceNavigation'
import {installCatalogTestLocks} from './catalog-storage-test-env'
const restore=installCatalogTestLocks(),disk=new Map<string,string>(),session=new Map<string,string>();let writes=0,menuWrites=0,quota=false,groups=0
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>disk.get(key)??null,setItem:(key:string,value:string)=>{if(quota)throw Error('quota');disk.set(key,value);if(key===STORAGE_KEY)writes++;if(key===MENU_KEY)menuWrites++},removeItem:(key:string)=>disk.delete(key)}})
Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:(key:string)=>session.get(key)??null,setItem:(key:string,value:string)=>session.set(key,value),removeItem:(key:string)=>session.delete(key)}})
const data=normalizeStored({version:DATA_VERSION,data:createSeed()})!
const roles:Record<string,string[]>={category:['product:category:read'],type:['product:type:read'],model:['product:model:read'],designer:['product:model:read','product:model-designer:read','product:model:update'],none:['system:guide:read']}
for(const [id,codes]of Object.entries(roles)){data.rbac!.roles.push({id,code:id,name:id,description:'fixture',enabled:true,permissionCodes:codes});data.users.push({id,username:id,displayName:id,enabled:true,role:'operator',roleIds:[id]})}
let store:ReturnType<typeof useCatalogStore>|undefined
try{
 for(const [id,codes] of Object.entries(roles)){
  store?.$dispose();disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data}));session.set('iyge-rbac-simulated-user',id);setActivePinia(createPinia());store=useCatalogStore();await store.waitForPersistence();writes=0
  const before=JSON.stringify(store.data),raw=disk.get(STORAGE_KEY),strict=RBAC_ENFORCEMENT_ENABLED
  assert.equal(store.canRoute({path:'/catalog'}),!strict||id!=='none')
  for(const [view,permission]of [['categories','product:category:read'],['types','product:type:read'],['models','product:model:read']])assert.equal(store.canRoute({path:'/catalog',query:{view}}),!strict||codes.includes(permission!))
  assert.equal(store.canRoute({path:'/catalog',query:{view:'unknown'}}),false);assert.equal(store.canRoute({path:'/catalog',query:{view:['models','categories']}}),false)
  assert.equal(store.canRoute({path:'/specs',query:{template:'model',mode:'view'}}),!strict||codes.includes('product:model-designer:read'))
  assert.equal(firstReadableCatalogView(store.can),strict?id==='category'?'categories':id==='type'?'types':id==='none'?undefined:'models':'categories')
  const rail=railModel(location=>store!.canRoute(location)),links=rail.flatMap(center=>[...center.items,...center.sections.flatMap(section=>section.items)])
  assert.equal(links.some(link=>link.index==='/catalog'),!strict||id!=='none');assert(!links.some(link=>['/categories','/models','/product-types','/specs'].includes(link.index)))
  await nextTick();await store.waitForPersistence();assert.equal(JSON.stringify(store.data),before);assert.equal(disk.get(STORAGE_KEY),raw);assert.equal(writes,0)
 }
 groups++
 const query={category:'c-parent',type:'real-type',focus:'real-model',q:'手机',version:'old-v',source:'old-link'}
 for(const [path,view]of [['/categories','categories'],['/product-types','types'],['/models','models']])assert.deepEqual(legacyCatalogLocation(path!,query),{path:'/catalog',query:{...query,view}})
 for(const task of [{mode:'organize'},{mode:'edit'},{manage:'move'},{action:'create'},{move:'source-id'}])assert.equal(legacyCatalogLocation('/categories',{...query,...task}),undefined)
 assert.equal(legacyCatalogLocation('/specs',query),undefined);groups++
 assert.deepEqual(legacyCatalogLocation('/categories',{id:'legacy-category',q:'phone'}),{path:'/catalog',query:{id:'legacy-category',categoryId:'legacy-category',q:'phone',view:'categories'}})
 const returnTo='/catalog?view=models&categoryId=real-id&scope=current&modelId=real-model&version=old-v'
 assert.equal(catalogReturnLocation(returnTo),returnTo)
 for(const bad of ['https://bad.invalid/catalog','//bad.invalid/catalog','javascript:alert(1)','/spus','/catalog\\evil','/catalog?x=%0a','/catalog?x=%5c'])assert.equal(catalogReturnLocation(bad),undefined)
 for(const path of ['/catalog','/categories','/models','/product-types','/specs'])assert.equal(menuRouteForLocation(path),'/catalog');groups++
 const old=defaultMenuNodes().filter(node=>node.id!=='page:/catalog'),custom={id:'custom-catalog-section',kind:'group' as const,title:'我的资料',parentId:'product',sort:37,route:'',hidden:false,roles:['admin' as const,'operator' as const],custom:true};old.push(custom)
 Object.assign(old.find(node=>node.route==='/categories')!,{title:'旧自定义目录',sort:28,parentId:custom.id,hidden:false})
 old.find(node=>node.route==='/models')!.hidden=true;old.find(node=>node.route==='/skus')!.sort=91
 const original=JSON.stringify(old);disk.set(MENU_KEY,JSON.stringify({version:1,guideCenterVersion:1,nodes:old}));menuWrites=0
 const migrated=loadMenu(),entrance=migrated.find(node=>node.route==='/catalog')!
 assert.equal(entrance.parentId,custom.id);assert.equal(entrance.sort,28);assert.equal(entrance.hidden,false)
 assert.equal(JSON.stringify(migrated.filter(node=>node.route!=='/catalog')),original)
 const saved=disk.get(MENU_KEY);assert.equal(menuWrites,1);assert.deepEqual(loadMenu(),migrated);assert.equal(disk.get(MENU_KEY),saved);assert.equal(menuWrites,1);assert.deepEqual(sanitizeMenu(migrated),migrated);groups++
 for(const node of old)if(['/categories','/product-types','/models'].includes(node.route))node.hidden=true
 disk.set(MENU_KEY,JSON.stringify({version:1,nodes:old}));quota=true;const before=disk.get(MENU_KEY),failed=loadMenu();assert.equal(failed.find(node=>node.route==='/catalog')!.hidden,true);assert.equal(disk.get(MENU_KEY),before);quota=false;assert.equal(loadMenu().find(node=>node.route==='/catalog')!.hidden,true);groups++
 disk.set(MENU_KEY,'broken');assert.equal(loadMenu().find(node=>node.route==='/catalog')!.title,'商品资料管理');assert.equal(disk.get(MENU_KEY),'broken');groups++
 console.log(`PASS catalog workspace navigation ${RBAC_ENFORCEMENT_ENABLED?'strict':'default'} ${groups} groups: real Store any-view permission, zero business writes, legacy query, exact version return, menu preference migration and quota`)
}finally{quota=false;store?.$dispose();restore()}
