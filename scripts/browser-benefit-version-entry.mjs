import assert from 'node:assert/strict'
import {resolve} from 'node:path'
import {createServer} from 'vite'
import {chromium} from 'playwright-core'
import {createTestRuntime,removeTestRuntime} from './test-runtime.mjs'

const runtime=createTestRuntime('benefit-version-entry'),errors=[]
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

  await page.evaluate(async()=>{
    const store=(await import('/src/stores/catalog.ts')).useCatalogStore()
    const m=await import('/src/domain/benefitPackages.ts')
    store.data.benefitPackages=[1,2,undefined,99].map((v,i)=>{
      let p=m.addBenefitSku(store.data,m.newBenefitPackageDraft({kind:'sku',skuId:'phone-a'}),'case-sku',2)
      p.compositionVersion=v
      if(v!==99)p=m.reviewBenefitQuote(p,store.data)
      return {...p,id:'version-'+i,code:'VERSION-'+i,name:'版本测试 '+i,status:'available',revision:1}
    })
  })
  const row=i=>page.locator(`[data-benefit-member-package="version-${i}"]`)
  const original=await page.evaluate(async()=>JSON.stringify((await import('/src/stores/catalog.ts')).useCatalogStore().data.benefitPackages))
  for(const i of [0,2]){
    assert.match(await row(i).innerText(),/本规格 × 2/)
    assert.match(await row(i).innerText(),/此版本请通过高级详情查看或复制/)
    assert.equal(await row(i).getByRole('button',{name:'使用此组合',exact:true}).count(),0)
    assert.equal(await row(i).getByRole('button',{name:'高级复制',exact:true}).count(),1)
  }
  assert.equal(await row(3).getByRole('button',{name:'高级复制',exact:true}).count(),0)
  await row(0).getByRole('button',{name:'查看权益包',exact:true}).click()
  await page.waitForURL(/benefit-packages\/version-0/)
  await page.getByRole('button',{name:'返回原页面',exact:true}).click();await panel().waitFor()
  await row(0).getByRole('button',{name:'高级复制',exact:true}).click()
  await page.waitForURL(/benefit-packages\/new\?copy=version-0/)
  assert.match(new URL(page.url()).searchParams.get('returnTo'),/relatedSku=case-sku/)
  const draft=await page.evaluate(()=>window.state('[data-benefit-editor]','BenefitPackageEditView').draft)
  assert.equal(draft.id,'');assert.equal(draft.compositionVersion,1);assert.equal(draft.goods[0].quantity,2)
  await page.getByRole('button',{name:'返回原页面',exact:true}).click();await panel().waitFor()
  assert.equal(await page.evaluate(async()=>JSON.stringify((await import('/src/stores/catalog.ts')).useCatalogStore().data.benefitPackages)),original)
  // Invoke the displayed action with a stale ID after its source changes.
  await page.evaluate(async()=>{
    const store=(await import('/src/stores/catalog.ts')).useCatalogStore()
    store.data.benefitPackages.find(p=>p.id==='version-1').compositionVersion=1
    window.state('[data-product-benefit-relations]','ProductBenefitRelations').usePackage('version-1')
  })
  assert.match(new URL(page.url()).pathname,/spus/)
  await page.evaluate(async()=>{(await import('/src/stores/catalog.ts')).useCatalogStore().data.benefitPackages.find(p=>p.id==='version-1').compositionVersion=2})
  await row(1).getByRole('button',{name:'使用此组合',exact:true}).click()
  await page.locator('[data-sales-shopping]').waitFor();await idle()
  const next=await page.evaluate(()=>window.state('[data-sales-shopping]','SalesShoppingView').draft)
  assert.equal(next.compositionVersion,2);assert.notEqual(next.id,'version-1');assert.equal(next.goods[0].quantity,2)
  assert.doesNotMatch(await page.locator('body').innerText(),/此方案版本暂不支持/)
  assert.deepEqual(errors,[])
  console.log('PASS legacy/missing/unknown buttons, advanced view/copy + product return, unchanged originals, stale action guard, v2 shopping')
  await context.close()
}catch(error){console.error(error);if(page)console.error((await page.locator('body').innerText()).slice(-2500));process.exitCode=1}
finally{if(browser)await browser.close();if(server)await server.close();removeTestRuntime(runtime)}
