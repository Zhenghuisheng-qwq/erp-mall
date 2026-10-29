import assert from 'node:assert/strict'
import {resolve} from 'node:path'
import {createServer} from 'vite'
import {chromium} from 'playwright-core'
import {createTestRuntime,removeTestRuntime} from './test-runtime.mjs'
const runtime=createTestRuntime('type-bundles'),errors=[]
let server,browser,page
try{
 server=await createServer({cacheDir:resolve(runtime,'cache'),logLevel:'error',define:{'import.meta.env.VITE_RBAC_ENFORCEMENT':JSON.stringify('true')},server:{host:'127.0.0.1',port:0,hmr:false,watch:null,ws:false}})
 const {bundleFixture}=await server.ssrLoadModule('/scripts/type-bundle-fixture.ts'),{DATA_VERSION}=await server.ssrLoadModule('/src/domain/types.ts');const {data}=bundleFixture()
 await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`
 browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true})
 const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN'})
 await context.addInitScript(({data,version})=>{if(location.protocol!=='http:')return;if(!localStorage.getItem('iyge-v2-mock-db'))localStorage.setItem('iyge-v2-mock-db',JSON.stringify({version,data}));if(!sessionStorage.getItem('iyge-rbac-simulated-user'))sessionStorage.setItem('iyge-rbac-simulated-user','u-admin');const native=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(window.__failWrite&&key==='iyge-v2-mock-db'){window.__failWrite=false;throw new DOMException('isolated quota','QuotaExceededError')}return native.call(this,key,value)}},{data,version:DATA_VERSION})
 page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.accept())
 const settle=()=>page.waitForTimeout(150)
 const navigate=async path=>{await page.evaluate(path=>{void document.querySelector('#app').__vue_app__.config.globalProperties.$router.push(path)},path);await page.waitForURL(base+path);await settle()}
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('iyge-v2-mock-db')).data)
 const choose=async(label,text)=>{await page.getByRole('combobox',{name:label,exact:true}).locator('xpath=ancestor::div[contains(@class,"el-select__wrapper")]').click();await page.locator('.el-select-dropdown:visible .el-select-dropdown__item').filter({hasText:text}).first().click();await settle()}
 const checkType=async id=>page.locator(`[data-type-choice="${id}"]`).click()
 const candidates=()=>page.locator('[data-sale-candidate]').evaluateAll(rows=>rows.map(r=>r.getAttribute('data-sale-candidate')).sort())
 const add=async id=>{await page.locator(`[data-sale-add="${id}"]`).click();await settle()}
 const price=(id,value)=>page.getByRole('textbox',{name:`报价 ${id}`,exact:true}).fill(value)
 const save=async()=>{await page.locator('[data-save-sale]').click();await page.getByText('草稿已保存',{exact:true}).last().waitFor();await settle()}
 await page.goto(base+'/benefits/shopping',{waitUntil:'networkidle'})
 assert.equal((await read()).benefitTypeGroups,undefined)
 await page.getByRole('button',{name:'选择分类与参与类型',exact:true}).click();await choose('自由组合分类','独立测试设备');await checkType('type-device');await checkType('type-film');await checkType('type-charger');await page.locator('[data-apply-types]').click()
 await choose('本次使用设备','phone-a');assert.equal(await page.locator('[data-sale-line]').count(),0)
 await add('film-sku');await price('film-sku','12.34');await save();const freeId=(await read()).benefitSalesLists[0].id
 await page.reload({waitUntil:'networkidle'});assert.equal(await page.getByRole('textbox',{name:'报价 film-sku',exact:true}).inputValue(),'12.34')
 console.log('PASS no permanent groups: free combination, explicit device, adding, pricing, save and refresh')
 await navigate('/benefits/manage?category=cat-device-test');await page.locator('[data-new-bundle]').click();await page.getByRole('textbox',{name:'权益包名称',exact:true}).fill('跨分类销售组合')
 for(const id of ['type-device','type-film','type-charger','type-empty','type-cable','type-case'])await checkType(id)
 await page.getByRole('textbox',{name:'搜索参与类型',exact:true}).fill('耳机');assert.match(await page.getByLabel('已选产品类型').innerText(),/测试手机/);await page.getByRole('textbox',{name:'搜索参与类型',exact:true}).fill('')
 await choose('权益包归属分类','独立测试配件');assert.match(await page.getByLabel('已选产品类型').innerText(),/测试手机/)
 await page.evaluate(()=>window.__failWrite=true);await page.locator('[data-save-bundle]').click();await page.getByText(/无法保存到本机/).first().waitFor();assert.equal((await read()).benefitTypeGroups,undefined);assert.equal(await page.getByRole('textbox',{name:'权益包名称',exact:true}).inputValue(),'跨分类销售组合')
 await page.locator('[data-save-bundle]').click();await page.getByText('权益包已保存',{exact:true}).last().waitFor();const group=(await read()).benefitTypeGroups[0];assert.equal(group.productTypeIds.length,6)
 await navigate('/benefits/manage');await page.locator('[data-catalog-tree-category="cat-device-test"]').click();await page.getByRole('button',{name:'展开 独立测试设备',exact:true}).click();await page.locator('[data-catalog-tree-type="type-device"]').click();await page.locator(`[data-bundle-record="${group.id}"]`).waitFor()
 await navigate('/specs?template=template-device-test');await page.locator('[data-model-bundles]').click();await page.waitForURL('**/benefits/manage?**');await page.locator(`[data-bundle-record="${group.id}"]`).click();await page.getByRole('textbox',{name:'权益包名称',exact:true}).fill('模型入口编辑后的组合');await page.locator('[data-save-bundle]').click();await page.getByText('权益包已保存',{exact:true}).last().waitFor()
 await navigate('/benefits/manage?category=cat-accessory-test');assert.equal(await page.locator(`[data-bundle-record="${group.id}"]`).innerText(),'模型入口编辑后的组合');assert.equal((await read()).benefitTypeGroups.length,1)
 console.log('PASS cross-category picker/search preservation, zero-SKU type, quota retry, type filter across category, same ID edited via actual model entrance')
 await navigate('/benefits/shopping');await page.getByRole('button',{name:'新建自由组合',exact:true}).click();await page.getByRole('radio',{name:'按权益包选购',exact:true}).locator('..').click();await choose('选择权益包','模型入口编辑后的组合');await choose('本次使用设备','phone-a')
 assert.deepEqual(await candidates(),['case-sku','charger-sku','film-sku','phone-a'])
 await add('phone-a');await price('phone-a','1000');await add('film-sku');await price('film-sku','20');await add('charger-sku');await price('charger-sku','0')
 const url=page.url();await choose('本次使用设备','phone-b');await page.getByRole('button',{name:'取消，保留原内容',exact:true}).click();assert.equal(page.url(),url);assert.equal(await page.getByRole('textbox',{name:'报价 film-sku',exact:true}).inputValue(),'20');assert.deepEqual(await candidates(),['case-sku','charger-sku','film-sku','phone-a'])
 await choose('本次使用设备','phone-b');await page.getByRole('button',{name:'应用切换并移除',exact:true}).click();await settle();assert.deepEqual(await candidates(),['case-sku','charger-sku','film-b','phone-b']);assert.equal(await page.locator('[data-sale-line="phone-a"]').count(),0);assert.equal(await page.locator('[data-sale-line="phone-b"]').count(),0);assert.equal(await page.getByRole('textbox',{name:'报价 charger-sku',exact:true}).inputValue(),'0')
 await add('film-b');await price('film-b','33.50')
 await page.getByRole('radio',{name:'自由组合',exact:true}).locator('..').click();await page.getByRole('button',{name:'选择分类与参与类型',exact:true}).click();await checkType('type-charger');await page.locator('[data-apply-types]').click();await page.getByRole('button',{name:'取消，保留原内容',exact:true}).click();await page.getByRole('dialog',{name:'本次参与的产品类型'}).getByRole('button',{name:'取消',exact:true}).click();assert.equal(await page.locator('[data-sale-line="charger-sku"]').count(),1)
 await page.locator('.diagnostics summary').click();await page.locator('.diagnostics p').filter({hasText:'film-sku'}).getByRole('button',{name:'查看适用资料'}).click();await page.waitForURL('**/compatibility?**');await page.locator('[data-compatibility-return]').click();await page.waitForURL('**/benefits/shopping?**');assert.equal(await page.getByRole('textbox',{name:'报价 film-b',exact:true}).inputValue(),'33.50')
 assert.match(await page.locator('.tags').innerText(),/测试充电器/)
 await page.locator('.tags .el-tag').first().waitFor({state:'visible'})
 if(process.env.BUNDLE_SCREENSHOT)await page.screenshot({path:process.env.BUNDLE_SCREENSHOT,fullPage:true,animations:'disabled'})
 await save();const active=(await read()).benefitSalesLists.find(s=>s.id!==freeId);assert(active)
 await page.evaluate(async()=>{const store=(await import('/src/stores/catalog.ts')).useCatalogStore();const original=store.data.skus.find(s=>s.id==='film-b'),proof=store.data.compatibilities.find(d=>d.id==='decl-film-b');store.data.skus.push({...JSON.parse(JSON.stringify(original)),id:'new-qualified-film',skuName:'新增合格膜'});store.data.compatibilities.push({...JSON.parse(JSON.stringify(proof)),id:'new-qualified-proof',accessorySkuId:'new-qualified-film',targetId:'new-qualified-film'});await store.flushPersistence()});await settle();assert((await candidates()).includes('new-qualified-film'))
 await page.locator('[data-confirm-sale]').click();await page.locator('[data-confirmed-sale]').waitFor();const snapshot=(await read()).benefitSalesLists.find(s=>s.id===active.id).snapshot
 await page.evaluate(async id=>{const store=(await import('/src/stores/catalog.ts')).useCatalogStore();store.data.skus.find(s=>s.id==='film-b').skuName='后来改名';const g=store.data.benefitTypeGroups.find(g=>g.id===id);await store.saveTypeBundle({...JSON.parse(JSON.stringify(g)),enabled:false},g.revision);await store.flushPersistence()},group.id)
 await page.reload({waitUntil:'networkidle'});assert.deepEqual((await read()).benefitSalesLists.find(s=>s.id===active.id).snapshot,snapshot);assert.doesNotMatch(await page.locator('[data-confirmed-sale]').innerText(),/后来改名/)
 assert.deepEqual((await read()).benefitGroups,data.benefitGroups);assert.deepEqual((await read()).benefitSelections,data.benefitSelections)
 console.log('PASS A/B filtering, explicit phone purchase, cancel preserves URL/quotes, accepted switch retains shared line, type-switch cancellation, maintenance return, new qualified SKU, confirmed historical snapshot')
 await page.evaluate(()=>sessionStorage.setItem('iyge-rbac-simulated-user','test-sales'));await page.goto(base+'/benefits/manage',{waitUntil:'networkidle'});assert.equal(await page.locator('[data-new-bundle]').count(),0);await page.locator(`[data-bundle-record="${group.id}"]`).click();assert.equal(await page.locator('[data-save-bundle]').count(),0)
 await page.goto(base+'/benefits/shopping',{waitUntil:'networkidle'});await page.getByRole('button',{name:'选择分类与参与类型',exact:true}).click();await checkType('type-charger');await page.locator('[data-apply-types]').click();await choose('本次使用设备','phone-a');await add('charger-sku');await price('charger-sku','1');await save();assert.equal(await page.locator('.diagnostics').count(),0)
 assert.deepEqual(errors,[]);console.log('PASS sales-only RBAC: no permanent configuration mutation, free-sale save allowed; zero page errors')
}finally{await browser?.close();await server?.close();removeTestRuntime(runtime)}
