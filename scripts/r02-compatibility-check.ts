import assert from 'node:assert/strict'
import { mkdirSync,writeFileSync } from 'node:fs'
import { createPinia,setActivePinia } from 'pinia'
import { installCatalogTestLocks } from './catalog-storage-test-env'
import { createTemplateCompatibilityFixture } from './template-compatibility-fixtures'
import { useCatalogStore } from '../src/stores/catalog'
import { DATA_VERSION,STORAGE_KEY } from '../src/domain/types'
import { materialRelationBasis,previewMaterialScope } from '../src/domain/materialRelationCommands'
import { declarationDraft } from '../src/domain/accessoryCompatibilityCommands'
import { queryAccessoryDevices,queryModelAccessories } from '../src/domain/accessoryCompatibilityQuery'
import { previewTemplateCompatibilitySync } from '../src/domain/templateCompatibilitySync'
import type { MaterialScope } from '../src/domain/materialRelations'
installCatalogTestLocks();const f=createTemplateCompatibilityFixture(),disk=new Map<string,string>();let fail=false
f.data.activeRole='admin'
for(const id of ['compat-style-0','compat-style-1'])f.data.productSpecNodes.find(n=>n.id===id)!.businessConfigs=[{id:`policy-${id}`,definitionId:'business:material',modelId:f.modelId,nodeId:id,scope:'subtree',enabled:true,parameters:{value:'shared'}}]
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>disk.get(k)??null,setItem:(k:string,v:string)=>{if(fail){fail=false;throw Error('quota')};disk.set(k,v)}}})
disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data:f.data}));setActivePinia(createPinia());const store=useCatalogStore();await store.waitForPersistence();const published=await store.publishSpecModel(f.modelId);assert(published.ok,published.message)
const version=store.data.specModelVersions.filter(v=>v.templateId===f.modelId).at(-1)!
const source:MaterialScope={kind:'node',modelId:f.modelId,versionId:version.id,anchorNodeId:'compat-style-0',scope:'subtree'}
const a=previewMaterialScope(store.data,source);assert.deepEqual(a.problems,[]);assert.equal(a.claims.length,4)
const r=await store.saveMaterialRelation({source,name:'共用配件',requestId:'accessory-a',basis:a.basis});assert(r.ok,r.message);if(!r.ok)throw Error('create')
assert.equal(store.data.compatibilities.filter(l=>l.targetId===r.materialId).length,1)
assert.equal(store.data.materialContributions!.find(c=>c.materialId===r.materialId)!.owners.length,4)
const bSource={...source,anchorNodeId:'compat-style-1'},b=previewMaterialScope(store.data,bSource,r.materialId);assert.deepEqual(b.problems,[])
const before=store.exportJson(),raw=disk.get(STORAGE_KEY);fail=true
const input={source:bSource,materialId:r.materialId,requestId:'accessory-b',basis:b.basis}
assert(!(await store.saveMaterialRelation(input)).ok);assert.equal(store.exportJson(),before);assert.equal(disk.get(STORAGE_KEY),raw)
const linked=await store.saveMaterialRelation(input);assert(linked.ok,linked.message);if(!linked.ok)throw Error('link')
assert.equal(store.data.compatibilities.filter(l=>l.targetId===r.materialId).length,2)
assert.equal(queryAccessoryDevices(store.data,{kind:'material',id:r.materialId}).hosts.length,2)
for(const host of [f.hosts.a,f.hosts.b])assert(queryModelAccessories(store.data,host).materials.some(m=>m.target.id===r.materialId))
assert(previewTemplateCompatibilitySync(store.data,{modelId:f.modelId,targetVersionId:version.id,targetIds:[r.materialId]}).items.every(i=>i.state==='protected'))
const checks=['range compatibility proves all four combinations and deduplicates claims preserving four contributors','shared accessory MAT supports two distinct hosts with forward/reverse queries','link plus compatibility commits atomically under quota failure; legacy single-combo sync protects multi-path MAT']
// Independent explicit relation contributes the same host. Unlink must retain the other owner.
const plan=b.proof[0]!,pSource:MaterialScope={kind:'planning',modelId:f.modelId,versionId:version.id,planningId:plan.planningId,scope:'current'}
const planLink=await store.saveMaterialRelation({source:pSource,materialId:r.materialId,requestId:'host-b-plan',basis:materialRelationBasis(store.data)});assert(planLink.ok,planLink.message)
assert((await store.unlinkMaterialRelation(linked.relationId,materialRelationBasis(store.data))).ok);assert.equal(queryAccessoryDevices(store.data,{kind:'material',id:r.materialId}).hosts.length,2)
checks.push('unlink one range retains same-host contribution from another planning relation')
if(!planLink.ok)throw Error('plan link')
assert((await store.unlinkMaterialRelation(planLink.relationId,materialRelationBasis(store.data))).ok)
assert.equal(queryAccessoryDevices(store.data,{kind:'material',id:r.materialId}).hosts.length,1)
const relink=await store.saveMaterialRelation({source:bSource,materialId:r.materialId,requestId:'host-b-relink-new-request',basis:materialRelationBasis(store.data)});assert(relink.ok,relink.message)
assert.equal(queryAccessoryDevices(store.data,{kind:'material',id:r.materialId}).hosts.length,2)
checks.push('automatic retirement after final unlink differs from manual cancellation; a new explicit request can relink')
const link=store.data.compatibilities.find(l=>l.targetId===r.materialId&&l.host.productModelId===f.hosts.b.productModelId)!
const draft=declarationDraft(link);draft.note='人工维护说明';const editResult=await store.commitCompatibilityChanges([{kind:'edit',id:link.id,draft}]);assert(editResult.ok,JSON.stringify(editResult.preview || editResult))
if(!relink.ok)throw Error('relink');assert((await store.unlinkMaterialRelation(relink.relationId,materialRelationBasis(store.data))).ok)
assert.equal(store.data.compatibilities.find(l=>l.id===link.id)!.note,'人工维护说明')
assert(store.data.materialContributions!.some(c=>c.declarationId===link.id&&c.state==='modified'),'manual marker')
assert(previewMaterialScope(store.data,bSource,r.materialId).problems.some(p=>p.includes('人工')),'manual preview')
checks.push('manual edits stay protected after last unlink and are not silently replaced on relink')
// Alter a separate candidate snapshot only to exercise a conflicting published claim.
const bad=JSON.parse(store.exportJson()).data,ver=bad.specModelVersions.find((v:{id:string})=>v.id===version.id)
ver.templateCompatibilitySnapshot.config.exceptions[0].claims[0]={...f.claim('deny',f.hosts.a),conclusion:'incompatible'}
assert(previewMaterialScope(bad,bSource,r.materialId).problems.some(p=>p.includes('冲突')),JSON.stringify(previewMaterialScope(bad,bSource,r.materialId).problems))
const beforeConflict=store.exportJson();await store.importJson(JSON.stringify({version:DATA_VERSION,data:bad}))
const conflictMemory=store.exportJson(),conflictDisk=disk.get(STORAGE_KEY)
const conflictResult=await store.saveMaterialRelation({source:bSource,materialId:r.materialId,requestId:'contradiction',basis:materialRelationBasis(store.data)})
assert(!conflictResult.ok);assert.match(conflictResult.message||'',/冲突/);assert.equal(store.exportJson(),conflictMemory);assert.equal(disk.get(STORAGE_KEY),conflictDisk)
await store.importJson(beforeConflict)
const stable=store.exportJson(),saved=disk.get(STORAGE_KEY);assert(!(await store.saveMaterialRelation({source:bSource,materialId:'case-sku',requestId:'real-sku-rejected',basis:materialRelationBasis(store.data)})).ok);assert.equal(store.exportJson(),stable);assert.equal(disk.get(STORAGE_KEY),saved)
checks.push('same-host contradiction and sales-SKU target rejected without partial archives or relationships')
const removed=store.data.compatibilities.find(l=>l.targetId===r.materialId&&l.host.productModelId===f.hosts.a.productModelId)!
assert((await store.commitCompatibilityChanges([{kind:'remove',id:removed.id}])).ok)
assert(store.data.materialContributions!.some(c=>c.declarationId===removed.id&&c.state==='deleted'))
assert(previewMaterialScope(store.data,source,r.materialId).problems.some(p=>p.includes('人工')))
checks.push('explicitly cancelled declaration retains tombstone and is not recreated by a new association')
const backup=store.exportJson();await store.importJson(backup);assert.deepEqual(JSON.parse(store.exportJson()),JSON.parse(backup));checks.push('range relations, ownership baselines and manually protected claims survive legal restore')
const out=process.env.R02_OUTPUT||'work/r02-20261025/domain';mkdirSync(out,{recursive:true});writeFileSync(`${out}/compatibility.json`,JSON.stringify({checks,passed:checks.length},null,2));checks.forEach(s=>console.log('PASS R02 '+s));store.$dispose()
