import assert from 'node:assert/strict'
import {resolve} from 'node:path'
import {mkdirSync,writeFileSync} from 'node:fs'
import {createServer} from 'vite'
import {chromium} from 'playwright-core'
import {createTestRuntime,removeTestRuntime} from './test-runtime.mjs'
const runtime=createTestRuntime('compatibility-workbench'),errors=[],checks=[],output=resolve('work/compatibility-workbench');mkdirSync(output,{recursive:true})
let server,browser,page
try{
 server=await createServer({cacheDir:resolve(runtime,'cache'),logLevel:'error',define:{'import.meta.env.VITE_RBAC_ENFORCEMENT':JSON.stringify('true')},server:{host:'127.0.0.1',port:0,hmr:false,watch:null,ws:false}})
 const {bundleFixture}=await server.ssrLoadModule('/scripts/type-bundle-fixture.ts'),{DATA_VERSION}=await server.ssrLoadModule('/src/domain/types.ts'),{resolveDeviceSku,deviceHostKey,listDeviceModels}=await server.ssrLoadModule('/src/domain/deviceResolution.ts'),{createSeed}=await server.ssrLoadModule('/src/domain/seed.ts'),data=process.argv.includes('--phone18')||process.argv.includes('--bundle-list')||process.argv.includes('--multi-brand')?createSeed():bundleFixture().data
 const labels=process.argv.includes('--phone18')||process.argv.includes('--bundle-list')||process.argv.includes('--multi-brand')?[]:['s-iphone-blue','s-demo-iphone16'].map(id=>listDeviceModels(data).find(m=>m.key===deviceHostKey(resolveDeviceSku(data,id).host)).label)
 if(process.argv.includes('--bundle-list')){const {writeSale}=await server.ssrLoadModule('/src/domain/benefitSales/commands.ts');const group=data.benefitTypeGroups.find(g=>g.id==='demo18-bundle-full');const historical=writeSale(data,{id:'',scope:{mode:'group',categoryId:'c-phone',groupId:group.id,productTypeIds:[...group.productTypeIds],device:{kind:'sku',skuId:'demo18-sku-phone-1'}},lines:[{skuId:'demo18-sku-charger-1',quantity:1,unitPriceCents:9900}],status:'confirmed'},0,()=> 'bundle-list-history','2026-10-30T09:00:00Z');assert(historical.ok,historical.message)}
 await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`
 browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1550,height:1100},locale:'zh-CN'})
 await context.addInitScript(({data,version})=>{if(location.protocol==='http:'&&!localStorage.getItem('iyge-v2-mock-db'))localStorage.setItem('iyge-v2-mock-db',JSON.stringify({version,data}));sessionStorage.setItem('iyge-rbac-simulated-user','u-admin');const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='iyge-v2-mock-db'&&window.__failWrite){window.__failWrite=false;throw new DOMException('isolated quota','QuotaExceededError')}return set.call(this,key,value)}},{data,version:DATA_VERSION})
 page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(String(e)))
 const settle=()=>page.evaluate(async()=>{await(await import('/src/stores/catalog.ts')).useCatalogStore().waitForPersistence();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))})
 const raw=()=>page.evaluate(()=>localStorage.getItem('iyge-v2-mock-db'))
 const navigate=async path=>{await page.evaluate(async path=>{await document.querySelector('#app').__vue_app__.config.globalProperties.$router.push(path)},path);await settle()}
 async function option(field,label){await field.locator('.el-select__wrapper').click();await page.getByRole('option',{name:label,exact:true}).last().click();await page.keyboard.press('Escape')}
 const field=(name)=>page.locator('.el-select').filter({has:page.getByRole('combobox',{name,exact:true})})
 const mark=name=>{checks.push(name);console.log('PASS browser:',name)}


 if(process.argv.includes('--multi-brand')){
  const {deviceOptions}=await server.ssrLoadModule('/src/domain/benefitSales/query.ts'),devices=deviceOptions(data).skus
  await page.goto(base+'/benefits/manage?category=c-phone',{waitUntil:'networkidle'});await settle();assert.doesNotMatch(await page.locator('body').innerText(),/演示/)
  await page.locator('[data-new-bundle]').click();const dialog=page.getByRole('dialog',{name:'权益包配置',exact:true})
  await dialog.getByRole('textbox',{name:'权益包名称',exact:true}).fill('双品牌手机权益包')
  for(const type of ['pt-phone','pt-case','pt-film','pt-leaf-c-charge'])await dialog.locator('[data-type-choice="'+type+'"]').click()
  const preview=dialog.locator('[data-bundle-preview]')
  for(const brand of ['demo18','huawei']){
   const device=devices.find(s=>s.id===brand+'-sku-phone-1')
   await option(dialog.locator('.el-select').filter({has:page.getByRole('combobox',{name:'预览设备',exact:true})}),device.name+' · '+(device.spec||device.code))
   assert.match(await preview.innerText(),brand==='huawei'?/Mate 70 Pro 手机壳/:/iPhone 18 Pro Max 手机壳/)
   assert.doesNotMatch(await preview.innerText(),brand==='huawei'?/iPhone 18 Pro Max 手机壳/:/Mate 70 Pro 手机壳/)
   assert.match(await preview.innerText(),/USB-C 充电器/)
  }
  await dialog.locator('[data-save-bundle]').click();await dialog.waitFor({state:'hidden'});await page.getByRole('row').filter({hasText:'双品牌手机权益包'}).getByRole('button',{name:'使用',exact:true}).click();await page.waitForURL(url=>url.pathname==='/benefits/shopping'&&url.searchParams.has('device'));await settle()
  const group=new URL(page.url()).searchParams.get('group');assert(new URL(page.url()).searchParams.get('device').includes('huawei-sku-phone-1'))
  for(const kind of ['case','film','charger']){
   const id=(kind==='charger'?'demo18':'huawei')+'-sku-'+kind+'-1';assert.equal(await page.locator('[data-sale-add="'+id+'"]').count(),1)
   await page.locator('[data-sale-add="'+id+'"]').click();await page.getByRole('textbox',{name:'报价 '+id}).fill(kind==='charger'?'129':'99')
  }
  assert.equal(await page.locator('[data-sale-line="huawei-sku-phone-1"]').count(),0);assert.equal(await page.locator('[data-sale-add="demo18-sku-case-1"]').count(),0)
  await page.getByRole('spinbutton',{name:'数量 demo18-sku-charger-1'}).fill('2');await page.screenshot({path:resolve(output,'huawei-shopping.png'),fullPage:true})
  const appleRoute='/benefits/shopping?group='+group+'&device=sku:demo18-sku-phone-1'
  await page.evaluate(path=>{window.__brandRoute=document.querySelector('#app').__vue_app__.config.globalProperties.$router.push(path)},appleRoute)
  await page.getByRole('button',{name:'取消，保留原内容',exact:true}).click();await page.evaluate(async()=>await window.__brandRoute);await page.locator('.el-message-box:visible').waitFor({state:'hidden'});await settle();assert(new URL(page.url()).searchParams.get('device').includes('huawei-sku-phone-1'));assert.equal(await page.locator('[data-sale-line="huawei-sku-case-1"]').count(),1)
  await page.evaluate(path=>{window.__brandRoute=document.querySelector('#app').__vue_app__.config.globalProperties.$router.push(path)},appleRoute)
  const impact=page.locator('.el-message-box');assert.match(await impact.innerText(),/Mate 70 Pro/);assert.match(await impact.innerText(),/充电器/)
  await page.getByRole('button',{name:'应用切换并移除',exact:true}).click();await page.evaluate(async()=>await window.__brandRoute);await page.locator('.el-message-box:visible').waitFor({state:'hidden'});await settle()
  assert.equal(await page.locator('[data-sale-line="huawei-sku-case-1"]').count(),0);assert.equal(await page.locator('[data-sale-add="huawei-sku-case-1"]').count(),0);assert.equal(await page.getByRole('spinbutton',{name:'数量 demo18-sku-charger-1'}).inputValue(),'2');assert.equal(Number(await page.getByRole('textbox',{name:'报价 demo18-sku-charger-1'}).inputValue()),129)
  for(const kind of ['case','film']){const id='demo18-sku-'+kind+'-1';await page.locator('[data-sale-add="'+id+'"]').click();await page.getByRole('textbox',{name:'报价 '+id}).fill('99')}
  assert.doesNotMatch(await page.locator('body').innerText(),/演示/);await page.screenshot({path:resolve(output,'apple-shopping.png'),fullPage:true})
  await page.locator('[data-confirm-sale]').click();await settle();assert.match(await page.locator('[data-confirmed-sale]').innerText(),/456.00/)
  await navigate('/catalog?view=models&categoryId=c-phone');await page.locator('[data-catalog-model-table]').waitFor();assert.equal(await page.locator('[data-catalog-model]').count(),4);assert.doesNotMatch(await page.locator('body').innerText(),/演示/)
  const state=JSON.parse(await raw()).data;assert.equal(state.skus.filter(s=>s.recordKind==='sku').length,18);assert.equal(state.skus.filter(s=>s.recordKind==='material').length,18);assert.equal(state.specModelVersions.length,7)
  await page.screenshot({path:resolve(output,'multi-brand-models.png'),fullPage:true});assert.deepEqual(errors,[]);mark('双品牌配置预览、按型号精筛、共用充电器、切换取消与确认保留报价、清单确认、四模型18SKU18MAT、页面无演示字样');writeFileSync(resolve(output,'multi-brand-result.json'),JSON.stringify({result:'PASS',checks,errors},null,2))
 }else if(process.argv.includes('--bundle-list')){
  await page.setViewportSize({width:835,height:780});await page.goto(base+'/benefits/manage',{waitUntil:'networkidle'});await settle()
  const cards=page.locator('[data-bundle-cards]');assert(await cards.isVisible());assert.equal(await page.locator('[data-bundle-table]').isVisible(),false);assert.equal(await page.locator('.scope-panel').isVisible(),false);assert.equal(await cards.locator('[data-bundle-card]').count(),2)
  const card=cards.locator('[data-bundle-card="demo18-bundle-full"]');assert.match(await card.innerText(),/创建时间/);assert.match(await card.innerText(),/更新时间/);assert.match(await card.innerText(),/2026-10-30/)
  const buttons=await card.locator('.card-footer button').evaluateAll(rows=>rows.map(r=>({y:r.getBoundingClientRect().top,bottom:r.getBoundingClientRect().bottom})));assert(buttons.every(r=>Math.abs(r.y-buttons[0].y)<4));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  await page.screenshot({path:resolve(output,'bundle-list-835-dark.png'),fullPage:true})
  await page.setViewportSize({width:1550,height:1000});await page.locator('[data-bundle-table]').waitFor();assert(await page.locator('[data-bundle-table]').getByText('创建时间',{exact:true}).isVisible());assert(await page.locator('[data-bundle-table]').getByText('更新时间',{exact:true}).isVisible());await page.screenshot({path:resolve(output,'bundle-list-desktop-dark.png'),fullPage:true})
  const table=page.locator('[data-bundle-table]'),target=table.getByRole('row').filter({hasText:'手机充电保护权益包'}),remove=()=>target.getByRole('button',{name:'删除',exact:true}),before=await raw()
  await remove().click();await page.getByRole('button',{name:'取消',exact:true}).click();await page.locator('.el-message-box:visible').waitFor({state:'hidden'});assert.equal(await raw(),before)
  await page.evaluate(()=>window.__failWrite=true);await remove().click();await page.getByRole('button',{name:'确认删除',exact:true}).click();await page.locator('.el-message-box:visible').waitFor({state:'hidden'});await settle();assert.equal(await raw(),before);assert.equal(await target.count(),1);assert.match(await page.locator('.list-error').innerText(),/保存|本机/)
  await remove().click();await page.getByRole('button',{name:'确认删除',exact:true}).click();await page.locator('.el-message-box:visible').waitFor({state:'hidden'});await settle();assert.equal(await target.count(),0)
  const stored=JSON.parse(await raw()).data;assert.equal(stored.benefitTypeGroups.length,1);assert.deepEqual(stored.benefitSalesLists,data.benefitSalesLists)
  await page.reload({waitUntil:'networkidle'});await settle();assert.equal(await page.locator('[data-bundle-table] .el-table__body tbody tr').count(),1)
  await navigate('/benefits/shopping?sale=bundle-list-history');await page.locator('[data-confirmed-sale]').waitFor();assert.match(await page.locator('[data-confirmed-sale]').innerText(),/手机充电保护权益包/);assert.match(await page.locator('[data-confirmed-sale]').innerText(),/99.00/)
  assert.deepEqual(errors,[]);mark('835窄屏与桌面布局、创建/更新时间、取消删除、失败原子性、删除持久化和历史快照保留');writeFileSync(resolve(output,'bundle-list-result.json'),JSON.stringify({result:'PASS',checks,errors},null,2))
 }else if(process.argv.includes('--phone18')){
  const {deviceOptions}=await server.ssrLoadModule('/src/domain/benefitSales/query.ts');const chosen=deviceOptions(data).skus.find(s=>s.id==='demo18-sku-phone-1')
  await page.goto(base+'/benefits/manage?category=c-phone',{waitUntil:'networkidle'});await settle();await page.locator('[data-new-bundle]').click();const dialog=page.getByRole('dialog',{name:'权益包配置',exact:true})
  await dialog.getByRole('textbox',{name:'权益包名称',exact:true}).fill('18 Pro Max 配置演示验证')
  assert.equal(await dialog.getByText('全目录',{exact:true}).count(),0)
  for(const type of ['pt-phone','pt-case','pt-film','pt-leaf-c-charge'])await dialog.locator('[data-type-choice="'+type+'"]').click()
  await option(dialog.locator('.el-select').filter({has:page.getByRole('combobox',{name:'预览设备',exact:true})}),chosen.name+' · '+(chosen.spec||chosen.code))
  const preview=dialog.locator('[data-bundle-preview]');assert.match(await preview.innerText(),/iPhone 18 Pro Max 手机壳/);assert.match(await preview.innerText(),/iPhone 18 Pro Max 手机膜/);assert.match(await preview.innerText(),/USB-C 充电器/);assert.doesNotMatch(await preview.innerText(),/iPhone 17|iPhone 16/)
  await dialog.locator('[data-save-bundle]').click();await dialog.waitFor({state:'hidden'});await page.getByRole('row').filter({hasText:'18 Pro Max 配置演示验证'}).getByRole('button',{name:'使用',exact:true}).click();await page.waitForURL(url=>url.pathname==='/benefits/shopping'&&url.searchParams.has('device'));await settle()
  assert(new URL(page.url()).searchParams.get('device').includes('demo18-sku-phone-1'));assert.equal(await page.locator('[data-sale-add="demo18-sku-case-1"]').count(),1);assert.equal(await page.locator('[data-sale-add="demo18-sku-film-1"]').count(),1);assert.equal(await page.locator('[data-sale-add="demo18-sku-charger-1"]').count(),1);assert.equal(await page.locator('[data-sale-add="s-case-orange"]').count(),0)
  for(const kind of ['case','film','charger']){const id='demo18-sku-'+kind+'-1';await page.locator('[data-sale-add="'+id+'"]').click();await page.getByRole('textbox',{name:'报价 '+id}).fill('99')}
  await page.locator('[data-confirm-sale]').click();await settle();assert.match(await page.locator('[data-confirmed-sale]').innerText(),/297.00/)
  await page.screenshot({path:resolve(output,'phone18-confirmed.png'),fullPage:true});assert.deepEqual(errors,[]);mark('手机分类四类型配置 → 18 Pro Max 实时精筛 → 携带设备使用权益包 → 壳膜充电器加购报价确认');await navigate('/catalog?view=models&categoryId=c-phone');await page.locator('[data-catalog-model-table]').waitFor();assert.equal(await page.locator('[data-catalog-model]').count(),4);assert.doesNotMatch(await page.locator('[data-catalog-model-table]').innerText(),/18演示|· 演示/);await page.screenshot({path:resolve(output,'phone-models-final.png'),fullPage:true});writeFileSync(resolve(output,'phone18-result.json'),JSON.stringify({result:'PASS',checks,errors},null,2))
 }else{
 await page.goto(base+'/compatibility?targetId=s-demo-earphones&device=s-iphone-blue',{waitUntil:'networkidle'});await settle();assert.equal(await page.locator('[data-storage-recovery]').count(),0)
 for(const label of labels)await page.locator('.model-picker .options .el-checkbox').filter({has:page.getByText(label,{exact:true})}).click()
 await page.getByRole('textbox',{name:'明确型号共同依据'}).fill('隔离演示：供应商共同资料，两个明确型号')
 await page.getByText('通用适用条件（可与明确型号同时存在）',{exact:true}).click();await page.locator('[data-add-general]').click()
 await option(field('通用适用设备类型'),'手机');await page.getByRole('button',{name:'添加必要条件',exact:true}).click();await option(field('条件参数 1'),'接口（演示）');await option(field('条件取值 1'),'USB-C');await option(field('通用核验状态'),'已核验');await page.getByRole('textbox',{name:'通用资料依据'}).fill('隔离演示：供应商确认必要 USB-C 条件')
 assert.match(await page.locator('.preview').innerText(),/可正常选购/);assert.match(await page.locator('.preview').innerText(),/满足/)
 const original=await raw();await page.evaluate(()=>window.__failWrite=true);await page.locator('[data-save-compat]').click();await settle();assert.equal(await raw(),original);assert.equal(await page.getByRole('textbox',{name:'明确型号共同依据'}).inputValue(),'隔离演示：供应商共同资料，两个明确型号');assert.match(await page.locator('.editor').innerText(),/保存|本机/)
 await page.locator('[data-save-compat]').click();await settle();assert(await page.locator('[data-save-compat]').isDisabled());await page.screenshot({path:resolve(output,'workbench.png'),fullPage:true})
 mark('多型号及通用条件共用正式预览；一次原子保存；失败保留全部输入可重试')
 await page.getByText('按设备查询',{exact:true}).click();assert.match(await page.locator('.reverse').innerText(),/有线耳机/)
 mark('按设备反向查询读取同一份关系并按产品类型展示可售候选')
 await navigate('/benefits/shopping?group=demo-phone-basic&device=sku:s-iphone-blue');await page.locator('[data-sale-add="s-demo-earphones"]').click();await page.getByRole('spinbutton',{name:'数量 s-demo-earphones'}).fill('2');await page.getByRole('textbox',{name:'报价 s-demo-earphones'}).fill('139.50')
 const candidate=page.locator('[data-sale-candidate="s-demo-earphones"]');await candidate.locator('summary').click();await candidate.getByRole('button',{name:'适用资料',exact:true}).click();await page.getByRole('button',{name:'返回选购 / 来源',exact:true}).click();await settle()
 assert.equal(await page.getByRole('spinbutton',{name:'数量 s-demo-earphones'}).inputValue(),'2');assert.equal(await page.getByRole('textbox',{name:'报价 s-demo-earphones'}).inputValue(),'139.50')
 mark('权益包显示正确候选并可加购；维护往返保留未保存数量和报价')
 await page.locator('[data-sale-add="s-case-orange"]').click();await page.getByRole('textbox',{name:'报价 s-case-orange'}).fill('0')
 await page.evaluate(async()=>{window.__routeAttempt=document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/benefits/shopping?group=demo-phone-basic&device=sku:s-demo-iphone16')})
 await page.getByRole('button',{name:'取消，保留原内容',exact:true}).click();await page.evaluate(async()=>await window.__routeAttempt);await page.locator('.el-message-box:visible').waitFor({state:'hidden'});await settle();assert(new URL(page.url()).searchParams.get('device').includes('s-iphone-blue'));assert.equal(await page.locator('[data-sale-line="s-case-orange"]').count(),1)
 await page.evaluate(async()=>{window.__routeAttempt=document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/benefits/shopping?group=demo-phone-basic&device=sku:s-demo-iphone16')})
 await page.getByRole('button',{name:'应用切换并移除',exact:true}).click();await page.evaluate(async()=>await window.__routeAttempt);await page.locator('.el-message-box:visible').waitFor({state:'hidden'});await settle();assert(new URL(page.url()).searchParams.get('device').includes('s-demo-iphone16'));assert.equal(await page.locator('[data-sale-line="s-case-orange"]').count(),0);assert.equal(await page.getByRole('textbox',{name:'报价 s-demo-earphones'}).inputValue(),'139.50')
 mark('显式新设备覆盖工作缓存；取消保持原路由和清单；确认后保留合法商品报价')
 await page.locator('[data-confirm-sale]').click();await settle();assert.match(await page.locator('body').innerText(),/已确认清单/)
 const confirmed=JSON.parse(await raw()).data.benefitSalesLists;await navigate('/compatibility?targetId=s-demo-earphones&device=s-iphone-blue');await page.getByRole('textbox',{name:'明确型号共同依据'}).fill('刷新保护输入')
 let unload=0;page.on('dialog',async d=>{if(d.type()==='beforeunload'){unload++;await d.dismiss()}else await d.dismiss()});await page.reload({waitUntil:'domcontentloaded'}).catch(()=>{});assert.equal(unload,1);assert.equal(await page.getByRole('textbox',{name:'明确型号共同依据'}).inputValue(),'刷新保护输入')
 await page.getByRole('button',{name:'放弃修改',exact:true}).click();await page.getByRole('button',{name:'放弃修改',exact:true}).last().click();await settle();assert.equal(await page.getByRole('textbox',{name:'明确型号共同依据'}).inputValue(),'')
 assert.deepEqual(JSON.parse(await raw()).data.benefitSalesLists,confirmed)
 mark('确认快照冻结；编辑刷新保护有效；明确放弃清理输入')
 await navigate('/skus/s-demo-earphones');assert.equal(await page.locator('[data-sku-compatibility]').count(),1);await page.locator('[data-sku-compatibility]').click();await settle();assert.match(await page.locator('.editing-heading').innerText(),/有线耳机/)
 assert.deepEqual(errors,[]);writeFileSync(resolve(output,'result.json'),JSON.stringify({result:'PASS',checks,errors},null,2));console.log('PASS 完整浏览器流程')
 }
}catch(e){if(page){await page.screenshot({path:resolve(output,'failure.png'),fullPage:true}).catch(()=>{});console.error((await page.locator('body').innerText()).slice(-4500))}throw e}
finally{await browser?.close();await server?.close();removeTestRuntime(runtime)}
