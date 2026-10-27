import assert from 'node:assert/strict'
import {createSalesConfigurationFixture,salesTestItem} from './sales-configuration-fixtures'
import {newBenefitPackageDraft} from '../src/domain/benefitPackages'
import {salesCatalogSkus,salesSkuAdmission} from '../src/domain/salesCatalog'
import {addSalesCandidate,querySalesCandidates} from '../src/domain/salesSelection'
import {addSalesPreviewCandidate,previewSalesConfiguration,previewSalesConfigurationScope,SALES_DRAFT_PREVIEW_PREFIX} from '../src/domain/salesConfigurationPreview'

const {data,phonePlan,phoneBinding}=createSalesConfigurationFixture({styles:2,colors:1,packs:1})
const before=JSON.stringify(data),formal=querySalesCandidates(data,newBenefitPackageDraft(),'phone-a')
assert.equal(previewSalesConfigurationScope(data,phoneBinding).skuCount,2)
assert.equal(formal.sourceIssue,'');assert(formal.rows.some(row=>row.skuId==='case-sku'));assert(formal.excludedRows.some(row=>row.skuId==='off-sale-sku'&&/不在售/.test(row.reason)))
assert.equal(formal.rows.some(row=>row.skuId==='mat-only'),false)
const draft=structuredClone(phonePlan)
draft.name='本次未发布输入';draft.items=[salesTestItem('new-film','skus',['film-sku']),salesTestItem('service-choice','service')]
draft.items[1]!.required=true;draft.items[1]!.minKinds=1;draft.items[1]!.maxQuantity=1
const preview=previewSalesConfiguration(data,{planDraft:draft,bindings:[phoneBinding],sourceSkuId:'phone-a'})
assert(preview.canPreview,preview.issues.join('；'));assert.equal(preview.mode,'draft');assert.match(preview.versionLabel,/未发布/)
assert(preview.query.resolution.plan!.planId.startsWith(SALES_DRAFT_PREVIEW_PREFIX));assert(preview.query.rows.some(row=>row.skuId==='film-sku'));assert.equal(formal.rows.some(row=>row.skuId==='film-sku'),false)
assert.equal(preview.query.rows.some(row=>row.skuId==='case-sku'),false)
const service=preview.query.rows.find(row=>row.item.scope.kind==='service')!
const selected=addSalesPreviewCandidate(preview,service)
assert.throws(()=>addSalesCandidate(data,newBenefitPackageDraft(),service),/候选或来源方案已变化/)
const retained=previewSalesConfiguration(data,{planDraft:draft,bindings:[phoneBinding],sourceSkuId:'phone-a',selection:selected})
assert.equal(retained.selection.services.length,1);assert.throws(()=>addSalesPreviewCandidate(retained,retained.query.rows.find(row=>row.item.scope.kind==='service')!),/最多/)
assert.equal(previewSalesConfiguration(data,{planDraft:draft,bindings:[phoneBinding],sourceSkuId:'phone-a',deviceSkuId:'phone-a',selection:selected}).selection.services.length,0)
assert.equal(previewSalesConfiguration(data,{planDraft:draft,bindings:[phoneBinding],sourceSkuId:'phone-b',selection:selected}).selection.services.length,0)
assert.equal(previewSalesConfiguration(data,{bindings:[],sourceSkuId:'phone-a'}).mode,'effective')
assert.equal(JSON.stringify(data),before)
console.log('PASS shared preview: unpublished plan/binding input overlays only private data; formal result unchanged; real quantities enforced and changed device resets trial')

const caseCandidate=formal.rows.find(row=>row.skuId==='case-sku')!,family=data.families.find(item=>item.id==='family-case')!
const categoryId=family.categoryId;family.categoryId='missing-category'
const after=querySalesCandidates(data,newBenefitPackageDraft(),'phone-a')
assert.equal(salesSkuAdmission(data,'case-sku').allowed,false);assert.equal(salesCatalogSkus(data).some(sku=>sku.id==='case-sku'),false)
assert.equal(after.rows.some(row=>row.skuId==='case-sku'),false);assert(after.excludedRows.some(row=>row.skuId==='case-sku'&&/销售准入/.test(row.reason)))
assert.throws(()=>addSalesCandidate(data,newBenefitPackageDraft(),caseCandidate),/销售准入/)
family.categoryId=categoryId
data.skus.push({...structuredClone(data.skus.find(item=>item.id==='case-sku')!),id:'new-real-case',code:'NEW-REAL-CASE'})
assert(querySalesCandidates(data,newBenefitPackageDraft(),'phone-a').rows.some(row=>row.skuId==='new-real-case'))
console.log('PASS shared admission: shopping/preview/add agree on real SKU, sale state and exact catalog ownership; excluded diagnostics explain rejection; dynamic range includes new SKU')
