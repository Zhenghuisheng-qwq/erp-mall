import assert from 'node:assert/strict'
import {createPinia,setActivePinia} from 'pinia'
import {createSalesConfigurationFixture} from './sales-configuration-fixtures'
import {installCatalogTestLocks} from './catalog-storage-test-env'
import {addBenefitSku,cloneBenefit,newBenefitPackageDraft,previewBenefitDelivery,reviewBenefitQuote,validateBenefitPackage} from '../src/domain/benefitPackages'
import {salesCatalogSkus,salesContextAdmission,salesDeviceAdmission,salesDeviceSkus,salesSkuAdmission} from '../src/domain/salesCatalog'
import {addSalesCandidate,querySalesCandidates,setSalesDevice} from '../src/domain/salesSelection'
import {DATA_VERSION,STORAGE_KEY} from '../src/domain/types'
import {useCatalogStore} from '../src/stores/catalog'

const restoreLocks=installCatalogTestLocks(),oldLocal=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),oldSession=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage')
const disk=new Map<string,string>(),session=new Map<string,string>()
for(const [name,values] of [['localStorage',disk],['sessionStorage',session]] as const)Object.defineProperty(globalThis,name,{configurable:true,value:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,String(value)),removeItem:(key:string)=>values.delete(key)}})
let store:ReturnType<typeof useCatalogStore>|undefined
try{
  const {data}=createSalesConfigurationFixture(),phone=data.skus.find(sku=>sku.id==='phone-a')!,family=data.families.find(row=>row.id===phone.familyId)!
  phone.status='off_sale'
  assert(salesContextAdmission(data,phone.id).allowed);assert(salesDeviceAdmission(data,phone.id).allowed)
  assert(!salesSkuAdmission(data,phone.id).allowed);assert(salesDeviceSkus(data).some(sku=>sku.id===phone.id));assert(!salesCatalogSkus(data).some(sku=>sku.id===phone.id))
  const categoryId=family.categoryId;family.categoryId='retired-category'
  assert(salesDeviceAdmission(data,phone.id).allowed,'Retired sales catalogue placement must not invalidate proven equipment identity')
  family.categoryId=categoryId
  assert.throws(()=>setSalesDevice(data,newBenefitPackageDraft(),{kind:'sku',skuId:'case-sku'}),/主机/)
  assert.throws(()=>setSalesDevice(data,newBenefitPackageDraft(),{kind:'sku',skuId:'missing-device'}),/不存在/)
  let draft=setSalesDevice(data,newBenefitPackageDraft(),{kind:'sku',skuId:phone.id})
  draft.name='停售已有手机的在售配件与服务';draft.quote.amountCents=15900
  let query=querySalesCandidates(data,draft,phone.id)
  assert.equal(query.sourceIssue,'');assert.equal(query.resolution.state,'matched')
  const accessory=query.rows.find(row=>row.skuId==='case-sku')!;assert(accessory.canAdd,accessory.reason)
  draft=addSalesCandidate(data,draft,accessory)
  query=querySalesCandidates(data,draft,phone.id)
  draft=addSalesCandidate(data,draft,query.rows.find(row=>row.item.scope.kind==='service')!)
  draft=reviewBenefitQuote(draft,data)
  const validation=validateBenefitPackage(data,draft)
  assert(validation.canSaveAvailable,validation.issues.map(issue=>issue.message).join('；'));assert(validation.canDeliver)
  assert.equal(draft.goods.some(line=>line.skuId===phone.id),false)
  assert.throws(()=>addBenefitSku(data,draft,phone.id,1,{role:'host',groupId:null}),/在售/)
  const switched=setSalesDevice(data,{...cloneBenefit(draft),confirmations:[{key:'old-condition',basis:'old-basis',note:'old',confirmedAt:new Date().toISOString()}]},{kind:'sku',skuId:'phone-b'})
  assert.equal(switched.confirmations.length,0);assert(validateBenefitPackage(data,switched).quoteNeedsReview)
  console.log('PASS device context: off-sale proven host remains selectable; source candidates and draft checks work; no phone physical row; switching clears confirmations and quote review')

  disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data}));session.set('iyge-rbac-simulated-user','u-admin');setActivePinia(createPinia());store=useCatalogStore();await store.waitForPersistence()
  const saved=await store.saveBenefitPackage({draft,status:'available',expectedRevision:0,requestId:'off-sale-device-save'})
  assert(saved.ok&&saved.package,saved.message)
  const preview=previewBenefitDelivery(store.data,saved.package,1);assert(preview.canConfirm,preview.issues.map(issue=>issue.message).join('；'))
  const delivered=await store.generateBenefitDelivery({packageId:saved.package.id,expectedRevision:saved.package.revision,expectedBasis:preview.basis,packageCount:1,requestId:'off-sale-device-delivery'})
  assert(delivered.ok&&delivered.delivery,delivered.message);assert.equal(delivered.delivery.goods.some(line=>line.skuId===phone.id),false)
  const persisted=JSON.parse(disk.get(STORAGE_KEY)!).data
  assert.equal(persisted.benefitPackages[0].device.skuId,phone.id);assert.equal(persisted.benefitDeliveries.length,1)
  console.log('PASS device persistence: real Store saves and delivers sale accessory + service using off-sale phone context; persisted delivery contains no phone physical good')

  const offCase=store.data.skus.find(sku=>sku.id==='case-sku')!;offCase.status='off_sale';await store.waitForPersistence()
  assert(salesContextAdmission(store.data,offCase.id).allowed)
  const sourceQuery=querySalesCandidates(store.data,draft,offCase.id)
  assert.equal(sourceQuery.sourceIssue,'');assert(sourceQuery.rows.some(row=>row.skuId==='film-sku'),'Off-sale source keeps its actual frozen configuration')
  const blocked=validateBenefitPackage(store.data,saved.package)
  assert.equal(blocked.canDeliver,false);assert(blocked.issues.some(issue=>/在售|下架/.test(issue.message)))
  const declined=await store.saveBenefitPackage({draft:saved.package,status:'available',expectedRevision:saved.package.revision,requestId:'reject-off-sale-physical'})
  assert.equal(declined.ok,false)
  const blockedPreview=previewBenefitDelivery(store.data,saved.package,1);assert.equal(blockedPreview.canConfirm,false)
  const rejected=await store.generateBenefitDelivery({packageId:saved.package.id,expectedRevision:saved.package.revision,expectedBasis:blockedPreview.basis,packageCount:1,requestId:'reject-off-sale-physical-delivery'})
  assert.equal(rejected.ok,false);assert.equal(store.data.benefitDeliveries!.length,1)
  console.log('PASS actual-goods gates: off-sale source still reads candidates; off-sale physical item blocks available save, delivery preview and formal delivery')
}finally{
  store?.$dispose();restoreLocks()
  for(const [name,old]of [['localStorage',oldLocal],['sessionStorage',oldSession]] as const)if(old)Object.defineProperty(globalThis,name,old);else Reflect.deleteProperty(globalThis,name)
}
