import assert from 'node:assert/strict'
import {createSalesConfigurationFixture} from './sales-configuration-fixtures'
import {queryProductBenefitRelations} from '../src/domain/productBenefitRelations'
import {newBenefitPackageDraft,addBenefitSku} from '../src/domain/benefitPackages'
const {data,phoneIds,phonePlan,phoneBinding}=createSalesConfigurationFixture()
const original=JSON.stringify(data),phone=queryProductBenefitRelations(data,phoneIds[0]!)
assert.equal(phone.effective?.state,'matched');assert.equal(phone.effective?.plan?.version,1);assert.deepEqual(phone.effectiveRanges.map(row=>row.id),[phoneBinding.id])
const caseResult=queryProductBenefitRelations(data,'case-sku')
assert(caseResult.candidates.some(row=>row.planId===phonePlan.id&&row.version===1&&row.itemId==='case-choice'))
assert.equal(queryProductBenefitRelations(data,'mat-only').valid,false)
assert.equal(JSON.stringify(data),original)

// Dynamic type membership is keyed by type ID; same names never expand the wrong scope.
const type=data.productTypes.find(row=>row.id==='type-case')!
data.productTypes.push({...type,id:'unrelated-same-name'})
const second={...structuredClone(phonePlan.items[0]!),id:'other-id-item',scope:{kind:'product-types' as const,ids:['unrelated-same-name']}}
data.salesOptionPlans!.find(row=>row.id===phonePlan.id)!.items.push(second)
assert.equal(queryProductBenefitRelations(data,'case-sku').candidates.some(row=>row.itemId===second.id),false)
const frozenCase=queryProductBenefitRelations(data,'case-sku').candidates.find(row=>row.planId===phonePlan.id&&row.version===1)!
assert.equal(frozenCase.state,'published')

let pack=newBenefitPackageDraft({kind:'sku',skuId:phoneIds[0]!})
pack=addBenefitSku(data,pack,'case-sku',2)
Object.assign(pack,{id:'member-package',code:'BPK-TEST',name:'已包含的真实成员',status:'available',revision:1,favorite:true})
data.benefitPackages=[pack,{...structuredClone(pack),id:'disabled-package',status:'disabled'},{...structuredClone(pack),id:'unknown-package',compositionVersion:99}]
const before=JSON.stringify(data),members=queryProductBenefitRelations(data,'case-sku')
assert.equal(members.packages.find(row=>row.id===pack.id)?.quantity,2)
assert.equal(members.packages.find(row=>row.id==='disabled-package')?.usable,false)
assert.equal(members.packages.find(row=>row.id==='unknown-package')?.supported,false)
assert.equal(queryProductBenefitRelations(data,'film-sku').packages.length,0)
assert.equal(JSON.stringify(data),before)

// Resolver conflict state and complete binding hit IDs are retained, without picking one result.
data.salesOptionBindings!.push({...structuredClone(phoneBinding),id:'conflicting-result',planId:'sales-plan-case'})
const conflict=queryProductBenefitRelations(data,phoneIds[0]!)
assert.equal(conflict.effective?.state,'conflict');assert.equal(conflict.effective?.plan,undefined);assert.equal(conflict.effectiveRanges.length,2)
const denied=queryProductBenefitRelations(data,'case-sku',code=>code==='product:sku:read')
assert.equal(denied.configurationsReadable,false);assert.equal(denied.packagesReadable,false);assert.equal(denied.effective,undefined);assert.deepEqual(denied.candidates,[]);assert.deepEqual(denied.packages,[])
assert.equal(queryProductBenefitRelations(data,'case-sku',()=>false).valid,false)
console.log('PASS product benefit relations: exact frozen resolution/conflicts, dynamic type IDs, real saved members/quantity/unknown states, read isolation and zero writes')
