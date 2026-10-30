import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
import {createPinia,setActivePinia} from 'pinia'
import {nextTick} from 'vue'
import {installCatalogTestLocks} from './catalog-storage-test-env'
import {createSeed} from '../src/domain/seed'
import {createCatalogProductFixture} from './catalog-product-fixture'
import {ensureRbac,permissionRegistry,type RbacRole} from '../src/domain/rbac'
import {RBAC_ENFORCEMENT_ENABLED} from '../src/domain/accessMode'
import {defaultMenuNodes,MENU_KEY} from '../src/domain/menuConfig'
import {normalizeStored,useCatalogStore} from '../src/stores/catalog'
import {DATA_VERSION,STORAGE_KEY,type AppData,type Brand,type SpecRule} from '../src/domain/types'

const strict=RBAC_ENFORCEMENT_ENABLED,out=`work/closure-rbac-menu/store/${strict?'strict':'default'}`
mkdirSync(out,{recursive:true})
const disk=new Map<string,string>(),session=new Map<string,string>(),checks:string[]=[],writes:string[]=[]
let failNext=false,store:ReturnType<typeof useCatalogStore>|undefined
const restoreLocks=installCatalogTestLocks()
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>disk.get(key)??null,setItem:(key:string,value:string)=>{if(failNext&&key===STORAGE_KEY){failNext=false;throw Error('closure injected quota')};disk.set(key,value);if(key===STORAGE_KEY)writes.push(value)},removeItem:(key:string)=>disk.delete(key)}})
Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:(key:string)=>session.get(key)??null,setItem:(key:string,value:string)=>session.set(key,value),removeItem:(key:string)=>session.delete(key)}})
const SESSION='iyge-rbac-simulated-user',RETURN=`${SESSION}:return`,PROOF=`${SESSION}:return-proof`,ISSUED=`${SESSION}:return-issued`
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value))
const memory=()=>JSON.stringify(store!.data),raw=()=>disk.get(STORAGE_KEY)
const business=(data:AppData)=>{const value=clone(data);delete value.rbac;return value}
const mark=(name:string)=>{checks.push(name);console.log(`PASS closure Store ${strict?'strict':'default'} ${name}`)}
async function dispose(){if(store){await nextTick();await store.waitForPersistence();store.$dispose();store=undefined}}
async function reopen(){await dispose();setActivePinia(createPinia());store=useCatalogStore();await store.waitForPersistence();return store}
async function mount(data:AppData,userId='u-admin'){
 await dispose();disk.clear();session.clear();failNext=false
 disk.set(MENU_KEY,JSON.stringify({version:1,nodes:defaultMenuNodes()}));disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data:clone(data)}));session.set(SESSION,userId)
 setActivePinia(createPinia());store=useCatalogStore();await store.waitForPersistence();assert(store.authorizationReady);assert.equal(store.rbacEnforced,strict);return store
}
function fixture(){
 const data=normalizeStored({version:DATA_VERSION,data:createSeed()})!;ensureRbac(data)
 const add=(id:string,codes:string[])=>{const role:RbacRole={id:`closure-${id}`,code:`closure-${id}`,name:id,description:'closure test',enabled:true,permissionCodes:codes};data.rbac!.roles.push(role);data.users.push({id,username:id,displayName:id,role:'operator',enabled:true,roleIds:[role.id]})}
 add('sku-delete',['product:sku:read','product:sku:delete'])
 add('mat-import',['product:material:read','product:material:import'])
 add('brand-only',['product:brand:read','product:brand:create'])
 add('brand-complete',['product:brand:read','product:brand:create','product:brand:update','product:dictionary:read','product:dictionary:update'])
 add('rule-create',['product:rule:read','product:rule:create']);add('rule-update',['product:rule:read','product:rule:update'])
 add('category-editor',['product:category:read','product:category:update'])
 const first=data.skus[0]!;data.skus.push({...clone(first),id:'closure-mat',recordKind:'material',materialCode:'MAT-CLOSURE',skuName:'MAT身份保护样本',creationSource:undefined,planningId:undefined,sourceNodeIds:undefined})
 data.categories.push({id:'closure-source',name:'约束ID保留源',parentId:null,sort:100,enabled:true},{id:'closure-child',name:'子分类保留',parentId:'closure-source',sort:1,enabled:true},{id:'closure-target',name:'目标分类',parentId:null,sort:101,enabled:true},{id:'closure-typed',name:'已有类型的叶子分类',parentId:null,sort:102,enabled:true})
 data.productTypes.push({id:'closure-type',name:'保留类型',categoryId:'closure-typed',status:'enabled',sort:1,description:'stable type identity'})
 return data
}
async function atomicReject(operation:()=>unknown){const m=memory(),d=raw();let refused=false,reason='';try{const r=await operation() as {ok?:boolean;message?:string}|string;refused=typeof r==='string'?Boolean(r):r?.ok===false;reason=typeof r==='string'?r:r?.message||''}catch(error){refused=true;reason=String(error)}assert(refused,'real Store command must reject');await nextTick();await store!.waitForPersistence();assert.equal(memory(),m);assert.equal(raw(),d);return reason}
const newBrand=(name:string):Brand=>({id:'',name,logo:'',description:'原子品牌与词典',status:'enabled'})
try{
 let s=await mount(fixture(),'sku-delete');assert.equal(s.can('product:material:delete'),!strict)
 if(strict)await atomicReject(()=>s.removeSku('closure-mat'));else{assert.equal(await s.removeSku('closure-mat'),'');await s.waitForPersistence();assert(!s.data.skus.some(x=>x.id==='closure-mat'))}
 mark('SKU-delete permission cannot delete MAT in strict; default mode deliberately permits administrators')

 function importFixture(){const data=normalizeStored({version:DATA_VERSION,data:createCatalogProductFixture().data})!;ensureRbac(data);data.rbac!.roles.push({id:'closure-importer',code:'closure-importer',name:'仅MAT导入',description:'',enabled:true,permissionCodes:['product:material:read','product:material:import']});data.users.push({id:'mat-import',username:'mat-import',displayName:'mat-import',role:'operator',enabled:true,roleIds:['closure-importer']});data.skus.push({...clone(data.skus[0]!),id:'closure-mat',recordKind:'material',materialCode:'MAT-CLOSURE',skuName:'独立物料',planningId:undefined});return data}
 for(const mutation of ['spu','sku'] as const){s=await mount(importFixture(),'mat-import');const candidate=clone(s.data);if(mutation==='spu')candidate.families[0]!.name+=' 授权边界探针';else if(mutation==='sku')candidate.skus.find(x=>x.id!=='closure-mat')!.skuName+=' 授权边界探针';if(strict){const reason=await atomicReject(()=>s.commitMaterialImport(candidate,s.materialImportBasis()));assert.match(reason,/未经授权|未授权/)}else{const r=await s.commitMaterialImport(candidate,s.materialImportBasis());assert(r.ok,r.message);assert.deepEqual(s.data.families,candidate.families);assert.deepEqual(s.data.skus,candidate.skus)}}
 mark(strict?'MAT-import-only cannot smuggle structurally valid SPU/SKU edits; exact authorization refusal is atomic':'default administrators retain authorized mixed-resource import behavior')
 s=await mount(importFixture(),'mat-import');const importBase=clone(s.data),malformed=clone(s.data);(malformed as unknown as {skus:unknown}).skus={id:'not-array'};await atomicReject(()=>s.commitMaterialImport(malformed,s.materialImportBasis()));const allowed=clone(s.data);allowed.skus.find(x=>x.id==='closure-mat')!.skuName='合法MAT导入维护';const imported=await s.commitMaterialImport(allowed,s.materialImportBasis());assert(imported.ok,imported.message);assert.equal(s.data.skus.find(x=>x.id==='closure-mat')!.skuName,'合法MAT导入维护');assert.equal(s.data.families[0]!.name,importBase.families[0]!.name);mark('legitimate material-only import stays functional; malformed arrays always reject before writes')

 s=await mount(fixture(),'brand-only');const deniedBrand=newBrand('Closure Missing Dictionary')
 if(strict)await atomicReject(()=>s.saveBrand(deniedBrand));else{assert((await s.saveBrand(deniedBrand)).ok);assert(s.data.params.find(p=>p.name==='品牌')!.values.includes(deniedBrand.name))}
 s=await mount(fixture(),'brand-complete');const form=newBrand('Closure Atomic Brand'),formBefore=clone(form),otherBefore=business(s.data),writesBefore=writes.length;let result=await s.saveBrand(form);assert(result.ok,result.message);await nextTick();await s.waitForPersistence();assert.equal(writes.length-writesBefore,1,'brand and dictionary must commit in one persisted transaction');const id=result.id;assert(id);assert.equal(s.data.brands.find(b=>b.id===id)!.name,form.name);assert.equal(s.data.params.find(p=>p.name==='品牌')!.values.filter(v=>v===form.name).length,1);assert.deepEqual(form,formBefore);const saved=JSON.parse(raw()!).data;assert(saved.brands.some((b:Brand)=>b.id===id&&b.name===form.name));assert(saved.params.find((p:{name:string})=>p.name==='品牌').values.includes(form.name));const otherAfter=business(s.data);otherAfter.brands=otherBefore.brands;otherAfter.params=otherBefore.params;assert.deepEqual(otherAfter,otherBefore)
 const failForm=newBrand('Closure Failure Brand'),failDraft=clone(failForm);failNext=true;await atomicReject(()=>s.saveBrand(failForm));assert.deepEqual(failForm,failDraft);assert((await s.saveBrand(failForm)).ok);mark('brand and dictionary commit atomically; missing dictionary permission and quota failures preserve originals and drafts')

 const baseRule=clone(fixture().rules.find(r=>!r.legacy)!),createRule:SpecRule={...baseRule,id:'',note:'closure create'}
 s=await mount(fixture(),'rule-create');const created=await s.saveRule(createRule);assert(created.ok,created.message);assert(created.id);const edit={...clone(s.data.rules.find(r=>r.id===created.id)!),note:'closure update needs separate permission'}
 if(strict)await atomicReject(()=>s.saveRule(edit));else assert((await s.saveRule(edit)).ok)
 s=await mount(fixture(),'rule-update');if(strict)await atomicReject(()=>s.saveRule(createRule));const originalRule=clone(s.data.rules.find(r=>r.id===baseRule.id)!);assert((await s.saveRule({...originalRule,note:'allowed update'})).ok);const updated=s.data.rules.find(r=>r.id===baseRule.id)!;assert.equal(updated.note,'allowed update');assert.equal(updated.id,originalRule.id);assert.deepEqual(updated.conditions,originalRule.conditions);failNext=true;await atomicReject(()=>s.saveRule({...clone(updated),note:'quota failure'}));mark('rule create/update permissions are distinct; conditions and IDs preserved; quota failure is atomic')

 const recovery=fixture(),root=recovery.rbac!.roles.find(r=>r.id==='role:super-admin')!;root.permissionCodes=root.permissionCodes.filter(c=>!['product:import:execute','system:data:reset','product:spu:update'].includes(c));const rootId=root.id,otherRoles=clone(recovery.rbac!.roles.filter(r=>r.id!==rootId)),originalBusiness=business(recovery)
 s=await mount(fixture());await s.importJson(JSON.stringify({version:DATA_VERSION,data:recovery}));assert(s.isAdmin);assert.equal(s.can('product:import:execute'),!strict);assert.equal(s.can('system:data:reset'),!strict);const restored=await s.restoreSuperAdminAccess();assert(restored.ok,restored.message);const restoredRoot=s.data.rbac!.roles.find(r=>r.id===rootId)!;assert(permissionRegistry().every(p=>restoredRoot.permissionCodes.includes(p.code)));assert.deepEqual(s.data.rbac!.roles.filter(r=>r.id!==rootId),otherRoles);assert.deepEqual(business(s.data),originalBusiness);assert.equal(restoredRoot.id,rootId)
 s=await mount(recovery,'u-op');if(strict)await atomicReject(()=>s.restoreSuperAdminAccess());else assert((await s.restoreSuperAdminAccess()).ok);assert.equal(s.activeUserId,'u-op');mark('real super recovery restores registered grants without import/reset, preserves root ID/other roles/business; ordinary strict role denied')

 s=await mount(fixture());assert(s.simulateUser('u-op').ok);assert.equal(s.activeUserId,'u-op');assert.equal(s.simulationReturnId,'u-admin');const issued=JSON.parse(disk.get(ISSUED)||'[]');assert(issued.length>0);s=await reopen();assert.equal(s.activeUserId,'u-op');assert.equal(s.simulationReturnId,'u-admin');assert(s.stopPermissionPreview().ok);assert.equal(s.activeUserId,'u-admin');mark('issued super simulation survives Store reopen and has working exit')
 for(const kind of ['none','missing-proof','wrong-proof','matching-fake-pair','non-super-origin','wrong-target'] as const){s=await mount(fixture(),'u-op');const context={originId:kind==='non-super-origin'?'sku-delete':'u-admin',targetId:kind==='wrong-target'?'sku-delete':'u-op',token:'unissued-fake-token',enforced:strict};if(kind!=='none')session.set(RETURN,JSON.stringify(context));if(kind==='wrong-proof')session.set(PROOF,'different');else if(['matching-fake-pair','non-super-origin','wrong-target'].includes(kind))session.set(PROOF,context.token);s=await reopen();assert.equal(s.activeUserId,'u-op',kind);assert.equal(s.simulationReturnId,'',kind);for(const key of ['simulationReturnId','activeUserId','previewUserId']){try{(s as unknown as Record<string,unknown>)[key]='u-admin'}catch{}}assert.equal(s.activeUserId,'u-op',kind);assert.equal(s.simulationReturnId,'',kind);assert.equal(s.previewUserId,'',kind);s.stopPermissionPreview();assert.equal(s.activeUserId,'u-op',kind);if(strict)assert(!s.isAdmin,kind)}mark('unissued, mismatched and matching fake context/proof pairs plus public-ref writes cannot elevate or exit to root')

 s=await mount(fixture(),'category-editor');const categoriesBefore=clone(s.data.categories),typesBefore=clone(s.data.productTypes),rulesBefore=clone(s.data.rules),businessBefore=business(s.data);const moved=await s.commitCategoryMove('closure-source','closure-target');assert(moved.ok,moved.message);assert.equal(s.data.categories.find(c=>c.id==='closure-source')!.parentId,'closure-target');assert.equal(s.data.categories.find(c=>c.id==='closure-child')!.parentId,'closure-source');assert.deepEqual(s.data.categories.map(c=>c.id).sort(),categoriesBefore.map(c=>c.id).sort());assert.deepEqual(s.data.productTypes,typesBefore);assert.deepEqual(s.data.rules,rulesBefore);const businessAfter=business(s.data);businessAfter.categories=businessBefore.categories;assert.deepEqual(businessAfter,businessBefore);failNext=true;await atomicReject(()=>s.commitCategoryMove('closure-source',null));await atomicReject(()=>s.commitCategoryMove('closure-source','closure-typed'));await atomicReject(()=>s.commitCategoryMove('closure-target','closure-child'));mark('category move preserves IDs/constraints/subtree and all business; typed/cycle/quota failures leave memory and disk unchanged')
 writeFileSync(`${out}/result.json`,JSON.stringify({strict,checks},null,2))
}finally{await dispose();restoreLocks()}
