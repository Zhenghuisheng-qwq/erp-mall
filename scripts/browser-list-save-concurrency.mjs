import assert from 'node:assert/strict'
import {resolve} from 'node:path'
import {createServer} from 'vite'
import {chromium} from 'playwright-core'
import {createTestRuntime,removeTestRuntime} from './test-runtime.mjs'

// Every burst below holds the real origin Web Lock. Later clicks/keystrokes are
// ordinary Playwright actions, without force or waiting for the save to finish.
const runtime=createTestRuntime('list-save-concurrency'),errors=[]
let server,browser,page,groups=0
const mark=name=>{groups++;console.log(`PASS ${name}`)}
const clone=value=>JSON.parse(JSON.stringify(value))
try {
 browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true})
 for(const strict of process.env.LIST_STRICT?[process.env.LIST_STRICT==='true']:[false,true]) {
  server=await createServer({cacheDir:resolve(runtime,strict?'strict':'default'),logLevel:'error',define:{'import.meta.env.VITE_RBAC_ENFORCEMENT':JSON.stringify(String(strict))},server:{host:'127.0.0.1',port:0,watch:null,hmr:false,ws:false}})
  const {createAccessoryCompatibilityFixture}=await server.ssrLoadModule('/scripts/accessory-compatibility-fixtures.ts')
  const {ensureProductListPages}=await server.ssrLoadModule('/src/domain/productListPages.ts')
  const {emptyModeQuery}=await server.ssrLoadModule('/src/domain/productListQuery.ts')
  const {defaultSkuConfig,createSkuSavedView,SYSTEM_SKU_VIEW_ID}=await server.ssrLoadModule('/src/domain/skuWorkbenchState.ts')
  const {pinSkuField}=await server.ssrLoadModule('/src/domain/skuQuickFilters.ts')
  const {skuFields}=await server.ssrLoadModule('/src/domain/skuWorkbenchFields.ts')
  const {ensureRbac}=await server.ssrLoadModule('/src/domain/rbac.ts')
  const {DATA_VERSION}=await server.ssrLoadModule('/src/domain/types.ts')
  await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`
  for(const mode of process.env.LIST_MODE?[process.env.LIST_MODE]:['spu','sku']) {
   const {data}=createAccessoryCompatibilityFixture();ensureRbac(data);ensureProductListPages(data)
   data.categories=[{id:'host',name:'主机',parentId:null,enabled:true,sort:0},{id:'phone',name:'手机',parentId:'host',enabled:true,sort:1},{id:'tablet',name:'平板',parentId:'host',enabled:true,sort:2},...data.categories]
   data.families.find(f=>f.id==='family-device').categoryId='phone';data.families.find(f=>f.id==='family-unbound').categoryId='tablet'
   const firstSpu=data.productListPages.spu.views[0];firstSpu.name='连续操作视图';firstSpu.categoryFilterLayout='sidebar';firstSpu.spuQuery=emptyModeQuery('spu');firstSpu.spuQuery.exposed=['attr:attr-brand','name']
   const secondSpu={...clone(firstSpu),id:'concurrency-second',name:'第二视图'}
   data.productListPages.spu.views=[firstSpu,secondSpu];data.productListPages.spu.activeId=firstSpu.id;data.productListPages.spu.query.keyword=''
   let skuConfig=defaultSkuConfig();skuConfig.categoryLayout='sidebar'
   for(const id of ['attr:attr-brand','name'])skuConfig=pinSkuField(skuConfig,skuFields(data).find(f=>f.id===id))
   const secondSku=createSkuSavedView('concurrency-second','第二视图',clone(skuConfig),data.productListPages.sku.views.find(v=>v.id===SYSTEM_SKU_VIEW_ID))
   data.productListPages.sku.views=[data.productListPages.sku.views.find(v=>v.id===SYSTEM_SKU_VIEW_ID),secondSku]
   Object.assign(data.productListPages.sku.skuWorkbench,{defaultId:SYSTEM_SKU_VIEW_ID,activeId:SYSTEM_SKU_VIEW_ID,working:{[SYSTEM_SKU_VIEW_ID]:clone(skuConfig)},order:[SYSTEM_SKU_VIEW_ID,secondSku.id],favorites:[secondSku.id]});data.productListPages.sku.query.keyword=''
   const firstId=mode==='spu'?firstSpu.id:SYSTEM_SKU_VIEW_ID
   const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN',reducedMotion:'reduce'})
   await context.addInitScript(({data,version})=>{
    if(location.protocol!=='http:')return
    if(!localStorage.getItem('iyge-v2-mock-db'))localStorage.setItem('iyge-v2-mock-db',JSON.stringify({version,data}))
    const original=Storage.prototype.setItem;window.__writes=[]
    Storage.prototype.setItem=function(key,value){if(key==='iyge-v2-mock-db'){if(window.__quota)throw new DOMException('continuous save quota','QuotaExceededError');window.__writes.push(value)}return original.call(this,key,value)}
   },{data,version:DATA_VERSION})
   page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(String(e)));await page.goto(`${base}/${mode}s`,{waitUntil:'networkidle'})
   await page.evaluate(async()=>{window.__store=(await import('/src/stores/catalog.ts')).useCatalogStore();window.__actions=[];window.__store.$onAction(({name})=>window.__actions.push(name));await window.__store.waitForPersistence()})
   const tree=()=>page.locator('[data-category-tree]:visible'),node=id=>tree().locator(`[data-category-id="${id}"]`)
   const row=field=>page.locator(mode==='spu'?`[data-exposed-field="${field}"]`:`[data-quick-key="condition:quick:${field}"]`)
   const nameInput=()=>row('name').getByRole('textbox'),brand=()=>row('attr:attr-brand')
   const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('iyge-v2-mock-db')).data)
   const business=d=>JSON.stringify([d.families,d.skus,d.params,d.categories]),businessBefore=business(await saved())
   const configOf=(d,id=firstId)=>mode==='spu'?d.productListPages.spu.views.find(v=>v.id===id).spuQuery:d.productListPages.sku.skuWorkbench.working[id]||d.productListPages.sku.views.find(v=>v.id===id).skuWorkbench
   const rulesOf=config=>mode==='spu'?config.filters:(function flatten(group){return group.children.flatMap(item=>item.kind==='group'?flatten(item):[item])})(config.conditions)
   const active=(config,field)=>rulesOf(config).filter(rule=>rule.field===field&&rule.active!==false)
   const categoryOf=(d,id=firstId)=>active(configOf(d,id),'category').flatMap(rule=>Array.isArray(rule.value)?rule.value:[rule.value])
   async function settle(){await page.waitForTimeout(220);await page.waitForFunction(mode=>mode==='spu'?/已保存|保存失败|临时查询/.test(document.querySelector('[data-view-save-state]')?.textContent||''):['saved','failed'].includes(document.querySelector('[data-save-state]')?.getAttribute('data-save-state')||''),mode);await page.evaluate(async()=>{await window.__store.waitForPersistence();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))})}
   async function hold(){await settle();await page.evaluate(async()=>{const {CATALOG_LOCK}=await import('/src/stores/catalogPersistence.ts');window.__held=false;window.__hold=navigator.locks.request(CATALOG_LOCK,()=>new Promise(resolve=>{window.__held=true;window.__release=resolve}))});await page.waitForFunction(()=>window.__held)}
   async function waiting(){const until=Date.now()+7000;while(Date.now()<until){if(await page.evaluate(async mode=>(await navigator.locks.query()).pending.length>0&&(mode==='spu'?document.querySelector('[data-view-save-state]')?.textContent?.includes('保存中'):!!document.querySelector('[data-save-state="saving"]')),mode))return;await page.waitForTimeout(20)}throw new Error(`${mode}: no configuration save reached the held Web Lock`)}
   async function release(){await page.evaluate(()=>window.__release());await settle()}
   async function selected(id){assert.equal(await node(id).getAttribute('aria-pressed'),'true',`${mode}: latest category must be selected before persistence`)}
   async function expand(){if(await tree().locator('[data-expand-id="host"]').getAttribute('aria-expanded')!=='true')await tree().locator('[data-expand-id="host"]').click()}
   async function clearPage(){const button=page.getByRole('button',{name:'清空筛选',exact:true});if(await button.count())await button.click();await settle()}
   async function chooseBrand(){await brand().getByRole('combobox').fill('DeviceLab');await page.getByRole('option',{name:'DeviceLab',exact:true}).last().click();await page.keyboard.press('Escape')}
   async function clearBrand(){await brand().locator('.el-select').hover();await brand().locator('.el-select__clear').click()}
   const command=mode==='spu'?'commitSpuPage':'commitSkuPage'
   await tree().waitFor();await expand()

   await hold();const beforeBurst=await saved();await node('host').click();await waiting();await selected('host');await node('phone').click();await selected('phone');await node('tablet').click();await selected('tablet')
   assert.match(await page.locator('[data-result-count]').innerText(),mode==='spu'?/1 款/:/1 条/);assert.deepEqual((await saved()).productListPages,beforeBurst.productListPages)
   await release();assert.deepEqual(categoryOf(await saved()),['tablet']);await selected('tablet');mark(`${mode}/${strict}: A → B → C while first Web Lock is pending, immediate result and final C`)

   await clearPage();await hold();await node('phone').click();await waiting();await chooseBrand();assert.match(await brand().innerText(),/已生效/);await selected('phone');await release()
   let persisted=await saved();assert.deepEqual(categoryOf(persisted),['phone']);assert(active(configOf(persisted),'attr:attr-brand').some(rule=>JSON.stringify(rule.value).includes('DeviceLab')))
   mark(`${mode}/${strict}: category and brand updates in one pending burst both persist`)

   await clearPage();await hold();await node('phone').click();await waiting();await chooseBrand();await clearBrand();await selected('phone');assert.doesNotMatch(await brand().innerText(),/已生效/)
   await release();persisted=await saved();assert.deepEqual(categoryOf(persisted),['phone']);assert.equal(active(configOf(persisted),'attr:attr-brand').length,0);mark(`${mode}/${strict}: selecting then clearing brand cannot be revived by an old save`)

   await clearPage();const beforeClear=configOf(await saved());await hold();await nameInput().fill(mode==='sku'?'phone-a':'family-device');await nameInput().press('Enter');await waiting();await page.getByRole('button',{name:'清空筛选',exact:true}).click()
   assert.equal(await nameInput().inputValue(),'');await nameInput().blur();await release();persisted=await saved();assert.equal(rulesOf(configOf(persisted)).filter(rule=>rule.active!==false).length,0);assert.equal(await nameInput().inputValue(),'')
   const afterClear=configOf(persisted);for(const key of mode==='spu'?['exposed','grouping','sorting','sortMode']:['quickFilters','columns','groups','sorts','sortMode'])assert.deepEqual(afterClear[key],beforeClear[key])
   mark(`${mode}/${strict}: page clear received during save, clear survives blur and preserves display/sort/group`)

   await hold();await node('phone').click();await waiting();await page.locator('[data-view-tab="concurrency-second"]').click();await page.locator('[data-view-tab="concurrency-second"][aria-selected="true"]').waitFor();await expand();await node('tablet').click();await selected('tablet')
   await release();persisted=await saved();assert.deepEqual(categoryOf(persisted),['phone']);assert.deepEqual(categoryOf(persisted,'concurrency-second'),['tablet']);await selected('tablet')
   await page.locator(`[data-view-tab="${firstId}"]`).click();await node('phone').waitFor();await selected('phone');await settle();mark(`${mode}/${strict}: view switch during save preserves both view drafts, old response leaves target intact`)

   await clearPage();const beforeFailure=await page.evaluate(()=>localStorage.getItem('iyge-v2-mock-db'));await page.evaluate(()=>window.__quota=true);await hold();await node('phone').click();await waiting();await release()
   await page.getByRole('button',{name:'重试保存',exact:true}).first().waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('iyge-v2-mock-db')),beforeFailure);await selected('phone');await node('tablet').click();await selected('tablet');await settle();assert.equal(await page.evaluate(()=>localStorage.getItem('iyge-v2-mock-db')),beforeFailure)
   await page.evaluate(()=>window.__quota=false);await page.getByRole('button',{name:'重试保存',exact:true}).first().click();await settle();assert.deepEqual(categoryOf(await saved()),['tablet']);await selected('tablet');mark(`${mode}/${strict}: failed atomic save retains latest draft; edit after failure then retry saves latest only`)

   await clearPage();await hold();await nameInput().fill(mode==='sku'?'phone-a':'family-device');await nameInput().press('Enter');await waiting();await nameInput().fill(mode==='sku'?'phone-b':'family-unbound');const latestText=await nameInput().inputValue();await release();assert.equal(await nameInput().inputValue(),latestText)
   const beforeEnter=await page.evaluate(command=>window.__actions.filter(name=>name===command).length,command);await nameInput().press('Enter');await nameInput().blur();await settle();assert.equal(await page.evaluate(command=>window.__actions.filter(name=>name===command).length,command),beforeEnter+1);assert(active(configOf(await saved()),'name').some(rule=>rule.value===latestText))
   mark(`${mode}/${strict}: late save response preserves newer unsubmitted input; Enter plus blur submits once`)

   await clearPage();await hold();const beforeIme=await page.evaluate(command=>window.__actions.filter(name=>name===command).length,command);await nameInput().dispatchEvent('compositionstart');await nameInput().fill('中文待提交');await nameInput().dispatchEvent('keydown',{key:'Enter',code:'Enter',isComposing:true,keyCode:229});await page.waitForTimeout(100)
   assert.equal(await page.evaluate(command=>window.__actions.filter(name=>name===command).length,command),beforeIme);await nameInput().dispatchEvent('compositionend');await nameInput().press('Enter');await waiting();await nameInput().blur();assert.equal(await page.evaluate(command=>window.__actions.filter(name=>name===command).length,command),beforeIme+1,'one command must be queued after composition ends');await release();assert.equal(await page.evaluate(command=>window.__actions.filter(name=>name===command).length,command),beforeIme+1,'blur must not repeat the committed composition');assert(active(configOf(await saved()),'name').some(rule=>rule.value==='中文待提交'))
   mark(`${mode}/${strict}: IME composition does not submit; completed Enter/blur queues exactly once`)

   if(mode==='sku') {
    await clearPage();await page.locator('[data-view-tab="concurrency-second"]').click();await clearPage();await expand();await hold();await node('phone').click();await waiting();await nameInput().fill('phone-a');await page.getByRole('button',{name:'保存视图',exact:true}).click();await release()
    persisted=await saved();const named=persisted.productListPages.sku.views.find(view=>view.id==='concurrency-second').skuWorkbench
    assert(active(named,'category').some(rule=>JSON.stringify(rule.value).includes('phone')));assert(active(named,'name').some(rule=>rule.value==='phone-a'));mark(`sku/${strict}: save named view includes queued category and latest input at click`)
    await page.locator(`[data-view-tab="${firstId}"]`).click();await clearPage();await page.locator('[data-list-spu] .el-select__suffix').click();await page.getByRole('option',{name:/family-device/}).last().click();await page.locator('[data-spu-scope]').waitFor();await settle()
    // A temporary scope may initially use its own default collapsed layout.
    if(await page.locator('[data-category-trigger]').count())await page.locator('[data-category-trigger]').click();await tree().waitFor();await expand();await settle();await hold();await node('phone').click();await waiting();await page.getByRole('button',{name:'查看全部 SKU',exact:true}).click();await page.waitForURL(/\/skus$/);await release()
    persisted=await saved();assert.deepEqual(categoryOf(persisted),[]);assert.deepEqual(categoryOf(persisted,`${SYSTEM_SKU_VIEW_ID}@spu:family-device`),['phone']);assert.equal(await page.locator('[data-spu-scope]').count(),0);mark(`sku/${strict}: leave temporary SPU scope during save without writing it into all-SKU work`)
    if(await page.locator('[data-category-trigger]').count())await page.locator('[data-category-trigger]').click();await tree().waitFor();await expand();await settle()
   }

   await clearPage();await hold();const beforeIdentity=await saved();await node('phone').click();await waiting();assert((await page.evaluate(()=>{const s=window.__store,id=s.data.users.find(user=>user.enabled&&user.id!==s.activeUserId).id;return s.startPermissionPreview(id)})).ok);await release();assert.deepEqual((await saved()).productListPages,beforeIdentity.productListPages)
   assert.equal(business(await saved()),businessBefore);mark(`${mode}/${strict}: preview identity change invalidates pending write, business data unchanged`)
   await context.close()
  }
  await server.close();server=undefined
 }
 assert.deepEqual(errors,[]);console.log(`PASS list save concurrency browser ${groups} groups, no screenshots or persistent artifacts`)
} catch(error) {
 console.error(error);if(page)console.error((await page.locator('body').innerText().catch(()=>'' )).slice(0,5000));process.exitCode=1
} finally {await browser?.close();await server?.close();removeTestRuntime(runtime)}
