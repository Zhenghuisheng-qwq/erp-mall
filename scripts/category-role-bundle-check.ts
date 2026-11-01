import assert from 'node:assert/strict'
import {bundleFixture} from './type-bundle-fixture'
import {roleOfType} from '../src/domain/compatibility'
import {groupTypesProblem,saleQuery,availableBenefitGroups} from '../src/domain/benefitSales/query'
import {writeGroup} from '../src/domain/benefitSales/commands'
const {data}=bundleFixture(),host=data.productTypes.find(t=>t.catalogRole==='host')!,accessory=data.productTypes.find(t=>t.catalogRole==='accessory')!
assert(host&&accessory)
const original=JSON.stringify(data.benefitSalesLists)
const device=data.skus.find(s=>saleQuery(data,{mode:'free',categoryId:host.categoryId,productTypeIds:[host.id],device:{kind:'sku',skuId:s.id}}).device?.status==='resolved')!
assert(device)
const scope={mode:'free' as const,categoryId:host.categoryId,productTypeIds:[accessory.id],device:{kind:'sku' as const,skuId:device.id}}
const before=saleQuery(data,scope).candidates.map(c=>c.id)
data.categories.push({id:'cross-accessory',name:'保护及增值业务',parentId:null,sort:99,enabled:true,catalogRole:'accessory'})
accessory.categoryId='cross-accessory';delete accessory.catalogRole
assert.equal(roleOfType(data,accessory.id),'accessory')
assert.equal(groupTypesProblem(data,host.categoryId,[host.id,accessory.id]),'')
assert.deepEqual(saleQuery(data,scope).candidates.map(c=>c.id),before)
const saved=writeGroup(data,{id:'',name:'跨分类权益包',categoryId:host.categoryId,productTypeIds:[host.id,accessory.id],enabled:true,sort:0},0,()=> 'cross-group',new Date().toISOString())
assert(saved.ok)
assert(availableBenefitGroups(data,scope.device).some(g=>g.id==='cross-group'))
assert(groupTypesProblem(data,'cross-accessory',[accessory.id]))
data.categories.find(c=>c.id==='cross-accessory')!.catalogRole='host'
assert(groupTypesProblem(data,host.categoryId,[accessory.id]))
assert.equal(JSON.stringify(data.benefitSalesLists),original)
console.log('PASS 跨分类权益包保存、设备入口发现、分类用途统一解析、原候选一致、跨主机拒绝及历史不变')

