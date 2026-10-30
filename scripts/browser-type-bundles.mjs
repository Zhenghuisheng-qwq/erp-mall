import assert from 'node:assert/strict'
import {resolve} from 'node:path'
import {createServer} from 'vite'
import {chromium} from 'playwright-core'
import {createTestRuntime,removeTestRuntime} from './test-runtime.mjs'
const runtime=createTestRuntime('type-bundles'),errors=[],demoMode=process.argv.includes('--demo')
let server,browser,page,blockReload=false,unloadDialogs=0
try{
 server=await createServer({cacheDir:resolve(runtime,'cache'),logLevel:'error',define:{'import.meta.env.VITE_RBAC_ENFORCEMENT':JSON.stringify('true')},server:{host:'127.0.0.1',port:0,hmr:false,watch:null,ws:false}})
 const {bundleFixture}=await server.ssrLoadModule('/scripts/type-bundle-fixture.ts'),{DATA_VERSION}=await server.ssrLoadModule('/src/domain/types.ts');const {createSeed}=await server.ssrLoadModule('/src/domain/seed.ts');const data=demoMode?createSeed():bundleFixture().data
 if(!demoMode){
 const {hostFrom}=await server.ssrLoadModule('/src/domain/compatibility.ts')
  const nodes=[{id:'boundary-attr',templateId:'template-device-test',parentId:null,nodeType:'ATTRIBUTE',attributeId:'attr-device-model',valueId:'',sort:1},{id:'boundary-b',templateId:'template-device-test',parentId:'boundary-attr',nodeType:'VALUE',attributeId:'attr-device-model',valueId:'Orion B',sort:1},{id:'boundary-a',templateId:'template-device-test',parentId:'boundary-attr',nodeType:'VALUE',attributeId:'attr-device-model',valueId:'Orion A',sort:2}]
  data.specModelVersions.push({id:'boundary-version',templateId:'template-device-test',version:1,versionName:'边界验证',status:'published',nodesSnapshot:nodes,createdTime:'2026-10-30',publishTime:'2026-10-30'})
  const host=hostFrom('type-device','template-device-test',[{attributeId:'attr-device-model',attributeName:'测试设备型号',valueId:'Orion B'}]);for(const id of ['film-b','charger-sku']){const source=data.compatibilities.find(c=>c.targetId===id&&c.capability==='basic');data.compatibilities.push({...structuredClone(source),id:`boundary-${id}`,host})}
 }
 await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`
 browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true})
 const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN'})
 await context.addInitScript(({data,version,demoMode})=>{if(location.protocol!=='http:')return;if(!demoMode&&!localStorage.getItem('iyge-v2-mock-db'))localStorage.setItem('iyge-v2-mock-db',JSON.stringify({version,data}));if(!sessionStorage.getItem('iyge-rbac-simulated-user'))sessionStorage.setItem('iyge-rbac-simulated-user','u-admin');const native=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(window.__failWrite&&key==='iyge-v2-mock-db'){window.__failWrite=false;throw new DOMException('isolated quota','QuotaExceededError')}return native.call(this,key,value)}},{data,version:DATA_VERSION,demoMode})
 page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>{if(d.type()==='beforeunload'){unloadDialogs++;if(blockReload){void d.dismiss();return}}void d.accept()})
 const settle=()=>page.waitForTimeout(150)
 const navigate=async path=>{await page.evaluate(path=>{void document.querySelector('#app').__vue_app__.config.globalProperties.$router.push(path)},path);await page.waitForURL(base+path);await settle()}
 const checkRefresh=async()=>{const count=unloadDialogs;blockReload=true;try{await page.reload({timeout:5000})}catch(e){assert.match(String(e),/ERR_ABORTED|TimeoutError: page.reload/)}finally{blockReload=false}assert.equal(unloadDialogs,count+1)}
 const unloadBlocked=()=>page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented})
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('iyge-v2-mock-db')).data)
 const reveal=async locator=>{if(!await locator.isVisible()){const details=locator.locator('xpath=ancestor::details').first();if(await details.count())await details.locator('summary').first().click()}return locator}
 const openTypes=async()=>{const button=page.getByRole('button',{name:'选择分类与参与类型',exact:true,includeHidden:true});await reveal(button);await button.click()}
 const selectMode=async name=>{const radio=page.getByRole('radio',{name,exact:true,includeHidden:true});await reveal(radio);await radio.locator('..').click()}
 const choose=async(label,text)=>{await reveal(page.getByRole('combobox',{name:label,exact:true,includeHidden:true}));await page.getByRole('combobox',{name:label,exact:true}).locator('xpath=ancestor::div[contains(@class,"el-select__wrapper")]').click();await page.locator('.el-select-dropdown:visible .el-select-dropdown__item').filter({hasText:text}).first().click();await settle()}
 const checkType=async id=>page.locator(`[data-type-choice="${id}"]`).click()
 const candidates=()=>page.locator('[data-sale-candidate]').evaluateAll(rows=>rows.map(r=>r.getAttribute('data-sale-candidate')).sort())
 const add=async id=>{await page.locator(`[data-sale-add="${id}"]`).click();await settle()}
 const price=(id,value)=>page.getByRole('textbox',{name:`报价 ${id}`,exact:true}).fill(value)
 const save=async()=>{await page.locator('[data-save-sale]').click();await page.getByText('草稿已保存',{exact:true}).last().waitFor();await settle()}
 if(demoMode){
 await page.goto(base+'/benefits/shopping',{waitUntil:'networkidle'});await page.locator('[data-phone-sku="s-iphone-blue"]').waitFor();if(await page.getByRole('button',{name:/切换为明亮模式/}).count())await page.getByRole('button',{name:/切换为明亮模式/}).click()
 const initial=await read();assert(['pt-phone','pt-case','pt-film','pt-leaf-c-charge','pt-earphones'].every(id=>initial.productTypes.find(t=>t.id===id)?.categoryId==='c-phone'))
 await page.locator('[data-phone-sku="s-iphone-blue"]').click();await page.locator('[data-sale-add="s-demo-charger"]').waitFor()
 assert.equal(await page.locator('[data-accessory-group]').count(),4);assert.equal(await page.locator('[data-sale-line]').count(),0);assert.match(await page.locator('.bundle-options').innerText(),/手机基础权益包/);assert(!(await candidates()).includes('s-demo-case16'))
 const plain=await page.locator('.selection-workbench').innerText();assert.doesNotMatch(plain,/产品类型 ID|主机身份|PLN|MAT|快充未确认/)
 await add('s-case-clear');await add('s-film-1');await add('s-demo-charger');await add('s-demo-earphones');await add('s-demo-charger');assert.equal(await page.getByRole('spinbutton',{name:'数量 s-demo-charger',exact:true}).inputValue(),'2');assert.equal(await page.locator('[data-sale-line="s-iphone-blue"]').count(),0)
 for(const [id,value] of [['s-case-clear','29.90'],['s-film-1','19.90'],['s-demo-charger','59.00'],['s-demo-earphones','0']])await price(id,value)
 await save();const url=page.url();await page.reload({waitUntil:'networkidle'});assert.equal(await page.getByRole('textbox',{name:'报价 s-demo-charger',exact:true}).inputValue(),'59.00')
 await page.locator('[data-phone-sku="s-demo-iphone16"]').click();await page.getByRole('button',{name:'取消，保留原内容',exact:true}).click();assert.equal(page.url(),url);assert.equal(await page.getByRole('textbox',{name:'报价 s-case-clear',exact:true}).inputValue(),'29.90')
 if(process.env.DEMO_SCREENSHOT_DIR){await page.locator('.content').evaluate(el=>el.scrollTo(0,0));await page.screenshot({path:resolve(process.env.DEMO_SCREENSHOT_DIR,'benefit-desktop.png'),fullPage:true,animations:'disabled'})}
 await page.locator('[data-phone-sku="s-demo-iphone16"]').click();await page.getByRole('button',{name:'应用切换并移除',exact:true}).click();await settle();assert((await candidates()).includes('s-demo-case16'));assert(!(await candidates()).includes('s-case-clear'));assert.equal(await page.getByRole('textbox',{name:'报价 s-demo-charger',exact:true}).inputValue(),'59.00');assert.equal(await page.getByRole('spinbutton',{name:'数量 s-demo-charger',exact:true}).inputValue(),'2')
 await add('s-demo-case16');await price('s-demo-case16','28.00');await add('s-demo-film16');await price('s-demo-film16','18.00')
 await page.getByRole('button',{name:/切换为暗黑模式/}).click();if(process.env.DEMO_SCREENSHOT_DIR)await page.screenshot({path:resolve(process.env.DEMO_SCREENSHOT_DIR,'benefit-dark.png'),fullPage:true,animations:'disabled'})
 await page.setViewportSize({width:760,height:1000});await settle();assert(await page.locator('.content').evaluate(el=>el.scrollWidth<=el.clientWidth));await page.locator('.content').evaluate(el=>el.scrollTo(0,0));if(process.env.DEMO_SCREENSHOT_DIR)await page.screenshot({path:resolve(process.env.DEMO_SCREENSHOT_DIR,'benefit-narrow.png'),fullPage:true,animations:'disabled'})
 await page.locator('[data-confirm-sale]').click();await page.locator('[data-confirmed-sale]').waitFor();const snapshot=JSON.stringify((await read()).benefitSalesLists[0].snapshot);await page.reload({waitUntil:'networkidle'});assert.equal(JSON.stringify((await read()).benefitSalesLists[0].snapshot),snapshot)
 // No package is required, and an accessory-only package remains discoverable.
 await page.evaluate(async()=>{const store=(await import('/src/stores/catalog.ts')).useCatalogStore(),g=store.data.benefitTypeGroups[0];await store.saveTypeBundle({...JSON.parse(JSON.stringify(g)),enabled:false},g.revision)})
 await page.getByRole('button',{name:'新建自由组合',exact:true}).click();await page.locator('[data-phone-sku="s-iphone-blue"]').click();await page.locator('[data-sale-add="s-demo-charger"]').waitFor();assert.match(await page.locator('.bundle-options').innerText(),/自由选配/)
 await page.evaluate(async()=>{const store=(await import('/src/stores/catalog.ts')).useCatalogStore();await store.saveTypeBundle({id:'',name:'仅壳膜演示包',categoryId:'c-phone',productTypeIds:['pt-case','pt-film'],enabled:true,sort:0},0)})
 await page.getByRole('button',{name:'新建自由组合',exact:true}).click();await page.getByRole('button',{name:'放弃修改',exact:true}).click();await page.locator('[data-phone-sku="s-iphone-blue"]').click();await page.locator('[data-sale-add="s-case-clear"]').waitFor();assert.equal(await page.locator('[data-sale-add="s-demo-charger"]').count(),0);assert.match(await page.locator('.bundle-options').innerText(),/仅壳膜演示包/)
 assert.deepEqual(errors,[]);console.log('PASS fresh phone demo: automatic package, four groups, merged quantities, no automatic phone purchase, draft reload, A/B cancel/accept and shared quotes, immutable confirmation, free fallback, accessory-only package, light/dark/narrow layouts')
 }else{
 await page.goto(base+'/benefits/shopping',{waitUntil:'networkidle'})
 assert.equal((await read()).benefitTypeGroups,undefined)
 await openTypes();await choose('自由组合分类','独立测试设备');await checkType('type-device');await checkType('type-film');await checkType('type-charger');await page.locator('[data-apply-types]').click()
 await choose('本次使用设备','phone-a');assert.equal(await page.locator('[data-sale-line]').count(),0)
 await add('film-sku');await price('film-sku','12.34');await save();const freeId=(await read()).benefitSalesLists[0].id
 await page.reload({waitUntil:'networkidle'});assert.equal(await page.getByRole('textbox',{name:'报价 film-sku',exact:true}).inputValue(),'12.34')
 console.log('PASS no permanent groups: free combination, explicit device, adding, pricing, save and refresh')
 await navigate('/benefits/manage?category=cat-device-test');await page.locator('[data-new-bundle]').click();assert.equal(await unloadBlocked(),false);await page.getByRole('textbox',{name:'权益包名称',exact:true}).fill('跨分类销售组合');assert.equal(await unloadBlocked(),true);await checkRefresh();assert.equal(await page.getByRole('textbox',{name:'权益包名称',exact:true}).inputValue(),'跨分类销售组合')
 const treeOrder=await page.locator('.type-picker .tree-row').allTextContents();assert(treeOrder.findIndex(t=>t.includes('测试手机'))<treeOrder.findIndex(t=>t.includes('独立测试配件')))
 await page.getByRole('button',{name:'收起全部',exact:true}).click();await page.getByRole('textbox',{name:'搜索参与类型',exact:true}).fill('耳机');await checkType('type-empty');assert.match(await page.getByLabel('已选产品类型').innerText(),/耳机/);await checkType('type-empty');await page.getByRole('textbox',{name:'搜索参与类型',exact:true}).fill('');assert.equal(await page.locator('[data-type-choice]').count(),0);await page.getByRole('button',{name:'展开全部',exact:true}).click()
 for(const id of ['type-device','type-film','type-charger','type-empty','type-cable','type-case'])await checkType(id)
 await page.getByRole('textbox',{name:'搜索参与类型',exact:true}).fill('耳机');assert.match(await page.getByLabel('已选产品类型').innerText(),/测试手机/);await page.getByRole('textbox',{name:'搜索参与类型',exact:true}).fill('')
 await choose('权益包归属分类','独立测试配件');assert.match(await page.getByLabel('已选产品类型').innerText(),/测试手机/)
 await page.evaluate(()=>window.__failWrite=true);await page.locator('[data-save-bundle]').click();await page.getByText(/无法保存到本机/).first().waitFor();assert.equal((await read()).benefitTypeGroups,undefined);assert.equal(await unloadBlocked(),true);assert.equal(await page.getByRole('textbox',{name:'权益包名称',exact:true}).inputValue(),'跨分类销售组合')
 await page.locator('[data-save-bundle]').click();await page.getByText('权益包已保存',{exact:true}).last().waitFor();assert.equal(await unloadBlocked(),false);const group=(await read()).benefitTypeGroups[0];assert.equal(group.productTypeIds.length,6)
 await page.locator('[data-new-bundle]').click();await page.getByRole('textbox',{name:'权益包名称',exact:true}).fill('将放弃的配置');await page.getByRole('button',{name:'取消 / 关闭',exact:true}).click();await page.getByRole('button',{name:'放弃修改',exact:true}).click();assert.equal(await unloadBlocked(),false)
 await navigate('/benefits/manage');await page.locator('[data-catalog-tree-category="cat-device-test"]').click();await page.getByRole('button',{name:'展开 独立测试设备',exact:true}).click();await page.locator('[data-catalog-tree-type="type-device"]').click();await page.locator(`[data-bundle-record="${group.id}"]`).waitFor()
 await navigate('/specs?template=template-device-test');await page.locator('[data-model-bundles]').click();await page.waitForURL('**/benefits/manage?**');await page.locator(`[data-bundle-record="${group.id}"]`).click();await page.getByRole('textbox',{name:'权益包名称',exact:true}).fill('模型入口编辑后的组合');await page.locator('[data-save-bundle]').click();await page.getByText('权益包已保存',{exact:true}).last().waitFor()
 await navigate('/benefits/manage?category=cat-accessory-test');assert.equal(await page.locator(`[data-bundle-record="${group.id}"]`).innerText(),'模型入口编辑后的组合');assert.equal((await read()).benefitTypeGroups.length,1)
 console.log('PASS cross-category picker/search preservation, zero-SKU type, quota retry, type filter across category, same ID edited via actual model entrance')
 await navigate('/benefits/shopping');await page.getByRole('button',{name:'新建自由组合',exact:true}).click();await selectMode('按权益包选购');await choose('选择权益包','模型入口编辑后的组合');await choose('本次使用设备','phone-a')
 assert.deepEqual(await candidates(),['case-sku','charger-sku','film-sku','phone-a'])
 await add('phone-a');await price('phone-a','1000');await add('film-sku');await price('film-sku','20');await add('charger-sku');await price('charger-sku','0')
 const url=page.url();await choose('本次使用设备','phone-b');await page.getByRole('button',{name:'取消，保留原内容',exact:true}).click();assert.equal(page.url(),url);assert.equal(await page.getByRole('textbox',{name:'报价 film-sku',exact:true}).inputValue(),'20');assert.deepEqual(await candidates(),['case-sku','charger-sku','film-sku','phone-a'])
 await choose('本次使用设备','phone-b');await page.getByRole('button',{name:'应用切换并移除',exact:true}).click();await settle();assert.deepEqual(await candidates(),['case-sku','charger-sku','film-b','phone-b']);assert.equal(await page.locator('[data-sale-line="phone-a"]').count(),0);assert.equal(await page.locator('[data-sale-line="phone-b"]').count(),0);assert.equal(await page.getByRole('textbox',{name:'报价 charger-sku',exact:true}).inputValue(),'0')
 await add('film-b');await price('film-b','33.50')
 await selectMode('自由组合');await openTypes();await checkType('type-charger');await page.locator('[data-apply-types]').click();await page.getByRole('button',{name:'取消，保留原内容',exact:true}).click();await page.getByRole('dialog',{name:'本次参与的产品类型'}).getByRole('button',{name:'取消',exact:true}).click();assert.equal(await page.locator('[data-sale-line="charger-sku"]').count(),1)
 await page.locator('.diagnostics summary').click();await page.locator('.diagnostics p').filter({hasText:'film-sku'}).getByRole('button',{name:'查看适用资料'}).click();await page.waitForURL('**/compatibility?**');await page.locator('[data-compatibility-return]').click();await page.waitForURL('**/benefits/shopping?**');assert.equal(await page.getByRole('textbox',{name:'报价 film-b',exact:true}).inputValue(),'33.50')
 assert.match(await page.locator('.tags').innerText(),/测试充电器/)
 await page.locator('.tags .scope-tag').first().waitFor({state:'visible'})
 if(process.env.BUNDLE_SCREENSHOT)await page.screenshot({path:process.env.BUNDLE_SCREENSHOT,fullPage:true,animations:'disabled'})
 await save();const active=(await read()).benefitSalesLists.find(s=>s.id!==freeId);assert(active)
 await page.evaluate(async()=>{const store=(await import('/src/stores/catalog.ts')).useCatalogStore();const original=store.data.skus.find(s=>s.id==='film-b'),proof=store.data.compatibilities.find(d=>d.id==='decl-film-b');store.data.skus.push({...JSON.parse(JSON.stringify(original)),id:'new-qualified-film',skuName:'新增合格膜'});store.data.compatibilities.push({...JSON.parse(JSON.stringify(proof)),id:'new-qualified-proof',accessorySkuId:'new-qualified-film',targetId:'new-qualified-film'});await store.flushPersistence()});await settle();assert((await candidates()).includes('new-qualified-film'))
 await page.locator('[data-confirm-sale]').click();await page.locator('[data-confirmed-sale]').waitFor();const snapshot=(await read()).benefitSalesLists.find(s=>s.id===active.id).snapshot
 await page.evaluate(async id=>{const store=(await import('/src/stores/catalog.ts')).useCatalogStore();store.data.skus.find(s=>s.id==='film-b').skuName='后来改名';const g=store.data.benefitTypeGroups.find(g=>g.id===id);await store.saveTypeBundle({...JSON.parse(JSON.stringify(g)),enabled:false},g.revision);await store.flushPersistence()},group.id)
 await page.reload({waitUntil:'networkidle'});assert.deepEqual((await read()).benefitSalesLists.find(s=>s.id===active.id).snapshot,snapshot);assert.doesNotMatch(await page.locator('[data-confirmed-sale]').innerText(),/后来改名/)
 assert.deepEqual((await read()).benefitGroups,data.benefitGroups);assert.deepEqual((await read()).benefitSelections,data.benefitSelections)
 console.log('PASS A/B filtering, explicit phone purchase, cancel preserves URL/quotes, accepted switch retains shared line, type-switch cancellation, maintenance return, new qualified SKU, confirmed historical snapshot')
 // Reuse this isolated browser fixture for route/cache boundary regressions.
 await page.evaluate(async id=>{
  const store=(await import('/src/stores/catalog.ts')).useCatalogStore();const g=store.data.benefitTypeGroups.find(g=>g.id===id);await store.saveTypeBundle({...JSON.parse(JSON.stringify(g)),enabled:true},g.revision)

  await store.flushPersistence()
 },group.id)
 await page.getByRole('button',{name:'新建自由组合',exact:true}).click();await selectMode('按权益包选购');await choose('选择权益包','模型入口编辑后的组合');await choose('本次使用设备','phone-a');await add('film-sku');await price('film-sku','19.90');await add('charger-sku');await price('charger-sku','8.88');await page.getByRole('spinbutton',{name:'数量 charger-sku',exact:true}).fill('3');await save()
 const originalUrl=page.url(),originalCandidates=await candidates(),modelQuery=`group=${group.id}&model=template-device-test&version=boundary-version&node=boundary-b`
 // Same-page route cancellation must leave both router and work untouched.
 await page.evaluate(path=>{void document.querySelector('#app').__vue_app__.config.globalProperties.$router.push(path)},'/benefits/shopping?'+modelQuery)
 await page.getByRole('button',{name:'取消，保留原内容',exact:true}).click();await settle();assert.equal(page.url(),originalUrl);assert.deepEqual(await candidates(),originalCandidates);assert.equal(await page.getByRole('textbox',{name:'报价 film-sku',exact:true}).inputValue(),'19.90')
 // Re-enter through management with the same group and an existing A working cache.
 await navigate('/benefits/manage?'+modelQuery);await page.getByRole('button',{name:'使用',exact:true}).click();await page.getByRole('button',{name:'取消，保留原内容',exact:true}).click();await page.waitForURL(originalUrl);assert.deepEqual(await candidates(),originalCandidates)
 await navigate('/benefits/manage?'+modelQuery);await page.getByRole('button',{name:'使用',exact:true}).click();await page.getByRole('button',{name:'应用切换并移除',exact:true}).click();await settle();assert((await candidates()).includes('film-b'));assert(!(await candidates()).includes('film-sku'));assert.equal(await page.getByRole('textbox',{name:'报价 charger-sku',exact:true}).inputValue(),'8.88');assert.equal(await page.getByRole('spinbutton',{name:'数量 charger-sku',exact:true}).inputValue(),'3')
 await price('charger-sku','9.99');await page.locator('[data-sale-candidate="charger-sku"] summary').click();await page.locator('[data-sale-candidate="charger-sku"]').getByRole('button',{name:'适用资料',exact:true}).click();await page.waitForURL('**/compatibility?**');await page.locator('[data-compatibility-return]').click();await page.waitForURL('**/benefits/shopping?**');assert.equal(await page.getByRole('textbox',{name:'报价 charger-sku',exact:true}).inputValue(),'9.99')
 // A non-unique source clears the previous device only after the same impact confirmation.
 await page.evaluate(path=>{void document.querySelector('#app').__vue_app__.config.globalProperties.$router.push(path)},`/benefits/shopping?group=${group.id}&model=template-device-test&version=boundary-version`)
 await page.getByRole('button',{name:'应用切换并移除',exact:true}).click();await page.getByText('来源无法准确识别设备，请明确选择本次使用设备。',{exact:true}).waitFor();assert.equal(await page.locator('[data-sale-candidate]').count(),0)
 // Explicit discard restores the persisted A record, never the abandoned B quote.
 await page.evaluate(()=>{void document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/benefits/manage')});await page.getByRole('button',{name:'放弃修改',exact:true}).click();await page.waitForURL('**/benefits/manage');await navigate('/benefits/shopping');assert.equal(await page.getByRole('textbox',{name:'报价 charger-sku',exact:true}).inputValue(),'8.88');assert.equal(await page.getByRole('textbox',{name:'报价 film-sku',exact:true}).inputValue(),'19.90')
 await page.getByRole('button',{name:'新建自由组合',exact:true}).click();await openTypes();await checkType('type-charger');await page.locator('[data-apply-types]').click();await choose('本次使用设备','phone-a');await add('charger-sku');await price('charger-sku','123.45')
 await page.evaluate(()=>{void document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/benefits/manage')});await page.getByRole('button',{name:'放弃修改',exact:true}).click();await page.waitForURL('**/benefits/manage');await navigate('/benefits/shopping');assert.equal(await page.locator('[data-sale-line]').count(),0);assert.equal(await page.locator('.tags .scope-tag').count(),0)
 console.log('PASS model-source cached re-entry and same-page cancel, ambiguous source cleared, maintenance quotes/quantity retained, saved/new discard cleared, tree preorder/search expansion, editor unload protection')
 await page.evaluate(()=>sessionStorage.setItem('iyge-rbac-simulated-user','test-sales'));await page.goto(base+'/benefits/manage',{waitUntil:'networkidle'});assert.equal(await page.locator('[data-new-bundle]').count(),0);await page.locator(`[data-bundle-record="${group.id}"]`).click();assert.equal(await page.locator('[data-save-bundle]').count(),0)
 await page.goto(base+'/benefits/shopping',{waitUntil:'networkidle'});await openTypes();await checkType('type-charger');await page.locator('[data-apply-types]').click();await choose('本次使用设备','phone-a');await add('charger-sku');await price('charger-sku','1');await save();assert.equal(await page.locator('.diagnostics').count(),0)
 assert.deepEqual(errors,[]);console.log('PASS sales-only RBAC: no permanent configuration mutation, free-sale save allowed; zero page errors')
 }
}finally{await browser?.close();await server?.close();removeTestRuntime(runtime)}
