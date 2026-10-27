import assert from 'node:assert/strict'
import { salesCatalogReady } from '../src/domain/salesCatalog'
import { createSeed } from '../src/domain/seed'

const data = createSeed()
const ready = data.families.filter(family => salesCatalogReady(data, family)).map(family => family.id).sort()
assert.deepEqual(ready, ['f-case', 'f-ebike', 'f-iphone'])
for (const id of ['f-mac', 'f-pad', 'f-watch', 'f-film']) assert.equal(salesCatalogReady(data, data.families.find(family => family.id === id)!), false)
const offered = new Set(data.skus.filter(sku => ready.includes(sku.familyId) && sku.status === 'on_sale').map(sku => sku.id))
assert.equal(offered.has('s-mac-1'), false)
assert.equal(offered.has('s-case-orange'), true)
assert.equal(offered.has('s-case-clear'), true)
assert.equal(offered.has('s-iphone-blue'), true)
console.log('PASS sales catalog only offers families with category, product type and model')
