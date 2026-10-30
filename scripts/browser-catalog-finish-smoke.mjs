// Three bounded Chrome workflows for the catalog finishing changes. No artifact output.
import assert from 'node:assert/strict'
import {resolve} from 'node:path'
import {createServer} from 'vite'
import {chromium} from 'playwright-core'
import {createTestRuntime,removeTestRuntime} from './test-runtime.mjs'
const runtime=createTestRuntime('catalog-finish-smoke'),errors=[]
let server,browser,page
try{
 server=await createServer({cacheDir:resolve(runtime,'vite'),logLevel:'error',server:{host:'127.0.0.1',port:0,watch:null,hmr:false,ws:false}})
 const {catalogClosureFixture}=await server.ssrLoadModule('/scripts/catalog-closure-fixture.ts'),{DATA_VERSION}=await server.ssrLoadModule('/src/domain/types.ts'),{normalizeStored}=await server.ssrLoadModule('/src/stores/catalog.ts')
 const {data,a,b,c,v1,bv}=catalogClosureFixture()
 data.categories.push(...[['finish-root',null,'收尾根'],['finish-branch','finish-root','收尾中层'],['finish-leaf','finish-branch','收尾末级']].map(([id,parentId,name])=>({id,parentId,name,sort:999,enabled:id!=='finish-leaf'})))
 const seed=normalizeStored({version:DATA_VERSION,data})
 await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`
 browser=await chromium.launch({channel:'chrome',headless:true})
 const context=await browser.newContext({viewport:{width:1550,height:1000},locale:'zh-CN',reducedMotion:'reduce'})
 await context.addInitScript(({data,version})=>{
  if(location.protocol!=='http:')return
  if(!localStorage.getItem('iyge-v2-mock-db'))localStorage.setItem('iyge-v2-mock-db',JSON.stringify({version,data}))
  sessionStorage.setItem('iyge-rbac-simulated-user','u-admin');localStorage.setItem('iyge-spec-rail-fold','0');localStorage.setItem('iyge-spec-cat-fold','0')
  window.state=(selector,name)=>{let instance=document.querySelector(selector)?.__vueParentComponent;while(instance&&instance.type.__name!==name)instance=instance.parent;if(!instance)throw Error(`${name} not ready`);return instance.setupState}
 },{data:seed,version:DATA_VERSION})
 page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(String(error)))
 const settle=async()=>{await page.evaluate(async()=>{await(await import('/src/stores/catalog.ts')).useCatalogStore().waitForPersistence();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))})}
 const go=async path=>{if(page.url()==='about:blank')await page.goto(base+path,{waitUntil:'networkidle'});else await page.evaluate(path=>document.querySelector('#app').__vue_app__.config.globalProperties.$router.push(path),path);await settle()}
 const raw=()=>page.evaluate(()=>localStorage.getItem('iyge-v2-mock-db'))
 const cat=id=>page.locator(`[data-catalog-category="${id}"]`),twist=id=>page.locator(`[data-catalog-expand="${id}"]`)
 async function select(label,option,container=page){await container.locator('.el-select').filter({has:page.getByRole('combobox',{name:label,exact:true})}).locator('.el-select__wrapper').click();await page.getByRole('option',{name:option,exact:true}).click();await settle()}

 // 1. Filter transitions seed once; folds, layouts, themes and legacy clear stay read-only.
 await go('/catalog?view=categories');const initial=await raw()
 const totals=()=>page.locator('[data-catalog-totals]').innerText()
 const scopeTotals=await totals(),search=page.getByRole('textbox',{name:'搜索分类名称或编号',exact:true})
 await page.locator('[data-catalog-collapse-all]').click();await twist('finish-root').click();await search.fill('finish-leaf');await cat('finish-leaf').waitFor()
 await twist('finish-branch').click();assert.equal(await cat('finish-leaf').count(),0)
 await page.locator('[data-catalog-expand-all]').click();await cat('finish-leaf').waitFor()
 await page.locator('[data-catalog-collapse-all]').click();assert.equal(await cat('finish-branch').count(),0)
 await page.getByText('列表表格',{exact:true}).click();await cat('finish-leaf').waitFor();assert.equal(await page.locator('.category-cell .folder').count(),0)
 await page.getByText('树形结构',{exact:true}).click();assert.equal(await cat('finish-branch').count(),0)
 await search.fill('收尾末级');await cat('finish-leaf').waitFor();await search.fill('');await cat('finish-branch').waitFor();assert.equal(await cat('finish-leaf').count(),0)
 await select('资料状态','停用');await cat('finish-leaf').waitFor();await twist('finish-branch').click();assert.equal(await cat('finish-leaf').count(),0)
 await page.locator('[data-catalog-collapse-all]').click();assert.equal(await cat('finish-branch').count(),0);await page.locator('[data-catalog-expand-all]').click();await cat('finish-leaf').waitFor()
 await page.locator('.query-toolbar .el-select').first().hover();await page.locator('.query-toolbar .el-select').first().locator('.el-select__clear').click();await settle();assert.equal(await cat('finish-leaf').count(),0)
 assert.equal(await totals(),scopeTotals)
 await page.locator('[data-catalog-expand-all]').click();await cat('finish-leaf').waitFor()
 assert.equal(await cat('finish-leaf').locator('..').locator('..').locator('.folder').count(),0)
 for(const dark of [false,true]){
  await page.evaluate(dark=>document.documentElement.classList.toggle('dark',dark),dark)
  const styles=await twist('finish-root').evaluate(button=>({border:getComputedStyle(button).borderWidth,background:getComputedStyle(button).backgroundColor,width:button.getBoundingClientRect().width,folderSize:getComputedStyle(button.parentElement.querySelector('.folder')).fontSize}))
  assert.equal(styles.border,'0px');assert.equal(styles.background,'rgba(0, 0, 0, 0)');assert(styles.width>=24);assert.equal(styles.folderSize,'15px')
  await twist('finish-root').focus();assert.equal(await twist('finish-root').evaluate(element=>element===document.activeElement),true)
 }
 for(const alias of ['keyword','search']){
  await go(`/catalog?view=models&${alias}=old-keyword&categoryId=c-phone&scope=current&sort=name-desc&page=2`)
  const input=page.getByRole('textbox',{name:'搜索模型名称、编号或关联信息',exact:true});assert.equal(await input.inputValue(),'old-keyword');await input.fill('')
  await page.waitForFunction(()=>new URL(location.href).searchParams.get('q')==='');const query=new URL(page.url()).searchParams
  assert.equal(query.has(alias),false);assert.equal(query.get('categoryId'),'c-phone');assert.equal(query.get('scope'),'current');assert.equal(query.get('sort'),'name-desc');assert.equal(query.get('page'),'2')
  assert(await page.evaluate(()=>window.state('[data-catalog-models]','ModelLedger').filtered.length)>0)
  await page.reload({waitUntil:'networkidle'});assert.equal(await input.inputValue(),'')
 }
 assert.equal(await raw(),initial);console.log('PASS flow 1: search/status folds, condition changes, clear restores base, tree/list, light/dark icons, keyword/search clear + reload + preserved page/scope')

 // 2. Switch through the actual rail, then inspect the actual published rows and material.
 await go(`/specs?template=${a}&versionId=${v1.id}&mode=view`);await page.locator('.model-line').filter({hasText:b}).click()
 await page.waitForFunction(b=>window.state('.designer','SpecConfigView').templateId===b,b);await settle()
 const current=await page.evaluate(()=>{const s=window.state('.designer','SpecConfigView');return {id:s.comboVersionId,status:JSON.parse(JSON.stringify(s.comboStatus))}})
 assert.equal(current.id,bv.id);assert(current.status.rows.length>0);assert(current.status.rows.every(row=>row.modelVersionId===bv.id));assert(current.status.rows.some(row=>row.materials.some(card=>card.skuId==='closure-material'&&card.modelVersionId===bv.id)))
 assert.equal(new URL(page.url()).searchParams.has('versionId'),false)
 await page.locator('.model-line').filter({hasText:c}).click();await settle();assert.equal(await page.evaluate(()=>window.state('.designer','SpecConfigView').comboVersionId),'')
 assert.equal(await raw(),initial);console.log('PASS flow 2: A historical versionId → B actual owned combos/MAT, then unpublished C; no business writes')

 // 3. Create two real types and models, reload, inspect details and the correct workspace direction.
 for(const [role,label] of [['host','主机／设备'],['accessory','配件']]){
  await go('/catalog?view=types&categoryId=c-phone');await page.locator('[data-catalog-create-type]').click()
  const form=page.locator('[data-catalog-type-form]');await form.getByRole('textbox',{name:'产品类型名称',exact:true}).fill(`收尾类型-${role}`);await select('产品类型业务用途',label,form);await form.getByRole('button',{name:'保存',exact:true}).click();await form.waitFor({state:'hidden'});await settle()
  const type=JSON.parse(await raw()).data.productTypes.find(item=>item.name===`收尾类型-${role}`);assert.equal(type.catalogRole,role)
  await page.reload({waitUntil:'networkidle'});await page.locator(`[data-catalog-type="${type.id}"]`).click();assert.match(await page.locator('[data-type-purpose]').innerText(),new RegExp(label));await page.locator('[data-catalog-type-detail] .el-dialog__headerbtn').click()
  await page.locator('[data-catalog-view="models"]').click();await page.locator('[data-catalog-create-model]').click();const modelForm=page.locator('[data-catalog-model-form]')
  await select('模型产品类型',`${type.name} · ${type.id}`,modelForm);await modelForm.getByRole('textbox',{name:'模型名称',exact:true}).fill(`收尾模型-${role}`);await modelForm.getByRole('button',{name:'创建模型',exact:true}).click();await modelForm.waitFor({state:'hidden'})
  await page.locator('[data-catalog-model-detail]').waitFor();await page.reload({waitUntil:'networkidle'});
 }
 console.log('PASS flow 3: new host/accessory types persist after reload; actual new-model details retain the selected product type')
 assert.deepEqual(errors,[])
 await context.close()
}catch(error){console.error(error);if(page)console.error((await page.locator('body').innerText()).slice(0,2500));process.exitCode=1}
finally{if(browser)await browser.close();if(server)await server.close();removeTestRuntime(runtime)}
