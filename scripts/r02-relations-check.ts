import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createPinia,setActivePinia } from 'pinia'
import { installCatalogTestLocks } from './catalog-storage-test-env'
import { r02Fixture } from './r02-fixture'
import { useCatalogStore,normalizeStored } from '../src/stores/catalog'
import { DATA_VERSION,STORAGE_KEY } from '../src/domain/types'
import { materialRelationBasis,previewMaterialScope } from '../src/domain/materialRelationCommands'
import { materialSources,nodeMaterialCards,relatedMaterials,type MaterialScope } from '../src/domain/materialRelations'
import { legalPlanningCombinations } from '../src/domain/planning'
import { legalComboMaterialStatus } from '../src/domain/comboMaterialStatus'
import { isMaterialArchive } from '../src/domain/catalogIdentity'
installCatalogTestLocks()
const out=process.env.R02_OUTPUT||'work/r02-20261025/domain';mkdirSync(out,{recursive:true})
const checks:string[]=[],pass=(s:string)=>{checks.push(s);console.log('PASS R02 '+s)},disk=new Map<string,string>();let fail=false
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>disk.get(k)??null,setItem:(k:string,v:string)=>{if(fail){fail=false;throw Error('quota')};disk.set(k,v)},removeItem:(k:string)=>disk.delete(k)}})
const f=r02Fixture();disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data:f.data}));setActivePinia(createPinia());let store=useCatalogStore();await store.waitForPersistence()
const pub=await store.publishSpecModel(f.modelId);assert(pub.ok,pub.message)
const version=store.data.specModelVersions.filter(v=>v.templateId===f.modelId).at(-1)!,v1=JSON.stringify(version)
const scope:MaterialScope={kind:'node',modelId:f.modelId,versionId:version.id,anchorNodeId:f.anchor,scope:'subtree'}
const preview=()=>previewMaterialScope(store.data,scope)
assert.deepEqual(preview().problems,[]);assert.equal(preview().coverage.length,3);assert.equal(preview().prefix.length,1)
const plansBefore=JSON.stringify(store.data.planningRecords),combosBefore=legalPlanningCombinations(store.data,f.modelId,version.nodesSnapshot).map(c=>c.identityKey)
const input={source:scope,name:'型号层共用物料',requestId:'r02-create',basis:preview().basis}
const memory=store.exportJson(),raw=disk.get(STORAGE_KEY);fail=true;assert(!(await store.saveMaterialRelation(input)).ok);assert.equal(store.exportJson(),memory);assert.equal(disk.get(STORAGE_KEY),raw)
const made=await store.saveMaterialRelation(input);assert(made.ok,made.message);if(!made.ok)throw Error('creation failed')
const mat=store.data.skus.find(s=>s.id===made.materialId)!,original=JSON.stringify(mat)
assert(!mat.planningId);assert.equal(mat.sourceNodeIds!.length,1);assert(!mat.variantAttrs.R02容量)
assert.equal(JSON.stringify(store.data.planningRecords),plansBefore);assert.deepEqual(legalPlanningCombinations(store.data,f.modelId,version.nodesSnapshot).map(c=>c.identityKey),combosBefore)
assert((await store.saveMaterialRelation(input)).ok);assert.equal(store.data.skus.filter(s=>s.id===mat.id).length,1)
pass('early node create: real prefix only, no fake PLN/TMP; plan/combo unchanged; quota atomic and retry idempotent')
const ownPlan=preview().coverage[0]!.planningId,otherPlan=store.data.planningRecords.find(p=>p.productModelId===f.modelId&&p.steps.some(s=>s.valueNodeId===f.other))!
const otherScope:MaterialScope={kind:'planning',modelId:f.modelId,versionId:version.id,planningId:otherPlan.planningId,scope:'current'}
const linkInput={source:otherScope,materialId:mat.id,requestId:'r02-link',basis:materialRelationBasis(store.data)}
const linked=await store.saveMaterialRelation(linkInput);assert(linked.ok,linked.message)
assert.equal(JSON.stringify(store.data.skus.find(s=>s.id===mat.id)),original)
assert(relatedMaterials(store.data,ownPlan,version.id).some(s=>s.id===mat.id));assert(relatedMaterials(store.data,otherPlan.planningId,version.id).some(s=>s.id===mat.id))
assert.equal(materialSources(store.data,mat.id).length,2);assert.equal(nodeMaterialCards(store.data,f.modelId,version.id,'r01-model-other-c1').length,1)
const count=store.data.skus.filter(s=>isMaterialArchive(store.data,s)).length
assert((await store.saveMaterialRelation({...linkInput,requestId:'duplicate-link',basis:materialRelationBasis(store.data)})).ok);assert.equal(materialSources(store.data,mat.id).length,2);assert.equal(store.data.skus.filter(s=>isMaterialArchive(store.data,s)).length,count)
pass('two paths share one MAT; immutable archive and original source, semantic duplicate idempotency and deduplicated counts')
const second=await store.createMaterial({productModelId:f.modelId,modelVersionId:version.id,planningId:ownPlan,categoryId:'c-phone',productTypeId:'r01-type',requestId:'r02-another',skuName:'另一条 MAT'})
assert(second.ok,second.ok?'':second.message);assert.equal(relatedMaterials(store.data,ownPlan,version.id).length,2);assert.equal(legalComboMaterialStatus(store.data,f.modelId,version.id).rows.find(r=>r.actionPlanningId===ownPlan)!.materialCount,2)
pass('same PLN creates another MAT; unified combination readers return two without false conflict')
const currentScope={...scope,scope:'current' as const},current=previewMaterialScope(store.data,currentScope)
assert.equal(current.coverage.length,0);const curr=await store.saveMaterialRelation({source:currentScope,requestId:'current',name:'仅节点',basis:current.basis});assert(curr.ok)
if(!curr.ok)throw Error('current failed');assert(!relatedMaterials(store.data,ownPlan,version.id).some(s=>s.id===curr.materialId))
assert(!nodeMaterialCards(store.data,f.modelId,version.id,'r02-128').some(c=>c.sku.id===curr.materialId))
pass('current remains node-only; subtree inherits to real descendants; sibling isolated until explicit link')
const backup=store.exportJson();await store.importJson(backup);assert.deepEqual(JSON.parse(store.exportJson()),JSON.parse(backup))
store.$dispose();setActivePinia(createPinia());store=useCatalogStore();await store.waitForPersistence();assert.equal(materialSources(store.data,mat.id).length,2)
assert.match(store.removeSku(mat.id),/关联/);assert.match(store.removeTemplate(f.modelId),/关联/)
assert(!(await store.unlinkMaterialRelation(made.relationId,materialRelationBasis(store.data))).ok)
pass('export/restore/reload retain relations; MAT/model deletion blocked; original scope filing cannot unlink')
const beforeUnlink=materialRelationBasis(store.data);if(!linked.ok)throw Error('link failed');assert((await store.unlinkMaterialRelation(linked.relationId,beforeUnlink)).ok)
assert.equal(materialSources(store.data,mat.id).length,1);assert(relatedMaterials(store.data,ownPlan,version.id).some(s=>s.id===mat.id));assert(!relatedMaterials(store.data,otherPlan.planningId,version.id).some(s=>s.id===mat.id));assert.equal(JSON.stringify(store.data.skus.find(s=>s.id===mat.id)),original)
assert(!(await store.saveMaterialRelation({...linkInput,basis:materialRelationBasis(store.data)})).ok)
pass('unlink affects only explicit relation; original MAT and other paths survive; revoked request cannot resurrect')
const stale=materialRelationBasis(store.data);store.data.skus.find(s=>s.id===mat.id)!.materialDescription='later';await store.waitForPersistence()
assert(!(await store.saveMaterialRelation({...linkInput,requestId:'stale',basis:stale})).ok)
store.setRole('operator');await store.waitForPersistence();const operatorBefore=store.exportJson(),operatorRaw=disk.get(STORAGE_KEY)
const altered=JSON.parse(operatorBefore);altered.data.activeRole='admin';altered.data.materialRelations[0].source.scope='current'
await assert.rejects(()=>store.importJson(JSON.stringify(altered)),/仅可查看物料关联/);assert.equal(store.exportJson(),operatorBefore);assert.equal(disk.get(STORAGE_KEY),operatorRaw)
assert(!(await store.saveMaterialRelation({...linkInput,requestId:'operator',basis:materialRelationBasis(store.data)})).ok)
store.setRole('admin');await store.waitForPersistence()
pass('stale preview and operator commands/import refused; import role spoof does not authorize')
for(const bad of [{},[null],[{id:'bad'}]]){const broken=JSON.parse(store.exportJson());broken.data.materialRelations=bad;const before=store.exportJson(),raw=disk.get(STORAGE_KEY);await assert.rejects(()=>store.importJson(JSON.stringify(broken)),/关联.*校验失败/);assert.equal(store.exportJson(),before);assert.equal(disk.get(STORAGE_KEY),raw);assert.throws(()=>normalizeStored(broken),/关联.*校验失败/)}
pass('malformed association containers/records rejected before memory or storage changes')
const added={...store.data.productSpecNodes.find(n=>n.id==='r02-blue-256')!,id:'r02-new-color',valueId:'颜色2',sort:2};store.data.productSpecNodes.push(added);await store.waitForPersistence();assert((await store.publishSpecModel(f.modelId)).ok)
const v2=store.data.specModelVersions.filter(v=>v.templateId===f.modelId).at(-1)!,nextScope={...scope,versionId:v2.id},next=previewMaterialScope(store.data,nextScope,mat.id)
assert.equal(next.coverage.length,4);assert.equal(next.previous.length,1);assert.equal(next.added.length,1)
assert(!(await store.saveMaterialRelation({source:nextScope,materialId:mat.id,requestId:'v2',basis:next.basis})).ok)
assert((await store.saveMaterialRelation({source:nextScope,materialId:mat.id,requestId:'v2',basis:next.basis,confirmVersionChange:true})).ok)
assert.equal(JSON.stringify(store.data.specModelVersions.find(v=>v.id===version.id)),v1);assert.equal(store.data.materialRelations!.find(r=>r.id===made.relationId)!.coverage.length,3)
pass('new-version explicit preview/confirmation adds new relation; V1 snapshot and coverage unchanged')
if(second.ok){
  const full=store.data.skus.find(s=>s.id===second.skuId)!,saved=JSON.stringify(full)
  const shared=await store.saveMaterialRelation({source:otherScope,materialId:full.id,requestId:'reuse-original-pln',basis:materialRelationBasis(store.data)})
  assert(shared.ok,shared.message);assert.equal(JSON.stringify(store.data.skus.find(s=>s.id===full.id)),saved);assert.equal(materialSources(store.data,full.id).length,2)
  pass('existing full-PLN MAT reused without changing original planningId/version/node IDs/code/family')
}
const relations=JSON.stringify(store.data.materialRelations),copy=await store.copyProductModel(f.modelId,{name:'R02副本'});assert(copy.ok)
assert.equal(JSON.stringify(store.data.materialRelations),relations);assert(!store.data.specModelVersions.some(v=>v.templateId===(copy as {templateId:string}).templateId))
pass('model copy carries remapped policy configuration only, no active relation or published source copied')
const naming=JSON.parse(store.exportJson()).data
naming.specModelVersions.find((v:{id:string})=>v.id===version.id).nodesSnapshot.find((n:{id:string})=>n.id===f.anchor).namingRule=[{kind:'field',key:'r02-capacity'}]
const namePreview=previewMaterialScope(naming,scope);assert.equal(namePreview.suggestion.canAuto,false);assert.match(namePreview.suggestion.message,/容量/);assert(!namePreview.prefix.some(s=>s.attributeId==='r02-capacity'))
pass('prefix naming reports missing capacity rather than fabricating a tail value')
const concurrentInput={source:currentScope,requestId:'concurrent-same-request',name:'并发幂等',basis:materialRelationBasis(store.data)}
const concurrent=await Promise.all([store.saveMaterialRelation(concurrentInput),store.saveMaterialRelation(concurrentInput)])
assert(concurrent.every(r=>r.ok));assert.equal(store.data.materialRelations!.filter(r=>r.requestId===concurrentInput.requestId).length,1)
pass('two queued concurrent submissions of the same request produce one archive and one original relation')
for(const mutation of ['coverage','anchor','policy','contribution']){
  const broken=JSON.parse(store.exportJson())
  if(mutation==='coverage')broken.data.materialRelations[0].coverage=[]
  if(mutation==='anchor')broken.data.materialRelations[0].source.anchorNodeId=f.other
  if(mutation==='policy')broken.data.materialRelations[0].policy=[null]
  if(mutation==='contribution')broken.data.materialContributions=[null]
  const before=store.exportJson(),raw=disk.get(STORAGE_KEY);await assert.rejects(()=>store.importJson(JSON.stringify(broken)),/关联校验失败/);assert.equal(store.exportJson(),before);assert.equal(disk.get(STORAGE_KEY),raw)
}
const future=JSON.parse(store.exportJson());future.data.materialRelations.push({...future.data.materialRelations[0],id:'future-relation',requestId:'future-request',kind:'future-scope',extension:{raw:[1,null,'保留']}})
await store.importJson(JSON.stringify(future));assert.deepEqual(JSON.parse(store.exportJson()).data.materialRelations.at(-1),future.data.materialRelations.at(-1));assert(preview().problems.some(p=>p.includes('未来关联')))
pass('tampered scope/proof/frozen policy/contribution rejected atomically; valid future relationship preserved and blocks affected execution')
writeFileSync(`${out}/relations.json`,JSON.stringify({checks,passed:checks.length},null,2));store.$dispose()
