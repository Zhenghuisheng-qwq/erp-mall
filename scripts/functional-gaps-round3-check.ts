import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { functionalGapsFixture } from './functional-gaps-fixture'
import { defaultSkuConfig, repairSkuConfig } from '../src/domain/skuWorkbenchState'
import { querySkuWorkbench, describeSkuConditions, validateSkuConfig } from '../src/domain/skuWorkbenchQuery'
import { skuCategorySelection, updateSkuCategorySelection } from '../src/domain/skuCategoryFilter'
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
if(!process.env.ROUND3_OUTPUT)throw Error('ROUND3_OUTPUT required')
mkdirSync(process.env.ROUND3_OUTPUT,{recursive:true});writeFileSync(resolve(process.env.ROUND3_OUTPUT,'domain.json'),JSON.stringify({checks},null,2))
