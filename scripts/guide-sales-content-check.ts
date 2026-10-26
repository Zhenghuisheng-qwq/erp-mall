import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {salesManuals} from '../src/domain/guide/content/manuals-sales'
import {guideArticles,guidePages} from '../src/domain/guide/registry'
import {createSeed} from '../src/domain/seed'
import {spuRemovalBlock,saveSpu} from '../src/domain/spuSku'
import {newSpuDraft} from '../src/domain/spuDraft'
import {familyBrandValues} from '../src/domain/productList'
import {projectAttrs} from '../src/domain/logic'
import {familyMaterialDigest} from '../src/domain/material'
import {parseBenefitAmount} from '../src/domain/benefitPackages'
import {benefitReferenceTotals} from '../src/domain/benefitPricing'
import {createBenefitPackageFixture} from './benefit-package-fixtures'
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value));let groups=0
const expected=['page-spus','page-spu-create','page-spu-edit','page-skus','page-sku-create','page-sku-edit','page-material-create','page-material-edit','page-compatibility','page-benefits','page-benefit-create','page-benefit-edit','page-benefit-delivery','page-columns-spu','page-columns-sku']
assert.deepEqual(Object.keys(salesManuals).sort(),expected.sort())
const articles=new Set(guideArticles.map(a=>a.id)),pages=new Set(guidePages.map(p=>p.id)),ids=new Set<string>()
for(const [pageId,manual]of Object.entries(salesManuals)){assert(pages.has(pageId));assert(manual.purpose.trim());assert(manual.features.length);for(const row of manual.features){assert(!ids.has(row.id));ids.add(row.id);for(const text of [row.title,row.description,row.operation,row.result])assert(text.trim(),row.id);for(const action of row.actionIds||[])assert(articles.has(action),action)}for(const row of manual.restrictions){assert(row.condition.trim()&&row.effect.trim()&&row.resolution.trim());for(const rule of row.ruleIds||[])assert(articles.has(rule),rule)}}groups++
const spu=salesManuals['page-spus']!,features=new Map(spu.features.map(f=>[f.id,f]))
for(const id of ['create','edit','append-sku','expand-skus','sku-range','query','brand-sources','clear-filters','switch-view','layout','view-management','manual-order','batch-shelf','batch-delete','delete','copy','materials','compatibility','child-edit','child-copy'])assert(features.has('spus-'+id),id)
assert(features.get('spus-create')!.operation.includes('新建 SPU'));assert(features.get('spus-edit')!.operation.includes('详情'));assert(features.get('spus-expand-skus')!.result.includes('MAT'));assert(features.get('spus-sku-range')!.result.includes('临时范围'));assert(features.get('spus-copy')!.operation.includes('非 V3'));assert(features.get('spus-copy')!.result.includes('不支持整款复制'));assert(features.get('spus-delete')!.result.includes('空草稿无需先经历下架'));assert(features.get('spus-layout')!.result.includes('当前 SPU 视图配置自动'));assert(features.get('spus-manual-order')!.result.includes('同一最末级组内调整'));assert(features.get('spus-manual-order')!.result.includes('跨组整批拒绝'));assert(features.get('spus-materials')!.result.includes('不证明'));groups++
const data=createSeed(),sampleSku=clone(data.skus[0]!),family={...clone(data.families[0]!),id:'manual-sales-empty',name:'内容校验主体',line:'v2' as const,templateId:'',productTypeId:undefined,productModelId:undefined,modelVersionId:undefined,productPlanId:undefined,commonSignature:undefined,commonAttrs:{品牌:'主体品牌'},shelfStatus:'draft' as const}
data.families=[family];data.skus=[];data.compatibilities=[];data.deviceBindings=[];data.materialRelations=[]
assert.equal(spuRemovalBlock(data,family.id),'');family.shelfStatus='offline' as any;assert.equal(spuRemovalBlock(data,family.id),'')
data.skus=[{...sampleSku,id:'manual-sales-sku',familyId:family.id,recordKind:'sku',materialCode:undefined,variantAttrs:{品牌:'规格品牌'}}]
assert.match(spuRemovalBlock(data,family.id),/1 条 SKU/);data.skus[0]!.recordKind='material';data.skus[0]!.materialCode='MAT-MANUAL';assert.match(spuRemovalBlock(data,family.id),/1 条物料/)
const locked=JSON.stringify(data),changed={...clone(family),commonAttrs:{品牌:'另一品牌'}};assert.equal(saveSpu(data,changed,'2026-10-26T00:00:00Z').ok,false);assert.equal(JSON.stringify(data),locked)
const source=readFileSync('src/views/ProductListView.vue','utf8'),single=source.slice(source.indexOf('async function removeFamily'),source.indexOf('function onFamilySelect')),batch=source.slice(source.indexOf('async function removeMany'),source.indexOf('async function removeSku('));assert(single.includes("shelfOf(family) === 'online'"));assert(batch.includes("shelfOf(family) === 'online'"));groups++
const copyBefore=JSON.stringify(data),copy=newSpuDraft(data,{fromId:family.id});assert.equal(copy.id,'');assert.equal(copy.shelfStatus,'draft');assert.equal(copy.name,family.name+' 副本');assert.equal(copy.oaProductId,'');assert.deepEqual(copy.productGroupIds,[]);assert.equal(JSON.stringify(data),copyBefore);groups++
data.skus[0]!.recordKind='sku';delete data.skus[0]!.materialCode
assert.deepEqual(familyBrandValues(data,family),['主体品牌']);assert.equal(projectAttrs(family,data.skus[0]!)['品牌'],'规格品牌');assert(features.get('spus-brand-sources')!.result.includes('已发布物料来源汇总'));groups++
const ambiguous=[{id:'mat-a',planningId:'PLN-A'},{id:'mat-b'},{id:'mat-a',planningId:'PLN-A'}];assert.match(familyMaterialDigest(ambiguous),/已建物料 2 条.*已关联规划 1 条/);assert.equal(ambiguous[1]!.planningId,undefined);assert(spu.restrictions.find(r=>r.id==='spus-counts')!.effect.includes('不能仅凭汇总'));groups++
assert.equal(parseBenefitAmount(''),null);assert.equal(parseBenefitAmount('0'),0)
const draft=clone(createBenefitPackageFixture().draft);draft.goods=[{...draft.goods[0]!,quantity:2,referencePrice:{amountCents:1000,source:'manual',enteredAt:'2026-10-26T00:00:00Z'}}];draft.services=[];draft.quote.amountCents=2500
const totals=benefitReferenceTotals(draft);assert.equal(totals.totalKnownCents,2000);assert.equal(totals.differenceCents,-500);assert.equal(draft.quote.amountCents,2500)
assert(salesManuals['page-benefit-create']!.details![0]!.sections[0]!.paragraphs!.some(p=>p.includes('25 元')&&p.includes('-5 元')));groups++
assert(salesManuals['page-skus']!.features.find(f=>f.id==='skus-filter')!.result.includes('搜索词不保存到视图'));assert(salesManuals['page-columns-sku']!.features.find(f=>f.id==='columns-sku-save')!.result.includes('已命名视图配置'));assert(salesManuals['page-material-create']!.features.find(f=>f.id==='material-create-temporary')!.operation.includes('手工指定全局唯一'));assert(salesManuals['page-material-edit']!.features.find(f=>f.id==='material-edit-naming')!.result.includes('建档发布版本'));groups++
console.log(`PASS sales explanations: ${groups} content/domain groups; 15 pages and all SPU capability rows`)
