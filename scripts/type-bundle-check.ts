import {cleanPhoneDemoNames} from '../src/domain/benefitSales/phoneDemoNames'
import assert from 'node:assert/strict'
import {createPinia,setActivePinia} from 'pinia'
import {installCatalogTestLocks} from './catalog-storage-test-env'
import {bundleFixture} from './type-bundle-fixture'
import {useCatalogStore} from '../src/stores/catalog'
import {DATA_VERSION,STORAGE_KEY} from '../src/domain/types'
import {compatibilityWorkspaceBasis,modelSelectionChanges,previewWorkspace} from '../src/domain/compatibilityWorkspace'
import {resolveDeviceSku,listDeviceModels,deviceHostKey} from '../src/domain/deviceResolution'
import {isRealSku,isMaterialArchive} from '../src/domain/catalogIdentity'
import {resolveSkuModelSource} from '../src/domain/modelSourceContext'
import {replacePhoneCatalogDemo} from '../src/domain/benefitSales/phoneCatalogDemo'
import {defaultColumns,emptyQuery} from '../src/domain/seed'
import {availableBenefitGroups,groupTypesProblem,saleQuery} from '../src/domain/benefitSales/query'
import {createSeed} from '../src/domain/seed'
import {RBAC_ENFORCEMENT_ENABLED} from '../src/domain/accessMode'
import type {GeneralChange} from '../src/domain/generalCompatibility'
installCatalogTestLocks()
const {data,history}=bundleFixture(),disk=new Map<string,string>();let fail=false
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>disk.get(k)??null,setItem:(k:string,v:string)=>{if(fail){fail=false;throw Error('isolated quota')};disk.set(k,v)},removeItem:(k:string)=>disk.delete(k)}})
disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data}));setActivePinia(createPinia());const store=useCatalogStore();await store.waitForPersistence()
const deviceKeys=['s-iphone-blue','s-demo-iphone16'].map(id=>deviceHostKey(resolveDeviceSku(store.data,id).host!)),models=listDeviceModels(store.data).filter(m=>deviceKeys.includes(m.key));assert.equal(models.length,2)
for(const id of ['s-iphone-blue','s-iphone-white','s-demo-iphone16'])assert.equal(resolveDeviceSku(store.data,id).status,'resolved')
const changes=modelSelectionChanges(store.data,['s-demo-earphones'],[],models.map(m=>m.key),'remove',{source:'隔离核对：两个型号及必要条件',verification:'confirmed',conclusion:'compatible',capability:'basic'})
const general:GeneralChange[]=[{kind:'add',draft:{skuId:'s-demo-earphones',deviceTypeIds:['pt-phone'],capability:'basic',conditions:[{kind:'attribute',attributeId:'p-demo-port',operator:'eq',value:'USB-C'}],conclusion:'compatible',verification:'confirmed',source:'隔离核对：USB-C 必要条件',note:''}}]
const scope={mode:'group' as const,categoryId:'c-phone',groupId:'demo-phone-basic',productTypeIds:[...store.data.benefitTypeGroups![0]!.productTypeIds],device:{kind:'sku' as const,skuId:'s-iphone-blue'}}
const preview=previewWorkspace(store.data,changes,general);assert(preview.ok,preview.message);assert(saleQuery(preview.candidate,scope).candidates.some(c=>c.id==='s-demo-earphones'));assert(!saleQuery(store.data,scope).candidates.some(c=>c.id==='s-demo-earphones'))
const before=store.exportJson(),raw=disk.get(STORAGE_KEY),basis=compatibilityWorkspaceBasis(store.data)
fail=true;assert(!(await store.saveCompatibilityWorkspace(changes,general,basis)).ok);assert.equal(store.exportJson(),before);assert.equal(disk.get(STORAGE_KEY),raw)
assert((await store.saveCompatibilityWorkspace(changes,general,basis)).ok)
const sale=await store.saveBundleSale({id:'',scope,lines:[{skuId:'s-demo-earphones',quantity:2,unitPriceCents:13950}],status:'confirmed'},0);assert(sale.ok)
const snapshot=JSON.stringify(store.data.benefitSalesLists),claim=store.data.generalCompatibilityClaims!.find(c=>c.skuId==='s-demo-earphones')!
assert((await store.saveCompatibilityWorkspace([],[{kind:'edit',id:claim.id,revision:claim.revision,draft:{...claim,source:'修改当前依据'}}],compatibilityWorkspaceBasis(store.data))).ok);assert.equal(JSON.stringify(store.data.benefitSalesLists),snapshot);assert.deepEqual(store.data.benefitSalesLists!.find(s=>s.id===history.id),history)
const unknown=JSON.parse(store.exportJson()).data;unknown.compatibilities=unknown.compatibilities.filter((l:{targetId?:string})=>l.targetId!=='s-demo-earphones');delete unknown.skus.find((s:{id:string})=>s.id==='s-iphone-blue').variantAttrs['p-demo-port'];assert(!saleQuery(unknown,scope).candidates.some(c=>c.id==='s-demo-earphones'))
const negative=modelSelectionChanges(store.data,['s-demo-charger'],[],[models.find(m=>m.label.includes('17'))!.key],'remove',{source:'隔离明确排除',verification:'confirmed',conclusion:'incompatible',capability:'basic'}),blocked=previewWorkspace(store.data,negative,[]);assert(blocked.ok);assert(!saleQuery(blocked.candidate,scope).candidates.some(c=>c.id==='s-demo-charger'))
const zero=await store.saveTypeBundle({id:'',name:'同分类与零SKU',categoryId:'c-phone',productTypeIds:['pt-phone','bundle-empty-type'],enabled:true,sort:1},0);assert(zero.ok)
const seed=createSeed();assert.deepEqual(seed.productTypes.map(t=>t.name),['手机壳','手机膜','充电器','手机']);assert.equal(seed.categories.length,1);assert.equal(seed.specCanvases.length,4);assert.equal(seed.specModelVersions.filter(v=>v.status==='published').length,4);assert.equal(seed.skus.filter(s=>isRealSku(seed,s)).length,10);assert.equal(seed.skus.filter(s=>isMaterialArchive(seed,s)).length,10);assert(seed.skus.every(s=>s.status==='on_sale'))
assert(seed.skus.filter(s=>isRealSku(seed,s)).every(s=>resolveSkuModelSource(seed,s.id).state==='resolved'))
for(const plan of seed.planningRecords)assert(seed.skus.some(s=>isMaterialArchive(seed,s)&&s.planningId===plan.planningId))
const eighteen={kind:'sku' as const,skuId:'demo18-sku-phone-1'},ready=availableBenefitGroups(seed,eighteen);assert.equal(ready[0]!.id,'demo18-bundle-full');assert.equal(ready.filter(g=>!g.missingTypes.length).length,2)
const query18=saleQuery(seed,{mode:'group',categoryId:'c-phone',groupId:ready[0]!.id,productTypeIds:ready[0]!.productTypeIds,device:eighteen});for(const kind of ['case','film','charger'])assert(query18.candidates.some(c=>c.id.startsWith('demo18-sku-'+kind)))
const wrong=structuredClone(seed);wrong.productTypes[0]!.categoryId='outside';assert(groupTypesProblem(wrong,'c-phone',ready[0]!.productTypeIds))
const rebuilt=replacePhoneCatalogDemo(data,defaultColumns(),emptyQuery());assert(rebuilt.ok,rebuilt.message);assert.deepEqual(rebuilt.next.benefitSalesLists,data.benefitSalesLists);assert.deepEqual(rebuilt.next.users,data.users);assert(!rebuilt.next.skus.some(s=>s.id==='s-iphone-blue'))

