import assert from 'node:assert/strict'
import {createPinia,setActivePinia} from 'pinia'
import {installCatalogTestLocks} from './catalog-storage-test-env'
import {createSeed} from '../src/domain/seed'
import {useCatalogStore} from '../src/stores/catalog'
import {STORAGE_KEY,DATA_VERSION} from '../src/domain/types'
import {saleQuery} from '../src/domain/benefitSales/query'
import {groupRangeTypes} from '../src/domain/benefitSales/categoryRanges'
import {writeSale} from '../src/domain/benefitSales/commands'
import {defaultMenuNodes,sanitizeMenu} from '../src/domain/menuConfig'
import {permissionRegistry} from '../src/domain/rbac'
installCatalogTestLocks();const data=createSeed(),group=data.benefitTypeGroups![0]!,scope={mode:'group' as const,groupId:group.id,categoryId:group.categoryId,productTypeIds:groupRangeTypes(data,group),device:{kind:'sku' as const,skuId:'demo18-sku-phone-1'}}
data.compatibilities=[{id:'retired-raw',opaque:{preserve:true}}];data.generalCompatibilityClaims=[{id:'retired-claim',opaque:[1,2,3]}]
const historical=writeSale(data,{id:'',scope,lines:[{skuId:'demo18-sku-phone-1',quantity:1,unitPriceCents:100}],status:'confirmed'},0,()=> 'historical','2026-11-01T00:00:00Z');assert(historical.ok);historical.record.snapshot!.lines[0]!.evidence=[{opaque:'old evidence'}]
const protectedRows=JSON.stringify([data.compatibilities,data.generalCompatibilityClaims,data.benefitSalesLists,data.families,data.skus]),disk=new Map<string,string>()
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>disk.get(k)??null,setItem:(k:string,v:string)=>disk.set(k,v),removeItem:(k:string)=>disk.delete(k)}});disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data}));setActivePinia(createPinia());const store=useCatalogStore();await store.waitForPersistence()
assert.equal(typeof (store as any).saveCompatibilityWorkspace,'undefined');assert.equal(typeof (store as any).installCompatibilityExamples,'undefined');assert(!store.canRoute({path:'/compatibility'}));assert(!permissionRegistry().some(p=>p.resource==='compatibility'))
const oldMenu={id:'page:/compatibility',kind:'page' as const,title:'旧兼容性',route:'/compatibility',parentId:'product',sort:99,hidden:false,roles:['admin' as const]};assert(!sanitizeMenu([...defaultMenuNodes(),oldMenu]).some(p=>p.route==='/compatibility'))
const query=saleQuery(store.data,scope);assert(query.candidates.some(c=>c.id==='huawei-sku-case-1'));assert(!('compatibility'in query))
const result=await store.saveBundleSale({id:'',scope,lines:[{skuId:'huawei-sku-case-1',quantity:1,unitPriceCents:99}],status:'confirmed'},0);assert(result.ok)
assert.equal(JSON.stringify([store.data.compatibilities,store.data.generalCompatibilityClaims,store.data.benefitSalesLists!.filter(r=>r.id==='historical'),store.data.families,store.data.skus]),protectedRows)
store.$dispose();console.log('PASS 兼容性页面/权限/保存命令移除、按分类范围选购、旧声明/确认依据/商品数据原样保留')
