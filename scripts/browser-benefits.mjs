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
 // A: no configuration, conservative candidates, sales-only authorization, failed save preserves input, reopen.
 if(!process.argv.includes('--remaining')&&!process.argv.includes('--c')){
 const a=await open('/benefits/shopping','demo-sales-user');await device('A')
 assert.deepEqual(await candidates(),['case-sku','charger-sku','film-sku']);assert.equal((await read()).benefitGroups.length,0)
 assert.equal(await page.getByRole('button',{name:'权益包管理',exact:true}).count(),0);assert.equal(await page.locator('.diagnostics').count(),0)
 await add('film-sku');await add('film-sku');await price('film-sku','12.34');assert.equal(await line('film-sku').getByRole('spinbutton').inputValue(),'2')
 const original=await read();await page.evaluate(()=>window.__quota=true);await page.locator('[data-benefit-save-draft]').click();await page.locator('[data-benefit-error]').waitFor();assert.equal(await line('film-sku').getByRole('textbox',{name:/报价/}).inputValue(),'12.34');assert.deepEqual(await read(),original)
 await page.evaluate(()=>window.__quota=false);await page.locator('[data-benefit-save-draft]').click();await settle();let stored=await read();assert.equal(stored.benefitSelections.length,1);assert.equal(stored.benefitSelections[0].lines[0].unitPriceCents,1234)
 await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'已保存清单',exact:true}).click();await page.locator(`[data-open-benefit-selection="${stored.benefitSelections[0].id}"]`).click();assert.equal(await line('film-sku').getByRole('spinbutton').inputValue(),'2');assert.equal(await line('film-sku').getByRole('textbox',{name:/报价/}).inputValue(),'12.34')
 console.log('PASS A: no group configuration; actual A candidates only, separate permissions, quota preserves draft, retry and saved-record reopen');await a.close()
 }
 if(!process.argv.includes('--c')){
 // B: model tree root and B identity node share one manager, independent scopes and live candidate discovery.
 const b=await open(`/specs?template=${fixture.modelId}&version=${fixture.versionId}&mode=view`)
 await page.locator('[data-open-model-benefits]').click();await page.waitForURL('**/benefits/manage?**');await page.locator('[data-new-benefit-group]').click();await page.getByRole('textbox',{name:'权益包名称',exact:true}).fill('演示旅行权益包')
 await choose('[data-benefit-group-types]','测试保护壳')
 await page.locator('[data-save-benefit-group]').click();await settle();let groupData=await read();assert.equal(groupData.benefitGroups[0].scope.modelId,fixture.modelId);assert.equal(groupData.benefitGroups[0].scope.hostKey,undefined)
 await page.getByRole('button',{name:'返回模型',exact:true}).click();await page.locator('.vue-flow__node[data-id="demo-B"]').click();await page.locator('[data-open-node-benefits]').click();await page.locator('[data-new-benefit-group]').click();await page.getByRole('textbox',{name:'权益包名称',exact:true}).fill('B 办公权益包')
 await choose('[data-benefit-group-types]','测试线缆');await page.locator('[data-save-benefit-group]').click();await settle();groupData=await read();assert.equal(groupData.benefitGroups.length,2);assert(groupData.benefitGroups[1].scope.hostKey)
 await page.getByRole('button',{name:'去选购',exact:true}).click();await device('B');assert.equal(await page.locator('[data-benefit-group]').count(),2);await page.locator(`[data-benefit-group="${groupData.benefitGroups[1].id}"]`).click();assert.deepEqual(await candidates(),['cable-sku']);await add('cable-sku');await page.getByRole('button',{name:'全部可选商品',exact:true}).click();assert.equal(await line('cable-sku').count(),1)
 const mutation=await page.evaluate(async()=>{const s=(await import('/src/stores/catalog.ts')).useCatalogStore(),sku=JSON.parse(JSON.stringify(s.data.skus.find(x=>x.id==='case-sku')));sku.id='dynamic-sku';sku.code='DYNAMIC';sku.skuName='演示动态配件';s.data.skus.push(sku);await s.flushPersistence();const link=JSON.parse(JSON.stringify(s.data.compatibilities.find(x=>x.id==='demo-common-b')));link.id='dynamic-link';link.accessorySkuId=link.targetId=sku.id;return await s.commitCompatibilityChanges([{kind:'add',draft:{...link,target:{kind:'sku',id:sku.id}}}])});assert(mutation.ok,JSON.stringify(mutation))
 await page.locator(`[data-benefit-group="${groupData.benefitGroups[0].id}"]`).click();await page.locator('[data-benefit-candidate="dynamic-sku"]').waitFor();assert.deepEqual((await read()).benefitGroups,groupData.benefitGroups)
 console.log('PASS B: root/model and explicit B-node groups, independent scopes, candidate filtering, selection retained, new formal accessory appears without editing groups');await b.close()
 }
 // C: actual product entrance, cancel/apply device impact, immutable confirmation and current-data copy review.
 const c=await open('/skus/phone-a');await page.locator('[data-sku-benefit-shopping]').click();await page.locator('[data-benefit-candidate="film-sku"]').waitFor();await add('film-sku');await add('case-sku');await page.locator('[data-benefit-add-phone]').click();await price('film-sku','10');await price('case-sku','0');await price('phone-a','100')
 const selectedBefore=await page.locator('.selection').innerText();await page.getByRole('button',{name:'查看适用依据／维护设备身份',exact:true}).click();await page.waitForURL('**/compatibility?**');await page.locator('[data-compatibility-return]').click();await page.waitForURL('**/benefits/shopping?**');assert.equal(await page.locator('.selection').innerText(),selectedBefore);await device('B');const preview=page.getByRole('dialog',{name:'更换使用设备',exact:true});assert.match(await preview.innerText(),/原手机将移除/);await preview.getByRole('button',{name:'取消更换',exact:true}).click();assert.equal(await page.locator('.selection').innerText(),selectedBefore);assert.match(await page.locator('.device-panel').innerText(),/演示手机 A/)
 await device('B');await page.locator('[data-apply-benefit-device]').click();assert.equal(await line('film-sku').count(),0);assert.equal(await line('phone-a').count(),0);assert.equal(Number(await line('case-sku').getByRole('textbox',{name:/报价/}).inputValue()),0)
 await page.locator('[data-benefit-confirm]').click();await page.locator('[data-benefit-confirmed]').waitFor();await settle();const confirmed=(await read()).benefitSelections[0],frozen=JSON.stringify(confirmed.snapshot),text=await page.locator('[data-benefit-confirmed]').innerText()
 await page.evaluate(async()=>{const s=(await import('/src/stores/catalog.ts')).useCatalogStore();s.data.skus.find(x=>x.id==='case-sku').skuName='变更后名称';s.data.skus.find(x=>x.id==='case-sku').status='off_sale';await s.flushPersistence()});assert.equal(await page.locator('[data-benefit-confirmed]').innerText(),text);assert.equal(JSON.stringify((await read()).benefitSelections[0].snapshot),frozen)
 await page.locator('[data-copy-benefit-selection]').click();assert.match(await line('case-sku').innerText(),/当前不在售/);assert.equal(Number(await line('case-sku').getByRole('textbox',{name:/报价/}).inputValue()),0);assert.equal(await page.locator('[data-benefit-candidate="case-sku"]').count(),0)
 console.log('PASS C: SKU detail entrance; device change cancel is exact, apply removes old phone/A-only items; confirmed snapshot immutable; copied stale line retains quote and is flagged');await c.close()
 assert.deepEqual(errors,[]);console.log('PASS requested benefits browser flows; strict RBAC, no page errors, no screenshots or work outputs')
}catch(error){console.error(error);if(page&&!page.isClosed())console.error((await page.locator('body').innerText()).slice(-7000));process.exitCode=1}
finally{await browser?.close();await server?.close();removeTestRuntime(runtime)}
