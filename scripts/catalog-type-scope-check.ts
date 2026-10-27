import assert from 'node:assert/strict'
import {buildCatalogWorkspaceIndex,type CatalogMetricKind} from '../src/domain/catalogWorkspaceQuery'
import {catalogScopeNodes,filterCatalogScopeNodes} from '../src/domain/catalogScopeTree'
import {createCatalogWorkspaceFixture,catalogType,catalogModel} from './catalog-workspace-fixtures'
const data=createCatalogWorkspaceFixture()
data.productTypes.push(catalogType('leaf','leaf','手机'),catalogType('type-second','leaf','同名类型'),{...catalogType('disabled-empty','leaf'),status:'disabled'})
data.specCanvases.push(catalogModel('second-model','type-second'),catalogModel('same-id-model','leaf'))
const before=JSON.stringify(data),index=buildCatalogWorkspaceIndex(data)
for(const [id,model] of [['type-phone','model-phone'],['type-second','second-model'],['leaf','same-id-model']]){
  const scope=index.scope({categoryId:'leaf',scopeTypeId:id})
  assert(scope.valid);assert.deepEqual(scope.metrics.models.ids,[model])
  assert.deepEqual(scope.metrics,index.typeMetrics(id!))
  for(const kind of ['types','models','spus','skus','materials','pending'] as CatalogMetricKind[]){
    assert.deepEqual(index.details(kind,scope.metrics[kind].ids).map(row=>row.id).sort(),[...scope.metrics[kind].ids].sort())
    assert.equal(new Set(scope.metrics[kind].ids).size,scope.metrics[kind].count)
  }
}
assert(index.scope({categoryId:'root'}).metrics.skus.ids.includes('sku-child'))
assert(!index.scope({categoryId:'root',includeDescendants:false}).metrics.skus.ids.includes('sku-child'))
const phone=index.scope({scopeTypeId:'type-phone'}).metrics,accessory=index.scope({scopeTypeId:'type-case'}).metrics
assert(phone.materials.ids.includes('mat-one'));assert(!phone.skus.ids.includes('mat-one'))
assert(accessory.skus.ids.includes('sku-mixed'));assert(!accessory.materials.ids.includes('mat-mixed'),'unproven historical type must not inherit Family type')
for(const input of [{scopeTypeId:'gone'},{scopeTypeId:'type-multi'},{scopeTypeId:'type-orphan'},{scopeTypeId:'type-phone',categoryId:'case'}])assert.equal(index.scope(input).valid,false)
const nodes=catalogScopeNodes(index.categories,index.typeRows)
assert.equal(new Set(nodes.map(row=>row.key)).size,nodes.length)
assert(nodes.some(row=>row.key==='category:leaf'));assert(nodes.some(row=>row.key==='type:leaf'))
assert(nodes.some(row=>row.key==='type:disabled-empty'&&row.disabled))
assert(!nodes.some(row=>row.id==='type-multi'||row.id==='type-orphan'))
assert(index.unassigned.types.ids.includes('type-multi'))
const byType=filterCatalogScopeNodes(nodes,'type-second')
assert.deepEqual(byType.map(row=>row.key).sort(),['category:root','category:phone','category:leaf','type:type-second'].sort())
const byCategory=filterCatalogScopeNodes(nodes,'leaf')
assert(byCategory.some(row=>row.id==='type-second'));assert(byCategory.some(row=>row.id==='type-phone'))
assert.equal(filterCatalogScopeNodes(nodes,'同名类型').filter(row=>row.kind==='product-type').length,3)
const hidden=buildCatalogWorkspaceIndex(data,code=>code!=='product:type:read')
assert(!hidden.scope({scopeTypeId:'type-phone'}).valid)
assert(!catalogScopeNodes(hidden.categories,hidden.typeRows).some(row=>row.kind==='product-type'))
const noCategories=buildCatalogWorkspaceIndex(data,code=>code!=='product:category:read')
assert(noCategories.scope({scopeTypeId:'type-phone'}).valid)
assert.deepEqual(noCategories.scope({scopeTypeId:'type-phone'}).categoryIds,[])
assert.equal(catalogScopeNodes(noCategories.categories,noCategories.typeRows).length,0)
assert.equal(JSON.stringify(data),before)
console.log('PASS mixed tree identities/search/permissions, exact type metrics/details, category descendants, historical SKU/MAT provenance, invalid scopes and zero writes')
