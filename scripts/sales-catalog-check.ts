import assert from 'node:assert/strict'
import { resolveDeviceSku } from '../src/domain/deviceResolution'
import { salesCatalogReady } from '../src/domain/salesCatalog'
import { createSeed } from '../src/domain/seed'

const data = createSeed()
const ready = data.families.filter(family => salesCatalogReady(data, family)).map(family => family.id).sort()
assert.deepEqual(ready, ['f-case', 'f-ebike', 'f-iphone'])
for (const id of ['f-mac', 'f-pad', 'f-watch', 'f-film']) assert.equal(salesCatalogReady(data, data.families.find(family => family.id === id)!), false)
const offered = new Set(data.skus.filter(sku => ready.includes(sku.familyId) && sku.status === 'on_sale').map(sku => sku.id))
assert.equal(offered.has('s-mac-1'), false)
assert.equal(offered.has('s-case-orange'), true)
assert.equal(offered.has('s-iphone-blue'), true)
const v1 = data.specModelVersions.find(item => item.id === 'phone-model-v1')
assert.equal(v1?.nodesSnapshot.some(item => item.id === 'sn-apple-series-iphone' && item.valueId === 'iPhone'), true)
assert.equal(v1?.nodesSnapshot.some(item => item.valueId === '蓝色'), false)
for (const id of ['s-iphone-blue', 's-iphone-white']) {
  const result = resolveDeviceSku(data, id)
  assert.equal(result.status, 'resolved', `${id} ${result.message}`)
}
console.log('PASS sales catalog only offers families with category, product type and model')
