import assert from 'node:assert/strict'
import {resolve} from 'node:path'
import {createServer} from 'vite'
import {chromium} from 'playwright-core'
import {createTestRuntime,removeTestRuntime} from './test-runtime.mjs'

const runtime=createTestRuntime('product-benefit-flow'),errors=[]
let server,browser,page
try{
  server=await createServer({cacheDir:resolve(runtime,'vite'),logLevel:'error',define:{'import.meta.env.VITE_RBAC_ENFORCEMENT':JSON.stringify('true')},server:{host:'127.0.0.1',port:0,watch:null,hmr:false,ws:false}})
  const {createSalesConfigurationFixture,salesTestItem}=await server.ssrLoadModule('/scripts/sales-configuration-fixtures.ts')
  const {DATA_VERSION}=await server.ssrLoadModule('/src/domain/types.ts'),{normalizeStored}=await server.ssrLoadModule('/src/stores/catalog.ts')
  const f=createSalesConfigurationFixture(),{data}=f,caseSku=data.skus.find(s=>s.id==='case-sku'),phone=data.skus.find(s=>s.id==='phone-a')
  phone.status='off_sale'
  f.casePlan.items.push(salesTestItem('service-choice','service'))
  f.casePlan.versions[0].items=structuredClone(f.casePlan.items)
  data.skus.push({...structuredClone(caseSku),id:'case-second',code:'CASE-SECOND',skuName:'第二个独立规格'})
  const seed=normalizeStored({version:DATA_VERSION,data})
  await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`
  browser=await chromium.launch({channel:'chrome',headless:true})
  const context=await browser.newContext({viewport:{width:1700,height:1100},locale:'zh-CN',reducedMotion:'reduce'})
  await context.addInitScript(({data,version})=>{
    if(location.protocol!=='http:')return
    if(!localStorage.getItem('iyge-v2-mock-db'))localStorage.setItem('iyge-v2-mock-db',JSON.stringify({version,data}))
    sessionStorage.setItem('iyge-rbac-simulated-user','u-admin')
    window.state=(selector,name)=>{let instance=document.querySelector(selector)?.__vueParentComponent;while(instance&&instance.type.__name!==name)instance=instance.parent;if(!instance)throw Error(`${name} missing`);return instance.setupState}
  },{data:seed,version:DATA_VERSION})
  page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(String(error)))
  const raw=()=>page.evaluate(()=>localStorage.getItem('iyge-v2-mock-db'))
  const settle=async()=>page.evaluate(async()=>{await(await import('/src/stores/catalog.ts')).useCatalogStore().waitForPersistence();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))})
  const idle=async()=>{await page.waitForFunction(()=>!window.state('[data-sales-shopping]','SalesShoppingView').businessPending);await settle()}
  const panel=()=>page.locator('[data-product-benefit-relations]')
  const protectedRows=d=>JSON.stringify([d.skus,d.families,d.salesOptionPlans,d.salesOptionBindings,d.specModelVersions,d.compatibilities,d.deviceBindings])
  await page.goto(`${base}/spus/${caseSku.familyId}?relatedSku=case-sku`,{waitUntil:'networkidle'});await panel().waitFor();await settle()
  const before=await raw(),protectedBefore=protectedRows(JSON.parse(before).data)
  assert.match(await panel().locator('[data-benefit-effective]').innerText(),/已生效/)
  assert.match(await panel().locator('[data-benefit-candidate-configurations]').innerText(),/手机日常选配/)
  assert.equal(await panel().locator('[data-benefit-member-package]').count(),0)
  await panel().locator('[data-benefit-spec-overview]').click()
  await panel().locator('[data-benefit-spec-overview-table]').getByRole('button').filter({hasText:'CASE-SECOND'}).click()
  assert.match(await panel().locator('[data-product-benefit-current]').innerText(),/第二个独立规格/)
  assert.match(await panel().locator('[data-benefit-effective]').innerText(),/未配置/)
  await panel().locator('[data-benefit-spec-overview-table]').getByRole('button').filter({hasText:'CASE-SKU'}).click()
  await settle();assert.equal(await raw(),before,'viewing and switching specifications must not write business data')
  await panel().locator('[data-product-benefit-shopping]').click();await page.locator('[data-sales-shopping]').waitFor();await idle()
  assert.equal(await page.evaluate(()=>window.state('[data-sales-shopping]','SalesShoppingView').draft.goods.length),0,'product entry must not add goods implicitly')
  await page.getByRole('button',{name:'选择已有手机',exact:true}).click()
  const deviceDialog=page.getByRole('dialog',{name:'选择使用设备',exact:true})
  const deviceLabel=await page.evaluate(async()=>{const store=(await import('/src/stores/catalog.ts')).useCatalogStore();const x=(await import('/src/domain/benefitPackages.ts')).benefitSkuSummary(store.data,'phone-a');return `${x.name} · ${x.spec}`})
  await deviceDialog.locator('.el-select__wrapper').click();await page.getByRole('option',{name:deviceLabel,exact:true}).last().click()
  await deviceDialog.getByRole('button',{name:'使用此设备',exact:true}).click();await idle()
  assert.equal(await page.evaluate(()=>window.state('[data-sales-shopping]','SalesShoppingView').draft.device.skuId),'phone-a')
  await page.locator('.source-trail').getByRole('button',{name:'【独立测试】case-sku',exact:true}).click()
  await page.locator('[data-sales-add-current="case-sku"]').click();await idle()
  const service=page.locator('[data-sales-candidate]').filter({hasText:'延保服务'}).first()
  await service.locator('[data-sales-add-candidate]').click();await idle()
  assert.deepEqual(await page.evaluate(()=>{const d=window.state('[data-sales-shopping]','SalesShoppingView').draft;return {goods:d.goods.map(x=>x.skuId),services:d.services.length}}),{goods:['case-sku'],services:1})
  await page.getByRole('button',{name:'填写报价',exact:true}).click()
  await page.getByRole('textbox',{name:'本次方案报价',exact:true}).fill('199')
  await page.getByRole('button',{name:'核对报价',exact:true}).click();await idle()
  await page.locator('[data-sales-save]').click();await idle()
  const savedId=await page.evaluate(()=>window.state('[data-sales-shopping]','SalesShoppingView').draft.id);assert(savedId)
  await page.locator('[data-sales-checkout]').click()
  const delivery=page.getByRole('dialog',{name:'核对交付清单',exact:true});await delivery.waitFor()
  await delivery.locator('.el-checkbox').filter({hasText:'已核对商品、数量、适用条件与报价'}).click()
  await delivery.locator('[data-sales-generate]').click();await page.waitForURL(/\/benefit-packages\/deliveries\//)
  await page.locator('[data-benefit-delivery-detail]').waitFor();await settle()
  const after=JSON.parse(await raw()).data
  assert.equal(protectedRows(after),protectedBefore,'shopping must not rewrite products, versions or compatibility')
  assert.equal(after.benefitDeliveries.length,1)
  assert.deepEqual(after.benefitPackages.find(x=>x.id===savedId).goods.map(x=>x.skuId),['case-sku'])
  const deliverySnapshot=JSON.stringify(after.benefitDeliveries)
  await page.getByRole('button',{name:'返回原页面',exact:true}).click();await panel().waitFor();await settle()
  assert.equal(new URL(page.url()).pathname,`/spus/${caseSku.familyId}`)
  assert.match(await panel().locator('[data-benefit-member-package]').innerText(),/本规格 × 1/)
  const readonlyBefore=await raw()
  await panel().locator('[data-benefit-spec-overview]').click()
  await panel().locator('[data-benefit-spec-overview-table]').getByRole('button').filter({hasText:'CASE-SECOND'}).click()
  assert.equal(await panel().locator('[data-benefit-member-package]').count(),0,'another SKU must not inherit saved membership')
  await panel().locator('[data-benefit-spec-overview-table]').getByRole('button').filter({hasText:'CASE-SKU'}).click()
  await settle();assert.equal(await raw(),readonlyBefore);assert.equal(JSON.stringify(JSON.parse(await raw()).data.benefitDeliveries),deliverySnapshot)
  // Same read-only component in the concrete SKU detail.
  await page.evaluate(()=>document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/skus/case-sku'))
  await panel().waitFor();assert.equal(await panel().locator('[data-benefit-member-package]').count(),1)
  assert.deepEqual(errors,[])
  console.log('PASS product → read-only three relations / SPU spec switch → explicit goods + service with off-sale device → quote → save → delivery → return / exact SKU reverse lookup; frozen records unchanged')
  await context.close()
}catch(error){console.error(error);if(page)console.error((await page.locator('body').innerText()).slice(-6500));process.exitCode=1}
finally{if(browser)await browser.close();if(server)await server.close();removeTestRuntime(runtime)}
