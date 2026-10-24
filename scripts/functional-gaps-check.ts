import assert from 'node:assert/strict'
import { functionalGapsFixture } from './functional-gaps-fixture'
import { conditionEntries, repairQuickFilters, setQuickFilter } from '../src/domain/skuQuickFilters'
import { cloneSku, repairSkuConfig, skuConfigStamp, createSkuSavedView, configFromLegacy, defaultSkuConfig, ensureSkuWorkbench } from '../src/domain/skuWorkbenchState'
import { querySkuWorkbench, validateSkuConfig } from '../src/domain/skuWorkbenchQuery'
import { legalComboMaterialStatus } from '../src/domain/comboMaterialStatus'
import { featureSheet, featurePageKey } from '../src/domain/pageFeatures'
const {data,config,modelId,versionId,record}=functionalGapsFixture()
const ids=(c= config,scopeId='')=>querySkuWorkbench(data,c,{scopeId}).allIds
assert.deepEqual(ids(),['gaps-a','gaps-b'])
const before=JSON.stringify(config.conditions), baseline=ids()
setQuickFilter(config,{source:'condition',ruleId:'qa'},false)
assert.deepEqual(ids(),baseline);assert.equal(JSON.stringify(config.conditions),before)
setQuickFilter(config,{source:'condition',ruleId:'qa'},true);setQuickFilter(config,{source:'condition',ruleId:'qa'},true)
assert.equal(config.quickFilters!.length,2);assert.deepEqual(ids(),baseline)
config.quickFilters!.reverse();assert.deepEqual(ids(),baseline)
assert.notEqual(skuConfigStamp({...config,quickFilters:[]}),skuConfigStamp(config))
const copied=configFromLegacy(createSkuSavedView('copy','副本',config),data)
conditionEntries(copied.conditions)[0]!.rule.value='销售'
assert.deepEqual(ids(copied),['gaps-b','gaps-sale']);assert.deepEqual(ids(),baseline)
assert.deepEqual(ids(config,'absent'),[])
const removed=cloneSku(config);removed.conditions.children=[];assert.deepEqual(repairQuickFilters(removed),[])
const legacy=defaultSkuConfig();delete legacy.quickFilters
legacy.legacy={keyword:'',filters:[{id:'old-a',field:'created',operator:'before',value:'2021-01-01'},{id:'old-b',field:'created',operator:'after',value:'2019-01-01'}],exposed:['created','status'],sorting:null,grouping:null}
const migrated=repairSkuConfig(legacy,data);assert.equal(migrated.quickFilters!.length,2)
assert.deepEqual(repairSkuConfig(migrated,data),migrated)
const missingIds=cloneSku(legacy);missingIds.legacy!.filters.forEach(item=>item.id='');const identified=repairSkuConfig(missingIds,data);assert.equal(new Set(identified.legacy!.filters.map(item=>item.id)).size,2);assert.deepEqual(repairSkuConfig(identified,data),identified)
assert(querySkuWorkbench(data,migrated).allIds.includes('gaps-a'),'legacy date must mean SPU date')
setQuickFilter(migrated,{source:'legacy',filterId:'old-a'},false)
assert.equal(repairSkuConfig(migrated,data).quickFilters!.length,1,'hidden legacy refs must not revive')
const invalid=cloneSku(config);conditionEntries(invalid.conditions)[0]!.rule.field='attr:removed'
assert(validateSkuConfig(data,invalid).length);assert.equal(repairSkuConfig(invalid,data).quickFilters!.length,2)
ensureSkuWorkbench(data);const stamp=JSON.stringify(data);ensureSkuWorkbench(data);assert.equal(JSON.stringify(data),stamp)
console.log('PASS quick refs: OR identity, ordering, hide, duplication, copy, invalid fields, scope, legacy date and idempotence')
const frozen=JSON.stringify(data), status=legalComboMaterialStatus(data,modelId,versionId)
assert.equal(status.rows.length,4);const first=status.rows.find(row=>row.planningLabel===record.planningId)!
assert.equal(first.materialCount,2);assert.equal(new Set(first.materials.map(card=>card.skuId)).size,2)
assert(first.materials.every(card=>card.skuName==='同名历史物料（实际保存）'));assert.equal(first.valueNodeIds.length,2)
assert(!first.materials.some(card=>card.skuId==='gaps-sale'));assert.equal(JSON.stringify(data),frozen)
const version=cloneSku(data.specModelVersions.find(item=>item.id===versionId)!)
version.id='gaps-v2';version.version=2;version.versionName='V2';data.specModelVersions.push(version);record.modelVersionIds.push(version.id)
const historical=legalComboMaterialStatus(data,modelId,version.id).rows.find(row=>row.planningLabel===record.planningId)!
assert.equal(historical.materialCount,0);assert.equal(historical.historicalMaterials.length,2);assert.equal(historical.filed,false)
const material=data.skus.find(sku=>sku.id===first.materials[0]!.skuId)!
material.modelVersionId='';assert(legalComboMaterialStatus(data,modelId,versionId).rows[0]!.materials.some(card=>card.anomaly.includes('没有记下')))
material.modelVersionId='foreign';assert(legalComboMaterialStatus(data,modelId,versionId).rows[0]!.anomalies.some(text=>text.includes('未关联')))
console.log('PASS materials: sibling product, two same-name MAT, sales exclusion, current/history/unversioned/foreign, readonly')
const large=functionalGapsFixture(2048), started=performance.now();const big=legalComboMaterialStatus(large.data,large.modelId,large.versionId)
assert.equal(big.rows.length,4096);console.log(`PASS large 4096 combinations: ${(performance.now()-started).toFixed(1)} ms`)
const paths=['/spus','/spus/new','/spus/abc','/skus','/skus/new','/skus/abc','/materials/new','/materials/abc','/benefit-packages','/benefit-packages/new','/benefit-packages/abc','/benefit-packages/deliveries/abc','/specs','/categories','/templates','/models','/products','/products/old','/feedback']
const featureIds=new Set<string>()
for(const path of paths){const sheet=featureSheet(path);assert(sheet && sheet.title!=='当前页面');for(const feature of sheet.features){assert(!featureIds.has(feature.id),`duplicate ${feature.id}`);featureIds.add(feature.id)}}
assert.equal(featurePageKey('/products/new'),'/spus/new');assert.equal(featurePageKey('/products/old'),'/products/edit');assert.equal(featurePageKey('/spus',{panel:'columns'}),'/products?panel=columns')
console.log('PASS help: actual dynamic routes, new/edit/delivery distinction, unique feature IDs, legacy routes')
