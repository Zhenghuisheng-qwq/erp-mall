import assert from 'node:assert/strict'
import {resolve} from 'node:path'
import {createServer} from 'vite'
import {chromium} from 'playwright-core'
import {createTestRuntime,removeTestRuntime} from './test-runtime.mjs'
const runtime=createTestRuntime('sales-scope-repair'),errors=[]
let browser,server,page,groups=0
const mark=name=>{groups++;console.log(`PASS ${name}`)}
try{
 browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true})
 for(const strict of process.env.SCOPE_STRICT?[process.env.SCOPE_STRICT==='true']:[false,true]){
  server=await createServer({cacheDir:resolve(runtime,String(strict)),logLevel:'error',define:{'import.meta.env.VITE_RBAC_ENFORCEMENT':JSON.stringify(String(strict))},server:{host:'127.0.0.1',port:0,watch:null,hmr:false,ws:false}})
  const {createSalesConfigurationFixture}=await server.ssrLoadModule('/scripts/sales-configuration-fixtures.ts'),{selectorForCombination}=await server.ssrLoadModule('/src/domain/templateCompatibility.ts'),{DATA_VERSION}=await server.ssrLoadModule('/src/domain/types.ts')
  const f=createSalesConfigurationFixture(),{data}=f,combos=f.context.combinations
  const first=combos.find(combo=>combo.steps.some(step=>step.valueNodeId==='compat-style-0')&&combo.steps.some(step=>step.valueNodeId==='compat-color-0-0')&&combo.steps.some(step=>step.valueNodeId==='compat-pack-0'))
  const second=combos.find(combo=>combo.steps.some(step=>step.valueNodeId==='compat-style-0')&&combo.steps.some(step=>step.valueNodeId==='compat-color-0-1')&&combo.steps.some(step=>step.valueNodeId==='compat-pack-1'))
  assert(first&&second)
  const selector={anyOf:[...selectorForCombination(first).anyOf,...selectorForCombination(second).anyOf]}
  f.phonePlan.versions.push({...structuredClone(f.phonePlan.versions[0]),version:2,name:'手机日常选配 V2'});f.phonePlan.publishedVersion=2
  data.salesOptionBindings.push({...structuredClone(f.phoneBinding),id:'scope-diagonal',name:'两条关联规格',enabled:false,mode:'replace',scope:{kind:'model',modelId:f.modelId,versionId:f.versionId,selector}})
  await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`
  const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN',reducedMotion:'reduce'})
  await context.addInitScript(({data,version})=>{if(location.protocol==='http:'&&!localStorage.getItem('iyge-v2-mock-db'))localStorage.setItem('iyge-v2-mock-db',JSON.stringify({version,data}));const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='iyge-v2-mock-db'&&window.__quota)throw new DOMException('scope quota','QuotaExceededError');return original.call(this,key,value)}},{data,version:DATA_VERSION})
  page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(String(error)))
  await page.goto(`${base}/sales-configurations`,{waitUntil:'networkidle'});await page.getByRole('tab',{name:'范围绑定',exact:true}).click();await page.getByRole('button',{name:'两条关联规格',exact:true}).click()
  assert.equal(await page.locator('[data-sales-legal-count]').innerText(),'2')
  // A correlated OR must reopen as its exact chosen specs, never as a Cartesian product.
  assert.equal(await page.getByRole('radio',{name:'完整合法规格',exact:true}).isChecked(),true)
  await page.getByRole('textbox',{name:'绑定名称',exact:true}).fill('两条关联规格改名');await page.getByRole('textbox',{name:'绑定配置来源',exact:true}).fill('更新来源，保留原OR')
  await page.locator('.el-select').filter({has:page.getByRole('combobox',{name:'选配方案版本',exact:true})}).locator('.el-select__wrapper').click();await page.getByRole('option',{name:'v2 · 手机日常选配 V2',exact:true}).click()
  await page.locator('[data-sales-save-binding-draft]').click();await page.locator('[data-sales-binding-dialog]').waitFor({state:'hidden'})
  const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('iyge-v2-mock-db')).data.salesOptionBindings.find(binding=>binding.id==='scope-diagonal'))
  assert.deepEqual((await saved()).scope.selector,selector);assert.equal((await saved()).scope.versionId,f.versionId);assert.equal((await saved()).planVersion,2);mark(`scope/${strict}: reopening and editing name/source/plan version preserves exact original selector and source publication`)
  await page.getByRole('button',{name:'两条关联规格改名',exact:true}).click()
  await page.getByRole('radio',{name:'属性值条件',exact:true}).locator('..').click();await page.locator('[data-sales-scope-proposal]').waitFor()
  assert.match(await page.locator('[data-sales-scope-proposal]').innerText(),/新增 2 条、移除 0 条/);assert.equal(await page.locator('[data-sales-legal-count]').innerText(),'2');assert(await page.locator('[data-sales-save-binding-draft]').isDisabled());assert(await page.locator('[data-sales-apply-binding]').isDisabled())
  await page.getByRole('button',{name:'保留完整规格',exact:true}).click();assert.equal(await page.locator('[data-sales-legal-count]').innerText(),'2');assert(await page.getByRole('radio',{name:'完整合法规格',exact:true}).isChecked())
  await page.getByRole('radio',{name:'属性值条件',exact:true}).locator('..').click();await page.getByRole('button',{name:'确认重新定义范围',exact:true}).click();assert.equal(await page.locator('[data-sales-legal-count]').innerText(),'4')
  await page.getByRole('button',{name:'关闭',exact:true}).last().click();await page.getByRole('button',{name:'放弃修改',exact:true}).click();assert.deepEqual((await saved()).scope.selector,selector)
  await page.getByRole('button',{name:'两条关联规格改名',exact:true}).click();assert.equal(await page.locator('[data-sales-legal-count]').innerText(),'2');assert(await page.getByRole('radio',{name:'完整合法规格',exact:true}).isChecked());mark(`scope/${strict}: method switch previews exact added/removed specs, cancel and dialog discard preserve persisted OR`)
  const select=page.locator('.el-select').filter({has:page.getByRole('combobox',{name:'完整合法规格范围',exact:true})})
  await select.locator('.el-select__wrapper').click();await page.getByRole('option',{name:first.label,exact:true}).click();await page.keyboard.press('Escape')
  assert.equal(await page.locator('[data-sales-legal-count]').innerText(),'1')
  const beforeFailure=await page.evaluate(()=>localStorage.getItem('iyge-v2-mock-db'));await page.evaluate(()=>window.__quota=true);await page.locator('[data-sales-save-binding-draft]').click();await page.locator('[data-sales-binding-dialog]').getByRole('alert').filter({hasText:/无法保存|scope quota/}).waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('iyge-v2-mock-db')),beforeFailure);assert.equal(await page.locator('[data-sales-legal-count]').innerText(),'1');await page.evaluate(()=>window.__quota=false)
  await page.locator('[data-sales-save-binding-draft]').click();await page.locator('[data-sales-binding-dialog]').waitFor({state:'hidden'})
  assert.deepEqual((await saved()).scope.selector,selectorForCombination(second));mark(`scope/${strict}: removing one chosen spec and retrying a failed save never introduces an unselected cross combination`)
  await context.close();await server.close();server=undefined
 }
 assert.deepEqual(errors,[]);console.log(`PASS sales scope browser ${groups} groups; no screenshots or persistent artifacts`)
}catch(error){console.error(error);process.exitCode=1}
finally{await browser?.close();await server?.close();removeTestRuntime(runtime)}
