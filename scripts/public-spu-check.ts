import {defaultMenuNodes,sanitizeMenu} from '../src/domain/menuConfig'
import {routePermissions} from '../src/domain/rbac'
import assert from 'node:assert/strict'
import {createPinia,setActivePinia} from 'pinia'
import {installCatalogTestLocks} from './catalog-storage-test-env'
import {publicSpuFixture,publicTestId,publicModel,publicType} from './public-spu-fixture'
import {useCatalogStore} from '../src/stores/catalog'
import {STORAGE_KEY,DATA_VERSION,type AppData} from '../src/domain/types'
import {publicPoolBasis,filterPublicSpus,emptyPublicSpuFilter,publicSpuProblem,publicPoolStorageProblems} from '../src/domain/benefitSales/publicSpuPool'
import {saleQuery} from '../src/domain/benefitSales/query'
import {reviewLines,benefitStorageProblems} from '../src/domain/benefitSales/commands'
import {isRealSku} from '../src/domain/catalogIdentity'
import {previewSkuAppend,spuRemovalBlock} from '../src/domain/spuSku'
import {resolveDeviceSku,deviceHostKey} from '../src/domain/deviceResolution'
import {modelSelectionChanges,compatibilityWorkspaceBasis} from '../src/domain/compatibilityWorkspace'
installCatalogTestLocks()
const menu=defaultMenuNodes(),oldMenu=menu.filter(n=>n.route!=='/benefits/public-pool');oldMenu.find(n=>n.route==='/benefits/shopping')!.title='自定义选购入口';const mergedMenu=sanitizeMenu(oldMenu);assert.equal(mergedMenu.find(n=>n.route==='/benefits/public-pool')!.parentId,'benefits');assert.equal(mergedMenu.find(n=>n.route==='/benefits/shopping')!.title,'自定义选购入口');assert(routePermissions('/benefits/public-pool')?.includes('product:spu:read'));console.log('PASS 独立路由与旧导航增量登记，保留原菜单自定义配置')
const fixture=publicSpuFixture(),disk=new Map<string,string>();let fail=false
const clone=<T>(v:T):T=>JSON.parse(JSON.stringify(v)),mark=(name:string)=>console.log('PASS',name)
fixture.rbac!.roles.push({id:'public-test-sales-role',code:'public-test-sales',name:'销售',description:'隔离验收',enabled:true,permissionCodes:fixture.rbac!.permissions.filter(p=>p.action==='read'||p.resource==='bundle-sale').map(p=>p.code)})
fixture.users.push({...fixture.users[0]!,id:'public-test-sales',username:'public-test-sales',displayName:'销售',role:'operator',roleIds:['public-test-sales-role']})
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>disk.get(k)??null,setItem:(k:string,v:string)=>{if(fail){fail=false;throw Error('isolated quota')};disk.set(k,v)},removeItem:(k:string)=>disk.delete(k)}})
const coreKeys=['categories','productTypes','templates','templateParams','mappings','productSpecNodes','specCanvases','specModelVersions','families','skus','planningRecords','materialReceipts','materialRelations','compatibilities','generalCompatibilityClaims','brands','rbac','users'] as const
const core=(data:AppData)=>JSON.stringify(coreKeys.map(k=>data[k])),initialCore=core(fixture),oldGroups=clone(fixture.benefitTypeGroups),oldSales=clone(fixture.benefitSalesLists)
delete fixture.phoneDemoCatalogVersion;delete fixture.phoneDemoBrandsVersion
disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data:fixture}));setActivePinia(createPinia());const store=useCatalogStore();await store.waitForPersistence()
assert.equal(core(store.data),initialCore);assert.equal(store.data.phoneDemoCatalogVersion,undefined);assert.equal(store.data.publicSpuPool,undefined);assert.deepEqual(store.data.benefitTypeGroups,oldGroups);assert.deepEqual(store.data.benefitSalesLists,oldSales)
mark('T18/T20/T21 启动无目录重建、公共池初始化或旧记录补字段；商品身份与数量、权限、历史均保持')
const add=await store.addPublicSpus([publicTestId],publicPoolBasis(store.data));assert(add.ok);assert.equal(store.data.publicSpuPool!.length,1);assert.equal(core(store.data),initialCore);assert.deepEqual(store.data.benefitTypeGroups,oldGroups)
const rawAfter=disk.get(STORAGE_KEY);assert((await store.addPublicSpus([publicTestId],publicPoolBasis(store.data))).ok);assert.equal(disk.get(STORAGE_KEY),rawAfter)
assert(publicSpuProblem(store.data,store.data.skus.find(s=>s.recordKind==='material')!.id));assert.equal(publicSpuProblem(store.data,store.data.families.find(f=>f.line==='v3')!.id),'');assert(!(await store.addPublicSpus(['PLN-000001'],publicPoolBasis(store.data))).ok)
mark('T01/T02 公共池只新增全局 SPU 引用，重复加入不写入；拒绝 MAT/PLN')
const filters={...emptyPublicSpuFilter(),keyword:'PWR-65W',categoryId:'public-test-root',productTypeId:publicType,modelId:publicModel,brand:'星海',status:'on' as const,joined:'yes' as const}
assert.deepEqual(filterPublicSpus(store.data,filters).map(r=>r.id),[publicTestId]);assert.equal(filterPublicSpus(store.data,{...filters,status:'off'}).length,0);assert.equal(filterPublicSpus(store.data,{...filters,modelId:'demo18-model-phone'}).length,0)
mark('T03 名称/ID/编号、分类后代、类型、真实模型、结构化品牌、在售及加入状态组合筛选')
const create=async(name:string,categoryId:string,productTypeIds:string[],commonSpuIds?:string[])=>{const result=await store.saveTypeBundle({id:'',name,categoryId,productTypeIds,...(commonSpuIds===undefined?{}:{commonSpuIds}),enabled:true,sort:0},0);assert(result.ok,result.message);assert('record'in result);return result.record}
const phone=await create('手机公共充电包','c-phone',['pt-phone','pt-case','pt-film'],[publicTestId]),tablet=await create('平板公共充电包','public-test-tablet-category',['public-test-tablet'],[publicTestId]),computer=await create('电脑公共充电包','public-test-computer-category',['public-test-computer'],[publicTestId])
assert.equal(core(store.data),initialCore);assert.equal(store.data.publicSpuPool!.length,1)
assert(!(await store.saveTypeBundle({...phone,id:'',productTypeIds:['pt-phone',publicType]},0)).ok)
assert(!(await store.saveTypeBundle({...phone,id:'',commonSpuIds:[publicTestId,publicTestId]},0)).ok)
const partial={...phone};delete partial.commonSpuIds;const partialSaved=await store.saveTypeBundle(partial,phone.revision);assert(partialSaved.ok);assert('record'in partialSaved);assert.deepEqual(partialSaved.record.commonSpuIds,[publicTestId]);phone.revision=partialSaved.record.revision
const scope={mode:'group' as const,categoryId:phone.categoryId,groupId:phone.id,productTypeIds:phone.productTypeIds,commonSpuIds:[publicTestId],device:{kind:'sku' as const,skuId:'demo18-sku-phone-1'}}
const candidates=saleQuery(store.data,scope).candidates.map(c=>c.id);assert(candidates.includes('public-test-sku-1'));for(const id of ['public-test-sku-2','public-test-sku-3','public-test-sku-4'])assert(!candidates.includes(id),id)
const unknownFacts=clone(store.data),pending=unknownFacts.generalCompatibilityClaims!.find(c=>c.id==='public-test-general')!;pending.verification='confirmed';pending.conditions=[{kind:'attribute',attributeId:'public-test-color',operator:'eq',value:'黑色'}];assert(!saleQuery(unknownFacts,scope).candidates.some(c=>c.id==='public-test-sku-3'))
const conflict=clone(store.data);conflict.generalCompatibilityClaims!.push({...conflict.generalCompatibilityClaims![0]!,id:'public-test-wide-positive',skuId:'public-test-sku-4',deviceTypeIds:['pt-phone'],conditions:[{kind:'attribute',attributeId:'demo18-port',operator:'eq',value:'USB-C'}],verification:'confirmed',conclusion:'compatible'});assert(!saleQuery(conflict,scope).candidates.some(c=>c.id==='public-test-sku-4'))
const mixed=clone(store.data),mat=mixed.skus.find(s=>s.recordKind==='material')!;mat.familyId=publicTestId;assert(!saleQuery(mixed,scope).candidates.some(c=>c.id===mat.id));assert.equal(filterPublicSpus(mixed,{...emptyPublicSpuFilter(),keyword:'PWR-65W'})[0]!.skuCount,4)
assert(saleQuery(store.data,{...scope,groupId:tablet.id,categoryId:tablet.categoryId,productTypeIds:tablet.productTypeIds,device:{kind:'sku',skuId:'public-test-tablet-sku'}}).candidates.some(c=>c.id==='public-test-sku-1'))
assert(!saleQuery(store.data,{...scope,groupId:computer.id,categoryId:computer.categoryId,productTypeIds:computer.productTypeIds,device:{kind:'sku',skuId:'public-test-computer-sku'}}).candidates.some(c=>c.id==='public-test-sku-1'))
const combined=saleQuery(store.data,{mode:'free',categoryId:'c-phone',productTypeIds:[publicType],commonSpuIds:[publicTestId],device:scope.device});assert.equal(combined.candidates.filter(c=>c.id==='public-test-sku-1').length,1);assert.equal(combined.candidates[0]!.sources.length,2)
const noRole=clone(store.data),noRoleType=noRole.productTypes.find(t=>t.id===publicType)!;delete noRoleType.catalogRole
const noRoleSale=saleQuery(noRole,{...scope,groupId:computer.id,categoryId:computer.categoryId,productTypeIds:computer.productTypeIds,device:{kind:'sku',skuId:'public-test-computer-sku'}})
assert(noRoleSale.candidates.some(c=>c.id==='public-test-sku-1'));assert(!noRoleSale.candidates.some(c=>c.id==='public-test-sku-2'));assert(noRoleSale.groups.find(g=>g.spuId===publicTestId)!.candidates.length>0)
mark('未指定业务用途的公共在售 SKU 可加入任意组合；停售仍排除，且不会自动写入清单')
mark('T05/T06/T07/T08/T10 三分类权益包共用同一 SPU；类型限制保留；逐 SKU 适用、停售、待核验与否定筛选及去重')
const globalScope={...scope,commonSpuIds:undefined};assert(saleQuery(store.data,globalScope).candidates.some(c=>c.id==='public-test-sku-1'));assert(saleQuery(store.data,{...globalScope,mode:'free',groupId:undefined}).candidates.some(c=>c.id==='public-test-sku-1'));assert(saleQuery(store.data,{...globalScope,mode:'free',groupId:undefined,productTypeIds:[]}).candidates.some(c=>c.id==='public-test-sku-1'))
const beforeGlobalGroups=clone(store.data.benefitTypeGroups),automatic=await store.saveBundleSale({id:'',scope:{...globalScope,mode:'free',groupId:undefined,productTypeIds:[]},lines:[{skuId:'public-test-sku-1',quantity:2,unitPriceCents:10000}],status:'confirmed'},0);assert(automatic.ok);assert('record'in automatic);assert.deepEqual(automatic.record.scope.commonSpuIds,[publicTestId]);assert.deepEqual(automatic.record.snapshot!.commonSpus!.map(s=>s.spuId),[publicTestId]);assert.deepEqual(store.data.benefitTypeGroups,beforeGlobalGroups)
console.log('PASS 公共池商品在按包/自由/纯公共选购自动出现，无需逐包或临时勾选；仅实际加购来源随快照冻结')
const groupsBeforeCable=clone(store.data.benefitTypeGroups);assert((await store.addPublicSpus(['public-test-cable-spu'],publicPoolBasis(store.data))).ok)
for(const mode of ['group','free'] as const){const result=saleQuery(store.data,{...globalScope,mode,groupId:mode==='group'?phone.id:undefined});const cable=result.groups.find(g=>g.spuId==='public-test-cable-spu');assert(cable);assert.equal(cable.name,'USB-C 充电线');assert.equal(cable.candidates.length,0);assert.equal(cable.empty,'暂无可选规格')}
assert.deepEqual(store.data.benefitTypeGroups,groupsBeforeCable);console.log('PASS 新增公共充电线动态出现在两种模式，零销售SKU显示占位，不修改权益包或既有工作范围')
const beforeFailure=store.exportJson(),beforeFailureRaw=disk.get(STORAGE_KEY);fail=true;assert(!(await store.addPublicSpus(['public-test-empty-1'],publicPoolBasis(store.data))).ok);assert.equal(store.exportJson(),beforeFailure);assert.equal(disk.get(STORAGE_KEY),beforeFailureRaw)
assert(!(await store.addPublicSpus(['public-test-empty-1'],'stale')).ok);assert.equal(store.exportJson(),beforeFailure);assert(!(await store.setPublicSpuEnabled(publicTestId,false,99)).ok)
assert(!(await store.saveTypeBundle({...phone,name:'过期写入'},phone.revision+1)).ok);assert.equal(store.exportJson(),beforeFailure)
assert.throws(()=>store.data.publicSpuPool!.push(store.data.publicSpuPool![0]!));assert.throws(()=>store.data.publicSpuPool![0]!.enabled=false)
const invalidSale=await store.saveBundleSale({id:'',scope:{...scope,commonSpuIds:null as unknown as string[]},lines:[{skuId:'public-test-sku-1',quantity:1,unitPriceCents:100}],status:'draft'},0);assert(!invalidSale.ok);assert.equal(store.exportJson(),beforeFailure)
const bypass=JSON.parse(store.exportJson());bypass.data.publicSpuPool=[];await assert.rejects(()=>store.importJson(JSON.stringify(bypass)),/仍被权益包引用/);assert.equal(store.exportJson(),beforeFailure)
assert((await store.addPublicSpus(['public-test-empty-2'],publicPoolBasis(store.data))).ok);assert(spuRemovalBlock(store.data,'public-test-empty-2'));assert((await store.removePublicSpu('public-test-empty-2',1)).ok);assert.equal(core(store.data),initialCore)
mark('T16 持久化失败、池基线/记录修订冲突和直接修改均拒绝，原始数据与存储一致')
assert((await store.addPublicSpus(['public-test-empty-1'],publicPoolBasis(store.data))).ok);const emptyGroup=await create('零规格包','c-phone',['pt-phone'],['public-test-empty-1']);assert.equal(saleQuery(store.data,{...scope,groupId:emptyGroup.id,productTypeIds:emptyGroup.productTypeIds,commonSpuIds:['public-test-empty-1']}).groups.find(g=>g.spuId==='public-test-empty-1')!.empty,'暂无可选规格')
const legacy=await create('旧格式新包','c-phone',['pt-case']);assert.equal(legacy.commonSpuIds,undefined);assert(saleQuery(store.data,{...scope,groupId:legacy.id,productTypeIds:legacy.productTypeIds,commonSpuIds:undefined}).candidates.some(c=>c.id==='demo18-sku-case-1'))
mark('T12/T17 零销售 SKU 的真实 SPU 可配置并显示空态；旧权益包缺省为空且不会自动补字段')
const sale=await store.saveBundleSale({id:'',scope,lines:[{skuId:'public-test-sku-1',quantity:2,unitPriceCents:12900}],status:'confirmed'},0);assert(sale.ok);assert('record'in sale);assert.equal(sale.record.snapshot!.commonSpus![0]!.spuId,publicTestId);assert.equal(sale.record.snapshot!.lines[0]!.sources![0]!.kind,'public');const snapshot=clone(sale.record),beforeOffGroups=clone(store.data.benefitTypeGroups)
assert(!(await store.removePublicSpu(publicTestId,1)).ok);assert((await store.setPublicSpuEnabled(publicTestId,false,1)).ok);assert(!saleQuery(store.data,scope).candidates.some(c=>c.id==='public-test-sku-1'));assert.deepEqual(store.data.benefitTypeGroups,beforeOffGroups);assert.deepEqual(store.data.benefitSalesLists!.find(s=>s.id===snapshot.id),snapshot)
assert(!(await store.saveBundleSale({id:'',scope,lines:[{skuId:'public-test-sku-1',quantity:1,unitPriceCents:12900}],status:'confirmed'},0)).ok)
assert((await store.setPublicSpuEnabled(publicTestId,true,2)).ok)
mark('T11/T18 停用不清空引用，添加/确认复核最新状态；引用中移除拒绝；来源与适用依据随确认快照冻结')
assert(store.startPermissionPreview('public-test-sales').ok);assert(store.data.publicSpuPool!.some(e=>e.spuId===publicTestId));assert(saleQuery(store.data,scope).candidates.some(c=>c.id==='public-test-sku-1'))
const salesDraft=await store.saveBundleSale({id:'',scope:{...scope,mode:'free',groupId:undefined},lines:[{skuId:'public-test-sku-1',quantity:1,unitPriceCents:9900}],status:'draft'},0);assert(salesDraft.ok)
for(const invoke of [()=>store.addPublicSpus(['public-test-empty-2'],publicPoolBasis(store.data)),()=>store.setPublicSpuEnabled(publicTestId,false,3),()=>store.removePublicSpu(publicTestId,3)])assert.throws(invoke,/未授权/)
assert(store.stopPermissionPreview().ok);assert.deepEqual(store.data.publicSpuPool!.map(e=>e.spuId).sort(),[publicTestId,'public-test-cable-spu','public-test-empty-1'].sort())
mark('T13/T14/T15 不同账号读取同一全局池；销售能临时选用并存草稿，不能新增/启停/移除全局公共商品')
const choice=previewSkuAppend(store.data,publicTestId,{kind:'model'}).rows.find(r=>r.state==='new'&&r.draft.variantAttrs['外观颜色']==='绿色'&&r.draft.variantAttrs['插头']==='国标')!;assert(choice)
const newSku=await store.appendSkus(publicTestId,{kind:'model'},[choice.key]);assert(newSku.ok);assert('ids'in newSku);const skuId=newSku.ids[0]!,sku=clone(store.data.skus.find(s=>s.id===skuId)!);assert((await store.editSku(skuId,{...sku,status:'on_sale',code:'PUBLIC-NEW-GREEN'})).ok)
const hostKey=deviceHostKey(resolveDeviceSku(store.data,scope.device.skuId).host!),changes=modelSelectionChanges(store.data,[skuId],[],[hostKey],'remove',{source:'隔离验收：新增真实 SKU 的适用核验',verification:'confirmed',conclusion:'compatible',capability:'basic'})
assert((await store.saveCompatibilityWorkspace(changes,[],compatibilityWorkspaceBasis(store.data))).ok);assert(saleQuery(store.data,scope).candidates.some(c=>c.id===skuId));assert.deepEqual(store.data.benefitTypeGroups,beforeOffGroups)
assert(reviewLines(store.data,{...scope,device:{kind:'sku',skuId:'public-test-phone17-sku'}},[{skuId:'public-test-sku-1',quantity:2,unitPriceCents:12900}]).issues.some(i=>i.skuId==='public-test-sku-1'))
assert.deepEqual(store.data.benefitSalesLists!.find(s=>s.id===snapshot.id),snapshot);for(const old of oldSales!)assert.deepEqual(store.data.benefitSalesLists!.find(s=>s.id===old.id),old)
assert.deepEqual(benefitStorageProblems(store.data),[]);assert.deepEqual(publicPoolStorageProblems(store.data),[])
mark('T09/T19 新增已核验在售 SKU 动态出现，无需改池/权益包；18→17 Pro Max 重新核验；旧草稿及确认历史保持')
// Regression: material filing creates a real SPU subject; line=v3 must not hide it.
const filedFamily='public-test-filed-fam',filedMat=clone(store.data.skus.find(s=>s.id==='public-test-filed-sku')!),beforeFiled=core(store.data)
const filedRows=filterPublicSpus(store.data,{...emptyPublicSpuFilter(),categoryId:'public-test-category',productTypeId:publicType,modelId:publicModel});const filedRow=filedRows.find(r=>r.id===filedFamily);assert(filedRow);assert.equal(filedRow.skuCount,0);assert.equal(filedRow.materialCount,1);assert.equal(publicSpuProblem(store.data,filedMat.id),'SPU 不存在或身份冲突')
assert((await store.addPublicSpus([filedFamily],publicPoolBasis(store.data))).ok);assert.equal(core(store.data),beforeFiled)
const filedGroup=await create('物料建档SPU引用包','c-phone',['pt-phone'],[filedFamily]),filedScope={...scope,groupId:filedGroup.id,productTypeIds:filedGroup.productTypeIds,commonSpuIds:[filedFamily]};assert.equal(saleQuery(store.data,filedScope).groups.find(g=>g.spuId===filedFamily)!.empty,'暂无可选规格');assert(!saleQuery(store.data,filedScope).candidates.some(c=>c.id===filedMat.id))
const filedChoice=previewSkuAppend(store.data,filedFamily,{kind:'model'}).rows[0]!;assert.equal(filedChoice.state,'new');const filedAppended=await store.appendSkus(filedFamily,{kind:'model'},[filedChoice.key]);assert(filedAppended.ok);assert('ids'in filedAppended);const filedSkuId=filedAppended.ids[0]!,filedSku=clone(store.data.skus.find(s=>s.id===filedSkuId)!);assert(isRealSku(store.data,filedSku));assert((await store.editSku(filedSkuId,{...filedSku,status:'on_sale',code:'FILED-SPU-SALE-001'})).ok);assert((await store.saveSpu({...clone(store.data.families.find(f=>f.id===filedFamily)!),shelfStatus:'online',lifecycle:'ready'})).ok)
const filedChanges=modelSelectionChanges(store.data,[filedSkuId],[],[hostKey],'remove',{source:'隔离验收：物料 SPU 下新增销售 SKU 的正式适用核验',verification:'confirmed',conclusion:'compatible',capability:'basic'});assert((await store.saveCompatibilityWorkspace(filedChanges,[],compatibilityWorkspaceBasis(store.data))).ok)
assert(saleQuery(store.data,filedScope).candidates.some(c=>c.id===filedSkuId));assert(!saleQuery(store.data,filedScope).candidates.some(c=>c.id===filedMat.id));assert.deepEqual(store.data.skus.find(s=>s.id===filedMat.id),filedMat);assert.equal(store.data.families.find(f=>f.id===filedFamily)!.line,'v3')
mark('回归修复：物料建档的 SPU 可见可加入，0销售规格可配置；追加真实SKU后正常选购，MAT身份与原档保持')
const blankScope={mode:'free' as const,categoryId:'c-phone',productTypeIds:['pt-phone','pt-case','pt-film','pt-leaf-c-charge'],commonSpuIds:[filedFamily],device:scope.device},blankLines=['demo18-sku-case-1','demo18-sku-film-1','demo18-sku-charger-1'].map(skuId=>({skuId,quantity:1,unitPriceCents:null}))
const blankDraft=await store.saveBundleSale({id:'',scope:blankScope,lines:blankLines,status:'draft'},0);assert(blankDraft.ok);assert('record'in blankDraft);assert(blankDraft.record.lines.every(l=>l.unitPriceCents===null));const beforeUnpriced=store.exportJson(),diskBeforeUnpriced=disk.get(STORAGE_KEY);assert(!(await store.saveBundleSale({...blankDraft.record,status:'confirmed'},blankDraft.record.revision)).ok);assert.equal(store.exportJson(),beforeUnpriced);assert.equal(disk.get(STORAGE_KEY),diskBeforeUnpriced);const zeroConfirmed=await store.saveBundleSale({...blankDraft.record,lines:blankLines.map(l=>({...l,unitPriceCents:0})),status:'confirmed'},blankDraft.record.revision);assert(zeroConfirmed.ok)
mark('未报价三项允许保存草稿；空报价不自动作0元；确认拒绝缺报价且不写入，明确填0元才可确认')
const persisted=JSON.parse(disk.get(STORAGE_KEY)!).data;store.$dispose();setActivePinia(createPinia());const reloaded=useCatalogStore();await reloaded.waitForPersistence();assert.equal(core(reloaded.data),core(persisted));assert.deepEqual(reloaded.data.benefitTypeGroups,persisted.benefitTypeGroups);assert.deepEqual(reloaded.data.benefitSalesLists,persisted.benefitSalesLists);assert.deepEqual(reloaded.data.publicSpuPool,persisted.publicSpuPool);reloaded.$dispose()
mark('T21 刷新重载不修复、不迁移、不重算已有业务记录')
