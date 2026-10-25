import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
import {createPinia,setActivePinia} from 'pinia'
import {installCatalogTestLocks} from './catalog-storage-test-env'
import {createAccessoryCompatibilityFixture} from './accessory-compatibility-fixtures'
import {useCatalogStore,normalizeStored} from '../src/stores/catalog'
import {DATA_VERSION,STORAGE_KEY} from '../src/domain/types'
import {newBenefitPackageDraft,addBenefitSku,replaceBenefitSku,setBenefitIncludedPhone,reviewBenefitQuote,previewBenefitDelivery,parseBenefitAmount,cloneBenefit,validateBenefitPackage,confirmBenefitCondition,copyBenefitPackageDraft} from '../src/domain/benefitPackages'
import {applyBenefitFramework,resolveBenefitRange,frameworkSnapshot} from '../src/domain/benefitFrameworks'
import {benefitReferenceTotals} from '../src/domain/benefitPricing'
import {buildBenefitDeliveryWorkbook} from '../src/domain/benefitPackageExport'
import {deviceSourceStamp} from '../src/domain/deviceResolution'
import type {BenefitFramework,BenefitSelectionGroup,BenefitReferencePrice} from '../src/domain/benefitPackageTypes'
installCatalogTestLocks();const out=process.env.R03_REPAIR_OUTPUT||'work/r03-repair-20261025/domain';mkdirSync(out,{recursive:true});const checks:string[]=[],pass=(s:string)=>{checks.push(s);console.log('PASS R03 '+s)}
const f=createAccessoryCompatibilityFixture(),disk=new Map<string,string>();let fail=false
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>disk.get(k)??null,setItem:(k:string,v:string)=>{if(fail){fail=false;throw Error('quota')};disk.set(k,v)},removeItem:(k:string)=>disk.delete(k)}})
f.data.activeRole='admin';disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data:f.data}));setActivePinia(createPinia());const s=useCatalogStore();await s.waitForPersistence()
const group=(id:string,type:string):BenefitSelectionGroup=>({id,name:id,enabled:true,candidateSkuIds:[],scope:{kind:'product-types',productTypeIds:[type],compatibleOnly:true},required:true,minKinds:1,maxKinds:20,defaultQuantity:2,adjustable:true,minQuantity:1,maxQuantity:10})
const fw:BenefitFramework={id:'',name:'膜壳框架',status:'available',revision:0,groups:[group('壳组','type-case'),group('膜组','type-film')],createdAt:'',updatedAt:'',creationRequestId:'',creationIntent:'',history:[]}

