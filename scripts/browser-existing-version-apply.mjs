import assert from 'node:assert/strict'
import {resolve} from 'node:path'
import {createServer} from 'vite'
import {chromium} from 'playwright-core'
import {createTestRuntime,removeTestRuntime} from './test-runtime.mjs'
const runtime=createTestRuntime('existing-version-apply'),errors=[]
let server,browser,page
try{
 server=await createServer({cacheDir:resolve(runtime,'vite'),logLevel:'error',define:{'import.meta.env.VITE_RBAC_ENFORCEMENT':JSON.stringify('true')},server:{host:'127.0.0.1',port:0,watch:null,hmr:false,ws:false}})
 const {createSalesConfigurationFixture}=await server.ssrLoadModule('/scripts/sales-configuration-fixtures.ts'),{DATA_VERSION}=await server.ssrLoadModule('/src/domain/types.ts'),{normalizeStored}=await server.ssrLoadModule('/src/stores/catalog.ts')
 const fixture=createSalesConfigurationFixture()
 Object.assign(fixture.phoneBinding,{mode:'replace',scope:{kind:'products',familyIds:[],skuIds:['phone-a']}})
 fixture.data.salesOptionBindings.push({...structuredClone(fixture.phoneBinding),id:'kept-case-scope',name:'保留原版本的其他范围',mode:'replace',scope:{kind:'products',familyIds:[],skuIds:['case-sku']}})
 const seed=normalizeStored({version:DATA_VERSION,data:fixture.data})
 await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`
 browser=await chromium.launch({channel:'chrome',headless:true})
 const context=await browser.newContext({viewport:{width:1700,height:1100},locale:'zh-CN',reducedMotion:'reduce'})
 await context.addInitScript(({data,version})=>{if(location.protocol!=='http:')return;if(!localStorage.getItem('iyge-v2-mock-db'))localStorage.setItem('iyge-v2-mock-db',JSON.stringify({version,data}));sessionStorage.setItem('iyge-rbac-simulated-user','u-admin');window.state=(selector,name)=>{let instance=document.querySelector(selector)?.__vueParentComponent;while(instance&&instance.type.__name!==name)instance=instance.parent;if(!instance)throw Error(`${name} missing`);return instance.setupState}},{data:seed,version:DATA_VERSION})
 page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(String(error)))
 const workspace=()=>page.locator('[data-benefit-configuration-workspace]'),raw=()=>page.evaluate(()=>localStorage.getItem('iyge-v2-mock-db'))
 const settle=()=>page.evaluate(async()=>{await(await import('/src/stores/catalog.ts')).useCatalogStore().waitForPersistence();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))})
 const state=expression=>page.evaluate(expression)
 const step=async number=>{await workspace().locator(`[data-config-step="${number}"]`).click();await settle()}
 async function select(label,option){await workspace().locator('.el-select').filter({has:page.getByRole('combobox',{name:label,exact:true})}).locator('.el-select__wrapper').click();await page.getByRole('option',{name:option,exact:typeof option==='string'}).last().click();await page.keyboard.press('Escape');await settle()}
 const {phonePlan,phoneBinding}=fixture,name='仅保留的未发布服务'
 await page.goto(`${base}/sales-configurations?configure=1&planId=${phonePlan.id}&bindingId=${phoneBinding.id}`,{waitUntil:'networkidle'});await workspace().waitFor();await step(1)
 await workspace().locator('[data-sales-add-service]').click();await workspace().locator('[data-sales-option-item]').last().getByRole('textbox').first().fill(name)
 // An earlier multi-scope choice must not leak into the single-scope close action.
 await step(3);await workspace().locator('.el-checkbox-group .el-checkbox').first().click()
 assert.equal(await state(()=>window.state('[data-benefit-configuration-workspace]','SalesConfigurationWorkspace').selectedBindingIds.length),1)
 await step(0);await select('配置范围使用方式','这个范围不显示权益包选项');await step(3)
 await select('配置试选来源 SKU',/SALE-PHONE-0/);await workspace().locator('[data-config-refresh-preview]').click()
 assert.equal(await state(()=>window.state('[data-benefit-configuration-workspace]','SalesConfigurationWorkspace').simulation.bindings.length),1)
 await workspace().locator('[data-config-review]').click()
 assert.equal(await state(()=>window.state('[data-benefit-configuration-workspace]','SalesConfigurationWorkspace').review.bindingCount),1)
 assert.deepEqual(await state(()=>window.state('[data-benefit-configuration-workspace]','SalesConfigurationWorkspace').review.problems),[])
 const kept=JSON.parse(await raw()).data.salesOptionBindings.find(item=>item.id==='kept-case-scope')
 await workspace().locator('[data-config-confirm-publish]').click();await page.waitForFunction(()=>window.state('[data-benefit-configuration-workspace]','SalesConfigurationWorkspace').notice.includes('正式结果已生效'))
 assert.deepEqual(JSON.parse(await raw()).data.salesOptionBindings.find(item=>item.id==='kept-case-scope'),kept)
 assert.equal(JSON.parse(await raw()).data.salesOptionBindings.find(item=>item.id==='sales-binding-phone').mode,'none')
 await step(0);await select('配置范围使用方式','这个明确范围单独设置')
 await workspace().locator('[data-config-save-working]').click();await settle()
 await step(3);await workspace().locator('.el-radio').filter({hasText:'应用已有发布版本'}).click();await select('采用配置发布版本',/^配置 v1 /)
 await workspace().getByText('指定版本应用效果',{exact:true}).click()
 await select('配置试选来源 SKU',/SALE-PHONE-0/);await select('配置试选使用设备',/SALE-PHONE-0/)
 const beforePreview=await raw();await workspace().locator('[data-config-refresh-preview]').click();await workspace().locator('[data-config-preview-version]').waitFor()
 assert.match(await workspace().locator('[data-config-preview-version]').innerText(),/冻结版本 v1/)
 assert.equal(await workspace().locator('[data-config-candidate]').filter({hasText:name}).count(),0)
 assert.equal(await state(()=>window.state('[data-benefit-configuration-workspace]','SalesConfigurationWorkspace').simulation.query.resolution.plan.version),1)
 assert.equal(await raw(),beforePreview)
 await workspace().locator('[data-config-review]').click();assert.deepEqual(await state(()=>window.state('[data-benefit-configuration-workspace]','SalesConfigurationWorkspace').review.problems),[])
 assert.equal((await workspace().locator('[data-config-impact]').innerText()).includes(`新增项目 ${name}`),false)
 await workspace().locator('[data-config-confirm-publish]').click();await page.waitForFunction(()=>window.state('[data-benefit-configuration-workspace]','SalesConfigurationWorkspace').notice.includes('未发布项目输入继续保留'))
 const formal=JSON.parse(await raw()).data,stored=formal.salesOptionPlans.find(item=>item.id===phonePlan.id),applied=formal.salesOptionBindings.find(item=>item.id===phoneBinding.id)
 assert.equal(stored.versions.length,1);assert.equal(applied.planVersion,1);assert.equal(stored.items.some(item=>item.name===name),false)
 await step(1);assert(await workspace().locator('[data-sales-option-item]').filter({has:page.getByRole('textbox',{name:/选配项目.*名称/})}).count()>0)
 assert.equal(await workspace().locator('[data-sales-option-item] input').evaluateAll((inputs,name)=>inputs.some(input=>input.value===name),name),true)
 const copy=await page.evaluate(async id=>(await import('/src/stores/catalog.ts')).useCatalogStore().getSalesBindingWorkingCopy(id).copy,phoneBinding.id)
 assert(copy?.planDraft.items.some(item=>item.name===name));assert.equal(copy.baseRevision,applied.revision)
 await workspace().getByRole('button',{name:'返回',exact:true}).click();await workspace().waitFor({state:'hidden'})
 const copies=page.locator('.working-copies');await copies.locator('summary').click();await copies.getByRole('button',{name:'继续此工作草稿',exact:true}).first().click();await workspace().waitFor();await step(1)
 assert.equal(await workspace().locator('[data-sales-option-item] input').evaluateAll((inputs,name)=>inputs.some(input=>input.value===name),name),true)
 assert.equal(await state(()=>window.state('[data-benefit-configuration-workspace]','SalesConfigurationWorkspace').publishAction),'apply-existing')
 assert.equal(await state(()=>window.state('[data-benefit-configuration-workspace]','SalesConfigurationWorkspace').existingVersion),1)
 await workspace().getByRole('button',{name:'返回',exact:true}).click();await workspace().waitFor({state:'hidden'})
 const beforeRead=await raw()
 await page.evaluate(path=>document.querySelector('#app').__vue_app__.config.globalProperties.$router.push(path),`/sales-configurations?configure=1&readonly=1&planId=${phonePlan.id}&bindingId=${phoneBinding.id}&planVersion=1`)
 await workspace().waitFor();await step(1)
 assert.equal(await workspace().locator('[data-sales-option-item] input').evaluateAll((inputs,name)=>inputs.some(input=>input.value===name),name),false)
 assert.equal(await workspace().locator('[data-sales-option-item]').count(),phonePlan.versions[0].items.length)
 assert.equal(await raw(),beforeRead);assert.deepEqual(errors,[])
 console.log('PASS existing-version UI: closing one scope excludes earlier multi-scope selection; frozen V1 preview/review/apply excludes unpublished service, no new version; editable input persists and explicitly resumes; readonly V1 shows frozen projects without business writes')
 await context.close()
}catch(error){console.error(error);if(page)console.error((await page.locator('body').innerText()).slice(0,4500));process.exitCode=1}
finally{if(browser)await browser.close();if(server)await server.close();removeTestRuntime(runtime)}
