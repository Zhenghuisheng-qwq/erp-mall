import assert from 'node:assert/strict'
import {createSeed} from '../src/domain/seed'
import {groupRangeTypes} from '../src/domain/benefitSales/categoryRanges'
import {bundleCandidates,lineKey} from '../src/domain/benefitSales/extraBundles'
import {writeSale,benefitStorageProblems,reviewLines} from '../src/domain/benefitSales/commands'
import type {ExtraBundle,SaleLine} from '../src/domain/benefitSales/types'
const data=createSeed(),g=data.benefitTypeGroups![0]!,scope={mode:'group' as const,categoryId:g.categoryId,groupId:g.id,productTypeIds:groupRangeTypes(data,g),device:{kind:'sku' as const,skuId:'demo18-sku-phone-1'}}
const bundle:ExtraBundle={id:'gift-huawei',hostSkuId:'huawei-sku-phone-1',withAccessories:true,kind:'gift'},candidates=bundleCandidates(data,scope,bundle)
assert(candidates.some(c=>c.id==='huawei-sku-case-1'));assert(candidates.some(c=>c.id==='demo18-sku-case-1'));assert.equal(bundleCandidates(data,scope,{...bundle,withAccessories:false}).length,1)
const main:SaleLine={skuId:'demo18-sku-phone-1',quantity:1,unitPriceCents:10000},giftLines:SaleLine[]=['huawei-sku-phone-1','huawei-sku-case-1'].map(skuId=>({skuId,bundle,kind:'gift',quantity:1,unitPriceCents:0}))
assert(!writeSale(data,{id:'',scope,lines:[main,giftLines[1]!],status:'confirmed'},0,()=> 'orphan','now').ok)
assert(bundleCandidates(data,scope,{...bundle,withAccessories:false}).every(c=>c.id===bundle.hostSkuId))
const same:SaleLine={...main,kind:'gift',unitPriceCents:0,bundle:{id:'same-host',hostSkuId:main.skuId,withAccessories:false,kind:'gift'}}
const paid:SaleLine={skuId:'huawei-sku-phone-1',kind:'sale',quantity:1,unitPriceCents:20000,bundle:{id:'paid',hostSkuId:'huawei-sku-phone-1',withAccessories:false,kind:'sale'}}
assert(!writeSale(data,{id:'',scope,lines:[main,paid],status:'confirmed'},0,()=> 'paid-not-supported','now').ok);assert.notEqual(lineKey(main),lineKey(same));const result=writeSale(data,{id:'',scope,lines:[main,...giftLines,same],status:'confirmed'},0,()=> 'complete','2026-11-01T00:00:00Z');assert(result.ok);assert.equal(result.record.snapshot!.totalCents,10000);assert.deepEqual(benefitStorageProblems(data),[])
const snapshot=JSON.stringify(result.record.snapshot);data.skus.find(s=>s.id===bundle.hostSkuId)!.status='off_sale';assert(reviewLines(data,scope,giftLines).issues.length);assert.equal(JSON.stringify(result.record.snapshot),snapshot)
console.log('PASS 独立赠送主机及范围内配件、单主机模式、拒绝孤立及超范围配件、同规格购买与赠送并存、拒绝额外购买组合与历史保存')

data.skus.find(s=>s.id===bundle.hostSkuId)!.status='on_sale'
const bound={...bundle,parentGroupId:g.id,parentDeviceKey:'sku:demo18-sku-phone-1'}
assert(bundleCandidates(data,scope,bound).length>0)
assert(bundleCandidates(data,{...scope,device:{kind:'sku',skuId:'demo18-sku-phone-2'}},bound).length===0)
