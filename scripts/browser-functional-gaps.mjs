import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
const output=resolve(process.env.FUNCTIONAL_GAPS_OUTPUT_DIR || 'work/functional-gaps-round1/browser',process.env.BROWSER_CHANNEL||'chrome'), checks=[], diagnostics=[], knownWarnings=[]
mkdirSync(output,{recursive:true})
const server=await createServer({cacheDir:resolve(output,'vite-cache'),server:{host:'127.0.0.1',port:0,open:false,hmr:false,watch:null}})
let browser, page
const mark=name=>{checks.push(name);console.log('PASS '+name)}
try {
  const {functionalGapsFixture}=await server.ssrLoadModule('/scripts/functional-gaps-fixture.ts')
  const fixture=functionalGapsFixture()
  await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true})
  const context=await browser.newContext({viewport:{width:1366,height:768},locale:'zh-CN',reducedMotion:'reduce'})
  await context.addInitScript(data=>{
    if(!localStorage.getItem('iyge-v2-mock-db'))localStorage.setItem('iyge-v2-mock-db',JSON.stringify({version:15,data}))
    window.__failSave=false;window.__writes=0
    const set=Storage.prototype.setItem
    Storage.prototype.setItem=function(key,value){if(key==='iyge-v2-mock-db'){if(window.__failSave)throw new DOMException('验收配额失败','QuotaExceededError');window.__writes++}return set.call(this,key,value)}
  },fixture.data)
  page=await context.newPage();page.setDefaultTimeout(12000)
  const observe=page=>{
    page.on('pageerror',e=>diagnostics.push(String(e)))
    page.on('console',message=>{if(message.type()==='warning'||message.type()==='error'){const text=message.text();if(text.includes('[Vue Flow]: The options parameter is deprecated'))knownWarnings.push(text);else diagnostics.push(text)}})
  };observe(page)
  const settle=()=>page.evaluate(async()=>{const store=(await import('/src/stores/catalog.ts')).useCatalogStore();await (await import('/node_modules/.vite/deps/vue.js')).nextTick();await store.waitForPersistence()})
  const data=()=>page.evaluate(async()=>JSON.parse(JSON.stringify((await import('/src/stores/catalog.ts')).useCatalogStore().data)))
  const ids=()=>page.locator('.sku-table [data-sku-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.skuId))
  const expectIds=async expected=>{await page.waitForFunction(expected=>JSON.stringify([...document.querySelectorAll('.sku-table [data-sku-id]')].map(n=>n.dataset.skuId))===JSON.stringify(expected),expected);assert.deepEqual(await ids(),expected)}
  const quick=id=>page.locator(`[data-quick-key="condition:${id}"]`)
  const input=id=>quick(id).getByRole('textbox')
  async function saveAs(name){await page.getByRole('button',{name:'另存为',exact:true}).click();const dialog=page.getByRole('dialog',{name:'另存为',exact:true});await dialog.getByPlaceholder('视图名称').fill(name);await dialog.getByRole('button',{name:'创建',exact:true}).click();await dialog.waitFor({state:'hidden'});await settle()}
  await page.goto(base+'/skus',{waitUntil:'networkidle'});await settle();await expectIds(['gaps-a','gaps-b'])
  await page.locator('[data-filter-count]').click();let dialog=page.getByRole('dialog',{name:'筛选 SKU'})
  await dialog.locator('[data-rule-id="qa"]').getByText('显示在常用筛选',{exact:true}).click();assert.equal(await quick('qa').count(),1)
  await dialog.getByRole('button',{name:'取消',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.equal(await quick('qa').count(),1)
  await page.locator('[data-filter-count]').click();await dialog.locator('[data-rule-id="qa"]').getByText('显示在常用筛选',{exact:true}).click();await dialog.locator('[data-apply-sku-filter]').click();await dialog.waitFor({state:'hidden'});assert.equal(await quick('qa').count(),0);await expectIds(['gaps-a','gaps-b'])
  await page.locator('[data-filter-count]').click();await dialog.locator('[data-rule-id="qa"]').getByText('显示在常用筛选',{exact:true}).click();await dialog.locator('[data-apply-sku-filter]').click();await dialog.waitFor({state:'hidden'})
  await quick('qa').getByRole('button',{name:/前移/}).click();await settle();await expectIds(['gaps-a','gaps-b'])
  mark('expose cancel/apply/hide/order preserve OR and result order')
  await input('qa').fill('销售');await input('qa').press('Enter');await settle();await expectIds(['gaps-b','gaps-sale'])
  await page.locator('[data-filter-count]').click();assert.equal(await dialog.locator('[data-rule-id="qa"]').getByRole('textbox',{name:'条件取值',exact:true}).inputValue(),'销售');await dialog.getByRole('button',{name:'取消',exact:true}).click();await dialog.waitFor({state:'hidden'})
  await input('qa').fill('');await input('qa').press('Enter');await quick('qa').getByRole('alert').waitFor();await expectIds(['gaps-b','gaps-sale'])
  await page.getByRole('button',{name:'保存视图',exact:true}).click();assert.equal(await page.getByRole('dialog',{name:'另存为'}).count(),0)
  await input('qa').press('Escape');assert.equal(await input('qa').inputValue(),'销售')
  await input('qa').evaluate(el=>{el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:''}));el.value='甲';el.dispatchEvent(new InputEvent('input',{bubbles:true,data:'甲',isComposing:true}));el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,isComposing:true}))});await expectIds(['gaps-b','gaps-sale']);await input('qa').evaluate(el=>{el.value='甲';el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'甲'}));el.dispatchEvent(new InputEvent('input',{bubbles:true,data:'甲'}))});await input('qa').press('Enter');await settle();await expectIds(['gaps-a','gaps-b'])
  await saveAs('常用筛选验收');await page.reload({waitUntil:'networkidle'});await settle();assert.equal(await quick('qa').count(),1)
  const savedId=await page.locator('[data-view-id]').getAttribute('data-view-id')
  await input('qa').fill('销售');await input('qa').press('Enter');await settle();await page.getByRole('button',{name:'恢复已保存配置',exact:true}).click();await settle();await expectIds(['gaps-a','gaps-b'])
  await quick('qa').getByRole('button',{name:'隐藏',exact:true}).click();await settle();assert.equal(await quick('qa').count(),0);await expectIds(['gaps-a','gaps-b'])
  await page.getByRole('button',{name:'恢复已保存配置',exact:true}).click();await settle();assert.equal(await quick('qa').count(),1)
  await page.getByRole('button',{name:'更多',exact:true}).click();await page.getByRole('button',{name:'复制视图',exact:true}).click();await settle();assert.match(await page.locator('.view-current').innerText(),/副本/)
  const copyId=await page.locator('[data-view-id]').getAttribute('data-view-id');assert.notEqual(copyId,savedId);assert.equal(await quick('qa').count(),1)
  mark('same condition edit, invalid input, save guard, Escape, IME, save-as/reload/restore')
  await page.locator('[data-filter-count]').click()
  await dialog.getByRole('button',{name:'复制组',exact:true}).click()
  const ruleIds=await dialog.locator('[data-rule-id]').evaluateAll(nodes=>nodes.map(node=>node.dataset.ruleId));assert.equal(new Set(ruleIds).size,4)
  assert.equal(await dialog.locator('[data-condition-group]').last().locator('input[type=checkbox]:checked').count(),0)
  await dialog.getByRole('button',{name:'取消',exact:true}).click();await dialog.waitFor({state:'hidden'})
  // Hold the actual lock: repeated submission cannot write twice or switch context mid-save.
  await page.evaluate(async()=>{window.__releaseLock=undefined;window.__lockHeld=false;window.__held=navigator.locks.request('iyge-v2-mock-db:commit',async()=>{window.__lockHeld=true;await new Promise(resolve=>window.__releaseLock=resolve)})})
  await page.waitForFunction(()=>window.__lockHeld)
  const writesBefore=await page.evaluate(()=>window.__writes)
  await input('qa').fill('甲手机');await input('qa').press('Enter');await page.waitForFunction(()=>document.querySelector('[data-sku-workbench]').getAttribute('aria-busy')==='true')
  assert(await page.locator('.view-bar').evaluate(el=>el.inert));await page.keyboard.press('Enter')
  await page.evaluate(()=>window.__releaseLock());await settle();assert.equal(await page.evaluate(()=>window.__writes),writesBefore+1)
  await page.getByRole('button',{name:'恢复已保存配置',exact:true}).click();await settle()
  mark('copy group new identities and native held-lock repeat submission/context guard')

  await page.evaluate(()=>window.__failSave=true);await input('qa').fill('销售');await input('qa').press('Enter');await quick('qa').getByRole('alert').waitFor();assert.equal(await input('qa').inputValue(),'销售')
  await page.evaluate(()=>window.__failSave=false);await quick('qa').getByRole('button',{name:'应用输入',exact:true}).click();await settle();await expectIds(['gaps-b','gaps-sale'])
  await page.getByRole('button',{name:'保存视图',exact:true}).click();await settle()
  mark('quota failure retains quick input and retry saves')
  await page.screenshot({path:resolve(output,'quick-dark-1366.png'),fullPage:false})
  await page.goto(base+'/skus?spu=gaps-spu',{waitUntil:'networkidle'});await settle();assert(await page.locator('[data-spu-scope]').isVisible())
  // Add type-specific rules to an applied working configuration through the real command.
  await page.evaluate(async()=>{const store=(await import('/src/stores/catalog.ts')).useCatalogStore();const {cloneSku,defaultSkuConfig,SYSTEM_SKU_VIEW_ID}=await import('/src/domain/skuWorkbenchState.ts');const next=cloneSku(store.data.productListPages.sku),config=defaultSkuConfig();config.conditions.children=[{kind:'rule',id:'date',field:'createdAt',operator:'between',value:{from:'2026-01-01',to:'2026-12-31'}},{kind:'rule',id:'color',field:'attr:gaps-color',operator:'in',value:['黑色','白色']}];config.quickFilters=[{source:'condition',ruleId:'date'},{source:'condition',ruleId:'color'}];next.skuWorkbench.working[`${SYSTEM_SKU_VIEW_ID}@spu:gaps-spu`]=config;const result=await store.commitSkuPage(next);if(!result.ok)throw Error(result.message)})
  await page.reload({waitUntil:'networkidle'});await settle();const beforeDate=await ids()
  await quick('date').getByRole('textbox',{name:'常用范围结束'}).fill('');await quick('date').getByRole('textbox',{name:'常用范围结束'}).press('Enter');await quick('date').getByRole('alert').waitFor();assert.deepEqual(await ids(),beforeDate);await quick('date').getByRole('textbox',{name:'常用范围结束'}).press('Escape')
  await quick('color').locator('.el-select__wrapper').click();await page.locator('.el-select-dropdown__item:visible').filter({hasText:'白色'}).click();await page.keyboard.press('Escape');await settle();await expectIds(['gaps-a','gaps-sale'])
  assert(await page.locator('[data-spu-scope]').isVisible());mark('incomplete date keeps result; dynamic attribute direct editing; SPU scope intersects')
  await page.locator('.theme-switch').click();await page.setViewportSize({width:980,height:768});await page.screenshot({path:resolve(output,'quick-light-980.png')})
  // Real same-origin stale tab conflict, without discarding user input.
  const other=await context.newPage();await other.goto(base+'/account',{waitUntil:'networkidle'});await other.evaluate(async()=>{const store=(await import('/src/stores/catalog.ts')).useCatalogStore();store.data.profile.name='另一标签页更新';await store.flushPersistence()})
  await quick('date').getByRole('textbox',{name:'常用范围开始'}).fill('2026-02-01');await quick('date').getByRole('textbox',{name:'常用范围开始'}).press('Enter');await quick('date').getByRole('alert').waitFor();assert.equal(await quick('date').getByRole('textbox',{name:'常用范围开始'}).inputValue(),'2026-02-01');await other.close();mark('cross-tab conflict retains input')
  await page.reload({waitUntil:'networkidle'});await settle()
  await page.goto(base+`/specs?template=${fixture.modelId}&mode=view`,{waitUntil:'networkidle'});await settle()
  const beforeStructure=JSON.stringify(await data())
  await page.getByText('显示关联物料',{exact:true}).click();const panel=page.locator('[data-structure-materials]');await panel.waitFor()
  const first=panel.locator('[data-material-combo]').first();assert.equal(await first.locator('[data-material-id]').count(),2);assert.equal(await first.getByText('同名历史物料（实际保存）',{exact:false}).count(),2)
  await first.locator('.combo-label').click();assert.equal(await page.locator('[data-material-highlight]').count(),2)
  await settle();assert.equal(JSON.stringify(await data()),beforeStructure)
  await page.setViewportSize({width:1366,height:768});await page.evaluate(()=>{document.documentElement.style.zoom='1.25'});await panel.scrollIntoViewIfNeeded();await page.screenshot({path:resolve(output,'structure-light-125.png')})
  const materialId=await first.locator('[data-material-id]').first().getAttribute('data-material-id');await first.locator('[data-material-id]').first().click();await page.waitForURL(url=>url.pathname.startsWith('/materials/'));assert.equal(new URL(page.url()).searchParams.get('sku'),materialId)
  mark('structure shows two same-name MAT, highlights both value nodes, readonly, opens exact archive')
  await page.evaluate(()=>document.documentElement.style.zoom='1')
  // Verify actual page help and one persisted feature feedback with full context.
  const paths=['/spus','/spus/new','/spus/gaps-spu','/skus','/skus/new?spu=gaps-spu','/skus/gaps-a?spu=gaps-spu','/materials/new',new URL(page.url()).pathname+new URL(page.url()).search,`/specs?template=${fixture.modelId}&mode=view`]
  for(const path of paths){await page.goto(base+path,{waitUntil:'networkidle'});await page.getByRole('button',{name:'页面功能',exact:true}).click();const drawer=page.getByRole('dialog',{name:'页面功能',exact:true});await drawer.waitFor();assert.notEqual((await drawer.locator('.assist-page').innerText()).trim(),'当前页面');assert(await drawer.locator('.assist-item').count()>0);await page.keyboard.press('Escape')}
  await page.goto(base+'/skus/gaps-a?spu=gaps-spu',{waitUntil:'networkidle'});await page.getByRole('button',{name:'页面功能',exact:true}).click();await page.locator('.assist-item').first().getByRole('button',{name:'反馈',exact:true}).click()
  const feedback=page.getByRole('dialog',{name:'反馈问题',exact:true});await feedback.locator('.el-form-item').filter({hasText:'标题'}).locator('input').fill('来源关联验收');await feedback.locator('textarea').fill('仅本机反馈测试');await feedback.getByRole('button',{name:'保存到本机',exact:true}).click();await feedback.waitFor({state:'hidden'});await settle()
  const record=(await data()).feedbacks.find(item=>item.title==='来源关联验收');assert.equal(record.route,'/skus/gaps-a?spu=gaps-spu');assert.equal(record.featureId,'sku.edit.save');assert.equal(record.page,'编辑 SKU');assert.equal(record.featureName,'维护单条 SKU')
  mark('actual help pages and persisted feature feedback preserve dynamic route and query')
  // Historical and draft projection use exact versions and never rename archived MAT.
  await page.evaluate(async({modelId,versionId})=>{const store=(await import('/src/stores/catalog.ts')).useCatalogStore();const v=JSON.parse(JSON.stringify(store.data.specModelVersions.find(v=>v.id===versionId)));v.id='gaps-v2';v.version=2;v.versionName='V2';store.data.specModelVersions.push(v);store.data.planningRecords.filter(p=>p.productModelId===modelId).forEach(p=>p.modelVersionIds.push(v.id));store.data.productSpecNodes.push({id:'g-new',templateId:modelId,parentId:'g-color',nodeType:'VALUE',attributeId:'gaps-color',valueId:'草稿新增色',sort:3,role:'VARIANT'});await store.flushPersistence()},fixture)
  await page.goto(base+`/specs?template=${fixture.modelId}&mode=view`,{waitUntil:'networkidle'});await settle();const historyBefore=JSON.stringify(await data())
  await page.getByText('显示关联物料',{exact:true}).click();const historyPanel=page.locator('[data-structure-materials]'),historyFirst=historyPanel.locator('[data-material-combo]').first()
  assert.match(await historyFirst.innerText(),/本版本未建档/);await historyFirst.locator('summary').click();assert.equal(await historyFirst.locator('[data-material-id]').count(),2)
  await historyPanel.locator('.el-select__wrapper').first().click();await page.locator('.el-select-dropdown__item:visible').filter({hasText:'当前草稿'}).click();assert.equal(await historyPanel.locator('[data-material-combo]').count(),6)
  const fresh=historyPanel.locator('[data-material-combo]').filter({hasText:'草稿新增色'});assert.equal(await fresh.count(),2);assert.equal(await fresh.locator('[data-material-id]').count(),0);assert.match(await fresh.first().innerText(),/未分配 PLN/)
  await settle();assert.equal(JSON.stringify(await data()),historyBefore);mark('historical-only not filed; draft new combinations no invented PLN/MAT; readonly history')
  const {createTemplateCompatibilityFixture}=await server.ssrLoadModule('/scripts/template-compatibility-fixtures.ts'),large=createTemplateCompatibilityFixture({styles:8,colors:32,packs:16})
  const largeContext=await browser.newContext({viewport:{width:1366,height:768},reducedMotion:'reduce'})
  await largeContext.addInitScript(data=>localStorage.setItem('iyge-v2-mock-db',JSON.stringify({version:15,data})),large.data)
  const largePage=await largeContext.newPage();observe(largePage);await largePage.goto(base+`/specs?template=${large.modelId}&mode=view`,{waitUntil:'networkidle'})
  const started=Date.now();await largePage.getByText('显示关联物料',{exact:true}).click();const largePanel=largePage.locator('[data-structure-materials]');await largePanel.waitFor();assert.equal(await largePanel.locator('[data-material-combo]').count(),10);assert.match(await largePanel.innerText(),/4,?096/)
  await largePanel.locator('.btn-next').click();assert.equal(await largePanel.locator('[data-material-combo]').count(),10)
  const dom=await largePage.locator('.vue-flow__node').count();assert(dom<400);mark(`large existing fixture 4096 combinations: 10 rows/page, ${dom} canvas nodes, open ${Date.now()-started} ms`);await largeContext.close()
  assert.deepEqual(diagnostics,[])
  writeFileSync(resolve(output,`${process.env.BROWSER_CHANNEL||'chrome'}-result.json`),JSON.stringify({result:'PASS',browser:browser.version(),checks,diagnostics,knownWarnings:[...new Set(knownWarnings)],savedId},null,2))
}catch(error){await page?.screenshot({path:resolve(output,'failure.png')}).catch(()=>{});writeFileSync(resolve(output,`${process.env.BROWSER_CHANNEL||'chrome'}-result.json`),JSON.stringify({result:'FAIL',error:String(error),checks,diagnostics},null,2));throw error}
finally{await browser?.close();await server.close()}
