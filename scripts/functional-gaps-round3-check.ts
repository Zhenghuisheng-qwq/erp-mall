import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { functionalGapsFixture } from './functional-gaps-fixture'
import { defaultSkuConfig, repairSkuConfig } from '../src/domain/skuWorkbenchState'
import { querySkuWorkbench, describeSkuConditions, validateSkuConfig } from '../src/domain/skuWorkbenchQuery'
import { skuCategorySelection, updateSkuCategorySelection } from '../src/domain/skuCategoryFilter'
import { createRefinementSyncFixture } from './compatibility-refinement-sync-fixtures'
import { applyTemplateCompatibilitySync, markTemplateManualChanges, previewTemplateCompatibilitySync, templateSyncCandidateConflicts } from '../src/domain/templateCompatibilitySync'
import { freezeTemplateCompatibility } from '../src/domain/templateCompatibility'
import { queryModelAccessories } from '../src/domain/accessoryCompatibilityQuery'
const checks:string[]=[]
const check=(name:string,run:()=>void)=>{run();checks.push(name);console.log('PASS',name)}
const {data}=functionalGapsFixture()
const fam=data.families.find(x=>x.id==='gaps-spu')!,sku=data.skus.find(x=>x.id==='gaps-a')!
data.categories.push({id:'r3-tablet',name:'验收平板',parentId:'c-host',enabled:true,sort:20},{id:'r3-accessory',name:'验收配件',parentId:null,enabled:true,sort:21},{id:'r3-empty',name:'空分类',parentId:null,enabled:true,sort:22})
data.families.push({...fam,id:'r3-tablet-spu',categoryId:'r3-tablet'},{...fam,id:'r3-case-spu',categoryId:'r3-accessory'})
data.skus.push({...sku,id:'r3-tablet-sku',familyId:'r3-tablet-spu'},{...sku,id:'r3-case-sku',familyId:'r3-case-spu'})
const original=JSON.stringify(data),base=defaultSkuConfig(),select=(ids:string[])=>updateSkuCategorySelection(base,ids)!,ids=(config:typeof base)=>querySkuWorkbench(data,config).allIds
check('A parent/leaf/multi-root union/overlap/empty/SPU intersection',()=>{
 assert(ids(select(['c-host'])).includes('r3-tablet-sku'));assert(ids(select(['c-host'])).includes('gaps-a'))
 assert(!ids(select(['c-phone'])).includes('r3-tablet-sku'));assert(ids(select(['c-host','r3-accessory'])).includes('r3-case-sku'))
 assert.deepEqual(ids(select(['c-host','c-phone'])),ids(select(['c-host'])))
 assert.deepEqual(ids(select(['r3-empty'])),[])
 assert.deepEqual(querySkuWorkbench(data,select(['c-host']),{scopeId:'gaps-spu'}).allIds.sort(),['gaps-a','gaps-b','gaps-sale'])
})
check('A stable ruleId, quick filter cleanup, config preservation, old exact conditions',()=>{
 const c=select(['c-host']);const rule=c.conditions.children[0]!;c.quickFilters=[{source:'condition',ruleId:rule.id}]
 c.conditions.children.push({kind:'rule',id:'status',field:'status',operator:'eq',value:'on_sale'})
 const changed=updateSkuCategorySelection(c,['c-phone'])!;assert.equal(changed.conditions.children[0]!.id,rule.id);assert.deepEqual(changed.quickFilters,c.quickFilters)
 assert.deepEqual(changed.columns,c.columns);assert.deepEqual(changed.sorts,c.sorts);assert.deepEqual(changed.groups,c.groups)
 const cleared=updateSkuCategorySelection(changed,[])!;assert.deepEqual(cleared.conditions.children.map(x=>x.id),['status']);assert.equal(cleared.quickFilters?.length,0)
 for(const operator of ['eq','in'] as const){const old=defaultSkuConfig();old.conditions.children=[{kind:'rule',id:'old',field:'category',operator,value:operator==='eq'?'c-host':['c-host']}];assert(!ids(old).includes('gaps-a'));assert.equal(repairSkuConfig(old,data).conditions.children[0]?.kind,'rule')}
 assert.equal(validateSkuConfig(data,c).length,0);assert(describeSkuConditions(data,c).includes('主机'))
 assert.deepEqual(ids(repairSkuConfig(JSON.parse(JSON.stringify(c)),data)),ids(c))
})
check('A advanced conditions unchanged and query pure',()=>{
 const c=defaultSkuConfig();c.conditions.logic='any';c.conditions.children=[{kind:'rule',id:'x',field:'name',operator:'contains',value:'甲'}]
 assert.equal(updateSkuCategorySelection(c,['c-host']),undefined);c.conditions.logic='all';c.conditions.children=[{kind:'group',id:'nested',logic:'any',children:[]}];assert.equal(skuCategorySelection(c).supported,false)
 assert.equal(JSON.stringify(data),original)
 const parent=select(['c-host']);data.categories.push({id:'new-child',name:'新增子类',parentId:'c-host',enabled:true,sort:30});data.families.push({...fam,id:'new-family',categoryId:'new-child'});data.skus.push({...sku,id:'new-sku',familyId:'new-family'});assert(ids(parent).includes('new-sku'))
})
const now='2026-10-24T12:00:00Z'
const plan=(f:ReturnType<typeof createRefinementSyncFixture>,version:string)=>previewTemplateCompatibilitySync(f.data,{modelId:f.modelId,targetVersionId:version,targetIds:[f.sku.id]})
function conflictFixture(mode='modified'){
 const f=createRefinementSyncFixture(['甲','乙','丙']),third=f.links().find(x=>x.note==='丙')!
 third.conclusion='incompatible';markTemplateManualChanges(f.data,[{kind:'update',id:third.id}],now)
 if(mode==='manual')third.provenance={kind:'manual',detail:'独立人工依据'}
 if(mode==='stale')f.origins().find(x=>x.declarationId===third.id)!.state='stale'
 if(mode==='kept')f.origins().find(x=>x.declarationId===third.id)!.state='kept'
 const version=f.publish(['合并','合并','丙']);return {...f,third,targetVersion:version}
}
for(const mode of ['modified','manual','kept','stale'])check('B outside group protected '+mode,()=>{
 const f=conflictFixture(mode),p=plan(f,f.targetVersion),g=p.items.find(x=>x.group)!
 assert.equal(g.group!.canAdopt,false);assert(g.blockingIds?.includes(f.third.id));const before=JSON.stringify(f.data)
 assert.equal(applyTemplateCompatibilitySync(f.data,p,{[g.id]:'take-template'},f.nextId,now).ok,false);assert.equal(JSON.stringify(f.data),before)
 assert.deepEqual(plan(f,f.targetVersion),p)
 const query=queryModelAccessories(f.data,f.hosts.a);assert(query.excluded.some(row=>row.target.id===f.sku.id));assert(!query.sales.some(row=>row.target.id===f.sku.id))
})
check('B unrelated host/capability/target does not block; handling blocker allows retry',()=>{
 for(const dimension of ['host','capability','target','resolve']){
  const f=conflictFixture();if(dimension==='host')f.third.host=structuredClone(f.hosts.b)
  if(dimension==='capability')f.third.capability='fast-charge'
  if(dimension==='target')f.third.targetId='unrelated-target'
  if(dimension==='resolve')f.third.conclusion='compatible'
  const p=plan(f,f.targetVersion),g=p.items.find(x=>x.group)!;assert.equal(g.group!.canAdopt,true,dimension)
  const oldVersions=JSON.stringify(f.data.specModelVersions),decisions=Object.fromEntries(p.items.map(x=>[x.id,x===g?'take-template':'keep'])) as Record<string,'take-template'|'keep'>
  assert.equal(applyTemplateCompatibilitySync(f.data,p,decisions,f.nextId,now).ok,true,dimension);assert.equal(JSON.stringify(f.data.specModelVersions),oldVersions)
  assert.equal(f.data.compatibilities.find(x=>x.id===f.third.id)?.conclusion,f.third.conclusion)
 }
})
check('B independent manual denial cannot be deleted by explicit single adoption',()=>{
 const f=createRefinementSyncFixture(['旧']),version=f.publish(['新'])
 const manual={...structuredClone(f.links()[0]!),id:'independent-denial',conclusion:'incompatible' as const,provenance:{kind:'manual' as const,detail:'独立人工维护'}}
 f.data.compatibilities.push(manual)
 const p=plan(f,version),item=p.items.find(x=>x.blockingIds?.includes(manual.id))!
 assert(item);const before=JSON.stringify(f.data)
 assert.equal(applyTemplateCompatibilitySync(f.data,p,{[item.id]:'take-template'},f.nextId,now).ok,false)
 assert.equal(JSON.stringify(f.data),before)
})
check('B stale preview refuses atomically',()=>{
 const f=createRefinementSyncFixture(['甲','乙']),version=f.publish(['合并','合并']),p=plan(f,version),g=p.items.find(x=>x.group)!
 const denial={...structuredClone(f.links()[0]!),id:'late-denial',conclusion:'incompatible' as const,provenance:{kind:'manual' as const,detail:'外部修改'}};f.data.compatibilities.push(denial)
 const before=JSON.stringify(f.data);assert.equal(applyTemplateCompatibilitySync(f.data,p,{[g.id]:'take-template'},f.nextId,now).ok,false);assert.equal(JSON.stringify(f.data),before)
})
check('B final selections exclude replaced old declarations; mixed operations detect contradiction',()=>{
 const f=createRefinementSyncFixture(['甲','乙']);const version=f.publish(['新甲','新乙'])
 f.config.defaultRule.claims.forEach(claim=>claim.conclusion='incompatible')
 f.data.specModelVersions.find(x=>x.id===version)!.templateCompatibilitySnapshot=freezeTemplateCompatibility(f.data,f.modelId)
 const p=plan(f,version),decisions=Object.fromEntries(p.items.map(x=>[x.id,x===p.items[0]?'take-template':'keep'])) as Record<string,'take-template'|'keep'>
 assert(templateSyncCandidateConflicts(f.data,p,decisions).length>0);const before=JSON.stringify(f.data);assert.equal(applyTemplateCompatibilitySync(f.data,p,decisions,f.nextId,now).ok,false);assert.equal(JSON.stringify(f.data),before)
 f.config.defaultRule.claims[1]!.conclusion='incompatible';f.data.specModelVersions.find(x=>x.id===version)!.templateCompatibilitySnapshot=freezeTemplateCompatibility(f.data,f.modelId)
 const next=plan(f,version);assert.equal(templateSyncCandidateConflicts(f.data,next,{}).length,0);assert.equal(applyTemplateCompatibilitySync(f.data,next,{},f.nextId,now).ok,true)
})
if(!process.env.ROUND3_OUTPUT)throw Error('ROUND3_OUTPUT required')
mkdirSync(process.env.ROUND3_OUTPUT,{recursive:true});writeFileSync(resolve(process.env.ROUND3_OUTPUT,'domain.json'),JSON.stringify({checks},null,2))
