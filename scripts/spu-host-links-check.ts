import assert from 'node:assert/strict'
import {createPinia,setActivePinia} from 'pinia'
import {installCatalogTestLocks} from './catalog-storage-test-env'
import {createSeed} from '../src/domain/seed'
import {useCatalogStore} from '../src/stores/catalog'
import {STORAGE_KEY,DATA_VERSION} from '../src/domain/types'
import {spuHostLinkStorageProblems} from '../src/domain/spuHostLinks'
import {spuRemovalBlock} from '../src/domain/spuSku'
installCatalogTestLocks();const data=createSeed(),disk=new Map<string,string>();let fail=false
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>disk.get(k)??null,setItem:(k:string,v:string)=>{if(fail){fail=false;throw Error('quota')};disk.set(k,v)},removeItem:(k:string)=>disk.delete(k)}})
const family=(id:string)=>data.skus.find(s=>s.id===id)!.familyId;data.skuHostLinks=[{id:'old-1',accessorySkuId:'demo18-sku-case-1',hostSkuIds:['demo18-sku-phone-1','demo18-sku-phone-2'],revision:1,createdAt:'2026-11-01T00:00:00Z',updatedAt:'2026-11-01T00:00:00Z'},{id:'old-2',accessorySkuId:'demo18-sku-case-2',hostSkuIds:['huawei-sku-phone-1'],revision:2,createdAt:'2026-11-01T00:00:00Z',updatedAt:'2026-11-01T00:00:00Z'}];
disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data}));setActivePinia(createPinia());const store=useCatalogStore();await store.waitForPersistence();const protectedData=JSON.stringify([store.data.families,store.data.skus,store.data.benefitTypeGroups,store.data.benefitSalesLists,store.data.compatibilities])
assert(store.canRoute({path:'/compatibility/list'}));assert(store.canRoute({path:'/compatibility/config'}))
const accessory=family('demo18-sku-case-1'),host=family('demo18-sku-phone-1'),another=family('huawei-sku-phone-1');assert.equal(store.data.spuHostLinks!.length,1);assert.equal(store.data.spuHostLinks![0]!.hostSpuIds.length,2);assert.deepEqual(store.data.skuHostLinks,data.skuHostLinks);assert((await store.removeSpuHostLink(accessory,store.data.spuHostLinks![0]!.revision)).ok);
const before=store.exportJson();fail=true;assert(!(await store.saveSpuHostLink(accessory,[host],0)).ok);assert.equal(store.exportJson(),before)
assert(!(await store.saveSpuHostLink(host,[accessory],0)).ok);assert(!(await store.saveSpuHostLink(accessory,[host,host],0)).ok);assert(!(await store.saveSpuHostLink(accessory,[],0)).ok)
const first=await store.saveSpuHostLink(accessory,[host],0);assert(first.ok);assert('record'in first);assert.equal(first.record.hostSpuIds.length,1);assert((await store.saveSpuHostLink(accessory,[host,another],1)).ok);assert(!(await store.saveSpuHostLink(accessory,[host],1)).ok);assert.equal(store.data.spuHostLinks![0]!.hostSpuIds.length,2);assert(spuRemovalBlock(store.data,host));assert(store.data.families.some(f=>f.id===host));assert.deepEqual(spuHostLinkStorageProblems(store.data),[])
assert(!(await store.removeSpuHostLink(accessory,1)).ok);assert((await store.removeSpuHostLink(accessory,2)).ok);assert.equal(store.data.spuHostLinks!.length,0);assert.equal(JSON.stringify([store.data.families,store.data.skus,store.data.benefitTypeGroups,store.data.benefitSalesLists,store.data.compatibilities]),protectedData)
assert(store.startPermissionPreview('u-op').ok);assert.throws(()=>store.saveSpuHostLink(accessory,[host],0),/未授权/);store.stopPermissionPreview();store.$dispose();console.log('PASS SKU→SPU迁移合并去重、配件/主机SPU身份校验、单选多选、失败原子性、并发保护、关联引用删除保护、解除关系、权限与原数据保护')