const deletionTarget=store.data.benefitTypeGroups!.find(g=>g.id===history.scope.groupId)!,deletionBefore=store.exportJson(),deletionDisk=disk.get(STORAGE_KEY),historyBeforeDelete=JSON.stringify(store.data.benefitSalesLists)
assert(!(await store.removeTypeBundle(deletionTarget.id,deletionTarget.revision+1)).ok);assert.equal(store.exportJson(),deletionBefore)
fail=true;assert(!(await store.removeTypeBundle(deletionTarget.id,deletionTarget.revision)).ok);assert.equal(store.exportJson(),deletionBefore);assert.equal(disk.get(STORAGE_KEY),deletionDisk)
assert((await store.removeTypeBundle(deletionTarget.id,deletionTarget.revision)).ok);assert(!store.data.benefitTypeGroups!.some(g=>g.id===deletionTarget.id));assert.equal(JSON.stringify(store.data.benefitSalesLists),historyBeforeDelete)
console.log('PASS 删除修订检查、保存失败不丢记录、删除仅影响配置且历史快照保留')
assert.throws(()=>store.data.compatibilities.push(store.data.compatibilities[0]!));assert.throws(()=>store.data.benefitSalesLists!.push(history))
if(RBAC_ENFORCEMENT_ENABLED){assert(store.startPermissionPreview('u-op').ok);assert.throws(()=>store.removeTypeBundle('demo18-bundle-full',1),/未授权/);assert.throws(()=>store.saveCompatibilityWorkspace(changes,[],compatibilityWorkspaceBasis(store.data)),/未授权/);assert(store.stopPermissionPreview().ok)}
console.log('PASS 同分类类型集合、18 Pro Max 模型与发布链路、完整闭环、真实演示SKU、条件未知阻断、具体否定阻断、保存失败原子性、严格权限、历史快照、零SKU配置')
const oldNames=structuredClone(seed);oldNames.benefitSalesLists=structuredClone(data.benefitSalesLists)
const aliases=new Map(oldNames.params.map(p=>[p.name,p.name+'（18演示）']));for(const p of oldNames.params)p.name=aliases.get(p.name)!
for(const family of oldNames.families)family.commonAttrs=Object.fromEntries(Object.entries(family.commonAttrs).map(([k,v])=>[aliases.get(k)||k,v]))
for(const sku of oldNames.skus){sku.skuName=(sku.skuName||'')+' · 演示';sku.variantAttrs=Object.fromEntries(Object.entries(sku.variantAttrs).map(([k,v])=>[aliases.get(k)||k,v]));sku.projectedAttrs=Object.fromEntries(Object.entries(sku.projectedAttrs).map(([k,v])=>[aliases.get(k)||k,v]))}
const named=cleanPhoneDemoNames(oldNames);assert(named.ok);assert(named.changed);assert(named.next.params.every(p=>!p.name.includes('演示')));assert.deepEqual(named.next.benefitSalesLists,oldNames.benefitSalesLists);assert.deepEqual(saleQuery(named.next,{mode:'group',categoryId:'c-phone',groupId:ready[0]!.id,productTypeIds:ready[0]!.productTypeIds,device:eighteen}).candidates.map(c=>c.id),query18.candidates.map(c=>c.id))
store.$dispose()
const oldData=structuredClone(data);delete oldData.phoneDemoCatalogVersion;disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data:oldData}));setActivePinia(createPinia());const upgraded=useCatalogStore();await upgraded.waitForPersistence();assert.equal(upgraded.data.phoneDemoCatalogVersion,1);assert.equal(upgraded.data.productTypes.length,4);assert.equal(upgraded.data.skus.length,20);assert.deepEqual(upgraded.data.benefitSalesLists,data.benefitSalesLists);upgraded.$dispose();console.log('PASS 已授权旧商品目录一次性原子整理；4类型/4模型/10销售SKU/10MAT；确认历史保留')
