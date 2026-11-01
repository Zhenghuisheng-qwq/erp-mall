import assert from 'node:assert/strict'
import {createSeed} from '../src/domain/seed'
import {groupRangeTypes} from '../src/domain/benefitSales/categoryRanges'
import {giftQuery} from '../src/domain/benefitSales/gifts'
import {saleQuery} from '../src/domain/benefitSales/query'
import {writeSale,benefitStorageProblems} from '../src/domain/benefitSales/commands'
const data=createSeed(),g=data.benefitTypeGroups![0]!,scope={mode:'group' as const,categoryId:g.categoryId,groupId:g.id,productTypeIds:groupRangeTypes(data,g),device:{kind:'sku' as const,skuId:'demo18-sku-phone-1'},purchaseMode:'host_only' as const}
assert(!saleQuery(data,scope).candidates.some(c=>c.id==='demo18-sku-case-1'))
assert(giftQuery(data,scope).candidates.some(c=>c.id==='demo18-sku-case-1'))
assert(giftQuery(data,scope).candidates.some(c=>c.id==='huawei-sku-phone-1'))
assert(giftQuery(data,scope).candidates.some(c=>c.id==='huawei-sku-case-1'))
const lines=[{skuId:'demo18-sku-phone-1',quantity:1,unitPriceCents:999900},{skuId:'huawei-sku-phone-1',kind:'gift' as const,quantity:1,unitPriceCents:0}]
const input={id:'',scope,lines,status:'confirmed' as const}
assert(!writeSale(data,{...input,lines:[{...lines[1]!,unitPriceCents:100}]},0,()=> 'bad','now').ok)
assert(!writeSale(data,{...input,lines:[lines[1]!] },0,()=> 'gift-only','now').ok)
assert(!writeSale(data,{...input,lines:[lines[0]!,{skuId:'demo18-sku-case-1',quantity:1,unitPriceCents:0}]},0,()=> 'outside','now').ok)
const saved=writeSale(data,input,0,()=> 'gift-sale','2026-11-01T00:00:00Z');assert(saved.ok);assert.equal(saved.record.snapshot!.totalCents,999900);assert.equal(saved.record.snapshot!.lines[1]!.kind,'gift');assert.deepEqual(benefitStorageProblems(data),[])
const snapshot=JSON.stringify(saved.record.snapshot);data.skus.find(s=>s.id==='huawei-sku-phone-1')!.status='off_sale';assert(!giftQuery(data,scope).candidates.some(c=>c.id==='huawei-sku-phone-1'));assert.equal(JSON.stringify(saved.record.snapshot),snapshot)
console.log('PASS 单主机模式、跨范围主机赠品、已移除配件兼容判断、赠品强制0元、禁止纯赠品清单、历史快照与存储校验')
