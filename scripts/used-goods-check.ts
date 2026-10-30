import assert from 'node:assert/strict'
import {createPinia,setActivePinia} from 'pinia'
import {installCatalogTestLocks} from './catalog-storage-test-env'
import {createSeed} from '../src/domain/seed'
import {STORAGE_KEY,DATA_VERSION} from '../src/domain/types'
import {useCatalogStore} from '../src/stores/catalog'
import {emptyUsedInput,usedSpuRows,usedStorageProblems,parseUsedPrice,normalized,type UsedSku,type UsedInput} from '../src/domain/usedGoods'
installCatalogTestLocks();const disk=new Map<string,string>();let fail=false
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>disk.get(k)??null,setItem:(k:string,v:string)=>{if(fail){fail=false;throw Error('isolated quota')};disk.set(k,v)},removeItem:(k:string)=>disk.delete(k)}})
disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data:createSeed()}));setActivePinia(createPinia());const store=useCatalogStore();await store.waitForPersistence();assert.equal(store.data.usedGoods,undefined)
const copy=<T>(v:T):T=>JSON.parse(JSON.stringify(v)),core=()=>JSON.stringify(Object.entries(store.data).filter(([key])=>key!=='usedGoods')),beforeCore=core(),input={...emptyUsedInput(),name:'Apple iPhone 15 Pro',brand:'Apple',model:'iPhone 15 Pro',spec:'256GB',color:'黑色'}
assert.equal(parseUsedPrice(''),null);assert.equal(parseUsedPrice('0'),0);assert.equal(parseUsedPrice('123.45'),12345);assert.equal(parseUsedPrice('1.234'),undefined);assert.equal(normalized('  ＡＰＰＬＥ  '),'apple')
const first=await store.saveUsedSku(input,0,'request-a');assert(first.ok);assert('record'in first);const a=copy(first.record),spuId=a.spuId;assert.equal(a.code,'USED-SKU-000001');assert.equal(a.priceCents,null);assert.equal(a.groupId,null)
const same=await Promise.all([store.saveUsedSku(input,0,'request-a'),store.saveUsedSku(input,0,'request-a')]);assert(same.every(r=>r.ok));assert.equal(store.data.usedGoods!.skus.length,1)
const second=await store.saveUsedSku({...input,brand:' apple ',model:'iPhone   15 Pro',priceCents:359900,imei:'IMEI-B',extra:[{key:'外观',value:'轻微划痕'}]},0,'request-b');assert(second.ok);assert('record'in second);const b=copy(second.record);assert.equal(b.spuId,spuId)
const third=await store.saveUsedSku({...input,priceCents:0},0,'request-c');assert(third.ok);assert('record'in third);let c=copy(third.record);assert.equal(c.spuId,spuId);assert.equal(store.data.usedGoods!.spus.length,1);assert.equal(usedSpuRows(store.data.usedGoods!)[0]!.skuCount,3)
const raw=disk.get(STORAGE_KEY),before=store.exportJson();fail=true;assert(!(await store.saveUsedSku({...input,model:'Mate 70',brand:'华为'},0,'request-fail')).ok);assert.equal(disk.get(STORAGE_KEY),raw);assert.equal(store.exportJson(),before);assert((await store.saveUsedSku({...input,model:'Mate 70',brand:'华为'},0,'request-fail')).ok);assert.equal(store.data.usedGoods!.spus.length,2)
assert(!(await store.saveUsedSku({...input,imei:'IMEI-B'},0,'duplicate-imei')).ok);assert(!(await store.saveUsedSku({...input,spuId:'demo18-spu-phone'},0,'bad-standard-ref')).ok)
console.log('PASS A/B/C/E/H：直接新增、精确归属、同规格单机独立、空分组/空售价与0元区分；请求防重、唯一标识、原子失败重试')
const group=await store.saveUsedGroup('','展示样机',0);assert(group.ok);assert('record'in group);const g=copy(group.record)
function toInput(s:UsedSku):UsedInput{const p=store.data.usedGoods!.spus.find(p=>p.id===s.spuId)!;return {...copy(s),brand:p.brand,model:p.model}}
const grouped=await store.saveUsedSku({...toInput(c),groupId:g.id},c.revision,'unused-update');assert(grouped.ok);assert('record'in grouped);c=copy(grouped.record);assert.equal(c.spuId,spuId);assert(!(await store.removeUsedGroup(g.id,g.revision)).ok);assert(!(await store.removeUsedSpu(spuId,1)).ok)
assert((await store.saveUsedGroup(g.id,'展示设备',g.revision)).ok);assert(!(await store.saveUsedSku(toInput(a),a.revision+1,'stale')).ok)
assert((await store.setUsedSkuStatus(b.id,b.revision,'on_sale')).ok);let row=copy(store.data.usedGoods!.skus.find(s=>s.id===b.id)!);assert.equal(usedSpuRows(store.data.usedGoods!).find(s=>s.id===spuId)!.onSaleCount,1);assert.equal(usedSpuRows(store.data.usedGoods!).find(s=>s.id===spuId)!.minPrice,359900)
assert((await store.setUsedSkuStatus(row.id,row.revision,'sold')).ok);row=copy(store.data.usedGoods!.skus.find(s=>s.id===b.id)!);assert.equal(usedSpuRows(store.data.usedGoods!).find(s=>s.id===spuId)!.onSaleCount,0);assert(!(await store.setUsedSkuStatus(row.id,row.revision,'on_sale')).ok);assert(!(await store.removeUsedSku(row.id,row.revision)).ok);assert(!(await store.saveUsedSku(toInput(row),row.revision,'edit-sold')).ok)
assert((await store.setUsedSkuStatus(c.id,c.revision,'archived')).ok);c=copy(store.data.usedGoods!.skus.find(s=>s.id===c.id)!);assert(!(await store.setUsedSkuStatus(c.id,c.revision,'on_sale')).ok)
const unnamed=await store.saveUsedSku({...emptyUsedInput(),name:'临时收回单机'},0,'name-only');assert(unnamed.ok);assert('record'in unnamed);assert((await store.removeUsedSku(unnamed.record.id,unnamed.record.revision)).ok);const emptySpu=store.data.usedGoods!.spus.find(s=>s.id===unnamed.record.spuId)!;assert((await store.removeUsedSpu(emptySpu.id,emptySpu.revision)).ok)
console.log('PASS D/F/I：自定义分组及引用删除保护；上架/已售/归档与SPU实时汇总，已售不能恢复销售、编辑或删除，不级联删除')
const forced=await store.saveUsedSku({...input,newSpu:true},0,'force-second-subject');assert(forced.ok);const ambiguous=await store.saveUsedSku(input,0,'ambiguous');assert(!ambiguous.ok);assert('choices'in ambiguous);assert((await store.saveUsedSku({...input,spuId},0,'ambiguous')).ok)
assert.deepEqual(usedStorageProblems(store.data.usedGoods),[]);assert.equal(core(),beforeCore);assert.throws(()=>{store.data.usedGoods!.skus.push(a)},/受控命令/)
const preserved=copy(store.data.usedGoods);store.$dispose();setActivePinia(createPinia());const reload=useCatalogStore();await reload.waitForPersistence();assert.deepEqual(reload.data.usedGoods,preserved);assert(reload.startPermissionPreview('u-op').ok);assert.equal(reload.data.usedGoods,undefined);assert.throws(()=>reload.saveUsedSku(input,0,'forbidden'),/未授权/);assert(reload.stopPermissionPreview().ok);reload.$dispose()
console.log('PASS G/H/J：二手命名空间、稳定关联及模糊/重复主体显式选择；刷新回显、RBAC和受控写入；原商品/模型/物料/兼容性/权益包及视图逐项不变')
