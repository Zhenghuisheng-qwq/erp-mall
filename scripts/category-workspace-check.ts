import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createPinia, setActivePinia } from 'pinia'
import { categoryWorkspaceFixture } from './category-workspace-fixture'
import { installCatalogTestLocks } from './catalog-storage-test-env'
import { categoryStructureStamp, previewCategoryMove } from '../src/domain/categoryMovement'
import { childrenOfParent, moveCategoryNode, relocateCategoryNodes } from '../src/domain/categoryTree'
import { runCategoryTreeSelectChecks } from '../src/domain/categoryTreeSelectCheck'
import { runProductListCategoryChecks } from '../src/domain/productListCategoryCheck'
import { defaultSkuConfig } from '../src/domain/skuWorkbenchState'
import { updateSkuCategorySelection } from '../src/domain/skuCategoryFilter'
import { querySkuWorkbench } from '../src/domain/skuWorkbenchQuery'
import { useCatalogStore } from '../src/stores/catalog'
const checks:string[]=[]
function check(name:string,run:()=>void){run();checks.push(name);console.log('PASS '+name)}
const data=categoryWorkspaceFixture(), typed=new Set(data.productTypes.map(item=>item.categoryId))
const relations=JSON.stringify({...data,categories:undefined})
const descendants=data.categories.filter(item=>item.parentId==='r4-source').map(item=>({...item}))
const order=(id:string|null)=>childrenOfParent(data.categories,id).map(item=>item.id)
check('before/after reorder stable siblings',()=>{
 assert.equal(relocateCategoryNodes(data.categories,'r4-peer','r4-source','before',typed),'');assert.deepEqual(order('r4-a'),['r4-peer','r4-source'])
 assert.equal(relocateCategoryNodes(data.categories,'r4-peer','r4-source','after',typed),'');assert.deepEqual(order('r4-a'),['r4-source','r4-peer'])
})
check('inner moves complete subtree without changing descendants or associated records',()=>{
 assert.equal(relocateCategoryNodes(data.categories,'r4-source','r4-b','inner',typed),'')
 assert.equal(data.categories.find(x=>x.id==='r4-source')!.parentId,'r4-b')
 assert.deepEqual(data.categories.filter(item=>item.parentId==='r4-source'),descendants)
 assert.equal(JSON.stringify({...data,categories:undefined}),relations)
})
check('root movement and typed source legal',()=>{
 assert.equal(moveCategoryNode(data.categories,'r4-source',null,typed),'')
 assert.equal(moveCategoryNode(data.categories,'r4-typed','r4-a',typed),'')
 assert.equal(data.productTypes.find(x=>x.id==='r4-type')!.categoryId,'r4-typed')
})
check('self/descendant/missing source or target/typed target reject atomically',()=>{
 for(const [id,targetId] of [['r4-source','r4-source'],['r4-source','r4-leaf'],['missing','r4-a'],['r4-source','missing'],['r4-source','r4-typed']]){
  const before=JSON.stringify(data)
  assert(previewCategoryMove(data.categories,{id:id!,targetId:targetId!},typed).message)
  assert(moveCategoryNode(data.categories,id!,targetId!,typed))
  assert.equal(JSON.stringify(data),before)
 }
})
check('cancelled preview/no-op reorder cause zero change including derived fields',()=>{
 const row=data.categories.find(x=>x.id==='r4-peer')!;row.path='retained-derived-value'
 const before=JSON.stringify(data)
 assert.equal(previewCategoryMove(data.categories,{id:row.id,targetId:row.parentId},typed).changed,false)
 const siblings=order(row.parentId),next=siblings[siblings.indexOf(row.id)+1]!
 assert.equal(previewCategoryMove(data.categories,{id:row.id,targetId:next,position:'before'},typed).changed,false)
 assert.equal(JSON.stringify(data),before)
})
check('disabled source remains movable under existing rules',()=>{
 data.categories.find(x=>x.id==='r4-peer')!.enabled=false
 assert.equal(moveCategoryNode(data.categories,'r4-peer','r4-b',typed),'')
})
check('saved subtree SKU root IDs follow current hierarchy without rewriting saved conditions',()=>{
 const config=updateSkuCategorySelection(defaultSkuConfig(),['r4-a'])!,before=JSON.stringify(config)
 assert(!querySkuWorkbench(data,config).allIds.includes('gaps-a'))
 moveCategoryNode(data.categories,'r4-source','r4-a',typed)
 assert(querySkuWorkbench(data,config).allIds.includes('gaps-a'))
 moveCategoryNode(data.categories,'r4-source','r4-b',typed)
 assert(!querySkuWorkbench(data,config).allIds.includes('gaps-a'))
 assert.equal(JSON.stringify(config),before);assert.equal(JSON.stringify({...data,categories:undefined}),relations)
})
check('existing category selector and product category view regressions',()=>{
 for(const result of [...runCategoryTreeSelectChecks(),...runProductListCategoryChecks()])assert(result.ok,`${result.id}: ${result.detail}`)
})
installCatalogTestLocks()
const disk=new Map<string,string>(),seed=categoryWorkspaceFixture();disk.set('iyge-v2-mock-db',JSON.stringify({version:15,data:seed}))
let fail=false,writes=0
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>disk.get(key)??null,setItem:(key:string,value:string)=>{if(fail)throw Error('fixture quota failure');writes++;disk.set(key,value)},removeItem:(key:string)=>disk.delete(key)}})
setActivePinia(createPinia());const store=useCatalogStore();await store.flushPersistence();const priorDisk=disk.get('iyge-v2-mock-db')
fail=true
assert.equal(store.relocateCategory('r4-source','r4-before','before'),'')
const applied=categoryStructureStamp(store.data.categories)
assert.equal((await store.flushPersistence()).ok,false)
assert.equal(categoryStructureStamp(store.data.categories),applied);assert.equal(disk.get('iyge-v2-mock-db'),priorDisk)
fail=false;const priorWrites=writes
assert.equal((await store.flushPersistence()).ok,true);assert.equal(categoryStructureStamp(store.data.categories),applied)
assert.equal(writes,priorWrites+1);assert.equal((await store.flushPersistence()).ok,true);assert.equal(writes,priorWrites+1)
checks.push('real store persistence failure retains moved result; save-only retry once, no relative move replay')
store.$dispose()
if(!process.env.CATEGORY_WORKSPACE_OUTPUT)throw Error('CATEGORY_WORKSPACE_OUTPUT required')
mkdirSync(process.env.CATEGORY_WORKSPACE_OUTPUT,{recursive:true});writeFileSync(resolve(process.env.CATEGORY_WORKSPACE_OUTPUT,'result.json'),JSON.stringify({checks,result:'PASS'},null,2))
console.log(`PASS ${checks.length} category workspace groups`)
