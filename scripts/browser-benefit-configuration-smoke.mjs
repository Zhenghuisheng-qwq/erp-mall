import assert from 'node:assert/strict'
import {resolve} from 'node:path'
import {createServer} from 'vite'
import {chromium} from 'playwright-core'
import {createTestRuntime,removeTestRuntime} from './test-runtime.mjs'
const runtime=createTestRuntime('benefit-configuration-smoke'),errors=[]
let server,browser,page
try{
 server=await createServer({cacheDir:resolve(runtime,'vite'),logLevel:'error',define:{'import.meta.env.VITE_RBAC_ENFORCEMENT':JSON.stringify('true')},server:{host:'127.0.0.1',port:0,watch:null,hmr:false,ws:false}})
 const {createSalesConfigurationFixture}=await server.ssrLoadModule('/scripts/sales-configuration-fixtures.ts'),{DATA_VERSION}=await server.ssrLoadModule('/src/domain/types.ts'),{normalizeStored}=await server.ssrLoadModule('/src/stores/catalog.ts'),{permissionRegistry}=await server.ssrLoadModule('/src/domain/rbac.ts')
 const f=createSalesConfigurationFixture(),{data,modelId,versionId,phoneIds}=f,phone=phoneIds[0]
 data.salesOptionPlans=data.salesOptionPlans.filter(item=>item.id!==f.phonePlan.id);data.salesOptionBindings=data.salesOptionBindings.filter(item=>item.id!==f.phoneBinding.id)
 const benefit=await server.ssrLoadModule('/src/domain/benefitPackages.ts')
 const history={...benefit.newBenefitPackageDraft(),id:'history-package',code:'BPK-HISTORY',name:'保留的历史权益包',revision:1,status:'available',createdAt:f.now,updatedAt:f.now,services:[{id:'history-service',name:'历史服务',quantity:1,unit:'项',measurement:'per-package',validity:'一年',description:'既有约定'}]}
 data.benefitPackages=[history];const delivery=benefit.previewBenefitDelivery(data,history,1);assert(delivery.canConfirm);data.benefitDeliveries=[benefit.createBenefitDeliverySnapshot(delivery,{id:'history-delivery',code:'BDL-HISTORY',requestId:'history-request',generatedAt:f.now})]
 for(const [id,codes]of [['config-reader',permissionRegistry().filter(item=>item.code.endsWith(':read')).map(item=>item.code)],['config-editor',permissionRegistry().filter(item=>item.code.endsWith(':read')||['product:sales-config:create','product:sales-config:update'].includes(item.code)).map(item=>item.code)]]){data.rbac.roles.push({id,code:id,name:id,description:'isolated smoke',enabled:true,permissionCodes:codes});data.users.push({id,username:id,displayName:id,enabled:true,role:'operator',roleIds:[id]})}
 const seed=normalizeStored({version:DATA_VERSION,data});await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`
 browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1700,height:1100},locale:'zh-CN',reducedMotion:'reduce'})
 await context.addInitScript(({data,version})=>{if(location.protocol!=='http:')return;if(!localStorage.getItem('iyge-v2-mock-db'))localStorage.setItem('iyge-v2-mock-db',JSON.stringify({version,data}));if(!sessionStorage.getItem('iyge-rbac-simulated-user'))sessionStorage.setItem('iyge-rbac-simulated-user','u-admin');window.state=(selector,name)=>{let instance=document.querySelector(selector)?.__vueParentComponent;while(instance&&instance.type.__name!==name)instance=instance.parent;if(!instance)throw Error(`${name} missing`);return instance.setupState};const set=Storage.prototype.setItem;window.__writes=0;Storage.prototype.setItem=function(key,value){if(key==='iyge-v2-mock-db'){if(window.__quota)throw Error('isolated UI quota');window.__writes++}return set.call(this,key,value)}},{data:seed,version:DATA_VERSION})
 page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(String(error)))
 const settle=async()=>page.evaluate(async()=>{await(await import('/src/stores/catalog.ts')).useCatalogStore().waitForPersistence();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))})
 const go=async path=>{if(page.url()==='about:blank')await page.goto(base+path,{waitUntil:'networkidle'});else await page.evaluate(path=>document.querySelector('#app').__vue_app__.config.globalProperties.$router.push(path),path);await settle()}
 const raw=()=>page.evaluate(()=>localStorage.getItem('iyge-v2-mock-db')),workspace=()=>page.locator('[data-benefit-configuration-workspace]')
 const ws=expression=>page.evaluate(expression)
 async function select(label,option,root=workspace()){await root.locator('.el-select').filter({has:page.getByRole('combobox',{name:label,exact:true})}).locator('.el-select__wrapper').click();await page.getByRole('option',{name:option,exact:typeof option==='string'}).last().click();await page.keyboard.press('Escape');await settle()}
 const step=async index=>{await workspace().locator(`[data-config-step="${index}"]`).click();await settle()}
 const snapshot=()=>page.evaluate(()=>{const d=JSON.parse(localStorage.getItem('iyge-v2-mock-db')).data;return JSON.stringify([d.benefitPackages.filter(item=>item.id==='history-package'),d.benefitDeliveries,d.specModelVersions,d.skus,d.planningRecords,d.compatibilities])})

 // A: actual model detail → draft products/services → private trial → atomic publish → actual shopping.
 await go(`/catalog?view=models&modelId=${modelId}&version=${versionId}`);await page.locator('[data-catalog-model-sales-edit]').click();await workspace().waitFor()
 assert.equal(await ws(()=>window.state('[data-benefit-configuration-workspace]','SalesConfigurationWorkspace').binding.scope.versionId),versionId)
 assert(await ws(()=>window.state('[data-benefit-configuration-workspace]','SalesConfigurationWorkspace').scopePreview.skuCount)>0)
 await workspace().getByRole('textbox',{name:'权益包配置名称',exact:true}).fill('管理员连续配置')
 await step(1)
 for(const [name,type]of [['手机壳','type-case'],['保护膜','type-film']]){
  await workspace().locator('[data-sales-add-item]').click();const item=workspace().locator('[data-sales-option-item]').last();await item.getByRole('textbox').first().fill(name);await select('候选范围',new RegExp(type),item)
 }
 await workspace().locator('[data-sales-add-service]').click();await workspace().locator('[data-sales-option-item]').last().getByRole('textbox').first().fill('延保服务')
 await select('配置试选来源 SKU',/SALE-PHONE-0/);await select('配置试选使用设备',/SALE-PHONE-0/)
 const beforePreview=await raw(),historic=await snapshot();await workspace().locator('[data-config-refresh-preview]').click();await workspace().locator('[data-config-candidate]').first().waitFor();assert.equal(await raw(),beforePreview)
 assert.match(await workspace().locator('[data-config-preview-version]').innerText(),/未发布/)
 const trial=workspace().locator('[data-config-candidate]').filter({hasText:'延保服务'}).first();await trial.getByRole('button',{name:'模拟加入',exact:true}).click();assert.equal(await ws(()=>window.state('[data-benefit-configuration-workspace]','SalesConfigurationWorkspace').selection.services.length),1);assert.equal(await raw(),beforePreview)
 await workspace().locator('[data-config-save-working]').click();await step(3);await workspace().locator('[data-config-review]').click()
 assert.deepEqual(await ws(()=>window.state('[data-benefit-configuration-workspace]','SalesConfigurationWorkspace').review.problems),[])
 await workspace().locator('[data-config-confirm-publish]').click();await page.waitForFunction(()=>window.state('[data-benefit-configuration-workspace]','SalesConfigurationWorkspace').notice.includes('正式结果已生效'))
 const saved=await ws(()=>{const s=window.state('[data-benefit-configuration-workspace]','SalesConfigurationWorkspace');return {planId:s.plan.id,bindingId:s.binding.id}});assert(saved.planId&&saved.bindingId)
 await go(`/sales-configurations?configure=1&planId=${saved.planId}&bindingId=${saved.bindingId}`);await page.reload({waitUntil:'networkidle'});await workspace().waitFor();assert.equal(await ws(()=>window.state('[data-benefit-configuration-workspace]','SalesConfigurationWorkspace').plan.id),saved.planId)
 await select('配置试选来源 SKU',/SALE-PHONE-0/);await select('配置试选使用设备',/SALE-PHONE-0/);
 // A radio is a plain Element Plus label, choose it directly.
 await workspace().getByText('当前已生效',{exact:true}).click();await workspace().locator('[data-config-refresh-preview]').click()
 const expected=await ws(()=>window.state('[data-benefit-configuration-workspace]','SalesConfigurationWorkspace').simulation.query.rows.map(row=>[row.item.id,row.skuId||'service',row.status,row.canAdd]).sort())
 await workspace().getByRole('button',{name:'返回',exact:true}).click();await go(`/sales-shopping?sku=${phone}`)
 await page.getByRole('button',{name:'用作本次使用设备',exact:true}).click();await settle()
 const actual=await ws(()=>window.state('[data-sales-shopping]','SalesShoppingView').candidates.rows.map(row=>[row.item.id,row.skuId||'service',row.status,row.canAdd]).sort())
 assert.deepEqual(actual,expected);assert.equal(await snapshot(),historic);console.log('PASS A: model context, goods+service draft trial without writes, publish/apply once, refreshed formal config and actual shopping candidates agree')

 // B: isolated second reference; only the explicitly edited binding upgrades, quota rolls all formal data back.
 await page.evaluate(async({saved,phone})=>{const store=(await import('/src/stores/catalog.ts')).useCatalogStore(),{previewSalesBinding}=await import('/src/domain/salesConfiguration.ts');const binding={schemaVersion:1,id:'',revision:0,name:'保留原版本范围',enabled:true,scope:{kind:'products',familyIds:[],skuIds:[phone]},mode:'replace',planId:saved.planId,planVersion:1,source:'isolated smoke',updatedAt:''};const result=await store.saveSalesOptionBinding({draft:binding,expectedRevision:0,expectedBasis:previewSalesBinding(store.data,binding).stamp,requestId:'smoke-extra-binding'});if(!result.ok)throw Error(result.message)}, {saved,phone:phoneIds[1]})
 const preserved=JSON.parse(await raw()).data.salesOptionBindings.find(item=>item.name==='保留原版本范围'),beforeHistory=await snapshot()
 await settle();await page.waitForFunction(()=>!window.state('[data-sales-shopping]','SalesShoppingView').businessPending)
 await page.goto(`${base}/sales-configurations?configure=1&planId=${saved.planId}&bindingId=${saved.bindingId}`,{waitUntil:'networkidle'});await workspace().waitFor();await workspace().getByRole('textbox',{name:'权益包配置名称',exact:true}).fill('共享配置本次修改');await workspace().locator('[data-config-save-working]').click();await step(3);await workspace().locator('[data-config-review]').click();assert.equal(await ws(()=>window.state('[data-benefit-configuration-workspace]','SalesConfigurationWorkspace').review.keptCount),1)
 const beforeFailure=await raw();await page.evaluate(()=>window.__quota=true);await workspace().locator('[data-config-confirm-publish]').click();await workspace().locator('[data-config-error]').waitFor();assert.equal(await raw(),beforeFailure);assert.equal(await ws(()=>window.state('[data-benefit-configuration-workspace]','SalesConfigurationWorkspace').plan.name),'共享配置本次修改')
 await page.evaluate(()=>window.__quota=false);await workspace().locator('[data-config-confirm-publish]').click();await page.waitForFunction(()=>window.state('[data-benefit-configuration-workspace]','SalesConfigurationWorkspace').notice.includes('正式结果已生效'))
 const after=JSON.parse(await raw()).data;assert.deepEqual(after.salesOptionBindings.find(item=>item.id===preserved.id),preserved);assert.equal(after.salesOptionBindings.find(item=>item.id===saved.bindingId).planVersion,2);assert.equal(await snapshot(),beforeHistory);console.log('PASS B: selected shared binding upgrades, other V1 and real historical delivery unchanged, quota failure has no partial formal changes and retry succeeds')

 // C: exact compatibility return, separate navigation tabs and readonly/no-publish guards.
 await step(0);await workspace().getByRole('textbox',{name:'权益包配置名称',exact:true}).fill('返回后继续的输入');await select('配置试选来源 SKU',/SALE-PHONE-0/);await select('配置试选使用设备',/SALE-PHONE-0/);await workspace().locator('[data-config-refresh-preview]').click()
 const scope=await ws(()=>JSON.stringify(window.state('[data-benefit-configuration-workspace]','SalesConfigurationWorkspace').binding.scope))
 const target=workspace().locator('[data-config-candidate]').filter({has:page.getByRole('button',{name:'维护兼容性',exact:true})}).first();await target.getByRole('button',{name:'维护兼容性',exact:true}).click();await page.waitForURL(/\/compatibility\?.*tab=workbench/);assert(new URL(page.url()).searchParams.get('targetId'))
 await page.locator('[data-compatibility-return]').click();await workspace().waitFor();assert.equal(await ws(()=>window.state('[data-benefit-configuration-workspace]','SalesConfigurationWorkspace').plan.name),'返回后继续的输入');assert.equal(await ws(()=>JSON.stringify(window.state('[data-benefit-configuration-workspace]','SalesConfigurationWorkspace').binding.scope)),scope);assert.equal(await ws(()=>window.state('[data-benefit-configuration-workspace]','SalesConfigurationWorkspace').sourceSkuId),phone)
 await workspace().locator('[data-config-save-working]').click();await workspace().getByRole('button',{name:'返回',exact:true}).click()
 await go('/compatibility?tab=results');assert.equal(await page.getByRole('tab',{name:'兼容性查询',exact:true}).getAttribute('aria-selected'),'true');await page.getByRole('tab',{name:'兼容性维护',exact:true}).click();assert.equal(new URL(page.url()).searchParams.get('tab'),'workbench');await page.goBack();assert.equal(new URL(page.url()).searchParams.get('tab'),'results')
 await page.evaluate(async()=>{(await import('/src/stores/catalog.ts')).useCatalogStore().startPermissionPreview('config-reader')});await go(`/sales-configurations?configure=1&planId=${saved.planId}&bindingId=${saved.bindingId}`);await workspace().waitFor();assert.equal(await workspace().locator('[data-config-save-working]').count(),0);assert.equal(await workspace().locator('[data-config-confirm-publish]').count(),0)
 await page.evaluate(async()=>{const store=(await import('/src/stores/catalog.ts')).useCatalogStore();store.stopPermissionPreview();store.startPermissionPreview('config-editor')});await go(`/sales-configurations?configure=1&planId=${saved.planId}&bindingId=${saved.bindingId}&readonly=0`);await workspace().waitFor();assert.equal(await workspace().locator('[data-config-confirm-publish]').count(),0)
 const guarded=await raw();const denied=await page.evaluate(async saved=>{const store=(await import('/src/stores/catalog.ts')).useCatalogStore(),{salesConfigurationCommitBasis}=await import('/src/domain/salesConfigurationCommands.ts');try{return await store.commitSalesConfiguration({planDraft:JSON.parse(JSON.stringify(store.data.salesOptionPlans.find(item=>item.id===saved.planId))),expectedPlanRevision:store.data.salesOptionPlans.find(item=>item.id===saved.planId).revision,bindings:[],expectedRevisions:{},expectedBasis:salesConfigurationCommitBasis(store.data),action:'publish-only',requestId:'forbidden-ui-request'})}catch(error){return {ok:false,message:String(error)}}},saved);assert.equal(denied.ok,false);assert.equal(await raw(),guarded)
 console.log('PASS C: compatibility query/maintenance routes and precise target return preserve inputs/scope/sample; readonly and no-publish UI/Store refuse formal changes')
 assert.deepEqual(errors,[]);await context.close()
}catch(error){console.error(error);if(page)console.error((await page.locator('body').innerText()).slice(0,5500));process.exitCode=1}
finally{if(browser)await browser.close();if(server)await server.close();removeTestRuntime(runtime)}
