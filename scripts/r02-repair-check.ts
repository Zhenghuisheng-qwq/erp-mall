import {RBAC_ENFORCEMENT_ENABLED} from '../src/domain/accessMode'
import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
import {createPinia,setActivePinia} from 'pinia'
import {installCatalogTestLocks} from './catalog-storage-test-env'
import {createCatalogModelFixture} from './catalog-model-fixture'
import {r02Fixture} from './r02-fixture'
import {useCatalogStore,normalizeStored} from '../src/stores/catalog'
import {DATA_VERSION,STORAGE_KEY,type AppData} from '../src/domain/types'
import {materialRelationBasis,previewMaterialScope} from '../src/domain/materialRelationCommands'
import {familyMaterialDigest} from '../src/domain/material'
import {materialPlanningIds,type MaterialScope} from '../src/domain/materialRelations'
installCatalogTestLocks()
const disk=new Map<string,string>();let fail=false
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>disk.get(k)??null,setItem:(k:string,v:string)=>{if(fail){fail=false;throw Error('quota')};disk.set(k,v)},removeItem:(k:string)=>disk.delete(k)}})
const clone=<T>(x:T):T=>JSON.parse(JSON.stringify(x)),checks:string[]=[]
const pass=(s:string)=>{checks.push(s);console.log('PASS R02 repair '+s)}
async function open(data:AppData){data.activeRole='admin';disk.clear();disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data}));setActivePinia(createPinia());const store=useCatalogStore();await store.waitForPersistence();return store}
{
 const f=r02Fixture(),s=await open(f.data);assert((await s.publishSpecModel(f.modelId)).ok);const version=s.data.specModelVersions.filter(v=>v.templateId===f.modelId).at(-1)!
 const source:MaterialScope={kind:'node',modelId:f.modelId,versionId:version.id,anchorNodeId:f.anchor,scope:'subtree'}
 const made=await s.saveMaterialRelation({source,requestId:'range',name:'摘要物料',basis:materialRelationBasis(s.data)});assert(made.ok)
 const sku=s.data.skus.find(x=>x.id===made.materialId)!,digest=()=>familyMaterialDigest([sku,sku],s.data)
 assert.match(digest(),/已建物料 1 条.*已关联规划 3 条/)
 const plan=s.data.planningRecords.find(p=>p.productModelId===f.modelId&&p.steps.some(n=>n.valueNodeId===f.other))!
 const other:MaterialScope={kind:'planning',modelId:f.modelId,versionId:version.id,planningId:plan.planningId,scope:'current'}
 const a=await s.saveMaterialRelation({source:other,materialId:sku.id,requestId:'A',basis:materialRelationBasis(s.data)});assert(a.ok);assert.match(digest(),/已建物料 1 条.*已关联规划 4 条/)
 const b={source:other,materialId:sku.id,requestId:'B',basis:materialRelationBasis(s.data)}
 const memory=s.exportJson(),raw=disk.get(STORAGE_KEY);fail=true;assert(!(await s.saveMaterialRelation(b)).ok);assert.equal(s.exportJson(),memory);assert.equal(disk.get(STORAGE_KEY),raw)
 const accepted=await s.saveMaterialRelation(b);assert(accepted.ok);assert.equal(accepted.relationId,a.relationId);assert.equal(s.data.materialRelations!.find(r=>r.id===a.relationId)!.requestAliases![0]!.requestId,'B')
 const backup=s.exportJson();await s.importJson(backup);assert.equal(s.exportJson(),backup)
 assert(!(await s.saveMaterialRelation({...b,source,basis:materialRelationBasis(s.data)})).ok)
 assert((await s.unlinkMaterialRelation(a.relationId,materialRelationBasis(s.data))).ok);assert.match(digest(),/已建物料 1 条.*已关联规划 3 条/)
 for(const input of [b,{...b,basis:materialRelationBasis(s.data)},{...b,requestId:'A',basis:materialRelationBasis(s.data)}]){const memory=s.exportJson(),raw=disk.get(STORAGE_KEY);assert(!(await s.saveMaterialRelation(input)).ok);assert.equal(s.exportJson(),memory);assert.equal(disk.get(STORAGE_KEY),raw)}
 assert((await s.saveMaterialRelation({...b,requestId:'C',basis:materialRelationBasis(s.data)})).ok);assert.match(digest(),/已建物料 1 条.*已关联规划 4 条/)
 const curr=await s.saveMaterialRelation({source:{...source,scope:'current'},requestId:'current',name:'节点物料',basis:materialRelationBasis(s.data)});assert(curr.ok);assert.equal(materialPlanningIds(s.data,curr.materialId).length,0)
 const second=await s.createMaterial({productModelId:f.modelId,modelVersionId:version.id,planningId:plan.planningId,categoryId:'c-phone',productTypeId:'r01-type',requestId:'second',skuName:'第二物料'});assert(second.ok);if(!second.ok)throw Error('create')
 assert.match(familyMaterialDigest([sku,s.data.skus.find(x=>x.id===second.skuId)!],s.data),/已建物料 2 条.*已关联规划 4 条/)
 pass('digest 3→4→3; one MAT; current zero; same PLN multiple MAT deduplicates planning')
 for(const value of [{},[null],[{requestId:'B',intent:'broken'}]]){const broken=JSON.parse(s.exportJson());broken.data.materialRelations.find((r:{id:string})=>r.id===a.relationId).requestAliases=value;const memory=s.exportJson(),raw=disk.get(STORAGE_KEY);await assert.rejects(()=>s.importJson(JSON.stringify(broken)),/关联.*校验失败/);assert.throws(()=>normalizeStored(broken));assert.equal(s.exportJson(),memory);assert.equal(disk.get(STORAGE_KEY),raw)}
 assert(!(await s.saveMaterialRelation({...b,materialId:curr.materialId,basis:materialRelationBasis(s.data)})).ok)
 const oldRange=clone(s.data.materialRelations!.find(r=>r.id===made.relationId))
 s.data.productSpecNodes.push({...s.data.productSpecNodes.find(n=>n.id==='r02-blue-256')!,id:'repair-new-color',valueId:'颜色2',sort:2});await s.waitForPersistence();assert((await s.publishSpecModel(f.modelId)).ok)
 const v2=s.data.specModelVersions.filter(v=>v.templateId===f.modelId).at(-1)!
 assert((await s.saveMaterialRelation({source:{...source,versionId:v2.id},materialId:sku.id,requestId:'v2-range',basis:materialRelationBasis(s.data),confirmVersionChange:true})).ok)
 assert.equal(materialPlanningIds(s.data,sku.id).length,5);assert.equal(materialPlanningIds(s.data,sku.id,version.id).length,4);assert.equal(materialPlanningIds(s.data,sku.id,v2.id).length,4)
 assert.deepEqual(s.data.materialRelations!.find(r=>r.id===made.relationId),oldRange)
 pass('cross-version digest unions active PLN identities without double counting; version-specific ranges and historical source unchanged')
 assert(s.startPermissionPreview('u-op').ok);await s.waitForPersistence();const memory2=JSON.stringify({version:DATA_VERSION,data:s.data}),raw2=disk.get(STORAGE_KEY),bad=JSON.parse(memory2);bad.data.materialRelations.find((r:{id:string})=>r.id===a.relationId).requestAliases=[]
 if(RBAC_ENFORCEMENT_ENABLED){await assert.rejects(async()=>s.importJson(JSON.stringify(bad)),/未授权|导入.*拒绝|无权/);assert.equal(JSON.stringify({version:DATA_VERSION,data:s.data}),memory2);assert.equal(disk.get(STORAGE_KEY),raw2)}else{assert.equal(s.can('product:import:execute'),true);await s.importJson(JSON.stringify(bad));assert.deepEqual(s.data.materialRelations!.find(r=>r.id===a.relationId)!.requestAliases,[]);assert.deepEqual(s.data.specModelVersions,JSON.parse(memory2).data.specModelVersions)}
 pass('A/B success receipts atomic, survive restore; revoked A/B cannot revive with fresh basis; new C links existing MAT; invalid import rejected; strict readonly denies atomically / default unified import remains operational');s.$dispose()
}
const out=process.env.R02_REPAIR_OUTPUT||'work/r02-repair-20261025';mkdirSync(out,{recursive:true});writeFileSync(`${out}/store-checks.json`,JSON.stringify({passed:checks.length,checks},null,2))
