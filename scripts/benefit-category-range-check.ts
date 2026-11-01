import assert from 'node:assert/strict'
import {createSeed} from '../src/domain/seed'
import {groupRangeTypes,rangeProblem,upgradeBenefitRanges} from '../src/domain/benefitSales/categoryRanges'
import {saleQuery,availableBenefitGroups} from '../src/domain/benefitSales/query'
import {writeGroup,writeSale} from '../src/domain/benefitSales/commands'
const data=createSeed(),group=data.benefitTypeGroups![0]!
assert.equal(group.id,'phone-category-range');assert(group.accessoryCategoryIds?.length)
assert(rangeProblem(data,group.categoryId,[group.categoryId]))
assert(!writeGroup(data,{id:'',name:'非法范围',categoryId:group.categoryId,accessoryCategoryIds:[group.categoryId],productTypeIds:[],enabled:true,sort:0},0,()=> 'invalid','now').ok)
for(const deviceId of ['demo18-sku-phone-1','huawei-sku-phone-1']){
 const scope={mode:'group' as const,categoryId:group.categoryId,groupId:group.id,productTypeIds:groupRangeTypes(data,group),device:{kind:'sku' as const,skuId:deviceId}}
 const q=saleQuery(data,scope);assert.equal(q.error,'');assert(q.candidates.some(c=>c.id===deviceId));assert(q.candidates.some(c=>c.id!==deviceId));assert(availableBenefitGroups(data,scope.device).some(g=>g.id===group.id))
 assert(!saleQuery(data,{...scope,groupId:undefined}).candidates.length)
 const sample=q.candidates.find(c=>c.id!==deviceId)!
 assert(writeSale(data,{id:'',scope,lines:[{skuId:sample.id,quantity:1,unitPriceCents:0}],status:'confirmed'},0,()=> 'sale-'+deviceId,'2026-11-01T00:00:00Z').ok)
}
const history=JSON.stringify(data.benefitSalesLists);delete data.benefitCategoryScopeVersion;data.benefitTypeGroups!.push({...group,id:'old-group',accessoryCategoryIds:undefined});upgradeBenefitRanges(data);assert.equal(JSON.stringify(data.benefitSalesLists),history);assert(!data.benefitTypeGroups!.some(g=>g.id==='old-group'));assert(!upgradeBenefitRanges(data))
const ids=groupRangeTypes(data,data.benefitTypeGroups![0]!);assert(['pt-phone','pt-case','pt-film','pt-leaf-c-charge'].every(id=>ids.includes(id)))
assert(!data.families.some(f=>f.name.includes('演示')))
console.log('PASS 范围配置、禁止主机关联主机、苹果与华为选购确认、无范围拒绝、旧配置移除与历史保留、迁移幂等')

const current=data.benefitTypeGroups![0]!,caseFamily=data.skus.find(s=>s.id==='demo18-sku-case-1')!.familyId
current.accessoryCategoryIds=['benefit-power']
data.publicSpuPool=[{spuId:caseFamily,enabled:true,revision:1,createdAt:'now',updatedAt:'now'}]
const narrow={mode:'group' as const,categoryId:current.categoryId,groupId:current.id,productTypeIds:groupRangeTypes(data,current),device:{kind:'sku' as const,skuId:'demo18-sku-phone-1'}}
assert(!saleQuery(data,narrow).candidates.some(c=>c.id==='demo18-sku-case-1'))
assert(!saleQuery(data,{...narrow,mode:'free',productTypeIds:[...narrow.productTypeIds,'pt-case']}).candidates.length)
assert(!writeSale(data,{id:'',scope:narrow,lines:[{skuId:'demo18-sku-case-1',quantity:1,unitPriceCents:99}],status:'draft'},0,()=> 'outside','now').ok)
console.log('PASS 公共池、自由组合和保存命令均不能绕过分类范围')

const beforeDuplicate=JSON.stringify(data.benefitTypeGroups)
const duplicateInput={...data.benefitTypeGroups![0]!,id:'',name:'另一个名称'}
assert(!writeGroup(data,duplicateInput,0,()=> 'duplicate','now').ok)
assert.equal(JSON.stringify(data.benefitTypeGroups),beforeDuplicate)
data.benefitTypeGroups![0]!.enabled=false
assert(!writeGroup(data,duplicateInput,0,()=> 'duplicate-disabled','now').ok)
const editable=data.benefitTypeGroups![0]!
assert(writeGroup(data,{...editable,name:'原范围修改'},editable.revision,()=> 'unused','now').ok)
console.log('PASS 同主机不同名称仍禁止新增、停用范围仍占用、拒绝不写入、原记录可正常编辑')
