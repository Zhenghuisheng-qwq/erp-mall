import assert from 'node:assert/strict'
import {createSalesConfigurationFixture,salesTestItem} from './sales-configuration-fixtures'
import {newBenefitPackageDraft} from '../src/domain/benefitPackages'
import {salesCatalogSkus,salesSkuAdmission} from '../src/domain/salesCatalog'
import {addSalesCandidate,querySalesCandidates} from '../src/domain/salesSelection'
import {addSalesPreviewCandidate,previewSalesConfiguration,previewSalesConfigurationScope,resolveSalesConfigurationOperation,SALES_DRAFT_PREVIEW_PREFIX} from '../src/domain/salesConfigurationPreview'
import {commitSalesConfigurationCommand,salesConfigurationCommitBasis} from '../src/domain/salesConfigurationCommands'

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

const existing=createSalesConfigurationFixture(),catalog=existing.data,stored=catalog.salesOptionPlans!.find(item=>item.id===existing.phonePlan.id)!
stored.versions.push({...structuredClone(stored.versions[0]!),version:2,items:[...structuredClone(stored.items),salesTestItem('version-two-service','service')]})
stored.publishedVersion=2;stored.revision=2
const working=structuredClone(stored);working.items.push(salesTestItem('unpublished-extra-service','service'))
const operationInput={planDraft:working,bindings:[existing.phoneBinding],sourceSkuId:'phone-a'}
const operationBefore=JSON.stringify(catalog),inputBefore=JSON.stringify(working)
const frozenPreview=previewSalesConfiguration(catalog,{...operationInput,operation:{action:'apply-existing',existingVersion:1}})
assert(frozenPreview.canPreview,frozenPreview.issues.join('；'))
assert.equal(frozenPreview.query.resolution.plan?.planId,stored.id);assert.equal(frozenPreview.query.resolution.plan?.version,1)
assert.equal(frozenPreview.query.rows.some(item=>['unpublished-extra-service','version-two-service'].includes(item.item.id)),false)
const resolved=resolveSalesConfigurationOperation(catalog,{...operationInput,action:'apply-existing',existingVersion:1})
assert.equal(resolved.afterItems.some(item=>item.id==='unpublished-extra-service'),false)
assert(resolved.bindings.every(item=>item.planVersion===1));assert.match(resolved.overlay.versionLabel,/冻结版本 v1/)
const draftPreview=previewSalesConfiguration(catalog,{...operationInput,operation:{action:'publish-apply'}})
assert(draftPreview.query.rows.some(item=>item.item.id==='unpublished-extra-service'))
const onlyPublish=previewSalesConfiguration(catalog,{...operationInput,operation:{action:'publish-only'}})
assert.equal(onlyPublish.query.rows.some(item=>item.item.id==='unpublished-extra-service'),false)
assert.match(onlyPublish.versionLabel,/继续使用原版本/)
const invalidVersion=previewSalesConfiguration(catalog,{...operationInput,operation:{action:'apply-existing',existingVersion:99}})
assert.equal(invalidVersion.canPreview,false);assert(invalidVersion.issues.some(message=>/发布版本不存在/.test(message)))
const closed=previewSalesConfiguration(catalog,{planDraft:working,bindings:[{...existing.phoneBinding,scope:{kind:'products',familyIds:[],skuIds:['phone-a']},mode:'none'}],sourceSkuId:'phone-a',operation:{action:'disable-range'}})
assert.equal(closed.query.rows.length,0);assert.equal(closed.query.resolution.state,'none')
assert.equal(JSON.stringify(catalog),operationBefore);assert.equal(JSON.stringify(working),inputBefore)
const candidate=structuredClone(catalog)
const applied=commitSalesConfigurationCommand(candidate,{planDraft:working,expectedPlanRevision:stored.revision,bindings:resolved.bindings,expectedRevisions:{[existing.phoneBinding.id]:existing.phoneBinding.revision},expectedBasis:salesConfigurationCommitBasis(candidate),action:'apply-existing',existingVersion:resolved.version,requestId:'specified-v1-check'},()=>{throw Error('Existing-version apply must not allocate a new record')},existing.now)
assert(applied.ok,applied.message);assert.equal(candidate.salesOptionPlans!.find(item=>item.id===stored.id)!.versions.length,2)
const summarize=(rows:typeof frozenPreview.query.rows)=>rows.map(row=>[row.item.id,row.skuId||'service',row.status,row.canAdd]).sort()
assert.deepEqual(summarize(querySalesCandidates(candidate,newBenefitPackageDraft(),'phone-a').rows),summarize(frozenPreview.query.rows))
assert.equal(JSON.stringify(working),inputBefore)
console.log('PASS operation preview: exact frozen V1 excludes unpublished/V2 services; publish-only retains actual results; close-range and submitted existing-version results match readonly preview')
