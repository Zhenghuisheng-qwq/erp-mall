import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
import {createPinia,setActivePinia} from 'pinia'
import {installCatalogTestLocks} from './catalog-storage-test-env'
import {createTemplateCompatibilityFixture} from './template-compatibility-fixtures'
import {r02Fixture} from './r02-fixture'
import {useCatalogStore,normalizeStored} from '../src/stores/catalog'
import {DATA_VERSION,STORAGE_KEY,type AppData} from '../src/domain/types'
import {materialRelationBasis,previewMaterialScope} from '../src/domain/materialRelationCommands'
import {familyMaterialDigest} from '../src/domain/material'
import {materialPlanningIds,type MaterialScope} from '../src/domain/materialRelations'
import {declarationDraft} from '../src/domain/accessoryCompatibilityCommands'
import type {TemplateCompatibilityClaim} from '../src/domain/templateCompatibilityTypes'
installCatalogTestLocks()
const disk=new Map<string,string>();let fail=false
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>disk.get(k)??null,setItem:(k:string,v:string)=>{if(fail){fail=false;throw Error('quota')};disk.set(k,v)},removeItem:(k:string)=>disk.delete(k)}})
const clone=<T>(x:T):T=>JSON.parse(JSON.stringify(x)),checks:string[]=[]
const pass=(s:string)=>{checks.push(s);console.log('PASS R02 repair '+s)}
async function open(data:AppData){data.activeRole='admin';disk.clear();disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data}));setActivePinia(createPinia());const store=useCatalogStore();await store.waitForPersistence();return store}
function accessory(){const f=createTemplateCompatibilityFixture();for(const id of ['compat-style-0','compat-style-1'])f.data.productSpecNodes.find(n=>n.id===id)!.businessConfigs=[{id:`policy-${id}`,definitionId:'business:material',modelId:f.modelId,nodeId:id,scope:'subtree',enabled:true,parameters:{value:'shared'}}];return f}
for(const state of ['deleted','modified'] as const)for(const field of ['note','source','verification'] as const){
 const f=accessory(),s=await open(f.data);assert((await s.publishSpecModel(f.modelId)).ok)
 const v=s.data.specModelVersions.filter(v=>v.templateId===f.modelId).at(-1)!,source:MaterialScope={kind:'node',modelId:f.modelId,versionId:v.id,anchorNodeId:'compat-style-0',scope:'subtree'}
 const made=await s.saveMaterialRelation({source,name:'人工保护',requestId:'create',basis:materialRelationBasis(s.data)});assert(made.ok,made.message)
 const link=s.data.compatibilities.find(l=>l.targetId===made.materialId)!
 assert((await s.commitCompatibilityChanges(state==='deleted'?[{kind:'remove',id:link.id}]:[{kind:'edit',id:link.id,draft:{...declarationDraft(link),note:'人工改动'}}])).ok)
 if(state==='deleted'&&field==='note'){
  for(const value of [{},[null],[{modelId:f.modelId,ruleId:'rule'}]]){
   const broken=JSON.parse(s.exportJson());broken.data.materialContributions[0].lineage=value;const memory=s.exportJson(),raw=disk.get(STORAGE_KEY)
   await assert.rejects(()=>s.importJson(JSON.stringify(broken)),/关联.*校验失败/);assert.throws(()=>normalizeStored(broken));assert.equal(s.exportJson(),memory);assert.equal(disk.get(STORAGE_KEY),raw)
  }
 }
 const protectedBefore=clone(s.data.materialContributions),oldSnapshot=JSON.stringify(v)
 const config=clone(s.data.templateCompatibilityConfigs!.find(c=>c.modelId===f.modelId)!)
 if(field==='verification')config.defaultRule.claims[0]!.verification='pending';else config.defaultRule.claims[0]![field]+=' V2'
 assert((await s.saveTemplateCompatibility(config)).ok);assert((await s.publishSpecModel(f.modelId)).ok)
 const next={...source,versionId:s.data.specModelVersions.filter(v=>v.templateId===f.modelId).at(-1)!.id},p=previewMaterialScope(s.data,next,made.materialId)
 assert(p.problems.some(p=>p.includes('人工')),JSON.stringify(p.problems))
 const memory=s.exportJson(),raw=disk.get(STORAGE_KEY)
 const blocked=await s.saveMaterialRelation({source:next,materialId:made.materialId,requestId:'blocked',basis:p.basis,confirmVersionChange:true});assert(!blocked.ok);assert.equal(s.exportJson(),memory);assert.equal(disk.get(STORAGE_KEY),raw);assert.deepEqual(s.data.materialContributions,protectedBefore);assert.equal(JSON.stringify(s.data.specModelVersions.find(x=>x.id===v.id)),oldSnapshot)
 // Legacy records recover exact pairs from their frozen version without rewriting history.
 const legacy=JSON.parse(memory);for(const c of legacy.data.materialContributions){delete c.lineage;for(const owner of c.owners)delete owner.origins}
 await s.importJson(JSON.stringify(legacy));assert(previewMaterialScope(s.data,next,made.materialId).problems.some(p=>p.includes('人工')))
 // Another host/source can still be linked; this MAT is not globally locked.
 const other=await s.saveMaterialRelation({source:{...next,anchorNodeId:'compat-style-1'},materialId:made.materialId,requestId:'other-host',basis:materialRelationBasis(s.data)});assert(other.ok,other.message)
 pass(`${state}: ${field}-only V2 change cannot bypass stable lineage; legacy frozen pairs and unrelated host preserved`);s.$dispose()
}
{
 const f=accessory(),one=clone(f.config.exceptions[0]!),two=clone(one)
 one.id='pair-rule-A';one.claims[0]!.id='pair-claim-A';two.id='pair-rule-B';two.claims[0]!.id='pair-claim-B';f.config.exceptions=[one,two]
 const s=await open(f.data);assert((await s.publishSpecModel(f.modelId)).ok)
 const source:MaterialScope={kind:'node',modelId:f.modelId,versionId:s.data.specModelVersions.filter(v=>v.templateId===f.modelId).at(-1)!.id,anchorNodeId:'compat-style-1',scope:'subtree'}
 const made=await s.saveMaterialRelation({source,requestId:'pairs',name:'真实配对',basis:materialRelationBasis(s.data)});assert(made.ok)
 const contribution=s.data.materialContributions!.find(c=>c.materialId===made.materialId)!;assert.equal(contribution.lineage!.length,2)
 assert((await s.commitCompatibilityChanges([{kind:'remove',id:contribution.declarationId}])).ok)
 const config=clone(s.data.templateCompatibilityConfigs!.find(c=>c.modelId===f.modelId)!);config.exceptions=[clone(config.exceptions[0]!)];config.exceptions[0]!.claims[0]!.id='pair-claim-B'
 assert((await s.saveTemplateCompatibility(config)).ok);assert((await s.publishSpecModel(f.modelId)).ok)
 const next={...source,versionId:s.data.specModelVersions.filter(v=>v.templateId===f.modelId).at(-1)!.id};assert.deepEqual(previewMaterialScope(s.data,next,made.materialId).problems,[])
 assert((await s.saveMaterialRelation({source:next,materialId:made.materialId,requestId:'new-real-pair',basis:materialRelationBasis(s.data),confirmVersionChange:true})).ok)
 assert.equal(s.data.materialContributions!.find(c=>c.id===contribution.id)!.state,'deleted')
 assert.equal(s.data.compatibilities.filter(l=>l.targetId===made.materialId).length,1)
 pass('two real origin pairs never become a Cartesian product; unrelated same-content source can proceed without clearing cancellation');s.$dispose()
}
for(const mode of ['conditions','in-values','note'] as const){
 const f=accessory(),a=f.config.defaultRule.claims[0]!
 a.conclusion='conditional';a.conditions=mode==='in-values'?[{kind:'attribute',attributeId:'attr-color',operator:'in',value:['色彩 1','色彩 2']}]:[{kind:'manual',text:'条件A'},{kind:'equipment',text:'条件B'}]
 const b:TemplateCompatibilityClaim={...clone(a),id:'different-claim'}
 if(mode==='in-values')b.conditions=[{kind:'attribute',attributeId:'attr-color',operator:'in',value:['色彩 2','色彩 1','色彩 2']}];else if(mode==='conditions')b.conditions.reverse();else b.note+=' 其他备注'
 f.config.exceptions[0]!.claims=[b]
 const s=await open(f.data);assert((await s.publishSpecModel(f.modelId)).ok);const version=s.data.specModelVersions.filter(v=>v.templateId===f.modelId).at(-1)!
 const source:MaterialScope={kind:'node',modelId:f.modelId,versionId:version.id,anchorNodeId:'compat-style-0',scope:'subtree'}
 const made=await s.saveMaterialRelation({source,requestId:'create',name:'等价条件',basis:materialRelationBasis(s.data)});assert(made.ok,made.message)
 const other={...source,anchorNodeId:'compat-style-1'},p=previewMaterialScope(s.data,other,made.materialId);assert.deepEqual(p.problems,[])
 assert((await s.saveMaterialRelation({source:other,materialId:made.materialId,requestId:'link',basis:p.basis})).ok)
 assert.equal(s.data.compatibilities.filter(l=>l.targetId===made.materialId).length,mode==='note'?2:1)
 const contributions=s.data.materialContributions!.filter(c=>c.materialId===made.materialId)
 assert.equal(contributions.flatMap(c=>c.owners).length,8);assert.equal(contributions.flatMap(c=>c.lineage||[]).length,2)
 assert(contributions.flatMap(c=>c.lineage||[]).some(p=>p.ruleId===f.config.defaultRule.id&&p.claimId===a.id));assert(!contributions.flatMap(c=>c.lineage||[]).some(p=>p.ruleId===f.config.defaultRule.id&&p.claimId===b.id))
 for(const contradiction of ['conclusion','condition']){
  const config=clone(s.data.templateCompatibilityConfigs!.find(c=>c.modelId===f.modelId)!)
  if(contradiction==='conclusion')config.exceptions[0]!.claims[0]!.conclusion='incompatible';else config.exceptions[0]!.claims[0]!.conditions=[{kind:'manual',text:'另一条件'}]
  assert((await s.saveTemplateCompatibility(config)).ok);assert((await s.publishSpecModel(f.modelId)).ok)
  const memory=s.exportJson(),raw=disk.get(STORAGE_KEY),next={...other,versionId:s.data.specModelVersions.filter(v=>v.templateId===f.modelId).at(-1)!.id}
  const result=await s.saveMaterialRelation({source:next,materialId:made.materialId,requestId:'conflict-'+contradiction,basis:materialRelationBasis(s.data),confirmVersionChange:true});assert(!result.ok);assert.match(result.message,/冲突/);assert.equal(s.exportJson(),memory);assert.equal(disk.get(STORAGE_KEY),raw)
 }
 pass(`${mode}: normalized equivalent conditions link; exact origin pairs retained; real conclusion/condition conflict atomic`);s.$dispose()
}
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
 s.setRole('operator');await s.waitForPersistence();const memory2=s.exportJson(),raw2=disk.get(STORAGE_KEY),bad=JSON.parse(memory2);bad.data.materialRelations.find((r:{id:string})=>r.id===a.relationId).requestAliases=[];await assert.rejects(()=>s.importJson(JSON.stringify(bad)),/仅可查看/);assert.equal(s.exportJson(),memory2);assert.equal(disk.get(STORAGE_KEY),raw2)
 pass('A/B success receipts atomic, survive restore; revoked A/B cannot revive with fresh basis; new C links existing MAT; invalid/readonly import rejected');s.$dispose()
}
const out=process.env.R02_REPAIR_OUTPUT||'work/r02-repair-20261025';mkdirSync(out,{recursive:true});writeFileSync(`${out}/store-checks.json`,JSON.stringify({passed:checks.length,checks},null,2))
