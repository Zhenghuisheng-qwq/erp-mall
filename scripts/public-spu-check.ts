import assert from 'node:assert/strict'
import {createPinia,setActivePinia} from 'pinia'
import {installCatalogTestLocks} from './catalog-storage-test-env'
import {publicSpuFixture,publicTestId,publicModel,publicType} from './public-spu-fixture'
import {useCatalogStore} from '../src/stores/catalog'
import {STORAGE_KEY,DATA_VERSION} from '../src/domain/types'
import {publicPoolBasis,filterPublicSpus,emptyPublicSpuFilter,publicSpuProblem} from '../src/domain/benefitSales/publicSpuPool'
import {saleQuery} from '../src/domain/benefitSales/query'
import {isRealSku} from '../src/domain/catalogIdentity'
installCatalogTestLocks()
const fixture=publicSpuFixture(),disk=new Map<string,string>();let fail=false
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>disk.get(k)??null,setItem:(k:string,v:string)=>{if(fail){fail=false;throw Error('isolated quota')};disk.set(k,v)},removeItem:(k:string)=>disk.delete(k)}})
disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data:fixture}));setActivePinia(createPinia());const store=useCatalogStore();await store.waitForPersistence()
const before=store.exportJson(),raw=disk.get(STORAGE_KEY),ids=[publicTestId,'public-test-cable-spu','public-test-filed-fam'];fail=true;assert(!(await store.addPublicSpus(ids,publicPoolBasis(store.data))).ok);assert.equal(store.exportJson(),before);assert.equal(disk.get(STORAGE_KEY),raw)
assert((await store.addPublicSpus(ids,publicPoolBasis(store.data))).ok);const once=disk.get(STORAGE_KEY);assert((await store.addPublicSpus(ids,publicPoolBasis(store.data))).ok);assert.equal(disk.get(STORAGE_KEY),once)
assert(publicSpuProblem(store.data,'public-test-filed-sku'));const filed=filterPublicSpus(store.data,{...emptyPublicSpuFilter(),categoryId:'public-test-category',productTypeId:publicType,modelId:publicModel}).find(r=>r.id==='public-test-filed-fam')!;assert(filed);assert.equal(filed.skuCount,0);assert.equal(filed.materialCount,1)
const scope={mode:'free' as const,categoryId:'',productTypeIds:[],device:null},query=saleQuery(store.data,scope);assert(query.groups.some(g=>g.spuId==='public-test-cable-spu'&&g.empty==='暂无可选规格'));assert(query.candidates.some(c=>c.id==='public-test-sku-1'));assert(!query.candidates.some(c=>c.id==='public-test-sku-2'));assert(query.candidates.every(c=>isRealSku(store.data,store.data.skus.find(s=>s.id===c.id)!)))
const plain=JSON.parse(JSON.stringify(store.data));delete plain.productTypes.find((t:{id:string})=>t.id===publicType).catalogRole;assert(saleQuery(plain,scope).candidates.some(c=>c.id==='public-test-sku-1'))
const oldGroups=JSON.stringify(store.data.benefitTypeGroups),oldHistory=JSON.stringify(store.data.benefitSalesLists);const saved=await store.saveBundleSale({id:'',scope,lines:[{skuId:'public-test-sku-1',quantity:2,unitPriceCents:12900}],status:'confirmed'},0);assert(saved.ok);assert('record'in saved);assert.deepEqual(saved.record.scope.commonSpuIds,[publicTestId]);assert.deepEqual(saved.record.snapshot!.commonSpus!.map(s=>s.spuId),[publicTestId]);assert.equal((saved.record.snapshot!.lines[0]!.evidence as unknown[]).length,0)
const entry=store.data.publicSpuPool!.find(e=>e.spuId===publicTestId)!;assert((await store.setPublicSpuEnabled(entry.spuId,false,entry.revision)).ok);assert(!saleQuery(store.data,scope).candidates.some(c=>c.id==='public-test-sku-1'));assert.deepEqual(store.data.benefitSalesLists!.find(s=>s.id===saved.record.id),saved.record);assert.equal(JSON.stringify(store.data.benefitTypeGroups),oldGroups);assert.equal(JSON.stringify(store.data.benefitSalesLists!.filter(s=>s.id!==saved.record.id)),oldHistory)
assert.deepEqual(store.data.families,fixture.families);assert.deepEqual(store.data.skus,fixture.skus);assert(store.startPermissionPreview('u-op').ok);assert.throws(()=>store.addPublicSpus(['public-test-empty-1'],publicPoolBasis(store.data)),/未授权/);assert(store.stopPermissionPreview().ok);store.$dispose()
console.log('PASS 公共池目录树筛选、物料SPU与0SKU展示、重复/失败恢复、普通商品加购与来源冻结、停售过滤、权限及历史保护')
