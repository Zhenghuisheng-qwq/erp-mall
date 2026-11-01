import assert from 'node:assert/strict'
import {createSeed} from '../src/domain/seed'
import {upgradePhoneBranches,categoryWithin,categoryGoodsCondition} from '../src/domain/benefitSales/phoneBranches'
import {familyProductTypeId} from '../src/domain/productIdentity'
const data=createSeed(),phone=data.categories.find(c=>c.id==='c-phone')!,fresh=data.categories.find(c=>c.parentId===phone.id&&c.goodsCondition==='new')!,used=data.categories.find(c=>c.parentId===phone.id&&c.goodsCondition==='used')!
assert(fresh&&used)
const phoneType=data.productTypes.find(t=>t.id==='pt-phone')!
assert.equal(phoneType.categoryId,fresh.id)
assert(data.families.filter(f=>familyProductTypeId(data,f.id)===phoneType.id).every(f=>f.categoryId===fresh.id))
assert(!data.productTypes.some(t=>t.categoryId===used.id));assert(!data.families.some(f=>f.categoryId===used.id))
assert(categoryWithin(data,fresh.id,phone.id));assert.equal(categoryGoodsCondition(data,used.id),'used')
const before=JSON.stringify(data);assert(!upgradePhoneBranches(data));assert.equal(JSON.stringify(data),before)
const protectedRows=JSON.stringify([data.skus,data.specModelVersions,data.benefitSalesLists,data.usedGoods])
// Reconstruct the previous flat phone layout to verify the one-time upgrade.
data.categories=data.categories.filter(c=>![fresh.id,used.id].includes(c.id));delete data.phoneCategoryBranchesVersion
phoneType.categoryId=phone.id;for(const f of data.families)if(f.categoryId===fresh.id)f.categoryId=phone.id
assert(upgradePhoneBranches(data));assert.equal(phoneType.categoryId,fresh.id)
assert.equal(JSON.stringify([data.skus,data.specModelVersions,data.benefitSalesLists,data.usedGoods]),protectedRows)
console.log('PASS 手机新机/二手机分类、新机商品归属、二手机留空、迁移幂等和规格/历史/二手数据保护')
