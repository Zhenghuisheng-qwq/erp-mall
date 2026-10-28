import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
import {createPinia,setActivePinia} from 'pinia'
import {nextTick} from 'vue'
import {installCatalogTestLocks} from './catalog-storage-test-env'
import {createSeed} from '../src/domain/seed'
import {ensureRbac} from '../src/domain/rbac'
import {RBAC_ENFORCEMENT_ENABLED} from '../src/domain/accessMode'
import {isMaterialArchive,isRealSku} from '../src/domain/catalogIdentity'
import {normalizeStored,useCatalogStore} from '../src/stores/catalog'
import {DATA_VERSION,STORAGE_KEY,type AppData} from '../src/domain/types'

const artifacts=process.argv.includes('--artifacts')

const strict=RBAC_ENFORCEMENT_ENABLED,out=`work/delete-property-repair/${strict?'strict':'default'}`;if(artifacts)mkdirSync(out,{recursive:true})
const disk=new Map<string,string>(),session=new Map<string,string>(),checks:string[]=[],clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value))
const restoreLocks=installCatalogTestLocks();let store:ReturnType<typeof useCatalogStore>|undefined
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>disk.get(key)??null,setItem:(key:string,value:string)=>disk.set(key,value),removeItem:(key:string)=>disk.delete(key)}})
Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:(key:string)=>session.get(key)??null,setItem:(key:string,value:string)=>session.set(key,value),removeItem:(key:string)=>session.delete(key)}})
const mark=(name:string)=>{checks.push(name);if(artifacts)console.log(`PASS deleteProperty ${strict?'strict':'default'} ${name}`)}
const memory=()=>JSON.stringify(store!.data),raw=()=>disk.get(STORAGE_KEY)
const frozen=(data:AppData)=>JSON.stringify([data.specModelVersions,data.planningRecords,data.materialReceipts,data.materialRelations,data.materialContributions,data.compatibilities])
function fixture(){
 const data=normalizeStored({version:DATA_VERSION,data:createSeed()})!;ensureRbac(data)
 const family={...clone(data.families[0]!),id:'delete-v2-family',line:'v2' as const,shelfStatus:'offline' as const,lifecycle:'ready' as const}
 data.families=[family,{...family,id:'delete-v3-family',line:'v3'}]
 data.skus=[{id:'delete-mat',recordKind:'material',materialCode:'MAT-DELETE',familyId:family.id,code:'MAT-CODE',oaSkuId:'',skuName:'MAT原名',supplierCode:'可删除次级信息',status:'on_sale',variantAttrs:{颜色:'红色'},projectedAttrs:{}},{id:'delete-sku',recordKind:'sku',familyId:'delete-v3-family',code:'SKU-CODE',oaSkuId:'',skuName:'SKU原名',status:'on_sale',variantAttrs:{颜色:'白色'},projectedAttrs:{}}]
 data.materialReceipts=[];data.materialRelations=[];data.materialContributions=[];data.compatibilities=[]
 const roles=[['mat-only',['product:material:read','product:material:update']],['sku-only',['product:sku:read','product:sku:update']],['both-records',['product:material:read','product:material:update','product:sku:read','product:sku:update']],['spu-only',['product:spu:read','product:spu:update']],['publisher',['product:spu:read','product:spu:update','product:spu:publish']]] as const
 for(const [id,codes]of roles){data.rbac!.roles.push({id,code:id,name:id,description:'deleteProperty actual Store fixture',enabled:true,permissionCodes:[...codes]});data.users.push({id,username:id,displayName:id,role:'operator',enabled:true,roleIds:[id]})}
 return data
}
async function mount(userId:string,withReceipt=false){
 if(store){await nextTick();await store.waitForPersistence();store.$dispose()}
 disk.clear();session.clear();const data=fixture()
 if(withReceipt)data.materialReceipts.push({requestId:'delete-preserved-receipt',skuId:'delete-mat',planningId:'',materialCode:'MAT-DELETE',createdTime:'2026-10-25T00:00:00Z',lifecycle:'active'})
 disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data}));session.set('iyge-rbac-simulated-user',userId);setActivePinia(createPinia());store=useCatalogStore();await store.waitForPersistence();assert.equal(store.rbacEnforced,strict);return store
}
async function flush(){await nextTick();await store!.waitForPersistence()}
async function atomicReject(operation:()=>unknown){const before=memory(),previous=raw();assert.throws(operation);await flush();assert.equal(memory(),before);assert.equal(raw(),previous)}
try{
 let s=await mount('mat-only'),row=s.data.skus.find(item=>item.id==='delete-mat')!;assert(isMaterialArchive(s.data,row));const snapshots=frozen(s.data)
 delete row.recordKind;await flush();assert.equal(row.recordKind,undefined);assert(isMaterialArchive(s.data,row));assert.equal(frozen(s.data),snapshots)
 if(strict){assert(!s.can('product:sku:update'));await atomicReject(()=>{delete row.materialCode});assert.equal(row.materialCode,'MAT-DELETE');assert(isMaterialArchive(s.data,row))}
 else {delete row.materialCode;await flush();assert(isRealSku(s.data,row))}
 mark('actual two-step recordKind then materialCode deletion cannot cross MAT→SKU without both effective resource permissions')

 s=await mount('mat-only');row=s.data.skus.find(item=>item.id==='delete-mat')!
 delete row.materialCode;await flush();assert(isMaterialArchive(s.data,row))
 if(strict){await atomicReject(()=>{delete row.recordKind});assert.equal(row.recordKind,'material')}
 else {delete row.recordKind;await flush();assert(isRealSku(s.data,row))}
 mark('reverse marker deletion order also checks the post-delete resource and preserves rejection memory/storage')

 s=await mount('sku-only');row=s.data.skus.find(item=>item.id==='delete-sku')!;assert(isRealSku(s.data,row))
 if(strict){assert(!s.can('product:material:update'));await atomicReject(()=>{delete row.recordKind});assert.equal(row.recordKind,'sku')}
 else {delete row.recordKind;await flush();assert(isMaterialArchive(s.data,row))}
 mark('symmetric SKU→legacy-v3 MAT fallback cannot bypass material authorization')

 s=await mount('spu-only');let family=s.data.families.find(item=>item.id==='delete-v2-family')!
 if(strict){assert(!s.can('product:spu:publish'));await atomicReject(()=>{delete family.shelfStatus});assert.equal(family.shelfStatus,'offline')}
 else {delete family.shelfStatus;await flush();assert.equal(family.shelfStatus,undefined)}
 s=await mount('publisher');family=s.data.families.find(item=>item.id==='delete-v2-family')!;delete family.shelfStatus;await flush();assert.equal(family.shelfStatus,undefined);assert.equal(family.lifecycle,'ready')
 mark('publication field deletion obeys separate publish permission; authorized publication deletion remains usable')

 s=await mount('mat-only',true);row=s.data.skus.find(item=>item.id==='delete-mat')!;const preserved=frozen(s.data),identity={id:row.id,familyId:row.familyId}
 delete row.recordKind;delete row.materialCode;delete row.supplierCode;await flush();assert(isMaterialArchive(s.data,row));assert.deepEqual({id:row.id,familyId:row.familyId},identity);assert.equal(frozen(s.data),preserved);assert.equal(JSON.parse(raw()!).data.skus.find((item:{id:string})=>item.id===row.id).supplierCode,undefined)
 s=await mount('sku-only');row=s.data.skus.find(item=>item.id==='delete-sku')!;delete row.skuName;await flush();assert.equal(row.skuName,undefined);assert(isRealSku(s.data,row))
 mark('legitimate optional field deletions and surviving receipt-based MAT evidence retain identity and historical snapshots')

 s=await mount('both-records');row=s.data.skus.find(item=>item.id==='delete-mat')!;delete row.recordKind;delete row.materialCode;await flush();assert(isRealSku(s.data,row));assert.equal(row.id,'delete-mat')
 mark('a fully authorized resource transition is not incorrectly blocked by a blanket delete prohibition')
 if(artifacts)writeFileSync(out+'/result.json',JSON.stringify({status:'PASS',rbacEnforced:strict,checks},null,2))
 console.log(`PASS deleteProperty ${strict?'strict':'default'} (${checks.length} groups)`)
}finally{store?.$dispose();restoreLocks()}
