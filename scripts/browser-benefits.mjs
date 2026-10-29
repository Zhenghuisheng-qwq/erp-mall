import assert from 'node:assert/strict'
import {resolve} from 'node:path'
import {createServer} from 'vite'
import {chromium} from 'playwright-core'
import {createTestRuntime,removeTestRuntime} from './test-runtime.mjs'
const runtime=createTestRuntime('benefits'),errors=[]
let server,browser,page
try{
 server=await createServer({cacheDir:resolve(runtime,'vite'),logLevel:'error',define:{'import.meta.env.VITE_RBAC_ENFORCEMENT':JSON.stringify('true')},server:{host:'127.0.0.1',port:0,watch:null,hmr:false,ws:false}})
 const {benefitsFixture}=await server.ssrLoadModule('/scripts/benefits-fixture.ts'),{DATA_VERSION}=await server.ssrLoadModule('/src/domain/types.ts')
 const fixture=benefitsFixture();await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`
 browser=await chromium.launch({channel:'chrome',headless:true})
 const open=async(path,user='u-admin',data=fixture.data)=>{const context=await browser.newContext({viewport:{width:1500,height:1000},locale:'zh-CN',reducedMotion:'reduce'});await context.addInitScript(({data,version,user})=>{if(location.protocol!=='http:')return;if(!localStorage.getItem('iyge-v2-mock-db'))localStorage.setItem('iyge-v2-mock-db',JSON.stringify({version,data}));sessionStorage.setItem('iyge-rbac-simulated-user',user);const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='iyge-v2-mock-db'&&window.__quota)throw new DOMException('isolated quota','QuotaExceededError');return original.call(this,key,value)}},{data,version:DATA_VERSION,user});page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(String(e)));await page.goto(base+path,{waitUntil:'networkidle'});return context}
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('iyge-v2-mock-db')).data)
 const settle=()=>page.evaluate(async()=>{await(await import('/src/stores/catalog.ts')).useCatalogStore().waitForPersistence();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))})
 const choose=async(selector,text,close=true)=>{await page.locator(selector).locator('.el-select__wrapper').click();await page.getByRole('option',{name:text,exact:false}).click();if(close)await page.keyboard.press('Escape')}
 const device=which=>choose('[data-benefit-device]',new RegExp('^演示手机 '+which+' ·'),false)
 const candidates=()=>page.locator('[data-benefit-candidate]').evaluateAll(rows=>rows.map(r=>r.getAttribute('data-benefit-candidate')).sort())
 const add=id=>page.locator(`[data-benefit-add="${id}"]`).click(),line=id=>page.locator(`[data-benefit-line="${id}"]`)
 const price=async(id,value)=>{await line(id).getByRole('textbox',{name:/报价/}).fill(value);await line(id).getByRole('textbox',{name:/报价/}).blur()}
 const closeEditor=async()=>{await page.getByRole('button',{name:'取消／关闭',exact:true}).click();await page.locator('[data-benefit-editor]').waitFor({state:'hidden'})}
 const category=async(id)=>{
  await page.locator('[data-category-tree-select] .trigger').click()
  const panel=page.locator('[data-category-tree-select-panel]')
  const names={'cat-charge':'独立充电目录','cat-accessory-test':'独立测试配件'}
  await panel.getByRole('textbox').fill(names[id]||'')
  await panel.locator(`[data-category-id="${id}"] .node`).click()
 }
 const typeChoice=id=>page.locator(`[data-benefit-type-choice="${id}"]`)
 const hostChoice=range=>page.locator(`[data-benefit-host-choice=${JSON.stringify(JSON.stringify(range))}]`)
 const newGroup=async(name,range)=>{
  await page.locator('[data-new-benefit-group]').click()
  await page.getByRole('textbox',{name:'权益包名称',exact:true}).fill(name)
  assert(await typeChoice('type:type-case').getByRole('checkbox').isDisabled())
  await hostChoice(range).click()
  await typeChoice('category:cat-accessory-test').click()
 }
 const saveGroup=async()=>{await page.locator('[data-save-benefit-group]').click();await settle();await page.getByText('权益包已保存',{exact:true}).last().waitFor()}
 if(!process.argv.includes('--remaining')&&!process.argv.includes('--c')){
 // A: real parent ownership, legal type batch, outside types disabled, category cancellation and reopen.
 const a=await open('/benefits/manage?category=cat-accessory-test')
 await newGroup('分类内保护包',{kind:'type',productTypeId:'type-device'})
 assert(await typeChoice('type:type-case').getByRole('checkbox').isChecked())
 assert(await typeChoice('type:type-film').getByRole('checkbox').isChecked())
 assert(await typeChoice('type:type-charger').getByRole('checkbox').isDisabled())
 assert(await typeChoice('type:type-device').getByRole('checkbox').isDisabled())
 const before=await page.locator('.summary').innerText()
 await category('cat-charge');await page.getByRole('button',{name:'保持原分类',exact:true}).click()
 assert.equal(await page.locator('.summary').innerText(),before)
 assert.match(await page.locator('[data-category-tree-select]').innerText(),/独立测试配件/)
 await page.evaluate(()=>window.__quota=true);await page.locator('[data-save-benefit-group]').click();await page.getByText(/无法保存到本机/).first().waitFor();assert.equal((await read()).benefitGroups.length,0)
 assert.equal(await page.getByRole('textbox',{name:'权益包名称',exact:true}).inputValue(),'分类内保护包')
 await page.evaluate(()=>window.__quota=false);await saveGroup();const group=(await read()).benefitGroups[0]
 assert.equal(group.categoryId,'cat-accessory-test');assert.deepEqual(group.productTypeIds.sort(),['type-case','type-film'])
 await closeEditor();await page.reload({waitUntil:'networkidle'});await page.locator(`[data-benefit-group-record="${group.id}"]`).click()
 assert.equal(await page.getByRole('textbox',{name:'权益包名称',exact:true}).inputValue(),'分类内保护包');assert.match(await page.locator('.summary').innerText(),/测试保护壳/)
 await closeEditor()
 await page.getByRole('textbox',{name:'搜索分类或产品类型',exact:true}).fill('测试保护壳')
 await page.locator('[data-catalog-tree-type="type-case"]').click()
 await page.locator(`[data-benefit-group-record="${group.id}"]`).waitFor()
 assert.match(await page.locator('[data-benefit-manager] h2').innerText(),/按包含类型筛选/)
 console.log('PASS A: parent category/type tree, out-of-scope disabled, category cancel exact, failed save retains input, save/reopen');await a.close()
 }
 if(!process.argv.includes('--c')&&!process.argv.includes('--a')){
 // B: two exact branches in one model; preview and shopping use identical scope calculation.
 const b=await open('/benefits/manage?category=cat-accessory-test')
 const branch=x=>({kind:'snapshot',modelId:fixture.modelId,versionId:fixture.versionId,nodeId:'demo-brand-'+x})
 await newGroup('A 分支包',branch('A'))
 await page.getByRole('combobox',{name:'权益包预览设备'}).click()
 assert.equal(await page.getByRole('option',{name:/^演示手机 B/}).count(),0)
 await page.getByRole('option',{name:/^演示手机 A/}).click()
 assert.deepEqual(await page.locator('[data-benefit-preview-sku]').evaluateAll(rows=>rows.map(r=>r.getAttribute('data-benefit-preview-sku')).sort()),['case-a-sku','case-sku','film-sku'])
 // Management diagnostics retain the unsaved config and preview on return.
 await page.locator('.diagnostics summary').click()
 await page.getByRole('combobox',{name:'配置核对配件'}).click()
 await page.getByRole('option',{name:/pending-sku/}).click()
 await page.getByRole('button',{name:'查看／维护适用依据',exact:true}).click()
 await page.waitForURL('**/compatibility?**');await page.locator('[data-compatibility-return]').click()
 await page.waitForURL('**/benefits/manage?**');await page.locator('[data-benefit-editor]').waitFor()
 assert.equal(await page.getByRole('textbox',{name:'权益包名称',exact:true}).inputValue(),'A 分支包')
 assert.equal(await page.locator('[data-benefit-preview-sku]').count(),3)
 // Adding B is union; removing A immediately previews the now-invalid film type.
 await hostChoice(branch('B')).click()
 const originalPreview=await page.locator('.preview').innerText()
 await page.locator('.summary > div').filter({hasText:'Apple（演示）'}).getByRole('button',{name:'移除范围'}).click()
 await page.getByRole('button',{name:'保持原范围',exact:true}).click()
 assert.equal(await page.locator('.preview').innerText(),originalPreview)
 assert(await typeChoice('type:type-film').getByRole('checkbox').isChecked())
 await page.locator('.summary > div').filter({hasText:'Apple（演示）'}).getByRole('button',{name:'移除范围'}).click()
 await page.getByRole('button',{name:'确认范围并移除失效类型',exact:true}).click()
 assert(await typeChoice('type:type-film').getByRole('checkbox').isDisabled())
 assert(!(await typeChoice('type:type-film').getByRole('checkbox').isChecked()))
 // Return to A before saving this A package.
 await hostChoice(branch('A')).click()
 await page.locator('.summary > div').filter({hasText:'华为（演示）'}).getByRole('button',{name:'移除范围'}).click()
 await typeChoice('type:type-film').click()
 await saveGroup();await closeEditor()
 const savedA=(await read()).benefitGroups.find(g=>g.name==='A 分支包')
 await page.locator(`[data-benefit-group-record="${savedA.id}"]`).click()
 assert(await hostChoice(branch('A')).getByRole('checkbox').isChecked())
 assert.equal(await page.locator('[data-benefit-range-sku="case-a-sku"]').count(),1)
 await closeEditor()
 await newGroup('B 分支包',branch('B'));assert(await typeChoice('type:type-film').getByRole('checkbox').isDisabled());assert.equal(await page.locator('[data-benefit-range-sku="film-sku"]').count(),0);assert.equal(await page.locator('[data-benefit-range-sku="case-a-sku"]').count(),0);assert.deepEqual(await typeChoice('type:type-film').getByRole('checkbox').isChecked(),false);await saveGroup();await closeEditor()
 await newGroup('通用主机类型包',{kind:'type',productTypeId:'type-device'});await saveGroup();await closeEditor()
 const groups=(await read()).benefitGroups
 await page.getByRole('button',{name:'去选购',exact:true}).click();await device('A')
 assert.equal(await page.locator('[data-benefit-group]').count(),2)
 assert.equal(await page.getByRole('button',{name:'B 分支包',exact:true}).count(),0)
 await page.getByRole('button',{name:'A 分支包',exact:true}).click();assert.deepEqual(await candidates(),['case-a-sku','case-sku','film-sku'])
 await device('B');assert.equal(await page.getByRole('button',{name:'A 分支包',exact:true}).count(),0)
 await page.getByRole('button',{name:'B 分支包',exact:true}).click();assert.deepEqual(await candidates(),['case-sku'])
 await page.getByRole('button',{name:'通用主机类型包',exact:true}).click();assert.deepEqual(await candidates(),['case-sku'])
 assert.deepEqual((await read()).benefitGroups,groups)
 console.log('PASS B: independent A/B snapshot branches, type union, out-of-range preview excluded, shared actual SKU query');await b.close()
 }
 if(!process.argv.includes('--a')){
 // C: old lightweight group completion, sales/quote/snapshot preserved, exact URL cancellation.
 const legacyData=structuredClone(fixture.data)
 const {deviceHostKey}=await server.ssrLoadModule('/src/domain/deviceResolution.ts')
 legacyData.benefitGroups=[{id:'legacy',name:'原轻量权益包',scope:{modelId:fixture.modelId,hostKey:deviceHostKey(fixture.hosts.a)},productTypeIds:['type-case'],enabled:true,sort:0,revision:1,createdAt:fixture.now,updatedAt:fixture.now}]
 const c=await open('/benefits/manage','u-admin',legacyData)
 assert.match(await page.locator('[data-benefit-manager]').innerText(),/待补充配置/)
 await page.locator('[data-benefit-group-record="legacy"]').click();await category('cat-accessory-test');await saveGroup();assert.equal((await read()).benefitGroups[0].scope,undefined);await closeEditor()
 await page.getByRole('button',{name:'去选购',exact:true}).click();await device('A');await add('case-sku');await add('case-sku');await price('case-sku','0.00')
 await page.getByRole('button',{name:'原轻量权益包',exact:true}).click()
 await page.getByRole('textbox',{name:'搜索可选配件',exact:true}).fill('no-match-test')
 assert.match(await page.locator('.candidates').innerText(),/搜索没有匹配结果/);assert.doesNotMatch(await page.locator('.candidates').innerText(),/没有已确认适用的在售配件/)
 await page.getByRole('button',{name:'清空搜索',exact:true}).click()
 assert.doesNotMatch(await page.locator('[data-benefit-candidate="case-sku"]').innerText(),/快充未记录/)
 const originalUrl=page.url(),originalList=await page.locator('.selection').innerText(),originalGroups=await page.locator('.group-tabs').innerHTML()
 const requestUrl=()=>page.evaluate(()=>{const router=document.querySelector('#app').__vue_app__.config.globalProperties.$router;void router.push('/benefits/shopping?device=phone-b')})
 await requestUrl();await page.getByRole('dialog',{name:'更换使用设备',exact:true}).waitFor();assert.equal(page.url(),originalUrl)
 await page.getByRole('button',{name:'取消更换',exact:true}).click();await settle()
 assert.equal(page.url(),originalUrl);assert.equal(await page.locator('.selection').innerText(),originalList);assert.equal(await page.locator('.group-tabs').innerHTML(),originalGroups);assert.equal(await line('case-sku').getByRole('textbox',{name:/报价/}).inputValue(),'0.00')
 await page.getByRole('button',{name:'查看适用依据／维护设备身份',exact:true}).click();await page.waitForURL('**/compatibility?**');await page.locator('[data-compatibility-return]').click();await page.waitForURL('**/benefits/shopping?**');assert.equal(page.url(),originalUrl);assert.equal(await page.locator('.selection').innerText(),originalList)
 await requestUrl();await page.locator('[data-apply-benefit-device]').click();await page.waitForURL('**/benefits/shopping?device=phone-b');assert.match(await page.locator('.device-panel').innerText(),/演示手机 B/)
 await page.locator('[data-benefit-confirm]').click();await page.locator('[data-benefit-confirmed]').waitFor();await settle()
 const frozen=JSON.stringify((await read()).benefitSelections[0].snapshot),snapshotText=await page.locator('[data-benefit-confirmed]').innerText()
 await page.evaluate(async()=>{const s=(await import('/src/stores/catalog.ts')).useCatalogStore();s.data.skus.find(x=>x.id==='case-sku').skuName='变更后的配件';s.data.skus.find(x=>x.id==='case-sku').status='off_sale';await s.flushPersistence()})
 assert.equal(JSON.stringify((await read()).benefitSelections[0].snapshot),frozen);assert.equal(await page.locator('[data-benefit-confirmed]').innerText(),snapshotText)
 console.log('PASS C: legacy completion, accurate search empty state, URL cancel keeps device/list/quote/group, diagnostic return, confirmed snapshot immutable');await c.close()
 }
 assert.deepEqual(errors,[]);console.log('PASS requested benefits browser flows; strict RBAC, no page errors, no screenshots or work outputs')
}catch(error){console.error(error);if(page&&!page.isClosed())console.error((await page.locator('body').innerText()).slice(-7000));process.exitCode=1}
finally{await browser?.close();await server?.close();removeTestRuntime(runtime)}