fw.groups= [group('膜组','type-film')];fw.groups[0]!.scope!.compatibleOnly=false;fw.groups[0]!.adjustable=false
assert((await s.saveBenefitFramework({draft:fw,expectedRevision:0,requestId:'framework'})).ok)
const framework=cloneBenefit(s.data.benefitFrameworks![0]!)
let draft=applyBenefitFramework(newBenefitPackageDraft({kind:'sku',skuId:'phone-a'}),framework);draft.name='补修框架包'
draft=addBenefitSku(s.data,draft,'film-sku');draft.goods[0]!.referencePrice={amountCents:123,source:'manual',enteredAt:'2026-10-25T00:00:00Z'};draft.quote.amountCents=500;draft=reviewBenefitQuote(draft)
const saved=await s.saveBenefitPackage({draft,status:'available',requestId:'package'});assert(saved.ok,saved.message);assert(saved.package)
const preview=previewBenefitDelivery(s.data,saved.package,2);assert(preview.canConfirm)
const delivered=await s.generateBenefitDelivery({packageId:saved.id!,expectedRevision:saved.package.revision,packageCount:2,expectedBasis:preview.basis,requestId:'delivery'});assert(delivered.ok,delivered.message)
const backup=s.exportJson(),raw=disk.get(STORAGE_KEY),frozen=JSON.stringify(s.data.benefitDeliveries),book=JSON.stringify(buildBenefitDeliveryWorkbook(delivered.delivery!))
const reset=await s.resetModule('products');assert(!reset.ok);assert.match(reset.message!,/补修框架包/);assert.match(reset.message!,/film-sku/);assert.equal(s.exportJson(),backup);assert.equal(disk.get(STORAGE_KEY),raw)
pass('real Store product reset rejects framework reference loss; memory and persisted bytes unchanged')
writeFileSync(out+'/valid-backup.json',backup)
for(const missing of ['sku','family']){
 const broken=JSON.parse(backup),sku=broken.data.skus.find((x:any)=>x.id==='film-sku')
 if(missing==='sku')broken.data.skus=broken.data.skus.filter((x:any)=>x.id!=='film-sku');else broken.data.families=broken.data.families.filter((x:any)=>x.id!==sku.familyId)
 assert.doesNotThrow(()=>normalizeStored(cloneBenefit(broken)))
 await s.importJson(JSON.stringify(broken));assert.deepEqual(s.data.benefitPackages,broken.data.benefitPackages)
 const p=s.data.benefitPackages![0]!,v=validateBenefitPackage(s.data,p);assert(v.issues.some(i=>i.code==='sku-reference'));assert(!v.canSaveAvailable);assert(!previewBenefitDelivery(s.data,p,1).canConfirm)
 assert(!(await s.generateBenefitDelivery({packageId:p.id,expectedRevision:p.revision,packageCount:1,expectedBasis:previewBenefitDelivery(s.data,p,1).basis,requestId:'invalid-'+missing})).ok)
 assert(!(await s.saveBenefitPackage({draft:cloneBenefit(p),status:'available',expectedRevision:p.revision,requestId:'invalid-save-'+missing})).ok)
 assert.equal(JSON.stringify(s.data.benefitDeliveries),frozen);assert.equal(JSON.stringify(buildBenefitDeliveryWorkbook(s.data.benefitDeliveries![0]!)),book)
 if(missing==='sku')writeFileSync(out+'/dangling-backup.json',s.exportJson())
 // Reopen a real Store from the same disk, not just the normalizer.
 setActivePinia(createPinia());const reopened=useCatalogStore();await reopened.waitForPersistence();assert.equal(reopened.data.benefitPackages![0]!.goods[0]!.skuId,'film-sku');assert(validateBenefitPackage(reopened.data,reopened.data.benefitPackages![0]!).issues.some(i=>i.code==='sku-reference'));reopened.$dispose()
 await s.importJson(backup)
}
pass('missing SKU and missing family restore/reopen intact; actionable issue blocks available save/new delivery; frozen export unchanged')
const outside=JSON.parse(backup);outside.data.benefitPackages[0].goods[0]=addBenefitSku(s.data,newBenefitPackageDraft(),'case-sku').goods[0]
const before=s.exportJson(),diskBefore=disk.get(STORAGE_KEY);await assert.rejects(()=>s.importJson(JSON.stringify(outside)),/唯一框架类型组/);assert.equal(s.exportJson(),before);assert.equal(disk.get(STORAGE_KEY),diskBefore)
const material=JSON.parse(backup);material.data.benefitPackages[0].goods[0].skuId='mat-only';material.data.benefitPackages[0].goods[0].snapshot.skuId='mat-only';material.data.families=material.data.families.filter((x:any)=>x.id!==material.data.skus.find((x:any)=>x.id==='mat-only').familyId);await assert.rejects(()=>s.importJson(JSON.stringify(material)),/唯一框架类型组/);assert.equal(s.exportJson(),before);assert.equal(disk.get(STORAGE_KEY),diskBefore)
pass('existing out-of-group SKU import still refused atomically')
const range=resolveBenefitRange(s.data,saved.package);for(const id of ['film-sku','pending-sku','blocked-sku','copy-sku'])assert(range.candidates.some(x=>x.skuId===id));assert(range.recommendedSkuIds.has('film-sku'));for(const id of ['pending-sku','blocked-sku','copy-sku'])assert(!range.recommendedSkuIds.has(id))
const fast=cloneBenefit(s.data.skus.find(x=>x.id==='film-sku')!);fast.id='fast-only';fast.code='FAST-ONLY';s.data.skus.push(fast)
const decl=cloneBenefit(s.data.compatibilities.find(x=>x.id==='decl-film-a')!);assert(decl);s.data.compatibilities.push({...decl,id:'fast-only-decl',targetId:fast.id,accessorySkuId:fast.id,capability:'fast-charge'})
await s.waitForPersistence();assert(resolveBenefitRange(s.data,saved.package).candidates.some(x=>x.skuId===fast.id));assert(!resolveBenefitRange(s.data,saved.package).recommendedSkuIds.has(fast.id))
const fresh=cloneBenefit(fast);fresh.id='dynamic-film';s.data.skus.push(fresh);s.data.compatibilities.push({...decl,id:'dynamic-decl',targetId:fresh.id,accessorySkuId:fresh.id});await s.waitForPersistence();assert(resolveBenefitRange(s.data,saved.package).recommendedSkuIds.has(fresh.id))
writeFileSync(out+'/candidate-backup.json',s.exportJson())
pass('framework range retains pending/blocked/no-declaration; recommendations require basic proof; fast-only excluded; newly compatible SKU appears')
await s.importJson(backup)
const free=JSON.parse(backup);delete free.data.benefitPackages[0].framework;await s.importJson(JSON.stringify(free));assert((await s.resetModule('products')).ok);assert.doesNotThrow(()=>normalizeStored(JSON.parse(s.exportJson())));assert.equal(s.data.benefitPackages![0]!.goods[0]!.skuId,'film-sku');assert.equal(JSON.stringify(s.data.benefitDeliveries),frozen)
assert((await s.resetAll()).ok);assert.doesNotThrow(()=>normalizeStored(JSON.parse(s.exportJson())));pass('legacy free package product reset and full reset retain prior semantics')
s.$dispose();writeFileSync(out+'/checks.json',JSON.stringify({checks},null,2))
