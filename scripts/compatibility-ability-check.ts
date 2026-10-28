import assert from 'node:assert/strict'
import {createCompatibilityAbilityFixture} from './compatibility-ability-fixtures'
import {accessoryUseEvaluation,queryDeviceAccessories,queryAccessoryDevices,reverseAccessoryUseEvaluation} from '../src/domain/accessoryCompatibilityQuery'
import {templateBusinessRole,templateHostChoices} from '../src/domain/templateHostCompatibility'
import {selectorForNode} from '../src/domain/templateCompatibility'
import {modelSpecificationContext} from '../src/domain/modelSourceContext'
const {data,modelId,versionId,matrixModelId,matrixVersionId}=createCompatibilityAbilityFixture(),before=JSON.stringify(data)
const forward=queryDeviceAccessories(data,'phone-a'),matches=[...forward.sales,...forward.materials,...forward.pending,...forward.excluded,...forward.unavailable]
for(const [id,basic,fast,conflict] of [['charger-sku','compatible','incompatible',true],['case-sku','compatible','incompatible',false],['film-sku','incompatible','compatible',false],['pending-sku','pending','pending',false]] as const){
  const match=matches.find(item=>item.target.id===id)!;assert(match)
  assert.equal(accessoryUseEvaluation(match).status,basic)
  assert.equal(accessoryUseEvaluation(match).conflict,id==='film-sku')
  assert.equal(accessoryUseEvaluation(match).fastCharge.status,fast)
  assert.equal(accessoryUseEvaluation(match).fastCharge.conflict,conflict)
  const reverse=queryAccessoryDevices(data,{kind:'sku',id}).hosts.find(item=>item.host.productModelId==='device:model-a')!
  assert.equal(reverseAccessoryUseEvaluation(reverse).status,basic)
  assert.equal(reverseAccessoryUseEvaluation(reverse).conflict,id==='film-sku')
  assert.equal(reverseAccessoryUseEvaluation(reverse,{requireFastCharge:true}).status,accessoryUseEvaluation(match,{requireFastCharge:true}).status)
}
console.log('PASS ability matrix basic versus fast charge agrees in forward reverse and sales evaluation')
const scoped=queryAccessoryDevices(data,{kind:'sku',id:'cable-sku'}).hosts.find(item=>item.host.productModelId===matrixModelId)!
assert.equal(reverseAccessoryUseEvaluation(scoped).status,'conditional');assert.equal(reverseAccessoryUseEvaluation(scoped).hasSpecDifferences,true)
assert.equal(accessoryUseEvaluation(scoped.devices.find(item=>item.skuId==='matrix-phone-0')).status,'compatible');assert.equal(accessoryUseEvaluation(scoped.devices.find(item=>item.skuId==='matrix-phone-1')).status,'incompatible')
const fastOnly=queryAccessoryDevices(data,{kind:'sku',id:'case-sku'}).hosts.find(item=>item.host.productModelId===matrixModelId)!
assert.equal(reverseAccessoryUseEvaluation(fastOnly).status,'compatible');assert.equal(reverseAccessoryUseEvaluation(fastOnly).hasSpecDifferences,false)
assert.equal(reverseAccessoryUseEvaluation(fastOnly,{requireFastCharge:true}).status,'pending')
console.log('PASS requested ability keeps actual PLN differences without broadening partial model coverage')
const all=templateHostChoices(data,{modelId,versionId}),scope=selectorForNode(modelSpecificationContext(data,modelId,versionId),'compat-style-1').selector
assert.equal(all.skuCount,4);assert.equal(new Set(all.choices.map(item=>item.groupKey)).size,2)
const chosen=templateHostChoices(data,{modelId,versionId,selector:scope})
assert.equal(chosen.choices.length,2);assert(chosen.choices.every(item=>item.device.host?.productModelId==='device:model-b'))
const withoutSkus=structuredClone(data);withoutSkus.skus=withoutSkus.skus.filter(item=>item.familyId!=='matrix-family')
const modeled=templateHostChoices(withoutSkus,{modelId:matrixModelId,versionId:matrixVersionId});assert.equal(modeled.skuCount,0);assert.equal(modeled.choices.length,2);assert(modeled.choices.every(item=>!item.skuId&&item.device.skuId===''))
assert(templateHostChoices(data,{modelId,versionId:'missing-version'}).issues.length)
assert.equal(JSON.stringify(data),before)
const historical=structuredClone(data);delete historical.productTypes.find(item=>item.id==='type-device')!.catalogRole;historical.categories.find(item=>item.id==='cat-device-test')!.name='主机'
assert.equal(templateBusinessRole(historical,modelId),'unknown');assert.equal(templateHostChoices(historical,{modelId,versionId}).choices.length,0)
console.log('PASS template direction uses explicit role exact version and range, reads actual SKU or proven combination, zero writes')
