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
installCatalogTestLocks();const out=process.env.R03_OUTPUT||'work/r03-20261025/domain';mkdirSync(out,{recursive:true});const checks:string[]=[],pass=(s:string)=>{checks.push(s);console.log('PASS R03 '+s)}
const f=createAccessoryCompatibilityFixture(),disk=new Map<string,string>();let fail=false
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>disk.get(k)??null,setItem:(k:string,v:string)=>{if(fail){fail=false;throw Error('quota')};disk.set(k,v)},removeItem:(k:string)=>disk.delete(k)}})
f.data.activeRole='admin';disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data:f.data}));setActivePinia(createPinia());const s=useCatalogStore();await s.waitForPersistence()
const group=(id:string,type:string):BenefitSelectionGroup=>({id,name:id,enabled:true,candidateSkuIds:[],scope:{kind:'product-types',productTypeIds:[type],compatibleOnly:true},required:true,minKinds:1,maxKinds:20,defaultQuantity:2,adjustable:true,minQuantity:1,maxQuantity:10})
const fw:BenefitFramework={id:'',name:'膜壳框架',status:'available',revision:0,groups:[group('壳组','type-case'),group('膜组','type-film')],createdAt:'',updatedAt:'',creationRequestId:'',creationIntent:'',history:[]}
const identity=()=>JSON.stringify([s.data.families,s.data.skus,s.data.planningRecords,s.data.materialReceipts,s.data.productPlans]),beforeIdentity=identity()
const input={draft:fw,expectedRevision:0,requestId:'framework-create'},memory=s.exportJson(),raw=disk.get(STORAGE_KEY);fail=true;assert(!(await s.saveBenefitFramework(input)).ok);assert.equal(s.exportJson(),memory);assert.equal(disk.get(STORAGE_KEY),raw)
const saved=await s.saveBenefitFramework(input);assert(saved.ok,saved.message);assert((await s.saveBenefitFramework(input)).ok);assert.equal(s.data.benefitFrameworks!.length,1);assert.equal(identity(),beforeIdentity)
const framework=cloneBenefit(s.data.benefitFrameworks![0]!)
const empty=cloneBenefit(fw);empty.name='先于商品';empty.groups=[group('空类型组','type-empty')];s.data.productTypes.push({...s.data.productTypes[0]!,id:'type-empty',name:'无商品类型'});await s.waitForPersistence();assert((await s.saveBenefitFramework({draft:empty,expectedRevision:0,requestId:'empty'})).ok)
pass('zero-member frameworks and empty candidate types save; maxKinds independent of current inventory; atomic quota retry/idempotency; no catalogue generation')
let draft=applyBenefitFramework(newBenefitPackageDraft({kind:'sku',skuId:'phone-a'}),framework);draft.name='本次权益包'
const range=resolveBenefitRange(s.data,draft);assert(range.candidates.some(x=>x.skuId==='case-sku'));assert(range.candidates.some(x=>x.skuId==='film-sku'))
for(const id of ['pending-sku','blocked-sku','off-sale-sku','mat-only','copy-sku','charger-sku']){assert(!range.candidates.some(x=>x.skuId===id));assert.throws(()=>addBenefitSku(s.data,draft,id))}
const phone=cloneBenefit(s.data.skus.find(x=>x.id==='phone-a')!);phone.id='phone-a-256';phone.variantAttrs.容量='256G';phone.variantAttrs.颜色='白色';s.data.skus.push(phone);s.data.deviceBindings!.push({...cloneBenefit(s.data.deviceBindings![0]!),skuId:phone.id,sourceStamp:deviceSourceStamp(s.data,phone.id)});await s.waitForPersistence();assert(resolveBenefitRange(s.data,{...draft,device:{kind:'sku',skuId:phone.id}}).candidates.some(x=>x.skuId==='film-sku'))
const added=cloneBenefit(s.data.skus.find(x=>x.id==='case-sku')!);added.id='new-compatible';added.code='NEW-COMPATIBLE';s.data.skus.push(added);s.data.compatibilities.push({...cloneBenefit(s.data.compatibilities.find(l=>l.id==='decl-case-a')!),id:'new-decl',targetId:added.id,accessorySkuId:added.id});await s.waitForPersistence();assert(resolveBenefitRange(s.data,draft).candidates.some(x=>x.skuId===added.id));assert.deepEqual(s.data.benefitFrameworks![0],framework)
pass('same model different capacity/color hosts reuse framework; newly compatible sale SKU appears dynamically; MAT/off-sale/pending/excluded/no-sales-claim/outside types rejected')
draft=addBenefitSku(s.data,draft,'case-sku');draft=addBenefitSku(s.data,draft,'film-sku');assert.equal(draft.goods[0]!.quantity,2);assert.throws(()=>replaceBenefitSku(s.data,draft,draft.goods[0]!.id,'charger-sku'));draft=setBenefitIncludedPhone(s.data,draft,true);assert(validateBenefitPackage(s.data,draft).canSaveAvailable)
const overlap=cloneBenefit(fw);overlap.groups[1]!.scope!.productTypeIds=['type-case'];assert(!(await s.saveBenefitFramework({draft:overlap,requestId:'overlap',expectedRevision:0})).ok)
const bypass=cloneBenefit(draft);bypass.goods.push(addBenefitSku(s.data,newBenefitPackageDraft(),'charger-sku').goods[0]!);const beforeBad=s.exportJson();assert(!(await s.saveBenefitPackage({draft:bypass,status:'available',requestId:'bypass'})).ok);assert.equal(s.exportJson(),beforeBad)
pass('default quantities, explicit included host exemption, overlap rejection and direct Store outside-member validation share one range')
const price=(n:number|null):BenefitReferencePrice=>({amountCents:n,source:'manual',enteredAt:'2026-10-25T00:00:00Z'})
draft.goods[0]!.referencePrice=price(125);draft.goods[1]!.referencePrice=price(0)
let totals=benefitReferenceTotals(draft,3);assert.equal(totals.missingCount,1);assert.equal(totals.differenceCents,null)
draft.goods.find(x=>x.skuId==='phone-a')!.referencePrice=price(10000)
draft.services=[{id:'service-pack',name:'按包服务',quantity:2,unit:'次',measurement:'per-package',validity:'',description:'',referencePrice:price(100)},{id:'service-once',name:'按次服务',quantity:2,unit:'次',measurement:'per-delivery',validity:'',description:'',referencePrice:price(300)}]
draft.quote.amountCents=12000;draft=reviewBenefitQuote(draft);totals=benefitReferenceTotals(draft,3);assert.equal(totals.perPackageKnownCents,10450);assert.equal(totals.perDeliveryKnownCents,600);assert.equal(totals.totalKnownCents,31950);assert.equal(totals.differenceCents,-4050)
const replacement=replaceBenefitSku(s.data,draft,draft.goods[0]!.id,added.id);assert.equal(replacement.goods.find(l=>l.skuId===added.id)!.referencePrice,undefined);assert.equal(replacement.quote.amountCents,12000);assert(validateBenefitPackage(s.data,replacement).quoteNeedsReview)
for(const text of ['-1','1.001','NaN','Infinity','900719925474099.00'])assert.throws(()=>parseBenefitAmount(text));assert.equal(parseBenefitAmount(''),null);assert.equal(parseBenefitAmount('0'),0)
const overflow=cloneBenefit(draft);overflow.goods[0]!.referencePrice=price(Number.MAX_SAFE_INTEGER);const old=s.exportJson(),oldRaw=disk.get(STORAGE_KEY);assert(!(await s.saveBenefitPackage({draft:overflow,status:'draft',requestId:'overflow'})).ok);assert.equal(s.exportJson(),old);assert.equal(disk.get(STORAGE_KEY),oldRaw)
pass('null versus free zero; safe cents multiplication/sums; per-delivery services charged once; signed reference difference; replacement clears price and retains quote for review')
const pkg=await s.saveBenefitPackage({draft,status:'available',requestId:'package'});assert(pkg.ok,pkg.message);assert(pkg.package)
let preview=previewBenefitDelivery(s.data,pkg.package,3);assert(preview.canConfirm,JSON.stringify(preview.issues));assert.equal(preview.services[1]!.totalQuantity,2);assert.equal(preview.services[1]!.referenceTotalCents,600)
const req={packageId:pkg.id!,expectedRevision:pkg.package.revision,packageCount:3,expectedBasis:preview.basis,requestId:'delivery'}
const pre=s.exportJson(),preRaw=disk.get(STORAGE_KEY);fail=true;assert(!(await s.generateBenefitDelivery(req)).ok);assert.equal(s.exportJson(),pre);assert.equal(disk.get(STORAGE_KEY),preRaw)
const delivery=await s.generateBenefitDelivery(req);assert(delivery.ok,delivery.message);assert(delivery.delivery);assert((await s.generateBenefitDelivery(req)).ok);assert.equal(s.data.benefitDeliveries!.length,1)
const frozen=JSON.stringify(delivery.delivery),book=JSON.stringify(buildBenefitDeliveryWorkbook(delivery.delivery));assert(book.includes('人工参考单价'));assert(book.includes('修订 1'))
let changed=cloneBenefit(framework);changed.name='新框架名';changed.groups[0]!.defaultQuantity=3;assert((await s.saveBenefitFramework({draft:changed,expectedRevision:1,requestId:'rev2'})).ok)
assert.deepEqual(s.data.benefitPackages![0]!.framework,frameworkSnapshot(framework));assert(!(await s.saveBenefitFramework({draft:changed,expectedRevision:1,requestId:'stale'})).ok)
const update=cloneBenefit(pkg.package);update.goods[0]!.referencePrice=price(500);assert(validateBenefitPackage(s.data,update).quoteNeedsReview)
const changedPkg=await s.saveBenefitPackage({draft:update,status:'available',expectedRevision:update.revision,requestId:'edit'});assert(changedPkg.ok);assert(!previewBenefitDelivery(s.data,changedPkg.package!,3).canConfirm);assert(!(await s.generateBenefitDelivery({...req,requestId:'stale-preview'})).ok)
changed=cloneBenefit(s.data.benefitFrameworks!.find(x=>x.id===framework.id)!);changed.status='disabled';assert((await s.saveBenefitFramework({draft:changed,expectedRevision:changed.revision,requestId:'disable'})).ok);assert.throws(()=>applyBenefitFramework(newBenefitPackageDraft(),s.data.benefitFrameworks!.find(x=>x.id===framework.id)!))
assert(!(await s.removeBenefitFramework(framework.id,changed.revision+1)).ok);assert(s.removeProductType('type-case'));assert.equal(JSON.stringify(s.data.benefitDeliveries![0]),frozen);assert.equal(JSON.stringify(buildBenefitDeliveryWorkbook(s.data.benefitDeliveries![0]!)),book)
pass('frozen framework/price/compatibility delivery; quota retry once; stale revision/preview rejected; framework update/disable and package repricing never rewrite history; referenced framework/type protected')
const backup=s.exportJson();await s.importJson(backup);assert.equal(s.exportJson(),backup)
for(const mutate of [(x:any)=>x.benefitFrameworks={},(x:any)=>x.benefitFrameworks[0].history=[null],(x:any)=>x.benefitPackages[0].goods[0].referencePrice={amountCents:-1},(x:any)=>x.benefitDeliveries[0].referenceTotals.totalKnownCents=0,(x:any)=>x.benefitPackages[0].framework.groups[0].scope.productTypeIds=['type-charger']]){
 const bad=JSON.parse(backup),diskBefore=disk.get(STORAGE_KEY);mutate(bad.data);await assert.rejects(()=>s.importJson(JSON.stringify(bad)),/权益包/);assert.throws(()=>normalizeStored(bad));assert.equal(s.exportJson(),backup);assert.equal(disk.get(STORAGE_KEY),diskBefore)
}
s.setRole('operator');await s.waitForPersistence();const operator=s.exportJson(),operatorRaw=disk.get(STORAGE_KEY)
assert(!(await s.saveBenefitFramework(input)).ok);assert(!(await s.removeBenefitFramework(framework.id,3)).ok);assert(!(await s.saveBenefitPackage({draft,status:'available',requestId:'operator'})).ok);assert(!(await s.generateBenefitDelivery(req)).ok)
const bad=JSON.parse(operator);bad.data.activeRole='admin';bad.data.benefitFrameworks[0].name='bypass';await assert.rejects(()=>s.importJson(JSON.stringify(bad)),/仅可查看权益包/);assert.equal(s.exportJson(),operator);assert.equal(disk.get(STORAGE_KEY),operatorRaw)
for(const mutate of [(x:any)=>x.benefitPackages[0].goods[0].referencePrice.amountCents=1,(x:any)=>x.benefitDeliveries[0].goods[0].referencePrice.amountCents=1]){const altered=JSON.parse(operator);mutate(altered.data);await assert.rejects(()=>s.importJson(JSON.stringify(altered)),/仅可查看权益包/);assert.equal(s.exportJson(),operator);assert.equal(disk.get(STORAGE_KEY),operatorRaw)}
pass('backup restores framework/price/history; malformed containers/prices/totals/forged rules rejected; operator direct commands and role-spoof import atomic')
s.setRole('admin');await s.waitForPersistence();let free=addBenefitSku(s.data,newBenefitPackageDraft(),'charger-sku');free.name='旧自由包';assert(validateBenefitPackage(s.data,free).canSaveAvailable);assert.equal(copyBenefitPackageDraft(pkg.package).goods.length,pkg.package.goods.length)
free.groups=[{...group('旧组','type-charger'),scope:undefined,candidateSkuIds:['charger-sku'],maxKinds:1}];free.rulesEnabled=true;free.goods[0]!.quantity=2;assert(validateBenefitPackage(s.data,free).canSaveAvailable)
let conditional=applyBenefitFramework(newBenefitPackageDraft({kind:'sku',skuId:'phone-a'}),{...framework,groups:[group('线缆','type-cable')]});conditional.name='条件包';conditional=addBenefitSku(s.data,conditional,'cable-sku');assert(validateBenefitPackage(s.data,conditional).issues.some(i=>i.severity==='condition'));conditional=confirmBenefitCondition(s.data,conditional,'cable-sku','确认使用转换器',new Date().toISOString());assert(validateBenefitPackage(s.data,conditional).canDeliver);assert.throws(()=>confirmBenefitCondition(s.data,conditional,'pending-sku','不能升级',new Date().toISOString()))
pass('free packages, legacy SKU whitelist and common-package copy retained; conditional confirmation remains scoped and never upgrades pending')
// Explicit scope changes retain members/prices; unknown legal scope survives import but blocks execution.
const retained=applyBenefitFramework(changedPkg.package!);assert.equal(retained.framework,undefined);assert.deepEqual(retained.goods,changedPkg.package!.goods);assert.equal(retained.quote.amountCents,changedPkg.package!.quote.amountCents)
const currentBackup=s.exportJson(),unknown=JSON.parse(currentBackup),uf=unknown.data.benefitFrameworks.find((x:any)=>x.id===framework.id)
for(const revision of uf.history)revision.groups[0].scope.kind='future-type-range';uf.groups[0].scope.kind='future-type-range'
for(const p of unknown.data.benefitPackages)if(p.framework?.frameworkId===uf.id)p.framework.groups[0].scope.kind='future-type-range'
await s.importJson(JSON.stringify(unknown));assert.equal(s.data.benefitFrameworks!.find(f=>f.id===framework.id)!.groups[0]!.scope!.kind,'future-type-range');assert(!validateBenefitPackage(s.data,s.data.benefitPackages![0]!).canSaveAvailable)
await s.importJson(currentBackup)
const outside=JSON.parse(currentBackup);outside.data.benefitPackages[0].goods.push(addBenefitSku(s.data,newBenefitPackageDraft(),'charger-sku').goods[0]);await assert.rejects(()=>s.importJson(JSON.stringify(outside)),/框架类型组/)
assert.equal(s.exportJson(),currentBackup)
const switched={...conditional,device:{kind:'sku' as const,skuId:'phone-b'}};assert(!validateBenefitPackage(s.data,switched).canDeliver)
const legacy=JSON.parse(currentBackup);for(const d of legacy.data.benefitDeliveries){delete d.referenceTotals;delete d.framework;for(const l of [...d.goods,...d.services]){delete l.referencePrice;delete l.referenceLineCents;delete l.referenceTotalCents}}
await s.importJson(JSON.stringify(legacy));assert.equal(s.data.benefitDeliveries![0]!.referenceTotals,undefined);assert(JSON.stringify(buildBenefitDeliveryWorkbook(s.data.benefitDeliveries![0]!)).includes('历史记录未记录'))
await s.importJson(currentBackup);assert(!(await s.generateBenefitDelivery({...req,packageCount:4})).ok)
pass('detach preserves selections/prices; unknown legal range retained but blocked; outside-member JSON rejected; changed host invalidates confirmation; old snapshots stay unpriced; request intent cannot change count')
const resetBefore=s.exportJson(),resetDisk=disk.get(STORAGE_KEY);assert(!(await s.resetModule('categories')).ok);assert.equal(s.exportJson(),resetBefore);assert.equal(disk.get(STORAGE_KEY),resetDisk)
const concurrent=cloneBenefit(s.data.benefitFrameworks!.find(f=>f.id===framework.id)!);concurrent.name='并发修订';const results=await Promise.all([s.saveBenefitFramework({draft:concurrent,expectedRevision:concurrent.revision,requestId:'concurrent-1'}),s.saveBenefitFramework({draft:concurrent,expectedRevision:concurrent.revision,requestId:'concurrent-2'})]);assert.equal(results.filter(r=>r.ok).length,1)
const unused=s.data.benefitFrameworks!.find(f=>f.name==='先于商品')!;assert((await s.removeBenefitFramework(unused.id,unused.revision)).ok);assert(!(await s.saveBenefitFramework({draft:empty,expectedRevision:0,requestId:'empty'})).ok);assert(!(await s.saveBenefitFramework({draft:cloneBenefit(unused),expectedRevision:unused.revision,requestId:'resurrect'})).ok)
pass('module reset protects all framework revisions; queued concurrent framework edits accept one revision only; operator price/history imports rejected; deleted creation receipts cannot resurrect framework')
writeFileSync(`${out}/checks.json`,JSON.stringify({passed:checks.length,checks},null,2));s.$dispose()
