import assert from 'node:assert/strict'
import {resolve} from 'node:path'
import {createServer} from 'vite'
import {chromium} from 'playwright-core'
import {createTestRuntime,removeTestRuntime} from './test-runtime.mjs'
const runtime=createTestRuntime('general-compatibility'),errors=[]
let server,browser,page,blockReload=false,unloadDialogs=0
try{
 server=await createServer({cacheDir:resolve(runtime,'cache'),logLevel:'error',define:{'import.meta.env.VITE_RBAC_ENFORCEMENT':JSON.stringify('true')},server:{host:'127.0.0.1',port:0,hmr:false,watch:null,ws:false}})
 const {generalFixture}=await server.ssrLoadModule('/scripts/type-bundle-fixture.ts'),{DATA_VERSION}=await server.ssrLoadModule('/src/domain/types.ts'),{data}=generalFixture()
 await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`
 browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN'})
 await context.addInitScript(({data,version})=>{if(location.protocol!=='http:')return;if(!localStorage.getItem('iyge-v2-mock-db'))localStorage.setItem('iyge-v2-mock-db',JSON.stringify({version,data}));if(!sessionStorage.getItem('iyge-rbac-simulated-user'))sessionStorage.setItem('iyge-rbac-simulated-user','u-admin');const native=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='iyge-v2-mock-db'&&window.__quota){window.__quota=false;throw new DOMException('isolated quota','QuotaExceededError')}return native.call(this,k,v)}},{data,version:DATA_VERSION})
 page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>{if(d.type()==='beforeunload'){unloadDialogs++;if(blockReload){void d.dismiss();return}}void d.accept()})
 const settle=()=>page.waitForTimeout(150),read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('iyge-v2-mock-db')).data)
 const checkRefresh=async()=>{const count=unloadDialogs;blockReload=true;try{await page.reload({timeout:5000})}catch(e){assert.match(String(e),/ERR_ABORTED|TimeoutError: page.reload/)}finally{blockReload=false}assert.equal(unloadDialogs,count+1)}
 const unloadBlocked=()=>page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented})
 const navigate=async path=>{await page.evaluate(path=>{void document.querySelector('#app').__vue_app__.config.globalProperties.$router.push(path)},path);await page.waitForURL(base+path);await settle()}
 const reveal=async locator=>{if(!await locator.isVisible()){const details=locator.locator('xpath=ancestor::details').first();if(await details.count())await details.locator('summary').first().click()}return locator}
 const openTypes=async()=>{const button=page.getByRole('button',{name:'选择分类与参与类型',exact:true,includeHidden:true});await reveal(button);await button.click()}
 const selectMode=async name=>{const radio=page.getByRole('radio',{name,exact:true,includeHidden:true});await reveal(radio);await radio.locator('..').click()}
 const choose=async(label,text,multi=false)=>{const input=page.getByRole('combobox',{name:label,exact:true,includeHidden:true});await reveal(input);await input.locator('xpath=ancestor::div[contains(@class,"el-select__wrapper")]').click();await page.locator('.el-select-dropdown:visible .el-select-dropdown__item').filter({hasText:text}).first().click();if(multi)await input.press('Escape');await settle()}
 await page.goto(base+'/spus/family-charger',{waitUntil:'networkidle'})
 await choose('SPU 适用范围 SKU','charger-sku',true);await choose('SPU 适用范围 SKU','白色充电器',true);await page.locator('[data-spu-range]').click();await page.waitForURL('**/compatibility?**');await page.locator('[data-new-general]').click()
 assert.equal(await unloadBlocked(),false)
 assert.match(await page.locator('[data-general-preview]').innerText(),/明确影响 2 个 SKU/)
 for(const text of ['测试手机','测试平板','测试电脑'])await choose('通用适用设备类型',text,true)
 await page.getByRole('textbox',{name:'通用适用资料来源',exact:true}).fill('隔离供应商确认：三类设备满足此接口条件时基本使用可用')
 assert.equal(await unloadBlocked(),true);await checkRefresh();assert.match(await page.getByRole('textbox',{name:'通用适用资料来源',exact:true}).inputValue(),/隔离供应商/)
 await choose('通用核验状态','已确认');assert(await page.locator('[data-save-general]').isDisabled());assert.match(await page.locator('[data-general-editor]').innerText(),/只勾选设备类型不能确认/)
 await page.locator('[data-add-general-condition]').click();await choose('条件参数 1','接口');await choose('条件值 1','USB-C')
 for(const name of ['phone-a','隔离 tablet','隔离 computer']){await choose('通用范围试算设备',name);assert.equal(await page.locator('[data-general-trial]').getByText(/不能进入正常候选/).count(),0);assert.match(await page.locator('[data-general-trial]').innerText(),/可进入正常候选/)}
 await choose('通用范围试算设备','phone-wrong');assert.match(await page.locator('[data-general-trial]').innerText(),/不能进入正常候选/);assert.match(await page.locator('[data-general-trial]').innerText(),/不满足|未满足/)
 await choose('通用范围试算设备','phone-b');assert.match(await page.locator('[data-general-trial]').innerText(),/不能进入正常候选/);assert.match(await page.locator('[data-general-trial]').innerText(),/未记录|不足|未知/)
 await choose('通用范围试算设备','隔离 tablet')
 if(process.env.GENERAL_SCREENSHOT)await page.screenshot({path:process.env.GENERAL_SCREENSHOT,fullPage:true,animations:'disabled'})
 await page.evaluate(()=>window.__quota=true);await page.locator('[data-save-general]').click();await page.getByText(/无法保存到本机/).first().waitFor();assert.equal((await read()).generalCompatibilityClaims,undefined);assert.equal(await unloadBlocked(),true);assert.equal(await page.getByRole('textbox',{name:'通用适用资料来源',exact:true}).inputValue(),'隔离供应商确认：三类设备满足此接口条件时基本使用可用')
 await page.locator('[data-save-general]').click();await page.getByText('适用范围已保存',{exact:true}).last().waitFor();assert.equal(await unloadBlocked(),false);const claims=(await read()).generalCompatibilityClaims;assert.equal(claims.length,2);assert.deepEqual(claims.map(c=>c.skuId).sort(),['charger-sku','charger-white']);assert.equal((await read()).skus.length,data.skus.length)
 await page.locator('[data-new-general]').click();await page.getByRole('textbox',{name:'通用适用资料来源',exact:true}).fill('将放弃的资料');await page.locator('[data-general-editor]').getByRole('button',{name:'取消',exact:true}).click();await page.getByRole('button',{name:'放弃修改',exact:true}).click();assert.equal(await unloadBlocked(),false)
 await page.locator('[data-compatibility-return]').click();await page.waitForURL('**/spus/family-charger');assert.equal(await unloadBlocked(),false)
 console.log('PASS SPU explicit two-SKU batch; bare type cannot confirm; phone/tablet/computer preview, unmet and unknown reasons; quota failure no partial batch; no SKU duplication')
 await navigate('/benefits/shopping');await openTypes();await choose('自由组合分类','独立测试配件');await page.locator('[data-type-choice="type-charger"]').click();await page.locator('[data-apply-types]').click();await choose('本次使用设备','隔离 tablet')
 await page.locator('[data-sale-add="charger-sku"]').click();await page.getByRole('textbox',{name:'报价 charger-sku',exact:true}).fill('55.50')
 await page.locator('[data-sale-candidate="charger-sku"] summary').click();await page.locator('[data-sale-candidate="charger-sku"]').getByRole('button',{name:'适用资料',exact:true}).click();await page.waitForURL('**/compatibility?**');await page.locator('[data-general-maintenance]').waitFor();await page.locator('[data-compatibility-return]').click();await page.waitForURL('**/benefits/shopping?**');assert.equal(await page.getByRole('textbox',{name:'报价 charger-sku',exact:true}).inputValue(),'55.50')
 await page.locator('[data-confirm-sale]').click();await page.locator('[data-confirmed-sale]').waitFor();const sale=(await read()).benefitSalesLists[0],frozen=JSON.stringify(sale.snapshot),historyUrl=page.url().slice(base.length);assert(sale.snapshot.lines[0].evidence.some(e=>e.kind==='general'));assert(sale.snapshot.lines[0].capabilities.some(c=>c.capability==='basic'))
 await navigate('/skus/charger-sku');await page.locator('[data-sku-range]').click();await page.waitForURL('**/compatibility?**');await page.locator(`[data-general-claim="${claims.find(c=>c.skuId==='charger-sku').id}"]`).getByRole('button',{name:'编辑适用范围'}).click();await choose('通用适用结论','不适用');await page.getByRole('textbox',{name:'通用适用资料来源',exact:true}).fill('隔离后续更正：当前条件不适用');await page.locator('[data-save-general]').click();await page.getByText('适用范围已保存',{exact:true}).last().waitFor()
 await navigate(historyUrl);await page.locator('[data-confirmed-sale]').waitFor();assert.equal(JSON.stringify((await read()).benefitSalesLists[0].snapshot),frozen);await page.locator('[data-confirmed-sale] summary').click();assert.match(await page.locator('[data-confirmed-sale]').innerText(),/三类设备/);assert.doesNotMatch(await page.locator('[data-confirmed-sale]').innerText(),/后续更正/)
 await page.getByRole('button',{name:'复制为新草稿并按当前资料核对'}).click();assert.equal(await page.locator('[data-sale-line="charger-sku"]').count(),0)
 await page.evaluate(()=>sessionStorage.setItem('iyge-rbac-simulated-user','test-sales'));await page.goto(base+'/compatibility?tab=ranges&targetId=charger-white',{waitUntil:'networkidle'});assert.equal(await page.locator('[data-new-general]').count(),0);assert.equal(await page.getByRole('button',{name:'编辑适用范围'}).count(),0)
 await page.goto(base+'/benefits/shopping',{waitUntil:'networkidle'});await openTypes();await page.locator('[data-type-choice="type-charger"]').click();await page.locator('[data-apply-types]').click();await choose('本次使用设备','隔离 computer');await page.locator('[data-sale-add="charger-white"]').waitFor();assert.equal(await page.locator('[data-sale-add="charger-sku"]').count(),0)
 assert.deepEqual((await read()).benefitGroups,data.benefitGroups);assert.deepEqual(errors,[])
 console.log('PASS maintenance return keeps quotes, unified sale and confirmation evidence, later negative edit leaves history unchanged, copy rechecks, sales-only permissions, old data isolated, zero page errors')
}finally{await browser?.close();await server?.close();removeTestRuntime(runtime)}
