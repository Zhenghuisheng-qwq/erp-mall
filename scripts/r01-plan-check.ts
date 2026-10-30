import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { installCatalogTestLocks } from './catalog-storage-test-env'
import { createCatalogModelFixture } from './catalog-model-fixture'
import { previewSkuAppend } from '../src/domain/spuSku'
import { planSkuLines } from '../src/domain/logic'
import { useCatalogStore } from '../src/stores/catalog'
import { DATA_VERSION, STORAGE_KEY, type ProductFamily } from '../src/domain/types'
installCatalogTestLocks()
const disk = new Map<string,string>(); let fail = false
Object.defineProperty(globalThis, 'localStorage', { configurable:true, value: { getItem:(k:string)=>disk.get(k)??null, setItem:(k:string,v:string)=>{if(fail){fail=false;throw Error('quota')};disk.set(k,v)}, removeItem:(k:string)=>disk.delete(k) } })
for (const common of [true,false]) {
  const f=createCatalogModelFixture(), {data,modelId,version}=f
  data.activeRole='admin'
  data.templates.push({id:modelId,name:'R01',parentId:null,enabled:true,structureOrder:[]})
  // Put the COMMON axis above the variant subtree; a separate pack branch must never leak in.
  const nodes=data.productSpecNodes.filter(n=>n.templateId===modelId)
  nodes.find(n=>n.id==='sample-style')!.parentId=common?'sample-pack-0':null
  if(!common) data.productSpecNodes=data.productSpecNodes.filter(n=>!n.id.startsWith('sample-pack'))
  version.nodesSnapshot=structuredClone(data.productSpecNodes.filter(n=>n.templateId===modelId))
  const family:ProductFamily={id:'r01-spu',name:'R01',templateId:modelId,productModelId:modelId,modelVersionId:version.id,categoryId:data.productTypes.find(t=>t.id==='type-case')!.categoryId,productTypeId:'type-case',oaProductId:'',commonAttrs:common?{包装:'包装 1'}:{},productGroupIds:[],line:'v2',lifecycle:'ready',shelfStatus:'online',createdAt:'2026-10-25',updatedAt:'2026-10-25'}
  data.families.push(family)
  const plan={id:'r01-plan',name:'R01',productModelId:modelId,productTypeId:'type-case',modelVersionId:version.id,selectedNodes:common?['sample-pack-0','sample-style-0']:['sample-style-0'],status:'saved' as const,createdTime:'2026-10-25'}
  data.productPlans.push(plan)
  const lines=planSkuLines(data,plan)!
  assert.equal(lines.skus.length,2)
  for(const row of lines.skus){assert.equal('包装' in row.variantAttrs,false);assert.equal(row.sourceNodeIds.includes('sample-pack-0'),common);assert(!row.sourceNodeIds.includes('sample-pack-1'))}
  disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data}));setActivePinia(createPinia());const store=useCatalogStore();await store.waitForPersistence()
  const model=previewSkuAppend(store.data,family.id,{kind:'model'})
  assert.equal(model.rows.length,4);assert(model.rows.every(r=>r.state==='new'))
  const generation={kind:'plan' as const,planId:plan.id}, preview=previewSkuAppend(store.data,family.id,generation)
  assert.equal(preview.rows.length,2)
  const before=JSON.stringify(store.data), stored=disk.get(STORAGE_KEY)
  fail=true;assert.equal((await store.appendSkus(family.id,generation,preview.rows.map(r=>r.key))).ok,false)
  assert.equal(JSON.stringify(store.data),before);assert.equal(disk.get(STORAGE_KEY),stored)
  const result=await store.appendSkus(family.id,generation,preview.rows.map(r=>r.key));assert(result.ok,result.message)
  assert.equal((result as {ids:string[]}).ids.length,2)
  const repeat=await store.appendSkus(family.id,generation,preview.rows.map(r=>r.key));assert(repeat.ok);assert.equal((repeat as {ids:string[]}).ids.length,0)
  const rest=previewSkuAppend(store.data,family.id,{kind:'model'});assert.equal(rest.rows.filter(r=>r.state==='new').length,2)
  assert((await store.appendSkus(family.id,{kind:'model'},rest.rows.filter(r=>r.state==='new').map(r=>r.key))).ok)
  store.$dispose()
  console.log(`PASS COMMON=${common}: plan=2 model=4 isolated sources, atomic failure, retry`)
}
